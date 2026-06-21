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

function objectValue(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function unique(values) {
  return [...new Set((Array.isArray(values) ? values : []).map((value) => text(value)).filter(Boolean))];
}

function sectionLabel(sectionKey) {
  return SECTION_LABELS[text(sectionKey)] || text(sectionKey) || "Section";
}

function normalizeTimestamp(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizeDecisionStatus(value) {
  const normalized = lower(value);
  if (["approved", "watch", "needs_edit"].includes(normalized)) return normalized;
  return null;
}

function severityRank(value) {
  const normalized = lower(value);
  if (normalized === "high") return 3;
  if (normalized === "medium") return 2;
  return 1;
}

function severityLabel(rank) {
  if (rank >= 3) return "high";
  if (rank === 2) return "medium";
  return "low";
}

function textMatchKey(sectionKey, recommendationText) {
  const normalizedSectionKey = text(sectionKey);
  const normalizedText = lower(recommendationText);
  if (!normalizedSectionKey || !normalizedText) return null;
  return `${normalizedSectionKey}:${normalizedText}`;
}

function idMatchKey(sectionKey, itemId) {
  const normalizedSectionKey = text(sectionKey);
  const normalizedItemId = text(itemId);
  if (!normalizedSectionKey || !normalizedItemId) return null;
  return `${normalizedSectionKey}#${normalizedItemId}`;
}

function buildPlanRecommendationCatalog(plan = null) {
  const normalizedPlan = objectValue(plan);
  if (!normalizedPlan) return { byId: new Map(), byText: new Map() };

  const byId = new Map();
  const byText = new Map();

  for (const [sectionKey, label] of Object.entries(SECTION_LABELS)) {
    const items = Array.isArray(normalizedPlan?.[sectionKey]) ? normalizedPlan[sectionKey] : [];
    items.forEach((item, index) => {
      const currentItemId = text(item?.id) || `${sectionKey}-${index + 1}`;
      const recommendationText = text(item?.text);
      const record = {
        item_id: currentItemId,
        section_key: sectionKey,
        section_label: label,
        text: recommendationText || null,
        priority: lower(item?.priority) || null,
        confidence: lower(item?.confidence) || null,
        timing: lower(item?.timing) || null,
      };
      const lookupById = idMatchKey(sectionKey, currentItemId);
      const lookupByText = textMatchKey(sectionKey, recommendationText);
      if (lookupById) byId.set(lookupById, record);
      if (lookupByText) byText.set(lookupByText, record);
    });
  }

  return { byId, byText };
}

function normalizeDecisionRecord(item) {
  const sectionKey = text(item?.section_key);
  const itemId = text(item?.item_id) || null;
  const recommendationText = text(item?.text) || null;
  const itemKey = text(item?.item_key) || textMatchKey(sectionKey, recommendationText);
  const matchKey = idMatchKey(sectionKey, itemId) || itemKey;
  if (!matchKey) return null;

  return {
    item_key: itemKey || null,
    item_id: itemId,
    section_key: sectionKey || null,
    section_label: text(item?.section_label) || (sectionKey ? sectionLabel(sectionKey) : null),
    text: recommendationText,
    decision_status: normalizeDecisionStatus(item?.decision_status),
    rationale: text(item?.rationale) || null,
    updated_at: normalizeTimestamp(item?.updated_at),
    updated_by_user_id: text(item?.updated_by_user_id) || null,
    updated_by_email: text(item?.updated_by_email) || null,
    match_key: matchKey,
  };
}

export function normalizeHealthPlanRecommendationReviewDecisions(value) {
  const decisions = Array.isArray(value) ? value : [];
  const deduped = new Map();

  for (const rawItem of decisions) {
    const record = normalizeDecisionRecord(rawItem);
    if (!record) continue;
    deduped.set(record.match_key, record);
  }

  return [...deduped.values()];
}

function normalizeConcern(source, rawItem, options = {}) {
  const sectionKey = text(rawItem?.section_key);
  const recommendationText = text(rawItem?.text);
  const itemId = text(rawItem?.item_id) || null;
  const itemKey = text(rawItem?.item_key) || textMatchKey(sectionKey, recommendationText);
  if (!sectionKey || (!itemId && !recommendationText && !itemKey)) return null;

  return {
    source,
    section_key: sectionKey,
    section_label: text(rawItem?.section_label) || sectionLabel(sectionKey),
    item_id: itemId,
    item_key: itemKey,
    text: recommendationText || null,
    concern_status: text(options.concern_status) || null,
    severity: text(options.severity) || "medium",
    label: text(options.label) || null,
    detail: text(options.detail) || null,
  };
}

function pushConcern(target, concern) {
  if (!concern) return;
  const dedupeKey = [concern.source, concern.concern_status, concern.label, concern.detail].join("|");
  if (target._concernKeys.has(dedupeKey)) return;
  target._concernKeys.add(dedupeKey);
  target.concerns.push({
    source: concern.source,
    concern_status: concern.concern_status,
    severity: concern.severity,
    label: concern.label,
    detail: concern.detail,
  });
  target.concern_sources = unique([...target.concern_sources, concern.source]);
  target.concern_severity_rank = Math.max(target.concern_severity_rank, severityRank(concern.severity));
  if (concern.label) {
    target.concern_labels = unique([...target.concern_labels, concern.label]);
  }
}

function catalogRecordFor(concern, catalog) {
  const byId = catalog?.byId || new Map();
  const byText = catalog?.byText || new Map();
  return (
    byId.get(idMatchKey(concern.section_key, concern.item_id))
    || byText.get(concern.item_key)
    || null
  );
}

function ensureEntry(map, concern, catalog) {
  const catalogRecord = catalogRecordFor(concern, catalog);
  const sectionKey = catalogRecord?.section_key || concern.section_key;
  const itemId = catalogRecord?.item_id || concern.item_id || null;
  const recommendationText = catalogRecord?.text || concern.text || null;
  const itemKey = textMatchKey(sectionKey, recommendationText) || concern.item_key || null;
  const matchKey = idMatchKey(sectionKey, itemId) || itemKey;
  if (!matchKey) return null;

  if (!map.has(matchKey)) {
    map.set(matchKey, {
      match_key: matchKey,
      item_key: itemKey,
      item_id: itemId,
      section_key: sectionKey,
      section_label: catalogRecord?.section_label || concern.section_label || sectionLabel(sectionKey),
      text: recommendationText,
      priority: catalogRecord?.priority || null,
      confidence: catalogRecord?.confidence || null,
      timing: catalogRecord?.timing || null,
      concerns: [],
      concern_labels: [],
      concern_sources: [],
      concern_severity_rank: 1,
      _concernKeys: new Set(),
    });
  }

  return map.get(matchKey);
}

function concernItemsFromInputs({
  recommendationImpact = null,
  recommendationHistory = null,
  recommendationEvidenceDiversity = null,
  recommendationGrounding = null,
  recommendationChallenges = null,
} = {}) {
  const concerns = [];

  for (const item of Array.isArray(recommendationImpact?.items) ? recommendationImpact.items : []) {
    const impactStatus = lower(item?.impact_status);
    if (!["contradicted", "mixed"].includes(impactStatus)) continue;
    concerns.push(normalizeConcern("recommendation_impact", item, {
      concern_status: impactStatus,
      severity: impactStatus === "contradicted" || item?.is_high_priority ? "high" : "medium",
      label: text(item?.reason) || recommendationImpact?.summary || "A live recommendation outcome still needs a human call.",
      detail: text(item?.next_step) || null,
    }));
  }

  for (const item of Array.isArray(recommendationHistory?.items) ? recommendationHistory.items : []) {
    const trendStatus = lower(item?.trend_status);
    if (!["deteriorating", "volatile"].includes(trendStatus)) continue;
    concerns.push(normalizeConcern("recommendation_history", item, {
      concern_status: trendStatus,
      severity: trendStatus === "deteriorating" || item?.is_high_priority ? "high" : "medium",
      label: text(item?.reason) || recommendationHistory?.summary || "Cross-version recommendation memory still looks unstable here.",
      detail: text(item?.next_step) || null,
    }));
  }

  for (const item of Array.isArray(recommendationEvidenceDiversity?.items) ? recommendationEvidenceDiversity.items : []) {
    const diversityStatus = lower(item?.diversity_status);
    if (!["fragile", "guarded"].includes(diversityStatus)) continue;
    concerns.push(normalizeConcern("recommendation_evidence_diversity", item, {
      concern_status: diversityStatus,
      severity: diversityStatus === "fragile" && (item?.high_pressure || item?.high_confidence) ? "high" : "medium",
      label: text(item?.reason) || recommendationEvidenceDiversity?.summary || "Evidence diversity is still too narrow for easy sign-off.",
      detail: text(item?.next_step) || null,
    }));
  }

  for (const item of Array.isArray(recommendationGrounding?.items) ? recommendationGrounding.items : []) {
    const groundingStatus = lower(item?.grounding_status);
    if (!["fragile", "guarded"].includes(groundingStatus)) continue;
    concerns.push(normalizeConcern("recommendation_grounding", item, {
      concern_status: groundingStatus,
      severity: groundingStatus === "fragile" ? "high" : "medium",
      label: text(item?.reason) || recommendationGrounding?.summary || "The recommendation wording is outrunning the evidence behind it.",
      detail: text(item?.next_step) || null,
    }));
  }

  for (const item of Array.isArray(recommendationChallenges?.items) ? recommendationChallenges.items : []) {
    const challengeStatus = lower(item?.challenge_status);
    if (!["challenged", "guarded"].includes(challengeStatus)) continue;
    concerns.push(normalizeConcern("recommendation_challenge", item, {
      concern_status: challengeStatus,
      severity: item?.high_risk || challengeStatus === "challenged" ? "high" : "medium",
      label: text(item?.why_it_is_questioned) || recommendationChallenges?.summary || "This recommendation still needs a stronger skeptical review pass.",
      detail: text(item?.safer_reframe) || null,
    }));
  }

  return concerns.filter(Boolean);
}

function blockingItem(entry, label, detail) {
  return {
    type: "recommendation_review",
    label,
    detail,
    section_keys: unique(entry?.section_key ? [entry.section_key] : []),
    severity: entry?.concern_severity_rank >= 3 ? "high" : "medium",
    priority: entry?.priority === "high" || entry?.timing === "today" ? "high" : "medium",
  };
}

function recommendationSummary(entry) {
  if (entry?.text) return entry.text;
  return `${entry?.section_label || "Recommendation"} recommendation`;
}

export function buildHealthPlanRecommendationReviewSummary({
  plan = null,
  recommendationImpact = null,
  recommendationHistory = null,
  recommendationEvidenceDiversity = null,
  recommendationGrounding = null,
  recommendationChallenges = null,
  recommendationReviewDecisions = [],
} = {}) {
  const concerns = concernItemsFromInputs({
    recommendationImpact,
    recommendationHistory,
    recommendationEvidenceDiversity,
    recommendationGrounding,
    recommendationChallenges,
  });
  const catalog = buildPlanRecommendationCatalog(plan);
  const entries = new Map();

  for (const concern of concerns) {
    const entry = ensureEntry(entries, concern, catalog);
    if (!entry) continue;
    pushConcern(entry, concern);
  }

  const normalizedDecisions = normalizeHealthPlanRecommendationReviewDecisions(recommendationReviewDecisions);
  const decisionLookup = new Map(normalizedDecisions.map((item) => [item.match_key, item]));

  const items = [...entries.values()]
    .map((entry) => {
      const decision =
        decisionLookup.get(idMatchKey(entry.section_key, entry.item_id))
        || decisionLookup.get(entry.item_key)
        || null;
      const decisionStatus = normalizeDecisionStatus(decision?.decision_status);
      const rationale = text(decision?.rationale) || null;
      const decisionComplete = Boolean(decisionStatus && rationale);
      return {
        item_key: entry.item_key,
        item_id: entry.item_id,
        section_key: entry.section_key,
        section_label: entry.section_label,
        text: entry.text,
        priority: entry.priority,
        confidence: entry.confidence,
        timing: entry.timing,
        concern_level: severityLabel(entry.concern_severity_rank),
        concern_sources: entry.concern_sources,
        concern_labels: entry.concern_labels,
        concerns: entry.concerns,
        decision_status: decisionStatus,
        rationale,
        updated_at: decision?.updated_at || null,
        updated_by_user_id: decision?.updated_by_user_id || null,
        updated_by_email: decision?.updated_by_email || null,
        decision_complete: decisionComplete,
        review_required: true,
      };
    })
    .sort((left, right) => severityRank(right.concern_level) - severityRank(left.concern_level));

  const approvedItems = items.filter((item) => item.decision_status === "approved" && item.decision_complete);
  const watchItems = items.filter((item) => item.decision_status === "watch" && item.decision_complete);
  const needsEditItems = items.filter((item) => item.decision_status === "needs_edit" && item.decision_complete);
  const missingItems = items.filter((item) => !item.decision_complete);

  const blockingItems = [
    ...missingItems.map((item) => blockingItem(
      item,
      `${item.section_label}: add a review decision`,
      `Choose approve, watch, or needs edit for "${recommendationSummary(item)}" and record a short rationale before sign-off.`,
    )),
    ...needsEditItems.map((item) => blockingItem(
      item,
      `${item.section_label}: rewrite requested`,
      item.rationale || `Staff marked "${recommendationSummary(item)}" for substantive rewrite before sign-off.`,
    )),
  ];

  const cautionItems = watchItems.map((item) => blockingItem(
    item,
    `${item.section_label}: keep under watch`,
    item.rationale || `Staff accepted "${recommendationSummary(item)}" only with continued follow-up.`,
  ));

  const overallStatus =
    blockingItems.length > 0
      ? "blocked"
      : cautionItems.length > 0
        ? "guarded"
        : "ready";
  const summary =
    items.length === 0
      ? "No flagged recommendations need explicit human sign-off right now."
      : overallStatus === "blocked"
        ? needsEditItems.length > 0
          ? "One or more flagged recommendations were marked for rewrite before this plan can be signed off."
          : "Flagged recommendations still need an explicit human decision before this plan can be signed off."
        : overallStatus === "guarded"
          ? "Flagged recommendations were reviewed, but some remain in watch status and should stay under deliberate follow-up."
          : "Flagged recommendations have explicit staff approval notes and no unresolved rewrite requests remain.";

  return {
    overall_status: overallStatus,
    summary,
    can_mark_reviewed: blockingItems.length === 0,
    item_count: items.length,
    required_count: items.length,
    approved_count: approvedItems.length,
    watch_count: watchItems.length,
    needs_edit_count: needsEditItems.length,
    missing_count: missingItems.length,
    items,
    blocking_items: blockingItems,
    caution_items: cautionItems,
  };
}

export function missingHealthPlanRecommendationReviewDecisions(summary) {
  const normalized = objectValue(summary);
  if (!normalized) return [];
  return (Array.isArray(normalized.items) ? normalized.items : []).filter((item) => item?.review_required && !item?.decision_complete);
}
