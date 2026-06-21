function text(value) {
  return String(value || "").trim();
}

function lower(value) {
  return text(value).toLowerCase();
}

function unique(values) {
  return [...new Set((Array.isArray(values) ? values : []).map((value) => text(value)).filter(Boolean))];
}

function itemRefs(items = []) {
  return unique((Array.isArray(items) ? items : []).flatMap((item) => Array.isArray(item?.source_signal_ids) ? item.source_signal_ids : []));
}

function itemsText(items = []) {
  return (Array.isArray(items) ? items : []).map((item) => text(item?.text)).filter(Boolean).join(" ").toLowerCase();
}

function sectionRefs(normalizedPlan, sectionKey) {
  if (sectionKey === "summary_text") return new Set(normalizedPlan.summary_signal_ids || []);
  return new Set(itemRefs(normalizedPlan?.[sectionKey] || []));
}

function sectionLabel(sectionKey) {
  if (sectionKey === "goals_json") return "goals";
  if (sectionKey === "daily_support_json") return "daily support";
  if (sectionKey === "monitoring_json") return "monitoring";
  if (sectionKey === "escalation_json") return "escalation";
  if (sectionKey === "caregiver_guidance_json") return "caregiver guidance";
  return text(sectionKey) || "the plan";
}

function normalizePlanSections(plan) {
  return {
    summary_text: text(plan?.summary_text),
    summary_signal_ids: unique(plan?.summary_signal_ids),
    goals_json: Array.isArray(plan?.goals_json) ? plan.goals_json : [],
    daily_support_json: Array.isArray(plan?.daily_support_json) ? plan.daily_support_json : [],
    monitoring_json: Array.isArray(plan?.monitoring_json) ? plan.monitoring_json : [],
    escalation_json: Array.isArray(plan?.escalation_json) ? plan.escalation_json : [],
    caregiver_guidance_json: Array.isArray(plan?.caregiver_guidance_json) ? plan.caregiver_guidance_json : [],
  };
}

function sectionHasVerificationLanguage(textValue) {
  return /\b(verify|verification|confirm|check|re-check|recheck|follow up|follow-up|watch|monitor|review)\b/i.test(textValue);
}

function sectionHasSameDayLanguage(textValue) {
  return /\b(today|same day|immediately|right away|now|before end of day|this morning|this afternoon|within \d+ (hour|hours))\b/i.test(textValue);
}

function sectionHasResponseLanguage(textValue) {
  return /\b(call|contact|escalat|reach|respond|same day|today|urgent|if)\b/i.test(textValue);
}

export function findHealthPlanEvidenceCoverageIssues(plan, evidencePack = null) {
  if (!evidencePack || typeof evidencePack !== "object") return [];
  const normalizedPlan = normalizePlanSections(plan);
  const allSectionRefs = new Set([
    ...normalizedPlan.summary_signal_ids,
    ...itemRefs(normalizedPlan.goals_json),
    ...itemRefs(normalizedPlan.daily_support_json),
    ...itemRefs(normalizedPlan.monitoring_json),
    ...itemRefs(normalizedPlan.escalation_json),
    ...itemRefs(normalizedPlan.caregiver_guidance_json),
  ]);
  const responseRefs = new Set([
    ...normalizedPlan.summary_signal_ids,
    ...itemRefs(normalizedPlan.monitoring_json),
    ...itemRefs(normalizedPlan.escalation_json),
  ]);
  const monitoringText = itemsText(normalizedPlan.monitoring_json);
  const escalationText = itemsText(normalizedPlan.escalation_json);
  const caregiverText = itemsText(normalizedPlan.caregiver_guidance_json);
  const summaryText = lower(normalizedPlan.summary_text);
  const fullText = [
    summaryText,
    itemsText(normalizedPlan.goals_json),
    itemsText(normalizedPlan.daily_support_json),
    monitoringText,
    escalationText,
    caregiverText,
  ].join(" ");
  const issues = [];

  for (const fact of Array.isArray(evidencePack?.must_address_facts) ? evidencePack.must_address_facts : []) {
    const signalId = text(fact?.signal_id);
    if (!signalId) continue;
    if (!responseRefs.has(signalId)) {
      issues.push({
        type: "must_address_fact_missing",
        signal_id: signalId,
        message: `Health plan generation did not carry the must-address fact "${text(fact?.label) || signalId}" into the summary, monitoring, or escalation guidance.`,
      });
    }
  }

  if (evidencePack?.same_day_response_required) {
    if (!sectionHasSameDayLanguage(`${summaryText} ${monitoringText}`)) {
      issues.push({
        type: "same_day_response_missing",
        section_key: "monitoring_json",
        message: "Health plan generation did not make the same-day response pressure explicit in the summary or monitoring guidance.",
      });
    }
    if (!sectionHasSameDayLanguage(escalationText)) {
      issues.push({
        type: "same_day_escalation_missing",
        section_key: "escalation_json",
        message: "Health plan generation did not make the same-day escalation path explicit.",
      });
    }
  }

  for (const need of Array.isArray(evidencePack?.verification_needs) ? evidencePack.verification_needs : []) {
    const refs = unique(need?.source_signal_ids);
    const label = text(need?.label) || "verification need";
    const sectionKey = label.includes("monitoring_json")
      ? "monitoring_json"
      : label.includes("caregiver_guidance_json")
        ? "caregiver_guidance_json"
        : null;
    const targetText = sectionKey === "caregiver_guidance_json"
      ? caregiverText
      : sectionKey === "monitoring_json"
        ? monitoringText
        : `${monitoringText} ${escalationText} ${caregiverText} ${summaryText}`;
    const referenced = refs.length ? refs.some((ref) => allSectionRefs.has(ref)) : false;
    if ((refs.length && !referenced) || !sectionHasVerificationLanguage(targetText)) {
      issues.push({
        type: "verification_need_not_carried",
        section_key: sectionKey,
        label,
        message: `Health plan generation did not turn the verification need "${label}" into clear check, confirm, or re-check guidance.`,
      });
    }
  }

  for (const contradiction of Array.isArray(evidencePack?.contradictions) ? evidencePack.contradictions : []) {
    const sectionKey = text(contradiction?.section_key) || "monitoring_json";
    const targetText =
      sectionKey === "escalation_json" ? escalationText
        : sectionKey === "caregiver_guidance_json" ? caregiverText
          : sectionKey === "daily_support_json" ? itemsText(normalizedPlan.daily_support_json)
            : sectionKey === "goals_json" ? itemsText(normalizedPlan.goals_json)
              : monitoringText;
    const targetRefs = sectionRefs(normalizedPlan, sectionKey);
    const preferredSignalIds = unique(contradiction?.preferred_signal_ids);
    const hasPreferredSignalCoverage = !preferredSignalIds.length || preferredSignalIds.some((signalId) => targetRefs.has(signalId));
    if (!hasPreferredSignalCoverage) {
      issues.push({
        type: "contradiction_priority_signal_missing",
        section_key: sectionKey,
        message: `Health plan generation did not carry the lead evidence behind "${text(contradiction?.summary) || "evidence conflict"}" into ${sectionLabel(sectionKey)}.`,
      });
    }
    if (contradiction?.response_window === "today" && !sectionHasSameDayLanguage(targetText)) {
      issues.push({
        type: "contradiction_timing_missing",
        section_key: sectionKey,
        message: `Health plan generation did not make the response timing explicit enough for the conflict "${text(contradiction?.summary) || "evidence conflict"}".`,
      });
    }
    if (contradiction?.requires_verification && !sectionHasVerificationLanguage(targetText)) {
      issues.push({
        type: "contradiction_unresolved",
        section_key: sectionKey,
        message: `Health plan generation did not respond clearly enough to the contradiction "${text(contradiction?.summary) || "evidence conflict"}" in ${sectionLabel(sectionKey)}.`,
      });
    } else if (!sectionHasVerificationLanguage(targetText) && !sectionHasResponseLanguage(targetText)) {
      issues.push({
        type: "contradiction_unresolved",
        section_key: sectionKey,
        message: `Health plan generation did not respond clearly enough to the contradiction "${text(contradiction?.summary) || "evidence conflict"}" in ${sectionLabel(sectionKey)}.`,
      });
    }
  }

  for (const warning of Array.isArray(evidencePack?.fragile_pattern_warnings) ? evidencePack.fragile_pattern_warnings : []) {
    const warningText = lower(warning?.text);
    if (!warningText) continue;
    if (fullText.includes(warningText)) {
      issues.push({
        type: "fragile_pattern_returned",
        section_key: text(warning?.section_key) || null,
        message: `Health plan generation repeated a fragile pattern that should not return without new evidence: "${text(warning?.text)}".`,
      });
    }
  }

  return issues;
}
