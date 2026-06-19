-- add-content-initiatives.sql — Content Team Deep Workflow, Phase 1 (Foundation & Data Model).
-- Idempotent (IF NOT EXISTS / DROP+CREATE). Chạy trong Supabase SQL Editor SAU:
--   rls.sql (cần helper current_user_role/is_staff/is_admin/is_admin_or_account)
--   + add-content-team.sql (role lead_content).
--
-- Mục đích: nền dữ liệu cho Content Team xử lý
--   1) Task từ Account chuyển wording (source=client_order — vẫn dùng brief_wording_* trên orders),
--   2) Content Initiative Content/Lead chủ động (source=content_initiated),
--   3) Content Plan cha có nhiều Content Task con (kế hoạch đã ký nhiều hạng mục),
--   4) Revision nội bộ KHÔNG giới hạn,
--   5) Production Handoff Package (trước khi tạo Internal Media Request — Phase 5).
--
-- KHÔNG phá bảng/cột cũ. KHÔNG mở quyền Production Board cho content/lead_content
-- (file này KHÔNG đụng is_staff() nên content/lead_content vẫn không thấy tasks).
-- 3 bảng mới: content_plans · content_tasks · content_task_comments.

-- =====================================================================
-- 1. CONTENT PLANS — kế hoạch/campaign cha
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.content_plans (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title           text NOT NULL,
  description     text,
  source          text NOT NULL DEFAULT 'campaign_package'
                    CHECK (source IN ('client_order','content_initiated','strategy_board','campaign_package')),
  origin          text,                       -- vd 'signed_plan' / 'lead' / 'account'
  campaign_name   text,
  objective       text,
  channels        jsonb NOT NULL DEFAULT '[]'::jsonb,
  target_audience text,
  key_message     text,
  cta             text,
  plan_deadline   timestamptz,
  owner_lead      text,                       -- tên/role Lead Content phụ trách
  status          text NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft','active','in_progress','pending_review','at_risk','completed','archived')),
  progress        integer NOT NULL DEFAULT 0, -- roll-up % từ task con (Phase 4 tính)
  attachment_url  text,
  attachment_path text,
  attachment_name text,
  created_by      text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- =====================================================================
-- 2. CONTENT TASKS — task con giao PIC Content (cũng dùng cho Initiative độc lập)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.content_tasks (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_plan_id        uuid REFERENCES public.content_plans(id) ON DELETE SET NULL,
  source                 text NOT NULL DEFAULT 'content_initiated'
                           CHECK (source IN ('client_order','content_initiated','strategy_board','campaign_package')),
  order_id               text,                -- khi source=client_order: link orders.order_id (text)
  parent_content_task_id uuid REFERENCES public.content_tasks(id) ON DELETE SET NULL,
  title                  text NOT NULL,
  brief                  text,
  output_types           jsonb NOT NULL DEFAULT '[]'::jsonb,
  assigned_pic           text,                -- tên PIC Content chính (1 PIC/ task)
  supporters             jsonb NOT NULL DEFAULT '[]'::jsonb,
  wording_deadline       timestamptz,
  priority               text DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  status                 text NOT NULL DEFAULT 'new'
                           CHECK (status IN (
                             'new','assigned','pic_assigned','in_progress','submitted_to_lead','lead_revision',
                             'lead_approved','submitted_to_account','account_revision','sent_to_client',
                             'client_feedback','client_approved','media_order_created','completed','archived')),
  lead_review_status     text DEFAULT 'pending' CHECK (lead_review_status IN ('pending','approved','revision')),
  internal_revision_count integer NOT NULL DEFAULT 0,   -- track vòng sửa nội bộ (KHÔNG giới hạn)

  -- Workspace / Draft (multi-output) — Content viết ở đây (Phase 3)
  draft_title            text,
  draft_body             text,
  headline               text,
  subheadline            text,
  caption                text,
  script                 text,
  voice_over             text,
  ads_primary_text       text,
  ads_headline           text,
  landing_copy           text,
  email_sms_zalo_copy    text,
  cta                    text,
  mandatory_info         text,
  visual_direction       text,
  asset_links            jsonb NOT NULL DEFAULT '[]'::jsonb,
  files_links            jsonb NOT NULL DEFAULT '[]'::jsonb,
  quality_checklist      jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Missing Info / Assumptions — cảnh báo nghiệp vụ, KHÔNG block (Lead không trả brief về Account)
  missing_info_notes         text,
  assumptions                text,
  questions_for_account_client text,
  risk_notes                 text,

  -- Lead Review / Revision (no-limit)
  revision_history       jsonb NOT NULL DEFAULT '[]'::jsonb,
  last_revision_reason   text,
  lead_review_note       text,
  lead_approved_at       timestamptz,
  lead_approved_by       text,

  -- Production Handoff Package (bắt buộc trước Internal Media Request — Phase 5)
  handoff_ready          boolean NOT NULL DEFAULT false,
  final_headline         text,
  final_body_or_script   text,
  handoff_mandatory_info text,
  handoff_visual_direction text,
  format_size            text,
  channel                text,
  handoff_asset_link     text,
  media_note             text,
  production_deadline    timestamptz,
  request_type           text,                -- map sang tasks.task_type khi tạo Media Request
  deliverable_type       text,

  -- Internal Media Request link (Phase 5)
  need_media_production  boolean NOT NULL DEFAULT false,
  media_request_created  boolean NOT NULL DEFAULT false,
  media_order_id         text,                -- order nội bộ client_visible=false

  created_by             text,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_content_tasks_plan   ON public.content_tasks(content_plan_id);
CREATE INDEX IF NOT EXISTS idx_content_tasks_order  ON public.content_tasks(order_id);
CREATE INDEX IF NOT EXISTS idx_content_tasks_pic    ON public.content_tasks(assigned_pic);
CREATE INDEX IF NOT EXISTS idx_content_tasks_status ON public.content_tasks(status);

-- =====================================================================
-- 3. CONTENT TASK COMMENTS — revision + comment + activity
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.content_task_comments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_task_id uuid NOT NULL REFERENCES public.content_tasks(id) ON DELETE CASCADE,
  kind            text NOT NULL DEFAULT 'comment'
                    CHECK (kind IN ('comment','revision','status','system','submit','review')),
  body            text,
  meta            jsonb NOT NULL DEFAULT '{}'::jsonb,   -- vd { from_status, to_status, round, reason }
  author_id       uuid REFERENCES public.users(id) ON DELETE SET NULL,
  author_name     text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_content_task_comments_task ON public.content_task_comments(content_task_id);

-- =====================================================================
-- 4. Triggers updated_at (dùng helper có sẵn từ schema.sql)
-- =====================================================================
DROP TRIGGER IF EXISTS trg_content_plans_updated_at ON public.content_plans;
CREATE TRIGGER trg_content_plans_updated_at BEFORE UPDATE ON public.content_plans
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_content_tasks_updated_at ON public.content_tasks;
CREATE TRIGGER trg_content_tasks_updated_at BEFORE UPDATE ON public.content_tasks
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =====================================================================
-- 5. RLS — Content Team only (KHÔNG đụng is_staff() → production/design/editor
--     KHÔNG thấy; client KHÔNG bao giờ thấy internal content task/plan).
--       admin                 → full
--       lead_content          → full trong Content Team (3 bảng)
--       content               → đọc tất cả + sửa task được gán cho mình
--       account               → đọc task gắn order (source=client_order) để theo dõi
-- =====================================================================
ALTER TABLE public.content_plans        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_tasks        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_task_comments ENABLE ROW LEVEL SECURITY;

-- ----- content_plans -----
DROP POLICY IF EXISTS "content_plans admin all"     ON public.content_plans;
CREATE POLICY "content_plans admin all" ON public.content_plans
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "content_plans lead all"      ON public.content_plans;
CREATE POLICY "content_plans lead all" ON public.content_plans
  FOR ALL USING (public.current_user_role() = 'lead_content')
  WITH CHECK (public.current_user_role() = 'lead_content');

DROP POLICY IF EXISTS "content_plans content read"  ON public.content_plans;
CREATE POLICY "content_plans content read" ON public.content_plans
  FOR SELECT USING (public.current_user_role() = 'content');

DROP POLICY IF EXISTS "content_plans account read"  ON public.content_plans;
CREATE POLICY "content_plans account read" ON public.content_plans
  FOR SELECT USING (public.current_user_role() = 'account');

-- ----- content_tasks -----
DROP POLICY IF EXISTS "content_tasks admin all"     ON public.content_tasks;
CREATE POLICY "content_tasks admin all" ON public.content_tasks
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "content_tasks lead all"      ON public.content_tasks;
CREATE POLICY "content_tasks lead all" ON public.content_tasks
  FOR ALL USING (public.current_user_role() = 'lead_content')
  WITH CHECK (public.current_user_role() = 'lead_content');

DROP POLICY IF EXISTS "content_tasks content read"  ON public.content_tasks;
CREATE POLICY "content_tasks content read" ON public.content_tasks
  FOR SELECT USING (public.current_user_role() = 'content');

-- Content sửa task được gán cho mình (match assigned_pic theo tên users.name).
DROP POLICY IF EXISTS "content_tasks content update_assigned" ON public.content_tasks;
CREATE POLICY "content_tasks content update_assigned" ON public.content_tasks
  FOR UPDATE USING (
    public.current_user_role() = 'content'
    AND assigned_pic = (SELECT name FROM public.users WHERE id = auth.uid())
  ) WITH CHECK (
    public.current_user_role() = 'content'
    AND assigned_pic = (SELECT name FROM public.users WHERE id = auth.uid())
  );

-- Account đọc task gắn order (theo dõi wording từ Client Order).
DROP POLICY IF EXISTS "content_tasks account read"  ON public.content_tasks;
CREATE POLICY "content_tasks account read" ON public.content_tasks
  FOR SELECT USING (public.current_user_role() = 'account' AND source = 'client_order');

-- ----- content_task_comments -----
DROP POLICY IF EXISTS "content_task_comments admin all" ON public.content_task_comments;
CREATE POLICY "content_task_comments admin all" ON public.content_task_comments
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "content_task_comments team read" ON public.content_task_comments;
CREATE POLICY "content_task_comments team read" ON public.content_task_comments
  FOR SELECT USING (public.current_user_role() IN ('lead_content','content','account'));

DROP POLICY IF EXISTS "content_task_comments team insert" ON public.content_task_comments;
CREATE POLICY "content_task_comments team insert" ON public.content_task_comments
  FOR INSERT WITH CHECK (public.current_user_role() IN ('lead_content','content'));

-- =====================================================================
-- 6. Realtime — đẩy thay đổi cho Content Team workspace
-- =====================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'content_tasks'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.content_tasks;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'content_task_comments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.content_task_comments;
  END IF;
EXCEPTION WHEN undefined_object THEN
  -- publication supabase_realtime chưa tồn tại (local dev) → bỏ qua.
  NULL;
END $$;

-- =====================================================================
-- 7. Storage — đính kèm file PDF kế hoạch Content (tái dùng bucket `plan-files`,
--    prefix `content-plans/`). RLS gốc của plan-files (cbplan_*) chỉ cho
--    supervisor/admin ghi → thêm policy cho lead_content/admin ghi+đọc dưới
--    prefix content-plans/. (Bucket `plan-files` do add-supervisor-planning.sql
--    tạo; ON CONFLICT để chắc tồn tại nếu chạy độc lập.)
-- =====================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('plan-files', 'plan-files', false, 50 * 1024 * 1024, NULL)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "cbplan_content_write"  ON storage.objects;
CREATE POLICY "cbplan_content_write"  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'plan-files' AND split_part(name, '/', 1) = 'content-plans'
             AND public.current_user_role() IN ('lead_content','admin'));

DROP POLICY IF EXISTS "cbplan_content_update" ON storage.objects;
CREATE POLICY "cbplan_content_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'plan-files' AND split_part(name, '/', 1) = 'content-plans'
         AND public.current_user_role() IN ('lead_content','admin'));

DROP POLICY IF EXISTS "cbplan_content_delete" ON storage.objects;
CREATE POLICY "cbplan_content_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'plan-files' AND split_part(name, '/', 1) = 'content-plans'
         AND public.current_user_role() IN ('lead_content','admin'));

DROP POLICY IF EXISTS "cbplan_content_read"   ON storage.objects;
CREATE POLICY "cbplan_content_read"   ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'plan-files' AND split_part(name, '/', 1) = 'content-plans'
         AND public.current_user_role() IN ('lead_content','admin','account','content'));

-- Verify (tùy chọn):
-- SELECT tablename FROM pg_tables WHERE tablename LIKE 'content_%';
-- SELECT policyname, tablename FROM pg_policies WHERE tablename LIKE 'content_%' ORDER BY tablename, policyname;
-- SELECT policyname FROM pg_policies WHERE tablename='objects' AND policyname LIKE 'cbplan_content%';
