-- ============================================================================
-- 090_org_email_and_payment_context.sql
-- Twee dingen:
--  1) Kolommen op organizations voor afzender-branding van mails
--     - from_display_name: verschijnt als "<naam> via buuur" in de inbox
--     - reply_to_email: reply-to header zodat antwoorden bij de org komen
--     (from-adres blijft technisch noreply@buuur.nl want dat is het enige door
--     Resend geverifieerde domein. Custom domain per org kan later.)
--  2) get_payment_request_by_token uitbreiden zodat lid-view ook zonder RLS-
--     access de project- en org-context (naam, logo, brand-kleuren) én de
--     overeenkomsttekst kan tonen. Nodig voor niet-ingelogde bezoekers met
--     magic-link.
-- ============================================================================

alter table organizations
  add column if not exists reply_to_email text,
  add column if not exists from_display_name text;

drop function if exists get_payment_request_by_token(text);

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
  agreement_text        text,
  agreement_title       text,
  agreement_version     integer,
  agreed_at             timestamptz,
  paid_at               timestamptz,
  expires_at            timestamptz,
  project_name          text,
  project_slug          text,
  project_logo_url      text,
  project_brand_primary text,
  project_brand_accent  text,
  organization_id       uuid,
  organization_name     text,
  organization_logo_url text
) language sql stable security definer set search_path = public as $$
  select
    pr.id, pr.project_id, pr.recipient_name, pr.recipient_email, pr.title,
    pr.description, pr.amount_cents, pr.currency, pr.reference, pr.status,
    pr.agreement_template_id,
    at.content_markdown as agreement_text,
    at.title            as agreement_title,
    at.version          as agreement_version,
    pr.agreed_at, pr.paid_at, pr.expires_at,
    p.name  as project_name,
    p.slug  as project_slug,
    p.logo_url as project_logo_url,
    p.brand_primary_color as project_brand_primary,
    p.brand_accent_color  as project_brand_accent,
    o.id       as organization_id,
    o.name     as organization_name,
    o.logo_url as organization_logo_url
  from payment_requests pr
  left join agreement_templates at on at.id = pr.agreement_template_id
  join projects p on p.id = pr.project_id
  join organizations o on o.id = p.organization_id
  where pr.access_token = p_token
  limit 1;
$$;

grant execute on function get_payment_request_by_token(text) to anon, authenticated;
