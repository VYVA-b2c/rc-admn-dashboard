// @vitest-environment node

import { describe, expect, it } from "vitest";

import { buildHealthPlanChangeSummary } from "../../server/index.mjs";

function createPlan(overrides = {}) {
  return {
    review_status: "draft",
    summary_text: "Keep the client supported through the next review window.",
    goals_json: [{ id: "goal-1", text: "Keep routines stable.", source_signal_ids: ["service-checkins"] }],
    daily_support_json: [{ id: "daily-1", text: "Use the saved check-in rhythm.", source_signal_ids: ["service-checkins"] }],
    monitoring_json: [{ id: "monitor-1", text: "Monitor routine completion.", source_signal_ids: ["service-checkins"] }],
    escalation_json: [{ id: "escalate-1", text: "Escalate if contact breaks down.", source_signal_ids: ["alert-active"] }],
    caregiver_guidance_json: [{ id: "caregiver-1", text: "Share calm updates with approved staff.", source_signal_ids: ["consent-family-sharing"] }],
    generation_confidence: "medium",
    ...overrides,
  };
}

describe("buildHealthPlanChangeSummary", () => {
  it("creates a baseline receipt for the first saved plan", () => {
    const summary = buildHealthPlanChangeSummary(null, createPlan(), "generated");

    expect(summary?.change_kind).toBe("baseline");
    expect(summary?.action_type).toBe("generated");
    expect(summary?.changed_sections).toContain("summary");
    expect(summary?.entries?.some((entry) => entry.code === "baseline_created")).toBe(true);
  });

  it("captures section, signal, and review changes on later versions", () => {
    const previous = createPlan();
    const next = createPlan({
      review_status: "reviewed",
      summary_text: "Keep the client supported with same-day outreach if contact drops.",
      monitoring_json: [{ id: "monitor-1", text: "Monitor routine completion and sensor reliability.", source_signal_ids: ["service-checkins", "sensor-status"] }],
      escalation_json: [{ id: "escalate-1", text: "Escalate the same day if alerts persist.", source_signal_ids: ["alert-active", "risk-latest-score"] }],
      generation_confidence: "high",
    });

    const summary = buildHealthPlanChangeSummary(previous, next, "reviewed");

    expect(summary?.change_kind).toBe("update");
    expect(summary?.review_transition).toBe("draft_to_reviewed");
    expect(summary?.generation_confidence_transition).toBe("medium_to_high");
    expect(summary?.changed_sections).toEqual(expect.arrayContaining(["summary", "monitoring", "escalation"]));
    expect(summary?.signals_added).toEqual(expect.arrayContaining(["risk-latest-score", "sensor-status"]));
    expect(summary?.entries?.some((entry) => entry.code === "review_marked")).toBe(true);
    expect(summary?.entries?.some((entry) => entry.code === "sections_updated")).toBe(true);
    expect(summary?.entries?.some((entry) => entry.code === "signals_added")).toBe(true);
  });

  it("captures evidence drift even when the saved wording stays the same", () => {
    const previous = createPlan({
      source_signals_json: [
        { id: "service-checkins", label: "Check-ins", category: "service", strength: "medium" },
      ],
      generation_assessment_json: {
        confidence: "medium",
        readiness: "ready_for_review",
        source_signal_count: 1,
        critical_signal_count: 0,
        care_provider_count: 1,
        live_signal_count: 1,
        predictive_available: false,
        reasons: [],
      },
      context_snapshot_json: {
        snapshot_version: "health-plan-context-v1",
        generated_at: "2026-06-18T08:00:00.000Z",
        language: "en",
        user: { language: "en" },
        source_signals: [{ id: "service-checkins", label: "Check-ins", category: "service", strength: "medium" }],
      },
      automated_review_json: {
        verdict: "revise",
        checked_at: "2026-06-18T08:05:00.000Z",
        summary_text: "Needs a little staff review.",
        grounded_signal_ids: ["service-checkins"],
        strengths: [],
        concerns: [],
        required_actions: ["Confirm a fresh touchpoint."],
        shareability: "staff_only",
        provider: "openai",
        model: "gpt-4o-mini",
        version: "health-plan-v1-review",
      },
      review_valid_until: "2026-06-19T08:00:00.000Z",
      review_attestation_json: {
        approved_for_sharing: false,
        checked_at: "2026-06-18T08:10:00.000Z",
        response_expectation: "within_24h",
        checklist_codes: [],
        open_issue_codes: [],
        reason_codes: [],
        operator_confirmation_codes: [],
      },
    });
    const next = createPlan({
      source_signals_json: [
        { id: "service-checkins", label: "Check-ins", category: "service", strength: "medium" },
        { id: "alert-active", label: "Active alert", category: "alert", strength: "high" },
      ],
      generation_assessment_json: {
        confidence: "medium",
        readiness: "needs_context_refresh",
        source_signal_count: 2,
        critical_signal_count: 1,
        care_provider_count: 1,
        live_signal_count: 2,
        predictive_available: false,
        reasons: [{ code: "live_picture_stale", severity: "high", detail: "Fresh contact still needed." }],
      },
      context_snapshot_json: {
        snapshot_version: "health-plan-context-v1",
        generated_at: "2026-06-18T11:00:00.000Z",
        language: "en",
        user: { language: "en" },
        source_signals: [
          { id: "service-checkins", label: "Check-ins", category: "service", strength: "medium" },
          { id: "alert-active", label: "Active alert", category: "alert", strength: "high" },
        ],
      },
      automated_review_json: {
        verdict: "revise",
        checked_at: "2026-06-18T11:05:00.000Z",
        summary_text: "Still usable, but based on a changed live picture.",
        grounded_signal_ids: ["service-checkins", "alert-active"],
        strengths: [],
        concerns: [],
        required_actions: ["Confirm a fresh touchpoint today."],
        shareability: "staff_only",
        provider: "openai",
        model: "gpt-4o-mini",
        version: "health-plan-v1-review",
      },
      review_valid_until: "2026-06-18T20:00:00.000Z",
      review_attestation_json: {
        approved_for_sharing: false,
        checked_at: "2026-06-18T11:10:00.000Z",
        response_expectation: "same_day",
        checklist_codes: ["response_window_clear"],
        open_issue_codes: [],
        reason_codes: [],
        operator_confirmation_codes: ["timing"],
      },
    });

    const summary = buildHealthPlanChangeSummary(previous, next, "edited");

    expect(summary?.changed_sections).toEqual([]);
    expect(summary?.source_signals_added).toEqual(["alert-active"]);
    expect(summary?.entries?.some((entry) => entry.code === "evidence_inputs_changed")).toBe(true);
    expect(summary?.entries?.some((entry) => entry.code === "content_stable_evidence_shifted")).toBe(true);
    expect(summary?.entries?.some((entry) => entry.code === "automated_review_refreshed")).toBe(true);
    expect(summary?.entries?.some((entry) => entry.code === "review_attestation_updated")).toBe(true);
    expect(summary?.entries?.some((entry) => entry.code === "review_window_updated")).toBe(true);
    expect(summary?.content_fingerprint).toBeTruthy();
    expect(summary?.evidence_fingerprint).toBeTruthy();
    expect(summary?.review_fingerprint).toBeTruthy();
  });
});
