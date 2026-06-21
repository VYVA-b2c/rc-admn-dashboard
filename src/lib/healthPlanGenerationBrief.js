const SECTION_DEFINITIONS = [
  { section_key: "goals_json", label: "Goals" },
  { section_key: "daily_support_json", label: "Daily support" },
  { section_key: "monitoring_json", label: "Monitoring" },
  { section_key: "escalation_json", label: "Escalation" },
  { section_key: "caregiver_guidance_json", label: "Caregiver guidance" },
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

function sectionLabel(sectionKey) {
  return SECTION_DEFINITIONS.find((item) => item.section_key === sectionKey)?.label || text(sectionKey) || "Section";
}

function priorityScore(value) {
  if (value === "high") return 3;
  if (value === "medium") return 2;
  return 1;
}

function responseWindowScore(value) {
  if (value === "today") return 3;
  if (value === "this_week") return 2;
  return 1;
}

function keywordTags(value) {
  const haystack = lower(value);
  const tags = new Set();
  if (/\brisk|predictive|forecast|score|decline\b/.test(haystack)) tags.add("risk");
  if (/\balert|urgent|safety|reach|unreachable|answer|escalat/.test(haystack)) tags.add("alert");
  if (/\bmedication|adherence|reminder|dose|pill\b/.test(haystack)) tags.add("medication");
  if (/\bmonitor|monitoring\b/.test(haystack)) tags.add("monitoring");
  if (/\bsensor|device|battery|reporting|offline|fall\b/.test(haystack)) tags.add("sensor");
  if (/\bcheck-in|check in|brain coach|service|routine|schedule|follow-up|touchpoint|outreach\b/.test(haystack)) tags.add("service");
  if (/\bcaregiver|family|consent|sharing|care circle|provider\b/.test(haystack)) tags.add("care-circle");
  if (/\bcontext|living|language|city\b/.test(haystack)) tags.add("context");
  return tags;
}

function sectionFocusTags(sectionKey) {
  if (sectionKey === "goals_json") return new Set(["risk", "medication", "service", "care-circle", "context"]);
  if (sectionKey === "daily_support_json") return new Set(["medication", "service", "care-circle", "context"]);
  if (sectionKey === "monitoring_json") return new Set(["risk", "alert", "sensor", "medication", "service", "monitoring"]);
  if (sectionKey === "escalation_json") return new Set(["risk", "alert", "sensor", "medication", "monitoring"]);
  if (sectionKey === "caregiver_guidance_json") return new Set(["care-circle", "alert", "risk", "service", "context"]);
  return new Set();
}

function signalCategoryLookup(sourceSignals = []) {
  return new Map(
    (Array.isArray(sourceSignals) ? sourceSignals : [])
      .map((signal) => {
        const id = text(signal?.id);
        if (!id) return null;
        return [id, lower(signal?.category) || "context"];
      })
      .filter(Boolean),
  );
}

function normalizeTargetSections(targetSections = []) {
  const requested = unique(targetSections).filter((sectionKey) => SECTION_DEFINITIONS.some((item) => item.section_key === sectionKey));
  return requested.length ? requested : SECTION_DEFINITIONS.map((item) => item.section_key);
}

function relatedToSection(sectionKey, {
  sectionKeyHint = null,
  textParts = [],
  categories = [],
  sourceSignalIds = [],
  signalCategories = new Map(),
} = {}) {
  if (text(sectionKeyHint) === sectionKey) return true;
  const tags = keywordTags((Array.isArray(textParts) ? textParts : []).filter(Boolean).join(" "));
  for (const category of Array.isArray(categories) ? categories : []) {
    if (text(category)) tags.add(lower(category));
  }
  for (const signalId of unique(sourceSignalIds)) {
    const category = signalCategories.get(signalId);
    if (category) tags.add(category);
  }
  const focus = sectionFocusTags(sectionKey);
  return [...tags].some((tag) => focus.has(tag));
}

function inferSectionKeys(item, signalCategories, sectionKeys) {
  return sectionKeys.filter((sectionKey) => relatedToSection(sectionKey, {
    sectionKeyHint: item?.section_key,
    textParts: [item?.label, item?.detail, item?.why_it_matters, item?.summary, item?.reason],
    categories: [item?.category],
    sourceSignalIds: item?.source_signal_ids,
    signalCategories,
  }));
}

function categoryToSections(category, sectionKeys) {
  const normalized = lower(category);
  return sectionKeys.filter((sectionKey) => {
    const focus = sectionFocusTags(sectionKey);
    if (normalized === "medication") {
      return focus.has("medication") || focus.has("monitoring");
    }
    if (normalized === "service") {
      return focus.has("service") || focus.has("monitoring");
    }
    if (normalized === "care-circle") {
      return focus.has("care-circle") || focus.has("context");
    }
    if (normalized === "alert") {
      return focus.has("alert") || focus.has("monitoring");
    }
    if (normalized === "risk") {
      return focus.has("risk");
    }
    if (normalized === "context") {
      return focus.has("context");
    }
    return focus.has(normalized);
  });
}

function pushRankedSignal(list, next) {
  const signalId = text(next?.signal_id);
  const focus = text(next?.focus);
  if (!signalId || !focus) return;
  const existingIndex = list.findIndex((item) => text(item?.signal_id) === signalId && text(item?.focus) === focus);
  if (existingIndex === -1) {
    list.push({
      ...next,
      section_keys: unique(next?.section_keys),
      source_signal_ids: unique(next?.source_signal_ids),
    });
    return;
  }
  const existing = list[existingIndex];
  existing.rank = Math.max(Number(existing.rank || 0), Number(next.rank || 0));
  if (priorityScore(text(next.priority)) > priorityScore(text(existing.priority))) existing.priority = next.priority;
  if (responseWindowScore(text(next.response_window)) > responseWindowScore(text(existing.response_window))) existing.response_window = next.response_window;
  existing.section_keys = unique([...(existing.section_keys || []), ...(next.section_keys || [])]);
  existing.source_signal_ids = unique([...(existing.source_signal_ids || []), ...(next.source_signal_ids || [])]);
  existing.why_now = existing.why_now || next.why_now;
}

function pushUniqueText(list, next) {
  const label = text(next?.label);
  if (!label) return;
  if (list.some((item) => text(item?.label) === label)) return;
  list.push({
    ...next,
    source_signal_ids: unique(next?.source_signal_ids),
  });
}

function guardrailRank(item) {
  return Number.isFinite(Number(item?.rank)) ? Number(item.rank) : 0;
}

function normalizePriority(value) {
  if (value === "high" || value === "medium") return value;
  return "low";
}

function normalizeResponseWindow(value) {
  if (value === "today" || value === "this_week") return value;
  return "ongoing";
}

function authorityRank(value) {
  if (value === "highest") return 4;
  if (value === "high") return 3;
  if (value === "medium") return 2;
  return 1;
}

function rewriteGuidanceForAction(action, reason) {
  const normalized = lower(action);
  if (normalized === "retire") {
    return text(reason)
      ? `Replace this routine instead of carrying it forward unchanged. ${text(reason)}`
      : "Replace this routine with a different action grounded in stronger live evidence.";
  }
  if (normalized === "verify") {
    return text(reason)
      ? `Keep this recommendation verification-led and conditional. ${text(reason)}`
      : "Keep this recommendation verification-led with explicit checks and fallback steps.";
  }
  return text(reason)
    ? `Rewrite this recommendation around the stronger live evidence now. ${text(reason)}`
    : "Rewrite this recommendation around the stronger live evidence now instead of copying it forward.";
}

function priorityFromReasons(reasons = []) {
  const highest = (Array.isArray(reasons) ? reasons : [])
    .map((item) => lower(item?.severity))
    .sort((left, right) => priorityScore(right) - priorityScore(left))[0];
  return normalizePriority(highest);
}

function summarizeGlobalFocus(prioritySignals = [], writingGuardrails = []) {
  const focusLabels = prioritySignals.slice(0, 3).map((item) => item.label).filter(Boolean);
  const guardrail = text(writingGuardrails[0]);
  if (focusLabels.length && guardrail) {
    return `Lead with ${focusLabels.join(", ")}, then keep the plan cautious enough to respect this pressure: ${guardrail}`;
  }
  if (focusLabels.length) {
    return `Lead with ${focusLabels.join(", ")} before using broader background context.`;
  }
  return "Lead with the strongest live operational signals, keep verification explicit where the record is thin, and do not recycle stale routines unchanged.";
}

function evidenceCategoryHint(item = {}) {
  const sourceType = lower(item?.source_type);
  if (sourceType === "live_alerts") return "alert";
  if (sourceType === "live_sensors") return "sensor";
  if (sourceType === "live_medication") return "medication";
  if (sourceType === "predictive") return "risk";
  if (sourceType === "service_state" || sourceType === "observed_activity") return "service";
  if (sourceType === "staff_feedback") return "service";
  if (sourceType === "profile_context") return "context";
  return sourceType || "context";
}

function relatedEvidenceSections(item, signalCategories, sectionKeys) {
  const directSection = text(item?.section_key);
  if (directSection && sectionKeys.includes(directSection)) return [directSection];
  return inferSectionKeys({
    section_key: directSection || null,
    label: item?.label,
    detail: item?.reason,
    category: evidenceCategoryHint(item),
    source_signal_ids: [item?.id],
  }, signalCategories, sectionKeys);
}

function evidenceDecisionForItem(item = {}) {
  const freshness = lower(item?.freshness_status);
  const authority = lower(item?.authority_level);
  const sourceType = lower(item?.source_type);
  if (freshness === "stale") return "stale_watchout";
  if (["staff_feedback", "observed_activity", "live_alerts", "live_sensors", "live_medication"].includes(sourceType)) {
    return authorityRank(authority) >= authorityRank("medium") ? "trust_now" : "verify_before_reuse";
  }
  if (sourceType === "service_state" || sourceType === "predictive") return "verify_before_reuse";
  return "support_only";
}

function evidenceDecisionRank(item = {}, decision = "support_only") {
  const base =
    decision === "trust_now" ? 90
      : decision === "verify_before_reuse" ? 70
        : decision === "stale_watchout" ? 64
          : 44;
  return base + Number(item?.priority_score || 0);
}

function summarizeEvidenceDecisionMap(map = null) {
  const trustLabels = (Array.isArray(map?.trust_now) ? map.trust_now : []).slice(0, 2).map((item) => item.label).filter(Boolean);
  const verifyLabels = (Array.isArray(map?.verify_before_reuse) ? map.verify_before_reuse : []).slice(0, 2).map((item) => item.label).filter(Boolean);
  const staleLabels = (Array.isArray(map?.stale_watchouts) ? map.stale_watchouts : []).slice(0, 2).map((item) => item.label).filter(Boolean);
  if (trustLabels.length && verifyLabels.length) {
    return `Trust ${trustLabels.join(" and ")} first, keep ${verifyLabels.join(" and ")} verification-led, and do not let weaker background context settle those decisions too early.`;
  }
  if (trustLabels.length && staleLabels.length) {
    return `Trust ${trustLabels.join(" and ")} first, and treat ${staleLabels.join(" and ")} as aging evidence that should not override fresher pressure without re-checking it.`;
  }
  if (trustLabels.length) {
    return `Trust ${trustLabels.join(" and ")} first before using broader background context.`;
  }
  return "Use the freshest, highest-authority evidence first, keep medium-authority evidence verification-led, and treat stale or background context as supporting rather than decisive.";
}

function benchmarkSectionPriority(item = {}) {
  if (item?.same_day_response_required) return { priority: "high", response_window: "today" };
  const requiredTimings = Array.isArray(item?.required_timings) ? item.required_timings : [];
  if (requiredTimings.some((timing) => lower(timing?.timing) === "today")) {
    return { priority: "high", response_window: "today" };
  }
  if (requiredTimings.some((timing) => lower(timing?.timing) === "this_week")) {
    return { priority: "medium", response_window: "this_week" };
  }
  return { priority: "medium", response_window: "ongoing" };
}

function benchmarkSectionKeywords(item = {}, sectionKey) {
  const keywordEntry = (Array.isArray(item?.section_keywords) ? item.section_keywords : [])
    .find((entry) => text(entry?.section_key) === sectionKey);
  return unique(keywordEntry?.keywords);
}

function benchmarkTimingForSection(item = {}, sectionKey) {
  return (Array.isArray(item?.required_timings) ? item.required_timings : [])
    .find((entry) => text(entry?.section_key) === sectionKey);
}

function executionActionPriority(item = {}) {
  const responseWindow = lower(item?.response_window);
  const priority = lower(item?.priority);
  return {
    priority: priority === "high" ? "high" : priority === "medium" ? "medium" : responseWindow === "today" ? "high" : "medium",
    response_window: responseWindow === "today" ? "today" : responseWindow === "this_week" ? "this_week" : "ongoing",
  };
}

function buildSectionEvidenceStrategy(state) {
  const trustNow = unique(state?.decision_lead_evidence_ids);
  const verify = unique(state?.verification_evidence_ids);
  const stale = unique(state?.stale_evidence_ids);
  const supportOnly = unique(state?.supporting_evidence_ids);
  if (trustNow.length && verify.length) {
    return "Lead with the freshest high-authority evidence, keep the medium-authority signals verification-led, and do not let supporting context smooth over the pressure.";
  }
  if (trustNow.length && stale.length) {
    return "Lead with the fresher evidence and treat older or aging proof as background context unless staff re-confirm it.";
  }
  if (verify.length) {
    return "Write this section in a verification-led way because the main signals are useful but not strong enough to sound settled.";
  }
  if (supportOnly.length) {
    return "Use the available evidence mainly to shape tone, feasibility, and support structure rather than to make strong claims.";
  }
  return null;
}

export function buildHealthPlanGenerationBrief({
  sourceSignals = [],
  signalTriage = null,
  evidenceHierarchy = [],
  evidencePack = null,
  reviewPriorities = null,
  clinicalCautions = [],
  recommendationRepairBrief = null,
  clientResponseMemory = null,
  recommendationEffectiveness = null,
  recommendationChallenges = null,
  benchmarkGuidance = null,
  executionBrief = null,
  reviewRemediation = null,
  cohortGuidance = null,
  liveEvidenceSummary = null,
  longitudinalMemory = null,
  refreshStrategy = null,
  targetSections = [],
} = {}) {
  const sectionKeys = normalizeTargetSections(targetSections);
  const signalCategories = signalCategoryLookup(sourceSignals);
  const rankedSignals = [];
  const sectionStates = new Map(
    sectionKeys.map((sectionKey) => [sectionKey, {
      section_key: sectionKey,
      section_label: sectionLabel(sectionKey),
      priority: "low",
      response_window: "ongoing",
      why_now: null,
      must_address_signal_ids: [],
      verify_signal_ids: [],
      preserve_signal_ids: [],
      decision_lead_evidence_ids: [],
      verification_evidence_ids: [],
      supporting_evidence_ids: [],
      stale_evidence_ids: [],
      evidence_strategy: null,
      rewrite_recommendations: [],
      preserve_recommendations: [],
      guardrails: [],
    }]),
  );

  for (const fact of Array.isArray(evidencePack?.must_address_facts) ? evidencePack.must_address_facts : []) {
    const signalId = text(fact?.signal_id) || unique(fact?.source_signal_ids)[0];
    if (!signalId) continue;
    const relatedSections = inferSectionKeys(fact, signalCategories, sectionKeys);
    pushRankedSignal(rankedSignals, {
      signal_id: signalId,
      label: text(fact?.label) || signalId,
      focus: "act_now",
      rank: 90 + (priorityScore(text(fact?.priority)) * 6) + (normalizeResponseWindow(text(fact?.response_window)) === "today" ? 4 : 0),
      priority: normalizePriority(text(fact?.priority)),
      response_window: normalizeResponseWindow(text(fact?.response_window)),
      why_now: text(fact?.why_it_matters) || "This should shape the plan directly.",
      section_keys: relatedSections,
      source_signal_ids: unique(fact?.source_signal_ids?.length ? fact.source_signal_ids : [signalId]),
    });
  }

  for (const fact of Array.isArray(evidencePack?.verification_needs) ? evidencePack.verification_needs : []) {
    const signalId = text(fact?.signal_id) || unique(fact?.source_signal_ids)[0] || text(fact?.id) || text(fact?.label);
    if (!signalId) continue;
    const relatedSections = inferSectionKeys(fact, signalCategories, sectionKeys);
    pushRankedSignal(rankedSignals, {
      signal_id: signalId,
      label: text(fact?.label) || signalId,
      focus: "verify",
      rank: 72 + (priorityScore(text(fact?.priority || fact?.severity)) * 5) + (normalizeResponseWindow(text(fact?.response_window)) === "today" ? 4 : 0),
      priority: normalizePriority(text(fact?.priority || fact?.severity)),
      response_window: normalizeResponseWindow(text(fact?.response_window)),
      why_now: text(fact?.why_it_matters) || "The plan should verify this explicitly before sounding too certain.",
      section_keys: relatedSections,
      source_signal_ids: unique(fact?.source_signal_ids),
    });
  }

  for (const fact of Array.isArray(evidencePack?.stabilizing_facts) ? evidencePack.stabilizing_facts : []) {
    const signalId = text(fact?.signal_id) || unique(fact?.source_signal_ids)[0];
    if (!signalId) continue;
    const relatedSections = inferSectionKeys(fact, signalCategories, sectionKeys);
    pushRankedSignal(rankedSignals, {
      signal_id: signalId,
      label: text(fact?.label) || signalId,
      focus: "stabilize",
      rank: 56 + (priorityScore(text(fact?.priority)) * 4),
      priority: normalizePriority(text(fact?.priority)),
      response_window: normalizeResponseWindow(text(fact?.response_window)),
      why_now: text(fact?.why_it_matters) || "This looks like a routine worth preserving when it still fits the live picture.",
      section_keys: relatedSections,
      source_signal_ids: unique(fact?.source_signal_ids?.length ? fact.source_signal_ids : [signalId]),
    });
  }

  const evidenceDecisionBuckets = {
    trust_now: [],
    verify_before_reuse: [],
    support_only: [],
    stale_watchouts: [],
  };
  for (const evidenceItem of Array.isArray(evidenceHierarchy) ? evidenceHierarchy : []) {
    const decision = evidenceDecisionForItem(evidenceItem);
    const relatedSections = relatedEvidenceSections(evidenceItem, signalCategories, sectionKeys);
    const compact = {
      id: text(evidenceItem?.id),
      label: text(evidenceItem?.label) || text(evidenceItem?.id),
      authority_level: text(evidenceItem?.authority_level) || "supporting",
      source_type: text(evidenceItem?.source_type) || "context",
      freshness_status: text(evidenceItem?.freshness_status) || null,
      priority_score: Number.isFinite(Number(evidenceItem?.priority_score)) ? Number(evidenceItem.priority_score) : 0,
      reason: text(evidenceItem?.reason) || null,
      rank: evidenceDecisionRank(evidenceItem, decision),
      section_keys: relatedSections,
    };
    if (!compact.id || !compact.label || !compact.reason) continue;
    if (decision === "trust_now") {
      evidenceDecisionBuckets.trust_now.push(compact);
    } else if (decision === "verify_before_reuse") {
      evidenceDecisionBuckets.verify_before_reuse.push(compact);
    } else if (decision === "stale_watchout") {
      evidenceDecisionBuckets.stale_watchouts.push(compact);
    } else {
      evidenceDecisionBuckets.support_only.push(compact);
    }
    for (const sectionKey of relatedSections) {
      const state = sectionStates.get(sectionKey);
      if (!state) continue;
      if (decision === "trust_now") {
        state.decision_lead_evidence_ids = unique([...state.decision_lead_evidence_ids, compact.id]);
      } else if (decision === "verify_before_reuse") {
        state.verification_evidence_ids = unique([...state.verification_evidence_ids, compact.id]);
      } else if (decision === "stale_watchout") {
        state.stale_evidence_ids = unique([...state.stale_evidence_ids, compact.id]);
      } else {
        state.supporting_evidence_ids = unique([...state.supporting_evidence_ids, compact.id]);
      }
    }
  }

  const reviewPriorityLookup = new Map(
    (Array.isArray(reviewPriorities?.sections) ? reviewPriorities.sections : [])
      .map((section) => [text(section?.section_key), section])
      .filter(([sectionKey]) => sectionStates.has(sectionKey)),
  );

  for (const [sectionKey, state] of sectionStates.entries()) {
    const review = reviewPriorityLookup.get(sectionKey) || null;
    if (review) {
      state.priority = normalizePriority(text(review?.priority));
      state.response_window = normalizeResponseWindow(text(review?.response_window));
      state.why_now = text(review?.why_now) || text(review?.summary) || null;
      for (const reason of Array.isArray(review?.reasons) ? review.reasons.slice(0, 3) : []) {
        pushUniqueText(state.guardrails, {
          label: text(reason?.label) || "Review this area closely.",
          source_signal_ids: unique(review?.source_signal_ids),
        });
      }
    }
  }

  for (const benchmark of Array.isArray(benchmarkGuidance?.items) ? benchmarkGuidance.items : []) {
    const requiredSections = unique(benchmark?.required_sections).filter((sectionKey) => sectionStates.has(sectionKey));
    const priorityHint = benchmarkSectionPriority(benchmark);
    for (const sectionKey of requiredSections) {
      const state = sectionStates.get(sectionKey);
      if (!state) continue;
      pushUniqueText(state.guardrails, {
        label: `Matched benchmark archetype ${text(benchmark?.case_label) || text(benchmark?.case_id) || "guidance"} expects this section to stay explicit and operationally complete.`,
        source_signal_ids: [],
      });
      const keywords = benchmarkSectionKeywords(benchmark, sectionKey);
      if (keywords.length > 0) {
        pushUniqueText(state.guardrails, {
          label: `Keep this section centered on ${keywords.join(", ")} because the closest benchmark pattern relies on those cues.`,
          source_signal_ids: [],
        });
      }
      const requiredTiming = benchmarkTimingForSection(benchmark, sectionKey);
      if (requiredTiming?.timing) {
        pushUniqueText(state.guardrails, {
          label: `The closest benchmark pattern expects ${text(requiredTiming.timing).replace("_", " ")} timing here, so avoid flattening this into routine follow-up.`,
          source_signal_ids: [],
        });
      }
      if (benchmark?.require_verification_language) {
        pushUniqueText(state.guardrails, {
          label: "Keep this section explicitly verification-led because the closest benchmark pattern treats confirmation language as essential here.",
          source_signal_ids: [],
        });
      }
      if (priorityScore(priorityHint.priority) > priorityScore(state.priority)) {
        state.priority = priorityHint.priority;
      }
      if (responseWindowScore(priorityHint.response_window) > responseWindowScore(state.response_window)) {
        state.response_window = priorityHint.response_window;
      }
    }
  }

  for (const action of Array.isArray(executionBrief?.actions) ? executionBrief.actions : []) {
    const sectionKeys = unique([action?.section_key, ...(Array.isArray(action?.section_keys) ? action.section_keys : [])])
      .filter((sectionKey) => sectionStates.has(sectionKey));
    const priorityHint = executionActionPriority(action);
    for (const sectionKey of sectionKeys) {
      const state = sectionStates.get(sectionKey);
      if (!state) continue;
      pushUniqueText(state.guardrails, {
        label: `Make this section handoff-ready because the prior execution brief elevated it: ${text(action?.action_text) || text(action?.why_now) || "keep the next step explicit."}`,
        rank: 72,
        source_signal_ids: unique(action?.source_signal_ids),
      });
      if (action?.verification_required === true) {
        pushUniqueText(state.guardrails, {
          label: "Keep this section verification-led until staff can confirm the live outcome.",
          rank: 88,
          source_signal_ids: unique(action?.source_signal_ids),
        });
      }
      if (text(action?.completion_signal)) {
        pushUniqueText(state.guardrails, {
          label: `Name what closes the loop here: ${text(action.completion_signal)}`,
          rank: 74,
          source_signal_ids: unique(action?.source_signal_ids),
        });
      }
      if (text(action?.fallback_owner_role)) {
        pushUniqueText(state.guardrails, {
          label: `If the first step fails, make the fallback owner explicit here (${text(action.fallback_owner_role).replaceAll("_", " ")}).`,
          rank: 78,
          source_signal_ids: unique(action?.source_signal_ids),
        });
      }
      if (priorityScore(priorityHint.priority) > priorityScore(state.priority)) {
        state.priority = priorityHint.priority;
      }
      if (responseWindowScore(priorityHint.response_window) > responseWindowScore(state.response_window)) {
        state.response_window = priorityHint.response_window;
      }
    }
  }

  for (const gap of Array.isArray(executionBrief?.gaps) ? executionBrief.gaps : []) {
    const sectionKey = text(gap?.section_key);
    const state = sectionStates.get(sectionKey);
    if (!state) continue;
    pushUniqueText(state.guardrails, {
      label: text(gap?.label) || "Fix the previous execution gap directly in this section.",
      rank: 96,
      source_signal_ids: [],
    });
    if (priorityScore(normalizePriority(lower(gap?.severity))) > priorityScore(state.priority)) {
      state.priority = normalizePriority(lower(gap?.severity));
    }
  }

  for (const action of Array.isArray(reviewRemediation?.actions) ? reviewRemediation.actions : []) {
    const sectionKeys = unique(action?.section_keys).filter((sectionKey) => sectionStates.has(sectionKey));
    if (!sectionKeys.length) continue;
    for (const sectionKey of sectionKeys) {
      const state = sectionStates.get(sectionKey);
      if (!state) continue;
      pushUniqueText(state.guardrails, {
        label: `Previous review remediation still points here: ${text(action?.title) || "refresh this section decisively."}`,
        rank: 92,
        source_signal_ids: [],
      });
      for (const reason of Array.isArray(action?.reasons) ? action.reasons.slice(0, 2) : []) {
        pushUniqueText(state.guardrails, {
          label: text(reason),
          rank: 84,
          source_signal_ids: [],
        });
      }
      if (priorityScore(normalizePriority(lower(action?.priority))) > priorityScore(state.priority)) {
        state.priority = normalizePriority(lower(action?.priority));
      }
    }
  }

  for (const contradiction of Array.isArray(evidencePack?.contradictions) ? evidencePack.contradictions : []) {
    for (const sectionKey of sectionKeys) {
      if (!relatedToSection(sectionKey, {
        sectionKeyHint: contradiction?.section_key,
        textParts: [contradiction?.summary, contradiction?.detail, contradiction?.staff_action],
        sourceSignalIds: contradiction?.source_signal_ids,
        signalCategories,
      })) continue;
      const state = sectionStates.get(sectionKey);
      pushUniqueText(state.guardrails, {
        label: text(contradiction?.summary) || "Resolve the conflicting evidence explicitly.",
        source_signal_ids: unique(contradiction?.source_signal_ids),
      });
      if (!state.why_now) state.why_now = text(contradiction?.staff_action) || text(contradiction?.summary) || null;
    }
  }

  for (const caution of Array.isArray(clinicalCautions) ? clinicalCautions : []) {
    for (const sectionKey of sectionKeys) {
      const sections = unique(caution?.section_keys);
      const applies = sections.includes(sectionKey) || relatedToSection(sectionKey, {
        textParts: [caution?.label, caution?.why_it_matters],
        sourceSignalIds: caution?.signal_ids,
        signalCategories,
      });
      if (!applies) continue;
      const state = sectionStates.get(sectionKey);
      pushUniqueText(state.guardrails, {
        label: text(caution?.label) || "Respond explicitly to this clinical caution.",
        source_signal_ids: unique(caution?.signal_ids),
      });
      if (priorityScore(normalizePriority(lower(caution?.severity))) > priorityScore(state.priority)) {
        state.priority = normalizePriority(lower(caution?.severity));
      }
    }
  }

  for (const item of Array.isArray(recommendationRepairBrief?.items) ? recommendationRepairBrief.items : []) {
    const sectionKey = text(item?.section_key);
    if (!sectionStates.has(sectionKey)) continue;
    const state = sectionStates.get(sectionKey);
    const action = lower(item?.recommended_action);
    if (action === "preserve") {
      pushUniqueText(state.preserve_recommendations, {
        label: text(item?.text) || "Preserve the strongest existing routine.",
        reason: text(item?.reason) || null,
        source_signal_ids: unique(item?.source_signal_ids),
      });
      continue;
    }
    pushUniqueText(state.rewrite_recommendations, {
      label: text(item?.text) || "Rewrite this recommendation.",
      action,
      reason: text(item?.reason) || null,
      rewrite_guidance: text(item?.rewrite_guidance) || null,
      source_signal_ids: unique(item?.source_signal_ids),
    });
    if (priorityScore(text(item?.priority)) > priorityScore(state.priority)) {
      state.priority = normalizePriority(text(item?.priority));
    }
  }

  for (const item of Array.isArray(recommendationEffectiveness?.preserve_now) ? recommendationEffectiveness.preserve_now : []) {
    const relatedSections = inferSectionKeys(item, signalCategories, sectionKeys);
    for (const sectionKey of relatedSections) {
      const state = sectionStates.get(sectionKey);
      if (!state) continue;
      pushUniqueText(state.preserve_recommendations, {
        label: text(item?.text) || "Preserve the strongest proven routine.",
        reason: text(item?.action_reason) || text(item?.reason) || null,
        preserve_strength: text(item?.preserve_strength) || null,
        source_signal_ids: unique(item?.source_signal_ids),
      });
      if (!state.why_now && text(item?.action_reason)) state.why_now = text(item.action_reason);
    }
  }

  for (const item of [
    ...(Array.isArray(recommendationEffectiveness?.rework_now) ? recommendationEffectiveness.rework_now : []),
    ...(Array.isArray(recommendationEffectiveness?.retire_now) ? recommendationEffectiveness.retire_now : []),
  ]) {
    const relatedSections = inferSectionKeys(item, signalCategories, sectionKeys);
    for (const sectionKey of relatedSections) {
      const state = sectionStates.get(sectionKey);
      if (!state) continue;
      const action = lower(item?.action) || "rework";
      pushUniqueText(state.rewrite_recommendations, {
        label: text(item?.text) || "Rewrite this recommendation.",
        action,
        reason: text(item?.action_reason) || text(item?.reason) || null,
        repair_strength: text(item?.repair_strength) || null,
        rewrite_guidance: rewriteGuidanceForAction(action, text(item?.action_reason) || text(item?.reason)),
        source_signal_ids: unique(item?.source_signal_ids),
      });
      if (action === "retire" || action === "verify") {
        state.priority = priorityScore("high") > priorityScore(state.priority) ? "high" : state.priority;
      } else if (priorityScore("medium") > priorityScore(state.priority)) {
        state.priority = "medium";
      }
    }
  }

  for (const item of Array.isArray(recommendationChallenges?.items) ? recommendationChallenges.items : []) {
    const sectionKey = text(item?.section_key);
    const state = sectionStates.get(sectionKey);
    if (!state || lower(item?.challenge_status) === "supported") continue;
    const challengeSummary = text(item?.why_it_is_questioned);
    const saferReframe = text(item?.safer_reframe);
    if (challengeSummary) {
      pushUniqueText(state.guardrails, {
        label: challengeSummary,
        source_signal_ids: unique(item?.source_signal_ids),
      });
    }
    if (saferReframe) {
      pushUniqueText(state.rewrite_recommendations, {
        label: text(item?.text) || "Rewrite this recommendation more cautiously.",
        action: lower(item?.challenge_status) === "challenged" ? "rework" : "verify",
        reason: challengeSummary || null,
        repair_strength: item?.high_risk ? "must_rewrite" : "prefer_verify",
        rewrite_guidance: saferReframe,
        source_signal_ids: unique(item?.source_signal_ids),
      });
    }
    if (item?.high_risk) {
      state.priority = priorityScore("high") > priorityScore(state.priority) ? "high" : state.priority;
    } else if (priorityScore("medium") > priorityScore(state.priority)) {
      state.priority = "medium";
    }
  }

  for (const anchor of Array.isArray(clientResponseMemory?.strongest_anchors) ? clientResponseMemory.strongest_anchors : []) {
    const relatedSections = categoryToSections(anchor?.category, sectionKeys);
    const label = text(anchor?.labels?.[0]) || text(anchor?.category) || "this routine family";
    for (const sectionKey of relatedSections) {
      const state = sectionStates.get(sectionKey);
      if (!state) continue;
      pushUniqueText(state.guardrails, {
        label: `Lean on ${label} when it still matches the live picture; this is one of the client's strongest response anchors.`,
        source_signal_ids: [],
      });
    }
  }

  for (const anchor of Array.isArray(clientResponseMemory?.fragile_anchors) ? clientResponseMemory.fragile_anchors : []) {
    const relatedSections = categoryToSections(anchor?.category, sectionKeys);
    const label = text(anchor?.labels?.[0]) || text(anchor?.category) || "this routine family";
    for (const sectionKey of relatedSections) {
      const state = sectionStates.get(sectionKey);
      if (!state) continue;
      pushUniqueText(state.guardrails, {
        label: `Treat ${label} as fragile for this client; keep the wording verification-led and avoid assuming follow-through.`,
        source_signal_ids: [],
      });
      if (priorityScore("medium") > priorityScore(state.priority)) {
        state.priority = "medium";
      }
    }
  }

  for (const section of Array.isArray(cohortGuidance?.section_guidance) ? cohortGuidance.section_guidance : []) {
    const sectionKey = text(section?.section_key);
    const state = sectionStates.get(sectionKey);
    if (!state) continue;
    for (const label of Array.isArray(section?.reinforce) ? section.reinforce : []) {
      pushUniqueText(state.guardrails, {
        label,
        source_signal_ids: [],
      });
    }
    for (const label of Array.isArray(section?.avoid) ? section.avoid : []) {
      pushUniqueText(state.guardrails, {
        label,
        source_signal_ids: [],
      });
      if (priorityScore("medium") > priorityScore(state.priority)) {
        state.priority = "medium";
      }
    }
  }

  const rankedForSections = rankedSignals
    .sort((left, right) => Number(right.rank || 0) - Number(left.rank || 0))
    .slice(0, 12);

  for (const signal of rankedForSections) {
    for (const sectionKey of signal.section_keys || []) {
      const state = sectionStates.get(sectionKey);
      if (!state) continue;
      if (signal.focus === "act_now") {
        state.must_address_signal_ids = unique([...state.must_address_signal_ids, signal.signal_id]);
      } else if (signal.focus === "verify") {
        state.verify_signal_ids = unique([...state.verify_signal_ids, signal.signal_id]);
      } else if (signal.focus === "stabilize") {
        state.preserve_signal_ids = unique([...state.preserve_signal_ids, signal.signal_id]);
      }
    }
  }

  for (const refresh of Array.isArray(refreshStrategy?.recommended_sections) ? refreshStrategy.recommended_sections : []) {
    const sectionKey = text(refresh?.section_key);
    const state = sectionStates.get(sectionKey);
    if (!state) continue;
    for (const reason of Array.isArray(refresh?.reasons) ? refresh.reasons.slice(0, 2) : []) {
      pushUniqueText(state.guardrails, {
        label: text(reason) || "This section should be refreshed first.",
        source_signal_ids: [],
      });
    }
  }

  const writingGuardrails = [];
  if (Boolean(evidencePack?.same_day_response_required)) {
    writingGuardrails.push("Write the summary, monitoring, and escalation guidance as same-day coordination, not routine follow-up.");
  }
  if (lower(liveEvidenceSummary?.contact_pressure?.status) === "pressure") {
    writingGuardrails.push("Do not assume the client is reachable; add concrete fallback steps when first contact fails.");
  }
  if (lower(liveEvidenceSummary?.medication_adherence?.status) === "pressure") {
    writingGuardrails.push("Treat medication guidance as fragile enough to need explicit verification and follow-through.");
  }
  if (lower(liveEvidenceSummary?.sensor_reliability?.status) === "pressure") {
    writingGuardrails.push("Do not lean on sensor reassurance without naming the current alert or device uncertainty.");
  }
  if (Array.isArray(clientResponseMemory?.strongest_anchors) && clientResponseMemory.strongest_anchors.length > 0) {
    const anchor = clientResponseMemory.strongest_anchors[0];
    const label = text(anchor?.labels?.[0]) || text(anchor?.category) || "the strongest response anchors";
    writingGuardrails.push(`Prefer routines that resemble ${label} when the live evidence still supports them, because this client has responded better there.`);
  }
  if (Array.isArray(clientResponseMemory?.fragile_anchors) && clientResponseMemory.fragile_anchors.length > 0) {
    const anchor = clientResponseMemory.fragile_anchors[0];
    const label = text(anchor?.labels?.[0]) || text(anchor?.category) || "the fragile categories";
    writingGuardrails.push(`Keep ${label} cautious and verification-led, because this client has shown weaker follow-through there.`);
  }
  if (Array.isArray(recommendationEffectiveness?.preserve_now) && recommendationEffectiveness.preserve_now.length > 0) {
    writingGuardrails.push("Protect the routines that have already helped this client instead of rewriting them for novelty.");
  }
  if (Array.isArray(recommendationEffectiveness?.retire_now) && recommendationEffectiveness.retire_now.length > 0) {
    writingGuardrails.push("Do not let failed or repeatedly unresolved routines come back unchanged just because they sound familiar.");
  }
  if (Array.isArray(recommendationChallenges?.items) && recommendationChallenges.items.some((item) => lower(item?.challenge_status) === "challenged" && item?.high_risk)) {
    writingGuardrails.push("Rewrite high-risk recommendations that still sound too optimistic, too thin, or missing a fallback before staff rely on them.");
  }
  if (Array.isArray(evidenceDecisionBuckets.stale_watchouts) && evidenceDecisionBuckets.stale_watchouts.length > 0) {
    writingGuardrails.push("Treat stale evidence as background context unless fresher staff or live operational evidence still supports it.");
  }
  if (Array.isArray(evidenceDecisionBuckets.verify_before_reuse) && evidenceDecisionBuckets.verify_before_reuse.length > 0) {
    writingGuardrails.push("Keep medium-authority or predictive evidence verification-led instead of writing as if it already proves the routine is safe.");
  }
  if (Number(longitudinalMemory?.persistent_count || 0) > 0) {
    writingGuardrails.push("Treat recurring pressure as a persistent pattern, not a one-off that can be solved with optimistic wording.");
  }
  if (lower(refreshStrategy?.overall_status) === "full_refresh") {
    writingGuardrails.push("Rebuild the plan decisively instead of lightly polishing older wording.");
  }
  if (Array.isArray(benchmarkGuidance?.items) && benchmarkGuidance.items.length > 0) {
    const topBenchmark = benchmarkGuidance.items[0];
    writingGuardrails.push(
      `Use the matched benchmark archetype ${text(topBenchmark?.case_label) || text(topBenchmark?.case_id) || "guidance"} as a drafting backstop for timing, verification, and support continuity.`,
    );
    if (topBenchmark?.require_verification_language) {
      writingGuardrails.push("Matched benchmark patterns expect explicit verification language, so do not let the draft sound settled too early.");
    }
    if (topBenchmark?.same_day_response_required) {
      writingGuardrails.push("Matched benchmark patterns expect same-day response language, so keep timing, ownership, and fallback explicit.");
    }
  }
  if (Array.isArray(executionBrief?.actions) && executionBrief.actions.length > 0) {
    writingGuardrails.push("Keep the draft operationally handoff-ready: name the next owner, verification step, completion signal, and fallback path where pressure is active.");
  }
  if (Array.isArray(executionBrief?.gaps) && executionBrief.gaps.length > 0) {
    writingGuardrails.push("Repair the execution gaps from the prior plan directly instead of assuming staff will fill them in later.");
  }
  if (Array.isArray(reviewRemediation?.actions) && reviewRemediation.actions.length > 0) {
    writingGuardrails.push("Treat the prior review remediation actions as a concrete fix list for the next draft, not just background commentary.");
  }
  if (Array.isArray(cohortGuidance?.guardrails) && cohortGuidance.guardrails.length > 0) {
    writingGuardrails.push(...cohortGuidance.guardrails.slice(0, 3));
  }

  const sectionBriefs = [...sectionStates.values()].map((state) => ({
    ...state,
    priority: normalizePriority(text(state.priority)),
    response_window: normalizeResponseWindow(text(state.response_window)),
    evidence_strategy: buildSectionEvidenceStrategy(state),
    guardrails: [...state.guardrails]
      .sort((left, right) => guardrailRank(right) - guardrailRank(left))
      .slice(0, 4),
    preserve_recommendations: state.preserve_recommendations.slice(0, 3),
    rewrite_recommendations: state.rewrite_recommendations.slice(0, 3),
  }));

  const evidenceDecisionMap = {
    summary: summarizeEvidenceDecisionMap(evidenceDecisionBuckets),
    trust_now: evidenceDecisionBuckets.trust_now.sort((left, right) => Number(right.rank || 0) - Number(left.rank || 0)).slice(0, 4),
    verify_before_reuse: evidenceDecisionBuckets.verify_before_reuse.sort((left, right) => Number(right.rank || 0) - Number(left.rank || 0)).slice(0, 4),
    support_only: evidenceDecisionBuckets.support_only.sort((left, right) => Number(right.rank || 0) - Number(left.rank || 0)).slice(0, 4),
    stale_watchouts: evidenceDecisionBuckets.stale_watchouts.sort((left, right) => Number(right.rank || 0) - Number(left.rank || 0)).slice(0, 4),
  };

  return {
    summary: summarizeGlobalFocus(rankedForSections, writingGuardrails),
    same_day_response_required: Boolean(evidencePack?.same_day_response_required),
    target_sections: sectionKeys,
    benchmark_guidance: benchmarkGuidance || null,
    execution_brief: executionBrief || null,
    review_remediation: reviewRemediation || null,
    cohort_guidance: cohortGuidance || null,
    evidence_decision_map: evidenceDecisionMap,
    priority_signals: rankedForSections,
    section_briefs: sectionBriefs,
    writing_guardrails: unique(writingGuardrails).slice(0, 6),
  };
}
