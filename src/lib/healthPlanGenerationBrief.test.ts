import { describe, expect, it } from "vitest";

import { buildHealthPlanGenerationBrief } from "./healthPlanGenerationBrief.js";

describe("healthPlanGenerationBrief", () => {
  it("ranks act-now and verify signals ahead of background stabilization and maps them to sections", () => {
    const brief = buildHealthPlanGenerationBrief({
      sourceSignals: [
        { id: "alert-active", label: "Active safety alert", category: "alert", strength: "high" },
        { id: "medication-plan", label: "Medication adherence issue", category: "medication", strength: "high" },
        { id: "care-circle-context", label: "Care circle context", category: "care-circle", strength: "medium" },
      ],
      evidencePack: {
        same_day_response_required: true,
        must_address_facts: [
          {
            signal_id: "alert-active",
            label: "Active safety alert",
            priority: "high",
            response_window: "today",
            why_it_matters: "A live safety alert should shape the immediate response.",
            source_signal_ids: ["alert-active"],
          },
        ],
        verification_needs: [
          {
            signal_id: "medication-plan",
            label: "Medication adherence issue",
            priority: "high",
            severity: "high",
            response_window: "today",
            why_it_matters: "Medication misses still need explicit confirmation.",
            source_signal_ids: ["medication-plan"],
          },
        ],
        stabilizing_facts: [
          {
            signal_id: "care-circle-context",
            label: "Care circle context",
            priority: "medium",
            response_window: "ongoing",
            why_it_matters: "The family support structure can reinforce the routine.",
            source_signal_ids: ["care-circle-context"],
          },
        ],
        contradictions: [],
      },
      reviewPriorities: {
        sections: [
          {
            section_key: "monitoring_json",
            priority: "high",
            response_window: "today",
            why_now: "Monitoring needs same-day clarity.",
            reasons: [{ label: "Live alert pressure", severity: "high" }],
          },
          {
            section_key: "caregiver_guidance_json",
            priority: "medium",
            response_window: "this_week",
            why_now: "Caregiver reinforcement matters here.",
            reasons: [{ label: "Family support can reinforce follow-through", severity: "medium" }],
          },
        ],
      },
      targetSections: ["monitoring_json", "caregiver_guidance_json"],
    });

    expect(brief.priority_signals[0]).toMatchObject({
      signal_id: "alert-active",
      focus: "act_now",
      response_window: "today",
    });
    expect(brief.priority_signals[1]).toMatchObject({
      signal_id: "medication-plan",
      focus: "verify",
    });

    expect(brief.section_briefs.find((item) => item.section_key === "monitoring_json")).toMatchObject({
      priority: "high",
      response_window: "today",
      must_address_signal_ids: ["alert-active"],
      verify_signal_ids: ["medication-plan"],
    });
    expect(brief.section_briefs.find((item) => item.section_key === "caregiver_guidance_json")).toMatchObject({
      preserve_signal_ids: ["care-circle-context"],
    });
    expect(brief.writing_guardrails).toContain(
      "Write the summary, monitoring, and escalation guidance as same-day coordination, not routine follow-up.",
    );
  });

  it("surfaces preserve and rewrite recommendation guidance per section", () => {
    const brief = buildHealthPlanGenerationBrief({
      sourceSignals: [
        { id: "medication-plan", label: "Medication adherence issue", category: "medication", strength: "high" },
      ],
      recommendationRepairBrief: {
        items: [
          {
            item_id: "daily-1",
            section_key: "daily_support_json",
            text: "Keep the morning medication routine.",
            recommended_action: "preserve",
            reason: "This routine already helped repeatedly.",
            source_signal_ids: ["medication-plan"],
          },
          {
            item_id: "monitor-1",
            section_key: "monitoring_json",
            text: "Keep monitoring the situation.",
            recommended_action: "rework",
            priority: "high",
            reason: "The wording is too calm for the current pressure.",
            rewrite_guidance: "Replace calming wording with a same-day check and fallback path.",
            source_signal_ids: ["medication-plan"],
          },
        ],
      },
      targetSections: ["daily_support_json", "monitoring_json"],
    });

    expect(brief.section_briefs.find((item) => item.section_key === "daily_support_json")?.preserve_recommendations[0]).toMatchObject({
      label: "Keep the morning medication routine.",
      reason: "This routine already helped repeatedly.",
    });
    expect(brief.section_briefs.find((item) => item.section_key === "monitoring_json")).toMatchObject({
      priority: "high",
      rewrite_recommendations: [
        expect.objectContaining({
          label: "Keep monitoring the situation.",
          action: "rework",
          rewrite_guidance: "Replace calming wording with a same-day check and fallback path.",
        }),
      ],
    });
  });

  it("folds client response memory and recommendation effectiveness into the writing brief", () => {
    const brief = buildHealthPlanGenerationBrief({
      sourceSignals: [
        { id: "medication-plan", label: "Medication adherence issue", category: "medication", strength: "high" },
        { id: "service-checkins", label: "Check-ins enabled", category: "service", strength: "medium" },
      ],
      clientResponseMemory: {
        strongest_anchors: [
          {
            category: "service",
            labels: ["Check-ins"],
            reason: "Check-ins keep landing for this client.",
          },
        ],
        fragile_anchors: [
          {
            category: "medication",
            labels: ["Medication follow-through"],
            reason: "Medication routines have been unreliable.",
          },
        ],
      },
      recommendationEffectiveness: {
        preserve_now: [
          {
            section_key: "daily_support_json",
            text: "Keep the morning check-in routine.",
            action_reason: "It keeps helping the client stay oriented.",
            preserve_strength: "must_preserve",
            source_signal_ids: ["service-checkins"],
          },
        ],
        rework_now: [
          {
            section_key: "monitoring_json",
            text: "Keep monitoring the medication situation.",
            action: "verify",
            action_reason: "Medication follow-through still needs direct confirmation.",
            repair_strength: "must_verify",
            source_signal_ids: ["medication-plan"],
          },
        ],
        retire_now: [
          {
            section_key: "daily_support_json",
            text: "Send the same medication reminder without checking response.",
            action: "retire",
            action_reason: "That routine has repeatedly failed without follow-up.",
            repair_strength: "must_replace",
            source_signal_ids: ["medication-plan"],
          },
        ],
      },
      targetSections: ["daily_support_json", "monitoring_json"],
    });

    expect(brief.writing_guardrails).toContain(
      "Protect the routines that have already helped this client instead of rewriting them for novelty.",
    );
    expect(brief.writing_guardrails).toContain(
      "Do not let failed or repeatedly unresolved routines come back unchanged just because they sound familiar.",
    );
    expect(brief.section_briefs.find((item) => item.section_key === "daily_support_json")).toMatchObject({
      preserve_recommendations: [
        expect.objectContaining({
          label: "Keep the morning check-in routine.",
          reason: "It keeps helping the client stay oriented.",
          preserve_strength: "must_preserve",
        }),
      ],
    });
    expect(brief.section_briefs.find((item) => item.section_key === "daily_support_json")?.rewrite_recommendations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "Send the same medication reminder without checking response.",
          action: "retire",
        }),
      ]),
    );
    expect(brief.section_briefs.find((item) => item.section_key === "daily_support_json")?.guardrails).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "Lean on Check-ins when it still matches the live picture; this is one of the client's strongest response anchors.",
        }),
        expect.objectContaining({
          label: "Treat Medication follow-through as fragile for this client; keep the wording verification-led and avoid assuming follow-through.",
        }),
      ]),
    );
    expect(brief.section_briefs.find((item) => item.section_key === "monitoring_json")?.priority).toBe("high");
    expect(brief.section_briefs.find((item) => item.section_key === "monitoring_json")?.rewrite_recommendations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "Keep monitoring the medication situation.",
          action: "verify",
          repair_strength: "must_verify",
        }),
      ]),
    );
  });

  it("builds a structured evidence decision map so fresher and stronger sources lead the writing brief", () => {
    const brief = buildHealthPlanGenerationBrief({
      sourceSignals: [
        { id: "alert-active", label: "Active alert", category: "alert", strength: "high" },
        { id: "risk-latest-score", label: "Predictive risk score", category: "risk", strength: "high" },
        { id: "care-circle-context", label: "Care circle context", category: "care-circle", strength: "medium" },
      ],
      evidenceHierarchy: [
        {
          id: "feedback:monitoring_json",
          label: "Staff feedback for monitoring",
          section_key: "monitoring_json",
          authority_level: "highest",
          source_type: "staff_feedback",
          freshness_status: "fresh",
          priority_score: 106,
          reason: "Fresh staff feedback is the clearest evidence of whether guidance held up in real use.",
        },
        {
          id: "risk-latest-score",
          label: "Predictive risk score",
          authority_level: "medium",
          source_type: "predictive",
          freshness_status: null,
          priority_score: 74,
          reason: "Predictive risk matters, but it should be checked against fresher live signals and staff observations.",
        },
        {
          id: "care-circle-context",
          label: "Care circle context",
          authority_level: "supporting",
          source_type: "profile_context",
          freshness_status: null,
          priority_score: 42,
          reason: "Care-circle and profile context should shape tone and feasibility, not override urgent live evidence.",
        },
        {
          id: "feedback:daily_support_json",
          label: "Older staff feedback for daily support",
          section_key: "daily_support_json",
          authority_level: "medium",
          source_type: "staff_feedback",
          freshness_status: "stale",
          priority_score: 82,
          reason: "Older staff feedback still matters, but it should be checked against newer live evidence.",
        },
      ],
      targetSections: ["daily_support_json", "monitoring_json", "caregiver_guidance_json"],
    });

    expect(brief.evidence_decision_map?.trust_now[0]).toMatchObject({
      id: "feedback:monitoring_json",
      source_type: "staff_feedback",
      freshness_status: "fresh",
    });
    expect(brief.evidence_decision_map?.verify_before_reuse).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "risk-latest-score",
          source_type: "predictive",
        }),
      ]),
    );
    expect(brief.evidence_decision_map?.stale_watchouts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "feedback:daily_support_json",
          freshness_status: "stale",
        }),
      ]),
    );
    expect(brief.section_briefs.find((item) => item.section_key === "monitoring_json")).toMatchObject({
      decision_lead_evidence_ids: ["feedback:monitoring_json"],
      verification_evidence_ids: ["risk-latest-score"],
      evidence_strategy: expect.stringMatching(/Lead with the freshest high-authority evidence|verification-led/i),
    });
    expect(brief.writing_guardrails).toEqual(
      expect.arrayContaining([
        "Treat stale evidence as background context unless fresher staff or live operational evidence still supports it.",
        "Keep medium-authority or predictive evidence verification-led instead of writing as if it already proves the routine is safe.",
      ]),
    );
  });

  it("threads cohort guidance in as fallback learning without replacing client-specific guardrails", () => {
    const brief = buildHealthPlanGenerationBrief({
      cohortGuidance: {
        overall_status: "usable",
        usage_mode: "supportive",
        guardrails: [
          "Use cohort guidance only to sharpen areas where this client's own history is still mixed; it should not replace direct client evidence.",
          "When the record is thin or mixed, similar same-organization cases responded better to Check-ins.",
        ],
        section_guidance: [
          {
            section_key: "daily_support_json",
            reinforce: [
              "If the client's own history is thin or mixed, similar same-organization cases responded better when Check-ins stayed concrete and supported.",
            ],
            avoid: [],
          },
          {
            section_key: "monitoring_json",
            reinforce: [],
            avoid: [
              "If the client's own history is thin or mixed, similar same-organization cases needed tighter verification or backup around Medication follow-through.",
            ],
          },
        ],
      },
      targetSections: ["daily_support_json", "monitoring_json"],
    });

    expect(brief.cohort_guidance).toMatchObject({
      overall_status: "usable",
      usage_mode: "supportive",
    });
    expect(brief.writing_guardrails).toEqual(
      expect.arrayContaining([
        "Use cohort guidance only to sharpen areas where this client's own history is still mixed; it should not replace direct client evidence.",
      ]),
    );
    expect(brief.section_briefs.find((item) => item.section_key === "daily_support_json")?.guardrails).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "If the client's own history is thin or mixed, similar same-organization cases responded better when Check-ins stayed concrete and supported.",
        }),
      ]),
    );
    expect(brief.section_briefs.find((item) => item.section_key === "monitoring_json")?.guardrails).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "If the client's own history is thin or mixed, similar same-organization cases needed tighter verification or backup around Medication follow-through.",
        }),
      ]),
    );
  });

  it("pulls recommendation challenge feedback into section rewrite guidance", () => {
    const brief = buildHealthPlanGenerationBrief({
      recommendationChallenges: {
        items: [
          {
            item_id: "monitor-1",
            section_key: "monitoring_json",
            text: "Keep monitoring the situation.",
            challenge_status: "challenged",
            high_risk: true,
            why_it_is_questioned: "The wording sounds calmer than the live pressure warrants.",
            safer_reframe: "Replace calming wording with a same-day check and explicit fallback path.",
            source_signal_ids: ["alert-active"],
          },
        ],
      },
      targetSections: ["monitoring_json"],
    });

    expect(brief.writing_guardrails).toEqual(
      expect.arrayContaining([
        "Rewrite high-risk recommendations that still sound too optimistic, too thin, or missing a fallback before staff rely on them.",
      ]),
    );
    expect(brief.section_briefs.find((item) => item.section_key === "monitoring_json")).toMatchObject({
      priority: "high",
      guardrails: expect.arrayContaining([
        expect.objectContaining({
          label: "The wording sounds calmer than the live pressure warrants.",
        }),
      ]),
      rewrite_recommendations: expect.arrayContaining([
        expect.objectContaining({
          label: "Keep monitoring the situation.",
          action: "rework",
          repair_strength: "must_rewrite",
          rewrite_guidance: "Replace calming wording with a same-day check and explicit fallback path.",
        }),
      ]),
    });
  });

  it("lets matched benchmark archetypes raise timing and verification guardrails in the brief", () => {
    const brief = buildHealthPlanGenerationBrief({
      benchmarkGuidance: {
        matched_case_count: 1,
        items: [
          {
            case_id: "urgent_unreachable_fall_risk",
            case_label: "Urgent unreachable fall risk",
            same_day_response_required: true,
            required_sections: ["monitoring_json", "escalation_json"],
            required_timings: [
              { section_key: "monitoring_json", timing: "today" },
              { section_key: "escalation_json", timing: "today" },
            ],
            section_keywords: [
              { section_key: "monitoring_json", keywords: ["verify", "today"] },
              { section_key: "escalation_json", keywords: ["escalate", "fallback"] },
            ],
            require_verification_language: true,
          },
        ],
      },
      targetSections: ["monitoring_json", "escalation_json"],
    });

    expect(brief.benchmark_guidance).toMatchObject({
      matched_case_count: 1,
    });
    expect(brief.writing_guardrails).toEqual(
      expect.arrayContaining([
        "Matched benchmark patterns expect explicit verification language, so do not let the draft sound settled too early.",
        "Matched benchmark patterns expect same-day response language, so keep timing, ownership, and fallback explicit.",
      ]),
    );
    expect(brief.section_briefs.find((item) => item.section_key === "monitoring_json")).toMatchObject({
      priority: "high",
      response_window: "today",
      guardrails: expect.arrayContaining([
        expect.objectContaining({
          label: "Matched benchmark archetype Urgent unreachable fall risk expects this section to stay explicit and operationally complete.",
        }),
        expect.objectContaining({
          label: "Keep this section explicitly verification-led because the closest benchmark pattern treats confirmation language as essential here.",
        }),
      ]),
    });
    expect(brief.section_briefs.find((item) => item.section_key === "escalation_json")?.guardrails).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "Keep this section centered on escalate, fallback because the closest benchmark pattern relies on those cues.",
        }),
      ]),
    );
  });

  it("uses prior execution and remediation guidance to push handoff-ready section wording", () => {
    const brief = buildHealthPlanGenerationBrief({
      executionBrief: {
        overall_status: "same_day",
        same_day_count: 1,
        actions: [
          {
            section_key: "escalation_json",
            action_text: "Escalate today if first outreach fails.",
            response_window: "today",
            priority: "high",
            verification_required: true,
            completion_signal: "Close the loop once the responder is reached.",
            fallback_owner_role: "on_call_coordinator",
            source_signal_ids: ["alert-active"],
          },
        ],
        gaps: [
          {
            section_key: "escalation_json",
            severity: "high",
            label: "Confirm the fallback owner before relying on this escalation step.",
          },
        ],
      },
      reviewRemediation: {
        overall_status: "blocked",
        actions: [
          {
            action_kind: "refresh_sections",
            priority: "high",
            title: "Refresh Escalation",
            section_keys: ["escalation_json"],
            reasons: ["The fallback path stayed too vague in the previous review."],
          },
        ],
      },
      targetSections: ["escalation_json"],
    });

    expect(brief.execution_brief).toMatchObject({
      overall_status: "same_day",
    });
    expect(brief.review_remediation).toMatchObject({
      overall_status: "blocked",
    });
    expect(brief.writing_guardrails).toEqual(
      expect.arrayContaining([
        "Keep the draft operationally handoff-ready: name the next owner, verification step, completion signal, and fallback path where pressure is active.",
        "Repair the execution gaps from the prior plan directly instead of assuming staff will fill them in later.",
        "Treat the prior review remediation actions as a concrete fix list for the next draft, not just background commentary.",
      ]),
    );
    expect(brief.section_briefs.find((item) => item.section_key === "escalation_json")).toMatchObject({
      priority: "high",
      response_window: "today",
      guardrails: expect.arrayContaining([
        expect.objectContaining({
          label: "Keep this section verification-led until staff can confirm the live outcome.",
        }),
        expect.objectContaining({
          label: "Confirm the fallback owner before relying on this escalation step.",
        }),
        expect.objectContaining({
          label: "Previous review remediation still points here: Refresh Escalation",
        }),
      ]),
    });
  });
});
