import { describe, expect, it } from "vitest";

import { enrichHealthPlanSectionItems, enrichHealthPlanSections } from "./healthPlanRecommendationMetadata.js";

describe("health plan recommendation metadata", () => {
  const sourceSignals = [
    { id: "risk-latest-score", label: "Predictive risk score 82 (high)", category: "risk", strength: "high" },
    { id: "alert-active", label: "2 active alerts", category: "alert", strength: "high" },
    { id: "service-checkins", label: "Check-ins", detail: "Enabled daily", category: "service", strength: "medium" },
    { id: "care-circle-context", label: "Care circle context", detail: "Care provider assignment recorded", category: "care-circle", strength: "medium" },
  ];

  const signalTriage = {
    action_signal_ids: ["risk-latest-score", "alert-active"],
    verification_signal_ids: ["alert-active"],
    stabilizing_signal_ids: ["service-checkins", "care-circle-context"],
    caution_signal_ids: [],
  };

  it("raises escalation items to act-today, high-priority recommendations when action signals are linked", () => {
    const [item] = enrichHealthPlanSectionItems(
      [{ id: "escalation-1", text: "Escalate if Carmen cannot be reached after repeated alerts.", source_signal_ids: ["alert-active", "risk-latest-score"] }],
      { sectionKey: "escalation_json", sourceSignals, signalTriage },
    );

    expect(item.priority).toBe("high");
    expect(item.confidence).toBe("high");
    expect(item.timing).toBe("today");
    expect(item.verification_required).toBe(true);
    expect(item.completion_signal).toMatch(/close the loop/i);
    expect(item.owner_role).toBe("on_call_coordinator");
    expect(item.fallback_owner_role).toBe("on_call_coordinator");
  });

  it("keeps stabilizing daily support recommendations ongoing instead of over-escalating them", () => {
    const [item] = enrichHealthPlanSectionItems(
      [{ id: "daily-1", text: "Keep the daily check-in at the current morning time.", source_signal_ids: ["service-checkins", "care-circle-context"] }],
      { sectionKey: "daily_support_json", sourceSignals, signalTriage },
    );

    expect(item.priority).toBe("medium");
    expect(item.confidence).toBe("high");
    expect(item.timing).toBe("ongoing");
    expect(item.verification_required).toBe(false);
    expect(item.completion_signal).toMatch(/review/i);
    expect(item.owner_role).toBe("caregiver");
  });

  it("preserves valid manual metadata overrides while enriching the rest of the sections", () => {
    const sections = enrichHealthPlanSections(
      {
        goals_json: [
          {
            id: "goal-1",
            text: "Keep daily routines stable this week.",
            source_signal_ids: ["service-checkins"],
            priority: "low",
            confidence: "medium",
            timing: "this_week",
          },
        ],
        monitoring_json: [
          {
            id: "monitor-1",
            text: "Review alert patterns daily.",
            source_signal_ids: ["alert-active"],
          },
        ],
      },
      { sourceSignals, signalTriage },
    );

    expect(sections.goals_json[0]).toMatchObject({
      priority: "low",
      confidence: "medium",
      timing: "this_week",
    });
    expect(sections.monitoring_json[0]).toMatchObject({
      priority: "high",
      confidence: "medium",
      timing: "today",
      verification_required: true,
      completion_signal: expect.stringMatching(/record/i),
      owner_role: "assigned_staff",
      fallback_owner_role: "assigned_staff",
    });
  });

  it("preserves valid manual owner-role overrides", () => {
    const [item] = enrichHealthPlanSectionItems(
      [{
        id: "caregiver-1",
        text: "Ask the care circle to confirm the evening check-in today.",
        source_signal_ids: ["care-circle-context"],
        owner_role: "care_team",
      }],
      { sectionKey: "caregiver_guidance_json", sourceSignals, signalTriage },
    );

    expect(item.owner_role).toBe("care_team");
  });

  it("preserves valid manual completion-signal overrides", () => {
    const [item] = enrichHealthPlanSectionItems(
      [{
        id: "monitor-1",
        text: "Confirm whether the alert was a true missed contact.",
        source_signal_ids: ["alert-active"],
        completion_signal: "Close the loop once the missed contact is either confirmed or dismissed in the activity log.",
      }],
      { sectionKey: "monitoring_json", sourceSignals, signalTriage },
    );

    expect(item.completion_signal).toMatch(/activity log/i);
  });
});
