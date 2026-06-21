import { healthPlanGoldenCases } from "./healthPlanGoldenCases.js";
import { evaluateHealthPlanAgainstGoldenCase } from "./healthPlanGoldenCaseEvaluation.js";

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

function signalIds(sourceSignals = []) {
  return unique((Array.isArray(sourceSignals) ? sourceSignals : []).map((signal) => signal?.id));
}

function signalCategories(sourceSignals = []) {
  return unique((Array.isArray(sourceSignals) ? sourceSignals : []).map((signal) => lower(signal?.category)));
}

function jaccard(left = [], right = []) {
  const leftSet = new Set(unique(left));
  const rightSet = new Set(unique(right));
  if (!leftSet.size && !rightSet.size) return 0;
  const intersection = [...leftSet].filter((value) => rightSet.has(value)).length;
  const union = new Set([...leftSet, ...rightSet]).size;
  return union ? intersection / union : 0;
}

export function benchmarkMatchScore({
  sourceSignals = [],
  evidencePack = null,
  scenario = null,
}) {
  const actualIds = signalIds(sourceSignals);
  const scenarioIds = signalIds(scenario?.sourceSignals);
  const actualCategories = signalCategories(sourceSignals);
  const scenarioCategories = signalCategories(scenario?.sourceSignals);
  const idOverlap = jaccard(actualIds, scenarioIds);
  const categoryOverlap = jaccard(actualCategories, scenarioCategories);
  const sameDayMatch = Boolean(evidencePack?.same_day_response_required) === Boolean(scenario?.evidencePack?.same_day_response_required) ? 1 : 0;
  const actualMustAddress = unique((Array.isArray(evidencePack?.must_address_facts) ? evidencePack.must_address_facts : []).flatMap((fact) => fact?.source_signal_ids || []));
  const scenarioMustAddress = unique((Array.isArray(scenario?.evidencePack?.must_address_facts) ? scenario.evidencePack.must_address_facts : []).flatMap((fact) => fact?.source_signal_ids || []));
  const mustAddressOverlap = jaccard(actualMustAddress, scenarioMustAddress);

  return Math.round(((idOverlap * 0.45) + (categoryOverlap * 0.25) + (mustAddressOverlap * 0.2) + (sameDayMatch * 0.1)) * 100);
}

function average(values = []) {
  if (!values.length) return 0;
  return Math.round(values.reduce((total, value) => total + Number(value || 0), 0) / values.length);
}

function sortByStatus(evaluations = []) {
  const rank = { strong: 3, guarded: 2, fragile: 1 };
  return [...evaluations].sort((left, right) => {
    const byStatus = (rank[right?.overall_status] || 0) - (rank[left?.overall_status] || 0);
    if (byStatus !== 0) return byStatus;
    return Number(right?.score || 0) - Number(left?.score || 0);
  });
}

export function selectRelevantScenarios(scoredScenarios = []) {
  const sorted = [...(Array.isArray(scoredScenarios) ? scoredScenarios : [])]
    .filter((item) => Number(item?.match_score || 0) >= 35)
    .sort((left, right) => Number(right?.match_score || 0) - Number(left?.match_score || 0));

  const strongestMatch = Number(sorted[0]?.match_score || 0);
  if (!strongestMatch) return [];

  const minimumComparableScore = strongestMatch >= 75
    ? Math.max(55, strongestMatch - 20)
    : strongestMatch >= 55
      ? Math.max(45, strongestMatch - 15)
      : 35;

  return sorted
    .filter((item) => Number(item?.match_score || 0) >= minimumComparableScore)
    .slice(0, 3);
}

export function buildHealthPlanBenchmarkGuidance({
  sourceSignals = [],
  evidencePack = null,
  cases = healthPlanGoldenCases,
} = {}) {
  const relevantScenarios = selectRelevantScenarios((Array.isArray(cases) ? cases : [])
    .map((scenario) => ({
      scenario,
      match_score: benchmarkMatchScore({
        sourceSignals,
        evidencePack,
        scenario,
      }),
    })));

  if (!relevantScenarios.length) {
    return {
      summary: "No benchmark archetype matched strongly enough to guide this plan.",
      matched_case_count: 0,
      items: [],
    };
  }

  return {
    summary: `${relevantScenarios.length} benchmark archetype${relevantScenarios.length === 1 ? "" : "s"} matched this case and can be used as a drafting backstop.`,
    matched_case_count: relevantScenarios.length,
    items: relevantScenarios.map(({ scenario, match_score }) => ({
      case_id: scenario.id,
      case_label: scenario.label,
      match_score,
      same_day_response_required: Boolean(scenario?.evidencePack?.same_day_response_required),
      required_sections: unique(scenario?.expectations?.required_sections),
      required_timings: Array.isArray(scenario?.expectations?.required_timings) ? scenario.expectations.required_timings : [],
      section_keywords: Array.isArray(scenario?.expectations?.section_keywords) ? scenario.expectations.section_keywords : [],
      preserve_keywords: unique(scenario?.expectations?.preserve_keywords),
      require_verification_language: Boolean(scenario?.expectations?.require_verification_language),
      must_address_facts: Array.isArray(scenario?.evidencePack?.must_address_facts) ? scenario.evidencePack.must_address_facts : [],
      verification_needs: Array.isArray(scenario?.evidencePack?.verification_needs) ? scenario.evidencePack.verification_needs : [],
      stabilizing_facts: Array.isArray(scenario?.evidencePack?.stabilizing_facts) ? scenario.evidencePack.stabilizing_facts : [],
    })),
  };
}

export function buildHealthPlanBenchmarkAssessment({
  plan = null,
  sourceSignals = [],
  evidencePack = null,
  reviewPriorities = null,
  confidenceProfile = null,
  followThrough = null,
  cases = healthPlanGoldenCases,
} = {}) {
  const normalizedPlan = objectValue(plan);
  if (!normalizedPlan) return null;

  const relevantScenarios = selectRelevantScenarios((Array.isArray(cases) ? cases : [])
    .map((scenario) => ({
      scenario,
      match_score: benchmarkMatchScore({
        sourceSignals,
        evidencePack,
        scenario,
      }),
    })));

  if (!relevantScenarios.length) {
    return {
      summary: "No benchmark archetype matched strongly enough to score this plan yet.",
      matched_case_count: 0,
      average_score: 0,
      average_rubric_score: 0,
      overall_status: "unmatched",
      rejected: false,
      evaluations: [],
    };
  }

  const evaluations = relevantScenarios.map(({ scenario, match_score }) => {
    const evaluation = evaluateHealthPlanAgainstGoldenCase({
      ...scenario,
      reviewPriorities: scenario.reviewPriorities || reviewPriorities,
      confidenceProfile: scenario.confidenceProfile || confidenceProfile,
      followThrough: scenario.followThrough || followThrough,
    }, normalizedPlan);
    return {
      case_id: evaluation?.case_id || scenario.id,
      case_label: evaluation?.case_label || scenario.label,
      match_score,
      overall_status: evaluation?.overall_status || "guarded",
      score: Number(evaluation?.score || 0),
      issue_count: Number(evaluation?.issue_count || 0),
      rubric_overall_score: Number(evaluation?.rubric?.overall_score || 0),
      rubric_overall_status: evaluation?.rubric?.overall_status || "guarded",
      strongest_dimension: evaluation?.rubric?.strongest_dimension || null,
      weakest_dimension: evaluation?.rubric?.weakest_dimension || null,
      critical_dimension_failures: (Array.isArray(evaluation?.rubric?.dimensions) ? evaluation.rubric.dimensions : [])
        .filter((dimension) => ["owner_clarity", "fallback_completeness", "verification_clarity", "urgency_calibration"].includes(text(dimension?.id)))
        .filter((dimension) => dimension?.status === "fragile")
        .length,
      critical_dimension_ids: (Array.isArray(evaluation?.rubric?.dimensions) ? evaluation.rubric.dimensions : [])
        .filter((dimension) => ["owner_clarity", "fallback_completeness", "verification_clarity", "urgency_calibration"].includes(text(dimension?.id)))
        .filter((dimension) => dimension?.status === "fragile")
        .map((dimension) => dimension.id),
      top_issue: Array.isArray(evaluation?.issues) ? evaluation.issues[0] || null : null,
    };
  });

  const averageScore = average(evaluations.map((item) => item.score));
  const averageRubricScore = average(evaluations.map((item) => item.rubric_overall_score));
  const sorted = sortByStatus(evaluations);
  const strongestCase = sorted[0] || null;
  const weakestCase = [...sorted].reverse()[0] || null;
  const overallStatus =
    evaluations.some((item) => item.overall_status === "fragile")
      ? "fragile"
      : evaluations.some((item) => item.overall_status === "guarded")
        ? "guarded"
        : "strong";

  const summary =
    overallStatus === "strong"
      ? `${evaluations.length} benchmark archetype${evaluations.length === 1 ? "" : "s"} matched, and the plan is holding up well across them.`
      : overallStatus === "guarded"
        ? `${evaluations.length} benchmark archetype${evaluations.length === 1 ? "" : "s"} matched, but one or more patterns still need tighter guidance.`
        : `${evaluations.length} benchmark archetype${evaluations.length === 1 ? "" : "s"} matched, and at least one relevant pattern still shows fragile guidance.`;

  return {
    summary,
    matched_case_count: evaluations.length,
    average_score: averageScore,
    average_rubric_score: averageRubricScore,
    overall_status: overallStatus,
    rejected: shouldRejectHealthPlanBenchmarkAssessment({
      matched_case_count: evaluations.length,
      evaluations,
      overall_status: overallStatus,
    }),
    strongest_case_id: strongestCase?.case_id || null,
    weakest_case_id: weakestCase?.case_id || null,
    evaluations,
  };
}

export function shouldRejectHealthPlanBenchmarkAssessment(summary) {
  const normalized = objectValue(summary);
  if (!normalized || Number(normalized?.matched_case_count || 0) === 0) return false;
  const evaluations = Array.isArray(normalized.evaluations) ? normalized.evaluations : [];
  return evaluations.some((evaluation) =>
    Number(evaluation?.match_score || 0) >= 70
    && (
      text(evaluation?.overall_status) === "fragile"
      || text(evaluation?.rubric_overall_status) === "fragile"
      || Number(evaluation?.critical_dimension_failures || 0) > 0
    )
  );
}
