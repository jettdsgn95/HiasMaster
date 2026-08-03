-- =====================================================================
-- CB Media Hub — User Management: admin fields + status enforcement
-- Chạy 1 lần trên Supabase SQL Editor (idempotent).
--
-- Bối cảnh: User Management UI đã có tag / permission_group / data_scope /
-- allowed_departments / activity / work_stats nhưng public.users KHÔNG có cột
-- ⇒ Edit user chỉ sync được name/phone/department/role/status, phần còn lại
-- mất khi reload. File này bổ sung cột + siết quyền.
--
-- ┌────────────────────────────────────────────────────────────────────┐
-- │ TRẠNG THÁI ÁP DỤNG (2026-08-03)                                    │
-- │  ✅ Mục 1 (cột) + CHECK  — ĐÃ CHẠY trên production qua migration.   │
-- │  ⏳ Mục 2 + 3            — CHƯA CHẠY. Cần Admin mở Supabase SQL     │
-- │     Editor và chạy TAY phần từ "-- 2)" tới hết file.                │
-- │     (Công cụ tự động bị chặn tạo hàm SECURITY DEFINER.)             │
-- │  Chưa chạy mục 2+3 thì hệ thống VẪN an toàn nhờ 2 lớp khác:         │
-- │    · Edge Function admin-update-user BAN Auth user khi khoá         │
-- │      ⇒ token vô hiệu, không đăng nhập lại được.                     │
-- │    · supabase-client.js tự signOut khi profile.status != active.    │
-- │  Nhưng mục 3 mới bịt được lỗ "user tự UPDATE role của mình thành    │
-- │  admin" qua policy `users self update`. NÊN CHẠY SỚM.               │
-- └────────────────────────────────────────────────────────────────────┘
--
-- ⚠ ĐÃ KIỂM TRA TRƯỚC KHI VIẾT (không đoán):
--   · users_role_check   = admin|account|design|editor|client|content|
--                          lead_content|lead_media|system_supervisor
--   · users_status_check = active|inactive|pending|suspended|archived
--   → KHỚP đúng danh sách hệ thống đang dùng, KHÔNG cần sửa constraint.
--   · users.id FK → auth.users(id) ON DELETE CASCADE ⇒ profile BẮT BUỘC có
--     Auth user; xoá Auth user là xoá luôn profile (dùng cho rollback).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Cột quản trị mà UI User Management đang dùng
-- ---------------------------------------------------------------------
-- tag / permission_group / data_scope / allowed_departments = DỮ LIỆU QUẢN TRỊ
--   → cột thật, phải persist.
-- activity / work_stats = LOG + DERIVED.
--   → Phase 1 để jsonb ngay trên users cho kịp UAT.
--   → Phase 2 (TODO) nên tách: activity → bảng user_activity_logs;
--     work_stats → tính runtime từ orders/tasks/content_tasks, KHÔNG lưu.
alter table public.users
  add column if not exists tag                 text,
  add column if not exists permission_group    text,
  add column if not exists data_scope          text,
  add column if not exists allowed_departments jsonb not null default '[]'::jsonb,
  add column if not exists activity            jsonb not null default '[]'::jsonb,
  add column if not exists work_stats          jsonb not null default '{}'::jsonb,
  add column if not exists created_by          uuid;

comment on column public.users.activity   is 'Phase 1 audit log dạng jsonb. Phase 2: tách sang bảng user_activity_logs.';
comment on column public.users.work_stats is 'Phase 1 cache. Phase 2: derive từ orders/tasks/content_tasks, không lưu.';

-- CHECK cho permission_group / data_scope: chỉ thêm khi dữ liệu hiện tại sạch,
-- tránh migration fail giữa chừng (cả file chạy trong 1 transaction).
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'users_permission_group_check') then
    if not exists (
      select 1 from public.users
      where permission_group is not null
        and permission_group not in ('full','manager_view','order_mgmt','production_only',
                                     'delivery_only','report_viewer','client_only','ai_tools','custom')
    ) then
      alter table public.users add constraint users_permission_group_check
        check (permission_group is null or permission_group in
          ('full','manager_view','order_mgmt','production_only',
           'delivery_only','report_viewer','client_only','ai_tools','custom'));
    else
      raise notice 'SKIP users_permission_group_check — còn giá trị ngoài danh sách';
    end if;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'users_data_scope_check') then
    if not exists (
      select 1 from public.users
      where data_scope is not null
        and data_scope not in ('all','team','department','assigned','own','client_own','custom')
    ) then
      alter table public.users add constraint users_data_scope_check
        check (data_scope is null or data_scope in
          ('all','team','department','assigned','own','client_own','custom'));
    else
      raise notice 'SKIP users_data_scope_check — còn giá trị ngoài danh sách';
    end if;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 2) User KHÔNG active ⇒ mất mọi quyền ở tầng DB
-- ---------------------------------------------------------------------
-- Trước: current_user_role() trả role bất kể status ⇒ deactivate user chỉ đổi
-- cột status, nhưng session cũ vẫn còn token nên VẪN đọc/ghi được qua RLS
-- (is_staff()/is_admin()/is_admin_or_account() đều dựng trên hàm này).
-- Sau: status != 'active' → trả NULL ⇒ mọi policy dùng role đều KHỚP 0 DÒNG.
--
-- Cố ý KHÔNG đụng policy "users self read" (id = auth.uid()): user bị khoá vẫn
-- phải đọc được profile CHÍNH MÌNH thì app-level guard mới đọc được status để
-- logout + báo "Tài khoản đã ngưng hoạt động".
create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path to 'public'
as $$
  SELECT role FROM public.users WHERE id = auth.uid() AND status = 'active'
$$;

-- ---------------------------------------------------------------------
-- 3) Chặn tự nâng quyền (policy "users self update" quá rộng)
-- ---------------------------------------------------------------------
-- Policy hiện tại: UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid())
-- ⇒ user tự đổi role của mình thành 'admin' hoặc tự bật lại status='active'.
-- Không thu hẹp policy (sẽ vỡ trang Profile ở app.js) mà chặn theo CỘT bằng trigger.
create or replace function public.users_guard_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  -- service_role (Edge Function admin-*) và admin đang active được đổi tất cả.
  if current_user = 'service_role' or public.is_admin() then
    return new;
  end if;
  if new.role                is distinct from old.role
     or new.status           is distinct from old.status
     or new.email            is distinct from old.email
     or new.tag              is distinct from old.tag
     or new.permission_group is distinct from old.permission_group
     or new.data_scope       is distinct from old.data_scope
     or new.allowed_departments is distinct from old.allowed_departments then
    raise exception 'Chỉ Admin được đổi role/status/email/permission của user'
      using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists users_guard_privileged_columns_trg on public.users;
create trigger users_guard_privileged_columns_trg
  before update on public.users
  for each row execute function public.users_guard_privileged_columns();

-- ---------------------------------------------------------------------
-- 4) Verify
-- ---------------------------------------------------------------------
select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'users'
  and column_name in ('tag','permission_group','data_scope','allowed_departments',
                      'activity','work_stats','created_by')
order by column_name;
