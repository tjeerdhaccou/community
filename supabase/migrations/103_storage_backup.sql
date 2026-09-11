-- ============================================================================
-- 103_storage_backup.sql
-- Back-up van geüploade bestanden binnen Supabase.
--
-- Aanleiding: Supabase maakt back-ups van de database, níét van Storage-blobs.
-- Op 2026-06-19 verloren 18 objecten hun blob terwijl de metadata bleef staan.
--
-- Opzet (edge function `storage-backup`, apart gedeployed):
--   * bucket `backup-files` (privé, alleen service-role): kopie van elk object
--     uit de privé-buckets onder pad `<bron-bucket>/<naam>`;
--   * tabel storage_backup_log: per object etag/size, wanneer gekopieerd, wanneer
--     laatst gecontroleerd, status;
--   * cron `storage-backup-sync` elk kwartier: nieuwe/gewijzigde objecten kopiëren;
--   * cron `storage-backup-verify` elke nacht: bestaat de blob nog achter elke
--     metadata-rij? Nee → terugzetten uit back-up + mail; back-ups van verwijderde
--     bronbestanden 30 dagen bewaren en dan opruimen.
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit)
values ('backup-files', 'backup-files', false, 52428800)
on conflict (id) do nothing;
-- Geen policies op backup-files: RLS staat aan zonder policies = alleen service-role.

create table if not exists storage_backup_log (
  source_bucket    text not null,
  name             text not null,
  etag             text,
  size             bigint,
  backed_up_at     timestamptz,
  last_verified_at timestamptz,
  status           text not null default 'pending'
                   check (status in ('pending', 'ok', 'missing', 'restored', 'unrecoverable', 'source_deleted')),
  source_missing_since timestamptz,        -- bron verwijderd: back-up wordt na 30 dagen opgeruimd
  note             text,
  updated_at       timestamptz not null default now(),
  primary key (source_bucket, name)
);

create index if not exists storage_backup_log_status_idx on storage_backup_log (status, updated_at desc);

alter table storage_backup_log enable row level security;
-- Platform-admins mogen de log lezen (voor een overzicht in de CMS); schrijven doet alleen de edge function.
drop policy if exists "storage_backup_log_read_platform" on storage_backup_log;
create policy "storage_backup_log_read_platform" on storage_backup_log for select
  using (is_platform_admin());

-- Run-overzicht: één rij per run, zodat we in de CMS kunnen tonen "laatste back-up: …".
create table if not exists storage_backup_runs (
  id           uuid primary key default gen_random_uuid(),
  mode         text not null check (mode in ('sync', 'verify')),
  started_at   timestamptz not null default now(),
  finished_at  timestamptz,
  checked      int not null default 0,
  copied       int not null default 0,
  missing      int not null default 0,
  restored     int not null default 0,
  unrecoverable int not null default 0,
  pruned       int not null default 0,
  error        text
);
alter table storage_backup_runs enable row level security;
drop policy if exists "storage_backup_runs_read_platform" on storage_backup_runs;
create policy "storage_backup_runs_read_platform" on storage_backup_runs for select
  using (is_platform_admin());

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'storage-backup-sync',
  '*/15 * * * *',
  $$ select net.http_post(
       url := 'https://czgsqmbejsmcjusigwhp.supabase.co/functions/v1/storage-backup',
       headers := '{"Content-Type":"application/json"}'::jsonb,
       body := '{"mode":"sync"}'::jsonb
     ) $$
);

select cron.schedule(
  'storage-backup-verify',
  '30 3 * * *',
  $$ select net.http_post(
       url := 'https://czgsqmbejsmcjusigwhp.supabase.co/functions/v1/storage-backup',
       headers := '{"Content-Type":"application/json"}'::jsonb,
       body := '{"mode":"verify"}'::jsonb
     ) $$
);
