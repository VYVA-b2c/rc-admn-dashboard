function text(value) {
  return String(value || "").trim();
}

function unique(values) {
  return [...new Set((Array.isArray(values) ? values : []).map(text).filter(Boolean))];
}

function normalizeStrength(value) {
  const normalized = text(value).toLowerCase();
  return ["high", "medium", "low"].includes(normalized) ? normalized : "medium";
}

const MONITORING_ACTION_PATTERN = /\b(check|confirm|verify|review|recheck|log|document|track|monitor|compare|observe)\b/i;
const ESCALATION_ACTION_PATTERN = /\b(call|contact|notify|escalat|review|check|confirm|verify|arrange|document|log|recheck|dispatch|reach|speak|book|schedule)\b/i;

export function repairOperationalHealthPlanLanguage(
  plan,
  { sourceSignals = [], signalTriage = {}, criticalSignalIds = [] } = {},
) {
  if (!plan) return plan;
  const sourceSignalStrength = new Map(
    (Array.isArray(sourceSignals) ? sourceSignals : [])
      .map((signal) => [text(signal?.id), normalizeStrength(signal?.strength)])
      .filter(([id]) => Boolean(id)),
  );
  const actionIds = new Set(unique(signalTriage?.action_signal_ids));
  const verificationIds = new Set(unique(signalTriage?.verification_signal_ids));
  const criticalIds = new Set(unique(criticalSignalIds));
  const needsConcreteMonitoringAction = (item) => {
    const refs = unique(item?.source_signal_ids);
    return refs.some((id) =>
      actionIds.has(id)
      || verificationIds.has(id)
      || criticalIds.has(id)
      || sourceSignalStrength.get(id) === "high"
    );
  };
  const repairEscalationItem = (item) => {
    const itemText = text(item?.text);
    if (
      !itemText
      || ESCALATION_ACTION_PATTERN.test(itemText)
      || !needsConcreteMonitoringAction(item)
    ) {
      return item;
    }
    return {
      ...item,
      text: `Contact the responsible care lead the same day and document the next action if this occurs: ${itemText}`,
      timing: item?.timing || "today",
      priority: item?.priority || "high",
      verification_required: item?.verification_required ?? true,
      completion_signal: item?.completion_signal || "Staff recorded who was contacted, when, and what follow-up action was agreed.",
    };
  };

  return {
    ...plan,
    monitoring_json: Array.isArray(plan.monitoring_json) ? plan.monitoring_json.map((item) => {
      const itemText = text(item?.text);
      if (
        !itemText
        || MONITORING_ACTION_PATTERN.test(itemText)
        || !needsConcreteMonitoringAction(item)
      ) {
        return item;
      }
      return {
        ...item,
        text: `Check and document this during the next staff review: ${itemText}`,
        verification_required: item?.verification_required ?? true,
        completion_signal: item?.completion_signal || "Staff recorded what was checked and whether follow-up is needed.",
      };
    }) : plan.monitoring_json,
    escalation_json: Array.isArray(plan.escalation_json)
      ? plan.escalation_json.map(repairEscalationItem)
      : plan.escalation_json,
  };
}

export function repairOperationalMonitoringLanguage(plan, options = {}) {
  return repairOperationalHealthPlanLanguage(plan, options);
}
