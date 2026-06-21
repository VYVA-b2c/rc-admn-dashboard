import { normalizeHealthPlanOperationalEvents } from "./healthPlanOperationalEvents.js";

function text(value) {
  return String(value || "").trim();
}

function lower(value) {
  return text(value).toLowerCase();
}

function unique(values) {
  return [...new Set((Array.isArray(values) ? values : []).map((value) => text(value)).filter(Boolean))];
}

const POSITIVE_STATUS = new Set(["completed", "confirmed", "answered", "reached", "success", "successful", "done", "taken"]);
const CAUTION_STATUS = new Set(["missed", "unconfirmed", "no_answer", "no_response", "not_reached", "failed", "failure", "late", "skipped", "declined", "busy", "timeout", "pending", "queued", "cancelled"]);

function eventKind(status) {
  const normalized = lower(status).replace(/[\s-]+/g, "_");
  if (CAUTION_STATUS.has(normalized)) return "caution";
  if (POSITIVE_STATUS.has(normalized) || !normalized) return "positive";
  return "neutral";
}

function categoryFromSignalId(id = "", sourceSignals = []) {
  const normalizedId = text(id);
  const signal = (Array.isArray(sourceSignals) ? sourceSignals : []).find((item) => text(item?.id) === normalizedId);
  const category = lower(signal?.category);
  if (category) return category;
  if (normalizedId === "service-checkins" || normalizedId === "service-brain-coach") return "service";
  if (normalizedId === "medication-plan") return "medication";
  if (normalizedId === "care-circle-context" || normalizedId === "consent-family-sharing") return "care-circle";
  if (normalizedId === "alert-active") return "alert";
  if (normalizedId === "risk-latest-score" || normalizedId === "forecast-near-term") return "risk";
  return "context";
}

function sourceLabel(source) {
  if (source === "checkins") return "Check-ins";
  if (source === "brain_coach") return "Brain Coach";
  if (source === "medication") return "Medication follow-through";
  if (source === "campaign_call") return "Outreach calls";
  if (source === "alert") return "Alerts";
  return "Context";
}

function responseProfile(positiveCount, cautionCount) {
  if (positiveCount >= 2 && cautionCount === 0) return "responsive";
  if (cautionCount >= 2 && positiveCount === 0) return "fragile";
  if (positiveCount > cautionCount) return "mostly_responsive";
  if (cautionCount > positiveCount) return "unreliable";
  if (positiveCount > 0 || cautionCount > 0) return "mixed";
  return "unknown";
}

function pushCategoryStats(map, category, delta) {
  const key = text(category) || "context";
  if (!map.has(key)) {
    map.set(key, { positive: 0, caution: 0, preserve: 0, replace: 0, verify: 0, labels: [] });
  }
  const entry = map.get(key);
  entry.positive += Number(delta?.positive || 0);
  entry.caution += Number(delta?.caution || 0);
  entry.preserve += Number(delta?.preserve || 0);
  entry.replace += Number(delta?.replace || 0);
  entry.verify += Number(delta?.verify || 0);
  entry.labels = unique([...(entry.labels || []), ...(delta?.labels || [])]);
}

export function buildHealthPlanClientResponseMemory({
  recentOperationalEvents = [],
  recommendationLearning = [],
  sectionOutcomes = [],
  sourceSignals = [],
} = {}) {
  const events = normalizeHealthPlanOperationalEvents(recentOperationalEvents);
  const sourceStats = new Map();
  const categoryStats = new Map();

  for (const event of events) {
    const source = text(event?.source) || "context";
    if (!sourceStats.has(source)) {
      sourceStats.set(source, {
        source,
        label: sourceLabel(source),
        positive_count: 0,
        caution_count: 0,
        last_status: null,
        last_occurred_at: null,
      });
    }
    const entry = sourceStats.get(source);
    const kind = eventKind(event?.status);
    if (kind === "positive") entry.positive_count += 1;
    if (kind === "caution") entry.caution_count += 1;
    entry.last_status = text(event?.status) || entry.last_status;
    entry.last_occurred_at = text(event?.occurred_at) || entry.last_occurred_at;

    if (source === "checkins") pushCategoryStats(categoryStats, "service", { [kind]: 1, labels: ["Check-ins"] });
    if (source === "brain_coach") pushCategoryStats(categoryStats, "service", { [kind]: 1, labels: ["Brain Coach"] });
    if (source === "medication") pushCategoryStats(categoryStats, "medication", { [kind]: 1, labels: ["Medication follow-through"] });
    if (source === "campaign_call") pushCategoryStats(categoryStats, "service", { [kind]: 1, labels: ["Outreach calls"] });
  }

  for (const item of Array.isArray(recommendationLearning) ? recommendationLearning : []) {
    const categories = unique((Array.isArray(item?.source_signal_ids) ? item.source_signal_ids : []).map((id) => categoryFromSignalId(id, sourceSignals)));
    const latestAction = text(item?.latest_recommended_next_action);
    const deltas = {
      preserve: latestAction === "preserve" || (!latestAction && text(item?.reuse_priority) === "preserve") ? 1 : 0,
      replace: latestAction === "retire" || latestAction === "rework" || (!latestAction && text(item?.reuse_priority) === "replace") ? 1 : 0,
      verify: latestAction === "verify" || (!latestAction && text(item?.reuse_priority) === "verify") ? 1 : 0,
      positive: text(item?.status) === "helping" ? 1 : 0,
      caution: ["fragile", "unproven"].includes(text(item?.status)) ? 1 : 0,
      labels: [text(item?.section_label) || text(item?.section_key)],
    };
    for (const category of categories.length ? categories : ["context"]) {
      pushCategoryStats(categoryStats, category, deltas);
    }
  }

  const responseBySource = [...sourceStats.values()]
    .map((item) => ({
      ...item,
      response_profile: responseProfile(item.positive_count, item.caution_count),
    }))
    .sort((left, right) => (right.positive_count + right.caution_count) - (left.positive_count + left.caution_count));

  const categoryPatterns = [...categoryStats.entries()]
    .map(([category, value]) => ({
      category,
      positive_count: value.positive,
      caution_count: value.caution,
      preserve_count: value.preserve,
      replace_count: value.replace,
      verify_count: value.verify,
      labels: unique(value.labels).slice(0, 4),
      response_profile: responseProfile(value.positive + value.preserve, value.caution + value.replace + value.verify),
    }))
    .sort((left, right) => {
      const leftScore = (left.positive_count + left.preserve_count) - (left.caution_count + left.replace_count + left.verify_count);
      const rightScore = (right.positive_count + right.preserve_count) - (right.caution_count + right.replace_count + right.verify_count);
      return rightScore - leftScore;
    });

  const strongestAnchors = categoryPatterns
    .filter((item) => ["responsive", "mostly_responsive"].includes(item.response_profile))
    .slice(0, 4)
    .map((item) => ({
      category: item.category,
      response_profile: item.response_profile,
      labels: item.labels,
      reason: item.preserve_count > 0
        ? "This category keeps showing up in recommendations worth preserving."
        : "Recent operational follow-through in this category is landing more often than it is failing.",
    }));

  const fragileAnchors = categoryPatterns
    .filter((item) => ["fragile", "unreliable"].includes(item.response_profile) || item.replace_count > 0 || item.verify_count > 0)
    .slice(0, 4)
    .map((item) => ({
      category: item.category,
      response_profile: item.response_profile,
      labels: item.labels,
      reason: item.replace_count > 0
        ? "This category is tied to recommendations that repeatedly need replacement."
        : "Recent follow-through in this category is breaking down or staying too uncertain.",
    }));

  const outcomeSignals = (Array.isArray(sectionOutcomes) ? sectionOutcomes : [])
    .slice(0, 5)
    .map((item) => ({
      section_key: text(item?.section_key) || null,
      trend: text(item?.trend) || null,
      evidence_balance: text(item?.evidence_balance) || null,
      operational_learning_summary: text(item?.operational_learning_summary) || null,
    }))
    .filter((item) => item.section_key);

  const summary =
    strongestAnchors.length > 0 && fragileAnchors.length > 0
      ? `This client responds better to ${strongestAnchors[0].labels?.[0] || strongestAnchors[0].category}, while ${fragileAnchors[0].labels?.[0] || fragileAnchors[0].category} currently looks less reliable and should not be over-trusted.`
      : strongestAnchors.length > 0
        ? `This client is showing the strongest positive response around ${strongestAnchors[0].labels?.[0] || strongestAnchors[0].category}.`
        : fragileAnchors.length > 0
          ? `${fragileAnchors[0].labels?.[0] || fragileAnchors[0].category} currently looks unreliable, so the next plan should stay cautious there.`
          : "Client-response memory is still thin, so the next plan should stay conservative and keep learning from follow-through.";

  return {
    summary,
    response_by_source: responseBySource.slice(0, 6),
    category_patterns: categoryPatterns.slice(0, 6),
    strongest_anchors: strongestAnchors,
    fragile_anchors: fragileAnchors,
    section_learning_signals: outcomeSignals,
  };
}
