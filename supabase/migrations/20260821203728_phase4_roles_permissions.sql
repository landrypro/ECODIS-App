-- P4.2 : rôles cumulables et base d'autorisation métier.
-- La table users_roles reste le résumé de compatibilité (admin ou user) ;
-- les affectations détaillées sont la source de vérité de l'API.

create table if not exists public.user_role_assignments (
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('user', 'content_editor', 'moderator', 'admin', 'super_admin')),
  assigned_by uuid null references auth.users (id) on delete set null,
  assignment_reason text not null default '',
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

insert into public.user_role_assignments (user_id, role, assignment_reason)
select user_id, 'user', 'migration_phase4_2'
from public.users_roles
on conflict (user_id, role) do nothing;

insert into public.user_role_assignments (user_id, role, assignment_reason)
select user_id, 'admin', 'migration_phase4_2'
from public.users_roles
where role = 'admin'
on conflict (user_id, role) do nothing;

create index if not exists user_role_assignments_role_user_idx
  on public.user_role_assignments (role, user_id);

alter table public.user_role_assignments enable row level security;
revoke all privileges on table public.user_role_assignments from anon, authenticated;
grant select, insert, update, delete on table public.user_role_assignments to service_role;

create or replace function public.is_admin(target_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_role_assignments ura
    where ura.user_id = coalesce(target_user, auth.uid())
      and ura.role in ('admin', 'super_admin')
  )
  or exists (
    select 1
    from public.users_roles ur
    where ur.user_id = coalesce(target_user, auth.uid())
      and ur.role = 'admin'
  );
$$;

create or replace function public.is_super_admin(target_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_role_assignments ura
    where ura.user_id = coalesce(target_user, auth.uid())
      and ura.role = 'super_admin'
  );
$$;

revoke execute on function public.is_admin(uuid) from public, anon, authenticated;
grant execute on function public.is_admin(uuid) to service_role;
revoke execute on function public.is_super_admin(uuid) from public, anon, authenticated;
grant execute on function public.is_super_admin(uuid) to service_role;
