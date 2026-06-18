-- add-content-team.sql — Content Team Workspace (lead_content + content).
-- Idempotent. Chạy trong Supabase SQL Editor SAU:
--   add-brief-wording-fields.sql + add-brief-wording-workspace-fields.sql
--   + add-brief-wording-confirmation.sql + add-content-role.sql
--   (+ add-wording-deadline.sql nếu đã chạy — file này có ADD IF NOT EXISTS dự phòng).
--
-- Nội dung:
--   B1. Role mới `lead_content` (users_role_check).
--   B2. Status wording mới: pic_assigned / submitted_to_lead / lead_revision
--       (Lead Content đứng giữa Content và Account).
--   B3. Cột Lead review: wording_lead_note / wording_lead_reviewed_at /
--       wording_lead_reviewed_by / wording_submitted_to_lead_at (+ wording_deadline dự phòng).
--   B4. RLS: lead_content CHỈ SELECT orders + SELECT users (lookup notify).
--   B5. RPC update_brief_wording v2: thêm role lead_content, status mới, field Lead,
--       và wording_deadline (Lead đặt hạn khi gán PIC).

-- =====================================================================
-- B1. Role 'lead_content'
-- =====================================================================
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users ADD CONSTRAINT users_role_check
  CHECK (role IN ('admin','account','design','editor','client','content','lead_content'));

-- =====================================================================
-- B2. brief_wording_status: thêm 3 status Lead Content
--     none → assigned (Inbox Lead) → pic_assigned → in_progress
--     → submitted_to_lead → (lead_revision ↺) → submitted_to_account
--     → (account_revision ↺) → sent_to_client → (client_feedback ↺)
--     → client_approved → completed
-- =====================================================================
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_brief_wording_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_brief_wording_status_check
  CHECK (brief_wording_status IN (
    'none','assigned','pic_assigned','in_progress',
    'submitted_to_lead','lead_revision',
    'submitted_to_account','account_revision',
    'sent_to_client','client_feedback','client_approved','completed'));

-- =====================================================================
-- B3. Cột Lead review + dự phòng wording_deadline
-- =====================================================================
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS wording_lead_note            text,
  ADD COLUMN IF NOT EXISTS wording_lead_reviewed_at     timestamptz,
  ADD COLUMN IF NOT EXISTS wording_lead_reviewed_by     text,
  ADD COLUMN IF NOT EXISTS wording_submitted_to_lead_at timestamptz,
  ADD COLUMN IF NOT EXISTS wording_deadline             timestamptz;

COMMENT ON COLUMN public.orders.wording_lead_note IS 'Ghi chú review của Lead Content (trả Content chỉnh / duyệt). KHÔNG map sang client.';

-- =====================================================================
-- B4. RLS cho lead_content (chỉ đọc orders; users đọc để lookup notify).
--     KHÔNG thêm lead_content vào is_staff() — không thấy tasks/Task Tracker.
-- =====================================================================
DROP POLICY IF EXISTS "orders lead_content read" ON public.orders;
CREATE POLICY "orders lead_content read" ON public.orders
  FOR SELECT USING (public.current_user_role() = 'lead_content');

DROP POLICY IF EXISTS "users content team read" ON public.users;
CREATE POLICY "users content team read" ON public.users
  FOR SELECT USING (public.current_user_role() IN ('content','lead_content'));

-- =====================================================================
-- B5. RPC update_brief_wording v2 — đường ghi orders DUY NHẤT cho
--     content / lead_content / client (whitelist cột, validate status).
-- =====================================================================
CREATE OR REPLACE FUNCTION public.update_brief_wording(p_order_id text, p_patch jsonb)
RETURNS public.orders
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r        text := public.current_user_role();
  o        public.orders;
  out_row  public.orders;
  v_status text;
BEGIN
  IF p_patch IS NULL THEN p_patch := '{}'::jsonb; END IF;
  SELECT * INTO o FROM public.orders WHERE order_id = p_order_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'order % not found', p_order_id; END IF;

  -- ---------- Nhánh INTERNAL: admin / account / lead_content / content ----------
  IF r IN ('admin','account','content','lead_content') THEN
    IF p_patch ? 'brief_wording_status' THEN
      v_status := p_patch->>'brief_wording_status';
      IF v_status NOT IN ('assigned','pic_assigned','in_progress',
                          'submitted_to_lead','lead_revision',
                          'submitted_to_account','account_revision','sent_to_client') THEN
        RAISE EXCEPTION 'internal role cannot set brief_wording_status=%', v_status;
      END IF;
    END IF;

    UPDATE public.orders SET
      wording_brief            = CASE WHEN p_patch ? 'wording_brief'            THEN p_patch->>'wording_brief'            ELSE wording_brief END,
      wording_objective        = CASE WHEN p_patch ? 'wording_objective'        THEN p_patch->>'wording_objective'        ELSE wording_objective END,
      wording_core_message     = CASE WHEN p_patch ? 'wording_core_message'     THEN p_patch->>'wording_core_message'     ELSE wording_core_message END,
      wording_required_info    = CASE WHEN p_patch ? 'wording_required_info'    THEN p_patch->>'wording_required_info'    ELSE wording_required_info END,
      wording_tone_style       = CASE WHEN p_patch ? 'wording_tone_style'       THEN p_patch->>'wording_tone_style'       ELSE wording_tone_style END,
      wording_cta              = CASE WHEN p_patch ? 'wording_cta'              THEN p_patch->>'wording_cta'              ELSE wording_cta END,
      wording_production_note  = CASE WHEN p_patch ? 'wording_production_note'  THEN p_patch->>'wording_production_note'  ELSE wording_production_note END,
      wording_content_checklist = CASE WHEN p_patch ? 'wording_content_checklist' THEN p_patch->>'wording_content_checklist' ELSE wording_content_checklist END,
      wording_account_note     = CASE WHEN p_patch ? 'wording_account_note'     THEN p_patch->>'wording_account_note'     ELSE wording_account_note END,
      wording_lead_note        = CASE WHEN p_patch ? 'wording_lead_note'        THEN p_patch->>'wording_lead_note'        ELSE wording_lead_note END,
      wording_lead_reviewed_at = CASE WHEN p_patch ? 'wording_lead_reviewed_at' THEN (p_patch->>'wording_lead_reviewed_at')::timestamptz ELSE wording_lead_reviewed_at END,
      wording_lead_reviewed_by = CASE WHEN p_patch ? 'wording_lead_reviewed_by' THEN p_patch->>'wording_lead_reviewed_by' ELSE wording_lead_reviewed_by END,
      wording_submitted_to_lead_at = CASE WHEN p_patch ? 'wording_submitted_to_lead_at' THEN (p_patch->>'wording_submitted_to_lead_at')::timestamptz ELSE wording_submitted_to_lead_at END,
      wording_deadline         = CASE WHEN p_patch ? 'wording_deadline'         THEN (p_patch->>'wording_deadline')::timestamptz ELSE wording_deadline END,
      wording_client_source_link=CASE WHEN p_patch ? 'wording_client_source_link' THEN p_patch->>'wording_client_source_link' ELSE wording_client_source_link END,
      wording_doc_link         = CASE WHEN p_patch ? 'wording_doc_link'         THEN p_patch->>'wording_doc_link'         ELSE wording_doc_link END,
      wording_reference_link   = CASE WHEN p_patch ? 'wording_reference_link'   THEN p_patch->>'wording_reference_link'   ELSE wording_reference_link END,
      wording_internal_link    = CASE WHEN p_patch ? 'wording_internal_link'    THEN p_patch->>'wording_internal_link'    ELSE wording_internal_link END,
      brief_wording_pic        = CASE WHEN p_patch ? 'brief_wording_pic'        THEN p_patch->>'brief_wording_pic'        ELSE brief_wording_pic END,
      wording_submitted_by     = CASE WHEN p_patch ? 'wording_submitted_by'     THEN p_patch->>'wording_submitted_by'     ELSE wording_submitted_by END,
      wording_submitted_at     = CASE WHEN p_patch ? 'wording_submitted_at'     THEN (p_patch->>'wording_submitted_at')::timestamptz ELSE wording_submitted_at END,
      wording_client_sent_by   = CASE WHEN p_patch ? 'wording_client_sent_by'   THEN p_patch->>'wording_client_sent_by'   ELSE wording_client_sent_by END,
      wording_client_sent_at   = CASE WHEN p_patch ? 'wording_client_sent_at'   THEN (p_patch->>'wording_client_sent_at')::timestamptz ELSE wording_client_sent_at END,
      brief_wording_round      = CASE WHEN p_patch ? 'brief_wording_round'      THEN (p_patch->>'brief_wording_round')::int ELSE brief_wording_round END,
      brief_wording_status     = CASE WHEN p_patch ? 'brief_wording_status'     THEN p_patch->>'brief_wording_status'     ELSE brief_wording_status END,
      wording_last_updated_at  = now(),
      last_updated             = now()
    WHERE order_id = p_order_id
    RETURNING * INTO out_row;
    RETURN out_row;
  END IF;

  -- ---------- Nhánh CLIENT: chủ order ----------
  IF o.requester_id = auth.uid() THEN
    IF p_patch ? 'brief_wording_status' THEN
      v_status := p_patch->>'brief_wording_status';
      IF v_status NOT IN ('client_approved','client_feedback') THEN
        RAISE EXCEPTION 'client cannot set brief_wording_status=%', v_status;
      END IF;
    END IF;

    UPDATE public.orders SET
      brief_wording_status       = CASE WHEN p_patch ? 'brief_wording_status'       THEN p_patch->>'brief_wording_status' ELSE brief_wording_status END,
      brief_wording_round        = CASE WHEN p_patch ? 'brief_wording_round'        THEN (p_patch->>'brief_wording_round')::int ELSE brief_wording_round END,
      wording_client_feedback    = CASE WHEN p_patch ? 'wording_client_feedback'    THEN p_patch->>'wording_client_feedback' ELSE wording_client_feedback END,
      wording_client_feedback_at = CASE WHEN p_patch ? 'wording_client_feedback_at' THEN (p_patch->>'wording_client_feedback_at')::timestamptz ELSE wording_client_feedback_at END,
      wording_approved_at        = CASE WHEN p_patch ? 'wording_approved_at'        THEN (p_patch->>'wording_approved_at')::timestamptz ELSE wording_approved_at END,
      wording_approved_by        = CASE WHEN p_patch ? 'wording_approved_by'        THEN p_patch->>'wording_approved_by' ELSE wording_approved_by END,
      wording_last_updated_at    = now(),
      last_updated               = now()
    WHERE order_id = p_order_id
    RETURNING * INTO out_row;
    RETURN out_row;
  END IF;

  RAISE EXCEPTION 'not allowed to update wording for order %', p_order_id;
END $$;

GRANT EXECUTE ON FUNCTION public.update_brief_wording(text, jsonb) TO authenticated;

-- Verify (tùy chọn):
-- SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conname IN ('users_role_check','orders_brief_wording_status_check');
-- SELECT policyname FROM pg_policies WHERE tablename IN ('orders','users') ORDER BY policyname;
