-- 119: SECURITY DEFINER-functies aanscherpen (MIDDEL)
--
-- 1. link_intake_after_login(p_email, p_user_id) was zonder inlog aan te roepen
--    en controleerde niets: met het e-mailadres van een uitgenodigde
--    belangstellende kon iedereen diens naam en telefoonnummer op een eigen
--    profiel laten zetten en de uitnodiging op 'joined' zetten (waarna de
--    uitgenodigde zelf geen lidmaatschap meer krijgt). Nu: alleen voor jezelf
--    en alleen met het adres van je eigen account.
-- 2. accept_org_admin_invites() las het adres uit profiles.email; dat veld kon
--    de gebruiker zelf wijzigen (zie 117). Nu uit auth.users.
-- 3. mark_payment_request_sent() controleerde niets en was voor iedereen aan te
--    roepen: met het id van een concept-betaalverzoek kon je de status op
--    'sent' zetten en zelf het toegangstoken kiezen. Alleen de edge function
--    send-payment-request (service-rol) gebruikt hem.
-- 4. cleanup_anonymous_users() hoort alleen bij de cron.
-- 5. Functies die een ingelogde gebruiker vragen, niet meer voor anon.
-- 6. Vast search_path op de vijf functies die de advisor meldt.
--
-- Risico dat dit iets breekt: laag. Per punt nagezocht wie de functie aanroept:
--   link_intake_after_login   community/src/views/Login.jsx, direct na inloggen,
--                             met het adres waarmee is ingelogd
--   accept_org_admin_invites  buuur-admin/src/lib/auth.ts, ingelogd
--   mark_payment_request_sent alleen supabase/functions/send-payment-request
--   create_mollie_oauth_state, disconnect_mollie_account: buuur-admin, ingelogd
--   dismiss_payment_request   community Dashboard, ingelogd
-- De hulpfuncties uit de RLS-regels (has_membership, is_platform_admin,
-- is_org_admin, is_demo_project, can_view_decisions, sig_current_user_*, ...)
-- en de tokenfuncties van de publieke betaalpagina (get_payment_request_by_token,
-- mark_payment_request_viewed, agree_payment_request) en check_invited_email
-- blijven bewust open voor anon.

create or replace function public.link_intake_after_login(p_email text, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_email text;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    return;
  end if;
  select lower(trim(u.email)) into v_email from auth.users u where u.id = auth.uid();
  if v_email is null or v_email <> lower(trim(p_email)) then
    return;
  end if;

  update profiles set
    full_name = coalesce(nullif(profiles.full_name, ''), ir.name),
    phone = coalesce(profiles.phone, ir.phone),
    email = coalesce(nullif(profiles.email, ''), v_email)
  from intake_responses ir
  where profiles.id = p_user_id
    and lower(ir.email) = v_email
    and ir.status = 'invited';

  update intake_responses set
    status = 'joined',
    profile_id = p_user_id
  where lower(email) = v_email
    and status = 'invited';
end;
$$;

create or replace function public.accept_org_admin_invites()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_email text;
  v_inv record;
  v_count integer := 0;
begin
  if auth.uid() is null then
    return 0;
  end if;

  -- Het adres van het account zelf, niet het (voorheen zelf te wijzigen) veld
  -- op het profiel. Anonieme sessies hebben geen adres.
  select lower(u.email) into v_email
  from auth.users u
  where u.id = auth.uid() and coalesce(u.is_anonymous, false) = false;
  if v_email is null or v_email = '' then
    return 0;
  end if;

  for v_inv in
    select id, organization_id, project_ids
    from org_admin_invites
    where lower(email) = v_email and status = 'pending'
  loop
    insert into org_members (organization_id, profile_id, role, project_ids)
    values (v_inv.organization_id, auth.uid(), 'admin', v_inv.project_ids)
    on conflict (organization_id, profile_id) do nothing;

    update org_admin_invites
    set status = 'accepted', accepted_at = now()
    where id = v_inv.id;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

-- Alleen de service-rol (edge function, cron)
revoke execute on function public.mark_payment_request_sent(uuid, text, text) from public, anon, authenticated;
grant  execute on function public.mark_payment_request_sent(uuid, text, text) to service_role;
revoke execute on function public.cleanup_anonymous_users() from public, anon, authenticated;

-- Alleen ingelogd
revoke execute on function public.link_intake_after_login(text, uuid) from public, anon;
grant  execute on function public.link_intake_after_login(text, uuid) to authenticated, service_role;
revoke execute on function public.accept_org_admin_invites() from public, anon;
grant  execute on function public.accept_org_admin_invites() to authenticated, service_role;
revoke execute on function public.create_mollie_oauth_state(uuid, text) from public, anon;
grant  execute on function public.create_mollie_oauth_state(uuid, text) to authenticated, service_role;
revoke execute on function public.disconnect_mollie_account(uuid) from public, anon;
grant  execute on function public.disconnect_mollie_account(uuid) to authenticated, service_role;
revoke execute on function public.dismiss_payment_request(uuid) from public, anon;
grant  execute on function public.dismiss_payment_request(uuid) to authenticated, service_role;

-- Triggerfuncties horen niet op de RPC-API (een trigger blijft gewoon werken)
revoke execute on function public.proposal_questions_notify() from public, anon, authenticated;
revoke execute on function public.proposal_responses_log() from public, anon, authenticated;
revoke execute on function public.sig_countersign_on_complete() from public, anon, authenticated;
revoke execute on function public.sig_maybe_complete_request() from public, anon, authenticated;

-- Vast search_path
alter function public.handle_updated_at() set search_path = public, pg_temp;
alter function public.touch_updated_at() set search_path = public, pg_temp;
alter function public.gen_share_code() set search_path = public, extensions, pg_temp;
alter function public.set_project_custom_domain() set search_path = public, pg_temp;
alter function public.project_has_active_payment_account(uuid) set search_path = public, pg_temp;
