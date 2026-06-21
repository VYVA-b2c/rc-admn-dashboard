import { getHealthPlanGoldenCase } from "./healthPlanGoldenCases.js";
import { evaluateHealthPlanAgainstGoldenCase } from "./healthPlanGoldenCaseEvaluation.js";
import { healthPlanBenchmarkReplayFixtures } from "./healthPlanBenchmarkReplayFixtures.js";

function text(value) {
  return String(value || "").trim();
}

function objectValue(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function normalizeScore(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function statusRank(value) {
  if (value === "strong") return 3;
  if (value === "guarded") return 2;
  return 1;
}

function outcomeStatusRank(value) {
  if (value === "contradicted") return 4;
  if (value === "mixed") return 3;
  if (value === "limited") return 2;
  if (value === "reinforcing") return 1;
  return 0;
}

function normalizeOutcomeStatus(value) {
  const normalized = text(value).toLowerCase();
  if (normalized === "reinforced") return "reinforcing";
  if (["reinforcing", "mixed", "contradicted", "limited"].includes(normalized)) return normalized;
  return null;
}

function compareEvaluations(previous = null, current = null) {
  const previousScore = normalizeScore(previous?.score);
  const currentScore = normalizeScore(current?.score);
  const previousRubric = normalizeScore(previous?.rubric?.overall_score);
  const currentRubric = normalizeScore(current?.rubric?.overall_score);
  const previousStatus = text(previous?.overall_status) || "fragile";
  const currentStatus = text(current?.overall_status) || "fragile";
  return {
    score_delta: currentScore - previousScore,
    rubric_score_delta: currentRubric - previousRubric,
    status_delta: statusRank(currentStatus) - statusRank(previousStatus),
    improved: currentScore > previousScore || statusRank(currentStatus) > statusRank(previousStatus),
    regressed: currentScore < previousScore || statusRank(currentStatus) < statusRank(previousStatus),
  };
}

function topCounts(items = [], key) {
  const counts = new Map();
  for (const item of Array.isArray(items) ? items : []) {
    const itemKey = text(item?.[key]);
    if (!itemKey) continue;
    counts.set(itemKey, (counts.get(itemKey) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([id, count]) => ({ id, count }));
}

function dimensionHotspots(evaluations = []) {
  const failures = [];
  for (const evaluation of Array.isArray(evaluations) ? evaluations : []) {
    const dimensions = Array.isArray(evaluation?.rubric?.dimensions) ? evaluation.rubric.dimensions : [];
    for (const dimension of dimensions) {
      if (text(dimension?.status) !== "fragile") continue;
      failures.push({
        dimension_id: text(dimension?.id),
      });
    }
  }
  return topCounts(failures, "dimension_id");
}

function issueHotspots(evaluations = []) {
  const issues = [];
  for (const evaluation of Array.isArray(evaluations) ? evaluations : []) {
    for (const issue of Array.isArray(evaluation?.issues) ? evaluation.issues : []) {
      issues.push({ issue_type: text(issue?.type) });
    }
  }
  return topCounts(issues, "issue_type");
}

function uniqueObjectsById(items = []) {
  const seen = new Set();
  const result = [];
  for (const item of Array.isArray(items) ? items : []) {
    const id = text(item?.id);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    result.push(item);
  }
  return result;
}

function replayDimensionAction(dimensionId) {
  if (dimensionId === "owner_clarity") {
    return {
      id: "tighten_owner_clarity",
      priority: "high",
      label: "Tighten owner clarity",
      action_text: "Rewrite pressured recommendations so the acting owner is explicit across monitoring, escalation, and caregiver guidance.",
    };
  }
  if (dimensionId === "fallback_completeness") {
    return {
      id: "tighten_fallback_completeness",
      priority: "high",
      label: "Add fallback paths",
      action_text: "Make the fallback route explicit whenever first outreach, verification, or caregiver reinforcement may fail.",
    };
  }
  if (dimensionId === "verification_clarity") {
    return {
      id: "tighten_verification_clarity",
      priority: "high",
      label: "Strengthen verification language",
      action_text: "Rewrite recommendations so live uncertainty is named clearly and the needed confirmation step is explicit.",
    };
  }
  if (dimensionId === "urgency_calibration") {
    return {
      id: "tighten_urgency_calibration",
      priority: "high",
      label: "Raise urgency calibration",
      action_text: "Align wording and timing with same-day pressure when the benchmark scenario requires immediate action.",
    };
  }
  if (dimensionId === "support_continuity") {
    return {
      id: "protect_support_continuity",
      priority: "medium",
      label: "Protect stabilizing routines",
      action_text: "Preserve the support routines and stabilizing anchors that should survive the rewrite instead of dropping them too early.",
    };
  }
  if (dimensionId === "caregiver_usability") {
    return {
      id: "improve_caregiver_usability",
      priority: "medium",
      label: "Clarify caregiver steps",
      action_text: "Turn caregiver guidance into practical, consent-safe steps with a clear report-back loop.",
    };
  }
  return null;
}

function replayIssueAction(issueType) {
  if (issueType === "required_timing_missing") {
    return {
      id: "restore_required_timing",
      priority: "high",
      label: "Restore required timing",
      action_text: "Make sure the affected section carries the timing pressure the scenario expects, especially same-day or this-week language.",
    };
  }
  if (issueType === "verification_language_missing") {
    return {
      id: "restore_verification_language",
      priority: "high",
      label: "Restore verification wording",
      action_text: "Add explicit confirm, verify, re-check, or do-not-assume language to the affected recommendations.",
    };
  }
  if (issueType === "challenge_reject") {
    return {
      id: "repair_high_risk_recommendations",
      priority: "high",
      label: "Repair challenged recommendations",
      action_text: "Rewrite high-risk recommendations that still sound too optimistic, too vague, or missing a fallback path.",
    };
  }
  if (issueType === "coverage_reject") {
    return {
      id: "restore_evidence_coverage",
      priority: "high",
      label: "Restore evidence coverage",
      action_text: "Make sure the plan covers the must-address and verification signals instead of drifting into generic reassurance.",
    };
  }
  if (issueType === "generation_quality_reject") {
    return {
      id: "repair_generation_quality",
      priority: "high",
      label: "Repair generation quality",
      action_text: "Rework the affected draft so quality gates pass before the plan is trusted for reuse.",
    };
  }
  if (issueType === "stabilizing_anchor_missing") {
    return {
      id: "restore_stabilizing_anchors",
      priority: "medium",
      label: "Restore stabilizing anchors",
      action_text: "Bring back the stabilizing routines that the benchmark scenario expects staff to preserve.",
    };
  }
  return null;
}

function replayOutcomeAction(track = {}) {
  if (normalizeScore(track?.latest_high_priority_contradicted_recommendation_count) > 0) {
    return {
      id: "replace_contradicted_high_priority_recommendations",
      priority: "high",
      label: "Replace contradicted high-priority recommendations",
      action_text: "The latest saved outcome snapshot shows high-priority recommendations failing in practice. Replace them instead of carrying them forward.",
    };
  }
  if (normalizeScore(track?.latest_recommendation_retire_count) > 0) {
    return {
      id: "retire_contradicted_recommendations",
      priority: "high",
      label: "Retire contradicted recommendations",
      action_text: "Retire the recommendations that later evidence is rejecting instead of lightly polishing them.",
    };
  }
  if (normalizeOutcomeStatus(track?.latest_action_impact_status) === "contradicted") {
    return {
      id: "rewrite_contradicted_action_sections",
      priority: "high",
      label: "Rewrite contradicted action sections",
      action_text: "One or more action sections are being contradicted after rollout. Rewrite the routine, owner, or fallback before trusting this plan again.",
    };
  }
  if (normalizeOutcomeStatus(track?.latest_outcome_status) === "mixed") {
    return {
      id: "tighten_real_world_verification_loop",
      priority: "medium",
      label: "Tighten the real-world proof loop",
      action_text: "Benchmarks may look acceptable, but live follow-through is still mixed. Add clearer verification, fallback, and report-back steps.",
    };
  }
  return null;
}

function buildReplayRecommendedActions(evaluations = []) {
  const actions = [];
  for (const track of Array.isArray(evaluations) ? evaluations : []) {
    for (const dimensionId of Array.isArray(track?.unresolved_critical_dimensions) ? track.unresolved_critical_dimensions : []) {
      const action = replayDimensionAction(dimensionId);
      if (!action) continue;
      actions.push({
        ...action,
        track_id: track.track_id,
        scenario_id: track.scenario_id,
      });
    }
    for (const issueType of Array.isArray(track?.latest_issue_types) ? track.latest_issue_types : []) {
      const action = replayIssueAction(issueType);
      if (!action) continue;
      actions.push({
        ...action,
        track_id: track.track_id,
        scenario_id: track.scenario_id,
      });
    }
    const outcomeAction = replayOutcomeAction(track);
    if (outcomeAction) {
      actions.push({
        ...outcomeAction,
        track_id: track.track_id,
        scenario_id: track.scenario_id,
      });
    }
  }
  return uniqueObjectsById(actions).slice(0, 8);
}

function normalizeReplayThresholds(thresholds = {}) {
  return {
    min_average_latest_score: Number.isFinite(Number(thresholds?.min_average_latest_score))
      ? Number(thresholds.min_average_latest_score)
      : 90,
    min_track_latest_score: Number.isFinite(Number(thresholds?.min_track_latest_score))
      ? Number(thresholds.min_track_latest_score)
      : 85,
    max_regressed_count: Number.isFinite(Number(thresholds?.max_regressed_count))
      ? Number(thresholds.max_regressed_count)
      : 0,
    max_guarded_or_fragile_count: Number.isFinite(Number(thresholds?.max_guarded_or_fragile_count))
      ? Number(thresholds.max_guarded_or_fragile_count)
      : 0,
    max_contradicted_outcome_count: Number.isFinite(Number(thresholds?.max_contradicted_outcome_count))
      ? Number(thresholds.max_contradicted_outcome_count)
      : 0,
    allow_unresolved_critical_dimensions: thresholds?.allow_unresolved_critical_dimensions === true,
  };
}

export function buildHealthPlanBenchmarkReplayGate(suite = null, thresholds = {}) {
  const summary = objectValue(suite);
  const normalizedThresholds = normalizeReplayThresholds(thresholds);
  if (!summary) return null;

  const blocking_reasons = [];
  if (normalizeScore(summary?.regressed_count) > normalizedThresholds.max_regressed_count) {
    blocking_reasons.push(`${summary.regressed_count} replay track${summary.regressed_count === 1 ? "" : "s"} regressed.`);
  }
  if (normalizeScore(summary?.guarded_or_fragile_count) > normalizedThresholds.max_guarded_or_fragile_count) {
    blocking_reasons.push(`${summary.guarded_or_fragile_count} replay track${summary.guarded_or_fragile_count === 1 ? "" : "s"} still finish guarded or fragile.`);
  }
  if (normalizeScore(summary?.contradicted_outcome_count) > normalizedThresholds.max_contradicted_outcome_count) {
    blocking_reasons.push(`${summary.contradicted_outcome_count} replay track${summary.contradicted_outcome_count === 1 ? "" : "s"} are being contradicted by later saved outcomes.`);
  }
  if (normalizeScore(summary?.average_latest_score) < normalizedThresholds.min_average_latest_score) {
    blocking_reasons.push(`Average latest replay score ${summary.average_latest_score} is below the release floor of ${normalizedThresholds.min_average_latest_score}.`);
  }

  const weakTracks = (Array.isArray(summary?.tracks) ? summary.tracks : [])
    .filter((track) =>
      normalizeScore(track?.latest_score) < normalizedThresholds.min_track_latest_score
      || text(track?.latest_status) !== "strong"
      || normalizeOutcomeStatus(track?.latest_outcome_status) === "contradicted"
      || normalizeScore(track?.latest_high_priority_contradicted_recommendation_count) > 0
      || (!normalizedThresholds.allow_unresolved_critical_dimensions && Array.isArray(track?.unresolved_critical_dimensions) && track.unresolved_critical_dimensions.length > 0)
    )
    .map((track) => ({
      track_id: track.track_id,
      track_label: track.track_label,
      latest_status: track.latest_status,
      latest_score: track.latest_score,
      latest_outcome_status: track.latest_outcome_status,
      latest_outcome_pressure_score: track.latest_outcome_pressure_score,
      latest_high_priority_contradicted_recommendation_count: track.latest_high_priority_contradicted_recommendation_count,
      latest_recommendation_retire_count: track.latest_recommendation_retire_count,
      latest_action_impact_status: track.latest_action_impact_status,
      unresolved_critical_dimensions: track.unresolved_critical_dimensions,
      latest_issue_types: track.latest_issue_types,
    }));

  if (weakTracks.length > 0) {
    blocking_reasons.push(`${weakTracks.length} replay track${weakTracks.length === 1 ? "" : "s"} still fall below the per-track release floor.`);
  }

  const recommended_actions = buildReplayRecommendedActions(weakTracks.length > 0 ? weakTracks : summary?.tracks);
  const passed = blocking_reasons.length === 0;
  return {
    status: passed ? "passed" : "failed",
    passed,
    thresholds: normalizedThresholds,
    blocking_reasons,
    weak_tracks: weakTracks.slice(0, 5),
    recommended_actions,
    summary: passed
      ? "Benchmark replay gate passed. Known scenarios are holding strong enough for this change set."
      : "Benchmark replay gate failed. Known scenarios still show regression or weak spots that should be fixed before relying on this change set.",
  };
}

export function evaluateHealthPlanBenchmarkReplayTrack(track = null) {
  const normalizedTrack = objectValue(track);
  const scenario = getHealthPlanGoldenCase(normalizedTrack?.scenario_id);
  if (!normalizedTrack || !scenario) return null;

  const snapshots = (Array.isArray(normalizedTrack.snapshots) ? normalizedTrack.snapshots : [])
    .map((item) => {
      const evaluation = evaluateHealthPlanAgainstGoldenCase(scenario, item?.plan);
      return evaluation
        ? {
            revision_id: text(item?.revision_id) || null,
            label: text(item?.label) || null,
            outcome_summary: objectValue(item?.outcome_summary) || null,
            evaluation,
          }
        : null;
    })
    .filter(Boolean);

  if (!snapshots.length) return null;

  const baseline = snapshots[0];
  const latest = snapshots[snapshots.length - 1];
  const progression = compareEvaluations(baseline?.evaluation, latest?.evaluation);
  const baselineOutcome = objectValue(baseline?.outcome_summary) || null;
  const latestOutcome = objectValue(latest?.outcome_summary) || null;
  const intermediate_regressions = [];
  for (let index = 1; index < snapshots.length; index += 1) {
    const previous = snapshots[index - 1];
    const current = snapshots[index];
    const delta = compareEvaluations(previous?.evaluation, current?.evaluation);
    if (delta.regressed) {
      intermediate_regressions.push({
        from_revision_id: previous?.revision_id || null,
        to_revision_id: current?.revision_id || null,
        score_delta: delta.score_delta,
        rubric_score_delta: delta.rubric_score_delta,
      });
    }
  }

  const contradictedOutcomeVersions = snapshots.filter((item) =>
    normalizeOutcomeStatus(item?.outcome_summary?.overall_status) === "contradicted").length;
  const mixedOutcomeVersions = snapshots.filter((item) =>
    normalizeOutcomeStatus(item?.outcome_summary?.overall_status) === "mixed").length;
  const reinforcingOutcomeVersions = snapshots.filter((item) =>
    normalizeOutcomeStatus(item?.outcome_summary?.overall_status) === "reinforcing").length;
  const outcomeSeverityDelta =
    outcomeStatusRank(normalizeOutcomeStatus(latestOutcome?.overall_status))
    - outcomeStatusRank(normalizeOutcomeStatus(baselineOutcome?.overall_status));

  return {
    track_id: normalizedTrack.id,
    track_label: normalizedTrack.label,
    scenario_id: scenario.id,
    scenario_label: scenario.label,
    snapshot_count: snapshots.length,
    baseline_revision_id: baseline?.revision_id || null,
    latest_revision_id: latest?.revision_id || null,
    baseline_status: baseline?.evaluation?.overall_status || "fragile",
    latest_status: latest?.evaluation?.overall_status || "fragile",
    baseline_score: normalizeScore(baseline?.evaluation?.score),
    latest_score: normalizeScore(latest?.evaluation?.score),
    baseline_rubric_score: normalizeScore(baseline?.evaluation?.rubric?.overall_score),
    latest_rubric_score: normalizeScore(latest?.evaluation?.rubric?.overall_score),
    score_delta: progression.score_delta,
    rubric_score_delta: progression.rubric_score_delta,
    improved: progression.improved,
    regressed: progression.regressed,
    baseline_outcome_status: normalizeOutcomeStatus(baselineOutcome?.overall_status),
    latest_outcome_status: normalizeOutcomeStatus(latestOutcome?.overall_status),
    latest_action_impact_status: normalizeOutcomeStatus(latestOutcome?.action_impact_status),
    latest_recommendation_impact_status: normalizeOutcomeStatus(latestOutcome?.recommendation_impact_status),
    latest_outcome_pressure_score: normalizeScore(latestOutcome?.pressure_score),
    latest_outcome_summary: text(latestOutcome?.summary) || null,
    latest_outcome_watchouts: Array.isArray(latestOutcome?.watchouts) ? latestOutcome.watchouts.map((item) => text(item)).filter(Boolean) : [],
    latest_high_priority_contradicted_recommendation_count: normalizeScore(latestOutcome?.high_priority_contradicted_recommendation_count),
    latest_recommendation_retire_count: normalizeScore(latestOutcome?.recommendation_retire_count),
    latest_recommendation_rework_count: normalizeScore(latestOutcome?.recommendation_rework_count),
    latest_action_contradicted_count: normalizeScore(latestOutcome?.action_contradicted_count),
    contradicted_outcome_versions: contradictedOutcomeVersions,
    mixed_outcome_versions: mixedOutcomeVersions,
    reinforcing_outcome_versions: reinforcingOutcomeVersions,
    outcome_severity_delta: outcomeSeverityDelta,
    intermediate_regressions,
    unresolved_critical_dimensions: (Array.isArray(latest?.evaluation?.rubric?.dimensions) ? latest.evaluation.rubric.dimensions : [])
      .filter((dimension) => text(dimension?.status) === "fragile")
      .map((dimension) => text(dimension?.id))
      .filter(Boolean),
    latest_issue_types: (Array.isArray(latest?.evaluation?.issues) ? latest.evaluation.issues : [])
      .map((issue) => text(issue?.type))
      .filter(Boolean),
    snapshots,
  };
}

export function evaluateHealthPlanBenchmarkReplaySuite(tracks = healthPlanBenchmarkReplayFixtures) {
  const evaluations = (Array.isArray(tracks) ? tracks : [])
    .map((track) => evaluateHealthPlanBenchmarkReplayTrack(track))
    .filter(Boolean);

  const improvedCount = evaluations.filter((item) => item.improved && !item.regressed).length;
  const regressedCount = evaluations.filter((item) => item.regressed).length;
  const guardedOrFragileCount = evaluations.filter((item) => ["guarded", "fragile"].includes(text(item?.latest_status))).length;
  const contradictedOutcomeCount = evaluations.filter((item) => normalizeOutcomeStatus(item?.latest_outcome_status) === "contradicted").length;
  const mixedOutcomeCount = evaluations.filter((item) => normalizeOutcomeStatus(item?.latest_outcome_status) === "mixed").length;
  const reinforcingOutcomeCount = evaluations.filter((item) => normalizeOutcomeStatus(item?.latest_outcome_status) === "reinforcing").length;
  const averageLatestScore = evaluations.length
    ? Math.round(evaluations.reduce((total, item) => total + normalizeScore(item?.latest_score), 0) / evaluations.length)
    : 0;
  const averageOutcomePressureScore = evaluations.length
    ? Math.round(evaluations.reduce((total, item) => total + normalizeScore(item?.latest_outcome_pressure_score), 0) / evaluations.length)
    : 0;
  const averageScoreDelta = evaluations.length
    ? Math.round((evaluations.reduce((total, item) => total + normalizeScore(item?.score_delta), 0) / evaluations.length) * 10) / 10
    : 0;
  const weakestTracks = [...evaluations]
    .sort((left, right) => normalizeScore(left?.latest_score) - normalizeScore(right?.latest_score))
    .slice(0, 3)
    .map((item) => ({
      track_id: item.track_id,
      track_label: item.track_label,
      latest_status: item.latest_status,
      latest_score: item.latest_score,
      unresolved_critical_dimensions: item.unresolved_critical_dimensions,
    }));

  const allLatestEvaluations = evaluations.map((item) => item.snapshots[item.snapshots.length - 1]?.evaluation).filter(Boolean);

  const result = {
    total_tracks: evaluations.length,
    improved_count: improvedCount,
    regressed_count: regressedCount,
    guarded_or_fragile_count: guardedOrFragileCount,
    contradicted_outcome_count: contradictedOutcomeCount,
    mixed_outcome_count: mixedOutcomeCount,
    reinforcing_outcome_count: reinforcingOutcomeCount,
    average_latest_score: averageLatestScore,
    average_outcome_pressure_score: averageOutcomePressureScore,
    average_score_delta: averageScoreDelta,
    weakest_dimensions: dimensionHotspots(allLatestEvaluations).slice(0, 5),
    recurring_issue_types: issueHotspots(allLatestEvaluations).slice(0, 5),
    weakest_tracks: weakestTracks,
    tracks: evaluations,
    summary:
      evaluations.length === 0
        ? "No replay tracks were available."
        : regressedCount > 0
          ? `${regressedCount} replay track${regressedCount === 1 ? "" : "s"} regressed and should be inspected before trusting this health-plan change set.`
          : contradictedOutcomeCount > 0
            ? `${contradictedOutcomeCount} replay track${contradictedOutcomeCount === 1 ? "" : "s"} still look contradicted in later saved outcomes, so the plan should not be trusted unchanged.`
          : guardedOrFragileCount > 0
            ? `${improvedCount} replay track${improvedCount === 1 ? "" : "s"} improved, but ${guardedOrFragileCount} current track${guardedOrFragileCount === 1 ? "" : "s"} still finish guarded or fragile.`
            : mixedOutcomeCount > 0
              ? `Benchmarks are holding, but ${mixedOutcomeCount} replay track${mixedOutcomeCount === 1 ? "" : "s"} still have mixed real-world follow-through.`
              : `All ${evaluations.length} replay track${evaluations.length === 1 ? "" : "s"} improved or held strong without regression.`,
  };
  return {
    ...result,
    recommended_actions: buildReplayRecommendedActions(evaluations),
    release_gate: buildHealthPlanBenchmarkReplayGate(result),
  };
}
