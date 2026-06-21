const SECTION_KEYS = [
  "goals_json",
  "daily_support_json",
  "monitoring_json",
  "escalation_json",
  "caregiver_guidance_json",
];

function text(value) {
  return String(value || "").trim();
}

function unique(values) {
  return [...new Set((Array.isArray(values) ? values : []).map((value) => text(value)).filter(Boolean))];
}

function normalizeSignalStrength(value) {
  const normalized = text(value).toLowerCase();
  if (normalized === "high" || normalized === "low") return normalized;
  return "medium";
}

function normalizePriority(value) {
  const normalized = text(value).toLowerCase();
  if (normalized === "high" || normalized === "medium" || normalized === "low") return normalized;
  return null;
}

function normalizeConfidence(value) {
  const normalized = text(value).toLowerCase();
  if (normalized === "high" || normalized === "medium" || normalized === "low") return normalized;
  return null;
}

function normalizeTiming(value) {
  const normalized = text(value).toLowerCase();
  if (normalized === "today" || normalized === "this_week" || normalized === "ongoing") return normalized;
  return null;
}

function normalizeFallbackOwnerRole(value) {
  const normalized = text(value).toLowerCase();
  if (normalized === "assigned_staff" || normalized === "caregiver" || normalized === "on_call_coordinator" || normalized === "care_team") {
    return normalized;
  }
  return null;
}

function normalizeOwnerRole(value) {
  return normalizeFallbackOwnerRole(value);
}

function normalizeCompletionSignal(value) {
  const normalized = text(value);
  return normalized || null;
}

function normalizeSectionKey(value) {
  const normalized = text(value).toLowerCase();
  if (normalized === "goals") return "goals_json";
  if (normalized === "daily_support") return "daily_support_json";
  if (normalized === "monitoring") return "monitoring_json";
  if (normalized === "escalation") return "escalation_json";
  if (normalized === "caregiver_guidance") return "caregiver_guidance_json";
  return SECTION_KEYS.includes(normalized) ? normalized : "goals_json";
}

function categorySet(signals) {
  return new Set(signals.map((signal) => text(signal?.category).toLowerCase()).filter(Boolean));
}

function buildSignalContext(sourceSignals = [], signalTriage = {}) {
  const signals = Array.isArray(sourceSignals) ? sourceSignals : [];
  return {
    byId: new Map(
      signals
        .map((signal) => {
          const id = text(signal?.id);
          if (!id) return null;
          return [
            id,
            {
              ...signal,
              id,
              category: text(signal?.category).toLowerCase() || "context",
              strength: normalizeSignalStrength(signal?.strength),
            },
          ];
        })
        .filter(Boolean),
    ),
    actionIds: new Set(unique(signalTriage?.action_signal_ids)),
    verificationIds: new Set(unique(signalTriage?.verification_signal_ids)),
    stabilizingIds: new Set(unique(signalTriage?.stabilizing_signal_ids)),
    cautionIds: new Set(unique(signalTriage?.caution_signal_ids)),
  };
}

function inferPriority(sectionKey, linkedSignals, refs, context) {
  const highSignals = linkedSignals.filter((signal) => signal.strength === "high").length;
  const mediumSignals = linkedSignals.filter((signal) => signal.strength === "medium").length;
  const hasAction = refs.some((id) => context.actionIds.has(id));
  const hasVerification = refs.some((id) => context.verificationIds.has(id));
  const hasStabilizing = refs.some((id) => context.stabilizingIds.has(id));

  if (sectionKey === "escalation_json") {
    if (hasAction || highSignals > 0) return "high";
    if (hasVerification || mediumSignals > 0) return "medium";
    return "low";
  }

  if (sectionKey === "monitoring_json") {
    if (hasAction || hasVerification || highSignals > 0) return "high";
    if (hasStabilizing || mediumSignals > 0) return "medium";
    return "low";
  }

  if (sectionKey === "daily_support_json") {
    if ((hasAction && hasVerification) || highSignals > 1) return "high";
    if (hasAction || hasStabilizing || highSignals > 0 || mediumSignals > 0) return "medium";
    return "low";
  }

  if (sectionKey === "caregiver_guidance_json") {
    if (hasAction || hasVerification) return "high";
    if (hasStabilizing || mediumSignals > 0) return "medium";
    return "low";
  }

  if (hasAction || highSignals > 0) return "high";
  if (hasStabilizing || mediumSignals > 0) return "medium";
  return "low";
}

function inferConfidence(linkedSignals, refs, context) {
  const highSignals = linkedSignals.filter((signal) => signal.strength === "high").length;
  const categories = categorySet(linkedSignals);
  const hasVerification = refs.some((id) => context.verificationIds.has(id));

  if (refs.length >= 2 && (highSignals > 0 || categories.size >= 2)) return "high";
  if (refs.length >= 2) return "medium";
  if (refs.length === 1 && linkedSignals[0]?.strength === "high") return "medium";
  if (refs.length === 1 && (hasVerification || linkedSignals[0]?.strength === "medium")) return "medium";
  return "low";
}

function inferTiming(sectionKey, linkedSignals, refs, context) {
  const hasAction = refs.some((id) => context.actionIds.has(id));
  const hasVerification = refs.some((id) => context.verificationIds.has(id));
  const hasCaution = refs.some((id) => context.cautionIds.has(id));
  const highSignals = linkedSignals.some((signal) => signal.strength === "high");

  if (sectionKey === "escalation_json") return hasAction || highSignals ? "today" : "this_week";
  if (sectionKey === "monitoring_json") return hasAction || hasVerification || hasCaution || highSignals ? "today" : "ongoing";
  if (sectionKey === "daily_support_json") return hasAction || hasVerification ? "today" : "ongoing";
  if (sectionKey === "caregiver_guidance_json") return hasAction || hasVerification ? "today" : "this_week";
  if (sectionKey === "goals_json") return hasAction || hasVerification || highSignals ? "this_week" : "ongoing";
  return "ongoing";
}

function inferVerificationRequired(sectionKey, linkedSignals, refs, context, priority, timing) {
  const hasVerification = refs.some((id) => context.verificationIds.has(id));
  const hasAction = refs.some((id) => context.actionIds.has(id));
  const hasHighSignal = linkedSignals.some((signal) => signal.strength === "high");
  const urgent = priority === "high" || timing === "today";
  if (sectionKey === "monitoring_json") return urgent || hasVerification || hasAction || hasHighSignal;
  if (sectionKey === "escalation_json") return urgent || hasVerification || hasAction;
  if (sectionKey === "caregiver_guidance_json") return urgent || hasVerification;
  if (sectionKey === "daily_support_json") return hasVerification && urgent;
  return urgent && hasVerification;
}

function inferFallbackOwnerRole(sectionKey, linkedSignals, refs, context, priority, timing) {
  const hasAction = refs.some((id) => context.actionIds.has(id));
  const hasVerification = refs.some((id) => context.verificationIds.has(id));
  const categories = categorySet(linkedSignals);
  const urgent = priority === "high" || timing === "today";

  if (sectionKey === "escalation_json" && urgent) {
    if (categories.has("care-circle")) return "caregiver";
    if (categories.has("alert") || categories.has("risk")) return "on_call_coordinator";
    return "assigned_staff";
  }
  if (sectionKey === "monitoring_json" && urgent && (hasAction || hasVerification)) {
    return "assigned_staff";
  }
  if (sectionKey === "caregiver_guidance_json" && (urgent || categories.has("care-circle"))) {
    return categories.has("care-circle") ? "caregiver" : "care_team";
  }
  return null;
}

function inferOwnerRole(sectionKey, linkedSignals, refs, context, priority, timing) {
  const categories = categorySet(linkedSignals);
  const urgent = priority === "high" || timing === "today";
  const hasAction = refs.some((id) => context.actionIds.has(id));
  const hasVerification = refs.some((id) => context.verificationIds.has(id));

  if (sectionKey === "caregiver_guidance_json") {
    return categories.has("care-circle") ? "caregiver" : "care_team";
  }
  if (sectionKey === "escalation_json") {
    if (urgent && (categories.has("alert") || categories.has("risk"))) return "on_call_coordinator";
    return "assigned_staff";
  }
  if (sectionKey === "monitoring_json") {
    return urgent || hasAction || hasVerification ? "assigned_staff" : "care_team";
  }
  if (sectionKey === "daily_support_json") {
    if (categories.has("care-circle") && !hasAction) return "caregiver";
    return "assigned_staff";
  }
  if (sectionKey === "goals_json" && urgent) return "assigned_staff";
  return null;
}

function inferCompletionSignal(sectionKey, linkedSignals, refs, context, priority, timing) {
  const categories = categorySet(linkedSignals);
  const hasAction = refs.some((id) => context.actionIds.has(id));
  const hasVerification = refs.some((id) => context.verificationIds.has(id));
  const urgent = priority === "high" || timing === "today";

  if (sectionKey === "escalation_json") {
    return urgent
      ? "Close the loop once the responder is reached and the fallback route is either activated or ruled out."
      : "Document who takes over if the first response path does not resolve the concern.";
  }
  if (sectionKey === "monitoring_json") {
    return urgent || hasVerification || hasAction
      ? "Close the loop by recording what was confirmed, what stayed uncertain, and whether today's risk picture changed."
      : "Document the next confirmed re-check and any meaningful change in the live signal pattern.";
  }
  if (sectionKey === "caregiver_guidance_json") {
    return categories.has("care-circle") || urgent
      ? "Close the loop once the caregiver reports back what they observed and staff log the next step."
      : "Document what the care circle noticed and whether staff need to follow up.";
  }
  if (sectionKey === "daily_support_json") {
    return urgent || hasVerification
      ? "Mark this complete once the routine happened and the client's response was documented."
      : "Review whether the routine still helped and note any change in response.";
  }
  if (sectionKey === "goals_json") {
    return urgent
      ? "Review by the end of today's follow-up whether this goal is actively being stabilized."
      : "Review at the next check whether this goal is still moving in the right direction.";
  }
  return null;
}

export function enrichHealthPlanSectionItems(items = [], { sectionKey, sourceSignals = [], signalTriage = {} } = {}) {
  const normalizedSectionKey = normalizeSectionKey(sectionKey);
  const context = buildSignalContext(sourceSignals, signalTriage);

  return (Array.isArray(items) ? items : [])
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const refs = unique(item.source_signal_ids);
      const linkedSignals = refs.map((id) => context.byId.get(id)).filter(Boolean);
      const priority = normalizePriority(item.priority) || inferPriority(normalizedSectionKey, linkedSignals, refs, context);
      const confidence = normalizeConfidence(item.confidence) || inferConfidence(linkedSignals, refs, context);
      const timing = normalizeTiming(item.timing) || inferTiming(normalizedSectionKey, linkedSignals, refs, context);
      const verificationRequired = typeof item.verification_required === "boolean"
        ? item.verification_required
        : inferVerificationRequired(normalizedSectionKey, linkedSignals, refs, context, priority, timing);
      const completionSignal = normalizeCompletionSignal(item.completion_signal)
        || inferCompletionSignal(normalizedSectionKey, linkedSignals, refs, context, priority, timing);
      const ownerRole = normalizeOwnerRole(item.owner_role)
        || inferOwnerRole(normalizedSectionKey, linkedSignals, refs, context, priority, timing);
      const fallbackOwnerRole = normalizeFallbackOwnerRole(item.fallback_owner_role)
        || inferFallbackOwnerRole(normalizedSectionKey, linkedSignals, refs, context, priority, timing);

      return {
        ...item,
        ...(refs.length ? { source_signal_ids: refs } : {}),
        priority,
        confidence,
        timing,
        ...(typeof verificationRequired === "boolean" ? { verification_required: verificationRequired } : {}),
        ...(completionSignal ? { completion_signal: completionSignal } : {}),
        ...(ownerRole ? { owner_role: ownerRole } : {}),
        ...(fallbackOwnerRole ? { fallback_owner_role: fallbackOwnerRole } : {}),
      };
    })
    .filter(Boolean);
}

export function enrichHealthPlanSections(sectionMap = {}, { sourceSignals = [], signalTriage = {} } = {}) {
  return SECTION_KEYS.reduce((result, sectionKey) => {
    result[sectionKey] = enrichHealthPlanSectionItems(sectionMap?.[sectionKey], {
      sectionKey,
      sourceSignals,
      signalTriage,
    });
    return result;
  }, {});
}
