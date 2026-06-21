import { describe, expect, it } from "vitest";

import { buildHealthPlanReviewPriorities } from "./healthPlanReviewPriorities.js";

describe("healthPlanReviewPriorities", () => {
  it("ranks the sections that need the strongest human review before staff rely on the plan", () => {
    const result = buildHealthPlanReviewPriorities({
      sourceSignals: [
        { id: "alert-active", category: "alert" },
        { id: "risk-latest-score", category: "risk" },
        { id: "medication-plan", category: "medication" },
        { id: "service-checkins", category: "service" },
      ],
      escalationGrade: { grade: "urgent" },
      reviewGovernance: { review_window: "today" },
      confidenceProfile: {
        section_confidence: [
          {
            section_key: "monitoring_json",
            max_confidence: "low",
            reasons: [{ label: "Recent alerts conflict with older reassurance." }],
          },
          {
            section_key: "daily_support_json",
            max_confidence: "medium",
            reasons: [{ label: "Medication follow-through still needs confirmation." }],
          },
        ],
      },
      evidencePack: {
        same_day_response_required: true,
        contradictions: [
          {
            section_key: "monitoring_json",
            severity: "high",
            summary: "Predictive risk and missed contact are now pulling against the older routine.",
            source_signal_ids: ["alert-active", "risk-latest-score"],
          },
        ],
        verification_needs: [
          {
            label: "Confirm the medication schedule before assuming the routine is stable.",
            severity: "medium",
            source_signal_ids: ["medication-plan"],
          },
        ],
      },
      clinicalCautions: [
        {
          label: "Reachability risk needs an explicit response path",
          severity: "high",
          section_keys: ["monitoring_json", "escalation_json"],
          signal_ids: ["alert-active"],
        },
      ],
      sectionOutcomes: [
        {
          section_key: "monitoring_json",
          trend: "weakening",
          operational_learning_summary: "Repeated caution outcomes say this section is not holding up reliably.",
          contradiction_status: "live_conflict",
          contradiction_reason: "Live activity is no longer matching the older feedback in this section.",
        },
      ],
      clientResponseMemory: {
        fragile_anchors: [
          {
            category: "service",
            labels: ["Outreach calls"],
            reason: "Recent follow-through in this category is breaking down or staying too uncertain.",
          },
        ],
      },
      qualityMemory: {
        repeated_refresh_sections: [{ section_key: "monitoring_json", count: 3 }],
      },
      freshness: { status: "stale" },
      refreshStrategy: {
        recommended_sections: [{ section_key: "monitoring_json", priority: "high", reasons: ["Monitoring is the first section that should be refreshed."] }],
      },
    });

    expect(result.overall_priority).toBe("high");
    expect(result.urgent_review_count).toBeGreaterThan(0);
    expect(result.items[0]).toMatchObject({
      section_key: "monitoring_json",
      priority: "high",
      response_window: "today",
      confidence_ceiling: "low",
    });
    expect(result.items[0]?.why_now).toMatch(/same-day|alerts|not holding up/i);
    expect(result.items.some((item) => item.section_key === "daily_support_json")).toBe(true);
  });
});
