import { describe, expect, it } from "vitest";

import {
  deriveHealthPlanItemEvidenceStatus,
  deriveHealthPlanSectionProvenance,
} from "@/lib/healthPlanProvenance";

describe("deriveHealthPlanSectionProvenance", () => {
  const signals = [
    { id: "risk-latest-score", label: "Predictive risk score 82 (high)", category: "risk", freshness: "live" as const },
    { id: "alert-active", label: "1 active alert", category: "alert", freshness: "live" as const },
    { id: "medication-plan", label: "1 medication on file", category: "medication", freshness: "recent" as const },
    { id: "sensor-status", label: "2 sensors linked", category: "sensor", freshness: "stale" as const },
  ];

  it("summarizes the main drivers of a section from its linked signals", () => {
    const provenance = deriveHealthPlanSectionProvenance({
      section: "monitoring",
      items: [
        {
          text: "Watch for repeated medication drift and device anomalies.",
          source_signal_ids: ["alert-active", "medication-plan", "sensor-status"],
        },
      ],
      signals,
    });

    expect(provenance?.driverCodes).toEqual(["active_alerts", "medication_followup", "sensor_reliability"]);
    expect(provenance?.signalLabels).toContain("1 active alert");
    expect(provenance?.staleSignalCount).toBe(1);
    expect(provenance?.linkedItemCount).toBe(1);
    expect(provenance?.uncoveredItemCount).toBe(0);
    expect(provenance?.supportLevel).toBe("mixed");
  });

  it("uses the context snapshot for summary provenance when section items do not exist", () => {
    const provenance = deriveHealthPlanSectionProvenance({
      section: "summary",
      signals,
      contextSnapshot: {
        evidence_digest: { top_priority_signal_ids: ["risk-latest-score", "alert-active"] },
        critical_signal_ids: ["alert-active"],
      },
    });

    expect(provenance?.driverCodes).toEqual(["risk_outlook", "active_alerts"]);
    expect(provenance?.signalLabels).toEqual([
      "Predictive risk score 82 (high)",
      "1 active alert",
    ]);
    expect(provenance?.supportLevel).toBe("strong");
  });

  it("downgrades support when section items are missing explicit evidence links", () => {
    const provenance = deriveHealthPlanSectionProvenance({
      section: "daily_support",
      items: [
        { text: "Use the saved routines to keep the day steady.", source_signal_ids: ["medication-plan"] },
        { text: "Check whether the family still understands the plan." },
      ],
      signals,
    });

    expect(provenance?.totalItemCount).toBe(2);
    expect(provenance?.linkedItemCount).toBe(1);
    expect(provenance?.uncoveredItemCount).toBe(1);
    expect(provenance?.supportLevel).toBe("mixed");
  });

  it("flags an item as stale when it only points to stale evidence", () => {
    const status = deriveHealthPlanItemEvidenceStatus({
      item: {
        text: "Watch for device dropouts.",
        source_signal_ids: ["sensor-status"],
      },
      signals,
    });

    expect(status?.state).toBe("stale");
    expect(status?.staleSignalCount).toBe(1);
    expect(status?.signalLabels).toEqual(["2 sensors linked"]);
  });

  it("flags an item as missing when it has no linked evidence at all", () => {
    const status = deriveHealthPlanItemEvidenceStatus({
      item: {
        text: "Keep routines calm and consistent.",
      },
      signals,
    });

    expect(status?.state).toBe("missing");
    expect(status?.signalLabels).toEqual([]);
  });
});
