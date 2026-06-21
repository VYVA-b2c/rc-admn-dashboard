import { normalizeHealthPlanOperationalEvents } from "./healthPlanOperationalEvents.js";

function text(value) {
  return String(value || "").trim();
}

function lower(value) {
  return text(value).toLowerCase().replace(/[\s-]+/g, "_");
}

function unique(values) {
  return [...new Set((Array.isArray(values) ? values : []).map((value) => text(value)).filter(Boolean))];
}

function parseDate(value) {
  const raw = text(value);
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function hoursBetween(start, end) {
  if (!start || !end) return 0;
  return Math.max(0, (end.getTime() - start.getTime()) / (60 * 60 * 1000));
}

function severityRank(value) {
  if (value === "high") return 3;
  if (value === "medium") return 2;
  return 1;
}

function pushDriver(drivers, next) {
  if (!next?.id) return;
  const existing = drivers.find((item) => item.id === next.id);
  if (!existing) {
    drivers.push(next);
    return;
  }
  if (severityRank(next.severity) > severityRank(existing.severity)) {
    existing.severity = next.severity;
  }
  existing.detail = existing.detail || next.detail;
  existing.source_signal_ids = unique([...(existing.source_signal_ids || []), ...(next.source_signal_ids || [])]);
}

function eventIsCaution(event) {
  const status = lower(event?.status);
  const combined = lower(`${event?.label || ""} ${event?.note || ""}`);
  return [
    "missed",
    "failed",
    "no_response",
    "no_answer",
    "not_reached",
    "late",
    "skipped",
    "pending",
    "unconfirmed",
    "timeout",
    "declined",
  ].includes(status) || /\bmissed|failed|no response|no answer|late|skipped|unconfirmed|pending|timeout\b/.test(combined);
}

function eventIsPositive(event) {
  const status = lower(event?.status);
  const combined = lower(`${event?.label || ""} ${event?.note || ""}`);
  return [
    "completed",
    "answered",
    "confirmed",
    "resolved",
    "reached",
    "success",
    "successful",
    "taken",
  ].includes(status) || /\bcompleted|answered|confirmed|resolved|successful|taken\b/.test(combined);
}

export function buildHealthPlanFreshnessSnapshot({
  plan = null,
  followThrough = null,
  recentOperationalEvents = [],
  reviewGovernance = null,
  sectionDrift = [],
  now = new Date(),
} = {}) {
  const generatedAt = parseDate(plan?.generated_at);
  if (!generatedAt) return null;

  const currentTime = parseDate(now) || new Date();
  const reviewedAt = parseDate(plan?.reviewed_at);
  const checkpointAt = reviewedAt || generatedAt;
  const checkpointType = reviewedAt ? "reviewed" : "generated";
  const planAgeHours = Math.round(hoursBetween(generatedAt, currentTime));
  const hoursSinceCheckpoint = Math.round(hoursBetween(checkpointAt, currentTime));
  const allEvents = normalizeHealthPlanOperationalEvents(recentOperationalEvents);
  const eventsAfterCheckpoint = allEvents.filter((event) => {
    const occurredAt = parseDate(event.occurred_at);
    return occurredAt && occurredAt > checkpointAt;
  });
  const cautionEvents = eventsAfterCheckpoint.filter(eventIsCaution);
  const positiveEvents = eventsAfterCheckpoint.filter(eventIsPositive);
  const driftedSections = (Array.isArray(sectionDrift) ? sectionDrift : []).filter((item) => text(item?.status) && text(item?.status) !== "fresh");
  const drivers = [];

  if (cautionEvents.length > 0) {
    pushDriver(drivers, {
      id: checkpointType === "reviewed" ? "new-caution-events-after-review" : "new-caution-events-after-generation",
      label: checkpointType === "reviewed"
        ? "New caution events arrived after the last human review"
        : "New caution events arrived after this plan was generated",
      detail: `${cautionEvents.length} recent operational event${cautionEvents.length === 1 ? "" : "s"} suggests missed contact, unresolved follow-through, or another caution state after the last checkpoint.`,
      severity: checkpointType === "reviewed" || cautionEvents.length >= 2 ? "high" : "medium",
      source: "operational_events",
      occurred_at: cautionEvents[0]?.occurred_at || null,
      source_signal_ids: unique(cautionEvents.flatMap((event) => event.signal_ids || [])),
    });
  }

  if (text(followThrough?.status) === "needs_review") {
    pushDriver(drivers, {
      id: "follow-through-needs-review",
      label: "Follow-through has overtaken the saved plan",
      detail: text(followThrough?.summary) || "Fresh caution signals suggest the plan should be checked again before reuse.",
      severity: "high",
      source: "follow_through",
      source_signal_ids: unique((Array.isArray(followThrough?.caution_signals) ? followThrough.caution_signals : []).map((item) => item?.id)),
    });
  } else if (text(followThrough?.status) === "mixed") {
    pushDriver(drivers, {
      id: "follow-through-mixed",
      label: "Fresh evidence is mixed",
      detail: text(followThrough?.summary) || "Some fresh follow-through is helpful, but parts of the plan should be checked against newer evidence.",
      severity: "medium",
      source: "follow_through",
      source_signal_ids: unique((Array.isArray(followThrough?.caution_signals) ? followThrough.caution_signals : []).map((item) => item?.id)),
    });
  }

  if (reviewGovernance?.review_required && text(reviewGovernance?.review_window) === "today") {
    pushDriver(drivers, {
      id: "same-day-review-window",
      label: "The live signal mix still needs same-day review",
      detail: text(reviewGovernance?.review_summary) || "The live risk picture still carries same-day review pressure.",
      severity: "high",
      source: "governance",
      source_signal_ids: unique((Array.isArray(reviewGovernance?.review_reasons_json) ? reviewGovernance.review_reasons_json : []).flatMap((item) => item?.source_signal_ids || [])),
    });
  } else if (reviewGovernance?.review_required) {
    pushDriver(drivers, {
      id: "review-still-required",
      label: "This plan still needs staff review before reuse",
      detail: text(reviewGovernance?.review_summary) || "The live picture still calls for staff review before reuse.",
      severity: "medium",
      source: "governance",
      source_signal_ids: unique((Array.isArray(reviewGovernance?.review_reasons_json) ? reviewGovernance.review_reasons_json : []).flatMap((item) => item?.source_signal_ids || [])),
    });
  }

  if (driftedSections.length >= 2) {
    pushDriver(drivers, {
      id: "multiple-drifted-sections",
      label: "Several plan sections are drifting out of date",
      detail: `${driftedSections.length} sections are now marked as needing refresh or verification.`,
      severity: "medium",
      source: "section_drift",
      source_signal_ids: unique(driftedSections.flatMap((item) => item?.source_signal_ids || [])),
    });
  } else if (driftedSections.length === 1) {
    pushDriver(drivers, {
      id: "single-drifted-section",
      label: "One section already needs refresh",
      detail: `${text(driftedSections[0]?.section_label) || "One section"} should be checked against fresher evidence.`,
      severity: "low",
      source: "section_drift",
      source_signal_ids: unique(driftedSections.flatMap((item) => item?.source_signal_ids || [])),
    });
  }

  if (hoursSinceCheckpoint >= 72) {
    pushDriver(drivers, {
      id: "checkpoint-aging",
      label: "The last trusted checkpoint is getting old",
      detail: `It has been about ${Math.round(hoursSinceCheckpoint)} hours since this plan was last ${checkpointType}.`,
      severity: hoursSinceCheckpoint >= 120 ? "medium" : "low",
      source: "time",
      source_signal_ids: [],
    });
  }

  if (planAgeHours >= 24 * 7) {
    pushDriver(drivers, {
      id: "plan-old",
      label: "The saved plan itself is now old",
      detail: `This plan was generated about ${Math.round(planAgeHours / 24)} day${Math.round(planAgeHours / 24) === 1 ? "" : "s"} ago.`,
      severity: "medium",
      source: "time",
      source_signal_ids: [],
    });
  }

  let status = "current";
  if (
    drivers.some((item) => item.id === "new-caution-events-after-review")
    || (drivers.some((item) => item.id === "follow-through-needs-review") && checkpointType === "reviewed")
    || drivers.some((item) => item.id === "same-day-review-window")
  ) {
    status = "critical";
  } else if (
    drivers.some((item) => ["new-caution-events-after-generation", "follow-through-needs-review", "review-still-required", "multiple-drifted-sections"].includes(item.id))
    || hoursSinceCheckpoint >= 72
  ) {
    status = "stale";
  } else if (
    drivers.length > 0
    || positiveEvents.length > 0
    || hoursSinceCheckpoint >= 24
  ) {
    status = "aging";
  }

  const summary =
    status === "critical"
      ? "Fresh signals after the last trusted checkpoint mean this plan should be re-reviewed before staff rely on it."
      : status === "stale"
        ? "Parts of the live picture have moved on since this plan was last trusted, so it should be refreshed before reuse."
        : status === "aging"
          ? "The plan still has value, but staff should check the live record before sharing or reusing it."
          : "No newer signals are currently undercutting this saved plan.";

  const recommendation =
    status === "critical"
      ? "Re-review now and regenerate or refresh the affected sections before using this plan as the main guidance."
      : status === "stale"
        ? "Review the drifted or caution-linked sections before reuse, and regenerate if the live picture keeps moving."
        : status === "aging"
          ? "Use with routine judgment and scan the newest contact, medication, and alert signals first."
          : "This plan still aligns with the latest recorded evidence and can be refined rather than rebuilt.";

  return {
    status,
    checkpoint_type: checkpointType,
    checkpoint_at: checkpointAt.toISOString(),
    hours_since_checkpoint: hoursSinceCheckpoint,
    plan_age_hours: planAgeHours,
    new_event_count: eventsAfterCheckpoint.length,
    caution_event_count: cautionEvents.length,
    positive_event_count: positiveEvents.length,
    summary,
    recommendation,
    should_rereview: status === "critical" || status === "stale",
    should_regenerate: status === "critical" || cautionEvents.length >= 2 || driftedSections.length >= 3,
    safe_to_share: status === "current" || status === "aging",
    drivers: drivers.sort((left, right) => severityRank(right.severity) - severityRank(left.severity)),
  };
}
