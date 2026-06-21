function text(value) {
  return String(value || "").trim();
}

function lower(value) {
  return text(value).toLowerCase();
}

function unique(values) {
  return [...new Set((Array.isArray(values) ? values : []).map((value) => text(value)).filter(Boolean))];
}

const ACTION_VERB_PATTERN = /\b(call|contact|notify|escalat|review|check|confirm|verify|arrange|document|log|recheck|dispatch|reach|speak|book|schedule)\b/i;
const MONITORING_VERB_PATTERN = /\b(check|confirm|verify|review|recheck|log|document|track|monitor|compare|observe)\b/i;
const SAME_DAY_PATTERN = /\b(today|same day|immediately|right away|now|before end of day|this morning|this afternoon|within \d+ (hour|hours))\b/i;
const VAGUE_PATTERN = /\b(as needed|if needed|if necessary|as appropriate|when appropriate|monitor closely|keep an eye on|support as usual|follow up appropriately)\b/i;
const CONTRADICTORY_REASSURANCE_PATTERN = /\b(no immediate concerns|no concerns|nothing urgent|fully stable|completely stable|well controlled|reassuring overall|no meaningful risk)\b/i;
const OVER_SHARING_PATTERN = /\bshare (all|full|complete) (details|information)|inform (the )?family of all details|update everyone with full details\b/i;

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

function refs(item) {
  return unique(item?.source_signal_ids);
}

function normalizeSectionKey(value) {
  const normalized = lower(value);
  if (normalized === "summary") return "summary";
  if (normalized === "goals") return "goals_json";
  if (normalized === "daily_support") return "daily_support_json";
  if (normalized === "monitoring") return "monitoring_json";
  if (normalized === "escalation") return "escalation_json";
  if (normalized === "caregiver_guidance") return "caregiver_guidance_json";
  return normalized;
}

function buildSignalContext(sourceSignals = [], signalTriage = {}, criticalSignalIds = []) {
  const signals = (Array.isArray(sourceSignals) ? sourceSignals : []).map(normalizeSignal).filter(Boolean);
  return {
    byId: new Map(signals.map((signal) => [signal.id, signal])),
    actionIds: new Set(unique(signalTriage?.action_signal_ids)),
    verificationIds: new Set(unique(signalTriage?.verification_signal_ids)),
    criticalIds: new Set(unique(criticalSignalIds)),
    consentSignal: signals.find((signal) => signal.id === "consent-family-sharing") || null,
  };
}

function linkedSignals(refIds, context) {
  return refIds.map((id) => context.byId.get(id)).filter(Boolean);
}

function hasHotSignal(refIds, context) {
  return refIds.some((id) => context.actionIds.has(id) || context.criticalIds.has(id) || context.byId.get(id)?.strength === "high");
}

function hasVerificationSignal(refIds, context) {
  return refIds.some((id) => context.verificationIds.has(id));
}

function makeIssue(sectionKey, message, index = null) {
  return {
    section_key: normalizeSectionKey(sectionKey),
    ...(index == null ? {} : { item_index: index }),
    message,
  };
}

export function findHealthPlanSafetyIssues(
  plan,
  {
    sourceSignals = [],
    signalTriage = {},
    criticalSignalIds = [],
  } = {},
) {
  const context = buildSignalContext(sourceSignals, signalTriage, criticalSignalIds);
  const issues = [];
  const summaryText = text(plan?.summary_text);
  const summaryRefs = unique(plan?.summary_signal_ids);
  const summaryHot = hasHotSignal(summaryRefs, context);

  if (summaryText && summaryHot && CONTRADICTORY_REASSURANCE_PATTERN.test(summaryText)) {
    issues.push(makeIssue("summary", "The summary sounds more reassuring than the strongest live signals allow."));
  }

  const sections = [
    ["goals_json", Array.isArray(plan?.goals_json) ? plan.goals_json : []],
    ["daily_support_json", Array.isArray(plan?.daily_support_json) ? plan.daily_support_json : []],
    ["monitoring_json", Array.isArray(plan?.monitoring_json) ? plan.monitoring_json : []],
    ["escalation_json", Array.isArray(plan?.escalation_json) ? plan.escalation_json : []],
    ["caregiver_guidance_json", Array.isArray(plan?.caregiver_guidance_json) ? plan.caregiver_guidance_json : []],
  ];

  for (const [sectionKey, items] of sections) {
    items.forEach((item, index) => {
      const itemText = text(item?.text);
      const itemRefs = refs(item);
      const itemSignals = linkedSignals(itemRefs, context);
      const itemHot = hasHotSignal(itemRefs, context);
      const itemNeedsVerification = hasVerificationSignal(itemRefs, context);
      const itemTiming = lower(item?.timing);

      if (!itemText) return;

      if (VAGUE_PATTERN.test(itemText) && !ACTION_VERB_PATTERN.test(itemText) && !MONITORING_VERB_PATTERN.test(itemText)) {
        issues.push(makeIssue(sectionKey, "This step is too vague to be operationally reliable. Make the action more concrete.", index));
      }

      if (sectionKey === "monitoring_json" && (itemHot || itemNeedsVerification) && !MONITORING_VERB_PATTERN.test(itemText)) {
        issues.push(makeIssue(sectionKey, "Monitoring guidance should say exactly what staff need to check, confirm, or document.", index));
      }

      if (sectionKey === "escalation_json") {
        if (itemHot && !ACTION_VERB_PATTERN.test(itemText)) {
          issues.push(makeIssue(sectionKey, "Escalation guidance should name the concrete response action, not just the condition.", index));
        }
        if (itemHot && itemTiming !== "today" && !SAME_DAY_PATTERN.test(itemText)) {
          issues.push(makeIssue(sectionKey, "Escalation guidance linked to high-risk signals should make the same-day timing explicit.", index));
        }
      }

      if (sectionKey === "caregiver_guidance_json") {
        const consentLimited = /\bnot confirmed|not granted|limited\b/.test(lower(`${context.consentSignal?.label} ${context.consentSignal?.detail}`));
        if (consentLimited && OVER_SHARING_PATTERN.test(itemText)) {
          issues.push(makeIssue(sectionKey, "Caregiver guidance goes beyond the current sharing boundary.", index));
        }
      }

      if (itemHot && CONTRADICTORY_REASSURANCE_PATTERN.test(itemText)) {
        issues.push(makeIssue(sectionKey, "This wording sounds too reassuring for the linked live signals.", index));
      }

      if (sectionKey === "daily_support_json" && itemSignals.length === 1 && itemSignals[0]?.id === "alert-active" && !ACTION_VERB_PATTERN.test(itemText)) {
        issues.push(makeIssue(sectionKey, "Daily support tied to an active alert should include a direct support action.", index));
      }
    });
  }

  return issues;
}
