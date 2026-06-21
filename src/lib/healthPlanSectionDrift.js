const SECTION_KEYS = [
  "goals_json",
  "daily_support_json",
  "monitoring_json",
  "escalation_json",
  "caregiver_guidance_json",
];

function text(value) {
  return String(value || "").trim();
}

function sectionLabel(sectionKey) {
  if (sectionKey === "goals_json") return "Goals";
  if (sectionKey === "daily_support_json") return "Daily support";
  if (sectionKey === "monitoring_json") return "Monitoring";
  if (sectionKey === "escalation_json") return "Escalation";
  if (sectionKey === "caregiver_guidance_json") return "Caregiver guidance";
  return sectionKey;
}

function unique(values) {
  return [...new Set((Array.isArray(values) ? values : []).map((value) => text(value)).filter(Boolean))];
}

function addReason(target, reason) {
  const value = text(reason);
  if (value && !target.includes(value)) target.push(value);
}

function severityScore(status) {
  if (status === "needs_refresh") return 3;
  if (status === "mixed") return 2;
  return 1;
}

function statusFromReasons(needsRefreshReasons, mixedReasons) {
  if (needsRefreshReasons.length > 0) return "needs_refresh";
  if (mixedReasons.length > 0) return "mixed";
  return "fresh";
}

export function buildHealthPlanSectionDrift({
  plan = null,
  dataQualityGaps = [],
  followThrough = null,
} = {}) {
  if (!plan) return [];

  const gaps = Array.isArray(dataQualityGaps) ? dataQualityGaps : [];
  const cautionIds = new Set(unique(followThrough?.caution_signals?.map((signal) => signal?.id)));
  const drift = SECTION_KEYS.map((sectionKey) => {
    const needsRefreshReasons = [];
    const mixedReasons = [];

    if (sectionKey === "goals_json") {
      if (gaps.some((gap) => gap?.id === "profile-context-gap" || gap?.id === "predictive-coverage-gap")) {
        addReason(mixedReasons, "Client context is thinner than the goals assume.");
      }
      if (cautionIds.has("risk-worsened") || cautionIds.has("plan-age")) {
        addReason(needsRefreshReasons, "Client risk has moved since these goals were written.");
      }
    }

    if (sectionKey === "daily_support_json") {
      if (gaps.some((gap) => ["medication-timing-gap", "medication-freshness-gap", "checkins-freshness-gap", "brainCoach-freshness-gap"].includes(gap?.id))) {
        addReason(needsRefreshReasons, "Daily routines are relying on schedules or service activity that may no longer be current.");
      }
      if (cautionIds.has("no-fresh-touchpoints")) {
        addReason(mixedReasons, "There has been limited fresh follow-through since the plan was generated.");
      }
    }

    if (sectionKey === "monitoring_json") {
      if (gaps.some((gap) => ["sensor-visibility-gap", "sensor-freshness-gap", "predictive-freshness-gap", "predictive-coverage-gap"].includes(gap?.id))) {
        addReason(needsRefreshReasons, "Monitoring is leaning on signals that are missing or aging.");
      }
      if (cautionIds.has("new-alerts-since-plan") || cautionIds.has("lingering-alerts") || cautionIds.has("risk-worsened")) {
        addReason(needsRefreshReasons, "New or unresolved warning signals have appeared since the plan was written.");
      }
    }

    if (sectionKey === "escalation_json") {
      if (cautionIds.has("new-alerts-since-plan") || cautionIds.has("risk-worsened")) {
        addReason(needsRefreshReasons, "Escalation logic should be re-checked against the newest alert or risk changes.");
      }
      if (gaps.some((gap) => ["predictive-freshness-gap", "sensor-visibility-gap", "sensor-freshness-gap"].includes(gap?.id))) {
        addReason(mixedReasons, "Escalation triggers may be less reliable because key warning signals are stale or incomplete.");
      }
    }

    if (sectionKey === "caregiver_guidance_json") {
      if (gaps.some((gap) => gap?.id === "sharing-boundary-gap" || gap?.id === "care-circle-gap")) {
        addReason(needsRefreshReasons, "Caregiver guidance depends on sharing or care-circle assumptions that are no longer solid.");
      }
      if (cautionIds.has("new-alerts-since-plan") || cautionIds.has("no-fresh-touchpoints")) {
        addReason(mixedReasons, "Caregiver messaging may need to catch up with what has or has not happened since the plan was generated.");
      }
    }

    const status = statusFromReasons(needsRefreshReasons, mixedReasons);
    return {
      section_key: sectionKey,
      label: sectionLabel(sectionKey),
      status,
      reasons: status === "needs_refresh" ? needsRefreshReasons : mixedReasons,
    };
  });

  return drift.sort((left, right) => severityScore(right.status) - severityScore(left.status));
}
