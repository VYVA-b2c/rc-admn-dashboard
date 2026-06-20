import type {
  OperationalHealthPlan,
  OperationalHealthPlanChangeEntry,
  OperationalHealthPlanRevision,
} from "@/lib/operationalDemoData";

type DeltaSource = OperationalHealthPlan | OperationalHealthPlanRevision | null | undefined;

export interface HealthPlanVersionDeltaReason {
  code: string;
  sectionCodes: string[];
  signalLabels: string[];
}

export interface HealthPlanVersionDeltaBrief {
  status: "baseline" | "improved" | "stable" | "mixed" | "regressed";
  summaryText: string | null;
  changedSectionCodes: string[];
  reasons: HealthPlanVersionDeltaReason[];
  driverSignalLabels: string[];
  unresolvedDetails: string[];
  responseShiftCodes: string[];
  sourceSignalsAdded: number;
  sourceSignalsRemoved: number;
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

function signalLookup(source: DeltaSource) {
  return new Map(
    safeArray(source?.source_signals_json)
      .map((signal) => [normalizeText(signal?.id), normalizeText(signal?.label)] as const)
      .filter(([id, label]) => id && label),
  );
}

function summarizeReason(entry: OperationalHealthPlanChangeEntry | null | undefined, lookup: Map<string, string>): HealthPlanVersionDeltaReason | null {
  const code = normalizeText(entry?.code);
  if (!code) return null;
  const sectionCodes = unique(safeArray(entry?.sections).map((section) => normalizeText(section)).filter(Boolean));
  const signalLabels = unique(
    safeArray(entry?.signal_ids)
      .map((signalId) => lookup.get(normalizeText(signalId)))
      .filter((label): label is string => Boolean(label)),
  ).slice(0, 3);
  return {
    code,
    sectionCodes,
    signalLabels,
  };
}

export function deriveHealthPlanVersionDeltaBrief(source: DeltaSource): HealthPlanVersionDeltaBrief | null {
  if (!source) return null;
  const changeSummary = source.change_summary_json;
  const quality = "quality" in source ? source.quality : null;
  const regenerationFocus = "regeneration_focus" in source ? source.regeneration_focus : null;
  const snapshotRecord =
    source.context_snapshot_json && typeof source.context_snapshot_json === "object"
      ? source.context_snapshot_json as Record<string, unknown>
      : null;
  const changeContext =
    snapshotRecord?.change_context && typeof snapshotRecord.change_context === "object"
      ? snapshotRecord.change_context as Record<string, unknown>
      : null;
  const generationContract =
    snapshotRecord?.generation_contract && typeof snapshotRecord.generation_contract === "object"
      ? snapshotRecord.generation_contract as Record<string, unknown>
      : null;
  const lookup = signalLookup(source);

  const statusRaw = normalizeText(quality?.improvement_summary?.status);
  const status =
    statusRaw === "improved" || statusRaw === "stable" || statusRaw === "mixed" || statusRaw === "regressed"
      ? statusRaw
      : "baseline";

  const changedSectionCodes = unique(safeArray(changeSummary?.changed_sections).map((section) => normalizeText(section)).filter(Boolean));
  const reasons = safeArray(changeSummary?.entries)
    .map((entry) => summarizeReason(entry, lookup))
    .filter((entry): entry is HealthPlanVersionDeltaReason => Boolean(entry))
    .slice(0, 4);

  const highlightSignalLabels = unique([
    ...safeArray(changeSummary?.entries)
      .flatMap((entry) => safeArray(entry?.signal_ids))
      .map((signalId) => lookup.get(normalizeText(signalId)))
      .filter((label): label is string => Boolean(label)),
    ...safeArray(changeContext?.highlight_signal_ids as string[])
      .map((signalId) => lookup.get(normalizeText(signalId)))
      .filter((label): label is string => Boolean(label)),
  ]).slice(0, 4);

  const unresolvedDetails = unique(
    safeArray(regenerationFocus?.focus_items)
      .map((item) => normalizeText(item?.detail))
      .filter(Boolean),
  ).slice(0, 3);

  const responseShiftCodes = [
    generationContract?.must_name_alternate_route === true ? "alternate_route" : null,
    generationContract?.must_name_stronger_next_move === true ? "stronger_next_move" : null,
    generationContract?.must_name_completion_receipt === true ? "completion_receipt" : null,
    generationContract?.must_acknowledge_material_change === true ? "material_change" : null,
    generationContract?.must_acknowledge_freshness_gap === true ? "freshness_gap" : null,
    generationContract?.must_acknowledge_conflict === true ? "conflicting_evidence" : null,
  ].filter((code): code is string => Boolean(code));

  const sourceSignalsAdded = safeArray(changeSummary?.source_signals_added).length;
  const sourceSignalsRemoved = safeArray(changeSummary?.source_signals_removed).length;

  if (
    status === "baseline"
    && changedSectionCodes.length === 0
    && reasons.length === 0
    && highlightSignalLabels.length === 0
    && unresolvedDetails.length === 0
    && responseShiftCodes.length === 0
    && sourceSignalsAdded === 0
    && sourceSignalsRemoved === 0
  ) {
    return null;
  }

  return {
    status,
    summaryText: normalizeText(quality?.improvement_summary?.summary_text) || null,
    changedSectionCodes,
    reasons,
    driverSignalLabels: highlightSignalLabels,
    unresolvedDetails,
    responseShiftCodes,
    sourceSignalsAdded,
    sourceSignalsRemoved,
  };
}
