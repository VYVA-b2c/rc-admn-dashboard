import type { HealthPlanCommunicationPack } from "@/lib/healthPlanCommunication";
import type { HealthPlanSharePack } from "@/lib/healthPlanSharing";
import type { HealthPlanHandoffSummary } from "@/lib/healthPlanHandoff";

export interface HealthPlanDraftPack {
  phoneScript: string;
  whatsappDraft: string;
  careCircleDraft: string | null;
}

type HealthPlanDraftLanguage = "en" | "de" | "es";

function normalizeText(value?: string | null) {
  return typeof value === "string" ? value.trim() : "";
}

function firstItems(items: Array<string | null | undefined>, limit = 3) {
  const result: string[] = [];
  for (const item of items) {
    const text = normalizeText(item);
    if (!text) continue;
    result.push(text);
    if (result.length >= limit) break;
  }
  return result;
}

function joinBullets(items: string[]) {
  return items.map((item) => `- ${item}`).join("\n");
}

function normalizeLanguage(value?: string | null): HealthPlanDraftLanguage {
  const language = normalizeText(value).toLowerCase().slice(0, 2);
  if (language === "de" || language === "es") return language;
  return "en";
}

function draftCopy(language: HealthPlanDraftLanguage) {
  if (language === "de") {
    return {
      phoneGreeting: (firstName: string) => `Hallo ${firstName}, ich melde mich mit einem kurzen Unterstuetzungs-Update fuer heute.`,
      whatsappGreeting: (firstName: string) => `Hallo ${firstName}, hier ist die Unterstuetzungs-Zusammenfassung fuer heute:`,
      careCircleHeading: "Kurzes Update fuer den freigegebenen Betreuungskreis:",
      sameDayLine: "Wir bleiben heute eng bei der Nachverfolgung und halten den naechsten Kontaktpunkt klar.",
      routineLine: "Wir halten die naechste Nachverfolgung ruhig, verlässlich und gut nachvollziehbar.",
      sameDayChangesLine: "Wenn sich vor dem naechsten Kontaktpunkt etwas veraendert, sagen Sie uns bitte sofort Bescheid, damit wir noch heute reagieren koennen.",
      routineChangesLine: "Wenn sich vor der naechsten Nachverfolgung etwas veraendert, geben Sie uns bitte Bescheid, damit wir den Plan anpassen koennen.",
      careCircleSameDayLine: "Bitte bleiben Sie heute eng an der Nachverfolgung und melden Sie bedeutsame Veraenderungen schnell.",
      careCircleRoutineLine: "Bitte helfen Sie dabei, die Routine stabil zu halten, und melden Sie bedeutsame Veraenderungen zeitnah.",
      ownerLabel: (ownerName: string) => `Heutige Ansprechperson: ${ownerName}.`,
    };
  }

  if (language === "es") {
    return {
      phoneGreeting: (firstName: string) => `Hola ${firstName}, te llamo con una actualizacion breve de apoyo para hoy.`,
      whatsappGreeting: (firstName: string) => `Hola ${firstName}, aqui tienes el resumen de apoyo para hoy:`,
      careCircleHeading: "Actualizacion breve para el circulo de cuidado autorizado:",
      sameDayLine: "Hoy vamos a seguir el caso de cerca y mantener claro el siguiente punto de contacto.",
      routineLine: "Mantendremos el siguiente seguimiento de forma tranquila, constante y facil de seguir.",
      sameDayChangesLine: "Si algo cambia antes del siguiente contacto, por favor avisanos enseguida para que podamos responder hoy mismo.",
      routineChangesLine: "Si algo cambia antes del siguiente seguimiento, por favor avisanos para que podamos ajustar el plan.",
      careCircleSameDayLine: "Por favor mantengan el seguimiento de hoy muy cerca y avisen rapido si hay cambios importantes.",
      careCircleRoutineLine: "Por favor ayuden a mantener la rutina estable y avisen pronto si hay cambios importantes.",
      ownerLabel: (ownerName: string) => `Persona responsable de hoy: ${ownerName}.`,
    };
  }

  return {
    phoneGreeting: (firstName: string) => `Hello ${firstName}, I'm checking in with a short support update for today.`,
    whatsappGreeting: (firstName: string) => `Hi ${firstName}, here is today's support summary:`,
    careCircleHeading: "Brief update for the approved care circle:",
    sameDayLine: "We will stay close to today's follow-up and keep the next touchpoint clear.",
    routineLine: "We will keep the next follow-up steady and easy to track.",
    sameDayChangesLine: "If anything changes before the next touchpoint, please tell us right away so we can respond the same day.",
    routineChangesLine: "If anything changes before the next follow-up, please tell us so we can adjust the plan.",
    careCircleSameDayLine: "Please keep same-day follow-up close and report meaningful changes quickly.",
    careCircleRoutineLine: "Please help keep the routine steady and report meaningful changes promptly.",
    ownerLabel: (ownerName: string) => `Today's point of contact: ${ownerName}.`,
  };
}

export function deriveHealthPlanDraftPack(input: {
  firstName?: string | null;
  language?: string | null;
  communicationPack?: HealthPlanCommunicationPack | null;
  sharePack?: HealthPlanSharePack | null;
  handoff?: HealthPlanHandoffSummary | null;
}): HealthPlanDraftPack | null {
  const communicationPack = input.communicationPack;
  const sharePack = input.sharePack;
  if (!communicationPack || !sharePack) return null;

  const firstName = normalizeText(input.firstName) || "there";
  const language = normalizeLanguage(input.language);
  const copy = draftCopy(language);
  const clientPoints = firstItems(communicationPack.clientScript, 3);
  const careCirclePoints = firstItems(communicationPack.careCircleScript, 3);
  const focusPoints = firstItems(sharePack.todayFocus, 2);
  const urgencyLine =
    input.handoff?.responseWindow === "same_day"
      ? copy.sameDayLine
      : copy.routineLine;
  const changeLine =
    input.handoff?.responseWindow === "same_day"
      ? copy.sameDayChangesLine
      : copy.routineChangesLine;
  const ownerLine = normalizeText(input.handoff?.ownerName);

  const phoneScript = [
    copy.phoneGreeting(firstName),
    joinBullets(clientPoints),
    joinBullets(focusPoints),
    urgencyLine,
    changeLine,
  ].filter(Boolean).join("\n\n");

  const whatsappDraft = [
    copy.whatsappGreeting(firstName),
    ...clientPoints.map((item) => `- ${item}`),
    ...focusPoints.map((item) => `- ${item}`),
    input.handoff?.responseWindow === "same_day"
      ? copy.sameDayLine
      : copy.routineLine,
    changeLine,
  ].join("\n");

  const careCircleDraft =
    sharePack.sharingBoundary === "approved_circle" && communicationPack.state !== "hold"
      ? [
          copy.careCircleHeading,
          ...careCirclePoints.map((item) => `- ${item}`),
          ...focusPoints.map((item) => `- ${item}`),
          ownerLine ? copy.ownerLabel(ownerLine) : null,
          input.handoff?.responseWindow === "same_day"
            ? copy.careCircleSameDayLine
            : copy.careCircleRoutineLine,
        ].filter(Boolean).join("\n")
      : null;

  return {
    phoneScript,
    whatsappDraft,
    careCircleDraft,
  };
}
