import { describe, expect, it } from "vitest";

import { buildHealthPlanDraftAcceptance } from "./healthPlanDraftAcceptance.js";

const minimalPlan = {
  summary_text: "Client needs steady check-ins and medication support.",
  summary_signal_ids: ["risk-1"],
  goals_json: [{ id: "g1", text: "Keep daily routines steady.", source_signal_ids: ["risk-1"] }],
  daily_support_json: [{ id: "d1", text: "Reinforce medication reminders.", source_signal_ids: ["risk-1"] }],
  monitoring_json: [{ id: "m1", text: "Check for dizziness or missed doses.", source_signal_ids: ["risk-1"] }],
  escalation_json: [{ id: "e1", text: "Escalate if contact fails twice in one day.", source_signal_ids: ["risk-1"] }],
  caregiver_guidance_json: [{ id: "c1", text: "Report back to the team if routines break down.", source_signal_ids: ["risk-1"] }],
};

describe("buildHealthPlanDraftAcceptance", () => {
  it("accepts a draft when no blocking or caution signals remain", () => {
    const summary = buildHealthPlanDraftAcceptance({
      plan: minimalPlan,
      sourceSignals: [{ id: "risk-1", label: "Risk", category: "risk", strength: "medium" }],
      generationQuality: { overall_status: "strong", summary: "Looks good.", issues: [] },
      operationalCompleteness: { overall_status: "strong", summary: "Operational details are explicit.", issues: [] },
      recommendationCoverage: {
        overall_status: "strong",
        summary: "Coverage is strong.",
        must_address_count: 1,
        must_address_covered_count: 1,
        verification_need_count: 0,
        verification_covered_count: 0,
        score: 95,
        issues: [],
      },
      recommendationChallenges: {
        overall_status: "supported",
        summary: "No high-risk challenges remain.",
        items: [],
      },
      recommendationGrounding: {
        overall_status: "strong",
        summary: "Recommendations stay close to the evidence.",
        issues: [],
      },
      operationalRelease: {
        overall_status: "shareable",
        can_use_for_staff_workflow: true,
        requires_staff_review: false,
        caution_count: 0,
        blocking_items: [],
        caution_items: [],
        summary: "This plan is strong enough for staff use and is phrased cleanly enough to share if needed.",
      },
    });

    expect(summary?.overall_status).toBe("accepted");
    expect(summary?.can_accept_for_generation).toBe(true);
    expect(summary?.blocking_items).toHaveLength(0);
  });

  it("blocks a draft when coverage leaves must-address facts unresolved", () => {
    const summary = buildHealthPlanDraftAcceptance({
      plan: minimalPlan,
      sourceSignals: [{ id: "risk-1", label: "Risk", category: "risk", strength: "medium" }],
      generationQuality: { overall_status: "strong", summary: "Looks good.", issues: [] },
      operationalCompleteness: { overall_status: "strong", summary: "Operational details are explicit.", issues: [] },
      recommendationCoverage: {
        overall_status: "fragile",
        summary: "Coverage is missing a critical fact.",
        must_address_count: 2,
        must_address_covered_count: 1,
        verification_need_count: 1,
        verification_covered_count: 0,
        score: 55,
        issues: [{ severity: "high", section_key: "monitoring_json", message: "Monitoring missed a must-address fact." }],
      },
      recommendationChallenges: {
        overall_status: "supported",
        summary: "No high-risk challenges remain.",
        items: [],
      },
      recommendationGrounding: {
        overall_status: "strong",
        summary: "Recommendations stay close to the evidence.",
        issues: [],
      },
    });

    expect(summary?.overall_status).toBe("blocked");
    expect(summary?.can_accept_for_generation).toBe(false);
    expect(summary?.blocking_items[0]?.type).toBe("recommendation_coverage");
  });

  it("blocks a draft when a challenged high-risk recommendation is still present", () => {
    const summary = buildHealthPlanDraftAcceptance({
      plan: minimalPlan,
      sourceSignals: [{ id: "risk-1", label: "Risk", category: "risk", strength: "medium" }],
      generationQuality: { overall_status: "strong", summary: "Looks good.", issues: [] },
      operationalCompleteness: { overall_status: "strong", summary: "Operational details are explicit.", issues: [] },
      recommendationCoverage: {
        overall_status: "strong",
        summary: "Coverage is strong.",
        must_address_count: 1,
        must_address_covered_count: 1,
        verification_need_count: 0,
        verification_covered_count: 0,
        score: 95,
        issues: [],
      },
      recommendationChallenges: {
        overall_status: "challenged",
        summary: "One recommendation is too optimistic.",
        items: [
          {
            section_key: "escalation_json",
            challenge_status: "challenged",
            high_risk: true,
            why_it_is_questioned: "Escalation wording still lacks a realistic fallback if the first outreach fails.",
            safer_reframe: "Name a fallback owner and keep the wording same-day.",
          },
        ],
      },
      recommendationGrounding: {
        overall_status: "strong",
        summary: "Recommendations stay close to the evidence.",
        issues: [],
      },
    });

    expect(summary?.overall_status).toBe("blocked");
    expect(summary?.blocking_items[0]?.type).toBe("recommendation_challenges");
  });

  it("blocks a draft when the plan is still too vague to execute under pressure", () => {
    const summary = buildHealthPlanDraftAcceptance({
      plan: minimalPlan,
      sourceSignals: [{ id: "risk-1", label: "Risk", category: "risk", strength: "medium" }],
      generationQuality: { overall_status: "strong", summary: "Looks good.", issues: [] },
      operationalCompleteness: {
        overall_status: "fragile",
        summary: "Execution details are still implicit.",
        issues: [
          {
            severity: "high",
            section_key: "escalation_json",
            message: "Escalation does not clearly name who acts next.",
            detail: "Name the owner and backup route.",
          },
        ],
      },
      recommendationCoverage: {
        overall_status: "strong",
        summary: "Coverage is strong.",
        must_address_count: 1,
        must_address_covered_count: 1,
        verification_need_count: 0,
        verification_covered_count: 0,
        score: 95,
        issues: [],
      },
      recommendationChallenges: {
        overall_status: "supported",
        summary: "No high-risk challenges remain.",
        items: [],
      },
      recommendationGrounding: {
        overall_status: "strong",
        summary: "Recommendations stay close to the evidence.",
        issues: [],
      },
    });

    expect(summary?.overall_status).toBe("blocked");
    expect(summary?.blocking_items[0]?.type).toBe("operational_completeness");
  });

  it("blocks a draft when recommendation certainty still outruns the evidence", () => {
    const summary = buildHealthPlanDraftAcceptance({
      plan: minimalPlan,
      sourceSignals: [{ id: "risk-1", label: "Risk", category: "risk", strength: "medium" }],
      generationQuality: { overall_status: "strong", summary: "Looks good.", issues: [] },
      operationalCompleteness: { overall_status: "strong", summary: "Operational details are explicit.", issues: [] },
      recommendationCoverage: {
        overall_status: "strong",
        summary: "Coverage is strong.",
        must_address_count: 1,
        must_address_covered_count: 1,
        verification_need_count: 0,
        verification_covered_count: 0,
        score: 95,
        issues: [],
      },
      recommendationChallenges: {
        overall_status: "supported",
        summary: "No high-risk challenges remain.",
        items: [],
      },
      recommendationGrounding: {
        overall_status: "fragile",
        summary: "One recommendation still outruns the evidence.",
        issues: [
          {
            severity: "high",
            section_key: "caregiver_guidance_json",
            message: "Caregiver guidance sounds more certain than the live evidence supports.",
          },
        ],
      },
    });

    expect(summary?.overall_status).toBe("blocked");
    expect(summary?.blocking_items[0]?.type).toBe("recommendation_grounding");
  });

  it("blocks a draft when it drifts away from the generation brief's evidence discipline", () => {
    const summary = buildHealthPlanDraftAcceptance({
      plan: {
        ...minimalPlan,
        summary_text: "Continue support and monitor wellbeing.",
        summary_signal_ids: ["care-circle-context"],
        monitoring_json: [
          {
            id: "m1",
            text: "Keep monitoring the situation.",
            source_signal_ids: ["care-circle-context"],
            timing: "ongoing",
            priority: "low",
          },
        ],
      },
      sourceSignals: [
        { id: "alert-active", label: "Alert", category: "alert", strength: "high" },
        { id: "medication-plan", label: "Medication", category: "medication", strength: "high" },
        { id: "care-circle-context", label: "Care circle", category: "care-circle", strength: "medium" },
      ],
      promptInput: {
        generation_brief: {
          same_day_response_required: true,
          priority_signals: [
            { signal_id: "alert-active", focus: "act_now" },
          ],
          section_briefs: [
            {
              section_key: "monitoring_json",
              section_label: "Monitoring",
              priority: "high",
              response_window: "today",
              must_address_signal_ids: ["alert-active"],
              verify_signal_ids: ["medication-plan"],
              decision_lead_evidence_ids: ["feedback:monitoring_json"],
              verification_evidence_ids: ["medication-plan"],
              supporting_evidence_ids: [],
              stale_evidence_ids: ["feedback:monitoring_json:stale"],
              evidence_strategy: "Lead with the freshest high-authority evidence, keep the medium-authority signals verification-led, and do not let supporting context smooth over the pressure.",
              preserve_signal_ids: [],
              rewrite_recommendations: [
                {
                  label: "Keep monitoring the situation.",
                  action: "rework",
                },
              ],
              preserve_recommendations: [],
              guardrails: [{ label: "Stay verification-led." }],
            },
          ],
        },
      },
      generationQuality: { overall_status: "strong", summary: "Looks good.", issues: [] },
      operationalCompleteness: { overall_status: "strong", summary: "Operational details are explicit.", issues: [] },
      recommendationCoverage: {
        overall_status: "strong",
        summary: "Coverage is strong.",
        must_address_count: 1,
        must_address_covered_count: 1,
        verification_need_count: 0,
        verification_covered_count: 0,
        score: 95,
        issues: [],
      },
      recommendationChallenges: {
        overall_status: "supported",
        summary: "No high-risk challenges remain.",
        items: [],
      },
      recommendationGrounding: {
        overall_status: "strong",
        summary: "Recommendations stay close to the evidence.",
        issues: [],
      },
    });

    expect(summary?.overall_status).toBe("blocked");
    expect(summary?.blocking_items[0]?.type).toBe("generation_brief");
    expect(summary?.generation_brief_issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "section_lead_evidence_underplayed", section_key: "monitoring_json" }),
      ]),
    );
  });

  it("blocks a draft when safety review still sees unsafe wording", () => {
    const summary = buildHealthPlanDraftAcceptance({
      plan: minimalPlan,
      sourceSignals: [{ id: "risk-1", label: "Risk", category: "risk", strength: "high" }],
      generationQuality: { overall_status: "strong", summary: "Looks good.", issues: [] },
      operationalCompleteness: { overall_status: "strong", summary: "Operational details are explicit.", issues: [] },
      recommendationCoverage: {
        overall_status: "strong",
        summary: "Coverage is strong.",
        must_address_count: 1,
        must_address_covered_count: 1,
        verification_need_count: 0,
        verification_covered_count: 0,
        score: 95,
        issues: [],
      },
      recommendationChallenges: {
        overall_status: "supported",
        summary: "No high-risk challenges remain.",
        items: [],
      },
      recommendationGrounding: {
        overall_status: "strong",
        summary: "Recommendations stay close to the evidence.",
        issues: [],
      },
      safetyIssues: [
        {
          section_key: "summary",
          message: "The summary sounds more reassuring than the strongest live signals allow.",
        },
      ],
    });

    expect(summary?.overall_status).toBe("blocked");
    expect(summary?.blocking_items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "safety_review" }),
      ]),
    );
  });

  it("blocks a draft when a clinical caution response path is still missing", () => {
    const summary = buildHealthPlanDraftAcceptance({
      plan: minimalPlan,
      sourceSignals: [{ id: "risk-1", label: "Risk", category: "risk", strength: "high" }],
      generationQuality: { overall_status: "strong", summary: "Looks good.", issues: [] },
      operationalCompleteness: { overall_status: "strong", summary: "Operational details are explicit.", issues: [] },
      recommendationCoverage: {
        overall_status: "strong",
        summary: "Coverage is strong.",
        must_address_count: 1,
        must_address_covered_count: 1,
        verification_need_count: 0,
        verification_covered_count: 0,
        score: 95,
        issues: [],
      },
      recommendationChallenges: {
        overall_status: "supported",
        summary: "No high-risk challenges remain.",
        items: [],
      },
      recommendationGrounding: {
        overall_status: "strong",
        summary: "Recommendations stay close to the evidence.",
        issues: [],
      },
      clinicalCautionIssues: [
        {
          section_key: "escalation_json",
          message: "Escalation should name what happens if the client remains unreachable.",
          guidance: "Name how staff will re-establish contact and what happens the same day if contact still fails.",
        },
      ],
    });

    expect(summary?.overall_status).toBe("blocked");
    expect(summary?.blocking_items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "clinical_cautions" }),
      ]),
    );
  });

  it("blocks a draft when operational release says it should stay in staff-only holding", () => {
    const summary = buildHealthPlanDraftAcceptance({
      plan: minimalPlan,
      sourceSignals: [{ id: "risk-1", label: "Risk", category: "risk", strength: "medium" }],
      generationQuality: { overall_status: "strong", summary: "Looks good.", issues: [] },
      operationalCompleteness: { overall_status: "strong", summary: "Operational details are explicit.", issues: [] },
      recommendationCoverage: {
        overall_status: "strong",
        summary: "Coverage is strong.",
        must_address_count: 1,
        must_address_covered_count: 1,
        verification_need_count: 0,
        verification_covered_count: 0,
        score: 95,
        issues: [],
      },
      recommendationChallenges: {
        overall_status: "supported",
        summary: "No high-risk challenges remain.",
        items: [],
      },
      recommendationGrounding: {
        overall_status: "strong",
        summary: "Recommendations stay close to the evidence.",
        issues: [],
      },
      operationalRelease: {
        overall_status: "blocked",
        can_use_for_staff_workflow: false,
        summary: "This plan should stay in staff-only holding until the strongest trust or evidence blockers are cleared.",
        blocking_items: [
          {
            type: "predictive_visibility_gap",
            label: "Same-day pressure is outrunning predictive visibility.",
            detail: "Staff should refresh the live picture before relying on this plan.",
            section_keys: ["monitoring_json", "escalation_json"],
          },
        ],
      },
    });

    expect(summary?.overall_status).toBe("blocked");
    expect(summary?.blocking_items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "operational_release" }),
      ]),
    );
  });
});
