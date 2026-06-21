import { describe, expect, it } from "vitest";

import {
  buildHealthPlanRecommendationSourceRanking,
  findHealthPlanRecommendationSourceRankingIssues,
} from "./healthPlanRecommendationSourceRanking.js";

describe("healthPlanRecommendationSourceRanking", () => {
  it("ranks recommendation sources using authority and signal preference weights", () => {
    const ranking = buildHealthPlanRecommendationSourceRanking({
      plan: {
        monitoring_json: [
          {
            id: "monitor-1",
            text: "Recheck unresolved alerts today.",
            source_signal_ids: ["alert-active", "care-circle-context"],
            priority: "high",
            confidence: "medium",
            timing: "today",
          },
        ],
        goals_json: [],
        daily_support_json: [],
        escalation_json: [],
        caregiver_guidance_json: [],
      },
      sourceSignals: [
        { id: "alert-active", label: "1 active alert", category: "alert", strength: "high" },
        { id: "care-circle-context", label: "Care circle context", category: "care-circle", strength: "medium" },
      ],
      evidenceHierarchy: [
        { id: "alert-active", authority_level: "high", priority_score: 100, source_type: "live_alerts", reason: "Fresh live alert." },
        { id: "care-circle-context", authority_level: "supporting", priority_score: 42, source_type: "profile_context", reason: "Supporting context." },
      ],
      signalPreferenceWeights: [
        { signal_id: "alert-active", weight: 2, preference: "preserve" },
      ],
    });

    expect(ranking?.items[0]?.ranked_sources[0]).toMatchObject({
      signal_id: "alert-active",
      authority_level: "high",
    });
    expect(ranking?.items[0]?.evidence_quality).toBe("mixed");
  });

  it("flags urgent or high-confidence recommendations that outrun weak ranked evidence", () => {
    const ranking = buildHealthPlanRecommendationSourceRanking({
      plan: {
        caregiver_guidance_json: [
          {
            id: "caregiver-1",
            text: "Share broad updates with the family today.",
            source_signal_ids: ["care-circle-context"],
            priority: "high",
            confidence: "high",
            timing: "today",
          },
        ],
        goals_json: [],
        daily_support_json: [],
        monitoring_json: [],
        escalation_json: [],
      },
      sourceSignals: [
        { id: "care-circle-context", label: "Care circle context", category: "care-circle", strength: "low" },
      ],
      evidenceHierarchy: [
        { id: "care-circle-context", authority_level: "supporting", priority_score: 40, source_type: "profile_context", reason: "Supporting context." },
      ],
      recommendationChallenges: {
        items: [
          { section_key: "caregiver_guidance_json", item_id: "caregiver-1", challenge_status: "challenged" },
        ],
      },
    });

    const issues = findHealthPlanRecommendationSourceRankingIssues({
      caregiver_guidance_json: [{ text: "Share broad updates with the family today." }],
      goals_json: [],
      daily_support_json: [],
      monitoring_json: [],
      escalation_json: [],
    }, ranking);

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "high_confidence_weak_source", severity: "high" }),
        expect.objectContaining({ type: "urgent_recommendation_thin_evidence", severity: "high" }),
      ]),
    );
  });
});
