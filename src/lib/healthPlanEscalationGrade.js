function text(value) {
  return String(value || "").trim();
}

function lower(value) {
  return text(value).toLowerCase();
}

function unique(values) {
  return [...new Set((Array.isArray(values) ? values : []).map((value) => text(value)).filter(Boolean))];
}

function normalizeSignal(signal) {
  if (!signal || typeof signal !== "object") return null;
  const id = text(signal.id);
  if (!id) return null;
  return {
    id,
    label: text(signal.label) || id,
    detail: text(signal.detail),
    category: lower(signal.category) || "context",
    strength: ["high", "medium", "low"].includes(lower(signal.strength)) ? lower(signal.strength) : "medium",
  };
}

function normalizeConflict(conflict) {
  if (!conflict || typeof conflict !== "object") return null;
  const id = text(conflict.id);
  if (!id) return null;
  return {
    id,
    severity: ["high", "medium", "low"].includes(lower(conflict.severity)) ? lower(conflict.severity) : "medium",
    summary: text(conflict.summary),
    detail: text(conflict.detail),
    section_key: text(conflict.section_key) || null,
  };
}

function normalizeFollowThroughSignal(signal) {
  if (!signal || typeof signal !== "object") return null;
  const id = text(signal.id);
  if (!id) return null;
  return {
    id,
    label: text(signal.label) || id,
    detail: text(signal.detail),
  };
}

function severityRank(value) {
  if (value === "high") return 3;
  if (value === "medium") return 2;
  return 1;
}

function responseRank(value) {
  if (value === "today") return 3;
  if (value === "this_week") return 2;
  return 1;
}

function mergeReason(existing, next) {
  if (!existing) return next;
  return {
    ...existing,
    score: Math.max(Number(existing.score || 0), Number(next.score || 0)),
    severity: severityRank(next.severity) > severityRank(existing.severity) ? next.severity : existing.severity,
    response_window: responseRank(next.response_window) > responseRank(existing.response_window)
      ? next.response_window
      : existing.response_window,
    detail: existing.detail || next.detail,
    source_signal_ids: unique([...(existing.source_signal_ids || []), ...(next.source_signal_ids || [])]),
  };
}

function pushReason(reasonMap, reason) {
  if (!reason?.id) return;
  reasonMap.set(reason.id, mergeReason(reasonMap.get(reason.id), reason));
}

function itemRefs(item) {
  return unique(item?.source_signal_ids);
}

function itemTiming(item) {
  const normalized = lower(item?.timing);
  if (normalized === "today" || normalized === "this_week" || normalized === "ongoing") return normalized;
  return null;
}

const SAME_DAY_PATTERN = /\b(today|same day|immediately|right away|now|before end of day|this morning|this afternoon|within \d+ (hour|hours))\b/i;

function itemsReferenceIds(items = [], signalIds = []) {
  const wanted = new Set(unique(signalIds));
  if (!wanted.size) return false;
  return (Array.isArray(items) ? items : []).some((item) => itemRefs(item).some((id) => wanted.has(id)));
}

function itemsReferenceIdsWithTiming(items = [], signalIds = [], timing = "today") {
  const wanted = new Set(unique(signalIds));
  if (!wanted.size) return false;
  return (Array.isArray(items) ? items : []).some((item) => {
    const refs = itemRefs(item);
    if (!refs.some((id) => wanted.has(id))) return false;
    if (itemTiming(item) === timing) return true;
    if (timing === "today" && SAME_DAY_PATTERN.test(text(item?.text))) return true;
    return false;
  });
}

export function buildHealthPlanEscalationGrade({
  sourceSignals = [],
  signalTriage = {},
  criticalSignalIds = [],
  followThrough = null,
  evidenceConflicts = [],
} = {}) {
  const signals = (Array.isArray(sourceSignals) ? sourceSignals : []).map(normalizeSignal).filter(Boolean);
  const byId = new Map(signals.map((signal) => [signal.id, signal]));
  const actionSignalIds = unique(signalTriage?.action_signal_ids).filter((id) => byId.has(id));
  const verificationSignalIds = unique(signalTriage?.verification_signal_ids).filter((id) => byId.has(id));
  const criticalIds = unique(criticalSignalIds).filter((id) => byId.has(id));
  const cautionSignals = (Array.isArray(followThrough?.caution_signals) ? followThrough.caution_signals : [])
    .map(normalizeFollowThroughSignal)
    .filter(Boolean);
  const conflicts = (Array.isArray(evidenceConflicts) ? evidenceConflicts : []).map(normalizeConflict).filter(Boolean);
  const reasonMap = new Map();

  const alertSignal = byId.get("alert-active");
  if (alertSignal) {
    pushReason(reasonMap, {
      id: "active-alerts",
      label: "Active alerts need same-day coordination",
      detail: alertSignal.detail || "Unresolved alerts are still active in the live record.",
      severity: "high",
      response_window: "today",
      score: 4,
      source_signal_ids: [alertSignal.id],
    });
  }

  const riskSignal = byId.get("risk-latest-score");
  if (riskSignal) {
    const riskText = lower(`${riskSignal.label} ${riskSignal.detail}`);
    const riskIsHot = riskSignal.strength === "high" || /\b(high|critical|urgent)\b/.test(riskText);
    const riskWorsening = /\bup\b|\bworsen|\bincreas/.test(riskText);
    if (riskIsHot || riskWorsening) {
      pushReason(reasonMap, {
        id: "risk-pressure",
        label: riskWorsening ? "Risk trend is worsening" : "Predictive risk is elevated",
        detail: riskSignal.detail || riskSignal.label,
        severity: riskIsHot ? "high" : "medium",
        response_window: riskIsHot || riskWorsening ? "today" : "this_week",
        score: riskIsHot ? 3 : 2,
        source_signal_ids: [riskSignal.id],
      });
    }
  }

  const medicationSignal = byId.get("medication-plan");
  if (medicationSignal) {
    const medicationText = lower(`${medicationSignal.label} ${medicationSignal.detail}`);
    if (/\bmissed|late|skipped|unconfirmed|off\b/.test(medicationText)) {
      pushReason(reasonMap, {
        id: "medication-instability",
        label: "Medication follow-through is unstable",
        detail: medicationSignal.detail || medicationSignal.label,
        severity: /\bmissed|skipped|unconfirmed\b/.test(medicationText) ? "high" : "medium",
        response_window: /\bmissed|skipped|unconfirmed\b/.test(medicationText) ? "today" : "this_week",
        score: /\bmissed|skipped|unconfirmed\b/.test(medicationText) ? 3 : 2,
        source_signal_ids: [medicationSignal.id],
      });
    }
  }

  const sensorSignal = byId.get("sensor-status");
  if (sensorSignal && /\boffline|not reporting|silent\b/.test(lower(`${sensorSignal.label} ${sensorSignal.detail}`))) {
    pushReason(reasonMap, {
      id: "sensor-visibility-gap",
      label: "Sensor visibility is reduced",
      detail: sensorSignal.detail || sensorSignal.label,
      severity: "medium",
      response_window: "today",
      score: 2,
      source_signal_ids: [sensorSignal.id],
    });
  }

  const careCircleSignal = byId.get("care-circle-context");
  if (careCircleSignal && /\bno care provider|no assigned\b/.test(lower(`${careCircleSignal.label} ${careCircleSignal.detail}`))) {
    pushReason(reasonMap, {
      id: "care-circle-gap",
      label: "Care coverage is thin",
      detail: careCircleSignal.detail || careCircleSignal.label,
      severity: "medium",
      response_window: "this_week",
      score: 2,
      source_signal_ids: [careCircleSignal.id],
    });
  }

  for (const signalId of ["service-checkins", "service-brain-coach"]) {
    const serviceSignal = byId.get(signalId);
    if (!serviceSignal) continue;
    if (/\bmissed|pending|failed|unconfirmed|disabled|off\b/.test(lower(`${serviceSignal.label} ${serviceSignal.detail}`))) {
      pushReason(reasonMap, {
        id: `${signalId}-instability`,
        label: `${serviceSignal.label} is not landing reliably`,
        detail: serviceSignal.detail || serviceSignal.label,
        severity: "medium",
        response_window: "today",
        score: 2,
        source_signal_ids: [serviceSignal.id],
      });
    }
  }

  const followThroughIds = new Set(cautionSignals.map((signal) => signal.id));
  if (followThroughIds.has("new-alerts-since-plan") || followThroughIds.has("risk-worsened")) {
    pushReason(reasonMap, {
      id: "post-generation-regression",
      label: "The situation has worsened since the last plan",
      detail: cautionSignals.find((signal) => signal.id === "new-alerts-since-plan")?.detail
        || cautionSignals.find((signal) => signal.id === "risk-worsened")?.detail
        || "New caution signals appeared after the last plan was generated.",
      severity: "high",
      response_window: "today",
      score: 4,
      source_signal_ids: unique([
        followThroughIds.has("new-alerts-since-plan") ? "alert-active" : null,
        followThroughIds.has("risk-worsened") ? "risk-latest-score" : null,
      ]).filter((id) => byId.has(id)),
    });
  }

  if (followThroughIds.has("no-fresh-touchpoints")) {
    pushReason(reasonMap, {
      id: "no-fresh-follow-through",
      label: "Fresh follow-through evidence is missing",
      detail: cautionSignals.find((signal) => signal.id === "no-fresh-touchpoints")?.detail
        || "No new check-in, Brain Coach, or medication evidence has been logged since the last plan.",
      severity: actionSignalIds.length ? "high" : "medium",
      response_window: actionSignalIds.length ? "today" : "this_week",
      score: actionSignalIds.length ? 3 : 1,
      source_signal_ids: unique([
        ...actionSignalIds.slice(0, 2),
        "service-checkins",
        "service-brain-coach",
        "medication-plan",
      ]).filter((id) => byId.has(id)),
    });
  }

  const liveConflict = conflicts.find((conflict) => conflict.severity === "high" || conflict.severity === "medium");
  if (liveConflict) {
    pushReason(reasonMap, {
      id: "evidence-conflict",
      label: "Important evidence is pulling in different directions",
      detail: liveConflict.detail || liveConflict.summary || "Fresh signals disagree with older plan evidence.",
      severity: liveConflict.severity === "high" ? "high" : "medium",
      response_window: liveConflict.severity === "high" ? "today" : "this_week",
      score: liveConflict.severity === "high" ? 3 : 2,
      source_signal_ids: unique([
        ...actionSignalIds.slice(0, 2),
        ...criticalIds.slice(0, 2),
      ]).filter((id) => byId.has(id)),
    });
  }

  const reasons = [...reasonMap.values()].sort((left, right) => {
    const bySeverity = severityRank(right.severity) - severityRank(left.severity);
    if (bySeverity !== 0) return bySeverity;
    return Number(right.score || 0) - Number(left.score || 0);
  });

  const highReasonCount = reasons.filter((item) => item.severity === "high").length;
  const score = reasons.reduce((total, item) => total + Number(item.score || 0), 0);
  const urgent =
    highReasonCount >= 2
    || score >= 8
    || reasons.some((item) => item.id === "post-generation-regression")
    || (reasonMap.has("active-alerts") && reasonMap.has("no-fresh-follow-through"));
  const heightened = !urgent && (highReasonCount >= 1 || score >= 4 || reasons.length >= 2 || actionSignalIds.length >= 2);
  const grade = urgent ? "urgent" : heightened ? "heightened" : "routine";
  const responseWindow =
    grade === "urgent"
      ? "today"
      : grade === "heightened"
        ? reasons.some((item) => item.response_window === "today") ? "today" : "this_week"
        : "ongoing";

  const requiredSignalIds = unique([
    ...criticalIds,
    ...reasons.flatMap((item) => item.source_signal_ids || []),
    ...actionSignalIds.slice(0, 3),
  ]).filter((id) => byId.has(id)).slice(0, 5);
  const sameDaySignalIds = unique([
    ...reasons.filter((item) => item.response_window === "today").flatMap((item) => item.source_signal_ids || []),
    ...criticalIds.filter((id) => {
      const signal = byId.get(id);
      return signal?.strength === "high";
    }),
  ]).filter((id) => byId.has(id)).slice(0, 4);
  const requiredVerificationIds = unique([
    ...verificationSignalIds,
    ...(reasonMap.has("sensor-visibility-gap") ? ["sensor-status"] : []),
    ...(reasonMap.has("no-fresh-follow-through") ? ["service-checkins", "service-brain-coach", "medication-plan"] : []),
  ]).filter((id) => byId.has(id)).slice(0, 4);

  const summary =
    grade === "urgent"
      ? "The current signal mix requires same-day coordination and should not be treated as a routine support plan."
      : grade === "heightened"
        ? "The current signal mix needs tighter monitoring and clearer escalation than a routine plan."
        : "The current signal mix supports a steady plan, with normal monitoring tied to the recorded evidence.";

  return {
    grade,
    score,
    response_window: responseWindow,
    summary,
    reasons,
    required_signal_ids: requiredSignalIds,
    same_day_signal_ids: sameDaySignalIds,
    verification_signal_ids: requiredVerificationIds,
  };
}

export function buildHealthPlanEscalationGradeBrief(escalationGrade) {
  return {
    grade: text(escalationGrade?.grade) || "routine",
    score: Number.isFinite(Number(escalationGrade?.score)) ? Number(escalationGrade.score) : 0,
    response_window: text(escalationGrade?.response_window) || "ongoing",
    summary: text(escalationGrade?.summary),
    required_signal_ids: unique(escalationGrade?.required_signal_ids).slice(0, 5),
    same_day_signal_ids: unique(escalationGrade?.same_day_signal_ids).slice(0, 4),
    verification_signal_ids: unique(escalationGrade?.verification_signal_ids).slice(0, 4),
    reasons: (Array.isArray(escalationGrade?.reasons) ? escalationGrade.reasons : []).slice(0, 4).map((item) => ({
      id: text(item?.id),
      label: text(item?.label),
      detail: text(item?.detail) || null,
      severity: ["high", "medium", "low"].includes(lower(item?.severity)) ? lower(item.severity) : "medium",
      response_window: text(item?.response_window) || "ongoing",
      source_signal_ids: unique(item?.source_signal_ids),
    })),
  };
}

function normalizeGap(gap) {
  if (!gap || typeof gap !== "object") return null;
  const id = text(gap.id);
  if (!id) return null;
  return {
    id,
    label: text(gap.label) || id,
    detail: text(gap.detail),
    severity: ["high", "medium", "low"].includes(lower(gap.severity)) ? lower(gap.severity) : "medium",
  };
}

function normalizeGovernanceReason(reason) {
  if (!reason || typeof reason !== "object") return null;
  const id = text(reason.id);
  if (!id) return null;
  return {
    id,
    label: text(reason.label) || id,
    detail: text(reason.detail) || null,
    severity: ["high", "medium", "low"].includes(lower(reason.severity)) ? lower(reason.severity) : "medium",
    source: text(reason.source) || "signals",
  };
}

function mergeGovernanceReason(existing, next) {
  if (!existing) return next;
  return {
    ...existing,
    severity: severityRank(next.severity) > severityRank(existing.severity) ? next.severity : existing.severity,
    detail: existing.detail || next.detail,
  };
}

export function buildHealthPlanReviewGovernance({
  escalationGrade = null,
  dataQualityGaps = [],
  followThrough = null,
  evidenceConflicts = [],
} = {}) {
  const reasonMap = new Map();
  const grade = lower(escalationGrade?.grade);
  const responseWindow = text(escalationGrade?.response_window) || "ongoing";

  for (const reason of Array.isArray(escalationGrade?.reasons) ? escalationGrade.reasons : []) {
    const normalized = normalizeGovernanceReason({
      ...reason,
      source: "signals",
    });
    if (!normalized) continue;
    reasonMap.set(normalized.id, mergeGovernanceReason(reasonMap.get(normalized.id), normalized));
  }

  for (const gap of (Array.isArray(dataQualityGaps) ? dataQualityGaps : []).map(normalizeGap).filter(Boolean)) {
    if (gap.severity !== "high") continue;
    const normalized = normalizeGovernanceReason({
      id: `gap:${gap.id}`,
      label: `${gap.label} needs confirmation`,
      detail: gap.detail || "A high-severity confidence gap is still open in the live input picture.",
      severity: "medium",
      source: "data_quality",
    });
    reasonMap.set(normalized.id, mergeGovernanceReason(reasonMap.get(normalized.id), normalized));
  }

  if (text(followThrough?.status) === "needs_review") {
    const caution = (Array.isArray(followThrough?.caution_signals) ? followThrough.caution_signals : [])
      .map(normalizeFollowThroughSignal)
      .filter(Boolean)[0];
    const normalized = normalizeGovernanceReason({
      id: "follow-through:needs-review",
      label: "New follow-through signals have overtaken this plan",
      detail: caution?.detail || followThrough?.summary || "Fresh caution signals mean this plan should be re-checked before reuse.",
      severity: "high",
      source: "follow_through",
    });
    reasonMap.set(normalized.id, mergeGovernanceReason(reasonMap.get(normalized.id), normalized));
  }

  for (const conflict of (Array.isArray(evidenceConflicts) ? evidenceConflicts : []).map(normalizeConflict).filter(Boolean)) {
    if (!["high", "medium"].includes(conflict.severity)) continue;
    const normalized = normalizeGovernanceReason({
      id: `conflict:${conflict.id}`,
      label: conflict.summary || "Evidence conflict needs review",
      detail: conflict.detail || "Important evidence is disagreeing and needs staff judgment.",
      severity: conflict.severity,
      source: "evidence_conflict",
    });
    reasonMap.set(normalized.id, mergeGovernanceReason(reasonMap.get(normalized.id), normalized));
  }

  const reasons = [...reasonMap.values()].sort((left, right) => {
    const bySeverity = severityRank(right.severity) - severityRank(left.severity);
    if (bySeverity !== 0) return bySeverity;
    return left.label.localeCompare(right.label);
  });

  const reviewRequired =
    grade === "urgent"
    || grade === "heightened"
    || reasons.some((item) => item.source !== "signals")
    || reasons.some((item) => item.severity === "high");
  const reviewWindow =
    grade === "urgent"
      ? "today"
      : responseWindow === "today"
        ? "today"
        : reviewRequired
          ? "this_week"
          : "ongoing";
  const summary =
    !reviewRequired
      ? "This plan does not currently need elevated review beyond normal staff judgment."
      : grade === "urgent"
        ? "This plan needs same-day staff review before the team relies on it as the main guidance."
        : "This plan should be reviewed by staff before it is reused or shared.";

  return {
    escalation_grade: grade === "urgent" || grade === "heightened" ? grade : "routine",
    review_required: reviewRequired,
    review_window: reviewWindow,
    review_summary: summary,
    review_reasons_json: reasons,
  };
}

function makeIssue(sectionKey, message) {
  return {
    section_key: sectionKey,
    message,
  };
}

export function findHealthPlanEscalationGradeIssues(
  plan,
  {
    escalationGrade = null,
    sourceSignals = [],
  } = {},
) {
  const validSignalIds = new Set((Array.isArray(sourceSignals) ? sourceSignals : []).map((signal) => text(signal?.id)).filter(Boolean));
  const grade = lower(escalationGrade?.grade);
  if (!["heightened", "urgent"].includes(grade)) return [];

  const requiredSignalIds = unique(escalationGrade?.required_signal_ids).filter((id) => validSignalIds.has(id));
  const sameDaySignalIds = unique(escalationGrade?.same_day_signal_ids).filter((id) => validSignalIds.has(id));
  const verificationSignalIds = unique(escalationGrade?.verification_signal_ids).filter((id) => validSignalIds.has(id));
  const summaryRefs = unique(plan?.summary_signal_ids);
  const monitoringItems = Array.isArray(plan?.monitoring_json) ? plan.monitoring_json : [];
  const escalationItems = Array.isArray(plan?.escalation_json) ? plan.escalation_json : [];
  const coveredOutsideSummary = requiredSignalIds.some((id) => itemsReferenceIds(monitoringItems, [id]) || itemsReferenceIds(escalationItems, [id]));
  const issues = [];

  if (requiredSignalIds.length && !coveredOutsideSummary) {
    issues.push(makeIssue("monitoring_json", "The plan is not carrying the main escalation drivers into monitoring or escalation guidance."));
  }

  if (grade === "urgent") {
    if (requiredSignalIds.length && !requiredSignalIds.some((id) => summaryRefs.includes(id))) {
      issues.push(makeIssue("summary", "The summary does not acknowledge the signals that make this case urgent."));
    }
    if (requiredSignalIds.length && !itemsReferenceIds(monitoringItems, requiredSignalIds)) {
      issues.push(makeIssue("monitoring_json", "This plan is graded urgent, but the monitoring section does not cover the signals driving that urgency."));
    }
    const urgentIds = sameDaySignalIds.length ? sameDaySignalIds : requiredSignalIds;
    if (urgentIds.length && !itemsReferenceIds(escalationItems, urgentIds)) {
      issues.push(makeIssue("escalation_json", "This plan is graded urgent, but the escalation section does not name a response for the strongest live signals."));
    }
    if (urgentIds.length && !itemsReferenceIdsWithTiming(escalationItems, urgentIds, "today")) {
      issues.push(makeIssue("escalation_json", "This plan is graded urgent, but the escalation section does not make the same-day response explicit."));
    }
    if (requiredSignalIds.length && !itemsReferenceIdsWithTiming(monitoringItems, requiredSignalIds, "today")) {
      issues.push(makeIssue("monitoring_json", "This plan is graded urgent, but the monitoring section is not paced as same-day follow-through."));
    }
  } else if (sameDaySignalIds.length && !itemsReferenceIds(escalationItems, sameDaySignalIds)) {
    issues.push(makeIssue("escalation_json", "The strongest live signals are not being carried into escalation guidance."));
  }

  if (verificationSignalIds.length && !itemsReferenceIds(monitoringItems, verificationSignalIds)) {
    issues.push(makeIssue("monitoring_json", "Signals that still need verification are not being checked explicitly in monitoring."));
  }

  return issues;
}
