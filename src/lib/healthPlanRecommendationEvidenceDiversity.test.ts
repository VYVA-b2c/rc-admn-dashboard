import { describe, expect, it } from "vitest";

import {
  buildHealthPlanRecommendationEvidenceDiversity,
  shouldRejectHealthPlanRecommendationEvidenceDiversity,
} from "./healthPlanRecommendationEvidenceDiversity.js";

describe("healthPlanRecommendationEvidenceDiversity", () => {
  it("treats mixed live corroboration as strong diversity", () => {
    const summary = buildHealthPlanRecommendationEvidenceDiversity({
      recommendationSourceRanking: {
        items: [
          {
            item_id: "monitor-1",
            section_key: "monitoring_json",
            text: "Recheck unresolved alerts today.",
            priority: "high",
            timing: "today",
            confidence: "medium",
            ranked_sources: [
              { source_type: "live_alerts", authority_level: "high" },
              { source_type: "service_state", authority_level: "medium" },
            ],
          },
        ],
      },
    });

    expect(summary).toMatchObject({
      overall_status: "strong",
      strong_count: 1,
      high_priority_fragile_count: 0,
    });
    expect(summary?.items?.[0]).toMatchObject({
      diversity_status: "strong",
      distinct_source_type_count: 2,
      live_source_count: 2,
    });
  });

  it("flags high-pressure recommendations that rely on indirect evidence only", () => {
    const summary = buildHealthPlanRecommendationEvidenceDiversity({
      recommendationSourceRanking: {
        items: [
          {
            item_id: "care-1",
            section_key: "caregiver_guidance_json",
            text: "Share broad updates with the family today.",
            priority: "high",
            timing: "today",
            confidence: "high",
            ranked_sources: [
              { source_type: "profile_context", authority_level: "supporting" },
              { source_type: "predictive", authority_level: "medium" },
            ],
          },
        ],
      },
    });

    expect(summary).toMatchObject({
      overall_status: "fragile",
      fragile_count: 1,
      high_priority_fragile_count: 1,
    });
    expect(summary?.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "single_source_high_pressure", severity: "high" }),
        expect.objectContaining({ type: "indirect_only_grounding" }),
        expect.objectContaining({ type: "high_confidence_low_diversity", severity: "high" }),
      ]),
    );
    expect(shouldRejectHealthPlanRecommendationEvidenceDiversity(summary)).toBe(true);
  });
});
