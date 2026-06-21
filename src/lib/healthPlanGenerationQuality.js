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

function items(plan, sectionKey) {
  return Array.isArray(plan?.[sectionKey]) ? plan[sectionKey] : [];
}

function sectionText(plan, sectionKey) {
  return items(plan, sectionKey).map((item) => text(item?.text)).filter(Boolean).join(" ").toLowerCase();
}

function hasVerificationLanguage(value) {
  return /\b(verify|verification|confirm|check|re-check|recheck|follow up|follow-up|watch|monitor|review)\b/i.test(text(value));
}

function hasOperationalActionLanguage(value) {
  return /\b(call|contact|reach|respond|escalat|confirm|review|dispatch|same day|today|re-check|recheck|check)\b/i.test(text(value));
}

function hasStructuredVerification(items = []) {
  return (Array.isArray(items) ? items : []).some((item) => item?.verification_required === true);
}

function hasStructuredCompletionSignal(items = []) {
  return (Array.isArray(items) ? items : []).some((item) => text(item?.completion_signal));
}

function hasStructuredOwnerRole(items = []) {
  return (Array.isArray(items) ? items : []).some((item) =>
    ["assigned_staff", "caregiver", "on_call_coordinator", "care_team"].includes(lower(item?.owner_role)));
}

function hasStructuredFallbackOwnerRole(items = []) {
  return (Array.isArray(items) ? items : []).some((item) =>
    ["assigned_staff", "caregiver", "on_call_coordinator", "care_team"].includes(lower(item?.fallback_owner_role)));
}

function severityWeight(value) {
  if (value === "high") return 15;
  if (value === "medium") return 8;
  return 4;
}

function issueSeverity(value) {
  return value === "high" || value === "medium" ? value : "low";
}

function inferGenerationPath(plan) {
  const provider = lower(plan?.generator_provider);
  const version = lower(plan?.generator_version);
  if (provider === "fallback" || version.includes("fallback")) return "fallback";
  if (version.includes("repair")) return "repair";
  return "direct";
}

export function findHealthPlanGenerationQualityIssues(plan, {
  reviewPriorities = null,
  confidenceProfile = null,
} = {}) {
  if (!objectValue(plan)) return [];

  const issues = [];
  const priorityItems = Array.isArray(reviewPriorities?.items) ? reviewPriorities.items : [];
  const lowConfidenceSections = new Map(
    (Array.isArray(confidenceProfile?.section_confidence) ? confidenceProfile.section_confidence : [])
      .filter((item) => text(item?.section_key) && lower(item?.max_confidence) === "low")
      .map((item) => [text(item.section_key), item]),
  );

  for (const sectionKey of SECTION_KEYS) {
    const sectionItems = items(plan, sectionKey);
    const joinedText = sectionText(plan, sectionKey);
    const lowConfidence = lowConfidenceSections.get(sectionKey);
    if (lowConfidence && !hasVerificationLanguage(joinedText)) {
      issues.push({
        type: "low_confidence_verification_missing",
        section_key: sectionKey,
        severity: "high",
        message: `Health plan generation did not keep ${sectionKey} cautious enough for a low-confidence evidence picture.`,
      });
    }
    if (!sectionItems.length) continue;
    const prioritySignals = priorityItems.filter((item) => text(item?.section_key) === sectionKey);
    for (const priority of prioritySignals) {
      const needsToday = priority?.response_window === "today";
      const highPriority = priority?.priority === "high";
      const needsExecutionContract = ["monitoring_json", "escalation_json", "caregiver_guidance_json"].includes(sectionKey);
      if (needsToday && !sectionItems.some((item) => item?.timing === "today")) {
        issues.push({
          type: "review_priority_timing_missing",
          section_key: sectionKey,
          severity: "high",
          message: `Health plan generation did not mark ${sectionKey} with same-day timing even though it is a today-level review priority.`,
        });
      }
      if ((needsToday || highPriority) && !hasOperationalActionLanguage(joinedText)) {
        issues.push({
          type: "review_priority_action_missing",
          section_key: sectionKey,
          severity: needsToday ? "high" : "medium",
          message: `Health plan generation kept ${sectionKey} too generic for a high-priority review section.`,
        });
      }
      if ((needsToday || highPriority) && needsExecutionContract && !hasStructuredVerification(sectionItems)) {
        issues.push({
          type: "review_priority_verification_contract_missing",
          section_key: sectionKey,
          severity: needsToday ? "high" : "medium",
          message: `Health plan generation did not mark ${sectionKey} as verify-first or verification-aware even though it carries urgent review pressure.`,
        });
      }
      if ((needsToday || highPriority) && needsExecutionContract && !hasStructuredCompletionSignal(sectionItems)) {
        issues.push({
          type: "review_priority_completion_signal_missing",
          section_key: sectionKey,
          severity: needsToday ? "high" : "medium",
          message: `Health plan generation did not include a close-the-loop completion signal for ${sectionKey}.`,
        });
      }
      if ((needsToday || highPriority) && ["escalation_json", "caregiver_guidance_json"].includes(sectionKey) && !hasStructuredOwnerRole(sectionItems)) {
        issues.push({
          type: "review_priority_owner_role_missing",
          section_key: sectionKey,
          severity: needsToday ? "high" : "medium",
          message: `Health plan generation did not name a structured owner role for ${sectionKey}.`,
        });
      }
      if ((needsToday || highPriority) && sectionKey === "escalation_json" && !hasStructuredFallbackOwnerRole(sectionItems)) {
        issues.push({
          type: "review_priority_fallback_owner_missing",
          section_key: sectionKey,
          severity: needsToday ? "high" : "medium",
          message: `Health plan generation did not include a structured fallback owner for urgent escalation.`,
        });
      }
      if (highPriority && !sectionItems.some((item) => item?.priority === "high" || item?.priority === "medium")) {
        issues.push({
          type: "review_priority_metadata_missing",
          section_key: sectionKey,
          severity: "medium",
          message: `Health plan generation did not carry operational priority metadata into ${sectionKey}.`,
        });
      }
    }
  }

  return issues;
}

export function buildHealthPlanGenerationQuality({
  plan = null,
  reviewPriorities = null,
  confidenceProfile = null,
} = {}) {
  if (!objectValue(plan)) return null;

  const issues = findHealthPlanGenerationQualityIssues(plan, {
    reviewPriorities,
    confidenceProfile,
  });
  const generationPath = inferGenerationPath(plan);
  const score = Math.max(0, 100 - issues.reduce((total, issue) => total + severityWeight(issueSeverity(issue?.severity)), 0));
  const overallStatus =
    generationPath === "fallback" || issues.some((issue) => issue?.severity === "high") || score < 70
      ? "fragile"
      : generationPath === "repair" || issues.some((issue) => issue?.severity === "medium") || score < 88
        ? "guarded"
        : "strong";

  let summary = "This plan passed the current generation quality checks cleanly.";
  if (generationPath === "fallback") {
    summary = "A deterministic fallback plan was used because the AI output was unavailable or did not clear the quality gate.";
  } else if (generationPath === "repair") {
    summary = "The AI draft needed a repair pass before it cleared the generation quality gate.";
  } else if (overallStatus === "guarded") {
    summary = "This plan cleared generation, but some sections still need extra human caution before staff rely on them heavily.";
  } else if (overallStatus === "fragile") {
    summary = "This plan is still too fragile to trust without close human review, even though it passed the minimum structure and safety checks.";
  }

  return {
    overall_status: overallStatus,
    score,
    generation_path: generationPath,
    generator_provider: text(plan?.generator_provider) || null,
    generator_version: text(plan?.generator_version) || null,
    summary,
    issue_count: issues.length,
    issues: issues.slice(0, 5),
    review_first_section_keys: unique(priorityItemsKeys(reviewPriorities)),
  };
}

function priorityItemsKeys(reviewPriorities) {
  return (Array.isArray(reviewPriorities?.items) ? reviewPriorities.items : []).map((item) => item?.section_key);
}

export function shouldRejectHealthPlanGenerationQuality(quality) {
  const summary = objectValue(quality);
  if (!summary) return false;
  const issues = Array.isArray(summary.issues) ? summary.issues : [];
  const mediumCount = issues.filter((issue) => issue?.severity === "medium").length;
  return issues.some((issue) => issue?.severity === "high") || mediumCount >= 2;
}
