-- add-notifications-rls.sql — Bật RLS cho bảng notifications (vá lỗ hổng: bảng đang mở).
-- Idempotent. Chạy SAU: add-notifications.sql.
--
-- Bối cảnh: add-notifications.sql tạo bảng nhưng KHÔNG bật RLS → mọi user đăng nhập
--   (kể cả client) có thể đọc/ghi thông báo của người khác. File này bật RLS + policy:
--     • SELECT / UPDATE / DELETE: CHỈ thông báo của chính mình (user_id = auth.uid()).
--     • INSERT: mọi user đã đăng nhập được tạo noti cho NGƯỜI KHÁC — BẮT BUỘC giữ để
--       cross-user notify chạy (order→admin/account, ads→lead_content, content→PIC, delivery→client…).
--   service_role (server) luôn bỏ qua RLS. Realtime tôn trọng RLS → mỗi user chỉ nhận noti của mình.
--
-- ⚠ Nếu chỉ ENABLE RLS mà KHÔNG có policy → bảng bị khoá sạch → chuông trống + không insert được.
--   File này đã kèm đủ policy nên bật xong tính năng thông báo vẫn chạy bình thường.

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Đọc: chỉ noti của mình.
DROP POLICY IF EXISTS "notifications select own" ON public.notifications;
CREATE POLICY "notifications select own" ON public.notifications
  FOR SELECT USING (user_id = auth.uid());

-- Tạo: user đã đăng nhập được tạo noti cho bất kỳ ai (giữ cross-user notify).
DROP POLICY IF EXISTS "notifications insert authed" ON public.notifications;
CREATE POLICY "notifications insert authed" ON public.notifications
  FOR INSERT TO authenticated WITH CHECK (true);

-- Cập nhật (đánh dấu đã đọc): chỉ noti của mình.
DROP POLICY IF EXISTS "notifications update own" ON public.notifications;
CREATE POLICY "notifications update own" ON public.notifications
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Xoá: chỉ noti của mình.
DROP POLICY IF EXISTS "notifications delete own" ON public.notifications;
CREATE POLICY "notifications delete own" ON public.notifications
  FOR DELETE USING (user_id = auth.uid());

-- Verify:
-- SELECT relrowsecurity FROM pg_class WHERE relname='notifications';   -- true
-- SELECT policyname, cmd FROM pg_policies WHERE tablename='notifications' ORDER BY policyname;
