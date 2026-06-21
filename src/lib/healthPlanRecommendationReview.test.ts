import { describe, expect, it } from "vitest";

import {
  buildHealthPlanRecommendationReviewSummary,
  missingHealthPlanRecommendationReviewDecisions,
  normalizeHealthPlanRecommendationReviewDecisions,
} from "./healthPlanRecommendationReview.js";

describe("healthPlanRecommendationReview", () => {
  it("dedupes and normalizes persisted review decisions", () => {
    const result = normalizeHealthPlanRecommendationReviewDecisions([
      {
        section_key: "monitoring_json",
        item_id: "monitor-1",
        text: "Recheck missed medication confirmation today.",
        decision_status: "watch",
        rationale: "Keep an eye on the next touchpoint.",
        updated_at: "2026-06-20T10:00:00.000Z",
      },
      {
        section_key: "monitoring_json",
        item_id: "monitor-1",
        text: "Recheck missed medication confirmation today.",
        decision_status: "approved",
        rationale: "Later decision wins.",
      },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      section_key: "monitoring_json",
      item_id: "monitor-1",
      decision_status: "approved",
      rationale: "Later decision wins.",
    });
  });

  it("requires explicit decisions for flagged recommendations and blocks rewrite requests", () => {
    const summary = buildHealthPlanRecommendationReviewSummary({
      plan: {
        monitoring_json: [
          {
            id: "monitor-1",
            text: "Recheck missed medication confirmation today and escalate if the client stays unreachable.",
            priority: "high",
            timing: "today",
          },
        ],
        daily_support_json: [
          {
            id: "daily-1",
            text: "Keep the morning support routine while confirming the next medication touchpoint.",
            priority: "medium",
          },
        ],
      },
      recommendationImpact: {
        items: [
          {
            item_id: "monitor-1",
            section_key: "monitoring_json",
            section_label: "Monitoring",
            text: "Recheck missed medication confirmation today and escalate if the client stays unreachable.",
            impact_status: "contradicted",
            is_high_priority: true,
            reason: "Fresh misses are contradicting this monitoring routine.",
            next_step: "Rewrite the monitoring wording decisively.",
          },
        ],
      },
      recommendationHistory: {
        items: [
          {
            section_key: "daily_support_json",
            section_label: "Daily support",
            text: "Keep the morning support routine while confirming the next medication touchpoint.",
            trend_status: "volatile",
            reason: "This routine keeps changing across saved versions.",
          },
        ],
      },
      recommendationEvidenceDiversity: {
        items: [
          {
            item_id: "monitor-1",
            section_key: "monitoring_json",
            section_label: "Monitoring",
            text: "Recheck missed medication confirmation today and escalate if the client stays unreachable.",
            diversity_status: "fragile",
            high_pressure: true,
            reason: "This recommendation still leans on too narrow a live evidence mix.",
            next_step: "Add a stronger live anchor or soften the wording.",
          },
        ],
      },
      recommendationChallenges: {
        items: [
          {
            item_id: "daily-1",
            section_key: "daily_support_json",
            section_label: "Daily support",
            text: "Keep the morning support routine while confirming the next medication touchpoint.",
            challenge_status: "guarded",
            why_it_is_questioned: "The fallback path is still too vague if the next reminder fails.",
            safer_reframe: "Name the fallback contact step.",
          },
        ],
      },
      recommendationReviewDecisions: [
        {
          section_key: "monitoring_json",
          item_id: "monitor-1",
          text: "Recheck missed medication confirmation today and escalate if the client stays unreachable.",
          decision_status: "needs_edit",
          rationale: "This needs a clearer live anchor before we approve it.",
        },
      ],
    });

    expect(summary).toMatchObject({
      overall_status: "blocked",
      can_mark_reviewed: false,
      required_count: 2,
      needs_edit_count: 1,
      missing_count: 1,
    });
    expect(missingHealthPlanRecommendationReviewDecisions(summary)).toHaveLength(1);
    expect(summary.blocking_items.some((item) => /rewrite requested/i.test(String(item?.label || "")))).toBe(true);
  });

  it("stays guarded when all flagged recommendations are decided but one remains on watch", () => {
    const summary = buildHealthPlanRecommendationReviewSummary({
      plan: {
        monitoring_json: [{ id: "monitor-1", text: "Verify the next check-in response today." }],
        daily_support_json: [{ id: "daily-1", text: "Preserve the morning routine and confirm the next medication touchpoint." }],
      },
      recommendationHistory: {
        items: [
          {
            item_id: "monitor-1",
            section_key: "monitoring_json",
            section_label: "Monitoring",
            text: "Verify the next check-in response today.",
            trend_status: "volatile",
            reason: "This recommendation has not fully settled yet.",
          },
        ],
      },
      recommendationGrounding: {
        items: [
          {
            item_id: "daily-1",
            section_key: "daily_support_json",
            section_label: "Daily support",
            text: "Preserve the morning routine and confirm the next medication touchpoint.",
            grounding_status: "guarded",
            reason: "The routine is usable, but still needs a cautious evidence frame.",
            next_step: "Keep verification wording in place.",
          },
        ],
      },
      recommendationReviewDecisions: [
        {
          section_key: "monitoring_json",
          item_id: "monitor-1",
          text: "Verify the next check-in response today.",
          decision_status: "watch",
          rationale: "We can use this, but only while we confirm the next response cycle.",
        },
        {
          section_key: "daily_support_json",
          item_id: "daily-1",
          text: "Preserve the morning routine and confirm the next medication touchpoint.",
          decision_status: "approved",
          rationale: "This is aligned with the current live picture.",
        },
      ],
    });

    expect(summary).toMatchObject({
      overall_status: "guarded",
      can_mark_reviewed: true,
      approved_count: 1,
      watch_count: 1,
      missing_count: 0,
    });
    expect(summary.caution_items).toHaveLength(1);
  });
});
