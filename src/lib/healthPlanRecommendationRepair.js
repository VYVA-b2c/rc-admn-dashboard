const SECTION_LABELS = {
  goals_json: "Goals",
  daily_support_json: "Daily support",
  monitoring_json: "Monitoring",
  escalation_json: "Escalation",
  caregiver_guidance_json: "Caregiver guidance",
};

function text(value) {
  return String(value || "").trim();
}

function lower(value) {
  return text(value).toLowerCase();
}

function objectValue(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function unique(values) {
  return [...new Set((Array.isArray(values) ? values : []).map((value) => text(value)).filter(Boolean))];
}

function sectionLabel(sectionKey) {
  return SECTION_LABELS[text(sectionKey)] || null;
}

function priorityScore(value) {
  if (value === "high") return 3;
  if (value === "medium") return 2;
  return 1;
}

function actionPriority(action, challengeItem, sectionKey) {
  if (action === "retire") return "high";
  if (action === "rework" && challengeItem?.high_risk) return "high";
  if (action === "rework" && ["monitoring_json", "escalation_json"].includes(text(sectionKey))) return "high";
  if (action === "rework" || action === "verify") return "medium";
  return "low";
}

function normalizeLearning(items = []) {
  return new Map(
    (Array.isArray(items) ? items : [])
      .map((item) => {
        const itemId = text(item?.item_id);
        const sectionKey = text(item?.section_key);
        if (!itemId || !sectionKey) return null;
        return [`${sectionKey}:${itemId}`, item];
      })
      .filter(Boolean),
  );
}

function normalizeEffectivenessGroup(items = []) {
  return new Map(
    (Array.isArray(items) ? items : [])
      .map((item) => {
        const itemId = text(item?.item_id);
        const sectionKey = text(item?.section_key);
        if (!itemId || !sectionKey) return null;
        return [`${sectionKey}:${itemId}`, item];
      })
      .filter(Boolean),
  );
}

function normalizeLookup(items = [], itemIdKey = "item_id") {
  return new Map(
    (Array.isArray(items) ? items : [])
      .map((item) => {
        const itemId = text(item?.[itemIdKey]);
        const sectionKey = text(item?.section_key);
        if (!itemId || !sectionKey) return null;
        return [`${sectionKey}:${itemId}`, item];
      })
      .filter(Boolean),
  );
}

function inferAction({ preserveItem, reworkItem, retireItem, groundingItem, challengeItem, learningItem }) {
  if (retireItem || learningItem?.reuse_priority === "replace") return "retire";
  if (challengeItem?.challenge_status === "challenged") return "rework";
  if (groundingItem?.grounding_status === "fragile") return "rework";
  if (reworkItem?.action === "verify" || learningItem?.reuse_priority === "verify") return "verify";
  if (reworkItem || groundingItem?.grounding_status === "guarded" || challengeItem?.challenge_status === "guarded") return "rework";
  if (preserveItem || learningItem?.reuse_priority === "preserve") return "preserve";
  return "observe";
}

function reasonForAction(action, { preserveItem, reworkItem, retireItem, groundingItem, challengeItem, learningItem, rankingItem }) {
  if (action === "retire") {
    return text(retireItem?.action_reason)
      || text(learningItem?.reason)
      || "This recommendation has repeatedly failed or stayed unresolved and should not come back unchanged.";
  }
  if (action === "verify") {
    return text(reworkItem?.action_reason)
      || text(groundingItem?.staff_note)
      || "This recommendation may still help, but it needs explicit verification before staff rely on it heavily.";
  }
  if (action === "rework") {
    return text(challengeItem?.why_it_is_questioned)
      || text(reworkItem?.action_reason)
      || text(groundingItem?.staff_note)
      || "This recommendation needs stronger evidence, clearer fallback wording, or a better fit to the live pattern.";
  }
  if (action === "preserve") {
    return text(preserveItem?.action_reason)
      || text(learningItem?.reason)
      || text(rankingItem?.top_summary)
      || "This recommendation has earned preserve status and should stay unless fresher live evidence now contradicts it.";
  }
  return text(learningItem?.reason) || text(rankingItem?.top_summary) || "No repair note is available for this recommendation yet.";
}

function guidanceForAction(action, { challengeItem, groundingItem }) {
  if (action === "retire") {
    return "Replace this recommendation with a different routine tied to fresher evidence instead of lightly rewording it.";
  }
  if (action === "verify") {
    return "Keep the intent only if you rewrite it with explicit confirm, re-check, or monitor-next wording.";
  }
  if (action === "rework") {
    return text(challengeItem?.safer_reframe)
      || (groundingItem?.grounding_status === "fragile"
        ? "Anchor this in stronger live evidence, or soften it into verification language with a concrete next step."
        : "Tighten the wording, name the fallback, and make the next operational step more explicit.");
  }
  if (action === "preserve") {
    return "Keep this routine unless fresher live evidence clearly overturns it.";
  }
  return null;
}

export function buildHealthPlanRecommendationRepairBrief({
  recommendationLearning = [],
  recommendationEffectiveness = null,
  recommendationGrounding = null,
  recommendationChallenges = null,
  recommendationSourceRanking = null,
} = {}) {
  const learning = normalizeLearning(recommendationLearning);
  if (!learning.size) {
    return {
      overall_status: "limited",
      summary: "No recommendation-level learning is available yet.",
      repair_count: 0,
      preserve_count: 0,
      items: [],
    };
  }

  const effectiveness = objectValue(recommendationEffectiveness);
  const preserve = normalizeEffectivenessGroup(effectiveness?.preserve_now);
  const rework = normalizeEffectivenessGroup(effectiveness?.rework_now);
  const retire = normalizeEffectivenessGroup(effectiveness?.retire_now);
  const grounding = normalizeLookup(recommendationGrounding?.items);
  const challenges = normalizeLookup(recommendationChallenges?.items);
  const ranking = normalizeLookup(recommendationSourceRanking?.items);

  const items = [...learning.entries()]
    .map(([key, learningItem]) => {
      const preserveItem = preserve.get(key) || null;
      const reworkItem = rework.get(key) || null;
      const retireItem = retire.get(key) || null;
      const groundingItem = grounding.get(key) || null;
      const challengeItem = challenges.get(key) || null;
      const rankingItem = ranking.get(key) || null;
      const action = inferAction({
        preserveItem,
        reworkItem,
        retireItem,
        groundingItem,
        challengeItem,
        learningItem,
      });
      if (action === "observe") return null;
      const sectionKey = text(learningItem?.section_key);
      return {
        item_id: text(learningItem?.item_id) || null,
        section_key: sectionKey,
        section_label: text(learningItem?.section_label) || sectionLabel(sectionKey),
        text: text(learningItem?.text) || null,
        recommended_action: action,
        priority: actionPriority(action, challengeItem, sectionKey),
        reason: reasonForAction(action, {
          preserveItem,
          reworkItem,
          retireItem,
          groundingItem,
          challengeItem,
          learningItem,
          rankingItem,
        }),
        rewrite_guidance: guidanceForAction(action, { challengeItem, groundingItem }),
        evidence_quality: text(rankingItem?.evidence_quality) || null,
        top_source_label: text(rankingItem?.ranked_sources?.[0]?.label) || null,
        grounding_status: text(groundingItem?.grounding_status) || null,
        challenge_status: text(challengeItem?.challenge_status) || null,
        trajectory: text(learningItem?.trajectory) || null,
        reuse_priority: text(learningItem?.reuse_priority) || null,
        source_signal_ids: unique(learningItem?.source_signal_ids),
      };
    })
    .filter(Boolean)
    .sort((left, right) => {
      const byPriority = priorityScore(right.priority) - priorityScore(left.priority);
      if (byPriority !== 0) return byPriority;
      return left.section_key.localeCompare(right.section_key);
    });

  const preserveCount = items.filter((item) => item.recommended_action === "preserve").length;
  const repairCount = items.filter((item) => ["rework", "verify", "retire"].includes(item.recommended_action)).length;
  const overallStatus =
    items.some((item) => item.recommended_action === "retire")
      ? "fragile"
      : items.some((item) => item.recommended_action === "rework" || item.recommended_action === "verify")
        ? "guarded"
        : preserveCount > 0
          ? "supportive"
          : "limited";
  const summary =
    overallStatus === "fragile"
      ? "Some recommendations should be retired or substantively rewritten before the next plan is trusted."
      : overallStatus === "guarded"
        ? "The plan contains a mix of preserve-worthy routines and recommendation-level items that still need rework or verification."
        : overallStatus === "supportive"
          ? "Recommendation-level learning mainly supports preserving the strongest routines."
          : "Recommendation-level repair guidance is still limited.";

  return {
    overall_status: overallStatus,
    summary,
    preserve_count: preserveCount,
    repair_count: repairCount,
    items: items.slice(0, 16),
  };
}

