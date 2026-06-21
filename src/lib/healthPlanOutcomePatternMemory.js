const SECTION_LABELS = {
  goals_json: "Goals",
  daily_support_json: "Daily support",
  monitoring_json: "Monitoring",
  escalation_json: "Escalation",
  caregiver_guidance_json: "Caregiver guidance",
};

const OUTCOME_PATTERN_COPY = {
  en: {
    no_memory: "No cross-version outcome pattern memory is available yet.",
    summary_counts: ({ preserveCount, replaceCount, unstableCount }) =>
      `${preserveCount} preserve-worthy pattern${preserveCount === 1 ? "" : "s"}, ${replaceCount} replace pattern${replaceCount === 1 ? "" : "s"}, and ${unstableCount} pressured section${unstableCount === 1 ? "" : "s"} were found across recent plan outcomes.`,
    summary_anchors:
      "Recent saved plans contain usable response-anchor learning, but the routine-level outcome memory is still thin.",
    summary_thin:
      "Cross-version outcome memory exists, but it is still too thin to promote strong pattern reuse yet.",
    guardrail_anchor_held: (label) =>
      `Recent saved plans held up best when they leaned on ${label}.`,
    guardrail_anchor_fragile: (label) =>
      `Keep ${label} verification-led or backed by a fallback path; it has stayed fragile across recent outcomes.`,
    guardrail_preserve: (textValue) =>
      `Protect routines like "${textValue}" when the same live evidence still fits; they have repeatedly held up.`,
    guardrail_watch: (textValue) =>
      `When similar needs recur, treat "${textValue}" as a rewrite-or-verify pattern instead of settled guidance.`,
    guardrail_replace: (textValue) =>
      `Do not bring "${textValue}" back unchanged; it repeatedly failed or stayed unresolved.`,
    guardrail_pressure: (label) =>
      `${label} has stayed under outcome pressure across recent plans, so rebuild it substantively instead of lightly polishing it.`,
    guardrail_domain_stable: (label) =>
      `Use ${label} as a dependable scaffold when the live picture still matches, because it has held up across recent outcomes.`,
    guardrail_domain_fragile: (label) =>
      `Treat ${label} as a fragile care domain until fresher follow-through proves otherwise.`,
  },
  de: {
    no_memory: "Noch keine versionsuebergreifende Ergebnis-Erinnerung verfuegbar.",
    summary_counts: ({ preserveCount, replaceCount, unstableCount }) =>
      `${preserveCount} Beibehalten-Muster, ${replaceCount} Ersetzen-Muster und ${unstableCount} Druck-Abschnitt${unstableCount === 1 ? "" : "e"} wurden ueber die letzten Planergebnisse hinweg erkannt.`,
    summary_anchors:
      "Die letzten gespeicherten Plaene enthalten brauchbare Reaktionsmuster, aber die routinebezogene Ergebnis-Erinnerung ist noch duenn.",
    summary_thin:
      "Es gibt bereits versionsuebergreifende Ergebnis-Erinnerung, aber noch zu wenig fuer belastbare Wiederverwendung.",
    guardrail_anchor_held: (label) =>
      `Die letzten gespeicherten Plaene haben am besten getragen, wenn sie sich auf ${label} gestuetzt haben.`,
    guardrail_anchor_fragile: (label) =>
      `Fuehre ${label} weiter verifikationsbasiert oder mit Rueckfallpfad; dieser Anker bleibt ueber mehrere Ergebnisse hinweg fragil.`,
    guardrail_preserve: (textValue) =>
      `Schuetze Routinen wie "${textValue}", wenn die aktuelle Evidenz weiter passt; sie haben sich wiederholt bewaehrt.`,
    guardrail_watch: (textValue) =>
      `Wenn ein aehnlicher Bedarf wiederkommt, behandle "${textValue}" als Umschreiben-oder-Pruefen-Muster und nicht als bereits gesicherte Leitlinie.`,
    guardrail_replace: (textValue) =>
      `Bringe "${textValue}" nicht unveraendert zurueck; dieses Muster ist wiederholt gescheitert oder offen geblieben.`,
    guardrail_pressure: (label) =>
      `${label} stand ueber mehrere Plaene hinweg weiter unter Druck. Diesen Abschnitt besser neu aufbauen statt nur leicht polieren.`,
    guardrail_domain_stable: (label) =>
      `Nutze ${label} als verlaessliches Geruest, wenn das aktuelle Lagebild weiter passt, weil dieser Bereich mehrfach getragen hat.`,
    guardrail_domain_fragile: (label) =>
      `Behandle ${label} bis zu neuerem Follow-through weiter als fragilen Versorgungsbereich.`,
  },
  es: {
    no_memory: "Todavia no hay memoria de resultados entre versiones disponible.",
    summary_counts: ({ preserveCount, replaceCount, unstableCount }) =>
      `Se detectaron ${preserveCount} patron${preserveCount === 1 ? "" : "es"} a mantener, ${replaceCount} patron${replaceCount === 1 ? "" : "es"} a sustituir y ${unstableCount} seccion${unstableCount === 1 ? "" : "es"} bajo presion en los resultados recientes del plan.`,
    summary_anchors:
      "Los ultimos planes guardados ya muestran aprendizajes utiles sobre respuesta, pero la memoria de resultados a nivel de rutina sigue siendo limitada.",
    summary_thin:
      "Ya existe memoria de resultados entre versiones, pero aun es demasiado fina para reutilizar patrones con confianza.",
    guardrail_anchor_held: (label) =>
      `Los ultimos planes guardados aguantaron mejor cuando se apoyaron en ${label}.`,
    guardrail_anchor_fragile: (label) =>
      `Mantén ${label} con verificacion activa o con una via de respaldo; sigue siendo fragil en resultados recientes.`,
    guardrail_preserve: (textValue) =>
      `Protege rutinas como "${textValue}" cuando la evidencia viva siga encajando; han aguantado varias veces.`,
    guardrail_watch: (textValue) =>
      `Cuando reaparezca una necesidad parecida, trata "${textValue}" como un patron de reescritura o verificacion, no como una pauta ya asentada.`,
    guardrail_replace: (textValue) =>
      `No vuelvas a traer "${textValue}" sin cambios; este patron ha fallado repetidamente o sigue sin resolverse.`,
    guardrail_pressure: (label) =>
      `${label} sigue bajo presion a traves de varios planes, asi que conviene reconstruir esta seccion en serio en vez de solo pulirla.`,
    guardrail_domain_stable: (label) =>
      `Usa ${label} como base fiable cuando la situacion actual siga encajando, porque ha resistido bien en resultados recientes.`,
    guardrail_domain_fragile: (label) =>
      `Trata ${label} como un dominio asistencial fragil hasta que el seguimiento mas reciente demuestre lo contrario.`,
  },
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

function objectValue(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function normalizeVersion(value) {
  const version = Number(value || 0);
  return Number.isFinite(version) && version > 0 ? version : 1;
}

function normalizeLocale(value) {
  const normalized = lower(value);
  if (normalized.startsWith("de")) return "de";
  if (normalized.startsWith("es")) return "es";
  return "en";
}

function copyFor(locale) {
  return OUTCOME_PATTERN_COPY[normalizeLocale(locale)] || OUTCOME_PATTERN_COPY.en;
}

function canonicalText(value) {
  return lower(value).replace(/[^a-z0-9]+/g, " ").trim();
}

function revisionSnapshot(revision, source = "history") {
  const snapshot = objectValue(revision?.quality_snapshot_json);
  if (!snapshot) return null;
  return {
    version_number: normalizeVersion(revision?.version_number || revision?.current_version),
    snapshot,
    language: normalizeLocale(revision?.language),
    source,
  };
}

function pushReason(map, reason) {
  const label = text(reason);
  if (!label) return;
  map.set(lower(label), label);
}

function anchorKey(anchor = {}) {
  return text(anchor?.category) || text(anchor?.labels?.[0]) || null;
}

function pushAnchor(map, anchor = {}, direction = "stable", versionNumber = 1) {
  const key = anchorKey(anchor);
  if (!key) return;
  if (!map.has(key)) {
    map.set(key, {
      category: text(anchor?.category) || "context",
      labels: [],
      stable_count: 0,
      fragile_count: 0,
      latest_reason: null,
      latest_response_profile: null,
      latest_version: versionNumber,
    });
  }
  const entry = map.get(key);
  entry.labels = unique([...(entry.labels || []), ...(Array.isArray(anchor?.labels) ? anchor.labels : [])]);
  if (direction === "stable") entry.stable_count += 1;
  if (direction === "fragile") entry.fragile_count += 1;
  if (versionNumber >= Number(entry.latest_version || 0)) {
    entry.latest_reason = text(anchor?.reason) || entry.latest_reason;
    entry.latest_response_profile = text(anchor?.response_profile) || entry.latest_response_profile;
    entry.latest_version = versionNumber;
  }
}

function patternKey(item = {}) {
  const sectionKey = text(item?.section_key);
  const normalizedText = canonicalText(item?.text);
  if (!sectionKey || !normalizedText) return null;
  return `${sectionKey}:${normalizedText}`;
}

function pushPattern(map, item = {}, bucket = "preserve", versionNumber = 1) {
  const key = patternKey(item);
  if (!key) return;
  if (!map.has(key)) {
    map.set(key, {
      section_key: text(item?.section_key),
      section_label: text(item?.section_label) || SECTION_LABELS[text(item?.section_key)] || text(item?.section_key),
      text: text(item?.text),
      preserve_count: 0,
      watch_count: 0,
      replace_count: 0,
      latest_reason: null,
      latest_action: null,
      latest_version: versionNumber,
    });
  }
  const entry = map.get(key);
  if (bucket === "preserve") entry.preserve_count += 1;
  if (bucket === "watch") entry.watch_count += 1;
  if (bucket === "replace") entry.replace_count += 1;
  if (versionNumber >= Number(entry.latest_version || 0)) {
    entry.latest_reason = text(item?.action_reason || item?.reason) || entry.latest_reason;
    entry.latest_action = text(item?.action || item?.recommended_action) || entry.latest_action;
    entry.latest_version = versionNumber;
  }
}

function pressureStatusRank(value) {
  if (value === "fragile") return 4;
  if (value === "weakening") return 3;
  if (value === "caution") return 2;
  if (value === "mixed") return 1;
  return 0;
}

function pushSectionPressure(map, item = {}, versionNumber = 1) {
  const sectionKey = text(item?.section_key);
  if (!sectionKey) return;
  const status = lower(item?.status);
  const trend = lower(item?.trend);
  const evidenceBalance = lower(item?.evidence_balance);
  const reason = text(item?.operational_learning_summary || item?.reason);
  const isPressured =
    status === "fragile"
    || trend === "weakening"
    || evidenceBalance === "caution"
    || (status === "mixed" && ["watch", "mixed"].includes(trend));
  if (!isPressured) return;

  if (!map.has(sectionKey)) {
    map.set(sectionKey, {
      section_key: sectionKey,
      section_label: SECTION_LABELS[sectionKey] || sectionKey,
      pressure_count: 0,
      fragile_count: 0,
      weakening_count: 0,
      caution_balance_count: 0,
      latest_status: null,
      latest_trend: null,
      latest_reason: null,
      latest_version: versionNumber,
      reasons: new Map(),
    });
  }
  const entry = map.get(sectionKey);
  entry.pressure_count += 1;
  if (status === "fragile") entry.fragile_count += 1;
  if (trend === "weakening") entry.weakening_count += 1;
  if (evidenceBalance === "caution") entry.caution_balance_count += 1;
  pushReason(entry.reasons, reason);
  if (versionNumber >= Number(entry.latest_version || 0)) {
    entry.latest_status = status || entry.latest_status;
    entry.latest_trend = trend || entry.latest_trend;
    entry.latest_reason = reason || entry.latest_reason;
    entry.latest_version = versionNumber;
  }
}

function pushDomain(map, item = {}, versionNumber = 1) {
  const id = text(item?.id);
  if (!id) return;
  const status = lower(item?.status);
  if (!["helping", "fragile"].includes(status)) return;
  if (!map.has(id)) {
    map.set(id, {
      id,
      label: text(item?.label) || id,
      helping_count: 0,
      fragile_count: 0,
      latest_reason: null,
      latest_version: versionNumber,
      section_labels: [],
    });
  }
  const entry = map.get(id);
  if (status === "helping") entry.helping_count += 1;
  if (status === "fragile") entry.fragile_count += 1;
  entry.section_labels = unique([...(entry.section_labels || []), ...(Array.isArray(item?.section_labels) ? item.section_labels : [])]);
  if (versionNumber >= Number(entry.latest_version || 0)) {
    entry.latest_reason = text(item?.reason) || entry.latest_reason;
    entry.latest_version = versionNumber;
  }
}

function normalizeRevisions({ existingPlan = null, history = [] } = {}) {
  return [
    ...(existingPlan ? [revisionSnapshot(existingPlan, "current")] : []),
    ...(Array.isArray(history) ? history.map((revision) => revisionSnapshot(revision, "history")) : []),
  ]
    .filter(Boolean)
    .sort((left, right) => {
      if (right.version_number !== left.version_number) return right.version_number - left.version_number;
      if (left.source === right.source) return 0;
      return left.source === "current" ? -1 : 1;
    })
    .filter((item, index, list) => list.findIndex((candidate) => candidate.version_number === item.version_number) === index)
    .slice(0, 6);
}

function sortAnchorEntries(entries = [], focus = "stable") {
  return [...entries].sort((left, right) => {
    const primary = focus === "stable"
      ? Number(right.stable_count || 0) - Number(left.stable_count || 0)
      : Number(right.fragile_count || 0) - Number(left.fragile_count || 0);
    if (primary !== 0) return primary;
    const secondary = focus === "stable"
      ? Number(left.fragile_count || 0) - Number(right.fragile_count || 0)
      : Number(right.stable_count || 0) - Number(left.stable_count || 0);
    if (secondary !== 0) return secondary;
    return text(left.labels?.[0] || left.category).localeCompare(text(right.labels?.[0] || right.category));
  });
}

function sortPatternEntries(entries = [], bucket = "preserve") {
  const countField = bucket === "replace" ? "replace_count" : bucket === "watch" ? "watch_count" : "preserve_count";
  return [...entries].sort((left, right) => {
    const byCount = Number(right[countField] || 0) - Number(left[countField] || 0);
    if (byCount !== 0) return byCount;
    return text(left.text).localeCompare(text(right.text));
  });
}

function sortSectionEntries(entries = []) {
  return [...entries].sort((left, right) => {
    const leftRank = pressureStatusRank(text(left.latest_status)) + pressureStatusRank(text(left.latest_trend));
    const rightRank = pressureStatusRank(text(right.latest_status)) + pressureStatusRank(text(right.latest_trend));
    if (rightRank !== leftRank) return rightRank - leftRank;
    return Number(right.pressure_count || 0) - Number(left.pressure_count || 0);
  });
}

function sortDomainEntries(entries = [], focus = "helping") {
  return [...entries].sort((left, right) => {
    const primary = focus === "helping"
      ? Number(right.helping_count || 0) - Number(left.helping_count || 0)
      : Number(right.fragile_count || 0) - Number(left.fragile_count || 0);
    if (primary !== 0) return primary;
    return text(left.label).localeCompare(text(right.label));
  });
}

export function buildHealthPlanOutcomePatternMemory({
  existingPlan = null,
  history = [],
} = {}) {
  const revisions = normalizeRevisions({ existingPlan, history });
  const locale = revisions[0]?.language || normalizeLocale(existingPlan?.language);
  const copy = copyFor(locale);
  if (!revisions.length) {
    return {
      summary: copy.no_memory,
      total_revisions: 0,
      stable_response_anchors: [],
      fragile_response_anchors: [],
      preserve_patterns: [],
      watch_patterns: [],
      replace_patterns: [],
      unstable_sections: [],
      stable_domains: [],
      fragile_domains: [],
      guardrails: [],
    };
  }

  const anchorMap = new Map();
  const patternMap = new Map();
  const sectionMap = new Map();
  const domainMap = new Map();

  for (const revision of revisions) {
    const snapshot = revision.snapshot || {};
    for (const anchor of Array.isArray(snapshot?.client_response_memory?.strongest_anchors) ? snapshot.client_response_memory.strongest_anchors : []) {
      pushAnchor(anchorMap, anchor, "stable", revision.version_number);
    }
    for (const anchor of Array.isArray(snapshot?.client_response_memory?.fragile_anchors) ? snapshot.client_response_memory.fragile_anchors : []) {
      pushAnchor(anchorMap, anchor, "fragile", revision.version_number);
    }
    for (const item of Array.isArray(snapshot?.recommendation_effectiveness?.preserve_now) ? snapshot.recommendation_effectiveness.preserve_now : []) {
      pushPattern(patternMap, item, "preserve", revision.version_number);
    }
    for (const item of Array.isArray(snapshot?.recommendation_effectiveness?.rework_now) ? snapshot.recommendation_effectiveness.rework_now : []) {
      pushPattern(patternMap, item, "watch", revision.version_number);
    }
    for (const item of Array.isArray(snapshot?.recommendation_effectiveness?.retire_now) ? snapshot.recommendation_effectiveness.retire_now : []) {
      pushPattern(patternMap, item, "replace", revision.version_number);
    }
    for (const item of Array.isArray(snapshot?.section_outcomes) ? snapshot.section_outcomes : []) {
      pushSectionPressure(sectionMap, item, revision.version_number);
    }
    for (const item of Array.isArray(snapshot?.intervention_memory) ? snapshot.intervention_memory : []) {
      pushDomain(domainMap, item, revision.version_number);
    }
  }

  const stableResponseAnchors = sortAnchorEntries(
    [...anchorMap.values()].filter((item) => Number(item.stable_count || 0) > 0),
    "stable",
  )
    .slice(0, 4)
    .map((item) => ({
      category: item.category,
      labels: item.labels,
      stable_count: item.stable_count,
      fragile_count: item.fragile_count,
      latest_reason: item.latest_reason,
      latest_response_profile: item.latest_response_profile,
    }));

  const fragileResponseAnchors = sortAnchorEntries(
    [...anchorMap.values()].filter((item) => Number(item.fragile_count || 0) > 0),
    "fragile",
  )
    .slice(0, 4)
    .map((item) => ({
      category: item.category,
      labels: item.labels,
      stable_count: item.stable_count,
      fragile_count: item.fragile_count,
      latest_reason: item.latest_reason,
      latest_response_profile: item.latest_response_profile,
    }));

  const preservePatterns = sortPatternEntries(
    [...patternMap.values()].filter((item) => Number(item.preserve_count || 0) > 0),
    "preserve",
  )
    .slice(0, 5)
    .map((item) => ({
      section_key: item.section_key,
      section_label: item.section_label,
      text: item.text,
      preserve_count: item.preserve_count,
      latest_reason: item.latest_reason,
    }));

  const watchPatterns = sortPatternEntries(
    [...patternMap.values()].filter((item) => Number(item.watch_count || 0) > 0),
    "watch",
  )
    .slice(0, 5)
    .map((item) => ({
      section_key: item.section_key,
      section_label: item.section_label,
      text: item.text,
      watch_count: item.watch_count,
      latest_action: item.latest_action,
      latest_reason: item.latest_reason,
    }));

  const replacePatterns = sortPatternEntries(
    [...patternMap.values()].filter((item) => Number(item.replace_count || 0) > 0),
    "replace",
  )
    .slice(0, 5)
    .map((item) => ({
      section_key: item.section_key,
      section_label: item.section_label,
      text: item.text,
      replace_count: item.replace_count,
      latest_reason: item.latest_reason,
    }));

  const unstableSections = sortSectionEntries([...sectionMap.values()])
    .slice(0, 5)
    .map((item) => ({
      section_key: item.section_key,
      section_label: item.section_label,
      pressure_count: item.pressure_count,
      fragile_count: item.fragile_count,
      weakening_count: item.weakening_count,
      caution_balance_count: item.caution_balance_count,
      latest_status: item.latest_status,
      latest_trend: item.latest_trend,
      latest_reason: item.latest_reason,
      reasons: [...item.reasons.values()].slice(0, 3),
    }));

  const stableDomains = sortDomainEntries(
    [...domainMap.values()].filter((item) => Number(item.helping_count || 0) > 0),
    "helping",
  )
    .slice(0, 4)
    .map((item) => ({
      id: item.id,
      label: item.label,
      helping_count: item.helping_count,
      fragile_count: item.fragile_count,
      latest_reason: item.latest_reason,
      section_labels: item.section_labels,
    }));

  const fragileDomains = sortDomainEntries(
    [...domainMap.values()].filter((item) => Number(item.fragile_count || 0) > 0),
    "fragile",
  )
    .slice(0, 4)
    .map((item) => ({
      id: item.id,
      label: item.label,
      helping_count: item.helping_count,
      fragile_count: item.fragile_count,
      latest_reason: item.latest_reason,
      section_labels: item.section_labels,
    }));

  const guardrails = unique([
    stableResponseAnchors[0]
      ? copy.guardrail_anchor_held(text(stableResponseAnchors[0].labels?.[0]) || stableResponseAnchors[0].category)
      : null,
    fragileResponseAnchors[0]
      ? copy.guardrail_anchor_fragile(text(fragileResponseAnchors[0].labels?.[0]) || fragileResponseAnchors[0].category)
      : null,
    preservePatterns[0]
      ? copy.guardrail_preserve(preservePatterns[0].text)
      : null,
    watchPatterns[0]
      ? copy.guardrail_watch(watchPatterns[0].text)
      : null,
    replacePatterns[0]
      ? copy.guardrail_replace(replacePatterns[0].text)
      : null,
    unstableSections[0]
      ? copy.guardrail_pressure(unstableSections[0].section_label)
      : null,
    stableDomains[0]
      ? copy.guardrail_domain_stable(stableDomains[0].label)
      : null,
    fragileDomains[0]
      ? copy.guardrail_domain_fragile(fragileDomains[0].label)
      : null,
  ]).slice(0, 6);

  const summary =
    preservePatterns.length > 0 || replacePatterns.length > 0 || unstableSections.length > 0
      ? copy.summary_counts({
        preserveCount: preservePatterns.length,
        replaceCount: replacePatterns.length,
        unstableCount: unstableSections.length,
      })
      : stableResponseAnchors.length > 0 || fragileResponseAnchors.length > 0
        ? copy.summary_anchors
        : copy.summary_thin;

  return {
    summary,
    total_revisions: revisions.length,
    stable_response_anchors: stableResponseAnchors,
    fragile_response_anchors: fragileResponseAnchors,
    preserve_patterns: preservePatterns,
    watch_patterns: watchPatterns,
    replace_patterns: replacePatterns,
    unstable_sections: unstableSections,
    stable_domains: stableDomains,
    fragile_domains: fragileDomains,
    guardrails,
  };
}
