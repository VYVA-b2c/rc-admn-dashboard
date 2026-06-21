import { buildHealthPlanConfidenceProfile } from "./healthPlanConfidenceProfile.js";
import { buildHealthPlanActionImpact } from "./healthPlanActionImpact.js";
import { buildHealthPlanDecisionTrace } from "./healthPlanDecisionTrace.js";
import {
  buildHealthPlanEvidenceConflicts,
  buildHealthPlanEvidenceHierarchy,
  buildHealthPlanEvidenceHierarchyBrief,
} from "./healthPlanEvidenceHierarchy.js";
import { buildHealthPlanFreshnessSnapshot } from "./healthPlanFreshness.js";
import { buildHealthPlanGenerationQuality } from "./healthPlanGenerationQuality.js";
import { buildHealthPlanLiveEvidenceSummary } from "./healthPlanLiveEvidenceSummary.js";
import { buildHealthPlanLongitudinalMemory } from "./healthPlanLongitudinalMemory.js";
import { buildHealthPlanOperationalCompleteness } from "./healthPlanOperationalCompleteness.js";
import { buildHealthPlanRecommendationImpact } from "./healthPlanRecommendationImpact.js";
import { buildHealthPlanRecommendationHistory } from "./healthPlanRecommendationHistory.js";
import { buildHealthPlanReadiness } from "./healthPlanReadiness.js";
import { buildHealthPlanBenchmarkAssessment } from "./healthPlanBenchmarkAssessment.js";
import { buildHealthPlanRecommendationEvidenceDiversity } from "./healthPlanRecommendationEvidenceDiversity.js";
import { buildHealthPlanRecommendationGrounding } from "./healthPlanRecommendationGrounding.js";
import { buildHealthPlanRecommendationCoverage } from "./healthPlanRecommendationCoverage.js";
import { buildHealthPlanRecommendationEffectiveness } from "./healthPlanRecommendationEffectiveness.js";
import { buildHealthPlanRecommendationSourceRanking } from "./healthPlanRecommendationSourceRanking.js";
import { buildHealthPlanRecommendationChallenges } from "./healthPlanRecommendationChallenges.js";
import { buildHealthPlanRecommendationRepairBrief } from "./healthPlanRecommendationRepair.js";
import { buildHealthPlanRecommendationReviewSummary } from "./healthPlanRecommendationReview.js";
import { buildHealthPlanEditorialTrace } from "./healthPlanEditorialTrace.js";
import { buildHealthPlanInterventionMemory, buildHealthPlanInterventionMemoryBrief } from "./healthPlanInterventionMemory.js";
import { buildHealthPlanClientResponseMemory } from "./healthPlanClientResponseMemory.js";
import { buildHealthPlanOutcomeScoreBrief, buildHealthPlanOutcomeScores } from "./healthPlanOutcomeScores.js";
import { buildHealthPlanRefreshStrategy } from "./healthPlanRefreshStrategy.js";
import { buildHealthPlanReviewPriorities } from "./healthPlanReviewPriorities.js";
import { buildHealthPlanEscalationGradeBrief, buildHealthPlanReviewGovernance } from "./healthPlanEscalationGrade.js";
import { buildHealthPlanEvidencePack } from "./healthPlanEvidencePack.js";
import { buildHealthPlanSignalTriage } from "./healthPlanSignalTriage.js";
import { buildHealthPlanReviewReadiness } from "./healthPlanReviewReadiness.js";
import { buildHealthPlanReviewRemediation } from "./healthPlanReviewRemediation.js";
import { buildHealthPlanImprovementActions, buildHealthPlanImprovementBrief } from "./healthPlanImprovementActions.js";
import { buildHealthPlanGenerationBrief } from "./healthPlanGenerationBrief.js";
import { findHealthPlanGenerationBriefIssues } from "./healthPlanGenerationBriefCompliance.js";
import { buildHealthPlanTrustVerdict } from "./healthPlanTrustVerdict.js";
import { buildHealthPlanExecutionBrief } from "./healthPlanExecutionBrief.js";
import { buildHealthPlanOperationalReleaseGate } from "./healthPlanOperationalReleaseGate.js";

function text(value) {
  return String(value || "").trim();
}

function objectValue(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function unique(values) {
  return [...new Set((Array.isArray(values) ? values : []).map((value) => text(value)).filter(Boolean))];
}

function normalizeTimestamp(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function compactRecommendationSurvivorship(value) {
  const survivorship = objectValue(value);
  if (!survivorship) return null;
  return {
    summary: text(survivorship.summary) || null,
    total_patterns: Number.isFinite(Number(survivorship.total_patterns)) ? Number(survivorship.total_patterns) : 0,
    durable_count: Number.isFinite(Number(survivorship.durable_count)) ? Number(survivorship.durable_count) : 0,
    emerging_count: Number.isFinite(Number(survivorship.emerging_count)) ? Number(survivorship.emerging_count) : 0,
    fragile_count: Number.isFinite(Number(survivorship.fragile_count)) ? Number(survivorship.fragile_count) : 0,
    retired_count: Number.isFinite(Number(survivorship.retired_count)) ? Number(survivorship.retired_count) : 0,
    durable: Array.isArray(survivorship.durable) ? survivorship.durable.slice(0, 6) : [],
    emerging: Array.isArray(survivorship.emerging) ? survivorship.emerging.slice(0, 6) : [],
    fragile: Array.isArray(survivorship.fragile) ? survivorship.fragile.slice(0, 6) : [],
    retired: Array.isArray(survivorship.retired) ? survivorship.retired.slice(0, 6) : [],
  };
}

function compactRecommendationRevisionMemory(value) {
  const memory = objectValue(value);
  if (!memory) return null;
  return {
    summary: text(memory.summary) || null,
    improved_count: Number.isFinite(Number(memory.improved_count)) ? Number(memory.improved_count) : 0,
    preserved_count: Number.isFinite(Number(memory.preserved_count)) ? Number(memory.preserved_count) : 0,
    unresolved_count: Number.isFinite(Number(memory.unresolved_count)) ? Number(memory.unresolved_count) : 0,
    regressed_count: Number.isFinite(Number(memory.regressed_count)) ? Number(memory.regressed_count) : 0,
    improved: Array.isArray(memory.improved) ? memory.improved.slice(0, 6) : [],
    preserved: Array.isArray(memory.preserved) ? memory.preserved.slice(0, 6) : [],
    unresolved: Array.isArray(memory.unresolved) ? memory.unresolved.slice(0, 6) : [],
    regressed: Array.isArray(memory.regressed) ? memory.regressed.slice(0, 6) : [],
  };
}

function compactRecommendationHistory(value) {
  const history = objectValue(value);
  if (!history) return null;
  return {
    overall_status: text(history.overall_status) || "limited",
    summary: text(history.summary) || null,
    improving_count: Number.isFinite(Number(history.improving_count)) ? Number(history.improving_count) : 0,
    stable_count: Number.isFinite(Number(history.stable_count)) ? Number(history.stable_count) : 0,
    deteriorating_count: Number.isFinite(Number(history.deteriorating_count)) ? Number(history.deteriorating_count) : 0,
    volatile_count: Number.isFinite(Number(history.volatile_count)) ? Number(history.volatile_count) : 0,
    limited_count: Number.isFinite(Number(history.limited_count)) ? Number(history.limited_count) : 0,
    repeated_contradiction_count: Number.isFinite(Number(history.repeated_contradiction_count)) ? Number(history.repeated_contradiction_count) : 0,
    high_priority_deteriorating_count: Number.isFinite(Number(history.high_priority_deteriorating_count)) ? Number(history.high_priority_deteriorating_count) : 0,
    items: Array.isArray(history.items) ? history.items.slice(0, 8) : [],
  };
}

function compactRecommendationEvidenceDiversity(value) {
  const diversity = objectValue(value);
  if (!diversity) return null;
  return {
    overall_status: text(diversity.overall_status) || "guarded",
    summary: text(diversity.summary) || null,
    item_count: Number.isFinite(Number(diversity.item_count)) ? Number(diversity.item_count) : 0,
    strong_count: Number.isFinite(Number(diversity.strong_count)) ? Number(diversity.strong_count) : 0,
    guarded_count: Number.isFinite(Number(diversity.guarded_count)) ? Number(diversity.guarded_count) : 0,
    fragile_count: Number.isFinite(Number(diversity.fragile_count)) ? Number(diversity.fragile_count) : 0,
    high_priority_fragile_count: Number.isFinite(Number(diversity.high_priority_fragile_count)) ? Number(diversity.high_priority_fragile_count) : 0,
    issues: Array.isArray(diversity.issues) ? diversity.issues.slice(0, 8) : [],
    items: Array.isArray(diversity.items) ? diversity.items.slice(0, 8) : [],
  };
}

function compactRecommendationReview(value) {
  const review = objectValue(value);
  if (!review) return null;
  return {
    overall_status: text(review.overall_status) || "ready",
    summary: text(review.summary) || null,
    can_mark_reviewed: Boolean(review.can_mark_reviewed),
    item_count: Number.isFinite(Number(review.item_count)) ? Number(review.item_count) : 0,
    required_count: Number.isFinite(Number(review.required_count)) ? Number(review.required_count) : 0,
    approved_count: Number.isFinite(Number(review.approved_count)) ? Number(review.approved_count) : 0,
    watch_count: Number.isFinite(Number(review.watch_count)) ? Number(review.watch_count) : 0,
    needs_edit_count: Number.isFinite(Number(review.needs_edit_count)) ? Number(review.needs_edit_count) : 0,
    missing_count: Number.isFinite(Number(review.missing_count)) ? Number(review.missing_count) : 0,
    items: Array.isArray(review.items) ? review.items.slice(0, 10) : [],
    blocking_items: Array.isArray(review.blocking_items) ? review.blocking_items.slice(0, 10) : [],
    caution_items: Array.isArray(review.caution_items) ? review.caution_items.slice(0, 10) : [],
  };
}

function compactRecommendationCalibration(value) {
  const calibration = objectValue(value);
  if (!calibration) return null;
  return {
    overall_status: text(calibration.overall_status) || "clean",
    summary: text(calibration.summary) || null,
    adjustment_count: Number.isFinite(Number(calibration.adjustment_count)) ? Number(calibration.adjustment_count) : 0,
    confidence_downgrade_count: Number.isFinite(Number(calibration.confidence_downgrade_count)) ? Number(calibration.confidence_downgrade_count) : 0,
    verification_added_count: Number.isFinite(Number(calibration.verification_added_count)) ? Number(calibration.verification_added_count) : 0,
    high_pressure_adjustment_count: Number.isFinite(Number(calibration.high_pressure_adjustment_count)) ? Number(calibration.high_pressure_adjustment_count) : 0,
    remaining_fragile_count: Number.isFinite(Number(calibration.remaining_fragile_count)) ? Number(calibration.remaining_fragile_count) : 0,
    remaining_guarded_count: Number.isFinite(Number(calibration.remaining_guarded_count)) ? Number(calibration.remaining_guarded_count) : 0,
    items: Array.isArray(calibration.items) ? calibration.items.slice(0, 10) : [],
  };
}

function compactCandidateSelection(value) {
  const selection = objectValue(value);
  if (!selection) return null;

  const compactCandidate = (candidate) => {
    const record = objectValue(candidate);
    if (!record) return null;
    return {
      candidate_id: text(record.candidate_id) || null,
      score: Number.isFinite(Number(record.score)) ? Number(record.score) : 0,
      summary: text(record.summary) || null,
      breakdown: objectValue(record.breakdown) || {},
      generator_provider: text(record.generator_provider) || null,
      generator_model: text(record.generator_model) || null,
      generator_version: text(record.generator_version) || null,
      acceptance: objectValue(record.acceptance)
        ? {
            overall_status: text(record.acceptance.overall_status) || null,
            caution_count: Number.isFinite(Number(record.acceptance.caution_count)) ? Number(record.acceptance.caution_count) : 0,
            trust_score: Number.isFinite(Number(record.acceptance.trust_score)) ? Number(record.acceptance.trust_score) : 0,
            generation_quality_score: Number.isFinite(Number(record.acceptance.generation_quality_score)) ? Number(record.acceptance.generation_quality_score) : 0,
            recommendation_coverage_score: Number.isFinite(Number(record.acceptance.recommendation_coverage_score)) ? Number(record.acceptance.recommendation_coverage_score) : 0,
            benchmark_average_score: Number.isFinite(Number(record.acceptance.benchmark_average_score)) ? Number(record.acceptance.benchmark_average_score) : 0,
          }
        : null,
    };
  };

  return {
    attempted_count: Number.isFinite(Number(selection.attempted_count)) ? Number(selection.attempted_count) : 0,
    accepted_count: Number.isFinite(Number(selection.accepted_count)) ? Number(selection.accepted_count) : 0,
    rejected_count: Number.isFinite(Number(selection.rejected_count)) ? Number(selection.rejected_count) : 0,
    selection_summary: text(selection.selection_summary) || null,
    winner: compactCandidate(selection.winner),
    ranked_candidates: Array.isArray(selection.ranked_candidates)
      ? selection.ranked_candidates.map(compactCandidate).filter(Boolean).slice(0, 3)
      : [],
  };
}

function compactOutcomePatternMemory(value) {
  const memory = objectValue(value);
  if (!memory) return null;
  return {
    summary: text(memory.summary) || null,
    total_revisions: Number.isFinite(Number(memory.total_revisions)) ? Number(memory.total_revisions) : 0,
    stable_response_anchors: Array.isArray(memory.stable_response_anchors) ? memory.stable_response_anchors.slice(0, 4) : [],
    fragile_response_anchors: Array.isArray(memory.fragile_response_anchors) ? memory.fragile_response_anchors.slice(0, 4) : [],
    preserve_patterns: Array.isArray(memory.preserve_patterns) ? memory.preserve_patterns.slice(0, 5) : [],
    watch_patterns: Array.isArray(memory.watch_patterns) ? memory.watch_patterns.slice(0, 5) : [],
    replace_patterns: Array.isArray(memory.replace_patterns) ? memory.replace_patterns.slice(0, 5) : [],
    unstable_sections: Array.isArray(memory.unstable_sections) ? memory.unstable_sections.slice(0, 5) : [],
    stable_domains: Array.isArray(memory.stable_domains) ? memory.stable_domains.slice(0, 4) : [],
    fragile_domains: Array.isArray(memory.fragile_domains) ? memory.fragile_domains.slice(0, 4) : [],
    guardrails: Array.isArray(memory.guardrails) ? memory.guardrails.slice(0, 6) : [],
  };
}

export function buildHealthPlanQualitySnapshot({
  plan = null,
  sourceSignals = [],
  criticalSignalIds = [],
  dataQualityGaps = [],
  followThrough = null,
  sectionDrift = [],
  feedbackEntries = [],
  completedActions = [],
  recommendationLearning = [],
  signalPreferenceWeights = [],
  escalationGrade = null,
  reviewGovernance = null,
  evidenceConflicts = null,
  evidenceHierarchy = null,
  confidenceProfile = null,
  freshness = null,
  refreshStrategy = null,
  recommendationSurvivorship = null,
  interventionMemory = null,
  sectionOutcomes = null,
  clientResponseMemory = null,
  cohortGuidance = null,
  reviewPriorities = null,
  generationQuality = null,
  recommendationGrounding = null,
  recommendationCoverage = null,
  benchmarkAssessment = null,
  benchmarkGuidance = null,
  liveEvidenceSummary = null,
  longitudinalMemory = null,
  recommendationChallenges = null,
  recommendationReview = null,
  recommendationChangeAudit = null,
  editorialTrace = null,
  operationalCompleteness = null,
  actionImpact = null,
  recommendationImpact = null,
  recommendationHistory = null,
  recommendationEvidenceDiversity = null,
  readiness = null,
  recommendationEffectiveness = null,
  recommendationSourceRanking = null,
  recommendationRevisionMemory = null,
  recommendationCalibration = null,
  candidateSelection = null,
  outcomePatternMemory = null,
  evidencePack = null,
  signalTriage = null,
  generationBrief = null,
  generationBriefIssues = null,
  executionBrief = null,
  recentOperationalEvents = [],
  capturedAt = null,
} = {}) {
  if (!plan) return null;

  const resolvedEvidenceConflicts = Array.isArray(evidenceConflicts)
    ? evidenceConflicts
    : buildHealthPlanEvidenceConflicts({
      sourceSignals,
      feedbackEntries,
      followThrough,
      sectionDrift,
    });
  const resolvedReviewGovernance = reviewGovernance || buildHealthPlanReviewGovernance({
    escalationGrade,
    dataQualityGaps,
    followThrough,
    evidenceConflicts: resolvedEvidenceConflicts,
  });
  const resolvedEvidenceHierarchy = Array.isArray(evidenceHierarchy)
    ? evidenceHierarchy
    : buildHealthPlanEvidenceHierarchy({
      sourceSignals,
      feedbackEntries,
    });
  const resolvedConfidenceProfile = confidenceProfile || buildHealthPlanConfidenceProfile({
    plan,
    sourceSignals,
    dataQualityGaps,
    evidenceConflicts: resolvedEvidenceConflicts,
    followThrough,
    sectionDrift,
  });
  const resolvedFreshness = freshness || buildHealthPlanFreshnessSnapshot({
    plan,
    followThrough,
    recentOperationalEvents,
    reviewGovernance: resolvedReviewGovernance,
    sectionDrift,
  });
  const resolvedRefreshStrategy = refreshStrategy || buildHealthPlanRefreshStrategy({
    freshness: resolvedFreshness,
    sectionDrift,
    reviewGovernance: resolvedReviewGovernance,
    followThrough,
  });
  const resolvedInterventionMemory = Array.isArray(interventionMemory)
    ? interventionMemory
    : buildHealthPlanInterventionMemory({
      plan,
      dataQualityGaps,
      followThrough,
      sectionDrift,
      completedActions,
      feedbackEntries,
    });
  const resolvedSectionOutcomes = Array.isArray(sectionOutcomes)
    ? sectionOutcomes
    : buildHealthPlanOutcomeScores({
      plan,
      feedbackEntries,
      followThrough,
      sectionDrift,
    });
  const resolvedClientResponseMemory = clientResponseMemory || buildHealthPlanClientResponseMemory({
    recentOperationalEvents,
    recommendationLearning,
    sectionOutcomes: resolvedSectionOutcomes,
    sourceSignals,
  });
  const resolvedLiveEvidenceSummary = liveEvidenceSummary || buildHealthPlanLiveEvidenceSummary({
    recentOperationalEvents,
  });
  const resolvedLongitudinalMemory = longitudinalMemory || buildHealthPlanLongitudinalMemory({
    liveEvidenceSummary: resolvedLiveEvidenceSummary,
  });
  const resolvedRecommendationSurvivorship = recommendationSurvivorship || null;
  const resolvedSignalTriage = signalTriage || buildHealthPlanSignalTriage(sourceSignals, criticalSignalIds);
  const resolvedEvidencePack = evidencePack || buildHealthPlanEvidencePack({
    sourceSignals,
    signalTriage: resolvedSignalTriage,
    criticalSignalIds,
    evidenceHierarchy: resolvedEvidenceHierarchy,
    evidenceConflicts: resolvedEvidenceConflicts,
    escalationGrade,
    dataQualityGaps,
    followThrough,
  });
  const resolvedReviewPriorities = reviewPriorities || buildHealthPlanReviewPriorities({
    sourceSignals,
    escalationGrade,
    reviewGovernance: resolvedReviewGovernance,
    confidenceProfile: resolvedConfidenceProfile,
    sectionOutcomes: resolvedSectionOutcomes,
    clientResponseMemory: resolvedClientResponseMemory,
    freshness: resolvedFreshness,
    refreshStrategy: resolvedRefreshStrategy,
  });
  const resolvedGenerationQuality = generationQuality || buildHealthPlanGenerationQuality({
    plan,
    reviewPriorities: resolvedReviewPriorities,
    confidenceProfile: resolvedConfidenceProfile,
  });
  const resolvedOperationalCompleteness = operationalCompleteness || buildHealthPlanOperationalCompleteness({
    plan,
    reviewPriorities: resolvedReviewPriorities,
    escalationGrade,
    liveEvidenceSummary: resolvedLiveEvidenceSummary,
  });
  const resolvedRecommendationImpact = recommendationImpact || buildHealthPlanRecommendationImpact({
    plan,
    recentOperationalEvents,
    liveEvidenceSummary: resolvedLiveEvidenceSummary,
    followThrough,
    sourceSignals,
  });
  const resolvedRecommendationEffectiveness = recommendationEffectiveness || buildHealthPlanRecommendationEffectiveness({
    recommendationLearning,
    recommendationSurvivorship: resolvedRecommendationSurvivorship,
    recommendationImpact: resolvedRecommendationImpact,
  });
  const resolvedCohortGuidance = cohortGuidance || objectValue(generationBrief?.cohort_guidance) || null;
  const resolvedRecommendationHistory = recommendationHistory || buildHealthPlanRecommendationHistory({
    recommendationImpact: resolvedRecommendationImpact,
    recommendationEffectiveness: resolvedRecommendationEffectiveness,
  });
  const resolvedRecommendationChallenges = recommendationChallenges || buildHealthPlanRecommendationChallenges({
    plan,
    sourceSignals,
    reviewPriorities: resolvedReviewPriorities,
    liveEvidenceSummary: resolvedLiveEvidenceSummary,
    longitudinalMemory: resolvedLongitudinalMemory,
  });
  const resolvedActionImpact = actionImpact || buildHealthPlanActionImpact({
    plan,
    followThrough,
    recentOperationalEvents,
    liveEvidenceSummary: resolvedLiveEvidenceSummary,
    operationalCompleteness: resolvedOperationalCompleteness,
  });
  const resolvedRecommendationSourceRanking = recommendationSourceRanking || buildHealthPlanRecommendationSourceRanking({
    plan,
    sourceSignals,
    evidenceHierarchy: resolvedEvidenceHierarchy,
    signalPreferenceWeights,
    recommendationEffectiveness: resolvedRecommendationEffectiveness,
    recommendationChallenges: resolvedRecommendationChallenges,
  });
  const resolvedRecommendationEvidenceDiversity = recommendationEvidenceDiversity || buildHealthPlanRecommendationEvidenceDiversity({
    recommendationSourceRanking: resolvedRecommendationSourceRanking,
  });
  const resolvedRecommendationGrounding = recommendationGrounding || buildHealthPlanRecommendationGrounding({
    plan,
    sourceSignals,
    evidencePack: resolvedEvidencePack,
    reviewPriorities: resolvedReviewPriorities,
    confidenceProfile: resolvedConfidenceProfile,
    recommendationSourceRanking: resolvedRecommendationSourceRanking,
  });
  const resolvedRecommendationCoverage = recommendationCoverage || buildHealthPlanRecommendationCoverage({
    plan,
    evidencePack: resolvedEvidencePack,
    reviewPriorities: resolvedReviewPriorities,
    followThrough,
  });
  const resolvedExecutionBrief = executionBrief || buildHealthPlanExecutionBrief({
    plan,
    reviewPriorities: resolvedReviewPriorities,
    escalationGrade,
    liveEvidenceSummary: resolvedLiveEvidenceSummary,
  });
  const resolvedRecommendationRepair = buildHealthPlanRecommendationRepairBrief({
    recommendationLearning,
    recommendationEffectiveness: resolvedRecommendationEffectiveness,
    recommendationGrounding: resolvedRecommendationGrounding,
    recommendationChallenges: resolvedRecommendationChallenges,
    recommendationSourceRanking: resolvedRecommendationSourceRanking,
  });
  const resolvedBenchmarkAssessment = benchmarkAssessment || buildHealthPlanBenchmarkAssessment({
    plan,
    sourceSignals,
    evidencePack: resolvedEvidencePack,
    reviewPriorities: resolvedReviewPriorities,
    confidenceProfile: resolvedConfidenceProfile,
    followThrough,
  });
  const resolvedReadiness = readiness || buildHealthPlanReadiness({
    dataQualityGaps,
    confidenceProfile: resolvedConfidenceProfile,
    reviewGovernance: resolvedReviewGovernance,
    liveEvidenceSummary: resolvedLiveEvidenceSummary,
    freshness: resolvedFreshness,
    longitudinalMemory: resolvedLongitudinalMemory,
  });
  const resolvedRecommendationReview = recommendationReview || buildHealthPlanRecommendationReviewSummary({
    plan,
    recommendationImpact: resolvedRecommendationImpact,
    recommendationHistory: resolvedRecommendationHistory,
    recommendationEvidenceDiversity: resolvedRecommendationEvidenceDiversity,
    recommendationGrounding: resolvedRecommendationGrounding,
    recommendationChallenges: resolvedRecommendationChallenges,
    recommendationReviewDecisions: plan?.recommendation_review_decisions_json || [],
  });
  const resolvedEditorialTrace = editorialTrace || buildHealthPlanEditorialTrace({ plan });
  const resolvedRecommendationChangeAudit = objectValue(recommendationChangeAudit);
  const resolvedReviewReadiness = buildHealthPlanReviewReadiness({
    reviewGovernance: resolvedReviewGovernance,
    readiness: resolvedReadiness,
    generationQuality: resolvedGenerationQuality,
    operationalCompleteness: resolvedOperationalCompleteness,
    actionImpact: resolvedActionImpact,
    recommendationImpact: resolvedRecommendationImpact,
    recommendationHistory: resolvedRecommendationHistory,
    recommendationEvidenceDiversity: resolvedRecommendationEvidenceDiversity,
    recommendationGrounding: resolvedRecommendationGrounding,
    recommendationCalibration,
    recommendationCoverage: resolvedRecommendationCoverage,
    recommendationChallenges: resolvedRecommendationChallenges,
    recommendationReview: resolvedRecommendationReview,
    recommendationChangeAudit: resolvedRecommendationChangeAudit,
    benchmarkAssessment: resolvedBenchmarkAssessment,
    editorialTrace: resolvedEditorialTrace,
  });
  const resolvedImprovementActions = buildHealthPlanImprovementActions({
    dataQualityGaps,
    followThrough,
    sectionDrift,
    completedActions,
  });
  const resolvedReviewRemediation = buildHealthPlanReviewRemediation({
    reviewReadiness: resolvedReviewReadiness,
    refreshStrategy: resolvedRefreshStrategy,
    improvementActions: buildHealthPlanImprovementBrief(resolvedImprovementActions),
    reviewGovernance: resolvedReviewGovernance,
  });
  const resolvedGenerationBrief = generationBrief || buildHealthPlanGenerationBrief({
    sourceSignals,
    signalTriage: resolvedSignalTriage,
    evidenceHierarchy: resolvedEvidenceHierarchy,
    evidencePack: resolvedEvidencePack,
    reviewPriorities: resolvedReviewPriorities,
    recommendationRepairBrief: resolvedRecommendationRepair,
    clientResponseMemory: resolvedClientResponseMemory,
    recommendationEffectiveness: resolvedRecommendationEffectiveness,
    recommendationChallenges: resolvedRecommendationChallenges,
    benchmarkGuidance: benchmarkGuidance || null,
    executionBrief: resolvedExecutionBrief,
    reviewRemediation: resolvedReviewRemediation,
    cohortGuidance: resolvedCohortGuidance,
    liveEvidenceSummary: resolvedLiveEvidenceSummary,
    longitudinalMemory: resolvedLongitudinalMemory,
    refreshStrategy: resolvedRefreshStrategy,
  });
  const resolvedGenerationBriefIssues = Array.isArray(generationBriefIssues)
    ? generationBriefIssues
    : findHealthPlanGenerationBriefIssues(plan, resolvedGenerationBrief);
  const resolvedTrustVerdict = buildHealthPlanTrustVerdict({
    generationQuality: resolvedGenerationQuality,
    operationalCompleteness: resolvedOperationalCompleteness,
    recommendationGrounding: resolvedRecommendationGrounding,
    recommendationCalibration,
    recommendationCoverage: resolvedRecommendationCoverage,
    benchmarkAssessment: resolvedBenchmarkAssessment,
    recommendationChallenges: resolvedRecommendationChallenges,
    generationBriefIssues: resolvedGenerationBriefIssues,
  });
  const resolvedOperationalRelease = buildHealthPlanOperationalReleaseGate({
    reviewGovernance: resolvedReviewGovernance,
    reviewReadiness: resolvedReviewReadiness,
    trustVerdict: resolvedTrustVerdict,
    dataQualityGaps,
    liveEvidenceSummary: resolvedLiveEvidenceSummary,
    freshness: resolvedFreshness,
    recommendationCalibration,
    benchmarkAssessment: resolvedBenchmarkAssessment,
    recommendationGrounding: resolvedRecommendationGrounding,
    recommendationEvidenceDiversity: resolvedRecommendationEvidenceDiversity,
  });
  return {
    schema_version: 1,
    captured_at: normalizeTimestamp(capturedAt) || new Date().toISOString(),
    critical_signal_ids: unique(criticalSignalIds),
    escalation_grade: escalationGrade ? buildHealthPlanEscalationGradeBrief(escalationGrade) : null,
    review_governance: resolvedReviewGovernance || null,
    confidence_profile: resolvedConfidenceProfile
      ? {
          overall_status: resolvedConfidenceProfile.overall_status || null,
          summary: text(resolvedConfidenceProfile.summary) || null,
          reasons: Array.isArray(resolvedConfidenceProfile.reasons) ? resolvedConfidenceProfile.reasons.slice(0, 5) : [],
          section_confidence: Array.isArray(resolvedConfidenceProfile.section_confidence)
            ? resolvedConfidenceProfile.section_confidence
            : [],
          adjustments: Array.isArray(resolvedConfidenceProfile.adjustments)
            ? resolvedConfidenceProfile.adjustments.slice(0, 12)
            : [],
        }
      : null,
    decision_trace: buildHealthPlanDecisionTrace({
      plan,
      sourceSignals,
      dataQualityGaps,
      followThrough,
      sectionDrift,
    }),
    evidence_hierarchy: buildHealthPlanEvidenceHierarchyBrief(resolvedEvidenceHierarchy),
    evidence_conflicts: resolvedEvidenceConflicts.slice(0, 8),
    freshness: resolvedFreshness || null,
    refresh_strategy: resolvedRefreshStrategy || null,
    review_priorities: resolvedReviewPriorities || null,
    generation_brief: resolvedGenerationBrief || null,
    generation_brief_issues: resolvedGenerationBriefIssues.slice(0, 8),
    trust_verdict: resolvedTrustVerdict || null,
    execution_brief: resolvedExecutionBrief || null,
    generation_quality: resolvedGenerationQuality || null,
    operational_completeness: resolvedOperationalCompleteness || null,
    action_impact: resolvedActionImpact || null,
    recommendation_impact: resolvedRecommendationImpact || null,
    recommendation_history: compactRecommendationHistory(resolvedRecommendationHistory),
    recommendation_review: compactRecommendationReview(resolvedRecommendationReview),
    editorial_trace: resolvedEditorialTrace || null,
    recommendation_grounding: resolvedRecommendationGrounding || null,
    recommendation_coverage: resolvedRecommendationCoverage || null,
    recommendation_repair: resolvedRecommendationRepair || null,
    benchmark_assessment: resolvedBenchmarkAssessment || null,
    live_evidence_summary: resolvedLiveEvidenceSummary || null,
    longitudinal_memory: resolvedLongitudinalMemory || null,
    readiness: resolvedReadiness || null,
    review_readiness: resolvedReviewReadiness || null,
    review_remediation: resolvedReviewRemediation || null,
    operational_release: resolvedOperationalRelease || null,
    recommendation_effectiveness: resolvedRecommendationEffectiveness || null,
    recommendation_source_ranking: resolvedRecommendationSourceRanking || null,
    recommendation_evidence_diversity: compactRecommendationEvidenceDiversity(resolvedRecommendationEvidenceDiversity),
    recommendation_challenges: resolvedRecommendationChallenges || null,
    recommendation_calibration: compactRecommendationCalibration(recommendationCalibration),
    candidate_selection: compactCandidateSelection(candidateSelection),
    outcome_pattern_memory: compactOutcomePatternMemory(outcomePatternMemory),
    intervention_memory: buildHealthPlanInterventionMemoryBrief(resolvedInterventionMemory),
    section_outcomes: buildHealthPlanOutcomeScoreBrief(resolvedSectionOutcomes),
    client_response_memory: resolvedClientResponseMemory,
    cohort_guidance: resolvedCohortGuidance,
    recommendation_change_audit: resolvedRecommendationChangeAudit,
    recommendation_survivorship: compactRecommendationSurvivorship(resolvedRecommendationSurvivorship),
    recommendation_revision_memory: compactRecommendationRevisionMemory(recommendationRevisionMemory),
  };
}

export function normalizeHealthPlanQualitySnapshot(value) {
  const snapshot = objectValue(value);
  if (!snapshot) return null;
  return {
    schema_version: Number.isFinite(Number(snapshot.schema_version)) ? Number(snapshot.schema_version) : 1,
    captured_at: normalizeTimestamp(snapshot.captured_at),
    critical_signal_ids: unique(snapshot.critical_signal_ids),
    escalation_grade: objectValue(snapshot.escalation_grade),
    review_governance: objectValue(snapshot.review_governance),
    confidence_profile: objectValue(snapshot.confidence_profile),
    decision_trace: Array.isArray(snapshot.decision_trace) ? snapshot.decision_trace : [],
    evidence_hierarchy: Array.isArray(snapshot.evidence_hierarchy) ? snapshot.evidence_hierarchy : [],
    evidence_conflicts: Array.isArray(snapshot.evidence_conflicts) ? snapshot.evidence_conflicts : [],
    freshness: objectValue(snapshot.freshness),
    refresh_strategy: objectValue(snapshot.refresh_strategy),
    review_priorities: objectValue(snapshot.review_priorities),
    generation_brief: objectValue(snapshot.generation_brief),
    generation_brief_issues: Array.isArray(snapshot.generation_brief_issues) ? snapshot.generation_brief_issues : [],
    trust_verdict: objectValue(snapshot.trust_verdict),
    execution_brief: objectValue(snapshot.execution_brief),
    generation_quality: objectValue(snapshot.generation_quality),
    operational_completeness: objectValue(snapshot.operational_completeness),
    action_impact: objectValue(snapshot.action_impact),
    recommendation_impact: objectValue(snapshot.recommendation_impact),
    recommendation_history: compactRecommendationHistory(snapshot.recommendation_history),
    recommendation_grounding: objectValue(snapshot.recommendation_grounding),
    recommendation_coverage: objectValue(snapshot.recommendation_coverage),
    recommendation_repair: objectValue(snapshot.recommendation_repair),
    benchmark_assessment: objectValue(snapshot.benchmark_assessment),
    live_evidence_summary: objectValue(snapshot.live_evidence_summary),
    longitudinal_memory: objectValue(snapshot.longitudinal_memory),
    readiness: objectValue(snapshot.readiness),
    review_readiness: objectValue(snapshot.review_readiness),
    review_remediation: objectValue(snapshot.review_remediation),
    operational_release: objectValue(snapshot.operational_release),
    recommendation_effectiveness: objectValue(snapshot.recommendation_effectiveness),
    recommendation_source_ranking: objectValue(snapshot.recommendation_source_ranking),
    recommendation_evidence_diversity: compactRecommendationEvidenceDiversity(snapshot.recommendation_evidence_diversity),
    recommendation_challenges: objectValue(snapshot.recommendation_challenges),
    recommendation_calibration: compactRecommendationCalibration(snapshot.recommendation_calibration),
    candidate_selection: compactCandidateSelection(snapshot.candidate_selection),
    outcome_pattern_memory: compactOutcomePatternMemory(snapshot.outcome_pattern_memory),
    recommendation_review: compactRecommendationReview(snapshot.recommendation_review),
    editorial_trace: objectValue(snapshot.editorial_trace),
    recommendation_change_audit: objectValue(snapshot.recommendation_change_audit),
    intervention_memory: Array.isArray(snapshot.intervention_memory) ? snapshot.intervention_memory : [],
    section_outcomes: Array.isArray(snapshot.section_outcomes) ? snapshot.section_outcomes : [],
    client_response_memory: objectValue(snapshot.client_response_memory),
    cohort_guidance: objectValue(snapshot.cohort_guidance),
    recommendation_survivorship: compactRecommendationSurvivorship(snapshot.recommendation_survivorship),
    recommendation_revision_memory: compactRecommendationRevisionMemory(snapshot.recommendation_revision_memory),
  };
}
