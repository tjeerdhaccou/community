-- ============================================================================
-- 085_support_settings.sql
-- Per-org instellingen voor de support-digest (team-notificatie): aan/uit,
-- tijdstippen en ontvanger-e-mailadressen. Plus een log om te voorkomen dat een
-- digest-slot dubbel verstuurd wordt.
-- ============================================================================

create table support_settings (
  org_id           uuid primary key references organizations(id) on delete cascade,
  digest_enabled   boolean not null default true,
  digest_times     text[]  not null default array['11:30','16:00'],  -- lokale tijden (Europe/Amsterdam)
  recipient_emails text[]  not null default array[]::text[],           -- leeg = val terug op org-admins
  updated_at       timestamptz not null default now()
);

-- Idempotentie: één digest per org per slot per dag.
create table support_digest_log (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations(id) on delete cascade,
  digest_date date not null,
  slot        text not null,
  sent_at     timestamptz not null default now(),
  unique (org_id, digest_date, slot)
);

alter table support_settings enable row level security;
alter table support_digest_log enable row level security;

-- Org-admins beheren de instellingen van hun eigen org; platform-admins alles.
create policy "support_settings_rw" on support_settings for all
  using (is_org_admin(org_id) or is_platform_admin())
  with check (is_org_admin(org_id) or is_platform_admin());

-- De digest-log is puur voor de service-role (edge function). Geen client-toegang
-- nodig; RLS aan zonder policies = dicht voor anon/authenticated, service-role
-- (bypass) kan schrijven.
