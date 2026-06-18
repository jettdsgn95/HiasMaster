-- add-content-to-media-order.sql — Content Team Deep Workflow, Phase 5
-- (Content-to-Media Handoff → Internal Media Request).
-- Idempotent. Chạy SAU: rls.sql + add-content-team.sql + add-content-initiatives.sql.
--
-- Mục đích: Lead Content (sau khi duyệt content) tạo "Internal Media Request" =
--   1 order NỘI BỘ (client_visible=false) để Media team sản xuất qua Production flow.
--   KHÔNG lộ Client Portal. Order link ngược về content_task/content_plan.
--
-- B1. Thêm cột internal vào orders.
-- B2. RLS: lead_content INSERT order nội bộ (chỉ order_kind=internal_media_request,
--     client_visible=false) + SELECT order nội bộ mình tạo. KHÔNG mở order Client.

-- =====================================================================
-- B1. Cột internal media request trên orders
-- =====================================================================
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS origin                  text,     -- 'content_team' khi từ Content
  ADD COLUMN IF NOT EXISTS order_kind              text,     -- 'internal_media_request'
  ADD COLUMN IF NOT EXISTS client_visible          boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS source_content_task_id  uuid,
  ADD COLUMN IF NOT EXISTS source_content_plan_id  uuid,
  ADD COLUMN IF NOT EXISTS requester_role          text;

COMMENT ON COLUMN public.orders.client_visible IS 'false = order nội bộ (Internal Media Request từ Content), KHÔNG hiển thị Client Portal.';
COMMENT ON COLUMN public.orders.order_kind IS 'internal_media_request = order do Lead Content tạo cho Media team.';

CREATE INDEX IF NOT EXISTS idx_orders_source_content_task ON public.orders(source_content_task_id);

-- =====================================================================
-- B2. RLS — lead_content tạo + đọc order nội bộ của mình.
--     (orders đã có policy admin/account ALL + lead_content SELECT từ add-content-team.sql.)
--     Order nội bộ client_visible=false: Client Portal lọc bỏ ở client + RLS client
--     chỉ thấy order requester_id=mình nên không thấy order do lead tạo.
-- =====================================================================
DROP POLICY IF EXISTS "orders lead_content insert internal" ON public.orders;
CREATE POLICY "orders lead_content insert internal" ON public.orders
  FOR INSERT WITH CHECK (
    public.current_user_role() = 'lead_content'
    AND order_kind = 'internal_media_request'
    AND client_visible = false
  );

-- lead_content cập nhật order nội bộ mình tạo (vd đính link, đổi note) — KHÔNG đụng order Client.
DROP POLICY IF EXISTS "orders lead_content update internal" ON public.orders;
CREATE POLICY "orders lead_content update internal" ON public.orders
  FOR UPDATE USING (
    public.current_user_role() = 'lead_content'
    AND order_kind = 'internal_media_request'
  ) WITH CHECK (
    public.current_user_role() = 'lead_content'
    AND order_kind = 'internal_media_request'
  );

-- Verify (tùy chọn):
-- SELECT column_name FROM information_schema.columns WHERE table_name='orders' AND column_name IN ('origin','order_kind','client_visible','source_content_task_id');
-- SELECT policyname FROM pg_policies WHERE tablename='orders' AND policyname LIKE '%internal%';
