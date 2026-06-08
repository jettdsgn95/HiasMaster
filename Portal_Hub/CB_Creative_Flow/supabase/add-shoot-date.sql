-- =====================================================================
-- add-shoot-date.sql — thêm field "Ngày / Giờ quay-chụp" cho order/task
-- =====================================================================
-- Áp dụng cho order type media/photo/shoot (buổi quay/chụp onsite) để
-- Calendar/Lịch chấm đúng NGÀY BUỔI QUAY (khác internal_deadline).
-- Trước migration này, ngày quay (media_date) chỉ bị gói vào text
-- content_brief ("[Buổi Quay / Chụp] ... Ngày: YYYY-MM-DD ...") nên không
-- chấm lịch chính xác được.
--
-- Field optional (nullable), không validate ràng buộc theo type ở DB —
-- frontend conditional set. Migration idempotent: ADD COLUMN IF NOT EXISTS.
-- order-form.js ghi shoot_date/shoot_time; database-orders.js pushToProduction
-- kế thừa sang task quay/chụp. data-store.js tự bóc cột nếu DB chưa migrate
-- (PGRST204 → stripMissingOptionalColumn), nên chạy muộn không vỡ frontend.
-- =====================================================================

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shoot_date date;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shoot_time text;
ALTER TABLE public.tasks  ADD COLUMN IF NOT EXISTS shoot_date date;
ALTER TABLE public.tasks  ADD COLUMN IF NOT EXISTS shoot_time text;
