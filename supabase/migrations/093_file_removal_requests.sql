-- ============================================================================
-- 093_file_removal_requests.sql
-- AVG-conform verwijderingsverzoek: een member kan aanvragen dat een document
-- uit z'n dossier verwijderd wordt, ook als het door het team is geplaatst.
-- Admin/moderator beslist, met verplicht notitie-veld bij afwijzing.
--
-- Rationale: art. 17 AVG (recht op vergetelheid). Zonder deze flow kunnen
-- leden alleen hun eigen uploads direct verwijderen; voor team-uploads was
-- er geen ingang, wat AVG-compliance ondermijnt.
-- ============================================================================

create table if not exists public.file_removal_requests (
  id             uuid        primary key default gen_random_uuid(),
  member_file_id uuid        not null references public.member_files(id) on delete cascade,
  project_id     uuid        not null references public.projects(id) on delete cascade,
  requested_by   uuid        not null references auth.users(id) on delete cascade,
  reason         text,
  status         text        not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  decided_by     uuid        references auth.users(id) on delete set null,
  decided_at     timestamptz,
  decision_note  text,
  created_at     timestamptz not null default now()
);

create index if not exists file_removal_requests_project_status_idx
  on public.file_removal_requests (project_id, status);
create index if not exists file_removal_requests_file_idx
  on public.file_removal_requests (member_file_id);

alter table public.file_removal_requests enable row level security;

-- SELECT: aanvrager ziet eigen verzoeken; admin/moderator van het project ziet alle.
drop policy if exists "removal_requests_select" on public.file_removal_requests;
create policy "removal_requests_select"
  on public.file_removal_requests for select
  using (
    requested_by = auth.uid()
    or has_membership(project_id, 'moderator')
    or is_platform_admin()
  );

-- INSERT: een lid mag alleen een verzoek maken voor een file uit z'n eigen dossier,
-- en alleen als er nog geen open verzoek is (unique-index kan geen partial doen
-- omdat we ook op status willen filteren — check via exists in policy).
drop policy if exists "removal_requests_insert" on public.file_removal_requests;
create policy "removal_requests_insert"
  on public.file_removal_requests for insert
  with check (
    requested_by = auth.uid()
    and exists (
      select 1 from public.member_files mf
      where mf.id = member_file_id
        and mf.profile_id = auth.uid()
        and mf.project_id = file_removal_requests.project_id
    )
  );

-- UPDATE: alleen admin/moderator van het project (of platform admin) mag beslissen.
drop policy if exists "removal_requests_update" on public.file_removal_requests;
create policy "removal_requests_update"
  on public.file_removal_requests for update
  using (has_membership(project_id, 'moderator') or is_platform_admin())
  with check (has_membership(project_id, 'moderator') or is_platform_admin());

-- Realtime aanzetten zodat admin-view live meebeweegt bij nieuwe verzoeken.
alter publication supabase_realtime add table public.file_removal_requests;

-- Voorkom dubbele open verzoeken per file: partial unique index op status=pending.
create unique index if not exists file_removal_requests_one_pending_per_file
  on public.file_removal_requests (member_file_id)
  where status = 'pending';
