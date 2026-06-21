import { describe, expect, it } from "vitest";

import { buildHealthPlanLiveEvidenceSignals, buildHealthPlanLiveEvidenceSummary } from "./healthPlanLiveEvidenceSummary.js";

describe("healthPlanLiveEvidenceSummary", () => {
  it("summarizes repeated live pressure across service, medication, and sensor signals", () => {
    const summary = buildHealthPlanLiveEvidenceSummary({
      medications: [
        { reminders_enabled: true },
        { reminders_enabled: false },
      ],
      medicationActivity: { status: "missed", occurred_at: "2026-06-20T09:00:00.000Z" },
      checkins: { enabled: true },
      brainCoach: { enabled: true },
      sensors: [
        { status: "offline", battery_level: 18, last_reading_at: "2026-06-17T08:00:00.000Z" },
        { status: "online", battery_level: 55, last_reading_at: "2026-06-20T08:00:00.000Z" },
      ],
      alerts: [
        { severity: "critical", resolved_at: null },
      ],
      recentOperationalEvents: [
        { source: "checkins", status: "missed", occurred_at: "2026-06-20T08:00:00.000Z" },
        { source: "campaign_call", status: "no_answer", occurred_at: "2026-06-20T09:00:00.000Z" },
        { source: "medication", status: "missed", occurred_at: "2026-06-20T10:00:00.000Z" },
        { source: "medication", status: "late", occurred_at: "2026-06-20T11:00:00.000Z" },
      ],
      now: new Date("2026-06-20T12:00:00.000Z"),
    });

    expect(summary.status).toBe("pressure");
    expect(summary.service_engagement.status).toBe("pressure");
    expect(summary.medication_adherence.status).toBe("pressure");
    expect(summary.sensor_reliability.status).toBe("pressure");
    expect(summary.trend_summary).toMatchObject({
      contact_trend: "worsening",
      medication_trend: "worsening",
    });
    expect(summary.attention_flags.length).toBeGreaterThan(0);

    const signals = buildHealthPlanLiveEvidenceSignals(summary);
    expect(signals.map((item) => item.id)).toEqual(
      expect.arrayContaining(["service-engagement", "medication-adherence-trend", "sensor-reliability", "contact-trend-window"]),
    );
  });
});
