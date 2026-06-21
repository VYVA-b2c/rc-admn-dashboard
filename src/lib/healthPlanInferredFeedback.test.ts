import { describe, expect, it } from "vitest";

import { buildHealthPlanInferredFeedbackEntries } from "./healthPlanInferredFeedback.js";

describe("buildHealthPlanInferredFeedbackEntries", () => {
  const plan = {
    generated_at: "2026-06-20T06:00:00.000Z",
    daily_support_json: [
      { id: "daily-1", text: "Run the morning check-in.", source_signal_ids: ["service-checkins"] },
      { id: "daily-2", text: "Support medication routine.", source_signal_ids: ["medication-plan"] },
    ],
    monitoring_json: [
      { id: "monitor-1", text: "Watch medication misses.", source_signal_ids: ["medication-plan"] },
      { id: "monitor-2", text: "Watch risk and alerts.", source_signal_ids: ["risk-latest-score", "alert-active"] },
    ],
    escalation_json: [
      { id: "escalation-1", text: "Escalate unresolved alerts.", source_signal_ids: ["alert-active", "risk-latest-score"] },
    ],
    goals_json: [
      { id: "goal-1", text: "Keep routines steady.", source_signal_ids: ["risk-latest-score"] },
    ],
  };

  it("turns failed recent check-ins into caution feedback", () => {
    const entries = buildHealthPlanInferredFeedbackEntries({
      plan,
      profile: {
        checkins: {
          last_reported_at: "2026-06-20T09:00:00.000Z",
          last_outcome: "missed",
        },
      },
    });

    expect(entries.some((item) => item.section_key === "daily_support_json" && item.outcome === "needs_follow_up")).toBe(true);
    expect(entries.some((item) => item.item_id === "daily-1" && item.source === "inferred_operational")).toBe(true);
  });

  it("turns successful medication activity into helped feedback for linked recommendations", () => {
    const entries = buildHealthPlanInferredFeedbackEntries({
      plan,
      profile: {
        medicationActivity: {
          occurred_at: "2026-06-20T10:00:00.000Z",
          status: "confirmed",
        },
      },
    });

    expect(entries.some((item) => item.section_key === "monitoring_json" && item.outcome === "helped")).toBe(true);
    expect(entries.some((item) => item.item_id === "monitor-1" && item.outcome === "helped")).toBe(true);
  });

  it("uses follow-through caution to infer monitoring and escalation evidence", () => {
    const entries = buildHealthPlanInferredFeedbackEntries({
      plan,
      followThrough: {
        caution_signals: [
          { id: "new-alerts-since-plan", label: "New unresolved alerts" },
          { id: "risk-worsened", label: "Risk got worse" },
        ],
      },
    });

    expect(entries.some((item) => item.section_key === "monitoring_json" && item.outcome === "needs_follow_up")).toBe(true);
    expect(entries.some((item) => item.item_id === "escalation-1" && item.outcome === "needs_follow_up")).toBe(true);
  });

  it("uses richer recent operational events when they are available", () => {
    const entries = buildHealthPlanInferredFeedbackEntries({
      plan,
      profile: {
        checkins: {
          last_reported_at: "2026-06-20T07:00:00.000Z",
          last_outcome: "confirmed",
        },
        recentOperationalEvents: [
          {
            id: "checkin-recent",
            source: "checkins",
            status: "missed",
            occurred_at: "2026-06-20T10:15:00.000Z",
            note: "Morning check-in was missed.",
            signal_ids: ["service-checkins"],
          },
        ],
      },
    });

    expect(entries.some((item) => item.note === "Morning check-in was missed." && item.outcome === "needs_follow_up")).toBe(true);
    expect(entries.some((item) => item.recorded_at === "2026-06-20T10:15:00.000Z")).toBe(true);
  });

  it("treats failed campaign outreach as observed follow-up pressure", () => {
    const entries = buildHealthPlanInferredFeedbackEntries({
      plan,
      profile: {
        recentOperationalEvents: [
          {
            id: "campaign-1",
            source: "campaign_call",
            status: "failed",
            occurred_at: "2026-06-20T11:00:00.000Z",
            note: "Campaign outreach failed after two attempts.",
          },
        ],
      },
    });

    expect(entries.some((item) => item.section_key === "monitoring_json" && item.outcome === "needs_follow_up")).toBe(true);
    expect(entries.some((item) => item.section_key === "escalation_json" && item.note === "Campaign outreach failed after two attempts.")).toBe(true);
  });
});
