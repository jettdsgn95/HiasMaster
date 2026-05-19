-- =====================================================================
-- CB Media Hub — Row-Level Security policies (Phase 1 close)
--
-- ⚠️  CHỈ chạy sau khi:
--     1. schema.sql + seed.sql đã chạy xong
--     2. Frontend migration đã verify hoạt động đúng (login, orders, tasks,
--        deliveries, users, ai_tools, chatbot đều CRUD được)
--
-- File idempotent: có thể chạy lại nhiều lần (DROP + CREATE).
-- =====================================================================

-- =====================================================================
-- 1. Enable RLS trên tất cả bảng cần bảo vệ
-- =====================================================================
ALTER TABLE public.users            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_comments    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deliveries       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage_log     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_saved_outputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chatbot_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_log     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_drafts     ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- 2. Helper function: get current user role (cached per request)
--    Đặt SECURITY DEFINER + search_path để policy không bị recursion.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.users WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.current_user_role() IN ('admin','account','design','editor')
$$;

CREATE OR REPLACE FUNCTION public.is_admin_or_account()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.current_user_role() IN ('admin','account')
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.current_user_role() = 'admin'
$$;

-- =====================================================================
-- 3. DROP existing policies (idempotent re-run)
-- =====================================================================
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('users','orders','tasks','task_comments','deliveries',
                        'ai_usage_log','ai_saved_outputs','chatbot_messages',
                        'settings','activity_log','order_drafts')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
  END LOOP;
END $$;

-- =====================================================================
-- 4. USERS policies
--    - Bản thân user đọc/sửa profile chính mình
--    - Admin full quyền
--    - Staff (account/design/editor) đọc danh sách users (cần để hiển thị PIC select)
-- =====================================================================
CREATE POLICY "users self read"   ON public.users FOR SELECT USING (id = auth.uid());
CREATE POLICY "users self update" ON public.users FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "users staff read"  ON public.users FOR SELECT USING (public.is_staff());
CREATE POLICY "users admin all"   ON public.users FOR ALL    USING (public.is_admin()) WITH CHECK (public.is_admin());

-- =====================================================================
-- 5. ORDERS policies
--    - Client chỉ thấy order của mình (requester_id = auth.uid())
--    - Staff (admin/account/design/editor) đọc tất cả order
--    - Admin/Account ghi (insert/update/delete)
-- =====================================================================
CREATE POLICY "orders self read"     ON public.orders FOR SELECT USING (requester_id = auth.uid());
CREATE POLICY "orders staff read"    ON public.orders FOR SELECT USING (public.is_staff());
CREATE POLICY "orders self insert"   ON public.orders FOR INSERT WITH CHECK (requester_id = auth.uid() OR public.is_admin_or_account());
CREATE POLICY "orders staff write"   ON public.orders FOR UPDATE USING (public.is_admin_or_account()) WITH CHECK (public.is_admin_or_account());
CREATE POLICY "orders admin delete"  ON public.orders FOR DELETE USING (public.is_admin());

-- =====================================================================
-- 6. TASKS policies — internal only (Client KHÔNG được thấy task)
-- =====================================================================
CREATE POLICY "tasks staff read"  ON public.tasks FOR SELECT USING (public.is_staff());
CREATE POLICY "tasks staff write" ON public.tasks FOR ALL    USING (public.is_staff()) WITH CHECK (public.is_staff());

-- =====================================================================
-- 7. TASK_COMMENTS — same scope as tasks
-- =====================================================================
CREATE POLICY "task_comments staff read"   ON public.task_comments FOR SELECT USING (public.is_staff());
CREATE POLICY "task_comments staff insert" ON public.task_comments FOR INSERT WITH CHECK (public.is_staff() AND author_user_id = auth.uid());
CREATE POLICY "task_comments staff update" ON public.task_comments FOR UPDATE USING (public.is_staff()) WITH CHECK (public.is_staff());

-- =====================================================================
-- 8. DELIVERIES — admin/account only
-- =====================================================================
CREATE POLICY "deliveries account"      ON public.deliveries FOR ALL    USING (public.is_admin_or_account()) WITH CHECK (public.is_admin_or_account());
CREATE POLICY "deliveries client read"  ON public.deliveries FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.orders o WHERE o.order_id = deliveries.order_id AND o.requester_id = auth.uid())
);

-- =====================================================================
-- 9. AI USAGE — user self, admin all
-- =====================================================================
CREATE POLICY "ai_usage self read"   ON public.ai_usage_log FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "ai_usage self insert" ON public.ai_usage_log FOR INSERT WITH CHECK (user_id = auth.uid() OR user_id IS NULL);
CREATE POLICY "ai_usage admin all"   ON public.ai_usage_log FOR ALL    USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "ai_saved self"        ON public.ai_saved_outputs FOR ALL USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid() OR public.is_admin_or_account());
CREATE POLICY "ai_saved admin all"   ON public.ai_saved_outputs FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- =====================================================================
-- 10. CHATBOT — strict per-user privacy
-- =====================================================================
CREATE POLICY "chatbot self all" ON public.chatbot_messages FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- =====================================================================
-- 11. SETTINGS — admin only
-- =====================================================================
CREATE POLICY "settings staff read" ON public.settings FOR SELECT USING (public.is_staff());
CREATE POLICY "settings admin all"  ON public.settings FOR ALL    USING (public.is_admin()) WITH CHECK (public.is_admin());

-- =====================================================================
-- 12. ACTIVITY LOG — staff read, system write
-- =====================================================================
CREATE POLICY "activity staff read"  ON public.activity_log FOR SELECT USING (public.is_staff());
CREATE POLICY "activity self insert" ON public.activity_log FOR INSERT WITH CHECK (actor_user_id = auth.uid() OR public.is_staff());

-- =====================================================================
-- 13. ORDER DRAFTS — self only
-- =====================================================================
CREATE POLICY "order_drafts self" ON public.order_drafts FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- =====================================================================
-- 14. Verify (optional — chạy thủ công sau khi apply)
-- =====================================================================
-- SELECT tablename, policyname, cmd
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- ORDER BY tablename, cmd, policyname;

-- =====================================================================
-- End of rls.sql
-- =====================================================================
