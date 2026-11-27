-- Luma Calendar sync schema. Plain Postgres + RLS (no Supabase-only features besides auth.uid()).
-- One row per record (calendar / event / task / settings), JSON body, optimistic concurrency via rev.

create sequence if not exists public.sync_seq;

create table public.records (
  user_id    uuid        not null default auth.uid() references auth.users(id) on delete cascade,
  kind       text        not null check (kind in ('calendar','event','task','settings')),
  id         text        not null check (length(id) between 1 and 64),
  data       jsonb       not null,
  rev        integer     not null default 1,
  server_seq bigint      not null default nextval('public.sync_seq'),
  updated_at timestamptz not null default now(),
  primary key (user_id, kind, id),
  check (pg_column_size(data) < 262144)
);
create index records_pull_idx on public.records (user_id, server_seq);

-- Version history: every accepted write is kept (restore / audit). Owner can read, nobody edits.
create table public.record_versions (
  vid        bigint generated always as identity primary key,
  user_id    uuid        not null references auth.users(id) on delete cascade,
  kind       text        not null,
  id         text        not null,
  rev        integer     not null,
  data       jsonb       not null,
  saved_at   timestamptz not null default now()
);
create index record_versions_lookup_idx on public.record_versions (user_id, kind, id, rev desc);

alter table public.records enable row level security;
alter table public.record_versions enable row level security;

create policy records_select on public.records for select using (user_id = auth.uid());
create policy versions_select on public.record_versions for select using (user_id = auth.uid());
-- No direct insert/update/delete policies: writes go through push_records() only.

create or replace function public.push_records(items jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  it jsonb;
  cur public.records;
  base int;
  accepted jsonb := '[]'::jsonb;
  conflicts jsonb := '[]'::jsonb;
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not authenticated'; end if;
  if jsonb_typeof(items) <> 'array' or jsonb_array_length(items) > 200 then
    raise exception 'invalid batch';
  end if;

  for it in select * from jsonb_array_elements(items) loop
    base := coalesce((it->>'base_rev')::int, 0);
    select * into cur from public.records
      where user_id = uid and kind = it->>'kind' and id = it->>'id' for update;

    if not found then
      if base <> 0 then
        conflicts := conflicts || jsonb_build_array(jsonb_build_object('kind', it->>'kind', 'id', it->>'id', 'server', null));
        continue;
      end if;
      insert into public.records (user_id, kind, id, data) values (uid, it->>'kind', it->>'id', it->'data')
        returning * into cur;
    elsif cur.rev <> base then
      conflicts := conflicts || jsonb_build_array(jsonb_build_object(
        'kind', cur.kind, 'id', cur.id, 'server', jsonb_build_object('rev', cur.rev, 'data', cur.data)));
      continue;
    else
      update public.records set data = it->'data', rev = cur.rev + 1,
        server_seq = nextval('public.sync_seq'), updated_at = now()
      where user_id = uid and kind = cur.kind and id = cur.id returning * into cur;
    end if;

    insert into public.record_versions (user_id, kind, id, rev, data) values (uid, cur.kind, cur.id, cur.rev, cur.data);
    accepted := accepted || jsonb_build_array(jsonb_build_object('kind', cur.kind, 'id', cur.id, 'rev', cur.rev, 'server_seq', cur.server_seq));
  end loop;

  return jsonb_build_object('accepted', accepted, 'conflicts', conflicts);
end $$;

revoke all on function public.push_records(jsonb) from public, anon;
grant execute on function public.push_records(jsonb) to authenticated;
revoke all on public.records, public.record_versions from anon;
grant select on public.records, public.record_versions to authenticated;
