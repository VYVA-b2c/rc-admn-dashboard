import { describe, expect, it } from "vitest";

import { buildHealthPlanTrustVerdict } from "./healthPlanTrustVerdict.js";

describe("healthPlanTrustVerdict", () => {
  it("returns a trusted verdict when the major quality gates are clean", () => {
    const verdict = buildHealthPlanTrustVerdict({
      generationQuality: {
        overall_status: "strong",
        summary: "The generation passed cleanly.",
      },
      operationalCompleteness: {
        overall_status: "strong",
        summary: "Timing, owner, and fallback are concrete.",
      },
      recommendationGrounding: {
        overall_status: "strong",
        summary: "Recommendations are well grounded.",
      },
      recommendationCalibration: {
        overall_status: "adjusted",
        summary: "1 recommendation was softened before acceptance.",
        adjustment_count: 1,
        high_pressure_adjustment_count: 1,
        items: [
          {
            section_key: "monitoring_json",
            high_pressure: true,
            reason: "This recommendation is usable, but staff should verify the live picture before leaning on it heavily.",
          },
        ],
      },
      recommendationCoverage: {
        overall_status: "strong",
        summary: "Live risks and verification needs are covered.",
      },
      benchmarkAssessment: {
        overall_status: "strong",
        summary: "Matched benchmark patterns look healthy.",
        rejected: false,
      },
      recommendationChallenges: {
        overall_status: "strong",
        summary: "No high-risk recommendation remains challenged.",
        rejected: false,
      },
      generationBriefIssues: [],
    });

    expect(verdict).toMatchObject({
      overall_status: "guarded",
      can_trust_for_staff_use: true,
      blocker_count: 0,
    });
    expect(verdict.caution_items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "recommendation_calibration" }),
      ]),
    );
    expect(verdict.trust_score).toBeGreaterThan(70);
    expect(verdict.dimensions.find((item) => item.name === "recommendation_calibration")).toMatchObject({
      overall_status: "adjusted",
    });
    expect(verdict.dimensions.find((item) => item.name === "generation_brief_compliance")).toMatchObject({
      overall_status: "trusted",
    });
  });

  it("returns a fragile verdict when key gates fail", () => {
    const verdict = buildHealthPlanTrustVerdict({
      generationQuality: {
        overall_status: "guarded",
        summary: "Generation still needs caution.",
      },
      operationalCompleteness: {
        overall_status: "fragile",
        summary: "Execution detail is still too vague.",
        issues: [{ message: "Escalation lacks a fallback path.", severity: "high", section_key: "escalation_json", detail: "Name the backup owner." }],
      },
      recommendationGrounding: {
        overall_status: "fragile",
        summary: "A recommendation outruns the evidence.",
        issues: [{ message: "Monitoring recommendation is too certain.", severity: "high", section_key: "monitoring_json" }],
      },
      recommendationCoverage: {
        overall_status: "guarded",
        summary: "Coverage is still partial.",
        issues: [{ message: "Verification language is still thin.", severity: "medium", section_key: "monitoring_json" }],
      },
      benchmarkAssessment: {
        overall_status: "fragile",
        summary: "The matched urgent archetype still fails.",
        rejected: true,
        evaluations: [{ top_issue: { message: "The plan underplays same-day reachability risk.", section_key: "monitoring_json" } }],
      },
      recommendationChallenges: {
        overall_status: "fragile",
        summary: "A high-risk recommendation still needs challenge.",
        rejected: true,
        items: [{ challenge_status: "challenged", high_risk: true, why_it_is_questioned: "The escalation wording sounds too calm.", safer_reframe: "Use same-day fallback language.", section_key: "escalation_json" }],
      },
      generationBriefIssues: [
        { message: "Monitoring did not use the act-now signal from the brief.", severity: "high", section_key: "monitoring_json" },
      ],
    });

    expect(verdict).toMatchObject({
      overall_status: "fragile",
      can_trust_for_staff_use: false,
    });
    expect(verdict.blocking_items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "generation_brief_compliance" }),
        expect.objectContaining({ type: "operational_completeness" }),
        expect.objectContaining({ type: "recommendation_grounding" }),
        expect.objectContaining({ type: "benchmark_assessment" }),
      ]),
    );
    expect(verdict.next_actions.length).toBeGreaterThan(0);
  });
});
