function text(value) {
  return String(value || "").trim();
}

export const healthPlanReviewChecklistKeys = [
  "reachability_confirmed",
  "medication_risk_checked",
  "escalation_path_confirmed",
  "next_touchpoint_confirmed",
];

export const healthPlanLifeSafetyChecklistPrefix = "life_safety:";
export const healthPlanReviewChecklistAuditKeys = ["confirmed_at", "confirmed_by_user_id", "confirmed_by_email"];

function isObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function normalizeLifeSafetyConfirmations(value) {
  if (!isObject(value)) return {};
  return Object.entries(value).reduce((accumulator, [cautionId, entry]) => {
    const normalizedId = text(cautionId);
    if (!normalizedId) return accumulator;

    if (entry === true) {
      accumulator[normalizedId] = { confirmed: true, label: null, confirmed_at: null, confirmed_by_user_id: null, confirmed_by_email: null };
      return accumulator;
    }

    if (!isObject(entry)) return accumulator;
    accumulator[normalizedId] = {
      confirmed: entry.confirmed === true,
      label: text(entry.label) || null,
      confirmed_at: text(entry.confirmed_at) || null,
      confirmed_by_user_id: text(entry.confirmed_by_user_id) || null,
      confirmed_by_email: text(entry.confirmed_by_email) || null,
    };
    return accumulator;
  }, {});
}

function normalizeConfirmationAudit(value) {
  if (!isObject(value)) return {};
  return Object.entries(value).reduce((accumulator, [itemKey, entry]) => {
    const normalizedKey = text(itemKey);
    if (!normalizedKey || !isObject(entry)) return accumulator;
    accumulator[normalizedKey] = {
      label: text(entry.label) || null,
      confirmed_at: text(entry.confirmed_at) || null,
      confirmed_by_user_id: text(entry.confirmed_by_user_id) || null,
      confirmed_by_email: text(entry.confirmed_by_email) || null,
    };
    return accumulator;
  }, {});
}

function makeAuditEntry({
  label = null,
  confirmedAt = null,
  confirmedByUserId = null,
  confirmedByEmail = null,
} = {}) {
  return {
    label: text(label) || null,
    confirmed_at: text(confirmedAt) || null,
    confirmed_by_user_id: text(confirmedByUserId) || null,
    confirmed_by_email: text(confirmedByEmail) || null,
  };
}

export function buildHealthPlanLifeSafetyReviewItems({
  clinicalCautions = [],
} = {}) {
  return (Array.isArray(clinicalCautions) ? clinicalCautions : [])
    .filter((caution) => isObject(caution) && text(caution.id) && text(caution.severity) === "high")
    .map((caution) => ({
      key: `${healthPlanLifeSafetyChecklistPrefix}${text(caution.id)}`,
      caution_id: text(caution.id),
      label: `Life-safety check: ${text(caution.label)}`,
      detail: text(caution.detail) || null,
      guidance: text(caution.guidance) || null,
    }));
}

export function normalizeHealthPlanReviewChecklist(value) {
  const source = value && typeof value === "object" ? value : {};
  return {
    reachability_confirmed: source.reachability_confirmed === true,
    medication_risk_checked: source.medication_risk_checked === true,
    escalation_path_confirmed: source.escalation_path_confirmed === true,
    next_touchpoint_confirmed: source.next_touchpoint_confirmed === true,
    note: text(source.note) || null,
    life_safety_confirmations: normalizeLifeSafetyConfirmations(source.life_safety_confirmations),
    confirmation_audit: normalizeConfirmationAudit(source.confirmation_audit),
  };
}

export function applyHealthPlanReviewChecklistAudit(
  value,
  {
    previousChecklist = null,
    reviewedAt = null,
    actorUserId = null,
    actorEmail = null,
    actionType = "reviewed",
  } = {},
) {
  const checklist = normalizeHealthPlanReviewChecklist(value);
  const previous = normalizeHealthPlanReviewChecklist(previousChecklist);
  const stampedAt = text(reviewedAt) || null;
  const stampedByUserId = text(actorUserId) || null;
  const stampedByEmail = text(actorEmail) || null;
  const nextAudit = {};

  for (const key of healthPlanReviewChecklistKeys) {
    if (checklist[key] !== true) continue;
    const previousAudit = previous.confirmation_audit?.[key];
    nextAudit[key] = actionType === "reviewed"
      ? makeAuditEntry({
        label: previousAudit?.label || null,
        confirmedAt: stampedAt,
        confirmedByUserId: stampedByUserId,
        confirmedByEmail: stampedByEmail,
      })
      : makeAuditEntry({
        label: previousAudit?.label || null,
        confirmedAt: previousAudit?.confirmed_at || stampedAt,
        confirmedByUserId: previousAudit?.confirmed_by_user_id || stampedByUserId,
        confirmedByEmail: previousAudit?.confirmed_by_email || stampedByEmail,
      });
  }

  const nextLifeSafetyConfirmations = Object.entries(checklist.life_safety_confirmations || {}).reduce((accumulator, [cautionId, entry]) => {
    const previousEntry = previous.life_safety_confirmations?.[cautionId];
    const label = text(entry?.label) || text(previousEntry?.label) || null;
    if (entry?.confirmed !== true) {
      accumulator[cautionId] = {
        confirmed: false,
        label,
        confirmed_at: null,
        confirmed_by_user_id: null,
        confirmed_by_email: null,
      };
      return accumulator;
    }

    const auditedEntry = actionType === "reviewed"
      ? {
        confirmed: true,
        label,
        confirmed_at: stampedAt,
        confirmed_by_user_id: stampedByUserId,
        confirmed_by_email: stampedByEmail,
      }
      : {
        confirmed: true,
        label,
        confirmed_at: previousEntry?.confirmed_at || stampedAt,
        confirmed_by_user_id: previousEntry?.confirmed_by_user_id || stampedByUserId,
        confirmed_by_email: previousEntry?.confirmed_by_email || stampedByEmail,
      };
    accumulator[cautionId] = auditedEntry;
    return accumulator;
  }, {});

  return {
    ...checklist,
    life_safety_confirmations: nextLifeSafetyConfirmations,
    confirmation_audit: nextAudit,
  };
}

export function missingHealthPlanReviewChecklistItems(value, options = {}) {
  const checklist = normalizeHealthPlanReviewChecklist(value);
  const missing = healthPlanReviewChecklistKeys.filter((key) => checklist[key] !== true);
  const requiredLifeSafetyItems = buildHealthPlanLifeSafetyReviewItems(options);

  for (const item of requiredLifeSafetyItems) {
    if (checklist.life_safety_confirmations?.[item.caution_id]?.confirmed !== true) {
      missing.push(item.key);
    }
  }

  return missing;
}

export function isHealthPlanReviewChecklistComplete(value, options = {}) {
  return missingHealthPlanReviewChecklistItems(value, options).length === 0;
}
