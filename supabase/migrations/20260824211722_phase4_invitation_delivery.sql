-- B02 : délai durable et données techniques minimales pour les renvois.
-- Aucun lien d'action, jeton, mot de passe ni adresse e-mail n'est stocké ici.
create table if not exists public.invitation_delivery_attempts (
  target_user_id uuid not null references auth.users(id) on delete cascade,
  delivery_type text not null check (delivery_type = 'invite'),
  last_requested_at timestamptz not null default now(),
  next_allowed_at timestamptz not null,
  last_status text not null default 'pending' check (last_status in ('pending', 'accepted', 'throttled', 'failed')),
  last_requested_by uuid null references auth.users(id) on delete set null,
  idempotency_key uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (target_user_id, delivery_type)
);

create index if not exists idx_invitation_delivery_attempts_next_allowed
  on public.invitation_delivery_attempts (next_allowed_at);

alter table public.invitation_delivery_attempts enable row level security;
revoke all on table public.invitation_delivery_attempts from anon, authenticated;
grant select, insert, update, delete on table public.invitation_delivery_attempts to service_role;

-- Réservation atomique du créneau d'envoi : évite deux envois simultanés.
-- Cette fonction est réservée à l'Edge Function utilisant service_role.
create or replace function public.claim_invitation_delivery_attempt(
  p_target_user_id uuid,
  p_actor_user_id uuid,
  p_cooldown_seconds integer,
  p_idempotency_key uuid
)
returns table (accepted boolean, retry_after_seconds integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_next_allowed_at timestamptz;
begin
  insert into public.invitation_delivery_attempts (
    target_user_id,
    delivery_type,
    last_requested_at,
    next_allowed_at,
    last_status,
    last_requested_by,
    idempotency_key,
    updated_at
  ) values (
    p_target_user_id,
    'invite',
    now(),
    now() + make_interval(secs => greatest(30, least(3600, p_cooldown_seconds))),
    'pending',
    p_actor_user_id,
    p_idempotency_key,
    now()
  )
  on conflict (target_user_id, delivery_type) do update
  set last_requested_at = excluded.last_requested_at,
      next_allowed_at = excluded.next_allowed_at,
      last_status = 'pending',
      last_requested_by = excluded.last_requested_by,
      idempotency_key = excluded.idempotency_key,
      updated_at = excluded.updated_at
  where public.invitation_delivery_attempts.next_allowed_at <= now()
  returning next_allowed_at into v_next_allowed_at;

  if found then
    return query select true, 0;
    return;
  end if;

  select next_allowed_at
    into v_next_allowed_at
    from public.invitation_delivery_attempts
   where target_user_id = p_target_user_id
     and delivery_type = 'invite';
  return query select false, greatest(1, ceil(extract(epoch from (v_next_allowed_at - now())))::integer);
end;
$$;

revoke all on function public.claim_invitation_delivery_attempt(uuid, uuid, integer, uuid) from public, anon, authenticated;
grant execute on function public.claim_invitation_delivery_attempt(uuid, uuid, integer, uuid) to service_role;

drop trigger if exists trg_invitation_delivery_attempts_set_updated_at on public.invitation_delivery_attempts;
create trigger trg_invitation_delivery_attempts_set_updated_at
before update on public.invitation_delivery_attempts
for each row execute function public.set_updated_at();
