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
  return null;
}

function severityScore(value) {
  if (value === "high") return 3;
  if (value === "medium") return 2;
  return 1;
}

function sectionLabel(sectionKey) {
  if (sectionKey === "goals_json") return "Goals";
  if (sectionKey === "daily_support_json") return "Daily support";
  if (sectionKey === "monitoring_json") return "Monitoring";
  if (sectionKey === "escalation_json") return "Escalation";
  if (sectionKey === "caregiver_guidance_json") return "Caregiver guidance";
  return sectionKey;
}

function keywordTags(value) {
  const haystack = lower(value);
  const tags = new Set();
  if (/\brisk|predictive|forecast|score\b/.test(haystack)) tags.add("risk");
  if (/\balert|urgent|safety|reach|unreachable\b/.test(haystack)) tags.add("alert");
  if (/\bmedication|adherence|reminder|dose|pill\b/.test(haystack)) tags.add("medication");
  if (/\bsensor|device|battery|reporting|offline\b/.test(haystack)) tags.add("sensor");
  if (/\bcheck-in|check in|brain coach|service|routine|schedule\b/.test(haystack)) tags.add("service");
  if (/\bcaregiver|family|consent|sharing|care circle|provider\b/.test(haystack)) tags.add("care-circle");
  return tags;
}

function sectionFocusTags(sectionKey) {
  if (sectionKey === "goals_json") return new Set(["risk", "medication", "service", "care-circle"]);
  if (sectionKey === "daily_support_json") return new Set(["medication", "service", "care-circle"]);
  if (sectionKey === "monitoring_json") return new Set(["risk", "alert", "sensor", "medication", "service"]);
  if (sectionKey === "escalation_json") return new Set(["risk", "alert", "sensor"]);
  if (sectionKey === "caregiver_guidance_json") return new Set(["care-circle", "alert", "risk"]);
  return new Set();
}

function topDriverSignals(items, signalLookup) {
  const counts = new Map();
  for (const item of Array.isArray(items) ? items : []) {
    for (const signalId of unique(item?.source_signal_ids)) {
      counts.set(signalId, (counts.get(signalId) || 0) + 1);
    }
  }

  return [...counts.entries()]
    .map(([signalId, count]) => {
      const signal = signalLookup.get(signalId);
      if (!signal) return null;
      return {
        ...signal,
        id: signalId,
        hit_count: count,
        strength: normalizeStrength(signal?.strength),
      };
    })
    .filter(Boolean)
    .sort((left, right) => {
      const hitDelta = Number(right.hit_count || 0) - Number(left.hit_count || 0);
      if (hitDelta !== 0) return hitDelta;
      return severityScore(right.strength) - severityScore(left.strength);
    })
    .slice(0, 3);
}

function relatedGap(gap, sectionKey, driverSignals) {
  const focusTags = sectionFocusTags(sectionKey);
  const gapTags = keywordTags(`${gap?.label} ${gap?.detail} ${gap?.staff_action}`);
  const driverCategories = new Set(driverSignals.map((signal) => lower(signal?.category)));

  if ([...gapTags].some((tag) => focusTags.has(tag))) return true;
  if ([...driverCategories].some((tag) => gapTags.has(tag))) return true;
  return false;
}

function relatedReviewActions(sectionKey, driverSignals, gaps, followThrough, drift) {
  const actions = [];
  for (const gap of Array.isArray(gaps) ? gaps : []) {
    if (relatedGap(gap, sectionKey, driverSignals) && text(gap.staff_action)) actions.push(text(gap.staff_action));
  }
  for (const caution of Array.isArray(followThrough?.caution_signals) ? followThrough.caution_signals : []) {
    const cautionText = text(caution?.label);
    if (!cautionText) continue;
    const tags = keywordTags(`${caution?.label} ${caution?.detail}`);
    if ([...tags].some((tag) => sectionFocusTags(sectionKey).has(tag))) actions.push(cautionText);
  }
  for (const reason of Array.isArray(drift?.reasons) ? drift.reasons : []) {
    if (text(reason)) actions.push(text(reason));
  }
  return unique(actions).slice(0, 3);
}

export function buildHealthPlanDecisionTrace({
  plan = null,
  sourceSignals = [],
  dataQualityGaps = [],
  followThrough = null,
  sectionDrift = [],
} = {}) {
  if (!plan) return [];
  const signalLookup = new Map(
    (Array.isArray(sourceSignals) ? sourceSignals : [])
      .map((signal) => [text(signal?.id), signal])
      .filter(([id]) => id),
  );
  const driftLookup = new Map(
    (Array.isArray(sectionDrift) ? sectionDrift : [])
      .map((item) => [text(item?.section_key), item])
      .filter(([key]) => key),
  );

  return SECTION_KEYS.map((sectionKey) => {
    const items = Array.isArray(plan?.[sectionKey]) ? plan[sectionKey] : [];
    if (!items.length) return null;
    const drivers = topDriverSignals(items, signalLookup);
    const confidences = items.map((item) => normalizeConfidence(item?.confidence)).filter(Boolean);
    const highConfidenceCount = confidences.filter((value) => value === "high").length;
    const lowConfidenceCount = confidences.filter((value) => value === "low").length;
    const relatedGaps = (Array.isArray(dataQualityGaps) ? dataQualityGaps : []).filter((gap) => relatedGap(gap, sectionKey, drivers));
    const limitationLabels = relatedGaps
      .filter((gap) => gap?.severity === "high" || gap?.severity === "medium")
      .map((gap) => text(gap?.label))
      .filter(Boolean)
      .slice(0, 3);
    const confidenceState = limitationLabels.length || lowConfidenceCount > 0
      ? "limited"
      : highConfidenceCount >= 1 && drivers.length >= 2
        ? "strong"
        : "moderate";

    return {
      section_key: sectionKey,
      label: sectionLabel(sectionKey),
      driver_signals: drivers,
      driver_strength: drivers.some((signal) => signal.strength === "high")
        ? "high"
        : drivers.some((signal) => signal.strength === "medium")
          ? "medium"
          : "low",
      confidence_state: confidenceState,
      limitation_labels: limitationLabels,
      review_actions: relatedReviewActions(
        sectionKey,
        drivers,
        relatedGaps,
        followThrough,
        driftLookup.get(sectionKey),
      ),
    };
  }).filter(Boolean);
}
