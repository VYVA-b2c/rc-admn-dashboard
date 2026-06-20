ALTER TABLE public.vyva_user_health_plans
  ADD COLUMN IF NOT EXISTS context_snapshot_json JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.vyva_user_health_plan_revisions
  ADD COLUMN IF NOT EXISTS context_snapshot_json JSONB NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.vyva_user_health_plans
SET context_snapshot_json = jsonb_strip_nulls(
  jsonb_build_object(
    'snapshot_version', 'health-plan-context-v1',
    'captured_at', COALESCE(generated_at, reviewed_at, updated_at, created_at, now()),
    'language', language,
    'source_signals', COALESCE(source_signals_json, '[]'::jsonb),
    'generation_assessment', COALESCE(generation_assessment_json, '{}'::jsonb)
  )
)
WHERE context_snapshot_json = '{}'::jsonb
   OR context_snapshot_json IS NULL;

UPDATE public.vyva_user_health_plan_revisions
SET context_snapshot_json = jsonb_strip_nulls(
  jsonb_build_object(
    'snapshot_version', 'health-plan-context-v1',
    'captured_at', COALESCE(generated_at, reviewed_at, created_at, now()),
    'language', language,
    'source_signals', COALESCE(source_signals_json, '[]'::jsonb),
    'generation_assessment', COALESCE(generation_assessment_json, '{}'::jsonb)
  )
)
WHERE context_snapshot_json = '{}'::jsonb
   OR context_snapshot_json IS NULL;
