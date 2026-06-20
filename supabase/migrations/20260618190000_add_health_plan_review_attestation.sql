ALTER TABLE public.vyva_user_health_plans
  ADD COLUMN IF NOT EXISTS review_valid_until TIMESTAMPTZ;

ALTER TABLE public.vyva_user_health_plans
  ADD COLUMN IF NOT EXISTS review_attestation_json JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.vyva_user_health_plan_revisions
  ADD COLUMN IF NOT EXISTS review_valid_until TIMESTAMPTZ;

ALTER TABLE public.vyva_user_health_plan_revisions
  ADD COLUMN IF NOT EXISTS review_attestation_json JSONB NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.vyva_user_health_plans
SET
  review_valid_until = COALESCE(review_valid_until, reviewed_at + INTERVAL '3 days'),
  review_attestation_json = CASE
    WHEN review_attestation_json = '{}'::jsonb AND review_status = 'reviewed'
      THEN jsonb_build_object(
        'approved_for_sharing', true,
        'checked_at', reviewed_at,
        'response_expectation', 'within_24h',
        'checklist_codes', jsonb_build_array('legacy_review_record'),
        'open_issue_codes', '[]'::jsonb,
        'reason_codes', '[]'::jsonb,
        'generation_confidence', generation_confidence,
        'audit_status', 'legacy',
        'review_status', 'legacy'
      )
    ELSE review_attestation_json
  END;

UPDATE public.vyva_user_health_plan_revisions
SET
  review_valid_until = COALESCE(review_valid_until, reviewed_at + INTERVAL '3 days'),
  review_attestation_json = CASE
    WHEN review_attestation_json = '{}'::jsonb AND review_status = 'reviewed'
      THEN jsonb_build_object(
        'approved_for_sharing', true,
        'checked_at', reviewed_at,
        'response_expectation', 'within_24h',
        'checklist_codes', jsonb_build_array('legacy_review_record'),
        'open_issue_codes', '[]'::jsonb,
        'reason_codes', '[]'::jsonb,
        'generation_confidence', generation_confidence,
        'audit_status', 'legacy',
        'review_status', 'legacy'
      )
    ELSE review_attestation_json
  END;
