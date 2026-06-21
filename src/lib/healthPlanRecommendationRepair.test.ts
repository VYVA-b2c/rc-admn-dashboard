import { describe, expect, it } from "vitest";

import { buildHealthPlanRecommendationRepairBrief } from "./healthPlanRecommendationRepair.js";

describe("healthPlanRecommendationRepair", () => {
  it("marks preserve-worthy recommendations separately from items that need repair", () => {
    const summary = buildHealthPlanRecommendationRepairBrief({
      recommendationLearning: [
        {
          item_id: "daily-1",
          section_key: "daily_support_json",
          section_label: "Daily support",
          text: "Keep the morning medication routine.",
          reuse_priority: "preserve",
          trajectory: "strengthening",
          source_signal_ids: ["med-plan"],
          reason: "This routine has already helped repeatedly.",
        },
        {
          item_id: "monitor-1",
          section_key: "monitoring_json",
          section_label: "Monitoring",
          text: "Keep monitoring the situation.",
          reuse_priority: "verify",
          trajectory: "volatile",
          source_signal_ids: ["alert-active"],
          reason: "This still needs a tighter verification step.",
        },
      ],
      recommendationEffectiveness: {
        preserve_now: [{ item_id: "daily-1", section_key: "daily_support_json", text: "Keep the morning medication routine.", action_reason: "This routine has already helped repeatedly." }],
        rework_now: [{ item_id: "monitor-1", section_key: "monitoring_json", text: "Keep monitoring the situation.", action: "verify", action_reason: "This still needs a tighter verification step." }],
        retire_now: [],
      },
      recommendationGrounding: {
        items: [
          { item_id: "daily-1", section_key: "daily_support_json", grounding_status: "strong" },
          { item_id: "monitor-1", section_key: "monitoring_json", grounding_status: "guarded", staff_note: "This recommendation is usable, but staff should verify the live picture before leaning on it heavily." },
        ],
      },
      recommendationSourceRanking: {
        items: [
          { item_id: "daily-1", section_key: "daily_support_json", evidence_quality: "strong", ranked_sources: [{ label: "Medication plan on file" }] },
          { item_id: "monitor-1", section_key: "monitoring_json", evidence_quality: "mixed", ranked_sources: [{ label: "1 active alert" }] },
        ],
      },
    });

    expect(summary).toMatchObject({
      overall_status: "guarded",
      preserve_count: 1,
      repair_count: 1,
    });
    expect(summary.items.find((item) => item.item_id === "daily-1")).toMatchObject({
      recommended_action: "preserve",
      priority: "low",
    });
    expect(summary.items.find((item) => item.item_id === "monitor-1")).toMatchObject({
      recommended_action: "verify",
      priority: "medium",
    });
  });

  it("pushes challenged or replace-worthy recommendations into rework or retire", () => {
    const summary = buildHealthPlanRecommendationRepairBrief({
      recommendationLearning: [
        {
          item_id: "escalate-1",
          section_key: "escalation_json",
          text: "Continue the current response path.",
          reuse_priority: "replace",
          source_signal_ids: ["alert-active"],
        },
        {
          item_id: "monitor-1",
          section_key: "monitoring_json",
          text: "Keep the routine steady and continue monitoring.",
          reuse_priority: "refine",
          source_signal_ids: ["alert-active"],
        },
      ],
      recommendationEffectiveness: {
        preserve_now: [],
        rework_now: [{ item_id: "monitor-1", section_key: "monitoring_json", text: "Keep the routine steady and continue monitoring.", action: "rework" }],
        retire_now: [{ item_id: "escalate-1", section_key: "escalation_json", text: "Continue the current response path.", action_reason: "This recommendation should not come back unchanged." }],
      },
      recommendationGrounding: {
        items: [
          { item_id: "escalate-1", section_key: "escalation_json", grounding_status: "fragile" },
          { item_id: "monitor-1", section_key: "monitoring_json", grounding_status: "fragile" },
        ],
      },
      recommendationChallenges: {
        items: [
          {
            item_id: "monitor-1",
            section_key: "monitoring_json",
            challenge_status: "challenged",
            high_risk: true,
            why_it_is_questioned: "The wording sounds calmer than the live pattern warrants.",
            safer_reframe: "Replace calming wording with a same-day check and fallback path.",
          },
        ],
      },
    });

    expect(summary?.overall_status).toBe("fragile");
    expect(summary.items.find((item) => item.item_id === "escalate-1")).toMatchObject({
      recommended_action: "retire",
      priority: "high",
    });
    expect(summary.items.find((item) => item.item_id === "monitor-1")).toMatchObject({
      recommended_action: "rework",
      priority: "high",
    });
  });
});

