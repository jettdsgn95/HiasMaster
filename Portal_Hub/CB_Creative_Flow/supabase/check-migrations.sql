-- =====================================================================
-- check-migrations.sql — KIỂM TRA MIGRATION NÀO ĐÃ / CHƯA CHẠY
-- (2026-07-31)
--
-- Dán TOÀN BỘ file này vào Supabase → SQL Editor → Run.
-- Kết quả: mỗi migration 1 dòng, cột `trang_thai` = 'DA CHAY' hoặc 'CHUA CHAY',
-- kèm `dau_hieu` = artifact được dùng để kiểm (cột/bảng/function/policy).
--
-- Cách kiểm: mỗi migration chọn 1 artifact ĐẶC TRƯNG mà chỉ file đó tạo ra.
-- CHỈ ĐỌC (information_schema / pg_catalog / storage.buckets) — không ghi gì.
--
-- ⚠ Giới hạn: chỉ trả lời "artifact có tồn tại không". Nếu migration đã chạy
-- rồi bị sửa/chạy lại một phần, hoặc file được cập nhật sau khi chạy (vd
-- add-content-team.sql thêm cột vào RPC), thì vẫn hiện 'DA CHAY'. Với các file
-- cần RE-RUN sau khi cập nhật, xem cột `ghi_chu`.
-- =====================================================================

WITH c AS (
  SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public'
),
f AS (
  SELECT p.proname, pg_get_functiondef(p.oid) AS def
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
),
pol AS (SELECT policyname FROM pg_policies WHERE schemaname = 'public')

SELECT * FROM (

  SELECT  1 AS stt, 'schema.sql'                        AS migration, 'bảng public.orders'                       AS dau_hieu, (to_regclass('public.orders') IS NOT NULL) AS ok, '' AS ghi_chu
  UNION ALL SELECT  2, 'add-notifications.sql',            'bảng public.notifications',            (to_regclass('public.notifications') IS NOT NULL), ''
  UNION ALL SELECT  3, 'add-notifications-rls.sql',        'policy "notifications select own"',    EXISTS (SELECT 1 FROM pol WHERE policyname = 'notifications select own'), ''
  UNION ALL SELECT  4, 'add-cancel-fields.sql',            'orders.cancel_reason',                 EXISTS (SELECT 1 FROM c WHERE table_name='orders' AND column_name='cancel_reason'), ''
  UNION ALL SELECT  5, 'rls.sql',                          'function current_user_role()',         EXISTS (SELECT 1 FROM f WHERE proname='current_user_role'), ''
  UNION ALL SELECT  6, 'storage.sql',                      'bucket brief-files',                   EXISTS (SELECT 1 FROM storage.buckets WHERE id='brief-files'), ''
  UNION ALL SELECT  7, 'enable-realtime.sql',              'publication supabase_realtime ⊃ notifications', EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='notifications'), ''
  UNION ALL SELECT  8, 'add-shoot-location.sql',           'orders.shoot_location',                EXISTS (SELECT 1 FROM c WHERE table_name='orders' AND column_name='shoot_location'), ''
  UNION ALL SELECT  9, 'add-media-pics.sql',               'orders.production_pic_video',          EXISTS (SELECT 1 FROM c WHERE table_name='orders' AND column_name='production_pic_video'), ''
  UNION ALL SELECT 10, 'add-shoot-date.sql',               'orders.shoot_date',                    EXISTS (SELECT 1 FROM c WHERE table_name='orders' AND column_name='shoot_date'), 'Media Operations cần cột này'
  UNION ALL SELECT 11, 'add-wording-deadline.sql',         'orders.wording_deadline',              EXISTS (SELECT 1 FROM c WHERE table_name='orders' AND column_name='wording_deadline'), ''
  UNION ALL SELECT 12, 'add-brief-wording-fields.sql',     'orders.brief_wording_status',          EXISTS (SELECT 1 FROM c WHERE table_name='orders' AND column_name='brief_wording_status'), ''
  UNION ALL SELECT 13, 'add-brief-wording-workspace-fields.sql', 'orders.wording_brief',           EXISTS (SELECT 1 FROM c WHERE table_name='orders' AND column_name='wording_brief'), ''
  UNION ALL SELECT 14, 'add-brief-wording-confirmation.sql','orders.wording_client_sent_at',       EXISTS (SELECT 1 FROM c WHERE table_name='orders' AND column_name='wording_client_sent_at'), ''
  UNION ALL SELECT 15, 'add-content-role.sql',             'users_role_check ⊃ ''content''',       COALESCE((SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname='users_role_check') LIKE '%''content''%', false), ''
  UNION ALL SELECT 16, 'add-content-team.sql',             'policy "orders lead_content read"',    EXISTS (SELECT 1 FROM pol WHERE policyname = 'orders lead_content read'), 'RE-RUN nếu chạy trước 2026-07-20 (RPC wording thêm brief_wording_pic_user_id)'
  UNION ALL SELECT 17, 'add-system-supervisor.sql',        'function is_system_supervisor()',      EXISTS (SELECT 1 FROM f WHERE proname='is_system_supervisor'), ''
  UNION ALL SELECT 18, 'add-supervisor-planning.sql',      'bảng public.lead_tasks',               (to_regclass('public.lead_tasks') IS NOT NULL), ''
  UNION ALL SELECT 19, 'add-media-lead-production.sql',    'is_admin_or_account() ⊃ lead_media',   EXISTS (SELECT 1 FROM f WHERE proname='is_admin_or_account' AND def ILIKE '%lead_media%'), 'Lead Media cần cái này để ghi orders/tasks'
  UNION ALL SELECT 20, 'add-content-initiatives.sql',      'bảng public.content_tasks',            (to_regclass('public.content_tasks') IS NOT NULL), ''
  UNION ALL SELECT 21, 'add-content-to-media-order.sql',   'orders.order_kind',                    EXISTS (SELECT 1 FROM c WHERE table_name='orders' AND column_name='order_kind'), ''
  UNION ALL SELECT 22, 'add-ads-orders.sql',               'orders.ads_status',                    EXISTS (SELECT 1 FROM c WHERE table_name='orders' AND column_name='ads_status'), ''
  UNION ALL SELECT 23, 'add-brand-check.sql',              'bảng public.brand_checks',             (to_regclass('public.brand_checks') IS NOT NULL), 'Cần deploy thêm Edge Function brand-check-analyze'
  UNION ALL SELECT 24, 'add-lead-content-order-view.sql',  'function append_lead_content_order_note()', EXISTS (SELECT 1 FROM f WHERE proname='append_lead_content_order_note'), ''
  UNION ALL SELECT 25, 'add-content-self-initiative.sql',  'policy "content_tasks content insert own_initiative"', EXISTS (SELECT 1 FROM pol WHERE policyname = 'content_tasks content insert own_initiative'), ''
  UNION ALL SELECT 26, 'add-content-review-sla.sql',       'content_tasks.lead_review_due',        EXISTS (SELECT 1 FROM c WHERE table_name='content_tasks' AND column_name='lead_review_due'), ''
  UNION ALL SELECT 27, 'add-notify-roles-rpc.sql',         'function notify_roles()',              EXISTS (SELECT 1 FROM f WHERE proname='notify_roles'), 'Thiếu = noti từ client tới staff chết im lặng'
  UNION ALL SELECT 28, 'add-agreed-deadline-flow.sql',     'orders.agreed_deadline',               EXISTS (SELECT 1 FROM c WHERE table_name='orders' AND column_name='agreed_deadline'), ''
  UNION ALL SELECT 29, 'add-content-task-code.sql',        'content_tasks.task_code',              EXISTS (SELECT 1 FROM c WHERE table_name='content_tasks' AND column_name='task_code'), ''
  UNION ALL SELECT 30, 'add-pic-user-id.sql',              'orders.account_pic_user_id',           EXISTS (SELECT 1 FROM c WHERE table_name='orders' AND column_name='account_pic_user_id'), ''
  UNION ALL SELECT 31, 'fix-content-role-visibility.sql',  'policy "orders content read assigned wording"', EXISTS (SELECT 1 FROM pol WHERE policyname = 'orders content read assigned wording'), 'Thiếu = role content đọc được TOÀN BỘ orders'
  UNION ALL SELECT 32, 'add-media-operations.sql',         'orders.media_logistics_status',        EXISTS (SELECT 1 FROM c WHERE table_name='orders' AND column_name='media_logistics_status'), 'Module #16 Media Operations'
  UNION ALL SELECT 33, 'add-preview-approval.sql',         'orders.approved_at',                   EXISTS (SELECT 1 FROM c WHERE table_name='orders' AND column_name='approved_at'), ''
  UNION ALL SELECT 34, 'add-revision-rounds.sql',          'orders.revision_round',                EXISTS (SELECT 1 FROM c WHERE table_name='orders' AND column_name='revision_round'), ''
  UNION ALL SELECT 35, 'add-revision-link.sql',            'orders.parent_order_id',               EXISTS (SELECT 1 FROM c WHERE table_name='orders' AND column_name='parent_order_id'), 'optional'
  UNION ALL SELECT 36, 'sync-order-status-from-tasks.sql', 'function sync_order_production_status()', EXISTS (SELECT 1 FROM f WHERE proname='sync_order_production_status'), ''
  UNION ALL SELECT 37, 'add-google-sso-cbcentres.sql',     'bảng public.user_role_map',            (to_regclass('public.user_role_map') IS NOT NULL), 'cần cho SSO @cbcentres.com'

) x
ORDER BY ok, stt;   -- CHƯA CHẠY lên đầu cho dễ thấy

-- ---------------------------------------------------------------------
-- Xem dạng gọn (chỉ cái CHƯA chạy) — bỏ comment nếu muốn:
-- ... thay dòng cuối bằng:  ) x WHERE NOT ok ORDER BY stt;
-- ---------------------------------------------------------------------

-- Kiểm tra thêm cho Media Operations (module #16):
-- SELECT policyname, cmd FROM pg_policies
--  WHERE schemaname='public' AND policyname LIKE '%lead_media%' ORDER BY tablename, cmd;
-- SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname='content_tasks_source_check';
-- SELECT email, name, role, status FROM public.users ORDER BY role, name;
