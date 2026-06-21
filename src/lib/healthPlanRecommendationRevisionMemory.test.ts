import { describe, expect, it } from "vitest";

import { buildHealthPlanRecommendationRevisionMemory } from "./healthPlanRecommendationRevisionMemory.js";

describe("healthPlanRecommendationRevisionMemory", () => {
  it("tracks improved, preserved, unresolved, and regressed recommendation rewrites", () => {
    const memory = buildHealthPlanRecommendationRevisionMemory({
      history: [
        {
          version_number: 4,
          daily_support_json: [
            { id: "daily-1", text: "Call each morning.", priority: "high", timing: "today" },
            { id: "daily-2", text: "Keep hydration visible at breakfast.", priority: "medium", timing: "ongoing" },
          ],
          monitoring_json: [
            { id: "monitor-1", text: "Verify evening dose confirmation.", priority: "medium", timing: "today" },
          ],
          escalation_json: [],
          caregiver_guidance_json: [],
          goals_json: [],
          quality_snapshot_json: {
            recommendation_repair: {
              items: [
                {
                  item_id: "daily-1",
                  section_key: "daily_support_json",
                  text: "Call each morning.",
                  recommended_action: "preserve",
                  reason: "Morning outreach has become one of the most reliable anchors.",
                },
                {
                  item_id: "daily-2",
                  section_key: "daily_support_json",
                  text: "Keep hydration visible at breakfast.",
                  recommended_action: "preserve",
                  reason: "This still fits the live pattern without new contradictions.",
                },
                {
                  item_id: "monitor-1",
                  section_key: "monitoring_json",
                  text: "Verify evening dose confirmation.",
                  recommended_action: "verify",
                  reason: "Evening adherence still needs explicit confirmation.",
                },
              ],
            },
            recommendation_grounding: {
              items: [
                {
                  item_id: "daily-1",
                  section_key: "daily_support_json",
                  text: "Call each morning.",
                  grounding_status: "strong",
                },
                {
                  item_id: "daily-2",
                  section_key: "daily_support_json",
                  text: "Keep hydration visible at breakfast.",
                  grounding_status: "strong",
                },
                {
                  item_id: "monitor-1",
                  section_key: "monitoring_json",
                  text: "Verify evening dose confirmation.",
                  grounding_status: "guarded",
                  staff_note: "Do not assume the evening routine is stable yet.",
                },
              ],
            },
            recommendation_challenges: {
              items: [
                {
                  item_id: "daily-1",
                  section_key: "daily_support_json",
                  text: "Call each morning.",
                  challenge_status: "supported",
                },
                {
                  item_id: "daily-2",
                  section_key: "daily_support_json",
                  text: "Keep hydration visible at breakfast.",
                  challenge_status: "supported",
                },
                {
                  item_id: "monitor-1",
                  section_key: "monitoring_json",
                  text: "Verify evening dose confirmation.",
                  challenge_status: "guarded",
                  why_it_is_questioned: "The live medication picture is still uneven across the week.",
                },
              ],
            },
            recommendation_survivorship: {
              durable: [
                {
                  section_key: "daily_support_json",
                  text: "Call each morning.",
                  reason: "This routine has survived several versions and still helps.",
                },
              ],
              emerging: [
                {
                  section_key: "daily_support_json",
                  text: "Keep hydration visible at breakfast.",
                },
              ],
              fragile: [
                {
                  section_key: "monitoring_json",
                  text: "Verify evening dose confirmation.",
                },
              ],
              retired: [
                {
                  section_key: "daily_support_json",
                  text: "Use the old weak reminder.",
                },
              ],
            },
          },
        },
        {
          version_number: 3,
          daily_support_json: [
            { id: "daily-1", text: "Call each morning.", priority: "medium", timing: "ongoing" },
            { id: "daily-2", text: "Keep hydration visible at breakfast.", priority: "medium", timing: "ongoing" },
            { id: "daily-old", text: "Use the old weak reminder.", priority: "low", timing: "ongoing" },
          ],
          monitoring_json: [],
          escalation_json: [],
          caregiver_guidance_json: [],
          goals_json: [],
          recommendation_learning_json: [
            {
              item_id: "daily-old",
              section_key: "daily_support_json",
              text: "Use the old weak reminder.",
              reuse_priority: "replace",
              reason: "This reminder kept failing in live follow-through.",
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
                  ranked_sources: [{ label: "Low-response trend" }],
                },
                {
                  item_id: "daily-2",
                  section_key: "daily_support_json",
                  text: "Keep hydration visible at breakfast.",
                  evidence_quality: "strong",
                  ranked_sources: [{ label: "Breakfast routine" }],
                },
                {
                  item_id: "daily-old",
                  section_key: "daily_support_json",
                  text: "Use the old weak reminder.",
                  evidence_quality: "thin",
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
        {
          version_number: 2,
          daily_support_json: [
            { id: "daily-1", text: "Call each morning.", priority: "medium", timing: "ongoing" },
            { id: "daily-2", text: "Keep hydration visible at breakfast.", priority: "medium", timing: "ongoing" },
          ],
          monitoring_json: [],
          escalation_json: [],
          caregiver_guidance_json: [],
          goals_json: [],
          quality_snapshot_json: {
            recommendation_source_ranking: {
              items: [
                {
                  item_id: "daily-1",
                  section_key: "daily_support_json",
                  text: "Call each morning.",
                  evidence_quality: "strong",
                  ranked_sources: [{ label: "Morning missed check-ins" }],
                },
                {
                  item_id: "daily-2",
                  section_key: "daily_support_json",
                  text: "Keep hydration visible at breakfast.",
                  evidence_quality: "strong",
                  ranked_sources: [{ label: "Breakfast routine" }],
                },
              ],
            },
          },
        },
      ],
    });

    expect(memory).toMatchObject({
      improved_count: 1,
      preserved_count: 1,
      unresolved_count: 1,
      regressed_count: 1,
    });
    expect(memory.improved[0]).toMatchObject({
      text: "Call each morning.",
      status: "improved",
      current_repair_action: "preserve",
    });
    expect(memory.preserved[0]).toMatchObject({
      text: "Keep hydration visible at breakfast.",
      status: "preserved",
    });
    expect(memory.unresolved[0]).toMatchObject({
      text: "Verify evening dose confirmation.",
      status: "unresolved",
      current_repair_action: "verify",
    });
    expect(memory.regressed[0]).toMatchObject({
      text: "Use the old weak reminder.",
      status: "regressed",
      present_in_current: false,
    });
  });

  it("carries manual override rationale into revision memory for human-edited high-risk recommendations", () => {
    const memory = buildHealthPlanRecommendationRevisionMemory({
      history: [
        {
          version_number: 2,
          monitoring_json: [
            {
              id: "monitor-1",
              text: "Escalate same day after two failed contact attempts.",
              priority: "high",
              timing: "today",
              origin_type: "human_edited",
              edit_reason: "The live alert pattern worsened, so the escalation wording was tightened for same-day action.",
            },
          ],
          goals_json: [],
          daily_support_json: [],
          escalation_json: [],
          caregiver_guidance_json: [],
        },
        {
          version_number: 1,
          monitoring_json: [
            {
              id: "monitor-1",
              text: "Escalate if contact continues to fail.",
              priority: "high",
              timing: "today",
              origin_type: "ai_generated",
            },
          ],
          goals_json: [],
          daily_support_json: [],
          escalation_json: [],
          caregiver_guidance_json: [],
        },
      ],
    });

    expect(memory.improved[0] || memory.unresolved[0] || memory.preserved[0]).toMatchObject({
      manual_override_reason: "The live alert pattern worsened, so the escalation wording was tightened for same-day action.",
    });
  });
});
