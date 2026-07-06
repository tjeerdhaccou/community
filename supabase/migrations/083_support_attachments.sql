-- ============================================================================
-- 083_support_attachments.sql
-- Bijlagen (afbeeldingen + PDF's) in de support-chat: kolommen op
-- support_messages + private storage-bucket met RLS voor gespreksdeelnemers.
-- ============================================================================

alter table support_messages
  add column if not exists attachment_path text,
  add column if not exists attachment_name text,
  add column if not exists attachment_type text;

-- Private bucket, 10MB, alleen afbeeldingen + PDF.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'support-attachments', 'support-attachments', false, 10485760,
  array['image/png','image/jpeg','image/webp','image/gif','application/pdf']
)
on conflict (id) do nothing;

-- Padconventie: <conversation_id>/<bestandsnaam>. Lezen/uploaden mag wie het
-- gesprek mag zien (eigenaar of agent via can_handle_support).
create policy "support_attach_select" on storage.objects for select
  using (
    bucket_id = 'support-attachments'
    and exists (
      select 1 from public.support_conversations c
      where c.id::text = (storage.foldername(name))[1]
      and (c.user_id = auth.uid() or public.can_handle_support(c.project_id, c.org_id))
    )
  );

create policy "support_attach_insert" on storage.objects for insert
  with check (
    bucket_id = 'support-attachments'
    and exists (
      select 1 from public.support_conversations c
      where c.id::text = (storage.foldername(name))[1]
      and (c.user_id = auth.uid() or public.can_handle_support(c.project_id, c.org_id))
    )
  );
