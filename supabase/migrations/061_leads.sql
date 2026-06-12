-- Leads vanuit de marketing-funnel (buuur.nl/start).
-- Anoniem insert toegestaan (publiek formulier), lezen alleen platform admins.

create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  segment text not null check (segment in ('bewoner', 'professional')),
  name text not null,
  email text not null,
  organization text,
  role text,
  phase text,
  region text,
  message text,
  source text not null default 'landing'
);

alter table leads enable row level security;

create policy "leads_insert_public" on leads
  for insert to anon, authenticated
  with check (true);

create policy "leads_select_platform_admin" on leads
  for select to authenticated
  using (is_platform_admin());
