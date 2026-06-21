import { describe, expect, it } from "vitest";

import { attachHealthPlanEvidenceReceipts } from "./healthPlanEvidenceReceipts.js";

describe("health plan evidence receipts", () => {
  const sourceSignals = [
    { id: "alert-active", label: "2 active alerts", category: "alert", strength: "high" },
    { id: "risk-latest-score", label: "Predictive risk score 82 (high)", category: "risk", strength: "high" },
    { id: "service-checkins", label: "Check-ins enabled", category: "service", strength: "medium" },
  ];

  it("builds a compact evidence receipt from ranked, grounded, and challenged recommendation context", () => {
    const sections = attachHealthPlanEvidenceReceipts(
      {
        escalation_json: [
          {
            id: "escalation-1",
            text: "Escalate today if Carmen cannot be reached after repeated alerts.",
            source_signal_ids: ["alert-active", "risk-latest-score"],
            verification_required: true,
          },
        ],
      },
      {
        sourceSignals,
        signalTriage: {
          action_signal_ids: ["alert-active", "risk-latest-score"],
          verification_signal_ids: ["alert-active"],
        },
        qualitySnapshot: {
          recommendation_source_ranking: {
            items: [
              {
                section_key: "escalation_json",
                item_id: "escalation-1",
                evidence_quality: "strong",
                ranked_sources: [
                  { signal_id: "alert-active", label: "2 active alerts", authority_level: "high" },
                  { signal_id: "risk-latest-score", label: "Predictive risk score 82 (high)", authority_level: "medium" },
                ],
              },
            ],
          },
          recommendation_grounding: {
            items: [
              {
                section_key: "escalation_json",
                item_id: "escalation-1",
                grounding_status: "guarded",
                staff_note: "This recommendation is usable, but staff should verify the live picture before leaning on it heavily.",
              },
            ],
          },
          recommendation_challenges: {
            items: [
              {
                section_key: "escalation_json",
                item_id: "escalation-1",
                challenge_status: "challenged",
                why_it_is_questioned: "It does not say what staff should do if the first step fails or the signal worsens.",
              },
            ],
          },
          recommendation_impact: {
            items: [
              {
                section_key: "escalation_json",
                item_id: "escalation-1",
                impact_status: "mixed",
                reason: "Some recent signals support escalation, but missed touchpoints are still competing with them.",
              },
            ],
          },
        },
      },
    );

    expect(sections.escalation_json[0].evidence_receipt).toMatchObject({
      trust_level: "guarded",
      support_mode: "action",
      driver_signal_ids: ["alert-active", "risk-latest-score"],
      driver_labels: ["2 active alerts", "Predictive risk score 82 (high)"],
      attention_status: "mixed",
      attention_note: "Some recent signals support escalation, but missed touchpoints are still competing with them.",
    });
    expect(sections.escalation_json[0].evidence_receipt.summary).toContain("Driven mainly by 2 active alerts and Predictive risk score 82 (high).");
    expect(sections.escalation_json[0].evidence_receipt.summary).toContain("verify the live picture");
  });

  it("falls back to linked signals and triage mode when no quality snapshot is available yet", () => {
    const sections = attachHealthPlanEvidenceReceipts(
      {
        daily_support_json: [
          {
            id: "daily-1",
            text: "Keep the daily check-in at the current morning time.",
            source_signal_ids: ["service-checkins"],
          },
        ],
      },
      {
        sourceSignals,
        signalTriage: {
          stabilizing_signal_ids: ["service-checkins"],
        },
      },
    );

    expect(sections.daily_support_json[0].evidence_receipt).toMatchObject({
      trust_level: "fragile",
      support_mode: "stabilizing",
      driver_signal_ids: ["service-checkins"],
      driver_labels: ["Check-ins enabled"],
      attention_status: null,
      attention_note: null,
    });
    expect(sections.daily_support_json[0].evidence_receipt.summary).toContain("Preserving a routine supported by Check-ins enabled.");
  });
});
