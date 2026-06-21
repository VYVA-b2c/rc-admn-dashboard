import { describe, expect, it } from "vitest";

import { buildHealthPlanSectionDrift } from "./healthPlanSectionDrift.js";

describe("health plan section drift", () => {
  const plan = {
    goals_json: [{ text: "Goal" }],
    daily_support_json: [{ text: "Daily" }],
    monitoring_json: [{ text: "Monitoring" }],
    escalation_json: [{ text: "Escalation" }],
    caregiver_guidance_json: [{ text: "Caregiver" }],
  };

  it("pushes monitoring and escalation to needs_refresh when risk and alert conditions moved", () => {
    const drift = buildHealthPlanSectionDrift({
      plan,
      dataQualityGaps: [{ id: "sensor-freshness-gap" }, { id: "predictive-freshness-gap" }],
      followThrough: {
        caution_signals: [{ id: "new-alerts-since-plan" }, { id: "risk-worsened" }],
      },
    });

    expect(drift.find((item) => item.section_key === "monitoring_json")).toMatchObject({
      status: "needs_refresh",
    });
    expect(drift.find((item) => item.section_key === "escalation_json")).toMatchObject({
      status: "needs_refresh",
    });
  });

  it("marks daily support as needs_refresh when service or medication freshness is weak", () => {
    const drift = buildHealthPlanSectionDrift({
      plan,
      dataQualityGaps: [{ id: "medication-freshness-gap" }, { id: "checkins-freshness-gap" }],
      followThrough: {
        caution_signals: [{ id: "no-fresh-touchpoints" }],
      },
    });

    expect(drift.find((item) => item.section_key === "daily_support_json")).toMatchObject({
      status: "needs_refresh",
    });
  });

  it("keeps sections fresh when no important gaps or caution signals are present", () => {
    const drift = buildHealthPlanSectionDrift({
      plan,
      dataQualityGaps: [],
      followThrough: {
        caution_signals: [],
      },
    });

    expect(drift.every((item) => item.status === "fresh")).toBe(true);
  });
});
