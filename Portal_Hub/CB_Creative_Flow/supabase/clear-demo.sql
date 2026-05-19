-- =====================================================================
-- CB Media Hub — Clear demo/seed data (Phase 1 → production-ready)
-- Chạy KHI anh sẵn sàng test flow thật với client account.
-- File này XÓA toàn bộ dữ liệu demo nhưng GIỮ:
--   - 5 auth users (admin/account/design/editor/client) + public.users metadata
--   - Schema, triggers, helper functions, storage buckets
--
-- ⚠️  Idempotent: chạy lại nhiều lần OK. Nhưng KHÔNG undo được — anh chắc chắn
--     muốn xóa hết orders/tasks/deliveries demo trước khi run.
-- =====================================================================

-- Order matters: comments → tasks → deliveries → orders → ai/chatbot/activity → drafts
DELETE FROM public.task_comments;
DELETE FROM public.deliveries;
DELETE FROM public.tasks;
DELETE FROM public.orders;
DELETE FROM public.ai_saved_outputs;
DELETE FROM public.ai_usage_log;
DELETE FROM public.chatbot_messages;
DELETE FROM public.activity_log;
DELETE FROM public.order_drafts;

-- Optional: reset user metadata về null (nếu anh muốn user tự fill profile lại)
-- UPDATE public.users SET title = NULL, department = NULL, bio = NULL, phone = NULL, avatar_url = NULL;

-- Verify counts
SELECT
  (SELECT count(*) FROM public.orders)         AS orders_count,
  (SELECT count(*) FROM public.tasks)          AS tasks_count,
  (SELECT count(*) FROM public.task_comments)  AS comments_count,
  (SELECT count(*) FROM public.deliveries)     AS deliveries_count,
  (SELECT count(*) FROM public.ai_usage_log)   AS ai_usage_count,
  (SELECT count(*) FROM public.chatbot_messages) AS chatbot_count,
  (SELECT count(*) FROM public.users)          AS users_count;
