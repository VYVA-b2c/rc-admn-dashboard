const SECTION_LABELS = {
  goals_json: "Goals",
  daily_support_json: "Daily support",
  monitoring_json: "Monitoring",
  escalation_json: "Escalation",
  caregiver_guidance_json: "Caregiver guidance",
};

function text(value) {
  return String(value || "").trim();
}

function lower(value) {
  return text(value).toLowerCase();
}

function normalizeVersion(value) {
  const version = Number(value || 0);
  return Number.isFinite(version) && version > 0 ? version : 1;
}

function objectValue(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function recommendationKey(sectionKey, itemText) {
  const normalizedSectionKey = text(sectionKey);
  const normalizedText = lower(itemText);
  if (!normalizedSectionKey || !normalizedText) return null;
  return `${normalizedSectionKey}:${normalizedText}`;
}

function normalizeRevisions(history = []) {
  return [...(Array.isArray(history) ? history : [])]
    .filter(Boolean)
    .sort((left, right) => normalizeVersion(right?.version_number) - normalizeVersion(left?.version_number));
}

function normalizeImpactStatus(value) {
  const normalized = lower(value);
  if (normalized === "reinforcing") return "reinforced";
  if (["reinforced", "mixed", "contradicted", "limited"].includes(normalized)) return normalized;
  return null;
}

function normalizeAction(value) {
  const normalized = lower(value);
  if (["preserve", "rework", "retire", "verify"].includes(normalized)) return normalized;
  return null;
}

function normalizeImpactItems(summary = null, source = "impact") {
  return (Array.isArray(summary?.items) ? summary.items : [])
    .map((item) => {
      const sectionKey = text(item?.section_key);
      const itemText = text(item?.text);
      const key = recommendationKey(sectionKey, itemText);
      if (!key || !itemText) return null;
      return {
        key,
        section_key: sectionKey,
        section_label: text(item?.section_label) || SECTION_LABELS[sectionKey] || sectionKey,
        text: itemText,
        impact_status: normalizeImpactStatus(item?.impact_status),
        recommended_action: normalizeAction(item?.recommended_action),
        is_high_priority: Boolean(item?.is_high_priority),
        reason: text(item?.reason) || null,
        next_step: text(item?.next_step) || null,
        source,
      };
    })
    .filter(Boolean);
}

function normalizeEffectivenessItems(summary = null) {
  const groups = [
    { key: "preserve_now", impact_status: "reinforced", recommended_action: "preserve" },
    { key: "rework_now", impact_status: "mixed", recommended_action: null },
    { key: "retire_now", impact_status: "contradicted", recommended_action: "retire" },
  ];

  return groups.flatMap((group) =>
    (Array.isArray(summary?.[group.key]) ? summary[group.key] : [])
      .map((item) => {
        const sectionKey = text(item?.section_key);
        const itemText = text(item?.text);
        const key = recommendationKey(sectionKey, itemText);
        if (!key || !itemText) return null;
        const explicitAction = normalizeAction(item?.action);
        return {
          key,
          section_key: sectionKey,
          section_label: text(item?.section_label) || SECTION_LABELS[sectionKey] || sectionKey,
          text: itemText,
          impact_status: group.impact_status,
          recommended_action: explicitAction || group.recommended_action,
          is_high_priority: lower(item?.priority) === "high",
          reason: text(item?.action_reason || item?.reason) || "Historical recommendation impact was inferred from saved recommendation effectiveness.",
          next_step: null,
          source: "effectiveness_fallback",
        };
      })
      .filter(Boolean),
  );
}

function observationsForRevision(revision, overrides = {}) {
  const snapshot = objectValue(revision?.quality_snapshot_json) || {};
  const impactItems = normalizeImpactItems(overrides.recommendationImpact || snapshot.recommendation_impact, "impact");
  if (impactItems.length > 0) return impactItems;
  return normalizeEffectivenessItems(overrides.recommendationEffectiveness || snapshot.recommendation_effectiveness);
}

function distinctStatuses(values = []) {
  return [...new Set((Array.isArray(values) ? values : []).map((value) => normalizeImpactStatus(value)).filter(Boolean))];
}

function trendStatus(entry) {
  const currentStatus = entry.current_impact_status;
  const currentAction = entry.current_recommended_action;
  const hasReinforced = entry.reinforced_count > 0;
  const hasMixed = entry.mixed_count > 0;
  const hasContradicted = entry.contradicted_count > 0;
  const distinct = distinctStatuses(entry.statuses_seen);

  if (
    currentStatus === "contradicted"
    || currentAction === "retire"
    || entry.contradicted_count >= 2
    || (currentStatus === "mixed" && entry.contradicted_count > 0 && entry.reinforced_count === 0)
  ) {
    return "deteriorating";
  }

  if (
    (currentStatus === "reinforced" || currentAction === "preserve")
    && (entry.mixed_count > 0 || entry.contradicted_count > 0)
  ) {
    return "improving";
  }

  if (
    (currentStatus === "reinforced" || currentAction === "preserve")
    && entry.reinforced_count >= 2
    && entry.mixed_count === 0
    && entry.contradicted_count === 0
  ) {
    return "stable";
  }

  if (distinct.length >= 2 || entry.status_switch_count >= 2 || (hasReinforced && hasMixed) || (hasMixed && hasContradicted)) {
    return "volatile";
  }

  if (entry.appearance_count === 1 && currentStatus === "reinforced") return "limited";
  if (!currentStatus && currentAction === "preserve") return "limited";
  return "limited";
}

function scoreFor(entry, status) {
  const base =
    status === "deteriorating" ? 92
      : status === "volatile" ? 80
        : status === "improving" ? 68
          : status === "stable" ? 56
            : 36;
  return Math.max(0, Math.min(100, base + (entry.is_high_priority ? 8 : 0) + (entry.appearance_count * 2)));
}

function reasonFor(entry, status) {
  if (status === "deteriorating") {
    return entry.current_reason
      || "This recommendation is now degrading across versions and should not be carried forward unchanged.";
  }
  if (status === "volatile") {
    return entry.current_reason
      || "This recommendation has not settled across saved versions, so it still needs a tighter proof loop.";
  }
  if (status === "improving") {
    return entry.current_reason
      || "This recommendation has recovered from earlier pressure and is landing better in the latest version.";
  }
  if (status === "stable") {
    return entry.current_reason
      || "This recommendation has stayed reinforced across multiple saved versions.";
  }
  return entry.current_reason
    || "Cross-version recommendation memory is still thin here, so the next version should stay evidence-conservative.";
}

function nextStepFor(entry, status) {
  if (status === "deteriorating") {
    return "Replace this recommendation or add a stricter fallback before it appears again.";
  }
  if (status === "volatile") {
    return "Tighten the wording, ownership, or verification step instead of assuming this recommendation has settled.";
  }
  if (status === "improving") {
    return "Keep the stronger version, but verify the next cycle before treating it as a stable default.";
  }
  if (status === "stable") {
    return "Protect this wording unless fresher evidence clearly overturns it.";
  }
  return "Use this cautiously until another saved version confirms whether it is truly helping.";
}

export function buildHealthPlanRecommendationHistory({
  history = [],
  recommendationImpact = null,
  recommendationEffectiveness = null,
} = {}) {
  const revisions = normalizeRevisions(history);
  if (!revisions.length) {
    return {
      overall_status: "limited",
      summary: "No cross-version recommendation history is available yet.",
      improving_count: 0,
      stable_count: 0,
      deteriorating_count: 0,
      volatile_count: 0,
      limited_count: 0,
      repeated_contradiction_count: 0,
      high_priority_deteriorating_count: 0,
      items: [],
    };
  }

  const entries = new Map();

  revisions.forEach((revision, index) => {
    const version = normalizeVersion(revision?.version_number);
    const observations = observationsForRevision(revision, index === 0
      ? { recommendationImpact, recommendationEffectiveness }
      : {});
    const perRevisionSeen = new Set();

    for (const observation of observations) {
      if (!observation?.key || perRevisionSeen.has(observation.key)) continue;
      perRevisionSeen.add(observation.key);

      if (!entries.has(observation.key)) {
        entries.set(observation.key, {
          item_key: observation.key,
          section_key: observation.section_key,
          section_label: observation.section_label,
          text: observation.text,
          first_seen_version: version,
          latest_seen_version: version,
          appearance_count: 0,
          observations: [],
          statuses_seen: [],
          reinforced_count: 0,
          mixed_count: 0,
          contradicted_count: 0,
          limited_count: 0,
          versions_with_reinforcement: [],
          versions_with_mixed: [],
          versions_with_contradiction: [],
          versions_with_limited: [],
          current_impact_status: null,
          current_recommended_action: null,
          current_reason: null,
          current_next_step: null,
          is_high_priority: false,
          sources: [],
        });
      }

      const entry = entries.get(observation.key);
      entry.appearance_count += 1;
      entry.first_seen_version = Math.min(entry.first_seen_version, version);
      entry.latest_seen_version = Math.max(entry.latest_seen_version, version);
      entry.statuses_seen.push(observation.impact_status || "limited");
      entry.sources.push(observation.source);
      entry.is_high_priority = entry.is_high_priority || observation.is_high_priority;
      entry.observations.push({
        version_number: version,
        impact_status: observation.impact_status || "limited",
        recommended_action: observation.recommended_action || null,
        reason: observation.reason,
        next_step: observation.next_step,
        source: observation.source,
      });

      if (observation.impact_status === "reinforced") {
        entry.reinforced_count += 1;
        entry.versions_with_reinforcement.push(version);
      } else if (observation.impact_status === "mixed") {
        entry.mixed_count += 1;
        entry.versions_with_mixed.push(version);
      } else if (observation.impact_status === "contradicted") {
        entry.contradicted_count += 1;
        entry.versions_with_contradiction.push(version);
      } else {
        entry.limited_count += 1;
        entry.versions_with_limited.push(version);
      }

      if (version === entry.latest_seen_version) {
        entry.current_impact_status = observation.impact_status || "limited";
        entry.current_recommended_action = observation.recommended_action || null;
        entry.current_reason = observation.reason || entry.current_reason;
        entry.current_next_step = observation.next_step || entry.current_next_step;
      }
    }
  });

  const items = [...entries.values()]
    .map((entry) => {
      const ordered = [...entry.observations].sort((left, right) => right.version_number - left.version_number);
      const statuses = ordered.map((item) => item.impact_status || "limited");
      const statusSwitchCount = statuses.reduce((count, status, index) => (
        index > 0 && status !== statuses[index - 1] ? count + 1 : count
      ), 0);
      const trend = trendStatus({
        ...entry,
        status_switch_count: statusSwitchCount,
      });

      return {
        item_key: entry.item_key,
        section_key: entry.section_key,
        section_label: entry.section_label,
        text: entry.text,
        first_seen_version: entry.first_seen_version,
        latest_seen_version: entry.latest_seen_version,
        appearance_count: entry.appearance_count,
        current_impact_status: entry.current_impact_status,
        current_recommended_action: entry.current_recommended_action,
        trend_status: trend,
        versions_with_reinforcement: [...new Set(entry.versions_with_reinforcement)].sort((left, right) => right - left),
        versions_with_mixed: [...new Set(entry.versions_with_mixed)].sort((left, right) => right - left),
        versions_with_contradiction: [...new Set(entry.versions_with_contradiction)].sort((left, right) => right - left),
        versions_with_limited: [...new Set(entry.versions_with_limited)].sort((left, right) => right - left),
        is_high_priority: entry.is_high_priority,
        reason: reasonFor(entry, trend),
        next_step: entry.current_next_step || nextStepFor(entry, trend),
        score: scoreFor(entry, trend),
      };
    })
    .sort((left, right) => right.score - left.score);

  const improvingCount = items.filter((item) => item.trend_status === "improving").length;
  const stableCount = items.filter((item) => item.trend_status === "stable").length;
  const deterioratingCount = items.filter((item) => item.trend_status === "deteriorating").length;
  const volatileCount = items.filter((item) => item.trend_status === "volatile").length;
  const limitedCount = items.filter((item) => item.trend_status === "limited").length;
  const repeatedContradictionCount = items.filter((item) => item.versions_with_contradiction.length >= 2).length;
  const highPriorityDeterioratingCount = items.filter((item) => item.trend_status === "deteriorating" && item.is_high_priority).length;

  const overallStatus =
    deterioratingCount > 0 ? "deteriorating"
      : volatileCount > 0 ? "mixed"
        : (improvingCount + stableCount) > 0 ? "supportive"
          : "limited";

  const summary =
    overallStatus === "deteriorating"
      ? `${deterioratingCount} recommendation${deterioratingCount === 1 ? "" : "s"} is degrading across saved versions, so the next plan should replace or tighten it instead of quietly carrying it forward.`
      : overallStatus === "mixed"
        ? `${volatileCount} recommendation${volatileCount === 1 ? "" : "s"} is still volatile across saved versions and needs a tighter proof loop before it is treated as settled.`
        : overallStatus === "supportive"
          ? `${improvingCount + stableCount} recommendation${improvingCount + stableCount === 1 ? "" : "s"} has cross-version support and is worth protecting unless fresher evidence overturns it.`
          : "Cross-version recommendation history is still thin, so the next plan should lean more on current evidence than on saved pattern memory.";

  return {
    overall_status: overallStatus,
    summary,
    improving_count: improvingCount,
    stable_count: stableCount,
    deteriorating_count: deterioratingCount,
    volatile_count: volatileCount,
    limited_count: limitedCount,
    repeated_contradiction_count: repeatedContradictionCount,
    high_priority_deteriorating_count: highPriorityDeterioratingCount,
    items: items.slice(0, 8),
  };
}
