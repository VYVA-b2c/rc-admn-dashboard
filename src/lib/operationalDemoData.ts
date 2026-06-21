import type { GISUser } from "@/hooks/useGISData";
import { annotateHealthPlanHistory } from "@/lib/healthPlanRevisionDiff";
import { buildHealthPlanBenchmarkReplayFromHistory } from "@/lib/healthPlanBenchmarkReplayHistory";

export type OperationalStatus = "urgent" | "review" | "stable";
export type OperationalChannel = "phone" | "whatsapp" | "app";

export interface OperationalListMeta {
  age?: number;
  assignedTo?: string | null;
  preferredChannel: OperationalChannel;
  lastContactKey?: string;
  lastContactAt?: string | null;
  lastContactStatus?: string | null;
  livingContextKey?: string;
  nextActionKey?: string;
  noResponse?: boolean;
  reasonKey: string;
  riskStatus: OperationalStatus;
}

export type OperationalQueueUser = GISUser & {
  operationalContext?: OperationalListMeta;
};

export interface OperationalProfileContext extends OperationalListMeta {
  familyConsentKey?: string;
  recentSignalKeys: string[];
  recommendedQuestionKeys: string[];
  suggestedOpeningKey: string;
  summaryKey: string;
}

export type ProfileRecord = Record<string, unknown>;

export interface OperationalProfileUser extends ProfileRecord {
  id: string;
  city?: string | null;
  created_at?: string;
  date_of_birth?: string | null;
  emergency_notes?: string | null;
  first_name?: string | null;
  gender?: string | null;
  house_number?: string | null;
  language?: string | null;
  last_name?: string | null;
  living_context?: string | null;
  phone?: string | null;
  photo_url?: string | null;
  post_code?: string | null;
  street?: string | null;
}

export interface OperationalConsent extends ProfileRecord {
  id?: string;
  caretaker_consent?: boolean;
  consent_given?: boolean;
  created_at?: string;
}

export interface OperationalHealth extends ProfileRecord {
  id?: string;
  health_conditions?: string[];
  mobility_needs?: string[];
}

export interface OperationalMedication extends ProfileRecord {
  id: string;
  created_at?: string;
  dosage?: string | null;
  frequency?: string | null;
  medication_name?: string | null;
  purpose?: string | null;
  reminders_enabled?: boolean;
  schedule_times?: string[];
}

export interface OperationalMedicationActivity extends ProfileRecord {
  id?: string;
  medication_id?: string | null;
  medication_name?: string | null;
  status?: string | null;
  occurred_at?: string | null;
  reported_at?: string | null;
  scheduled_date?: string | null;
  scheduled_time?: string | null;
}

export interface HealthPlanSectionItem extends ProfileRecord {
  id?: string;
  text: string;
  source_signal_ids?: string[];
  priority?: "high" | "medium" | "low" | null;
  confidence?: "high" | "medium" | "low" | null;
  timing?: "today" | "this_week" | "ongoing" | null;
  verification_required?: boolean | null;
  completion_signal?: string | null;
  owner_role?: "assigned_staff" | "caregiver" | "on_call_coordinator" | "care_team" | null;
  fallback_owner_role?: "assigned_staff" | "caregiver" | "on_call_coordinator" | "care_team" | null;
  origin_type?: "ai_generated" | "human_added" | "human_edited" | null;
  original_generated_text?: string | null;
  original_generated_at?: string | null;
  last_modified_at?: string | null;
  last_modified_by_user_id?: string | null;
  last_modified_by_email?: string | null;
  edit_reason?: string | null;
  evidence_receipt?: {
    trust_level?: "strong" | "guarded" | "fragile" | null;
    support_mode?: "action" | "verification" | "stabilizing" | "context" | null;
    driver_signal_ids?: string[];
    driver_labels?: string[];
    summary?: string | null;
    attention_status?: "reinforced" | "mixed" | "contradicted" | "verify" | "watch" | null;
    attention_note?: string | null;
  } | null;
}

export interface HealthPlanSourceSignal extends ProfileRecord {
  id?: string;
  label: string;
  detail?: string | null;
  category?: string | null;
  strength?: "high" | "medium" | "low" | null;
}

export interface HealthPlanDataQualityGap extends ProfileRecord {
  id?: string;
  label: string;
  detail?: string | null;
  kind?: "missing" | "stale" | null;
  severity?: "high" | "medium" | "low" | null;
  staff_action?: string | null;
}

export interface HealthPlanFollowThroughSignal extends ProfileRecord {
  id?: string;
  label?: string | null;
  detail?: string | null;
}

export interface OperationalHealthPlanFeedback extends ProfileRecord {
  status?: "fresh" | "mixed" | "needs_review" | null;
  generated_at?: string | null;
  hours_since_generation?: number | null;
  fresh_touchpoints_count?: number | null;
  positive_signals?: HealthPlanFollowThroughSignal[];
  caution_signals?: HealthPlanFollowThroughSignal[];
  summary?: string | null;
  recommendation?: string | null;
}

export interface HealthPlanCompletedImprovementAction extends ProfileRecord {
  action_id?: string | null;
  title?: string | null;
  section_key?: string | null;
  completed_at?: string | null;
  completed_by_user_id?: string | null;
  completed_by_email?: string | null;
  note?: string | null;
}

export interface HealthPlanFeedbackEntry extends ProfileRecord {
  id?: string | null;
  section_key?: string | null;
  item_id?: string | null;
  outcome?: "helped" | "mixed" | "did_not_help" | "needs_follow_up" | null;
  recommended_next_action?: "preserve" | "verify" | "rework" | "retire" | null;
  confidence_level?: "high" | "medium" | "low" | null;
  source?: string | null;
  note?: string | null;
  recorded_at?: string | null;
  recorded_by_user_id?: string | null;
  recorded_by_email?: string | null;
}

export interface OperationalRecentActivity extends ProfileRecord {
  id?: string | null;
  source?: string | null;
  status?: string | null;
  occurred_at?: string | null;
  label?: string | null;
  note?: string | null;
  signal_ids?: string[];
}

export interface HealthPlanRecommendationLearningItem extends ProfileRecord {
  item_id?: string | null;
  section_key?: string | null;
  section_label?: string | null;
  text?: string | null;
  status?: "helping" | "mixed" | "fragile" | "unproven" | null;
  score?: number | null;
  latest_outcome?: "helped" | "mixed" | "did_not_help" | "needs_follow_up" | null;
  inherited_section_outcome?: "helped" | "mixed" | "did_not_help" | "needs_follow_up" | null;
  latest_note?: string | null;
  latest_source?: string | null;
  latest_recommended_next_action?: "preserve" | "verify" | "rework" | "retire" | null;
  latest_confidence_level?: "high" | "medium" | "low" | null;
  freshness_status?: "fresh" | "aging" | "stale" | null;
  feedback_count?: number | null;
  helped_count?: number | null;
  mixed_count?: number | null;
  did_not_help_count?: number | null;
  needs_follow_up_count?: number | null;
  operational_positive_count?: number | null;
  operational_caution_count?: number | null;
  operational_pattern?: "reinforcing" | "mixed" | "conflicting" | "limited" | null;
  operational_source_labels?: string[];
  operational_reason?: string | null;
  last_operational_at?: string | null;
  trajectory?: "strengthening" | "stable" | "weakening" | "volatile" | "untested" | null;
  reuse_priority?: "preserve" | "refine" | "replace" | "verify" | null;
  contradiction_status?: "live_conflict" | "improving_against_feedback" | "section_conflict" | null;
  contradiction_reason?: string | null;
  source_signal_ids?: string[];
  reason?: string | null;
}

export interface HealthPlanReviewChecklist extends ProfileRecord {
  reachability_confirmed?: boolean;
  medication_risk_checked?: boolean;
  escalation_path_confirmed?: boolean;
  next_touchpoint_confirmed?: boolean;
  confirmation_audit?: Record<string, {
    label?: string | null;
    confirmed_at?: string | null;
    confirmed_by_user_id?: string | null;
    confirmed_by_email?: string | null;
  }> | null;
  life_safety_confirmations?: Record<string, {
    confirmed?: boolean;
    label?: string | null;
    confirmed_at?: string | null;
    confirmed_by_user_id?: string | null;
    confirmed_by_email?: string | null;
  }> | null;
  note?: string | null;
}

export interface OperationalHealthPlan extends ProfileRecord {
  id: string;
  current_version?: number;
  last_action_type?: "generated" | "regenerated" | "edited" | "reviewed" | null;
  last_action_at?: string | null;
  last_actor_user_id?: string | null;
  last_actor_email?: string | null;
  language?: string | null;
  status?: string | null;
  review_status?: "draft" | "reviewed" | null;
  escalation_grade?: "routine" | "heightened" | "urgent" | null;
  review_required?: boolean;
  review_window?: "today" | "this_week" | "ongoing" | null;
  review_summary?: string | null;
  review_reasons_json?: Array<{
    id?: string | null;
    label?: string | null;
    detail?: string | null;
    severity?: "high" | "medium" | "low" | null;
    source?: string | null;
  }>;
  review_note?: string | null;
  review_checklist_json?: HealthPlanReviewChecklist | null;
  recommendation_review_decisions_json?: Array<{
    item_key?: string | null;
    item_id?: string | null;
    section_key?: string | null;
    section_label?: string | null;
    text?: string | null;
    decision_status?: "approved" | "watch" | "needs_edit" | null;
    rationale?: string | null;
    updated_at?: string | null;
    updated_by_user_id?: string | null;
    updated_by_email?: string | null;
  }>;
  summary_text?: string | null;
  summary_signal_ids?: string[];
  goals_json?: HealthPlanSectionItem[];
  daily_support_json?: HealthPlanSectionItem[];
  monitoring_json?: HealthPlanSectionItem[];
  escalation_json?: HealthPlanSectionItem[];
  caregiver_guidance_json?: HealthPlanSectionItem[];
  source_signals_json?: HealthPlanSourceSignal[];
  data_quality_gaps_json?: HealthPlanDataQualityGap[];
  completed_improvement_actions_json?: HealthPlanCompletedImprovementAction[];
  feedback_entries_json?: HealthPlanFeedbackEntry[];
  inferred_feedback_json?: HealthPlanFeedbackEntry[];
  recommendation_learning_json?: HealthPlanRecommendationLearningItem[];
  generator_provider?: string | null;
  generator_model?: string | null;
  generator_version?: string | null;
  generated_at?: string | null;
  reviewed_at?: string | null;
  reviewed_by_user_id?: string | null;
  reviewed_by_email?: string | null;
  updated_at?: string | null;
  quality_snapshot_json?: Record<string, any> | null;
}

export interface OperationalHealthPlanRevision extends ProfileRecord {
  id: string;
  health_plan_id?: string | null;
  vyva_user_id?: string | null;
  organization_id?: string | null;
  version_number?: number;
  action_type?: "generated" | "regenerated" | "edited" | "reviewed" | null;
  actor_user_id?: string | null;
  actor_email?: string | null;
  created_at?: string | null;
  language?: string | null;
  status?: string | null;
  review_status?: "draft" | "reviewed" | null;
  escalation_grade?: "routine" | "heightened" | "urgent" | null;
  review_required?: boolean;
  review_window?: "today" | "this_week" | "ongoing" | null;
  review_summary?: string | null;
  review_reasons_json?: Array<{
    id?: string | null;
    label?: string | null;
    detail?: string | null;
    severity?: "high" | "medium" | "low" | null;
    source?: string | null;
  }>;
  quality_snapshot_json?: Record<string, any> | null;
  review_note?: string | null;
  review_checklist_json?: HealthPlanReviewChecklist | null;
  recommendation_review_decisions_json?: Array<{
    item_key?: string | null;
    item_id?: string | null;
    section_key?: string | null;
    section_label?: string | null;
    text?: string | null;
    decision_status?: "approved" | "watch" | "needs_edit" | null;
    rationale?: string | null;
    updated_at?: string | null;
    updated_by_user_id?: string | null;
    updated_by_email?: string | null;
  }>;
  summary_text?: string | null;
  summary_signal_ids?: string[];
  goals_json?: HealthPlanSectionItem[];
  daily_support_json?: HealthPlanSectionItem[];
  monitoring_json?: HealthPlanSectionItem[];
  escalation_json?: HealthPlanSectionItem[];
  caregiver_guidance_json?: HealthPlanSectionItem[];
  source_signals_json?: HealthPlanSourceSignal[];
  data_quality_gaps_json?: HealthPlanDataQualityGap[];
  completed_improvement_actions_json?: HealthPlanCompletedImprovementAction[];
  feedback_entries_json?: HealthPlanFeedbackEntry[];
  inferred_feedback_json?: HealthPlanFeedbackEntry[];
  recommendation_learning_json?: HealthPlanRecommendationLearningItem[];
  generator_provider?: string | null;
  generator_model?: string | null;
  generator_version?: string | null;
  generated_at?: string | null;
  generated_by_user_id?: string | null;
  reviewed_at?: string | null;
  reviewed_by_user_id?: string | null;
  reviewed_by_email?: string | null;
  change?: {
    previous_version_number?: number | null;
    changed_sections?: string[];
    added_items?: number;
    removed_items?: number;
    rewritten_items?: number;
    high_priority_delta?: number;
    summary_changed?: boolean;
    review_status_changed?: boolean;
    materially_changed?: boolean;
    recommendation_changes?: {
      added_count?: number;
      preserved_count?: number;
      tightened_count?: number;
      replaced_count?: number;
      evidence_backed_count?: number;
      learning_backed_count?: number;
      manual_override_count?: number;
      thin_justification_count?: number;
      items?: Array<{
        action?: "added" | "preserved" | "tightened" | "replaced" | null;
        section_key?: string | null;
        text?: string | null;
        priority?: "high" | "medium" | "low" | null;
        timing?: "today" | "this_week" | "ongoing" | null;
        reason?: string | null;
        evidence_shift?: string | null;
        learning_shift?: string | null;
        previous_top_source?: string | null;
        current_top_source?: string | null;
        justification_status?: "manual_override" | "evidence_backed" | "learning_backed" | "thin" | null;
      }>;
      highlights?: Array<{
        action?: "added" | "preserved" | "tightened" | "replaced" | null;
        section_key?: string | null;
        text?: string | null;
        priority?: "high" | "medium" | "low" | null;
        timing?: "today" | "this_week" | "ongoing" | null;
        reason?: string | null;
        evidence_shift?: string | null;
        learning_shift?: string | null;
        previous_top_source?: string | null;
        current_top_source?: string | null;
        justification_status?: "manual_override" | "evidence_backed" | "learning_backed" | "thin" | null;
      }>;
    } | null;
  } | null;
}

export interface OperationalService extends ProfileRecord {
  id?: string;
  created_at?: string;
  enabled?: boolean;
  frequency?: string | null;
  preferred_time?: string | null;
  paused_until?: string | null;
  pause_reason?: string | null;
  pause_source?: string | null;
  is_paused?: boolean;
}

export interface OperationalCaregiver extends ProfileRecord {
  id: string;
  assignment_id?: string;
  care_provider_contact_id?: string | null;
  caretaker_name?: string | null;
  caretaker_phone?: string | null;
  is_primary?: boolean;
  relationship_label?: string | null;
  notes?: string | null;
  created_at?: string;
}

export interface OperationalCareProviderAssignment extends ProfileRecord {
  id: string;
  assignment_id?: string;
  provider_type: "caregiver" | "field_staff";
  provider_id?: string | null;
  display_name?: string | null;
  phone?: string | null;
  role?: string | null;
  team?: string | null;
  status?: string | null;
  active?: boolean;
  is_primary?: boolean;
  relationship_label?: string | null;
  notes?: string | null;
  assignment_count?: number;
  linked_users?: Array<{ id?: string; name?: string; city?: string | null }>;
  created_at?: string;
  updated_at?: string;
}

export interface OperationalSensor extends ProfileRecord {
  id: string;
  battery_level?: number | null;
  created_at?: string;
  device_id?: string | null;
  device_name?: string | null;
  last_reading_at?: string | null;
  sensor_type?: string | null;
  status?: string | null;
}

export interface OperationalAlert extends ProfileRecord {
  id: string;
  alert_type?: string | null;
  created_at?: string;
  message?: string | null;
  resolved_at?: string | null;
  severity?: string | null;
}

export interface OperationalProfileResponse {
  user: OperationalProfileUser;
  consent?: OperationalConsent | null;
  health?: OperationalHealth | null;
  medications?: OperationalMedication[];
  medicationActivity?: OperationalMedicationActivity | null;
  healthPlan?: OperationalHealthPlan | null;
  healthPlanFeedback?: OperationalHealthPlanFeedback | null;
  healthPlanHistory?: OperationalHealthPlanRevision[];
  healthPlanBenchmarkReplay?: Record<string, any> | null;
  checkins?: OperationalService | null;
  brainCoach?: OperationalService | null;
  careProviders?: OperationalCareProviderAssignment[];
  caregivers?: OperationalCaregiver[];
  sensors?: OperationalSensor[];
  alerts?: OperationalAlert[];
  recentOperationalEvents?: OperationalRecentActivity[];
  readings?: ProfileRecord[];
  operationalContext?: OperationalProfileContext;
  isPreviewDemo?: boolean;
  can_edit_care_plan?: boolean;
  can_edit_medications?: boolean;
  can_edit_checkins?: boolean;
  can_edit_brain_coach?: boolean;
  edit_block_reason?: string | null;
}

const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
const ninetyMinutesAgo = new Date(Date.now() - 90 * 60 * 1000).toISOString();
const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();

export const demoOperationalUsers: OperationalQueueUser[] = [
  {
    id: "demo-carmen-lopez",
    first_name: "Carmen",
    last_name: "Lopez",
    city: "Madrid",
    phone: "+34 600 010 245",
    date_of_birth: "1942-03-18",
    coords: [40.4168, -3.7038],
    activeAlerts: 3,
    criticalAlerts: 1,
    sensorCount: 2,
    offlineSensors: 0,
    checkinEnabled: true,
    healthConditions: 2,
    missedMeds7d: 2,
    riskScore: 87,
    careProviderCount: 2,
    primaryCaregiverName: "Maria Garcia",
    primaryProfessionalName: "Ana Novak",
    careProviderNames: ["Maria Garcia", "Ana Novak"],
    operationalContext: {
      age: 84,
      assignedTo: "Ana Novak",
      preferredChannel: "phone",
      lastContactKey: "profile.demo.lastContact",
      livingContextKey: "profile.demo.livingContext",
      nextActionKey: "usersList.nextAction.callNow",
      reasonKey: "profile.demo.reason",
      riskStatus: "urgent",
    },
  },
  {
    id: "demo-hans-mueller",
    first_name: "Hans",
    last_name: "Mueller",
    city: "Dresden",
    phone: "+49 351 555 014",
    date_of_birth: "1939-11-02",
    coords: [51.0504, 13.7373],
    activeAlerts: 1,
    criticalAlerts: 0,
    sensorCount: 3,
    offlineSensors: 1,
    checkinEnabled: true,
    healthConditions: 3,
    missedMeds7d: 0,
    riskScore: 58,
    careProviderCount: 1,
    primaryCaregiverName: null,
    primaryProfessionalName: "Mila Weber",
    careProviderNames: ["Mila Weber"],
    operationalContext: {
      age: 86,
      assignedTo: "Mila Weber",
      preferredChannel: "phone",
      lastContactKey: "profile.demo.lastContactYesterday",
      livingContextKey: "usersList.livingWithPartner",
      nextActionKey: "usersList.nextAction.review",
      reasonKey: "usersList.reason.noResponse",
      riskStatus: "review",
      noResponse: true,
    },
  },
  {
    id: "demo-elena-garcia",
    first_name: "Elena",
    last_name: "Garcia",
    city: "Madrid",
    phone: "+34 600 550 120",
    date_of_birth: "1948-07-14",
    coords: [40.429, -3.6906],
    activeAlerts: 1,
    criticalAlerts: 0,
    sensorCount: 1,
    offlineSensors: 0,
    checkinEnabled: false,
    healthConditions: 1,
    missedMeds7d: 1,
    riskScore: 46,
    careProviderCount: 0,
    primaryCaregiverName: null,
    primaryProfessionalName: null,
    careProviderNames: [],
    operationalContext: {
      age: 77,
      assignedTo: null,
      preferredChannel: "whatsapp",
      lastContactKey: "profile.demo.lastContactThreeDays",
      livingContextKey: "usersList.livingAlone",
      nextActionKey: "usersList.nextAction.assign",
      reasonKey: "usersList.reason.medication",
      riskStatus: "review",
    },
  },
  {
    id: "demo-marta-schneider",
    first_name: "Marta",
    last_name: "Schneider",
    city: "Leipzig",
    phone: "+49 341 555 890",
    date_of_birth: "1951-01-30",
    coords: [51.3397, 12.3731],
    activeAlerts: 0,
    criticalAlerts: 0,
    sensorCount: 2,
    offlineSensors: 0,
    checkinEnabled: true,
    healthConditions: 1,
    missedMeds7d: 0,
    riskScore: 12,
    careProviderCount: 2,
    primaryCaregiverName: "Laura Schneider",
    primaryProfessionalName: "Ana Novak",
    careProviderNames: ["Laura Schneider", "Ana Novak"],
    operationalContext: {
      age: 75,
      assignedTo: "Ana Novak",
      preferredChannel: "app",
      lastContactKey: "profile.demo.lastContactToday",
      livingContextKey: "usersList.livingWithFamily",
      nextActionKey: "usersList.nextAction.monitor",
      reasonKey: "usersList.reason.stable",
      riskStatus: "stable",
    },
  },
];

export const demoOperationalProfile: OperationalProfileResponse = {
  user: {
    id: "demo-carmen-lopez",
    first_name: "Carmen",
    last_name: "Lopez",
    phone: "+34 600 010 245",
    date_of_birth: "1942-03-18",
    gender: "female",
    language: "es",
    city: "Madrid",
    street: "Calle Mayor",
    house_number: "12",
    post_code: "28013",
    emergency_notes: "Dizziness mentioned during the morning check-in. Medication confidence is low this week.",
    created_at: "2025-04-21T08:00:00.000Z",
  },
  consent: {
    id: "demo-consent-carmen",
    consent_given: true,
    created_at: "2025-04-21T08:00:00.000Z",
  },
  health: {
    id: "demo-health-carmen",
    health_conditions: ["Hypertension", "Type 2 diabetes"],
    mobility_needs: ["Occasional dizziness", "Lives alone"],
  },
  medications: [
    {
      id: "demo-med-carmen-1",
      medication_name: "Metformin",
      dosage: "500mg",
      purpose: "Diabetes",
      reminders_enabled: true,
      schedule_times: ["08:00", "20:00"],
      created_at: "2025-04-21T08:00:00.000Z",
    },
    {
      id: "demo-med-carmen-2",
      medication_name: "Lisinopril",
      dosage: "10mg",
      purpose: "Blood pressure",
      reminders_enabled: false,
      schedule_times: ["09:00"],
      created_at: "2025-04-21T08:00:00.000Z",
    },
  ],
  healthPlan: {
    id: "demo-health-plan-carmen",
    language: "es",
    status: "current",
    review_status: "draft",
    escalation_grade: "urgent",
    review_required: true,
    review_window: "today",
    review_summary: "This plan needs same-day staff review before the team relies on it as the main guidance.",
    review_reasons_json: [
      {
        id: "active-alerts",
        label: "Active alerts need same-day coordination",
        detail: "Dizziness and unconfirmed doses are still showing up in the current live picture.",
        severity: "high",
        source: "signals",
      },
      {
        id: "follow-through:needs-review",
        label: "New follow-through signals have overtaken this plan",
        detail: "Monitoring still needs tighter linkage to the actual medication misses this week.",
        severity: "high",
        source: "follow_through",
      },
    ],
    review_note: null,
    review_checklist_json: {
      reachability_confirmed: false,
      medication_risk_checked: false,
      escalation_path_confirmed: false,
      next_touchpoint_confirmed: false,
    },
    summary_text: "Carmen is managing several daily routines well, but she needs closer follow-up this week around dizziness, medication confidence, and steady daily check-ins.",
    goals_json: [
      { id: "goal-1", text: "Keep Carmen feeling safe and steady at home during the next seven days.", source_signal_ids: ["signal-1", "signal-2"], priority: "high", confidence: "high", timing: "this_week" },
      { id: "goal-2", text: "Support consistent medication confirmation, especially for morning doses.", source_signal_ids: ["signal-2", "signal-3"], priority: "high", confidence: "high", timing: "this_week" },
      { id: "goal-3", text: "Check whether dizziness is changing and whether extra support is needed from family or staff.", source_signal_ids: ["signal-2", "signal-5"], priority: "high", confidence: "high", timing: "this_week" },
    ],
    daily_support_json: [
      { id: "daily-1", text: "Keep the daily check-in active at the current morning time and ask first about dizziness and hydration.", source_signal_ids: ["signal-2", "signal-4"], priority: "high", confidence: "high", timing: "today" },
      { id: "daily-2", text: "Use short, clear medication reminders and confirm whether each scheduled dose was understood.", source_signal_ids: ["signal-2", "signal-3"], priority: "high", confidence: "high", timing: "today" },
      { id: "daily-3", text: "Encourage Carmen to keep her phone close and ask Maria to stay reachable during higher-risk mornings.", source_signal_ids: ["signal-1", "signal-5"], priority: "medium", confidence: "high", timing: "ongoing" },
    ],
    monitoring_json: [
      { id: "monitor-1", text: "Watch for repeated missed or unconfirmed medication doses this week.", source_signal_ids: ["signal-2", "signal-3"], priority: "high", confidence: "high", timing: "today" },
      { id: "monitor-2", text: "Review any fall-detector or heart-monitor anomalies on the same day they appear.", source_signal_ids: ["signal-1", "signal-5"], priority: "high", confidence: "high", timing: "today" },
      { id: "monitor-3", text: "Note whether mood, appetite, or response quality drops below Carmen's usual baseline.", source_signal_ids: ["signal-1", "signal-4"], priority: "high", confidence: "high", timing: "today" },
    ],
    escalation_json: [
      { id: "escalation-1", text: "Escalate if dizziness becomes more frequent, lasts longer, or affects safe movement at home.", source_signal_ids: ["signal-1", "signal-2"], priority: "high", confidence: "high", timing: "today" },
      { id: "escalation-2", text: "Escalate if two or more medication doses are missed or cannot be confirmed within 48 hours.", source_signal_ids: ["signal-2", "signal-3"], priority: "high", confidence: "high", timing: "today" },
      { id: "escalation-3", text: "Escalate if sensor alerts suggest a fall, unusual inactivity, or inability to reach Carmen.", source_signal_ids: ["signal-1", "signal-5"], priority: "high", confidence: "high", timing: "today" },
    ],
    caregiver_guidance_json: [
      { id: "caregiver-1", text: "Share a simple update with Maria after any significant dizziness report or missed medication pattern.", source_signal_ids: ["signal-2", "signal-5"], priority: "high", confidence: "high", timing: "today" },
      { id: "caregiver-2", text: "Ask Maria to help confirm whether food, hydration, and rest are stable on higher-risk days.", source_signal_ids: ["signal-1", "signal-2"], priority: "high", confidence: "high", timing: "today" },
      { id: "caregiver-3", text: "Keep guidance practical and reassuring so the family knows what to watch for without alarm.", source_signal_ids: ["signal-1", "signal-5"], priority: "medium", confidence: "high", timing: "this_week" },
    ],
    source_signals_json: [
      { id: "signal-1", label: "Predictive risk score 87 (high)", detail: "As of today · Up from prior score", strength: "high", category: "risk" },
      { id: "signal-2", label: "3 active alerts", detail: "Dizziness mentioned during morning check-in · Two doses unconfirmed this week", strength: "high", category: "alert" },
      { id: "signal-3", label: "2 medications on file", detail: "1 reminder currently off · Saved reminder times 08:00, 20:00, 09:00", strength: "medium", category: "medication" },
      { id: "signal-4", label: "Check-ins", detail: "Enabled · daily · Preferred time 09:30", strength: "medium", category: "service" },
      { id: "signal-5", label: "2 sensors linked", detail: "All currently reporting", strength: "medium", category: "sensor" },
    ],
    feedback_entries_json: [
      {
        id: "daily_support_json:section",
        section_key: "daily_support_json",
        outcome: "helped",
        note: "Morning check-ins improved responsiveness when staff asked first about dizziness and hydration.",
        recorded_at: twoHoursAgo,
        recorded_by_email: "ana@redcross.example",
      },
      {
        id: "monitoring_json:section",
        section_key: "monitoring_json",
        outcome: "needs_follow_up",
        note: "Monitoring signals still need tighter linkage to the actual medication misses this week.",
        recorded_at: ninetyMinutesAgo,
        recorded_by_email: "ana@redcross.example",
      },
    ],
    generator_provider: "openai",
    generator_model: "gpt-4o-mini",
    generator_version: "health-plan-v1",
    generated_at: sixHoursAgo,
    reviewed_at: null,
    reviewed_by_user_id: null,
    reviewed_by_email: null,
    updated_at: sixHoursAgo,
  },
  healthPlanHistory: annotateHealthPlanHistory([
    {
      id: "demo-health-plan-carmen-v3",
      health_plan_id: "demo-health-plan-carmen",
      vyva_user_id: "demo-carmen-lopez",
      organization_id: "demo-org-zamora",
      version_number: 3,
      action_type: "edited",
      actor_email: "ana@redcross.example",
      created_at: sixHoursAgo,
      language: "es",
      status: "current",
      review_status: "draft",
      escalation_grade: "urgent",
      review_required: true,
      review_window: "today",
      review_summary: "This plan needs same-day staff review before the team relies on it as the main guidance.",
      review_reasons_json: [
        {
          id: "active-alerts",
          label: "Active alerts need same-day coordination",
          detail: "Dizziness and unconfirmed doses are still showing up in the current live picture.",
          severity: "high",
          source: "signals",
        },
      ],
      review_note: null,
      review_checklist_json: {
        reachability_confirmed: false,
        medication_risk_checked: false,
        escalation_path_confirmed: false,
        next_touchpoint_confirmed: false,
      },
      summary_text: "Carmen is managing several daily routines well, but she needs closer follow-up this week around dizziness, medication confidence, and steady daily check-ins.",
      goals_json: [
        { id: "goal-1", text: "Keep Carmen feeling safe and steady at home during the next seven days.", source_signal_ids: ["signal-1", "signal-2"], priority: "high", confidence: "high", timing: "this_week" },
        { id: "goal-2", text: "Support consistent medication confirmation, especially for morning doses.", source_signal_ids: ["signal-2", "signal-3"], priority: "high", confidence: "high", timing: "this_week" },
      ],
      daily_support_json: [
        { id: "daily-1", text: "Keep the daily check-in active at the current morning time and ask first about dizziness and hydration.", source_signal_ids: ["signal-2", "signal-4"], priority: "high", confidence: "high", timing: "today" },
      ],
      monitoring_json: [
        { id: "monitor-1", text: "Watch for repeated missed or unconfirmed medication doses this week.", source_signal_ids: ["signal-2", "signal-3"], priority: "high", confidence: "high", timing: "today" },
      ],
      escalation_json: [
        { id: "escalation-1", text: "Escalate if dizziness becomes more frequent, lasts longer, or affects safe movement at home.", source_signal_ids: ["signal-1", "signal-2"], priority: "high", confidence: "high", timing: "today" },
      ],
      caregiver_guidance_json: [
        { id: "caregiver-1", text: "Share a simple update with Maria after any significant dizziness report or missed medication pattern.", source_signal_ids: ["signal-2", "signal-5"], priority: "high", confidence: "high", timing: "today" },
      ],
      source_signals_json: [
        { id: "signal-1", label: "Predictive risk score 87 (high)", detail: "As of today · Up from prior score", strength: "high", category: "risk" },
        { id: "signal-2", label: "3 active alerts", detail: "Dizziness mentioned during morning check-in · Two doses unconfirmed this week", strength: "high", category: "alert" },
      ],
      feedback_entries_json: [
        {
          id: "daily_support_json:section",
          section_key: "daily_support_json",
          outcome: "helped",
          note: "Morning check-ins improved responsiveness when staff asked first about dizziness and hydration.",
          recorded_at: twoHoursAgo,
          recorded_by_email: "ana@redcross.example",
        },
      ],
      generator_provider: "openai",
      generator_model: "gpt-4o-mini",
      generator_version: "health-plan-v1",
      generated_at: sixHoursAgo,
    },
    {
      id: "demo-health-plan-carmen-v2",
      health_plan_id: "demo-health-plan-carmen",
      vyva_user_id: "demo-carmen-lopez",
      organization_id: "demo-org-zamora",
      version_number: 2,
      action_type: "regenerated",
      actor_email: "ana@redcross.example",
      created_at: twoDaysAgo,
      language: "es",
      status: "current",
      review_status: "reviewed",
      escalation_grade: "heightened",
      review_required: true,
      review_window: "this_week",
      review_summary: "This plan should be reviewed by staff before it is reused or shared.",
      review_reasons_json: [
        {
          id: "risk-pressure",
          label: "Predictive risk is elevated",
          detail: "Risk stayed high even after the previous revision.",
          severity: "medium",
          source: "signals",
        },
      ],
      review_note: "Reviewed after confirming Maria was reachable and that morning escalation remains the right response if dizziness or missed doses continue.",
      review_checklist_json: {
        reachability_confirmed: true,
        medication_risk_checked: true,
        escalation_path_confirmed: true,
        next_touchpoint_confirmed: true,
      },
      summary_text: "Carmen needs closer support this week around dizziness, medication follow-up, and a reliable morning routine.",
      goals_json: [
        { id: "goal-1", text: "Support a steady routine at home this week.", source_signal_ids: ["signal-1"], priority: "medium", confidence: "medium", timing: "this_week" },
      ],
      daily_support_json: [
        { id: "daily-1", text: "Call each morning to confirm how Carmen feels and whether medication was understood.", source_signal_ids: ["signal-2", "signal-3"], priority: "high", confidence: "medium", timing: "today" },
      ],
      monitoring_json: [],
      escalation_json: [
        { id: "escalation-1", text: "Escalate if dizziness worsens or Carmen cannot be reached.", source_signal_ids: ["signal-1", "signal-2"], priority: "high", confidence: "high", timing: "today" },
      ],
      caregiver_guidance_json: [
        { id: "caregiver-1", text: "Keep Maria informed if dizziness returns after the morning call.", source_signal_ids: ["signal-2"], priority: "medium", confidence: "medium", timing: "this_week" },
      ],
      source_signals_json: [
        { id: "signal-1", label: "Predictive risk score 84 (high)", detail: "Up from prior score", strength: "high", category: "risk" },
        { id: "signal-2", label: "2 active alerts", detail: "Dizziness noted this week", strength: "high", category: "alert" },
        { id: "signal-3", label: "Medication reminders", detail: "Morning reminders active", strength: "medium", category: "medication" },
      ],
      generator_provider: "openai",
      generator_model: "gpt-4o-mini",
      generator_version: "health-plan-v1",
      generated_at: twoDaysAgo,
      reviewed_at: twoDaysAgo,
      reviewed_by_email: "mila@redcross.example",
    },
    {
      id: "demo-health-plan-carmen-v1",
      health_plan_id: "demo-health-plan-carmen",
      vyva_user_id: "demo-carmen-lopez",
      organization_id: "demo-org-zamora",
      version_number: 1,
      action_type: "generated",
      actor_email: "mila@redcross.example",
      created_at: fiveDaysAgo,
      language: "es",
      status: "current",
      review_status: "draft",
      escalation_grade: "routine",
      review_required: false,
      review_window: "ongoing",
      review_summary: "This plan does not currently need elevated review beyond normal staff judgment.",
      review_reasons_json: [],
      review_note: null,
      review_checklist_json: {
        reachability_confirmed: false,
        medication_risk_checked: false,
        escalation_path_confirmed: false,
        next_touchpoint_confirmed: false,
      },
      summary_text: "Initial support plan for Carmen based on available profile and service data.",
      goals_json: [
        { id: "goal-1", text: "Keep daily routines steady.", source_signal_ids: ["signal-1"], priority: "medium", confidence: "low", timing: "ongoing" },
      ],
      daily_support_json: [],
      monitoring_json: [],
      escalation_json: [],
      caregiver_guidance_json: [],
      source_signals_json: [
        { id: "signal-1", label: "Predictive inputs unavailable", detail: "Plan built from live profile and service data", strength: "low", category: "risk" },
      ],
      generator_provider: "fallback",
      generator_model: "deterministic-template",
      generator_version: "health-plan-v1-fallback",
      generated_at: fiveDaysAgo,
    },
  ]),
  checkins: {
    id: "demo-checkin-carmen",
    enabled: true,
    frequency: "daily",
    preferred_time: "09:30",
    created_at: "2025-04-21T08:00:00.000Z",
  },
  brainCoach: {
    id: "demo-brain-carmen",
    enabled: true,
    frequency: "weekly",
    preferred_time: "16:00",
    created_at: "2025-04-21T08:00:00.000Z",
  },
  caregivers: [
    {
      id: "demo-caregiver-carmen",
      assignment_id: "demo-caregiver-carmen",
      care_provider_contact_id: "demo-provider-maria",
      caretaker_name: "Maria Garcia",
      caretaker_phone: "+34 600 345 901",
      is_primary: true,
      relationship_label: "Daughter",
      created_at: "2025-04-21T08:00:00.000Z",
    },
  ],
  careProviders: [
    {
      id: "demo-caregiver-carmen",
      assignment_id: "demo-caregiver-carmen",
      provider_type: "caregiver",
      provider_id: "demo-provider-maria",
      display_name: "Maria Garcia",
      phone: "+34 600 345 901",
      is_primary: true,
      relationship_label: "Daughter",
      active: true,
      assignment_count: 1,
      linked_users: [{ id: "demo-carmen-lopez", name: "Carmen Lopez", city: "Madrid" }],
      created_at: "2025-04-21T08:00:00.000Z",
    },
    {
      id: "demo-professional-carmen",
      assignment_id: "demo-professional-carmen",
      provider_type: "field_staff",
      provider_id: "demo-field-ana",
      display_name: "Ana Novak",
      phone: "+34 600 120 220",
      role: "Field coordinator",
      team: "Team North",
      status: "available",
      is_primary: true,
      relationship_label: "Primary field provider",
      active: true,
      assignment_count: 2,
      linked_users: [
        { id: "demo-carmen-lopez", name: "Carmen Lopez", city: "Madrid" },
        { id: "demo-marta-schneider", name: "Marta Schneider", city: "Leipzig" },
      ],
      created_at: "2025-04-21T08:00:00.000Z",
    },
  ],
  sensors: [
    {
      id: "demo-sensor-carmen-1",
      device_id: "VYVA-HR-0245",
      device_name: "Wrist heart monitor",
      sensor_type: "heart_rate",
      status: "online",
      battery_level: 72,
      integration_method: "api",
      last_reading_at: sixHoursAgo,
      created_at: "2025-04-21T08:00:00.000Z",
    },
    {
      id: "demo-sensor-carmen-2",
      device_id: "VYVA-FALL-0245",
      device_name: "Fall detector",
      sensor_type: "fall_detector",
      status: "online",
      battery_level: 61,
      integration_method: "api",
      last_reading_at: sixHoursAgo,
      created_at: "2025-04-21T08:00:00.000Z",
    },
  ],
  alerts: [
    {
      id: "demo-alert-carmen-1",
      alert_type: "dizziness_reported",
      severity: "critical",
      message: "Dizziness mentioned during morning check-in",
      created_at: sixHoursAgo,
      resolved_at: null,
    },
    {
      id: "demo-alert-carmen-2",
      alert_type: "medication_unconfirmed",
      severity: "warning",
      message: "Two doses unconfirmed this week",
      created_at: twoDaysAgo,
      resolved_at: null,
    },
    {
      id: "demo-alert-carmen-3",
      alert_type: "lower_mood",
      severity: "warning",
      message: "Responses shorter than usual for five days",
      created_at: fiveDaysAgo,
      resolved_at: null,
    },
  ],
  readings: [],
  operationalContext: {
    age: 84,
    assignedTo: "Ana Novak",
    familyConsentKey: "profile.familyConsentActive",
    preferredChannel: "phone",
    lastContactKey: "profile.demo.lastContact",
    livingContextKey: "profile.demo.livingContext",
    nextActionKey: "usersList.nextAction.callNow",
    reasonKey: "profile.demo.reason",
    riskStatus: "urgent",
    summaryKey: "profile.demo.summaryBeforeCall",
    recentSignalKeys: [
      "profile.demo.signal.dizziness",
      "profile.demo.signal.medication",
      "profile.demo.signal.mood",
      "profile.demo.signal.breakfast",
      "profile.demo.signal.alone",
    ],
    recommendedQuestionKeys: [
      "profile.demo.question.safe",
      "profile.demo.question.dizziness",
      "profile.demo.question.medication",
      "profile.demo.question.food",
      "profile.demo.question.caregiver",
    ],
    suggestedOpeningKey: "profile.demo.suggestedOpening",
  },
  isPreviewDemo: true,
};

export const demoCareProviders = [
  ...(demoOperationalProfile.careProviders ?? []),
  {
    id: "demo-professional-mila",
    assignment_id: "demo-professional-mila",
    provider_type: "field_staff" as const,
    provider_id: "demo-field-mila",
    display_name: "Mila Weber",
    phone: "+49 351 555 019",
    role: "Field nurse",
    team: "Team East",
    status: "available",
    active: true,
    assignment_count: 1,
    linked_users: [{ id: "demo-hans-mueller", name: "Hans Mueller", city: "Dresden" }],
    created_at: "2025-04-21T08:00:00.000Z",
  },
  {
    id: "demo-caregiver-laura",
    assignment_id: "demo-caregiver-laura",
    provider_type: "caregiver" as const,
    provider_id: "demo-provider-laura",
    display_name: "Laura Schneider",
    phone: "+49 341 555 012",
    is_primary: true,
    relationship_label: "Niece",
    active: true,
    assignment_count: 1,
    linked_users: [{ id: "demo-marta-schneider", name: "Marta Schneider", city: "Leipzig" }],
    created_at: "2025-04-21T08:00:00.000Z",
  },
] satisfies OperationalCareProviderAssignment[];

export function isDemoUserId(id?: string | null) {
  return Boolean(id && id.startsWith("demo-"));
}

export function getDemoProfileById(id?: string | null): OperationalProfileResponse {
  if (!id || id === demoOperationalProfile.user.id) {
    return {
      ...demoOperationalProfile,
      healthPlanBenchmarkReplay: buildHealthPlanBenchmarkReplayFromHistory({
        history: demoOperationalProfile.healthPlanHistory || [],
        currentPlan: demoOperationalProfile.healthPlan || null,
      }),
    };
  }

  const queueUser = demoOperationalUsers.find((user) => user.id === id);
  if (!queueUser) return demoOperationalProfile;

  const profile = {
    ...demoOperationalProfile,
    user: {
      ...demoOperationalProfile.user,
      id: queueUser.id,
      first_name: queueUser.first_name,
      last_name: queueUser.last_name,
      phone: queueUser.phone,
      date_of_birth: queueUser.date_of_birth,
      city: queueUser.city,
      language: queueUser.id === "demo-hans-mueller" ? "de" : "es",
    },
    alerts: queueUser.activeAlerts
      ? demoOperationalProfile.alerts?.slice(0, queueUser.activeAlerts)
      : [],
    healthPlan:
      queueUser.id === "demo-hans-mueller"
        ? null
        : queueUser.id === "demo-marta-schneider"
          ? {
              ...demoOperationalProfile.healthPlan!,
              id: "demo-health-plan-marta",
              language: "de",
              review_status: "reviewed",
              escalation_grade: "routine",
              review_required: false,
              review_window: "ongoing",
              review_summary: "This plan does not currently need elevated review beyond normal staff judgment.",
              review_reasons_json: [],
              review_note: "Reviewed against the latest family-supported routine and kept light because no urgent live signals were active.",
              summary_text: "Marta is currently stable, with family support and routine services in place. The plan should focus on maintaining routines, monitoring subtle changes, and keeping support light but consistent.",
              goals_json: [
                { id: "goal-1", text: "Maintain Marta's current stable routine at home.", source_signal_ids: ["signal-1", "signal-3"] },
                { id: "goal-2", text: "Keep communication easy for both Marta and her family support network.", source_signal_ids: ["signal-2", "signal-3"] },
              ],
              source_signals_json: [
                { id: "signal-1", label: "Predictive inputs unavailable", detail: "Plan can still be generated from live profile, service, sensor, and caregiver data.", strength: "low", category: "risk" },
                { id: "signal-2", label: "Brain Coach", detail: "Enabled · weekly · Preferred time 16:00", strength: "medium", category: "service" },
                { id: "signal-3", label: "Profile context", detail: "Living context family · 2 care provider assignments", strength: "medium", category: "context" },
              ],
              reviewed_at: twoDaysAgo,
              reviewed_by_user_id: "demo-admin-mila",
              reviewed_by_email: "mila@redcross.example",
            }
          : demoOperationalProfile.healthPlan,
    healthPlanHistory:
      queueUser.id === "demo-hans-mueller"
        ? []
        : queueUser.id === "demo-marta-schneider"
          ? annotateHealthPlanHistory([
              {
                id: "demo-health-plan-marta-v2",
                health_plan_id: "demo-health-plan-marta",
                vyva_user_id: "demo-marta-schneider",
                organization_id: "demo-org-leipzig",
                version_number: 2,
                action_type: "reviewed",
                actor_email: "mila@redcross.example",
                created_at: twoDaysAgo,
                language: "de",
                status: "current",
                review_status: "reviewed",
                escalation_grade: "routine",
                review_required: false,
                review_window: "ongoing",
                review_summary: "This plan does not currently need elevated review beyond normal staff judgment.",
                review_reasons_json: [],
                review_note: "Reviewed against the latest family-supported routine and kept light because no urgent live signals were active.",
                summary_text: "Marta is currently stable, with family support and routine services in place. The plan should focus on maintaining routines, monitoring subtle changes, and keeping support light but consistent.",
                goals_json: [
                  { id: "goal-1", text: "Maintain Marta's current stable routine at home.", source_signal_ids: ["signal-1", "signal-3"], priority: "medium", confidence: "high", timing: "ongoing" },
                ],
                daily_support_json: [],
                monitoring_json: [{ id: "monitor-1", text: "Check for subtle mood or mobility changes during routine follow-up.", source_signal_ids: ["signal-2", "signal-3"], priority: "medium", confidence: "medium", timing: "this_week" }],
                escalation_json: [],
                caregiver_guidance_json: [{ id: "caregiver-1", text: "Keep family messaging calm and practical if routines shift.", source_signal_ids: ["signal-3"], priority: "low", confidence: "medium", timing: "ongoing" }],
                source_signals_json: [
                  { id: "signal-1", label: "Predictive inputs unavailable", detail: "Plan can still be generated from live profile, service, sensor, and caregiver data.", strength: "low", category: "risk" },
                  { id: "signal-3", label: "Profile context", detail: "Living context family · 2 care provider assignments", strength: "medium", category: "context" },
                ],
                generator_provider: "openai",
                generator_model: "gpt-4o-mini",
                generator_version: "health-plan-v1",
                generated_at: twoDaysAgo,
                reviewed_at: twoDaysAgo,
                reviewed_by_email: "mila@redcross.example",
              },
              {
                id: "demo-health-plan-marta-v1",
                health_plan_id: "demo-health-plan-marta",
                vyva_user_id: "demo-marta-schneider",
                organization_id: "demo-org-leipzig",
                version_number: 1,
                action_type: "generated",
                actor_email: "mila@redcross.example",
                created_at: fiveDaysAgo,
                language: "de",
                status: "current",
                review_status: "draft",
                escalation_grade: "routine",
                review_required: false,
                review_window: "ongoing",
                review_summary: "This plan does not currently need elevated review beyond normal staff judgment.",
                review_reasons_json: [],
                review_note: null,
                summary_text: "Initial stable-support plan for Marta.",
                goals_json: [{ id: "goal-1", text: "Maintain routines at home.", source_signal_ids: ["signal-3"], priority: "low", confidence: "low", timing: "ongoing" }],
                daily_support_json: [],
                monitoring_json: [],
                escalation_json: [],
                caregiver_guidance_json: [],
                source_signals_json: [{ id: "signal-3", label: "Profile context", detail: "Living context family · 2 care provider assignments", strength: "medium", category: "context" }],
                generator_provider: "fallback",
                generator_model: "deterministic-template",
                generator_version: "health-plan-v1-fallback",
                generated_at: fiveDaysAgo,
              },
            ])
          : demoOperationalProfile.healthPlanHistory,
    operationalContext: {
      ...demoOperationalProfile.operationalContext!,
      ...queueUser.operationalContext!,
      summaryKey:
        queueUser.id === "demo-carmen-lopez"
          ? "profile.demo.summaryBeforeCall"
          : "profile.demo.summaryGeneric",
      reasonKey: queueUser.operationalContext?.reasonKey ?? "queue.reason.default",
      recentSignalKeys:
        queueUser.id === "demo-carmen-lopez"
          ? demoOperationalProfile.operationalContext!.recentSignalKeys
          : ["profile.demo.signal.genericReview", "profile.demo.signal.checkins", "profile.demo.signal.assignment"],
      recommendedQuestionKeys:
        queueUser.id === "demo-carmen-lopez"
          ? demoOperationalProfile.operationalContext!.recommendedQuestionKeys
          : ["profile.demo.question.safe", "profile.demo.question.support", "profile.demo.question.nextContact"],
    },
    isPreviewDemo: true,
  };

  return {
    ...profile,
    healthPlanBenchmarkReplay: buildHealthPlanBenchmarkReplayFromHistory({
      history: profile.healthPlanHistory || [],
      currentPlan: profile.healthPlan || null,
    }),
  };
}
