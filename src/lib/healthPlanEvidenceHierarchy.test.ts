import { describe, expect, it } from "vitest";

import {
  buildHealthPlanEvidenceConflicts,
  buildHealthPlanEvidenceHierarchy,
  buildHealthPlanEvidenceHierarchyBrief,
} from "./healthPlanEvidenceHierarchy.js";

describe("health plan evidence hierarchy", () => {
  it("ranks fresh staff feedback and live alerts above background context", () => {
    const hierarchy = buildHealthPlanEvidenceHierarchy({
      sourceSignals: [
        { id: "context-live-profile", label: "Profile context", category: "context", strength: "medium" },
        { id: "alert-active", label: "2 active alerts", category: "alert", strength: "high" },
      ],
      feedbackEntries: [
        {
          section_key: "daily_support_json",
          outcome: "helped",
          note: "This worked yesterday.",
          recorded_at: "2026-06-20T08:00:00.000Z",
        },
      ],
      now: new Date("2026-06-21T08:00:00.000Z"),
    });

    expect(hierarchy[0]).toMatchObject({ source_type: "staff_feedback" });
    expect(hierarchy[1]).toMatchObject({ source_type: "live_alerts" });
  });

  it("flags conflicts when older success now disagrees with live caution", () => {
    const conflicts = buildHealthPlanEvidenceConflicts({
      sourceSignals: [
        { id: "risk-worsened", label: "Risk score has increased", category: "risk", strength: "high" },
      ],
      feedbackEntries: [
        {
          section_key: "monitoring_json",
          outcome: "helped",
          note: "This used to help.",
          recorded_at: "2026-06-20T08:00:00.000Z",
        },
      ],
      followThrough: {
        caution_signals: [
          { id: "risk-worsened", label: "Risk score has increased", detail: "The latest predictive score is higher than before." },
        ],
      },
    });

    expect(conflicts[0]).toMatchObject({
      conflict_type: "live_vs_past_success",
      source_signal_ids: ["risk-worsened"],
      preferred_signal_ids: ["risk-worsened"],
      requires_verification: true,
    });
  });

  it("describes how predictive risk should outrank calmer service context without discarding it entirely", () => {
    const conflicts = buildHealthPlanEvidenceConflicts({
      sourceSignals: [
        { id: "risk-latest-score", label: "Predictive risk score 84 (high)", category: "risk", strength: "high" },
        { id: "service-checkins", label: "Check-ins enabled", category: "service", strength: "medium" },
      ],
    });

    expect(conflicts.find((item) => item.id === "conflict:risk-vs-service")).toMatchObject({
      conflict_type: "predictive_vs_service_context",
      preferred_signal_ids: ["risk-latest-score"],
      preserve_signal_ids: ["service-checkins"],
      resolution_mode: "preserve_support_but_verify",
      requires_verification: true,
    });
  });

  it("builds a compact prompt-safe brief", () => {
    const brief = buildHealthPlanEvidenceHierarchyBrief([
      {
        id: "alert-active",
        label: "2 active alerts",
        section_key: "monitoring_json",
        authority_level: "high",
        source_type: "live_alerts",
        freshness_status: "fresh",
        priority_score: 100,
        reason: "Alerts reflect the current operational picture.",
      },
    ]);

    expect(brief[0]).toMatchObject({
      id: "alert-active",
      section_key: "monitoring_json",
      authority_level: "high",
      freshness_status: "fresh",
      priority_score: 100,
    });
  });

  it("keeps inferred operational feedback below explicit staff feedback", () => {
    const hierarchy = buildHealthPlanEvidenceHierarchy({
      feedbackEntries: [
        {
          section_key: "daily_support_json",
          outcome: "helped",
          note: "Observed successful check-in.",
          recorded_at: "2026-06-20T09:00:00.000Z",
          source: "inferred_operational",
        },
        {
          section_key: "monitoring_json",
          outcome: "needs_follow_up",
          note: "Staff confirmed this still needs active review.",
          recorded_at: "2026-06-20T08:30:00.000Z",
        },
      ],
      now: new Date("2026-06-20T10:00:00.000Z"),
    });

    expect(hierarchy[0]).toMatchObject({ source_type: "staff_feedback" });
    expect(hierarchy[1]).toMatchObject({ source_type: "observed_activity" });
  });
});
