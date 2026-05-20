-- =====================================================================
-- CB Media Hub — Add cancel_reason / cancel_cause / cancelled_by / cancelled_at
-- Idempotent. Run sau khi đã có schema.sql.
--
-- Lý do: Order Detail Drawer giờ mở modal "Hủy yêu cầu" yêu cầu Account/Admin
-- nhập lý do hủy + tuỳ chọn nguyên nhân chính + tuỳ chọn gửi thông báo cho client.
-- 4 cột mới được persist từ database-orders.js submitCancel().
-- =====================================================================

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS cancel_reason  text,
  ADD COLUMN IF NOT EXISTS cancel_cause   text
    CHECK (cancel_cause IS NULL OR cancel_cause IN (
      'brief_insufficient','no_longer_needed','deadline_mismatch','duplicate_request','other'
    )),
  ADD COLUMN IF NOT EXISTS cancelled_by   uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cancelled_at   timestamptz;

CREATE INDEX IF NOT EXISTS idx_orders_cancelled_at ON public.orders(cancelled_at)
  WHERE cancelled_at IS NOT NULL;

COMMENT ON COLUMN public.orders.cancel_reason IS 'Free-text reason entered by Account/Admin when cancelling.';
COMMENT ON COLUMN public.orders.cancel_cause  IS 'Optional category: brief_insufficient | no_longer_needed | deadline_mismatch | duplicate_request | other';
COMMENT ON COLUMN public.orders.cancelled_by  IS 'User who cancelled. NULL if cancelled via legacy demo flow.';
COMMENT ON COLUMN public.orders.cancelled_at  IS 'Timestamp of cancellation.';

-- ---------------------------------------------------------------------
-- Extend notifications.type CHECK constraint to include 'order_cancelled'
-- (used khi notify client checkbox được bật trong cancel modal).
-- ---------------------------------------------------------------------
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK (type IN (
  'task_assigned', 'task_status_changed', 'task_comment',
  'order_new', 'order_status_changed', 'order_confirmed', 'order_needinfo', 'order_cancelled',
  'delivery_preview', 'delivery_final', 'rating_received',
  'system'
));
