
CREATE TABLE public.vyva_medication_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vyva_user_id uuid NOT NULL REFERENCES public.vyva_users(id) ON DELETE CASCADE,
  medication_id uuid NOT NULL REFERENCES public.vyva_user_medications(id) ON DELETE CASCADE,
  scheduled_date date NOT NULL,
  scheduled_time text,
  status text NOT NULL DEFAULT 'pending',
  reported_at timestamptz,
  call_id text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(medication_id, scheduled_date, scheduled_time)
);

ALTER TABLE public.vyva_medication_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view medication logs" ON public.vyva_medication_logs
  FOR SELECT TO authenticated USING (public.is_admin_user(auth.uid()));

CREATE POLICY "Admins can insert medication logs" ON public.vyva_medication_logs
  FOR INSERT TO authenticated WITH CHECK (public.is_admin_user(auth.uid()));

CREATE POLICY "Admins can update medication logs" ON public.vyva_medication_logs
  FOR UPDATE TO authenticated USING (public.is_admin_user(auth.uid())) WITH CHECK (public.is_admin_user(auth.uid()));
