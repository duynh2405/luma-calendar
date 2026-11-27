-- RLS / sync checks. Run in the SQL editor (or via the MCP execute_sql). Everything is rolled back.
-- Expect: the final SELECTs return the values in the trailing comments, and no DO block raises.
begin;
insert into auth.users (id, instance_id, aud, role, email) values
 ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-000000000000','authenticated','authenticated','a@test.local'),
 ('00000000-0000-0000-0000-0000000000b2','00000000-0000-0000-0000-000000000000','authenticated','authenticated','b@test.local');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}',true);
select public.push_records('[{"kind":"event","id":"e1","base_rev":0,"data":{"title":"A1"}}]'::jsonb);   -- accepted rev 1
select public.push_records('[{"kind":"event","id":"e1","base_rev":0,"data":{"title":"stale"}}]'::jsonb); -- conflict (rev moved)
select public.push_records('[{"kind":"event","id":"e1","base_rev":1,"data":{"title":"A2"}}]'::jsonb);   -- accepted rev 2

select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}',true);
select count(*) from public.records;           -- 0: B cannot read A's rows
select count(*) from public.record_versions;   -- 0
select public.push_records('[{"kind":"event","id":"e1","base_rev":2,"data":{"title":"hack"}}]'::jsonb); -- conflict, server null

do $$ begin
  begin insert into public.records(user_id,kind,id,data) values ('00000000-0000-0000-0000-0000000000a1','event','x','{}');
    raise exception 'DIRECT INSERT ALLOWED';
  exception when insufficient_privilege then null; end;
end $$;

set local role anon;
do $$ begin
  begin perform count(*) from public.records; raise exception 'ANON READ ALLOWED';
  exception when insufficient_privilege then null; end;
end $$;
rollback;
