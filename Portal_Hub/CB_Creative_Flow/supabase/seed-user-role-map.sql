-- =====================================================================
-- seed-user-role-map.sql — Roster nhân sự UAT (Google SSO @cbcentres.com)
-- Chạy SAU add-google-sso-cbcentres.sql (bảng user_role_map + trigger đã có).
-- Idempotent: chạy lại OK (upsert).
--
-- ⚠ ĐIỀN EMAIL CÔNG TY THẬT trước khi Run. Quy tắc:
--   • email — đúng email Google Workspace từng người (lower-case).
--   • role  — 1 trong: admin · account · lead_media · design · editor ·
--             lead_content · content · system_supervisor · client
--   • name  — TÊN HIỂN THỊ, phải KHỚP TUYỆT ĐỐI chuỗi dùng khi gán PIC
--             (data keyed theo TÊN — lệch dấu/khoảng trắng là "task của tôi"
--             không match). Thống nhất tên TRƯỚC khi seed.
--   • Email KHÔNG có trong map → SSO vào sẽ mặc định role 'client'.
--   • Client/giáo viên test KHÔNG cần seed (client là default đúng).
--
-- Sau khi seed: mỗi nhân sự SSO 1 lần (nút "Đăng nhập với Gmail công ty")
-- để trigger handle_new_auth_user tạo row public.users đúng role/name.
-- =====================================================================

INSERT INTO public.user_role_map (email, role, name) VALUES
  -- ===== ĐIỀN THẬT — mỗi dòng 1 nhân sự =====
  ('thay-email@cbcentres.com',  'admin',             'Tên Admin'),
  ('thay-email2@cbcentres.com', 'account',           'Tên Account'),
  ('thay-email3@cbcentres.com', 'lead_media',        'Tên Lead Media'),
  ('thay-email4@cbcentres.com', 'design',            'Tên Designer'),
  ('thay-email5@cbcentres.com', 'editor',            'Tên Editor'),
  ('thay-email6@cbcentres.com', 'lead_content',      'Tên Lead Content'),
  ('thay-email7@cbcentres.com', 'content',           'Tên Content'),
  ('thay-email8@cbcentres.com', 'system_supervisor', 'Tên Giám sát')
ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name;

-- =====================================================================
-- SYNC — sửa role/name cho user ĐÃ lỡ SSO TRƯỚC khi seed map.
-- (Trigger chỉ chạy lúc tạo user lần đầu; ai vào trước khi map có dòng
--  của họ sẽ bị gán 'client'. Block này đồng bộ lại theo map.)
-- =====================================================================
UPDATE public.users u
SET role = m.role,
    name = COALESCE(m.name, u.name)
FROM public.user_role_map m
WHERE lower(u.email) = lower(m.email)
  AND (u.role IS DISTINCT FROM m.role OR (m.name IS NOT NULL AND u.name IS DISTINCT FROM m.name));

-- Verify:
SELECT m.email, m.role, m.name,
       CASE WHEN u.id IS NULL THEN 'CHƯA SSO lần nào' ELSE 'đã có user' END AS trang_thai,
       u.role AS role_thuc_te
FROM public.user_role_map m
LEFT JOIN public.users u ON lower(u.email) = lower(m.email)
ORDER BY m.role, m.email;
