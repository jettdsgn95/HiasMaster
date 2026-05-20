-- =====================================================================
-- CB Media Hub — Enable Supabase Realtime cho notifications table
-- Chạy SAU add-notifications.sql để bật realtime push.
-- =====================================================================

-- Thêm notifications table vào publication supabase_realtime.
-- Sau khi chạy, INSERT vào notifications sẽ push event qua WebSocket
-- tới tất cả client đã subscribe channel filter user_id=eq.{me}.

ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Optional: cũng enable realtime cho orders/tasks nếu muốn dashboard auto-refresh
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;

-- Verify: liệt kê các table đang trong publication
SELECT schemaname, tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
ORDER BY tablename;
