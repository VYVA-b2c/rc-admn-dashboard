function text(value) {
  return String(value || "").trim();
}

function lower(value) {
  return text(value).toLowerCase();
}

function objectValue(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function clamp(value, minimum = 0, maximum = 100) {
  return Math.min(maximum, Math.max(minimum, Number(value || 0)));
}

function numeric(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function statusScore(value, scores = {}, fallback = 0) {
  const normalized = lower(value);
  return Object.prototype.hasOwnProperty.call(scores, normalized) ? scores[normalized] : fallback;
}

function issuePenalty(items = [], highWeight = 8, mediumWeight = 4, lowWeight = 2) {
  return (Array.isArray(items) ? items : []).reduce((total, item) => {
    const severity = lower(item?.severity);
    if (severity === "high") return total + highWeight;
    if (severity === "medium") return total + mediumWeight;
    return total + lowWeight;
  }, 0);
}

function recommendationGroundingScore(summary = null) {
  const normalized = objectValue(summary);
  if (!normalized) return 72;
  const base = statusScore(normalized?.overall_status, { strong: 94, guarded: 76, fragile: 40 }, 72);
  return clamp(base - issuePenalty(normalized?.issues, 10, 5, 2));
}

function evidenceDiversityScore(summary = null) {
  const normalized = objectValue(summary);
  if (!normalized) return 72;
  const itemCount = Math.max(0, numeric(normalized?.item_count, 0));
  if (!itemCount) {
    return statusScore(normalized?.overall_status, { strong: 92, guarded: 74, fragile: 46 }, 72);
  }
  const strongCount = Math.max(0, numeric(normalized?.strong_count, 0));
  const guardedCount = Math.max(0, numeric(normalized?.guarded_count, 0));
  const fragileCount = Math.max(0, numeric(normalized?.fragile_count, 0));
  const weighted = ((strongCount * 1) + (guardedCount * 0.62) + (fragileCount * 0.24)) / itemCount;
  return clamp(Math.round(weighted * 100));
}

function operationalReleaseScore(summary = null) {
  const normalized = objectValue(summary);
  if (!normalized) return 70;
  const base = statusScore(normalized?.overall_status, { shareable: 96, staff_guided: 80, blocked: 24 }, 70);
  const cautionPenalty = numeric(normalized?.caution_count, 0) * 3;
  return clamp(base - cautionPenalty);
}

function operationalCompletenessScore(summary = null) {
  const normalized = objectValue(summary);
  if (!normalized) return 72;
  const base = statusScore(normalized?.overall_status, { strong: 94, guarded: 76, fragile: 38 }, 72);
  return clamp(base - issuePenalty(normalized?.issues, 10, 5, 2));
}

function benchmarkScore(summary = null) {
  const normalized = objectValue(summary);
  if (!normalized) return 72;
  const averageScore = numeric(normalized?.average_score, NaN);
  if (Number.isFinite(averageScore) && averageScore > 0) return clamp(averageScore);
  return statusScore(normalized?.overall_status, { strong: 92, guarded: 74, fragile: 42, unmatched: 70 }, 72);
}

function calibrationPenalty(summary = null) {
  const normalized = objectValue(summary);
  if (!normalized) return 0;
  return (
    (numeric(normalized?.adjustment_count, 0) * 1.5)
    + (numeric(normalized?.high_pressure_adjustment_count, 0) * 4)
    + (numeric(normalized?.remaining_fragile_count, 0) * 6)
    + (numeric(normalized?.remaining_guarded_count, 0) * 2)
  );
}

function resolveAcceptance(candidate = null) {
  return objectValue(candidate?.acceptance) || objectValue(candidate?.draft_acceptance) || null;
}

export function scoreHealthPlanCandidate(candidate = null) {
  const acceptance = resolveAcceptance(candidate);
  if (!acceptance) {
    return {
      score: 0,
      accepted: false,
      breakdown: {},
      summary: "This candidate has no acceptance summary to score.",
    };
  }

  const trustScore = clamp(numeric(acceptance?.trust_verdict?.trust_score, statusScore(acceptance?.trust_verdict?.overall_status, {
    trusted: 92,
    guarded: 74,
    fragile: 36,
  }, 72)));
  const generationQualityScore = clamp(numeric(
    acceptance?.generation_quality?.score,
    statusScore(acceptance?.generation_quality?.overall_status, { strong: 92, guarded: 74, fragile: 38 }, 72),
  ));
  const coverageScore = clamp(numeric(
    acceptance?.recommendation_coverage?.score,
    statusScore(acceptance?.recommendation_coverage?.overall_status, { strong: 92, guarded: 74, fragile: 38 }, 72),
  ));
  const groundingScore = recommendationGroundingScore(acceptance?.recommendation_grounding);
  const diversityScore = evidenceDiversityScore(acceptance?.recommendation_evidence_diversity);
  const releaseScore = operationalReleaseScore(acceptance?.operational_release);
  const completenessScore = operationalCompletenessScore(acceptance?.operational_completeness);
  const matchedBenchmarkScore = benchmarkScore(acceptance?.benchmark_assessment);
  const cautionPenalty = numeric(acceptance?.caution_count, 0) * 3.5;
  const calibrationCost = calibrationPenalty(acceptance?.recommendation_calibration);

  const weightedScore = (
    (trustScore * 0.24)
    + (generationQualityScore * 0.17)
    + (coverageScore * 0.16)
    + (groundingScore * 0.11)
    + (diversityScore * 0.08)
    + (releaseScore * 0.08)
    + (completenessScore * 0.08)
    + (matchedBenchmarkScore * 0.08)
  ) - cautionPenalty - calibrationCost;

  const score = clamp(Math.round(weightedScore));
  const accepted = Boolean(acceptance?.can_accept_for_generation);
  const summary = accepted
    ? `Accepted candidate with trust ${trustScore}, coverage ${coverageScore}, and ${numeric(acceptance?.caution_count, 0)} remaining caution item${numeric(acceptance?.caution_count, 0) === 1 ? "" : "s"}.`
    : "Rejected candidate.";

  return {
    score,
    accepted,
    breakdown: {
      trust_score: trustScore,
      generation_quality_score: generationQualityScore,
      recommendation_coverage_score: coverageScore,
      recommendation_grounding_score: groundingScore,
      recommendation_evidence_diversity_score: diversityScore,
      operational_release_score: releaseScore,
      operational_completeness_score: completenessScore,
      benchmark_score: matchedBenchmarkScore,
      caution_penalty: cautionPenalty,
      calibration_penalty: calibrationCost,
    },
    summary,
  };
}

function compareCandidates(left, right) {
  const leftScore = numeric(left?.candidate_score?.score, 0);
  const rightScore = numeric(right?.candidate_score?.score, 0);
  if (rightScore !== leftScore) return rightScore - leftScore;

  const leftTrust = numeric(left?.acceptance?.trust_verdict?.trust_score, 0);
  const rightTrust = numeric(right?.acceptance?.trust_verdict?.trust_score, 0);
  if (rightTrust !== leftTrust) return rightTrust - leftTrust;

  const leftCautions = numeric(left?.acceptance?.caution_count, 0);
  const rightCautions = numeric(right?.acceptance?.caution_count, 0);
  if (leftCautions !== rightCautions) return leftCautions - rightCautions;

  const leftCalibration = numeric(left?.acceptance?.recommendation_calibration?.adjustment_count, 0);
  const rightCalibration = numeric(right?.acceptance?.recommendation_calibration?.adjustment_count, 0);
  if (leftCalibration !== rightCalibration) return leftCalibration - rightCalibration;

  const leftBenchmark = numeric(left?.acceptance?.benchmark_assessment?.average_score, 0);
  const rightBenchmark = numeric(right?.acceptance?.benchmark_assessment?.average_score, 0);
  return rightBenchmark - leftBenchmark;
}

export function selectBestHealthPlanCandidate(candidates = []) {
  const attemptedCount = Array.isArray(candidates) ? candidates.length : 0;
  const rankedCandidates = (Array.isArray(candidates) ? candidates : [])
    .map((candidate, index) => {
      const acceptance = resolveAcceptance(candidate);
      return {
        ...candidate,
        acceptance,
        candidate_id: text(candidate?.candidate_id) || `candidate-${index + 1}`,
        candidate_score: scoreHealthPlanCandidate({ ...candidate, acceptance }),
      };
    })
    .filter((candidate) => candidate?.acceptance?.can_accept_for_generation)
    .sort(compareCandidates);

  if (!rankedCandidates.length) {
    return {
      winner: null,
      ranked_candidates: [],
      attempted_count: attemptedCount,
      accepted_count: 0,
      rejected_count: attemptedCount,
      selection_summary: "No accepted health-plan candidates were available to rank.",
    };
  }

  const winner = rankedCandidates[0];
  const runnerUp = rankedCandidates[1] || null;
  const margin = runnerUp
    ? numeric(winner?.candidate_score?.score, 0) - numeric(runnerUp?.candidate_score?.score, 0)
    : numeric(winner?.candidate_score?.score, 0);

  return {
    winner,
    ranked_candidates: rankedCandidates,
    attempted_count: attemptedCount,
    accepted_count: rankedCandidates.length,
    rejected_count: Math.max(0, attemptedCount - rankedCandidates.length),
    selection_summary: runnerUp
      ? `Selected ${winner.candidate_id} with a ${margin}-point edge over the next-best accepted draft.`
      : `Selected ${winner.candidate_id} as the only accepted draft.`,
  };
}

export function buildHealthPlanCandidateSelectionSnapshot(selection = null) {
  const normalized = objectValue(selection);
  if (!normalized) return null;

  const compactCandidate = (candidate = null, includeAcceptance = false) => {
    const record = objectValue(candidate);
    if (!record) return null;
    const acceptance = resolveAcceptance(record);
    return {
      candidate_id: text(record?.candidate_id) || null,
      score: numeric(record?.candidate_score?.score, 0),
      summary: text(record?.candidate_score?.summary) || null,
      breakdown: objectValue(record?.candidate_score?.breakdown) || {},
      generator_provider: text(record?.plan?.generator_provider) || null,
      generator_model: text(record?.plan?.generator_model) || null,
      generator_version: text(record?.plan?.generator_version) || null,
      ...(includeAcceptance && acceptance
        ? {
            acceptance: {
              overall_status: text(acceptance?.overall_status) || null,
              caution_count: numeric(acceptance?.caution_count, 0),
              trust_score: numeric(acceptance?.trust_verdict?.trust_score, 0),
              generation_quality_score: numeric(acceptance?.generation_quality?.score, 0),
              recommendation_coverage_score: numeric(acceptance?.recommendation_coverage?.score, 0),
              benchmark_average_score: numeric(acceptance?.benchmark_assessment?.average_score, 0),
            },
          }
        : {}),
    };
  };

  return {
    attempted_count: numeric(normalized?.attempted_count, 0),
    accepted_count: numeric(normalized?.accepted_count, 0),
    rejected_count: numeric(normalized?.rejected_count, 0),
    selection_summary: text(normalized?.selection_summary) || null,
    winner: compactCandidate(normalized?.winner, true),
    ranked_candidates: (Array.isArray(normalized?.ranked_candidates) ? normalized.ranked_candidates : [])
      .map((candidate) => compactCandidate(candidate, true))
      .filter(Boolean)
      .slice(0, 3),
  };
}
