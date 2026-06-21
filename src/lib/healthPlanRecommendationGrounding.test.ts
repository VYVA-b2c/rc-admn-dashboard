import { describe, expect, it } from "vitest";

import {
  applyHealthPlanRecommendationGroundingCalibration,
  buildHealthPlanRecommendationCalibrationSummary,
  buildHealthPlanRecommendationGrounding,
  shouldRejectHealthPlanRecommendationGrounding,
} from "./healthPlanRecommendationGrounding.js";

describe("healthPlanRecommendationGrounding", () => {
  it("marks urgent recommendations as strong when they are corroborated by high-value evidence", () => {
    const summary = buildHealthPlanRecommendationGrounding({
      plan: {
        monitoring_json: [
          {
            id: "monitor-1",
            text: "Verify the open fall alert and the repeated missed check-ins today.",
            source_signal_ids: ["alert-active", "service-checkins"],
            priority: "high",
            confidence: "medium",
            timing: "today",
            verification_required: true,
          },
        ],
        escalation_json: [
          {
            id: "escalation-1",
            text: "Escalate today if the client remains unreachable after the first outreach attempt.",
            source_signal_ids: ["alert-active", "service-checkins"],
            priority: "high",
            confidence: "medium",
            timing: "today",
            verification_required: true,
          },
        ],
        goals_json: [],
        daily_support_json: [],
        caregiver_guidance_json: [],
      },
      sourceSignals: [
        { id: "alert-active", label: "Open fall alert", category: "alert", strength: "high" },
        { id: "service-checkins", label: "Missed check-ins", category: "service", strength: "high" },
      ],
      evidencePack: {
        must_address_facts: [
          { source_signal_ids: ["alert-active"] },
          { source_signal_ids: ["service-checkins"] },
        ],
        verification_needs: [
          { source_signal_ids: ["service-checkins"] },
        ],
      },
      reviewPriorities: {
        items: [
          { section_key: "monitoring_json", priority: "high", response_window: "today" },
          { section_key: "escalation_json", priority: "high", response_window: "today" },
        ],
      },
      recommendationSourceRanking: {
        items: [
          {
            section_key: "monitoring_json",
            item_id: "monitor-1",
            evidence_quality: "strong",
            ranked_sources: [
              { signal_id: "alert-active", label: "Open fall alert", authority_level: "high" },
              { signal_id: "service-checkins", label: "Missed check-ins", authority_level: "medium" },
            ],
          },
          {
            section_key: "escalation_json",
            item_id: "escalation-1",
            evidence_quality: "strong",
            ranked_sources: [
              { signal_id: "alert-active", label: "Open fall alert", authority_level: "high" },
              { signal_id: "service-checkins", label: "Missed check-ins", authority_level: "medium" },
            ],
          },
        ],
      },
    });

    expect(summary).toMatchObject({
      overall_status: "strong",
      fragile_count: 0,
    });
    expect(summary?.items?.[0]).toMatchObject({
      grounding_status: "strong",
      top_source_label: "Open fall alert",
    });
    expect(shouldRejectHealthPlanRecommendationGrounding(summary)).toBe(false);
  });

  it("flags high-pressure recommendations that rely on thin context-only grounding", () => {
    const summary = buildHealthPlanRecommendationGrounding({
      plan: {
        caregiver_guidance_json: [
          {
            id: "caregiver-1",
            text: "Share updates broadly with the family today.",
            source_signal_ids: ["care-circle-context"],
            priority: "high",
            confidence: "high",
            timing: "today",
          },
        ],
        goals_json: [],
        daily_support_json: [],
        monitoring_json: [],
        escalation_json: [],
      },
      sourceSignals: [
        { id: "care-circle-context", label: "Care circle context", category: "care-circle", strength: "low" },
      ],
      confidenceProfile: {
        section_confidence: [
          { section_key: "caregiver_guidance_json", max_confidence: "low" },
        ],
      },
      recommendationSourceRanking: {
        items: [
          {
            section_key: "caregiver_guidance_json",
            item_id: "caregiver-1",
            evidence_quality: "thin",
            ranked_sources: [
              { signal_id: "care-circle-context", label: "Care circle context", authority_level: "supporting" },
            ],
          },
        ],
      },
    });

    expect(summary).toMatchObject({
      overall_status: "fragile",
      fragile_count: 1,
    });
    expect(summary?.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "high_pressure_thin_grounding", severity: "high" }),
        expect.objectContaining({ type: "high_confidence_outruns_evidence", severity: "high" }),
        expect.objectContaining({ type: "context_only_grounding" }),
      ]),
    );
    expect(shouldRejectHealthPlanRecommendationGrounding(summary)).toBe(true);
  });

  it("flags recommendations that mention a conflict area without carrying the lead signal or explicit verification", () => {
    const summary = buildHealthPlanRecommendationGrounding({
      plan: {
        monitoring_json: [
          {
            id: "monitor-1",
            text: "Keep an eye on the routine and check back later this week.",
            source_signal_ids: ["service-checkins"],
            priority: "high",
            confidence: "medium",
            timing: "this_week",
          },
        ],
        goals_json: [],
        daily_support_json: [],
        escalation_json: [],
        caregiver_guidance_json: [],
      },
      sourceSignals: [
        { id: "risk-latest-score", label: "Predictive risk score 84 (high)", category: "risk", strength: "high" },
        { id: "service-checkins", label: "Check-ins enabled", category: "service", strength: "medium" },
      ],
      evidencePack: {
        contradictions: [
          {
            id: "conflict:risk-vs-service",
            section_key: "monitoring_json",
            severity: "medium",
            summary: "Predictive risk and routines are pulling in different directions.",
            preferred_signal_ids: ["risk-latest-score"],
            preserve_signal_ids: ["service-checkins"],
            requires_verification: true,
            response_window: "today",
            source_signal_ids: ["risk-latest-score", "service-checkins"],
          },
        ],
      },
      reviewPriorities: {
        items: [
          { section_key: "monitoring_json", priority: "high", response_window: "today" },
        ],
      },
      recommendationSourceRanking: {
        items: [
          {
            section_key: "monitoring_json",
            item_id: "monitor-1",
            evidence_quality: "mixed",
            ranked_sources: [
              { signal_id: "service-checkins", label: "Check-ins enabled", authority_level: "medium" },
            ],
          },
        ],
      },
    });

    expect(summary?.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "conflict_priority_signal_missing" }),
        expect.objectContaining({ type: "conflict_verification_missing" }),
        expect.objectContaining({ type: "conflict_timing_mismatch" }),
      ]),
    );
    expect(summary?.items?.[0]).toMatchObject({
      conflict_count: 1,
      conflict_status: "active_medium",
    });
    expect(shouldRejectHealthPlanRecommendationGrounding(summary)).toBe(true);
  });

  it("calibrates recommendation confidence and verification to match the evidence before final acceptance", () => {
    const plan = {
      monitoring_json: [
        {
          id: "monitor-1",
          text: "Keep monitoring the medication situation today.",
          source_signal_ids: ["medication-plan"],
          priority: "high",
          confidence: "high",
          timing: "today",
        },
      ],
      goals_json: [],
      daily_support_json: [],
      escalation_json: [],
      caregiver_guidance_json: [],
    };

    const grounding = buildHealthPlanRecommendationGrounding({
      plan,
      sourceSignals: [
        { id: "medication-plan", label: "Medication adherence issue", category: "medication", strength: "high" },
      ],
      reviewPriorities: {
        items: [
          { section_key: "monitoring_json", priority: "high", response_window: "today" },
        ],
      },
      recommendationSourceRanking: {
        items: [
          {
            section_key: "monitoring_json",
            item_id: "monitor-1",
            evidence_quality: "mixed",
            ranked_sources: [
              { signal_id: "medication-plan", label: "Medication adherence issue", authority_level: "medium" },
            ],
          },
        ],
      },
    });

    expect(grounding?.items?.[0]).toMatchObject({
      recommended_confidence: "medium",
      verification_expected: true,
    });

    const calibrated = applyHealthPlanRecommendationGroundingCalibration({
      plan,
      grounding,
    });
    const calibratedGrounding = buildHealthPlanRecommendationGrounding({
      plan: calibrated.plan,
      sourceSignals: [
        { id: "medication-plan", label: "Medication adherence issue", category: "medication", strength: "high" },
      ],
      reviewPriorities: {
        items: [
          { section_key: "monitoring_json", priority: "high", response_window: "today" },
        ],
      },
      recommendationSourceRanking: {
        items: [
          {
            section_key: "monitoring_json",
            item_id: "monitor-1",
            evidence_quality: "mixed",
            ranked_sources: [
              { signal_id: "medication-plan", label: "Medication adherence issue", authority_level: "medium" },
            ],
          },
        ],
      },
    });
    const calibrationSummary = buildHealthPlanRecommendationCalibrationSummary({
      adjustments: calibrated.adjustments,
      grounding: calibratedGrounding,
    });

    expect(calibrated.adjustments[0]).toMatchObject({
      section_key: "monitoring_json",
      requested_confidence: "high",
      applied_confidence: "medium",
      verification_required: true,
      verification_added: true,
      high_pressure: true,
    });
    expect(calibrated.plan?.monitoring_json?.[0]).toMatchObject({
      confidence: "medium",
      verification_required: true,
    });
    expect(calibrationSummary).toMatchObject({
      overall_status: "adjusted",
      adjustment_count: 1,
      confidence_downgrade_count: 1,
      verification_added_count: 1,
      high_pressure_adjustment_count: 1,
    });
  });
});
