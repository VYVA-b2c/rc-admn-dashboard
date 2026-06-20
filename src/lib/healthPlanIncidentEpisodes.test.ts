import { describe, expect, it } from "vitest";

import {
  buildHealthPlanIncidentEpisodeNote,
  deriveHealthPlanIncidentEpisodeSummary,
  parseHealthPlanIncidentEpisodeNotes,
  stripHealthPlanIncidentEpisodeNotes,
} from "@/lib/healthPlanIncidentEpisodes";

describe("healthPlanIncidentEpisodes", () => {
  it("builds and parses incident episode notes", () => {
    const note = buildHealthPlanIncidentEpisodeNote("urgent_welfare_check", "open", {
      priority: "high",
      responseWindow: "same_day",
      sharingBoundary: "approved_circle",
      ownerName: "Ana Novak",
      ownerMissing: false,
      careCircleCount: 2,
      activeAlertCount: 2,
      offlineSensorCount: 0,
      missedMedication: false,
      highRisk: true,
      actions: [],
    });
    const combined = `[2026-06-18T09:00:00.000Z - ana@redcross.example] ${note}`;
    const parsed = parseHealthPlanIncidentEpisodeNotes(combined);

    expect(parsed).toEqual([
      {
        timestamp: "2026-06-18T09:00:00.000Z",
        author: "ana@redcross.example",
        code: "urgent_welfare_check",
        status: "open",
        ownerName: "Ana Novak",
        responseWindow: "same_day",
      },
    ]);
    expect(stripHealthPlanIncidentEpisodeNotes(combined)).toBeNull();
  });

  it("derives latest status per playbook", () => {
    const entries = parseHealthPlanIncidentEpisodeNotes([
      `[2026-06-18T09:00:00.000Z - ana@redcross.example] ${buildHealthPlanIncidentEpisodeNote("urgent_welfare_check", "open", null)}`,
      `[2026-06-18T10:00:00.000Z - ana@redcross.example] ${buildHealthPlanIncidentEpisodeNote("urgent_welfare_check", "closed", null)}`,
      `[2026-06-18T11:00:00.000Z - ana@redcross.example] ${buildHealthPlanIncidentEpisodeNote("medication_recovery", "open", null)}`,
    ].join("\n\n"));

    const summary = deriveHealthPlanIncidentEpisodeSummary(
      [
        {
          code: "urgent_welfare_check",
          priority: "high",
          responseWindow: "same_day",
          triggerReason: "",
          clientSteps: [],
          teamSteps: [],
          closeWhen: [],
          actionCode: "contact_client",
        },
        {
          code: "medication_recovery",
          priority: "high",
          responseWindow: "same_day",
          triggerReason: "",
          clientSteps: [],
          teamSteps: [],
          closeWhen: [],
          actionCode: "review_medication",
        },
        {
          code: "sensor_fallback",
          priority: "medium",
          responseWindow: "within_24h",
          triggerReason: "",
          clientSteps: [],
          teamSteps: [],
          closeWhen: [],
          actionCode: "check_sensors",
        },
      ],
      entries,
    );

    expect(summary).toEqual([
      {
        code: "urgent_welfare_check",
        status: "closed",
        latestEventAt: "2026-06-18T10:00:00.000Z",
        latestEventBy: "ana@redcross.example",
        ownerName: null,
      },
      {
        code: "medication_recovery",
        status: "open",
        latestEventAt: "2026-06-18T11:00:00.000Z",
        latestEventBy: "ana@redcross.example",
        ownerName: null,
      },
      {
        code: "sensor_fallback",
        status: "not_started",
        latestEventAt: null,
        latestEventBy: null,
        ownerName: null,
      },
    ]);
  });
});
