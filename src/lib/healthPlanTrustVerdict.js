function text(value) {
  return String(value || "").trim();
}

function lower(value) {
  return text(value).toLowerCase();
}

function objectValue(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function normalizeSectionKeys(value) {
  return [...new Set((Array.isArray(value) ? value : [value]).map((item) => text(item)).filter(Boolean))];
}

function severityWeight(value) {
  if (value === "high") return 20;
  if (value === "medium") return 10;
  return 4;
}

function itemKey(item = {}) {
  return [text(item?.type), text(item?.label), text(item?.detail)].join("|");
}

function dedupe(items = []) {
  const seen = new Set();
  return (Array.isArray(items) ? items : []).filter((item) => {
    const key = itemKey(item);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function makeItem(type, label, detail = null, options = {}) {
  return {
    type,
    label: text(label) || null,
    detail: text(detail) || null,
    severity: lower(options?.severity) === "high" ? "high" : lower(options?.severity) === "medium" ? "medium" : "low",
    section_keys: normalizeSectionKeys(options?.section_keys),
  };
}

function firstIssue(summary = null) {
  return Array.isArray(summary?.issues) ? summary.issues[0] || null : null;
}

function firstEvaluationIssue(summary = null) {
  const evaluations = Array.isArray(summary?.evaluations) ? summary.evaluations : [];
  return evaluations.find((item) => objectValue(item?.top_issue))?.top_issue || evaluations[0]?.top_issue || null;
}

function briefIssueSeverity(issue = null) {
  const severity = lower(issue?.severity);
  if (severity === "high" || severity === "medium" || severity === "low") return severity;
  return "medium";
}

function nextActionForType(type) {
  if (type === "generation_brief_compliance") return "Regenerate or rewrite the sections that drifted away from the ranked brief.";
  if (type === "recommendation_grounding") return "Tighten claims so each recommendation matches the strength of its evidence.";
  if (type === "recommendation_calibration") return "Review the recommendations the validator softened so staff understand what changed before trusting the plan heavily.";
  if (type === "recommendation_coverage") return "Cover the live pressure points and missing verification steps more directly.";
  if (type === "operational_completeness") return "Make timing, trigger, owner, and fallback more concrete.";
  if (type === "benchmark_assessment") return "Repair the plan against the matched high-risk benchmark pattern.";
  if (type === "generation_quality") return "Repair the generated draft before staff rely on it.";
  if (type === "recommendation_challenges") return "Rewrite the challenged high-risk recommendations more cautiously.";
  return "Review the flagged evidence and tighten the plan before staff rely on it.";
}

function collectDimensionStatus(name, summary = null, reject = false) {
  const normalized = objectValue(summary);
  return {
    name,
    overall_status: lower(normalized?.overall_status) || null,
    reject,
    summary: text(normalized?.summary) || null,
  };
}

export function buildHealthPlanTrustVerdict({
  generationQuality = null,
  operationalCompleteness = null,
  recommendationGrounding = null,
  recommendationCalibration = null,
  recommendationCoverage = null,
  benchmarkAssessment = null,
  recommendationChallenges = null,
  generationBriefIssues = [],
} = {}) {
  const blockers = [];
  const cautions = [];

  if (Array.isArray(generationBriefIssues) && generationBriefIssues.length) {
    const highBrief = generationBriefIssues.find((item) => briefIssueSeverity(item) === "high") || null;
    if (highBrief) {
      blockers.push(makeItem(
        "generation_brief_compliance",
        highBrief?.message || "The plan drifted away from the ranked generation brief.",
        null,
        { severity: highBrief?.severity, section_keys: highBrief?.section_key },
      ));
    } else {
      cautions.push(makeItem(
        "generation_brief_compliance",
        generationBriefIssues[0]?.message || "The plan only partially followed the ranked generation brief.",
        null,
        { severity: generationBriefIssues[0]?.severity, section_keys: generationBriefIssues[0]?.section_key },
      ));
    }
  }

  if (lower(generationQuality?.overall_status) === "fragile" || generationQuality?.rejected) {
    const issue = firstIssue(generationQuality);
    blockers.push(makeItem(
      "generation_quality",
      issue?.message || generationQuality?.summary || "The draft still has unresolved generation-quality problems.",
      null,
      { severity: issue?.severity, section_keys: issue?.section_key },
    ));
  } else if (lower(generationQuality?.overall_status) === "guarded") {
    const issue = firstIssue(generationQuality);
    cautions.push(makeItem(
      "generation_quality",
      generationQuality?.summary || "The generated plan is usable but still needs extra human caution.",
      null,
      { severity: issue?.severity, section_keys: issue?.section_key },
    ));
  }

  if (lower(operationalCompleteness?.overall_status) === "fragile") {
    const issue = firstIssue(operationalCompleteness);
    blockers.push(makeItem(
      "operational_completeness",
      issue?.message || operationalCompleteness?.summary || "The plan still leaves important execution detail implicit.",
      issue?.detail || null,
      { severity: issue?.severity, section_keys: issue?.section_key },
    ));
  } else if (lower(operationalCompleteness?.overall_status) === "guarded") {
    const issue = firstIssue(operationalCompleteness);
    cautions.push(makeItem(
      "operational_completeness",
      operationalCompleteness?.summary || "Some sections still need clearer operational wording.",
      issue?.detail || null,
      { severity: issue?.severity, section_keys: issue?.section_key },
    ));
  }

  if (lower(recommendationGrounding?.overall_status) === "fragile" || recommendationGrounding?.rejected) {
    const issue = firstIssue(recommendationGrounding);
    blockers.push(makeItem(
      "recommendation_grounding",
      issue?.message || recommendationGrounding?.summary || "One or more recommendations still outrun their evidence.",
      null,
      { severity: issue?.severity, section_keys: issue?.section_key },
    ));
  } else if (lower(recommendationGrounding?.overall_status) === "guarded") {
    const issue = firstIssue(recommendationGrounding);
    cautions.push(makeItem(
      "recommendation_grounding",
      recommendationGrounding?.summary || "Some recommendations still need careful corroboration.",
      null,
      { severity: issue?.severity, section_keys: issue?.section_key },
    ));
  }

  if (Number(recommendationCalibration?.adjustment_count || 0) > 0) {
    const calibrationItems = Array.isArray(recommendationCalibration?.items) ? recommendationCalibration.items : [];
    const highlightedItem = calibrationItems.find((item) => item?.high_pressure) || calibrationItems[0] || null;
    cautions.push(makeItem(
      "recommendation_calibration",
      recommendationCalibration?.summary || "The validator had to soften one or more recommendations before the plan was accepted.",
      highlightedItem?.reason
        || "Staff should understand which recommendations needed confidence downgrades or verification wording before leaning on them heavily.",
      {
        severity: Number(recommendationCalibration?.high_pressure_adjustment_count || 0) > 0 ? "medium" : "low",
        section_keys: highlightedItem?.section_key,
      },
    ));
  }

  if (lower(recommendationCoverage?.overall_status) === "fragile" || recommendationCoverage?.rejected) {
    const issue = firstIssue(recommendationCoverage);
    blockers.push(makeItem(
      "recommendation_coverage",
      issue?.message || recommendationCoverage?.summary || "The plan is still missing important live-risk or verification coverage.",
      null,
      { severity: issue?.severity, section_keys: issue?.section_key },
    ));
  } else if (lower(recommendationCoverage?.overall_status) === "guarded") {
    const issue = firstIssue(recommendationCoverage);
    cautions.push(makeItem(
      "recommendation_coverage",
      recommendationCoverage?.summary || "Coverage is partial and still needs tightening in one or more pressure areas.",
      null,
      { severity: issue?.severity, section_keys: issue?.section_key },
    ));
  }

  if (benchmarkAssessment?.rejected || lower(benchmarkAssessment?.overall_status) === "fragile") {
    const issue = firstEvaluationIssue(benchmarkAssessment);
    blockers.push(makeItem(
      "benchmark_assessment",
      issue?.message || benchmarkAssessment?.summary || "A matched benchmark pattern still sees the plan as fragile.",
      null,
      { severity: "high", section_keys: issue?.section_key },
    ));
  } else if (lower(benchmarkAssessment?.overall_status) === "guarded") {
    const issue = firstEvaluationIssue(benchmarkAssessment);
    cautions.push(makeItem(
      "benchmark_assessment",
      benchmarkAssessment?.summary || "Matched benchmark patterns still suggest caution.",
      issue?.message || null,
      { severity: "medium", section_keys: issue?.section_key },
    ));
  }

  if (recommendationChallenges?.rejected || lower(recommendationChallenges?.overall_status) === "fragile") {
    const issue = Array.isArray(recommendationChallenges?.items)
      ? recommendationChallenges.items.find((item) => lower(item?.challenge_status) === "challenged" && item?.high_risk) || recommendationChallenges.items[0]
      : null;
    blockers.push(makeItem(
      "recommendation_challenges",
      issue?.why_it_is_questioned || recommendationChallenges?.summary || "A high-risk recommendation still needs a stronger challenge pass.",
      issue?.safer_reframe || null,
      { severity: issue?.high_risk ? "high" : "medium", section_keys: issue?.section_key },
    ));
  } else if (lower(recommendationChallenges?.overall_status) === "guarded") {
    const issue = Array.isArray(recommendationChallenges?.items) ? recommendationChallenges.items[0] || null : null;
    cautions.push(makeItem(
      "recommendation_challenges",
      recommendationChallenges?.summary || "A few recommendations still need a skeptical human challenge pass.",
      issue?.safer_reframe || null,
      { severity: issue?.high_risk ? "high" : "medium", section_keys: issue?.section_key },
    ));
  }

  const blockingItems = dedupe(blockers);
  const cautionItems = dedupe(cautions);
  const trustScore = Math.max(
    0,
    100 - [...blockingItems, ...cautionItems].reduce((total, item) => total + severityWeight(lower(item?.severity)), 0),
  );
  const overallStatus =
    blockingItems.length > 0
      ? "fragile"
      : cautionItems.length > 0 || trustScore < 88
        ? "guarded"
        : "trusted";
  const summary =
    overallStatus === "fragile"
      ? "This plan still has open quality or evidence risks and should not be treated as fully trustworthy yet."
      : overallStatus === "guarded"
        ? "This plan is usable, but staff should rely on it with deliberate caution because some trust signals are still mixed."
        : "This plan is well-grounded, operationally clear, and comparatively trustworthy for staff use.";

  const topActions = [...blockingItems, ...cautionItems]
    .slice(0, 4)
    .map((item) => nextActionForType(text(item?.type)));

  return {
    overall_status: overallStatus,
    trust_score: trustScore,
    summary,
    can_trust_for_staff_use: blockingItems.length === 0,
    blocker_count: blockingItems.length,
    caution_count: cautionItems.length,
    blocking_items: blockingItems,
    caution_items: cautionItems,
    next_actions: [...new Set(topActions)].filter(Boolean),
    dimensions: [
      collectDimensionStatus("generation_quality", generationQuality, lower(generationQuality?.overall_status) === "fragile"),
      collectDimensionStatus("operational_completeness", operationalCompleteness, lower(operationalCompleteness?.overall_status) === "fragile"),
      collectDimensionStatus("recommendation_grounding", recommendationGrounding, lower(recommendationGrounding?.overall_status) === "fragile"),
      collectDimensionStatus("recommendation_calibration", recommendationCalibration, false),
      collectDimensionStatus("recommendation_coverage", recommendationCoverage, lower(recommendationCoverage?.overall_status) === "fragile"),
      collectDimensionStatus("benchmark_assessment", benchmarkAssessment, Boolean(benchmarkAssessment?.rejected) || lower(benchmarkAssessment?.overall_status) === "fragile"),
      collectDimensionStatus("recommendation_challenges", recommendationChallenges, Boolean(recommendationChallenges?.rejected) || lower(recommendationChallenges?.overall_status) === "fragile"),
      {
        name: "generation_brief_compliance",
        overall_status:
          blockingItems.some((item) => item.type === "generation_brief_compliance")
            ? "fragile"
            : cautionItems.some((item) => item.type === "generation_brief_compliance")
              ? "guarded"
              : "trusted",
        reject: blockingItems.some((item) => item.type === "generation_brief_compliance"),
        summary: blockingItems.find((item) => item.type === "generation_brief_compliance")?.label
          || cautionItems.find((item) => item.type === "generation_brief_compliance")?.label
          || "The plan stayed aligned with the ranked generation brief.",
      },
    ],
  };
}
