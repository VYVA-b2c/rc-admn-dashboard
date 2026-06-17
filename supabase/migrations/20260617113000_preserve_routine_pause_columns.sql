-- Preserve routine pause metadata as additive schema changes.
-- Deployment diff tools can otherwise misread these fields as removable.

ALTER TABLE IF EXISTS public.vyva_user_checkins
  ADD COLUMN IF NOT EXISTS paused_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pause_reason TEXT,
  ADD COLUMN IF NOT EXISTS pause_source TEXT;

ALTER TABLE IF EXISTS public.vyva_user_brain_coach
  ADD COLUMN IF NOT EXISTS paused_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pause_reason TEXT,
  ADD COLUMN IF NOT EXISTS pause_source TEXT;
