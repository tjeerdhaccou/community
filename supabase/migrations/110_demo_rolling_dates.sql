-- ============================================================================
-- 110_demo_rolling_dates.sql
-- Het open demoproject (is_demo) liep leeg: events lagen allemaal in het
-- verleden en het "laatste nieuws" was maanden oud. Elke nacht schuift
-- demo_roll_dates() alle demo-tijdstempels op met de tijd sinds de vorige
-- run, zodat de demo er altijd uitziet als vandaag: events binnenkort, nieuws
-- van een paar dagen oud.
--
-- Bewust NIET verschoven:
--   * chat_messages / chat_threads: created_at is onveranderlijk (guard), en
--     chat-notify-email mailt op recente berichten. In de demo zitten echte
--     accounts; die willen we geen nudges sturen.
--   * memberships: update-triggers schrijven audit-log en rolwijzigingen.
-- ============================================================================

create table if not exists demo_clock (
  project_id  uuid primary key references projects(id) on delete cascade,
  anchored_at timestamptz not null default now()
);

alter table demo_clock enable row level security; -- geen policies: alleen service/postgres

create or replace function demo_roll_dates()
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  c record;
  delta interval;
begin
  for c in
    select dc.project_id, dc.anchored_at
    from public.demo_clock dc join public.projects p on p.id = dc.project_id
    where p.is_demo
  loop
    delta := now() - c.anchored_at;
    if delta < interval '1 hour' then continue; end if;

    update public.meetings set
      date = date + delta,
      created_at = created_at + delta,
      status = case when date + delta < now() then 'done' else 'upcoming' end
    where project_id = c.project_id;

    update public.updates set created_at = created_at + delta where project_id = c.project_id;
    update public.update_comments set created_at = created_at + delta
      where update_id in (select id from public.updates where project_id = c.project_id);
    update public.update_reactions set created_at = created_at + delta
      where update_id in (select id from public.updates where project_id = c.project_id);

    update public.posts set created_at = created_at + delta where project_id = c.project_id;
    update public.comments set created_at = created_at + delta
      where post_id in (select id from public.posts where project_id = c.project_id);
    update public.post_reactions set created_at = created_at + delta
      where post_id in (select id from public.posts where project_id = c.project_id);

    update public.documents set created_at = created_at + delta where project_id = c.project_id;
    update public.meeting_files set created_at = created_at + delta
      where meeting_id in (select id from public.meetings where project_id = c.project_id);
    update public.event_rsvps set created_at = created_at + delta
      where meeting_id in (select id from public.meetings where project_id = c.project_id);

    update public.demo_clock set anchored_at = now() where project_id = c.project_id;
  end loop;
end;
$$;

revoke execute on function demo_roll_dates() from public, anon, authenticated;

-- Startpunt: de demo-inhoud is bij het invoeren van deze migratie al eenmalig
-- naar "nu" geschoven, dus het anker staat op nu.
insert into demo_clock (project_id, anchored_at)
select id, now() from projects where is_demo
on conflict (project_id) do nothing;

select cron.schedule('demo-roll-dates', '15 3 * * *', $$ select public.demo_roll_dates() $$);
