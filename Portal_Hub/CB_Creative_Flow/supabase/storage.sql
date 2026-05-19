-- =====================================================================
-- CB Media Hub — Supabase Storage setup (Phase 2)
--
-- Chạy SAU schema.sql + (tuỳ chọn) rls.sql.
-- Tạo 3 bucket + storage policies cho upload/download.
--
-- Conventions:
--   - Bucket `avatars`     : public-read, user upload tới `{user_id}/avatar.jpg`
--   - Bucket `brief-files` : private, requester upload + admin/account read
--   - Bucket `deliverables`: private, staff upload + client (qua order_id) read
-- =====================================================================

-- =====================================================================
-- 1. Create buckets (idempotent)
-- =====================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('avatars',      'avatars',      true,  2 * 1024 * 1024,  ARRAY['image/jpeg','image/png','image/webp']::text[]),
  ('brief-files',  'brief-files',  false, 50 * 1024 * 1024, NULL),
  ('deliverables', 'deliverables', false, 500 * 1024 * 1024, NULL)
ON CONFLICT (id) DO UPDATE SET
  public             = EXCLUDED.public,
  file_size_limit    = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- =====================================================================
-- 2. DROP existing storage policies (idempotent re-run)
-- =====================================================================
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname LIKE 'cbmh_%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
  END LOOP;
END $$;

-- =====================================================================
-- 3. AVATARS bucket policies
--    - Public read (bucket.public = true đã handle)
--    - Authenticated user upload TỚI folder `{auth.uid()}/...`
-- =====================================================================
CREATE POLICY "cbmh_avatars_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

CREATE POLICY "cbmh_avatars_self_write"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "cbmh_avatars_self_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "cbmh_avatars_self_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- =====================================================================
-- 4. BRIEF FILES bucket policies (request.html upload)
--    Path convention: `{order_id}/brief-{timestamp}.{ext}` (e.g. MEDIA-2026-0001/brief-1716800000.pdf)
--    - Requester upload tới order của mình (insert qua API trước khi orders row tồn tại,
--      nên check tạm relax: any authenticated upload)
--    - Read: staff (admin/account/design/editor) hoặc requester của order tương ứng
-- =====================================================================
CREATE POLICY "cbmh_brief_authenticated_upload"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'brief-files');

CREATE POLICY "cbmh_brief_staff_read"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'brief-files'
    AND (
      public.is_staff()
      OR EXISTS (
        SELECT 1 FROM public.orders o
        WHERE o.order_id = split_part(storage.objects.name, '/', 1)
          AND o.requester_id = auth.uid()
      )
    )
  );

CREATE POLICY "cbmh_brief_admin_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'brief-files' AND public.is_admin_or_account());

-- =====================================================================
-- 5. DELIVERABLES bucket policies (preview/final upload)
--    Path convention: `{order_id}/{task_id}/{preview|final}-{timestamp}.{ext}`
--    - Staff upload (design/editor/account/admin)
--    - Read: staff OR requester của order tương ứng (client thấy final của order mình)
-- =====================================================================
CREATE POLICY "cbmh_deliver_staff_write"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'deliverables' AND public.is_staff());

CREATE POLICY "cbmh_deliver_staff_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'deliverables' AND public.is_staff());

CREATE POLICY "cbmh_deliver_read"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'deliverables'
    AND (
      public.is_staff()
      OR EXISTS (
        SELECT 1 FROM public.orders o
        WHERE o.order_id = split_part(storage.objects.name, '/', 1)
          AND o.requester_id = auth.uid()
      )
    )
  );

CREATE POLICY "cbmh_deliver_admin_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'deliverables' AND public.is_admin_or_account());

-- =====================================================================
-- Notes:
--   - Storage policies dùng helper functions từ rls.sql (is_staff, is_admin,
--     is_admin_or_account). NẾU CHƯA chạy rls.sql, phải chạy phần helper
--     functions tối thiểu (section 2 của rls.sql) trước file này.
--   - Public URL avatar: `https://<project>.supabase.co/storage/v1/object/public/avatars/{user_id}/avatar.jpg`
--   - Private bucket cần signedUrl (ttl ≤ 60 mins) → frontend gọi
--     `MH.store.files.signedUrl(bucket, path, expiresIn)`
-- =====================================================================
