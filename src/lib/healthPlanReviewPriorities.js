const SECTION_DEFINITIONS = [
  { section_key: "goals_json", label: "Goals" },
  { section_key: "daily_support_json", label: "Daily support" },
  { section_key: "monitoring_json", label: "Monitoring" },
  { section_key: "escalation_json", label: "Escalation" },
  { section_key: "caregiver_guidance_json", label: "Caregiver guidance" },
];

function text(value) {
  return String(value || "").trim();
}

function lower(value) {
  return text(value).toLowerCase();
}

function unique(values) {
  return [...new Set((Array.isArray(values) ? values : []).map((value) => text(value)).filter(Boolean))];
}

function sectionLabel(sectionKey) {
  return SECTION_DEFINITIONS.find((item) => item.section_key === sectionKey)?.label || text(sectionKey) || "Section";
}

function severityScore(value) {
  if (value === "high") return 3;
  if (value === "medium") return 2;
  return 1;
}

function priorityRank(value) {
  if (value === "high") return 3;
  if (value === "medium") return 2;
  return 1;
}

function keywordTags(value) {
  const haystack = lower(value);
  const tags = new Set();
  if (/\brisk|predictive|forecast|score|decline\b/.test(haystack)) tags.add("risk");
  if (/\balert|urgent|safety|reach|unreachable|answer|escalat/.test(haystack)) tags.add("alert");
  if (/\bmedication|adherence|reminder|dose|pill\b/.test(haystack)) tags.add("medication");
  if (/\bmonitor|monitoring\b/.test(haystack)) tags.add("monitoring");
  if (/\bsensor|device|battery|reporting|offline|fall\b/.test(haystack)) tags.add("sensor");
  if (/\bcheck-in|check in|brain coach|service|routine|schedule|follow-up|touchpoint|outreach\b/.test(haystack)) tags.add("service");
  if (/\bcaregiver|family|consent|sharing|care circle|provider\b/.test(haystack)) tags.add("care-circle");
  if (/\bcontext|living|language|city\b/.test(haystack)) tags.add("context");
  return tags;
}

function sectionFocusTags(sectionKey) {
  if (sectionKey === "goals_json") return new Set(["risk", "medication", "service", "care-circle", "context"]);
  if (sectionKey === "daily_support_json") return new Set(["medication", "service", "care-circle", "context"]);
  if (sectionKey === "monitoring_json") return new Set(["risk", "alert", "sensor", "medication", "service", "monitoring"]);
  if (sectionKey === "escalation_json") return new Set(["risk", "alert", "sensor", "medication", "monitoring"]);
  if (sectionKey === "caregiver_guidance_json") return new Set(["care-circle", "alert", "risk", "service", "context"]);
  return new Set();
}

function signalCategoryLookup(sourceSignals = []) {
  return new Map(
    (Array.isArray(sourceSignals) ? sourceSignals : [])
      .map((signal) => {
        const id = text(signal?.id);
        if (!id) return null;
        return [id, lower(signal?.category) || "context"];
      })
      .filter(Boolean),
  );
}

function relatedToSection(sectionKey, {
  sectionKeyHint = null,
  textParts = [],
  categories = [],
  sourceSignalIds = [],
  signalCategories = new Map(),
} = {}) {
  if (text(sectionKeyHint) === sectionKey) return true;
  const tags = keywordTags((Array.isArray(textParts) ? textParts : []).filter(Boolean).join(" "));
  for (const category of Array.isArray(categories) ? categories : []) {
    if (text(category)) tags.add(lower(category));
  }
  for (const signalId of unique(sourceSignalIds)) {
    const category = signalCategories.get(signalId);
    if (category) tags.add(category);
  }
  const focus = sectionFocusTags(sectionKey);
  return [...tags].some((tag) => focus.has(tag));
}

function normalizeResponseWindow(value) {
  if (value === "today" || value === "this_week") return value;
  return "ongoing";
}

function normalizePriority(value) {
  if (value === "high" || value === "medium") return value;
  return "low";
}

function responseWindowFor({ score, urgent = false, weekly = false, reviewWindow = "ongoing" }) {
  if (urgent || reviewWindow === "today") return "today";
  if (weekly || reviewWindow === "this_week" || score >= 4) return "this_week";
  return "ongoing";
}

function recommendedStaffCheck(sectionKey, driverIds = []) {
  const drivers = new Set(Array.isArray(driverIds) ? driverIds : []);
  if (sectionKey === "escalation_json") {
    if (drivers.has("clinical_caution") || drivers.has("same_day_response") || drivers.has("urgent_escalation")) {
      return "Verify the same-day escalation owner, fallback path, and what happens if contact still fails.";
    }
    return "Check that the escalation path is concrete, named, and still matches the live situation.";
  }
  if (sectionKey === "monitoring_json") {
    if (drivers.has("fragile_response") || drivers.has("weakening_outcome")) {
      return "Confirm the live status behind the monitoring triggers and tighten timing or ownership where the current routine looks unreliable.";
    }
    return "Verify the live status, the next check timing, and what would trigger a faster response.";
  }
  if (sectionKey === "daily_support_json") {
    return "Check that the daily routine still fits the client's real day and that medication or service steps are actually landing.";
  }
  if (sectionKey === "caregiver_guidance_json") {
    return "Confirm who in the care circle can act now, what they should watch for, and what they should report back.";
  }
  return "Make sure this section still matches the most important live needs and does not understate current risk.";
}

function addReason(state, {
  id,
  label,
  severity = "medium",
  score = 1,
  sourceSignalIds = [],
  urgent = false,
  weekly = false,
} = {}) {
  const normalizedLabel = text(label);
  if (!normalizedLabel) return;
  state.score += Number(score || 0);
  state.sourceSignalIds = unique([...(state.sourceSignalIds || []), ...unique(sourceSignalIds)]);
  state.driverIds = unique([...(state.driverIds || []), text(id)]);
  state.reasons.push({
    id: text(id) || `reason-${state.reasons.length + 1}`,
    label: normalizedLabel,
    severity,
  });
  if (urgent) state.urgent = true;
  if (weekly) state.weekly = true;
}

export function buildHealthPlanReviewPriorities({
  sourceSignals = [],
  escalationGrade = null,
  reviewGovernance = null,
  confidenceProfile = null,
  evidencePack = null,
  sectionOutcomes = [],
  qualityMemory = null,
  clientResponseMemory = null,
  clinicalCautions = [],
  freshness = null,
  refreshStrategy = null,
} = {}) {
  const signalCategories = signalCategoryLookup(sourceSignals);
  const reviewWindow = normalizeResponseWindow(text(reviewGovernance?.review_window));
  const confidenceBySection = new Map(
    (Array.isArray(confidenceProfile?.section_confidence) ? confidenceProfile.section_confidence : [])
      .map((item) => [text(item?.section_key), item])
      .filter(([sectionKey]) => sectionKey),
  );
  const outcomeBySection = new Map(
    (Array.isArray(sectionOutcomes) ? sectionOutcomes : [])
      .map((item) => [text(item?.section_key), item])
      .filter(([sectionKey]) => sectionKey),
  );
  const refreshBySection = new Map(
    (Array.isArray(refreshStrategy?.recommended_sections) ? refreshStrategy.recommended_sections : [])
      .map((item) => [text(item?.section_key), item])
      .filter(([sectionKey]) => sectionKey),
  );
  const repeatedRefreshBySection = new Map(
    (Array.isArray(qualityMemory?.repeated_refresh_sections) ? qualityMemory.repeated_refresh_sections : [])
      .map((item) => [text(item?.section_key), Number(item?.count || 0)])
      .filter(([sectionKey]) => sectionKey),
  );

  const fragileAnchors = Array.isArray(clientResponseMemory?.fragile_anchors) ? clientResponseMemory.fragile_anchors : [];
  const priorities = SECTION_DEFINITIONS.map((definition) => {
    const state = {
      section_key: definition.section_key,
      section_label: definition.label,
      score: 0,
      sourceSignalIds: [],
      reasons: [],
      driverIds: [],
      urgent: false,
      weekly: false,
    };

    const confidence = confidenceBySection.get(definition.section_key) || null;
    const maxConfidence = lower(confidence?.max_confidence) || "high";
    if (maxConfidence === "low") {
      addReason(state, {
        id: "low_confidence",
        label: text(confidence?.reasons?.[0]?.label) || "This section still has low-confidence inputs and needs active verification.",
        severity: "high",
        score: 4,
        weekly: true,
      });
    } else if (maxConfidence === "medium") {
      addReason(state, {
        id: "medium_confidence",
        label: text(confidence?.reasons?.[0]?.label) || "This section should stay somewhat cautious because the evidence picture is still incomplete.",
        severity: "medium",
        score: 2,
        weekly: true,
      });
    }

    if (text(escalationGrade?.grade) === "urgent" && ["monitoring_json", "escalation_json"].includes(definition.section_key)) {
      addReason(state, {
        id: "urgent_escalation",
        label: "The live signal mix is urgent, so this section needs same-day review before staff rely on it.",
        severity: "high",
        score: 4,
        urgent: true,
      });
    } else if (text(escalationGrade?.grade) === "heightened" && ["monitoring_json", "escalation_json", "caregiver_guidance_json"].includes(definition.section_key)) {
      addReason(state, {
        id: "heightened_escalation",
        label: "The live signal mix is heightened, so this section should stay operationally specific.",
        severity: "medium",
        score: 2,
        weekly: true,
      });
    }

    if (Boolean(evidencePack?.same_day_response_required) && ["monitoring_json", "escalation_json"].includes(definition.section_key)) {
      addReason(state, {
        id: "same_day_response",
        label: "Same-day response pressure is present here and should be checked for concrete wording and ownership.",
        severity: "high",
        score: 3,
        urgent: true,
      });
    }

    for (const contradiction of Array.isArray(evidencePack?.contradictions) ? evidencePack.contradictions : []) {
      if (!relatedToSection(definition.section_key, {
        sectionKeyHint: contradiction?.section_key,
        textParts: [contradiction?.summary, contradiction?.detail],
        sourceSignalIds: contradiction?.source_signal_ids,
        signalCategories,
      })) continue;
      addReason(state, {
        id: "evidence_conflict",
        label: text(contradiction?.summary) || "This section still has conflicting evidence that needs explicit staff judgment.",
        severity: lower(contradiction?.severity) || "medium",
        score: lower(contradiction?.severity) === "high" ? 3 : 2,
        sourceSignalIds: contradiction?.source_signal_ids,
        weekly: true,
      });
    }

    for (const need of Array.isArray(evidencePack?.verification_needs) ? evidencePack.verification_needs : []) {
      if (!relatedToSection(definition.section_key, {
        textParts: [need?.label, need?.detail],
        sourceSignalIds: need?.source_signal_ids,
        signalCategories,
      })) continue;
      addReason(state, {
        id: "verification_need",
        label: text(need?.label) || "This section still depends on a missing verification step.",
        severity: lower(need?.severity) || "medium",
        score: lower(need?.severity) === "high" ? 3 : 2,
        sourceSignalIds: need?.source_signal_ids,
        weekly: true,
      });
    }

    for (const caution of Array.isArray(clinicalCautions) ? clinicalCautions : []) {
      const sections = unique(caution?.section_keys);
      if (!sections.includes(definition.section_key)) continue;
      addReason(state, {
        id: "clinical_caution",
        label: text(caution?.label) || "This section carries a clinical caution that needs a concrete response path.",
        severity: lower(caution?.severity) || "medium",
        score: lower(caution?.severity) === "high" ? 4 : 2,
        sourceSignalIds: caution?.signal_ids,
        urgent: lower(caution?.severity) === "high",
        weekly: lower(caution?.severity) !== "high",
      });
    }

    const outcome = outcomeBySection.get(definition.section_key) || null;
    if (text(outcome?.trend) === "weakening") {
      addReason(state, {
        id: "weakening_outcome",
        label: text(outcome?.operational_learning_summary) || "Real-world follow-through says this section is weakening and should not be reused lightly.",
        severity: "high",
        score: 3,
        weekly: true,
      });
    } else if (text(outcome?.evidence_balance) === "caution" || text(outcome?.trend) === "mixed") {
      addReason(state, {
        id: "mixed_outcome",
        label: text(outcome?.operational_learning_summary) || "This section has mixed follow-through and still needs staff judgment.",
        severity: "medium",
        score: 2,
        weekly: true,
      });
    }
    if (text(outcome?.contradiction_status)) {
      addReason(state, {
        id: "outcome_conflict",
        label: text(outcome?.contradiction_reason) || "Live activity is no longer matching the older feedback in this section.",
        severity: "high",
        score: 2,
        weekly: true,
      });
    }

    for (const anchor of fragileAnchors) {
      if (!relatedToSection(definition.section_key, {
        textParts: [anchor?.reason, ...(Array.isArray(anchor?.labels) ? anchor.labels : [])],
        categories: [anchor?.category],
        signalCategories,
      })) continue;
      addReason(state, {
        id: "fragile_response",
        label: text(anchor?.reason) || "This area is tied to routines that currently look unreliable for this client.",
        severity: "medium",
        score: 2,
        weekly: true,
      });
    }

    const refreshPressureCount = repeatedRefreshBySection.get(definition.section_key) || 0;
    if (refreshPressureCount >= 2) {
      addReason(state, {
        id: "repeat_refresh",
        label: `This section has come back under review pressure ${refreshPressureCount} times across recent versions.`,
        severity: "medium",
        score: 2,
        weekly: true,
      });
    }

    const refreshRecommendation = refreshBySection.get(definition.section_key) || null;
    if (refreshRecommendation) {
      const refreshPriority = normalizePriority(refreshRecommendation?.priority);
      addReason(state, {
        id: "refresh_recommendation",
        label: text(refreshRecommendation?.reasons?.[0]) || "This section is one of the first places the current plan needs fresh attention.",
        severity: refreshPriority === "high" ? "high" : refreshPriority,
        score: refreshPriority === "high" ? 3 : refreshPriority === "medium" ? 2 : 1,
        urgent: refreshPriority === "high" && normalizeResponseWindow(reviewWindow) === "today",
        weekly: refreshPriority !== "low",
      });
    }

    if (["stale", "critical"].includes(text(freshness?.status)) && state.score > 0) {
      state.weekly = true;
    }

    const responseWindow = responseWindowFor({
      score: state.score,
      urgent: state.urgent,
      weekly: state.weekly,
      reviewWindow,
    });
    const priority = responseWindow === "today" || state.score >= 8
      ? "high"
      : state.score >= 4 || responseWindow === "this_week"
        ? "medium"
        : "low";
    const reasons = state.reasons
      .sort((left, right) => severityScore(right.severity) - severityScore(left.severity))
      .slice(0, 3);

    return {
      id: `review-${definition.section_key}`,
      section_key: definition.section_key,
      section_label: definition.label,
      priority,
      score: state.score,
      confidence_ceiling: maxConfidence,
      response_window: responseWindow,
      why_now: reasons.map((reason) => reason.label).join(" "),
      recommended_staff_check: recommendedStaffCheck(definition.section_key, state.driverIds),
      source_signal_ids: unique(state.sourceSignalIds),
      drivers: state.driverIds,
      reasons,
    };
  })
    .filter((item) => item.score > 0)
    .sort((left, right) => {
      const byPriority = priorityRank(right.priority) - priorityRank(left.priority);
      if (byPriority !== 0) return byPriority;
      return Number(right.score || 0) - Number(left.score || 0);
    });

  const highPriorityCount = priorities.filter((item) => item.priority === "high").length;
  const mediumPriorityCount = priorities.filter((item) => item.priority === "medium").length;
  const summary = priorities.length === 0
    ? "No acute staff-review hotspot is strongly flagged right now, though routine human review still matters before sharing the plan."
    : `${priorities.length} health-plan section${priorities.length === 1 ? "" : "s"} deserve active staff review, led by ${priorities[0].section_label}.`;

  return {
    summary,
    overall_priority: priorities[0]?.priority || "low",
    urgent_review_count: priorities.filter((item) => item.response_window === "today").length,
    high_priority_count: highPriorityCount,
    medium_priority_count: mediumPriorityCount,
    review_first_section_keys: priorities.slice(0, 3).map((item) => item.section_key),
    items: priorities.slice(0, 5),
  };
}
