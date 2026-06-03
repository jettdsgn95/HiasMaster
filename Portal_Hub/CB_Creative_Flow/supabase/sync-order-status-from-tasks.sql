-- ============================================================================
-- Auto-sync order.production_status + progress theo các task của order.
-- Nguồn chính (server-side, role-agnostic) cho tính năng "Production Status tự
-- đồng bộ theo Task Tracker". Chạy SECURITY DEFINER để BỎ QUA RLS — vì RLS chỉ
-- cho admin/account UPDATE orders, còn design/editor (người đổi status nhiều
-- nhất) bị chặn. Trigger này cập nhật order dùm họ, an toàn & nhất quán.
--
-- Quy tắc: order = task "BOTTLENECK" (tiến độ THẤP NHẤT) trong các task
-- non-standalone, non-cancelled của order → order chỉ "Hoàn thành" khi MỌI task
-- xong (quan trọng cho media: 2 task Quay + Chụp).
--
-- Cách chạy: Supabase Dashboard → SQL Editor → paste file này → Run.
-- An toàn chạy lại nhiều lần (idempotent: CREATE OR REPLACE + DROP IF EXISTS).
-- ============================================================================

-- 1) Map task.status → thang điểm tiến độ (khớp STATUS_PROGRESS bên production-board.js)
CREATE OR REPLACE FUNCTION public.task_status_rank(s text)
RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE s
    WHEN 'pending' THEN 20  WHEN 'received' THEN 30  WHEN 'inprogress' THEN 50
    WHEN 'review' THEN 65   WHEN 'revision' THEN 75  WHEN 'feedback_wait' THEN 80
    WHEN 'feedback_fix' THEN 85 WHEN 'ready' THEN 90 WHEN 'delivered' THEN 95
    WHEN 'completed' THEN 100 WHEN 'paused' THEN 0   WHEN 'cancelled' THEN 0
    ELSE 0 END;
$$;

-- 2) Map task.status → order.production_status (order chỉ dùng value có label đẹp;
--    pending/feedback_*/paused được quy về value tương ứng). Khớp TASK_TO_ORDER_STATUS.
CREATE OR REPLACE FUNCTION public.task_to_order_status(s text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE s
    WHEN 'pending'       THEN 'received'    -- task đã giao, chờ Production nhận
    WHEN 'feedback_wait' THEN 'delivered'   -- đã bàn giao, chờ client phản hồi
    WHEN 'feedback_fix'  THEN 'revision'    -- sửa theo feedback
    WHEN 'paused'        THEN 'inprogress'  -- tạm dừng → vẫn trong sản xuất
    ELSE s END;                             -- received/inprogress/review/revision/ready/delivered/completed/cancelled giữ nguyên
$$;

-- 3) Trigger function: tính lại order theo task bottleneck
CREATE OR REPLACE FUNCTION public.sync_order_production_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_order_id  text;
  v_status    text;
  v_progress  int;
  v_order_st  text;
BEGIN
  v_order_id := COALESCE(NEW.order_id, OLD.order_id);
  IF v_order_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Bottleneck = tiến độ thấp nhất trong task active (non-standalone, non-cancelled).
  SELECT t.status INTO v_status
  FROM public.tasks t
  WHERE t.order_id = v_order_id
    AND COALESCE(t.is_standalone, false) = false
    AND t.status <> 'cancelled'
  ORDER BY public.task_status_rank(t.status) ASC, t.created_at ASC
  LIMIT 1;

  -- Nếu không còn task active (vd tất cả cancelled) → xét cả cancelled.
  IF v_status IS NULL THEN
    SELECT t.status INTO v_status
    FROM public.tasks t
    WHERE t.order_id = v_order_id
      AND COALESCE(t.is_standalone, false) = false
    ORDER BY public.task_status_rank(t.status) ASC, t.created_at ASC
    LIMIT 1;
  END IF;

  -- Order không có task liên kết → không đổi gì.
  IF v_status IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  v_progress := public.task_status_rank(v_status);
  v_order_st := public.task_to_order_status(v_status);

  UPDATE public.orders
  SET production_status = v_order_st,
      progress          = v_progress,
      last_updated      = now()
  WHERE order_id = v_order_id
    AND (production_status IS DISTINCT FROM v_order_st OR progress IS DISTINCT FROM v_progress);

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 4) Gắn trigger vào tasks (insert/update/delete). Cập nhật orders, KHÔNG đụng tasks → không đệ quy.
DROP TRIGGER IF EXISTS trg_sync_order_status ON public.tasks;
CREATE TRIGGER trg_sync_order_status
AFTER INSERT OR UPDATE OR DELETE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.sync_order_production_status();

-- 5) (Tùy chọn) Backfill 1 lần: đồng bộ lại mọi order đang có task linked.
--    Bỏ comment để chạy ngay sau khi tạo trigger.
-- UPDATE public.orders o
-- SET production_status = sub.order_st, progress = sub.prog, last_updated = now()
-- FROM (
--   SELECT DISTINCT ON (t.order_id) t.order_id,
--          public.task_to_order_status(t.status) AS order_st,
--          public.task_status_rank(t.status)     AS prog
--   FROM public.tasks t
--   WHERE t.order_id IS NOT NULL AND COALESCE(t.is_standalone,false)=false AND t.status<>'cancelled'
--   ORDER BY t.order_id, public.task_status_rank(t.status) ASC, t.created_at ASC
-- ) sub
-- WHERE o.order_id = sub.order_id
--   AND (o.production_status IS DISTINCT FROM sub.order_st OR o.progress IS DISTINCT FROM sub.prog);
