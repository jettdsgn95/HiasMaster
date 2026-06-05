-- add-brief-wording-fields.sql — Phase 2: cổng bắt buộc Content Wording trước Confirm Brief.
-- Idempotent: chạy lại nhiều lần OK.
--
-- BẮT BUỘC chạy nếu dùng Supabase: vì account_status thêm giá trị mới 'wording'
-- (CHECK constraint cũ sẽ chặn → transfer-to-wording không persist được nếu chưa chạy migration này).

-- 1) Các cột brief wording
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS brief_wording_status     text DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS brief_wording_round      integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS brief_wording_pic        text,
  ADD COLUMN IF NOT EXISTS wording_approved_at      timestamptz,
  ADD COLUMN IF NOT EXISTS wording_last_updated_at  timestamptz;

COMMENT ON COLUMN public.orders.brief_wording_status IS 'Trạng thái Content Wording: none/assigned/in_progress/submitted_to_account/account_revision/sent_to_client/client_feedback/client_approved/completed.';

-- 2) Mở rộng CHECK của account_status để chấp nhận ''wording'' (drop constraint cũ theo tên thực + add lại).
DO $$
DECLARE cname text;
BEGIN
  FOR cname IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace ns ON ns.oid = rel.relnamespace
    WHERE ns.nspname = 'public' AND rel.relname = 'orders' AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%account_status%'
  LOOP
    EXECUTE format('ALTER TABLE public.orders DROP CONSTRAINT %I', cname);
  END LOOP;
  ALTER TABLE public.orders
    ADD CONSTRAINT orders_account_status_check
    CHECK (account_status IN ('pending','checking','needinfo','wording','confirmed','rejected'));
END$$;

-- 3) CHECK cho brief_wording_status (idempotent).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_brief_wording_status_check') THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_brief_wording_status_check
      CHECK (brief_wording_status IN ('none','assigned','in_progress','submitted_to_account','account_revision','sent_to_client','client_feedback','client_approved','completed'));
  END IF;
END$$;

-- 4) Grandfather: các order ĐÃ confirmed / ĐÃ push trước Phase 2 → coi như wording đã hoàn tất,
--    để cổng mới KHÔNG chặn flow đang chạy. Order mới/pending vẫn giữ 'none' → bắt buộc qua Content Wording.
UPDATE public.orders
SET brief_wording_status = 'completed'
WHERE COALESCE(brief_wording_status, 'none') = 'none'
  AND (account_status = 'confirmed'
       OR (production_status IS NOT NULL AND production_status <> 'unassigned'));
