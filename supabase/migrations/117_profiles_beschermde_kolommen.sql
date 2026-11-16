-- 117: beschermde kolommen op profiles (KRITIEK)
--
-- Probleem (vastgesteld op 15 november 2026 in de live catalogus):
--   policy "Users can update own profile" is USING (id = auth.uid()) zonder
--   kolombeperking, er is geen BEFORE UPDATE-trigger op profiles, en de rol
--   authenticated heeft UPDATE op alle kolommen. Elke ingelogde gebruiker (ook
--   een anonieme demosessie, en iedereen die zelf een account aanmaakt via de
--   inlogcode) kan dus op de eigen rij is_platform_admin = true zetten en is
--   daarna platformbeheerder: alle organisaties, profielen, dossiers en
--   bestanden. Via profiles.email kan iemand zich bovendien voordoen als een
--   uitgenodigde beheerder (accept_org_admin_invites en check_invited_email
--   lezen dat veld).
--
-- Oplossing: een trigger die voor verzoeken via de API (rol authenticated of
-- anon) het wijzigen van is_platform_admin en email weigert. Functies met
-- SECURITY DEFINER (handle_new_user, link_intake_after_login) en de service-rol
-- draaien onder een andere rol en blijven werken.
--
-- Risico dat dit iets breekt: laag. Geen van beide apps schrijft deze twee
-- kolommen via de API (nagezocht met grep in community/src en buuur-admin/src).
-- Een platformbeheerder aanwijzen gaat daarna alleen nog via de SQL Editor of
-- de service-rol; dat is de bedoeling.

create or replace function public.profiles_guard_protected_columns()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if current_user in ('authenticated', 'anon') then
    if new.is_platform_admin is distinct from old.is_platform_admin then
      raise exception 'is_platform_admin kan niet via de API worden gewijzigd'
        using errcode = '42501';
    end if;
    if new.email is distinct from old.email and not public.is_platform_admin() then
      raise exception 'email kan niet via de API worden gewijzigd'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

revoke execute on function public.profiles_guard_protected_columns() from public, anon, authenticated;

drop trigger if exists profiles_guard_protected_columns on public.profiles;
create trigger profiles_guard_protected_columns
  before update on public.profiles
  for each row execute function public.profiles_guard_protected_columns();

-- Een nieuwe rij met is_platform_admin = true mag ook niet via de API. Er is nu
-- geen INSERT-policy op profiles (rijen komen uit handle_new_user); dit is een
-- vangnet voor als die er ooit komt.
create or replace function public.profiles_guard_insert()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if current_user in ('authenticated', 'anon') and coalesce(new.is_platform_admin, false) then
    raise exception 'is_platform_admin kan niet via de API worden gezet'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke execute on function public.profiles_guard_insert() from public, anon, authenticated;

drop trigger if exists profiles_guard_insert on public.profiles;
create trigger profiles_guard_insert
  before insert on public.profiles
  for each row execute function public.profiles_guard_insert();

-- Controle na toepassen (verwacht: 2, de bestaande platformbeheerders):
--   select count(*) from profiles where is_platform_admin;
-- en als gewone gebruiker via de API:
--   update profiles set is_platform_admin = true where id = auth.uid();  -- moet falen met 42501
