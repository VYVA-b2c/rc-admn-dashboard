import { describe, expect, it } from "vitest";

import {
  deriveHealthPlanRecommendationActionability,
  deriveHealthPlanRecommendationTrustMetadata,
  deriveHealthPlanRecommendationUseGuidance,
  deriveHealthPlanRecommendationVerificationTiming,
  enrichHealthPlanRecommendationActionability,
  enrichHealthPlanRecommendationExecutionMetadata,
  enrichHealthPlanRecommendationTrustMetadata,
  enrichHealthPlanRecommendationUseGuidance,
  enrichHealthPlanRecommendationVerificationTiming,
  mergeHealthPlanSectionDispositionMetadata,
  normalizeHealthPlanSectionItems,
} from "../../server/index.mjs";

describe("health plan section item metadata", () => {
  it("normalizes staff recommendation disposition metadata", () => {
    expect(
      normalizeHealthPlanSectionItems([
        {
          id: "goal-1",
          text: "Call the client before noon.",
          source_signal_ids: ["alert-active"],
          staffDisposition: "confirmed",
          staffDispositionUpdatedAt: "2026-06-19T09:15:00.000Z",
          staffDispositionUpdatedBy: "user-1",
          staffDispositionUpdatedByEmail: "ana@example.com",
        },
      ]),
    ).toEqual([
      {
        id: "goal-1",
        text: "Call the client before noon.",
        source_signal_ids: ["alert-active"],
        staff_disposition: "confirmed",
        staff_disposition_updated_at: "2026-06-19T09:15:00.000Z",
        staff_disposition_updated_by: "user-1",
        staff_disposition_updated_by_email: "ana@example.com",
      },
    ]);
  });

  it("preserves unchanged metadata and stamps changed dispositions", () => {
    const previous = [
      {
        id: "goal-1",
        text: "Call the client before noon.",
        source_signal_ids: ["alert-active"],
        staff_disposition: "confirmed",
        staff_disposition_updated_at: "2026-06-19T09:15:00.000Z",
        staff_disposition_updated_by: "user-1",
        staff_disposition_updated_by_email: "ana@example.com",
      },
      {
        id: "goal-2",
        text: "Verify the medication schedule with the caregiver.",
        source_signal_ids: ["medication-follow-up"],
      },
    ];

    const next = [
      {
        id: "goal-1",
        text: "Call the client before noon.",
        source_signal_ids: ["alert-active"],
        staff_disposition: "confirmed",
      },
      {
        id: "goal-2",
        text: "Verify the medication schedule with the caregiver.",
        source_signal_ids: ["medication-follow-up"],
        staff_disposition: "escalated",
      },
    ];

    expect(
      mergeHealthPlanSectionDispositionMetadata(next, previous, {
        userId: "user-2",
        email: "karim@example.com",
        changedAt: "2026-06-19T10:30:00.000Z",
      }),
    ).toEqual([
      {
        id: "goal-1",
        text: "Call the client before noon.",
        source_signal_ids: ["alert-active"],
        staff_disposition: "confirmed",
        staff_disposition_updated_at: "2026-06-19T09:15:00.000Z",
        staff_disposition_updated_by: "user-1",
        staff_disposition_updated_by_email: "ana@example.com",
      },
      {
        id: "goal-2",
        text: "Verify the medication schedule with the caregiver.",
        source_signal_ids: ["medication-follow-up"],
        staff_disposition: "escalated",
        staff_disposition_updated_at: "2026-06-19T10:30:00.000Z",
        staff_disposition_updated_by: "user-2",
        staff_disposition_updated_by_email: "karim@example.com",
      },
    ]);
  });

  it("derives priority and due window from critical same-day evidence", () => {
    expect(
      deriveHealthPlanRecommendationActionability(
        {
          id: "escalation-1",
          text: "Escalate if the client still cannot be reached.",
          source_signal_ids: ["alert-active"],
        },
        "escalation",
        [
          {
            id: "alert-active",
            label: "Active alert",
            strength: "high",
            freshness: "live",
          },
        ],
        {
          critical_signal_ids: ["alert-active"],
          policy: { response_expectation: "same-day review" },
          section_guidance: {
            escalation: { urgency_window: "same_day" },
          },
        },
      ),
    ).toEqual({
      priority: "high",
      due_window: "same_day",
    });
  });

  it("enriches saved plan sections with derived actionability metadata", () => {
    expect(
      enrichHealthPlanRecommendationActionability({
        summary_text: "Keep the case stable and verified today.",
        source_signals_json: [
          {
            id: "risk-1",
            label: "Predictive risk score",
            strength: "medium",
            freshness: "recent",
          },
        ],
        context_snapshot_json: {
          policy: { response_expectation: "review within 24 hours" },
          section_guidance: {
            goals: { urgency_window: "within_24h" },
          },
        },
        goals_json: [
          {
            id: "goal-1",
            text: "Protect the support routine over the next day.",
            source_signal_ids: ["risk-1"],
          },
        ],
        daily_support_json: [],
        monitoring_json: [],
        escalation_json: [],
        caregiver_guidance_json: [],
      }).goals_json,
    ).toEqual([
      {
        id: "goal-1",
        text: "Protect the support routine over the next day.",
        source_signal_ids: ["risk-1"],
        priority: "medium",
        due_window: "within_24h",
      },
    ]);
  });

  it("maps execution owner and proof metadata onto the matching recommendation", () => {
    expect(
      enrichHealthPlanRecommendationExecutionMetadata(
        {
          goals_json: [],
          daily_support_json: [],
          monitoring_json: [
            {
              id: "monitor-1",
              text: "Review active alerts and capture what changed today.",
              source_signal_ids: ["alert-active"],
              priority: "high",
              due_window: "same_day",
            },
          ],
          escalation_json: [],
          caregiver_guidance_json: [],
        },
        {
          owner_name: "Ana Novak",
          next_task_code: "review_alerts",
          tasks: [
            {
              code: "review_alerts",
              title: "Resolve every open alert",
              priority: "high",
              due_window: "same_day",
              owner_label: "Ana Novak",
              completion_proof: "Counts as done when every open alert has a recorded action or closure note.",
              escalation_if_not_done: "If alerts remain open after the deadline, move the case back into urgent follow-up.",
              signal_ids: ["alert-active"],
              status: "open",
            },
          ],
        },
        {
          owner_name: "Ana Novak",
          owner_missing: false,
        },
      ).monitoring_json,
    ).toEqual([
      {
        id: "monitor-1",
        text: "Review active alerts and capture what changed today.",
        source_signal_ids: ["alert-active"],
        priority: "high",
        due_window: "same_day",
        owner_label: "Ana Novak",
        completion_proof: "Counts as done when every open alert has a recorded action or closure note.",
        escalation_if_not_done: "If alerts remain open after the deadline, move the case back into urgent follow-up.",
        source_task_code: "review_alerts",
      },
    ]);
  });

  it("derives freshness-gap trust metadata from aging evidence", () => {
    expect(
      deriveHealthPlanRecommendationTrustMetadata(
        {
          id: "monitor-1",
          text: "Confirm whether today's live picture still matches the saved risk signals.",
          source_signal_ids: ["risk-1"],
        },
        [
          {
            id: "risk-1",
            label: "Predictive risk score",
            strength: "medium",
            freshness: "stale",
          },
        ],
        {
          evidence_digest: {
            freshness_gap: true,
            stale_signal_ids: ["risk-1"],
          },
          next_confirmations: [
            {
              code: "fresh-touchpoint",
              text: "A fresh touchpoint is still needed today.",
              signal_ids: ["risk-1"],
            },
          ],
        },
      ),
    ).toEqual({
      evidence_freshness: "stale",
      evidence_conflict: "freshness_gap",
    });
  });

  it("marks conflict when linked evidence carries a contradiction signal", () => {
    expect(
      enrichHealthPlanRecommendationTrustMetadata({
        source_signals_json: [
          {
            id: "evidence-predictive-live-mismatch",
            label: "Predictive and live evidence mismatch",
            strength: "high",
            freshness: "live",
          },
        ],
        context_snapshot_json: {
          evidence_digest: {
            freshness_gap: false,
          },
        },
        goals_json: [],
        daily_support_json: [],
        monitoring_json: [
          {
            id: "monitor-1",
            text: "Reconcile the mismatch before assuming stability.",
            source_signal_ids: ["evidence-predictive-live-mismatch"],
          },
        ],
        escalation_json: [],
        caregiver_guidance_json: [],
      }).monitoring_json,
    ).toEqual([
      {
        id: "monitor-1",
        text: "Reconcile the mismatch before assuming stability.",
        source_signal_ids: ["evidence-predictive-live-mismatch"],
        evidence_freshness: "live",
        evidence_conflict: "conflicted",
      },
    ]);
  });

  it("derives staff-only use guidance when the recommendation is urgent or weakly grounded", () => {
    expect(
      deriveHealthPlanRecommendationUseGuidance(
        {
          id: "escalation-1",
          text: "Escalate the same day if contact still fails.",
          source_signal_ids: ["execution-stalled"],
          priority: "high",
          due_window: "same_day",
        },
        "escalation",
        [
          {
            id: "execution-stalled",
            label: "Execution stalled",
            category: "context",
            strength: "high",
            freshness: "live",
          },
        ],
        {
          next_confirmations: [
            {
              code: "unstick-followthrough-loop",
              text: "Move the case off the blocked path by naming the next alternate route and first receipt of contact.",
              signal_ids: ["execution-stalled"],
            },
          ],
        },
      ),
    ).toEqual({
      recommendation_use_mode: "staff_review_only",
      recommendation_use_reason_codes: expect.arrayContaining(["urgent_review_required", "urgent_timing"]),
      recommendation_use_summary: expect.stringMatching(/staff review only/i),
    });
  });

  it("carries deferred or escalated staff dispositions into recommendation use guidance", () => {
    expect(
      enrichHealthPlanRecommendationUseGuidance({
        source_signals_json: [
          {
            id: "risk-1",
            label: "Predictive risk score",
            category: "risk",
            strength: "medium",
            freshness: "recent",
          },
        ],
        context_snapshot_json: {
          policy: { response_expectation: "review within 24 hours" },
        },
        goals_json: [],
        daily_support_json: [
          {
            id: "daily-1",
            text: "Keep the support routine steady over the next day.",
            source_signal_ids: ["risk-1"],
            priority: "medium",
            due_window: "within_24h",
            staff_disposition: "deferred",
          },
        ],
        monitoring_json: [],
        escalation_json: [
          {
            id: "escalation-1",
            text: "Escalate if the next outreach still does not land.",
            source_signal_ids: ["risk-1"],
            priority: "high",
            due_window: "same_day",
            staff_disposition: "escalated",
          },
        ],
        caregiver_guidance_json: [],
      }),
    ).toMatchObject({
      daily_support_json: [
        {
          id: "daily-1",
          recommendation_use_mode: "verify_before_use",
          recommendation_use_reason_codes: expect.arrayContaining(["staff_deferred"]),
        },
      ],
      escalation_json: [
        {
          id: "escalation-1",
          recommendation_use_mode: "staff_review_only",
          recommendation_use_reason_codes: expect.arrayContaining(["staff_escalated", "urgent_timing"]),
        },
      ],
    });
  });

  it("derives a conservative recheck window from stale same-day evidence", () => {
    expect(
      deriveHealthPlanRecommendationVerificationTiming(
        {
          id: "monitor-1",
          text: "Refresh today's live picture.",
          source_signal_ids: ["risk-1"],
          due_window: "same_day",
          evidence_freshness: "stale",
          evidence_conflict: "freshness_gap",
        },
        [
          {
            id: "risk-1",
            label: "Predictive risk score",
            observed_at: "2026-06-19T08:00:00.000Z",
            freshness: "stale",
          },
        ],
        {
          policy: { response_expectation: "same-day review" },
        },
      ),
    ).toEqual({
      last_verified_at: "2026-06-19T08:00:00.000Z",
      recheck_after_hours: 2,
      recheck_due_at: "2026-06-19T10:00:00.000Z",
    });
  });

  it("enriches plan items with verification timing metadata", () => {
    expect(
      enrichHealthPlanRecommendationVerificationTiming({
        source_signals_json: [
          {
            id: "alert-active",
            label: "Active alert",
            observed_at: "2026-06-19T09:15:00.000Z",
            freshness: "live",
          },
        ],
        context_snapshot_json: {
          policy: { response_expectation: "review within 24 hours" },
        },
        goals_json: [],
        daily_support_json: [],
        monitoring_json: [],
        escalation_json: [
          {
            id: "escalation-1",
            text: "Escalate if direct contact still fails.",
            source_signal_ids: ["alert-active"],
            due_window: "within_24h",
            evidence_freshness: "live",
            evidence_conflict: "clear",
          },
        ],
        caregiver_guidance_json: [],
      }).escalation_json,
    ).toEqual([
      {
        id: "escalation-1",
        text: "Escalate if direct contact still fails.",
        source_signal_ids: ["alert-active"],
        due_window: "within_24h",
        evidence_freshness: "live",
        evidence_conflict: "clear",
        last_verified_at: "2026-06-19T09:15:00.000Z",
        recheck_after_hours: 6,
        recheck_due_at: "2026-06-19T15:15:00.000Z",
      },
    ]);
  });

  it("tightens the recheck window for live alert-driven guidance even within a 24-hour plan", () => {
    expect(
      deriveHealthPlanRecommendationVerificationTiming(
        {
          id: "escalation-1",
          text: "Escalate if the active alert is still unresolved.",
          source_signal_ids: ["alert-active"],
          due_window: "within_24h",
          evidence_freshness: "live",
          evidence_conflict: "clear",
          evidence_review_state: "urgent_review",
        },
        [
          {
            id: "alert-active",
            label: "Active alert",
            category: "alert",
            strength: "high",
            observed_at: "2026-06-19T09:15:00.000Z",
            freshness: "live",
          },
        ],
        {
          critical_signal_ids: ["alert-active"],
          policy: { response_expectation: "review within 24 hours" },
        },
      ),
    ).toEqual({
      last_verified_at: "2026-06-19T09:15:00.000Z",
      recheck_after_hours: 4,
      recheck_due_at: "2026-06-19T13:15:00.000Z",
    });
  });
});
