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

CREATE TABLE IF NOT EXISTS public.care_provider_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  phone TEXT,
  phone_digits TEXT,
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
CREATE INDEX IF NOT EXISTS idx_vyva_users_conversation ON public.vyva_users(conversation_id);
CREATE INDEX IF NOT EXISTS idx_vyva_users_phone_digits ON public.vyva_users ((regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g')));
CREATE UNIQUE INDEX IF NOT EXISTS idx_care_provider_contacts_phone_digits
  ON public.care_provider_contacts(phone_digits)
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
CREATE INDEX IF NOT EXISTS idx_campaign_targets_campaign ON public.campaign_targets(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_targets_user ON public.campaign_targets(vyva_user_id);

WITH caregiver_phone_groups AS (
  SELECT
    NULLIF(regexp_replace(COALESCE(caretaker_phone, ''), '[^0-9]', '', 'g'), '') AS phone_digits,
    COALESCE(NULLIF((array_agg(caretaker_name ORDER BY created_at DESC, id DESC))[1], ''), 'Care contact') AS full_name,
    (array_agg(caretaker_phone ORDER BY created_at DESC, id DESC))[1] AS phone
  FROM public.vyva_user_caregivers
  WHERE NULLIF(regexp_replace(COALESCE(caretaker_phone, ''), '[^0-9]', '', 'g'), '') IS NOT NULL
  GROUP BY NULLIF(regexp_replace(COALESCE(caretaker_phone, ''), '[^0-9]', '', 'g'), '')
)
INSERT INTO public.care_provider_contacts (full_name, phone, phone_digits)
SELECT full_name, phone, phone_digits
FROM caregiver_phone_groups
ON CONFLICT (phone_digits) WHERE phone_digits IS NOT NULL
DO UPDATE SET
  full_name = COALESCE(EXCLUDED.full_name, public.care_provider_contacts.full_name),
  phone = COALESCE(EXCLUDED.phone, public.care_provider_contacts.phone),
  updated_at = now();

INSERT INTO public.care_provider_contacts (id, full_name, phone, phone_digits)
SELECT
  id,
  COALESCE(NULLIF(caretaker_name, ''), 'Care contact') AS full_name,
  caretaker_phone,
  NULL
FROM public.vyva_user_caregivers
WHERE NULLIF(regexp_replace(COALESCE(caretaker_phone, ''), '[^0-9]', '', 'g'), '') IS NULL
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

DROP TRIGGER IF EXISTS update_care_provider_contacts_updated_at ON public.care_provider_contacts;
CREATE TRIGGER update_care_provider_contacts_updated_at BEFORE UPDATE ON public.care_provider_contacts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_care_provider_assignments_updated_at ON public.vyva_user_care_provider_assignments;
CREATE TRIGGER update_care_provider_assignments_updated_at BEFORE UPDATE ON public.vyva_user_care_provider_assignments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_campaigns_updated_at ON public.campaigns;
CREATE TRIGGER update_campaigns_updated_at BEFORE UPDATE ON public.campaigns FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_campaign_targets_updated_at ON public.campaign_targets;
CREATE TRIGGER update_campaign_targets_updated_at BEFORE UPDATE ON public.campaign_targets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
