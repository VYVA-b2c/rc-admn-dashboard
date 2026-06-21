import { describe, expect, it } from "vitest";

import { buildHealthPlanReadiness, shouldBlockHealthPlanReadiness } from "./healthPlanReadiness.js";

describe("healthPlanReadiness", () => {
  it("blocks generation when live same-day pressure collides with low-confidence response sections and major gaps", () => {
    const readiness = buildHealthPlanReadiness({
      dataQualityGaps: [
        { id: "medication-timing-gap", label: "Medication timing data is incomplete", severity: "high", staff_action: "Fill in reminder times." },
        { id: "care-circle-gap", label: "Care-circle coverage is incomplete", severity: "high", staff_action: "Assign or confirm care coverage." },
      ],
      confidenceProfile: {
        section_confidence: [
          { section_key: "monitoring_json", max_confidence: "low" },
          { section_key: "escalation_json", max_confidence: "low" },
        ],
      },
      reviewGovernance: {
        review_required: true,
        review_window: "today",
        review_summary: "Same-day follow-up is required.",
      },
      liveEvidenceSummary: {
        service_engagement: { status: "pressure" },
        medication_adherence: { status: "pressure" },
      },
      freshness: { status: "critical", summary: "Fresh caution activity has overtaken the previous checkpoint." },
    });

    expect(readiness.overall_status).toBe("blocked");
    expect(readiness.blocker_count).toBeGreaterThan(0);
    expect(readiness.collection_actions.length).toBeGreaterThan(0);
    expect(shouldBlockHealthPlanReadiness(readiness)).toBe(true);
  });

  it("marks the plan guarded when evidence is usable but still incomplete", () => {
    const readiness = buildHealthPlanReadiness({
      dataQualityGaps: [
        { id: "predictive-freshness-gap", label: "Predictive inputs are getting stale", severity: "medium", staff_action: "Lean on live signals more heavily." },
        { id: "checkins-freshness-gap", label: "Check-ins activity is getting stale", severity: "medium", staff_action: "Record a fresh outcome." },
      ],
      confidenceProfile: {
        section_confidence: [
          { section_key: "daily_support_json", max_confidence: "low" },
        ],
      },
      reviewGovernance: {
        review_required: true,
        review_window: "this_week",
        review_summary: "This case still needs staff review before reuse.",
      },
      liveEvidenceSummary: {
        service_engagement: { status: "watch" },
      },
    });

    expect(readiness.overall_status).toBe("guarded");
    expect(readiness.blocker_count).toBe(0);
    expect(readiness.caution_count).toBeGreaterThan(0);
    expect(shouldBlockHealthPlanReadiness(readiness)).toBe(false);
  });

  it("stays ready when the evidence picture is broad and current", () => {
    const readiness = buildHealthPlanReadiness({
      dataQualityGaps: [],
      confidenceProfile: {
        section_confidence: [
          { section_key: "monitoring_json", max_confidence: "high" },
        ],
      },
      reviewGovernance: {
        review_required: false,
        review_window: "ongoing",
      },
      liveEvidenceSummary: {
        service_engagement: { status: "stable" },
        medication_adherence: { status: "stable" },
        sensor_reliability: { status: "stable" },
      },
      freshness: { status: "current" },
      longitudinalMemory: {
        domains: [],
      },
    });

    expect(readiness.overall_status).toBe("ready");
    expect(readiness.blocking_reasons).toEqual([]);
    expect(shouldBlockHealthPlanReadiness(readiness)).toBe(false);
  });
});
