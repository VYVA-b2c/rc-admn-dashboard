import { healthPlanGoldenCases } from "./healthPlanGoldenCases.js";
import {
  benchmarkMatchScore,
  selectRelevantScenarios,
} from "./healthPlanBenchmarkAssessment.js";
import { evaluateHealthPlanBenchmarkReplaySuite } from "./healthPlanBenchmarkReplay.js";

function text(value) {
  return String(value || "").trim();
}

function unique(values) {
  return [...new Set((Array.isArray(values) ? values : []).map((value) => text(value)).filter(Boolean))];
}

function objectValue(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function normalizeVersion(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function parseDate(value) {
  const raw = text(value);
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeImpactStatus(value) {
  const normalized = text(value).toLowerCase();
  if (normalized === "reinforced") return "reinforcing";
  if (["reinforcing", "mixed", "contradicted", "limited"].includes(normalized)) return normalized;
  return null;
}

function outcomePressureScore({
  actionContradictedCount = 0,
  actionMixedCount = 0,
  recommendationContradictedCount = 0,
  recommendationMixedCount = 0,
  highPriorityContradictedRecommendationCount = 0,
  recommendationRetireCount = 0,
} = {}) {
  return Math.max(0, Math.min(100,
    (Number(highPriorityContradictedRecommendationCount || 0) * 30)
    + (Number(recommendationRetireCount || 0) * 18)
    + (Number(recommendationContradictedCount || 0) * 16)
    + (Number(actionContradictedCount || 0) * 14)
    + (Number(recommendationMixedCount || 0) * 8)
    + (Number(actionMixedCount || 0) * 6)));
}

function summarizeRevisionOutcome(revision) {
  const snapshot = objectValue(revision?.quality_snapshot_json) || {};
  const actionImpact = objectValue(snapshot.action_impact);
  const recommendationImpact = objectValue(snapshot.recommendation_impact);
  if (!actionImpact && !recommendationImpact) return null;

  const actionStatus = normalizeImpactStatus(actionImpact?.overall_status);
  const recommendationStatus = normalizeImpactStatus(recommendationImpact?.overall_status);
  const actionContradictedCount = Number(actionImpact?.contradicted_count || 0);
  const actionMixedCount = Number(actionImpact?.mixed_count || 0);
  const actionReinforcedCount = Number(actionImpact?.reinforced_count || 0);
  const recommendationContradictedCount = Number(recommendationImpact?.contradicted_count || 0);
  const recommendationMixedCount = Number(recommendationImpact?.mixed_count || 0);
  const recommendationReinforcedCount = Number(recommendationImpact?.reinforced_count || 0);
  const highPriorityContradictedRecommendationCount = Number(recommendationImpact?.high_priority_contradicted_count || 0);
  const recommendationRetireCount = Number(recommendationImpact?.retire_count || 0);
  const recommendationReworkCount = Number(recommendationImpact?.rework_count || 0);

  const overallStatus =
    highPriorityContradictedRecommendationCount > 0
    || recommendationStatus === "contradicted"
    || actionStatus === "contradicted"
      ? "contradicted"
      : recommendationStatus === "mixed"
        || actionStatus === "mixed"
        || recommendationMixedCount > 0
        || actionMixedCount > 0
          ? "mixed"
          : recommendationStatus === "reinforcing"
            || actionStatus === "reinforcing"
            || recommendationReinforcedCount > 0
            || actionReinforcedCount > 0
              ? "reinforcing"
              : "limited";

  const watchouts = unique([
    highPriorityContradictedRecommendationCount > 0
      ? "High-priority recommendations were contradicted after this version went live."
      : null,
    recommendationRetireCount > 0
      ? "Some recommendations now need retirement instead of light editing."
      : null,
    actionContradictedCount > 0
      ? "One or more action sections were contradicted by post-plan activity."
      : null,
    overallStatus === "mixed"
      ? "Post-plan evidence is still mixed, so this version should stay under review."
      : null,
  ]);

  return {
    overall_status: overallStatus,
    action_impact_status: actionStatus,
    recommendation_impact_status: recommendationStatus,
    action_contradicted_count: actionContradictedCount,
    action_mixed_count: actionMixedCount,
    action_reinforced_count: actionReinforcedCount,
    recommendation_contradicted_count: recommendationContradictedCount,
    recommendation_mixed_count: recommendationMixedCount,
    recommendation_reinforced_count: recommendationReinforcedCount,
    high_priority_contradicted_recommendation_count: highPriorityContradictedRecommendationCount,
    recommendation_retire_count: recommendationRetireCount,
    recommendation_rework_count: recommendationReworkCount,
    pressure_score: outcomePressureScore({
      actionContradictedCount,
      actionMixedCount,
      recommendationContradictedCount,
      recommendationMixedCount,
      highPriorityContradictedRecommendationCount,
      recommendationRetireCount,
    }),
    summary:
      text(recommendationImpact?.summary)
      || text(actionImpact?.summary)
      || (overallStatus === "contradicted"
        ? "Later saved evidence is contradicting this plan."
        : overallStatus === "mixed"
          ? "Later saved evidence is still mixed for this plan."
          : overallStatus === "reinforcing"
            ? "Later saved evidence is reinforcing this plan."
            : "Too little later evidence exists to judge this plan."),
    watchouts,
  };
}

function normalizeRevisionLike(revision) {
  const plan = objectValue(revision);
  if (!plan) return null;
  const versionNumber = normalizeVersion(plan.version_number || plan.current_version);
  return {
    id: text(plan.id) || `version-${versionNumber}`,
    version_number: versionNumber,
    action_type: text(plan.action_type || plan.last_action_type) || "edited",
    created_at: text(plan.created_at || plan.updated_at || plan.generated_at || plan.reviewed_at) || null,
    source_signals_json: Array.isArray(plan.source_signals_json) ? plan.source_signals_json : [],
    quality_snapshot_json: objectValue(plan.quality_snapshot_json) || null,
    summary_text: text(plan.summary_text) || null,
    summary_signal_ids: Array.isArray(plan.summary_signal_ids) ? plan.summary_signal_ids : [],
    goals_json: Array.isArray(plan.goals_json) ? plan.goals_json : [],
    daily_support_json: Array.isArray(plan.daily_support_json) ? plan.daily_support_json : [],
    monitoring_json: Array.isArray(plan.monitoring_json) ? plan.monitoring_json : [],
    escalation_json: Array.isArray(plan.escalation_json) ? plan.escalation_json : [],
    caregiver_guidance_json: Array.isArray(plan.caregiver_guidance_json) ? plan.caregiver_guidance_json : [],
  };
}

function revisionsOldestFirst(history = [], currentPlan = null) {
  const revisions = [
    ...(Array.isArray(history) ? history : []),
    ...(currentPlan ? [currentPlan] : []),
  ]
    .map(normalizeRevisionLike)
    .filter(Boolean)
    .sort((left, right) => {
      const byVersion = normalizeVersion(left.version_number) - normalizeVersion(right.version_number);
      if (byVersion !== 0) return byVersion;
      const leftTime = parseDate(left.created_at)?.getTime() || 0;
      const rightTime = parseDate(right.created_at)?.getTime() || 0;
      return leftTime - rightTime;
    });

  return revisions.filter((item, index, list) =>
    list.findIndex((candidate) => candidate.version_number === item.version_number) === index);
}

function scenarioMatchesForRevision(revision, cases = healthPlanGoldenCases) {
  const sourceSignals = Array.isArray(revision?.source_signals_json) ? revision.source_signals_json : [];
  const evidencePack = objectValue(revision?.quality_snapshot_json?.evidence_pack) || null;
  return selectRelevantScenarios((Array.isArray(cases) ? cases : [])
    .map((scenario) => ({
      scenario,
      match_score: benchmarkMatchScore({
        sourceSignals,
        evidencePack,
        scenario,
      }),
    })));
}

function scenarioLabelLookup(cases = healthPlanGoldenCases) {
  return new Map(
    (Array.isArray(cases) ? cases : [])
      .map((scenario) => {
        const id = text(scenario?.id);
        return id ? [id, text(scenario?.label) || id] : null;
      })
      .filter(Boolean),
  );
}

export function buildHealthPlanBenchmarkReplayFromHistory({
  history = [],
  currentPlan = null,
  cases = healthPlanGoldenCases,
} = {}) {
  const revisions = revisionsOldestFirst(history, currentPlan);
  if (!revisions.length) {
    return {
      summary: "No saved plan history is available yet for benchmark replay.",
      total_tracks: 0,
      matched_scenarios: [],
      tracks: [],
      release_gate: null,
      eligible_revision_count: 0,
    };
  }

  const labelLookup = scenarioLabelLookup(cases);
  const matchesByScenario = new Map();

  for (const revision of revisions) {
    const matches = scenarioMatchesForRevision(revision, cases);
    for (const match of matches) {
      const scenarioId = text(match?.scenario?.id);
      if (!scenarioId) continue;
      const existing = matchesByScenario.get(scenarioId) || {
        id: `history-${scenarioId}`,
        label: `${text(match?.scenario?.label) || scenarioId} history replay`,
        scenario_id: scenarioId,
        max_match_score: 0,
        snapshot_count: 0,
        snapshots: [],
      };
      existing.max_match_score = Math.max(Number(existing.max_match_score || 0), Number(match?.match_score || 0));
      existing.snapshot_count += 1;
      existing.snapshots.push({
        revision_id: text(revision.id) || `version-${revision.version_number}`,
        label: `Version ${revision.version_number}`,
        plan: {
          summary_text: revision.summary_text,
          summary_signal_ids: revision.summary_signal_ids,
          goals_json: revision.goals_json,
          daily_support_json: revision.daily_support_json,
          monitoring_json: revision.monitoring_json,
          escalation_json: revision.escalation_json,
          caregiver_guidance_json: revision.caregiver_guidance_json,
        },
        outcome_summary: summarizeRevisionOutcome(revision),
        match_score: Number(match?.match_score || 0),
        version_number: revision.version_number,
        action_type: revision.action_type,
      });
      matchesByScenario.set(scenarioId, existing);
    }
  }

  const latestMatches = scenarioMatchesForRevision(revisions[revisions.length - 1], cases);
  const latestScenarioIds = new Set(latestMatches.map((match) => text(match?.scenario?.id)).filter(Boolean));
  const tracks = [...matchesByScenario.values()]
    .filter((track) =>
      Number(track.max_match_score || 0) >= 55
      || latestScenarioIds.has(track.scenario_id))
    .sort((left, right) => Number(right.max_match_score || 0) - Number(left.max_match_score || 0))
    .slice(0, 4)
    .map((track) => ({
      id: track.id,
      label: track.label,
      scenario_id: track.scenario_id,
      snapshots: track.snapshots,
    }));

  if (!tracks.length) {
    return {
      summary: "Saved plan history exists, but no benchmark scenario matched strongly enough for replay yet.",
      total_tracks: 0,
      matched_scenarios: [],
      tracks: [],
      release_gate: null,
      eligible_revision_count: revisions.length,
    };
  }

  const suite = evaluateHealthPlanBenchmarkReplaySuite(tracks);
  return {
    ...suite,
    eligible_revision_count: revisions.length,
    matched_scenarios: tracks.map((track) => ({
      scenario_id: track.scenario_id,
      scenario_label: labelLookup.get(track.scenario_id) || track.scenario_id,
      snapshot_count: Array.isArray(track.snapshots) ? track.snapshots.length : 0,
      max_match_score: Number(matchesByScenario.get(track.scenario_id)?.max_match_score || 0),
    })),
  };
}
