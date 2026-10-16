-- P4.3 MC-D: the Edge Function is the sole application data boundary.
-- Browser roles stay revoked; service_role is the trusted server identity used
-- by the function after it validates the caller and applies business rules.
grant usage on schema public to service_role;

grant select, insert, update, delete on table
  public.users_roles,
  public.messages,
  public.comments,
  public.favorites,
  public.series,
  public.series_messages,
  public.series_progress,
  public.audit_logs,
  public.app_config,
  public.client_error_logs
to service_role;

-- Tables introduced after the original relational foundation. Some already
-- receive this grant in their own migration; restating it is idempotent and
-- documents the Edge Function's complete trusted data surface in one place.
grant select, insert, update, delete on table
  public.user_role_assignments,
  public.user_account_status,
  public.comment_reports,
  public.progress_events,
  public.api_rate_limits,
  public.invitation_delivery_attempts
to service_role;

-- The moderation history is deliberately append-only. The server may read it
-- for the protected API, but cannot alter or erase it through table access.
grant select on table public.comment_moderation_events to service_role;
