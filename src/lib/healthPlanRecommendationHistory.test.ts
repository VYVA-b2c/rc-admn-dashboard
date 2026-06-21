import { describe, expect, it } from "vitest";

import { buildHealthPlanRecommendationHistory } from "./healthPlanRecommendationHistory.js";

describe("healthPlanRecommendationHistory", () => {
  it("marks recovering recommendations as improving when the latest version reinforces them after earlier pressure", () => {
    const summary = buildHealthPlanRecommendationHistory({
      history: [
        {
          version_number: 4,
          quality_snapshot_json: {
            recommendation_impact: {
              items: [
                {
                  section_key: "daily_support_json",
                  section_label: "Daily support",
                  text: "Keep the morning medication check-in routine.",
                  impact_status: "reinforced",
                  recommended_action: "preserve",
                  reason: "The latest routine is now landing more consistently.",
                },
              ],
            },
          },
        },
        {
          version_number: 3,
          quality_snapshot_json: {
            recommendation_impact: {
              items: [
                {
                  section_key: "daily_support_json",
                  section_label: "Daily support",
                  text: "Keep the morning medication check-in routine.",
                  impact_status: "mixed",
                  recommended_action: "verify",
                },
              ],
            },
          },
        },
      ],
    });

    expect(summary.overall_status).toBe("supportive");
    expect(summary.improving_count).toBe(1);
    expect(summary.items[0]).toMatchObject({
      trend_status: "improving",
      current_impact_status: "reinforced",
      current_recommended_action: "preserve",
    });
  });

  it("marks repeatedly contradicted high-priority recommendations as deteriorating", () => {
    const summary = buildHealthPlanRecommendationHistory({
      history: [
        {
          version_number: 5,
          quality_snapshot_json: {
            recommendation_impact: {
              items: [
                {
                  section_key: "monitoring_json",
                  section_label: "Monitoring",
                  text: "Wait for the next routine check before escalating missed contact.",
                  impact_status: "contradicted",
                  recommended_action: "retire",
                  is_high_priority: true,
                  reason: "Fresh missed-contact events already show this is too soft.",
                },
              ],
            },
          },
        },
        {
          version_number: 4,
          quality_snapshot_json: {
            recommendation_impact: {
              items: [
                {
                  section_key: "monitoring_json",
                  text: "Wait for the next routine check before escalating missed contact.",
                  impact_status: "contradicted",
                  recommended_action: "rework",
                },
              ],
            },
          },
        },
      ],
    });

    expect(summary.overall_status).toBe("deteriorating");
    expect(summary.deteriorating_count).toBe(1);
    expect(summary.repeated_contradiction_count).toBe(1);
    expect(summary.high_priority_deteriorating_count).toBe(1);
    expect(summary.items[0]).toMatchObject({
      trend_status: "deteriorating",
      is_high_priority: true,
    });
  });

  it("falls back to saved recommendation effectiveness when older impact snapshots are missing", () => {
    const summary = buildHealthPlanRecommendationHistory({
      history: [
        {
          version_number: 3,
          quality_snapshot_json: {
            recommendation_effectiveness: {
              preserve_now: [
                {
                  section_key: "goals_json",
                  text: "Keep Carmen reachable by phone every morning.",
                  action: "preserve",
                  action_reason: "This routine already helped.",
                },
              ],
            },
          },
        },
        {
          version_number: 2,
          quality_snapshot_json: {
            recommendation_effectiveness: {
              rework_now: [
                {
                  section_key: "goals_json",
                  text: "Keep Carmen reachable by phone every morning.",
                  action: "verify",
                  action_reason: "This still needed verification earlier.",
                },
              ],
            },
          },
        },
      ],
    });

    expect(summary.improving_count).toBe(1);
    expect(summary.items[0]).toMatchObject({
      trend_status: "improving",
      current_impact_status: "reinforced",
      current_recommended_action: "preserve",
    });
  });
});
