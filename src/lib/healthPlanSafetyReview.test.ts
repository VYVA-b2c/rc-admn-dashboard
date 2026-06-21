import { describe, expect, it } from "vitest";

import { findHealthPlanSafetyIssues } from "./healthPlanSafetyReview";

describe("healthPlanSafetyReview", () => {
  const sourceSignals = [
    { id: "risk-latest-score", label: "Predictive risk score 84 (high)", category: "risk", strength: "high" },
    { id: "alert-active", label: "1 active alert", detail: "Client could not be reached", category: "alert", strength: "high" },
    { id: "medication-plan", label: "2 medications on file", detail: "Latest adherence missed", category: "medication", strength: "high" },
    { id: "consent-family-sharing", label: "Family sharing consent not confirmed", detail: "Keep client-specific guidance narrow until the sharing boundary is confirmed.", category: "care-circle", strength: "high" },
  ];

  const signalTriage = {
    action_signal_ids: ["risk-latest-score", "alert-active", "medication-plan"],
    verification_signal_ids: ["alert-active", "medication-plan"],
  };

  it("flags contradictory reassurance in a hot summary", () => {
    const issues = findHealthPlanSafetyIssues({
      summary_text: "Carmen is fully stable with no immediate concerns.",
      summary_signal_ids: ["risk-latest-score", "alert-active"],
      goals_json: [],
      daily_support_json: [],
      monitoring_json: [],
      escalation_json: [],
      caregiver_guidance_json: [],
    }, {
      sourceSignals,
      signalTriage,
      criticalSignalIds: ["risk-latest-score", "alert-active"],
    });

    expect(issues[0]).toMatchObject({ section_key: "summary" });
  });

  it("flags weak escalation wording when same-day action is not explicit", () => {
    const issues = findHealthPlanSafetyIssues({
      summary_text: "Risk remains active this week.",
      summary_signal_ids: ["risk-latest-score"],
      goals_json: [],
      daily_support_json: [],
      monitoring_json: [],
      escalation_json: [
        { text: "Escalate if this continues.", source_signal_ids: ["alert-active"], timing: "this_week" },
      ],
      caregiver_guidance_json: [],
    }, {
      sourceSignals,
      signalTriage,
      criticalSignalIds: ["alert-active"],
    });

    expect(issues.map((issue) => issue.message)).toEqual(expect.arrayContaining([
      "Escalation guidance linked to high-risk signals should make the same-day timing explicit.",
    ]));
  });

  it("flags vague monitoring and oversharing caregiver wording", () => {
    const issues = findHealthPlanSafetyIssues({
      summary_text: "Daily routines need closer review.",
      summary_signal_ids: ["medication-plan"],
      goals_json: [],
      daily_support_json: [],
      monitoring_json: [
        { text: "Keep an eye on this as needed.", source_signal_ids: ["medication-plan"] },
      ],
      escalation_json: [],
      caregiver_guidance_json: [
        { text: "Share all details with the family.", source_signal_ids: ["consent-family-sharing"] },
      ],
    }, {
      sourceSignals,
      signalTriage,
      criticalSignalIds: ["medication-plan"],
    });

    expect(issues.map((issue) => issue.section_key)).toEqual(expect.arrayContaining([
      "monitoring_json",
      "caregiver_guidance_json",
    ]));
  });
});
