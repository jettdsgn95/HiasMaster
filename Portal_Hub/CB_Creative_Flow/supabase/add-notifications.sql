-- =====================================================================
-- CB Media Hub — Notifications table (Phase 1.5)
-- Chạy trong Supabase SQL Editor. Idempotent.
-- Mục đích: push notification cho PIC khi có task mới, comment mention, status change, ...
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.notifications (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type                 text NOT NULL CHECK (type IN (
    'task_assigned', 'task_status_changed', 'task_comment',
    'order_status_changed', 'order_confirmed', 'order_needinfo',
    'delivery_preview', 'delivery_final', 'rating_received',
    'system'
  )),
  title                text NOT NULL,
  message              text,
  link                 text,                                              -- URL frontend: 'production-board.html?id=TASK-0001'
  related_entity_type  text CHECK (related_entity_type IN ('tasks','orders','deliveries','comments') OR related_entity_type IS NULL),
  related_entity_id    text,
  is_read              boolean NOT NULL DEFAULT false,
  created_at           timestamptz NOT NULL DEFAULT now(),
  read_at              timestamptz
);

CREATE INDEX IF NOT EXISTS idx_notif_user_unread
  ON public.notifications(user_id, created_at DESC)
  WHERE is_read = false;

CREATE INDEX IF NOT EXISTS idx_notif_user_all
  ON public.notifications(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notif_entity
  ON public.notifications(related_entity_type, related_entity_id);

-- Auto-update read_at khi is_read chuyển từ false → true
CREATE OR REPLACE FUNCTION public.touch_notif_read_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.is_read = true AND (OLD.is_read = false OR OLD.is_read IS NULL) THEN
    NEW.read_at = now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notif_read_at ON public.notifications;
CREATE TRIGGER trg_notif_read_at BEFORE UPDATE ON public.notifications
FOR EACH ROW EXECUTE FUNCTION public.touch_notif_read_at();

-- Verify
SELECT 'notifications table created' AS status,
       (SELECT count(*) FROM public.notifications) AS row_count;
