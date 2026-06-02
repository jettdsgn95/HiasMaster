-- =====================================================================
-- add-media-pics.sql — Order "Quay / Chụp ảnh" gộp (request_type='media') + 2 PIC
-- =====================================================================
-- (1) Mở rộng CHECK constraint request_type để chấp nhận 'media' (gộp Quay + Chụp).
--     BẮT BUỘC — nếu thiếu, INSERT order type media bị DB từ chối.
-- (2) Thêm 2 cột PIC: order media có thể cần videographer (Quay) + photographer (Chụp)
--     riêng. Khi Push → Production tạo 2 task (task_type 'shoot' cho Quay, 'photo' cho
--     Chụp — đã nằm trong CHECK của tasks nên không cần sửa tasks).
-- Idempotent: chạy lại nhiều lần OK. Chạy trong Supabase SQL Editor 1 lần.
-- =====================================================================

-- (1) request_type CHECK: thêm 'media'
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_request_type_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_request_type_check
  CHECK (request_type IN ('design','digital','video','motion','media','shoot','photo','ads','slide','other'));

-- (2) 2 PIC cho order media (nullable)
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS production_pic_video text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS production_pic_photo text;
