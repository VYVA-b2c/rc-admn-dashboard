import { describe, expect, it } from "vitest";

import { buildHealthPlanRecommendationImpact } from "./healthPlanRecommendationImpact.js";

describe("healthPlanRecommendationImpact", () => {
  it("flags exact recommendations that are being contradicted after the plan went live", () => {
    const summary = buildHealthPlanRecommendationImpact({
      plan: {
        monitoring_json: [
          {
            id: "monitor-1",
            text: "Watch for repeated missed or unconfirmed medication doses this week.",
            priority: "high",
            confidence: "high",
            timing: "today",
            source_signal_ids: ["medication-plan", "alert-active"],
          },
        ],
        goals_json: [],
        daily_support_json: [],
        escalation_json: [],
        caregiver_guidance_json: [],
      },
      sourceSignals: [
        { id: "medication-plan", category: "medication", label: "Medication plan on file" },
        { id: "alert-active", category: "alert", label: "Open alert" },
      ],
      followThrough: {
        caution_signals: [
          { id: "medication-problem-since-plan", detail: "Medication activity after plan generation shows a missed or unresolved outcome." },
          { id: "new-alerts-since-plan", detail: "A new unresolved alert appeared after plan generation." },
        ],
      },
      recentOperationalEvents: [
        { source: "medication", status: "missed", occurred_at: "2026-06-20T09:00:00.000Z", signal_ids: ["medication-plan"] },
        { source: "alert", status: "pending", occurred_at: "2026-06-20T10:00:00.000Z", signal_ids: ["alert-active"] },
      ],
      liveEvidenceSummary: {
        medication_adherence: { status: "pressure", summary: "Medication confirmation remains unstable." },
        sensor_reliability: { status: "watch", summary: "Alerts are still active." },
        contact_pressure: { status: "pressure", summary: "Reachability remains weak." },
      },
    });

    expect(summary).toMatchObject({
      overall_status: "contradicted",
      high_priority_contradicted_count: 1,
    });
    expect(summary?.items[0]).toMatchObject({
      item_id: "monitor-1",
      impact_status: "contradicted",
      recommended_action: "retire",
    });
  });

  it("preserves recommendations that are being reinforced by recent evidence", () => {
    const summary = buildHealthPlanRecommendationImpact({
      plan: {
        daily_support_json: [
          {
            id: "daily-1",
            text: "Keep the morning support call active and confirm hydration.",
            priority: "high",
            confidence: "high",
            timing: "today",
            source_signal_ids: ["service-checkins"],
          },
        ],
        caregiver_guidance_json: [
          {
            id: "caregiver-1",
            text: "Ask the caregiver to confirm whether the morning call landed.",
            priority: "medium",
            confidence: "medium",
            timing: "today",
            source_signal_ids: ["care-circle-context", "service-checkins"],
          },
        ],
        goals_json: [],
        monitoring_json: [],
        escalation_json: [],
      },
      sourceSignals: [
        { id: "service-checkins", category: "service", label: "Check-ins enabled" },
        { id: "care-circle-context", category: "care-circle", label: "Care circle context" },
      ],
      followThrough: {
        positive_signals: [
          { id: "checkin-since-plan", detail: "A successful check-in outcome has been recorded since this plan was generated." },
        ],
      },
      recentOperationalEvents: [
        { source: "checkins", status: "completed", occurred_at: "2026-06-20T08:00:00.000Z", signal_ids: ["service-checkins"] },
        { source: "campaign_call", status: "reached", occurred_at: "2026-06-20T09:00:00.000Z", signal_ids: ["care-circle-context"] },
      ],
      liveEvidenceSummary: {
        service_engagement: { status: "stable", summary: "Recent scheduled touchpoints are landing." },
        contact_pressure: { status: "stable", summary: "The client has stayed reachable." },
      },
    });

    expect(summary).toMatchObject({
      overall_status: "reinforcing",
      preserve_count: 2,
    });
    expect(summary?.items.every((item) => item.recommended_action === "preserve")).toBe(true);
  });
});
