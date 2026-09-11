-- ============================================================================
-- 101_chat_notifications.sql
-- Ledenchat fase 3: notificaties.
--   * pref_chat op notification_preferences (e-mail voor DM's, @mentions, digest)
--   * chat_messages.mentions (uuid[]) + trigger die alleen echte deelnemers laat staan
--   * push_subscriptions (Web Push / PWA) met RLS op eigen rijen
--   * notification_log.channel mag ook 'push'
--   * trigger op chat_messages → edge function `chat-push` via pg_net
--   * cron elke 5 min → edge function `chat-notify-email`
-- De edge functions worden apart gedeployed; deze migratie regelt schema + schedule.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Voorkeuren
-- ----------------------------------------------------------------------------

alter table notification_preferences
  add column if not exists pref_chat text not null default 'all';

comment on column notification_preferences.pref_chat is
  'Ledenchat-e-mail: all = DM-nudge, @mentions en dagelijkse groepsdigest; mute = geen chat-mail.';

-- ----------------------------------------------------------------------------
-- 2. Mentions
-- ----------------------------------------------------------------------------

alter table chat_messages
  add column if not exists mentions uuid[] not null default '{}';

-- Alleen deelnemers van de thread kunnen genoemd worden; de afzender zelf niet.
create or replace function chat_messages_sanitize_mentions()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if new.mentions is null or array_length(new.mentions, 1) is null then
    new.mentions := '{}';
    return new;
  end if;
  select coalesce(array_agg(distinct m), '{}') into new.mentions
  from unnest(new.mentions) as m
  where m <> new.sender_id
    and exists (
      select 1 from public.chat_participants cp
      where cp.thread_id = new.thread_id and cp.profile_id = m
    );
  return new;
end;
$$;

drop trigger if exists chat_messages_sanitize_mentions on chat_messages;
create trigger chat_messages_sanitize_mentions
  before insert on chat_messages
  for each row execute function chat_messages_sanitize_mentions();

revoke execute on function chat_messages_sanitize_mentions() from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 3. Push-abonnementen (Web Push)
-- ----------------------------------------------------------------------------

create table if not exists push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references profiles(id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  user_agent  text,
  created_at  timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists push_subscriptions_profile_idx on push_subscriptions (profile_id);

alter table push_subscriptions enable row level security;

drop policy if exists "push_subs_select_own" on push_subscriptions;
create policy "push_subs_select_own" on push_subscriptions for select
  using (profile_id = auth.uid());

drop policy if exists "push_subs_insert_own" on push_subscriptions;
create policy "push_subs_insert_own" on push_subscriptions for insert
  with check (profile_id = auth.uid());

drop policy if exists "push_subs_update_own" on push_subscriptions;
create policy "push_subs_update_own" on push_subscriptions for update
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

drop policy if exists "push_subs_delete_own" on push_subscriptions;
create policy "push_subs_delete_own" on push_subscriptions for delete
  using (profile_id = auth.uid());

-- ----------------------------------------------------------------------------
-- 4. notification_log: ook push als kanaal
-- ----------------------------------------------------------------------------

alter table notification_log drop constraint if exists notification_log_channel_check;
alter table notification_log add constraint notification_log_channel_check
  check (channel in ('email', 'in_app', 'push'));

create index if not exists notification_log_type_user_ref_idx
  on notification_log (notification_type, user_id, reference_id, sent_at desc);

-- ----------------------------------------------------------------------------
-- 5. Push-trigger: nieuw chatbericht → edge function chat-push (async via pg_net)
-- ----------------------------------------------------------------------------

create extension if not exists pg_net;

create or replace function chat_messages_notify_push()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  perform net.http_post(
    url     := 'https://czgsqmbejsmcjusigwhp.supabase.co/functions/v1/chat-push',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body    := jsonb_build_object('message_id', new.id)
  );
  return new;
end;
$$;

drop trigger if exists chat_messages_notify_push on chat_messages;
create trigger chat_messages_notify_push
  after insert on chat_messages
  for each row execute function chat_messages_notify_push();

revoke execute on function chat_messages_notify_push() from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 6. Cron: e-mail-nudges + digest, elke 5 minuten
-- ----------------------------------------------------------------------------

create extension if not exists pg_cron;

select cron.schedule(
  'chat-notify-email',
  '*/5 * * * *',
  $$ select net.http_post(
       url := 'https://czgsqmbejsmcjusigwhp.supabase.co/functions/v1/chat-notify-email',
       headers := '{"Content-Type":"application/json"}'::jsonb
     ) $$
);
