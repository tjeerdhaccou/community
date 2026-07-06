-- ============================================================================
-- 080_support_chat.sql
-- Async support-chat: gesprekken + berichten, gedeeld tussen community-app
-- (lid-widget) en buuur-admin (agent-inbox). Zie SUPPORT_CHAT_SPEC.md.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Tabellen
-- ----------------------------------------------------------------------------

create table support_conversations (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references profiles(id) on delete cascade,
  project_id      uuid references projects(id) on delete set null,       -- context waar de widget geopend werd
  org_id          uuid references organizations(id) on delete set null,
  subject         text,
  status          text not null default 'open' check (status in ('open', 'closed')),
  assigned_to     uuid references profiles(id) on delete set null,
  last_message_at timestamptz not null default now(),
  created_at      timestamptz not null default now()
);

create table support_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references support_conversations(id) on delete cascade,
  sender_id       uuid not null references profiles(id) on delete cascade,
  sender_role     text not null check (sender_role in ('user', 'agent')),  -- automatisch gezet, zie trigger
  body            text not null,
  read_at         timestamptz,
  created_at      timestamptz not null default now()
);

create index support_conversations_status_idx on support_conversations (status, last_message_at desc);
create index support_conversations_project_idx on support_conversations (project_id);
create index support_conversations_org_idx     on support_conversations (org_id);
create index support_conversations_user_idx     on support_conversations (user_id);
create index support_messages_conversation_idx on support_messages (conversation_id, created_at);

-- ----------------------------------------------------------------------------
-- Helper: mag de huidige user dit gesprek als agent afhandelen?
-- Platform-admin, org-admin van het org, of moderator+ van het project.
-- ----------------------------------------------------------------------------

create or replace function can_handle_support(p_project_id uuid, p_org_id uuid)
returns boolean
language sql security definer stable
set search_path = ''
as $$
  select
    public.is_platform_admin()
    or (p_org_id is not null and public.is_org_admin(p_org_id))
    or (p_project_id is not null and public.has_membership(p_project_id, 'moderator'));
$$;

-- ----------------------------------------------------------------------------
-- Triggers
--   1. sender_role automatisch bepalen (niet vertrouwen op de client)
--   2. last_message_at bijwerken bij elk nieuw bericht
-- ----------------------------------------------------------------------------

create or replace function support_set_sender_role()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_owner uuid;
begin
  select user_id into v_owner from public.support_conversations where id = new.conversation_id;
  new.sender_role := case when new.sender_id = v_owner then 'user' else 'agent' end;
  return new;
end;
$$;

create trigger support_messages_set_role
  before insert on support_messages
  for each row execute function support_set_sender_role();

create or replace function support_bump_conversation()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  -- bump de tijd; een nieuw lid-bericht heropent een gesloten gesprek
  update public.support_conversations
    set last_message_at = new.created_at,
        status = case when new.sender_role = 'user' then 'open' else status end
  where id = new.conversation_id;
  return new;
end;
$$;

create trigger support_messages_bump
  after insert on support_messages
  for each row execute function support_bump_conversation();

-- Hardening: trigger-functies hoeven niet via de API aanroepbaar te zijn;
-- de RLS-helper blijft aanroepbaar voor ingelogde gebruikers (nodig voor policy-evaluatie).
revoke execute on function support_set_sender_role()    from public, anon, authenticated;
revoke execute on function support_bump_conversation()   from public, anon, authenticated;
revoke execute on function can_handle_support(uuid, uuid) from public, anon;
grant  execute on function can_handle_support(uuid, uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------

alter table support_conversations enable row level security;
alter table support_messages enable row level security;

-- Gesprekken: eigenaar ziet eigen gesprekken; agents zien gesprekken in hun scope.
create policy "support_conv_select" on support_conversations for select
  using (user_id = auth.uid() or can_handle_support(project_id, org_id));

create policy "support_conv_insert" on support_conversations for insert
  with check (user_id = auth.uid());

create policy "support_conv_update" on support_conversations for update
  using (user_id = auth.uid() or can_handle_support(project_id, org_id))
  with check (user_id = auth.uid() or can_handle_support(project_id, org_id));

-- Berichten: zichtbaar/in te voegen door iedereen die het gesprek mag zien.
-- sender_id moet de ingelogde user zijn; sender_role wordt door de trigger gezet.
create policy "support_msg_select" on support_messages for select
  using (exists (
    select 1 from support_conversations c
    where c.id = conversation_id
    and (c.user_id = auth.uid() or can_handle_support(c.project_id, c.org_id))
  ));

create policy "support_msg_insert" on support_messages for insert
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from support_conversations c
      where c.id = conversation_id
      and (c.user_id = auth.uid() or can_handle_support(c.project_id, c.org_id))
    )
  );

-- read_at bijwerken (markeren als gelezen) mag wie het gesprek mag zien.
create policy "support_msg_update" on support_messages for update
  using (exists (
    select 1 from support_conversations c
    where c.id = conversation_id
    and (c.user_id = auth.uid() or can_handle_support(c.project_id, c.org_id))
  ));

-- ----------------------------------------------------------------------------
-- Realtime
-- ----------------------------------------------------------------------------

alter publication supabase_realtime add table support_conversations;
alter publication supabase_realtime add table support_messages;
