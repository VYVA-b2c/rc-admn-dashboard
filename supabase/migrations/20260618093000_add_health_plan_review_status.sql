ALTER TABLE public.vyva_user_health_plans
  ADD COLUMN IF NOT EXISTS review_status TEXT NOT NULL DEFAULT 'draft';

ALTER TABLE public.vyva_user_health_plans
  DROP CONSTRAINT IF EXISTS vyva_user_health_plans_review_status_check;

ALTER TABLE public.vyva_user_health_plans
  ADD CONSTRAINT vyva_user_health_plans_review_status_check
  CHECK (review_status IN ('draft', 'reviewed'));

ALTER TABLE public.vyva_user_health_plans
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

ALTER TABLE public.vyva_user_health_plans
  ADD COLUMN IF NOT EXISTS reviewed_by_user_id TEXT;

ALTER TABLE public.vyva_user_health_plans
  ADD COLUMN IF NOT EXISTS reviewed_by_email TEXT;

UPDATE public.vyva_user_health_plans
SET review_status = COALESCE(NULLIF(review_status, ''), 'draft')
WHERE review_status IS NULL OR review_status = '';
