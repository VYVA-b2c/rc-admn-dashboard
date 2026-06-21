import { describe, expect, it } from "vitest";

import { buildHealthPlanSignalTriage } from "./healthPlanSignalTriage.js";

describe("buildHealthPlanSignalTriage", () => {
  it("prioritizes action-driving risk, alert, medication, and sensor signals over forecast background", () => {
    const triage = buildHealthPlanSignalTriage(
      [
        { id: "risk-latest-score", label: "Predictive risk score 82 (high)", category: "risk", strength: "high", detail: "As of 2026-06-20" },
        { id: "forecast-near-term", label: "Risk forecast", category: "forecast", strength: "medium", detail: "Day 1: 84" },
        { id: "alert-active", label: "1 active alert", category: "alert", strength: "high", detail: "Client could not be reached" },
        { id: "medication-plan", label: "1 medication on file", category: "medication", strength: "high", detail: "Latest adherence missed" },
        { id: "sensor-status", label: "1 sensor linked", category: "sensor", strength: "high", detail: "1 offline or not reporting" },
        { id: "context-live-profile", label: "Profile context", category: "context", strength: "medium", detail: "Living context alone" },
      ],
      ["risk-latest-score", "alert-active"],
    );

    expect(triage.action_signal_ids).toEqual(
      expect.arrayContaining(["risk-latest-score", "alert-active", "medication-plan", "sensor-status"]),
    );
    expect(triage.background_signal_ids).toContain("context-live-profile");
    expect(triage.focus_summary_text).toMatch(/action-driving/i);
  });

  it("keeps supportive routines in a stabilizing lane when they are not currently slipping", () => {
    const triage = buildHealthPlanSignalTriage([
      { id: "service-checkins", label: "Check-ins", category: "service", strength: "medium", detail: "Enabled · daily · Last outcome completed" },
      { id: "service-brain-coach", label: "Brain Coach", category: "service", strength: "medium", detail: "Enabled · weekly · Last outcome completed" },
      { id: "medication-plan", label: "1 medication on file", category: "medication", strength: "medium", detail: "Saved reminder times 09:00 · Latest adherence taken" },
      { id: "care-circle-context", label: "Care circle context", category: "care-circle", strength: "medium", detail: "2 care provider assignments" },
    ]);

    expect(triage.stabilizing_signal_ids).toEqual(
      expect.arrayContaining(["service-checkins", "service-brain-coach", "medication-plan", "care-circle-context"]),
    );
  });

  it("surfaces caution and verification when consent or sensor reliability are unresolved", () => {
    const triage = buildHealthPlanSignalTriage([
      { id: "sensor-status", label: "1 sensor linked", category: "sensor", strength: "high", detail: "1 offline or not reporting" },
      { id: "consent-family-sharing", label: "Family sharing consent not confirmed", category: "care-circle", strength: "high", detail: "Keep client-specific guidance narrow until the sharing boundary is confirmed." },
      { id: "care-circle-context", label: "Care circle context", category: "care-circle", strength: "high", detail: "No care provider assignment recorded" },
    ]);

    expect(triage.verification_signal_ids).toEqual(
      expect.arrayContaining(["sensor-status", "consent-family-sharing"]),
    );
    expect(triage.caution_signal_ids).toEqual(
      expect.arrayContaining(["sensor-status", "consent-family-sharing", "care-circle-context"]),
    );
    expect(triage.caution_summary_text).toMatch(/verification|false reassurance/i);
  });
});

