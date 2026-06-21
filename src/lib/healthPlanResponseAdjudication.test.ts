import { describe, expect, it } from "vitest";

import {
  buildHealthPlanResponseAdjudicationBrief,
  findHealthPlanResponseAdjudicationIssues,
} from "./healthPlanResponseAdjudication.js";

describe("healthPlanResponseAdjudication", () => {
  const generationBrief = {
    same_day_response_required: true,
    priority_signals: [
      {
        signal_id: "alert-active",
        focus: "act_now",
        priority: "high",
        response_window: "today",
      },
      {
        signal_id: "medication-plan",
        focus: "act_now",
        priority: "high",
        response_window: "today",
      },
      {
        signal_id: "care-circle-context",
        focus: "stabilize",
        priority: "medium",
        response_window: "this_week",
      },
    ],
  };

  const criticalResponseBrief = {
    contracts: [
      {
        id: "reachability-risk",
        label: "Reachability risk needs an explicit response path",
        signal_ids: ["alert-active"],
        response_window: "today",
        severity: "high",
        required_section_keys: ["summary", "monitoring_json", "escalation_json"],
      },
      {
        id: "fact:medication-plan",
        label: "Medication adherence risk",
        signal_ids: ["medication-plan"],
        response_window: "today",
        severity: "high",
        required_section_keys: ["monitoring_json", "escalation_json"],
      },
    ],
  };

  it("builds section lead contracts from the strongest same-day signals", () => {
    const brief = buildHealthPlanResponseAdjudicationBrief({
      generationBrief,
      criticalResponseBrief,
    });

    expect(brief?.same_day_response_required).toBe(true);
    expect(brief?.summary_anchor_signal_ids).toEqual(expect.arrayContaining(["alert-active", "medication-plan"]));
    expect(brief?.monitoring_lead_contracts[0]).toMatchObject({
      contract_id: "reachability-risk",
      signal_ids: ["alert-active"],
    });
    expect(brief?.escalation_lead_contracts[1]).toMatchObject({
      contract_id: "fact:medication-plan",
      signal_ids: ["medication-plan"],
    });
  });

  it("flags plans that lead with the wrong same-day action", () => {
    const brief = buildHealthPlanResponseAdjudicationBrief({
      generationBrief,
      criticalResponseBrief,
    });

    const issues = findHealthPlanResponseAdjudicationIssues({
      summary_text: "A same-day response is needed.",
      summary_signal_ids: ["medication-plan"],
      goals_json: [],
      daily_support_json: [],
      monitoring_json: [
        {
          text: "Confirm today whether medication doses were taken.",
          source_signal_ids: ["medication-plan"],
          timing: "today",
          priority: "high",
        },
        {
          text: "Re-check whether the alert reflects failed contact.",
          source_signal_ids: ["alert-active"],
          timing: "today",
          priority: "high",
        },
      ],
      escalation_json: [
        {
          text: "Escalate today if medication doses remain unconfirmed.",
          source_signal_ids: ["medication-plan"],
          timing: "today",
          priority: "high",
        },
        {
          text: "Escalate today if contact still fails after the alert check.",
          source_signal_ids: ["alert-active"],
          timing: "today",
          priority: "high",
        },
      ],
      caregiver_guidance_json: [],
    }, brief);

    expect(issues.map((item) => item.type)).toEqual(expect.arrayContaining([
      "summary_lead_signal_missing",
      "lead_contract_not_first",
    ]));
  });

  it("accepts plans that lead with the highest-risk same-day response", () => {
    const brief = buildHealthPlanResponseAdjudicationBrief({
      generationBrief,
      criticalResponseBrief,
    });

    const issues = findHealthPlanResponseAdjudicationIssues({
      summary_text: "The unresolved alert and medication instability both need same-day follow-up, led by the contact recovery path first.",
      summary_signal_ids: ["alert-active", "medication-plan"],
      goals_json: [],
      daily_support_json: [],
      monitoring_json: [
        {
          text: "Today, re-check whether contact was restored after the alert and document what still remains uncertain.",
          source_signal_ids: ["alert-active"],
          timing: "today",
          priority: "high",
        },
        {
          text: "Today, confirm whether medication doses were taken and log any remaining uncertainty.",
          source_signal_ids: ["medication-plan"],
          timing: "today",
          priority: "high",
        },
      ],
      escalation_json: [
        {
          text: "Escalate the same day if contact still fails after the alert re-check.",
          source_signal_ids: ["alert-active"],
          timing: "today",
          priority: "high",
        },
        {
          text: "Escalate the same day if doses remain unconfirmed after verification.",
          source_signal_ids: ["medication-plan"],
          timing: "today",
          priority: "high",
        },
      ],
      caregiver_guidance_json: [],
    }, brief);

    expect(issues).toEqual([]);
  });
});
