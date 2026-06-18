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

DROP TRIGGER IF EXISTS update_care_provider_contacts_updated_at ON public.care_provider_contacts;
CREATE TRIGGER update_care_provider_contacts_updated_at
  BEFORE UPDATE ON public.care_provider_contacts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_care_provider_assignments_updated_at ON public.vyva_user_care_provider_assignments;
CREATE TRIGGER update_care_provider_assignments_updated_at
  BEFORE UPDATE ON public.vyva_user_care_provider_assignments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
