import { describe, expect, it } from "vitest";

import { deriveHealthPlanDraftPack } from "@/lib/healthPlanDrafts";

describe("deriveHealthPlanDraftPack", () => {
  it("builds channel-ready drafts for the client and approved care circle", () => {
    const drafts = deriveHealthPlanDraftPack({
      firstName: "Carmen",
      language: "en",
      communicationPack: {
        state: "ready",
        clientScript: [
          "Keep the daily check-in active at the usual morning time.",
          "Use short, clear medication reminders and confirm the morning dose.",
        ],
        careCircleScript: [
          "Share a short update with the approved care circle after significant changes.",
          "Ask the care circle to help reinforce hydration and the medication routine.",
        ],
        staffGuardrails: [],
      },
      sharePack: {
        shareState: "ready",
        sharingBoundary: "approved_circle",
        clientHighlights: [],
        careCircleHighlights: [],
        todayFocus: ["Review active alerts on the same day they appear."],
      },
      handoff: {
        priority: "high",
        responseWindow: "same_day",
        sharingBoundary: "approved_circle",
        ownerName: "Ana Novak",
        ownerMissing: false,
        careCircleCount: 2,
        activeAlertCount: 1,
        offlineSensorCount: 0,
        missedMedication: true,
        highRisk: true,
        actions: [],
      },
    });

    expect(drafts?.phoneScript).toContain("Hello Carmen");
    expect(drafts?.whatsappDraft).toContain("Hi Carmen");
    expect(drafts?.careCircleDraft).toContain("approved care circle");
    expect(drafts?.careCircleDraft).toContain("Today's point of contact: Ana Novak.");
  });

  it("holds back the care-circle draft when sharing is staff-only", () => {
    const drafts = deriveHealthPlanDraftPack({
      firstName: "Carmen",
      language: "en",
      communicationPack: {
        state: "hold",
        clientScript: ["Keep the daily check-in active at the usual morning time."],
        careCircleScript: [],
        staffGuardrails: ["hold_staff_only"],
      },
      sharePack: {
        shareState: "hold",
        sharingBoundary: "staff_only",
        clientHighlights: [],
        careCircleHighlights: [],
        todayFocus: ["Review active alerts on the same day they appear."],
      },
      handoff: null,
    });

    expect(drafts?.careCircleDraft).toBeNull();
    expect(drafts?.phoneScript).toContain("Carmen");
  });

  it("localizes the outreach drafts to the client's language", () => {
    const drafts = deriveHealthPlanDraftPack({
      firstName: "Carmen",
      language: "es",
      communicationPack: {
        state: "ready",
        clientScript: [
          "Mantener la llamada diaria a la hora habitual de la manana.",
          "Confirmar la medicacion con recordatorios breves y claros.",
        ],
        careCircleScript: [
          "Compartir una actualizacion breve con el circulo de cuidado autorizado.",
        ],
        staffGuardrails: [],
      },
      sharePack: {
        shareState: "ready",
        sharingBoundary: "approved_circle",
        clientHighlights: [],
        careCircleHighlights: [],
        todayFocus: ["Revisar las alertas activas el mismo dia."],
      },
      handoff: {
        priority: "high",
        responseWindow: "same_day",
        sharingBoundary: "approved_circle",
        ownerName: "Ana Novak",
        ownerMissing: false,
        careCircleCount: 2,
        activeAlertCount: 1,
        offlineSensorCount: 0,
        missedMedication: true,
        highRisk: true,
        actions: [],
      },
    });

    expect(drafts?.phoneScript).toContain("Hola Carmen");
    expect(drafts?.whatsappDraft).toContain("aqui tienes el resumen de apoyo para hoy");
    expect(drafts?.careCircleDraft).toContain("Persona responsable de hoy: Ana Novak.");
    expect(drafts?.careCircleDraft).toContain("circulo de cuidado autorizado");
  });
});
