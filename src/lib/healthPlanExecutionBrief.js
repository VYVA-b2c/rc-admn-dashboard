const ACTIONABLE_SECTION_DEFINITIONS = [
  {
    section_key: "escalation_json",
    section_label: "Escalation",
    default_owner_role: "assigned_staff",
    urgent_owner_role: "on_call_coordinator",
    live_domains: ["contact_pressure", "sensor_reliability", "medication_adherence"],
    section_score: 6,
  },
  {
    section_key: "monitoring_json",
    section_label: "Monitoring",
    default_owner_role: "assigned_staff",
    urgent_owner_role: "assigned_staff",
    live_domains: ["contact_pressure", "medication_adherence", "sensor_reliability", "service_engagement"],
    section_score: 5,
  },
  {
    section_key: "daily_support_json",
    section_label: "Daily support",
    default_owner_role: "assigned_staff",
    urgent_owner_role: "assigned_staff",
    live_domains: ["service_engagement", "medication_adherence", "contact_pressure"],
    section_score: 4,
  },
  {
    section_key: "caregiver_guidance_json",
    section_label: "Caregiver guidance",
    default_owner_role: "caregiver",
    urgent_owner_role: "caregiver",
    live_domains: ["contact_pressure", "medication_adherence"],
    section_score: 4,
  },
];

function text(value) {
  return String(value || "").trim();
}

function lower(value) {
  return text(value).toLowerCase();
}

function objectValue(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function unique(values) {
  return [...new Set((Array.isArray(values) ? values : []).map((value) => text(value)).filter(Boolean))];
}

function normalizePriority(value) {
  if (value === "high" || value === "medium") return value;
  return "low";
}

function normalizeWindow(value) {
  if (value === "today" || value === "this_week") return value;
  return "ongoing";
}

function priorityScore(value) {
  if (value === "high") return 8;
  if (value === "medium") return 4;
  return 1;
}

function responseWindowScore(value) {
  if (value === "today") return 7;
  if (value === "this_week") return 3;
  return 1;
}

function validOwnerRole(value) {
  return ["assigned_staff", "caregiver", "on_call_coordinator", "care_team"].includes(lower(value))
    ? lower(value)
    : null;
}

function ownerRoleFor(definition, item, reviewItem = null, escalationGrade = null) {
  const explicit = validOwnerRole(item?.owner_role);
  if (explicit) return explicit;
  if (definition.section_key === "caregiver_guidance_json") return "caregiver";
  if (definition.section_key === "escalation_json" && lower(escalationGrade?.grade) === "urgent") {
    return definition.urgent_owner_role;
  }
  if (normalizeWindow(reviewItem?.response_window) === "today" && definition.section_key === "escalation_json") {
    return definition.urgent_owner_role;
  }
  return definition.default_owner_role;
}

function fallbackOwnerRoleFor(definition, item, escalationGrade = null) {
  const explicit = validOwnerRole(item?.fallback_owner_role);
  if (explicit) return explicit;
  if (definition.section_key === "escalation_json" && ["urgent", "heightened"].includes(lower(escalationGrade?.grade))) {
    return "on_call_coordinator";
  }
  return null;
}

function liveStatusMap(liveEvidenceSummary = null) {
  const summary = objectValue(liveEvidenceSummary);
  return {
    service_engagement: objectValue(summary?.service_engagement),
    medication_adherence: objectValue(summary?.medication_adherence),
    sensor_reliability: objectValue(summary?.sensor_reliability),
    contact_pressure: objectValue(summary?.contact_pressure),
  };
}

function livePressureSummary(definition, liveEvidenceSummary = null) {
  const statuses = liveStatusMap(liveEvidenceSummary);
  return unique(definition.live_domains)
    .map((domainKey) => statuses[domainKey])
    .filter(Boolean)
    .filter((item) => ["pressure", "watch"].includes(lower(item?.status)))
    .map((item) => text(item?.summary))
    .filter(Boolean);
}

function summaryReason(item, reviewItem = null, liveEvidenceReasons = []) {
  const reasons = [
    text(reviewItem?.why_now),
    ...unique(liveEvidenceReasons),
  ].filter(Boolean);
  if (reasons.length) return reasons[0];
  const sourceSignals = unique(item?.source_signal_ids);
  if (sourceSignals.length) return `This action is anchored in ${sourceSignals.length} live signal${sourceSignals.length === 1 ? "" : "s"}.`;
  return "This action is one of the clearest operational next steps in the current plan.";
}

function completionSignal(item, definition, reviewItem = null) {
  const explicit = text(item?.completion_signal);
  if (explicit) return explicit;
  if (definition.section_key === "escalation_json") {
    return "Close the loop once the responder is reached and the fallback path is either activated or ruled out.";
  }
  if (definition.section_key === "monitoring_json") {
    return "Record what was confirmed, what stayed uncertain, and whether the risk picture changed.";
  }
  if (definition.section_key === "caregiver_guidance_json") {
    return "Close the loop once the caregiver reports back and the next staff step is documented.";
  }
  if (definition.section_key === "daily_support_json") {
    return "Mark this complete once the routine happened and the client's response was documented.";
  }
  return text(reviewItem?.why_now) ? `Close the loop by documenting the outcome tied to: ${text(reviewItem?.why_now)}` : null;
}

function needsVerification(item, reviewItem = null, liveEvidenceReasons = []) {
  if (item?.verification_required === true) return true;
  if (normalizeWindow(item?.timing) === "today" && normalizePriority(item?.priority) === "high") return true;
  if (normalizeWindow(reviewItem?.response_window) === "today") return true;
  return liveEvidenceReasons.length > 0 && liveEvidenceReasons.some((reason) => /confirm|verify|re-check|unreliable|pressure/i.test(reason));
}

function actionableItems(plan, sectionKey) {
  return Array.isArray(plan?.[sectionKey]) ? plan[sectionKey] : [];
}

function gapId(prefix, itemKey) {
  return `${prefix}-${itemKey}`;
}

function buildExecutionGap(item, definition, reviewItem, escalationGrade) {
  const priority = normalizePriority(item?.priority);
  const responseWindow = normalizeWindow(item?.timing || reviewItem?.response_window);
  const gapPriority = responseWindow === "today" || priority === "high" ? "high" : "medium";
  const itemKey = text(item?.id) || `${definition.section_key}-${text(item?.text).slice(0, 32)}`;
  const gaps = [];
  if (definition.section_key === "escalation_json" && responseWindow === "today" && !validOwnerRole(item?.fallback_owner_role)) {
    gaps.push({
      id: gapId("fallback-owner", itemKey),
      severity: gapPriority,
      label: "Confirm the fallback owner before relying on this escalation step.",
      section_key: definition.section_key,
    });
  }
  if (responseWindow === "today" && priority === "high" && item?.verification_required !== true) {
    gaps.push({
      id: gapId("verification", itemKey),
      severity: "medium",
      label: "Mark whether this same-day action is verify-first or ready to execute directly.",
      section_key: definition.section_key,
    });
  }
  if (definition.section_key === "caregiver_guidance_json" && !/report back|notify|tell the team|document/i.test(text(item?.text))) {
    gaps.push({
      id: gapId("report-back", itemKey),
      severity: "medium",
      label: "Add a clear report-back step so staff can close the loop after caregiver outreach.",
      section_key: definition.section_key,
    });
  }
  return gaps;
}

function scoreAction(item, definition, reviewItem, liveEvidenceReasons) {
  const priority = normalizePriority(item?.priority || reviewItem?.priority);
  const responseWindow = normalizeWindow(item?.timing || reviewItem?.response_window);
  let score = definition.section_score + priorityScore(priority) + responseWindowScore(responseWindow);
  if (item?.verification_required === true) score += 2;
  if (normalizePriority(reviewItem?.priority) === "high") score += 3;
  if (normalizeWindow(reviewItem?.response_window) === "today") score += 3;
  if (liveEvidenceReasons.length > 0) score += Math.min(3, liveEvidenceReasons.length);
  if (lower(item?.confidence) === "high") score += 1;
  return score;
}

function dedupeActions(items = []) {
  const seen = new Set();
  return (Array.isArray(items) ? items : []).filter((item) => {
    const key = [text(item?.section_key), text(item?.action_text)].join("|");
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function buildHealthPlanExecutionBrief({
  plan = null,
  reviewPriorities = null,
  escalationGrade = null,
  liveEvidenceSummary = null,
} = {}) {
  if (!objectValue(plan)) return null;

  const priorityLookup = new Map(
    (Array.isArray(reviewPriorities?.items) ? reviewPriorities.items : [])
      .map((item) => [text(item?.section_key), item])
      .filter(([key]) => key),
  );

  const topActions = dedupeActions(
    ACTIONABLE_SECTION_DEFINITIONS.flatMap((definition) => {
      const reviewItem = priorityLookup.get(definition.section_key) || null;
      const liveReasons = livePressureSummary(definition, liveEvidenceSummary);
      return actionableItems(plan, definition.section_key).map((item, index) => {
        const owner_role = ownerRoleFor(definition, item, reviewItem, escalationGrade);
        const fallback_owner_role = fallbackOwnerRoleFor(definition, item, escalationGrade);
        const response_window = normalizeWindow(item?.timing || reviewItem?.response_window);
        const priority = normalizePriority(item?.priority || reviewItem?.priority);
        return {
          id: text(item?.id) || `${definition.section_key}-${index + 1}`,
          section_key: definition.section_key,
          section_label: definition.section_label,
          action_text: text(item?.text),
          response_window,
          priority,
          owner_role,
          fallback_owner_role,
          verification_required: needsVerification(item, reviewItem, liveReasons),
          completion_signal: completionSignal(item, definition, reviewItem),
          why_now: summaryReason(item, reviewItem, liveReasons),
          confidence: lower(item?.confidence) || null,
          source_signal_ids: unique(item?.source_signal_ids),
          score: scoreAction(item, definition, reviewItem, liveReasons),
          execution_gaps: buildExecutionGap(item, definition, reviewItem, escalationGrade),
        };
      });
    })
      .filter((item) => item.action_text)
      .sort((left, right) => Number(right.score || 0) - Number(left.score || 0)),
  ).slice(0, 4);

  const gaps = unique(
    topActions.flatMap((item) => (Array.isArray(item.execution_gaps) ? item.execution_gaps : []).map((gap) => JSON.stringify(gap))),
  ).map((item) => JSON.parse(item));

  const sameDayCount = topActions.filter((item) => item.response_window === "today").length;
  const thisWeekCount = topActions.filter((item) => item.response_window === "this_week").length;
  const overall_status =
    sameDayCount > 0 || lower(escalationGrade?.grade) === "urgent"
      ? "same_day"
      : thisWeekCount > 0 || lower(escalationGrade?.grade) === "heightened"
        ? "this_week"
        : "routine";

  const summary =
    overall_status === "same_day"
      ? "This plan needs a same-day staff handoff so the next operator can act without re-reading the whole record."
      : overall_status === "this_week"
        ? "This plan should be handed off with a clear short list of this-week actions and checks."
        : "This plan can be used as a routine handoff, with lower-pressure actions surfaced first.";

  return {
    overall_status,
    summary,
    action_count: topActions.length,
    same_day_count: sameDayCount,
    this_week_count: thisWeekCount,
    actions: topActions,
    gaps: gaps.slice(0, 4),
  };
}
