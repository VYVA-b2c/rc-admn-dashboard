CREATE TABLE IF NOT EXISTS public.vyva_user_health_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vyva_user_id UUID NOT NULL UNIQUE REFERENCES public.vyva_users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  language TEXT NOT NULL DEFAULT 'en' CHECK (language IN ('en', 'de', 'es')),
  status TEXT NOT NULL DEFAULT 'current' CHECK (status IN ('current')),
  review_status TEXT NOT NULL DEFAULT 'draft' CHECK (review_status IN ('draft', 'reviewed')),
  summary_text TEXT,
  goals_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  daily_support_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  monitoring_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  escalation_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  caregiver_guidance_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  source_signals_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  generator_provider TEXT,
  generator_model TEXT,
  generator_version TEXT,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  generated_by_user_id TEXT,
  reviewed_at TIMESTAMPTZ,
  reviewed_by_user_id TEXT,
  reviewed_by_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vyva_user_health_plans_org_id
  ON public.vyva_user_health_plans (organization_id);

DROP TRIGGER IF EXISTS update_vyva_user_health_plans_updated_at ON public.vyva_user_health_plans;
CREATE TRIGGER update_vyva_user_health_plans_updated_at
BEFORE UPDATE ON public.vyva_user_health_plans
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
