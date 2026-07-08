-- =====================================================================
-- add-content-review-sla.sql — SLA Lead duyệt content + PIC self-checklist (2026-07-08)
--
-- Q2 — SLA duyệt: content task khi PIC "Gửi Lead Content duyệt"
--   (submitted_to_lead) trước đây treo vô hạn, không có hạn duyệt.
--   Thêm cột `lead_review_due` (timestamptz) — hạn Lead phải xử lý.
--   PIC set khi gửi (hoặc auto = giờ gửi + 24h). UI tô đỏ "Quá hạn duyệt"
--   khi past due & vẫn submitted_to_lead; Lead Inbox/Dashboard đếm.
--
-- Q3 — PIC tự add checklist: ngoài Quality Checklist 9 mục cố định,
--   PIC tự thêm/xóa mục checklist riêng theo task, lưu `pic_checklist`
--   (jsonb array [{label, done}]). Tách khỏi `quality_checklist`; KHÔNG
--   bắt buộc để gửi duyệt. Lead xem read-only.
--
-- Chạy SAU add-content-initiatives.sql. Idempotent — chạy lại được.
-- Không đụng RLS: dùng policy update assigned/lead sẵn có.
-- =====================================================================

ALTER TABLE public.content_tasks
  ADD COLUMN IF NOT EXISTS lead_review_due timestamptz,
  ADD COLUMN IF NOT EXISTS pic_checklist   jsonb DEFAULT '[]'::jsonb;

-- Index nhẹ để Lead lọc task quá hạn duyệt (submitted_to_lead + due < now).
CREATE INDEX IF NOT EXISTS idx_content_tasks_lead_review_due
  ON public.content_tasks (lead_review_due)
  WHERE status = 'submitted_to_lead';

SELECT 'add-content-review-sla.sql OK' AS result;
