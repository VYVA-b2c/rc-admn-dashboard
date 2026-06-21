import { describe, expect, it } from "vitest";

import { buildHealthPlanQualityMemory } from "./healthPlanQualityMemory.js";

describe("healthPlanQualityMemory", () => {
  it("extracts recurring risks, repeated refresh pressure, and durable patterns from saved quality snapshots", () => {
    const memory = buildHealthPlanQualityMemory({
      history: [
        {
          version_number: 3,
          review_status: "reviewed",
          review_note: "Monitoring still needed human caution because contact reliability stayed weak.",
          quality_snapshot_json: {
            candidate_selection: {
              attempted_count: 3,
              accepted_count: 2,
              rejected_count: 1,
              selection_summary: "Selected candidate-2 with a 5-point edge over the next-best accepted draft.",
              winner: {
                candidate_id: "candidate-2",
                score: 92,
                breakdown: {
                  trust_score: 94,
                  recommendation_coverage_score: 91,
                  recommendation_grounding_score: 89,
                  recommendation_evidence_diversity_score: 88,
                  calibration_penalty: 0,
                },
                acceptance: {
                  caution_count: 0,
                },
              },
            },
            confidence_profile: {
              section_confidence: [
                {
                  section_key: "monitoring_json",
                  max_confidence: "low",
                  reasons: [
                    { label: "Contact reliability still needs confirmation", severity: "high" },
                  ],
                },
              ],
            },
            review_governance: {
              review_required: true,
              review_window: "today",
              review_summary: "Same-day review is still required before reuse.",
              review_reasons_json: [
                { label: "Contact reliability still needs confirmation", severity: "high" },
              ],
            },
            evidence_conflicts: [
              { summary: "Risk remained elevated while follow-through looked incomplete", severity: "medium", section_key: "monitoring_json" },
            ],
            refresh_strategy: {
              refresh_now_section_keys: ["monitoring_json", "escalation_json"],
            },
            recommendation_survivorship: {
              durable: [
                { section_key: "daily_support_json", text: "Keep the morning hydration and medication routine.", reason: "This routine keeps helping." },
              ],
              fragile: [
                { section_key: "monitoring_json", text: "Rely on routine weekly follow-up only.", reason: "This became too weak once contact reliability dropped." },
              ],
            },
          },
        },
        {
          version_number: 2,
          quality_snapshot_json: {
            candidate_selection: {
              attempted_count: 2,
              accepted_count: 1,
              rejected_count: 1,
              selection_summary: "Selected candidate-1 as the only accepted draft.",
              winner: {
                candidate_id: "candidate-1",
                score: 74,
                breakdown: {
                  trust_score: 72,
                  recommendation_coverage_score: 75,
                  recommendation_grounding_score: 68,
                  recommendation_evidence_diversity_score: 66,
                  calibration_penalty: 6,
                },
                acceptance: {
                  caution_count: 3,
                },
              },
            },
            trust_verdict: {
              overall_status: "fragile",
            },
            review_readiness: {
              overall_status: "blocked",
            },
            operational_release: {
              overall_status: "blocked",
            },
            confidence_profile: {
              section_confidence: [
                {
                  section_key: "monitoring_json",
                  max_confidence: "medium",
                  reasons: [
                    { label: "Contact reliability still needs confirmation", severity: "medium" },
                  ],
                },
              ],
            },
            refresh_strategy: {
              refresh_now_section_keys: ["monitoring_json"],
            },
            evidence_conflicts: [
              { summary: "Risk remained elevated while follow-through looked incomplete", severity: "medium", section_key: "monitoring_json" },
            ],
          },
        },
      ],
    });

    expect(memory.recurring_quality_risks[0]).toMatchObject({
      label: "Contact reliability still needs confirmation",
      count: 3,
    });
    expect(memory.repeated_refresh_sections[0]).toMatchObject({
      section_key: "monitoring_json",
      count: 2,
    });
    expect(memory.durable_patterns[0]?.text).toMatch(/hydration and medication routine/i);
    expect(memory.fragile_patterns[0]?.section_key).toBe("monitoring_json");
    expect(memory.latest_review_judgment).toMatchObject({
      review_status: "reviewed",
      review_required: true,
      review_window: "today",
    });
    expect(memory.candidate_selection_memory).toMatchObject({
      held_up_count: 1,
      fragile_count: 1,
      latest_winner: {
        candidate_id: "candidate-2",
      },
    });
    expect(memory.candidate_selection_memory?.guardrails).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/coverage stayed explicit/i),
        expect.stringMatching(/avoid choosing a draft that sounds decisive without multiple live anchors/i),
      ]),
    );
  });

  it("returns a neutral memory when no snapshots exist", () => {
    const memory = buildHealthPlanQualityMemory();

    expect(memory).toMatchObject({
      summary: "No prior quality memory is available yet.",
      current_guardrails: [],
      recurring_quality_risks: [],
      candidate_selection_memory: null,
      durable_patterns: [],
      fragile_patterns: [],
    });
  });
});
