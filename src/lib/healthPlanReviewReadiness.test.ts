import { describe, expect, it } from "vitest";

import { buildHealthPlanReviewReadiness } from "./healthPlanReviewReadiness.js";

describe("healthPlanReviewReadiness", () => {
  it("blocks review when hard quality gates are still failing", () => {
    const summary = buildHealthPlanReviewReadiness({
      readiness: {
        overall_status: "guarded",
        summary: "Most evidence is present.",
        caution_count: 1,
        caution_reasons: [{ label: "Sensor evidence is a little stale." }],
      },
      generationQuality: {
        overall_status: "fragile",
        summary: "The draft still looks soft.",
        issues: [{ severity: "high", message: "Monitoring stayed too generic for a same-day review section." }],
      },
      operationalCompleteness: {
        overall_status: "fragile",
        summary: "Important execution details are still implicit.",
        issues: [{ severity: "high", section_key: "escalation_json", message: "Escalation does not clearly name who acts next.", detail: "Name the owner and backup path." }],
      },
      actionImpact: {
        overall_status: "contradicted",
        summary: "Recent real-world evidence is contradicting one or more important plan sections.",
        contradicted_count: 1,
        items: [
          {
            section_key: "monitoring_json",
            impact_status: "contradicted",
            reason: "New unresolved alerts appeared after the plan went live.",
            next_step: "Rewrite the monitoring section decisively.",
          },
        ],
      },
      recommendationImpact: {
        high_priority_contradicted_count: 1,
        items: [
          {
            section_key: "monitoring_json",
            impact_status: "contradicted",
            is_high_priority: true,
            reason: "Fresh medication misses are already contradicting a high-priority monitoring recommendation.",
            next_step: "Replace the old monitoring wording.",
          },
        ],
      },
      recommendationHistory: {
        high_priority_deteriorating_count: 1,
        items: [
          {
            section_key: "monitoring_json",
            trend_status: "deteriorating",
            is_high_priority: true,
            reason: "This exact monitoring recommendation has degraded across saved versions.",
            next_step: "Replace the old wording instead of preserving it.",
          },
        ],
      },
      recommendationEvidenceDiversity: {
        overall_status: "fragile",
        issues: [
          {
            section_key: "monitoring_json",
            severity: "high",
            message: "This recommendation is high-pressure guidance without enough diverse corroboration behind it.",
          },
        ],
      },
      recommendationGrounding: {
        overall_status: "strong",
        issues: [],
      },
      recommendationCoverage: {
        overall_status: "guarded",
        score: 86,
        issues: [],
        summary: "Coverage is mostly present.",
      },
      recommendationChallenges: {
        overall_status: "challenged",
        items: [
          {
            challenge_status: "challenged",
            high_risk: true,
            why_it_is_questioned: "Escalation wording still sounds calmer than the live pattern warrants.",
            safer_reframe: "Name the same-day owner and fallback path.",
          },
        ],
      },
      recommendationReview: {
        overall_status: "blocked",
        blocking_items: [
          {
            label: "Monitoring: add a review decision",
            detail: "Choose a decision and note why before sign-off.",
            section_keys: ["monitoring_json"],
            severity: "high",
            priority: "high",
          },
        ],
        caution_items: [],
      },
    });

    expect(summary).toMatchObject({
      overall_status: "blocked",
      can_mark_reviewed: false,
      blocker_count: 8,
    });
    expect(summary.blocking_items.some((item) => /alerts appeared|contradict/i.test(String(item?.label || "")))).toBe(true);
    expect(summary.blocking_items.some((item) => /saved versions|degraded/i.test(String(item?.label || "")))).toBe(true);
    expect(summary.caution_items.some((item) => /sensor evidence/i.test(String(item?.label || "")))).toBe(true);
  });

  it("stays guarded when only caution-level review concerns remain", () => {
    const summary = buildHealthPlanReviewReadiness({
      reviewGovernance: {
        review_required: true,
        review_window: "today",
        review_summary: "Same-day human review is still required.",
      },
      readiness: {
        overall_status: "ready",
        blocker_count: 0,
        caution_count: 0,
      },
      generationQuality: {
        overall_status: "guarded",
        summary: "The plan cleared generation, but still needs a cautious human read.",
        issues: [{ severity: "medium", message: "Daily support is still a little generic." }],
      },
      operationalCompleteness: {
        overall_status: "guarded",
        summary: "Some sections still need clearer ownership or timing.",
        issues: [{ severity: "medium", section_key: "caregiver_guidance_json", message: "Caregiver guidance should say how to report back.", detail: "Add report-back wording." }],
      },
      actionImpact: {
        overall_status: "mixed",
        summary: "Some action sections seem to be helping, but the post-plan picture is still mixed.",
        mixed_count: 1,
        items: [
          {
            section_key: "daily_support_json",
            impact_status: "mixed",
            reason: "Some fresh check-ins landed, but missed medication confirmations are still competing with them.",
            next_step: "Tighten the daily support section and verify the next response.",
          },
        ],
      },
      recommendationImpact: {
        contradicted_count: 0,
        mixed_count: 1,
        items: [
          {
            section_key: "daily_support_json",
            impact_status: "mixed",
            reason: "The exact daily support recommendation still has a mixed response pattern.",
            next_step: "Tighten the recommendation and verify the next response.",
          },
        ],
      },
      recommendationHistory: {
        deteriorating_count: 0,
        volatile_count: 1,
        items: [
          {
            section_key: "daily_support_json",
            trend_status: "volatile",
            reason: "This recommendation has not settled cleanly across saved versions.",
            next_step: "Tighten the wording and verify the next cycle.",
          },
        ],
      },
      recommendationEvidenceDiversity: {
        overall_status: "guarded",
        items: [{ section_key: "daily_support_json" }],
        summary: "Some recommendations are still usable, but the evidence mix is narrower than ideal.",
      },
      recommendationGrounding: {
        overall_status: "guarded",
        summary: "A few recommendations still need human verification.",
        issues: [],
      },
      recommendationCalibration: {
        overall_status: "adjusted",
        summary: "1 recommendation was softened before acceptance.",
        adjustment_count: 1,
        high_pressure_adjustment_count: 1,
        items: [
          {
            section_key: "monitoring_json",
            high_pressure: true,
            reason: "This recommendation is usable, but staff should verify the live picture before leaning on it heavily.",
          },
        ],
      },
      recommendationCoverage: {
        overall_status: "strong",
        score: 92,
        issues: [],
      },
      recommendationChallenges: {
        overall_status: "guarded",
        guarded_count: 1,
        items: [],
        summary: "Most recommendations are usable, but a few still need a challenge pass.",
      },
      recommendationReview: {
        overall_status: "guarded",
        blocking_items: [],
        caution_items: [
          {
            label: "Daily support: keep under watch",
            detail: "Approved only with another check after the next contact cycle.",
            section_keys: ["daily_support_json"],
            severity: "medium",
            priority: "medium",
          },
        ],
      },
      benchmarkAssessment: {
        overall_status: "guarded",
        summary: "Matched benchmark patterns still suggest a cautious review.",
        evaluations: [{ top_issue: { message: "Escalation wording should stay more explicit." } }],
      },
    });

    expect(summary).toMatchObject({
      overall_status: "guarded",
      can_mark_reviewed: true,
      blocker_count: 0,
    });
    expect(summary.caution_count).toBeGreaterThanOrEqual(3);
    expect(summary.caution_items.some((item) => /softened before acceptance|validator had to soften/i.test(String(item?.label || "")))).toBe(true);
  });

  it("blocks review when a strongly matched benchmark archetype still fails critical dimensions", () => {
    const summary = buildHealthPlanReviewReadiness({
      readiness: {
        overall_status: "ready",
        blocker_count: 0,
        caution_count: 0,
      },
      benchmarkAssessment: {
        overall_status: "fragile",
        rejected: true,
        summary: "A matched high-risk benchmark archetype still sees this plan as fragile.",
        evaluations: [
          {
            match_score: 82,
            top_issue: {
              section_key: "escalation_json",
              message: "The plan still does not give a dependable fallback path for same-day escalation.",
            },
          },
        ],
      },
    });

    expect(summary).toMatchObject({
      overall_status: "blocked",
      can_mark_reviewed: false,
    });
    expect(summary.blocking_items.some((item) => /benchmark archetype|fallback path/i.test(String(item?.label || "") + String(item?.detail || "")))).toBe(true);
  });

  it("blocks review when manual high-priority edits lose their evidence trail", () => {
    const summary = buildHealthPlanReviewReadiness({
      readiness: {
        overall_status: "ready",
        blocker_count: 0,
        caution_count: 0,
      },
      editorialTrace: {
        overall_status: "fragile",
        summary: "A manual recommendation lost its evidence trail.",
        issues: [
          {
            section_key: "escalation_json",
            severity: "high",
            message: "A manual high-priority recommendation no longer carries any source signal linkage.",
          },
        ],
        items: [
          {
            section_key: "escalation_json",
            origin_type: "human_added",
          },
        ],
      },
    });

    expect(summary).toMatchObject({
      overall_status: "blocked",
      can_mark_reviewed: false,
    });
    expect(summary.blocking_items.some((item) => /evidence trail|source signal linkage/i.test(String(item?.label || "")))).toBe(true);
  });

  it("blocks review when a high-pressure recommendation rewrite is still thinly justified", () => {
    const summary = buildHealthPlanReviewReadiness({
      readiness: {
        overall_status: "ready",
        blocker_count: 0,
        caution_count: 0,
      },
      recommendationChangeAudit: {
        recommendation_changes: {
          thin_justification_count: 1,
          items: [
            {
              action: "tightened",
              section_key: "monitoring_json",
              text: "Re-check the alert pattern today and escalate if contact fails again.",
              priority: "high",
              timing: "today",
              justification_status: "thin",
            },
          ],
        },
      },
    });

    expect(summary).toMatchObject({
      overall_status: "blocked",
      can_mark_reviewed: false,
    });
    expect(summary.blocking_items.some((item) => /thinly justified|earned trust|meaningful recommendation rewrite/i.test(`${item?.label || ""} ${item?.detail || ""}`))).toBe(true);
  });

  it("keeps thinly justified low-pressure changes as a caution rather than a blocker", () => {
    const summary = buildHealthPlanReviewReadiness({
      readiness: {
        overall_status: "ready",
        blocker_count: 0,
        caution_count: 0,
      },
      recommendationChangeAudit: {
        summary: "A few recommendation edits are newer than they are proven.",
        recommendation_changes: {
          thin_justification_count: 1,
          items: [
            {
              action: "added",
              section_key: "goals_json",
              text: "Check whether the routine still feels supportive next week.",
              priority: "low",
              timing: "ongoing",
              justification_status: "thin",
            },
          ],
        },
      },
    });

    expect(summary).toMatchObject({
      overall_status: "guarded",
      can_mark_reviewed: true,
    });
    expect(summary.caution_items.some((item) => /newer than they are proven|weakly justified/i.test(`${item?.label || ""} ${item?.detail || ""}`))).toBe(true);
  });

  it("blocks review when a high-priority manual override has no staff rationale", () => {
    const summary = buildHealthPlanReviewReadiness({
      readiness: {
        overall_status: "ready",
        blocker_count: 0,
        caution_count: 0,
      },
      editorialTrace: {
        overall_status: "fragile",
        summary: "A manual high-priority override still needs a staff rationale.",
        issues: [
          {
            section_key: "monitoring_json",
            severity: "high",
            message: "A manual high-priority recommendation was changed without a staff rationale explaining why it overrides the original draft.",
          },
        ],
        items: [
          {
            section_key: "monitoring_json",
            origin_type: "human_edited",
          },
        ],
      },
    });

    expect(summary).toMatchObject({
      overall_status: "blocked",
      can_mark_reviewed: false,
    });
    expect(summary.blocking_items.some((item) => /staff rationale|overrides the original draft/i.test(String(item?.label || "")))).toBe(true);
  });
});
