function track({ id, label, scenario_id, snapshots = [] }) {
  return {
    id,
    label,
    scenario_id,
    snapshots,
  };
}

function snapshot({ revision_id, label, plan }) {
  return {
    revision_id,
    label,
    plan,
  };
}

export const healthPlanBenchmarkReplayFixtures = [
  track({
    id: "urgent_fall_progression",
    label: "Urgent fall-risk rewrite progression",
    scenario_id: "urgent_unreachable_fall_risk",
    snapshots: [
      snapshot({
        revision_id: "baseline_vague",
        label: "Baseline vague draft",
        plan: {
          summary_text: "Maintain support and stay observant.",
          summary_signal_ids: [],
          goals_json: [{ text: "Maintain stability.", source_signal_ids: [] }],
          daily_support_json: [{ text: "Continue support.", source_signal_ids: [] }],
          monitoring_json: [{ text: "Observe changes.", timing: "ongoing", priority: "low", source_signal_ids: [] }],
          escalation_json: [],
          caregiver_guidance_json: [],
        },
      }),
      snapshot({
        revision_id: "current_strong",
        label: "Current strong draft",
        plan: {
          summary_text: "An active fall alert and repeated missed check-ins require same-day verification and a fallback outreach owner.",
          summary_signal_ids: ["alert-active", "service-checkins"],
          goals_json: [
            { text: "Keep caregiver backup engaged so same-day outreach does not depend on one failed call.", source_signal_ids: ["care-circle-context"] },
          ],
          daily_support_json: [
            { text: "Preserve caregiver backup and log who can attempt the next same-day contact if the first outreach fails.", source_signal_ids: ["care-circle-context"] },
          ],
          monitoring_json: [
            {
              text: "Verify the fall alert status today and confirm whether the missed check-ins reflect a real no-response pattern.",
              timing: "today",
              priority: "high",
              verification_required: true,
              completion_signal: "Record what was confirmed and whether the same-day no-response risk remains active.",
              owner_role: "assigned_staff",
              source_signal_ids: ["alert-active", "service-checkins"],
            },
          ],
          escalation_json: [
            {
              text: "Escalate today to the on-call coordinator and use the fallback outreach owner if contact still fails.",
              timing: "today",
              priority: "high",
              verification_required: true,
              completion_signal: "Close the loop once the on-call coordinator or fallback responder is reached and the outcome is logged.",
              owner_role: "assigned_staff",
              fallback_owner_role: "on_call_coordinator",
              source_signal_ids: ["alert-active"],
            },
          ],
          caregiver_guidance_json: [
            {
              text: "Ask the caregiver to confirm whether they can attempt contact today and report back if the client remains unreachable.",
              timing: "today",
              priority: "medium",
              verification_required: true,
              completion_signal: "Document what the caregiver reports back and whether a further staff attempt is needed today.",
              owner_role: "caregiver",
              source_signal_ids: ["care-circle-context"],
            },
          ],
        },
      }),
    ],
  }),
  track({
    id: "medication_adherence_progression",
    label: "Medication adherence progression",
    scenario_id: "medication_uncertainty_and_adherence_slip",
    snapshots: [
      snapshot({
        revision_id: "baseline_generic",
        label: "Baseline generic draft",
        plan: {
          summary_text: "Keep routines steady and monitor medications.",
          summary_signal_ids: ["medication-plan"],
          goals_json: [{ text: "Support stability at home.", source_signal_ids: ["medication-plan"] }],
          daily_support_json: [{ text: "Remind about medication when possible.", source_signal_ids: ["medication-plan"] }],
          monitoring_json: [{ text: "Observe whether medication issues continue.", timing: "ongoing", priority: "low", source_signal_ids: ["medication-plan"] }],
          escalation_json: [],
          caregiver_guidance_json: [],
        },
      }),
      snapshot({
        revision_id: "mid_partial",
        label: "Mid partial rewrite",
        plan: {
          summary_text: "Unconfirmed medication doses need a more reliable check-in routine this week.",
          summary_signal_ids: ["medication-plan"],
          goals_json: [{ text: "Protect medication continuity this week.", source_signal_ids: ["medication-plan"] }],
          daily_support_json: [{ text: "Use the morning support call to confirm whether medication was taken and whether reminders still fit the real routine.", timing: "this_week", priority: "high", source_signal_ids: ["medication-plan", "service-checkins"] }],
          monitoring_json: [{
            text: "Review whether missed doses continue and check for barriers.",
            timing: "this_week",
            priority: "medium",
            verification_required: true,
            completion_signal: "Log whether adherence barriers were confirmed and whether medication confidence improved this week.",
            owner_role: "assigned_staff",
            source_signal_ids: ["medication-plan"],
          }],
          escalation_json: [],
          caregiver_guidance_json: [{
            text: "Ask the caregiver to reinforce the plan if missed doses continue.",
            timing: "this_week",
            priority: "medium",
            verification_required: true,
            completion_signal: "Document whether the caregiver reinforcement happened and whether medication follow-up is still needed.",
            owner_role: "caregiver",
            source_signal_ids: ["care-circle-context"],
          }],
        },
      }),
      snapshot({
        revision_id: "current_strong",
        label: "Current strong draft",
        plan: {
          summary_text: "Unconfirmed medication doses need confirmation and a tighter medication routine this week.",
          summary_signal_ids: ["medication-plan"],
          goals_json: [{ text: "Protect medication continuity without assuming reminder times still fit.", source_signal_ids: ["medication-plan"] }],
          daily_support_json: [{ text: "Confirm the medication routine, preserve the morning support call, and document whether reminder times still fit real life.", timing: "this_week", priority: "high", source_signal_ids: ["medication-plan", "service-checkins"] }],
          monitoring_json: [{
            text: "Review whether any dose was missed, confirm adherence barriers, and if missed doses continue call the caregiver and log the fallback follow-up this week.",
            timing: "this_week",
            priority: "medium",
            verification_required: true,
            completion_signal: "Record whether the missed dose pattern was confirmed and whether the fallback follow-up was triggered this week.",
            owner_role: "assigned_staff",
            source_signal_ids: ["medication-plan", "care-circle-context"],
          }],
          escalation_json: [],
          caregiver_guidance_json: [{
            text: "Ask the caregiver to reinforce the medication plan if missed doses continue.",
            timing: "this_week",
            priority: "medium",
            verification_required: true,
            completion_signal: "Document whether the caregiver reinforcement happened and whether further medication outreach is still needed.",
            owner_role: "caregiver",
            source_signal_ids: ["care-circle-context"],
          }],
        },
      }),
    ],
  }),
  track({
    id: "caregiver_consent_progression",
    label: "Caregiver consent progression",
    scenario_id: "caregiver_gap_with_consent_limit",
    snapshots: [
      snapshot({
        revision_id: "baseline_soft",
        label: "Baseline soft draft",
        plan: {
          summary_text: "Support should remain coordinated while routines continue.",
          summary_signal_ids: ["service-checkins"],
          goals_json: [{ text: "Keep support steady.", source_signal_ids: ["service-checkins"] }],
          daily_support_json: [{ text: "Maintain check-ins.", source_signal_ids: ["service-checkins"] }],
          monitoring_json: [],
          escalation_json: [],
          caregiver_guidance_json: [{ text: "Keep family informed when helpful.", source_signal_ids: ["care-circle-context"] }],
        },
      }),
      snapshot({
        revision_id: "current_stronger",
        label: "Current stronger draft",
        plan: {
          summary_text: "Support ownership is unclear, so consent and escalation contacts need confirmation before assumptions are made.",
          summary_signal_ids: ["care-circle-context", "consent-family-sharing"],
          goals_json: [{ text: "Keep check-in continuity while clarifying who can safely receive updates.", source_signal_ids: ["service-checkins"] }],
          daily_support_json: [{ text: "Preserve the check-in routine while support ownership is being clarified.", source_signal_ids: ["service-checkins"] }],
          monitoring_json: [{
            text: "Confirm whether any contact changes should wait until family-sharing consent is reconfirmed.",
            timing: "this_week",
            priority: "medium",
            verification_required: true,
            completion_signal: "Record whether consent was reconfirmed and whether contact ownership is now clear.",
            owner_role: "assigned_staff",
            source_signal_ids: ["consent-family-sharing"],
          }],
          escalation_json: [],
          caregiver_guidance_json: [{
            text: "Confirm consent before sharing updates, identify who can act, and document the support owner once confirmed.",
            timing: "this_week",
            priority: "high",
            verification_required: true,
            completion_signal: "Document who can safely receive updates and what the confirmed support ownership is.",
            owner_role: "caregiver",
            source_signal_ids: ["care-circle-context", "consent-family-sharing"],
          }],
        },
      }),
    ],
  }),
];
