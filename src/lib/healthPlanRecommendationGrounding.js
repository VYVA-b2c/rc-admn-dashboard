import { buildHealthPlanRecommendationSourceRanking } from "./healthPlanRecommendationSourceRanking.js";

const SECTION_KEYS = [
  "goals_json",
  "daily_support_json",
  "monitoring_json",
  "escalation_json",
  "caregiver_guidance_json",
];

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

function itemKey(sectionKey, item, index) {
  return text(item?.id) || `${sectionKey}-${index + 1}`;
}

function severityWeight(value) {
  if (value === "high") return 18;
  if (value === "medium") return 9;
  return 4;
}

function statusRank(value) {
  if (value === "strong") return 3;
  if (value === "guarded") return 2;
  return 1;
}

function authorityRank(value) {
  if (value === "highest") return 4;
  if (value === "high") return 3;
  if (value === "medium") return 2;
  return 1;
}

function normalizeConfidence(value) {
  const normalized = lower(value);
  if (normalized === "high" || normalized === "medium" || normalized === "low") return normalized;
  return "medium";
}

function minConfidence(left, right) {
  const order = { low: 1, medium: 2, high: 3 };
  return order[normalizeConfidence(left)] <= order[normalizeConfidence(right)]
    ? normalizeConfidence(left)
    : normalizeConfidence(right);
}

function confidenceExceeds(requested, allowed) {
  const order = { low: 1, medium: 2, high: 3 };
  return order[normalizeConfidence(requested)] > order[normalizeConfidence(allowed)];
}

function hasVerificationLanguage(value) {
  return /\b(verify|verification|confirm|check|re-check|recheck|follow up|follow-up|watch|monitor|review)\b/i.test(text(value));
}

function evidenceTypeList({ mustAddressCount, verificationCount, stabilizingCount }) {
  const types = [];
  if (mustAddressCount > 0) types.push("must_address");
  if (verificationCount > 0) types.push("verification");
  if (stabilizingCount > 0) types.push("stabilizing");
  return types;
}

function issueMessage(type, item, context = {}) {
  const recommendation = text(item?.text) || "This recommendation";
  if (type === "high_pressure_thin_grounding") {
    return `${recommendation} is marked for urgent or high-priority action without enough corroborating evidence behind it.`;
  }
  if (type === "high_confidence_outruns_evidence") {
    return `${recommendation} sounds more certain than the linked evidence supports.`;
  }
  if (type === "confidence_above_calibrated_limit") {
    return `${recommendation} is carrying more confidence than its actual evidence quality and live pressure support.`;
  }
  if (type === "context_only_grounding") {
    return `${recommendation} leans mostly on background context and should be rewritten with stronger live evidence or softer verification language.`;
  }
  if (type === "low_confidence_section_overclaim") {
    return `${recommendation} sits in a section whose confidence is capped, so it should read more cautiously or carry clearer verification wording.`;
  }
  if (type === "verification_expected_missing") {
    return `${recommendation} should stay verification-led before staff treat it as settled guidance.`;
  }
  if (type === "thin_same_day_path") {
    return `${recommendation} points to a same-day response path, but only ${context.topSourceLabel || "thin evidence"} is supporting it right now.`;
  }
  if (type === "conflict_priority_signal_missing") {
    return `${recommendation} does not anchor itself in the lead live signal that should resolve the current evidence conflict.`;
  }
  if (type === "conflict_verification_missing") {
    return `${recommendation} is touching an active evidence conflict without making the needed verification step explicit.`;
  }
  if (type === "conflict_timing_mismatch") {
    return `${recommendation} is tied to a conflict that needs a faster response window than the current wording signals.`;
  }
  return `${recommendation} needs stronger grounding.`;
}

function buildIssue(type, severity, sectionKey, item, context = {}) {
  return {
    type,
    severity,
    section_key: sectionKey,
    item_id: text(item?.id) || null,
    message: issueMessage(type, item, context),
  };
}

function priorityLookup(reviewPriorities = null) {
  return new Map(
    (Array.isArray(reviewPriorities?.items) ? reviewPriorities.items : [])
      .map((item) => {
        const key = text(item?.section_key);
        return key ? [key, item] : null;
      })
      .filter(Boolean),
  );
}

function confidenceLookup(confidenceProfile = null) {
  return new Map(
    (Array.isArray(confidenceProfile?.section_confidence) ? confidenceProfile.section_confidence : [])
      .map((item) => {
        const key = text(item?.section_key);
        return key ? [key, item] : null;
      })
      .filter(Boolean),
  );
}

function evidenceCounts(refs = [], evidencePack = null) {
  const refSet = new Set(unique(refs));
  const hits = (items = []) => (Array.isArray(items) ? items : []).filter((item) =>
    unique(item?.source_signal_ids).some((signalId) => refSet.has(signalId)));
  const mustAddress = hits(evidencePack?.must_address_facts);
  const verification = hits(evidencePack?.verification_needs);
  const stabilizing = hits(evidencePack?.stabilizing_facts);
  return {
    mustAddressCount: mustAddress.length,
    verificationCount: verification.length,
    stabilizingCount: stabilizing.length,
  };
}

function relevantContradictions(sectionKey, refs = [], evidencePack = null) {
  const refSet = new Set(unique(refs));
  return (Array.isArray(evidencePack?.contradictions) ? evidencePack.contradictions : []).filter((item) => {
    if (text(item?.section_key) === sectionKey) return true;
    return unique(item?.source_signal_ids).some((signalId) => refSet.has(signalId));
  });
}

function hasHighPressure(item, reviewPriority) {
  return lower(item?.priority) === "high"
    || lower(item?.timing) === "today"
    || lower(item?.confidence) === "high"
    || lower(reviewPriority?.priority) === "high"
    || lower(reviewPriority?.response_window) === "today";
}

function recommendedConfidence({
  rankingItem,
  confidenceCap,
  contradictions = [],
  highPressure = false,
} = {}) {
  const evidenceQuality = lower(rankingItem?.evidence_quality);
  const topSource = Array.isArray(rankingItem?.ranked_sources) ? rankingItem.ranked_sources[0] || null : null;
  const topAuthority = lower(topSource?.authority_level);
  const sectionCap = lower(confidenceCap?.max_confidence) || "high";
  let recommended = "high";

  if (!topSource || evidenceQuality === "thin" || authorityRank(topAuthority) <= authorityRank("supporting")) {
    recommended = "low";
  } else if (
    evidenceQuality === "mixed"
    || contradictions.length > 0
    || (highPressure && authorityRank(topAuthority) < authorityRank("high"))
  ) {
    recommended = "medium";
  }

  return minConfidence(recommended, sectionCap);
}

function verificationExpected({
  item,
  recommendedConfidence: recommended,
  contradictions = [],
  evidenceQuality = "thin",
  highPressure = false,
} = {}) {
  if (contradictions.length > 0) return true;
  if (normalizeConfidence(recommended) === "low") return true;
  if (highPressure) return true;
  if (lower(evidenceQuality) !== "strong") return true;
  return item?.verification_required === true;
}

function groundingStatus({ item, topSource, rankingItem, evidenceCountsValue, reviewPriority, confidenceCap }) {
  const evidenceQuality = lower(rankingItem?.evidence_quality);
  const topAuthority = lower(topSource?.authority_level);
  const highPressure = hasHighPressure(item, reviewPriority);
  const contextOnly = evidenceQuality === "thin" && authorityRank(topAuthority) <= authorityRank("supporting");
  const sectionLowCap = lower(confidenceCap?.max_confidence) === "low";
  const sectionMediumCap = lower(confidenceCap?.max_confidence) === "medium";
  const factTypes = evidenceTypeList(evidenceCountsValue);

  let status = "strong";
  if (!topSource) {
    status = "fragile";
  } else if (highPressure && evidenceQuality === "thin") {
    status = "fragile";
  } else if (lower(item?.confidence) === "high" && authorityRank(topAuthority) <= authorityRank("supporting")) {
    status = "fragile";
  } else if (contextOnly && factTypes.length === 0) {
    status = "fragile";
  } else if (highPressure && evidenceQuality === "mixed") {
    status = "guarded";
  } else if (evidenceQuality === "thin") {
    status = "guarded";
  } else if (factTypes.length === 0 && authorityRank(topAuthority) <= authorityRank("medium")) {
    status = "guarded";
  }

  if (sectionLowCap && lower(item?.confidence) === "high") {
    status = "fragile";
  } else if (sectionMediumCap && lower(item?.confidence) === "high" && status === "strong") {
    status = "guarded";
  }

  return status;
}

export function buildHealthPlanRecommendationGrounding({
  plan = null,
  sourceSignals = [],
  evidencePack = null,
  reviewPriorities = null,
  confidenceProfile = null,
  recommendationSourceRanking = null,
} = {}) {
  const normalizedPlan = objectValue(plan);
  if (!normalizedPlan) return null;

  const ranking = recommendationSourceRanking || buildHealthPlanRecommendationSourceRanking({
    plan: normalizedPlan,
    sourceSignals,
  });
  const rankingLookup = new Map(
    (Array.isArray(ranking?.items) ? ranking.items : [])
      .map((item) => {
        const sectionKey = text(item?.section_key);
        const itemId = text(item?.item_id);
        return sectionKey && itemId ? [`${sectionKey}:${itemId}`, item] : null;
      })
      .filter(Boolean),
  );
  const reviewPriorityBySection = priorityLookup(reviewPriorities);
  const confidenceBySection = confidenceLookup(confidenceProfile);

  const items = [];
  const issues = [];

  for (const sectionKey of SECTION_KEYS) {
    const sectionItems = Array.isArray(normalizedPlan?.[sectionKey]) ? normalizedPlan[sectionKey] : [];
    const reviewPriority = reviewPriorityBySection.get(sectionKey) || null;
    const confidenceCap = confidenceBySection.get(sectionKey) || null;

    sectionItems.forEach((item, index) => {
      const currentItemId = itemKey(sectionKey, item, index);
      const rankingItem = rankingLookup.get(`${sectionKey}:${currentItemId}`) || null;
      const topSource = Array.isArray(rankingItem?.ranked_sources) ? rankingItem.ranked_sources[0] || null : null;
      const refs = unique(item?.source_signal_ids);
      const counts = evidenceCounts(refs, evidencePack);
      const factTypes = evidenceTypeList(counts);
      const contradictions = relevantContradictions(sectionKey, refs, evidencePack);
      const status = groundingStatus({
        item,
        topSource,
        rankingItem,
        evidenceCountsValue: counts,
        reviewPriority,
        confidenceCap,
      });
      const highPressure = hasHighPressure(item, reviewPriority);
      const evidenceQuality = lower(rankingItem?.evidence_quality) || (refs.length >= 2 ? "mixed" : "thin");
      const topAuthority = lower(topSource?.authority_level);
      const topSourceLabel = text(topSource?.label) || null;
      const preferredConflictSignalIds = unique(contradictions.flatMap((entry) => entry?.preferred_signal_ids || []));
      const missingPreferredConflictSignal = preferredConflictSignalIds.length > 0
        && !preferredConflictSignalIds.some((signalId) => refs.includes(signalId));
      const needsConflictVerification = contradictions.some((entry) => entry?.requires_verification !== false);
      const missingConflictVerification = needsConflictVerification && item?.verification_required !== true;
      const conflictNeedsToday = contradictions.some((entry) => text(entry?.response_window) === "today");
      const conflictTimingMismatch = conflictNeedsToday && lower(item?.timing) !== "today";
      const recommendedItemConfidence = recommendedConfidence({
        rankingItem,
        confidenceCap,
        contradictions,
        highPressure,
      });
      const requiresVerification = verificationExpected({
        item,
        recommendedConfidence: recommendedItemConfidence,
        contradictions,
        evidenceQuality,
        highPressure,
      });

      if (highPressure && evidenceQuality === "thin") {
        issues.push(buildIssue("high_pressure_thin_grounding", "high", sectionKey, item));
      }
      if (highPressure && evidenceQuality === "thin" && topSourceLabel) {
        issues.push(buildIssue("thin_same_day_path", "medium", sectionKey, item, { topSourceLabel }));
      }
      if (
        lower(item?.confidence) === "high"
        && authorityRank(topAuthority) <= authorityRank("supporting")
      ) {
        issues.push(buildIssue("high_confidence_outruns_evidence", "high", sectionKey, item));
      }
      if (confidenceExceeds(item?.confidence || recommendedItemConfidence, recommendedItemConfidence)) {
        issues.push(buildIssue(
          "confidence_above_calibrated_limit",
          highPressure || lower(item?.confidence) === "high" ? "high" : "medium",
          sectionKey,
          item,
        ));
      }
      if (evidenceQuality === "thin" && authorityRank(topAuthority) <= authorityRank("supporting") && factTypes.length === 0) {
        issues.push(buildIssue("context_only_grounding", highPressure ? "high" : "medium", sectionKey, item));
      }
      if (lower(confidenceCap?.max_confidence) === "low" && lower(item?.confidence) === "high") {
        issues.push(buildIssue("low_confidence_section_overclaim", "medium", sectionKey, item));
      }
      if (contradictions.length === 0 && requiresVerification && item?.verification_required !== true) {
        issues.push(buildIssue(
          "verification_expected_missing",
          highPressure ? "high" : "medium",
          sectionKey,
          item,
        ));
      }
      if (missingPreferredConflictSignal) {
        issues.push(buildIssue(
          "conflict_priority_signal_missing",
          contradictions.some((entry) => lower(entry?.severity) === "high") ? "high" : "medium",
          sectionKey,
          item,
        ));
      }
      if (missingConflictVerification) {
        issues.push(buildIssue(
          "conflict_verification_missing",
          contradictions.some((entry) => lower(entry?.severity) === "high") ? "high" : "medium",
          sectionKey,
          item,
        ));
      }
      if (conflictTimingMismatch) {
        issues.push(buildIssue("conflict_timing_mismatch", "medium", sectionKey, item));
      }

      items.push({
        item_id: currentItemId,
        section_key: sectionKey,
        text: text(item?.text) || null,
        grounding_status: status,
        evidence_quality: evidenceQuality || null,
        top_source_label: topSourceLabel,
        top_source_authority: topAuthority || null,
        source_count: refs.length,
        corroborating_source_count: Array.isArray(rankingItem?.ranked_sources)
          ? rankingItem.ranked_sources.filter((source) => authorityRank(lower(source?.authority_level)) >= authorityRank("medium")).length
          : refs.length,
        fact_types: factTypes,
        high_pressure: highPressure,
        recommended_confidence: recommendedItemConfidence,
        verification_expected: requiresVerification,
        conflict_count: contradictions.length,
        conflict_status: contradictions.length
          ? (contradictions.some((entry) => lower(entry?.severity) === "high") ? "active_high" : "active_medium")
          : "clear",
        priority: lower(item?.priority) || null,
        confidence: lower(item?.confidence) || null,
        timing: lower(item?.timing) || null,
        staff_note:
          contradictions.length > 0
            ? missingConflictVerification || missingPreferredConflictSignal
              ? "This recommendation still needs a clearer conflict-resolution path before staff should trust it."
              : "This recommendation is responding to a known evidence conflict and should stay verification-led."
            : status === "strong"
            ? topSourceLabel
              ? `${topSourceLabel} is giving this recommendation a reliable footing.`
              : "This recommendation is grounded well enough for normal staff use."
            : status === "guarded"
              ? "This recommendation is usable, but staff should verify the live picture before leaning on it heavily."
              : "This recommendation needs stronger evidence or softer wording before staff should rely on it.",
      });
    });
  }

  const strongCount = items.filter((item) => item.grounding_status === "strong").length;
  const guardedCount = items.filter((item) => item.grounding_status === "guarded").length;
  const fragileCount = items.filter((item) => item.grounding_status === "fragile").length;
  const score = Math.max(0, 100 - issues.reduce((total, issue) => total + severityWeight(lower(issue?.severity)), 0));
  const overallStatus =
    fragileCount > 0 || issues.some((issue) => lower(issue?.severity) === "high") || score < 70
      ? "fragile"
      : guardedCount > 0 || issues.some((issue) => lower(issue?.severity) === "medium") || score < 88
        ? "guarded"
        : "strong";

  const strongestItems = [...items]
    .sort((left, right) => statusRank(right.grounding_status) - statusRank(left.grounding_status))
    .slice(0, 3)
    .map((item) => item.item_id);
  const weakestItems = [...items]
    .sort((left, right) => statusRank(left.grounding_status) - statusRank(right.grounding_status))
    .slice(0, 3)
    .map((item) => item.item_id);

  const summary =
    overallStatus === "strong"
      ? "The current recommendations are staying closely tied to concrete evidence instead of drifting into generic advice."
      : overallStatus === "guarded"
        ? "Most recommendations are evidence-linked, but a few still need tighter corroboration or softer wording."
        : "At least one recommendation is still outrunning the evidence and should be rewritten before staff rely on it.";

  return {
    overall_status: overallStatus,
    score,
    summary,
    item_count: items.length,
    strong_count: strongCount,
    guarded_count: guardedCount,
    fragile_count: fragileCount,
    strongest_item_ids: strongestItems,
    weakest_item_ids: weakestItems,
    issues: issues.slice(0, 8),
    items,
  };
}

export function applyHealthPlanRecommendationGroundingCalibration({
  plan = null,
  grounding = null,
} = {}) {
  const normalizedPlan = objectValue(plan);
  const summary = objectValue(grounding);
  if (!normalizedPlan || !summary) {
    return {
      plan,
      adjustments: [],
    };
  }

  const groundingLookup = new Map(
    (Array.isArray(summary.items) ? summary.items : [])
      .map((item) => {
        const sectionKey = text(item?.section_key);
        const itemId = text(item?.item_id);
        return sectionKey && itemId ? [`${sectionKey}:${itemId}`, item] : null;
      })
      .filter(Boolean),
  );

  const calibratedPlan = { ...normalizedPlan };
  const adjustments = [];

  for (const sectionKey of SECTION_KEYS) {
    const sectionItems = Array.isArray(normalizedPlan?.[sectionKey]) ? normalizedPlan[sectionKey] : [];
    calibratedPlan[sectionKey] = sectionItems.map((item, index) => {
      const currentItemId = itemKey(sectionKey, item, index);
      const groundingItem = groundingLookup.get(`${sectionKey}:${currentItemId}`) || null;
      if (!groundingItem) return item;

      const nextConfidence = normalizeConfidence(groundingItem.recommended_confidence || item?.confidence);
      const requestedConfidence = normalizeConfidence(item?.confidence || groundingItem.recommended_confidence);
      const shouldVerify = groundingItem.verification_expected === true;
      const nextVerification = shouldVerify ? true : item?.verification_required === true;
      const confidenceChanged = normalizeConfidence(item?.confidence) !== nextConfidence;
      const verificationChanged = Boolean(item?.verification_required) !== Boolean(nextVerification);

      if (!confidenceChanged && !verificationChanged) return item;

      adjustments.push({
        section_key: sectionKey,
        item_id: currentItemId,
        text: text(item?.text) || null,
        requested_confidence: requestedConfidence,
        applied_confidence: nextConfidence,
        confidence_changed: confidenceChanged,
        verification_required: nextVerification,
        verification_added: item?.verification_required !== true && nextVerification === true,
        high_pressure: groundingItem?.high_pressure === true,
        grounding_status: text(groundingItem?.grounding_status) || null,
        evidence_quality: text(groundingItem?.evidence_quality) || null,
        top_source_label: text(groundingItem?.top_source_label) || null,
        conflict_count: Number(groundingItem?.conflict_count || 0),
        reason: text(groundingItem?.staff_note) || "Recommendation confidence was calibrated to match the actual evidence quality and pressure.",
      });

      return {
        ...item,
        confidence: nextConfidence,
        verification_required: nextVerification,
      };
    });
  }

  return {
    plan: {
      ...normalizedPlan,
      ...calibratedPlan,
    },
    adjustments,
  };
}

export function buildHealthPlanRecommendationCalibrationSummary({
  adjustments = [],
  grounding = null,
} = {}) {
  const items = Array.isArray(adjustments)
    ? adjustments
      .map((item) => ({
        section_key: text(item?.section_key) || null,
        item_id: text(item?.item_id) || null,
        text: text(item?.text) || null,
        requested_confidence: normalizeConfidence(item?.requested_confidence),
        applied_confidence: normalizeConfidence(item?.applied_confidence),
        confidence_changed: item?.confidence_changed === true,
        verification_required: item?.verification_required === true,
        verification_added: item?.verification_added === true,
        high_pressure: item?.high_pressure === true,
        grounding_status: text(item?.grounding_status) || null,
        evidence_quality: text(item?.evidence_quality) || null,
        top_source_label: text(item?.top_source_label) || null,
        conflict_count: Number(item?.conflict_count || 0),
        reason: text(item?.reason) || null,
      }))
      .filter((item) => item.section_key && item.item_id)
    : [];
  const normalizedGrounding = objectValue(grounding);
  const fragileCount = Number(normalizedGrounding?.fragile_count || 0);
  const guardedCount = Number(normalizedGrounding?.guarded_count || 0);
  const confidenceDowngradeCount = items.filter((item) => item.confidence_changed).length;
  const verificationAddedCount = items.filter((item) => item.verification_added).length;
  const highPressureCount = items.filter((item) => item.high_pressure).length;
  const overallStatus = items.length > 0 ? "adjusted" : "clean";
  const summary = items.length > 0
    ? `${items.length} recommendation${items.length === 1 ? "" : "s"} were auto-calibrated to better match the available evidence and live pressure.`
    : "No recommendation-level confidence calibration was needed before acceptance.";

  return {
    overall_status: overallStatus,
    summary,
    adjustment_count: items.length,
    confidence_downgrade_count: confidenceDowngradeCount,
    verification_added_count: verificationAddedCount,
    high_pressure_adjustment_count: highPressureCount,
    remaining_fragile_count: fragileCount,
    remaining_guarded_count: guardedCount,
    items: items.slice(0, 10),
  };
}

export function shouldRejectHealthPlanRecommendationGrounding(summary) {
  const normalized = objectValue(summary);
  if (!normalized) return false;
  const issues = Array.isArray(normalized.issues) ? normalized.issues : [];
  const mediumCount = issues.filter((issue) => lower(issue?.severity) === "medium").length;
  return issues.some((issue) => lower(issue?.severity) === "high") || mediumCount >= 2;
}
