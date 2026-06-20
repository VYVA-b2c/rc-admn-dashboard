import { describe, expect, it } from "vitest";

import { deriveHealthPlanIncidentPlaybooks } from "@/lib/healthPlanIncidentPlaybooks";

describe("deriveHealthPlanIncidentPlaybooks", () => {
  it("creates a same-day welfare playbook when no fresh contact is logged", () => {
    const playbooks = deriveHealthPlanIncidentPlaybooks({
      healthPlan: {
        language: "en",
        daily_support_json: [{ text: "Confirm hydration and breakfast today.", source_signal_ids: ["alert-active"] }],
        goals_json: [{ text: "Keep the next touchpoint calm and close in time.", source_signal_ids: ["risk"] }],
        monitoring_json: [],
      },
      handoff: {
        priority: "high",
        responseWindow: "same_day",
        sharingBoundary: "approved_circle",
        ownerName: null,
        ownerMissing: true,
        careCircleCount: 1,
        activeAlertCount: 2,
        offlineSensorCount: 0,
        missedMedication: false,
        highRisk: true,
        actions: [],
      },
      progress: {
        ownerAssigned: false,
        firstContactMade: false,
        escalationClosed: false,
        completedCount: 0,
      },
      outreachStatus: {
        clientShared: false,
        careCircleShared: false,
        latestClientShare: null,
        latestCareCircleShare: null,
      },
    });

    expect(playbooks[0]?.code).toBe("urgent_welfare_check");
    expect(playbooks[0]?.priority).toBe("high");
    expect(playbooks[0]?.actionCode).toBe("contact_client");
    expect(playbooks[0]?.careCircleSteps).toHaveLength(2);
  });

  it("creates medication and sensor playbooks when those gaps are active", () => {
    const playbooks = deriveHealthPlanIncidentPlaybooks({
      healthPlan: {
        language: "en",
        daily_support_json: [{ text: "Verify the next medication dose with the client.", source_signal_ids: ["med"] }],
        goals_json: [],
        monitoring_json: [{ text: "Use a direct phone check if the sensor stays offline.", source_signal_ids: ["sensor"] }],
      },
      handoff: {
        priority: "medium",
        responseWindow: "within_24h",
        sharingBoundary: "staff_only",
        ownerName: "Ana Novak",
        ownerMissing: false,
        careCircleCount: 0,
        activeAlertCount: 0,
        offlineSensorCount: 2,
        missedMedication: true,
        highRisk: false,
        actions: [],
      },
      progress: {
        ownerAssigned: true,
        firstContactMade: true,
        escalationClosed: false,
        completedCount: 2,
      },
      outreachStatus: {
        clientShared: true,
        careCircleShared: false,
        latestClientShare: null,
        latestCareCircleShare: null,
      },
    });

    expect(playbooks.map((item) => item.code)).toEqual([
      "medication_recovery",
      "sensor_fallback",
    ]);
    expect(playbooks[0]?.actionCode).toBe("review_medication");
    expect(playbooks[1]?.actionCode).toBe("check_sensors");
    expect(playbooks[0]?.careCircleSteps).toHaveLength(0);
  });

  it("returns no playbooks when no major incident pattern is active", () => {
    const playbooks = deriveHealthPlanIncidentPlaybooks({
      healthPlan: {
        language: "en",
        daily_support_json: [{ text: "Keep the regular routine steady.", source_signal_ids: ["routine"] }],
        goals_json: [{ text: "Maintain stable daily support.", source_signal_ids: ["routine"] }],
        monitoring_json: [],
      },
      handoff: {
        priority: "low",
        responseWindow: "within_24h",
        sharingBoundary: "approved_circle",
        ownerName: "Ana Novak",
        ownerMissing: false,
        careCircleCount: 2,
        activeAlertCount: 0,
        offlineSensorCount: 0,
        missedMedication: false,
        highRisk: false,
        actions: [],
      },
      progress: {
        ownerAssigned: true,
        firstContactMade: true,
        escalationClosed: true,
        completedCount: 3,
      },
      outreachStatus: {
        clientShared: true,
        careCircleShared: true,
        latestClientShare: null,
        latestCareCircleShare: null,
      },
    });

    expect(playbooks).toEqual([]);
  });

  it("localizes incident guidance and includes care-circle steps when sharing is approved", () => {
    const playbooks = deriveHealthPlanIncidentPlaybooks({
      healthPlan: {
        language: "es",
        daily_support_json: [{ text: "Use short, clear medication reminders and confirm whether each scheduled dose was understood.", source_signal_ids: ["alerta"] }],
        goals_json: [{ text: "Keep the next touchpoint calm and close in time.", source_signal_ids: ["riesgo"] }],
        monitoring_json: [],
      },
      handoff: {
        priority: "high",
        responseWindow: "same_day",
        sharingBoundary: "approved_circle",
        ownerName: "Ana Novak",
        ownerMissing: false,
        careCircleCount: 2,
        activeAlertCount: 1,
        offlineSensorCount: 0,
        missedMedication: false,
        highRisk: true,
        actions: [],
      },
      progress: {
        ownerAssigned: true,
        firstContactMade: false,
        escalationClosed: false,
        completedCount: 1,
      },
      outreachStatus: {
        clientShared: false,
        careCircleShared: false,
        latestClientShare: null,
        latestCareCircleShare: null,
      },
    });

    expect(playbooks[0]?.triggerReason).toContain("senales de riesgo");
    expect(playbooks[0]?.careCircleSteps[0]).toContain("circulo de cuidado");
    expect(playbooks[0]?.teamSteps[0]).toContain("persona responsable");
    expect(playbooks[0]?.clientSteps[0]).toContain("Contactar directamente con la persona");
  });
});
