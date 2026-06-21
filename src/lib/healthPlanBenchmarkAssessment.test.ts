import { describe, expect, it } from "vitest";

import {
  buildHealthPlanBenchmarkAssessment,
  buildHealthPlanBenchmarkGuidance,
  shouldRejectHealthPlanBenchmarkAssessment,
} from "./healthPlanBenchmarkAssessment.js";

describe("health plan benchmark assessment", () => {
  it("matches a live urgent-risk plan to relevant benchmark archetypes", () => {
    const summary = buildHealthPlanBenchmarkAssessment({
      plan: {
        summary_text: "An active fall alert and repeated missed check-ins require same-day verification and a fallback outreach owner.",
        summary_signal_ids: ["alert-active", "service-checkins"],
        goals_json: [{ text: "Keep caregiver backup engaged so same-day outreach does not depend on one failed call.", source_signal_ids: ["care-circle-context"] }],
        daily_support_json: [{ text: "Preserve caregiver backup and log who can attempt the next same-day contact if the first outreach fails.", source_signal_ids: ["care-circle-context"] }],
        monitoring_json: [{ text: "Verify the fall alert status today and confirm whether the missed check-ins reflect a real no-response pattern.", timing: "today", priority: "high", source_signal_ids: ["alert-active", "service-checkins"] }],
        escalation_json: [{ text: "Escalate today to the on-call coordinator and use the fallback outreach owner if contact still fails.", timing: "today", priority: "high", source_signal_ids: ["alert-active"] }],
        caregiver_guidance_json: [{ text: "Ask the caregiver to confirm whether they can attempt contact today and report back if the client remains unreachable.", timing: "today", priority: "medium", source_signal_ids: ["care-circle-context"] }],
      },
      sourceSignals: [
        { id: "alert-active", label: "Active fall alert", category: "alert", strength: "high" },
        { id: "service-checkins", label: "Missed check-ins", category: "service", strength: "high" },
        { id: "care-circle-context", label: "Caregiver backup", category: "care-circle", strength: "medium" },
      ],
      evidencePack: {
        same_day_response_required: true,
        must_address_facts: [
          { label: "Active fall alert", response_window: "today", priority: "high", source_signal_ids: ["alert-active"] },
          { label: "Repeated missed check-ins today", response_window: "today", priority: "high", source_signal_ids: ["service-checkins"] },
        ],
        verification_needs: [
          { label: "Confirm whether the client is reachable right now", severity: "high", source_signal_ids: ["service-checkins"] },
        ],
        stabilizing_facts: [
          { label: "Caregiver backup can still help if engaged clearly", source_signal_ids: ["care-circle-context"] },
        ],
      },
      reviewPriorities: {
        items: [
          { section_key: "monitoring_json", priority: "high", response_window: "today" },
          { section_key: "escalation_json", priority: "high", response_window: "today" },
        ],
      },
      confidenceProfile: {
        section_confidence: [
          { section_key: "monitoring_json", max_confidence: "medium" },
        ],
      },
      followThrough: { status: "needs_review" },
    });

    expect(summary).toMatchObject({
      overall_status: "strong",
      matched_case_count: 1,
      strongest_case_id: "urgent_unreachable_fall_risk",
      rejected: false,
    });
    expect(summary?.average_score).toBeGreaterThanOrEqual(88);
    expect(summary?.average_rubric_score).toBeGreaterThanOrEqual(85);
    expect(summary?.evaluations?.[0]).toMatchObject({
      case_id: "urgent_unreachable_fall_risk",
      overall_status: "strong",
      rubric_overall_status: "strong",
    });
  });

  it("returns an unmatched summary when no benchmark archetype is relevant enough", () => {
    const summary = buildHealthPlanBenchmarkAssessment({
      plan: {
        summary_text: "Maintain a calm general support plan.",
        goals_json: [{ text: "Keep routines stable." }],
        daily_support_json: [{ text: "Continue daily support." }],
        monitoring_json: [],
        escalation_json: [],
        caregiver_guidance_json: [],
      },
      sourceSignals: [
        { id: "language-context", label: "Preferred language known", category: "context", strength: "low" },
      ],
      evidencePack: {
        same_day_response_required: false,
        must_address_facts: [],
        verification_needs: [],
        stabilizing_facts: [],
      },
    });

    expect(summary).toMatchObject({
      overall_status: "unmatched",
      matched_case_count: 0,
      average_score: 0,
      rejected: false,
    });
  });

  it("builds prompt-friendly guidance from matched benchmark archetypes", () => {
    const guidance = buildHealthPlanBenchmarkGuidance({
      sourceSignals: [
        { id: "alert-active", label: "Active fall alert", category: "alert", strength: "high" },
        { id: "service-checkins", label: "Missed check-ins", category: "service", strength: "high" },
        { id: "care-circle-context", label: "Caregiver backup", category: "care-circle", strength: "medium" },
      ],
      evidencePack: {
        same_day_response_required: true,
        must_address_facts: [
          { source_signal_ids: ["alert-active", "service-checkins"] },
        ],
      },
    });

    expect(guidance?.matched_case_count).toBeGreaterThan(0);
    expect(guidance?.items?.[0]).toMatchObject({
      case_id: "urgent_unreachable_fall_risk",
      same_day_response_required: true,
    });
  });

  it("rejects a fragile high-match benchmark fit", () => {
    expect(shouldRejectHealthPlanBenchmarkAssessment({
      matched_case_count: 1,
      evaluations: [
        {
          match_score: 84,
          overall_status: "fragile",
          rubric_overall_status: "fragile",
          critical_dimension_failures: 2,
        },
      ],
    })).toBe(true);
  });
});
