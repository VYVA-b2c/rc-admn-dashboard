import { describe, expect, it } from "vitest";

import {
  buildHealthPlanRecommendationCoverage,
  shouldRejectHealthPlanRecommendationCoverage,
} from "./healthPlanRecommendationCoverage.js";

describe("health plan recommendation coverage", () => {
  it("accepts plans that cover urgent live facts, verification, and stabilizing routines", () => {
    const summary = buildHealthPlanRecommendationCoverage({
      plan: {
        summary_text: "Urgent fall risk and missed check-ins require same-day contact and verification.",
        summary_signal_ids: ["alert-active", "service-checkins"],
        goals_json: [
          { text: "Keep the morning check-in routine in place because it still helps orientation.", source_signal_ids: ["service-checkins"] },
        ],
        daily_support_json: [
          { text: "Preserve the morning check-in routine and document whether the client answers more reliably before noon.", source_signal_ids: ["service-checkins"] },
        ],
        monitoring_json: [
          { text: "Verify the fall alert status today and confirm whether the missed check-ins reflect a real no-response pattern.", timing: "today", priority: "high", source_signal_ids: ["alert-active", "service-checkins"] },
        ],
        escalation_json: [
          { text: "If contact still fails today, escalate to the on-call coordinator and log the fallback owner.", timing: "today", priority: "high", source_signal_ids: ["alert-active"] },
        ],
        caregiver_guidance_json: [],
      },
      evidencePack: {
        same_day_response_required: true,
        must_address_facts: [
          { label: "Active fall alert", response_window: "today", priority: "high", source_signal_ids: ["alert-active"] },
        ],
        verification_needs: [
          { label: "Missed check-ins need confirmation", severity: "high", source_signal_ids: ["service-checkins"] },
        ],
        stabilizing_facts: [
          { label: "Morning check-ins are still helping", source_signal_ids: ["service-checkins"] },
        ],
      },
      reviewPriorities: {
        items: [
          { section_key: "monitoring_json", priority: "high", response_window: "today" },
          { section_key: "escalation_json", priority: "high", response_window: "today" },
        ],
      },
      followThrough: { status: "mixed" },
    });

    expect(summary).toMatchObject({
      overall_status: "strong",
      must_address_count: 1,
      must_address_covered_count: 1,
      verification_need_count: 1,
      verification_covered_count: 1,
      stabilizing_fact_count: 1,
      stabilizing_preserved_count: 1,
    });
    expect(shouldRejectHealthPlanRecommendationCoverage(summary)).toBe(false);
  });

  it("rejects plans that miss urgent facts and leave uncertainty implicit", () => {
    const summary = buildHealthPlanRecommendationCoverage({
      plan: {
        summary_text: "Continue support and monitor wellbeing.",
        summary_signal_ids: [],
        goals_json: [{ text: "Maintain a calm routine.", source_signal_ids: [] }],
        daily_support_json: [{ text: "Keep daily support steady.", source_signal_ids: [] }],
        monitoring_json: [{ text: "Observe general wellbeing.", timing: "ongoing", priority: "low", source_signal_ids: [] }],
        escalation_json: [],
        caregiver_guidance_json: [],
      },
      evidencePack: {
        same_day_response_required: true,
        must_address_facts: [
          { label: "Active fall alert", response_window: "today", priority: "high", source_signal_ids: ["alert-active"] },
        ],
        verification_needs: [
          { label: "Missed check-ins need confirmation", severity: "high", source_signal_ids: ["service-checkins"] },
        ],
        stabilizing_facts: [
          { label: "Morning check-ins are still helping", source_signal_ids: ["service-checkins"] },
        ],
      },
      reviewPriorities: {
        items: [
          { section_key: "monitoring_json", priority: "high", response_window: "today" },
          { section_key: "escalation_json", priority: "high", response_window: "today" },
        ],
      },
      followThrough: { status: "needs_review" },
    });

    expect(summary?.overall_status).toBe("fragile");
    expect(summary?.must_address_covered_count).toBe(0);
    expect(summary?.verification_covered_count).toBe(0);
    expect(summary?.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "must_address_fact_missing", severity: "high" }),
        expect.objectContaining({ type: "verification_need_missing", severity: "high" }),
      ]),
    );
    expect(shouldRejectHealthPlanRecommendationCoverage(summary)).toBe(true);
  });
});
