import { describe, expect, it } from "vitest";

import { buildHealthPlanLongitudinalMemory } from "./healthPlanLongitudinalMemory.js";

describe("healthPlanLongitudinalMemory", () => {
  it("turns repeating live-evidence pressure across revisions into persistent pattern memory", () => {
    const memory = buildHealthPlanLongitudinalMemory({
      liveEvidenceSummary: {
        contact_pressure: {
          status: "pressure",
          windows: { trend: "worsening" },
          summary: "Reachability is under pressure because recent contact attempts are repeatedly failing.",
        },
        medication_adherence: {
          status: "watch",
          windows: { trend: "mixed" },
          summary: "Medication adherence has some uncertainty and still needs verification.",
        },
        sensor_reliability: {
          status: "stable",
          windows: { trend: "steady" },
          summary: "Sensor coverage looks comparatively reliable right now.",
        },
      },
      history: [
        {
          version_number: 3,
          quality_snapshot_json: {
            live_evidence_summary: {
              contact_pressure: { status: "pressure", windows: { trend: "worsening" } },
              medication_adherence: { status: "watch", windows: { trend: "mixed" } },
            },
          },
        },
        {
          version_number: 2,
          quality_snapshot_json: {
            live_evidence_summary: {
              contact_pressure: { status: "watch", windows: { trend: "mixed" } },
              medication_adherence: { status: "watch", windows: { trend: "mixed" } },
            },
          },
        },
      ],
    });

    expect(memory.summary).toMatch(/persistent pattern|resurfacing/i);
    expect(memory.persistent_count).toBeGreaterThan(0);
    expect(memory.domains[0]).toMatchObject({
      key: "contact",
      status: "persistent_pressure",
    });
    expect(memory.domains.some((item) => item.key === "medication" && item.status === "recurrent_watch")).toBe(true);
  });
});
