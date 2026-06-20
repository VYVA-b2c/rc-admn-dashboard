import type {
  HealthPlanSectionItem,
  HealthPlanSourceSignal,
  OperationalHealthPlanContextSnapshot,
} from "@/lib/operationalDemoData";

export type HealthPlanProvenanceDriver =
  | "risk_outlook"
  | "active_alerts"
  | "medication_followup"
  | "sensor_reliability"
  | "support_routines"
  | "care_circle_context"
  | "live_profile_context";

export type HealthPlanProvenanceSupportLevel = "strong" | "mixed" | "thin";

export interface HealthPlanItemEvidenceStatus {
  state: "linked" | "stale" | "missing";
  signalLabels: string[];
  staleSignalCount: number;
  liveSignalCount: number;
}

export interface HealthPlanSectionProvenance {
  driverCodes: HealthPlanProvenanceDriver[];
  signalLabels: string[];
  staleSignalCount: number;
  liveSignalCount: number;
  highPrioritySignalCount: number;
  signalCount: number;
  totalItemCount: number;
  linkedItemCount: number;
  uncoveredItemCount: number;
  supportLevel: HealthPlanProvenanceSupportLevel;
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

function collectSectionSignals(
  section: "summary" | "goals" | "daily_support" | "monitoring" | "escalation" | "caregiver_guidance",
  items: HealthPlanSectionItem[] | null | undefined,
  signals: HealthPlanSourceSignal[] | null | undefined,
  contextSnapshot?: OperationalHealthPlanContextSnapshot | null,
) {
  const signalLookup = new Map(safeArray(signals).map((signal) => [signal.id || "", signal] as const));
  const itemSignalIds =
    section === "summary"
      ? unique([
          ...safeArray(contextSnapshot?.evidence_digest?.top_priority_signal_ids as string[]),
          ...safeArray(contextSnapshot?.critical_signal_ids as string[]),
        ].filter(Boolean))
      : unique(
          safeArray(items)
            .flatMap((item) => safeArray(item?.source_signal_ids))
            .filter(Boolean),
        );
  return itemSignalIds.map((signalId) => signalLookup.get(signalId)).filter(Boolean) as HealthPlanSourceSignal[];
}

function countSectionItems(
  section: "summary" | "goals" | "daily_support" | "monitoring" | "escalation" | "caregiver_guidance",
  items: HealthPlanSectionItem[] | null | undefined,
  contextSnapshot?: OperationalHealthPlanContextSnapshot | null,
) {
  if (section === "summary") {
    const hasSummaryEvidence =
      safeArray(contextSnapshot?.evidence_digest?.top_priority_signal_ids as string[]).length > 0
      || safeArray(contextSnapshot?.critical_signal_ids as string[]).length > 0;
    return {
      totalItemCount: hasSummaryEvidence ? 1 : 0,
      linkedItemCount: hasSummaryEvidence ? 1 : 0,
      uncoveredItemCount: 0,
    };
  }

  const content = safeArray(items).filter((item) => normalizeText(item?.text).length > 0);
  const linkedItemCount = content.filter((item) => safeArray(item?.source_signal_ids).filter(Boolean).length > 0).length;
  return {
    totalItemCount: content.length,
    linkedItemCount,
    uncoveredItemCount: Math.max(0, content.length - linkedItemCount),
  };
}

function sectionSupportLevel(input: {
  signalCount: number;
  linkedItemCount: number;
  uncoveredItemCount: number;
  staleSignalCount: number;
  liveSignalCount: number;
}): HealthPlanProvenanceSupportLevel {
  if (input.signalCount === 0) return "thin";
  if (input.uncoveredItemCount > 0 && input.linkedItemCount === 0) return "thin";
  if (input.uncoveredItemCount > 0) return "mixed";
  if (input.staleSignalCount > 0) return "mixed";
  return "strong";
}

export function deriveHealthPlanItemEvidenceStatus(input: {
  item?: HealthPlanSectionItem | null;
  signals?: HealthPlanSourceSignal[] | null;
}): HealthPlanItemEvidenceStatus | null {
  const item = input.item;
  if (!item || normalizeText(item.text).length === 0) return null;
  const signalLookup = new Map(safeArray(input.signals).map((signal) => [signal.id || "", signal] as const));
  const linkedSignals = safeArray(item.source_signal_ids)
    .filter(Boolean)
    .map((signalId) => signalLookup.get(signalId))
    .filter(Boolean) as HealthPlanSourceSignal[];

  if (linkedSignals.length === 0) {
    return {
      state: "missing",
      signalLabels: [],
      staleSignalCount: 0,
      liveSignalCount: 0,
    };
  }

  const staleSignalCount = linkedSignals.filter((signal) => normalizeText(signal.freshness).toLowerCase() === "stale").length;
  const liveSignalCount = linkedSignals.filter((signal) => normalizeText(signal.freshness).toLowerCase() === "live").length;
  const freshEnoughCount = linkedSignals.filter((signal) => {
    const freshness = normalizeText(signal.freshness).toLowerCase();
    return freshness === "live" || freshness === "recent";
  }).length;

  return {
    state: freshEnoughCount === 0 ? "stale" : "linked",
    signalLabels: unique(linkedSignals.map((signal) => normalizeText(signal.label)).filter(Boolean)).slice(0, 3),
    staleSignalCount,
    liveSignalCount,
  };
}

export function deriveHealthPlanSectionProvenance(input: {
  section: "summary" | "goals" | "daily_support" | "monitoring" | "escalation" | "caregiver_guidance";
  items?: HealthPlanSectionItem[] | null;
  signals?: HealthPlanSourceSignal[] | null;
  contextSnapshot?: OperationalHealthPlanContextSnapshot | null;
}): HealthPlanSectionProvenance | null {
  const sectionSignals = collectSectionSignals(input.section, input.items, input.signals, input.contextSnapshot);
  const counts = countSectionItems(input.section, input.items, input.contextSnapshot);
  if (!sectionSignals.length && counts.totalItemCount === 0) return null;

  const driverScores = new Map<HealthPlanProvenanceDriver, number>();
  for (const signal of sectionSignals) {
    const driver = driverFromSignal(signal);
    driverScores.set(driver, (driverScores.get(driver) || 0) + 1);
  }

  const driverCodes = [...driverScores.entries()]
    .sort((left, right) => right[1] - left[1])
    .map(([driver]) => driver)
    .slice(0, 3);
  const signalLabels = unique(sectionSignals.map((signal) => normalizeText(signal.label)).filter(Boolean)).slice(0, 3);
  const staleSignalCount = sectionSignals.filter((signal) => normalizeText(signal.freshness).toLowerCase() === "stale").length;
  const liveSignalCount = sectionSignals.filter((signal) => normalizeText(signal.freshness).toLowerCase() === "live").length;
  const highPrioritySignalCount = sectionSignals.filter((signal) => normalizeText(signal.strength).toLowerCase() === "high").length;
  const signalCount = sectionSignals.length;

  return {
    driverCodes,
    signalLabels,
    staleSignalCount,
    liveSignalCount,
    highPrioritySignalCount,
    signalCount,
    totalItemCount: counts.totalItemCount,
    linkedItemCount: counts.linkedItemCount,
    uncoveredItemCount: counts.uncoveredItemCount,
    supportLevel: sectionSupportLevel({
      signalCount,
      linkedItemCount: counts.linkedItemCount,
      uncoveredItemCount: counts.uncoveredItemCount,
      staleSignalCount,
      liveSignalCount,
    }),
  };
}
