import { normalizeHealthPlanOperationalEvents } from "./healthPlanOperationalEvents.js";

const SECTION_DEFINITIONS = [
  {
    section_key: "goals_json",
    label: "Goals",
    event_sources: ["checkins", "brain_coach", "medication", "alert"],
    positive_signal_ids: ["risk-improved"],
    caution_signal_ids: ["risk-worsened", "no-fresh-touchpoints"],
    live_domains: ["contact_pressure", "medication_adherence"],
  },
  {
    section_key: "daily_support_json",
    label: "Daily support",
    event_sources: ["checkins", "brain_coach", "medication"],
    positive_signal_ids: ["checkin-since-plan", "brain-coach-since-plan", "medication-since-plan"],
    caution_signal_ids: ["checkin-problem-since-plan", "brain-coach-problem-since-plan", "medication-problem-since-plan", "no-fresh-touchpoints"],
    live_domains: ["service_engagement", "medication_adherence", "contact_pressure"],
  },
  {
    section_key: "monitoring_json",
    label: "Monitoring",
    event_sources: ["checkins", "brain_coach", "medication", "alert"],
    positive_signal_ids: ["resolved-alerts-since-plan", "medication-since-plan", "risk-improved"],
    caution_signal_ids: ["new-alerts-since-plan", "lingering-alerts", "risk-worsened", "medication-problem-since-plan", "no-fresh-touchpoints"],
    live_domains: ["sensor_reliability", "medication_adherence", "contact_pressure"],
  },
  {
    section_key: "escalation_json",
    label: "Escalation",
    event_sources: ["alert", "checkins", "campaign_call"],
    positive_signal_ids: ["resolved-alerts-since-plan", "risk-improved"],
    caution_signal_ids: ["new-alerts-since-plan", "lingering-alerts", "risk-worsened", "checkin-problem-since-plan"],
    live_domains: ["contact_pressure", "sensor_reliability"],
  },
  {
    section_key: "caregiver_guidance_json",
    label: "Caregiver guidance",
    event_sources: ["checkins", "campaign_call", "alert"],
    positive_signal_ids: ["checkin-since-plan", "resolved-alerts-since-plan"],
    caution_signal_ids: ["new-alerts-since-plan", "lingering-alerts", "no-fresh-touchpoints"],
    live_domains: ["contact_pressure"],
  },
];

function text(value) {
  return String(value || "").trim();
}

function lower(value) {
  return text(value).toLowerCase();
}

function objectValue(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function unique(values) {
  return [...new Set((Array.isArray(values) ? values : []).map((value) => text(value)).filter(Boolean))];
}

function items(plan, sectionKey) {
  return Array.isArray(plan?.[sectionKey]) ? plan[sectionKey] : [];
}

function normalizedSignals(value) {
  return Array.isArray(value) ? value : [];
}

function signalLookup(summary = null) {
  const map = new Map();
  for (const signal of [
    ...normalizedSignals(summary?.positive_signals),
    ...normalizedSignals(summary?.caution_signals),
  ]) {
    const id = text(signal?.id);
    if (!id) continue;
    map.set(id, signal);
  }
  return map;
}

function relevantSignals(summary = null, ids = []) {
  const lookup = signalLookup(summary);
  return unique(ids).map((id) => lookup.get(id)).filter(Boolean);
}

function relevantEvents(events = [], sources = []) {
  const allowed = new Set(unique(sources));
  return normalizeHealthPlanOperationalEvents(events).filter((event) => allowed.has(text(event?.source)));
}

function positiveEventCount(events = []) {
  return (Array.isArray(events) ? events : []).filter((event) => {
    const status = lower(event?.status);
    return ["completed", "confirmed", "answered", "reached", "success", "successful", "done", "taken"].includes(status);
  }).length;
}

function cautionEventCount(events = []) {
  return (Array.isArray(events) ? events : []).filter((event) => {
    const status = lower(event?.status);
    return ["missed", "unconfirmed", "no_answer", "no_response", "not_reached", "failed", "failure", "late", "skipped", "declined", "busy", "timeout", "pending"].includes(status);
  }).length;
}

function liveStatuses(summary = null, domainKeys = []) {
  return unique(domainKeys).map((key) => ({
    key,
    status: lower(summary?.[key]?.status) || "stable",
    summary: text(summary?.[key]?.summary) || null,
  }));
}

function sectionCompletenessStatus(summary = null, sectionKey) {
  const checks = Array.isArray(summary?.section_checks) ? summary.section_checks : [];
  return lower(checks.find((item) => text(item?.section_key) === sectionKey)?.overall_status) || null;
}

function classifyImpact({
  positiveSignals,
  cautionSignals,
  positiveEvents,
  cautionEvents,
  liveStatusItems,
  completenessStatus,
}) {
  const pressureCount = liveStatusItems.filter((item) => item.status === "pressure").length;
  const watchCount = liveStatusItems.filter((item) => item.status === "watch").length;
  const positiveCount = positiveSignals.length + positiveEvents;
  const cautionCount = cautionSignals.length + cautionEvents + pressureCount;

  if (cautionCount > 0 && positiveCount === 0) return "contradicted";
  if (pressureCount > 0 && cautionCount >= positiveCount) return "contradicted";
  if (positiveCount > 0 && cautionCount === 0 && watchCount === 0 && completenessStatus !== "fragile") return "reinforced";
  if (positiveCount === 0 && cautionCount === 0) return "limited";
  return "mixed";
}

function reasonForImpact({
  impactStatus,
  positiveSignals,
  cautionSignals,
  liveStatusItems,
  completenessStatus,
}) {
  if (impactStatus === "reinforced") {
    return text(positiveSignals[0]?.detail || positiveSignals[0]?.label)
      || text(liveStatusItems.find((item) => item.status === "stable")?.summary)
      || "Post-plan activity is broadly supporting this part of the plan.";
  }
  if (impactStatus === "contradicted") {
    return text(cautionSignals[0]?.detail || cautionSignals[0]?.label)
      || text(liveStatusItems.find((item) => item.status === "pressure")?.summary)
      || "What happened after the plan went live suggests this guidance did not hold up well enough.";
  }
  if (impactStatus === "mixed") {
    return text(cautionSignals[0]?.detail || cautionSignals[0]?.label)
      || text(positiveSignals[0]?.detail || positiveSignals[0]?.label)
      || "Some post-plan signals support this section, but newer caution signals are still competing with them.";
  }
  if (completenessStatus === "fragile") {
    return "The plan section itself was not concrete enough to attribute outcome changes confidently yet.";
  }
  return "There is not enough post-plan evidence yet to tell whether this part of the plan actually changed the situation.";
}

function nextStepForImpact(impactStatus) {
  if (impactStatus === "reinforced") return "Preserve this section's core action unless fresher live evidence now points the other way.";
  if (impactStatus === "contradicted") return "Rewrite this section decisively and do not reuse the same action pattern without a stronger reason.";
  if (impactStatus === "mixed") return "Tighten this section and verify the next real-world response before trusting it heavily.";
  return "Collect more post-plan evidence before treating this section as proven.";
}

function scoreForImpact(impactStatus, completenessStatus) {
  const base =
    impactStatus === "reinforced" ? 86
      : impactStatus === "mixed" ? 58
        : impactStatus === "contradicted" ? 24
          : 40;
  if (completenessStatus === "strong" && impactStatus === "reinforced") return 92;
  if (completenessStatus === "fragile" && impactStatus !== "contradicted") return Math.max(18, base - 12);
  return base;
}

export function buildHealthPlanActionImpact({
  plan = null,
  followThrough = null,
  recentOperationalEvents = [],
  liveEvidenceSummary = null,
  operationalCompleteness = null,
} = {}) {
  if (!objectValue(plan)) return null;

  const itemsSummary = SECTION_DEFINITIONS
    .filter((definition) => items(plan, definition.section_key).length > 0)
    .map((definition) => {
      const positiveSignals = relevantSignals(followThrough, definition.positive_signal_ids);
      const cautionSignals = relevantSignals(followThrough, definition.caution_signal_ids);
      const events = relevantEvents(recentOperationalEvents, definition.event_sources);
      const positiveEvents = positiveEventCount(events);
      const cautionEvents = cautionEventCount(events);
      const liveStatusItems = liveStatuses(liveEvidenceSummary, definition.live_domains);
      const completenessStatus = sectionCompletenessStatus(operationalCompleteness, definition.section_key);
      const impactStatus = classifyImpact({
        positiveSignals,
        cautionSignals,
        positiveEvents,
        cautionEvents,
        liveStatusItems,
        completenessStatus,
      });

      return {
        section_key: definition.section_key,
        section_label: definition.label,
        impact_status: impactStatus,
        score: scoreForImpact(impactStatus, completenessStatus),
        operational_completeness_status: completenessStatus,
        positive_signal_count: positiveSignals.length,
        caution_signal_count: cautionSignals.length,
        positive_event_count: positiveEvents,
        caution_event_count: cautionEvents,
        live_pressure_count: liveStatusItems.filter((item) => item.status === "pressure").length,
        live_watch_count: liveStatusItems.filter((item) => item.status === "watch").length,
        reason: reasonForImpact({
          impactStatus,
          positiveSignals,
          cautionSignals,
          liveStatusItems,
          completenessStatus,
        }),
        next_step: nextStepForImpact(impactStatus),
      };
    })
    .sort((left, right) => right.score - left.score);

  const reinforced = itemsSummary.filter((item) => item.impact_status === "reinforced");
  const mixed = itemsSummary.filter((item) => item.impact_status === "mixed");
  const contradicted = itemsSummary.filter((item) => item.impact_status === "contradicted");
  const limited = itemsSummary.filter((item) => item.impact_status === "limited");

  const overallStatus =
    contradicted.length > 0
      ? "contradicted"
      : mixed.length > 0
        ? "mixed"
        : reinforced.length > 0
          ? "reinforcing"
          : "limited";

  const summary =
    overallStatus === "reinforcing"
      ? "Post-plan activity is mostly reinforcing the strongest action sections."
      : overallStatus === "mixed"
        ? "Some action sections seem to be helping, but the post-plan picture is still mixed."
        : overallStatus === "contradicted"
          ? "What happened after the plan went live is contradicting one or more important action sections."
          : "There is still too little post-plan evidence to tell which actions are truly helping.";

  return {
    overall_status: overallStatus,
    summary,
    reinforced_count: reinforced.length,
    mixed_count: mixed.length,
    contradicted_count: contradicted.length,
    limited_count: limited.length,
    items: itemsSummary.slice(0, 8),
  };
}
