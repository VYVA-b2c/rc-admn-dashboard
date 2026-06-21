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

function sectionLabel(sectionKey) {
  if (sectionKey === "goals_json") return "Goals";
  if (sectionKey === "daily_support_json") return "Daily support";
  if (sectionKey === "monitoring_json") return "Monitoring";
  if (sectionKey === "escalation_json") return "Escalation";
  if (sectionKey === "caregiver_guidance_json") return "Caregiver guidance";
  return text(sectionKey) || "Section";
}

function normalizeEvidenceSupport(refs = [], linkedSignals = []) {
  const categories = new Set(linkedSignals.map((signal) => lower(signal?.category)).filter(Boolean));
  const highCount = linkedSignals.filter((signal) => lower(signal?.strength) === "high").length;
  const mediumCount = linkedSignals.filter((signal) => lower(signal?.strength) === "medium").length;

  if (refs.length >= 2 && (highCount > 0 || categories.size >= 2)) return "strong";
  if (refs.length >= 2 || highCount > 0 || mediumCount > 0) return "mixed";
  return "thin";
}

function hasVerificationLanguage(value) {
  return /\b(verify|verification|confirm|check|re-check|recheck|review|watch|monitor|follow up|follow-up)\b/i.test(text(value));
}

function hasFallbackLanguage(value) {
  return /\b(if|when|otherwise|else|fallback|backup|escalat|call|contact|reach|same day|today|urgent|owner|report back)\b/i.test(text(value));
}

function hasCalmingLanguage(value) {
  return /\b(stable|steady|routine|continue|maintain|preserve|comparatively stable|looks stable|keep)\b/i.test(text(value));
}

function priorityScore(value) {
  if (value === "high") return 3;
  if (value === "medium") return 2;
  return 1;
}

function windowScore(value) {
  if (value === "today") return 3;
  if (value === "this_week") return 2;
  return 1;
}

function sectionPressure(sectionKey, reviewPriorities = null, liveEvidenceSummary = null, longitudinalMemory = null) {
  let score = 0;
  const reasons = [];
  const priority = (Array.isArray(reviewPriorities?.items) ? reviewPriorities.items : [])
    .find((item) => text(item?.section_key) === sectionKey);
  if (priority?.priority === "high") {
    score += 3;
    reasons.push("high review priority");
  } else if (priority?.priority === "medium") {
    score += 2;
    reasons.push("medium review priority");
  }
  if (priority?.response_window === "today") {
    score += 3;
    reasons.push("same-day review pressure");
  } else if (priority?.response_window === "this_week") {
    score += 1;
  }

  const liveDomains = [];
  if (["goals_json", "daily_support_json", "monitoring_json", "escalation_json"].includes(sectionKey)) {
    liveDomains.push(objectValue(liveEvidenceSummary?.medication_adherence));
  }
  if (["daily_support_json", "monitoring_json", "escalation_json", "caregiver_guidance_json"].includes(sectionKey)) {
    liveDomains.push(objectValue(liveEvidenceSummary?.service_engagement));
    liveDomains.push(objectValue(liveEvidenceSummary?.contact_pressure));
  }
  if (["monitoring_json", "escalation_json"].includes(sectionKey)) {
    liveDomains.push(objectValue(liveEvidenceSummary?.sensor_reliability));
  }
  for (const domain of liveDomains.filter(Boolean)) {
    if (domain.status === "pressure") {
      score += 2;
      reasons.push(text(domain.summary) || "live pressure");
    } else if (domain.status === "watch") {
      score += 1;
    }
    if (domain?.windows?.trend === "worsening") {
      score += 1;
    }
  }

  const longitudinalDomains = (Array.isArray(longitudinalMemory?.domains) ? longitudinalMemory.domains : []).filter((domain) => {
    const key = text(domain?.key);
    if (["goals_json", "daily_support_json", "monitoring_json", "escalation_json"].includes(sectionKey) && key === "medication") return true;
    if (["daily_support_json", "monitoring_json", "escalation_json", "caregiver_guidance_json"].includes(sectionKey) && key === "contact") return true;
    if (["monitoring_json", "escalation_json"].includes(sectionKey) && key === "sensor") return true;
    return false;
  });
  for (const domain of longitudinalDomains) {
    if (domain.status === "persistent_pressure") {
      score += 2;
      reasons.push(text(domain.why_it_matters) || "persistent pressure");
    } else if (domain.status === "recurrent_watch") {
      score += 1;
    }
  }

  if (score >= 6) return { level: "high", score, reasons: unique(reasons) };
  if (score >= 3) return { level: "medium", score, reasons: unique(reasons) };
  return { level: "low", score, reasons: unique(reasons) };
}

function saferReframe(item, {
  weakEvidence = false,
  optimismRisk = "low",
  fallbackGap = false,
} = {}) {
  const sectionKey = text(item?.section_key);
  if (weakEvidence && ["monitoring_json", "escalation_json"].includes(sectionKey)) {
    return "Reframe this as a verification step tied to a named same-day response path until stronger evidence confirms the routine.";
  }
  if (fallbackGap && sectionKey === "escalation_json") {
    return "Add who acts next, how quickly they act, and what happens if the first contact attempt still fails.";
  }
  if (fallbackGap) {
    return "Add a concrete fallback so staff know what to do if the first routine or outreach step does not land.";
  }
  if (optimismRisk === "high") {
    return "Name the live pressure directly and replace calming wording with a concrete check, owner, or response window.";
  }
  return "Tighten this recommendation with clearer evidence, verification language, or a more specific next step.";
}

function challengeStatus({ weakEvidence = false, optimismRisk = "low", fallbackGap = false } = {}) {
  if (weakEvidence || optimismRisk === "high" || fallbackGap) return "challenged";
  if (optimismRisk === "medium") return "guarded";
  return "supported";
}

function issueSummary({
  weakEvidence = false,
  evidenceSupport = "mixed",
  pressure = null,
  optimismRisk = "low",
  fallbackGap = false,
} = {}) {
  const parts = [];
  if (weakEvidence || evidenceSupport === "thin") {
    parts.push("This recommendation is carrying more urgency than its evidence support.");
  }
  if (optimismRisk === "high") {
    parts.push("The wording sounds calmer than the live pattern warrants.");
  } else if (optimismRisk === "medium") {
    parts.push("The wording may still understate the current live pressure.");
  }
  if (fallbackGap) {
    parts.push("It does not say what staff should do if the first step fails or the signal worsens.");
  }
  if (!parts.length && pressure?.reasons?.length) {
    parts.push(`Review pressure is being driven by ${pressure.reasons[0]}.`);
  }
  return parts.join(" ");
}

export function buildHealthPlanRecommendationChallenges({
  plan = null,
  sourceSignals = [],
  reviewPriorities = null,
  liveEvidenceSummary = null,
  longitudinalMemory = null,
} = {}) {
  const normalizedPlan = objectValue(plan);
  if (!normalizedPlan) return null;

  const signalLookup = new Map(
    (Array.isArray(sourceSignals) ? sourceSignals : [])
      .map((signal) => {
        const id = text(signal?.id);
        if (!id) return null;
        return [id, signal];
      })
      .filter(Boolean),
  );

  const items = [];
  for (const sectionKey of SECTION_KEYS) {
    const sectionItems = Array.isArray(normalizedPlan?.[sectionKey]) ? normalizedPlan[sectionKey] : [];
    const pressure = sectionPressure(sectionKey, reviewPriorities, liveEvidenceSummary, longitudinalMemory);
    sectionItems.forEach((item, index) => {
      const refs = unique(item?.source_signal_ids);
      const linkedSignals = refs.map((id) => signalLookup.get(id)).filter(Boolean);
      const evidenceSupport = normalizeEvidenceSupport(refs, linkedSignals);
      const sameDayLike = item?.timing === "today" || item?.priority === "high" || ["monitoring_json", "escalation_json"].includes(sectionKey);
      const weakEvidence = evidenceSupport === "thin" && (sameDayLike || pressure.level !== "low");
      const fallbackGap = sameDayLike && !hasFallbackLanguage(item?.text);
      const optimismRisk =
        pressure.level === "high" && hasCalmingLanguage(item?.text) && !hasVerificationLanguage(item?.text)
          ? "high"
          : pressure.level !== "low" && !hasVerificationLanguage(item?.text) && !hasFallbackLanguage(item?.text)
            ? "medium"
            : "low";
      const status = challengeStatus({ weakEvidence, optimismRisk, fallbackGap });
      const highRisk =
        status === "challenged"
        && (
          ["monitoring_json", "escalation_json"].includes(sectionKey)
          || priorityScore(item?.priority) >= 3
          || windowScore(item?.timing) >= 3
        );

      items.push({
        item_id: text(item?.id) || `${sectionKey}-${index + 1}`,
        section_key: sectionKey,
        section_label: sectionLabel(sectionKey),
        text: text(item?.text) || null,
        challenge_status: status,
        evidence_support: evidenceSupport,
        optimism_risk: optimismRisk,
        fallback_gap: fallbackGap,
        high_risk: highRisk,
        why_it_is_questioned: issueSummary({
          weakEvidence,
          evidenceSupport,
          pressure,
          optimismRisk,
          fallbackGap,
        }) || null,
        safer_reframe: status === "supported" ? null : saferReframe({ ...item, section_key: sectionKey }, { weakEvidence, optimismRisk, fallbackGap }),
        source_signal_ids: refs,
      });
    });
  }

  const challenged = items.filter((item) => item.challenge_status === "challenged");
  const guarded = items.filter((item) => item.challenge_status === "guarded");
  const highRisk = challenged.filter((item) => item.high_risk);
  const overallStatus =
    highRisk.length > 0 || challenged.length >= 3
      ? "challenged"
      : challenged.length > 0 || guarded.length > 0
        ? "guarded"
        : "supported";
  const summary =
    overallStatus === "challenged"
      ? "Some recommendations still look too fragile or too optimistic for the current evidence picture and should be challenged before staff rely on them."
      : overallStatus === "guarded"
        ? "Most recommendations are usable, but a few still need a human challenge pass to tighten evidence or fallback wording."
        : "The recommendation set is broadly aligned with the current evidence picture and does not show obvious fragile advice.";

  return {
    overall_status: overallStatus,
    summary,
    total_items_reviewed: items.length,
    challenged_count: challenged.length,
    guarded_count: guarded.length,
    high_risk_count: highRisk.length,
    items,
  };
}

export function shouldRejectHealthPlanRecommendationChallenges(summary) {
  const normalized = objectValue(summary);
  if (!normalized) return false;
  const items = Array.isArray(normalized.items) ? normalized.items : [];
  return items.some((item) => item?.challenge_status === "challenged" && item?.high_risk);
}
