import { describe, expect, it } from "vitest";

import { buildHealthPlanBenchmarkReplayFromHistory } from "./healthPlanBenchmarkReplayHistory.js";

describe("health plan benchmark replay from history", () => {
  it("turns real revision history into replay tracks and a release gate", () => {
    const summary = buildHealthPlanBenchmarkReplayFromHistory({
      history: [
        {
          id: "plan-v2",
          version_number: 2,
          action_type: "edited",
          created_at: "2026-06-18T10:00:00.000Z",
          source_signals_json: [
            { id: "alert-active", label: "Active fall alert", category: "alert", strength: "high" },
            { id: "service-checkins", label: "Missed check-ins", category: "service", strength: "high" },
          ],
          quality_snapshot_json: {
            evidence_pack: {
              same_day_response_required: true,
              must_address_facts: [
                { source_signal_ids: ["alert-active"] },
                { source_signal_ids: ["service-checkins"] },
              ],
            },
          },
          summary_text: "Maintain support and stay observant.",
          summary_signal_ids: [],
          goals_json: [{ text: "Maintain stability.", source_signal_ids: [] }],
          daily_support_json: [{ text: "Continue support.", source_signal_ids: [] }],
          monitoring_json: [{ text: "Observe changes.", timing: "ongoing", priority: "low", source_signal_ids: [] }],
          escalation_json: [],
          caregiver_guidance_json: [],
        },
        {
          id: "plan-v3",
          version_number: 3,
          action_type: "regenerated",
          created_at: "2026-06-19T10:00:00.000Z",
          source_signals_json: [
            { id: "alert-active", label: "Active fall alert", category: "alert", strength: "high" },
            { id: "service-checkins", label: "Missed check-ins", category: "service", strength: "high" },
            { id: "care-circle-context", label: "Caregiver backup", category: "care-circle", strength: "medium" },
          ],
          quality_snapshot_json: {
            evidence_pack: {
              same_day_response_required: true,
              must_address_facts: [
                { source_signal_ids: ["alert-active"] },
                { source_signal_ids: ["service-checkins"] },
              ],
              verification_needs: [
                { source_signal_ids: ["service-checkins"] },
              ],
              stabilizing_facts: [
                { source_signal_ids: ["care-circle-context"] },
              ],
            },
          },
          summary_text: "An active fall alert and repeated missed check-ins require same-day verification and a fallback outreach owner.",
          summary_signal_ids: ["alert-active", "service-checkins"],
          goals_json: [{ text: "Keep caregiver backup engaged so same-day outreach does not depend on one failed call.", source_signal_ids: ["care-circle-context"] }],
          daily_support_json: [{ text: "Preserve caregiver backup and log who can attempt the next same-day contact if the first outreach fails.", source_signal_ids: ["care-circle-context"] }],
          monitoring_json: [{
            text: "Verify the fall alert status today and confirm whether the missed check-ins reflect a real no-response pattern.",
            timing: "today",
            priority: "high",
            verification_required: true,
            completion_signal: "Record what was confirmed and whether the same-day no-response risk remains active.",
            owner_role: "assigned_staff",
            source_signal_ids: ["alert-active", "service-checkins"],
          }],
          escalation_json: [{
            text: "Escalate today to the on-call coordinator and use the fallback outreach owner if contact still fails.",
            timing: "today",
            priority: "high",
            verification_required: true,
            completion_signal: "Close the loop once the on-call coordinator or fallback responder is reached and the outcome is logged.",
            owner_role: "assigned_staff",
            fallback_owner_role: "on_call_coordinator",
            source_signal_ids: ["alert-active"],
          }],
          caregiver_guidance_json: [{
            text: "Ask the caregiver to confirm whether they can attempt contact today and report back if the client remains unreachable.",
            timing: "today",
            priority: "medium",
            verification_required: true,
            completion_signal: "Document what the caregiver reports back and whether a further staff attempt is needed today.",
            owner_role: "caregiver",
            source_signal_ids: ["care-circle-context"],
          }],
        },
      ],
    });

    expect(summary).toMatchObject({
      total_tracks: 1,
      eligible_revision_count: 2,
    });
    expect(summary.release_gate).toMatchObject({
      passed: true,
      status: "passed",
    });
    expect(summary.matched_scenarios).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          scenario_id: "urgent_unreachable_fall_risk",
          snapshot_count: 2,
        }),
      ]),
    );
    expect(summary.tracks[0]).toMatchObject({
      scenario_id: "urgent_unreachable_fall_risk",
      improved: true,
      regressed: false,
    });
  });

  it("returns a helpful empty summary when history does not match any benchmark strongly enough", () => {
    const summary = buildHealthPlanBenchmarkReplayFromHistory({
      history: [
        {
          id: "plan-v1",
          version_number: 1,
          source_signals_json: [
            { id: "profile-context", label: "Profile context only", category: "context", strength: "low" },
          ],
          quality_snapshot_json: {
            evidence_pack: {
              same_day_response_required: false,
            },
          },
          summary_text: "Maintain routines.",
          summary_signal_ids: ["profile-context"],
          goals_json: [{ text: "Maintain routines.", source_signal_ids: ["profile-context"] }],
          daily_support_json: [],
          monitoring_json: [],
          escalation_json: [],
          caregiver_guidance_json: [],
        },
      ],
    });

    expect(summary).toMatchObject({
      total_tracks: 0,
      eligible_revision_count: 1,
      release_gate: null,
    });
    expect(summary.summary).toContain("no benchmark scenario matched strongly enough");
  });

  it("fails the history replay gate when later saved outcomes contradict the latest matched plan", () => {
    const summary = buildHealthPlanBenchmarkReplayFromHistory({
      history: [
        {
          id: "plan-v2",
          version_number: 2,
          action_type: "generated",
          created_at: "2026-06-18T10:00:00.000Z",
          source_signals_json: [
            { id: "alert-active", label: "Active fall alert", category: "alert", strength: "high" },
            { id: "service-checkins", label: "Missed check-ins", category: "service", strength: "high" },
          ],
          quality_snapshot_json: {
            evidence_pack: {
              same_day_response_required: true,
              must_address_facts: [
                { source_signal_ids: ["alert-active"] },
                { source_signal_ids: ["service-checkins"] },
              ],
            },
            action_impact: {
              overall_status: "reinforcing",
              reinforced_count: 2,
              mixed_count: 0,
              contradicted_count: 0,
            },
            recommendation_impact: {
              overall_status: "reinforcing",
              reinforced_count: 3,
              mixed_count: 0,
              contradicted_count: 0,
              high_priority_contradicted_count: 0,
              retire_count: 0,
              rework_count: 0,
            },
          },
          summary_text: "Verify the alert today and keep the caregiver backup loop active.",
          summary_signal_ids: ["alert-active", "service-checkins"],
          goals_json: [{ text: "Keep same-day contact coverage intact.", source_signal_ids: ["service-checkins"] }],
          daily_support_json: [{ text: "Use the caregiver backup if the first outreach fails.", source_signal_ids: ["service-checkins"] }],
          monitoring_json: [{
            text: "Verify the fall alert today.",
            timing: "today",
            priority: "high",
            verification_required: true,
            completion_signal: "Record whether the alert was confirmed and whether same-day risk remains open.",
            owner_role: "assigned_staff",
            source_signal_ids: ["alert-active"],
          }],
          escalation_json: [{
            text: "Escalate today if the client remains unreachable.",
            timing: "today",
            priority: "high",
            verification_required: true,
            completion_signal: "Close the loop once the same-day escalation owner or fallback responder is reached.",
            owner_role: "assigned_staff",
            fallback_owner_role: "on_call_coordinator",
            source_signal_ids: ["alert-active"],
          }],
          caregiver_guidance_json: [],
        },
        {
          id: "plan-v3",
          version_number: 3,
          action_type: "edited",
          created_at: "2026-06-19T10:00:00.000Z",
          source_signals_json: [
            { id: "alert-active", label: "Active fall alert", category: "alert", strength: "high" },
            { id: "service-checkins", label: "Missed check-ins", category: "service", strength: "high" },
          ],
          quality_snapshot_json: {
            evidence_pack: {
              same_day_response_required: true,
              must_address_facts: [
                { source_signal_ids: ["alert-active"] },
                { source_signal_ids: ["service-checkins"] },
              ],
            },
            action_impact: {
              overall_status: "contradicted",
              reinforced_count: 0,
              mixed_count: 1,
              contradicted_count: 2,
            },
            recommendation_impact: {
              overall_status: "contradicted",
              reinforced_count: 0,
              mixed_count: 1,
              contradicted_count: 2,
              high_priority_contradicted_count: 1,
              retire_count: 1,
              rework_count: 1,
            },
          },
          summary_text: "Maintain support and stay observant.",
          summary_signal_ids: [],
          goals_json: [{ text: "Maintain stability.", source_signal_ids: [] }],
          daily_support_json: [{ text: "Continue support.", source_signal_ids: [] }],
          monitoring_json: [{ text: "Observe changes.", timing: "ongoing", priority: "low", source_signal_ids: [] }],
          escalation_json: [],
          caregiver_guidance_json: [],
        },
      ],
    });

    expect(summary).toMatchObject({
      total_tracks: 1,
      contradicted_outcome_count: 1,
    });
    expect(summary.release_gate).toMatchObject({
      passed: false,
      status: "failed",
    });
    expect(summary.release_gate?.blocking_reasons).toEqual(
      expect.arrayContaining([
        expect.stringContaining("later saved outcomes"),
      ]),
    );
    expect(summary.release_gate?.recommended_actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "replace_contradicted_high_priority_recommendations", priority: "high" }),
      ]),
    );
    expect(summary.tracks[0]).toMatchObject({
      latest_outcome_status: "contradicted",
      latest_high_priority_contradicted_recommendation_count: 1,
    });
  });
});
