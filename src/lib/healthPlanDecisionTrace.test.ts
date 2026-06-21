import { describe, expect, it } from "vitest";

import { buildHealthPlanDecisionTrace } from "./healthPlanDecisionTrace";

describe("healthPlanDecisionTrace", () => {
  it("builds section traces with drivers, confidence state, and review actions", () => {
    const trace = buildHealthPlanDecisionTrace({
      plan: {
        goals_json: [
          { text: "Keep Carmen reachable this week.", source_signal_ids: ["risk-latest-score", "care-circle-context"], confidence: "medium" },
        ],
        daily_support_json: [
          { text: "Keep the morning medication reminder and check-in routine.", source_signal_ids: ["medication-plan", "service-checkins"], confidence: "high" },
        ],
        monitoring_json: [
          { text: "Recheck unresolved alerts and sensor visibility today.", source_signal_ids: ["alert-active", "sensor-status"], confidence: "medium" },
        ],
        escalation_json: [
          { text: "Call the assigned responder the same day if Carmen remains unreachable.", source_signal_ids: ["alert-active", "risk-latest-score"], confidence: "high" },
        ],
        caregiver_guidance_json: [
          { text: "Keep caregiver sharing narrow until consent is confirmed.", source_signal_ids: ["consent-family-sharing"], confidence: "low" },
        ],
      },
      sourceSignals: [
        { id: "risk-latest-score", label: "Predictive risk score 82 (high)", category: "risk", strength: "high" },
        { id: "care-circle-context", label: "Care circle context", detail: "No care provider assignment recorded", category: "care-circle", strength: "high" },
        { id: "medication-plan", label: "2 medications on file", category: "medication", strength: "high" },
        { id: "service-checkins", label: "Check-ins", category: "service", strength: "medium" },
        { id: "alert-active", label: "1 active alert", category: "alert", strength: "high" },
        { id: "sensor-status", label: "2 sensors linked", detail: "1 offline", category: "sensor", strength: "high" },
        { id: "consent-family-sharing", label: "Family sharing consent not confirmed", category: "care-circle", strength: "high" },
      ],
      dataQualityGaps: [
        { label: "Medication activity is stale", severity: "medium", staff_action: "Confirm the next medication touchpoint before relying on adherence guidance." },
        { label: "Sharing boundary not confirmed", severity: "high", staff_action: "Check family sharing consent before broadening caregiver guidance." },
      ],
      followThrough: {
        caution_signals: [{ label: "No fresh medication follow-through has been recorded yet." }],
      },
      sectionDrift: [
        { section_key: "caregiver_guidance_json", reasons: ["Sharing guidance may be stale because consent has not been reconfirmed."] },
      ],
    });

    const caregiverTrace = trace.find((item) => item.section_key === "caregiver_guidance_json");
    expect(caregiverTrace).toMatchObject({
      confidence_state: "limited",
      driver_strength: "high",
    });
    expect(caregiverTrace?.limitation_labels).toEqual(expect.arrayContaining(["Sharing boundary not confirmed"]));
    expect(caregiverTrace?.review_actions?.[0]).toMatch(/consent/i);

    const monitoringTrace = trace.find((item) => item.section_key === "monitoring_json");
    expect(monitoringTrace?.driver_signals?.map((signal) => signal.id)).toEqual(expect.arrayContaining(["alert-active", "sensor-status"]));
  });
});
