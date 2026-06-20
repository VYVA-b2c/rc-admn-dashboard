import type { OperationalProfileResponse } from "@/lib/operationalDemoData";
import type { HealthPlanHandoffSummary } from "@/lib/healthPlanHandoff";

export type HealthPlanShareState = "ready" | "review" | "hold";
export type HealthPlanShareBoundary = "staff_only" | "approved_circle";

export interface HealthPlanSharePack {
  shareState: HealthPlanShareState;
  sharingBoundary: HealthPlanShareBoundary;
  clientHighlights: string[];
  careCircleHighlights: string[];
  todayFocus: string[];
}

export interface HealthPlanShareAccess {
  canShareWithClient: boolean;
  canShareWithCareCircle: boolean;
  clientBlockedReason: "review_required" | null;
  careCircleBlockedReason: "review_required" | "consent_required" | null;
}

function safeArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

function normalizeText(value?: string | null) {
  return typeof value === "string" ? value.trim() : "";
}

function firstSentence(value?: string | null) {
  const text = normalizeText(value);
  if (!text) return "";
  const match = text.match(/^.+?[.!?](?:\s|$)/);
  return (match?.[0] || text).trim();
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

function handoffActionTextCode(actionCode?: string | null) {
  switch (String(actionCode || "").trim()) {
    case "confirm_today_touchpoint":
      return "touchpoint";
    case "review_alerts":
      return "alerts";
    case "verify_medication":
      return "medication";
    case "check_sensors":
      return "sensors";
    case "assign_owner":
      return "owner";
    case "confirm_sharing_boundary":
      return "sharing";
    default:
      return "routine";
  }
}

export function deriveHealthPlanSharePack(
  profile: Pick<OperationalProfileResponse, "consent" | "healthPlan">,
  handoff?: HealthPlanHandoffSummary | null,
): HealthPlanSharePack | null {
  const plan = profile.healthPlan;
  if (!plan) return null;

  const familyConsent = Boolean(profile.consent?.caretaker_consent ?? profile.consent?.consent_given);
  const shareState: HealthPlanShareState =
    plan.quality?.recommended_action === "regenerate"
      ? "hold"
      : plan.review_status === "reviewed" && plan.quality?.recommended_action !== "review"
        ? "ready"
        : "review";

  const clientHighlights = uniqueNonEmpty([
    firstSentence(plan.summary_text),
    safeArray(plan.daily_support_json)[0]?.text,
    safeArray(plan.monitoring_json)[0]?.text,
  ], 3);

  const careCircleHighlights = familyConsent
    ? uniqueNonEmpty([
        safeArray(plan.caregiver_guidance_json)[0]?.text,
        safeArray(plan.caregiver_guidance_json)[1]?.text,
        safeArray(plan.escalation_json)[0]?.text,
      ], 3)
    : [];

  const focusSeed = safeArray(handoff?.actions).map((action) => handoffActionTextCode(action.code));
  const focusFromPlan = [
    focusSeed.includes("touchpoint") ? safeArray(plan.daily_support_json)[0]?.text : null,
    focusSeed.includes("medication") ? safeArray(plan.daily_support_json).find((item) => /medic|dose|reminder/i.test(String(item?.text || "")))?.text : null,
    focusSeed.includes("alerts") ? safeArray(plan.monitoring_json)[0]?.text : null,
    focusSeed.includes("sensors") ? safeArray(plan.monitoring_json).find((item) => /sensor|device|report/i.test(String(item?.text || "")))?.text : null,
    focusSeed.includes("sharing") ? safeArray(plan.caregiver_guidance_json)[0]?.text : null,
    focusSeed.includes("owner") ? safeArray(plan.caregiver_guidance_json)[1]?.text : null,
    safeArray(plan.goals_json)[0]?.text,
  ];

  return {
    shareState,
    sharingBoundary: familyConsent ? "approved_circle" : "staff_only",
    clientHighlights,
    careCircleHighlights,
    todayFocus: uniqueNonEmpty(focusFromPlan, 3),
  };
}

export function deriveHealthPlanShareAccess(sharePack?: HealthPlanSharePack | null): HealthPlanShareAccess {
  if (!sharePack) {
    return {
      canShareWithClient: false,
      canShareWithCareCircle: false,
      clientBlockedReason: "review_required",
      careCircleBlockedReason: "review_required",
    };
  }

  const reviewReady = sharePack.shareState === "ready";
  const careCircleAllowed = reviewReady && sharePack.sharingBoundary === "approved_circle";

  return {
    canShareWithClient: reviewReady,
    canShareWithCareCircle: careCircleAllowed,
    clientBlockedReason: reviewReady ? null : "review_required",
    careCircleBlockedReason: !reviewReady
      ? "review_required"
      : sharePack.sharingBoundary === "approved_circle"
        ? null
        : "consent_required",
  };
}
