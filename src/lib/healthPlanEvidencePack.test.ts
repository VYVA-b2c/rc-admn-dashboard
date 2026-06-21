import { describe, expect, it } from "vitest";

import { buildHealthPlanEvidencePack } from "./healthPlanEvidencePack.js";

describe("healthPlanEvidencePack", () => {
  it("builds a ranked pre-generation evidence brief from live signals, conflicts, and quality memory", () => {
    const pack = buildHealthPlanEvidencePack({
      sourceSignals: [
        { id: "alert-active", label: "1 active alert", detail: "No successful same-day contact yet", category: "alert", strength: "high" },
        { id: "risk-latest-score", label: "Predictive risk score 84 (high)", detail: "Up 9 from prior", category: "risk", strength: "high" },
        { id: "service-checkins", label: "Check-ins enabled", detail: "Last outcome missed", category: "service", strength: "high" },
        { id: "care-circle-context", label: "Care circle context", detail: "No care provider assignment recorded", category: "care-circle", strength: "high" },
      ],
      signalTriage: {
        action_signal_ids: ["alert-active", "risk-latest-score"],
        verification_signal_ids: ["alert-active", "care-circle-context"],
        stabilizing_signal_ids: ["service-checkins"],
      },
      criticalSignalIds: ["alert-active", "risk-latest-score"],
      evidenceHierarchy: [
        { id: "alert-active", reason: "Active alerts reflect the current operational picture." },
        { id: "risk-latest-score", reason: "Elevated predictive risk still matters, but it should be checked against live evidence." },
        { id: "service-checkins", reason: "Saved service state can stabilize the plan when it is still landing reliably." },
      ],
      evidenceConflicts: [
        {
          id: "conflict:risk-vs-service",
          section_key: "monitoring_json",
          severity: "medium",
          summary: "Predictive risk and apparently stable routines may be pulling in different directions.",
          detail: "Do not let a saved routine create false reassurance if predictive risk is still elevated.",
        },
      ],
      escalationGrade: {
        grade: "urgent",
        response_window: "today",
        required_signal_ids: ["alert-active", "risk-latest-score"],
        same_day_signal_ids: ["alert-active"],
      },
      dataQualityGaps: [
        {
          id: "gap-1",
          label: "Care coverage is unclear",
          detail: "No assigned responder is visible in the current record.",
          severity: "high",
        },
      ],
      followThrough: {
        status: "needs_review",
      },
      qualityMemory: {
        current_guardrails: [
          {
            section_key: "monitoring_json",
            max_confidence: "low",
            reasons: ["Contact reliability still needs confirmation"],
          },
        ],
        durable_patterns: [
          {
            section_key: "daily_support_json",
            text: "Keep the morning check-in routine.",
            reason: "This routine has stayed useful across revisions.",
          },
        ],
        fragile_patterns: [
          {
            section_key: "monitoring_json",
            text: "Assume weekly monitoring is enough.",
            reason: "This became too weak when missed contact increased.",
          },
        ],
        recurring_quality_risks: [
          {
            label: "Contact reliability still needs confirmation",
            count: 3,
            highest_severity: "high",
            section_keys: ["monitoring_json"],
          },
        ],
      },
    });

    expect(pack.same_day_response_required).toBe(true);
    expect(pack.must_address_facts.map((item) => item.signal_id)).toEqual(
      expect.arrayContaining(["alert-active", "risk-latest-score"]),
    );
    expect(pack.verification_needs.some((item) => /care coverage is unclear/i.test(item.label))).toBe(true);
    expect(pack.stabilizing_facts.some((item) => /morning check-in routine/i.test(item.label))).toBe(true);
    expect(pack.contradictions[0]).toMatchObject({
      section_key: "monitoring_json",
      severity: "medium",
    });
    expect(pack.fragile_pattern_warnings[0]?.text).toMatch(/weekly monitoring/i);
  });
});
