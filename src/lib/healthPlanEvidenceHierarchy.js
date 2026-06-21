function text(value) {
  return String(value || "").trim();
}

function lower(value) {
  return text(value).toLowerCase();
}

function unique(values) {
  return [...new Set((Array.isArray(values) ? values : []).map((value) => text(value)).filter(Boolean))];
}

function freshnessBucket(recordedAt, now = new Date()) {
  const parsed = recordedAt ? new Date(recordedAt) : null;
  const current = now instanceof Date ? now : new Date(now);
  if (!parsed || Number.isNaN(parsed.getTime()) || Number.isNaN(current.getTime())) return null;
  const ageDays = Math.max(0, (current.getTime() - parsed.getTime()) / (24 * 60 * 60 * 1000));
  if (ageDays <= 3) return "fresh";
  if (ageDays <= 10) return "aging";
  return "stale";
}

function inferredSource(value) {
  return text(value) === "inferred_operational";
}

function normalizeSignal(signal) {
  if (!signal || typeof signal !== "object") return null;
  const id = text(signal?.id);
  if (!id) return null;
  return {
    id,
    label: text(signal?.label) || id,
    detail: text(signal?.detail) || null,
    category: lower(signal?.category) || "context",
    strength: lower(signal?.strength) || "medium",
  };
}

function normalizeFeedbackEntries(entries) {
  return (Array.isArray(entries) ? entries : []).map((item) => ({
    section_key: text(item?.section_key),
    item_id: text(item?.item_id) || null,
    outcome: text(item?.outcome),
    note: text(item?.note) || null,
    recorded_at: text(item?.recorded_at) || null,
    source: text(item?.source) || "manual",
  })).filter((item) => item.section_key && item.outcome);
}

function groupLatestSectionFeedback(entries) {
  const bySection = new Map();
  for (const item of normalizeFeedbackEntries(entries)) {
    if (item.item_id) continue;
    const current = bySection.get(item.section_key);
    const currentTime = current?.recorded_at ? new Date(current.recorded_at).getTime() : 0;
    const nextTime = item.recorded_at ? new Date(item.recorded_at).getTime() : 0;
    if (!current || nextTime >= currentTime) bySection.set(item.section_key, item);
  }
  return bySection;
}

function signalAuthority(signal, now = new Date()) {
  const id = text(signal?.id);
  const category = lower(signal?.category);
  const detail = lower(signal?.detail);
  const strength = lower(signal?.strength);

  if (id === "alert-active") {
    return {
      authority_level: "high",
      priority_score: 100,
      source_type: "live_alerts",
      reason: "Active alerts should outrank calmer background context because they reflect the current operational picture.",
    };
  }
  if (id === "sensor-status" && /offline|not reporting|silent/.test(detail)) {
    return {
      authority_level: "high",
      priority_score: 92,
      source_type: "live_sensors",
      reason: "Sensor failures directly limit what staff can safely assume right now.",
    };
  }
  if (id === "medication-plan" && /missed|late|skipped|unconfirmed/.test(detail)) {
    return {
      authority_level: "high",
      priority_score: 89,
      source_type: "live_medication",
      reason: "Current medication misses or uncertainty should outrank older supportive context.",
    };
  }
  if (id === "risk-latest-score") {
    return {
      authority_level: "medium",
      priority_score: 74,
      source_type: "predictive",
      reason: "Predictive risk matters, but it should be checked against fresher live signals and staff observations.",
    };
  }
  if (id === "forecast-near-term") {
    return {
      authority_level: "medium",
      priority_score: 66,
      source_type: "predictive",
      reason: "Forecasts help planning, but they should not outweigh current alerts or fresh staff evidence.",
    };
  }
  if (category === "service") {
    return {
      authority_level: strength === "high" ? "medium" : "supporting",
      priority_score: strength === "high" ? 62 : 54,
      source_type: "service_state",
      reason: "Saved service state is useful, but staff should still check whether the routine actually happened.",
    };
  }
  if (category === "care-circle" || category === "context") {
    return {
      authority_level: "supporting",
      priority_score: 42,
      source_type: "profile_context",
      reason: "Care-circle and profile context should shape tone and feasibility, not override urgent live evidence.",
    };
  }
  return {
    authority_level: "supporting",
    priority_score: 50,
    source_type: category || "context",
    reason: "Use this as supporting context after the stronger live evidence is covered.",
  };
}

function signalLookup(sourceSignals = []) {
  return new Map(
    (Array.isArray(sourceSignals) ? sourceSignals : [])
      .map(normalizeSignal)
      .filter(Boolean)
      .map((signal) => [signal.id, signal]),
  );
}

function authorityScoreForSignalId(signalId, signals = new Map()) {
  const signal = signals.get(signalId);
  if (!signal) return 0;
  return Number(signalAuthority(signal)?.priority_score || 0);
}

function preferredSignalIds(sourceSignalIds = [], signals = new Map()) {
  const normalized = unique(sourceSignalIds)
    .map((signalId) => ({
      id: signalId,
      signal: signals.get(signalId) || null,
      score: authorityScoreForSignalId(signalId, signals),
    }))
    .filter((item) => item.id);
  const liveFirst = normalized.filter((item) => !["context", "care-circle"].includes(lower(item.signal?.category)));
  const ranked = (liveFirst.length ? liveFirst : normalized)
    .sort((left, right) => right.score - left.score)
    .slice(0, 2)
    .map((item) => item.id);
  return unique(ranked);
}

function preserveSignalIds(sourceSignalIds = [], signals = new Map(), preferredIds = []) {
  const preferred = new Set(unique(preferredIds));
  return unique(sourceSignalIds).filter((signalId) => {
    if (preferred.has(signalId)) return false;
    const category = lower(signals.get(signalId)?.category);
    return ["service", "care-circle", "context"].includes(category);
  });
}

function conflictResponseWindow(conflictType, severity, preferredIds = []) {
  if (severity === "high") return "today";
  if (preferredIds.some((signalId) => ["alert-active", "risk-latest-score", "medication-plan", "sensor-status"].includes(signalId))) {
    return "today";
  }
  if (conflictType === "stale_negative_feedback") return "this_week";
  return "this_week";
}

function conflictResolutionMode(conflictType) {
  if (conflictType === "live_vs_past_success") return "prefer_live_verification";
  if (conflictType === "predictive_vs_service_context") return "preserve_support_but_verify";
  if (conflictType === "stale_negative_feedback") return "review_stale_negative";
  return "staff_judgment";
}

function conflictStaffAction(conflictType, responseWindow, preferredIds = [], preserveIds = [], signals = new Map()) {
  const preferredLabels = preferredIds.map((signalId) => text(signals.get(signalId)?.label) || signalId).filter(Boolean);
  const preserveLabels = preserveIds.map((signalId) => text(signals.get(signalId)?.label) || signalId).filter(Boolean);
  if (conflictType === "predictive_vs_service_context") {
    return `Use ${preferredLabels.join(" and ") || "the higher-risk live signals"} as the lead check, but keep ${preserveLabels.join(" and ") || "the stabilizing routine"} only as supporting context until staff re-confirm it ${responseWindow === "today" ? "today" : "this week"}.`;
  }
  if (conflictType === "stale_negative_feedback") {
    return "Re-check whether the older negative outcome still applies before treating it as decisive.";
  }
  return `Treat ${preferredLabels.join(" and ") || "the fresher live evidence"} as the decision lead, use explicit verification wording, and avoid letting older reassurance or background context settle the question too early.`;
}

function conflictModelInstruction(conflictType, preferredIds = [], preserveIds = [], signals = new Map()) {
  const preferredLabels = preferredIds.map((signalId) => text(signals.get(signalId)?.label) || signalId).filter(Boolean);
  const preserveLabels = preserveIds.map((signalId) => text(signals.get(signalId)?.label) || signalId).filter(Boolean);
  if (conflictType === "predictive_vs_service_context") {
    return `Lead with ${preferredLabels.join(" and ") || "the risk-driving signals"}, preserve ${preserveLabels.join(" and ") || "the routine context"} only as conditional support, and write explicit verification language instead of false reassurance.`;
  }
  if (conflictType === "stale_negative_feedback") {
    return "Treat the older negative feedback as aging context, not final truth, until the current situation is re-checked.";
  }
  return `Resolve this contradiction by preferring ${preferredLabels.join(" and ") || "the fresher live evidence"}, keeping verification explicit, and avoiding generic calming language that ignores the conflict.`;
}

function enrichConflict(conflict, { sourceSignalIds = [], signals = new Map(), preferredIds = null, preserveIds = null } = {}) {
  const sourceIds = unique(sourceSignalIds);
  const resolvedPreferredIds = unique(preferredIds?.length ? preferredIds : preferredSignalIds(sourceIds, signals));
  const resolvedPreserveIds = unique(preserveIds?.length ? preserveIds : preserveSignalIds(sourceIds, signals, resolvedPreferredIds));
  const severity = ["high", "medium", "low"].includes(lower(conflict?.severity)) ? lower(conflict.severity) : "medium";
  const conflictType = text(conflict?.conflict_type) || "staff_judgment";
  const responseWindow = conflictResponseWindow(conflictType, severity, resolvedPreferredIds);
  return {
    ...conflict,
    severity,
    source_signal_ids: sourceIds,
    preferred_signal_ids: resolvedPreferredIds,
    preserve_signal_ids: resolvedPreserveIds,
    requires_verification: true,
    response_window: responseWindow,
    resolution_mode: conflictResolutionMode(conflictType),
    staff_action: conflictStaffAction(conflictType, responseWindow, resolvedPreferredIds, resolvedPreserveIds, signals),
    model_instruction: conflictModelInstruction(conflictType, resolvedPreferredIds, resolvedPreserveIds, signals),
  };
}

export function buildHealthPlanEvidenceHierarchy({
  sourceSignals = [],
  feedbackEntries = [],
  now = new Date(),
} = {}) {
  const latestSectionFeedback = [...groupLatestSectionFeedback(feedbackEntries).entries()].map(([sectionKey, item]) => ({
    id: `feedback:${sectionKey}`,
    label: inferredSource(item.source) ? `Observed activity for ${sectionKey}` : `Staff feedback for ${sectionKey}`,
    section_key: sectionKey,
    outcome: item.outcome,
    note: item.note,
    source: item.source,
    freshness_status: freshnessBucket(item.recorded_at, now),
    authority_level: inferredSource(item.source)
      ? (freshnessBucket(item.recorded_at, now) === "stale" ? "medium" : "high")
      : (freshnessBucket(item.recorded_at, now) === "stale" ? "medium" : "highest"),
    priority_score: inferredSource(item.source)
      ? (freshnessBucket(item.recorded_at, now) === "stale" ? 72 : 92)
      : (freshnessBucket(item.recorded_at, now) === "stale" ? 82 : 106),
    source_type: inferredSource(item.source) ? "observed_activity" : "staff_feedback",
    reason: inferredSource(item.source)
      ? "Recent operational activity is strong evidence, but it should not outweigh a fresh explicit human judgment."
      : freshnessBucket(item.recorded_at, now) === "stale"
        ? "Older staff feedback still matters, but it should be checked against newer live evidence."
        : "Fresh staff feedback is the clearest evidence of whether guidance held up in real use.",
  }));

  const signalItems = (Array.isArray(sourceSignals) ? sourceSignals : []).map((signal) => {
    const authority = signalAuthority(signal, now);
    return {
      id: text(signal?.id),
      label: text(signal?.label),
      detail: text(signal?.detail) || null,
      category: text(signal?.category) || null,
      authority_level: authority.authority_level,
      priority_score: authority.priority_score,
      source_type: authority.source_type,
      reason: authority.reason,
    };
  }).filter((item) => item.id && item.label);

  return [...latestSectionFeedback, ...signalItems]
    .sort((left, right) => Number(right.priority_score || 0) - Number(left.priority_score || 0));
}

export function buildHealthPlanEvidenceConflicts({
  sourceSignals = [],
  feedbackEntries = [],
  followThrough = null,
  sectionDrift = [],
  now = new Date(),
} = {}) {
  const latestSectionFeedback = groupLatestSectionFeedback(feedbackEntries);
  const signals = signalLookup(sourceSignals);
  const conflicts = [];

  for (const [sectionKey, feedback] of latestSectionFeedback.entries()) {
    const freshness = freshnessBucket(feedback.recorded_at, now);
    const drift = (Array.isArray(sectionDrift) ? sectionDrift : []).find((item) => text(item?.section_key) === sectionKey);
    const cautionSignals = Array.isArray(followThrough?.caution_signals) ? followThrough.caution_signals : [];
    const cautionIds = unique(cautionSignals.map((item) => item?.id));

    if (feedback.outcome === "helped" && (text(drift?.status) === "needs_refresh" || cautionSignals.length > 0)) {
      conflicts.push(enrichConflict({
        id: `conflict:${sectionKey}:live`,
        section_key: sectionKey,
        conflict_type: "live_vs_past_success",
        severity: freshness === "stale" ? "medium" : "high",
        summary: "Earlier positive feedback now conflicts with live evidence.",
        detail: text(drift?.reasons?.[0]) || text(cautionSignals[0]?.detail) || text(cautionSignals[0]?.label) || "Fresh alerts or drift suggest this guidance should be re-checked.",
      }, {
        sourceSignalIds: cautionIds,
        signals,
      }));
    }

    if ((feedback.outcome === "did_not_help" || feedback.outcome === "needs_follow_up") && freshness === "stale") {
      conflicts.push(enrichConflict({
        id: `conflict:${sectionKey}:stale`,
        section_key: sectionKey,
        conflict_type: "stale_negative_feedback",
        severity: "low",
        summary: "Negative feedback is aging and may no longer describe the current situation.",
        detail: "Re-check before treating this older negative outcome as still decisive.",
      }, {
        sourceSignalIds: [],
        signals,
      }));
    }
  }

  const predictive = (Array.isArray(sourceSignals) ? sourceSignals : []).find((signal) => text(signal?.id) === "risk-latest-score");
  const stabilizingService = (Array.isArray(sourceSignals) ? sourceSignals : []).find((signal) => ["service-checkins", "service-brain-coach"].includes(text(signal?.id)) && lower(signal?.strength) !== "high");
  if (predictive && stabilizingService) {
    conflicts.push(enrichConflict({
      id: "conflict:risk-vs-service",
      section_key: "monitoring_json",
      conflict_type: "predictive_vs_service_context",
      severity: "medium",
      summary: "Predictive risk and apparently stable service routines may be pulling in different directions.",
      detail: "Do not let a saved routine create false reassurance if predictive risk is still elevated.",
    }, {
      sourceSignalIds: [predictive.id, stabilizingService.id],
      signals,
      preferredIds: [predictive.id],
      preserveIds: [stabilizingService.id],
    }));
  }

  return unique(conflicts.map((item) => item.id)).map((id) => conflicts.find((item) => item.id === id)).filter(Boolean);
}

export function buildHealthPlanEvidenceHierarchyBrief(items = []) {
  return (Array.isArray(items) ? items : [])
    .slice(0, 8)
    .map((item) => ({
      id: text(item?.id),
      label: text(item?.label),
      section_key: text(item?.section_key) || null,
      authority_level: text(item?.authority_level) || "supporting",
      source_type: text(item?.source_type) || "context",
      freshness_status: text(item?.freshness_status) || null,
      priority_score: Number.isFinite(Number(item?.priority_score)) ? Number(item.priority_score) : 0,
      reason: text(item?.reason),
    }))
    .filter((item) => item.id && item.label && item.reason);
}
