-- ============================================================================
-- 109_leads_notify_email.sql
-- Aanvragen via buuur.nl/start kwamen alleen in de tabel leads terecht; niemand
-- kreeg ze te zien. Nu:
--   * leads.notified_at: wanneer het team gemaild is (door de edge function gezet)
--   * leads.handled_at: wanneer een beheerder de aanvraag heeft opgepakt
--   * trigger na insert → edge function `lead-notify-email` via pg_net
--   * platformbeheerders mogen handled_at bijwerken (overzicht in buuur-admin)
-- Het formulier is publiek, dus de trigger mailt hooguit 20 leads per uur; de
-- rest staat gewoon in het overzicht.
-- ============================================================================

alter table leads add column if not exists notified_at timestamptz;
alter table leads add column if not exists handled_at timestamptz;

create index if not exists leads_created_at_idx on leads (created_at desc);

create extension if not exists pg_net;

create or replace function leads_notify_email()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.leads where created_at > now() - interval '1 hour') > 20 then
    return new;
  end if;
  perform net.http_post(
    url     := 'https://czgsqmbejsmcjusigwhp.supabase.co/functions/v1/lead-notify-email',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body    := jsonb_build_object('lead_id', new.id)
  );
  return new;
end;
$$;

drop trigger if exists leads_notify_email on leads;
create trigger leads_notify_email
  after insert on leads
  for each row execute function leads_notify_email();

revoke execute on function leads_notify_email() from public, anon, authenticated;

drop policy if exists "leads_update_platform_admin" on leads;
create policy "leads_update_platform_admin" on leads
  for update to authenticated
  using (is_platform_admin())
  with check (is_platform_admin());
