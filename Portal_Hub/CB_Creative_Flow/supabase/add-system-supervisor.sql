-- add-system-supervisor.sql — Role `system_supervisor` (Giám sát hệ thống).
-- Idempotent. Chạy trong Supabase SQL Editor SAU: rls.sql + add-content-team.sql
-- (cần helper current_user_role() + constraint users_role_check mới nhất).
--
-- Mục đích: role GIÁM SÁT chỉ-đọc cấp hệ thống. Xem TOÀN BỘ data vận hành
-- (orders / tasks / task_comments / users / deliveries / activity_log) nhưng
-- KHÔNG được mutate workflow. Frontend đã khóa UI (read-only); đây là lớp DB.
--
-- ⚠ KHÔNG thêm system_supervisor vào is_staff() — vì is_staff() còn gate cả
--   INSERT/UPDATE (tasks staff write, task_comments insert…). Supervisor chỉ
--   được SELECT → dùng helper riêng is_system_supervisor() cho từng policy đọc.

-- =====================================================================
-- B1. Role 'system_supervisor' vào users_role_check (giữ đủ 7 role cũ).
-- =====================================================================
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users ADD CONSTRAINT users_role_check
  CHECK (role IN ('admin','account','design','editor','client',
                  'content','lead_content','system_supervisor'));

-- =====================================================================
-- B2. Helper: is_system_supervisor() (SECURITY DEFINER, tránh recursion RLS).
-- =====================================================================
CREATE OR REPLACE FUNCTION public.is_system_supervisor()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.current_user_role() = 'system_supervisor'
$$;

-- =====================================================================
-- B3. SELECT-only policies cho supervisor.
--     CHỈ FOR SELECT — KHÔNG có INSERT/UPDATE/DELETE.
--     (Cập nhật hồ sơ cá nhân vẫn đi qua "users self update" sẵn có,
--      USING id = auth.uid() — đúng 1 dòng của chính mình.)
-- =====================================================================
DROP POLICY IF EXISTS "orders supervisor read"        ON public.orders;
CREATE POLICY "orders supervisor read"        ON public.orders        FOR SELECT USING (public.is_system_supervisor());

DROP POLICY IF EXISTS "tasks supervisor read"         ON public.tasks;
CREATE POLICY "tasks supervisor read"         ON public.tasks         FOR SELECT USING (public.is_system_supervisor());

DROP POLICY IF EXISTS "task_comments supervisor read" ON public.task_comments;
CREATE POLICY "task_comments supervisor read" ON public.task_comments FOR SELECT USING (public.is_system_supervisor());

DROP POLICY IF EXISTS "users supervisor read"         ON public.users;
CREATE POLICY "users supervisor read"         ON public.users         FOR SELECT USING (public.is_system_supervisor());

DROP POLICY IF EXISTS "deliveries supervisor read"    ON public.deliveries;
CREATE POLICY "deliveries supervisor read"    ON public.deliveries    FOR SELECT USING (public.is_system_supervisor());

DROP POLICY IF EXISTS "activity supervisor read"      ON public.activity_log;
CREATE POLICY "activity supervisor read"      ON public.activity_log  FOR SELECT USING (public.is_system_supervisor());

-- =====================================================================
-- B4. (Tùy chọn) tạo user supervisor.
--   Supabase Auth → Add user + metadata {name, role:'system_supervisor'} + password.
--   Trigger handle_new_auth_user tự insert public.users row (cần B1 trước).
-- =====================================================================

-- Verify (tùy chọn):
-- SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'users_role_check';
-- SELECT tablename, policyname, cmd FROM pg_policies
--   WHERE policyname LIKE '%supervisor%' ORDER BY tablename;
