-- ============================================================================
-- Client "Duyệt Preview" (approve) + notif type 'client_preview_approved'.
-- Tiếp nối luồng Preview → Feedback → Final (bàn giao trong Order drawer).
-- KHÔNG khôi phục Delivery Log, KHÔNG dùng bảng deliveries cho luồng client.
--
-- Cách chạy: Supabase Dashboard → SQL Editor → paste → Run.
-- Idempotent (ADD COLUMN IF NOT EXISTS / DROP CONSTRAINT IF EXISTS) — không phá order cũ.
-- Chạy SAU add-revision-rounds.sql (đã có client_feedback_received trong CHECK).
-- ============================================================================

-- 1) Cột ghi nhận client duyệt Preview
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS approved_at timestamptz;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS approved_by text;

-- 2) Mở rộng notifications.type CHECK: thêm 'client_preview_approved'
--    (giữ nguyên toàn bộ type cũ + client_feedback_received đã thêm ở migration trước)
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK (type IN (
  'task_assigned', 'task_status_changed', 'task_comment',
  'order_new', 'order_status_changed', 'order_confirmed', 'order_needinfo', 'order_cancelled',
  'delivery_preview', 'delivery_final', 'rating_received',
  'client_feedback_received', 'client_preview_approved',
  'system'
));
