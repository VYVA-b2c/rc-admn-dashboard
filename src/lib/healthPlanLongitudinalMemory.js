function text(value) {
  return String(value || "").trim();
}

function lower(value) {
  return text(value).toLowerCase();
}

function unique(values) {
  return [...new Set((Array.isArray(values) ? values : []).map((value) => text(value)).filter(Boolean))];
}

function objectValue(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function parseDate(value) {
  const raw = text(value);
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function revisionSnapshots(history = []) {
  return (Array.isArray(history) ? history : [])
    .map((revision) => ({
      version_number: Number(revision?.version_number || revision?.current_version || 0) || null,
      created_at: text(revision?.created_at || revision?.generated_at || revision?.updated_at) || null,
      snapshot: objectValue(revision?.quality_snapshot_json),
    }))
    .filter((item) => item.snapshot)
    .sort((left, right) => {
      const byVersion = Number(right.version_number || 0) - Number(left.version_number || 0);
      if (byVersion !== 0) return byVersion;
      const rightTime = parseDate(right.created_at)?.getTime() || 0;
      const leftTime = parseDate(left.created_at)?.getTime() || 0;
      return rightTime - leftTime;
    })
    .slice(0, 5);
}

function countStatus(historySnapshots, getter) {
  let pressure = 0;
  let watch = 0;
  let worsening = 0;
  for (const item of historySnapshots) {
    const value = getter(item.snapshot);
    const status = lower(value?.status);
    const trend = lower(value?.windows?.trend || value?.trend);
    if (status === "pressure") pressure += 1;
    if (status === "watch") watch += 1;
    if (trend === "worsening") worsening += 1;
  }
  return { pressure, watch, worsening };
}

function memoryStatus(current, counts = {}) {
  if ((current?.status === "pressure" && (counts.pressure >= 1 || counts.worsening >= 1)) || counts.pressure >= 2 || counts.worsening >= 2) {
    return "persistent_pressure";
  }
  if ((current?.status === "watch" && (counts.watch >= 1 || counts.pressure >= 1)) || counts.watch >= 2) {
    return "recurrent_watch";
  }
  if ((current?.windows?.trend === "improving" || current?.trend === "improving") && counts.pressure > 0) {
    return "stabilizing";
  }
  return "limited_history";
}

function actionBias(key) {
  if (key === "contact") return "Use tighter monitoring and a same-day fallback when reachability keeps breaking down.";
  if (key === "medication") return "Treat adherence instability as a repeating pattern and confirm the routine more concretely.";
  if (key === "sensor") return "Avoid reassuring language that depends on sensor coverage when alert or device pressure keeps recurring.";
  return "Use routine guidance cautiously until there is clearer repeat evidence.";
}

function labelFor(key) {
  if (key === "contact") return "Reachability";
  if (key === "medication") return "Medication adherence";
  if (key === "sensor") return "Sensor and alert pressure";
  return "Pattern";
}

function currentReason(current = null) {
  return text(current?.summary) || null;
}

function buildDomainMemory(key, current, counts) {
  const status = memoryStatus(current, counts);
  const repeatedCount = counts.pressure + counts.watch + counts.worsening;
  if (status === "limited_history" && repeatedCount === 0 && !text(current?.summary)) return null;
  return {
    id: `longitudinal-${key}`,
    key,
    label: labelFor(key),
    status,
    current_status: text(current?.status) || "stable",
    current_trend: text(current?.windows?.trend || current?.trend) || "steady",
    repeated_pressure_count: counts.pressure,
    repeated_watch_count: counts.watch,
    repeated_worsening_count: counts.worsening,
    repeated_count: repeatedCount,
    why_it_matters: currentReason(current)
      || (status === "persistent_pressure"
        ? `${labelFor(key)} has been resurfacing across recent plan cycles.`
        : status === "recurrent_watch"
          ? `${labelFor(key)} has been unstable across more than one recent plan cycle.`
          : `${labelFor(key)} still has limited longer-pattern evidence.`),
    action_bias: actionBias(key),
  };
}

export function buildHealthPlanLongitudinalMemory({
  liveEvidenceSummary = null,
  history = [],
} = {}) {
  const current = objectValue(liveEvidenceSummary) || {};
  const snapshots = revisionSnapshots(history);

  const domains = [
    buildDomainMemory(
      "contact",
      objectValue(current.contact_pressure),
      countStatus(snapshots, (snapshot) => snapshot?.live_evidence_summary?.contact_pressure),
    ),
    buildDomainMemory(
      "medication",
      objectValue(current.medication_adherence),
      countStatus(snapshots, (snapshot) => snapshot?.live_evidence_summary?.medication_adherence),
    ),
    buildDomainMemory(
      "sensor",
      objectValue(current.sensor_reliability),
      countStatus(snapshots, (snapshot) => snapshot?.live_evidence_summary?.sensor_reliability),
    ),
  ].filter(Boolean);

  const persistent = domains.filter((item) => item.status === "persistent_pressure");
  const recurrent = domains.filter((item) => item.status === "recurrent_watch");
  const stabilizing = domains.filter((item) => item.status === "stabilizing");

  const summary =
    persistent.length > 0
      ? `${persistent[0].label} keeps resurfacing across recent plan cycles, so the next plan should treat it as a persistent pattern rather than a one-off event.`
      : recurrent.length > 0
        ? `${recurrent[0].label} has been unstable across recent plan cycles and still needs cautious wording.`
        : stabilizing.length > 0
          ? `${stabilizing[0].label} shows some signs of stabilization, but it still benefits from routine verification.`
          : "Longer-pattern memory is still thin, so the plan should lean more on recent live evidence than on historical recurrence.";

  return {
    summary,
    persistent_count: persistent.length,
    recurrent_count: recurrent.length,
    stabilizing_count: stabilizing.length,
    domains: domains.slice(0, 4),
  };
}
