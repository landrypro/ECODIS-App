do $$ begin
  create type public.editorial_status as enum (
    'draft',
    'in_review',
    'scheduled',
    'published',
    'archived'
  );
exception
  when duplicate_object then null;
end $$;

alter table public.messages
  add column if not exists status public.editorial_status,
  add column if not exists published_at timestamptz,
  add column if not exists scheduled_at timestamptz,
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references auth.users (id) on delete set null;

update public.messages
set status = 'published', published_at = coalesce(published_at, created_at)
where status is null;

alter table public.messages
  alter column status set default 'draft',
  alter column status set not null;

alter table public.messages
  drop constraint if exists messages_scheduled_requires_date,
  add constraint messages_scheduled_requires_date
    check (status <> 'scheduled' or scheduled_at is not null);

alter table public.series
  add column if not exists status public.editorial_status,
  add column if not exists published_at timestamptz,
  add column if not exists scheduled_at timestamptz,
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references auth.users (id) on delete set null;

update public.series
set status = 'published', published_at = coalesce(published_at, created_at)
where status is null;

alter table public.series
  alter column status set default 'draft',
  alter column status set not null;

alter table public.series
  drop constraint if exists series_scheduled_requires_date,
  add constraint series_scheduled_requires_date
    check (status <> 'scheduled' or scheduled_at is not null);

create index if not exists messages_published_at_idx
  on public.messages (published_at desc)
  where status = 'published';

create index if not exists series_published_at_idx
  on public.series (published_at desc)
  where status = 'published';
