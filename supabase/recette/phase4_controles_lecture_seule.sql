-- ECODIS App — Contrôles de recette Phase 4 (staging, lecture seule)
-- À exécuter dans le SQL Editor Supabase staging après les tests fonctionnels.
-- Remplacer uniquement les valeurs entre chevrons. Ne pas placer de mot de passe,
-- de jeton, d'URL signée ou d'e-mail personnel dans cette feuille.

-- 1. Contenus et séries créés pour la recette.
select id, title, status, scheduled_at, published_at, offline_downloadable, content_version, updated_at
from public.messages
where title like '<RECETTE_PREFIX>%'
order by updated_at desc;

select id, title, status, scheduled_at, published_at, content_version, updated_at
from public.series
where title like '<RECETTE_PREFIX>%'
order by updated_at desc;

-- 2. Signalements et décisions de modération relatifs aux contenus de recette.
select
  cr.id as report_id,
  c.id as comment_id,
  c.status as comment_status,
  cr.status as report_status,
  cr.reason,
  cr.reviewed_at,
  c.moderated_at
from public.comment_reports cr
join public.comments c on c.id = cr.comment_id
join public.messages m on m.id = c.message_id
where m.title like '<RECETTE_PREFIX>%'
order by cr.created_at desc;

-- 3. Progression consolidée : aucun identifiant d'utilisateur complet n'est affiché.
select
  left(sp.user_id::text, 8) as user_ref,
  sp.series_id,
  sp.message_id,
  sp.state,
  sp.progress_percent,
  sp.position_seconds,
  sp.duration_seconds,
  sp.started_at,
  sp.completed_at,
  sp.client_updated_at,
  sp.server_updated_at,
  sp.source
from public.series_progress sp
where sp.series_id = '<SERIES_ID>'::uuid
order by sp.last_accessed_at desc;

-- 4. Idempotence : le même event_id ne doit exister qu'une seule fois.
select event_id, series_id, message_id, created_at
from public.progress_events
where series_id = '<SERIES_ID>'::uuid
order by created_at desc;

select event_id, count(*) as occurrences
from public.progress_events
where series_id = '<SERIES_ID>'::uuid
group by event_id
having count(*) > 1;

-- 5. Rôles du seul compte de recette ciblé ; fournir son UUID, jamais son e-mail.
select role, assigned_by, assignment_reason, created_at
from public.user_role_assignments
where user_id = '<TEST_USER_ID>'::uuid
order by role;

-- 6. Audits liés aux actions Phase 4, sans e-mail ni métadonnées potentiellement sensibles.
select action, description, created_at
from public.audit_logs
where created_at >= '<RECETTE_STARTED_AT>'::timestamptz
  and action in (
    'message_created', 'message_updated', 'series_created', 'series_updated',
    'role_assigned', 'role_revoked', 'comment_reported',
    'comment_moderation_hide', 'comment_moderation_restore', 'comment_moderation_delete'
  )
order by created_at desc;

-- 7. Configuration globale à vérifier après les essais hors ligne.
select downloads_enabled, max_offline_storage_mb, updated_at
from public.app_config
where id = 'global';
