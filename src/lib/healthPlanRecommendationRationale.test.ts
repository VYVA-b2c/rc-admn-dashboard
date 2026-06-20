import { describe, expect, it } from "vitest";

import { deriveHealthPlanRecommendationRationale } from "@/lib/healthPlanRecommendationRationale";

describe("healthPlanRecommendationRationale", () => {
  it("summarizes the main drivers and verification state for urgent recommendations", () => {
    const rationale = deriveHealthPlanRecommendationRationale({
      item: {
        text: "Escalate the same day if active alerts remain open or the client still cannot be reached.",
        source_signal_ids: ["alert-active", "execution-stalled"],
      },
      signals: [
        { id: "alert-active", label: "2 active alerts", category: "alert", strength: "high", freshness: "live" },
        { id: "execution-stalled", label: "Follow-through appears stalled", category: "context", strength: "high", freshness: "recent" },
      ],
      contextSnapshot: {
        critical_signal_ids: ["alert-active"],
        next_confirmations: [
          {
            text: "Move the case off the current blocked path by naming the next alternate route, owner, and proof of contact.",
            signal_ids: ["execution-stalled"],
          },
        ],
      },
      section: "escalation",
    });

    expect(rationale?.driverCodes).toContain("active_alerts");
    expect(rationale?.signalLabels).toEqual(["2 active alerts", "Follow-through appears stalled"]);
    expect(rationale?.confidenceState).toBe("urgent_review");
    expect(rationale?.evidenceState).toBe("linked");
    expect(rationale?.verificationText).toMatch(/Staff review before relying on this/i);
  });

  it("flags stale evidence when the recommendation is linked but needs a fresh check", () => {
    const rationale = deriveHealthPlanRecommendationRationale({
      item: {
        text: "Check whether the sensor problem is a device issue or a real care concern.",
        source_signal_ids: ["sensor-status"],
      },
      signals: [
        { id: "sensor-status", label: "1 sensor linked", category: "sensor", strength: "medium", freshness: "stale" },
      ],
      contextSnapshot: {
        next_confirmations: [],
      },
      section: "monitoring",
    });

    expect(rationale?.driverCodes).toEqual(["sensor_reliability"]);
    expect(rationale?.confidenceState).toBe("verify_first");
    expect(rationale?.evidenceState).toBe("stale");
    expect(rationale?.verificationText).toMatch(/Verify this recommendation/i);
  });
});
