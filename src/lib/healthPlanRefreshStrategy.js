function text(value) {
  return String(value || "").trim();
}

function unique(values) {
  return [...new Set((Array.isArray(values) ? values : []).map((value) => text(value)).filter(Boolean))];
}

function sectionPriorityRank(value) {
  if (value === "high") return 3;
  if (value === "medium") return 2;
  return 1;
}

const DEFAULT_SECTIONS = [
  "goals_json",
  "daily_support_json",
  "monitoring_json",
  "escalation_json",
  "caregiver_guidance_json",
];

function pushReason(map, sectionKey, priority, reason) {
  const normalizedSectionKey = text(sectionKey);
  const normalizedReason = text(reason);
  if (!normalizedSectionKey || !normalizedReason) return;
  if (!map.has(normalizedSectionKey)) {
    map.set(normalizedSectionKey, { priority: "low", reasons: [] });
  }
  const entry = map.get(normalizedSectionKey);
  if (sectionPriorityRank(priority) > sectionPriorityRank(entry.priority)) {
    entry.priority = priority;
  }
  if (!entry.reasons.includes(normalizedReason)) {
    entry.reasons.push(normalizedReason);
  }
}

function issueSectionKeys(clinicalCautionIssues = []) {
  return unique((Array.isArray(clinicalCautionIssues) ? clinicalCautionIssues : []).map((item) => item?.section_key));
}

export function buildHealthPlanRefreshStrategy({
  freshness = null,
  sectionDrift = [],
  clinicalCautions = [],
  clinicalCautionIssues = [],
  reviewGovernance = null,
  followThrough = null,
} = {}) {
  const reasonMap = new Map();
  const driftItems = Array.isArray(sectionDrift) ? sectionDrift : [];
  const cautionItems = Array.isArray(clinicalCautions) ? clinicalCautions : [];
  const cautionIssues = Array.isArray(clinicalCautionIssues) ? clinicalCautionIssues : [];

  for (const item of driftItems) {
    const sectionKey = text(item?.section_key);
    if (!sectionKey || sectionKey === "summary") continue;
    if (item?.status === "needs_refresh") {
      pushReason(reasonMap, sectionKey, "high", text(item?.reasons?.[0]) || "This section is marked as needing refresh.");
    } else if (item?.status === "mixed") {
      pushReason(reasonMap, sectionKey, "medium", text(item?.reasons?.[0]) || "This section is carrying mixed live evidence.");
    }
  }

  for (const issue of cautionIssues) {
    const sectionKey = text(issue?.section_key);
    if (!sectionKey || sectionKey === "summary") continue;
    pushReason(reasonMap, sectionKey, "high", text(issue?.message) || "This section is not yet covering an active clinical caution clearly enough.");
  }

  for (const caution of cautionItems) {
    if (text(caution?.severity) !== "high") continue;
    for (const sectionKey of unique(caution?.section_keys)) {
      if (!sectionKey || sectionKey === "summary") continue;
      pushReason(
        reasonMap,
        sectionKey,
        sectionKey === "escalation_json" || sectionKey === "monitoring_json" ? "high" : "medium",
        text(caution?.guidance) || text(caution?.detail) || "A high-risk caution is active here.",
      );
    }
  }

  if (text(freshness?.status) === "critical") {
    pushReason(reasonMap, "monitoring_json", "high", text(freshness?.summary) || "Fresh caution signals have overtaken the current monitoring guidance.");
    pushReason(reasonMap, "escalation_json", "high", text(freshness?.recommendation) || "Escalation guidance should be updated before staff rely on this plan.");
    pushReason(reasonMap, "daily_support_json", "medium", "Daily support wording should catch up with the newer caution signals.");
  } else if (text(freshness?.status) === "stale") {
    pushReason(reasonMap, "monitoring_json", "high", text(freshness?.summary) || "Monitoring should be refreshed against the newer live record.");
    pushReason(reasonMap, "daily_support_json", "medium", text(freshness?.recommendation) || "Some day-to-day guidance should be refreshed before reuse.");
  } else if (text(freshness?.status) === "aging") {
    pushReason(reasonMap, "monitoring_json", "low", "Monitoring should be checked against the newest touchpoints before reuse.");
  }

  if (reviewGovernance?.review_required && text(reviewGovernance?.review_window) === "today") {
    pushReason(reasonMap, "monitoring_json", "high", text(reviewGovernance?.review_summary) || "The live signal mix still needs same-day review.");
    pushReason(reasonMap, "escalation_json", "high", "Escalation wording should stay aligned with same-day review pressure.");
  } else if (reviewGovernance?.review_required) {
    pushReason(reasonMap, "monitoring_json", "medium", text(reviewGovernance?.review_summary) || "This plan still needs staff review before reuse.");
  }

  if (text(followThrough?.status) === "needs_review") {
    pushReason(reasonMap, "monitoring_json", "high", text(followThrough?.summary) || "Follow-through says the live picture has moved on.");
    pushReason(reasonMap, "escalation_json", "medium", text(followThrough?.recommendation) || "Escalation wording should reflect the newer follow-through.");
  } else if (text(followThrough?.status) === "mixed") {
    pushReason(reasonMap, "monitoring_json", "medium", text(followThrough?.summary) || "Mixed follow-through should tighten monitoring language.");
  }

  const recommendations = [...reasonMap.entries()]
    .map(([section_key, value]) => ({
      section_key,
      priority: value.priority,
      reasons: value.reasons.slice(0, 3),
    }))
    .sort((left, right) => {
      const byPriority = sectionPriorityRank(right.priority) - sectionPriorityRank(left.priority);
      if (byPriority !== 0) return byPriority;
      return left.section_key.localeCompare(right.section_key);
    });

  const refreshNowSectionKeys = recommendations
    .filter((item) => item.priority === "high" || item.priority === "medium")
    .map((item) => item.section_key);

  const fullRegenerationPreferred =
    Boolean(freshness?.should_regenerate)
    || (text(freshness?.status) === "critical" && refreshNowSectionKeys.length >= 3)
    || issueSectionKeys(cautionIssues).length >= 3;

  const summary =
    fullRegenerationPreferred
      ? "Several sections are under pressure at the same time, so a full regeneration is safer than a narrow patch."
      : recommendations.length === 0
        ? "No section stands out as requiring targeted regeneration right now."
        : "Refresh the highest-pressure sections first instead of rewriting the whole plan.";

  const recommendation =
    fullRegenerationPreferred
      ? "Use a full regenerate pass, then review the new plan before sharing it."
      : refreshNowSectionKeys.length > 0
        ? `Refresh ${refreshNowSectionKeys.length === 1 ? "this section" : "these sections"} first: ${refreshNowSectionKeys.join(", ")}.`
        : "Keep using the current plan with routine live verification.";

  return {
    full_regeneration_preferred: fullRegenerationPreferred,
    recommended_sections: recommendations,
    refresh_now_section_keys: refreshNowSectionKeys,
    low_priority_section_keys: recommendations.filter((item) => item.priority === "low").map((item) => item.section_key),
    stable_section_keys: DEFAULT_SECTIONS.filter((sectionKey) => !reasonMap.has(sectionKey)),
    summary,
    recommendation,
  };
}

export function expandHealthPlanRefreshSections(requestedSections = [], strategy = null) {
  const requested = unique(requestedSections);
  const recommendedHighPressure = unique(strategy?.refresh_now_section_keys);
  if (!recommendedHighPressure.length) return requested;
  const sectionSet = new Set(requested);

  for (const sectionKey of requested) {
    if (sectionKey === "monitoring_json" || sectionKey === "escalation_json") {
      recommendedHighPressure
        .filter((item) => item === "monitoring_json" || item === "escalation_json")
        .forEach((item) => sectionSet.add(item));
    }
  }

  return [...sectionSet];
}
