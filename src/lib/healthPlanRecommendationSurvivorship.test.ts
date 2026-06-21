import { describe, expect, it } from "vitest";

import { buildHealthPlanRecommendationSurvivorship } from "./healthPlanRecommendationSurvivorship.js";

describe("health plan recommendation survivorship", () => {
  it("identifies durable current recommendation patterns", () => {
    const survivorship = buildHealthPlanRecommendationSurvivorship({
      history: [
        {
          version_number: 3,
          daily_support_json: [{ id: "d1", text: "Keep the morning check-in focused on hydration.", source_signal_ids: ["service-checkins"] }],
          recommendation_learning_json: [
            {
              item_id: "d1",
              section_key: "daily_support_json",
              text: "Keep the morning check-in focused on hydration.",
              reuse_priority: "preserve",
              trajectory: "strengthening",
              helped_count: 2,
              feedback_count: 2,
              reason: "This routine keeps helping.",
            },
          ],
        },
        {
          version_number: 2,
          daily_support_json: [{ id: "d1-old", text: "Keep the morning check-in focused on hydration.", source_signal_ids: ["service-checkins"] }],
          recommendation_learning_json: [
            {
              section_key: "daily_support_json",
              text: "Keep the morning check-in focused on hydration.",
              reuse_priority: "preserve",
              trajectory: "stable",
              helped_count: 1,
              feedback_count: 1,
            },
          ],
        },
        {
          version_number: 1,
          daily_support_json: [{ text: "Keep the morning check-in focused on hydration.", source_signal_ids: ["service-checkins"] }],
          recommendation_learning_json: [],
        },
      ],
    });

    expect(survivorship.durable_count).toBe(1);
    expect(survivorship.durable[0]).toMatchObject({
      section_key: "daily_support_json",
      status: "durable",
      appearance_count: 3,
      present_in_current: true,
    });
  });

  it("marks contradicted current recommendations as fragile", () => {
    const survivorship = buildHealthPlanRecommendationSurvivorship({
      history: [
        {
          version_number: 2,
          escalation_json: [{ id: "e1", text: "Escalate if two doses are missed.", source_signal_ids: ["medication-plan"] }],
          recommendation_learning_json: [
            {
              item_id: "e1",
              section_key: "escalation_json",
              text: "Escalate if two doses are missed.",
              reuse_priority: "verify",
              contradiction_status: "live_conflict",
              feedback_count: 1,
            },
          ],
        },
        {
          version_number: 1,
          escalation_json: [{ text: "Escalate if two doses are missed.", source_signal_ids: ["medication-plan"] }],
          recommendation_learning_json: [],
        },
      ],
    });

    expect(survivorship.fragile_count).toBe(1);
    expect(survivorship.fragile[0]?.status).toBe("fragile");
  });

  it("keeps helpful dropped patterns as retired memory", () => {
    const survivorship = buildHealthPlanRecommendationSurvivorship({
      history: [
        {
          version_number: 3,
          monitoring_json: [{ text: "Watch for dizziness after breakfast.", source_signal_ids: ["alert-active"] }],
          recommendation_learning_json: [],
        },
        {
          version_number: 2,
          caregiver_guidance_json: [{ id: "c1", text: "Ask Maria to confirm breakfast and water intake.", source_signal_ids: ["care-circle-context"] }],
          recommendation_learning_json: [
            {
              item_id: "c1",
              section_key: "caregiver_guidance_json",
              text: "Ask Maria to confirm breakfast and water intake.",
              reuse_priority: "preserve",
              helped_count: 1,
              feedback_count: 1,
            },
          ],
        },
      ],
    });

    expect(survivorship.retired_count).toBe(1);
    expect(survivorship.retired[0]).toMatchObject({
      section_key: "caregiver_guidance_json",
      status: "retired",
      present_in_current: false,
    });
  });

  it("does not treat repeated unresolved outcomes as durable just because wording survived", () => {
    const survivorship = buildHealthPlanRecommendationSurvivorship({
      history: [
        {
          version_number: 3,
          monitoring_json: [{ id: "m1", text: "Watch for missed medication.", source_signal_ids: ["medication-plan"] }],
          recommendation_learning_json: [
            {
              item_id: "m1",
              section_key: "monitoring_json",
              text: "Watch for missed medication.",
              reuse_priority: "preserve",
              trajectory: "weakening",
              latest_outcome: "needs_follow_up",
              freshness_status: "fresh",
              helped_count: 2,
              did_not_help_count: 1,
              needs_follow_up_count: 1,
              feedback_count: 4,
              reason: "This wording kept returning, but staff still had to chase the same gap.",
            },
          ],
        },
        {
          version_number: 2,
          monitoring_json: [{ id: "m2", text: "Watch for missed medication.", source_signal_ids: ["medication-plan"] }],
          recommendation_learning_json: [
            {
              item_id: "m2",
              section_key: "monitoring_json",
              text: "Watch for missed medication.",
              reuse_priority: "preserve",
              trajectory: "stable",
              latest_outcome: "helped",
              freshness_status: "fresh",
              helped_count: 2,
              feedback_count: 2,
            },
          ],
        },
        {
          version_number: 1,
          monitoring_json: [{ text: "Watch for missed medication.", source_signal_ids: ["medication-plan"] }],
          recommendation_learning_json: [],
        },
      ],
    });

    expect(survivorship.durable_count).toBe(0);
    expect(survivorship.fragile[0]).toMatchObject({
      section_key: "monitoring_json",
      status: "fragile",
      caution_feedback_count: 2,
    });
  });
});
