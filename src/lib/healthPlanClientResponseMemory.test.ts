import { describe, expect, it } from "vitest";

import { buildHealthPlanClientResponseMemory } from "./healthPlanClientResponseMemory.js";

describe("healthPlanClientResponseMemory", () => {
  it("summarizes which intervention categories seem to land or wobble for this client", () => {
    const memory = buildHealthPlanClientResponseMemory({
      recentOperationalEvents: [
        { source: "checkins", status: "completed", occurred_at: "2026-06-20T08:00:00.000Z", signal_ids: ["service-checkins"] },
        { source: "checkins", status: "answered", occurred_at: "2026-06-20T09:00:00.000Z", signal_ids: ["service-checkins"] },
        { source: "medication", status: "missed", occurred_at: "2026-06-20T10:00:00.000Z", signal_ids: ["medication-plan"] },
        { source: "campaign_call", status: "no_answer", occurred_at: "2026-06-20T11:00:00.000Z", signal_ids: ["service-checkins", "alert-active"] },
      ],
      sourceSignals: [
        { id: "service-checkins", category: "service" },
        { id: "medication-plan", category: "medication" },
        { id: "alert-active", category: "alert" },
      ],
      recommendationLearning: [
        {
          section_label: "Daily support",
          source_signal_ids: ["service-checkins"],
          status: "helping",
          reuse_priority: "preserve",
        },
        {
          section_label: "Monitoring",
          source_signal_ids: ["medication-plan"],
          status: "fragile",
          reuse_priority: "replace",
        },
      ],
      sectionOutcomes: [
        {
          section_key: "daily_support_json",
          trend: "strengthening",
          evidence_balance: "supportive",
          operational_learning_summary: "Repeated explicit staff feedback says this section is holding up well in practice.",
        },
      ],
    });

    expect(memory.response_by_source.find((item) => item.source === "checkins")).toMatchObject({
      response_profile: "responsive",
      positive_count: 2,
    });
    expect(memory.strongest_anchors[0]?.category).toBe("service");
    expect(memory.fragile_anchors.some((item) => item.category === "medication")).toBe(true);
    expect(memory.section_learning_signals[0]).toMatchObject({
      section_key: "daily_support_json",
      trend: "strengthening",
    });
  });
});
