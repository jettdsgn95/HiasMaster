-- ============================================================================
-- Revision Rounds — theo dõi vòng feedback/chỉnh sửa cho luồng Preview → Final.
-- Áp dụng CHÍNH cho order design (request_type design/digital). Các type khác giữ
-- linh hoạt (UI không chặn cứng). Bàn giao vẫn trong Order drawer — KHÔNG khôi phục
-- Delivery Log, KHÔNG dùng bảng deliveries cho luồng client thật.
--
-- Cách chạy: Supabase Dashboard → SQL Editor → paste → Run.
-- Idempotent (ADD COLUMN IF NOT EXISTS / DROP CONSTRAINT IF EXISTS) — KHÔNG phá
-- order hiện có (mọi order cũ: revision_round=0, revision_limit=3, feedback_status NULL).
-- ============================================================================

-- 1) Cột theo dõi revision trên orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS revision_round       int NOT NULL DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS revision_limit       int NOT NULL DEFAULT 3;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS feedback_status      text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS last_feedback_at     timestamptz;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS last_feedback_by     text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS latest_feedback_note text;

-- 2) CHECK cho feedback_status (NULL hợp lệ = chưa vào luồng feedback)
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_feedback_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_feedback_status_check CHECK (
  feedback_status IS NULL OR feedback_status IN (
    'waiting_feedback',     -- đã gửi Preview, chờ client feedback
    'feedback_received',    -- client vừa gửi feedback (1 vòng)
    'revision_in_progress', -- team đang chỉnh theo feedback
    'approved',             -- client duyệt / đã gửi Final
    'exceeded_limit'        -- đã dùng hết 3 vòng → feedback mới = task/order mới
  )
);

-- 3) Mở rộng notifications.type CHECK: thêm 'client_feedback_received'
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK (type IN (
  'task_assigned', 'task_status_changed', 'task_comment',
  'order_new', 'order_status_changed', 'order_confirmed', 'order_needinfo', 'order_cancelled',
  'delivery_preview', 'delivery_final', 'rating_received', 'client_feedback_received',
  'system'
));

-- 4) (Tùy chọn) backfill order đã delivered/feedback_wait cũ về feedback_status hợp lý.
--    Bỏ comment nếu muốn chuẩn hoá dữ liệu cũ.
-- UPDATE public.orders SET feedback_status = 'waiting_feedback'
--   WHERE feedback_status IS NULL AND production_status = 'feedback_wait';
-- UPDATE public.orders SET feedback_status = 'approved'
--   WHERE feedback_status IS NULL AND production_status IN ('delivered','completed');
