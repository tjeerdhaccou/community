-- ============================================================================
-- 088_fix_mollie_oauth_state_search_path.sql
-- Fix voor create_mollie_oauth_state: gen_random_bytes (pgcrypto) staat in
-- schema `extensions`, maar de RPC had search_path = public. Bij aanroep
-- vanuit de OAuth-connect route faalde de call met:
--   ERROR 42883: function gen_random_bytes(integer) does not exist
-- ============================================================================

create or replace function create_mollie_oauth_state(
  p_org_id       uuid,
  p_redirect_to  text default null
) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_state text;
begin
  if not (is_org_admin(p_org_id) or is_platform_admin()) then
    raise exception 'forbidden';
  end if;

  delete from mollie_oauth_states
    where organization_id = p_org_id and expires_at < now();

  v_state := encode(gen_random_bytes(32), 'hex');
  insert into mollie_oauth_states (state, organization_id, created_by, redirect_to)
    values (v_state, p_org_id, auth.uid(), p_redirect_to);

  return v_state;
end;
$$;

grant execute on function create_mollie_oauth_state(uuid, text) to authenticated;
