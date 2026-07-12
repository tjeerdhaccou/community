-- ============================================================================
-- 086_payments.sql
-- Betaalverzoeken via Mollie Connect (Payments for SaaS). Elke organisatie
-- koppelt via OAuth haar eigen Mollie-account aan buuur; wij initiëren payments
-- namens hen. Geld gaat rechtstreeks lid → org, buuur zit nooit in de
-- geldstroom.
--
-- Tabellen:
--   org_payment_accounts   -- OAuth-koppeling per org; tokens in Supabase Vault
--   agreement_templates    -- versionable overeenkomst-templates per project
--   payment_requests       -- verzoeken die admin naar leden/emails stuurt
--   payments               -- Mollie payment log (koppeling met payment_requests)
--
-- Ontwerp:
-- - Tokens (access + refresh) worden versleuteld opgeslagen via
--   `supabase_vault`; we bewaren alleen de vault secret-ids in de tabel. Client
--   heeft géén read-access op vault.secrets — alleen edge functions (service
--   role) kunnen decrypten.
-- - agreement_templates zijn immutable ná gebruik: nieuwe versie = nieuwe row
--   (met parent_id) zodat oude payment_requests blijven wijzen naar de exacte
--   tekst die de ontvanger tekende.
-- - payment_requests heeft `recipient_profile_id` (nullable) én
--   `recipient_email` (verplicht). Zo werkt hetzelfde verzoek voor bestaande
--   leden én voor niet-leden (magic-link via `access_token`).
-- - `platform_fee_bps` staat klaar voor Mollie applicationFee (default 0).
-- ============================================================================

create extension if not exists moddatetime schema extensions;
create extension if not exists pgcrypto;
create extension if not exists supabase_vault;

-- ----------------------------------------------------------------------------
-- org_payment_accounts
-- ----------------------------------------------------------------------------
create table org_payment_accounts (
  id                       uuid primary key default gen_random_uuid(),
  organization_id          uuid not null unique references organizations(id) on delete cascade,
  provider                 text not null default 'mollie' check (provider in ('mollie')),
  access_token_secret_id   uuid references vault.secrets(id) on delete set null,
  refresh_token_secret_id  uuid references vault.secrets(id) on delete set null,
  access_token_expires_at  timestamptz,
  mollie_organization_id   text,
  mollie_profile_id        text,
  status                   text not null default 'pending'
                            check (status in ('pending', 'active', 'error', 'disconnected')),
  last_error               text,
  connected_at             timestamptz,
  connected_by             uuid references profiles(id) on delete set null,
  disconnected_at          timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create index idx_org_payment_accounts_org on org_payment_accounts(organization_id);

alter table org_payment_accounts enable row level security;

-- Org-admins beheren de koppeling van hun eigen org; platform-admins alles.
-- Secret_ids zijn hier zichtbaar, maar client heeft geen toegang tot
-- vault.secrets zelf — alleen edge functions (service role) kunnen decrypten.
create policy "org_payment_accounts_org_admin_all" on org_payment_accounts
  for all
  using (is_org_admin(organization_id) or is_platform_admin())
  with check (is_org_admin(organization_id) or is_platform_admin());

create trigger set_updated_at
  before update on org_payment_accounts
  for each row execute function moddatetime(updated_at);

-- ----------------------------------------------------------------------------
-- agreement_templates
-- ----------------------------------------------------------------------------
create table agreement_templates (
  id               uuid primary key default gen_random_uuid(),
  project_id       uuid not null references projects(id) on delete cascade,
  title            text not null,
  content_markdown text not null,
  -- Versioning: templates worden nooit inline geëdit. Een 'nieuwe versie'
  -- creëert een nieuwe row met parent_id → oude versie. Oude payment_requests
  -- blijven wijzen naar de tekst die zij tekenden.
  version          integer not null default 1,
  parent_id        uuid references agreement_templates(id) on delete set null,
  active           boolean not null default true,
  created_at       timestamptz not null default now(),
  created_by       uuid references profiles(id) on delete set null
);

create index idx_agreement_templates_project on agreement_templates(project_id);
create index idx_agreement_templates_active on agreement_templates(project_id, active) where active;

alter table agreement_templates enable row level security;

create policy "agreement_templates_moderator_all" on agreement_templates
  for all
  using (has_membership(project_id, 'moderator') or is_platform_admin())
  with check (has_membership(project_id, 'moderator') or is_platform_admin());

-- Leden mogen actieve templates lezen (voor inzien bij een verzoek).
create policy "agreement_templates_member_read" on agreement_templates
  for select
  using (active and has_membership(project_id, 'guest'));

-- ----------------------------------------------------------------------------
-- payment_requests
-- ----------------------------------------------------------------------------
create table payment_requests (
  id                     uuid primary key default gen_random_uuid(),
  project_id             uuid not null references projects(id) on delete cascade,
  created_by             uuid not null references profiles(id),

  -- Ontvanger: recipient_profile_id nullable voor niet-leden. E-mail + naam
  -- worden altijd gevuld en als snapshot op de overeenkomst gerenderd.
  recipient_profile_id   uuid references profiles(id) on delete set null,
  recipient_email        text not null,
  recipient_name         text not null,

  purpose                text not null default 'reservation'
                          check (purpose in ('reservation', 'membership_fee', 'contribution', 'fee', 'other')),
  title                  text not null,
  description            text,
  amount_cents           integer not null check (amount_cents > 0),
  currency               text not null default 'EUR' check (currency in ('EUR')),
  reference              text,  -- vrij veld (bv. reserveringsnummer / kavelnummer)

  agreement_template_id  uuid references agreement_templates(id),

  status                 text not null default 'draft'
                          check (status in ('draft', 'sent', 'viewed', 'agreed',
                                            'paid', 'refunded', 'cancelled', 'expired')),
  sent_at                timestamptz,
  viewed_at              timestamptz,
  agreed_at              timestamptz,
  agreed_ip              text,
  agreed_user_agent      text,
  paid_at                timestamptz,
  expires_at             timestamptz,
  cancelled_at           timestamptz,
  cancelled_by           uuid references profiles(id),

  -- Application fee (basis points, 100 = 1%). Nu 0 — architectuur ready.
  platform_fee_bps       integer not null default 0
                          check (platform_fee_bps >= 0 and platform_fee_bps <= 1000),

  unsigned_pdf_path      text,   -- gerenderd bij versturen (bijlage email)
  signed_pdf_path        text,   -- gerenderd ná paid + agreed (signature-block)

  -- Magic-link toegang voor niet-leden of niet-ingelogde ontvangers.
  -- Wordt in edge function gebruikt; client leest via losse RPC met token.
  access_token           text unique,

  last_reminder_at       timestamptz,
  auto_remind_after_days integer,

  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index idx_payment_requests_project on payment_requests(project_id);
create index idx_payment_requests_recipient on payment_requests(recipient_profile_id);
create index idx_payment_requests_email on payment_requests(recipient_email);
create index idx_payment_requests_status on payment_requests(project_id, status);

alter table payment_requests enable row level security;

create policy "payment_requests_moderator_all" on payment_requests
  for all
  using (has_membership(project_id, 'moderator') or is_platform_admin())
  with check (has_membership(project_id, 'moderator') or is_platform_admin());

-- Ontvanger (bestaand lid) leest eigen verzoeken.
create policy "payment_requests_recipient_read" on payment_requests
  for select
  using (recipient_profile_id = auth.uid());

-- Ontvanger mag géén status-writes doen; akkoord + betaling lopen via edge
-- functions met service role (voorkomt dat lid direct 'paid' schrijft).

create trigger set_updated_at
  before update on payment_requests
  for each row execute function moddatetime(updated_at);

-- ----------------------------------------------------------------------------
-- payments (Mollie payment log)
-- ----------------------------------------------------------------------------
create table payments (
  id                    uuid primary key default gen_random_uuid(),
  payment_request_id    uuid not null references payment_requests(id) on delete cascade,
  provider              text not null default 'mollie',
  provider_payment_id   text unique,       -- Mollie payment id (tr_xxx)
  amount_cents          integer not null,
  currency              text not null default 'EUR',
  status                text not null default 'open'
                         check (status in ('open', 'pending', 'authorized',
                                           'paid', 'failed', 'canceled',
                                           'expired', 'refunded')),
  payment_method        text,               -- 'ideal' / 'creditcard' / ...
  checkout_url          text,
  webhook_received_at   timestamptz,
  paid_at               timestamptz,
  failed_at             timestamptz,
  refunded_at           timestamptz,
  refund_amount_cents   integer,
  raw_status_history    jsonb not null default '[]'::jsonb,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index idx_payments_request on payments(payment_request_id);
create index idx_payments_provider_id on payments(provider_payment_id);

alter table payments enable row level security;

create policy "payments_moderator_read" on payments
  for select
  using (
    exists (
      select 1 from payment_requests pr
      where pr.id = payment_request_id
        and (has_membership(pr.project_id, 'moderator') or is_platform_admin())
    )
  );

create policy "payments_recipient_read" on payments
  for select
  using (
    exists (
      select 1 from payment_requests pr
      where pr.id = payment_request_id
        and pr.recipient_profile_id = auth.uid()
    )
  );

create trigger set_updated_at
  before update on payments
  for each row execute function moddatetime(updated_at);

-- ----------------------------------------------------------------------------
-- mollie_oauth_states — kortlevende CSRF-tokens voor de OAuth-flow
-- ----------------------------------------------------------------------------
-- Wanneer een org-admin op "Koppel Mollie" klikt genereren we een state-token,
-- slaan die op met org_id + user_id, en sturen door naar Mollie. Bij callback
-- valideren we dat het state-token bestaat, niet verlopen is, en dat de org
-- klopt. Voorkomt CSRF + koppelt de callback aan de juiste org zonder dat we
-- de gebruikerssessie in de redirect kunnen mee-authenticeren.
create table mollie_oauth_states (
  state           text primary key,
  organization_id uuid not null references organizations(id) on delete cascade,
  created_by      uuid not null references profiles(id) on delete cascade,
  redirect_to     text,
  created_at      timestamptz not null default now(),
  expires_at      timestamptz not null default (now() + interval '10 minutes')
);

create index idx_mollie_oauth_states_org on mollie_oauth_states(organization_id);
create index idx_mollie_oauth_states_expires on mollie_oauth_states(expires_at);

alter table mollie_oauth_states enable row level security;
-- RLS aan zonder policies → dicht voor authenticated. Alleen service role (edge
-- fn) leest en schrijft. Rows worden aangemaakt via SECURITY DEFINER RPC.

-- RPC om vanuit de app een OAuth-state te creëren.
create or replace function create_mollie_oauth_state(
  p_org_id       uuid,
  p_redirect_to  text default null
) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_state text;
begin
  if not (is_org_admin(p_org_id) or is_platform_admin()) then
    raise exception 'forbidden';
  end if;

  -- Opruimen: verlopen states voor deze org weghalen, houdt de tabel klein
  delete from mollie_oauth_states
    where organization_id = p_org_id and expires_at < now();

  v_state := encode(gen_random_bytes(32), 'hex');
  insert into mollie_oauth_states (state, organization_id, created_by, redirect_to)
    values (v_state, p_org_id, auth.uid(), p_redirect_to);

  return v_state;
end;
$$;

grant execute on function create_mollie_oauth_state(uuid, text) to authenticated;

-- Ontkoppelen: verwijdert vault-secrets en zet account op 'disconnected'.
-- Revoke van de token bij Mollie zelf moet apart via edge function als dat
-- ooit nodig blijkt; voor nu is lokaal ontkoppelen genoeg (org kan ook via
-- hun Mollie-dashboard onze toegang intrekken).
create or replace function disconnect_mollie_account(p_org_id uuid)
returns void language plpgsql security definer set search_path = public, vault as $$
declare
  v_access_id  uuid;
  v_refresh_id uuid;
begin
  if not (is_org_admin(p_org_id) or is_platform_admin()) then
    raise exception 'forbidden';
  end if;

  select access_token_secret_id, refresh_token_secret_id
    into v_access_id, v_refresh_id
    from org_payment_accounts
    where organization_id = p_org_id;

  if not found then return; end if;

  if v_access_id is not null then
    delete from vault.secrets where id = v_access_id;
  end if;
  if v_refresh_id is not null then
    delete from vault.secrets where id = v_refresh_id;
  end if;

  update org_payment_accounts set
    access_token_secret_id  = null,
    refresh_token_secret_id = null,
    access_token_expires_at = null,
    status                  = 'disconnected',
    disconnected_at         = now()
  where organization_id = p_org_id;
end;
$$;

grant execute on function disconnect_mollie_account(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- Vault-wrappers (service_role only)
-- ----------------------------------------------------------------------------
-- Supabase Vault leeft in het `vault` schema; PostgREST kan daar niet direct
-- bij vanuit een supabase-js .rpc()-call. Deze SECURITY DEFINER wrappers geven
-- alleen de service_role (edge functions) toegang. Authenticated users hebben
-- géén EXECUTE-recht, dus de daadwerkelijke geheimen zijn niet te lezen vanuit
-- de client.

create or replace function vault_create_secret(p_secret text, p_name text)
returns uuid language plpgsql security definer set search_path = public, vault as $$
declare v_id uuid;
begin
  v_id := vault.create_secret(p_secret, p_name);
  return v_id;
end;
$$;

create or replace function vault_read_secret(p_secret_id uuid)
returns text language plpgsql security definer set search_path = public, vault as $$
declare v_secret text;
begin
  select decrypted_secret into v_secret
    from vault.decrypted_secrets
    where id = p_secret_id;
  return v_secret;
end;
$$;

create or replace function vault_update_secret(p_secret_id uuid, p_secret text)
returns void language plpgsql security definer set search_path = public, vault as $$
begin
  perform vault.update_secret(p_secret_id, p_secret);
end;
$$;

create or replace function vault_delete_secret(p_secret_id uuid)
returns void language plpgsql security definer set search_path = public, vault as $$
begin
  delete from vault.secrets where id = p_secret_id;
end;
$$;

revoke execute on function vault_create_secret(text, text) from public, anon, authenticated;
revoke execute on function vault_read_secret(uuid)         from public, anon, authenticated;
revoke execute on function vault_update_secret(uuid, text) from public, anon, authenticated;
revoke execute on function vault_delete_secret(uuid)       from public, anon, authenticated;

grant execute on function vault_create_secret(text, text) to service_role;
grant execute on function vault_read_secret(uuid)         to service_role;
grant execute on function vault_update_secret(uuid, text) to service_role;
grant execute on function vault_delete_secret(uuid)       to service_role;

-- ----------------------------------------------------------------------------
-- Helper: check of een project betalingen kan ontvangen (via org-koppeling)
-- ----------------------------------------------------------------------------
create or replace function project_has_active_payment_account(p_project_id uuid)
returns boolean language sql stable security definer as $$
  select exists (
    select 1
    from projects p
    join org_payment_accounts opa on opa.organization_id = p.organization_id
    where p.id = p_project_id
      and opa.status = 'active'
      and opa.access_token_secret_id is not null
  );
$$;
