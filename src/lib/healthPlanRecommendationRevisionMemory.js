import { buildHealthPlanRevisionChange } from "./healthPlanRevisionDiff.js";

const SECTION_LABELS = {
  goals_json: "Goals",
  daily_support_json: "Daily support",
  monitoring_json: "Monitoring",
  escalation_json: "Escalation",
  caregiver_guidance_json: "Caregiver guidance",
};

const SECTION_KEYS = Object.keys(SECTION_LABELS);

function text(value) {
  return String(value || "").trim();
}

function lower(value) {
  return text(value).toLowerCase();
}

function normalizeVersion(value) {
  const version = Number(value || 0);
  return Number.isFinite(version) && version > 0 ? version : 1;
}

function objectValue(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function recommendationKey(sectionKey, itemText) {
  const normalizedSectionKey = text(sectionKey);
  const normalizedText = lower(itemText);
  if (!normalizedSectionKey || !normalizedText) return null;
  return `${normalizedSectionKey}:${normalizedText}`;
}

function normalizeHistory(history = []) {
  return [...(Array.isArray(history) ? history : [])]
    .filter(Boolean)
    .sort((left, right) => normalizeVersion(right?.version_number) - normalizeVersion(left?.version_number));
}

function sectionItems(revision) {
  return SECTION_KEYS.flatMap((sectionKey) =>
    (Array.isArray(revision?.[sectionKey]) ? revision[sectionKey] : [])
      .map((item) => ({
        key: recommendationKey(sectionKey, item?.text),
        section_key: sectionKey,
        section_label: SECTION_LABELS[sectionKey] || sectionKey,
        text: text(item?.text),
      }))
      .filter((item) => item.key && item.text),
  );
}

function normalizeSurvivorship(summary) {
  const survivorship = objectValue(summary);
  const groups = ["durable", "emerging", "fragile", "retired"];
  const map = new Map();
  for (const status of groups) {
    for (const item of Array.isArray(survivorship?.[status]) ? survivorship[status] : []) {
      const key = recommendationKey(item?.section_key, item?.text);
      if (!key) continue;
      map.set(key, {
        status,
        reason: text(item?.reason) || null,
      });
    }
  }
  return map;
}

function normalizeRepair(summary) {
  const items = Array.isArray(summary?.items) ? summary.items : [];
  const map = new Map();
  for (const item of items) {
    const key = recommendationKey(item?.section_key, item?.text);
    if (!key) continue;
    map.set(key, {
      action: text(item?.recommended_action) || null,
      reason: text(item?.reason) || null,
      priority: text(item?.priority) || null,
    });
  }
  return map;
}

function normalizeGrounding(summary) {
  const items = Array.isArray(summary?.items) ? summary.items : [];
  const map = new Map();
  for (const item of items) {
    const key = recommendationKey(item?.section_key, item?.text);
    if (!key) continue;
    map.set(key, {
      status: text(item?.grounding_status) || null,
      note: text(item?.staff_note) || null,
    });
  }
  return map;
}

function normalizeChallenges(summary) {
  const items = Array.isArray(summary?.items) ? summary.items : [];
  const map = new Map();
  for (const item of items) {
    const key = recommendationKey(item?.section_key, item?.text);
    if (!key) continue;
    map.set(key, {
      status: text(item?.challenge_status) || null,
      reason: text(item?.why_it_is_questioned) || null,
      safer_reframe: text(item?.safer_reframe) || null,
    });
  }
  return map;
}

function isEvidenceImproving(value) {
  const normalized = lower(value);
  return normalized.includes("improved") || normalized.includes("now the clearest evidence") || normalized.includes("is currently strong");
}

function isEvidenceSoftening(value) {
  const normalized = lower(value);
  return normalized.includes("softened") || normalized.includes("earlier evidence quality was") || normalized.includes("thin");
}

function scoreEntry(entry, status) {
  const base =
    status === "improved" ? 88
      : status === "preserved" ? 72
        : status === "unresolved" ? 56
          : 38;
  const eventWeight = entry.transition_count * 3;
  const improvementWeight = entry.improved_shift_count * 2;
  const regressionPenalty = entry.replaced_count * 5;
  return Math.max(0, Math.min(100, base + eventWeight + improvementWeight - regressionPenalty));
}

function classifyEntry(entry) {
  const repairAction = entry.current_repair_action;
  const groundingStatus = entry.current_grounding_status;
  const challengeStatus = entry.current_challenge_status;
  const survivorshipStatus = entry.survivorship_status;

  if (
    repairAction === "retire"
    || challengeStatus === "challenged"
    || (!entry.present_in_current && entry.replaced_count > 0)
  ) {
    return "regressed";
  }

  if (
    repairAction === "rework"
    || repairAction === "verify"
    || groundingStatus === "guarded"
    || groundingStatus === "fragile"
    || challengeStatus === "guarded"
    || survivorshipStatus === "fragile"
    || (entry.present_in_current && entry.transition_count === 0)
  ) {
    return "unresolved";
  }

  if (
    entry.present_in_current
    && (
      entry.tightened_count > 0
      || entry.improved_shift_count > entry.softened_shift_count
      || (repairAction === "preserve" && survivorshipStatus === "durable")
    )
  ) {
    return "improved";
  }

  if (
    entry.present_in_current
    && (
      entry.preserved_count > 0
      || survivorshipStatus === "durable"
      || survivorshipStatus === "emerging"
      || repairAction === "preserve"
    )
  ) {
    return "preserved";
  }

  if (!entry.present_in_current && (entry.replaced_count > 0 || survivorshipStatus === "retired")) {
    return "regressed";
  }

  return entry.present_in_current ? "unresolved" : null;
}

function reasonForEntry(entry, status) {
  if (status === "improved") {
    return entry.manual_override_reason
      || entry.latest_learning_shift
      || entry.latest_evidence_shift
      || entry.repair_reason
      || entry.survivorship_reason
      || "This recommendation got stronger across revisions instead of just being reworded.";
  }
  if (status === "preserved") {
    return entry.manual_override_reason
      || entry.repair_reason
      || entry.survivorship_reason
      || entry.latest_reason
      || "This recommendation has carried forward without showing clear deterioration.";
  }
  if (status === "unresolved") {
    return entry.manual_override_reason
      || entry.repair_reason
      || entry.grounding_note
      || entry.challenge_reason
      || entry.latest_learning_shift
      || "This recommendation still needs stronger proof or clearer verification wording before it is trusted as stable.";
  }
  return entry.manual_override_reason
    || entry.repair_reason
    || entry.challenge_reason
    || entry.latest_learning_shift
    || entry.latest_reason
    || "This recommendation regressed or was retired after earlier rewrites failed to make it reliable enough.";
}

function nextStepForEntry(entry, status) {
  if (status === "improved") {
    return "Preserve the stronger version unless fresher live evidence now contradicts it.";
  }
  if (status === "preserved") {
    return "Carry this pattern forward, but keep routine verification in place.";
  }
  if (status === "unresolved") {
    return entry.challenge_safer_reframe
      || "Rewrite this more substantively or add explicit verify and re-check wording before treating it as settled.";
  }
  return "Do not bring this wording back without a fresh, evidence-backed reason.";
}

function buildEntryFromCurrentItem(key, item, currentLookup, presentInCurrent = true) {
  const sectionKey = text(item?.section_key);
  return {
    item_key: key,
    section_key: sectionKey,
    section_label: text(item?.section_label) || SECTION_LABELS[sectionKey] || sectionKey,
    text: text(item?.text),
    present_in_current: Boolean(presentInCurrent),
    transition_count: 0,
    preserved_count: 0,
    tightened_count: 0,
    replaced_count: 0,
    added_count: 0,
    improved_shift_count: 0,
    softened_shift_count: 0,
    latest_action: null,
    latest_version_number: currentLookup.current_version,
    previous_version_number: null,
    latest_reason: null,
    latest_evidence_shift: null,
    latest_learning_shift: null,
    manual_override_reason: text(item?.manual_override_reason || item?.edit_reason) || null,
    current_repair_action: text(currentLookup.repair?.action) || null,
    repair_reason: text(currentLookup.repair?.reason) || null,
    current_grounding_status: text(currentLookup.grounding?.status) || null,
    grounding_note: text(currentLookup.grounding?.note) || null,
    current_challenge_status: text(currentLookup.challenge?.status) || null,
    challenge_reason: text(currentLookup.challenge?.reason) || null,
    challenge_safer_reframe: text(currentLookup.challenge?.safer_reframe) || null,
    survivorship_status: text(currentLookup.survivorship?.status) || null,
    survivorship_reason: text(currentLookup.survivorship?.reason) || null,
  };
}

export function buildHealthPlanRecommendationRevisionMemory({
  history = [],
  recommendationSurvivorship = null,
  recommendationRepair = null,
  recommendationGrounding = null,
  recommendationChallenges = null,
} = {}) {
  const revisions = normalizeHistory(history);
  if (!revisions.length) {
    return {
      summary: "No recommendation revision memory is available yet.",
      improved_count: 0,
      preserved_count: 0,
      unresolved_count: 0,
      regressed_count: 0,
      improved: [],
      preserved: [],
      unresolved: [],
      regressed: [],
    };
  }

  const latestRevision = revisions[0];
  const latestSnapshot = objectValue(latestRevision?.quality_snapshot_json) || {};
  const survivorshipLookup = normalizeSurvivorship(recommendationSurvivorship || latestSnapshot.recommendation_survivorship);
  const repairLookup = normalizeRepair(recommendationRepair || latestSnapshot.recommendation_repair);
  const groundingLookup = normalizeGrounding(recommendationGrounding || latestSnapshot.recommendation_grounding);
  const challengeLookup = normalizeChallenges(recommendationChallenges || latestSnapshot.recommendation_challenges);
  const currentItems = sectionItems(latestRevision);
  const currentItemLookup = new Map(currentItems.map((item) => [item.key, item]));
  const entries = new Map();

  for (let index = 0; index < revisions.length; index += 1) {
    const currentRevision = revisions[index];
    const previousRevision = revisions[index + 1] || null;
    const change = currentRevision?.change || buildHealthPlanRevisionChange(currentRevision, previousRevision);
    const recommendationChanges = Array.isArray(change?.recommendation_changes?.items)
      ? change.recommendation_changes.items
      : [];

    for (const item of recommendationChanges) {
      const key = recommendationKey(item?.section_key, item?.text);
      if (!key) continue;
      if (!entries.has(key)) {
        const currentItem = currentItemLookup.get(key);
        entries.set(key, buildEntryFromCurrentItem(key, currentItem || item, {
          current_version: normalizeVersion(latestRevision?.version_number),
          repair: repairLookup.get(key) || null,
          grounding: groundingLookup.get(key) || null,
          challenge: challengeLookup.get(key) || null,
          survivorship: survivorshipLookup.get(key) || null,
        }, Boolean(currentItem)));
      }

      const entry = entries.get(key);
      entry.transition_count += item.action === "added" && previousRevision == null ? 0 : 1;
      if (item.action === "preserved") entry.preserved_count += 1;
      if (item.action === "tightened") entry.tightened_count += 1;
      if (item.action === "replaced") entry.replaced_count += 1;
      if (item.action === "added") entry.added_count += 1;
      if (isEvidenceImproving(item.evidence_shift)) entry.improved_shift_count += 1;
      if (isEvidenceSoftening(item.evidence_shift)) entry.softened_shift_count += 1;

      if (!entry.latest_action) {
        entry.latest_action = text(item.action) || null;
        entry.latest_version_number = normalizeVersion(currentRevision?.version_number);
        entry.previous_version_number = previousRevision ? normalizeVersion(previousRevision?.version_number) : null;
        entry.latest_reason = text(item.reason) || null;
        entry.latest_evidence_shift = text(item.evidence_shift) || null;
        entry.latest_learning_shift = text(item.learning_shift) || null;
        entry.manual_override_reason = text(item.manual_override_reason) || entry.manual_override_reason || null;
      }
    }
  }

  for (const currentItem of currentItems) {
    if (!currentItem?.key || entries.has(currentItem.key)) continue;
    const key = currentItem.key;
    if (!repairLookup.has(key) && !groundingLookup.has(key) && !challengeLookup.has(key) && !survivorshipLookup.has(key)) continue;
    entries.set(key, buildEntryFromCurrentItem(key, currentItem, {
      current_version: normalizeVersion(latestRevision?.version_number),
      repair: repairLookup.get(key) || null,
      grounding: groundingLookup.get(key) || null,
      challenge: challengeLookup.get(key) || null,
      survivorship: survivorshipLookup.get(key) || null,
    }, true));
  }

  const items = [...entries.values()]
    .map((entry) => {
      const status = classifyEntry(entry);
      if (!status) return null;
      return {
        item_key: entry.item_key,
        section_key: entry.section_key,
        section_label: entry.section_label,
        text: entry.text,
        status,
        score: scoreEntry(entry, status),
        present_in_current: entry.present_in_current,
        latest_action: entry.latest_action,
        latest_version_number: entry.latest_version_number,
        previous_version_number: entry.previous_version_number,
        transition_count: entry.transition_count,
        preserved_count: entry.preserved_count,
        tightened_count: entry.tightened_count,
        replaced_count: entry.replaced_count,
        added_count: entry.added_count,
        current_repair_action: entry.current_repair_action,
        current_grounding_status: entry.current_grounding_status,
        current_challenge_status: entry.current_challenge_status,
        survivorship_status: entry.survivorship_status,
        reason: reasonForEntry(entry, status),
        latest_evidence_shift: entry.latest_evidence_shift,
        latest_learning_shift: entry.latest_learning_shift,
        manual_override_reason: entry.manual_override_reason,
        next_step: nextStepForEntry(entry, status),
      };
    })
    .filter(Boolean)
    .sort((left, right) => right.score - left.score);

  const improved = items.filter((item) => item.status === "improved").slice(0, 6);
  const preserved = items.filter((item) => item.status === "preserved").slice(0, 6);
  const unresolved = items.filter((item) => item.status === "unresolved").slice(0, 6);
  const regressed = items.filter((item) => item.status === "regressed").slice(0, 6);

  const summary =
    regressed.length > 0
      ? `${regressed.length} recommendation rewrite${regressed.length === 1 ? "" : "s"} has regressed or been retired, so the next plan should not quietly reuse that wording without new evidence.`
      : unresolved.length > 0
        ? `${unresolved.length} recommendation rewrite${unresolved.length === 1 ? "" : "s"} is still unresolved, so the next plan should fix those weak spots directly instead of lightly polishing them.`
        : improved.length > 0
          ? `${improved.length} recommendation rewrite${improved.length === 1 ? "" : "s"} got meaningfully stronger across recent versions and is worth protecting.`
          : preserved.length > 0
            ? "Recent recommendation rewrites are mostly holding steady across versions."
            : "Recommendation rewrite memory is still thin, so the next plan should stay cautious about reusing exact wording.";

  return {
    summary,
    improved_count: improved.length,
    preserved_count: preserved.length,
    unresolved_count: unresolved.length,
    regressed_count: regressed.length,
    improved,
    preserved,
    unresolved,
    regressed,
  };
}
