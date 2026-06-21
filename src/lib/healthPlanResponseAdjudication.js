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

function items(plan, sectionKey) {
  return Array.isArray(plan?.[sectionKey]) ? plan[sectionKey] : [];
}

function itemRefs(item) {
  return unique(item?.source_signal_ids);
}

function intersects(left = [], right = []) {
  const rightSet = new Set(unique(right));
  return unique(left).some((value) => rightSet.has(value));
}

function validSection(sectionKey) {
  return ["monitoring_json", "escalation_json"].includes(text(sectionKey));
}

function scoreSignalPriority(prioritySignal = {}, index = 0) {
  const responseWindow = normalizeResponseWindow(lower(prioritySignal?.response_window));
  const priority = lower(prioritySignal?.priority);
  let score = Math.max(0, 120 - (index * 8));
  if (text(prioritySignal?.focus) === "act_now") score += 40;
  if (responseWindow === "today") score += 35;
  if (priority === "high") score += 18;
  if (priority === "medium") score += 8;
  return score;
}

function rankBySignalId(prioritySignals = []) {
  const lookup = new Map();
  (Array.isArray(prioritySignals) ? prioritySignals : []).forEach((item, index) => {
    const signalId = text(item?.signal_id);
    if (!signalId) return;
    const score = scoreSignalPriority(item, index);
    const existing = Number(lookup.get(signalId) || 0);
    if (score > existing) lookup.set(signalId, score);
  });
  return lookup;
}

function contractScore(contract, signalRanks) {
  const responseWindow = normalizeResponseWindow(lower(contract?.response_window));
  const severity = normalizeSeverity(lower(contract?.severity));
  const signalIds = unique(contract?.signal_ids);
  const signalRank = signalIds.reduce((best, signalId) => Math.max(best, Number(signalRanks.get(signalId) || 0)), 0);
  let score = signalRank;
  score += responseWindow === "today" ? 60 : responseWindow === "this_week" ? 24 : 0;
  score += severity === "high" ? 30 : severity === "medium" ? 12 : 0;
  score += signalIds.length >= 2 ? 6 : 0;
  return score;
}

function sortContracts(contracts = [], signalRanks = new Map()) {
  return [...(Array.isArray(contracts) ? contracts : [])].sort((left, right) => {
    const byScore = contractScore(right, signalRanks) - contractScore(left, signalRanks);
    if (byScore !== 0) return byScore;
    const byWindow = responseWindowRank(normalizeResponseWindow(lower(right?.response_window))) - responseWindowRank(normalizeResponseWindow(lower(left?.response_window)));
    if (byWindow !== 0) return byWindow;
    const bySeverity = severityRank(normalizeSeverity(lower(right?.severity))) - severityRank(normalizeSeverity(lower(left?.severity)));
    if (bySeverity !== 0) return bySeverity;
    return text(left?.label).localeCompare(text(right?.label));
  });
}

function sectionLeads(contracts = [], sectionKey) {
  return contracts.filter((contract) => unique(contract?.required_section_keys).includes(sectionKey)).slice(0, 2);
}

function firstActNowSignals(prioritySignals = []) {
  return (Array.isArray(prioritySignals) ? prioritySignals : [])
    .filter((item) => text(item?.focus) === "act_now")
    .sort((left, right) => scoreSignalPriority(right, 0) - scoreSignalPriority(left, 0))
    .slice(0, 3);
}

export function buildHealthPlanResponseAdjudicationBrief({
  generationBrief = null,
  criticalResponseBrief = null,
} = {}) {
  const prioritySignals = Array.isArray(generationBrief?.priority_signals) ? generationBrief.priority_signals : [];
  const signalRanks = rankBySignalId(prioritySignals);
  const contracts = sortContracts(criticalResponseBrief?.contracts || [], signalRanks);
  const actNowSignals = firstActNowSignals(prioritySignals);
  const summaryAnchorSignalIds = unique([
    ...actNowSignals.slice(0, 2).map((item) => item?.signal_id),
    ...unique(contracts[0]?.signal_ids).slice(0, 1),
  ]).slice(0, 3);
  const primarySummarySignalIds = unique(contracts[0]?.signal_ids).slice(0, 2);
  const monitoringLeads = sectionLeads(contracts, "monitoring_json");
  const escalationLeads = sectionLeads(contracts, "escalation_json");
  const sameDayContractIds = contracts.filter((item) => normalizeResponseWindow(lower(item?.response_window)) === "today").map((item) => text(item?.id)).filter(Boolean);

  return {
    summary: sameDayContractIds.length
      ? "Lead the plan with the highest-risk same-day response contracts first, then keep secondary risks visible without displacing the primary action path."
      : "Lead the plan with the strongest response contracts first rather than treating all risks as equally urgent.",
    same_day_response_required: Boolean(generationBrief?.same_day_response_required) || sameDayContractIds.length > 0,
    primary_summary_signal_ids: primarySummarySignalIds,
    summary_anchor_signal_ids: summaryAnchorSignalIds,
    monitoring_lead_contracts: monitoringLeads.map((contract, index) => ({
      rank: index + 1,
      contract_id: text(contract?.id),
      label: text(contract?.label),
      signal_ids: unique(contract?.signal_ids),
      response_window: normalizeResponseWindow(lower(contract?.response_window)),
      severity: normalizeSeverity(lower(contract?.severity)),
    })),
    escalation_lead_contracts: escalationLeads.map((contract, index) => ({
      rank: index + 1,
      contract_id: text(contract?.id),
      label: text(contract?.label),
      signal_ids: unique(contract?.signal_ids),
      response_window: normalizeResponseWindow(lower(contract?.response_window)),
      severity: normalizeSeverity(lower(contract?.severity)),
    })),
    same_day_contract_ids: sameDayContractIds,
  };
}

function makeIssue(type, sectionKey, severity, message, contract = null) {
  return {
    type,
    section_key: sectionKey,
    severity,
    message,
    contract_id: text(contract?.contract_id) || null,
    contract_label: text(contract?.label) || null,
  };
}

function checkLeadOrdering(plan, sectionKey, leadContracts = []) {
  const sectionItems = items(plan, sectionKey);
  const issues = [];
  if (!sectionItems.length || !Array.isArray(leadContracts) || leadContracts.length === 0) return issues;

  const firstItem = sectionItems[0];
  const firstRefs = itemRefs(firstItem);

  const primaryLead = leadContracts[0];
  if (primaryLead && !intersects(firstRefs, primaryLead.signal_ids)) {
    issues.push(makeIssue(
      "lead_contract_not_first",
      sectionKey,
      primaryLead.response_window === "today" ? "high" : "medium",
      `${sectionKey} did not lead with the most urgent response contract first: "${text(primaryLead.label)}".`,
      primaryLead,
    ));
  }

  if (primaryLead && primaryLead.response_window === "today") {
    const firstTiming = normalizeResponseWindow(lower(firstItem?.timing));
    const firstPriority = lower(firstItem?.priority);
    if (firstTiming !== "today" && firstPriority !== "high") {
      issues.push(makeIssue(
        "lead_contract_timing_underplayed",
        sectionKey,
        "high",
        `${sectionKey} mentioned "${text(primaryLead.label)}" without keeping its same-day priority visibly first.`,
        primaryLead,
      ));
    }
  }

  const secondaryLead = leadContracts[1];
  if (secondaryLead) {
    const firstTwoItems = sectionItems.slice(0, 2);
    const secondaryCoveredEarly = firstTwoItems.some((item) => intersects(itemRefs(item), secondaryLead.signal_ids));
    if (!secondaryCoveredEarly) {
      issues.push(makeIssue(
        "secondary_contract_buried",
        sectionKey,
        secondaryLead.response_window === "today" ? "high" : "medium",
        `${sectionKey} pushed the secondary high-risk response contract too far down instead of surfacing it near the top: "${text(secondaryLead.label)}".`,
        secondaryLead,
      ));
    }
  }

  return issues;
}

export function findHealthPlanResponseAdjudicationIssues(plan, responseAdjudicationBrief = null) {
  if (!plan || typeof plan !== "object" || !responseAdjudicationBrief || typeof responseAdjudicationBrief !== "object") {
    return [];
  }

  const issues = [];
  const summarySignalIds = unique(plan?.summary_signal_ids);
  const primarySummarySignalIds = unique(responseAdjudicationBrief?.primary_summary_signal_ids);
  const summaryAnchors = unique(responseAdjudicationBrief?.summary_anchor_signal_ids);

  if (primarySummarySignalIds.length > 0 && !intersects(summarySignalIds, primarySummarySignalIds)) {
    issues.push(makeIssue(
      "summary_lead_signal_missing",
      "summary",
      responseAdjudicationBrief?.same_day_response_required ? "high" : "medium",
      "The summary did not stay anchored in the primary action-driving signal for this case.",
    ));
  } else if (summaryAnchors.length > 0 && !intersects(summarySignalIds, summaryAnchors)) {
    issues.push(makeIssue(
      "summary_lead_signal_missing",
      "summary",
      responseAdjudicationBrief?.same_day_response_required ? "high" : "medium",
      "The summary did not lead with the strongest action-driving signals in this case.",
    ));
  }

  issues.push(
    ...checkLeadOrdering(plan, "monitoring_json", responseAdjudicationBrief?.monitoring_lead_contracts || []),
    ...checkLeadOrdering(plan, "escalation_json", responseAdjudicationBrief?.escalation_lead_contracts || []),
  );

  return issues.slice(0, 8);
}
