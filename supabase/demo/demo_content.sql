-- ============================================================================
-- Demo-content voor demoproject.buuur.nl
-- ----------------------------------------------------------------------------
-- Geen migratie: dit is content, geen schema. Plak in de SQL Editor.
--
-- Alles is gescoped op het project met slug 'demoproject'. Het script raakt
-- geen enkel ander project aan, en verwijdert geen accounts.
--
-- Opnieuw draaien mag: de nieuwe rijen hebben vaste id's, en die worden aan
-- het begin van hun blok eerst verwijderd. Datums zijn relatief aan now(),
-- dus de demo veroudert niet.
--
-- Volgorde: eerst opruimen, dan nieuwe content per onderdeel.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 0. Context: project + mensen bij de hand houden
-- ----------------------------------------------------------------------------
create temp table demo_ctx on commit drop as
select id as project_id from projects where slug = 'demoproject';

do $$
begin
  if not exists (select 1 from demo_ctx) then
    raise exception 'Geen project met slug ''demoproject'' gevonden — script gestopt.';
  end if;
end $$;

create temp table demo_people on commit drop as
select distinct on (p.full_name) p.id, p.full_name
from profiles p
join memberships m on m.profile_id = p.id
where m.project_id = (select project_id from demo_ctx)
order by p.full_name, p.id;

-- Handige verkorting: wie(naam) → profile_id
create or replace function pg_temp.wie(p_naam text)
returns uuid language sql stable as $$
  select id from demo_people where full_name = p_naam limit 1;
$$;

-- ----------------------------------------------------------------------------
-- 1. Opruimen: testberichten die als "half afgebouwd" lezen
-- ----------------------------------------------------------------------------

-- Prikbord: losse testposts weg (comments/likes gaan mee via cascade).
delete from posts
where project_id = (select project_id from demo_ctx)
  and (
    text ilike '%even kijken of dit werkt%'
    or text ilike 'hoi irrrreene%'
    or text ilike '%ik ben erbij%'
    or text ilike 'ik wil graag een grote woning%'
    or text ilike 'hallo allemaal ik ben tjomme%'
  );

-- Chat: alle bestaande threads van het demoproject weg. Berichten en
-- deelnemers verdwijnen mee (on delete cascade).
delete from chat_threads where project_id = (select project_id from demo_ctx);

-- ----------------------------------------------------------------------------
-- 2. Projectnieuws: bestaande berichten opfrissen, drie nieuwe erbij
--    Het project zit volgens de roadmap in de DO-fase, dus daar gaat het
--    nieuwste nieuws over.
-- ----------------------------------------------------------------------------

-- Bestaande drie naar een paar weken terug, zodat ze onder het nieuwe nieuws staan.
update updates set created_at = now() - interval '5 weeks'
where project_id = (select project_id from demo_ctx) and title ilike 'Ontwerp gepresenteerd%';
update updates set created_at = now() - interval '7 weeks'
where project_id = (select project_id from demo_ctx) and title ilike 'Terugblik ALV%';
update updates set created_at = now() - interval '9 weeks'
where project_id = (select project_id from demo_ctx) and title ilike 'Zonnepanelen%';

-- De ALV-terugblik stond als één lap tekst; regelafbrekingen erin.
update updates set body =
'Afgelopen zaterdag hielden we onze halfjaarlijkse Algemene Ledenvergadering. Met 34 van de 40 leden aanwezig was het quorum ruim gehaald.

Besluiten:

- Het huishoudelijk reglement is unaniem aangenomen
- Budget voor de inrichting van de gemeenschapsruimte: 45.000 euro
- Werkgroep Duurzaamheid krijgt mandaat voor de keuze van de warmtepomp
- Volgende ALV: december 2026

De notulen staan in het projectdossier. Bedankt voor jullie betrokkenheid!'
where project_id = (select project_id from demo_ctx) and title ilike 'Terugblik ALV%';

delete from updates where id in (
  'd0000000-0000-4000-a000-000000000001',
  'd0000000-0000-4000-a000-000000000002',
  'd0000000-0000-4000-a000-000000000003'
);

insert into updates (id, project_id, author_id, title, body, tag, is_public, created_at) values
('d0000000-0000-4000-a000-000000000001', (select project_id from demo_ctx), pg_temp.wie('Sophie van der Berg'),
 'Definitief ontwerp is klaar',
 'Het definitief ontwerp (DO) is af. Space&Matter heeft de opmerkingen uit de VO-ronde verwerkt: de gevel aan de waterkant is rustiger geworden, en de bergingen zijn verplaatst naar de noordzijde zodat het binnenhof meer zon houdt.

Wat dit voor jou betekent:

- De plattegrond van jouw woning staat in het projectdossier
- Wijzigingen in de indeling kunnen tot 1 november worden doorgegeven
- De meerprijzen voor keuze-opties volgen bij de volgende bouwvergadering

Loop het DO rustig door en stel je vragen in de Bouwcommissie-chat. We nemen ze mee naar het overleg met de architect.',
 'Mijlpaal', true, now() - interval '3 days'),

('d0000000-0000-4000-a000-000000000002', (select project_id from demo_ctx), pg_temp.wie('Daan de Vries'),
 'Vergunningsaanvraag deze maand de deur uit',
 'We dienen de omgevingsvergunning eind deze maand in bij de gemeente. De constructeur en de installatie-adviseur hebben hun stukken aangeleverd, de brandveiligheidsrapportage is binnen.

Wat we verwachten: de gemeente heeft acht weken de tijd, met eenmalig zes weken verlenging. Reken dus op uitsluitsel rond de jaarwisseling. Zodra er iets bekend is, lees je het hier.',
 'Update', false, now() - interval '10 days'),

('d0000000-0000-4000-a000-000000000003', (select project_id from demo_ctx), pg_temp.wie('Emma Jansen'),
 'Warmtepomp of stadsverwarming: de werkgroep heeft gekozen',
 'Na drie avonden rekenen en vergelijken kiest werkgroep Duurzaamheid voor een collectieve warmtepomp met bodemlussen.

De afweging in het kort:

- Stadsverwarming was 40 euro per maand goedkoper in aanleg, maar we zitten dan vast aan één leverancier en een tarief dat we niet in de hand hebben
- De bodemlussen vragen een hogere investering, maar de woonlasten liggen op termijn lager en we regelen het als vereniging zelf
- Koelen in de zomer zit erbij inbegrepen

Het volledige rekenmodel staat in het projectdossier. Op de ALV in december leggen we het besluit formeel voor.',
 'Besluit', false, now() - interval '24 days');

-- ----------------------------------------------------------------------------
-- 3. Prikbord: gesprekken die laten zien waar het bord voor is
-- ----------------------------------------------------------------------------
delete from posts where id in (
  'b0000000-0000-4000-a000-000000000001',
  'b0000000-0000-4000-a000-000000000002',
  'b0000000-0000-4000-a000-000000000003',
  'b0000000-0000-4000-a000-000000000004',
  'b0000000-0000-4000-a000-000000000005'
);

insert into posts (id, project_id, author_id, text, tag, created_at) values
('b0000000-0000-4000-a000-000000000001', (select project_id from demo_ctx), pg_temp.wie('Noor Dekker'),
 'Hoi allemaal! Ik ben Noor, 34, en ik kom uit Utrecht. Ik werk als verpleegkundige en zoek al drie jaar naar een plek waar wonen meer is dan een voordeur delen. Afgelopen zaterdag was ik bij de informatieavond en ik ben om. Ik neem een fiets, een gitaar en te veel planten mee. Tot snel!',
 'Even voorstellen', now() - interval '2 days'),

('b0000000-0000-4000-a000-000000000002', (select project_id from demo_ctx), pg_temp.wie('Lotte de Jong'),
 'Zullen we op het dak een paar moestuinbakken zetten? Ik heb bij mijn vorige woning meegedaan aan zoiets en het werkte verrassend goed: vier bakken, een appgroep voor het gieten, en in augustus meer courgettes dan iemand aankan. Wie doet mee om het uit te zoeken?',
 'Idee', now() - interval '6 days'),

('b0000000-0000-4000-a000-000000000003', (select project_id from demo_ctx), pg_temp.wie('Jesse Dijkstra'),
 'Vraag over de fietsenberging: staat er al vast hoeveel plekken we per woning krijgen? Wij hebben twee bakfietsen en die passen nergens in een standaard rek. Is er ruimte gereserveerd voor breder materieel?',
 'Vraag', now() - interval '9 days'),

('b0000000-0000-4000-a000-000000000004', (select project_id from demo_ctx), pg_temp.wie('Iris van Dijk'),
 'Op 12 oktober is het burendag in de wijk. De gemeente heeft gevraagd of wij ons project komen voorstellen met een kraampje. Lijkt me een mooie kans om de buurt mee te nemen in wat hier gaat gebeuren. Wie heeft die zaterdagmiddag tijd?',
 'Sociaal', now() - interval '13 days'),

('b0000000-0000-4000-a000-000000000005', (select project_id from demo_ctx), pg_temp.wie('Julia Visser'),
 'Leuk stuk in het Parool vanochtend over collectief opdrachtgeverschap in Amsterdam, met een alinea over ons project. De kop is wat groot uitgevallen, maar de strekking klopt: het duurt langer, en je krijgt er een buurt voor terug.',
 'In de media', now() - interval '18 days');

-- Reacties en likes, zodat het bord leeft
delete from comments where post_id in (
  'b0000000-0000-4000-a000-000000000001',
  'b0000000-0000-4000-a000-000000000002',
  'b0000000-0000-4000-a000-000000000003'
);

insert into comments (post_id, author_id, text, created_at) values
('b0000000-0000-4000-a000-000000000001', pg_temp.wie('Emma Jansen'),
 'Welkom Noor! Leuk dat je erbij bent. Kom je 24 september naar de informatieavond? Dan stel ik je voor aan de rest van de Communicatie-werkgroep.', now() - interval '2 days' + interval '3 hours'),
('b0000000-0000-4000-a000-000000000001', pg_temp.wie('Finn Hendriks'),
 'Welkom! En je planten passen prima, er komt een vensterbank van bijna drie meter in de zuidwoningen.', now() - interval '1 day'),
('b0000000-0000-4000-a000-000000000002', pg_temp.wie('Fleur Mulder'),
 'Ik doe mee. Wel eerst even checken bij de constructeur hoeveel gewicht het dak aankan, natte grond weegt meer dan mensen denken.', now() - interval '5 days'),
('b0000000-0000-4000-a000-000000000002', pg_temp.wie('Lucas Bos'),
 'Goed idee. Zullen we dit meenemen naar de werkgroep Gemeenschapsruimte? Dan kunnen we het in één keer met de daktuin meenemen.', now() - interval '4 days'),
('b0000000-0000-4000-a000-000000000003', pg_temp.wie('Sophie van der Berg'),
 'Goede vraag. In het DO staan 2 plekken per woning plus 6 extra brede plekken voor bakfietsen. Ik zet de tekening vanmiddag in het projectdossier.', now() - interval '8 days');

delete from post_likes where post_id in (
  'b0000000-0000-4000-a000-000000000001',
  'b0000000-0000-4000-a000-000000000002',
  'b0000000-0000-4000-a000-000000000004'
);

insert into post_likes (profile_id, post_id)
select pg_temp.wie(n), 'b0000000-0000-4000-a000-000000000001'
from unnest(array['Emma Jansen','Finn Hendriks','Lotte de Jong','Sem Smit','Iris van Dijk']) n
where pg_temp.wie(n) is not null;

insert into post_likes (profile_id, post_id)
select pg_temp.wie(n), 'b0000000-0000-4000-a000-000000000002'
from unnest(array['Fleur Mulder','Lucas Bos','Tessa Meijer','Noah de Graaf']) n
where pg_temp.wie(n) is not null;

insert into post_likes (profile_id, post_id)
select pg_temp.wie(n), 'b0000000-0000-4000-a000-000000000004'
from unnest(array['Julia Visser','Mees Vermeer','Eva Kok']) n
where pg_temp.wie(n) is not null;

-- ----------------------------------------------------------------------------
-- 4. Events: vier aankomend, twee afgelopen
--    (events zitten in de tabel `meetings`)
-- ----------------------------------------------------------------------------
delete from meetings where id in (
  'e0000000-0000-4000-a000-000000000001',
  'e0000000-0000-4000-a000-000000000002',
  'e0000000-0000-4000-a000-000000000003',
  'e0000000-0000-4000-a000-000000000004',
  'e0000000-0000-4000-a000-000000000005',
  'e0000000-0000-4000-a000-000000000006'
);

insert into meetings (id, project_id, title, description, date, location, event_type, visibility, status, duration_hours, max_attendees) values
('e0000000-0000-4000-a000-000000000001', (select project_id from demo_ctx),
 'Informatieavond voor nieuwe leden',
 'Ben je net aangehaakt of denk je erover mee te doen? Op deze avond lopen we het project door: waar we staan, wat het kost, wat we van elkaar verwachten en wanneer de schop de grond in gaat. Neem gerust iemand mee.',
 date_trunc('day', now() + interval '6 days') + interval '19 hours',
 'Buurthuis De Meevaart, Amsterdam', 'kennismaking', 'public', 'upcoming', 2, 40),

('e0000000-0000-4000-a000-000000000002', (select project_id from demo_ctx),
 'Werkgroep Duurzaamheid: warmtepomp doorrekenen',
 'We nemen het rekenmodel van de collectieve warmtepomp punt voor punt door, inclusief de offertes van de drie installateurs. Kom je niet, maar wil je wel meedenken? Zet je vragen in de chat van de werkgroep.',
 date_trunc('day', now() + interval '13 days') + interval '20 hours',
 'Online (Teams)', 'workshop', 'members', 'upcoming', 2, null),

('e0000000-0000-4000-a000-000000000003', (select project_id from demo_ctx),
 'Bouwvergadering met de architect',
 'Maandelijks overleg met Space&Matter en de constructeur. Op de agenda: de laatste wijzigingen in het DO, de meerprijzen voor keuze-opties en de planning richting de vergunningsaanvraag. Open voor alle leden, aanmelden is handig voor de koffie.',
 date_trunc('day', now() + interval '21 days') + interval '16 hours',
 'Kantoor Space&Matter, Amsterdam-Noord', 'bouwvergadering', 'members', 'upcoming', 3, 25),

('e0000000-0000-4000-a000-000000000004', (select project_id from demo_ctx),
 'Algemene Ledenvergadering december',
 'De halfjaarlijkse ALV. Formele besluitvorming over de warmtepomp, de begroting voor 2027 en de benoeming van twee nieuwe bestuursleden. De stukken komen twee weken van tevoren in het projectdossier.',
 date_trunc('day', now() + interval '46 days') + interval '19 hours',
 'Buurthuis De Meevaart, Amsterdam', 'alv', 'members', 'upcoming', 3, null),

('e0000000-0000-4000-a000-000000000005', (select project_id from demo_ctx),
 'Presentatie definitief ontwerp',
 'Space&Matter presenteerde het definitief ontwerp aan alle leden, met de plattegronden per woning en een maquette van het binnenhof. De opname en de presentatie staan in het projectdossier.',
 date_trunc('day', now() - interval '17 days') + interval '19 hours',
 'Buurthuis De Meevaart, Amsterdam', 'bouwvergadering', 'members', 'done', 2, null),

('e0000000-0000-4000-a000-000000000006', (select project_id from demo_ctx),
 'Zomerborrel op de kavel',
 'Met 38 leden op de kavel, een barbecue en een rondleiding over het terrein. De foto''s staan op het prikbord.',
 date_trunc('day', now() - interval '7 weeks') + interval '16 hours',
 'Kavel, Zeeburgereiland', 'uitje', 'members', 'done', 4, null);

-- Aanmeldingen, zodat de tellers niet op nul staan
delete from event_rsvps where meeting_id in (
  'e0000000-0000-4000-a000-000000000001',
  'e0000000-0000-4000-a000-000000000003'
);

insert into event_rsvps (meeting_id, profile_id, status)
select 'e0000000-0000-4000-a000-000000000001', pg_temp.wie(n), 'going'
from unnest(array['Noor Dekker','Emma Jansen','Finn Hendriks','Iris van Dijk','Sem Smit','Lotte de Jong']) n
where pg_temp.wie(n) is not null;

insert into event_rsvps (meeting_id, profile_id, status)
select 'e0000000-0000-4000-a000-000000000001', pg_temp.wie(n), 'maybe'
from unnest(array['Mees Vermeer','Eva Kok']) n
where pg_temp.wie(n) is not null;

insert into event_rsvps (meeting_id, profile_id, status)
select 'e0000000-0000-4000-a000-000000000003', pg_temp.wie(n), 'going'
from unnest(array['Sophie van der Berg','Daan de Vries','Julia Visser','Tessa Meijer','Noah de Graaf']) n
where pg_temp.wie(n) is not null;

-- ----------------------------------------------------------------------------
-- 5. Ledenchat: drie werkgroepen met een lopend gesprek
--    Alleen groepen; DM's laat de demo-policy bewust niet zien.
-- ----------------------------------------------------------------------------
insert into chat_threads (id, project_id, kind, title, topic, emoji, join_policy, workgroup_id, created_by, last_message_at, created_at) values
('c0000000-0000-4000-a000-000000000001', (select project_id from demo_ctx), 'group',
 'Bouwcommissie', 'Ontwerp, planning en alles met de architect', '🏗️', 'open',
 (select id from workgroups where project_id = (select project_id from demo_ctx) and name = 'Bouwcommissie' limit 1),
 pg_temp.wie('Sophie van der Berg'), now(), now() - interval '4 months'),

('c0000000-0000-4000-a000-000000000002', (select project_id from demo_ctx), 'group',
 'Duurzaamheid', 'Warmte, zon en isolatie', '🌱', 'open',
 (select id from workgroups where project_id = (select project_id from demo_ctx) and name = 'Duurzaamheid' limit 1),
 pg_temp.wie('Emma Jansen'), now(), now() - interval '3 months'),

('c0000000-0000-4000-a000-000000000003', (select project_id from demo_ctx), 'group',
 'Gemeenschapsruimte', 'Inrichting van de gedeelde ruimtes', '🛋️', 'open',
 (select id from workgroups where project_id = (select project_id from demo_ctx) and name = 'Gemeenschapsruimte' limit 1),
 pg_temp.wie('Lotte de Jong'), now(), now() - interval '2 months');

insert into chat_participants (thread_id, profile_id, role, joined_at)
select 'c0000000-0000-4000-a000-000000000001', pg_temp.wie(n),
       case when n = 'Sophie van der Berg' then 'owner' else 'member' end,
       now() - interval '4 months'
from unnest(array['Sophie van der Berg','Daan de Vries','Emma Jansen','Liam Bakker','Julia Visser','Tessa Meijer','Jesse Dijkstra']) n
where pg_temp.wie(n) is not null;

insert into chat_participants (thread_id, profile_id, role, joined_at)
select 'c0000000-0000-4000-a000-000000000002', pg_temp.wie(n),
       case when n = 'Emma Jansen' then 'owner' else 'member' end,
       now() - interval '3 months'
from unnest(array['Emma Jansen','Fleur Mulder','Lucas Bos','Noah de Graaf','Sem Smit','Julia Visser']) n
where pg_temp.wie(n) is not null;

insert into chat_participants (thread_id, profile_id, role, joined_at)
select 'c0000000-0000-4000-a000-000000000003', pg_temp.wie(n),
       case when n = 'Lotte de Jong' then 'owner' else 'member' end,
       now() - interval '2 months'
from unnest(array['Lotte de Jong','Finn Hendriks','Noor Dekker','Iris van Dijk','Mees Vermeer','Lucas Bos']) n
where pg_temp.wie(n) is not null;

-- Berichten in chronologische volgorde: de trigger zet last_message_at telkens
-- op het laatst ingevoegde bericht.
insert into chat_messages (thread_id, sender_id, body, created_at) values
-- Bouwcommissie
('c0000000-0000-4000-a000-000000000001', pg_temp.wie('Sophie van der Berg'),
 'Het DO staat sinds gisteren in het projectdossier. Loop vooral je eigen plattegrond na, vooral de plek van de meterkast is bij een paar woningen verschoven.', now() - interval '3 days' - interval '5 hours'),
('c0000000-0000-4000-a000-000000000001', pg_temp.wie('Jesse Dijkstra'),
 'Gevonden, dank. Bij ons zit de meterkast nu in de hal in plaats van de berging. Dat scheelt ons een halve vierkante meter bergruimte, is daar nog iets aan te doen?', now() - interval '3 days' - interval '2 hours'),
('c0000000-0000-4000-a000-000000000001', pg_temp.wie('Sophie van der Berg'),
 'Ik neem het mee naar de bouwvergadering. De installateur heeft een reden gehad om te schuiven, maar ik wil weten of die reden voor alle woningen geldt.', now() - interval '3 days'),
('c0000000-0000-4000-a000-000000000001', pg_temp.wie('Tessa Meijer'),
 'Kunnen we ook vragen wanneer de meerprijzen voor de keuze-opties komen? Wij twijfelen tussen de open keuken en de standaardindeling en dat scheelt nogal in de begroting.', now() - interval '2 days'),
('c0000000-0000-4000-a000-000000000001', pg_temp.wie('Liam Bakker'),
 'Staat al op de agenda voor de 5e. Space&Matter levert de prijslijst een week van tevoren aan, dan kunnen we hem rustig doorlezen.', now() - interval '2 days' + interval '40 minutes'),
('c0000000-0000-4000-a000-000000000001', pg_temp.wie('Daan de Vries'),
 'Kleine vooruitblik: de vergunningsaanvraag gaat eind deze maand de deur uit. Als er nog fundamentele bezwaren tegen het ontwerp zijn, dan hoor ik ze deze week graag.', now() - interval '20 hours'),
('c0000000-0000-4000-a000-000000000001', pg_temp.wie('Julia Visser'),
 'Van mijn kant niet. Ik vind het rustiger geworden ten opzichte van het VO, vooral aan de waterkant.', now() - interval '6 hours'),

-- Duurzaamheid
('c0000000-0000-4000-a000-000000000002', pg_temp.wie('Emma Jansen'),
 'De derde offerte voor de warmtepomp is binnen. Ik heb alle drie in hetzelfde rekenmodel gezet, zodat we appels met appels vergelijken.', now() - interval '9 days'),
('c0000000-0000-4000-a000-000000000002', pg_temp.wie('Fleur Mulder'),
 'Wat is het verschil in maandlasten tussen de goedkoopste en de duurste?', now() - interval '9 days' + interval '25 minutes'),
('c0000000-0000-4000-a000-000000000002', pg_temp.wie('Emma Jansen'),
 'Ongeveer 14 euro per woning per maand, maar de duurste heeft wel tien jaar onderhoud inbegrepen. Over de looptijd is die juist gunstiger.', now() - interval '9 days' + interval '55 minutes'),
('c0000000-0000-4000-a000-000000000002', pg_temp.wie('Noah de Graaf'),
 'Dat onderhoudscontract is precies waar ik bij mijn vorige project spijt van had. We hebben toen goedkoop ingekocht en zaten na drie jaar met een storing die niemand wilde oppakken.', now() - interval '8 days'),
('c0000000-0000-4000-a000-000000000002', pg_temp.wie('Lucas Bos'),
 'Eens. Kunnen we dan wel afspreken dat we de responstijd in het contract vastleggen? Anders koop je onderhoud waar je niets aan hebt.', now() - interval '8 days' + interval '2 hours'),
('c0000000-0000-4000-a000-000000000002', pg_temp.wie('Emma Jansen'),
 'Genoteerd voor de sessie van volgende week. Het rekenmodel staat in het projectdossier, kijk vooral even mee voor ik het naar de ALV stuur.', now() - interval '2 days'),

-- Gemeenschapsruimte
('c0000000-0000-4000-a000-000000000003', pg_temp.wie('Lotte de Jong'),
 'We hebben 45.000 euro voor de inrichting van de gemeenschapsruimte. Ik stel voor dat we het opsplitsen: keuken, meubels, en een potje voor later als we merken wat we missen.', now() - interval '12 days'),
('c0000000-0000-4000-a000-000000000003', pg_temp.wie('Finn Hendriks'),
 'Goed idee, dat laatste potje vooral. Bij de vorige groep waar ik in zat hadden we alles in één keer uitgegeven en toen bleek de akoestiek niet te kloppen.', now() - interval '12 days' + interval '3 hours'),
('c0000000-0000-4000-a000-000000000003', pg_temp.wie('Iris van Dijk'),
 'Mag ik een suggestie doen voor de keuken? Neem een fornuis met zes pitten. Klinkt overdreven, maar zodra je met twintig man kookt is vier te weinig.', now() - interval '10 days'),
('c0000000-0000-4000-a000-000000000003', pg_temp.wie('Mees Vermeer'),
 'Ik ken iemand die tweedehands horecakeukens verkoopt, vaak nog in prima staat. Zal ik vrijblijvend een paar opties opvragen?', now() - interval '6 days'),
('c0000000-0000-4000-a000-000000000003', pg_temp.wie('Lotte de Jong'),
 'Graag! Neem de maten uit het DO mee, de keukenwand is 4,20 meter.', now() - interval '5 days'),
('c0000000-0000-4000-a000-000000000003', pg_temp.wie('Noor Dekker'),
 'Ik ben nieuw hier, maar ik heb jaren in de horeca gewerkt. Als jullie hulp kunnen gebruiken bij het beoordelen van die keukens, meld ik me graag.', now() - interval '1 day');

-- ----------------------------------------------------------------------------
-- 6. Adviseurs: twee bestaande leden krijgen een adviseursprofiel
--    (de pagina Organisatie leest profiles.professional_type)
-- ----------------------------------------------------------------------------
update profiles set
  professional_type = 'architect',
  company = 'Space&Matter',
  bio = 'Ontwerpt sinds 2014 aan collectieve woonprojecten in en om Amsterdam. Betrokken bij Demoproject vanaf de eerste schetsen.',
  website = 'https://www.spaceandmatter.nl'
where id = pg_temp.wie('Thomas Willems');

update profiles set
  professional_type = 'kostendeskundige',
  company = 'Bureau Kostenraming',
  bio = 'Bewaakt de begroting en rekent de meerprijzen van keuze-opties door. Aanwezig bij elke bouwvergadering.',
  website = null
where id = pg_temp.wie('Ruben Peters');

commit;
