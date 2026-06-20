export type HealthPlanConfirmationPriority = "high" | "medium" | null;
export type HealthPlanConfirmationDueWindow = "same_day" | "within_24h" | null;

export interface HealthPlanConfirmationItemLike {
  code?: string | null;
  text?: string | null;
  priority?: HealthPlanConfirmationPriority;
  due_window?: HealthPlanConfirmationDueWindow;
}

export interface HealthPlanConfirmationReceiptEntry {
  code: string;
  text: string | null;
  priority: HealthPlanConfirmationPriority;
  dueWindow: HealthPlanConfirmationDueWindow;
  timestamp: string | null;
  author: string | null;
}

export interface HealthPlanConfirmationStatus extends HealthPlanConfirmationReceiptEntry {
  confirmed: boolean;
  confirmedAt: string | null;
  confirmedBy: string | null;
}

const HEALTH_PLAN_CONFIRMATION_NOTE_PREFIX = "#VYVA_CONFIRMATION ";

function normalizeText(value?: string | null) {
  return typeof value === "string" ? value.trim() : "";
}

function safeArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function timestampValue(value?: string | null) {
  const text = normalizeText(value);
  if (!text) return null;
  const time = new Date(text).getTime();
  return Number.isNaN(time) ? null : time;
}

export function resolveHealthPlanConfirmationCode(item?: HealthPlanConfirmationItemLike | null): string | null {
  const explicitCode = normalizeText(item?.code);
  if (explicitCode) return explicitCode;
  const text = normalizeText(item?.text);
  if (!text) return null;
  const slug = slugify(text);
  return slug ? `confirmation-${slug}` : null;
}

export function buildHealthPlanConfirmationNote(item: HealthPlanConfirmationItemLike): string {
  const code = resolveHealthPlanConfirmationCode(item);
  if (!code) {
    throw new Error("A confirmation receipt needs a code or text.");
  }
  return `${HEALTH_PLAN_CONFIRMATION_NOTE_PREFIX}${JSON.stringify({
    code,
    text: normalizeText(item.text) || null,
    priority: item.priority === "high" ? "high" : item.priority === "medium" ? "medium" : null,
    dueWindow: item.due_window === "same_day" ? "same_day" : item.due_window === "within_24h" ? "within_24h" : null,
  })}`;
}

export function parseHealthPlanConfirmationNotes(notes?: string | null): HealthPlanConfirmationReceiptEntry[] {
  if (!notes) return [];
  return notes
    .split(/\n\s*\n/g)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const match = block.match(/^\[([^\]]+)\]\s*([\s\S]+)$/);
      const rawHeader = match?.[1] || "";
      const noteText = (match?.[2] || block).trim();
      if (!noteText.startsWith(HEALTH_PLAN_CONFIRMATION_NOTE_PREFIX)) return null;
      try {
        const parsed = JSON.parse(noteText.slice(HEALTH_PLAN_CONFIRMATION_NOTE_PREFIX.length));
        const separator = rawHeader.indexOf(" - ");
        const timestamp = separator >= 0 ? rawHeader.slice(0, separator) : rawHeader || null;
        const author = separator >= 0 ? rawHeader.slice(separator + 3) : null;
        const code = resolveHealthPlanConfirmationCode(parsed);
        if (!code) return null;
        return {
          code,
          text: normalizeText(parsed.text) || null,
          priority: parsed.priority === "high" ? "high" : parsed.priority === "medium" ? "medium" : null,
          dueWindow: parsed.dueWindow === "same_day" ? "same_day" : parsed.dueWindow === "within_24h" ? "within_24h" : null,
          timestamp,
          author,
        } satisfies HealthPlanConfirmationReceiptEntry;
      } catch {
        return null;
      }
    })
    .filter((entry): entry is HealthPlanConfirmationReceiptEntry => Boolean(entry));
}

export function deriveHealthPlanConfirmationStatus(
  items?: HealthPlanConfirmationItemLike[] | null,
  entries?: HealthPlanConfirmationReceiptEntry[] | null,
): HealthPlanConfirmationStatus[] {
  const latestByCode = new Map<string, HealthPlanConfirmationReceiptEntry>();
  for (const entry of safeArray(entries)) {
    const existing = latestByCode.get(entry.code);
    const entryTime = timestampValue(entry.timestamp) ?? -Infinity;
    const existingTime = timestampValue(existing?.timestamp) ?? -Infinity;
    if (!existing || entryTime >= existingTime) {
      latestByCode.set(entry.code, entry);
    }
  }

  return safeArray(items)
    .map((item) => {
      const code = resolveHealthPlanConfirmationCode(item);
      if (!code) return null;
      const receipt = latestByCode.get(code);
      return {
        code,
        text: normalizeText(item.text) || receipt?.text || null,
        priority: item.priority === "high" ? "high" : item.priority === "medium" ? "medium" : receipt?.priority || null,
        dueWindow:
          item.due_window === "same_day"
            ? "same_day"
            : item.due_window === "within_24h"
              ? "within_24h"
              : receipt?.dueWindow || null,
        timestamp: receipt?.timestamp || null,
        author: receipt?.author || null,
        confirmed: Boolean(receipt),
        confirmedAt: receipt?.timestamp || null,
        confirmedBy: receipt?.author || null,
      } satisfies HealthPlanConfirmationStatus;
    })
    .filter((item): item is HealthPlanConfirmationStatus => Boolean(item));
}

export function findLatestHealthPlanConfirmationReceipt(
  entries?: HealthPlanConfirmationReceiptEntry[] | HealthPlanConfirmationStatus[] | null,
): HealthPlanConfirmationReceiptEntry | HealthPlanConfirmationStatus | null {
  let latest: HealthPlanConfirmationReceiptEntry | HealthPlanConfirmationStatus | null = null;
  let latestTime = -Infinity;
  for (const entry of safeArray(entries)) {
    const time = timestampValue(entry.timestamp) ?? timestampValue("confirmedAt" in entry ? entry.confirmedAt : null) ?? -Infinity;
    if (time <= latestTime) continue;
    latest = entry;
    latestTime = time;
  }
  return latest;
}

export function stripHealthPlanConfirmationNotes(notes?: string | null): string | null {
  if (!notes) return null;
  const filtered = notes
    .split(/\n\s*\n/g)
    .map((block) => block.trim())
    .filter(Boolean)
    .filter((block) => !block.includes(HEALTH_PLAN_CONFIRMATION_NOTE_PREFIX))
    .join("\n\n")
    .trim();
  return filtered || null;
}
