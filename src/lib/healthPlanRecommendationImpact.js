const SECTION_DEFINITIONS = [
  { section_key: "goals_json", section_label: "Goals" },
  { section_key: "daily_support_json", section_label: "Daily support" },
  { section_key: "monitoring_json", section_label: "Monitoring" },
  { section_key: "escalation_json", section_label: "Escalation" },
  { section_key: "caregiver_guidance_json", section_label: "Caregiver guidance" },
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

function objectValue(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function signalPool(summary = null) {
  return [
    ...(Array.isArray(summary?.positive_signals) ? summary.positive_signals : []),
    ...(Array.isArray(summary?.caution_signals) ? summary.caution_signals : []),
  ];
}

function signalLookup(summary = null) {
  const map = new Map();
  for (const signal of signalPool(summary)) {
    const id = text(signal?.id);
    if (!id) continue;
    map.set(id, signal);
  }
  return map;
}

function categoryFromSignalId(signalId, sourceSignals = []) {
  const normalizedId = text(signalId);
  const sourceSignal = (Array.isArray(sourceSignals) ? sourceSignals : []).find((item) => text(item?.id) === normalizedId);
  const category = lower(sourceSignal?.category);
  if (category) return category;
  if (normalizedId === "service-checkins" || normalizedId === "service-brain-coach") return "service";
  if (normalizedId === "medication-plan") return "medication";
  if (normalizedId === "care-circle-context" || normalizedId === "consent-family-sharing") return "care-circle";
  if (normalizedId === "alert-active") return "alert";
  if (normalizedId === "sensor-status") return "sensor";
  if (normalizedId === "risk-latest-score" || normalizedId === "forecast-near-term") return "risk";
  return "context";
}

function recommendationCategories(item = {}, sourceSignals = []) {
  return unique((Array.isArray(item?.source_signal_ids) ? item.source_signal_ids : []).map((signalId) => categoryFromSignalId(signalId, sourceSignals)));
}

function eventStatusKind(status) {
  const normalized = lower(status).replace(/[\s-]+/g, "_");
  if ([
    "missed",
    "unconfirmed",
    "no_answer",
    "no_response",
    "not_reached",
    "failed",
    "failure",
    "late",
    "skipped",
    "declined",
    "busy",
    "timeout",
    "pending",
    "queued",
    "cancelled",
  ].includes(normalized)) return "caution";
  if ([
    "completed",
    "confirmed",
    "answered",
    "reached",
    "success",
    "successful",
    "done",
    "taken",
  ].includes(normalized)) return "positive";
  return "neutral";
}

function eventCategory(event = {}) {
  const source = text(event?.source);
  if (["checkins", "brain_coach", "campaign_call"].includes(source)) return "service";
  if (source === "medication") return "medication";
  if (source === "alert") return "alert";
  return "context";
}

function eventMatchesRecommendation(event = {}, item = {}, sourceSignals = []) {
  const itemSignalIds = new Set(unique(item?.source_signal_ids));
  const eventSignalIds = unique(event?.signal_ids);
  if (eventSignalIds.some((signalId) => itemSignalIds.has(signalId))) return true;
  const itemCategories = new Set(recommendationCategories(item, sourceSignals));
  return itemCategories.has(eventCategory(event));
}

function relevantLiveDomains(categories = [], sectionKey = "") {
  const domains = new Set();
  const normalizedSection = text(sectionKey);
  if (categories.includes("service")) domains.add("service_engagement");
  if (categories.includes("medication")) domains.add("medication_adherence");
  if (categories.includes("sensor") || categories.includes("alert")) domains.add("sensor_reliability");
  if (categories.includes("risk") || categories.includes("care-circle") || normalizedSection === "caregiver_guidance_json" || normalizedSection === "escalation_json") {
    domains.add("contact_pressure");
  }
  if (normalizedSection === "monitoring_json" || normalizedSection === "daily_support_json") domains.add("contact_pressure");
  return [...domains];
}

function relevantFollowThroughSignalIds(categories = [], sectionKey = "") {
  const positive = new Set();
  const caution = new Set();
  if (categories.includes("service") || ["daily_support_json", "caregiver_guidance_json"].includes(sectionKey)) {
    positive.add("checkin-since-plan");
    positive.add("brain-coach-since-plan");
    caution.add("checkin-problem-since-plan");
    caution.add("brain-coach-problem-since-plan");
    caution.add("no-fresh-touchpoints");
  }
  if (categories.includes("medication")) {
    positive.add("medication-since-plan");
    caution.add("medication-problem-since-plan");
  }
  if (categories.includes("risk") || categories.includes("alert") || categories.includes("sensor") || ["monitoring_json", "escalation_json"].includes(sectionKey)) {
    positive.add("risk-improved");
    positive.add("resolved-alerts-since-plan");
    caution.add("risk-worsened");
    caution.add("new-alerts-since-plan");
    caution.add("lingering-alerts");
  }
  if (sectionKey === "goals_json") {
    positive.add("risk-improved");
    caution.add("risk-worsened");
    caution.add("plan-age");
  }
  return { positive: [...positive], caution: [...caution] };
}

function recommendationItems(plan = null) {
  const normalizedPlan = objectValue(plan);
  if (!normalizedPlan) return [];
  return SECTION_DEFINITIONS.flatMap((definition) =>
    (Array.isArray(normalizedPlan?.[definition.section_key]) ? normalizedPlan[definition.section_key] : [])
      .map((item, index) => ({
        item_id: text(item?.id) || `${definition.section_key}-${index + 1}`,
        section_key: definition.section_key,
        section_label: definition.section_label,
        text: text(item?.text) || null,
        priority: lower(item?.priority) || null,
        confidence: lower(item?.confidence) || null,
        timing: lower(item?.timing) || null,
        source_signal_ids: unique(item?.source_signal_ids),
      }))
      .filter((item) => item.text),
  );
}

function liveStatuses(summary = null, domains = []) {
  return unique(domains).map((domain) => ({
    domain,
    status: lower(summary?.[domain]?.status) || "stable",
    summary: text(summary?.[domain]?.summary) || null,
  }));
}

function impactStatus({ positiveCount, cautionCount, pressureCount, watchCount }) {
  if (cautionCount > 0 && positiveCount === 0) return "contradicted";
  if (pressureCount > 0 && cautionCount >= positiveCount) return "contradicted";
  if (positiveCount > 0 && cautionCount === 0 && watchCount === 0) return "reinforced";
  if (positiveCount === 0 && cautionCount === 0) return "limited";
  return "mixed";
}

function nextAction(status, highPriority, cautionCount, pressureCount) {
  if (status === "reinforced") return "preserve";
  if (status === "contradicted") {
    if (highPriority || pressureCount > 0 || cautionCount >= 2) return "retire";
    return "rework";
  }
  if (status === "mixed") return highPriority ? "rework" : "verify";
  return "verify";
}

function impactReason(status, positiveSignals, cautionSignals, liveStatusItems, positiveEvents, cautionEvents) {
  if (status === "reinforced") {
    return text(positiveSignals[0]?.detail || positiveSignals[0]?.label)
      || text(liveStatusItems.find((item) => item.status === "stable")?.summary)
      || (positiveEvents > 0 ? "Recent operational activity is reinforcing this recommendation." : "Recent evidence is supporting this recommendation.");
  }
  if (status === "contradicted") {
    return text(cautionSignals[0]?.detail || cautionSignals[0]?.label)
      || text(liveStatusItems.find((item) => item.status === "pressure")?.summary)
      || (cautionEvents > 0 ? "Recent operational activity is pushing back on this recommendation." : "Recent evidence is contradicting this recommendation.");
  }
  if (status === "mixed") {
    return text(cautionSignals[0]?.detail || cautionSignals[0]?.label)
      || text(positiveSignals[0]?.detail || positiveSignals[0]?.label)
      || "Some recent evidence supports this recommendation, but the picture is still mixed.";
  }
  return "There is still too little recent evidence to judge this recommendation confidently.";
}

function actionSummary(action) {
  if (action === "preserve") return "Keep this recommendation unless fresher evidence clearly overturns it.";
  if (action === "retire") return "Do not bring this recommendation back unchanged; replace it with a different routine tied to fresher evidence.";
  if (action === "rework") return "Rewrite this recommendation with tighter evidence, ownership, or fallback wording before reusing it.";
  return "Treat this recommendation as unproven until the next real-world response is confirmed.";
}

export function buildHealthPlanRecommendationImpact({
  plan = null,
  recentOperationalEvents = [],
  liveEvidenceSummary = null,
  followThrough = null,
  sourceSignals = [],
} = {}) {
  const items = recommendationItems(plan);
  if (!items.length) return null;

  const lookup = signalLookup(followThrough);
  const normalizedEvents = Array.isArray(recentOperationalEvents) ? recentOperationalEvents : [];
  const summaryItems = items
    .map((item) => {
      const categories = recommendationCategories(item, sourceSignals);
      const followThroughIds = relevantFollowThroughSignalIds(categories, item.section_key);
      const positiveSignals = unique(followThroughIds.positive).map((id) => lookup.get(id)).filter(Boolean);
      const cautionSignals = unique(followThroughIds.caution).map((id) => lookup.get(id)).filter(Boolean);
      const matchedEvents = normalizedEvents.filter((event) => eventMatchesRecommendation(event, item, sourceSignals));
      const positiveEvents = matchedEvents.filter((event) => eventStatusKind(event?.status) === "positive");
      const cautionEvents = matchedEvents.filter((event) => eventStatusKind(event?.status) === "caution");
      const liveStatusItems = liveStatuses(liveEvidenceSummary, relevantLiveDomains(categories, item.section_key));
      const pressureCount = liveStatusItems.filter((entry) => entry.status === "pressure").length;
      const watchCount = liveStatusItems.filter((entry) => entry.status === "watch").length;
      const positiveCount = positiveSignals.length + positiveEvents.length;
      const cautionCount = cautionSignals.length + cautionEvents.length + pressureCount;
      const highPriority = item.priority === "high" || item.timing === "today" || item.confidence === "high";
      const status = impactStatus({
        positiveCount,
        cautionCount,
        pressureCount,
        watchCount,
      });
      const action = nextAction(status, highPriority, cautionCount, pressureCount);

      return {
        ...item,
        impact_status: status,
        recommended_action: action,
        is_high_priority: highPriority,
        positive_signal_count: positiveSignals.length,
        caution_signal_count: cautionSignals.length,
        positive_event_count: positiveEvents.length,
        caution_event_count: cautionEvents.length,
        live_pressure_count: pressureCount,
        live_watch_count: watchCount,
        matched_source_count: unique(matchedEvents.map((event) => text(event?.source))).length,
        reason: impactReason(status, positiveSignals, cautionSignals, liveStatusItems, positiveEvents.length, cautionEvents.length),
        next_step: actionSummary(action),
      };
    })
    .sort((left, right) => {
      const weight = (item) => {
        if (item.impact_status === "contradicted") return item.is_high_priority ? 5 : 4;
        if (item.impact_status === "mixed") return item.is_high_priority ? 3 : 2;
        if (item.impact_status === "reinforced") return 1;
        return 0;
      };
      return weight(right) - weight(left);
    });

  const reinforced = summaryItems.filter((item) => item.impact_status === "reinforced");
  const mixed = summaryItems.filter((item) => item.impact_status === "mixed");
  const contradicted = summaryItems.filter((item) => item.impact_status === "contradicted");
  const limited = summaryItems.filter((item) => item.impact_status === "limited");
  const highPriorityContradicted = contradicted.filter((item) => item.is_high_priority);
  const highPriorityMixed = mixed.filter((item) => item.is_high_priority);

  const overallStatus =
    highPriorityContradicted.length > 0 || contradicted.length > 1
      ? "contradicted"
      : mixed.length > 0
        ? "mixed"
        : reinforced.length > 0
          ? "reinforcing"
          : "limited";

  const summary =
    overallStatus === "contradicted"
      ? "One or more exact recommendations are already being contradicted by what happened after the plan went live."
      : overallStatus === "mixed"
        ? "Some recommendations look promising, but others still need a tighter real-world proof loop."
        : overallStatus === "reinforcing"
          ? "The strongest recommendations are being reinforced by what happened after the plan went live."
          : "There is still too little recent evidence to judge recommendation-level impact confidently.";

  return {
    overall_status: overallStatus,
    summary,
    reinforced_count: reinforced.length,
    mixed_count: mixed.length,
    contradicted_count: contradicted.length,
    limited_count: limited.length,
    high_priority_contradicted_count: highPriorityContradicted.length,
    high_priority_mixed_count: highPriorityMixed.length,
    preserve_count: summaryItems.filter((item) => item.recommended_action === "preserve").length,
    rework_count: summaryItems.filter((item) => item.recommended_action === "rework").length,
    retire_count: summaryItems.filter((item) => item.recommended_action === "retire").length,
    verify_count: summaryItems.filter((item) => item.recommended_action === "verify").length,
    items: summaryItems.slice(0, 18),
  };
}
