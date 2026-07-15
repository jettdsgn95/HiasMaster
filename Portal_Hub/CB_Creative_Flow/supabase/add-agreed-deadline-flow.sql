-- ============================================================================
-- P0 — Deadline Flow Client ↔ Account ↔ Production (2026-07-15)
-- 3 lớp deadline:
--   requested_deadline (date)      = deadline gốc Client nhập — KHÔNG BAO GIỜ ghi đè (audit)
--   agreed_deadline    (timestamptz) = deadline Account đề xuất / đã thống nhất với Client
--   internal_deadline  (timestamptz) = deadline nội bộ giao PIC (Client không thấy)
-- effective_deadline hiển thị cho Client/Account = agreed_deadline || requested_deadline.
--
-- Flow: Account đề xuất (proposed) → Client Đồng ý (accepted) / Cần trao đổi lại (rejected).
-- Client KHÔNG có quyền UPDATE orders dưới RLS → phản hồi qua RPC
-- respond_deadline_proposal (SECURITY DEFINER, chỉ đụng cột deadline-response).
--
-- Idempotent — chạy lại nhiều lần OK. Chạy SAU rls.sql + add-notifications.sql
-- (+ add-preview-approval.sql vì CHECK notifications dưới đây gộp đủ type cũ).
-- ============================================================================

-- 1) Cột mới trên orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS agreed_deadline           timestamptz,
  ADD COLUMN IF NOT EXISTS deadline_proposal_status  text DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS deadline_proposal_reason  text,
  ADD COLUMN IF NOT EXISTS deadline_proposed_by      text,
  ADD COLUMN IF NOT EXISTS deadline_proposed_by_id   uuid,
  ADD COLUMN IF NOT EXISTS deadline_proposed_at      timestamptz,
  ADD COLUMN IF NOT EXISTS deadline_responded_at     timestamptz,
  ADD COLUMN IF NOT EXISTS deadline_response_by      uuid,
  ADD COLUMN IF NOT EXISTS deadline_response_note    text,
  ADD COLUMN IF NOT EXISTS deadline_history          jsonb DEFAULT '[]'::jsonb;

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_deadline_proposal_status_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_deadline_proposal_status_check
  CHECK (deadline_proposal_status IN ('none', 'proposed', 'accepted', 'rejected'));

CREATE INDEX IF NOT EXISTS idx_orders_deadline_proposal_status
  ON public.orders(deadline_proposal_status) WHERE deadline_proposal_status = 'proposed';

-- 2) notifications.type CHECK += 4 type deadline (giữ nguyên toàn bộ type cũ —
--    list đầy đủ nhất tính tới add-preview-approval.sql)
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK (type IN (
  'task_assigned', 'task_status_changed', 'task_comment',
  'order_new', 'order_status_changed', 'order_confirmed', 'order_needinfo', 'order_cancelled',
  'delivery_preview', 'delivery_final',
  'rating_received', 'client_feedback_received', 'client_preview_approved',
  'wording_sent_to_client', 'wording_client_approved', 'wording_client_feedback',
  'deadline_proposed', 'deadline_accepted', 'deadline_rejected', 'deadline_updated',
  'system'
));

-- 3) RPC — Client phản hồi đề xuất deadline (Đồng ý / Cần trao đổi lại).
--    SECURITY DEFINER vì RLS orders KHÔNG cho client UPDATE trực tiếp
--    (bài học update_brief_wording: update qua RLS khớp 0 dòng → null im lặng).
--    Guard: caller phải là ĐÚNG requester của order (requester_id = auth.uid()
--    fallback requester_email = email JWT) + order đang ở trạng thái 'proposed'.
--    CHỈ đụng cột deadline-response + history — không đụng cột nghiệp vụ khác.
CREATE OR REPLACE FUNCTION public.respond_deadline_proposal(
  p_order_id text,
  p_action   text,          -- 'accepted' | 'rejected'
  p_note     text DEFAULT NULL
)
RETURNS public.orders
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  o        public.orders;
  out_row  public.orders;
  v_email  text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_by     text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF p_action NOT IN ('accepted', 'rejected') THEN
    RAISE EXCEPTION 'invalid action % (accepted|rejected)', p_action;
  END IF;

  SELECT * INTO o FROM public.orders WHERE order_id = p_order_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'order % not found', p_order_id; END IF;

  -- Caller phải là requester của order này
  IF NOT (o.requester_id = auth.uid()
          OR (o.requester_email IS NOT NULL AND lower(o.requester_email) = v_email)) THEN
    RAISE EXCEPTION 'only the order requester can respond to a deadline proposal';
  END IF;

  IF coalesce(o.deadline_proposal_status, 'none') <> 'proposed' THEN
    RAISE EXCEPTION 'no pending deadline proposal on order % (status=%)', p_order_id, o.deadline_proposal_status;
  END IF;

  IF p_action = 'rejected' AND (p_note IS NULL OR btrim(p_note) = '') THEN
    RAISE EXCEPTION 'note is required when rejecting a deadline proposal';
  END IF;

  SELECT coalesce(name, email) INTO v_by FROM public.users WHERE id = auth.uid();

  UPDATE public.orders SET
    deadline_proposal_status = p_action,
    deadline_responded_at    = now(),
    deadline_response_by     = auth.uid(),
    deadline_response_note   = CASE WHEN p_action = 'rejected' THEN left(btrim(p_note), 2000) ELSE NULL END,
    deadline_history         = coalesce(deadline_history, '[]'::jsonb) || jsonb_build_object(
                                 'type',     p_action,
                                 'deadline', o.agreed_deadline,
                                 'note',     CASE WHEN p_action = 'rejected' THEN left(btrim(p_note), 2000) ELSE NULL END,
                                 'by',       coalesce(v_by, v_email),
                                 'at',       now()
                               ),
    last_updated             = now()
  WHERE order_id = p_order_id
  RETURNING * INTO out_row;

  RETURN out_row;
END;
$$;

REVOKE ALL ON FUNCTION public.respond_deadline_proposal(text, text, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.respond_deadline_proposal(text, text, text) TO authenticated;

-- Verify:
-- SELECT column_name FROM information_schema.columns
--   WHERE table_name='orders' AND column_name LIKE 'deadline%' OR column_name='agreed_deadline';
-- SELECT proname FROM pg_proc WHERE proname='respond_deadline_proposal';
