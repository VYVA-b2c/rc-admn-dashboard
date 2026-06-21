import { buildHealthPlanGenerationQuality, shouldRejectHealthPlanGenerationQuality } from "./healthPlanGenerationQuality.js";
import { buildHealthPlanOperationalCompleteness, shouldRejectHealthPlanOperationalCompleteness } from "./healthPlanOperationalCompleteness.js";
import { buildHealthPlanRecommendationCoverage, shouldRejectHealthPlanRecommendationCoverage } from "./healthPlanRecommendationCoverage.js";
import { buildHealthPlanRecommendationChallenges, shouldRejectHealthPlanRecommendationChallenges } from "./healthPlanRecommendationChallenges.js";
import { buildHealthPlanRecommendationGrounding, shouldRejectHealthPlanRecommendationGrounding } from "./healthPlanRecommendationGrounding.js";
import { buildHealthPlanBenchmarkAssessment } from "./healthPlanBenchmarkAssessment.js";
import { buildHealthPlanClinicalCautions, findHealthPlanClinicalCautionIssues } from "./healthPlanClinicalCautions.js";
import { buildHealthPlanOperationalReleaseGate } from "./healthPlanOperationalReleaseGate.js";
import { buildHealthPlanRecommendationEvidenceDiversity } from "./healthPlanRecommendationEvidenceDiversity.js";
import { buildHealthPlanRecommendationSourceRanking } from "./healthPlanRecommendationSourceRanking.js";
import { findHealthPlanSafetyIssues } from "./healthPlanSafetyReview.js";
import { buildHealthPlanTrustVerdict } from "./healthPlanTrustVerdict.js";
import { findHealthPlanGenerationBriefIssues, shouldRejectHealthPlanGenerationBriefIssues } from "./healthPlanGenerationBriefCompliance.js";

function text(value) {
  return String(value || "").trim();
}

function lower(value) {
  return text(value).toLowerCase();
}

function objectValue(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function firstIssue(summary = null) {
  return Array.isArray(summary?.issues) ? summary.issues[0] || null : null;
}

function blockingItem(type, message, options = {}) {
  return {
    type,
    severity: "high",
    message: text(message) || null,
    detail: text(options?.detail) || null,
    section_key: text(options?.section_key) || null,
  };
}

function cautionItem(type, message, options = {}) {
  return {
    type,
    severity: lower(options?.severity) === "low" ? "low" : "medium",
    message: text(message) || null,
    detail: text(options?.detail) || null,
    section_key: text(options?.section_key) || null,
  };
}

function summaryForStatus(status) {
  if (status === "blocked") {
    return "This draft still has open trust or usefulness problems and should not be saved as the working plan yet.";
  }
  if (status === "guarded") {
    return "This draft is usable, but staff should still expect a few weaker areas that need deliberate human review.";
  }
  return "This draft passed the main post-generation usefulness and trust checks.";
}

export function buildHealthPlanDraftAcceptance({
  plan = null,
  sourceSignals = [],
  promptInput = null,
  generationQuality = null,
  operationalCompleteness = null,
  recommendationCoverage = null,
  recommendationChallenges = null,
  recommendationGrounding = null,
  recommendationCalibration = null,
  benchmarkAssessment = null,
  recommendationEvidenceDiversity = null,
  trustVerdict = null,
  operationalRelease = null,
  clinicalCautions = null,
  safetyIssues = null,
  clinicalCautionIssues = null,
} = {}) {
  const normalizedPlan = objectValue(plan);
  if (!normalizedPlan) return null;

  const resolvedGenerationQuality = generationQuality || buildHealthPlanGenerationQuality({
    plan: normalizedPlan,
    reviewPriorities: promptInput?.review_priorities || null,
    confidenceProfile: promptInput?.confidence_guardrails || null,
  });
  const resolvedRecommendationCoverage = recommendationCoverage || buildHealthPlanRecommendationCoverage({
    plan: normalizedPlan,
    evidencePack: promptInput?.evidence_pack || null,
    reviewPriorities: promptInput?.review_priorities || null,
    followThrough: promptInput?.existing_plan_feedback || null,
  });
  const resolvedOperationalCompleteness = operationalCompleteness || buildHealthPlanOperationalCompleteness({
    plan: normalizedPlan,
    reviewPriorities: promptInput?.review_priorities || null,
    escalationGrade: promptInput?.escalation_grade || null,
    liveEvidenceSummary: promptInput?.live_evidence_summary || null,
  });
  const resolvedRecommendationChallenges = recommendationChallenges || buildHealthPlanRecommendationChallenges({
    plan: normalizedPlan,
    sourceSignals,
    reviewPriorities: promptInput?.review_priorities || null,
    liveEvidenceSummary: promptInput?.live_evidence_summary || null,
    longitudinalMemory: promptInput?.longitudinal_memory || null,
  });
  const resolvedRecommendationGrounding = recommendationGrounding || buildHealthPlanRecommendationGrounding({
    plan: normalizedPlan,
    sourceSignals,
    evidencePack: promptInput?.evidence_pack || null,
    reviewPriorities: promptInput?.review_priorities || null,
    confidenceProfile: promptInput?.confidence_guardrails || null,
  });
  const resolvedBenchmarkAssessment = benchmarkAssessment || buildHealthPlanBenchmarkAssessment({
    plan: normalizedPlan,
    sourceSignals,
    evidencePack: promptInput?.evidence_pack || null,
    reviewPriorities: promptInput?.review_priorities || null,
    confidenceProfile: promptInput?.confidence_guardrails || null,
    followThrough: promptInput?.existing_plan_feedback || null,
  });
  const resolvedRecommendationSourceRanking = buildHealthPlanRecommendationSourceRanking({
    plan: normalizedPlan,
    sourceSignals,
    evidenceHierarchy: promptInput?.evidence_hierarchy || [],
    signalPreferenceWeights: promptInput?.signal_preference_weights || [],
    recommendationEffectiveness: promptInput?.recommendation_effectiveness || null,
    recommendationChallenges: resolvedRecommendationChallenges || null,
  });
  const resolvedRecommendationEvidenceDiversity = recommendationEvidenceDiversity || buildHealthPlanRecommendationEvidenceDiversity({
    recommendationSourceRanking: resolvedRecommendationSourceRanking,
  });
  const resolvedGenerationBriefIssues = findHealthPlanGenerationBriefIssues(
    normalizedPlan,
    promptInput?.generation_brief || null,
  );
  const resolvedSafetyIssues = Array.isArray(safetyIssues)
    ? safetyIssues
    : findHealthPlanSafetyIssues(normalizedPlan, {
      sourceSignals,
      signalTriage: promptInput?.signal_triage || {},
      criticalSignalIds: promptInput?.critical_signal_ids || [],
    });
  const resolvedClinicalCautions = Array.isArray(clinicalCautions)
    ? clinicalCautions
    : buildHealthPlanClinicalCautions({
      sourceSignals,
      followThrough: promptInput?.existing_plan_feedback || null,
    });
  const resolvedClinicalCautionIssues = Array.isArray(clinicalCautionIssues)
    ? clinicalCautionIssues
    : findHealthPlanClinicalCautionIssues(normalizedPlan, {
      sourceSignals,
      followThrough: promptInput?.existing_plan_feedback || null,
      clinicalCautions: resolvedClinicalCautions,
    });
  const resolvedTrustVerdict = trustVerdict || buildHealthPlanTrustVerdict({
    generationQuality: resolvedGenerationQuality,
    operationalCompleteness: resolvedOperationalCompleteness,
    recommendationGrounding: resolvedRecommendationGrounding,
    recommendationCalibration: recommendationCalibration || null,
    recommendationCoverage: resolvedRecommendationCoverage,
    benchmarkAssessment: resolvedBenchmarkAssessment,
    recommendationChallenges: resolvedRecommendationChallenges,
    generationBriefIssues: resolvedGenerationBriefIssues,
  });
  const resolvedOperationalRelease = operationalRelease || buildHealthPlanOperationalReleaseGate({
    reviewGovernance: promptInput?.review_governance || null,
    trustVerdict: resolvedTrustVerdict,
    dataQualityGaps: promptInput?.data_quality_gaps || [],
    liveEvidenceSummary: promptInput?.live_evidence_summary || null,
    freshness: promptInput?.existing_plan_freshness || null,
    recommendationCalibration: recommendationCalibration || null,
    benchmarkAssessment: resolvedBenchmarkAssessment,
    recommendationGrounding: resolvedRecommendationGrounding,
    recommendationEvidenceDiversity: resolvedRecommendationEvidenceDiversity,
  });

  const blockingItems = [];
  const cautionItems = [];

  if (shouldRejectHealthPlanGenerationQuality(resolvedGenerationQuality)) {
    const issue = firstIssue(resolvedGenerationQuality);
    blockingItems.push(blockingItem(
      "generation_quality",
      issue?.message || resolvedGenerationQuality?.summary || "The draft stayed too soft for the current review pressure.",
      { detail: issue?.detail, section_key: issue?.section_key },
    ));
  } else if (lower(resolvedGenerationQuality?.overall_status) === "guarded") {
    const issue = firstIssue(resolvedGenerationQuality);
    cautionItems.push(cautionItem(
      "generation_quality",
      resolvedGenerationQuality?.summary || "The generated draft still needs extra human caution.",
      { severity: issue?.severity, detail: issue?.detail, section_key: issue?.section_key },
    ));
  }

  if (shouldRejectHealthPlanOperationalCompleteness(resolvedOperationalCompleteness)) {
    const issue = firstIssue(resolvedOperationalCompleteness);
    blockingItems.push(blockingItem(
      "operational_completeness",
      issue?.message || resolvedOperationalCompleteness?.summary || "The draft is still too vague to execute safely under pressure.",
      { detail: issue?.detail, section_key: issue?.section_key },
    ));
  } else if (lower(resolvedOperationalCompleteness?.overall_status) === "guarded") {
    const issue = firstIssue(resolvedOperationalCompleteness);
    cautionItems.push(cautionItem(
      "operational_completeness",
      resolvedOperationalCompleteness?.summary || "The draft still needs clearer timing, ownership, or fallback wording in one or more sections.",
      { severity: issue?.severity, detail: issue?.detail, section_key: issue?.section_key },
    ));
  }

  if (shouldRejectHealthPlanRecommendationCoverage(resolvedRecommendationCoverage)) {
    const issue = firstIssue(resolvedRecommendationCoverage);
    blockingItems.push(blockingItem(
      "recommendation_coverage",
      issue?.message || resolvedRecommendationCoverage?.summary || "The draft is still missing important live-risk or verification coverage.",
      { detail: issue?.detail, section_key: issue?.section_key },
    ));
  } else if (lower(resolvedRecommendationCoverage?.overall_status) === "guarded") {
    const issue = firstIssue(resolvedRecommendationCoverage);
    cautionItems.push(cautionItem(
      "recommendation_coverage",
      resolvedRecommendationCoverage?.summary || "Coverage is still partial in one or more live-pressure areas.",
      { severity: issue?.severity, detail: issue?.detail, section_key: issue?.section_key },
    ));
  }

  if (shouldRejectHealthPlanRecommendationGrounding(resolvedRecommendationGrounding)) {
    const issue = firstIssue(resolvedRecommendationGrounding);
    blockingItems.push(blockingItem(
      "recommendation_grounding",
      issue?.message || resolvedRecommendationGrounding?.summary || "At least one recommendation is still outrunning the evidence behind it.",
      { section_key: issue?.section_key },
    ));
  } else if (lower(resolvedRecommendationGrounding?.overall_status) === "guarded") {
    const issue = firstIssue(resolvedRecommendationGrounding);
    cautionItems.push(cautionItem(
      "recommendation_grounding",
      resolvedRecommendationGrounding?.summary || "A few recommendations still need tighter evidence or softer wording.",
      { severity: issue?.severity, section_key: issue?.section_key },
    ));
  }

  if (shouldRejectHealthPlanRecommendationChallenges(resolvedRecommendationChallenges)) {
    const issue = Array.isArray(resolvedRecommendationChallenges?.items)
      ? resolvedRecommendationChallenges.items.find((item) => item?.challenge_status === "challenged" && item?.high_risk)
        || resolvedRecommendationChallenges.items[0]
      : null;
    blockingItems.push(blockingItem(
      "recommendation_challenges",
      issue?.why_it_is_questioned || resolvedRecommendationChallenges?.summary || "A high-risk recommendation still needs stronger evidence or fallback wording.",
      { detail: issue?.safer_reframe, section_key: issue?.section_key },
    ));
  } else if (lower(resolvedRecommendationChallenges?.overall_status) === "guarded") {
    const issue = Array.isArray(resolvedRecommendationChallenges?.items) ? resolvedRecommendationChallenges.items[0] || null : null;
    cautionItems.push(cautionItem(
      "recommendation_challenges",
      resolvedRecommendationChallenges?.summary || "A few recommendations still need a stronger challenge pass.",
      { severity: issue?.high_risk ? "high" : "medium", detail: issue?.safer_reframe, section_key: issue?.section_key },
    ));
  }

  if (shouldRejectHealthPlanGenerationBriefIssues(resolvedGenerationBriefIssues)) {
    const issue = resolvedGenerationBriefIssues[0] || null;
    blockingItems.push(blockingItem(
      "generation_brief",
      issue?.message || "The draft drifted away from the ranked generation brief and its evidence discipline.",
      { detail: issue?.detail, section_key: issue?.section_key },
    ));
  } else if (resolvedGenerationBriefIssues.length > 0) {
    const issue = resolvedGenerationBriefIssues[0] || null;
    cautionItems.push(cautionItem(
      "generation_brief",
      issue?.message || "The draft only partially respected the ranked generation brief.",
      { severity: issue?.severity, detail: issue?.detail, section_key: issue?.section_key },
    ));
  }

  if (Array.isArray(resolvedSafetyIssues) && resolvedSafetyIssues.length > 0) {
    const issue = resolvedSafetyIssues[0] || null;
    blockingItems.push(blockingItem(
      "safety_review",
      issue?.message || "The draft still contains wording that is not operationally safe enough.",
      { section_key: issue?.section_key },
    ));
  }

  if (Array.isArray(resolvedClinicalCautionIssues) && resolvedClinicalCautionIssues.length > 0) {
    const issue = resolvedClinicalCautionIssues[0] || null;
    blockingItems.push(blockingItem(
      "clinical_cautions",
      issue?.message || "The draft missed a clinically important caution response path.",
      { detail: issue?.guidance || issue?.detail, section_key: issue?.section_key },
    ));
  }

  if (resolvedOperationalRelease?.can_use_for_staff_workflow === false || lower(resolvedOperationalRelease?.overall_status) === "blocked") {
    const item = Array.isArray(resolvedOperationalRelease?.blocking_items) ? resolvedOperationalRelease.blocking_items[0] || null : null;
    blockingItems.push(blockingItem(
      "operational_release",
      item?.label || resolvedOperationalRelease?.summary || "The draft should stay in staff-only holding until the strongest release blockers are cleared.",
      { detail: item?.detail, section_key: item?.section_keys },
    ));
  } else if (Number(resolvedOperationalRelease?.caution_count || 0) > 0 || resolvedOperationalRelease?.requires_staff_review) {
    const item = Array.isArray(resolvedOperationalRelease?.caution_items) ? resolvedOperationalRelease.caution_items[0] || null : null;
    cautionItems.push(cautionItem(
      "operational_release",
      item?.label || resolvedOperationalRelease?.summary || "The draft is usable, but it still needs deliberate staff mediation before wider use.",
      { severity: item?.severity, detail: item?.detail, section_key: item?.section_keys },
    ));
  }

  const overallStatus =
    blockingItems.length > 0
      ? "blocked"
      : cautionItems.length > 0
        ? "guarded"
        : "accepted";

  return {
    overall_status: overallStatus,
    can_accept_for_generation: blockingItems.length === 0,
    summary: summaryForStatus(overallStatus),
    blocker_count: blockingItems.length,
    caution_count: cautionItems.length,
    blocking_items: blockingItems,
    caution_items: cautionItems,
    generation_quality: resolvedGenerationQuality || null,
    operational_completeness: resolvedOperationalCompleteness || null,
    recommendation_coverage: resolvedRecommendationCoverage || null,
    recommendation_challenges: resolvedRecommendationChallenges || null,
    recommendation_grounding: resolvedRecommendationGrounding || null,
    recommendation_calibration: recommendationCalibration || null,
    benchmark_assessment: resolvedBenchmarkAssessment || null,
    recommendation_evidence_diversity: resolvedRecommendationEvidenceDiversity || null,
    trust_verdict: resolvedTrustVerdict || null,
    operational_release: resolvedOperationalRelease || null,
    clinical_cautions: resolvedClinicalCautions,
    safety_review_issues: resolvedSafetyIssues,
    clinical_caution_issues: resolvedClinicalCautionIssues,
    generation_brief_issues: resolvedGenerationBriefIssues,
  };
}
