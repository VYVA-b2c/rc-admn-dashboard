function text(value) {
  return String(value || "").trim();
}

function lower(value) {
  return text(value).toLowerCase();
}

function normalizeSeverity(value) {
  const normalized = lower(value);
  if (normalized === "high" || normalized === "low") return normalized;
  return "medium";
}

function normalizeKind(value) {
  return lower(value) === "stale" ? "stale" : "missing";
}

function sortBySeverity(gaps) {
  const score = { high: 3, medium: 2, low: 1 };
  return [...gaps].sort((left, right) => (score[right.severity] || 0) - (score[left.severity] || 0));
}

function signalMap(sourceSignals = []) {
  return new Map(
    (Array.isArray(sourceSignals) ? sourceSignals : [])
      .map((signal) => {
        const id = text(signal?.id);
        return id ? [id, signal] : null;
      })
      .filter(Boolean),
  );
}

function parseDate(value) {
  const raw = text(value);
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function ageInHours(date, now) {
  if (!date || !now) return null;
  return (now.getTime() - date.getTime()) / (60 * 60 * 1000);
}

function serviceLastContactAt(service) {
  return (
    parseDate(service?.last_session_at)
    || parseDate(service?.lastSessionAt)
    || parseDate(service?.last_outcome_at)
    || parseDate(service?.lastOutcomeAt)
    || parseDate(service?.last_reported_at)
    || parseDate(service?.lastReportedAt)
  );
}

function serviceFreshnessThresholdHours(service) {
  const frequency = lower(service?.frequency);
  if (frequency === "daily") return 36;
  if (frequency === "weekly") return 10 * 24;
  if (frequency === "monthly") return 45 * 24;
  return 7 * 24;
}

function addGap(target, gap) {
  if (!gap?.id || target.some((item) => item.id === gap.id)) return;
  target.push({
    id: text(gap.id),
    label: text(gap.label),
    detail: text(gap.detail),
    kind: normalizeKind(gap.kind),
    severity: normalizeSeverity(gap.severity),
    staff_action: text(gap.staff_action),
  });
}

export function buildHealthPlanDataQualityGaps({
  profile = null,
  predictiveContext = null,
  sourceSignals = [],
  now = new Date(),
} = {}) {
  const gaps = [];
  const currentTime = parseDate(now) || new Date();
  const signals = signalMap(sourceSignals);
  const medications = Array.isArray(profile?.medications) ? profile.medications : [];
  const sensors = Array.isArray(profile?.sensors) ? profile.sensors : [];
  const careProviders = Array.isArray(profile?.careProviders) ? profile.careProviders : [];
  const healthConditions = Array.isArray(profile?.health?.health_conditions) ? profile.health.health_conditions.filter(Boolean) : [];
  const mobilityNeeds = Array.isArray(profile?.health?.mobility_needs) ? profile.health.mobility_needs.filter(Boolean) : [];
  const livingContext = text(profile?.user?.living_context || profile?.user?.livingContext);

  const latestPredictiveAt =
    parseDate(predictiveContext?.latestScore?.score_date)
    || parseDate(
      Array.isArray(predictiveContext?.forecastRows)
        ? predictiveContext.forecastRows
          .map((row) => row?.forecast_generated_at)
          .filter(Boolean)
          .sort()
          .at(-1)
        : null,
    );
  const predictiveAgeHours = ageInHours(latestPredictiveAt, currentTime);
  const predictiveUnavailable =
    (!predictiveContext?.latestScore && !(Array.isArray(predictiveContext?.forecastRows) && predictiveContext.forecastRows.length))
    || /unavailable/.test(lower(signals.get("risk-latest-score")?.label))
    || /used live profile/i.test(text(signals.get("risk-latest-score")?.detail));
  if (predictiveUnavailable) {
    addGap(gaps, {
      id: "predictive-coverage-gap",
      label: "Predictive coverage is unavailable",
      detail: "The plan could not use recent predictive score or forecast data and relied more heavily on live profile and service inputs.",
      kind: "missing",
      severity: "medium",
      staff_action: "Treat forecast-style recommendations as lower confidence and verify same-day status directly.",
    });
  } else if (predictiveAgeHours != null && predictiveAgeHours > 72) {
    addGap(gaps, {
      id: "predictive-freshness-gap",
      label: "Predictive inputs are getting stale",
      detail: predictiveAgeHours > 168
        ? "The latest predictive score or forecast is more than a week old."
        : "The latest predictive score or forecast is more than three days old.",
      kind: "stale",
      severity: predictiveAgeHours > 168 ? "high" : "medium",
      staff_action: "Give more weight to live alerts, contact outcomes, and medication activity until predictive inputs refresh.",
    });
  }

  const sensorSignal = signals.get("sensor-status");
  if (!sensors.length && !sensorSignal) {
    addGap(gaps, {
      id: "sensor-visibility-gap",
      label: "No sensor visibility is available",
      detail: "There are no linked sensors on record for this client, so the plan cannot lean on passive monitoring signals.",
      kind: "missing",
      severity: "medium",
      staff_action: "Rely more on direct contact, caregiver updates, and scheduled service follow-up.",
    });
  } else if (/offline|not reporting|silent/.test(lower(sensorSignal?.detail))) {
    addGap(gaps, {
      id: "sensor-visibility-gap",
      label: "Sensor visibility is incomplete",
      detail: text(sensorSignal?.detail) || "One or more sensors are offline or not reporting.",
      kind: "missing",
      severity: "high",
      staff_action: "Confirm the client's status directly until sensor reporting is restored.",
    });
  } else if (sensors.length) {
    const staleSensorCount = sensors.filter((sensor) => {
      const lastReadingAt = parseDate(sensor?.last_reading_at);
      const ageHours = ageInHours(lastReadingAt, currentTime);
      return ageHours != null && ageHours > 24;
    }).length;
    if (staleSensorCount > 0) {
      addGap(gaps, {
        id: "sensor-freshness-gap",
        label: "Sensor readings are not fully current",
        detail: staleSensorCount === sensors.length
          ? "All linked sensors have readings older than 24 hours."
          : `${staleSensorCount} linked sensor${staleSensorCount === 1 ? "" : "s"} has readings older than 24 hours.`,
        kind: "stale",
        severity: staleSensorCount === sensors.length ? "high" : "medium",
        staff_action: "Verify the client's current status directly until fresh sensor readings are back.",
      });
    }
  }

  const medicationSignal = signals.get("medication-plan");
  const latestMedicationStatus = lower(profile?.medicationActivity?.status);
  const missingMedicationTimes = medications.some((medication) => !Array.isArray(medication?.schedule_times) || medication.schedule_times.filter(Boolean).length === 0);
  const noRecentAdherence = medications.length > 0 && !latestMedicationStatus && !/latest adherence/i.test(text(medicationSignal?.detail));
  if (missingMedicationTimes) {
    addGap(gaps, {
      id: "medication-timing-gap",
      label: "Medication timing data is incomplete",
      detail: "At least one medication is missing saved reminder times, which weakens schedule-specific support guidance.",
      kind: "missing",
      severity: "high",
      staff_action: "Fill in reminder times before relying on exact medication follow-up windows.",
    });
  } else if (medications.length > 0 && /no saved reminder times/i.test(lower(medicationSignal?.detail))) {
    addGap(gaps, {
      id: "medication-timing-gap",
      label: "Medication timing data is incomplete",
      detail: text(medicationSignal?.detail),
      kind: "missing",
      severity: "high",
      staff_action: "Fill in reminder times before relying on exact medication follow-up windows.",
    });
  }
  if (noRecentAdherence) {
    addGap(gaps, {
      id: "medication-adherence-gap",
      label: "Recent adherence evidence is thin",
      detail: "There is no recent medication activity on file, so the plan cannot tell whether today's medication routine is holding.",
      kind: "missing",
      severity: "medium",
      staff_action: "Use the next contact to confirm whether the saved medication schedule still matches reality.",
    });
  } else if (medications.length > 0) {
    const medicationActivityAt = parseDate(profile?.medicationActivity?.occurred_at) || parseDate(profile?.medicationActivity?.reported_at);
    const medicationActivityAgeHours = ageInHours(medicationActivityAt, currentTime);
    if (medicationActivityAgeHours != null && medicationActivityAgeHours > 72) {
      addGap(gaps, {
        id: "medication-freshness-gap",
        label: "Medication adherence evidence is stale",
        detail: medicationActivityAgeHours > 168
          ? "The latest medication activity is more than a week old."
          : "The latest medication activity is more than three days old.",
        kind: "stale",
        severity: medicationActivityAgeHours > 168 ? "high" : "medium",
        staff_action: "Confirm whether the current medication routine still matches the saved plan before trusting timing-specific guidance.",
      });
    }
  }

  const consentSignal = signals.get("consent-family-sharing");
  if (!careProviders.length || /no care provider assignment/.test(lower(signals.get("care-circle-context")?.detail))) {
    addGap(gaps, {
      id: "care-circle-gap",
      label: "Care-circle coverage is incomplete",
      detail: "No active care provider assignment is recorded, which limits who can reinforce the plan between staff contacts.",
      kind: "missing",
      severity: "high",
      staff_action: "Assign or confirm care coverage before depending on caregiver follow-through.",
    });
  }
  if (/not confirmed|not granted|limited/.test(lower(consentSignal?.detail)) || /not confirmed/.test(lower(consentSignal?.label))) {
    addGap(gaps, {
      id: "sharing-boundary-gap",
      label: "Sharing boundary is not fully confirmed",
      detail: text(consentSignal?.detail) || "Family sharing consent is not confirmed.",
      kind: "missing",
      severity: "medium",
      staff_action: "Keep caregiver guidance narrower until the sharing boundary is confirmed.",
    });
  }

  const profileContextSignal = signals.get("context-live-profile");
  const missingProfileContext = (!livingContext && healthConditions.length === 0 && mobilityNeeds.length === 0) || !profileContextSignal;
  if (missingProfileContext) {
    addGap(gaps, {
      id: "profile-context-gap",
      label: "Profile context is limited",
      detail: "Living context, health conditions, or mobility details are sparse, so some recommendations may be too generic.",
      kind: "missing",
      severity: "medium",
      staff_action: "Capture more day-to-day context before trusting highly personalized support guidance.",
    });
  }

  for (const [serviceKey, serviceLabel] of [["checkins", "Check-ins"], ["brainCoach", "Brain Coach"]]) {
    const service = profile?.[serviceKey];
    if (!service?.enabled) continue;
    const lastContactAt = serviceLastContactAt(service);
    if (!lastContactAt) {
      addGap(gaps, {
        id: `${serviceKey}-freshness-gap`,
        label: `${serviceLabel} activity is not current`,
        detail: `No recent ${serviceLabel.toLowerCase()} outcome is recorded even though the service is enabled.`,
        kind: "missing",
        severity: "medium",
        staff_action: `Confirm whether ${serviceLabel.toLowerCase()} is actually running and record the latest outcome.`,
      });
      continue;
    }
    const serviceAgeHours = ageInHours(lastContactAt, currentTime);
    const threshold = serviceFreshnessThresholdHours(service);
    if (serviceAgeHours != null && serviceAgeHours > threshold) {
      addGap(gaps, {
        id: `${serviceKey}-freshness-gap`,
        label: `${serviceLabel} activity is getting stale`,
        detail: `${serviceLabel} is enabled, but the latest recorded outcome is older than the expected follow-up window.`,
        kind: "stale",
        severity: serviceAgeHours > threshold * 2 ? "high" : "medium",
        staff_action: `Treat ${serviceLabel.toLowerCase()} support as uncertain until a fresh outcome is recorded.`,
      });
    }
  }

  return sortBySeverity(gaps).slice(0, 6);
}
