import { describe, expect, it } from "vitest";

import {
  buildHealthPlanInterventionMemory,
  buildHealthPlanInterventionMemoryBrief,
} from "./healthPlanInterventionMemory.js";

describe("health plan intervention memory", () => {
  const plan = {
    goals_json: [{ text: "Keep routines steady.", source_signal_ids: ["signal-risk"] }],
    daily_support_json: [{ text: "Keep the daily support rhythm predictable.", source_signal_ids: ["signal-checkin"] }],
    monitoring_json: [{ text: "Watch for missed medications or higher risk.", source_signal_ids: ["signal-med"] }],
    escalation_json: [{ text: "Escalate if unresolved alerts appear.", source_signal_ids: ["signal-alert"] }],
    caregiver_guidance_json: [{ text: "Keep family updates practical.", source_signal_ids: ["signal-caregiver"] }],
  };

  it("marks routines as helping when fresh positive evidence exists", () => {
    const memory = buildHealthPlanInterventionMemory({
      plan,
      followThrough: {
        positive_signals: [
          { id: "checkin-since-plan", label: "Fresh check-in evidence", detail: "A check-in outcome has been recorded since this plan was generated." },
        ],
      },
    });

    expect(memory.find((item) => item.id === "daily-support-routine")).toMatchObject({
      status: "helping",
    });
  });

  it("marks monitoring and escalation as fragile when caution signals and drift are present", () => {
    const memory = buildHealthPlanInterventionMemory({
      plan,
      followThrough: {
        caution_signals: [
          { id: "risk-worsened", label: "Risk score has increased since plan generation", detail: "The latest predictive score is higher than before." },
          { id: "new-alerts-since-plan", label: "New unresolved alerts since plan generation", detail: "Two unresolved alerts appeared after the plan was generated." },
        ],
      },
      sectionDrift: [
        { section_key: "monitoring_json", status: "needs_refresh", reasons: ["Monitoring guidance no longer matches the newest risk picture."] },
        { section_key: "escalation_json", status: "needs_refresh", reasons: ["Escalation signs should be checked against unresolved alerts."] },
      ],
    });

    expect(memory.find((item) => item.id === "monitoring-watch")).toMatchObject({
      status: "fragile",
    });
    expect(memory.find((item) => item.id === "escalation-response")).toMatchObject({
      status: "fragile",
    });
  });

  it("keeps recently confirmed routines as unproven until fresh outcomes arrive", () => {
    const memory = buildHealthPlanInterventionMemory({
      plan,
      completedActions: [
        {
          action_id: "improve-medication-timing",
          title: "Confirm medication reminder times",
          section_key: "daily_support_json",
        },
      ],
    });

    expect(memory.find((item) => item.id === "daily-support-routine")).toMatchObject({
      status: "unproven",
    });
  });

  it("builds a compact brief for prompt input", () => {
    const memory = buildHealthPlanInterventionMemory({
      plan,
      dataQualityGaps: [{ id: "profile-context-gap", label: "Daily-life context is thin", detail: "The living context is still sparse." }],
    });
    const brief = buildHealthPlanInterventionMemoryBrief(memory);

    expect(brief[0]).toHaveProperty("label");
    expect(brief[0]).toHaveProperty("status");
    expect(Array.isArray(brief[0]?.section_labels)).toBe(true);
  });
});
