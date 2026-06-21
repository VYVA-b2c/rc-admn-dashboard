const SECTION_LABELS = {
  goals_json: "Goals",
  daily_support_json: "Daily support",
  monitoring_json: "Monitoring",
  escalation_json: "Escalation",
  caregiver_guidance_json: "Caregiver guidance",
};

const SECTION_KEYS = Object.keys(SECTION_LABELS);

function text(value) {
  return String(value || "").trim();
}

function unique(values) {
  return [...new Set((Array.isArray(values) ? values : []).map((value) => text(value)).filter(Boolean))];
}

function normalizeVersion(value) {
  const version = Number(value || 0);
  return Number.isFinite(version) && version > 0 ? version : 1;
}

function recommendationTextKey(sectionKey, value) {
  return `${text(sectionKey)}:${text(value).toLowerCase()}`;
}

function recommendationItemKey(sectionKey, item) {
  const itemId = text(item?.item_id || item?.id);
  if (itemId) return `${text(sectionKey)}:${itemId}`;
  return recommendationTextKey(sectionKey, item?.text);
}

function normalizeLearningItems(items = []) {
  return (Array.isArray(items) ? items : [])
    .map((item) => {
      const sectionKey = text(item?.section_key);
      const itemText = text(item?.text);
      if (!sectionKey || !itemText) return null;
      return {
        item_id: text(item?.item_id) || null,
        section_key: sectionKey,
        section_label: text(item?.section_label) || SECTION_LABELS[sectionKey] || sectionKey,
        text: itemText,
        status: text(item?.status) || null,
        reuse_priority: text(item?.reuse_priority) || null,
        trajectory: text(item?.trajectory) || null,
        latest_outcome: text(item?.latest_outcome) || null,
        freshness_status: text(item?.freshness_status) || null,
        contradiction_status: text(item?.contradiction_status) || null,
        reason: text(item?.reason) || null,
        feedback_count: Number.isFinite(Number(item?.feedback_count)) ? Number(item.feedback_count) : 0,
        helped_count: Number.isFinite(Number(item?.helped_count)) ? Number(item.helped_count) : 0,
        mixed_count: Number.isFinite(Number(item?.mixed_count)) ? Number(item.mixed_count) : 0,
        did_not_help_count: Number.isFinite(Number(item?.did_not_help_count)) ? Number(item.did_not_help_count) : 0,
        needs_follow_up_count: Number.isFinite(Number(item?.needs_follow_up_count)) ? Number(item.needs_follow_up_count) : 0,
        source_signal_ids: unique(item?.source_signal_ids),
      };
    })
    .filter(Boolean);
}

function sectionItems(revision) {
  return SECTION_KEYS.flatMap((sectionKey) =>
    (Array.isArray(revision?.[sectionKey]) ? revision[sectionKey] : []).map((item) => ({
      key: recommendationItemKey(sectionKey, item),
      text_key: recommendationTextKey(sectionKey, item?.text),
      text: text(item?.text),
      section_key: sectionKey,
      section_label: SECTION_LABELS[sectionKey] || sectionKey,
      source_signal_ids: unique(item?.source_signal_ids),
    })).filter((item) => item.text),
  );
}

function cautionFeedbackCount(item) {
  return Number(item?.did_not_help_count || 0) + Number(item?.needs_follow_up_count || 0);
}

function survivorshipStatus(entry, currentVersion) {
  if (!entry.present_in_current) {
    if (entry.best_helped_count > 0 || entry.ever_preserve) return "retired";
    return "retired";
  }
  const latestOutcome = text(entry.latest_outcome);
  const severeCaution =
    entry.latest_contradiction
    || ["replace", "verify"].includes(entry.latest_reuse_priority)
    || entry.latest_status === "fragile"
    || entry.latest_trajectory === "weakening"
    || ["did_not_help", "needs_follow_up"].includes(latestOutcome)
    || entry.caution_feedback_count >= 2;
  if (severeCaution) {
    return "fragile";
  }
  const cautionPressure =
    entry.latest_status === "mixed"
    || entry.latest_trajectory === "volatile"
    || latestOutcome === "mixed"
    || entry.mixed_feedback_count > 0
    || entry.caution_feedback_count > 0
    || entry.latest_freshness_status === "stale";
  if (
    entry.appearance_count >= 3
    && !cautionPressure
    && (entry.best_helped_count >= 2 || entry.ever_preserve || ["strengthening", "stable"].includes(entry.latest_trajectory))
  ) {
    return "durable";
  }
  if (entry.appearance_count >= 2 || entry.first_seen_version !== currentVersion) {
    return "emerging";
  }
  return "fragile";
}

function survivorshipReason(entry, status) {
  if (status === "durable") {
    return entry.latest_reason
      || "This recommendation pattern has survived across multiple versions and kept enough positive proof to preserve.";
  }
  if (status === "emerging") {
    if (entry.caution_feedback_count > 0 || entry.mixed_feedback_count > 0 || entry.latest_freshness_status === "stale") {
      return entry.latest_reason
        || "This recommendation has survived across versions, but the proof is still mixed or aging, so it is not a stable default yet.";
    }
    return entry.latest_reason
      || "This recommendation is starting to persist across versions, but still needs more proof before it becomes a durable default.";
  }
  if (status === "fragile") {
    if (
      entry.caution_feedback_count >= 2
      || ["did_not_help", "needs_follow_up"].includes(text(entry.latest_outcome))
      || entry.latest_trajectory === "weakening"
    ) {
      return entry.latest_reason
        || "This recommendation survived across versions, but repeated negative or unresolved outcomes mean it should not be treated as stable.";
    }
    return entry.latest_reason
      || "This recommendation is still present, but recent contradictions or weak proof mean it should be treated cautiously.";
  }
  return entry.latest_reason
    || "This recommendation pattern helped before, but it no longer survives in the current plan.";
}

function survivorshipScore(entry, status) {
  const base =
    status === "durable" ? 90
      : status === "emerging" ? 68
        : status === "fragile" ? 34
          : 58;
  const cautionPenalty =
    (entry.caution_feedback_count * 6)
    + (entry.mixed_feedback_count * 3)
    + (entry.latest_freshness_status === "stale" ? 8 : 0)
    + (entry.latest_trajectory === "volatile" ? 6 : 0);
  return Math.max(0, Math.min(100, base + (entry.appearance_count * 2) + entry.best_helped_count - (entry.latest_contradiction ? 10 : 0) - cautionPenalty));
}

export function buildHealthPlanRecommendationSurvivorship({
  history = [],
} = {}) {
  const revisions = [...(Array.isArray(history) ? history : [])]
    .filter(Boolean)
    .sort((left, right) => normalizeVersion(right?.version_number) - normalizeVersion(left?.version_number));
  if (!revisions.length) {
    return {
      summary: "No saved recommendation history is available yet.",
      total_patterns: 0,
      durable_count: 0,
      emerging_count: 0,
      fragile_count: 0,
      retired_count: 0,
      durable: [],
      emerging: [],
      fragile: [],
      retired: [],
    };
  }

  const currentVersion = normalizeVersion(revisions[0]?.version_number);
  const currentKeys = new Set(sectionItems(revisions[0]).map((item) => item.text_key));
  const survivorship = new Map();

  for (const revision of revisions) {
    const version = normalizeVersion(revision?.version_number);
    const items = sectionItems(revision);
    const learningLookup = new Map(
      normalizeLearningItems(revision?.recommendation_learning_json).map((item) => [recommendationItemKey(item.section_key, item), item]),
    );

    for (const item of items) {
      const learning = learningLookup.get(item.key) || learningLookup.get(recommendationTextKey(item.section_key, item.text)) || null;
      const canonicalKey = item.text_key;
      if (!survivorship.has(canonicalKey)) {
        survivorship.set(canonicalKey, {
          key: canonicalKey,
          latest_item_key: item.key,
          text: item.text,
          section_key: item.section_key,
          section_label: item.section_label,
          source_signal_ids: unique(item.source_signal_ids),
          appearance_count: 0,
          versions_seen: [],
          first_seen_version: version,
          latest_seen_version: version,
          latest_reason: null,
          latest_status: null,
          latest_reuse_priority: null,
          latest_trajectory: null,
          latest_outcome: null,
          latest_freshness_status: null,
          latest_contradiction: null,
          best_helped_count: 0,
          mixed_feedback_count: 0,
          caution_feedback_count: 0,
          total_feedback_count: 0,
          ever_preserve: false,
          present_in_current: false,
        });
      }

      const entry = survivorship.get(canonicalKey);
      entry.appearance_count += 1;
      entry.latest_item_key = item.key || entry.latest_item_key;
      entry.versions_seen.push(version);
      entry.first_seen_version = Math.min(entry.first_seen_version, version);
      entry.latest_seen_version = Math.max(entry.latest_seen_version, version);
      entry.present_in_current = currentKeys.has(item.text_key);
      entry.source_signal_ids = unique([...(entry.source_signal_ids || []), ...(item.source_signal_ids || [])]);

      if (version === entry.latest_seen_version && learning) {
        entry.latest_reason = learning.reason || entry.latest_reason;
        entry.latest_status = learning.status || entry.latest_status;
        entry.latest_reuse_priority = learning.reuse_priority || entry.latest_reuse_priority;
        entry.latest_trajectory = learning.trajectory || entry.latest_trajectory;
        entry.latest_outcome = learning.latest_outcome || entry.latest_outcome;
        entry.latest_freshness_status = learning.freshness_status || entry.latest_freshness_status;
        entry.latest_contradiction = learning.contradiction_status || entry.latest_contradiction;
      }
      if (learning) {
        entry.best_helped_count = Math.max(entry.best_helped_count, Number(learning.helped_count || 0));
        entry.mixed_feedback_count = Math.max(entry.mixed_feedback_count, Number(learning.mixed_count || 0));
        entry.caution_feedback_count = Math.max(entry.caution_feedback_count, cautionFeedbackCount(learning));
        entry.total_feedback_count = Math.max(entry.total_feedback_count, Number(learning.feedback_count || 0));
        entry.ever_preserve = entry.ever_preserve || learning.reuse_priority === "preserve";
        if (!entry.latest_reason) entry.latest_reason = learning.reason || null;
        if (!entry.latest_status) entry.latest_status = learning.status || null;
        if (!entry.latest_reuse_priority) entry.latest_reuse_priority = learning.reuse_priority || null;
        if (!entry.latest_trajectory) entry.latest_trajectory = learning.trajectory || null;
        if (!entry.latest_outcome) entry.latest_outcome = learning.latest_outcome || null;
        if (!entry.latest_freshness_status) entry.latest_freshness_status = learning.freshness_status || null;
        if (!entry.latest_contradiction) entry.latest_contradiction = learning.contradiction_status || null;
      }
    }
  }

  const items = [...survivorship.values()]
    .map((entry) => {
      const status = survivorshipStatus(entry, currentVersion);
      return {
        item_key: entry.key,
        section_key: entry.section_key,
        section_label: entry.section_label,
        text: entry.text,
        status,
        score: survivorshipScore(entry, status),
        appearance_count: entry.appearance_count,
        first_seen_version: entry.first_seen_version,
        latest_seen_version: entry.latest_seen_version,
        present_in_current: entry.present_in_current,
        reuse_priority: entry.latest_reuse_priority,
        trajectory: entry.latest_trajectory,
        latest_outcome: entry.latest_outcome,
        freshness_status: entry.latest_freshness_status,
        contradiction_status: entry.latest_contradiction,
        helped_count: entry.best_helped_count,
        mixed_count: entry.mixed_feedback_count,
        caution_feedback_count: entry.caution_feedback_count,
        feedback_count: entry.total_feedback_count,
        source_signal_ids: entry.source_signal_ids,
        reason: survivorshipReason(entry, status),
      };
    })
    .sort((left, right) => right.score - left.score);

  const durable = items.filter((item) => item.status === "durable").slice(0, 6);
  const emerging = items.filter((item) => item.status === "emerging").slice(0, 6);
  const fragile = items.filter((item) => item.status === "fragile").slice(0, 6);
  const retired = items.filter((item) => item.status === "retired").slice(0, 6);

  const summary =
    durable.length > 0
      ? `${durable.length} recommendation pattern${durable.length === 1 ? "" : "s"} has survived across versions and is worth protecting unless fresher evidence contradicts it.`
      : emerging.length > 0
        ? "Some recommendation patterns are starting to persist, but none are durable enough yet to treat as stable defaults."
        : "Recommendation-level survivorship is still thin, so the next plan should stay more evidence-conservative.";

  return {
    summary,
    total_patterns: items.length,
    durable_count: durable.length,
    emerging_count: emerging.length,
    fragile_count: fragile.length,
    retired_count: retired.length,
    durable,
    emerging,
    fragile,
    retired,
  };
}
