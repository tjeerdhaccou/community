-- ============================================================================
-- 104_chat_group_email_frequency.sql
-- Rustiger chat-mail. Twee problemen met de opzet uit migratie 101:
--   1. De groepsdigest keek naar álles wat ongelezen was, niet naar wat er nieuw
--      was sinds de vorige mail. Wie niet las, kreeg elke dag opnieuw dezelfde
--      herinnering (gemeten: 9 mails in 3 dagen terwijl er maar op één dag
--      berichten waren).
--   2. De frequentie lag vast op dagelijks; een lid kon alleen alles uitzetten.
--
-- Nu: pref_chat regelt de persoonlijke mail (privéberichten + @vermeldingen),
-- pref_chat_groups regelt de groepen met vier standen. Standaard wekelijks.
-- De "alleen wat nieuw is"-regel zit in de edge function chat-notify-email en
-- leunt op notification_log (laatst verstuurde digest per gebruiker+project).
-- ============================================================================

alter table notification_preferences
  add column if not exists pref_chat_groups text not null default 'weekly';

do $$
begin
  alter table notification_preferences drop constraint if exists notification_preferences_pref_chat_groups_check;
  alter table notification_preferences add constraint notification_preferences_pref_chat_groups_check
    check (pref_chat_groups in ('direct', 'daily', 'weekly', 'never'));
end $$;

comment on column notification_preferences.pref_chat_groups is
  'E-mail over groepsberichten: direct (per gesprek, na 10 min ongelezen), daily, weekly (standaard) of never. Privéberichten en @vermeldingen volgen pref_chat.';

-- Bestaande leden stonden feitelijk op dagelijks; zet ze op de nieuwe standaard
-- zodat niemand ongevraagd dagelijkse mail blijft krijgen.
update notification_preferences set pref_chat_groups = 'weekly' where pref_chat_groups is null;

-- Zoekindex voor "wanneer ging de laatste digest eruit?" (per gebruiker+project).
create index if not exists notification_log_digest_idx
  on notification_log (notification_type, user_id, project_id, sent_at desc);
