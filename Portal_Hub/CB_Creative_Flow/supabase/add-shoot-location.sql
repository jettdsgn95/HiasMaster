-- =====================================================================
-- add-shoot-location.sql — thêm field "Địa điểm" cho task/order chụp ảnh
-- =====================================================================
-- Áp dụng cho request_type IN ('photo','shoot') hoặc task_type='Chụp ảnh'.
-- Field optional (nullable), không validate ràng buộc theo type ở DB —
-- để frontend conditional show. Migration idempotent: ADD COLUMN IF NOT EXISTS.
-- =====================================================================

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shoot_location text;
ALTER TABLE public.tasks  ADD COLUMN IF NOT EXISTS shoot_location text;
