-- ============================================================================
-- 128_gevoelige_stukken_en_bewaartermijnen.sql
--
-- Buuur bewaart uitkomsten, geen identiteitsbewijzen.
--
-- 1. Identiteitscontrole zonder upload: nieuw verzoektype 'identity_check'.
--    De beoordelaar laat het bewijs tonen en legt alleen vast: soort document,
--    geldig tot, gecontroleerd door, datum. Geen bestand, geen BSN, geen
--    documentnummer. Uploaden met categorie 'identiteit' kan niet meer.
-- 2. Beoordelaars: gevoelige stukken (categorie financieel en identiteit) zijn
--    alleen zichtbaar voor beoordelaars van dat project. Moderators en
--    platformbeheerders zien ze niet meer.
-- 3. Bewaartermijn: financiële stukken krijgen automatisch een vervaldatum
--    (standaard 30 dagen, per project korter in te stellen, 30 is het maximum).
--    Na het vastleggen van de uitkomst vervalt het stuk binnen 24 uur.
--    De edge function `retention-cleanup` ruimt elk uur op, ook in de back-up.
-- 4. Uploaden naar bucket member-files is beperkt tot het eigen project.
--
-- Kan breken:
--   * Tot er per project beoordelaars zijn aangewezen ziet niemand uit het team
--     financiële stukken en verzoeken. Wijs ze direct na het toepassen aan
--     (beheeromgeving: project > instellingen > Gevoelige stukken).
--   * Bestaande stukken bij financiële verzoeken krijgen categorie 'financieel'
--     en vervallen 30 dagen na het toepassen van deze migratie (stap 9).
--   * De edge functions `retention-cleanup` (nieuw) en `storage-backup`
--     (aangepast) moeten apart worden uitgerold, beide met --no-verify-jwt.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Hulpfuncties
-- ----------------------------------------------------------------------------

create or replace function public.is_sensitive_category(p_category text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(p_category in ('financieel', 'identiteit'), false);
$$;

-- ----------------------------------------------------------------------------
-- 2. Beoordelaars per project
-- ----------------------------------------------------------------------------

create table if not exists public.project_reviewers (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects(id) on delete cascade,
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  granted_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (project_id, profile_id)
);

create index if not exists project_reviewers_profile_idx on public.project_reviewers (profile_id);

alter table public.project_reviewers enable row level security;

-- Beoordelaar ben je alleen zolang je ook nog bij het team van het project
-- hoort (moderator, beheerder of organisatiebeheerder met toegang tot het
-- project). In het demoproject staan alleen verzonnen gegevens; daar geldt het
-- hele team als beoordelaar, zodat de demo compleet blijft.
create or replace function public.is_project_reviewer(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select has_membership(p_project_id, 'moderator')
     and (
       exists (
         select 1 from project_reviewers r
         where r.project_id = p_project_id and r.profile_id = auth.uid()
       )
       or exists (select 1 from projects p where p.id = p_project_id and p.is_demo)
     );
$$;

-- Het team ziet wie beoordelaar is; alleen projectbeheerders wijzen ze aan.
-- Platformbeheerders hebben hier bewust geen ingang: wie gevoelige stukken wil
-- inzien moet als beheerder van het project zichzelf aanwijzen, en dat staat
-- dan in de auditlog.
drop policy if exists "project_reviewers_select" on public.project_reviewers;
create policy "project_reviewers_select" on public.project_reviewers for select
  using (profile_id = auth.uid() or has_membership(project_id, 'moderator'));

drop policy if exists "project_reviewers_insert" on public.project_reviewers;
create policy "project_reviewers_insert" on public.project_reviewers for insert
  with check (has_membership(project_id, 'admin') and granted_by = auth.uid());

drop policy if exists "project_reviewers_delete" on public.project_reviewers;
create policy "project_reviewers_delete" on public.project_reviewers for delete
  using (has_membership(project_id, 'admin'));

revoke all on public.project_reviewers from anon;
grant select, insert, delete on public.project_reviewers to authenticated;

drop trigger if exists audit_project_reviewers on public.project_reviewers;
create trigger audit_project_reviewers
  after insert or delete on public.project_reviewers
  for each row execute function public.audit_row_change('project_reviewer', '', '');

-- ----------------------------------------------------------------------------
-- 3. Toegangsfuncties voor stukken en verzoeken
-- ----------------------------------------------------------------------------

create or replace function public.can_access_member_file(p_project_id uuid, p_category text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case
    when is_sensitive_category(p_category) then is_project_reviewer(p_project_id)
    else has_membership(p_project_id, 'moderator') or is_platform_admin()
  end;
$$;

create or replace function public.can_access_document_request(p_project_id uuid, p_category text, p_type text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case
    when is_sensitive_category(p_category) or p_type = 'identity_check' then is_project_reviewer(p_project_id)
    else has_membership(p_project_id, 'moderator') or is_platform_admin()
  end;
$$;

-- ----------------------------------------------------------------------------
-- 4. Bewaartermijn per project
-- ----------------------------------------------------------------------------

alter table public.projects
  add column if not exists sensitive_retention_days integer not null default 30;

alter table public.projects drop constraint if exists projects_sensitive_retention_days_check;
alter table public.projects add constraint projects_sensitive_retention_days_check
  check (sensitive_retention_days between 1 and 30);

comment on column public.projects.sensitive_retention_days is
  'Aantal dagen dat een financieel stuk in een ledendossier blijft staan. Maximaal 30.';

-- ----------------------------------------------------------------------------
-- 5. Identiteitscontrole op document_requests
-- ----------------------------------------------------------------------------

alter table public.document_requests
  add column if not exists identity_document_type text,
  add column if not exists identity_valid_until date,
  add column if not exists identity_checked_on date;

alter table public.document_requests drop constraint if exists document_requests_type_check;
alter table public.document_requests add constraint document_requests_type_check
  check (type in ('upload_request', 'sign_request', 'review_document', 'identity_check'));

alter table public.document_requests drop constraint if exists document_requests_identity_document_type_check;
alter table public.document_requests add constraint document_requests_identity_document_type_check
  check (identity_document_type is null or identity_document_type in ('paspoort', 'id_kaart', 'rijbewijs'));

-- Een identiteitscontrole heeft nooit een bestand.
alter table public.document_requests drop constraint if exists document_requests_identity_no_file;
alter table public.document_requests add constraint document_requests_identity_no_file
  check (type <> 'identity_check' or (attached_file_id is null and response_file_id is null));

-- De uitkomstvelden horen alleen bij een identiteitscontrole.
alter table public.document_requests drop constraint if exists document_requests_identity_fields_only_for_check;
alter table public.document_requests add constraint document_requests_identity_fields_only_for_check
  check (
    type = 'identity_check'
    or (identity_document_type is null and identity_valid_until is null and identity_checked_on is null)
  );

-- Een afgeronde controle is compleet: soort, geldig tot, door wie, wanneer.
alter table public.document_requests drop constraint if exists document_requests_identity_outcome_complete;
alter table public.document_requests add constraint document_requests_identity_outcome_complete
  check (
    type <> 'identity_check' or status <> 'approved'
    or (identity_document_type is not null and identity_valid_until is not null
        and identity_checked_on is not null and reviewer_id is not null)
  );

create or replace function public.document_requests_guard()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
begin
  if tg_op = 'INSERT' then
    if new.type = 'identity_check' then
      new.category := 'identiteit';
    elsif new.category = 'identiteit' then
      raise exception 'Een identiteitsbewijs wordt niet geüpload. Maak een identiteitscontrole aan.'
        using errcode = 'check_violation';
    end if;
    return new;
  end if;

  if (new.type = 'identity_check') <> (old.type = 'identity_check') then
    raise exception 'Het type van dit verzoek kan niet worden gewijzigd.' using errcode = 'check_violation';
  end if;
  if new.type = 'identity_check' then
    new.category := 'identiteit';
  elsif new.category = 'identiteit' and old.category is distinct from 'identiteit' then
    raise exception 'Een identiteitsbewijs wordt niet geüpload. Maak een identiteitscontrole aan.'
      using errcode = 'check_violation';
  end if;

  -- Service-rol (cron, edge functions) en SQL-beheer.
  if v_uid is null then
    return new;
  end if;

  if not can_access_document_request(old.project_id, old.category, old.type) then
    -- Dit is het lid zelf (RLS laat alleen de eigen rij toe). Een lid mag
    -- alleen een reactie indienen, niet zijn eigen verzoek beoordelen.
    if old.type = 'identity_check' then
      raise exception 'Een identiteitscontrole wordt door de beoordelaar vastgelegd.'
        using errcode = 'insufficient_privilege';
    end if;
    if new.status <> 'submitted' or old.status = 'approved' then
      raise exception 'Je kunt alleen een reactie indienen op een openstaand verzoek.'
        using errcode = 'insufficient_privilege';
    end if;
    if (to_jsonb(new) - array['response_file_id', 'status', 'updated_at'])
       is distinct from (to_jsonb(old) - array['response_file_id', 'status', 'updated_at']) then
      raise exception 'Je kunt alleen een reactie indienen op een openstaand verzoek.'
        using errcode = 'insufficient_privilege';
    end if;
    return new;
  end if;

  -- "Gecontroleerd door" en de datum komen van de database, niet van de client.
  if new.type = 'identity_check'
     and new.status is distinct from old.status
     and new.status in ('approved', 'rejected') then
    new.reviewer_id := v_uid;
    new.reviewed_at := now();
    if new.status = 'approved' then
      new.identity_checked_on := coalesce(new.identity_checked_on, current_date);
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists document_requests_guard on public.document_requests;
create trigger document_requests_guard
  before insert or update on public.document_requests
  for each row execute function public.document_requests_guard();

-- Zodra de uitkomst van een gevoelig uploadverzoek is vastgelegd mag het stuk
-- weg: het vervalt binnen 24 uur (ruimte om een vergissing te herstellen).
create or replace function public.document_requests_expire_reviewed_files()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status in ('approved', 'rejected')
     and new.status is distinct from old.status
     and new.type = 'upload_request'
     and is_sensitive_category(new.category) then
    update member_files mf
       set expires_at = least(coalesce(mf.expires_at, 'infinity'::timestamptz), now() + interval '24 hours')
     where mf.project_id = new.project_id
       and mf.profile_id = new.profile_id
       and (mf.id = new.response_file_id or mf.request_id = new.id)
       and mf.id is distinct from new.attached_file_id
       and not exists (select 1 from projects p where p.id = mf.project_id and p.is_demo);
  end if;
  return null;
end;
$$;

drop trigger if exists document_requests_expire_reviewed_files on public.document_requests;
create trigger document_requests_expire_reviewed_files
  after update of status on public.document_requests
  for each row execute function public.document_requests_expire_reviewed_files();

drop policy if exists "project_admins_all" on public.document_requests;
drop policy if exists "document_requests_staff_all" on public.document_requests;
create policy "document_requests_staff_all" on public.document_requests for all
  using (can_access_document_request(project_id, category, type))
  with check (can_access_document_request(project_id, category, type));

-- ----------------------------------------------------------------------------
-- 6. member_files: categorie volgt het verzoek, vervaldatum, geen identiteit
-- ----------------------------------------------------------------------------

create or replace function public.member_files_guard()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_req document_requests%rowtype;
  v_days integer;
  v_demo boolean;
  -- Oude waarden; bij een INSERT bestaat OLD niet.
  v_old_request uuid;
  v_old_category text;
  v_old_expires timestamptz;
begin
  if tg_op = 'UPDATE' then
    v_old_request := old.request_id;
    v_old_category := old.category;
    v_old_expires := old.expires_at;
  end if;

  -- Een stuk dat bij een verzoek hoort krijgt de gevoelige categorie van dat
  -- verzoek, ook als de client 'overig' meestuurt.
  if new.request_id is not null and new.request_id is distinct from v_old_request then
    select * into v_req from document_requests where id = new.request_id;
    if found then
      if v_req.project_id <> new.project_id or v_req.profile_id <> new.profile_id then
        raise exception 'Dit verzoek hoort niet bij dit dossier.' using errcode = 'check_violation';
      end if;
      if v_req.type = 'identity_check' or v_req.category = 'identiteit' then
        raise exception 'Bij een identiteitscontrole wordt geen bestand geüpload.' using errcode = 'check_violation';
      end if;
      if is_sensitive_category(v_req.category) then
        new.category := v_req.category;
      end if;
    end if;
  end if;

  if new.category = 'identiteit' and v_old_category is distinct from 'identiteit' then
    raise exception 'Identiteitsbewijzen worden niet opgeslagen. Leg een identiteitscontrole vast.'
      using errcode = 'check_violation';
  end if;

  if new.category = 'financieel' then
    select p.sensitive_retention_days, p.is_demo into v_days, v_demo from projects p where p.id = new.project_id;
    if not coalesce(v_demo, false) then
      if v_old_category is distinct from 'financieel' or v_old_expires is null then
        new.expires_at := least(
          coalesce(new.expires_at, 'infinity'::timestamptz),
          now() + make_interval(days => coalesce(v_days, 30))
        );
      else
        -- Een bestaande vervaldatum kan alleen eerder worden, niet later.
        new.expires_at := least(coalesce(new.expires_at, v_old_expires), v_old_expires);
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists member_files_guard on public.member_files;
create trigger member_files_guard
  before insert or update on public.member_files
  for each row execute function public.member_files_guard();

create index if not exists member_files_file_path_idx on public.member_files (file_path);
create index if not exists member_files_expires_at_idx on public.member_files (expires_at) where expires_at is not null;

drop policy if exists "project_admins_all" on public.member_files;
drop policy if exists "member_files_staff_all" on public.member_files;
create policy "member_files_staff_all" on public.member_files for all
  using (can_access_member_file(project_id, category))
  with check (can_access_member_file(project_id, category));

-- ----------------------------------------------------------------------------
-- 7. Storage: bucket member-files
-- ----------------------------------------------------------------------------

-- Pad is <project>/<profiel>/<bestand> (app) of <org>/<project>/<profiel>/<bestand>
-- (beheeromgeving): het project is altijd de op twee na laatste stap.
create or replace function public.member_files_path_project(p_name text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_parts text[] := string_to_array(p_name, '/');
  v_n integer := coalesce(array_length(v_parts, 1), 0);
begin
  if v_n < 3 then
    return null;
  end if;
  if v_parts[v_n - 2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return v_parts[v_n - 2]::uuid;
  end if;
  return null;
end;
$$;

create or replace function public.can_access_member_file_object(p_name text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from member_files mf
    where mf.file_path = p_name
      and can_access_member_file(mf.project_id, mf.category)
  );
$$;

-- Lezen: het lid zelf (laatste map is het eigen profiel) of wie het stuk in
-- member_files mag zien. Platformbeheerders hebben geen eigen ingang meer.
drop policy if exists "member_files_select" on storage.objects;
create policy "member_files_select" on storage.objects for select
  using (
    bucket_id = 'member-files'
    and (
      (auth.uid())::text = (storage.foldername(name))[array_length(storage.foldername(name), 1)]
      or public.can_access_member_file_object(name)
    )
  );

drop policy if exists "member_files_delete" on storage.objects;
create policy "member_files_delete" on storage.objects for delete
  using (
    bucket_id = 'member-files'
    and (
      (auth.uid())::text = (storage.foldername(name))[array_length(storage.foldername(name), 1)]
      or public.can_access_member_file_object(name)
    )
  );

-- Uploaden: het lid in de eigen map, of het team van het project uit het pad.
-- Voorheen mocht een moderator van welk project dan ook overal uploaden.
drop policy if exists "member_files_insert" on storage.objects;
create policy "member_files_insert" on storage.objects for insert
  with check (
    bucket_id = 'member-files'
    and (
      (auth.uid())::text = (storage.foldername(name))[array_length(storage.foldername(name), 1)]
      or public.has_membership(public.member_files_path_project(name), 'moderator')
      or (public.is_platform_admin() and public.member_files_path_project(name) is not null)
    )
  );

-- ----------------------------------------------------------------------------
-- 8. Opschoonroutine: elk uur verlopen stukken weg, ook uit de back-up
-- ----------------------------------------------------------------------------

select cron.schedule(
  'retention-cleanup',
  '7 * * * *',
  $$ select net.http_post(
       url := 'https://czgsqmbejsmcjusigwhp.supabase.co/functions/v1/retention-cleanup',
       headers := '{"Content-Type":"application/json"}'::jsonb,
       body := jsonb_build_object('ticket', public.cron_ticket('retention-cleanup'))
     ) $$
);

-- ----------------------------------------------------------------------------
-- 9. Bestaande gegevens
-- ----------------------------------------------------------------------------

-- Stukken die bij een financieel verzoek horen stonden als 'overig' in het
-- dossier en waren daarmee voor het hele team zichtbaar. Ze krijgen de
-- categorie van het verzoek; de trigger zet de vervaldatum op vandaag plus de
-- bewaartermijn van het project. Het demoproject blijft buiten beschouwing.
update public.member_files mf
   set category = 'financieel'
  from public.document_requests dr
 where dr.category = 'financieel'
   and (mf.request_id = dr.id or mf.id = dr.response_file_id or mf.id = dr.attached_file_id)
   and mf.category <> 'financieel'
   and not exists (select 1 from public.projects p where p.id = mf.project_id and p.is_demo);

-- Beoordelaars worden bewust niet automatisch gevuld: aanwijzen is een keuze
-- van de projectbeheerder. Wie de huidige beheerders (niet de moderators) in
-- één keer beoordelaar wil maken kan dit eenmalig draaien:
--
--   insert into public.project_reviewers (project_id, profile_id)
--   select m.project_id, m.profile_id from public.memberships m
--    where m.role = 'admin'
--   on conflict do nothing;
