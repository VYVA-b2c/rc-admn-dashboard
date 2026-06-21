import { describe, expect, it } from "vitest";

import {
  buildHealthPlanClinicalCautions,
  findHealthPlanClinicalCautionIssues,
} from "./healthPlanClinicalCautions.js";

describe("health plan clinical cautions", () => {
  it("detects reachability, medication, and mobility caution patterns from source signals", () => {
    const cautions = buildHealthPlanClinicalCautions({
      sourceSignals: [
        { id: "alert-active", label: "2 active alerts", detail: "Client unreachable this morning", category: "alert", strength: "high" },
        { id: "service-checkins", label: "Check-ins", detail: "Enabled · pending · Last outcome missed", category: "service", strength: "high" },
        { id: "medication-plan", label: "2 medications on file", detail: "Latest adherence missed", category: "medication", strength: "high" },
        { id: "context-live-profile", label: "Profile context", detail: "Living context alone · walker support · dizziness episodes", category: "context", strength: "medium" },
      ],
      followThrough: {
        caution_signals: [{ id: "no-fresh-touchpoints", label: "No fresh touchpoints" }],
      },
    });

    expect(cautions.map((item) => item.id)).toEqual(expect.arrayContaining([
      "reachability-risk",
      "medication-instability",
      "mobility-fall-risk",
    ]));
  });

  it("flags plans that miss the clinical response for those cautions", () => {
    const sourceSignals = [
      { id: "alert-active", label: "2 active alerts", detail: "Client unreachable this morning", category: "alert", strength: "high" },
      { id: "service-checkins", label: "Check-ins", detail: "Enabled · pending · Last outcome missed", category: "service", strength: "high" },
      { id: "medication-plan", label: "2 medications on file", detail: "Latest adherence missed", category: "medication", strength: "high" },
      { id: "context-live-profile", label: "Profile context", detail: "Living context alone · walker support · dizziness episodes", category: "context", strength: "medium" },
    ];

    const issues = findHealthPlanClinicalCautionIssues({
      summary_text: "Support remains steady overall.",
      summary_signal_ids: ["alert-active"],
      goals_json: [],
      daily_support_json: [{ text: "Keep routines steady as usual.", source_signal_ids: ["context-live-profile"] }],
      monitoring_json: [{ text: "Review weekly.", source_signal_ids: ["service-checkins"], timing: "ongoing" }],
      escalation_json: [{ text: "Escalate if needed.", source_signal_ids: ["alert-active"], timing: "ongoing" }],
      caregiver_guidance_json: [],
    }, {
      sourceSignals,
      followThrough: {
        caution_signals: [{ id: "no-fresh-touchpoints", label: "No fresh touchpoints" }],
      },
    });

    expect(issues.map((item) => item.id)).toEqual(expect.arrayContaining([
      "reachability-risk",
      "medication-instability",
      "mobility-fall-risk",
    ]));
    expect(issues.map((item) => item.section_key)).toEqual(expect.arrayContaining([
      "summary",
      "monitoring_json",
      "daily_support_json",
    ]));
  });
});
