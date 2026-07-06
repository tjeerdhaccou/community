-- ============================================================================
-- 082_support_email_cron.sql
-- Cron die de edge-function `support-notify-email` elke 5 minuten aanroept.
-- Die functie mailt het lid een nudge bij een agent-antwoord dat na X min nog
-- niet gezien is (debounce), idempotent via notification_log. Zie
-- supabase/functions/support-notify-email/ en SUPPORT_CHAT_SPEC.md §7.
--
-- LET OP: de edge-function wordt apart gedeployed (Supabase Functions), niet via
-- deze migratie. Deze migratie regelt alleen het schedule.
-- ============================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Idempotent: cron.schedule met dezelfde naam werkt de job bij.
select cron.schedule(
  'support-notify-email',
  '*/5 * * * *',
  $$ select net.http_post(
       url := 'https://czgsqmbejsmcjusigwhp.supabase.co/functions/v1/support-notify-email',
       headers := '{"Content-Type":"application/json"}'::jsonb
     ) $$
);
