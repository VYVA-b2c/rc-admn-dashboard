import { describe, expect, it } from "vitest";

import { getHealthPlanGoldenCase, healthPlanGoldenCases } from "./healthPlanGoldenCases.js";
import {
  evaluateHealthPlanAgainstGoldenCase,
  evaluateHealthPlanGoldenSuite,
} from "./healthPlanGoldenCaseEvaluation.js";

describe("health plan golden-case evaluation", () => {
  it("passes a realistic urgent fall-risk plan against the urgent golden case", () => {
    const scenario = getHealthPlanGoldenCase("urgent_unreachable_fall_risk");
    const evaluation = evaluateHealthPlanAgainstGoldenCase(scenario, {
      summary_text: "An active fall alert and repeated missed check-ins require same-day verification and a fallback outreach owner.",
      summary_signal_ids: ["alert-active", "service-checkins"],
      goals_json: [
        { text: "Keep caregiver backup engaged so same-day outreach does not depend on one failed call.", source_signal_ids: ["care-circle-context"] },
      ],
      daily_support_json: [
        { text: "Preserve caregiver backup and log who can attempt the next same-day contact if the first outreach fails.", source_signal_ids: ["care-circle-context"] },
      ],
      monitoring_json: [
        { text: "Verify the fall alert status today and confirm whether the missed check-ins reflect a real no-response pattern.", timing: "today", priority: "high", source_signal_ids: ["alert-active", "service-checkins"] },
      ],
      escalation_json: [
        { text: "Escalate today to the on-call coordinator and use the fallback outreach owner if contact still fails.", timing: "today", priority: "high", source_signal_ids: ["alert-active"] },
      ],
      caregiver_guidance_json: [
        { text: "Ask the caregiver to confirm whether they can attempt contact today and report back if the client remains unreachable.", timing: "today", priority: "medium", source_signal_ids: ["care-circle-context"] },
      ],
    });

    expect(evaluation).toMatchObject({
      overall_status: "strong",
      case_id: "urgent_unreachable_fall_risk",
    });
    expect(evaluation?.score).toBeGreaterThanOrEqual(88);
    expect(evaluation?.rubric?.overall_status).toBe("strong");
    expect(evaluation?.rubric?.dimensions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "owner_clarity", status: "strong" }),
        expect.objectContaining({ id: "fallback_completeness", status: "strong" }),
        expect.objectContaining({ id: "verification_clarity", status: "strong" }),
      ]),
    );
  });

  it("fails a vague plan against the same urgent golden case", () => {
    const scenario = getHealthPlanGoldenCase("urgent_unreachable_fall_risk");
    const evaluation = evaluateHealthPlanAgainstGoldenCase(scenario, {
      summary_text: "Maintain support and stay observant.",
      summary_signal_ids: [],
      goals_json: [{ text: "Maintain stability.", source_signal_ids: [] }],
      daily_support_json: [{ text: "Continue support.", source_signal_ids: [] }],
      monitoring_json: [{ text: "Observe changes.", timing: "ongoing", priority: "low", source_signal_ids: [] }],
      escalation_json: [],
      caregiver_guidance_json: [],
    });

    expect(evaluation?.overall_status).toBe("fragile");
    expect(evaluation?.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "required_timing_missing" }),
        expect.objectContaining({ type: "verification_language_missing" }),
      ]),
    );
    expect(evaluation?.generation_quality?.overall_status).toBe("fragile");
    expect(evaluation?.recommendation_coverage?.overall_status).toBe("fragile");
    expect(evaluation?.rubric?.overall_status).toBe("fragile");
    expect(evaluation?.rubric?.dimensions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "owner_clarity", status: "fragile" }),
        expect.objectContaining({ id: "fallback_completeness", status: "fragile" }),
      ]),
    );
  });

  it("summarizes a multi-case benchmark suite", () => {
    const suite = evaluateHealthPlanGoldenSuite(healthPlanGoldenCases, {
      urgent_unreachable_fall_risk: {
        summary_text: "An active fall alert and repeated missed check-ins require same-day verification and a fallback outreach owner.",
        summary_signal_ids: ["alert-active", "service-checkins"],
        goals_json: [{ text: "Keep caregiver backup engaged.", source_signal_ids: ["care-circle-context"] }],
        daily_support_json: [{ text: "Preserve caregiver backup and next-call ownership.", source_signal_ids: ["care-circle-context"] }],
        monitoring_json: [{ text: "Verify the fall alert status today and confirm the no-response pattern.", timing: "today", priority: "high", source_signal_ids: ["alert-active", "service-checkins"] }],
        escalation_json: [{ text: "Escalate today with a named fallback owner if contact still fails.", timing: "today", priority: "high", source_signal_ids: ["alert-active"] }],
        caregiver_guidance_json: [{ text: "Ask the caregiver to confirm whether they can attempt contact today and report back.", timing: "today", priority: "medium", source_signal_ids: ["care-circle-context"] }],
      },
      medication_uncertainty_and_adherence_slip: {
        summary_text: "Unconfirmed medication doses need confirmation and a tighter medication routine this week.",
        summary_signal_ids: ["medication-plan"],
        goals_json: [{ text: "Protect medication continuity without assuming reminder times still fit.", source_signal_ids: ["medication-plan"] }],
        daily_support_json: [{ text: "Confirm the medication routine, preserve the morning support call, and document whether reminder times still fit real life.", timing: "this_week", priority: "high", source_signal_ids: ["medication-plan", "service-checkins"] }],
        monitoring_json: [{ text: "Review whether any dose was missed, confirm adherence barriers, and if missed doses continue call the caregiver and log the fallback follow-up this week.", timing: "this_week", priority: "medium", source_signal_ids: ["medication-plan", "care-circle-context"] }],
        escalation_json: [],
        caregiver_guidance_json: [{ text: "Ask the caregiver to reinforce the medication plan if missed doses continue.", timing: "this_week", priority: "medium", source_signal_ids: ["care-circle-context"] }],
      },
      caregiver_gap_with_consent_limit: {
        summary_text: "Support ownership is unclear, so consent and escalation contacts need confirmation before assumptions are made.",
        summary_signal_ids: ["care-circle-context", "consent-family-sharing"],
        goals_json: [{ text: "Keep check-in continuity while clarifying who can safely receive updates.", source_signal_ids: ["service-checkins"] }],
        daily_support_json: [{ text: "Preserve the check-in routine while support ownership is being clarified.", source_signal_ids: ["service-checkins"] }],
        monitoring_json: [{ text: "Confirm whether any contact changes should wait until family-sharing consent is reconfirmed.", timing: "this_week", priority: "medium", source_signal_ids: ["consent-family-sharing"] }],
        escalation_json: [],
        caregiver_guidance_json: [{ text: "Confirm consent before sharing updates, identify who can act, and document the support owner once confirmed.", timing: "this_week", priority: "high", source_signal_ids: ["care-circle-context", "consent-family-sharing"] }],
      },
      sensor_pressure_with_reporting_conflict: {
        summary_text: "A silent sensor and open alert require same-day verification before staff assume the issue is only technical.",
        summary_signal_ids: ["sensor-status", "alert-active"],
        goals_json: [{ text: "Treat the sensor silence as unresolved risk until it is verified.", source_signal_ids: ["sensor-status"] }],
        daily_support_json: [],
        monitoring_json: [{ text: "Verify today whether the sensor silence reflects device failure or a real client risk and review the open alert status.", timing: "today", priority: "high", source_signal_ids: ["sensor-status", "alert-active"] }],
        escalation_json: [{ text: "Escalate today if the sensor remains silent and the alert cannot be cleared safely.", timing: "today", priority: "high", source_signal_ids: ["sensor-status", "alert-active"] }],
        caregiver_guidance_json: [],
      },
    });

    expect(suite).toMatchObject({
      total_cases: 4,
      strong_count: 4,
      fragile_count: 0,
    });
    expect(suite.average_score).toBeGreaterThanOrEqual(88);
    expect(suite.average_rubric_score).toBeGreaterThanOrEqual(85);
  });
});
