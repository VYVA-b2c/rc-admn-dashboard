import { shouldRejectHealthPlanGenerationQuality } from "./healthPlanGenerationQuality.js";
import { shouldRejectHealthPlanOperationalCompleteness } from "./healthPlanOperationalCompleteness.js";
import { shouldRejectHealthPlanRecommendationEvidenceDiversity } from "./healthPlanRecommendationEvidenceDiversity.js";
import { shouldRejectHealthPlanRecommendationGrounding } from "./healthPlanRecommendationGrounding.js";
import { shouldRejectHealthPlanRecommendationCoverage } from "./healthPlanRecommendationCoverage.js";
import { shouldRejectHealthPlanRecommendationChallenges } from "./healthPlanRecommendationChallenges.js";
import { shouldRejectHealthPlanEditorialTrace } from "./healthPlanEditorialTrace.js";

function text(value) {
  return String(value || "").trim();
}

function lower(value) {
  return text(value).toLowerCase();
}

function objectValue(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function dedupeItems(items = []) {
  const seen = new Set();
  return (Array.isArray(items) ? items : []).filter((item) => {
    const key = [text(item?.type), text(item?.label), text(item?.detail)].join("|");
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeSectionKeys(value) {
  return [...new Set((Array.isArray(value) ? value : [value]).map((item) => text(item)).filter(Boolean))];
}

function makeItem(type, label, detail = null, options = {}) {
  return {
    type,
    label: text(label) || null,
    detail: text(detail) || null,
    section_keys: normalizeSectionKeys(options?.section_keys),
    severity: lower(options?.severity) === "high" ? "high" : lower(options?.severity) === "medium" ? "medium" : "low",
    priority: lower(options?.priority) === "high" ? "high" : lower(options?.priority) === "medium" ? "medium" : null,
  };
}

export function buildHealthPlanReviewReadiness({
  reviewGovernance = null,
  readiness = null,
  generationQuality = null,
  operationalCompleteness = null,
  actionImpact = null,
  recommendationImpact = null,
  recommendationHistory = null,
  recommendationEvidenceDiversity = null,
  recommendationGrounding = null,
  recommendationCalibration = null,
  recommendationCoverage = null,
  recommendationChallenges = null,
  recommendationReview = null,
  recommendationChangeAudit = null,
  benchmarkAssessment = null,
  editorialTrace = null,
} = {}) {
  const blockers = [];
  const cautions = [];

  const normalizedReadiness = objectValue(readiness);
  const normalizedGovernance = objectValue(reviewGovernance);
  const normalizedGenerationQuality = objectValue(generationQuality);
  const normalizedOperationalCompleteness = objectValue(operationalCompleteness);
  const normalizedActionImpact = objectValue(actionImpact);
  const normalizedRecommendationImpact = objectValue(recommendationImpact);
  const normalizedRecommendationHistory = objectValue(recommendationHistory);
  const normalizedRecommendationEvidenceDiversity = objectValue(recommendationEvidenceDiversity);
  const normalizedGrounding = objectValue(recommendationGrounding);
  const normalizedCalibration = objectValue(recommendationCalibration);
  const normalizedCoverage = objectValue(recommendationCoverage);
  const normalizedChallenges = objectValue(recommendationChallenges);
  const normalizedRecommendationReview = objectValue(recommendationReview);
  const normalizedRecommendationChangeAudit = objectValue(recommendationChangeAudit);
  const normalizedBenchmark = objectValue(benchmarkAssessment);
  const normalizedEditorialTrace = objectValue(editorialTrace);

  const thinChangeItems = Array.isArray(normalizedRecommendationChangeAudit?.recommendation_changes?.items)
    ? normalizedRecommendationChangeAudit.recommendation_changes.items.filter((item) => lower(item?.justification_status) === "thin")
    : [];
  const highPressureThinChange = thinChangeItems.find((item) =>
    lower(item?.priority) === "high"
    || lower(item?.timing) === "today"
    || ["tightened", "replaced"].includes(lower(item?.action)),
  ) || null;

  if (normalizedReadiness?.overall_status === "blocked" || Number(normalizedReadiness?.blocker_count || 0) > 0) {
    const blocker = Array.isArray(normalizedReadiness?.blocking_reasons) ? normalizedReadiness.blocking_reasons[0] || null : null;
    blockers.push(makeItem(
      "evidence_readiness",
      blocker?.label || normalizedReadiness?.summary || "Evidence collection is still incomplete for a confident review.",
      blocker?.detail || null,
      { severity: blocker?.severity },
    ));
  } else if (normalizedReadiness?.overall_status === "guarded" || Number(normalizedReadiness?.caution_count || 0) > 0) {
    const caution = Array.isArray(normalizedReadiness?.caution_reasons) ? normalizedReadiness.caution_reasons[0] || null : null;
    cautions.push(makeItem(
      "evidence_readiness",
      caution?.label || normalizedReadiness?.summary || "Some evidence remains partial, so review should stay cautious.",
      caution?.detail || null,
      { severity: caution?.severity, priority: caution?.severity },
    ));
  }

  if (shouldRejectHealthPlanGenerationQuality(normalizedGenerationQuality)) {
    blockers.push(makeItem(
      "generation_quality",
      normalizedGenerationQuality?.issues?.[0]?.message || normalizedGenerationQuality?.summary || "The plan still has unresolved generation-quality issues.",
      null,
      {
        section_keys: normalizedGenerationQuality?.issues?.[0]?.section_key,
        severity: normalizedGenerationQuality?.issues?.[0]?.severity,
      },
    ));
  } else if (lower(normalizedGenerationQuality?.overall_status) === "guarded") {
    cautions.push(makeItem(
      "generation_quality",
      normalizedGenerationQuality?.summary || "The plan cleared generation, but still needs extra human caution.",
      null,
      {
        section_keys: normalizedGenerationQuality?.issues?.[0]?.section_key,
        severity: normalizedGenerationQuality?.issues?.[0]?.severity,
        priority: "medium",
      },
    ));
  }

  if (shouldRejectHealthPlanOperationalCompleteness(normalizedOperationalCompleteness)) {
    blockers.push(makeItem(
      "operational_completeness",
      normalizedOperationalCompleteness?.issues?.[0]?.message || normalizedOperationalCompleteness?.summary || "The plan still leaves important execution details implicit.",
      normalizedOperationalCompleteness?.issues?.[0]?.detail || null,
      {
        section_keys: normalizedOperationalCompleteness?.issues?.[0]?.section_key,
        severity: normalizedOperationalCompleteness?.issues?.[0]?.severity,
      },
    ));
  } else if (lower(normalizedOperationalCompleteness?.overall_status) === "guarded") {
    cautions.push(makeItem(
      "operational_completeness",
      normalizedOperationalCompleteness?.summary || "Some sections still need clearer ownership, timing, or fallback language.",
      normalizedOperationalCompleteness?.issues?.[0]?.detail || null,
      {
        section_keys: normalizedOperationalCompleteness?.issues?.[0]?.section_key,
        severity: normalizedOperationalCompleteness?.issues?.[0]?.severity,
        priority: "medium",
      },
    ));
  }

  if (lower(normalizedActionImpact?.overall_status) === "contradicted" || Number(normalizedActionImpact?.contradicted_count || 0) > 0) {
    const blocker = Array.isArray(normalizedActionImpact?.items)
      ? normalizedActionImpact.items.find((item) => item?.impact_status === "contradicted") || null
      : null;
    blockers.push(makeItem(
      "action_impact",
      blocker?.reason || normalizedActionImpact?.summary || "Recent real-world evidence is contradicting one or more important plan sections.",
      blocker?.next_step || null,
      {
        section_keys: blocker?.section_key,
        severity: "high",
      },
    ));
  } else if (lower(normalizedActionImpact?.overall_status) === "mixed" || Number(normalizedActionImpact?.mixed_count || 0) > 0) {
    const caution = Array.isArray(normalizedActionImpact?.items)
      ? normalizedActionImpact.items.find((item) => item?.impact_status === "mixed") || null
      : null;
    cautions.push(makeItem(
      "action_impact",
      caution?.reason || normalizedActionImpact?.summary || "The post-plan evidence is mixed, so the plan still needs deliberate human checking.",
      caution?.next_step || null,
      {
        section_keys: caution?.section_key,
        severity: "medium",
        priority: "medium",
      },
    ));
  }

  if (Number(normalizedRecommendationImpact?.high_priority_contradicted_count || 0) > 0) {
    const blocker = Array.isArray(normalizedRecommendationImpact?.items)
      ? normalizedRecommendationImpact.items.find((item) => item?.impact_status === "contradicted" && item?.is_high_priority) || null
      : null;
    blockers.push(makeItem(
      "recommendation_impact",
      blocker?.reason || normalizedRecommendationImpact?.summary || "A high-priority recommendation is already being contradicted by fresher real-world evidence.",
      blocker?.next_step || null,
      {
        section_keys: blocker?.section_key,
        severity: "high",
      },
    ));
  } else if (Number(normalizedRecommendationImpact?.contradicted_count || 0) > 0 || Number(normalizedRecommendationImpact?.mixed_count || 0) > 0) {
    const caution = Array.isArray(normalizedRecommendationImpact?.items)
      ? normalizedRecommendationImpact.items.find((item) => ["contradicted", "mixed"].includes(text(item?.impact_status))) || null
      : null;
    cautions.push(makeItem(
      "recommendation_impact",
      caution?.reason || normalizedRecommendationImpact?.summary || "Some exact recommendations still need a tighter proof loop before review can be considered complete.",
      caution?.next_step || null,
      {
        section_keys: caution?.section_key,
        severity: caution?.impact_status === "contradicted" ? "high" : "medium",
        priority: caution?.impact_status === "contradicted" ? "high" : "medium",
      },
    ));
  }

  if (Number(normalizedRecommendationHistory?.high_priority_deteriorating_count || 0) > 0) {
    const blocker = Array.isArray(normalizedRecommendationHistory?.items)
      ? normalizedRecommendationHistory.items.find((item) => item?.trend_status === "deteriorating" && item?.is_high_priority) || null
      : null;
    blockers.push(makeItem(
      "recommendation_history",
      blocker?.reason || normalizedRecommendationHistory?.summary || "A high-priority recommendation is degrading across saved versions and should not be signed off unchanged.",
      blocker?.next_step || null,
      {
        section_keys: blocker?.section_key,
        severity: "high",
      },
    ));
  } else if (Number(normalizedRecommendationHistory?.deteriorating_count || 0) > 0 || Number(normalizedRecommendationHistory?.volatile_count || 0) > 0) {
    const caution = Array.isArray(normalizedRecommendationHistory?.items)
      ? normalizedRecommendationHistory.items.find((item) => ["deteriorating", "volatile"].includes(text(item?.trend_status))) || null
      : null;
    cautions.push(makeItem(
      "recommendation_history",
      caution?.reason || normalizedRecommendationHistory?.summary || "Some recommendations are still unstable across saved versions and need a tighter human check.",
      caution?.next_step || null,
      {
        section_keys: caution?.section_key,
        severity: text(caution?.trend_status) === "deteriorating" ? "high" : "medium",
        priority: text(caution?.trend_status) === "deteriorating" ? "high" : "medium",
      },
    ));
  }

  if (shouldRejectHealthPlanRecommendationEvidenceDiversity(normalizedRecommendationEvidenceDiversity)) {
    const blocker = Array.isArray(normalizedRecommendationEvidenceDiversity?.issues)
      ? normalizedRecommendationEvidenceDiversity.issues.find((item) => lower(item?.severity) === "high") || null
      : null;
    blockers.push(makeItem(
      "recommendation_evidence_diversity",
      blocker?.message || normalizedRecommendationEvidenceDiversity?.summary || "At least one recommendation is leaning too hard on a narrow evidence mix.",
      null,
      {
        section_keys: blocker?.section_key,
        severity: blocker?.severity || "high",
      },
    ));
  } else if (lower(normalizedRecommendationEvidenceDiversity?.overall_status) === "guarded") {
    cautions.push(makeItem(
      "recommendation_evidence_diversity",
      normalizedRecommendationEvidenceDiversity?.summary || "Some recommendations still need a broader evidence mix before staff should lean on them heavily.",
      null,
      {
        section_keys: normalizedRecommendationEvidenceDiversity?.items?.[0]?.section_key,
        severity: "medium",
        priority: "medium",
      },
    ));
  }

  if (shouldRejectHealthPlanRecommendationGrounding(normalizedGrounding)) {
    blockers.push(makeItem(
      "recommendation_grounding",
      normalizedGrounding?.issues?.[0]?.message || normalizedGrounding?.summary || "One or more recommendations still outrun the available evidence.",
      null,
      {
        section_keys: normalizedGrounding?.issues?.[0]?.section_key,
        severity: normalizedGrounding?.issues?.[0]?.severity,
      },
    ));
  } else if (lower(normalizedGrounding?.overall_status) === "guarded") {
    cautions.push(makeItem(
      "recommendation_grounding",
      normalizedGrounding?.summary || "Some recommendations are usable, but still need careful human verification.",
      null,
      {
        section_keys: normalizedGrounding?.issues?.[0]?.section_key,
        severity: normalizedGrounding?.issues?.[0]?.severity,
        priority: "medium",
      },
    ));
  }

  if (Number(normalizedCalibration?.adjustment_count || 0) > 0) {
    const calibrationItems = Array.isArray(normalizedCalibration?.items) ? normalizedCalibration.items : [];
    const highlightedItem = calibrationItems.find((item) => item?.high_pressure) || calibrationItems[0] || null;
    cautions.push(makeItem(
      "recommendation_calibration",
      normalizedCalibration?.summary || "The validator had to soften one or more recommendations before this plan cleared generation.",
      highlightedItem?.reason
        || "Review the softened recommendations so staff understand where confidence or verification wording changed before marking this plan reviewed.",
      {
        section_keys: highlightedItem?.section_key,
        severity: Number(normalizedCalibration?.high_pressure_adjustment_count || 0) > 0 ? "medium" : "low",
        priority: Number(normalizedCalibration?.high_pressure_adjustment_count || 0) > 0 ? "medium" : "low",
      },
    ));
  }

  if (shouldRejectHealthPlanRecommendationCoverage(normalizedCoverage)) {
    blockers.push(makeItem(
      "recommendation_coverage",
      normalizedCoverage?.issues?.[0]?.message || normalizedCoverage?.summary || "The plan is still missing important live-risk or follow-through coverage.",
      null,
      {
        section_keys: normalizedCoverage?.issues?.[0]?.section_key,
        severity: normalizedCoverage?.issues?.[0]?.severity,
      },
    ));
  } else if (lower(normalizedCoverage?.overall_status) === "guarded") {
    cautions.push(makeItem(
      "recommendation_coverage",
      normalizedCoverage?.summary || "Coverage is mostly present, but one or more pressure areas still need a tighter response.",
      null,
      {
        section_keys: normalizedCoverage?.issues?.[0]?.section_key,
        severity: normalizedCoverage?.issues?.[0]?.severity,
        priority: "medium",
      },
    ));
  }

  if (shouldRejectHealthPlanRecommendationChallenges(normalizedChallenges)) {
    const blocker = Array.isArray(normalizedChallenges?.items)
      ? normalizedChallenges.items.find((item) => item?.challenge_status === "challenged" && item?.high_risk) || null
      : null;
    blockers.push(makeItem(
      "recommendation_challenge",
      blocker?.why_it_is_questioned || normalizedChallenges?.summary || "A high-risk recommendation still needs a challenge pass before review can be completed.",
      blocker?.safer_reframe || null,
      {
        section_keys: blocker?.section_key,
        severity: blocker?.high_risk ? "high" : "medium",
      },
    ));
  } else if (lower(normalizedChallenges?.overall_status) === "guarded" || Number(normalizedChallenges?.guarded_count || 0) > 0) {
    cautions.push(makeItem(
      "recommendation_challenge",
      normalizedChallenges?.summary || "A few recommendations still need a more skeptical human challenge pass.",
      null,
      {
        section_keys: normalizedChallenges?.items?.[0]?.section_key,
        priority: "medium",
      },
    ));
  }

  if (normalizedRecommendationReview) {
    for (const item of Array.isArray(normalizedRecommendationReview.blocking_items) ? normalizedRecommendationReview.blocking_items : []) {
      blockers.push(makeItem(
        "recommendation_review",
        item?.label || normalizedRecommendationReview.summary || "A flagged recommendation still needs an explicit human decision before sign-off.",
        item?.detail || null,
        {
          section_keys: item?.section_keys,
          severity: item?.severity,
          priority: item?.priority,
        },
      ));
    }

    for (const item of Array.isArray(normalizedRecommendationReview.caution_items) ? normalizedRecommendationReview.caution_items : []) {
      cautions.push(makeItem(
        "recommendation_review",
        item?.label || normalizedRecommendationReview.summary || "A flagged recommendation is approved only with continued watchfulness.",
        item?.detail || null,
        {
          section_keys: item?.section_keys,
          severity: item?.severity,
          priority: item?.priority,
        },
      ));
    }
  }

  if (highPressureThinChange) {
    blockers.push(makeItem(
      "recommendation_change_audit",
      "A meaningful recommendation rewrite is still too thinly justified for sign-off.",
      "Strengthened, replaced, or high-pressure recommendation changes should be backed by evidence, learning, or an explicit human override before this plan is marked reviewed.",
      {
        section_keys: highPressureThinChange?.section_key,
        severity: "high",
        priority: "high",
      },
    ));
  } else if (Number(normalizedRecommendationChangeAudit?.recommendation_changes?.thin_justification_count || 0) > 0) {
    cautions.push(makeItem(
      "recommendation_change_audit",
      normalizedRecommendationChangeAudit?.summary || "Some recommendation changes are still weakly justified and deserve an extra human check.",
      "A few changes still look newer rather than better grounded. Review them deliberately before staff lean on the plan heavily.",
      {
        section_keys: thinChangeItems.map((item) => item?.section_key).filter(Boolean),
        severity: "medium",
        priority: "medium",
      },
    ));
  }

  if (normalizedGovernance?.review_required) {
    cautions.push(makeItem(
      "review_governance",
      normalizedGovernance?.review_summary || "This plan still needs an explicit human review before staff rely on it operationally.",
      normalizedGovernance?.review_window === "today"
        ? "A same-day review note and checklist should be completed before sign-off."
        : null,
      { priority: normalizedGovernance?.review_window === "today" ? "high" : "medium" },
    ));
  }

  if (normalizedBenchmark?.rejected) {
    blockers.push(makeItem(
      "benchmark_assessment",
      normalizedBenchmark?.summary || "A matched high-risk benchmark archetype still sees this plan as fragile.",
      normalizedBenchmark?.evaluations?.[0]?.top_issue?.message || null,
      {
        section_keys: normalizedBenchmark?.evaluations?.[0]?.top_issue?.section_key,
        severity: "high",
        priority: "high",
      },
    ));
  } else if (lower(normalizedBenchmark?.overall_status) === "fragile") {
    cautions.push(makeItem(
      "benchmark_assessment",
      normalizedBenchmark?.summary || "At least one matched benchmark pattern still looks fragile.",
      normalizedBenchmark?.evaluations?.[0]?.top_issue?.message || null,
      {
        section_keys: normalizedBenchmark?.evaluations?.[0]?.top_issue?.section_key,
        priority: "medium",
      },
    ));
  } else if (lower(normalizedBenchmark?.overall_status) === "guarded") {
    cautions.push(makeItem(
      "benchmark_assessment",
      normalizedBenchmark?.summary || "Relevant benchmark patterns still suggest a cautious review.",
      normalizedBenchmark?.evaluations?.[0]?.top_issue?.message || null,
      {
        section_keys: normalizedBenchmark?.evaluations?.[0]?.top_issue?.section_key,
        priority: "medium",
      },
    ));
  }

  if (shouldRejectHealthPlanEditorialTrace(normalizedEditorialTrace)) {
    blockers.push(makeItem(
      "editorial_trace",
      normalizedEditorialTrace?.issues?.[0]?.message || normalizedEditorialTrace?.summary || "A manual recommendation lost its evidence trail and should be fixed before sign-off.",
      null,
      {
        section_keys: normalizedEditorialTrace?.issues?.[0]?.section_key,
        severity: normalizedEditorialTrace?.issues?.[0]?.severity || "high",
        priority: "high",
      },
    ));
  } else if (lower(normalizedEditorialTrace?.overall_status) === "guarded") {
    cautions.push(makeItem(
      "editorial_trace",
      normalizedEditorialTrace?.summary || "Manual recommendation edits are present and should be checked against the live evidence before sign-off.",
      null,
      {
        section_keys: normalizedEditorialTrace?.items?.find((item) => ["human_added", "human_edited"].includes(text(item?.origin_type)))?.section_key,
        priority: "medium",
      },
    ));
  }

  const blockingItems = dedupeItems(blockers);
  const cautionItems = dedupeItems(cautions);
  const overallStatus = blockingItems.length > 0 ? "blocked" : cautionItems.length > 0 ? "guarded" : "ready";
  const summary =
    overallStatus === "blocked"
      ? "This plan should not be marked reviewed yet because one or more evidence or safety gates are still open."
      : overallStatus === "guarded"
        ? "This plan can move through human review, but the remaining caution points should be checked deliberately before staff rely on it heavily."
        : "This plan is clear enough to move through human review without additional quality blockers.";

  return {
    overall_status: overallStatus,
    summary,
    can_mark_reviewed: blockingItems.length === 0,
    blocker_count: blockingItems.length,
    caution_count: cautionItems.length,
    blocking_items: blockingItems,
    caution_items: cautionItems,
  };
}
