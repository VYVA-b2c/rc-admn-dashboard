import { describe, expect, it } from "vitest";

import { buildHealthPlanCoverageRules, findHealthPlanCoverageIssues } from "./healthPlanCoverageRules";

describe("healthPlanCoverageRules", () => {
  const sourceSignals = [
    { id: "risk-latest-score", label: "Predictive risk score 82 (high)", category: "risk", strength: "high" },
    { id: "alert-active", label: "1 active alert", category: "alert", strength: "high" },
    { id: "medication-plan", label: "2 medications on file", detail: "Latest adherence missed", category: "medication", strength: "high" },
    { id: "service-checkins", label: "Check-ins", detail: "Enabled daily at 09:00", category: "service", strength: "medium" },
    { id: "sensor-status", label: "2 sensors linked", detail: "1 offline or not reporting", category: "sensor", strength: "high" },
    { id: "consent-family-sharing", label: "Family sharing consent not confirmed", detail: "Keep client-specific guidance narrow until the sharing boundary is confirmed.", category: "care-circle", strength: "high" },
    { id: "care-circle-context", label: "Care circle context", detail: "No care provider assignment recorded", category: "care-circle", strength: "high" },
  ];

  const triage = {
    action_signal_ids: ["risk-latest-score", "alert-active", "sensor-status"],
    verification_signal_ids: ["alert-active", "sensor-status", "consent-family-sharing"],
    stabilizing_signal_ids: ["service-checkins"],
  };

  it("derives section-aware coverage rules from live signals", () => {
    const rules = buildHealthPlanCoverageRules({
      sourceSignals,
      signalTriage: triage,
      criticalSignalIds: ["risk-latest-score", "alert-active"],
    });

    expect(rules.map((rule) => rule.id)).toEqual(expect.arrayContaining([
      "summary-action-coverage",
      "monitoring-verification-coverage",
      "medication-routine-coverage",
      "same-day-escalation-coverage",
      "sharing-boundary-coverage",
      "care-circle-gap-coverage",
    ]));
  });

  it("flags missing coverage when the plan ignores key domains", () => {
    const issues = findHealthPlanCoverageIssues({
      summary_signal_ids: ["risk-latest-score"],
      goals_json: [{ text: "Keep support consistent.", source_signal_ids: ["service-checkins"] }],
      daily_support_json: [{ text: "Continue the morning check-in.", source_signal_ids: ["service-checkins"] }],
      monitoring_json: [{ text: "Review risk score trends.", source_signal_ids: ["risk-latest-score"] }],
      escalation_json: [{ text: "Escalate if the client becomes unreachable.", source_signal_ids: ["alert-active"] }],
      caregiver_guidance_json: [{ text: "Share calm updates with the family.", source_signal_ids: ["care-circle-context"] }],
    }, {
      sourceSignals,
      signalTriage: triage,
      criticalSignalIds: ["risk-latest-score", "alert-active"],
    });

    expect(issues.map((issue) => issue.id)).toEqual(expect.arrayContaining([
      "monitoring-verification-coverage",
      "medication-routine-coverage",
      "sensor-monitoring-coverage",
      "sharing-boundary-coverage",
    ]));
  });

  it("can validate only the sections being refreshed", () => {
    const issues = findHealthPlanCoverageIssues({
      summary_signal_ids: ["risk-latest-score"],
      goals_json: [{ text: "Close the care-circle gap.", source_signal_ids: ["care-circle-context"] }],
      daily_support_json: [{ text: "Continue the morning check-in.", source_signal_ids: ["service-checkins"] }],
      monitoring_json: [{ text: "Track alerts, medication follow-through, and sensor visibility.", source_signal_ids: ["alert-active", "sensor-status", "medication-plan"] }],
      escalation_json: [{ text: "Escalate same-day if alerts remain unresolved.", source_signal_ids: ["alert-active", "risk-latest-score"] }],
      caregiver_guidance_json: [{ text: "Keep caregiver sharing narrow until consent is confirmed.", source_signal_ids: ["consent-family-sharing"] }],
    }, {
      sourceSignals,
      signalTriage: triage,
      criticalSignalIds: ["risk-latest-score", "alert-active"],
    }, {
      targetSections: ["summary", "monitoring_json", "caregiver_guidance_json"],
    });

    expect(issues).toEqual([]);
  });
});
