# Besluitvorming — plan (ter akkoord)

Status: **akkoord 2026-11-06 — fase 1 in aanbouw.** Database (PR 1) staat live: migraties 112–115, edge function `decision-notify`.

### Gemaakte keuzes tijdens de bouw (wijkt af van/vult aan op onderstaand plan)
- **Breuken i.p.v. percentages** in `decision_rules` (`quorum_num/den`, `majority_regular_num/den`, `majority_heavy_num/den`). 2/3 van 18 is exact 12; met 66,67% zou het 13 worden. Gewone meerderheid is "meer dan", zware meerderheid "ten minste".
- **Stemgerechtigd** = rol member/moderator/admin, **zonder** org- en platformbeheerders. Die krijgen automatisch een admin-lidmaatschap als ze een project bezoeken en zouden anders het quorum vertekenen.
- **Notificaties** via een wachtrij `proposal_events` en een eigen worker `decision-notify` (verify_jwt uit, verwerkt alleen de wachtrij). `dispatch-notification` vereist een gebruikers-JWT en is dus niet vanuit de database aan te roepen. De mailopmaak en de voorkeuren (`pref_updates`) zijn hetzelfde als in `dispatch-notification`. Herinnering, vraag, antwoord en bezwaar gelden als persoonlijk en gaan ook bij de voorkeur "mentions" door.
- **Bewaker op proposals:** statusvelden zijn alleen te wijzigen via RPC's, met een vlag die maar één keer bruikbaar is (migratie 113, gevonden door de integratietest).
- **Tests:** `supabase/tests/decision_outcome.test.sql` (22 asserts, waaronder alle acceptatiecriteria) en `supabase/tests/decisions_integration.test.sql` (18 asserts: huishouden, laatste reactie telt, log, aspirant niet stemgerechtigd, zichtbaarheid, sluiten, reactie na deadline geweigerd). Beide draaien in een transactie met ROLLBACK.

## 1. Wat er al is en waar we op aansluiten

| Concept uit de opdracht | Wat er nu is | Keuze |
|---|---|---|
| Groep | `projects` (eigen subdomein, `features`-toggles) | Module = project-feature `decisions` |
| Lid | `memberships.role` (guest → admin) | Stemgerechtigd = rol **member en hoger** (zie vraag 1) |
| Commissie | `workgroups` met `type = 'commissie'` + `workgroup_members`, beheer in Organisatie → Groepen | Hergebruiken. Mandaat als kolommen op `workgroups` |
| Bestuur | Bestaat niet als groep; moderator/admin doen het werk | Nieuwe vlag `workgroups.is_board` (zie vraag 3) |
| Huishouden | **Bestaat niet.** Alleen `profiles.household` (vrije tekst: gezinssamenstelling) en `memberships.housing_unit` | Nieuwe tabel `households` (zie vraag 2) |
| Bijlagen | Patroon `update_attachments` + `uploadFile()` naar bucket `project-files` | Zelfde patroon: `proposal_attachments` |
| Notificaties | Edge function `dispatch-notification` (in-app + mail), CHECK-constraints op `notifications.type` | Nieuwe types toevoegen |
| Automatische sluiting | `pg_cron` + `pg_net` roepen edge functions aan (bv. `support-notify-email`, elke 5 min) | Zelfde patroon: `close-proposals` |
| Besluiten | Tabel `decisions` = losse tekstregels per vergadering (EventDetail) | Komen óók in de besluitenlijst, als vorm "Vergaderbesluit" |
| Peiling | Prikbord heeft al `poll_options` / `poll_votes` (informeel) | Laten staan. Peiling in de module (fase 2) is de "officiële" variant |
| Rechten | `canDo(role, action)`; er bestaat al een ongebruikte actie `record_decisions` | Nieuwe acties + RLS-helpers |

### Twee apps, één database

Buuur bestaat uit twee repo's op dezelfde Supabase-database:
- **community** (deze repo, Vite, `slug.buuur.nl`): de voorkant voor leden en commissieleden.
- **buuur-admin** (Next.js + shadcn, het CMS): voor org- en projectbeheerders (`org_members`, met `project_ids`-scope).

Wat dat betekent voor de verdeling: **commissieleden zijn gewone leden zonder toegang tot het CMS.** Het inbrengen van voorstellen moet dus in de community-app kunnen. Het CMS is voor de inrichting en het overzicht. Het bestuur kan ook vanuit het CMS inbrengen.

| | community (voorkant) | buuur-admin (CMS) |
|---|---|---|
| Lid | Open voorstellen, reageren, vragen stellen, besluitenlijst, dashboardblok | — |
| Commissie | Voorstel opstellen, publiceren, verlengen, intrekken; vragen beantwoorden; wie nog niet reageerde | — |
| Bestuur / beheerder | idem | Module aan/uit (Instellingen → module-toggles), **Besluitregels**, Groepen: bestuursvlag + mandaat, Ledendossiers: huishouden (naast de huidige `housing_unit`-tegel), voorstellen-overzicht met deelname en wie nog niet reageerde, mandaatbesluit registreren, besluitenlijst + export, inbrengen namens het bestuur |

De module-toggle `decisions` staat standaard **uit**: de inrichting gebeurt eenmalig in het CMS.

**Gevolg voor de techniek:** omdat er twee codebases zijn, staat alle beslislogica (quorum, meerderheid, consent, deadline, snapshot) in **Postgres-functies en RPC's**. Beide apps lezen alleen `outcome` en roepen RPC's aan. Zo kan de logica niet uit elkaar gaan lopen.

## 2. Datamodel

```
decision_rules          1 per project — de besluitregels
households              huishoudens per project
memberships.household_id
workgroups.is_board / mandate_amount / mandate_description
proposals               alle vormen in één tabel (idee, peiling, consent, stemming, mandaat)
proposal_options        opties voor peilingen (fase 2)
proposal_attachments    bijlagen
proposal_electorate     snapshot van stemgerechtigde eenheden bij publicatie
proposal_responses      huidige reactie per eenheid (1 rij per eenheid)
proposal_response_log   alle reactiewijzigingen (append-only, via trigger)
proposal_questions      vragenronde (vraag + antwoord namens commissie)
proposal_objection_replies  reactie per bezwaar bij een nieuwe versie (fase 2)
idea_supports           steun op ideeën (fase 2)
```

### decision_rules
`project_id (pk)`, `vote_unit` ('household' | 'person', standaard household), `default_form` ('consent' | 'vote', standaard consent), `quorum_pct` (66.67), `majority_regular_pct` (50, strikt groter dan), `majority_heavy_pct` (66.67, groter of gelijk), `heavy_categories text[]`, `default_duration_days` (7), `reminder_after_days` (3), `who_may_propose` ('committees' | 'members'), `tally_visibility` ('always' | 'after_own_vote'), `allow_overrule_objection` (false), `formal_online_decisions` (false → stemmingen zijn "voorbereidend"), `updated_at`, `updated_by`.
Bestaat er geen rij, dan gelden de standaardwaarden (de module werkt meteen).

### households
`id`, `project_id`, `name` ("Familie Jansen"), `housing_unit` (optioneel), `created_at`.
`memberships.household_id` nullable. **Een lid zonder huishouden telt als eenpersoonshuishouden**, dus er is geen verplichte inrichting. In Leden kan de beheerder leden koppelen; we stellen koppelingen voor op basis van dezelfde `housing_unit` of dezelfde achternaam.

### proposals
- `id`, `project_id`, `form` ('idea' | 'poll' | 'consent' | 'vote' | 'mandate')
- `workgroup_id` (namens welke commissie/bestuur; leeg bij idee/peiling van een lid), `created_by` (zichtbare indiener)
- `title`, `summary` (verplicht), `member_impact` (verplicht bij consent/stemming), `key_figures jsonb` ([{label, value}]), `body` (toelichting), `category`, `is_heavy`
- `status` ('draft' | 'published' | 'closed' | 'adopted' | 'rejected' | 'amended' | 'no_quorum' | 'withdrawn' | 'noted')
- `published_at`, `deadline`, `deadline_extended_at`, `deadline_extension_note` (max één verlenging), `withdrawn_reason`
- `rules_snapshot jsonb` (bij publicatie vastgezet), `electorate_size int` (vastgezet)
- `outcome jsonb` (tellingen, quorum, vereiste meerderheid, één-regel-samenvatting), `closed_at`
- `version`, `previous_version_id` (versie 2 → versie 1), `source_idea_id`, `reverts_proposal_id` (terugdraaien via nieuw voorstel)
- `picked_up_by_workgroup_id` (idee opgepakt)

Een vastgesteld voorstel is via een trigger niet meer te bewerken.

### Reageren: één RPC, alle regels in de database
`cast_response(proposal_id, choice, motivation)` (SECURITY DEFINER) controleert:
1. status `published` en `now() < deadline`, anders de fout *"De reactietermijn is verlopen"* (deadline valt tijdens het typen → nette melding);
2. dat de gebruiker in de snapshot `proposal_electorate` zit (wie later toetreedt, stemt niet mee; wie vertrekt, verliest zijn stem niet automatisch, zie vraag 1);
3. dat de keuze past bij de vorm, en dat er een motivatie is bij een bezwaar;
4. bepaalt de eenheid (huishouden of persoon) en doet een upsert op `proposal_responses (proposal_id, unit_id)`. De laatste reactie telt, `responded_by` laat zien wie namens het huishouden reageerde;
5. de trigger schrijft elke wijziging naar `proposal_response_log` (wie, wat, wanneer, vorige keuze).

Een commissielid stemt gewoon als lid. Indienen namens de commissie heeft daar geen invloed op.

### Zichtbaarheid (RLS + RPC)
- Concepten: alleen leden van de indienende groep plus moderators en admins.
- Tellingen: via de RPC `proposal_tally(id)`. Die geeft bij `after_own_vote` en bij peilingen alleen aantallen terug (eenheden, gereageerd, quorum) zolang je zelf nog niet reageerde.
- "Wie nog niet reageerde": de RPC `proposal_pending_units(id)`, alleen voor de indienende groep, moderators en admins.
- Individuele keuzes van anderen zijn niet zichtbaar. Bezwaren met motivatie wel, want dat vraagt de opdracht.

## 3. Beslislogica — in de database, getest

`decision_outcome(form, rules jsonb, electorate int, counts jsonb, overruled int)` is een pure, `IMMUTABLE` SQL-functie. Gebruikt door:
- `close_due_proposals()` (de uitkomst die geldt, aangeroepen door de cron), en
- de RPC `proposal_tally(id)` (de tussenstand in beide apps: "quorum gehaald", "nu aangenomen bij deze stand").

Tests: `supabase/tests/decision_outcome.test.sql`, een reeks `DO`-blokken met `ASSERT` die in een transactie draait en daarna een rollback doet. Draaien via `npm run test:db` (psql) of via de Supabase MCP. De acceptatiecriteria uit de opdracht worden letterlijk testgevallen:

| Geval | Uitkomst |
|---|---|
| 18 eenheden, quorum 2/3, 11 reacties (7/3/1) | `no_quorum` (11 < 12) |
| idem, 12 reacties (8/3/1) | `adopted` (8/11 = 72,7% > 50%) |
| zwaar besluit, 12 reacties (7/4/1) | `rejected` (7/11 = 63,6% < 66,7%) |
| consent, 14 akkoord, 0 bezwaar, quorum gehaald | `adopted` |
| consent, 1 bezwaar | `amended` |
| consent, bezwaar gepasseerd met motivatie | `adopted`, met het gepasseerde bezwaar zichtbaar |

Definities: quorum = reacties (inclusief onthouding / kan ermee leven) ≥ ⌈quorum% × eenheden⌉. Meerderheid gewoon = voor / (voor + tegen) **>** 50%. Zwaar = **≥** 2/3. Bij voor + tegen = 0 wordt het `rejected`. Afronding van percentages gebeurt op hele eenheden, zodat 2/3 van 18 precies 12 is (geen floating-point-fout).

### Sluiting en herinneringen
`pg_cron` roept elke 5 minuten `close_due_proposals()` aan, in pure SQL en idempotent:
1. sluit voorstellen met `deadline <= now()`, berekent `outcome` en zet de status;
2. markeert de herinneringen die verstuurd moeten worden;
3. stuurt daarna via `pg_net` een seintje naar `dispatch-notification` voor de mails en in-app-meldingen (eenmalig per voorstel, via `notification_log`).

De deadline zelf wordt hard afgedwongen door de RPC. De cron kan tot 5 minuten na-ijlen; de UI toont het voorstel dan al als gesloten.

## 4. Statussen

```
draft ──publiceer──▶ published ──deadline──▶ (berekend) adopted | rejected | amended | no_quorum
  │                     │   └─ verleng (1×, met notitie)
  │                     └─ trek in (reden) ──▶ withdrawn
mandate ──registreer──▶ noted (direct in de besluitenlijst, zonder reactieronde)
poll ──deadline──▶ closed (uitslag, niet bindend)
idea  (geen deadline) ── oppakken ──▶ label | omzetten ──▶ nieuw proposal (source_idea_id)
amended / no_quorum ── nieuwe versie ──▶ draft v2 (previous_version_id); reacties op v1 vervallen
```

## 5. Schermen

### buuur-admin (CMS)
Nieuw item **Besluiten** in de projectsidebar, groep *Communicatie* (of een eigen groep *Besluitvorming*), alleen zichtbaar als de module aan staat:
- `/projecten/[slug]/besluiten`: tabel met alle voorstellen (status, vorm, groep, deelname x/y, deadline) en tabs *Lopend · Concepten · Besluitenlijst*. Export naar CSV/PDF.
- `/projecten/[slug]/besluiten/[id]`: voorstel met tellingen, wie nog niet reageerde (met e-mail/telefoon om na te bellen), de reactielog, en de acties verlengen en intrekken.
- `/projecten/[slug]/besluiten/regels`: het formulier met de besluitregels, met een rekenvoorbeeld ("Bij 18 huishoudens zijn 12 reacties nodig") en de melding dat wijzigingen alleen voor nieuwe voorstellen gelden.
- Groepen-detail: vinkje "Dit is het bestuur" + mandaat (bedrag/omschrijving).
- Ledendossier: tegel Huishouden (naast Woning), plus de knop "Koppel aan huishouden"; voorstellen op basis van dezelfde `housing_unit`.
- Module-toggle `decisions` in Instellingen.
- Helpers in `src/lib/db/decisions.ts`, shadcn-componenten, Server Components waar dat kan (volgens de conventies van buuur-admin).

### community (voorkant)

**Navigatie:** nieuw item *Besluiten* (`fa-solid fa-check-to-slot`) in de sectie *Project*, alleen als `featureEnabled('decisions')`. Badge via `useSidebarSignals` met het aantal open voorstellen dat op jouw reactie wacht.

**/besluiten** — tabs (ClusterTabs, deelbaar via `?tab=`):
- *Open*: bovenaan "Wacht op jouw reactie", per kaart je eigen status, resterende tijd en de quorumbalk.
- *Ideeën* (fase 2): gesorteerd op steun.
- *Besluitenlijst*: zoeken, filters (vorm, commissie, periode), export (fase 2). Inclusief vergaderbesluiten uit Events.
- *Commissie* (alleen voor commissie- en bestuursleden en moderators+): concepten, lopende voorstellen van mijn groep, met wie nog niet reageerde.

**/besluiten/:id** — leesvolgorde uit de opdracht: titel → in het kort → wat betekent dit voor de leden (kerncijfers als kleine stat-tegels) → toelichting (ingeklapt) → bijlagen → reactiepaneel (grote knoppen, motivatieveld bij bezwaar, "Familie Jansen reageerde: Voor — door Anna, di 14:02") → tussenstand → vragenronde. Beheeracties rechtsboven als 32×32-iconknoppen (verlengen, intrekken, nieuwe versie), volgens de Clean DS-modalregel.

**Editor** (modal, max-width 720px): eerst de vorm kiezen (standaard uit de regels), daarna de velden in leesvolgorde. Een live preview "zo ziet het lid het" is een kleine meerwaarde die het "In het kort"-veld scherp houdt. Bij een categorie uit `heavy_categories` staat "zwaar besluit" automatisch aan en is het niet uit te zetten.

**Dashboard:** een blok "Wacht op jouw reactie" (alleen als er iets openstaat), in de Fris-look naast FrisWeek.

De besluitregels, huishoudens, de bestuursvlag en het mandaat worden **niet** in de community-app beheerd, maar in het CMS. In de community-app zijn ze alleen te lezen (bijvoorbeeld "Stemmen per huishouden · quorum 2/3" onder elk voorstel).

## 6. Notificaties (nieuwe types in dispatch-notification)
`proposal_published` (stemgerechtigden), `proposal_reminder` (alleen eenheden zonder reactie, alle leden van het huishouden), `proposal_question` (indienende groep), `proposal_answered` (vraagsteller), `proposal_objection` (indienende groep), `proposal_closed` (iedereen, met de uitkomst in één regel), `proposal_new_version` (iedereen, met de samenvatting van de wijzigingen). Plus de CHECK-constraints uitbreiden (zie de les uit migratie 107).

## 7. Fasering
**Fase 1 (MVP)**, in drie PR's:
1. *Database* (community-repo, `supabase/migrations/`): tabellen, RLS, RPC's, `decision_outcome` + SQL-tests, `close_due_proposals` + cron, notificatietypes.
2. *buuur-admin*: module-toggle, besluitregels, huishoudens in het ledendossier, bestuursvlag en mandaat bij groepen, voorstellenoverzicht + besluitenlijst.
3. *community*: Besluiten-pagina (Open + Besluitenlijst + Commissie-tab), detailpagina met reactiepaneel en vragenronde, editor, dashboardblok, sidebarbadge, notificaties, demo-data.
**Fase 2:** ideeën en steun, oppakken en omzetten, peilingen, nieuwe versie na bezwaren met reactie per bezwaar, mandaatbesluiten, CSV/PDF-export (pdf-lib zit al in de dependencies).
**Fase 3:** ALV-laag (volmachten, stemgewicht, gekwalificeerde besluiten, e-handtekening; de SignaturePad bestaat al).

## 8. Open vragen
1. **Stemgerechtigd:** alleen rol member en hoger (aspiranten en professionals niet)? En houdt iemand die tijdens een voorstel vertrekt zijn stem? (Mijn voorstel: snapshot bij publicatie; wie vertrekt, verliest de toegang en dus de mogelijkheid om te reageren, maar een al uitgebrachte stem blijft staan.)
2. **Huishoudens:** akkoord met een nieuwe entiteit, waarbij een lid zonder huishouden als eenpersoonshuishouden telt?
3. **Bestuur:** als vlag op een bestaande groep, of zijn alle moderators en admins automatisch "het bestuur"?
4. **Vergaderbesluiten** uit Events ook in de besluitenlijst tonen?
5. **Module standaard uit** per project (aanzetten in het org-dashboard)?
