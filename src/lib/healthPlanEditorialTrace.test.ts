import { describe, expect, it } from "vitest";

import {
  annotateHealthPlanSectionsWithEditorialTrace,
  buildHealthPlanEditorialTrace,
  hasHighPriorityManualOverrideWithoutReason,
  shouldRejectHealthPlanEditorialTrace,
} from "./healthPlanEditorialTrace.js";

describe("health plan editorial trace", () => {
  it("marks generated items as AI-generated with original draft context", () => {
    const sections = annotateHealthPlanSectionsWithEditorialTrace(
      {
        goals_json: [{ id: "goal-1", text: "Keep morning routines stable.", source_signal_ids: ["service-checkins"] }],
      },
      {
        actionType: "generated",
        actorEmail: "system@vyva.app",
        recordedAt: "2026-06-20T12:00:00.000Z",
      },
    );

    expect(sections.goals_json[0]).toMatchObject({
      origin_type: "ai_generated",
      original_generated_text: "Keep morning routines stable.",
      original_generated_at: "2026-06-20T12:00:00.000Z",
      last_modified_by_email: "system@vyva.app",
    });
  });

  it("preserves original AI wording when staff edit an existing recommendation", () => {
    const sections = annotateHealthPlanSectionsWithEditorialTrace(
      {
        goals_json: [{ id: "goal-1", text: "Keep morning routines very stable this week.", source_signal_ids: ["service-checkins"] }],
      },
      {
        previousPlan: {
          goals_json: [
            {
              id: "goal-1",
              text: "Keep morning routines stable.",
              source_signal_ids: ["service-checkins"],
              origin_type: "ai_generated",
              original_generated_text: "Keep morning routines stable.",
              original_generated_at: "2026-06-19T10:00:00.000Z",
            },
          ],
        },
        actionType: "edited",
        actorEmail: "admin@vyva.app",
        recordedAt: "2026-06-20T12:00:00.000Z",
      },
    );

    expect(sections.goals_json[0]).toMatchObject({
      origin_type: "human_edited",
      original_generated_text: "Keep morning routines stable.",
      original_generated_at: "2026-06-19T10:00:00.000Z",
      last_modified_by_email: "admin@vyva.app",
    });
  });

  it("flags manual high-priority recommendations that lost evidence linkage", () => {
    const trace = buildHealthPlanEditorialTrace({
      plan: {
        escalation_json: [
          {
            id: "esc-1",
            text: "Escalate same day if no answer.",
            origin_type: "human_added",
            priority: "high",
            timing: "today",
            source_signal_ids: [],
          },
        ],
      },
    });

    expect(trace).toMatchObject({
      overall_status: "fragile",
      human_added_count: 1,
      evidence_detached_count: 1,
      high_priority_manual_count: 1,
    });
    expect(trace.issues[0]?.severity).toBe("high");
    expect(shouldRejectHealthPlanEditorialTrace(trace)).toBe(true);
  });

  it("requires a rationale for high-priority manual overrides", () => {
    const sections = annotateHealthPlanSectionsWithEditorialTrace(
      {
        escalation_json: [
          {
            id: "esc-1",
            text: "Escalate the same day if no answer comes after two attempts.",
            source_signal_ids: ["alert-active"],
            priority: "high",
            timing: "today",
          },
        ],
      },
      {
        previousPlan: {
          escalation_json: [
            {
              id: "esc-1",
              text: "Escalate the same day if no answer.",
              source_signal_ids: ["alert-active"],
              priority: "high",
              timing: "today",
              origin_type: "ai_generated",
              original_generated_text: "Escalate the same day if no answer.",
            },
          ],
        },
        actionType: "edited",
        actorEmail: "admin@vyva.app",
        recordedAt: "2026-06-20T12:00:00.000Z",
      },
    );

    const trace = buildHealthPlanEditorialTrace({ plan: sections });
    expect(trace.rationale_missing_count).toBe(1);
    expect(trace.issues.some((item) => item.type === "manual_high_priority_missing_rationale")).toBe(true);
    expect(hasHighPriorityManualOverrideWithoutReason(trace)).toBe(true);
  });
});
