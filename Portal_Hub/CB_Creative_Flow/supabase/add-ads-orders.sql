-- add-ads-orders.sql — Ads Orders: luồng Client → Content Team (tách khỏi Media/Production).
-- Idempotent. Chạy SAU: rls.sql + add-content-team.sql + add-content-initiatives.sql + add-content-to-media-order.sql.
--
-- Mục đích: Client gửi "Yêu cầu chạy Ads" (order_kind='ads_order') route THẲNG sang Lead Content,
--   KHÔNG qua Account/Production. Ads Order dùng lifecycle riêng `ads_status` + payload `ads_detail` (jsonb).
--   Nếu Ads cần creative, Lead Content tạo Internal Media Request (order_kind='internal_ads_media_request',
--   origin='ads_order', client_visible=false) → chảy Production như order thường, KHÔNG lộ Client Portal.
--
-- B1. Cột Ads trên orders.
-- B2. request_type CHECK += 'post' (tile "Ads / Post Basic" cũ đổi thành "Post" — bài post Media thiết kế).
-- B3. RLS: lead_content UPDATE ads_order; lead_content + content INSERT internal_ads_media_request.
--     (lead_content đã có SELECT toàn bộ orders từ add-content-team.sql; client thấy ads order của
--      mình qua policy requester sẵn có. Internal Ads Media Request client_visible=false → không lộ.)

-- =====================================================================
-- B1. Cột Ads Order trên orders
-- =====================================================================
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS owner_team           text,    -- 'content' cho Ads Order (chủ sở hữu luồng)
  ADD COLUMN IF NOT EXISTS ads_status           text,    -- lifecycle nội bộ Ads (submitted…report_updated)
  ADD COLUMN IF NOT EXISTS ads_detail           jsonb,   -- toàn bộ field 6 section form Ads
  ADD COLUMN IF NOT EXISTS source_ads_order_id  text;    -- ADS-xxx: Internal Media Request từ Ads link ngược

COMMENT ON COLUMN public.orders.owner_team IS 'content = Ads Order do Content Team sở hữu (không qua Account/Production).';
COMMENT ON COLUMN public.orders.ads_status IS 'Lifecycle nội bộ Ads Order. Client chỉ thấy public status map client-side.';
COMMENT ON COLUMN public.orders.ads_detail IS 'jsonb 6 section form Ads (campaign/mục tiêu/nội dung/kênh-ngân sách/creative/xác nhận).';
COMMENT ON COLUMN public.orders.source_ads_order_id IS 'ADS-xxx nguồn cho Internal Ads Media Request (order_kind=internal_ads_media_request).';

CREATE INDEX IF NOT EXISTS idx_orders_ads_order       ON public.orders(order_kind) WHERE order_kind = 'ads_order';
CREATE INDEX IF NOT EXISTS idx_orders_source_ads_order ON public.orders(source_ads_order_id);

-- =====================================================================
-- B2. request_type CHECK += 'post' (giữ toàn bộ giá trị cũ + 'media').
-- =====================================================================
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_request_type_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_request_type_check
  CHECK (request_type IN ('design','digital','video','motion','media','shoot','photo','ads','post','slide','other'));

-- =====================================================================
-- B2b. content_tasks.source += 'ads_order' (Content Task tách từ Ads Order).
--      Chỉ chạy nếu bảng content_tasks đã tồn tại (add-content-initiatives.sql).
-- =====================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='content_tasks') THEN
    ALTER TABLE public.content_tasks DROP CONSTRAINT IF EXISTS content_tasks_source_check;
    ALTER TABLE public.content_tasks ADD CONSTRAINT content_tasks_source_check
      CHECK (source IN ('client_order','content_initiated','strategy_board','campaign_package','ads_order'));
  END IF;
END $$;

-- =====================================================================
-- B3. RLS — lead_content vận hành Ads Order + tạo Internal Ads Media Request.
-- =====================================================================
-- lead_content cập nhật Ads Order (ads_status, gán PIC, ads_detail, link creative…).
DROP POLICY IF EXISTS "orders lead_content update ads" ON public.orders;
CREATE POLICY "orders lead_content update ads" ON public.orders
  FOR UPDATE USING (
    public.current_user_role() = 'lead_content'
    AND order_kind = 'ads_order'
  ) WITH CHECK (
    public.current_user_role() = 'lead_content'
    AND order_kind = 'ads_order'
  );

-- lead_content tạo Internal Media Request phục vụ Ads (nội bộ, không lộ Client).
DROP POLICY IF EXISTS "orders lead_content insert ads-media" ON public.orders;
CREATE POLICY "orders lead_content insert ads-media" ON public.orders
  FOR INSERT WITH CHECK (
    public.current_user_role() = 'lead_content'
    AND order_kind = 'internal_ads_media_request'
    AND client_visible = false
  );

-- lead_content cập nhật Internal Ads Media Request mình tạo (đính link, đổi note).
DROP POLICY IF EXISTS "orders lead_content update ads-media" ON public.orders;
CREATE POLICY "orders lead_content update ads-media" ON public.orders
  FOR UPDATE USING (
    public.current_user_role() = 'lead_content'
    AND order_kind = 'internal_ads_media_request'
  ) WITH CHECK (
    public.current_user_role() = 'lead_content'
    AND order_kind = 'internal_ads_media_request'
  );

-- PIC Content (role 'content') cũng có thể tạo Internal Ads Media Request từ Content Task ads.
DROP POLICY IF EXISTS "orders content insert ads-media" ON public.orders;
CREATE POLICY "orders content insert ads-media" ON public.orders
  FOR INSERT WITH CHECK (
    public.current_user_role() = 'content'
    AND order_kind = 'internal_ads_media_request'
    AND client_visible = false
  );

-- Verify (tùy chọn):
-- SELECT column_name FROM information_schema.columns WHERE table_name='orders' AND column_name IN ('owner_team','ads_status','ads_detail','source_ads_order_id');
-- SELECT policyname FROM pg_policies WHERE tablename='orders' AND policyname LIKE '%ads%';
