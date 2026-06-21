import { normalizeHealthPlanOperationalEvents } from "./healthPlanOperationalEvents.js";

const SECTION_DEFINITIONS = [
  {
    section_key: "goals_json",
    label: "Goals",
    positive_signal_ids: ["risk-improved"],
    caution_signal_ids: ["risk-worsened", "plan-age"],
  },
  {
    section_key: "daily_support_json",
    label: "Daily support",
    positive_signal_ids: ["checkin-since-plan", "brain-coach-since-plan", "medication-since-plan"],
    caution_signal_ids: ["no-fresh-touchpoints", "plan-age"],
  },
  {
    section_key: "monitoring_json",
    label: "Monitoring",
    positive_signal_ids: ["risk-improved", "medication-since-plan"],
    caution_signal_ids: ["risk-worsened", "new-alerts-since-plan", "no-fresh-touchpoints", "plan-age"],
  },
  {
    section_key: "escalation_json",
    label: "Escalation",
    positive_signal_ids: ["resolved-alerts-since-plan"],
    caution_signal_ids: ["new-alerts-since-plan", "lingering-alerts", "risk-worsened"],
  },
  {
    section_key: "caregiver_guidance_json",
    label: "Caregiver guidance",
    positive_signal_ids: [],
    caution_signal_ids: ["new-alerts-since-plan", "plan-age"],
  },
];

function text(value) {
  return String(value || "").trim();
}

function toIso(value) {
  const raw = text(value);
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function unique(values) {
  return [...new Set((Array.isArray(values) ? values : []).map((value) => text(value)).filter(Boolean))];
}

const POSITIVE_STATUS = new Set(["completed", "confirmed", "answered", "reached", "success", "successful", "done", "taken"]);
const CAUTION_STATUS = new Set(["missed", "unconfirmed", "no_answer", "no_response", "not_reached", "failed", "failure", "late", "skipped", "declined", "busy", "timeout", "pending", "queued", "cancelled"]);

function statusKind(value) {
  const normalized = text(value).toLowerCase().replace(/[\s-]+/g, "_");
  if (CAUTION_STATUS.has(normalized)) return "caution";
  if (POSITIVE_STATUS.has(normalized) || !normalized) return "positive";
  return "neutral";
}

function sourceLabel(source) {
  if (source === "checkins") return "Check-ins";
  if (source === "brain_coach") return "Brain Coach";
  if (source === "medication") return "Medication";
  if (source === "campaign_call") return "Outreach";
  if (source === "alert") return "Alerts";
  return "Context";
}

function categoryFromSignalId(id = "", sourceSignals = []) {
  const normalizedId = text(id);
  const signal = (Array.isArray(sourceSignals) ? sourceSignals : []).find((item) => text(item?.id) === normalizedId);
  const category = text(signal?.category).toLowerCase();
  if (category) return category;
  if (normalizedId === "service-checkins" || normalizedId === "service-brain-coach") return "service";
  if (normalizedId === "medication-plan") return "medication";
  if (normalizedId === "care-circle-context" || normalizedId === "consent-family-sharing") return "care-circle";
  if (normalizedId === "alert-active") return "alert";
  if (normalizedId === "risk-latest-score" || normalizedId === "forecast-near-term") return "risk";
  return "context";
}

function eventCategory(event = {}) {
  const source = text(event?.source);
  if (source === "checkins" || source === "brain_coach" || source === "campaign_call") return "service";
  if (source === "medication") return "medication";
  if (source === "alert") return "alert";
  return "context";
}

function eventMatchesRecommendation(event, item, sourceSignals = []) {
  const itemSignalIds = new Set(unique(item?.source_signal_ids));
  const eventSignalIds = unique(event?.signal_ids);
  if (eventSignalIds.some((signalId) => itemSignalIds.has(signalId))) return true;
  const itemCategories = new Set(unique(item?.source_signal_ids).map((signalId) => categoryFromSignalId(signalId, sourceSignals)));
  return itemCategories.has(eventCategory(event));
}

function operationalPattern(positiveCount, cautionCount) {
  if (positiveCount >= 2 && cautionCount === 0) return "reinforcing";
  if (cautionCount >= 2 && positiveCount === 0) return "conflicting";
  if (cautionCount > positiveCount) return "conflicting";
  if (positiveCount > cautionCount && positiveCount > 0) return "reinforcing";
  if (positiveCount > 0 || cautionCount > 0) return "mixed";
  return "limited";
}

function buildRecommendationOperationalEvidence({ item, recentOperationalEvents = [], sourceSignals = [] }) {
  const matchedEvents = normalizeHealthPlanOperationalEvents(recentOperationalEvents)
    .filter((event) => eventMatchesRecommendation(event, item, sourceSignals));
  const positiveEvents = matchedEvents.filter((event) => statusKind(event?.status) === "positive");
  const cautionEvents = matchedEvents.filter((event) => statusKind(event?.status) === "caution");
  const sources = unique(matchedEvents.map((event) => sourceLabel(event?.source))).slice(0, 4);
  const pattern = operationalPattern(positiveEvents.length, cautionEvents.length);
  const lastEventAt = matchedEvents[0]?.occurred_at || null;
  const reason =
    pattern === "reinforcing"
      ? `${sources[0] || "Recent operational activity"} has been reinforcing this recommendation in practice.`
      : pattern === "conflicting"
        ? `${sources[0] || "Recent operational activity"} has been undermining this recommendation in practice.`
        : pattern === "mixed"
          ? `${sources[0] || "Recent operational activity"} has produced a mixed picture around this recommendation.`
          : "Operational evidence around this recommendation is still limited.";

  return {
    positive_count: positiveEvents.length,
    caution_count: cautionEvents.length,
    source_labels: sources,
    pattern,
    last_event_at: lastEventAt,
    reason,
  };
}

function daysSince(iso, now = new Date()) {
  const current = now instanceof Date ? now : new Date(now);
  const parsed = iso ? new Date(iso) : null;
  if (!parsed || Number.isNaN(parsed.getTime()) || Number.isNaN(current.getTime())) return null;
  return Math.max(0, (current.getTime() - parsed.getTime()) / (24 * 60 * 60 * 1000));
}

function freshnessBucket(recordedAt, now = new Date()) {
  const ageDays = daysSince(recordedAt, now);
  if (ageDays == null) return null;
  if (ageDays <= 3) return "fresh";
  if (ageDays <= 10) return "aging";
  return "stale";
}

function freshnessMultiplier(recordedAt, now = new Date()) {
  const bucket = freshnessBucket(recordedAt, now);
  if (bucket === "fresh") return 1;
  if (bucket === "aging") return 0.72;
  if (bucket === "stale") return 0.4;
  return 0.7;
}

function outcomeRecencyWeight(recordedAt, now = new Date()) {
  const ageDays = daysSince(recordedAt, now);
  if (ageDays == null) return 0.7;
  if (ageDays <= 3) return 1.35;
  if (ageDays <= 10) return 1;
  if (ageDays <= 21) return 0.72;
  return 0.45;
}

function outcomeSourceWeight(source) {
  return inferredSource(source) ? 0.72 : 1.15;
}

function weightedOutcomeContribution(entry = {}, now = new Date()) {
  const factor = outcomeRecencyWeight(entry?.recorded_at, now) * outcomeSourceWeight(entry?.source);
  const outcome = text(entry?.outcome);
  if (outcome === "helped") return { helped: 1 * factor, caution: 0 };
  if (outcome === "mixed") return { helped: 0.45 * factor, caution: 0.45 * factor };
  if (outcome === "needs_follow_up") return { helped: 0, caution: 0.95 * factor };
  if (outcome === "did_not_help") return { helped: 0, caution: 1.2 * factor };
  return { helped: 0, caution: 0 };
}

function inferredSource(value) {
  return text(value) === "inferred_operational";
}

function normalizeRecommendedNextAction(value) {
  const normalized = text(value).toLowerCase();
  if (["preserve", "verify", "rework", "retire"].includes(normalized)) return normalized;
  return null;
}

function normalizeConfidenceLevel(value) {
  const normalized = text(value).toLowerCase();
  if (["high", "medium", "low"].includes(normalized)) return normalized;
  return null;
}

function outcomeRank(outcome) {
  if (outcome === "helped") return 3;
  if (outcome === "mixed") return 2;
  if (outcome === "needs_follow_up") return 1;
  if (outcome === "did_not_help") return 0;
  return -1;
}

function normalizeFeedbackEntries(entries) {
  return (Array.isArray(entries) ? entries : [])
    .map((item) => ({
      id: text(item?.id),
      section_key: text(item?.section_key),
      item_id: text(item?.item_id) || null,
      outcome: text(item?.outcome),
      recommended_next_action: normalizeRecommendedNextAction(item?.recommended_next_action || item?.recommendedNextAction),
      confidence_level: normalizeConfidenceLevel(item?.confidence_level || item?.confidenceLevel),
      note: text(item?.note) || null,
      recorded_at: toIso(item?.recorded_at),
      recorded_by_email: text(item?.recorded_by_email) || null,
      source: text(item?.source) || "manual",
    }))
    .filter((item) => item.section_key && item.outcome);
}

function latestFeedbackBySection(entries, sectionKey) {
  return normalizeFeedbackEntries(entries)
    .filter((item) => item.section_key === sectionKey && !item.item_id)
    .sort((left, right) => {
      const leftTime = left.recorded_at ? new Date(left.recorded_at).getTime() : 0;
      const rightTime = right.recorded_at ? new Date(right.recorded_at).getTime() : 0;
      return rightTime - leftTime || outcomeRank(right.outcome) - outcomeRank(left.outcome);
    })[0] || null;
}

function sectionFeedbackHistory(entries, sectionKey) {
  return normalizeFeedbackEntries(entries)
    .filter((item) => item.section_key === sectionKey && !item.item_id)
    .sort((left, right) => {
      const leftTime = left.recorded_at ? new Date(left.recorded_at).getTime() : 0;
      const rightTime = right.recorded_at ? new Date(right.recorded_at).getTime() : 0;
      return rightTime - leftTime || outcomeRank(right.outcome) - outcomeRank(left.outcome);
    });
}

function relevantSignals(signals, allowedIds) {
  return (Array.isArray(signals) ? signals : []).filter((signal) => allowedIds.includes(text(signal?.id)));
}

function evidenceLinkedCount(plan, sectionKey) {
  return (Array.isArray(plan?.[sectionKey]) ? plan[sectionKey] : [])
    .filter((item) => Array.isArray(item?.source_signal_ids) && item.source_signal_ids.length > 0)
    .length;
}

function decayTowardNeutral(baseScore, neutralScore, recordedAt, now = new Date()) {
  if (!recordedAt) return baseScore;
  const multiplier = freshnessMultiplier(recordedAt, now);
  return Math.round(neutralScore + ((baseScore - neutralScore) * multiplier));
}

function scoreFor({
  latestFeedback,
  feedbackSummary,
  relevantPositive,
  relevantCaution,
  driftStatus,
  evidenceCount,
  now = new Date(),
}) {
  if (driftStatus === "needs_refresh") return 24;
  const neutralScore = evidenceCount > 0 ? 46 : 28;
  if (latestFeedback?.outcome === "did_not_help") {
    return decayTowardNeutral(inferredSource(latestFeedback.source) ? 24 : 18, neutralScore, latestFeedback.recorded_at, now);
  }
  if (latestFeedback?.outcome === "needs_follow_up") {
    return decayTowardNeutral(inferredSource(latestFeedback.source) ? 38 : 34, neutralScore, latestFeedback.recorded_at, now);
  }
  if (relevantCaution.length > 0 && latestFeedback?.outcome !== "helped") return 32;
  if (latestFeedback?.outcome === "mixed") {
    return decayTowardNeutral(inferredSource(latestFeedback.source) ? 52 : 56, neutralScore, latestFeedback.recorded_at, now);
  }
  if (latestFeedback?.outcome === "helped") {
    return decayTowardNeutral(
      inferredSource(latestFeedback.source)
        ? (relevantCaution.length > 0 ? 54 : 68)
        : (relevantCaution.length > 0 ? 60 : 86),
      neutralScore,
      latestFeedback.recorded_at,
      now,
    );
  }
  if (
    feedbackSummary?.explicit_helped_count >= 2
    && feedbackSummary?.did_not_help_count === 0
    && feedbackSummary?.needs_follow_up_count === 0
    && relevantCaution.length === 0
  ) {
    return 78;
  }
  if (
    feedbackSummary?.inferred_helped_count >= 2
    && feedbackSummary?.did_not_help_count === 0
    && feedbackSummary?.needs_follow_up_count === 0
    && relevantCaution.length === 0
  ) {
    return 62;
  }
  if (
    feedbackSummary?.needs_follow_up_count >= 2
    || feedbackSummary?.did_not_help_count >= 2
  ) {
    return 26;
  }
  if (relevantCaution.length >= 2 && feedbackSummary?.helped_count === 0) return 28;
  if (relevantPositive.length > 0 && evidenceCount > 0) return 72;
  if (evidenceCount > 0) return 46;
  return 28;
}

function statusFor(score) {
  if (score >= 70) return "helping";
  if (score >= 45) return "mixed";
  if (score >= 30) return "unproven";
  return "fragile";
}

function reasonFor({ latestFeedback, relevantPositive, relevantCaution, driftReason, status, evidenceCount }) {
  if (driftReason) return driftReason;
  if (latestFeedback?.note) return latestFeedback.note;
  if (latestFeedback?.outcome === "did_not_help") return "Staff recorded that this section did not hold up well in practice.";
  if (latestFeedback?.outcome === "needs_follow_up") return "Staff recorded that this section still needs follow-up before it can be trusted.";
  if (latestFeedback?.outcome === "mixed") return "Staff recorded a mixed result, so this section likely needs refinement rather than reuse as-is.";
  if (latestFeedback?.outcome === "helped") return "Staff recorded that this section helped in practice and is worth preserving unless newer evidence contradicts it.";
  if (relevantCaution.length > 0) return text(relevantCaution[0]?.detail) || text(relevantCaution[0]?.label) || "New caution signals mean this section should be checked again.";
  if (relevantPositive.length > 0) return text(relevantPositive[0]?.detail) || text(relevantPositive[0]?.label) || "Recent positive follow-through supports this section.";
  if (evidenceCount > 0) return status === "mixed" ? "This section has evidence behind it, but not enough outcome proof yet." : "This section is still waiting for stronger client-specific proof.";
  return "This section has not been tested enough in real use yet.";
}

function summarizeSectionFeedbackHistory(history = [], now = new Date()) {
  const helped = history.filter((item) => item.outcome === "helped").length;
  const mixed = history.filter((item) => item.outcome === "mixed").length;
  const didNotHelp = history.filter((item) => item.outcome === "did_not_help").length;
  const needsFollowUp = history.filter((item) => item.outcome === "needs_follow_up").length;
  const explicitEntries = history.filter((item) => !inferredSource(item.source));
  const inferredEntries = history.filter((item) => inferredSource(item.source));
  const recentEntries = history.filter((item) => {
    const ageDays = daysSince(item?.recorded_at, now);
    return ageDays != null && ageDays <= 10;
  });
  const weighted = history.reduce((totals, item) => {
    const contribution = weightedOutcomeContribution(item, now);
    return {
      helped: totals.helped + contribution.helped,
      caution: totals.caution + contribution.caution,
    };
  }, { helped: 0, caution: 0 });
  return {
    feedback_count: history.length,
    helped_count: helped,
    mixed_count: mixed,
    did_not_help_count: didNotHelp,
    needs_follow_up_count: needsFollowUp,
    explicit_feedback_count: explicitEntries.length,
    inferred_feedback_count: inferredEntries.length,
    explicit_helped_count: explicitEntries.filter((item) => item.outcome === "helped").length,
    inferred_helped_count: inferredEntries.filter((item) => item.outcome === "helped").length,
    recent_helped_count: recentEntries.filter((item) => item.outcome === "helped").length,
    recent_explicit_helped_count: recentEntries.filter((item) => item.outcome === "helped" && !inferredSource(item.source)).length,
    recent_caution_count: recentEntries.filter((item) => ["did_not_help", "needs_follow_up"].includes(item.outcome)).length,
    weighted_helped_score: Number(weighted.helped.toFixed(2)),
    weighted_caution_score: Number(weighted.caution.toFixed(2)),
  };
}

function sectionOutcomeTrend({ summary, latestFeedback, relevantPositive, relevantCaution }) {
  if ((summary.did_not_help_count + summary.needs_follow_up_count) >= 2 || relevantCaution.length >= 2) return "weakening";
  if (summary.explicit_helped_count >= 2 || (summary.inferred_helped_count >= 2 && relevantCaution.length === 0)) return "strengthening";
  if (summary.helped_count > 0 && (summary.did_not_help_count > 0 || summary.needs_follow_up_count > 0 || summary.mixed_count > 0)) return "mixed";
  if (summary.mixed_count > 0) return "mixed";
  if (summary.helped_count > 0 || relevantPositive.length > 0) return "steady";
  if (latestFeedback || relevantCaution.length > 0) return "watch";
  return "untested";
}

function sectionEvidenceBalance({ summary, relevantPositive, relevantCaution }) {
  const positiveWeight = (summary.helped_count * 2) + summary.mixed_count + relevantPositive.length;
  const cautionWeight = (summary.did_not_help_count * 2) + (summary.needs_follow_up_count * 2) + relevantCaution.length;
  if (positiveWeight >= cautionWeight + 2) return "supportive";
  if (cautionWeight >= positiveWeight + 2) return "caution";
  return "mixed";
}

function sectionOperationalLearningSummary({
  summary,
  trend,
  evidenceBalance,
  relevantPositive,
  relevantCaution,
}) {
  if (trend === "strengthening" && summary.explicit_helped_count >= 2) {
    return "Repeated explicit staff feedback says this section is holding up well in practice.";
  }
  if (trend === "strengthening" && summary.inferred_helped_count >= 2) {
    return "Repeated positive operational follow-through suggests this section is helping, though it still has less weight than direct staff confirmation.";
  }
  if (trend === "weakening") {
    return "Repeated caution outcomes say this section is not holding up reliably and should be rewritten before reuse.";
  }
  if (evidenceBalance === "caution" && relevantCaution.length > 0) {
    return text(relevantCaution[0]?.detail) || text(relevantCaution[0]?.label) || "Fresh caution signals are outweighing the positive evidence in this section.";
  }
  if (evidenceBalance === "supportive" && relevantPositive.length > 0) {
    return text(relevantPositive[0]?.detail) || text(relevantPositive[0]?.label) || "Recent positive follow-through is supporting this section.";
  }
  return "This section has mixed real-world evidence and should be carried forward with judgment rather than blind reuse.";
}

function contradictionState({ latestFeedback, relevantPositive, relevantCaution, driftStatus, driftReason }) {
  if (latestFeedback?.outcome === "helped" && (driftStatus === "needs_refresh" || relevantCaution.length > 0)) {
    return {
      status: "live_conflict",
      reason: text(driftReason) || text(relevantCaution[0]?.detail) || text(relevantCaution[0]?.label) || "Live signals now conflict with earlier positive feedback.",
    };
  }
  if ((latestFeedback?.outcome === "did_not_help" || latestFeedback?.outcome === "needs_follow_up") && relevantPositive.length > 0 && relevantCaution.length === 0) {
    return {
      status: "improving_against_feedback",
      reason: text(relevantPositive[0]?.detail) || text(relevantPositive[0]?.label) || "Newer positive signals suggest the situation may have improved since the last negative feedback.",
    };
  }
  return { status: null, reason: null };
}

export function buildHealthPlanOutcomeScores({
  plan = null,
  feedbackEntries = [],
  followThrough = null,
  sectionDrift = [],
  now = new Date(),
} = {}) {
  if (!plan) return [];
  const driftLookup = new Map(
    (Array.isArray(sectionDrift) ? sectionDrift : [])
      .map((item) => [text(item?.section_key), item])
      .filter(([sectionKey]) => sectionKey),
  );

  return SECTION_DEFINITIONS
    .filter((definition) => Array.isArray(plan?.[definition.section_key]) && plan[definition.section_key].length > 0)
    .map((definition) => {
      const latestFeedback = latestFeedbackBySection(feedbackEntries, definition.section_key);
      const feedbackHistory = sectionFeedbackHistory(feedbackEntries, definition.section_key);
      const feedbackSummary = summarizeSectionFeedbackHistory(feedbackHistory, now);
      const relevantPositive = relevantSignals(followThrough?.positive_signals, definition.positive_signal_ids);
      const relevantCaution = relevantSignals(followThrough?.caution_signals, definition.caution_signal_ids);
      const drift = driftLookup.get(definition.section_key);
      const evidenceCount = evidenceLinkedCount(plan, definition.section_key);
      const score = scoreFor({
        latestFeedback,
        feedbackSummary,
        relevantPositive,
        relevantCaution,
        driftStatus: text(drift?.status),
        evidenceCount,
        now,
      });
      const status = statusFor(score);
      const trend = sectionOutcomeTrend({
        summary: feedbackSummary,
        latestFeedback,
        relevantPositive,
        relevantCaution,
      });
      const evidenceBalance = sectionEvidenceBalance({
        summary: feedbackSummary,
        relevantPositive,
        relevantCaution,
      });
      const contradiction = contradictionState({
        latestFeedback,
        relevantPositive,
        relevantCaution,
        driftStatus: text(drift?.status),
        driftReason: drift?.reasons?.[0],
      });

      return {
        section_key: definition.section_key,
        label: definition.label,
        score,
        status,
        latest_outcome: latestFeedback?.outcome || null,
        latest_note: latestFeedback?.note || null,
        latest_source: latestFeedback?.source || null,
        latest_recommended_next_action: latestFeedback?.recommended_next_action || null,
        latest_confidence_level: latestFeedback?.confidence_level || null,
        recorded_at: latestFeedback?.recorded_at || null,
        recorded_by_email: latestFeedback?.recorded_by_email || null,
        freshness_status: freshnessBucket(latestFeedback?.recorded_at, now),
        freshness_days: daysSince(latestFeedback?.recorded_at, now),
        feedback_count: feedbackSummary.feedback_count,
        explicit_feedback_count: feedbackSummary.explicit_feedback_count,
        inferred_feedback_count: feedbackSummary.inferred_feedback_count,
        helped_count: feedbackSummary.helped_count,
        mixed_count: feedbackSummary.mixed_count,
        did_not_help_count: feedbackSummary.did_not_help_count,
        needs_follow_up_count: feedbackSummary.needs_follow_up_count,
        recent_helped_count: feedbackSummary.recent_helped_count,
        recent_explicit_helped_count: feedbackSummary.recent_explicit_helped_count,
        recent_caution_count: feedbackSummary.recent_caution_count,
        weighted_helped_score: feedbackSummary.weighted_helped_score,
        weighted_caution_score: feedbackSummary.weighted_caution_score,
        positive_signal_count: relevantPositive.length,
        caution_signal_count: relevantCaution.length,
        trend,
        evidence_balance: evidenceBalance,
        contradiction_status: contradiction.status,
        contradiction_reason: contradiction.reason,
        evidence_count: evidenceCount,
        operational_learning_summary: sectionOperationalLearningSummary({
          summary: feedbackSummary,
          trend,
          evidenceBalance,
          relevantPositive,
          relevantCaution,
        }),
        reason: reasonFor({
          latestFeedback,
          relevantPositive,
          relevantCaution,
          driftReason: text(drift?.reasons?.[0]) || null,
          status,
          evidenceCount,
        }),
      };
    })
    .sort((left, right) => left.score - right.score);
}

export function buildHealthPlanOutcomeScoreBrief(items = []) {
  return (Array.isArray(items) ? items : [])
    .slice(0, 5)
    .map((item) => ({
      section_key: text(item?.section_key),
      label: text(item?.label),
      status: text(item?.status) || "unproven",
      score: Number.isFinite(Number(item?.score)) ? Number(item.score) : 0,
      latest_outcome: text(item?.latest_outcome) || null,
      freshness_status: text(item?.freshness_status) || null,
      explicit_feedback_count: Number.isFinite(Number(item?.explicit_feedback_count)) ? Number(item.explicit_feedback_count) : 0,
      inferred_feedback_count: Number.isFinite(Number(item?.inferred_feedback_count)) ? Number(item.inferred_feedback_count) : 0,
      positive_signal_count: Number.isFinite(Number(item?.positive_signal_count)) ? Number(item.positive_signal_count) : 0,
      caution_signal_count: Number.isFinite(Number(item?.caution_signal_count)) ? Number(item.caution_signal_count) : 0,
      trend: text(item?.trend) || "untested",
      evidence_balance: text(item?.evidence_balance) || "mixed",
      contradiction_status: text(item?.contradiction_status) || null,
      operational_learning_summary: text(item?.operational_learning_summary) || null,
      reason: text(item?.reason),
    }))
    .filter((item) => item.section_key && item.label && item.reason);
}

function recommendationSections(plan) {
  return SECTION_DEFINITIONS.flatMap((definition) =>
    (Array.isArray(plan?.[definition.section_key]) ? plan[definition.section_key] : []).map((item) => ({
      ...item,
      section_key: definition.section_key,
      section_label: definition.label,
    })),
  );
}

function latestFeedbackByItem(entries, sectionKey, itemId) {
  if (!itemId) return null;
  return normalizeFeedbackEntries(entries)
    .filter((item) => item.section_key === sectionKey && item.item_id === itemId)
    .sort((left, right) => {
      const leftTime = left.recorded_at ? new Date(left.recorded_at).getTime() : 0;
      const rightTime = right.recorded_at ? new Date(right.recorded_at).getTime() : 0;
      return rightTime - leftTime || outcomeRank(right.outcome) - outcomeRank(left.outcome);
    })[0] || null;
}

function feedbackHistoryByItem(entries, sectionKey, itemId) {
  if (!itemId) return [];
  return normalizeFeedbackEntries(entries)
    .filter((item) => item.section_key === sectionKey && item.item_id === itemId)
    .sort((left, right) => {
      const leftTime = left.recorded_at ? new Date(left.recorded_at).getTime() : 0;
      const rightTime = right.recorded_at ? new Date(right.recorded_at).getTime() : 0;
      return rightTime - leftTime || outcomeRank(right.outcome) - outcomeRank(left.outcome);
    });
}

function recommendationNeutralScore(item) {
  if (text(item?.confidence) === "high" && Array.isArray(item?.source_signal_ids) && item.source_signal_ids.length > 0) return 54;
  if (text(item?.confidence) === "medium") return 46;
  return 34;
}

function recommendationScore({ itemFeedback, sectionFeedback, item, now = new Date() }) {
  const neutralScore = recommendationNeutralScore(item);
  if (itemFeedback?.recommended_next_action === "retire") return decayTowardNeutral(16, neutralScore, itemFeedback.recorded_at, now);
  if (itemFeedback?.recommended_next_action === "rework") return decayTowardNeutral(34, neutralScore, itemFeedback.recorded_at, now);
  if (itemFeedback?.recommended_next_action === "verify") return decayTowardNeutral(42, neutralScore, itemFeedback.recorded_at, now);
  if (itemFeedback?.recommended_next_action === "preserve" && itemFeedback?.confidence_level === "high") {
    return decayTowardNeutral(84, neutralScore, itemFeedback.recorded_at, now);
  }
  if (itemFeedback?.outcome === "did_not_help") return decayTowardNeutral(inferredSource(itemFeedback.source) ? 20 : 14, neutralScore, itemFeedback.recorded_at, now);
  if (itemFeedback?.outcome === "needs_follow_up") return decayTowardNeutral(inferredSource(itemFeedback.source) ? 34 : 28, neutralScore, itemFeedback.recorded_at, now);
  if (itemFeedback?.outcome === "mixed") return decayTowardNeutral(inferredSource(itemFeedback.source) ? 50 : 56, neutralScore, itemFeedback.recorded_at, now);
  if (itemFeedback?.outcome === "helped") return decayTowardNeutral(inferredSource(itemFeedback.source) ? 72 : 88, neutralScore, itemFeedback.recorded_at, now);
  if (sectionFeedback?.outcome === "did_not_help") return decayTowardNeutral(inferredSource(sectionFeedback.source) ? 30 : 26, neutralScore, sectionFeedback.recorded_at, now);
  if (sectionFeedback?.outcome === "needs_follow_up") return decayTowardNeutral(inferredSource(sectionFeedback.source) ? 40 : 36, neutralScore, sectionFeedback.recorded_at, now);
  if (sectionFeedback?.outcome === "mixed") return decayTowardNeutral(inferredSource(sectionFeedback.source) ? 48 : 52, neutralScore, sectionFeedback.recorded_at, now);
  if (sectionFeedback?.outcome === "helped") return decayTowardNeutral(inferredSource(sectionFeedback.source) ? 60 : 68, neutralScore, sectionFeedback.recorded_at, now);
  if (item?.operational_evidence?.pattern === "conflicting") return Math.max(18, neutralScore - (12 + (item.operational_evidence.caution_count * 5)));
  if (item?.operational_evidence?.pattern === "reinforcing") return Math.min(74, neutralScore + (10 + (item.operational_evidence.positive_count * 4)));
  if (item?.operational_evidence?.pattern === "mixed") return Math.max(30, neutralScore - 2 + (item.operational_evidence.positive_count * 2) - (item.operational_evidence.caution_count * 3));
  return neutralScore;
}

function recommendationStatus(score) {
  if (score >= 75) return "helping";
  if (score >= 50) return "mixed";
  if (score >= 32) return "unproven";
  return "fragile";
}

function recommendationReason({ itemFeedback, sectionFeedback, item }) {
  if (itemFeedback?.source === "inferred_operational" && itemFeedback?.note) return itemFeedback.note;
  if (itemFeedback?.note) return itemFeedback.note;
  if (itemFeedback?.outcome === "helped") return "Staff recorded that this specific recommendation helped in practice.";
  if (itemFeedback?.outcome === "mixed") return "Staff recorded that this recommendation helped only partially and should be refined.";
  if (itemFeedback?.outcome === "did_not_help") return "Staff recorded that this recommendation did not help in practice.";
  if (itemFeedback?.outcome === "needs_follow_up") return "Staff recorded that this recommendation still needs follow-up before it can be trusted.";
  if (sectionFeedback?.note) return sectionFeedback.note;
  if (sectionFeedback?.outcome === "helped") return "The surrounding section held up well, but this specific recommendation still lacks direct proof.";
  if (Array.isArray(item?.source_signal_ids) && item.source_signal_ids.length > 0) return "This recommendation is evidence-linked, but still waiting for direct outcome feedback.";
  return "This recommendation has not been tested directly yet.";
}

function summarizeRecommendationHistory(history = [], now = new Date()) {
  const helped = history.filter((item) => item.outcome === "helped").length;
  const mixed = history.filter((item) => item.outcome === "mixed").length;
  const didNotHelp = history.filter((item) => item.outcome === "did_not_help").length;
  const needsFollowUp = history.filter((item) => item.outcome === "needs_follow_up").length;
  const recentEntries = history.filter((item) => {
    const ageDays = daysSince(item?.recorded_at, now);
    return ageDays != null && ageDays <= 10;
  });
  const weighted = history.reduce((totals, item) => {
    const contribution = weightedOutcomeContribution(item, now);
    return {
      helped: totals.helped + contribution.helped,
      caution: totals.caution + contribution.caution,
    };
  }, { helped: 0, caution: 0 });
  return {
    feedback_count: history.length,
    helped_count: helped,
    mixed_count: mixed,
    did_not_help_count: didNotHelp,
    needs_follow_up_count: needsFollowUp,
    explicit_feedback_count: history.filter((item) => !inferredSource(item.source)).length,
    inferred_feedback_count: history.filter((item) => inferredSource(item.source)).length,
    explicit_helped_count: history.filter((item) => item.outcome === "helped" && !inferredSource(item.source)).length,
    inferred_helped_count: history.filter((item) => item.outcome === "helped" && inferredSource(item.source)).length,
    recent_helped_count: recentEntries.filter((item) => item.outcome === "helped").length,
    recent_explicit_helped_count: recentEntries.filter((item) => item.outcome === "helped" && !inferredSource(item.source)).length,
    recent_caution_count: recentEntries.filter((item) => ["did_not_help", "needs_follow_up"].includes(item.outcome)).length,
    weighted_helped_score: Number(weighted.helped.toFixed(2)),
    weighted_caution_score: Number(weighted.caution.toFixed(2)),
  };
}

function recommendationTrajectory({ history = [], itemFeedback = null, sectionFeedback = null, contradictionStatus = null, summary = null }) {
  if (!history.length && !sectionFeedback) return "untested";
  if (contradictionStatus === "live_conflict" || contradictionStatus === "section_conflict") return "volatile";
  const latest = text(itemFeedback?.outcome || sectionFeedback?.outcome);
  const previous = history[1]?.outcome || null;
  const normalizedSummary = summary || summarizeRecommendationHistory(history);

  if (normalizedSummary.recent_explicit_helped_count >= 2 && normalizedSummary.weighted_helped_score > normalizedSummary.weighted_caution_score + 0.8) return "strengthening";
  if (normalizedSummary.helped_count >= 2 && normalizedSummary.did_not_help_count === 0 && normalizedSummary.needs_follow_up_count === 0) return "strengthening";
  if (
    normalizedSummary.recent_caution_count >= 1
    && ["did_not_help", "needs_follow_up"].includes(latest)
    && normalizedSummary.weighted_caution_score > normalizedSummary.weighted_helped_score
  ) {
    return "weakening";
  }
  if ((latest === "did_not_help" || latest === "needs_follow_up") && (normalizedSummary.did_not_help_count + normalizedSummary.needs_follow_up_count >= 2)) return "weakening";
  if (latest === "mixed" && (normalizedSummary.helped_count > 0 || normalizedSummary.did_not_help_count > 0 || normalizedSummary.needs_follow_up_count > 0)) return "volatile";
  if (previous && previous !== latest) return "volatile";
  if (latest === "helped") return "stable";
  if (latest === "did_not_help" || latest === "needs_follow_up") return "weakening";
  if (latest === "mixed") return "volatile";
  return "untested";
}

function recommendationTrajectoryWithOperational({
  history = [],
  itemFeedback = null,
  sectionFeedback = null,
  contradictionStatus = null,
  operationalEvidence = null,
  summary = null,
}) {
  const base = recommendationTrajectory({ history, itemFeedback, sectionFeedback, contradictionStatus, summary });
  if (base !== "untested") return base;
  if (operationalEvidence?.pattern === "reinforcing" && Number(operationalEvidence?.positive_count || 0) >= 2) return "strengthening";
  if (operationalEvidence?.pattern === "conflicting" && Number(operationalEvidence?.caution_count || 0) >= 2) return "weakening";
  if (operationalEvidence?.pattern === "mixed") return "volatile";
  return base;
}

function recommendationReusePriority({ status, trajectory, itemFeedback, contradictionStatus, summary }) {
  if (contradictionStatus === "live_conflict" || contradictionStatus === "section_conflict") return "verify";
  if (
    summary.recent_caution_count >= 1
    && summary.weighted_caution_score > summary.weighted_helped_score + 0.2
    && ["did_not_help", "needs_follow_up"].includes(text(itemFeedback?.outcome))
  ) {
    return "replace";
  }
  if (
    status === "helping"
    && summary.recent_helped_count >= 1
    && summary.weighted_helped_score > summary.weighted_caution_score + 0.8
  ) {
    return "preserve";
  }
  if (status === "helping" && (trajectory === "strengthening" || trajectory === "stable")) return "preserve";
  if (status === "fragile" || trajectory === "weakening" || summary.did_not_help_count >= 2 || summary.needs_follow_up_count >= 2) return "replace";
  if (status === "mixed" || trajectory === "volatile" || itemFeedback?.outcome === "mixed") return "refine";
  return "verify";
}

function recommendationReusePriorityWithOperational({
  status,
  trajectory,
  itemFeedback,
  contradictionStatus,
  summary,
  operationalEvidence = null,
}) {
  const explicitNextAction = normalizeRecommendedNextAction(itemFeedback?.recommended_next_action);
  const explicitConfidence = normalizeConfidenceLevel(itemFeedback?.confidence_level);
  if (explicitNextAction === "retire") return "replace";
  if (explicitNextAction === "rework") return "refine";
  if (explicitNextAction === "verify") return "verify";
  if (explicitNextAction === "preserve") return explicitConfidence === "low" ? "verify" : "preserve";
  const base = recommendationReusePriority({ status, trajectory, itemFeedback, contradictionStatus, summary });
  if (
    operationalEvidence?.pattern === "reinforcing" &&
    Number(operationalEvidence?.positive_count || 0) >= 2 &&
    Number(operationalEvidence?.caution_count || 0) === 0 &&
    trajectory === "strengthening"
  ) {
    return "preserve";
  }
  if (base === "verify" && operationalEvidence?.pattern === "reinforcing" && Number(operationalEvidence?.positive_count || 0) >= 2) {
    return status === "helping" ? "preserve" : "refine";
  }
  if (base === "preserve" && operationalEvidence?.pattern === "conflicting" && Number(operationalEvidence?.caution_count || 0) >= 2) {
    return "verify";
  }
  if (operationalEvidence?.pattern === "conflicting" && Number(operationalEvidence?.caution_count || 0) >= 3) {
    return "replace";
  }
  return base;
}

function recommendationMemoryReason({ itemFeedback, sectionFeedback, item, trajectory, reusePriority, summary }) {
  if (itemFeedback?.note) return itemFeedback.note;
  if (itemFeedback?.recommended_next_action === "preserve") {
    return "Staff explicitly wants the next plan to keep this recommendation because it is holding up in practice.";
  }
  if (itemFeedback?.recommended_next_action === "verify") {
    return "Staff wants the next plan to keep this recommendation under active verification before trusting it fully.";
  }
  if (itemFeedback?.recommended_next_action === "rework") {
    return "Staff wants the next plan to rewrite this recommendation rather than lightly reusing it.";
  }
  if (itemFeedback?.recommended_next_action === "retire") {
    return "Staff wants the next plan to retire this recommendation instead of bringing it back unchanged.";
  }
  if (reusePriority === "preserve" && summary.helped_count >= 2) {
    return "This recommendation has helped repeatedly for this client and is a strong candidate to preserve.";
  }
  if (reusePriority === "replace" && (summary.did_not_help_count + summary.needs_follow_up_count >= 2)) {
    return "This recommendation has repeatedly failed or stayed unresolved and should be replaced, not lightly reworded.";
  }
  if (reusePriority === "refine" && trajectory === "volatile") {
    return "This recommendation has mixed or shifting results, so it should be refined rather than copied forward unchanged.";
  }
  if (reusePriority === "verify") {
    return "This recommendation still needs fresh verification before staff should rely on it confidently.";
  }
  return recommendationReason({ itemFeedback, sectionFeedback, item });
}

function signalWeightDelta(outcome) {
  if (outcome === "helping") return 2;
  if (outcome === "mixed") return 0.5;
  if (outcome === "fragile") return -2;
  if (outcome === "unproven") return -0.5;
  return 0;
}

function trajectoryWeightDelta(trajectory, reusePriority) {
  if (reusePriority === "preserve" && trajectory === "strengthening") return 1.5;
  if (reusePriority === "replace") return -1.5;
  if (reusePriority === "refine") return -0.5;
  if (reusePriority === "verify") return -0.75;
  return 0;
}

function recommendationContradictionState({ itemFeedback, sectionFeedback, followThrough, sectionDriftItem }) {
  const cautionSignals = Array.isArray(followThrough?.caution_signals) ? followThrough.caution_signals : [];
  if (itemFeedback?.outcome === "helped" && (text(sectionDriftItem?.status) === "needs_refresh" || cautionSignals.length > 0)) {
    return {
      status: "live_conflict",
      reason: text(sectionDriftItem?.reasons?.[0]) || text(cautionSignals[0]?.detail) || text(cautionSignals[0]?.label) || "Live signals now conflict with earlier positive feedback on this recommendation.",
    };
  }
  if (!itemFeedback && sectionFeedback?.outcome === "helped" && text(sectionDriftItem?.status) === "needs_refresh") {
    return {
      status: "section_conflict",
      reason: text(sectionDriftItem?.reasons?.[0]) || "The wider section is drifting even though older feedback was positive.",
    };
  }
  return { status: null, reason: null };
}

export function buildHealthPlanRecommendationOutcomeMemory({
  plan = null,
  feedbackEntries = [],
  followThrough = null,
  sectionDrift = [],
  recentOperationalEvents = [],
  sourceSignals = [],
  now = new Date(),
} = {}) {
  if (!plan) return [];
  const normalizedFeedback = normalizeFeedbackEntries(feedbackEntries);
  const driftLookup = new Map(
    (Array.isArray(sectionDrift) ? sectionDrift : [])
      .map((item) => [text(item?.section_key), item])
      .filter(([sectionKey]) => sectionKey),
  );

  return recommendationSections(plan).map((item, index) => {
    const itemId = text(item?.id) || `${item.section_key}:${index + 1}`;
    const itemFeedbackHistory = feedbackHistoryByItem(normalizedFeedback, item.section_key, text(item?.id));
    const itemFeedback = latestFeedbackByItem(normalizedFeedback, item.section_key, text(item?.id));
    const sectionFeedback = latestFeedbackBySection(normalizedFeedback, item.section_key);
    const operationalEvidence = buildRecommendationOperationalEvidence({ item, recentOperationalEvents, sourceSignals });
    const score = recommendationScore({ itemFeedback, sectionFeedback, item: { ...item, operational_evidence: operationalEvidence }, now });
    const status = recommendationStatus(score);
    const contradiction = recommendationContradictionState({
      itemFeedback,
      sectionFeedback,
      followThrough,
      sectionDriftItem: driftLookup.get(item.section_key),
    });
    const feedbackSummary = summarizeRecommendationHistory(itemFeedbackHistory, now);
    const trajectory = recommendationTrajectoryWithOperational({
      history: itemFeedbackHistory,
      itemFeedback,
      sectionFeedback,
      contradictionStatus: contradiction.status,
      operationalEvidence,
      summary: feedbackSummary,
    });
    const reusePriority = recommendationReusePriorityWithOperational({
      status,
      trajectory,
      itemFeedback,
      contradictionStatus: contradiction.status,
      summary: feedbackSummary,
      operationalEvidence,
    });

    return {
      item_id: itemId,
      section_key: item.section_key,
      section_label: item.section_label,
      text: text(item?.text),
      status,
      score,
      latest_outcome: itemFeedback?.outcome || null,
      inherited_section_outcome: itemFeedback ? null : (sectionFeedback?.outcome || null),
      latest_note: itemFeedback?.note || null,
      latest_source: itemFeedback?.source || (itemFeedback ? "manual" : (sectionFeedback?.source || null)),
      latest_recommended_next_action: itemFeedback?.recommended_next_action || null,
      latest_confidence_level: itemFeedback?.confidence_level || null,
      freshness_status: freshnessBucket(itemFeedback?.recorded_at || sectionFeedback?.recorded_at, now),
      freshness_days: daysSince(itemFeedback?.recorded_at || sectionFeedback?.recorded_at, now),
      feedback_count: feedbackSummary.feedback_count,
      explicit_feedback_count: feedbackSummary.explicit_feedback_count,
      inferred_feedback_count: feedbackSummary.inferred_feedback_count,
      explicit_helped_count: feedbackSummary.explicit_helped_count,
      inferred_helped_count: feedbackSummary.inferred_helped_count,
      helped_count: feedbackSummary.helped_count,
      mixed_count: feedbackSummary.mixed_count,
      did_not_help_count: feedbackSummary.did_not_help_count,
      needs_follow_up_count: feedbackSummary.needs_follow_up_count,
      recent_helped_count: feedbackSummary.recent_helped_count,
      recent_explicit_helped_count: feedbackSummary.recent_explicit_helped_count,
      recent_caution_count: feedbackSummary.recent_caution_count,
      weighted_helped_score: feedbackSummary.weighted_helped_score,
      weighted_caution_score: feedbackSummary.weighted_caution_score,
      trajectory,
      reuse_priority: reusePriority,
      contradiction_status: contradiction.status,
      contradiction_reason: contradiction.reason,
      operational_positive_count: operationalEvidence.positive_count,
      operational_caution_count: operationalEvidence.caution_count,
      operational_pattern: operationalEvidence.pattern,
      operational_source_labels: operationalEvidence.source_labels,
      operational_reason: operationalEvidence.reason,
      last_operational_at: operationalEvidence.last_event_at,
      source_signal_ids: unique(item?.source_signal_ids),
      reason: recommendationMemoryReason({
        itemFeedback,
        sectionFeedback,
        item,
        trajectory,
        reusePriority,
        summary: feedbackSummary,
      }),
    };
  }).filter((item) => item.text);
}

export function buildHealthPlanSignalPreferenceWeights({
  plan = null,
  feedbackEntries = [],
  sourceSignals = [],
  followThrough = null,
  sectionDrift = [],
  recentOperationalEvents = [],
  now = new Date(),
} = {}) {
  if (!plan) return [];
  const recommendationMemory = buildHealthPlanRecommendationOutcomeMemory({
    plan,
    feedbackEntries,
    followThrough,
    sectionDrift,
    recentOperationalEvents,
    sourceSignals,
    now,
  });
  const signalLookup = new Map(
    (Array.isArray(sourceSignals) ? sourceSignals : [])
      .map((signal) => [text(signal?.id), signal])
      .filter(([id]) => id),
  );
  const signalWeights = new Map();

  for (const item of recommendationMemory) {
    for (const signalId of unique(item?.source_signal_ids)) {
      const current = signalWeights.get(signalId) || { score: 0, items: [] };
      current.score += signalWeightDelta(item.status);
      current.score += trajectoryWeightDelta(item.trajectory, item.reuse_priority);
      current.score += (Number(item?.operational_positive_count || 0) * 0.75);
      current.score -= (Number(item?.operational_caution_count || 0) * 1.1);
      if (item.contradiction_status) current.score -= 1;
      if (item.freshness_status === "stale") current.score *= 0.7;
      current.items.push(item);
      signalWeights.set(signalId, current);
    }
  }

  return [...signalWeights.entries()]
    .map(([signalId, value]) => {
      const signal = signalLookup.get(signalId);
      if (!signal) return null;
      const score = Number(value?.score || 0);
      return {
        signal_id: signalId,
        label: text(signal?.label) || signalId,
        weight: score,
        preference: score >= 2 ? "preserve" : score <= -1 ? "recheck" : "observe",
        reason: unique((Array.isArray(value?.items) ? value.items : []).map((item) => item.reason)).slice(0, 2),
      };
    })
    .filter(Boolean)
    .sort((left, right) => Math.abs(Number(right.weight || 0)) - Math.abs(Number(left.weight || 0)));
}
