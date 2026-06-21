function text(value) {
  return String(value || "").trim();
}

function lower(value) {
  return text(value).toLowerCase().replace(/[\s-]+/g, "_");
}

function normalizeTimestamp(value) {
  const raw = text(value);
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizeSignalIds(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => text(item)).filter(Boolean))];
}

function eventId(record = {}, index = 0) {
  return text(record.id) || text(record.event_id) || `event-${index + 1}`;
}

function normalizeSource(value) {
  const normalized = lower(value);
  if (["checkins", "brain_coach", "medication", "campaign_call", "alert"].includes(normalized)) return normalized;
  if (normalized === "braincoach") return "brain_coach";
  if (normalized === "checkin") return "checkins";
  return "context";
}

export function normalizeHealthPlanOperationalEvent(record, index = 0) {
  if (!record || typeof record !== "object") return null;
  const occurredAt = normalizeTimestamp(
    record.occurred_at
    || record.occurredAt
    || record.recorded_at
    || record.recordedAt
    || record.updated_at
    || record.updatedAt
    || record.created_at
    || record.createdAt
    || record.scheduled_at
    || record.scheduledAt,
  );
  if (!occurredAt) return null;

  return {
    id: eventId(record, index),
    source: normalizeSource(record.source || record.service || record.source_type || record.kind),
    status: lower(record.status || record.outcome || record.result),
    occurred_at: occurredAt,
    label: text(record.label || record.title || record.name) || null,
    note: text(record.note || record.detail || record.summary || record.message) || null,
    signal_ids: normalizeSignalIds(record.signal_ids || record.signalIds || record.source_signal_ids),
  };
}

export function normalizeHealthPlanOperationalEvents(value) {
  return (Array.isArray(value) ? value : [])
    .map((record, index) => normalizeHealthPlanOperationalEvent(record, index))
    .filter(Boolean)
    .sort((left, right) => new Date(right.occurred_at).getTime() - new Date(left.occurred_at).getTime());
}

export function buildHealthPlanOperationalActivitySummary(value, limit = 8) {
  return normalizeHealthPlanOperationalEvents(value)
    .slice(0, Math.max(1, limit))
    .map((item) => ({
      source: item.source,
      status: item.status || null,
      occurred_at: item.occurred_at,
      label: item.label,
      note: item.note,
      signal_ids: item.signal_ids,
    }));
}
