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
    label: text(signal.label),
    detail: text(signal.detail),
    category: lower(signal.category) || "context",
    strength: ["high", "medium", "low"].includes(lower(signal.strength)) ? lower(signal.strength) : "medium",
  };
}

function signalMap(sourceSignals = []) {
  return new Map((Array.isArray(sourceSignals) ? sourceSignals : []).map(normalizeSignal).filter(Boolean).map((signal) => [signal.id, signal]));
}

function followThroughIds(followThrough) {
  return new Set(
    (Array.isArray(followThrough?.caution_signals) ? followThrough.caution_signals : [])
      .map((signal) => text(signal?.id))
      .filter(Boolean),
  );
}

function planItems(plan, sectionKey) {
  return Array.isArray(plan?.[sectionKey]) ? plan[sectionKey] : [];
}

function itemRefs(item) {
  return unique(item?.source_signal_ids);
}

function sectionHasCoverage(plan, sectionKey, signalIds = [], pattern = null) {
  const wanted = new Set(unique(signalIds));
  return planItems(plan, sectionKey).some((item) => {
    const refs = itemRefs(item);
    const refsMatch = !wanted.size || refs.some((id) => wanted.has(id));
    if (!refsMatch) return false;
    if (!pattern) return true;
    return pattern.test(text(item?.text));
  });
}

function summaryHasCoverage(plan, signalIds = [], pattern = null) {
  const refs = new Set(unique(plan?.summary_signal_ids));
  const wanted = new Set(unique(signalIds));
  const refsMatch = !wanted.size || [...wanted].some((id) => refs.has(id));
  if (!refsMatch) return false;
  if (!pattern) return true;
  return pattern.test(text(plan?.summary_text));
}

function makeCaution(id, {
  label,
  detail,
  severity = "medium",
  signalIds = [],
  sectionKeys = [],
  guidance = null,
}) {
  return {
    id,
    label,
    detail,
    severity,
    signal_ids: unique(signalIds),
    section_keys: unique(sectionKeys),
    guidance: guidance || null,
  };
}

const REACHABILITY_PATTERN = /\b(call|contact|reach|reachable|welfare|answer|operator|dispatch|visit|check in|check-in)\b/i;
const MEDICATION_PATTERN = /\b(medication|medicines|dose|doses|adherence|reminder|take|taken|missed dose|schedule)\b/i;
const MOBILITY_PATTERN = /\b(fall|falls|mobility|walking|walker|wheelchair|balance|transfer|safe path|supervision|dizziness)\b/i;

export function buildHealthPlanClinicalCautions({
  sourceSignals = [],
  followThrough = null,
} = {}) {
  const byId = signalMap(sourceSignals);
  const cautionIds = followThroughIds(followThrough);
  const cautions = [];

  const alertSignal = byId.get("alert-active");
  const checkinSignal = byId.get("service-checkins");
  const brainSignal = byId.get("service-brain-coach");
  const medicationSignal = byId.get("medication-plan");
  const contextSignal = byId.get("context-live-profile");
  const careSignal = byId.get("care-circle-context");

  const reachabilityText = lower([
    alertSignal?.label,
    alertSignal?.detail,
    checkinSignal?.label,
    checkinSignal?.detail,
    brainSignal?.label,
    brainSignal?.detail,
  ].filter(Boolean).join(" "));
  const hasReachabilityRisk =
    /\bunreachable|no answer|no_response|not reporting|missed|pending|failed|unconfirmed\b/.test(reachabilityText)
    || cautionIds.has("no-fresh-touchpoints")
    || cautionIds.has("new-alerts-since-plan");
  if (hasReachabilityRisk) {
    cautions.push(makeCaution("reachability-risk", {
      label: "Reachability risk needs an explicit response path",
      detail: "The live record suggests missed contact, unresolved outreach, or no fresh follow-through.",
      severity: alertSignal?.strength === "high" || cautionIds.has("new-alerts-since-plan") ? "high" : "medium",
      signalIds: [alertSignal?.id, checkinSignal?.id, brainSignal?.id].filter(Boolean),
      sectionKeys: ["summary", "monitoring_json", "escalation_json"],
      guidance: "Name how staff will re-establish contact and what happens the same day if contact still fails.",
    }));
  }

  const medicationText = lower(`${medicationSignal?.label || ""} ${medicationSignal?.detail || ""}`);
  const hasMedicationRisk =
    /\bmissed|late|skipped|unconfirmed|off\b/.test(medicationText);
  if (hasMedicationRisk && medicationSignal) {
    cautions.push(makeCaution("medication-instability", {
      label: "Medication instability needs concrete adherence follow-up",
      detail: medicationSignal.detail || medicationSignal.label || "Medication follow-through appears unstable.",
      severity: /\bmissed|skipped|unconfirmed\b/.test(medicationText) ? "high" : "medium",
      signalIds: [medicationSignal.id],
      sectionKeys: ["daily_support_json", "monitoring_json", "escalation_json"],
      guidance: "Spell out how staff confirm doses, check the schedule, and escalate if adherence remains unclear.",
    }));
  }

  const mobilityText = lower([
    contextSignal?.label,
    contextSignal?.detail,
    careSignal?.label,
    careSignal?.detail,
  ].filter(Boolean).join(" "));
  const hasMobilityRisk = /\bfall|falls|mobility|walker|wheelchair|balance|transfer|dizz/i.test(mobilityText);
  if (hasMobilityRisk && (contextSignal || careSignal)) {
    cautions.push(makeCaution("mobility-fall-risk", {
      label: "Mobility or fall risk needs practical safety follow-through",
      detail: (contextSignal?.detail || careSignal?.detail || "The profile indicates mobility-related risk.").trim(),
      severity: /\bfall|falls|dizz/i.test(mobilityText) ? "high" : "medium",
      signalIds: [contextSignal?.id, careSignal?.id].filter(Boolean),
      sectionKeys: ["daily_support_json", "monitoring_json"],
      guidance: "Include concrete mobility checks, safe-environment actions, or supervision follow-through.",
    }));
  }

  return cautions;
}

function makeIssue(caution, sectionKey, message) {
  return {
    id: caution.id,
    section_key: sectionKey,
    severity: caution.severity,
    label: caution.label,
    detail: caution.detail,
    guidance: caution.guidance,
    signal_ids: caution.signal_ids,
    message,
  };
}

export function findHealthPlanClinicalCautionIssues(
  plan,
  {
    sourceSignals = [],
    followThrough = null,
    clinicalCautions = null,
  } = {},
) {
  const cautions = Array.isArray(clinicalCautions)
    ? clinicalCautions
    : buildHealthPlanClinicalCautions({ sourceSignals, followThrough });
  const issues = [];

  for (const caution of cautions) {
    if (caution.id === "reachability-risk") {
      if (!summaryHasCoverage(plan, caution.signal_ids, REACHABILITY_PATTERN)) {
        issues.push(makeIssue(caution, "summary", "The summary should acknowledge the reachability risk and the response path."));
      }
      if (!sectionHasCoverage(plan, "monitoring_json", caution.signal_ids, REACHABILITY_PATTERN)) {
        issues.push(makeIssue(caution, "monitoring_json", "Monitoring should say how staff track contact attempts or unanswered outreach."));
      }
      if (!sectionHasCoverage(plan, "escalation_json", caution.signal_ids, REACHABILITY_PATTERN)) {
        issues.push(makeIssue(caution, "escalation_json", "Escalation should name what happens if the client remains unreachable."));
      }
    }

    if (caution.id === "medication-instability") {
      if (!sectionHasCoverage(plan, "daily_support_json", caution.signal_ids, MEDICATION_PATTERN)
        && !sectionHasCoverage(plan, "monitoring_json", caution.signal_ids, MEDICATION_PATTERN)) {
        issues.push(makeIssue(caution, "daily_support_json", "The plan should include practical medication adherence follow-up."));
      }
      if (caution.severity === "high" && !sectionHasCoverage(plan, "escalation_json", caution.signal_ids, MEDICATION_PATTERN)) {
        issues.push(makeIssue(caution, "escalation_json", "High medication instability should have an explicit escalation path."));
      }
    }

    if (caution.id === "mobility-fall-risk") {
      if (!sectionHasCoverage(plan, "daily_support_json", caution.signal_ids, MOBILITY_PATTERN)
        && !sectionHasCoverage(plan, "monitoring_json", caution.signal_ids, MOBILITY_PATTERN)) {
        issues.push(makeIssue(caution, "daily_support_json", "Mobility or fall risk should show up in practical daily support or monitoring."));
      }
    }
  }

  return issues;
}
