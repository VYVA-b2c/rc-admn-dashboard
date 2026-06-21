ALTER TABLE public.vyva_user_health_plans
  ADD COLUMN IF NOT EXISTS data_quality_gaps_json JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.vyva_user_health_plans
  ADD COLUMN IF NOT EXISTS summary_signal_ids_json JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.vyva_user_health_plans
  ADD COLUMN IF NOT EXISTS completed_improvement_actions_json JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.vyva_user_health_plans
  ADD COLUMN IF NOT EXISTS inferred_feedback_json JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.vyva_user_health_plans
  ADD COLUMN IF NOT EXISTS recommendation_learning_json JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.vyva_user_health_plans
  ADD COLUMN IF NOT EXISTS feedback_entries_json JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.vyva_user_health_plans
  ADD COLUMN IF NOT EXISTS escalation_grade TEXT NOT NULL DEFAULT 'routine';

ALTER TABLE public.vyva_user_health_plans
  ADD COLUMN IF NOT EXISTS review_required BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.vyva_user_health_plans
  ADD COLUMN IF NOT EXISTS review_window TEXT NOT NULL DEFAULT 'ongoing';

ALTER TABLE public.vyva_user_health_plans
  ADD COLUMN IF NOT EXISTS review_summary TEXT;

ALTER TABLE public.vyva_user_health_plans
  ADD COLUMN IF NOT EXISTS review_reasons_json JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.vyva_user_health_plans
  ADD COLUMN IF NOT EXISTS review_note TEXT;

ALTER TABLE public.vyva_user_health_plans
  ADD COLUMN IF NOT EXISTS review_checklist_json JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.vyva_user_health_plans
  ADD COLUMN IF NOT EXISTS recommendation_review_decisions_json JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.vyva_user_health_plans
  ADD COLUMN IF NOT EXISTS quality_snapshot_json JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.vyva_user_health_plans
  DROP CONSTRAINT IF EXISTS vyva_user_health_plans_escalation_grade_check;

ALTER TABLE public.vyva_user_health_plans
  ADD CONSTRAINT vyva_user_health_plans_escalation_grade_check
  CHECK (escalation_grade IN ('routine', 'heightened', 'urgent'));

ALTER TABLE public.vyva_user_health_plans
  DROP CONSTRAINT IF EXISTS vyva_user_health_plans_review_window_check;

ALTER TABLE public.vyva_user_health_plans
  ADD CONSTRAINT vyva_user_health_plans_review_window_check
  CHECK (review_window IN ('today', 'this_week', 'ongoing'));

ALTER TABLE public.vyva_user_health_plan_revisions
  ADD COLUMN IF NOT EXISTS data_quality_gaps_json JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.vyva_user_health_plan_revisions
  ADD COLUMN IF NOT EXISTS summary_signal_ids_json JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.vyva_user_health_plan_revisions
  ADD COLUMN IF NOT EXISTS completed_improvement_actions_json JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.vyva_user_health_plan_revisions
  ADD COLUMN IF NOT EXISTS inferred_feedback_json JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.vyva_user_health_plan_revisions
  ADD COLUMN IF NOT EXISTS recommendation_learning_json JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.vyva_user_health_plan_revisions
  ADD COLUMN IF NOT EXISTS feedback_entries_json JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.vyva_user_health_plan_revisions
  ADD COLUMN IF NOT EXISTS escalation_grade TEXT NOT NULL DEFAULT 'routine';

ALTER TABLE public.vyva_user_health_plan_revisions
  ADD COLUMN IF NOT EXISTS review_required BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.vyva_user_health_plan_revisions
  ADD COLUMN IF NOT EXISTS review_window TEXT NOT NULL DEFAULT 'ongoing';

ALTER TABLE public.vyva_user_health_plan_revisions
  ADD COLUMN IF NOT EXISTS review_summary TEXT;

ALTER TABLE public.vyva_user_health_plan_revisions
  ADD COLUMN IF NOT EXISTS review_reasons_json JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.vyva_user_health_plan_revisions
  ADD COLUMN IF NOT EXISTS review_note TEXT;

ALTER TABLE public.vyva_user_health_plan_revisions
  ADD COLUMN IF NOT EXISTS review_checklist_json JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.vyva_user_health_plan_revisions
  ADD COLUMN IF NOT EXISTS recommendation_review_decisions_json JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.vyva_user_health_plan_revisions
  ADD COLUMN IF NOT EXISTS quality_snapshot_json JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.vyva_user_health_plan_revisions
  DROP CONSTRAINT IF EXISTS vyva_user_health_plan_revisions_escalation_grade_check;

ALTER TABLE public.vyva_user_health_plan_revisions
  ADD CONSTRAINT vyva_user_health_plan_revisions_escalation_grade_check
  CHECK (escalation_grade IN ('routine', 'heightened', 'urgent'));

ALTER TABLE public.vyva_user_health_plan_revisions
  DROP CONSTRAINT IF EXISTS vyva_user_health_plan_revisions_review_window_check;

ALTER TABLE public.vyva_user_health_plan_revisions
  ADD CONSTRAINT vyva_user_health_plan_revisions_review_window_check
  CHECK (review_window IN ('today', 'this_week', 'ongoing'));
