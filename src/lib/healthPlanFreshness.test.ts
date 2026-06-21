import { describe, expect, it } from "vitest";

import { buildHealthPlanFreshnessSnapshot } from "./healthPlanFreshness.js";

describe("health plan freshness", () => {
  it("marks a reviewed plan critical when new caution events arrive after review", () => {
    const snapshot = buildHealthPlanFreshnessSnapshot({
      plan: {
        generated_at: "2026-06-18T08:00:00.000Z",
        reviewed_at: "2026-06-19T08:00:00.000Z",
      },
      followThrough: {
        status: "fresh",
      },
      recentOperationalEvents: [
        {
          source: "checkins",
          status: "missed",
          occurred_at: "2026-06-19T12:00:00.000Z",
          signal_ids: ["service-checkins"],
        },
      ],
      reviewGovernance: {
        review_required: false,
        review_window: "ongoing",
      },
      now: "2026-06-20T08:00:00.000Z",
    });

    expect(snapshot).toMatchObject({
      status: "critical",
      checkpoint_type: "reviewed",
      caution_event_count: 1,
      should_rereview: true,
      should_regenerate: true,
      safe_to_share: false,
    });
    expect(snapshot?.drivers[0]?.id).toBe("new-caution-events-after-review");
  });

  it("marks an unreviewed plan stale when follow-through needs review", () => {
    const snapshot = buildHealthPlanFreshnessSnapshot({
      plan: {
        generated_at: "2026-06-18T08:00:00.000Z",
      },
      followThrough: {
        status: "needs_review",
        summary: "The situation has moved on since generation.",
        caution_signals: [{ id: "new-alerts-since-plan" }],
      },
      recentOperationalEvents: [],
      reviewGovernance: {
        review_required: true,
        review_window: "this_week",
        review_summary: "This plan should be reviewed again.",
      },
      sectionDrift: [{ section_label: "Monitoring", status: "needs_refresh" }],
      now: "2026-06-20T08:00:00.000Z",
    });

    expect(snapshot).toMatchObject({
      status: "stale",
      checkpoint_type: "generated",
      should_rereview: true,
      safe_to_share: false,
    });
    expect(snapshot?.drivers.map((item) => item.id)).toContain("follow-through-needs-review");
  });

  it("keeps a recent plan current when no fresh contradictions exist", () => {
    const snapshot = buildHealthPlanFreshnessSnapshot({
      plan: {
        generated_at: "2026-06-20T06:00:00.000Z",
      },
      followThrough: {
        status: "fresh",
      },
      recentOperationalEvents: [
        {
          source: "checkins",
          status: "completed",
          occurred_at: "2026-06-20T07:00:00.000Z",
          signal_ids: ["service-checkins"],
        },
      ],
      reviewGovernance: {
        review_required: false,
        review_window: "ongoing",
      },
      now: "2026-06-20T08:00:00.000Z",
    });

    expect(snapshot).toMatchObject({
      status: "aging",
      caution_event_count: 0,
      positive_event_count: 1,
      should_rereview: false,
      safe_to_share: true,
    });
  });
});
