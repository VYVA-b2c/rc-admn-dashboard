import { describe, expect, it } from "vitest";

import {
  buildHealthPlanCalibrationRepairBrief,
  buildHealthPlanCalibrationRepairMessage,
  shouldAttemptHealthPlanCalibrationRepair,
} from "./healthPlanRecommendationCalibrationPolicy.js";

describe("healthPlanRecommendationCalibrationPolicy", () => {
  it("requests a repair pass when high-pressure adjustments were needed", () => {
    const summary = {
      adjustment_count: 1,
      high_pressure_adjustment_count: 1,
      verification_added_count: 1,
      items: [
        {
          section_key: "monitoring_json",
          text: "Verify the repeated missed outreach pattern today.",
          high_pressure: true,
          verification_added: true,
        },
      ],
    };

    expect(shouldAttemptHealthPlanCalibrationRepair(summary)).toBe(true);
  });

  it("does not request a repair pass for a clean or single low-pressure adjustment", () => {
    expect(shouldAttemptHealthPlanCalibrationRepair(null)).toBe(false);
    expect(shouldAttemptHealthPlanCalibrationRepair({
      adjustment_count: 1,
      high_pressure_adjustment_count: 0,
      verification_added_count: 0,
    })).toBe(false);
  });

  it("builds a concise repair brief and message from calibration output", () => {
    const summary = {
      summary: "2 recommendations were auto-calibrated to better match the available evidence and live pressure.",
      adjustment_count: 2,
      confidence_downgrade_count: 2,
      verification_added_count: 1,
      high_pressure_adjustment_count: 1,
      items: [
        {
          section_key: "monitoring_json",
          item_id: "monitor-1",
          text: "Verify the repeated missed outreach pattern today.",
          requested_confidence: "high",
          applied_confidence: "medium",
          verification_added: true,
          high_pressure: true,
          reason: "This recommendation is usable, but staff should verify the live picture before leaning on it heavily.",
        },
      ],
    };

    expect(buildHealthPlanCalibrationRepairBrief(summary)).toMatchObject({
      adjustment_count: 2,
      high_pressure_adjustment_count: 1,
      focus: "same-day or high-priority recommendations",
      items: [
        expect.objectContaining({
          section_key: "monitoring_json",
          requested_confidence: "high",
          applied_confidence: "medium",
        }),
      ],
    });
    expect(buildHealthPlanCalibrationRepairMessage(summary)).toMatch(/high-pressure recommendations needed softer|verification steps/i);
  });
});
