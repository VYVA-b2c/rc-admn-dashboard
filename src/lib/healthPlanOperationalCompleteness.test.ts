import { describe, expect, it } from "vitest";

import {
  buildHealthPlanOperationalCompleteness,
  shouldRejectHealthPlanOperationalCompleteness,
} from "./healthPlanOperationalCompleteness.js";

describe("healthPlanOperationalCompleteness", () => {
  function hasIssue(summary, sectionKey, type) {
    return (summary?.section_checks || [])
      .flatMap((section) => section?.issues || [])
      .some((item) => item.type === type && item.section_key === sectionKey);
  }

  it("flags plans that lack owner, fallback, timing, and trigger clarity under same-day pressure", () => {
    const summary = buildHealthPlanOperationalCompleteness({
      plan: {
        monitoring_json: [
          { text: "Keep an eye on the situation.", priority: "high", timing: "ongoing", source_signal_ids: ["alert-active"] },
        ],
        escalation_json: [
          { text: "Escalate if needed.", priority: "high", timing: "ongoing", source_signal_ids: ["alert-active"] },
        ],
        caregiver_guidance_json: [
          { text: "Share updates with the family.", priority: "medium", timing: "this_week", source_signal_ids: ["care-circle-context"] },
        ],
        goals_json: [],
        daily_support_json: [],
      },
      reviewPriorities: {
        items: [
          { section_key: "monitoring_json", priority: "high", response_window: "today" },
          { section_key: "escalation_json", priority: "high", response_window: "today" },
        ],
      },
      escalationGrade: {
        grade: "urgent",
      },
      liveEvidenceSummary: {
        contact_pressure: { status: "pressure" },
        medication_adherence: { status: "watch" },
      },
    });

    expect(summary).toMatchObject({
      overall_status: "fragile",
    });
    expect(hasIssue(summary, "monitoring_json", "timing_missing")).toBe(true);
    expect(hasIssue(summary, "monitoring_json", "close_loop_missing")).toBe(true);
    expect(hasIssue(summary, "escalation_json", "owner_missing")).toBe(true);
    expect(hasIssue(summary, "escalation_json", "fallback_missing")).toBe(true);
    expect(hasIssue(summary, "caregiver_guidance_json", "report_back_missing")).toBe(true);
    expect(shouldRejectHealthPlanOperationalCompleteness(summary)).toBe(true);
  });

  it("passes plans that are operationally explicit", () => {
    const summary = buildHealthPlanOperationalCompleteness({
      plan: {
        monitoring_json: [
          {
            text: "Today, confirm whether the active alert reflects a true no-response pattern and re-check medication confirmation.",
            priority: "high",
            timing: "today",
            verification_required: true,
            completion_signal: "Record what was confirmed and whether the same-day risk picture changed.",
            source_signal_ids: ["alert-active", "medication-plan"],
          },
        ],
        escalation_json: [
          {
            text: "If contact still fails today, the assigned Red Cross operator should call the on-call coordinator and use the caregiver as the backup contact.",
            priority: "high",
            timing: "today",
            verification_required: true,
            completion_signal: "Close the loop once the operator or fallback responder is reached and the outcome is logged.",
            source_signal_ids: ["alert-active"],
          },
        ],
        caregiver_guidance_json: [
          { text: "Ask the caregiver to confirm whether the client answered this morning and report back to the team today if concerns remain.", priority: "medium", timing: "today", completion_signal: "Log the caregiver update and next staff step before the end of the day.", source_signal_ids: ["care-circle-context"] },
        ],
        daily_support_json: [
          { text: "Keep the morning check-in active and confirm hydration during the call today.", priority: "high", timing: "today", source_signal_ids: ["service-checkins"] },
        ],
        goals_json: [
          { text: "Keep the client reachable and safe at home this week.", priority: "high", timing: "this_week", source_signal_ids: ["risk-latest-score"] },
        ],
      },
      reviewPriorities: {
        items: [
          { section_key: "monitoring_json", priority: "high", response_window: "today" },
          { section_key: "escalation_json", priority: "high", response_window: "today" },
        ],
      },
      escalationGrade: {
        grade: "urgent",
      },
      liveEvidenceSummary: {
        contact_pressure: { status: "pressure" },
        medication_adherence: { status: "watch" },
      },
    });

    expect(summary).toMatchObject({
      overall_status: "strong",
      issue_count: 0,
    });
    expect(shouldRejectHealthPlanOperationalCompleteness(summary)).toBe(false);
  });

  it("accepts structured verification and fallback metadata as part of the operational contract", () => {
    const summary = buildHealthPlanOperationalCompleteness({
      plan: {
        monitoring_json: [
          {
            text: "Confirm whether the active alert reflects a true no-response pattern.",
            priority: "high",
            timing: "today",
            verification_required: true,
            completion_signal: "Record what was confirmed and whether the alert stays active after the re-check.",
            source_signal_ids: ["alert-active"],
          },
        ],
        escalation_json: [
          {
            text: "If contact still fails today, escalate the case immediately.",
            priority: "high",
            timing: "today",
            verification_required: true,
            completion_signal: "Close the loop once the same-day escalation owner is reached or the fallback path is activated.",
            owner_role: "on_call_coordinator",
            fallback_owner_role: "on_call_coordinator",
            source_signal_ids: ["alert-active"],
          },
        ],
        caregiver_guidance_json: [
          {
            text: "Ask the caregiver to report back today if concerns remain.",
            priority: "medium",
            timing: "today",
            verification_required: true,
            completion_signal: "Log what the caregiver observed and whether staff need an immediate follow-up.",
            owner_role: "caregiver",
            source_signal_ids: ["care-circle-context"],
          },
        ],
        daily_support_json: [],
        goals_json: [],
      },
      reviewPriorities: {
        items: [
          { section_key: "monitoring_json", priority: "high", response_window: "today" },
          { section_key: "escalation_json", priority: "high", response_window: "today" },
        ],
      },
      escalationGrade: {
        grade: "urgent",
      },
      liveEvidenceSummary: {
        contact_pressure: { status: "pressure" },
        medication_adherence: { status: "watch" },
      },
    });

    expect(summary?.issues.some((item) => item.type === "owner_missing")).toBe(false);
    expect(summary?.issues.some((item) => item.type === "verification_contract_missing")).toBe(false);
    expect(summary?.issues.some((item) => item.type === "fallback_missing")).toBe(false);
    expect(summary?.issues.some((item) => item.type === "close_loop_missing")).toBe(false);
  });
});
