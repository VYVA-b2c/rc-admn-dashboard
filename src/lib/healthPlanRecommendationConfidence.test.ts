import { describe, expect, it } from "vitest";

import { deriveHealthPlanRecommendationConfidence } from "@/lib/healthPlanRecommendationConfidence";

describe("deriveHealthPlanRecommendationConfidence", () => {
  it("prefers the backend recommendation use mode and summary when available", () => {
    expect(
      deriveHealthPlanRecommendationConfidence({
        item: {
          id: "escalation-1",
          text: "Escalate the same day if the next outreach still does not land.",
          source_signal_ids: ["alert-active"],
          recommendation_use_mode: "staff_review_only",
          recommendation_use_reason_codes: ["staff_escalated", "urgent_timing"],
          recommendation_use_summary:
            "Staff review only: this recommendation has already been escalated, so keep it in staff-only handling until the stronger route lands and is recorded.",
        },
        signals: [
          {
            id: "alert-active",
            label: "Active alert",
            category: "alert",
            strength: "high",
            freshness: "live",
          },
        ],
        contextSnapshot: null,
        section: "escalation",
      }),
    ).toEqual({
      state: "staff_review_only",
      useMode: "staff_review_only",
      reasonCodes: ["staff_escalated", "urgent_timing"],
      signalLabels: ["Active alert"],
      verificationText:
        "Staff review only: this recommendation has already been escalated, so keep it in staff-only handling until the stronger route lands and is recorded.",
    });
  });

  it("falls back to signal-derived confidence when the backend use mode is absent", () => {
    expect(
      deriveHealthPlanRecommendationConfidence({
        item: {
          id: "monitor-1",
          text: "Monitor whether the current route lands today.",
          source_signal_ids: ["execution-contact-path-weak"],
        },
        signals: [
          {
            id: "execution-contact-path-weak",
            label: "Current contact path may not be landing",
            category: "context",
            strength: "medium",
            freshness: "recent",
          },
        ],
        contextSnapshot: null,
        section: "monitoring",
      }),
    ).toEqual({
      state: "verify_first",
      reasonCodes: ["review_signal_linked"],
      signalLabels: ["Current contact path may not be landing"],
      verificationText: "Verify this recommendation against a fresh touchpoint before treating it as current.",
    });
  });
});
