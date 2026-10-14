create table if not exists public.user_account_status (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'suspended')),
  suspension_reason text,
  suspended_at timestamptz,
  suspended_by uuid references auth.users(id) on delete set null,
  suspension_expires_at timestamptz,
  reactivated_at timestamptz,
  reactivated_by uuid references auth.users(id) on delete set null,
  reactivation_reason text,
  updated_at timestamptz not null default now(),
  check (
    (status = 'active' and suspension_reason is null and suspended_at is null and suspended_by is null and suspension_expires_at is null)
    or (status = 'suspended' and suspension_reason is not null and suspended_at is not null and suspended_by is not null)
  )
);

create index if not exists idx_user_account_status_suspended
  on public.user_account_status (status, suspension_expires_at)
  where status = 'suspended';

alter table public.user_account_status enable row level security;
revoke all on table public.user_account_status from anon, authenticated;
grant all on table public.user_account_status to service_role;

drop trigger if exists trg_user_account_status_set_updated_at on public.user_account_status;
create trigger trg_user_account_status_set_updated_at
before update on public.user_account_status
for each row execute function public.set_updated_at();

-- Cette fonction n'est utilisable que par l'Edge Function authentifiée avec la clé service.
-- Elle supprime les refresh tokens afin qu'un compte suspendu ne puisse plus créer de session.
create or replace function public.revoke_user_sessions(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = auth, public
as $$
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
    raise exception 'service_role required';
  end if;

  delete from auth.sessions where user_id = p_user_id;
end;
$$;

revoke all on function public.revoke_user_sessions(uuid) from public, anon, authenticated;
grant execute on function public.revoke_user_sessions(uuid) to service_role;
