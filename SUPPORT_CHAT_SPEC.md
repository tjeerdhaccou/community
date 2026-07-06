# Support Chat — Implementatiespec

Async support-chat voor het buuur-platform. Doel: vragen uit de e-mailinbox halen door ze in-app af te handelen, met goede notificaties als duwtje terug.

**Scope v1:** alleen ingelogde leden. Geen anonieme bezoekers, geen e-mailcapture.
**Aanpak:** async-first (géén "agent moet online zijn"). Bezoeker stelt vraag → agent antwoordt wanneer het kan → gebruiker krijgt notificatie + e-mail met deeplink terug.

**Twee apps, één backend** (cruciaal voor "slim koppelen"):
- **Lid-kant (de chat-widget):** community-app (deze repo, React + Vite + Clean DS).
- **Agent-kant (de inbox):** buuur-admin (aparte Next.js + shadcn). Start centraal: platform-/orgbeheer beantwoordt alles vanuit één inbox.
- Beide praten met **dezelfde Supabase** → de tabellen/RLS/realtime/edge-function hieronder zijn gedeeld en gelden voor beide.
- **Later (optioneel):** project-moderators eigen vragen laten beantwoorden. Zij gebruiken geen buuur-admin → dan een lichte inbox toevoegen in de community-app (Clean DS) op dezelfde tabellen. RLS staat dit al toe (`has_membership(project_id, 4)`), dus puur UI-werk.

---

## 1. Principes

- Hergebruik bestaande patronen: hooks (`useNotifications.js`), Realtime (`supabase.channel()`), RLS-helpers (`is_platform_admin`, `is_org_admin`, `has_membership`), `dispatch-notification` edge function (Resend).
- Gesprekken zijn **gescoped op project/org** zodat de juiste moderator/admin ze ziet — niet alles naar platform-admin.
- Styling per app: widget = CrowdBuilding-branding (§5), agent-inbox = shadcn (§6). Overal: geen gekleurde of donkere side-stripes/randjes — vlakken volledig kleuren of niet.

---

## 2. Datamodel

Nieuwe migratie (volgende vrije nummer, bijv. `0XX_support_chat.sql`).

```sql
-- Gesprek = één support-thread van één gebruiker
create table support_conversations (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references profiles(id) on delete cascade,
  project_id    uuid references projects(id) on delete set null,  -- context waar widget geopend werd
  org_id        uuid references organizations(id) on delete set null,
  subject       text,                                             -- optioneel, eerste regel of leeg
  status        text not null default 'open',                     -- open | closed
  assigned_to   uuid references profiles(id) on delete set null,  -- optioneel in v1
  last_message_at timestamptz not null default now(),
  created_at    timestamptz not null default now()
);

create table support_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references support_conversations(id) on delete cascade,
  sender_id       uuid not null references profiles(id) on delete cascade,
  sender_role     text not null,                                  -- 'user' | 'agent'
  body            text not null,
  read_at         timestamptz,                                    -- gelezen door de andere kant
  created_at      timestamptz not null default now()
);

create index on support_conversations (status, last_message_at desc);
create index on support_conversations (project_id);
create index on support_conversations (org_id);
create index on support_messages (conversation_id, created_at);
```

Realtime aanzetten op beide tabellen (`alter publication supabase_realtime add table ...`).

---

## 3. RLS

Geïmplementeerd in migratie `080_support_chat.sql`. Kern: helper `can_handle_support(p_project_id, p_org_id)` = `is_platform_admin()` OR `is_org_admin(org)` OR `has_membership(project, 'moderator')`. Let op: `has_membership` neemt een **rolnaam** (`'moderator'`), geen getal.

Policies: eigenaar ziet/maakt/wijzigt eigen gesprekken; agents (via `can_handle_support`) zien en beantwoorden gesprekken in hun scope. Berichten erven de zichtbaarheid van hun gesprek. `sender_role` wordt door een **trigger** gezet (niet vertrouwen op de client), en een tweede trigger bumpt `last_message_at` + heropent een gesloten gesprek bij een nieuw lid-bericht.

---

## 4. Data-laag

Bij `sendMessage`/`reply`: bericht inserten, `last_message_at` op het gesprek bijwerken (of via DB-trigger), daarna `notifyNewSupportMessage()` aanroepen (best-effort, zie §7).

**Lid-kant (community-app):** hook `useSupportConversation()` volgens het standaard hook-patroon. Haalt (of maakt) het open gesprek van de huidige user op + berichten, Realtime-subscription op `support_messages` gefilterd op `conversation_id`. `sendMessage(body)`.

**Agent-kant (buuur-admin):** eigen data-laag (React Query/SWR + Supabase JS), zelfde tabellen. Lijst van gesprekken in scope (open eerst, op `last_message_at`), Realtime op `support_conversations` + `support_messages`. `openConversation(id)`, `reply(id, body)`, `assign(id, agentId)`, `closeConversation(id)`.

---

## 5. Frontend — widget

- **Styling:** hergebruik de bestaande platform-stylesheet (`clean-tokens.css` + `clean-components.css`), niet losse branding. Concreet: `.cl-fab` voor de bubbel, `.cl-card`/`.cl-input`/`.cl-tag` voor de rest, system-font. Kleuren volledig token-gedreven zodat de widget automatisch meekleurt met `ThemeContext` (blauw op default, coral op crowdbuilding-thema, + dark).
  - **Bubbel (FAB), verstuurknop en eigen berichten:** `var(--accent-cta)` — dus blauw op het default-thema (matcht 'Nieuw event'/'Aanmelden'), níét hardcoded coral.
  - **Ongelezen-badge:** `var(--notif-bg)` (coral/rood), consistent met de bestaande notificatie-badges.
- Component `src/components/SupportChat/SupportWidget.jsx` (FAB + panel), gemonteerd in de app-shell (binnen `AuthProvider`), alleen tonen als ingelogd.
- Speech-bubble FAB rechtsonder (Font Awesome `fa-comment-dots`), `position: fixed`, respecteer safe-area op mobiel.
- Panel: berichtenlijst + invoerveld. Toont presence/verwachting: "We reageren meestal binnen één werkdag."
- **Deeplink:** query-param `?support=<conversation_id>` opent de widget en scrollt naar het gesprek (gebruikt door notificatie-mails).
- Context meegeven: lees `project_id`/`org_id` uit de huidige route/context bij aanmaken van het gesprek, zodat routing klopt.

---

## 6. Agent-inbox (buuur-admin, shadcn)

Nieuwe route in buuur-admin (bijv. `/support`), bereikbaar voor platform-/orgbeheer.
- Layout: sidebar + gesprekkenlijst + actieve thread + context-rail. Filters via `Tabs`: open / aan mij / gesloten, per project/org.
- shadcn-componenten: `Sidebar`, `Tabs`, `Badge`, `Button`, `Avatar`, `Textarea`, `ScrollArea`, evt. `Command` voor zoeken.
- Project-koppeling zichtbaar als `Badge` per gesprek + context-rail (wie, rol, project, lid sinds, recente activiteit, interne notitie).
- Ongelezen-count als `Badge` op het Support-nav-item.
- Acties in thread-header: Toewijzen, Oplossen, Sluiten.

Mockup-referentie (shadcn): zie de gepubliceerde Artifact uit deze sessie.

---

## 7. Notificaties (de e-mail-killer)

Nieuw type `new_support_message` toevoegen aan `dispatch-notification` (en aan `notification_preferences`-types).

**Recipient-resolutie per richting:**
- **User → agents:** ontvangers = agents in scope van het gesprek (platform-admins, org-admins van `org_id`, moderators+ van `project_id`). In-app notificatie + badge. E-mail optioneel/dienstdoend.
- **Agent → user:** ontvanger = `conversation.user_id`. In-app notificatie + e-mail "Je hebt antwoord op je vraag" met deeplink `…?support=<id>`.

**Debounce (cruciaal):** stuur niet bij élk bericht een mail. Mail alleen als de ontvanger in de laatste **X minuten** (start: 10) geen ongelezen support-notificatie heeft gehad én het gesprek niet open heeft staan. Gebruik de bestaande `notification_log`-idempotency hiervoor.

**Mark-as-read:** als de ontvanger het gesprek opent, zet `read_at` op de berichten van de andere kant → onderdrukt de mail.

Templates: nieuwe transactionele mail in `send-member-email`-stijl (Resend), met unsubscribe-token zoals bestaande mails.

---

## 8. Bouwvolgorde

1. **Supabase:** migratie — tabellen + RLS + `can_handle_support` + Realtime aanzetten. (gedeeld fundament)
2. **Community-app:** `useSupportConversation` + `SupportWidget` (versturen + live ontvangen, nog zonder notificaties).
3. **buuur-admin:** `/support`-route met inbox in shadcn (agents kunnen antwoorden + toewijzen + sluiten).
4. **Supabase:** `new_support_message` in `dispatch-notification` + debounce + deeplink-mail.
5. Ongelezen-badges (admin-nav + inbox) en mark-as-read in beide apps.
6. Polish: presence/verwachtingstekst, mobiel (widget), lege staten.

---

## 9. Gebouwd na v1 (juli 2026)

- **Notificaties** — lid krijgt agent-antwoorden via 3 kanalen: bolletje op de bubbel, belletje-bovenin (migratie 081: `notifications`-trigger + type/related_type verbreed; klik opent widget), en e-mail met debounce (edge-function `support-notify-email` + pg_cron elke 5 min, migratie 082; mailt na 10 min ongelezen, idempotent via `notification_log`).
- **Agent-kant:** unread-badge op de Support-nav in de CMS.
- **Bijlagen** (afbeelding/PDF) — migratie 083: kolommen op `support_messages` + private bucket `support-attachments` met RLS; upload + weergave (signed URL) in beide apps.
- **Emoji** — picker in beide composers.

## 10. Nog open / later

- Agent-kant **e-mail** naar dienstdoende (nu alleen in-app nav-badge).
- AI-deflectie: auto-antwoord uit FAQ (via AI Gateway). Pas bij volume.
- Toewijzing/SLA, interne notities, gesprekslabels.
- Anonieme/publieke bezoekers met e-mailcapture.
- Branches mergen naar `main` (productie-deploy) na akkoord.
