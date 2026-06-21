import { describe, expect, it } from "vitest";

import { buildHealthPlanActionImpact } from "./healthPlanActionImpact.js";

describe("healthPlanActionImpact", () => {
  it("flags contradicted sections when post-plan pressure overtakes the guidance", () => {
    const summary = buildHealthPlanActionImpact({
      plan: {
        goals_json: [{ text: "Keep the client stable this week." }],
        daily_support_json: [{ text: "Keep daily support routines consistent." }],
        monitoring_json: [{ text: "Monitor alerts and medication adherence." }],
        escalation_json: [{ text: "Escalate same day if reachability worsens." }],
        caregiver_guidance_json: [{ text: "Ask the caregiver to report back today." }],
      },
      followThrough: {
        caution_signals: [
          {
            id: "risk-worsened",
            label: "Risk score has increased since plan generation",
            detail: "The latest predictive score is higher than when the plan was generated.",
          },
          {
            id: "new-alerts-since-plan",
            label: "New unresolved alerts since plan generation",
            detail: "Two unresolved alerts appeared after this plan went live.",
          },
        ],
      },
      recentOperationalEvents: [
        { source: "alert", status: "pending", occurred_at: "2026-06-20T10:00:00.000Z", label: "New fall-risk alert" },
        { source: "checkins", status: "missed", occurred_at: "2026-06-20T09:00:00.000Z", label: "Morning check-in missed" },
      ],
      liveEvidenceSummary: {
        contact_pressure: { status: "pressure", summary: "Reachability remains unreliable today." },
        sensor_reliability: { status: "pressure", summary: "Alert pressure is still active." },
        medication_adherence: { status: "watch", summary: "Medication confirmation is still uneven." },
      },
      operationalCompleteness: {
        section_checks: [
          { section_key: "monitoring_json", overall_status: "fragile" },
          { section_key: "escalation_json", overall_status: "guarded" },
        ],
      },
    });

    expect(summary).toMatchObject({
      overall_status: "contradicted",
    });
    expect(summary?.contradicted_count).toBeGreaterThan(0);
    expect(summary?.items.some((item) => item.section_key === "monitoring_json" && item.impact_status === "contradicted")).toBe(true);
  });

  it("recognizes reinforced sections when the live picture is supporting the current routine", () => {
    const summary = buildHealthPlanActionImpact({
      plan: {
        daily_support_json: [{ text: "Keep the morning support routine active." }],
        caregiver_guidance_json: [{ text: "Ask the caregiver to confirm contact after the morning check-in." }],
      },
      followThrough: {
        positive_signals: [
          {
            id: "checkin-since-plan",
            label: "Fresh check-in evidence",
            detail: "A successful check-in outcome has been recorded since this plan was generated.",
          },
          {
            id: "resolved-alerts-since-plan",
            label: "Alerts resolved after plan generation",
            detail: "An alert was resolved after the plan was generated.",
          },
        ],
      },
      recentOperationalEvents: [
        { source: "checkins", status: "completed", occurred_at: "2026-06-20T08:30:00.000Z", label: "Morning check-in completed" },
        { source: "campaign_call", status: "reached", occurred_at: "2026-06-20T09:15:00.000Z", label: "Caregiver outreach reached" },
      ],
      liveEvidenceSummary: {
        service_engagement: { status: "stable", summary: "Recent scheduled touchpoints are landing." },
        contact_pressure: { status: "stable", summary: "The client has stayed reachable." },
      },
      operationalCompleteness: {
        section_checks: [
          { section_key: "daily_support_json", overall_status: "strong" },
          { section_key: "caregiver_guidance_json", overall_status: "strong" },
        ],
      },
    });

    expect(summary).toMatchObject({
      overall_status: "reinforcing",
      reinforced_count: 2,
    });
    expect(summary?.items.every((item) => item.impact_status === "reinforced")).toBe(true);
  });
});
