-- =====================================================================
-- add-notify-roles-rpc.sql — RPC notify_roles: client bắn noti tới role nội bộ.
-- Idempotent. Chạy SAU: rls.sql + add-notifications.sql (+ add-notifications-rls.sql nếu có).
--
-- Bối cảnh (bug "client order nhưng admin/account không có noti"):
--   Các producer noti chạy trong PHIÊN CLIENT (order-form submit, rating, feedback,
--   approve preview/wording, ads order, brand-check) đều lookup:
--     from('users').select('id').in('role', ['admin','account',...])
--   Nhưng RLS bảng users chỉ cho client đọc CHÍNH MÌNH ("users self read";
--   "users staff read" cần is_staff()) → query trả [] IM LẶNG → 0 notification
--   được insert. Flow nội bộ (staff→staff) không dính vì staff đọc được users.
--
-- Fix: RPC SECURITY DEFINER — lookup user theo role bên trong function (bỏ qua RLS),
--   insert notifications hộ. Frontend đổi lookup+insert → supabase.rpc('notify_roles').
--   KHÔNG mở RLS users cho client (không lộ danh sách nhân sự).
--
-- Chống lạm dụng: chỉ authenticated + chỉ cho notify ROLE NỘI BỘ (client không thể
--   dùng RPC spam noti tới client khác); type phải nằm trong CHECK của notifications.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.notify_roles(
  p_roles        text[],
  p_type         text,
  p_title        text,
  p_message      text DEFAULT NULL,
  p_link         text DEFAULT NULL,
  p_entity_type  text DEFAULT NULL,
  p_entity_id    text DEFAULT NULL
) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_count integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'notify_roles: chưa đăng nhập';
  END IF;

  -- Chỉ role nội bộ — chặn client dùng RPC bắn noti tới client khác.
  IF p_roles IS NULL OR array_length(p_roles, 1) IS NULL THEN
    RAISE EXCEPTION 'notify_roles: thiếu danh sách role';
  END IF;
  IF EXISTS (
    SELECT 1 FROM unnest(p_roles) AS r
    WHERE r NOT IN ('admin','account','design','editor','lead_media',
                    'lead_content','content','system_supervisor')
  ) THEN
    RAISE EXCEPTION 'notify_roles: role không hợp lệ (chỉ role nội bộ)';
  END IF;

  INSERT INTO public.notifications
    (user_id, type, title, message, link, related_entity_type, related_entity_id)
  SELECT u.id, p_type, p_title, p_message, p_link, p_entity_type, p_entity_id
  FROM public.users u
  WHERE u.role = ANY (p_roles)
    AND u.status = 'active';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_roles(text[], text, text, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.notify_roles(text[], text, text, text, text, text, text) TO authenticated;

-- Verify:
-- SELECT public.notify_roles(ARRAY['admin'], 'system', 'Test RPC', 'notify_roles OK', NULL, NULL, NULL);
-- (chạy khi đang đăng nhập bằng user bất kỳ; admin sẽ thấy 1 noti "Test RPC")
