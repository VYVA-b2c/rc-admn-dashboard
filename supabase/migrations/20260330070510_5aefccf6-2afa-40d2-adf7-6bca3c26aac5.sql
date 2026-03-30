
-- 1. Extend vyva_user_sensors with integration columns
ALTER TABLE public.vyva_user_sensors
  ADD COLUMN IF NOT EXISTS integration_method text DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS integration_config jsonb DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS notes text;

-- 2. Create sensor_type_catalog table
CREATE TABLE IF NOT EXISTS public.sensor_type_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type_key text UNIQUE NOT NULL,
  label text NOT NULL,
  is_custom boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Seed predefined types
INSERT INTO public.sensor_type_catalog (type_key, label, is_custom) VALUES
  ('heart_rate', 'Heart Rate', false),
  ('blood_pressure', 'Blood Pressure', false),
  ('fall_detector', 'Fall Detector', false),
  ('activity_monitor', 'Activity Monitor', false),
  ('temperature', 'Temperature', false),
  ('spo2', 'SpO2 / Oxygen', false),
  ('glucose', 'Glucose Monitor', false),
  ('sleep_tracker', 'Sleep Tracker', false)
ON CONFLICT (type_key) DO NOTHING;

-- 3. Enable RLS on sensor_type_catalog
ALTER TABLE public.sensor_type_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view sensor catalog"
  ON public.sensor_type_catalog FOR SELECT
  TO authenticated
  USING (is_admin_user(auth.uid()));

CREATE POLICY "Admins can insert sensor catalog"
  ON public.sensor_type_catalog FOR INSERT
  TO authenticated
  WITH CHECK (is_admin_user(auth.uid()));

-- 4. Add INSERT, UPDATE, DELETE policies on vyva_user_sensors for admins
CREATE POLICY "Admins can insert vyva_user_sensors"
  ON public.vyva_user_sensors FOR INSERT
  TO authenticated
  WITH CHECK (is_admin_user(auth.uid()));

CREATE POLICY "Admins can update vyva_user_sensors"
  ON public.vyva_user_sensors FOR UPDATE
  TO authenticated
  USING (is_admin_user(auth.uid()))
  WITH CHECK (is_admin_user(auth.uid()));

CREATE POLICY "Admins can delete vyva_user_sensors"
  ON public.vyva_user_sensors FOR DELETE
  TO authenticated
  USING (is_admin_user(auth.uid()));
