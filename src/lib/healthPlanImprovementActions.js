function text(value) {
  return String(value || "").trim();
}

function lower(value) {
  return text(value).toLowerCase();
}

function uniqueBy(items, keyFn) {
  const seen = new Set();
  const result = [];
  for (const item of Array.isArray(items) ? items : []) {
    const key = keyFn(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

function unique(values) {
  return [...new Set((Array.isArray(values) ? values : []).map((value) => text(value)).filter(Boolean))];
}

function gapPriority(gap) {
  const severity = lower(gap?.severity);
  if (severity === "high") return "high";
  if (severity === "medium") return "medium";
  return "low";
}

function driftPriority(status) {
  const normalized = lower(status);
  if (normalized === "needs_refresh") return "high";
  if (normalized === "mixed") return "medium";
  return "low";
}

function statusPriority(status) {
  const normalized = lower(status);
  if (normalized === "needs_review") return "high";
  if (normalized === "mixed") return "medium";
  return "low";
}

function priorityScore(priority) {
  if (priority === "high") return 3;
  if (priority === "medium") return 2;
  return 1;
}

function sectionLabel(sectionKey) {
  if (sectionKey === "goals_json") return "Goals";
  if (sectionKey === "daily_support_json") return "Daily support";
  if (sectionKey === "monitoring_json") return "Monitoring";
  if (sectionKey === "escalation_json") return "Escalation";
  if (sectionKey === "caregiver_guidance_json") return "Caregiver guidance";
  return null;
}

function gapToAction(gap) {
  const id = text(gap?.id);
  const detail = text(gap?.detail);
  const staffAction = text(gap?.staff_action);
  const priority = gapPriority(gap);

  if (id === "medication-timing-gap") {
    return {
      id: "improve-medication-timing",
      source: "gap",
      priority,
      section_key: "daily_support_json",
      title: "Confirm medication reminder times",
      reason: detail || "Medication timing is incomplete, so schedule-specific support may be off.",
      next_step: staffAction || "Fill in reminder times before relying on time-sensitive medication guidance.",
    };
  }
  if (id === "medication-adherence-gap" || id === "medication-freshness-gap") {
    return {
      id: "improve-medication-follow-through",
      source: "gap",
      priority,
      section_key: "monitoring_json",
      title: "Collect fresh medication follow-through",
      reason: detail || "Recent medication adherence evidence is thin or stale.",
      next_step: staffAction || "Use the next touchpoint to confirm whether the current medication routine still matches reality.",
    };
  }
  if (id === "sensor-visibility-gap" || id === "sensor-freshness-gap") {
    return {
      id: "improve-sensor-visibility",
      source: "gap",
      priority,
      section_key: "monitoring_json",
      title: "Restore or work around sensor visibility",
      reason: detail || "Sensor visibility is incomplete, so passive monitoring is weaker than usual.",
      next_step: staffAction || "Confirm current status directly until reliable sensor data returns.",
    };
  }
  if (id === "predictive-coverage-gap" || id === "predictive-freshness-gap") {
    return {
      id: "improve-risk-refresh",
      source: "gap",
      priority,
      section_key: "monitoring_json",
      title: "Re-check the risk picture using live signals",
      reason: detail || "Predictive support is missing or aging.",
      next_step: staffAction || "Lean on live alerts, contact outcomes, and service evidence until predictive inputs refresh.",
    };
  }
  if (id === "care-circle-gap") {
    return {
      id: "improve-care-circle-coverage",
      source: "gap",
      priority,
      section_key: "caregiver_guidance_json",
      title: "Confirm who can reinforce the plan",
      reason: detail || "No active care-circle coverage is recorded.",
      next_step: staffAction || "Assign or confirm care coverage before depending on caregiver follow-through.",
    };
  }
  if (id === "sharing-boundary-gap") {
    return {
      id: "improve-sharing-boundary",
      source: "gap",
      priority,
      section_key: "caregiver_guidance_json",
      title: "Confirm the family sharing boundary",
      reason: detail || "Sharing consent is not fully confirmed.",
      next_step: staffAction || "Check family consent before broadening caregiver guidance.",
    };
  }
  if (id === "profile-context-gap") {
    return {
      id: "improve-profile-context",
      source: "gap",
      priority,
      section_key: "goals_json",
      title: "Capture more daily-life context",
      reason: detail || "The plan is missing enough context that some recommendations may be too generic.",
      next_step: staffAction || "Add living context, health condition, or mobility detail before leaning on highly personalized guidance.",
    };
  }
  if (id === "checkins-freshness-gap" || id === "brainCoach-freshness-gap") {
    return {
      id: `improve-${id}`,
      source: "gap",
      priority,
      section_key: "daily_support_json",
      title: "Confirm the saved service routine is still current",
      reason: detail || "A support service is enabled, but recent activity is missing or stale.",
      next_step: staffAction || "Verify the current timing and whether recent service contact actually happened.",
    };
  }

  if (!id) return null;
  return {
    id: `improve-${id}`,
    source: "gap",
    priority,
    title: text(gap?.label) || "Close a plan confidence gap",
    reason: detail || "This gap reduces how confidently staff can rely on the current plan.",
    next_step: staffAction || "Use the next staff touchpoint to close this gap.",
  };
}

function cautionToAction(signal, followThrough) {
  const id = text(signal?.id);
  const detail = text(signal?.detail);
  const priority = statusPriority(followThrough?.status);

  if (id === "new-alerts-since-plan" || id === "lingering-alerts") {
    return {
      id: "improve-alert-reconciliation",
      source: "follow_through",
      priority: "high",
      section_key: "escalation_json",
      title: "Reconcile unresolved alerts before reusing the plan",
      reason: detail || "New or unresolved alerts have appeared since the plan was generated.",
      next_step: "Review the unresolved alert state and update the response path before staff rely on this plan.",
    };
  }
  if (id === "risk-worsened") {
    return {
      id: "improve-risk-response",
      source: "follow_through",
      priority: "high",
      section_key: "monitoring_json",
      title: "Reassess the highest-risk sections now",
      reason: detail || "The current risk picture is worse than when this plan was written.",
      next_step: "Refresh monitoring and escalation guidance against the latest risk and alert picture.",
    };
  }
  if (id === "no-fresh-touchpoints") {
    return {
      id: "improve-fresh-touchpoint",
      source: "follow_through",
      priority,
      section_key: "daily_support_json",
      title: "Collect a fresh touchpoint",
      reason: detail || "There is not enough recent evidence to know whether the saved routines still hold.",
      next_step: "Use the next outreach to confirm medications, reachability, and whether the support routine still matches reality.",
    };
  }
  if (id === "plan-age") {
    return {
      id: "improve-plan-recency",
      source: "follow_through",
      priority,
      title: "Refresh the plan against the current situation",
      reason: detail || "The plan is old enough that parts of it may no longer match reality.",
      next_step: "Review the newest signals before sharing or reusing this plan.",
    };
  }

  return null;
}

function driftToAction(item) {
  const status = lower(item?.status);
  if (status === "fresh") return null;
  return {
    id: `refresh-${text(item?.section_key)}`,
    source: "drift",
    priority: driftPriority(status),
    section_key: text(item?.section_key),
    title: `Refresh ${lower(item?.label) || "this section"} first`,
    reason: text((Array.isArray(item?.reasons) ? item.reasons[0] : "")) || "This section is drifting away from the newest evidence.",
    next_step: `Review and refresh ${lower(item?.label) || "this section"} before relying on it as current guidance.`,
  };
}

export function buildHealthPlanImprovementActions({
  dataQualityGaps = [],
  followThrough = null,
  sectionDrift = [],
  completedActions = [],
} = {}) {
  const completedIds = new Set(unique((Array.isArray(completedActions) ? completedActions : []).map((item) => item?.action_id || item?.id)));
  const gapActions = (Array.isArray(dataQualityGaps) ? dataQualityGaps : [])
    .map(gapToAction)
    .filter(Boolean);
  const followThroughActions = (Array.isArray(followThrough?.caution_signals) ? followThrough.caution_signals : [])
    .map((signal) => cautionToAction(signal, followThrough))
    .filter(Boolean);
  const driftActions = (Array.isArray(sectionDrift) ? sectionDrift : [])
    .map(driftToAction)
    .filter(Boolean);

  return uniqueBy(
    [...gapActions, ...followThroughActions, ...driftActions]
      .filter((item) => !completedIds.has(text(item?.id)))
      .sort((left, right) => {
        const priorityDelta = priorityScore(right.priority) - priorityScore(left.priority);
        if (priorityDelta !== 0) return priorityDelta;
        const leftHasSection = sectionLabel(left.section_key) ? 1 : 0;
        const rightHasSection = sectionLabel(right.section_key) ? 1 : 0;
        return rightHasSection - leftHasSection;
      })
      .map((item) => ({
        ...item,
        section_label: sectionLabel(item.section_key),
      })),
    (item) => text(item?.id),
  );
}

export function buildHealthPlanImprovementBrief(actions = []) {
  return (Array.isArray(actions) ? actions : [])
    .slice(0, 5)
    .map((item) => ({
      id: text(item?.id),
      priority: text(item?.priority) || "medium",
      section_key: text(item?.section_key) || null,
      section_label: text(item?.section_label) || null,
      title: text(item?.title),
      reason: text(item?.reason),
      next_step: text(item?.next_step),
    }))
    .filter((item) => item.id && item.title);
}

export function buildCompletedHealthPlanImprovementBrief(actions = []) {
  return (Array.isArray(actions) ? actions : [])
    .slice(0, 8)
    .map((item) => ({
      action_id: text(item?.action_id || item?.id),
      title: text(item?.title),
      section_key: text(item?.section_key) || null,
      completed_at: text(item?.completed_at) || null,
      completed_by_email: text(item?.completed_by_email) || null,
      note: text(item?.note) || null,
    }))
    .filter((item) => item.action_id && item.title);
}
