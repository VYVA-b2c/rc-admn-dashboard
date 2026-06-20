import { describe, expect, it } from "vitest";

import {
  buildHealthPlanHandoffStatusNote,
  buildHealthPlanHandoffNote,
  deriveHealthPlanHandoffProgress,
  deriveHealthPlanHandoff,
  parseHealthPlanHandoffNotes,
  parseHealthPlanHandoffStatusNotes,
  stripHealthPlanSystemNotes,
} from "@/lib/healthPlanHandoff";

describe("deriveHealthPlanHandoff", () => {
  it("escalates to same-day follow-up when high-risk signals and care gaps are present", () => {
    const handoff = deriveHealthPlanHandoff({
      consent: { caretaker_consent: false },
      medicationActivity: { status: "missed" },
      alerts: [{ id: "a1", severity: "high", message: "Missed check-in" }],
      sensors: [{ id: "s1", status: "offline" }],
      careProviders: [],
      checkins: { enabled: true },
      brainCoach: { enabled: false },
      healthPlan: {
        id: "hp1",
        source_signals_json: [{ id: "risk-latest-score", label: "Risk", category: "risk", strength: "high" }],
      },
    });

    expect(handoff.priority).toBe("high");
    expect(handoff.responseWindow).toBe("same_day");
    expect(handoff.sharingBoundary).toBe("staff_only");
    expect(handoff.ownerMissing).toBe(true);
    expect(handoff.actions.map((action) => action.code)).toEqual([
      "confirm_today_touchpoint",
      "review_alerts",
      "verify_medication",
      "check_sensors",
      "assign_owner",
      "confirm_sharing_boundary",
    ]);
  });

  it("stays lighter when an owner exists and the care picture is stable", () => {
    const handoff = deriveHealthPlanHandoff({
      consent: { caretaker_consent: true },
      medicationActivity: { status: "taken" },
      alerts: [],
      sensors: [{ id: "s1", status: "online" }],
      careProviders: [{ id: "cp1", provider_type: "field_staff", display_name: "Ana Novak", is_primary: true }],
      checkins: { enabled: true },
      brainCoach: { enabled: true },
      healthPlan: {
        id: "hp1",
        source_signals_json: [{ id: "risk-latest-score", label: "Risk", category: "risk", strength: "low" }],
      },
    });

    expect(handoff.priority).toBe("low");
    expect(handoff.responseWindow).toBe("within_24h");
    expect(handoff.sharingBoundary).toBe("approved_circle");
    expect(handoff.ownerName).toBe("Ana Novak");
    expect(handoff.actions.map((action) => action.code)).toEqual(["maintain_routine"]);
  });

  it("builds and parses a structured handoff note while keeping human notes separate", () => {
    const handoff = deriveHealthPlanHandoff({
      consent: { caretaker_consent: false },
      medicationActivity: { status: "missed" },
      alerts: [{ id: "a1", severity: "high", message: "Missed check-in" }],
      sensors: [{ id: "s1", status: "offline" }],
      careProviders: [],
      checkins: { enabled: true },
      brainCoach: { enabled: false },
      healthPlan: {
        id: "hp1",
        source_signals_json: [{ id: "risk-latest-score", label: "Risk", category: "risk", strength: "high" }],
      },
    });

    const machineNote = buildHealthPlanHandoffNote(handoff);
    const combined = [
      "[2026-06-18T09:00:00.000Z - mila@redcross.example] Call family after consent update.",
      `[2026-06-18T10:00:00.000Z - mila@redcross.example] ${machineNote}`,
    ].join("\n\n");

    const parsed = parseHealthPlanHandoffNotes(combined);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.author).toBe("mila@redcross.example");
    expect(parsed[0]?.handoff.responseWindow).toBe("same_day");
    expect(parsed[0]?.handoff.ownerMissing).toBe(true);
    expect(stripHealthPlanSystemNotes(combined)).toBe("[2026-06-18T09:00:00.000Z - mila@redcross.example] Call family after consent update.");
  });

  it("tracks milestone completion from structured handoff status notes", () => {
    const handoff = deriveHealthPlanHandoff({
      consent: { caretaker_consent: false },
      medicationActivity: { status: "missed" },
      alerts: [{ id: "a1", severity: "high", message: "Missed check-in" }],
      sensors: [{ id: "s1", status: "offline" }],
      careProviders: [],
      checkins: { enabled: true },
      brainCoach: { enabled: false },
      healthPlan: {
        id: "hp1",
        source_signals_json: [{ id: "risk-latest-score", label: "Risk", category: "risk", strength: "high" }],
      },
    });

    const combined = [
      `[2026-06-18T10:00:00.000Z - mila@redcross.example] ${buildHealthPlanHandoffStatusNote("owner_assigned", handoff)}`,
      `[2026-06-18T11:00:00.000Z - mila@redcross.example] ${buildHealthPlanHandoffStatusNote("first_contact_made", handoff)}`,
    ].join("\n\n");

    const statusEntries = parseHealthPlanHandoffStatusNotes(combined);
    const progress = deriveHealthPlanHandoffProgress(statusEntries);

    expect(statusEntries).toHaveLength(2);
    expect(progress.ownerAssigned).toBe(true);
    expect(progress.firstContactMade).toBe(true);
    expect(progress.escalationClosed).toBe(false);
    expect(progress.completedCount).toBe(2);
    expect(stripHealthPlanSystemNotes(combined)).toBeNull();
  });
});
