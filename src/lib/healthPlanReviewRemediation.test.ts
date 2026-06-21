import { describe, expect, it } from "vitest";

import { buildHealthPlanReviewRemediation } from "./healthPlanReviewRemediation.js";

describe("healthPlanReviewRemediation", () => {
  it("turns review blockers into targeted refresh actions", () => {
    const summary = buildHealthPlanReviewRemediation({
      reviewReadiness: {
        can_mark_reviewed: false,
        blocking_items: [
          {
            type: "generation_quality",
            label: "Monitoring stayed too generic for a same-day review section.",
            section_keys: ["monitoring_json"],
            severity: "high",
          },
          {
            type: "recommendation_challenge",
            label: "Escalation wording still sounds calmer than the live pattern warrants.",
            section_keys: ["escalation_json"],
            severity: "high",
          },
        ],
        caution_items: [],
      },
      refreshStrategy: {
        full_regeneration_preferred: false,
        refresh_now_section_keys: ["monitoring_json", "escalation_json"],
      },
      improvementActions: [
        {
          id: "improve-risk-response",
          section_key: "monitoring_json",
          title: "Reassess the highest-risk sections now",
        },
      ],
    });

    expect(summary).toMatchObject({
      overall_status: "blocked",
    });
    expect(summary?.actions?.[0]).toMatchObject({
      action_kind: "refresh_sections",
      section_keys: ["monitoring_json"],
    });
    expect(summary?.actions?.some((item) => item.action_kind === "refresh_sections" && item.section_keys?.includes("escalation_json"))).toBe(true);
  });

  it("prefers full regeneration when several pressured sections stack up", () => {
    const summary = buildHealthPlanReviewRemediation({
      reviewReadiness: {
        can_mark_reviewed: false,
        blocking_items: [
          { type: "generation_quality", label: "Monitoring needs a rewrite.", section_keys: ["monitoring_json"], severity: "high" },
          { type: "recommendation_coverage", label: "Escalation missed a must-address fact.", section_keys: ["escalation_json"], severity: "high" },
        ],
        caution_items: [],
      },
      refreshStrategy: {
        full_regeneration_preferred: true,
        summary: "Several sections are under pressure at once.",
        recommendation: "Use a full regenerate pass.",
        refresh_now_section_keys: ["monitoring_json", "escalation_json", "daily_support_json"],
      },
    });

    expect(summary?.actions?.[0]).toMatchObject({
      action_kind: "regenerate_all",
      priority: "high",
    });
  });

  it("offers review completion once blockers are gone", () => {
    const summary = buildHealthPlanReviewRemediation({
      reviewReadiness: {
        can_mark_reviewed: true,
        blocking_items: [],
        caution_items: [],
      },
      reviewGovernance: {
        review_required: true,
        review_summary: "Same-day human review is still required.",
        review_window: "today",
      },
    });

    expect(summary?.actions?.[0]).toMatchObject({
      action_kind: "open_review",
      priority: "high",
    });
  });
});

