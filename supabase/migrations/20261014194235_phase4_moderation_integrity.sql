-- P4.3 MC-C. Additive foundation; deploy with the MC-D API integration, not alone.
-- Historical decisions are NOT reconstructed. service_role remains trusted infrastructure.
begin;

alter table public.comments add column version integer not null default 1 check (version > 0);
alter table public.comment_reports add column version integer not null default 1 check (version > 0);

create table public.comment_moderation_events (
  id uuid primary key default gen_random_uuid(),
  -- Deliberately no FK: deleting a user/comment/report must not erase its history.
  comment_id uuid not null,
  report_id uuid,
  actor_id uuid not null,
  action text not null check (action in ('hide','restore','delete','author_delete',
    'report_created','report_resolved','report_dismissed','report_auto_resolved')),
  previous_status text,
  next_status text not null,
  previous_version integer,
  next_version integer not null check (next_version > 0),
  reason text not null default '' check (char_length(reason) <= 500),
  request_id uuid not null,
  created_at timestamptz not null default clock_timestamp(),
  check ((previous_version is null and next_version = 1) or
    (previous_version is not null and previous_version > 0 and next_version = previous_version + 1))
);
comment on table public.comment_moderation_events is
  'Append-only application history from MC-C onward. UUID snapshots survive resource deletion; no historical backfill.';
create index comment_moderation_events_comment_date_idx
  on public.comment_moderation_events (comment_id, created_at desc, id desc);
create index comment_moderation_events_report_date_idx
  on public.comment_moderation_events (report_id, created_at desc, id desc) where report_id is not null;
alter table public.comment_moderation_events enable row level security;
revoke all on public.comment_moderation_events from public, anon, authenticated, service_role;
grant select on public.comment_moderation_events to service_role;

create schema moderation_private;
revoke all on schema moderation_private from public, anon, authenticated;
grant usage on schema moderation_private to service_role;

create function moderation_private.reject_event_mutation() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  raise exception using errcode = '42501', message = 'Moderation history is append-only';
end;
$$;
create trigger moderation_events_no_rewrite before update or delete
  on public.comment_moderation_events for each statement
  execute function moderation_private.reject_event_mutation();
create trigger moderation_events_no_truncate before truncate
  on public.comment_moderation_events for each statement
  execute function moderation_private.reject_event_mutation();

-- Called only by the private transactional functions. Session/MFA validation remains
-- mandatory in the Edge Function (MC-D); p_actor is derived there, never from HTTP JSON.
create function moderation_private.assert_actor(p_actor uuid, p_moderator boolean) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  -- Normally null for a service credential. If a user subject is propagated,
  -- it must agree with the actor; service-only EXECUTE grants remain mandatory.
  if auth.uid() is not null and auth.uid() is distinct from p_actor then
    raise exception using errcode = 'PT403', message = 'Actor does not match authenticated subject';
  end if;
  if p_actor is null or not exists (select 1 from auth.users where id = p_actor) then
    raise exception using errcode = 'PT403', message = 'Actor unavailable';
  end if;
  if exists (select 1 from public.user_account_status where user_id = p_actor and status = 'suspended') then
    raise exception using errcode = 'PT403', message = 'Actor unavailable';
  end if;
  if p_moderator and not exists (select 1 from public.user_role_assignments
      where user_id = p_actor and role in ('moderator','admin','super_admin')) then
    raise exception using errcode = 'PT403', message = 'Moderation permission required';
  end if;
end;
$$;

create function moderation_private.decide_comment(
  p_comment_id uuid, p_actor_id uuid, p_action text, p_expected_version integer,
  p_reason text, p_request_id uuid
) returns public.comments
language plpgsql security definer set search_path = '' as $$
declare
  before_row public.comments;
  after_row public.comments;
  report_row public.comment_reports;
  target_status text;
  clean_reason text := btrim(coalesce(p_reason, ''), E' \t\r\n');
begin
  if p_action is null or p_action not in ('hide','restore','delete','author_delete')
      or p_expected_version is null or p_expected_version < 1 or p_request_id is null
      or char_length(clean_reason) > 500 then
    raise exception using errcode = 'PT400', message = 'Invalid moderation command';
  end if;
  perform moderation_private.assert_actor(p_actor_id, p_action <> 'author_delete');
  if p_action in ('hide','delete') and clean_reason = '' then
    raise exception using errcode = 'PT400', message = 'Reason required';
  end if;
  select * into before_row from public.comments where id = p_comment_id for update;
  if not found then raise exception using errcode = 'PT404', message = 'Comment not found'; end if;
  if p_action = 'author_delete' and before_row.user_id <> p_actor_id then
    raise exception using errcode = 'PT403', message = 'Only the author can delete this comment';
  end if;
  if before_row.version <> p_expected_version then
    raise exception using errcode = 'PT409', message = 'Comment version conflict';
  end if;
  if not ((before_row.status = 'visible' and p_action in ('hide','delete','author_delete'))
      or (before_row.status = 'hidden' and p_action in ('restore','delete','author_delete'))) then
    raise exception using errcode = 'PT409', message = 'Forbidden comment transition';
  end if;
  target_status := case p_action when 'hide' then 'hidden' when 'restore' then 'visible'
    when 'delete' then 'deleted_by_moderation' else 'deleted_by_author' end;
  if p_action = 'author_delete' then clean_reason := 'author_deleted'; end if;
  update public.comments set status = target_status, version = version + 1,
    moderated_at = clock_timestamp(), moderated_by = p_actor_id, moderation_reason = clean_reason
    where id = p_comment_id returning * into after_row;
  insert into public.comment_moderation_events
    (comment_id,actor_id,action,previous_status,next_status,previous_version,next_version,reason,request_id)
    values (p_comment_id,p_actor_id,p_action,before_row.status,after_row.status,
      before_row.version,after_row.version,clean_reason,p_request_id);
  if p_action <> 'restore' then
    -- All commands lock comment first, then reports in UUID order.
    for report_row in select * from public.comment_reports
      where comment_id = p_comment_id and status = 'open' order by id for update
    loop
      update public.comment_reports set status = 'resolved', version = version + 1,
        reviewed_at = clock_timestamp(), reviewed_by = p_actor_id, resolution_note = clean_reason
        where id = report_row.id;
      insert into public.comment_moderation_events
        (comment_id,report_id,actor_id,action,previous_status,next_status,previous_version,next_version,reason,request_id)
        values (p_comment_id,report_row.id,p_actor_id,'report_auto_resolved','open','resolved',
          report_row.version,report_row.version + 1,clean_reason,p_request_id);
    end loop;
  end if;
  return after_row;
end;
$$;

create function moderation_private.resolve_report(
  p_report_id uuid, p_actor_id uuid, p_status text, p_expected_version integer,
  p_note text, p_request_id uuid
) returns public.comment_reports
language plpgsql security definer set search_path = '' as $$
declare
  parent_id uuid;
  before_row public.comment_reports;
  after_row public.comment_reports;
  clean_note text := btrim(coalesce(p_note, ''), E' \t\r\n');
begin
  if p_status is null or p_status not in ('resolved','dismissed')
      or p_expected_version is null or p_expected_version < 1 or p_request_id is null
      or char_length(clean_note) > 500 then
    raise exception using errcode = 'PT400', message = 'Invalid report command';
  end if;
  perform moderation_private.assert_actor(p_actor_id, true);
  select comment_id into parent_id from public.comment_reports where id = p_report_id;
  if not found then raise exception using errcode = 'PT404', message = 'Report not found'; end if;
  perform 1 from public.comments where id = parent_id for update;
  if not found then raise exception using errcode = 'PT404', message = 'Comment not found'; end if;
  select * into before_row from public.comment_reports where id = p_report_id for update;
  if not found then raise exception using errcode = 'PT404', message = 'Report not found'; end if;
  if before_row.comment_id <> parent_id or before_row.status <> 'open' or before_row.version <> p_expected_version then
    raise exception using errcode = 'PT409', message = 'Report version or state conflict';
  end if;
  update public.comment_reports set status = p_status, version = version + 1,
    reviewed_at = clock_timestamp(), reviewed_by = p_actor_id, resolution_note = clean_note
    where id = p_report_id returning * into after_row;
  insert into public.comment_moderation_events
    (comment_id,report_id,actor_id,action,previous_status,next_status,previous_version,next_version,reason,request_id)
    values (parent_id,p_report_id,p_actor_id,'report_' || p_status,before_row.status,p_status,
      before_row.version,after_row.version,clean_note,p_request_id);
  return after_row;
end;
$$;

create function moderation_private.create_report(
  p_comment_id uuid, p_actor_id uuid, p_reason text, p_detail text, p_request_id uuid
) returns public.comment_reports
language plpgsql security definer set search_path = '' as $$
declare
  parent_id uuid;
  parent_status text;
  comment_row public.comments;
  report_row public.comment_reports;
  clean_detail text := btrim(coalesce(p_detail, ''), E' \t\r\n');
begin
  if p_reason is null or p_reason not in ('spam','harassment','inappropriate_content','misinformation','other')
      or char_length(clean_detail) > 500 or p_request_id is null then
    raise exception using errcode = 'PT400', message = 'Invalid report';
  end if;
  perform moderation_private.assert_actor(p_actor_id, false);
  select message_id into parent_id from public.comments where id = p_comment_id;
  if not found then raise exception using errcode = 'PT404', message = 'Comment not found'; end if;
  -- Parent before child, also compatible with FK cascade deletion. SHARE prevents
  -- concurrent unpublication until the report transaction has committed.
  select status into parent_status from public.messages where id = parent_id for share;
  if not found or parent_status <> 'published' then
    raise exception using errcode = 'PT404', message = 'Content unavailable';
  end if;
  select * into comment_row from public.comments where id = p_comment_id for update;
  if not found then raise exception using errcode = 'PT404', message = 'Comment not found'; end if;
  if comment_row.message_id <> parent_id then
    raise exception using errcode = 'PT409', message = 'Comment changed';
  end if;
  if comment_row.user_id = p_actor_id then
    raise exception using errcode = 'PT403', message = 'Self-report forbidden';
  end if;
  if comment_row.status <> 'visible' then
    raise exception using errcode = 'PT409', message = 'Comment is not reportable';
  end if;
  if exists (select 1 from public.comment_reports where comment_id = p_comment_id and reporter_id = p_actor_id) then
    raise exception using errcode = 'PT409', message = 'Already reported';
  end if;
  insert into public.comment_reports (comment_id,reporter_id,reason,detail)
    values (p_comment_id,p_actor_id,p_reason,clean_detail) returning * into report_row;
  insert into public.comment_moderation_events
    (comment_id,report_id,actor_id,action,previous_status,next_status,previous_version,next_version,reason,request_id)
    values (p_comment_id,report_row.id,p_actor_id,'report_created',null,'open',null,1,p_reason,p_request_id);
  return report_row;
end;
$$;

-- Public RPC entry points are SECURITY INVOKER, executable only by service_role.
-- p_actor_id MUST come from getUser/requirePermission, never from the request body.
create function public.moderate_comment_transaction(
  p_comment_id uuid, p_actor_id uuid, p_action text, p_expected_version integer,
  p_reason text default '', p_request_id uuid default gen_random_uuid()
) returns public.comments language sql security invoker set search_path = '' as $$
  select moderation_private.decide_comment(p_comment_id,p_actor_id,p_action,p_expected_version,p_reason,p_request_id);
$$;
create function public.resolve_comment_report_transaction(
  p_report_id uuid, p_actor_id uuid, p_status text, p_expected_version integer,
  p_note text default '', p_request_id uuid default gen_random_uuid()
) returns public.comment_reports language sql security invoker set search_path = '' as $$
  select moderation_private.resolve_report(p_report_id,p_actor_id,p_status,p_expected_version,p_note,p_request_id);
$$;
create function public.create_comment_report_transaction(
  p_comment_id uuid, p_actor_id uuid, p_reason text,
  p_detail text default '', p_request_id uuid default gen_random_uuid()
) returns public.comment_reports language sql security invoker set search_path = '' as $$
  select moderation_private.create_report(p_comment_id,p_actor_id,p_reason,p_detail,p_request_id);
$$;

revoke all on all functions in schema moderation_private from public, anon, authenticated, service_role;
grant execute on function moderation_private.decide_comment(uuid,uuid,text,integer,text,uuid),
  moderation_private.resolve_report(uuid,uuid,text,integer,text,uuid),
  moderation_private.create_report(uuid,uuid,text,text,uuid) to service_role;
revoke all on function public.moderate_comment_transaction(uuid,uuid,text,integer,text,uuid),
  public.resolve_comment_report_transaction(uuid,uuid,text,integer,text,uuid),
  public.create_comment_report_transaction(uuid,uuid,text,text,uuid) from public, anon, authenticated;
grant execute on function public.moderate_comment_transaction(uuid,uuid,text,integer,text,uuid),
  public.resolve_comment_report_transaction(uuid,uuid,text,integer,text,uuid),
  public.create_comment_report_transaction(uuid,uuid,text,text,uuid) to service_role;

commit;
