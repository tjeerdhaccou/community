-- ============================================================================
-- 099_member_chat.sql
-- Ledenchat: 1-op-1-gesprekken (direct) en thema-groepen (group) tussen leden
-- binnen een project. Staat náást de support-chat (080–087); de community-app
-- toont beide bronnen in één gesprekkenlijst. Zie community-chat-groepen-plan.md
-- (buuur-admin-repo) voor de besluiten.
--
-- Kernregels
--   * Chatten mag vanaf rol 'member' (aspirant/gast/professional: alleen support).
--   * Wie groepen mag aanmaken is per project instelbaar (projects.chat_group_creation).
--   * Beheer (org-admin / moderator+ / platform-admin) kan groepsgesprekken lezen
--     en modereren; DM's zijn voor niemand anders dan de twee deelnemers zichtbaar.
--   * Alle writes gaan client-side met anon-key + RLS. Threads mét deelnemers
--     worden via SECURITY DEFINER RPC's aangemaakt (je bent pas deelnemer ná de insert).
--   * Elke policy gaat via security-definer-helpers, nooit via subselects op de
--     chat-tabellen zelf (RLS-recursie, zie migratie 098).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. Projectinstellingen
-- ----------------------------------------------------------------------------

-- Wie mag thema-groepen aanmaken: elk lid (member+) of alleen moderator+.
-- De module zelf staat aan/uit via projects.features->>'chat' (default aan,
-- zoals alle features).
alter table projects
  add column if not exists chat_group_creation text not null default 'members'
  check (chat_group_creation in ('members', 'moderators'));

comment on column projects.chat_group_creation is
  'Ledenchat: wie mag thema-groepen aanmaken. members = elk lid (member+), moderators = alleen moderator/admin.';

-- ----------------------------------------------------------------------------
-- 1. Tabellen
-- ----------------------------------------------------------------------------

create table chat_threads (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references projects(id) on delete cascade,
  kind            text not null check (kind in ('direct', 'group')),
  title           text,                                          -- alleen group
  topic           text,                                          -- thema / korte beschrijving
  emoji           text,
  join_policy     text not null default 'invite'
                  check (join_policy in ('open', 'invite')),     -- open = vindbaar + zelf aansluiten
  workgroup_id    uuid references workgroups(id) on delete set null,
  direct_key      text unique,                                   -- '<project>:<idA>:<idB>' gesorteerd → één DM per paar
  created_by      uuid references profiles(id) on delete set null,
  archived_at     timestamptz,
  last_message_at timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  -- Een groep heeft een titel; een DM heeft een direct_key.
  constraint chat_threads_shape check (
    (kind = 'group'  and title is not null and length(trim(title)) > 0)
    or
    (kind = 'direct' and direct_key is not null)
  )
);

create table chat_participants (
  thread_id    uuid not null references chat_threads(id) on delete cascade,
  profile_id   uuid not null references profiles(id) on delete cascade,
  role         text not null default 'member' check (role in ('owner', 'member')),
  last_read_at timestamptz not null default now(),               -- unread = berichten ná dit moment van anderen
  muted_until  timestamptz,
  joined_at    timestamptz not null default now(),
  primary key (thread_id, profile_id)
);

create table chat_messages (
  id              uuid primary key default gen_random_uuid(),
  thread_id       uuid not null references chat_threads(id) on delete cascade,
  sender_id       uuid not null references profiles(id) on delete cascade,
  body            text not null default '',
  attachment_path text,
  attachment_name text,
  attachment_type text,
  reply_to        uuid references chat_messages(id) on delete set null,
  edited_at       timestamptz,
  deleted_at      timestamptz,                                   -- soft delete ("Bericht verwijderd")
  created_at      timestamptz not null default now(),
  constraint chat_messages_not_empty check (length(body) > 0 or attachment_path is not null)
);

create index chat_threads_project_idx      on chat_threads (project_id, last_message_at desc);
create index chat_threads_workgroup_idx    on chat_threads (workgroup_id) where workgroup_id is not null;
create index chat_participants_profile_idx on chat_participants (profile_id);
create index chat_messages_thread_idx      on chat_messages (thread_id, created_at);
create index chat_messages_sender_idx      on chat_messages (sender_id);

-- ----------------------------------------------------------------------------
-- 2. Helpers (security definer, stable) — de enige plek waar policies naar
--    chat-tabellen kijken.
-- ----------------------------------------------------------------------------

-- Is de module aan voor dit project? features->>'chat' ontbreekt = aan.
create or replace function chat_enabled(p_project_id uuid)
returns boolean
language sql security definer stable
set search_path = ''
as $$
  select coalesce(
    (select coalesce((p.features->>'chat')::boolean, true) from public.projects p where p.id = p_project_id),
    false
  );
$$;

-- Heeft gebruiker X (niet per se auth.uid()) chatrecht in dit project? → rol member+
create or replace function chat_member_ok(p_project_id uuid, p_profile_id uuid)
returns boolean
language sql security definer stable
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.project_id = p_project_id
      and m.profile_id = p_profile_id
      and m.role in ('member', 'moderator', 'admin')
  );
$$;

-- Mag de huidige gebruiker chat modereren in dit project?
create or replace function can_moderate_chat(p_project_id uuid)
returns boolean
language sql security definer stable
set search_path = ''
as $$
  select
    public.is_platform_admin()
    or public.has_membership(p_project_id, 'moderator')
    or exists (
      select 1 from public.projects p
      where p.id = p_project_id and public.is_org_admin(p.organization_id)
    );
$$;

create or replace function is_chat_participant(p_thread_id uuid)
returns boolean
language sql security definer stable
set search_path = ''
as $$
  select exists (
    select 1 from public.chat_participants cp
    where cp.thread_id = p_thread_id and cp.profile_id = auth.uid()
  );
$$;

create or replace function is_chat_owner(p_thread_id uuid)
returns boolean
language sql security definer stable
set search_path = ''
as $$
  select exists (
    select 1 from public.chat_participants cp
    where cp.thread_id = p_thread_id and cp.profile_id = auth.uid() and cp.role = 'owner'
  );
$$;

create or replace function chat_thread_project(p_thread_id uuid)
returns uuid
language sql security definer stable
set search_path = ''
as $$
  select t.project_id from public.chat_threads t where t.id = p_thread_id;
$$;

-- Zichtbaarheid van een thread voor de huidige gebruiker. Dit is dé regel:
--   deelnemer                                             → ja (DM en groep)
--   open groep, niet gearchiveerd, ik ben lid (member+)   → ja (Ontdek groepen)
--   groep en ik mag modereren                              → ja (beheer leest mee)
--   DM waar ik niet in zit                                 → nee, voor niemand
create or replace function chat_thread_visible(p_thread_id uuid)
returns boolean
language sql security definer stable
set search_path = ''
as $$
  select exists (
    select 1 from public.chat_threads t
    where t.id = p_thread_id
      and (
        public.is_chat_participant(t.id)
        or (t.kind = 'group' and t.join_policy = 'open' and t.archived_at is null
            and public.has_membership(t.project_id, 'member'))
        or (t.kind = 'group' and public.can_moderate_chat(t.project_id))
      )
  );
$$;

-- Mag de huidige gebruiker in deze thread posten?
create or replace function chat_can_post(p_thread_id uuid)
returns boolean
language sql security definer stable
set search_path = ''
as $$
  select exists (
    select 1 from public.chat_threads t
    where t.id = p_thread_id
      and t.archived_at is null
      and public.is_chat_participant(t.id)
      and public.chat_enabled(t.project_id)
      and (public.chat_member_ok(t.project_id, auth.uid()) or public.can_moderate_chat(t.project_id))
  );
$$;

revoke execute on function chat_enabled(uuid)            from public, anon;
revoke execute on function chat_member_ok(uuid, uuid)    from public, anon;
revoke execute on function can_moderate_chat(uuid)       from public, anon;
revoke execute on function is_chat_participant(uuid)     from public, anon;
revoke execute on function is_chat_owner(uuid)           from public, anon;
revoke execute on function chat_thread_project(uuid)     from public, anon;
revoke execute on function chat_thread_visible(uuid)     from public, anon;
revoke execute on function chat_can_post(uuid)           from public, anon;
grant  execute on function chat_enabled(uuid), chat_member_ok(uuid, uuid), can_moderate_chat(uuid),
                           is_chat_participant(uuid), is_chat_owner(uuid), chat_thread_project(uuid),
                           chat_thread_visible(uuid), chat_can_post(uuid)
       to authenticated;

-- ----------------------------------------------------------------------------
-- 3. Triggers
-- ----------------------------------------------------------------------------

-- last_message_at bijwerken bij elk nieuw bericht (zoals support_bump_conversation).
create or replace function chat_bump_thread()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  update public.chat_threads
    set last_message_at = new.created_at
  where id = new.thread_id;
  return new;
end;
$$;

create trigger chat_messages_bump
  after insert on chat_messages
  for each row execute function chat_bump_thread();

-- Een DM heeft nooit meer dan twee deelnemers.
create or replace function chat_direct_guard()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_kind text;
  v_n    int;
begin
  select kind into v_kind from public.chat_threads where id = new.thread_id;
  if v_kind = 'direct' then
    select count(*) into v_n from public.chat_participants where thread_id = new.thread_id;
    if v_n >= 2 then
      raise exception 'Een 1-op-1-gesprek heeft precies twee deelnemers';
    end if;
  end if;
  return new;
end;
$$;

create trigger chat_participants_direct_guard
  before insert on chat_participants
  for each row execute function chat_direct_guard();

-- Deelnemer-update: alleen eigen leesmarkering/dempen; rol wijzigen mag alleen
-- de owner of een moderator. Sleutelvelden zijn onveranderlijk.
create or replace function chat_participants_guard_update()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if new.thread_id <> old.thread_id or new.profile_id <> old.profile_id or new.joined_at <> old.joined_at then
    raise exception 'Deelnemer-sleutel kan niet gewijzigd worden';
  end if;
  if new.role <> old.role
     and not (public.is_chat_owner(old.thread_id) or public.can_moderate_chat(public.chat_thread_project(old.thread_id))) then
    raise exception 'Alleen de eigenaar of een moderator kan rollen wijzigen';
  end if;
  return new;
end;
$$;

create trigger chat_participants_guard
  before update on chat_participants
  for each row execute function chat_participants_guard_update();

-- Bericht-update: afzender mag body/edited_at/deleted_at aanpassen; een moderator
-- die niet de afzender is mag uitsluitend deleted_at zetten. Rest is bevroren.
create or replace function chat_messages_guard_update()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if new.thread_id <> old.thread_id or new.sender_id <> old.sender_id
     or new.created_at <> old.created_at or new.reply_to is distinct from old.reply_to
     or new.attachment_path is distinct from old.attachment_path then
    raise exception 'Deze velden van een bericht zijn onveranderlijk';
  end if;

  if old.sender_id <> auth.uid() then
    -- Moderator: alleen (on)verwijderen.
    if new.body <> old.body or new.edited_at is distinct from old.edited_at
       or new.attachment_name is distinct from old.attachment_name
       or new.attachment_type is distinct from old.attachment_type then
      raise exception 'Alleen de afzender kan een bericht bewerken';
    end if;
  elsif new.body <> old.body then
    new.edited_at := now();
  end if;

  return new;
end;
$$;

create trigger chat_messages_guard
  before update on chat_messages
  for each row execute function chat_messages_guard_update();

-- Eenvoudige spam-rem: max 30 berichten per minuut per gebruiker.
create or replace function chat_rate_limit()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_n int;
begin
  select count(*) into v_n
  from public.chat_messages
  where sender_id = new.sender_id and created_at > now() - interval '1 minute';
  if v_n >= 30 then
    raise exception 'Je verstuurt te veel berichten achter elkaar. Wacht even.';
  end if;
  return new;
end;
$$;

create trigger chat_messages_rate_limit
  before insert on chat_messages
  for each row execute function chat_rate_limit();

revoke execute on function chat_bump_thread()               from public, anon, authenticated;
revoke execute on function chat_direct_guard()              from public, anon, authenticated;
revoke execute on function chat_participants_guard_update() from public, anon, authenticated;
revoke execute on function chat_messages_guard_update()     from public, anon, authenticated;
revoke execute on function chat_rate_limit()                from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 4. RLS
-- ----------------------------------------------------------------------------

alter table chat_threads      enable row level security;
alter table chat_participants enable row level security;
alter table chat_messages     enable row level security;

-- Threads ---------------------------------------------------------------------
create policy "chat_threads_select" on chat_threads for select
  using (chat_thread_visible(id));

-- Insert alleen via RPC (security definer). Geen insert-policy = dicht.

-- Titel/topic/emoji/join_policy/archiveren: owner of moderator, alleen groepen.
create policy "chat_threads_update" on chat_threads for update
  using  (kind = 'group' and (is_chat_owner(id) or can_moderate_chat(project_id)))
  with check (kind = 'group' and (is_chat_owner(id) or can_moderate_chat(project_id)));

-- Geen delete-policy: archiveren i.p.v. verwijderen.

-- Deelnemers --------------------------------------------------------------------
create policy "chat_participants_select" on chat_participants for select
  using (chat_thread_visible(thread_id));

-- Zelf aansluiten bij een open groep. Alles anders (DM's, besloten groepen,
-- uitnodigen) loopt via de RPC's.
create policy "chat_participants_self_join" on chat_participants for insert
  with check (
    profile_id = auth.uid()
    and role = 'member'
    and exists (
      select 1 from chat_threads t
      where t.id = thread_id
        and t.kind = 'group'
        and t.join_policy = 'open'
        and t.archived_at is null
        and chat_enabled(t.project_id)
        and chat_member_ok(t.project_id, auth.uid())
    )
  );

-- Eigen rij bijwerken (last_read_at, muted_until). Rolwissel wordt door de
-- guard-trigger beperkt tot owner/moderator.
create policy "chat_participants_update_own" on chat_participants for update
  using  (profile_id = auth.uid())
  with check (profile_id = auth.uid());

-- Verlaten (zelf), of verwijderd worden door owner/moderator.
create policy "chat_participants_delete" on chat_participants for delete
  using (
    profile_id = auth.uid()
    or is_chat_owner(thread_id)
    or can_moderate_chat(chat_thread_project(thread_id))
  );

-- Berichten -------------------------------------------------------------------
create policy "chat_messages_select" on chat_messages for select
  using (chat_thread_visible(thread_id));

create policy "chat_messages_insert" on chat_messages for insert
  with check (sender_id = auth.uid() and chat_can_post(thread_id));

-- Afzender bewerkt/verwijdert eigen bericht; moderator mag groepsberichten
-- soft-deleten (de guard-trigger beperkt wát een moderator mag wijzigen).
create policy "chat_messages_update" on chat_messages for update
  using (
    sender_id = auth.uid()
    or exists (
      select 1 from chat_threads t
      where t.id = thread_id and t.kind = 'group' and can_moderate_chat(t.project_id)
    )
  );

-- Geen delete-policy: soft delete via deleted_at.

-- ----------------------------------------------------------------------------
-- 5. RPC's
-- ----------------------------------------------------------------------------

-- Start (of hervat) een 1-op-1-gesprek met een ander projectlid.
create or replace function chat_start_direct(p_project_id uuid, p_other_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me   uuid := auth.uid();
  v_key  text;
  v_conv uuid;
begin
  if v_me is null then raise exception 'Niet ingelogd'; end if;
  if p_other_id is null or p_other_id = v_me then raise exception 'Kies een ander lid'; end if;
  if not public.chat_enabled(p_project_id) then raise exception 'Chat staat uit voor dit project'; end if;
  if not public.chat_member_ok(p_project_id, v_me) then raise exception 'Alleen leden kunnen chatten'; end if;
  if not public.chat_member_ok(p_project_id, p_other_id) then raise exception 'Dit lid kan (nog) niet chatten'; end if;

  v_key := p_project_id::text || ':' || least(v_me, p_other_id)::text || ':' || greatest(v_me, p_other_id)::text;

  select id into v_conv from public.chat_threads where direct_key = v_key;
  if v_conv is not null then return v_conv; end if;

  -- Race-veilig: bij gelijktijdige start wint één insert, de ander leest terug.
  insert into public.chat_threads (project_id, kind, direct_key, created_by)
  values (p_project_id, 'direct', v_key, v_me)
  on conflict (direct_key) do nothing
  returning id into v_conv;

  if v_conv is null then
    select id into v_conv from public.chat_threads where direct_key = v_key;
    return v_conv;
  end if;

  insert into public.chat_participants (thread_id, profile_id, role)
  values (v_conv, v_me, 'member'), (v_conv, p_other_id, 'member');

  return v_conv;
end;
$$;

-- Maak een thema-groep. Aanmaker wordt owner; genodigden die geen lid (member+)
-- zijn worden stil overgeslagen.
create or replace function chat_create_group(
  p_project_id  uuid,
  p_title       text,
  p_topic       text default null,
  p_emoji       text default null,
  p_join_policy text default 'open',
  p_member_ids  uuid[] default '{}'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me     uuid := auth.uid();
  v_policy text;
  v_conv   uuid;
begin
  if v_me is null then raise exception 'Niet ingelogd'; end if;
  if not public.chat_enabled(p_project_id) then raise exception 'Chat staat uit voor dit project'; end if;
  -- Leden (member+) óf beheer (org-admin/moderator/platform-admin, bijv. vanuit de CMS zonder membership-rij).
  if not (public.chat_member_ok(p_project_id, v_me) or public.can_moderate_chat(p_project_id)) then
    raise exception 'Alleen leden kunnen groepen aanmaken';
  end if;
  if p_title is null or length(trim(p_title)) = 0 then raise exception 'Geef de groep een naam'; end if;
  if p_join_policy not in ('open', 'invite') then raise exception 'Ongeldige zichtbaarheid'; end if;

  select chat_group_creation into v_policy from public.projects where id = p_project_id;
  if v_policy = 'moderators' and not public.can_moderate_chat(p_project_id) then
    raise exception 'In dit project kunnen alleen beheerders groepen aanmaken';
  end if;

  insert into public.chat_threads (project_id, kind, title, topic, emoji, join_policy, created_by)
  values (p_project_id, 'group', trim(p_title), nullif(trim(coalesce(p_topic, '')), ''), nullif(trim(coalesce(p_emoji, '')), ''), p_join_policy, v_me)
  returning id into v_conv;

  insert into public.chat_participants (thread_id, profile_id, role)
  values (v_conv, v_me, 'owner');

  insert into public.chat_participants (thread_id, profile_id, role)
  select v_conv, m, 'member'
  from unnest(coalesce(p_member_ids, '{}')) as m
  where m <> v_me and public.chat_member_ok(p_project_id, m)
  on conflict do nothing;

  return v_conv;
end;
$$;

-- Leden toevoegen aan een groep (owner of moderator). Niet-leden worden overgeslagen.
create or replace function chat_add_members(p_thread_id uuid, p_member_ids uuid[])
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project uuid;
  v_kind    text;
  v_arch    timestamptz;
  v_n       int;
begin
  if auth.uid() is null then raise exception 'Niet ingelogd'; end if;

  select project_id, kind, archived_at into v_project, v_kind, v_arch
  from public.chat_threads where id = p_thread_id;

  if v_project is null then raise exception 'Gesprek niet gevonden'; end if;
  if v_kind <> 'group' then raise exception 'Aan een 1-op-1-gesprek kun je niemand toevoegen'; end if;
  if v_arch is not null then raise exception 'Deze groep is gearchiveerd'; end if;
  if not (public.is_chat_owner(p_thread_id) or public.can_moderate_chat(v_project)) then
    raise exception 'Alleen de eigenaar of een beheerder kan leden toevoegen';
  end if;

  insert into public.chat_participants (thread_id, profile_id, role)
  select p_thread_id, m, 'member'
  from unnest(coalesce(p_member_ids, '{}')) as m
  where public.chat_member_ok(v_project, m)
  on conflict do nothing;

  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

-- Ongelezen per thread voor de huidige gebruiker (één call voor badge + lijst),
-- optioneel beperkt tot één project. `muted` komt mee zodat de client gedempte
-- threads buiten de badge kan houden maar wél in de lijst kan tonen.
create or replace function chat_unread_counts(p_project_id uuid default null)
returns table (thread_id uuid, unread bigint, muted boolean)
language sql
security definer
stable
set search_path = ''
as $$
  select cp.thread_id,
         count(m.id),
         (cp.muted_until is not null and cp.muted_until > now()) as muted
  from public.chat_participants cp
  join public.chat_threads t on t.id = cp.thread_id
  left join public.chat_messages m
    on m.thread_id = cp.thread_id
   and m.created_at > cp.last_read_at
   and m.sender_id <> cp.profile_id
   and m.deleted_at is null
  where cp.profile_id = auth.uid()
    and (p_project_id is null or t.project_id = p_project_id)
  group by cp.thread_id, cp.muted_until;
$$;

revoke execute on function chat_start_direct(uuid, uuid)                          from public, anon;
revoke execute on function chat_create_group(uuid, text, text, text, text, uuid[]) from public, anon;
revoke execute on function chat_add_members(uuid, uuid[])                         from public, anon;
revoke execute on function chat_unread_counts(uuid)                               from public, anon;
grant  execute on function chat_start_direct(uuid, uuid),
                           chat_create_group(uuid, text, text, text, text, uuid[]),
                           chat_add_members(uuid, uuid[]),
                           chat_unread_counts(uuid)
       to authenticated;

-- ----------------------------------------------------------------------------
-- 6. Storage: private bucket voor bijlagen, pad <thread_id>/<bestandsnaam>
-- ----------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chat-attachments', 'chat-attachments', false, 10485760,
  array['image/png','image/jpeg','image/webp','image/gif','application/pdf']
)
on conflict (id) do nothing;

-- CASE i.p.v. AND: SQL garandeert geen short-circuit, en de uuid-cast mag nooit
-- falen voor objecten in andere buckets (die evalueren deze policy ook).
create policy "chat_attach_select" on storage.objects for select
  using (
    case when bucket_id = 'chat-attachments'
         then public.chat_thread_visible(((storage.foldername(name))[1])::uuid)
         else false end
  );

create policy "chat_attach_insert" on storage.objects for insert
  with check (
    case when bucket_id = 'chat-attachments'
         then public.chat_can_post(((storage.foldername(name))[1])::uuid)
         else false end
  );

-- ----------------------------------------------------------------------------
-- 7. Realtime
-- ----------------------------------------------------------------------------

alter publication supabase_realtime add table chat_threads;
alter publication supabase_realtime add table chat_participants;
alter publication supabase_realtime add table chat_messages;
