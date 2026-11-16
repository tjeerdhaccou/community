-- 125: buuur light — gratis tot 10 leden, daarna een abonnement
--
-- Een light-groep (organizations.kind = 'personal') is gratis tot 10 leden.
-- Daarna kost buuur light € 29 per maand of € 290 per jaar (incl. btw). Betalen
-- loopt voorlopig met de hand: de beheerder vraagt het abonnement aan in de
-- app, het team krijgt een melding en zet de grens open:
--
--   update organizations set member_limit = null where id = '<org-id>';
--
-- Wat telt als lid: elke membership behalve gast (wacht op goedkeuring) en
-- professional (adviseur). Platformbeheerders tellen niet mee.
--
-- Wat er bij de grens gebeurt:
--   * iemand tot lid maken (rol wijzigen)  -> foutmelding met uitleg;
--   * een nieuwe membership die als lid binnenkomt (uitnodiging, intake)
--     -> komt binnen als gast en wacht tot er plek is. Zo raakt niemand zoek
--        en blijft handle_new_user gewoon werken.
--
-- Risico dat dit iets breekt: laag. member_limit is NULL voor alle bestaande
-- organisaties (geen grens); er zijn nog geen light-groepen.

alter table public.organizations
  add column if not exists member_limit integer check (member_limit is null or member_limit > 0),
  add column if not exists upgrade_requested_at timestamptz,
  add column if not exists welcome_sent_at timestamptz;

comment on column public.organizations.member_limit is
  'Maximaal aantal leden per project; NULL = geen grens. Light-groepen starten op 10 (gratis).';

-- Nieuwe light-org: standaard de gratis grens.
create or replace function public.organizations_default_member_limit()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.kind = 'personal' and new.member_limit is null then
    new.member_limit := 10;
  end if;
  return new;
end;
$$;

revoke execute on function public.organizations_default_member_limit() from public, anon, authenticated;

drop trigger if exists organizations_default_member_limit on public.organizations;
create trigger organizations_default_member_limit
  before insert on public.organizations
  for each row execute function public.organizations_default_member_limit();

-- De grens en de bijbehorende velden zijn niet via de API te wijzigen, ook niet
-- door een org-beheerder. Platformbeheer, de service-rol en de SECURITY
-- DEFINER-functies hieronder kunnen het wel.
create or replace function public.organizations_guard_plan_columns()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if current_user in ('authenticated', 'anon')
     and (new.member_limit is distinct from old.member_limit
          or new.upgrade_requested_at is distinct from old.upgrade_requested_at
          or new.welcome_sent_at is distinct from old.welcome_sent_at
          or new.kind is distinct from old.kind)
     and not public.is_platform_admin() then
    raise exception 'Dit veld kan alleen door platformbeheer worden gewijzigd'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke execute on function public.organizations_guard_plan_columns() from public, anon, authenticated;

drop trigger if exists organizations_guard_plan_columns on public.organizations;
create trigger organizations_guard_plan_columns
  before update on public.organizations
  for each row execute function public.organizations_guard_plan_columns();

-- Aantal leden dat meetelt voor de grens.
create or replace function public.project_member_count(p_project_id uuid, p_except uuid default null)
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select count(*)::integer
  from memberships m
  join profiles pr on pr.id = m.profile_id
  where m.project_id = p_project_id
    and m.role not in ('guest', 'professional')
    and not coalesce(pr.is_platform_admin, false)
    and (p_except is null or m.id <> p_except);
$$;

revoke execute on function public.project_member_count(uuid, uuid) from public, anon, authenticated;

create or replace function public.memberships_enforce_member_limit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_limit integer;
begin
  if new.role in ('guest', 'professional') then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.role not in ('guest', 'professional') then
    return new;  -- was al lid, alleen een andere rol
  end if;

  select o.member_limit into v_limit
  from projects p
  join organizations o on o.id = p.organization_id
  where p.id = new.project_id;

  if v_limit is null then
    return new;
  end if;
  if exists (select 1 from profiles where id = new.profile_id and coalesce(is_platform_admin, false)) then
    return new;
  end if;

  if public.project_member_count(new.project_id, new.id) >= v_limit then
    if tg_op = 'INSERT' then
      new.role := 'guest';
      return new;
    end if;
    raise exception 'Je groep zit vol: buuur light is gratis tot % leden. Vraag een abonnement aan om verder te groeien.', v_limit
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

revoke execute on function public.memberships_enforce_member_limit() from public, anon, authenticated;

drop trigger if exists memberships_enforce_member_limit on public.memberships;
create trigger memberships_enforce_member_limit
  before insert or update of role on public.memberships
  for each row execute function public.memberships_enforce_member_limit();

-- Stand van zaken voor het ledenbeheer. NULL als er geen grens geldt of als de
-- aanvrager geen moderator of beheerder van het project is.
create or replace function public.get_project_member_quota(p_project_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_limit integer;
  v_requested timestamptz;
begin
  if not (has_membership(p_project_id, 'moderator') or is_platform_admin()) then
    return null;
  end if;

  select o.member_limit, o.upgrade_requested_at into v_limit, v_requested
  from projects p
  join organizations o on o.id = p.organization_id
  where p.id = p_project_id;

  if v_limit is null then
    return null;
  end if;

  return jsonb_build_object(
    'limit', v_limit,
    'used', public.project_member_count(p_project_id),
    'requested_at', v_requested
  );
end;
$$;

revoke all on function public.get_project_member_quota(uuid) from public, anon;
grant execute on function public.get_project_member_quota(uuid) to authenticated;

-- De beheerder vraagt een abonnement aan. Legt het moment vast en maakt een
-- lead aan, zodat de bestaande leads-mail het team waarschuwt.
create or replace function public.request_light_upgrade(p_project_id uuid, p_interval text default 'month')
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_org_id  uuid;
  v_name    text;
  v_slug    text;
  v_limit   integer;
  v_already timestamptz;
  v_email   text;
  v_person  text;
begin
  if not has_membership(p_project_id, 'admin') then
    raise exception 'Alleen een beheerder van de groep kan een abonnement aanvragen' using errcode = '42501';
  end if;
  if p_interval not in ('month', 'year') then
    raise exception 'Onbekende looptijd';
  end if;

  select o.id, p.name, p.slug, o.member_limit, o.upgrade_requested_at
    into v_org_id, v_name, v_slug, v_limit, v_already
  from projects p
  join organizations o on o.id = p.organization_id
  where p.id = p_project_id;

  if v_limit is null then
    raise exception 'Voor deze groep geldt geen ledengrens';
  end if;

  if v_already is null then
    select u.email into v_email from auth.users u where u.id = auth.uid();
    select coalesce(nullif(trim(pr.full_name), ''), v_email) into v_person
    from profiles pr where pr.id = auth.uid();

    update organizations set upgrade_requested_at = now() where id = v_org_id;

    insert into leads (segment, name, email, organization, phase, message, source)
    values (
      'bewoner', coalesce(v_person, v_email), v_email, v_name,
      'Vraagt een buuur light-abonnement aan',
      format('Groep %s.buuur.nl wil een abonnement per %s (€ %s). Nu %s van %s leden. Openzetten: update organizations set member_limit = null where id = ''%s'';',
             v_slug,
             case p_interval when 'year' then 'jaar' else 'maand' end,
             case p_interval when 'year' then '290' else '29' end,
             public.project_member_count(p_project_id), v_limit, v_org_id),
      'light-upgrade'
    );
  end if;

  return jsonb_build_object('requested_at', coalesce(v_already, now()));
end;
$$;

revoke all on function public.request_light_upgrade(uuid, text) from public, anon;
grant execute on function public.request_light_upgrade(uuid, text) to authenticated;
