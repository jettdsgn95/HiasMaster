-- add-brief-wording-workspace-fields.sql — Phase 3: Content Wording workspace (order-level fields).
-- Idempotent. KHÔNG bắt buộc để app chạy: content-workbench.js có fallback localStorage,
-- nhưng nên chạy để wording persist trên Supabase (đồng bộ đa thiết bị) + Order Drawer thấy bản wording.
-- Yêu cầu: đã chạy add-brief-wording-fields.sql (Phase 2) trước.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS wording_brief            text,
  ADD COLUMN IF NOT EXISTS wording_objective        text,
  ADD COLUMN IF NOT EXISTS wording_core_message     text,
  ADD COLUMN IF NOT EXISTS wording_required_info    text,
  ADD COLUMN IF NOT EXISTS wording_tone_style       text,
  ADD COLUMN IF NOT EXISTS wording_cta              text,
  ADD COLUMN IF NOT EXISTS wording_production_note  text,
  ADD COLUMN IF NOT EXISTS wording_content_checklist text,
  ADD COLUMN IF NOT EXISTS wording_account_note     text,
  ADD COLUMN IF NOT EXISTS wording_submitted_by     text,
  ADD COLUMN IF NOT EXISTS wording_submitted_at     timestamptz,
  ADD COLUMN IF NOT EXISTS wording_client_source_link text,
  ADD COLUMN IF NOT EXISTS wording_doc_link         text,
  ADD COLUMN IF NOT EXISTS wording_reference_link   text,
  ADD COLUMN IF NOT EXISTS wording_internal_link    text;

COMMENT ON COLUMN public.orders.wording_content_checklist IS 'JSON string các mục checklist trách nhiệm Content (Phase 3).';
