import { describe, expect, it } from "vitest";

import {
  buildHealthPlanCandidateSelectionSnapshot,
  scoreHealthPlanCandidate,
  selectBestHealthPlanCandidate,
} from "./healthPlanCandidateSelection.js";

describe("healthPlanCandidateSelection", () => {
  it("scores cleaner accepted candidates above more fragile accepted ones", () => {
    const strong = scoreHealthPlanCandidate({
      acceptance: {
        can_accept_for_generation: true,
        caution_count: 0,
        trust_verdict: { trust_score: 93 },
        generation_quality: { score: 95, overall_status: "strong" },
        recommendation_coverage: { score: 94, overall_status: "strong" },
        recommendation_grounding: { overall_status: "strong", issues: [] },
        recommendation_evidence_diversity: {
          overall_status: "strong",
          item_count: 4,
          strong_count: 4,
          guarded_count: 0,
          fragile_count: 0,
        },
        operational_release: { overall_status: "shareable", caution_count: 0 },
        operational_completeness: { overall_status: "strong", issues: [] },
        benchmark_assessment: { average_score: 90, overall_status: "strong" },
        recommendation_calibration: { adjustment_count: 0 },
      },
    });

    const guarded = scoreHealthPlanCandidate({
      acceptance: {
        can_accept_for_generation: true,
        caution_count: 3,
        trust_verdict: { trust_score: 78 },
        generation_quality: { score: 80, overall_status: "guarded" },
        recommendation_coverage: { score: 74, overall_status: "guarded" },
        recommendation_grounding: {
          overall_status: "guarded",
          issues: [{ severity: "medium" }],
        },
        recommendation_evidence_diversity: {
          overall_status: "guarded",
          item_count: 4,
          strong_count: 1,
          guarded_count: 2,
          fragile_count: 1,
        },
        operational_release: { overall_status: "staff_guided", caution_count: 2 },
        operational_completeness: {
          overall_status: "guarded",
          issues: [{ severity: "medium" }],
        },
        benchmark_assessment: { average_score: 71, overall_status: "guarded" },
        recommendation_calibration: {
          adjustment_count: 2,
          high_pressure_adjustment_count: 1,
        },
      },
    });

    expect(strong.accepted).toBe(true);
    expect(strong.score).toBeGreaterThan(guarded.score);
  });

  it("prefers the accepted candidate with stronger trust and fewer calibration costs", () => {
    const selection = selectBestHealthPlanCandidate([
      {
        candidate_id: "candidate-1",
        acceptance: {
          can_accept_for_generation: true,
          caution_count: 1,
          trust_verdict: { trust_score: 90 },
          generation_quality: { score: 91, overall_status: "strong" },
          recommendation_coverage: { score: 88, overall_status: "strong" },
          recommendation_grounding: { overall_status: "strong", issues: [] },
          recommendation_evidence_diversity: {
            overall_status: "strong",
            item_count: 3,
            strong_count: 3,
            guarded_count: 0,
            fragile_count: 0,
          },
          operational_release: { overall_status: "staff_guided", caution_count: 1 },
          operational_completeness: { overall_status: "strong", issues: [] },
          benchmark_assessment: { average_score: 86, overall_status: "strong" },
          recommendation_calibration: { adjustment_count: 0 },
        },
      },
      {
        candidate_id: "candidate-2",
        acceptance: {
          can_accept_for_generation: true,
          caution_count: 1,
          trust_verdict: { trust_score: 84 },
          generation_quality: { score: 88, overall_status: "guarded" },
          recommendation_coverage: { score: 86, overall_status: "strong" },
          recommendation_grounding: { overall_status: "guarded", issues: [] },
          recommendation_evidence_diversity: {
            overall_status: "guarded",
            item_count: 3,
            strong_count: 1,
            guarded_count: 2,
            fragile_count: 0,
          },
          operational_release: { overall_status: "staff_guided", caution_count: 1 },
          operational_completeness: { overall_status: "strong", issues: [] },
          benchmark_assessment: { average_score: 89, overall_status: "strong" },
          recommendation_calibration: {
            adjustment_count: 2,
            high_pressure_adjustment_count: 1,
          },
        },
      },
      {
        candidate_id: "candidate-3",
        acceptance: {
          can_accept_for_generation: false,
        },
      },
    ]);

    expect(selection.winner?.candidate_id).toBe("candidate-1");
    expect(selection.ranked_candidates).toHaveLength(2);
    expect(selection.selection_summary).toMatch(/Selected candidate-1/i);
  });

  it("builds a compact persisted snapshot of the selection result", () => {
    const selection = selectBestHealthPlanCandidate([
      {
        candidate_id: "candidate-1",
        plan: {
          generator_provider: "openai",
          generator_model: "gpt-4o-mini",
          generator_version: "health-plan-v1",
        },
        acceptance: {
          can_accept_for_generation: true,
          caution_count: 0,
          trust_verdict: { trust_score: 91 },
          generation_quality: { score: 93, overall_status: "strong" },
          recommendation_coverage: { score: 90, overall_status: "strong" },
          recommendation_grounding: { overall_status: "strong", issues: [] },
          recommendation_evidence_diversity: {
            overall_status: "strong",
            item_count: 2,
            strong_count: 2,
            guarded_count: 0,
            fragile_count: 0,
          },
          operational_release: { overall_status: "shareable", caution_count: 0 },
          operational_completeness: { overall_status: "strong", issues: [] },
          benchmark_assessment: { average_score: 88, overall_status: "strong" },
          recommendation_calibration: { adjustment_count: 0 },
        },
      },
      {
        candidate_id: "candidate-2",
        plan: {
          generator_provider: "openai",
          generator_model: "gpt-4o-mini",
          generator_version: "health-plan-v1",
        },
        acceptance: {
          can_accept_for_generation: true,
          caution_count: 2,
          trust_verdict: { trust_score: 79 },
          generation_quality: { score: 81, overall_status: "guarded" },
          recommendation_coverage: { score: 77, overall_status: "guarded" },
          recommendation_grounding: { overall_status: "guarded", issues: [] },
          recommendation_evidence_diversity: {
            overall_status: "guarded",
            item_count: 2,
            strong_count: 1,
            guarded_count: 1,
            fragile_count: 0,
          },
          operational_release: { overall_status: "staff_guided", caution_count: 1 },
          operational_completeness: { overall_status: "strong", issues: [] },
          benchmark_assessment: { average_score: 76, overall_status: "guarded" },
          recommendation_calibration: { adjustment_count: 1 },
        },
      },
    ]);

    const snapshot = buildHealthPlanCandidateSelectionSnapshot(selection);

    expect(snapshot).toMatchObject({
      attempted_count: 2,
      accepted_count: 2,
      rejected_count: 0,
      winner: {
        candidate_id: "candidate-1",
        generator_provider: "openai",
      },
    });
    expect(snapshot?.ranked_candidates).toHaveLength(2);
    expect(snapshot?.ranked_candidates?.[0]?.acceptance?.trust_score).toBe(91);
  });
});
