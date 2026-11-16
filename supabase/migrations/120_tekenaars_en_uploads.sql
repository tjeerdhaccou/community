-- 120: ondertekenaars en uploads (MIDDEL tot LAAG)
--
-- 1. signature_request_signers "sig_signer_self_update" laat een ondertekenaar
--    de eigen rij vrij wijzigen, ook request_id. Wie het id van een tekenverzoek
--    van een andere organisatie kent, kan zijn rij daarheen verplaatsen en leest
--    dan dat verzoek en de bestanden ervan in de bucket signatures
--    (sig_current_user_signs). Nu: request_id, profile_id en de plaatsing van de
--    handtekening liggen vast voor de ondertekenaar zelf.
-- 2. Uploaden naar post-images (openbare bucket) en project-files mocht met elke
--    sessie, ook een anonieme demosessie. Nu niet meer voor anonieme sessies.
--    Een grens op grootte en type voor de openbare bucket.
--
-- Risico dat dit iets breekt:
--   1. Laag. De tekenpagina (community/src/views/Tekenen.jsx) schrijft status,
--      signed_* en viewed_at, niet de vastgezette kolommen. Beheerders en de
--      service-rol vallen buiten de controle.
--   2. Laag voor de policies. De grens op post-images (10 MB, alleen
--      afbeeldingen) kan een bestaande upload van een ander type weigeren:
--      controleer eerst met
--        select metadata->>'mimetype', count(*) from storage.objects
--        where bucket_id = 'post-images' group by 1;
--      en laat het laatste statement weg als daar iets anders dan afbeeldingen
--      tussen staat.

create or replace function public.sig_signer_guard()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if current_user in ('authenticated', 'anon')
     and not public.is_platform_admin()
     and not public.sig_current_user_admin_of_request(old.request_id) then
    if new.request_id is distinct from old.request_id
       or new.profile_id is distinct from old.profile_id
       or new.placement_page is distinct from old.placement_page
       or new.placement_x_norm is distinct from old.placement_x_norm
       or new.placement_y_norm is distinct from old.placement_y_norm
       or new.placement_width_norm is distinct from old.placement_width_norm
       or new.placement_height_norm is distinct from old.placement_height_norm then
      raise exception 'deze velden van een tekenverzoek kan alleen een beheerder wijzigen'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

revoke execute on function public.sig_signer_guard() from public, anon, authenticated;

drop trigger if exists sig_signer_guard on public.signature_request_signers;
create trigger sig_signer_guard
  before update on public.signature_request_signers
  for each row execute function public.sig_signer_guard();

drop policy if exists "Authenticated users can upload post images" on storage.objects;
create policy "Authenticated users can upload post images" on storage.objects
  for insert with check (
    bucket_id = 'post-images'
    and auth.role() = 'authenticated'
    and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
  );

drop policy if exists "Authenticated users can upload project files" on storage.objects;
create policy "Authenticated users can upload project files" on storage.objects
  for insert with check (
    bucket_id = 'project-files'
    and auth.role() = 'authenticated'
    and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
  );

update storage.buckets
set file_size_limit = 10485760,
    allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif', 'image/svg+xml']
where id = 'post-images';
