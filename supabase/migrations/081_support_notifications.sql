-- ============================================================================
-- 081_support_notifications.sql
-- In-app belletje-notificatie voor het lid bij een agent-antwoord in de
-- support-chat. Zie SUPPORT_CHAT_SPEC.md §7.
-- ============================================================================

-- Verbreed de bestaande CHECK-constraints met de support-waarden.
alter table notifications drop constraint notifications_type_check;
alter table notifications add constraint notifications_type_check
  check (type = any (array[
    'comment','like','reply','new_update','new_event','event_reminder',
    'role_change','membership_approved','new_document','new_support_message'
  ]));

alter table notifications drop constraint notifications_related_type_check;
alter table notifications add constraint notifications_related_type_check
  check (related_type = any (array['post','update','event','document','membership','support']));

-- Bij een agent-antwoord: maak een notificatie voor het lid (de eigenaar van
-- het gesprek). related_id = conversation_id zodat de bell kan deeplinken naar
-- de widget (?support=<id>).
create or replace function support_notify_member()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_owner   uuid;
  v_project uuid;
begin
  if new.sender_role <> 'agent' then return new; end if;

  select user_id, project_id into v_owner, v_project
  from public.support_conversations
  where id = new.conversation_id;

  if v_owner is null or new.sender_id = v_owner then return new; end if;

  insert into public.notifications
    (recipient_id, actor_id, project_id, type, title, body, related_id, related_type)
  values
    (v_owner, new.sender_id, v_project, 'new_support_message',
     'Nieuw antwoord van support', left(new.body, 140),
     new.conversation_id, 'support');

  return new;
end;
$$;

revoke execute on function support_notify_member() from public, anon, authenticated;

create trigger support_messages_notify_member
  after insert on support_messages
  for each row execute function support_notify_member();
