-- Phase 3: durcissement identifie par les Security Advisors Supabase.
-- Le frontend passe exclusivement par l'Edge Function; les roles navigateur
-- n'ont donc pas besoin d'acceder directement aux tables ou vues publiques.

alter function public.set_updated_at() set search_path = public;

alter view public.message_engagement_stats set (security_invoker = true);
alter view public.series_completion_stats set (security_invoker = true);

revoke all privileges on table
  public.users_roles,
  public.messages,
  public.comments,
  public.favorites,
  public.series,
  public.series_messages,
  public.series_progress,
  public.audit_logs,
  public.app_config,
  public.client_error_logs,
  public.message_engagement_stats,
  public.series_completion_stats
from anon, authenticated;

do $$
begin
  if to_regclass('public.kv_store_1c1fff69') is not null then
    execute 'revoke all privileges on table public.kv_store_1c1fff69 from anon, authenticated';
  end if;
end
$$;
