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

function normalizeSignal(signal) {
  const id = text(signal?.id);
  if (!id) return null;
  return {
    id,
    label: text(signal?.label) || id,
    detail: text(signal?.detail),
    category: text(signal?.category).toLowerCase() || "context",
    strength: normalizeStrength(signal?.strength),
  };
}

function itemRefs(item) {
  return unique(item?.source_signal_ids);
}

function sectionHasAnyRef(items, ids) {
  const wanted = new Set(unique(ids));
  if (!wanted.size) return false;
  return (Array.isArray(items) ? items : []).some((item) => itemRefs(item).some((id) => wanted.has(id)));
}

const MONITORING_ACTION_PATTERN = /\b(check|confirm|verify|review|recheck|log|document|track|monitor|compare|observe)\b/i;
const ESCALATION_ACTION_PATTERN = /\b(call|contact|notify|escalat|review|check|confirm|verify|arrange|document|log|recheck|dispatch|reach|speak|book|schedule)\b/i;

export function repairOperationalHealthPlanLanguage(
  plan,
  { sourceSignals = [], signalTriage = {}, criticalSignalIds = [] } = {},
) {
  if (!plan) return plan;
  const signals = (Array.isArray(sourceSignals) ? sourceSignals : []).map(normalizeSignal).filter(Boolean);
  const signalsById = new Map(signals.map((signal) => [signal.id, signal]));
  const validSignalIds = new Set(signals.map((signal) => signal.id));
  const sourceSignalStrength = new Map(
    signals.map((signal) => [signal.id, signal.strength]),
  );
  const validUnique = (values) => unique(values).filter((id) => validSignalIds.has(id));
  const actionIds = new Set(validUnique(signalTriage?.action_signal_ids));
  const verificationIds = new Set(validUnique(signalTriage?.verification_signal_ids));
  const stabilizingIds = new Set(validUnique(signalTriage?.stabilizing_signal_ids));
  const criticalIds = new Set(validUnique(criticalSignalIds));
  const highSignalIds = new Set(signals.filter((signal) => signal.strength === "high").map((signal) => signal.id));
  const needsConcreteMonitoringAction = (item) => {
    const refs = unique(item?.source_signal_ids);
    return refs.some((id) =>
      actionIds.has(id)
      || verificationIds.has(id)
      || criticalIds.has(id)
      || highSignalIds.has(id)
    );
  };
  const signalLabel = (id) => signalsById.get(id)?.label || id;
  const ensureRefs = (ids) => validUnique(ids).slice(0, 3);
  const appendIfMissing = (items, ids, builder) => {
    const refs = ensureRefs(ids);
    const normalizedItems = Array.isArray(items) ? [...items] : [];
    if (!refs.length || sectionHasAnyRef(normalizedItems, refs)) return normalizedItems;
    normalizedItems.push(builder(refs));
    return normalizedItems;
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
      owner_role: item?.owner_role || "care_team",
      fallback_owner_role: item?.fallback_owner_role || "on_call_coordinator",
      verification_required: item?.verification_required ?? true,
      completion_signal: item?.completion_signal || "Staff recorded who was contacted, when, and what follow-up action was agreed.",
    };
  };
  const medicationId = validSignalIds.has("medication-plan") ? "medication-plan" : null;
  const checkinId = validSignalIds.has("service-checkins") ? "service-checkins" : null;
  const brainCoachId = validSignalIds.has("service-brain-coach") ? "service-brain-coach" : null;
  const sensorId = validSignalIds.has("sensor-status") ? "sensor-status" : null;
  const alertId = validSignalIds.has("alert-active") ? "alert-active" : null;
  const consentId = validSignalIds.has("consent-family-sharing") ? "consent-family-sharing" : null;
  const careCircleId = validSignalIds.has("care-circle-context") ? "care-circle-context" : null;

  const monitoringRequiredIds = [
    ...actionIds,
    ...verificationIds,
    ...criticalIds,
    ...highSignalIds,
    medicationId,
    checkinId,
    brainCoachId,
    sensorId,
  ].filter(Boolean);
  const escalationRequiredIds = [
    ...criticalIds,
    ...actionIds,
    alertId,
    sourceSignalStrength.get(sensorId) === "high" ? sensorId : null,
  ].filter(Boolean);
  const dailySupportRequiredIds = [
    ...stabilizingIds,
    medicationId,
    checkinId,
    brainCoachId,
  ].filter(Boolean);

  const repaired = {
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
        timing: item?.timing || "today",
        priority: item?.priority || "high",
        owner_role: item?.owner_role || "assigned_staff",
        verification_required: item?.verification_required ?? true,
        completion_signal: item?.completion_signal || "Staff recorded what was checked and whether follow-up is needed.",
      };
    }) : plan.monitoring_json,
    escalation_json: Array.isArray(plan.escalation_json)
      ? plan.escalation_json.map(repairEscalationItem)
      : plan.escalation_json,
  };
  repaired.monitoring_json = appendIfMissing(repaired.monitoring_json, monitoringRequiredIds, (refs) => ({
    text: `Check and document ${refs.map(signalLabel).join(", ")} today, then note whether follow-up is needed.`,
    source_signal_ids: refs,
    timing: "today",
    priority: refs.some((id) => criticalIds.has(id) || actionIds.has(id) || highSignalIds.has(id)) ? "high" : "medium",
    owner_role: "assigned_staff",
    verification_required: refs.some((id) => verificationIds.has(id) || criticalIds.has(id) || highSignalIds.has(id)),
    completion_signal: "Staff recorded what was checked, what changed, and whether follow-up is needed.",
  }));
  repaired.escalation_json = appendIfMissing(repaired.escalation_json, escalationRequiredIds, (refs) => ({
    text: `If ${refs.map(signalLabel).join(", ")} remains unresolved today, contact the responsible care lead and document the agreed next action.`,
    source_signal_ids: refs,
    timing: "today",
    priority: "high",
    owner_role: "care_team",
    fallback_owner_role: "on_call_coordinator",
    verification_required: true,
    completion_signal: "Staff recorded who was contacted, when, and what next action was agreed.",
  }));
  repaired.daily_support_json = appendIfMissing(repaired.daily_support_json, dailySupportRequiredIds, (refs) => ({
    text: `Keep ${refs.map(signalLabel).join(", ")} visible in daily support, and record whether the routine was completed as expected.`,
    source_signal_ids: refs,
    timing: "today",
    priority: "medium",
    owner_role: "assigned_staff",
    completion_signal: "Staff recorded whether the daily routine was completed or needs follow-up.",
  }));
  repaired.caregiver_guidance_json = appendIfMissing(repaired.caregiver_guidance_json, consentId ? [consentId] : [], (refs) => ({
    text: "Before sharing details with caregivers, confirm the current family-sharing boundary and document what can be shared.",
    source_signal_ids: refs,
    timing: "this_week",
    priority: "medium",
    owner_role: "care_team",
    completion_signal: "Staff documented the sharing boundary before caregiver outreach.",
  }));
  repaired.goals_json = appendIfMissing(repaired.goals_json, careCircleId ? [careCircleId] : [], (refs) => ({
    text: "Keep care coverage clear by confirming who is actively supporting the client and documenting any gap.",
    source_signal_ids: refs,
    timing: "this_week",
    priority: "medium",
    owner_role: "care_team",
    completion_signal: "Staff documented current care coverage and any missing support.",
  }));
  const summaryActionIds = ensureRefs([...actionIds]);
  if (summaryActionIds.length) {
    repaired.summary_signal_ids = unique([
      ...(Array.isArray(repaired.summary_signal_ids) ? repaired.summary_signal_ids : []),
      ...summaryActionIds,
    ]);
  }
  return repaired;
}

export function repairOperationalMonitoringLanguage(plan, options = {}) {
  return repairOperationalHealthPlanLanguage(plan, options);
}
