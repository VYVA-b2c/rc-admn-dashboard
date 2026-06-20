ALTER TABLE public.vyva_user_health_plans
  ADD COLUMN IF NOT EXISTS change_summary_json JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.vyva_user_health_plan_revisions
  ADD COLUMN IF NOT EXISTS change_summary_json JSONB NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.vyva_user_health_plans
SET change_summary_json = jsonb_build_object(
  'change_kind', 'baseline',
  'action_type', COALESCE(NULLIF(last_action_type, ''), CASE WHEN review_status = 'reviewed' THEN 'reviewed' ELSE 'generated' END),
  'changed_sections', jsonb_build_array('summary', 'goals', 'daily_support', 'monitoring', 'escalation', 'caregiver_guidance'),
  'signals_added', '[]'::jsonb,
  'signals_removed', '[]'::jsonb,
  'review_transition', NULL,
  'generation_confidence_transition', NULL,
  'entries', jsonb_build_array(jsonb_build_object('code', 'baseline_created'))
)
WHERE change_summary_json = '{}'::jsonb;

UPDATE public.vyva_user_health_plan_revisions
SET change_summary_json = jsonb_build_object(
  'change_kind', 'baseline',
  'action_type', COALESCE(NULLIF(action_type, ''), CASE WHEN review_status = 'reviewed' THEN 'reviewed' ELSE 'generated' END),
  'changed_sections', jsonb_build_array('summary', 'goals', 'daily_support', 'monitoring', 'escalation', 'caregiver_guidance'),
  'signals_added', '[]'::jsonb,
  'signals_removed', '[]'::jsonb,
  'review_transition', NULL,
  'generation_confidence_transition', NULL,
  'entries', jsonb_build_array(jsonb_build_object('code', 'baseline_created'))
)
WHERE change_summary_json = '{}'::jsonb;
