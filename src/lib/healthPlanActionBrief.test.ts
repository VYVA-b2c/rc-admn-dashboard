import { describe, expect, it } from "vitest";

import { deriveHealthPlanActionBrief } from "@/lib/healthPlanActionBrief";

describe("deriveHealthPlanActionBrief", () => {
  it("builds a cross-audience brief from open coordination, communication, and playbook context", () => {
    const brief = deriveHealthPlanActionBrief({
      healthPlan: {
        id: "hp-1",
        generated_at: "2026-06-18T10:00:00.000Z",
        monitoring_json: [{ id: "m1", text: "Monitor hydration and response quality through today." }],
      },
      coordination: {
        state: "urgent",
        response_window: "same_day",
        sharing_boundary: "approved_circle",
        recommended_action_code: "assign_owner",
        commitments: [
          {
            code: "assign_owner",
            status: "open",
            priority: "high",
            due_window: "same_day",
            detail: "One named owner should be confirmed before the next follow-up cycle.",
            proof_hint: "Counts as done when one named owner is linked on the profile or clearly named in the saved plan guidance.",
          },
          {
            code: "contact_client",
            status: "open",
            priority: "high",
            due_window: "same_day",
            detail: "The plan should make the client touchpoint and response timing explicit.",
            proof_hint: "Counts as done when the first same-day client touchpoint is recorded.",
          },
        ],
      },
      responseTracker: {
        state: "urgent",
        responseWindow: "same_day",
        completedCount: 0,
        totalCount: 4,
        nextStepCode: "review_plan",
        steps: [
          {
            code: "review_plan",
            state: "pending",
            priority: "high",
            proofHint: "Counts as done when a reviewed plan is saved and no regeneration warning is active.",
          },
        ],
      },
      accountability: {
        state: "urgent",
        movementState: "quiet",
        responseWindow: "same_day",
        pendingCount: 3,
        pendingHighCount: 2,
        stalled: false,
        staleAfterHours: 3,
        lastMovementAt: null,
        lastMovementBy: null,
        lastMovementCode: null,
        summaryText: "Open movement remains.",
        receipts: [
          { code: "owner_assigned", status: "pending", priority: "high" },
          { code: "first_contact_made", status: "pending", priority: "high" },
        ],
      },
      sharePack: {
        shareState: "review",
        sharingBoundary: "approved_circle",
        clientHighlights: ["Keep today's support steady and easy to follow."],
        careCircleHighlights: ["Share one practical update once the first client check lands."],
        todayFocus: ["Keep the next touchpoint calm and close in time."],
      },
      communicationPack: {
        state: "review",
        clientScript: ["We will stay close to today's follow-up and keep the next step clear."],
        careCircleScript: ["Please help keep same-day follow-up close and report meaningful changes quickly."],
        staffGuardrails: ["review_before_share"],
      },
      incidentPlaybooks: [
        {
          code: "urgent_welfare_check",
          priority: "high",
          responseWindow: "same_day",
          triggerReason: "Same-day risk signals are active.",
          clientSteps: ["Reach the elder directly and confirm safety, hydration, and whether someone is nearby."],
          teamSteps: ["Assign one named owner before the next outreach attempt."],
          closeWhen: ["A real client touchpoint is logged."],
          actionCode: "contact_client",
        },
      ],
      now: new Date("2026-06-18T12:40:00.000Z"),
    });

    expect(brief?.state).toBe("urgent");
    expect(brief?.responseWindow).toBe("same_day");
    expect(brief?.staffNow[0]).toContain("named owner");
    expect(brief?.elderNow[0]).toContain("safety");
    expect(brief?.careCircleNow[0]).toContain("same-day follow-up");
    expect(brief?.successChecks[0]).toContain("Counts as done");
    expect(brief?.quickActions).toEqual(["review_plan", "update_care_circle"]);
    expect(brief?.receiptActions).toEqual(["owner_assigned", "first_contact_made"]);
    expect(brief?.movementState).toBe("quiet");
    expect(brief?.movementSummary).toContain("Open movement");
    expect(brief?.blockedReceiptCodes).toEqual(["owner_assigned", "first_contact_made"]);
    expect(brief?.minutesSinceMovement).toBe(160);
    expect(brief?.minutesUntilStale).toBe(20);
    expect(brief?.minutesOverdue).toBe(0);
  });

  it("withholds care-circle guidance when the sharing boundary is staff-only", () => {
    const brief = deriveHealthPlanActionBrief({
      healthPlan: { id: "hp-2" },
      coordination: {
        state: "watch",
        response_window: "within_24h",
        sharing_boundary: "staff_only",
        commitments: [],
      },
      responseTracker: {
        state: "watch",
        responseWindow: "within_24h",
        completedCount: 1,
        totalCount: 2,
        nextStepCode: "contact_client",
        steps: [
          {
            code: "contact_client",
            state: "pending",
            priority: "medium",
            proofHint: "Counts as done when the first client touchpoint is recorded.",
          },
        ],
      },
      accountability: {
        state: "watch",
        movementState: "stalled",
        responseWindow: "within_24h",
        pendingCount: 1,
        pendingHighCount: 0,
        stalled: true,
        staleAfterHours: 12,
        lastMovementAt: "2026-06-18T00:00:00.000Z",
        lastMovementBy: "Ana Novak",
        lastMovementCode: "client_brief_shared",
        summaryText: "Still open.",
        receipts: [{ code: "client_brief_shared", status: "pending", priority: "medium" }],
      },
      sharePack: {
        shareState: "hold",
        sharingBoundary: "staff_only",
        clientHighlights: ["Keep the elder oriented to the next simple step."],
        careCircleHighlights: ["Should not appear."],
        todayFocus: ["Use staff-only follow-up until consent is confirmed."],
      },
      communicationPack: {
        state: "hold",
        clientScript: ["We will keep today's next step simple and calm."],
        careCircleScript: ["Should not appear."],
        staffGuardrails: ["hold_staff_only"],
      },
      incidentPlaybooks: [],
      now: new Date("2026-06-18T12:40:00.000Z"),
    });

    expect(brief?.staffOnlyBoundary).toBe(true);
    expect(brief?.careCircleNow).toEqual([]);
    expect(brief?.elderNow[0]).toContain("simple");
    expect(brief?.quickActions).toEqual(["contact_client"]);
    expect(brief?.receiptActions).toEqual(["client_brief_shared"]);
    expect(brief?.blockedReceiptCodes).toEqual([]);
    expect(brief?.minutesSinceMovement).toBe(760);
    expect(brief?.minutesUntilStale).toBe(0);
    expect(brief?.minutesOverdue).toBe(40);
  });
});
