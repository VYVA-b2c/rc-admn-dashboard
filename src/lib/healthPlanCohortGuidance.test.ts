import { describe, expect, it } from "vitest";

import { buildHealthPlanCohortGuidance } from "./healthPlanCohortGuidance.js";

describe("healthPlanCohortGuidance", () => {
  it("surfaces cautious same-organization peer patterns when similar cases line up", () => {
    const guidance = buildHealthPlanCohortGuidance({
      profile: {
        language: "de",
        living_context: "independent",
        health_conditions: ["diabetes", "hypertension"],
        mobility_needs: ["walker"],
      },
      peerPlans: [
        {
          vyva_user_id: "peer-1",
          language: "de",
          living_context: "independent",
          health_conditions: ["diabetes"],
          mobility_needs: ["walker"],
          source_signals_json: [
            { id: "service-checkins", category: "service" },
            { id: "care-circle-context", category: "care-circle" },
            { id: "medication-plan", category: "medication" },
          ],
          quality_snapshot_json: {
            client_response_memory: {
              strongest_anchors: [{ category: "service", labels: ["Check-ins"] }],
              fragile_anchors: [{ category: "medication", labels: ["Medication follow-through"] }],
            },
            recommendation_effectiveness: {
              preserve_now: [{ text: "Keep caregiver-backed check-ins.", source_signal_ids: ["service-checkins", "care-circle-context"] }],
              rework_now: [{ text: "Medication reminders still need confirmation.", source_signal_ids: ["medication-plan"] }],
              retire_now: [],
            },
          },
        },
        {
          vyva_user_id: "peer-2",
          language: "de",
          living_context: "independent",
          health_conditions: ["diabetes", "hypertension"],
          mobility_needs: ["walker"],
          source_signals_json: [
            { id: "service-checkins", category: "service" },
            { id: "medication-plan", category: "medication" },
          ],
          quality_snapshot_json: {
            client_response_memory: {
              strongest_anchors: [{ category: "service", labels: ["Check-ins"] }],
              fragile_anchors: [{ category: "medication", labels: ["Medication follow-through"] }],
            },
            recommendation_effectiveness: {
              preserve_now: [{ text: "Keep same-day check-ins concrete.", source_signal_ids: ["service-checkins"] }],
              rework_now: [],
              retire_now: [{ text: "Do not rely on medication reminders alone.", source_signal_ids: ["medication-plan"] }],
            },
          },
        },
      ],
      clientResponseMemory: {
        strongest_anchors: [],
        fragile_anchors: [],
      },
      recommendationEffectiveness: {
        preserve_now: [],
        rework_now: [],
        retire_now: [],
      },
    });

    expect(guidance.overall_status).toBe("limited");
    expect(guidance.usage_mode).toBe("augment");
    expect(guidance.matched_peer_count).toBe(2);
    expect(guidance.strong_peer_anchors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: "service",
          matched_peer_count: 2,
        }),
      ]),
    );
    expect(guidance.fragile_peer_anchors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: "medication",
          matched_peer_count: 2,
        }),
      ]),
    );
    expect(guidance.section_guidance).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          section_key: "daily_support_json",
          reinforce: expect.arrayContaining([expect.stringMatching(/similar same-organization cases responded better/i)]),
        }),
      ]),
    );
  });

  it("stays fallback-only when the client already has strong direct history", () => {
    const guidance = buildHealthPlanCohortGuidance({
      profile: {
        language: "de",
        living_context: "independent",
        health_conditions: ["diabetes"],
        mobility_needs: [],
      },
      peerPlans: [
        {
          vyva_user_id: "peer-1",
          language: "de",
          living_context: "independent",
          health_conditions: ["diabetes"],
          mobility_needs: [],
          quality_snapshot_json: {
            client_response_memory: {
              strongest_anchors: [{ category: "service", labels: ["Check-ins"] }],
            },
          },
        },
        {
          vyva_user_id: "peer-2",
          language: "de",
          living_context: "independent",
          health_conditions: ["diabetes"],
          mobility_needs: [],
          quality_snapshot_json: {
            client_response_memory: {
              strongest_anchors: [{ category: "service", labels: ["Check-ins"] }],
            },
          },
        },
      ],
      clientResponseMemory: {
        strongest_anchors: [{ category: "service", labels: ["Check-ins"] }],
        fragile_anchors: [{ category: "medication", labels: ["Medication follow-through"] }],
      },
      recommendationEffectiveness: {
        preserve_now: [{ text: "Keep the morning check-in routine." }],
        rework_now: [{ text: "Verify medication completion." }],
        retire_now: [{ text: "Do not repeat the old reminder-only script." }],
      },
    });

    expect(guidance.usage_mode).toBe("fallback_only");
    expect(guidance.guardrails[0]).toMatch(/tie-breaker/i);
  });
});
