ALTER TABLE public.vyva_user_health_plans
  ADD COLUMN IF NOT EXISTS automated_review_json JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.vyva_user_health_plans
  ADD COLUMN IF NOT EXISTS automated_reviewed_at TIMESTAMPTZ;

ALTER TABLE public.vyva_user_health_plan_revisions
  ADD COLUMN IF NOT EXISTS automated_review_json JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.vyva_user_health_plan_revisions
  ADD COLUMN IF NOT EXISTS automated_reviewed_at TIMESTAMPTZ;

UPDATE public.vyva_user_health_plans
SET
  automated_review_json = COALESCE(automated_review_json, '{}'::jsonb),
  automated_reviewed_at = COALESCE(automated_reviewed_at, reviewed_at, generated_at)
WHERE automated_review_json IS NULL
   OR automated_reviewed_at IS NULL;

UPDATE public.vyva_user_health_plan_revisions
SET
  automated_review_json = COALESCE(automated_review_json, '{}'::jsonb),
  automated_reviewed_at = COALESCE(automated_reviewed_at, reviewed_at, generated_at)
WHERE automated_review_json IS NULL
   OR automated_reviewed_at IS NULL;
