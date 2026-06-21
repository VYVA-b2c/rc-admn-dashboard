const SECTION_KEYS = [
  "summary",
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

function normalizeSectionKey(value) {
  const normalized = lower(value);
  if (normalized === "summary") return "summary";
  if (normalized === "goals") return "goals_json";
  if (normalized === "daily_support") return "daily_support_json";
  if (normalized === "monitoring") return "monitoring_json";
  if (normalized === "escalation") return "escalation_json";
  if (normalized === "caregiver_guidance") return "caregiver_guidance_json";
  return SECTION_KEYS.includes(normalized) ? normalized : null;
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

function uniqueSignalIds(values, sourceSignalIds) {
  return unique(values).filter((id) => sourceSignalIds.has(id));
}

function findSignal(sourceSignals, id) {
  return sourceSignals.find((signal) => signal?.id === id) || null;
}

function buildRule(id, sectionKeys, signalIds, message) {
  const normalizedSectionKeys = unique(sectionKeys.map(normalizeSectionKey).filter(Boolean));
  const normalizedSignalIds = unique(signalIds);
  if (!normalizedSectionKeys.length || !normalizedSignalIds.length) return null;
  return {
    id,
    section_keys: normalizedSectionKeys,
    signal_ids: normalizedSignalIds,
    message,
  };
}

function sectionRefLookup(plan = {}) {
  const summaryRefs = unique(plan?.summary_signal_ids);
  return {
    summary: new Set(summaryRefs),
    goals_json: new Set(unique((Array.isArray(plan?.goals_json) ? plan.goals_json : []).flatMap((item) => item?.source_signal_ids || []))),
    daily_support_json: new Set(unique((Array.isArray(plan?.daily_support_json) ? plan.daily_support_json : []).flatMap((item) => item?.source_signal_ids || []))),
    monitoring_json: new Set(unique((Array.isArray(plan?.monitoring_json) ? plan.monitoring_json : []).flatMap((item) => item?.source_signal_ids || []))),
    escalation_json: new Set(unique((Array.isArray(plan?.escalation_json) ? plan.escalation_json : []).flatMap((item) => item?.source_signal_ids || []))),
    caregiver_guidance_json: new Set(unique((Array.isArray(plan?.caregiver_guidance_json) ? plan.caregiver_guidance_json : []).flatMap((item) => item?.source_signal_ids || []))),
  };
}

export function buildHealthPlanCoverageRules({ sourceSignals = [], signalTriage = {}, criticalSignalIds = [] } = {}) {
  const normalizedSignals = (Array.isArray(sourceSignals) ? sourceSignals : []).map(normalizeSignal).filter(Boolean);
  const sourceSignalIds = new Set(normalizedSignals.map((signal) => signal.id));
  const actionSignalIds = uniqueSignalIds(signalTriage?.action_signal_ids, sourceSignalIds);
  const verificationSignalIds = uniqueSignalIds(signalTriage?.verification_signal_ids, sourceSignalIds);
  const stabilizingSignalIds = uniqueSignalIds(signalTriage?.stabilizing_signal_ids, sourceSignalIds);
  const criticalIds = uniqueSignalIds(criticalSignalIds, sourceSignalIds);
  const rules = [];

  const alertSignal = findSignal(normalizedSignals, "alert-active");
  const sensorSignal = findSignal(normalizedSignals, "sensor-status");
  const medicationSignal = findSignal(normalizedSignals, "medication-plan");
  const checkinsSignal = findSignal(normalizedSignals, "service-checkins");
  const brainCoachSignal = findSignal(normalizedSignals, "service-brain-coach");
  const consentSignal = findSignal(normalizedSignals, "consent-family-sharing");
  const careCircleSignal = findSignal(normalizedSignals, "care-circle-context");

  if (actionSignalIds.length) {
    rules.push(buildRule(
      "summary-action-coverage",
      ["summary"],
      actionSignalIds,
      "The summary must stay grounded in the strongest action-driving signals.",
    ));
    rules.push(buildRule(
      "response-path-action-coverage",
      ["monitoring_json", "escalation_json"],
      actionSignalIds,
      "Monitoring or escalation must address the strongest action-driving signals.",
    ));
  }

  if (verificationSignalIds.length) {
    rules.push(buildRule(
      "monitoring-verification-coverage",
      ["monitoring_json"],
      verificationSignalIds,
      "Monitoring must include the signals that still need confirmation or re-checking.",
    ));
  }

  if (stabilizingSignalIds.length) {
    rules.push(buildRule(
      "routine-stabilizing-coverage",
      ["goals_json", "daily_support_json"],
      stabilizingSignalIds,
      "Goals or daily support should preserve the routines that are still helping.",
    ));
  }

  if (criticalIds.length) {
    rules.push(buildRule(
      "critical-escalation-coverage",
      ["escalation_json"],
      criticalIds,
      "Escalation must clearly cover the critical client signals.",
    ));
  }

  if (medicationSignal) {
    rules.push(buildRule(
      "medication-routine-coverage",
      ["daily_support_json", "monitoring_json"],
      [medicationSignal.id],
      "Medication follow-through should appear in daily support or monitoring.",
    ));
  }

  if (checkinsSignal || brainCoachSignal) {
    rules.push(buildRule(
      "service-routine-coverage",
      ["daily_support_json", "monitoring_json"],
      [checkinsSignal?.id, brainCoachSignal?.id],
      "Check-in or Brain Coach service timing should be reflected in daily support or monitoring.",
    ));
  }

  if (alertSignal || (sensorSignal && sensorSignal.strength === "high")) {
    rules.push(buildRule(
      "same-day-escalation-coverage",
      ["escalation_json"],
      [alertSignal?.id, sensorSignal?.id],
      "Escalation should make the same-day response path clear when alerts or sensor reliability are fragile.",
    ));
  }

  if (sensorSignal) {
    rules.push(buildRule(
      "sensor-monitoring-coverage",
      ["monitoring_json"],
      [sensorSignal.id],
      "Monitoring should include sensor visibility when sensors are linked.",
    ));
  }

  if (consentSignal && /\bnot confirmed|not granted|limited\b/.test(lower(`${consentSignal.label} ${consentSignal.detail}`))) {
    rules.push(buildRule(
      "sharing-boundary-coverage",
      ["caregiver_guidance_json"],
      [consentSignal.id],
      "Caregiver guidance must respect the current sharing boundary when consent is not confirmed.",
    ));
  }

  if (careCircleSignal && /\bno care provider|no assigned\b/.test(lower(`${careCircleSignal.label} ${careCircleSignal.detail}`))) {
    rules.push(buildRule(
      "care-circle-gap-coverage",
      ["caregiver_guidance_json", "goals_json"],
      [careCircleSignal.id],
      "The plan should acknowledge when there is no active care-circle coverage on file.",
    ));
  }

  return rules.filter(Boolean);
}

export function findHealthPlanCoverageIssues(
  plan,
  { sourceSignals = [], signalTriage = {}, criticalSignalIds = [] } = {},
  options = {},
) {
  const rules = buildHealthPlanCoverageRules({ sourceSignals, signalTriage, criticalSignalIds });
  const refsBySection = sectionRefLookup(plan);
  const selectedSections = new Set(
    unique(options?.targetSections).map(normalizeSectionKey).filter(Boolean),
  );

  return rules
    .filter((rule) => !selectedSections.size || rule.section_keys.some((sectionKey) => selectedSections.has(sectionKey)))
    .map((rule) => {
      const covered = rule.section_keys.some((sectionKey) => {
        const refs = refsBySection[sectionKey] || new Set();
        return rule.signal_ids.some((signalId) => refs.has(signalId));
      });
      return covered
        ? null
        : {
            id: rule.id,
            section_keys: rule.section_keys,
            signal_ids: rule.signal_ids,
            message: rule.message,
          };
    })
    .filter(Boolean);
}
