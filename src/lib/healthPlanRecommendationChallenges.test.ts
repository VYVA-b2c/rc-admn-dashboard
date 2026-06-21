import { describe, expect, it } from "vitest";

import {
  buildHealthPlanRecommendationChallenges,
  shouldRejectHealthPlanRecommendationChallenges,
} from "./healthPlanRecommendationChallenges.js";

describe("healthPlanRecommendationChallenges", () => {
  it("flags fragile high-pressure recommendations that still lack fallback wording", () => {
    const summary = buildHealthPlanRecommendationChallenges({
      plan: {
        monitoring_json: [
          {
            id: "monitor-1",
            text: "Keep the routine steady and continue monitoring.",
            source_signal_ids: ["alert-active"],
            priority: "high",
            timing: "today",
          },
        ],
        goals_json: [],
        daily_support_json: [],
        escalation_json: [],
        caregiver_guidance_json: [],
      },
      sourceSignals: [
        { id: "alert-active", category: "alert", strength: "medium" },
      ],
      reviewPriorities: {
        items: [
          { section_key: "monitoring_json", priority: "high", response_window: "today" },
        ],
      },
      liveEvidenceSummary: {
        service_engagement: {
          status: "pressure",
          summary: "Recent contact attempts are repeatedly failing.",
          windows: { trend: "worsening" },
        },
      },
      longitudinalMemory: {
        domains: [
          { key: "contact", status: "persistent_pressure", why_it_matters: "Reachability keeps resurfacing across recent plan cycles." },
        ],
      },
    });

    expect(summary?.overall_status).toBe("challenged");
    expect(summary?.challenged_count).toBe(1);
    expect(summary?.high_risk_count).toBe(1);
    expect(summary?.items[0]).toMatchObject({
      challenge_status: "challenged",
      evidence_support: "mixed",
      fallback_gap: true,
      high_risk: true,
    });
    expect(summary?.items[0]?.why_it_is_questioned).toMatch(/evidence|fails|worsens|calmer/i);
    expect(shouldRejectHealthPlanRecommendationChallenges(summary)).toBe(true);
  });

  it("keeps well-supported routine guidance out of the challenge bucket", () => {
    const summary = buildHealthPlanRecommendationChallenges({
      plan: {
        monitoring_json: [],
        escalation_json: [],
        caregiver_guidance_json: [],
        goals_json: [],
        daily_support_json: [
          {
            id: "daily-1",
            text: "Confirm the morning medication routine and call the caregiver if the dose is missed.",
            source_signal_ids: ["med-plan", "care-circle"],
            priority: "medium",
            timing: "ongoing",
          },
        ],
      },
      sourceSignals: [
        { id: "med-plan", category: "medication", strength: "high" },
        { id: "care-circle", category: "care-circle", strength: "medium" },
      ],
      reviewPriorities: {
        items: [
          { section_key: "daily_support_json", priority: "medium", response_window: "this_week" },
        ],
      },
      liveEvidenceSummary: {
        medication_adherence: {
          status: "watch",
          summary: "Medication adherence still needs verification.",
          windows: { trend: "mixed" },
        },
      },
    });

    expect(summary?.overall_status).toBe("supported");
    expect(summary?.challenged_count).toBe(0);
    expect(summary?.items[0]).toMatchObject({
      challenge_status: "supported",
      evidence_support: "strong",
      fallback_gap: false,
    });
    expect(shouldRejectHealthPlanRecommendationChallenges(summary)).toBe(false);
  });
});
