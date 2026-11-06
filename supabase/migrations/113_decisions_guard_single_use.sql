-- ============================================================================
-- 113_decisions_guard_single_use.sql
--
-- In 112 bleef de vlag app.decisions_rpc (set_config is_local) de hele
-- transactie aan nadat een RPC hem had gezet. Binnen dezelfde transactie kon
-- daarna een gewone UPDATE de bewaker omzeilen. Gevonden door de
-- integratietest (supabase/tests/decisions_integration.test.sql, I3).
--
-- Oplossing: de bewaker "verbruikt" de vlag: elke toegestane schrijfactie
-- zet hem meteen weer uit. Elke RPC zet de vlag direct vóór zijn eigen
-- UPDATE/INSERT; close_due_proposals doet dat nu per rij.
-- ============================================================================

create or replace function proposals_guard()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if coalesce(current_setting('app.decisions_rpc', true), '') = 'on' then
    perform set_config('app.decisions_rpc', '', true);   -- eenmalig bruikbaar
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.status := 'draft';
    new.published_at := null; new.closed_at := null; new.outcome := null;
    new.rules_snapshot := null; new.electorate_size := null; new.response_count := 0;
    new.withdrawn_at := null; new.withdrawn_reason := null; new.reminder_sent_at := null;
    new.deadline_extended_at := null; new.deadline_extension_note := null;
    new.version := 1; new.previous_version_id := null;
    if new.created_by is null then new.created_by := auth.uid(); end if;
    return new;
  end if;

  if old.status <> 'draft' then
    raise exception 'Een gepubliceerd voorstel kan niet meer worden bewerkt. Maak zo nodig een nieuwe versie of een nieuw voorstel.';
  end if;
  if new.status is distinct from old.status
     or new.project_id is distinct from old.project_id
     or new.published_at is distinct from old.published_at
     or new.rules_snapshot is distinct from old.rules_snapshot
     or new.electorate_size is distinct from old.electorate_size
     or new.response_count is distinct from old.response_count
     or new.outcome is distinct from old.outcome
     or new.closed_at is distinct from old.closed_at
     or new.version is distinct from old.version
     or new.previous_version_id is distinct from old.previous_version_id then
    raise exception 'Deze velden worden door het systeem beheerd';
  end if;
  return new;
end $$;

create or replace function close_due_proposals()
returns int language plpgsql security definer set search_path = public, pg_temp as $$
declare
  p proposals;
  v_outcome jsonb;
  v_closed int := 0;
begin
  for p in
    select * from proposals where status = 'published' and deadline <= now()
    for update skip locked
  loop
    v_outcome := decision_outcome(p.form, p.rules_snapshot, p.electorate_size, proposal_counts(p.id), p.is_heavy);
    perform decisions_rpc_on();
    update proposals set status = v_outcome->>'status', outcome = v_outcome, closed_at = now()
    where id = p.id;
    perform enqueue_proposal_event('proposal_closed', p.project_id, p.id, null, null);
    v_closed := v_closed + 1;
  end loop;

  for p in
    select pr.* from proposals pr
    where pr.status = 'published' and pr.reminder_sent_at is null
      and pr.deadline > now()
      and coalesce((pr.rules_snapshot->>'reminder_after_days')::int, 0) > 0
      and pr.published_at + make_interval(days => (pr.rules_snapshot->>'reminder_after_days')::int) <= now()
    for update skip locked
  loop
    perform decisions_rpc_on();
    update proposals set reminder_sent_at = now() where id = p.id;
    if p.response_count < p.electorate_size then
      perform enqueue_proposal_event('proposal_reminder', p.project_id, p.id, null, null);
    end if;
  end loop;

  return v_closed;
end $$;
revoke execute on function close_due_proposals() from public, anon, authenticated;
