import { describe, expect, it } from "vitest";

import {
  buildHealthPlanOutcomeScores,
  buildHealthPlanOutcomeScoreBrief,
  buildHealthPlanRecommendationOutcomeMemory,
  buildHealthPlanSignalPreferenceWeights,
} from "./healthPlanOutcomeScores.js";

describe("health plan outcome scores", () => {
  const plan = {
    goals_json: [{ id: "goal-1", text: "Keep routines steady.", source_signal_ids: ["signal-risk"] }],
    daily_support_json: [{ id: "daily-1", text: "Maintain morning routine.", source_signal_ids: ["signal-checkin"] }],
    monitoring_json: [{ id: "monitor-1", text: "Watch for missed medication.", source_signal_ids: ["signal-med"] }],
    escalation_json: [{ id: "escalate-1", text: "Escalate unresolved alerts.", source_signal_ids: ["signal-alert"] }],
    caregiver_guidance_json: [{ id: "caregiver-1", text: "Keep updates simple.", source_signal_ids: ["signal-family"] }],
  };

  it("lifts sections with helped feedback into helping status", () => {
    const outcomes = buildHealthPlanOutcomeScores({
      plan,
      feedbackEntries: [
        {
          section_key: "daily_support_json",
          outcome: "helped",
          note: "Morning routine improved call pickup.",
          recorded_at: "2026-06-20T08:00:00.000Z",
        },
      ],
    });

    expect(outcomes.find((item) => item.section_key === "daily_support_json")).toMatchObject({
      status: "helping",
    });
  });

  it("marks sections fragile when staff says they did not help or drift needs refresh", () => {
    const outcomes = buildHealthPlanOutcomeScores({
      plan,
      feedbackEntries: [
        {
          section_key: "monitoring_json",
          outcome: "did_not_help",
          note: "Monitoring missed the actual issue.",
          recorded_at: "2026-06-20T09:00:00.000Z",
        },
      ],
      sectionDrift: [
        {
          section_key: "escalation_json",
          status: "needs_refresh",
          reasons: ["Escalation guidance should be checked against unresolved alerts."],
        },
      ],
    });

    expect(outcomes.find((item) => item.section_key === "monitoring_json")).toMatchObject({
      status: "fragile",
    });
    expect(outcomes.find((item) => item.section_key === "escalation_json")).toMatchObject({
      status: "fragile",
    });
  });

  it("treats evidence-backed sections without feedback as unproven or mixed instead of helping", () => {
    const outcomes = buildHealthPlanOutcomeScores({ plan });
    expect(outcomes.find((item) => item.section_key === "goals_json")?.status).toBe("mixed");
  });

  it("builds a prompt-safe brief", () => {
    const outcomes = buildHealthPlanOutcomeScores({
      plan,
      feedbackEntries: [{ section_key: "caregiver_guidance_json", outcome: "needs_follow_up" }],
    });
    const brief = buildHealthPlanOutcomeScoreBrief(outcomes);

    expect(brief[0]).toHaveProperty("section_key");
    expect(brief[0]).toHaveProperty("score");
    expect(brief[0]).toHaveProperty("reason");
    expect(brief[0]).toHaveProperty("trend");
    expect(brief[0]).toHaveProperty("evidence_balance");
  });

  it("tracks item-level recommendation outcomes separately from section outcomes", () => {
    const memory = buildHealthPlanRecommendationOutcomeMemory({
      plan,
      feedbackEntries: [
        { section_key: "daily_support_json", item_id: "daily-1", outcome: "did_not_help", note: "The timing cue did not land well." },
        { section_key: "daily_support_json", outcome: "helped", note: "The section overall was still useful." },
      ],
    });

    expect(memory.find((item) => item.item_id === "daily-1")).toMatchObject({
      status: "fragile",
      latest_outcome: "did_not_help",
    });
  });

  it("derives signal preference weights from item-level learning", () => {
    const weightedSignals = buildHealthPlanSignalPreferenceWeights({
      plan,
      sourceSignals: [
        { id: "signal-checkin", label: "Check-in timing" },
        { id: "signal-med", label: "Medication timing" },
      ],
      feedbackEntries: [
        { section_key: "daily_support_json", item_id: "daily-1", outcome: "helped", note: "The morning routine worked." },
        { section_key: "monitoring_json", item_id: "monitor-1", outcome: "did_not_help", note: "This watch item missed the real issue." },
      ],
    });

    expect(weightedSignals.find((item) => item.signal_id === "signal-checkin")).toMatchObject({
      preference: "preserve",
    });
    expect(weightedSignals.find((item) => item.signal_id === "signal-med")).toMatchObject({
      preference: "recheck",
    });
  });

  it("recognizes repeated success as a preserve candidate", () => {
    const memory = buildHealthPlanRecommendationOutcomeMemory({
      plan,
      feedbackEntries: [
        { section_key: "daily_support_json", item_id: "daily-1", outcome: "helped", note: "Worked on Monday.", recorded_at: "2026-06-18T08:00:00.000Z" },
        { section_key: "daily_support_json", item_id: "daily-1", outcome: "helped", note: "Worked again on Thursday.", recorded_at: "2026-06-20T08:00:00.000Z" },
      ],
    });

    expect(memory.find((item) => item.item_id === "daily-1")).toMatchObject({
      trajectory: "strengthening",
      reuse_priority: "preserve",
      helped_count: 2,
    });
  });

  it("recognizes repeated failure as a replace candidate", () => {
    const memory = buildHealthPlanRecommendationOutcomeMemory({
      plan,
      feedbackEntries: [
        { section_key: "monitoring_json", item_id: "monitor-1", outcome: "did_not_help", note: "Missed the issue.", recorded_at: "2026-06-18T08:00:00.000Z" },
        { section_key: "monitoring_json", item_id: "monitor-1", outcome: "needs_follow_up", note: "Still not dependable.", recorded_at: "2026-06-20T08:00:00.000Z" },
      ],
    });

    expect(memory.find((item) => item.item_id === "monitor-1")).toMatchObject({
      trajectory: "weakening",
      reuse_priority: "replace",
      did_not_help_count: 1,
      needs_follow_up_count: 1,
    });
  });

  it("reduces the force of stale helped feedback over time", () => {
    const outcomes = buildHealthPlanOutcomeScores({
      plan,
      feedbackEntries: [
        {
          section_key: "daily_support_json",
          outcome: "helped",
          note: "This helped before.",
          recorded_at: "2026-06-01T08:00:00.000Z",
        },
      ],
      now: new Date("2026-06-20T08:00:00.000Z"),
    });

    expect(outcomes.find((item) => item.section_key === "daily_support_json")).toMatchObject({
      freshness_status: "stale",
      status: "mixed",
    });
  });

  it("uses recent operational events to reinforce or challenge recommendation memory even before direct item feedback exists", () => {
    const memory = buildHealthPlanRecommendationOutcomeMemory({
      plan,
      recentOperationalEvents: [
        { source: "checkins", status: "completed", occurred_at: "2026-06-20T08:00:00.000Z", signal_ids: ["signal-checkin"] },
        { source: "checkins", status: "answered", occurred_at: "2026-06-20T09:00:00.000Z", signal_ids: ["signal-checkin"] },
        { source: "medication", status: "missed", occurred_at: "2026-06-20T10:00:00.000Z", signal_ids: ["signal-med"] },
        { source: "medication", status: "late", occurred_at: "2026-06-20T11:00:00.000Z", signal_ids: ["signal-med"] },
      ],
      sourceSignals: [
        { id: "signal-checkin", category: "service" },
        { id: "signal-med", category: "medication" },
      ],
    });

    expect(memory.find((item) => item.item_id === "daily-1")).toMatchObject({
      operational_pattern: "reinforcing",
      operational_positive_count: 2,
      trajectory: "strengthening",
    });
    expect(memory.find((item) => item.item_id === "monitor-1")).toMatchObject({
      operational_pattern: "conflicting",
      operational_caution_count: 2,
      trajectory: "weakening",
    });
  });

  it("flags contradiction when older positive feedback conflicts with live caution", () => {
    const outcomes = buildHealthPlanOutcomeScores({
      plan,
      feedbackEntries: [
        {
          section_key: "monitoring_json",
          outcome: "helped",
          note: "This used to help.",
          recorded_at: "2026-06-20T08:00:00.000Z",
        },
      ],
      followThrough: {
        caution_signals: [
          {
            id: "risk-worsened",
            label: "Risk score has increased since plan generation",
            detail: "The latest predictive score is higher than before.",
          },
        ],
      },
    });

    expect(outcomes.find((item) => item.section_key === "monitoring_json")).toMatchObject({
      contradiction_status: "live_conflict",
    });
  });

  it("marks inferred operational evidence as observed and keeps it below a full human-helped score", () => {
    const outcomes = buildHealthPlanOutcomeScores({
      plan,
      feedbackEntries: [
        {
          section_key: "daily_support_json",
          outcome: "helped",
          note: "Observed successful check-in after the plan was generated.",
          recorded_at: "2026-06-20T08:00:00.000Z",
          source: "inferred_operational",
        },
      ],
    });

    expect(outcomes.find((item) => item.section_key === "daily_support_json")).toMatchObject({
      latest_source: "inferred_operational",
      status: "mixed",
    });
  });

  it("recognizes repeated inferred positive follow-through as strengthening without treating it like full human proof", () => {
    const outcomes = buildHealthPlanOutcomeScores({
      plan,
      feedbackEntries: [
        {
          section_key: "daily_support_json",
          outcome: "helped",
          note: "Observed successful check-in after the plan was generated.",
          recorded_at: "2026-06-20T08:00:00.000Z",
          source: "inferred_operational",
        },
        {
          section_key: "daily_support_json",
          outcome: "helped",
          note: "Observed medication follow-through after the plan was generated.",
          recorded_at: "2026-06-20T10:00:00.000Z",
          source: "inferred_operational",
        },
      ],
    });

    expect(outcomes.find((item) => item.section_key === "daily_support_json")).toMatchObject({
      trend: "strengthening",
      evidence_balance: "supportive",
      inferred_feedback_count: 2,
      explicit_feedback_count: 0,
      status: "mixed",
    });
  });

  it("captures repeated caution outcomes as weakening section learning", () => {
    const outcomes = buildHealthPlanOutcomeScores({
      plan,
      feedbackEntries: [
        {
          section_key: "monitoring_json",
          outcome: "needs_follow_up",
          note: "Recent outreach did not confirm the situation.",
          recorded_at: "2026-06-20T08:00:00.000Z",
          source: "inferred_operational",
        },
        {
          section_key: "monitoring_json",
          outcome: "did_not_help",
          note: "The monitoring wording missed the real issue.",
          recorded_at: "2026-06-20T09:00:00.000Z",
        },
      ],
    });

    expect(outcomes.find((item) => item.section_key === "monitoring_json")).toMatchObject({
      trend: "weakening",
      evidence_balance: "caution",
      did_not_help_count: 1,
      needs_follow_up_count: 1,
      operational_learning_summary: expect.stringMatching(/not holding up reliably|rewritten/i),
    });
  });

  it("lets operational recommendation evidence influence signal preference weights", () => {
    const weightedSignals = buildHealthPlanSignalPreferenceWeights({
      plan,
      sourceSignals: [
        { id: "signal-checkin", label: "Check-in timing" },
        { id: "signal-med", label: "Medication timing" },
      ],
      recentOperationalEvents: [
        { source: "checkins", status: "completed", occurred_at: "2026-06-20T08:00:00.000Z", signal_ids: ["signal-checkin"] },
        { source: "checkins", status: "answered", occurred_at: "2026-06-20T09:00:00.000Z", signal_ids: ["signal-checkin"] },
        { source: "medication", status: "missed", occurred_at: "2026-06-20T10:00:00.000Z", signal_ids: ["signal-med"] },
        { source: "medication", status: "late", occurred_at: "2026-06-20T11:00:00.000Z", signal_ids: ["signal-med"] },
      ],
    });

    expect(weightedSignals.find((item) => item.signal_id === "signal-checkin")).toMatchObject({
      preference: "preserve",
    });
    expect(weightedSignals.find((item) => item.signal_id === "signal-med")).toMatchObject({
      preference: "recheck",
    });
  });

  it("respects explicit staff guidance about what the next plan should do with a recommendation", () => {
    const recommendationMemory = buildHealthPlanRecommendationOutcomeMemory({
      plan,
      feedbackEntries: [
        {
          section_key: "daily_support_json",
          item_id: "daily-1",
          outcome: "mixed",
          recommended_next_action: "rework",
          confidence_level: "high",
          note: "Keep the idea, but rewrite the wording and timing.",
          recorded_at: "2026-06-20T08:00:00.000Z",
        },
      ],
    });

    expect(recommendationMemory.find((item) => item.item_id === "daily-1")).toMatchObject({
      latest_recommended_next_action: "rework",
      latest_confidence_level: "high",
      reuse_priority: "refine",
      reason: "Keep the idea, but rewrite the wording and timing.",
    });
  });

  it("weights recent recommendation outcomes more strongly than stale history", () => {
    const recommendationMemory = buildHealthPlanRecommendationOutcomeMemory({
      plan,
      feedbackEntries: [
        {
          section_key: "daily_support_json",
          item_id: "daily-1",
          outcome: "helped",
          note: "This used to work well.",
          recorded_at: "2026-05-20T08:00:00.000Z",
        },
        {
          section_key: "daily_support_json",
          item_id: "daily-1",
          outcome: "helped",
          note: "This worked again before.",
          recorded_at: "2026-05-25T08:00:00.000Z",
        },
        {
          section_key: "daily_support_json",
          item_id: "daily-1",
          outcome: "did_not_help",
          note: "The latest version did not land.",
          recorded_at: "2026-06-20T08:00:00.000Z",
        },
      ],
      now: new Date("2026-06-21T08:00:00.000Z"),
    });

    expect(recommendationMemory.find((item) => item.item_id === "daily-1")).toMatchObject({
      recent_caution_count: 1,
      weighted_caution_score: expect.any(Number),
      weighted_helped_score: expect.any(Number),
      reuse_priority: "replace",
    });
    expect((recommendationMemory.find((item) => item.item_id === "daily-1")?.weighted_caution_score || 0)).toBeGreaterThan(
      recommendationMemory.find((item) => item.item_id === "daily-1")?.weighted_helped_score || 0,
    );
  });
});
