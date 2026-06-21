import { describe, expect, it } from "vitest";

import { findHealthPlanEvidenceCoverageIssues } from "./healthPlanEvidenceCoverage.js";

describe("healthPlanEvidenceCoverage", () => {
  it("flags drafts that miss must-address facts, dodge verification needs, and repeat fragile patterns", () => {
    const issues = findHealthPlanEvidenceCoverageIssues(
      {
        summary_text: "Keep routines steady and monitor during the week.",
        summary_signal_ids: ["service-checkins"],
        goals_json: [
          { text: "Preserve a steady morning routine.", source_signal_ids: ["service-checkins"] },
        ],
        daily_support_json: [
          { text: "Keep the morning check-in routine.", source_signal_ids: ["service-checkins"] },
        ],
        monitoring_json: [
          { text: "Observe general wellbeing.", source_signal_ids: ["service-checkins"] },
        ],
        escalation_json: [
          { text: "Escalate if things worsen.", source_signal_ids: ["service-checkins"] },
        ],
        caregiver_guidance_json: [
          { text: "Share updates with the caregiver.", source_signal_ids: ["care-circle-context"] },
        ],
      },
      {
        same_day_response_required: true,
        must_address_facts: [
          { signal_id: "alert-active", label: "1 active alert" },
          { signal_id: "risk-latest-score", label: "Predictive risk score 84 (high)" },
        ],
        verification_needs: [
          { label: "monitoring_json confidence is capped at low", source_signal_ids: [] },
          { label: "Care coverage is unclear", source_signal_ids: [] },
        ],
        contradictions: [
          {
            section_key: "monitoring_json",
            summary: "Predictive risk and routines are pulling in different directions.",
            preferred_signal_ids: ["risk-latest-score"],
            requires_verification: true,
            response_window: "today",
          },
        ],
        fragile_pattern_warnings: [
          { section_key: "daily_support_json", text: "Keep the morning check-in routine." },
        ],
      },
    );

    expect(issues.map((item) => item.type)).toEqual(expect.arrayContaining([
      "must_address_fact_missing",
      "same_day_response_missing",
      "same_day_escalation_missing",
      "verification_need_not_carried",
      "contradiction_priority_signal_missing",
      "contradiction_timing_missing",
      "fragile_pattern_returned",
    ]));
  });

  it("accepts drafts that carry the evidence pack clearly", () => {
    const issues = findHealthPlanEvidenceCoverageIssues(
      {
        summary_text: "A same-day check is needed today because an active alert and elevated risk still require confirmation.",
        summary_signal_ids: ["alert-active", "risk-latest-score"],
        goals_json: [
          { text: "Keep the helpful morning hydration routine in place.", source_signal_ids: ["service-checkins"] },
        ],
        daily_support_json: [
          { text: "Preserve the morning hydration routine while staff confirm the next contact window.", source_signal_ids: ["service-checkins", "care-circle-context"] },
        ],
        monitoring_json: [
          { text: "Today, confirm contact reliability and re-check the active alert before relying on the routine alone.", source_signal_ids: ["alert-active", "risk-latest-score"] },
        ],
        escalation_json: [
          { text: "Escalate the same day if contact still cannot be confirmed after the alert re-check.", source_signal_ids: ["alert-active"] },
        ],
        caregiver_guidance_json: [
          { text: "Ask the caregiver to confirm who can respond today if contact remains uncertain.", source_signal_ids: ["care-circle-context"] },
        ],
      },
      {
        same_day_response_required: true,
        must_address_facts: [
          { signal_id: "alert-active", label: "1 active alert" },
          { signal_id: "risk-latest-score", label: "Predictive risk score 84 (high)" },
        ],
        verification_needs: [
          { label: "monitoring_json confidence is capped at low", source_signal_ids: [] },
          { label: "Care coverage is unclear", source_signal_ids: [] },
        ],
        contradictions: [
          {
            section_key: "monitoring_json",
            summary: "Predictive risk and routines are pulling in different directions.",
            preferred_signal_ids: ["risk-latest-score"],
            requires_verification: true,
            response_window: "today",
          },
        ],
        fragile_pattern_warnings: [
          { section_key: "daily_support_json", text: "Assume weekly monitoring is enough." },
        ],
      },
    );

    expect(issues).toEqual([]);
  });
});
