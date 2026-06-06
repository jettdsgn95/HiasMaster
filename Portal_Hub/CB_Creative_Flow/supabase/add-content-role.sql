-- add-content-role.sql — cho phép role `content` + đường ghi wording an toàn.
-- Idempotent. Chạy trong Supabase SQL Editor SAU khi đã chạy:
--   add-brief-wording-fields.sql + add-brief-wording-workspace-fields.sql + add-brief-wording-confirmation.sql
-- Nguyên tắc: content CHỈ có SELECT orders + EXECUTE update_brief_wording.
--   KHÔNG cấp UPDATE orders cho content/client; mọi ghi wording đi qua RPC (whitelist cột).

-- =====================================================================
-- A1. Cho phép role 'content' trong public.users (trigger handle_new_auth_user cần CHECK này).
-- =====================================================================
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users ADD CONSTRAINT users_role_check
  CHECK (role IN ('admin','account','design','editor','client','content'));

-- =====================================================================
-- A2. RLS: content CHỈ ĐỌC orders (không đụng tasks/deliveries/settings → giữ "content không thấy Task Tracker").
--     KHÔNG thêm content vào is_staff()/is_admin_or_account(), KHÔNG thêm policy UPDATE cho content.
-- =====================================================================
DROP POLICY IF EXISTS "orders content read" ON public.orders;
CREATE POLICY "orders content read" ON public.orders
  FOR SELECT USING (public.current_user_role() = 'content');

-- =====================================================================
-- A3. RPC ghi wording (SECURITY DEFINER) — đường ghi DUY NHẤT cho content/client.
--     - Internal (admin/account/content): ghi workspace + status nội bộ.
--     - Chủ order (client, requester_id = auth.uid()): chỉ client_approved/client_feedback + field phản hồi.
--     Patch semantics: chỉ cập nhật key có trong p_patch; key thiếu giữ nguyên giá trị cũ.
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

  -- ---------- Nhánh INTERNAL: admin / account / content ----------
  IF r IN ('admin','account','content') THEN
    IF p_patch ? 'brief_wording_status' THEN
      v_status := p_patch->>'brief_wording_status';
      IF v_status NOT IN ('assigned','in_progress','submitted_to_account','account_revision','sent_to_client') THEN
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
-- SELECT proname FROM pg_proc WHERE proname = 'update_brief_wording';
-- SELECT conname FROM pg_constraint WHERE conname = 'users_role_check';
