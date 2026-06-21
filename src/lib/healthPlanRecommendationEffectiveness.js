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

function normalizeReason(item) {
  return text(item?.reason) || "No recommendation-specific learning note is available yet.";
}

function normalizeRecommendedNextAction(value) {
  const normalized = text(value).toLowerCase();
  if (["preserve", "verify", "rework", "retire"].includes(normalized)) return normalized;
  return null;
}

function canonicalText(value) {
  return lower(value).replace(/[^a-z0-9]+/g, " ").trim();
}

function survivorshipKey(sectionKey, value) {
  const section = text(sectionKey);
  const normalizedText = canonicalText(value);
  if (!section || !normalizedText) return null;
  return `${section}:${normalizedText}`;
}

function scoreWeight(item) {
  const score = Number(item?.score || 0);
  const helped = Number(item?.helped_count || 0);
  const caution = Number(item?.did_not_help_count || 0) + Number(item?.needs_follow_up_count || 0);
  const weightedHelped = Number(item?.weighted_helped_score || 0);
  const weightedCaution = Number(item?.weighted_caution_score || 0);
  return score + (helped * 4) - (caution * 5) + (weightedHelped * 6) - (weightedCaution * 7);
}

function normalizeEntry(item = {}) {
  return {
    item_id: text(item?.item_id) || null,
    section_key: text(item?.section_key) || null,
    section_label: text(item?.section_label) || text(item?.label) || null,
    text: text(item?.text) || null,
    status: text(item?.status) || null,
    score: Number.isFinite(Number(item?.score)) ? Number(item.score) : 0,
    latest_outcome: text(item?.latest_outcome) || null,
    latest_source: text(item?.latest_source) || null,
    latest_recommended_next_action: normalizeRecommendedNextAction(item?.latest_recommended_next_action),
    latest_confidence_level: text(item?.latest_confidence_level) || null,
    freshness_status: text(item?.freshness_status) || null,
    trajectory: text(item?.trajectory) || null,
    reuse_priority: text(item?.reuse_priority) || null,
    contradiction_status: text(item?.contradiction_status) || null,
    contradiction_reason: text(item?.contradiction_reason) || null,
    feedback_count: Number.isFinite(Number(item?.feedback_count)) ? Number(item.feedback_count) : 0,
    explicit_feedback_count: Number.isFinite(Number(item?.explicit_feedback_count)) ? Number(item.explicit_feedback_count) : 0,
    inferred_feedback_count: Number.isFinite(Number(item?.inferred_feedback_count)) ? Number(item.inferred_feedback_count) : 0,
    explicit_helped_count: Number.isFinite(Number(item?.explicit_helped_count)) ? Number(item.explicit_helped_count) : 0,
    inferred_helped_count: Number.isFinite(Number(item?.inferred_helped_count)) ? Number(item.inferred_helped_count) : 0,
    recent_helped_count: Number.isFinite(Number(item?.recent_helped_count)) ? Number(item.recent_helped_count) : 0,
    recent_explicit_helped_count: Number.isFinite(Number(item?.recent_explicit_helped_count)) ? Number(item.recent_explicit_helped_count) : 0,
    recent_caution_count: Number.isFinite(Number(item?.recent_caution_count)) ? Number(item.recent_caution_count) : 0,
    weighted_helped_score: Number.isFinite(Number(item?.weighted_helped_score)) ? Number(item.weighted_helped_score) : 0,
    weighted_caution_score: Number.isFinite(Number(item?.weighted_caution_score)) ? Number(item.weighted_caution_score) : 0,
    helped_count: Number.isFinite(Number(item?.helped_count)) ? Number(item.helped_count) : 0,
    did_not_help_count: Number.isFinite(Number(item?.did_not_help_count)) ? Number(item.did_not_help_count) : 0,
    needs_follow_up_count: Number.isFinite(Number(item?.needs_follow_up_count)) ? Number(item.needs_follow_up_count) : 0,
    operational_positive_count: Number.isFinite(Number(item?.operational_positive_count)) ? Number(item.operational_positive_count) : 0,
    operational_caution_count: Number.isFinite(Number(item?.operational_caution_count)) ? Number(item.operational_caution_count) : 0,
    operational_pattern: text(item?.operational_pattern) || null,
    source_signal_ids: unique(item?.source_signal_ids),
    reason: normalizeReason(item),
  };
}

function effectiveReusePriority(item) {
  if (item?.latest_recommended_next_action === "preserve") return "preserve";
  if (item?.latest_recommended_next_action === "verify") return "verify";
  if (item?.latest_recommended_next_action === "rework") return "refine";
  if (item?.latest_recommended_next_action === "retire") return "replace";
  return text(item?.reuse_priority) || null;
}

function groupSummary(group, emptyText, activeText) {
  if (!Array.isArray(group) || group.length === 0) return emptyText;
  return `${group.length} recommendation${group.length === 1 ? "" : "s"} ${activeText}`;
}

function survivorshipLookup(summary = null) {
  const groups = ["durable", "emerging", "fragile", "retired"];
  const map = new Map();
  for (const status of groups) {
    for (const item of Array.isArray(summary?.[status]) ? summary[status] : []) {
      const key = survivorshipKey(item?.section_key, item?.text);
      if (!key) continue;
      map.set(key, {
        status,
        reason: text(item?.reason) || null,
        score: Number.isFinite(Number(item?.score)) ? Number(item.score) : 0,
        caution_feedback_count: Number.isFinite(Number(item?.caution_feedback_count)) ? Number(item.caution_feedback_count) : 0,
        mixed_count: Number.isFinite(Number(item?.mixed_count)) ? Number(item.mixed_count) : 0,
        latest_outcome: text(item?.latest_outcome) || null,
      });
    }
  }
  return map;
}

function impactKey(item) {
  return `${item.section_key}:${item.item_id}`;
}

function explicitFeedback(item) {
  return text(item?.latest_source) && text(item?.latest_source) !== "inferred_operational";
}

function shouldRetire(item, impactLookup) {
  const impact = impactLookup.get(impactKey(item));
  return item.latest_recommended_next_action === "retire"
    || item.effective_reuse_priority === "replace"
    || (item.status === "fragile" && (item.did_not_help_count + item.needs_follow_up_count) >= 2)
    || text(impact?.recommended_action) === "retire"
    || (item.survivorship_status === "fragile" && Number(item.survivorship_caution_feedback_count || 0) >= 2);
}

function shouldRework(item, impactLookup) {
  const impact = impactLookup.get(impactKey(item));
  if (shouldRetire(item, impactLookup)) return false;
  return item.latest_recommended_next_action === "rework"
    || item.latest_recommended_next_action === "verify"
    || item.effective_reuse_priority === "refine"
    || item.effective_reuse_priority === "verify"
    || item.trajectory === "volatile"
    || item.contradiction_status === "live_conflict"
    || item.contradiction_status === "section_conflict"
    || item.survivorship_status === "fragile"
    || ["mixed", "contradicted"].includes(text(impact?.impact_status));
}

function preserveStrength(item, impactLookup) {
  const impact = impactLookup.get(impactKey(item));
  if (shouldRetire(item, impactLookup) || shouldRework(item, impactLookup)) return null;
  if (
    item.latest_recommended_next_action === "preserve"
    && explicitFeedback(item)
    && ["high", "medium"].includes(lower(item?.latest_confidence_level))
  ) {
    return "must_preserve";
  }
  if (
    item.recent_explicit_helped_count >= 2
    && item.weighted_caution_score < 0.75
    && item.freshness_status !== "stale"
    && item.contradiction_status !== "live_conflict"
    && !["mixed", "contradicted"].includes(text(impact?.impact_status))
  ) {
    return "must_preserve";
  }
  if (
    item.explicit_helped_count >= 2
    && item.did_not_help_count === 0
    && item.needs_follow_up_count === 0
    && item.freshness_status !== "stale"
    && item.contradiction_status !== "live_conflict"
    && !["mixed", "contradicted"].includes(text(impact?.impact_status))
  ) {
    return "must_preserve";
  }
  if (
    (item.recent_helped_count >= 1 && item.weighted_helped_score >= 1.15 && item.weighted_caution_score < 1.05)
    || item.explicit_helped_count >= 1
    || item.helped_count >= 2
    || (
      item.operational_pattern === "reinforcing"
      && item.operational_positive_count >= 2
      && item.operational_caution_count === 0
    )
  ) {
    return "prefer_preserve";
  }
  return null;
}

function repairStrength(action, item, impactLookup) {
  const impact = impactLookup.get(impactKey(item));
  if (action === "retire") {
    if (
      (item.latest_recommended_next_action === "retire" && explicitFeedback(item))
      || item.recent_caution_count >= 2
      || item.weighted_caution_score >= 1.9
      || (item.did_not_help_count + item.needs_follow_up_count) >= 2
      || text(impact?.recommended_action) === "retire"
      || (item.survivorship_status === "fragile" && Number(item.survivorship_caution_feedback_count || 0) >= 2)
      || item.operational_caution_count >= 3
    ) {
      return "must_replace";
    }
    return "prefer_replace";
  }
  if (action === "verify") {
    if (
      (item.latest_recommended_next_action === "verify" && explicitFeedback(item))
      || item.contradiction_status === "live_conflict"
      || text(impact?.impact_status) === "contradicted"
      || (item.recent_caution_count >= 1 && item.weighted_caution_score > item.weighted_helped_score)
    ) {
      return "must_verify";
    }
    return "prefer_verify";
  }
  if (action === "rework") {
    if (
      (item.latest_recommended_next_action === "rework" && explicitFeedback(item))
      || item.recent_caution_count >= 1
      || item.weighted_caution_score >= 1.2
      || item.did_not_help_count >= 1
      || item.needs_follow_up_count >= 1
      || item.operational_pattern === "conflicting"
    ) {
      return "must_rewrite";
    }
    return "prefer_rewrite";
  }
  return null;
}

export function buildHealthPlanRecommendationEffectiveness({
  recommendationLearning = [],
  recommendationSurvivorship = null,
  recommendationImpact = null,
} = {}) {
  const survivorshipByItem = survivorshipLookup(recommendationSurvivorship);
  const normalized = (Array.isArray(recommendationLearning) ? recommendationLearning : [])
    .map((item) => {
      const normalizedItem = normalizeEntry(item);
      const survivorship = survivorshipByItem.get(survivorshipKey(normalizedItem.section_key, normalizedItem.text));
      return {
        ...normalizedItem,
        effective_reuse_priority: effectiveReusePriority(normalizedItem),
        survivorship_status: text(survivorship?.status) || null,
        survivorship_reason: text(survivorship?.reason) || null,
        survivorship_score: Number.isFinite(Number(survivorship?.score)) ? Number(survivorship.score) : null,
        survivorship_caution_feedback_count: Number.isFinite(Number(survivorship?.caution_feedback_count)) ? Number(survivorship.caution_feedback_count) : 0,
      };
    })
    .filter((item) => item.section_key && item.text);
  const impactLookup = new Map(
    (Array.isArray(recommendationImpact?.items) ? recommendationImpact.items : [])
      .map((item) => {
        const itemId = text(item?.item_id);
        const sectionKey = text(item?.section_key);
        return itemId && sectionKey ? [`${sectionKey}:${itemId}`, item] : null;
      })
      .filter(Boolean),
  );

  const preserveNow = normalized
    .filter((item) =>
      item.effective_reuse_priority === "preserve"
      && item.status === "helping"
      && !["fragile", "retired"].includes(item.survivorship_status)
      && item.contradiction_status !== "live_conflict"
      && item.freshness_status !== "stale"
      && !["contradicted", "mixed"].includes(text(impactLookup.get(impactKey(item))?.impact_status)))
    .sort((left, right) => {
      const leftStrength = preserveStrength(left, impactLookup) === "must_preserve" ? 1 : 0;
      const rightStrength = preserveStrength(right, impactLookup) === "must_preserve" ? 1 : 0;
      if (rightStrength !== leftStrength) return rightStrength - leftStrength;
      return scoreWeight(right) - scoreWeight(left);
    })
    .slice(0, 5)
    .map((item) => ({
      ...item,
      action: "preserve",
      preserve_strength: preserveStrength(item, impactLookup),
      action_reason: item.survivorship_reason || item.reason,
      canonical_text: canonicalText(item.text),
      impact_status: text(impactLookup.get(impactKey(item))?.impact_status) || null,
    }));

  const reworkNow = normalized
    .filter((item) => shouldRework(item, impactLookup))
    .sort((left, right) => {
      const leftAction =
        left.latest_recommended_next_action === "verify"
        || text(impactLookup.get(impactKey(left))?.recommended_action) === "verify"
        || left.effective_reuse_priority === "verify"
          ? "verify"
          : "rework";
      const rightAction =
        right.latest_recommended_next_action === "verify"
        || text(impactLookup.get(impactKey(right))?.recommended_action) === "verify"
        || right.effective_reuse_priority === "verify"
          ? "verify"
          : "rework";
      const leftStrength = lower(repairStrength(leftAction, left, impactLookup)).startsWith("must_") ? 1 : 0;
      const rightStrength = lower(repairStrength(rightAction, right, impactLookup)).startsWith("must_") ? 1 : 0;
      if (rightStrength !== leftStrength) return rightStrength - leftStrength;
      return scoreWeight(left) - scoreWeight(right);
    })
    .slice(0, 6)
    .map((item) => ({
      ...item,
      action:
        item.latest_recommended_next_action === "verify"
        || text(impactLookup.get(impactKey(item))?.recommended_action) === "verify"
        || item.effective_reuse_priority === "verify"
          ? "verify"
          : "rework",
      repair_strength: repairStrength(
        item.latest_recommended_next_action === "verify"
        || text(impactLookup.get(impactKey(item))?.recommended_action) === "verify"
        || item.effective_reuse_priority === "verify"
          ? "verify"
          : "rework",
        item,
        impactLookup,
      ),
      action_reason: text(impactLookup.get(impactKey(item))?.reason) || item.survivorship_reason || item.contradiction_reason || item.reason,
      canonical_text: canonicalText(item.text),
      impact_status: text(impactLookup.get(impactKey(item))?.impact_status) || null,
    }));

  const retireNow = normalized
    .filter((item) => shouldRetire(item, impactLookup))
    .sort((left, right) => {
      const leftStrength = repairStrength("retire", left, impactLookup) === "must_replace" ? 1 : 0;
      const rightStrength = repairStrength("retire", right, impactLookup) === "must_replace" ? 1 : 0;
      if (rightStrength !== leftStrength) return rightStrength - leftStrength;
      return scoreWeight(left) - scoreWeight(right);
    })
    .slice(0, 6)
    .map((item) => ({
      ...item,
      action: "retire",
      repair_strength: repairStrength("retire", item, impactLookup),
      action_reason: text(impactLookup.get(impactKey(item))?.reason) || item.survivorship_reason || item.reason,
      canonical_text: canonicalText(item.text),
      impact_status: text(impactLookup.get(impactKey(item))?.impact_status) || null,
    }));

  const durablePatterns = Array.isArray(recommendationSurvivorship?.durable) ? recommendationSurvivorship.durable.length : 0;
  const fragilePatterns = Array.isArray(recommendationSurvivorship?.fragile) ? recommendationSurvivorship.fragile.length : 0;
  const retiredPatterns = Array.isArray(recommendationSurvivorship?.retired) ? recommendationSurvivorship.retired.length : 0;
  const mustPreserveCount = preserveNow.filter((item) => item.preserve_strength === "must_preserve").length;
  const mustVerifyCount = reworkNow.filter((item) => item.action === "verify" && item.repair_strength === "must_verify").length;
  const mustRewriteCount = reworkNow.filter((item) => item.action === "rework" && item.repair_strength === "must_rewrite").length;
  const mustReplaceCount = retireNow.filter((item) => item.repair_strength === "must_replace").length;

  const overallStatus =
    retireNow.length >= 2
      ? "fragile"
      : retireNow.length > 0 || reworkNow.length > 0
        ? "mixed"
        : "supportive";

  const summary =
    overallStatus === "fragile"
      ? "Recommendation history shows multiple routines that should not come back unchanged because they repeatedly failed or stayed unresolved."
      : overallStatus === "mixed"
        ? "Recommendation history contains a mix of preserve-worthy routines and others that still need rework or verification."
        : "Recommendation history mainly supports preserving the strongest routines that have already helped this client.";

  return {
    overall_status: overallStatus,
    summary,
    preserve_count: preserveNow.length,
    rework_count: reworkNow.length,
    retire_count: retireNow.length,
    durable_pattern_count: durablePatterns,
    fragile_pattern_count: fragilePatterns,
    retired_pattern_count: retiredPatterns,
    must_preserve_count: mustPreserveCount,
    must_verify_count: mustVerifyCount,
    must_rewrite_count: mustRewriteCount,
    must_replace_count: mustReplaceCount,
    preserve_now: preserveNow,
    rework_now: reworkNow,
    retire_now: retireNow,
    preserve_signal_ids: unique(preserveNow.flatMap((item) => item.source_signal_ids)),
    avoid_signal_ids: unique(retireNow.flatMap((item) => item.source_signal_ids)),
    preserve_summary: groupSummary(preserveNow, "No recommendation has earned strong preserve status yet.", "are worth protecting because they already helped this client."),
    rework_summary: groupSummary(reworkNow, "No recommendation is strongly flagged for rewrite right now.", "still need tighter wording, verification, or a better fit."),
    retire_summary: groupSummary(retireNow, "No recommendation is strongly flagged for retirement right now.", "should not return unchanged because they repeatedly failed or stayed unresolved."),
  };
}

function nextPlanItems(plan = null) {
  const sections = ["goals_json", "daily_support_json", "monitoring_json", "escalation_json", "caregiver_guidance_json"];
  return sections.flatMap((sectionKey) =>
    (Array.isArray(plan?.[sectionKey]) ? plan[sectionKey] : []).map((item) => ({
      section_key: sectionKey,
      text: text(item?.text),
      canonical_text: canonicalText(item?.text),
      source_signal_ids: unique(item?.source_signal_ids),
    })).filter((item) => item.text),
  );
}

export function findHealthPlanRecommendationEffectivenessIssues(plan, effectiveness = null) {
  const summary = objectValue(effectiveness);
  if (!plan || !summary) return [];

  const nextItems = nextPlanItems(plan);
  const issues = [];

  for (const retired of Array.isArray(summary.retire_now) ? summary.retire_now : []) {
    const retiredText = canonicalText(retired?.text);
    if (!retiredText) continue;
    const repeated = nextItems.find((item) => item.section_key === text(retired?.section_key) && item.canonical_text === retiredText);
    if (repeated) {
      issues.push({
        type: "retired_recommendation_returned",
        section_key: text(retired?.section_key) || null,
        severity: "high",
        message: `Health plan generation brought back a recommendation that should be retired unchanged: "${text(retired?.text)}".`,
      });
    }
  }

  for (const rework of Array.isArray(summary.rework_now) ? summary.rework_now : []) {
    const reworkText = canonicalText(rework?.text);
    if (!reworkText) continue;
    const repeated = nextItems.find((item) => item.section_key === text(rework?.section_key) && item.canonical_text === reworkText);
    if (repeated) {
      issues.push({
        type: "rework_recommendation_returned_unchanged",
        section_key: text(rework?.section_key) || null,
        severity: "medium",
        message: `Health plan generation carried forward a recommendation unchanged even though it still needed rework or verification: "${text(rework?.text)}".`,
      });
    }
  }

  return issues;
}
