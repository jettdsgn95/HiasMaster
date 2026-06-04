-- add-revision-link.sql — liên kết Order "chỉnh sửa/phát sinh" với Order gốc
-- Order mới được Client tự tạo SAU khi Order gốc đã hoàn tất 03 vòng feedback + bàn giao Final.
-- Idempotent: chạy lại nhiều lần OK.
--
-- Không bắt buộc: nếu chưa chạy, Order revision vẫn tạo được bình thường và quan hệ
-- với Order gốc vẫn được nhúng trong content_brief ("[Yêu cầu chỉnh sửa phát sinh — từ Order gốc ...]").
-- Chạy migration này để lưu quan hệ ở dạng cột có cấu trúc (truy vấn/báo cáo dễ hơn).

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS parent_order_id text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS order_origin   text;

COMMENT ON COLUMN public.orders.parent_order_id IS 'order_id gốc mà order này phát sinh từ (revision sau Final / quá 03 vòng).';
COMMENT ON COLUMN public.orders.order_origin   IS 'Nguồn gốc order: NULL = order thường; ''revision_over_limit'' = chỉnh sửa phát sinh sau khi order gốc hoàn tất 03 vòng feedback.';

CREATE INDEX IF NOT EXISTS idx_orders_parent_order_id ON public.orders (parent_order_id);
