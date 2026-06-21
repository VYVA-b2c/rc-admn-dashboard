function text(value) {
  return String(value || "").trim();
}

function lower(value) {
  return text(value).toLowerCase();
}

function normalizeSignal(signal) {
  if (!signal || typeof signal !== "object") return null;
  const id = text(signal.id);
  const label = text(signal.label);
  if (!id || !label) return null;
  return {
    id,
    label,
    detail: text(signal.detail),
    category: text(signal.category) || "context",
    strength: text(signal.strength) || "medium",
  };
}

function uniqueIds(ids) {
  return [...new Set((Array.isArray(ids) ? ids : []).map((item) => text(item)).filter(Boolean))];
}

function strengthScore(strength) {
  if (strength === "high") return 3;
  if (strength === "low") return 1;
  return 2;
}

function signalPriority(signal) {
  const id = signal.id;
  const haystack = `${signal.label} ${signal.detail}`.toLowerCase();
  let score = strengthScore(signal.strength);

  if (id === "alert-active") score += 8;
  if (id === "risk-latest-score") score += 7;
  if (id === "medication-plan" && /\bmissed|late|skipped|unconfirmed|off\b/.test(haystack)) score += 6;
  if (id === "sensor-status" && /\boffline|not reporting|silent\b/.test(haystack)) score += 5;
  if (id === "care-circle-context" && /\bno care provider|no assigned\b/.test(haystack)) score += 4;
  if (id === "consent-family-sharing" && /\bnot confirmed|not granted|limited\b/.test(haystack)) score += 3;
  if ((id === "service-checkins" || id === "service-brain-coach") && /\bmissed|pending|disabled|off\b/.test(haystack)) score += 3;
  if (id === "forecast-near-term") score += 1;

  return score;
}

function sortByPriority(signals) {
  return [...signals].sort((left, right) => signalPriority(right) - signalPriority(left));
}

function ids(signals) {
  return signals.map((signal) => signal.id);
}

function filterSignals(allSignals, predicate, limit = 4) {
  return ids(sortByPriority(allSignals.filter(predicate)).slice(0, limit));
}

export function buildHealthPlanSignalTriage(sourceSignals = [], criticalSignalIds = []) {
  const signals = (Array.isArray(sourceSignals) ? sourceSignals : []).map(normalizeSignal).filter(Boolean);
  const criticalIds = uniqueIds(criticalSignalIds);
  const byId = new Map(signals.map((signal) => [signal.id, signal]));

  const actionSignalIds = uniqueIds([
    ...criticalIds,
    ...filterSignals(signals, (signal) => {
      const haystack = `${signal.label} ${signal.detail}`.toLowerCase();
      return (
        signal.id === "alert-active"
        || signal.id === "risk-latest-score"
        || (signal.id === "medication-plan" && /\bmissed|late|skipped|unconfirmed|off\b/.test(haystack))
        || (signal.id === "sensor-status" && /\boffline|not reporting|silent\b/.test(haystack))
        || (signal.id === "care-circle-context" && /\bno care provider|no assigned\b/.test(haystack))
      );
    }, 5),
  ]);

  const verificationSignalIds = uniqueIds([
    ...filterSignals(signals, (signal) => {
      const haystack = `${signal.label} ${signal.detail}`.toLowerCase();
      return (
        signal.id === "alert-active"
        || (signal.id === "medication-plan" && /\bmissed|late|skipped|unconfirmed\b/.test(haystack))
        || (signal.id === "sensor-status" && /\boffline|not reporting|silent\b/.test(haystack))
        || (signal.id === "consent-family-sharing" && /\bnot confirmed|not granted|limited\b/.test(haystack))
      );
    }, 5),
  ]);

  const stabilizingSignalIds = uniqueIds([
    ...filterSignals(signals, (signal) => {
      const haystack = `${signal.label} ${signal.detail}`.toLowerCase();
      return (
        ((signal.id === "service-checkins" || signal.id === "service-brain-coach") && !/\bmissed|pending|disabled|off\b/.test(haystack))
        || (signal.id === "medication-plan" && /\btaken\b/.test(haystack))
        || (signal.id === "medication-plan" && !/\bmissed|late|skipped|unconfirmed|off\b/.test(haystack))
        || (signal.id === "care-circle-context" && /\bcare provider assignment(s)?\b/.test(haystack))
      );
    }, 4),
  ]);

  const cautionSignalIds = uniqueIds([
    ...filterSignals(signals, (signal) => {
      const haystack = `${signal.label} ${signal.detail}`.toLowerCase();
      return (
        (signal.id === "sensor-status" && /\boffline|not reporting|silent\b/.test(haystack))
        || (signal.id === "consent-family-sharing" && /\bnot confirmed|not granted|limited\b/.test(haystack))
        || (signal.id === "care-circle-context" && /\bno care provider|no assigned\b/.test(haystack))
        || (signal.id === "forecast-near-term")
      );
    }, 5),
  ]);

  const reservedIds = new Set([
    ...actionSignalIds,
    ...verificationSignalIds,
    ...stabilizingSignalIds,
    ...cautionSignalIds,
  ]);

  const backgroundSignalIds = ids(
    sortByPriority(signals.filter((signal) => !reservedIds.has(signal.id))).slice(0, 6),
  );

  const focusSummaryText = actionSignalIds.length
    ? "Start from the action-driving signals first, then preserve helpful routines only after today's main risks are clearly covered."
    : "Start from the strongest live care signals first, then add lower-stakes context only after the main support picture is clear.";

  const cautionSummaryText = verificationSignalIds.length || cautionSignalIds.length
    ? "Keep verification explicit where signals are incomplete, conflicting, or operationally fragile, and do not let background context create false reassurance."
    : "Use lower-priority context as background only after the plan already names the main risk and support actions.";

  return {
    action_signal_ids: actionSignalIds.filter((id) => byId.has(id)),
    verification_signal_ids: verificationSignalIds.filter((id) => byId.has(id)),
    stabilizing_signal_ids: stabilizingSignalIds.filter((id) => byId.has(id)),
    caution_signal_ids: cautionSignalIds.filter((id) => byId.has(id)),
    background_signal_ids: backgroundSignalIds.filter((id) => byId.has(id)),
    focus_summary_text: focusSummaryText,
    caution_summary_text: cautionSummaryText,
  };
}
