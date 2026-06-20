import { describe, expect, it } from "vitest";

import { deriveHealthPlanAccountability } from "@/lib/healthPlanAccountability";

describe("deriveHealthPlanAccountability", () => {
  it("flags a same-day plan as urgent when high-priority follow-through is still missing and stale", () => {
    const accountability = deriveHealthPlanAccountability({
      healthPlan: {
        id: "hp-1",
        review_status: "reviewed",
        reviewed_at: "2026-06-18T08:00:00.000Z",
        generated_at: "2026-06-18T07:00:00.000Z",
      },
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
      progress: {
        ownerAssigned: false,
        firstContactMade: false,
        escalationClosed: false,
        completedCount: 0,
      },
      handoffNotes: [],
      handoffStatusEntries: [],
      outreachStatus: {
        clientShared: false,
        careCircleShared: false,
        latestClientShare: null,
        latestCareCircleShare: null,
      },
      outreachEntries: [],
      sharePack: {
        shareState: "review",
        sharingBoundary: "staff_only",
        clientHighlights: [],
        careCircleHighlights: [],
        todayFocus: [],
      },
      now: new Date("2026-06-18T12:30:00.000Z"),
    });

    expect(accountability?.state).toBe("urgent");
    expect(accountability?.stalled).toBe(true);
    expect(accountability?.movementState).toBe("stalled");
    expect(accountability?.pendingHighCount).toBeGreaterThan(0);
    expect(accountability?.receipts.find((item) => item.code === "owner_assigned")?.status).toBe("pending");
    expect(accountability?.receipts.find((item) => item.code === "first_contact_made")?.status).toBe("pending");
  });

  it("settles into stable once the core operational receipts are recorded", () => {
    const accountability = deriveHealthPlanAccountability({
      healthPlan: {
        id: "hp-2",
        review_status: "reviewed",
        reviewed_at: "2026-06-18T08:00:00.000Z",
        generated_at: "2026-06-18T07:00:00.000Z",
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
        missedMedication: true,
        highRisk: true,
        actions: [{ code: "review_alerts", tone: "high" }],
      },
      progress: {
        ownerAssigned: true,
        firstContactMade: true,
        escalationClosed: true,
        completedCount: 3,
      },
      handoffNotes: [{ timestamp: "2026-06-18T08:30:00.000Z", author: "ana@redcross.example", handoff: {} as never }],
      handoffStatusEntries: [
        { timestamp: "2026-06-18T08:45:00.000Z", author: "ana@redcross.example", status: "owner_assigned", ownerName: "Ana Novak", responseWindow: "same_day" },
        { timestamp: "2026-06-18T09:10:00.000Z", author: "ana@redcross.example", status: "first_contact_made", ownerName: "Ana Novak", responseWindow: "same_day" },
        { timestamp: "2026-06-18T10:20:00.000Z", author: "ana@redcross.example", status: "escalation_closed", ownerName: "Ana Novak", responseWindow: "same_day" },
      ],
      outreachStatus: {
        clientShared: true,
        careCircleShared: true,
        latestClientShare: { timestamp: "2026-06-18T09:20:00.000Z", author: "ana@redcross.example", audience: "client", channel: "phone", state: "ready" },
        latestCareCircleShare: { timestamp: "2026-06-18T09:40:00.000Z", author: "ana@redcross.example", audience: "care_circle", channel: "whatsapp", state: "ready" },
      },
      outreachEntries: [],
      sharePack: {
        shareState: "ready",
        sharingBoundary: "approved_circle",
        clientHighlights: [],
        careCircleHighlights: [],
        todayFocus: [],
      },
      now: new Date("2026-06-18T10:30:00.000Z"),
    });

    expect(accountability?.state).toBe("stable");
    expect(accountability?.stalled).toBe(false);
    expect(accountability?.pendingCount).toBe(0);
    expect(accountability?.lastMovementCode).toBe("loop_closed");
    expect(accountability?.receipts.find((item) => item.code === "care_circle_brief_shared")?.status).toBe("done");
  });

  it("keeps care-circle sharing out of the required receipts when the sharing boundary is staff-only", () => {
    const accountability = deriveHealthPlanAccountability({
      healthPlan: {
        id: "hp-3",
        review_status: "reviewed",
        reviewed_at: "2026-06-18T08:00:00.000Z",
      },
      handoff: {
        priority: "medium",
        responseWindow: "within_24h",
        sharingBoundary: "staff_only",
        ownerName: "Mila Weber",
        ownerMissing: false,
        careCircleCount: 1,
        activeAlertCount: 0,
        offlineSensorCount: 0,
        missedMedication: false,
        highRisk: false,
        actions: [{ code: "maintain_routine", tone: "low" }],
      },
      progress: {
        ownerAssigned: true,
        firstContactMade: true,
        escalationClosed: false,
        completedCount: 2,
      },
      handoffNotes: [],
      handoffStatusEntries: [],
      outreachStatus: {
        clientShared: false,
        careCircleShared: false,
        latestClientShare: null,
        latestCareCircleShare: null,
      },
      outreachEntries: [],
      sharePack: {
        shareState: "hold",
        sharingBoundary: "staff_only",
        clientHighlights: [],
        careCircleHighlights: [],
        todayFocus: [],
      },
      now: new Date("2026-06-18T09:00:00.000Z"),
    });

    expect(accountability?.receipts.find((item) => item.code === "client_brief_shared")?.status).toBe("not_needed");
    expect(accountability?.receipts.find((item) => item.code === "care_circle_brief_shared")?.status).toBe("not_needed");
  });
});
