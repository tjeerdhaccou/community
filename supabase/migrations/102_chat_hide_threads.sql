-- ============================================================================
-- 102_chat_hide_threads.sql
-- Gesprek "verwijderen" uit je eigen lijst zonder het voor de ander te slopen:
-- chat_participants.hidden_at. Een thread is verborgen zolang er ná hidden_at
-- geen nieuw bericht is; een nieuw bericht van de ander haalt hem vanzelf
-- terug. Opnieuw starten van een DM (chat_start_direct) maakt hem ook weer
-- zichtbaar. De unread-telling slaat verborgen threads over.
-- ============================================================================

alter table chat_participants
  add column if not exists hidden_at timestamptz;

comment on column chat_participants.hidden_at is
  'Gesprek verborgen in de lijst van deze deelnemer tot er een nieuwer bericht is (last_message_at > hidden_at).';

-- Opnieuw starten van een DM → weer zichtbaar voor de starter.
create or replace function chat_start_direct(p_project_id uuid, p_other_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me   uuid := auth.uid();
  v_key  text;
  v_conv uuid;
begin
  if v_me is null then raise exception 'Niet ingelogd'; end if;
  if p_other_id is null or p_other_id = v_me then raise exception 'Kies een ander lid'; end if;
  if not public.chat_enabled(p_project_id) then raise exception 'Chat staat uit voor dit project'; end if;
  if not public.chat_member_ok(p_project_id, v_me) then raise exception 'Alleen leden kunnen chatten'; end if;
  if not public.chat_member_ok(p_project_id, p_other_id) then raise exception 'Dit lid kan (nog) niet chatten'; end if;

  v_key := p_project_id::text || ':' || least(v_me, p_other_id)::text || ':' || greatest(v_me, p_other_id)::text;

  select id into v_conv from public.chat_threads where direct_key = v_key;
  if v_conv is not null then
    update public.chat_participants set hidden_at = null where thread_id = v_conv and profile_id = v_me;
    return v_conv;
  end if;

  insert into public.chat_threads (project_id, kind, direct_key, created_by)
  values (p_project_id, 'direct', v_key, v_me)
  on conflict (direct_key) do nothing
  returning id into v_conv;

  if v_conv is null then
    select id into v_conv from public.chat_threads where direct_key = v_key;
    update public.chat_participants set hidden_at = null where thread_id = v_conv and profile_id = v_me;
    return v_conv;
  end if;

  insert into public.chat_participants (thread_id, profile_id, role)
  values (v_conv, v_me, 'member'), (v_conv, p_other_id, 'member');

  return v_conv;
end;
$$;

-- Unread: verborgen threads (zonder nieuwer bericht) tellen niet mee.
create or replace function chat_unread_counts(p_project_id uuid default null)
returns table (thread_id uuid, unread bigint, muted boolean)
language sql
security definer
stable
set search_path = ''
as $$
  select cp.thread_id,
         count(m.id),
         (cp.muted_until is not null and cp.muted_until > now()) as muted
  from public.chat_participants cp
  join public.chat_threads t on t.id = cp.thread_id
  left join public.chat_messages m
    on m.thread_id = cp.thread_id
   and m.created_at > cp.last_read_at
   and m.sender_id <> cp.profile_id
   and m.deleted_at is null
  where cp.profile_id = auth.uid()
    and (p_project_id is null or t.project_id = p_project_id)
    and (cp.hidden_at is null or t.last_message_at > cp.hidden_at)
  group by cp.thread_id, cp.muted_until;
$$;
