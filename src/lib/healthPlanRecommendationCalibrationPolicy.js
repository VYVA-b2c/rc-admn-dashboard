function text(value) {
  return String(value || "").trim();
}

function objectValue(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function normalizeCount(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export function shouldAttemptHealthPlanCalibrationRepair(summary = null) {
  const normalized = objectValue(summary);
  if (!normalized) return false;
  const adjustmentCount = normalizeCount(normalized.adjustment_count);
  const highPressureCount = normalizeCount(normalized.high_pressure_adjustment_count);
  const verificationAddedCount = normalizeCount(normalized.verification_added_count);
  return highPressureCount > 0 || adjustmentCount >= 2 || verificationAddedCount >= 2;
}

export function buildHealthPlanCalibrationRepairBrief(summary = null) {
  const normalized = objectValue(summary);
  if (!normalized) return null;
  const items = Array.isArray(normalized.items) ? normalized.items : [];
  const filteredItems = items
    .map((item) => ({
      section_key: text(item?.section_key) || null,
      item_id: text(item?.item_id) || null,
      text: text(item?.text) || null,
      requested_confidence: text(item?.requested_confidence) || null,
      applied_confidence: text(item?.applied_confidence) || null,
      verification_added: item?.verification_added === true,
      high_pressure: item?.high_pressure === true,
      reason: text(item?.reason) || null,
    }))
    .filter((item) => item.section_key && item.text);

  const highPressureCount = normalizeCount(normalized.high_pressure_adjustment_count);
  const adjustmentCount = normalizeCount(normalized.adjustment_count);
  const verificationAddedCount = normalizeCount(normalized.verification_added_count);

  return {
    summary: text(normalized.summary) || null,
    adjustment_count: adjustmentCount,
    confidence_downgrade_count: normalizeCount(normalized.confidence_downgrade_count),
    verification_added_count: verificationAddedCount,
    high_pressure_adjustment_count: highPressureCount,
    instruction:
      highPressureCount > 0
        ? "Rewrite the affected high-pressure recommendations so their caution, confidence, and verification wording are already correct before validation."
        : "Rewrite the affected recommendations so their confidence and verification wording already matches the evidence before validation.",
    focus:
      highPressureCount > 0
        ? "same-day or high-priority recommendations"
        : adjustmentCount >= 2
          ? "recommendations that still overstate certainty"
          : "recommendations that still need verification wording",
    items: filteredItems.slice(0, 6),
  };
}

export function buildHealthPlanCalibrationRepairMessage(summary = null) {
  const brief = buildHealthPlanCalibrationRepairBrief(summary);
  if (!brief) return "The validator had to soften parts of the draft before acceptance.";
  const parts = [
    brief.summary || "The validator had to soften parts of the draft before acceptance.",
    brief.high_pressure_adjustment_count > 0
      ? `${brief.high_pressure_adjustment_count} high-pressure recommendations needed softer or more verification-led wording.`
      : null,
    brief.verification_added_count > 0
      ? `${brief.verification_added_count} recommendations needed explicit verification steps added.`
      : null,
  ].filter(Boolean);
  return parts.join(" ");
}
