-- P4.5 : droits de téléchargement, versions de contenu et quota local conseillé.

alter table public.messages
  add column if not exists offline_downloadable boolean not null default true,
  add column if not exists content_version integer not null default 1,
  drop constraint if exists messages_content_version_check,
  add constraint messages_content_version_check check (content_version > 0);

alter table public.series
  add column if not exists content_version integer not null default 1,
  drop constraint if exists series_content_version_check,
  add constraint series_content_version_check check (content_version > 0);

alter table public.app_config
  add column if not exists max_offline_storage_mb integer not null default 1024,
  drop constraint if exists app_config_max_offline_storage_check,
  add constraint app_config_max_offline_storage_check check (
    max_offline_storage_mb between 50 and 2048
  );

create index if not exists messages_offline_manifest_idx
  on public.messages (id, content_version)
  where status = 'published' and offline_downloadable = true;

create or replace function public.bump_message_content_version()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if row(
    new.type, new.title, new.author, new.category, new.description,
    new.duration, new.thumbnail, new.media_path, new.status,
    new.offline_downloadable
  ) is distinct from row(
    old.type, old.title, old.author, old.category, old.description,
    old.duration, old.thumbnail, old.media_path, old.status,
    old.offline_downloadable
  ) then
    new.content_version := old.content_version + 1;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_messages_bump_content_version on public.messages;
create trigger trg_messages_bump_content_version
before update on public.messages
for each row execute function public.bump_message_content_version();

create or replace function public.bump_series_content_version()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if row(
    new.title, new.description, new.cover_image, new.author,
    new.category, new.status
  ) is distinct from row(
    old.title, old.description, old.cover_image, old.author,
    old.category, old.status
  ) then
    new.content_version := old.content_version + 1;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_series_bump_content_version on public.series;
create trigger trg_series_bump_content_version
before update on public.series
for each row execute function public.bump_series_content_version();

revoke all on function public.bump_message_content_version() from public, anon, authenticated;
revoke all on function public.bump_series_content_version() from public, anon, authenticated;
