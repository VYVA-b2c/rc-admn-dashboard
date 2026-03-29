
-- Add new columns to vyva_users for extended bio
ALTER TABLE public.vyva_users
  ADD COLUMN IF NOT EXISTS date_of_birth date,
  ADD COLUMN IF NOT EXISTS gender text,
  ADD COLUMN IF NOT EXISTS language text DEFAULT 'nl',
  ADD COLUMN IF NOT EXISTS photo_url text,
  ADD COLUMN IF NOT EXISTS emergency_notes text;

-- Sensor devices table
CREATE TABLE public.vyva_user_sensors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vyva_user_id uuid NOT NULL REFERENCES public.vyva_users(id) ON DELETE CASCADE,
  device_id text NOT NULL,
  sensor_type text NOT NULL, -- heart_rate, blood_pressure, fall_detector, activity_monitor
  device_name text,
  battery_level integer,
  status text NOT NULL DEFAULT 'offline', -- online, offline, alert
  last_reading_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Sensor readings table
CREATE TABLE public.vyva_sensor_readings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sensor_id uuid NOT NULL REFERENCES public.vyva_user_sensors(id) ON DELETE CASCADE,
  value numeric NOT NULL,
  unit text NOT NULL,
  is_anomaly boolean NOT NULL DEFAULT false,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Sensor alerts table
CREATE TABLE public.vyva_sensor_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sensor_id uuid NOT NULL REFERENCES public.vyva_user_sensors(id) ON DELETE CASCADE,
  vyva_user_id uuid NOT NULL REFERENCES public.vyva_users(id) ON DELETE CASCADE,
  alert_type text NOT NULL, -- fall_detected, abnormal_heart_rate, device_offline, low_battery
  severity text NOT NULL DEFAULT 'warning', -- critical, warning, info
  message text,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.vyva_user_sensors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vyva_sensor_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vyva_sensor_alerts ENABLE ROW LEVEL SECURITY;

-- RLS policies for admin access
CREATE POLICY "Admin users can view vyva_user_sensors" ON public.vyva_user_sensors FOR SELECT TO authenticated USING (is_admin_user(auth.uid()));
CREATE POLICY "Admin users can view vyva_sensor_readings" ON public.vyva_sensor_readings FOR SELECT TO authenticated USING (is_admin_user(auth.uid()));
CREATE POLICY "Admin users can view vyva_sensor_alerts" ON public.vyva_sensor_alerts FOR SELECT TO authenticated USING (is_admin_user(auth.uid()));

-- Update triggers
CREATE TRIGGER update_vyva_user_sensors_updated_at BEFORE UPDATE ON public.vyva_user_sensors FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
