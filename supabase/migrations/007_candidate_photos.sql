-- ============================================================================
-- OFKOSSEC — Migration 007: storage bucket for candidate photos.
--
-- Candidate portraits are uploaded by Electoral Officers from the officer
-- panel. The bucket is public so the photos render on the ballot, but only
-- officers may write to it.
-- Idempotent: safe to run more than once.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Bucket
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'candidate-photos',
  'candidate-photos',
  true,
  5242880, -- 5 MB
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public             = excluded.public,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- Policies on storage.objects, scoped to this bucket only
-- ---------------------------------------------------------------------------
drop policy if exists candidate_photos_read on storage.objects;
create policy candidate_photos_read on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'candidate-photos');

drop policy if exists candidate_photos_insert on storage.objects;
create policy candidate_photos_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'candidate-photos' and public.is_admin());

drop policy if exists candidate_photos_update on storage.objects;
create policy candidate_photos_update on storage.objects
  for update to authenticated
  using (bucket_id = 'candidate-photos' and public.is_admin())
  with check (bucket_id = 'candidate-photos' and public.is_admin());

drop policy if exists candidate_photos_delete on storage.objects;
create policy candidate_photos_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'candidate-photos' and public.is_admin());
