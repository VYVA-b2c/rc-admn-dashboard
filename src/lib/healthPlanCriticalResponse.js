const SECTION_LABELS = {
  summary: "Summary",
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

function unique(values) {
  return [...new Set((Array.isArray(values) ? values : []).map((value) => text(value)).filter(Boolean))];
}

function normalizeSeverity(value) {
  if (value === "high" || value === "medium") return value;
  return "low";
}

function normalizeResponseWindow(value) {
  if (value === "today" || value === "this_week") return value;
  return "ongoing";
}

function severityRank(value) {
  if (value === "high") return 3;
  if (value === "medium") return 2;
  return 1;
}

function responseWindowRank(value) {
  if (value === "today") return 3;
  if (value === "this_week") return 2;
  return 1;
}

function normalizeSignal(signal) {
  if (!signal || typeof signal !== "object") return null;
  const id = text(signal.id);
  if (!id) return null;
  return {
    id,
    label: text(signal.label) || id,
    detail: text(signal.detail) || null,
    category: lower(signal.category) || "context",
    strength: ["high", "medium", "low"].includes(lower(signal.strength)) ? lower(signal.strength) : "medium",
  };
}

function signalById(sourceSignals = []) {
  return new Map(
    (Array.isArray(sourceSignals) ? sourceSignals : [])
      .map(normalizeSignal)
      .filter(Boolean)
      .map((signal) => [signal.id, signal]),
  );
}

function itemRefs(item) {
  return unique(item?.source_signal_ids);
}

function items(plan, sectionKey) {
  return Array.isArray(plan?.[sectionKey]) ? plan[sectionKey] : [];
}

function validOwnerRole(value) {
  const normalized = lower(value);
  return ["assigned_staff", "caregiver", "on_call_coordinator", "care_team"].includes(normalized)
    ? normalized
    : null;
}

function categoryForSignalIds(signalIds = [], byId = new Map()) {
  const categories = unique(signalIds.map((signalId) => byId.get(signalId)?.category));
  if (categories.includes("alert")) return "alert";
  if (categories.includes("medication")) return "medication";
  if (categories.includes("sensor")) return "sensor";
  if (categories.includes("care-circle")) return "care-circle";
  if (categories.includes("service")) return "service";
  if (categories.includes("risk")) return "risk";
  return categories[0] || "context";
}

function chooseOwnerRole({
  category = "context",
  severity = "medium",
  responseWindow = "ongoing",
  hasCareProviders = true,
  preferred = null,
} = {}) {
  if (validOwnerRole(preferred)) return validOwnerRole(preferred);
  if (category === "care-circle" && hasCareProviders) return "caregiver";
  if ((category === "alert" || category === "risk") && (severity === "high" || responseWindow === "today")) {
    return "on_call_coordinator";
  }
  return "assigned_staff";
}

function chooseFallbackOwnerRole({
  category = "context",
  severity = "medium",
  responseWindow = "ongoing",
  hasCareProviders = true,
  preferred = null,
} = {}) {
  if (validOwnerRole(preferred)) return validOwnerRole(preferred);
  if (category === "care-circle" && hasCareProviders) return "care_team";
  if (severity === "high" || responseWindow === "today") return "on_call_coordinator";
  return "care_team";
}

function defaultCompletionSignal(category, responseWindow) {
  if (category === "medication") {
    return responseWindow === "today"
      ? "Close the loop by documenting whether doses were confirmed today, what stayed unclear, and whether escalation was triggered."
      : "Document whether medication follow-up was confirmed and what still needs checking.";
  }
  if (category === "care-circle") {
    return "Close the loop once the caregiver or support contact reports back and the next staff step is logged.";
  }
  if (category === "sensor") {
    return "Close the loop by documenting what the sensor check confirmed and whether fallback follow-up was activated.";
  }
  if (category === "alert" || category === "risk") {
    return "Close the loop once the responder confirms the outcome and the fallback path is either activated or ruled out.";
  }
  return responseWindow === "today"
    ? "Close the loop by documenting what was confirmed today, what remains uncertain, and what happens next."
    : "Document the confirmed outcome and any next follow-up step.";
}

function defaultFocusTags(category, label = "", detail = "") {
  const haystack = lower(`${label} ${detail}`);
  const tags = [];
  if (category === "medication" || /\bmedication|dose|adherence|reminder|pill\b/.test(haystack)) {
    tags.push("medication", "dose", "adherence", "confirm");
  }
  if (category === "care-circle" || /\bcaregiver|family|care circle|support contact\b/.test(haystack)) {
    tags.push("caregiver", "report back", "contact");
  }
  if (category === "sensor" || /\bsensor|device|offline|battery|fall detector\b/.test(haystack)) {
    tags.push("sensor", "device", "check", "confirm");
  }
  if (category === "alert" || /\balert|unreachable|reach|call|contact|welfare\b/.test(haystack)) {
    tags.push("contact", "reach", "call", "alert");
  }
  if (category === "risk" || /\brisk|forecast|decline|worsen\b/.test(haystack)) {
    tags.push("risk", "monitor", "escalate", "today");
  }
  if (/\bdizz|fall|mobility|balance|walker|safe\b/.test(haystack)) {
    tags.push("dizziness", "fall", "mobility", "safe");
  }
  return unique(tags);
}

function pushContract(contracts, next) {
  const id = text(next?.id);
  if (!id) return;
  const existing = contracts.find((item) => item.id === id);
  if (!existing) {
    contracts.push({
      ...next,
      signal_ids: unique(next?.signal_ids),
      required_section_keys: unique(next?.required_section_keys),
      focus_tags: unique(next?.focus_tags),
    });
    return;
  }

  existing.severity = severityRank(next.severity) > severityRank(existing.severity) ? next.severity : existing.severity;
  existing.response_window = responseWindowRank(next.response_window) > responseWindowRank(existing.response_window)
    ? next.response_window
    : existing.response_window;
  existing.signal_ids = unique([...(existing.signal_ids || []), ...(next.signal_ids || [])]);
  existing.required_section_keys = unique([...(existing.required_section_keys || []), ...(next.required_section_keys || [])]);
  existing.focus_tags = unique([...(existing.focus_tags || []), ...(next.focus_tags || [])]);
  existing.label = existing.label || next.label;
  existing.why_now = existing.why_now || next.why_now;
  existing.completion_signal = existing.completion_signal || next.completion_signal;
  existing.owner_role = existing.owner_role || next.owner_role;
  existing.fallback_owner_role = existing.fallback_owner_role || next.fallback_owner_role;
  existing.verification_required = existing.verification_required === true || next.verification_required === true;
}

function contractFromCaution(caution, {
  byId,
  hasCareProviders,
  escalationGrade,
} = {}) {
  const signalIds = unique(caution?.signal_ids);
  const category = categoryForSignalIds(signalIds, byId);
  const severity = normalizeSeverity(lower(caution?.severity) || (lower(escalationGrade?.grade) === "urgent" ? "high" : "medium"));
  const responseWindow = severity === "high" || lower(escalationGrade?.grade) === "urgent" ? "today" : "this_week";
  return {
    id: text(caution?.id),
    label: text(caution?.label) || "Critical response step",
    why_now: text(caution?.guidance) || text(caution?.detail) || "The live record needs an explicit safety response path here.",
    severity,
    response_window: responseWindow,
    signal_ids: signalIds,
    required_section_keys: unique(caution?.section_keys),
    owner_role: chooseOwnerRole({ category, severity, responseWindow, hasCareProviders }),
    fallback_owner_role: chooseFallbackOwnerRole({ category, severity, responseWindow, hasCareProviders }),
    verification_required: responseWindow === "today" || severity === "high",
    completion_signal: defaultCompletionSignal(category, responseWindow),
    focus_tags: defaultFocusTags(category, caution?.label, caution?.detail),
    category,
  };
}

function contractFromFact(fact, {
  byId,
  hasCareProviders,
  escalationGrade,
} = {}) {
  const signalIds = unique(fact?.source_signal_ids);
  if (!signalIds.length) return null;
  const category = categoryForSignalIds(signalIds, byId);
  const severity = normalizeSeverity(lower(fact?.severity) || lower(fact?.priority) || (lower(escalationGrade?.grade) === "urgent" ? "high" : "medium"));
  const responseWindow = normalizeResponseWindow(lower(fact?.response_window) || (severity === "high" ? "today" : "this_week"));
  const requiredSections = responseWindow === "today"
    ? ["monitoring_json", "escalation_json"]
    : category === "care-circle"
      ? ["monitoring_json", "caregiver_guidance_json"]
      : ["monitoring_json"];
  return {
    id: `fact:${signalIds[0]}`,
    label: text(fact?.label) || signalIds[0],
    why_now: text(fact?.why_it_matters) || text(fact?.detail) || "This is one of the strongest live facts in the current record.",
    severity,
    response_window: responseWindow,
    signal_ids: signalIds,
    required_section_keys: requiredSections,
    owner_role: chooseOwnerRole({ category, severity, responseWindow, hasCareProviders }),
    fallback_owner_role: chooseFallbackOwnerRole({ category, severity, responseWindow, hasCareProviders }),
    verification_required: responseWindow === "today" || severity !== "low",
    completion_signal: defaultCompletionSignal(category, responseWindow),
    focus_tags: defaultFocusTags(category, fact?.label, fact?.detail || fact?.why_it_matters),
    category,
  };
}

function contractSort(left, right) {
  const byWindow = responseWindowRank(right?.response_window) - responseWindowRank(left?.response_window);
  if (byWindow !== 0) return byWindow;
  const bySeverity = severityRank(right?.severity) - severityRank(left?.severity);
  if (bySeverity !== 0) return bySeverity;
  return text(left?.label).localeCompare(text(right?.label));
}

export function buildHealthPlanCriticalResponseBrief({
  sourceSignals = [],
  evidencePack = null,
  escalationGrade = null,
  clinicalCautions = [],
  careProviders = [],
} = {}) {
  const byId = signalById(sourceSignals);
  const hasCareProviders = Array.isArray(careProviders) && careProviders.length > 0;
  const contracts = [];

  for (const caution of Array.isArray(clinicalCautions) ? clinicalCautions : []) {
    const contract = contractFromCaution(caution, {
      byId,
      hasCareProviders,
      escalationGrade,
    });
    if (contract) pushContract(contracts, contract);
  }

  for (const fact of Array.isArray(evidencePack?.must_address_facts) ? evidencePack.must_address_facts : []) {
    const severity = normalizeSeverity(lower(fact?.severity) || lower(fact?.priority));
    const responseWindow = normalizeResponseWindow(lower(fact?.response_window));
    if (severity !== "high" && responseWindow !== "today") continue;
    const contract = contractFromFact(fact, {
      byId,
      hasCareProviders,
      escalationGrade,
    });
    if (contract) pushContract(contracts, contract);
  }

  const sortedContracts = contracts.sort(contractSort).slice(0, 6);
  const sameDayCount = sortedContracts.filter((item) => item.response_window === "today").length;
  const highSeverityCount = sortedContracts.filter((item) => item.severity === "high").length;
  const overallStatus =
    sameDayCount > 0 || lower(escalationGrade?.grade) === "urgent"
      ? "same_day"
      : highSeverityCount > 0 || lower(escalationGrade?.grade) === "heightened"
        ? "this_week"
        : "routine";
  const summary =
    overallStatus === "same_day"
      ? "These are the non-negotiable same-day safety response contracts the generated plan must carry forward explicitly."
      : overallStatus === "this_week"
        ? "These are the higher-pressure response contracts the generated plan should keep explicit this week."
        : "These are the main response contracts that should stay grounded in the generated plan.";

  return {
    overall_status: overallStatus,
    summary,
    same_day_count: sameDayCount,
    high_severity_count: highSeverityCount,
    contracts: sortedContracts,
  };
}

function matchingItems(plan, contract) {
  const signalIds = new Set(unique(contract?.signal_ids));
  const focusTags = unique(contract?.focus_tags).map((tag) => lower(tag));
  return unique(contract?.required_section_keys)
    .filter((sectionKey) => sectionKey !== "summary")
    .flatMap((sectionKey) =>
    items(plan, sectionKey)
      .map((item) => ({
        section_key: sectionKey,
        item,
      }))
      .filter(({ item }) => {
        const refs = itemRefs(item);
        const direct = refs.some((signalId) => signalIds.has(signalId));
        if (direct) return true;
        const haystack = lower(text(item?.text));
        return focusTags.some((tag) => tag && haystack.includes(tag));
      }),
  );
}

function makeIssue(type, contract, sectionKey, severity, message) {
  return {
    type,
    contract_id: text(contract?.id) || null,
    contract_label: text(contract?.label) || null,
    section_key: sectionKey || null,
    severity: normalizeSeverity(severity),
    message,
  };
}

function topSameDayContracts(brief) {
  return (Array.isArray(brief?.contracts) ? brief.contracts : [])
    .filter((contract) => contract?.response_window === "today")
    .sort(contractSort)
    .slice(0, 2);
}

export function findHealthPlanCriticalResponseIssues(plan, criticalResponseBrief = null) {
  if (!plan || typeof plan !== "object") return [];
  const brief = criticalResponseBrief && typeof criticalResponseBrief === "object" ? criticalResponseBrief : null;
  if (!brief) return [];

  const issues = [];
  const contracts = Array.isArray(brief.contracts) ? brief.contracts : [];
  const summarySignalIds = new Set(unique(plan?.summary_signal_ids));

  for (const contract of contracts) {
    const requiredSections = unique(contract?.required_section_keys);
    const matches = matchingItems(plan, contract);
    if (!matches.length) {
      issues.push(makeIssue(
        "response_contract_missing",
        contract,
        requiredSections[0] || null,
        contract?.response_window === "today" || contract?.severity === "high" ? "high" : "medium",
        `The plan did not carry forward the life-safety response contract for "${text(contract?.label) || "this critical response"}".`,
      ));
      continue;
    }

    for (const sectionKey of requiredSections.filter((value) => value !== "summary")) {
      const sectionMatches = matches.filter((item) => item.section_key === sectionKey);
      if (sectionMatches.length === 0) {
        issues.push(makeIssue(
          "response_contract_section_missing",
          contract,
          sectionKey,
          contract?.response_window === "today" ? "high" : "medium",
          `${SECTION_LABELS[sectionKey] || sectionKey} did not carry the response contract for "${text(contract?.label)}".`,
        ));
      }
    }

    if (contract?.response_window === "today") {
      const timeCovered = matches.some(({ item }) => lower(item?.timing) === "today" || lower(item?.priority) === "high");
      if (!timeCovered) {
        issues.push(makeIssue(
          "response_contract_timing_missing",
          contract,
          matches[0]?.section_key || requiredSections[0] || null,
          "high",
          `The plan mentioned "${text(contract?.label)}" but did not keep its same-day urgency explicit.`,
        ));
      }
    }

    if (contract?.verification_required === true) {
      const verified = matches.some(({ item }) => item?.verification_required === true);
      if (!verified) {
        issues.push(makeIssue(
          "response_contract_verification_missing",
          contract,
          matches[0]?.section_key || requiredSections[0] || null,
          contract?.response_window === "today" ? "high" : "medium",
          `The plan carried "${text(contract?.label)}" without marking it as an active verification contract.`,
        ));
      }
    }

    const hasOwner = matches.some(({ item }) => validOwnerRole(item?.owner_role));
    if (!hasOwner) {
      issues.push(makeIssue(
        "response_contract_owner_missing",
        contract,
        matches[0]?.section_key || requiredSections[0] || null,
        contract?.response_window === "today" ? "high" : "medium",
        `The plan carried "${text(contract?.label)}" without clearly assigning who acts next.`,
      ));
    }

    if (validOwnerRole(contract?.fallback_owner_role)) {
      const hasFallback = matches.some(({ item }) => validOwnerRole(item?.fallback_owner_role));
      if (!hasFallback) {
        issues.push(makeIssue(
          "response_contract_fallback_missing",
          contract,
          matches.find((item) => item.section_key === "escalation_json")?.section_key || matches[0]?.section_key || requiredSections[0] || null,
          contract?.response_window === "today" ? "high" : "medium",
          `The plan carried "${text(contract?.label)}" without a dependable fallback route if the first response path fails.`,
        ));
      }
    }

    const hasCompletion = matches.some(({ item }) => text(item?.completion_signal));
    if (!hasCompletion) {
      issues.push(makeIssue(
        "response_contract_close_loop_missing",
        contract,
        matches[0]?.section_key || requiredSections[0] || null,
        "medium",
        `The plan carried "${text(contract?.label)}" without saying what closes the loop.`,
      ));
    }
  }

  for (const contract of topSameDayContracts(brief)) {
    if (!unique(contract?.signal_ids).some((signalId) => summarySignalIds.has(signalId))) {
      issues.push(makeIssue(
        "response_contract_summary_missing",
        contract,
        "summary",
        "high",
        `The summary did not stay anchored in the same-day response contract for "${text(contract?.label)}".`,
      ));
    }
  }

  return issues;
}
