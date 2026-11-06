-- ============================================================================
-- 115_decision_events_claim.sql
-- De worker decision-notify wordt zowel direct gepoked (enqueue) als elke
-- 5 min door cron aangeroepen. claim_proposal_events pakt atomair een batch
-- (FOR UPDATE SKIP LOCKED) zodat twee gelijktijdige runs nooit hetzelfde
-- event versturen. Mislukt een event, dan zet de worker het terug via
-- release_proposal_event (max 5 pogingen).
-- Alleen voor de service role.
-- ============================================================================

create or replace function claim_proposal_events(p_limit int default 25)
returns setof proposal_events language sql security definer set search_path = public, pg_temp as $$
  update proposal_events e
     set processed_at = now(), attempts = e.attempts + 1
   where e.id in (
     select id from proposal_events
      where processed_at is null and attempts < 5
      order by id
      limit p_limit
      for update skip locked)
  returning e.*;
$$;

create or replace function release_proposal_event(p_id bigint, p_error text)
returns void language sql security definer set search_path = public, pg_temp as $$
  update proposal_events set processed_at = null, last_error = left(p_error, 1000) where id = p_id;
$$;

revoke execute on function claim_proposal_events(int) from public, anon, authenticated;
revoke execute on function release_proposal_event(bigint, text) from public, anon, authenticated;
grant execute on function claim_proposal_events(int) to service_role;
grant execute on function release_proposal_event(bigint, text) to service_role;
