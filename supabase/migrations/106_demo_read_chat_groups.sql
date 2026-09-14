-- ============================================================================
-- 106 — Klik-demo: groepsgesprekken zichtbaar in een demo-project
-- ----------------------------------------------------------------------------
-- De ledenchat (099) is gebouwd ná de demo-modus (105), dus een demo-bezoeker
-- zag een leeg chatscherm. Alle chat-policies (threads, deelnemers, berichten)
-- lezen via één SECURITY DEFINER-functie: chat_thread_visible(). Eén extra tak
-- daarin opent dus in één keer de hele leeskant, zonder risico op de
-- policy-recursie waar document_groups eerder op stukliep.
--
-- Bewust beperkt:
--   * alleen kind = 'group' — DM's tussen leden blijven dicht, ook in de demo
--   * alleen niet-gearchiveerde groepen
--   * alleen projecten met is_demo = true (is_demo_project uit migratie 105)
--
-- Schrijven blijft onmogelijk: posten loopt via chat_can_post() (deelnemer +
-- membership) en aansluiten via chat_member_ok(). Een anonieme demo-bezoeker
-- heeft geen membership, dus die deuren blijven dicht op de server.
-- ============================================================================

create or replace function chat_thread_visible(p_thread_id uuid)
returns boolean
language sql security definer stable
set search_path = ''
as $$
  select exists (
    select 1 from public.chat_threads t
    where t.id = p_thread_id
      and (
        public.is_chat_participant(t.id)
        or (t.kind = 'group' and t.join_policy = 'open' and t.archived_at is null
            and public.has_membership(t.project_id, 'member'))
        or (t.kind = 'group' and public.can_moderate_chat(t.project_id))
        or (t.kind = 'group' and t.archived_at is null
            and public.is_demo_project(t.project_id))
      )
  );
$$;
