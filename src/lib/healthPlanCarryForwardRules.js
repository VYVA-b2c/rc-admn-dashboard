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

function normalizedText(value) {
  return text(value).toLowerCase().replace(/\s+/g, " ");
}

function itemTexts(items) {
  return new Set((Array.isArray(items) ? items : []).map((item) => normalizedText(item?.text)).filter(Boolean));
}

export function findHealthPlanRecommendationCarryForwardIssues({
  existingPlan = null,
  recommendationLearning = [],
  nextPlan = null,
  targetSections = [],
} = {}) {
  if (!existingPlan || !nextPlan) return [];
  const scopedSections = new Set(
    (Array.isArray(targetSections) && targetSections.length ? targetSections : SECTION_KEYS)
      .map((sectionKey) => text(sectionKey))
      .filter(Boolean),
  );

  return (Array.isArray(recommendationLearning) ? recommendationLearning : [])
    .filter((item) =>
      text(item?.reuse_priority) === "replace"
      && scopedSections.has(text(item?.section_key))
      && normalizedText(item?.text),
    )
    .map((item) => {
      const sectionKey = text(item.section_key);
      const nextTexts = itemTexts(nextPlan?.[sectionKey]);
      const currentText = normalizedText(item.text);
      if (!nextTexts.has(currentText)) return null;
      return {
        section_key: sectionKey,
        item_id: text(item?.item_id) || null,
        text: text(item?.text),
        reason: text(item?.reason) || "A recommendation that was marked for replacement was carried forward unchanged.",
      };
    })
    .filter(Boolean);
}
