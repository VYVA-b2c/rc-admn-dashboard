import { describe, expect, it } from "vitest";

import {
  findHealthPlanGenerationBriefIssues,
  shouldRejectHealthPlanGenerationBriefIssues,
} from "./healthPlanGenerationBriefCompliance.js";

describe("healthPlanGenerationBriefCompliance", () => {
  it("accepts plans that honor the act-now, verify, and preserve instructions from the brief", () => {
    const issues = findHealthPlanGenerationBriefIssues({
      summary_text: "An active safety alert and medication uncertainty require same-day follow-up and confirmation.",
      summary_signal_ids: ["alert-active"],
      daily_support_json: [
        {
          text: "Keep the morning medication routine in place and ask the caregiver to confirm whether it still lands before noon.",
          source_signal_ids: ["care-circle-context"],
        },
      ],
      monitoring_json: [
        {
          text: "Verify the active safety alert today and confirm whether the medication issue reflects a real missed-dose pattern.",
          source_signal_ids: ["alert-active", "medication-plan"],
          verification_required: true,
          timing: "today",
          priority: "high",
        },
      ],
      escalation_json: [
        {
          text: "If the alert remains unresolved today, escalate to the on-call coordinator and trigger the backup contact route.",
          source_signal_ids: ["alert-active"],
          verification_required: true,
          timing: "today",
          priority: "high",
        },
      ],
      caregiver_guidance_json: [],
      goals_json: [],
    }, {
      same_day_response_required: true,
      evidence_decision_map: {
        trust_now: [{ id: "feedback:monitoring_json", label: "Fresh monitoring feedback" }],
        verify_before_reuse: [{ id: "medication-plan", label: "Medication adherence issue" }],
        support_only: [{ id: "care-circle-context", label: "Care circle context" }],
        stale_watchouts: [{ id: "feedback:daily_support_json", label: "Older daily support feedback" }],
      },
      priority_signals: [
        { signal_id: "alert-active", focus: "act_now" },
        { signal_id: "medication-plan", focus: "verify" },
      ],
      section_briefs: [
        {
          section_key: "monitoring_json",
          section_label: "Monitoring",
          priority: "high",
          response_window: "today",
          must_address_signal_ids: ["alert-active"],
          verify_signal_ids: ["medication-plan"],
          decision_lead_evidence_ids: ["feedback:monitoring_json"],
          verification_evidence_ids: ["medication-plan"],
          supporting_evidence_ids: [],
          stale_evidence_ids: [],
          evidence_strategy: "Lead with the freshest high-authority evidence, keep the medium-authority signals verification-led, and do not let supporting context smooth over the pressure.",
          preserve_signal_ids: [],
          rewrite_recommendations: [],
          preserve_recommendations: [],
          guardrails: [{ label: "Stay verification-led." }],
        },
        {
          section_key: "daily_support_json",
          section_label: "Daily support",
          priority: "medium",
          response_window: "this_week",
          must_address_signal_ids: [],
          verify_signal_ids: [],
          decision_lead_evidence_ids: [],
          verification_evidence_ids: [],
          supporting_evidence_ids: ["care-circle-context"],
          stale_evidence_ids: ["feedback:daily_support_json"],
          evidence_strategy: "Lead with the fresher evidence and treat older or aging proof as background context unless staff re-confirm it.",
          preserve_signal_ids: ["care-circle-context"],
          rewrite_recommendations: [],
          preserve_recommendations: [
            {
              label: "Keep the morning medication routine.",
              preserve_strength: "must_preserve",
              source_signal_ids: ["care-circle-context"],
            },
          ],
          guardrails: [],
        },
      ],
    });

    expect(issues).toEqual([]);
    expect(shouldRejectHealthPlanGenerationBriefIssues(issues)).toBe(false);
  });

  it("rejects plans that ignore high-priority section signals and keep rewrite items unchanged", () => {
    const issues = findHealthPlanGenerationBriefIssues({
      summary_text: "Continue support and monitor wellbeing.",
      summary_signal_ids: ["care-circle-context"],
      monitoring_json: [
        {
          text: "Keep monitoring the situation.",
          source_signal_ids: ["care-circle-context"],
          timing: "ongoing",
          priority: "low",
        },
      ],
      daily_support_json: [],
      escalation_json: [],
      caregiver_guidance_json: [],
      goals_json: [],
    }, {
      same_day_response_required: true,
      evidence_decision_map: {
        trust_now: [{ id: "feedback:monitoring_json", label: "Fresh monitoring feedback" }],
        verify_before_reuse: [{ id: "medication-plan", label: "Medication adherence issue" }],
        support_only: [],
        stale_watchouts: [{ id: "feedback:monitoring_json:stale", label: "Older monitoring feedback" }],
      },
      priority_signals: [
        { signal_id: "alert-active", focus: "act_now" },
      ],
      section_briefs: [
        {
          section_key: "monitoring_json",
          section_label: "Monitoring",
          priority: "high",
          response_window: "today",
          must_address_signal_ids: ["alert-active"],
          verify_signal_ids: ["medication-plan"],
          decision_lead_evidence_ids: ["feedback:monitoring_json"],
          verification_evidence_ids: ["medication-plan"],
          supporting_evidence_ids: [],
          stale_evidence_ids: ["feedback:monitoring_json:stale"],
          evidence_strategy: "Lead with the freshest high-authority evidence, keep the medium-authority signals verification-led, and do not let supporting context smooth over the pressure.",
          preserve_signal_ids: [],
          rewrite_recommendations: [
            {
              label: "Keep monitoring the situation.",
              action: "rework",
              repair_strength: "must_rewrite",
            },
          ],
          preserve_recommendations: [],
          guardrails: [{ label: "Stay verification-led." }],
        },
      ],
    });

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "summary_missed_priority_signal", severity: "high" }),
        expect.objectContaining({ type: "section_missed_priority_signal", section_key: "monitoring_json", severity: "high" }),
        expect.objectContaining({ type: "section_missed_verification_signal", section_key: "monitoring_json", severity: "high" }),
        expect.objectContaining({ type: "section_missed_verification_evidence", section_key: "monitoring_json", severity: "high" }),
        expect.objectContaining({ type: "section_stale_evidence_underplayed", section_key: "monitoring_json", severity: "high" }),
        expect.objectContaining({ type: "section_lead_evidence_underplayed", section_key: "monitoring_json", severity: "high" }),
        expect.objectContaining({ type: "rewrite_recommendation_returned_unchanged", section_key: "monitoring_json" }),
      ]),
    );
    expect(shouldRejectHealthPlanGenerationBriefIssues(issues)).toBe(true);
  });

  it("treats dropping a strongly proven routine as a high-severity brief violation", () => {
    const issues = findHealthPlanGenerationBriefIssues({
      summary_text: "Review the day and watch for changes.",
      summary_signal_ids: [],
      daily_support_json: [
        {
          text: "Offer a general wellness prompt later in the week.",
          source_signal_ids: ["other-service-signal"],
        },
      ],
      monitoring_json: [],
      escalation_json: [],
      caregiver_guidance_json: [],
      goals_json: [],
    }, {
      same_day_response_required: false,
      priority_signals: [],
      section_briefs: [
        {
          section_key: "daily_support_json",
          section_label: "Daily support",
          priority: "medium",
          response_window: "this_week",
          must_address_signal_ids: [],
          verify_signal_ids: [],
          decision_lead_evidence_ids: [],
          verification_evidence_ids: [],
          supporting_evidence_ids: [],
          stale_evidence_ids: [],
          evidence_strategy: null,
          preserve_signal_ids: ["service-checkins"],
          rewrite_recommendations: [],
          preserve_recommendations: [
            {
              label: "Keep the morning check-in routine.",
              preserve_strength: "must_preserve",
              source_signal_ids: ["service-checkins"],
            },
          ],
          guardrails: [],
        },
      ],
    });

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "preserve_recommendation_dropped",
          section_key: "daily_support_json",
          severity: "high",
        }),
      ]),
    );
    expect(shouldRejectHealthPlanGenerationBriefIssues(issues)).toBe(true);
  });
});
