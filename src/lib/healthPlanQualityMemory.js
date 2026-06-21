function text(value) {
  return String(value || "").trim();
}

function lower(value) {
  return text(value).toLowerCase();
}

function unique(values) {
  return [...new Set((Array.isArray(values) ? values : []).map((value) => text(value)).filter(Boolean))];
}

function normalizeVersion(value) {
  const version = Number(value || 0);
  return Number.isFinite(version) && version > 0 ? version : 1;
}

function parseDate(value) {
  const raw = text(value);
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function objectValue(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function severityRank(value) {
  if (value === "high") return 3;
  if (value === "medium") return 2;
  return 1;
}

const CANDIDATE_DIMENSION_LABELS = {
  trust_score: "trust",
  generation_quality_score: "generation quality",
  recommendation_coverage_score: "coverage",
  recommendation_grounding_score: "grounding",
  recommendation_evidence_diversity_score: "evidence diversity",
  operational_release_score: "release readiness",
  operational_completeness_score: "operational clarity",
  benchmark_score: "benchmark fit",
};

function normalizeSnapshotOwner(revision) {
  const snapshot = objectValue(revision?.quality_snapshot_json);
  if (!snapshot) return null;
  return {
    version_number: normalizeVersion(revision?.version_number || revision?.current_version),
    action_type: text(revision?.action_type || revision?.last_action_type) || "edited",
    review_status: text(revision?.review_status) || "draft",
    review_note: text(revision?.review_note) || null,
    generated_at: text(revision?.generated_at) || null,
    reviewed_at: text(revision?.reviewed_at) || null,
    captured_at: text(snapshot?.captured_at) || null,
    snapshot,
  };
}

function pushRecurringReason(map, label, { severity = "medium", sectionKey = null, source = null } = {}) {
  const normalizedLabel = text(label);
  if (!normalizedLabel) return;
  const key = lower(normalizedLabel);
  const existing = map.get(key);
  if (!existing) {
    map.set(key, {
      label: normalizedLabel,
      count: 1,
      highest_severity: severity,
      section_keys: sectionKey ? [sectionKey] : [],
      sources: source ? [source] : [],
    });
    return;
  }
  existing.count += 1;
  if (severityRank(severity) > severityRank(existing.highest_severity)) {
    existing.highest_severity = severity;
  }
  existing.section_keys = unique([...(existing.section_keys || []), sectionKey]);
  existing.sources = unique([...(existing.sources || []), source]);
}

function numeric(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeCandidateSelectionEntry(revision) {
  const snapshot = objectValue(revision?.snapshot);
  const selection = objectValue(snapshot?.candidate_selection);
  const winner = objectValue(selection?.winner);
  if (!selection || !winner) return null;

  const breakdown = objectValue(winner?.breakdown) || {};
  const acceptance = objectValue(winner?.acceptance) || {};
  const trustVerdict = objectValue(snapshot?.trust_verdict);
  const reviewReadiness = objectValue(snapshot?.review_readiness);
  const operationalRelease = objectValue(snapshot?.operational_release);
  const calibration = objectValue(snapshot?.recommendation_calibration);
  const reviewStatus = lower(revision?.review_status);
  const trustStatus = lower(trustVerdict?.overall_status);
  const readinessStatus = lower(reviewReadiness?.overall_status);
  const releaseStatus = lower(operationalRelease?.overall_status);

  const outcome =
    reviewStatus === "reviewed" || releaseStatus === "shareable"
      ? "held_up"
      : trustStatus === "fragile" || readinessStatus === "blocked" || releaseStatus === "blocked"
        ? "fragile"
        : "mixed";

  return {
    version_number: normalizeVersion(revision?.version_number),
    outcome,
    attempted_count: numeric(selection?.attempted_count, 0),
    accepted_count: numeric(selection?.accepted_count, 0),
    rejected_count: numeric(selection?.rejected_count, 0),
    winner_score: numeric(winner?.score, 0),
    caution_count: numeric(acceptance?.caution_count, 0),
    trust_score: numeric(acceptance?.trust_score || breakdown?.trust_score, 0),
    generation_quality_score: numeric(acceptance?.generation_quality_score || breakdown?.generation_quality_score, 0),
    recommendation_coverage_score: numeric(acceptance?.recommendation_coverage_score || breakdown?.recommendation_coverage_score, 0),
    recommendation_grounding_score: numeric(breakdown?.recommendation_grounding_score, 0),
    recommendation_evidence_diversity_score: numeric(breakdown?.recommendation_evidence_diversity_score, 0),
    operational_release_score: numeric(breakdown?.operational_release_score, 0),
    operational_completeness_score: numeric(breakdown?.operational_completeness_score, 0),
    benchmark_score: numeric(acceptance?.benchmark_average_score || breakdown?.benchmark_score, 0),
    calibration_penalty: numeric(breakdown?.calibration_penalty, 0),
    selection_summary: text(selection?.selection_summary) || null,
    candidate_id: text(winner?.candidate_id) || null,
  };
}

function average(values = []) {
  if (!values.length) return 0;
  return Math.round(values.reduce((total, value) => total + Number(value || 0), 0) / values.length);
}

function buildCandidateSelectionMemory(revisions = []) {
  const entries = (Array.isArray(revisions) ? revisions : [])
    .map((revision) => normalizeCandidateSelectionEntry(revision))
    .filter(Boolean)
    .slice(0, 6);

  if (!entries.length) return null;

  const heldUp = entries.filter((entry) => entry.outcome === "held_up");
  const fragile = entries.filter((entry) => entry.outcome === "fragile");
  const mixed = entries.filter((entry) => entry.outcome === "mixed");

  const dimensionNames = Object.keys(CANDIDATE_DIMENSION_LABELS);
  const summarizeDimensions = (items, direction = "high") => dimensionNames
    .map((name) => ({
      dimension: name,
      label: CANDIDATE_DIMENSION_LABELS[name],
      average_score: average(items.map((item) => numeric(item?.[name], 0))),
    }))
    .filter((item) => item.average_score > 0)
    .sort((left, right) =>
      direction === "high"
        ? right.average_score - left.average_score
        : left.average_score - right.average_score)
    .slice(0, 3);

  const winningStrengths = summarizeDimensions(heldUp.length ? heldUp : entries, "high")
    .filter((item) => item.average_score >= 82);
  const recurringFragilities = summarizeDimensions(fragile.length ? fragile : mixed, "low")
    .filter((item) => item.average_score > 0 && item.average_score <= 82);

  const lowCautionHeldUp = heldUp.filter((item) => item.caution_count <= 1).length;
  const highCalibrationFragile = fragile.filter((item) => item.calibration_penalty >= 4).length;

  const guardrails = [];
  if (winningStrengths.some((item) => item.dimension === "recommendation_coverage_score")) {
    guardrails.push("Recent winning drafts held up best when coverage stayed explicit around the strongest live risks and verification needs.");
  }
  if (winningStrengths.some((item) => item.dimension === "trust_score")) {
    guardrails.push("Prefer drafts that already read as trustworthy before review rather than drafts that only clear because the validator softens them.");
  }
  if (lowCautionHeldUp >= 2) {
    guardrails.push("Recent drafts held up better when they cleared with very few caution items, so prefer cleaner drafts over more polished but shakier ones.");
  }
  if (recurringFragilities.some((item) => item.dimension === "recommendation_grounding_score")) {
    guardrails.push("Recent fragile winners tended to outrun their evidence, so keep recommendations more tightly grounded when the choice is close.");
  }
  if (recurringFragilities.some((item) => item.dimension === "recommendation_evidence_diversity_score")) {
    guardrails.push("Recent fragile winners leaned on too narrow an evidence mix, so avoid choosing a draft that sounds decisive without multiple live anchors.");
  }
  if (highCalibrationFragile >= 1) {
    guardrails.push("Be skeptical of drafts that need repeated confidence softening or verification patching before they can be trusted.");
  }

  const latest = entries[0];
  const summary =
    heldUp.length > 0
      ? `${heldUp.length} recent winning draft${heldUp.length === 1 ? "" : "s"} held up well enough to guide the next selection pass, while ${fragile.length} later looked fragile.`
      : `${entries.length} recent winning draft${entries.length === 1 ? "" : "s"} are available, but none has fully proved durable yet, so keep the next selection conservative.`;

  return {
    summary,
    total_count: entries.length,
    held_up_count: heldUp.length,
    mixed_count: mixed.length,
    fragile_count: fragile.length,
    winning_strengths: winningStrengths,
    recurring_fragilities: recurringFragilities,
    average_attempted_count: average(entries.map((item) => item.attempted_count)),
    average_winner_score: average(entries.map((item) => item.winner_score)),
    latest_winner: {
      version_number: latest.version_number,
      candidate_id: latest.candidate_id,
      outcome: latest.outcome,
      winner_score: latest.winner_score,
      trust_score: latest.trust_score,
      recommendation_coverage_score: latest.recommendation_coverage_score,
      caution_count: latest.caution_count,
      selection_summary: latest.selection_summary,
    },
    guardrails: unique(guardrails).slice(0, 6),
  };
}

export function buildHealthPlanQualityMemory({
  existingPlan = null,
  history = [],
} = {}) {
  const revisions = [
    ...(Array.isArray(history) ? history : []),
    ...(existingPlan ? [existingPlan] : []),
  ]
    .map(normalizeSnapshotOwner)
    .filter(Boolean)
    .sort((left, right) => {
      const byVersion = normalizeVersion(right.version_number) - normalizeVersion(left.version_number);
      if (byVersion !== 0) return byVersion;
      const rightTime = parseDate(right.captured_at || right.reviewed_at || right.generated_at)?.getTime() || 0;
      const leftTime = parseDate(left.captured_at || left.reviewed_at || left.generated_at)?.getTime() || 0;
      return rightTime - leftTime;
    })
    .filter((item, index, list) => list.findIndex((candidate) => candidate.version_number === item.version_number) === index);

  if (!revisions.length) {
    return {
      summary: "No prior quality memory is available yet.",
      latest_review_judgment: null,
      current_guardrails: [],
      repeated_refresh_sections: [],
      recurring_quality_risks: [],
      candidate_selection_memory: null,
      durable_patterns: [],
      fragile_patterns: [],
    };
  }

  const latest = revisions[0];
  const latestSnapshot = latest.snapshot || {};
  const recurringReasonMap = new Map();
  const refreshPressureMap = new Map();

  for (const revision of revisions.slice(0, 4)) {
    const snapshot = revision.snapshot || {};
    const pressuredSectionsThisRevision = new Set();
    for (const item of Array.isArray(snapshot?.confidence_profile?.section_confidence) ? snapshot.confidence_profile.section_confidence : []) {
      for (const reason of Array.isArray(item?.reasons) ? item.reasons : []) {
        pushRecurringReason(recurringReasonMap, reason?.label, {
          severity: text(reason?.severity) || "medium",
          sectionKey: text(item?.section_key) || null,
          source: "confidence_profile",
        });
      }
      const sectionKey = text(item?.section_key);
      if (["low", "medium"].includes(lower(item?.max_confidence))) {
        if (sectionKey) pressuredSectionsThisRevision.add(sectionKey);
      }
    }
    for (const reason of Array.isArray(snapshot?.review_governance?.review_reasons_json) ? snapshot.review_governance.review_reasons_json : []) {
      pushRecurringReason(recurringReasonMap, reason?.label, {
        severity: text(reason?.severity) || "medium",
        source: "review_governance",
      });
    }
    for (const item of Array.isArray(snapshot?.evidence_conflicts) ? snapshot.evidence_conflicts : []) {
      pushRecurringReason(recurringReasonMap, item?.summary, {
        severity: text(item?.severity) || "medium",
        sectionKey: text(item?.section_key) || null,
        source: "evidence_conflict",
      });
    }
    for (const sectionKey of Array.isArray(snapshot?.refresh_strategy?.refresh_now_section_keys) ? snapshot.refresh_strategy.refresh_now_section_keys : []) {
      const normalizedSectionKey = text(sectionKey);
      if (!normalizedSectionKey) continue;
      pressuredSectionsThisRevision.add(normalizedSectionKey);
    }
    for (const sectionKey of pressuredSectionsThisRevision) {
      refreshPressureMap.set(sectionKey, (refreshPressureMap.get(sectionKey) || 0) + 1);
    }
  }

  const latestGuardrails = (Array.isArray(latestSnapshot?.confidence_profile?.section_confidence)
    ? latestSnapshot.confidence_profile.section_confidence
    : [])
    .filter((item) => ["low", "medium"].includes(lower(item?.max_confidence)))
    .map((item) => ({
      section_key: text(item?.section_key) || null,
      max_confidence: lower(item?.max_confidence) || "medium",
      reasons: (Array.isArray(item?.reasons) ? item.reasons : []).map((reason) => text(reason?.label)).filter(Boolean).slice(0, 3),
    }))
    .filter((item) => item.section_key);

  const repeatedRefreshSections = [...refreshPressureMap.entries()]
    .filter(([, count]) => Number(count) >= 2)
    .sort((left, right) => Number(right[1]) - Number(left[1]))
    .map(([section_key, count]) => ({ section_key, count }))
    .slice(0, 5);

  const recurringQualityRisks = [...recurringReasonMap.values()]
    .filter((item) => Number(item.count) >= 2)
    .sort((left, right) => {
      const byCount = Number(right.count) - Number(left.count);
      if (byCount !== 0) return byCount;
      return severityRank(right.highest_severity) - severityRank(left.highest_severity);
    })
    .slice(0, 6);

  const durablePatterns = Array.isArray(latestSnapshot?.recommendation_survivorship?.durable)
    ? latestSnapshot.recommendation_survivorship.durable.slice(0, 5).map((item) => ({
      section_key: text(item?.section_key) || null,
      text: text(item?.text) || null,
      reason: text(item?.reason) || null,
    })).filter((item) => item.text)
    : [];
  const fragilePatterns = Array.isArray(latestSnapshot?.recommendation_survivorship?.fragile)
    ? latestSnapshot.recommendation_survivorship.fragile.slice(0, 5).map((item) => ({
      section_key: text(item?.section_key) || null,
      text: text(item?.text) || null,
      reason: text(item?.reason) || null,
    })).filter((item) => item.text)
    : [];

  const latestReviewJudgment = latest.review_status === "reviewed" || latest.review_note || latestSnapshot?.review_governance
    ? {
        review_status: latest.review_status,
        review_note: latest.review_note || null,
        review_required: Boolean(latestSnapshot?.review_governance?.review_required),
        review_window: text(latestSnapshot?.review_governance?.review_window) || null,
        review_summary: text(latestSnapshot?.review_governance?.review_summary) || null,
      }
    : null;
  const candidateSelectionMemory = buildCandidateSelectionMemory(revisions);

  const summary =
    recurringQualityRisks.length > 0
      ? `${recurringQualityRisks.length} quality risk${recurringQualityRisks.length === 1 ? "" : "s"} has repeated across recent plan versions, so the next plan should fix those weaknesses directly instead of lightly rewriting them.`
      : repeatedRefreshSections.length > 0
        ? "Some sections keep coming back under refresh pressure, so the next plan should treat them as unstable until stronger evidence settles them."
        : durablePatterns.length > 0
          ? "Prior quality memory is mostly stable, with a few durable patterns worth preserving unless fresher evidence now contradicts them."
          : "Only limited saved quality memory exists so far, so the next plan should stay evidence-conservative.";

  return {
    summary,
    latest_review_judgment: latestReviewJudgment,
    current_guardrails: latestGuardrails,
    repeated_refresh_sections: repeatedRefreshSections,
    recurring_quality_risks: recurringQualityRisks,
    candidate_selection_memory: candidateSelectionMemory,
    durable_patterns: durablePatterns,
    fragile_patterns: fragilePatterns,
  };
}
