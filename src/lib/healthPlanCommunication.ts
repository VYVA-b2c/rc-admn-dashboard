import type { OperationalProfileResponse } from "@/lib/operationalDemoData";
import type { HealthPlanHandoffSummary } from "@/lib/healthPlanHandoff";
import type { HealthPlanSharePack } from "@/lib/healthPlanSharing";

export type HealthPlanCommunicationState = "ready" | "review" | "hold";
export type HealthPlanCommunicationGuardrailCode =
  | "hold_staff_only"
  | "review_before_share"
  | "assign_owner_first"
  | "same_day_tone"
  | "protect_family_boundary";

export interface HealthPlanCommunicationPack {
  state: HealthPlanCommunicationState;
  clientScript: string[];
  careCircleScript: string[];
  staffGuardrails: HealthPlanCommunicationGuardrailCode[];
}

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

export function deriveHealthPlanCommunicationPack(
  profile: Pick<OperationalProfileResponse, "healthPlan">,
  sharePack?: HealthPlanSharePack | null,
  handoff?: HealthPlanHandoffSummary | null,
): HealthPlanCommunicationPack | null {
  const plan = profile.healthPlan;
  if (!plan || !sharePack) return null;

  const state = sharePack.shareState;
  const clientScript = uniqueNonEmpty([
    ...safeArray(sharePack.clientHighlights),
    safeArray(sharePack.todayFocus)[0],
  ], 4);

  const careCircleScript =
    sharePack.sharingBoundary === "approved_circle" && state !== "hold"
      ? uniqueNonEmpty([
          ...safeArray(sharePack.careCircleHighlights),
          safeArray(sharePack.todayFocus)[0],
        ], 4)
      : [];

  const staffGuardrails: HealthPlanCommunicationGuardrailCode[] = [];
  if (state === "hold") staffGuardrails.push("hold_staff_only");
  if (state === "review") staffGuardrails.push("review_before_share");
  if (handoff?.ownerMissing) staffGuardrails.push("assign_owner_first");
  if (handoff?.responseWindow === "same_day") staffGuardrails.push("same_day_tone");
  if (sharePack.sharingBoundary === "staff_only") staffGuardrails.push("protect_family_boundary");

  return {
    state,
    clientScript,
    careCircleScript,
    staffGuardrails,
  };
}
