-- =====================================================================
-- add-content-task-code.sql — MÃ TASK cho Content Task (2026-07-20)
--
-- Bối cảnh: task nội bộ team Content trước đây chỉ có `id` (uuid) — không
-- đọc/không nhắc được khi trao đổi ("task nào?"). Thêm MÃ ngắn dễ kiểm soát:
--
--     CT-2026-001, CT-2026-002, …
--
-- Thiết kế: sinh mã ở DB bằng SEQUENCE + trigger BEFORE INSERT, KHÔNG sinh
-- ở frontend. Lý do:
--   · Content task được tạo ở 4 chỗ (PIC tự đề xuất · Lead tạo task nội bộ ·
--     task con của Plan · tách task từ Ads Order) → trigger phủ hết, không
--     phải sửa từng chỗ và không sợ chỗ nào quên.
--   · Sinh ở client (đếm max rồi +1) sẽ ĐUA khi 2 người tạo cùng lúc → trùng mã.
--   · Sequence là atomic, không bao giờ trùng kể cả insert đồng thời.
--
-- Ghi chú: sequence KHÔNG reset theo năm (đơn giản + luôn duy nhất). Năm nằm
-- trong mã nên vẫn đọc được thời điểm tạo; số thứ tự chạy liên tục qua các năm.
--
-- Chạy SAU add-content-initiatives.sql. Idempotent — chạy lại nhiều lần OK.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Cột + sequence
-- ---------------------------------------------------------------------
ALTER TABLE public.content_tasks ADD COLUMN IF NOT EXISTS task_code text;

CREATE SEQUENCE IF NOT EXISTS public.content_task_code_seq AS bigint START 1;

-- ---------------------------------------------------------------------
-- 2. Trigger sinh mã khi INSERT (chỉ khi chưa có mã)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_content_task_code()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.task_code IS NULL OR btrim(NEW.task_code) = '' THEN
    NEW.task_code := 'CT-' || to_char(now(), 'YYYY') || '-'
                     || lpad(nextval('public.content_task_code_seq')::text, 3, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_content_tasks_code ON public.content_tasks;
CREATE TRIGGER trg_content_tasks_code
BEFORE INSERT ON public.content_tasks
FOR EACH ROW EXECUTE FUNCTION public.set_content_task_code();

-- ---------------------------------------------------------------------
-- 3. Backfill task cũ — đánh mã theo đúng thứ tự tạo (created_at tăng dần)
--    để mã nhỏ = task cũ hơn.
-- ---------------------------------------------------------------------
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT id, created_at
    FROM public.content_tasks
    WHERE task_code IS NULL OR btrim(task_code) = ''
    ORDER BY created_at NULLS LAST, id
  LOOP
    UPDATE public.content_tasks
       SET task_code = 'CT-' || to_char(COALESCE(r.created_at, now()), 'YYYY') || '-'
                       || lpad(nextval('public.content_task_code_seq')::text, 3, '0')
     WHERE id = r.id;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- 4. Ràng buộc duy nhất + index tra cứu theo mã
--    (partial index: bỏ qua NULL để không chặn row lỗi trigger)
-- ---------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS idx_content_tasks_code
  ON public.content_tasks(task_code)
  WHERE task_code IS NOT NULL;

-- KHÔNG đụng RLS: task_code chỉ là cột hiển thị, policy sẵn có phủ đủ.

-- Verify:
-- SELECT task_code, title, status, assigned_pic FROM public.content_tasks ORDER BY task_code;
-- SELECT last_value FROM public.content_task_code_seq;

SELECT 'add-content-task-code.sql OK' AS result,
       (SELECT count(*) FROM public.content_tasks WHERE task_code IS NOT NULL) AS da_co_ma;
