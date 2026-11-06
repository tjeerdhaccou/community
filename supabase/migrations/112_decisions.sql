-- ============================================================================
-- 112_decisions.sql — Besluitvormingsmodule (fase 1)
--
-- Zie BESLUITVORMING_SPEC.md. Gedeeld door community (voorkant) en buuur-admin
-- (CMS): ALLE beslislogica staat hier, in SQL, zodat twee codebases nooit
-- verschillend kunnen rekenen.
--
--   decision_rules         1 rij per project (lazy aangemaakt met defaults)
--   households             huishoudens; memberships.household_id
--   workgroups.is_board / mandate_amount / mandate_description
--   proposals              alle vormen (idea, poll, consent, vote, mandate)
--   proposal_attachments   bijlagen (bucket project-files)
--   proposal_electorate    snapshot stemgerechtigde eenheden bij publicatie
--   proposal_responses     huidige reactie per eenheid
--   proposal_response_log  alle wijzigingen (append-only)
--   proposal_questions     vragenronde
--   proposal_events        wachtrij voor notificaties (edge fn decision-notify)
--   decision_log           view: besluitenlijst (voorstellen + vergaderbesluiten)
--
-- Schrijven van status/reacties gaat uitsluitend via SECURITY DEFINER RPC's:
--   publish_proposal, extend_proposal_deadline, withdraw_proposal,
--   cast_response, overrule_objection, create_proposal_version,
--   close_due_proposals (cron)
-- Lezen van tellingen via proposal_tally / proposal_pending_units.
--
-- Breuken i.p.v. percentages: 2/3 van 18 is exact 12 (geen 66,67%-afronding).
--   quorum:              reacties * den >= num * eenheden
--   gewone meerderheid:  voor * den  >  num * (voor + tegen)   (strikt)
--   zware meerderheid:   voor * den >= num * (voor + tegen)
-- ============================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ---------------------------------------------------------------------------
-- 0. Helpers
-- ---------------------------------------------------------------------------

-- Module staat expliciet aan? (opt-in, anders dan andere features)
create or replace function decisions_enabled(p_project_id uuid)
returns boolean language sql stable security definer
set search_path = public, pg_temp as $$
  select coalesce((select (features->>'decisions')::boolean from projects where id = p_project_id), false);
$$;

-- Mag de gebruiker voorstellen in dit project lezen?
create or replace function can_view_decisions(p_project_id uuid)
returns boolean language sql stable security definer
set search_path = public, pg_temp as $$
  select has_membership(p_project_id, 'aspirant') or is_platform_admin() or is_demo_project(p_project_id);
$$;

-- Mag de gebruiker namens deze groep (commissie of bestuur) inbrengen?
create or replace function can_submit_for_group(p_project_id uuid, p_workgroup_id uuid)
returns boolean language sql stable security definer
set search_path = public, pg_temp as $$
  select exists (
    select 1 from workgroups w
    where w.id = p_workgroup_id
      and w.project_id = p_project_id
      and (w.type = 'commissie' or w.is_board)
      and (
        has_membership(p_project_id, 'moderator')
        or is_platform_admin()
        or exists (select 1 from workgroup_members wm where wm.workgroup_id = w.id and wm.profile_id = auth.uid())
      )
  );
$$;

-- Mag de gebruiker dit voorstel beheren (publiceren, verlengen, intrekken,
-- vragen beantwoorden, zien wie nog niet reageerde)? Kolommen als argumenten
-- zodat policies op proposals niet recursief proposals hoeven te lezen.
create or replace function can_manage_proposal(p_project_id uuid, p_workgroup_id uuid, p_created_by uuid)
returns boolean language sql stable security definer
set search_path = public, pg_temp as $$
  select has_membership(p_project_id, 'moderator')
      or is_platform_admin()
      or (p_created_by is not null and p_created_by = auth.uid())
      or (p_workgroup_id is not null and exists (
            select 1 from workgroup_members wm
            where wm.workgroup_id = p_workgroup_id and wm.profile_id = auth.uid()));
$$;

create or replace function decisions_touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

-- Interne vlag: alleen de RPC's hieronder mogen status-velden muteren.
create or replace function decisions_rpc_on() returns void language sql as $$
  select set_config('app.decisions_rpc', 'on', true);
$$;

-- ---------------------------------------------------------------------------
-- 1. Workgroups: bestuur + mandaat
-- ---------------------------------------------------------------------------
alter table workgroups
  add column if not exists is_board boolean not null default false,
  add column if not exists mandate_amount numeric(12,2),
  add column if not exists mandate_description text;

-- ---------------------------------------------------------------------------
-- 2. Huishoudens
-- ---------------------------------------------------------------------------
create table if not exists households (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 120),
  housing_unit text,
  created_at timestamptz not null default now()
);
create index if not exists idx_households_project on households(project_id);

alter table memberships add column if not exists household_id uuid references households(id) on delete set null;
create index if not exists idx_memberships_household on memberships(household_id) where household_id is not null;

-- Huishouden moet bij hetzelfde project horen als het lidmaatschap.
create or replace function memberships_household_same_project()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if new.household_id is not null and not exists (
    select 1 from households h where h.id = new.household_id and h.project_id = new.project_id
  ) then
    raise exception 'Huishouden hoort niet bij dit project';
  end if;
  return new;
end $$;
drop trigger if exists trg_memberships_household_same_project on memberships;
create trigger trg_memberships_household_same_project
  before insert or update of household_id on memberships
  for each row execute function memberships_household_same_project();

alter table households enable row level security;
drop policy if exists "Households read" on households;
create policy "Households read" on households for select
  using (can_view_decisions(project_id));
drop policy if exists "Households write admins" on households;
create policy "Households write admins" on households for all
  using (has_membership(project_id, 'admin') or is_platform_admin())
  with check (has_membership(project_id, 'admin') or is_platform_admin());

-- ---------------------------------------------------------------------------
-- 3. Besluitregels
-- ---------------------------------------------------------------------------
create table if not exists decision_rules (
  project_id uuid primary key references projects(id) on delete cascade,
  vote_unit text not null default 'household' check (vote_unit in ('household', 'person')),
  default_form text not null default 'consent' check (default_form in ('consent', 'vote')),
  quorum_num smallint not null default 2,
  quorum_den smallint not null default 3,
  majority_regular_num smallint not null default 1,
  majority_regular_den smallint not null default 2,
  majority_heavy_num smallint not null default 2,
  majority_heavy_den smallint not null default 3,
  heavy_categories text[] not null default '{}',
  default_duration_days smallint not null default 7 check (default_duration_days between 1 and 60),
  reminder_after_days smallint not null default 3 check (reminder_after_days between 0 and 60),
  who_may_propose text not null default 'committees' check (who_may_propose in ('committees', 'members')),
  tally_visibility text not null default 'always' check (tally_visibility in ('always', 'after_own_vote')),
  allow_overrule_objection boolean not null default false,
  formal_online_decisions boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references profiles(id) on delete set null,
  check (quorum_num >= 0 and quorum_den > 0 and quorum_num <= quorum_den),
  check (majority_regular_num > 0 and majority_regular_den > 0 and majority_regular_num < majority_regular_den),
  check (majority_heavy_num > 0 and majority_heavy_den > 0 and majority_heavy_num <= majority_heavy_den)
);

drop trigger if exists trg_decision_rules_updated on decision_rules;
create trigger trg_decision_rules_updated before update on decision_rules
  for each row execute function decisions_touch_updated_at();

alter table decision_rules enable row level security;
drop policy if exists "Decision rules read" on decision_rules;
create policy "Decision rules read" on decision_rules for select
  using (can_view_decisions(project_id));
drop policy if exists "Decision rules write admins" on decision_rules;
create policy "Decision rules write admins" on decision_rules for all
  using (has_membership(project_id, 'admin') or is_platform_admin())
  with check (has_membership(project_id, 'admin') or is_platform_admin());

-- Haal regels op; maakt de rij met standaardwaarden aan als die nog niet
-- bestaat (de kolom-defaults zijn de enige bron van standaardwaarden).
create or replace function ensure_decision_rules(p_project_id uuid)
returns decision_rules language plpgsql security definer
set search_path = public, pg_temp as $$
declare r decision_rules;
begin
  if not can_view_decisions(p_project_id) then
    raise exception 'Geen toegang' using errcode = '42501';
  end if;
  insert into decision_rules(project_id) values (p_project_id) on conflict do nothing;
  select * into r from decision_rules where project_id = p_project_id;
  return r;
end $$;

-- ---------------------------------------------------------------------------
-- 4. Voorstellen
-- ---------------------------------------------------------------------------
create table if not exists proposals (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  form text not null check (form in ('idea', 'poll', 'consent', 'vote', 'mandate')),
  workgroup_id uuid references workgroups(id) on delete set null,
  created_by uuid references profiles(id) on delete set null default auth.uid(),

  title text not null check (length(trim(title)) between 3 and 200),
  summary text not null check (length(trim(summary)) > 0),
  member_impact text,
  key_figures jsonb not null default '[]'::jsonb check (jsonb_typeof(key_figures) = 'array'),
  body text,
  category text,
  is_heavy boolean not null default false,

  status text not null default 'draft' check (status in (
    'draft', 'published', 'closed', 'adopted', 'rejected', 'amended', 'no_quorum', 'withdrawn', 'noted'
  )),
  published_at timestamptz,
  deadline timestamptz,
  deadline_extended_at timestamptz,
  deadline_extension_note text,
  withdrawn_at timestamptz,
  withdrawn_reason text,
  reminder_sent_at timestamptz,
  closed_at timestamptz,

  rules_snapshot jsonb,
  electorate_size int,
  response_count int not null default 0,
  outcome jsonb,

  version int not null default 1,
  previous_version_id uuid references proposals(id) on delete set null,
  source_idea_id uuid references proposals(id) on delete set null,
  reverts_proposal_id uuid references proposals(id) on delete set null,
  picked_up_by_workgroup_id uuid references workgroups(id) on delete set null,
  mandate_amount numeric(12,2),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_proposals_project_status on proposals(project_id, status);
create index if not exists idx_proposals_due on proposals(deadline) where status = 'published';
create index if not exists idx_proposals_workgroup on proposals(workgroup_id);

drop trigger if exists trg_proposals_updated on proposals;
create trigger trg_proposals_updated before update on proposals
  for each row execute function decisions_touch_updated_at();

-- Bewaker: statusvelden alleen via RPC; inhoud alleen bewerkbaar als concept.
create or replace function proposals_guard()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if coalesce(current_setting('app.decisions_rpc', true), '') = 'on' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.status := 'draft';
    new.published_at := null; new.closed_at := null; new.outcome := null;
    new.rules_snapshot := null; new.electorate_size := null; new.response_count := 0;
    new.withdrawn_at := null; new.withdrawn_reason := null; new.reminder_sent_at := null;
    new.deadline_extended_at := null; new.deadline_extension_note := null;
    new.version := 1; new.previous_version_id := null;
    if new.created_by is null then new.created_by := auth.uid(); end if;
    return new;
  end if;

  -- UPDATE
  if old.status <> 'draft' then
    raise exception 'Een gepubliceerd voorstel kan niet meer worden bewerkt. Maak zo nodig een nieuwe versie of een nieuw voorstel.';
  end if;
  if new.status is distinct from old.status
     or new.project_id is distinct from old.project_id
     or new.published_at is distinct from old.published_at
     or new.rules_snapshot is distinct from old.rules_snapshot
     or new.electorate_size is distinct from old.electorate_size
     or new.response_count is distinct from old.response_count
     or new.outcome is distinct from old.outcome
     or new.closed_at is distinct from old.closed_at
     or new.version is distinct from old.version
     or new.previous_version_id is distinct from old.previous_version_id then
    raise exception 'Deze velden worden door het systeem beheerd';
  end if;
  return new;
end $$;
drop trigger if exists trg_proposals_guard on proposals;
create trigger trg_proposals_guard before insert or update on proposals
  for each row execute function proposals_guard();

alter table proposals enable row level security;

drop policy if exists "Proposals read" on proposals;
create policy "Proposals read" on proposals for select using (
  (status <> 'draft' and can_view_decisions(project_id))
  or can_manage_proposal(project_id, workgroup_id, created_by)
);

drop policy if exists "Proposals insert" on proposals;
create policy "Proposals insert" on proposals for insert with check (
  decisions_enabled(project_id)
  and form in ('consent', 'vote')            -- fase 1; idea/poll/mandate volgen
  and can_submit_for_group(project_id, workgroup_id)
);

drop policy if exists "Proposals update drafts" on proposals;
create policy "Proposals update drafts" on proposals for update
  using (can_manage_proposal(project_id, workgroup_id, created_by))
  with check (can_submit_for_group(project_id, workgroup_id));

drop policy if exists "Proposals delete drafts" on proposals;
create policy "Proposals delete drafts" on proposals for delete using (
  status = 'draft' and can_manage_proposal(project_id, workgroup_id, created_by)
);

-- ---------------------------------------------------------------------------
-- 5. Bijlagen
-- ---------------------------------------------------------------------------
create table if not exists proposal_attachments (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references proposals(id) on delete cascade,
  file_name text not null,
  file_path text not null,
  file_size bigint,
  file_type text,
  uploaded_by uuid references profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists idx_proposal_attachments_proposal on proposal_attachments(proposal_id);

alter table proposal_attachments enable row level security;
drop policy if exists "Proposal attachments read" on proposal_attachments;
create policy "Proposal attachments read" on proposal_attachments for select using (
  exists (select 1 from proposals p where p.id = proposal_id)   -- volgt RLS van proposals
);
drop policy if exists "Proposal attachments write drafts" on proposal_attachments;
create policy "Proposal attachments write drafts" on proposal_attachments for all
  using (exists (
    select 1 from proposals p where p.id = proposal_id and p.status = 'draft'
      and can_manage_proposal(p.project_id, p.workgroup_id, p.created_by)))
  with check (exists (
    select 1 from proposals p where p.id = proposal_id and p.status = 'draft'
      and can_manage_proposal(p.project_id, p.workgroup_id, p.created_by)));

-- Storage: bijlagen leesbaar voor wie de bijlage-rij mag zien.
drop policy if exists project_files_select on storage.objects;
create policy project_files_select on storage.objects for select using (
  bucket_id = 'project-files' and (
    is_platform_admin()
    or exists (select 1 from documents d where d.file_path = objects.name)
    or exists (select 1 from meeting_files mf where mf.file_path = objects.name)
    or exists (select 1 from update_attachments ua where ua.file_path = objects.name)
    or exists (select 1 from update_files uf where uf.file_path = objects.name)
    or exists (select 1 from proposal_attachments pa where pa.file_path = objects.name)
  )
);

-- ---------------------------------------------------------------------------
-- 6. Kiezersbestand (snapshot bij publicatie)
-- ---------------------------------------------------------------------------
create table if not exists proposal_electorate (
  proposal_id uuid not null references proposals(id) on delete cascade,
  unit_id uuid not null,                 -- household.id of profile.id
  unit_type text not null check (unit_type in ('household', 'person')),
  unit_label text,
  member_ids uuid[] not null,
  primary key (proposal_id, unit_id)
);
create index if not exists idx_proposal_electorate_members on proposal_electorate using gin (member_ids);

alter table proposal_electorate enable row level security;
drop policy if exists "Electorate read own unit or managers" on proposal_electorate;
create policy "Electorate read own unit or managers" on proposal_electorate for select using (
  auth.uid() = any (member_ids)
  or exists (select 1 from proposals p where p.id = proposal_id
             and can_manage_proposal(p.project_id, p.workgroup_id, p.created_by))
);

-- ---------------------------------------------------------------------------
-- 7. Reacties + log
-- ---------------------------------------------------------------------------
create table if not exists proposal_responses (
  proposal_id uuid not null references proposals(id) on delete cascade,
  unit_id uuid not null,
  choice text not null,
  motivation text,
  responded_by uuid references profiles(id) on delete set null,
  responded_at timestamptz not null default now(),
  overruled boolean not null default false,
  overrule_reason text,
  overruled_by uuid references profiles(id) on delete set null,
  overruled_at timestamptz,
  primary key (proposal_id, unit_id),
  foreign key (proposal_id, unit_id) references proposal_electorate(proposal_id, unit_id) on delete cascade
);

alter table proposal_responses enable row level security;
-- Lezen: eigen eenheid, beheerders, en bezwaren zijn voor iedereen zichtbaar.
drop policy if exists "Responses read" on proposal_responses;
create policy "Responses read" on proposal_responses for select using (
  exists (select 1 from proposal_electorate e
          where e.proposal_id = proposal_responses.proposal_id
            and e.unit_id = proposal_responses.unit_id
            and auth.uid() = any (e.member_ids))
  or exists (select 1 from proposals p where p.id = proposal_id
             and (can_manage_proposal(p.project_id, p.workgroup_id, p.created_by)
                  or (p.form = 'consent' and proposal_responses.choice = 'objection'
                      and can_view_decisions(p.project_id))))
);
-- Geen write-policies: alleen via cast_response / overrule_objection.

create table if not exists proposal_response_log (
  id bigint generated always as identity primary key,
  proposal_id uuid not null references proposals(id) on delete cascade,
  unit_id uuid not null,
  profile_id uuid references profiles(id) on delete set null,
  action text not null check (action in ('respond', 'overrule')),
  old_choice text,
  new_choice text,
  motivation text,
  created_at timestamptz not null default now()
);
create index if not exists idx_response_log_proposal on proposal_response_log(proposal_id, created_at);

alter table proposal_response_log enable row level security;
drop policy if exists "Response log read" on proposal_response_log;
create policy "Response log read" on proposal_response_log for select using (
  exists (select 1 from proposal_electorate e
          where e.proposal_id = proposal_response_log.proposal_id
            and e.unit_id = proposal_response_log.unit_id
            and auth.uid() = any (e.member_ids))
  or exists (select 1 from proposals p where p.id = proposal_id
             and can_manage_proposal(p.project_id, p.workgroup_id, p.created_by))
);

create or replace function proposal_responses_log()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if tg_op = 'INSERT' or new.choice is distinct from old.choice or new.motivation is distinct from old.motivation then
    insert into proposal_response_log(proposal_id, unit_id, profile_id, action, old_choice, new_choice, motivation)
    values (new.proposal_id, new.unit_id, new.responded_by, 'respond',
            case when tg_op = 'UPDATE' then old.choice end, new.choice, new.motivation);
  end if;
  if tg_op = 'UPDATE' and new.overruled and not old.overruled then
    insert into proposal_response_log(proposal_id, unit_id, profile_id, action, old_choice, new_choice, motivation)
    values (new.proposal_id, new.unit_id, new.overruled_by, 'overrule', old.choice, new.choice, new.overrule_reason);
  end if;
  return new;
end $$;
drop trigger if exists trg_proposal_responses_log on proposal_responses;
create trigger trg_proposal_responses_log after insert or update on proposal_responses
  for each row execute function proposal_responses_log();

-- ---------------------------------------------------------------------------
-- 8. Vragenronde
-- ---------------------------------------------------------------------------
create table if not exists proposal_questions (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references proposals(id) on delete cascade,
  parent_id uuid references proposal_questions(id) on delete cascade,   -- gezet = antwoord
  body text not null check (length(trim(body)) between 1 and 4000),
  author_id uuid references profiles(id) on delete set null default auth.uid(),
  as_workgroup_id uuid references workgroups(id) on delete set null,     -- antwoord namens commissie
  created_at timestamptz not null default now(),
  edited_at timestamptz
);
create index if not exists idx_proposal_questions_proposal on proposal_questions(proposal_id, created_at);

alter table proposal_questions enable row level security;
drop policy if exists "Questions read" on proposal_questions;
create policy "Questions read" on proposal_questions for select using (
  exists (select 1 from proposals p where p.id = proposal_id)
);
drop policy if exists "Questions insert" on proposal_questions;
create policy "Questions insert" on proposal_questions for insert with check (
  author_id = auth.uid()
  and exists (
    select 1 from proposals p where p.id = proposal_id and p.status = 'published'
      and (
        -- vraag: iedereen die het voorstel mag lezen (geen demo-bezoekers)
        (parent_id is null and as_workgroup_id is null and has_membership(p.project_id, 'aspirant'))
        -- antwoord: alleen beheerders, namens de indienende groep
        or (parent_id is not null
            and can_manage_proposal(p.project_id, p.workgroup_id, p.created_by)
            and as_workgroup_id is not distinct from p.workgroup_id
            and exists (select 1 from proposal_questions q
                        where q.id = parent_id and q.proposal_id = p.id and q.parent_id is null))
      )
  )
);
drop policy if exists "Questions update own" on proposal_questions;
create policy "Questions update own" on proposal_questions for update
  using (author_id = auth.uid()) with check (author_id = auth.uid());
drop policy if exists "Questions delete own or managers" on proposal_questions;
create policy "Questions delete own or managers" on proposal_questions for delete using (
  author_id = auth.uid()
  or exists (select 1 from proposals p where p.id = proposal_id
             and can_manage_proposal(p.project_id, p.workgroup_id, p.created_by))
);

-- ---------------------------------------------------------------------------
-- 9. Notificatiewachtrij
-- ---------------------------------------------------------------------------
create table if not exists proposal_events (
  id bigint generated always as identity primary key,
  project_id uuid not null references projects(id) on delete cascade,
  proposal_id uuid not null references proposals(id) on delete cascade,
  type text not null check (type in (
    'proposal_published', 'proposal_new_version', 'proposal_reminder',
    'proposal_question', 'proposal_answered', 'proposal_objection', 'proposal_closed'
  )),
  reference_id uuid,         -- vraag-id of antwoord-id
  actor_id uuid,
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  attempts int not null default 0,
  last_error text
);
create index if not exists idx_proposal_events_pending on proposal_events(created_at) where processed_at is null;
alter table proposal_events enable row level security;   -- geen policies: alleen service role

create or replace function enqueue_proposal_event(
  p_type text, p_project_id uuid, p_proposal_id uuid, p_reference_id uuid default null, p_actor_id uuid default auth.uid()
) returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into proposal_events(type, project_id, proposal_id, reference_id, actor_id)
  values (p_type, p_project_id, p_proposal_id, p_reference_id, p_actor_id);
  -- Direct seintje aan de worker (verify_jwt uit; verwerkt alleen de wachtrij).
  -- pg_net is transactioneel: bij een rollback gaat er niets de deur uit.
  begin
    perform net.http_post(
      url := 'https://czgsqmbejsmcjusigwhp.supabase.co/functions/v1/decision-notify',
      headers := '{"Content-Type":"application/json"}'::jsonb,
      body := '{}'::jsonb);
  exception when others then
    raise warning 'decision-notify poke failed: %', sqlerrm;
  end;
end $$;
revoke execute on function enqueue_proposal_event(text, uuid, uuid, uuid, uuid) from public, anon, authenticated;

create or replace function proposal_questions_notify()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare v_project uuid;
begin
  select project_id into v_project from proposals where id = new.proposal_id;
  perform enqueue_proposal_event(
    case when new.parent_id is null then 'proposal_question' else 'proposal_answered' end,
    v_project, new.proposal_id, new.id, new.author_id);
  return new;
end $$;
drop trigger if exists trg_proposal_questions_notify on proposal_questions;
create trigger trg_proposal_questions_notify after insert on proposal_questions
  for each row execute function proposal_questions_notify();

-- ---------------------------------------------------------------------------
-- 10. Beslislogica (puur, getest in supabase/tests/decision_outcome.test.sql)
-- ---------------------------------------------------------------------------
create or replace function decisions_plural(n int, singular text, plural text)
returns text language sql immutable as $$
  select n || ' ' || case when n = 1 then singular else plural end;
$$;

-- p_counts: vote {for, against, abstain}; consent {agree, accept, objection, objection_open};
--           poll {<option>: n, ...}
-- p_rules:  rules_snapshot (kolommen van decision_rules)
create or replace function decision_outcome(
  p_form text, p_rules jsonb, p_electorate int, p_counts jsonb, p_is_heavy boolean default false
) returns jsonb language plpgsql immutable as $$
declare
  q_num int := coalesce((p_rules->>'quorum_num')::int, 2);
  q_den int := coalesce((p_rules->>'quorum_den')::int, 3);
  m_num int; m_den int; m_strict boolean;
  v_for int := coalesce((p_counts->>'for')::int, 0);
  v_against int := coalesce((p_counts->>'against')::int, 0);
  v_abstain int := coalesce((p_counts->>'abstain')::int, 0);
  c_agree int := coalesce((p_counts->>'agree')::int, 0);
  c_accept int := coalesce((p_counts->>'accept')::int, 0);
  c_objection int := coalesce((p_counts->>'objection')::int, 0);
  c_open int := coalesce((p_counts->>'objection_open')::int, (p_counts->>'objection')::int, 0);
  v_responded int;
  v_required int;
  v_quorum boolean;
  v_status text;
  v_summary text;
  v_cast int;
  v_preparatory boolean := p_form = 'vote' and not coalesce((p_rules->>'formal_online_decisions')::boolean, false);
begin
  -- Peiling: niet bindend, geen quorum
  if p_form = 'poll' then
    select coalesce(sum(value::int), 0) into v_responded from jsonb_each_text(coalesce(p_counts, '{}'::jsonb));
    return jsonb_build_object('status', 'closed', 'responded', v_responded, 'electorate', p_electorate,
                              'binding', false, 'counts', coalesce(p_counts, '{}'::jsonb),
                              'summary', 'Peiling gesloten, ' || decisions_plural(v_responded, 'reactie', 'reacties'));
  end if;

  if p_form = 'vote' then
    v_responded := v_for + v_against + v_abstain;
  elsif p_form = 'consent' then
    v_responded := c_agree + c_accept + c_objection;
  else
    raise exception 'decision_outcome: onbekende vorm %', p_form;
  end if;

  -- ceil(q_num * electorate / q_den) met gehele getallen
  v_required := (q_num * p_electorate + q_den - 1) / q_den;
  v_quorum := p_electorate > 0 and v_responded >= v_required;

  if p_form = 'vote' then
    if p_is_heavy then
      m_num := coalesce((p_rules->>'majority_heavy_num')::int, 2);
      m_den := coalesce((p_rules->>'majority_heavy_den')::int, 3);
      m_strict := false;
    else
      m_num := coalesce((p_rules->>'majority_regular_num')::int, 1);
      m_den := coalesce((p_rules->>'majority_regular_den')::int, 2);
      m_strict := true;
    end if;
    v_cast := v_for + v_against;

    if not v_quorum then
      v_status := 'no_quorum';
    elsif v_cast = 0 then
      v_status := 'rejected';
    elsif (m_strict and v_for * m_den > m_num * v_cast)
       or (not m_strict and v_for * m_den >= m_num * v_cast) then
      v_status := 'adopted';
    else
      v_status := 'rejected';
    end if;

    v_summary := case v_status
        when 'adopted' then 'Aangenomen'
        when 'rejected' then 'Verworpen'
        else 'Geen quorum' end;
    if v_status = 'no_quorum' then
      v_summary := v_summary || ': ' || v_responded || ' van ' || p_electorate || ' reageerden, ' || v_required || ' nodig';
    else
      v_summary := v_summary || ', ' || v_for || ' voor, ' || v_against || ' tegen, '
                   || decisions_plural(v_abstain, 'onthouding', 'onthoudingen');
      if v_status = 'rejected' and p_is_heavy then
        v_summary := v_summary || ' (zwaar besluit, ' || m_num || '/' || m_den || ' nodig)';
      end if;
    end if;
    if v_preparatory then
      v_summary := v_summary || '. Voorbereidend: de ALV neemt het formele besluit';
    end if;

    return jsonb_build_object(
      'status', v_status, 'electorate', p_electorate, 'responded', v_responded,
      'quorum_required', v_required, 'quorum_met', v_quorum,
      'majority', jsonb_build_object('num', m_num, 'den', m_den, 'strict', m_strict, 'heavy', p_is_heavy),
      'counts', jsonb_build_object('for', v_for, 'against', v_against, 'abstain', v_abstain),
      'binding', not v_preparatory, 'preparatory', v_preparatory,
      'summary', v_summary);
  end if;

  -- consent
  if not v_quorum then
    v_status := 'no_quorum';
    v_summary := 'Geen quorum: ' || v_responded || ' van ' || p_electorate || ' reageerden, ' || v_required || ' nodig';
  elsif c_open > 0 then
    v_status := 'amended';
    v_summary := 'Aangepast: ' || decisions_plural(c_open, 'bezwaar', 'bezwaren') || ', de indieners verwerken dit in een nieuwe versie';
  else
    v_status := 'adopted';
    v_summary := 'Vastgesteld, ' || c_agree || ' akkoord, ' || c_accept || ' kan ermee leven, '
                 || case when c_objection = 0 then 'geen bezwaren'
                         else decisions_plural(c_objection, 'bezwaar', 'bezwaren') || ' gepasseerd' end;
  end if;

  return jsonb_build_object(
    'status', v_status, 'electorate', p_electorate, 'responded', v_responded,
    'quorum_required', v_required, 'quorum_met', v_quorum,
    'counts', jsonb_build_object('agree', c_agree, 'accept', c_accept, 'objection', c_objection, 'objection_open', c_open),
    'binding', true, 'preparatory', false,
    'summary', v_summary);
end $$;

-- Tellingen voor één voorstel uit de reactietabel.
create or replace function proposal_counts(p_proposal_id uuid)
returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
  select case p.form
    when 'vote' then jsonb_build_object(
      'for',     count(*) filter (where r.choice = 'for'),
      'against', count(*) filter (where r.choice = 'against'),
      'abstain', count(*) filter (where r.choice = 'abstain'))
    when 'consent' then jsonb_build_object(
      'agree',          count(*) filter (where r.choice = 'agree'),
      'accept',         count(*) filter (where r.choice = 'accept'),
      'objection',      count(*) filter (where r.choice = 'objection'),
      'objection_open', count(*) filter (where r.choice = 'objection' and not r.overruled))
    else coalesce((select jsonb_object_agg(choice, n) from (
            select choice, count(*) n from proposal_responses where proposal_id = p.id group by choice) x), '{}'::jsonb)
    end
  from proposals p
  left join proposal_responses r on r.proposal_id = p.id
  where p.id = p_proposal_id
  group by p.id, p.form;
$$;
revoke execute on function proposal_counts(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 11. RPC's
-- ---------------------------------------------------------------------------

-- Publiceren: valideren, regels + kiezersbestand vastzetten.
create or replace function publish_proposal(p_proposal_id uuid, p_deadline timestamptz default null)
returns proposals language plpgsql security definer set search_path = public, pg_temp as $$
declare
  p proposals;
  r decision_rules;
  v_deadline timestamptz;
  v_org uuid;
  v_size int;
begin
  select * into p from proposals where id = p_proposal_id for update;
  if not found then raise exception 'Voorstel niet gevonden'; end if;
  if not can_manage_proposal(p.project_id, p.workgroup_id, p.created_by) then
    raise exception 'Je mag dit voorstel niet publiceren' using errcode = '42501';
  end if;
  if not decisions_enabled(p.project_id) then raise exception 'Besluitvorming staat uit voor dit project'; end if;
  if p.status <> 'draft' then raise exception 'Alleen een concept kan worden gepubliceerd'; end if;
  if p.form not in ('consent', 'vote') then raise exception 'Deze vorm kan (nog) niet worden gepubliceerd'; end if;
  if p.workgroup_id is null then raise exception 'Kies namens welke commissie of welk bestuur je dit voorstel inbrengt'; end if;
  if length(trim(coalesce(p.member_impact, ''))) = 0 then
    raise exception 'Vul in wat dit voorstel betekent voor de leden';
  end if;

  insert into decision_rules(project_id) values (p.project_id) on conflict do nothing;
  select * into r from decision_rules where project_id = p.project_id;

  v_deadline := coalesce(p_deadline, p.deadline, now() + make_interval(days => r.default_duration_days));
  if v_deadline < now() + interval '1 hour' then
    raise exception 'De deadline moet minstens een uur in de toekomst liggen';
  end if;

  select organization_id into v_org from projects where id = p.project_id;

  -- Kiezersbestand: leden (member+), zonder org-/platformbeheerders.
  insert into proposal_electorate(proposal_id, unit_id, unit_type, unit_label, member_ids)
  with voters as (
    select m.profile_id,
           case when r.vote_unit = 'household' and m.household_id is not null then m.household_id else m.profile_id end as unit_id,
           case when r.vote_unit = 'household' and m.household_id is not null then 'household' else 'person' end as unit_type,
           case when r.vote_unit = 'household' and m.household_id is not null then h.name else pr.full_name end as unit_label
    from memberships m
    join profiles pr on pr.id = m.profile_id
    left join households h on h.id = m.household_id
    where m.project_id = p.project_id
      and m.role in ('member', 'moderator', 'admin')
      and not coalesce(pr.is_platform_admin, false)
      and not exists (select 1 from org_members om
                      where om.profile_id = m.profile_id and om.organization_id = v_org and om.role = 'admin')
  )
  select p.id, unit_id, unit_type, max(unit_label), array_agg(profile_id order by profile_id)
  from voters
  group by unit_id, unit_type;

  select count(*) into v_size from proposal_electorate where proposal_id = p.id;
  if v_size = 0 then raise exception 'Er zijn nog geen stemgerechtigde leden in dit project'; end if;

  perform decisions_rpc_on();
  update proposals set
    status = 'published',
    published_at = now(),
    deadline = v_deadline,
    is_heavy = p.is_heavy or (p.category is not null and p.category = any (r.heavy_categories)),
    rules_snapshot = to_jsonb(r) - 'project_id' - 'updated_at' - 'updated_by',
    electorate_size = v_size,
    response_count = 0
  where id = p.id
  returning * into p;

  perform enqueue_proposal_event(
    case when p.version > 1 then 'proposal_new_version' else 'proposal_published' end,
    p.project_id, p.id);
  return p;
end $$;

-- Deadline één keer verlengen, met notitie.
create or replace function extend_proposal_deadline(p_proposal_id uuid, p_new_deadline timestamptz, p_note text)
returns proposals language plpgsql security definer set search_path = public, pg_temp as $$
declare p proposals;
begin
  select * into p from proposals where id = p_proposal_id for update;
  if not found then raise exception 'Voorstel niet gevonden'; end if;
  if not can_manage_proposal(p.project_id, p.workgroup_id, p.created_by) then
    raise exception 'Je mag dit voorstel niet verlengen' using errcode = '42501';
  end if;
  if p.status <> 'published' or p.deadline <= now() then raise exception 'Alleen een lopend voorstel kan worden verlengd'; end if;
  if p.deadline_extended_at is not null then raise exception 'De deadline is al een keer verlengd'; end if;
  if p_new_deadline <= p.deadline then raise exception 'De nieuwe deadline moet later zijn dan de huidige'; end if;
  if length(trim(coalesce(p_note, ''))) = 0 then raise exception 'Geef aan waarom de deadline wordt verlengd'; end if;

  perform decisions_rpc_on();
  update proposals set deadline = p_new_deadline, deadline_extended_at = now(),
         deadline_extension_note = trim(p_note)
  where id = p.id returning * into p;
  return p;
end $$;

-- Intrekken vóór de deadline, met reden.
create or replace function withdraw_proposal(p_proposal_id uuid, p_reason text)
returns proposals language plpgsql security definer set search_path = public, pg_temp as $$
declare p proposals;
begin
  select * into p from proposals where id = p_proposal_id for update;
  if not found then raise exception 'Voorstel niet gevonden'; end if;
  if not can_manage_proposal(p.project_id, p.workgroup_id, p.created_by) then
    raise exception 'Je mag dit voorstel niet intrekken' using errcode = '42501';
  end if;
  if p.status <> 'published' or p.deadline <= now() then raise exception 'Alleen een lopend voorstel kan worden ingetrokken'; end if;
  if length(trim(coalesce(p_reason, ''))) = 0 then raise exception 'Geef een reden voor het intrekken'; end if;

  perform decisions_rpc_on();
  update proposals set status = 'withdrawn', withdrawn_at = now(), withdrawn_reason = trim(p_reason)
  where id = p.id returning * into p;
  return p;
end $$;

-- Reageren. Eén reactie per eenheid; de laatste telt.
create or replace function cast_response(p_proposal_id uuid, p_choice text, p_motivation text default null)
returns proposal_responses language plpgsql security definer set search_path = public, pg_temp as $$
declare
  p proposals;
  e proposal_electorate;
  old_r proposal_responses;
  new_r proposal_responses;
  v_motivation text := nullif(trim(coalesce(p_motivation, '')), '');
begin
  select * into p from proposals where id = p_proposal_id for update;
  if not found then raise exception 'Voorstel niet gevonden'; end if;
  if p.status <> 'published' or now() >= p.deadline then
    raise exception 'De reactietermijn is verlopen. Je reactie is niet meer opgeslagen.' using errcode = 'P0001';
  end if;
  if not decisions_enabled(p.project_id) then raise exception 'Besluitvorming staat uit voor dit project'; end if;

  select * into e from proposal_electorate where proposal_id = p.id and auth.uid() = any (member_ids);
  if not found or not exists (select 1 from memberships m where m.project_id = p.project_id and m.profile_id = auth.uid()) then
    raise exception 'Je bent niet stemgerechtigd voor dit voorstel' using errcode = '42501';
  end if;

  if p.form = 'vote' and p_choice not in ('for', 'against', 'abstain') then
    raise exception 'Ongeldige keuze';
  elsif p.form = 'consent' and p_choice not in ('agree', 'accept', 'objection') then
    raise exception 'Ongeldige keuze';
  end if;
  if p_choice = 'objection' and (v_motivation is null or length(v_motivation) < 10) then
    raise exception 'Een bezwaar heeft een motivatie nodig (minimaal 10 tekens)';
  end if;

  select * into old_r from proposal_responses where proposal_id = p.id and unit_id = e.unit_id;

  insert into proposal_responses(proposal_id, unit_id, choice, motivation, responded_by, responded_at)
  values (p.id, e.unit_id, p_choice, v_motivation, auth.uid(), now())
  on conflict (proposal_id, unit_id) do update set
    choice = excluded.choice, motivation = excluded.motivation,
    responded_by = excluded.responded_by, responded_at = excluded.responded_at,
    overruled = false, overrule_reason = null, overruled_by = null, overruled_at = null
  returning * into new_r;

  if old_r.unit_id is null then
    perform decisions_rpc_on();
    update proposals set response_count = response_count + 1 where id = p.id;
  end if;

  if p_choice = 'objection' and coalesce(old_r.choice, '') <> 'objection' then
    perform enqueue_proposal_event('proposal_objection', p.project_id, p.id, null, auth.uid());
  end if;
  return new_r;
end $$;

-- Bezwaar passeren (alleen als de regels dat toestaan), met motivatie.
create or replace function overrule_objection(p_proposal_id uuid, p_unit_id uuid, p_reason text)
returns proposal_responses language plpgsql security definer set search_path = public, pg_temp as $$
declare p proposals; v_r proposal_responses; v_outcome jsonb;
begin
  select * into p from proposals where id = p_proposal_id for update;
  if not found then raise exception 'Voorstel niet gevonden'; end if;
  if not can_manage_proposal(p.project_id, p.workgroup_id, p.created_by) then
    raise exception 'Je mag dit bezwaar niet passeren' using errcode = '42501';
  end if;
  if p.form <> 'consent' or p.status not in ('published', 'amended') then
    raise exception 'Bezwaren kunnen alleen bij een lopend of aangepast consentvoorstel worden gepasseerd';
  end if;
  if not coalesce((p.rules_snapshot->>'allow_overrule_objection')::boolean, false) then
    raise exception 'Bezwaren passeren is in de besluitregels niet toegestaan';
  end if;
  if length(trim(coalesce(p_reason, ''))) < 10 then
    raise exception 'Motiveer waarom het bezwaar niet overwegend is (minimaal 10 tekens)';
  end if;

  update proposal_responses set overruled = true, overrule_reason = trim(p_reason),
         overruled_by = auth.uid(), overruled_at = now()
  where proposal_id = p.id and unit_id = p_unit_id and choice = 'objection' and not overruled
  returning * into v_r;
  if not found then raise exception 'Bezwaar niet gevonden'; end if;

  -- Na sluiting: uitkomst opnieuw bepalen (kan van aangepast naar vastgesteld gaan).
  if p.status = 'amended' then
    v_outcome := decision_outcome(p.form, p.rules_snapshot, p.electorate_size, proposal_counts(p.id), p.is_heavy);
    perform decisions_rpc_on();
    update proposals set outcome = v_outcome || jsonb_build_object('revised_at', now()),
           status = v_outcome->>'status'
    where id = p.id;
    if v_outcome->>'status' <> 'amended' then
      perform enqueue_proposal_event('proposal_closed', p.project_id, p.id);
    end if;
  end if;
  return v_r;
end $$;

-- Nieuwe versie na bezwaren of zonder quorum: kopie als concept.
create or replace function create_proposal_version(p_proposal_id uuid)
returns proposals language plpgsql security definer set search_path = public, pg_temp as $$
declare p proposals; n proposals;
begin
  select * into p from proposals where id = p_proposal_id;
  if not found then raise exception 'Voorstel niet gevonden'; end if;
  if not can_manage_proposal(p.project_id, p.workgroup_id, p.created_by) then
    raise exception 'Je mag geen nieuwe versie maken' using errcode = '42501';
  end if;
  if p.status not in ('amended', 'no_quorum', 'withdrawn') then
    raise exception 'Een nieuwe versie kan alleen na bezwaren, zonder quorum of na intrekken';
  end if;
  if exists (select 1 from proposals where previous_version_id = p.id) then
    raise exception 'Er bestaat al een nieuwe versie van dit voorstel';
  end if;

  perform decisions_rpc_on();
  insert into proposals(project_id, form, workgroup_id, created_by, title, summary, member_impact,
                        key_figures, body, category, is_heavy, status, version, previous_version_id,
                        source_idea_id, reverts_proposal_id)
  values (p.project_id, p.form, p.workgroup_id, auth.uid(), p.title, p.summary, p.member_impact,
          p.key_figures, p.body, p.category, p.is_heavy, 'draft', p.version + 1, p.id,
          p.source_idea_id, p.reverts_proposal_id)
  returning * into n;

  insert into proposal_attachments(proposal_id, file_name, file_path, file_size, file_type, uploaded_by)
  select n.id, file_name, file_path, file_size, file_type, uploaded_by
  from proposal_attachments where proposal_id = p.id;
  return n;
end $$;

-- Tussenstand / uitslag, met de zichtbaarheidsregels.
create or replace function proposal_tally(p_proposal_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  p proposals;
  e proposal_electorate;
  my_r proposal_responses;
  v_manager boolean;
  v_visible boolean;
  v_counts jsonb;
  v_projection jsonb;
  v_by text;
begin
  select * into p from proposals where id = p_proposal_id;
  if not found then return null; end if;
  v_manager := can_manage_proposal(p.project_id, p.workgroup_id, p.created_by);
  if not (v_manager or (p.status <> 'draft' and can_view_decisions(p.project_id))) then
    raise exception 'Geen toegang' using errcode = '42501';
  end if;
  if p.status = 'draft' then
    return jsonb_build_object('status', 'draft');
  end if;

  select * into e from proposal_electorate where proposal_id = p.id and auth.uid() = any (member_ids);
  if e.unit_id is not null then
    select * into my_r from proposal_responses where proposal_id = p.id and unit_id = e.unit_id;
    if my_r.responded_by is not null then
      select full_name into v_by from profiles where id = my_r.responded_by;
    end if;
  end if;

  v_visible := v_manager
    or p.status <> 'published'
    or p.form = 'consent'
    or (p.form = 'vote' and coalesce(p.rules_snapshot->>'tally_visibility', 'always') = 'always')
    or my_r.unit_id is not null;

  if v_visible then
    v_counts := coalesce(p.outcome->'counts', proposal_counts(p.id));
    if p.status = 'published' and p.form in ('vote', 'consent') then
      v_projection := decision_outcome(p.form, p.rules_snapshot, p.electorate_size, proposal_counts(p.id), p.is_heavy);
    end if;
  end if;

  return jsonb_build_object(
    'status', p.status,
    'form', p.form,
    'deadline', p.deadline,
    'is_open', p.status = 'published' and now() < p.deadline,
    'electorate', p.electorate_size,
    'responded', p.response_count,
    'quorum_required', ((p.rules_snapshot->>'quorum_num')::int * p.electorate_size + (p.rules_snapshot->>'quorum_den')::int - 1)
                       / nullif((p.rules_snapshot->>'quorum_den')::int, 0),
    'quorum_met', coalesce((p.outcome->>'quorum_met')::boolean, (v_projection->>'quorum_met')::boolean,
                  p.response_count >= ((p.rules_snapshot->>'quorum_num')::int * p.electorate_size + (p.rules_snapshot->>'quorum_den')::int - 1)
                                       / nullif((p.rules_snapshot->>'quorum_den')::int, 0)),
    'tally_visible', v_visible,
    'counts', v_counts,
    'projection', v_projection,
    'outcome', p.outcome,
    'is_manager', v_manager,
    'my_unit', case when e.unit_id is null then null else jsonb_build_object(
        'unit_id', e.unit_id, 'unit_type', e.unit_type, 'label', e.unit_label,
        'member_count', cardinality(e.member_ids),
        'choice', my_r.choice, 'motivation', my_r.motivation,
        'responded_at', my_r.responded_at, 'responded_by', my_r.responded_by, 'responded_by_name', v_by,
        'overruled', my_r.overruled) end,
    'can_respond', e.unit_id is not null and p.status = 'published' and now() < p.deadline
  );
end $$;

-- Wie nog niet reageerde (alleen beheerders) — om gericht na te bellen.
create or replace function proposal_pending_units(p_proposal_id uuid)
returns table(unit_id uuid, unit_type text, unit_label text, members jsonb)
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare p proposals;
begin
  select * into p from proposals where id = p_proposal_id;
  if not found or not can_manage_proposal(p.project_id, p.workgroup_id, p.created_by) then
    raise exception 'Geen toegang' using errcode = '42501';
  end if;
  return query
    select e.unit_id, e.unit_type, e.unit_label,
           (select jsonb_agg(jsonb_build_object('id', pr.id, 'full_name', pr.full_name,
                                                'email', pr.email, 'phone', pr.phone, 'avatar_url', pr.avatar_url)
                             order by pr.full_name)
            from profiles pr where pr.id = any (e.member_ids))
    from proposal_electorate e
    where e.proposal_id = p.id
      and not exists (select 1 from proposal_responses r where r.proposal_id = p.id and r.unit_id = e.unit_id)
    order by e.unit_label;
end $$;

-- Mijn openstaande voorstellen (voor dashboardblok + sidebarbadge).
create or replace function my_pending_proposals(p_project_id uuid)
returns table(id uuid, title text, form text, deadline timestamptz)
language sql stable security definer set search_path = public, pg_temp as $$
  select p.id, p.title, p.form, p.deadline
  from proposals p
  join proposal_electorate e on e.proposal_id = p.id and auth.uid() = any (e.member_ids)
  where p.project_id = p_project_id
    and p.status = 'published' and now() < p.deadline
    and not exists (select 1 from proposal_responses r where r.proposal_id = p.id and r.unit_id = e.unit_id)
  order by p.deadline;
$$;

-- ---------------------------------------------------------------------------
-- 12. Automatisch sluiten + herinneringen (cron, elke 5 minuten)
-- ---------------------------------------------------------------------------
create or replace function close_due_proposals()
returns int language plpgsql security definer set search_path = public, pg_temp as $$
declare
  p proposals;
  v_outcome jsonb;
  v_closed int := 0;
begin
  perform decisions_rpc_on();

  for p in
    select * from proposals where status = 'published' and deadline <= now()
    for update skip locked
  loop
    v_outcome := decision_outcome(p.form, p.rules_snapshot, p.electorate_size, proposal_counts(p.id), p.is_heavy);
    update proposals set status = v_outcome->>'status', outcome = v_outcome, closed_at = now()
    where id = p.id;
    perform enqueue_proposal_event('proposal_closed', p.project_id, p.id, null, null);
    v_closed := v_closed + 1;
  end loop;

  for p in
    select pr.* from proposals pr
    where pr.status = 'published' and pr.reminder_sent_at is null
      and pr.deadline > now()
      and coalesce((pr.rules_snapshot->>'reminder_after_days')::int, 0) > 0
      and pr.published_at + make_interval(days => (pr.rules_snapshot->>'reminder_after_days')::int) <= now()
    for update skip locked
  loop
    update proposals set reminder_sent_at = now() where id = p.id;
    if p.response_count < p.electorate_size then
      perform enqueue_proposal_event('proposal_reminder', p.project_id, p.id, null, null);
    end if;
  end loop;

  return v_closed;
end $$;
revoke execute on function close_due_proposals() from public, anon, authenticated;

select cron.schedule('close-due-proposals', '*/5 * * * *', $$ select public.close_due_proposals() $$);
-- Vangnet: verwerk de notificatiewachtrij ook als een directe poke mislukte.
select cron.schedule(
  'decision-notify',
  '*/5 * * * *',
  $$ select net.http_post(
       url := 'https://czgsqmbejsmcjusigwhp.supabase.co/functions/v1/decision-notify',
       headers := '{"Content-Type":"application/json"}'::jsonb,
       body := '{}'::jsonb
     ) $$
);

-- ---------------------------------------------------------------------------
-- 13. Besluitenlijst
-- ---------------------------------------------------------------------------
create or replace view decision_log with (security_invoker = true) as
  select 'proposal'::text as source,
         p.id,
         p.project_id,
         coalesce(p.closed_at, p.published_at, p.created_at) as decided_at,
         p.form,
         p.status,
         p.title,
         coalesce(p.outcome->>'summary', case when p.status = 'noted' then 'Ter kennisname (mandaatbesluit)' end) as summary_line,
         p.workgroup_id,
         w.name as workgroup_name,
         p.is_heavy,
         p.version,
         null::uuid as meeting_id
  from proposals p
  left join workgroups w on w.id = p.workgroup_id
  where p.status in ('adopted', 'rejected', 'amended', 'no_quorum', 'closed', 'noted')
  union all
  select 'meeting'::text,
         d.id,
         m.project_id,
         coalesce(m.date, d.created_at),
         'meeting'::text,
         coalesce(d.status, 'decided'),
         d.text,
         'Vergaderbesluit: ' || m.title,
         null::uuid,
         null::text,
         false,
         1,
         m.id
  from decisions d
  join meetings m on m.id = d.meeting_id;

-- ---------------------------------------------------------------------------
-- 14. Notificaties: types toestaan
-- ---------------------------------------------------------------------------
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (
  type = any (array[
    'comment','like','new_document','new_event','new_update',
    'payment_request_paid','payment_request_sent','reply','role_change',
    'new_post','new_comment','new_reply','new_update_comment',
    'document_request','document_request_submitted',
    'signature_request','signature_countersigned',
    'proposal_published','proposal_new_version','proposal_reminder',
    'proposal_question','proposal_answered','proposal_objection','proposal_closed'
  ]::text[])
);
alter table public.notifications drop constraint if exists notifications_related_type_check;
alter table public.notifications add constraint notifications_related_type_check check (
  related_type is null or related_type = any (array[
    'document','event','membership','payment_request','post','update',
    'comment','document_request','signature_request','proposal'
  ]::text[])
);

-- ---------------------------------------------------------------------------
-- 15. Realtime + grants
-- ---------------------------------------------------------------------------
do $$ begin
  alter publication supabase_realtime add table proposals;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table proposal_questions;
exception when duplicate_object then null; end $$;

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
  ensure_decision_rules(uuid),
  decision_outcome(text, jsonb, int, jsonb, boolean)
to authenticated;
revoke execute on function decisions_rpc_on() from public, anon, authenticated;
