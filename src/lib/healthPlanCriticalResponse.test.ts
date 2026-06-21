import { describe, expect, it } from "vitest";

import {
  buildHealthPlanCriticalResponseBrief,
  findHealthPlanCriticalResponseIssues,
} from "./healthPlanCriticalResponse.js";

describe("healthPlanCriticalResponse", () => {
  const sourceSignals = [
    {
      id: "alert-active",
      label: "1 active alert",
      detail: "Morning dizziness alert still unresolved.",
      category: "alert",
      strength: "high",
    },
    {
      id: "medication-plan",
      label: "Medication adherence risk",
      detail: "Two doses were missed or remain unconfirmed this week.",
      category: "medication",
      strength: "high",
    },
    {
      id: "care-circle-context",
      label: "Care circle context",
      detail: "Family caregiver is available for daytime follow-up.",
      category: "care-circle",
      strength: "medium",
    },
  ];

  it("builds same-day critical response contracts from clinical cautions and must-address facts", () => {
    const brief = buildHealthPlanCriticalResponseBrief({
      sourceSignals,
      escalationGrade: { grade: "urgent" },
      careProviders: [{ id: "provider-1", display_name: "Maria Garcia" }],
      clinicalCautions: [
        {
          id: "reachability-risk",
          label: "Reachability risk needs an explicit response path",
          detail: "Repeated missed outreach means same-day contact recovery is required.",
          severity: "high",
          signal_ids: ["alert-active"],
          section_keys: ["summary", "monitoring_json", "escalation_json"],
          guidance: "Name how staff re-establish contact and what happens if contact still fails.",
        },
      ],
      evidencePack: {
        must_address_facts: [
          {
            signal_id: "medication-plan",
            label: "Medication adherence risk",
            detail: "Two doses were missed or remain unconfirmed this week.",
            priority: "high",
            response_window: "today",
            source_signal_ids: ["medication-plan"],
          },
        ],
      },
    });

    expect(brief?.overall_status).toBe("same_day");
    expect(brief?.same_day_count).toBeGreaterThanOrEqual(1);
    expect(brief?.contracts).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: "reachability-risk",
        response_window: "today",
        owner_role: "on_call_coordinator",
        fallback_owner_role: "on_call_coordinator",
        verification_required: true,
      }),
      expect.objectContaining({
        id: "fact:medication-plan",
        response_window: "today",
        verification_required: true,
      }),
    ]));
  });

  it("flags plans that blur same-day contracts into vague sections", () => {
    const brief = buildHealthPlanCriticalResponseBrief({
      sourceSignals,
      escalationGrade: { grade: "urgent" },
      careProviders: [{ id: "provider-1", display_name: "Maria Garcia" }],
      clinicalCautions: [
        {
          id: "reachability-risk",
          label: "Reachability risk needs an explicit response path",
          detail: "Repeated missed outreach means same-day contact recovery is required.",
          severity: "high",
          signal_ids: ["alert-active"],
          section_keys: ["summary", "monitoring_json", "escalation_json"],
          guidance: "Name how staff re-establish contact and what happens if contact still fails.",
        },
      ],
      evidencePack: {
        must_address_facts: [
          {
            signal_id: "medication-plan",
            label: "Medication adherence risk",
            detail: "Two doses were missed or remain unconfirmed this week.",
            priority: "high",
            response_window: "today",
            source_signal_ids: ["medication-plan"],
          },
        ],
      },
    });

    const issues = findHealthPlanCriticalResponseIssues({
      summary_text: "Keep routines steady while the week unfolds.",
      summary_signal_ids: ["care-circle-context"],
      goals_json: [
        { text: "Support a calm weekly routine.", source_signal_ids: ["care-circle-context"] },
      ],
      daily_support_json: [
        { text: "Keep the existing medication routine where possible.", source_signal_ids: ["medication-plan"] },
      ],
      monitoring_json: [
        { text: "Observe general wellbeing.", source_signal_ids: ["alert-active"] },
      ],
      escalation_json: [
        { text: "Escalate if needed.", source_signal_ids: ["alert-active"] },
      ],
      caregiver_guidance_json: [
        { text: "Share updates with the caregiver.", source_signal_ids: ["care-circle-context"] },
      ],
    }, brief);

    expect(issues.map((item) => item.type)).toEqual(expect.arrayContaining([
      "response_contract_summary_missing",
      "response_contract_timing_missing",
      "response_contract_verification_missing",
      "response_contract_owner_missing",
      "response_contract_fallback_missing",
      "response_contract_close_loop_missing",
      "response_contract_section_missing",
    ]));
  });

  it("accepts plans that keep critical contracts explicit and closed-loop", () => {
    const brief = buildHealthPlanCriticalResponseBrief({
      sourceSignals,
      escalationGrade: { grade: "urgent" },
      careProviders: [{ id: "provider-1", display_name: "Maria Garcia" }],
      clinicalCautions: [
        {
          id: "reachability-risk",
          label: "Reachability risk needs an explicit response path",
          detail: "Repeated missed outreach means same-day contact recovery is required.",
          severity: "high",
          signal_ids: ["alert-active"],
          section_keys: ["summary", "monitoring_json", "escalation_json"],
          guidance: "Name how staff re-establish contact and what happens if contact still fails.",
        },
      ],
      evidencePack: {
        must_address_facts: [
          {
            signal_id: "medication-plan",
            label: "Medication adherence risk",
            detail: "Two doses were missed or remain unconfirmed this week.",
            priority: "high",
            response_window: "today",
            source_signal_ids: ["medication-plan"],
          },
        ],
      },
    });

    const issues = findHealthPlanCriticalResponseIssues({
      summary_text: "A same-day response is needed because the unresolved alert and medication instability both need confirmation today.",
      summary_signal_ids: ["alert-active", "medication-plan"],
      goals_json: [
        { text: "Keep the client safe and reachable today.", source_signal_ids: ["alert-active"] },
      ],
      daily_support_json: [
        {
          text: "Confirm the current medication schedule today and document what doses were verified.",
          source_signal_ids: ["medication-plan"],
          timing: "today",
          priority: "high",
          verification_required: true,
          owner_role: "assigned_staff",
          fallback_owner_role: "on_call_coordinator",
          completion_signal: "Close the loop by documenting whether doses were confirmed today and whether escalation was triggered.",
        },
      ],
      monitoring_json: [
        {
          text: "Today, confirm whether contact was re-established after the alert and document what remains uncertain.",
          source_signal_ids: ["alert-active"],
          timing: "today",
          priority: "high",
          verification_required: true,
          owner_role: "assigned_staff",
          fallback_owner_role: "on_call_coordinator",
          completion_signal: "Close the loop by recording whether contact was re-established and what the next follow-up step is.",
        },
      ],
      escalation_json: [
        {
          text: "Escalate the same day to the on-call coordinator if contact still fails or the alert risk remains unresolved after verification.",
          source_signal_ids: ["alert-active", "medication-plan"],
          timing: "today",
          priority: "high",
          verification_required: true,
          owner_role: "on_call_coordinator",
          fallback_owner_role: "on_call_coordinator",
          completion_signal: "Close the loop once the responder confirms the outcome and the fallback path is either activated or ruled out.",
        },
      ],
      caregiver_guidance_json: [
        {
          text: "Ask the caregiver to report back today if they notice dizziness, missed doses, or failed contact attempts.",
          source_signal_ids: ["care-circle-context", "alert-active"],
          timing: "today",
          priority: "medium",
          verification_required: true,
          owner_role: "caregiver",
          fallback_owner_role: "care_team",
          completion_signal: "Close the loop once the caregiver reports back and staff log the next step.",
        },
      ],
    }, brief);

    expect(issues).toEqual([]);
  });
});
