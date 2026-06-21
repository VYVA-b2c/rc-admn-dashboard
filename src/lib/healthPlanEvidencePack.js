function text(value) {
  return String(value || "").trim();
}

function lower(value) {
  return text(value).toLowerCase();
}

function unique(values) {
  return [...new Set((Array.isArray(values) ? values : []).map((value) => text(value)).filter(Boolean))];
}

function severityRank(value) {
  if (value === "high") return 3;
  if (value === "medium") return 2;
  return 1;
}

function priorityRank(value) {
  if (value === "high") return 3;
  if (value === "medium") return 2;
  return 1;
}

function normalizeSignal(signal) {
  if (!signal || typeof signal !== "object") return null;
  const id = text(signal.id);
  if (!id) return null;
  return {
    id,
    label: text(signal.label) || id,
    detail: text(signal.detail) || null,
    category: text(signal.category) || "context",
    strength: ["high", "medium", "low"].includes(lower(signal.strength)) ? lower(signal.strength) : "medium",
  };
}

function pushUniqueFact(list, next, keyFn = (item) => item?.signal_id || item?.id || item?.label) {
  const key = text(keyFn(next));
  if (!key) return;
  const existingIndex = list.findIndex((item) => text(keyFn(item)) === key);
  if (existingIndex === -1) {
    list.push(next);
    return;
  }
  const existing = list[existingIndex];
  if (priorityRank(next.priority) > priorityRank(existing.priority)) {
    existing.priority = next.priority;
  }
  if (severityRank(next.severity) > severityRank(existing.severity)) {
    existing.severity = next.severity;
  }
  existing.why_it_matters = existing.why_it_matters || next.why_it_matters;
  existing.detail = existing.detail || next.detail;
  existing.source_signal_ids = unique([...(existing.source_signal_ids || []), ...(next.source_signal_ids || [])]);
}

function signalFact(signal, priority, responseWindow, why) {
  return {
    signal_id: signal.id,
    label: signal.label,
    detail: signal.detail || null,
    category: signal.category,
    strength: signal.strength,
    priority,
    response_window: responseWindow,
    why_it_matters: why,
    source_signal_ids: [signal.id],
  };
}

export function buildHealthPlanEvidencePack({
  sourceSignals = [],
  signalTriage = null,
  criticalSignalIds = [],
  evidenceHierarchy = [],
  evidenceConflicts = [],
  escalationGrade = null,
  dataQualityGaps = [],
  followThrough = null,
  qualityMemory = null,
} = {}) {
  const signals = (Array.isArray(sourceSignals) ? sourceSignals : []).map(normalizeSignal).filter(Boolean);
  const signalById = new Map(signals.map((signal) => [signal.id, signal]));
  const hierarchyById = new Map(
    (Array.isArray(evidenceHierarchy) ? evidenceHierarchy : [])
      .map((item) => [text(item?.id), item])
      .filter(([id]) => id),
  );
  const triage = signalTriage || {};
  const mustAddressFacts = [];
  const verificationNeeds = [];
  const stabilizingFacts = [];

  const mustAddressIds = unique([
    ...criticalSignalIds,
    ...unique(triage?.action_signal_ids),
    ...unique(escalationGrade?.required_signal_ids),
  ]).filter((id) => signalById.has(id));

  for (const id of mustAddressIds) {
    const signal = signalById.get(id);
    const hierarchy = hierarchyById.get(id);
    if (!signal) continue;
    pushUniqueFact(mustAddressFacts, signalFact(
      signal,
      signal.strength === "high" ? "high" : "medium",
      unique(escalationGrade?.same_day_signal_ids).includes(id) ? "today" : (text(escalationGrade?.response_window) || "ongoing"),
      text(hierarchy?.reason) || "This is one of the strongest live facts in the current record and should shape the plan directly.",
    ));
  }

  for (const id of unique(triage?.verification_signal_ids).filter((signalId) => signalById.has(signalId))) {
    const signal = signalById.get(id);
    const hierarchy = hierarchyById.get(id);
    if (!signal) continue;
    pushUniqueFact(verificationNeeds, signalFact(
      signal,
      "high",
      "today",
      text(hierarchy?.reason) || "This still needs explicit verification language so the plan does not sound more certain than the evidence allows.",
    ));
  }

  for (const gap of Array.isArray(dataQualityGaps) ? dataQualityGaps : []) {
    const severity = ["high", "medium", "low"].includes(lower(gap?.severity)) ? lower(gap.severity) : "medium";
    if (severity === "low") continue;
    pushUniqueFact(verificationNeeds, {
      id: text(gap?.id) || text(gap?.label),
      label: text(gap?.label) || "Data quality gap",
      detail: text(gap?.detail) || text(gap?.staff_action) || null,
      priority: severity,
      severity,
      response_window: severity === "high" ? "today" : "this_week",
      why_it_matters: "The record is incomplete here, so the plan should verify before it leans too hard on this area.",
      source_signal_ids: unique(gap?.source_signal_ids),
    }, (item) => item?.id || item?.label);
  }

  for (const guardrail of Array.isArray(qualityMemory?.current_guardrails) ? qualityMemory.current_guardrails : []) {
    pushUniqueFact(verificationNeeds, {
      id: `${text(guardrail?.section_key)}:guardrail`,
      label: `${text(guardrail?.section_key)} confidence is capped at ${text(guardrail?.max_confidence) || "medium"}`,
      detail: Array.isArray(guardrail?.reasons) ? guardrail.reasons.join(" ") : null,
      priority: lower(guardrail?.max_confidence) === "low" ? "high" : "medium",
      severity: lower(guardrail?.max_confidence) === "low" ? "high" : "medium",
      response_window: lower(guardrail?.max_confidence) === "low" ? "today" : "this_week",
      why_it_matters: "Earlier quality review says this section should stay cautious until fresher evidence clears it.",
      source_signal_ids: [],
    }, (item) => item?.id || item?.label);
  }

  for (const id of unique(triage?.stabilizing_signal_ids).filter((signalId) => signalById.has(signalId))) {
    const signal = signalById.get(id);
    const hierarchy = hierarchyById.get(id);
    if (!signal) continue;
    pushUniqueFact(stabilizingFacts, signalFact(
      signal,
      "medium",
      "ongoing",
      text(hierarchy?.reason) || "This looks like a useful stabilizing routine or support anchor that should not be discarded casually.",
    ));
  }

  for (const item of Array.isArray(qualityMemory?.durable_patterns) ? qualityMemory.durable_patterns : []) {
    pushUniqueFact(stabilizingFacts, {
      id: `${text(item?.section_key)}:${text(item?.text)}`,
      label: text(item?.text),
      detail: text(item?.reason) || null,
      priority: "medium",
      severity: "medium",
      response_window: "ongoing",
      why_it_matters: "This pattern survived prior revisions and is worth preserving unless the live evidence now argues against it.",
      source_signal_ids: [],
    }, (entry) => entry?.id || entry?.label);
  }

  const contradictions = (Array.isArray(evidenceConflicts) ? evidenceConflicts : [])
    .filter((item) => ["high", "medium"].includes(lower(item?.severity)))
    .slice(0, 6)
    .map((item) => ({
      id: text(item?.id),
      section_key: text(item?.section_key) || null,
      severity: lower(item?.severity) || "medium",
      summary: text(item?.summary) || "Evidence conflict",
      detail: text(item?.detail) || null,
      source_signal_ids: unique(item?.source_signal_ids),
      preferred_signal_ids: unique(item?.preferred_signal_ids),
      preserve_signal_ids: unique(item?.preserve_signal_ids),
      requires_verification: item?.requires_verification !== false,
      response_window: text(item?.response_window) || "this_week",
      resolution_mode: text(item?.resolution_mode) || "staff_judgment",
      staff_action: text(item?.staff_action) || null,
      model_instruction: text(item?.model_instruction) || null,
    }))
    .filter((item) => item.id && item.summary);

  const fragilePatternWarnings = (Array.isArray(qualityMemory?.fragile_patterns) ? qualityMemory.fragile_patterns : [])
    .slice(0, 5)
    .map((item) => ({
      section_key: text(item?.section_key) || null,
      text: text(item?.text) || null,
      reason: text(item?.reason) || null,
    }))
    .filter((item) => item.text);

  const recurringQualityRisks = (Array.isArray(qualityMemory?.recurring_quality_risks) ? qualityMemory.recurring_quality_risks : [])
    .slice(0, 6)
    .map((item) => ({
      label: text(item?.label) || null,
      count: Number.isFinite(Number(item?.count)) ? Number(item.count) : 0,
      highest_severity: ["high", "medium", "low"].includes(lower(item?.highest_severity)) ? lower(item.highest_severity) : "medium",
      section_keys: unique(item?.section_keys),
    }))
    .filter((item) => item.label && item.count > 0);

  const followThroughStatus = text(followThrough?.status) || null;
  const summary =
    text(escalationGrade?.grade) === "urgent"
      ? "Start from the same-day risks and contradictions first, then preserve only the routines that still fit the live evidence."
      : contradictions.length > 0
        ? "Start from the conflicts that the record is still holding open, then preserve the strongest stabilizing routines around them."
        : mustAddressFacts.length > 0
          ? "Start from the highest-priority live facts, then add verification where the record is incomplete and preserve only grounded routines."
          : "Use the best supported live facts first and keep verification explicit where the record is still thin.";

  return {
    summary,
    same_day_response_required: text(escalationGrade?.response_window) === "today" || text(escalationGrade?.grade) === "urgent",
    follow_through_status: followThroughStatus,
    must_address_facts: mustAddressFacts.slice(0, 6),
    verification_needs: verificationNeeds
      .sort((left, right) => priorityRank(right.priority) - priorityRank(left.priority))
      .slice(0, 8),
    stabilizing_facts: stabilizingFacts.slice(0, 6),
    contradictions,
    recurring_quality_risks: recurringQualityRisks,
    fragile_pattern_warnings: fragilePatternWarnings,
  };
}
