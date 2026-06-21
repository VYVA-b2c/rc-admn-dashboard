import { describe, expect, it } from "vitest";

import { buildHealthPlanQualitySnapshot, normalizeHealthPlanQualitySnapshot } from "./healthPlanQualitySnapshot.js";

describe("healthPlanQualitySnapshot", () => {
  it("captures decision-quality context for a saved plan revision", () => {
    const snapshot = buildHealthPlanQualitySnapshot({
      capturedAt: "2026-06-20T10:30:00.000Z",
      criticalSignalIds: ["alert-active", "risk-latest-score"],
      escalationGrade: {
        escalation_grade: "urgent",
        review_required: true,
        review_window: "today",
        review_summary: "Same-day follow-up is required.",
      },
      plan: {
        goals_json: [
          { text: "Keep Carmen reachable today.", source_signal_ids: ["alert-active", "risk-latest-score"], confidence: "high" },
        ],
        daily_support_json: [
          { text: "Preserve the morning medication and check-in routine.", source_signal_ids: ["medication-plan", "service-checkins"], confidence: "medium" },
        ],
        monitoring_json: [
          { text: "Recheck unresolved alerts and missed contact attempts.", source_signal_ids: ["alert-active"], confidence: "medium" },
        ],
        escalation_json: [
          { text: "Escalate the same day if Carmen remains unreachable.", source_signal_ids: ["alert-active", "risk-latest-score"], confidence: "high" },
        ],
        caregiver_guidance_json: [
          { text: "Ask the caregiver to confirm same-day contact.", source_signal_ids: ["care-circle-context"], confidence: "medium" },
        ],
      },
      sourceSignals: [
        { id: "alert-active", label: "1 active alert", category: "alert", strength: "high" },
        { id: "risk-latest-score", label: "Predictive risk score 84 (high)", category: "risk", strength: "high" },
        { id: "medication-plan", label: "Medication plan on file", category: "medication", strength: "high" },
        { id: "service-checkins", label: "Check-ins enabled", category: "service", strength: "medium" },
        { id: "care-circle-context", label: "Care circle context", category: "care-circle", strength: "medium" },
      ],
      dataQualityGaps: [
        { id: "gap-1", label: "Medication follow-through is stale", severity: "medium", staff_action: "Confirm the next medication touchpoint." },
      ],
      followThrough: {
        caution_signals: [{ label: "No fresh medication follow-through has been recorded yet." }],
      },
      sectionDrift: [
        { section_key: "monitoring_json", status: "needs_refresh", reasons: ["Monitoring has drifted away from the newest alert picture."] },
      ],
      feedbackEntries: [
        { section_key: "daily_support_json", item_id: "daily-1", outcome: "helped", recorded_at: "2026-06-19T09:00:00.000Z" },
      ],
      completedActions: [
        { action_id: "action-1", title: "Confirm medication touchpoint", section_key: "daily_support_json" },
      ],
      recommendationSurvivorship: {
        summary: "1 recommendation pattern has survived across versions.",
        total_patterns: 1,
        durable_count: 1,
        emerging_count: 0,
        fragile_count: 0,
        retired_count: 0,
        durable: [{ text: "Preserve the morning medication and check-in routine." }],
        emerging: [],
        fragile: [],
        retired: [],
      },
      recommendationHistory: {
        overall_status: "supportive",
        summary: "1 recommendation has cross-version support.",
        improving_count: 1,
        stable_count: 0,
        deteriorating_count: 0,
        volatile_count: 0,
        limited_count: 0,
        repeated_contradiction_count: 0,
        high_priority_deteriorating_count: 0,
        items: [{ section_key: "daily_support_json", text: "Preserve the morning medication and check-in routine.", trend_status: "improving" }],
      },
      recommendationEvidenceDiversity: {
        overall_status: "strong",
        summary: "The recommendation has a healthy evidence mix.",
        item_count: 1,
        strong_count: 1,
        guarded_count: 0,
        fragile_count: 0,
        high_priority_fragile_count: 0,
        items: [{ section_key: "daily_support_json", text: "Preserve the morning medication and check-in routine.", diversity_status: "strong" }],
      },
      recommendationReview: {
        overall_status: "guarded",
        summary: "One recommendation is approved with watch status.",
        can_mark_reviewed: true,
        item_count: 1,
        required_count: 1,
        approved_count: 0,
        watch_count: 1,
        needs_edit_count: 0,
        missing_count: 0,
        items: [{ section_key: "daily_support_json", text: "Preserve the morning medication and check-in routine.", decision_status: "watch" }],
        blocking_items: [],
        caution_items: [{ label: "Daily support: keep under watch" }],
      },
      recommendationCalibration: {
        overall_status: "adjusted",
        summary: "1 recommendation was auto-calibrated before acceptance.",
        adjustment_count: 1,
        confidence_downgrade_count: 1,
        verification_added_count: 1,
        high_pressure_adjustment_count: 1,
        items: [
          {
            section_key: "monitoring_json",
            item_id: "monitor-1",
            text: "Recheck unresolved alerts and missed contact attempts.",
          },
        ],
      },
      editorialTrace: {
        overall_status: "guarded",
        summary: "One recommendation was manually refined but kept its evidence links.",
        item_count: 1,
        ai_generated_count: 0,
        human_added_count: 0,
        human_edited_count: 1,
        diverged_from_ai_count: 1,
        evidence_detached_count: 0,
        high_priority_manual_count: 0,
        issues: [],
        items: [{ section_key: "daily_support_json", origin_type: "human_edited", evidence_linked: true }],
      },
      cohortGuidance: {
        overall_status: "usable",
        usage_mode: "supportive",
        matched_peer_count: 3,
        summary: "3 similar same-organization cases support caregiver-backed check-ins.",
        similarity_basis: ["same language", "same living context"],
        strong_peer_anchors: [{ category: "service", labels: ["Check-ins"], matched_peer_count: 3 }],
        fragile_peer_anchors: [{ category: "medication", labels: ["Medication follow-through"], matched_peer_count: 2 }],
        section_guidance: [],
        guardrails: ["Use cohort guidance only to sharpen areas where this client's own history is still mixed; it should not replace direct client evidence."],
      },
      benchmarkGuidance: {
        matched_case_count: 1,
        items: [
          {
            case_id: "urgent_unreachable_fall_risk",
            case_label: "Urgent unreachable fall risk",
            same_day_response_required: true,
            required_sections: ["monitoring_json", "escalation_json"],
            required_timings: [{ section_key: "monitoring_json", timing: "today" }],
            section_keywords: [{ section_key: "escalation_json", keywords: ["fallback"] }],
            require_verification_language: true,
          },
        ],
      },
      candidateSelection: {
        attempted_count: 3,
        accepted_count: 2,
        rejected_count: 1,
        selection_summary: "Selected candidate-2 with a 4-point edge over the next-best accepted draft.",
        winner: {
          candidate_id: "candidate-2",
          score: 92,
          summary: "Accepted candidate with trust 94, coverage 92, and 0 remaining caution items.",
          breakdown: { trust_score: 94 },
          acceptance: {
            overall_status: "accepted",
            caution_count: 0,
            trust_score: 94,
          },
        },
        ranked_candidates: [
          {
            candidate_id: "candidate-2",
            score: 92,
          },
          {
            candidate_id: "candidate-1",
            score: 88,
          },
        ],
      },
      outcomePatternMemory: {
        summary: "Recent outcomes favor service-backed routines and warn against weak medication monitoring patterns.",
        total_revisions: 3,
        stable_response_anchors: [{ category: "service", labels: ["Check-ins"], stable_count: 2 }],
        fragile_response_anchors: [{ category: "medication", labels: ["Medication follow-through"], fragile_count: 2 }],
        preserve_patterns: [{ section_key: "daily_support_json", text: "Preserve the morning medication and check-in routine.", preserve_count: 2 }],
        watch_patterns: [{ section_key: "monitoring_json", text: "Recheck unresolved alerts and missed contact attempts.", watch_count: 1 }],
        replace_patterns: [{ section_key: "monitoring_json", text: "Rely on weekly medication self-report only.", replace_count: 1 }],
        unstable_sections: [{ section_key: "monitoring_json", pressure_count: 2 }],
        stable_domains: [{ id: "daily-support-routine", label: "Daily support routine", helping_count: 2 }],
        fragile_domains: [{ id: "medication-routine", label: "Medication routine", fragile_count: 2 }],
        guardrails: ["Do not bring failed medication-only monitoring language back unchanged."],
      },
    });

    expect(snapshot).toMatchObject({
      schema_version: 1,
      captured_at: "2026-06-20T10:30:00.000Z",
      critical_signal_ids: ["alert-active", "risk-latest-score"],
    });
    expect(snapshot?.confidence_profile?.overall_status).toBeTruthy();
    expect(snapshot?.decision_trace?.length).toBeGreaterThan(0);
    expect(snapshot?.evidence_hierarchy?.length).toBeGreaterThan(0);
    expect(snapshot?.intervention_memory?.length).toBeGreaterThan(0);
    expect(snapshot?.section_outcomes?.length).toBeGreaterThan(0);
    expect(snapshot?.client_response_memory?.summary).toBeTruthy();
    expect(snapshot?.cohort_guidance?.overall_status).toBe("usable");
    expect(snapshot?.review_priorities?.items?.length).toBeGreaterThan(0);
    expect(snapshot?.generation_brief?.priority_signals?.length).toBeGreaterThan(0);
    expect(snapshot?.generation_brief?.benchmark_guidance?.matched_case_count).toBe(1);
    expect(snapshot?.generation_brief?.execution_brief?.overall_status).toBeTruthy();
    expect(snapshot?.generation_brief?.review_remediation?.overall_status).toBe(
      snapshot?.review_remediation?.overall_status,
    );
    expect(Array.isArray(snapshot?.generation_brief_issues)).toBe(true);
    expect(snapshot?.trust_verdict?.overall_status).toBeTruthy();
    expect(snapshot?.generation_quality?.overall_status).toBeTruthy();
    expect(snapshot?.operational_completeness?.overall_status).toBeTruthy();
    expect(snapshot?.action_impact?.overall_status).toBeTruthy();
    expect(snapshot?.recommendation_impact?.overall_status).toBeTruthy();
    expect(snapshot?.recommendation_history?.overall_status).toBe("supportive");
    expect(snapshot?.recommendation_evidence_diversity?.overall_status).toBe("strong");
    expect(snapshot?.recommendation_review?.overall_status).toBe("guarded");
    expect(snapshot?.recommendation_calibration?.adjustment_count).toBe(1);
    expect(snapshot?.editorial_trace?.overall_status).toBe("guarded");
    expect(snapshot?.recommendation_grounding?.overall_status).toBeTruthy();
    expect(snapshot?.recommendation_coverage?.overall_status).toBeTruthy();
    expect(snapshot?.recommendation_repair?.overall_status).toBeTruthy();
    expect(snapshot?.benchmark_assessment?.matched_case_count).toBeGreaterThan(0);
    expect(snapshot?.live_evidence_summary?.summary).toBeTruthy();
    expect(snapshot?.longitudinal_memory?.summary).toBeTruthy();
    expect(snapshot?.readiness?.overall_status).toBeTruthy();
    expect(snapshot?.review_readiness?.overall_status).toBeTruthy();
    expect(snapshot?.review_remediation?.action_count).toBeGreaterThanOrEqual(0);
    expect(snapshot?.operational_release?.overall_status).toBeTruthy();
    expect(snapshot?.recommendation_effectiveness?.overall_status).toBeTruthy();
    expect(snapshot?.recommendation_source_ranking?.items?.length).toBeGreaterThan(0);
    expect(snapshot?.recommendation_challenges?.overall_status).toBeTruthy();
    expect(snapshot?.recommendation_survivorship?.durable_count).toBe(1);
    expect(snapshot?.candidate_selection).toMatchObject({
      attempted_count: 3,
      winner: { candidate_id: "candidate-2" },
    });
    expect(snapshot?.outcome_pattern_memory).toMatchObject({
      total_revisions: 3,
      stable_response_anchors: [expect.objectContaining({ category: "service" })],
    });
  });

  it("normalizes malformed snapshots safely", () => {
    const snapshot = normalizeHealthPlanQualitySnapshot({
      schema_version: "2",
      captured_at: "2026-06-20T10:30:00Z",
      critical_signal_ids: ["alert-active", "", "alert-active"],
      decision_trace: "bad",
      evidence_hierarchy: [{ id: "risk-latest-score" }],
      recommendation_history: { improving_count: "1", items: [{ text: "Keep routine." }] },
      recommendation_evidence_diversity: { strong_count: "1", items: [{ text: "Keep routine." }] },
      recommendation_review: { watch_count: "1", items: [{ text: "Keep routine." }] },
      recommendation_calibration: { adjustment_count: "1", items: [{ section_key: "monitoring_json" }] },
      candidate_selection: { attempted_count: "2", winner: { candidate_id: "candidate-1" } },
      outcome_pattern_memory: { total_revisions: "2", stable_response_anchors: [{ category: "service" }] },
      recommendation_survivorship: { durable_count: "1", durable: [{ text: "Keep routine." }] },
    });

    expect(snapshot).toMatchObject({
      schema_version: 2,
      captured_at: "2026-06-20T10:30:00.000Z",
      critical_signal_ids: ["alert-active"],
    });
    expect(snapshot?.decision_trace).toEqual([]);
    expect(snapshot?.generation_quality).toBeNull();
    expect(snapshot?.operational_completeness).toBeNull();
    expect(snapshot?.action_impact).toBeNull();
    expect(snapshot?.recommendation_impact).toBeNull();
    expect(snapshot?.recommendation_history?.improving_count).toBe(1);
    expect(snapshot?.recommendation_evidence_diversity?.strong_count).toBe(1);
    expect(snapshot?.recommendation_review?.watch_count).toBe(1);
    expect(snapshot?.recommendation_calibration?.adjustment_count).toBe(1);
    expect(snapshot?.generation_brief).toBeNull();
    expect(snapshot?.generation_brief_issues).toEqual([]);
    expect(snapshot?.trust_verdict).toBeNull();
    expect(snapshot?.editorial_trace).toBeNull();
    expect(snapshot?.recommendation_grounding).toBeNull();
    expect(snapshot?.recommendation_coverage).toBeNull();
    expect(snapshot?.recommendation_repair).toBeNull();
    expect(snapshot?.benchmark_assessment).toBeNull();
    expect(snapshot?.live_evidence_summary).toBeNull();
    expect(snapshot?.longitudinal_memory).toBeNull();
    expect(snapshot?.readiness).toBeNull();
    expect(snapshot?.review_readiness).toBeNull();
    expect(snapshot?.review_remediation).toBeNull();
    expect(snapshot?.operational_release).toBeNull();
    expect(snapshot?.recommendation_effectiveness).toBeNull();
    expect(snapshot?.recommendation_source_ranking).toBeNull();
    expect(snapshot?.recommendation_challenges).toBeNull();
    expect(snapshot?.review_priorities).toBeNull();
    expect(snapshot?.cohort_guidance).toBeNull();
    expect(snapshot?.candidate_selection?.winner?.candidate_id).toBe("candidate-1");
    expect(snapshot?.outcome_pattern_memory?.total_revisions).toBe(2);
    expect(snapshot?.recommendation_survivorship?.durable_count).toBe(1);
  });

  it("carries client-specific learning into the saved generation brief", () => {
    const snapshot = buildHealthPlanQualitySnapshot({
      plan: {
        goals_json: [{ text: "Keep same-day contact possible.", source_signal_ids: ["alert-active"] }],
        daily_support_json: [{ text: "Keep the morning check-in routine.", source_signal_ids: ["service-checkins"] }],
        monitoring_json: [{ text: "Verify medication completion before assuming stability.", source_signal_ids: ["medication-plan"] }],
        escalation_json: [],
        caregiver_guidance_json: [],
      },
      sourceSignals: [
        { id: "alert-active", label: "1 active alert", category: "alert", strength: "high" },
        { id: "service-checkins", label: "Check-ins enabled", category: "service", strength: "medium" },
        { id: "medication-plan", label: "Medication plan on file", category: "medication", strength: "high" },
      ],
      reviewPriorities: {
        sections: [
          { section_key: "monitoring_json", priority: "medium", response_window: "today", why_now: "Medication pressure needs verification." },
        ],
      },
      evidencePack: {
        same_day_response_required: false,
        must_address_facts: [],
        verification_needs: [],
        stabilizing_facts: [],
        contradictions: [],
      },
      clientResponseMemory: {
        summary: "Check-ins are landing better than medication routines.",
        response_by_source: [],
        category_patterns: [],
        strongest_anchors: [{ category: "service", labels: ["Check-ins"], reason: "These routines keep landing." }],
        fragile_anchors: [{ category: "medication", labels: ["Medication follow-through"], reason: "This area remains unreliable." }],
        section_learning_signals: [],
      },
      recommendationEffectiveness: {
        overall_status: "mixed",
        summary: "Some routines should be preserved and others rewritten.",
        preserve_count: 1,
        rework_count: 1,
        retire_count: 0,
        durable_pattern_count: 0,
        fragile_pattern_count: 0,
        retired_pattern_count: 0,
        preserve_now: [
          {
            item_id: "daily-1",
            section_key: "daily_support_json",
            text: "Keep the morning check-in routine.",
            action: "preserve",
            action_reason: "It keeps helping the client stay oriented.",
            source_signal_ids: ["service-checkins"],
          },
        ],
        rework_now: [
          {
            item_id: "monitor-1",
            section_key: "monitoring_json",
            text: "Keep monitoring the medication situation.",
            action: "verify",
            action_reason: "Medication completion still needs direct confirmation.",
            source_signal_ids: ["medication-plan"],
          },
        ],
        retire_now: [],
        preserve_signal_ids: ["service-checkins"],
        avoid_signal_ids: [],
      },
    });

    expect(snapshot?.generation_brief?.writing_guardrails).toEqual(
      expect.arrayContaining([
        "Prefer routines that resemble Check-ins when the live evidence still supports them, because this client has responded better there.",
        "Keep Medication follow-through cautious and verification-led, because this client has shown weaker follow-through there.",
      ]),
    );
    expect(snapshot?.generation_brief?.section_briefs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          section_key: "daily_support_json",
          preserve_recommendations: expect.arrayContaining([
            expect.objectContaining({
              label: "Keep the morning check-in routine.",
            }),
          ]),
        }),
        expect.objectContaining({
          section_key: "monitoring_json",
          rewrite_recommendations: expect.arrayContaining([
            expect.objectContaining({
              label: "Keep monitoring the medication situation.",
              action: "verify",
            }),
          ]),
        }),
      ]),
    );
  });
});
