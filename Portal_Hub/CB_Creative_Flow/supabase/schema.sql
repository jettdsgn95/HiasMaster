-- =====================================================================
-- CB Media Hub — Supabase Schema (Phase 1)
-- Run trong Supabase SQL Editor sau khi tạo project mới.
-- Migrate từ in-memory mock arrays trong production-board.js, database-orders.js,
-- delivery-log.js, user-management.js, ai-tools.js, chatbot.js.
--
-- Convention:
--   - Domain IDs (order_id, task_id, delivery_id, usage_id) giữ text format
--     để khớp với UI hiện tại (MEDIA-2026-NNNN, TASK-NNNN, ...). Phía Supabase
--     auth có user.id riêng (uuid) — link qua bảng users.
--   - timestamps dùng timestamptz, default now().
--   - enum dùng text + CHECK constraint để dễ extend (Settings module thêm
--     status mới mà không cần ALTER TYPE).
--   - RLS bật cuối file — KHÔNG enable trước khi migrate xong (sẽ block test).
-- =====================================================================

-- Extensions (Supabase đã sẵn có pgcrypto + uuid-ossp)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =====================================================================
-- USERS — link với auth.users của Supabase Auth
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.users (
  id              uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email           text UNIQUE NOT NULL,
  name            text NOT NULL,
  initials        text,
  title           text,
  role            text NOT NULL CHECK (role IN ('admin','account','design','editor','client')) DEFAULT 'client',
  avatar_url      text,
  phone           text,
  department      text,
  bio             text,
  status          text NOT NULL CHECK (status IN ('active','inactive','pending','suspended','archived')) DEFAULT 'active',
  last_login_at   timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_users_status ON public.users(status);

-- =====================================================================
-- ORDERS — request submitted by client/branch/department
-- Mirror shape của database-orders.js ORDERS[]
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.orders (
  order_id                          text PRIMARY KEY,
  -- Requester (snapshot — không nhất thiết FK vì client có thể submit qua public form)
  requester_id                      uuid REFERENCES public.users(id) ON DELETE SET NULL,
  requester_name                    text NOT NULL,
  requester_email                   text NOT NULL,
  requester_contact                 text,
  department                        text,
  -- Project core
  project_name                      text NOT NULL,
  project_purpose                   text,
  request_type                      text NOT NULL CHECK (request_type IN ('design','digital','video','motion','shoot','photo','ads','slide','other')),
  deliverable_type                  text[] DEFAULT ARRAY[]::text[],
  target_audience                   text[] DEFAULT ARRAY[]::text[],
  usage_channels                    text[] DEFAULT ARRAY[]::text[],
  size_ratio                        text,
  content_brief                     text,
  creative_direction                text,
  wording_required                  boolean DEFAULT false,
  source_link                       text,
  file_brief_url                    text,
  -- Priority + deadlines
  priority                          text NOT NULL CHECK (priority IN ('normal','urgent','critical')) DEFAULT 'normal',
  requested_deadline                date,
  actual_use_date                   date,
  urgent_reason                     text,
  -- Account workflow
  account_status                    text NOT NULL CHECK (account_status IN ('pending','checking','needinfo','confirmed','rejected')) DEFAULT 'pending',
  account_pic                       text,
  -- Production workflow (denormalized snapshot — chi tiết task trong bảng tasks)
  production_pic                    text,
  production_status                 text CHECK (production_status IN ('unassigned','pending','received','inprogress','review','revision','feedback_wait','feedback_fix','ready','delivered','completed','paused','cancelled')) DEFAULT 'unassigned',
  delivery_status                   text CHECK (delivery_status IN ('waiting','need_rev','ready','preview','client_wait','client_rev','final','rated','completed','reopened','cancelled')),
  internal_deadline                 timestamptz,
  internal_note                     text,
  progress                          int DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  content_responsibility_confirmed  boolean DEFAULT false,
  -- Delivery / rating
  preview_link                      text,
  final_delivery_link               text,
  delivery_date                     date,
  satisfaction_score                int CHECK (satisfaction_score IS NULL OR (satisfaction_score >= 1 AND satisfaction_score <= 5)),
  client_feedback                   text,
  -- Timestamps
  created_at                        timestamptz NOT NULL DEFAULT now(),
  last_updated                      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_orders_account_status ON public.orders(account_status);
CREATE INDEX IF NOT EXISTS idx_orders_production_status ON public.orders(production_status);
CREATE INDEX IF NOT EXISTS idx_orders_requester_id ON public.orders(requester_id);
CREATE INDEX IF NOT EXISTS idx_orders_account_pic ON public.orders(account_pic);
CREATE INDEX IF NOT EXISTS idx_orders_production_pic ON public.orders(production_pic);
CREATE INDEX IF NOT EXISTS idx_orders_requested_deadline ON public.orders(requested_deadline);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at DESC);

-- =====================================================================
-- TASKS — internal work item assigned to Media team
-- One Order → many Tasks. Tasks có thể standalone (is_standalone=true, order_id=null)
-- Mirror shape của production-board.js TASKS[]
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.tasks (
  task_id           text PRIMARY KEY,
  order_id          text REFERENCES public.orders(order_id) ON DELETE CASCADE,
  is_standalone     boolean NOT NULL DEFAULT false,
  project_name      text NOT NULL,
  task_type         text NOT NULL CHECK (task_type IN ('design','digital','video','motion','shoot','photo','ads','slide')),
  content           text,
  priority          text NOT NULL CHECK (priority IN ('normal','urgent','critical')) DEFAULT 'normal',
  assigned_to       text,                                                    -- snapshot tên PIC (text); link FK qua tasks.assigned_to_user_id nếu cần
  assigned_to_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  status            text NOT NULL CHECK (status IN ('pending','received','inprogress','review','revision','feedback_wait','feedback_fix','ready','delivered','completed','paused','cancelled')) DEFAULT 'pending',
  progress          int NOT NULL DEFAULT 20 CHECK (progress >= 0 AND progress <= 100),
  internal_deadline timestamptz,
  link_drive        text,
  preview_link      text,
  final_link        text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  last_update       timestamptz NOT NULL DEFAULT now(),
  completed_at      timestamptz,
  -- Sanity: standalone task không được có order_id
  CONSTRAINT tasks_standalone_consistency CHECK ((is_standalone = true AND order_id IS NULL) OR (is_standalone = false))
);
CREATE INDEX IF NOT EXISTS idx_tasks_order_id ON public.tasks(order_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON public.tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to_user_id ON public.tasks(assigned_to_user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_internal_deadline ON public.tasks(internal_deadline);

-- =====================================================================
-- TASK COMMENTS — comment thread với @mention + reply
-- Mirror shape của production-board.js task.comments[]
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.task_comments (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id           text NOT NULL REFERENCES public.tasks(task_id) ON DELETE CASCADE,
  author_user_id    uuid REFERENCES public.users(id) ON DELETE SET NULL,
  author            text NOT NULL,
  text              text NOT NULL,
  type              text NOT NULL CHECK (type IN ('internal','revision','feedback')) DEFAULT 'internal',
  mentions          text[] DEFAULT ARRAY[]::text[],
  reply_to          uuid REFERENCES public.task_comments(id) ON DELETE SET NULL,
  reply_to_author   text,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_task_comments_task_id ON public.task_comments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_reply_to ON public.task_comments(reply_to);
CREATE INDEX IF NOT EXISTS idx_task_comments_created_at ON public.task_comments(created_at);

-- =====================================================================
-- DELIVERIES — preview/final handoff to client
-- Mirror shape của delivery-log.js DELIVERIES[]
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.deliveries (
  delivery_id       text PRIMARY KEY,
  task_id           text REFERENCES public.tasks(task_id) ON DELETE SET NULL,
  order_id          text REFERENCES public.orders(order_id) ON DELETE CASCADE,
  delivery_status   text NOT NULL CHECK (delivery_status IN ('waiting','need_rev','ready','preview','client_wait','client_rev','final','rated','completed','reopened','cancelled')) DEFAULT 'waiting',
  preview_link      text,
  final_link        text,
  send_preview_at   timestamptz,
  send_final_at     timestamptz,
  client_rating     int CHECK (client_rating IS NULL OR (client_rating >= 1 AND client_rating <= 5)),
  client_feedback   text,
  checklist         jsonb DEFAULT '{}'::jsonb,                                -- {item_key: bool}
  account_pic       text,
  production_pic    text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_deliveries_order_id ON public.deliveries(order_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_task_id ON public.deliveries(task_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_status ON public.deliveries(delivery_status);

-- =====================================================================
-- AI USAGE LOG — track AI Tools generation runs
-- Mirror localStorage 'mh-ai-usage-log' + 'mh-ai-saved-outputs'
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.ai_usage_log (
  usage_id          text PRIMARY KEY,
  user_id           uuid REFERENCES public.users(id) ON DELETE SET NULL,
  tool_key          text NOT NULL,
  tool_name         text,
  input_summary     text,
  output_summary    text,
  output_full       text,
  model             text,
  tokens_used       int,
  feedback          text CHECK (feedback IS NULL OR feedback IN ('good','bad')),
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_usage_user_id ON public.ai_usage_log(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_created_at ON public.ai_usage_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_tool_key ON public.ai_usage_log(tool_key);

CREATE TABLE IF NOT EXISTS public.ai_saved_outputs (
  saved_id          text PRIMARY KEY,
  usage_id          text REFERENCES public.ai_usage_log(usage_id) ON DELETE SET NULL,
  order_id          text REFERENCES public.orders(order_id) ON DELETE SET NULL,
  task_id           text REFERENCES public.tasks(task_id) ON DELETE SET NULL,
  save_to           text NOT NULL,
  content           text NOT NULL,
  created_by        uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_saved_order_id ON public.ai_saved_outputs(order_id);
CREATE INDEX IF NOT EXISTS idx_ai_saved_task_id ON public.ai_saved_outputs(task_id);

-- =====================================================================
-- CHATBOT — message history + feedback
-- Mirror localStorage 'mh-chatbot-history' + 'mh-chatbot-feedback'
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.chatbot_messages (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid REFERENCES public.users(id) ON DELETE CASCADE,
  session_id        text,
  role              text NOT NULL CHECK (role IN ('user','assistant','system')),
  content           text NOT NULL,
  feedback          text CHECK (feedback IS NULL OR feedback IN ('good','bad')),
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_chatbot_user_id ON public.chatbot_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_chatbot_session_id ON public.chatbot_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_chatbot_created_at ON public.chatbot_messages(created_at DESC);

-- =====================================================================
-- SETTINGS — system config (singleton key-value)
-- Mirror localStorage 'mh-settings' + 'mh-settings-activity'
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.settings (
  key               text PRIMARY KEY,
  value             jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by        uuid REFERENCES public.users(id) ON DELETE SET NULL,
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.activity_log (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type       text NOT NULL CHECK (entity_type IN ('orders','tasks','deliveries','users','settings','ai_tools','chatbot')),
  entity_id         text,
  action            text NOT NULL,
  actor_user_id     uuid REFERENCES public.users(id) ON DELETE SET NULL,
  actor_name        text,
  details           jsonb DEFAULT '{}'::jsonb,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_activity_entity ON public.activity_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_actor ON public.activity_log(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_activity_created_at ON public.activity_log(created_at DESC);

-- =====================================================================
-- ORDER DRAFTS — Order Form autosave (server-side, cross-device)
-- Mirror localStorage 'mh-order-draft-v2'
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.order_drafts (
  user_id           uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  draft             jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- =====================================================================
-- TRIGGERS — auto-update timestamps
-- =====================================================================
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE OR REPLACE FUNCTION public.touch_last_updated()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.last_updated = now(); RETURN NEW; END;
$$;

CREATE OR REPLACE FUNCTION public.touch_last_update()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.last_update = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_users_updated_at ON public.users;
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON public.users
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_orders_last_updated ON public.orders;
CREATE TRIGGER trg_orders_last_updated BEFORE UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.touch_last_updated();

DROP TRIGGER IF EXISTS trg_tasks_last_update ON public.tasks;
CREATE TRIGGER trg_tasks_last_update BEFORE UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.touch_last_update();

DROP TRIGGER IF EXISTS trg_deliveries_updated_at ON public.deliveries;
CREATE TRIGGER trg_deliveries_updated_at BEFORE UPDATE ON public.deliveries
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_settings_updated_at ON public.settings;
CREATE TRIGGER trg_settings_updated_at BEFORE UPDATE ON public.settings
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_order_drafts_updated_at ON public.order_drafts;
CREATE TRIGGER trg_order_drafts_updated_at BEFORE UPDATE ON public.order_drafts
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =====================================================================
-- Auto-create public.users row khi Supabase Auth tạo user mới
-- =====================================================================
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.users (id, email, name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'client')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_on_auth_user_created ON auth.users;
CREATE TRIGGER trg_on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- =====================================================================
-- VIEWS — convenient denormalized snapshots
-- =====================================================================
CREATE OR REPLACE VIEW public.tasks_with_order AS
SELECT
  t.*,
  o.project_name AS order_project_name,
  o.requester_name AS order_requester_name,
  o.department AS order_department,
  o.requested_deadline AS order_requested_deadline
FROM public.tasks t
LEFT JOIN public.orders o ON o.order_id = t.order_id;

CREATE OR REPLACE VIEW public.orders_with_task_count AS
SELECT
  o.*,
  COALESCE(tc.task_count, 0) AS task_count,
  COALESCE(tc.tasks_completed, 0) AS tasks_completed
FROM public.orders o
LEFT JOIN (
  SELECT order_id,
         count(*)::int AS task_count,
         count(*) FILTER (WHERE status = 'completed')::int AS tasks_completed
  FROM public.tasks
  WHERE order_id IS NOT NULL
  GROUP BY order_id
) tc ON tc.order_id = o.order_id;

-- =====================================================================
-- ROW-LEVEL SECURITY (RLS)
-- ⚠️  CHỈ enable sau khi đã wire auth ở frontend xong (Turn 2+).
-- Enable sớm sẽ block mọi query khi chưa có auth context → demo gãy.
--
-- Để bật, uncomment block dưới + chạy lại:
--
-- ALTER TABLE public.users          ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.orders         ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.tasks          ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.task_comments  ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.deliveries     ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.ai_usage_log   ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.ai_saved_outputs ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.chatbot_messages ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.settings       ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.activity_log   ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.order_drafts   ENABLE ROW LEVEL SECURITY;
--
-- CREATE POLICY "users self read" ON public.users FOR SELECT USING (auth.uid() = id);
-- CREATE POLICY "users admin all" ON public.users FOR ALL USING (
--   EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
-- );
-- CREATE POLICY "orders staff read" ON public.orders FOR SELECT USING (
--   EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('admin','account','design','editor'))
--   OR requester_id = auth.uid()
-- );
-- CREATE POLICY "orders account write" ON public.orders FOR ALL USING (
--   EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('admin','account'))
-- );
-- CREATE POLICY "tasks internal only" ON public.tasks FOR ALL USING (
--   EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('admin','account','design','editor'))
-- );
-- CREATE POLICY "task_comments via task" ON public.task_comments FOR ALL USING (
--   EXISTS (SELECT 1 FROM public.tasks t JOIN public.users u ON u.id = auth.uid()
--           WHERE t.task_id = task_comments.task_id AND u.role IN ('admin','account','design','editor'))
-- );
-- CREATE POLICY "deliveries staff" ON public.deliveries FOR ALL USING (
--   EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('admin','account'))
-- );
-- CREATE POLICY "ai_usage self read" ON public.ai_usage_log FOR SELECT USING (user_id = auth.uid());
-- CREATE POLICY "ai_usage admin all" ON public.ai_usage_log FOR ALL USING (
--   EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
-- );
-- CREATE POLICY "settings admin only" ON public.settings FOR ALL USING (
--   EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
-- );
-- CREATE POLICY "order_drafts self" ON public.order_drafts FOR ALL USING (user_id = auth.uid());
-- =====================================================================

-- =====================================================================
-- End of schema.sql
-- =====================================================================
