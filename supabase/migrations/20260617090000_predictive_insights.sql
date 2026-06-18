-- Predictive insights: nightly risk scoring, forecasting, resource capacity, and reassignment suggestions.

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

ALTER TABLE public.client_risk_signals_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_risk_scores_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_risk_forecasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operator_capacity_weekly ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_resource_forecast ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reassignment_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reassignment_suggestion_clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin users can view client_risk_signals_daily" ON public.client_risk_signals_daily;
CREATE POLICY "Admin users can view client_risk_signals_daily" ON public.client_risk_signals_daily
  FOR SELECT TO authenticated
  USING (public.is_admin_user(auth.uid()));

DROP POLICY IF EXISTS "Admin users can view client_risk_scores_daily" ON public.client_risk_scores_daily;
CREATE POLICY "Admin users can view client_risk_scores_daily" ON public.client_risk_scores_daily
  FOR SELECT TO authenticated
  USING (public.is_admin_user(auth.uid()));

DROP POLICY IF EXISTS "Admin users can view client_risk_forecasts" ON public.client_risk_forecasts;
CREATE POLICY "Admin users can view client_risk_forecasts" ON public.client_risk_forecasts
  FOR SELECT TO authenticated
  USING (public.is_admin_user(auth.uid()));

DROP POLICY IF EXISTS "Admin users can view daily_resource_forecast" ON public.daily_resource_forecast;
CREATE POLICY "Admin users can view daily_resource_forecast" ON public.daily_resource_forecast
  FOR SELECT TO authenticated
  USING (public.is_admin_user(auth.uid()));

DROP POLICY IF EXISTS "Admin users can view operator_capacity_weekly" ON public.operator_capacity_weekly;
CREATE POLICY "Admin users can view operator_capacity_weekly" ON public.operator_capacity_weekly
  FOR SELECT TO authenticated
  USING (public.is_admin_user(auth.uid()));

DROP POLICY IF EXISTS "Admins and coordinators can manage operator_capacity_weekly" ON public.operator_capacity_weekly;
CREATE POLICY "Admins and coordinators can manage operator_capacity_weekly" ON public.operator_capacity_weekly
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'coordinator'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'coordinator'));

DROP POLICY IF EXISTS "Admin users can view reassignment_suggestions" ON public.reassignment_suggestions;
CREATE POLICY "Admin users can view reassignment_suggestions" ON public.reassignment_suggestions
  FOR SELECT TO authenticated
  USING (public.is_admin_user(auth.uid()));

DROP POLICY IF EXISTS "Admins and coordinators can manage reassignment_suggestions" ON public.reassignment_suggestions;
CREATE POLICY "Admins and coordinators can manage reassignment_suggestions" ON public.reassignment_suggestions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'coordinator'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'coordinator'));

DROP POLICY IF EXISTS "Admin users can view reassignment_suggestion_clients" ON public.reassignment_suggestion_clients;
CREATE POLICY "Admin users can view reassignment_suggestion_clients" ON public.reassignment_suggestion_clients
  FOR SELECT TO authenticated
  USING (public.is_admin_user(auth.uid()));

DROP POLICY IF EXISTS "Admins and coordinators can manage reassignment_suggestion_clients" ON public.reassignment_suggestion_clients;
CREATE POLICY "Admins and coordinators can manage reassignment_suggestion_clients" ON public.reassignment_suggestion_clients
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'coordinator'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'coordinator'));

CREATE INDEX IF NOT EXISTS idx_crsd_client_date ON public.client_risk_signals_daily (client_id, signal_date DESC);
CREATE INDEX IF NOT EXISTS idx_crsd_organization_date ON public.client_risk_signals_daily (organization_id, signal_date DESC);
CREATE INDEX IF NOT EXISTS idx_crscd_client_date ON public.client_risk_scores_daily (client_id, score_date DESC);
CREATE INDEX IF NOT EXISTS idx_crscd_organization_date ON public.client_risk_scores_daily (organization_id, score_date DESC);
CREATE INDEX IF NOT EXISTS idx_crf_client_horizon ON public.client_risk_forecasts (client_id, forecast_generated_at DESC, horizon_day);
CREATE INDEX IF NOT EXISTS idx_crf_organization_batch ON public.client_risk_forecasts (organization_id, forecast_generated_at DESC, horizon_day);
CREATE INDEX IF NOT EXISTS idx_drf_date ON public.daily_resource_forecast (organization_id, forecast_date, generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_rs_status ON public.reassignment_suggestions (organization_id, status, suggested_at DESC);
CREATE INDEX IF NOT EXISTS idx_ocw_operator_week ON public.operator_capacity_weekly (operator_id, week_start DESC);

DROP TRIGGER IF EXISTS update_operator_capacity_weekly_updated_at ON public.operator_capacity_weekly;
CREATE TRIGGER update_operator_capacity_weekly_updated_at
  BEFORE UPDATE ON public.operator_capacity_weekly
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
