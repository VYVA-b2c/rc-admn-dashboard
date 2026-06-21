import { describe, expect, it } from "vitest";

import {
  buildHealthPlanEscalationGrade,
  buildHealthPlanEscalationGradeBrief,
  buildHealthPlanReviewGovernance,
  findHealthPlanEscalationGradeIssues,
} from "./healthPlanEscalationGrade.js";

describe("health plan escalation grade", () => {
  it("marks the plan urgent when multiple hot signals and missing fresh follow-through stack together", () => {
    const grade = buildHealthPlanEscalationGrade({
      sourceSignals: [
        { id: "risk-latest-score", label: "Predictive risk score 86 (high)", detail: "Up 9 from prior", category: "risk", strength: "high" },
        { id: "alert-active", label: "2 active alerts", detail: "Client unreachable this morning", category: "alert", strength: "high" },
        { id: "medication-plan", label: "2 medications on file", detail: "Latest adherence missed", category: "medication", strength: "high" },
      ],
      signalTriage: {
        action_signal_ids: ["risk-latest-score", "alert-active", "medication-plan"],
        verification_signal_ids: ["alert-active", "medication-plan"],
      },
      criticalSignalIds: ["risk-latest-score", "alert-active"],
      followThrough: {
        caution_signals: [
          { id: "no-fresh-touchpoints", label: "No fresh follow-through evidence", detail: "No new check-in, Brain Coach, or medication activity has been recorded." },
        ],
      },
    });

    expect(grade.grade).toBe("urgent");
    expect(grade.response_window).toBe("today");
    expect(grade.required_signal_ids).toEqual(expect.arrayContaining(["risk-latest-score", "alert-active"]));
  });

  it("stays heightened when the pressure is real but not yet urgent", () => {
    const grade = buildHealthPlanEscalationGrade({
      sourceSignals: [
        { id: "sensor-status", label: "2 sensors linked", detail: "1 offline or not reporting", category: "sensor", strength: "high" },
        { id: "care-circle-context", label: "Care circle context", detail: "No care provider assignment recorded", category: "care-circle", strength: "high" },
      ],
      signalTriage: {
        action_signal_ids: ["sensor-status", "care-circle-context"],
        verification_signal_ids: ["sensor-status"],
      },
    });

    expect(grade.grade).toBe("heightened");
    expect(grade.response_window).toBe("today");
  });

  it("builds a compact prompt-safe brief", () => {
    const brief = buildHealthPlanEscalationGradeBrief({
      grade: "urgent",
      score: 9,
      response_window: "today",
      summary: "Same-day coordination is required.",
      required_signal_ids: ["alert-active"],
      same_day_signal_ids: ["alert-active"],
      verification_signal_ids: ["alert-active"],
      reasons: [
        {
          id: "active-alerts",
          label: "Active alerts need same-day coordination",
          detail: "Client unreachable this morning",
          severity: "high",
          response_window: "today",
          source_signal_ids: ["alert-active"],
        },
      ],
    });

    expect(brief).toMatchObject({
      grade: "urgent",
      response_window: "today",
      reasons: [{ id: "active-alerts", severity: "high" }],
    });
  });

  it("flags plans that soften an urgent case into routine monitoring", () => {
    const issues = findHealthPlanEscalationGradeIssues({
      summary_text: "Support remains steady overall.",
      summary_signal_ids: ["care-circle-context"],
      monitoring_json: [
        { text: "Review routines at the next weekly review.", source_signal_ids: ["care-circle-context"], timing: "ongoing" },
      ],
      escalation_json: [
        { text: "Escalate if needed.", source_signal_ids: ["care-circle-context"], timing: "this_week" },
      ],
    }, {
      sourceSignals: [
        { id: "risk-latest-score", label: "Predictive risk score 86 (high)", category: "risk", strength: "high" },
        { id: "alert-active", label: "2 active alerts", category: "alert", strength: "high" },
        { id: "care-circle-context", label: "Care circle context", category: "care-circle", strength: "medium" },
      ],
      escalationGrade: {
        grade: "urgent",
        required_signal_ids: ["risk-latest-score", "alert-active"],
        same_day_signal_ids: ["alert-active"],
        verification_signal_ids: ["alert-active"],
      },
    });

    expect(issues.map((issue) => issue.section_key)).toEqual(expect.arrayContaining([
      "summary",
      "monitoring_json",
      "escalation_json",
    ]));
  });

  it("turns urgent signal pressure into persisted review governance", () => {
    const governance = buildHealthPlanReviewGovernance({
      escalationGrade: {
        grade: "urgent",
        response_window: "today",
        reasons: [
          {
            id: "active-alerts",
            label: "Active alerts need same-day coordination",
            detail: "Client unreachable this morning",
            severity: "high",
          },
        ],
      },
      dataQualityGaps: [
        {
          id: "med-gap",
          label: "Medication follow-through gap",
          detail: "Recent adherence detail is incomplete.",
          severity: "high",
        },
      ],
    });

    expect(governance).toMatchObject({
      review_required: true,
      review_window: "today",
      escalation_grade: "urgent",
    });
    expect(governance.review_reasons_json.map((item) => item.id)).toEqual(
      expect.arrayContaining(["active-alerts", "gap:med-gap"]),
    );
  });
});
