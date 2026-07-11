-- ============================================================================
-- 087_support_agent_start.sql
-- Laat een agent (org-admin / moderator / platform-admin) zélf een support-chat
-- starten met een lid. De insert-policy op support_conversations staat alleen
-- user_id = auth.uid() toe, dus het aanmaken loopt via een SECURITY DEFINER RPC
-- die eerst autoriseert. Het lid-widget toont één open gesprek per gebruiker,
-- daarom hergebruiken we het bestaande open gesprek in dezelfde org als dat er is
-- (anders ziet het lid alleen de nieuwste thread). Het bericht zelf wordt daarna
-- via de normale insert-policy geplaatst (can_handle_support), zodat bijlagen en
-- de sender_role-trigger ongewijzigd blijven werken.
-- ============================================================================

create or replace function support_agent_open_conversation(
  p_user_id    uuid,
  p_project_id uuid,
  p_org_id     uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_conv uuid;
begin
  if p_user_id is null then
    raise exception 'p_user_id is verplicht';
  end if;

  -- Autorisatie: dezelfde scope als het afhandelen van support.
  if not public.can_handle_support(p_project_id, p_org_id) then
    raise exception 'Niet gemachtigd om support te starten in deze context';
  end if;

  -- Hergebruik het bestaande open gesprek van dit lid binnen deze org (het
  -- lid-widget toont er sowieso maar één), anders een nieuw gesprek aanmaken.
  select id into v_conv
  from public.support_conversations
  where user_id = p_user_id
    and status = 'open'
    and org_id is not distinct from p_org_id
  order by last_message_at desc
  limit 1;

  if v_conv is null then
    insert into public.support_conversations (user_id, project_id, org_id)
    values (p_user_id, p_project_id, p_org_id)
    returning id into v_conv;
  end if;

  return v_conv;
end;
$$;

revoke execute on function support_agent_open_conversation(uuid, uuid, uuid) from public, anon;
grant  execute on function support_agent_open_conversation(uuid, uuid, uuid) to authenticated;
