function text(value) {
  return String(value || "").trim();
}

function lower(value) {
  return text(value).toLowerCase().replace(/[\s-]+/g, "_");
}

function unique(values) {
  return [...new Set((Array.isArray(values) ? values : []).map((value) => text(value)).filter(Boolean))];
}

function normalizeTimestamp(value) {
  const raw = text(value);
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

const POSITIVE_STATUS = new Set(["completed", "confirmed", "answered", "reached", "success", "successful", "done", "taken"]);
const CAUTION_STATUS = new Set(["missed", "unconfirmed", "no_answer", "no_response", "not_reached", "failed", "failure", "late", "skipped", "declined", "busy", "timeout", "pending", "queued", "cancelled"]);

function eventKind(status) {
  const normalized = lower(status);
  if (CAUTION_STATUS.has(normalized)) return "caution";
  if (POSITIVE_STATUS.has(normalized) || !normalized) return "positive";
  return "neutral";
}

function statusFromCounts({ high = 0, medium = 0, baseline = 0 } = {}) {
  if (high > 0 || baseline >= 3) return "pressure";
  if (medium > 0 || baseline > 0) return "watch";
  return "stable";
}

function sourceLabel(source) {
  if (source === "checkins") return "Check-ins";
  if (source === "brain_coach") return "Brain Coach";
  if (source === "campaign_call") return "Outreach";
  if (source === "medication") return "Medication";
  return "Context";
}

function latestEvent(events = []) {
  return (Array.isArray(events) ? events : [])
    .map((event) => ({
      ...event,
      occurred_at: normalizeTimestamp(event?.occurred_at),
    }))
    .filter((event) => event.occurred_at)
    .sort((left, right) => new Date(right.occurred_at).getTime() - new Date(left.occurred_at).getTime())[0] || null;
}

function hoursSince(iso, now = new Date()) {
  const parsed = iso ? new Date(iso) : null;
  const current = now instanceof Date ? now : new Date(now);
  if (!parsed || Number.isNaN(parsed.getTime()) || Number.isNaN(current.getTime())) return null;
  return Math.max(0, (current.getTime() - parsed.getTime()) / (60 * 60 * 1000));
}

function ageHours(iso, now = new Date()) {
  const parsed = iso ? new Date(iso) : null;
  const current = now instanceof Date ? now : new Date(now);
  if (!parsed || Number.isNaN(parsed.getTime()) || Number.isNaN(current.getTime())) return null;
  return (current.getTime() - parsed.getTime()) / (60 * 60 * 1000);
}

function countKinds(events = [], predicate = () => true) {
  const scoped = (Array.isArray(events) ? events : []).filter(predicate);
  return {
    event_count: scoped.length,
    positive_count: scoped.filter((event) => eventKind(event?.status) === "positive").length,
    caution_count: scoped.filter((event) => eventKind(event?.status) === "caution").length,
  };
}

function trendFromWindows({
  last24h = { positive_count: 0, caution_count: 0, event_count: 0 },
  last7d = { positive_count: 0, caution_count: 0, event_count: 0 },
  latestKind = "neutral",
} = {}) {
  if ((last24h.caution_count >= 2 && last24h.caution_count >= last24h.positive_count) || (latestKind === "caution" && last7d.caution_count >= 3)) {
    return "worsening";
  }
  if (last7d.positive_count >= 2 && last7d.caution_count === 0 && latestKind === "positive") {
    return "improving";
  }
  if (last7d.caution_count > 0 && last7d.positive_count > 0) {
    return "mixed";
  }
  return "steady";
}

function buildWindowSummary(events = [], now = new Date()) {
  const normalized = (Array.isArray(events) ? events : [])
    .map((event) => ({
      ...event,
      occurred_at: normalizeTimestamp(event?.occurred_at),
    }))
    .filter((event) => event.occurred_at);
  const last24h = countKinds(normalized, (event) => {
    const hours = ageHours(event.occurred_at, now);
    return hours != null && hours <= 24;
  });
  const last7d = countKinds(normalized, (event) => {
    const hours = ageHours(event.occurred_at, now);
    return hours != null && hours <= 24 * 7;
  });
  const latest = latestEvent(normalized);
  return {
    last_24h: last24h,
    last_7d: last7d,
    latest_kind: latest ? eventKind(latest.status) : "neutral",
    trend: trendFromWindows({
      last24h,
      last7d,
      latestKind: latest ? eventKind(latest.status) : "neutral",
    }),
  };
}

function summarizeServiceEngagement(events = [], now = new Date()) {
  const serviceEvents = (Array.isArray(events) ? events : []).filter((event) => ["checkins", "brain_coach", "campaign_call"].includes(text(event?.source)));
  const positiveCount = serviceEvents.filter((event) => eventKind(event?.status) === "positive").length;
  const cautionCount = serviceEvents.filter((event) => eventKind(event?.status) === "caution").length;
  const latest = latestEvent(serviceEvents);
  const windows = buildWindowSummary(serviceEvents, now);
  const status = statusFromCounts({
    high: cautionCount >= 2 ? 1 : 0,
    medium: cautionCount > 0 ? 1 : 0,
    baseline: serviceEvents.length,
  });

  return {
    status,
    event_count: serviceEvents.length,
    positive_count: positiveCount,
    caution_count: cautionCount,
    latest_touchpoint_at: latest?.occurred_at || null,
    latest_touchpoint_source: latest ? sourceLabel(latest.source) : null,
    windows,
    summary:
      status === "pressure"
        ? `Recent service engagement is under pressure, with ${cautionCount} missed or failed touchpoint${cautionCount === 1 ? "" : "s"}.`
        : status === "watch"
          ? "Recent service engagement is mixed and still needs checking."
          : "Recent service engagement looks comparatively stable.",
  };
}

function summarizeMedicationAdherence({
  medications = [],
  medicationActivity = null,
  recentOperationalEvents = [],
  now = new Date(),
} = {}) {
  const medicationEvents = (Array.isArray(recentOperationalEvents) ? recentOperationalEvents : []).filter((event) => text(event?.source) === "medication");
  const positiveCount = medicationEvents.filter((event) => eventKind(event?.status) === "positive").length;
  const cautionCount = medicationEvents.filter((event) => eventKind(event?.status) === "caution").length;
  const latest = latestEvent(medicationEvents);
  const windows = buildWindowSummary(medicationEvents, now);
  const latestStatus = lower(latest?.status || medicationActivity?.status);
  const disabledCount = (Array.isArray(medications) ? medications : []).filter((med) => med?.reminders_enabled === false).length;
  const status = statusFromCounts({
    high: ["missed", "late", "skipped", "unconfirmed"].includes(latestStatus) || cautionCount >= 2 ? 1 : 0,
    medium: disabledCount > 0 || cautionCount > 0 ? 1 : 0,
    baseline: medicationEvents.length,
  });

  return {
    status,
    medication_count: Array.isArray(medications) ? medications.length : 0,
    reminders_disabled_count: disabledCount,
    positive_count: positiveCount,
    caution_count: cautionCount,
    latest_status: latestStatus || null,
    latest_occurred_at: latest?.occurred_at || normalizeTimestamp(medicationActivity?.occurred_at || medicationActivity?.reported_at),
    windows,
    summary:
      status === "pressure"
        ? "Medication adherence looks fragile right now and needs explicit follow-up."
        : status === "watch"
          ? "Medication adherence has some uncertainty and still needs verification."
          : "Medication adherence signals look comparatively steady.",
  };
}

function summarizeSensorReliability({
  sensors = [],
  alerts = [],
  now = new Date(),
} = {}) {
  const deviceCount = Array.isArray(sensors) ? sensors.length : 0;
  const offlineCount = (Array.isArray(sensors) ? sensors : []).filter((sensor) => lower(sensor?.status) !== "online").length;
  const lowBatteryCount = (Array.isArray(sensors) ? sensors : []).filter((sensor) => Number(sensor?.battery_level) > 0 && Number(sensor?.battery_level) < 20).length;
  const staleReadingCount = (Array.isArray(sensors) ? sensors : []).filter((sensor) => {
    const hours = hoursSince(sensor?.last_reading_at, now);
    return hours != null && hours > 48;
  }).length;
  const activeAlerts = (Array.isArray(alerts) ? alerts : []).filter((alert) => !alert?.resolved_at);
  const criticalAlerts = activeAlerts.filter((alert) => lower(alert?.severity) === "critical").length;
  const alertWindows = buildWindowSummary(
    (Array.isArray(alerts) ? alerts : []).map((alert) => ({
      source: "alert",
      status: lower(alert?.resolved_at) ? "resolved" : (lower(alert?.severity) === "critical" ? "failed" : "pending"),
      occurred_at: normalizeTimestamp(alert?.created_at || alert?.updated_at),
    })),
    now,
  );
  const status = statusFromCounts({
    high: criticalAlerts > 0 || offlineCount > 0 ? 1 : 0,
    medium: activeAlerts.length > 0 || lowBatteryCount > 0 || staleReadingCount > 0 ? 1 : 0,
    baseline: activeAlerts.length + offlineCount + staleReadingCount,
  });

  return {
    status,
    device_count: deviceCount,
    offline_count: offlineCount,
    low_battery_count: lowBatteryCount,
    stale_reading_count: staleReadingCount,
    active_alert_count: activeAlerts.length,
    critical_alert_count: criticalAlerts,
    windows: alertWindows,
    summary:
      status === "pressure"
        ? "Sensor reliability is under pressure because alerts or device reporting issues are active."
        : status === "watch"
          ? "Sensor coverage needs watching because some devices or alerts still need review."
          : "Sensor coverage looks comparatively reliable right now.",
  };
}

function summarizeContactPressure(events = [], now = new Date()) {
  const contactEvents = (Array.isArray(events) ? events : []).filter((event) => ["checkins", "brain_coach", "campaign_call"].includes(text(event?.source)));
  const positiveCount = contactEvents.filter((event) => eventKind(event?.status) === "positive").length;
  const cautionCount = contactEvents.filter((event) => eventKind(event?.status) === "caution").length;
  const latest = latestEvent(contactEvents);
  const windows = buildWindowSummary(contactEvents, now);
  const status = statusFromCounts({
    high: cautionCount >= 2 ? 1 : 0,
    medium: cautionCount > 0 ? 1 : 0,
    baseline: contactEvents.length,
  });

  return {
    status,
    positive_count: positiveCount,
    caution_count: cautionCount,
    latest_touchpoint_at: latest?.occurred_at || null,
    latest_touchpoint_source: latest ? sourceLabel(latest.source) : null,
    windows,
    summary:
      status === "pressure"
        ? "Reachability is under pressure because recent contact attempts are repeatedly failing."
        : status === "watch"
          ? "Reachability is mixed and should not be assumed."
          : "Reachability currently looks more stable.",
  };
}

function attentionFlags({
  serviceEngagement,
  medicationAdherence,
  sensorReliability,
  contactPressure,
}) {
  const flags = [];
  if (contactPressure.caution_count >= 2) {
    flags.push({
      id: "contact-failures",
      label: "Recent contact attempts are repeatedly failing.",
      severity: "high",
      section_key: "escalation_json",
      detail: "Escalation and monitoring should name the same-day reachability path clearly.",
    });
  }
  if (contactPressure?.windows?.trend === "worsening") {
    flags.push({
      id: "contact-trend-worsening",
      label: "Reachability is worsening across the recent contact window.",
      severity: "high",
      section_key: "monitoring_json",
      detail: "Use shorter monitoring loops and a clearer fallback if the next contact also fails.",
    });
  }
  if (medicationAdherence.status === "pressure") {
    flags.push({
      id: "medication-instability",
      label: "Medication adherence looks unstable in recent activity.",
      severity: "high",
      section_key: "daily_support_json",
      detail: "Daily support and monitoring should confirm doses and define what happens if adherence stays unclear.",
    });
  }
  if (medicationAdherence?.windows?.trend === "worsening") {
    flags.push({
      id: "medication-trend-worsening",
      label: "Medication adherence is worsening across recent activity.",
      severity: "high",
      section_key: "daily_support_json",
      detail: "The plan should treat this as a pattern, not a one-off miss.",
    });
  }
  if (sensorReliability.critical_alert_count > 0 || sensorReliability.offline_count > 0) {
    flags.push({
      id: "sensor-pressure",
      label: "Sensor coverage is weakened by active alerts or devices not reporting.",
      severity: sensorReliability.critical_alert_count > 0 ? "high" : "medium",
      section_key: "monitoring_json",
      detail: "Monitoring should avoid false reassurance from missing or degraded sensor coverage.",
    });
  }
  if (sensorReliability?.windows?.trend === "worsening") {
    flags.push({
      id: "alert-recurrence",
      label: "Alert pressure is recurring across the recent window.",
      severity: "medium",
      section_key: "monitoring_json",
      detail: "Monitoring should account for recurring alert pressure, not just the latest alert state.",
    });
  }
  if (serviceEngagement.status === "watch" && flags.length === 0) {
    flags.push({
      id: "service-mixed",
      label: "Recent service engagement is mixed.",
      severity: "medium",
      section_key: "monitoring_json",
      detail: "Check whether the routine is landing before carrying it forward too confidently.",
    });
  }
  return flags.slice(0, 5);
}

export function buildHealthPlanLiveEvidenceSummary({
  medications = [],
  medicationActivity = null,
  checkins = null,
  brainCoach = null,
  sensors = [],
  alerts = [],
  recentOperationalEvents = [],
  now = new Date(),
} = {}) {
  const serviceEngagement = summarizeServiceEngagement(recentOperationalEvents, now);
  const medicationAdherence = summarizeMedicationAdherence({
    medications,
    medicationActivity,
    recentOperationalEvents,
    now,
  });
  const sensorReliability = summarizeSensorReliability({
    sensors,
    alerts,
    now,
  });
  const contactPressure = summarizeContactPressure(recentOperationalEvents, now);
  const flags = attentionFlags({
    serviceEngagement,
    medicationAdherence,
    sensorReliability,
    contactPressure,
  });

  const status =
    [serviceEngagement.status, medicationAdherence.status, sensorReliability.status, contactPressure.status].includes("pressure")
      ? "pressure"
      : [serviceEngagement.status, medicationAdherence.status, sensorReliability.status, contactPressure.status].includes("watch")
        ? "watch"
        : "stable";

  const summary =
    status === "pressure"
      ? `Live evidence is under pressure across recent service, medication, or sensor activity. ${flags[0]?.label || ""}`.trim()
      : status === "watch"
        ? "Live evidence is mixed, so the plan should stay practical and verification-heavy."
        : "Live evidence is comparatively steady, though normal human review still matters.";

  return {
    status,
    summary,
    trend_summary: {
      contact_trend: contactPressure.windows?.trend || "steady",
      service_trend: serviceEngagement.windows?.trend || "steady",
      medication_trend: medicationAdherence.windows?.trend || "steady",
      alert_trend: sensorReliability.windows?.trend || "steady",
    },
    service_engagement: {
      ...serviceEngagement,
      configured_checkins: Boolean(checkins?.enabled),
      configured_brain_coach: Boolean(brainCoach?.enabled),
    },
    medication_adherence: medicationAdherence,
    sensor_reliability: sensorReliability,
    contact_pressure: contactPressure,
    attention_flags: flags,
  };
}

export function buildHealthPlanLiveEvidenceSignals(summary) {
  const pulse = summary && typeof summary === "object" ? summary : null;
  if (!pulse) return [];
  const signals = [];

  signals.push({
    id: "service-engagement",
    label: pulse.service_engagement?.status === "pressure" ? "Service engagement under pressure" : "Service engagement trend",
    category: "service",
    strength: pulse.service_engagement?.status === "pressure" ? "high" : pulse.service_engagement?.status === "watch" ? "medium" : "low",
    detail: pulse.service_engagement?.summary || null,
  });
  signals.push({
    id: "medication-adherence-trend",
    label: pulse.medication_adherence?.status === "pressure" ? "Medication adherence unstable" : "Medication adherence trend",
    category: "medication",
    strength: pulse.medication_adherence?.status === "pressure" ? "high" : pulse.medication_adherence?.status === "watch" ? "medium" : "low",
    detail: pulse.medication_adherence?.summary || null,
  });
  signals.push({
    id: "sensor-reliability",
    label: pulse.sensor_reliability?.status === "pressure" ? "Sensor reliability issue" : "Sensor reliability trend",
    category: "sensor",
    strength: pulse.sensor_reliability?.status === "pressure" ? "high" : pulse.sensor_reliability?.status === "watch" ? "medium" : "low",
    detail: pulse.sensor_reliability?.summary || null,
  });
  signals.push({
    id: "contact-trend-window",
    label: pulse.contact_pressure?.windows?.trend === "worsening" ? "Reachability worsening across recent window" : "Reachability trend window",
    category: "service",
    strength: pulse.contact_pressure?.windows?.trend === "worsening" ? "high" : pulse.contact_pressure?.windows?.trend === "mixed" ? "medium" : "low",
    detail: pulse.contact_pressure?.summary || null,
  });

  return signals
    .map((signal) => ({
      ...signal,
      label: text(signal.label),
      detail: text(signal.detail) || null,
    }))
    .filter((signal) => signal.label);
}
