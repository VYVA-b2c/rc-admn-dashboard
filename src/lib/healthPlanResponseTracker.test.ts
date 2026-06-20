import { describe, expect, it } from "vitest";

import { deriveHealthPlanResponseTracker } from "@/lib/healthPlanResponseTracker";

describe("deriveHealthPlanResponseTracker", () => {
  it("marks same-day gaps as urgent until the loop is closed", () => {
    const tracker = deriveHealthPlanResponseTracker({
      healthPlan: {
        id: "hp-1",
        review_status: "draft",
        quality: { recommended_action: "review" },
      },
      handoff: {
        priority: "high",
        responseWindow: "same_day",
        sharingBoundary: "staff_only",
        ownerName: null,
        ownerMissing: true,
        careCircleCount: 0,
        activeAlertCount: 1,
        offlineSensorCount: 1,
        missedMedication: true,
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
      sharePack: {
        shareState: "hold",
        sharingBoundary: "staff_only",
        clientHighlights: [],
        careCircleHighlights: [],
        todayFocus: [],
      },
    });

    expect(tracker?.state).toBe("urgent");
    expect(tracker?.responseWindow).toBe("same_day");
    expect(tracker?.nextStepCode).toBe("review_plan");
    expect(tracker?.steps.map((step) => [step.code, step.state])).toEqual([
      ["review_plan", "pending"],
      ["assign_owner", "pending"],
      ["contact_client", "pending"],
      ["close_loop", "pending"],
    ]);
    expect(tracker?.steps.find((step) => step.code === "review_plan")?.proofHint).toContain("reviewed plan");
    expect(tracker?.steps.find((step) => step.code === "close_loop")?.proofHint).toContain("resolved");
  });

  it("settles into stable once review, ownership, outreach, and care-circle updates are covered", () => {
    const tracker = deriveHealthPlanResponseTracker({
      healthPlan: {
        id: "hp-2",
        review_status: "reviewed",
        quality: { recommended_action: "share" },
      },
      handoff: {
        priority: "medium",
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
        escalationClosed: false,
        completedCount: 2,
      },
      outreachStatus: {
        clientShared: true,
        careCircleShared: true,
        latestClientShare: null,
        latestCareCircleShare: null,
      },
      sharePack: {
        shareState: "ready",
        sharingBoundary: "approved_circle",
        clientHighlights: [],
        careCircleHighlights: [],
        todayFocus: [],
      },
    });

    expect(tracker?.state).toBe("stable");
    expect(tracker?.completedCount).toBe(tracker?.totalCount);
    expect(tracker?.nextStepCode).toBeNull();
    expect(tracker?.steps.every((step) => typeof step.proofHint === "string" && step.proofHint.length > 0)).toBe(true);
  });
});
