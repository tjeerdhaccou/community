-- ============================================================================
-- 111_demo_roll_whole_days.sql
-- demo_roll_dates() schoof met de exacte tijd sinds de vorige run. De eerste
-- run (anker 22:38, cron 03:15) verschoof daardoor alle demo-tijden 4u37m:
-- de informatieavond begon om half één 's nachts. Nu schuift de functie alleen
-- hele dagen en schuift het anker met precies dat aantal dagen mee, zodat de
-- kloktijden van events nooit meer veranderen.
-- ============================================================================

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
    delta := make_interval(days => floor(extract(epoch from now() - c.anchored_at) / 86400)::int);
    if delta < interval '1 day' then continue; end if;

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

    update public.demo_clock set anchored_at = anchored_at + delta where project_id = c.project_id;
  end loop;
end;
$$;

revoke execute on function demo_roll_dates() from public, anon, authenticated;
