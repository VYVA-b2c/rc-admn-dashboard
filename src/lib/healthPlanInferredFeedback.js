import { normalizeHealthPlanOperationalEvents } from "./healthPlanOperationalEvents.js";

const POSITIVE_STATUS = new Set(["completed", "confirmed", "answered", "reached", "success", "successful", "done", "taken"]);
const CAUTION_STATUS = new Set([
  "missed",
  "unconfirmed",
  "no_answer",
  "no_response",
  "not_reached",
  "failed",
  "failure",
  "late",
  "skipped",
  "declined",
  "busy",
  "timeout",
  "pending",
  "queued",
  "cancelled",
  "skipped",
]);

function text(value) {
  return String(value || "").trim();
}

function lower(value) {
  return text(value).toLowerCase().replace(/[\s-]+/g, "_");
}

function parseDate(value) {
  const raw = text(value);
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toIso(value) {
  const date = value instanceof Date ? value : parseDate(value);
  return date ? date.toISOString() : null;
}

function afterPlan(date, planDate) {
  return Boolean(date && planDate && date.getTime() > planDate.getTime());
}

function itemsMatchingSignals(plan, sectionKey, signalIds = []) {
  const matchIds = new Set((Array.isArray(signalIds) ? signalIds : []).map((value) => text(value)).filter(Boolean));
  return (Array.isArray(plan?.[sectionKey]) ? plan[sectionKey] : [])
    .filter((item) => Array.isArray(item?.source_signal_ids) && item.source_signal_ids.some((signalId) => matchIds.has(text(signalId))))
    .map((item) => text(item?.id))
    .filter(Boolean);
}

function pushEntry(target, {
  prefix,
  sectionKey,
  itemId = null,
  outcome,
  note,
  recordedAt,
}) {
  const at = toIso(recordedAt);
  if (!sectionKey || !outcome || !note || !at) return;
  target.push({
    id: `${prefix}:${sectionKey}:${itemId || "section"}:${at}`,
    section_key: sectionKey,
    ...(itemId ? { item_id: itemId } : {}),
    outcome,
    note,
    recorded_at: at,
    source: "inferred_operational",
  });
}

function addForSectionAndItems(target, {
  prefix,
  plan,
  sectionKey,
  signalIds,
  outcome,
  note,
  recordedAt,
}) {
  pushEntry(target, { prefix, sectionKey, outcome, note, recordedAt });
  for (const itemId of itemsMatchingSignals(plan, sectionKey, signalIds)) {
    pushEntry(target, { prefix, sectionKey, itemId, outcome, note, recordedAt });
  }
}

function latestStatus(value) {
  return lower(value);
}

function dedupeEntries(entries) {
  const seen = new Set();
  return entries.filter((entry) => {
    const key = [entry.id, entry.section_key, entry.item_id || "section", entry.outcome, entry.recorded_at].join(":");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function eventKind(status) {
  const normalized = latestStatus(status);
  if (CAUTION_STATUS.has(normalized)) return "caution";
  if (POSITIVE_STATUS.has(normalized) || !normalized) return "positive";
  return null;
}

function noteFromEvent(event, fallback) {
  return text(event?.note) || text(event?.label) || fallback;
}

function recentOperationalEvents(profile, planDate, source) {
  return normalizeHealthPlanOperationalEvents(profile?.recentOperationalEvents)
    .filter((event) => event.source === source && afterPlan(parseDate(event.occurred_at), planDate));
}

function checkinSignal(profile, planDate) {
  const at = parseDate(
    profile?.checkins?.last_reported_at
    || profile?.checkins?.lastReportedAt
    || profile?.checkins?.last_outcome_at
    || profile?.checkins?.lastOutcomeAt
    || profile?.checkins?.last_checkin_at
    || profile?.checkins?.lastCheckinAt
    || profile?.checkins?.last_session_at
    || profile?.checkins?.lastSessionAt,
  );
  if (!afterPlan(at, planDate)) return null;
  const status = latestStatus(profile?.checkins?.last_outcome || profile?.checkins?.lastOutcome);
  if (CAUTION_STATUS.has(status)) {
    return {
      kind: "caution",
      at,
      signalIds: ["service-checkins"],
      note: "Recent check-in activity shows a missed or unresolved outcome since this plan was generated.",
    };
  }
  if (POSITIVE_STATUS.has(status) || !status) {
    return {
      kind: "positive",
      at,
      signalIds: ["service-checkins"],
      note: "Recent check-in activity completed successfully after this plan was generated.",
    };
  }
  return null;
}

function brainCoachSignal(profile, planDate) {
  const at = parseDate(
    profile?.brainCoach?.last_session_at
    || profile?.brainCoach?.lastSessionAt
    || profile?.brainCoach?.last_reported_at
    || profile?.brainCoach?.lastReportedAt
    || profile?.brainCoach?.last_outcome_at
    || profile?.brainCoach?.lastOutcomeAt,
  );
  if (!afterPlan(at, planDate)) return null;
  const status = latestStatus(profile?.brainCoach?.last_outcome || profile?.brainCoach?.lastOutcome);
  if (CAUTION_STATUS.has(status)) {
    return {
      kind: "caution",
      at,
      signalIds: ["service-brain-coach"],
      note: "Recent Brain Coach activity shows a missed or unresolved outcome since this plan was generated.",
    };
  }
  if (POSITIVE_STATUS.has(status) || !status) {
    return {
      kind: "positive",
      at,
      signalIds: ["service-brain-coach"],
      note: "Recent Brain Coach activity completed successfully after this plan was generated.",
    };
  }
  return null;
}

function medicationSignal(profile, planDate) {
  const at = parseDate(
    profile?.medicationActivity?.occurred_at
    || profile?.medicationActivity?.occurredAt
    || profile?.medicationActivity?.reported_at
    || profile?.medicationActivity?.reportedAt
    || profile?.medicationActivity?.created_at,
  );
  if (!afterPlan(at, planDate)) return null;
  const status = latestStatus(profile?.medicationActivity?.status);
  if (CAUTION_STATUS.has(status)) {
    return {
      kind: "caution",
      at,
      signalIds: ["medication-plan"],
      note: "Recent medication activity shows a missed, late, or unresolved outcome since this plan was generated.",
    };
  }
  if (POSITIVE_STATUS.has(status) || !status) {
    return {
      kind: "positive",
      at,
      signalIds: ["medication-plan"],
      note: "Recent medication activity completed successfully after this plan was generated.",
    };
  }
  return null;
}

function addEventDrivenSectionFeedback(entries, {
  prefix,
  plan,
  sectionKeys,
  signalIds,
  events,
  positiveNote,
  cautionNote,
}) {
  for (const event of events) {
    const kind = eventKind(event.status);
    if (!kind) continue;
    for (const sectionKey of sectionKeys[kind] || []) {
      addForSectionAndItems(entries, {
        prefix,
        plan,
        sectionKey,
        signalIds: event.signal_ids?.length ? event.signal_ids : signalIds,
        outcome: kind === "positive" ? "helped" : "needs_follow_up",
        note: kind === "positive"
          ? noteFromEvent(event, positiveNote)
          : noteFromEvent(event, cautionNote),
        recordedAt: event.occurred_at,
      });
    }
  }
}

export function buildHealthPlanInferredFeedbackEntries({
  plan = null,
  profile = null,
  predictiveContext = null,
  followThrough = null,
} = {}) {
  const planDate = parseDate(plan?.generated_at);
  if (!planDate || !plan) return [];

  const entries = [];

  const checkinEvents = recentOperationalEvents(profile, planDate, "checkins");
  if (checkinEvents.length) {
    addEventDrivenSectionFeedback(entries, {
      prefix: "inferred-checkin-event",
      plan,
      sectionKeys: {
        positive: ["daily_support_json"],
        caution: ["daily_support_json", "monitoring_json"],
      },
      signalIds: ["service-checkins"],
      events: checkinEvents,
      positiveNote: "Recent check-in activity completed successfully after this plan was generated.",
      cautionNote: "Recent check-in activity shows a missed or unresolved outcome since this plan was generated.",
    });
  } else {
    const checkin = checkinSignal(profile, planDate);
    if (checkin?.kind === "positive") {
      addForSectionAndItems(entries, {
        prefix: "inferred-checkin-positive",
        plan,
        sectionKey: "daily_support_json",
        signalIds: checkin.signalIds,
        outcome: "helped",
        note: checkin.note,
        recordedAt: checkin.at,
      });
    } else if (checkin?.kind === "caution") {
      for (const sectionKey of ["daily_support_json", "monitoring_json"]) {
        addForSectionAndItems(entries, {
          prefix: "inferred-checkin-caution",
          plan,
          sectionKey,
          signalIds: checkin.signalIds,
          outcome: "needs_follow_up",
          note: checkin.note,
          recordedAt: checkin.at,
        });
      }
    }
  }

  const brainCoachEvents = recentOperationalEvents(profile, planDate, "brain_coach");
  if (brainCoachEvents.length) {
    addEventDrivenSectionFeedback(entries, {
      prefix: "inferred-brain-event",
      plan,
      sectionKeys: {
        positive: ["daily_support_json"],
        caution: ["daily_support_json"],
      },
      signalIds: ["service-brain-coach"],
      events: brainCoachEvents,
      positiveNote: "Recent Brain Coach activity completed successfully after this plan was generated.",
      cautionNote: "Recent Brain Coach activity shows a missed or unresolved outcome since this plan was generated.",
    });
  } else {
    const brainCoach = brainCoachSignal(profile, planDate);
    if (brainCoach?.kind === "positive") {
      addForSectionAndItems(entries, {
        prefix: "inferred-brain-positive",
        plan,
        sectionKey: "daily_support_json",
        signalIds: brainCoach.signalIds,
        outcome: "helped",
        note: brainCoach.note,
        recordedAt: brainCoach.at,
      });
    } else if (brainCoach?.kind === "caution") {
      addForSectionAndItems(entries, {
        prefix: "inferred-brain-caution",
        plan,
        sectionKey: "daily_support_json",
        signalIds: brainCoach.signalIds,
        outcome: "needs_follow_up",
        note: brainCoach.note,
        recordedAt: brainCoach.at,
      });
    }
  }

  const medicationEvents = recentOperationalEvents(profile, planDate, "medication");
  if (medicationEvents.length) {
    addEventDrivenSectionFeedback(entries, {
      prefix: "inferred-medication-event",
      plan,
      sectionKeys: {
        positive: ["daily_support_json", "monitoring_json"],
        caution: ["daily_support_json", "monitoring_json", "escalation_json"],
      },
      signalIds: ["medication-plan"],
      events: medicationEvents,
      positiveNote: "Recent medication activity completed successfully after this plan was generated.",
      cautionNote: "Recent medication activity shows a missed, late, or unresolved outcome since this plan was generated.",
    });
  } else {
    const medication = medicationSignal(profile, planDate);
    if (medication?.kind === "positive") {
      for (const sectionKey of ["daily_support_json", "monitoring_json"]) {
        addForSectionAndItems(entries, {
          prefix: "inferred-medication-positive",
          plan,
          sectionKey,
          signalIds: medication.signalIds,
          outcome: "helped",
          note: medication.note,
          recordedAt: medication.at,
        });
      }
    } else if (medication?.kind === "caution") {
      for (const sectionKey of ["daily_support_json", "monitoring_json", "escalation_json"]) {
        addForSectionAndItems(entries, {
          prefix: "inferred-medication-caution",
          plan,
          sectionKey,
          signalIds: medication.signalIds,
          outcome: "needs_follow_up",
          note: medication.note,
          recordedAt: medication.at,
        });
      }
    }
  }

  const campaignEvents = recentOperationalEvents(profile, planDate, "campaign_call");
  addEventDrivenSectionFeedback(entries, {
    prefix: "inferred-campaign-event",
    plan,
    sectionKeys: {
      positive: ["daily_support_json", "monitoring_json"],
      caution: ["monitoring_json", "escalation_json"],
    },
    signalIds: ["service-checkins", "alert-active"],
    events: campaignEvents,
    positiveNote: "Recent outreach activity reached the client successfully after this plan was generated.",
    cautionNote: "Recent outreach activity did not complete cleanly and may require manual follow-up.",
  });

  const positiveSignals = Array.isArray(followThrough?.positive_signals) ? followThrough.positive_signals : [];
  const cautionSignals = Array.isArray(followThrough?.caution_signals) ? followThrough.caution_signals : [];
  const signalNow = toIso(new Date()) || new Date().toISOString();

  if (positiveSignals.some((signal) => text(signal?.id) === "resolved-alerts-since-plan")) {
    addForSectionAndItems(entries, {
      prefix: "inferred-alerts-resolved",
      plan,
      sectionKey: "escalation_json",
      signalIds: ["alert-active"],
      outcome: "helped",
      note: "Recent alert activity shows that alerts were resolved after this plan was generated.",
      recordedAt: signalNow,
    });
  }
  if (positiveSignals.some((signal) => text(signal?.id) === "risk-improved")) {
    for (const sectionKey of ["goals_json", "monitoring_json"]) {
      addForSectionAndItems(entries, {
        prefix: "inferred-risk-improved",
        plan,
        sectionKey,
        signalIds: ["risk-latest-score", "forecast-near-term"],
        outcome: "helped",
        note: "The current risk picture is better than when this plan was generated.",
        recordedAt: signalNow,
      });
    }
  }

  const cautionIds = new Set(cautionSignals.map((signal) => text(signal?.id)));
  if (cautionIds.has("new-alerts-since-plan") || cautionIds.has("lingering-alerts")) {
    for (const sectionKey of ["monitoring_json", "escalation_json"]) {
      addForSectionAndItems(entries, {
        prefix: "inferred-alerts-caution",
        plan,
        sectionKey,
        signalIds: ["alert-active"],
        outcome: "needs_follow_up",
        note: "Recent alert activity shows unresolved alerts that should reshape monitoring and escalation guidance.",
        recordedAt: signalNow,
      });
    }
  }
  if (cautionIds.has("risk-worsened")) {
    for (const sectionKey of ["monitoring_json", "escalation_json"]) {
      addForSectionAndItems(entries, {
        prefix: "inferred-risk-worsened",
        plan,
        sectionKey,
        signalIds: ["risk-latest-score", "forecast-near-term"],
        outcome: "needs_follow_up",
        note: "The current risk picture is worse than when this plan was generated.",
        recordedAt: signalNow,
      });
    }
  }
  if (cautionIds.has("no-fresh-touchpoints")) {
    for (const sectionKey of ["daily_support_json", "monitoring_json"]) {
      addForSectionAndItems(entries, {
        prefix: "inferred-no-touchpoint",
        plan,
        sectionKey,
        signalIds: ["service-checkins", "service-brain-coach", "medication-plan"],
        outcome: "needs_follow_up",
        note: "There has been no fresh operational touchpoint since this plan was generated.",
        recordedAt: signalNow,
      });
    }
  }

  return dedupeEntries(entries).sort((left, right) => {
    const leftTime = left.recorded_at ? new Date(left.recorded_at).getTime() : 0;
    const rightTime = right.recorded_at ? new Date(right.recorded_at).getTime() : 0;
    return rightTime - leftTime;
  });
}
