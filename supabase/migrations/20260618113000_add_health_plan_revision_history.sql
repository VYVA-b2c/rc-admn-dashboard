ALTER TABLE public.vyva_user_health_plans
  ADD COLUMN IF NOT EXISTS current_version INTEGER NOT NULL DEFAULT 1;

ALTER TABLE public.vyva_user_health_plans
  DROP CONSTRAINT IF EXISTS vyva_user_health_plans_current_version_check;

ALTER TABLE public.vyva_user_health_plans
  ADD CONSTRAINT vyva_user_health_plans_current_version_check
  CHECK (current_version >= 1);

ALTER TABLE public.vyva_user_health_plans
  ADD COLUMN IF NOT EXISTS last_action_type TEXT NOT NULL DEFAULT 'generated';

ALTER TABLE public.vyva_user_health_plans
  DROP CONSTRAINT IF EXISTS vyva_user_health_plans_last_action_type_check;

ALTER TABLE public.vyva_user_health_plans
  ADD CONSTRAINT vyva_user_health_plans_last_action_type_check
  CHECK (last_action_type IN ('generated', 'regenerated', 'edited', 'reviewed'));

ALTER TABLE public.vyva_user_health_plans
  ADD COLUMN IF NOT EXISTS last_action_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE public.vyva_user_health_plans
  ADD COLUMN IF NOT EXISTS last_actor_user_id TEXT;

ALTER TABLE public.vyva_user_health_plans
  ADD COLUMN IF NOT EXISTS last_actor_email TEXT;

UPDATE public.vyva_user_health_plans
SET
  current_version = COALESCE(NULLIF(current_version, 0), 1),
  last_action_type = CASE
    WHEN review_status = 'reviewed' THEN 'reviewed'
    ELSE COALESCE(NULLIF(last_action_type, ''), 'generated')
  END,
  last_action_at = COALESCE(last_action_at, reviewed_at, updated_at, generated_at, created_at, now()),
  last_actor_user_id = COALESCE(NULLIF(last_actor_user_id, ''), reviewed_by_user_id, generated_by_user_id),
  last_actor_email = COALESCE(NULLIF(last_actor_email, ''), reviewed_by_email)
WHERE current_version IS NULL
   OR current_version < 1
   OR last_action_type IS NULL
   OR last_action_type = ''
   OR last_action_at IS NULL;

CREATE TABLE IF NOT EXISTS public.vyva_user_health_plan_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  health_plan_id UUID NOT NULL REFERENCES public.vyva_user_health_plans(id) ON DELETE CASCADE,
  vyva_user_id UUID NOT NULL REFERENCES public.vyva_users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL CHECK (version_number >= 1),
  action_type TEXT NOT NULL CHECK (action_type IN ('generated', 'regenerated', 'edited', 'reviewed')),
  actor_user_id TEXT,
  actor_email TEXT,
  language TEXT NOT NULL DEFAULT 'en' CHECK (language IN ('en', 'de', 'es')),
  status TEXT NOT NULL DEFAULT 'current' CHECK (status IN ('current')),
  review_status TEXT NOT NULL DEFAULT 'draft' CHECK (review_status IN ('draft', 'reviewed')),
  escalation_grade TEXT NOT NULL DEFAULT 'routine' CHECK (escalation_grade IN ('routine', 'heightened', 'urgent')),
  review_required BOOLEAN NOT NULL DEFAULT false,
  review_window TEXT NOT NULL DEFAULT 'ongoing' CHECK (review_window IN ('today', 'this_week', 'ongoing')),
  review_summary TEXT,
  review_reasons_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  summary_text TEXT,
  summary_signal_ids_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  goals_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  daily_support_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  monitoring_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  escalation_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  caregiver_guidance_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  source_signals_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  data_quality_gaps_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  completed_improvement_actions_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  feedback_entries_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  inferred_feedback_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  recommendation_learning_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  quality_snapshot_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  generator_provider TEXT,
  generator_model TEXT,
  generator_version TEXT,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  generated_by_user_id TEXT,
  review_note TEXT,
  review_checklist_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  recommendation_review_decisions_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  reviewed_at TIMESTAMPTZ,
  reviewed_by_user_id TEXT,
  reviewed_by_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (health_plan_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_vyva_user_health_plan_revisions_plan_id
  ON public.vyva_user_health_plan_revisions (health_plan_id, version_number DESC);

CREATE INDEX IF NOT EXISTS idx_vyva_user_health_plan_revisions_user_id
  ON public.vyva_user_health_plan_revisions (vyva_user_id, version_number DESC);

INSERT INTO public.vyva_user_health_plan_revisions (
  health_plan_id,
  vyva_user_id,
  organization_id,
  version_number,
  action_type,
  actor_user_id,
  actor_email,
  language,
  status,
  review_status,
  escalation_grade,
  review_required,
  review_window,
  review_summary,
  review_reasons_json,
  summary_text,
  summary_signal_ids_json,
  goals_json,
  daily_support_json,
  monitoring_json,
  escalation_json,
  caregiver_guidance_json,
  source_signals_json,
  data_quality_gaps_json,
  completed_improvement_actions_json,
  feedback_entries_json,
  inferred_feedback_json,
  recommendation_learning_json,
  quality_snapshot_json,
  generator_provider,
  generator_model,
  generator_version,
  generated_at,
  generated_by_user_id,
  review_note,
  review_checklist_json,
  recommendation_review_decisions_json,
  reviewed_at,
  reviewed_by_user_id,
  reviewed_by_email,
  created_at
)
SELECT
  hp.id,
  hp.vyva_user_id,
  hp.organization_id,
  1,
  CASE WHEN hp.review_status = 'reviewed' THEN 'reviewed' ELSE 'generated' END,
  COALESCE(hp.reviewed_by_user_id, hp.generated_by_user_id),
  hp.reviewed_by_email,
  hp.language,
  hp.status,
  hp.review_status,
  hp.escalation_grade,
  hp.review_required,
  hp.review_window,
  hp.review_summary,
  hp.review_reasons_json,
  hp.summary_text,
  hp.summary_signal_ids_json,
  hp.goals_json,
  hp.daily_support_json,
  hp.monitoring_json,
  hp.escalation_json,
  hp.caregiver_guidance_json,
  hp.source_signals_json,
  hp.data_quality_gaps_json,
  hp.completed_improvement_actions_json,
  hp.feedback_entries_json,
  hp.inferred_feedback_json,
  hp.recommendation_learning_json,
  hp.quality_snapshot_json,
  hp.generator_provider,
  hp.generator_model,
  hp.generator_version,
  hp.generated_at,
  hp.generated_by_user_id,
  hp.review_note,
  hp.review_checklist_json,
  hp.recommendation_review_decisions_json,
  hp.reviewed_at,
  hp.reviewed_by_user_id,
  hp.reviewed_by_email,
  COALESCE(hp.reviewed_at, hp.updated_at, hp.generated_at, hp.created_at, now())
FROM public.vyva_user_health_plans hp
WHERE NOT EXISTS (
  SELECT 1
  FROM public.vyva_user_health_plan_revisions rev
  WHERE rev.health_plan_id = hp.id
);
