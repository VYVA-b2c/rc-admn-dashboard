import { describe, expect, it } from "vitest";

import { deriveHealthPlanCareCircleBridge } from "@/lib/healthPlanCareCircleBridge";

describe("deriveHealthPlanCareCircleBridge", () => {
  it("holds the outward message when sharing is still staff-only", () => {
    const bridge = deriveHealthPlanCareCircleBridge({
      handoff: {
        priority: "high",
        responseWindow: "same_day",
        sharingBoundary: "staff_only",
        ownerName: null,
        ownerMissing: true,
        careCircleCount: 0,
        activeAlertCount: 1,
        offlineSensorCount: 0,
        missedMedication: true,
        highRisk: true,
        actions: [{ code: "assign_owner", tone: "high" }],
      },
      accountability: {
        state: "urgent",
        movementState: "stalled",
        responseWindow: "same_day",
        pendingCount: 3,
        pendingHighCount: 2,
        stalled: true,
        staleAfterHours: 3,
        lastMovementAt: null,
        lastMovementBy: null,
        lastMovementCode: null,
        summaryText: "Fresh follow-through is missing.",
        receipts: [],
      },
      sharePack: {
        shareState: "hold",
        sharingBoundary: "staff_only",
        clientHighlights: [],
        careCircleHighlights: [],
        todayFocus: ["Confirm a real touchpoint today."],
      },
      audienceBriefings: {
        responseWindow: "same_day",
        sharingBoundary: "staff_only",
        elderLines: ["Stay calm and keep the next call close."],
        careCircleLines: [],
        staffItems: [],
      },
      nextConfirmations: [{ text: "Confirm a fresh touchpoint today." }],
      openQuestions: [{ text: "Confirm who owns the next call." }],
    });

    expect(bridge?.state).toBe("urgent");
    expect(bridge?.realityState).toBe("stalled");
    expect(bridge?.careCircleLead).toBeNull();
    expect(bridge?.summaryText).toContain("inside staff");
    expect(bridge?.confirmNow).toHaveLength(1);
  });

  it("surfaces a shareable care-circle line once review and sharing are ready", () => {
    const bridge = deriveHealthPlanCareCircleBridge({
      handoff: {
        priority: "medium",
        responseWindow: "within_24h",
        sharingBoundary: "approved_circle",
        ownerName: "Maria Garcia",
        ownerMissing: false,
        careCircleCount: 2,
        activeAlertCount: 0,
        offlineSensorCount: 0,
        missedMedication: false,
        highRisk: false,
        actions: [{ code: "maintain_routine", tone: "low" }],
      },
      accountability: {
        state: "stable",
        movementState: "fresh",
        responseWindow: "within_24h",
        pendingCount: 0,
        pendingHighCount: 0,
        stalled: false,
        staleAfterHours: 12,
        lastMovementAt: "2026-06-18T10:00:00.000Z",
        lastMovementBy: "ana@redcross.example",
        lastMovementCode: "care_circle_brief_shared",
        summaryText: "Key follow-through is recorded.",
        receipts: [],
      },
      sharePack: {
        shareState: "ready",
        sharingBoundary: "approved_circle",
        clientHighlights: [],
        careCircleHighlights: ["Help reinforce hydration today."],
        todayFocus: ["Keep the routine calm and steady."],
      },
      audienceBriefings: {
        responseWindow: "within_24h",
        sharingBoundary: "approved_circle",
        elderLines: ["Keep the daily rhythm steady today."],
        careCircleLines: ["Help reinforce hydration and the medication routine today."],
        staffItems: [],
      },
      nextConfirmations: [],
      confirmationStatuses: [],
      openQuestions: [],
    });

    expect(bridge?.state).toBe("stable");
    expect(bridge?.realityState).toBe("fresh");
    expect(bridge?.ownerName).toBe("Maria Garcia");
    expect(bridge?.careCircleLead).toContain("hydration");
    expect(bridge?.cautionText).toContain("grounded enough");
  });

  it("refreshes the reality state once every queued confirmation has a receipt", () => {
    const bridge = deriveHealthPlanCareCircleBridge({
      handoff: {
        priority: "high",
        responseWindow: "same_day",
        sharingBoundary: "approved_circle",
        ownerName: "Maria Garcia",
        ownerMissing: false,
        careCircleCount: 2,
        activeAlertCount: 1,
        offlineSensorCount: 0,
        missedMedication: false,
        highRisk: true,
        actions: [{ code: "review_alerts", tone: "high" }],
      },
      accountability: {
        state: "watch",
        movementState: "fresh",
        responseWindow: "same_day",
        pendingCount: 1,
        pendingHighCount: 0,
        stalled: false,
        staleAfterHours: 3,
        lastMovementAt: "2026-06-19T09:45:00.000Z",
        lastMovementBy: "mila@redcross.example",
        lastMovementCode: "first_contact_made",
        summaryText: "Movement is recorded.",
        receipts: [],
      },
      sharePack: {
        shareState: "ready",
        sharingBoundary: "approved_circle",
        clientHighlights: [],
        careCircleHighlights: [],
        todayFocus: [],
      },
      audienceBriefings: {
        responseWindow: "same_day",
        sharingBoundary: "approved_circle",
        elderLines: ["Stay near the usual routine today."],
        careCircleLines: ["Keep watch for further dizziness."],
        staffItems: [],
      },
      nextConfirmations: [
        {
          code: "confirm-today-touchpoint",
          text: "Make a same-day touchpoint with Carmen.",
        },
      ],
      confirmationStatuses: [
        {
          code: "confirm-today-touchpoint",
          text: "Make a same-day touchpoint with Carmen.",
          priority: "high",
          dueWindow: "same_day",
          timestamp: "2026-06-19T09:50:00.000Z",
          author: "mila@redcross.example",
          confirmed: true,
          confirmedAt: "2026-06-19T09:50:00.000Z",
          confirmedBy: "mila@redcross.example",
        },
      ],
      openQuestions: [],
    });

    expect(bridge?.realityState).toBe("fresh");
    expect(bridge?.confirmNow).toHaveLength(0);
    expect(bridge?.summaryText).toContain("covered");
  });
});
