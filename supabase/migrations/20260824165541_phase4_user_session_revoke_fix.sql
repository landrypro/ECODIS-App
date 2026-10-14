-- Le rôle appelant est contrôlé par les privilèges EXECUTE ci-dessous.
-- Ne pas dépendre de request.jwt.claim.role : les nouvelles clés secrètes Supabase
-- ne renseignent pas cette ancienne variable PostgREST de manière uniforme.
create or replace function public.revoke_user_sessions(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from auth.sessions where user_id = p_user_id;
end;
$$;

revoke all on function public.revoke_user_sessions(uuid) from public, anon, authenticated;
grant execute on function public.revoke_user_sessions(uuid) to service_role;
