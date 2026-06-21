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

function itemKey(sectionKey, item, index) {
  return `${text(sectionKey)}:${text(item?.id) || `${sectionKey}-${index + 1}`}`;
}

function sourceLookup(sourceSignals = []) {
  return new Map(
    (Array.isArray(sourceSignals) ? sourceSignals : [])
      .map((signal) => {
        const id = text(signal?.id);
        return id ? [id, signal] : null;
      })
      .filter(Boolean),
  );
}

function summaryLookup(items = []) {
  return new Map(
    (Array.isArray(items) ? items : [])
      .map((item) => {
        const sectionKey = text(item?.section_key);
        const itemId = text(item?.item_id);
        return sectionKey && itemId ? [`${sectionKey}:${itemId}`, item] : null;
      })
      .filter(Boolean),
  );
}

function supportMode(refs = [], signalTriage = {}) {
  const actionIds = new Set(unique(signalTriage?.action_signal_ids));
  const verificationIds = new Set(unique(signalTriage?.verification_signal_ids));
  const stabilizingIds = new Set(unique(signalTriage?.stabilizing_signal_ids));
  if (refs.some((id) => actionIds.has(id))) return "action";
  if (refs.some((id) => verificationIds.has(id))) return "verification";
  if (refs.some((id) => stabilizingIds.has(id))) return "stabilizing";
  return "context";
}

function receiptTrustLevel(groundingItem = null, rankingItem = null, challengeItem = null) {
  const groundingStatus = lower(groundingItem?.grounding_status);
  if (groundingStatus === "strong" || groundingStatus === "guarded" || groundingStatus === "fragile") {
    return groundingStatus;
  }
  if (lower(challengeItem?.challenge_status) === "challenged") return "fragile";
  if (lower(challengeItem?.challenge_status) === "guarded") return "guarded";
  const evidenceQuality = lower(rankingItem?.evidence_quality);
  if (evidenceQuality === "strong") return "strong";
  if (evidenceQuality === "mixed") return "guarded";
  return "fragile";
}

function driverSignalsForReceipt(item, rankingItem, lookup) {
  const ranked = Array.isArray(rankingItem?.ranked_sources) ? rankingItem.ranked_sources : [];
  const rankedSignals = ranked
    .map((entry) => {
      const signalId = text(entry?.signal_id);
      const linked = lookup.get(signalId) || null;
      if (!signalId && !text(entry?.label)) return null;
      return {
        signal_id: signalId || text(linked?.id),
        label: text(linked?.label) || text(entry?.label) || signalId,
        strength: lower(linked?.strength) || null,
        authority_level: lower(entry?.authority_level) || null,
      };
    })
    .filter((entry) => entry?.label);
  if (rankedSignals.length > 0) return rankedSignals.slice(0, 3);

  return unique(item?.source_signal_ids)
    .map((signalId) => {
      const linked = lookup.get(signalId);
      if (!linked) return null;
      return {
        signal_id: signalId,
        label: text(linked?.label) || signalId,
        strength: lower(linked?.strength) || null,
        authority_level: null,
      };
    })
    .filter(Boolean)
    .slice(0, 3);
}

function joinLabels(labels = []) {
  const cleaned = unique(labels).slice(0, 3);
  if (cleaned.length === 0) return "the linked client signals";
  if (cleaned.length === 1) return cleaned[0];
  if (cleaned.length === 2) return `${cleaned[0]} and ${cleaned[1]}`;
  return `${cleaned[0]}, ${cleaned[1]}, and ${cleaned[2]}`;
}

function receiptSummary({ drivers, trustLevel, mode, item }) {
  const driverLabel = joinLabels(drivers.map((entry) => entry.label));
  const prefix =
    mode === "action"
      ? `Driven mainly by ${driverLabel}.`
      : mode === "verification"
        ? `Grounded mainly in ${driverLabel}.`
        : mode === "stabilizing"
          ? `Preserving a routine supported by ${driverLabel}.`
          : `Grounded in ${driverLabel}.`;

  if (trustLevel === "strong") {
    return `${prefix} The current evidence is strong enough for normal staff use.`;
  }
  if (trustLevel === "guarded") {
    return `${prefix} The current evidence is usable, but staff should still verify the live picture.`;
  }
  const verificationRequired = item?.verification_required === true;
  return `${prefix} The evidence is still thin or conflicted${verificationRequired ? ", so this should stay verification-led." : ", so this should stay cautious."}`;
}

function attentionStatus({ challengeItem, impactItem, groundingItem, item }) {
  const impact = lower(impactItem?.impact_status);
  if (impact === "contradicted" || impact === "mixed" || impact === "reinforced") return impact;
  const challenge = lower(challengeItem?.challenge_status);
  if (challenge === "challenged") return "verify";
  if (challenge === "guarded") return "watch";
  if (lower(groundingItem?.grounding_status) === "fragile") return "verify";
  if (item?.verification_required === true) return "watch";
  return null;
}

function attentionNote({ challengeItem, impactItem, groundingItem, item }) {
  const impact = lower(impactItem?.impact_status);
  if (impact === "contradicted" || impact === "mixed" || impact === "reinforced") {
    return text(impactItem?.reason) || text(impactItem?.next_step) || null;
  }
  const challenge = lower(challengeItem?.challenge_status);
  if (challenge === "challenged" || challenge === "guarded") {
    return text(challengeItem?.why_it_is_questioned) || text(challengeItem?.safer_reframe) || null;
  }
  if (lower(groundingItem?.grounding_status) === "fragile" || lower(groundingItem?.grounding_status) === "guarded") {
    return text(groundingItem?.staff_note) || null;
  }
  if (item?.verification_required === true) {
    return "This recommendation should stay verification-led until staff confirm the live picture.";
  }
  return null;
}

export function attachHealthPlanEvidenceReceipts(
  sectionMap = {},
  { sourceSignals = [], signalTriage = {}, qualitySnapshot = null } = {},
) {
  const signalLookup = sourceLookup(sourceSignals);
  const rankingLookup = summaryLookup(qualitySnapshot?.recommendation_source_ranking?.items);
  const groundingLookup = summaryLookup(qualitySnapshot?.recommendation_grounding?.items);
  const challengeLookup = summaryLookup(qualitySnapshot?.recommendation_challenges?.items);
  const impactLookup = summaryLookup(qualitySnapshot?.recommendation_impact?.items);

  return SECTION_KEYS.reduce((result, sectionKey) => {
    const items = Array.isArray(sectionMap?.[sectionKey]) ? sectionMap[sectionKey] : [];
    result[sectionKey] = items.map((item, index) => {
      if (!objectValue(item) || !text(item?.text)) return item;
      const key = itemKey(sectionKey, item, index);
      const rankingItem = rankingLookup.get(key) || null;
      const groundingItem = groundingLookup.get(key) || null;
      const challengeItem = challengeLookup.get(key) || null;
      const impactItem = impactLookup.get(key) || null;
      const refs = unique(item?.source_signal_ids);
      const drivers = driverSignalsForReceipt(item, rankingItem, signalLookup);
      const mode = supportMode(refs, signalTriage);
      const trustLevel = receiptTrustLevel(groundingItem, rankingItem, challengeItem);
      return {
        ...item,
        evidence_receipt: {
          trust_level: trustLevel,
          support_mode: mode,
          driver_signal_ids: unique(drivers.map((entry) => entry.signal_id)),
          driver_labels: unique(drivers.map((entry) => entry.label)),
          summary: receiptSummary({ drivers, trustLevel, mode, item }),
          attention_status: attentionStatus({ challengeItem, impactItem, groundingItem, item }),
          attention_note: attentionNote({ challengeItem, impactItem, groundingItem, item }),
        },
      };
    });
    return result;
  }, {});
}
