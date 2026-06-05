-- add-brief-wording-confirmation.sql — Phase 4: Client confirms brief wording (Account → Client).
-- Idempotent. Lưu vết Account gửi Client, Client feedback wording, và Client xác nhận wording.
-- Yêu cầu: đã chạy add-brief-wording-fields.sql (Phase 2) + add-brief-wording-workspace-fields.sql (Phase 3).
-- Lưu ý: brief_wording_round + wording_approved_at đã có từ Phase 2 (bỏ qua nếu đã tồn tại).

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS wording_client_sent_at      timestamptz,
  ADD COLUMN IF NOT EXISTS wording_client_sent_by      text,
  ADD COLUMN IF NOT EXISTS wording_client_feedback     text,
  ADD COLUMN IF NOT EXISTS wording_client_feedback_at  timestamptz,
  ADD COLUMN IF NOT EXISTS wording_approved_at         timestamptz,
  ADD COLUMN IF NOT EXISTS wording_approved_by         text;

COMMENT ON COLUMN public.orders.wording_client_sent_at     IS 'Phase 4: thời điểm Account gửi brief wording cho Client xác nhận.';
COMMENT ON COLUMN public.orders.wording_client_sent_by     IS 'Phase 4: Account/Admin đã gửi brief wording cho Client.';
COMMENT ON COLUMN public.orders.wording_client_feedback    IS 'Phase 4: nội dung Client yêu cầu chỉnh brief wording (vòng gần nhất).';
COMMENT ON COLUMN public.orders.wording_client_feedback_at IS 'Phase 4: thời điểm Client gửi yêu cầu chỉnh brief wording.';
COMMENT ON COLUMN public.orders.wording_approved_by        IS 'Phase 4: Client đã xác nhận brief wording.';

-- notifications.type CHECK — đăng ký 3 type wording Phase 4 (+ giữ đầy đủ type cũ).
-- Idempotent (DROP IF EXISTS → ADD). Danh sách phải khớp add-revision-rounds.sql.
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK (type IN (
  'task_assigned', 'task_status_changed', 'task_comment',
  'order_new', 'order_status_changed', 'order_confirmed', 'order_needinfo', 'order_cancelled',
  'delivery_preview', 'delivery_final',
  'rating_received', 'client_feedback_received', 'client_preview_approved',
  'wording_sent_to_client', 'wording_client_approved', 'wording_client_feedback',
  'system'
));
