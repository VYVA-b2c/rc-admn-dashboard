import { describe, expect, it } from "vitest";

import {
  buildHealthPlanConfirmationNote,
  deriveHealthPlanConfirmationStatus,
  findLatestHealthPlanConfirmationReceipt,
  parseHealthPlanConfirmationNotes,
  stripHealthPlanConfirmationNotes,
} from "@/lib/healthPlanConfirmations";

describe("healthPlanConfirmations", () => {
  it("parses saved confirmation receipts from note blocks", () => {
    const note = buildHealthPlanConfirmationNote({
      code: "confirm-medication-status",
      text: "Verify today's medication status.",
      priority: "high",
      due_window: "same_day",
    });

    const parsed = parseHealthPlanConfirmationNotes(`[2026-06-19T09:15:00.000Z - ana@redcross.example] ${note}`);
    expect(parsed).toEqual([
      {
        code: "confirm-medication-status",
        text: "Verify today's medication status.",
        priority: "high",
        dueWindow: "same_day",
        timestamp: "2026-06-19T09:15:00.000Z",
        author: "ana@redcross.example",
      },
    ]);
  });

  it("marks only the latest receipt per confirmation as current", () => {
    const items = [
      {
        code: "confirm-medication-status",
        text: "Verify today's medication status.",
        priority: "high" as const,
        due_window: "same_day" as const,
      },
      {
        code: "confirm-today-touchpoint",
        text: "Make a same-day touchpoint.",
        priority: "high" as const,
        due_window: "same_day" as const,
      },
    ];
    const notes = [
      `[2026-06-19T08:00:00.000Z - ana@redcross.example] ${buildHealthPlanConfirmationNote(items[0])}`,
      `[2026-06-19T09:30:00.000Z - mila@redcross.example] ${buildHealthPlanConfirmationNote(items[0])}`,
    ].join("\n\n");

    const statuses = deriveHealthPlanConfirmationStatus(items, parseHealthPlanConfirmationNotes(notes));

    expect(statuses[0]).toMatchObject({
      code: "confirm-medication-status",
      confirmed: true,
      confirmedAt: "2026-06-19T09:30:00.000Z",
      confirmedBy: "mila@redcross.example",
    });
    expect(statuses[1]).toMatchObject({
      code: "confirm-today-touchpoint",
      confirmed: false,
      confirmedAt: null,
      confirmedBy: null,
    });
  });

  it("finds the latest saved confirmation and strips system receipts from visible notes", () => {
    const first = buildHealthPlanConfirmationNote({
      code: "confirm-today-touchpoint",
      text: "Make a same-day touchpoint.",
      priority: "high",
      due_window: "same_day",
    });
    const second = buildHealthPlanConfirmationNote({
      code: "confirm-sensor-state",
      text: "Check whether the anomaly is device noise.",
      priority: "medium",
      due_window: "within_24h",
    });
    const combined = [
      `[2026-06-19T08:00:00.000Z - ana@redcross.example] ${first}`,
      "[2026-06-19T08:30:00.000Z - ana@redcross.example] Call family after consent update.",
      `[2026-06-19T10:00:00.000Z - mila@redcross.example] ${second}`,
    ].join("\n\n");

    const latest = findLatestHealthPlanConfirmationReceipt(parseHealthPlanConfirmationNotes(combined));

    expect(latest).toMatchObject({
      code: "confirm-sensor-state",
      author: "mila@redcross.example",
      timestamp: "2026-06-19T10:00:00.000Z",
    });
    expect(stripHealthPlanConfirmationNotes(combined)).toBe("[2026-06-19T08:30:00.000Z - ana@redcross.example] Call family after consent update.");
  });
});
