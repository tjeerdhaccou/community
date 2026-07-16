-- ============================================================================
-- 095_notifications_allow_payment_request_types.sql
-- CHECK-constraints notifications_type_check en notifications_related_type_check
-- verruimd zodat 'payment_request_sent' + 'payment_request_paid' als type en
-- 'payment_request' als related_type toegestaan zijn. Zonder deze migration
-- faalden de notification-inserts in send-payment-request en mollie-webhook
-- silently (edge fn logde alleen een warning).
--
-- Aanpak: DO-block leest bestaande in-use waarden uit de tabel en herbouwt de
-- constraint met bestaande set + de nieuwe types. Zo raakt er nooit een
-- bestaand type verloren, ook als de originele constraint waarden had die
-- niet in deze repo zijn vastgelegd.
-- ============================================================================

do $$
declare
  types_in_use text[];
  rel_in_use text[];
begin
  select array_agg(distinct type) into types_in_use
    from notifications where type is not null;
  select array_agg(distinct related_type) into rel_in_use
    from notifications where related_type is not null;

  -- Merge met nieuwe payment-request types (dedup via unnest+array_agg distinct)
  select array_agg(distinct v) into types_in_use
    from unnest(coalesce(types_in_use, array[]::text[]) ||
                array['payment_request_sent', 'payment_request_paid']) v;

  select array_agg(distinct v) into rel_in_use
    from unnest(coalesce(rel_in_use, array[]::text[]) ||
                array['payment_request']) v;

  alter table notifications drop constraint if exists notifications_type_check;
  alter table notifications drop constraint if exists notifications_related_type_check;

  execute format(
    'alter table notifications add constraint notifications_type_check check (type = any (%L::text[]))',
    types_in_use
  );

  execute format(
    'alter table notifications add constraint notifications_related_type_check check (related_type is null or related_type = any (%L::text[]))',
    rel_in_use
  );
end $$;
