function text(value) {
  return String(value || "").trim();
}

function lower(value) {
  return text(value).toLowerCase();
}

function unique(values) {
  return [...new Set((Array.isArray(values) ? values : []).map((value) => text(value)).filter(Boolean))];
}

function objectValue(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function highSeverity(items = []) {
  return (Array.isArray(items) ? items : []).filter((item) => lower(item?.severity) === "high");
}

function mediumSeverity(items = []) {
  return (Array.isArray(items) ? items : []).filter((item) => lower(item?.severity) === "medium");
}

function lowConfidenceSections(confidenceProfile = null) {
  return (Array.isArray(confidenceProfile?.section_confidence) ? confidenceProfile.section_confidence : [])
    .filter((item) => lower(item?.max_confidence) === "low");
}

function pressureDomains(liveEvidenceSummary = null) {
  const domains = [
    { key: "service", value: liveEvidenceSummary?.service_engagement, label: "service engagement" },
    { key: "medication", value: liveEvidenceSummary?.medication_adherence, label: "medication adherence" },
    { key: "sensor", value: liveEvidenceSummary?.sensor_reliability, label: "sensor coverage" },
    { key: "contact", value: liveEvidenceSummary?.contact_pressure, label: "reachability" },
  ];
  return domains.filter((item) => lower(item?.value?.status) === "pressure");
}

function persistentPressureDomains(longitudinalMemory = null) {
  return (Array.isArray(longitudinalMemory?.domains) ? longitudinalMemory.domains : [])
    .filter((item) => lower(item?.status) === "persistent_pressure");
}

function addReason(target, next) {
  if (!next?.id || target.some((item) => item.id === next.id)) return;
  target.push({
    id: text(next.id),
    label: text(next.label),
    detail: text(next.detail),
    severity: lower(next.severity) === "high" ? "high" : lower(next.severity) === "low" ? "low" : "medium",
    section_keys: unique(next.section_keys),
  });
}

function summarizeActions(gaps = [], blockers = []) {
  const actions = [];
  const seen = new Set();
  const push = (id, label, action, priority = "medium") => {
    if (!text(action) || seen.has(id)) return;
    seen.add(id);
    actions.push({
      id,
      label: text(label) || "Collect more evidence",
      action: text(action),
      priority,
    });
  };

  for (const blocker of Array.isArray(blockers) ? blockers : []) {
    if (blocker.id === "multi-high-gap") {
      push("close-high-gaps", blocker.label, "Close the high-severity evidence gaps before asking the system to generate a new client-ready plan.", "high");
    } else if (blocker.id === "urgent-low-confidence-response") {
      push("urgent-verify-response", blocker.label, "Confirm same-day status, ownership, and fallback steps directly before regenerating the plan.", "high");
    } else if (blocker.id === "pressure-outpaces-evidence") {
      push("pressure-evidence-sync", blocker.label, "Gather fresher contact, medication, or alert evidence so the plan can match the live pressure safely.", "high");
    } else if (blocker.id === "critical-freshness-debt") {
      push("refresh-overrun", blocker.label, "Re-check the live record and replace stale assumptions before trusting another generated plan.", "high");
    }
  }

  for (const gap of Array.isArray(gaps) ? gaps : []) {
    push(text(gap?.id) || text(gap?.label), gap?.label, gap?.staff_action, lower(gap?.severity) === "high" ? "high" : "medium");
  }

  return actions.slice(0, 5);
}

export function buildHealthPlanReadiness({
  dataQualityGaps = [],
  confidenceProfile = null,
  reviewGovernance = null,
  liveEvidenceSummary = null,
  freshness = null,
  longitudinalMemory = null,
} = {}) {
  const gaps = Array.isArray(dataQualityGaps) ? dataQualityGaps : [];
  const highGaps = highSeverity(gaps);
  const mediumGaps = mediumSeverity(gaps);
  const lowConfidence = lowConfidenceSections(confidenceProfile);
  const urgentReview = Boolean(reviewGovernance?.review_required) && text(reviewGovernance?.review_window) === "today";
  const pressure = pressureDomains(liveEvidenceSummary);
  const persistentPressure = persistentPressureDomains(longitudinalMemory);
  const blockers = [];
  const cautions = [];

  if (highGaps.length >= 2) {
    addReason(blockers, {
      id: "multi-high-gap",
      label: "Too many high-severity evidence gaps are still open",
      detail: `The plan is missing or leaning on stale data in ${highGaps.slice(0, 3).map((gap) => text(gap.label)).filter(Boolean).join(", ")}.`,
      severity: "high",
    });
  }

  if (
    urgentReview
    && pressure.length > 0
    && lowConfidence.some((item) => ["monitoring_json", "escalation_json"].includes(text(item?.section_key)))
  ) {
    addReason(blockers, {
      id: "urgent-low-confidence-response",
      label: "Same-day pressure is outrunning the confidence of the response sections",
      detail: "Monitoring or escalation still has low-confidence inputs even though the live picture calls for same-day action.",
      severity: "high",
      section_keys: ["monitoring_json", "escalation_json"],
    });
  }

  if (pressure.length >= 2 && (highGaps.length >= 1 || lowConfidence.length >= 2)) {
    addReason(blockers, {
      id: "pressure-outpaces-evidence",
      label: "Live pressure is stronger than the evidence support behind the next plan",
      detail: `Pressure is active in ${pressure.slice(0, 3).map((item) => item.label).join(", ")}, but the evidence picture still has major blind spots.`,
      severity: "high",
    });
  }

  if (text(freshness?.status) === "critical" && (highGaps.length > 0 || lowConfidence.length > 0)) {
    addReason(blockers, {
      id: "critical-freshness-debt",
      label: "The last trusted picture has already been overtaken",
      detail: text(freshness?.summary) || "Fresh caution activity has overtaken the last trusted checkpoint while important evidence debt remains open.",
      severity: "high",
    });
  }

  if (highGaps.length === 1) {
    addReason(cautions, {
      id: "single-high-gap",
      label: "One high-severity evidence gap is still open",
      detail: text(highGaps[0]?.label) || "A major evidence gap is still open.",
      severity: "high",
    });
  }
  if (mediumGaps.length >= 2) {
    addReason(cautions, {
      id: "multiple-medium-gaps",
      label: "Several medium-severity evidence gaps are still open",
      detail: `${mediumGaps.length} medium-severity gaps are still shaping the plan.`,
      severity: "medium",
    });
  }
  if (lowConfidence.length > 0) {
    addReason(cautions, {
      id: "low-confidence-sections",
      label: "Some sections still need cautious wording",
      detail: `${lowConfidence.length} section${lowConfidence.length === 1 ? "" : "s"} still has a low confidence ceiling.`,
      severity: "medium",
      section_keys: lowConfidence.map((item) => item.section_key),
    });
  }
  if (urgentReview) {
    addReason(cautions, {
      id: "urgent-review-window",
      label: "The case still needs same-day human review",
      detail: text(reviewGovernance?.review_summary) || "The live signal mix still needs same-day review before staff rely on the plan heavily.",
      severity: "medium",
    });
  } else if (Boolean(reviewGovernance?.review_required)) {
    addReason(cautions, {
      id: "review-required",
      label: "The case still needs human review",
      detail: text(reviewGovernance?.review_summary) || "The live signal mix still needs human review before reuse.",
      severity: "medium",
    });
  }
  if (text(freshness?.status) === "stale") {
    addReason(cautions, {
      id: "stale-freshness",
      label: "The latest trusted checkpoint is starting to drift",
      detail: text(freshness?.summary) || "Parts of the live picture have moved on since the last trusted checkpoint.",
      severity: "medium",
    });
  }
  if (persistentPressure.length > 0) {
    addReason(cautions, {
      id: "persistent-pressure-patterns",
      label: "Longer-pattern pressure is still resurfacing",
      detail: text(longitudinalMemory?.summary) || "One or more pressure areas keeps resurfacing across recent plan cycles.",
      severity: "medium",
    });
  }

  const overallStatus = blockers.length > 0 ? "blocked" : cautions.length > 0 ? "guarded" : "ready";
  const summary =
    overallStatus === "blocked"
      ? "The evidence picture is not strong enough for a safe new generated plan yet. Staff should collect the missing signals first."
      : overallStatus === "guarded"
        ? "A plan can still be generated, but it should stay cautious because parts of the evidence picture are still incomplete or under pressure."
        : "The current evidence picture is broad enough to support a personalized plan without major readiness blockers.";

  return {
    overall_status: overallStatus,
    summary,
    should_block_generation: blockers.length > 0,
    safe_to_share: blockers.length === 0 && !Boolean(reviewGovernance?.review_required),
    blocking_reasons: blockers,
    caution_reasons: cautions.slice(0, 5),
    collection_actions: summarizeActions(gaps, blockers),
    blocker_count: blockers.length,
    caution_count: cautions.length,
    high_gap_count: highGaps.length,
    low_confidence_section_count: lowConfidence.length,
    live_pressure_count: pressure.length,
  };
}

export function shouldBlockHealthPlanReadiness(readiness) {
  const normalized = objectValue(readiness);
  if (!normalized) return false;
  return Boolean(normalized.should_block_generation) || lower(normalized.overall_status) === "blocked";
}
