-- add-media-lead-production.sql — Media Lead (lead_media) = quyền vận hành Production NGANG Account.
-- Idempotent. Chạy SAU: rls.sql + add-supervisor-planning.sql.
--
-- Mục đích: mở quyền cho role `lead_media` truy cập & quản lý Production (Client Orders,
-- Internal Task Tracker, Dashboards, Reports) ở mức Account.
--   • Thêm lead_media vào is_staff()           → SELECT orders/tasks/task_comments/deliveries
--                                                 + ghi tasks/comments (staff write).
--   • Thêm lead_media vào is_admin_or_account() → quản lý orders (push/confirm/gán PIC/hủy).
--   • KHÔNG đụng is_admin()  → Settings / User Management vẫn chỉ admin.
--   • KHÔNG cấp quyền Content Team (orders content/wording dùng policy + RPC riêng;
--     trang content-team / content-workbench gate bằng JS — lead_media không có trong allow-list).
--
-- Lưu ý: chỉ CREATE OR REPLACE 2 helper — mọi RLS policy đang dùng is_staff()/is_admin_or_account()
-- tự động áp dụng cho lead_media, không cần sửa policy.

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.current_user_role() IN ('admin','account','design','editor','lead_media')
$$;

CREATE OR REPLACE FUNCTION public.is_admin_or_account()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.current_user_role() IN ('admin','account','lead_media')
$$;

-- Verify (tùy chọn):
-- SELECT proname, pg_get_functiondef(oid) FROM pg_proc
--   WHERE proname IN ('is_staff','is_admin_or_account') AND pronamespace = 'public'::regnamespace;
