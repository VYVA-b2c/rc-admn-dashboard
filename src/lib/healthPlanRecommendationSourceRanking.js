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

function objectValue(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function authorityWeight(level) {
  if (level === "highest") return 28;
  if (level === "high") return 22;
  if (level === "medium") return 14;
  return 6;
}

function strengthWeight(value) {
  if (value === "high") return 7;
  if (value === "medium") return 4;
  return 1;
}

function defaultAuthority(signal = null) {
  const category = lower(signal?.category);
  if (category === "alert") return { authority_level: "high", priority_score: 88, source_type: "live_alerts", reason: "Live alerts should outweigh calmer background context." };
  if (category === "sensor") return { authority_level: "high", priority_score: 82, source_type: "live_sensors", reason: "Sensor state is part of the live operational picture." };
  if (category === "medication") return { authority_level: "medium", priority_score: 72, source_type: "live_medication", reason: "Medication structure matters, but still needs live confirmation." };
  if (category === "service") return { authority_level: "medium", priority_score: 66, source_type: "service_state", reason: "Service state helps, but staff still need to verify whether the routine actually landed." };
  if (category === "risk") return { authority_level: "medium", priority_score: 68, source_type: "predictive", reason: "Predictive signals help planning, but they should sit behind fresher live evidence." };
  return { authority_level: "supporting", priority_score: 44, source_type: category || "context", reason: "This is useful context, but it should not dominate urgent guidance alone." };
}

function evidenceQuality(ranked = []) {
  const strongCount = ranked.filter((item) => ["highest", "high"].includes(text(item?.authority_level))).length;
  const mediumCount = ranked.filter((item) => ["highest", "high", "medium"].includes(text(item?.authority_level))).length;
  if (strongCount >= 1 && mediumCount >= 2) return "strong";
  if (mediumCount >= 1) return "mixed";
  return "thin";
}

function itemKey(sectionKey, item, index) {
  return text(item?.id) || `${sectionKey}-${index + 1}`;
}

function challengeLookup(summary = null) {
  return new Map(
    (Array.isArray(summary?.items) ? summary.items : [])
      .map((item) => {
        const key = `${text(item?.section_key)}:${text(item?.item_id)}`;
        if (!text(item?.section_key) || !text(item?.item_id)) return null;
        return [key, item];
      })
      .filter(Boolean),
  );
}

export function buildHealthPlanRecommendationSourceRanking({
  plan = null,
  sourceSignals = [],
  evidenceHierarchy = [],
  signalPreferenceWeights = [],
  recommendationEffectiveness = null,
  recommendationChallenges = null,
} = {}) {
  const normalizedPlan = objectValue(plan);
  if (!normalizedPlan) return null;

  const signalLookup = new Map(
    (Array.isArray(sourceSignals) ? sourceSignals : [])
      .map((signal) => {
        const id = text(signal?.id);
        if (!id) return null;
        return [id, signal];
      })
      .filter(Boolean),
  );
  const hierarchyLookup = new Map(
    (Array.isArray(evidenceHierarchy) ? evidenceHierarchy : [])
      .map((item) => {
        const id = text(item?.id);
        if (!id || id.startsWith("feedback:")) return null;
        return [id, item];
      })
      .filter(Boolean),
  );
  const preferenceLookup = new Map(
    (Array.isArray(signalPreferenceWeights) ? signalPreferenceWeights : [])
      .map((item) => [text(item?.signal_id), item])
      .filter(([id]) => id),
  );
  const preserveSignalIds = new Set(unique(recommendationEffectiveness?.preserve_signal_ids));
  const avoidSignalIds = new Set(unique(recommendationEffectiveness?.avoid_signal_ids));
  const challenges = challengeLookup(recommendationChallenges);

  const items = [];
  for (const sectionKey of SECTION_KEYS) {
    const sectionItems = Array.isArray(normalizedPlan?.[sectionKey]) ? normalizedPlan[sectionKey] : [];
    sectionItems.forEach((item, index) => {
      const currentItemId = itemKey(sectionKey, item, index);
      const currentChallenge = challenges.get(`${sectionKey}:${currentItemId}`) || null;
      const rankedSources = unique(item?.source_signal_ids)
        .map((signalId) => {
          const signal = signalLookup.get(signalId);
          if (!signal) return null;
          const hierarchy = hierarchyLookup.get(signalId) || defaultAuthority(signal);
          const preference = preferenceLookup.get(signalId) || null;
          const boost = preserveSignalIds.has(signalId) ? 5 : 0;
          const penalty = avoidSignalIds.has(signalId) ? 6 : 0;
          const score = Number(hierarchy?.priority_score || 0)
            + authorityWeight(text(hierarchy?.authority_level))
            + strengthWeight(lower(signal?.strength))
            + (Number(preference?.weight || 0) * 4)
            + boost
            - penalty;
          return {
            signal_id: signalId,
            label: text(signal?.label) || signalId,
            authority_level: text(hierarchy?.authority_level) || "supporting",
            source_type: text(hierarchy?.source_type) || lower(signal?.category) || "context",
            strength: lower(signal?.strength) || "medium",
            preference: text(preference?.preference) || "observe",
            score,
            reason: text(hierarchy?.reason) || null,
          };
        })
        .filter(Boolean)
        .sort((left, right) => Number(right.score || 0) - Number(left.score || 0));

      items.push({
        item_id: currentItemId,
        section_key: sectionKey,
        text: text(item?.text) || null,
        priority: text(item?.priority) || null,
        confidence: text(item?.confidence) || null,
        timing: text(item?.timing) || null,
        challenge_status: text(currentChallenge?.challenge_status) || null,
        evidence_quality: evidenceQuality(rankedSources),
        ranked_sources: rankedSources.slice(0, 4),
        top_summary: rankedSources[0]
          ? `${rankedSources[0].label} is currently the strongest signal behind this recommendation.`
          : "No ranked source summary is available.",
      });
    });
  }

  return {
    items,
  };
}

export function findHealthPlanRecommendationSourceRankingIssues(plan, ranking = null) {
  const summary = objectValue(ranking);
  if (!plan || !summary) return [];

  const issues = [];
  for (const item of Array.isArray(summary.items) ? summary.items : []) {
    const top = Array.isArray(item?.ranked_sources) ? item.ranked_sources[0] : null;
    const evidenceLevel = text(item?.evidence_quality);
    const highPressure = text(item?.timing) === "today" || text(item?.priority) === "high";
    const highConfidence = text(item?.confidence) === "high";
    const challenged = text(item?.challenge_status) === "challenged";

    if (highConfidence && !["highest", "high", "medium"].includes(text(top?.authority_level))) {
      issues.push({
        type: "high_confidence_weak_source",
        section_key: text(item?.section_key) || null,
        severity: "high",
        message: `Health plan generation marked a recommendation as high confidence without a strong enough ranked source: "${text(item?.text)}".`,
      });
    }
    if (highPressure && evidenceLevel === "thin") {
      issues.push({
        type: "urgent_recommendation_thin_evidence",
        section_key: text(item?.section_key) || null,
        severity: challenged ? "high" : "medium",
        message: `Health plan generation pushed urgent guidance without enough ranked evidence behind it: "${text(item?.text)}".`,
      });
    }
  }

  return issues;
}
