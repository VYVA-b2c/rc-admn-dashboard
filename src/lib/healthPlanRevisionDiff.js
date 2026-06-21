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

function normalizeList(items) {
  return (Array.isArray(items) ? items : [])
    .map((item) => {
      const itemText = text(item?.text);
      if (!itemText) return null;
      return {
        id: text(item?.id) || null,
        section_key: text(item?.section_key) || null,
        text: itemText,
        priority: text(item?.priority).toLowerCase() || null,
        confidence: text(item?.confidence).toLowerCase() || null,
        timing: text(item?.timing).toLowerCase() || null,
        origin_type: text(item?.origin_type).toLowerCase() || null,
        original_generated_text: text(item?.original_generated_text) || null,
        edit_reason: text(item?.edit_reason) || null,
        source_signal_ids: Array.isArray(item?.source_signal_ids)
          ? item.source_signal_ids.map((value) => text(value)).filter(Boolean)
          : [],
      };
    })
    .filter(Boolean);
}

function listTexts(items) {
  return normalizeList(items).map((item) => item.text.toLowerCase());
}

function countHighPriority(items) {
  return normalizeList(items).filter((item) => item.priority === "high").length;
}

function diffSection(currentItems, previousItems) {
  const currentTexts = listTexts(currentItems);
  const previousTexts = listTexts(previousItems);
  const currentSet = new Set(currentTexts);
  const previousSet = new Set(previousTexts);
  const added = currentTexts.filter((item) => !previousSet.has(item)).length;
  const removed = previousTexts.filter((item) => !currentSet.has(item)).length;
  const unchanged = currentTexts.filter((item) => previousSet.has(item)).length;
  const rewritten = Math.max(
    0,
    Math.min(currentTexts.length, previousTexts.length) - unchanged,
  );

  return {
    changed: added > 0 || removed > 0 || rewritten > 0 || currentTexts.length !== previousTexts.length,
    added,
    removed,
    rewritten,
  };
}

function normalizeVersionNumber(value) {
  const version = Number(value || 0);
  return Number.isFinite(version) && version > 0 ? version : 1;
}

function normalizeTimestamp(value) {
  const raw = text(value);
  if (!raw) return "";
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? raw : date.toISOString();
}

function itemKey(sectionKey, item) {
  const itemId = text(item?.id);
  if (itemId) return `${sectionKey}:${itemId}`;
  return `${sectionKey}:${text(item?.text).toLowerCase()}`;
}

function itemTextKey(sectionKey, item) {
  return `${sectionKey}:${text(item?.text).toLowerCase()}`;
}

function urgencyScore(item) {
  const priority = text(item?.priority);
  const timing = text(item?.timing);
  const priorityScore = priority === "high" ? 3 : priority === "medium" ? 2 : priority === "low" ? 1 : 0;
  const timingScore = timing === "today" ? 3 : timing === "this_week" ? 2 : timing === "ongoing" ? 1 : 0;
  return (priorityScore * 10) + timingScore;
}

function normalizeRecommendationLearning(items) {
  return (Array.isArray(items) ? items : [])
    .map((item) => {
      const sectionKey = text(item?.section_key);
      const itemText = text(item?.text);
      if (!sectionKey || !itemText) return null;
      return {
        item_id: text(item?.item_id) || null,
        section_key: sectionKey,
        text: itemText,
        reuse_priority: text(item?.reuse_priority) || null,
        trajectory: text(item?.trajectory) || null,
        reason: text(item?.reason) || null,
        feedback_count: Number.isFinite(Number(item?.feedback_count)) ? Number(item.feedback_count) : 0,
      };
    })
    .filter(Boolean);
}

function normalizeRecommendationSourceRanking(summary) {
  return (Array.isArray(summary?.items) ? summary.items : [])
    .map((item) => {
      const sectionKey = text(item?.section_key);
      const itemText = text(item?.text);
      if (!sectionKey || !itemText) return null;
      const rankedSources = Array.isArray(item?.ranked_sources)
        ? item.ranked_sources
          .map((source) => ({
            label: text(source?.label) || null,
          }))
          .filter((source) => source.label)
        : [];
      return {
        item_id: text(item?.item_id) || null,
        section_key: sectionKey,
        text: itemText,
        evidence_quality: text(item?.evidence_quality) || null,
        top_summary: text(item?.top_summary) || null,
        ranked_sources: rankedSources,
      };
    })
    .filter(Boolean);
}

function normalizeRecommendationEffectiveness(summary) {
  const groups = [
    { key: "preserve_now", action: "preserve" },
    { key: "rework_now", action: "rework" },
    { key: "retire_now", action: "retire" },
  ];
  return groups.flatMap((group) =>
    (Array.isArray(summary?.[group.key]) ? summary[group.key] : [])
      .map((item) => {
        const sectionKey = text(item?.section_key);
        const itemText = text(item?.text);
        if (!sectionKey || !itemText) return null;
        return {
          item_id: text(item?.item_id) || null,
          section_key: sectionKey,
          text: itemText,
          action: group.action,
          action_reason: text(item?.action_reason || item?.reason) || null,
        };
      })
      .filter(Boolean),
  );
}

function recommendationKey(item) {
  if (text(item?.item_id)) return `${text(item.section_key)}:${text(item.item_id)}`;
  return `${text(item.section_key)}:${text(item.text).toLowerCase()}`;
}

function recommendationTextKey(item) {
  return `${text(item?.section_key)}:${text(item?.text).toLowerCase()}`;
}

function lookupMap(items = []) {
  const map = new Map();
  for (const item of items) {
    const key = recommendationKey(item);
    if (key) map.set(key, item);
    const textKey = recommendationTextKey(item);
    if (textKey && !map.has(textKey)) map.set(textKey, item);
  }
  return map;
}

function evidenceQualityRank(value) {
  const normalized = text(value).toLowerCase();
  if (normalized === "strong") return 3;
  if (normalized === "mixed") return 2;
  if (normalized === "thin") return 1;
  return 0;
}

function evidenceQualityLabel(value) {
  const normalized = text(value).toLowerCase();
  if (normalized === "strong") return "strong";
  if (normalized === "mixed") return "mixed";
  if (normalized === "thin") return "thin";
  return "";
}

function topSourceLabel(rankingItem) {
  return text(rankingItem?.ranked_sources?.[0]?.label) || null;
}

function buildEvidenceShift(previousRanking, currentRanking) {
  const previousTop = topSourceLabel(previousRanking);
  const currentTop = topSourceLabel(currentRanking);
  const previousQuality = evidenceQualityLabel(previousRanking?.evidence_quality);
  const currentQuality = evidenceQualityLabel(currentRanking?.evidence_quality);
  const notes = [];

  if (previousTop && currentTop && previousTop !== currentTop) {
    notes.push(`Top evidence moved from ${previousTop} to ${currentTop}.`);
  } else if (!previousTop && currentTop) {
    notes.push(`${currentTop} is now the clearest evidence behind this recommendation.`);
  } else if (previousTop && !currentTop) {
    notes.push(`The earlier version leaned most on ${previousTop}.`);
  } else if (currentRanking?.top_summary) {
    notes.push(currentRanking.top_summary);
  } else if (previousRanking?.top_summary) {
    notes.push(previousRanking.top_summary);
  }

  if (previousQuality && currentQuality && previousQuality !== currentQuality) {
    const direction = evidenceQualityRank(currentQuality) > evidenceQualityRank(previousQuality)
      ? "improved"
      : "softened";
    notes.push(`Evidence quality ${direction} from ${previousQuality} to ${currentQuality}.`);
  } else if (!previousQuality && currentQuality) {
    notes.push(`Evidence quality is currently ${currentQuality}.`);
  } else if (previousQuality && !currentQuality) {
    notes.push(`Earlier evidence quality was ${previousQuality}.`);
  }

  return notes.join(" ").trim() || null;
}

function buildLearningShift(action, currentLearning, previousLearning, currentEffectiveness, previousEffectiveness) {
  const currentReason = text(currentLearning?.reason || currentEffectiveness?.action_reason);
  const previousReason = text(previousLearning?.reason || previousEffectiveness?.action_reason);
  if (action === "replaced") return previousReason || null;
  if (currentReason) return currentReason;
  if (action === "preserved" || action === "tightened") return previousReason || null;
  return null;
}

function hasMeaningfulEvidenceShift(value) {
  return Boolean(text(value));
}

function hasMeaningfulLearningShift(value) {
  return Boolean(text(value));
}

function recommendationJustificationStatus(item) {
  if (text(item?.manual_override_reason)) return "manual_override";
  if (hasMeaningfulEvidenceShift(item?.evidence_shift) || text(item?.current_top_source)) return "evidence_backed";
  if (hasMeaningfulLearningShift(item?.learning_shift)) return "learning_backed";
  return "thin";
}

function sectionItemsForRevision(revision) {
  return SECTION_KEYS.flatMap((sectionKey) =>
    normalizeList(revision?.[sectionKey]).map((item) => ({
      ...item,
      section_key: sectionKey,
      key: itemKey(sectionKey, item),
    })),
  );
}

function buildRecommendationChangeSummary(currentRevision, previousRevision = null) {
  const currentItems = sectionItemsForRevision(currentRevision);
  const previousItems = previousRevision ? sectionItemsForRevision(previousRevision) : [];
  const currentByKey = new Map(currentItems.map((item) => [item.key, item]));
  const previousByKey = new Map(previousItems.map((item) => [item.key, item]));
  const currentByTextKey = new Map(currentItems.map((item) => [itemTextKey(item.section_key, item), item]));
  const previousByTextKey = new Map(previousItems.map((item) => [itemTextKey(item.section_key, item), item]));
  const currentLearningLookup = lookupMap(normalizeRecommendationLearning(currentRevision?.recommendation_learning_json));
  const previousLearning = normalizeRecommendationLearning(previousRevision?.recommendation_learning_json);
  const previousLearningLookup = lookupMap(previousLearning);
  const currentRankingLookup = lookupMap(
    normalizeRecommendationSourceRanking(currentRevision?.quality_snapshot_json?.recommendation_source_ranking),
  );
  const previousRankingLookup = lookupMap(
    normalizeRecommendationSourceRanking(previousRevision?.quality_snapshot_json?.recommendation_source_ranking),
  );
  const currentEffectivenessLookup = lookupMap(
    normalizeRecommendationEffectiveness(currentRevision?.quality_snapshot_json?.recommendation_effectiveness),
  );
  const previousEffectivenessLookup = lookupMap(
    normalizeRecommendationEffectiveness(previousRevision?.quality_snapshot_json?.recommendation_effectiveness),
  );

  const added = [];
  const preserved = [];
  const tightened = [];
  const replaced = [];

  for (const currentItem of currentItems) {
    const previousItem = previousByKey.get(currentItem.key) || previousByTextKey.get(itemTextKey(currentItem.section_key, currentItem));
    const currentLookupKey = recommendationKey({ section_key: currentItem.section_key, item_id: currentItem.id, text: currentItem.text });
    const currentLookupTextKey = recommendationTextKey({ section_key: currentItem.section_key, text: currentItem.text });
    const currentLearning = currentLearningLookup.get(currentLookupKey) || currentLearningLookup.get(currentLookupTextKey) || null;
    const currentRanking = currentRankingLookup.get(currentLookupKey) || currentRankingLookup.get(currentLookupTextKey) || null;
    const currentEffectiveness = currentEffectivenessLookup.get(currentLookupKey) || currentEffectivenessLookup.get(currentLookupTextKey) || null;
    if (!previousItem) {
      added.push({
        action: "added",
        section_key: currentItem.section_key,
        text: currentItem.text,
        priority: currentItem.priority || null,
        timing: currentItem.timing || null,
        reason: "This recommendation entered the plan in this version.",
        editorial_origin: currentItem.origin_type || null,
        manual_override_reason: currentItem.edit_reason || null,
        evidence_shift: buildEvidenceShift(null, currentRanking),
        learning_shift: buildLearningShift("added", currentLearning, null, currentEffectiveness, null),
        previous_top_source: null,
        current_top_source: topSourceLabel(currentRanking),
        justification_status: recommendationJustificationStatus({
          manual_override_reason: currentItem.edit_reason || null,
          evidence_shift: buildEvidenceShift(null, currentRanking),
          learning_shift: buildLearningShift("added", currentLearning, null, currentEffectiveness, null),
          current_top_source: topSourceLabel(currentRanking),
        }),
      });
      continue;
    }
    const currentUrgency = urgencyScore(currentItem);
    const previousUrgency = urgencyScore(previousItem);
    const previousLookupKey = recommendationKey({ section_key: previousItem.section_key, item_id: previousItem.id, text: previousItem.text });
    const previousLookupTextKey = recommendationTextKey({ section_key: previousItem.section_key, text: previousItem.text });
    const previousLearningItem = previousLearningLookup.get(previousLookupKey) || previousLearningLookup.get(previousLookupTextKey) || null;
    const previousRanking = previousRankingLookup.get(previousLookupKey) || previousRankingLookup.get(previousLookupTextKey) || null;
    const previousEffectiveness = previousEffectivenessLookup.get(previousLookupKey) || previousEffectivenessLookup.get(previousLookupTextKey) || null;
    if (currentUrgency > previousUrgency) {
      tightened.push({
        action: "tightened",
        section_key: currentItem.section_key,
        text: currentItem.text,
        priority: currentItem.priority || previousItem?.priority || null,
        timing: currentItem.timing || previousItem?.timing || null,
        reason: "This recommendation stayed in place but now carries stronger urgency or timing.",
        editorial_origin: currentItem.origin_type || null,
        manual_override_reason: currentItem.edit_reason || previousItem?.edit_reason || null,
        evidence_shift: buildEvidenceShift(previousRanking, currentRanking),
        learning_shift: buildLearningShift("tightened", currentLearning, previousLearningItem, currentEffectiveness, previousEffectiveness),
        previous_top_source: topSourceLabel(previousRanking),
        current_top_source: topSourceLabel(currentRanking),
        justification_status: recommendationJustificationStatus({
          manual_override_reason: currentItem.edit_reason || previousItem?.edit_reason || null,
          evidence_shift: buildEvidenceShift(previousRanking, currentRanking),
          learning_shift: buildLearningShift("tightened", currentLearning, previousLearningItem, currentEffectiveness, previousEffectiveness),
          current_top_source: topSourceLabel(currentRanking),
        }),
      });
    } else {
      preserved.push({
        action: "preserved",
        section_key: currentItem.section_key,
        text: currentItem.text,
        priority: currentItem.priority || previousItem?.priority || null,
        timing: currentItem.timing || previousItem?.timing || null,
        reason: "This recommendation carried forward into the next version.",
        editorial_origin: currentItem.origin_type || null,
        manual_override_reason: currentItem.edit_reason || previousItem?.edit_reason || null,
        evidence_shift: buildEvidenceShift(previousRanking, currentRanking),
        learning_shift: buildLearningShift("preserved", currentLearning, previousLearningItem, currentEffectiveness, previousEffectiveness),
        previous_top_source: topSourceLabel(previousRanking),
        current_top_source: topSourceLabel(currentRanking),
        justification_status: recommendationJustificationStatus({
          manual_override_reason: currentItem.edit_reason || previousItem?.edit_reason || null,
          evidence_shift: buildEvidenceShift(previousRanking, currentRanking),
          learning_shift: buildLearningShift("preserved", currentLearning, previousLearningItem, currentEffectiveness, previousEffectiveness),
          current_top_source: topSourceLabel(currentRanking),
        }),
      });
    }
  }

  for (const learningItem of previousLearning) {
    if (learningItem.reuse_priority !== "replace") continue;
    const key = recommendationKey(learningItem);
    if (currentByKey.has(key) || currentByTextKey.has(`${text(learningItem.section_key)}:${text(learningItem.text).toLowerCase()}`)) continue;
    const learningTextKey = recommendationTextKey(learningItem);
    const previousRanking = previousRankingLookup.get(key) || previousRankingLookup.get(learningTextKey) || null;
    const previousEffectiveness = previousEffectivenessLookup.get(key) || previousEffectivenessLookup.get(learningTextKey) || null;
    replaced.push({
      action: "replaced",
      section_key: learningItem.section_key,
      text: learningItem.text,
      priority: null,
      timing: null,
      reason: learningItem.reason || "Prior evidence marked this recommendation for replacement, and it was retired in the next version.",
      editorial_origin: null,
      manual_override_reason: null,
      evidence_shift: buildEvidenceShift(previousRanking, null),
      learning_shift: buildLearningShift("replaced", null, learningItem, null, previousEffectiveness),
      previous_top_source: topSourceLabel(previousRanking),
      current_top_source: null,
      justification_status: recommendationJustificationStatus({
        manual_override_reason: null,
        evidence_shift: buildEvidenceShift(previousRanking, null),
        learning_shift: buildLearningShift("replaced", null, learningItem, null, previousEffectiveness),
        current_top_source: null,
      }),
    });
  }

  const items = [...tightened, ...replaced, ...added, ...preserved];
  const highlights = items.slice(0, 5);
  const evidenceBackedCount = items.filter((item) => item.justification_status === "evidence_backed").length;
  const learningBackedCount = items.filter((item) => item.justification_status === "learning_backed").length;
  const manualOverrideCount = items.filter((item) => item.justification_status === "manual_override").length;
  const thinJustificationCount = items.filter((item) => item.justification_status === "thin").length;

  return {
    added_count: added.length,
    preserved_count: preserved.length,
    tightened_count: tightened.length,
    replaced_count: replaced.length,
    evidence_backed_count: evidenceBackedCount,
    learning_backed_count: learningBackedCount,
    manual_override_count: manualOverrideCount,
    thin_justification_count: thinJustificationCount,
    items,
    highlights,
  };
}

export function buildHealthPlanRevisionChange(currentRevision, previousRevision = null) {
  if (!currentRevision) return null;
  if (!previousRevision) {
    const baselineRecommendations = sectionItemsForRevision(currentRevision);
    return {
      previous_version_number: null,
      changed_sections: ["summary"],
      added_items: normalizeList(currentRevision.goals_json).length
        + normalizeList(currentRevision.daily_support_json).length
        + normalizeList(currentRevision.monitoring_json).length
        + normalizeList(currentRevision.escalation_json).length
        + normalizeList(currentRevision.caregiver_guidance_json).length,
      removed_items: 0,
      rewritten_items: 0,
      high_priority_delta: countHighPriority(currentRevision.goals_json)
        + countHighPriority(currentRevision.daily_support_json)
        + countHighPriority(currentRevision.monitoring_json)
        + countHighPriority(currentRevision.escalation_json)
        + countHighPriority(currentRevision.caregiver_guidance_json),
      summary_changed: true,
      review_status_changed: false,
      materially_changed: true,
        recommendation_changes: {
          added_count: baselineRecommendations.length,
          preserved_count: 0,
          tightened_count: 0,
          replaced_count: 0,
          evidence_backed_count: 0,
          learning_backed_count: 0,
          manual_override_count: baselineRecommendations.filter((item) => item.edit_reason).length,
          thin_justification_count: baselineRecommendations.filter((item) => !item.edit_reason).length,
          highlights: baselineRecommendations.slice(0, 3).map((item) => ({
            action: "added",
            section_key: item.section_key,
            text: item.text,
            priority: item.priority || null,
            timing: item.timing || null,
            reason: "This recommendation entered the first saved version of the plan.",
            editorial_origin: item.origin_type || null,
            manual_override_reason: item.edit_reason || null,
            evidence_shift: null,
            learning_shift: null,
            previous_top_source: null,
            current_top_source: null,
            justification_status: item.edit_reason ? "manual_override" : "thin",
          })),
        },
      };
  }

  const changedSections = [];
  let addedItems = 0;
  let removedItems = 0;
  let rewrittenItems = 0;

  const summaryChanged = text(currentRevision.summary_text) !== text(previousRevision.summary_text);
  if (summaryChanged) changedSections.push("summary");

  for (const sectionKey of SECTION_KEYS) {
    const diff = diffSection(currentRevision?.[sectionKey], previousRevision?.[sectionKey]);
    if (diff.changed) changedSections.push(sectionKey);
    addedItems += diff.added;
    removedItems += diff.removed;
    rewrittenItems += diff.rewritten;
  }

  const currentHighPriority = SECTION_KEYS.reduce((total, sectionKey) => total + countHighPriority(currentRevision?.[sectionKey]), 0);
  const previousHighPriority = SECTION_KEYS.reduce((total, sectionKey) => total + countHighPriority(previousRevision?.[sectionKey]), 0);
  const reviewStatusChanged = text(currentRevision.review_status) !== text(previousRevision.review_status);

  return {
    previous_version_number: normalizeVersionNumber(previousRevision.version_number),
    changed_sections: changedSections,
    added_items: addedItems,
    removed_items: removedItems,
    rewritten_items: rewrittenItems,
    high_priority_delta: currentHighPriority - previousHighPriority,
    summary_changed: summaryChanged,
    review_status_changed: reviewStatusChanged,
    materially_changed: Boolean(changedSections.length || addedItems || removedItems || rewrittenItems || reviewStatusChanged),
    recommendation_changes: buildRecommendationChangeSummary(currentRevision, previousRevision),
  };
}

export function annotateHealthPlanHistory(revisions = []) {
  const sorted = [...(Array.isArray(revisions) ? revisions : [])].sort((left, right) => {
    const versionDelta = normalizeVersionNumber(right?.version_number) - normalizeVersionNumber(left?.version_number);
    if (versionDelta !== 0) return versionDelta;
    return normalizeTimestamp(right?.created_at).localeCompare(normalizeTimestamp(left?.created_at));
  });

  return sorted.map((revision, index) => ({
    ...revision,
    change: buildHealthPlanRevisionChange(revision, sorted[index + 1] || null),
  }));
}
