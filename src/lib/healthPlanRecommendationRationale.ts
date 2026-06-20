import type {
  HealthPlanSectionItem,
  HealthPlanSourceSignal,
  OperationalHealthPlanContextSnapshot,
} from "@/lib/operationalDemoData";
import {
  deriveHealthPlanRecommendationConfidence,
  type HealthPlanRecommendationConfidenceState,
} from "@/lib/healthPlanRecommendationConfidence";
import {
  deriveHealthPlanItemEvidenceStatus,
  type HealthPlanProvenanceDriver,
} from "@/lib/healthPlanProvenance";

type RecommendationSection =
  | "summary"
  | "goals"
  | "daily_support"
  | "monitoring"
  | "escalation"
  | "caregiver_guidance";

export interface HealthPlanRecommendationRationale {
  driverCodes: HealthPlanProvenanceDriver[];
  signalLabels: string[];
  confidenceState: HealthPlanRecommendationConfidenceState;
  evidenceState: "linked" | "stale" | "missing";
  verificationText: string;
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

function driverFromSignal(signal?: HealthPlanSourceSignal | null): HealthPlanProvenanceDriver {
  const category = normalizeText(signal?.category).toLowerCase();
  const label = normalizeText(signal?.label).toLowerCase();
  if (category === "risk" || category === "forecast" || label.includes("risk") || label.includes("forecast")) return "risk_outlook";
  if (category === "alert" || label.includes("alert")) return "active_alerts";
  if (category === "medication" || label.includes("medication") || label.includes("dose") || label.includes("reminder")) return "medication_followup";
  if (category === "sensor" || label.includes("sensor") || label.includes("device")) return "sensor_reliability";
  if (category === "service" || label.includes("check-in") || label.includes("brain coach") || label.includes("routine")) return "support_routines";
  if (category === "care-circle" || label.includes("consent") || label.includes("care circle") || label.includes("family sharing")) return "care_circle_context";
  return "live_profile_context";
}

export function deriveHealthPlanRecommendationRationale(input: {
  item?: HealthPlanSectionItem | null;
  signals?: HealthPlanSourceSignal[] | null;
  contextSnapshot?: OperationalHealthPlanContextSnapshot | null;
  section?: RecommendationSection;
}): HealthPlanRecommendationRationale | null {
  const item = input.item;
  if (!item || normalizeText(item.text).length === 0) return null;

  const normalizedSignals = safeArray(input.signals);
  const signalLookup = new Map(
    normalizedSignals
      .map((signal) => [normalizeText(signal.id), signal] as const)
      .filter(([id]) => Boolean(id)),
  );

  const linkedSignals = unique(
    safeArray(item.source_signal_ids)
      .map((signalId) => signalLookup.get(normalizeText(signalId)))
      .filter((signal): signal is HealthPlanSourceSignal => Boolean(signal)),
  );
  const signalLabels = unique(
    linkedSignals.map((signal) => normalizeText(signal.label)).filter(Boolean),
  ).slice(0, 3);
  const driverCodes = unique(linkedSignals.map((signal) => driverFromSignal(signal))).slice(0, 3);

  const evidenceStatus = deriveHealthPlanItemEvidenceStatus({
    item,
    signals: normalizedSignals,
  });
  const confidence = deriveHealthPlanRecommendationConfidence({
    item,
    signals: normalizedSignals,
    contextSnapshot: input.contextSnapshot,
    section: input.section,
  });

  if (!confidence && !evidenceStatus && driverCodes.length === 0 && signalLabels.length === 0) {
    return null;
  }

  return {
    driverCodes,
    signalLabels,
    confidenceState: confidence?.state || "ready",
    evidenceState: evidenceStatus?.state || "missing",
    verificationText: confidence?.verificationText || "Review the linked evidence before relying on this recommendation.",
  };
}
