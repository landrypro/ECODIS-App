-- Phase 4 corrective migration: series ownership is required by the API
-- for content-level authorization and editorial workflow operations.

alter table public.series
  add column if not exists user_id uuid null references auth.users (id) on delete set null;

create index if not exists series_user_id_idx
  on public.series (user_id);
