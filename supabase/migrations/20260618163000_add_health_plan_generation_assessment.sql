ALTER TABLE public.vyva_user_health_plans
  ADD COLUMN IF NOT EXISTS generation_confidence TEXT NOT NULL DEFAULT 'medium';

ALTER TABLE public.vyva_user_health_plans
  DROP CONSTRAINT IF EXISTS vyva_user_health_plans_generation_confidence_check;

ALTER TABLE public.vyva_user_health_plans
  ADD CONSTRAINT vyva_user_health_plans_generation_confidence_check
  CHECK (generation_confidence IN ('high', 'medium', 'low'));

ALTER TABLE public.vyva_user_health_plans
  ADD COLUMN IF NOT EXISTS generation_assessment_json JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.vyva_user_health_plan_revisions
  ADD COLUMN IF NOT EXISTS generation_confidence TEXT NOT NULL DEFAULT 'medium';

ALTER TABLE public.vyva_user_health_plan_revisions
  DROP CONSTRAINT IF EXISTS vyva_user_health_plan_revisions_generation_confidence_check;

ALTER TABLE public.vyva_user_health_plan_revisions
  ADD CONSTRAINT vyva_user_health_plan_revisions_generation_confidence_check
  CHECK (generation_confidence IN ('high', 'medium', 'low'));

ALTER TABLE public.vyva_user_health_plan_revisions
  ADD COLUMN IF NOT EXISTS generation_assessment_json JSONB NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.vyva_user_health_plans
SET
  generation_confidence = COALESCE(NULLIF(generation_confidence, ''), 'medium'),
  generation_assessment_json = COALESCE(generation_assessment_json, '{}'::jsonb)
WHERE generation_confidence IS NULL
   OR generation_confidence = ''
   OR generation_assessment_json IS NULL;

UPDATE public.vyva_user_health_plan_revisions
SET
  generation_confidence = COALESCE(NULLIF(generation_confidence, ''), 'medium'),
  generation_assessment_json = COALESCE(generation_assessment_json, '{}'::jsonb)
WHERE generation_confidence IS NULL
   OR generation_confidence = ''
   OR generation_assessment_json IS NULL;
