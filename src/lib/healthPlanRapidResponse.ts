import type {
  OperationalCareProviderAssignment,
  OperationalCaregiver,
  OperationalChannel,
  OperationalConsent,
  OperationalProfileUser,
} from "@/lib/operationalDemoData";
import type { HealthPlanHandoffSummary } from "@/lib/healthPlanHandoff";

export type HealthPlanRapidResponseStepCode = "reach_elder" | "reach_care_circle" | "reach_owner";
export type HealthPlanRapidResponseFallbackCode =
  | "care_circle_then_owner"
  | "owner_then_keep_urgent"
  | "keep_urgent_log_failure";

export interface HealthPlanRapidResponseStep {
  code: HealthPlanRapidResponseStepCode;
  contactName: string;
  phone?: string | null;
  channel?: OperationalChannel | null;
}

export interface HealthPlanRapidResponsePack {
  state: "urgent" | "watch" | "stable";
  responseWindow: "same_day" | "within_24h";
  sharingBoundary: "staff_only" | "approved_circle";
  ownerMissing: boolean;
  steps: HealthPlanRapidResponseStep[];
  fallbackCode: HealthPlanRapidResponseFallbackCode;
  reasonLines: string[];
  briefingMessage: string;
  noAnswerMessage: string;
}

type HealthPlanRapidResponseLanguage = "en" | "de" | "es";

function normalizeText(value?: string | null) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeLanguage(value?: string | null): HealthPlanRapidResponseLanguage {
  const language = normalizeText(value).toLowerCase().slice(0, 2);
  if (language === "de" || language === "es") return language;
  return "en";
}

function rapidResponseCopy(language: HealthPlanRapidResponseLanguage) {
  if (language === "de") {
    return {
      reasonAlerts: "Es gibt offene Warnsignale, die heute nicht liegen bleiben sollten.",
      reasonMedication: "Die Medikamenteneinnahme ist noch nicht verlaesslich bestaetigt.",
      reasonSensors: "Die Sensorlage ist nicht verlaesslich genug, um auf Stille zu vertrauen.",
      reasonHighRisk: "Das Risikobild verlangt heute eine engere Nachverfolgung.",
      briefingIntro: (name: string) => `Dringende Nachverfolgung fuer ${name} heute:`,
      briefingOrder: "Kontaktreihenfolge",
      fallbackIntro: "Wenn die Person nicht antwortet:",
      noAnswerCircleThenOwner: "Sofort den freigegebenen Betreuungskreis kontaktieren und danach die benannte Verantwortungsperson aktiv halten, bis Sicherheit bestaetigt ist.",
      noAnswerOwner: "Direkt zur benannten Verantwortungsperson wechseln und den Fall dringend halten, bis Sicherheit bestaetigt ist.",
      noAnswerKeepUrgent: "Den Fall dringend halten, den erfolglosen Kontakt protokollieren und den Loop nicht still werden lassen.",
    };
  }
  if (language === "es") {
    return {
      reasonAlerts: "Hay alertas abiertas que hoy no deberian quedarse sin revisar.",
      reasonMedication: "La adherencia de la medicacion todavia no esta confirmada con seguridad.",
      reasonSensors: "La situacion de los sensores no es lo bastante fiable como para confiar en el silencio.",
      reasonHighRisk: "La imagen de riesgo exige un seguimiento mas estrecho hoy.",
      briefingIntro: (name: string) => `Seguimiento urgente para ${name} hoy:`,
      briefingOrder: "Orden de contacto",
      fallbackIntro: "Si la persona no responde:",
      noAnswerCircleThenOwner: "Contacta enseguida con el circulo de cuidado autorizado y despues mantén activa a la persona responsable hasta confirmar seguridad.",
      noAnswerOwner: "Pasa directamente a la persona responsable y mantén el caso como urgente hasta confirmar seguridad.",
      noAnswerKeepUrgent: "Mantén el caso como urgente, registra el contacto fallido y no dejes que el circuito se quede en silencio.",
    };
  }
  return {
    reasonAlerts: "There are open alerts that should not sit unattended today.",
    reasonMedication: "Medication follow-through is still not safely confirmed.",
    reasonSensors: "Sensor reliability is too weak to treat silence as reassurance.",
    reasonHighRisk: "The risk picture calls for a closer follow-up today.",
    briefingIntro: (name: string) => `Urgent follow-up for ${name} today:`,
    briefingOrder: "Contact order",
    fallbackIntro: "If the elder does not answer:",
    noAnswerCircleThenOwner: "Contact the approved care circle right away, then keep the named owner active until safety is confirmed.",
    noAnswerOwner: "Move directly to the named owner and keep the case urgent until safety is confirmed.",
    noAnswerKeepUrgent: "Keep the case urgent, log the failed contact, and do not let the loop go quiet.",
  };
}

function primaryCaregiver(
  caregivers?: OperationalCaregiver[] | null,
  providers?: OperationalCareProviderAssignment[] | null,
) {
  const direct =
    (Array.isArray(caregivers) ? caregivers : []).find((item) => item?.is_primary && (item.caretaker_name || item.caretaker_phone))
    || (Array.isArray(caregivers) ? caregivers : []).find((item) => item?.caretaker_name || item?.caretaker_phone)
    || null;
  if (direct) {
    return {
      name: normalizeText(direct.caretaker_name) || "Approved care circle",
      phone: normalizeText(direct.caretaker_phone) || null,
    };
  }

  const provider =
    (Array.isArray(providers) ? providers : []).find((item) => item?.provider_type === "caregiver" && item?.is_primary && (item.display_name || item.phone))
    || (Array.isArray(providers) ? providers : []).find((item) => item?.provider_type === "caregiver" && (item.display_name || item.phone))
    || null;
  if (!provider) return null;
  return {
    name: normalizeText(provider.display_name) || "Approved care circle",
    phone: normalizeText(provider.phone) || null,
  };
}

function ownerContact(providers?: OperationalCareProviderAssignment[] | null, handoff?: HealthPlanHandoffSummary | null) {
  const provider =
    (Array.isArray(providers) ? providers : []).find((item) => item?.provider_type === "field_staff" && item?.is_primary && (item.display_name || item.phone))
    || (Array.isArray(providers) ? providers : []).find((item) => item?.provider_type === "field_staff" && (item.display_name || item.phone))
    || null;
  const name = normalizeText(provider?.display_name) || normalizeText(handoff?.ownerName) || "";
  const phone = normalizeText(provider?.phone) || null;
  if (!name && !phone) return null;
  return { name: name || "Named owner", phone };
}

export function deriveHealthPlanRapidResponse(input: {
  user?: OperationalProfileUser | null;
  language?: string | null;
  preferredChannel?: OperationalChannel | null;
  consent?: OperationalConsent | null;
  caregivers?: OperationalCaregiver[] | null;
  careProviders?: OperationalCareProviderAssignment[] | null;
  handoff?: HealthPlanHandoffSummary | null;
}): HealthPlanRapidResponsePack | null {
  const user = input.user;
  const handoff = input.handoff;
  if (!user || !handoff) return null;
  const language = normalizeLanguage(input.language || user.language);
  const copy = rapidResponseCopy(language);

  const steps: HealthPlanRapidResponseStep[] = [];
  const userPhone = normalizeText(user.phone) || null;
  const fullName = [normalizeText(user.first_name), normalizeText(user.last_name)].filter(Boolean).join(" ").trim() || "The elder";
  const sharingBoundary = handoff.sharingBoundary;
  const channel = input.preferredChannel || "phone";

  if (fullName || userPhone) {
    steps.push({
      code: "reach_elder",
      contactName: fullName,
      phone: userPhone,
      channel,
    });
  }

  const caregiverAllowed = Boolean(input.consent?.caretaker_consent ?? input.consent?.consent_given) && sharingBoundary === "approved_circle";
  const caregiver = caregiverAllowed ? primaryCaregiver(input.caregivers, input.careProviders) : null;
  if (caregiver?.name || caregiver?.phone) {
    steps.push({
      code: "reach_care_circle",
      contactName: caregiver?.name || "Approved care circle",
      phone: caregiver?.phone || null,
      channel: caregiver?.phone ? "phone" : null,
    });
  }

  const owner = ownerContact(input.careProviders, handoff);
  if (owner?.name || owner?.phone) {
    steps.push({
      code: "reach_owner",
      contactName: owner?.name || "Named owner",
      phone: owner?.phone || null,
      channel: owner?.phone ? "phone" : null,
    });
  }

  const fallbackCode: HealthPlanRapidResponseFallbackCode =
    caregiverAllowed && caregiver
      ? "care_circle_then_owner"
      : owner
        ? "owner_then_keep_urgent"
        : "keep_urgent_log_failure";

  const reasonLines = [
    handoff.activeAlertCount > 0 ? copy.reasonAlerts : null,
    handoff.missedMedication ? copy.reasonMedication : null,
    handoff.offlineSensorCount > 0 ? copy.reasonSensors : null,
    handoff.highRisk ? copy.reasonHighRisk : null,
  ].filter((line): line is string => Boolean(line));

  const stepSummary = steps
    .map((step, index) => `${index + 1}. ${step.contactName}${step.phone ? ` (${step.phone})` : ""}`)
    .join("  ");

  const fallbackMessage =
    fallbackCode === "care_circle_then_owner"
      ? copy.noAnswerCircleThenOwner
      : fallbackCode === "owner_then_keep_urgent"
        ? copy.noAnswerOwner
        : copy.noAnswerKeepUrgent;

  const briefingMessage = [
    copy.briefingIntro(fullName),
    reasonLines.length > 0 ? reasonLines.map((line) => `- ${line}`).join("\n") : null,
    `${copy.briefingOrder}: ${stepSummary}`,
    `${copy.fallbackIntro} ${fallbackMessage}`,
  ].filter(Boolean).join("\n\n");

  return {
    state:
      handoff.responseWindow === "same_day" || handoff.activeAlertCount > 0 || handoff.missedMedication || handoff.ownerMissing
        ? "urgent"
        : handoff.offlineSensorCount > 0
          ? "watch"
          : "stable",
    responseWindow: handoff.responseWindow,
    sharingBoundary,
    ownerMissing: handoff.ownerMissing,
    steps,
    fallbackCode,
    reasonLines,
    briefingMessage,
    noAnswerMessage: fallbackMessage,
  };
}
