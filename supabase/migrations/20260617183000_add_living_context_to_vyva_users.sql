ALTER TABLE public.vyva_users
  ADD COLUMN IF NOT EXISTS living_context TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'vyva_users_living_context_check'
  ) THEN
    ALTER TABLE public.vyva_users
      ADD CONSTRAINT vyva_users_living_context_check
      CHECK (living_context IN ('alone', 'partner', 'family'));
  END IF;
END $$;
