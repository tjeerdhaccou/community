-- ============================================================================
-- Voorbeeldinhoud besluitvorming voor het open demoproject (is_demo).
-- Idempotent: verwijdert eerst de eigen voorbeeldvoorstellen (vaste ids) en
-- zet ze opnieuw neer. Draaien in de SQL Editor of via de Supabase MCP.
--
-- Vereist migraties 112–116. In de demo gaan nooit notificaties uit (116) en
-- schuiven de datums elke nacht mee (demo_roll_dates).
--
--   1. Consent, loopt (Duurzaamheid): zonnepanelen, met één bezwaar + vragen
--   2. Stemming, loopt (Bouwcommissie): kleur gevelstenen
--   3. Stemming, gesloten, zwaar besluit (Bouwcommissie): keuze aannemer → aangenomen
--   4. Consent, gesloten (Gemeenschapsruimte): huisregels → vastgesteld
-- ============================================================================
do $$
declare
  v_project uuid := '00000000-0000-4000-b000-000000000001';
  v_org uuid;
  g_bouw uuid := 'a0000000-0000-4000-c000-000000000001';
  g_duurzaam uuid := 'a0000000-0000-4000-c000-000000000002';
  g_ruimte uuid := 'a0000000-0000-4000-c000-000000000003';
  p1 uuid := 'd0000000-0000-4000-d000-000000000001';
  p2 uuid := 'd0000000-0000-4000-d000-000000000002';
  p3 uuid := 'd0000000-0000-4000-d000-000000000003';
  p4 uuid := 'd0000000-0000-4000-d000-000000000004';
  r decision_rules;
  rec record;
  v_author uuid;
  v_size int;
  i int;
  q1 uuid;
begin
  if not exists (select 1 from projects where id = v_project and is_demo) then
    raise exception 'Demoproject % niet gevonden', v_project;
  end if;
  select organization_id into v_org from projects where id = v_project;

  -- Opruimen (cascade naar kiezersbestand, reacties, log, vragen, bijlagen)
  delete from proposals where id in (p1, p2, p3, p4);
  delete from households where project_id = v_project and name like 'Familie %' and id::text like 'e0000000-%';

  -- Module aan + regels
  update projects set features = coalesce(features, '{}'::jsonb) || '{"decisions": true}'::jsonb where id = v_project;
  insert into decision_rules(project_id, vote_unit, default_form, heavy_categories, allow_overrule_objection, formal_online_decisions)
  values (v_project, 'household', 'consent', array['keuze aannemer', 'toetreding nieuwe leden'], true, false)
  on conflict (project_id) do update set
    vote_unit = excluded.vote_unit, default_form = excluded.default_form,
    heavy_categories = excluded.heavy_categories, allow_overrule_objection = excluded.allow_overrule_objection,
    formal_online_decisions = excluded.formal_online_decisions;
  select * into r from decision_rules where project_id = v_project;

  -- Drie huishoudens van twee leden (op volgorde van naam)
  i := 0;
  for rec in
    select m.id as membership_id, pr.full_name
    from memberships m join profiles pr on pr.id = m.profile_id
    where m.project_id = v_project and m.role = 'member' and m.household_id is null
    order by pr.full_name limit 6
  loop
    if i % 2 = 0 then
      insert into households(id, project_id, name)
      values (('e0000000-0000-4000-e000-00000000000' || (i / 2 + 1))::uuid, v_project,
              'Familie ' || split_part(coalesce(rec.full_name, 'Lid'), ' ', -1))
      on conflict (id) do nothing;
    end if;
    update memberships set household_id = ('e0000000-0000-4000-e000-00000000000' || (i / 2 + 1))::uuid
    where id = rec.membership_id;
    i := i + 1;
  end loop;

  -- Voorstellen ---------------------------------------------------------------
  select coalesce((select profile_id from workgroup_members where workgroup_id = g_duurzaam limit 1),
                  (select profile_id from memberships where project_id = v_project and role = 'admin' limit 1)) into v_author;
  perform set_config('app.decisions_rpc', 'on', true);
  insert into proposals(id, project_id, form, workgroup_id, created_by, title, summary, member_impact, key_figures, body,
                        category, status, published_at, deadline, rules_snapshot, created_at)
  values (p1, v_project, 'consent', g_duurzaam, v_author,
    'Zonnepanelen op de gemeenschappelijke daken',
    'We plaatsen 64 zonnepanelen op de daken van de bergingen en de gemeenschapsruimte. De opbrengst gaat naar de gezamenlijke energierekening; de investering betalen we uit het onderhoudsfonds.',
    'Je betaalt niets extra. De servicekosten dalen naar verwachting met zo''n € 9 per maand per huishouden zodra de panelen draaien. Tijdens de plaatsing (twee dagen in het voorjaar) zijn de bergingen beperkt bereikbaar.',
    '[{"label":"Investering","value":"€ 38.400"},{"label":"Terugverdientijd","value":"7 jaar"},{"label":"Besparing per huishouden","value":"± € 9 / maand"}]',
    E'Drie installateurs hebben een offerte gemaakt; de commissie adviseert SolarSamen vanwege de garantie (25 jaar op opbrengst) en de lokale service.\n\nHet onderhoudsfonds staat na deze investering nog op € 61.000, ruim boven de reserve die de MJOP voorschrijft.',
    'duurzaamheid', 'published', now() - interval '3 days', now() + interval '4 days', to_jsonb(r) - 'project_id' - 'updated_at' - 'updated_by',
    now() - interval '5 days');

  select coalesce((select profile_id from workgroup_members where workgroup_id = g_bouw limit 1), v_author) into v_author;
  perform set_config('app.decisions_rpc', 'on', true);
  insert into proposals(id, project_id, form, workgroup_id, created_by, title, summary, member_impact, key_figures,
                        status, published_at, deadline, rules_snapshot, created_at)
  values (p2, v_project, 'vote', g_bouw, v_author,
    'Gevelsteen: warm rood of zandkleur',
    'De architect heeft twee gevelstenen uitgewerkt die allebei binnen het budget en het beeldkwaliteitsplan passen. Stem voor de warm rode steen (voor) of de zandkleurige steen (tegen).',
    'Geen verschil in kosten. De keuze bepaalt de uitstraling van alle woningen; monsters liggen in de bouwkeet.',
    '[{"label":"Meerprijs","value":"€ 0"},{"label":"Levertijd","value":"8 weken"}]',
    'published', now() - interval '1 day', now() + interval '6 days', to_jsonb(r) - 'project_id' - 'updated_at' - 'updated_by',
    now() - interval '2 days');

  perform set_config('app.decisions_rpc', 'on', true);
  insert into proposals(id, project_id, form, workgroup_id, created_by, title, summary, member_impact, key_figures, body,
                        category, is_heavy, status, published_at, deadline, closed_at, rules_snapshot, created_at)
  values (p3, v_project, 'vote', g_bouw, v_author,
    'Keuze aannemer ruwbouw',
    'De bouwcommissie stelt voor Bouwbedrijf De Wit te contracteren voor de ruwbouw, op basis van de laagste prijs bij gelijke kwaliteit en planning.',
    'De aanneemsom past binnen de begroting; er is geen extra inleg per huishouden nodig. De start bouw blijft gepland in het tweede kwartaal.',
    '[{"label":"Aanneemsom","value":"€ 4,2 mln"},{"label":"Start bouw","value":"Q2"}]',
    'Drie aannemers zijn gevraagd een prijs te maken. De Wit was 3% goedkoper dan de nummer twee en kan dezelfde planning halen.',
    'keuze aannemer', true, 'published', now() - interval '20 days', now() - interval '13 days', null,
    to_jsonb(r) - 'project_id' - 'updated_at' - 'updated_by', now() - interval '22 days');

  select coalesce((select profile_id from workgroup_members where workgroup_id = g_ruimte limit 1), v_author) into v_author;
  perform set_config('app.decisions_rpc', 'on', true);
  insert into proposals(id, project_id, form, workgroup_id, created_by, title, summary, member_impact,
                        status, published_at, deadline, closed_at, rules_snapshot, created_at)
  values (p4, v_project, 'consent', g_ruimte, v_author,
    'Huisregels gemeenschapsruimte',
    'Een korte set afspraken over reserveren, schoonmaken en geluid in de gemeenschapsruimte, zodat iedereen er prettig gebruik van kan maken.',
    'Reserveren gaat via het prikbord; na 23.00 uur geen versterkte muziek; wie gebruikt, maakt schoon.',
    'published', now() - interval '35 days', now() - interval '28 days', null,
    to_jsonb(r) - 'project_id' - 'updated_at' - 'updated_by', now() - interval '36 days');

  -- Kiezersbestand per voorstel (zelfde regel als publish_proposal)
  insert into proposal_electorate(proposal_id, unit_id, unit_type, unit_label, member_ids)
  select pid, unit_id, unit_type, max(unit_label), array_agg(profile_id order by profile_id)
  from unnest(array[p1, p2, p3, p4]) as pid,
  lateral (
    select m.profile_id,
           coalesce(m.household_id, m.profile_id) as unit_id,
           case when m.household_id is not null then 'household' else 'person' end as unit_type,
           coalesce(h.name, pr.full_name) as unit_label
    from memberships m
    join profiles pr on pr.id = m.profile_id
    left join households h on h.id = m.household_id
    where m.project_id = v_project and m.role in ('member', 'moderator', 'admin')
      and not coalesce(pr.is_platform_admin, false)
      and not exists (select 1 from org_members om where om.profile_id = m.profile_id and om.organization_id = v_org and om.role = 'admin')
  ) v
  group by pid, unit_id, unit_type;

  -- Reacties: vast patroon per eenheid (op volgorde van unit_id)
  -- p1: ~60% reageert; vooral akkoord, een paar "kan ermee leven", één bezwaar
  insert into proposal_responses(proposal_id, unit_id, choice, motivation, responded_by, responded_at)
  select p1, unit_id,
         case when n = 3 then 'objection' when n % 5 = 0 then 'accept' else 'agree' end,
         case when n = 3 then 'Prima plan, maar ik wil eerst zien dat het dak van de berging de extra last aankan. Kan er een constructieberekening bij?' end,
         member_ids[1], now() - interval '3 days' + (n * interval '97 minutes')
  from (select unit_id, member_ids, row_number() over (order by unit_id) n from proposal_electorate where proposal_id = p1) u
  where n % 5 <> 2 and n % 5 <> 4;

  -- p2: net begonnen, ~35%
  insert into proposal_responses(proposal_id, unit_id, choice, responded_by, responded_at)
  select p2, unit_id, case when n % 3 = 0 then 'against' when n % 7 = 0 then 'abstain' else 'for' end,
         member_ids[1], now() - interval '1 day' + (n * interval '41 minutes')
  from (select unit_id, member_ids, row_number() over (order by unit_id) n from proposal_electorate where proposal_id = p2) u
  where n % 3 = 1 or n % 7 = 0;

  -- p3: ~85% reageert, ruim 2/3 voor
  insert into proposal_responses(proposal_id, unit_id, choice, responded_by, responded_at)
  select p3, unit_id, case when n % 5 = 0 then 'against' when n % 11 = 0 then 'abstain' else 'for' end,
         member_ids[1], now() - interval '20 days' + (n * interval '3 hours')
  from (select unit_id, member_ids, row_number() over (order by unit_id) n from proposal_electorate where proposal_id = p3) u
  where n % 7 <> 0;

  -- p4: ~80%, geen bezwaren
  insert into proposal_responses(proposal_id, unit_id, choice, responded_by, responded_at)
  select p4, unit_id, case when n % 4 = 0 then 'accept' else 'agree' end,
         member_ids[1], now() - interval '35 days' + (n * interval '2 hours')
  from (select unit_id, member_ids, row_number() over (order by unit_id) n from proposal_electorate where proposal_id = p4) u
  where n % 5 <> 0;

  -- Log-tijden gelijk trekken met de reacties (trigger schreef now())
  update proposal_response_log l set created_at = rr.responded_at
  from proposal_responses rr
  where l.proposal_id = rr.proposal_id and l.unit_id = rr.unit_id and l.proposal_id in (p1, p2, p3, p4);

  -- Tellers + uitkomst van de gesloten voorstellen
  for rec in select id, form, is_heavy, (select count(*) from proposal_electorate e where e.proposal_id = p.id) as size,
                    (select count(*) from proposal_responses x where x.proposal_id = p.id) as responded,
                    p.deadline
             from proposals p where id in (p1, p2, p3, p4)
  loop
    perform set_config('app.decisions_rpc', 'on', true);
    if rec.id in (p3, p4) then
      update proposals set electorate_size = rec.size, response_count = rec.responded,
             outcome = decision_outcome(rec.form, rules_snapshot, rec.size::int, proposal_counts(rec.id), rec.is_heavy),
             status = decision_outcome(rec.form, rules_snapshot, rec.size::int, proposal_counts(rec.id), rec.is_heavy)->>'status',
             closed_at = rec.deadline
      where id = rec.id;
    else
      update proposals set electorate_size = rec.size, response_count = rec.responded where id = rec.id;
    end if;
  end loop;

  -- Vragenronde bij p1
  insert into proposal_questions(proposal_id, body, author_id, created_at)
  values (p1, 'Wie is er verantwoordelijk voor het onderhoud van de panelen, en wat kost dat per jaar?',
          (select profile_id from memberships where project_id = v_project and role = 'member' order by profile_id limit 1 offset 4),
          now() - interval '2 days')
  returning id into q1;
  insert into proposal_questions(proposal_id, parent_id, body, author_id, as_workgroup_id, created_at)
  values (p1, q1, 'Het onderhoud zit vijf jaar in de offerte. Daarna rekenen we op ongeveer € 450 per jaar, dat al in de MJOP is opgenomen.',
          (select created_by from proposals where id = p1), g_duurzaam, now() - interval '2 days' + interval '3 hours');
  insert into proposal_questions(proposal_id, body, author_id, created_at)
  values (p1, 'Komt er ook een laadpaal bij? Dat zou mooi aansluiten.',
          (select profile_id from memberships where project_id = v_project and role = 'member' order by profile_id limit 1 offset 9),
          now() - interval '20 hours');

  raise notice 'Demo besluitvorming klaar';
end $$;
