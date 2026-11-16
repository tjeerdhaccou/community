-- Vervolg op 122: ook de drie meldingsfuncties die de database aanroept
-- (chat-notify-email, support-notify-email, decision-notify) krijgen een
-- eenmalig kaartje mee. Ze namen al geen invoer aan, maar waren door iedereen
-- te starten.
--
-- Kan breken: niets zolang de oude functies draaien (die negeren het veld).
-- Na uitrol van de nieuwe functies werkt alleen nog een aanroep met kaartje.

select cron.schedule(
  'chat-notify-email',
  '*/5 * * * *',
  $$ select net.http_post(
       url := 'https://czgsqmbejsmcjusigwhp.supabase.co/functions/v1/chat-notify-email',
       headers := '{"Content-Type":"application/json"}'::jsonb,
       body := jsonb_build_object('ticket', public.cron_ticket('chat-notify-email'))
     ) $$
);

select cron.schedule(
  'support-notify-email',
  '*/5 * * * *',
  $$ select net.http_post(
       url := 'https://czgsqmbejsmcjusigwhp.supabase.co/functions/v1/support-notify-email',
       headers := '{"Content-Type":"application/json"}'::jsonb,
       body := jsonb_build_object('ticket', public.cron_ticket('support-notify-email'))
     ) $$
);

select cron.schedule(
  'decision-notify',
  '*/5 * * * *',
  $$ select net.http_post(
       url := 'https://czgsqmbejsmcjusigwhp.supabase.co/functions/v1/decision-notify',
       headers := '{"Content-Type":"application/json"}'::jsonb,
       body := jsonb_build_object('ticket', public.cron_ticket('decision-notify'))
     ) $$
);

-- De directe por vanuit de besluitvorming: zelfde functie als voorheen, met kaartje.
create or replace function public.enqueue_proposal_event(p_type text, p_project_id uuid, p_proposal_id uuid, p_reference_id uuid default null::uuid, p_actor_id uuid default auth.uid())
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  if is_demo_project(p_project_id) then
    return;
  end if;
  insert into proposal_events(type, project_id, proposal_id, reference_id, actor_id)
  values (p_type, p_project_id, p_proposal_id, p_reference_id, p_actor_id);
  begin
    perform net.http_post(
      url := 'https://czgsqmbejsmcjusigwhp.supabase.co/functions/v1/decision-notify',
      headers := '{"Content-Type":"application/json"}'::jsonb,
      body := jsonb_build_object('ticket', public.cron_ticket('decision-notify')));
  exception when others then
    raise warning 'decision-notify poke failed: %', sqlerrm;
  end;
end $function$;
