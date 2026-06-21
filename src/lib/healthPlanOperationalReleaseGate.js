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
  return [...new Set((Array.isArray(values) ? values : [values]).map((value) => text(value)).filter(Boolean))];
}

function normalizeStatus(value, allowed, fallback) {
  const normalized = lower(value);
  return allowed.includes(normalized) ? normalized : fallback;
}

function itemKey(item = {}) {
  return [text(item?.type), text(item?.label), text(item?.detail)].join("|");
}

function dedupe(items = []) {
  const seen = new Set();
  return (Array.isArray(items) ? items : []).filter((item) => {
    const key = itemKey(item);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function makeItem(type, label, detail = null, options = {}) {
  return {
    type,
    label: text(label) || null,
    detail: text(detail) || null,
    severity: normalizeStatus(options?.severity, ["high", "medium", "low"], "medium"),
    section_keys: unique(options?.section_keys),
  };
}

function hasGap(dataQualityGaps = [], id) {
  return (Array.isArray(dataQualityGaps) ? dataQualityGaps : []).some((gap) => text(gap?.id) === id);
}

function firstBlockingItem(summary = null) {
  return Array.isArray(summary?.blocking_items) ? summary.blocking_items[0] || null : null;
}

function firstCautionItem(summary = null) {
  return Array.isArray(summary?.caution_items) ? summary.caution_items[0] || null : null;
}

export function buildHealthPlanOperationalReleaseGate({
  reviewGovernance = null,
  reviewReadiness = null,
  trustVerdict = null,
  dataQualityGaps = [],
  liveEvidenceSummary = null,
  freshness = null,
  recommendationCalibration = null,
  benchmarkAssessment = null,
  recommendationGrounding = null,
  recommendationEvidenceDiversity = null,
} = {}) {
  const blockers = [];
  const cautions = [];

  const normalizedGovernance = objectValue(reviewGovernance);
  const normalizedReadiness = objectValue(reviewReadiness);
  const normalizedTrust = objectValue(trustVerdict);
  const normalizedLiveEvidence = objectValue(liveEvidenceSummary);
  const normalizedFreshness = objectValue(freshness);
  const normalizedCalibration = objectValue(recommendationCalibration);
  const normalizedBenchmark = objectValue(benchmarkAssessment);
  const normalizedGrounding = objectValue(recommendationGrounding);
  const normalizedDiversity = objectValue(recommendationEvidenceDiversity);

  const predictiveCoverageGap = hasGap(dataQualityGaps, "predictive-coverage-gap");
  const predictiveFreshnessGap = hasGap(dataQualityGaps, "predictive-freshness-gap");
  const sharingBoundaryGap = hasGap(dataQualityGaps, "sharing-boundary-gap");
  const careCircleGap = hasGap(dataQualityGaps, "care-circle-gap");

  if (normalizedReadiness?.overall_status === "blocked" || Number(normalizedReadiness?.blocker_count || 0) > 0) {
    const blocker = firstBlockingItem(normalizedReadiness);
    blockers.push(makeItem(
      "review_readiness",
      blocker?.label || normalizedReadiness?.summary || "This plan still has open evidence or safety blockers.",
      blocker?.detail || "Do not release this plan for operational use until the blocking quality gaps are resolved.",
      {
        severity: blocker?.severity || "high",
        section_keys: blocker?.section_keys,
      },
    ));
  }

  if (normalizedTrust?.overall_status === "fragile" || Number(normalizedTrust?.blocker_count || 0) > 0) {
    const blocker = firstBlockingItem(normalizedTrust);
    blockers.push(makeItem(
      "trust_verdict",
      blocker?.label || normalizedTrust?.summary || "The plan is still too fragile to trust operationally.",
      blocker?.detail || "Repair the weak sections before staff use this plan as current guidance.",
      {
        severity: blocker?.severity || "high",
        section_keys: blocker?.section_keys,
      },
    ));
  }

  if (
    normalizedGovernance?.review_required
    && text(normalizedGovernance?.review_window) === "today"
    && lower(normalizedLiveEvidence?.status) === "pressure"
    && (predictiveCoverageGap || predictiveFreshnessGap)
  ) {
    blockers.push(makeItem(
      "predictive_visibility_gap",
      "Same-day pressure is outrunning predictive visibility.",
      predictiveCoverageGap
        ? "The plan is responding to same-day pressure without current predictive support, so staff should re-check the live picture before relying on it."
        : "The latest predictive inputs are stale while the case is under same-day pressure, so staff should refresh the live picture before relying on the plan.",
      {
        severity: "high",
        section_keys: ["monitoring_json", "escalation_json"],
      },
    ));
  }

  if (normalizedBenchmark?.rejected || lower(normalizedBenchmark?.overall_status) === "fragile") {
    const topIssue = Array.isArray(normalizedBenchmark?.evaluations) ? normalizedBenchmark.evaluations[0]?.top_issue || null : null;
    blockers.push(makeItem(
      "benchmark_assessment",
      normalizedBenchmark?.summary || "A matched high-risk pattern still sees the plan as fragile.",
      topIssue?.message || "Strengthen the weak response sections before operational release.",
      {
        severity: "high",
        section_keys: topIssue?.section_key,
      },
    ));
  }

  if (normalizedGrounding?.overall_status === "guarded" || Number(normalizedGrounding?.guarded_count || 0) > 0) {
    cautions.push(makeItem(
      "recommendation_grounding",
      normalizedGrounding?.summary || "Some recommendations still need deliberate human verification.",
      "Keep staff mediation in the loop when acting on the weaker recommendations.",
      {
        severity: "medium",
        section_keys: normalizedGrounding?.issues?.[0]?.section_key,
      },
    ));
  }

  if (normalizedDiversity?.overall_status === "guarded" || Number(normalizedDiversity?.guarded_count || 0) > 0) {
    cautions.push(makeItem(
      "recommendation_evidence_diversity",
      normalizedDiversity?.summary || "Some recommendations still lean on a narrower evidence mix than ideal.",
      "Treat the narrower recommendations as staff-guided rather than fully settled.",
      {
        severity: "medium",
        section_keys: normalizedDiversity?.issues?.[0]?.section_key,
      },
    ));
  }

  if (normalizedTrust?.overall_status === "guarded" || Number(normalizedTrust?.caution_count || 0) > 0) {
    const caution = firstCautionItem(normalizedTrust);
    cautions.push(makeItem(
      "trust_verdict",
      caution?.label || normalizedTrust?.summary || "The plan is usable, but it still needs careful staff handling.",
      caution?.detail || "Keep the plan under deliberate staff mediation before sharing it outward.",
      {
        severity: caution?.severity || "medium",
        section_keys: caution?.section_keys,
      },
    ));
  }

  if (normalizedGovernance?.review_required) {
    cautions.push(makeItem(
      "review_governance",
      normalizedGovernance?.review_summary || "Staff review is still required before wider use.",
      text(normalizedGovernance?.review_window) === "today"
        ? "Complete the same-day review flow before this plan is treated as current guidance."
        : "Complete the review flow before this plan is treated as stable guidance.",
      { severity: text(normalizedGovernance?.review_window) === "today" ? "high" : "medium" },
    ));
  }

  if (normalizedCalibration?.adjustment_count > 0) {
    cautions.push(makeItem(
      "recommendation_calibration",
      normalizedCalibration?.summary || "The validator had to soften one or more recommendations before acceptance.",
      "Review the softened recommendations before using the plan as client-facing guidance.",
      {
        severity: Number(normalizedCalibration?.high_pressure_adjustment_count || 0) > 0 ? "medium" : "low",
        section_keys: Array.isArray(normalizedCalibration?.items) ? normalizedCalibration.items[0]?.section_key : null,
      },
    ));
  }

  if (predictiveCoverageGap || predictiveFreshnessGap) {
    cautions.push(makeItem(
      "predictive_gap",
      predictiveCoverageGap ? "Predictive coverage is unavailable." : "Predictive inputs are getting stale.",
      predictiveCoverageGap
        ? "Treat forecast-style language as lower confidence and verify the live operational picture directly."
        : "Lean more on live alerts, contacts, and service evidence until predictive inputs refresh.",
      {
        severity: predictiveCoverageGap ? "medium" : "low",
        section_keys: ["monitoring_json"],
      },
    ));
  }

  if (normalizedFreshness?.status === "stale" || normalizedFreshness?.status === "critical") {
    cautions.push(makeItem(
      "freshness",
      normalizedFreshness?.summary || "The last trusted picture is already drifting.",
      "Refresh the live picture before reusing the plan too casually.",
      { severity: normalizedFreshness?.status === "critical" ? "high" : "medium" },
    ));
  }

  const blockingItems = dedupe(blockers);
  const cautionItems = dedupe(cautions);

  const canUseForStaffWorkflow = blockingItems.length === 0;
  const requiresStaffReview = Boolean(normalizedGovernance?.review_required) || cautionItems.length > 0 || blockingItems.length > 0;
  const clientShareReady =
    canUseForStaffWorkflow
    && !normalizedGovernance?.review_required
    && lower(normalizedTrust?.overall_status) === "trusted"
    && !predictiveCoverageGap
    && normalizedFreshness?.status !== "critical";
  const caregiverShareReady = clientShareReady && !sharingBoundaryGap && !careCircleGap;
  const sameDayAttention = text(normalizedGovernance?.review_window) === "today" || lower(normalizedLiveEvidence?.status) === "pressure";

  const overallStatus =
    !canUseForStaffWorkflow
      ? "blocked"
      : clientShareReady && caregiverShareReady
        ? "shareable"
        : "staff_guided";
  const summary =
    overallStatus === "blocked"
      ? "This plan should stay in staff-only holding until the strongest trust or evidence blockers are cleared."
      : overallStatus === "shareable"
        ? "This plan is strong enough for staff use and is phrased cleanly enough to share with the client or caregiver if needed."
        : "This plan is usable for staff, but it should still be introduced with staff guidance instead of being treated as fully self-standing.";

  const guardrails = [];
  if (!clientShareReady) {
    guardrails.push("Keep this plan staff-mediated before using it as standalone client guidance.");
  }
  if (!caregiverShareReady) {
    if (sharingBoundaryGap) {
      guardrails.push("Do not share caregiver-specific guidance outward until the sharing boundary is confirmed.");
    } else if (careCircleGap) {
      guardrails.push("Do not assume caregiver reinforcement until active care coverage is confirmed.");
    }
  }
  if (predictiveCoverageGap || predictiveFreshnessGap) {
    guardrails.push("Lean on live alerts, recent contact outcomes, and service evidence more heavily than forecast-style signals.");
  }
  if (sameDayAttention) {
    guardrails.push("Keep same-day ownership and fallback steps explicit when the plan is used operationally.");
  }

  return {
    overall_status: overallStatus,
    summary,
    can_use_for_staff_workflow: canUseForStaffWorkflow,
    requires_staff_review: requiresStaffReview,
    client_share_ready: clientShareReady,
    caregiver_share_ready: caregiverShareReady,
    same_day_attention: sameDayAttention,
    blocker_count: blockingItems.length,
    caution_count: cautionItems.length,
    blocking_items: blockingItems,
    caution_items: cautionItems,
    guardrails: unique(guardrails).slice(0, 6),
  };
}
