import { describe, expect, it } from "vitest";

import {
  buildHealthPlanRecommendationEffectiveness,
  findHealthPlanRecommendationEffectivenessIssues,
} from "./healthPlanRecommendationEffectiveness.js";

describe("healthPlanRecommendationEffectiveness", () => {
  it("separates preserve, rework, and retire recommendations from recommendation learning", () => {
    const summary = buildHealthPlanRecommendationEffectiveness({
      recommendationLearning: [
        {
          item_id: "daily-1",
          section_key: "daily_support_json",
          section_label: "Daily support",
          text: "Keep the morning medication routine.",
          status: "helping",
          latest_source: "manual",
          freshness_status: "fresh",
          trajectory: "strengthening",
          reuse_priority: "preserve",
          explicit_helped_count: 2,
          helped_count: 2,
          feedback_count: 2,
          source_signal_ids: ["med-signal"],
          reason: "This routine repeatedly helped.",
        },
        {
          item_id: "monitor-1",
          section_key: "monitoring_json",
          section_label: "Monitoring",
          text: "Watch for missed medication.",
          status: "mixed",
          latest_source: "manual",
          freshness_status: "fresh",
          trajectory: "volatile",
          reuse_priority: "refine",
          explicit_feedback_count: 1,
          needs_follow_up_count: 1,
          feedback_count: 2,
          source_signal_ids: ["med-signal"],
          reason: "This still needs refinement.",
        },
        {
          item_id: "escalate-1",
          section_key: "escalation_json",
          section_label: "Escalation",
          text: "Escalate unresolved alerts.",
          status: "fragile",
          latest_source: "manual",
          freshness_status: "fresh",
          trajectory: "weakening",
          reuse_priority: "replace",
          explicit_feedback_count: 2,
          did_not_help_count: 1,
          needs_follow_up_count: 1,
          feedback_count: 2,
          source_signal_ids: ["alert-signal"],
          reason: "This repeatedly failed.",
        },
      ],
      recommendationSurvivorship: {
        durable: [{ text: "Keep the morning medication routine." }],
        fragile: [{ text: "Escalate unresolved alerts." }],
        retired: [],
      },
    });

    expect(summary.overall_status).toBe("mixed");
    expect(summary.preserve_now[0]).toMatchObject({ action: "preserve", preserve_strength: "must_preserve" });
    expect(summary.rework_now[0]).toMatchObject({ action: "rework", repair_strength: "must_rewrite" });
    expect(summary.retire_now[0]).toMatchObject({ action: "retire", repair_strength: "must_replace" });
    expect(summary.must_preserve_count).toBe(1);
    expect(summary.must_rewrite_count).toBe(1);
    expect(summary.must_replace_count).toBe(1);
  });

  it("lets fresh recommendation impact override an older preserve instinct", () => {
    const summary = buildHealthPlanRecommendationEffectiveness({
      recommendationLearning: [
        {
          item_id: "daily-1",
          section_key: "daily_support_json",
          section_label: "Daily support",
          text: "Keep the morning medication routine.",
          status: "helping",
          freshness_status: "fresh",
          trajectory: "stable",
          reuse_priority: "preserve",
          helped_count: 2,
          feedback_count: 2,
          source_signal_ids: ["med-signal"],
          reason: "This routine previously helped.",
        },
      ],
      recommendationImpact: {
        items: [
          {
            item_id: "daily-1",
            section_key: "daily_support_json",
            impact_status: "contradicted",
            recommended_action: "retire",
            reason: "Fresh medication misses are already contradicting this exact routine.",
          },
        ],
      },
    });

    expect(summary.preserve_now).toEqual([]);
    expect(summary.retire_now[0]).toMatchObject({
      action: "retire",
      impact_status: "contradicted",
    });
  });

  it("honors an explicit staff next-step recommendation over inferred reuse priority", () => {
    const summary = buildHealthPlanRecommendationEffectiveness({
      recommendationLearning: [
        {
          item_id: "monitor-1",
          section_key: "monitoring_json",
          section_label: "Monitoring",
          text: "Watch for missed medication.",
          status: "helping",
          freshness_status: "fresh",
          trajectory: "stable",
          reuse_priority: "preserve",
          latest_recommended_next_action: "rework",
          latest_confidence_level: "high",
          latest_source: "manual",
          feedback_count: 1,
          source_signal_ids: ["med-signal"],
          reason: "Staff wants this rewritten before reuse.",
        },
      ],
    });

    expect(summary.preserve_now).toEqual([]);
    expect(summary.rework_now[0]).toMatchObject({
      action: "rework",
      latest_recommended_next_action: "rework",
      repair_strength: "must_rewrite",
    });
  });

  it("flags unchanged return of recommendations that should be retired or reworked", () => {
    const effectiveness = buildHealthPlanRecommendationEffectiveness({
      recommendationLearning: [
        {
          item_id: "monitor-1",
          section_key: "monitoring_json",
          section_label: "Monitoring",
          text: "Watch for missed medication.",
          status: "mixed",
          trajectory: "volatile",
          reuse_priority: "refine",
          feedback_count: 2,
          reason: "Needs rework.",
        },
        {
          item_id: "escalate-1",
          section_key: "escalation_json",
          section_label: "Escalation",
          text: "Escalate unresolved alerts.",
          status: "fragile",
          trajectory: "weakening",
          reuse_priority: "replace",
          did_not_help_count: 2,
          reason: "Should be retired.",
        },
      ],
    });

    const issues = findHealthPlanRecommendationEffectivenessIssues({
      monitoring_json: [{ text: "Watch for missed medication.", source_signal_ids: ["med"] }],
      escalation_json: [{ text: "Escalate unresolved alerts.", source_signal_ids: ["alert"] }],
      goals_json: [],
      daily_support_json: [],
      caregiver_guidance_json: [],
    }, effectiveness);

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "rework_recommendation_returned_unchanged", severity: "medium" }),
        expect.objectContaining({ type: "retired_recommendation_returned", severity: "high" }),
      ]),
    );
  });

  it("lets fragile survivorship override an old preserve instinct", () => {
    const summary = buildHealthPlanRecommendationEffectiveness({
      recommendationLearning: [
        {
          item_id: "monitor-1",
          section_key: "monitoring_json",
          section_label: "Monitoring",
          text: "Watch for missed medication.",
          status: "helping",
          freshness_status: "fresh",
          trajectory: "stable",
          reuse_priority: "preserve",
          helped_count: 2,
          feedback_count: 2,
          source_signal_ids: ["med-signal"],
          reason: "This used to look preserve-worthy.",
        },
      ],
      recommendationSurvivorship: {
        fragile: [
          {
            section_key: "monitoring_json",
            text: "Watch for missed medication.",
            status: "fragile",
            caution_feedback_count: 2,
            reason: "This wording survived multiple versions, but repeated unresolved outcomes say it should not be treated as stable.",
          },
        ],
      },
    });

    expect(summary.preserve_now).toEqual([]);
    expect(summary.retire_now[0]).toMatchObject({
      action: "retire",
      section_key: "monitoring_json",
      survivorship_status: "fragile",
    });
  });

  it("treats a fresh caution outcome as stronger than older helped history", () => {
    const summary = buildHealthPlanRecommendationEffectiveness({
      recommendationLearning: [
        {
          item_id: "daily-1",
          section_key: "daily_support_json",
          section_label: "Daily support",
          text: "Keep the morning medication routine.",
          status: "mixed",
          latest_source: "manual",
          freshness_status: "fresh",
          trajectory: "weakening",
          reuse_priority: "verify",
          explicit_helped_count: 2,
          helped_count: 2,
          did_not_help_count: 1,
          recent_caution_count: 1,
          weighted_helped_score: 1.04,
          weighted_caution_score: 1.38,
          source_signal_ids: ["med-signal"],
          reason: "A recent failure has overtaken older wins.",
        },
      ],
    });

    expect(summary.preserve_now).toEqual([]);
    expect(summary.rework_now[0]).toMatchObject({
      action: "verify",
      repair_strength: "must_verify",
    });
  });
});
