create table if not exists public.api_rate_limits (
  rate_key text primary key,
  window_started_at timestamptz not null,
  request_count integer not null check (request_count > 0),
  expires_at timestamptz not null
);

create index if not exists api_rate_limits_expires_at_idx
  on public.api_rate_limits (expires_at);

alter table public.api_rate_limits enable row level security;

revoke all on table public.api_rate_limits from public, anon, authenticated;
grant select, insert, update, delete on table public.api_rate_limits to service_role;

create or replace function public.consume_api_rate_limit(
  p_rate_key text,
  p_window_seconds integer,
  p_max_requests integer
)
returns table (
  allowed boolean,
  remaining integer,
  retry_after_seconds integer
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_window_seconds integer := greatest(10, least(coalesce(p_window_seconds, 60), 3600));
  v_max_requests integer := greatest(1, least(coalesce(p_max_requests, 10), 1000));
  v_entry public.api_rate_limits%rowtype;
begin
  if nullif(btrim(p_rate_key), '') is null then
    raise exception 'p_rate_key must not be empty' using errcode = '22023';
  end if;

  insert into public.api_rate_limits (
    rate_key,
    window_started_at,
    request_count,
    expires_at
  )
  values (
    p_rate_key,
    v_now,
    1,
    v_now + make_interval(secs => v_window_seconds)
  )
  on conflict (rate_key) do update
  set
    window_started_at = case
      when public.api_rate_limits.expires_at <= v_now then v_now
      else public.api_rate_limits.window_started_at
    end,
    request_count = case
      when public.api_rate_limits.expires_at <= v_now then 1
      else public.api_rate_limits.request_count + 1
    end,
    expires_at = case
      when public.api_rate_limits.expires_at <= v_now
        then v_now + make_interval(secs => v_window_seconds)
      else public.api_rate_limits.expires_at
    end
  returning * into v_entry;

  return query
  select
    v_entry.request_count <= v_max_requests,
    greatest(0, v_max_requests - v_entry.request_count),
    greatest(1, ceil(extract(epoch from (v_entry.expires_at - v_now)))::integer);
end;
$$;

revoke all on function public.consume_api_rate_limit(text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consume_api_rate_limit(text, integer, integer)
  to service_role;
