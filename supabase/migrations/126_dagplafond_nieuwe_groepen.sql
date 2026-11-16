-- 126: dagplafond op zelf aangemaakte groepen
--
-- Sinds 124 kan elke ingelogde gebruiker een light-groep starten. Per account
-- geldt een grens van 3, maar accounts aanmaken is goedkoop. Dit plafond
-- begrenst de schade van een geautomatiseerde golf: hooguit 20 nieuwe
-- light-groepen per 24 uur voor het hele platform. Platformbeheer valt erbuiten.
-- Elke nieuwe groep geeft al een mail aan het team, dus misbruik valt op.
--
-- Verder ongewijzigd ten opzichte van 124.

create or replace function public.create_initiative_group(
  p_group_name  text,
  p_slug        text,
  p_admin_email text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid           uuid := auth.uid();
  v_is_platform   boolean;
  v_name          text := trim(coalesce(p_group_name, ''));
  v_slug          text := lower(trim(coalesce(p_slug, '')));
  v_org_id        uuid;
  v_project_id    uuid;
  v_admin_id      uuid;
  v_admin_linked  boolean := false;
  v_admin_invited boolean := false;
begin
  if v_uid is null
     or exists (select 1 from auth.users u where u.id = v_uid and coalesce(u.is_anonymous, false)) then
    raise exception 'Log eerst in om een groep aan te maken' using errcode = '42501';
  end if;

  v_is_platform := is_platform_admin();

  if char_length(v_name) < 2 or char_length(v_name) > 80 then
    raise exception 'Geef je groep een naam van 2 tot 80 tekens';
  end if;

  -- 3 tot 40 tekens, kleine letters, cijfers en koppeltekens, niet beginnen of
  -- eindigen met een koppelteken (het wordt een subdomein).
  if v_slug !~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$' then
    raise exception 'Kies een webadres van 3 tot 40 tekens: kleine letters, cijfers en koppeltekens';
  end if;

  if v_slug in ('www', 'my', 'app', 'api', 'admin', 'beheer', 'platform', 'login',
                'mail', 'email', 'support', 'help', 'status', 'docs', 'blog',
                'buuur', 'demo', 'test', 'staging', 'dev', 'cdn', 'static', 'assets') then
    raise exception 'Het webadres "%" is niet beschikbaar', v_slug;
  end if;

  -- SubdomainLookup zoekt in beide tabellen
  if exists (select 1 from projects where slug = v_slug)
     or exists (select 1 from organizations where slug in (v_slug, v_slug || '-org')) then
    raise exception 'Het webadres "%" is al in gebruik', v_slug;
  end if;

  if not v_is_platform
     and (select count(*) from organizations
          where kind = 'personal' and created_by = v_uid) >= 3 then
    raise exception 'Je kunt zelf hooguit 3 groepen aanmaken. Neem contact op als je er meer nodig hebt.';
  end if;

  -- Dagplafond voor het hele platform, tegen een golf van spamgroepen.
  if not v_is_platform
     and (select count(*) from organizations
          where kind = 'personal' and created_at > now() - interval '24 hours') >= 20 then
    raise exception 'Er worden op dit moment erg veel groepen gestart. Probeer het morgen opnieuw, of mail ons op hallo@buuur.nl.';
  end if;

  -- Light-org: interne slug, wordt niet als subdomein gebruikt
  insert into organizations (name, slug, kind, tier, status, created_by)
  values (v_name, v_slug || '-org', 'personal', 'free', 'active', v_uid)
  returning id into v_org_id;

  insert into projects (organization_id, name, slug, features)
  values (v_org_id, v_name, v_slug, jsonb_build_object(
    'updates', true, 'board', true, 'events', true, 'members', true,
    'documents', true, 'roadmap', true, 'chat', true,
    'page_builder', true, 'ledenwerving', true,
    'team', false, 'decisions', false
  ))
  returning id into v_project_id;

  if not v_is_platform then
    -- Zelf aangemaakt: de aanvrager beheert het project, zonder org-rol.
    insert into memberships (profile_id, project_id, role)
    values (v_uid, v_project_id, 'admin')
    on conflict (profile_id, project_id) do update set role = 'admin';
    v_admin_linked := true;

  elsif p_admin_email is not null and trim(p_admin_email) <> '' then
    -- Platformbeheer: bestaand gedrag uit 063
    select id into v_admin_id
    from profiles
    where lower(email) = lower(trim(p_admin_email))
    limit 1;

    if v_admin_id is not null then
      insert into org_members (organization_id, profile_id, role)
      values (v_org_id, v_admin_id, 'admin')
      on conflict (organization_id, profile_id) do nothing;

      insert into memberships (profile_id, project_id, role)
      values (v_admin_id, v_project_id, 'admin')
      on conflict (profile_id, project_id) do nothing;

      v_admin_linked := true;
    else
      insert into org_admin_invites (organization_id, email, invited_by)
      values (v_org_id, lower(trim(p_admin_email)), v_uid)
      on conflict (organization_id, email) do nothing;

      v_admin_invited := true;
    end if;
  end if;

  return jsonb_build_object(
    'org_id', v_org_id,
    'project_id', v_project_id,
    'slug', v_slug,
    'admin_linked', v_admin_linked,
    'admin_invited', v_admin_invited
  );
end;
$$;

revoke all on function public.create_initiative_group(text, text, text) from public, anon;
grant execute on function public.create_initiative_group(text, text, text) to authenticated;
