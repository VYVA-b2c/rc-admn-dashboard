import { describe, expect, it } from "vitest";

import {
  buildHealthPlanOutreachNote,
  deriveHealthPlanOutreachStatus,
  parseHealthPlanOutreachNotes,
  stripHealthPlanOutreachNotes,
} from "@/lib/healthPlanOutreach";

describe("health plan outreach notes", () => {
  it("builds and parses structured outreach records", () => {
    const note = buildHealthPlanOutreachNote("client", "phone", { state: "ready", clientScript: [], careCircleScript: [], staffGuardrails: [] });
    const combined = [
      "[2026-06-18T10:00:00.000Z - mila@redcross.example] Call completed.",
      `[2026-06-18T11:00:00.000Z - mila@redcross.example] ${note}`,
    ].join("\n\n");

    const parsed = parseHealthPlanOutreachNotes(combined);

    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.audience).toBe("client");
    expect(parsed[0]?.channel).toBe("phone");
    expect(stripHealthPlanOutreachNotes(combined)).toBe("[2026-06-18T10:00:00.000Z - mila@redcross.example] Call completed.");
  });

  it("derives latest status by audience", () => {
    const entries = parseHealthPlanOutreachNotes([
      `[2026-06-18T09:00:00.000Z - mila@redcross.example] ${buildHealthPlanOutreachNote("client", "phone", { state: "ready", clientScript: [], careCircleScript: [], staffGuardrails: [] })}`,
      `[2026-06-18T10:00:00.000Z - mila@redcross.example] ${buildHealthPlanOutreachNote("care_circle", "whatsapp", { state: "review", clientScript: [], careCircleScript: [], staffGuardrails: [] })}`,
    ].join("\n\n"));

    const status = deriveHealthPlanOutreachStatus(entries);

    expect(status.clientShared).toBe(true);
    expect(status.careCircleShared).toBe(true);
    expect(status.latestClientShare?.channel).toBe("phone");
    expect(status.latestCareCircleShare?.channel).toBe("whatsapp");
  });
});
