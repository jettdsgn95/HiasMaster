-- =====================================================================
-- CB Media Hub — Supabase Seed Data (Phase 1)
-- Chạy SAU schema.sql, TRƯỚC khi bật RLS.
--
-- LƯU Ý: Demo users vẫn dùng password `cb2026` cho dễ test. Production
-- phải force change password ngay sau lần login đầu tiên.
--
-- Quy trình:
--   1. Vào Supabase Dashboard → Authentication → Users → Add user.
--      Tạo 5 user với email `admin@cb.vn`, `account@cb.vn`, `design@cb.vn`,
--      `editor@cb.vn`, `client@cb.vn`. Password: `cb2026` (hoặc tự đặt).
--   2. Chạy SQL dưới đây để fill public.users metadata.
--      (Trigger handle_new_auth_user đã insert row nhưng chỉ có email/name basic.)
--   3. Chạy phần ORDERS + TASKS để seed mock data demo.
-- =====================================================================

-- 1️⃣  UPDATE public.users với role + display info
-- (Trigger đã tự tạo row khi Supabase Auth tạo user. UPDATE thêm metadata.)
UPDATE public.users SET name = 'Mai Phương', initials = 'MP', title = 'Admin · Account Lead',  role = 'admin',   department = 'HO Marketing' WHERE email = 'admin@cb.vn';
UPDATE public.users SET name = 'Hậu Nguyễn',  initials = 'HN', title = 'Account Manager',        role = 'account', department = 'HO Marketing' WHERE email = 'account@cb.vn';
UPDATE public.users SET name = 'Duy Trần',    initials = 'DT', title = 'Senior Designer',        role = 'design',  department = 'HO Marketing' WHERE email = 'design@cb.vn';
UPDATE public.users SET name = 'Linh Chi',    initials = 'LC', title = 'Video Editor',           role = 'editor',  department = 'HO Marketing' WHERE email = 'editor@cb.vn';
UPDATE public.users SET name = 'Lan Anh',     initials = 'LA', title = 'CB Mekong Manager',      role = 'client',  department = 'CB Mekong'    WHERE email = 'client@cb.vn';

-- 2️⃣  Sample ORDERS (chuyển 5 order đầu từ database-orders.js mock array)
INSERT INTO public.orders (
  order_id, requester_name, requester_email, requester_contact, department,
  project_name, project_purpose, request_type, deliverable_type, target_audience, usage_channels,
  size_ratio, content_brief, creative_direction, wording_required, source_link, file_brief_url,
  priority, requested_deadline, actual_use_date,
  account_status, account_pic, production_pic, production_status,
  internal_deadline, progress, created_at, last_updated, content_responsibility_confirmed
)
VALUES
  ('MEDIA-2026-0001', 'Trần Quốc Anh', 'qa@cbcentres.com', '0901234567', 'CB Mekong',
   'Summer Campaign 2026', 'Thiết kế POSM cho chương trình tuyển sinh hè 2026 trên toàn hệ thống chi nhánh.',
   'design', ARRAY['Backdrop','Standee','Social Post'], ARRAY['Phụ huynh','Học viên ngoài CB'], ARRAY['Facebook','In ấn','Sự kiện'],
   'Standee 80×180cm + Backdrop 4×3m', 'Tone trẻ trung, dynamic. Key message: "Mùa hè rực rỡ tại CB."', 'Theo brand CB, dùng màu navy + red đặc trưng.',
   false, 'https://drive.google.com/...', 'brief-summer-2026.pdf',
   'urgent', '2026-05-25', '2026-06-01',
   'pending', NULL, NULL, 'unassigned',
   NULL, 5, '2026-05-12 09:24'::timestamptz, '2026-05-12 09:24'::timestamptz, true),

  ('MEDIA-2026-0004', 'Phạm Thị Lan', 'lan.pham@cbcentres.com', '0908111222', 'Sales',
   'Bộ Key Visual Sự kiện Q3', 'Bộ KV cho sự kiện ra mắt khóa Q3, sử dụng đa kênh.',
   'design', ARRAY['Backdrop','Standee','Poster','Social Post','Banner'], ARRAY['Phụ huynh','Học viên CB'], ARRAY['Facebook','In ấn','Sự kiện','LCD / TV nội bộ'],
   'Đa kích cỡ', 'Sự kiện công bố lộ trình học mới Q3. Tone chuyên nghiệp, hiện đại.', 'Theo brand CB, có thể dùng gradient navy → red.',
   true, NULL, NULL,
   'urgent', '2026-05-22', '2026-05-28',
   'confirmed', 'Mai Phương', 'Duy', 'inprogress',
   '2026-05-20 17:00'::timestamptz, 50, '2026-05-10 11:08'::timestamptz, '2026-05-12 11:42'::timestamptz, true),

  ('MEDIA-2026-0006', 'Vũ Hoàng Mai', 'mai.vu@cbcentres.com', '0903778899', 'HO Marketing',
   'Reel TikTok Tháng 5', 'Loạt 4 reel ngắn TikTok cho tháng 5.',
   'video', ARRAY['Reel/TikTok 9:16'], ARRAY['Học viên ngoài CB'], ARRAY['TikTok / Reels'],
   '9:16', '4 reel × 30s. Highlight các tip học hiệu quả.', 'Trending, fast cut, dùng caption motion.',
   false, 'https://drive.google.com/footage-may', NULL,
   'critical', '2026-05-13', NULL,
   'confirmed', 'Hậu', 'Vinh', 'review',
   '2026-05-12 17:00'::timestamptz, 90, '2026-05-08 17:30'::timestamptz, '2026-05-12 16:45'::timestamptz, true),

  ('MEDIA-2026-0010', 'Phạm Thanh Hà', 'ha.pham@cbcentres.com', '0906998877', 'CB Mekong',
   'Bộ Poster Tuyển dụng', 'Poster tuyển dụng giáo viên + nhân viên Q3.',
   'design', ARRAY['Poster','Social Post'], ARRAY['Giáo viên / Nhân sự nội bộ'], ARRAY['Facebook','In ấn','Trường học/Chi nhánh'],
   'A3 + 1:1', '5 vị trí khác nhau, mỗi vị trí 1 poster.', 'Warm, welcoming, brand CB.',
   false, NULL, NULL,
   'normal', '2026-05-09', NULL,
   'confirmed', 'Hậu', 'Vinh', 'delivered',
   '2026-05-08 17:00'::timestamptz, 95, '2026-05-04 15:18'::timestamptz, '2026-05-09 11:30'::timestamptz, true),

  ('MEDIA-2026-0015', 'Nguyễn Thu Hà', 'ha.nguyen@cbcentres.com', '0907654321', 'Academic',
   'KV Tuyển sinh Q3 2026', 'Key Visual chính cho campaign tuyển sinh Q3.',
   'design', ARRAY['Backdrop','Standee','Poster','Social Post','LCD/TV Screen'], ARRAY['Phụ huynh','Học viên ngoài CB'], ARRAY['Facebook','In ấn','Sự kiện','LCD / TV nội bộ','Website'],
   'Đa kích cỡ — main KV', 'KV chủ đề "Chinh phục Q3 cùng CB".', 'Hùng tráng, năng động, có cảm hứng vươn lên.',
   true, NULL, NULL,
   'critical', '2026-05-18', NULL,
   'pending', NULL, NULL, 'unassigned',
   NULL, 5, '2026-05-12 14:48'::timestamptz, '2026-05-12 14:48'::timestamptz, true)
ON CONFLICT (order_id) DO NOTHING;

UPDATE public.orders SET urgent_reason = 'Campaign cần launch trước 13/5.' WHERE order_id = 'MEDIA-2026-0006';
UPDATE public.orders SET urgent_reason = 'Roadmap bị đẩy lên 1 tuần.' WHERE order_id = 'MEDIA-2026-0015';
UPDATE public.orders SET satisfaction_score = 5, final_delivery_link = 'https://drive.google.com/final-posters', delivery_status = 'completed' WHERE order_id = 'MEDIA-2026-0010';

-- 3️⃣  Sample TASKS (chuyển 4 task từ production-board.js mock array)
INSERT INTO public.tasks (
  task_id, order_id, is_standalone, project_name, task_type, content, priority,
  assigned_to, status, progress, internal_deadline, link_drive, preview_link, final_link,
  created_at, last_update
)
VALUES
  ('TASK-0001', 'MEDIA-2026-0004', false, 'Bộ Key Visual Sự kiện Q3', 'design',
   'Bộ KV cho sự kiện ra mắt khóa Q3 — Backdrop + Standee + Poster + Social Post + Banner. Tone chuyên nghiệp, hiện đại.',
   'urgent', 'Duy', 'inprogress', 50, '2026-05-20 17:00'::timestamptz,
   'https://drive.google.com/folder/kv-q3', NULL, NULL,
   '2026-05-10 11:15'::timestamptz, '2026-05-12 11:42'::timestamptz),

  ('TASK-0003', 'MEDIA-2026-0006', false, 'Reel TikTok Tháng 5', 'video',
   'Loạt 4 reel ngắn TikTok cho tháng 5, 30s/reel. Trending, fast cut.',
   'critical', 'Vinh', 'review', 65, '2026-05-12 17:00'::timestamptz,
   'https://drive.google.com/folder/may-reels', 'https://drive.google.com/preview-reels-v1', NULL,
   '2026-05-08 18:00'::timestamptz, '2026-05-12 16:45'::timestamptz),

  ('TASK-0007', 'MEDIA-2026-0010', false, 'Bộ Poster Tuyển dụng', 'design',
   'Poster tuyển dụng 5 vị trí khác nhau + Social Post.',
   'normal', 'Vinh', 'completed', 100, '2026-05-08 17:00'::timestamptz,
   'https://drive.google.com/folder/poster-recruit', 'https://drive.google.com/preview-posters', 'https://drive.google.com/final-posters',
   '2026-05-04 16:00'::timestamptz, '2026-05-09 11:30'::timestamptz),

  ('TASK-0011', 'MEDIA-2026-0004', false, 'Bộ KV Sự kiện Q3 — Social Cuts', 'design',
   'Cutdown social post 1:1 + 9:16 từ KV chính.',
   'urgent', 'Vinh', 'pending', 20, '2026-05-22 17:00'::timestamptz,
   NULL, NULL, NULL,
   '2026-05-10 12:00'::timestamptz, '2026-05-12 11:42'::timestamptz)
ON CONFLICT (task_id) DO NOTHING;

UPDATE public.tasks SET completed_at = '2026-05-09 11:30'::timestamptz WHERE task_id = 'TASK-0007';

-- 4️⃣  Sample task_comments
INSERT INTO public.task_comments (task_id, author, text, type, created_at)
VALUES
  ('TASK-0001', 'Mai Phương', 'Brief đã xác nhận. Bắt đầu sản xuất nhé.', 'internal', '2026-05-10 14:20'::timestamptz),
  ('TASK-0003', 'Hậu',         'Reel 1 caption hơi dài, cân nhắc cắt bớt.', 'revision', '2026-05-12 17:00'::timestamptz)
ON CONFLICT DO NOTHING;

-- =====================================================================
-- Note: Full mock dataset (18 orders + 16 tasks + 14 users + 10 deliveries)
-- nằm trong các JS file gốc. Khi migrate từng module sang Supabase, em sẽ
-- generate seed SQL đầy đủ. Hiện chỉ seed tối thiểu để verify connection.
-- =====================================================================
