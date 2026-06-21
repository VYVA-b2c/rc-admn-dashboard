function text(value) {
  return String(value || "").trim();
}

function parseDate(value) {
  const raw = text(value);
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function hoursBetween(start, end) {
  if (!start || !end) return null;
  return (end.getTime() - start.getTime()) / (60 * 60 * 1000);
}

function pickDate(...values) {
  for (const value of values) {
    const date = parseDate(value);
    if (date) return date;
  }
  return null;
}

function currentRiskScore(predictiveContext) {
  const score = Number(predictiveContext?.latestScore?.composite_score);
  return Number.isFinite(score) ? score : null;
}

function planRiskScore(plan) {
  const signals = Array.isArray(plan?.source_signals_json) ? plan.source_signals_json : [];
  const signal = signals.find((item) => item?.id === "risk-latest-score")
    || signals.find((item) => String(item?.category || "").toLowerCase() === "risk" && /risk score/i.test(String(item?.label || "")));
  const match = String(signal?.label || "").match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const score = Number(match[1]);
  return Number.isFinite(score) ? score : null;
}

function signal(id, label, detail) {
  return { id, label: text(label), detail: text(detail) };
}

function normalizedOutcome(value) {
  return text(value).toLowerCase().replace(/[\s-]+/g, "_");
}

function isPositiveOutcome(value) {
  return ["completed", "confirmed", "answered", "reached", "success", "successful", "done", "taken"].includes(normalizedOutcome(value));
}

function isCautionOutcome(value) {
  return [
    "missed",
    "unconfirmed",
    "no_answer",
    "no_response",
    "not_reached",
    "failed",
    "failure",
    "late",
    "skipped",
    "declined",
    "busy",
    "timeout",
    "pending",
  ].includes(normalizedOutcome(value));
}

export function buildHealthPlanFollowThroughSummary({
  plan = null,
  profile = null,
  predictiveContext = null,
  now = new Date(),
} = {}) {
  const generatedAt = parseDate(plan?.generated_at);
  if (!generatedAt) return null;
  const currentTime = parseDate(now) || new Date();
  const hoursSinceGeneration = Math.max(0, Math.round(hoursBetween(generatedAt, currentTime) || 0));
  const alerts = Array.isArray(profile?.alerts) ? profile.alerts : [];
  const positiveSignals = [];
  const cautionSignals = [];
  let freshTouchpointsCount = 0;

  const checkinAt = pickDate(
    profile?.checkins?.last_reported_at,
    profile?.checkins?.lastReportedAt,
    profile?.checkins?.last_outcome_at,
    profile?.checkins?.lastOutcomeAt,
    profile?.checkins?.last_checkin_at,
    profile?.checkins?.lastCheckinAt,
    profile?.checkins?.last_session_at,
    profile?.checkins?.lastSessionAt,
  );
  if (checkinAt && checkinAt > generatedAt) {
    freshTouchpointsCount += 1;
    const checkinOutcome = profile?.checkins?.last_outcome || profile?.checkins?.lastOutcome || null;
    if (isCautionOutcome(checkinOutcome)) {
      cautionSignals.push(signal("checkin-problem-since-plan", "Recent check-in outcome needs follow-up", "A recent check-in after plan generation was missed or unresolved."));
    } else {
      positiveSignals.push(signal("checkin-since-plan", "Fresh check-in evidence", "A successful check-in outcome has been recorded since this plan was generated."));
    }
  }

  const brainCoachAt = pickDate(
    profile?.brainCoach?.last_session_at,
    profile?.brainCoach?.lastSessionAt,
    profile?.brainCoach?.last_reported_at,
    profile?.brainCoach?.lastReportedAt,
    profile?.brainCoach?.last_outcome_at,
    profile?.brainCoach?.lastOutcomeAt,
  );
  if (brainCoachAt && brainCoachAt > generatedAt) {
    freshTouchpointsCount += 1;
    const brainOutcome = profile?.brainCoach?.last_outcome || profile?.brainCoach?.lastOutcome || null;
    if (isCautionOutcome(brainOutcome)) {
      cautionSignals.push(signal("brain-coach-problem-since-plan", "Recent Brain Coach outcome needs follow-up", "A recent Brain Coach session after plan generation was missed or unresolved."));
    } else {
      positiveSignals.push(signal("brain-coach-since-plan", "Fresh Brain Coach evidence", "A successful Brain Coach outcome has been recorded since this plan was generated."));
    }
  }

  const medicationAt = pickDate(
    profile?.medicationActivity?.occurred_at,
    profile?.medicationActivity?.occurredAt,
    profile?.medicationActivity?.reported_at,
    profile?.medicationActivity?.reportedAt,
    profile?.medicationActivity?.created_at,
  );
  if (medicationAt && medicationAt > generatedAt) {
    freshTouchpointsCount += 1;
    const medicationOutcome = profile?.medicationActivity?.status || null;
    if (isCautionOutcome(medicationOutcome)) {
      cautionSignals.push(signal("medication-problem-since-plan", "Recent medication outcome needs follow-up", "Medication activity after plan generation shows a missed, late, or unresolved outcome."));
    } else {
      positiveSignals.push(signal("medication-since-plan", "Fresh medication evidence", "Successful medication activity has been logged since this plan was generated."));
    }
  }

  const newUnresolvedAlerts = alerts.filter((alert) => {
    const createdAt = pickDate(alert?.created_at);
    return createdAt && createdAt > generatedAt && !parseDate(alert?.resolved_at);
  });
  if (newUnresolvedAlerts.length > 0) {
    cautionSignals.push(signal(
      "new-alerts-since-plan",
      "New unresolved alerts since plan generation",
      `${newUnresolvedAlerts.length} alert${newUnresolvedAlerts.length === 1 ? "" : "s"} appeared after the plan was generated and is still unresolved.`,
    ));
  }

  const resolvedAlertsSincePlan = alerts.filter((alert) => {
    const resolvedAt = pickDate(alert?.resolved_at);
    return resolvedAt && resolvedAt > generatedAt;
  });
  if (resolvedAlertsSincePlan.length > 0) {
    positiveSignals.push(signal(
      "resolved-alerts-since-plan",
      "Alerts resolved after plan generation",
      `${resolvedAlertsSincePlan.length} alert${resolvedAlertsSincePlan.length === 1 ? "" : "s"} has been resolved since the plan was generated.`,
    ));
  }

  const lingeringAlerts = alerts.filter((alert) => {
    const createdAt = pickDate(alert?.created_at);
    return createdAt && createdAt <= generatedAt && !parseDate(alert?.resolved_at);
  });
  if (lingeringAlerts.length > 0 && hoursSinceGeneration >= 12) {
    cautionSignals.push(signal(
      "lingering-alerts",
      "Earlier alerts remain unresolved",
      `${lingeringAlerts.length} alert${lingeringAlerts.length === 1 ? "" : "s"} from before plan generation is still unresolved.`,
    ));
  }

  if (freshTouchpointsCount === 0 && hoursSinceGeneration >= 24) {
    cautionSignals.push(signal(
      "no-fresh-touchpoints",
      "No fresh follow-through evidence",
      "No new check-in, Brain Coach, or medication activity has been recorded since the plan was generated.",
    ));
  }

  if (hoursSinceGeneration >= 24 * 7) {
    cautionSignals.push(signal(
      "plan-age",
      "Plan is now old",
      "This plan was generated more than seven days ago and should be re-checked against the current situation.",
    ));
  }

  const currentScore = currentRiskScore(predictiveContext);
  const priorScore = planRiskScore(plan);
  if (currentScore != null && priorScore != null) {
    const delta = currentScore - priorScore;
    if (delta >= 7) {
      cautionSignals.push(signal(
        "risk-worsened",
        "Risk score has increased since plan generation",
        `The latest predictive score is ${Math.round(currentScore)}, up from ${Math.round(priorScore)} when this plan was generated.`,
      ));
    } else if (delta <= -7) {
      positiveSignals.push(signal(
        "risk-improved",
        "Risk score is lower than at generation",
        `The latest predictive score is ${Math.round(currentScore)}, down from ${Math.round(priorScore)} when this plan was generated.`,
      ));
    }
  }

  let status = "fresh";
  if (
    cautionSignals.some((item) => ["new-alerts-since-plan", "risk-worsened"].includes(item.id))
    || (hoursSinceGeneration >= 48 && cautionSignals.some((item) => item.id === "no-fresh-touchpoints"))
    || (hoursSinceGeneration >= 48 && cautionSignals.length > 0)
  ) {
    status = "needs_review";
  } else if (cautionSignals.length > 0) {
    status = "mixed";
  } else if (positiveSignals.length === 0) {
    status = "mixed";
  }

  const summary =
    status === "fresh"
      ? "Fresh follow-through evidence has been recorded since this plan was generated."
      : status === "mixed"
        ? "Some follow-through evidence is fresh, but parts of the plan should be checked against newer signals."
        : "This plan has been overtaken by new or unresolved signals and should be reviewed before staff rely on it.";

  const recommendation =
    status === "fresh"
      ? "Refine the current plan using the new evidence rather than rebuilding it from scratch."
      : status === "mixed"
        ? "Review the sections tied to the caution signals before reusing or sharing this plan."
        : "Regenerate or manually revise the plan before using it as the main care guidance.";

  return {
    status,
    generated_at: generatedAt.toISOString(),
    hours_since_generation: hoursSinceGeneration,
    fresh_touchpoints_count: freshTouchpointsCount,
    positive_signals: positiveSignals,
    caution_signals: cautionSignals,
    summary,
    recommendation,
  };
}
