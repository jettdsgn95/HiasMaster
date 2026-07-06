-- =====================================================================
-- add-content-self-initiative.sql — Content TỰ ĐỀ XUẤT task (2026-07-06)
--
-- Bối cảnh: role `content` cần chủ động tạo content task (VD: post cần
-- Media thiết kế) ngay tại Content Wording (content-workbench.html),
-- không chờ Lead gán. Flow 1 GATE duy nhất:
--   content tạo (source='content_initiated', PIC = chính mình, viết luôn)
--   → Gửi Lead Content duyệt NỘI DUNG (submitted_to_lead)
--   → Lead duyệt (lead_approved)
--   → PIC bấm "Gửi sang Media" → order nội bộ MEDIA-…-CT (đã có sẵn,
--     cần add-content-to-media-order.sql cho RLS content INSERT order).
--
-- File này chỉ bổ sung RLS: content INSERT content_tasks — GIỚI HẠN
-- source='content_initiated' + assigned_pic = tên chính mình (không tạo
-- hộ người khác, không giả nguồn client_order/plan).
--
-- Chạy SAU add-content-initiatives.sql. Idempotent — chạy lại được.
-- =====================================================================

DROP POLICY IF EXISTS "content_tasks content insert own_initiative" ON public.content_tasks;
CREATE POLICY "content_tasks content insert own_initiative" ON public.content_tasks
  FOR INSERT WITH CHECK (
    public.current_user_role() = 'content'
    AND source = 'content_initiated'
    AND assigned_pic = (SELECT name FROM public.users WHERE id = auth.uid())
  );

-- Ghi chú:
-- · content_task_comments đã có policy "team insert" (lead_content, content)
--   trong add-content-initiatives.sql — không cần thêm.
-- · UPDATE tiếp theo (viết nội dung, gửi Lead) dùng policy
--   "content_tasks content update_assigned" sẵn có (assigned_pic = mình).
-- · Lead duyệt qua policy "content_tasks lead all" sẵn có.

SELECT 'add-content-self-initiative.sql OK' AS result;
