-- =====================================================================
-- add-wording-deadline.sql — Hạn hoàn thành Content Wording (riêng)
-- =====================================================================
-- Trước đây trang Content Wording chỉ hiển thị `requested_deadline` (deadline
-- KHÁCH yêu cầu cho cả order) — không có hạn riêng cho việc wording, và Account
-- không đặt được hạn khi "Chuyển Content Wording".
--
-- Cột này cho Account đặt "Hạn hoàn thành wording" ở Order drawer (Brief Wording
-- Workflow). Content Wording hiển thị cột + tô đỏ khi trễ hạn.
--
-- Account/Admin ghi trực tiếp qua orders.update (RLS cho phép). KHÔNG đi qua RPC
-- update_brief_wording (cột này không nằm trong whitelist wording của content —
-- đặt hạn là việc của Account, content chỉ xem). data-store.js tự bóc cột nếu DB
-- chưa migrate (PGRST204 → stripMissingOptionalColumn) nên chạy muộn không vỡ FE.
-- Idempotent: ADD COLUMN IF NOT EXISTS.
-- =====================================================================

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS wording_deadline timestamptz;
