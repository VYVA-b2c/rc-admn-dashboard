import { describe, expect, it } from "vitest";

import { buildHealthPlanFollowThroughSummary } from "./healthPlanFollowThrough.js";

describe("health plan follow-through summary", () => {
  it("marks plans as fresh when new service and medication evidence arrived after generation", () => {
    const summary = buildHealthPlanFollowThroughSummary({
      now: "2026-06-20T12:00:00.000Z",
      plan: {
        generated_at: "2026-06-20T06:00:00.000Z",
      },
      profile: {
        checkins: { last_reported_at: "2026-06-20T08:00:00.000Z", last_outcome: "completed" },
        medicationActivity: { occurred_at: "2026-06-20T09:00:00.000Z", status: "confirmed" },
        alerts: [],
      },
    });

    expect(summary?.status).toBe("fresh");
    expect(summary?.fresh_touchpoints_count).toBe(2);
    expect(summary?.positive_signals.map((item) => item.id)).toEqual(
      expect.arrayContaining(["checkin-since-plan", "medication-since-plan"]),
    );
  });

  it("treats fresh but failed operational touchpoints as caution rather than positive evidence", () => {
    const summary = buildHealthPlanFollowThroughSummary({
      now: "2026-06-20T12:00:00.000Z",
      plan: {
        generated_at: "2026-06-20T06:00:00.000Z",
      },
      profile: {
        checkins: { last_reported_at: "2026-06-20T08:00:00.000Z", last_outcome: "missed" },
        medicationActivity: { occurred_at: "2026-06-20T09:00:00.000Z", status: "late" },
        alerts: [],
      },
    });

    expect(summary?.fresh_touchpoints_count).toBe(2);
    expect(summary?.caution_signals.map((item) => item.id)).toEqual(
      expect.arrayContaining(["checkin-problem-since-plan", "medication-problem-since-plan"]),
    );
  });

  it("pushes plans into needs-review when unresolved alerts or worsening risk appear after generation", () => {
    const summary = buildHealthPlanFollowThroughSummary({
      now: "2026-06-20T12:00:00.000Z",
      plan: {
        generated_at: "2026-06-18T06:00:00.000Z",
        source_signals_json: [{ id: "risk-latest-score", label: "Predictive risk score 71 (medium)", category: "risk" }],
      },
      profile: {
        alerts: [{ created_at: "2026-06-19T10:00:00.000Z", resolved_at: null }],
      },
      predictiveContext: {
        latestScore: { composite_score: 84 },
      },
    });

    expect(summary?.status).toBe("needs_review");
    expect(summary?.caution_signals.map((item) => item.id)).toEqual(
      expect.arrayContaining(["new-alerts-since-plan", "risk-worsened", "no-fresh-touchpoints"]),
    );
  });

  it("returns mixed when the plan is aging without enough new contact evidence but no acute regression exists", () => {
    const summary = buildHealthPlanFollowThroughSummary({
      now: "2026-06-20T12:00:00.000Z",
      plan: {
        generated_at: "2026-06-19T06:00:00.000Z",
      },
      profile: {
        alerts: [],
      },
    });

    expect(summary?.status).toBe("mixed");
    expect(summary?.caution_signals.map((item) => item.id)).toContain("no-fresh-touchpoints");
  });
});
