import { describe, expect, it } from "vitest";

import { deriveHealthPlanSafetySnapshot } from "@/lib/healthPlanSafetySnapshot";

describe("deriveHealthPlanSafetySnapshot", () => {
  it("prioritizes same-day safety follow-through for urgent clients", () => {
    const snapshot = deriveHealthPlanSafetySnapshot({
      healthPlan: {
        review_status: "draft",
        quality: { recommended_action: "review" },
        daily_support_json: [
          { text: "Confirm hydration and breakfast today.", source_signal_ids: ["alert-active"] },
          { text: "Keep the morning medication routine visible.", source_signal_ids: ["medication-plan"] },
        ],
        goals_json: [
          { text: "Stabilize the day with one calm touchpoint.", source_signal_ids: ["risk-latest-score"] },
        ],
        escalation_json: [
          { text: "Escalate immediately if dizziness worsens or Carmen cannot be reached.", source_signal_ids: ["risk-latest-score"] },
        ],
        source_signals_json: [
          { id: "risk-latest-score", strength: "high" },
          { id: "alert-active", strength: "high" },
          { id: "medication-plan", strength: "high" },
        ],
      },
      handoff: {
        priority: "high",
        responseWindow: "same_day",
        sharingBoundary: "approved_circle",
        ownerName: null,
        ownerMissing: true,
        careCircleCount: 2,
        activeAlertCount: 2,
        offlineSensorCount: 0,
        missedMedication: true,
        highRisk: true,
        actions: [
          { code: "confirm_today_touchpoint", tone: "high" },
          { code: "review_alerts", tone: "high" },
          { code: "assign_owner", tone: "high" },
        ],
      },
      sharePack: {
        shareState: "review",
        sharingBoundary: "approved_circle",
        clientHighlights: [],
        careCircleHighlights: [],
        todayFocus: [
          "Confirm hydration and breakfast today.",
          "Keep the morning medication routine visible.",
        ],
      },
      alerts: [{ id: "a1" }, { id: "a2" }],
    });

    expect(snapshot?.state).toBe("urgent");
    expect(snapshot?.responseWindow).toBe("same_day");
    expect(snapshot?.elderToday).toEqual([
      "Confirm hydration and breakfast today.",
      "Keep the morning medication routine visible.",
    ]);
    expect(snapshot?.careCircleNow).toEqual([
      "confirm_today_touchpoint",
      "review_alerts",
      "assign_owner",
    ]);
    expect(snapshot?.elderMessage).toContain("Please stay reachable today");
    expect(snapshot?.careCircleMessage).toContain("Urgent update for the approved care circle");
    expect(snapshot?.redFlags).toEqual([
      { kind: "system", code: "active_alerts" },
      { kind: "system", code: "missed_medication" },
      { kind: "plan", text: "Escalate immediately if dizziness worsens or Carmen cannot be reached." },
    ]);
  });

  it("falls back to plan sections when no share pack exists", () => {
    const snapshot = deriveHealthPlanSafetySnapshot({
      healthPlan: {
        review_status: "reviewed",
        quality: { recommended_action: "share" },
        daily_support_json: [
          { text: "Keep lunch and water within easy reach.", source_signal_ids: ["context-live-profile-only"] },
        ],
        goals_json: [
          { text: "Keep the daily routine calm and familiar.", source_signal_ids: ["care-circle-context"] },
        ],
        escalation_json: [],
        source_signals_json: [
          { id: "context-live-profile-only", strength: "medium" },
          { id: "care-circle-context", strength: "low" },
        ],
      },
      handoff: {
        priority: "low",
        responseWindow: "within_24h",
        sharingBoundary: "approved_circle",
        ownerName: "Ana Novak",
        ownerMissing: false,
        careCircleCount: 1,
        activeAlertCount: 0,
        offlineSensorCount: 0,
        missedMedication: false,
        highRisk: false,
        actions: [{ code: "maintain_routine", tone: "low" }],
      },
      alerts: [],
    });

    expect(snapshot?.state).toBe("stable");
    expect(snapshot?.elderToday).toEqual([
      "Keep lunch and water within easy reach.",
      "Keep the daily routine calm and familiar.",
    ]);
    expect(snapshot?.careCircleNow).toEqual(["maintain_routine"]);
    expect(snapshot?.careCircleMessage).toContain("approved care circle");
    expect(snapshot?.redFlags).toEqual([]);
  });

  it("keeps sensor reliability visible even when other risk is moderate", () => {
    const snapshot = deriveHealthPlanSafetySnapshot({
      healthPlan: {
        review_status: "draft",
        quality: { recommended_action: "review" },
        daily_support_json: [{ text: "Keep tonight's check-in visible.", source_signal_ids: ["service-checkins"] }],
        goals_json: [],
        escalation_json: [
          { text: "Escalate if there is still no response after the scheduled touchpoint.", source_signal_ids: ["service-checkins"] },
        ],
        source_signals_json: [{ id: "service-checkins", strength: "medium" }],
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
        missedMedication: false,
        highRisk: false,
        actions: [{ code: "check_sensors", tone: "medium" }],
      },
      alerts: [],
    });

    expect(snapshot?.state).toBe("watch");
    expect(snapshot?.sharingBoundary).toBe("staff_only");
    expect(snapshot?.careCircleNow).toEqual(["check_sensors"]);
    expect(snapshot?.careCircleMessage).toBeNull();
    expect(snapshot?.redFlags[0]).toEqual({ kind: "system", code: "sensor_reliability" });
  });

  it("keeps copied safety messages localized even if plan highlights are in another language", () => {
    const snapshot = deriveHealthPlanSafetySnapshot({
      healthPlan: {
        language: "es",
        review_status: "reviewed",
        quality: { recommended_action: "share" },
        daily_support_json: [
          { text: "Keep the daily check-in active at the current morning time and ask first about dizziness and hydration.", source_signal_ids: ["alert-active"] },
        ],
        goals_json: [],
        escalation_json: [],
        source_signals_json: [{ id: "alert-active", strength: "high" }],
      },
      handoff: {
        priority: "high",
        responseWindow: "same_day",
        sharingBoundary: "approved_circle",
        ownerName: "Maria Garcia",
        ownerMissing: false,
        careCircleCount: 1,
        activeAlertCount: 1,
        offlineSensorCount: 0,
        missedMedication: true,
        highRisk: true,
        actions: [{ code: "confirm_today_touchpoint", tone: "high" }],
      },
      sharePack: {
        shareState: "ready",
        sharingBoundary: "approved_circle",
        clientHighlights: [],
        careCircleHighlights: [],
        todayFocus: ["Keep the daily check-in active at the current morning time and ask first about dizziness and hydration."],
      },
      alerts: [{ id: "a1" }],
    });

    expect(snapshot?.elderMessage).toContain("Confirmar hoy");
    expect(snapshot?.elderMessage).not.toContain("Keep the daily check-in active");
  });
});
