import { describe, expect, it } from "vitest";

import { findHealthPlanRecommendationCarryForwardIssues } from "./healthPlanCarryForwardRules.js";

describe("findHealthPlanRecommendationCarryForwardIssues", () => {
  it("flags unchanged recommendations that were marked for replacement", () => {
    const issues = findHealthPlanRecommendationCarryForwardIssues({
      existingPlan: {
        monitoring_json: [{ id: "monitor-1", text: "Repeat the same weak monitoring step." }],
      },
      recommendationLearning: [
        {
          item_id: "monitor-1",
          section_key: "monitoring_json",
          text: "Repeat the same weak monitoring step.",
          reuse_priority: "replace",
          reason: "This recommendation repeatedly failed.",
        },
      ],
      nextPlan: {
        monitoring_json: [{ id: "monitor-next", text: "Repeat the same weak monitoring step." }],
      },
      targetSections: ["monitoring_json"],
    });

    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      section_key: "monitoring_json",
      reason: "This recommendation repeatedly failed.",
    });
  });

  it("ignores changed wording or recommendations outside the refreshed sections", () => {
    const issues = findHealthPlanRecommendationCarryForwardIssues({
      existingPlan: {
        daily_support_json: [{ id: "daily-1", text: "Old routine reminder." }],
        monitoring_json: [{ id: "monitor-1", text: "Old monitoring step." }],
      },
      recommendationLearning: [
        {
          item_id: "daily-1",
          section_key: "daily_support_json",
          text: "Old routine reminder.",
          reuse_priority: "replace",
        },
        {
          item_id: "monitor-1",
          section_key: "monitoring_json",
          text: "Old monitoring step.",
          reuse_priority: "replace",
        },
      ],
      nextPlan: {
        daily_support_json: [{ id: "daily-next", text: "New routine with a verified caregiver handoff." }],
        monitoring_json: [{ id: "monitor-next", text: "Old monitoring step." }],
      },
      targetSections: ["daily_support_json"],
    });

    expect(issues).toHaveLength(0);
  });
});
