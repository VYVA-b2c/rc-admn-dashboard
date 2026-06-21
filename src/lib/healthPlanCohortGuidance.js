function text(value) {
  return String(value || "").trim();
}

function lower(value) {
  return text(value).toLowerCase();
}

function unique(values) {
  return [...new Set((Array.isArray(values) ? values : []).map((value) => text(value)).filter(Boolean))];
}

function normalizedTags(values) {
  return unique(values).map((value) => lower(value)).filter(Boolean);
}

function objectValue(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function toDateValue(value) {
  if (!value) return 0;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function categoryLabel(category, labels = []) {
  const explicit = text(Array.isArray(labels) ? labels[0] : "");
  if (explicit) return explicit;
  if (category === "service") return "service-supported routines";
  if (category === "medication") return "medication routines";
  if (category === "care-circle") return "caregiver reinforcement";
  if (category === "alert") return "alert response routines";
  if (category === "risk") return "risk-driven follow-up";
  if (category === "sensor") return "sensor-backed monitoring";
  if (category === "context") return "context-fit routines";
  return text(category) || "similar routines";
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

function categoriesFromText(value) {
  const haystack = lower(value);
  const categories = new Set();
  if (/\bmedication|reminder|dose|pill|adherence\b/.test(haystack)) categories.add("medication");
  if (/\bcheck-in|check in|brain coach|routine|follow-up|outreach|touchpoint\b/.test(haystack)) categories.add("service");
  if (/\bcaregiver|family|care circle|provider\b/.test(haystack)) categories.add("care-circle");
  if (/\balert|urgent|reach|unreachable|escalat|same-day\b/.test(haystack)) categories.add("alert");
  if (/\brisk|forecast|decline\b/.test(haystack)) categories.add("risk");
  if (/\bsensor|device|battery|fall|monitor\b/.test(haystack)) categories.add("sensor");
  if (/\bliving|language|context|city\b/.test(haystack)) categories.add("context");
  return [...categories];
}

function categoryToSections(category) {
  if (category === "medication") return ["daily_support_json", "monitoring_json", "escalation_json"];
  if (category === "service") return ["goals_json", "daily_support_json", "monitoring_json", "caregiver_guidance_json"];
  if (category === "care-circle") return ["daily_support_json", "caregiver_guidance_json", "escalation_json"];
  if (category === "alert") return ["monitoring_json", "escalation_json", "goals_json"];
  if (category === "risk") return ["goals_json", "monitoring_json", "escalation_json"];
  if (category === "sensor") return ["monitoring_json", "escalation_json"];
  return ["goals_json", "daily_support_json", "caregiver_guidance_json"];
}

function normalizeProfile(profile = null) {
  const value = objectValue(profile) || {};
  return {
    language: lower(value.language || value.preferred_language),
    living_context: lower(value.living_context),
    health_conditions: normalizedTags(value.health_conditions),
    mobility_needs: normalizedTags(value.mobility_needs),
  };
}

function normalizePeer(peer = {}) {
  const snapshot = objectValue(peer?.quality_snapshot_json) || {};
  return {
    user_id: text(peer?.vyva_user_id || peer?.user_id) || null,
    language: lower(peer?.language || peer?.user_language),
    living_context: lower(peer?.living_context),
    health_conditions: normalizedTags(peer?.health_conditions),
    mobility_needs: normalizedTags(peer?.mobility_needs),
    reviewed_at: text(peer?.reviewed_at) || null,
    generated_at: text(peer?.generated_at) || null,
    source_signals_json: Array.isArray(peer?.source_signals_json) ? peer.source_signals_json : [],
    recommendation_learning_json: Array.isArray(peer?.recommendation_learning_json) ? peer.recommendation_learning_json : [],
    client_response_memory: objectValue(snapshot.client_response_memory),
    recommendation_effectiveness: objectValue(snapshot.recommendation_effectiveness),
  };
}

function overlapCount(leftValues = [], rightValues = []) {
  const left = new Set(normalizedTags(leftValues));
  const right = new Set(normalizedTags(rightValues));
  let count = 0;
  for (const item of left) {
    if (right.has(item)) count += 1;
  }
  return count;
}

function buildSimilarity(profile, peer) {
  const reasons = [];
  let score = 0;
  if (profile.language && peer.language && profile.language === peer.language) {
    score += 2;
    reasons.push("same language");
  }
  if (profile.living_context && peer.living_context && profile.living_context === peer.living_context) {
    score += 2;
    reasons.push("same living context");
  }
  const healthOverlap = overlapCount(profile.health_conditions, peer.health_conditions);
  if (healthOverlap > 0) {
    score += Math.min(healthOverlap, 2) * 2;
    reasons.push(healthOverlap === 1 ? "1 overlapping health condition" : `${healthOverlap} overlapping health conditions`);
  }
  const mobilityOverlap = overlapCount(profile.mobility_needs, peer.mobility_needs);
  if (mobilityOverlap > 0) {
    score += Math.min(mobilityOverlap, 2);
    reasons.push(mobilityOverlap === 1 ? "1 overlapping mobility need" : `${mobilityOverlap} overlapping mobility needs`);
  }
  return {
    score,
    reasons,
  };
}

function ensureAggregate(map, category) {
  const key = text(category) || "context";
  if (!map.has(key)) {
    map.set(key, {
      category: key,
      support_score: 0,
      caution_score: 0,
      support_peers: new Set(),
      caution_peers: new Set(),
      labels: new Set(),
    });
  }
  return map.get(key);
}

function addPattern(map, category, {
  label = null,
  peerId = null,
  support = 0,
  caution = 0,
} = {}) {
  const entry = ensureAggregate(map, category);
  entry.support_score += Number(support || 0);
  entry.caution_score += Number(caution || 0);
  if (peerId && support > 0) entry.support_peers.add(peerId);
  if (peerId && caution > 0) entry.caution_peers.add(peerId);
  if (label) entry.labels.add(label);
}

function addCategoriesFromSignals(map, categories = [], peerId, label, mode) {
  for (const category of categories.length ? categories : ["context"]) {
    addPattern(map, category, {
      label,
      peerId,
      support: mode === "support" ? 1 : 0,
      caution: mode === "caution" ? 1 : 0,
    });
  }
}

function extractPeerPatterns(peer, aggregate) {
  const peerId = peer.user_id || `peer-${Math.random().toString(36).slice(2)}`;
  const strongestAnchors = Array.isArray(peer?.client_response_memory?.strongest_anchors) ? peer.client_response_memory.strongest_anchors : [];
  const fragileAnchors = Array.isArray(peer?.client_response_memory?.fragile_anchors) ? peer.client_response_memory.fragile_anchors : [];
  const preserveNow = Array.isArray(peer?.recommendation_effectiveness?.preserve_now) ? peer.recommendation_effectiveness.preserve_now : [];
  const reworkNow = Array.isArray(peer?.recommendation_effectiveness?.rework_now) ? peer.recommendation_effectiveness.rework_now : [];
  const retireNow = Array.isArray(peer?.recommendation_effectiveness?.retire_now) ? peer.recommendation_effectiveness.retire_now : [];

  for (const anchor of strongestAnchors) {
    addPattern(aggregate, anchor?.category, {
      label: categoryLabel(anchor?.category, anchor?.labels),
      peerId,
      support: 2,
    });
  }
  for (const anchor of fragileAnchors) {
    addPattern(aggregate, anchor?.category, {
      label: categoryLabel(anchor?.category, anchor?.labels),
      peerId,
      caution: 2,
    });
  }

  for (const item of preserveNow) {
    const categories = unique(item?.source_signal_ids).map((signalId) => categoryFromSignalId(signalId, peer.source_signals_json));
    addCategoriesFromSignals(
      aggregate,
      categories.length ? categories : categoriesFromText(item?.text),
      peerId,
      text(item?.text) || categoryLabel(categories[0]),
      "support",
    );
  }
  for (const item of [...reworkNow, ...retireNow]) {
    const categories = unique(item?.source_signal_ids).map((signalId) => categoryFromSignalId(signalId, peer.source_signals_json));
    addCategoriesFromSignals(
      aggregate,
      categories.length ? categories : categoriesFromText(item?.text),
      peerId,
      text(item?.text) || categoryLabel(categories[0]),
      "caution",
    );
  }

  if (strongestAnchors.length || fragileAnchors.length || preserveNow.length || reworkNow.length || retireNow.length) return;

  for (const item of peer.recommendation_learning_json) {
    const categories = unique(item?.source_signal_ids).map((signalId) => categoryFromSignalId(signalId, peer.source_signals_json));
    const action = lower(item?.latest_recommended_next_action || item?.reuse_priority);
    const status = lower(item?.status);
    const label = text(item?.section_label) || text(item?.text);
    const mode =
      ["preserve", "helping"].includes(action) || status === "helping"
        ? "support"
        : ["replace", "retire", "rework", "verify", "fragile", "unproven"].includes(action) || ["fragile", "unproven"].includes(status)
          ? "caution"
          : null;
    if (!mode) continue;
    addCategoriesFromSignals(
      aggregate,
      categories.length ? categories : categoriesFromText(item?.text),
      peerId,
      label,
      mode,
    );
  }
}

function clientHistoryStrength(clientResponseMemory = null, recommendationEffectiveness = null) {
  const strongAnchors = Array.isArray(clientResponseMemory?.strongest_anchors) ? clientResponseMemory.strongest_anchors.length : 0;
  const fragileAnchors = Array.isArray(clientResponseMemory?.fragile_anchors) ? clientResponseMemory.fragile_anchors.length : 0;
  const preserve = Array.isArray(recommendationEffectiveness?.preserve_now) ? recommendationEffectiveness.preserve_now.length : 0;
  const rework = Array.isArray(recommendationEffectiveness?.rework_now) ? recommendationEffectiveness.rework_now.length : 0;
  const retire = Array.isArray(recommendationEffectiveness?.retire_now) ? recommendationEffectiveness.retire_now.length : 0;
  const total = strongAnchors + fragileAnchors + preserve + rework + retire;
  if (total >= 5) return "strong";
  if (total >= 2) return "moderate";
  return "thin";
}

function supportEntry(entry) {
  return {
    category: entry.category,
    labels: unique([...entry.labels]).slice(0, 3),
    matched_peer_count: entry.support_peers.size,
    support_score: entry.support_score,
    note: `${entry.support_peers.size} similar case${entry.support_peers.size === 1 ? "" : "s"} reinforced this pattern.`,
  };
}

function cautionEntry(entry) {
  return {
    category: entry.category,
    labels: unique([...entry.labels]).slice(0, 3),
    matched_peer_count: entry.caution_peers.size,
    caution_score: entry.caution_score,
    note: `${entry.caution_peers.size} similar case${entry.caution_peers.size === 1 ? "" : "s"} needed more caution here.`,
  };
}

function sortByConfidence(left, right) {
  const leftPeers = Math.max(left.matched_peer_count || 0, 0);
  const rightPeers = Math.max(right.matched_peer_count || 0, 0);
  if (rightPeers !== leftPeers) return rightPeers - leftPeers;
  return Number((right.support_score || right.caution_score || 0)) - Number((left.support_score || left.caution_score || 0));
}

function buildSectionGuidance(strongPeerAnchors = [], fragilePeerAnchors = []) {
  const sectionMap = new Map();
  for (const anchor of strongPeerAnchors) {
    for (const sectionKey of categoryToSections(anchor.category)) {
      if (!sectionMap.has(sectionKey)) sectionMap.set(sectionKey, { section_key: sectionKey, reinforce: [], avoid: [] });
      sectionMap.get(sectionKey).reinforce.push(
        `If the client's own history is thin or mixed, similar same-organization cases responded better when ${categoryLabel(anchor.category, anchor.labels)} stayed concrete and supported.`,
      );
    }
  }
  for (const anchor of fragilePeerAnchors) {
    for (const sectionKey of categoryToSections(anchor.category)) {
      if (!sectionMap.has(sectionKey)) sectionMap.set(sectionKey, { section_key: sectionKey, reinforce: [], avoid: [] });
      sectionMap.get(sectionKey).avoid.push(
        `If the client's own history is thin or mixed, similar same-organization cases needed tighter verification or backup around ${categoryLabel(anchor.category, anchor.labels)}.`,
      );
    }
  }
  return [...sectionMap.values()]
    .map((item) => ({
      ...item,
      reinforce: unique(item.reinforce).slice(0, 2),
      avoid: unique(item.avoid).slice(0, 2),
    }))
    .filter((item) => item.reinforce.length || item.avoid.length);
}

function buildSummary(strongPeerAnchors, fragilePeerAnchors, matchedPeerCount, usageMode) {
  const strong = strongPeerAnchors[0];
  const fragile = fragilePeerAnchors[0];
  const strongLabel = strong ? categoryLabel(strong.category, strong.labels) : null;
  const fragileLabel = fragile ? categoryLabel(fragile.category, fragile.labels) : null;
  const usageText =
    usageMode === "fallback_only"
      ? "Use this only as a tie-breaker behind fresher client-specific evidence."
      : usageMode === "supportive"
        ? "Use this only to sharpen areas where the client's own history is still mixed."
        : "Use this cautiously where the client's own history is still thin.";
  if (strongLabel && fragileLabel) {
    return `${matchedPeerCount} similar same-organization cases point toward ${strongLabel} as the stronger pattern, while ${fragileLabel} usually needs more verification or backup. ${usageText}`;
  }
  if (strongLabel) {
    return `${matchedPeerCount} similar same-organization cases suggest ${strongLabel} is more likely to hold up when the client's own history is still thin. ${usageText}`;
  }
  if (fragileLabel) {
    return `${matchedPeerCount} similar same-organization cases suggest ${fragileLabel} often needs tighter verification or fallback. ${usageText}`;
  }
  return `${matchedPeerCount} similar same-organization cases provide only light cohort guidance. ${usageText}`;
}

export function buildHealthPlanCohortGuidance({
  profile = null,
  peerPlans = [],
  clientResponseMemory = null,
  recommendationEffectiveness = null,
  minimumPeerCount = 2,
} = {}) {
  const normalizedProfile = normalizeProfile(profile);
  const clientStrength = clientHistoryStrength(clientResponseMemory, recommendationEffectiveness);
  const usageMode =
    clientStrength === "strong"
      ? "fallback_only"
      : clientStrength === "moderate"
        ? "supportive"
        : "augment";

  const matchedPeers = (Array.isArray(peerPlans) ? peerPlans : [])
    .map((item) => normalizePeer(item))
    .map((peer) => ({
      ...peer,
      similarity: buildSimilarity(normalizedProfile, peer),
      recency: Math.max(toDateValue(peer.reviewed_at), toDateValue(peer.generated_at)),
    }))
    .filter((peer) => peer.similarity.score >= 2 && peer.similarity.reasons.length > 0)
    .sort((left, right) => {
      if (right.similarity.score !== left.similarity.score) return right.similarity.score - left.similarity.score;
      return right.recency - left.recency;
    })
    .slice(0, 8);

  if (!matchedPeers.length) {
    return {
      overall_status: "none",
      usage_mode: usageMode,
      client_history_strength: clientStrength,
      matched_peer_count: 0,
      summary: "No similar same-organization cases are available yet, so the plan should rely only on client-specific evidence.",
      similarity_basis: [],
      strong_peer_anchors: [],
      fragile_peer_anchors: [],
      section_guidance: [],
      guardrails: [
        "Do not borrow routines from other clients when no similar same-organization peer evidence is available.",
      ],
    };
  }

  const aggregate = new Map();
  for (const peer of matchedPeers) {
    extractPeerPatterns(peer, aggregate);
  }

  const strongPeerAnchors = [...aggregate.values()]
    .filter((entry) => entry.support_peers.size >= minimumPeerCount && entry.support_score > entry.caution_score)
    .map(supportEntry)
    .sort(sortByConfidence)
    .slice(0, 4);

  const fragilePeerAnchors = [...aggregate.values()]
    .filter((entry) => entry.caution_peers.size >= minimumPeerCount && entry.caution_score >= entry.support_score)
    .map(cautionEntry)
    .sort(sortByConfidence)
    .slice(0, 4);

  const overallStatus =
    matchedPeers.length >= minimumPeerCount && (strongPeerAnchors.length || fragilePeerAnchors.length)
      ? matchedPeers.length >= 3
        ? "usable"
        : "limited"
      : "limited";

  const sectionGuidance = buildSectionGuidance(strongPeerAnchors, fragilePeerAnchors);
  const similarityBasis = unique(matchedPeers.flatMap((peer) => peer.similarity.reasons)).slice(0, 6);
  const summary = buildSummary(strongPeerAnchors, fragilePeerAnchors, matchedPeers.length, usageMode);
  const guardrails = unique([
    usageMode === "fallback_only"
      ? "Use cohort guidance only as a tie-breaker when this client's own recommendation history is mixed; never let it override fresher client-specific evidence."
      : usageMode === "supportive"
        ? "Use cohort guidance only to sharpen areas where this client's own history is still mixed; it should not replace direct client evidence."
        : "Client-specific history is still thin, so cautiously borrow from similar same-organization cases without treating those patterns as proof.",
    strongPeerAnchors[0]
      ? `When the record is thin or mixed, similar same-organization cases responded better to ${categoryLabel(strongPeerAnchors[0].category, strongPeerAnchors[0].labels)}.`
      : null,
    fragilePeerAnchors[0]
      ? `When the record is thin or mixed, similar same-organization cases usually needed tighter verification or backup around ${categoryLabel(fragilePeerAnchors[0].category, fragilePeerAnchors[0].labels)}.`
      : null,
  ]);

  return {
    overall_status: overallStatus,
    usage_mode: usageMode,
    client_history_strength: clientStrength,
    matched_peer_count: matchedPeers.length,
    summary,
    similarity_basis: similarityBasis,
    strong_peer_anchors: strongPeerAnchors,
    fragile_peer_anchors: fragilePeerAnchors,
    section_guidance: sectionGuidance,
    guardrails,
  };
}
