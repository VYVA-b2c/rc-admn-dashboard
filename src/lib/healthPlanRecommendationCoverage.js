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

function normalizePriority(value) {
  if (value === "high" || value === "medium") return value;
  return "low";
}

function normalizeResponseWindow(value) {
  if (value === "today" || value === "this_week") return value;
  return "ongoing";
}

function sectionItems(plan, sectionKey) {
  return Array.isArray(plan?.[sectionKey]) ? plan[sectionKey] : [];
}

function normalizePlanItems(plan) {
  return SECTION_KEYS.flatMap((sectionKey) =>
    sectionItems(plan, sectionKey)
      .map((item) => {
        const itemText = text(item?.text);
        if (!itemText) return null;
        return {
          section_key: sectionKey,
          text: itemText,
          priority: normalizePriority(lower(item?.priority)),
          timing: normalizeResponseWindow(lower(item?.timing)),
          source_signal_ids: unique(item?.source_signal_ids),
        };
      })
      .filter(Boolean),
  );
}

function hasVerificationLanguage(value) {
  return /\b(verify|verification|confirm|check|re-check|recheck|follow up|follow-up|monitor|review|do not assume)\b/i.test(text(value));
}

function hasOperationalActionLanguage(value) {
  return /\b(call|contact|reach|respond|escalat|dispatch|same day|today|owner|fallback|report back|re-check|recheck|confirm)\b/i.test(text(value));
}

function signalKeywords(value) {
  return lower(value)
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((word) => word.length >= 4);
}

function factKeywords(fact) {
  return unique([
    ...signalKeywords(fact?.label),
    ...signalKeywords(fact?.detail),
    ...signalKeywords(fact?.why_it_matters),
  ]);
}

function itemMatchesFact(item, fact, { requireVerification = false } = {}) {
  const sourceIds = unique(fact?.source_signal_ids);
  const directMatch = sourceIds.some((signalId) => item.source_signal_ids.includes(signalId));
  const itemText = lower(item?.text);
  const keywordMatch = factKeywords(fact).some((keyword) => itemText.includes(keyword));
  if (!directMatch && !keywordMatch) return false;
  if (requireVerification && !hasVerificationLanguage(item.text)) return false;
  return true;
}

function summaryMatchesFact(plan, fact, { requireVerification = false } = {}) {
  const summaryText = text(plan?.summary_text);
  if (!summaryText) return false;
  const summarySignalIds = unique(plan?.summary_signal_ids);
  const sourceIds = unique(fact?.source_signal_ids);
  const directMatch = sourceIds.some((signalId) => summarySignalIds.includes(signalId));
  const keywordMatch = factKeywords(fact).some((keyword) => lower(summaryText).includes(keyword));
  if (!directMatch && !keywordMatch) return false;
  if (requireVerification && !hasVerificationLanguage(summaryText)) return false;
  return true;
}

function allowedSectionsForFact(fact, sameDayRequired = false) {
  const responseWindow = normalizeResponseWindow(lower(fact?.response_window));
  if (sameDayRequired || responseWindow === "today") return ["monitoring_json", "escalation_json"];
  return SECTION_KEYS;
}

function severityWeight(value) {
  if (value === "high") return 18;
  if (value === "medium") return 10;
  return 5;
}

function issueSeverity(fact = {}, fallback = "medium") {
  const severity = lower(fact?.severity);
  if (severity === "high" || severity === "medium" || severity === "low") return severity;
  const priority = normalizePriority(lower(fact?.priority));
  if (priority === "high") return "high";
  if (priority === "medium") return "medium";
  return fallback;
}

function topIssues(issues = [], limit = 5) {
  const ranked = [...issues].sort((left, right) => severityWeight(issueSeverity(right)) - severityWeight(issueSeverity(left)));
  return ranked.slice(0, limit);
}

function coverageStatus({ score = 0, uncoveredHigh = 0, mustAddressCovered = 0, mustAddressCount = 0, verificationCovered = 0, verificationCount = 0 } = {}) {
  if (
    uncoveredHigh > 0
    || (mustAddressCount > 0 && mustAddressCovered < mustAddressCount)
    || (verificationCount > 0 && verificationCovered === 0)
    || score < 70
  ) {
    return "fragile";
  }
  if (
    score < 88
    || (mustAddressCount > 0 && mustAddressCovered / mustAddressCount < 1)
    || (verificationCount > 0 && verificationCovered / verificationCount < 0.75)
  ) {
    return "guarded";
  }
  return "strong";
}

export function buildHealthPlanRecommendationCoverage({
  plan = null,
  evidencePack = null,
  reviewPriorities = null,
  followThrough = null,
} = {}) {
  const normalizedPlan = objectValue(plan);
  if (!normalizedPlan) return null;

  const mustAddressFacts = Array.isArray(evidencePack?.must_address_facts) ? evidencePack.must_address_facts : [];
  const verificationNeeds = Array.isArray(evidencePack?.verification_needs) ? evidencePack.verification_needs : [];
  const stabilizingFacts = Array.isArray(evidencePack?.stabilizing_facts) ? evidencePack.stabilizing_facts : [];
  const sameDayRequired = Boolean(evidencePack?.same_day_response_required);
  const planItems = normalizePlanItems(normalizedPlan);
  const issues = [];

  const mustAddressCovered = mustAddressFacts.filter((fact) => {
    const sections = allowedSectionsForFact(fact, sameDayRequired);
    const coveredBySummary = !sections.every((sectionKey) => ["monitoring_json", "escalation_json"].includes(sectionKey))
      && summaryMatchesFact(normalizedPlan, fact);
    const coveredBySection = planItems.some((item) => sections.includes(item.section_key) && itemMatchesFact(item, fact));
    const coveredWithTiming = sections.includes("monitoring_json") || sections.includes("escalation_json")
      ? planItems.some((item) =>
        sections.includes(item.section_key)
        && itemMatchesFact(item, fact)
        && (
          normalizeResponseWindow(lower(fact?.response_window)) !== "today"
          || item.timing === "today"
          || item.priority === "high"
        ))
      : coveredBySection;
    const covered = coveredBySummary || coveredWithTiming;
    if (!covered) {
      const severity = issueSeverity(fact, sameDayRequired ? "high" : "medium");
      issues.push({
        type: "must_address_fact_missing",
        section_key: normalizeResponseWindow(lower(fact?.response_window)) === "today" || sameDayRequired ? "escalation_json" : "monitoring_json",
        severity,
        message: `The plan did not directly cover this live care fact: "${text(fact?.label) || "Key signal"}".`,
      });
    }
    return covered;
  }).length;

  const verificationCovered = verificationNeeds.filter((fact) => {
    const coveredBySummary = summaryMatchesFact(normalizedPlan, fact, { requireVerification: true });
    const coveredBySection = planItems.some((item) =>
      ["monitoring_json", "escalation_json", "daily_support_json", "caregiver_guidance_json"].includes(item.section_key)
      && itemMatchesFact(item, fact, { requireVerification: true }));
    const covered = coveredBySummary || coveredBySection;
    if (!covered) {
      issues.push({
        type: "verification_need_missing",
        section_key: "monitoring_json",
        severity: issueSeverity(fact, "medium"),
        message: `The plan did not make this uncertainty explicit enough: "${text(fact?.label) || "Verification need"}".`,
      });
    }
    return covered;
  }).length;

  const stabilizingPreserved = stabilizingFacts.filter((fact) => {
    const covered = planItems.some((item) =>
      ["goals_json", "daily_support_json", "caregiver_guidance_json"].includes(item.section_key)
      && itemMatchesFact(item, fact));
    if (!covered) {
      issues.push({
        type: "stabilizing_fact_missing",
        section_key: "daily_support_json",
        severity: "medium",
        message: `The plan dropped a stabilizing support anchor without replacing it clearly: "${text(fact?.label) || "Support anchor"}".`,
      });
    }
    return covered;
  }).length;

  const highPrioritySections = (Array.isArray(reviewPriorities?.items) ? reviewPriorities.items : [])
    .filter((item) => normalizePriority(lower(item?.priority)) === "high" || normalizeResponseWindow(lower(item?.response_window)) === "today")
    .map((item) => text(item?.section_key))
    .filter(Boolean);
  for (const sectionKey of unique(highPrioritySections)) {
    const joinedText = sectionItems(normalizedPlan, sectionKey).map((item) => text(item?.text)).join(" ");
    if (!joinedText) {
      issues.push({
        type: "high_priority_section_missing",
        section_key: sectionKey,
        severity: "high",
        message: `The plan left a high-priority section empty: "${sectionKey}".`,
      });
      continue;
    }
    if (!hasOperationalActionLanguage(joinedText)) {
      issues.push({
        type: "high_priority_section_too_generic",
        section_key: sectionKey,
        severity: "medium",
        message: `The plan stayed too generic in a high-priority section: "${sectionKey}".`,
      });
    }
  }

  const caregiverPressure = mustAddressFacts.some((fact) => /\bcare|caregiver|family|provider|support\b/i.test(text(fact?.label)));
  if (caregiverPressure && sectionItems(normalizedPlan, "caregiver_guidance_json").length === 0) {
    issues.push({
      type: "caregiver_guidance_missing",
      section_key: "caregiver_guidance_json",
      severity: "medium",
      message: "The plan identified support-circle pressure but did not give caregivers or staff a concrete guidance section.",
    });
  }

  if (lower(followThrough?.status) === "needs_review") {
    const monitoringText = sectionItems(normalizedPlan, "monitoring_json").map((item) => text(item?.text)).join(" ");
    const escalationText = sectionItems(normalizedPlan, "escalation_json").map((item) => text(item?.text)).join(" ");
    if (!hasVerificationLanguage(monitoringText) && !hasOperationalActionLanguage(escalationText)) {
      issues.push({
        type: "follow_through_pressure_underplayed",
        section_key: "monitoring_json",
        severity: "high",
        message: "Recent operational follow-through is still weak, but the plan did not tighten monitoring or fallback actions enough.",
      });
    }
  }

  const score = Math.max(0, 100 - topIssues(issues, issues.length).reduce((total, issue) => total + severityWeight(issueSeverity(issue)), 0));
  const uncoveredHigh = issues.filter((issue) => issueSeverity(issue) === "high").length;
  const overallStatus = coverageStatus({
    score,
    uncoveredHigh,
    mustAddressCovered,
    mustAddressCount: mustAddressFacts.length,
    verificationCovered,
    verificationCount: verificationNeeds.length,
  });

  let summary = "The plan covers the main live facts and keeps uncertainty visible where the record is still thin.";
  if (overallStatus === "guarded") {
    summary = "The plan covers much of the live picture, but some important risks, verification steps, or support anchors still need tighter wording.";
  } else if (overallStatus === "fragile") {
    summary = "The plan is still missing critical live facts, explicit verification, or support continuity in places that matter operationally.";
  }

  return {
    overall_status: overallStatus,
    score,
    summary,
    must_address_count: mustAddressFacts.length,
    must_address_covered_count: mustAddressCovered,
    verification_need_count: verificationNeeds.length,
    verification_covered_count: verificationCovered,
    stabilizing_fact_count: stabilizingFacts.length,
    stabilizing_preserved_count: stabilizingPreserved,
    issue_count: issues.length,
    issues: topIssues(issues),
  };
}

export function shouldRejectHealthPlanRecommendationCoverage(summary) {
  const normalized = objectValue(summary);
  if (!normalized) return false;
  const issues = Array.isArray(normalized.issues) ? normalized.issues : [];
  const highCount = issues.filter((issue) => issueSeverity(issue) === "high").length;
  if (highCount > 0) return true;
  if (Number(normalized.must_address_count || 0) > Number(normalized.must_address_covered_count || 0)) return true;
  if (Number(normalized.verification_need_count || 0) > 0 && Number(normalized.verification_covered_count || 0) === 0) return true;
  return Number(normalized.score || 0) < 70;
}
