-- Edge functions die de database zelf aanroept (pg_cron en een trigger via
-- pg_net) hebben geen JWT en stonden daardoor voor iedereen open. De database
-- geeft nu per aanroep een eenmalig kaartje mee; de functie haalt het weg en
-- doet zonder geldig kaartje niets. Geen gedeeld geheim nodig: het kaartje
-- staat in een tabel die alleen de service-rol kan lezen.
--
-- Gebruikt door: storage-backup (cron) en countersign-request (trigger).
-- Kan breken: als de edge functions niet zijn uitgerold met de kaartjescontrole
-- verandert er niets; de oude versies negeren het extra veld.

create table if not exists public.cron_tickets (
  id uuid primary key default gen_random_uuid(),
  doel text not null,
  created_at timestamptz not null default now()
);
alter table public.cron_tickets enable row level security;
revoke all on public.cron_tickets from public, anon, authenticated;

create or replace function public.cron_ticket(p_doel text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  delete from public.cron_tickets where created_at < now() - interval '1 hour';
  insert into public.cron_tickets (doel) values (p_doel) returning id into v_id;
  return v_id;
end
$$;
revoke execute on function public.cron_ticket(text) from public, anon, authenticated;

select cron.schedule(
  'storage-backup-sync',
  '*/15 * * * *',
  $$ select net.http_post(
       url := 'https://czgsqmbejsmcjusigwhp.supabase.co/functions/v1/storage-backup',
       headers := '{"Content-Type":"application/json"}'::jsonb,
       body := jsonb_build_object('mode', 'sync', 'ticket', public.cron_ticket('storage-backup'))
     ) $$
);

select cron.schedule(
  'storage-backup-verify',
  '30 3 * * *',
  $$ select net.http_post(
       url := 'https://czgsqmbejsmcjusigwhp.supabase.co/functions/v1/storage-backup',
       headers := '{"Content-Type":"application/json"}'::jsonb,
       body := jsonb_build_object('mode', 'verify', 'ticket', public.cron_ticket('storage-backup'))
     ) $$
);

create or replace function public.sig_countersign_on_complete()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if new.status = 'completed'
     and (old.status is distinct from 'completed')
     and new.countersign_enabled
     and new.countersigned_at is null
     and new.countersign_page is not null
  then
    perform net.http_post(
      url     := 'https://czgsqmbejsmcjusigwhp.supabase.co/functions/v1/countersign-request',
      headers := '{"Content-Type":"application/json"}'::jsonb,
      body    := jsonb_build_object('request_id', new.id, 'source', 'trigger',
                                    'ticket', public.cron_ticket('countersign-request'))
    );
  end if;
  return new;
end;
$function$;
