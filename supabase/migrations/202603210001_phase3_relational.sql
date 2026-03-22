create extension if not exists pgcrypto;

do $$ begin
  create type public.app_role as enum ('admin', 'user');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.message_type as enum ('audio', 'video', 'text');
exception
  when duplicate_object then null;
end $$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.users_roles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null default '',
  name text not null default '',
  role public.app_role not null default 'user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.is_admin(target_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.users_roles ur
    where ur.user_id = coalesce(target_user, auth.uid())
      and ur.role = 'admin'
  );
$$;

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  type public.message_type not null,
  title text not null,
  author text not null,
  category text not null,
  description text not null default '',
  duration text not null default '',
  thumbnail text not null default '',
  media_path text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid null references auth.users (id) on delete set null
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  user_name text not null,
  user_email text not null,
  text text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.favorites (
  user_id uuid not null references auth.users (id) on delete cascade,
  message_id uuid not null references public.messages (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, message_id)
);

create table if not exists public.series (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  cover_image text not null default '',
  author text not null default '',
  category text not null default '',
  total_modules integer not null default 0 check (total_modules >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.series_messages (
  series_id uuid not null references public.series (id) on delete cascade,
  message_id uuid not null references public.messages (id) on delete cascade,
  sort_order integer not null default 0,
  primary key (series_id, message_id),
  unique (series_id, sort_order)
);

create table if not exists public.series_progress (
  user_id uuid not null references auth.users (id) on delete cascade,
  series_id uuid not null references public.series (id) on delete cascade,
  message_id uuid not null references public.messages (id) on delete cascade,
  completed_at timestamptz not null default now(),
  last_accessed_at timestamptz not null default now(),
  primary key (user_id, series_id, message_id)
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null references auth.users (id) on delete set null,
  user_email text not null default '',
  action text not null,
  description text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.app_config (
  id text primary key,
  app_name text not null default 'ECODIS',
  app_subtitle text not null default 'Ecole des Disciples',
  maintenance_mode boolean not null default false,
  registration_enabled boolean not null default true,
  comments_enabled boolean not null default true,
  downloads_enabled boolean not null default true,
  max_upload_size_mb integer not null default 100,
  default_language text not null default 'fr',
  welcome_message text not null default 'Car je connais les projets que j''ai formes sur vous',
  welcome_verse text not null default 'Jeremie 29:11',
  primary_color text not null default '#152a6b',
  accent_color text not null default '#9b1b30',
  analytics_enabled boolean not null default true,
  auto_seed_enabled boolean not null default false,
  categories text[] not null default '{}',
  announcements jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid null references auth.users (id) on delete set null
);

insert into public.app_config (id)
values ('global')
on conflict (id) do nothing;

create index if not exists idx_messages_created_at on public.messages (created_at desc);
create index if not exists idx_messages_type_created_at on public.messages (type, created_at desc);
create index if not exists idx_messages_category on public.messages (category);
create index if not exists idx_comments_message_created_at on public.comments (message_id, created_at desc);
create index if not exists idx_comments_user_id on public.comments (user_id);
create index if not exists idx_favorites_message_id on public.favorites (message_id);
create index if not exists idx_series_messages_message_id on public.series_messages (message_id);
create index if not exists idx_series_messages_sort_order on public.series_messages (series_id, sort_order);
create index if not exists idx_series_progress_user_series on public.series_progress (user_id, series_id);
create index if not exists idx_audit_logs_created_at on public.audit_logs (created_at desc);
create index if not exists idx_audit_logs_action on public.audit_logs (action);

create or replace view public.message_engagement_stats as
select
  m.id as message_id,
  m.title,
  m.author,
  m.type,
  m.category,
  count(distinct f.user_id) as favorite_count,
  count(distinct c.id) as comment_count
from public.messages m
left join public.favorites f on f.message_id = m.id
left join public.comments c on c.message_id = m.id
group by m.id;

create or replace view public.series_completion_stats as
select
  s.id as series_id,
  s.title,
  s.total_modules,
  count(distinct sp.user_id) as enrolled_users,
  count(distinct case when progress_counts.completed_count >= s.total_modules and s.total_modules > 0 then progress_counts.user_id end) as completed_users
from public.series s
left join public.series_progress sp on sp.series_id = s.id
left join (
  select user_id, series_id, count(*) as completed_count
  from public.series_progress
  group by user_id, series_id
) progress_counts
  on progress_counts.series_id = s.id
 and progress_counts.user_id = sp.user_id
group by s.id;

create trigger trg_users_roles_set_updated_at
before update on public.users_roles
for each row execute function public.set_updated_at();

create trigger trg_messages_set_updated_at
before update on public.messages
for each row execute function public.set_updated_at();

create trigger trg_series_set_updated_at
before update on public.series
for each row execute function public.set_updated_at();

create trigger trg_app_config_set_updated_at
before update on public.app_config
for each row execute function public.set_updated_at();

alter table public.users_roles enable row level security;
alter table public.messages enable row level security;
alter table public.comments enable row level security;
alter table public.favorites enable row level security;
alter table public.series enable row level security;
alter table public.series_messages enable row level security;
alter table public.series_progress enable row level security;
alter table public.audit_logs enable row level security;
alter table public.app_config enable row level security;

do $$ begin
  create policy "users_roles_select_own_or_admin" on public.users_roles
    for select using (auth.uid() = user_id or public.is_admin());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "users_roles_admin_write" on public.users_roles
    for all using (public.is_admin()) with check (public.is_admin());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "messages_public_read" on public.messages
    for select using (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "messages_admin_write" on public.messages
    for all using (public.is_admin()) with check (public.is_admin());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "comments_public_read" on public.comments
    for select using (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "comments_insert_authenticated" on public.comments
    for insert with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "comments_delete_owner_or_admin" on public.comments
    for delete using (auth.uid() = user_id or public.is_admin());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "favorites_select_own" on public.favorites
    for select using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "favorites_insert_own" on public.favorites
    for insert with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "favorites_delete_own" on public.favorites
    for delete using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "series_public_read" on public.series
    for select using (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "series_admin_write" on public.series
    for all using (public.is_admin()) with check (public.is_admin());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "series_messages_public_read" on public.series_messages
    for select using (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "series_messages_admin_write" on public.series_messages
    for all using (public.is_admin()) with check (public.is_admin());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "series_progress_select_own" on public.series_progress
    for select using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "series_progress_insert_own" on public.series_progress
    for insert with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "series_progress_update_own" on public.series_progress
    for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "series_progress_delete_own_or_admin" on public.series_progress
    for delete using (auth.uid() = user_id or public.is_admin());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "audit_logs_admin_only" on public.audit_logs
    for all using (public.is_admin()) with check (public.is_admin());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "app_config_read_authenticated" on public.app_config
    for select using (auth.role() = 'authenticated' or public.is_admin());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "app_config_admin_write" on public.app_config
    for all using (public.is_admin()) with check (public.is_admin());
exception when duplicate_object then null; end $$;
