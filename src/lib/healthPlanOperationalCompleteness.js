const SECTION_LABELS = {
  goals_json: "Goals",
  daily_support_json: "Daily support",
  monitoring_json: "Monitoring",
  escalation_json: "Escalation",
  caregiver_guidance_json: "Caregiver guidance",
};

const SECTION_KEYS = Object.keys(SECTION_LABELS);

function text(value) {
  return String(value || "").trim();
}

function lower(value) {
  return text(value).toLowerCase();
}

function objectValue(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function unique(values) {
  return [...new Set((Array.isArray(values) ? values : []).map((value) => text(value)).filter(Boolean))];
}

function items(plan, sectionKey) {
  return Array.isArray(plan?.[sectionKey]) ? plan[sectionKey] : [];
}

function joinedText(plan, sectionKey) {
  return items(plan, sectionKey).map((item) => text(item?.text)).filter(Boolean).join(" ");
}

function severityWeight(value) {
  if (value === "high") return 18;
  if (value === "medium") return 10;
  return 5;
}

function normalizeSeverity(value) {
  return value === "high" || value === "medium" ? value : "low";
}

function issue(sectionKey, type, severity, message, detail = null) {
  return {
    type,
    section_key: sectionKey,
    severity: normalizeSeverity(severity),
    message: text(message) || null,
    detail: text(detail) || null,
  };
}

function sectionLabel(sectionKey) {
  return SECTION_LABELS[sectionKey] || text(sectionKey) || "Section";
}

function hasOwnerLanguage(value) {
  return /\b(caregiver|family|staff|team|operator|coordinator|nurse|provider|brain coach|check[- ]?in|assigned responder|assigned staff|case owner|red cross|on-call|backup contact|care circle)\b/i.test(text(value));
}

function hasFallbackLanguage(value) {
  return /\b(if contact still fails|if still unreachable|if no response|if unanswered|backup|fallback|second attempt|another attempt|next contact|on-call|backup contact|if .* remains unreachable|if .* cannot be reached)\b/i.test(text(value));
}

function hasTriggerLanguage(value) {
  return /\b(if|when|whether|unless|once|after|upon|should .* remain|still|becomes|returns|worsens|missed|cannot be confirmed|unable to reach)\b/i.test(text(value));
}

function hasReportBackLanguage(value) {
  return /\b(report back|confirm back|notify|let .* know|tell the team|log|document|report concerns)\b/i.test(text(value));
}

function hasCompletionLanguage(value) {
  return /\b(close the loop|document|log|record|mark .* complete|confirm .* (resolved|stabilized|completed|done)|report back|update the team)\b/i.test(text(value));
}

function hasTimingLanguage(value) {
  return /\b(today|same day|this week|within \d+ ?(hours|hour|days|day)|morning|evening|next call|current morning time|48 hours|24 hours)\b/i.test(text(value));
}

function hasConcreteActionLanguage(value) {
  return /\b(call|contact|reach|respond|escalat|confirm|review|dispatch|re-check|recheck|check|notify|share)\b/i.test(text(value));
}

function hasStructuredVerification(sectionItems = []) {
  return (Array.isArray(sectionItems) ? sectionItems : []).some((item) => item?.verification_required === true);
}

function hasStructuredFallbackOwner(sectionItems = []) {
  return (Array.isArray(sectionItems) ? sectionItems : []).some((item) =>
    ["assigned_staff", "caregiver", "on_call_coordinator", "care_team"].includes(lower(item?.fallback_owner_role))
  );
}

function hasStructuredOwner(sectionItems = []) {
  return (Array.isArray(sectionItems) ? sectionItems : []).some((item) =>
    ["assigned_staff", "caregiver", "on_call_coordinator", "care_team"].includes(lower(item?.owner_role))
  );
}

function hasStructuredCompletionSignal(sectionItems = []) {
  return (Array.isArray(sectionItems) ? sectionItems : []).some((item) => text(item?.completion_signal));
}

function itemsNeedSameDay(sectionKey, reviewPriorities = [], escalationGrade = null) {
  if (["monitoring_json", "escalation_json"].includes(sectionKey) && lower(escalationGrade?.grade) === "urgent") return true;
  return (Array.isArray(reviewPriorities) ? reviewPriorities : []).some((item) =>
    text(item?.section_key) === sectionKey
    && (item?.response_window === "today" || item?.priority === "high"),
  );
}

function shouldRequireFallback(sectionKey, escalationGrade = null, liveEvidenceSummary = null) {
  if (sectionKey === "escalation_json" && ["urgent", "heightened"].includes(lower(escalationGrade?.grade))) return true;
  return false;
}

function shouldRequireReportBack(sectionKey, liveEvidenceSummary = null) {
  if (sectionKey !== "caregiver_guidance_json") return false;
  return ["watch", "pressure"].includes(lower(liveEvidenceSummary?.contact_pressure?.status))
    || ["watch", "pressure"].includes(lower(liveEvidenceSummary?.medication_adherence?.status));
}

function needsOperationalAction(sectionKey, reviewPriorities = []) {
  if (["monitoring_json", "escalation_json", "caregiver_guidance_json"].includes(sectionKey)) return true;
  return (Array.isArray(reviewPriorities) ? reviewPriorities : []).some((item) => text(item?.section_key) === sectionKey && item?.priority === "high");
}

function buildSectionCheck(sectionKey, {
  plan,
  reviewPriorities,
  escalationGrade,
  liveEvidenceSummary,
} = {}) {
  const sectionItems = items(plan, sectionKey);
  if (!sectionItems.length) return null;

  const combinedText = joinedText(plan, sectionKey);
  const sameDayRequired = itemsNeedSameDay(sectionKey, reviewPriorities, escalationGrade);
  const fallbackRequired = shouldRequireFallback(sectionKey, escalationGrade, liveEvidenceSummary);
  const reportBackRequired = shouldRequireReportBack(sectionKey, liveEvidenceSummary);
  const actionRequired = needsOperationalAction(sectionKey, reviewPriorities);
  const structuredVerification = hasStructuredVerification(sectionItems);
  const structuredOwner = hasStructuredOwner(sectionItems);
  const structuredCompletionSignal = hasStructuredCompletionSignal(sectionItems);
  const structuredFallbackOwner = hasStructuredFallbackOwner(sectionItems);
  const issues = [];

  if (actionRequired && !hasConcreteActionLanguage(combinedText)) {
    issues.push(issue(
      sectionKey,
      "action_missing",
      sameDayRequired ? "high" : "medium",
      `${sectionLabel(sectionKey)} stays too vague for operational use.`,
      "Name a concrete action instead of relying on broad monitoring or support wording alone.",
    ));
  }

  if (sameDayRequired) {
    const hasSameDayTiming = sectionItems.some((item) => item?.timing === "today") || hasTimingLanguage(combinedText);
    if (!hasSameDayTiming) {
      issues.push(issue(
        sectionKey,
        "timing_missing",
        "high",
        `${sectionLabel(sectionKey)} does not make the response timing explicit enough for same-day pressure.`,
        "Add same-day wording or exact timing so staff do not have to infer urgency under pressure.",
      ));
    }
  }

  if (["monitoring_json", "escalation_json"].includes(sectionKey) && !hasTriggerLanguage(combinedText)) {
    issues.push(issue(
      sectionKey,
      "trigger_missing",
      sameDayRequired ? "high" : "medium",
      `${sectionLabel(sectionKey)} does not clearly state what trigger should change the response.`,
      "Use explicit if or when language so staff know what condition should escalate or prompt a re-check.",
    ));
  }

  if (sameDayRequired && ["monitoring_json", "escalation_json", "caregiver_guidance_json"].includes(sectionKey) && !structuredVerification) {
    issues.push(issue(
      sectionKey,
      "verification_contract_missing",
      "high",
      `${sectionLabel(sectionKey)} does not clearly mark that this recommendation still needs active verification.`,
      "Set verification_required on the urgent recommendation so staff can distinguish direct action from verify-first guidance.",
    ));
  }

  if (sameDayRequired && ["monitoring_json", "escalation_json", "caregiver_guidance_json"].includes(sectionKey) && !hasCompletionLanguage(combinedText) && !structuredCompletionSignal) {
    issues.push(issue(
      sectionKey,
      "close_loop_missing",
      "medium",
      `${sectionLabel(sectionKey)} does not clearly say what confirms the action is done or what staff should log afterward.`,
      "Add a close-the-loop outcome so the next person knows what completion or confirmation looks like.",
    ));
  }

  if (["escalation_json", "caregiver_guidance_json"].includes(sectionKey) && !hasOwnerLanguage(combinedText) && !structuredOwner) {
    issues.push(issue(
      sectionKey,
      "owner_missing",
      sectionKey === "escalation_json" && sameDayRequired ? "high" : "medium",
      `${sectionLabel(sectionKey)} does not clearly name who should act next.`,
      "Name the person or team who owns the next step so the plan can be executed without guesswork.",
    ));
  }

  if (fallbackRequired && !hasFallbackLanguage(combinedText) && !structuredFallbackOwner) {
    issues.push(issue(
      sectionKey,
      "fallback_missing",
      "high",
      `${sectionLabel(sectionKey)} does not describe what to do if the first response path fails.`,
      "Name the backup route, next owner, or second attempt path for missed contact or unresolved risk.",
    ));
  }

  if (reportBackRequired && !hasReportBackLanguage(combinedText) && !structuredCompletionSignal) {
    issues.push(issue(
      sectionKey,
      "report_back_missing",
      "medium",
      `${sectionLabel(sectionKey)} should say how the care circle reports back what they find.`,
      "Add simple report-back wording so staff can close the loop after caregiver outreach.",
    ));
  }

  const overallStatus =
    issues.some((item) => item.severity === "high")
      ? "fragile"
      : issues.length > 0
        ? "guarded"
        : "strong";

  const summary =
    overallStatus === "strong"
      ? `${sectionLabel(sectionKey)} looks concrete enough to execute without much extra interpretation.`
      : issues[0]?.message || `${sectionLabel(sectionKey)} still needs clearer operational wording.`;

  return {
    section_key: sectionKey,
    section_label: sectionLabel(sectionKey),
    overall_status: overallStatus,
    issue_count: issues.length,
    issues,
    summary,
  };
}

export function findHealthPlanOperationalCompletenessIssues(plan, options = {}) {
  if (!objectValue(plan)) return [];
  return SECTION_KEYS.flatMap((sectionKey) => buildSectionCheck(sectionKey, { plan, ...options })?.issues || []);
}

export function buildHealthPlanOperationalCompleteness({
  plan = null,
  reviewPriorities = null,
  escalationGrade = null,
  liveEvidenceSummary = null,
} = {}) {
  if (!objectValue(plan)) return null;

  const sectionChecks = SECTION_KEYS
    .map((sectionKey) => buildSectionCheck(sectionKey, {
      plan,
      reviewPriorities: Array.isArray(reviewPriorities?.items) ? reviewPriorities.items : [],
      escalationGrade,
      liveEvidenceSummary,
    }))
    .filter(Boolean);

  const issues = sectionChecks.flatMap((section) => section.issues || []);
  const score = Math.max(0, 100 - issues.reduce((total, item) => total + severityWeight(item.severity), 0));
  const overallStatus =
    issues.some((item) => item.severity === "high") || score < 72
      ? "fragile"
      : issues.length > 0 || score < 90
        ? "guarded"
        : "strong";

  const summary =
    overallStatus === "strong"
      ? "The plan is operationally concrete: timing, triggers, ownership, and fallback wording are mostly clear."
      : overallStatus === "guarded"
        ? "The plan is clinically useful, but one or more sections still need clearer ownership, timing, or fallback wording before staff can execute it confidently."
        : "The plan still leaves important execution details implicit, which makes it risky to rely on under pressure.";

  return {
    overall_status: overallStatus,
    score,
    summary,
    issue_count: issues.length,
    issues: issues.slice(0, 8),
    section_checks: sectionChecks,
  };
}

export function shouldRejectHealthPlanOperationalCompleteness(summary) {
  const normalized = objectValue(summary);
  if (!normalized) return false;
  const issues = Array.isArray(normalized.issues) ? normalized.issues : [];
  const mediumCount = issues.filter((item) => item?.severity === "medium").length;
  return issues.some((item) => item?.severity === "high") || mediumCount >= 3;
}
