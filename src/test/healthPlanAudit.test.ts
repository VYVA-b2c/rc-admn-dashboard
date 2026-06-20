import { describe, expect, it } from "vitest";

import {
  applyHealthPlanAutomatedReviewGuardrails,
  buildHealthPlanAudit,
  buildHealthPlanApprovalGate,
  buildHealthPlanCoordinationSummary,
  buildHealthPlanExecutionPack,
  buildHealthPlanRegenerationFocus,
  buildFallbackHealthPlanAutomatedReview,
  buildPatchedHealthPlanDraft,
  buildHealthPlanQualitySummary,
  buildHealthPlanReviewApproval,
  buildHealthPlanReviewerAssessment,
  hasMaterialHealthPlanEdits,
  resolveHealthPlanReviewWriteState,
  reviewAttestationHasRequiredConfirmations,
} from "../../server/index.mjs";

function createStableProfile(overrides = {}) {
  return {
    user: { language: "en" },
    consent: { caretaker_consent: true, consent_given: true },
    health: { health_conditions: [], mobility_needs: [] },
    medications: [
      {
        id: "med-1",
        medication_name: "Aspirin",
        dosage: "1 pill",
        purpose: "General",
        reminders_enabled: true,
        schedule_times: ["09:00"],
      },
    ],
    medicationActivity: { status: "taken" },
    checkins: { enabled: true, frequency: "daily", preferred_time: "09:00" },
    brainCoach: { enabled: true, frequency: "weekly", preferred_time: "16:00" },
    sensors: [{ id: "sensor-1", status: "online" }],
    alerts: [],
    careProviders: [{ id: "cp-1", provider_type: "field_staff", display_name: "Ana Novak", is_primary: true }],
    ...overrides,
  };
}

describe("buildHealthPlanAudit", () => {
  it("builds an urgent coordination summary when critical care obligations are still uncovered", () => {
    const profile = createStableProfile({
      alerts: [{ id: "alert-1", severity: "critical", message: "Client could not be reached", resolved_at: null }],
      careProviders: [],
      consent: { caretaker_consent: false, consent_given: false },
      medicationActivity: { status: "missed" },
      sensors: [{ id: "sensor-1", status: "offline" }],
    });
    const plan = {
      id: "hp-coordination-1",
      language: "en",
      review_status: "draft",
      generator_provider: "openai",
      generated_at: new Date("2026-06-18T08:00:00.000Z").toISOString(),
      source_signals_json: [
        { id: "alert-active", label: "Active alert", category: "alert", strength: "high" },
        { id: "medication-plan", label: "Medication", category: "medication", strength: "high" },
        { id: "sensor-status", label: "Sensor status", category: "sensor", strength: "high" },
        { id: "care-circle-context", label: "Profile context", category: "care-circle", strength: "high" },
        { id: "consent-family-sharing", label: "Family sharing consent not confirmed", category: "care-circle", strength: "medium" },
      ],
      summary_text: "Keep the care routine practical while staff review the latest situation.",
      goals_json: [{ id: "goal-1", text: "Keep the client supported.", source_signal_ids: ["alert-active"] }],
      daily_support_json: [{ id: "daily-1", text: "Stay calm and supportive.", source_signal_ids: ["alert-active"] }],
      monitoring_json: [{ id: "monitor-1", text: "Watch for changes.", source_signal_ids: ["alert-active"] }],
      escalation_json: [{ id: "escalate-1", text: "Escalate if things worsen.", source_signal_ids: ["alert-active"] }],
      caregiver_guidance_json: [{ id: "caregiver-1", text: "Keep notes practical.", source_signal_ids: ["alert-active"] }],
    };

    const coordination = buildHealthPlanCoordinationSummary(
      plan,
      profile,
      { latestScore: { risk_band: "high", composite_score: 88 }, forecastRows: [] },
      { name: "Red Cross Leipzig", defaultLanguage: "en" },
      new Date("2026-06-18T12:00:00.000Z"),
    );

    expect(coordination?.state).toBe("urgent");
    expect(coordination?.response_window).toBe("same_day");
    expect(coordination?.sharing_boundary).toBe("staff_only");
    expect(coordination?.owner_missing).toBe(true);
    expect(coordination?.ready_for_share).toBe(false);
    expect(coordination?.recommended_action_code).toBe("review_plan");
    expect(coordination?.commitments?.find((item) => item.code === "assign_owner")?.proof_hint).toContain("named owner");
    expect(coordination?.commitments?.find((item) => item.code === "contact_client")?.proof_hint).toContain("client touchpoint");
    expect(coordination?.open_commitment_codes).toEqual(
      expect.arrayContaining([
        "review_plan",
        "assign_owner",
        "contact_client",
        "review_alerts",
        "verify_medication",
        "check_sensors",
        "respect_sharing_boundary",
        "refresh_plan",
      ]),
    );
  });

  it("builds an execution pack with proof and escalation for urgent open tasks", () => {
    const profile = createStableProfile({
      alerts: [{ id: "alert-1", severity: "critical", message: "Client could not be reached", resolved_at: null, created_at: "2026-06-18T07:00:00.000Z" }],
      careProviders: [],
      consent: { caretaker_consent: false, consent_given: false },
      medicationActivity: { status: "missed", occurred_at: "2026-06-18T08:00:00.000Z" },
      sensors: [{ id: "sensor-1", status: "offline", last_reading_at: "2026-06-18T08:30:00.000Z" }],
    });
    const plan = {
      id: "hp-execution-1",
      language: "en",
      review_status: "draft",
      generator_provider: "openai",
      generated_at: new Date("2026-06-18T08:00:00.000Z").toISOString(),
      source_signals_json: [
        { id: "alert-active", label: "Active alert", category: "alert", strength: "high" },
        { id: "medication-plan", label: "Medication", category: "medication", strength: "high" },
        { id: "sensor-status", label: "Sensor status", category: "sensor", strength: "high" },
        { id: "care-circle-context", label: "Profile context", category: "care-circle", strength: "high" },
        { id: "consent-family-sharing", label: "Family sharing consent not confirmed", category: "care-circle", strength: "medium" },
      ],
      summary_text: "Keep the care routine practical while staff review the latest situation.",
      goals_json: [{ id: "goal-1", text: "Keep the client supported.", source_signal_ids: ["alert-active"] }],
      daily_support_json: [{ id: "daily-1", text: "Stay calm and supportive.", source_signal_ids: ["alert-active"] }],
      monitoring_json: [{ id: "monitor-1", text: "Watch for changes.", source_signal_ids: ["alert-active"] }],
      escalation_json: [{ id: "escalate-1", text: "Escalate if things worsen.", source_signal_ids: ["alert-active"] }],
      caregiver_guidance_json: [{ id: "caregiver-1", text: "Keep notes practical.", source_signal_ids: ["alert-active"] }],
    };

    const executionPack = buildHealthPlanExecutionPack(
      plan,
      profile,
      { latestScore: { risk_band: "high", composite_score: 88, score_date: "2026-06-18" }, forecastRows: [] },
      { name: "Red Cross Leipzig", defaultLanguage: "en" },
      new Date("2026-06-18T12:00:00.000Z"),
    );

    expect(executionPack?.state).toBe("urgent");
    expect(executionPack?.next_task_code).toBe("review_plan");
    expect(executionPack?.high_priority_task_count).toBeGreaterThan(0);
    expect(executionPack?.tasks?.find((task) => task.code === "assign_owner")?.completion_proof).toContain("named owner");
    expect(executionPack?.tasks?.find((task) => task.code === "contact_client")?.escalation_if_not_done).toContain("cannot be reached");
  });

  it("flags when the same-day execution lane is overloaded and needs triage", () => {
    const profile = createStableProfile({
      alerts: [{ id: "alert-1", severity: "critical", message: "Client could not be reached", resolved_at: null, created_at: "2026-06-18T07:00:00.000Z" }],
      careProviders: [],
      consent: { caretaker_consent: false, consent_given: false },
      medicationActivity: { status: "missed", occurred_at: "2026-06-18T08:00:00.000Z" },
      sensors: [{ id: "sensor-1", status: "offline", last_reading_at: "2026-06-18T08:30:00.000Z" }],
    });
    const plan = {
      id: "hp-execution-overload-1",
      language: "en",
      review_status: "draft",
      generator_provider: "openai",
      generated_at: new Date("2026-06-18T08:00:00.000Z").toISOString(),
      source_signals_json: [
        { id: "alert-active", label: "Active alert", category: "alert", strength: "high" },
        { id: "medication-plan", label: "Medication", category: "medication", strength: "high" },
        { id: "sensor-status", label: "Sensor status", category: "sensor", strength: "high" },
        { id: "care-circle-context", label: "Profile context", category: "care-circle", strength: "high" },
        { id: "consent-family-sharing", label: "Family sharing consent not confirmed", category: "care-circle", strength: "medium" },
      ],
      summary_text: "Keep the care routine practical while staff review the latest situation.",
      goals_json: [{ id: "goal-1", text: "Keep the client supported.", source_signal_ids: ["alert-active"] }],
      daily_support_json: [{ id: "daily-1", text: "Stay calm and supportive.", source_signal_ids: ["alert-active"] }],
      monitoring_json: [{ id: "monitor-1", text: "Watch for changes.", source_signal_ids: ["alert-active"] }],
      escalation_json: [{ id: "escalate-1", text: "Escalate if things worsen.", source_signal_ids: ["alert-active"] }],
      caregiver_guidance_json: [{ id: "caregiver-1", text: "Keep notes practical.", source_signal_ids: ["alert-active"] }],
    };

    const executionPack = buildHealthPlanExecutionPack(
      plan,
      profile,
      { latestScore: { risk_band: "high", composite_score: 88, score_date: "2026-06-18" }, forecastRows: [] },
      { name: "Red Cross Leipzig", defaultLanguage: "en" },
      new Date("2026-06-18T12:00:00.000Z"),
    );

    expect(executionPack?.load_state).toBe("overloaded");
    expect(executionPack?.load_reason_codes).toEqual(
      expect.arrayContaining(["same_day_task_stack", "high_priority_stack"]),
    );
    expect(executionPack?.triage_task_codes.length).toBeGreaterThan(0);
    expect(executionPack?.triage_task_codes.length).toBeLessThanOrEqual(3);
    expect(executionPack?.triage_summary_text).toMatch(/first 3 tasks in active same-day focus/i);
  });

  it("asks for an approved care-circle update once an urgent reviewed plan is otherwise grounded", () => {
    const profile = createStableProfile({
      alerts: [{ id: "alert-1", severity: "high", message: "Dizziness persists", resolved_at: null }],
      medicationActivity: { status: "missed" },
    });
    const plan = {
      id: "hp-coordination-2",
      language: "en",
      review_status: "reviewed",
      generator_provider: "openai",
      generation_confidence: "high",
      generation_assessment_json: {
        confidence: "high",
        readiness: "ready_for_review",
        source_signal_count: 5,
        critical_signal_count: 2,
        care_provider_count: 1,
        live_signal_count: 4,
        predictive_available: true,
        reasons: [],
      },
      generated_at: new Date("2026-06-18T10:30:00.000Z").toISOString(),
      source_signals_json: [
        { id: "risk-latest-score", label: "Predictive risk score 84 (high)", category: "risk", strength: "high" },
        { id: "alert-active", label: "Active alert", category: "alert", strength: "high" },
        { id: "medication-plan", label: "Medication", category: "medication", strength: "high" },
        { id: "care-circle-context", label: "Profile context", category: "context", strength: "medium" },
        { id: "consent-family-sharing", label: "Family sharing consent active", category: "care-circle", strength: "low" },
      ],
      summary_text: "Use the next same-day call to stabilise the care picture and keep follow-up clear.",
      goals_json: [{ id: "goal-1", text: "Keep the client reachable today within the current high-risk picture.", source_signal_ids: ["alert-active", "risk-latest-score"] }],
      daily_support_json: [{ id: "daily-1", text: "Call the client today and confirm medication adherence.", source_signal_ids: ["alert-active", "medication-plan"] }],
      monitoring_json: [{ id: "monitor-1", text: "Monitor response and medication follow-up today.", source_signal_ids: ["alert-active", "medication-plan"] }],
      escalation_json: [{ id: "escalate-1", text: "If symptoms persist today, the named owner should escalate the same day within the current high-risk picture.", source_signal_ids: ["alert-active", "care-circle-context", "risk-latest-score"] }],
      caregiver_guidance_json: [{ id: "caregiver-1", text: "The named owner should keep practical notes until the first outreach is complete.", source_signal_ids: ["care-circle-context"] }],
    };

    const coordination = buildHealthPlanCoordinationSummary(
      plan,
      profile,
      { latestScore: { risk_band: "high", composite_score: 84 }, forecastRows: [] },
      { name: "Red Cross Leipzig", defaultLanguage: "en" },
      new Date("2026-06-18T12:00:00.000Z"),
    );

    expect(coordination?.state).toBe("watch");
    expect(coordination?.recommended_action_code).toBe("update_care_circle");
    expect(coordination?.open_commitment_codes).toContain("update_care_circle");
    expect(coordination?.commitments?.find((item) => item.code === "contact_client")?.status).toBe("covered");
    expect(coordination?.commitments?.find((item) => item.code === "verify_medication")?.status).toBe("covered");
    expect(coordination?.commitments?.find((item) => item.code === "update_care_circle")?.proof_hint).toContain("care-circle update");
  });

  it("adds a fresh-touchpoint execution task when critical evidence is stale", () => {
    const profile = createStableProfile({
      alerts: [{ id: "alert-1", severity: "high", message: "Client could not be reached", resolved_at: null, created_at: "2026-06-14T07:00:00.000Z" }],
      medicationActivity: { status: "missed", occurred_at: "2026-06-14T08:00:00.000Z" },
      sensors: [{ id: "sensor-1", status: "offline", last_reading_at: "2026-06-14T08:30:00.000Z" }],
      careProviders: [],
      consent: { caretaker_consent: false, consent_given: false },
    });
    const plan = {
      id: "hp-execution-2",
      language: "en",
      review_status: "draft",
      generator_provider: "openai",
      generated_at: new Date("2026-06-14T09:00:00.000Z").toISOString(),
      source_signals_json: [
        { id: "alert-active", label: "Active alert", category: "alert", strength: "high" },
        { id: "medication-plan", label: "Medication", category: "medication", strength: "high" },
        { id: "sensor-status", label: "Sensor status", category: "sensor", strength: "high" },
      ],
      summary_text: "Use the saved plan carefully until the live picture is refreshed.",
      goals_json: [{ id: "goal-1", text: "Keep outreach active.", source_signal_ids: ["alert-active"] }],
      daily_support_json: [{ id: "daily-1", text: "Keep the support routine visible.", source_signal_ids: ["medication-plan"] }],
      monitoring_json: [{ id: "monitor-1", text: "Watch for further change.", source_signal_ids: ["sensor-status"] }],
      escalation_json: [{ id: "escalate-1", text: "Escalate if follow-up is still unclear.", source_signal_ids: ["alert-active", "medication-plan"] }],
      caregiver_guidance_json: [{ id: "caregiver-1", text: "Keep updates inside staff.", source_signal_ids: ["consent-family-sharing"] }],
    };

    const executionPack = buildHealthPlanExecutionPack(
      plan,
      profile,
      { latestScore: { risk_band: "high", composite_score: 88, score_date: "2026-06-14" }, forecastRows: [] },
      { name: "Red Cross Leipzig", defaultLanguage: "en" },
      new Date("2026-06-18T12:00:00.000Z"),
    );

    const freshnessTask = executionPack?.tasks?.find((task) => task.code === "refresh_live_status");
    expect(freshnessTask).toBeTruthy();
    expect(freshnessTask?.priority).toBe("high");
    expect(freshnessTask?.completion_proof).toContain("new touchpoint");
  });

  it("settles into stable once review, ownership, timing, and sharing are all covered", () => {
    const profile = createStableProfile();
    const plan = {
      id: "hp-coordination-3",
      language: "en",
      review_status: "reviewed",
      generator_provider: "openai",
      generation_confidence: "high",
      generation_assessment_json: {
        confidence: "high",
        readiness: "ready_for_review",
        source_signal_count: 4,
        critical_signal_count: 0,
        care_provider_count: 1,
        live_signal_count: 4,
        predictive_available: false,
        reasons: [],
      },
      generated_at: new Date("2026-06-18T10:30:00.000Z").toISOString(),
      source_signals_json: [
        { id: "service-checkins", label: "Check-ins", category: "service", strength: "low" },
        { id: "service-brain-coach", label: "Brain Coach", category: "service", strength: "low" },
        { id: "care-circle-context", label: "Profile context", category: "context", strength: "low" },
        { id: "consent-family-sharing", label: "Family sharing consent active", category: "care-circle", strength: "low" },
      ],
      summary_text: "Keep routines steady and share calm updates with the care circle if anything changes.",
      goals_json: [{ id: "goal-1", text: "Keep routines steady through the next 24 hours.", source_signal_ids: ["service-checkins"] }],
      daily_support_json: [{ id: "daily-1", text: "Use the existing support rhythm through the next 24 hours.", source_signal_ids: ["service-checkins"] }],
      monitoring_json: [{ id: "monitor-1", text: "Monitor routine completion through today.", source_signal_ids: ["service-checkins"] }],
      escalation_json: [{ id: "escalate-1", text: "If routine completion drops today, the named owner should escalate within 24 hours.", source_signal_ids: ["service-brain-coach", "care-circle-context"] }],
      caregiver_guidance_json: [{ id: "caregiver-1", text: "The named owner should share calm updates with the approved care circle.", source_signal_ids: ["care-circle-context", "consent-family-sharing"] }],
    };

    const coordination = buildHealthPlanCoordinationSummary(
      plan,
      profile,
      { latestScore: null, forecastRows: [] },
      { name: "Red Cross Leipzig", defaultLanguage: "en" },
      new Date("2026-06-18T12:00:00.000Z"),
    );

    expect(coordination?.state).toBe("stable");
    expect(coordination?.ready_for_share).toBe(true);
    expect(coordination?.recommended_action_code).toBe(null);
    expect(coordination?.open_commitment_codes).toHaveLength(0);
    expect(coordination?.commitments?.find((item) => item.code === "review_plan")?.proof_hint).toContain("reviewed plan");
  });

  it("marks the plan for regeneration when a new critical live signal appears", () => {
    const profile = createStableProfile({
      alerts: [{ id: "alert-1", severity: "high", message: "Client could not be reached", resolved_at: null }],
    });
    const plan = {
      id: "hp-1",
      language: "en",
      review_status: "reviewed",
      generator_provider: "openai",
      generated_at: new Date("2026-06-18T08:00:00.000Z").toISOString(),
      source_signals_json: [
        { id: "service-checkins", label: "Check-ins", category: "service", strength: "low" },
      ],
      goals_json: [{ id: "goal-1", text: "Keep routines steady.", source_signal_ids: ["service-checkins"] }],
      daily_support_json: [{ id: "daily-1", text: "Call every morning.", source_signal_ids: ["service-checkins"] }],
      monitoring_json: [{ id: "monitor-1", text: "Watch response quality.", source_signal_ids: ["service-checkins"] }],
      escalation_json: [{ id: "escalate-1", text: "Escalate if the client cannot be reached.", source_signal_ids: ["service-checkins"] }],
      caregiver_guidance_json: [{ id: "caregiver-1", text: "Keep the care circle informed.", source_signal_ids: ["service-checkins"] }],
    };

    const audit = buildHealthPlanAudit(
      plan,
      profile,
      { latestScore: null, forecastRows: [] },
      { name: "Red Cross Leipzig", defaultLanguage: "en" },
      new Date("2026-06-18T12:00:00.000Z"),
    );

    expect(audit.status).toBe("needs_regeneration");
    expect(audit.regeneration_recommended).toBe(true);
    expect(audit.new_critical_signal_ids).toContain("alert-active");
    expect(audit.reasons.some((reason) => reason.code === "new_critical_signals")).toBe(true);
  });

  it("creates a deterministic automated review receipt when the LLM reviewer is unavailable", () => {
    const profile = createStableProfile();
    const sourceSignals = [
      { id: "service-checkins", label: "Check-ins", category: "service", strength: "low" },
      { id: "service-brain-coach", label: "Brain Coach", category: "service", strength: "low" },
    ];
    const plan = {
      id: "hp-auto-review-1",
      language: "en",
      review_status: "draft",
      summary_text: "Keep routines steady and make the same-day follow-up owner explicit if the routine drops.",
      goals_json: [{ id: "goal-1", text: "Keep routines steady through the next 24 hours.", source_signal_ids: ["service-checkins"] }],
      daily_support_json: [{ id: "daily-1", text: "Use the existing support rhythm and confirm the named owner.", source_signal_ids: ["service-checkins"] }],
      monitoring_json: [{ id: "monitor-1", text: "Monitor routine completion through today.", source_signal_ids: ["service-checkins"] }],
      escalation_json: [{ id: "escalate-1", text: "If routine drops today, the named owner should escalate the same day.", source_signal_ids: ["service-brain-coach"] }],
      caregiver_guidance_json: [{ id: "caregiver-1", text: "The named owner should share calm updates with the care circle.", source_signal_ids: ["service-brain-coach"] }],
      generation_confidence: "high",
      generation_assessment_json: {
        confidence: "high",
        readiness: "ready_for_review",
        source_signal_count: 4,
        critical_signal_count: 0,
        care_provider_count: 1,
        live_signal_count: 4,
        predictive_available: false,
        reasons: [],
      },
      generated_at: new Date("2026-06-18T08:00:00.000Z").toISOString(),
    };

    const automatedReview = buildFallbackHealthPlanAutomatedReview(
      plan,
      profile,
      { latestScore: null, forecastRows: [] },
      sourceSignals,
      { name: "Red Cross Leipzig", defaultLanguage: "en" },
      new Date("2026-06-18T09:00:00.000Z"),
    );

    expect(automatedReview.verdict).toMatch(/pass|revise|block/);
    expect(automatedReview.provider).toBe("fallback");
    expect(automatedReview.grounded_signal_ids.length).toBeGreaterThan(0);
    expect(automatedReview.rubric_scores?.grounding).toBeGreaterThanOrEqual(0);
    expect(automatedReview.rubric_scores?.actionability).toBeGreaterThanOrEqual(0);
    expect(automatedReview.rubric_scores?.overall).toBeGreaterThanOrEqual(0);
    expect(automatedReview.rubric_scores?.overall).toBeLessThanOrEqual(100);
  });

  it("downgrades review and quality trust when the saved plan was followed by a worse live outcome", () => {
    const profile = createStableProfile({
      alerts: [{ id: "alert-1", severity: "high", message: "Client could not be reached", resolved_at: null }],
      medicationActivity: { status: "missed" },
      sensors: [{ id: "sensor-1", status: "offline" }],
      user: {
        language: "en",
        emergency_notes: [
          `[2026-06-18T11:00:00.000Z - ana@redcross.example] #VYVA_HANDOFF {"priority":"high","responseWindow":"same_day","sharingBoundary":"approved_circle","ownerName":"Ana Novak","ownerMissing":false,"careCircleCount":1,"activeAlertCount":1,"offlineSensorCount":1,"missedMedication":true,"highRisk":true,"actions":["confirm_today_touchpoint"]}`,
        ].join("\n\n"),
      },
    });
    const plan = {
      id: "hp-outcome-quality-1",
      language: "en",
      review_status: "reviewed",
      generator_provider: "openai",
      generated_at: new Date("2026-06-18T08:00:00.000Z").toISOString(),
      context_snapshot_json: {
        snapshot_version: "health-plan-context-v1",
        response_path: {
          handoff_open: false,
          first_contact_recorded: true,
          escalation_closed: true,
          repeated_client_channel: null,
          alternate_audience_open: false,
          care_circle_route_available: true,
          care_circle_route_used: true,
        },
        medications: [{ medication_name: "Aspirin", reminders_enabled: true, schedule_times: ["09:00"] }],
        medication_activity: { status: "taken" },
        checkins: { enabled: true, frequency: "daily", preferred_time: "09:00", last_outcome: "Completed" },
        brain_coach: { enabled: true, frequency: "weekly", preferred_time: "16:00", last_outcome: "Completed" },
        sensors: [{ device_name: "Health Watch", sensor_type: "watch", status: "online" }],
        alerts: [],
      },
      source_signals_json: [
        { id: "service-checkins", label: "Check-ins", category: "service", strength: "low" },
        { id: "service-brain-coach", label: "Brain Coach", category: "service", strength: "low" },
        { id: "care-circle-context", label: "Profile context", category: "context", strength: "low" },
      ],
      summary_text: "Keep routines steady and share calm updates with the care circle if anything changes.",
      goals_json: [{ id: "goal-1", text: "Keep routines steady through the next 24 hours.", source_signal_ids: ["service-checkins"] }],
      daily_support_json: [{ id: "daily-1", text: "Use the existing support rhythm through the next 24 hours.", source_signal_ids: ["service-checkins"] }],
      monitoring_json: [{ id: "monitor-1", text: "Monitor routine completion through today.", source_signal_ids: ["service-checkins"] }],
      escalation_json: [{ id: "escalate-1", text: "If routine completion drops today, the named owner should escalate within 24 hours.", source_signal_ids: ["service-brain-coach", "care-circle-context"] }],
      caregiver_guidance_json: [{ id: "caregiver-1", text: "The named owner should share calm updates with the approved care circle.", source_signal_ids: ["care-circle-context"] }],
    };

    const review = buildHealthPlanReviewerAssessment(
      plan,
      profile,
      { latestScore: { risk_band: "high", composite_score: 88 }, forecastRows: [] },
      { name: "Red Cross Leipzig", defaultLanguage: "en" },
    );
    const quality = buildHealthPlanQualitySummary(
      plan,
      profile,
      { latestScore: { risk_band: "high", composite_score: 88 }, forecastRows: [] },
      { name: "Red Cross Leipzig", defaultLanguage: "en" },
      new Date("2026-06-18T12:00:00.000Z"),
    );

    expect(review?.checks.some((item) => item.code === "prior_plan_outcome_worsened" && item.state === "critical")).toBe(true);
    expect(review?.status).toBe("hold");
    expect(quality?.outcome_trajectory).toBe("worsened");
    expect(quality?.cautions.some((item) => item.code === "prior_plan_outcome_worsened")).toBe(true);
    expect(quality?.trust_level).toBe("low");
  });

  it("lets automated review rubric scores pull quality trust down when the plan is still too weak to act on", () => {
    const profile = createStableProfile({
      consent: { caretaker_consent: false, consent_given: false },
      careProviders: [],
      alerts: [{ id: "alert-1", severity: "critical", message: "Client could not be reached", resolved_at: null }],
      medicationActivity: { status: "missed" },
      sensors: [{ id: "sensor-1", status: "offline" }],
    });
    const plan = {
      id: "hp-quality-rubric-1",
      language: "en",
      review_status: "draft",
      generator_provider: "openai",
      generated_at: new Date("2026-06-18T08:00:00.000Z").toISOString(),
      source_signals_json: [
        { id: "alert-active", label: "Active alert", category: "alert", strength: "high" },
        { id: "medication-plan", label: "Medication", category: "medication", strength: "high" },
        { id: "sensor-status", label: "Sensor status", category: "sensor", strength: "high" },
        { id: "care-circle-context", label: "Profile context", category: "care-circle", strength: "high" },
        { id: "consent-family-sharing", label: "Family sharing consent not confirmed", category: "care-circle", strength: "medium" },
      ],
      summary_text: "Keep the situation calm while the team reviews the case.",
      goals_json: [{ id: "goal-1", text: "Keep the client supported.", source_signal_ids: ["alert-active"] }],
      daily_support_json: [{ id: "daily-1", text: "Stay supportive.", source_signal_ids: ["alert-active"] }],
      monitoring_json: [{ id: "monitor-1", text: "Watch for changes.", source_signal_ids: ["alert-active"] }],
      escalation_json: [{ id: "escalate-1", text: "Escalate if needed.", source_signal_ids: ["alert-active"] }],
      caregiver_guidance_json: [{ id: "caregiver-1", text: "Keep updates practical.", source_signal_ids: ["alert-active"] }],
      automated_review_json: {
        verdict: "revise",
        checked_at: "2026-06-18T09:00:00.000Z",
        summary_text: "The plan still feels too vague for urgent follow-up.",
        grounded_signal_ids: ["alert-active", "medication-plan"],
        strengths: [],
        concerns: [{ code: "plan_actionability_weak", severity: "high", detail: "Urgent steps are still too vague." }],
        required_actions: ["Name the first receipt of contact and the follow-up owner."],
        shareability: "staff_only",
        rubric_scores: {
          grounding: 58,
          actionability: 32,
          timeliness: 40,
          safety: 48,
          shareability: 52,
          overall: 41,
        },
        provider: "fallback",
        model: "deterministic-review",
        version: "health-plan-v1-review-fallback",
      },
    };

    const quality = buildHealthPlanQualitySummary(
      plan,
      profile,
      { latestScore: { risk_band: "high", composite_score: 88 }, forecastRows: [] },
      { name: "Red Cross Leipzig", defaultLanguage: "en" },
      new Date("2026-06-18T12:00:00.000Z"),
    );

    expect(quality?.trust_level).toBe("low");
    expect(quality?.cautions.some((item) => item.code === "automated_review_rubric_low")).toBe(true);
    expect(quality?.cautions.some((item) => item.code === "plan_actionability_weak")).toBe(true);
    expect(quality?.score).toBeLessThan(60);
    expect(quality?.trust_summary?.state).toBe("do_not_share");
    expect(quality?.trust_summary?.reason_codes).toEqual(
      expect.arrayContaining(["automated_review_rubric_low", "plan_actionability_weak"]),
    );
  });

  it("lets execution overload pull review and quality trust down even when the plan covers the basics", () => {
    const profile = createStableProfile({
      alerts: [{ id: "alert-1", severity: "critical", message: "Client could not be reached", resolved_at: null, created_at: "2026-06-18T07:00:00.000Z" }],
      consent: { caretaker_consent: false, consent_given: false },
      medicationActivity: { status: "missed", occurred_at: "2026-06-18T08:00:00.000Z" },
      sensors: [{ id: "sensor-1", status: "offline", last_reading_at: "2026-06-18T08:30:00.000Z" }],
      careProviders: [{ id: "cp-1", provider_type: "field_staff", display_name: "Ana Novak", is_primary: true }],
    });
    const plan = {
      id: "hp-execution-overload-review-1",
      language: "en",
      review_status: "reviewed",
      generator_provider: "openai",
      generation_confidence: "high",
      generation_assessment_json: {
        confidence: "high",
        readiness: "ready_for_review",
        source_signal_count: 5,
        critical_signal_count: 3,
        care_provider_count: 1,
        live_signal_count: 5,
        predictive_available: true,
        reasons: [],
      },
      generated_at: new Date("2026-06-18T08:00:00.000Z").toISOString(),
      source_signals_json: [
        { id: "alert-active", label: "Active alert", category: "alert", strength: "high" },
        { id: "medication-plan", label: "Medication", category: "medication", strength: "high" },
        { id: "sensor-status", label: "Sensor status", category: "sensor", strength: "high" },
        { id: "care-circle-context", label: "Profile context", category: "care-circle", strength: "high" },
        { id: "consent-family-sharing", label: "Family sharing consent not confirmed", category: "care-circle", strength: "medium" },
      ],
      summary_text: "Keep the same-day support picture visible while Ana Novak coordinates the next response steps.",
      goals_json: [{ id: "goal-1", text: "Keep the client supported through today's high-risk picture.", source_signal_ids: ["alert-active", "medication-plan"] }],
      daily_support_json: [{ id: "daily-1", text: "Ana Novak keeps the client contact and medication routine moving today.", source_signal_ids: ["alert-active", "medication-plan"] }],
      monitoring_json: [{ id: "monitor-1", text: "Ana Novak reviews alerts, sensor reliability, and medication status today and records what changes.", source_signal_ids: ["alert-active", "sensor-status", "medication-plan"] }],
      escalation_json: [{ id: "escalate-1", text: "If the first client touchpoint does not land today, Ana Novak escalates the same day and records the closure path.", source_signal_ids: ["alert-active", "care-circle-context", "sensor-status"] }],
      caregiver_guidance_json: [{ id: "caregiver-1", text: "Keep updates inside staff until consent is confirmed, and keep Ana Novak as the visible owner for the next step.", source_signal_ids: ["care-circle-context", "consent-family-sharing"] }],
    };

    const review = buildHealthPlanReviewerAssessment(
      plan,
      profile,
      { latestScore: { risk_band: "high", composite_score: 88 }, forecastRows: [] },
      { name: "Red Cross Leipzig", defaultLanguage: "en" },
    );
    const quality = buildHealthPlanQualitySummary(
      plan,
      profile,
      { latestScore: { risk_band: "high", composite_score: 88 }, forecastRows: [] },
      { name: "Red Cross Leipzig", defaultLanguage: "en" },
      new Date("2026-06-18T12:00:00.000Z"),
    );

    expect(review?.checks.some((item) => item.code === "same_day_lane_overloaded" && item.state === "critical")).toBe(true);
    expect(review?.next_moves.some((item) => /first 3 tasks|same-day lane/i.test(item.text))).toBe(true);
    expect(quality?.cautions.some((item) => item.code === "execution_lane_overloaded")).toBe(true);
    expect(quality?.score).toBeLessThan(80);
  });

  it("marks a medium-confidence plan as staff-review only even when a full regenerate is not required", () => {
    const profile = createStableProfile({
      alerts: [],
      medicationActivity: { status: "taken", occurred_at: "2026-06-18T09:15:00.000Z" },
      sensors: [{ id: "sensor-1", status: "online" }],
    });
    const plan = {
      id: "hp-trust-summary-1",
      language: "en",
      review_status: "draft",
      generator_provider: "openai",
      generation_confidence: "medium",
      generation_assessment_json: {
        confidence: "medium",
        readiness: "review_before_share",
        source_signal_count: 6,
        critical_signal_count: 2,
        care_provider_count: 1,
        live_signal_count: 2,
        stale_signal_count: 0,
        unknown_freshness_signal_count: 0,
        predictive_available: true,
        trust_gate_state: "review_only",
        trust_gate_reason_codes: ["generation_confidence_not_high", "fresh_live_evidence_limited"],
        trust_gate_summary_text: "This AI-authored draft should stay staff-review only until fresher or stronger evidence closes the remaining uncertainty.",
        trust_gate_operator_action: "Keep the draft staff-only, gather fresher receipts or confirmations, and review before sharing.",
        reasons: [
          { code: "generation_confidence_not_high", severity: "medium", detail: "The generation context is not strong enough to treat the draft as broadly shareable without staff review." },
        ],
      },
      generated_at: new Date("2026-06-18T10:00:00.000Z").toISOString(),
      source_signals_json: [
        { id: "risk-latest-score", label: "Predictive risk score", category: "risk", strength: "medium", freshness: "live" },
        { id: "medication-plan", label: "Medication", category: "medication", strength: "medium", freshness: "live" },
        { id: "service-checkins", label: "Check-in service", category: "service", strength: "medium", freshness: "live" },
        { id: "care-circle-context", label: "Profile context", category: "care-circle", strength: "medium", freshness: "recent" },
      ],
      summary_text: "Keep the client supported while staff verify today's medication, routine, and overall risk picture before broader sharing.",
      goals_json: [{ id: "goal-1", text: "Keep the client supported and stable through today's review window.", source_signal_ids: ["risk-latest-score", "service-checkins"] }],
      daily_support_json: [{ id: "daily-1", text: "Use the saved routines while medication and contact rhythm are rechecked.", source_signal_ids: ["medication-plan", "service-checkins"] }],
      monitoring_json: [{ id: "monitor-1", text: "Verify today's medication status and routine completion, then record what the live check confirms.", source_signal_ids: ["medication-plan", "service-checkins", "care-circle-context"] }],
      escalation_json: [{ id: "escalate-1", text: "Escalate within 24 hours if the live check shows the routine is slipping or medication follow-up cannot be confirmed, and record the first receipt of action.", source_signal_ids: ["risk-latest-score", "medication-plan"] }],
      caregiver_guidance_json: [{ id: "caregiver-1", text: "Keep updates within the approved care circle until staff recheck the current situation.", source_signal_ids: ["care-circle-context"] }],
    };

    const quality = buildHealthPlanQualitySummary(
      plan,
      profile,
      { latestScore: { risk_band: "moderate", composite_score: 54 }, forecastRows: [] },
      { name: "Red Cross Leipzig", defaultLanguage: "en" },
      new Date("2026-06-18T12:00:00.000Z"),
    );

    expect(quality?.trust_summary?.state).toBe("staff_review_only");
    expect(quality?.trust_summary?.generation_gate_state).toBe("review_only");
    expect(quality?.trust_summary?.detail).toMatch(/staff-review only|staff review/i);
    expect(quality?.trust_summary?.next_action_text).toMatch(/staff-only|review/i);
  });

  it("blocks same-day plans that have already gone stale", () => {
    const profile = createStableProfile({
      alerts: [{ id: "alert-1", severity: "high", message: "Client could not be reached", resolved_at: null }],
      careProviders: [{ id: "cp-1", provider_type: "field_staff", display_name: "Ana Novak", is_primary: true }],
    });
    const plan = {
      id: "hp-stale-1",
      language: "en",
      review_status: "reviewed",
      generator_provider: "openai",
      generated_at: new Date("2026-06-18T00:00:00.000Z").toISOString(),
      source_signals_json: [
        { id: "alert-active", label: "Active alert", category: "alert", strength: "high" },
      ],
      goals_json: [{ id: "goal-1", text: "Keep the client reachable today.", source_signal_ids: ["alert-active"] }],
      daily_support_json: [{ id: "daily-1", text: "Call the client and confirm contact status today.", source_signal_ids: ["alert-active"] }],
      monitoring_json: [{ id: "monitor-1", text: "Monitor alert status throughout the day.", source_signal_ids: ["alert-active"] }],
      escalation_json: [{ id: "escalate-1", text: "Escalate the same day if contact still fails.", source_signal_ids: ["alert-active"] }],
      caregiver_guidance_json: [{ id: "caregiver-1", text: "The named owner should keep the care circle updated today.", source_signal_ids: ["alert-active"] }],
    };

    const audit = buildHealthPlanAudit(
      plan,
      profile,
      { latestScore: null, forecastRows: [] },
      { name: "Red Cross Leipzig", defaultLanguage: "en" },
      new Date("2026-06-18T13:30:00.000Z"),
    );

    expect(audit.status).toBe("needs_regeneration");
    expect(audit.reasons.some((reason) => reason.code === "same_day_plan_stale")).toBe(true);
  });

  it("softly lowers trust when a same-day plan is aging even before the hard stale cutoff", () => {
    const profile = createStableProfile({
      alerts: [{ id: "alert-1", severity: "high", message: "Client could not be reached", resolved_at: null }],
      careProviders: [{ id: "cp-1", provider_type: "field_staff", display_name: "Ana Novak", is_primary: true }],
    });
    const plan = {
      id: "hp-freshness-1",
      language: "en",
      review_status: "reviewed",
      generator_provider: "openai",
      generation_confidence: "high",
      generation_assessment_json: {
        confidence: "high",
        readiness: "ready_for_review",
        source_signal_count: 5,
        critical_signal_count: 1,
        care_provider_count: 1,
        live_signal_count: 4,
        predictive_available: false,
        reasons: [],
      },
      generated_at: new Date("2026-06-18T04:30:00.000Z").toISOString(),
      source_signals_json: [
        { id: "alert-active", label: "Active alert", category: "alert", strength: "high", observed_at: "2026-06-18T04:00:00.000Z" },
        { id: "service-checkins", label: "Check-ins", category: "service", strength: "low", observed_at: "2026-06-18T04:15:00.000Z" },
      ],
      automated_review_json: {
        verdict: "pass",
        checked_at: "2026-06-18T04:35:00.000Z",
        summary_text: "The plan is currently usable.",
        grounded_signal_ids: ["alert-active", "service-checkins"],
        strengths: ["Clear same-day plan"],
        concerns: [],
        required_actions: [],
        shareability: "shareable",
        rubric_scores: { grounding: 82, actionability: 84, timeliness: 82, safety: 84, shareability: 82, overall: 83 },
      },
      goals_json: [{ id: "goal-1", text: "Keep the client reachable today.", source_signal_ids: ["alert-active"] }],
      daily_support_json: [{ id: "daily-1", text: "Call the client and confirm contact status today.", source_signal_ids: ["alert-active"] }],
      monitoring_json: [{ id: "monitor-1", text: "Monitor alert status throughout the day.", source_signal_ids: ["alert-active", "service-checkins"] }],
      escalation_json: [{ id: "escalate-1", text: "Escalate the same day if contact still fails and record the first receipt of contact.", source_signal_ids: ["alert-active"] }],
      caregiver_guidance_json: [{ id: "caregiver-1", text: "The named owner should keep the care circle updated today.", source_signal_ids: ["service-checkins"] }],
    };

    const quality = buildHealthPlanQualitySummary(
      plan,
      profile,
      { latestScore: null, forecastRows: [] },
      { name: "Red Cross Leipzig", defaultLanguage: "en" },
      new Date("2026-06-18T13:30:00.000Z"),
    );

    expect(quality.freshness_decay?.status).toBe("aging");
    expect(quality.freshness_decay?.requires_refresh).toBe(true);
    expect(quality.freshness_decay?.refresh_overdue).toBe(true);
    expect(quality.freshness_decay?.refresh_recommended_by_at).toBe("2026-06-18T12:00:00.000Z");
    expect(quality.freshness_decay?.next_status).toBe("stale");
    expect(quality.freshness_decay?.next_status_at).toBe("2026-06-18T16:30:00.000Z");
    expect(quality.recommended_action).toBe("review");
    expect(quality.trust_level).not.toBe("high");
    expect(quality.cautions.some((item) => item.code === "evidence_freshness_aging")).toBe(true);
  });

  it("keeps a recently refreshed plan in a fresh state", () => {
    const profile = createStableProfile();
    const plan = {
      id: "hp-freshness-2",
      language: "en",
      review_status: "reviewed",
      generator_provider: "openai",
      generation_confidence: "high",
      generation_assessment_json: {
        confidence: "high",
        readiness: "ready_for_review",
        source_signal_count: 4,
        critical_signal_count: 0,
        care_provider_count: 1,
        live_signal_count: 4,
        predictive_available: false,
        reasons: [],
      },
      generated_at: new Date("2026-06-18T10:45:00.000Z").toISOString(),
      source_signals_json: [
        { id: "service-checkins", label: "Check-ins", category: "service", strength: "low", observed_at: "2026-06-18T10:30:00.000Z" },
        { id: "service-brain-coach", label: "Brain Coach", category: "service", strength: "low", observed_at: "2026-06-18T10:40:00.000Z" },
      ],
      automated_review_json: {
        verdict: "pass",
        checked_at: "2026-06-18T10:50:00.000Z",
        summary_text: "The plan is grounded and current.",
        grounded_signal_ids: ["service-checkins", "service-brain-coach"],
        strengths: ["Fresh signal picture"],
        concerns: [],
        required_actions: [],
        shareability: "shareable",
        rubric_scores: { grounding: 86, actionability: 84, timeliness: 88, safety: 86, shareability: 84, overall: 86 },
      },
      goals_json: [{ id: "goal-1", text: "Keep routines steady through the next 24 hours.", source_signal_ids: ["service-checkins"] }],
      daily_support_json: [{ id: "daily-1", text: "Use the existing support rhythm today and confirm the named owner for follow-up.", source_signal_ids: ["service-checkins", "service-brain-coach"] }],
      monitoring_json: [{ id: "monitor-1", text: "Monitor routine completion through today.", source_signal_ids: ["service-checkins"] }],
      escalation_json: [{ id: "escalate-1", text: "If routine drops today, the named owner should escalate the same day.", source_signal_ids: ["service-brain-coach"] }],
      caregiver_guidance_json: [{ id: "caregiver-1", text: "The named owner should share calm updates with the care circle.", source_signal_ids: ["service-brain-coach"] }],
    };

    const quality = buildHealthPlanQualitySummary(
      plan,
      profile,
      { latestScore: null, forecastRows: [] },
      { name: "Red Cross Leipzig", defaultLanguage: "en" },
      new Date("2026-06-18T12:00:00.000Z"),
    );

    expect(quality.freshness_decay?.status).toBe("fresh");
    expect(quality.freshness_decay?.requires_refresh).toBe(false);
    expect(quality.freshness_decay?.refresh_recommended_by_at).toBe("2026-06-25T10:30:00.000Z");
    expect(quality.freshness_decay?.refresh_overdue).toBe(false);
    expect(quality.freshness_decay?.next_status).toBe("watch");
    expect(quality.freshness_decay?.next_status_at).toBe("2026-06-19T10:30:00.000Z");
    expect(quality.strengths.some((item) => item.code === "evidence_freshness_current")).toBe(true);
  });

  it("lets slower-moving predictive evidence age more gradually than same-day alert handling", () => {
    const profile = createStableProfile();
    const plan = {
      id: "hp-freshness-risk-3",
      language: "en",
      review_status: "reviewed",
      generator_provider: "openai",
      generation_confidence: "high",
      generation_assessment_json: {
        confidence: "high",
        readiness: "ready_for_review",
        source_signal_count: 1,
        critical_signal_count: 1,
        care_provider_count: 1,
        live_signal_count: 0,
        predictive_available: true,
        reasons: [],
      },
      generated_at: new Date("2026-06-18T09:00:00.000Z").toISOString(),
      source_signals_json: [
        { id: "risk-latest-score", label: "Predictive risk score 82 (high)", category: "risk", strength: "high", observed_at: "2026-06-17T00:00:00.000Z" },
      ],
      goals_json: [{ id: "goal-1", text: "Keep the support routine stable while the elevated risk picture is checked.", source_signal_ids: ["risk-latest-score"] }],
      daily_support_json: [{ id: "daily-1", text: "Use the named owner to review the elevated risk picture today.", source_signal_ids: ["risk-latest-score"] }],
      monitoring_json: [{ id: "monitor-1", text: "Watch the elevated risk picture through today and log any material change.", source_signal_ids: ["risk-latest-score"] }],
      escalation_json: [{ id: "escalate-1", text: "Escalate the same day if the elevated risk picture worsens.", source_signal_ids: ["risk-latest-score"] }],
      caregiver_guidance_json: [{ id: "caregiver-1", text: "Keep updates practical while the risk picture is re-checked today.", source_signal_ids: ["risk-latest-score"] }],
    };

    const quality = buildHealthPlanQualitySummary(
      plan,
      profile,
      { latestScore: { risk_band: "high", composite_score: 82 }, forecastRows: [] },
      { name: "Red Cross Leipzig", defaultLanguage: "en" },
      new Date("2026-06-18T12:00:00.000Z"),
    );

    expect(quality.freshness_decay?.status).toBe("aging");
    expect(quality.freshness_decay?.summary_decay_reason).toBe("signal_age");
    expect(quality.freshness_decay?.recent_signal_count).toBe(1);
    expect(quality.freshness_decay?.stale_signal_count).toBe(0);
  });

  it("marks the plan for regeneration when a current critical signal is not actioned", () => {
    const profile = createStableProfile({
      medicationActivity: { status: "missed" },
    });
    const plan = {
      id: "hp-2",
      language: "en",
      review_status: "reviewed",
      generator_provider: "openai",
      generated_at: new Date("2026-06-18T09:00:00.000Z").toISOString(),
      source_signals_json: [
        { id: "medication-plan", label: "1 medication on file", category: "medication", strength: "high" },
      ],
      goals_json: [{ id: "goal-1", text: "Support medication routines.", source_signal_ids: ["medication-plan"] }],
      daily_support_json: [{ id: "daily-1", text: "Use reminders.", source_signal_ids: ["medication-plan"] }],
      monitoring_json: [{ id: "monitor-1", text: "Monitor hydration.", source_signal_ids: ["service-checkins"] }],
      escalation_json: [{ id: "escalate-1", text: "Escalate for falls.", source_signal_ids: ["service-brain-coach"] }],
      caregiver_guidance_json: [{ id: "caregiver-1", text: "Keep notes brief.", source_signal_ids: ["medication-plan"] }],
    };

    const audit = buildHealthPlanAudit(
      plan,
      profile,
      { latestScore: null, forecastRows: [] },
      { name: "Red Cross Leipzig", defaultLanguage: "en" },
      new Date("2026-06-18T10:00:00.000Z"),
    );

    expect(audit.status).toBe("needs_regeneration");
    expect(audit.unaddressed_current_critical_signal_ids).toContain("medication-plan");
    expect(audit.reasons.some((reason) => reason.code === "critical_signals_not_actioned")).toBe(true);
  });

  it("keeps a reviewed, current, evidence-linked plan in ready state", () => {
    const profile = createStableProfile();
    const plan = {
      id: "hp-3",
      language: "en",
      review_status: "reviewed",
      generator_provider: "openai",
      generated_at: new Date("2026-06-18T11:30:00.000Z").toISOString(),
      source_signals_json: [
        { id: "service-checkins", label: "Check-ins", category: "service", strength: "low" },
        { id: "service-brain-coach", label: "Brain Coach", category: "service", strength: "low" },
      ],
      goals_json: [{ id: "goal-1", text: "Keep routines steady.", source_signal_ids: ["service-checkins"] }],
      daily_support_json: [{ id: "daily-1", text: "Use the existing support rhythm.", source_signal_ids: ["service-checkins"] }],
      monitoring_json: [{ id: "monitor-1", text: "Monitor routine completion.", source_signal_ids: ["service-checkins"] }],
      escalation_json: [{ id: "escalate-1", text: "Escalate if routine drops.", source_signal_ids: ["service-brain-coach"] }],
      caregiver_guidance_json: [{ id: "caregiver-1", text: "Share calm updates.", source_signal_ids: ["service-brain-coach"] }],
    };

    const audit = buildHealthPlanAudit(
      plan,
      profile,
      { latestScore: null, forecastRows: [] },
      { name: "Red Cross Leipzig", defaultLanguage: "en" },
      new Date("2026-06-18T12:00:00.000Z"),
    );

    expect(audit.status).toBe("ready");
    expect(audit.review_required).toBe(false);
    expect(audit.reasons).toHaveLength(0);
  });

  it("flags a plan for hold when same-day action ownership is not explicit", () => {
    const profile = createStableProfile({
      alerts: [{ id: "alert-1", severity: "high", message: "Client could not be reached", resolved_at: null }],
      careProviders: [],
      consent: { caretaker_consent: false, consent_given: false },
      medicationActivity: { status: "missed" },
    });
    const plan = {
      id: "hp-review-1",
      language: "en",
      review_status: "draft",
      generator_provider: "openai",
      generation_confidence: "low",
      generation_assessment_json: {
        confidence: "low",
        readiness: "review_and_enrich",
        source_signal_count: 3,
        critical_signal_count: 3,
        care_provider_count: 0,
        live_signal_count: 2,
        predictive_available: false,
        reasons: [{ code: "no_named_owner", severity: "high", detail: "No owner assigned." }],
      },
      generated_at: new Date("2026-06-18T09:00:00.000Z").toISOString(),
      source_signals_json: [
        { id: "alert-active", label: "Active alert", category: "alert", strength: "high" },
        { id: "medication-plan", label: "Medication", category: "medication", strength: "high" },
      ],
      goals_json: [{ id: "goal-1", text: "Keep support routines stable.", source_signal_ids: ["alert-active"] }],
      daily_support_json: [{ id: "daily-1", text: "Stay calm and supportive.", source_signal_ids: ["alert-active"] }],
      monitoring_json: [{ id: "monitor-1", text: "Watch for changes.", source_signal_ids: ["alert-active"] }],
      escalation_json: [{ id: "escalate-1", text: "Escalate if things worsen.", source_signal_ids: ["alert-active"] }],
      caregiver_guidance_json: [{ id: "caregiver-1", text: "Keep notes practical.", source_signal_ids: ["alert-active"] }],
    };

    const review = buildHealthPlanReviewerAssessment(
      plan,
      profile,
      { latestScore: { risk_band: "high", composite_score: 88 }, forecastRows: [] },
      { name: "Red Cross Leipzig", defaultLanguage: "en" },
      buildHealthPlanAudit(plan, profile, { latestScore: { risk_band: "high", composite_score: 88 }, forecastRows: [] }, { name: "Red Cross Leipzig", defaultLanguage: "en" }, new Date("2026-06-18T12:00:00.000Z")),
    );

    expect(review.status).toBe("hold");
    expect(review.share_ready).toBe(false);
    expect(review.checks.some((item) => item.code === "owner_assignment_missing")).toBe(true);
    expect(review.next_moves.length).toBeGreaterThan(0);
  });

  it("marks a well-grounded plan as ready in the reviewer pass", () => {
    const profile = createStableProfile();
    const plan = {
      id: "hp-review-2",
      language: "en",
      review_status: "reviewed",
      generator_provider: "openai",
      generation_confidence: "high",
      generation_assessment_json: {
        confidence: "high",
        readiness: "ready_for_review",
        source_signal_count: 6,
        critical_signal_count: 0,
        care_provider_count: 1,
        live_signal_count: 5,
        predictive_available: false,
        reasons: [],
      },
      generated_at: new Date("2026-06-18T11:30:00.000Z").toISOString(),
      source_signals_json: [
        { id: "service-checkins", label: "Check-ins", category: "service", strength: "low", observed_at: "2026-06-18T07:45:00.000Z" },
        { id: "service-brain-coach", label: "Brain Coach", category: "service", strength: "low", observed_at: "2026-06-18T07:50:00.000Z" },
      ],
      goals_json: [{ id: "goal-1", text: "Keep routines steady for the next 24 hours.", source_signal_ids: ["service-checkins"] }],
      daily_support_json: [{ id: "daily-1", text: "Use the existing support rhythm today and confirm who is following up.", source_signal_ids: ["service-checkins"] }],
      monitoring_json: [{ id: "monitor-1", text: "Monitor routine completion through today.", source_signal_ids: ["service-checkins"] }],
      escalation_json: [{ id: "escalate-1", text: "If routine completion drops today, the named owner should escalate the same day.", source_signal_ids: ["service-brain-coach"] }],
      caregiver_guidance_json: [{ id: "caregiver-1", text: "The named owner should share calm updates with the care circle.", source_signal_ids: ["service-brain-coach"] }],
    };

    const review = buildHealthPlanReviewerAssessment(
      plan,
      profile,
      { latestScore: null, forecastRows: [] },
      { name: "Red Cross Leipzig", defaultLanguage: "en" },
      buildHealthPlanAudit(plan, profile, { latestScore: null, forecastRows: [] }, { name: "Red Cross Leipzig", defaultLanguage: "en" }, new Date("2026-06-18T12:00:00.000Z")),
    );

    expect(review.status).toBe("ready");
    expect(review.share_ready).toBe(true);
    expect(review.checks.every((item) => item.state === "good")).toBe(true);
  });

  it("pushes the reviewer to reject shallow rewrites when history says the tactic must be different", () => {
    const profile = createStableProfile();
    const plan = {
      id: "hp-review-history-1",
      language: "en",
      review_status: "draft",
      generator_provider: "openai",
      generation_confidence: "high",
      generation_assessment_json: {
        confidence: "high",
        readiness: "ready_for_review",
        source_signal_count: 6,
        critical_signal_count: 0,
        care_provider_count: 1,
        live_signal_count: 4,
        predictive_available: false,
        reasons: [],
      },
      generated_at: new Date("2026-06-18T11:30:00.000Z").toISOString(),
      source_signals_json: [
        { id: "service-checkins", label: "Check-ins", category: "service", strength: "low" },
        { id: "plan-memory-repeated-tactics", label: "Repeated tactics", category: "context", strength: "medium" },
        { id: "plan-memory-reopened", label: "Reopened review", category: "context", strength: "medium" },
      ],
      summary_signal_ids: ["service-checkins", "plan-memory-reopened"],
      summary_text: "Keep routines steady through the next 24 hours while staff keep monitoring the situation.",
      goals_json: [{ id: "goal-1", text: "Keep routines steady through the next 24 hours.", source_signal_ids: ["service-checkins"] }],
      daily_support_json: [{ id: "daily-1", text: "Use the existing support rhythm and confirm the named owner.", source_signal_ids: ["service-checkins"] }],
      monitoring_json: [{ id: "monitor-1", text: "Monitor routine completion through today.", source_signal_ids: ["service-checkins", "plan-memory-repeated-tactics", "plan-memory-reopened"] }],
      escalation_json: [{ id: "escalate-1", text: "If routine drops today, the named owner should escalate the same day.", source_signal_ids: ["service-checkins", "plan-memory-repeated-tactics"] }],
      caregiver_guidance_json: [{ id: "caregiver-1", text: "The named owner should share calm updates with the care circle.", source_signal_ids: ["service-checkins"] }],
      context_snapshot_json: {
        must_cover: [
          {
            code: "differentiate_repeated_tactic",
            description: "If recent plans kept revisiting the same tactic family, the next plan should say what is materially different this time and what receipt will prove progress.",
            required_signal_ids: ["plan-memory-repeated-tactics"],
            required_sections: ["monitoring", "escalation"],
            priority: "medium",
            minimum_section_coverage: 2,
          },
          {
            code: "explain_material_change",
            description: "If the live picture or prior saved plan shifted materially, the next version should say what changed since the last plan and what is different in the response now.",
            required_signal_ids: ["plan-memory-reopened"],
            required_sections: ["summary", "monitoring"],
            priority: "high",
            minimum_section_coverage: 2,
          },
        ],
      },
    };

    const review = buildHealthPlanReviewerAssessment(
      plan,
      profile,
      { latestScore: null, forecastRows: [] },
      { name: "Red Cross Leipzig", defaultLanguage: "en" },
      buildHealthPlanAudit(plan, profile, { latestScore: null, forecastRows: [] }, { name: "Red Cross Leipzig", defaultLanguage: "en" }, new Date("2026-06-18T12:00:00.000Z")),
    );

    expect(review.status).toBe("hold");
    expect(review.checks.some((item) => item.code === "repeated_tactic_not_differentiated")).toBe(true);
    expect(review.checks.some((item) => item.code === "material_change_not_explained")).toBe(true);
    expect(review.next_moves.some((item) => /materially different|what changed|proof|receipt/i.test(item.text))).toBe(true);
  });

  it("clears the history-specific rewrite checks once a regenerated plan explains the change and stronger tactic", () => {
    const profile = createStableProfile();
    const plan = {
      id: "hp-review-history-2",
      language: "en",
      review_status: "reviewed",
      generator_provider: "openai",
      generation_confidence: "high",
      generation_assessment_json: {
        confidence: "high",
        readiness: "ready_for_review",
        source_signal_count: 6,
        critical_signal_count: 0,
        care_provider_count: 1,
        live_signal_count: 4,
        predictive_available: false,
        reasons: [],
      },
      generated_at: new Date("2026-06-18T11:30:00.000Z").toISOString(),
      source_signals_json: [
        { id: "service-checkins", label: "Check-ins", category: "service", strength: "low" },
        { id: "plan-memory-repeated-tactics", label: "Repeated tactics", category: "context", strength: "medium" },
        { id: "plan-memory-reopened", label: "Reopened review", category: "context", strength: "medium" },
      ],
      summary_signal_ids: ["service-checkins", "plan-memory-reopened"],
      summary_text: "What changed since the previous plan is that the team is no longer relying on the old single-route follow-up; today's response uses a materially different, same-day escalation path if the first touchpoint stalls.",
      goals_json: [{ id: "goal-1", text: "Keep routines steady through the next 24 hours.", source_signal_ids: ["service-checkins"] }],
      daily_support_json: [{ id: "daily-1", text: "Use the existing support rhythm today and confirm the named owner for follow-up.", source_signal_ids: ["service-checkins"] }],
      monitoring_json: [{ id: "monitor-1", text: "Monitor routine completion today, record what changed from baseline, and show what is materially different this time if the first verification still fails.", source_signal_ids: ["service-checkins", "plan-memory-repeated-tactics", "plan-memory-reopened"] }],
      escalation_json: [{ id: "escalate-1", text: "If routine drops today, the named owner should escalate the same day through the stronger fallback and record the first receipt or proof that the upgraded route is working.", source_signal_ids: ["service-checkins", "plan-memory-repeated-tactics"] }],
      caregiver_guidance_json: [{ id: "caregiver-1", text: "The named owner should share calm updates with the care circle.", source_signal_ids: ["service-checkins"] }],
      context_snapshot_json: {
        must_cover: [
          {
            code: "differentiate_repeated_tactic",
            description: "If recent plans kept revisiting the same tactic family, the next plan should say what is materially different this time and what receipt will prove progress.",
            required_signal_ids: ["plan-memory-repeated-tactics"],
            required_sections: ["monitoring", "escalation"],
            priority: "medium",
            minimum_section_coverage: 2,
          },
          {
            code: "explain_material_change",
            description: "If the live picture or prior saved plan shifted materially, the next version should say what changed since the last plan and what is different in the response now.",
            required_signal_ids: ["plan-memory-reopened"],
            required_sections: ["summary", "monitoring"],
            priority: "high",
            minimum_section_coverage: 2,
          },
        ],
        plan_memory: {
          has_existing_plan: true,
          current_plan: {
            current_version: 4,
            review_status: "draft",
            reopened_after_review: true,
          },
          repeated_tactic_families: ["verification"],
        },
      },
    };

    const review = buildHealthPlanReviewerAssessment(
      plan,
      profile,
      { latestScore: null, forecastRows: [] },
      { name: "Red Cross Leipzig", defaultLanguage: "en" },
      buildHealthPlanAudit(plan, profile, { latestScore: null, forecastRows: [] }, { name: "Red Cross Leipzig", defaultLanguage: "en" }, new Date("2026-06-18T12:00:00.000Z")),
    );

    expect(review.status).not.toBe("hold");
    expect(review.checks.some((item) => item.code === "repeated_tactic_not_differentiated")).toBe(false);
    expect(review.checks.some((item) => item.code === "material_change_not_explained")).toBe(false);
  });

  it("keeps the reviewer strict when the current execution path still lacks a recorded receipt", () => {
    const profile = createStableProfile({
      alerts: [{ id: "alert-1", severity: "high", message: "Client could not be reached", resolved_at: null }],
    });
    const plan = {
      id: "hp-review-execution-receipt-1",
      language: "en",
      review_status: "draft",
      generator_provider: "openai",
      generation_confidence: "high",
      generation_assessment_json: {
        confidence: "high",
        readiness: "ready_for_review",
        source_signal_count: 5,
        critical_signal_count: 1,
        care_provider_count: 1,
        live_signal_count: 4,
        predictive_available: false,
        reasons: [],
      },
      generated_at: new Date("2026-06-18T11:30:00.000Z").toISOString(),
      source_signals_json: [
        { id: "alert-active", label: "Active alert", category: "alert", strength: "high" },
        { id: "execution-followthrough-open", label: "Follow-through still open", category: "context", strength: "high" },
        { id: "execution-stalled", label: "Execution stalled", category: "context", strength: "high" },
      ],
      summary_signal_ids: ["alert-active"],
      summary_text: "Use a calmer steady plan while staff keep monitoring today's situation.",
      goals_json: [{ id: "goal-1", text: "Keep support routines steady today.", source_signal_ids: ["alert-active"] }],
      daily_support_json: [{ id: "daily-1", text: "Continue outreach today and keep the client supported.", source_signal_ids: ["alert-active"] }],
      monitoring_json: [{ id: "monitor-1", text: "Monitor whether the client can be reached today.", source_signal_ids: ["alert-active", "execution-followthrough-open"] }],
      escalation_json: [{ id: "escalate-1", text: "Escalate the same day if the client still cannot be reached.", source_signal_ids: ["alert-active", "execution-stalled"] }],
      caregiver_guidance_json: [{ id: "caregiver-1", text: "The named owner should keep updates practical.", source_signal_ids: ["alert-active"] }],
      context_snapshot_json: {
        must_cover: [
          {
            code: "close_execution_receipt_gap",
            description: "If the current route still lacks a recorded first-contact receipt, the next plan should name that missing proof and the concrete route that will produce it now.",
            required_signal_ids: ["execution-followthrough-open", "execution-stalled"],
            required_sections: ["monitoring", "escalation"],
            priority: "high",
            minimum_section_coverage: 2,
          },
        ],
      },
    };

    const review = buildHealthPlanReviewerAssessment(
      plan,
      profile,
      { latestScore: { risk_band: "high", composite_score: 82 }, forecastRows: [] },
      { name: "Red Cross Leipzig", defaultLanguage: "en" },
      buildHealthPlanAudit(plan, profile, { latestScore: { risk_band: "high", composite_score: 82 }, forecastRows: [] }, { name: "Red Cross Leipzig", defaultLanguage: "en" }, new Date("2026-06-18T12:00:00.000Z")),
    );

    expect(review.status).toBe("hold");
    expect(review.checks.some((item) => item.code === "execution_receipt_gap_not_closed")).toBe(true);
    expect(review.next_moves.some((item) => /first-contact|follow-through|receipt|route/i.test(item.text))).toBe(true);
  });

  it("creates a time-bound review approval only when the plan is truly ready", () => {
    const profile = createStableProfile();
    const plan = {
      id: "hp-review-approval-1",
      language: "en",
      review_status: "draft",
      generator_provider: "openai",
      generation_confidence: "high",
      generation_assessment_json: {
        confidence: "high",
        readiness: "ready_for_review",
        source_signal_count: 5,
        critical_signal_count: 0,
        care_provider_count: 1,
        live_signal_count: 4,
        predictive_available: false,
        reasons: [],
      },
      source_signals_json: [
        { id: "service-checkins", label: "Check-ins", category: "service", strength: "low", observed_at: "2026-06-18T11:15:00.000Z" },
        { id: "service-brain-coach", label: "Brain Coach", category: "service", strength: "low", observed_at: "2026-06-18T11:20:00.000Z" },
      ],
      generated_at: new Date("2026-06-18T08:00:00.000Z").toISOString(),
      summary_text: "Keep routines steady and make same-day follow-up explicit if the routine drops.",
      goals_json: [{ id: "goal-1", text: "Keep routines steady through the next 24 hours.", source_signal_ids: ["service-checkins"] }],
      daily_support_json: [{ id: "daily-1", text: "Use the existing support rhythm and confirm the named owner.", source_signal_ids: ["service-checkins"] }],
      monitoring_json: [{ id: "monitor-1", text: "Monitor routine completion through today.", source_signal_ids: ["service-checkins"] }],
      escalation_json: [{ id: "escalate-1", text: "If routine drops today, the named owner should escalate the same day.", source_signal_ids: ["service-brain-coach"] }],
      caregiver_guidance_json: [{ id: "caregiver-1", text: "The named owner should share calm updates with the care circle.", source_signal_ids: ["service-brain-coach"] }],
    };

    const approval = buildHealthPlanReviewApproval(
      plan,
      profile,
      { latestScore: null, forecastRows: [] },
      { name: "Red Cross Leipzig", defaultLanguage: "en" },
      new Date("2026-06-18T12:00:00.000Z"),
    );

    expect(approval.allowed).toBe(true);
    expect(approval.valid_until).toBeTruthy();
    expect(approval.attestation?.approved_for_sharing).toBe(true);
    expect(approval.attestation?.open_issue_codes).toHaveLength(0);
  });

  it("refuses review approval when key operational gaps are still open", () => {
    const profile = createStableProfile({
      alerts: [{ id: "alert-1", severity: "high", message: "Client could not be reached", resolved_at: null }],
      careProviders: [],
      consent: { caretaker_consent: false, consent_given: false },
      medicationActivity: { status: "missed" },
    });
    const plan = {
      id: "hp-review-approval-2",
      language: "en",
      review_status: "draft",
      generator_provider: "openai",
      generation_confidence: "low",
      generation_assessment_json: {
        confidence: "low",
        readiness: "review_and_enrich",
        source_signal_count: 3,
        critical_signal_count: 3,
        care_provider_count: 0,
        live_signal_count: 2,
        predictive_available: false,
        reasons: [{ code: "no_named_owner", severity: "high", detail: "No owner assigned." }],
      },
      source_signals_json: [
        { id: "alert-active", label: "Active alert", category: "alert", strength: "high" },
        { id: "medication-plan", label: "Medication", category: "medication", strength: "high" },
      ],
      generated_at: new Date("2026-06-18T08:00:00.000Z").toISOString(),
      summary_text: "Keep the care routine practical.",
      goals_json: [{ id: "goal-1", text: "Keep the client supported.", source_signal_ids: ["alert-active"] }],
      daily_support_json: [{ id: "daily-1", text: "Stay calm and supportive.", source_signal_ids: ["alert-active"] }],
      monitoring_json: [{ id: "monitor-1", text: "Watch for changes.", source_signal_ids: ["alert-active"] }],
      escalation_json: [{ id: "escalate-1", text: "Escalate if things worsen.", source_signal_ids: ["alert-active"] }],
      caregiver_guidance_json: [{ id: "caregiver-1", text: "Keep notes practical.", source_signal_ids: ["alert-active"] }],
    };

    const approval = buildHealthPlanReviewApproval(
      plan,
      profile,
      { latestScore: { risk_band: "high", composite_score: 88 }, forecastRows: [] },
      { name: "Red Cross Leipzig", defaultLanguage: "en" },
      new Date("2026-06-18T12:00:00.000Z"),
    );

    expect(approval.allowed).toBe(false);
    expect(approval.review?.status).not.toBe("ready");
    expect(approval.attestation?.approved_for_sharing).toBe(false);
    expect(approval.attestation?.open_issue_codes?.length).toBeGreaterThan(0);
    expect(approval.audit?.reasons.some((reason) => reason.code === "same_day_owner_required")).toBe(true);
    expect(approval.audit?.reasons.some((reason) => reason.code === "critical_alert_outreach_missing")).toBe(true);
    expect(approval.audit?.reasons.some((reason) => reason.code === "critical_alert_timing_missing")).toBe(true);
  });

  it("builds an explicit approval gate with blocking issues for fragile same-day cases", () => {
    const profile = createStableProfile({
      alerts: [{ id: "alert-1", severity: "high", message: "Client could not be reached", resolved_at: null }],
      careProviders: [],
      consent: { caretaker_consent: false, consent_given: false },
      medicationActivity: { status: "missed" },
      sensors: [{ id: "sensor-1", status: "offline" }],
    });
    const plan = {
      id: "hp-approval-gate-1",
      language: "en",
      review_status: "draft",
      generator_provider: "openai",
      generated_at: new Date("2026-06-18T08:00:00.000Z").toISOString(),
      source_signals_json: [
        { id: "alert-active", label: "Active alert", category: "alert", strength: "high" },
        { id: "medication-plan", label: "Medication", category: "medication", strength: "high" },
        { id: "sensor-status", label: "Sensor status", category: "sensor", strength: "high" },
      ],
      summary_text: "Keep the care routine practical.",
      goals_json: [{ id: "goal-1", text: "Keep the client supported.", source_signal_ids: ["alert-active"] }],
      daily_support_json: [{ id: "daily-1", text: "Stay calm and supportive.", source_signal_ids: ["alert-active"] }],
      monitoring_json: [{ id: "monitor-1", text: "Watch for changes.", source_signal_ids: ["alert-active"] }],
      escalation_json: [{ id: "escalate-1", text: "Escalate if things worsen.", source_signal_ids: ["alert-active"] }],
      caregiver_guidance_json: [{ id: "caregiver-1", text: "Keep notes practical.", source_signal_ids: ["alert-active"] }],
    };

    const gate = buildHealthPlanApprovalGate(
      plan,
      profile,
      { latestScore: { risk_band: "high", composite_score: 88 }, forecastRows: [] },
      { name: "Red Cross Leipzig", defaultLanguage: "en" },
      new Date("2026-06-18T12:00:00.000Z"),
    );

    expect(gate?.state).toBe("blocked");
    expect(gate?.ready_for_approval).toBe(false);
    expect(gate?.must_regenerate).toBe(true);
    expect(gate?.blocking_issue_codes).toEqual(
      expect.arrayContaining([
        "new_critical_signals",
        "critical_signals_not_actioned",
        "same_day_owner_required",
        "critical_alert_outreach_missing",
        "critical_alert_timing_missing",
        "owner_assignment_missing",
        "response_window_unclear",
        "medication_followup_missing",
        "assign_owner",
        "contact_client",
        "review_alerts",
        "verify_medication",
        "respect_sharing_boundary",
        "refresh_plan",
      ]),
    );
  });

  it("records approval-gate details on the saved review attestation", () => {
    const profile = createStableProfile();
    const plan = {
      id: "hp-review-approval-3",
      language: "en",
      review_status: "draft",
      generator_provider: "openai",
      generation_confidence: "high",
      generation_assessment_json: {
        confidence: "high",
        readiness: "ready_for_review",
        source_signal_count: 5,
        critical_signal_count: 0,
        care_provider_count: 1,
        live_signal_count: 4,
        predictive_available: false,
        reasons: [],
      },
      source_signals_json: [
        { id: "service-checkins", label: "Check-ins", category: "service", strength: "low", observed_at: "2026-06-18T07:45:00.000Z" },
        { id: "service-brain-coach", label: "Brain Coach", category: "service", strength: "low", observed_at: "2026-06-18T07:50:00.000Z" },
      ],
      generated_at: new Date("2026-06-18T08:00:00.000Z").toISOString(),
      summary_text: "Keep routines steady and make same-day follow-up explicit if the routine drops.",
      goals_json: [{ id: "goal-1", text: "Keep routines steady through the next 24 hours.", source_signal_ids: ["service-checkins"] }],
      daily_support_json: [{ id: "daily-1", text: "Use the existing support rhythm and confirm the named owner.", source_signal_ids: ["service-checkins"] }],
      monitoring_json: [{ id: "monitor-1", text: "Monitor routine completion through today.", source_signal_ids: ["service-checkins"] }],
      escalation_json: [{ id: "escalate-1", text: "If routine drops today, the named owner should escalate the same day.", source_signal_ids: ["service-brain-coach"] }],
      caregiver_guidance_json: [{ id: "caregiver-1", text: "The named owner should share calm updates with the care circle.", source_signal_ids: ["service-brain-coach"] }],
    };

    const approval = buildHealthPlanReviewApproval(
      plan,
      profile,
      { latestScore: null, forecastRows: [] },
      { name: "Red Cross Leipzig", defaultLanguage: "en" },
      new Date("2026-06-18T12:00:00.000Z"),
    );

    expect(approval.allowed).toBe(true);
    expect(approval.attestation?.approval_gate_state).toBe("ready");
    expect(approval.attestation?.blocking_issue_codes).toEqual([]);
    expect(approval.attestation?.quality_score).toBeGreaterThan(0);
    expect(approval.attestation?.quality_trust_level).toBe("high");
  });

  it("blocks critical-alert plans that never state outreach or same-day timing", () => {
    const profile = createStableProfile({
      alerts: [{ id: "alert-1", severity: "critical", message: "Fall alert unresolved", resolved_at: null }],
      careProviders: [{ id: "cp-1", provider_type: "field_staff", display_name: "Ana Novak", is_primary: true }],
    });
    const plan = {
      id: "hp-critical-alert-1",
      language: "en",
      review_status: "reviewed",
      generator_provider: "openai",
      generated_at: new Date("2026-06-18T09:00:00.000Z").toISOString(),
      source_signals_json: [
        { id: "alert-active", label: "Active alert", category: "alert", strength: "high" },
      ],
      goals_json: [{ id: "goal-1", text: "Keep the client supported.", source_signal_ids: ["alert-active"] }],
      daily_support_json: [{ id: "daily-1", text: "Stay calm and supportive.", source_signal_ids: ["alert-active"] }],
      monitoring_json: [{ id: "monitor-1", text: "Watch for changes.", source_signal_ids: ["alert-active"] }],
      escalation_json: [{ id: "escalate-1", text: "Escalate if things worsen.", source_signal_ids: ["alert-active"] }],
      caregiver_guidance_json: [{ id: "caregiver-1", text: "Keep updates practical.", source_signal_ids: ["alert-active"] }],
    };

    const audit = buildHealthPlanAudit(
      plan,
      profile,
      { latestScore: null, forecastRows: [] },
      { name: "Red Cross Leipzig", defaultLanguage: "en" },
      new Date("2026-06-18T10:00:00.000Z"),
    );

    expect(audit.status).toBe("needs_regeneration");
    expect(audit.reasons.some((reason) => reason.code === "critical_alert_outreach_missing")).toBe(true);
    expect(audit.reasons.some((reason) => reason.code === "critical_alert_timing_missing")).toBe(true);
  });

  it("treats a blocking automated reviewer verdict as an audit failure", () => {
    const profile = createStableProfile();
    const plan = {
      id: "hp-auto-review-2",
      language: "en",
      review_status: "draft",
      generator_provider: "openai",
      generated_at: new Date("2026-06-18T08:00:00.000Z").toISOString(),
      automated_review_json: {
        verdict: "block",
        checked_at: new Date("2026-06-18T08:05:00.000Z").toISOString(),
        summary_text: "Automated reviewer found a blocking safety gap.",
        grounded_signal_ids: ["service-checkins"],
        strengths: [],
        concerns: [{ code: "critical_gap", severity: "high", detail: "Missing escalation specificity." }],
        required_actions: ["Add explicit escalation steps."],
        shareability: "staff_only",
      },
      source_signals_json: [
        { id: "service-checkins", label: "Check-ins", category: "service", strength: "low" },
      ],
      goals_json: [{ id: "goal-1", text: "Keep routines steady.", source_signal_ids: ["service-checkins"] }],
      daily_support_json: [{ id: "daily-1", text: "Use the support rhythm.", source_signal_ids: ["service-checkins"] }],
      monitoring_json: [{ id: "monitor-1", text: "Monitor routine completion.", source_signal_ids: ["service-checkins"] }],
      escalation_json: [{ id: "escalate-1", text: "Escalate if routine drops.", source_signal_ids: ["service-checkins"] }],
      caregiver_guidance_json: [{ id: "caregiver-1", text: "Share calm updates.", source_signal_ids: ["service-checkins"] }],
    };

    const audit = buildHealthPlanAudit(
      plan,
      profile,
      { latestScore: null, forecastRows: [] },
      { name: "Red Cross Leipzig", defaultLanguage: "en" },
      new Date("2026-06-18T10:00:00.000Z"),
    );

    expect(audit.status).toBe("needs_regeneration");
    expect(audit.reasons.some((reason) => reason.code === "automated_review_blocked")).toBe(true);
  });

  it("requires explicit operator confirmations before review approval can be submitted", () => {
    expect(
      reviewAttestationHasRequiredConfirmations({
        operator_confirmation_codes: ["summary", "timing", "escalation", "sharing_boundary"],
      }),
    ).toBe(true);

    expect(
      reviewAttestationHasRequiredConfirmations({
        operator_confirmation_codes: ["summary", "timing", "escalation"],
      }),
    ).toBe(false);
  });

  it("reopens a reviewed plan when a material edit changes the saved guidance", () => {
    const existing = {
      id: "hp-edit-1",
      language: "en",
      review_status: "reviewed",
      summary_text: "Keep routines steady through the next 24 hours.",
      goals_json: [{ id: "goal-1", text: "Keep routines stable.", source_signal_ids: ["service-checkins"] }],
      daily_support_json: [{ id: "daily-1", text: "Use the existing support rhythm.", source_signal_ids: ["service-checkins"] }],
      monitoring_json: [{ id: "monitor-1", text: "Monitor routine completion.", source_signal_ids: ["service-checkins"] }],
      escalation_json: [{ id: "escalate-1", text: "Escalate the same day if routine drops.", source_signal_ids: ["service-brain-coach"] }],
      caregiver_guidance_json: [{ id: "caregiver-1", text: "Share calm updates with the care circle.", source_signal_ids: ["service-brain-coach"] }],
    };
    const patch = {
      daily_support_json: [{ id: "daily-1", text: "Call before noon and confirm the named owner.", source_signal_ids: ["service-checkins"] }],
    };

    expect(hasMaterialHealthPlanEdits(existing, patch)).toBe(true);

    const resolved = resolveHealthPlanReviewWriteState(existing, patch);

    expect(resolved.requestedReviewStatus).toBe("draft");
    expect(resolved.preserveReviewedMetadata).toBe(false);
    expect(resolved.reopenedForReview).toBe(true);
  });

  it("preserves reviewed status when the incoming edit does not change the reviewed content", () => {
    const existing = {
      id: "hp-edit-2",
      language: "en",
      review_status: "reviewed",
      summary_text: "Keep routines steady through the next 24 hours.",
      goals_json: [{ id: "goal-1", text: "Keep routines stable.", source_signal_ids: ["service-checkins"] }],
      daily_support_json: [{ id: "daily-1", text: "Use the existing support rhythm.", source_signal_ids: ["service-checkins"] }],
      monitoring_json: [{ id: "monitor-1", text: "Monitor routine completion.", source_signal_ids: ["service-checkins"] }],
      escalation_json: [{ id: "escalate-1", text: "Escalate the same day if routine drops.", source_signal_ids: ["service-brain-coach"] }],
      caregiver_guidance_json: [{ id: "caregiver-1", text: "Share calm updates with the care circle.", source_signal_ids: ["service-brain-coach"] }],
    };
    const patch = {
      summary_text: "Keep routines steady through the next 24 hours.",
    };

    expect(hasMaterialHealthPlanEdits(existing, patch)).toBe(false);

    const resolved = resolveHealthPlanReviewWriteState(existing, patch);

    expect(resolved.requestedReviewStatus).toBe("reviewed");
    expect(resolved.preserveReviewedMetadata).toBe(true);
    expect(resolved.reopenedForReview).toBe(false);
  });

  it("builds the patched draft view used to detect review drift", () => {
    const existing = {
      id: "hp-edit-3",
      language: "en",
      review_status: "reviewed",
      summary_text: "Keep routines steady through the next 24 hours.",
      goals_json: [{ id: "goal-1", text: "Keep routines stable.", source_signal_ids: ["service-checkins"] }],
      daily_support_json: [{ id: "daily-1", text: "Use the existing support rhythm.", source_signal_ids: ["service-checkins"] }],
      monitoring_json: [{ id: "monitor-1", text: "Monitor routine completion.", source_signal_ids: ["service-checkins"] }],
      escalation_json: [{ id: "escalate-1", text: "Escalate the same day if routine drops.", source_signal_ids: ["service-brain-coach"] }],
      caregiver_guidance_json: [{ id: "caregiver-1", text: "Share calm updates with the care circle.", source_signal_ids: ["service-brain-coach"] }],
    };

    const patched = buildPatchedHealthPlanDraft(existing, {
      language: "es",
      summary_text: "Mantener las rutinas estables durante las proximas 24 horas.",
    });

    expect(patched.language).toBe("es");
    expect(patched.summary_text).toContain("proximas 24 horas");
    expect(patched.daily_support_json).toEqual(existing.daily_support_json);
  });

  it("expires old review approval windows so the plan gets re-checked", () => {
    const profile = createStableProfile();
    const plan = {
      id: "hp-review-expired-1",
      language: "en",
      review_status: "reviewed",
      generator_provider: "openai",
      generation_confidence: "high",
      generation_assessment_json: {
        confidence: "high",
        readiness: "ready_for_review",
        source_signal_count: 5,
        critical_signal_count: 0,
        care_provider_count: 1,
        live_signal_count: 4,
        predictive_available: false,
        reasons: [],
      },
      generated_at: new Date("2026-06-18T08:00:00.000Z").toISOString(),
      review_valid_until: new Date("2026-06-18T18:00:00.000Z").toISOString(),
      source_signals_json: [
        { id: "service-checkins", label: "Check-ins", category: "service", strength: "low", observed_at: "2026-06-18T11:15:00.000Z" },
        { id: "service-brain-coach", label: "Brain Coach", category: "service", strength: "low", observed_at: "2026-06-18T11:20:00.000Z" },
      ],
      goals_json: [{ id: "goal-1", text: "Keep routines steady through the next 24 hours.", source_signal_ids: ["service-checkins"] }],
      daily_support_json: [{ id: "daily-1", text: "Use the existing support rhythm and confirm the named owner.", source_signal_ids: ["service-checkins"] }],
      monitoring_json: [{ id: "monitor-1", text: "Monitor routine completion through today.", source_signal_ids: ["service-checkins"] }],
      escalation_json: [{ id: "escalate-1", text: "If routine drops today, the named owner should escalate the same day.", source_signal_ids: ["service-brain-coach"] }],
      caregiver_guidance_json: [{ id: "caregiver-1", text: "The named owner should share calm updates with the care circle.", source_signal_ids: ["service-brain-coach"] }],
    };

    const audit = buildHealthPlanAudit(
      plan,
      profile,
      { latestScore: null, forecastRows: [] },
      { name: "Red Cross Leipzig", defaultLanguage: "en" },
      new Date("2026-06-19T12:00:00.000Z"),
    );
    const quality = buildHealthPlanQualitySummary(
      plan,
      profile,
      { latestScore: null, forecastRows: [] },
      { name: "Red Cross Leipzig", defaultLanguage: "en" },
      new Date("2026-06-19T12:00:00.000Z"),
    );

    expect(audit.status).toBe("needs_review");
    expect(audit.review_valid_until).toBe(plan.review_valid_until);
    expect(audit.reasons.some((reason) => reason.code === "review_attestation_expired")).toBe(true);
    expect(quality.cautions.some((item) => item.code === "review_attestation_expired")).toBe(true);
  });

  it("scores a reviewed and grounded plan as high trust", () => {
    const profile = createStableProfile();
    const plan = {
      id: "hp-4",
      language: "en",
      review_status: "reviewed",
      generator_provider: "openai",
      generation_confidence: "high",
      generation_assessment_json: {
        confidence: "high",
        readiness: "ready_for_review",
        source_signal_count: 5,
        critical_signal_count: 0,
        care_provider_count: 1,
        live_signal_count: 4,
        predictive_available: false,
        predictive_confidence: null,
        reasons: [],
      },
      generated_at: new Date("2026-06-18T11:30:00.000Z").toISOString(),
      source_signals_json: [
        { id: "service-checkins", label: "Check-ins", category: "service", strength: "low", observed_at: "2026-06-18T11:15:00.000Z" },
        { id: "service-brain-coach", label: "Brain Coach", category: "service", strength: "low", observed_at: "2026-06-18T11:20:00.000Z" },
      ],
      goals_json: [{ id: "goal-1", text: "Keep routines steady through the next 24 hours.", source_signal_ids: ["service-checkins"] }],
      daily_support_json: [{ id: "daily-1", text: "Use the existing support rhythm today and confirm the named owner for follow-up.", source_signal_ids: ["service-checkins", "service-brain-coach"] }],
      monitoring_json: [{ id: "monitor-1", text: "Monitor routine completion through today.", source_signal_ids: ["service-checkins"] }],
      escalation_json: [{ id: "escalate-1", text: "If routine drops today, the named owner should escalate the same day.", source_signal_ids: ["service-brain-coach"] }],
      caregiver_guidance_json: [{ id: "caregiver-1", text: "The named owner should share calm updates with the care circle.", source_signal_ids: ["service-brain-coach"] }],
    };

    const quality = buildHealthPlanQualitySummary(
      plan,
      profile,
      { latestScore: null, forecastRows: [] },
      { name: "Red Cross Leipzig", defaultLanguage: "en" },
      new Date("2026-06-18T12:00:00.000Z"),
    );

    expect(quality.trust_level).toBe("high");
    expect(quality.recommended_action).toBe("share");
    expect(quality.score).toBeGreaterThanOrEqual(80);
    expect(quality.strengths.some((item) => item.code === "reviewed_by_staff")).toBe(true);
    expect(quality.generation_confidence).toBe("high");
  });

  it("tracks when a new plan is genuinely better than the previous saved version", () => {
    const profile = createStableProfile();
    const plan = {
      id: "hp-improvement-1",
      language: "en",
      review_status: "reviewed",
      generator_provider: "openai",
      generation_confidence: "high",
      generation_assessment_json: {
        confidence: "high",
        readiness: "ready_for_review",
        source_signal_count: 5,
        critical_signal_count: 0,
        care_provider_count: 1,
        live_signal_count: 4,
        predictive_available: false,
        reasons: [],
      },
      generated_at: new Date("2026-06-18T11:30:00.000Z").toISOString(),
      automated_review_json: {
        verdict: "pass",
        checked_at: new Date("2026-06-18T11:35:00.000Z").toISOString(),
        summary_text: "The plan is grounded and actionable.",
        grounded_signal_ids: ["service-checkins", "service-brain-coach"],
        strengths: ["Clear owner and timing"],
        concerns: [],
        required_actions: [],
        shareability: "shareable",
        rubric_scores: {
          grounding: 84,
          actionability: 88,
          timeliness: 82,
          safety: 86,
          shareability: 85,
          overall: 86,
        },
      },
      context_snapshot_json: {
        plan_memory: {
          has_existing_plan: true,
          current_plan: {
            current_version: 4,
            review_status: "reviewed",
            quality_score: 52,
            quality_trust_level: "low",
            review_rubric_scores: { overall: 48 },
            open_issue_codes: ["response_window_unclear", "owner_assignment_missing"],
            watch_issue_codes: ["operational_review_pending"],
          },
        },
      },
      source_signals_json: [
        { id: "service-checkins", label: "Check-ins", category: "service", strength: "low", observed_at: "2026-06-18T11:10:00.000Z" },
        { id: "service-brain-coach", label: "Brain Coach", category: "service", strength: "low", observed_at: "2026-06-18T11:20:00.000Z" },
      ],
      goals_json: [{ id: "goal-1", text: "Keep routines steady through the next 24 hours.", source_signal_ids: ["service-checkins"] }],
      daily_support_json: [{ id: "daily-1", text: "Use the existing support rhythm today and confirm the named owner for follow-up.", source_signal_ids: ["service-checkins", "service-brain-coach"] }],
      monitoring_json: [{ id: "monitor-1", text: "Monitor routine completion through today.", source_signal_ids: ["service-checkins"] }],
      escalation_json: [{ id: "escalate-1", text: "If routine drops today, the named owner should escalate the same day and record the first receipt of contact.", source_signal_ids: ["service-brain-coach"] }],
      caregiver_guidance_json: [{ id: "caregiver-1", text: "The named owner should share calm updates with the care circle.", source_signal_ids: ["service-brain-coach"] }],
    };

    const quality = buildHealthPlanQualitySummary(
      plan,
      profile,
      { latestScore: null, forecastRows: [] },
      { name: "Red Cross Leipzig", defaultLanguage: "en" },
      new Date("2026-06-18T12:00:00.000Z"),
    );

    expect(quality.improvement_summary?.status).toBe("improved");
    expect(quality.improvement_summary?.trust_level_delta).toBe("up");
    expect(quality.improvement_summary?.resolved_issue_codes).toEqual(
      expect.arrayContaining(["response_window_unclear", "owner_assignment_missing"]),
    );
    expect(quality.strengths.some((item) => item.code === "version_improved")).toBe(true);
  });

  it("flags when a new plan is weaker than the previous saved version", () => {
    const profile = createStableProfile({
      alerts: [{ id: "alert-1", severity: "high", message: "Client could not be reached", resolved_at: null }],
      careProviders: [],
      consent: { caretaker_consent: false, consent_given: false },
      medicationActivity: { status: "missed" },
    });
    const plan = {
      id: "hp-improvement-2",
      language: "en",
      review_status: "draft",
      generator_provider: "openai",
      generation_confidence: "low",
      generation_assessment_json: {
        confidence: "low",
        readiness: "review_and_enrich",
        source_signal_count: 3,
        critical_signal_count: 3,
        care_provider_count: 0,
        live_signal_count: 2,
        predictive_available: false,
        reasons: [{ code: "no_named_owner", severity: "high", detail: "No owner assigned." }],
      },
      generated_at: new Date("2026-06-18T11:30:00.000Z").toISOString(),
      automated_review_json: {
        verdict: "revise",
        checked_at: new Date("2026-06-18T11:35:00.000Z").toISOString(),
        summary_text: "The plan is still too vague and risky.",
        grounded_signal_ids: ["alert-active"],
        strengths: [],
        concerns: [{ code: "plan_actionability_weak", severity: "high", detail: "Urgent steps are still too vague." }],
        required_actions: ["Name the owner and the first receipt of contact."],
        shareability: "staff_only",
        rubric_scores: {
          grounding: 50,
          actionability: 34,
          timeliness: 40,
          safety: 42,
          shareability: 46,
          overall: 39,
        },
      },
      context_snapshot_json: {
        plan_memory: {
          has_existing_plan: true,
          current_plan: {
            current_version: 4,
            review_status: "reviewed",
            quality_score: 84,
            quality_trust_level: "high",
            review_rubric_scores: { overall: 82 },
            open_issue_codes: [],
            watch_issue_codes: [],
          },
        },
      },
      source_signals_json: [
        { id: "alert-active", label: "Active alert", category: "alert", strength: "high" },
      ],
      goals_json: [{ id: "goal-1", text: "Keep the client supported.", source_signal_ids: ["alert-active"] }],
      daily_support_json: [{ id: "daily-1", text: "Stay calm and supportive.", source_signal_ids: ["alert-active"] }],
      monitoring_json: [{ id: "monitor-1", text: "Watch for changes.", source_signal_ids: ["alert-active"] }],
      escalation_json: [{ id: "escalate-1", text: "Escalate if things worsen.", source_signal_ids: ["alert-active"] }],
      caregiver_guidance_json: [{ id: "caregiver-1", text: "Keep notes practical.", source_signal_ids: ["alert-active"] }],
    };

    const quality = buildHealthPlanQualitySummary(
      plan,
      profile,
      { latestScore: { risk_band: "high", composite_score: 88 }, forecastRows: [] },
      { name: "Red Cross Leipzig", defaultLanguage: "en" },
      new Date("2026-06-18T12:00:00.000Z"),
    );

    expect(quality.improvement_summary?.status).toBe("regressed");
    expect(quality.improvement_summary?.trust_level_delta).toBe("down");
    expect(quality.improvement_summary?.new_issue_codes.length).toBeGreaterThan(0);
    expect(quality.cautions.some((item) => item.code === "version_regressed")).toBe(true);
  });

  it("captures recommendation-level strengthening between plan versions", () => {
    const profile = createStableProfile();
    const plan = {
      id: "hp-improvement-recommendation-1",
      language: "en",
      review_status: "reviewed",
      generator_provider: "openai",
      generation_confidence: "high",
      generation_assessment_json: {
        confidence: "high",
        readiness: "ready",
        source_signal_count: 2,
        critical_signal_count: 0,
        care_provider_count: 1,
        live_signal_count: 2,
        predictive_available: false,
        reasons: [],
      },
      generated_at: new Date("2026-06-18T11:30:00.000Z").toISOString(),
      automated_review_json: {
        verdict: "pass",
        checked_at: new Date("2026-06-18T11:35:00.000Z").toISOString(),
        summary_text: "The plan is grounded and actionable.",
        grounded_signal_ids: ["service-checkins", "service-brain-coach"],
        strengths: ["Grounded service routine guidance."],
        concerns: [],
        required_actions: [],
        shareability: "shareable",
        rubric_scores: {
          grounding: 82,
          actionability: 80,
          timeliness: 78,
          safety: 82,
          shareability: 80,
          overall: 80,
        },
      },
      review_attestation_json: {
        quality_score: 82,
        quality_trust_level: "high",
        approval_gate_state: "ready",
      },
      context_snapshot_json: {
        plan_memory: {
          has_existing_plan: true,
          current_plan: {
            current_version: 4,
            review_status: "reviewed",
            quality_score: 70,
            quality_trust_level: "medium",
            review_rubric_scores: { overall: 68 },
            open_issue_codes: [],
            watch_issue_codes: [],
            recommendation_snapshot: [
              {
                comparison_key: "task:daily_support:stabilize-routine",
                section: "daily_support",
                text: "Keep the routine steady.",
                source_task_code: "stabilize-routine",
                source_signal_ids: ["service-checkins", "service-brain-coach"],
                recommendation_provenance_strength: "caution",
                recommendation_provenance_score: 42,
                evidence_review_state: "verify_first",
              },
            ],
          },
        },
      },
      source_signals_json: [
        { id: "service-checkins", label: "Check-ins completed", category: "service", strength: "medium", freshness: "live", usefulness_reason_codes: ["historically_effective_pattern"] },
        { id: "service-brain-coach", label: "Brain Coach completed", category: "service", strength: "medium", freshness: "live", usefulness_reason_codes: ["family_outcomes_recently_helping"] },
      ],
      goals_json: [{ id: "goal-1", text: "Keep the support rhythm stable through today.", source_signal_ids: ["service-checkins"] }],
      daily_support_json: [{
        id: "daily-1",
        text: "Keep the check-in and Brain Coach routine steady today because that service pattern is still landing.",
        source_signal_ids: ["service-checkins", "service-brain-coach"],
        source_task_code: "stabilize-routine",
      }],
      monitoring_json: [{ id: "monitor-1", text: "Monitor routine completion through today.", source_signal_ids: ["service-checkins"] }],
      escalation_json: [{ id: "escalate-1", text: "Escalate the same day if the routine breaks and record the first receipt of contact.", source_signal_ids: ["service-brain-coach"] }],
      caregiver_guidance_json: [{ id: "caregiver-1", text: "Share calm progress updates with the care circle.", source_signal_ids: ["service-brain-coach"] }],
    };

    const quality = buildHealthPlanQualitySummary(
      plan,
      profile,
      { latestScore: null, forecastRows: [] },
      { name: "Red Cross Leipzig", defaultLanguage: "en" },
      new Date("2026-06-18T12:00:00.000Z"),
    );

    expect(quality.improvement_summary?.strengthened_recommendation_count).toBeGreaterThan(0);
    expect(quality.improvement_summary?.strengthened_recommendations?.[0]?.detail).toMatch(/service pattern|routine/i);
  });

  it("surfaces recommendation-level risk regression in regeneration focus", () => {
    const profile = createStableProfile({
      alerts: [{ id: "alert-1", severity: "high", message: "Client could not be reached", resolved_at: null }],
      careProviders: [],
      consent: { caretaker_consent: false, consent_given: false },
    });
    const plan = {
      id: "hp-improvement-recommendation-2",
      language: "en",
      review_status: "draft",
      generator_provider: "openai",
      generation_confidence: "medium",
      generation_assessment_json: {
        confidence: "medium",
        readiness: "review_and_enrich",
        source_signal_count: 1,
        critical_signal_count: 1,
        care_provider_count: 0,
        live_signal_count: 1,
        predictive_available: false,
        reasons: [],
      },
      generated_at: new Date("2026-06-18T11:30:00.000Z").toISOString(),
      automated_review_json: {
        verdict: "revise",
        checked_at: new Date("2026-06-18T11:35:00.000Z").toISOString(),
        summary_text: "The plan still needs tighter follow-through.",
        grounded_signal_ids: ["alert-active"],
        strengths: [],
        concerns: [{ code: "plan_actionability_weak", severity: "high", detail: "Urgent follow-up is still too vague." }],
        required_actions: ["Tighten the urgent follow-up route."],
        shareability: "staff_only",
        rubric_scores: {
          grounding: 64,
          actionability: 52,
          timeliness: 60,
          safety: 66,
          shareability: 68,
          overall: 60,
        },
      },
      context_snapshot_json: {
        plan_memory: {
          has_existing_plan: true,
          current_plan: {
            current_version: 4,
            review_status: "reviewed",
            quality_score: 76,
            quality_trust_level: "medium",
            review_rubric_scores: { overall: 74 },
            open_issue_codes: [],
            watch_issue_codes: [],
            recommendation_snapshot: [
              {
                comparison_key: "task:monitoring:confirm-contact",
                section: "monitoring",
                text: "Confirm contact status with the client.",
                source_task_code: "confirm-contact",
                source_signal_ids: ["alert-active"],
                recommendation_provenance_strength: "moderate",
                recommendation_provenance_score: 68,
                evidence_review_state: "ready",
              },
            ],
          },
        },
      },
      source_signals_json: [
        { id: "alert-active", label: "Active alert", category: "alert", strength: "high", freshness: "live" },
      ],
      summary_text: "Keep the client supported while the live picture is reviewed.",
      goals_json: [{ id: "goal-1", text: "Keep the client supported.", source_signal_ids: ["alert-active"] }],
      daily_support_json: [{ id: "daily-1", text: "Stay calm and supportive.", source_signal_ids: ["alert-active"] }],
      monitoring_json: [{
        id: "monitor-1",
        text: "Review whether contact still needs confirmation.",
        source_signal_ids: ["alert-active"],
        source_task_code: "confirm-contact",
      }],
      escalation_json: [{ id: "escalate-1", text: "Escalate if things worsen.", source_signal_ids: ["alert-active"] }],
      caregiver_guidance_json: [{ id: "caregiver-1", text: "Keep notes practical.", source_signal_ids: ["alert-active"] }],
    };

    const quality = buildHealthPlanQualitySummary(
      plan,
      profile,
      { latestScore: { risk_band: "high", composite_score: 88 }, forecastRows: [] },
      { name: "Red Cross Leipzig", defaultLanguage: "en" },
      new Date("2026-06-18T12:00:00.000Z"),
    );
    const focus = buildHealthPlanRegenerationFocus(
      plan,
      profile,
      { latestScore: { risk_band: "high", composite_score: 88 }, forecastRows: [] },
      { name: "Red Cross Leipzig", defaultLanguage: "en" },
      new Date("2026-06-19T12:00:00.000Z"),
      null,
      null,
      quality,
    );

    expect(quality.improvement_summary?.riskier_recommendation_count).toBeGreaterThan(0);
    expect(
      focus?.focus_items?.some((item) => /became riskier/i.test(String(item.detail || ""))),
    ).toBe(true);
  });

  it("downgrades an over-optimistic automated review when the new version is weaker than the previous saved plan", () => {
    const profile = createStableProfile({
      alerts: [{ id: "alert-1", severity: "high", message: "Client could not be reached", resolved_at: null }],
      careProviders: [],
      consent: { caretaker_consent: false, consent_given: false },
      medicationActivity: { status: "missed" },
    });
    const candidatePlan = {
      id: "hp-review-guardrail-1",
      language: "en",
      review_status: "draft",
      generator_provider: "openai",
      generation_confidence: "low",
      generation_assessment_json: {
        confidence: "low",
        readiness: "review_and_enrich",
        source_signal_count: 3,
        critical_signal_count: 3,
        care_provider_count: 0,
        live_signal_count: 2,
        predictive_available: false,
        reasons: [{ code: "no_named_owner", severity: "high", detail: "No owner assigned." }],
      },
      generated_at: new Date("2026-06-18T11:30:00.000Z").toISOString(),
      context_snapshot_json: {
        change_context: {
          highlight_signal_ids: ["alert-active"],
        },
        plan_memory: {
          has_existing_plan: true,
          current_plan: {
            current_version: 4,
            review_status: "reviewed",
            quality_score: 84,
            quality_trust_level: "high",
            review_rubric_scores: { overall: 82 },
            open_issue_codes: [],
            watch_issue_codes: [],
          },
        },
      },
      source_signals_json: [
        { id: "alert-active", label: "Active alert", category: "alert", strength: "high" },
      ],
      summary_text: "Keep the client supported while the team reviews the case.",
      goals_json: [{ id: "goal-1", text: "Keep the client supported.", source_signal_ids: ["alert-active"] }],
      daily_support_json: [{ id: "daily-1", text: "Stay calm and supportive.", source_signal_ids: ["alert-active"] }],
      monitoring_json: [{ id: "monitor-1", text: "Watch for changes.", source_signal_ids: ["alert-active"] }],
      escalation_json: [{ id: "escalate-1", text: "Escalate if things worsen.", source_signal_ids: ["alert-active"] }],
      caregiver_guidance_json: [{ id: "caregiver-1", text: "Keep notes practical.", source_signal_ids: ["alert-active"] }],
    };
    const sourceSignals = candidatePlan.source_signals_json;
    const audit = buildHealthPlanAudit(
      candidatePlan,
      profile,
      { latestScore: { risk_band: "high", composite_score: 88 }, forecastRows: [] },
      { name: "Red Cross Leipzig", defaultLanguage: "en" },
      new Date("2026-06-18T12:00:00.000Z"),
    );
    const review = buildHealthPlanReviewerAssessment(
      candidatePlan,
      profile,
      { latestScore: { risk_band: "high", composite_score: 88 }, forecastRows: [] },
      { name: "Red Cross Leipzig", defaultLanguage: "en" },
      audit,
    );
    const quality = buildHealthPlanQualitySummary(
      candidatePlan,
      profile,
      { latestScore: { risk_band: "high", composite_score: 88 }, forecastRows: [] },
      { name: "Red Cross Leipzig", defaultLanguage: "en" },
      new Date("2026-06-18T12:00:00.000Z"),
      audit,
      review,
    );

    const guardedReview = applyHealthPlanAutomatedReviewGuardrails({
      verdict: "pass",
      checked_at: new Date("2026-06-18T12:01:00.000Z").toISOString(),
      summary_text: "Automated reviewer found the plan grounded and ready for staff use.",
      grounded_signal_ids: ["alert-active"],
      strengths: ["The plan is grounded."],
      concerns: [],
      required_actions: [],
      shareability: "shareable",
      rubric_scores: {
        grounding: 82,
        actionability: 80,
        timeliness: 78,
        safety: 80,
        shareability: 82,
        overall: 81,
      },
    }, sourceSignals, {
      plan: candidatePlan,
      audit,
      reviewAssessment: review,
      quality,
    });

    expect(quality.improvement_summary?.status).toBe("regressed");
    expect(guardedReview.verdict).toBe("block");
    expect(guardedReview.shareability).toBe("staff_only");
    expect(guardedReview.concerns.some((item) => item.code === "version-regressed")).toBe(true);
    expect(guardedReview.required_actions.some((item) => /previous saved plan/i.test(item))).toBe(true);
    expect(guardedReview.summary_text).toMatch(/weaker than the previous saved plan|blocking/i);
  });

  it("scores a draft plan with open critical gaps as low trust", () => {
    const profile = createStableProfile({
      alerts: [{ id: "alert-1", severity: "high", message: "Client could not be reached", resolved_at: null }],
      careProviders: [],
      consent: { caretaker_consent: false, consent_given: false },
    });
    const plan = {
      id: "hp-5",
      language: "en",
      review_status: "draft",
      generator_provider: "fallback",
      generation_confidence: "low",
      generation_assessment_json: {
        confidence: "low",
        readiness: "review_and_enrich",
        source_signal_count: 2,
        critical_signal_count: 2,
        care_provider_count: 0,
        live_signal_count: 1,
        predictive_available: true,
        predictive_confidence: 0.41,
        reasons: [
          { code: "thin_signal_snapshot", severity: "high", detail: "Thin live picture." },
          { code: "no_named_owner", severity: "high", detail: "No named owner." },
        ],
      },
      generated_at: new Date("2026-06-17T07:00:00.000Z").toISOString(),
      source_signals_json: [
        { id: "service-checkins", label: "Check-ins", category: "service", strength: "low" },
      ],
      goals_json: [{ id: "goal-1", text: "Keep routines steady.", source_signal_ids: ["service-checkins"] }],
      daily_support_json: [{ id: "daily-1", text: "Call every morning.", source_signal_ids: ["service-checkins"] }],
      monitoring_json: [{ id: "monitor-1", text: "Watch response quality.", source_signal_ids: ["service-checkins"] }],
      escalation_json: [{ id: "escalate-1", text: "Escalate if routine drops.", source_signal_ids: ["service-checkins"] }],
      caregiver_guidance_json: [{ id: "caregiver-1", text: "Keep notes brief.", source_signal_ids: ["service-checkins"] }],
    };

    const quality = buildHealthPlanQualitySummary(
      plan,
      profile,
      { latestScore: { risk_band: "high", composite_score: 88 }, forecastRows: [] },
      { name: "Red Cross Leipzig", defaultLanguage: "en" },
      new Date("2026-06-18T12:00:00.000Z"),
    );

    expect(quality.trust_level).toBe("low");
    expect(quality.recommended_action).toBe("regenerate");
    expect(quality.score).toBeLessThan(60);
    expect(quality.cautions.some((item) => item.code === "critical_signals_open")).toBe(true);
    expect(quality.generation_confidence).toBe("low");
  });

  it("downgrades the plan when a timed recommendation recheck is overdue even if source signals are still fresh", () => {
    const profile = createStableProfile();
    const plan = {
      id: "hp-verification-overdue-1",
      language: "en",
      review_status: "reviewed",
      generator_provider: "openai",
      generation_confidence: "high",
      generation_assessment_json: {
        confidence: "high",
        readiness: "ready_to_share",
        source_signal_count: 2,
        critical_signal_count: 0,
        care_provider_count: 1,
        live_signal_count: 2,
        predictive_available: true,
        reasons: [],
      },
      generated_at: "2026-06-19T10:30:00.000Z",
      source_signals_json: [
        {
          id: "routine-check",
          label: "Routine confirmation",
          category: "service",
          strength: "medium",
          freshness: "live",
          observed_at: "2026-06-19T10:00:00.000Z",
        },
      ],
      summary_text: "Keep the current support routine in place.",
      goals_json: [{ id: "goal-1", text: "Keep the current support routine stable.", source_signal_ids: ["routine-check"] }],
      daily_support_json: [{ id: "daily-1", text: "Reconnect within 24 hours if anything shifts.", source_signal_ids: ["routine-check"] }],
      monitoring_json: [{
        id: "monitor-1",
        text: "Verify that today's routine confirmation still holds.",
        source_signal_ids: ["routine-check"],
        priority: "high",
        due_window: "same_day",
        last_verified_at: "2026-06-19T08:00:00.000Z",
        recheck_after_hours: 1,
        recheck_due_at: "2026-06-19T09:00:00.000Z",
      }],
      escalation_json: [{ id: "escalate-1", text: "Escalate within 24 hours if the routine breaks.", source_signal_ids: ["routine-check"] }],
      caregiver_guidance_json: [{ id: "caregiver-1", text: "Ana Novak keeps the next follow-up practical and documented.", source_signal_ids: ["routine-check"] }],
    };

    const audit = buildHealthPlanAudit(
      plan,
      profile,
      { latestScore: { risk_band: "medium", composite_score: 52 }, forecastRows: [] },
      { name: "Red Cross Leipzig", defaultLanguage: "en" },
      new Date("2026-06-19T12:00:00.000Z"),
    );
    const review = buildHealthPlanReviewerAssessment(
      plan,
      profile,
      { latestScore: { risk_band: "medium", composite_score: 52 }, forecastRows: [] },
      { name: "Red Cross Leipzig", defaultLanguage: "en" },
      audit,
    );
    const quality = buildHealthPlanQualitySummary(
      plan,
      profile,
      { latestScore: { risk_band: "medium", composite_score: 52 }, forecastRows: [] },
      { name: "Red Cross Leipzig", defaultLanguage: "en" },
      new Date("2026-06-19T12:00:00.000Z"),
    );

    expect(review.status).toBe("hold");
    expect(review.checks.some((item) => item.code === "verification_window_overdue" && item.state === "critical")).toBe(true);
    expect(quality.freshness_decay?.status).toBe("stale");
    expect(quality.freshness_decay?.summary_decay_reason).toBe("recommendation_overdue");
    expect(quality.freshness_decay?.recommendation_overdue_count).toBe(1);
    expect(quality.freshness_decay?.recommendation_overdue_same_day_count).toBe(1);
    expect(quality.freshness_decay?.earliest_recheck_due_at).toBe("2026-06-19T09:00:00.000Z");
    expect(quality.recommended_action).toBe("review");
  });

  it("does not keep an overdue timed recommendation open once staff has explicitly confirmed it", () => {
    const profile = createStableProfile();
    const plan = {
      id: "hp-verification-confirmed-1",
      language: "en",
      review_status: "reviewed",
      generator_provider: "openai",
      generation_confidence: "high",
      generation_assessment_json: {
        confidence: "high",
        readiness: "ready_to_share",
        source_signal_count: 2,
        critical_signal_count: 0,
        care_provider_count: 1,
        live_signal_count: 2,
        predictive_available: true,
        reasons: [],
      },
      generated_at: "2026-06-19T10:30:00.000Z",
      source_signals_json: [
        {
          id: "routine-check",
          label: "Routine confirmation",
          category: "service",
          strength: "medium",
          freshness: "live",
          observed_at: "2026-06-19T10:00:00.000Z",
        },
      ],
      summary_text: "Keep the current support routine in place.",
      goals_json: [{ id: "goal-1", text: "Keep the current support routine stable.", source_signal_ids: ["routine-check"] }],
      daily_support_json: [{ id: "daily-1", text: "Reconnect within 24 hours if anything shifts.", source_signal_ids: ["routine-check"] }],
      monitoring_json: [{
        id: "monitor-1",
        text: "Verify that today's routine confirmation still holds.",
        source_signal_ids: ["routine-check"],
        priority: "high",
        due_window: "same_day",
        last_verified_at: "2026-06-19T08:00:00.000Z",
        recheck_after_hours: 1,
        recheck_due_at: "2026-06-19T09:00:00.000Z",
        staff_disposition: "confirmed",
        staff_disposition_note: "Marta confirmed the follow-up and logged the receipt.",
        staff_disposition_updated_at: "2026-06-19T09:10:00.000Z",
      }],
      escalation_json: [{ id: "escalate-1", text: "Escalate within 24 hours if the routine breaks.", source_signal_ids: ["routine-check"] }],
      caregiver_guidance_json: [{ id: "caregiver-1", text: "Ana Novak keeps the next follow-up practical and documented.", source_signal_ids: ["routine-check"] }],
    };

    const audit = buildHealthPlanAudit(
      plan,
      profile,
      { latestScore: { risk_band: "medium", composite_score: 52 }, forecastRows: [] },
      { name: "Red Cross Leipzig", defaultLanguage: "en" },
      new Date("2026-06-19T12:00:00.000Z"),
    );
    const review = buildHealthPlanReviewerAssessment(
      plan,
      profile,
      { latestScore: { risk_band: "medium", composite_score: 52 }, forecastRows: [] },
      { name: "Red Cross Leipzig", defaultLanguage: "en" },
      audit,
    );
    const quality = buildHealthPlanQualitySummary(
      plan,
      profile,
      { latestScore: { risk_band: "medium", composite_score: 52 }, forecastRows: [] },
      { name: "Red Cross Leipzig", defaultLanguage: "en" },
      new Date("2026-06-19T12:00:00.000Z"),
    );

    expect(review.checks.some((item) => item.code === "verification_window_overdue")).toBe(false);
    expect(quality.freshness_decay?.recommendation_overdue_count).toBe(0);
    expect(quality.freshness_decay?.recommendation_timed_item_count).toBe(0);
  });

  it("keeps the plan in active review when a timed recommendation recheck is due soon", () => {
    const profile = createStableProfile();
    const plan = {
      id: "hp-verification-watch-1",
      language: "en",
      review_status: "reviewed",
      generator_provider: "openai",
      generation_confidence: "high",
      generation_assessment_json: {
        confidence: "high",
        readiness: "ready_to_share",
        source_signal_count: 2,
        critical_signal_count: 0,
        care_provider_count: 1,
        live_signal_count: 2,
        predictive_available: true,
        reasons: [],
      },
      generated_at: "2026-06-19T08:00:00.000Z",
      source_signals_json: [
        {
          id: "routine-check",
          label: "Routine confirmation",
          category: "service",
          strength: "medium",
          freshness: "live",
          observed_at: "2026-06-19T08:30:00.000Z",
        },
      ],
      summary_text: "Keep the support routine steady while staff stay alert.",
      goals_json: [{ id: "goal-1", text: "Keep the current support routine stable.", source_signal_ids: ["routine-check"] }],
      daily_support_json: [{ id: "daily-1", text: "Reconnect within 24 hours if anything shifts.", source_signal_ids: ["routine-check"] }],
      monitoring_json: [{
        id: "monitor-1",
        text: "Reconfirm the routine later today.",
        source_signal_ids: ["routine-check"],
        priority: "medium",
        due_window: "within_24h",
        last_verified_at: "2026-06-19T08:00:00.000Z",
        recheck_after_hours: 8,
        recheck_due_at: "2026-06-19T16:00:00.000Z",
      }],
      escalation_json: [{ id: "escalate-1", text: "Escalate within 24 hours if the routine breaks.", source_signal_ids: ["routine-check"] }],
      caregiver_guidance_json: [{ id: "caregiver-1", text: "Ana Novak keeps the next follow-up practical and documented.", source_signal_ids: ["routine-check"] }],
    };

    const audit = buildHealthPlanAudit(
      plan,
      profile,
      { latestScore: { risk_band: "medium", composite_score: 52 }, forecastRows: [] },
      { name: "Red Cross Leipzig", defaultLanguage: "en" },
      new Date("2026-06-19T12:00:00.000Z"),
    );
    const review = buildHealthPlanReviewerAssessment(
      plan,
      profile,
      { latestScore: { risk_band: "medium", composite_score: 52 }, forecastRows: [] },
      { name: "Red Cross Leipzig", defaultLanguage: "en" },
      audit,
    );
    const quality = buildHealthPlanQualitySummary(
      plan,
      profile,
      { latestScore: { risk_band: "medium", composite_score: 52 }, forecastRows: [] },
      { name: "Red Cross Leipzig", defaultLanguage: "en" },
      new Date("2026-06-19T12:00:00.000Z"),
    );

    expect(review.status).toBe("needs_review");
    expect(review.checks.some((item) => item.code === "verification_window_due_soon" && item.state === "watch")).toBe(true);
    expect(quality.freshness_decay?.status).toBe("watch");
    expect(quality.freshness_decay?.summary_decay_reason).toBe("recommendation_due_soon");
    expect(quality.freshness_decay?.recommendation_due_soon_count).toBe(1);
    expect(quality.freshness_decay?.recommendation_overdue_count).toBe(0);
  });

  it("derives a tighter overdue window for alert-driven verification even without an explicit recheck timestamp", () => {
    const profile = createStableProfile({
      alerts: [{ id: "alert-1", severity: "high", message: "Client could not be reached", resolved_at: null, created_at: "2026-06-19T08:00:00.000Z" }],
    });
    const plan = {
      id: "hp-alert-derived-window-1",
      language: "en",
      review_status: "reviewed",
      generator_provider: "openai",
      generation_confidence: "high",
      generation_assessment_json: {
        confidence: "high",
        readiness: "ready_to_share",
        source_signal_count: 2,
        critical_signal_count: 1,
        care_provider_count: 1,
        live_signal_count: 2,
        predictive_available: true,
        reasons: [],
      },
      generated_at: "2026-06-19T08:30:00.000Z",
      source_signals_json: [
        {
          id: "alert-active",
          label: "Active alert",
          category: "alert",
          strength: "high",
          freshness: "live",
          observed_at: "2026-06-19T08:00:00.000Z",
        },
        {
          id: "risk-latest-score",
          label: "Predictive risk score 70 (high)",
          category: "risk",
          strength: "high",
          freshness: "live",
          observed_at: "2026-06-19T08:30:00.000Z",
        },
      ],
      summary_text: "Keep the case under active same-day review while the alert is checked.",
      goals_json: [{ id: "goal-1", text: "Keep the client reachable while high-risk monitoring stays active.", source_signal_ids: ["alert-active", "risk-latest-score"] }],
      daily_support_json: [{ id: "daily-1", text: "Document each outreach result against the current high-risk picture.", source_signal_ids: ["alert-active", "risk-latest-score"] }],
      monitoring_json: [{
        id: "monitor-1",
        text: "Confirm today whether the active alert and high-risk signal still reflect the live picture.",
        source_signal_ids: ["alert-active", "risk-latest-score"],
        due_window: "within_24h",
        evidence_freshness: "live",
        evidence_conflict: "clear",
      }],
      escalation_json: [{ id: "escalate-1", text: "Escalate the same day if direct contact still fails or the high-risk picture worsens.", source_signal_ids: ["alert-active", "risk-latest-score"] }],
      caregiver_guidance_json: [{ id: "caregiver-1", text: "Keep updates practical and documented.", source_signal_ids: ["alert-active", "risk-latest-score"] }],
    };

    const quality = buildHealthPlanQualitySummary(
      plan,
      profile,
      { latestScore: { risk_band: "high", composite_score: 70 }, forecastRows: [] },
      { name: "Red Cross Leipzig", defaultLanguage: "en" },
      new Date("2026-06-19T15:00:00.000Z"),
    );

    expect(quality.freshness_decay?.recommendation_overdue_count).toBe(1);
    expect(quality.freshness_decay?.earliest_recheck_due_at).toBe("2026-06-19T14:30:00.000Z");
    expect(quality.recommended_action).toBe("review");
  });

  it("surfaces recommendation-level review pressure inside the quality summary", () => {
    const profile = createStableProfile({
      consent: { caretaker_consent: false, consent_given: false },
      alerts: [{ id: "alert-1", severity: "high", message: "Client could not be reached", resolved_at: null, created_at: "2026-06-19T08:00:00.000Z" }],
    });
    const plan = {
      id: "hp-quality-review-receipts-1",
      language: "en",
      review_status: "draft",
      generator_provider: "openai",
      generation_confidence: "medium",
      generation_assessment_json: {
        confidence: "medium",
        readiness: "review_before_share",
        source_signal_count: 3,
        critical_signal_count: 1,
        care_provider_count: 1,
        live_signal_count: 2,
        predictive_available: true,
        reasons: [],
      },
      context_snapshot_json: {
        policy: {
          family_sharing_allowed: false,
          response_expectation: "same-day review",
        },
        critical_signal_ids: ["alert-active"],
        next_confirmations: [
          {
            code: "confirm-owner",
            text: "Confirm a named follow-up owner before broader reliance.",
            signal_ids: ["alert-active"],
          },
        ],
      },
      source_signals_json: [
        {
          id: "alert-active",
          label: "Active alert: client could not be reached",
          category: "alert",
          strength: "high",
          freshness: "live",
          observed_at: "2026-06-19T08:00:00.000Z",
        },
        {
          id: "consent-family-sharing",
          label: "Family sharing consent is unconfirmed",
          category: "care-circle",
          strength: "medium",
          freshness: "unknown",
        },
      ],
      summary_text: "Use a stabilizing plan while the live picture is reconfirmed.",
      goals_json: [{ id: "goal-1", text: "Keep the client reachable today.", source_signal_ids: ["alert-active"] }],
      daily_support_json: [{ id: "daily-1", text: "Keep outreach steady and document the result.", source_signal_ids: ["alert-active"] }],
      monitoring_json: [{ id: "monitor-1", text: "Review the active alert and confirm who owns the next contact.", source_signal_ids: ["alert-active"] }],
      escalation_json: [{ id: "escalate-1", text: "Escalate the same day if contact still fails.", source_signal_ids: ["alert-active"] }],
      caregiver_guidance_json: [{ id: "caregiver-1", text: "Keep updates within staff until consent is confirmed.", source_signal_ids: ["consent-family-sharing"] }],
    };

    const quality = buildHealthPlanQualitySummary(
      plan,
      profile,
      { latestScore: { risk_band: "high", composite_score: 78 }, forecastRows: [] },
      { name: "Red Cross Leipzig", defaultLanguage: "en" },
      new Date("2026-06-19T12:00:00.000Z"),
    );

    expect(quality.recommendation_review_urgent_count).toBeGreaterThan(0);
    expect(quality.recommendation_review_verify_first_count).toBeGreaterThan(0);
    expect(quality.cautions.some((item) => item.code === "recommendations_need_urgent_review")).toBe(true);
  });

  it("treats urgent recommendations as not ready for live use when staff already escalated them", () => {
    const profile = createStableProfile({
      alerts: [{ id: "alert-1", severity: "high", message: "Client could not be reached", resolved_at: null }],
    });
    const plan = {
      id: "hp-quality-use-mode-1",
      language: "en",
      review_status: "reviewed",
      generator_provider: "openai",
      generation_confidence: "high",
      generation_assessment_json: {
        confidence: "high",
        readiness: "ready_for_review",
        source_signal_count: 4,
        critical_signal_count: 1,
        care_provider_count: 1,
        live_signal_count: 3,
        predictive_available: true,
        reasons: [],
      },
      source_signals_json: [
        { id: "alert-active", label: "Active alert", category: "alert", strength: "high", freshness: "live", observed_at: "2026-06-19T08:00:00.000Z" },
        { id: "service-checkins", label: "Check-ins", category: "service", strength: "medium", freshness: "recent", observed_at: "2026-06-19T07:30:00.000Z" },
      ],
      summary_text: "Use the current plan carefully while the live response route is still being worked through.",
      goals_json: [{ id: "goal-1", text: "Keep the client reachable today.", source_signal_ids: ["alert-active"] }],
      daily_support_json: [{ id: "daily-1", text: "Continue the support routine and document what lands.", source_signal_ids: ["service-checkins"] }],
      monitoring_json: [{ id: "monitor-1", text: "Monitor whether the next outreach actually lands.", source_signal_ids: ["alert-active"] }],
      escalation_json: [{
        id: "escalate-1",
        text: "Escalate the same day if the next outreach still does not land.",
        source_signal_ids: ["alert-active"],
        priority: "high",
        due_window: "same_day",
        staff_disposition: "escalated",
        staff_disposition_note: "Escalated to the backup field owner.",
      }],
      caregiver_guidance_json: [{ id: "caregiver-1", text: "Keep updates practical and staff-led for now.", source_signal_ids: ["alert-active"] }],
    };

    const quality = buildHealthPlanQualitySummary(
      plan,
      profile,
      { latestScore: { risk_band: "high", composite_score: 80 }, forecastRows: [] },
      { name: "Red Cross Leipzig", defaultLanguage: "en" },
      new Date("2026-06-19T12:00:00.000Z"),
    );

    expect(quality.recommendation_use_staff_review_only_count).toBeGreaterThan(0);
    expect(quality.urgent_recommendation_staff_review_only_count).toBeGreaterThan(0);
    expect(quality.cautions.some((item) => item.code === "urgent_recommendations_not_ready_for_live_use")).toBe(true);
    expect(quality.trust_summary?.state).toBe("do_not_share");
  });

  it("packages the main regeneration targets into one focus summary", () => {
    const profile = createStableProfile({
      alerts: [{ id: "alert-1", severity: "critical", message: "Client could not be reached", resolved_at: null }],
      medicationActivity: { status: "missed", occurred_at: "2026-06-19T08:00:00.000Z" },
      sensors: [{ id: "sensor-1", status: "offline", last_reading_at: "2026-06-19T08:30:00.000Z" }],
      careProviders: [],
      consent: { caretaker_consent: false, consent_given: false },
    });
    const plan = {
      id: "hp-regeneration-focus-1",
      language: "en",
      review_status: "draft",
      generator_provider: "openai",
      generation_confidence: "low",
      generation_assessment_json: {
        confidence: "low",
        readiness: "review_and_enrich",
        source_signal_count: 4,
        critical_signal_count: 3,
        care_provider_count: 0,
        live_signal_count: 2,
        stale_signal_count: 2,
        predictive_available: true,
        reasons: [
          { code: "stale_high_priority_signals", severity: "high", detail: "Key signals are stale and need a fresh touchpoint." },
        ],
      },
      automated_review_json: {
        verdict: "block",
        checked_at: "2026-06-19T09:00:00.000Z",
        summary_text: "The plan still needs material revision.",
        grounded_signal_ids: ["alert-active", "medication-plan"],
        strengths: [],
        concerns: [
          { code: "plan_actionability_weak", severity: "high", detail: "The next owner, timing, and proof are still not explicit enough." },
        ],
        required_actions: [
          "Name one owner, one same-day route, and the exact proof that will close the current outreach loop.",
        ],
        shareability: "staff_only",
        rubric_scores: {
          grounding: 58,
          actionability: 40,
          timeliness: 52,
          safety: 62,
          shareability: 68,
          overall: 49,
        },
      },
      generated_at: new Date("2026-06-19T07:00:00.000Z").toISOString(),
      source_signals_json: [
        { id: "alert-active", label: "Active alert", category: "alert", strength: "high" },
        { id: "medication-plan", label: "Medication plan", category: "medication", strength: "high" },
        { id: "sensor-status", label: "Sensor status", category: "sensor", strength: "high" },
        { id: "care-circle-context", label: "Care circle context", category: "care-circle", strength: "medium" },
      ],
      summary_text: "Use the current plan carefully while staff verify the live situation.",
      goals_json: [{ id: "goal-1", text: "Keep the situation visible.", source_signal_ids: ["alert-active"] }],
      daily_support_json: [{ id: "daily-1", text: "Maintain support.", source_signal_ids: ["medication-plan"] }],
      monitoring_json: [{ id: "monitor-1", text: "Watch for changes.", source_signal_ids: ["sensor-status"] }],
      escalation_json: [{ id: "escalate-1", text: "Escalate if not reached.", source_signal_ids: ["alert-active"] }],
      caregiver_guidance_json: [{ id: "caregiver-1", text: "Keep updates inside staff.", source_signal_ids: ["care-circle-context"] }],
      context_snapshot_json: {
        open_questions: [
          { code: "confirm-reachability", text: "Confirm whether the client can be reached today.", priority: "high", due_window: "same_day", signal_ids: ["alert-active"] },
        ],
        next_confirmations: [
          { code: "confirm-medication", text: "Confirm whether medication was actually taken today.", priority: "high", due_window: "same_day", signal_ids: ["medication-plan"] },
        ],
        must_cover: [
          {
            code: "anchor_accountability_receipts",
            description: "Name one owner, one timing window, and the receipt that will prove progress.",
            required_signal_ids: ["alert-active", "care-circle-context"],
            required_sections: ["daily_support", "monitoring", "escalation"],
            priority: "high",
            due_window: "same_day",
          },
        ],
        plan_memory: {
          has_existing_plan: true,
          current_plan: {
            current_version: 3,
            review_status: "draft",
            last_action_type: "edited",
            generation_confidence: "low",
            automated_review_verdict: "block",
            weak_review_dimensions: ["actionability", "grounding"],
            outcome_trajectory: "worsened",
            outcome_reason_codes: ["reachability_concern_added"],
            outcome_detail: "Later live evidence suggests the previous saved plan did not stabilize the case.",
          },
          learning_highlights: [
            "The last automated review judged the plan weak on actionability, so the next version should be executable without staff guessing the next step.",
          ],
          planning_cautions: [
            "Do not leave owners, timing, branches, or completion receipts implicit when the previous plan already felt too vague to act on.",
          ],
        },
      },
    };

    const focus = buildHealthPlanRegenerationFocus(
      plan,
      profile,
      { latestScore: { risk_band: "high", composite_score: 89 }, forecastRows: [] },
      { name: "Red Cross Leipzig", defaultLanguage: "en" },
      new Date("2026-06-19T12:00:00.000Z"),
    );

    expect(focus?.state).toBe("regenerate");
    expect(focus?.confidence).toBe("low");
    expect(focus?.outcome_trajectory).toBe("worsened");
    expect(focus?.weak_review_dimensions).toEqual(expect.arrayContaining(["actionability", "grounding"]));
    expect(focus?.recommended_section_targets).toEqual(
      expect.arrayContaining(["daily_support", "monitoring", "escalation"]),
    );
    expect(
      focus?.focus_items?.some((item) => /owner|proof/i.test(String(item.detail || ""))),
    ).toBe(true);
    expect(focus?.focus_items?.some((item) => item.code === "anchor_accountability_receipts")).toBe(true);
    expect(focus?.verification_items).toHaveLength(2);
    expect(focus?.learning_highlights?.[0]).toContain("actionability");
    expect(focus?.planning_cautions?.[0]).toContain("owners");
    expect(focus?.next_task_code).toBeTruthy();
  });
});
