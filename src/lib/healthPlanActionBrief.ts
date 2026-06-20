import type { HealthPlanAccountability, HealthPlanAccountabilityReceiptCode } from "@/lib/healthPlanAccountability";
import type { OperationalHealthPlan, OperationalHealthPlanCoordination } from "@/lib/operationalDemoData";
import type { HealthPlanCommunicationPack } from "@/lib/healthPlanCommunication";
import type { HealthPlanIncidentPlaybook } from "@/lib/healthPlanIncidentPlaybooks";
import type { HealthPlanResponseTracker, HealthPlanResponseTrackerStepCode } from "@/lib/healthPlanResponseTracker";
import type { HealthPlanSharePack } from "@/lib/healthPlanSharing";

export type HealthPlanActionBriefState = "urgent" | "watch" | "stable";

export interface HealthPlanActionBrief {
  state: HealthPlanActionBriefState;
  responseWindow: "same_day" | "within_24h";
  nextActionCode?: string | null;
  quickActions: HealthPlanResponseTrackerStepCode[];
  receiptActions: HealthPlanAccountabilityReceiptCode[];
  movementState?: "fresh" | "stalled" | "quiet";
  staleAfterHours?: number | null;
  clockStartedAt?: string | null;
  minutesSinceMovement?: number | null;
  minutesUntilStale?: number | null;
  minutesOverdue?: number | null;
  lastMovementAt?: string | null;
  lastMovementBy?: string | null;
  lastMovementCode?: HealthPlanAccountabilityReceiptCode | null;
  movementSummary?: string | null;
  blockedReceiptCodes: HealthPlanAccountabilityReceiptCode[];
  staffNow: string[];
  elderNow: string[];
  careCircleNow: string[];
  successChecks: string[];
  staffOnlyBoundary: boolean;
}

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

function openCommitments(coordination?: OperationalHealthPlanCoordination | null) {
  return safeArray(coordination?.commitments).filter((item) => item?.status === "open");
}

function pendingSteps(responseTracker?: HealthPlanResponseTracker | null) {
  return safeArray(responseTracker?.steps).filter((step) => step?.state === "pending");
}

function uniqueCodes(items: Array<HealthPlanResponseTrackerStepCode | null | undefined>, limit = 3) {
  const seen = new Set<HealthPlanResponseTrackerStepCode>();
  const result: HealthPlanResponseTrackerStepCode[] = [];
  for (const item of items) {
    if (!item || seen.has(item)) continue;
    seen.add(item);
    result.push(item);
    if (result.length >= limit) break;
  }
  return result;
}

function uniqueReceiptCodes(items: Array<HealthPlanAccountabilityReceiptCode | null | undefined>, limit = 3) {
  const seen = new Set<HealthPlanAccountabilityReceiptCode>();
  const result: HealthPlanAccountabilityReceiptCode[] = [];
  for (const item of items) {
    if (!item || seen.has(item)) continue;
    seen.add(item);
    result.push(item);
    if (result.length >= limit) break;
  }
  return result;
}

function timestampValue(value?: string | null) {
  const text = normalizeText(value);
  if (!text) return null;
  const time = new Date(text).getTime();
  return Number.isNaN(time) ? null : time;
}

function latestTimestamp(values: Array<string | null | undefined>) {
  let latest: number | null = null;
  let latestIso: string | null = null;
  for (const value of values) {
    const time = timestampValue(value);
    if (time == null || (latest != null && time <= latest)) continue;
    latest = time;
    latestIso = normalizeText(value) || null;
  }
  return latestIso;
}

export function deriveHealthPlanActionBrief(input: {
  healthPlan?: OperationalHealthPlan | null;
  coordination?: OperationalHealthPlanCoordination | null;
  responseTracker?: HealthPlanResponseTracker | null;
  accountability?: HealthPlanAccountability | null;
  sharePack?: HealthPlanSharePack | null;
  communicationPack?: HealthPlanCommunicationPack | null;
  incidentPlaybooks?: HealthPlanIncidentPlaybook[] | null;
  now?: Date;
}): HealthPlanActionBrief | null {
  const plan = input.healthPlan;
  const responseTracker = input.responseTracker;
  const accountability = input.accountability;
  const sharePack = input.sharePack;
  const communicationPack = input.communicationPack;
  if (!plan || !responseTracker || !sharePack || !communicationPack) return null;

  const coordination = input.coordination || null;
  const playbooks = safeArray(input.incidentPlaybooks);
  const primaryPlaybook = playbooks[0] || null;
  const open = openCommitments(coordination);
  const pending = pendingSteps(responseTracker);
  const staffOnlyBoundary = sharePack.sharingBoundary === "staff_only";
  const now = input.now instanceof Date ? input.now : new Date();

  const staffNow = uniqueNonEmpty([
    open[0]?.detail,
    open[1]?.detail,
    primaryPlaybook?.teamSteps?.[0],
    primaryPlaybook?.teamSteps?.[1],
    safeArray(plan.monitoring_json)[0]?.text as string | undefined,
  ]);

  const elderNow = uniqueNonEmpty([
    primaryPlaybook?.clientSteps?.[0],
    primaryPlaybook?.clientSteps?.[1],
    communicationPack.clientScript[0],
    sharePack.todayFocus[0],
    sharePack.clientHighlights[0],
  ]);

  const careCircleNow = staffOnlyBoundary
    ? []
    : uniqueNonEmpty([
        communicationPack.careCircleScript[0],
        communicationPack.careCircleScript[1],
        sharePack.careCircleHighlights[0],
        sharePack.todayFocus[0],
      ]);

  const successChecks = uniqueNonEmpty([
    open[0]?.proof_hint as string | undefined,
    open[1]?.proof_hint as string | undefined,
    pending[0]?.proofHint,
    primaryPlaybook?.closeWhen?.[0],
    primaryPlaybook?.closeWhen?.[1],
  ]);
  const quickActions = uniqueCodes([
    responseTracker.nextStepCode || null,
    pending[1]?.code,
    staffOnlyBoundary ? null : "update_care_circle",
  ]);
  const receiptActions = uniqueReceiptCodes(
    safeArray(accountability?.receipts)
      .filter((receipt) => receipt?.status === "pending")
      .map((receipt) => receipt.code),
  );
  const blockedReceiptCodes = uniqueReceiptCodes(
    safeArray(accountability?.receipts)
      .filter((receipt) => receipt?.status === "pending" && receipt.priority === "high")
      .map((receipt) => receipt.code),
    2,
  );
  const clockStartedAt = accountability?.lastMovementAt || latestTimestamp([
    plan.reviewed_at,
    plan.generated_at,
    plan.updated_at,
  ]);
  const clockStartedMs = timestampValue(clockStartedAt);
  const minutesSinceMovement =
    clockStartedMs == null
      ? null
      : Math.max(0, Math.floor((now.getTime() - clockStartedMs) / (1000 * 60)));
  const staleAfterHours = accountability?.staleAfterHours ?? null;
  const staleThresholdMinutes =
    staleAfterHours == null
      ? null
      : Math.max(0, Math.round(staleAfterHours * 60));
  const minutesUntilStale =
    minutesSinceMovement == null || staleThresholdMinutes == null
      ? null
      : Math.max(0, staleThresholdMinutes - minutesSinceMovement);
  const minutesOverdue =
    minutesSinceMovement == null || staleThresholdMinutes == null
      ? null
      : Math.max(0, minutesSinceMovement - staleThresholdMinutes);

  return {
    state: responseTracker.state,
    responseWindow: responseTracker.responseWindow,
    nextActionCode: responseTracker.nextStepCode || coordination?.recommended_action_code || primaryPlaybook?.actionCode || null,
    quickActions,
    receiptActions,
    movementState: accountability?.movementState,
    staleAfterHours,
    clockStartedAt,
    minutesSinceMovement,
    minutesUntilStale,
    minutesOverdue,
    lastMovementAt: accountability?.lastMovementAt || null,
    lastMovementBy: accountability?.lastMovementBy || null,
    lastMovementCode: accountability?.lastMovementCode || null,
    movementSummary: accountability?.summaryText || null,
    blockedReceiptCodes,
    staffNow,
    elderNow,
    careCircleNow,
    successChecks,
    staffOnlyBoundary,
  };
}
