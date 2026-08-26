-- Ontvanger kan een betaalverzoek-banner op zijn eigen dashboard wegklikken
-- zonder de status te wijzigen. Admin blijft het verzoek in het CMS zien met
-- de echte status (sent/viewed/agreed) — dit is puur een UI-hint voor de
-- ontvanger.

alter table payment_requests
  add column dismissed_by_recipient_at timestamptz;

-- Ontvanger mag geen directe UPDATE op payment_requests doen (bestaande
-- policy). We geven ze een RPC die exact één kolom zet voor hun eigen rij.
create or replace function dismiss_payment_request(request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update payment_requests
     set dismissed_by_recipient_at = now()
   where id = request_id
     and recipient_profile_id = auth.uid()
     and dismissed_by_recipient_at is null;
end;
$$;

grant execute on function dismiss_payment_request(uuid) to authenticated;
