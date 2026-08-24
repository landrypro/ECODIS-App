-- P4.3 : états de modération et signalements des commentaires.

alter table public.comments
  add column if not exists status text,
  add column if not exists moderated_at timestamptz null,
  add column if not exists moderated_by uuid null references auth.users (id) on delete set null,
  add column if not exists moderation_reason text not null default '';

update public.comments
set status = 'visible'
where status is null;

alter table public.comments
  alter column status set default 'visible',
  alter column status set not null,
  drop constraint if exists comments_status_check,
  add constraint comments_status_check check (status in ('visible', 'hidden', 'deleted_by_author', 'deleted_by_moderation'));

create table if not exists public.comment_reports (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.comments (id) on delete cascade,
  reporter_id uuid not null references auth.users (id) on delete cascade,
  reason text not null check (reason in ('spam', 'harassment', 'inappropriate_content', 'misinformation', 'other')),
  detail text not null default '' check (char_length(detail) <= 500),
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  reviewed_at timestamptz null,
  reviewed_by uuid null references auth.users (id) on delete set null,
  resolution_note text not null default '' check (char_length(resolution_note) <= 500),
  created_at timestamptz not null default now(),
  unique (comment_id, reporter_id)
);

create index if not exists comments_visible_message_created_idx
  on public.comments (message_id, created_at desc)
  where status = 'visible';

create index if not exists comment_reports_open_created_idx
  on public.comment_reports (created_at desc)
  where status = 'open';

create index if not exists comment_reports_comment_idx
  on public.comment_reports (comment_id);

alter table public.comment_reports enable row level security;
revoke all privileges on table public.comment_reports from anon, authenticated;
grant select, insert, update, delete on table public.comment_reports to service_role;
