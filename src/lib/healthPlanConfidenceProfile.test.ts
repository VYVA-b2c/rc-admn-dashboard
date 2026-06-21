import { describe, expect, it } from "vitest";

import { buildHealthPlanConfidenceProfile } from "./healthPlanConfidenceProfile.js";

describe("buildHealthPlanConfidenceProfile", () => {
  it("downgrades item confidence when evidence is too thin", () => {
    const result = buildHealthPlanConfidenceProfile({
      plan: {
        goals_json: [
          {
            id: "goal-1",
            text: "Keep the client on a steady routine.",
            source_signal_ids: ["service-checkins"],
            confidence: "high",
          },
        ],
      },
      sourceSignals: [
        {
          id: "service-checkins",
          label: "Check-ins are enabled",
          category: "service",
          strength: "medium",
        },
      ],
    });

    expect(result.plan?.goals_json?.[0]?.confidence).toBe("low");
    expect(result.adjustments[0]?.requested_confidence).toBe("high");
    expect(result.adjustments[0]?.applied_confidence).toBe("low");
  });

  it("caps confidence when a section has high-severity evidence weakness", () => {
    const result = buildHealthPlanConfidenceProfile({
      plan: {
        monitoring_json: [
          {
            id: "monitor-1",
            text: "Watch the active risk signals today.",
            source_signal_ids: ["risk-latest-score", "alert-active"],
            confidence: "high",
          },
        ],
      },
      sourceSignals: [
        { id: "risk-latest-score", label: "Predictive risk is high", category: "risk", strength: "high" },
        { id: "alert-active", label: "Active alert", category: "alert", strength: "high" },
      ],
      dataQualityGaps: [
        {
          id: "gap-monitoring",
          label: "Monitoring data is incomplete",
          detail: "Some live monitoring inputs are stale.",
          severity: "high",
        },
      ],
    });

    expect(result.section_confidence.find((item) => item.section_key === "monitoring_json")?.max_confidence).toBe("low");
    expect(result.plan?.monitoring_json?.[0]?.confidence).toBe("low");
    expect(result.overall_status).toBe("fragile");
  });

  it("recognizes stronger cross-signal evidence when the plan is well-supported", () => {
    const result = buildHealthPlanConfidenceProfile({
      plan: {
        escalation_json: [
          {
            id: "escalation-1",
            text: "Escalate if medication misses continue and the client cannot be reached.",
            source_signal_ids: ["medication-plan", "alert-active"],
            confidence: "high",
          },
        ],
      },
      sourceSignals: [
        { id: "medication-plan", label: "Medication misses this week", category: "medication", strength: "high" },
        { id: "alert-active", label: "Reachability alert", category: "alert", strength: "high" },
      ],
    });

    expect(result.plan?.escalation_json?.[0]?.confidence).toBe("high");
    expect(result.overall_status).toBe("strong");
  });
});
