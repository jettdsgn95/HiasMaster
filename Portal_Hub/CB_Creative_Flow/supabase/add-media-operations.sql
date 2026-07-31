-- =====================================================================
-- add-media-operations.sql — MEDIA CAPTURE ROUTING + LEAD MEDIA WORKSPACE
-- (2026-07-31)
--
-- Bối cảnh nghiệp vụ: Media Order (Quay / Chụp / Video) trước đây đi CHUNG
-- logic với Design → bị bắt qua cổng Content Wording mới được Confirm Brief.
-- Sai với phần lớn việc Media (chụp recap, quay lớp học, chụp cơ sở…): các
-- việc này chỉ cần chốt LOGISTICS (ngày/giờ, địa điểm, người đón team, dịch
-- vụ, output) chứ không cần wording.
--
-- Sau đổi:
--   · Media THƯỜNG  : bypass Content Wording. Owner = Lead Media.
--   · Media CÓ SCRIPT (TVC/testimonial/interview/VO/scripted video): KHÔNG kéo
--     cả Parent Order vào flow wording — chỉ sinh 1 **Content Script Subtask**
--     (bảng content_tasks, source='media_order') cho team Content xử lý; script
--     approved xong Parent Order mới mở khoá Push Production.
--   · Ads: KHÔNG đụng gì (add-ads-orders.sql giữ nguyên).
--
-- File này CHỈ additive (ADD COLUMN IF NOT EXISTS + policy mới). Chưa chạy thì
-- frontend vẫn hoạt động: data-store loop-strip bỏ cột thiếu (PGRST204), trạng
-- thái media_* fallback về giá trị mặc định trong JS.
--
-- Chạy SAU: rls.sql · add-shoot-date.sql · add-content-initiatives.sql ·
--           add-ads-orders.sql · add-media-lead-production.sql
-- Idempotent — chạy lại nhiều lần OK.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. orders — cột vòng đời riêng cho Media
--    CỐ Ý KHÔNG đụng `production_status` / `account_status` (Design/Ads đang
--    dùng chung) — thêm field phụ để không phá luồng cũ.
-- ---------------------------------------------------------------------
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS media_logistics_status text DEFAULT 'pending',  -- pending/checking/need_info/confirmed
  ADD COLUMN IF NOT EXISTS media_schedule_status  text DEFAULT 'pending',  -- pending/confirmed/rescheduled/cancelled
  ADD COLUMN IF NOT EXISTS media_script_required  boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS media_script_status    text DEFAULT 'not_required',
  ADD COLUMN IF NOT EXISTS media_review_status    text DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS media_content_type     text,   -- tvc/testimonial/interview/scripted_video/voice_over/course_intro/recruitment_video/video_series
  ADD COLUMN IF NOT EXISTS media_script_task_id   uuid,   -- content_tasks.id của Script Subtask
  ADD COLUMN IF NOT EXISTS media_service          text,   -- 'Quay' | 'Chụp' | 'Quay + Chụp' (chốt lại ở khâu logistics)
  ADD COLUMN IF NOT EXISTS onsite_contact         text,   -- người đón team tại điểm quay
  ADD COLUMN IF NOT EXISTS onsite_phone           text,
  ADD COLUMN IF NOT EXISTS media_logistics_note   text,   -- ghi chú/điểm thiếu khi review logistics
  ADD COLUMN IF NOT EXISTS production_pic_editor  text,   -- PIC dựng / hậu kỳ (ngoài PIC quay + PIC chụp)
  ADD COLUMN IF NOT EXISTS production_pic_editor_user_id uuid;

COMMENT ON COLUMN public.orders.media_logistics_status IS 'Media: pending/checking/need_info/confirmed — cổng thay thế Content Wording cho Media order.';
COMMENT ON COLUMN public.orders.media_script_status IS 'Media: not_required/required/subtask_created/in_progress/submitted_to_lead/lead_revision/lead_approved/script_approved.';
COMMENT ON COLUMN public.orders.media_review_status IS 'Media: not_started/source_uploaded/preview_uploaded/internal_review/revision/ready_to_deliver/delivered.';
COMMENT ON COLUMN public.orders.media_script_task_id IS 'content_tasks.id của Content Script Subtask (source=media_order).';

-- CHECK mềm: chỉ ràng buộc giá trị hợp lệ, cho phép NULL (order cũ chưa backfill).
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_media_logistics_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_media_logistics_status_check
  CHECK (media_logistics_status IS NULL OR media_logistics_status IN ('pending','checking','need_info','confirmed'));

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_media_schedule_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_media_schedule_status_check
  CHECK (media_schedule_status IS NULL OR media_schedule_status IN ('pending','confirmed','rescheduled','cancelled'));

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_media_script_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_media_script_status_check
  CHECK (media_script_status IS NULL OR media_script_status IN (
    'not_required','required','subtask_created','in_progress','submitted_to_lead',
    'lead_revision','lead_approved','script_approved','cancelled'));

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_media_review_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_media_review_status_check
  CHECK (media_review_status IS NULL OR media_review_status IN (
    'not_started','source_uploaded','preview_uploaded','internal_review','revision','ready_to_deliver','delivered'));

-- Media Operations lọc theo shoot_date + logistics/script status → index cho list/lịch.
CREATE INDEX IF NOT EXISTS idx_orders_media_shoot_date ON public.orders(shoot_date)
  WHERE shoot_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_media_logistics ON public.orders(media_logistics_status);
CREATE INDEX IF NOT EXISTS idx_orders_media_script_task ON public.orders(media_script_task_id);

-- ---------------------------------------------------------------------
-- 2. content_tasks — nhận Content Script Subtask từ Media Order
--    Tái dùng bảng content_tasks (Lead Content + PIC Content đã có sẵn UI,
--    review queue, SLA, mã CT-…) thay vì tạo bảng mới.
--    `order_id` (đã có) = MEDIA-xxx của Parent Order.
-- ---------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.content_tasks') IS NOT NULL THEN
    ALTER TABLE public.content_tasks DROP CONSTRAINT IF EXISTS content_tasks_source_check;
    ALTER TABLE public.content_tasks ADD CONSTRAINT content_tasks_source_check
      CHECK (source IN ('client_order','content_initiated','strategy_board','campaign_package','ads_order','media_order'));

    -- Loại script cần viết (kịch bản / bộ câu hỏi / VO / outline…) + link bản thảo.
    ALTER TABLE public.content_tasks
      ADD COLUMN IF NOT EXISTS media_content_type text,
      ADD COLUMN IF NOT EXISTS script_link text;
  ELSE
    RAISE NOTICE 'Bỏ qua content_tasks — chưa chạy add-content-initiatives.sql';
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 3. RLS — Lead Media tạo/đọc Content Script Subtask
--    content_tasks vốn là Content-Team-only (admin · lead_content · content).
--    Lead Media KHÔNG được thêm vào quyền chung — chỉ mở đúng 2 việc:
--      · INSERT subtask source='media_order'
--      · SELECT/UPDATE subtask source='media_order' (theo dõi + đánh dấu
--        script_approved sau khi Lead Content duyệt).
--    KHÔNG cho lead_media đọc content task của Client Order / task nội bộ.
-- ---------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.content_tasks') IS NULL THEN
    RAISE NOTICE 'Bỏ qua RLS content_tasks — bảng chưa tồn tại';
    RETURN;
  END IF;

  DROP POLICY IF EXISTS "content_tasks lead_media insert script" ON public.content_tasks;
  CREATE POLICY "content_tasks lead_media insert script" ON public.content_tasks
    FOR INSERT WITH CHECK (
      public.current_user_role() = 'lead_media'
      AND source = 'media_order'
    );

  DROP POLICY IF EXISTS "content_tasks lead_media read script" ON public.content_tasks;
  CREATE POLICY "content_tasks lead_media read script" ON public.content_tasks
    FOR SELECT USING (
      public.current_user_role() = 'lead_media'
      AND source = 'media_order'
    );

  DROP POLICY IF EXISTS "content_tasks lead_media update script" ON public.content_tasks;
  CREATE POLICY "content_tasks lead_media update script" ON public.content_tasks
    FOR UPDATE USING (
      public.current_user_role() = 'lead_media'
      AND source = 'media_order'
    ) WITH CHECK (
      public.current_user_role() = 'lead_media'
      AND source = 'media_order'
    );

  -- Comment trên script subtask (2 chiều Lead Media ↔ Content).
  -- ⚠ FK là `content_task_id` (add-content-initiatives.sql), KHÔNG phải `task_id`.
  IF to_regclass('public.content_task_comments') IS NOT NULL THEN
    DROP POLICY IF EXISTS "content_task_comments lead_media rw" ON public.content_task_comments;
    CREATE POLICY "content_task_comments lead_media rw" ON public.content_task_comments
      FOR ALL USING (
        public.current_user_role() = 'lead_media'
        AND EXISTS (SELECT 1 FROM public.content_tasks t WHERE t.id = content_task_comments.content_task_id AND t.source = 'media_order')
      ) WITH CHECK (
        public.current_user_role() = 'lead_media'
        AND EXISTS (SELECT 1 FROM public.content_tasks t WHERE t.id = content_task_comments.content_task_id AND t.source = 'media_order')
      );
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 4. Backfill — order Media cũ về trạng thái mặc định đúng ngữ nghĩa.
--    Order Media ĐÃ confirmed/đã push trước đây coi như logistics đã chốt
--    (không bắt Lead Media confirm lại đơn đang chạy).
-- ---------------------------------------------------------------------
UPDATE public.orders
   SET media_logistics_status = CASE
         WHEN account_status IN ('confirmed') OR production_status NOT IN ('unassigned','cancelled') THEN 'confirmed'
         ELSE COALESCE(media_logistics_status, 'pending')
       END,
       media_schedule_status = CASE
         WHEN shoot_date IS NOT NULL AND (account_status = 'confirmed' OR production_status NOT IN ('unassigned','cancelled')) THEN 'confirmed'
         ELSE COALESCE(media_schedule_status, 'pending')
       END,
       media_script_required = COALESCE(media_script_required, false),
       media_script_status   = COALESCE(media_script_status, 'not_required'),
       media_review_status   = COALESCE(media_review_status, 'not_started')
 WHERE request_type IN ('media','shoot','photo','video')
   AND COALESCE(order_kind, '') <> 'ads_order';

-- Verify:
-- SELECT column_name FROM information_schema.columns
--  WHERE table_name='orders' AND column_name LIKE 'media_%';
-- SELECT policyname FROM pg_policies WHERE tablename='content_tasks' AND policyname LIKE '%lead_media%';
-- SELECT order_id, request_type, media_logistics_status, media_script_status FROM public.orders
--  WHERE request_type IN ('media','shoot','photo','video') ORDER BY created_at DESC LIMIT 20;

SELECT 'add-media-operations.sql OK' AS result,
       (SELECT count(*) FROM public.orders WHERE request_type IN ('media','shoot','photo','video')) AS media_orders;
