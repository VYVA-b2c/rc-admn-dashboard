import { describe, expect, it } from "vitest";

import {
  buildHealthPlanBenchmarkReplayGate,
  evaluateHealthPlanBenchmarkReplaySuite,
  evaluateHealthPlanBenchmarkReplayTrack,
} from "./healthPlanBenchmarkReplay.js";
import { healthPlanBenchmarkReplayFixtures } from "./healthPlanBenchmarkReplayFixtures.js";

describe("health plan benchmark replay", () => {
  it("shows score progression across a replay track", () => {
    const replay = evaluateHealthPlanBenchmarkReplayTrack(healthPlanBenchmarkReplayFixtures[0]);

    expect(replay).toMatchObject({
      track_id: "urgent_fall_progression",
      scenario_id: "urgent_unreachable_fall_risk",
      snapshot_count: 2,
      improved: true,
      regressed: false,
      baseline_status: "fragile",
      latest_status: "strong",
    });
    expect(replay?.score_delta).toBeGreaterThan(0);
    expect(replay?.latest_score).toBeGreaterThan(replay?.baseline_score || 0);
    expect(replay?.intermediate_regressions).toEqual([]);
  });

  it("summarizes replay-wide progress and remaining weak spots", () => {
    const suite = evaluateHealthPlanBenchmarkReplaySuite();

    expect(suite).toMatchObject({
      total_tracks: 3,
      regressed_count: 0,
    });
    expect(suite.improved_count).toBeGreaterThanOrEqual(3);
    expect(suite.average_latest_score).toBeGreaterThan(80);
    expect(suite.average_score_delta).toBeGreaterThan(0);
    expect(suite.weakest_tracks.length).toBeGreaterThan(0);
    expect(Array.isArray(suite.weakest_dimensions)).toBe(true);
    expect(Array.isArray(suite.recurring_issue_types)).toBe(true);
    expect(suite.release_gate).toMatchObject({
      passed: true,
      status: "passed",
    });
  });

  it("fails the replay gate when a strong scenario regresses and recommends what to fix", () => {
    const suite = evaluateHealthPlanBenchmarkReplaySuite([
      {
        id: "urgent_fall_regression",
        label: "Urgent fall-risk regression",
        scenario_id: "urgent_unreachable_fall_risk",
        snapshots: [
          healthPlanBenchmarkReplayFixtures[0].snapshots[1],
          {
            revision_id: "regressed_vague",
            label: "Regressed vague draft",
            plan: {
              summary_text: "Maintain support and stay observant.",
              summary_signal_ids: [],
              goals_json: [{ text: "Maintain stability.", source_signal_ids: [] }],
              daily_support_json: [{ text: "Continue support.", source_signal_ids: [] }],
              monitoring_json: [{ text: "Observe changes.", timing: "ongoing", priority: "low", source_signal_ids: [] }],
              escalation_json: [],
              caregiver_guidance_json: [],
            },
          },
        ],
      },
    ]);

    const gate = buildHealthPlanBenchmarkReplayGate(suite);

    expect(gate).toMatchObject({
      passed: false,
      status: "failed",
    });
    expect(gate.blocking_reasons).toEqual(
      expect.arrayContaining([
        expect.stringContaining("regressed"),
      ]),
    );
    expect(gate.recommended_actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "tighten_owner_clarity", priority: "high" }),
        expect.objectContaining({ id: "tighten_fallback_completeness", priority: "high" }),
      ]),
    );
  });

  it("fails the replay gate when later saved outcomes contradict the latest version", () => {
    const suite = evaluateHealthPlanBenchmarkReplaySuite([
      {
        id: "urgent_fall_outcome_contradiction",
        label: "Urgent fall-risk with contradicted live outcome",
        scenario_id: "urgent_unreachable_fall_risk",
        snapshots: [
          healthPlanBenchmarkReplayFixtures[0].snapshots[1],
          {
            ...healthPlanBenchmarkReplayFixtures[0].snapshots[1],
            revision_id: "follow_through_contradicted",
            label: "Later contradicted outcome",
            outcome_summary: {
              overall_status: "contradicted",
              action_impact_status: "contradicted",
              recommendation_impact_status: "contradicted",
              pressure_score: 100,
              high_priority_contradicted_recommendation_count: 1,
              recommendation_retire_count: 1,
              recommendation_rework_count: 1,
              action_contradicted_count: 1,
              summary: "Later saved evidence is contradicting this plan.",
              watchouts: ["High-priority recommendations were contradicted after this version went live."],
            },
          },
        ],
      },
    ]);

    expect(suite).toMatchObject({
      contradicted_outcome_count: 1,
    });
    expect(suite.release_gate).toMatchObject({
      passed: false,
      status: "failed",
    });
    expect(suite.release_gate?.blocking_reasons).toEqual(
      expect.arrayContaining([
        expect.stringContaining("later saved outcomes"),
      ]),
    );
    expect(suite.release_gate?.weak_tracks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          latest_outcome_status: "contradicted",
          latest_high_priority_contradicted_recommendation_count: 1,
        }),
      ]),
    );
    expect(suite.recommended_actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "replace_contradicted_high_priority_recommendations", priority: "high" }),
      ]),
    );
  });
});
