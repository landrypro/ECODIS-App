-- Phase 3: observabilite frontend. Les ecritures et lectures passent exclusivement
-- par l'Edge Function avec la cle de service; aucune politique publique n'est creee.
create table if not exists public.client_error_logs (
  id uuid primary key default gen_random_uuid(),
  message text not null,
  source text not null default 'window',
  path text not null default '',
  user_agent text not null default '',
  request_id uuid null,
  created_at timestamptz not null default now()
);

create index if not exists idx_client_error_logs_created_at on public.client_error_logs (created_at desc);
create index if not exists idx_client_error_logs_request_id on public.client_error_logs (request_id);

alter table public.client_error_logs enable row level security;
