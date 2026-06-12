-- Operational map layers: Red Cross offices and field staff.

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

ALTER TABLE public.operational_offices ENABLE ROW LEVEL SECURITY;

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

ALTER TABLE public.field_staff ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin users can view operational_offices" ON public.operational_offices;
CREATE POLICY "Admin users can view operational_offices" ON public.operational_offices
  FOR SELECT TO authenticated
  USING (public.is_admin_user(auth.uid()));

DROP POLICY IF EXISTS "Admins and coordinators can manage operational_offices" ON public.operational_offices;
CREATE POLICY "Admins and coordinators can manage operational_offices" ON public.operational_offices
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'coordinator'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'coordinator'));

DROP POLICY IF EXISTS "Admin users can view field_staff" ON public.field_staff;
CREATE POLICY "Admin users can view field_staff" ON public.field_staff
  FOR SELECT TO authenticated
  USING (public.is_admin_user(auth.uid()));

DROP POLICY IF EXISTS "Admins and coordinators can manage field_staff" ON public.field_staff;
CREATE POLICY "Admins and coordinators can manage field_staff" ON public.field_staff
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'coordinator'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'coordinator'));

DROP TRIGGER IF EXISTS update_operational_offices_updated_at ON public.operational_offices;
CREATE TRIGGER update_operational_offices_updated_at
  BEFORE UPDATE ON public.operational_offices
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_field_staff_updated_at ON public.field_staff;
CREATE TRIGGER update_field_staff_updated_at
  BEFORE UPDATE ON public.field_staff
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
