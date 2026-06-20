// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  assessHealthPlanGenerationGuardrail,
  applyHealthPlanGenerationGuardrail,
  assembleHealthPlanPromptInput,
  assembleRichHealthPlanSourceSignals,
  buildHealthPlanOpenAiRewritePrompt,
  buildHealthPlanReviewRewritePrompt,
  buildHealthPlanContextSnapshot,
  buildHealthPlanEvidenceDigest,
  buildHealthPlanEvidencePack,
  buildFallbackHealthPlan,
  buildHealthPlanGenerationAssessment,
  buildHealthPlanPlanMemory,
  buildHealthPlanQualitySummary,
  buildHealthPlanRouteLearning,
  buildHealthPlanVerificationContext,
  deriveHealthPlanRecommendationEvidenceReview,
  deriveHealthPlanRecommendationProvenanceMetadata,
  deriveHealthPlanRecommendationRationale,
  finalizeGeneratedHealthPlanCandidate,
  resolveGeneratedHealthPlanSaveCandidate,
  repairGeneratedHealthPlan,
  validateGeneratedHealthPlan,
} from "../../server/index.mjs";

function createFragileProfile(overrides = {}) {
  return {
    user: { language: "en", first_name: "Carmen", last_name: "Lopez", living_context: "alone", city: "Tarifa" },
    consent: { caretaker_consent: false, consent_given: false },
    health: { health_conditions: ["hypertension"], mobility_needs: ["walking support"] },
    medications: [
      {
        id: "med-1",
        medication_name: "Aspirin",
        dosage: "1 pill",
        purpose: "Pain",
        reminders_enabled: false,
        schedule_times: ["09:00"],
      },
    ],
    medicationActivity: { status: "missed", occurred_at: "2026-06-18T08:00:00.000Z" },
    checkins: { enabled: true, frequency: "daily", preferred_time: "09:00", last_outcome: "Missed" },
    brainCoach: { enabled: true, frequency: "weekly", preferred_time: "16:00", last_outcome: "Pending" },
    sensors: [{ id: "sensor-1", status: "offline", sensor_type: "watch", device_name: "Health Watch", last_reading_at: "2026-06-18T09:10:00.000Z" }],
    alerts: [{ id: "alert-1", severity: "high", message: "Client could not be reached", resolved_at: null, created_at: "2026-06-18T07:00:00.000Z" }],
    careProviders: [],
    ...overrides,
  };
}

function createPredictiveContext(riskBand = "high") {
  return {
    latestScore: {
      composite_score: 82,
      risk_band: riskBand,
      score_date: "2026-06-18",
      delta_from_prior: 9,
    },
    forecastRows: [{ horizon_day: 1, predicted_score: 84 }],
  };
}

function createOutcomeNotes() {
  return [
    `[2026-06-18T09:15:00.000Z - ana@redcross.example] #VYVA_OUTREACH {"audience":"client","channel":"phone","state":"ready"}`,
    `[2026-06-18T09:20:00.000Z - ana@redcross.example] #VYVA_HANDOFF {"priority":"high","responseWindow":"same_day","sharingBoundary":"staff_only","ownerName":"Ana Novak","ownerMissing":false,"careCircleCount":1,"activeAlertCount":1,"offlineSensorCount":1,"missedMedication":true,"highRisk":true,"actions":["confirm_today_touchpoint","review_alerts"]}`,
    `[2026-06-18T09:22:00.000Z - ana@redcross.example] #VYVA_HANDOFF_STATUS {"status":"owner_assigned","ownerName":"Ana Novak","responseWindow":"same_day"}`,
    `[2026-06-18T09:30:00.000Z - ana@redcross.example] #VYVA_INCIDENT {"code":"urgent_welfare_check","status":"open","ownerName":"Ana Novak","responseWindow":"same_day"}`,
  ].join("\n\n");
}

function createStalledOutcomeNotes() {
  return [
    `[2026-06-18T07:15:00.000Z - ana@redcross.example] #VYVA_OUTREACH {"audience":"client","channel":"phone","state":"ready"}`,
    `[2026-06-18T07:20:00.000Z - ana@redcross.example] #VYVA_HANDOFF {"priority":"high","responseWindow":"same_day","sharingBoundary":"staff_only","ownerName":"Ana Novak","ownerMissing":false,"careCircleCount":1,"activeAlertCount":1,"offlineSensorCount":1,"missedMedication":true,"highRisk":true,"actions":["confirm_today_touchpoint","review_alerts"]}`,
    `[2026-06-18T07:22:00.000Z - ana@redcross.example] #VYVA_HANDOFF_STATUS {"status":"owner_assigned","ownerName":"Ana Novak","responseWindow":"same_day"}`,
  ].join("\n\n");
}

function createRepeatedRouteOutcomeNotes() {
  return [
    `[2026-06-18T07:15:00.000Z - ana@redcross.example] #VYVA_OUTREACH {"audience":"client","channel":"phone","state":"ready"}`,
    `[2026-06-18T08:10:00.000Z - ana@redcross.example] #VYVA_OUTREACH {"audience":"client","channel":"phone","state":"ready"}`,
    `[2026-06-18T08:20:00.000Z - ana@redcross.example] #VYVA_HANDOFF {"priority":"high","responseWindow":"same_day","sharingBoundary":"approved_circle","ownerName":"Ana Novak","ownerMissing":false,"careCircleCount":2,"activeAlertCount":1,"offlineSensorCount":1,"missedMedication":true,"highRisk":true,"actions":["confirm_today_touchpoint","review_alerts","verify_medication"]}`,
    `[2026-06-18T08:22:00.000Z - ana@redcross.example] #VYVA_HANDOFF_STATUS {"status":"owner_assigned","ownerName":"Ana Novak","responseWindow":"same_day"}`,
  ].join("\n\n");
}

function createClosedOutcomeNotes() {
  return [
    `[2026-06-18T10:15:00.000Z - ana@redcross.example] #VYVA_OUTREACH {"audience":"client","channel":"phone","state":"ready"}`,
    `[2026-06-18T10:20:00.000Z - ana@redcross.example] #VYVA_HANDOFF {"priority":"high","responseWindow":"same_day","sharingBoundary":"staff_only","ownerName":"Ana Novak","ownerMissing":false,"careCircleCount":1,"activeAlertCount":0,"offlineSensorCount":0,"missedMedication":false,"highRisk":false,"actions":["confirm_today_touchpoint","close_loop"]}`,
    `[2026-06-18T10:22:00.000Z - ana@redcross.example] #VYVA_HANDOFF_STATUS {"status":"owner_assigned","ownerName":"Ana Novak","responseWindow":"same_day"}`,
    `[2026-06-18T10:28:00.000Z - ana@redcross.example] #VYVA_HANDOFF_STATUS {"status":"first_contact_made","ownerName":"Ana Novak","responseWindow":"same_day"}`,
    `[2026-06-18T10:35:00.000Z - ana@redcross.example] #VYVA_HANDOFF_STATUS {"status":"escalation_closed","ownerName":"Ana Novak","responseWindow":"same_day"}`,
    `[2026-06-18T10:36:00.000Z - ana@redcross.example] #VYVA_INCIDENT {"code":"urgent_welfare_check","status":"closed","ownerName":"Ana Novak","responseWindow":"same_day"}`,
  ].join("\n\n");
}

function createPlanMemory(overrides = {}) {
  return {
    has_existing_plan: true,
    current_plan: {
      current_version: 4,
      review_status: "draft",
      last_action_type: "edited",
      generation_confidence: "medium",
      generated_at: "2026-06-18T09:00:00.000Z",
      automated_review_verdict: "revise",
      approval_gate_state: "review",
      quality_trust_level: "medium",
      evidence_drift_without_rewrite: true,
      reopened_after_review: true,
      unresolved_required_actions: ["Add explicit escalation steps tied to unresolved alerts."],
      open_issue_codes: ["response_window_unclear"],
      watch_issue_codes: ["operational_review_pending"],
      changed_sections: ["monitoring"],
    },
    recent_versions: [
      {
        version_number: 4,
        action_type: "edited",
        created_at: "2026-06-18T09:00:00.000Z",
        review_status: "draft",
        generation_confidence: "medium",
        automated_review_verdict: "revise",
        changed_sections: ["monitoring"],
        entry_codes: ["evidence_inputs_changed", "content_stable_evidence_shifted", "review_reopened"],
        unresolved_required_actions: ["Add explicit escalation steps tied to unresolved alerts."],
        open_issue_codes: ["response_window_unclear"],
      },
      {
        version_number: 3,
        action_type: "regenerated",
        created_at: "2026-06-18T08:00:00.000Z",
        review_status: "reviewed",
        generation_confidence: "medium",
        automated_review_verdict: "revise",
        changed_sections: ["summary", "monitoring"],
        entry_codes: ["plan_regenerated"],
        unresolved_required_actions: ["Confirm a fresh touchpoint before sharing."],
        open_issue_codes: ["response_window_unclear"],
      },
    ],
    recurring_issue_codes: ["response_window_unclear"],
    repeated_tactic_families: ["risk_escalation", "verification"],
    learning_highlights: ["The most recent saved plan was still draft-only and had not yet reached an approved reviewed state."],
    planning_cautions: ["Do not carry forward polished wording unchanged when the live evidence underneath it has moved."],
    ...overrides,
  };
}

function createOutcomeLearningSnapshot(overrides = {}) {
  return {
    response_path: {
      handoff_open: true,
      first_contact_recorded: false,
      escalation_closed: false,
      repeated_client_channel: "phone",
      alternate_audience_open: true,
      care_circle_route_available: true,
      care_circle_route_used: false,
    },
    medications: [
      {
        medication_name: "Aspirin",
        reminders_enabled: true,
        schedule_times: ["09:00"],
      },
    ],
    medication_activity: { status: "missed" },
    checkins: { enabled: true, frequency: "daily", preferred_time: "09:00", last_outcome: "Missed" },
    brain_coach: { enabled: true, frequency: "weekly", preferred_time: "16:00", last_outcome: "Pending" },
    sensors: [{ device_name: "Health Watch", sensor_type: "watch", status: "offline" }],
    alerts: [{ severity: "high", message: "Client could not be reached", alert_type: "reachability" }],
    ...overrides,
  };
}

function createGroundedPlan() {
  return {
    summary_text: "This stabilizing plan keeps outreach, medication follow-up, and same-day escalation aligned with the latest risk picture while staff verify the live care picture and confirm follow-up ownership today.",
    summary_signal_ids: ["risk-latest-score", "alert-active", "consent-family-sharing"],
    goals_json: [
      {
        id: "goal-1",
        text: "Keep the client reachable and supported while the current high-risk picture is reviewed.",
        source_signal_ids: ["risk-latest-score", "forecast-near-term"],
      },
    ],
    daily_support_json: [
      {
        id: "daily-1",
        text: "Use the saved check-in and Brain Coach routines to keep contact steady through the day.",
        source_signal_ids: ["service-checkins", "service-brain-coach"],
      },
      {
        id: "daily-2",
        text: "Use the saved medication reminders and verify the missed-dose risk during follow-up.",
        source_signal_ids: ["medication-plan"],
      },
    ],
    monitoring_json: [
      {
        id: "monitor-1",
        text: "Review active alerts, keep sensor reliability as a separate check from medication adherence so offline devices do not create false reassurance, and confirm whether the saved check-in routine is still landing during today's follow-up. If the first verification lands, record what it confirms and what changed from baseline.",
        source_signal_ids: ["alert-active", "sensor-status", "service-checkins"],
      },
      {
        id: "monitor-2",
        text: "Track whether contact and medication adherence return to baseline today, and record whether follow-up confirms real progress or, if it does not, still needs same-day action.",
        source_signal_ids: ["risk-latest-score", "medication-plan"],
      },
    ],
    escalation_json: [
      {
        id: "escalation-1",
        text: "Escalate the same day if alerts persist, the client remains unreachable, medication follow-up still cannot confirm dose status, or sensor reliability still cannot be verified, and document whether the unresolved risk is client deterioration, missing data, or both along with the first receipt of contact or closure.",
        source_signal_ids: ["alert-active", "risk-latest-score", "medication-plan", "sensor-status"],
      },
      {
        id: "escalation-2",
        text: "Assign one named staff owner before the next outreach cycle and document who is following up.",
        source_signal_ids: ["care-circle-context", "consent-family-sharing"],
      },
    ],
    caregiver_guidance_json: [
      {
        id: "caregiver-1",
        text: "Keep client-specific updates within staff or approved providers until family consent is confirmed.",
        source_signal_ids: ["consent-family-sharing"],
      },
      {
        id: "caregiver-2",
        text: "Document the named owner for follow-up, keep that owner visible in the plan, and keep the care routine coordinated.",
        source_signal_ids: ["care-circle-context", "service-checkins"],
      },
    ],
  };
}

function createRawGroundedPlan() {
  const plan = createGroundedPlan();
  return {
    summary_text: plan.summary_text,
    summary_signal_ids: plan.summary_signal_ids,
    goals: plan.goals_json,
    daily_support: plan.daily_support_json,
    monitoring: plan.monitoring_json,
    escalation: plan.escalation_json,
    caregiver_guidance: plan.caregiver_guidance_json,
  };
}

describe("health plan generation hardening", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-18T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("labels thin and ownerless care context as low-confidence before generation", () => {
    const profile = createFragileProfile({
      checkins: { enabled: false, frequency: null, preferred_time: null, last_outcome: null },
      brainCoach: { enabled: false, frequency: null, preferred_time: null, last_outcome: null },
      sensors: [{ id: "sensor-1", status: "offline", sensor_type: "watch", device_name: "Health Watch", last_reading_at: null }],
    });
    const predictiveContext = { latestScore: null, forecastRows: [] };
    const sourceSignals = assembleRichHealthPlanSourceSignals(profile, predictiveContext);

    const assessment = buildHealthPlanGenerationAssessment(
      profile,
      predictiveContext,
      sourceSignals,
      { name: "Red Cross Leipzig", defaultLanguage: "en" },
    );

    expect(assessment.confidence).toBe("low");
    expect(assessment.readiness).toBe("review_and_enrich");
    expect(assessment.reasons.some((reason) => reason.code === "no_named_owner")).toBe(true);
  });

  it("builds explicit must-cover requirements for fragile care situations", () => {
    const profile = createFragileProfile();
    const predictiveContext = createPredictiveContext();
    const sourceSignals = assembleRichHealthPlanSourceSignals(profile, predictiveContext);
    const promptInput = assembleHealthPlanPromptInput(profile, predictiveContext, sourceSignals, "en", {
      name: "Red Cross Leipzig",
      defaultLanguage: "en",
    });
    const relaxedPromptInput = {
      ...promptInput,
      critical_signal_ids: [],
    };

    expect(promptInput.must_cover.map((item) => item.code)).toEqual([
      "respect_sharing_boundary",
      "assign_named_owner",
      "support_medication_followup",
      "review_active_alerts",
      "check_sensor_reliability",
      "separate_medication_from_signal_reliability",
      "maintain_service_routines",
      "branch_after_first_check",
      "anchor_accountability_receipts",
      "cover_high_risk_outlook",
      "stabilize_low_confidence_context",
    ]);
    expect(promptInput.must_cover.find((item) => item.code === "assign_named_owner")?.minimum_section_coverage).toBe(2);
    expect(promptInput.must_cover.find((item) => item.code === "separate_medication_from_signal_reliability")?.required_sections).toEqual(["monitoring", "escalation"]);
    expect(promptInput.must_cover.find((item) => item.code === "stabilize_low_confidence_context")?.required_sections).toEqual(["summary", "escalation"]);
    expect(promptInput.open_questions.some((item) => item.code === "owner-unconfirmed")).toBe(true);
    expect(promptInput.next_confirmations.some((item) => item.code === "confirm-owner")).toBe(true);
    expect(promptInput.decision_branches.length).toBeGreaterThan(0);
    expect(promptInput.section_guidance?.summary?.signal_ids?.length).toBeGreaterThan(0);
    expect(promptInput.section_guidance?.daily_support?.signal_ids).toEqual(
      expect.arrayContaining(["medication-plan", "service-checkins", "service-brain-coach"]),
    );
    expect(promptInput.section_guidance?.caregiver_guidance?.signal_ids).toEqual(
      expect.arrayContaining(["consent-family-sharing", "care-circle-context"]),
    );
    expect(promptInput.section_guidance?.summary?.evidence_posture).toBe("act_now");
    expect(promptInput.section_guidance?.monitoring?.evidence_posture).toBe("verify_first");
    expect(promptInput.section_guidance?.caregiver_guidance?.evidence_posture).toBe("boundary_limited");
    expect(promptInput.section_guidance?.monitoring?.evidence_gap_text).toMatch(/fresh confirmation|live care picture/i);
    expect(promptInput.section_guidance?.escalation?.success_criteria).toMatch(/when it triggers|proof closes it/i);
    expect(promptInput.section_evidence_bundles?.summary?.primary_signal_ids).toEqual(
      expect.arrayContaining(["risk-latest-score", "alert-active"]),
    );
    expect(promptInput.section_evidence_bundles?.monitoring?.coverage_targets?.some((item) => item.code === "monitoring-verification-gap")).toBe(true);
    expect(promptInput.section_evidence_bundles?.monitoring?.coverage_targets?.some((item) => item.code === "monitoring-response-path")).toBe(true);
    expect(promptInput.section_evidence_bundles?.escalation?.coverage_targets?.some((item) => item.code === "escalation-response-path")).toBe(true);
    expect(promptInput.section_evidence_bundles?.daily_support?.coverage_targets?.some((item) => item.code === "daily-support-routine")).toBe(true);
    expect(promptInput.section_evidence_bundles?.monitoring?.minimum_distinct_signal_count).toBe(2);
    expect(promptInput.section_evidence_bundles?.monitoring?.minimum_distinct_category_count).toBe(2);
    expect(promptInput.section_evidence_bundles?.monitoring?.unresolved_signal_ids).toEqual(
      expect.arrayContaining(["care-circle-context", "consent-family-sharing", "medication-plan"]),
    );
    expect(promptInput.section_evidence_bundles?.monitoring?.signal_cards?.[0]).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        label: expect.any(String),
        freshness: expect.any(String),
        why_it_matters: expect.any(String),
      }),
    );
    expect(promptInput.generation_assessment?.confidence).toBe("low");
    expect(promptInput.evidence_digest?.freshness_gap).toBe(false);
    expect(promptInput.source_signals.find((item) => item.id === "risk-latest-score")?.freshness).toBe("live");
  });

  it("derives recommendation rationale from section evidence bundle signal cards", () => {
    const profile = createFragileProfile();
    const predictiveContext = createPredictiveContext();
    const sourceSignals = assembleRichHealthPlanSourceSignals(profile, predictiveContext);
    const promptInput = assembleHealthPlanPromptInput(profile, predictiveContext, sourceSignals, "en", {
      name: "Red Cross Leipzig",
      defaultLanguage: "en",
    });

    const rationale = deriveHealthPlanRecommendationRationale(
      {
        id: "monitor-1",
        text: "Review the active alerts and keep the live picture verified.",
        source_signal_ids: ["alert-active"],
      },
      "monitoring",
      sourceSignals,
      { section_evidence_bundles: promptInput.section_evidence_bundles },
    );

    expect(rationale).toEqual(
      expect.objectContaining({
        recommendation_rationale_state: "inferred",
        recommendation_rationale_signal_labels: [expect.stringMatching(/active alert/i)],
      }),
    );
    expect(rationale?.recommendation_rationale_summary).toMatch(/active alert|live follow-up|today/i);
  });

  it("derives recommendation provenance from fresh evidence and supported history", () => {
    const profile = createFragileProfile({
      medications: [
        {
          id: "med-1",
          medication_name: "Aspirin",
          dosage: "1 pill",
          purpose: "Pain",
          reminders_enabled: true,
          schedule_times: ["09:00"],
        },
      ],
      medicationActivity: { status: "taken", occurred_at: "2026-06-18T10:00:00.000Z" },
      checkins: { enabled: true, frequency: "daily", preferred_time: "09:00", last_outcome: "Completed" },
      brainCoach: { enabled: true, frequency: "weekly", preferred_time: "16:00", last_outcome: "Completed" },
      sensors: [{ id: "sensor-1", status: "online", sensor_type: "watch", device_name: "Health Watch", last_reading_at: "2026-06-18T10:10:00.000Z" }],
      alerts: [],
    });
    const predictiveContext = createPredictiveContext("moderate");
    const planMemory = createPlanMemory({
      effective_tactic_families: ["service_routine"],
      family_outcome_learning: [
        {
          family: "service_routine",
          helped_count: 2,
          stalled_count: 0,
          recent_helped_count: 1,
          recent_stalled_count: 0,
          latest_outcome: "helped",
          consistency_state: "reliably_helpful",
          recency_state: "recently_helping",
        },
      ],
      contradicted_effective_tactic_families: [],
      stalled_tactic_families: [],
    });
    const sourceSignals = assembleRichHealthPlanSourceSignals(profile, predictiveContext, planMemory);
    const promptInput = assembleHealthPlanPromptInput(profile, predictiveContext, sourceSignals, "en", {
      name: "Red Cross Leipzig",
      defaultLanguage: "en",
    }, planMemory);

    const provenance = deriveHealthPlanRecommendationProvenanceMetadata(
      {
        id: "daily-strong",
        text: "Keep the check-in and Brain Coach routine steady today because that service pattern is still landing and helps preserve contact rhythm.",
        source_signal_ids: ["service-checkins", "service-brain-coach"],
        evidence_freshness: "live",
        evidence_conflict: "clear",
      },
      "daily_support",
      sourceSignals,
      { section_evidence_bundles: promptInput.section_evidence_bundles },
    );

    expect(["strong", "moderate"]).toContain(provenance.recommendation_provenance_strength);
    expect(provenance.recommendation_provenance_score).toBeGreaterThanOrEqual(58);
    expect(provenance.recommendation_provenance_reason_codes).toEqual(
      expect.arrayContaining(["fresh_live_evidence", "explicit_rationale", "supported_history"]),
    );
  });

  it("lets weak recommendation provenance pull down overall health-plan quality", () => {
    const profile = createFragileProfile({
      sensors: [{ id: "sensor-1", status: "offline", sensor_type: "watch", device_name: "Health Watch", last_reading_at: null }],
    });
    const predictiveContext = { latestScore: null, forecastRows: [] };
    const sourceSignals = assembleRichHealthPlanSourceSignals(profile, predictiveContext);
    const contextSnapshot = buildHealthPlanContextSnapshot(
      profile,
      predictiveContext,
      sourceSignals,
      "en",
      { name: "Red Cross Leipzig", defaultLanguage: "en" },
    );
    const weakPlan = {
      ...createGroundedPlan(),
      source_signals_json: sourceSignals,
      context_snapshot_json: contextSnapshot,
      monitoring_json: [
        {
          id: "monitor-weak",
          text: "Review this later.",
          source_signal_ids: ["context-live-profile-only"],
        },
      ],
      automated_review_json: {
        verdict: "revise",
        rubric_scores: {
          grounding: 70,
          actionability: 68,
          timeliness: 66,
          safety: 72,
          shareability: 74,
          overall: 69,
        },
        concerns: [],
        required_actions: [],
      },
    };

    const quality = buildHealthPlanQualitySummary(
      weakPlan,
      profile,
      predictiveContext,
      { name: "Red Cross Leipzig", defaultLanguage: "en" },
    );

    expect(quality.recommendation_provenance_weak_count).toBeGreaterThan(0);
    expect(quality.cautions.some((item) => item.code === "recommendations_provenance_weak")).toBe(true);
  });

  it("builds a focused rewrite prompt when deterministic validation rejects a generated draft", () => {
    const profile = createFragileProfile();
    const predictiveContext = createPredictiveContext();
    const sourceSignals = assembleRichHealthPlanSourceSignals(profile, predictiveContext);
    const promptInput = assembleHealthPlanPromptInput(profile, predictiveContext, sourceSignals, "en", {
      name: "Red Cross Leipzig",
      defaultLanguage: "en",
    });
    const relaxedPromptInput = {
      ...promptInput,
      critical_signal_ids: [],
    };
    const brittlePlan = {
      summary_text: "This plan keeps support steady today.",
      summary_signal_ids: ["risk-latest-score"],
      goals: [{ text: "Keep routines steady.", source_signal_ids: ["risk-latest-score"] }],
      daily_support: [{ text: "Keep routines steady.", source_signal_ids: ["medication-plan"] }],
      monitoring: [{ text: "Keep routines steady.", source_signal_ids: ["sensor-status"] }],
      escalation: [{ text: "Escalate if still concerning.", source_signal_ids: ["alert-active"] }],
      caregiver_guidance: [{ text: "Keep routines steady.", source_signal_ids: ["consent-family-sharing"] }],
    };

    const rewritePrompt = buildHealthPlanOpenAiRewritePrompt(
      promptInput,
      brittlePlan,
      "Health plan generation repeated generic language across too many sections",
      "en",
    );

    expect(rewritePrompt.systemPrompt).toMatch(/repair the candidate plan|validator feedback/i);
    expect(rewritePrompt.userPrompt).toContain("Health plan generation repeated generic language across too many sections");
    expect(rewritePrompt.userPrompt).toContain("\"candidate_plan\"");
    expect(rewritePrompt.userPrompt).toContain("\"prompt_input\"");
  });

  it("builds a blocked-review rewrite prompt from reviewer concerns and required actions", () => {
    const profile = createFragileProfile();
    const predictiveContext = createPredictiveContext();
    const sourceSignals = assembleRichHealthPlanSourceSignals(profile, predictiveContext);
    const promptInput = assembleHealthPlanPromptInput(profile, predictiveContext, sourceSignals, "en", {
      name: "Red Cross Leipzig",
      defaultLanguage: "en",
    });

    const rewritePrompt = buildHealthPlanReviewRewritePrompt(
      promptInput,
      createRawGroundedPlan(),
      {
        verdict: "block",
        summary_text: "Automated reviewer found blocking operational gaps.",
        grounded_signal_ids: ["alert-active", "risk-latest-score"],
        strengths: [],
        concerns: [{ code: "operational_review_blocked", severity: "high", detail: "The next owner and closure receipt are still missing." }],
        required_actions: ["Name the next owner and what receipt closes the follow-up loop."],
        shareability: "staff_only",
        rubric_scores: {
          grounding: 52,
          actionability: 34,
          timeliness: 60,
          safety: 58,
          shareability: 65,
          overall: 41,
        },
      },
      "en",
    );

    expect(rewritePrompt.systemPrompt).toMatch(/blocked it|required actions/i);
    expect(rewritePrompt.userPrompt).toContain("\"automated_review\"");
    expect(rewritePrompt.userPrompt).toContain("Name the next owner and what receipt closes the follow-up loop.");
  });

  it("finalizes a generated candidate through repair, enrichment, and validation with generator metadata", () => {
    const profile = createFragileProfile();
    const predictiveContext = createPredictiveContext();
    const sourceSignals = assembleRichHealthPlanSourceSignals(profile, predictiveContext);
    const promptInput = assembleHealthPlanPromptInput(profile, predictiveContext, sourceSignals, "en", {
      name: "Red Cross Leipzig",
      defaultLanguage: "en",
    });

    const finalized = finalizeGeneratedHealthPlanCandidate(
      {
        summary_text: createGroundedPlan().summary_text,
        summary_signal_ids: createGroundedPlan().summary_signal_ids,
        goals: createGroundedPlan().goals_json,
        daily_support: createGroundedPlan().daily_support_json,
        monitoring: createGroundedPlan().monitoring_json,
        escalation: createGroundedPlan().escalation_json,
        caregiver_guidance: createGroundedPlan().caregiver_guidance_json,
      },
      sourceSignals,
      promptInput,
      {
        provider: "openai",
        model: "gpt-test",
        version: "health-plan-v1-test",
      },
    );

    expect(finalized.generator_provider).toBe("openai");
    expect(finalized.generator_model).toBe("gpt-test");
    expect(finalized.generator_version).toBe("health-plan-v1-test");
    expect(finalized.monitoring_json[0]?.priority).toBeTruthy();
    expect(finalized.monitoring_json[0]?.due_window).toBeTruthy();
  });

  it("rewrites a blocked generated plan before save when the second pass clears review", async () => {
    const profile = createFragileProfile();
    const predictiveContext = createPredictiveContext();
    const sourceSignals = assembleRichHealthPlanSourceSignals(profile, predictiveContext);
    const promptInput = assembleHealthPlanPromptInput(profile, predictiveContext, sourceSignals, "en", {
      name: "Red Cross Leipzig",
      defaultLanguage: "en",
    });
    const blockedReview = {
      verdict: "block",
      summary_text: "Blocking gaps remain.",
      grounded_signal_ids: ["alert-active", "risk-latest-score"],
      strengths: [],
      concerns: [{ code: "operational_review_blocked", severity: "high", detail: "The urgent follow-up path is still too vague." }],
      required_actions: ["State the stronger same-day next move and what closes the loop."],
      shareability: "staff_only",
      rubric_scores: {
        grounding: 45,
        actionability: 30,
        timeliness: 58,
        safety: 55,
        shareability: 60,
        overall: 38,
      },
    };

    const resolved = await resolveGeneratedHealthPlanSaveCandidate(
      {
        generatedPlan: createGroundedPlan(),
        automatedReview: blockedReview,
        profile,
        predictiveContext,
        sourceSignals,
        language: "en",
        organization: { name: "Red Cross Leipzig", defaultLanguage: "en" },
        promptInput,
      },
      {
        canUseAiRewrite: true,
        rewriteStructuredPlan: async () => createRawGroundedPlan(),
        reviewPlan: async () => ({
          ...blockedReview,
          verdict: "revise",
          summary_text: "The rewritten plan is no longer blocked.",
          required_actions: ["Tighten one remaining wording detail before wider sharing."],
          rubric_scores: { ...blockedReview.rubric_scores, grounding: 71, actionability: 72, overall: 69 },
        }),
        buildFallbackPlanFn: () => ({
          ...createGroundedPlan(),
          generator_provider: "fallback",
          generator_model: "deterministic-template",
          generator_version: "fallback-test",
        }),
        buildFallbackReviewFn: () => ({
          ...blockedReview,
          summary_text: "Fallback review.",
        }),
      },
    );

    expect(resolved.strategy).toBe("rewritten_after_block");
    expect(resolved.plan.generator_version).toBe("health-plan-v1-review-rewrite-1");
    expect(resolved.automatedReview.verdict).toBe("revise");
  });

  it("rewrites a revise-grade generated plan before save when the second pass materially improves quality", async () => {
    const profile = createFragileProfile();
    const predictiveContext = createPredictiveContext();
    const sourceSignals = assembleRichHealthPlanSourceSignals(profile, predictiveContext);
    const promptInput = assembleHealthPlanPromptInput(profile, predictiveContext, sourceSignals, "en", {
      name: "Red Cross Leipzig",
      defaultLanguage: "en",
    });
    const reviseReview = {
      verdict: "revise",
      summary_text: "The plan is usable but still too vague for staff to rely on cleanly.",
      grounded_signal_ids: ["alert-active", "risk-latest-score"],
      strengths: [],
      concerns: [{ code: "plan_actionability_weak", severity: "high", detail: "Owner, branching, and closure proof are still too implicit." }],
      required_actions: [
        "Name the owner and follow-up branch more explicitly.",
        "Say what receipt closes the urgent loop.",
      ],
      shareability: "staff_only",
      rubric_scores: {
        grounding: 66,
        actionability: 52,
        timeliness: 63,
        safety: 70,
        shareability: 72,
        overall: 61,
      },
    };

    const resolved = await resolveGeneratedHealthPlanSaveCandidate(
      {
        generatedPlan: createGroundedPlan(),
        automatedReview: reviseReview,
        profile,
        predictiveContext,
        sourceSignals,
        language: "en",
        organization: { name: "Red Cross Leipzig", defaultLanguage: "en" },
        promptInput,
      },
      {
        canUseAiRewrite: true,
        rewriteStructuredPlan: async () => createRawGroundedPlan(),
        reviewPlan: async () => ({
          ...reviseReview,
          summary_text: "The rewritten plan is materially more actionable and grounded.",
          concerns: [],
          required_actions: ["Tighten one minor wording detail before wider sharing."],
          rubric_scores: { ...reviseReview.rubric_scores, grounding: 78, actionability: 76, timeliness: 74, overall: 74 },
        }),
      },
    );

    expect(resolved.strategy).toBe("rewritten_after_revise");
    expect(resolved.plan.generator_version).toBe("health-plan-v1-review-rewrite-1");
    expect(resolved.automatedReview.rubric_scores?.overall).toBe(74);
  });

  it("keeps the original revise-grade generated plan when the rewrite does not materially improve quality", async () => {
    const profile = createFragileProfile();
    const predictiveContext = createPredictiveContext();
    const sourceSignals = assembleRichHealthPlanSourceSignals(profile, predictiveContext);
    const promptInput = assembleHealthPlanPromptInput(profile, predictiveContext, sourceSignals, "en", {
      name: "Red Cross Leipzig",
      defaultLanguage: "en",
    });
    const reviseReview = {
      verdict: "revise",
      summary_text: "The plan is usable but still too vague for staff to rely on cleanly.",
      grounded_signal_ids: ["alert-active", "risk-latest-score"],
      strengths: [],
      concerns: [{ code: "plan_actionability_weak", severity: "high", detail: "Owner, branching, and closure proof are still too implicit." }],
      required_actions: ["Name the owner and follow-up branch more explicitly."],
      shareability: "staff_only",
      rubric_scores: {
        grounding: 66,
        actionability: 52,
        timeliness: 63,
        safety: 70,
        shareability: 72,
        overall: 61,
      },
    };
    const generatedPlan = {
      ...createGroundedPlan(),
      generator_provider: "openai",
      generator_model: "gpt-test",
      generator_version: "health-plan-v1-original",
    };

    const resolved = await resolveGeneratedHealthPlanSaveCandidate(
      {
        generatedPlan,
        automatedReview: reviseReview,
        profile,
        predictiveContext,
        sourceSignals,
        language: "en",
        organization: { name: "Red Cross Leipzig", defaultLanguage: "en" },
        promptInput,
      },
      {
        canUseAiRewrite: true,
        rewriteStructuredPlan: async () => createRawGroundedPlan(),
        reviewPlan: async () => ({
          ...reviseReview,
          summary_text: "The rewrite is different, but not meaningfully stronger.",
          required_actions: ["Name the owner and follow-up branch more explicitly."],
          rubric_scores: { ...reviseReview.rubric_scores, grounding: 67, actionability: 54, overall: 63 },
        }),
      },
    );

    expect(resolved.strategy).toBe("accepted");
    expect(resolved.plan.generator_version).toBe("health-plan-v1-original");
    expect(resolved.automatedReview.summary_text).toContain("usable");
  });

  it("falls back when the blocked-review rewrite still cannot clear quality gates", async () => {
    const profile = createFragileProfile();
    const predictiveContext = createPredictiveContext();
    const sourceSignals = assembleRichHealthPlanSourceSignals(profile, predictiveContext);
    const promptInput = assembleHealthPlanPromptInput(profile, predictiveContext, sourceSignals, "en", {
      name: "Red Cross Leipzig",
      defaultLanguage: "en",
    });
    const blockedReview = {
      verdict: "block",
      summary_text: "Blocking gaps remain.",
      grounded_signal_ids: ["alert-active", "risk-latest-score"],
      strengths: [],
      concerns: [{ code: "operational_review_blocked", severity: "high", detail: "The urgent follow-up path is still too vague." }],
      required_actions: ["State the stronger same-day next move and what closes the loop."],
      shareability: "staff_only",
      rubric_scores: {
        grounding: 45,
        actionability: 30,
        timeliness: 58,
        safety: 55,
        shareability: 60,
        overall: 38,
      },
    };

    const resolved = await resolveGeneratedHealthPlanSaveCandidate(
      {
        generatedPlan: createGroundedPlan(),
        automatedReview: blockedReview,
        profile,
        predictiveContext,
        sourceSignals,
        language: "en",
        organization: { name: "Red Cross Leipzig", defaultLanguage: "en" },
        promptInput,
      },
      {
        canUseAiRewrite: true,
        rewriteStructuredPlan: async () => createRawGroundedPlan(),
        reviewPlan: async () => blockedReview,
        buildFallbackPlanFn: () => ({
          ...createGroundedPlan(),
          generator_provider: "fallback",
          generator_model: "deterministic-template",
          generator_version: "fallback-test",
        }),
        buildFallbackReviewFn: () => ({
          ...blockedReview,
          summary_text: "Fallback review.",
          required_actions: ["Use the deterministic fallback plan instead of the blocked rewrite."],
        }),
      },
    );

    expect(resolved.strategy).toBe("fallback_after_block");
    expect(resolved.plan.generator_provider).toBe("fallback");
    expect(resolved.plan.generator_version).toBe("fallback-test");
  });

  it("builds a richer deterministic fallback plan when the live picture is too fragile for AI drafting", () => {
    const profile = createFragileProfile();
    const predictiveContext = createPredictiveContext();
    const sourceSignals = assembleRichHealthPlanSourceSignals(profile, predictiveContext);

    const fallbackPlan = buildFallbackHealthPlan(profile, predictiveContext, sourceSignals, "en", {
      name: "Red Cross Leipzig",
      defaultLanguage: "en",
    });

    expect(fallbackPlan.summary_text).toMatch(/stabilizing draft|same-day|start with/i);
    expect(fallbackPlan.monitoring_json.some((item) =>
      item.priority === "high"
      && item.due_window === "same_day"
      && item.owner_label
      && item.completion_proof)).toBe(true);
    expect(fallbackPlan.escalation_json.some((item) =>
      item.priority === "high"
      && item.owner_label
      && item.completion_proof
      && item.escalation_if_not_done)).toBe(true);
    expect(fallbackPlan.caregiver_guidance_json.some((item) =>
      /staff|approved providers|consent/i.test(item.text))).toBe(true);
  });

  it("keeps medication adherence risk separate from signal-reliability risk in fallback plans when both are active", () => {
    const profile = createFragileProfile();
    const predictiveContext = createPredictiveContext();
    const sourceSignals = assembleRichHealthPlanSourceSignals(profile, predictiveContext);

    const fallbackPlan = buildFallbackHealthPlan(profile, predictiveContext, sourceSignals, "en", {
      name: "Red Cross Leipzig",
      defaultLanguage: "en",
    });

    const operationalText = [
      ...fallbackPlan.monitoring_json.map((item) => item.text),
      ...fallbackPlan.escalation_json.map((item) => item.text),
    ].join(" ");

    expect(operationalText).toMatch(/separate checks|separate check|missing data|false reassurance|both/i);
    expect(fallbackPlan.monitoring_json.some((item) => item.source_task_code === "reconcile_medication_vs_signal_reliability")).toBe(true);
    expect(fallbackPlan.escalation_json.some((item) => item.source_task_code === "reconcile_medication_vs_signal_reliability")).toBe(true);
  });

  it("uses route-specific fallback guidance when the direct contact path is already stalling", () => {
    const profile = createFragileProfile({
      consent: { caretaker_consent: true, consent_given: true },
      user: {
        language: "en",
        first_name: "Carmen",
        last_name: "Lopez",
        living_context: "alone",
        city: "Tarifa",
        emergency_notes: createRepeatedRouteOutcomeNotes(),
      },
      careProviders: [
        { id: "cp-1", provider_type: "field_staff", display_name: "Ana Novak", is_primary: true },
        { id: "cp-2", provider_type: "caregiver", display_name: "Sofia Lopez", is_primary: true },
      ],
    });
    const predictiveContext = createPredictiveContext();
    const sourceSignals = assembleRichHealthPlanSourceSignals(profile, predictiveContext);

    const fallbackPlan = buildFallbackHealthPlan(profile, predictiveContext, sourceSignals, "en", {
      name: "Red Cross Leipzig",
      defaultLanguage: "en",
    });
    const fallbackText = [
      fallbackPlan.summary_text,
      ...fallbackPlan.monitoring_json.map((item) => item.text),
      ...fallbackPlan.escalation_json.map((item) => item.text),
    ].join(" ");

    expect(fallbackText).toMatch(/approved care-circle route|care-circle route|care circle route/i);
    expect(
      fallbackPlan.monitoring_json.some((item) => item.source_task_code === "contact_client")
      || fallbackPlan.escalation_json.some((item) => item.source_task_code === "contact_client"),
    ).toBe(true);
  });

  it("carries urgent accountability commitments into prompt input and must-cover rules", () => {
    const profile = createFragileProfile();
    const predictiveContext = createPredictiveContext();
    const sourceSignals = assembleRichHealthPlanSourceSignals(profile, predictiveContext);
    const promptInput = assembleHealthPlanPromptInput(profile, predictiveContext, sourceSignals, "en", {
      name: "Red Cross Leipzig",
      defaultLanguage: "en",
    });

    expect(promptInput.accountability_commitments.some((item) => /^contact[-_]client$/.test(item.code))).toBe(true);
    expect(promptInput.accountability_commitments.some((item) => /^review[-_]alerts$/.test(item.code))).toBe(true);
    expect(promptInput.accountability_commitments.some((item) =>
      typeof item.proof_hint === "string" && item.proof_hint.includes("Counts as done"))).toBe(true);
    expect(promptInput.must_cover.some((item) => item.code === "anchor_accountability_receipts")).toBe(true);
    expect(promptInput.must_cover.find((item) => item.code === "anchor_accountability_receipts")?.required_sections).toEqual([
      "monitoring",
      "escalation",
    ]);
    expect(promptInput.must_cover.find((item) => item.code === "anchor_accountability_receipts")?.minimum_section_coverage).toBe(2);
  });

  it("derives explicit known facts, open questions, and next confirmations for the care team", () => {
    const profile = createFragileProfile();
    const predictiveContext = createPredictiveContext();
    const sourceSignals = assembleRichHealthPlanSourceSignals(profile, predictiveContext);

    const verificationContext = buildHealthPlanVerificationContext(
      profile,
      predictiveContext,
      sourceSignals,
      { name: "Red Cross Leipzig", defaultLanguage: "en" },
    );

    expect(verificationContext.known_facts.some((item) => item.code === "predictive-risk-high")).toBe(true);
    expect(verificationContext.open_questions.some((item) => item.code === "sharing-boundary-open")).toBe(true);
    expect(verificationContext.next_confirmations.some((item) => item.code === "confirm-medication-status")).toBe(true);
    expect(verificationContext.next_confirmations.some((item) => item.code === "confirm-owner")).toBe(true);
  });

  it("captures a durable context snapshot for later audit and replay", () => {
    const profile = createFragileProfile();
    const predictiveContext = createPredictiveContext();
    const sourceSignals = assembleRichHealthPlanSourceSignals(profile, predictiveContext);
    const snapshot = buildHealthPlanContextSnapshot(
      profile,
      predictiveContext,
      sourceSignals,
      "en",
      { name: "Red Cross Leipzig", defaultLanguage: "en", timezone: "Europe/Berlin" },
      new Date("2026-06-18T10:15:00.000Z"),
    );

    expect(snapshot?.snapshot_version).toBe("health-plan-context-v1");
    expect(snapshot?.captured_at).toBe("2026-06-18T10:15:00.000Z");
    expect(snapshot?.policy?.response_expectation).toBe("same-day review");
    expect(snapshot?.critical_signal_ids).toContain("alert-active");
    expect(snapshot?.must_cover.some((item) => item.code === "assign_named_owner")).toBe(true);
    expect(snapshot?.known_facts.some((item) => item.code === "predictive-risk-high")).toBe(true);
    expect(snapshot?.open_questions.some((item) => item.code === "owner-unconfirmed")).toBe(true);
    expect(snapshot?.next_confirmations.some((item) => item.code === "confirm-owner")).toBe(true);
    expect(snapshot?.generation_assessment?.confidence).toBe("low");
    expect(snapshot?.evidence_digest?.top_priority_signal_ids?.length).toBeGreaterThan(0);
    expect(snapshot?.evidence_digest?.top_priority_signals?.[0]?.priority_score).toBeGreaterThan(0);
    expect(snapshot?.section_evidence_bundles?.summary?.signal_cards?.length).toBeGreaterThan(0);
    expect(snapshot?.section_evidence_bundles?.monitoring?.signal_cards?.[0]).toEqual(
      expect.objectContaining({
        priority_score: expect.any(Number),
        priority_reason_codes: expect.any(Array),
      }),
    );
    expect(snapshot?.section_evidence_bundles?.monitoring?.verification_focus).toMatch(/verification explicit|fresh confirmation/i);
    expect(snapshot?.source_signals.some((signal) => signal.id === "risk-latest-score")).toBe(true);
  });

  it("prioritizes live operational signals ahead of calmer predictive context in the evidence digest", () => {
    const profile = createFragileProfile({
      careProviders: [{ id: "cp-1", provider_type: "field_staff", display_name: "Ana Novak", is_primary: true }],
      user: {
        language: "en",
        first_name: "Carmen",
        last_name: "Lopez",
        living_context: "alone",
        city: "Tarifa",
        emergency_notes: createOutcomeNotes(),
      },
    });
    const predictiveContext = createPredictiveContext("medium");
    const sourceSignals = assembleRichHealthPlanSourceSignals(profile, predictiveContext);
    const digest = buildHealthPlanEvidenceDigest(sourceSignals);

    expect(sourceSignals[0]?.priority_score).toBeGreaterThanOrEqual(sourceSignals[sourceSignals.length - 1]?.priority_score || 0);
    expect(digest.top_priority_signals?.[0]).toEqual(
      expect.objectContaining({
        priority_score: expect.any(Number),
        priority_reason_codes: expect.any(Array),
      }),
    );
    expect(sourceSignals.findIndex((signal) => signal.id === "alert-active")).toBeLessThan(
      sourceSignals.findIndex((signal) => signal.id === "risk-latest-score"),
    );
    expect(sourceSignals.findIndex((signal) => signal.id === "outcome-handoff-open")).toBeLessThan(
      sourceSignals.findIndex((signal) => signal.id === "forecast-near-term"),
    );
    expect(digest.top_priority_signal_ids.indexOf("alert-active")).toBeGreaterThanOrEqual(0);
    expect(digest.top_priority_signal_ids.indexOf("outcome-handoff-open")).toBeGreaterThanOrEqual(0);
  });

  it("builds a compact evidence pack so generation starts from the strongest live signals", () => {
    const profile = createFragileProfile({
      consent: { caretaker_consent: true, consent_given: true },
      careProviders: [{ id: "cp-1", provider_type: "field_staff", display_name: "Ana Novak", is_primary: true }],
      sensors: [{ id: "sensor-1", status: "online", sensor_type: "watch", device_name: "Health Watch", last_reading_at: "2026-06-18T10:10:00.000Z" }],
      alerts: [{ id: "alert-1", severity: "high", message: "Client could not be reached", resolved_at: null, created_at: "2026-06-18T09:20:00.000Z" }],
      medicationActivity: { status: "missed", occurred_at: "2026-06-18T09:00:00.000Z" },
    });
    const predictiveContext = createPredictiveContext("high");
    const sourceSignals = assembleRichHealthPlanSourceSignals(profile, predictiveContext);
    const promptInput = assembleHealthPlanPromptInput(profile, predictiveContext, sourceSignals, "en", {
      name: "Red Cross Leipzig",
      defaultLanguage: "en",
    });

    expect(promptInput.evidence_pack?.primary_signal_ids).toEqual(
      expect.arrayContaining(["alert-active", "risk-latest-score", "medication-plan"]),
    );
    expect(promptInput.evidence_pack?.action_signal_ids).toEqual(
      expect.arrayContaining(["alert-active", "medication-plan"]),
    );
    expect(promptInput.evidence_pack?.verification_signal_ids).toEqual(
      expect.arrayContaining(["medication-plan"]),
    );
    expect(promptInput.evidence_pack?.background_signal_ids?.length).toBeGreaterThan(0);
    expect(promptInput.evidence_pack?.background_signal_ids).toContain("forecast-near-term");
    expect(
      (promptInput.evidence_pack?.deemphasized_signal_ids || []).every((signalId) =>
        !promptInput.evidence_pack?.primary_signal_ids?.includes(signalId)),
    ).toBe(true);
    expect(promptInput.evidence_pack?.focus_summary_text).toMatch(/action-driving signals|primary signals/i);
    expect(promptInput.evidence_pack?.caution_summary_text).toMatch(/verification|stabilizing signals|background context/i);
    expect(promptInput.evidence_pack?.primary_signals?.[0]).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        priority_score: expect.any(Number),
        priority_reason_codes: expect.any(Array),
      }),
    );
    expect(promptInput.evidence_pack?.action_signals?.[0]).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        priority_score: expect.any(Number),
      }),
    );
  });

  it("persists the evidence pack in the context snapshot for replay and audit", () => {
    const profile = createFragileProfile({
      careProviders: [{ id: "cp-1", provider_type: "field_staff", display_name: "Ana Novak", is_primary: true }],
    });
    const predictiveContext = createPredictiveContext("medium");
    const sourceSignals = assembleRichHealthPlanSourceSignals(profile, predictiveContext);
    const evidencePack = buildHealthPlanEvidencePack(sourceSignals, {
      criticalSignalIds: ["alert-active", "risk-latest-score"],
      verificationContext: buildHealthPlanVerificationContext(profile, predictiveContext, sourceSignals, { name: "Red Cross Leipzig", defaultLanguage: "en" }),
      evidenceDigest: buildHealthPlanEvidenceDigest(sourceSignals),
      generationAssessment: buildHealthPlanGenerationAssessment(profile, predictiveContext, sourceSignals, { name: "Red Cross Leipzig", defaultLanguage: "en" }),
    });
    const snapshot = buildHealthPlanContextSnapshot(
      profile,
      predictiveContext,
      sourceSignals,
      "en",
      { name: "Red Cross Leipzig", defaultLanguage: "en" },
      new Date("2026-06-18T10:15:00.000Z"),
    );

    expect(evidencePack?.primary_signal_ids?.length).toBeGreaterThan(0);
    expect(snapshot?.evidence_pack?.primary_signal_ids).toEqual(
      expect.arrayContaining(["alert-active", "medication-plan", "sensor-status"]),
    );
    expect(snapshot?.evidence_pack?.action_signal_ids).toEqual(
      expect.arrayContaining(["alert-active", "sensor-status"]),
    );
    expect(snapshot?.evidence_pack?.primary_signals?.[0]).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        priority_score: expect.any(Number),
      }),
    );
  });

  it("splits action-driving, stabilizing, and caution evidence so generation can preserve what helps without hiding what is slipping", () => {
    const profile = createFragileProfile({
      consent: { caretaker_consent: true, consent_given: true },
      careProviders: [{ id: "cp-1", provider_type: "field_staff", display_name: "Ana Novak", is_primary: true }],
      medications: [
        {
          id: "med-1",
          medication_name: "Aspirin",
          dosage: "1 pill",
          purpose: "Pain",
          reminders_enabled: true,
          schedule_times: ["09:00"],
        },
      ],
      medicationActivity: { status: "taken", occurred_at: "2026-06-18T10:00:00.000Z" },
      checkins: { enabled: true, frequency: "daily", preferred_time: "09:00", last_outcome: "Completed" },
      brainCoach: { enabled: true, frequency: "weekly", preferred_time: "16:00", last_outcome: "Completed" },
      sensors: [{ id: "sensor-1", status: "offline", sensor_type: "watch", device_name: "Health Watch", last_reading_at: "2026-06-18T10:10:00.000Z" }],
      alerts: [{ id: "alert-1", severity: "high", message: "Client could not be reached", resolved_at: null, created_at: "2026-06-18T09:20:00.000Z" }],
    });
    const predictiveContext = createPredictiveContext("high");
    const planMemory = createPlanMemory({
      effective_tactic_families: ["service_routine"],
      contradicted_effective_tactic_families: ["sensor_reliability"],
      stalled_tactic_families: ["contact_path"],
      family_outcome_learning: [
        {
          family: "service_routine",
          helped_count: 3,
          stalled_count: 0,
          recent_helped_count: 2,
          recent_stalled_count: 0,
          latest_outcome: "helped",
          consistency_state: "reliably_helpful",
          recency_state: "recently_helping",
        },
        {
          family: "sensor_reliability",
          helped_count: 0,
          stalled_count: 2,
          recent_helped_count: 0,
          recent_stalled_count: 1,
          latest_outcome: "stalled",
          consistency_state: "reliably_stalled",
          recency_state: "recently_slipping",
        },
      ],
    });
    const sourceSignals = assembleRichHealthPlanSourceSignals(profile, predictiveContext, planMemory);
    const promptInput = assembleHealthPlanPromptInput(profile, predictiveContext, sourceSignals, "en", {
      name: "Red Cross Leipzig",
      defaultLanguage: "en",
    }, planMemory);

    expect(promptInput.evidence_pack?.action_signal_ids).toEqual(
      expect.arrayContaining(["alert-active", "sensor-status", "risk-latest-score"]),
    );
    expect(promptInput.evidence_pack?.stabilizing_signal_ids).toEqual(
      expect.arrayContaining(["service-checkins", "service-brain-coach"]),
    );
    expect(promptInput.evidence_pack?.caution_signal_ids).toEqual(
      expect.arrayContaining(["sensor-status"]),
    );
    expect(promptInput.evidence_pack?.stabilizing_signals?.some((signal) =>
      Array.isArray(signal?.supported_tactic_families) && signal.supported_tactic_families.includes("service_routine"))).toBe(true);
    expect(promptInput.evidence_pack?.caution_signals?.some((signal) =>
      Array.isArray(signal?.contradicted_tactic_families) && signal.contradicted_tactic_families.includes("sensor_reliability"))).toBe(true);
    expect(promptInput.evidence_pack?.focus_summary_text).toMatch(/action-driving/i);
    expect(promptInput.evidence_pack?.caution_summary_text).toMatch(/stabilizing|contradicted|stalled|certainty/i);
  });

  it("adds route learning so generation can prefer the care-circle path when the direct route stalls", () => {
    const profile = createFragileProfile({
      user: {
        language: "en",
        first_name: "Carmen",
        last_name: "Lopez",
        living_context: "alone",
        city: "Tarifa",
        emergency_notes: createRepeatedRouteOutcomeNotes(),
      },
      careProviders: [{ id: "cp-1", provider_type: "field_staff", display_name: "Ana Novak", is_primary: true }],
    });
    const predictiveContext = createPredictiveContext();
    const planMemory = createPlanMemory({
      family_execution_learning: [
        {
          family: "sharing_boundary",
          learning_state: "validated",
          tracked_count: 1,
          confirmed_count: 1,
          deferred_count: 0,
          escalated_count: 0,
          open_count: 0,
          latest_updated_at: new Date().toISOString(),
          detail: "1 confirmed",
        },
      ],
    });
    const sourceSignals = assembleRichHealthPlanSourceSignals(profile, predictiveContext, planMemory);
    const routeLearning = buildHealthPlanRouteLearning(profile, sourceSignals, {
      name: "Red Cross Leipzig",
      defaultLanguage: "en",
    }, planMemory);
    const promptInput = assembleHealthPlanPromptInput(profile, predictiveContext, sourceSignals, "en", {
      name: "Red Cross Leipzig",
      defaultLanguage: "en",
    }, planMemory);

    expect(routeLearning?.preferred_route).toBe("approved_care_circle");
    expect(routeLearning?.confidence).toBe("high");
    expect(routeLearning?.supporting_signal_ids).toEqual(
      expect.arrayContaining(["execution-care-circle-route-open"]),
    );
    expect(routeLearning?.proof_requirement_text).toMatch(/approved care-circle outreach/i);
    expect(promptInput.route_learning?.preferred_route).toBe("approved_care_circle");
    expect(promptInput.route_learning?.summary_text).toMatch(/care-circle path|blocked route/i);
  });

  it("repairs alternate-route wording with route-specific follow-through instead of generic fallback text", () => {
    const profile = createFragileProfile({
      user: {
        language: "en",
        first_name: "Carmen",
        last_name: "Lopez",
        living_context: "alone",
        city: "Tarifa",
        emergency_notes: createRepeatedRouteOutcomeNotes(),
      },
      careProviders: [{ id: "cp-1", provider_type: "field_staff", display_name: "Ana Novak", is_primary: true }],
    });
    const predictiveContext = createPredictiveContext();
    const planMemory = createPlanMemory({
      family_execution_learning: [
        {
          family: "sharing_boundary",
          learning_state: "validated",
          tracked_count: 1,
          confirmed_count: 1,
          deferred_count: 0,
          escalated_count: 0,
          open_count: 0,
          latest_updated_at: new Date().toISOString(),
          detail: "1 confirmed",
        },
      ],
    });
    const sourceSignals = assembleRichHealthPlanSourceSignals(profile, predictiveContext, planMemory);
    const promptInput = assembleHealthPlanPromptInput(profile, predictiveContext, sourceSignals, "en", {
      name: "Red Cross Leipzig",
      defaultLanguage: "en",
    }, planMemory);

    const repaired = repairGeneratedHealthPlan(createGroundedPlan(), sourceSignals, promptInput);
    const validated = validateGeneratedHealthPlan(repaired, sourceSignals, promptInput);

    expect(validated.monitoring_json.some((item) =>
      /approved care-circle/i.test(item.text)
      && item.source_signal_ids?.includes("execution-care-circle-route-open"))).toBe(true);
    expect(validated.escalation_json.some((item) =>
      /approved care-circle/i.test(item.text)
      && item.source_signal_ids?.includes("execution-care-circle-route-open"))).toBe(true);
  });

  it("lets older validated route proof decay so the next plan still asks for a fresh receipt", () => {
    const profile = createFragileProfile({
      user: {
        language: "en",
        first_name: "Carmen",
        last_name: "Lopez",
        living_context: "alone",
        city: "Tarifa",
        emergency_notes: createRepeatedRouteOutcomeNotes(),
      },
      careProviders: [{ id: "cp-1", provider_type: "field_staff", display_name: "Ana Novak", is_primary: true }],
    });
    const predictiveContext = createPredictiveContext();
    const planMemory = createPlanMemory({
      family_execution_learning: [
        {
          family: "sharing_boundary",
          learning_state: "validated",
          tracked_count: 1,
          confirmed_count: 1,
          deferred_count: 0,
          escalated_count: 0,
          open_count: 0,
          latest_updated_at: new Date(Date.now() - (30 * 60 * 60 * 1000)).toISOString(),
          detail: "1 confirmed",
        },
      ],
    });
    const sourceSignals = assembleRichHealthPlanSourceSignals(profile, predictiveContext, planMemory);
    const routeLearning = buildHealthPlanRouteLearning(profile, sourceSignals, {
      name: "Red Cross Leipzig",
      defaultLanguage: "en",
    }, planMemory);

    expect(routeLearning?.preferred_route).toBe("approved_care_circle");
    expect(routeLearning?.confidence).toBe("medium");
    expect(routeLearning?.route_cautions.some((item) => /fresh receipt|older than the current response window/i.test(item))).toBe(true);
    expect(sourceSignals.find((signal) => signal.id === "consent-family-sharing")?.usefulness_reason_codes).toEqual(
      expect.arrayContaining(["family_receipts_stale"]),
    );
  });

  it("weights evidence by tactic history so supported patterns and cautions surface more clearly", () => {
    const baseProfile = createFragileProfile();
    const profile = {
      ...baseProfile,
      user: {
        ...baseProfile.user,
        emergency_notes: createStalledOutcomeNotes(),
      },
      careProviders: [{ id: "cp-1", provider_type: "field_staff", display_name: "Ana Novak", is_primary: true }],
    };
    const predictiveContext = createPredictiveContext("medium");
    const planMemory = createPlanMemory({
      effective_tactic_families: ["service_routine"],
      contradicted_effective_tactic_families: ["medication_followup"],
      effective_tactic_contradictions: [
        {
          family: "medication_followup",
          reason_code: "medication_followup_open",
          detail: "Medication follow-up still shows missed, late, disabled, or unconfirmed reminder coverage.",
        },
      ],
      stalled_tactic_families: ["contact_path"],
      repeated_tactic_families: [],
    });

    const baselineSignals = assembleRichHealthPlanSourceSignals(profile, predictiveContext);
    const weightedSignals = assembleRichHealthPlanSourceSignals(profile, predictiveContext, planMemory);
    const digest = buildHealthPlanEvidenceDigest(weightedSignals);
    const baselineServiceSignal = baselineSignals.find((signal) => signal.id === "service-checkins");
    const weightedServiceSignal = weightedSignals.find((signal) => signal.id === "service-checkins");
    const weightedMedicationSignal = weightedSignals.find((signal) => signal.id === "medication-plan");
    const weightedContactPathSignal = weightedSignals.find((signal) => signal.id === "execution-contact-path-weak");

    expect(weightedServiceSignal?.priority_score).toBeGreaterThan(baselineServiceSignal?.priority_score || 0);
    expect(weightedServiceSignal?.usefulness_reason_codes).toContain("historically_effective_pattern");
    expect(weightedServiceSignal?.supported_tactic_families).toContain("service_routine");
    expect(weightedMedicationSignal?.usefulness_reason_codes).toContain("historically_effective_now_contradicted");
    expect(weightedMedicationSignal?.contradicted_tactic_families).toContain("medication_followup");
    expect(weightedContactPathSignal?.usefulness_reason_codes).toContain("historically_stalled_pattern");
    expect(weightedContactPathSignal?.stalled_tactic_families).toContain("contact_path");
    expect(digest.usefulness_summary_text).toMatch(/stalled|contradicted/i);
    expect(digest.historically_supported_signal_ids).toContain("service-checkins");
    expect(digest.historically_caution_signal_ids).toEqual(
      expect.arrayContaining(["medication-plan", "execution-contact-path-weak"]),
    );
    expect(digest.top_priority_signals?.some((signal) =>
      signal.usefulness_reason_codes?.includes("historically_effective_now_contradicted")
      || signal.usefulness_reason_codes?.includes("historically_stalled_pattern"))).toBe(true);
  });

  it("lets recent tactic behavior outweigh older history when a family is slipping or recovering", () => {
    const profile = createFragileProfile({
      careProviders: [{ id: "cp-1", provider_type: "field_staff", display_name: "Ana Novak", is_primary: true }],
    });
    const predictiveContext = createPredictiveContext("medium");
    const planMemory = createPlanMemory({
      effective_tactic_families: ["service_routine", "medication_followup"],
      stalled_tactic_families: ["contact_path"],
      family_outcome_learning: [
        {
          family: "service_routine",
          helped_count: 2,
          stalled_count: 1,
          recent_helped_count: 0,
          recent_stalled_count: 1,
          latest_outcome: "stalled",
          consistency_state: "mixed",
          recency_state: "recently_slipping",
          detail: "This tactic family helped before but the latest outcome stalled.",
        },
        {
          family: "medication_followup",
          helped_count: 1,
          stalled_count: 1,
          recent_helped_count: 1,
          recent_stalled_count: 0,
          latest_outcome: "helped",
          consistency_state: "mixed",
          recency_state: "recently_recovered",
          detail: "This tactic family stalled before but the latest outcome recovered.",
        },
      ],
    });

    const sourceSignals = assembleRichHealthPlanSourceSignals(profile, predictiveContext, planMemory);
    const promptInput = assembleHealthPlanPromptInput(profile, predictiveContext, sourceSignals, "en", {
      name: "Red Cross Leipzig",
      defaultLanguage: "en",
    }, planMemory);

    expect(promptInput.plan_memory?.family_outcome_learning).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ family: "service_routine", recency_state: "recently_slipping" }),
        expect.objectContaining({ family: "medication_followup", recency_state: "recently_recovered" }),
      ]),
    );
    expect(sourceSignals.find((signal) => signal.id === "service-checkins")?.usefulness_reason_codes).toEqual(
      expect.arrayContaining(["family_outcomes_recently_slipping"]),
    );
    expect(sourceSignals.find((signal) => signal.id === "medication-plan")?.usefulness_reason_codes).toEqual(
      expect.arrayContaining(["family_outcomes_recently_recovered"]),
    );
  });

  it("derives recommendation-level evidence review receipts from linked signals and open confirmations", () => {
    const profile = createFragileProfile();
    const predictiveContext = createPredictiveContext();
    const sourceSignals = assembleRichHealthPlanSourceSignals(profile, predictiveContext);
    const snapshot = buildHealthPlanContextSnapshot(
      profile,
      predictiveContext,
      sourceSignals,
      "en",
      { name: "Red Cross Leipzig", defaultLanguage: "en" },
      new Date("2026-06-18T10:15:00.000Z"),
    );

    const urgentReceipt = deriveHealthPlanRecommendationEvidenceReview(
      {
        id: "monitor-1",
        text: "Review active alerts and confirm whether first contact lands today.",
        source_signal_ids: ["alert-active", "risk-latest-score"],
      },
      "monitoring",
      sourceSignals,
      snapshot,
    );
    const verifyFirstReceipt = deriveHealthPlanRecommendationEvidenceReview(
      {
        id: "caregiver-1",
        text: "Keep client-specific updates within staff until consent is confirmed.",
        source_signal_ids: ["consent-family-sharing"],
      },
      "caregiver_guidance",
      sourceSignals,
      snapshot,
    );

    expect(urgentReceipt?.evidence_review_state).toBe("urgent_review");
    expect(urgentReceipt?.evidence_review_reason_codes).toEqual(
      expect.arrayContaining(["urgent_signal_linked"]),
    );
    expect(urgentReceipt?.evidence_review_summary).toMatch(/urgent review/i);
    expect(verifyFirstReceipt?.evidence_review_state).toBe("verify_first");
    expect(verifyFirstReceipt?.evidence_review_reason_codes).toEqual(
      expect.arrayContaining(["sharing_boundary_open"]),
    );
    expect(verifyFirstReceipt?.evidence_review_summary).toMatch(/verify first|sharing boundary/i);
  });

  it("flags stale critical evidence and forces a fresh-touchpoint requirement", () => {
    const profile = createFragileProfile({
      medicationActivity: { status: "missed", occurred_at: "2026-06-14T08:00:00.000Z" },
      alerts: [{ id: "alert-1", severity: "high", message: "Client could not be reached", resolved_at: null, created_at: "2026-06-14T07:00:00.000Z" }],
      sensors: [{ id: "sensor-1", status: "offline", sensor_type: "watch", device_name: "Health Watch", last_reading_at: "2026-06-14T06:00:00.000Z" }],
    });
    const predictiveContext = createPredictiveContext();
    const sourceSignals = assembleRichHealthPlanSourceSignals(profile, predictiveContext);
    const promptInput = assembleHealthPlanPromptInput(profile, predictiveContext, sourceSignals, "en", {
      name: "Red Cross Leipzig",
      defaultLanguage: "en",
    });

    expect(sourceSignals.find((signal) => signal.id === "alert-active")?.freshness).toBe("stale");
    expect(promptInput.evidence_digest?.freshness_gap).toBe(true);
    expect(promptInput.generation_assessment?.stale_signal_count).toBeGreaterThan(0);
    expect(promptInput.generation_assessment?.reasons?.some((reason) => reason.code === "critical_signals_stale")).toBe(true);
    expect(promptInput.must_cover.some((item) => item.code === "refresh_live_status")).toBe(true);
    expect(promptInput.generation_contract?.must_acknowledge_freshness_gap).toBe(true);
    expect(promptInput.generation_contract?.summary_required_signal_ids).toEqual(
      expect.arrayContaining(["alert-active"]),
    );
    expect(promptInput.generation_contract?.monitoring_obligations?.some((item) => /fresh verification|touchpoint/i.test(item))).toBe(true);
  });

  it("uses source-specific freshness windows so predictive risk can stay usable after an older alert has already gone stale", () => {
    const profile = createFragileProfile({
      alerts: [{ id: "alert-1", severity: "high", message: "Client could not be reached", resolved_at: null, created_at: "2026-06-17T06:00:00.000Z" }],
      sensors: [],
    });
    const predictiveContext = {
      latestScore: {
        composite_score: 82,
        risk_band: "high",
        score_date: "2026-06-17",
        delta_from_prior: 5,
      },
      forecastRows: [],
    };

    const sourceSignals = assembleRichHealthPlanSourceSignals(profile, predictiveContext);

    expect(sourceSignals.find((signal) => signal.id === "alert-active")?.freshness).toBe("stale");
    expect(sourceSignals.find((signal) => signal.id === "risk-latest-score")?.freshness).toBe("recent");
  });

  it("forces the plan to reconcile mixed predictive, passive, and live operational evidence", () => {
    const profile = createFragileProfile({
      user: {
        language: "en",
        first_name: "Carmen",
        last_name: "Lopez",
        living_context: "alone",
        city: "Tarifa",
        emergency_notes: createStalledOutcomeNotes(),
      },
      careProviders: [{ id: "cp-1", provider_type: "field_staff", display_name: "Ana Novak", is_primary: true }],
      sensors: [{ id: "sensor-1", status: "online", sensor_type: "watch", device_name: "Health Watch", last_reading_at: "2026-06-18T11:20:00.000Z" }],
      alerts: [{ id: "alert-1", severity: "high", message: "Client could not be reached", resolved_at: null, created_at: "2026-06-18T10:30:00.000Z" }],
      medicationActivity: { status: "missed", occurred_at: "2026-06-18T10:00:00.000Z" },
    });
    const predictiveContext = {
      latestScore: {
        composite_score: 28,
        risk_band: "low",
        score_date: "2026-06-18",
        delta_from_prior: -6,
      },
      forecastRows: [{ horizon_day: 1, predicted_score: 26, model_confidence: 0.78 }],
    };
    const sourceSignals = assembleRichHealthPlanSourceSignals(profile, predictiveContext);
    const verificationContext = buildHealthPlanVerificationContext(
      profile,
      predictiveContext,
      sourceSignals,
      { name: "Red Cross Leipzig", defaultLanguage: "en" },
    );
    const promptInput = assembleHealthPlanPromptInput(profile, predictiveContext, sourceSignals, "en", {
      name: "Red Cross Leipzig",
      defaultLanguage: "en",
    });

    expect(sourceSignals.some((signal) => signal.id === "evidence-predictive-live-mismatch")).toBe(true);
    expect(sourceSignals.some((signal) => signal.id === "evidence-passive-signal-conflict")).toBe(true);
    expect(verificationContext.open_questions.some((item) => item.code === "predictive-live-mismatch")).toBe(true);
    expect(verificationContext.open_questions.some((item) => item.code === "passive-signal-conflict")).toBe(true);
    expect(verificationContext.next_confirmations.some((item) => item.code === "confirm-live-risk-before-downscaling")).toBe(true);
    expect(verificationContext.next_confirmations.some((item) => item.code === "reconcile-passive-and-live-signals")).toBe(true);
    expect(promptInput.must_cover.some((item) => item.code === "reconcile_conflicting_evidence")).toBe(true);
    expect(promptInput.generation_assessment?.reasons?.some((reason) => reason.code === "conflicting_risk_story")).toBe(true);
    expect(promptInput.generation_assessment?.reasons?.some((reason) => reason.code === "passive_signals_conflict")).toBe(true);

    expect(() => validateGeneratedHealthPlan(createGroundedPlan(), sourceSignals, promptInput)).toThrow(
      /missed required care coverage|did not name an alternate route/i,
    );

    const repaired = repairGeneratedHealthPlan(createGroundedPlan(), sourceSignals, promptInput);
    const validated = validateGeneratedHealthPlan(repaired, sourceSignals, promptInput);

    expect(
      validated.summary_signal_ids.some((signalId) =>
        signalId === "evidence-predictive-live-mismatch" || signalId === "evidence-passive-signal-conflict")
      || validated.monitoring_json.some((item) =>
        item.source_signal_ids?.includes("evidence-predictive-live-mismatch") || item.source_signal_ids?.includes("evidence-passive-signal-conflict"))
      || validated.escalation_json.some((item) =>
        item.source_signal_ids?.includes("evidence-predictive-live-mismatch") || item.source_signal_ids?.includes("evidence-passive-signal-conflict"))
    ).toBe(true);
  });

  it("feeds prior plan history into prompt memory, source signals, and review confidence", () => {
    const profile = createFragileProfile({
      careProviders: [{ id: "cp-1", provider_type: "field_staff", display_name: "Ana Novak", is_primary: true }],
    });
    const predictiveContext = createPredictiveContext();
    const planMemory = createPlanMemory();
    const sourceSignals = assembleRichHealthPlanSourceSignals(profile, predictiveContext, planMemory);
    const promptInput = assembleHealthPlanPromptInput(profile, predictiveContext, sourceSignals, "en", {
      name: "Red Cross Leipzig",
      defaultLanguage: "en",
    }, planMemory);
    const snapshot = buildHealthPlanContextSnapshot(
      profile,
      predictiveContext,
      sourceSignals,
      "en",
      { name: "Red Cross Leipzig", defaultLanguage: "en", timezone: "Europe/Berlin" },
      new Date("2026-06-18T10:20:00.000Z"),
      planMemory,
    );

    expect(sourceSignals.some((signal) => signal.id === "plan-memory-review-open")).toBe(true);
    expect(sourceSignals.some((signal) => signal.id === "plan-memory-review-actions")).toBe(true);
    expect(sourceSignals.some((signal) => signal.id === "plan-memory-evidence-drift")).toBe(true);
    expect(sourceSignals.some((signal) => signal.id === "plan-memory-recurring-issues")).toBe(true);
    expect(sourceSignals.some((signal) => signal.id === "plan-memory-repeated-tactics")).toBe(true);
    expect(promptInput.plan_memory?.current_plan?.review_status).toBe("draft");
    expect(promptInput.change_context?.must_explain_changes).toBe(true);
    expect(promptInput.change_context?.reason_codes).toEqual(expect.arrayContaining([
      "evidence_shifted",
      "review_reopened",
      "repeated_tactics",
    ]));
    expect(Array.isArray(promptInput.plan_memory?.repeated_tactic_families)).toBe(true);
    expect(promptInput.plan_memory?.repeated_tactic_families?.length).toBeGreaterThan(0);
    expect(promptInput.must_cover.some((item) => item.code === "resolve_prior_plan_gaps")).toBe(true);
    expect(promptInput.must_cover.some((item) => item.code === "differentiate_repeated_tactic")).toBe(true);
    expect(promptInput.must_cover.some((item) => item.code === "explain_material_change")).toBe(true);
    expect(promptInput.generation_contract?.must_acknowledge_material_change).toBe(true);
    expect(promptInput.generation_contract?.summary_required_signal_ids).toEqual(
      expect.arrayContaining(["plan-memory-evidence-drift"]),
    );
    expect(promptInput.open_questions.some((item) => item.code === "prior-review-actions-open")).toBe(true);
    expect(promptInput.open_questions.some((item) => item.code === "prior-plan-evidence-drift")).toBe(true);
    expect(promptInput.open_questions.some((item) => item.code === "prior-tactic-repetition")).toBe(true);
    expect(promptInput.next_confirmations.some((item) => item.code === "resolve-prior-review-actions")).toBe(true);
    expect(promptInput.next_confirmations.some((item) => item.code === "differentiate-next-tactic")).toBe(true);
    expect(promptInput.generation_assessment?.reasons?.some((reason) => reason.code === "prior_plan_not_reviewed")).toBe(true);
    expect(promptInput.generation_assessment?.reasons?.some((reason) => reason.code === "prior_review_actions_open")).toBe(true);
    expect(promptInput.generation_assessment?.reasons?.some((reason) => reason.code === "prior_plan_evidence_shifted")).toBe(true);
    expect(promptInput.generation_assessment?.reasons?.some((reason) => reason.code === "recurring_plan_gaps")).toBe(true);
    expect(promptInput.generation_assessment?.reasons?.some((reason) => reason.code === "repeated_tactic_pattern")).toBe(true);
    expect(promptInput.section_guidance?.summary?.focus_text).toMatch(/changed|previous plan|baseline/i);
    expect(promptInput.section_guidance?.summary?.caution_text).toMatch(/settled|cleanly|changed/i);
    expect(promptInput.section_guidance?.summary?.success_criteria).toMatch(/today|support window|remaining uncertainty/i);
    expect(snapshot?.plan_memory?.current_plan?.evidence_drift_without_rewrite).toBe(true);
    expect(snapshot?.change_context?.must_explain_changes).toBe(true);
    expect(snapshot?.section_guidance?.summary?.signal_ids?.length).toBeGreaterThan(0);
  });

  it("forces regenerated plans to explain what changed when evidence or tactics shifted", () => {
    const profile = createFragileProfile({
      careProviders: [{ id: "cp-1", provider_type: "field_staff", display_name: "Ana Novak", is_primary: true }],
      user: {
        language: "en",
        first_name: "Carmen",
        last_name: "Lopez",
        living_context: "alone",
        city: "Tarifa",
        emergency_notes: createRepeatedRouteOutcomeNotes(),
      },
    });
    const predictiveContext = createPredictiveContext();
    const planMemory = createPlanMemory();
    const sourceSignals = assembleRichHealthPlanSourceSignals(profile, predictiveContext, planMemory);
    const promptInput = assembleHealthPlanPromptInput(profile, predictiveContext, sourceSignals, "en", {
      name: "Red Cross Leipzig",
      defaultLanguage: "en",
    }, planMemory);

    expect(promptInput.change_context?.must_explain_changes).toBe(true);
    expect(promptInput.must_cover.some((item) => item.code === "explain_material_change")).toBe(true);

    expect(() => validateGeneratedHealthPlan(createGroundedPlan(), sourceSignals, promptInput)).toThrow(
      /missed required care coverage|specific guidance|did not explain the material change/i,
    );

    const repaired = repairGeneratedHealthPlan(createGroundedPlan(), sourceSignals, promptInput);
    const validated = validateGeneratedHealthPlan(repaired, sourceSignals, promptInput);

    expect(validated.summary_signal_ids).toEqual(
      expect.arrayContaining(["plan-memory-evidence-drift"]),
    );
    expect(validated.monitoring_json.some((item) =>
      /changed|previous plan|baseline|different/i.test(item.text)
      && (
        item.source_signal_ids?.includes("plan-memory-evidence-drift")
        || item.source_signal_ids?.includes("plan-memory-reopened")
        || item.source_signal_ids?.includes("plan-memory-repeated-tactics")
      ))).toBe(true);
  });

  it("uses the generation contract to repair and reject summaries that hide material change", () => {
    const profile = createFragileProfile({
      careProviders: [{ id: "cp-1", provider_type: "field_staff", display_name: "Ana Novak", is_primary: true }],
      user: {
        language: "en",
        first_name: "Carmen",
        last_name: "Lopez",
        living_context: "alone",
        city: "Tarifa",
        emergency_notes: createRepeatedRouteOutcomeNotes(),
      },
    });
    const predictiveContext = createPredictiveContext();
    const planMemory = createPlanMemory();
    const sourceSignals = assembleRichHealthPlanSourceSignals(profile, predictiveContext, planMemory);
    const promptInput = assembleHealthPlanPromptInput(profile, predictiveContext, sourceSignals, "en", {
      name: "Red Cross Leipzig",
      defaultLanguage: "en",
    }, planMemory);

    const repaired = repairGeneratedHealthPlan(createGroundedPlan(), sourceSignals, promptInput);
    expect(repaired.summary_signal_ids.some((signalId) =>
      promptInput.generation_contract?.summary_required_signal_ids?.includes(signalId))).toBe(true);

    const contractBlindSummaryPlan = {
      ...repaired,
      summary_text: "This plan keeps support steady today.",
      summary_signal_ids: ["risk-latest-score", "alert-active"],
    };

    expect(() => validateGeneratedHealthPlan(contractBlindSummaryPlan, sourceSignals, promptInput)).toThrow(
      /summary missed required grounding|did not explain the material change/i,
    );
  });

  it("turns weak prior review dimensions into concrete repair targets for the next generated plan", () => {
    const profile = createFragileProfile({
      careProviders: [{ id: "cp-1", provider_type: "field_staff", display_name: "Ana Novak", is_primary: true }],
    });
    const predictiveContext = createPredictiveContext();
    const currentPlan = {
      id: "plan-rubric-1",
      current_version: 6,
      review_status: "draft",
      last_action_type: "edited",
      generation_confidence: "medium",
      generated_at: "2026-06-18T10:45:00.000Z",
      change_summary_json: { changed_sections: ["summary", "monitoring"] },
      automated_review_json: {
        verdict: "revise",
        checked_at: "2026-06-18T10:55:00.000Z",
        summary_text: "The plan still needs stronger grounding and actionability.",
        grounded_signal_ids: ["risk-latest-score", "alert-active"],
        strengths: [],
        concerns: [],
        required_actions: ["Name the next owner, timing branch, and proof of completion."],
        shareability: "staff_only",
        rubric_scores: {
          grounding: 42,
          actionability: 35,
          timeliness: 68,
          safety: 76,
          shareability: 70,
          overall: 49,
        },
        provider: "fallback",
        model: "deterministic-review",
        version: "health-plan-v1-review-fallback",
      },
      review_attestation_json: {
        watch_issue_codes: ["operational_review_pending"],
      },
      context_snapshot_json: createOutcomeLearningSnapshot(),
    };
    const inferredPlanMemory = buildHealthPlanPlanMemory(currentPlan, [], profile);
    const sourceSignals = assembleRichHealthPlanSourceSignals(profile, predictiveContext, inferredPlanMemory);
    const promptInput = assembleHealthPlanPromptInput(profile, predictiveContext, sourceSignals, "en", {
      name: "Red Cross Leipzig",
      defaultLanguage: "en",
    }, inferredPlanMemory);

    expect(inferredPlanMemory.current_plan?.weak_review_dimensions).toEqual(
      expect.arrayContaining(["actionability", "grounding"]),
    );
    expect(sourceSignals.some((signal) => signal.id === "plan-memory-actionability-weak")).toBe(true);
    expect(sourceSignals.some((signal) => signal.id === "plan-memory-grounding-weak")).toBe(true);
    expect(promptInput.must_cover.some((item) => item.code === "raise_operational_actionability")).toBe(true);
    expect(promptInput.must_cover.some((item) => item.code === "strengthen_live_grounding")).toBe(true);
    expect(promptInput.open_questions.some((item) => item.code === "prior-plan-actionability-weak")).toBe(true);
    expect(promptInput.open_questions.some((item) => item.code === "prior-plan-grounding-weak")).toBe(true);
    expect(promptInput.next_confirmations.some((item) => item.code === "make-next-plan-actionable")).toBe(true);
    expect(promptInput.next_confirmations.some((item) => item.code === "strengthen-next-plan-grounding")).toBe(true);

    expect(() => validateGeneratedHealthPlan(createGroundedPlan(), sourceSignals, promptInput)).toThrow(
      /missed required care coverage|did not explain the material change/i,
    );

    const repaired = repairGeneratedHealthPlan(createGroundedPlan(), sourceSignals, promptInput);
    const validated = validateGeneratedHealthPlan(repaired, sourceSignals, promptInput);

    expect(validated.summary_signal_ids).toContain("plan-memory-grounding-weak");
    expect(validated.monitoring_json.some((item) =>
      item.source_signal_ids?.includes("plan-memory-actionability-weak")
      || item.source_signal_ids?.includes("plan-memory-grounding-weak"))).toBe(true);
    expect(validated.escalation_json.some((item) =>
      item.source_signal_ids?.includes("plan-memory-actionability-weak"))).toBe(true);
  });

  it("adds a why-this-matters-now sentence when urgent grounding is still weak", () => {
    const profile = createFragileProfile({
      careProviders: [{ id: "cp-1", provider_type: "field_staff", display_name: "Ana Novak", is_primary: true }],
    });
    const predictiveContext = createPredictiveContext();
    const currentPlan = {
      id: "plan-rubric-1",
      current_version: 6,
      review_status: "draft",
      last_action_type: "edited",
      generation_confidence: "medium",
      generated_at: "2026-06-18T10:45:00.000Z",
      automated_review_json: {
        verdict: "revise",
        checked_at: "2026-06-18T10:55:00.000Z",
        summary_text: "The plan still needs stronger grounding.",
        grounded_signal_ids: ["risk-latest-score", "alert-active"],
        strengths: [],
        concerns: [],
        required_actions: ["Tie the next monitoring step more clearly to the live evidence driving it."],
        shareability: "staff_only",
        rubric_scores: {
          grounding: 40,
          actionability: 54,
          timeliness: 68,
          safety: 76,
          shareability: 70,
          overall: 52,
        },
        provider: "fallback",
        model: "deterministic-review",
        version: "health-plan-v1-review-fallback",
      },
      review_attestation_json: {
        watch_issue_codes: ["operational_review_pending"],
      },
      context_snapshot_json: createOutcomeLearningSnapshot(),
    };
    const inferredPlanMemory = buildHealthPlanPlanMemory(currentPlan, [], profile);
    const sourceSignals = assembleRichHealthPlanSourceSignals(profile, predictiveContext, inferredPlanMemory);
    const promptInput = assembleHealthPlanPromptInput(profile, predictiveContext, sourceSignals, "en", {
      name: "Red Cross Leipzig",
      defaultLanguage: "en",
    }, inferredPlanMemory);
    const brittlePlan = {
      ...createGroundedPlan(),
      monitoring_json: [
        {
          id: "monitor-1",
          text: "Review the current care picture.",
          source_signal_ids: ["plan-memory-grounding-weak", "alert-active"],
        },
      ],
    };
    const expectedRationale = deriveHealthPlanRecommendationRationale(
      brittlePlan.monitoring_json[0],
      "monitoring",
      sourceSignals,
      promptInput,
    )?.recommendation_rationale_summary;

    const repaired = repairGeneratedHealthPlan(brittlePlan, sourceSignals, promptInput);

    expect(expectedRationale).toBeTruthy();
    expect(repaired.monitoring_json[0]?.text).toContain("Review the current care picture.");
    expect(repaired.monitoring_json[0]?.text).toContain(expectedRationale);
  });

  it("forces the next plan to change course when later live evidence shows the previous plan was followed by a worse care burden", () => {
    const worsenedProfile = createFragileProfile({
      user: {
        language: "en",
        first_name: "Carmen",
        last_name: "Lopez",
        living_context: "alone",
        city: "Tarifa",
        emergency_notes: createStalledOutcomeNotes(),
      },
      careProviders: [{ id: "cp-1", provider_type: "field_staff", display_name: "Ana Novak", is_primary: true }],
    });
    const predictiveContext = createPredictiveContext();
    const currentPlan = {
      id: "plan-outcome-1",
      current_version: 7,
      review_status: "reviewed",
      last_action_type: "edited",
      generation_confidence: "medium",
      generated_at: "2026-06-18T09:30:00.000Z",
      change_summary_json: { changed_sections: ["summary", "escalation"] },
      automated_review_json: {
        verdict: "revise",
        required_actions: ["Escalate sooner if the live picture worsens."],
      },
      review_attestation_json: { watch_issue_codes: [] },
      context_snapshot_json: createOutcomeLearningSnapshot({
        response_path: {
          handoff_open: false,
          first_contact_recorded: true,
          escalation_closed: true,
          repeated_client_channel: null,
          alternate_audience_open: false,
          care_circle_route_available: true,
          care_circle_route_used: true,
        },
        medications: [
          {
            medication_name: "Aspirin",
            reminders_enabled: true,
            schedule_times: ["09:00"],
          },
        ],
        medication_activity: { status: "taken" },
        checkins: { enabled: true, frequency: "daily", preferred_time: "09:00", last_outcome: "Completed" },
        brain_coach: { enabled: true, frequency: "weekly", preferred_time: "16:00", last_outcome: "Completed" },
        sensors: [{ device_name: "Health Watch", sensor_type: "watch", status: "online" }],
        alerts: [],
      }),
    };
    const inferredPlanMemory = buildHealthPlanPlanMemory(currentPlan, [], worsenedProfile);
    const sourceSignals = assembleRichHealthPlanSourceSignals(worsenedProfile, predictiveContext, inferredPlanMemory);
    const promptInput = assembleHealthPlanPromptInput(worsenedProfile, predictiveContext, sourceSignals, "en", {
      name: "Red Cross Leipzig",
      defaultLanguage: "en",
    }, inferredPlanMemory);

    expect(inferredPlanMemory.current_plan?.outcome_trajectory).toBe("worsened");
    expect(sourceSignals.some((signal) => signal.id === "plan-memory-outcome-worsened")).toBe(true);
    expect(promptInput.must_cover.some((item) => item.code === "change_course_after_worsening")).toBe(true);
    expect(promptInput.known_facts.some((item) => item.code === "prior-plan-outcome-worsened")).toBe(true);
    expect(promptInput.next_confirmations.some((item) => item.code === "change-course-after-worsening")).toBe(true);
    expect(promptInput.generation_assessment?.reasons?.some((reason) => reason.code === "prior_plan_outcome_worsened")).toBe(true);

    expect(() => validateGeneratedHealthPlan(createGroundedPlan(), sourceSignals, promptInput)).toThrow(
      /missed required care coverage|did not explain the material change/i,
    );

    const repaired = repairGeneratedHealthPlan(createGroundedPlan(), sourceSignals, promptInput);
    const validated = validateGeneratedHealthPlan(repaired, sourceSignals, promptInput);

    expect(validated.summary_signal_ids).toContain("plan-memory-outcome-worsened");
    expect(validated.monitoring_json.some((item) =>
      item.source_signal_ids?.includes("plan-memory-outcome-worsened"))).toBe(true);
    expect(
      validated.escalation_json.some((item) => item.source_signal_ids?.includes("plan-memory-outcome-worsened"))
      || validated.summary_signal_ids.includes("plan-memory-outcome-worsened"),
    ).toBe(true);
  }, 10000);

  it("treats prior improvement as reusable only when fresh operational receipts actually confirm it", () => {
    const improvedProfile = createFragileProfile({
      medications: [
        {
          id: "med-1",
          medication_name: "Aspirin",
          dosage: "1 pill",
          purpose: "Pain",
          reminders_enabled: true,
          schedule_times: ["09:00"],
        },
      ],
      medicationActivity: { status: "taken", occurred_at: "2026-06-18T10:40:00.000Z" },
      checkins: { enabled: true, frequency: "daily", preferred_time: "09:00", last_outcome: "Completed" },
      brainCoach: { enabled: true, frequency: "weekly", preferred_time: "16:00", last_outcome: "Completed" },
      sensors: [{ id: "sensor-1", status: "online", sensor_type: "watch", device_name: "Health Watch", last_reading_at: "2026-06-18T10:45:00.000Z" }],
      alerts: [],
      user: {
        language: "en",
        first_name: "Carmen",
        last_name: "Lopez",
        living_context: "alone",
        city: "Tarifa",
        emergency_notes: createClosedOutcomeNotes(),
      },
    });
    const predictiveContext = createPredictiveContext();
    const currentPlan = {
      id: "plan-improved-verified",
      current_version: 9,
      review_status: "reviewed",
      last_action_type: "edited",
      generation_confidence: "medium",
      generated_at: "2026-06-18T09:30:00.000Z",
      context_snapshot_json: createOutcomeLearningSnapshot(),
    };

    const inferredPlanMemory = buildHealthPlanPlanMemory(currentPlan, [], improvedProfile);
    const sourceSignals = assembleRichHealthPlanSourceSignals(improvedProfile, predictiveContext, inferredPlanMemory);
    const promptInput = assembleHealthPlanPromptInput(improvedProfile, predictiveContext, sourceSignals, "en", {
      name: "Red Cross Leipzig",
      defaultLanguage: "en",
    }, inferredPlanMemory);

    expect(inferredPlanMemory.current_plan?.outcome_trajectory).toBe("improved");
    expect(inferredPlanMemory.current_plan?.outcome_confidence_state).toBe("verified");
    expect(inferredPlanMemory.current_plan?.outcome_confidence_reason_codes).toEqual(
      expect.arrayContaining(["fresh_live_evidence", "first_contact_recorded", "escalation_closed", "handoff_closed"]),
    );
    expect(sourceSignals.find((signal) => signal.id === "plan-memory-outcome-improved")?.usefulness_reason_codes).toEqual(
      expect.arrayContaining(["outcome_improvement_verified"]),
    );
    expect(promptInput.known_facts.some((item) => item.code === "prior-plan-outcome-improved")).toBe(true);
    expect(promptInput.open_questions.some((item) => item.code === "prior-plan-outcome-improved-needs-confirmation")).toBe(false);
    expect(promptInput.generation_assessment?.reasons?.some((reason) => reason.code === "prior_plan_improvement_unverified")).toBe(false);
  });

  it("keeps prior improvement in verification mode when the calmer picture is not backed by explicit receipts", () => {
    const improvedProfile = createFragileProfile({
      medications: [
        {
          id: "med-1",
          medication_name: "Aspirin",
          dosage: "1 pill",
          purpose: "Pain",
          reminders_enabled: true,
          schedule_times: ["09:00"],
        },
      ],
      medicationActivity: { status: "taken", occurred_at: "2026-06-18T10:40:00.000Z" },
      checkins: { enabled: true, frequency: "daily", preferred_time: "09:00", last_outcome: "Completed" },
      brainCoach: { enabled: true, frequency: "weekly", preferred_time: "16:00", last_outcome: "Completed" },
      sensors: [{ id: "sensor-1", status: "online", sensor_type: "watch", device_name: "Health Watch", last_reading_at: "2026-06-18T10:45:00.000Z" }],
      alerts: [],
      user: {
        language: "en",
        first_name: "Carmen",
        last_name: "Lopez",
        living_context: "alone",
        city: "Tarifa",
        emergency_notes: "",
      },
    });
    const predictiveContext = createPredictiveContext("moderate");
    const currentPlan = {
      id: "plan-improved-inferred",
      current_version: 9,
      review_status: "reviewed",
      last_action_type: "edited",
      generation_confidence: "medium",
      generated_at: "2026-06-18T09:30:00.000Z",
      context_snapshot_json: createOutcomeLearningSnapshot({
        response_path: {
          handoff_open: false,
          first_contact_recorded: false,
          escalation_closed: false,
          repeated_client_channel: null,
          alternate_audience_open: false,
          care_circle_route_available: false,
          care_circle_route_used: false,
        },
      }),
    };

    const inferredPlanMemory = buildHealthPlanPlanMemory(currentPlan, [], improvedProfile);
    const sourceSignals = assembleRichHealthPlanSourceSignals(improvedProfile, predictiveContext, inferredPlanMemory);
    const promptInput = assembleHealthPlanPromptInput(improvedProfile, predictiveContext, sourceSignals, "en", {
      name: "Red Cross Leipzig",
      defaultLanguage: "en",
    }, inferredPlanMemory);

    expect(inferredPlanMemory.current_plan?.outcome_trajectory).toBe("improved");
    expect(inferredPlanMemory.current_plan?.outcome_confidence_state).toBe("inferred");
    expect(inferredPlanMemory.current_plan?.outcome_confidence_reason_codes).toContain("improvement_without_explicit_receipts");
    expect(sourceSignals.find((signal) => signal.id === "plan-memory-outcome-improved")?.usefulness_reason_codes).toEqual(
      expect.arrayContaining(["outcome_improvement_inferred"]),
    );
    expect(promptInput.known_facts.some((item) => item.code === "prior-plan-outcome-improved")).toBe(false);
    expect(promptInput.open_questions.some((item) => item.code === "prior-plan-outcome-improved-needs-confirmation")).toBe(true);
    expect(promptInput.next_confirmations.some((item) => item.code === "reconfirm-prior-improvement")).toBe(true);
    expect(promptInput.generation_assessment?.reasons?.some((reason) => reason.code === "prior_plan_improvement_unverified")).toBe(true);
  });

  it("learns which prior tactic families helped versus stalled and feeds that into the next prompt", () => {
    const liveProfile = createFragileProfile({
      consent: { caretaker_consent: true, consent_given: true },
      careProviders: [
        { id: "cp-1", provider_type: "field_staff", display_name: "Ana Novak", is_primary: true },
        { id: "cp-2", provider_type: "caregiver", display_name: "Sofia Lopez", is_primary: true },
      ],
      medications: [
        {
          id: "med-1",
          medication_name: "Aspirin",
          dosage: "1 pill",
          purpose: "Pain",
          reminders_enabled: true,
          schedule_times: ["09:00"],
        },
      ],
      medicationActivity: { status: "taken", occurred_at: "2026-06-18T10:00:00.000Z" },
      checkins: { enabled: true, frequency: "daily", preferred_time: "09:00", last_outcome: "Completed" },
      brainCoach: { enabled: true, frequency: "weekly", preferred_time: "16:00", last_outcome: "Completed" },
      sensors: [{ id: "sensor-1", status: "online", sensor_type: "watch", device_name: "Health Watch", last_reading_at: "2026-06-18T10:10:00.000Z" }],
      alerts: [],
      user: {
        language: "en",
        first_name: "Carmen",
        last_name: "Lopez",
        living_context: "alone",
        city: "Tarifa",
        emergency_notes: createRepeatedRouteOutcomeNotes(),
      },
    });
    const currentPlan = {
      id: "plan-current",
      current_version: 5,
      review_status: "draft",
      last_action_type: "edited",
      generation_confidence: "medium",
      generated_at: "2026-06-18T10:30:00.000Z",
      change_summary_json: { changed_sections: ["monitoring"] },
      automated_review_json: { verdict: "revise", required_actions: [] },
      review_attestation_json: { watch_issue_codes: [] },
      context_snapshot_json: createOutcomeLearningSnapshot({
        response_path: {
          handoff_open: false,
          first_contact_recorded: true,
          escalation_closed: true,
          repeated_client_channel: null,
          alternate_audience_open: false,
          care_circle_route_available: true,
          care_circle_route_used: true,
        },
        medication_activity: { status: "taken" },
        checkins: { enabled: true, frequency: "daily", preferred_time: "09:00", last_outcome: "Completed" },
        brain_coach: { enabled: true, frequency: "weekly", preferred_time: "16:00", last_outcome: "Completed" },
        sensors: [{ device_name: "Health Watch", sensor_type: "watch", status: "online" }],
        alerts: [],
      }),
    };
    const planHistory = [
      {
        id: "rev-4",
        version_number: 4,
        action_type: "edited",
        created_at: "2026-06-18T09:00:00.000Z",
        review_status: "draft",
        change_summary_json: { changed_sections: ["daily_support", "monitoring"] },
        automated_review_json: { verdict: "revise", required_actions: ["Tighten medication follow-up and stabilize the service routine."] },
        review_attestation_json: {},
        context_snapshot_json: createOutcomeLearningSnapshot(),
      },
      {
        id: "rev-3",
        version_number: 3,
        action_type: "regenerated",
        created_at: "2026-06-18T08:00:00.000Z",
        review_status: "reviewed",
        change_summary_json: { changed_sections: ["monitoring", "escalation"] },
        automated_review_json: { verdict: "revise", required_actions: ["Switch the contact route and close the urgent handoff loop."] },
        review_attestation_json: {},
        context_snapshot_json: createOutcomeLearningSnapshot(),
      },
    ];
    const predictiveContext = createPredictiveContext();
    const inferredPlanMemory = buildHealthPlanPlanMemory(currentPlan, planHistory, liveProfile);
    const sourceSignals = assembleRichHealthPlanSourceSignals(liveProfile, predictiveContext, inferredPlanMemory);
    const promptInput = assembleHealthPlanPromptInput(liveProfile, predictiveContext, sourceSignals, "en", {
      name: "Red Cross Leipzig",
      defaultLanguage: "en",
    }, inferredPlanMemory);

    expect(inferredPlanMemory.stalled_tactic_families).toContain("contact_path");
    expect(inferredPlanMemory.stalled_tactic_families).toContain("risk_escalation");
    expect(inferredPlanMemory.effective_tactic_families).toContain("medication_followup");
    expect(inferredPlanMemory.effective_tactic_families).toContain("service_routine");
    expect(inferredPlanMemory.family_outcome_learning).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          family: "service_routine",
          helped_count: 1,
          stalled_count: 0,
          consistency_state: "single_signal",
        }),
        expect.objectContaining({
          family: "contact_path",
          helped_count: 0,
          stalled_count: 2,
          consistency_state: "repeatedly_stalled",
        }),
      ]),
    );
    expect(inferredPlanMemory.contradicted_effective_tactic_families).toHaveLength(0);
    expect(sourceSignals.some((signal) => signal.id === "plan-memory-effective-tactics")).toBe(true);
    expect(sourceSignals.some((signal) => signal.id === "plan-memory-effective-tactics-contradicted")).toBe(false);
    expect(sourceSignals.some((signal) => signal.id === "plan-memory-stalled-tactics")).toBe(true);
    expect(sourceSignals.find((signal) => signal.id === "service-checkins")?.usefulness_reason_codes).toEqual(
      expect.arrayContaining(["historically_effective_pattern"]),
    );
    expect(sourceSignals.some((signal) =>
      Array.isArray(signal?.usefulness_reason_codes)
      && signal.usefulness_reason_codes.includes("family_outcomes_repeatedly_stalled"))).toBe(true);
    expect(promptInput.must_cover.some((item) => item.code === "preserve_effective_tactics")).toBe(true);
    expect(promptInput.must_cover.some((item) => item.code === "reframe_contradicted_effective_tactics")).toBe(false);
    expect(promptInput.must_cover.some((item) => item.code === "upgrade_stalled_tactic")).toBe(true);
    expect(promptInput.open_questions.some((item) => item.code === "prior-effective-tactic-contradicted")).toBe(false);
    expect(promptInput.open_questions.some((item) => item.code === "prior-tactic-stalled")).toBe(true);
    expect(promptInput.next_confirmations.some((item) => item.code === "reverify-or-retire-effective-tactic")).toBe(false);
    expect(promptInput.next_confirmations.some((item) => item.code === "upgrade-stalled-tactic")).toBe(true);
    expect(promptInput.generation_assessment?.reasons?.some((reason) => reason.code === "prior_effective_tactic_now_contradicted")).toBe(false);
    expect(promptInput.generation_assessment?.reasons?.some((reason) => reason.code === "prior_tactics_stalled")).toBe(true);
  });

  it("forces the next plan to close missing execution receipts from the previous saved plan", () => {
    const liveProfile = createFragileProfile({
      consent: { caretaker_consent: true, consent_given: true },
      careProviders: [
        { id: "cp-1", provider_type: "field_staff", display_name: "Ana Novak", is_primary: true },
        { id: "cp-2", provider_type: "caregiver", display_name: "Sofia Lopez", is_primary: true },
      ],
      user: {
        language: "en",
        first_name: "Carmen",
        last_name: "Lopez",
        living_context: "alone",
        city: "Tarifa",
        emergency_notes: createStalledOutcomeNotes(),
      },
    });
    const currentPlan = {
      id: "plan-current",
      current_version: 6,
      review_status: "reviewed",
      last_action_type: "regenerated",
      generation_confidence: "medium",
      generated_at: "2026-06-18T07:30:00.000Z",
      context_snapshot_json: createOutcomeLearningSnapshot(),
    };
    const predictiveContext = createPredictiveContext();
    const inferredPlanMemory = buildHealthPlanPlanMemory(currentPlan, [], liveProfile);
    const sourceSignals = assembleRichHealthPlanSourceSignals(liveProfile, predictiveContext, inferredPlanMemory);
    const promptInput = assembleHealthPlanPromptInput(liveProfile, predictiveContext, sourceSignals, "en", {
      name: "Red Cross Leipzig",
      defaultLanguage: "en",
    }, inferredPlanMemory);

    expect(inferredPlanMemory.current_plan?.receipt_gap_status).toBe("stalled");
    expect(inferredPlanMemory.current_plan?.receipt_gap_reason_codes).toContain("first_contact_missing");
    expect(inferredPlanMemory.current_plan?.receipt_gap_reason_codes).toContain("closure_missing");
    expect(sourceSignals.some((signal) => signal.id === "plan-memory-receipt-gap")).toBe(true);
    expect(promptInput.must_cover.some((item) => item.code === "close_execution_receipt_gap")).toBe(true);
    expect(promptInput.open_questions.some((item) => item.code === "prior-plan-receipts-open")).toBe(true);
    expect(promptInput.next_confirmations.some((item) => item.code === "record-missing-prior-receipts")).toBe(true);
    expect(promptInput.generation_assessment?.reasons?.some((reason) => reason.code === "prior_plan_receipts_open")).toBe(true);

    expect(() => validateGeneratedHealthPlan(createGroundedPlan(), sourceSignals, promptInput)).toThrow();

    const repaired = repairGeneratedHealthPlan(createGroundedPlan(), sourceSignals, promptInput);
    const validated = validateGeneratedHealthPlan(repaired, sourceSignals, promptInput);

    expect(validated.monitoring_json.some((item) =>
      item.source_signal_ids?.includes("plan-memory-receipt-gap"))).toBe(true);
    expect(validated.escalation_json.some((item) =>
      item.source_signal_ids?.includes("plan-memory-receipt-gap"))).toBe(true);
  });

  it("carries recommendation-level staff receipts into the next prompt so deferred, escalated, and unconfirmed actions stay visible", () => {
    const profile = createFragileProfile({
      careProviders: [{ id: "cp-1", provider_type: "field_staff", display_name: "Ana Novak", is_primary: true }],
    });
    const predictiveContext = createPredictiveContext();
    const currentPlan = {
      id: "plan-recommendation-receipts-1",
      current_version: 8,
      review_status: "reviewed",
      last_action_type: "edited",
      generation_confidence: "high",
      generated_at: "2026-06-18T09:45:00.000Z",
      monitoring_json: [
        {
          id: "monitor-confirmed",
          text: "Confirm whether the active alert still reflects the live picture today.",
          source_signal_ids: ["alert-active"],
          due_window: "same_day",
          priority: "high",
          staff_disposition: "confirmed",
          staff_disposition_note: "Ana verified the alert route and logged the live check.",
          staff_disposition_updated_at: "2026-06-18T10:00:00.000Z",
        },
        {
          id: "monitor-open",
          text: "Re-check whether the sensor issue still needs manual fallback.",
          source_signal_ids: ["sensor-status"],
          due_window: "same_day",
          priority: "high",
        },
      ],
      escalation_json: [
        {
          id: "escalate-deferred",
          text: "Escalate the same day if direct contact still fails.",
          source_signal_ids: ["alert-active"],
          due_window: "same_day",
          priority: "high",
          staff_disposition: "deferred",
          staff_disposition_note: "Deferred until the noon outreach window closes.",
          staff_disposition_updated_at: "2026-06-18T10:05:00.000Z",
        },
        {
          id: "escalate-escalated",
          text: "Move to the approved care-circle route if the first route stalls.",
          source_signal_ids: ["execution-care-circle-route-open"],
          due_window: "same_day",
          priority: "high",
          staff_disposition: "escalated",
          staff_disposition_note: "Escalated to the backup route with the primary field owner.",
          staff_disposition_updated_at: "2026-06-18T10:10:00.000Z",
        },
      ],
      goals_json: [],
      daily_support_json: [],
      caregiver_guidance_json: [],
      context_snapshot_json: createOutcomeLearningSnapshot(),
    };

    const inferredPlanMemory = buildHealthPlanPlanMemory(currentPlan, [], profile);
    const sourceSignals = assembleRichHealthPlanSourceSignals(profile, predictiveContext, inferredPlanMemory);
    const promptInput = assembleHealthPlanPromptInput(profile, predictiveContext, sourceSignals, "en", {
      name: "Red Cross Leipzig",
      defaultLanguage: "en",
    }, inferredPlanMemory);
    const digest = buildHealthPlanEvidenceDigest(sourceSignals);

    expect(inferredPlanMemory.current_plan?.recommendation_receipts?.status).toBe("escalated");
    expect(inferredPlanMemory.current_plan?.recommendation_receipts?.confirmed_count).toBe(1);
    expect(inferredPlanMemory.current_plan?.recommendation_receipts?.deferred_count).toBe(1);
    expect(inferredPlanMemory.current_plan?.recommendation_receipts?.escalated_count).toBe(1);
    expect(inferredPlanMemory.current_plan?.recommendation_receipts?.open_count).toBe(1);
    expect(inferredPlanMemory.family_execution_learning).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          family: "verification",
          learning_state: "mixed",
          confirmed_count: 1,
          open_count: 1,
        }),
        expect.objectContaining({
          family: "risk_escalation",
          learning_state: "needs_stronger_route",
          escalated_count: 1,
        }),
      ]),
    );
    expect(sourceSignals.some((signal) => signal.id === "plan-memory-recommendations-confirmed")).toBe(true);
    expect(sourceSignals.some((signal) => signal.id === "plan-memory-recommendations-deferred")).toBe(true);
    expect(sourceSignals.some((signal) => signal.id === "plan-memory-recommendations-escalated")).toBe(true);
    expect(sourceSignals.some((signal) => signal.id === "plan-memory-recommendations-open")).toBe(true);
    expect(sourceSignals.find((signal) => signal.id === "alert-active")?.usefulness_reason_codes).toEqual(
      expect.arrayContaining(["family_receipts_escalated"]),
    );
    expect(sourceSignals.find((signal) => signal.id === "sensor-status")?.usefulness_reason_codes).toEqual(
      expect.arrayContaining(["family_receipts_open"]),
    );
    expect(sourceSignals.find((signal) => signal.id === "risk-latest-score")?.usefulness_reason_codes).toEqual(
      expect.arrayContaining(["family_receipts_escalated", "family_receipts_mixed"]),
    );
    expect(promptInput.must_cover.some((item) => item.code === "resolve_deferred_recommendations")).toBe(true);
    expect(promptInput.must_cover.some((item) => item.code === "carry_forward_escalated_recommendations")).toBe(true);
    expect(promptInput.must_cover.some((item) => item.code === "close_unconfirmed_recommendations")).toBe(true);
    expect(promptInput.known_facts.some((item) => item.code === "prior-recommendations-confirmed")).toBe(true);
    expect(promptInput.known_facts.some((item) => item.code === "prior-recommendations-escalated")).toBe(true);
    expect(promptInput.open_questions.some((item) => item.code === "prior-recommendations-deferred")).toBe(true);
    expect(promptInput.open_questions.some((item) => item.code === "prior-recommendations-unconfirmed")).toBe(true);
    expect(promptInput.next_confirmations.some((item) => item.code === "resolve-deferred-recommendations")).toBe(true);
    expect(promptInput.next_confirmations.some((item) => item.code === "carry-forward-escalated-recommendations")).toBe(true);
    expect(promptInput.next_confirmations.some((item) => item.code === "close-prior-recommendation-receipts")).toBe(true);
    expect(promptInput.generation_assessment?.reasons?.some((reason) => reason.code === "prior_recommendations_deferred")).toBe(true);
    expect(promptInput.generation_assessment?.reasons?.some((reason) => reason.code === "prior_recommendations_escalated")).toBe(true);
    expect(promptInput.generation_assessment?.reasons?.some((reason) => reason.code === "prior_recommendations_unconfirmed")).toBe(true);
    expect(promptInput.change_context?.reason_codes).toEqual(
      expect.arrayContaining([
        "deferred_recommendations_open",
        "escalated_recommendations_present",
        "unconfirmed_recommendations_open",
      ]),
    );
    expect(digest.top_priority_signals?.some((signal) =>
      signal.usefulness_reason_codes?.includes("family_receipts_escalated")
      || signal.usefulness_reason_codes?.includes("family_receipts_mixed"))).toBe(true);
  });

  it("forces the next plan to show what is different when prior tactic families keep repeating", () => {
    const profile = createFragileProfile({
      careProviders: [{ id: "cp-1", provider_type: "field_staff", display_name: "Ana Novak", is_primary: true }],
      user: {
        language: "en",
        first_name: "Carmen",
        last_name: "Lopez",
        living_context: "alone",
        city: "Tarifa",
        emergency_notes: createStalledOutcomeNotes(),
      },
    });
    const predictiveContext = createPredictiveContext();
    const planMemory = createPlanMemory();
    const sourceSignals = assembleRichHealthPlanSourceSignals(profile, predictiveContext, planMemory);
    const promptInput = assembleHealthPlanPromptInput(profile, predictiveContext, sourceSignals, "en", {
      name: "Red Cross Leipzig",
      defaultLanguage: "en",
    }, planMemory);

    expect(sourceSignals.some((signal) => signal.id === "plan-memory-repeated-tactics")).toBe(true);
    expect(promptInput.must_cover.some((item) => item.code === "differentiate_repeated_tactic")).toBe(true);
    expect(promptInput.open_questions.some((item) => item.code === "prior-tactic-repetition")).toBe(true);
    expect(promptInput.next_confirmations.some((item) => item.code === "differentiate-next-tactic")).toBe(true);

    expect(() => validateGeneratedHealthPlan(createGroundedPlan(), sourceSignals, promptInput)).toThrow(
      /missed required care coverage|did not explain the material change/i,
    );

    const repaired = repairGeneratedHealthPlan(createGroundedPlan(), sourceSignals, promptInput);
    const validated = validateGeneratedHealthPlan(repaired, sourceSignals, promptInput);

    expect(validated.monitoring_json.some((item) =>
      item.source_signal_ids?.includes("plan-memory-repeated-tactics"))).toBe(true);
    expect(validated.escalation_json.some((item) =>
      item.source_signal_ids?.includes("plan-memory-repeated-tactics"))).toBe(true);
  });

  it("forces the plan to adapt when the current contact path is not landing", () => {
    const profile = createFragileProfile({
      user: {
        language: "en",
        first_name: "Carmen",
        last_name: "Lopez",
        living_context: "alone",
        city: "Tarifa",
        emergency_notes: createStalledOutcomeNotes(),
      },
      careProviders: [{ id: "cp-1", provider_type: "field_staff", display_name: "Ana Novak", is_primary: true }],
      checkins: { enabled: true, frequency: "daily", preferred_time: "09:00", last_outcome: "Missed" },
      brainCoach: { enabled: true, frequency: "weekly", preferred_time: "16:00", last_outcome: "Pending" },
      medicationActivity: { status: "missed", occurred_at: "2026-06-18T07:00:00.000Z" },
    });
    const predictiveContext = createPredictiveContext();
    const sourceSignals = assembleRichHealthPlanSourceSignals(profile, predictiveContext);
    const promptInput = assembleHealthPlanPromptInput(profile, predictiveContext, sourceSignals, "en", {
      name: "Red Cross Leipzig",
      defaultLanguage: "en",
    });

    expect(sourceSignals.some((signal) => signal.id === "execution-followthrough-open")).toBe(true);
    expect(sourceSignals.some((signal) => signal.id === "execution-contact-path-weak")).toBe(true);
    expect(sourceSignals.some((signal) => signal.id === "execution-stalled")).toBe(true);
    expect(promptInput.must_cover.some((item) => item.code === "adapt_contact_path")).toBe(true);
    expect(promptInput.must_cover.some((item) => item.code === "close_execution_receipt_gap")).toBe(true);
    expect(promptInput.generation_contract?.must_name_alternate_route).toBe(true);
    expect(promptInput.recent_outcomes?.execution_brief).toEqual(
      expect.objectContaining({
        route_state: "stalled",
        first_contact_recorded: false,
        handoff_open: true,
        recommended_next_route: "named_owner_escalation",
        missing_receipt: "first_contact",
      }),
    );
    expect(promptInput.open_questions.some((item) => item.code === "contact-path-not-landing")).toBe(true);
    expect(promptInput.open_questions.some((item) => item.code === "followthrough-stalled")).toBe(true);
    expect(promptInput.next_confirmations.some((item) => item.code === "confirm-alternate-contact-path")).toBe(true);
    expect(promptInput.next_confirmations.some((item) => item.code === "unstick-followthrough-loop")).toBe(true);
    expect(promptInput.generation_assessment?.reasons?.some((reason) => reason.code === "execution_followthrough_stalled")).toBe(true);
    expect(promptInput.generation_assessment?.reasons?.some((reason) => reason.code === "handoff_open_without_first_contact")).toBe(true);
    expect(promptInput.generation_assessment?.reasons?.some((reason) => reason.code === "repeated_route_without_receipt")).toBe(false);
    expect(promptInput.generation_assessment?.reasons?.some((reason) => reason.code === "alternate_route_available_unused")).toBe(false);

    expect(() => validateGeneratedHealthPlan(createGroundedPlan(), sourceSignals, promptInput)).toThrow(
      /missed required care coverage|did not name an alternate route|missing execution receipt/i,
    );

    const repaired = repairGeneratedHealthPlan(createGroundedPlan(), sourceSignals, promptInput);
    const validated = validateGeneratedHealthPlan(repaired, sourceSignals, promptInput);

    expect(validated.monitoring_json.some((item) =>
      item.source_signal_ids?.includes("execution-contact-path-weak") || item.source_signal_ids?.includes("execution-stalled"))).toBe(true);
    expect(validated.escalation_json.some((item) =>
      item.source_signal_ids?.includes("execution-contact-path-weak") || item.source_signal_ids?.includes("execution-stalled"))).toBe(true);
    expect(validated.monitoring_json.some((item) => /\bfirst contact\b/i.test(item.text) || /\breceipt\b/i.test(item.text))).toBe(true);
    expect(validated.escalation_json.some((item) => /\bfirst contact\b/i.test(item.text) || /\breceipt\b/i.test(item.text))).toBe(true);
  });

  it("adds a generation-side execution brief when the same-day lane is overloaded", () => {
    const profile = createFragileProfile();
    const predictiveContext = createPredictiveContext();
    const sourceSignals = assembleRichHealthPlanSourceSignals(profile, predictiveContext);
    const promptInput = assembleHealthPlanPromptInput(profile, predictiveContext, sourceSignals, "en", {
      name: "Red Cross Leipzig",
      defaultLanguage: "en",
    });

    expect(promptInput.generation_execution_brief).toEqual(
      expect.objectContaining({
        load_state: "overloaded",
        next_task_code: expect.any(String),
        next_task_title: expect.any(String),
      }),
    );
    expect(promptInput.generation_execution_brief?.triage_task_codes.length).toBeGreaterThan(0);
    expect(promptInput.generation_execution_brief?.triage_task_codes.length).toBeLessThanOrEqual(3);
    expect(promptInput.generation_execution_brief?.triage_summary_text).toMatch(/start with|first 3 tasks|active focus/i);
    expect(promptInput.generation_execution_brief?.opening_move_text).toMatch(/start with/i);
  });

  it("adds conditional next-step branching so the plan changes with the first live verification result", () => {
    const profile = createFragileProfile({
      consent: { caretaker_consent: true, consent_given: true },
      user: {
        language: "en",
        first_name: "Carmen",
        last_name: "Lopez",
        living_context: "alone",
        city: "Tarifa",
        emergency_notes: createRepeatedRouteOutcomeNotes(),
      },
      careProviders: [
        { id: "cp-1", provider_type: "field_staff", display_name: "Ana Novak", is_primary: true },
        { id: "cp-2", provider_type: "caregiver", display_name: "Sofia Lopez", is_primary: true },
      ],
      medicationActivity: { status: "missed", occurred_at: "2026-06-18T08:00:00.000Z" },
      sensors: [{ id: "sensor-1", status: "offline", sensor_type: "watch", device_name: "Health Watch", last_reading_at: "2026-06-18T08:10:00.000Z" }],
      alerts: [{ id: "alert-1", severity: "high", message: "Client could not be reached", resolved_at: null, created_at: "2026-06-18T08:20:00.000Z" }],
    });
    const predictiveContext = createPredictiveContext();
    const sourceSignals = assembleRichHealthPlanSourceSignals(profile, predictiveContext);
    const promptInput = assembleHealthPlanPromptInput(profile, predictiveContext, sourceSignals, "en", {
      name: "Red Cross Leipzig",
      defaultLanguage: "en",
    });

    expect(promptInput.must_cover.some((item) => item.code === "branch_after_first_check")).toBe(true);
    expect(promptInput.decision_branches.some((item) => item.code === "branch-contact-lands")).toBe(true);
    expect(promptInput.decision_branches.some((item) => item.code === "branch-contact-misses")).toBe(true);
    expect(promptInput.recent_outcomes?.execution_brief).toEqual(
      expect.objectContaining({
        route_state: "stalled",
        recommended_next_route: "approved_care_circle",
        missing_receipt: "first_contact",
      }),
    );

    expect(() => validateGeneratedHealthPlan(createGroundedPlan(), sourceSignals, promptInput)).toThrow(
      /missed required care coverage|did not explain the material change/i,
    );

    const repaired = repairGeneratedHealthPlan(createGroundedPlan(), sourceSignals, promptInput);
    const validated = validateGeneratedHealthPlan(repaired, sourceSignals, promptInput);

    expect(validated.monitoring_json.some((item) =>
      /\bif\b/i.test(item.text) || /\bwhen\b/i.test(item.text))).toBe(true);
    expect(validated.escalation_json.some((item) =>
      /\bif\b/i.test(item.text) || /\bwhen\b/i.test(item.text))).toBe(true);
  });

  it("repairs overloaded same-day plans so the opening move and task order are explicit", () => {
    const profile = createFragileProfile();
    const predictiveContext = createPredictiveContext();
    const sourceSignals = assembleRichHealthPlanSourceSignals(profile, predictiveContext);
    const promptInput = assembleHealthPlanPromptInput(profile, predictiveContext, sourceSignals, "en", {
      name: "Red Cross Leipzig",
      defaultLanguage: "en",
    });
    const executionBlindPlan = {
      ...createGroundedPlan(),
      summary_text: "This plan keeps today's support aligned with the current risk picture while staff continue follow-up.",
      monitoring_json: [
        {
          id: "monitor-1",
          text: "Monitor alerts, medication adherence, and sensor reliability through today's follow-up.",
          source_signal_ids: ["alert-active", "medication-plan", "sensor-status"],
        },
      ],
      escalation_json: [
        {
          id: "escalation-1",
          text: "Escalate the same day if alerts remain open or the client still cannot be reached.",
          source_signal_ids: ["alert-active", "risk-latest-score"],
        },
      ],
    };

    expect(() => validateGeneratedHealthPlan(executionBlindPlan, sourceSignals, promptInput)).toThrow(
      /opening move and same-day task order explicit|required care coverage|critical signal into monitoring or escalation/i,
    );

    const repaired = repairGeneratedHealthPlan(executionBlindPlan, sourceSignals, promptInput);
    const validated = validateGeneratedHealthPlan(repaired, sourceSignals, promptInput);
    const orderedText = [
      validated.summary_text,
      ...validated.monitoring_json.map((item) => item.text),
      ...validated.escalation_json.map((item) => item.text),
    ].join(" ");

    expect(orderedText).toMatch(/start with|keep only the first|keep the opening lane visible|tightly ordered/i);
  });

  it("repairs urgent plans so they say what counts as done for the next follow-up", () => {
    const profile = createFragileProfile();
    const predictiveContext = createPredictiveContext();
    const sourceSignals = assembleRichHealthPlanSourceSignals(profile, predictiveContext);
    const promptInput = assembleHealthPlanPromptInput(profile, predictiveContext, sourceSignals, "en", {
      name: "Red Cross Leipzig",
      defaultLanguage: "en",
    });
    const repairedBaseline = repairGeneratedHealthPlan(createGroundedPlan(), sourceSignals, promptInput);
    const accountabilityBlindPlan = {
      ...repairedBaseline,
      monitoring_json: repairedBaseline.monitoring_json.map((item) => (
        /counts as done|record|document|proof|receipt|log/i.test(item.text)
          ? { ...item, text: "Monitor the current live status closely and continue follow-up today." }
          : item
      )),
      escalation_json: repairedBaseline.escalation_json.map((item) => (
        /counts as done|record|document|proof|receipt|log/i.test(item.text)
          ? { ...item, text: "Escalate the same day if the situation is still unresolved." }
          : item
      )),
    };

    expect(() => validateGeneratedHealthPlan(accountabilityBlindPlan, sourceSignals, promptInput)).toThrow(
      /counts as done|required care coverage|specific guidance|receipt closes the urgent follow-up loop/i,
    );

    const repaired = repairGeneratedHealthPlan(accountabilityBlindPlan, sourceSignals, promptInput);
    const validated = validateGeneratedHealthPlan(repaired, sourceSignals, promptInput);

    expect(validated.monitoring_json.some((item) =>
      /counts as done|record|document|proof|receipt|log/i.test(item.text))).toBe(true);
    expect(validated.escalation_json.some((item) =>
      /counts as done|record|document|proof|receipt|log/i.test(item.text))).toBe(true);
  });

  it("keeps each section grounded in the kind of signals that section is supposed to carry", () => {
    const profile = createFragileProfile();
    const predictiveContext = createPredictiveContext();
    const sourceSignals = assembleRichHealthPlanSourceSignals(profile, predictiveContext);
    const promptInput = assembleHealthPlanPromptInput(profile, predictiveContext, sourceSignals, "en", {
      name: "Red Cross Leipzig",
      defaultLanguage: "en",
    });
    const laneBlindPlan = {
      ...createGroundedPlan(),
      daily_support_json: [
        {
          id: "daily-1",
          text: "Keep support steady today.",
          source_signal_ids: ["risk-latest-score"],
        },
      ],
      caregiver_guidance_json: [
        {
          id: "caregiver-1",
          text: "Stay cautious with today's situation.",
          source_signal_ids: ["risk-latest-score"],
        },
      ],
    };

    expect(() => validateGeneratedHealthPlan(laneBlindPlan, sourceSignals, promptInput)).toThrow(
      /section-specific grounding|required care coverage/i,
    );

    const repaired = repairGeneratedHealthPlan(laneBlindPlan, sourceSignals, promptInput);
    const validated = validateGeneratedHealthPlan(repaired, sourceSignals, promptInput);

    expect(validated.daily_support_json.some((item) =>
      item.source_signal_ids?.includes("medication-plan")
      || item.source_signal_ids?.includes("service-checkins")
      || item.source_signal_ids?.includes("service-brain-coach"))).toBe(true);
    expect(validated.caregiver_guidance_json.some((item) =>
      item.source_signal_ids?.includes("consent-family-sharing")
      || item.source_signal_ids?.includes("care-circle-context"))).toBe(true);
  });

  it("preserves tactic families that recent evidence says are helping instead of rewriting the plan as risk-only guidance", () => {
    const profile = createFragileProfile({
      careProviders: [{ id: "cp-1", provider_type: "field_staff", display_name: "Ana Novak", is_primary: true }],
      medicationActivity: { status: "taken", occurred_at: "2026-06-18T08:00:00.000Z" },
      sensors: [{ id: "sensor-1", status: "online", sensor_type: "watch", device_name: "Health Watch", last_reading_at: "2026-06-18T09:10:00.000Z" }],
    });
    const predictiveContext = createPredictiveContext("medium");
    const planMemory = {
      has_existing_plan: true,
      current_plan: {
        current_version: 4,
        review_status: "reviewed",
        generated_at: "2026-06-18T08:30:00.000Z",
      },
      effective_tactic_families: ["service_routine", "medication_followup"],
      stalled_tactic_families: [],
      recurring_issue_codes: [],
      repeated_tactic_families: [],
      learning_highlights: ["Recent service rhythm and medication follow-up helped stabilize the case."],
      planning_cautions: [],
    };
    const sourceSignals = assembleRichHealthPlanSourceSignals(profile, predictiveContext, planMemory);
    const promptInput = assembleHealthPlanPromptInput(profile, predictiveContext, sourceSignals, "en", {
      name: "Red Cross Leipzig",
      defaultLanguage: "en",
    }, planMemory);
    const stabilityBlindPlan = {
      ...createGroundedPlan(),
      goals_json: [
        {
          id: "goal-1",
          text: "Watch the current risk picture closely through the next review window.",
          source_signal_ids: ["risk-latest-score"],
        },
      ],
      daily_support_json: [
        {
          id: "daily-1",
          text: "Use the current care picture to guide support today.",
          source_signal_ids: ["risk-latest-score"],
        },
      ],
    };

    expect(promptInput.must_cover.some((item) => item.code === "preserve_effective_tactics")).toBe(true);
    expect(() => validateGeneratedHealthPlan(stabilityBlindPlan, sourceSignals, promptInput)).toThrow(
      /required care coverage|across enough sections|section-specific grounding/i,
    );

    const repaired = repairGeneratedHealthPlan(stabilityBlindPlan, sourceSignals, promptInput);
    const validated = validateGeneratedHealthPlan(repaired, sourceSignals, promptInput);

    expect(validated.goals_json.some((item) =>
      /protect|keep|maintain|continue|anchor/i.test(item.text)
      && (
        item.source_signal_ids?.includes("plan-memory-effective-tactics")
        || item.source_signal_ids?.includes("service-checkins")
        || item.source_signal_ids?.includes("medication-plan")
      ))).toBe(true);
    expect(validated.daily_support_json.some((item) =>
      /protect|keep|maintain|continue|anchor/i.test(item.text)
      && (
        item.source_signal_ids?.includes("plan-memory-effective-tactics")
        || item.source_signal_ids?.includes("service-checkins")
        || item.source_signal_ids?.includes("medication-plan")
      ))).toBe(true);
  });

  it("reframes previously helpful tactics when today's live evidence now contradicts them", () => {
    const profile = createFragileProfile({
      careProviders: [{ id: "cp-1", provider_type: "field_staff", display_name: "Ana Novak", is_primary: true }],
    });
    const predictiveContext = createPredictiveContext();
    const planMemory = {
      has_existing_plan: true,
      current_plan: {
        current_version: 5,
        review_status: "reviewed",
        generated_at: "2026-06-18T10:00:00.000Z",
      },
      effective_tactic_families: ["service_routine", "medication_followup"],
      contradicted_effective_tactic_families: ["service_routine", "medication_followup"],
      effective_tactic_contradictions: [
        {
          family: "service_routine",
          reason_code: "service_outcomes_not_landing",
          detail: "Recent check-in or Brain Coach outcomes are missed, pending, or still unconfirmed.",
        },
        {
          family: "medication_followup",
          reason_code: "medication_followup_open",
          detail: "Medication follow-up still shows missed, late, disabled, or unconfirmed reminder coverage.",
        },
      ],
      stalled_tactic_families: [],
      recurring_issue_codes: [],
      repeated_tactic_families: [],
      learning_highlights: ["Recent routines helped before, but today's evidence now contradicts them."],
      planning_cautions: ["Do not preserve a previously helpful tactic unchanged when today's evidence suggests it is no longer landing."],
    };
    const sourceSignals = assembleRichHealthPlanSourceSignals(profile, predictiveContext, planMemory);
    const promptInput = assembleHealthPlanPromptInput(profile, predictiveContext, sourceSignals, "en", {
      name: "Red Cross Leipzig",
      defaultLanguage: "en",
    }, planMemory);
    const contradictionBlindPlan = createGroundedPlan();

    expect(promptInput.must_cover.some((item) => item.code === "reframe_contradicted_effective_tactics")).toBe(true);
    expect(() => validateGeneratedHealthPlan(contradictionBlindPlan, sourceSignals, promptInput)).toThrow(
      /required care coverage|specific guidance|hid evidence uncertainty/i,
    );

    const repaired = repairGeneratedHealthPlan(contradictionBlindPlan, sourceSignals, promptInput);
    const validated = validateGeneratedHealthPlan(repaired, sourceSignals, promptInput);
    const contradictedCoverageSections = [
      validated.summary_signal_ids.includes("plan-memory-effective-tactics-contradicted"),
      validated.monitoring_json.some((item) => item.source_signal_ids?.includes("plan-memory-effective-tactics-contradicted")),
      validated.escalation_json.some((item) => item.source_signal_ids?.includes("plan-memory-effective-tactics-contradicted")),
    ].filter(Boolean).length;

    expect(validated.summary_signal_ids).toContain("plan-memory-effective-tactics-contradicted");
    expect(validated.summary_text).toMatch(/do not|no longer|re-?verify|replace|alternate/i);
    expect(contradictedCoverageSections).toBeGreaterThanOrEqual(1);
  });

  it("repairs section-level caution when verification or sharing boundaries are missing from the wording", () => {
    const profile = createFragileProfile();
    const predictiveContext = createPredictiveContext();
    const sourceSignals = assembleRichHealthPlanSourceSignals(profile, predictiveContext);
    const promptInput = assembleHealthPlanPromptInput(profile, predictiveContext, sourceSignals, "en", {
      name: "Red Cross Leipzig",
      defaultLanguage: "en",
    });
    const groundedPlan = createGroundedPlan();
    const cautionBlindPlan = {
      ...groundedPlan,
      monitoring_json: groundedPlan.monitoring_json.map((item, index) => (
        index === 0
          ? {
              ...item,
              text: "Watch active alerts, sensor reliability, and the current check-in rhythm closely today.",
            }
          : item
      )),
      caregiver_guidance_json: groundedPlan.caregiver_guidance_json.map((item, index) => (
        index === 0
          ? {
              ...item,
              text: "Keep the care circle informed about support changes.",
            }
          : item
      )),
    };

    expect(() => validateGeneratedHealthPlan(cautionBlindPlan, sourceSignals, promptInput)).toThrow(
      /section-specific caution|sharing-boundary caution|evidence-gap guidance|success-criteria guidance|required care coverage/i,
    );

    const repaired = repairGeneratedHealthPlan(cautionBlindPlan, sourceSignals, promptInput);
    const validated = validateGeneratedHealthPlan(repaired, sourceSignals, promptInput);

    expect(validated.monitoring_json.some((item) =>
      /verify|confirm|refresh|re-?check|touchpoint/i.test(item.text))).toBe(true);
    expect(validated.caregiver_guidance_json.some((item) =>
      /staff|approved provider|consent|family/i.test(item.text))).toBe(true);
  });

  it("repairs missing evidence-gap and success-criteria wording inside section guidance lanes", () => {
    const profile = createFragileProfile();
    const predictiveContext = createPredictiveContext();
    const sourceSignals = assembleRichHealthPlanSourceSignals(profile, predictiveContext);
    const promptInput = assembleHealthPlanPromptInput(profile, predictiveContext, sourceSignals, "en", {
      name: "Red Cross Leipzig",
      defaultLanguage: "en",
    });
    const groundedPlan = createGroundedPlan();
    const gapBlindPlan = {
      ...groundedPlan,
      monitoring_json: groundedPlan.monitoring_json.map((item, index) => (
        index === 0
          ? {
              ...item,
              text: "Review active alerts, sensor reliability, and whether the saved check-in routine is still landing during today's follow-up.",
            }
          : item
      )),
      escalation_json: groundedPlan.escalation_json.map((item, index) => (
        index === 0
          ? {
              ...item,
              text: "Escalate the same day if alerts persist or the client remains unreachable.",
            }
          : item
      )),
    };

    expect(() => validateGeneratedHealthPlan(gapBlindPlan, sourceSignals, promptInput)).toThrow(
      /evidence-gap guidance|success-criteria guidance|required care coverage/i,
    );

    const repaired = repairGeneratedHealthPlan(gapBlindPlan, sourceSignals, promptInput);
    const validated = validateGeneratedHealthPlan(repaired, sourceSignals, promptInput);

    expect(validated.monitoring_json.some((item) =>
      /still needs|needs fresh|unresolved|before .* current|before .* confirmed|verify|verification|confirm|refresh|touchpoint|check(ed|ing)?/i.test(item.text))).toBe(true);
    expect(validated.escalation_json.some((item) =>
      /proof|receipt|record|close|useful only if|counts as/i.test(item.text))).toBe(true);
  });

  it("forces the next plan to switch channel or audience when the same route keeps failing", () => {
    const profile = createFragileProfile({
      consent: { caretaker_consent: true, consent_given: true },
      user: {
        language: "en",
        first_name: "Carmen",
        last_name: "Lopez",
        living_context: "alone",
        city: "Tarifa",
        emergency_notes: createRepeatedRouteOutcomeNotes(),
      },
      careProviders: [
        { id: "cp-1", provider_type: "field_staff", display_name: "Ana Novak", is_primary: true },
        { id: "cp-2", provider_type: "caregiver", display_name: "Sofia Lopez", is_primary: true },
      ],
      checkins: { enabled: true, frequency: "daily", preferred_time: "09:00", last_outcome: "Missed" },
      brainCoach: { enabled: true, frequency: "weekly", preferred_time: "16:00", last_outcome: "Pending" },
      medicationActivity: { status: "missed", occurred_at: "2026-06-18T08:00:00.000Z" },
    });
    const predictiveContext = createPredictiveContext();
    const sourceSignals = assembleRichHealthPlanSourceSignals(profile, predictiveContext);
    const promptInput = assembleHealthPlanPromptInput(profile, predictiveContext, sourceSignals, "en", {
      name: "Red Cross Leipzig",
      defaultLanguage: "en",
    });
    const snapshot = buildHealthPlanContextSnapshot(
      profile,
      predictiveContext,
      sourceSignals,
      "en",
      { name: "Red Cross Leipzig", defaultLanguage: "en", timezone: "Europe/Berlin" },
      new Date("2026-06-18T10:25:00.000Z"),
    );

    expect(sourceSignals.some((signal) => signal.id === "execution-same-channel-repeated")).toBe(true);
    expect(sourceSignals.some((signal) => signal.id === "execution-care-circle-route-open")).toBe(true);
    expect(promptInput.must_cover.some((item) => item.code === "adapt_contact_path")).toBe(true);
    expect(promptInput.response_path?.repeated_client_channel).toBe("phone");
    expect(promptInput.response_path?.care_circle_route_available).toBe(true);
    expect(promptInput.response_path?.care_circle_route_used).toBe(false);
    expect(promptInput.open_questions.some((item) => item.code === "same-channel-repeated")).toBe(true);
    expect(promptInput.open_questions.some((item) => item.code === "care-circle-route-unused")).toBe(true);
    expect(promptInput.next_confirmations.some((item) => item.code === "change-client-channel")).toBe(true);
    expect(promptInput.next_confirmations.some((item) => item.code === "activate-care-circle-route")).toBe(true);
    expect(snapshot?.response_path?.repeated_client_channel).toBe("phone");

    expect(() => validateGeneratedHealthPlan(createGroundedPlan(), sourceSignals, promptInput)).toThrow(
      /missed required care coverage|did not explain the material change/i,
    );

    const repaired = repairGeneratedHealthPlan(createGroundedPlan(), sourceSignals, promptInput);
    const validated = validateGeneratedHealthPlan(repaired, sourceSignals, promptInput);

    expect(validated.monitoring_json.some((item) =>
      item.source_signal_ids?.includes("execution-same-channel-repeated") || item.source_signal_ids?.includes("execution-care-circle-route-open"))).toBe(true);
    expect(validated.escalation_json.some((item) =>
      item.source_signal_ids?.includes("execution-same-channel-repeated") || item.source_signal_ids?.includes("execution-care-circle-route-open"))).toBe(true);
  });

  it("carries recent outreach, open handoffs, and open incidents forward into the next plan", () => {
    const profile = createFragileProfile({
      user: {
        language: "en",
        first_name: "Carmen",
        last_name: "Lopez",
        living_context: "alone",
        city: "Tarifa",
        emergency_notes: createOutcomeNotes(),
      },
      careProviders: [{ id: "cp-1", provider_type: "field_staff", display_name: "Ana Novak", is_primary: true }],
    });
    const predictiveContext = createPredictiveContext();
    const sourceSignals = assembleRichHealthPlanSourceSignals(profile, predictiveContext);
    const promptInput = assembleHealthPlanPromptInput(profile, predictiveContext, sourceSignals, "en", {
      name: "Red Cross Leipzig",
      defaultLanguage: "en",
    });

    expect(sourceSignals.some((signal) => signal.id === "outcome-latest-outreach")).toBe(true);
    expect(sourceSignals.some((signal) => signal.id === "outcome-handoff-open")).toBe(true);
    expect(sourceSignals.some((signal) => signal.id === "outcome-incident-open")).toBe(true);
    expect(promptInput.must_cover.some((item) => item.code === "carry_forward_open_operational_loops")).toBe(true);
    expect(promptInput.open_questions.some((item) => item.code === "handoff-still-open")).toBe(true);
    expect(promptInput.open_questions.some((item) => item.code === "incident-playbook-open")).toBe(true);
    expect(promptInput.next_confirmations.some((item) => item.code === "close-open-handoff")).toBe(true);
    expect(promptInput.recent_outcomes?.recent_events.length).toBeGreaterThan(0);

    expect(() => validateGeneratedHealthPlan(createGroundedPlan(), sourceSignals, promptInput)).toThrow(
      /missed required care coverage|did not name an alternate route/i,
    );

    const repaired = repairGeneratedHealthPlan(createGroundedPlan(), sourceSignals, promptInput);

    expect(validateGeneratedHealthPlan(repaired, sourceSignals, promptInput).monitoring_json.some((item) =>
      item.source_signal_ids?.includes("outcome-handoff-open") || item.source_signal_ids?.includes("outcome-incident-open"))).toBe(true);
    expect(repaired.escalation_json.some((item) =>
      item.source_signal_ids?.includes("outcome-handoff-open") || item.source_signal_ids?.includes("outcome-incident-open"))).toBe(true);
  });

  it("bypasses LLM generation when the urgent live picture is too stale and thin", () => {
    const profile = createFragileProfile({
      medicationActivity: { status: "missed", occurred_at: "2026-06-14T08:00:00.000Z" },
      alerts: [{ id: "alert-1", severity: "high", message: "Client could not be reached", resolved_at: null, created_at: "2026-06-14T07:00:00.000Z" }],
      sensors: [{ id: "sensor-1", status: "offline", sensor_type: "watch", device_name: "Health Watch", last_reading_at: "2026-06-14T06:00:00.000Z" }],
      careProviders: [],
    });
    const predictiveContext = createPredictiveContext();
    const sourceSignals = assembleRichHealthPlanSourceSignals(profile, predictiveContext);
    const promptInput = assembleHealthPlanPromptInput(profile, predictiveContext, sourceSignals, "en", {
      name: "Red Cross Leipzig",
      defaultLanguage: "en",
    });

    const guardrail = assessHealthPlanGenerationGuardrail(promptInput);
    const guardedAssessment = applyHealthPlanGenerationGuardrail(promptInput.generation_assessment, guardrail);

    expect(guardrail.use_fallback).toBe(true);
    expect(guardrail.trigger_codes).toEqual(
      expect.arrayContaining([
        "critical_freshness_gap",
        "critical_signal_snapshot_too_thin",
      ]),
    );
    expect(guardedAssessment?.reasons.some((reason) => reason.code === "critical_freshness_gap")).toBe(true);
  });

  it("keeps LLM generation available when the care picture is grounded enough", () => {
    const profile = createFragileProfile({
      consent: { caretaker_consent: true, consent_given: true },
      careProviders: [{ id: "cp-1", provider_type: "field_staff", display_name: "Ana Novak", is_primary: true }],
      medicationActivity: { status: "taken", occurred_at: "2026-06-18T08:00:00.000Z" },
      alerts: [],
      sensors: [{ id: "sensor-1", status: "online", sensor_type: "watch", device_name: "Health Watch", last_reading_at: "2026-06-18T09:10:00.000Z" }],
    });
    const predictiveContext = {
      latestScore: null,
      forecastRows: [],
    };
    const sourceSignals = assembleRichHealthPlanSourceSignals(profile, predictiveContext);
    const promptInput = assembleHealthPlanPromptInput(profile, predictiveContext, sourceSignals, "en", {
      name: "Red Cross Leipzig",
      defaultLanguage: "en",
    });

    const guardrail = assessHealthPlanGenerationGuardrail(promptInput);

    expect(guardrail.use_fallback).toBe(false);
    expect(guardrail.trigger_codes).toEqual([]);
  });

  it("downgrades fragile but not fully blocked generation contexts into review-only mode", () => {
    const profile = createFragileProfile({
      careProviders: [{ id: "cp-1", provider_type: "field_staff", display_name: "Ana Novak", is_primary: true }],
      medicationActivity: { status: "missed", occurred_at: "2026-06-18T08:00:00.000Z" },
      alerts: [{ id: "alert-1", severity: "high", message: "Client could not be reached", resolved_at: null, created_at: "2026-06-18T07:30:00.000Z" }],
      sensors: [{ id: "sensor-1", status: "offline", sensor_type: "watch", device_name: "Health Watch", last_reading_at: "2026-06-18T07:45:00.000Z" }],
    });
    const predictiveContext = createPredictiveContext();
    const sourceSignals = assembleRichHealthPlanSourceSignals(profile, predictiveContext);
    const promptInput = assembleHealthPlanPromptInput(profile, predictiveContext, sourceSignals, "en", {
      name: "Red Cross Leipzig",
      defaultLanguage: "en",
    });

    const adjustedAssessment = {
      ...promptInput.generation_assessment,
      confidence: "medium",
      readiness: "review_before_share",
    };
    const guardrail = assessHealthPlanGenerationGuardrail({
      generation_assessment: adjustedAssessment,
      evidence_digest: promptInput.evidence_digest,
    });
    const guardedAssessment = applyHealthPlanGenerationGuardrail(adjustedAssessment, guardrail);

    expect(guardrail.use_fallback).toBe(false);
    expect(guardrail.trust_state).toBe("review_only");
    expect(guardrail.reason_codes).toEqual(expect.arrayContaining([
      "generation_confidence_not_high",
    ]));
    expect(guardedAssessment?.confidence).toBe("medium");
    expect(guardedAssessment?.readiness).toBe("review_before_share");
    expect(guardedAssessment?.trust_gate_state).toBe("review_only");
    expect(guardedAssessment?.trust_gate_operator_action).toMatch(/staff-only|review/i);
  });

  it("rejects plans that skip required care coverage", () => {
    const profile = createFragileProfile();
    const predictiveContext = createPredictiveContext();
    const sourceSignals = assembleRichHealthPlanSourceSignals(profile, predictiveContext);
    const promptInput = assembleHealthPlanPromptInput(profile, predictiveContext, sourceSignals, "en", {
      name: "Red Cross Leipzig",
      defaultLanguage: "en",
    });
    const incompletePlan = {
      ...createGroundedPlan(),
      escalation_json: [
        {
          id: "escalation-1",
          text: "Escalate the same day if alerts persist or the client remains unreachable.",
          source_signal_ids: ["alert-active", "risk-latest-score"],
        },
        {
          id: "escalation-2",
          text: "Assign one named staff owner before the next outreach cycle and document who is following up.",
          source_signal_ids: ["care-circle-context"],
        },
      ],
      caregiver_guidance_json: [
        {
          id: "caregiver-1",
          text: "Keep the care routine calm and practical.",
          source_signal_ids: ["service-checkins"],
        },
      ],
    };

    expect(() => validateGeneratedHealthPlan(incompletePlan, sourceSignals, promptInput)).toThrow(
      /missed required care coverage|success-criteria guidance in escalation/i,
    );
  });

  it("rejects plans that mention the right issue once but fail to carry it across the required sections", () => {
    const profile = createFragileProfile();
    const predictiveContext = createPredictiveContext();
    const sourceSignals = assembleRichHealthPlanSourceSignals(profile, predictiveContext);
    const promptInput = assembleHealthPlanPromptInput(profile, predictiveContext, sourceSignals, "en", {
      name: "Red Cross Leipzig",
      defaultLanguage: "en",
    });
    const thinSectionPlan = {
      ...createGroundedPlan(),
      caregiver_guidance_json: [
        {
          id: "caregiver-1",
          text: "Keep client-specific updates within staff or approved providers until family consent is confirmed, and document the named owner.",
          source_signal_ids: ["consent-family-sharing", "care-circle-context"],
        },
      ],
      escalation_json: [
        {
          id: "escalation-1",
          text: "Escalate the same day if alerts persist or the client remains unreachable.",
          source_signal_ids: ["alert-active", "risk-latest-score"],
        },
        {
          id: "escalation-2",
          text: "Assign one named staff owner before the next outreach cycle and document who is following up.",
          source_signal_ids: ["care-circle-context"],
        },
      ],
    };

    expect(() => validateGeneratedHealthPlan(thinSectionPlan, sourceSignals, promptInput)).toThrow(
      /across enough sections|success-criteria guidance in escalation/i,
    );
  });

  it("rejects plans that ignore the need to refresh stale critical evidence", () => {
    const profile = createFragileProfile({
      medicationActivity: { status: "missed", occurred_at: "2026-06-14T08:00:00.000Z" },
      alerts: [{ id: "alert-1", severity: "high", message: "Client could not be reached", resolved_at: null, created_at: "2026-06-14T07:00:00.000Z" }],
      sensors: [{ id: "sensor-1", status: "offline", sensor_type: "watch", device_name: "Health Watch", last_reading_at: "2026-06-14T06:00:00.000Z" }],
    });
    const predictiveContext = createPredictiveContext();
    const sourceSignals = assembleRichHealthPlanSourceSignals(profile, predictiveContext);
    const promptInput = assembleHealthPlanPromptInput(profile, predictiveContext, sourceSignals, "en", {
      name: "Red Cross Leipzig",
      defaultLanguage: "en",
    });
    const staleBlindPlan = {
      ...createGroundedPlan(),
      summary_text: "This stabilizing plan keeps outreach, medication follow-up, and same-day escalation aligned with the latest risk picture.",
      monitoring_json: [
        {
          id: "monitor-1",
          text: "Review active alerts, medication adherence, and sensor reliability against the saved baseline.",
          source_signal_ids: ["alert-active", "sensor-status", "medication-plan"],
        },
      ],
      escalation_json: [
        {
          id: "escalation-1",
          text: "Escalate the same day if alerts persist, the client remains unreachable, medication follow-up still cannot be confirmed, the named follow-up owner is still missing, or staff still have not confirmed the family-sharing boundary.",
          source_signal_ids: ["alert-active", "risk-latest-score", "medication-plan", "care-circle-context", "consent-family-sharing"],
        },
      ],
    };

    expect(() => validateGeneratedHealthPlan(staleBlindPlan, sourceSignals, promptInput)).toThrow(
      /refresh live status|specific guidance for required care coverage|across enough sections|evidence-gap guidance in summary/i,
    );
  });

  it("repairs plans that blur medication adherence risk together with signal-reliability risk", () => {
    const profile = createFragileProfile();
    const predictiveContext = createPredictiveContext();
    const sourceSignals = assembleRichHealthPlanSourceSignals(profile, predictiveContext);
    const promptInput = assembleHealthPlanPromptInput(profile, predictiveContext, sourceSignals, "en", {
      name: "Red Cross Leipzig",
      defaultLanguage: "en",
    });
    const blendedPlan = {
      ...createGroundedPlan(),
      monitoring_json: [
        {
          id: "monitor-1",
          text: "Review active alerts, medication adherence, and sensor reliability through today's follow-up.",
          source_signal_ids: ["alert-active", "medication-plan", "sensor-status"],
        },
      ],
      escalation_json: [
        {
          id: "escalation-1",
          text: "Escalate the same day if the client remains unreachable or today's checks still raise concern.",
          source_signal_ids: ["alert-active", "risk-latest-score", "medication-plan", "sensor-status"],
        },
        {
          id: "escalation-2",
          text: "Assign one named staff owner before the next outreach cycle and document who is following up.",
          source_signal_ids: ["care-circle-context", "consent-family-sharing"],
        },
      ],
    };

    expect(() => validateGeneratedHealthPlan(blendedPlan, sourceSignals, promptInput)).toThrow(
      /distinct from sensor or data-reliability risk|specific guidance for required care coverage|evidence-gap guidance in monitoring/i,
    );

    const repaired = repairGeneratedHealthPlan(blendedPlan, sourceSignals, promptInput);
    const validated = validateGeneratedHealthPlan(repaired, sourceSignals, promptInput);
    const repairedOperationalText = [
      ...validated.monitoring_json.map((item) => item.text),
      ...validated.escalation_json.map((item) => item.text),
    ].join(" ");

    expect(repairedOperationalText).toMatch(/separate checks|missing data|false reassurance|client deterioration|both/i);
  });

  it("rejects plans that rely on too few client signals", () => {
    const profile = createFragileProfile({
      consent: { caretaker_consent: true, consent_given: true },
      medications: [
        {
          id: "med-1",
          medication_name: "Aspirin",
          dosage: "1 pill",
          purpose: "Pain",
          reminders_enabled: true,
          schedule_times: ["09:00"],
        },
      ],
      medicationActivity: { status: "taken", occurred_at: "2026-06-18T08:00:00.000Z" },
      careProviders: [{ id: "cp-1", provider_type: "field_staff", display_name: "Ana Novak", is_primary: true }],
      alerts: [],
      sensors: [{ id: "sensor-1", status: "online", sensor_type: "watch", device_name: "Health Watch" }],
    });
    const predictiveContext = createPredictiveContext("low");
    const sourceSignals = assembleRichHealthPlanSourceSignals(profile, predictiveContext);
    const promptInput = assembleHealthPlanPromptInput(profile, predictiveContext, sourceSignals, "en", {
      name: "Red Cross Leipzig",
      defaultLanguage: "en",
    });
    const narrowPlan = {
      summary_text: "Keep the check-in routine steady.",
      summary_signal_ids: ["service-checkins"],
      goals_json: [{ id: "goal-1", text: "Keep the check-in routine steady for the next review window.", source_signal_ids: ["service-checkins"] }],
      daily_support_json: [{ id: "daily-1", text: "Use the current check-in rhythm as the daily support baseline.", source_signal_ids: ["service-checkins"] }],
      monitoring_json: [{ id: "monitor-1", text: "Monitor routine completion through the current contact cycle.", source_signal_ids: ["service-checkins"] }],
      escalation_json: [{ id: "escalation-1", text: "Escalate if the routine starts breaking down before the next review.", source_signal_ids: ["service-checkins"] }],
      caregiver_guidance_json: [{ id: "caregiver-1", text: "Keep caregiver messaging aligned with the current routine only.", source_signal_ids: ["service-checkins"] }],
    };

    expect(() => validateGeneratedHealthPlan(narrowPlan, sourceSignals, promptInput)).toThrow(
      /too few client signals|summary in too few signals/i,
    );
  });

  it("rejects sections that stay trapped in one evidence category when the section packet requires a broader mix", () => {
    const profile = createFragileProfile();
    const predictiveContext = createPredictiveContext();
    const sourceSignals = assembleRichHealthPlanSourceSignals(profile, predictiveContext);
    const promptInput = assembleHealthPlanPromptInput(profile, predictiveContext, sourceSignals, "en", {
      name: "Red Cross Leipzig",
      defaultLanguage: "en",
    });
    const imbalancedPlan = {
      ...createGroundedPlan(),
      daily_support_json: [
        {
          id: "daily-1",
          text: "Use the saved check-in and Brain Coach routines to keep contact steady through the day.",
          source_signal_ids: ["service-checkins", "service-brain-coach"],
        },
      ],
    };

    expect(() => validateGeneratedHealthPlan(imbalancedPlan, sourceSignals, promptInput)).toThrow(
      /balance evidence categories in daily_support/i,
    );

    const repaired = repairGeneratedHealthPlan(imbalancedPlan, sourceSignals, promptInput);
    const validated = validateGeneratedHealthPlan(repaired, sourceSignals, promptInput);

    expect(validated.daily_support_json.some((item) => /medication|reminder|dose|adherence/i.test(item.text))).toBe(true);
  });

  it("rejects low-confidence plans whose summary is grounded in too little evidence", () => {
    const profile = createFragileProfile();
    const predictiveContext = createPredictiveContext();
    const sourceSignals = assembleRichHealthPlanSourceSignals(profile, predictiveContext);
    const promptInput = assembleHealthPlanPromptInput(profile, predictiveContext, sourceSignals, "en", {
      name: "Red Cross Leipzig",
      defaultLanguage: "en",
    });
    const thinSummaryPlan = {
      ...createGroundedPlan(),
      summary_signal_ids: ["risk-latest-score"],
    };

    expect(() => validateGeneratedHealthPlan(thinSummaryPlan, sourceSignals, promptInput)).toThrow(
      /summary in too few signals/i,
    );
  });

  it("rejects low-confidence plans that sound too certain about the live picture", () => {
    const profile = createFragileProfile();
    const predictiveContext = createPredictiveContext();
    const sourceSignals = assembleRichHealthPlanSourceSignals(profile, predictiveContext);
    const promptInput = assembleHealthPlanPromptInput(profile, predictiveContext, sourceSignals, "en", {
      name: "Red Cross Leipzig",
      defaultLanguage: "en",
    });
    const overconfidentPlan = {
      ...createGroundedPlan(),
      summary_text: "The client is now stable, the situation is under control, and no further action is needed today.",
    };

    expect(() => validateGeneratedHealthPlan(overconfidentPlan, sourceSignals, promptInput)).toThrow(
      /overstated certainty|unsafe medical guidance/i,
    );
  });

  it("repairs an otherwise useful draft with missing safety coverage before validation", () => {
    const profile = createFragileProfile();
    const predictiveContext = createPredictiveContext();
    const sourceSignals = assembleRichHealthPlanSourceSignals(profile, predictiveContext);
    const promptInput = assembleHealthPlanPromptInput(profile, predictiveContext, sourceSignals, "en", {
      name: "Red Cross Leipzig",
      defaultLanguage: "en",
    });
    const relaxedPromptInput = {
      ...promptInput,
      critical_signal_ids: [],
    };
    const brittlePlan = {
      ...createGroundedPlan(),
      summary_text: "The client is now stable and the situation is under control.",
      summary_signal_ids: ["risk-latest-score"],
      caregiver_guidance_json: [
        {
          id: "caregiver-1",
          text: "Keep the support routine calm and practical.",
          source_signal_ids: ["service-checkins"],
        },
      ],
      monitoring_json: [
        {
          id: "monitor-1",
          text: "Review active alerts against today's support baseline.",
          source_signal_ids: ["alert-active"],
        },
      ],
    };

    expect(() => validateGeneratedHealthPlan(brittlePlan, sourceSignals, promptInput)).toThrow();

    const repaired = repairGeneratedHealthPlan(brittlePlan, sourceSignals, promptInput);
    const validated = validateGeneratedHealthPlan(repaired, sourceSignals, promptInput);

    expect(validated.summary_signal_ids.length).toBeGreaterThanOrEqual(2);
    expect(validated.summary_text).toMatch(/verify|stabilizing draft/i);
    expect(validated.caregiver_guidance_json.some((item) => /consent|approved providers|staff/i.test(item.text))).toBe(true);
    expect(validated.escalation_json.some((item) => /named staff owner|responsible/i.test(item.text))).toBe(true);
    expect(validated.monitoring_json.some((item) => /medication adherence|missed|unconfirmed/i.test(item.text))).toBe(true);
  });

  it("keeps grounded plan wording stable while enriching urgent items with operational metadata", () => {
    const profile = createFragileProfile();
    const predictiveContext = createPredictiveContext();
    const sourceSignals = assembleRichHealthPlanSourceSignals(profile, predictiveContext);
    const promptInput = assembleHealthPlanPromptInput(profile, predictiveContext, sourceSignals, "en", {
      name: "Red Cross Leipzig",
      defaultLanguage: "en",
    });
    const grounded = createGroundedPlan();

    const repaired = repairGeneratedHealthPlan(grounded, sourceSignals, promptInput);

    expect(repaired.summary_text).toBe(grounded.summary_text);
    expect(repaired.goals_json).toEqual(grounded.goals_json);
    expect(repaired.daily_support_json).toEqual(grounded.daily_support_json);
    expect(repaired.caregiver_guidance_json).toEqual(grounded.caregiver_guidance_json);
    expect(repaired.monitoring_json.map((item) => item.text)).toEqual(grounded.monitoring_json.map((item) => item.text));
    expect(repaired.escalation_json.map((item) => item.text)).toEqual(grounded.escalation_json.map((item) => item.text));
    expect(repaired.monitoring_json.every((item) => item.owner_label && item.completion_proof && item.escalation_if_not_done)).toBe(true);
    expect(repaired.escalation_json.every((item) => item.owner_label && item.completion_proof && item.escalation_if_not_done)).toBe(true);
  });

  it("rejects plans that skip explicit verification even though pending confirmations are present", () => {
    const profile = createFragileProfile();
    const predictiveContext = createPredictiveContext();
    const sourceSignals = assembleRichHealthPlanSourceSignals(profile, predictiveContext);
    const promptInput = assembleHealthPlanPromptInput(profile, predictiveContext, sourceSignals, "en", {
      name: "Red Cross Leipzig",
      defaultLanguage: "en",
    });
    const noVerificationPlan = {
      ...createGroundedPlan(),
      summary_text: "This support plan keeps outreach, medication follow-up, and escalation aligned with the current risk picture.",
      monitoring_json: [
        {
          id: "monitor-1",
          text: "Review active alerts, sensor reliability, medication status, and the saved support routines against the baseline.",
          source_signal_ids: ["alert-active", "sensor-status", "medication-plan", "service-checkins", "service-brain-coach"],
        },
      ],
      escalation_json: [
        {
          id: "escalation-1",
          text: "Escalate the same day if alerts persist or the client remains unreachable.",
          source_signal_ids: ["alert-active", "risk-latest-score"],
        },
        {
          id: "escalation-2",
          text: "Assign one named staff owner before the next outreach cycle and document who is following up.",
          source_signal_ids: ["care-circle-context", "consent-family-sharing"],
        },
      ],
    };

    expect(() => validateGeneratedHealthPlan(noVerificationPlan, sourceSignals, promptInput)).toThrow(
      /pending confirmations|too settled for a low-confidence care picture|specific guidance for required care coverage|same-day timing guidance in summary/i,
    );
  });

  it("rejects plans that cite the right signals but still stay too vague about urgent follow-up", () => {
    const profile = createFragileProfile();
    const predictiveContext = createPredictiveContext();
    const sourceSignals = assembleRichHealthPlanSourceSignals(profile, predictiveContext);
    const promptInput = assembleHealthPlanPromptInput(profile, predictiveContext, sourceSignals, "en", {
      name: "Red Cross Leipzig",
      defaultLanguage: "en",
    });
    const vaguePlan = {
      ...createGroundedPlan(),
      monitoring_json: [
        {
          id: "monitor-1",
          text: "Review the current care picture and keep follow-up moving today.",
          source_signal_ids: ["alert-active", "sensor-status", "service-checkins"],
        },
        {
          id: "monitor-2",
          text: "Track whether contact and medication adherence return to baseline.",
          source_signal_ids: ["risk-latest-score", "medication-plan"],
        },
      ],
      escalation_json: [
        {
          id: "escalation-1",
          text: "Keep the care picture steady and practical for the next review.",
          source_signal_ids: ["alert-active", "risk-latest-score"],
        },
        {
          id: "escalation-2",
          text: "Keep the wider care picture aligned for the next review.",
          source_signal_ids: ["care-circle-context", "consent-family-sharing"],
        },
      ],
    };

    expect(() => validateGeneratedHealthPlan(vaguePlan, sourceSignals, promptInput)).toThrow(
      /too vague for urgent follow-up|did not say what counts as done|missed specific guidance for required care coverage|receipt closes the urgent follow-up loop/i,
    );
  });

  it("repairs urgent monitoring and escalation items so the next move is concrete enough to execute", () => {
    const profile = createFragileProfile();
    const predictiveContext = createPredictiveContext();
    const sourceSignals = assembleRichHealthPlanSourceSignals(profile, predictiveContext);
    const promptInput = assembleHealthPlanPromptInput(profile, predictiveContext, sourceSignals, "en", {
      name: "Red Cross Leipzig",
      defaultLanguage: "en",
    });
    const brittleUrgentPlan = {
      ...createGroundedPlan(),
      monitoring_json: [
        {
          id: "monitor-1",
          text: "Review the current care picture and keep follow-up moving.",
          source_signal_ids: ["alert-active", "sensor-status", "service-checkins"],
        },
        {
          id: "monitor-2",
          text: "Keep track of whether the current risk picture settles.",
          source_signal_ids: ["risk-latest-score", "medication-plan"],
        },
      ],
      escalation_json: [
        {
          id: "escalation-1",
          text: "Escalate if the situation is still concerning.",
          source_signal_ids: ["alert-active", "risk-latest-score"],
        },
        {
          id: "escalation-2",
          text: "Keep the wider care picture aligned for the next review.",
          source_signal_ids: ["care-circle-context", "consent-family-sharing"],
        },
      ],
    };

    expect(() => validateGeneratedHealthPlan(brittleUrgentPlan, sourceSignals, promptInput)).toThrow(
      /too vague for urgent follow-up|did not say what receipt closes the urgent follow-up loop/i,
    );

    const repaired = repairGeneratedHealthPlan(brittleUrgentPlan, sourceSignals, promptInput);
    const validated = validateGeneratedHealthPlan(repaired, sourceSignals, promptInput);

    expect(validated.monitoring_json[0]?.text).toMatch(/today|fresh touchpoint|record/i);
    expect(validated.monitoring_json[0]?.text).toMatch(/if the first verification|if it does not|same day/i);
    expect(validated.escalation_json[0]?.text).toMatch(/same day|today/i);
    expect(validated.escalation_json[0]?.text).toMatch(/if .*cannot confirm|if .*still/i);
    expect(validated.escalation_json.some((item) => /proof|receipt|who records|closes the step/i.test(item?.text || ""))).toBe(true);
    expect(validated.monitoring_json[0]?.owner_label).toBeTruthy();
    expect(validated.monitoring_json[0]?.completion_proof).toMatch(/counts as done|recorded/i);
    expect(validated.monitoring_json[0]?.escalation_if_not_done).toMatch(/same day|stronger route|document/i);
    expect(validated.escalation_json[0]?.owner_label).toBeTruthy();
    expect(validated.escalation_json[0]?.completion_proof).toMatch(/counts as done|recorded/i);
    expect(validated.escalation_json[0]?.escalation_if_not_done).toMatch(/urgent|today|document/i);
  });

  it("rejects shareable guidance that hides evidence uncertainty behind settled wording", () => {
    const profile = createFragileProfile({
      medications: [
        {
          id: "med-1",
          medication_name: "Aspirin",
          dosage: "1 pill",
          purpose: "Pain",
          reminders_enabled: true,
          schedule_times: ["09:00"],
        },
      ],
      medicationActivity: { status: "taken", occurred_at: "2026-06-18T08:00:00.000Z" },
      checkins: { enabled: true, frequency: "daily", preferred_time: "09:00", last_outcome: "Completed" },
      brainCoach: { enabled: true, frequency: "weekly", preferred_time: "16:00", last_outcome: "Completed" },
      sensors: [{ id: "sensor-1", status: "online", sensor_type: "watch", device_name: "Health Watch", last_reading_at: "2026-06-18T09:10:00.000Z" }],
      alerts: [],
    });
    const predictiveContext = { latestScore: null, forecastRows: [] };
    const sourceSignals = assembleRichHealthPlanSourceSignals(profile, predictiveContext);
    const promptInput = assembleHealthPlanPromptInput(profile, predictiveContext, sourceSignals, "en", {
      name: "Red Cross Leipzig",
      defaultLanguage: "en",
    });
    const relaxedPromptInput = {
      ...promptInput,
      critical_signal_ids: [],
      next_confirmations: [],
      evidence_digest: {
        ...(promptInput?.evidence_digest || {}),
        freshness_gap: false,
        stale_signal_ids: [],
        unknown_freshness_signal_ids: [],
      },
    };
    const brittlePlan = {
      summary_text: "This stabilizing plan keeps today's live care picture visible while staff verify follow-up and preserve support routines.",
      summary_signal_ids: ["service-checkins", "medication-plan"],
      goals_json: [
        {
          id: "goal-1",
          text: "Keep the client supported while today's live picture is re-checked.",
          source_signal_ids: ["service-checkins", "medication-plan"],
        },
      ],
      daily_support_json: [
        {
          id: "daily-uncertain",
          text: "Continue the saved outreach routine today and keep support steady.",
          source_signal_ids: ["service-checkins", "context-live-profile-only"],
        },
      ],
      monitoring_json: [
        {
          id: "monitor-1",
          text: "Verify today's live status and record what changed.",
          source_signal_ids: ["service-checkins", "consent-family-sharing", "context-live-profile-only"],
        },
      ],
      escalation_json: [
        {
          id: "escalate-1",
          text: "Escalate the same day if today's live check still cannot confirm stability, and document the first live confirmation or why same-day escalation was needed. Counts as done when that confirmation or escalation result is recorded.",
          source_signal_ids: [
            "service-checkins",
            "service-brain-coach",
            "medication-plan",
            "care-circle-context",
            "consent-family-sharing",
            "context-live-profile-only",
          ],
        },
      ],
      caregiver_guidance_json: [
        {
          id: "caregiver-1",
          text: "Keep updates practical while staff confirm today's live picture.",
          source_signal_ids: ["service-checkins"],
        },
      ],
    };

    expect(sourceSignals.some((signal) => signal.id === "context-live-profile-only")).toBe(true);
    expect(() => validateGeneratedHealthPlan(brittlePlan, sourceSignals, relaxedPromptInput)).toThrow();
  });

  it("repairs shareable guidance so uncertain evidence is called out instead of hidden", () => {
    const profile = createFragileProfile({
      medications: [
        {
          id: "med-1",
          medication_name: "Aspirin",
          dosage: "1 pill",
          purpose: "Pain",
          reminders_enabled: true,
          schedule_times: ["09:00"],
        },
      ],
      medicationActivity: { status: "taken", occurred_at: "2026-06-18T08:00:00.000Z" },
      checkins: { enabled: true, frequency: "daily", preferred_time: "09:00", last_outcome: "Completed" },
      brainCoach: { enabled: true, frequency: "weekly", preferred_time: "16:00", last_outcome: "Completed" },
      sensors: [{ id: "sensor-1", status: "online", sensor_type: "watch", device_name: "Health Watch", last_reading_at: "2026-06-18T09:10:00.000Z" }],
      alerts: [],
    });
    const predictiveContext = { latestScore: null, forecastRows: [] };
    const sourceSignals = assembleRichHealthPlanSourceSignals(profile, predictiveContext);
    const promptInput = assembleHealthPlanPromptInput(profile, predictiveContext, sourceSignals, "en", {
      name: "Red Cross Leipzig",
      defaultLanguage: "en",
    });
    const brittlePlan = {
      summary_text: "This stabilizing plan keeps today's live care picture visible while staff verify follow-up and preserve support routines.",
      summary_signal_ids: ["service-checkins", "medication-plan"],
      goals_json: [
        {
          id: "goal-1",
          text: "Keep the client supported while today's live picture is re-checked.",
          source_signal_ids: ["service-checkins", "medication-plan"],
        },
      ],
      daily_support_json: [
        {
          id: "daily-uncertain",
          text: "Continue the saved outreach routine today and keep support steady.",
          source_signal_ids: ["service-checkins", "context-live-profile-only"],
        },
      ],
      monitoring_json: [
        {
          id: "monitor-1",
          text: "Verify today's live status and record what changed.",
          source_signal_ids: ["service-checkins", "consent-family-sharing", "context-live-profile-only"],
        },
      ],
      escalation_json: [
        {
          id: "escalate-1",
          text: "Escalate the same day if today's live check still cannot confirm stability, and document the first live confirmation or why same-day escalation was needed. Counts as done when that confirmation or escalation result is recorded.",
          source_signal_ids: [
            "service-checkins",
            "service-brain-coach",
            "medication-plan",
            "care-circle-context",
            "consent-family-sharing",
            "context-live-profile-only",
          ],
        },
      ],
      caregiver_guidance_json: [
        {
          id: "caregiver-1",
          text: "Keep updates practical while staff confirm today's live picture.",
          source_signal_ids: ["service-checkins"],
        },
      ],
    };

    const repaired = repairGeneratedHealthPlan(brittlePlan, sourceSignals, promptInput);
    const validated = validateGeneratedHealthPlan(repaired, sourceSignals, promptInput);

    expect(validated.daily_support_json[0]?.text).toMatch(/live check|confirm|staff-led/i);
  });

  it("rejects plans that repeat generic language across too many sections", () => {
    const profile = createFragileProfile();
    const predictiveContext = createPredictiveContext();
    const sourceSignals = assembleRichHealthPlanSourceSignals(profile, predictiveContext);
    const promptInput = assembleHealthPlanPromptInput(profile, predictiveContext, sourceSignals, "en", {
      name: "Red Cross Leipzig",
      defaultLanguage: "en",
    });
    const repeatedPlan = {
      summary_text: "This plan keeps the client steady while staff review the latest care picture.",
      summary_signal_ids: ["risk-latest-score", "alert-active"],
      goals_json: [
        { id: "goal-1", text: "Keep routines steady and stay in close contact with the client today.", source_signal_ids: ["risk-latest-score"] },
      ],
      daily_support_json: [
        { id: "daily-1", text: "Keep routines steady and stay in close contact with the client today.", source_signal_ids: ["medication-plan"] },
      ],
      monitoring_json: [
        { id: "monitor-1", text: "Keep routines steady and stay in close contact with the client today.", source_signal_ids: ["sensor-status"] },
      ],
      escalation_json: [
        { id: "escalation-1", text: "Escalate the same day if alerts persist or the client remains unreachable.", source_signal_ids: ["alert-active", "risk-latest-score"] },
      ],
      caregiver_guidance_json: [
        { id: "caregiver-1", text: "Keep routines steady and stay in close contact with the client today.", source_signal_ids: ["consent-family-sharing", "care-circle-context"] },
      ],
    };

    expect(() => validateGeneratedHealthPlan(repeatedPlan, sourceSignals, promptInput)).toThrow(
      /repeated generic language/i,
    );
  });

  it("accepts plans that stay grounded in the live care picture", () => {
    const profile = createFragileProfile();
    const predictiveContext = createPredictiveContext();
    const sourceSignals = assembleRichHealthPlanSourceSignals(profile, predictiveContext);
    const promptInput = assembleHealthPlanPromptInput(profile, predictiveContext, sourceSignals, "en", {
      name: "Red Cross Leipzig",
      defaultLanguage: "en",
    });

    const validated = validateGeneratedHealthPlan(createGroundedPlan(), sourceSignals, promptInput);

    expect(validated.summary_text).toContain("same-day escalation");
    expect(validated.monitoring_json).toHaveLength(2);
  });
});
