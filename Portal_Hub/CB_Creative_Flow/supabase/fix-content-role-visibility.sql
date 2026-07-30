-- =====================================================================
-- fix-content-role-visibility.sql — SIẾT quyền ĐỌC/GHI của role `content`
--                                    (2026-07-30)
--
-- Vấn đề: role `content` đang SELECT được TOÀN BỘ orders (wording) /
-- content_tasks / content_plans (policy "... content read" chỉ check role,
-- không check assigned) → data exposure, không chỉ lỗi UI.
--
-- Mục tiêu: content CHỈ đọc/sửa việc CỦA MÌNH:
--   · orders: order wording được gán cho mình (brief_wording_pic_user_id /
--     tên), CỘNG order nội bộ (internal media request) + Ads Order do chính
--     content này liên kết qua content_task của mình — CẦN để theo dõi
--     Production (fillMediaTrack) + sync ads_status (syncAdsOrderFromTask).
--     KHÔNG lộ client order / order của content khác.
--   · content_tasks: task được gán cho mình HOẶC do mình tạo.
--   · content_plans: plan có ÍT NHẤT 1 task con liên quan đến mình.
--   · update_brief_wording: content chỉ ghi order được gán (guard trong RPC).
--
-- KHÔNG đụng admin / lead_content / account (giữ nguyên quyền). KHÔNG thêm
-- content vào is_staff(). KHÔNG cấp UPDATE orders trực tiếp cho content
-- (vẫn qua RPC update_brief_wording). Content update content_tasks vẫn qua
-- policy id-based (add-pic-user-id.sql).
--
-- Idempotent (DROP IF EXISTS trước CREATE). Chạy SAU: rls.sql +
-- add-content-role.sql + add-content-team.sql + add-content-initiatives.sql +
-- add-content-to-media-order.sql + add-ads-orders.sql + add-pic-user-id.sql.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. orders — content chỉ đọc order LIÊN QUAN mình (thay policy đọc-tất-cả).
--    Gỡ CẢ tên policy cũ ("orders content read") LẪN tên mới (idempotent).
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "orders content read" ON public.orders;
DROP POLICY IF EXISTS "orders content read assigned wording" ON public.orders;

CREATE POLICY "orders content read assigned wording" ON public.orders
FOR SELECT USING (
  public.current_user_role() = 'content'
  AND (
    -- (a) Order wording được gán cho content này.
    brief_wording_pic_user_id = auth.uid()
    OR brief_wording_pic = (SELECT name FROM public.users WHERE id = auth.uid())
    -- (b) Order NỘI BỘ (internal media request) tạo từ content_task của content này
    --     → để theo dõi Production trong content-workbench (fillMediaTrack).
    OR (orders.source_content_task_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.content_tasks t
          WHERE t.id = orders.source_content_task_id
            AND (t.assigned_pic_user_id = auth.uid()
                 OR t.created_by_user_id = auth.uid()
                 OR t.assigned_pic = (SELECT name FROM public.users WHERE id = auth.uid()))))
    -- (c) Ads Order là nguồn của content_task ads được giao content này
    --     → để sync ads_status (syncAdsOrderFromTask). CHỈ ads_order, KHÔNG client order.
    OR (orders.order_kind = 'ads_order' AND EXISTS (
          SELECT 1 FROM public.content_tasks t
          WHERE t.order_id = orders.order_id AND t.source = 'ads_order'
            AND (t.assigned_pic_user_id = auth.uid()
                 OR t.created_by_user_id = auth.uid()
                 OR t.assigned_pic = (SELECT name FROM public.users WHERE id = auth.uid()))))
  )
);

-- ---------------------------------------------------------------------
-- 2. content_tasks — content chỉ đọc task được gán/mình tạo.
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "content_tasks content read" ON public.content_tasks;
DROP POLICY IF EXISTS "content_tasks content read assigned" ON public.content_tasks;

CREATE POLICY "content_tasks content read assigned" ON public.content_tasks
FOR SELECT USING (
  public.current_user_role() = 'content'
  AND (
    assigned_pic_user_id = auth.uid()
    OR created_by_user_id = auth.uid()
    OR assigned_pic = (SELECT name FROM public.users WHERE id = auth.uid())
  )
);

-- ---------------------------------------------------------------------
-- 3. content_tasks UPDATE — giữ khóa theo user_id (đã có từ add-pic-user-id.sql;
--    re-assert cho idempotent + đảm bảo không phải bản name cũ).
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "content_tasks content update_assigned" ON public.content_tasks;
CREATE POLICY "content_tasks content update_assigned" ON public.content_tasks
FOR UPDATE USING (
  public.current_user_role() = 'content'
  AND assigned_pic_user_id = auth.uid()
) WITH CHECK (
  public.current_user_role() = 'content'
  AND assigned_pic_user_id = auth.uid()
);

-- content INSERT own_initiative (add-content-self-initiative.sql) đã khóa
-- assigned_pic_user_id = auth.uid() — KHÔNG đụng ở đây.

-- ---------------------------------------------------------------------
-- 4. content_plans — content chỉ đọc plan có task con liên quan mình.
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "content_plans content read" ON public.content_plans;
DROP POLICY IF EXISTS "content_plans content read assigned" ON public.content_plans;

CREATE POLICY "content_plans content read assigned" ON public.content_plans
FOR SELECT USING (
  public.current_user_role() = 'content'
  AND EXISTS (
    SELECT 1 FROM public.content_tasks t
    WHERE t.content_plan_id = content_plans.id
      AND (t.assigned_pic_user_id = auth.uid()
           OR t.created_by_user_id = auth.uid()
           OR t.assigned_pic = (SELECT name FROM public.users WHERE id = auth.uid()))
  )
);

-- ---------------------------------------------------------------------
-- 5. RPC update_brief_wording — thêm guard cho role content (chỉ order được gán).
--    CREATE OR REPLACE full body (đồng bộ với add-content-team.sql B5).
-- ---------------------------------------------------------------------
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
    -- content CHỈ được update wording order ĐƯỢC GÁN cho mình (khóa user_id, fallback tên).
    IF r = 'content' THEN
      IF NOT (
        o.brief_wording_pic_user_id = auth.uid()
        OR o.brief_wording_pic = (SELECT name FROM public.users WHERE id = auth.uid())
      ) THEN
        RAISE EXCEPTION 'content user cannot update wording for unassigned order %', p_order_id;
      END IF;
    END IF;
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
      brief_wording_pic_user_id = CASE WHEN p_patch ? 'brief_wording_pic_user_id' THEN NULLIF(p_patch->>'brief_wording_pic_user_id','')::uuid ELSE brief_wording_pic_user_id END,
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

-- ---------------------------------------------------------------------
-- 6. Verify (chạy riêng để kiểm):
-- ---------------------------------------------------------------------
-- SELECT tablename, policyname, cmd FROM pg_policies
--   WHERE tablename IN ('orders','content_tasks','content_plans')
--     AND policyname ILIKE '%content%' ORDER BY tablename, policyname;
-- Test impersonation THẬT qua app: login content_a chỉ thấy order/task/plan
-- của mình; deep-link sang item của content_b bị chặn; update order của B → RPC ném exception.

SELECT 'fix-content-role-visibility.sql OK' AS result;
