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

function lower(value) {
  return text(value).toLowerCase();
}

function unique(values) {
  return [...new Set((Array.isArray(values) ? values : []).map((value) => text(value)).filter(Boolean))];
}

function normalizeStrength(value) {
  const normalized = lower(value);
  if (normalized === "high" || normalized === "low") return normalized;
  return "medium";
}

function normalizeConfidence(value) {
  const normalized = lower(value);
  if (normalized === "high" || normalized === "medium" || normalized === "low") return normalized;
  return "medium";
}

function minConfidence(left, right) {
  const order = { low: 1, medium: 2, high: 3 };
  return order[normalizeConfidence(left)] <= order[normalizeConfidence(right)]
    ? normalizeConfidence(left)
    : normalizeConfidence(right);
}

function severityScore(value) {
  if (value === "high") return 3;
  if (value === "medium") return 2;
  return 1;
}

function keywordTags(value) {
  const haystack = lower(value);
  const tags = new Set();
  if (/\brisk|predictive|forecast|score|decline\b/.test(haystack)) tags.add("risk");
  if (/\balert|urgent|safety|reach|unreachable|escalat/.test(haystack)) tags.add("alert");
  if (/\bmedication|adherence|reminder|dose|pill\b/.test(haystack)) tags.add("medication");
  if (/\bmonitor|monitoring\b/.test(haystack)) tags.add("monitoring");
  if (/\bsensor|device|battery|reporting|offline|fall\b/.test(haystack)) tags.add("sensor");
  if (/\bcheck-in|check in|brain coach|service|routine|schedule|follow-up|touchpoint\b/.test(haystack)) tags.add("service");
  if (/\bcaregiver|family|consent|sharing|care circle|provider\b/.test(haystack)) tags.add("care-circle");
  if (/\bcontext|living|language|city\b/.test(haystack)) tags.add("context");
  return tags;
}

function sectionFocusTags(sectionKey) {
  if (sectionKey === "goals_json") return new Set(["risk", "medication", "service", "care-circle", "context"]);
  if (sectionKey === "daily_support_json") return new Set(["medication", "service", "care-circle", "context"]);
  if (sectionKey === "monitoring_json") return new Set(["risk", "alert", "sensor", "medication", "service", "monitoring"]);
  if (sectionKey === "escalation_json") return new Set(["risk", "alert", "sensor", "medication"]);
  if (sectionKey === "caregiver_guidance_json") return new Set(["care-circle", "alert", "risk", "service"]);
  return new Set();
}

function relatedToSection(sectionKey, parts = []) {
  const focusTags = sectionFocusTags(sectionKey);
  const tags = keywordTags(parts.filter(Boolean).join(" "));
  return [...tags].some((tag) => focusTags.has(tag));
}

function relevantGaps(sectionKey, gaps = []) {
  return (Array.isArray(gaps) ? gaps : []).filter((gap) => relatedToSection(sectionKey, [gap?.label, gap?.detail, gap?.staff_action]));
}

function relevantConflicts(sectionKey, conflicts = []) {
  return (Array.isArray(conflicts) ? conflicts : []).filter((item) => {
    if (text(item?.section_key) === sectionKey) return true;
    return relatedToSection(sectionKey, [item?.summary, item?.detail]);
  });
}

function relevantCautions(sectionKey, cautionSignals = []) {
  return (Array.isArray(cautionSignals) ? cautionSignals : []).filter((signal) => relatedToSection(sectionKey, [signal?.label, signal?.detail]));
}

function evidenceCapFromSignals(refs = [], signalLookup = new Map()) {
  const linkedSignals = unique(refs).map((id) => signalLookup.get(id)).filter(Boolean);
  const categories = new Set(linkedSignals.map((signal) => lower(signal?.category)).filter(Boolean));
  const highSignals = linkedSignals.filter((signal) => normalizeStrength(signal?.strength) === "high").length;
  const mediumSignals = linkedSignals.filter((signal) => normalizeStrength(signal?.strength) === "medium").length;

  if (linkedSignals.length >= 2 && categories.size >= 2 && highSignals >= 1) return "high";
  if (linkedSignals.length >= 2 && (categories.size >= 2 || highSignals >= 1 || mediumSignals >= 2)) return "medium";
  if (linkedSignals.length === 1 && highSignals >= 1) return "medium";
  return "low";
}

function buildSectionConfidenceProfile(sectionKey, {
  dataQualityGaps = [],
  evidenceConflicts = [],
  followThrough = null,
  sectionDrift = [],
} = {}) {
  const gaps = relevantGaps(sectionKey, dataQualityGaps);
  const conflicts = relevantConflicts(sectionKey, evidenceConflicts);
  const drift = (Array.isArray(sectionDrift) ? sectionDrift : []).find((item) => text(item?.section_key) === sectionKey) || null;
  const cautions = relevantCautions(sectionKey, followThrough?.caution_signals);

  const highGap = gaps.some((gap) => normalizeStrength(gap?.severity) === "high");
  const mediumGap = gaps.some((gap) => normalizeStrength(gap?.severity) === "medium");
  const highConflict = conflicts.some((item) => normalizeStrength(item?.severity) === "high");
  const mediumConflict = conflicts.some((item) => normalizeStrength(item?.severity) === "medium");
  const needsRefresh = text(drift?.status) === "needs_refresh";
  const mixedDrift = text(drift?.status) === "mixed";

  let maxConfidence = "high";
  if (highGap || highConflict || (needsRefresh && cautions.length > 0)) {
    maxConfidence = "low";
  } else if (mediumGap || mediumConflict || needsRefresh || mixedDrift || cautions.length > 0) {
    maxConfidence = "medium";
  }

  const reasons = [
    ...gaps
      .filter((gap) => normalizeStrength(gap?.severity) !== "low")
      .slice(0, 2)
      .map((gap) => ({
        id: text(gap?.id) || `${sectionKey}-gap-${text(gap?.label)}`,
        label: text(gap?.label) || "Data quality gap",
        detail: text(gap?.detail) || text(gap?.staff_action) || null,
        severity: normalizeStrength(gap?.severity),
      })),
    ...conflicts
      .filter((item) => normalizeStrength(item?.severity) !== "low")
      .slice(0, 2)
      .map((item) => ({
        id: text(item?.id) || `${sectionKey}-conflict-${text(item?.summary)}`,
        label: text(item?.summary) || "Evidence conflict",
        detail: text(item?.detail) || null,
        severity: normalizeStrength(item?.severity),
      })),
  ];

  if (needsRefresh) {
    reasons.push({
      id: `${sectionKey}-drift-needs-refresh`,
      label: "This section has drifted away from the freshest live picture.",
      detail: text(drift?.reasons?.[0]) || null,
      severity: cautions.length > 0 ? "high" : "medium",
    });
  } else if (mixedDrift) {
    reasons.push({
      id: `${sectionKey}-drift-mixed`,
      label: "Some of this section still holds, but it should be checked against newer activity.",
      detail: text(drift?.reasons?.[0]) || null,
      severity: "medium",
    });
  }

  if (cautions.length > 0) {
    reasons.push({
      id: `${sectionKey}-follow-through`,
      label: "Recent follow-through signals show open questions in this area.",
      detail: text(cautions[0]?.detail) || text(cautions[0]?.label) || null,
      severity: needsRefresh ? "high" : "medium",
    });
  }

  return {
    section_key: sectionKey,
    max_confidence: maxConfidence,
    reasons: reasons.slice(0, 4),
  };
}

function profileSummary(status) {
  if (status === "strong") {
    return "Live evidence is broad enough to support direct, higher-confidence guidance across most of the plan.";
  }
  if (status === "fragile") {
    return "Important parts of this plan depend on incomplete or conflicting evidence, so staff should verify actively before relying on it.";
  }
  return "Parts of this plan are useful, but some guidance should stay cautious because the current evidence is partial or contested.";
}

export function buildHealthPlanConfidenceProfile({
  plan = null,
  sourceSignals = [],
  dataQualityGaps = [],
  evidenceConflicts = [],
  followThrough = null,
  sectionDrift = [],
} = {}) {
  const signalLookup = new Map(
    (Array.isArray(sourceSignals) ? sourceSignals : [])
      .map((signal) => {
        const id = text(signal?.id);
        if (!id) return null;
        return [
          id,
          {
            ...signal,
            id,
            category: text(signal?.category) || "context",
            strength: normalizeStrength(signal?.strength),
          },
        ];
      })
      .filter(Boolean),
  );

  const sections = SECTION_KEYS.map((sectionKey) => buildSectionConfidenceProfile(sectionKey, {
    dataQualityGaps,
    evidenceConflicts,
    followThrough,
    sectionDrift,
  }));

  const adjustments = [];
  const calibratedPlan = plan
    ? SECTION_KEYS.reduce((result, sectionKey) => {
      const sectionProfile = sections.find((item) => item.section_key === sectionKey);
      const maxConfidence = sectionProfile?.max_confidence || "high";
      result[sectionKey] = (Array.isArray(plan?.[sectionKey]) ? plan[sectionKey] : []).map((item, index) => {
        const refs = unique(item?.source_signal_ids);
        const evidenceCap = evidenceCapFromSignals(refs, signalLookup);
        const appliedConfidence = minConfidence(item?.confidence || evidenceCap, minConfidence(evidenceCap, maxConfidence));
        const requestedConfidence = normalizeConfidence(item?.confidence || evidenceCap);
        if (requestedConfidence !== appliedConfidence) {
          adjustments.push({
            section_key: sectionKey,
            item_id: text(item?.id) || `${sectionKey}-${index + 1}`,
            text: text(item?.text) || null,
            requested_confidence: requestedConfidence,
            applied_confidence: appliedConfidence,
            reasons: sectionProfile?.reasons?.map((reason) => reason.label).filter(Boolean).slice(0, 3) || [],
          });
        }
        return {
          ...item,
          confidence: appliedConfidence,
        };
      });
      return result;
    }, {})
    : null;

  const highSeverityReasons = sections.flatMap((section) => section.reasons.filter((reason) => normalizeStrength(reason?.severity) === "high"));
  const lowConfidenceSections = sections.filter((section) => section.max_confidence === "low");
  const mediumConfidenceSections = sections.filter((section) => section.max_confidence === "medium");

  let overallStatus = "strong";
  if (
    lowConfidenceSections.length >= 2
    || lowConfidenceSections.some((section) => section.section_key === "monitoring_json" || section.section_key === "escalation_json")
    || highSeverityReasons.length >= 2
  ) {
    overallStatus = "fragile";
  } else if (lowConfidenceSections.length > 0 || mediumConfidenceSections.length > 0 || highSeverityReasons.length > 0) {
    overallStatus = "guarded";
  }

  const topReasons = sections
    .flatMap((section) => section.reasons.map((reason) => ({ ...reason, section_key: section.section_key })))
    .sort((left, right) => severityScore(normalizeStrength(right?.severity)) - severityScore(normalizeStrength(left?.severity)))
    .slice(0, 5);

  return {
    overall_status: overallStatus,
    summary: profileSummary(overallStatus),
    section_confidence: sections,
    reasons: topReasons,
    adjustments,
    plan: calibratedPlan ? { ...plan, ...calibratedPlan } : plan,
  };
}
