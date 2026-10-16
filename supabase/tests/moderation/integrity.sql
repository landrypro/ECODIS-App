\set ON_ERROR_STOP on
begin;
create function pg_temp.assert_true(ok boolean, label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAIL: %', label; end if; end $$;
create function pg_temp.expect_error(command text, expected text) returns void language plpgsql as $$
begin
  begin execute command;
  exception when others then
    if sqlstate = expected then return; end if;
    raise exception 'Expected %, got %: %', expected, sqlstate, sqlerrm;
  end;
  raise exception 'Expected error %, command succeeded', expected;
end $$;

select pg_temp.assert_true((select count(*) = 20 and min(version) = 1 and max(version) = 1 from public.comments), 'legacy comment versions');
select pg_temp.assert_true((select version = 1 from public.comment_reports limit 1), 'legacy report version');
select pg_temp.assert_true((select count(*) = 0 from public.comment_moderation_events), 'no fabricated history');
select pg_temp.assert_true((select relrowsecurity from pg_class where oid = 'public.comment_moderation_events'::regclass), 'RLS enabled');

-- Matrix exhaustively exercised on fresh rows, including terminal states.
do $$
declare s text; a text; cid uuid; allowed boolean; result public.comments;
begin
  foreach s in array array['visible','hidden','deleted_by_author','deleted_by_moderation'] loop
    foreach a in array array['hide','restore','delete','author_delete'] loop
      cid := gen_random_uuid();
      insert into public.comments(id,message_id,user_id,user_name,user_email,text,status)
        values(cid,'10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','Test','test@example.invalid','unchanged',s);
      allowed := (s='visible' and a in ('hide','delete','author_delete')) or (s='hidden' and a in ('restore','delete','author_delete'));
      begin
        result := public.moderate_comment_transaction(cid,
          case when a='author_delete' then '00000000-0000-0000-0000-000000000001'::uuid else '00000000-0000-0000-0000-000000000002'::uuid end,
          a,1,'test reason');
        if not allowed then raise exception 'Unexpected transition % %',s,a; end if;
        perform pg_temp.assert_true(result.version=2 and result.text='unchanged', 'version/text');
        perform pg_temp.assert_true(result.status=case a when 'hide' then 'hidden' when 'restore' then 'visible' when 'delete' then 'deleted_by_moderation' else 'deleted_by_author' end, 'target status');
      exception when sqlstate 'PT409' then
        if allowed then raise exception 'Allowed transition rejected: % %',s,a; end if;
      end;
    end loop;
  end loop;
end $$;

-- Execute commands with the actual application DB role, not the owner.
set local role service_role;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',true);
select pg_temp.expect_error($q$select public.moderate_comment_transaction('20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','hide',1,'test')$q$,'PT403');
select set_config('request.jwt.claim.sub','',true);
select public.moderate_comment_transaction('20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','hide',1,'spam');
select pg_temp.assert_true((select status='resolved' and version=2 from public.comment_reports where id='30000000-0000-0000-0000-000000000001'),'reports resolved atomically');
select pg_temp.expect_error($q$select public.moderate_comment_transaction('20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','restore',1)$q$,'PT409');
select public.moderate_comment_transaction('20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','restore',2);
select pg_temp.assert_true((select status='resolved' from public.comment_reports where id='30000000-0000-0000-0000-000000000001'),'restore does not reopen');
select pg_temp.expect_error($q$select public.moderate_comment_transaction('20000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000003','hide',1,'test')$q$,'PT403');
select pg_temp.expect_error($q$select public.moderate_comment_transaction('20000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000002','author_delete',1)$q$,'PT403');
select pg_temp.expect_error($q$select public.moderate_comment_transaction('20000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000002','hide',1,' ' )$q$,'PT400');
select pg_temp.expect_error($q$select public.moderate_comment_transaction('20000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000002','hide',null,'test')$q$,'PT400');
select pg_temp.expect_error($q$select public.create_comment_report_transaction('20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000003','spam')$q$,'PT409');
select pg_temp.expect_error($q$select public.create_comment_report_transaction('20000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','spam')$q$,'PT403');
select public.create_comment_report_transaction('20000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000003','spam');
select public.resolve_comment_report_transaction(id,'00000000-0000-0000-0000-000000000002','dismissed',1,'test') from public.comment_reports where comment_id='20000000-0000-0000-0000-000000000002';
select pg_temp.expect_error(format('select public.resolve_comment_report_transaction(%L,%L,%L,2)',id,'00000000-0000-0000-0000-000000000002','resolved'),'PT409') from public.comment_reports where comment_id='20000000-0000-0000-0000-000000000002';

-- All untrusted direct paths denied; even service_role cannot forge/rewrite events.
select pg_temp.expect_error('update public.comment_moderation_events set reason=''tampered''','42501');
select pg_temp.expect_error('delete from public.comment_moderation_events','42501');
select pg_temp.expect_error('truncate public.comment_moderation_events','42501');
select pg_temp.expect_error('insert into public.comment_moderation_events default values','42501');
set local role anon;
select pg_temp.expect_error('select * from public.comment_moderation_events','42501');
select pg_temp.expect_error($q$select public.moderate_comment_transaction(null,null,'hide',1,'test')$q$,'42501');
set local role authenticated;
select pg_temp.expect_error('select * from public.comment_moderation_events','42501');
select pg_temp.expect_error($q$select public.create_comment_report_transaction(null,null,'spam')$q$,'42501');
select pg_temp.expect_error($q$select public.resolve_comment_report_transaction(null,null,'resolved',1)$q$,'42501');
select pg_temp.expect_error($q$select moderation_private.decide_comment(null,null,'hide',1,'test',gen_random_uuid())$q$,'42501');
reset role;

-- Check every RPC grant, not just the route used by a single test.
do $$
declare f regprocedure; r text;
begin
  for f in select oid::regprocedure from pg_proc where pronamespace='public'::regnamespace
    and proname in ('moderate_comment_transaction','resolve_comment_report_transaction','create_comment_report_transaction')
  loop
    foreach r in array array['anon','authenticated'] loop
      perform pg_temp.assert_true(not has_function_privilege(r,f,'EXECUTE'), 'RPC forbidden to ' || r);
    end loop;
    perform pg_temp.assert_true(has_function_privilege('service_role',f,'EXECUTE'), 'RPC available to backend');
  end loop;
end $$;
update public.comments set message_id='10000000-0000-0000-0000-000000000002' where id='20000000-0000-0000-0000-000000000004';
select pg_temp.expect_error($q$select public.create_comment_report_transaction('20000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000003','spam')$q$,'PT404');
insert into public.user_account_status(user_id,status,suspension_reason,suspended_at,suspended_by)
 values('00000000-0000-0000-0000-000000000004','suspended','test',now(),'00000000-0000-0000-0000-000000000002');
select pg_temp.expect_error($q$select public.create_comment_report_transaction('20000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-000000000004','spam')$q$,'PT403');

-- Failure injection: verify actual SQL rollback, not an application mock.
create function pg_temp.fail_write() returns trigger language plpgsql as $$
begin raise exception using errcode='ZX001',message='injected failure'; end $$;
create trigger fail_event before insert on public.comment_moderation_events for each row execute function pg_temp.fail_write();
select pg_temp.expect_error($q$select public.moderate_comment_transaction('20000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000002','hide',1,'test')$q$,'ZX001');
select pg_temp.assert_true((select status='visible' and version=1 from public.comments where id='20000000-0000-0000-0000-000000000003'),'event failure rolls comment back');
select pg_temp.expect_error($q$select public.create_comment_report_transaction('20000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000003','spam')$q$,'ZX001');
select pg_temp.assert_true(not exists(select 1 from public.comment_reports where comment_id='20000000-0000-0000-0000-000000000003'),'event failure rolls new report back');
select pg_temp.expect_error($q$select public.moderate_comment_transaction('20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','hide',3,'test')$q$,'ZX001');
select pg_temp.assert_true((select status='visible' and version=3 from public.comments where id='20000000-0000-0000-0000-000000000001'),'existing history/version preserved on failure');
drop trigger fail_event on public.comment_moderation_events;
select public.create_comment_report_transaction('20000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000003','spam');
create trigger fail_report before update on public.comment_reports for each row execute function pg_temp.fail_write();
select pg_temp.expect_error($q$select public.moderate_comment_transaction('20000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000002','hide',1,'test')$q$,'ZX001');
select pg_temp.assert_true((select status='visible' and version=1 from public.comments where id='20000000-0000-0000-0000-000000000003'),'report failure rolls comment back');
select pg_temp.assert_true(not exists(select 1 from public.comment_moderation_events where comment_id='20000000-0000-0000-0000-000000000003' and action='hide'),'report failure rolls event back');
drop trigger fail_report on public.comment_reports;
create function pg_temp.fail_resolution_event() returns trigger language plpgsql as $$
begin
  if new.action='report_auto_resolved' then raise exception using errcode='ZX002',message='injected late failure'; end if;
  return new;
end $$;
create trigger fail_late_event before insert on public.comment_moderation_events for each row execute function pg_temp.fail_resolution_event();
select pg_temp.expect_error($q$select public.moderate_comment_transaction('20000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000002','hide',1,'test')$q$,'ZX002');
select pg_temp.assert_true((select status='visible' and version=1 from public.comments where id='20000000-0000-0000-0000-000000000003'),'late event failure rolls comment back');
select pg_temp.assert_true((select status='open' and version=1 from public.comment_reports where comment_id='20000000-0000-0000-0000-000000000003'),'late event failure rolls report back');
drop trigger fail_late_event on public.comment_moderation_events;
select public.moderate_comment_transaction('20000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000001','author_delete',1);
select pg_temp.assert_true((select status='resolved' and resolution_note='author_deleted' from public.comment_reports where comment_id='20000000-0000-0000-0000-000000000003'),'author deletion resolves reports');

-- Ownership cleanup and general audit deletion must not erase events.
create temporary table event_count as select count(*) n from public.comment_moderation_events;
delete from public.audit_logs;
delete from public.comments;
-- User 4 is intentionally suspended earlier in this test.  Deleting its
-- suspending administrator would exercise the pre-existing account-status
-- invariant instead of this migration's no-FK audit-history guarantee.
delete from auth.users where id='00000000-0000-0000-0000-000000000001';
select pg_temp.assert_true(not exists(select 1 from auth.users where id='00000000-0000-0000-0000-000000000001'),'test actor deleted');
select pg_temp.assert_true((select count(*) from public.comment_moderation_events)=(select n from event_count),'history survives resource deletion');
select pg_temp.expect_error('truncate public.comment_moderation_events','42501');
rollback;
\echo PASS: SQL integrity, transition matrix, permissions and failure rollback
