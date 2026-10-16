-- Legacy rows inserted BEFORE the MC-C migration: verify additive upgrade.
insert into auth.users(id) select ('00000000-0000-0000-0000-' || lpad(n::text,12,'0'))::uuid
  from generate_series(1,4) n;
insert into public.user_role_assignments(user_id,role) values
 ('00000000-0000-0000-0000-000000000001','user'),
 ('00000000-0000-0000-0000-000000000002','moderator'),
 ('00000000-0000-0000-0000-000000000003','user'),
 ('00000000-0000-0000-0000-000000000004','user');
insert into public.messages(id,type,title,author,category,status) values
 ('10000000-0000-0000-0000-000000000001','text','Test only','Author','test','published'),
 ('10000000-0000-0000-0000-000000000002','text','Draft only','Author','test','draft');
insert into public.comments(id,message_id,user_id,user_name,user_email,text)
 select ('20000000-0000-0000-0000-' || lpad(n::text,12,'0'))::uuid,
 '10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001',
 'Test author','test@example.invalid','Preserved original text' from generate_series(1,20) n;
insert into public.comment_reports(id,comment_id,reporter_id,reason) values
 ('30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001',
 '00000000-0000-0000-0000-000000000003','spam');
