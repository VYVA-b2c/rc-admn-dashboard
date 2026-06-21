function text(value) {
  return String(value || "").trim();
}

function lower(value) {
  return text(value).toLowerCase();
}

function unique(values) {
  return [...new Set((Array.isArray(values) ? values : []).map((value) => text(value)).filter(Boolean))];
}

function objectValue(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function sectionPriorityScore(value) {
  if (value === "high") return 3;
  if (value === "medium") return 2;
  return 1;
}

function issuePriority(item) {
  const normalized = lower(item?.priority);
  if (normalized === "high" || normalized === "medium") return normalized;
  return lower(item?.severity) === "high" ? "high" : "medium";
}

function sectionLabel(sectionKey) {
  if (sectionKey === "goals_json") return "Goals";
  if (sectionKey === "daily_support_json") return "Daily support";
  if (sectionKey === "monitoring_json") return "Monitoring";
  if (sectionKey === "escalation_json") return "Escalation";
  if (sectionKey === "caregiver_guidance_json") return "Caregiver guidance";
  return null;
}

function pushRefreshAction(map, item, defaultTitle) {
  const sectionKeys = unique(item?.section_keys);
  if (!sectionKeys.length) return;
  const key = sectionKeys.sort().join("|");
  const current = map.get(key) || {
    id: `refresh:${key}`,
    action_kind: "refresh_sections",
    priority: "low",
    section_keys: sectionKeys,
    section_labels: sectionKeys.map(sectionLabel).filter(Boolean),
    title: defaultTitle,
    reasons: [],
  };
  const priority = issuePriority(item);
  if (sectionPriorityScore(priority) > sectionPriorityScore(current.priority)) {
    current.priority = priority;
  }
  if (text(item?.label) && !current.reasons.includes(text(item.label))) {
    current.reasons.push(text(item.label));
  }
  if (text(item?.detail) && !current.reasons.includes(text(item.detail))) {
    current.reasons.push(text(item.detail));
  }
  map.set(key, current);
}

export function buildHealthPlanReviewRemediation({
  reviewReadiness = null,
  refreshStrategy = null,
  improvementActions = [],
  reviewGovernance = null,
} = {}) {
  const normalizedReadiness = objectValue(reviewReadiness);
  if (!normalizedReadiness) return null;

  const refreshMap = new Map();
  const manualActions = [];
  const blockers = Array.isArray(normalizedReadiness?.blocking_items) ? normalizedReadiness.blocking_items : [];
  const cautions = Array.isArray(normalizedReadiness?.caution_items) ? normalizedReadiness.caution_items : [];

  for (const item of [...blockers, ...cautions]) {
    const sectionKeys = unique(item?.section_keys);
    if (sectionKeys.length) {
      pushRefreshAction(
        refreshMap,
        item,
        sectionKeys.length === 1
          ? `Refresh ${sectionLabel(sectionKeys[0]) || "this section"}`
          : "Refresh the sections under the most review pressure",
      );
      continue;
    }

    if (text(item?.type) === "review_governance") {
      manualActions.push({
        id: "review-governance",
        action_kind: "open_review",
        priority: "medium",
        title: "Complete the review note and checklist",
        reasons: unique([item?.label, item?.detail]).slice(0, 2),
      });
      continue;
    }

    manualActions.push({
      id: `manual:${text(item?.type) || manualActions.length + 1}`,
      action_kind: "manual_follow_up",
      priority: issuePriority(item),
      title: "Resolve the remaining evidence gap",
      reasons: unique([item?.label, item?.detail]).slice(0, 2),
    });
  }

  const refreshActions = [...refreshMap.values()]
    .sort((left, right) => {
      const byPriority = sectionPriorityScore(right.priority) - sectionPriorityScore(left.priority);
      if (byPriority !== 0) return byPriority;
      return right.section_keys.length - left.section_keys.length;
    });

  const improvementBySection = new Map();
  for (const action of Array.isArray(improvementActions) ? improvementActions : []) {
    const sectionKey = text(action?.section_key);
    if (!sectionKey) continue;
    const list = improvementBySection.get(sectionKey) || [];
    list.push(action);
    improvementBySection.set(sectionKey, list);
  }

  const sectionRefreshActions = refreshActions.map((action) => ({
    ...action,
    linked_improvements: action.section_keys.flatMap((sectionKey) => improvementBySection.get(sectionKey) || []).slice(0, 2),
  }));

  const shouldRegenerateAll =
    refreshStrategy?.full_regeneration_preferred
    && (
      sectionRefreshActions.length >= 2
      || blockers.length >= 2
      || unique(refreshStrategy?.refresh_now_section_keys).length >= 3
    );

  const actions = [];
  if (shouldRegenerateAll) {
    actions.push({
      id: "regenerate-all",
      action_kind: "regenerate_all",
      priority: "high",
      title: "Regenerate the full plan",
      section_keys: unique(refreshStrategy?.refresh_now_section_keys),
      section_labels: unique(refreshStrategy?.refresh_now_section_keys).map(sectionLabel).filter(Boolean),
      reasons: unique([
        refreshStrategy?.summary,
        refreshStrategy?.recommendation,
        sectionRefreshActions[0]?.reasons?.[0],
      ]).slice(0, 3),
    });
  }

  actions.push(...sectionRefreshActions.slice(0, shouldRegenerateAll ? 2 : 4));

  for (const action of manualActions) {
    if (text(action?.action_kind) === "open_review" && normalizedReadiness?.can_mark_reviewed === false) continue;
    actions.push(action);
  }

  if (normalizedReadiness?.can_mark_reviewed && reviewGovernance?.review_required) {
    actions.unshift({
      id: "complete-review",
      action_kind: "open_review",
      priority: lower(reviewGovernance?.review_window) === "today" ? "high" : "medium",
      title: "Complete human review and sign-off",
      reasons: unique([reviewGovernance?.review_summary]).slice(0, 1),
    });
  }

  const deduped = [];
  const seen = new Set();
  for (const action of actions) {
    const key = [text(action?.action_kind), unique(action?.section_keys).join("|"), text(action?.title)].join("|");
    if (!key || seen.has(key)) continue;
    seen.add(key);
    deduped.push(action);
  }

  const overallStatus = normalizedReadiness?.can_mark_reviewed ? "ready" : blockers.length > 0 ? "blocked" : "guarded";
  const summary =
    overallStatus === "blocked"
      ? "Fix the highest-pressure sections first, then return to review once the blockers are cleared."
      : overallStatus === "guarded"
        ? "A few targeted improvements should make the plan easier to review with confidence."
        : "The plan is clear enough to move through human review now.";

  return {
    overall_status: overallStatus,
    summary,
    action_count: deduped.length,
    actions: deduped.slice(0, 6),
  };
}

