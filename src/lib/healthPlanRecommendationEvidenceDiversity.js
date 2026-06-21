function text(value) {
  return String(value || "").trim();
}

function lower(value) {
  return text(value).toLowerCase();
}

function objectValue(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function authorityRank(value) {
  if (value === "highest") return 4;
  if (value === "high") return 3;
  if (value === "medium") return 2;
  return 1;
}

function isLiveSourceType(value) {
  return ["live_alerts", "live_sensors", "live_medication", "service_state"].includes(lower(value));
}

function isIndirectSourceType(value) {
  return ["predictive", "context", "profile_context", "care-circle", "care_circle", "supporting"].includes(lower(value));
}

function diversityStatus({ highPressure, highConfidence, distinctSourceTypes, corroboratingCount, liveSourceCount, indirectOnly }) {
  if (corroboratingCount === 0) return "fragile";
  if (indirectOnly && (highPressure || highConfidence)) return "fragile";
  if ((highPressure || highConfidence) && (corroboratingCount < 2 || distinctSourceTypes < 2)) return "fragile";
  if (liveSourceCount === 0 && (highPressure || highConfidence)) return "fragile";
  if (corroboratingCount < 2 || distinctSourceTypes < 2) return "guarded";
  if (liveSourceCount === 0 && distinctSourceTypes < 3) return "guarded";
  return "strong";
}

function issue(type, item, severity, detail) {
  return {
    type,
    severity,
    section_key: text(item?.section_key) || null,
    item_id: text(item?.item_id) || null,
    message: detail,
  };
}

export function buildHealthPlanRecommendationEvidenceDiversity({
  recommendationSourceRanking = null,
} = {}) {
  const ranking = objectValue(recommendationSourceRanking);
  if (!ranking) return null;

  const items = (Array.isArray(ranking.items) ? ranking.items : [])
    .map((item) => {
      const rankedSources = Array.isArray(item?.ranked_sources) ? item.ranked_sources : [];
      const sourceTypes = [...new Set(rankedSources.map((source) => lower(source?.source_type)).filter(Boolean))];
      const corroboratingCount = rankedSources.filter((source) => authorityRank(lower(source?.authority_level)) >= authorityRank("medium")).length;
      const liveSourceCount = rankedSources.filter((source) => isLiveSourceType(source?.source_type)).length;
      const indirectOnly = rankedSources.length > 0 && rankedSources.every((source) => !isLiveSourceType(source?.source_type) && isIndirectSourceType(source?.source_type));
      const highPressure = lower(item?.priority) === "high" || lower(item?.timing) === "today";
      const highConfidence = lower(item?.confidence) === "high";
      const status = diversityStatus({
        highPressure,
        highConfidence,
        distinctSourceTypes: sourceTypes.length,
        corroboratingCount,
        liveSourceCount,
        indirectOnly,
      });

      let reason = "This recommendation has a healthy mix of evidence types behind it.";
      if (status === "fragile" && indirectOnly) {
        reason = "This recommendation is leaning on indirect or contextual evidence without a live operational anchor.";
      } else if (status === "fragile") {
        reason = "This recommendation is being pushed harder than the diversity of evidence really supports.";
      } else if (status === "guarded") {
        reason = "This recommendation has some support, but the evidence mix is still narrower than ideal.";
      }

      return {
        item_id: text(item?.item_id) || null,
        section_key: text(item?.section_key) || null,
        section_label: text(item?.section_label) || null,
        text: text(item?.text) || null,
        diversity_status: status,
        source_count: rankedSources.length,
        corroborating_source_count: corroboratingCount,
        distinct_source_type_count: sourceTypes.length,
        live_source_count: liveSourceCount,
        dominant_source_type: sourceTypes[0] || null,
        indirect_only: indirectOnly,
        high_pressure: highPressure,
        high_confidence: highConfidence,
        reason,
        next_step:
          status === "strong"
            ? "Keep this evidence mix unless fresher live signals overturn it."
            : status === "guarded"
              ? "Add one stronger corroborating source or soften the wording."
              : "Do not let this recommendation sound decisive until a stronger live anchor is added.",
      };
    })
    .filter((item) => item.section_key && item.text);

  const issues = [];
  for (const item of items) {
    if (item.diversity_status === "fragile" && item.high_pressure) {
      issues.push(issue(
        "single_source_high_pressure",
        item,
        "high",
        `${item.text} is high-pressure guidance without enough diverse corroboration behind it.`,
      ));
    }
    if (item.diversity_status === "fragile" && item.indirect_only) {
      issues.push(issue(
        "indirect_only_grounding",
        item,
        item.high_confidence ? "high" : "medium",
        `${item.text} is grounded mostly in indirect or contextual signals instead of live operational evidence.`,
      ));
    }
    if (item.diversity_status !== "strong" && item.high_confidence) {
      issues.push(issue(
        "high_confidence_low_diversity",
        item,
        "high",
        `${item.text} is written with high confidence even though the evidence mix is still too narrow.`,
      ));
    }
  }

  const strongCount = items.filter((item) => item.diversity_status === "strong").length;
  const guardedCount = items.filter((item) => item.diversity_status === "guarded").length;
  const fragileCount = items.filter((item) => item.diversity_status === "fragile").length;
  const highPriorityFragileCount = items.filter((item) => item.diversity_status === "fragile" && item.high_pressure).length;
  const overallStatus =
    fragileCount > 0 ? "fragile"
      : guardedCount > 0 ? "guarded"
        : "strong";
  const summary =
    overallStatus === "strong"
      ? "Most recommendations are supported by a healthy mix of evidence types rather than a single narrow signal."
      : overallStatus === "guarded"
        ? "Some recommendations are usable, but the evidence mix is still narrower than ideal and should stay cautious."
        : "At least one recommendation is leaning too hard on a narrow evidence mix and needs a stronger live anchor or softer wording.";

  return {
    overall_status: overallStatus,
    summary,
    item_count: items.length,
    strong_count: strongCount,
    guarded_count: guardedCount,
    fragile_count: fragileCount,
    high_priority_fragile_count: highPriorityFragileCount,
    issues: issues.slice(0, 8),
    items,
  };
}

export function shouldRejectHealthPlanRecommendationEvidenceDiversity(summary) {
  const normalized = objectValue(summary);
  if (!normalized) return false;
  const issues = Array.isArray(normalized.issues) ? normalized.issues : [];
  return issues.some((item) => lower(item?.severity) === "high") || Number(normalized.high_priority_fragile_count || 0) > 0;
}
