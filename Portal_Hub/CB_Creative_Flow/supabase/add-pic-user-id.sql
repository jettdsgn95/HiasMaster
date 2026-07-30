-- =====================================================================
-- add-pic-user-id.sql — Refactor PIC sang user_id (đồng bộ tên toàn hệ thống)
--                       (2026-07-20)
--
-- Bối cảnh: PIC lưu bằng CHUỖI TÊN ở mọi bảng → đổi tên tài khoản sinh:
--   (1) dropdown gộp tên cũ+mới, (2) RLS content_tasks khóa theo tên nên PIC
--   đổi tên mất quyền sửa task cũ, (3) hiển thị lệch.
--
-- Giải pháp: user_id là NGUỒN SỰ THẬT. Thêm cột `*_user_id uuid` song song
-- (GIỮ cột tên làm snapshot hiển thị/legacy/CSV). Frontend resolve id → tên
-- HIỆN TẠI khi hiển thị ⇒ đổi tên phản ánh tức thì, hết trùng cũ/mới.
--
-- File additive + idempotent — chạy lại nhiều lần OK. KHÔNG xóa cột tên.
-- Chạy SAU: schema.sql + rls.sql + add-content-team.sql + add-content-initiatives.sql
--           + add-content-self-initiative.sql + add-media-pics.sql + add-brief-wording-fields.sql.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Thêm cột *_user_id (uuid FK users.id). ON DELETE SET NULL: xóa user
--    không làm mất đơn/task, chỉ mất liên kết id (cột tên snapshot vẫn còn).
-- ---------------------------------------------------------------------
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS account_pic_user_id          uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS production_pic_user_id       uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS production_pic_video_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS production_pic_photo_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS brief_wording_pic_user_id    uuid REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS assigned_to_user_id    uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS account_pic_user_id    uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS production_pic_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE public.content_tasks
  ADD COLUMN IF NOT EXISTS assigned_pic_user_id   uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_by_user_id     uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS lead_approved_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orders_account_pic_uid  ON public.orders(account_pic_user_id);
CREATE INDEX IF NOT EXISTS idx_orders_prod_pic_uid     ON public.orders(production_pic_user_id);
CREATE INDEX IF NOT EXISTS idx_orders_bw_pic_uid       ON public.orders(brief_wording_pic_user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_uid      ON public.tasks(assigned_to_user_id);
CREATE INDEX IF NOT EXISTS idx_ctasks_assigned_uid     ON public.content_tasks(assigned_pic_user_id);

-- ---------------------------------------------------------------------
-- 2. BACKFILL id từ tên (query dọn 1 lần). Match TRIM+LOWER users.name.
--    Chỉ set khi id còn NULL (idempotent, không đè liên kết đã đúng).
-- ---------------------------------------------------------------------
DO $$
DECLARE
  m text[];   -- mỗi slice (SLICE 1 trên mảng 2 chiều) là 1 mảng text[] [table,name,id]
  pairs text[][] := ARRAY[
    ['orders','account_pic','account_pic_user_id'],
    ['orders','production_pic','production_pic_user_id'],
    ['orders','production_pic_video','production_pic_video_user_id'],
    ['orders','production_pic_photo','production_pic_photo_user_id'],
    ['orders','brief_wording_pic','brief_wording_pic_user_id'],
    ['tasks','assigned_to','assigned_to_user_id'],
    ['tasks','account_pic','account_pic_user_id'],
    ['tasks','production_pic','production_pic_user_id'],
    ['content_tasks','assigned_pic','assigned_pic_user_id'],
    ['content_tasks','created_by','created_by_user_id'],
    ['content_tasks','lead_approved_by','lead_approved_by_user_id']
  ];
BEGIN
  FOREACH m SLICE 1 IN ARRAY pairs LOOP
    -- m[1]=table, m[2]=name col, m[3]=id col. Guard cột tồn tại (cột tên do
    -- migration khác tạo — bỏ qua nếu chưa có để không chết script).
    IF to_regclass('public.' || m[1]) IS NULL THEN CONTINUE; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name=m[1] AND column_name=m[2]) THEN CONTINUE; END IF;
    EXECUTE format(
      'UPDATE public.%I t SET %I = u.id FROM public.users u
       WHERE t.%I IS NULL AND t.%I IS NOT NULL
         AND TRIM(LOWER(t.%I)) = TRIM(LOWER(u.name))',
      m[1], m[3], m[3], m[2], m[2]);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- 3. Đổi RLS content_tasks: khóa theo user_id thay vì tên (rename-proof).
--    Chạy SAU backfill để task cũ của content vẫn thuộc về họ (id đã điền).
--    Orders/Tasks KHÔNG cần đổi RLS (đã dùng is_staff(), không khóa theo tên).
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "content_tasks content update_assigned" ON public.content_tasks;
CREATE POLICY "content_tasks content update_assigned" ON public.content_tasks
  FOR UPDATE USING (
    public.current_user_role() = 'content'
    AND assigned_pic_user_id = auth.uid()
  ) WITH CHECK (
    public.current_user_role() = 'content'
    AND assigned_pic_user_id = auth.uid()
  );

DROP POLICY IF EXISTS "content_tasks content insert own_initiative" ON public.content_tasks;
CREATE POLICY "content_tasks content insert own_initiative" ON public.content_tasks
  FOR INSERT WITH CHECK (
    public.current_user_role() = 'content'
    AND source = 'content_initiated'
    AND assigned_pic_user_id = auth.uid()
  );

-- ---------------------------------------------------------------------
-- 4. BÁO CÁO ORPHAN — tên PIC không map được user nào (review + vá tay).
--    Chạy các SELECT này riêng để xem; không ảnh hưởng dữ liệu.
-- ---------------------------------------------------------------------
-- SELECT 'orders.account_pic' AS field, account_pic AS ten FROM public.orders
--   WHERE account_pic IS NOT NULL AND account_pic_user_id IS NULL
-- UNION ALL SELECT 'orders.production_pic', production_pic FROM public.orders
--   WHERE production_pic IS NOT NULL AND production_pic_user_id IS NULL
-- UNION ALL SELECT 'orders.brief_wording_pic', brief_wording_pic FROM public.orders
--   WHERE brief_wording_pic IS NOT NULL AND brief_wording_pic_user_id IS NULL
-- UNION ALL SELECT 'tasks.assigned_to', assigned_to FROM public.tasks
--   WHERE assigned_to IS NOT NULL AND assigned_to_user_id IS NULL
-- UNION ALL SELECT 'content_tasks.assigned_pic', assigned_pic FROM public.content_tasks
--   WHERE assigned_pic IS NOT NULL AND assigned_pic_user_id IS NULL;

-- Verify:
-- SELECT policyname, cmd FROM pg_policies WHERE tablename='content_tasks'
--   AND policyname LIKE 'content_tasks content%';
-- SELECT count(*) FILTER (WHERE assigned_pic_user_id IS NOT NULL) AS co_id,
--        count(*) FILTER (WHERE assigned_pic IS NOT NULL AND assigned_pic_user_id IS NULL) AS orphan
--   FROM public.content_tasks;

SELECT 'add-pic-user-id.sql OK' AS result;
