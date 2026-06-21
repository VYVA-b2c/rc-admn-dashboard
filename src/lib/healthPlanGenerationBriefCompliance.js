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

function priorityWeight(value) {
  if (value === "high") return 18;
  if (value === "medium") return 10;
  return 5;
}

function canonicalText(value) {
  return lower(value).replace(/[^a-z0-9]+/g, " ").trim();
}

function significantWords(value) {
  return canonicalText(value)
    .split(" ")
    .filter((word) => word.length >= 5);
}

function items(plan, sectionKey) {
  return Array.isArray(plan?.[sectionKey]) ? plan[sectionKey] : [];
}

function sectionTexts(plan, sectionKey) {
  return items(plan, sectionKey).map((item) => text(item?.text)).filter(Boolean);
}

function hasVerificationLanguage(value) {
  return /\b(verify|verification|confirm|check|re-check|recheck|follow up|follow-up|monitor|review|do not assume)\b/i.test(text(value));
}

function hasTimingLanguage(value) {
  return /\b(today|same day|immediately|right away|now|before end of day|this morning|this afternoon|within \d+ (hour|hours|day|days)|this week)\b/i.test(text(value));
}

function hasConcreteActionLanguage(value) {
  return /\b(call|contact|reach|respond|escalat|confirm|review|dispatch|re-check|recheck|check|notify|share|report)\b/i.test(text(value));
}

function itemMatchesSignal(item, signalId) {
  return unique(item?.source_signal_ids).includes(text(signalId));
}

function sectionItemsReferenceAnySignal(sectionItems = [], signalIds = []) {
  const normalizedSignalIds = unique(signalIds);
  if (!normalizedSignalIds.length) return false;
  return (Array.isArray(sectionItems) ? sectionItems : []).some((item) =>
    normalizedSignalIds.some((signalId) => itemMatchesSignal(item, signalId))
  );
}

function hasStructuredVerification(sectionItems = []) {
  return (Array.isArray(sectionItems) ? sectionItems : []).some((item) => item?.verification_required === true);
}

function hasHighPressureResponse(sectionItems = [], combinedText = "") {
  const normalizedItems = Array.isArray(sectionItems) ? sectionItems : [];
  const structuredUrgency = normalizedItems.some((item) =>
    lower(item?.timing) === "today"
    || lower(item?.priority) === "high"
    || item?.verification_required === true
  );
  return structuredUrgency || (hasTimingLanguage(combinedText) && (hasConcreteActionLanguage(combinedText) || hasVerificationLanguage(combinedText)));
}

function textLooksPreserved(nextText, priorText) {
  const nextCanonical = canonicalText(nextText);
  const priorCanonical = canonicalText(priorText);
  if (!nextCanonical || !priorCanonical) return false;
  if (nextCanonical === priorCanonical) return true;
  const priorWords = significantWords(priorCanonical);
  if (!priorWords.length) return false;
  const overlap = priorWords.filter((word) => nextCanonical.includes(word)).length;
  return overlap >= Math.min(2, priorWords.length);
}

function buildIssue(type, sectionKey, severity, message) {
  return {
    type,
    section_key: text(sectionKey) || null,
    severity,
    message: text(message) || null,
  };
}

export function findHealthPlanGenerationBriefIssues(plan, generationBrief = null) {
  const normalizedPlan = objectValue(plan);
  const brief = objectValue(generationBrief);
  if (!normalizedPlan || !brief) return [];

  const issues = [];
  const prioritySignals = Array.isArray(brief.priority_signals) ? brief.priority_signals : [];
  const sectionBriefs = Array.isArray(brief.section_briefs) ? brief.section_briefs : [];

  const summarySignalIds = unique(normalizedPlan?.summary_signal_ids);
  const topActNowSignals = prioritySignals
    .filter((item) => text(item?.focus) === "act_now")
    .slice(0, 2);
  if (topActNowSignals.length && !topActNowSignals.some((item) => summarySignalIds.includes(text(item?.signal_id)))) {
    issues.push(buildIssue(
      "summary_missed_priority_signal",
      "summary",
      brief?.same_day_response_required ? "high" : "medium",
      "The summary did not stay anchored in the strongest act-now signals from the generation brief.",
    ));
  }

  for (const section of sectionBriefs) {
    const sectionKey = text(section?.section_key);
    if (!sectionKey) continue;
    const sectionItems = items(normalizedPlan, sectionKey);
    const combinedText = sectionTexts(normalizedPlan, sectionKey).join(" ");
    const highPressure =
      normalizePriority(lower(section?.priority)) === "high"
      || normalizeResponseWindow(lower(section?.response_window)) === "today";

    if (Array.isArray(section?.must_address_signal_ids) && section.must_address_signal_ids.length > 0) {
      const covered = sectionItems.some((item) =>
        unique(section.must_address_signal_ids).some((signalId) => itemMatchesSignal(item, signalId))
      );
      if (!covered) {
        issues.push(buildIssue(
          "section_missed_priority_signal",
          sectionKey,
          highPressure ? "high" : "medium",
          `${text(section?.section_label) || sectionKey} did not directly use the act-now signals assigned to it in the generation brief.`,
        ));
      }
    }

    if (Array.isArray(section?.verify_signal_ids) && section.verify_signal_ids.length > 0) {
      const covered = sectionItems.some((item) =>
        unique(section.verify_signal_ids).some((signalId) => itemMatchesSignal(item, signalId))
        && (item?.verification_required === true || hasVerificationLanguage(item?.text))
      );
      if (!covered) {
        issues.push(buildIssue(
          "section_missed_verification_signal",
          sectionKey,
          highPressure ? "high" : "medium",
          `${text(section?.section_label) || sectionKey} did not turn its verify-first signals into explicit verification language.`,
        ));
      }
    }

    if (Array.isArray(section?.verification_evidence_ids) && section.verification_evidence_ids.length > 0) {
      const covered =
        sectionItemsReferenceAnySignal(sectionItems, section.verification_evidence_ids)
        || hasStructuredVerification(sectionItems)
        || hasVerificationLanguage(combinedText);
      if (!covered) {
        issues.push(buildIssue(
          "section_missed_verification_evidence",
          sectionKey,
          highPressure ? "high" : "medium",
          `${text(section?.section_label) || sectionKey} did not treat its medium-authority evidence as verification-led guidance.`,
        ));
      }
    }

    if (Array.isArray(section?.stale_evidence_ids) && section.stale_evidence_ids.length > 0) {
      const staleHandled =
        hasStructuredVerification(sectionItems)
        || hasVerificationLanguage(combinedText);
      if (!staleHandled) {
        issues.push(buildIssue(
          "section_stale_evidence_underplayed",
          sectionKey,
          highPressure ? "high" : "medium",
          `${text(section?.section_label) || sectionKey} treated aging evidence too much like current truth instead of re-checking it.`,
        ));
      }
    }

    if (Array.isArray(section?.decision_lead_evidence_ids) && section.decision_lead_evidence_ids.length > 0 && highPressure) {
      const leadResponseShown = hasHighPressureResponse(sectionItems, combinedText);
      if (!leadResponseShown) {
        issues.push(buildIssue(
          "section_lead_evidence_underplayed",
          sectionKey,
          "high",
          `${text(section?.section_label) || sectionKey} did not clearly reflect the lead evidence pressure in its action, timing, or verification wording.`,
        ));
      }
    }

    for (const preserved of Array.isArray(section?.preserve_recommendations) ? section.preserve_recommendations : []) {
      const preservedSignalIds = unique(preserved?.source_signal_ids);
      const covered = sectionItems.some((item) =>
        preservedSignalIds.some((signalId) => itemMatchesSignal(item, signalId))
        || textLooksPreserved(item?.text, preserved?.label)
      );
      if (!covered) {
        const preserveSeverity =
          lower(preserved?.preserve_strength) === "must_preserve" || highPressure
            ? "high"
            : "medium";
        issues.push(buildIssue(
          "preserve_recommendation_dropped",
          sectionKey,
          preserveSeverity,
          preserveSeverity === "high"
            ? `${text(section?.section_label) || sectionKey} dropped a strongly proven routine that the brief marked as important to preserve.`
            : `${text(section?.section_label) || sectionKey} dropped a routine the brief marked worth preserving without carrying its core support pattern forward clearly.`,
        ));
      }
    }

    for (const rewrite of Array.isArray(section?.rewrite_recommendations) ? section.rewrite_recommendations : []) {
      const unchanged = sectionItems.some((item) => canonicalText(item?.text) === canonicalText(rewrite?.label));
      if (unchanged) {
        const action = lower(rewrite?.action);
        const repairSeverity = lower(rewrite?.repair_strength);
        issues.push(buildIssue(
          "rewrite_recommendation_returned_unchanged",
          sectionKey,
          action === "retire" || highPressure || repairSeverity.startsWith("must_") ? "high" : "medium",
          `${text(section?.section_label) || sectionKey} carried a ${action || "rewrite"} recommendation forward unchanged even though the brief said to rewrite or replace it.`,
        ));
      }
      if (lower(rewrite?.action) === "verify") {
        const verifyCovered = sectionItems.some((item) =>
          textLooksPreserved(item?.text, rewrite?.label)
          && (item?.verification_required === true || hasVerificationLanguage(item?.text))
        );
        if (!verifyCovered) {
          issues.push(buildIssue(
            "verify_recommendation_not_softened",
            sectionKey,
            lower(rewrite?.repair_strength) === "must_verify" || highPressure ? "high" : "medium",
            `${text(section?.section_label) || sectionKey} kept a recommendation that should be verify-first without making the wording explicitly cautious.`,
          ));
        }
      }
    }

    if (highPressure && !sectionItems.length) {
      issues.push(buildIssue(
        "high_priority_section_empty",
        sectionKey,
        "high",
        `${text(section?.section_label) || sectionKey} is high pressure in the generation brief but the generated section is empty.`,
      ));
    }

    if (highPressure && Array.isArray(section?.guardrails) && section.guardrails.length > 0) {
      const needsVerification = unique(section?.verify_signal_ids).length > 0;
      if (needsVerification && !hasVerificationLanguage(combinedText) && !sectionItems.some((item) => item?.verification_required === true)) {
        issues.push(buildIssue(
          "high_priority_guardrail_underplayed",
          sectionKey,
          "medium",
          `${text(section?.section_label) || sectionKey} stayed too certain for the level of caution the generation brief called for.`,
        ));
      }
    }
  }

  return issues.slice(0, 10);
}

export function shouldRejectHealthPlanGenerationBriefIssues(issues = []) {
  const normalized = Array.isArray(issues) ? issues : [];
  const highCount = normalized.filter((item) => text(item?.severity) === "high").length;
  if (highCount > 0) return true;
  const mediumWeight = normalized.reduce((total, item) => total + priorityWeight(text(item?.severity)), 0);
  return mediumWeight >= 25;
}
