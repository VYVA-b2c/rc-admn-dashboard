function scenario({
  id,
  label,
  sourceSignals,
  evidencePack,
  reviewPriorities,
  confidenceProfile,
  followThrough,
  expectations,
}) {
  return {
    id,
    label,
    sourceSignals,
    evidencePack,
    reviewPriorities,
    confidenceProfile,
    followThrough,
    expectations,
  };
}

export const healthPlanGoldenCases = [
  scenario({
    id: "urgent_unreachable_fall_risk",
    label: "Urgent unreachable fall risk",
    sourceSignals: [
      { id: "alert-active", label: "Active fall alert", category: "alert", strength: "high", detail: "A fall alert is open and no confirmation has been logged yet." },
      { id: "service-checkins", label: "Missed check-ins", category: "service", strength: "high", detail: "Two scheduled check-ins were missed today." },
      { id: "care-circle-context", label: "Caregiver backup", category: "care-circle", strength: "medium", detail: "A caregiver exists but has not confirmed contact yet." },
    ],
    evidencePack: {
      same_day_response_required: true,
      must_address_facts: [
        { label: "Active fall alert", response_window: "today", priority: "high", source_signal_ids: ["alert-active"] },
        { label: "Repeated missed check-ins today", response_window: "today", priority: "high", source_signal_ids: ["service-checkins"] },
      ],
      verification_needs: [
        { label: "Confirm whether the client is reachable right now", severity: "high", source_signal_ids: ["service-checkins"] },
      ],
      stabilizing_facts: [
        { label: "Caregiver backup can still help if engaged clearly", source_signal_ids: ["care-circle-context"] },
      ],
    },
    reviewPriorities: {
      items: [
        { section_key: "monitoring_json", priority: "high", response_window: "today" },
        { section_key: "escalation_json", priority: "high", response_window: "today" },
      ],
    },
    confidenceProfile: {
      section_confidence: [
        { section_key: "monitoring_json", max_confidence: "medium" },
        { section_key: "escalation_json", max_confidence: "medium" },
      ],
    },
    followThrough: { status: "needs_review" },
    expectations: {
      required_sections: ["monitoring_json", "escalation_json"],
      section_keywords: [
        { section_key: "monitoring_json", keywords: ["verify", "today"] },
        { section_key: "escalation_json", keywords: ["escalate", "fallback"] },
      ],
      required_timings: [
        { section_key: "monitoring_json", timing: "today" },
        { section_key: "escalation_json", timing: "today" },
      ],
      require_verification_language: true,
    },
  }),
  scenario({
    id: "medication_uncertainty_and_adherence_slip",
    label: "Medication uncertainty and adherence slip",
    sourceSignals: [
      { id: "medication-plan", label: "Unconfirmed medication doses", category: "medication", strength: "high", detail: "Three doses are unconfirmed this week." },
      { id: "service-checkins", label: "Support routine", category: "service", strength: "medium", detail: "Morning support calls usually improve adherence." },
      { id: "care-circle-context", label: "Caregiver reinforcement", category: "care-circle", strength: "medium", detail: "A caregiver can reinforce medication cues if asked clearly." },
    ],
    evidencePack: {
      same_day_response_required: false,
      must_address_facts: [
        { label: "Unconfirmed medication doses", response_window: "this_week", priority: "high", source_signal_ids: ["medication-plan"] },
      ],
      verification_needs: [
        { label: "Confirm whether reminder times still match the real routine", severity: "high", source_signal_ids: ["medication-plan"] },
      ],
      stabilizing_facts: [
        { label: "Morning support calls improve adherence", source_signal_ids: ["service-checkins"] },
      ],
    },
    reviewPriorities: {
      items: [
        { section_key: "daily_support_json", priority: "high", response_window: "this_week" },
        { section_key: "monitoring_json", priority: "medium", response_window: "this_week" },
      ],
    },
    confidenceProfile: {
      section_confidence: [
        { section_key: "daily_support_json", max_confidence: "medium" },
      ],
    },
    followThrough: { status: "mixed" },
    expectations: {
      required_sections: ["daily_support_json", "monitoring_json"],
      section_keywords: [
        { section_key: "daily_support_json", keywords: ["medication", "confirm"] },
        { section_key: "monitoring_json", keywords: ["dose", "review"] },
      ],
      preserve_keywords: ["morning support", "call"],
      require_verification_language: true,
    },
  }),
  scenario({
    id: "caregiver_gap_with_consent_limit",
    label: "Caregiver gap with consent limit",
    sourceSignals: [
      { id: "care-circle-context", label: "No active care provider", category: "care-circle", strength: "high", detail: "The client has no confirmed support owner right now." },
      { id: "consent-family-sharing", label: "Consent needs confirmation", category: "context", strength: "medium", detail: "Family sharing consent is limited and must be reconfirmed." },
      { id: "service-checkins", label: "Check-in routine", category: "service", strength: "medium", detail: "Check-ins are active but escalation ownership is unclear." },
    ],
    evidencePack: {
      same_day_response_required: false,
      must_address_facts: [
        { label: "No active care provider", response_window: "this_week", priority: "high", source_signal_ids: ["care-circle-context"] },
      ],
      verification_needs: [
        { label: "Reconfirm family-sharing consent before escalating updates", severity: "high", source_signal_ids: ["consent-family-sharing"] },
      ],
      stabilizing_facts: [
        { label: "Check-ins still provide some contact continuity", source_signal_ids: ["service-checkins"] },
      ],
    },
    reviewPriorities: {
      items: [
        { section_key: "caregiver_guidance_json", priority: "high", response_window: "this_week" },
      ],
    },
    confidenceProfile: {
      section_confidence: [
        { section_key: "caregiver_guidance_json", max_confidence: "medium" },
      ],
    },
    followThrough: { status: "mixed" },
    expectations: {
      required_sections: ["caregiver_guidance_json"],
      section_keywords: [
        { section_key: "caregiver_guidance_json", keywords: ["consent", "confirm"] },
      ],
      preserve_keywords: ["check-in"],
      require_verification_language: true,
    },
  }),
  scenario({
    id: "sensor_pressure_with_reporting_conflict",
    label: "Sensor pressure with reporting conflict",
    sourceSignals: [
      { id: "sensor-status", label: "Sensor offline", category: "sensor", strength: "high", detail: "The home sensor has stopped reporting." },
      { id: "alert-active", label: "Open safety alert", category: "alert", strength: "high", detail: "A safety alert remains open while the device is silent." },
      { id: "risk-latest-score", label: "Rising predictive risk", category: "risk", strength: "medium", detail: "Risk trend is worsening." },
    ],
    evidencePack: {
      same_day_response_required: true,
      must_address_facts: [
        { label: "Sensor offline while alert remains open", response_window: "today", priority: "high", source_signal_ids: ["sensor-status", "alert-active"] },
      ],
      verification_needs: [
        { label: "Confirm whether the silence reflects device failure or client risk", severity: "high", source_signal_ids: ["sensor-status"] },
      ],
      stabilizing_facts: [],
    },
    reviewPriorities: {
      items: [
        { section_key: "monitoring_json", priority: "high", response_window: "today" },
        { section_key: "escalation_json", priority: "high", response_window: "today" },
      ],
    },
    confidenceProfile: {
      section_confidence: [
        { section_key: "monitoring_json", max_confidence: "low" },
      ],
    },
    followThrough: { status: "needs_review" },
    expectations: {
      required_sections: ["monitoring_json", "escalation_json"],
      section_keywords: [
        { section_key: "monitoring_json", keywords: ["sensor", "verify"] },
        { section_key: "escalation_json", keywords: ["today", "escalate"] },
      ],
      required_timings: [
        { section_key: "monitoring_json", timing: "today" },
      ],
      require_verification_language: true,
    },
  }),
];

export function getHealthPlanGoldenCase(caseId) {
  return healthPlanGoldenCases.find((item) => item.id === caseId) || null;
}
