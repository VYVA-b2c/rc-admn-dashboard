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

function lower(value) {
  return text(value).toLowerCase();
}

function objectValue(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function unique(values) {
  return [...new Set((Array.isArray(values) ? values : []).map((value) => text(value)).filter(Boolean))];
}

function normalizeOriginType(value, fallback = "ai_generated") {
  const normalized = lower(value);
  if (normalized === "ai_generated" || normalized === "human_added" || normalized === "human_edited") {
    return normalized;
  }
  return fallback;
}

function normalizeTimestamp(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizeItem(item) {
  const record = objectValue(item);
  const itemText = text(record?.text);
  if (!itemText) return null;
  return {
    ...record,
    id: text(record?.id) || null,
    text: itemText,
    source_signal_ids: unique(record?.source_signal_ids),
    priority: ["high", "medium", "low"].includes(lower(record?.priority)) ? lower(record?.priority) : null,
    confidence: ["high", "medium", "low"].includes(lower(record?.confidence)) ? lower(record?.confidence) : null,
    timing: ["today", "this_week", "ongoing"].includes(lower(record?.timing)) ? lower(record?.timing) : null,
    origin_type: normalizeOriginType(record?.origin_type, null),
    original_generated_text: text(record?.original_generated_text) || null,
    original_generated_at: normalizeTimestamp(record?.original_generated_at),
    last_modified_at: normalizeTimestamp(record?.last_modified_at),
    last_modified_by_user_id: text(record?.last_modified_by_user_id) || null,
    last_modified_by_email: text(record?.last_modified_by_email) || null,
    edit_reason: text(record?.edit_reason) || null,
  };
}

function normalizePlan(plan) {
  const normalizedPlan = objectValue(plan) || {};
  return SECTION_KEYS.reduce((result, sectionKey) => {
    result[sectionKey] = (Array.isArray(normalizedPlan?.[sectionKey]) ? normalizedPlan[sectionKey] : [])
      .map(normalizeItem)
      .filter(Boolean);
    return result;
  }, {});
}

function itemIdKey(sectionKey, item) {
  const itemId = text(item?.id);
  if (!itemId) return null;
  return `${sectionKey}#${itemId}`;
}

function itemTextKey(sectionKey, item) {
  const itemText = lower(item?.text);
  if (!itemText) return null;
  return `${sectionKey}:${itemText}`;
}

function buildPreviousLookup(previousPlan) {
  const normalizedPrevious = normalizePlan(previousPlan);
  const byId = new Map();
  const byText = new Map();

  for (const sectionKey of SECTION_KEYS) {
    for (const item of normalizedPrevious[sectionKey]) {
      const idKey = itemIdKey(sectionKey, item);
      const textKey = itemTextKey(sectionKey, item);
      if (idKey) byId.set(idKey, item);
      if (textKey && !byText.has(textKey)) byText.set(textKey, item);
    }
  }

  return { byId, byText };
}

function metadataChanged(currentItem, previousItem) {
  return (
    text(currentItem?.text) !== text(previousItem?.text)
    || lower(currentItem?.priority) !== lower(previousItem?.priority)
    || lower(currentItem?.confidence) !== lower(previousItem?.confidence)
    || lower(currentItem?.timing) !== lower(previousItem?.timing)
    || JSON.stringify(unique(currentItem?.source_signal_ids)) !== JSON.stringify(unique(previousItem?.source_signal_ids))
  );
}

function inferPreviousOrigin(previousItem) {
  const normalizedPrevious = normalizeItem(previousItem);
  if (!normalizedPrevious) return "ai_generated";
  if (normalizedPrevious.origin_type) return normalizedPrevious.origin_type;
  return normalizedPrevious.original_generated_text ? "human_edited" : "ai_generated";
}

export function annotateHealthPlanSectionsWithEditorialTrace(
  sectionMap = {},
  {
    previousPlan = null,
    actionType = "edited",
    actorUserId = null,
    actorEmail = null,
    recordedAt = null,
    manualOverrideReason = null,
  } = {},
) {
  const normalizedSections = normalizePlan(sectionMap);
  const previousLookup = buildPreviousLookup(previousPlan);
  const action = lower(actionType);
  const recordedTimestamp = normalizeTimestamp(recordedAt) || new Date().toISOString();
  const normalizedOverrideReason = text(manualOverrideReason) || null;

  return SECTION_KEYS.reduce((result, sectionKey) => {
    result[sectionKey] = normalizedSections[sectionKey].map((item) => {
      const idKey = itemIdKey(sectionKey, item);
      const textKey = itemTextKey(sectionKey, item);
      const previousItem = (idKey ? previousLookup.byId.get(idKey) : null) || (textKey ? previousLookup.byText.get(textKey) : null) || null;

      if (action === "generated" || action === "regenerated") {
        return {
          ...item,
          origin_type: "ai_generated",
          original_generated_text: item.text,
          original_generated_at: recordedTimestamp,
          last_modified_at: recordedTimestamp,
          last_modified_by_user_id: text(actorUserId) || null,
          last_modified_by_email: text(actorEmail) || null,
          edit_reason: null,
        };
      }

      if (!previousItem) {
        return {
          ...item,
          origin_type: "human_added",
          original_generated_text: null,
          original_generated_at: null,
          last_modified_at: recordedTimestamp,
          last_modified_by_user_id: text(actorUserId) || null,
          last_modified_by_email: text(actorEmail) || null,
          edit_reason: text(item?.edit_reason) || normalizedOverrideReason || null,
        };
      }

      const previousOrigin = inferPreviousOrigin(previousItem);
      const changed = metadataChanged(item, previousItem);
      const textChanged = text(item?.text) !== text(previousItem?.text);
      const preservedOriginalText = text(previousItem?.original_generated_text)
        || (previousOrigin === "ai_generated" ? text(previousItem?.text) : null);
      const preservedOriginalAt = normalizeTimestamp(previousItem?.original_generated_at)
        || (previousOrigin === "ai_generated" ? normalizeTimestamp(previousItem?.last_modified_at) : null);

      if (!changed) {
        return {
          ...item,
          origin_type: previousOrigin,
          original_generated_text: preservedOriginalText,
          original_generated_at: preservedOriginalAt,
          last_modified_at: normalizeTimestamp(previousItem?.last_modified_at) || recordedTimestamp,
          last_modified_by_user_id: text(previousItem?.last_modified_by_user_id) || null,
          last_modified_by_email: text(previousItem?.last_modified_by_email) || null,
          edit_reason: text(previousItem?.edit_reason) || null,
        };
      }

      const nextOrigin = textChanged
        ? previousOrigin === "human_added" && !preservedOriginalText
          ? "human_added"
          : "human_edited"
        : previousOrigin;

      return {
        ...item,
        origin_type: nextOrigin,
        original_generated_text: preservedOriginalText,
        original_generated_at: preservedOriginalAt,
        last_modified_at: recordedTimestamp,
        last_modified_by_user_id: text(actorUserId) || text(previousItem?.last_modified_by_user_id) || null,
        last_modified_by_email: text(actorEmail) || text(previousItem?.last_modified_by_email) || null,
        edit_reason: text(item?.edit_reason) || normalizedOverrideReason || text(previousItem?.edit_reason) || null,
      };
    });

    return result;
  }, {});
}

function issueForItem(item) {
  const sourceCount = unique(item?.source_signal_ids).length;
  const originType = normalizeOriginType(item?.origin_type);
  const highPressure = lower(item?.priority) === "high" || lower(item?.timing) === "today";
  const sectionKey = text(item?.section_key) || null;
  const itemId = text(item?.item_id) || null;
  const issues = [];

  if (["human_added", "human_edited"].includes(originType) && sourceCount === 0) {
    issues.push({
      type: originType === "human_added" ? "manual_addition_missing_evidence" : "manual_edit_missing_evidence",
      severity: highPressure ? "high" : "medium",
      section_key: sectionKey,
      item_id: itemId,
      message: highPressure
        ? "A manual high-priority recommendation no longer carries any source signal linkage."
        : "A manual recommendation was saved without preserving an evidence link.",
    });
  }

  if (["human_added", "human_edited"].includes(originType) && highPressure && !text(item?.edit_reason)) {
    issues.push({
      type: "manual_high_priority_missing_rationale",
      severity: "high",
      section_key: sectionKey,
      item_id: itemId,
      message: "A manual high-priority recommendation was changed without a staff rationale explaining why it overrides the original draft.",
    });
  }

  return issues;
}

export function buildHealthPlanEditorialTrace({ plan = null } = {}) {
  const normalizedPlan = normalizePlan(plan);
  const items = [];

  for (const sectionKey of SECTION_KEYS) {
    for (const sectionItem of normalizedPlan[sectionKey]) {
      const originType = normalizeOriginType(sectionItem?.origin_type);
      const sourceCount = unique(sectionItem?.source_signal_ids).length;
      const divergedFromAi = Boolean(
        text(sectionItem?.original_generated_text)
        && text(sectionItem?.original_generated_text) !== text(sectionItem?.text),
      );
      items.push({
        item_id: text(sectionItem?.id) || null,
        section_key: sectionKey,
        text: text(sectionItem?.text) || null,
        origin_type: originType,
        evidence_linked: sourceCount > 0,
        source_count: sourceCount,
        diverged_from_ai: divergedFromAi,
        original_generated_text: text(sectionItem?.original_generated_text) || null,
        edit_reason: text(sectionItem?.edit_reason) || null,
        has_edit_reason: Boolean(text(sectionItem?.edit_reason)),
        last_modified_at: normalizeTimestamp(sectionItem?.last_modified_at),
        last_modified_by_email: text(sectionItem?.last_modified_by_email) || null,
        priority: lower(sectionItem?.priority) || null,
        timing: lower(sectionItem?.timing) || null,
      });
    }
  }

  const issues = items.flatMap((item) => issueForItem(item) || []);
  const highIssueCount = issues.filter((item) => item.severity === "high").length;
  const mediumIssueCount = issues.filter((item) => item.severity === "medium").length;
  const humanAddedCount = items.filter((item) => item.origin_type === "human_added").length;
  const humanEditedCount = items.filter((item) => item.origin_type === "human_edited").length;
  const aiGeneratedCount = items.filter((item) => item.origin_type === "ai_generated").length;
  const divergedCount = items.filter((item) => item.diverged_from_ai).length;
  const evidenceDetachedCount = items.filter((item) => !item.evidence_linked && ["human_added", "human_edited"].includes(item.origin_type)).length;
  const rationaleMissingCount = items.filter((item) =>
    ["human_added", "human_edited"].includes(item.origin_type)
    && (item.priority === "high" || item.timing === "today")
    && !item.has_edit_reason
  ).length;
  const highPriorityManualCount = items.filter((item) =>
    ["human_added", "human_edited"].includes(item.origin_type)
    && (item.priority === "high" || item.timing === "today")
  ).length;
  const overallStatus = highIssueCount > 0 ? "fragile" : mediumIssueCount > 0 || humanAddedCount > 0 || divergedCount > 0 ? "guarded" : "strong";
  const summary =
    overallStatus === "strong"
      ? "Recommendations still retain a clear AI-to-staff trace, and the current wording has kept its evidence links."
      : rationaleMissingCount > 0
        ? "One or more high-priority manual overrides still need a staff rationale before the plan can be trusted for sign-off."
      : overallStatus === "guarded"
        ? "Some recommendations were manually changed or added; staff should confirm those overrides still match the evidence before relying on the plan heavily."
        : "At least one manual recommendation lost its evidence trail and should be fixed before this plan is signed off.";

  return {
    overall_status: overallStatus,
    summary,
    item_count: items.length,
    ai_generated_count: aiGeneratedCount,
    human_added_count: humanAddedCount,
    human_edited_count: humanEditedCount,
    diverged_from_ai_count: divergedCount,
    evidence_detached_count: evidenceDetachedCount,
    rationale_missing_count: rationaleMissingCount,
    high_priority_manual_count: highPriorityManualCount,
    issues,
    items,
  };
}

export function hasHighPriorityManualOverrideWithoutReason(summary) {
  const normalized = objectValue(summary);
  if (!normalized) return false;
  const issues = Array.isArray(normalized.issues) ? normalized.issues : [];
  return issues.some((item) => lower(item?.type) === "manual_high_priority_missing_rationale");
}

export function shouldRejectHealthPlanEditorialTrace(summary) {
  const normalized = objectValue(summary);
  if (!normalized) return false;
  const issues = Array.isArray(normalized.issues) ? normalized.issues : [];
  return issues.some((item) => lower(item?.severity) === "high") || issues.filter((item) => lower(item?.severity) === "medium").length >= 2;
}
