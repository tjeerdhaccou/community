-- ============================================================================
-- 105_support_digest_backoff.sql
-- Rustiger team-digest voor support.
--
-- Probleem: de digest ging twee keer per dag uit zolang er één onbeantwoorde
-- vraag stond. Gemeten: ~11 mails over dezelfde vraag van 15 september. De mail
-- meldde een toestand ("er staat een vraag open") in plaats van nieuws.
--
-- Maar anders dan bij de ledenchat mág een openstaande supportvraag blijven
-- porren — hij mag niet vergeten worden. Daarom geen "alleen als er iets nieuws
-- is", maar een afbouwend schema per gesprek:
--
--   1e herinnering : eerstvolgende slot na binnenkomst
--   2e             : 1 dag later
--   3e             : 3 dagen later
--   4e en verder   : wekelijks
--
-- De teller reset zodra het team antwoordt (trigger hieronder), zodat een
-- volgende vraag weer snel opgepakt wordt.
-- ============================================================================

alter table support_conversations
  add column if not exists reminder_count int not null default 0,
  add column if not exists last_reminder_at timestamptz;

comment on column support_conversations.reminder_count is
  'Aantal team-herinneringen dat al is verstuurd over de huidige openstaande vraag; bepaalt het afbouwende interval. Reset op een agent-antwoord.';

-- Bestaande open gesprekken beginnen niet op nul: ze zijn al vaak genoeg gemeld.
-- Zet ze op het wekelijkse ritme met "zojuist gemeld", zodat er niet direct
-- opnieuw een mail uitgaat.
update support_conversations
   set reminder_count = 3, last_reminder_at = now()
 where status = 'open' and reminder_count = 0;

-- Bij een agent-antwoord is de vraag opgepakt: herinneringen terug naar nul.
create or replace function support_bump_conversation()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  -- bump de tijd; een nieuw lid-bericht heropent een gesloten gesprek
  update public.support_conversations
    set last_message_at = new.created_at,
        status = case when new.sender_role = 'user' then 'open' else status end,
        reminder_count   = case when new.sender_role = 'agent' then 0 else reminder_count end,
        last_reminder_at = case when new.sender_role = 'agent' then null else last_reminder_at end
  where id = new.conversation_id;
  return new;
end;
$$;

revoke execute on function support_bump_conversation() from public, anon, authenticated;
