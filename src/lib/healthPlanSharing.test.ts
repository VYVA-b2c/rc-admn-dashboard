import { describe, expect, it } from "vitest";

import { deriveHealthPlanShareAccess, deriveHealthPlanSharePack } from "@/lib/healthPlanSharing";

describe("deriveHealthPlanSharePack", () => {
  const plan = {
    review_status: "reviewed" as const,
    summary_text: "Carmen should keep a calm routine this week. Watch for any change in dizziness.",
    daily_support_json: [
      { text: "Keep the daily check-in active at the usual morning time." },
      { text: "Use short, clear medication reminders and confirm the morning dose." },
    ],
    monitoring_json: [
      { text: "Review active alerts on the same day they appear." },
      { text: "Check whether any sensor stops reporting." },
    ],
    goals_json: [
      { text: "Keep Carmen safe and steady at home this week." },
    ],
    escalation_json: [
      { text: "Escalate if dizziness becomes more frequent or she cannot be reached." },
    ],
    caregiver_guidance_json: [
      { text: "Share a short update with the approved care circle after significant changes." },
      { text: "Ask the care circle to help reinforce hydration and the medication routine." },
    ],
    quality: {
      recommended_action: "share" as const,
    },
  };

  it("builds a share-ready brief when the plan is reviewed and consent is confirmed", () => {
    const pack = deriveHealthPlanSharePack(
      {
        consent: { caretaker_consent: true, consent_given: true },
        healthPlan: plan,
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
        actions: [
          { code: "confirm_today_touchpoint", tone: "high" },
          { code: "verify_medication", tone: "high" },
        ],
      },
    );

    expect(pack?.shareState).toBe("ready");
    expect(pack?.sharingBoundary).toBe("approved_circle");
    expect(pack?.clientHighlights[0]).toContain("Carmen should keep a calm routine");
    expect(pack?.careCircleHighlights).toHaveLength(3);
    expect(pack?.todayFocus.some((item) => /medication/i.test(item))).toBe(true);
  });

  it("holds back care-circle sharing when consent is not confirmed or regeneration is needed", () => {
    const pack = deriveHealthPlanSharePack(
      {
        consent: { caretaker_consent: false, consent_given: false },
        healthPlan: {
          ...plan,
          review_status: "draft",
          quality: { recommended_action: "regenerate" as const },
        },
      },
      null,
    );

    expect(pack?.shareState).toBe("hold");
    expect(pack?.sharingBoundary).toBe("staff_only");
    expect(pack?.careCircleHighlights).toHaveLength(0);
    expect(pack?.clientHighlights).toHaveLength(3);
  });

  it("only unlocks external sharing when the plan is ready and consent allows it", () => {
    const readyPack = deriveHealthPlanSharePack(
      {
        consent: { caretaker_consent: true, consent_given: true },
        healthPlan: plan,
      },
      null,
    );
    const readyAccess = deriveHealthPlanShareAccess(readyPack);
    expect(readyAccess.canShareWithClient).toBe(true);
    expect(readyAccess.canShareWithCareCircle).toBe(true);
    expect(readyAccess.clientBlockedReason).toBeNull();
    expect(readyAccess.careCircleBlockedReason).toBeNull();

    const reviewAccess = deriveHealthPlanShareAccess({
      ...readyPack!,
      shareState: "review",
    });
    expect(reviewAccess.canShareWithClient).toBe(false);
    expect(reviewAccess.canShareWithCareCircle).toBe(false);
    expect(reviewAccess.clientBlockedReason).toBe("review_required");
    expect(reviewAccess.careCircleBlockedReason).toBe("review_required");

    const consentBlockedAccess = deriveHealthPlanShareAccess({
      ...readyPack!,
      sharingBoundary: "staff_only",
    });
    expect(consentBlockedAccess.canShareWithClient).toBe(true);
    expect(consentBlockedAccess.canShareWithCareCircle).toBe(false);
    expect(consentBlockedAccess.clientBlockedReason).toBeNull();
    expect(consentBlockedAccess.careCircleBlockedReason).toBe("consent_required");
  });
});
