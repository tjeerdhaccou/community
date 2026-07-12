-- ============================================================================
-- 089_payment_requests_storage_and_helpers.sql
-- Storage bucket voor gerenderde PDFs + RPCs voor de send + agree flow.
-- ============================================================================

-- Storage bucket voor gerenderde overeenkomst-PDFs (unsigned + signed).
insert into storage.buckets (id, name, public)
  values ('payment-requests', 'payment-requests', false)
  on conflict (id) do nothing;

-- Alleen service_role kan lezen/schrijven; clients krijgen signed URLs via
-- edge functions.
create policy "payment_requests_bucket_service_only"
  on storage.objects for all
  using (bucket_id = 'payment-requests' and auth.role() = 'service_role')
  with check (bucket_id = 'payment-requests' and auth.role() = 'service_role');

-- RPC: markeer verzoek als 'sent' — aangeroepen door send-payment-request
-- edge fn met service role. Zet sent_at + pdf-pad + access_token.
create or replace function mark_payment_request_sent(
  p_request_id       uuid,
  p_unsigned_pdf     text default null,
  p_access_token     text default null
) returns void
language plpgsql security definer set search_path = public as $$
begin
  update payment_requests set
    status = 'sent',
    sent_at = coalesce(sent_at, now()),
    unsigned_pdf_path = coalesce(p_unsigned_pdf, unsigned_pdf_path),
    access_token = coalesce(access_token, p_access_token)
  where id = p_request_id and status in ('draft', 'sent');
end;
$$;

-- RPC: haal payment_request via access_token — voor niet-ingelogd bezoek van
-- lid via magic-link. Return alleen non-sensitive velden (geen tokens).
create or replace function get_payment_request_by_token(p_token text)
returns table (
  id                    uuid,
  project_id            uuid,
  recipient_name        text,
  recipient_email       text,
  title                 text,
  description           text,
  amount_cents          integer,
  currency              text,
  reference             text,
  status                text,
  agreement_template_id uuid,
  agreed_at             timestamptz,
  paid_at               timestamptz,
  expires_at            timestamptz
) language sql stable security definer set search_path = public as $$
  select id, project_id, recipient_name, recipient_email, title, description,
         amount_cents, currency, reference, status, agreement_template_id,
         agreed_at, paid_at, expires_at
    from payment_requests
    where access_token = p_token
    limit 1;
$$;

grant execute on function get_payment_request_by_token(text) to anon, authenticated;

-- RPC: markeer akkoord op verzoek — vanuit lid-view voordat we naar Mollie
-- redirecten. Vereist status in ('sent','viewed'). Autoriseert via
-- authenticated user OR geldige access_token.
create or replace function agree_payment_request(
  p_request_id  uuid,
  p_token       text default null,
  p_ip          text default null,
  p_user_agent  text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_req payment_requests;
begin
  select * into v_req from payment_requests where id = p_request_id;
  if not found then
    raise exception 'not_found';
  end if;

  if v_req.recipient_profile_id is not distinct from auth.uid() and auth.uid() is not null then
    -- ok: ingelogd als recipient
  elsif p_token is not null and v_req.access_token = p_token then
    -- ok: token match
  else
    raise exception 'forbidden';
  end if;

  if v_req.status not in ('sent', 'viewed') then
    raise exception 'invalid_state';
  end if;

  update payment_requests set
    status = 'agreed',
    agreed_at = now(),
    agreed_ip = coalesce(p_ip, agreed_ip),
    agreed_user_agent = coalesce(p_user_agent, agreed_user_agent),
    viewed_at = coalesce(viewed_at, now())
  where id = p_request_id;
end;
$$;

grant execute on function agree_payment_request(uuid, text, text, text) to anon, authenticated;

-- RPC: markeer verzoek als gezien (info-only, geen state-change buiten viewed_at).
create or replace function mark_payment_request_viewed(
  p_request_id uuid,
  p_token      text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_req payment_requests;
begin
  select * into v_req from payment_requests where id = p_request_id;
  if not found then return; end if;

  if v_req.recipient_profile_id is not distinct from auth.uid() and auth.uid() is not null then
    -- ok
  elsif p_token is not null and v_req.access_token = p_token then
    -- ok
  else
    return; -- silent no-op op onbekende viewer
  end if;

  if v_req.viewed_at is null then
    update payment_requests
      set viewed_at = now(),
          status = case when status = 'sent' then 'viewed' else status end
      where id = p_request_id;
  end if;
end;
$$;

grant execute on function mark_payment_request_viewed(uuid, text) to anon, authenticated;
