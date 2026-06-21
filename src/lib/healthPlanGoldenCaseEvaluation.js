import { buildHealthPlanGenerationQuality, shouldRejectHealthPlanGenerationQuality } from "./healthPlanGenerationQuality.js";
import { buildHealthPlanRecommendationCoverage, shouldRejectHealthPlanRecommendationCoverage } from "./healthPlanRecommendationCoverage.js";
import { buildHealthPlanRecommendationChallenges, shouldRejectHealthPlanRecommendationChallenges } from "./healthPlanRecommendationChallenges.js";

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

function items(plan, sectionKey) {
  return Array.isArray(plan?.[sectionKey]) ? plan[sectionKey] : [];
}

function sectionText(plan, sectionKey) {
  return items(plan, sectionKey).map((item) => text(item?.text)).filter(Boolean).join(" ").toLowerCase();
}

function timingPresent(plan, sectionKey, timing) {
  return items(plan, sectionKey).some((item) => lower(item?.timing) === lower(timing));
}

function hasVerificationLanguage(value) {
  return /\b(verify|verification|confirm|check|re-check|recheck|review|do not assume|monitor)\b/i.test(text(value));
}

function hasOwnerLanguage(value) {
  return /\b(owner|assigned|coordinator|caregiver|team|staff|operator|responder|on-call|family)\b/i.test(text(value));
}

function hasFallbackLanguage(value) {
  return /\b(fallback|if .* fails|if .* continues|if contact still fails|report back|escalat|backup|next step)\b/i.test(text(value));
}

function hasUrgencyLanguage(value) {
  return /\b(today|same-day|same day|immediately|urgent|now)\b/i.test(text(value));
}

function penalty(value) {
  if (value === "high") return 18;
  if (value === "medium") return 10;
  return 5;
}

function severityIssue(severity, message, sectionKey = null, type = "expectation_failed") {
  return {
    type,
    severity,
    section_key: sectionKey,
    message,
  };
}

function evaluateScenarioExpectations(scenario, plan) {
  const issues = [];
  const expectations = objectValue(scenario?.expectations) || {};
  const requiredSections = unique(expectations.required_sections);

  for (const sectionKey of requiredSections) {
    if (items(plan, sectionKey).length === 0) {
      issues.push(severityIssue("high", `Expected ${sectionKey} to contain actionable guidance for this scenario.`, sectionKey, "required_section_missing"));
    }
  }

  for (const rule of Array.isArray(expectations.section_keywords) ? expectations.section_keywords : []) {
    const sectionKey = text(rule?.section_key);
    const keywords = unique(rule?.keywords).map((item) => lower(item));
    const joinedText = sectionText(plan, sectionKey);
    for (const keyword of keywords) {
      if (!joinedText.includes(keyword)) {
        issues.push(severityIssue("medium", `Expected ${sectionKey} to address "${keyword}" for this scenario.`, sectionKey, "section_keyword_missing"));
      }
    }
  }

  for (const rule of Array.isArray(expectations.required_timings) ? expectations.required_timings : []) {
    const sectionKey = text(rule?.section_key);
    const timing = text(rule?.timing);
    if (!timingPresent(plan, sectionKey, timing)) {
      issues.push(severityIssue("high", `Expected ${sectionKey} to include ${timing} timing for this scenario.`, sectionKey, "required_timing_missing"));
    }
  }

  if (expectations.require_verification_language) {
    const relevantSections = requiredSections.length ? requiredSections : ["monitoring_json", "escalation_json", "daily_support_json", "caregiver_guidance_json"];
    const hasVerification = relevantSections.some((sectionKey) => hasVerificationLanguage(sectionText(plan, sectionKey)))
      || hasVerificationLanguage(plan?.summary_text);
    if (!hasVerification) {
      issues.push(severityIssue("high", "Expected explicit verification or confirmation language for this scenario.", "monitoring_json", "verification_language_missing"));
    }
  }

  const preserveKeywords = unique(expectations.preserve_keywords).map((item) => lower(item));
  for (const keyword of preserveKeywords) {
    const found = ["goals_json", "daily_support_json", "caregiver_guidance_json"]
      .some((sectionKey) => sectionText(plan, sectionKey).includes(keyword));
    if (!found) {
      issues.push(severityIssue("medium", `Expected the plan to preserve the stabilizing anchor "${keyword}".`, "daily_support_json", "stabilizing_anchor_missing"));
    }
  }

  return issues;
}

function averageScore(values = []) {
  if (!values.length) return 0;
  return Math.round(values.reduce((total, value) => total + Number(value || 0), 0) / values.length);
}

function rubricLevel(score) {
  if (score >= 85) return "strong";
  if (score >= 65) return "guarded";
  return "fragile";
}

function buildRubricDimension(id, label, score, rationale) {
  return {
    id,
    label,
    score,
    status: rubricLevel(score),
    rationale,
  };
}

function evaluateGoldenCaseRubric(scenario, plan) {
  const expectations = objectValue(scenario?.expectations) || {};
  const evidencePack = objectValue(scenario?.evidencePack) || {};
  const requiredSections = unique(expectations.required_sections);
  const summaryText = text(plan?.summary_text);
  const monitoringText = sectionText(plan, "monitoring_json");
  const escalationText = sectionText(plan, "escalation_json");
  const caregiverText = sectionText(plan, "caregiver_guidance_json");
  const dailySupportText = sectionText(plan, "daily_support_json");
  const supportText = [dailySupportText, caregiverText, sectionText(plan, "goals_json")].join(" ");

  const ownerSignals = [summaryText, monitoringText, escalationText, caregiverText].filter(Boolean);
  const ownerHits = ownerSignals.filter((value) => hasOwnerLanguage(value)).length;
  const ownerScore = ownerHits >= 2 ? 100 : ownerHits === 1 ? 72 : 40;

  const needsFallback = Boolean(evidencePack.same_day_response_required)
    || lower(scenario?.followThrough?.status) === "needs_review"
    || requiredSections.includes("escalation_json");
  const fallbackSignals = [monitoringText, escalationText, caregiverText].filter(Boolean);
  const fallbackHits = fallbackSignals.filter((value) => hasFallbackLanguage(value)).length;
  const fallbackScore = !needsFallback
    ? 100
    : fallbackHits >= 2
      ? 100
      : fallbackHits === 1
        ? 74
        : 35;

  const verificationRequired = Boolean(expectations.require_verification_language)
    || (Array.isArray(evidencePack.verification_needs) && evidencePack.verification_needs.length > 0);
  const verificationSignals = [summaryText, monitoringText, escalationText, caregiverText].filter(Boolean);
  const verificationHits = verificationSignals.filter((value) => hasVerificationLanguage(value)).length;
  const verificationScore = !verificationRequired
    ? 100
    : verificationHits >= 2
      ? 100
      : verificationHits === 1
        ? 72
        : 30;

  const sameDayRequired = Boolean(evidencePack.same_day_response_required);
  const timingHits = [
    timingPresent(plan, "monitoring_json", "today"),
    timingPresent(plan, "escalation_json", "today"),
  ].filter(Boolean).length;
  const urgencyHits = [summaryText, monitoringText, escalationText].filter((value) => hasUrgencyLanguage(value)).length;
  const urgencyScore = !sameDayRequired
    ? 100
    : timingHits === 2 && urgencyHits >= 2
      ? 100
      : timingHits >= 1 && urgencyHits >= 1
        ? 72
        : 30;

  const preserveKeywords = unique(expectations.preserve_keywords).map((item) => lower(item));
  const preservedKeywordHits = preserveKeywords.filter((keyword) => supportText.includes(keyword)).length;
  const stabilizingCount = Array.isArray(evidencePack.stabilizing_facts) ? evidencePack.stabilizing_facts.length : 0;
  const supportContinuityScore = preserveKeywords.length > 0 || stabilizingCount > 0
    ? (
      preservedKeywordHits >= preserveKeywords.length && supportText.length > 0
        ? 100
        : preservedKeywordHits > 0
          ? 72
          : 38
    )
    : 100;

  const caregiverRelevant = requiredSections.includes("caregiver_guidance_json")
    || /caregiver|family|consent|support owner|care provider/i.test(JSON.stringify(evidencePack));
  const caregiverHints = [caregiverText, summaryText].filter(Boolean);
  const caregiverActionHits = caregiverHints.filter((value) => /\b(confirm|report back|consent|owner|caregiver|family|support)\b/i.test(value)).length;
  const caregiverScore = !caregiverRelevant
    ? 100
    : caregiverText && caregiverActionHits >= 1
      ? 100
      : caregiverActionHits >= 1
        ? 70
        : 35;

  const dimensions = [
    buildRubricDimension("owner_clarity", "Owner clarity", ownerScore, ownerScore >= 85
      ? "The plan names who should act or receive the next step."
      : ownerScore >= 65
        ? "The plan hints at ownership, but not consistently."
        : "The plan leaves action ownership vague."),
    buildRubricDimension("fallback_completeness", "Fallback completeness", fallbackScore, fallbackScore >= 85
      ? "The plan explains what to do if the first outreach or routine fails."
      : fallbackScore >= 65
        ? "The plan has some fallback language, but not enough for a pressured case."
        : "The plan does not give a dependable fallback path."),
    buildRubricDimension("verification_clarity", "Verification clarity", verificationScore, verificationScore >= 85
      ? "The plan is explicit about what still needs confirmation."
      : verificationScore >= 65
        ? "The plan uses some cautious language, but it could be clearer."
        : "The plan risks sounding more certain than the evidence allows."),
    buildRubricDimension("urgency_calibration", "Urgency calibration", urgencyScore, urgencyScore >= 85
      ? "The timing and wording match the urgency of the case."
      : urgencyScore >= 65
        ? "The plan partly reflects urgency, but not consistently."
        : "The plan underplays the timing pressure of the case."),
    buildRubricDimension("support_continuity", "Support continuity", supportContinuityScore, supportContinuityScore >= 85
      ? "Helpful routines or stabilizing supports are preserved clearly."
      : supportContinuityScore >= 65
        ? "Some stabilizing support is preserved, but continuity could be stronger."
        : "The plan drops support continuity too easily."),
    buildRubricDimension("caregiver_usability", "Caregiver usability", caregiverScore, caregiverScore >= 85
      ? "The caregiver or care-circle guidance is concrete and usable."
      : caregiverScore >= 65
        ? "The caregiver guidance is partly usable but could be more direct."
        : "The plan does not give the care circle enough practical guidance."),
  ];

  const overallScore = averageScore(dimensions.map((item) => item.score));
  const overallStatus = rubricLevel(overallScore);
  const strongestDimension = [...dimensions].sort((left, right) => right.score - left.score)[0] || null;
  const weakestDimension = [...dimensions].sort((left, right) => left.score - right.score)[0] || null;

  return {
    overall_score: overallScore,
    overall_status: overallStatus,
    strongest_dimension: strongestDimension ? strongestDimension.id : null,
    weakest_dimension: weakestDimension ? weakestDimension.id : null,
    dimensions,
  };
}

export function evaluateHealthPlanAgainstGoldenCase(scenario, plan) {
  const normalizedScenario = objectValue(scenario);
  const normalizedPlan = objectValue(plan);
  if (!normalizedScenario || !normalizedPlan) return null;

  const generationQuality = buildHealthPlanGenerationQuality({
    plan: normalizedPlan,
    reviewPriorities: normalizedScenario.reviewPriorities || null,
    confidenceProfile: normalizedScenario.confidenceProfile || null,
  });
  const recommendationCoverage = buildHealthPlanRecommendationCoverage({
    plan: normalizedPlan,
    evidencePack: normalizedScenario.evidencePack || null,
    reviewPriorities: normalizedScenario.reviewPriorities || null,
    followThrough: normalizedScenario.followThrough || null,
  });
  const recommendationChallenges = buildHealthPlanRecommendationChallenges({
    plan: normalizedPlan,
    sourceSignals: normalizedScenario.sourceSignals || [],
    reviewPriorities: normalizedScenario.reviewPriorities || null,
  });
  const rubric = evaluateGoldenCaseRubric(normalizedScenario, normalizedPlan);
  const expectationIssues = evaluateScenarioExpectations(normalizedScenario, normalizedPlan);
  const issues = [
    ...expectationIssues,
    ...(Array.isArray(generationQuality?.issues) ? generationQuality.issues : []),
    ...(Array.isArray(recommendationCoverage?.issues) ? recommendationCoverage.issues : []),
  ];

  if (shouldRejectHealthPlanGenerationQuality(generationQuality)) {
    issues.push(severityIssue("high", "The plan failed the generation-quality gate for this golden scenario.", null, "generation_quality_reject"));
  }
  if (shouldRejectHealthPlanRecommendationCoverage(recommendationCoverage)) {
    issues.push(severityIssue("high", "The plan failed the recommendation-coverage gate for this golden scenario.", null, "coverage_reject"));
  }
  if (shouldRejectHealthPlanRecommendationChallenges(recommendationChallenges)) {
    issues.push(severityIssue("high", "The plan still contains a challenged high-risk recommendation for this golden scenario.", null, "challenge_reject"));
  }

  const deduped = [];
  const seen = new Set();
  for (const issue of issues) {
    const key = `${issue.type}:${text(issue.section_key)}:${text(issue.message)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(issue);
  }

  const score = Math.max(0, 100 - deduped.reduce((total, issue) => total + penalty(lower(issue?.severity)), 0));
  const highIssues = deduped.filter((issue) => lower(issue?.severity) === "high").length;
  const overallStatus =
    highIssues > 0 || score < 70
      ? "fragile"
      : score < 88
        ? "guarded"
        : "strong";

  return {
    case_id: normalizedScenario.id,
    case_label: normalizedScenario.label,
    overall_status: overallStatus,
    score,
    issue_count: deduped.length,
    generation_quality: generationQuality,
    recommendation_coverage: recommendationCoverage,
    recommendation_challenges: recommendationChallenges,
    rubric,
    issues: deduped.slice(0, 8),
  };
}

export function evaluateHealthPlanGoldenSuite(cases = [], plansByCase = {}) {
  const evaluations = (Array.isArray(cases) ? cases : [])
    .map((scenario) => {
      const plan = plansByCase?.[scenario.id];
      if (!plan) return null;
      return evaluateHealthPlanAgainstGoldenCase(scenario, plan);
    })
    .filter(Boolean);

  const strongCount = evaluations.filter((item) => item.overall_status === "strong").length;
  const guardedCount = evaluations.filter((item) => item.overall_status === "guarded").length;
  const fragileCount = evaluations.filter((item) => item.overall_status === "fragile").length;
  const averageScore = evaluations.length
    ? Math.round(evaluations.reduce((total, item) => total + Number(item.score || 0), 0) / evaluations.length)
    : 0;
  const averageRubricScore = evaluations.length
    ? Math.round(evaluations.reduce((total, item) => total + Number(item.rubric?.overall_score || 0), 0) / evaluations.length)
    : 0;

  return {
    total_cases: evaluations.length,
    strong_count: strongCount,
    guarded_count: guardedCount,
    fragile_count: fragileCount,
    average_score: averageScore,
    average_rubric_score: averageRubricScore,
    evaluations,
  };
}
