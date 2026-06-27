-- add-google-sso-cbcentres.sql — Chuyển đăng nhập sang Google Workspace SSO (@cbcentres.com)
-- Idempotent. Chạy SAU: schema.sql (có trigger handle_new_auth_user) + rls.sql + add-content-team/role.
--
-- Bối cảnh: team chuyển từ account demo (@cb.vn, email+mật khẩu) sang đăng nhập Google công ty
--   (@cbcentres.com). Google KHÔNG gửi metadata role → user SSO mới mặc định 'client' (SAI).
--   File này thêm bảng map role theo EMAIL + nâng trigger để gán đúng role/name khi provision.
--
-- ⚠ NGOÀI SQL còn phải: bật Google provider (Supabase Auth → Providers) + tạo OAuth Client
--   (Google Cloud Console, redirect URI https://lmfdicjjyrmbleyqemul.supabase.co/auth/v1/callback).

-- =====================================================================
-- 1. Bảng map role theo email công ty (nguồn gán role/name khi user SSO lần đầu)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.user_role_map (
  email      text PRIMARY KEY,
  role       text NOT NULL,
  name       text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS: chỉ admin xem/sửa (trigger dùng SECURITY DEFINER nên KHÔNG bị RLS chặn lúc provision).
ALTER TABLE public.user_role_map ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_role_map admin all" ON public.user_role_map;
CREATE POLICY "user_role_map admin all" ON public.user_role_map
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ---------------------------------------------------------------------
-- SEED — ⚠ ĐỔI cho đúng email công ty THẬT + role + TÊN.
--   • email: phải khớp email Google Workspace mỗi người.
--   • name : phải khớp TUYỆT ĐỐI chuỗi đang dùng ở orders.production_pic / account_pic /
--            content_tasks.assigned_pic (nếu lệch, "task của tôi" của họ không match).
--   Lấy danh sách tên hiện có để copy:
--     SELECT email, role, name FROM public.users ORDER BY role;
--     SELECT DISTINCT production_pic FROM public.orders WHERE production_pic IS NOT NULL;
--     SELECT DISTINCT assigned_pic   FROM public.content_tasks WHERE assigned_pic IS NOT NULL;
-- ---------------------------------------------------------------------
INSERT INTO public.user_role_map (email, role, name) VALUES
  ('admin@cbcentres.com',   'admin',             'Mai Phương'),
  ('account@cbcentres.com', 'account',           'Hậu Nguyễn'),
  ('design@cbcentres.com',  'design',            'Duy Trần'),
  ('editor@cbcentres.com',  'editor',            'Linh Chi')
  -- ('leadmedia@cbcentres.com',   'lead_media',        'Tên Lead Media'),
  -- ('leadcontent@cbcentres.com', 'lead_content',      'Tên Lead Content'),
  -- ('content1@cbcentres.com',    'content',           'Phương Linh'),
  -- ('supervisor@cbcentres.com',  'system_supervisor', 'Tên Supervisor'),
  -- client KHÔNG cần seed (mặc định role 'client' là đúng cho khách)
ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name;

-- =====================================================================
-- 2. Nâng trigger provision: gán role/name theo user_role_map khi metadata thiếu
--    (Google OAuth không gửi role → tra email trong map; fallback 'client').
-- =====================================================================
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_role text;
  v_name text;
BEGIN
  SELECT role, name INTO v_role, v_name
    FROM public.user_role_map WHERE lower(email) = lower(NEW.email) LIMIT 1;

  INSERT INTO public.users (id, email, name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', v_name, split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', v_role, 'client')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Trigger đã tồn tại (schema.sql) — chỉ refresh function là đủ. Tạo lại cho chắc nếu chạy độc lập.
DROP TRIGGER IF EXISTS trg_on_auth_user_created ON auth.users;
CREATE TRIGGER trg_on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- =====================================================================
-- 3. (TÙY CHỌN) Đổi email-based reference cũ @cb.vn → @cbcentres.com (cosmetic).
--    Bỏ comment nếu muốn. Assignment theo TÊN không cần đổi.
-- =====================================================================
-- UPDATE public.orders
--   SET requester_email = replace(requester_email, '@cb.vn', '@cbcentres.com')
--   WHERE requester_email LIKE '%@cb.vn';

-- =====================================================================
-- 4. (TÙY CHỌN — sau khi xác nhận team SSO OK) dọn account demo @cb.vn.
--    KHÔNG tự chạy. Xóa auth user trong Supabase Auth dashboard; public.users dọn kèm:
-- DELETE FROM public.users WHERE email LIKE '%@cb.vn' AND id NOT IN (SELECT id FROM auth.users);
-- =====================================================================

-- Verify:
-- SELECT * FROM public.user_role_map;
-- SELECT id,email,role,name FROM public.users WHERE email LIKE '%@cbcentres.com' ORDER BY role;
