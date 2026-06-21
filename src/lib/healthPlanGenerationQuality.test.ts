import { describe, expect, it } from "vitest";

import {
  buildHealthPlanGenerationQuality,
  findHealthPlanGenerationQualityIssues,
  shouldRejectHealthPlanGenerationQuality,
} from "./healthPlanGenerationQuality.js";

describe("healthPlanGenerationQuality", () => {
  it("flags urgent high-priority sections that stay too soft or miss same-day timing", () => {
    const plan = {
      generator_provider: "openai",
      generator_version: "health-plan-v1",
      monitoring_json: [
        { text: "Keep an eye on changes and note anything unusual.", priority: "low", timing: "ongoing", source_signal_ids: ["alert-active"] },
      ],
      escalation_json: [
        { text: "Escalate if needed.", priority: "low", timing: "ongoing", source_signal_ids: ["alert-active"] },
      ],
      goals_json: [{ text: "Stay well.", priority: "medium", timing: "this_week", source_signal_ids: ["risk-latest-score"] }],
      daily_support_json: [{ text: "Keep routines stable.", priority: "medium", timing: "ongoing", source_signal_ids: ["service-checkins"] }],
      caregiver_guidance_json: [{ text: "Share updates with caregivers.", priority: "medium", timing: "this_week", source_signal_ids: ["care-circle-context"] }],
    };

    const quality = buildHealthPlanGenerationQuality({
      plan,
      reviewPriorities: {
        items: [
          { section_key: "monitoring_json", priority: "high", response_window: "today" },
          { section_key: "escalation_json", priority: "high", response_window: "today" },
        ],
      },
      confidenceProfile: {
        section_confidence: [{ section_key: "monitoring_json", max_confidence: "low" }],
      },
    });

    expect(findHealthPlanGenerationQualityIssues(plan, {
      reviewPriorities: {
        items: [{ section_key: "monitoring_json", priority: "high", response_window: "today" }],
      },
      confidenceProfile: {
        section_confidence: [{ section_key: "monitoring_json", max_confidence: "low" }],
      },
    }).length).toBeGreaterThan(0);
    expect(quality?.overall_status).toBe("fragile");
    expect(shouldRejectHealthPlanGenerationQuality(quality)).toBe(true);
    const issues = findHealthPlanGenerationQualityIssues(plan, {
      reviewPriorities: {
        items: [
          { section_key: "monitoring_json", priority: "high", response_window: "today" },
          { section_key: "escalation_json", priority: "high", response_window: "today" },
        ],
      },
      confidenceProfile: {
        section_confidence: [{ section_key: "monitoring_json", max_confidence: "low" }],
      },
    });
    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "review_priority_verification_contract_missing", section_key: "monitoring_json" }),
        expect.objectContaining({ type: "review_priority_completion_signal_missing", section_key: "monitoring_json" }),
        expect.objectContaining({ type: "review_priority_owner_role_missing", section_key: "escalation_json" }),
        expect.objectContaining({ type: "review_priority_fallback_owner_missing", section_key: "escalation_json" }),
      ]),
    );
  });

  it("records repaired drafts as guarded even after they clear the harder floor", () => {
    const quality = buildHealthPlanGenerationQuality({
      plan: {
        generator_provider: "openai",
        generator_version: "health-plan-v1-repair",
        goals_json: [{ text: "Keep the client reachable this week.", priority: "medium", timing: "this_week", source_signal_ids: ["risk-latest-score"] }],
        daily_support_json: [{ text: "Confirm the medication routine and keep the morning support call in place.", priority: "medium", timing: "today", source_signal_ids: ["medication-plan"] }],
        monitoring_json: [{
          text: "Confirm same-day contact, re-check alerts, and monitor missed doses.",
          priority: "high",
          timing: "today",
          verification_required: true,
          completion_signal: "Record what was confirmed and whether the same-day risk picture changed.",
          owner_role: "assigned_staff",
          source_signal_ids: ["alert-active"],
        }],
        escalation_json: [{
          text: "Call the assigned responder the same day if contact still fails.",
          priority: "high",
          timing: "today",
          verification_required: true,
          completion_signal: "Close the loop once the responder is reached or the fallback path is activated.",
          owner_role: "assigned_staff",
          fallback_owner_role: "on_call_coordinator",
          source_signal_ids: ["alert-active"],
        }],
        caregiver_guidance_json: [{
          text: "Ask the caregiver to confirm changes and report concerns today.",
          priority: "medium",
          timing: "today",
          verification_required: true,
          completion_signal: "Document what the caregiver reports back and the next staff step.",
          owner_role: "caregiver",
          source_signal_ids: ["care-circle-context"],
        }],
      },
      reviewPriorities: {
        items: [{ section_key: "monitoring_json", priority: "high", response_window: "today" }],
      },
      confidenceProfile: {
        section_confidence: [],
      },
    });

    expect(quality).toMatchObject({
      generation_path: "repair",
      overall_status: "guarded",
    });
    expect(shouldRejectHealthPlanGenerationQuality(quality)).toBe(false);
  });

  it("clears urgent execution metadata requirements when the draft includes explicit owner, verification, fallback, and completion fields", () => {
    const quality = buildHealthPlanGenerationQuality({
      plan: {
        generator_provider: "openai",
        generator_version: "health-plan-v2",
        goals_json: [{ text: "Keep the client reachable this week.", priority: "medium", timing: "this_week", source_signal_ids: ["risk-latest-score"] }],
        daily_support_json: [{ text: "Keep the routine support call active.", priority: "medium", timing: "today", source_signal_ids: ["service-checkins"] }],
        monitoring_json: [{
          text: "Today, verify whether the alert reflects a true no-response pattern.",
          priority: "high",
          timing: "today",
          verification_required: true,
          completion_signal: "Record what was confirmed and whether the alert remains active.",
          owner_role: "assigned_staff",
          source_signal_ids: ["alert-active"],
        }],
        escalation_json: [{
          text: "If contact still fails today, escalate immediately to the coordination path.",
          priority: "high",
          timing: "today",
          verification_required: true,
          completion_signal: "Close the loop once the same-day escalation owner or fallback responder is reached.",
          owner_role: "assigned_staff",
          fallback_owner_role: "on_call_coordinator",
          source_signal_ids: ["alert-active"],
        }],
        caregiver_guidance_json: [{
          text: "Ask the caregiver to attempt contact today and report back if the client remains unreachable.",
          priority: "medium",
          timing: "today",
          verification_required: true,
          completion_signal: "Log the caregiver report-back and the next staff action before end of day.",
          owner_role: "caregiver",
          source_signal_ids: ["care-circle-context"],
        }],
      },
      reviewPriorities: {
        items: [
          { section_key: "monitoring_json", priority: "high", response_window: "today" },
          { section_key: "escalation_json", priority: "high", response_window: "today" },
          { section_key: "caregiver_guidance_json", priority: "high", response_window: "today" },
        ],
      },
      confidenceProfile: {
        section_confidence: [],
      },
    });

    expect(quality?.issues.some((item) => item.type === "review_priority_verification_contract_missing")).toBe(false);
    expect(quality?.issues.some((item) => item.type === "review_priority_completion_signal_missing")).toBe(false);
    expect(quality?.issues.some((item) => item.type === "review_priority_owner_role_missing")).toBe(false);
    expect(quality?.issues.some((item) => item.type === "review_priority_fallback_owner_missing")).toBe(false);
  });
});
