import type { HealthPlanCommunicationPack } from "@/lib/healthPlanCommunication";
import type { HealthPlanSharePack } from "@/lib/healthPlanSharing";

export interface HealthPlanAudienceActionItem {
  text: string;
  dueWindow?: "same_day" | "within_24h" | null;
  priority?: "high" | "medium" | null;
}

export interface HealthPlanAudienceBriefingsPack {
  responseWindow: "same_day" | "within_24h";
  sharingBoundary: "staff_only" | "approved_circle";
  elderLines: string[];
  careCircleLines: string[];
  staffItems: HealthPlanAudienceActionItem[];
}

type VerificationEntry = {
  text?: string | null;
  due_window?: "same_day" | "within_24h" | null;
  priority?: "high" | "medium" | null;
};

function safeArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

function normalizeText(value?: string | null) {
  return typeof value === "string" ? value.trim() : "";
}

function uniqueNonEmpty(items: Array<string | null | undefined>, limit = 4) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of items) {
    const text = normalizeText(item);
    if (!text || seen.has(text)) continue;
    seen.add(text);
    result.push(text);
    if (result.length >= limit) break;
  }
  return result;
}

function uniqueActionItems(items: Array<HealthPlanAudienceActionItem | null | undefined>, limit = 4) {
  const seen = new Set<string>();
  const result: HealthPlanAudienceActionItem[] = [];
  for (const item of items) {
    const text = normalizeText(item?.text);
    if (!text || seen.has(text)) continue;
    seen.add(text);
    result.push({
      text,
      dueWindow: item?.dueWindow || null,
      priority: item?.priority || null,
    });
    if (result.length >= limit) break;
  }
  return result;
}

export function deriveHealthPlanAudienceBriefingsPack(input: {
  communicationPack?: HealthPlanCommunicationPack | null;
  sharePack?: HealthPlanSharePack | null;
  nextConfirmations?: VerificationEntry[] | null;
  openQuestions?: VerificationEntry[] | null;
  responseWindow?: "same_day" | "within_24h" | null;
}): HealthPlanAudienceBriefingsPack | null {
  const communicationPack = input.communicationPack;
  const sharePack = input.sharePack;
  if (!communicationPack || !sharePack) return null;

  const nextConfirmations = safeArray(input.nextConfirmations);
  const openQuestions = safeArray(input.openQuestions);
  const responseWindow =
    input.responseWindow === "same_day" || sharePack.shareState === "hold"
      ? "same_day"
      : "within_24h";

  const elderLines = uniqueNonEmpty([
    ...safeArray(communicationPack.clientScript),
    ...safeArray(sharePack.todayFocus),
  ], 4);

  const careCircleLines =
    sharePack.sharingBoundary === "approved_circle" && communicationPack.state !== "hold"
      ? uniqueNonEmpty([
          ...safeArray(communicationPack.careCircleScript),
          ...safeArray(sharePack.todayFocus),
        ], 4)
      : [];

  const staffItems = uniqueActionItems([
    ...nextConfirmations.map((item) => ({
      text: item.text,
      dueWindow: item.due_window || responseWindow,
      priority: item.priority || (item.due_window === "same_day" ? "high" : "medium"),
    })),
    ...openQuestions.map((item) => ({
      text: item.text,
      dueWindow: item.due_window || responseWindow,
      priority: item.priority || "medium",
    })),
    ...safeArray(sharePack.todayFocus).map((text) => ({
      text,
      dueWindow: responseWindow,
      priority: responseWindow === "same_day" ? "high" : "medium",
    })),
  ], 4);

  return {
    responseWindow,
    sharingBoundary: sharePack.sharingBoundary,
    elderLines,
    careCircleLines,
    staffItems,
  };
}
