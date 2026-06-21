import { describe, expect, it } from "vitest";

import { buildHealthPlanExecutionBrief } from "./healthPlanExecutionBrief.js";

describe("healthPlanExecutionBrief", () => {
  it("surfaces same-day staff handoff actions in urgency order", () => {
    const result = buildHealthPlanExecutionBrief({
      plan: {
        daily_support_json: [
          {
            id: "daily-1",
            text: "Call Carmen this morning to confirm dizziness, hydration, and whether the medication plan was understood.",
            priority: "high",
            timing: "today",
            verification_required: true,
            source_signal_ids: ["signal-checkin", "signal-dizzy"],
          },
        ],
        monitoring_json: [
          {
            id: "monitor-1",
            text: "Re-check the fall sensor and medication confidence if contact is shorter than usual again today.",
            priority: "high",
            timing: "today",
            verification_required: true,
            source_signal_ids: ["signal-sensor", "signal-medication"],
          },
        ],
        escalation_json: [
          {
            id: "escalation-1",
            text: "Escalate the same day if dizziness worsens or contact still fails after the first attempt.",
            priority: "high",
            timing: "today",
            verification_required: true,
            fallback_owner_role: "on_call_coordinator",
            source_signal_ids: ["signal-dizzy", "signal-reachability"],
          },
        ],
        caregiver_guidance_json: [
          {
            id: "caregiver-1",
            text: "Ask Maria to attempt contact today and report back to the team if Carmen still does not answer.",
            priority: "medium",
            timing: "today",
            source_signal_ids: ["signal-caregiver", "signal-reachability"],
          },
        ],
      },
      reviewPriorities: {
        items: [
          { section_key: "escalation_json", priority: "high", response_window: "today", why_now: "Same-day response pressure is present here and should be checked for concrete wording and ownership." },
          { section_key: "monitoring_json", priority: "high", response_window: "today", why_now: "Monitoring needs explicit same-day verification because the live signal mix is unstable." },
        ],
      },
      escalationGrade: { grade: "urgent" },
      liveEvidenceSummary: {
        contact_pressure: { status: "pressure", summary: "Reachability is unreliable right now." },
        medication_adherence: { status: "watch", summary: "Medication confidence is still mixed." },
      },
    });

    expect(result?.overall_status).toBe("same_day");
    expect(result?.actions[0]).toEqual(
      expect.objectContaining({
        section_key: "escalation_json",
        owner_role: "on_call_coordinator",
        response_window: "today",
        verification_required: true,
        completion_signal: expect.stringMatching(/close the loop/i),
      }),
    );
    expect(result?.same_day_count).toBeGreaterThanOrEqual(3);
  });

  it("flags missing fallback or report-back clarity in the surfaced handoff", () => {
    const result = buildHealthPlanExecutionBrief({
      plan: {
        escalation_json: [
          {
            id: "escalation-1",
            text: "Escalate today if Carmen still cannot be reached.",
            priority: "high",
            timing: "today",
            source_signal_ids: ["signal-reachability"],
          },
        ],
        caregiver_guidance_json: [
          {
            id: "caregiver-1",
            text: "Ask Maria to check on Carmen today.",
            priority: "medium",
            timing: "today",
            source_signal_ids: ["signal-caregiver"],
          },
        ],
      },
      reviewPriorities: {
        items: [
          { section_key: "escalation_json", priority: "high", response_window: "today", why_now: "Same-day escalation pressure is present." },
        ],
      },
      escalationGrade: { grade: "urgent" },
      liveEvidenceSummary: {
        contact_pressure: { status: "pressure", summary: "Contact attempts are failing." },
      },
    });

    expect(result?.gaps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ section_key: "escalation_json", label: expect.stringMatching(/fallback owner/i) }),
        expect.objectContaining({ section_key: "caregiver_guidance_json", label: expect.stringMatching(/report-back/i) }),
      ]),
    );
    expect(result?.actions.find((item) => item.section_key === "caregiver_guidance_json")?.completion_signal).toMatch(/caregiver reports back/i);
  });
});
