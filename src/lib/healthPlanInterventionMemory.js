const SECTION_LABELS = {
  goals_json: "Goals",
  daily_support_json: "Daily support",
  monitoring_json: "Monitoring",
  escalation_json: "Escalation",
  caregiver_guidance_json: "Caregiver guidance",
};

const DOMAIN_DEFINITIONS = [
  {
    id: "daily-support-routine",
    label: "Daily support routine",
    section_keys: ["daily_support_json"],
    positive_signal_ids: ["checkin-since-plan", "brain-coach-since-plan"],
    caution_signal_ids: ["no-fresh-touchpoints", "plan-age"],
    gap_ids: ["checkins-freshness-gap", "brainCoach-freshness-gap"],
  },
  {
    id: "medication-routine",
    label: "Medication routine",
    section_keys: ["daily_support_json", "monitoring_json"],
    positive_signal_ids: ["medication-since-plan"],
    caution_signal_ids: ["no-fresh-touchpoints"],
    gap_ids: ["medication-timing-gap", "medication-adherence-gap", "medication-freshness-gap"],
  },
  {
    id: "monitoring-watch",
    label: "Monitoring watch",
    section_keys: ["monitoring_json"],
    positive_signal_ids: ["risk-improved"],
    caution_signal_ids: ["risk-worsened", "no-fresh-touchpoints", "plan-age"],
    gap_ids: ["sensor-visibility-gap", "sensor-freshness-gap", "predictive-coverage-gap", "predictive-freshness-gap"],
  },
  {
    id: "escalation-response",
    label: "Escalation response",
    section_keys: ["escalation_json"],
    positive_signal_ids: ["resolved-alerts-since-plan"],
    caution_signal_ids: ["new-alerts-since-plan", "lingering-alerts", "risk-worsened"],
    gap_ids: ["sensor-visibility-gap", "predictive-coverage-gap", "predictive-freshness-gap"],
  },
  {
    id: "caregiver-reinforcement",
    label: "Caregiver reinforcement",
    section_keys: ["caregiver_guidance_json"],
    positive_signal_ids: [],
    caution_signal_ids: [],
    gap_ids: ["care-circle-gap", "sharing-boundary-gap"],
  },
  {
    id: "daily-life-fit",
    label: "Daily-life fit",
    section_keys: ["goals_json"],
    positive_signal_ids: ["risk-improved"],
    caution_signal_ids: ["risk-worsened", "plan-age"],
    gap_ids: ["profile-context-gap"],
  },
];

function text(value) {
  return String(value || "").trim();
}

function unique(values) {
  return [...new Set((Array.isArray(values) ? values : []).map((value) => text(value)).filter(Boolean))];
}

function sortByStatus(left, right) {
  const order = { fragile: 0, unproven: 1, helping: 2 };
  const leftScore = order[text(left?.status)] ?? 99;
  const rightScore = order[text(right?.status)] ?? 99;
  if (leftScore !== rightScore) return leftScore - rightScore;
  return text(left?.label).localeCompare(text(right?.label));
}

function normalizeCompletedActions(actions) {
  return (Array.isArray(actions) ? actions : []).map((item) => ({
    action_id: text(item?.action_id || item?.id),
    title: text(item?.title),
    section_key: text(item?.section_key) || null,
  })).filter((item) => item.action_id || item.title);
}

function normalizeFeedbackEntries(entries) {
  return (Array.isArray(entries) ? entries : []).map((item) => ({
    section_key: text(item?.section_key),
    outcome: text(item?.outcome),
    note: text(item?.note) || null,
    recorded_at: text(item?.recorded_at) || null,
  })).filter((item) => item.section_key && item.outcome);
}

function summarizeEvidence(items) {
  return unique((Array.isArray(items) ? items : []).flatMap((item) => item?.source_signal_ids || []));
}

function hasSectionContent(plan, sectionKeys) {
  return sectionKeys.some((sectionKey) => Array.isArray(plan?.[sectionKey]) && plan[sectionKey].length > 0);
}

function relevantCompletedActions(actions, sectionKeys) {
  return normalizeCompletedActions(actions).filter((item) => {
    if (item.section_key && sectionKeys.includes(item.section_key)) return true;
    return !item.section_key && item.title;
  });
}

function relevantFeedbackEntries(entries, sectionKeys) {
  return normalizeFeedbackEntries(entries)
    .filter((item) => sectionKeys.includes(item.section_key))
    .sort((left, right) => {
      const leftTime = left.recorded_at ? new Date(left.recorded_at).getTime() : 0;
      const rightTime = right.recorded_at ? new Date(right.recorded_at).getTime() : 0;
      return rightTime - leftTime;
    });
}

function shouldIncludeDomain(domain, plan, gaps, followThrough, driftLookup, completedActions, feedbackEntries) {
  if (hasSectionContent(plan, domain.section_keys)) return true;
  if ((Array.isArray(gaps) ? gaps : []).some((gap) => domain.gap_ids.includes(text(gap?.id)))) return true;
  if ((Array.isArray(followThrough?.positive_signals) ? followThrough.positive_signals : []).some((signal) => domain.positive_signal_ids.includes(text(signal?.id)))) return true;
  if ((Array.isArray(followThrough?.caution_signals) ? followThrough.caution_signals : []).some((signal) => domain.caution_signal_ids.includes(text(signal?.id)))) return true;
  if (domain.section_keys.some((sectionKey) => driftLookup.has(sectionKey))) return true;
  if (relevantCompletedActions(completedActions, domain.section_keys).length > 0) return true;
  if (relevantFeedbackEntries(feedbackEntries, domain.section_keys).length > 0) return true;
  return false;
}

export function buildHealthPlanInterventionMemory({
  plan = null,
  dataQualityGaps = [],
  followThrough = null,
  sectionDrift = [],
  completedActions = [],
  feedbackEntries = [],
} = {}) {
  if (!plan) return [];

  const gaps = Array.isArray(dataQualityGaps) ? dataQualityGaps : [];
  const driftLookup = new Map(
    (Array.isArray(sectionDrift) ? sectionDrift : [])
      .map((item) => [text(item?.section_key), item])
      .filter(([sectionKey]) => sectionKey),
  );

  return DOMAIN_DEFINITIONS
    .filter((domain) => shouldIncludeDomain(domain, plan, gaps, followThrough, driftLookup, completedActions, feedbackEntries))
    .map((domain) => {
      const relevantPositive = (Array.isArray(followThrough?.positive_signals) ? followThrough.positive_signals : [])
        .filter((signal) => domain.positive_signal_ids.includes(text(signal?.id)));
      const relevantCaution = (Array.isArray(followThrough?.caution_signals) ? followThrough.caution_signals : [])
        .filter((signal) => domain.caution_signal_ids.includes(text(signal?.id)));
      const relevantGaps = gaps.filter((gap) => domain.gap_ids.includes(text(gap?.id)));
      const relevantDrift = domain.section_keys
        .map((sectionKey) => driftLookup.get(sectionKey))
        .filter(Boolean);
      const relevantCompleted = relevantCompletedActions(completedActions, domain.section_keys);
      const relevantFeedback = relevantFeedbackEntries(feedbackEntries, domain.section_keys);
      const latestFeedback = relevantFeedback[0] || null;
      const signalIds = summarizeEvidence(domain.section_keys.flatMap((sectionKey) => plan?.[sectionKey] || []));
      const hasEvidenceLinkedItems = signalIds.length > 0;
      const hasFragileDrift = relevantDrift.some((item) => text(item?.status) === "needs_refresh");
      const hasFragileSignals = relevantCaution.length > 0;

      let status = "unproven";
      let reason = "This part of the plan still needs more client-specific evidence before staff can trust it fully.";

      if (hasFragileDrift || hasFragileSignals) {
        status = "fragile";
        reason =
          text(relevantDrift.find((item) => text(item?.status) === "needs_refresh")?.reasons?.[0])
          || text(relevantCaution[0]?.detail)
          || text(relevantCaution[0]?.label)
          || "New signals suggest this routine may no longer be reliable without review.";
      } else if (latestFeedback?.outcome === "did_not_help" || latestFeedback?.outcome === "needs_follow_up") {
        status = "fragile";
        reason =
          latestFeedback.note
          || (latestFeedback.outcome === "did_not_help"
            ? "Staff recorded that this routine did not hold up well in practice."
            : "Staff recorded that this routine still needs follow-up before it can be trusted.");
      } else if (latestFeedback?.outcome === "helped") {
        status = "helping";
        reason = latestFeedback.note || "Staff recorded that this routine helped in practice and should be preserved unless newer evidence contradicts it.";
      } else if (latestFeedback?.outcome === "mixed") {
        status = "unproven";
        reason = latestFeedback.note || "Staff recorded a mixed result, so this routine likely needs refinement before it becomes dependable.";
      } else if (relevantPositive.length > 0) {
        status = "helping";
        reason =
          text(relevantPositive[0]?.detail)
          || text(relevantPositive[0]?.label)
          || "Recent follow-through suggests this routine is helping and should be preserved.";
      } else if (relevantCompleted.length > 0) {
        status = "unproven";
        reason = `Staff recently confirmed ${text(relevantCompleted[0]?.title).toLowerCase() || "this routine"}, but fresh outcome evidence is still limited.`;
      } else if (relevantGaps.length > 0) {
        status = "unproven";
        reason =
          text(relevantGaps[0]?.detail)
          || text(relevantGaps[0]?.label)
          || "Inputs for this routine are incomplete, so the current guidance should stay conservative.";
      } else if (!hasEvidenceLinkedItems) {
        status = "unproven";
        reason = "This part of the saved plan has little evidence linked back to current source signals yet.";
      }

      const supportingPoints = unique([
        ...relevantFeedback.map((item) => item.note || item.outcome),
        ...relevantPositive.map((item) => text(item?.label)),
        ...relevantCaution.map((item) => text(item?.label)),
        ...relevantCompleted.map((item) => item.title),
        ...relevantGaps.map((item) => text(item?.label)),
      ]).slice(0, 4);

      return {
        id: domain.id,
        label: domain.label,
        status,
        reason,
        section_keys: domain.section_keys,
        section_labels: domain.section_keys.map((sectionKey) => SECTION_LABELS[sectionKey] || sectionKey),
        supporting_points: supportingPoints,
        signal_ids: signalIds,
      };
    })
    .sort(sortByStatus);
}

export function buildHealthPlanInterventionMemoryBrief(items = []) {
  return (Array.isArray(items) ? items : [])
    .slice(0, 6)
    .map((item) => ({
      id: text(item?.id),
      label: text(item?.label),
      status: text(item?.status) || "unproven",
      reason: text(item?.reason),
      section_labels: unique(item?.section_labels),
      supporting_points: unique(item?.supporting_points).slice(0, 4),
      signal_ids: unique(item?.signal_ids),
    }))
    .filter((item) => item.id && item.label && item.reason);
}
