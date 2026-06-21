import { describe, expect, it } from "vitest";

import { buildHealthPlanOperationalReleaseGate } from "./healthPlanOperationalReleaseGate.js";

describe("healthPlanOperationalReleaseGate", () => {
  it("blocks operational release when same-day pressure outruns predictive visibility", () => {
    const gate = buildHealthPlanOperationalReleaseGate({
      reviewGovernance: {
        review_required: true,
        review_window: "today",
        review_summary: "Same-day review is required.",
      },
      reviewReadiness: {
        overall_status: "ready",
        blocker_count: 0,
      },
      trustVerdict: {
        overall_status: "trusted",
        blocker_count: 0,
        caution_count: 0,
      },
      dataQualityGaps: [
        {
          id: "predictive-coverage-gap",
          label: "Predictive coverage is unavailable",
        },
      ],
      liveEvidenceSummary: {
        status: "pressure",
      },
      freshness: {
        status: "current",
      },
    });

    expect(gate).toMatchObject({
      overall_status: "blocked",
      can_use_for_staff_workflow: false,
      requires_staff_review: true,
      client_share_ready: false,
    });
    expect(gate.blocking_items.some((item) => /predictive visibility|same-day pressure/i.test(`${item?.label || ""} ${item?.detail || ""}`))).toBe(true);
  });

  it("keeps a usable but calibrated plan in staff-guided mode", () => {
    const gate = buildHealthPlanOperationalReleaseGate({
      reviewGovernance: {
        review_required: true,
        review_window: "this_week",
        review_summary: "Staff review is still required.",
      },
      reviewReadiness: {
        overall_status: "guarded",
        blocker_count: 0,
        caution_count: 2,
      },
      trustVerdict: {
        overall_status: "guarded",
        blocker_count: 0,
        caution_count: 1,
        summary: "The plan is usable, but staff should still rely on it with caution.",
        caution_items: [
          {
            type: "recommendation_calibration",
            label: "The validator had to soften one recommendation.",
            detail: "Review the softened wording before sharing it outward.",
            severity: "medium",
            section_keys: ["monitoring_json"],
          },
        ],
      },
      recommendationCalibration: {
        adjustment_count: 1,
        high_pressure_adjustment_count: 1,
        items: [{ section_key: "monitoring_json" }],
      },
      freshness: {
        status: "stale",
        summary: "The trusted picture is starting to drift.",
      },
    });

    expect(gate).toMatchObject({
      overall_status: "staff_guided",
      can_use_for_staff_workflow: true,
      requires_staff_review: true,
      client_share_ready: false,
      caregiver_share_ready: false,
    });
    expect(gate.guardrails).toEqual(
      expect.arrayContaining([
        "Keep this plan staff-mediated before using it as standalone client guidance.",
      ]),
    );
  });

  it("allows shareable release only when trust is strong and sharing boundaries are clear", () => {
    const gate = buildHealthPlanOperationalReleaseGate({
      reviewGovernance: {
        review_required: false,
        review_window: "ongoing",
      },
      reviewReadiness: {
        overall_status: "ready",
        blocker_count: 0,
        caution_count: 0,
      },
      trustVerdict: {
        overall_status: "trusted",
        blocker_count: 0,
        caution_count: 0,
      },
      freshness: {
        status: "current",
      },
      liveEvidenceSummary: {
        status: "stable",
      },
      recommendationGrounding: {
        overall_status: "strong",
      },
      recommendationEvidenceDiversity: {
        overall_status: "strong",
      },
      dataQualityGaps: [],
    });

    expect(gate).toMatchObject({
      overall_status: "shareable",
      can_use_for_staff_workflow: true,
      requires_staff_review: false,
      client_share_ready: true,
      caregiver_share_ready: true,
    });
  });
});
