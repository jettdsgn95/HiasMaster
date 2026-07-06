-- add-lead-content-order-view.sql — Lead Content theo dõi Order Drawer (read-only)
-- + comment nội bộ. Idempotent. Chạy SAU rls.sql + add-content-team.sql.
--
-- Bối cảnh: lead_content đã có SELECT orders/users (add-content-team.sql) nên
-- ĐỌC danh sách + drawer không cần policy mới. File này chỉ thêm kênh COMMENT:
--
--   • Cột `orders.lead_content_notes` — thread comment nội bộ của Lead Content,
--     TÁCH khỏi `internal_note` (internal_note bị Client Portal hiển thị khi
--     account_status='needinfo' → không được ghi comment lead vào đó).
--     Client Portal KHÔNG đọc cột này → comment thuần nội bộ.
--
--   • RPC `append_lead_content_order_note` (SECURITY DEFINER) — đường ghi DUY NHẤT
--     của lead_content vào orders cho tính năng này: chỉ APPEND text kèm dấu
--     [thời gian · tên · Lead Content], không đụng bất kỳ cột nghiệp vụ nào
--     (account_status/production_status/PIC/deadline/links... đều ngoài tầm với).

-- =====================================================================
-- B1. Cột thread comment.
-- =====================================================================
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS lead_content_notes text;

-- =====================================================================
-- B2. RPC append comment (không cho lead_content UPDATE orders trực tiếp).
-- =====================================================================
CREATE OR REPLACE FUNCTION public.append_lead_content_order_note(p_order_id text, p_text text)
RETURNS public.orders
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r        text := public.current_user_role();
  v_name   text;
  v_text   text := trim(coalesce(p_text, ''));
  out_row  public.orders;
BEGIN
  -- Chỉ Lead Content (+ admin hỗ trợ/test). Account/Media dùng ô ghi chú thường.
  IF r NOT IN ('lead_content', 'admin') THEN
    RAISE EXCEPTION 'role % không được comment kênh Lead Content', r;
  END IF;
  IF v_text = '' THEN RAISE EXCEPTION 'comment rỗng'; END IF;
  IF length(v_text) > 2000 THEN RAISE EXCEPTION 'comment quá dài (tối đa 2000 ký tự)'; END IF;

  SELECT name INTO v_name FROM public.users WHERE id = auth.uid();

  UPDATE public.orders SET
    lead_content_notes = coalesce(lead_content_notes || E'\n\n', '')
      || '[' || to_char(now() AT TIME ZONE 'Asia/Ho_Chi_Minh', 'DD/MM/YYYY HH24:MI')
      || ' · ' || coalesce(v_name, 'Lead Content')
      || ' · Lead Content] ' || v_text,
    last_updated = now()
  WHERE order_id = p_order_id
  RETURNING * INTO out_row;

  IF NOT FOUND THEN RAISE EXCEPTION 'order % not found', p_order_id; END IF;
  RETURN out_row;
END;
$$;

REVOKE ALL ON FUNCTION public.append_lead_content_order_note(text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.append_lead_content_order_note(text, text) TO authenticated;

-- Verify (tùy chọn):
-- SELECT proname, prosecdef FROM pg_proc WHERE proname = 'append_lead_content_order_note';
-- SELECT column_name FROM information_schema.columns WHERE table_name='orders' AND column_name='lead_content_notes';
