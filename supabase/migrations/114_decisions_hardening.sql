-- ============================================================================
-- 114_decisions_hardening.sql — opruimen na de security advisors
--   * vast search_path op de vier hulpfuncties zonder (lint 0011)
--   * besluit-RPC's niet aanroepbaar zonder sessie (anon); RLS-helpers blijven
--     wel aanroepbaar omdat policies ze als de aanroeper evalueren.
-- ============================================================================

alter function decisions_touch_updated_at() set search_path = public, pg_temp;
alter function decisions_plural(int, text, text) set search_path = public, pg_temp;
alter function decision_outcome(text, jsonb, int, jsonb, boolean) set search_path = public, pg_temp;
alter function decisions_rpc_on() set search_path = public, pg_temp;

revoke execute on function
  publish_proposal(uuid, timestamptz),
  extend_proposal_deadline(uuid, timestamptz, text),
  withdraw_proposal(uuid, text),
  cast_response(uuid, text, text),
  overrule_objection(uuid, uuid, text),
  create_proposal_version(uuid),
  proposal_tally(uuid),
  proposal_pending_units(uuid),
  my_pending_proposals(uuid),
  ensure_decision_rules(uuid)
from public, anon;

grant execute on function
  publish_proposal(uuid, timestamptz),
  extend_proposal_deadline(uuid, timestamptz, text),
  withdraw_proposal(uuid, text),
  cast_response(uuid, text, text),
  overrule_objection(uuid, uuid, text),
  create_proposal_version(uuid),
  proposal_tally(uuid),
  proposal_pending_units(uuid),
  my_pending_proposals(uuid),
  ensure_decision_rules(uuid)
to authenticated;
