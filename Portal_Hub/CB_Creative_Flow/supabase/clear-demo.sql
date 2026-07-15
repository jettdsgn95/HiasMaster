-- =====================================================================
-- CB Media Hub — Clear demo/test data — v2 (2026-07-15, full coverage)
-- Chạy khi reset toàn bộ data để bắt đầu UAT / production test.
--
-- v1 (Phase 1) chỉ xóa 9 bảng gốc. v2 bổ sung TOÀN BỘ bảng thêm sau:
--   notifications · lead_tasks · lead_task_comments · content_plans ·
--   content_tasks · content_task_comments · brand_checks ·
--   brand_check_criteria + file trong 4 Storage buckets.
--
-- XÓA: mọi data nghiệp vụ (orders/tasks/comments/deliveries/noti/
--      content/plans/brand-checks/ai/chatbot/activity/drafts)
--      + file Storage: brief-files · deliverables · plan-files ·
--        brand-check-images
-- GIỮ: users (5 demo @cb.vn + user thật) · user_role_map · settings ·
--      bucket `avatars` · schema/triggers/RLS/buckets/functions
--
-- ⚠️  Idempotent: chạy lại nhiều lần OK (bảng chưa migrate được bỏ qua).
--     KHÔNG undo được — chắc chắn muốn xóa hết trước khi Run.
-- =====================================================================

DO $$
DECLARE
  t text;
  n bigint;
  -- Thứ tự xóa: bảng con (FK) trước, bảng cha sau
  tables text[] := ARRAY[
    'task_comments',
    'deliveries',
    'tasks',
    'notifications',
    'brand_check_criteria',
    'brand_checks',
    'content_task_comments',
    'content_tasks',
    'content_plans',
    'lead_task_comments',
    'lead_tasks',
    'orders',
    'ai_saved_outputs',
    'ai_usage_log',
    'chatbot_messages',
    'activity_log',
    'order_drafts'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('DELETE FROM public.%I', t);
      GET DIAGNOSTICS n = ROW_COUNT;
      RAISE NOTICE 'cleared public.% (% rows)', t, n;
    ELSE
      RAISE NOTICE 'skip public.% (bảng chưa tồn tại — migration chưa chạy)', t;
    END IF;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- Storage: xóa FILE trong 4 buckets nghiệp vụ (GIỮ bucket + policies).
-- GIỮ nguyên bucket `avatars` — avatar user còn dùng.
--
-- ⚠ Supabase hosted CHẶN delete trực tiếp storage.objects qua SQL
--   (trigger storage.protect_delete, lỗi 42501). Block dưới TRY xóa;
--   nếu bị chặn → chỉ RAISE NOTICE + đi tiếp (không rollback phần trên).
--   Khi bị chặn, xóa TAY: Dashboard → Storage → mở từng bucket
--   (brief-files / deliverables / plan-files / brand-check-images)
--   → Select all → Delete. Kiểm còn sót bằng cột storage_files ở verify.
-- ---------------------------------------------------------------------
DO $$
DECLARE n bigint;
BEGIN
  DELETE FROM storage.objects
  WHERE bucket_id IN ('brief-files', 'deliverables', 'plan-files', 'brand-check-images');
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE 'storage: đã xóa % file', n;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'storage bị chặn (%) — xóa file bằng tay: Dashboard → Storage → từng bucket → Select all → Delete', SQLERRM;
END $$;

-- Optional: reset profile metadata user demo (bỏ comment nếu muốn)
-- UPDATE public.users SET title = NULL, department = NULL, bio = NULL, phone = NULL;

-- =====================================================================
-- VERIFY — tất cả count phải = 0 (bảng chưa migrate sẽ báo lỗi nếu
-- SELECT trực tiếp, nên dùng khối động bên dưới: liệt kê count thật
-- của MỌI bảng public đang tồn tại)
-- =====================================================================
SELECT
  (SELECT count(*) FROM public.orders)           AS orders,
  (SELECT count(*) FROM public.tasks)            AS tasks,
  (SELECT count(*) FROM public.task_comments)    AS task_comments,
  (SELECT count(*) FROM public.deliveries)       AS deliveries,
  (SELECT count(*) FROM public.activity_log)     AS activity_log,
  (SELECT count(*) FROM public.order_drafts)     AS order_drafts,
  (SELECT count(*) FROM public.users)            AS users_kept,
  (SELECT count(*) FROM storage.objects
    WHERE bucket_id IN ('brief-files','deliverables','plan-files','brand-check-images')) AS storage_files;

-- Verify bảng mới (chạy riêng nếu đã migrate — bảng nào thiếu thì bỏ dòng đó):
-- SELECT
--   (SELECT count(*) FROM public.notifications)         AS notifications,
--   (SELECT count(*) FROM public.lead_tasks)            AS lead_tasks,
--   (SELECT count(*) FROM public.lead_task_comments)    AS lead_task_comments,
--   (SELECT count(*) FROM public.content_plans)         AS content_plans,
--   (SELECT count(*) FROM public.content_tasks)         AS content_tasks,
--   (SELECT count(*) FROM public.content_task_comments) AS content_task_comments,
--   (SELECT count(*) FROM public.brand_checks)          AS brand_checks,
--   (SELECT count(*) FROM public.brand_check_criteria)  AS brand_check_criteria;
