-- ============================================================================
-- DEMO SEED: CommonCity Demoproject — 40 leden, posts, events, updates
-- Run in Supabase SQL Editor (runs as postgres, bypasses RLS + triggers)
-- ============================================================================

-- Note: trigger on_auth_user_created will fire and create profiles automatically.
-- Our profile inserts below use ON CONFLICT DO UPDATE to fill in the details.

-- ─── Clean existing demo data ───────────────────────────────────────────────
DELETE FROM post_reactions WHERE post_id IN (SELECT id FROM posts WHERE project_id = '00000000-0000-4000-b000-000000000001');
DELETE FROM post_likes WHERE post_id IN (SELECT id FROM posts WHERE project_id = '00000000-0000-4000-b000-000000000001');
DELETE FROM post_follows WHERE post_id IN (SELECT id FROM posts WHERE project_id = '00000000-0000-4000-b000-000000000001');
DELETE FROM comments WHERE post_id IN (SELECT id FROM posts WHERE project_id = '00000000-0000-4000-b000-000000000001');
DELETE FROM poll_votes WHERE option_id IN (SELECT po.id FROM poll_options po JOIN posts p ON po.post_id = p.id WHERE p.project_id = '00000000-0000-4000-b000-000000000001');
DELETE FROM poll_options WHERE post_id IN (SELECT id FROM posts WHERE project_id = '00000000-0000-4000-b000-000000000001');
DELETE FROM posts WHERE project_id = '00000000-0000-4000-b000-000000000001';

DELETE FROM event_rsvps WHERE meeting_id IN (SELECT id FROM meetings WHERE project_id = '00000000-0000-4000-b000-000000000001');
DELETE FROM decisions WHERE meeting_id IN (SELECT id FROM meetings WHERE project_id = '00000000-0000-4000-b000-000000000001');
DELETE FROM meetings WHERE project_id = '00000000-0000-4000-b000-000000000001';

DELETE FROM update_reactions WHERE update_id IN (SELECT id FROM updates WHERE project_id = '00000000-0000-4000-b000-000000000001');
DELETE FROM update_comments WHERE update_id IN (SELECT id FROM updates WHERE project_id = '00000000-0000-4000-b000-000000000001');
DELETE FROM update_attachments WHERE update_id IN (SELECT id FROM updates WHERE project_id = '00000000-0000-4000-b000-000000000001');
DELETE FROM updates WHERE project_id = '00000000-0000-4000-b000-000000000001';

DELETE FROM workgroup_members WHERE workgroup_id IN (SELECT id FROM workgroups WHERE project_id = '00000000-0000-4000-b000-000000000001');
DELETE FROM workgroups WHERE project_id = '00000000-0000-4000-b000-000000000001';

DELETE FROM documents WHERE project_id = '00000000-0000-4000-b000-000000000001';

-- Delete demo user memberships + profiles + auth entries (email pattern demo-*@demo.buuur.nl)
DELETE FROM memberships WHERE profile_id IN (SELECT id FROM profiles WHERE email LIKE '%@demo.buuur.nl');
DELETE FROM profiles WHERE email LIKE '%@demo.buuur.nl';
DELETE FROM auth.users WHERE email LIKE '%@demo.buuur.nl';

-- ─── Create 40 auth users ──────────────────────────────────────────────────
DO $$
DECLARE
  ids TEXT[] := ARRAY[
    'd0000000-0000-4000-a000-000000000001','d0000000-0000-4000-a000-000000000002','d0000000-0000-4000-a000-000000000003','d0000000-0000-4000-a000-000000000004','d0000000-0000-4000-a000-000000000005',
    'd0000000-0000-4000-a000-000000000006','d0000000-0000-4000-a000-000000000007','d0000000-0000-4000-a000-000000000008','d0000000-0000-4000-a000-000000000009','d0000000-0000-4000-a000-000000000010',
    'd0000000-0000-4000-a000-000000000011','d0000000-0000-4000-a000-000000000012','d0000000-0000-4000-a000-000000000013','d0000000-0000-4000-a000-000000000014','d0000000-0000-4000-a000-000000000015',
    'd0000000-0000-4000-a000-000000000016','d0000000-0000-4000-a000-000000000017','d0000000-0000-4000-a000-000000000018','d0000000-0000-4000-a000-000000000019','d0000000-0000-4000-a000-000000000020',
    'd0000000-0000-4000-a000-000000000021','d0000000-0000-4000-a000-000000000022','d0000000-0000-4000-a000-000000000023','d0000000-0000-4000-a000-000000000024','d0000000-0000-4000-a000-000000000025',
    'd0000000-0000-4000-a000-000000000026','d0000000-0000-4000-a000-000000000027','d0000000-0000-4000-a000-000000000028','d0000000-0000-4000-a000-000000000029','d0000000-0000-4000-a000-000000000030',
    'd0000000-0000-4000-a000-000000000031','d0000000-0000-4000-a000-000000000032','d0000000-0000-4000-a000-000000000033','d0000000-0000-4000-a000-000000000034','d0000000-0000-4000-a000-000000000035',
    'd0000000-0000-4000-a000-000000000036','d0000000-0000-4000-a000-000000000037','d0000000-0000-4000-a000-000000000038','d0000000-0000-4000-a000-000000000039','d0000000-0000-4000-a000-000000000040'
  ];
  names TEXT[] := ARRAY[
    'Sophie van der Berg','Daan de Vries','Emma Jansen','Liam Bakker','Julia Visser',
    'Sem Smit','Tessa Meijer','Noah de Graaf','Fleur Mulder','Lucas Bos',
    'Lotte de Jong','Finn Hendriks','Noor Dekker','Jesse Dijkstra','Iris van Dijk',
    'Mees Vermeer','Eva Kok','Ruben Peters','Saar van Leeuwen','Thomas Willems',
    'Mila Hoekstra','Thijs Brouwer','Lisa de Wit','Bram van den Broek','Anna Schouten',
    'Max Koning','Rosa van der Linden','Stijn Boer','Fenna de Haan','Milan Vos',
    'Vera Molenaar','Jasper van Beek','Bo Kuiper','Lars de Boer','Isa Scholten',
    'Luuk van Dam','Nina Verhoeven','Joep Janssen','Yara Hermans','Cas Peeters'
  ];
  emails TEXT[] := ARRAY[
    'sophie.vd.berg@demo.buuur.nl','daan.de.vries@demo.buuur.nl','emma.jansen@demo.buuur.nl','liam.bakker@demo.buuur.nl','julia.visser@demo.buuur.nl',
    'sem.smit@demo.buuur.nl','tessa.meijer@demo.buuur.nl','noah.de.graaf@demo.buuur.nl','fleur.mulder@demo.buuur.nl','lucas.bos@demo.buuur.nl',
    'lotte.de.jong@demo.buuur.nl','finn.hendriks@demo.buuur.nl','noor.dekker@demo.buuur.nl','jesse.dijkstra@demo.buuur.nl','iris.van.dijk@demo.buuur.nl',
    'mees.vermeer@demo.buuur.nl','eva.kok@demo.buuur.nl','ruben.peters@demo.buuur.nl','saar.van.leeuwen@demo.buuur.nl','thomas.willems@demo.buuur.nl',
    'mila.hoekstra@demo.buuur.nl','thijs.brouwer@demo.buuur.nl','lisa.de.wit@demo.buuur.nl','bram.vd.broek@demo.buuur.nl','anna.schouten@demo.buuur.nl',
    'max.koning@demo.buuur.nl','rosa.vd.linden@demo.buuur.nl','stijn.boer@demo.buuur.nl','fenna.de.haan@demo.buuur.nl','milan.vos@demo.buuur.nl',
    'vera.molenaar@demo.buuur.nl','jasper.van.beek@demo.buuur.nl','bo.kuiper@demo.buuur.nl','lars.de.boer@demo.buuur.nl','isa.scholten@demo.buuur.nl',
    'luuk.van.dam@demo.buuur.nl','nina.verhoeven@demo.buuur.nl','joep.janssen@demo.buuur.nl','yara.hermans@demo.buuur.nl','cas.peeters@demo.buuur.nl'
  ];
  avatars TEXT[] := ARRAY[
    'women/1','men/2','women/3','men/4','women/5','men/6','women/7','men/8','women/9','men/10',
    'women/11','men/12','women/13','men/14','women/15','men/16','women/17','men/18','women/19','men/20',
    'women/21','men/22','women/23','men/24','women/25','men/26','women/27','men/28','women/29','men/30',
    'women/31','men/32','women/33','men/34','women/35','men/36','women/37','men/38','women/39','men/40'
  ];
  cities TEXT[] := ARRAY['Amsterdam','Utrecht','Haarlem','Leiden','Den Haag','Amstelveen','Zaandam','Almere','Hilversum','Amersfoort'];
  occupations TEXT[] := ARRAY['Ontwerper','Onderwijzer','Projectmanager','Marketing specialist','Developer','Verpleegkundige','Architect','Journalist','Consultant','Onderzoeker'];
  motivations TEXT[] := ARRAY[
    'Ik geloof in samen wonen en samen leven. De gemeenschapszin trekt mij enorm aan.',
    'Op zoek naar een fijne, betrokken woongemeenschap waar je echt je buren kent.',
    'Het concept van collectief wonen spreekt me aan.',
    'Ik wil graag bijdragen aan een duurzaam en sociaal woonproject.',
    'Als alleenstaande ouder zoek ik een plek waar mijn kinderen veilig kunnen opgroeien.',
    'Het idee van gedeelde ruimtes en samen koken vind ik geweldig.',
    'Ik ben al jaren op zoek naar een betaalbare woning in Amsterdam.',
    'De mix van koop en huur en de diversiteit van de bewoners trekt mij aan.'
  ];
  roles TEXT[] := ARRAY['admin','admin','moderator','moderator','moderator','member','member','member','member','member','member','member','member','member','member','member','member','member','member','member','member','member','member','member','member','member','member','member','member','member','aspirant','aspirant','aspirant','aspirant','aspirant','guest','guest','guest','professional','professional'];
  funnels TEXT[] := ARRAY['koper','koper','koper','koper','koper','orienterend','aspirant_koper','koper','koper','bewoner','orienterend','aspirant_koper','koper','koper','bewoner','orienterend','aspirant_koper','koper','koper','bewoner','orienterend','aspirant_koper','koper','koper','bewoner','orienterend','aspirant_koper','koper','koper','bewoner','orienterend','orienterend','orienterend','orienterend','orienterend','nieuw','nieuw','nieuw','nieuw','nieuw'];
  i INT;
  uid UUID;
  avatar TEXT;
BEGIN
  FOR i IN 1..40 LOOP
    uid := ids[i]::UUID;
    avatar := 'https://randomuser.me/api/portraits/' || avatars[i] || '.jpg';

    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token
    ) VALUES (
      uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      emails[i], crypt('DemoUser2026!', gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name', names[i]),
      now() - ((40 - i) * interval '4 days'), now(), '', '', '', ''
    ) ON CONFLICT (id) DO NOTHING;

    INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    VALUES (uid, uid, emails[i], jsonb_build_object('sub', uid::text, 'email', emails[i]), 'email', now(), now(), now())
    ON CONFLICT DO NOTHING;

    INSERT INTO profiles (id, full_name, email, avatar_url, city, occupation, motivation, phone)
    VALUES (uid, names[i], emails[i], avatar, cities[1 + (i-1) % 10], occupations[1 + (i-1) % 10], motivations[1 + (i-1) % 8], '06-' || lpad((12340000 + i * 1111)::text, 8, '0'))
    ON CONFLICT (id) DO UPDATE SET full_name=EXCLUDED.full_name, email=EXCLUDED.email, avatar_url=EXCLUDED.avatar_url, city=EXCLUDED.city, occupation=EXCLUDED.occupation, motivation=EXCLUDED.motivation, phone=EXCLUDED.phone;

    INSERT INTO memberships (profile_id, project_id, role, funnel_stage, joined_at)
    VALUES (uid, '00000000-0000-4000-b000-000000000001', roles[i], funnels[i], now() - ((40 - i) * interval '4 days'))
    ON CONFLICT (profile_id, project_id) DO UPDATE SET role=EXCLUDED.role, funnel_stage=EXCLUDED.funnel_stage;
  END LOOP;
END $$;

-- Trigger was left enabled — profiles were auto-created and then updated above.

-- ─── Workgroups ─────────────────────────────────────────────────────────────
INSERT INTO workgroups (id, project_id, name, description, type, icon, sort_order) VALUES
  ('a0000000-0000-4000-c000-000000000001', '00000000-0000-4000-b000-000000000001', 'Bouwcommissie',       'Volgt het bouwproces en adviseert over technische keuzes',                    'commissie', 'building',  1),
  ('a0000000-0000-4000-c000-000000000002', '00000000-0000-4000-b000-000000000001', 'Duurzaamheid',        'Adviseert over energielabel, isolatie, zonnepanelen en circulair bouwen',     'commissie', 'leaf',      2),
  ('a0000000-0000-4000-c000-000000000003', '00000000-0000-4000-b000-000000000001', 'Gemeenschapsruimte',  'Inrichting en programmering van de gedeelde ruimtes',                         'commissie', 'users',     3),
  ('a0000000-0000-4000-c000-000000000004', '00000000-0000-4000-b000-000000000001', 'Communicatie',        'Nieuwsbrief, social media en ledenwerving',                                  'commissie', 'megaphone', 4),
  ('a0000000-0000-4000-c000-000000000005', '00000000-0000-4000-b000-000000000001', 'Kopers',              'Alle koopgeïnteresseerden',                                                  'doelgroep', 'home',      5)
ON CONFLICT (id) DO NOTHING;

-- Workgroup members
INSERT INTO workgroup_members (profile_id, workgroup_id)
SELECT uid, 'a0000000-0000-4000-c000-000000000001'::uuid FROM (VALUES
  ('d0000000-0000-4000-a000-000000000001'::uuid),('d0000000-0000-4000-a000-000000000002'::uuid),
  ('d0000000-0000-4000-a000-000000000003'::uuid),('d0000000-0000-4000-a000-000000000004'::uuid),
  ('d0000000-0000-4000-a000-000000000005'::uuid),('d0000000-0000-4000-a000-000000000006'::uuid),
  ('d0000000-0000-4000-a000-000000000007'::uuid),('d0000000-0000-4000-a000-000000000008'::uuid)
) AS t(uid) ON CONFLICT DO NOTHING;

INSERT INTO workgroup_members (profile_id, workgroup_id)
SELECT uid, 'a0000000-0000-4000-c000-000000000002'::uuid FROM (VALUES
  ('d0000000-0000-4000-a000-000000000005'::uuid),('d0000000-0000-4000-a000-000000000006'::uuid),
  ('d0000000-0000-4000-a000-000000000007'::uuid),('d0000000-0000-4000-a000-000000000008'::uuid),
  ('d0000000-0000-4000-a000-000000000009'::uuid),('d0000000-0000-4000-a000-000000000010'::uuid)
) AS t(uid) ON CONFLICT DO NOTHING;

INSERT INTO workgroup_members (profile_id, workgroup_id)
SELECT uid, 'a0000000-0000-4000-c000-000000000003'::uuid FROM (VALUES
  ('d0000000-0000-4000-a000-000000000010'::uuid),('d0000000-0000-4000-a000-000000000011'::uuid),
  ('d0000000-0000-4000-a000-000000000012'::uuid),('d0000000-0000-4000-a000-000000000013'::uuid),
  ('d0000000-0000-4000-a000-000000000014'::uuid),('d0000000-0000-4000-a000-000000000015'::uuid),
  ('d0000000-0000-4000-a000-000000000016'::uuid)
) AS t(uid) ON CONFLICT DO NOTHING;

INSERT INTO workgroup_members (profile_id, workgroup_id)
SELECT uid, 'a0000000-0000-4000-c000-000000000004'::uuid FROM (VALUES
  ('d0000000-0000-4000-a000-000000000002'::uuid),('d0000000-0000-4000-a000-000000000003'::uuid),
  ('d0000000-0000-4000-a000-000000000004'::uuid),('d0000000-0000-4000-a000-000000000005'::uuid),
  ('d0000000-0000-4000-a000-000000000006'::uuid)
) AS t(uid) ON CONFLICT DO NOTHING;

INSERT INTO workgroup_members (profile_id, workgroup_id)
SELECT uid, 'a0000000-0000-4000-c000-000000000005'::uuid FROM (VALUES
  ('d0000000-0000-4000-a000-000000000001'::uuid),('d0000000-0000-4000-a000-000000000002'::uuid),
  ('d0000000-0000-4000-a000-000000000003'::uuid),('d0000000-0000-4000-a000-000000000004'::uuid),
  ('d0000000-0000-4000-a000-000000000005'::uuid),('d0000000-0000-4000-a000-000000000006'::uuid),
  ('d0000000-0000-4000-a000-000000000007'::uuid),('d0000000-0000-4000-a000-000000000008'::uuid),
  ('d0000000-0000-4000-a000-000000000009'::uuid),('d0000000-0000-4000-a000-000000000010'::uuid),
  ('d0000000-0000-4000-a000-000000000011'::uuid),('d0000000-0000-4000-a000-000000000012'::uuid),
  ('d0000000-0000-4000-a000-000000000013'::uuid),('d0000000-0000-4000-a000-000000000014'::uuid),
  ('d0000000-0000-4000-a000-000000000015'::uuid)
) AS t(uid) ON CONFLICT DO NOTHING;


-- ─── Updates (nieuws) ───────────────────────────────────────────────────────
INSERT INTO updates (id, project_id, author_id, title, body, tag, image_url, is_public, created_at) VALUES
('e0000000-0000-4000-e000-000000000001', '00000000-0000-4000-b000-000000000001', 'd0000000-0000-4000-a000-000000000001',
 'Ontwerp gepresenteerd aan de gemeente!',
 'Gisteravond hebben we het voorlopig ontwerp (VO) gepresenteerd aan de welstandscommissie van gemeente Amsterdam. De reacties waren overwegend positief! Vooral het groene binnenhof en de gedeelde daktuin vielen in de smaak.

De commissie had nog enkele suggesties over de gevelindeling aan de waterkant. Space&Matter gaat deze verwerken in de volgende iteratie. We verwachten het definitief ontwerp (DO) over 6 weken te kunnen presenteren aan alle leden.',
 'Mijlpaal', 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=800&h=500&fit=crop', true, now() - interval '3 days'),

('e0000000-0000-4000-e000-000000000002', '00000000-0000-4000-b000-000000000001', 'd0000000-0000-4000-a000-000000000003',
 'Terugblik ALV juni — alle besluiten op een rij',
 'Afgelopen zaterdag hielden we onze halfjaarlijkse Algemene Ledenvergadering. Met 34 van de 40 leden aanwezig was het quorum ruim gehaald.

**Besluiten:**
- Het huishoudelijk reglement is unaniem aangenomen
- Budget voor gemeenschapsruimte inrichting: €45.000
- Werkgroep Duurzaamheid krijgt mandaat voor keuze warmtepomp
- Volgende ALV: december 2026

De notulen zijn te vinden in het documentenarchief. Bedankt voor jullie betrokkenheid!',
 'Verslag', 'https://images.unsplash.com/photo-1515187029135-18ee286d815b?w=800&h=500&fit=crop', false, now() - interval '8 days'),

('e0000000-0000-4000-e000-000000000003', '00000000-0000-4000-b000-000000000001', 'd0000000-0000-4000-a000-000000000002',
 'Zonnepanelen: collectieve inkoop bespaart 30%',
 'Goed nieuws uit de werkgroep Duurzaamheid! Door collectief zonnepanelen in te kopen voor het hele complex besparen we circa 30% ten opzichte van individuele installatie.

We hebben offertes van drie leveranciers vergeleken en een voorkeur uitgesproken voor SolarNL, die ook ervaring heeft met CPO-projecten. In de volgende ledenvergadering leggen we het definitieve voorstel voor.',
 'Besluit', 'https://images.unsplash.com/photo-1509391366360-2e959784a276?w=800&h=500&fit=crop', false, now() - interval '15 days'),

('e0000000-0000-4000-e000-000000000004', '00000000-0000-4000-b000-000000000001', 'd0000000-0000-4000-a000-000000000001',
 'Nieuwsbrief #12 is verstuurd',
 'De nieuwsbrief van juni is verstuurd naar alle geïnteresseerden en leden. Onderwerpen dit keer:

- Stand van zaken ontwerp
- Interview met architect Marloes van Space&Matter
- Aanmeldingen nieuwe leden
- Save the date: zomerborrel 19 juli

Niet ontvangen? Check je spamfolder of mail ons op info@demoproject.nl.',
 'Update', null, true, now() - interval '20 days'),

('e0000000-0000-4000-e000-000000000005', '00000000-0000-4000-b000-000000000001', 'd0000000-0000-4000-a000-000000000005',
 'Gemeenschapsruimte: eerste schetsen!',
 'De werkgroep Gemeenschapsruimte heeft de eerste schetsen opgeleverd voor de indeling van onze 120m² gedeelde ruimte op de begane grond. Het voorstel bevat:

- Een grote open keuken met kookeiland
- Flexibele zithoek/vergaderruimte
- Wasruimte met 4 machines
- Gereedschapsbibliotheek
- Kleine logeerkamer voor gasten

Kom naar de inloopavond op 25 juni om de plannen te bekijken en feedback te geven!',
 'Update', 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&h=500&fit=crop', false, now() - interval '25 days'),

('e0000000-0000-4000-e000-000000000006', '00000000-0000-4000-b000-000000000001', 'd0000000-0000-4000-a000-000000000004',
 'Bouwvergunning ingediend!',
 'Een grote mijlpaal: vandaag is de omgevingsvergunning officieel ingediend bij de gemeente Amsterdam!

Het behandeltraject duurt naar verwachting 8-12 weken. In de tussentijd gaan we door met het uitwerken van het bestek en de materiaalkeuzelijst.

We houden jullie op de hoogte van de voortgang.',
 'Mijlpaal', 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&h=500&fit=crop', true, now() - interval '35 days'),

('e0000000-0000-4000-e000-000000000007', '00000000-0000-4000-b000-000000000001', 'd0000000-0000-4000-a000-000000000007',
 'Welkom nieuwe leden — voorjaar 2026',
 'We verwelkomen 6 nieuwe leden die de afgelopen twee maanden zijn toegetreden tot de vereniging:

- Rosa & partner (bovenwoning, koop)
- Milan (studio, koop)
- Vera & Jasper (maisonnette, koop)
- Bo (appartement, huur)

Welkom! We kijken uit naar jullie bijdrage aan de gemeenschap.',
 'Update', 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=800&h=500&fit=crop', false, now() - interval '45 days'),

('e0000000-0000-4000-e000-000000000008', '00000000-0000-4000-b000-000000000001', 'd0000000-0000-4000-a000-000000000002',
 'Daktuin concept: stemming resultaten',
 'De stemming over het daktuinconcept is afgerond. Met 28 stemmen is gekozen voor concept B: "Eetbare Oase" — een combinatie van moestuinbakken, fruitbomen en een gezellig terras.

De landschapsarchitect gaat dit nu uitwerken in het definitief ontwerp. De geschatte kosten voor de aanleg bedragen €35.000, wat binnen het eerder vastgestelde budget past.',
 'Besluit', 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=800&h=500&fit=crop', false, now() - interval '55 days');

-- Update comments
INSERT INTO update_comments (update_id, author_id, text, created_at) VALUES
('e0000000-0000-4000-e000-000000000001', 'd0000000-0000-4000-a000-000000000006', 'Super goed nieuws! Spannend dat het VO er nu ligt.', now() - interval '2 days'),
('e0000000-0000-4000-e000-000000000001', 'd0000000-0000-4000-a000-000000000013', 'Weet iemand wanneer we het aangepaste ontwerp kunnen zien?', now() - interval '2 days'),
('e0000000-0000-4000-e000-000000000001', 'd0000000-0000-4000-a000-000000000001', 'Over ongeveer 6 weken verwachten we het DO te presenteren. We plannen een speciale avond daarvoor!', now() - interval '1 day'),
('e0000000-0000-4000-e000-000000000002', 'd0000000-0000-4000-a000-000000000009', 'Fijn dat het reglement erdoor is. Duidelijkheid voor iedereen.', now() - interval '7 days'),
('e0000000-0000-4000-e000-000000000002', 'd0000000-0000-4000-a000-000000000016', 'Sterk dat er zoveel leden aanwezig waren!', now() - interval '7 days'),
('e0000000-0000-4000-e000-000000000003', 'd0000000-0000-4000-a000-000000000021', '30% besparing is echt significant. Goed werk van de werkgroep!', now() - interval '14 days'),
('e0000000-0000-4000-e000-000000000005', 'd0000000-0000-4000-a000-000000000019', 'Een logeerkamer, wat een goed idee! Kunnen we daar ook een slaapbank neerzetten?', now() - interval '24 days'),
('e0000000-0000-4000-e000-000000000006', 'd0000000-0000-4000-a000-000000000011', 'Wat een mijlpaal! Heel spannend!', now() - interval '34 days'),
('e0000000-0000-4000-e000-000000000006', 'd0000000-0000-4000-a000-000000000023', 'Fingers crossed voor een snelle vergunning.', now() - interval '34 days');

-- Update reactions
INSERT INTO update_reactions (update_id, profile_id, emoji) VALUES
('e0000000-0000-4000-e000-000000000001', 'd0000000-0000-4000-a000-000000000002', 'heart'),
('e0000000-0000-4000-e000-000000000001', 'd0000000-0000-4000-a000-000000000003', 'celebrate'),
('e0000000-0000-4000-e000-000000000001', 'd0000000-0000-4000-a000-000000000005', 'thumbsup'),
('e0000000-0000-4000-e000-000000000001', 'd0000000-0000-4000-a000-000000000006', 'celebrate'),
('e0000000-0000-4000-e000-000000000001', 'd0000000-0000-4000-a000-000000000008', 'heart'),
('e0000000-0000-4000-e000-000000000001', 'd0000000-0000-4000-a000-000000000010', 'thumbsup'),
('e0000000-0000-4000-e000-000000000001', 'd0000000-0000-4000-a000-000000000012', 'celebrate'),
('e0000000-0000-4000-e000-000000000001', 'd0000000-0000-4000-a000-000000000015', 'heart'),
('e0000000-0000-4000-e000-000000000001', 'd0000000-0000-4000-a000-000000000018', 'celebrate'),
('e0000000-0000-4000-e000-000000000001', 'd0000000-0000-4000-a000-000000000020', 'thumbsup'),
('e0000000-0000-4000-e000-000000000001', 'd0000000-0000-4000-a000-000000000022', 'heart'),
('e0000000-0000-4000-e000-000000000001', 'd0000000-0000-4000-a000-000000000025', 'thumbsup'),
('e0000000-0000-4000-e000-000000000002', 'd0000000-0000-4000-a000-000000000001', 'thumbsup'),
('e0000000-0000-4000-e000-000000000002', 'd0000000-0000-4000-a000-000000000004', 'heart'),
('e0000000-0000-4000-e000-000000000002', 'd0000000-0000-4000-a000-000000000007', 'thumbsup'),
('e0000000-0000-4000-e000-000000000002', 'd0000000-0000-4000-a000-000000000010', 'celebrate'),
('e0000000-0000-4000-e000-000000000002', 'd0000000-0000-4000-a000-000000000014', 'thumbsup'),
('e0000000-0000-4000-e000-000000000003', 'd0000000-0000-4000-a000-000000000001', 'celebrate'),
('e0000000-0000-4000-e000-000000000003', 'd0000000-0000-4000-a000-000000000005', 'thumbsup'),
('e0000000-0000-4000-e000-000000000003', 'd0000000-0000-4000-a000-000000000009', 'thumbsup'),
('e0000000-0000-4000-e000-000000000003', 'd0000000-0000-4000-a000-000000000013', 'heart'),
('e0000000-0000-4000-e000-000000000003', 'd0000000-0000-4000-a000-000000000017', 'celebrate'),
('e0000000-0000-4000-e000-000000000003', 'd0000000-0000-4000-a000-000000000020', 'thumbsup'),
('e0000000-0000-4000-e000-000000000006', 'd0000000-0000-4000-a000-000000000001', 'celebrate'),
('e0000000-0000-4000-e000-000000000006', 'd0000000-0000-4000-a000-000000000003', 'celebrate'),
('e0000000-0000-4000-e000-000000000006', 'd0000000-0000-4000-a000-000000000006', 'heart'),
('e0000000-0000-4000-e000-000000000006', 'd0000000-0000-4000-a000-000000000009', 'celebrate'),
('e0000000-0000-4000-e000-000000000006', 'd0000000-0000-4000-a000-000000000012', 'thumbsup'),
('e0000000-0000-4000-e000-000000000006', 'd0000000-0000-4000-a000-000000000015', 'celebrate'),
('e0000000-0000-4000-e000-000000000006', 'd0000000-0000-4000-a000-000000000018', 'thumbsup'),
('e0000000-0000-4000-e000-000000000006', 'd0000000-0000-4000-a000-000000000021', 'celebrate'),
('e0000000-0000-4000-e000-000000000006', 'd0000000-0000-4000-a000-000000000024', 'heart'),
('e0000000-0000-4000-e000-000000000006', 'd0000000-0000-4000-a000-000000000027', 'thumbsup'),
('e0000000-0000-4000-e000-000000000006', 'd0000000-0000-4000-a000-000000000030', 'celebrate'),
('e0000000-0000-4000-e000-000000000008', 'd0000000-0000-4000-a000-000000000003', 'thumbsup'),
('e0000000-0000-4000-e000-000000000008', 'd0000000-0000-4000-a000-000000000007', 'celebrate'),
('e0000000-0000-4000-e000-000000000008', 'd0000000-0000-4000-a000-000000000011', 'heart'),
('e0000000-0000-4000-e000-000000000008', 'd0000000-0000-4000-a000-000000000016', 'thumbsup'),
('e0000000-0000-4000-e000-000000000008', 'd0000000-0000-4000-a000-000000000019', 'celebrate')
ON CONFLICT DO NOTHING;


-- ─── Prikbord posts ─────────────────────────────────────────────────────────
INSERT INTO posts (id, project_id, author_id, text, tag, image_url, is_pinned, post_type, audience, created_at) VALUES
('f0000000-0000-4000-f000-000000000001', '00000000-0000-4000-b000-000000000001', 'd0000000-0000-4000-a000-000000000009',
 'Ik heb een vraag over de parkeerplaatsen. Hoeveel plekken zijn er per woning? En is er ruimte voor deelautoparkeren? Ik heb zelf geen auto maar zou het fijn vinden als er een deelauto beschikbaar is.',
 'Vraag', null, false, 'post', 'members', now() - interval '1 day'),

('f0000000-0000-4000-f000-000000000002', '00000000-0000-4000-b000-000000000001', 'd0000000-0000-4000-a000-000000000004',
 'Wat als we een gedeelde gereedschapsbibliotheek opzetten? Niet iedereen hoeft een eigen boormachine, decoupeerzaag en stoomcleaner te hebben. We kunnen een kast in de berging inrichten waar je spullen kunt lenen. Ik heb al een hoop gereedschap dat ik wil delen!',
 'Idee', null, false, 'post', 'members', now() - interval '2 days'),

('f0000000-0000-4000-f000-000000000003', '00000000-0000-4000-b000-000000000001', 'd0000000-0000-4000-a000-000000000016',
 'Even voorstellen! Ik ben Mees, 34 jaar, en woon momenteel in een appartement in de Pijp. Ik werk als grafisch ontwerper en ben een enorme koffieliefhebber. Ik kijk er enorm naar uit om straks in een gemeenschap te wonen waar je spontaan bij de buren kunt aankloppen. Tot bij de volgende bijeenkomst!',
 'Even voorstellen', null, false, 'post', 'members', now() - interval '3 days'),

('f0000000-0000-4000-f000-000000000004', '00000000-0000-4000-b000-000000000001', 'd0000000-0000-4000-a000-000000000001',
 'Ons project is vandaag in Het Parool verschenen! Een mooi artikel over collectief wonen in Amsterdam. De journalist was erg enthousiast over ons concept. Link in de comments.',
 'In de media', 'https://images.unsplash.com/photo-1534351590666-13e3e96b5017?w=800&h=500&fit=crop', true, 'post', 'members', now() - interval '5 days'),

('f0000000-0000-4000-f000-000000000005', '00000000-0000-4000-b000-000000000001', 'd0000000-0000-4000-a000-000000000011',
 'Wie heeft er zin om mee te doen met een hardloopgroepje? Ik loop 3x per week een rondje door het Vondelpark en zou het leuk vinden om straks met buren te lopen. Tempo maakt niet uit, gezelligheid staat voorop!',
 'Sociaal', null, false, 'post', 'members', now() - interval '7 days'),

('f0000000-0000-4000-f000-000000000006', '00000000-0000-4000-b000-000000000001', 'd0000000-0000-4000-a000-000000000007',
 'Idee: laten we een maandelijks "kookavond" organiseren in de gemeenschapsruimte zodra die klaar is. Elke maand kookt een ander huishouden voor de groep. Zo leer je je buren kennen en hoef je niet elke avond zelf te koken!',
 'Idee', 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&h=500&fit=crop', false, 'post', 'members', now() - interval '10 days'),

('f0000000-0000-4000-f000-000000000007', '00000000-0000-4000-b000-000000000001', 'd0000000-0000-4000-a000-000000000021',
 'Heeft iemand ervaring met collectieve energie-inkoop? Ik las dat je als VvE samen een energiecontract kunt afsluiten met flinke korting. Misschien iets voor de werkgroep Duurzaamheid om uit te zoeken?',
 'Vraag', null, false, 'post', 'members', now() - interval '12 days'),

('f0000000-0000-4000-f000-000000000008', '00000000-0000-4000-b000-000000000001', 'd0000000-0000-4000-a000-000000000005',
 'De eerste schetsen van de gemeenschapsruimte zijn binnen! Ik ben zo enthousiast over de open keuken met kookeiland. Kom alsjeblieft naar de inloopavond om mee te denken over de indeling. Elke stem telt!',
 'Idee', 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&h=500&fit=crop', false, 'post', 'members', now() - interval '14 days'),

('f0000000-0000-4000-f000-000000000009', '00000000-0000-4000-b000-000000000001', 'd0000000-0000-4000-a000-000000000026',
 'Hoi allemaal! Max hier, met mijn partner net aangemeld. We wonen nu in Utrecht maar hebben altijd al in Amsterdam willen wonen. Het concept van samen bouwen en samen wonen trekt ons enorm aan. We kijken uit naar de kennismakingsavond!',
 'Even voorstellen', null, false, 'post', 'members', now() - interval '16 days'),

('f0000000-0000-4000-f000-000000000010', '00000000-0000-4000-b000-000000000001', 'd0000000-0000-4000-a000-000000000014',
 'Vraagje over de fietsenstalling: komt er ook ruimte voor bakfietsen en e-bikes met oplaadpunten? Met twee kinderen is een bakfiets echt onmisbaar in Amsterdam.',
 'Vraag', 'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=800&h=500&fit=crop', false, 'post', 'members', now() - interval '18 days'),

('f0000000-0000-4000-f000-000000000011', '00000000-0000-4000-b000-000000000001', 'd0000000-0000-4000-a000-000000000003',
 'Zaterdag 12 juli organiseren we een informele zomerborrel in het Flevopark! Neem je eigen drankje en een kleedje mee. Kinderen en huisdieren welkom. We verzamelen bij de grote eik naast de speeltuin om 15:00. Tot dan!',
 'Sociaal', 'https://images.unsplash.com/photo-1519331379826-f10be5486c6f?w=800&h=500&fit=crop', false, 'post', 'members', now() - interval '20 days'),

('f0000000-0000-4000-f000-000000000012', '00000000-0000-4000-b000-000000000001', 'd0000000-0000-4000-a000-000000000002',
 'Wat als we een "welkomspakket" maken voor nieuwe leden? Een mapje met alle praktische info, contactgegevens werkgroepen, huisregels en misschien een klein cadeautje. Zo voelen nieuwe leden zich meteen thuis!',
 'Idee', null, false, 'post', 'members', now() - interval '22 days');

-- Post comments
INSERT INTO comments (post_id, author_id, text, created_at) VALUES
('f0000000-0000-4000-f000-000000000001', 'd0000000-0000-4000-a000-000000000002', 'Er komen 0.5 parkeerplekken per woning, dus gedeeld parkeren is het idee. Een deelauto past daar perfect bij!', now() - interval '1 day'),
('f0000000-0000-4000-f000-000000000001', 'd0000000-0000-4000-a000-000000000015', 'Ik zou ook graag een deelauto zien. Misschien via MyWheels of Greenwheels?', now() - interval '23 hours'),
('f0000000-0000-4000-f000-000000000001', 'd0000000-0000-4000-a000-000000000001', 'We zijn in gesprek met MyWheels voor een vaste plek. Updates volgen!', now() - interval '20 hours'),
('f0000000-0000-4000-f000-000000000002', 'd0000000-0000-4000-a000-000000000008', 'Top idee! Ik heb een Kärcher hogedrukreiniger die iedereen mag lenen.', now() - interval '2 days'),
('f0000000-0000-4000-f000-000000000002', 'd0000000-0000-4000-a000-000000000020', 'In mijn vorige wooncomplex hadden we dit ook. Werkt prima met een simpel uitleensysteem via een gedeelde app.', now() - interval '2 days'),
('f0000000-0000-4000-f000-000000000003', 'd0000000-0000-4000-a000-000000000007', 'Welkom Mees! Ik ben ook een koffieliefhebber. We moeten snel een keer afspreken!', now() - interval '3 days'),
('f0000000-0000-4000-f000-000000000004', 'd0000000-0000-4000-a000-000000000013', 'Geweldig! Wie heeft de link naar het artikel?', now() - interval '5 days'),
('f0000000-0000-4000-f000-000000000004', 'd0000000-0000-4000-a000-000000000001', 'https://parool.nl/amsterdam/collectief-wonen — hier is ie!', now() - interval '5 days'),
('f0000000-0000-4000-f000-000000000005', 'd0000000-0000-4000-a000-000000000023', 'Ik doe mee! Loop nu 2x per week, zou graag vaker willen.', now() - interval '7 days'),
('f0000000-0000-4000-f000-000000000005', 'd0000000-0000-4000-a000-000000000031', 'Leuk! Ik ben een beginner maar wil het graag proberen.', now() - interval '6 days'),
('f0000000-0000-4000-f000-000000000006', 'd0000000-0000-4000-a000-000000000012', 'Ja! Dit deden we in mijn studentenhuis ook. Was altijd super gezellig.', now() - interval '10 days'),
('f0000000-0000-4000-f000-000000000006', 'd0000000-0000-4000-a000-000000000029', 'Ik kan Indonesisch koken, wie wil proeven?', now() - interval '9 days'),
('f0000000-0000-4000-f000-000000000006', 'd0000000-0000-4000-a000-000000000036', 'Geweldig idee. Kunnen we ook een kookclub oprichten?', now() - interval '9 days'),
('f0000000-0000-4000-f000-000000000007', 'd0000000-0000-4000-a000-000000000002', 'Goede suggestie! Ik neem het mee naar de volgende vergadering van de werkgroep.', now() - interval '11 days'),
('f0000000-0000-4000-f000-000000000010', 'd0000000-0000-4000-a000-000000000001', 'Ja, er komen extra brede plekken voor bakfietsen en oplaadpunten voor e-bikes. Staat in het PvE!', now() - interval '17 days'),
('f0000000-0000-4000-f000-000000000011', 'd0000000-0000-4000-a000-000000000017', 'Leuk! Wij komen met de kids. Tot zaterdag!', now() - interval '19 days'),
('f0000000-0000-4000-f000-000000000011', 'd0000000-0000-4000-a000-000000000025', 'Ik neem brownies mee!', now() - interval '19 days'),
('f0000000-0000-4000-f000-000000000012', 'd0000000-0000-4000-a000-000000000010', 'Mooi idee! Ik wil wel helpen met het ontwerpen van het mapje.', now() - interval '21 days');

-- Post reactions (varied emojis across posts)
INSERT INTO post_reactions (post_id, profile_id, emoji) VALUES
('f0000000-0000-4000-f000-000000000001', 'd0000000-0000-4000-a000-000000000002', 'thumbsup'),
('f0000000-0000-4000-f000-000000000001', 'd0000000-0000-4000-a000-000000000005', 'thumbsup'),
('f0000000-0000-4000-f000-000000000001', 'd0000000-0000-4000-a000-000000000010', 'lightbulb'),
('f0000000-0000-4000-f000-000000000002', 'd0000000-0000-4000-a000-000000000001', 'lightbulb'),
('f0000000-0000-4000-f000-000000000002', 'd0000000-0000-4000-a000-000000000003', 'heart'),
('f0000000-0000-4000-f000-000000000002', 'd0000000-0000-4000-a000-000000000007', 'thumbsup'),
('f0000000-0000-4000-f000-000000000002', 'd0000000-0000-4000-a000-000000000012', 'lightbulb'),
('f0000000-0000-4000-f000-000000000002', 'd0000000-0000-4000-a000-000000000019', 'thumbsup'),
('f0000000-0000-4000-f000-000000000002', 'd0000000-0000-4000-a000-000000000025', 'heart'),
('f0000000-0000-4000-f000-000000000003', 'd0000000-0000-4000-a000-000000000001', 'heart'),
('f0000000-0000-4000-f000-000000000003', 'd0000000-0000-4000-a000-000000000007', 'celebrate'),
('f0000000-0000-4000-f000-000000000003', 'd0000000-0000-4000-a000-000000000020', 'thumbsup'),
('f0000000-0000-4000-f000-000000000004', 'd0000000-0000-4000-a000-000000000003', 'celebrate'),
('f0000000-0000-4000-f000-000000000004', 'd0000000-0000-4000-a000-000000000005', 'celebrate'),
('f0000000-0000-4000-f000-000000000004', 'd0000000-0000-4000-a000-000000000008', 'heart'),
('f0000000-0000-4000-f000-000000000004', 'd0000000-0000-4000-a000-000000000012', 'celebrate'),
('f0000000-0000-4000-f000-000000000004', 'd0000000-0000-4000-a000-000000000015', 'thumbsup'),
('f0000000-0000-4000-f000-000000000004', 'd0000000-0000-4000-a000-000000000018', 'celebrate'),
('f0000000-0000-4000-f000-000000000004', 'd0000000-0000-4000-a000-000000000021', 'heart'),
('f0000000-0000-4000-f000-000000000004', 'd0000000-0000-4000-a000-000000000024', 'celebrate'),
('f0000000-0000-4000-f000-000000000004', 'd0000000-0000-4000-a000-000000000028', 'thumbsup'),
('f0000000-0000-4000-f000-000000000005', 'd0000000-0000-4000-a000-000000000003', 'thumbsup'),
('f0000000-0000-4000-f000-000000000005', 'd0000000-0000-4000-a000-000000000009', 'celebrate'),
('f0000000-0000-4000-f000-000000000005', 'd0000000-0000-4000-a000-000000000017', 'thumbsup'),
('f0000000-0000-4000-f000-000000000005', 'd0000000-0000-4000-a000-000000000022', 'celebrate'),
('f0000000-0000-4000-f000-000000000006', 'd0000000-0000-4000-a000-000000000001', 'heart'),
('f0000000-0000-4000-f000-000000000006', 'd0000000-0000-4000-a000-000000000005', 'lightbulb'),
('f0000000-0000-4000-f000-000000000006', 'd0000000-0000-4000-a000-000000000010', 'celebrate'),
('f0000000-0000-4000-f000-000000000006', 'd0000000-0000-4000-a000-000000000014', 'heart'),
('f0000000-0000-4000-f000-000000000006', 'd0000000-0000-4000-a000-000000000018', 'thumbsup'),
('f0000000-0000-4000-f000-000000000006', 'd0000000-0000-4000-a000-000000000022', 'lightbulb'),
('f0000000-0000-4000-f000-000000000006', 'd0000000-0000-4000-a000-000000000027', 'heart'),
('f0000000-0000-4000-f000-000000000008', 'd0000000-0000-4000-a000-000000000001', 'celebrate'),
('f0000000-0000-4000-f000-000000000008', 'd0000000-0000-4000-a000-000000000007', 'heart'),
('f0000000-0000-4000-f000-000000000008', 'd0000000-0000-4000-a000-000000000013', 'lightbulb'),
('f0000000-0000-4000-f000-000000000008', 'd0000000-0000-4000-a000-000000000020', 'celebrate'),
('f0000000-0000-4000-f000-000000000009', 'd0000000-0000-4000-a000-000000000001', 'heart'),
('f0000000-0000-4000-f000-000000000009', 'd0000000-0000-4000-a000-000000000007', 'celebrate'),
('f0000000-0000-4000-f000-000000000009', 'd0000000-0000-4000-a000-000000000013', 'heart'),
('f0000000-0000-4000-f000-000000000011', 'd0000000-0000-4000-a000-000000000005', 'celebrate'),
('f0000000-0000-4000-f000-000000000011', 'd0000000-0000-4000-a000-000000000010', 'celebrate'),
('f0000000-0000-4000-f000-000000000011', 'd0000000-0000-4000-a000-000000000016', 'celebrate'),
('f0000000-0000-4000-f000-000000000011', 'd0000000-0000-4000-a000-000000000020', 'thumbsup'),
('f0000000-0000-4000-f000-000000000011', 'd0000000-0000-4000-a000-000000000025', 'celebrate'),
('f0000000-0000-4000-f000-000000000012', 'd0000000-0000-4000-a000-000000000004', 'lightbulb'),
('f0000000-0000-4000-f000-000000000012', 'd0000000-0000-4000-a000-000000000008', 'thumbsup'),
('f0000000-0000-4000-f000-000000000012', 'd0000000-0000-4000-a000-000000000015', 'heart'),
('f0000000-0000-4000-f000-000000000012', 'd0000000-0000-4000-a000-000000000021', 'lightbulb')
ON CONFLICT DO NOTHING;

-- Post likes
INSERT INTO post_likes (post_id, profile_id)
SELECT p.pid, u.uid FROM
(VALUES
  ('f0000000-0000-4000-f000-000000000001'::uuid), ('f0000000-0000-4000-f000-000000000002'::uuid),
  ('f0000000-0000-4000-f000-000000000003'::uuid), ('f0000000-0000-4000-f000-000000000004'::uuid),
  ('f0000000-0000-4000-f000-000000000005'::uuid), ('f0000000-0000-4000-f000-000000000006'::uuid),
  ('f0000000-0000-4000-f000-000000000007'::uuid), ('f0000000-0000-4000-f000-000000000008'::uuid),
  ('f0000000-0000-4000-f000-000000000009'::uuid), ('f0000000-0000-4000-f000-000000000010'::uuid),
  ('f0000000-0000-4000-f000-000000000011'::uuid), ('f0000000-0000-4000-f000-000000000012'::uuid)
) AS p(pid)
CROSS JOIN LATERAL (
  SELECT uid FROM (
    SELECT ('d0000000-0000-4000-a000-' || lpad(n::text, 12, '0'))::uuid AS uid
    FROM generate_series(1, 40) n
    WHERE random() < 0.35
  ) sub
) u
ON CONFLICT DO NOTHING;


-- ─── Events / Meetings ──────────────────────────────────────────────────────
INSERT INTO meetings (id, project_id, title, description, date, location, online_url, max_attendees, duration_hours, event_type, visibility, image_url, status, notes) VALUES
('b0000000-0000-4000-d000-000000000001', '00000000-0000-4000-b000-000000000001',
 'Zomerborrel in het Flevopark',
 'Informele borrel voor alle leden en geïnteresseerden. Neem je eigen drankje mee en geniet van het mooie weer! Kinderen en huisdieren welkom.',
 now() + interval '5 days' + interval '15 hours', 'Flevopark, bij de grote eik naast de speeltuin', null, 60, 3,
 'uitje', 'members', 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=800&h=500&fit=crop', 'upcoming', null),

('b0000000-0000-4000-d000-000000000002', '00000000-0000-4000-b000-000000000001',
 'Inloopavond gemeenschapsruimte',
 'Bekijk de eerste schetsen van de gemeenschapsruimte en geef je feedback. De werkgroep presenteert drie opties voor de indeling. Er is koffie en cake!',
 now() + interval '12 days' + interval '19 hours', 'Pakhuis de Zwijger, Piet Heinkade 179', null, 40, 2,
 'workshop', 'members', 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&h=500&fit=crop', 'upcoming', null),

('b0000000-0000-4000-d000-000000000003', '00000000-0000-4000-b000-000000000001',
 'Kennismakingsavond nieuwe leden',
 'Welkom aan alle nieuwe en geïnteresseerde leden! We vertellen over het project, de voortgang en hoe je je kunt aansluiten. Daarna is er een informeel gedeelte met drankjes.',
 now() + interval '20 days' + interval '19 hours', 'Grand Café de Tropen, Linnaeusstraat 2', null, 30, 2,
 'kennismaking', 'public', 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=800&h=500&fit=crop', 'upcoming', null),

('b0000000-0000-4000-d000-000000000004', '00000000-0000-4000-b000-000000000001',
 'Workshop: Duurzaam wonen in de praktijk',
 'Gastspreker Hans Vermeulen (TU Delft) vertelt over de nieuwste ontwikkelingen in duurzaam bouwen. Onderwerpen: warmtepompen, isolatie, zonnepanelen en energieopslag.',
 now() + interval '28 days' + interval '14 hours', 'Online (Zoom link volgt)', 'https://zoom.us/j/123456789', 50, 2,
 'workshop', 'members', 'https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?w=800&h=500&fit=crop', 'upcoming', null),

('b0000000-0000-4000-d000-000000000005', '00000000-0000-4000-b000-000000000001',
 'ALV — najaarsvergadering',
 'Halfjaarlijkse Algemene Ledenvergadering. Agendapunten: financieel overzicht, voortgang bouw, bestuursverkiezing, en rondvraag.',
 now() + interval '45 days' + interval '10 hours', 'Pakhuis de Zwijger, zaal 4', null, 50, 3,
 'alv', 'members', 'https://images.unsplash.com/photo-1515187029135-18ee286d815b?w=800&h=500&fit=crop', 'upcoming', null),

-- Past events
('b0000000-0000-4000-d000-000000000006', '00000000-0000-4000-b000-000000000001',
 'Bouwvergadering #8',
 'Maandelijkse bouwvergadering met de aannemer. Besproken: funderingsplan, planning staalconstructie, keuze gevelbekleding.',
 now() - interval '10 days' + interval '14 hours', 'Kantoor Bouwbedrijf de Nijs, Cruquiusweg 111', null, null, 2,
 'bouwvergadering', 'members', 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=800&h=500&fit=crop', 'done',
 'Fundering start september. Gevelbekleding: hout (accoya) in combinatie met stucwerk. Staalconstructie aanbesteding loopt.'),

('b0000000-0000-4000-d000-000000000007', '00000000-0000-4000-b000-000000000001',
 'ALV juni — halfjaarsvergadering',
 'Halfjaarlijkse ALV met goedkeuring huishoudelijk reglement en budget gemeenschapsruimte.',
 now() - interval '20 days' + interval '10 hours', 'Pakhuis de Zwijger, zaal 4', null, null, 3,
 'alv', 'members', 'https://images.unsplash.com/photo-1515187029135-18ee286d815b?w=800&h=500&fit=crop', 'done',
 'Huishoudelijk reglement unaniem aangenomen. Budget gemeenschapsruimte vastgesteld op €45.000.'),

('b0000000-0000-4000-d000-000000000008', '00000000-0000-4000-b000-000000000001',
 'Workshop bij Space&Matter',
 'Atelierbezoek bij architect Space&Matter. Maquette bekeken en feedback gegeven op de plattegronden.',
 now() - interval '35 days' + interval '14 hours', 'Space&Matter, NDSM-werf', null, null, 3,
 'workshop', 'members', 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=800&h=500&fit=crop', 'done',
 'Positieve reacties op het ontwerp. Aandachtspunten: meer bergruimte, bredere gangen voor rolstoelen.'),

('b0000000-0000-4000-d000-000000000009', '00000000-0000-4000-b000-000000000001',
 'Yoga in het park',
 'Gratis yogales voor alle leden door onze eigen instructrice Noor. Breng je eigen matje mee!',
 now() - interval '40 days' + interval '9 hours', 'Flevopark, grote grasveld', null, null, 1,
 'uitje', 'members', 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=800&h=500&fit=crop', 'done', null),

('b0000000-0000-4000-d000-000000000010', '00000000-0000-4000-b000-000000000001',
 'Buurtborrel met omwonenden Centrumeiland',
 'Kennismaking met onze toekomstige buren op Centrumeiland. Samen met twee andere CPO-projecten organiseren we een informele borrel.',
 now() - interval '55 days' + interval '17 hours', 'Strandpaviljoen Blijburg', null, null, 2,
 'uitje', 'public', 'https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=800&h=500&fit=crop', 'done', null);

-- Decisions for past events
INSERT INTO decisions (meeting_id, text) VALUES
('b0000000-0000-4000-d000-000000000006', 'Fundering: start september 2026'),
('b0000000-0000-4000-d000-000000000006', 'Gevelbekleding: accoya hout + stucwerk'),
('b0000000-0000-4000-d000-000000000007', 'Huishoudelijk reglement aangenomen'),
('b0000000-0000-4000-d000-000000000007', 'Budget gemeenschapsruimte: €45.000'),
('b0000000-0000-4000-d000-000000000007', 'Werkgroep Duurzaamheid krijgt mandaat warmtepomp'),
('b0000000-0000-4000-d000-000000000008', 'Meer bergruimte in ontwerp opnemen'),
('b0000000-0000-4000-d000-000000000008', 'Gangen verbreden voor toegankelijkheid');

-- RSVPs for events (random distribution)
INSERT INTO event_rsvps (meeting_id, profile_id, status)
SELECT m.mid, u.uid, (ARRAY['going','going','going','maybe','not_going'])[1 + (row_number() OVER ())::int % 5]
FROM (VALUES
  ('b0000000-0000-4000-d000-000000000001'::uuid),
  ('b0000000-0000-4000-d000-000000000002'::uuid),
  ('b0000000-0000-4000-d000-000000000003'::uuid),
  ('b0000000-0000-4000-d000-000000000004'::uuid),
  ('b0000000-0000-4000-d000-000000000005'::uuid),
  ('b0000000-0000-4000-d000-000000000006'::uuid),
  ('b0000000-0000-4000-d000-000000000007'::uuid),
  ('b0000000-0000-4000-d000-000000000008'::uuid),
  ('b0000000-0000-4000-d000-000000000009'::uuid),
  ('b0000000-0000-4000-d000-000000000010'::uuid)
) AS m(mid)
CROSS JOIN LATERAL (
  SELECT ('d0000000-0000-4000-a000-' || lpad(n::text, 12, '0'))::uuid AS uid
  FROM generate_series(1, 40) n
  WHERE random() < 0.5
) u
ON CONFLICT DO NOTHING;


-- ─── Enable all features on the project ─────────────────────────────────────
UPDATE projects SET
  features = jsonb_build_object(
    'team', true, 'board', true, 'events', true, 'members', true,
    'roadmap', true, 'updates', true, 'documents', true,
    'ledenwerving', true, 'page_builder', true
  )
WHERE id = '00000000-0000-4000-b000-000000000001';


-- ─── Done! ──────────────────────────────────────────────────────────────────
DO $$ BEGIN RAISE NOTICE 'Demo seed complete! 40 leden, 12 posts, 10 events, 8 updates.'; END $$;
