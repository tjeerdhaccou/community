-- 129: Documenten in mappen
--
-- Een project heeft mappen. Elke map heeft een beheerder (een groep, of leeg:
-- dan beheren moderators en beheerders hem) en een eigen zichtbaarheid:
--   group      alleen de beheergroep
--   members    alle leden, zonder aspirant-leden en gasten
--   aspirants  leden en aspirant-leden (wat documents.visibility 'members' was)
--   public     iedereen in het project, ook gasten
-- Binnen een map één laag submappen. Een submap kan strenger zijn dan de map
-- (group_only: alleen de beheergroep), nooit ruimer.
--
-- Een document met map_id volgt de map. Een document zonder map_id (oude
-- stukken die met meerdere groepen gedeeld zijn) houdt de oude regels van
-- visibility en document_groups. documents.visibility wordt bij een document
-- met map bijgehouden door een trigger, zodat code die er nog op leunt (de
-- openbare pagina, de zoekfunctie) blijft kloppen.

-- 1. Tabellen -----------------------------------------------------------------

create table if not exists public.document_maps (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  owner_workgroup_id uuid references public.workgroups(id) on delete set null,
  audience text not null default 'aspirants'
    check (audience in ('group', 'members', 'aspirants', 'public')),
  -- De twee vaste mappen van elk project: 'public' (Voor iedereen) en
  -- 'members' (Alle leden). Uit vergaderingen staat in de map 'members'.
  kind text check (kind in ('public', 'members')),
  position int not null default 0,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists document_maps_project_idx on public.document_maps (project_id, position);
create unique index if not exists document_maps_kind_uniq on public.document_maps (project_id, kind) where kind is not null;

create table if not exists public.document_folders (
  id uuid primary key default gen_random_uuid(),
  map_id uuid not null references public.document_maps(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  group_only boolean not null default false,
  position int not null default 0,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists document_folders_map_idx on public.document_folders (map_id, position);

alter table public.documents
  add column if not exists map_id uuid references public.document_maps(id) on delete restrict,
  add column if not exists folder_id uuid references public.document_folders(id) on delete set null,
  add column if not exists pinned boolean not null default false;
create index if not exists documents_map_idx on public.documents (map_id);
create index if not exists documents_folder_idx on public.documents (folder_id);

-- 2. Hulpfuncties ---------------------------------------------------------------

-- Lid van een groep (elk type), voor de ingelogde gebruiker.
create or replace function public.is_workgroup_member(p_workgroup_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from workgroup_members
    where workgroup_id = p_workgroup_id and profile_id = auth.uid()
  );
$$;

-- Rolniveau van een profiel in een project: -1 zonder lidmaatschap.
-- Org-beheerders (ook projectbeheerders binnen hun scope) tellen als admin.
create or replace function public.project_role_level(p_project_id uuid, p_profile_id uuid)
returns int language sql stable security definer set search_path = public, pg_temp as $$
  select greatest(
    coalesce((
      select max(case m.role
        when 'guest' then 0 when 'professional' then 1 when 'aspirant' then 2
        when 'member' then 3 when 'moderator' then 4 when 'admin' then 5 else -1 end)
      from memberships m
      where m.project_id = p_project_id and m.profile_id = p_profile_id
    ), -1),
    case when exists (
      select 1 from projects p
      join org_members om on om.organization_id = p.organization_id
      where p.id = p_project_id and om.profile_id = p_profile_id and om.role = 'admin'
        and (om.project_ids is null or p.id = any (om.project_ids))
    ) then 5 else -1 end
  );
$$;

-- Mag dit profiel de inhoud van een map met deze kenmerken lezen? Op waarden
-- in plaats van een id, zodat het ook werkt voor een rij die net is ingevoegd
-- (insert ... returning) en in de meldingstrigger. Moderators zien de mappen
-- in het overzicht (om ze te beheren), maar de inhoud van een groepsmap alleen
-- als ze in de groep zitten, net als bij de oude groepsdocumenten.
create or replace function public.document_audience_ok(
  p_project_id uuid, p_audience text, p_owner_workgroup_id uuid, p_profile_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
      select 1 from projects p join org_members om on om.organization_id = p.organization_id
      where p.id = p_project_id and om.profile_id = p_profile_id and om.role = 'admin'
        and (om.project_ids is null or p.id = any (om.project_ids)))
    or case p_audience
      when 'public' then project_role_level(p_project_id, p_profile_id) >= 0
      when 'aspirants' then project_role_level(p_project_id, p_profile_id) >= 2
      when 'members' then project_role_level(p_project_id, p_profile_id) >= 3
      when 'group' then project_role_level(p_project_id, p_profile_id) >= 0 and exists (
        select 1 from workgroup_members wm
        where wm.workgroup_id = p_owner_workgroup_id and wm.profile_id = p_profile_id)
      else false
    end;
$$;

create or replace function public.document_map_readable_by(p_map_id uuid, p_profile_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((
    select document_audience_ok(dm.project_id, dm.audience, dm.owner_workgroup_id, p_profile_id)
    from document_maps dm where dm.id = p_map_id), false);
$$;

-- Mag dit profiel een document op deze plek (map, submap) lezen? De map, en
-- bij een submap met group_only ook het lidmaatschap van de beheergroep.
create or replace function public.document_place_readable_by(
  p_map_id uuid, p_folder_id uuid, p_profile_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1
    from document_maps dm
    left join document_folders f on f.id = p_folder_id
    where dm.id = p_map_id
      and document_audience_ok(dm.project_id, dm.audience, dm.owner_workgroup_id, p_profile_id)
      and (
        coalesce(f.group_only, false) = false
        or exists (select 1 from workgroup_members wm
                   where wm.workgroup_id = dm.owner_workgroup_id and wm.profile_id = p_profile_id)
        or exists (select 1 from projects p join org_members om on om.organization_id = p.organization_id
                   where p.id = dm.project_id and om.profile_id = p_profile_id and om.role = 'admin'
                     and (om.project_ids is null or p.id = any (om.project_ids)))
      )
  );
$$;

-- Dezelfde vragen voor de ingelogde gebruiker; deze gebruiken de policies.
-- De varianten met een profiel als argument zijn niet aan te roepen door
-- gebruikers (zie onderaan), zodat niemand kan uitproberen wie in welke groep zit.
create or replace function public.can_read_document_map(
  p_project_id uuid, p_audience text, p_owner_workgroup_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select document_audience_ok(p_project_id, p_audience, p_owner_workgroup_id, auth.uid());
$$;

create or replace function public.can_read_document_place(p_map_id uuid, p_folder_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select document_place_readable_by(p_map_id, p_folder_id, auth.uid());
$$;

-- Wie een document mag lezen, voor meldingen (alleen de service-rol).
create or replace function public.document_reader_ids(p_document_id uuid)
returns setof uuid language sql stable security definer set search_path = public, pg_temp as $$
  select m.profile_id
  from documents d
  join memberships m on m.project_id = d.project_id
  where d.id = p_document_id
    and (
      (d.map_id is not null and document_place_readable_by(d.map_id, d.folder_id, m.profile_id))
      or (d.map_id is null and (
        d.visibility = 'public'
        or (d.visibility = 'members' and m.role in ('aspirant', 'member', 'moderator', 'admin'))))
    );
$$;

-- Mag de ingelogde gebruiker in deze map documenten en submappen beheren?
-- Moderators en beheerders altijd; anders leden van de beheergroep.
create or replace function public.can_manage_document_map(p_map_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from document_maps dm
    where dm.id = p_map_id
      and (
        is_platform_admin()
        or has_membership(dm.project_id, 'moderator')
        or (dm.owner_workgroup_id is not null
            and has_membership(dm.project_id, 'aspirant')
            and is_workgroup_member(dm.owner_workgroup_id))
      )
  );
$$;

-- 3. Triggers ---------------------------------------------------------------------

-- Een document in een submap staat in de map van die submap. Zichtbaarheid
-- volgt de map: public blijft public, aspirants wordt members, en members
-- en group worden 'groups', zodat een oude lezer van visibility nooit ruimer
-- kijkt dan de map toestaat.
create or replace function public.documents_follow_map()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_project uuid;
  v_audience text;
begin
  if new.folder_id is not null then
    select map_id into new.map_id from document_folders where id = new.folder_id;
  end if;
  if new.map_id is not null then
    select project_id, audience into v_project, v_audience from document_maps where id = new.map_id;
    if v_project is distinct from new.project_id then
      raise exception 'Map hoort niet bij dit project';
    end if;
    new.visibility := case v_audience when 'public' then 'public' when 'aspirants' then 'members' else 'groups' end;
  end if;
  return new;
end $$;

drop trigger if exists documents_follow_map on public.documents;
create trigger documents_follow_map
  before insert or update of map_id, folder_id, project_id on public.documents
  for each row execute function public.documents_follow_map();

-- Verandert de zichtbaarheid van een map, dan schuiven de documenten mee.
create or replace function public.document_map_audience_changed()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update documents set map_id = map_id where map_id = new.id;
  return new;
end $$;

drop trigger if exists document_map_audience_changed on public.document_maps;
create trigger document_map_audience_changed
  after update of audience on public.document_maps
  for each row when (old.audience is distinct from new.audience)
  execute function public.document_map_audience_changed();

-- Een groepsmap heeft een beheergroep nodig; die moet bij hetzelfde project horen.
create or replace function public.document_maps_check()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if new.audience = 'group' and new.owner_workgroup_id is null then
    raise exception 'Een map die alleen de groep ziet, heeft een beheergroep nodig';
  end if;
  if new.owner_workgroup_id is not null and not exists (
    select 1 from workgroups where id = new.owner_workgroup_id and project_id = new.project_id
  ) then
    raise exception 'Deze groep hoort niet bij het project';
  end if;
  return new;
end $$;

drop trigger if exists document_maps_check on public.document_maps;
create trigger document_maps_check
  before insert or update on public.document_maps
  for each row execute function public.document_maps_check();

-- Elk nieuw project krijgt de twee vaste mappen.
create or replace function public.create_default_document_maps()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into document_maps (project_id, name, audience, kind, position, created_by)
  values (new.id, 'Voor iedereen', 'public', 'public', 0, null),
         (new.id, 'Alle leden', 'aspirants', 'members', 1, null)
  on conflict do nothing;
  return new;
end $$;

drop trigger if exists projects_default_document_maps on public.projects;
create trigger projects_default_document_maps
  after insert on public.projects
  for each row execute function public.create_default_document_maps();

-- Een melding over een nieuw document alleen voor wie het mag lezen.
create or replace function public.notify_on_document()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  member record;
begin
  for member in
    select profile_id from memberships
    where project_id = new.project_id and role in ('member', 'moderator', 'admin')
      and profile_id is distinct from new.uploaded_by
  loop
    if (new.map_id is null and new.visibility in ('public', 'members'))
       or (new.map_id is not null and document_place_readable_by(new.map_id, new.folder_id, member.profile_id)) then
      if should_notify(member.profile_id, 'documents') then
        insert into notifications (recipient_id, actor_id, project_id, type, title, related_id, related_type)
        values (member.profile_id, new.uploaded_by, new.project_id,
                'new_document', 'Nieuw document: ' || new.title, new.id, 'document');
      end if;
    end if;
  end loop;
  return new;
end $$;

-- 4. Rechten (RLS) -------------------------------------------------------------

alter table public.document_maps enable row level security;
alter table public.document_folders enable row level security;

-- Mappen: wie de inhoud mag lezen ziet de map; moderators zien alle mappen.
drop policy if exists "Document maps read" on public.document_maps;
create policy "Document maps read" on public.document_maps for select using (
  (select is_platform_admin())
  or has_membership(project_id, 'moderator')
  or can_read_document_map(project_id, audience, owner_workgroup_id)
);
drop policy if exists "Demo read document_maps" on public.document_maps;
create policy "Demo read document_maps" on public.document_maps for select using (is_demo_project(project_id));

-- Een map maken: moderators, of een groepslid voor een map van de eigen groep.
drop policy if exists "Document maps insert" on public.document_maps;
create policy "Document maps insert" on public.document_maps for insert with check (
  kind is null and (
    (select is_platform_admin())
    or has_membership(project_id, 'moderator')
    or (owner_workgroup_id is not null and has_membership(project_id, 'aspirant')
        and is_workgroup_member(owner_workgroup_id))
  )
);

-- Bijwerken: moderators, of de beheergroep (die de map niet aan een andere
-- groep kan geven waar ze zelf niet in zit).
drop policy if exists "Document maps update" on public.document_maps;
create policy "Document maps update" on public.document_maps for update
using (can_manage_document_map(id))
with check (
  (select is_platform_admin())
  or has_membership(project_id, 'moderator')
  or (owner_workgroup_id is not null and is_workgroup_member(owner_workgroup_id))
);

-- Verwijderen: moderators of de beheergroep, nooit een vaste map. Een map met
-- documenten weigert de database (documents.map_id on delete restrict).
drop policy if exists "Document maps delete" on public.document_maps;
create policy "Document maps delete" on public.document_maps for delete using (
  kind is null and can_manage_document_map(id)
);

drop policy if exists "Document folders read" on public.document_folders;
create policy "Document folders read" on public.document_folders for select using (
  exists (select 1 from document_maps dm where dm.id = document_folders.map_id
          and ((select is_platform_admin()) or has_membership(dm.project_id, 'moderator')
               or can_read_document_map(dm.project_id, dm.audience, dm.owner_workgroup_id)))
);
drop policy if exists "Demo read document_folders" on public.document_folders;
create policy "Demo read document_folders" on public.document_folders for select using (
  exists (select 1 from document_maps dm where dm.id = document_folders.map_id and is_demo_project(dm.project_id))
);
drop policy if exists "Document folders write" on public.document_folders;
create policy "Document folders write" on public.document_folders for all
using (can_manage_document_map(map_id))
with check (can_manage_document_map(map_id));

-- Documenten lezen: met map via de map, zonder map de oude regels.
drop policy if exists "Document visibility read" on public.documents;
create policy "Document visibility read" on public.documents for select using (
  (select is_platform_admin())
  or exists (select 1 from projects p where p.id = documents.project_id and is_org_admin(p.organization_id))
  or (map_id is not null and can_read_document_place(map_id, folder_id))
  or (map_id is null and (
    (visibility = 'public' and has_membership(project_id, 'guest'))
    or (visibility = 'members' and has_membership(project_id, 'aspirant'))
    or (visibility = 'groups' and has_membership(project_id, 'aspirant') and exists (
      select 1 from document_groups dg
      join workgroup_members wm on wm.workgroup_id = dg.workgroup_id
      where dg.document_id = documents.id and wm.profile_id = (select auth.uid())))
  ))
);

-- Documenten toevoegen: moderators, of wie de map beheert. De oude route voor
-- commissieleden (groepsdocument zonder map) blijft bestaan.
drop policy if exists "Moderators can upload documents" on public.documents;
drop policy if exists "Documents insert: admins, moderators, commissie" on public.documents;
create policy "Documents insert: admins, moderators, map beheerders" on public.documents for insert with check (
  (select is_platform_admin())
  or exists (select 1 from projects p where p.id = documents.project_id and is_org_admin(p.organization_id))
  or has_membership(project_id, 'moderator')
  or (map_id is not null and can_manage_document_map(map_id))
  or (folder_id is not null and exists (select 1 from document_folders f where f.id = folder_id and can_manage_document_map(f.map_id)))
  or (map_id is null and folder_id is null and visibility = 'groups' and is_commissie_member(project_id))
);

-- Bijwerken (titel, vastzetten, verplaatsen): moderators, wie de map beheert,
-- en commissieleden hun eigen oude uploads. Verplaatsen kan alleen naar een
-- map die je ook beheert.
drop policy if exists "Documents update: admins, moderators, own commissie uploads" on public.documents;
create policy "Documents update: admins, moderators, map beheerders" on public.documents for update
using (
  (select is_platform_admin())
  or exists (select 1 from projects p where p.id = documents.project_id and is_org_admin(p.organization_id))
  or has_membership(project_id, 'moderator')
  or (map_id is not null and can_manage_document_map(map_id))
  or (uploaded_by = (select auth.uid()) and is_commissie_member(project_id))
)
with check (
  (select is_platform_admin())
  or exists (select 1 from projects p where p.id = documents.project_id and is_org_admin(p.organization_id))
  or has_membership(project_id, 'moderator')
  or (map_id is not null and can_manage_document_map(map_id))
  or (folder_id is not null and exists (select 1 from document_folders f where f.id = folder_id and can_manage_document_map(f.map_id)))
  or (map_id is null and uploaded_by = (select auth.uid()) and is_commissie_member(project_id))
);

-- Verwijderen: beheerders, wie de map beheert, en commissieleden hun eigen uploads.
drop policy if exists "Documents delete: admins, own commissie uploads" on public.documents;
create policy "Documents delete: admins, map beheerders, own commissie uploads" on public.documents for delete using (
  (select is_platform_admin())
  or exists (select 1 from projects p where p.id = documents.project_id and is_org_admin(p.organization_id))
  or has_membership(project_id, 'admin')
  or (map_id is not null and can_manage_document_map(map_id))
  or (uploaded_by = (select auth.uid()) and is_commissie_member(project_id))
);

-- Functies met een profiel als argument: niet voor gebruikers.
revoke execute on function public.project_role_level(uuid, uuid) from public;
revoke execute on function public.document_audience_ok(uuid, text, uuid, uuid) from public;
revoke execute on function public.document_map_readable_by(uuid, uuid) from public;
revoke execute on function public.document_place_readable_by(uuid, uuid, uuid) from public;
revoke execute on function public.document_reader_ids(uuid) from public;
do $$
begin
  revoke execute on function public.project_role_level(uuid, uuid) from anon, authenticated;
  revoke execute on function public.document_audience_ok(uuid, text, uuid, uuid) from anon, authenticated;
  revoke execute on function public.document_map_readable_by(uuid, uuid) from anon, authenticated;
  revoke execute on function public.document_place_readable_by(uuid, uuid, uuid) from anon, authenticated;
  revoke execute on function public.document_reader_ids(uuid) from anon, authenticated;
  grant execute on function public.document_reader_ids(uuid) to service_role;
exception when undefined_object then null;
end $$;

-- 5. Auditlog -------------------------------------------------------------------

drop trigger if exists audit_document_maps on public.document_maps;
create trigger audit_document_maps after insert or delete or update on public.document_maps
  for each row execute function audit_row_change('document_map', 'name,audience,owner_workgroup_id', '');
drop trigger if exists audit_document_folders on public.document_folders;
create trigger audit_document_folders after insert or delete or update on public.document_folders
  for each row execute function audit_row_change('document_folder', 'name,group_only', '');
drop trigger if exists audit_documents on public.documents;
create trigger audit_documents after insert or delete or update on public.documents
  for each row execute function audit_row_change('document', 'title,category,visibility,map_id,folder_id', '');

-- 6. Bestaande documenten overzetten -------------------------------------------

-- De twee vaste mappen voor elk bestaand project.
insert into public.document_maps (project_id, name, audience, kind, position, created_by)
select p.id, v.name, v.audience, v.kind, v.position, null::uuid
from public.projects p
cross join (values ('Voor iedereen', 'public', 'public', 0), ('Alle leden', 'aspirants', 'members', 1))
  as v(name, audience, kind, position)
on conflict do nothing;

-- Een groepsmap voor elke groep die al groepsdocumenten heeft.
insert into public.document_maps (project_id, name, owner_workgroup_id, audience, position, created_by)
select distinct w.project_id, w.name, w.id, 'group', 10 + coalesce(w.sort_order, 0), null::uuid
from public.document_groups dg
join public.workgroups w on w.id = dg.workgroup_id
where not exists (select 1 from public.document_maps dm where dm.owner_workgroup_id = w.id);

-- Documenten in hun map: public en members in de vaste mappen, een
-- groepsdocument met precies één groep in die groepsmap. Met meerdere groepen
-- blijft map_id leeg en gelden de oude regels.
update public.documents d set map_id = dm.id
from public.document_maps dm
where d.map_id is null and dm.project_id = d.project_id
  and ((d.visibility = 'public' and dm.kind = 'public')
    or (d.visibility = 'members' and dm.kind = 'members'));

update public.documents d set map_id = dm.id
from public.document_groups dg
join public.document_maps dm on dm.owner_workgroup_id = dg.workgroup_id
where d.map_id is null and d.visibility = 'groups' and dg.document_id = d.id
  and (select count(*) from public.document_groups x where x.document_id = d.id) = 1;

-- Categorieën worden submappen, alleen waar ze gebruikt worden. Overig blijft los.
insert into public.document_folders (map_id, name, position, created_by)
select distinct d.map_id,
  case d.category
    when 'ontwerp_visualisatie' then 'Ontwerp'
    when 'juridisch' then 'Juridisch'
    when 'vergunning_technisch' then 'Vergunning en techniek'
    when 'financieel' then 'Financieel'
    when 'verkoop_informatie' then 'Verkoop en informatie'
    when 'vergadering' then 'Vergaderstukken'
  end,
  case d.category
    when 'ontwerp_visualisatie' then 0 when 'juridisch' then 1 when 'vergunning_technisch' then 2
    when 'financieel' then 3 when 'verkoop_informatie' then 4 when 'vergadering' then 5
  end,
  null::uuid
from public.documents d
where d.map_id is not null and d.category <> 'overig'
  and not exists (select 1 from public.document_folders f where f.map_id = d.map_id);

update public.documents d set folder_id = f.id
from public.document_folders f
where d.folder_id is null and f.map_id = d.map_id
  and f.name = case d.category
    when 'ontwerp_visualisatie' then 'Ontwerp'
    when 'juridisch' then 'Juridisch'
    when 'vergunning_technisch' then 'Vergunning en techniek'
    when 'financieel' then 'Financieel'
    when 'verkoop_informatie' then 'Verkoop en informatie'
    when 'vergadering' then 'Vergaderstukken'
  end;
