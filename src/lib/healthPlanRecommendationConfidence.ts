import type {
  HealthPlanSectionItem,
  HealthPlanSourceSignal,
  OperationalHealthPlanContextSnapshot,
} from "@/lib/operationalDemoData";

export type HealthPlanRecommendationConfidenceState = "ready" | "verify_first" | "urgent_review";
export type HealthPlanRecommendationConfidenceUseMode =
  | "ready_with_judgment"
  | "verify_before_use"
  | "staff_review_only";

export interface HealthPlanRecommendationConfidence {
  state: HealthPlanRecommendationConfidenceState | "staff_review_only";
  reasonCodes: string[];
  signalLabels: string[];
  verificationText: string;
  useMode?: HealthPlanRecommendationConfidenceUseMode | null;
}

function safeArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

function normalizeText(value?: string | null) {
  return typeof value === "string" ? value.trim() : "";
}

function unique<T>(items: T[]) {
  return [...new Set(items)];
}

const urgentSignalIds = new Set([
  "alert-active",
  "execution-stalled",
  "outcome-handoff-open",
  "outcome-incident-open",
  "plan-memory-receipt-gap",
  "evidence-predictive-live-mismatch",
  "evidence-passive-signal-conflict",
]);

const reviewSignalIds = new Set([
  "execution-contact-path-weak",
  "execution-followthrough-open",
  "execution-care-circle-route-open",
  "execution-same-channel-repeated",
  "plan-memory-stalled-tactics",
  "plan-memory-review-actions",
  "plan-memory-evidence-drift",
  "context-live-profile-only",
]);

export function deriveHealthPlanRecommendationConfidence(input: {
  item?: HealthPlanSectionItem | null;
  signals?: HealthPlanSourceSignal[] | null;
  contextSnapshot?: OperationalHealthPlanContextSnapshot | null;
  section?: "summary" | "goals" | "daily_support" | "monitoring" | "escalation" | "caregiver_guidance";
}): HealthPlanRecommendationConfidence | null {
  const item = input.item;
  if (!item || normalizeText(item.text).length === 0) return null;
  const signalLookup = new Map(
    safeArray(input.signals)
      .map((signal) => [normalizeText(signal.id), signal] as const)
      .filter(([id]) => Boolean(id)),
  );

  const backendUseMode = normalizeText(item.recommendation_use_mode).toLowerCase();
  if (
    backendUseMode === "ready_with_judgment"
    || backendUseMode === "verify_before_use"
    || backendUseMode === "staff_review_only"
  ) {
    const backendSignalLabels = unique(
      safeArray(item.source_signal_ids)
        .map((signalId) => signalLookup.get(normalizeText(signalId)))
        .map((signal) => normalizeText(signal?.label))
        .filter(Boolean),
    ).slice(0, 3);
    return {
      state:
        backendUseMode === "ready_with_judgment"
          ? "ready"
          : backendUseMode === "verify_before_use"
            ? "verify_first"
            : "staff_review_only",
      useMode: backendUseMode as HealthPlanRecommendationConfidenceUseMode,
      reasonCodes: unique(safeArray(item.recommendation_use_reason_codes).map((code) => normalizeText(code)).filter(Boolean)),
      signalLabels: backendSignalLabels,
      verificationText:
        normalizeText(item.recommendation_use_summary)
        || normalizeText(item.evidence_review_summary)
        || (
          backendUseMode === "ready_with_judgment"
            ? "Ready to use with normal staff judgment."
            : backendUseMode === "verify_before_use"
              ? "Verify this recommendation before relying on it."
              : "Keep this recommendation in staff-only review until the live picture is clearer."
        ),
    };
  }

  const signalIds = unique(safeArray(item.source_signal_ids).map((signalId) => normalizeText(signalId)).filter(Boolean));
  if (signalIds.length === 0) {
    return {
      state: "urgent_review",
      reasonCodes: ["missing_evidence"],
      signalLabels: [],
      verificationText: "Link this recommendation to the evidence or staff note it depends on before treating it as reliable.",
    };
  }

  const linkedSignals = signalIds
    .map((signalId) => signalLookup.get(signalId))
    .filter((signal): signal is HealthPlanSourceSignal => Boolean(signal));
  const signalLabels = unique(linkedSignals.map((signal) => normalizeText(signal.label)).filter(Boolean)).slice(0, 3);

  const liveCount = linkedSignals.filter((signal) => normalizeText(signal.freshness).toLowerCase() === "live").length;
  const recentCount = linkedSignals.filter((signal) => normalizeText(signal.freshness).toLowerCase() === "recent").length;
  const staleCount = linkedSignals.filter((signal) => normalizeText(signal.freshness).toLowerCase() === "stale").length;
  const highCount = linkedSignals.filter((signal) => normalizeText(signal.strength).toLowerCase() === "high").length;
  const linkedSignalIdSet = new Set(linkedSignals.map((signal) => normalizeText(signal.id)).filter(Boolean));

  const matchingConfirmations = safeArray(input.contextSnapshot?.next_confirmations as Array<{ text?: string | null; signal_ids?: string[] }>)
    .filter((itemConfirmation) =>
      safeArray(itemConfirmation?.signal_ids)
        .map((signalId) => normalizeText(signalId))
        .some((signalId) => linkedSignalIdSet.has(signalId)),
    );

  const touchesUrgentSignal = [...linkedSignalIdSet].some((signalId) => urgentSignalIds.has(signalId));
  const touchesReviewSignal = [...linkedSignalIdSet].some((signalId) => reviewSignalIds.has(signalId));
  const touchesCriticalSignal = safeArray(input.contextSnapshot?.critical_signal_ids).some((signalId) => linkedSignalIdSet.has(normalizeText(signalId)));
  const staleOnly = staleCount > 0 && liveCount === 0 && recentCount === 0;
  const sectionNeedsCarefulFollowThrough = input.section === "monitoring" || input.section === "escalation";

  if (touchesUrgentSignal || (touchesCriticalSignal && sectionNeedsCarefulFollowThrough) || (highCount > 0 && matchingConfirmations.length > 0)) {
    return {
      state: "urgent_review",
      reasonCodes: unique([
        touchesUrgentSignal ? "urgent_signal_linked" : null,
        touchesCriticalSignal ? "critical_signal_linked" : null,
        matchingConfirmations.length > 0 ? "followthrough_open" : null,
      ].filter((code): code is string => Boolean(code))),
      signalLabels,
      verificationText: matchingConfirmations[0]?.text
        ? `Staff review before relying on this: ${matchingConfirmations[0].text}`
        : "Staff review before relying on this. A named follow-through step or closure proof is still needed.",
    };
  }

  if (staleOnly || staleCount > 0 || touchesReviewSignal || matchingConfirmations.length > 0) {
    return {
      state: "verify_first",
      reasonCodes: unique([
        staleCount > 0 ? "stale_inputs" : null,
        touchesReviewSignal ? "review_signal_linked" : null,
        matchingConfirmations.length > 0 ? "fresh_check_needed" : null,
      ].filter((code): code is string => Boolean(code))),
      signalLabels,
      verificationText: matchingConfirmations[0]?.text
        ? `Verify first: ${matchingConfirmations[0].text}`
        : "Verify this recommendation against a fresh touchpoint before treating it as current.",
    };
  }

  return {
    state: "ready",
    reasonCodes: ["grounded"],
    signalLabels,
    verificationText: "Ready to act with the current linked evidence and routine staff judgment.",
  };
}
