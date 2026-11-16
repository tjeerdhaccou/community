-- 118: zelf lid worden en het lezen van profielen van medeleden (HOOG)
--
-- Probleem (vastgesteld in de live policies):
--   1. memberships "Users can request to join projects": iedere ingelogde
--      gebruiker mag zichzelf als gast toevoegen aan elk project
--      (profile_id = auth.uid() and role = 'guest'). Alle project-id's zijn voor
--      iedere ingelogde gebruiker leesbaar (projects "Authenticated users can
--      read projects for joining").
--   2. profiles "profiles_select_comember": wie een lidmaatschap in een project
--      heeft, leest de volledige profielrij van alle andere leden van dat
--      project: adres, geboortedatum, partner, kinderen, inkomen, admin_notes.
--   Samen: iemand met een account (of een anonieme demosessie) wordt gast van
--   een willekeurig project van een andere organisatie en leest daarna alle
--   profielen van de bewoners. Op 15 november 2026 waren er 0 gastlidmaatschappen,
--   dus er is geen aanwijzing dat dit is gebruikt.
--
-- Oplossing:
--   a. Een gast (of 'interested') ziet geen profielen van medeleden meer; dat
--      begint bij professional/aspirant en hoger, de rollen die een beheerder
--      toekent.
--   b. Een anonieme demosessie kan geen lidmaatschap aanmaken.
--
-- Risico dat dit iets breekt: laag tot middel. Er zijn nu geen gasten. Een gast
-- die via JoinProject binnenkomt ziet daarna geen namen en foto's van leden tot
-- een beheerder de rol verhoogt; het publieke team (beheerders en moderatoren
-- van een publiek project) blijft zichtbaar via profiles_select_public_team.
-- Wat hiermee NIET is opgelost: een gast leest nog wel wat de app op gastniveau
-- toont (updates, prikbord, documenten met zichtbaarheid 'public', de ledenlijst
-- zonder profielen). Of iedereen met een account zomaar gast van elk project mag
-- worden is een productkeuze; zie optie C onderaan.

drop policy if exists "profiles_select_comember" on public.profiles;
create policy "profiles_select_comember" on public.profiles
  for select using (
    exists (
      select 1
      from public.memberships m_self
      join public.memberships m_other on m_other.project_id = m_self.project_id
      where m_self.profile_id = auth.uid()
        and m_self.role not in ('guest', 'interested')
        and m_other.profile_id = profiles.id
    )
  );

drop policy if exists "Users can request to join projects" on public.memberships;
create policy "Users can request to join projects" on public.memberships
  for insert with check (
    profile_id = auth.uid()
    and role = 'guest'
    and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
  );

-- Optie C (niet actief, productkeuze): zelf aanmelden alleen bij projecten die
-- dat willen, bijvoorbeeld publieke projecten of projecten met een open intake.
--
--   drop policy "Users can request to join projects" on public.memberships;
--   create policy "Users can request to join projects" on public.memberships
--     for insert with check (
--       profile_id = auth.uid()
--       and role = 'guest'
--       and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
--       and exists (
--         select 1 from public.projects p
--         where p.id = memberships.project_id
--           and (p.is_public or p.intake_enabled)
--       )
--     );
