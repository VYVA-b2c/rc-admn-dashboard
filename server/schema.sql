CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM ('admin', 'operator', 'coordinator');
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL UNIQUE,
  full_name TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);

CREATE TABLE IF NOT EXISTS public.vyva_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
  photo_url TEXT,
  emergency_notes TEXT,
  conversation_id TEXT,
  transcript TEXT,
  call_duration INTEGER,
  call_timestamp TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

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
  schedule_times TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.vyva_user_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vyva_user_id UUID NOT NULL UNIQUE REFERENCES public.vyva_users(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT false,
  frequency TEXT,
  preferred_time TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.vyva_user_brain_coach (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vyva_user_id UUID NOT NULL UNIQUE REFERENCES public.vyva_users(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT false,
  frequency TEXT,
  preferred_time TEXT,
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

CREATE TABLE IF NOT EXISTS public.campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE,
  name TEXT,
  name_key TEXT,
  objective TEXT,
  objective_key TEXT,
  audience TEXT,
  audience_key TEXT,
  due_key TEXT NOT NULL DEFAULT 'campaigns.due.draft',
  city TEXT,
  owner TEXT,
  type TEXT NOT NULL DEFAULT 'safety' CHECK (type IN ('safety', 'wellbeing', 'medication', 'service')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('active', 'draft', 'scheduled', 'completed')),
  channel TEXT NOT NULL DEFAULT 'phone' CHECK (channel IN ('phone', 'whatsapp', 'mixed')),
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

ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS target_total INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS contacted_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS confirmed_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS follow_up_count INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_vyva_user_checkins_user ON public.vyva_user_checkins(vyva_user_id);
CREATE INDEX IF NOT EXISTS idx_vyva_user_medications_user ON public.vyva_user_medications(vyva_user_id);
CREATE INDEX IF NOT EXISTS idx_vyva_user_caregivers_user ON public.vyva_user_caregivers(vyva_user_id);
CREATE INDEX IF NOT EXISTS idx_vyva_user_sensors_user ON public.vyva_user_sensors(vyva_user_id);
CREATE INDEX IF NOT EXISTS idx_vyva_sensor_alerts_user ON public.vyva_sensor_alerts(vyva_user_id);
CREATE INDEX IF NOT EXISTS idx_vyva_medication_logs_user_date ON public.vyva_medication_logs(vyva_user_id, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_campaign_targets_campaign ON public.campaign_targets(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_targets_user ON public.campaign_targets(vyva_user_id);

INSERT INTO public.campaigns (
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
ON CONFLICT (slug) DO NOTHING;

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_vyva_users_updated_at ON public.vyva_users;
CREATE TRIGGER update_vyva_users_updated_at BEFORE UPDATE ON public.vyva_users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_vyva_user_consent_updated_at ON public.vyva_user_consent;
CREATE TRIGGER update_vyva_user_consent_updated_at BEFORE UPDATE ON public.vyva_user_consent FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_vyva_user_health_updated_at ON public.vyva_user_health;
CREATE TRIGGER update_vyva_user_health_updated_at BEFORE UPDATE ON public.vyva_user_health FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_vyva_user_medications_updated_at ON public.vyva_user_medications;
CREATE TRIGGER update_vyva_user_medications_updated_at BEFORE UPDATE ON public.vyva_user_medications FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

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

DROP TRIGGER IF EXISTS update_campaigns_updated_at ON public.campaigns;
CREATE TRIGGER update_campaigns_updated_at BEFORE UPDATE ON public.campaigns FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_campaign_targets_updated_at ON public.campaign_targets;
CREATE TRIGGER update_campaign_targets_updated_at BEFORE UPDATE ON public.campaign_targets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
