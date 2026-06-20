import { describe, expect, it } from "vitest";

import { deriveHealthPlanAudienceBriefingsPack } from "@/lib/healthPlanAudienceBriefings";

describe("deriveHealthPlanAudienceBriefingsPack", () => {
  it("prioritizes concrete staff confirmations before broader talking points", () => {
    const pack = deriveHealthPlanAudienceBriefingsPack({
      communicationPack: {
        state: "review",
        clientScript: [
          "Keep the morning check-in steady and use simple reassurance.",
        ],
        careCircleScript: [
          "Help reinforce hydration and the medication routine today.",
        ],
        staffGuardrails: ["same_day_tone"],
      },
      sharePack: {
        shareState: "review",
        sharingBoundary: "approved_circle",
        clientHighlights: [],
        careCircleHighlights: [],
        todayFocus: [
          "Review active alerts on the same day they appear.",
        ],
      },
      nextConfirmations: [
        {
          text: "Confirm a fresh touchpoint today so the plan is based on the client's current reality.",
          due_window: "same_day",
          priority: "high",
        },
      ],
      openQuestions: [
        {
          text: "Confirm whether the named follow-up owner is still the right person for today's case.",
          due_window: "same_day",
          priority: "high",
        },
      ],
      responseWindow: "same_day",
    });

    expect(pack?.elderLines[0]).toContain("morning check-in");
    expect(pack?.careCircleLines[0]).toContain("hydration");
    expect(pack?.staffItems[0]?.text).toContain("fresh touchpoint today");
    expect(pack?.staffItems[0]?.dueWindow).toBe("same_day");
  });

  it("keeps care-circle lines empty when the sharing boundary is staff-only", () => {
    const pack = deriveHealthPlanAudienceBriefingsPack({
      communicationPack: {
        state: "hold",
        clientScript: [
          "Stay calm and keep the next contact close at hand.",
        ],
        careCircleScript: [],
        staffGuardrails: ["hold_staff_only", "protect_family_boundary"],
      },
      sharePack: {
        shareState: "hold",
        sharingBoundary: "staff_only",
        clientHighlights: [],
        careCircleHighlights: [],
        todayFocus: [
          "Review active alerts on the same day they appear.",
        ],
      },
      nextConfirmations: [],
      openQuestions: [],
      responseWindow: "same_day",
    });

    expect(pack?.careCircleLines).toEqual([]);
    expect(pack?.staffItems[0]?.text).toContain("Review active alerts");
    expect(pack?.responseWindow).toBe("same_day");
  });
});
