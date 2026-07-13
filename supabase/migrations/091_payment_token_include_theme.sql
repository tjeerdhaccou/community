-- ============================================================================
-- 091_payment_token_include_theme.sql
-- Uitbreiding op get_payment_request_by_token: retourneer ook default_theme
-- van project + organisatie, zodat de lid-view de branding-stijl van de org
-- kan volgen (crowdbuilding vs warm/clean).
-- ============================================================================

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
  project_default_theme text,
  organization_id       uuid,
  organization_name     text,
  organization_logo_url text,
  organization_default_theme text
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
    p.default_theme       as project_default_theme,
    o.id       as organization_id,
    o.name     as organization_name,
    o.logo_url as organization_logo_url,
    o.default_theme as organization_default_theme
  from payment_requests pr
  left join agreement_templates at on at.id = pr.agreement_template_id
  join projects p on p.id = pr.project_id
  join organizations o on o.id = p.organization_id
  where pr.access_token = p_token
  limit 1;
$$;

grant execute on function get_payment_request_by_token(text) to anon, authenticated;
