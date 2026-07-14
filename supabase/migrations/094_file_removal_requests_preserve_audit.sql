-- ============================================================================
-- 094_file_removal_requests_preserve_audit.sql
-- Verzoek-audit behouden nadat de file is verwijderd: member_file_id
-- nullable + on delete set null (i.p.v. cascade). Zo blijft de historie
-- (wie vroeg wat aan, wie besloot wanneer, decision_note) staan ook na
-- goedkeuring — cruciaal voor AVG-audit trail.
-- ============================================================================

alter table public.file_removal_requests
  drop constraint if exists file_removal_requests_member_file_id_fkey;

alter table public.file_removal_requests
  alter column member_file_id drop not null;

alter table public.file_removal_requests
  add constraint file_removal_requests_member_file_id_fkey
  foreign key (member_file_id)
  references public.member_files(id)
  on delete set null;
