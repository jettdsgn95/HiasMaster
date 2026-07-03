-- add-brand-check.sql — Module "CB AI Brand Safety Checker" (kiểm duyệt hình ảnh AI).
-- Idempotent. Chạy trong Supabase SQL Editor SAU rls.sql (cần helper current_user_role()).
--
-- Mục đích: kiểm duyệt hình ảnh AI theo tiêu chí thương hiệu CB Centres.
-- Mọi user đăng nhập (kể cả client = chi nhánh/phòng ban) upload ảnh + nhận kết quả AI.
-- Media (admin/account/lead_media) hậu kiểm + dashboard; system_supervisor read-only.
--
-- Bảng: brand_checks (1 lượt kiểm) + brand_check_criteria (điểm từng tiêu chí).
-- Storage: bucket private `brand-check-images`, path `{uploader_id}/{check_id}/{filename}`.
-- Audit: dùng activity_log sẵn có (MH.store.activity.log) — KHÔNG tạo bảng audit riêng.

-- =====================================================================
-- B1. Bảng brand_checks.
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.brand_checks (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Mã kiểm duyệt người-đọc-được để quản lý + tra cứu (BSC-2026-0001).
  -- Trigger B1b tự sinh khi insert nếu client không gửi.
  check_code              text,
  title                   text NOT NULL,
  uploader_id             uuid REFERENCES public.users(id) ON DELETE SET NULL,
  uploader_name           text,
  uploader_email          text,
  unit_name               text,
  branch_name             text,
  usage_purpose           text,
  usage_channel           text,
  -- Nhóm nội dung: 1 nội bộ · 2 chi nhánh tự kiểm · 3 bắt buộc Media duyệt.
  usage_group             text CHECK (usage_group IN ('group_1_internal','group_2_self_check','group_3_media_review')),
  planned_publish_date    date,

  -- Quick flags người dùng khai báo trước khi kiểm (đầu vào rule engine).
  has_logo                boolean NOT NULL DEFAULT false,
  has_mascot              boolean NOT NULL DEFAULT false,
  has_uniform             boolean NOT NULL DEFAULT false,
  has_cb_facility         boolean NOT NULL DEFAULT false,
  is_admission_or_ads     boolean NOT NULL DEFAULT false,
  involves_partner        boolean NOT NULL DEFAULT false,
  contains_sensitive_info boolean NOT NULL DEFAULT false,

  -- Ảnh: bucket private → lưu path, hiển thị qua signed URL (image_url chỉ là cache/demo).
  image_url               text,
  image_storage_path      text,
  image_file_name         text,
  image_file_size         integer,
  image_mime_type         text,

  -- Kết quả AI. NEEDS_MANUAL_REVIEW = AI lỗi/không trả JSON hợp lệ → người duyệt tay.
  ai_score                integer,
  ai_status               text CHECK (ai_status IN ('PASS','NEEDS_REVISION','FAIL','REQUIRES_MEDIA_REVIEW','NEEDS_MANUAL_REVIEW')),
  ai_summary              text,
  ai_result_json          jsonb,
  ai_provider             text,
  ai_confidence           text,
  -- Rule override đã kích hoạt (mảng string tiếng Việt, từ rule engine).
  override_rules          jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Hậu kiểm thủ công của Media.
  manual_status           text NOT NULL DEFAULT 'PENDING'
                            CHECK (manual_status IN ('PENDING','APPROVED','REVISION_REQUIRED','REJECTED','ARCHIVED')),
  manual_reviewer_id      uuid REFERENCES public.users(id) ON DELETE SET NULL,
  manual_reviewer_name    text,
  manual_note             text,
  reviewed_at             timestamptz,

  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

-- Idempotent: thêm cột check_code nếu bảng có sẵn từ bản migration cũ.
ALTER TABLE public.brand_checks ADD COLUMN IF NOT EXISTS check_code text;

-- Mã kiểm duyệt tuần tự người-đọc-được: BSC-<năm>-<4 số> (vd BSC-2026-0001).
-- Trigger tự sinh khi INSERT nếu client không gửi → dùng để quản lý + tra cứu.
CREATE SEQUENCE IF NOT EXISTS public.brand_check_code_seq;
CREATE OR REPLACE FUNCTION public.set_brand_check_code()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.check_code IS NULL OR NEW.check_code = '' THEN
    NEW.check_code := 'BSC-' || to_char(now(), 'YYYY') || '-'
      || lpad(nextval('public.brand_check_code_seq')::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_brand_check_code ON public.brand_checks;
CREATE TRIGGER trg_brand_check_code
  BEFORE INSERT ON public.brand_checks
  FOR EACH ROW EXECUTE FUNCTION public.set_brand_check_code();

CREATE UNIQUE INDEX IF NOT EXISTS idx_brand_checks_code  ON public.brand_checks (check_code);
CREATE INDEX IF NOT EXISTS idx_brand_checks_uploader   ON public.brand_checks (uploader_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_brand_checks_ai_status  ON public.brand_checks (ai_status);
CREATE INDEX IF NOT EXISTS idx_brand_checks_manual     ON public.brand_checks (manual_status);
CREATE INDEX IF NOT EXISTS idx_brand_checks_group      ON public.brand_checks (usage_group);
CREATE INDEX IF NOT EXISTS idx_brand_checks_created    ON public.brand_checks (created_at DESC);

CREATE OR REPLACE FUNCTION public.touch_brand_check_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_brand_checks_updated_at ON public.brand_checks;
CREATE TRIGGER trg_brand_checks_updated_at
  BEFORE UPDATE ON public.brand_checks
  FOR EACH ROW EXECUTE FUNCTION public.touch_brand_check_updated_at();

-- =====================================================================
-- B2. Bảng brand_check_criteria — điểm từng tiêu chí (C1..C7 / 6 code AI).
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.brand_check_criteria (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_check_id  uuid NOT NULL REFERENCES public.brand_checks(id) ON DELETE CASCADE,
  criterion_code  text NOT NULL,
  criterion_name  text NOT NULL,
  status          text CHECK (status IN ('pass','warning','fail')),
  score           integer,
  max_score       integer,
  findings        text,
  recommendation  text,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bcc_check ON public.brand_check_criteria (brand_check_id);
CREATE INDEX IF NOT EXISTS idx_bcc_code  ON public.brand_check_criteria (criterion_code, status);

-- =====================================================================
-- B3. RLS.
--   • Mọi user đăng nhập: INSERT lượt kiểm của mình + SELECT lượt của mình.
--   • admin / account / lead_media: SELECT tất cả + UPDATE (manual review).
--   • system_supervisor: SELECT tất cả (read-only).
-- =====================================================================
ALTER TABLE public.brand_checks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "brand_checks owner read" ON public.brand_checks;
CREATE POLICY "brand_checks owner read" ON public.brand_checks
  FOR SELECT USING (uploader_id = auth.uid());

DROP POLICY IF EXISTS "brand_checks media read" ON public.brand_checks;
CREATE POLICY "brand_checks media read" ON public.brand_checks
  FOR SELECT USING (public.current_user_role() IN ('admin','account','lead_media','system_supervisor'));

DROP POLICY IF EXISTS "brand_checks owner insert" ON public.brand_checks;
CREATE POLICY "brand_checks owner insert" ON public.brand_checks
  FOR INSERT WITH CHECK (uploader_id = auth.uid());

-- Media hậu kiểm (manual_status/manual_note/…). RLS không giới hạn cột —
-- app chỉ ghi field manual_* qua UI; admin có thể sửa mọi field khi cần.
DROP POLICY IF EXISTS "brand_checks media update" ON public.brand_checks;
CREATE POLICY "brand_checks media update" ON public.brand_checks
  FOR UPDATE USING      (public.current_user_role() IN ('admin','account','lead_media'))
             WITH CHECK (public.current_user_role() IN ('admin','account','lead_media'));

DROP POLICY IF EXISTS "brand_checks admin delete" ON public.brand_checks;
CREATE POLICY "brand_checks admin delete" ON public.brand_checks
  FOR DELETE USING (public.current_user_role() = 'admin');

ALTER TABLE public.brand_check_criteria ENABLE ROW LEVEL SECURITY;

-- Đọc criteria nếu thấy được brand_check cha (owner hoặc media/supervisor).
DROP POLICY IF EXISTS "bcc read via parent" ON public.brand_check_criteria;
CREATE POLICY "bcc read via parent" ON public.brand_check_criteria
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.brand_checks bc
      WHERE bc.id = brand_check_criteria.brand_check_id
        AND (bc.uploader_id = auth.uid()
             OR public.current_user_role() IN ('admin','account','lead_media','system_supervisor'))
    )
  );

-- Ghi criteria: chủ lượt kiểm (app insert sau khi AI trả kết quả) hoặc media.
DROP POLICY IF EXISTS "bcc insert via parent" ON public.brand_check_criteria;
CREATE POLICY "bcc insert via parent" ON public.brand_check_criteria
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.brand_checks bc
      WHERE bc.id = brand_check_criteria.brand_check_id
        AND (bc.uploader_id = auth.uid()
             OR public.current_user_role() IN ('admin','account','lead_media'))
    )
  );

-- =====================================================================
-- B4. Storage bucket `brand-check-images` — private, JPG/PNG/WEBP, ≤10MB.
--     Path convention: `{uploader_id}/{check_id}/{ts}-{filename}` →
--     folder đầu = uploader uuid, dùng cho policy đọc theo chủ sở hữu.
--     Prefix policy `cbbrand_` (không đụng cbmh_/cbplan_ của storage.sql khác).
-- =====================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('brand-check-images', 'brand-check-images', false, 10 * 1024 * 1024,
        ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "cbbrand_write"  ON storage.objects;
DROP POLICY IF EXISTS "cbbrand_read"   ON storage.objects;
DROP POLICY IF EXISTS "cbbrand_delete" ON storage.objects;

-- Upload: user đăng nhập, chỉ vào folder uuid của chính mình.
CREATE POLICY "cbbrand_write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'brand-check-images'
    AND split_part(name, '/', 1) = auth.uid()::text
  );

-- Đọc (signed URL): chủ folder HOẶC media/supervisor.
CREATE POLICY "cbbrand_read" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'brand-check-images'
    AND (
      split_part(name, '/', 1) = auth.uid()::text
      OR public.current_user_role() IN ('admin','account','lead_media','system_supervisor')
    )
  );

-- Xóa: chủ folder hoặc admin.
CREATE POLICY "cbbrand_delete" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'brand-check-images'
    AND (split_part(name, '/', 1) = auth.uid()::text OR public.current_user_role() = 'admin')
  );

-- =====================================================================
-- B5. Realtime (dashboard Media auto-refresh khi có lượt kiểm mới).
-- =====================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='brand_checks') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.brand_checks;
  END IF;
END $$;

-- =====================================================================
-- B6. Edge Function (NGOÀI SQL — làm 1 lần trong Supabase CLI/Dashboard):
--   supabase functions deploy brand-check-analyze
--   supabase secrets set GEMINI_API_KEY=AIza...            (provider mặc định = gemini)
--   supabase secrets set BRAND_CHECK_MODEL=gemini-2.5-flash   (tùy chọn; hoặc gemini-2.0-flash)
--   (đổi provider: BRAND_CHECK_PROVIDER=openai+OPENAI_API_KEY · anthropic+ANTHROPIC_API_KEY
--    — xem functions/brand-check-analyze/index.ts)
-- Chưa deploy function → app chạy chế độ DEMO (kết quả mô phỏng, flag rõ trong UI).
-- =====================================================================

-- Verify (tùy chọn):
-- SELECT tablename, policyname, cmd FROM pg_policies WHERE tablename IN ('brand_checks','brand_check_criteria') ORDER BY tablename, policyname;
-- SELECT id, public, file_size_limit, allowed_mime_types FROM storage.buckets WHERE id = 'brand-check-images';
