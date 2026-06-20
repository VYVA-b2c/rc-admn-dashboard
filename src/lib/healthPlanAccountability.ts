import type { OperationalHealthPlan } from "@/lib/operationalDemoData";
import type {
  HealthPlanHandoffNoteEntry,
  HealthPlanHandoffProgress,
  HealthPlanHandoffStatusEntry,
  HealthPlanHandoffSummary,
} from "@/lib/healthPlanHandoff";
import type { HealthPlanOutreachEntry, HealthPlanOutreachStatus } from "@/lib/healthPlanOutreach";
import type { HealthPlanSharePack } from "@/lib/healthPlanSharing";

export type HealthPlanAccountabilityState = "urgent" | "watch" | "stable";
export type HealthPlanAccountabilityMovementState = "fresh" | "stalled" | "quiet";
export type HealthPlanAccountabilityReceiptCode =
  | "plan_reviewed"
  | "handoff_recorded"
  | "owner_assigned"
  | "first_contact_made"
  | "client_brief_shared"
  | "care_circle_brief_shared"
  | "loop_closed";
export type HealthPlanAccountabilityReceiptStatus = "done" | "pending" | "not_needed";

export interface HealthPlanAccountabilityReceipt {
  code: HealthPlanAccountabilityReceiptCode;
  status: HealthPlanAccountabilityReceiptStatus;
  priority: "high" | "medium" | "low";
  timestamp?: string | null;
  author?: string | null;
  channel?: string | null;
}

export interface HealthPlanAccountability {
  state: HealthPlanAccountabilityState;
  movementState: HealthPlanAccountabilityMovementState;
  responseWindow: "same_day" | "within_24h";
  pendingCount: number;
  pendingHighCount: number;
  stalled: boolean;
  staleAfterHours: number;
  lastMovementAt: string | null;
  lastMovementBy: string | null;
  lastMovementCode: HealthPlanAccountabilityReceiptCode | null;
  summaryText: string;
  receipts: HealthPlanAccountabilityReceipt[];
}

function safeArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

function timestampValue(value?: string | null) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) return null;
  const time = new Date(text).getTime();
  return Number.isNaN(time) ? null : time;
}

function latestByTimestamp<T extends { timestamp?: string | null }>(entries: T[]): T | null {
  let latest: T | null = null;
  let latestTime = -Infinity;
  for (const entry of safeArray(entries)) {
    const time = timestampValue(entry.timestamp);
    if (time == null || time <= latestTime) continue;
    latest = entry;
    latestTime = time;
  }
  return latest;
}

function latestStatusEntry(entries: HealthPlanHandoffStatusEntry[], status: HealthPlanHandoffStatusEntry["status"]) {
  return latestByTimestamp(entries.filter((entry) => entry.status === status));
}

function latestMovementReceipt(receipts: HealthPlanAccountabilityReceipt[]) {
  let latest: HealthPlanAccountabilityReceipt | null = null;
  let latestTime = -Infinity;
  for (const receipt of receipts) {
    const time = timestampValue(receipt.timestamp);
    if (time == null || time <= latestTime) continue;
    latest = receipt;
    latestTime = time;
  }
  return latest;
}

function highUrgency(handoff?: HealthPlanHandoffSummary | null) {
  return handoff?.responseWindow === "same_day" || handoff?.priority === "high";
}

export function deriveHealthPlanAccountability(input: {
  healthPlan?: OperationalHealthPlan | null;
  handoff?: HealthPlanHandoffSummary | null;
  progress?: HealthPlanHandoffProgress | null;
  handoffNotes?: HealthPlanHandoffNoteEntry[] | null;
  handoffStatusEntries?: HealthPlanHandoffStatusEntry[] | null;
  outreachStatus?: HealthPlanOutreachStatus | null;
  outreachEntries?: HealthPlanOutreachEntry[] | null;
  sharePack?: HealthPlanSharePack | null;
  now?: Date;
}): HealthPlanAccountability | null {
  const plan = input.healthPlan;
  const handoff = input.handoff;
  if (!plan || !handoff) return null;

  const progress = input.progress;
  const handoffNotes = safeArray(input.handoffNotes);
  const handoffStatusEntries = safeArray(input.handoffStatusEntries);
  const outreachStatus = input.outreachStatus;
  const outreachEntries = safeArray(input.outreachEntries);
  const sharePack = input.sharePack;
  const now = input.now instanceof Date ? input.now : new Date();
  const responseWindow = handoff.responseWindow;
  const sameDay = highUrgency(handoff);
  const needsLoopClosure = sameDay || handoff.activeAlertCount > 0 || handoff.missedMedication || handoff.offlineSensorCount > 0;
  const clientShareAllowed = sharePack?.shareState !== "hold";
  const careCircleShareRequired = sharePack?.sharingBoundary === "approved_circle" && sharePack?.shareState !== "hold";

  const latestHandoff = latestByTimestamp(handoffNotes);
  const latestOwnerAssigned = latestStatusEntry(handoffStatusEntries, "owner_assigned");
  const latestFirstContact = latestStatusEntry(handoffStatusEntries, "first_contact_made");
  const latestLoopClosed = latestStatusEntry(handoffStatusEntries, "escalation_closed");
  const latestClientShare = outreachStatus?.latestClientShare || latestByTimestamp(outreachEntries.filter((entry) => entry.audience === "client"));
  const latestCareCircleShare = outreachStatus?.latestCareCircleShare || latestByTimestamp(outreachEntries.filter((entry) => entry.audience === "care_circle"));

  const ownerDone = !handoff.ownerMissing || Boolean(progress?.ownerAssigned);
  const firstContactDone = Boolean(progress?.firstContactMade);
  const clientShareDone = clientShareAllowed ? Boolean(outreachStatus?.clientShared) : false;
  const careCircleShareDone = careCircleShareRequired ? Boolean(outreachStatus?.careCircleShared) : false;
  const loopClosedDone = !needsLoopClosure || Boolean(progress?.escalationClosed);

  const receipts: HealthPlanAccountabilityReceipt[] = [
    {
      code: "plan_reviewed",
      status: plan.review_status === "reviewed" ? "done" : "pending",
      priority: sameDay ? "high" : "medium",
      timestamp: plan.reviewed_at || plan.generated_at || plan.updated_at || null,
      author: plan.reviewed_by_email || plan.last_actor_email || null,
    },
    {
      code: "handoff_recorded",
      status: latestHandoff ? "done" : "pending",
      priority: sameDay ? "high" : "medium",
      timestamp: latestHandoff?.timestamp || null,
      author: latestHandoff?.author || null,
    },
    {
      code: "owner_assigned",
      status: ownerDone ? "done" : "pending",
      priority: handoff.ownerMissing ? "high" : "medium",
      timestamp: latestOwnerAssigned?.timestamp || null,
      author: latestOwnerAssigned?.author || null,
    },
    {
      code: "first_contact_made",
      status: firstContactDone ? "done" : "pending",
      priority: sameDay ? "high" : "medium",
      timestamp: latestFirstContact?.timestamp || null,
      author: latestFirstContact?.author || null,
    },
    {
      code: "client_brief_shared",
      status: clientShareAllowed ? (clientShareDone ? "done" : "pending") : "not_needed",
      priority: sameDay ? "medium" : "low",
      timestamp: latestClientShare?.timestamp || null,
      author: latestClientShare?.author || null,
      channel: latestClientShare?.channel || null,
    },
    {
      code: "care_circle_brief_shared",
      status: careCircleShareRequired ? (careCircleShareDone ? "done" : "pending") : "not_needed",
      priority: sameDay ? "medium" : "low",
      timestamp: latestCareCircleShare?.timestamp || null,
      author: latestCareCircleShare?.author || null,
      channel: latestCareCircleShare?.channel || null,
    },
    {
      code: "loop_closed",
      status: loopClosedDone ? "done" : "pending",
      priority: needsLoopClosure ? (sameDay ? "high" : "medium") : "low",
      timestamp: latestLoopClosed?.timestamp || null,
      author: latestLoopClosed?.author || null,
    },
  ];

  const pending = receipts.filter((receipt) => receipt.status === "pending");
  const pendingHighCount = pending.filter((receipt) => receipt.priority === "high").length;
  const pendingCount = pending.length;
  const latestReceipt = latestMovementReceipt(receipts.filter((receipt) => receipt.code !== "plan_reviewed"));
  const baselineTimestamp = timestampValue(plan.reviewed_at || plan.generated_at || plan.updated_at);
  const movementTimestamp = timestampValue(latestReceipt?.timestamp) ?? baselineTimestamp;
  const staleAfterHours = responseWindow === "same_day" ? 3 : 12;
  const stalled = pendingCount > 0 && movementTimestamp != null
    ? (now.getTime() - movementTimestamp) / (1000 * 60 * 60) >= staleAfterHours
    : pendingCount > 0 && baselineTimestamp != null
      ? (now.getTime() - baselineTimestamp) / (1000 * 60 * 60) >= staleAfterHours
      : false;

  const movementState: HealthPlanAccountabilityMovementState =
    stalled
      ? "stalled"
      : latestReceipt?.timestamp
        ? "fresh"
        : "quiet";

  const state: HealthPlanAccountabilityState =
    stalled || pendingHighCount > 0
      ? "urgent"
      : pendingCount > 0
        ? "watch"
        : "stable";

  const summaryText =
    state === "urgent"
      ? stalled
        ? "High-priority follow-through is still open and the care circle has not recorded fresh movement."
        : "High-priority follow-through is still missing from the care-circle record."
      : state === "watch"
        ? "The plan is moving, but some care-circle receipts are still missing."
        : "The care circle has recorded the key follow-through steps for this plan.";

  return {
    state,
    movementState,
    responseWindow,
    pendingCount,
    pendingHighCount,
    stalled,
    staleAfterHours,
    lastMovementAt: latestReceipt?.timestamp || null,
    lastMovementBy: latestReceipt?.author || null,
    lastMovementCode: latestReceipt?.code || null,
    summaryText,
    receipts,
  };
}
