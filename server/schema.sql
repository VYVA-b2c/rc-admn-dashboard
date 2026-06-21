CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM ('admin', 'operator');
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  country TEXT,
  default_language TEXT NOT NULL DEFAULT 'de' CHECK (default_language IN ('en', 'de', 'es')),
  timezone TEXT NOT NULL DEFAULT 'Europe/Berlin',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.organizations (slug, name, country, default_language, timezone)
VALUES
  ('red-cross-leipzig', 'Red Cross Leipzig', 'Germany', 'de', 'Europe/Berlin'),
  ('red-cross-zamora', 'Red Cross Zamora', 'Spain', 'es', 'Europe/Madrid')
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  country = EXCLUDED.country,
  default_language = EXCLUDED.default_language,
  timezone = EXCLUDED.timezone,
  active = true,
  updated_at = now();

CREATE OR REPLACE FUNCTION public.resolve_vyva_user_organization_id(user_country TEXT, user_phone TEXT)
RETURNS UUID AS $$
DECLARE
  target_slug TEXT := 'red-cross-leipzig';
  target_organization_id UUID;
BEGIN
  SELECT id INTO target_organization_id
  FROM public.organizations
  WHERE slug = target_slug AND active = true
  LIMIT 1;

  IF target_organization_id IS NULL THEN
    SELECT id INTO target_organization_id
    FROM public.organizations
    WHERE slug = 'red-cross-leipzig'
    LIMIT 1;
  END IF;

  RETURN target_organization_id;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION public.set_vyva_user_organization_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.organization_id IS NULL THEN
    NEW.organization_id := public.resolve_vyva_user_organization_id(NEW.country, NEW.phone);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL UNIQUE,
  organization_id UUID REFERENCES public.organizations(id),
  is_platform_admin BOOLEAN NOT NULL DEFAULT false,
  full_name TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  organization_id UUID REFERENCES public.organizations(id),
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);

CREATE TABLE IF NOT EXISTS public.vyva_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT,
  city TEXT,
  street TEXT,
  house_number TEXT,
  post_code TEXT,
  country TEXT DEFAULT 'Germany',
  timezone TEXT DEFAULT 'Europe/Berlin',
  date_of_birth DATE,
  gender TEXT,
  language TEXT DEFAULT 'de',
  living_context TEXT CHECK (living_context IN ('alone', 'partner', 'family')),
  photo_url TEXT,
  emergency_notes TEXT,
  external_user_id TEXT,
  external_source TEXT NOT NULL DEFAULT 'local',
  conversation_id TEXT,
  transcript TEXT,
  call_duration INTEGER,
  call_timestamp TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.vyva_users
  ADD COLUMN IF NOT EXISTS living_context TEXT CHECK (living_context IN ('alone', 'partner', 'family'));

CREATE TABLE IF NOT EXISTS public.vyva_user_consent (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vyva_user_id UUID NOT NULL REFERENCES public.vyva_users(id) ON DELETE CASCADE,
  consent_given BOOLEAN NOT NULL DEFAULT false,
  caretaker_consent BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.vyva_user_health (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vyva_user_id UUID NOT NULL REFERENCES public.vyva_users(id) ON DELETE CASCADE,
  health_conditions TEXT[],
  mobility_needs TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.vyva_user_medications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vyva_user_id UUID NOT NULL REFERENCES public.vyva_users(id) ON DELETE CASCADE,
  medication_name TEXT NOT NULL,
  purpose TEXT,
  dosage TEXT,
  frequency TEXT,
  reminders_enabled BOOLEAN NOT NULL DEFAULT true,
  schedule_times TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.vyva_user_medications
  ADD COLUMN IF NOT EXISTS reminders_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS frequency TEXT;

CREATE TABLE IF NOT EXISTS public.vyva_user_health_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vyva_user_id UUID NOT NULL UNIQUE REFERENCES public.vyva_users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  current_version INTEGER NOT NULL DEFAULT 1 CHECK (current_version >= 1),
  last_action_type TEXT NOT NULL DEFAULT 'generated' CHECK (last_action_type IN ('generated', 'regenerated', 'edited', 'reviewed')),
  last_action_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_actor_user_id TEXT,
  last_actor_email TEXT,
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
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vyva_user_health_plans_org_id
  ON public.vyva_user_health_plans (organization_id);

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

CREATE TABLE IF NOT EXISTS public.vyva_user_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vyva_user_id UUID NOT NULL UNIQUE REFERENCES public.vyva_users(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT false,
  frequency TEXT,
  preferred_time TEXT,
  paused_until TIMESTAMPTZ,
  pause_reason TEXT,
  pause_source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.vyva_user_brain_coach (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vyva_user_id UUID NOT NULL UNIQUE REFERENCES public.vyva_users(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT false,
  frequency TEXT,
  preferred_time TEXT,
  paused_until TIMESTAMPTZ,
  pause_reason TEXT,
  pause_source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.vyva_user_caregivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vyva_user_id UUID NOT NULL REFERENCES public.vyva_users(id) ON DELETE CASCADE,
  caretaker_name TEXT,
  caretaker_phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sensor_type_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type_key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  is_custom BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.vyva_user_sensors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vyva_user_id UUID NOT NULL REFERENCES public.vyva_users(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  sensor_type TEXT NOT NULL,
  device_name TEXT,
  battery_level INTEGER,
  status TEXT NOT NULL DEFAULT 'offline',
  last_reading_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.vyva_sensor_readings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sensor_id UUID NOT NULL REFERENCES public.vyva_user_sensors(id) ON DELETE CASCADE,
  value NUMERIC NOT NULL,
  unit TEXT NOT NULL,
  is_anomaly BOOLEAN NOT NULL DEFAULT false,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.vyva_sensor_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sensor_id UUID REFERENCES public.vyva_user_sensors(id) ON DELETE SET NULL,
  vyva_user_id UUID NOT NULL REFERENCES public.vyva_users(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'warning',
  message TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.vyva_medication_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vyva_user_id UUID NOT NULL REFERENCES public.vyva_users(id) ON DELETE CASCADE,
  medication_id UUID NOT NULL REFERENCES public.vyva_user_medications(id) ON DELETE CASCADE,
  scheduled_date DATE NOT NULL,
  scheduled_time TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  reported_at TIMESTAMPTZ,
  call_id TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(medication_id, scheduled_date, scheduled_time)
);

CREATE TABLE IF NOT EXISTS public.operational_offices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id),
  name TEXT NOT NULL,
  office_type TEXT,
  address TEXT,
  city TEXT,
  post_code TEXT,
  phone TEXT,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.field_staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id),
  full_name TEXT NOT NULL,
  role TEXT,
  team TEXT,
  phone TEXT,
  status TEXT NOT NULL DEFAULT 'available',
  capacity INTEGER NOT NULL DEFAULT 8,
  open_cases INTEGER NOT NULL DEFAULT 0,
  base_office_id UUID REFERENCES public.operational_offices(id) ON DELETE SET NULL,
  last_known_latitude DOUBLE PRECISION,
  last_known_longitude DOUBLE PRECISION,
  last_seen_at TIMESTAMPTZ,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.care_provider_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id),
  full_name TEXT NOT NULL,
  phone TEXT,
  phone_digits TEXT,
  source TEXT NOT NULL DEFAULT 'manual',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.vyva_user_care_provider_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vyva_user_id UUID NOT NULL REFERENCES public.vyva_users(id) ON DELETE CASCADE,
  provider_type TEXT NOT NULL CHECK (provider_type IN ('caregiver', 'field_staff')),
  care_provider_contact_id UUID REFERENCES public.care_provider_contacts(id) ON DELETE CASCADE,
  field_staff_id UUID REFERENCES public.field_staff(id) ON DELETE CASCADE,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  relationship_label TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    (provider_type = 'caregiver' AND care_provider_contact_id IS NOT NULL AND field_staff_id IS NULL)
    OR
    (provider_type = 'field_staff' AND field_staff_id IS NOT NULL AND care_provider_contact_id IS NULL)
  )
);

CREATE TABLE IF NOT EXISTS public.client_risk_signals_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.vyva_users(id) ON DELETE CASCADE,
  signal_date DATE NOT NULL,
  mood_risk NUMERIC(5,2),
  medication_risk NUMERIC(5,2),
  checkin_risk NUMERIC(5,2),
  response_risk NUMERIC(5,2),
  brain_coach_risk NUMERIC(5,2),
  manual_flag_risk NUMERIC(5,2) NOT NULL DEFAULT 0,
  raw_inputs JSONB,
  computed_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (client_id, signal_date)
);

CREATE TABLE IF NOT EXISTS public.client_risk_scores_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.vyva_users(id) ON DELETE CASCADE,
  score_date DATE NOT NULL,
  composite_score NUMERIC(5,2) NOT NULL,
  risk_band TEXT NOT NULL CHECK (risk_band IN ('low','moderate','high')),
  delta_from_prior NUMERIC(5,2),
  contributing_factors JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (client_id, score_date)
);

CREATE TABLE IF NOT EXISTS public.client_risk_forecasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.vyva_users(id) ON DELETE CASCADE,
  forecast_generated_at TIMESTAMPTZ NOT NULL,
  forecast_date DATE NOT NULL,
  horizon_day INTEGER NOT NULL CHECK (horizon_day BETWEEN 1 AND 30),
  predicted_score NUMERIC(5,2) NOT NULL,
  predicted_low NUMERIC(5,2) NOT NULL,
  predicted_high NUMERIC(5,2) NOT NULL,
  model_confidence NUMERIC(4,3),
  UNIQUE (client_id, forecast_generated_at, horizon_day)
);

CREATE TABLE IF NOT EXISTS public.operator_capacity_weekly (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  operator_id UUID NOT NULL REFERENCES public.field_staff(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  capacity_hours NUMERIC(6,2) NOT NULL DEFAULT 32,
  current_caseload INTEGER NOT NULL DEFAULT 0,
  recommended_caseload INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (operator_id, week_start)
);

CREATE TABLE IF NOT EXISTS public.daily_resource_forecast (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  forecast_date DATE NOT NULL,
  predicted_urgent_count INTEGER NOT NULL DEFAULT 0,
  predicted_review_count INTEGER NOT NULL DEFAULT 0,
  predicted_medication_count INTEGER NOT NULL DEFAULT 0,
  predicted_noresponse_count INTEGER NOT NULL DEFAULT 0,
  predicted_hours_needed NUMERIC(6,2) NOT NULL,
  available_hours NUMERIC(6,2) NOT NULL,
  generated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (organization_id, forecast_date, generated_at)
);

CREATE TABLE IF NOT EXISTS public.reassignment_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  generation_date DATE NOT NULL DEFAULT CURRENT_DATE,
  suggested_at TIMESTAMPTZ DEFAULT now(),
  from_operator_id UUID REFERENCES public.field_staff(id),
  to_operator_id UUID NOT NULL REFERENCES public.field_staff(id),
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','applied','dismissed')),
  applied_at TIMESTAMPTZ,
  applied_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.reassignment_suggestion_clients (
  suggestion_id UUID NOT NULL REFERENCES public.reassignment_suggestions(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.vyva_users(id) ON DELETE CASCADE,
  PRIMARY KEY (suggestion_id, client_id)
);

CREATE TABLE IF NOT EXISTS public.campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id),
  slug TEXT UNIQUE,
  name TEXT,
  name_key TEXT,
  objective TEXT,
  objective_key TEXT,
  audience TEXT,
  audience_key TEXT,
  template_key TEXT NOT NULL DEFAULT 'general_announcement',
  target_rules JSONB NOT NULL DEFAULT '{}'::jsonb,
  due_key TEXT NOT NULL DEFAULT 'campaigns.due.draft',
  city TEXT,
  owner TEXT,
  type TEXT NOT NULL DEFAULT 'safety' CHECK (type IN ('safety', 'wellbeing', 'medication', 'service')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('active', 'draft', 'scheduled', 'completed')),
  channel TEXT NOT NULL DEFAULT 'phone' CHECK (channel IN ('phone', 'whatsapp', 'mixed')),
  scheduled_at TIMESTAMPTZ,
  call_script TEXT,
  call_window_start TEXT,
  call_window_end TEXT,
  retry_limit INTEGER NOT NULL DEFAULT 0,
  execution_type TEXT NOT NULL DEFAULT 'manual' CHECK (execution_type IN ('manual', 'vyva_call')),
  target_total INTEGER NOT NULL DEFAULT 0,
  contacted_count INTEGER NOT NULL DEFAULT 0,
  confirmed_count INTEGER NOT NULL DEFAULT 0,
  follow_up_count INTEGER NOT NULL DEFAULT 0,
  tone TEXT NOT NULL DEFAULT 'purple' CHECK (tone IN ('purple', 'orange', 'green', 'red')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.campaign_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id),
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  vyva_user_id UUID NOT NULL REFERENCES public.vyva_users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'contacted', 'confirmed', 'followUp')),
  reason_key TEXT,
  action TEXT NOT NULL DEFAULT 'profile' CHECK (action IN ('profile', 'prepareCall')),
  owner TEXT,
  channel TEXT NOT NULL DEFAULT 'phone' CHECK (channel IN ('phone', 'whatsapp', 'app')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(campaign_id, vyva_user_id)
);

CREATE TABLE IF NOT EXISTS public.campaign_call_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id),
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('draft', 'scheduled', 'queued', 'running', 'completed', 'cancelled', 'failed')),
  scheduled_at TIMESTAMPTZ,
  eligible_count INTEGER NOT NULL DEFAULT 0,
  skipped_count INTEGER NOT NULL DEFAULT 0,
  queued_count INTEGER NOT NULL DEFAULT 0,
  completed_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  call_script TEXT,
  call_window_start TEXT,
  call_window_end TEXT,
  retry_limit INTEGER NOT NULL DEFAULT 0,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.campaign_call_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id),
  run_id UUID NOT NULL REFERENCES public.campaign_call_runs(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  vyva_user_id UUID NOT NULL REFERENCES public.vyva_users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'queued', 'calling', 'completed', 'failed', 'skipped', 'cancelled')),
  skip_reason TEXT CHECK (skip_reason IS NULL OR skip_reason IN ('no_phone', 'no_consent', 'outside_call_window', 'duplicate_target', 'outside_geo', 'risk_mismatch', 'health_condition_mismatch', 'provider_mismatch', 'template_mismatch')),
  scheduled_at TIMESTAMPTZ,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(run_id, vyva_user_id)
);

ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS target_total INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS contacted_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS confirmed_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS follow_up_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS template_key TEXT NOT NULL DEFAULT 'general_announcement';
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS target_rules JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS call_script TEXT;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS call_window_start TEXT;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS call_window_end TEXT;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS retry_limit INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS execution_type TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE public.vyva_user_checkins ADD COLUMN IF NOT EXISTS paused_until TIMESTAMPTZ;
ALTER TABLE public.vyva_user_checkins ADD COLUMN IF NOT EXISTS pause_reason TEXT;
ALTER TABLE public.vyva_user_checkins ADD COLUMN IF NOT EXISTS pause_source TEXT;
ALTER TABLE public.vyva_user_brain_coach ADD COLUMN IF NOT EXISTS paused_until TIMESTAMPTZ;
ALTER TABLE public.vyva_user_brain_coach ADD COLUMN IF NOT EXISTS pause_reason TEXT;
ALTER TABLE public.vyva_user_brain_coach ADD COLUMN IF NOT EXISTS pause_source TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_platform_admin BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.vyva_users ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.vyva_users ADD COLUMN IF NOT EXISTS external_user_id TEXT;
ALTER TABLE public.vyva_users ADD COLUMN IF NOT EXISTS external_source TEXT NOT NULL DEFAULT 'local';
ALTER TABLE public.operational_offices ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.field_staff ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.care_provider_contacts ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.care_provider_contacts ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.campaign_targets ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.campaign_call_runs ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.campaign_call_jobs ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.campaign_call_jobs DROP CONSTRAINT IF EXISTS campaign_call_jobs_skip_reason_check;
ALTER TABLE public.campaign_call_jobs ADD CONSTRAINT campaign_call_jobs_skip_reason_check
  CHECK (skip_reason IS NULL OR skip_reason IN ('no_phone', 'no_consent', 'outside_call_window', 'duplicate_target', 'outside_geo', 'risk_mismatch', 'health_condition_mismatch', 'provider_mismatch', 'template_mismatch'));

WITH default_org AS (
  SELECT id FROM public.organizations WHERE slug = 'red-cross-leipzig' LIMIT 1
)
UPDATE public.profiles SET organization_id = default_org.id FROM default_org WHERE organization_id IS NULL;

WITH default_org AS (
  SELECT id FROM public.organizations WHERE slug = 'red-cross-leipzig' LIMIT 1
)
UPDATE public.user_roles SET organization_id = default_org.id FROM default_org WHERE organization_id IS NULL;

UPDATE public.vyva_users
SET organization_id = public.resolve_vyva_user_organization_id(country, phone)
WHERE organization_id IS NULL;

WITH default_org AS (
  SELECT id FROM public.organizations WHERE slug = 'red-cross-leipzig' LIMIT 1
)
UPDATE public.operational_offices SET organization_id = default_org.id FROM default_org WHERE organization_id IS NULL;

WITH default_org AS (
  SELECT id FROM public.organizations WHERE slug = 'red-cross-leipzig' LIMIT 1
)
UPDATE public.field_staff SET organization_id = default_org.id FROM default_org WHERE organization_id IS NULL;

WITH default_org AS (
  SELECT id FROM public.organizations WHERE slug = 'red-cross-leipzig' LIMIT 1
)
UPDATE public.care_provider_contacts SET organization_id = default_org.id FROM default_org WHERE organization_id IS NULL;

WITH default_org AS (
  SELECT id FROM public.organizations WHERE slug = 'red-cross-leipzig' LIMIT 1
)
UPDATE public.campaigns SET organization_id = default_org.id FROM default_org WHERE organization_id IS NULL;

UPDATE public.campaign_targets t
SET organization_id = c.organization_id
FROM public.campaigns c
WHERE t.campaign_id = c.id AND t.organization_id IS NULL;

UPDATE public.campaign_call_runs r
SET organization_id = c.organization_id
FROM public.campaigns c
WHERE r.campaign_id = c.id AND r.organization_id IS NULL;

UPDATE public.campaign_call_jobs j
SET organization_id = c.organization_id
FROM public.campaigns c
WHERE j.campaign_id = c.id AND j.organization_id IS NULL;

ALTER TABLE public.vyva_users ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.operational_offices ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.field_staff ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.care_provider_contacts ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.campaigns ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.campaign_targets ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.campaign_call_runs ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.campaign_call_jobs ALTER COLUMN organization_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_organization ON public.profiles(organization_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_organization ON public.user_roles(organization_id);
CREATE INDEX IF NOT EXISTS idx_vyva_users_organization ON public.vyva_users(organization_id);
CREATE INDEX IF NOT EXISTS idx_operational_offices_organization ON public.operational_offices(organization_id);
CREATE INDEX IF NOT EXISTS idx_field_staff_organization ON public.field_staff(organization_id);
CREATE INDEX IF NOT EXISTS idx_care_provider_contacts_organization ON public.care_provider_contacts(organization_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_organization ON public.campaigns(organization_id);
DROP INDEX IF EXISTS idx_campaigns_org_slug;
DROP INDEX IF EXISTS idx_care_provider_contacts_phone_digits;
ALTER TABLE public.campaigns DROP CONSTRAINT IF EXISTS campaigns_slug_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_campaigns_org_slug
  ON public.campaigns(organization_id, slug)
  WHERE slug IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_vyva_user_checkins_user ON public.vyva_user_checkins(vyva_user_id);
CREATE INDEX IF NOT EXISTS idx_vyva_user_medications_user ON public.vyva_user_medications(vyva_user_id);
CREATE INDEX IF NOT EXISTS idx_vyva_user_caregivers_user ON public.vyva_user_caregivers(vyva_user_id);
CREATE INDEX IF NOT EXISTS idx_vyva_user_sensors_user ON public.vyva_user_sensors(vyva_user_id);
CREATE INDEX IF NOT EXISTS idx_vyva_sensor_alerts_user ON public.vyva_sensor_alerts(vyva_user_id);
CREATE INDEX IF NOT EXISTS idx_vyva_medication_logs_user_date ON public.vyva_medication_logs(vyva_user_id, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_vyva_users_conversation ON public.vyva_users(conversation_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_vyva_users_external_source_id
  ON public.vyva_users(organization_id, external_source, external_user_id)
  WHERE external_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_vyva_users_phone_digits ON public.vyva_users ((regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g')));
CREATE UNIQUE INDEX IF NOT EXISTS idx_care_provider_contacts_org_phone_digits
  ON public.care_provider_contacts(organization_id, phone_digits)
  WHERE phone_digits IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_care_provider_assignments_user
  ON public.vyva_user_care_provider_assignments(vyva_user_id);
CREATE INDEX IF NOT EXISTS idx_care_provider_assignments_contact
  ON public.vyva_user_care_provider_assignments(care_provider_contact_id);
CREATE INDEX IF NOT EXISTS idx_care_provider_assignments_field_staff
  ON public.vyva_user_care_provider_assignments(field_staff_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_care_provider_assignment_unique_contact
  ON public.vyva_user_care_provider_assignments(vyva_user_id, care_provider_contact_id)
  WHERE provider_type = 'caregiver' AND care_provider_contact_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_care_provider_assignment_unique_field_staff
  ON public.vyva_user_care_provider_assignments(vyva_user_id, field_staff_id)
  WHERE provider_type = 'field_staff' AND field_staff_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_care_provider_primary_caregiver
  ON public.vyva_user_care_provider_assignments(vyva_user_id)
  WHERE provider_type = 'caregiver' AND is_primary = true;
CREATE UNIQUE INDEX IF NOT EXISTS idx_care_provider_primary_field_staff
  ON public.vyva_user_care_provider_assignments(vyva_user_id)
  WHERE provider_type = 'field_staff' AND is_primary = true;
CREATE INDEX IF NOT EXISTS idx_crsd_client_date ON public.client_risk_signals_daily (client_id, signal_date DESC);
CREATE INDEX IF NOT EXISTS idx_crsd_organization_date ON public.client_risk_signals_daily (organization_id, signal_date DESC);
CREATE INDEX IF NOT EXISTS idx_crscd_client_date ON public.client_risk_scores_daily (client_id, score_date DESC);
CREATE INDEX IF NOT EXISTS idx_crscd_organization_date ON public.client_risk_scores_daily (organization_id, score_date DESC);
CREATE INDEX IF NOT EXISTS idx_crf_client_horizon ON public.client_risk_forecasts (client_id, forecast_generated_at DESC, horizon_day);
CREATE INDEX IF NOT EXISTS idx_crf_organization_batch ON public.client_risk_forecasts (organization_id, forecast_generated_at DESC, horizon_day);
CREATE INDEX IF NOT EXISTS idx_drf_date ON public.daily_resource_forecast (organization_id, forecast_date, generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_rs_status ON public.reassignment_suggestions (organization_id, status, suggested_at DESC);
CREATE INDEX IF NOT EXISTS idx_ocw_operator_week ON public.operator_capacity_weekly (operator_id, week_start DESC);
CREATE INDEX IF NOT EXISTS idx_campaign_targets_campaign ON public.campaign_targets(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_targets_user ON public.campaign_targets(vyva_user_id);
CREATE INDEX IF NOT EXISTS idx_campaign_call_runs_campaign ON public.campaign_call_runs(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_call_jobs_run ON public.campaign_call_jobs(run_id);
CREATE INDEX IF NOT EXISTS idx_campaign_call_jobs_campaign ON public.campaign_call_jobs(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_call_jobs_user ON public.campaign_call_jobs(vyva_user_id);

WITH caregiver_phone_groups AS (
  SELECT
    u.organization_id,
    NULLIF(regexp_replace(COALESCE(c.caretaker_phone, ''), '[^0-9]', '', 'g'), '') AS phone_digits,
    COALESCE(NULLIF((array_agg(c.caretaker_name ORDER BY c.created_at DESC, c.id DESC))[1], ''), 'Care contact') AS full_name,
    (array_agg(c.caretaker_phone ORDER BY c.created_at DESC, c.id DESC))[1] AS phone
  FROM public.vyva_user_caregivers c
  JOIN public.vyva_users u ON u.id = c.vyva_user_id
  WHERE NULLIF(regexp_replace(COALESCE(c.caretaker_phone, ''), '[^0-9]', '', 'g'), '') IS NOT NULL
  GROUP BY u.organization_id, NULLIF(regexp_replace(COALESCE(c.caretaker_phone, ''), '[^0-9]', '', 'g'), '')
)
INSERT INTO public.care_provider_contacts (organization_id, full_name, phone, phone_digits, source)
SELECT organization_id, full_name, phone, phone_digits, 'onboarding'
FROM caregiver_phone_groups
ON CONFLICT (organization_id, phone_digits) WHERE phone_digits IS NOT NULL
DO UPDATE SET
  full_name = COALESCE(EXCLUDED.full_name, public.care_provider_contacts.full_name),
  phone = COALESCE(EXCLUDED.phone, public.care_provider_contacts.phone),
  source = CASE
    WHEN public.care_provider_contacts.source = 'manual' THEN EXCLUDED.source
    ELSE public.care_provider_contacts.source
  END,
  updated_at = now();

INSERT INTO public.care_provider_contacts (id, organization_id, full_name, phone, phone_digits, source)
SELECT
  c.id,
  u.organization_id,
  COALESCE(NULLIF(c.caretaker_name, ''), 'Care contact') AS full_name,
  c.caretaker_phone,
  NULL,
  'onboarding'
FROM public.vyva_user_caregivers c
JOIN public.vyva_users u ON u.id = c.vyva_user_id
WHERE NULLIF(regexp_replace(COALESCE(c.caretaker_phone, ''), '[^0-9]', '', 'g'), '') IS NULL
ON CONFLICT (id) DO NOTHING;

WITH source_caregivers AS (
  SELECT
    c.*,
    NULLIF(regexp_replace(COALESCE(c.caretaker_phone, ''), '[^0-9]', '', 'g'), '') AS phone_digits,
    ROW_NUMBER() OVER (PARTITION BY c.vyva_user_id ORDER BY c.created_at ASC, c.id ASC) AS primary_rank
  FROM public.vyva_user_caregivers c
),
assignment_source AS (
  SELECT
    s.vyva_user_id,
    COALESCE(phone_contact.id, no_phone_contact.id) AS contact_id,
    s.primary_rank = 1 AS is_primary
  FROM source_caregivers s
  LEFT JOIN public.care_provider_contacts phone_contact
    ON s.phone_digits IS NOT NULL AND phone_contact.phone_digits = s.phone_digits
    AND phone_contact.organization_id = (SELECT organization_id FROM public.vyva_users WHERE id = s.vyva_user_id)
  LEFT JOIN public.care_provider_contacts no_phone_contact
    ON s.phone_digits IS NULL AND no_phone_contact.id = s.id
  WHERE COALESCE(phone_contact.id, no_phone_contact.id) IS NOT NULL
)
INSERT INTO public.vyva_user_care_provider_assignments (
  vyva_user_id,
  provider_type,
  care_provider_contact_id,
  is_primary,
  relationship_label
)
SELECT
  vyva_user_id,
  'caregiver',
  contact_id,
  is_primary,
  'Caregiver'
FROM assignment_source
ON CONFLICT DO NOTHING;

INSERT INTO public.campaigns (
  organization_id,
  slug,
  name_key,
  objective_key,
  audience_key,
  due_key,
  city,
  owner,
  type,
  status,
  channel,
  target_total,
  contacted_count,
  confirmed_count,
  follow_up_count,
  tone
) VALUES
  (
    (SELECT id FROM public.organizations WHERE slug = 'red-cross-leipzig'),
    'heatwave',
    'campaigns.demo.heatwave.name',
    'campaigns.demo.heatwave.objective',
    'campaigns.demo.heatwave.audience',
    'campaigns.due.today',
    'Madrid',
    'Ana Novak',
    'safety',
    'active',
    'phone',
    420,
    420,
    314,
    58,
    'orange'
  ),
  (
    (SELECT id FROM public.organizations WHERE slug = 'red-cross-leipzig'),
    'medication',
    'campaigns.demo.medication.name',
    'campaigns.demo.medication.objective',
    'campaigns.demo.medication.audience',
    'campaigns.due.tomorrow',
    'Madrid',
    'Team North',
    'medication',
    'scheduled',
    'mixed',
    86,
    18,
    11,
    9,
    'purple'
  ),
  (
    (SELECT id FROM public.organizations WHERE slug = 'red-cross-leipzig'),
    'isolation',
    'campaigns.demo.isolation.name',
    'campaigns.demo.isolation.objective',
    'campaigns.demo.isolation.audience',
    'campaigns.due.friday',
    'Dresden',
    'Team East',
    'wellbeing',
    'draft',
    'phone',
    64,
    0,
    0,
    0,
    'green'
  ),
  (
    (SELECT id FROM public.organizations WHERE slug = 'red-cross-leipzig'),
    'post-discharge',
    'campaigns.demo.postDischarge.name',
    'campaigns.demo.postDischarge.objective',
    'campaigns.demo.postDischarge.audience',
    'campaigns.due.completed',
    'Leipzig',
    'Services desk',
    'service',
    'completed',
    'whatsapp',
    52,
    52,
    47,
    3,
    'red'
  )
ON CONFLICT (organization_id, slug) WHERE slug IS NOT NULL DO NOTHING;

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_vyva_users_updated_at ON public.vyva_users;
CREATE TRIGGER update_vyva_users_updated_at BEFORE UPDATE ON public.vyva_users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_vyva_user_organization_id ON public.vyva_users;
CREATE TRIGGER set_vyva_user_organization_id
BEFORE INSERT OR UPDATE OF organization_id ON public.vyva_users
FOR EACH ROW EXECUTE FUNCTION public.set_vyva_user_organization_id();

DROP TRIGGER IF EXISTS update_vyva_user_consent_updated_at ON public.vyva_user_consent;
CREATE TRIGGER update_vyva_user_consent_updated_at BEFORE UPDATE ON public.vyva_user_consent FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_vyva_user_health_updated_at ON public.vyva_user_health;
CREATE TRIGGER update_vyva_user_health_updated_at BEFORE UPDATE ON public.vyva_user_health FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_vyva_user_medications_updated_at ON public.vyva_user_medications;
CREATE TRIGGER update_vyva_user_medications_updated_at BEFORE UPDATE ON public.vyva_user_medications FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_vyva_user_health_plans_updated_at ON public.vyva_user_health_plans;
CREATE TRIGGER update_vyva_user_health_plans_updated_at BEFORE UPDATE ON public.vyva_user_health_plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_vyva_user_checkins_updated_at ON public.vyva_user_checkins;
CREATE TRIGGER update_vyva_user_checkins_updated_at BEFORE UPDATE ON public.vyva_user_checkins FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_vyva_user_brain_coach_updated_at ON public.vyva_user_brain_coach;
CREATE TRIGGER update_vyva_user_brain_coach_updated_at BEFORE UPDATE ON public.vyva_user_brain_coach FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_vyva_user_caregivers_updated_at ON public.vyva_user_caregivers;
CREATE TRIGGER update_vyva_user_caregivers_updated_at BEFORE UPDATE ON public.vyva_user_caregivers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_vyva_user_sensors_updated_at ON public.vyva_user_sensors;
CREATE TRIGGER update_vyva_user_sensors_updated_at BEFORE UPDATE ON public.vyva_user_sensors FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_operational_offices_updated_at ON public.operational_offices;
CREATE TRIGGER update_operational_offices_updated_at BEFORE UPDATE ON public.operational_offices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_field_staff_updated_at ON public.field_staff;
CREATE TRIGGER update_field_staff_updated_at BEFORE UPDATE ON public.field_staff FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_care_provider_contacts_updated_at ON public.care_provider_contacts;
CREATE TRIGGER update_care_provider_contacts_updated_at BEFORE UPDATE ON public.care_provider_contacts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_care_provider_assignments_updated_at ON public.vyva_user_care_provider_assignments;
CREATE TRIGGER update_care_provider_assignments_updated_at BEFORE UPDATE ON public.vyva_user_care_provider_assignments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_operator_capacity_weekly_updated_at ON public.operator_capacity_weekly;
CREATE TRIGGER update_operator_capacity_weekly_updated_at BEFORE UPDATE ON public.operator_capacity_weekly FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_campaigns_updated_at ON public.campaigns;
CREATE TRIGGER update_campaigns_updated_at BEFORE UPDATE ON public.campaigns FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_campaign_targets_updated_at ON public.campaign_targets;
CREATE TRIGGER update_campaign_targets_updated_at BEFORE UPDATE ON public.campaign_targets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_campaign_call_runs_updated_at ON public.campaign_call_runs;
CREATE TRIGGER update_campaign_call_runs_updated_at BEFORE UPDATE ON public.campaign_call_runs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_campaign_call_jobs_updated_at ON public.campaign_call_jobs;
CREATE TRIGGER update_campaign_call_jobs_updated_at BEFORE UPDATE ON public.campaign_call_jobs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
