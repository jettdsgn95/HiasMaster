-- =====================================================================
-- add-security-hardening.sql — VÁ CẢNH BÁO BẢO MẬT (Supabase Advisors)
-- (2026-07-31)
--
-- Nguồn: `get_advisors(type=security)` chạy trên DB production qua Supabase MCP.
-- File này ghi lại ĐÚNG những gì đã áp dụng lên production ngày 2026-07-31
-- (đã chạy qua MCP `apply_migration`, giữ file để tái lập môi trường khác).
--
-- ĐÃ XỬ LÝ ở file này:
--   1. 2 ERROR  security_definer_view      → security_invoker = on
--   2. 1 WARN   rls_policy_always_true     → siết INSERT notifications
--   3. WARN     anon execute SECURITY DEFINER → revoke có chọn lọc
--
-- CHƯA xử lý (đợt sau, xem cuối file): function_search_path_mutable ×10 ·
--   public_bucket_allows_listing (avatars) · leaked password protection.
--
-- Idempotent. Chạy sau `rls.sql` + `add-notify-roles-rpc.sql`.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. VIEW: security_definer → security_invoker  (advisor 0010, level ERROR)
--    View SECURITY DEFINER chạy quyền NGƯỜI TẠO ⇒ KHÔNG áp RLS của người
--    query ⇒ bất kỳ ai gọi qua PostgREST đều đọc được toàn bộ orders/tasks.
--    Đã kiểm: frontend KHÔNG dùng 2 view này (grep .js/.html = 0 hit) nên
--    đổi cờ không phá gì. security_invoker cần PG15+ (DB đang PG17).
-- ---------------------------------------------------------------------
ALTER VIEW public.tasks_with_order        SET (security_invoker = on);
ALTER VIEW public.orders_with_task_count  SET (security_invoker = on);

-- ---------------------------------------------------------------------
-- 2. notifications: INSERT chỉ cho ROLE NỘI BỘ  (advisor 0024, level WARN)
--    Policy cũ `WITH CHECK (true)` ⇒ BẤT KỲ user đăng nhập nào (kể cả client)
--    cũng insert được noti cho bất kỳ ai, giả danh hệ thống.
--    Client KHÔNG mất chức năng: mọi noti client→staff đi qua RPC notify_roles
--    (SECURITY DEFINER → chạy quyền owner nên không bị policy này chặn).
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "notifications insert authed" ON public.notifications;
DROP POLICY IF EXISTS "notifications insert internal" ON public.notifications;
CREATE POLICY "notifications insert internal" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (
    public.current_user_role() IN (
      'admin','account','design','editor','lead_media','lead_content','content','system_supervisor'
    )
  );

-- ---------------------------------------------------------------------
-- 3. EXECUTE trên SECURITY DEFINER function  (advisor 0028/0029, WARN)
--
--    ⚠⚠ KHÔNG revoke 5 HELPER dùng TRONG RLS POLICY:
--        current_user_role() · is_staff() · is_admin() · is_admin_or_account()
--        · is_system_supervisor()
--
--    ĐÍNH CHÍNH 2026-07-31: bản đầu file này ghi lý do là "tracking.html tra cứu
--    công khai khi chưa đăng nhập". SAI — `tracking.html` (dòng ~470) CHẶN TRƯỚC:
--    chưa login thì hiện requireLoginModal(), KHÔNG hề query Supabase. Đã kiểm lại
--    toàn bộ trang public: chỉ `login.html` + `tracking.html` chạm MH.store, và cả
--    hai đều query SAU khi có session ⇒ hiện KHÔNG có đường query bảng nào ở
--    trạng thái anon.
--
--    Lý do GIỮ (đúng): (a) biểu thức RLS policy chạy với quyền NGƯỜI ĐANG QUERY —
--    revoke khỏi anon thì BẤT KỲ query anon nào chạm bảng có policy gọi helper sẽ
--    lỗi cứng "permission denied for function" (HTTP 500) thay vì trả rỗng; rủi ro
--    này áp cho mọi path phát sinh sau này (Realtime, trang public mới, settings…).
--    (b) Lợi ích gần bằng 0: với anon, current_user_role() trả NULL và is_*() trả
--    false ⇒ KHÔNG lộ thông tin gì. Đổi lại chỉ để tắt 5 dòng WARN.
--    ⇒ Quyết định: chấp nhận 5 WARN, giữ EXECUTE cho anon.
--    Bằng chứng revoke hiện tại KHÔNG phá gì: gọi REST bằng anon key
--    `GET /rest/v1/orders?order_id=eq.MEDIA-2026-7819` → HTTP 200 `[]`
--    (RLS lọc sạch, KHÔNG phải lỗi quyền).
--
--    ⚠ Lưu ý kỹ thuật: `REVOKE ... FROM anon` KHÔNG có tác dụng nếu quyền được
--    cấp qua PUBLIC (mọi role thừa hưởng). Phải REVOKE FROM PUBLIC rồi GRANT lại
--    cho đúng role — đã vấp đúng bẫy này khi làm.
-- ---------------------------------------------------------------------
-- 3a. RPC nghiệp vụ: chỉ authenticated (đều tự guard auth.uid() bên trong).
REVOKE EXECUTE ON FUNCTION public.update_brief_wording(text, jsonb) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.update_brief_wording(text, jsonb) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.notify_roles(text[], text, text, text, text, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.respond_deadline_proposal(text, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.append_lead_content_order_note(text, text) FROM anon;

-- 3b. Trigger function: KHÔNG ai gọi trực tiếp qua RPC. Trigger vẫn chạy bình
--     thường sau khi revoke (EXECUTE được kiểm lúc CREATE TRIGGER, không phải
--     lúc trigger fire).
REVOKE EXECUTE ON FUNCTION public.handle_new_auth_user() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.sync_order_production_status() FROM PUBLIC, anon;

-- ---------------------------------------------------------------------
-- Verify:
-- SELECT c.relname, c.reloptions FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
--  WHERE n.nspname='public' AND c.relname IN ('tasks_with_order','orders_with_task_count');
-- SELECT policyname, with_check FROM pg_policies
--  WHERE schemaname='public' AND tablename='notifications' AND cmd='INSERT';
-- SELECT p.proname,
--        has_function_privilege('anon', p.oid, 'EXECUTE')          AS anon,
--        has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authed
--   FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
--  WHERE n.nspname='public' ORDER BY 1;
--
-- CÒN TREO (đợt sau — chưa làm):
--   · function_search_path_mutable ×10: ALTER FUNCTION … SET search_path = public
--     (touch_updated_at, touch_last_updated, touch_last_update, touch_notif_read_at,
--      touch_lead_task_updated_at, touch_brand_check_updated_at, set_brand_check_code,
--      set_content_task_code, task_status_rank, task_to_order_status)
--   · public_bucket_allows_listing: policy `cbmh_avatars_public_read` cho phép LIST
--     toàn bộ file bucket avatars — cần kiểm frontend có gọi storage.list('avatars')
--     trước khi thu hẹp.
--   · Leaked password protection: bật ở Dashboard → Authentication (không có API).
-- =====================================================================
