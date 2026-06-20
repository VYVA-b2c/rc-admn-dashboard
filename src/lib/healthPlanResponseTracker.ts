import type { OperationalHealthPlan } from "@/lib/operationalDemoData";
import type { HealthPlanHandoffProgress, HealthPlanHandoffSummary } from "@/lib/healthPlanHandoff";
import type { HealthPlanOutreachStatus } from "@/lib/healthPlanOutreach";
import type { HealthPlanSharePack } from "@/lib/healthPlanSharing";

export type HealthPlanResponseTrackerState = "urgent" | "watch" | "stable";
export type HealthPlanResponseTrackerStepCode =
  | "review_plan"
  | "assign_owner"
  | "contact_client"
  | "update_care_circle"
  | "close_loop";

export type HealthPlanResponseTrackerStepState = "done" | "pending";

export interface HealthPlanResponseTrackerStep {
  code: HealthPlanResponseTrackerStepCode;
  state: HealthPlanResponseTrackerStepState;
  priority: "high" | "medium" | "low";
  proofHint?: string | null;
}

export interface HealthPlanResponseTracker {
  state: HealthPlanResponseTrackerState;
  responseWindow: "same_day" | "within_24h";
  completedCount: number;
  totalCount: number;
  nextStepCode: HealthPlanResponseTrackerStepCode | null;
  steps: HealthPlanResponseTrackerStep[];
}

function hasHighUrgency(handoff?: HealthPlanHandoffSummary | null) {
  return handoff?.responseWindow === "same_day" || handoff?.priority === "high";
}

function planReviewedAndUsable(plan?: OperationalHealthPlan | null) {
  if (!plan) return false;
  return plan.review_status === "reviewed" && plan.quality?.recommended_action !== "regenerate";
}

function shouldUpdateCareCircle(sharePack?: HealthPlanSharePack | null) {
  return sharePack?.sharingBoundary === "approved_circle" && sharePack?.shareState !== "hold";
}

function responseTrackerProofHint(code: HealthPlanResponseTrackerStepCode, handoff?: HealthPlanHandoffSummary | null, sharePack?: HealthPlanSharePack | null) {
  if (code === "review_plan") {
    return "Counts as done when a reviewed plan is saved and no regeneration warning is active.";
  }
  if (code === "assign_owner") {
    return "Counts as done when one named owner is linked on the profile or clearly named in the saved plan.";
  }
  if (code === "contact_client") {
    return handoff?.responseWindow === "same_day"
      ? "Counts as done when the first same-day client touchpoint is recorded."
      : "Counts as done when the next client touchpoint is recorded.";
  }
  if (code === "update_care_circle") {
    return sharePack?.sharingBoundary === "approved_circle"
      ? "Counts as done when an approved care-circle update is logged after the client follow-up."
      : "Counts as done when staff confirm no outside care-circle update is needed.";
  }
  return "Counts as done when the urgent issue is either resolved or explicitly handed off as closed.";
}

export function deriveHealthPlanResponseTracker(input: {
  healthPlan?: OperationalHealthPlan | null;
  handoff?: HealthPlanHandoffSummary | null;
  progress?: HealthPlanHandoffProgress | null;
  outreachStatus?: HealthPlanOutreachStatus | null;
  sharePack?: HealthPlanSharePack | null;
}): HealthPlanResponseTracker | null {
  const plan = input.healthPlan;
  const handoff = input.handoff;
  const progress = input.progress;
  const outreachStatus = input.outreachStatus;
  const sharePack = input.sharePack;

  if (!plan || !handoff) return null;

  const reviewed = planReviewedAndUsable(plan);
  const ownerCovered = !handoff.ownerMissing || Boolean(progress?.ownerAssigned);
  const clientContactCovered = Boolean(progress?.firstContactMade || outreachStatus?.clientShared);
  const careCircleCovered = shouldUpdateCareCircle(sharePack) ? Boolean(outreachStatus?.careCircleShared) : true;
  const needsLoopClosure = hasHighUrgency(handoff) || handoff.activeAlertCount > 0 || handoff.missedMedication || handoff.offlineSensorCount > 0;
  const escalationClosed = !needsLoopClosure || Boolean(progress?.escalationClosed);

  const steps: HealthPlanResponseTrackerStep[] = [
    {
      code: "review_plan",
      state: reviewed ? "done" : "pending",
      priority: hasHighUrgency(handoff) ? "high" : "medium",
      proofHint: responseTrackerProofHint("review_plan", handoff, sharePack),
    },
    {
      code: "assign_owner",
      state: ownerCovered ? "done" : "pending",
      priority: handoff.ownerMissing ? "high" : "medium",
      proofHint: responseTrackerProofHint("assign_owner", handoff, sharePack),
    },
    {
      code: "contact_client",
      state: clientContactCovered ? "done" : "pending",
      priority: hasHighUrgency(handoff) ? "high" : "medium",
      proofHint: responseTrackerProofHint("contact_client", handoff, sharePack),
    },
  ];

  if (shouldUpdateCareCircle(sharePack)) {
    steps.push({
      code: "update_care_circle",
      state: careCircleCovered ? "done" : "pending",
      priority: hasHighUrgency(handoff) ? "medium" : "low",
      proofHint: responseTrackerProofHint("update_care_circle", handoff, sharePack),
    });
  }

  if (needsLoopClosure) {
    steps.push({
      code: "close_loop",
      state: escalationClosed ? "done" : "pending",
      priority: hasHighUrgency(handoff) ? "high" : "medium",
      proofHint: responseTrackerProofHint("close_loop", handoff, sharePack),
    });
  }

  const completedCount = steps.filter((step) => step.state === "done").length;
  const nextStepCode = steps.find((step) => step.state === "pending")?.code || null;
  const pendingHighCount = steps.filter((step) => step.state === "pending" && step.priority === "high").length;
  const pendingCount = steps.length - completedCount;

  const state: HealthPlanResponseTrackerState =
    pendingHighCount > 0
      ? "urgent"
      : pendingCount > 0
        ? "watch"
        : "stable";

  return {
    state,
    responseWindow: handoff.responseWindow,
    completedCount,
    totalCount: steps.length,
    nextStepCode,
    steps,
  };
}
