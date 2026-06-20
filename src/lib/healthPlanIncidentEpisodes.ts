import type { HealthPlanIncidentPlaybook, HealthPlanIncidentPlaybookCode } from "@/lib/healthPlanIncidentPlaybooks";
import type { HealthPlanHandoffSummary } from "@/lib/healthPlanHandoff";

export type HealthPlanIncidentEpisodeStatus = "open" | "closed";

export interface HealthPlanIncidentEpisodeEntry {
  timestamp: string | null;
  author: string | null;
  code: HealthPlanIncidentPlaybookCode;
  status: HealthPlanIncidentEpisodeStatus;
  ownerName: string | null;
  responseWindow: "same_day" | "within_24h" | null;
}

export interface HealthPlanIncidentEpisodeSummary {
  code: HealthPlanIncidentPlaybookCode;
  status: "not_started" | "open" | "closed";
  latestEventAt: string | null;
  latestEventBy: string | null;
  ownerName: string | null;
}

const HEALTH_PLAN_INCIDENT_EPISODE_PREFIX = "#VYVA_INCIDENT ";

function safeArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

function latestByTimestamp<T extends { timestamp?: string | null }>(entries: T[]): T | null {
  let latest: T | null = null;
  let latestTime = -Infinity;
  for (const entry of safeArray(entries)) {
    const time = new Date(entry.timestamp || 0).getTime();
    if (Number.isNaN(time) || time <= latestTime) continue;
    latest = entry;
    latestTime = time;
  }
  return latest;
}

export function buildHealthPlanIncidentEpisodeNote(
  code: HealthPlanIncidentPlaybookCode,
  status: HealthPlanIncidentEpisodeStatus,
  handoff?: HealthPlanHandoffSummary | null,
): string {
  return `${HEALTH_PLAN_INCIDENT_EPISODE_PREFIX}${JSON.stringify({
    code,
    status,
    ownerName: handoff?.ownerName || null,
    responseWindow: handoff?.responseWindow || null,
  })}`;
}

export function parseHealthPlanIncidentEpisodeNotes(notes?: string | null): HealthPlanIncidentEpisodeEntry[] {
  if (!notes) return [];
  return notes
    .split(/\n\s*\n/g)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const match = block.match(/^\[([^\]]+)\]\s*([\s\S]+)$/);
      const rawHeader = match?.[1] || "";
      const noteText = (match?.[2] || block).trim();
      if (!noteText.startsWith(HEALTH_PLAN_INCIDENT_EPISODE_PREFIX)) return null;
      try {
        const parsed = JSON.parse(noteText.slice(HEALTH_PLAN_INCIDENT_EPISODE_PREFIX.length));
        const separator = rawHeader.indexOf(" - ");
        const timestamp = separator >= 0 ? rawHeader.slice(0, separator) : rawHeader || null;
        const author = separator >= 0 ? rawHeader.slice(separator + 3) : null;
        const code = parsed.code === "urgent_welfare_check" || parsed.code === "medication_recovery" || parsed.code === "sensor_fallback"
          ? parsed.code
          : null;
        if (!code) return null;
        return {
          timestamp,
          author,
          code,
          status: parsed.status === "closed" ? "closed" : "open",
          ownerName: typeof parsed.ownerName === "string" && parsed.ownerName.trim() ? parsed.ownerName.trim() : null,
          responseWindow: parsed.responseWindow === "same_day" || parsed.responseWindow === "within_24h" ? parsed.responseWindow : null,
        } satisfies HealthPlanIncidentEpisodeEntry;
      } catch {
        return null;
      }
    })
    .filter((entry): entry is HealthPlanIncidentEpisodeEntry => Boolean(entry));
}

export function deriveHealthPlanIncidentEpisodeSummary(
  playbooks: HealthPlanIncidentPlaybook[],
  entries?: HealthPlanIncidentEpisodeEntry[] | null,
): HealthPlanIncidentEpisodeSummary[] {
  const list = safeArray(entries);
  return safeArray(playbooks).map((playbook) => {
    const latest = latestByTimestamp(list.filter((entry) => entry.code === playbook.code));
    return {
      code: playbook.code,
      status: latest ? latest.status : "not_started",
      latestEventAt: latest?.timestamp || null,
      latestEventBy: latest?.author || null,
      ownerName: latest?.ownerName || null,
    };
  });
}

export function stripHealthPlanIncidentEpisodeNotes(notes?: string | null): string | null {
  if (!notes) return null;
  const filtered = notes
    .split(/\n\s*\n/g)
    .map((block) => block.trim())
    .filter(Boolean)
    .filter((block) => !block.includes(HEALTH_PLAN_INCIDENT_EPISODE_PREFIX))
    .join("\n\n")
    .trim();
  return filtered || null;
}
