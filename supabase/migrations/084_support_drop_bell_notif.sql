-- ============================================================================
-- 084_support_drop_bell_notif.sql
-- De support-chat gebruikt de bubbel-badge (in-app) + e-mail (offline) als
-- notificatie. De bel-melding (migratie 081) bleek dubbelop, dus we stoppen die.
-- De e-mail-nudge (support-notify-email cron) leest support_messages direct en
-- is dus onafhankelijk — die blijft gewoon werken.
-- ============================================================================

drop trigger if exists support_messages_notify_member on support_messages;
drop function if exists support_notify_member();

-- Bestaande support-bel-meldingen opruimen zodat de bel meteen schoon is.
delete from notifications where type = 'new_support_message';
