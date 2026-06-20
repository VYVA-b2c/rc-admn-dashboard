import { describe, expect, it } from "vitest";

import { deriveHealthPlanCommunicationPack } from "@/lib/healthPlanCommunication";

describe("deriveHealthPlanCommunicationPack", () => {
  const basePlan = {
    review_status: "reviewed" as const,
  };

  it("builds audience-specific scripts when sharing is approved", () => {
    const pack = deriveHealthPlanCommunicationPack(
      { healthPlan: basePlan },
      {
        shareState: "ready",
        sharingBoundary: "approved_circle",
        clientHighlights: [
          "Keep the daily check-in active at the usual morning time.",
          "Use short, clear medication reminders and confirm the morning dose.",
        ],
        careCircleHighlights: [
          "Share a short update with the approved care circle after significant changes.",
          "Ask the care circle to help reinforce hydration and the medication routine.",
        ],
        todayFocus: [
          "Review active alerts on the same day they appear.",
        ],
      },
      {
        priority: "high",
        responseWindow: "same_day",
        sharingBoundary: "approved_circle",
        ownerName: "Ana Novak",
        ownerMissing: false,
        careCircleCount: 2,
        activeAlertCount: 1,
        offlineSensorCount: 0,
        missedMedication: true,
        highRisk: true,
        actions: [],
      },
    );

    expect(pack?.state).toBe("ready");
    expect(pack?.clientScript).toHaveLength(3);
    expect(pack?.careCircleScript).toHaveLength(3);
    expect(pack?.staffGuardrails).toContain("same_day_tone");
    expect(pack?.staffGuardrails).not.toContain("protect_family_boundary");
  });

  it("holds communication inside staff when sharing is blocked", () => {
    const pack = deriveHealthPlanCommunicationPack(
      { healthPlan: basePlan },
      {
        shareState: "hold",
        sharingBoundary: "staff_only",
        clientHighlights: [
          "Keep the daily check-in active at the usual morning time.",
        ],
        careCircleHighlights: [],
        todayFocus: [
          "Review active alerts on the same day they appear.",
        ],
      },
      {
        priority: "high",
        responseWindow: "same_day",
        sharingBoundary: "staff_only",
        ownerName: null,
        ownerMissing: true,
        careCircleCount: 0,
        activeAlertCount: 1,
        offlineSensorCount: 0,
        missedMedication: false,
        highRisk: true,
        actions: [],
      },
    );

    expect(pack?.careCircleScript).toHaveLength(0);
    expect(pack?.staffGuardrails).toEqual([
      "hold_staff_only",
      "assign_owner_first",
      "same_day_tone",
      "protect_family_boundary",
    ]);
  });
});
