import { describe, expect, it } from "vitest";

import { deriveHealthPlanVersionDeltaBrief } from "@/lib/healthPlanVersionDelta";

describe("deriveHealthPlanVersionDeltaBrief", () => {
  it("summarizes the evidence and response shift behind a changed version", () => {
    const brief = deriveHealthPlanVersionDeltaBrief({
      summary_text: "Updated plan",
      source_signals_json: [
        { id: "alert-active", label: "1 active alert" },
        { id: "execution-stalled", label: "Follow-through appears stalled" },
        { id: "medication-plan", label: "1 medication on file" },
      ],
      change_summary_json: {
        changed_sections: ["monitoring", "escalation"],
        source_signals_added: ["execution-stalled"],
        source_signals_removed: ["sensor-status"],
        entries: [
          {
            code: "sections_updated",
            sections: ["monitoring", "escalation"],
            signal_ids: ["alert-active", "execution-stalled"],
          },
        ],
      },
      context_snapshot_json: {
        change_context: {
          highlight_signal_ids: ["execution-stalled"],
        },
        generation_contract: {
          must_name_alternate_route: true,
          must_name_completion_receipt: true,
        },
      },
      quality: {
        improvement_summary: {
          status: "mixed",
          summary_text: "The version adds stronger escalation language but still carries open follow-through work.",
        },
      },
      regeneration_focus: {
        focus_items: [
          { code: "contact_path_not_adapted", detail: "Name the alternate contact route if the current path keeps failing." },
        ],
      },
    });

    expect(brief?.status).toBe("mixed");
    expect(brief?.changedSectionCodes).toEqual(["monitoring", "escalation"]);
    expect(brief?.driverSignalLabels).toContain("Follow-through appears stalled");
    expect(brief?.responseShiftCodes).toEqual(expect.arrayContaining(["alternate_route", "completion_receipt"]));
    expect(brief?.unresolvedDetails).toContain("Name the alternate contact route if the current path keeps failing.");
    expect(brief?.sourceSignalsAdded).toBe(1);
    expect(brief?.sourceSignalsRemoved).toBe(1);
  });

  it("returns null when there is no meaningful delta information", () => {
    const brief = deriveHealthPlanVersionDeltaBrief({
      summary_text: "Baseline plan",
      change_summary_json: {
        changed_sections: [],
        entries: [],
      },
      source_signals_json: [],
    });

    expect(brief).toBeNull();
  });
});
