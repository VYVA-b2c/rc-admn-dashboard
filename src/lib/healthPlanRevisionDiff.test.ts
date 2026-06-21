import { describe, expect, it } from "vitest";

import { annotateHealthPlanHistory, buildHealthPlanRevisionChange } from "./healthPlanRevisionDiff.js";

describe("health plan revision diff", () => {
  it("marks the first stored version as a material baseline", () => {
    const change = buildHealthPlanRevisionChange({
      version_number: 1,
      summary_text: "Initial plan",
      goals_json: [{ text: "Keep routines stable.", priority: "medium" }],
      daily_support_json: [{ text: "Call each morning.", priority: "high" }],
      monitoring_json: [],
      escalation_json: [],
      caregiver_guidance_json: [],
      review_status: "draft",
    });

    expect(change).toMatchObject({
      previous_version_number: null,
      summary_changed: true,
      materially_changed: true,
      added_items: 2,
      high_priority_delta: 1,
    });
    expect(change.recommendation_changes?.added_count).toBe(2);
    expect(change.recommendation_changes?.highlights?.[0]?.action).toBe("added");
    expect(change.recommendation_changes?.thin_justification_count).toBe(2);
  });

  it("captures added, removed, and rewritten items between versions", () => {
    const change = buildHealthPlanRevisionChange(
      {
        version_number: 3,
        summary_text: "Updated plan",
        goals_json: [{ text: "Keep routines stable.", priority: "medium" }],
        daily_support_json: [{ text: "Call each morning.", priority: "high" }],
        monitoring_json: [{ text: "Watch for dizziness today.", priority: "high" }],
        escalation_json: [],
        caregiver_guidance_json: [],
        review_status: "reviewed",
      },
      {
        version_number: 2,
        summary_text: "Earlier plan",
        goals_json: [{ text: "Keep routines steady.", priority: "medium" }],
        daily_support_json: [{ text: "Call each morning.", priority: "medium" }],
        monitoring_json: [],
        escalation_json: [],
        caregiver_guidance_json: [],
        review_status: "draft",
      },
    );

    expect(change.changed_sections).toEqual(expect.arrayContaining(["summary", "goals_json", "monitoring_json"]));
    expect(change.added_items).toBe(2);
    expect(change.removed_items).toBe(1);
    expect(change.rewritten_items).toBeGreaterThanOrEqual(1);
    expect(change.high_priority_delta).toBe(2);
    expect(change.review_status_changed).toBe(true);
  });

  it("explains preserved, tightened, and replaced recommendation-level changes", () => {
    const change = buildHealthPlanRevisionChange(
      {
        version_number: 4,
        summary_text: "Updated plan",
        goals_json: [],
        daily_support_json: [
          { id: "daily-1", text: "Call each morning.", priority: "high", timing: "today" },
          { id: "daily-2", text: "Add caregiver backup call.", priority: "high", timing: "today" },
        ],
        monitoring_json: [],
        escalation_json: [],
        caregiver_guidance_json: [],
        review_status: "draft",
        recommendation_learning_json: [
          {
            item_id: "daily-1",
            section_key: "daily_support_json",
            text: "Call each morning.",
            reuse_priority: "preserve",
            reason: "Recent morning contact reduced missed check-ins.",
          },
        ],
        quality_snapshot_json: {
          recommendation_source_ranking: {
            items: [
              {
                item_id: "daily-1",
                section_key: "daily_support_json",
                text: "Call each morning.",
                evidence_quality: "strong",
                top_summary: "Morning missed check-ins are now the strongest evidence.",
                ranked_sources: [{ label: "Morning missed check-ins" }],
              },
              {
                item_id: "daily-2",
                section_key: "daily_support_json",
                text: "Add caregiver backup call.",
                evidence_quality: "mixed",
                top_summary: "Caregiver availability now supports adding backup coverage.",
                ranked_sources: [{ label: "Caregiver availability" }],
              },
            ],
          },
          recommendation_effectiveness: {
            preserve_now: [
              {
                item_id: "daily-1",
                section_key: "daily_support_json",
                text: "Call each morning.",
                action_reason: "This routine has already helped.",
              },
            ],
          },
        },
      },
      {
        version_number: 3,
        summary_text: "Earlier plan",
        goals_json: [],
        daily_support_json: [
          { id: "daily-1", text: "Call each morning.", priority: "medium", timing: "ongoing" },
          { id: "daily-old", text: "Use the old weak reminder.", priority: "low", timing: "ongoing" },
        ],
        monitoring_json: [],
        escalation_json: [],
        caregiver_guidance_json: [],
        review_status: "draft",
        recommendation_learning_json: [
          {
            item_id: "daily-old",
            section_key: "daily_support_json",
            text: "Use the old weak reminder.",
            reuse_priority: "replace",
            reason: "This recommendation repeatedly failed.",
          },
        ],
        quality_snapshot_json: {
          recommendation_source_ranking: {
            items: [
              {
                item_id: "daily-1",
                section_key: "daily_support_json",
                text: "Call each morning.",
                evidence_quality: "mixed",
                top_summary: "Low-response trend was the previous top signal.",
                ranked_sources: [{ label: "Low-response trend" }],
              },
              {
                item_id: "daily-old",
                section_key: "daily_support_json",
                text: "Use the old weak reminder.",
                evidence_quality: "thin",
                top_summary: "The old reminder mostly leaned on stale context.",
                ranked_sources: [{ label: "Stale context" }],
              },
            ],
          },
          recommendation_effectiveness: {
            retire_now: [
              {
                item_id: "daily-old",
                section_key: "daily_support_json",
                text: "Use the old weak reminder.",
                action_reason: "This reminder should be retired.",
              },
            ],
          },
        },
      },
    );

    expect(change.recommendation_changes).toMatchObject({
      added_count: 1,
      preserved_count: 0,
      tightened_count: 1,
      replaced_count: 1,
      evidence_backed_count: 3,
      learning_backed_count: 0,
      thin_justification_count: 0,
    });
    expect(change.recommendation_changes?.highlights).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "tightened",
          text: "Call each morning.",
          evidence_shift: "Top evidence moved from Low-response trend to Morning missed check-ins. Evidence quality improved from mixed to strong.",
          learning_shift: "Recent morning contact reduced missed check-ins.",
          justification_status: "evidence_backed",
        }),
        expect.objectContaining({
          action: "replaced",
          text: "Use the old weak reminder.",
          evidence_shift: "The earlier version leaned most on Stale context. Earlier evidence quality was thin.",
          learning_shift: "This recommendation repeatedly failed.",
          justification_status: "evidence_backed",
        }),
        expect.objectContaining({
          action: "added",
          text: "Add caregiver backup call.",
          evidence_shift: "Caregiver availability is now the clearest evidence behind this recommendation. Evidence quality is currently mixed.",
          justification_status: "evidence_backed",
        }),
      ]),
    );
  });

  it("marks manual overrides and thinly justified additions distinctly", () => {
    const change = buildHealthPlanRevisionChange(
      {
        version_number: 2,
        summary_text: "Updated plan",
        goals_json: [
          {
            id: "goal-1",
            text: "Keep a manual afternoon reassurance call.",
            priority: "medium",
            timing: "this_week",
            origin_type: "human_edited",
            edit_reason: "Family asked for a calmer afternoon touchpoint while trust rebuilds.",
          },
        ],
        daily_support_json: [
          { id: "daily-1", text: "Check whether the routine still feels supportive.", priority: "low", timing: "ongoing" },
        ],
        monitoring_json: [],
        escalation_json: [],
        caregiver_guidance_json: [],
        review_status: "draft",
      },
      {
        version_number: 1,
        summary_text: "Earlier plan",
        goals_json: [],
        daily_support_json: [],
        monitoring_json: [],
        escalation_json: [],
        caregiver_guidance_json: [],
        review_status: "draft",
      },
    );

    expect(change.recommendation_changes).toMatchObject({
      added_count: 2,
      manual_override_count: 1,
      thin_justification_count: 1,
    });
    expect(change.recommendation_changes?.highlights).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          text: "Keep a manual afternoon reassurance call.",
          justification_status: "manual_override",
        }),
        expect.objectContaining({
          text: "Check whether the routine still feels supportive.",
          justification_status: "thin",
        }),
      ]),
    );
  });

  it("annotates newest-first revision history with per-version change objects", () => {
    const revisions = annotateHealthPlanHistory([
      {
        version_number: 2,
        created_at: "2026-06-19T10:00:00.000Z",
        summary_text: "Version two",
        goals_json: [{ text: "Goal A", priority: "high" }],
        daily_support_json: [],
        monitoring_json: [],
        escalation_json: [],
        caregiver_guidance_json: [],
        review_status: "draft",
      },
      {
        version_number: 1,
        created_at: "2026-06-18T10:00:00.000Z",
        summary_text: "Version one",
        goals_json: [{ text: "Goal B", priority: "low" }],
        daily_support_json: [],
        monitoring_json: [],
        escalation_json: [],
        caregiver_guidance_json: [],
        review_status: "draft",
      },
    ]);

    expect(revisions[0].version_number).toBe(2);
    expect(revisions[0].change.previous_version_number).toBe(1);
    expect(revisions[1].change.previous_version_number).toBe(null);
  });
});
