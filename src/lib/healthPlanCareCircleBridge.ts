import type { HealthPlanAccountability } from "@/lib/healthPlanAccountability";
import type { HealthPlanAudienceBriefingsPack } from "@/lib/healthPlanAudienceBriefings";
import type { HealthPlanConfirmationStatus } from "@/lib/healthPlanConfirmations";
import type { HealthPlanHandoffSummary } from "@/lib/healthPlanHandoff";
import type { HealthPlanSharePack } from "@/lib/healthPlanSharing";

export type HealthPlanCareCircleBridgeState = "urgent" | "watch" | "stable";
export type HealthPlanCareCircleRealityState = "stalled" | "verify_today" | "fresh";

export interface HealthPlanCareCircleBridge {
  state: HealthPlanCareCircleBridgeState;
  responseWindow: "same_day" | "within_24h";
  ownerName: string | null;
  ownerMissing: boolean;
  sharingBoundary: "staff_only" | "approved_circle";
  shareState: "hold" | "review" | "ready";
  realityState: HealthPlanCareCircleRealityState;
  lastMovementAt: string | null;
  elderLead: string | null;
  careCircleLead: string | null;
  summaryText: string;
  cautionText: string;
  confirmNow: string[];
}

type VerificationEntry = {
  text?: string | null;
};

function safeArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

function normalizeText(value?: string | null) {
  return typeof value === "string" ? value.trim() : "";
}

function uniqueNonEmpty(items: Array<string | null | undefined>, limit = 3) {
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

export function deriveHealthPlanCareCircleBridge(input: {
  handoff?: HealthPlanHandoffSummary | null;
  accountability?: HealthPlanAccountability | null;
  sharePack?: HealthPlanSharePack | null;
  audienceBriefings?: HealthPlanAudienceBriefingsPack | null;
  nextConfirmations?: VerificationEntry[] | null;
  confirmationStatuses?: HealthPlanConfirmationStatus[] | null;
  openQuestions?: VerificationEntry[] | null;
}): HealthPlanCareCircleBridge | null {
  const handoff = input.handoff;
  const accountability = input.accountability;
  const sharePack = input.sharePack;
  const audienceBriefings = input.audienceBriefings;
  if (!handoff || !accountability || !sharePack || !audienceBriefings) return null;

  const shareState =
    sharePack.shareState === "hold" || sharePack.shareState === "review"
      ? sharePack.shareState
      : "ready";
  const confirmationStatuses = safeArray(input.confirmationStatuses);
  const pendingConfirmationTexts =
    confirmationStatuses.length > 0
      ? confirmationStatuses.filter((item) => !item.confirmed).map((item) => item.text)
      : safeArray(input.nextConfirmations).map((item) => item?.text);
  const hasPendingConfirmations = pendingConfirmationTexts.some((item) => normalizeText(item));
  const allConfirmationsDone = confirmationStatuses.length > 0 && !hasPendingConfirmations;
  const state: HealthPlanCareCircleBridgeState =
    accountability.state === "urgent"
      ? "urgent"
      : accountability.pendingHighCount > 0 || shareState !== "ready"
        ? "watch"
        : "stable";
  const realityState: HealthPlanCareCircleRealityState =
    accountability.stalled
      ? "stalled"
      : hasPendingConfirmations || (accountability.movementState === "quiet" && !allConfirmationsDone)
        ? "verify_today"
        : "fresh";

  const confirmNow = uniqueNonEmpty(pendingConfirmationTexts);

  const elderLead = normalizeText(audienceBriefings.elderLines[0]) || null;
  const careCircleLead =
    handoff.sharingBoundary === "approved_circle" && shareState !== "hold"
      ? normalizeText(audienceBriefings.careCircleLines[0]) || null
      : null;

  let summaryText = "The next care-circle move is covered and can stay practical.";
  if (accountability.stalled && shareState === "hold") {
    summaryText = "Fresh follow-through is missing, and the message should stay inside staff until the picture is refreshed.";
  } else if (accountability.stalled) {
    summaryText = "Fresh follow-through is missing, so nobody should assume this plan still matches reality.";
  } else if (handoff.ownerMissing) {
    summaryText = "The next step is still unowned, so the care circle needs a named person before things drift.";
  } else if (shareState === "hold") {
    summaryText = "Keep the message inside staff until the plan is ready for outward sharing.";
  } else if (shareState === "review") {
    summaryText = "The plan is usable, but one careful review should happen before the care circle leans on it.";
  } else if (hasPendingConfirmations) {
    summaryText = "The care circle can help, but one or two confirmations should still happen before anyone relaxes.";
  }

  let cautionText = "The live picture is grounded enough to use in plain language.";
  if (realityState === "stalled") {
    cautionText = "Treat this as time-sensitive until a fresh touchpoint is recorded.";
  } else if (realityState === "verify_today") {
    cautionText = "Use this with same-day verification rather than assuming the last picture is still current.";
  } else if (shareState === "hold") {
    cautionText = "Do not pass client-specific detail beyond staff or approved providers yet.";
  } else if (shareState === "review") {
    cautionText = "Share carefully and keep the language practical, not overconfident.";
  }

  return {
    state,
    responseWindow: handoff.responseWindow,
    ownerName: handoff.ownerName || null,
    ownerMissing: handoff.ownerMissing,
    sharingBoundary: handoff.sharingBoundary,
    shareState,
    realityState,
    lastMovementAt: accountability.lastMovementAt || null,
    elderLead,
    careCircleLead,
    summaryText,
    cautionText,
    confirmNow,
  };
}
