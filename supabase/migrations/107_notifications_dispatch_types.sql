-- De edge function dispatch-notification schrijft in-app notificaties met
-- types (new_post, new_comment, new_reply, new_update_comment,
-- document_request, document_request_submitted, signature_request) en
-- related_types (comment, document_request, signature_request) die de
-- CHECK-constraints op public.notifications niet toestonden. Daardoor
-- faalde elke in-app notificatie uit die function stil (de insert-fout werd
-- alleen gelogd) — leden zagen bv. nooit een belletje voor een tekenverzoek.
-- Toegepast op prod 2026-10-09.

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK (
  type = ANY (ARRAY[
    'comment','like','new_document','new_event','new_update',
    'payment_request_paid','payment_request_sent','reply','role_change',
    'new_post','new_comment','new_reply','new_update_comment',
    'document_request','document_request_submitted',
    'signature_request','signature_countersigned'
  ]::text[])
);

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_related_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_related_type_check CHECK (
  related_type IS NULL OR related_type = ANY (ARRAY[
    'document','event','membership','payment_request','post','update',
    'comment','document_request','signature_request'
  ]::text[])
);
