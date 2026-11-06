-- ============================================================================
-- 116_decisions_demo.sql — besluitvorming in het open demoproject
--
-- 1. Geen notificaties vanuit een demoproject. In de demo zitten echte
--    accounts; een voorbeeldvoorstel dat sluit mag die geen mail sturen.
-- 2. demo_roll_dates schuift ook voorstellen, reacties en vragen mee, zodat
--    een lopend demovoorstel altijd "nog een paar dagen" loopt en nooit door
--    close_due_proposals wordt gesloten.
-- De voorbeeldinhoud zelf staat in supabase/demo/demo_decisions.sql.
-- ============================================================================

create or replace function enqueue_proposal_event(
  p_type text, p_project_id uuid, p_proposal_id uuid, p_reference_id uuid default null, p_actor_id uuid default auth.uid()
) returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if is_demo_project(p_project_id) then
    return;   -- demo: nooit notificaties
  end if;
  insert into proposal_events(type, project_id, proposal_id, reference_id, actor_id)
  values (p_type, p_project_id, p_proposal_id, p_reference_id, p_actor_id);
  begin
    perform net.http_post(
      url := 'https://czgsqmbejsmcjusigwhp.supabase.co/functions/v1/decision-notify',
      headers := '{"Content-Type":"application/json"}'::jsonb,
      body := '{}'::jsonb);
  exception when others then
    raise warning 'decision-notify poke failed: %', sqlerrm;
  end;
end $$;
revoke execute on function enqueue_proposal_event(text, uuid, uuid, uuid, uuid) from public, anon, authenticated;

create or replace function public.demo_roll_dates()
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  c record;
  pr record;
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

    -- Besluitvorming. De bewaker op proposals laat per rij één systeemwijziging
    -- toe (vlag eenmalig, migratie 113), dus per voorstel de vlag zetten.
    for pr in select id from public.proposals where project_id = c.project_id loop
      perform set_config('app.decisions_rpc', 'on', true);
      update public.proposals set
        created_at = created_at + delta,
        published_at = published_at + delta,
        deadline = deadline + delta,
        deadline_extended_at = deadline_extended_at + delta,
        closed_at = closed_at + delta,
        withdrawn_at = withdrawn_at + delta,
        reminder_sent_at = reminder_sent_at + delta
      where id = pr.id;
    end loop;
    update public.proposal_responses set responded_at = responded_at + delta
      where proposal_id in (select id from public.proposals where project_id = c.project_id);
    update public.proposal_response_log set created_at = created_at + delta
      where proposal_id in (select id from public.proposals where project_id = c.project_id);
    update public.proposal_questions set created_at = created_at + delta
      where proposal_id in (select id from public.proposals where project_id = c.project_id);

    update public.demo_clock set anchored_at = anchored_at + delta where project_id = c.project_id;
  end loop;
end;
$$;
