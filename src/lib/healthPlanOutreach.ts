import type { HealthPlanCommunicationPack } from "@/lib/healthPlanCommunication";

export type HealthPlanOutreachAudience = "client" | "care_circle";
export type HealthPlanOutreachChannel = "phone" | "whatsapp" | "app" | "in_person";

export interface HealthPlanOutreachEntry {
  timestamp: string | null;
  author: string | null;
  audience: HealthPlanOutreachAudience;
  channel: HealthPlanOutreachChannel;
  state: "ready" | "review" | "hold" | null;
}

export interface HealthPlanOutreachStatus {
  clientShared: boolean;
  careCircleShared: boolean;
  latestClientShare: HealthPlanOutreachEntry | null;
  latestCareCircleShare: HealthPlanOutreachEntry | null;
}

const HEALTH_PLAN_OUTREACH_NOTE_PREFIX = "#VYVA_OUTREACH ";

function safeArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

function normalizeAudience(value?: string | null): HealthPlanOutreachAudience {
  return value === "care_circle" ? "care_circle" : "client";
}

function normalizeChannel(value?: string | null): HealthPlanOutreachChannel {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "whatsapp") return "whatsapp";
  if (normalized === "app") return "app";
  if (normalized === "in_person") return "in_person";
  return "phone";
}

export function buildHealthPlanOutreachNote(
  audience: HealthPlanOutreachAudience,
  channel: HealthPlanOutreachChannel,
  communicationPack?: HealthPlanCommunicationPack | null,
): string {
  return `${HEALTH_PLAN_OUTREACH_NOTE_PREFIX}${JSON.stringify({
    audience,
    channel,
    state: communicationPack?.state || null,
  })}`;
}

export function parseHealthPlanOutreachNotes(notes?: string | null): HealthPlanOutreachEntry[] {
  if (!notes) return [];
  return notes
    .split(/\n\s*\n/g)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const match = block.match(/^\[([^\]]+)\]\s*([\s\S]+)$/);
      const rawHeader = match?.[1] || "";
      const noteText = (match?.[2] || block).trim();
      if (!noteText.startsWith(HEALTH_PLAN_OUTREACH_NOTE_PREFIX)) return null;
      try {
        const parsed = JSON.parse(noteText.slice(HEALTH_PLAN_OUTREACH_NOTE_PREFIX.length));
        const separator = rawHeader.indexOf(" - ");
        const timestamp = separator >= 0 ? rawHeader.slice(0, separator) : rawHeader || null;
        const author = separator >= 0 ? rawHeader.slice(separator + 3) : null;
        return {
          timestamp,
          author,
          audience: normalizeAudience(parsed.audience),
          channel: normalizeChannel(parsed.channel),
          state: parsed.state === "ready" || parsed.state === "review" || parsed.state === "hold" ? parsed.state : null,
        } satisfies HealthPlanOutreachEntry;
      } catch {
        return null;
      }
    })
    .filter((entry): entry is HealthPlanOutreachEntry => Boolean(entry));
}

export function deriveHealthPlanOutreachStatus(entries: HealthPlanOutreachEntry[]): HealthPlanOutreachStatus {
  const latestByAudience = new Map<HealthPlanOutreachAudience, HealthPlanOutreachEntry>();
  for (const entry of safeArray(entries)) {
    const existing = latestByAudience.get(entry.audience);
    if (!existing || new Date(entry.timestamp || 0).getTime() > new Date(existing.timestamp || 0).getTime()) {
      latestByAudience.set(entry.audience, entry);
    }
  }
  const latestClientShare = latestByAudience.get("client") || null;
  const latestCareCircleShare = latestByAudience.get("care_circle") || null;
  return {
    clientShared: Boolean(latestClientShare),
    careCircleShared: Boolean(latestCareCircleShare),
    latestClientShare,
    latestCareCircleShare,
  };
}

export function stripHealthPlanOutreachNotes(notes?: string | null): string | null {
  if (!notes) return null;
  const filtered = notes
    .split(/\n\s*\n/g)
    .map((block) => block.trim())
    .filter(Boolean)
    .filter((block) => !block.includes(HEALTH_PLAN_OUTREACH_NOTE_PREFIX))
    .join("\n\n")
    .trim();
  return filtered || null;
}
