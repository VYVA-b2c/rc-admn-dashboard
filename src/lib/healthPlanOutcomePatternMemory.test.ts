import { describe, expect, it } from "vitest";

import { buildHealthPlanOutcomePatternMemory } from "./healthPlanOutcomePatternMemory.js";

describe("healthPlanOutcomePatternMemory", () => {
  it("summarizes cross-version response anchors, routines, and pressured sections", () => {
    const memory = buildHealthPlanOutcomePatternMemory({
      history: [
        {
          version_number: 3,
          quality_snapshot_json: {
            client_response_memory: {
              strongest_anchors: [
                { category: "service", labels: ["Check-ins"], reason: "These routines keep landing.", response_profile: "responsive" },
              ],
              fragile_anchors: [
                { category: "medication", labels: ["Medication follow-through"], reason: "This area remains unreliable.", response_profile: "fragile" },
              ],
            },
            recommendation_effectiveness: {
              preserve_now: [
                {
                  section_key: "daily_support_json",
                  section_label: "Daily support",
                  text: "Keep the morning check-in routine.",
                  action_reason: "It keeps helping the client stay oriented.",
                },
              ],
              rework_now: [
                {
                  section_key: "monitoring_json",
                  section_label: "Monitoring",
                  text: "Verify medication completion before assuming stability.",
                  action: "verify",
                  action_reason: "Medication completion still needs direct confirmation.",
                },
              ],
              retire_now: [
                {
                  section_key: "monitoring_json",
                  section_label: "Monitoring",
                  text: "Rely on weekly medication self-report only.",
                  action: "retire",
                  action_reason: "This missed fresh adherence problems.",
                },
              ],
            },
            section_outcomes: [
              {
                section_key: "monitoring_json",
                status: "fragile",
                trend: "weakening",
                evidence_balance: "caution",
                operational_learning_summary: "Monitoring wording is not holding up reliably and should be rewritten before reuse.",
              },
            ],
            intervention_memory: [
              {
                id: "daily-support-routine",
                label: "Daily support routine",
                status: "helping",
                reason: "Staff recorded that this routine helped in practice.",
                section_labels: ["Daily support"],
              },
              {
                id: "medication-routine",
                label: "Medication routine",
                status: "fragile",
                reason: "Medication follow-through remains unreliable.",
                section_labels: ["Daily support", "Monitoring"],
              },
            ],
          },
        },
        {
          version_number: 2,
          quality_snapshot_json: {
            client_response_memory: {
              strongest_anchors: [
                { category: "service", labels: ["Check-ins"], reason: "Check-ins are still landing better than other routines.", response_profile: "mostly_responsive" },
              ],
              fragile_anchors: [
                { category: "medication", labels: ["Medication follow-through"], reason: "Medication follow-through is still breaking down.", response_profile: "unreliable" },
              ],
            },
            recommendation_effectiveness: {
              preserve_now: [
                {
                  section_key: "daily_support_json",
                  section_label: "Daily support",
                  text: "Keep the morning check-in routine.",
                  action_reason: "It helped repeatedly in the prior cycle.",
                },
              ],
              rework_now: [
                {
                  section_key: "monitoring_json",
                  section_label: "Monitoring",
                  text: "Verify medication completion before assuming stability.",
                  action: "rework",
                  action_reason: "Monitoring still needs tighter proof.",
                },
              ],
              retire_now: [
                {
                  section_key: "monitoring_json",
                  section_label: "Monitoring",
                  text: "Rely on weekly medication self-report only.",
                  action: "retire",
                  action_reason: "This failed to catch fresh medication misses.",
                },
              ],
            },
            section_outcomes: [
              {
                section_key: "monitoring_json",
                status: "fragile",
                trend: "weakening",
                evidence_balance: "caution",
                operational_learning_summary: "Monitoring stayed under caution pressure.",
              },
            ],
            intervention_memory: [
              {
                id: "daily-support-routine",
                label: "Daily support routine",
                status: "helping",
                reason: "This routine still looks dependable.",
                section_labels: ["Daily support"],
              },
              {
                id: "medication-routine",
                label: "Medication routine",
                status: "fragile",
                reason: "Medication support is still fragile.",
                section_labels: ["Daily support", "Monitoring"],
              },
            ],
          },
        },
      ],
    });

    expect(memory.stable_response_anchors[0]).toMatchObject({
      category: "service",
      stable_count: 2,
    });
    expect(memory.fragile_response_anchors[0]).toMatchObject({
      category: "medication",
      fragile_count: 2,
    });
    expect(memory.preserve_patterns[0]).toMatchObject({
      section_key: "daily_support_json",
      preserve_count: 2,
    });
    expect(memory.watch_patterns[0]).toMatchObject({
      section_key: "monitoring_json",
      watch_count: 2,
    });
    expect(memory.replace_patterns[0]).toMatchObject({
      section_key: "monitoring_json",
      replace_count: 2,
    });
    expect(memory.unstable_sections[0]).toMatchObject({
      section_key: "monitoring_json",
      pressure_count: 2,
      fragile_count: 2,
    });
    expect(memory.stable_domains[0]).toMatchObject({
      id: "daily-support-routine",
      helping_count: 2,
    });
    expect(memory.fragile_domains[0]).toMatchObject({
      id: "medication-routine",
      fragile_count: 2,
    });
    expect(memory.guardrails).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/check-ins/i),
        expect.stringMatching(/medication follow-through/i),
        expect.stringMatching(/rely on weekly medication self-report only/i),
        expect.stringMatching(/monitoring has stayed under outcome pressure/i),
      ]),
    );
  });

  it("returns a neutral memory when no revisions are available", () => {
    const memory = buildHealthPlanOutcomePatternMemory();

    expect(memory).toMatchObject({
      summary: "No cross-version outcome pattern memory is available yet.",
      total_revisions: 0,
      stable_response_anchors: [],
      fragile_response_anchors: [],
      preserve_patterns: [],
      watch_patterns: [],
      replace_patterns: [],
      unstable_sections: [],
      guardrails: [],
    });
  });

  it("prefers the current plan over a same-version revision and localizes copy from plan language", () => {
    const memory = buildHealthPlanOutcomePatternMemory({
      existingPlan: {
        current_version: 4,
        language: "de",
        quality_snapshot_json: {
          recommendation_effectiveness: {
            preserve_now: [
              {
                section_key: "daily_support_json",
                text: "Morgendliche Check-ins beibehalten.",
                action_reason: "Die aktuelle Version soll Vorrang haben.",
              },
            ],
          },
        },
      },
      history: [
        {
          version_number: 4,
          language: "de",
          quality_snapshot_json: {
            recommendation_effectiveness: {
              retire_now: [
                {
                  section_key: "daily_support_json",
                  text: "Morgendliche Check-ins beibehalten.",
                  action_reason: "Aeltere Revisionskopie sollte nicht gewinnen.",
                },
              ],
            },
          },
        },
      ],
    });

    expect(memory.summary).toMatch(/Beibehalten-Muster/i);
    expect(memory.preserve_patterns[0]).toMatchObject({
      section_key: "daily_support_json",
      preserve_count: 1,
    });
    expect(memory.replace_patterns).toHaveLength(0);
    expect(memory.guardrails).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/bewaehrt|Vorrang|beibehalten/i),
      ]),
    );
  });
});
