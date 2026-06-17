ALTER TABLE public.vyva_user_medications
  ADD COLUMN IF NOT EXISTS frequency TEXT;
