-- P4.4 : progression détaillée, reprise de lecture et événements idempotents.

alter table public.series_progress
  alter column completed_at drop not null,
  alter column completed_at drop default,
  add column if not exists state text,
  add column if not exists progress_percent smallint,
  add column if not exists position_seconds double precision,
  add column if not exists duration_seconds double precision,
  add column if not exists started_at timestamptz,
  add column if not exists client_updated_at timestamptz,
  add column if not exists server_updated_at timestamptz,
  add column if not exists source text;

update public.series_progress
set
  state = 'completed',
  progress_percent = 100,
  position_seconds = 0,
  duration_seconds = 0,
  started_at = coalesce(started_at, completed_at, last_accessed_at, now()),
  client_updated_at = coalesce(client_updated_at, last_accessed_at, completed_at, now()),
  server_updated_at = coalesce(server_updated_at, last_accessed_at, completed_at, now()),
  source = coalesce(source, 'manual')
where state is null;

alter table public.series_progress
  alter column state set default 'in_progress',
  alter column state set not null,
  alter column progress_percent set default 0,
  alter column progress_percent set not null,
  alter column position_seconds set default 0,
  alter column position_seconds set not null,
  alter column duration_seconds set default 0,
  alter column duration_seconds set not null,
  alter column started_at set default now(),
  alter column started_at set not null,
  alter column client_updated_at set default now(),
  alter column client_updated_at set not null,
  alter column server_updated_at set default now(),
  alter column server_updated_at set not null,
  alter column source set default 'online',
  alter column source set not null,
  drop constraint if exists series_progress_state_check,
  add constraint series_progress_state_check check (state in ('in_progress', 'completed')),
  drop constraint if exists series_progress_percent_check,
  add constraint series_progress_percent_check check (progress_percent between 0 and 100),
  drop constraint if exists series_progress_position_check,
  add constraint series_progress_position_check check (position_seconds >= 0),
  drop constraint if exists series_progress_duration_check,
  add constraint series_progress_duration_check check (duration_seconds >= 0),
  drop constraint if exists series_progress_source_check,
  add constraint series_progress_source_check check (source in ('online', 'offline_sync', 'manual')),
  drop constraint if exists series_progress_completed_check,
  add constraint series_progress_completed_check check (
    (state = 'completed' and progress_percent = 100 and completed_at is not null)
    or (state = 'in_progress' and completed_at is null)
  );

create index if not exists series_progress_user_series_accessed_idx
  on public.series_progress (user_id, series_id, last_accessed_at desc);

create table if not exists public.progress_events (
  event_id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  series_id uuid not null references public.series (id) on delete cascade,
  message_id uuid not null references public.messages (id) on delete cascade,
  request_payload jsonb not null,
  result_payload jsonb,
  created_at timestamptz not null default now()
);

create index if not exists progress_events_user_created_idx
  on public.progress_events (user_id, created_at desc);

create index if not exists progress_events_created_idx
  on public.progress_events (created_at);

alter table public.progress_events enable row level security;
revoke all privileges on table public.progress_events from anon, authenticated;
grant select, insert, update, delete on table public.progress_events to service_role;

create or replace function public.apply_progress_event(
  p_event_id uuid,
  p_user_id uuid,
  p_series_id uuid,
  p_message_id uuid,
  p_state text,
  p_progress_percent smallint,
  p_position_seconds double precision,
  p_duration_seconds double precision,
  p_client_updated_at timestamptz,
  p_source text
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_request jsonb;
  v_existing_event public.progress_events%rowtype;
  v_inserted_event uuid;
  v_current public.series_progress%rowtype;
  v_result public.series_progress%rowtype;
  v_state text;
  v_percent smallint;
  v_position double precision;
  v_duration double precision;
  v_completed_at timestamptz;
  v_now timestamptz := now();
  v_result_payload jsonb;
begin
  if p_state not in ('in_progress', 'completed')
    or p_progress_percent not between 0 and 100
    or p_position_seconds < 0
    or p_duration_seconds < 0
    or p_source not in ('online', 'offline_sync', 'manual') then
    raise exception 'INVALID_PROGRESS_EVENT';
  end if;

  if not exists (
    select 1
    from public.series s
    join public.series_messages sm on sm.series_id = s.id
    join public.messages m on m.id = sm.message_id
    where s.id = p_series_id
      and sm.message_id = p_message_id
      and s.status = 'published'
      and m.status = 'published'
  ) then
    raise exception 'PROGRESS_CONTENT_NOT_AVAILABLE';
  end if;

  v_request := jsonb_build_object(
    'state', p_state,
    'progressPercent', p_progress_percent,
    'positionSeconds', p_position_seconds,
    'durationSeconds', p_duration_seconds,
    'clientUpdatedAt', p_client_updated_at,
    'source', p_source
  );

  insert into public.progress_events (
    event_id, user_id, series_id, message_id, request_payload
  ) values (
    p_event_id, p_user_id, p_series_id, p_message_id, v_request
  )
  on conflict (event_id) do nothing
  returning event_id into v_inserted_event;

  if v_inserted_event is null then
    select * into v_existing_event
    from public.progress_events
    where event_id = p_event_id;

    if v_existing_event.user_id <> p_user_id
      or v_existing_event.series_id <> p_series_id
      or v_existing_event.message_id <> p_message_id
      or v_existing_event.request_payload <> v_request then
      raise exception 'PROGRESS_EVENT_ID_CONFLICT';
    end if;

    return coalesce(v_existing_event.result_payload, '{}'::jsonb)
      || jsonb_build_object('eventId', p_event_id, 'replayed', true);
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(p_user_id::text || ':' || p_series_id::text || ':' || p_message_id::text, 0)
  );

  select * into v_current
  from public.series_progress
  where user_id = p_user_id
    and series_id = p_series_id
    and message_id = p_message_id
  for update;

  v_position := greatest(coalesce(v_current.position_seconds, 0), p_position_seconds);
  v_duration := greatest(coalesce(v_current.duration_seconds, 0), p_duration_seconds);
  v_percent := greatest(coalesce(v_current.progress_percent, 0), p_progress_percent);
  v_state := case
    when v_current.state = 'completed' or p_state = 'completed' or p_source = 'manual' or v_percent >= 90 then 'completed'
    else 'in_progress'
  end;

  if v_state = 'completed' then
    v_percent := 100;
    v_completed_at := coalesce(v_current.completed_at, v_now);
  else
    v_completed_at := null;
  end if;

  insert into public.series_progress (
    user_id,
    series_id,
    message_id,
    state,
    progress_percent,
    position_seconds,
    duration_seconds,
    started_at,
    completed_at,
    last_accessed_at,
    client_updated_at,
    server_updated_at,
    source
  ) values (
    p_user_id,
    p_series_id,
    p_message_id,
    v_state,
    v_percent,
    v_position,
    v_duration,
    v_now,
    v_completed_at,
    v_now,
    p_client_updated_at,
    v_now,
    p_source
  )
  on conflict (user_id, series_id, message_id) do update set
    state = excluded.state,
    progress_percent = excluded.progress_percent,
    position_seconds = excluded.position_seconds,
    duration_seconds = excluded.duration_seconds,
    completed_at = coalesce(public.series_progress.completed_at, excluded.completed_at),
    last_accessed_at = excluded.last_accessed_at,
    client_updated_at = greatest(public.series_progress.client_updated_at, excluded.client_updated_at),
    server_updated_at = excluded.server_updated_at,
    source = case
      when excluded.state = 'completed' and public.series_progress.state <> 'completed' then excluded.source
      when excluded.position_seconds > public.series_progress.position_seconds then excluded.source
      when excluded.position_seconds = public.series_progress.position_seconds
        and excluded.client_updated_at >= public.series_progress.client_updated_at then excluded.source
      else public.series_progress.source
    end
  returning * into v_result;

  v_result_payload := jsonb_build_object(
    'eventId', p_event_id,
    'replayed', false,
    'module', jsonb_build_object(
      'messageId', v_result.message_id,
      'state', v_result.state,
      'progressPercent', v_result.progress_percent,
      'positionSeconds', v_result.position_seconds,
      'durationSeconds', v_result.duration_seconds,
      'startedAt', v_result.started_at,
      'completedAt', v_result.completed_at,
      'lastAccessedAt', v_result.last_accessed_at,
      'clientUpdatedAt', v_result.client_updated_at,
      'serverUpdatedAt', v_result.server_updated_at,
      'source', v_result.source
    )
  );

  update public.progress_events
  set result_payload = v_result_payload
  where event_id = p_event_id;

  -- La déduplication couvre les synchronisations récentes ; la rétention longue
  -- appartient aux données de progression consolidées, pas au journal technique.
  delete from public.progress_events
  where user_id = p_user_id
    and created_at < v_now - interval '30 days';

  return v_result_payload;
end;
$$;

revoke execute on function public.apply_progress_event(
  uuid, uuid, uuid, uuid, text, smallint, double precision, double precision, timestamptz, text
) from public, anon, authenticated;
grant execute on function public.apply_progress_event(
  uuid, uuid, uuid, uuid, text, smallint, double precision, double precision, timestamptz, text
) to service_role;

create or replace view public.series_completion_stats
with (security_invoker = true)
as
with active_modules as (
  select sm.series_id, sm.message_id
  from public.series_messages sm
  join public.messages m on m.id = sm.message_id
  where m.status = 'published'
),
completion_counts as (
  select sp.user_id, sp.series_id, count(*) filter (where sp.state = 'completed') as completed_count
  from public.series_progress sp
  join active_modules am on am.series_id = sp.series_id and am.message_id = sp.message_id
  group by sp.user_id, sp.series_id
),
module_counts as (
  select series_id, count(*) as total_modules
  from active_modules
  group by series_id
)
select
  s.id as series_id,
  s.title,
  coalesce(mc.total_modules, 0)::integer as total_modules,
  count(distinct sp.user_id) as enrolled_users,
  count(distinct case
    when mc.total_modules > 0 and cc.completed_count >= mc.total_modules then cc.user_id
  end) as completed_users
from public.series s
left join module_counts mc on mc.series_id = s.id
left join public.series_progress sp on sp.series_id = s.id
left join completion_counts cc on cc.series_id = s.id and cc.user_id = sp.user_id
group by s.id, s.title, mc.total_modules;
