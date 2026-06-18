-- add-supervisor-planning.sql — Module "Supervisor Planning" (Kế hoạch nội bộ).
-- Idempotent. Chạy trong Supabase SQL Editor SAU: rls.sql (cần helper
-- current_user_role() + is_admin()) và add-system-supervisor.sql (role
-- system_supervisor đã có trong users_role_check).
--
-- Mục đích: bảng `lead_tasks` cho System Supervisor lập + giao kế hoạch nội bộ
-- cho 2 nhóm Lead (Media / Content), TÁCH BIỆT khỏi `tasks` (production) và
-- flow wording. Đồng thời mở role mới `lead_media` (song song lead_content).
--
-- Phân quyền (RLS):
--   • system_supervisor + admin  → toàn quyền (SELECT/INSERT/UPDATE/DELETE).
--   • lead_media                 → SELECT/UPDATE/DELETE dòng assigned_lead='lead_media'.
--   • lead_content               → SELECT/UPDATE/DELETE dòng assigned_lead='lead_content'.
--   (Lead KHÔNG được INSERT — chỉ supervisor/admin tạo kế hoạch.)

-- =====================================================================
-- B1. Role 'lead_media' vào users_role_check (giữ đủ 8 role cũ + thêm 1).
--     Phải DROP rồi ADD lại vì CHECK constraint không ALTER tại chỗ được.
-- =====================================================================
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users ADD CONSTRAINT users_role_check
  CHECK (role IN ('admin','account','design','editor','client',
                  'content','lead_content','system_supervisor','lead_media'));

-- =====================================================================
-- B2. Bảng lead_tasks.
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.lead_tasks (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title           text NOT NULL,
  description     text,
  -- 'both' = giao đồng thời cho cả Lead Media + Lead Content.
  assigned_lead   text NOT NULL CHECK (assigned_lead IN ('lead_media','lead_content','both')),
  status          text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','in_progress','completed','archived')),
  priority        smallint NOT NULL DEFAULT 1,
  deadline        date,
  -- Đính kèm kế hoạch: file upload Storage (attachment_path/name, bucket plan-files)
  -- HOẶC link ngoài (attachment_url, vd Google Drive). Cả hai optional.
  attachment_path text,
  attachment_name text,
  attachment_url  text,
  -- Tiến độ riêng từng Lead (plan 'both' theo dõi Media & Content độc lập):
  --   {"lead_media":"in_progress","lead_content":"pending"}. `status` = tổng hợp (derived).
  lead_status     jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Checklist đầu việc dùng chung: [{"id","text","done","done_by","done_at"}] → progress %.
  checklist       jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- Hồ sơ Lead nộp duyệt per-lane: {"lead_media":{"kind":"plan|product","link","file_path",
  --   "file_name","note","submitted_at","round","review_note"}}. Lane status 'submitted'/'revision'
  --   nằm trong lead_status (jsonb → KHÔNG cần đổi CHECK).
  lead_submissions jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Nguồn tạo + duyệt đề xuất (Lead chủ động đề xuất → Supervisor duyệt mới active):
  --   origin 'supervisor' (giao xuống) | 'lead' (Lead đề xuất); approval 'approved'|'proposed'|'declined'.
  origin          text NOT NULL DEFAULT 'supervisor' CHECK (origin IN ('supervisor','lead')),
  approval        text NOT NULL DEFAULT 'approved'   CHECK (approval IN ('approved','proposed','declined')),
  -- Lead "nắm thông tin" (mention, không chịu trách nhiệm): mảng role được xem read-only.
  informed_leads  jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by      uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Idempotent: thêm cột nếu bảng đã tồn tại từ bản migration cũ (trước khi có 'both'/attachment/progress).
ALTER TABLE public.lead_tasks ADD COLUMN IF NOT EXISTS attachment_path text;
ALTER TABLE public.lead_tasks ADD COLUMN IF NOT EXISTS attachment_name text;
ALTER TABLE public.lead_tasks ADD COLUMN IF NOT EXISTS attachment_url  text;
ALTER TABLE public.lead_tasks ADD COLUMN IF NOT EXISTS lead_status jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.lead_tasks ADD COLUMN IF NOT EXISTS checklist   jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.lead_tasks ADD COLUMN IF NOT EXISTS lead_submissions jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.lead_tasks ADD COLUMN IF NOT EXISTS origin         text NOT NULL DEFAULT 'supervisor';
ALTER TABLE public.lead_tasks ADD COLUMN IF NOT EXISTS approval       text NOT NULL DEFAULT 'approved';
ALTER TABLE public.lead_tasks ADD COLUMN IF NOT EXISTS informed_leads jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.lead_tasks DROP CONSTRAINT IF EXISTS lead_tasks_origin_check;
ALTER TABLE public.lead_tasks ADD CONSTRAINT lead_tasks_origin_check   CHECK (origin IN ('supervisor','lead'));
ALTER TABLE public.lead_tasks DROP CONSTRAINT IF EXISTS lead_tasks_approval_check;
ALTER TABLE public.lead_tasks ADD CONSTRAINT lead_tasks_approval_check CHECK (approval IN ('approved','proposed','declined'));
-- Mở rộng CHECK assigned_lead để nhận 'both' (nếu constraint cũ chỉ có 2 giá trị).
ALTER TABLE public.lead_tasks DROP CONSTRAINT IF EXISTS lead_tasks_assigned_lead_check;
ALTER TABLE public.lead_tasks ADD CONSTRAINT lead_tasks_assigned_lead_check
  CHECK (assigned_lead IN ('lead_media','lead_content','both'));

CREATE INDEX IF NOT EXISTS idx_lead_tasks_assigned_lead ON public.lead_tasks (assigned_lead);
CREATE INDEX IF NOT EXISTS idx_lead_tasks_status        ON public.lead_tasks (status);
CREATE INDEX IF NOT EXISTS idx_lead_tasks_deadline      ON public.lead_tasks (deadline);

-- updated_at tự refresh khi UPDATE (BEFORE UPDATE trigger).
CREATE OR REPLACE FUNCTION public.touch_lead_task_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_lead_tasks_updated_at ON public.lead_tasks;
CREATE TRIGGER trg_lead_tasks_updated_at
  BEFORE UPDATE ON public.lead_tasks
  FOR EACH ROW EXECUTE FUNCTION public.touch_lead_task_updated_at();

-- =====================================================================
-- B3. RLS.
-- =====================================================================
ALTER TABLE public.lead_tasks ENABLE ROW LEVEL SECURITY;

-- Supervisor + Admin: toàn quyền.
DROP POLICY IF EXISTS "lead_tasks supervisor all" ON public.lead_tasks;
CREATE POLICY "lead_tasks supervisor all" ON public.lead_tasks
  FOR ALL
  USING      (public.current_user_role() IN ('system_supervisor','admin'))
  WITH CHECK (public.current_user_role() IN ('system_supervisor','admin'));

-- Lead Media: đọc/sửa/xóa dòng của Media HOẶC 'both' (không INSERT). WITH CHECK
-- giữ dòng trong tầm nhìn của Lead (media|both) — không reassign sang content-only.
DROP POLICY IF EXISTS "lead_tasks media read"   ON public.lead_tasks;
CREATE POLICY "lead_tasks media read"   ON public.lead_tasks
  FOR SELECT USING (public.current_user_role() = 'lead_media' AND assigned_lead IN ('lead_media','both'));
DROP POLICY IF EXISTS "lead_tasks media update" ON public.lead_tasks;
CREATE POLICY "lead_tasks media update" ON public.lead_tasks
  FOR UPDATE USING      (public.current_user_role() = 'lead_media' AND assigned_lead IN ('lead_media','both'))
             WITH CHECK (public.current_user_role() = 'lead_media' AND assigned_lead IN ('lead_media','both'));
DROP POLICY IF EXISTS "lead_tasks media delete" ON public.lead_tasks;
CREATE POLICY "lead_tasks media delete" ON public.lead_tasks
  FOR DELETE USING (public.current_user_role() = 'lead_media' AND assigned_lead IN ('lead_media','both'));

-- Lead Content: đọc/sửa/xóa dòng của Content HOẶC 'both' (không INSERT).
DROP POLICY IF EXISTS "lead_tasks content read"   ON public.lead_tasks;
CREATE POLICY "lead_tasks content read"   ON public.lead_tasks
  FOR SELECT USING (public.current_user_role() = 'lead_content' AND assigned_lead IN ('lead_content','both'));
DROP POLICY IF EXISTS "lead_tasks content update" ON public.lead_tasks;
CREATE POLICY "lead_tasks content update" ON public.lead_tasks
  FOR UPDATE USING      (public.current_user_role() = 'lead_content' AND assigned_lead IN ('lead_content','both'))
             WITH CHECK (public.current_user_role() = 'lead_content' AND assigned_lead IN ('lead_content','both'));
DROP POLICY IF EXISTS "lead_tasks content delete" ON public.lead_tasks;
CREATE POLICY "lead_tasks content delete" ON public.lead_tasks
  FOR DELETE USING (public.current_user_role() = 'lead_content' AND assigned_lead IN ('lead_content','both'));

-- Lead chủ động ĐỀ XUẤT: INSERT chỉ khi origin='lead' + approval='proposed' + đúng bucket mình.
-- (Supervisor duyệt → đổi approval='approved' qua policy supervisor all.)
DROP POLICY IF EXISTS "lead_tasks lead propose" ON public.lead_tasks;
CREATE POLICY "lead_tasks lead propose" ON public.lead_tasks
  FOR INSERT WITH CHECK (
    public.current_user_role() IN ('lead_media','lead_content')
    AND origin = 'lead' AND approval = 'proposed'
    AND created_by = auth.uid()
    AND (
      (public.current_user_role() = 'lead_media'   AND assigned_lead = 'lead_media')
      OR (public.current_user_role() = 'lead_content' AND assigned_lead = 'lead_content')
    )
  );

-- Lead được "mention nắm thông tin": SELECT read-only dòng có role mình trong informed_leads.
DROP POLICY IF EXISTS "lead_tasks informed read" ON public.lead_tasks;
CREATE POLICY "lead_tasks informed read" ON public.lead_tasks
  FOR SELECT USING (
    public.current_user_role() IN ('lead_media','lead_content')
    AND informed_leads ? public.current_user_role()
  );

-- =====================================================================
-- B3b. Bảng lead_task_comments — thread cộng tác 2 chiều + activity timeline.
--      kind: 'comment' (trao đổi) | 'status' (đổi trạng thái) | 'system' (sự kiện).
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.lead_task_comments (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_task_id uuid NOT NULL REFERENCES public.lead_tasks(id) ON DELETE CASCADE,
  author_id    uuid REFERENCES public.users(id) ON DELETE SET NULL,
  author_name  text,
  author_role  text,
  kind         text NOT NULL DEFAULT 'comment' CHECK (kind IN ('comment','status','system','submit','review')),
  body         text,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lead_task_comments_task ON public.lead_task_comments (lead_task_id, created_at);
-- Idempotent: mở rộng kind CHECK cho bản migration cũ (thêm 'submit'/'review').
ALTER TABLE public.lead_task_comments DROP CONSTRAINT IF EXISTS lead_task_comments_kind_check;
ALTER TABLE public.lead_task_comments ADD CONSTRAINT lead_task_comments_kind_check
  CHECK (kind IN ('comment','status','system','submit','review'));

ALTER TABLE public.lead_task_comments ENABLE ROW LEVEL SECURITY;

-- Supervisor/Admin: toàn quyền.
DROP POLICY IF EXISTS "ltc supervisor all" ON public.lead_task_comments;
CREATE POLICY "ltc supervisor all" ON public.lead_task_comments
  FOR ALL
  USING      (public.current_user_role() IN ('system_supervisor','admin'))
  WITH CHECK (public.current_user_role() IN ('system_supervisor','admin'));

-- Lead: đọc + thêm comment cho plan thuộc bucket mình (join lead_tasks). KHÔNG sửa/xóa.
DROP POLICY IF EXISTS "ltc lead read" ON public.lead_task_comments;
CREATE POLICY "ltc lead read" ON public.lead_task_comments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.lead_tasks lt
      WHERE lt.id = lead_task_comments.lead_task_id
        AND (
          (public.current_user_role() = 'lead_media'   AND lt.assigned_lead IN ('lead_media','both'))
          OR (public.current_user_role() = 'lead_content' AND lt.assigned_lead IN ('lead_content','both'))
        )
    )
  );
DROP POLICY IF EXISTS "ltc lead insert" ON public.lead_task_comments;
CREATE POLICY "ltc lead insert" ON public.lead_task_comments
  FOR INSERT WITH CHECK (
    author_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.lead_tasks lt
      WHERE lt.id = lead_task_comments.lead_task_id
        AND (
          (public.current_user_role() = 'lead_media'   AND lt.assigned_lead IN ('lead_media','both'))
          OR (public.current_user_role() = 'lead_content' AND lt.assigned_lead IN ('lead_content','both'))
        )
    )
  );

-- =====================================================================
-- B4. Storage bucket `plan-files` — đính kèm file kế hoạch (PDF…).
--     Path convention: `{plan_id}/{timestamp}-{filename}`.
--     Prefix policy `cbplan_` (KHÔNG dùng `cbmh_` để re-run storage.sql không xóa nhầm).
-- =====================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('plan-files', 'plan-files', false, 50 * 1024 * 1024, NULL)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public, file_size_limit = EXCLUDED.file_size_limit;

DROP POLICY IF EXISTS "cbplan_write"  ON storage.objects;
DROP POLICY IF EXISTS "cbplan_update" ON storage.objects;
DROP POLICY IF EXISTS "cbplan_delete" ON storage.objects;
DROP POLICY IF EXISTS "cbplan_read"   ON storage.objects;

-- Upload/replace/xóa: chỉ supervisor + admin (người tạo kế hoạch).
CREATE POLICY "cbplan_write"  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'plan-files' AND public.current_user_role() IN ('system_supervisor','admin'));
CREATE POLICY "cbplan_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'plan-files' AND public.current_user_role() IN ('system_supervisor','admin'));
CREATE POLICY "cbplan_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'plan-files' AND public.current_user_role() IN ('system_supervisor','admin'));

-- Đọc/tải: supervisor/admin (mọi file) HOẶC Lead đúng bucket của plan (join lead_tasks
-- qua plan_id = folder đầu path). Lead chỉ tải file kế hoạch được giao cho mình.
CREATE POLICY "cbplan_read" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'plan-files'
    AND (
      public.current_user_role() IN ('system_supervisor','admin')
      OR EXISTS (
        SELECT 1 FROM public.lead_tasks lt
        WHERE lt.id::text = split_part(storage.objects.name, '/', 1)
          AND (
            (public.current_user_role() = 'lead_media'   AND lt.assigned_lead IN ('lead_media','both'))
            OR (public.current_user_role() = 'lead_content' AND lt.assigned_lead IN ('lead_content','both'))
          )
      )
    )
  );

-- =====================================================================
-- B5. Realtime — để list/drawer auto-refresh đa user (Supervisor ↔ Lead).
--     Idempotent: chỉ ADD nếu chưa nằm trong publication.
-- =====================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='lead_tasks') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.lead_tasks;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='lead_task_comments') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.lead_task_comments;
  END IF;
END $$;
-- =====================================================================

-- =====================================================================
-- B6. (Tùy chọn) tạo user Lead Media.
--   Supabase Auth → Add user + metadata {name, role:'lead_media'} + password.
--   Trigger handle_new_auth_user tự insert public.users row (cần B1 trước).
-- =====================================================================

-- Verify (tùy chọn):
-- SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'users_role_check';
-- SELECT tablename, policyname, cmd FROM pg_policies
--   WHERE tablename = 'lead_tasks' ORDER BY policyname;
