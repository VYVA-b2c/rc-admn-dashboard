import { describe, expect, it } from "vitest";

import { deriveHealthPlanRapidResponse } from "@/lib/healthPlanRapidResponse";

describe("deriveHealthPlanRapidResponse", () => {
  it("builds an urgent contact ladder from elder to care circle to owner", () => {
    const pack = deriveHealthPlanRapidResponse({
      user: {
        id: "user-1",
        first_name: "Carmen",
        last_name: "Lopez",
        phone: "+34 600 010 245",
      },
      preferredChannel: "phone",
      consent: {
        consent_given: true,
      },
      caregivers: [
        {
          id: "cg-1",
          caretaker_name: "Maria Garcia",
          caretaker_phone: "+34 600 345 901",
          is_primary: true,
        },
      ],
      careProviders: [
        {
          id: "owner-1",
          provider_type: "field_staff",
          display_name: "Ana Novak",
          phone: "+34 600 120 220",
          is_primary: true,
        },
      ],
      handoff: {
        priority: "high",
        responseWindow: "same_day",
        sharingBoundary: "approved_circle",
        ownerName: "Ana Novak",
        ownerMissing: false,
        careCircleCount: 1,
        activeAlertCount: 1,
        offlineSensorCount: 0,
        missedMedication: true,
        highRisk: true,
        actions: [],
      },
    });

    expect(pack?.state).toBe("urgent");
    expect(pack?.steps.map((item) => item.code)).toEqual([
      "reach_elder",
      "reach_care_circle",
      "reach_owner",
    ]);
    expect(pack?.fallbackCode).toBe("care_circle_then_owner");
    expect(pack?.reasonLines).toEqual([
      "There are open alerts that should not sit unattended today.",
      "Medication follow-through is still not safely confirmed.",
      "The risk picture calls for a closer follow-up today.",
    ]);
    expect(pack?.briefingMessage).toContain("Urgent follow-up for Carmen Lopez today:");
    expect(pack?.briefingMessage).toContain("Contact order: 1. Carmen Lopez (+34 600 010 245)");
    expect(pack?.noAnswerMessage).toBe(
      "Contact the approved care circle right away, then keep the named owner active until safety is confirmed.",
    );
  });

  it("hides care-circle escalation when sharing is staff-only", () => {
    const pack = deriveHealthPlanRapidResponse({
      user: {
        id: "user-1",
        first_name: "Hans",
        last_name: "Mueller",
        phone: "+49 351 555 014",
      },
      preferredChannel: "phone",
      consent: {
        consent_given: false,
      },
      caregivers: [
        {
          id: "cg-1",
          caretaker_name: "Laura",
          caretaker_phone: "+49 351 555 019",
          is_primary: true,
        },
      ],
      careProviders: [
        {
          id: "owner-1",
          provider_type: "field_staff",
          display_name: "Mila Weber",
          phone: "+49 341 555 012",
          is_primary: true,
        },
      ],
      handoff: {
        priority: "medium",
        responseWindow: "within_24h",
        sharingBoundary: "staff_only",
        ownerName: "Mila Weber",
        ownerMissing: false,
        careCircleCount: 0,
        activeAlertCount: 0,
        offlineSensorCount: 1,
        missedMedication: false,
        highRisk: false,
        actions: [],
      },
    });

    expect(pack?.steps.map((item) => item.code)).toEqual([
      "reach_elder",
      "reach_owner",
    ]);
    expect(pack?.fallbackCode).toBe("owner_then_keep_urgent");
  });

  it("localizes the rapid response briefing in the requested language", () => {
    const pack = deriveHealthPlanRapidResponse({
      user: {
        id: "user-1",
        first_name: "Carmen",
        last_name: "Lopez",
        phone: "+34 600 010 245",
        language: "es",
      },
      language: "es",
      preferredChannel: "phone",
      consent: {
        consent_given: true,
      },
      caregivers: [
        {
          id: "cg-1",
          caretaker_name: "Maria Garcia",
          caretaker_phone: "+34 600 345 901",
          is_primary: true,
        },
      ],
      careProviders: [
        {
          id: "owner-1",
          provider_type: "field_staff",
          display_name: "Ana Novak",
          phone: "+34 600 120 220",
          is_primary: true,
        },
      ],
      handoff: {
        priority: "high",
        responseWindow: "same_day",
        sharingBoundary: "approved_circle",
        ownerName: "Ana Novak",
        ownerMissing: false,
        careCircleCount: 1,
        activeAlertCount: 1,
        offlineSensorCount: 1,
        missedMedication: false,
        highRisk: false,
        actions: [],
      },
    });

    expect(pack?.reasonLines).toEqual([
      "Hay alertas abiertas que hoy no deberian quedarse sin revisar.",
      "La situacion de los sensores no es lo bastante fiable como para confiar en el silencio.",
    ]);
    expect(pack?.briefingMessage).toContain("Seguimiento urgente para Carmen Lopez hoy:");
    expect(pack?.briefingMessage).toContain("Orden de contacto:");
    expect(pack?.noAnswerMessage).toContain("circulo de cuidado autorizado");
  });
});
