-- =====================================================================
-- CB Media Hub — Clear mock orders/tasks/comments/deliveries
-- Run trong Supabase SQL Editor. Idempotent (chạy nhiều lần OK).
--
-- Mục tiêu: xóa SẠCH mock data từ seed.sql cũ + bất kỳ test data tích lũy
-- nào KHÔNG link với auth user thật. Giữ lại 100% data từ real client
-- submissions (qua Order Form, có requester_id linked với auth.users).
--
-- Filter chính:
--   - Mock: requester_id IS NULL (seed/test không có auth user link)
--   - Real: requester_id IS NOT NULL (đến từ client@cb.vn / client1-4@cb.vn submit)
-- =====================================================================

-- 1. Xác định mock orders trước khi xóa (audit log)
DO $$
DECLARE
  mock_count int;
  real_count int;
BEGIN
  SELECT COUNT(*) INTO mock_count FROM public.orders WHERE requester_id IS NULL;
  SELECT COUNT(*) INTO real_count FROM public.orders WHERE requester_id IS NOT NULL;
  RAISE NOTICE 'Mock orders sẽ xóa (requester_id IS NULL): %', mock_count;
  RAISE NOTICE 'Real orders sẽ GIỮ (requester_id IS NOT NULL): %', real_count;
END $$;

-- 2. Lưu danh sách mock order_id để cascade xóa task/comment/delivery
CREATE TEMP TABLE IF NOT EXISTS _mock_order_ids AS
  SELECT order_id FROM public.orders WHERE requester_id IS NULL;

-- 3. Xóa task_comments thuộc tasks gắn mock orders
DELETE FROM public.task_comments
WHERE task_id IN (
  SELECT task_id FROM public.tasks WHERE order_id IN (SELECT order_id FROM _mock_order_ids)
);

-- 4. Xóa deliveries gắn mock orders
DELETE FROM public.deliveries
WHERE order_id IN (SELECT order_id FROM _mock_order_ids);

-- 5. Xóa tasks gắn mock orders (linked tasks)
DELETE FROM public.tasks
WHERE order_id IN (SELECT order_id FROM _mock_order_ids);

-- 6. Xóa standalone tasks không có order_id (in-memory mock cũ)
-- LƯU Ý: Nếu anh muốn giữ standalone task nội bộ tạo từ Task Tracker thật → comment dòng này
DELETE FROM public.tasks
WHERE is_standalone = true AND order_id IS NULL;

-- 7. Xóa mock orders chính
DELETE FROM public.orders
WHERE requester_id IS NULL;

-- 8. Xóa activity log tạo từ mock entities (orphan)
DELETE FROM public.activity_log
WHERE entity_id IS NOT NULL
  AND entity_id NOT IN (SELECT order_id FROM public.orders)
  AND entity_id NOT IN (SELECT task_id FROM public.tasks);

-- 9. Xóa notifications tham chiếu mock orders/tasks (orphan)
DELETE FROM public.notifications
WHERE related_entity_type = 'orders'
  AND related_entity_id NOT IN (SELECT order_id FROM public.orders);

DELETE FROM public.notifications
WHERE related_entity_type = 'tasks'
  AND related_entity_id NOT IN (SELECT task_id FROM public.tasks);

-- 10. Verify sau khi xóa
DO $$
DECLARE
  remaining_orders int;
  remaining_tasks int;
  remaining_deliveries int;
BEGIN
  SELECT COUNT(*) INTO remaining_orders FROM public.orders;
  SELECT COUNT(*) INTO remaining_tasks FROM public.tasks;
  SELECT COUNT(*) INTO remaining_deliveries FROM public.deliveries;
  RAISE NOTICE '--- KẾT QUẢ SAU CLEAR ---';
  RAISE NOTICE 'Real orders còn lại: % (tất cả có requester_id link auth.users)', remaining_orders;
  RAISE NOTICE 'Tasks còn lại: %', remaining_tasks;
  RAISE NOTICE 'Deliveries còn lại: %', remaining_deliveries;
END $$;

DROP TABLE IF EXISTS _mock_order_ids;
