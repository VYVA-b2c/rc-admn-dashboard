import { describe, expect, it } from "vitest";

import { repairOperationalMonitoringLanguage } from "./healthPlanMonitoringRepair";
import { findHealthPlanCoverageIssues } from "./healthPlanCoverageRules";
import { buildHealthPlanEscalationGrade, findHealthPlanEscalationGradeIssues } from "./healthPlanEscalationGrade";
import { findHealthPlanSafetyIssues } from "./healthPlanSafetyReview";

describe("healthPlanMonitoringRepair", () => {
  it("makes hot monitoring guidance explicit without weakening safety review", () => {
    const sourceSignals = [
      { id: "medication-plan", label: "Medication adherence concern", strength: "high" },
    ];
    const signalTriage = {
      verification_signal_ids: ["medication-plan"],
    };
    const plan = {
      summary_text: "Medication confidence needs review.",
      summary_signal_ids: ["medication-plan"],
      goals_json: [],
      daily_support_json: [],
      monitoring_json: [
        { text: "Watch for missed medication routines this week.", source_signal_ids: ["medication-plan"] },
      ],
      escalation_json: [],
      caregiver_guidance_json: [],
    };

    expect(findHealthPlanSafetyIssues(plan, { sourceSignals, signalTriage })).toEqual([
      expect.objectContaining({ section_key: "monitoring_json" }),
    ]);

    const repaired = repairOperationalMonitoringLanguage(plan, { sourceSignals, signalTriage });

    expect(repaired.monitoring_json[0]).toMatchObject({
      text: expect.stringContaining("Check and document"),
      verification_required: true,
    });
    expect(findHealthPlanSafetyIssues(repaired, { sourceSignals, signalTriage })).toEqual([]);
  });

  it("makes hot escalation guidance name a concrete response action", () => {
    const sourceSignals = [
      { id: "alert-active", label: "Active alert", strength: "high" },
    ];
    const signalTriage = {
      action_signal_ids: ["alert-active"],
    };
    const plan = {
      summary_text: "An active alert needs staff follow-up.",
      summary_signal_ids: ["alert-active"],
      goals_json: [],
      daily_support_json: [],
      monitoring_json: [],
      escalation_json: [
        { text: "If the alert remains unresolved today.", source_signal_ids: ["alert-active"] },
      ],
      caregiver_guidance_json: [],
    };

    expect(findHealthPlanSafetyIssues(plan, { sourceSignals, signalTriage })).toEqual([
      expect.objectContaining({ section_key: "escalation_json" }),
    ]);

    const repaired = repairOperationalMonitoringLanguage(plan, { sourceSignals, signalTriage });

    expect(repaired.escalation_json[0]).toMatchObject({
      text: expect.stringContaining("Contact the responsible care lead"),
      timing: "today",
      priority: "high",
      verification_required: true,
    });
    expect(findHealthPlanSafetyIssues(repaired, { sourceSignals, signalTriage })).toEqual([]);
  });

  it("fills predictable coverage gaps for generated drafts before quality gates run", () => {
    const sourceSignals = [
      { id: "alert-active", label: "Active alert", strength: "high" },
      { id: "medication-plan", label: "Medication follow-through", strength: "medium" },
      { id: "service-checkins", label: "Check-in timing", strength: "medium" },
      { id: "sensor-status", label: "Sensor visibility", strength: "high" },
      { id: "consent-family-sharing", label: "Family sharing not confirmed", detail: "Consent is limited", strength: "medium" },
      { id: "care-circle-context", label: "No care provider assigned", detail: "No care provider is assigned", strength: "medium" },
    ];
    const signalTriage = {
      action_signal_ids: ["alert-active"],
      verification_signal_ids: ["sensor-status"],
      stabilizing_signal_ids: ["service-checkins"],
    };
    const criticalSignalIds = ["alert-active"];
    const plan = {
      summary_text: "The client needs a practical support plan.",
      summary_signal_ids: [],
      goals_json: [],
      daily_support_json: [],
      monitoring_json: [],
      escalation_json: [],
      caregiver_guidance_json: [],
    };

    const repaired = repairOperationalMonitoringLanguage(plan, {
      sourceSignals,
      signalTriage,
      criticalSignalIds,
    });
    const escalationGrade = buildHealthPlanEscalationGrade({
      sourceSignals,
      signalTriage,
      criticalSignalIds,
    });

    expect(findHealthPlanCoverageIssues(repaired, { sourceSignals, signalTriage, criticalSignalIds })).toEqual([]);
    expect(findHealthPlanSafetyIssues(repaired, { sourceSignals, signalTriage, criticalSignalIds })).toEqual([]);
    expect(findHealthPlanEscalationGradeIssues(repaired, { escalationGrade, sourceSignals })).toEqual([]);
  });
});
