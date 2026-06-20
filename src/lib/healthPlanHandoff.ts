import type { OperationalCareProviderAssignment, OperationalProfileResponse } from "@/lib/operationalDemoData";

export type HealthPlanHandoffPriority = "high" | "medium" | "low";
export type HealthPlanHandoffResponseWindow = "same_day" | "within_24h";
export type HealthPlanHandoffSharingBoundary = "staff_only" | "approved_circle";
export type HealthPlanHandoffActionCode =
  | "confirm_today_touchpoint"
  | "review_alerts"
  | "verify_medication"
  | "check_sensors"
  | "assign_owner"
  | "confirm_sharing_boundary"
  | "maintain_routine";
export type HealthPlanHandoffStatusCode = "owner_assigned" | "first_contact_made" | "escalation_closed";

export interface HealthPlanHandoffAction {
  code: HealthPlanHandoffActionCode;
  tone: HealthPlanHandoffPriority;
}

export interface HealthPlanHandoffSummary {
  priority: HealthPlanHandoffPriority;
  responseWindow: HealthPlanHandoffResponseWindow;
  sharingBoundary: HealthPlanHandoffSharingBoundary;
  ownerName: string | null;
  ownerMissing: boolean;
  careCircleCount: number;
  activeAlertCount: number;
  offlineSensorCount: number;
  missedMedication: boolean;
  highRisk: boolean;
  actions: HealthPlanHandoffAction[];
}

export interface HealthPlanHandoffNoteEntry {
  timestamp: string | null;
  author: string | null;
  handoff: HealthPlanHandoffSummary;
}

export interface HealthPlanHandoffStatusEntry {
  timestamp: string | null;
  author: string | null;
  status: HealthPlanHandoffStatusCode;
  ownerName: string | null;
  responseWindow: HealthPlanHandoffResponseWindow | null;
}

export interface HealthPlanHandoffProgress {
  ownerAssigned: boolean;
  firstContactMade: boolean;
  escalationClosed: boolean;
  completedCount: number;
}

const HEALTH_PLAN_HANDOFF_NOTE_PREFIX = "#VYVA_HANDOFF ";
const HEALTH_PLAN_HANDOFF_STATUS_NOTE_PREFIX = "#VYVA_HANDOFF_STATUS ";

function safeArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

function primaryOwner(providers: OperationalCareProviderAssignment[]): OperationalCareProviderAssignment | null {
  return providers.find((provider) => provider.is_primary && provider.display_name) || providers.find((provider) => provider.display_name) || null;
}

export function deriveHealthPlanHandoff(profile: Pick<
  OperationalProfileResponse,
  "alerts" | "brainCoach" | "careProviders" | "checkins" | "consent" | "healthPlan" | "medicationActivity" | "sensors"
>): HealthPlanHandoffSummary {
  const providers = safeArray(profile.careProviders);
  const owner = primaryOwner(providers);
  const sourceSignals = safeArray(profile.healthPlan?.source_signals_json);
  const activeAlertCount = safeArray(profile.alerts).filter((alert) => !alert?.resolved_at).length;
  const offlineSensorCount = safeArray(profile.sensors).filter((sensor) => String(sensor?.status || "").toLowerCase() !== "online").length;
  const medicationStatus = String(profile.medicationActivity?.status || "").trim().toLowerCase();
  const missedMedication = ["missed", "late", "skipped", "unconfirmed"].includes(medicationStatus);
  const highRisk = sourceSignals.some((signal) => signal.category === "risk" && signal.strength === "high");
  const familyConsent = Boolean(profile.consent?.caretaker_consent ?? profile.consent?.consent_given);
  const sameDay = highRisk || activeAlertCount > 0 || missedMedication;

  const actions: HealthPlanHandoffAction[] = [];
  if (sameDay) actions.push({ code: "confirm_today_touchpoint", tone: "high" });
  if (activeAlertCount > 0) actions.push({ code: "review_alerts", tone: "high" });
  if (missedMedication) actions.push({ code: "verify_medication", tone: "high" });
  if (offlineSensorCount > 0) actions.push({ code: "check_sensors", tone: "medium" });
  if (!owner) actions.push({ code: "assign_owner", tone: "high" });
  if (!familyConsent) actions.push({ code: "confirm_sharing_boundary", tone: "medium" });
  if (actions.length === 0) actions.push({ code: "maintain_routine", tone: "low" });

  return {
    priority: sameDay ? "high" : actions.some((action) => action.tone === "medium" || action.tone === "high") ? "medium" : "low",
    responseWindow: sameDay ? "same_day" : "within_24h",
    sharingBoundary: familyConsent ? "approved_circle" : "staff_only",
    ownerName: owner?.display_name || null,
    ownerMissing: !owner,
    careCircleCount: providers.length,
    activeAlertCount,
    offlineSensorCount,
    missedMedication,
    highRisk,
    actions,
  };
}

export function buildHealthPlanHandoffNote(handoff: HealthPlanHandoffSummary): string {
  return `${HEALTH_PLAN_HANDOFF_NOTE_PREFIX}${JSON.stringify({
    priority: handoff.priority,
    responseWindow: handoff.responseWindow,
    sharingBoundary: handoff.sharingBoundary,
    ownerName: handoff.ownerName,
    ownerMissing: handoff.ownerMissing,
    careCircleCount: handoff.careCircleCount,
    activeAlertCount: handoff.activeAlertCount,
    offlineSensorCount: handoff.offlineSensorCount,
    missedMedication: handoff.missedMedication,
    highRisk: handoff.highRisk,
    actions: handoff.actions.map((action) => action.code),
  })}`;
}

export function buildHealthPlanHandoffStatusNote(status: HealthPlanHandoffStatusCode, handoff: HealthPlanHandoffSummary): string {
  return `${HEALTH_PLAN_HANDOFF_STATUS_NOTE_PREFIX}${JSON.stringify({
    status,
    ownerName: handoff.ownerName,
    responseWindow: handoff.responseWindow,
  })}`;
}

export function parseHealthPlanHandoffNotes(notes?: string | null): HealthPlanHandoffNoteEntry[] {
  if (!notes) return [];
  return notes
    .split(/\n\s*\n/g)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const match = block.match(/^\[([^\]]+)\]\s*([\s\S]+)$/);
      const rawHeader = match?.[1] || "";
      const noteText = (match?.[2] || block).trim();
      if (!noteText.startsWith(HEALTH_PLAN_HANDOFF_NOTE_PREFIX)) return null;
      try {
        const parsed = JSON.parse(noteText.slice(HEALTH_PLAN_HANDOFF_NOTE_PREFIX.length));
        const separator = rawHeader.indexOf(" - ");
        const timestamp = separator >= 0 ? rawHeader.slice(0, separator) : rawHeader || null;
        const author = separator >= 0 ? rawHeader.slice(separator + 3) : null;
        return {
          timestamp,
          author,
          handoff: {
            priority: parsed.priority === "high" || parsed.priority === "medium" ? parsed.priority : "low",
            responseWindow: parsed.responseWindow === "same_day" ? "same_day" : "within_24h",
            sharingBoundary: parsed.sharingBoundary === "staff_only" ? "staff_only" : "approved_circle",
            ownerName: parsed.ownerName || null,
            ownerMissing: Boolean(parsed.ownerMissing),
            careCircleCount: Number(parsed.careCircleCount || 0),
            activeAlertCount: Number(parsed.activeAlertCount || 0),
            offlineSensorCount: Number(parsed.offlineSensorCount || 0),
            missedMedication: Boolean(parsed.missedMedication),
            highRisk: Boolean(parsed.highRisk),
            actions: Array.isArray(parsed.actions)
              ? parsed.actions.map((code: HealthPlanHandoffActionCode) => ({ code, tone: "medium" as const }))
              : [],
          },
        };
      } catch {
        return null;
      }
    })
    .filter((entry): entry is HealthPlanHandoffNoteEntry => Boolean(entry));
}

export function parseHealthPlanHandoffStatusNotes(notes?: string | null): HealthPlanHandoffStatusEntry[] {
  if (!notes) return [];
  return notes
    .split(/\n\s*\n/g)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const match = block.match(/^\[([^\]]+)\]\s*([\s\S]+)$/);
      const rawHeader = match?.[1] || "";
      const noteText = (match?.[2] || block).trim();
      if (!noteText.startsWith(HEALTH_PLAN_HANDOFF_STATUS_NOTE_PREFIX)) return null;
      try {
        const parsed = JSON.parse(noteText.slice(HEALTH_PLAN_HANDOFF_STATUS_NOTE_PREFIX.length));
        const separator = rawHeader.indexOf(" - ");
        const timestamp = separator >= 0 ? rawHeader.slice(0, separator) : rawHeader || null;
        const author = separator >= 0 ? rawHeader.slice(separator + 3) : null;
        return {
          timestamp,
          author,
          status:
            parsed.status === "owner_assigned" || parsed.status === "first_contact_made" || parsed.status === "escalation_closed"
              ? parsed.status
              : "owner_assigned",
          ownerName: parsed.ownerName || null,
          responseWindow: parsed.responseWindow === "same_day" ? "same_day" : parsed.responseWindow === "within_24h" ? "within_24h" : null,
        };
      } catch {
        return null;
      }
    })
    .filter((entry): entry is HealthPlanHandoffStatusEntry => Boolean(entry));
}

export function deriveHealthPlanHandoffProgress(statusEntries: HealthPlanHandoffStatusEntry[]): HealthPlanHandoffProgress {
  const latestByStatus = new Map<HealthPlanHandoffStatusCode, HealthPlanHandoffStatusEntry>();
  for (const entry of statusEntries) {
    const existing = latestByStatus.get(entry.status);
    if (!existing || new Date(entry.timestamp || 0).getTime() > new Date(existing.timestamp || 0).getTime()) {
      latestByStatus.set(entry.status, entry);
    }
  }
  const ownerAssigned = latestByStatus.has("owner_assigned");
  const firstContactMade = latestByStatus.has("first_contact_made");
  const escalationClosed = latestByStatus.has("escalation_closed");
  return {
    ownerAssigned,
    firstContactMade,
    escalationClosed,
    completedCount: [ownerAssigned, firstContactMade, escalationClosed].filter(Boolean).length,
  };
}

export function stripHealthPlanSystemNotes(notes?: string | null): string | null {
  if (!notes) return null;
  const filtered = notes
    .split(/\n\s*\n/g)
    .map((block) => block.trim())
    .filter(Boolean)
    .filter((block) => !block.includes(HEALTH_PLAN_HANDOFF_NOTE_PREFIX) && !block.includes(HEALTH_PLAN_HANDOFF_STATUS_NOTE_PREFIX))
    .join("\n\n")
    .trim();
  return filtered || null;
}
