-- 121: projects.custom_domain alleen nog door platformbeheer te wijzigen (MIDDEL)
--
-- Probleem: een projectbeheerder mag de eigen projectrij bijwerken, ook
-- custom_domain. De community-app bouwt daar links mee en gaf bij het wisselen
-- van subdomein de sessietokens van de bezoeker mee aan dat domein
-- (navigateToSubdomain). Met een eigen domein in dat veld kwam de sessie van
-- wie doorklikte (ook een organisatie- of platformbeheerder) bij een vreemde
-- site terecht. De app geeft sinds de commit bij deze migratie alleen nog tokens
-- mee aan buuur.nl en subdomeinen daarvan; dit zet ook het veld zelf vast.
--
-- Risico dat dit iets breekt: laag. Geen van beide apps schrijft custom_domain
-- via de API; de trigger set_project_custom_domain (bij aanmaken) en de
-- service-rol blijven werken. Een eigen domein voor een klant instellen gaat
-- daarna via een platformbeheerder of de SQL Editor.

create or replace function public.projects_guard_custom_domain()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if current_user in ('authenticated', 'anon')
     and new.custom_domain is distinct from old.custom_domain
     and not public.is_platform_admin() then
    raise exception 'custom_domain kan alleen door platformbeheer worden gewijzigd'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke execute on function public.projects_guard_custom_domain() from public, anon, authenticated;

drop trigger if exists projects_guard_custom_domain on public.projects;
create trigger projects_guard_custom_domain
  before update on public.projects
  for each row execute function public.projects_guard_custom_domain();
