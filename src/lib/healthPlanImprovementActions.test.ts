import { describe, expect, it } from "vitest";

import {
  buildCompletedHealthPlanImprovementBrief,
  buildHealthPlanImprovementActions,
  buildHealthPlanImprovementBrief,
} from "./healthPlanImprovementActions";

describe("healthPlanImprovementActions", () => {
  it("turns gaps, caution signals, and drift into prioritized next steps", () => {
    const actions = buildHealthPlanImprovementActions({
      dataQualityGaps: [
        {
          id: "care-circle-gap",
          label: "Care-circle coverage is incomplete",
          detail: "No active care provider assignment is recorded.",
          severity: "high",
          staff_action: "Assign or confirm care coverage before depending on caregiver follow-through.",
        },
        {
          id: "medication-adherence-gap",
          label: "Recent adherence evidence is thin",
          detail: "There is no recent medication activity on file.",
          severity: "medium",
        },
      ],
      followThrough: {
        status: "needs_review",
        caution_signals: [
          { id: "new-alerts-since-plan", detail: "2 alerts appeared after the plan was generated." },
          { id: "no-fresh-touchpoints", detail: "No new service or medication evidence has been recorded." },
        ],
      },
      sectionDrift: [
        { section_key: "monitoring_json", label: "Monitoring", status: "needs_refresh", reasons: ["Monitoring is leaning on signals that are missing or aging."] },
      ],
    });

    expect(actions[0]).toMatchObject({
      id: "improve-care-circle-coverage",
      priority: "high",
      section_label: "Caregiver guidance",
    });
    expect(actions.map((item) => item.id)).toEqual(expect.arrayContaining([
      "improve-alert-reconciliation",
      "improve-fresh-touchpoint",
      "refresh-monitoring_json",
    ]));
  });

  it("deduplicates overlapping action sources", () => {
    const actions = buildHealthPlanImprovementActions({
      dataQualityGaps: [
        { id: "sharing-boundary-gap", label: "Sharing boundary is not fully confirmed", severity: "medium" },
        { id: "sharing-boundary-gap", label: "Sharing boundary is not fully confirmed", severity: "medium" },
      ],
      sectionDrift: [
        { section_key: "caregiver_guidance_json", label: "Caregiver guidance", status: "needs_refresh", reasons: ["Caregiver guidance depends on sharing assumptions that are no longer solid."] },
      ],
    });

    expect(actions.filter((item) => item.id === "improve-sharing-boundary")).toHaveLength(1);
  });

  it("builds a compact prioritized brief for prompt context", () => {
    const actions = buildHealthPlanImprovementActions({
      dataQualityGaps: [
        { id: "care-circle-gap", label: "Care-circle coverage is incomplete", severity: "high" },
        { id: "profile-context-gap", label: "Profile context is limited", severity: "medium" },
      ],
    });

    const brief = buildHealthPlanImprovementBrief(actions);

    expect(brief[0]).toMatchObject({
      id: "improve-care-circle-coverage",
      priority: "high",
      title: "Confirm who can reinforce the plan",
    });
    expect(brief.every((item) => item.title && item.id)).toBe(true);
  });

  it("hides already completed actions and builds a completion brief", () => {
    const actions = buildHealthPlanImprovementActions({
      dataQualityGaps: [
        { id: "care-circle-gap", label: "Care-circle coverage is incomplete", severity: "high" },
        { id: "profile-context-gap", label: "Profile context is limited", severity: "medium" },
      ],
      completedActions: [
        { action_id: "improve-care-circle-coverage", title: "Confirm who can reinforce the plan" },
      ],
    });

    expect(actions.map((item) => item.id)).not.toContain("improve-care-circle-coverage");

    const completedBrief = buildCompletedHealthPlanImprovementBrief([
      {
        action_id: "improve-care-circle-coverage",
        title: "Confirm who can reinforce the plan",
        section_key: "caregiver_guidance_json",
        completed_at: "2026-06-20T10:00:00Z",
        completed_by_email: "karim@example.com",
      },
    ]);

    expect(completedBrief[0]).toMatchObject({
      action_id: "improve-care-circle-coverage",
      title: "Confirm who can reinforce the plan",
    });
  });
});
