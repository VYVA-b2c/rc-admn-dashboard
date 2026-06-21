import { describe, expect, it } from "vitest";

import { buildHealthPlanDataQualityGaps } from "./healthPlanDataQualityGaps.js";

describe("health plan data quality gaps", () => {
  it("surfaces predictive, sensor, and care-circle confidence gaps when visibility is weak", () => {
    const gaps = buildHealthPlanDataQualityGaps({
      sourceSignals: [
        {
          id: "risk-latest-score",
          label: "Predictive insights unavailable",
          detail: "This plan used live profile, service, medication, caregiver, and sensor data instead.",
        },
        {
          id: "care-circle-context",
          label: "Care circle context",
          detail: "No care provider assignment recorded",
        },
      ],
    });

    expect(gaps.map((gap) => gap.id)).toEqual(
      expect.arrayContaining(["predictive-coverage-gap", "sensor-visibility-gap", "care-circle-gap", "profile-context-gap"]),
    );
    expect(gaps.find((gap) => gap.id === "care-circle-gap")?.severity).toBe("high");
    expect(gaps.find((gap) => gap.id === "predictive-coverage-gap")?.kind).toBe("missing");
  });

  it("detects incomplete medication timing and missing adherence activity from live profile data", () => {
    const gaps = buildHealthPlanDataQualityGaps({
      profile: {
        medications: [
          { medication_name: "Aspirin", schedule_times: [] },
          { medication_name: "Vitamin D", schedule_times: ["09:00"] },
        ],
        medicationActivity: null,
      },
      sourceSignals: [
        {
          id: "medication-plan",
          label: "2 medications on file",
          detail: "1 reminder currently off",
        },
      ],
    });

    expect(gaps.map((gap) => gap.id)).toEqual(
      expect.arrayContaining(["medication-timing-gap", "medication-adherence-gap"]),
    );
    expect(gaps.find((gap) => gap.id === "medication-timing-gap")?.severity).toBe("high");
    expect(gaps.find((gap) => gap.id === "medication-adherence-gap")?.kind).toBe("missing");
  });

  it("distinguishes stale evidence from missing evidence when timestamps are too old", () => {
    const gaps = buildHealthPlanDataQualityGaps({
      now: "2026-06-20T12:00:00.000Z",
      profile: {
        user: { living_context: "alone" },
        health: { health_conditions: ["Hypertension"], mobility_needs: [] },
        medications: [{ medication_name: "Aspirin", schedule_times: ["08:00"] }],
        medicationActivity: { status: "taken", occurred_at: "2026-06-15T08:00:00.000Z" },
        sensors: [{ status: "online", last_reading_at: "2026-06-18T06:00:00.000Z" }],
        careProviders: [{ display_name: "Ana Novak" }],
        checkins: { enabled: true, frequency: "daily", last_reported_at: "2026-06-17T09:00:00.000Z" },
      },
      predictiveContext: {
        latestScore: { score_date: "2026-06-14", risk_band: "high" },
        forecastRows: [{ forecast_generated_at: "2026-06-14T10:00:00.000Z" }],
      },
      sourceSignals: [
        { id: "risk-latest-score", label: "Predictive risk score 82 (high)", detail: "As of 2026-06-14", strength: "high" },
        { id: "medication-plan", label: "1 medication on file", detail: "Saved reminder times 08:00 · Latest adherence taken", strength: "medium" },
        { id: "sensor-status", label: "1 sensor linked", detail: "All currently reporting", strength: "medium" },
        { id: "consent-family-sharing", label: "Family sharing consent confirmed", detail: "Caregiver-facing guidance can stay practical and specific.", strength: "low" },
        { id: "care-circle-context", label: "Care circle context", detail: "Living context alone · Hypertension · 1 care provider assignment", strength: "medium" },
        { id: "context-live-profile", label: "Profile context", detail: "Living context alone · Hypertension", strength: "medium" },
      ],
    });

    expect(gaps.map((gap) => gap.id)).toEqual(
      expect.arrayContaining(["predictive-freshness-gap", "medication-freshness-gap", "sensor-freshness-gap", "checkins-freshness-gap"]),
    );
    expect(gaps.every((gap) => gap.kind === "stale")).toBe(true);
  });

  it("stays quiet when the plan has solid coverage across the main inputs", () => {
    const gaps = buildHealthPlanDataQualityGaps({
      profile: {
        user: { living_context: "family" },
        health: { health_conditions: ["Hypertension"], mobility_needs: ["Walker"] },
        medications: [{ medication_name: "Aspirin", schedule_times: ["08:00"] }],
        medicationActivity: { status: "taken" },
        sensors: [{ status: "online" }],
        careProviders: [{ display_name: "Ana Novak" }],
      },
      predictiveContext: { latestScore: { risk_band: "high" }, forecastRows: [{ horizon_day: 1, predicted_score: 82 }] },
      sourceSignals: [
        { id: "risk-latest-score", label: "Predictive risk score 82 (high)", detail: "As of today", strength: "high" },
        { id: "medication-plan", label: "1 medication on file", detail: "Saved reminder times 08:00 · Latest adherence taken", strength: "medium" },
        { id: "sensor-status", label: "1 sensor linked", detail: "All currently reporting", strength: "medium" },
        { id: "consent-family-sharing", label: "Family sharing consent confirmed", detail: "Caregiver-facing guidance can stay practical and specific.", strength: "low" },
        { id: "care-circle-context", label: "Care circle context", detail: "Living context family · Hypertension, Walker · 1 care provider assignment", strength: "medium" },
        { id: "context-live-profile", label: "Profile context", detail: "Living context family · Hypertension, Walker", strength: "medium" },
      ],
    });

    expect(gaps).toEqual([]);
  });
});
