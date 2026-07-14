-- ============================================================================
-- 092_user_seen_markers.sql
-- Cross-device "gezien"-markers voor de blauwe bolletjes in de sidebar
-- (prikbord, projectnieuws, events). Vervangt de per-device localStorage-
-- markers: kijk je op je laptop het prikbord, dan verdwijnt de dot ook op je
-- telefoon.
--
-- Bewust géén generieke "notifications-read"-tabel — dit is puur "sinds
-- welk moment beschouwt deze user dit soort content in dit project als
-- gezien". De echte per-item is_read-vlag zit al op public.notifications.
-- ============================================================================

create table if not exists public.user_seen_markers (
  user_id    uuid        not null references auth.users(id) on delete cascade,
  project_id uuid        not null references public.projects(id) on delete cascade,
  kind       text        not null check (kind in ('board', 'updates', 'events')),
  seen_at    timestamptz not null default now(),
  primary key (user_id, project_id, kind)
);

alter table public.user_seen_markers enable row level security;

-- Users mogen alleen hun eigen markers zien en schrijven.
drop policy if exists "seen_markers_select_own" on public.user_seen_markers;
create policy "seen_markers_select_own"
  on public.user_seen_markers for select
  using (auth.uid() = user_id);

drop policy if exists "seen_markers_insert_own" on public.user_seen_markers;
create policy "seen_markers_insert_own"
  on public.user_seen_markers for insert
  with check (auth.uid() = user_id);

drop policy if exists "seen_markers_update_own" on public.user_seen_markers;
create policy "seen_markers_update_own"
  on public.user_seen_markers for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Realtime aanzetten zodat andere devices meebewegen wanneer je hier iets als
-- gezien markeert.
alter publication supabase_realtime add table public.user_seen_markers;
