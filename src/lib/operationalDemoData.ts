import type { GISUser } from "@/hooks/useGISData";

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
  due_window?: "same_day" | "within_24h" | null;
  evidence_freshness?: "live" | "recent" | "stale" | "unknown" | "mixed" | null;
  evidence_conflict?: "clear" | "conflicted" | "freshness_gap" | null;
  evidence_review_state?: "ready" | "verify_first" | "urgent_review" | null;
  evidence_review_reason_codes?: string[];
  evidence_review_signal_labels?: string[];
  evidence_review_summary?: string | null;
  recommendation_provenance_strength?: "strong" | "moderate" | "caution" | "weak" | null;
  recommendation_provenance_score?: number | null;
  recommendation_provenance_reason_codes?: string[];
  recommendation_provenance_summary?: string | null;
  recommendation_use_mode?: "ready_with_judgment" | "verify_before_use" | "staff_review_only" | null;
  recommendation_use_reason_codes?: string[];
  recommendation_use_summary?: string | null;
  last_verified_at?: string | null;
  recheck_after_hours?: number | null;
  recheck_due_at?: string | null;
  owner_label?: string | null;
  completion_proof?: string | null;
  escalation_if_not_done?: string | null;
  source_task_code?: string | null;
  staff_disposition?: "confirmed" | "deferred" | "escalated" | null;
  staff_disposition_note?: string | null;
  staff_disposition_updated_at?: string | null;
  staff_disposition_updated_by?: string | null;
  staff_disposition_updated_by_email?: string | null;
}

export interface HealthPlanSourceSignal extends ProfileRecord {
  id?: string;
  label: string;
  detail?: string | null;
  category?: string | null;
  strength?: "high" | "medium" | "low" | null;
  observed_at?: string | null;
  freshness?: "live" | "recent" | "stale" | "unknown" | null;
}

export interface OperationalHealthPlanAuditReason extends ProfileRecord {
  code: string;
  severity: "high" | "medium" | "low";
  detail?: string | null;
  signal_ids?: string[];
}

export interface OperationalHealthPlanAudit extends ProfileRecord {
  status: "ready" | "needs_review" | "needs_regeneration";
  review_required?: boolean;
  regeneration_recommended?: boolean;
  reviewed?: boolean;
  generated_with_fallback?: boolean;
  predictive_available_now?: boolean;
  predictive_used_at_generation?: boolean;
  response_expectation?: "same_day" | "within_24h" | string | null;
  review_valid_until?: string | null;
  checked_at?: string | null;
  saved_signal_count?: number;
  referenced_signal_count?: number;
  current_signal_count?: number;
  current_critical_signal_ids?: string[];
  new_critical_signal_ids?: string[];
  unaddressed_current_critical_signal_ids?: string[];
  reasons?: OperationalHealthPlanAuditReason[];
}

export interface OperationalHealthPlanQualityCheck extends ProfileRecord {
  code: string;
  state: "good" | "watch" | "critical";
}

export interface OperationalHealthPlanImprovementSummary extends ProfileRecord {
  status?: "baseline" | "improved" | "stable" | "mixed" | "regressed" | string | null;
  summary_text?: string | null;
  score_delta?: number | null;
  rubric_overall_delta?: number | null;
  trust_level_delta?: "up" | "down" | "same" | "unknown" | string | null;
  review_status_delta?: "up" | "down" | "same" | "unknown" | string | null;
  resolved_issue_codes?: string[];
  new_issue_codes?: string[];
  repeated_issue_codes?: string[];
  changed_sections?: string[];
}

export interface OperationalHealthPlanFreshnessDecay extends ProfileRecord {
  status?: "fresh" | "watch" | "aging" | "stale" | string | null;
  summary_text?: string | null;
  summary_decay_reason?: "signal_age" | "recommendation_due_soon" | "recommendation_overdue" | "mixed" | string | null;
  response_expectation?: "same_day" | "within_24h" | string | null;
  plan_age_hours?: number | null;
  freshest_signal_age_hours?: number | null;
  latest_recommendation_verified_at?: string | null;
  earliest_recheck_due_at?: string | null;
  refresh_recommended_by_at?: string | null;
  refresh_overdue?: boolean;
  next_status?: "watch" | "aging" | "stale" | string | null;
  next_status_at?: string | null;
  live_signal_count?: number;
  recent_signal_count?: number;
  stale_signal_count?: number;
  unknown_signal_count?: number;
  recommendation_timed_item_count?: number;
  recommendation_due_soon_count?: number;
  recommendation_overdue_count?: number;
  recommendation_overdue_same_day_count?: number;
  requires_refresh?: boolean;
  score_penalty?: number;
}

export interface OperationalHealthPlanReviewCheck extends ProfileRecord {
  code: string;
  state: "good" | "watch" | "critical";
  detail?: string | null;
}

export interface OperationalHealthPlanReviewNextMove extends ProfileRecord {
  code: string;
  priority: "high" | "medium" | "low";
  text: string;
}

export interface OperationalHealthPlanReview extends ProfileRecord {
  status: "ready" | "needs_review" | "hold";
  share_ready?: boolean;
  response_expectation?: "same_day" | "within_24h" | string | null;
  generation_confidence?: "high" | "medium" | "low" | null;
  checks?: OperationalHealthPlanReviewCheck[];
  next_moves?: OperationalHealthPlanReviewNextMove[];
}

export interface OperationalHealthPlanCoordinationCommitment extends ProfileRecord {
  code:
    | "review_plan"
    | "assign_owner"
    | "contact_client"
    | "review_alerts"
    | "verify_medication"
    | "check_sensors"
    | "update_care_circle"
    | "respect_sharing_boundary"
    | "refresh_plan";
  status: "covered" | "open" | "not_needed";
  priority: "high" | "medium" | "low";
  due_window: "same_day" | "within_24h";
  detail?: string | null;
  proof_hint?: string | null;
  signal_ids?: string[];
}

export interface OperationalHealthPlanCoordination extends ProfileRecord {
  state: "urgent" | "watch" | "stable";
  response_window: "same_day" | "within_24h";
  sharing_boundary: "staff_only" | "approved_circle";
  owner_name?: string | null;
  owner_missing?: boolean;
  ready_for_share?: boolean;
  open_commitment_codes?: OperationalHealthPlanCoordinationCommitment["code"][];
  recommended_action_code?: OperationalHealthPlanCoordinationCommitment["code"] | null;
  commitments?: OperationalHealthPlanCoordinationCommitment[];
}

export interface OperationalHealthPlanExecutionTask extends ProfileRecord {
  code: string;
  title: string;
  detail?: string | null;
  priority: "high" | "medium" | "low";
  due_window: "same_day" | "within_24h";
  audience?: "staff" | "elder" | "care_circle" | string | null;
  owner_label?: string | null;
  completion_proof?: string | null;
  escalation_if_not_done?: string | null;
  signal_ids?: string[];
  source?: "coordination" | "review" | "freshness" | string | null;
  status?: "open" | "watch" | "covered" | string | null;
}

export interface OperationalHealthPlanExecutionPack extends ProfileRecord {
  state: "urgent" | "watch" | "stable";
  response_window?: "same_day" | "within_24h" | string | null;
  owner_name?: string | null;
  owner_missing?: boolean;
  summary_text?: string | null;
  next_task_code?: string | null;
  high_priority_task_count?: number;
  same_day_task_count?: number;
  tasks?: OperationalHealthPlanExecutionTask[];
}

export interface OperationalHealthPlanQuality extends ProfileRecord {
  score: number;
  trust_level: "high" | "medium" | "low";
  recommended_action: "share" | "review" | "regenerate";
  outcome_trajectory?: "improved" | "stalled" | "worsened" | string | null;
  evidence_coverage?: number;
  distinct_signal_coverage?: number;
  current_signal_coverage?: number;
  critical_action_coverage?: number;
  recommendation_review_ready_count?: number;
  recommendation_review_verify_first_count?: number;
  recommendation_review_urgent_count?: number;
  recommendation_use_ready_with_judgment_count?: number;
  recommendation_use_verify_before_use_count?: number;
  recommendation_use_staff_review_only_count?: number;
  urgent_recommendation_staff_review_only_count?: number;
  reviewed?: boolean;
  generated_with_fallback?: boolean;
  predictive_grounded?: boolean;
  generation_confidence?: "high" | "medium" | "low" | null;
  generation_readiness?: "ready_for_review" | "review_before_share" | "review_and_enrich" | null;
  improvement_summary?: OperationalHealthPlanImprovementSummary | null;
  freshness_decay?: OperationalHealthPlanFreshnessDecay | null;
  strengths?: OperationalHealthPlanQualityCheck[];
  cautions?: OperationalHealthPlanQualityCheck[];
  trust_summary?: OperationalHealthPlanTrustSummary | null;
}

export interface OperationalHealthPlanGenerationAssessmentReason extends ProfileRecord {
  code: string;
  severity: "high" | "medium" | "low";
  detail?: string | null;
}

export interface OperationalHealthPlanTrustSummary extends ProfileRecord {
  state?: "ready_to_share" | "staff_review_only" | "do_not_share" | string | null;
  headline?: string | null;
  detail?: string | null;
  next_action_text?: string | null;
  reason_codes?: string[];
  generation_gate_state?: "eligible" | "review_only" | "fallback_only" | string | null;
  generation_confidence?: "high" | "medium" | "low" | null;
  freshness_state?: string | null;
  review_status?: string | null;
  recommendation_review_urgent_count?: number | null;
  recommendation_review_verify_first_count?: number | null;
  recommendation_use_staff_review_only_count?: number | null;
  recommendation_use_verify_before_use_count?: number | null;
}

export interface OperationalHealthPlanGenerationAssessment extends ProfileRecord {
  confidence: "high" | "medium" | "low";
  readiness: "ready_for_review" | "review_before_share" | "review_and_enrich";
  source_signal_count?: number;
  critical_signal_count?: number;
  care_provider_count?: number;
  live_signal_count?: number;
  stale_signal_count?: number;
  unknown_freshness_signal_count?: number;
  predictive_available?: boolean;
  predictive_confidence?: number | null;
  response_expectation?: string | null;
  freshest_signal_at?: string | null;
  stalest_signal_at?: string | null;
  reasons?: OperationalHealthPlanGenerationAssessmentReason[];
  trust_gate_state?: "eligible" | "review_only" | "fallback_only" | string | null;
  trust_gate_reason_codes?: string[];
  trust_gate_summary_text?: string | null;
  trust_gate_operator_action?: string | null;
}

export interface OperationalHealthPlanRegenerationFocusItem extends ProfileRecord {
  code: string;
  detail?: string | null;
  priority?: "high" | "medium" | "low" | string | null;
  source?: "approval" | "audit" | "generation" | "review" | "automated_review" | "coverage" | string | null;
  signal_ids?: string[];
  section_targets?: string[];
  due_window?: "same_day" | "within_24h" | string | null;
}

export interface OperationalHealthPlanRegenerationFocus extends ProfileRecord {
  state?: "ready" | "refine" | "regenerate" | string | null;
  summary_text?: string | null;
  primary_target_code?: string | null;
  primary_target_detail?: string | null;
  confidence?: "high" | "medium" | "low" | null;
  readiness?: "ready_for_review" | "review_before_share" | "review_and_enrich" | null;
  outcome_trajectory?: "improved" | "stalled" | "worsened" | string | null;
  weak_review_dimensions?: string[];
  blocking_issue_codes?: string[];
  watch_issue_codes?: string[];
  recommended_section_targets?: string[];
  focus_items?: OperationalHealthPlanRegenerationFocusItem[];
  verification_items?: ProfileRecord[];
  learning_highlights?: string[];
  planning_cautions?: string[];
  next_task_code?: string | null;
  next_task_title?: string | null;
}

export interface OperationalHealthPlanChangeEntry extends ProfileRecord {
  code: string;
  sections?: string[];
  signal_ids?: string[];
  from?: string | null;
  to?: string | null;
  count?: number;
}

export interface OperationalHealthPlanChangeSummary extends ProfileRecord {
  change_kind?: "baseline" | "update" | string | null;
  action_type?: "generated" | "regenerated" | "edited" | "reviewed" | null;
  changed_sections?: string[];
  signals_added?: string[];
  signals_removed?: string[];
  source_signals_added?: string[];
  source_signals_removed?: string[];
  review_transition?: string | null;
  generation_confidence_transition?: string | null;
  content_fingerprint?: string | null;
  evidence_fingerprint?: string | null;
  review_fingerprint?: string | null;
  entries?: OperationalHealthPlanChangeEntry[];
}

export interface OperationalHealthPlanReviewAttestation extends ProfileRecord {
  approved_for_sharing?: boolean;
  checked_at?: string | null;
  response_expectation?: "same_day" | "within_24h" | string | null;
  checklist_codes?: string[];
  open_issue_codes?: string[];
  reason_codes?: string[];
  operator_confirmation_codes?: string[];
  reviewer_note?: string | null;
  generation_confidence?: "high" | "medium" | "low" | null;
  audit_status?: string | null;
  review_status?: string | null;
  blocking_issue_codes?: string[];
  watch_issue_codes?: string[];
  approval_gate_state?: string | null;
  coordination_state?: string | null;
  quality_score?: number | null;
  quality_trust_level?: string | null;
}

export interface OperationalHealthPlanApprovalIssue extends ProfileRecord {
  code: string;
  detail?: string | null;
  source?: "audit" | "review" | "coordination" | string | null;
  signal_ids?: string[];
  priority?: "high" | "medium" | "low" | string | null;
  due_window?: "same_day" | "within_24h" | string | null;
}

export interface OperationalHealthPlanApprovalGate extends ProfileRecord {
  state?: "blocked" | "review" | "ready" | string | null;
  ready_for_approval?: boolean;
  ready_for_share?: boolean;
  must_regenerate?: boolean;
  response_window?: "same_day" | "within_24h" | string | null;
  summary_text?: string | null;
  blocking_issue_codes?: string[];
  watch_issue_codes?: string[];
  blocking_issues?: OperationalHealthPlanApprovalIssue[];
  watch_issues?: OperationalHealthPlanApprovalIssue[];
}

export interface OperationalHealthPlanAutomatedReview extends ProfileRecord {
  verdict?: "pass" | "revise" | "block" | string | null;
  checked_at?: string | null;
  summary_text?: string | null;
  grounded_signal_ids?: string[];
  strengths?: string[];
  concerns?: OperationalHealthPlanGenerationAssessmentReason[];
  required_actions?: string[];
  shareability?: "shareable" | "staff_only" | string | null;
  provider?: string | null;
  model?: string | null;
  version?: string | null;
  audit_status?: string | null;
  review_status?: string | null;
}

export interface OperationalHealthPlanContextSnapshot extends ProfileRecord {
  snapshot_version?: string | null;
  captured_at?: string | null;
  language?: string | null;
  organization?: ProfileRecord | null;
  policy?: ProfileRecord | null;
  client?: ProfileRecord | null;
  health?: ProfileRecord | null;
  medications?: ProfileRecord[];
  medication_activity?: ProfileRecord | null;
  checkins?: ProfileRecord | null;
  brain_coach?: ProfileRecord | null;
  sensors?: ProfileRecord[];
  alerts?: ProfileRecord[];
  care_providers?: ProfileRecord[];
  predictive?: ProfileRecord | null;
  critical_signal_ids?: string[];
  must_cover?: ProfileRecord[];
  known_facts?: ProfileRecord[];
  open_questions?: ProfileRecord[];
  next_confirmations?: ProfileRecord[];
  generation_assessment?: OperationalHealthPlanGenerationAssessment | null;
  evidence_digest?: ProfileRecord | null;
  source_signals?: HealthPlanSourceSignal[];
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
  summary_text?: string | null;
  goals_json?: HealthPlanSectionItem[];
  daily_support_json?: HealthPlanSectionItem[];
  monitoring_json?: HealthPlanSectionItem[];
  escalation_json?: HealthPlanSectionItem[];
  caregiver_guidance_json?: HealthPlanSectionItem[];
  source_signals_json?: HealthPlanSourceSignal[];
  generator_provider?: string | null;
  generator_model?: string | null;
  generator_version?: string | null;
  generation_confidence?: "high" | "medium" | "low" | null;
  generation_assessment_json?: OperationalHealthPlanGenerationAssessment | null;
  context_snapshot_json?: OperationalHealthPlanContextSnapshot | null;
  change_summary_json?: OperationalHealthPlanChangeSummary | null;
  review_valid_until?: string | null;
  review_attestation_json?: OperationalHealthPlanReviewAttestation | null;
  automated_review_json?: OperationalHealthPlanAutomatedReview | null;
  automated_reviewed_at?: string | null;
  generated_at?: string | null;
  reviewed_at?: string | null;
  reviewed_by_user_id?: string | null;
  reviewed_by_email?: string | null;
  updated_at?: string | null;
  audit?: OperationalHealthPlanAudit | null;
  review?: OperationalHealthPlanReview | null;
  quality?: OperationalHealthPlanQuality | null;
  approval_gate?: OperationalHealthPlanApprovalGate | null;
  coordination?: OperationalHealthPlanCoordination | null;
  execution_pack?: OperationalHealthPlanExecutionPack | null;
  regeneration_focus?: OperationalHealthPlanRegenerationFocus | null;
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
  summary_text?: string | null;
  goals_json?: HealthPlanSectionItem[];
  daily_support_json?: HealthPlanSectionItem[];
  monitoring_json?: HealthPlanSectionItem[];
  escalation_json?: HealthPlanSectionItem[];
  caregiver_guidance_json?: HealthPlanSectionItem[];
  source_signals_json?: HealthPlanSourceSignal[];
  generator_provider?: string | null;
  generator_model?: string | null;
  generator_version?: string | null;
  generation_confidence?: "high" | "medium" | "low" | null;
  generation_assessment_json?: OperationalHealthPlanGenerationAssessment | null;
  context_snapshot_json?: OperationalHealthPlanContextSnapshot | null;
  change_summary_json?: OperationalHealthPlanChangeSummary | null;
  review_valid_until?: string | null;
  review_attestation_json?: OperationalHealthPlanReviewAttestation | null;
  automated_review_json?: OperationalHealthPlanAutomatedReview | null;
  automated_reviewed_at?: string | null;
  generated_at?: string | null;
  generated_by_user_id?: string | null;
  reviewed_at?: string | null;
  reviewed_by_user_id?: string | null;
  reviewed_by_email?: string | null;
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
  checkins?: OperationalService | null;
  brainCoach?: OperationalService | null;
  careProviders?: OperationalCareProviderAssignment[];
  caregivers?: OperationalCaregiver[];
  sensors?: OperationalSensor[];
  alerts?: OperationalAlert[];
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
const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
const fortyFiveMinutesAgo = new Date(Date.now() - 45 * 60 * 1000).toISOString();
const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

function relativeDayAt(offsetDays: number, time: string) {
  const [hours, minutes] = time.split(":").map((value) => Number.parseInt(value, 10) || 0);
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  date.setHours(hours, minutes, 0, 0);
  return date.toISOString();
}

const todayAt = (time: string) => relativeDayAt(0, time);
const yesterdayAt = (time: string) => relativeDayAt(-1, time);

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
    healthPlanAudit: {
      status: "needs_regeneration",
      review_required: true,
      regeneration_recommended: true,
      checked_at: sixHoursAgo,
      generated_at: twoDaysAgo,
      reason_codes: ["new_critical_signals", "stale_same_day_window"],
      reasons: [
        { code: "new_critical_signals", severity: "high" },
        { code: "stale_same_day_window", severity: "high" },
      ],
    },
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
    healthPlanAudit: {
      status: "needs_review",
      review_required: true,
      regeneration_recommended: false,
      checked_at: sixHoursAgo,
      generated_at: fiveDaysAgo,
      reason_codes: ["draft_review_required"],
      reasons: [{ code: "draft_review_required", severity: "medium" }],
    },
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
    healthPlanAudit: null,
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
    healthPlanAudit: {
      status: "ready",
      review_required: false,
      regeneration_recommended: false,
      checked_at: sixHoursAgo,
      generated_at: sixHoursAgo,
      reason_codes: [],
      reasons: [],
    },
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
    emergency_notes: `Dizziness mentioned during the morning check-in. Medication confidence is low this week.

[${twoHoursAgo} - ana@redcross.example] #VYVA_HANDOFF {"priority":"high","responseWindow":"same_day","sharingBoundary":"approved_circle","ownerName":"Ana Novak","ownerMissing":false,"careCircleCount":2,"activeAlertCount":3,"offlineSensorCount":0,"missedMedication":true,"highRisk":true,"actions":["confirm_today_touchpoint","review_alerts","verify_medication"]}

[${ninetyMinutesAgo} - ana@redcross.example] #VYVA_HANDOFF_STATUS {"status":"owner_assigned","ownerName":"Ana Novak","responseWindow":"same_day"}

[${oneHourAgo} - ana@redcross.example] #VYVA_HANDOFF_STATUS {"status":"first_contact_made","ownerName":"Ana Novak","responseWindow":"same_day"}

[${oneHourAgo} - ana@redcross.example] #VYVA_INCIDENT {"code":"urgent_welfare_check","status":"open","ownerName":"Ana Novak","responseWindow":"same_day"}

[${fortyFiveMinutesAgo} - ana@redcross.example] #VYVA_INCIDENT {"code":"urgent_welfare_check","status":"closed","ownerName":"Ana Novak","responseWindow":"same_day"}

[${fortyFiveMinutesAgo} - ana@redcross.example] #VYVA_INCIDENT {"code":"medication_recovery","status":"open","ownerName":"Ana Novak","responseWindow":"same_day"}

[${fortyFiveMinutesAgo} - ana@redcross.example] #VYVA_OUTREACH {"audience":"client","channel":"phone","state":"ready"}`,
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
  medicationActivity: {
    id: "demo-med-activity-carmen-1",
    medication_id: "demo-med-carmen-1",
    medication_name: "Metformin",
    status: "unconfirmed",
    occurred_at: oneHourAgo,
    reported_at: fortyFiveMinutesAgo,
    scheduled_date: new Date().toISOString().slice(0, 10),
    scheduled_time: "08:00",
  },
  healthPlan: {
    id: "demo-health-plan-carmen",
    language: "es",
    status: "current",
    review_status: "reviewed",
    summary_text: "Carmen needs same-day support around dizziness, medication confirmation, and dependable contact, but the next steps are now clearly assigned and ready to share with her care circle in plain language.",
    goals_json: [
      { id: "goal-1", text: "Keep Carmen feeling safe and steady at home during the next seven days.", source_signal_ids: ["signal-1", "signal-2"] },
      { id: "goal-2", text: "Support consistent medication confirmation, especially for morning doses.", source_signal_ids: ["signal-2", "signal-3"] },
      { id: "goal-3", text: "Check whether dizziness is changing and whether extra support is needed from family or staff.", source_signal_ids: ["signal-2", "signal-5"] },
    ],
    daily_support_json: [
      { id: "daily-1", text: "Keep the daily check-in active at the current morning time and ask first about dizziness and hydration.", source_signal_ids: ["signal-2", "signal-4"] },
      { id: "daily-2", text: "Use short, clear medication reminders and confirm whether each scheduled dose was understood.", source_signal_ids: ["signal-2", "signal-3"] },
      { id: "daily-3", text: "Encourage Carmen to keep her phone close and ask Maria to stay reachable during higher-risk mornings.", source_signal_ids: ["signal-1", "signal-5"] },
    ],
    monitoring_json: [
      { id: "monitor-1", text: "Watch for repeated missed or unconfirmed medication doses this week.", source_signal_ids: ["signal-2", "signal-3"] },
      { id: "monitor-2", text: "Review any fall-detector or heart-monitor anomalies on the same day they appear.", source_signal_ids: ["signal-1", "signal-5"] },
      { id: "monitor-3", text: "Note whether mood, appetite, or response quality drops below Carmen's usual baseline.", source_signal_ids: ["signal-1", "signal-4"] },
    ],
    escalation_json: [
      { id: "escalation-1", text: "Escalate if dizziness becomes more frequent, lasts longer, or affects safe movement at home.", source_signal_ids: ["signal-1", "signal-2"] },
      { id: "escalation-2", text: "Escalate if two or more medication doses are missed or cannot be confirmed within 48 hours.", source_signal_ids: ["signal-2", "signal-3"] },
      { id: "escalation-3", text: "Escalate if sensor alerts suggest a fall, unusual inactivity, or inability to reach Carmen.", source_signal_ids: ["signal-1", "signal-5"] },
    ],
    caregiver_guidance_json: [
      { id: "caregiver-1", text: "Share a simple update with Maria after any significant dizziness report or missed medication pattern.", source_signal_ids: ["signal-2", "signal-5"] },
      { id: "caregiver-2", text: "Ask Maria to help confirm whether food, hydration, and rest are stable on higher-risk days.", source_signal_ids: ["signal-1", "signal-2"] },
      { id: "caregiver-3", text: "Keep guidance practical and reassuring so the family knows what to watch for without alarm.", source_signal_ids: ["signal-1", "signal-5"] },
    ],
    source_signals_json: [
      { id: "signal-1", label: "Predictive risk score 87 (high)", detail: "As of today · Up from prior score", strength: "high", category: "risk" },
      { id: "signal-2", label: "3 active alerts", detail: "Dizziness mentioned during morning check-in · Two doses unconfirmed this week", strength: "high", category: "alert" },
      { id: "signal-3", label: "2 medications on file", detail: "1 reminder currently off · Saved reminder times 08:00, 20:00, 09:00", strength: "medium", category: "medication" },
      { id: "signal-4", label: "Check-ins", detail: "Enabled · daily · Preferred time 09:30", strength: "medium", category: "service" },
      { id: "signal-5", label: "2 sensors linked", detail: "All currently reporting", strength: "medium", category: "sensor" },
    ],
    generator_provider: "openai",
    generator_model: "gpt-4o-mini",
    generator_version: "health-plan-v1",
    generation_confidence: "high",
    generation_assessment_json: {
      confidence: "high",
      readiness: "ready_for_review",
      source_signal_count: 5,
      critical_signal_count: 1,
      care_provider_count: 1,
      live_signal_count: 4,
      predictive_available: true,
      predictive_confidence: 0.62,
      response_expectation: "same-day review",
      reasons: [],
      trust_gate_state: "eligible",
      trust_gate_reason_codes: [],
      trust_gate_summary_text: "The live picture is strong enough for staff review and careful sharing.",
      trust_gate_operator_action: "Keep a named owner visible and refresh the plan if today's live picture materially changes.",
    },
    context_snapshot_json: {
      snapshot_version: "health-plan-context-v1",
      captured_at: sixHoursAgo,
      language: "es",
      policy: {
        response_expectation: "same-day review",
        assignment_expectation: "confirm one named owner on the care circle",
        sharing_boundary: "shareable with approved caregivers and family in plain language",
      },
      critical_signal_ids: ["signal-2"],
      known_facts: [
        {
          code: "predictive-risk-high",
          text: "The current predictive risk picture is elevated and still calls for same-day operational attention.",
          priority: "high",
          due_window: "same_day",
          signal_ids: ["signal-1"],
        },
        {
          code: "active-alerts-present",
          text: "There are active unresolved alerts around dizziness and medication confirmation in the live care picture.",
          priority: "high",
          due_window: "same_day",
          signal_ids: ["signal-2"],
        },
        {
          code: "service-routine-present",
          text: "Carmen already has daily check-ins and linked sensors that can be used to keep support coordinated.",
          priority: "medium",
          due_window: "within_24h",
          signal_ids: ["signal-4", "signal-5"],
        },
      ],
      open_questions: [
        {
          code: "medication-followup-open",
          text: "It still needs to be confirmed whether the morning medication drift is continuing today.",
          priority: "high",
          due_window: "same_day",
          signal_ids: ["signal-2", "signal-3"],
        },
        {
          code: "live-feedback-thin",
          text: "The team still needs a fresh same-day contact to confirm whether dizziness and response quality have changed.",
          priority: "medium",
          due_window: "same_day",
          signal_ids: ["signal-2", "signal-4"],
        },
      ],
      next_confirmations: [
        {
          code: "confirm-medication-status",
          text: "Verify today's medication status and confirm whether the morning dose was understood and taken.",
          priority: "high",
          due_window: "same_day",
          signal_ids: ["signal-2", "signal-3"],
        },
        {
          code: "confirm-today-touchpoint",
          text: "Make a same-day touchpoint with Carmen or Maria and record what changed from baseline.",
          priority: "high",
          due_window: "same_day",
          signal_ids: ["signal-2", "signal-4"],
        },
        {
          code: "confirm-sensor-state",
          text: "If another anomaly appears, check whether it reflects a device issue or a real deterioration in safety.",
          priority: "medium",
          due_window: "within_24h",
          signal_ids: ["signal-5"],
        },
      ],
    },
    generated_at: sixHoursAgo,
    reviewed_at: twoHoursAgo,
    reviewed_by_user_id: "demo-admin-ana",
    reviewed_by_email: "ana@redcross.example",
    review_valid_until: tomorrow,
    review_attestation_json: {
      approved_for_sharing: true,
      checked_at: twoHoursAgo,
      response_expectation: "same_day",
      checklist_codes: [
        "owner_assignment_clear",
        "response_window_clear",
        "medication_followup_present",
        "alert_response_present",
        "sharing_boundary_clear",
      ],
      open_issue_codes: [],
      reason_codes: [],
      operator_confirmation_codes: ["summary", "timing", "escalation", "sharing_boundary"],
      reviewer_note: "Reviewed for same-day outreach. Ana owns the next contact and Maria can receive practical updates if dizziness or missed doses continue.",
      generation_confidence: "high",
      audit_status: "ready",
      review_status: "ready",
    },
    change_summary_json: {
      change_kind: "update",
      action_type: "reviewed",
      changed_sections: ["summary", "monitoring", "escalation", "caregiver_guidance"],
      signals_added: [],
      signals_removed: [],
      review_transition: "draft_to_reviewed",
      generation_confidence_transition: "low_to_high",
      entries: [
        { code: "review_marked" },
        { code: "sections_updated", sections: ["summary", "monitoring", "escalation", "caregiver_guidance"], count: 4 },
        { code: "generation_confidence_changed", from: "low", to: "high" },
      ],
    },
    automated_review_json: {
      verdict: "pass",
      checked_at: twoHoursAgo,
      summary_text: "Automated reviewer found the plan grounded in current risk, medication, and outreach signals, with clear same-day ownership and share-safe wording.",
      grounded_signal_ids: ["signal-1", "signal-2", "signal-3", "signal-5"],
      strengths: [
        "Same-day outreach is explicit.",
        "Medication follow-up is turned into practical action.",
        "Sharing language is safe for the approved care circle.",
      ],
      concerns: [],
      required_actions: [],
      shareability: "shareable",
      provider: "openai",
      model: "gpt-4o-mini",
      version: "health-plan-v1-review",
      audit_status: "ready",
      review_status: "ready",
    },
    automated_reviewed_at: twoHoursAgo,
    updated_at: sixHoursAgo,
    audit: {
      status: "ready",
      review_required: false,
      regeneration_recommended: false,
      reviewed: true,
      generated_with_fallback: false,
      predictive_available_now: true,
      predictive_used_at_generation: true,
      response_expectation: "same_day",
      review_valid_until: tomorrow,
      checked_at: sixHoursAgo,
      saved_signal_count: 5,
      referenced_signal_count: 5,
      current_signal_count: 5,
      current_critical_signal_ids: ["signal-2"],
      new_critical_signal_ids: [],
      unaddressed_current_critical_signal_ids: [],
      reasons: [],
    },
    review: {
      status: "ready",
      share_ready: true,
      response_expectation: "same_day",
      generation_confidence: "high",
      checks: [
        { code: "owner_assignment_clear", state: "good", detail: "Follow-up ownership is clear enough to act on." },
        { code: "response_window_clear", state: "good", detail: "The response timing is explicit enough for staff action." },
        { code: "medication_followup_present", state: "good", detail: "Medication follow-up is explicitly covered." },
        { code: "alert_response_present", state: "good", detail: "Active alerts are translated into outreach action." },
        { code: "sharing_boundary_clear", state: "good", detail: "The sharing boundary is explicit enough for staff use." },
      ],
      next_moves: [],
    },
    quality: {
      score: 89,
      trust_level: "high",
      recommended_action: "share",
      evidence_coverage: 100,
      distinct_signal_coverage: 100,
      current_signal_coverage: 100,
      critical_action_coverage: 100,
      recommendation_use_ready_with_judgment_count: 7,
      recommendation_use_verify_before_use_count: 0,
      recommendation_use_staff_review_only_count: 0,
      urgent_recommendation_staff_review_only_count: 0,
      reviewed: true,
      generated_with_fallback: false,
      predictive_grounded: true,
      generation_confidence: "high",
      generation_readiness: "ready_for_review",
      improvement_summary: {
        status: "improved",
        summary_text: "Compared with the prior saved draft, this version closes the main same-day coordination gaps and is stronger on medication follow-up and caregiver-ready wording.",
        score_delta: 7,
        rubric_overall_delta: 6,
        trust_level_delta: "same",
        review_status_delta: "up",
        resolved_issue_codes: ["follow_up_owner_missing", "critical_signals_open"],
        new_issue_codes: [],
        repeated_issue_codes: [],
        changed_sections: ["summary", "monitoring", "escalation", "caregiver_guidance"],
      },
      freshness_decay: {
        status: "watch",
        summary_text: "The plan is still usable, but same-day reliance should stay visible because the strongest live confirmation is beginning to age.",
        response_expectation: "same_day",
        plan_age_hours: 6,
        freshest_signal_age_hours: 1,
        refresh_recommended_by_at: todayAt("16:00"),
        refresh_overdue: false,
        next_status: "aging",
        next_status_at: todayAt("14:00"),
        live_signal_count: 4,
        recent_signal_count: 1,
        stale_signal_count: 0,
        unknown_signal_count: 0,
        requires_refresh: false,
        score_penalty: 4,
      },
      trust_summary: {
        state: "ready_to_share",
        headline: "Ready to use after normal staff review.",
        detail: "This version is grounded in current risk, medication, service, and caregiver signals, with a clear same-day owner and safe wording for the approved care circle.",
        next_action_text: "Use the plan, keep today's outreach moving, and refresh it if the live picture changes.",
        reason_codes: [],
        generation_gate_state: "eligible",
        generation_confidence: "high",
        freshness_state: "watch",
        review_status: "ready",
        recommendation_review_urgent_count: 0,
        recommendation_review_verify_first_count: 0,
        recommendation_use_staff_review_only_count: 0,
        recommendation_use_verify_before_use_count: 0,
      },
      strengths: [
        { code: "reviewed_by_staff", state: "good" },
        { code: "validated_llm_pipeline", state: "good" },
        { code: "evidence_well_linked", state: "good" },
        { code: "broad_signal_coverage", state: "good" },
        { code: "critical_signals_actioned", state: "good" },
        { code: "predictive_context_aligned", state: "good" },
        { code: "sharing_boundary_respected", state: "good" },
      ],
      cautions: [],
    },
    coordination: {
      state: "stable",
      response_window: "same_day",
      sharing_boundary: "approved_circle",
      owner_name: "Ana Novak",
      owner_missing: false,
      ready_for_share: true,
      open_commitment_codes: [],
      recommended_action_code: null,
      commitments: [
        {
          code: "review_plan",
          status: "covered",
          priority: "high",
          due_window: "same_day",
          detail: "The current plan has already been reviewed and signed off for same-day use.",
        },
        {
          code: "assign_owner",
          status: "covered",
          priority: "high",
          due_window: "same_day",
          detail: "Ana Novak is clearly attached as the next follow-up owner.",
          signal_ids: ["signal-5"],
        },
        {
          code: "contact_client",
          status: "covered",
          priority: "high",
          due_window: "same_day",
          detail: "Client outreach timing is explicit in the saved plan.",
          signal_ids: ["signal-2"],
        },
        {
          code: "review_alerts",
          status: "covered",
          priority: "high",
          due_window: "same_day",
          detail: "Active dizziness and medication alerts are already turned into action.",
          signal_ids: ["signal-2"],
        },
        {
          code: "verify_medication",
          status: "covered",
          priority: "high",
          due_window: "same_day",
          detail: "Medication follow-up is clearly reflected in the plan.",
          signal_ids: ["signal-3"],
        },
        {
          code: "update_care_circle",
          status: "covered",
          priority: "medium",
          due_window: "same_day",
          detail: "Maria can receive a practical same-day update when the next contact is complete.",
          signal_ids: ["signal-5"],
        },
      ],
    },
    execution_pack: {
      state: "watch",
      response_window: "same_day",
      owner_name: "Ana Novak",
      owner_missing: false,
      summary_text: "The plan is share-ready, but the live picture still needs a same-day confirmation loop before the risk window fully cools down.",
      next_task_code: "refresh_live_status",
      high_priority_task_count: 2,
      same_day_task_count: 2,
      tasks: [
        {
          code: "refresh_live_status",
          title: "Refresh the live care picture",
          detail: "Make one same-day touchpoint with Carmen or Maria and confirm whether dizziness, hydration, and medication understanding changed today.",
          priority: "high",
          due_window: "same_day",
          audience: "elder",
          owner_label: "Ana Novak",
          completion_proof: "A dated outreach note captures who was reached, what changed, and whether the plan still fits today.",
          escalation_if_not_done: "If no touchpoint lands today, open an urgent follow-up and assign backup outreach before end of day.",
          signal_ids: ["signal-1", "signal-2", "signal-4"],
          source: "freshness",
          status: "open",
        },
        {
          code: "update_care_circle",
          title: "Update the care circle",
          detail: "After the live touchpoint, give Maria one practical update so she knows what to watch for tonight and who owns the next step.",
          priority: "high",
          due_window: "same_day",
          audience: "care_circle",
          owner_label: "Ana Novak",
          completion_proof: "The care-circle note shows what was shared, with clear watch signs and ownership for the next check.",
          escalation_if_not_done: "If family cannot be reached, record that gap and keep the plan staff-led until the circle is reconnected.",
          signal_ids: ["signal-2", "signal-5"],
          source: "coordination",
          status: "watch",
        },
        {
          code: "verify_medication",
          title: "Verify medication follow-through",
          detail: "Confirm whether the morning medication drift continued today and whether reminder wording or caregiver support needs to change.",
          priority: "medium",
          due_window: "within_24h",
          audience: "staff",
          owner_label: "Ana Novak",
          completion_proof: "Medication notes show whether doses were understood, taken, or still need recovery follow-up.",
          escalation_if_not_done: "If confirmation is still missing within 24 hours, reopen the medication recovery workflow.",
          signal_ids: ["signal-2", "signal-3"],
          source: "review",
          status: "watch",
        },
      ],
    },
    regeneration_focus: {
      state: "ready",
      summary_text: "This version is shareable, but the next refresh should begin with a same-day touchpoint so dizziness and medication drift are re-grounded in live evidence.",
      primary_target_code: "refresh_live_status",
      primary_target_detail: "Confirm whether today's medication status, dizziness, and response quality have changed before the next risk window cools down.",
      confidence: "high",
      readiness: "ready_for_review",
      outcome_trajectory: "stalled",
      weak_review_dimensions: [],
      blocking_issue_codes: [],
      watch_issue_codes: ["refresh_live_status"],
      recommended_section_targets: ["monitoring", "daily_support", "escalation"],
      focus_items: [
        {
          code: "refresh_live_status",
          detail: "Refresh the live picture with one same-day touchpoint before relying on the current calm wording for another cycle.",
          priority: "medium",
          source: "review",
          section_targets: ["monitoring", "daily_support"],
          due_window: "same_day",
        },
        {
          code: "anchor_accountability_receipts",
          detail: "When the plan is refreshed, keep the owner, timing window, and proof of contact explicit so the next responder can close the loop quickly.",
          priority: "medium",
          source: "coverage",
          section_targets: ["daily_support", "escalation"],
          due_window: "same_day",
        },
      ],
      verification_items: [
        {
          code: "confirm-medication-status",
          text: "Verify today's medication status and confirm whether the morning dose was understood and taken.",
          priority: "high",
          due_window: "same_day",
          signal_ids: ["signal-2", "signal-3"],
        },
        {
          code: "confirm-today-touchpoint",
          text: "Make a same-day touchpoint with Carmen or Maria and record what changed from baseline.",
          priority: "high",
          due_window: "same_day",
          signal_ids: ["signal-2", "signal-4"],
        },
      ],
      learning_highlights: [
        "Same-day outreach, medication follow-up, and family-safe wording are already strong in the saved version.",
      ],
      planning_cautions: [
        "Do not let a reviewed plan stand in for a fresh contact when dizziness and medication confirmation are still moving targets.",
      ],
      next_task_code: "refresh_live_status",
      next_task_title: "Refresh the live care picture",
    },
  },
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
  if (!id || id === demoOperationalProfile.user.id) return demoOperationalProfile;

  const queueUser = demoOperationalUsers.find((user) => user.id === id);
  if (!queueUser) return demoOperationalProfile;

  if (queueUser.id === "demo-hans-mueller") {
    return {
      ...demoOperationalProfile,
      user: {
        ...demoOperationalProfile.user,
        id: queueUser.id,
        first_name: queueUser.first_name,
        last_name: queueUser.last_name,
        phone: queueUser.phone,
        date_of_birth: queueUser.date_of_birth,
        city: queueUser.city,
        language: "de",
        street: "Bautzner Strasse",
        house_number: "41",
        post_code: "01099",
        emergency_notes:
          "No response to the last scheduled call. Mila should confirm whether the offline pendant reflects a device issue or a real support gap before the next follow-up closes.",
      },
      consent: {
        id: "demo-consent-hans",
        consent_given: false,
        caretaker_consent: false,
        created_at: "2025-04-21T08:00:00.000Z",
      },
      health: {
        id: "demo-health-hans",
        health_conditions: ["Hypertension", "Mild memory concerns", "Reduced mobility"],
        mobility_needs: ["Walks with a cane", "Needs slower follow-up after no-response events"],
      },
      medications: [
        {
          id: "demo-med-hans-1",
          medication_name: "Ramipril",
          dosage: "5mg",
          purpose: "Blood pressure",
          reminders_enabled: true,
          schedule_times: ["09:00"],
          created_at: "2025-04-21T08:00:00.000Z",
        },
        {
          id: "demo-med-hans-2",
          medication_name: "Vitamin D",
          dosage: "1 tablet",
          purpose: "Supplement",
          reminders_enabled: true,
          schedule_times: ["18:00"],
          created_at: "2025-04-21T08:00:00.000Z",
        },
      ],
      medicationActivity: {
        id: "demo-med-activity-hans-1",
        medication_id: "demo-med-hans-1",
        medication_name: "Ramipril",
        status: "confirmed",
        occurred_at: oneHourAgo,
        reported_at: fortyFiveMinutesAgo,
        scheduled_date: new Date().toISOString().slice(0, 10),
        scheduled_time: "09:00",
      },
      healthPlan: {
        ...demoOperationalProfile.healthPlan!,
        id: "demo-health-plan-hans",
        language: "de",
        review_status: "draft",
        summary_text:
          "Hans needs a staff-reviewed support plan that keeps contact predictable, checks whether the offline pendant is a device issue or a safety issue, and stays staff-only until caregiver consent is added.",
        goals_json: [
          {
            id: "goal-1",
            text: "Keep weekly contact reliable so missed responses are noticed early without over-escalating.",
            source_signal_ids: ["signal-1", "signal-2"],
          },
          {
            id: "goal-2",
            text: "Confirm that Hans can still use his safety devices comfortably and knows what to do if support is needed.",
            source_signal_ids: ["signal-2", "signal-3"],
          },
        ],
        daily_support_json: [
          {
            id: "daily-1",
            text: "Use the next check-in to confirm how Hans is managing at home and whether response timing has changed from his usual baseline.",
            source_signal_ids: ["signal-1", "signal-4"],
          },
          {
            id: "daily-2",
            text: "Keep reminder language short and practical, especially around the morning blood-pressure routine.",
            source_signal_ids: ["signal-4", "signal-5"],
          },
        ],
        monitoring_json: [
          {
            id: "monitor-1",
            text: "Watch for repeated no-response moments around scheduled contact windows this week.",
            source_signal_ids: ["signal-1", "signal-4"],
          },
          {
            id: "monitor-2",
            text: "Check whether the offline pendant reconnects or needs replacement before it creates a real safety gap.",
            source_signal_ids: ["signal-2", "signal-3"],
          },
        ],
        escalation_json: [
          {
            id: "escalation-1",
            text: "Escalate if Hans misses another scheduled touchpoint and cannot be reached within the expected follow-up window.",
            source_signal_ids: ["signal-1", "signal-4"],
          },
          {
            id: "escalation-2",
            text: "Escalate if the pendant stays offline and staff cannot confirm that another reliable safety path is in place.",
            source_signal_ids: ["signal-2", "signal-3"],
          },
        ],
        caregiver_guidance_json: [
          {
            id: "caregiver-1",
            text: "Do not share this draft externally until staff review is complete and caregiver consent is recorded.",
            source_signal_ids: ["signal-6"],
          },
          {
            id: "caregiver-2",
            text: "When consent is added later, share only the practical watch signs and who owns the next contact step.",
            source_signal_ids: ["signal-1", "signal-6"],
          },
        ],
        source_signals_json: [
          {
            id: "signal-1",
            label: "Recent no-response pattern",
            detail: "Last contact landed yesterday and the next review is still staff-led",
            strength: "medium",
            category: "contact",
          },
          {
            id: "signal-2",
            label: "1 sensor offline",
            detail: "Pendant safety button has not reported recently",
            strength: "medium",
            category: "sensor",
          },
          {
            id: "signal-3",
            label: "3 sensors linked",
            detail: "Two online, one offline",
            strength: "low",
            category: "sensor",
          },
          {
            id: "signal-4",
            label: "Check-ins",
            detail: "Enabled · weekly · Preferred time 10:00",
            strength: "medium",
            category: "service",
          },
          {
            id: "signal-5",
            label: "Medication routine",
            detail: "Two medications on file with active reminder times",
            strength: "low",
            category: "medication",
          },
          {
            id: "signal-6",
            label: "Care-circle consent missing",
            detail: "Family-facing sharing remains blocked until consent is added",
            strength: "high",
            category: "consent",
          },
        ],
        generation_confidence: "medium",
        generation_assessment_json: {
          confidence: "medium",
          readiness: "review_before_share",
          source_signal_count: 6,
          critical_signal_count: 0,
          care_provider_count: 1,
          live_signal_count: 4,
          stale_signal_count: 1,
          predictive_available: false,
          predictive_confidence: null,
          response_expectation: "review within 24 hours",
          reasons: [
            {
              code: "draft_review_required",
              severity: "medium",
              detail: "A staff reviewer still needs to confirm wording, outreach timing, and the offline sensor response.",
            },
            {
              code: "consent_missing",
              severity: "medium",
              detail: "Care-circle sharing cannot be used until caregiver consent is recorded.",
            },
          ],
          trust_gate_state: "review_only",
          trust_gate_reason_codes: ["generation_confidence_not_high", "fresh_live_evidence_limited"],
          trust_gate_summary_text: "The plan is operationally useful, but it should stay staff-review only until the latest live picture is confirmed.",
          trust_gate_operator_action: "Finish staff review, keep the sharing boundary explicit, and verify the offline sensor response before broader use.",
        },
        generated_at: fiveDaysAgo,
        reviewed_at: null,
        reviewed_by_user_id: null,
        reviewed_by_email: null,
        review_valid_until: null,
        review_attestation_json: {
          approved_for_sharing: false,
          checked_at: null,
          response_expectation: "within_24h",
          checklist_codes: [],
          open_issue_codes: ["draft_review_required", "consent_missing"],
          reason_codes: ["draft_review_required", "consent_missing"],
          operator_confirmation_codes: [],
          reviewer_note: "Waiting for staff review and caregiver consent before any sharing outside the console.",
          generation_confidence: "medium",
          audit_status: "needs_review",
          review_status: "needs_review",
        },
        automated_review_json: {
          verdict: "revise",
          checked_at: sixHoursAgo,
          summary_text:
            "Automated reviewer found the plan operationally useful, but it still needs staff review before sharing and must remain staff-only until caregiver consent exists.",
          grounded_signal_ids: ["signal-1", "signal-2", "signal-4", "signal-6"],
          strengths: [
            "The plan keeps the next outreach steps practical.",
            "The offline sensor issue is reflected in staff actions.",
          ],
          concerns: [
            {
              code: "draft_review_required",
              severity: "medium",
              detail: "Draft wording has not been signed off by staff yet.",
            },
            {
              code: "consent_missing",
              severity: "medium",
              detail: "There is no consent basis for care-circle sharing yet.",
            },
          ],
          required_actions: ["review_plan", "respect_sharing_boundary"],
          shareability: "staff_only",
          provider: "openai",
          model: "gpt-4o-mini",
          version: "health-plan-v1-review",
          audit_status: "needs_review",
          review_status: "needs_review",
        },
        automated_reviewed_at: sixHoursAgo,
        regeneration_focus: {
          state: "refine",
          summary_text: "This version is useful, but staff should finish review and keep the plan staff-only until consent and the offline pendant response are clearer.",
          primary_target_code: "review_plan",
          primary_target_detail: "Finish the staff review, keep the sharing boundary explicit, and confirm whether the offline pendant is a device issue or a real safety gap.",
          confidence: "medium",
          readiness: "review_before_share",
          outcome_trajectory: "stalled",
          weak_review_dimensions: ["shareability"],
          blocking_issue_codes: [],
          watch_issue_codes: ["draft_review_required", "consent_missing"],
          recommended_section_targets: ["monitoring", "caregiver_guidance", "escalation"],
          focus_items: [
            {
              code: "review_plan",
              detail: "A staff reviewer still needs to sign off the wording, outreach timing, and offline sensor response.",
              priority: "medium",
              source: "review",
              section_targets: ["summary", "monitoring", "escalation"],
              due_window: "within_24h",
            },
            {
              code: "respect_sharing_boundary",
              detail: "Keep the plan staff-only until caregiver consent is recorded.",
              priority: "medium",
              source: "automated_review",
              section_targets: ["caregiver_guidance"],
              due_window: "within_24h",
            },
          ],
          verification_items: [
            {
              code: "confirm-pendant-state",
              text: "Confirm whether the offline pendant reflects a device fault or a real safety risk before the next check-in cycle.",
              priority: "medium",
              due_window: "within_24h",
              signal_ids: ["signal-2"],
            },
          ],
          learning_highlights: [
            "The saved plan already keeps the next outreach steps practical.",
          ],
          planning_cautions: [
            "Do not broaden sharing until consent exists and the offline sensor picture is clearer.",
          ],
          next_task_code: "review_plan",
          next_task_title: "Review and lock the next move",
        },
        updated_at: sixHoursAgo,
        audit: {
          status: "needs_review",
          review_required: true,
          regeneration_recommended: false,
          reviewed: false,
          generated_with_fallback: false,
          predictive_available_now: false,
          predictive_used_at_generation: false,
          response_expectation: "within_24h",
          review_valid_until: null,
          checked_at: sixHoursAgo,
          saved_signal_count: 6,
          referenced_signal_count: 6,
          current_signal_count: 6,
          current_critical_signal_ids: [],
          new_critical_signal_ids: [],
          unaddressed_current_critical_signal_ids: [],
          reasons: [
            { code: "draft_review_required", severity: "medium" },
            { code: "consent_missing", severity: "medium" },
          ],
        },
        review: {
          status: "needs_review",
          share_ready: false,
          response_expectation: "within_24h",
          generation_confidence: "medium",
          checks: [
            {
              code: "owner_assignment_clear",
              state: "good",
              detail: "Mila Weber is still the named staff owner for the next contact step.",
            },
            {
              code: "response_window_clear",
              state: "good",
              detail: "The plan keeps a clear follow-up window for the next review.",
            },
            {
              code: "sharing_boundary_missing",
              state: "watch",
              detail: "Care-circle sharing is blocked until consent is recorded.",
            },
          ],
          next_moves: [
            {
              code: "review_plan",
              priority: "high",
              text: "Review the draft wording and confirm it is safe for staff use before any outreach is copied from it.",
            },
            {
              code: "respect_sharing_boundary",
              priority: "medium",
              text: "Keep this plan staff-only until caregiver consent is added.",
            },
          ],
        },
        quality: {
          score: 72,
          trust_level: "medium",
          recommended_action: "review",
          evidence_coverage: 92,
          distinct_signal_coverage: 100,
          current_signal_coverage: 100,
          critical_action_coverage: 80,
          recommendation_use_ready_with_judgment_count: 2,
          recommendation_use_verify_before_use_count: 2,
          recommendation_use_staff_review_only_count: 2,
          urgent_recommendation_staff_review_only_count: 1,
          reviewed: false,
          generated_with_fallback: false,
          predictive_grounded: false,
          generation_confidence: "medium",
          generation_readiness: "review_before_share",
          improvement_summary: {
            status: "regressed",
            summary_text: "Compared with the last saved version, this draft is less ready to use because it lost review sign-off and reopened consent and sensor follow-through gaps.",
            score_delta: -11,
            rubric_overall_delta: -9,
            trust_level_delta: "down",
            review_status_delta: "down",
            resolved_issue_codes: [],
            new_issue_codes: ["sharing_boundary_needs_attention", "review_required"],
            repeated_issue_codes: ["follow_up_owner_clear"],
            changed_sections: ["summary", "monitoring", "caregiver_guidance"],
          },
          freshness_decay: {
            status: "stale",
            summary_text: "This plan is now too old to trust without a refresh because the saved picture and the current live situation may no longer match.",
            response_expectation: "within_24h",
            plan_age_hours: 120,
            freshest_signal_age_hours: 34,
            refresh_recommended_by_at: yesterdayAt("10:00"),
            refresh_overdue: true,
            next_status: "stale",
            next_status_at: yesterdayAt("10:00"),
            live_signal_count: 1,
            recent_signal_count: 2,
            stale_signal_count: 3,
            unknown_signal_count: 0,
            requires_refresh: true,
            score_penalty: 18,
          },
          trust_summary: {
            state: "staff_review_only",
            headline: "Useful draft, but keep it staff-only for now.",
            detail: "The core plan is still practical, but staff should recheck the live picture, finish review, and keep the offline sensor and consent boundary visible before sharing anything wider.",
            next_action_text: "Complete staff review, confirm the pendant status, and keep external sharing blocked until consent exists.",
            reason_codes: ["generation_confidence_not_high", "fresh_live_evidence_limited", "draft_review_required"],
            generation_gate_state: "review_only",
            generation_confidence: "medium",
            freshness_state: "stale",
            review_status: "needs_review",
            recommendation_review_urgent_count: 0,
            recommendation_review_verify_first_count: 1,
            recommendation_use_staff_review_only_count: 2,
            recommendation_use_verify_before_use_count: 2,
          },
          strengths: [
            { code: "validated_llm_pipeline", state: "good" },
            { code: "evidence_well_linked", state: "good" },
          ],
          cautions: [
            { code: "review_required", state: "critical" },
            { code: "sharing_boundary_needs_attention", state: "watch" },
          ],
        },
        coordination: {
          state: "watch",
          response_window: "within_24h",
          sharing_boundary: "staff_only",
          owner_name: "Mila Weber",
          owner_missing: false,
          ready_for_share: false,
          open_commitment_codes: ["review_plan", "respect_sharing_boundary"],
          recommended_action_code: "review_plan",
          commitments: [
            {
              code: "review_plan",
              status: "open",
              priority: "high",
              due_window: "within_24h",
              detail: "A staff reviewer still needs to confirm the wording and next-step framing.",
            },
            {
              code: "assign_owner",
              status: "covered",
              priority: "medium",
              due_window: "within_24h",
              detail: "Mila Weber remains the named staff owner for the next follow-up.",
              signal_ids: ["signal-1"],
            },
            {
              code: "check_sensors",
              status: "open",
              priority: "medium",
              due_window: "within_24h",
              detail: "Confirm whether the offline pendant is a device problem or a real support gap.",
              signal_ids: ["signal-2", "signal-3"],
            },
            {
              code: "respect_sharing_boundary",
              status: "open",
              priority: "medium",
              due_window: "within_24h",
              detail: "Do not share family-facing guidance until consent is on file.",
              signal_ids: ["signal-6"],
            },
          ],
        },
        execution_pack: {
          state: "watch",
          response_window: "within_24h",
          owner_name: "Mila Weber",
          owner_missing: false,
          summary_text:
            "The draft is useful for staff coordination, but it still needs review and a sensor follow-up before it should shape any external outreach.",
          next_task_code: "review_plan",
          high_priority_task_count: 1,
          same_day_task_count: 0,
          tasks: [
            {
              code: "review_plan",
              title: "Review the draft plan",
              detail: "Check the draft wording, confirm it fits Hans's current context, and only then use it for staff guidance.",
              priority: "high",
              due_window: "within_24h",
              audience: "staff",
              owner_label: "Mila Weber",
              completion_proof: "A review note records that the summary, timing, and escalation wording were checked.",
              escalation_if_not_done: "If review slips, keep the plan informational only and do not reuse its outreach drafts.",
              signal_ids: ["signal-1", "signal-6"],
              source: "review",
              status: "open",
            },
            {
              code: "check_sensors",
              title: "Resolve the offline pendant question",
              detail: "Confirm whether the pendant can be reconnected or whether Hans needs another safety path documented.",
              priority: "medium",
              due_window: "within_24h",
              audience: "staff",
              owner_label: "Mila Weber",
              completion_proof: "The device note shows whether the pendant was restored, replaced, or worked around.",
              escalation_if_not_done: "If the pendant remains offline, record the fallback safety path before closing the review.",
              signal_ids: ["signal-2", "signal-3"],
              source: "coordination",
              status: "watch",
            },
          ],
        },
      },
      checkins: {
        ...demoOperationalProfile.checkins,
        id: "demo-checkin-hans",
        frequency: "weekly",
        preferred_time: "10:00",
      },
      brainCoach: {
        ...demoOperationalProfile.brainCoach,
        id: "demo-brain-hans",
        frequency: "weekly",
        preferred_time: "15:30",
      },
      caregivers: [],
      careProviders: demoCareProviders.filter((provider) =>
        provider.linked_users?.some((linkedUser) => linkedUser.id === queueUser.id),
      ),
      sensors: [
        {
          id: "demo-sensor-hans-1",
          device_id: "VYVA-HR-5514",
          device_name: "Living room motion sensor",
          sensor_type: "motion",
          status: "online",
          battery_level: 68,
          integration_method: "api",
          last_reading_at: sixHoursAgo,
          created_at: "2025-04-21T08:00:00.000Z",
        },
        {
          id: "demo-sensor-hans-2",
          device_id: "VYVA-DOOR-5514",
          device_name: "Front door sensor",
          sensor_type: "door",
          status: "online",
          battery_level: 74,
          integration_method: "api",
          last_reading_at: sixHoursAgo,
          created_at: "2025-04-21T08:00:00.000Z",
        },
        {
          id: "demo-sensor-hans-3",
          device_id: "VYVA-PENDANT-5514",
          device_name: "Pendant safety button",
          sensor_type: "panic_button",
          status: "offline",
          battery_level: 19,
          integration_method: "api",
          last_reading_at: fiveDaysAgo,
          created_at: "2025-04-21T08:00:00.000Z",
        },
      ],
      alerts: [
        {
          id: "demo-alert-hans-1",
          alert_type: "scheduled_call_missed",
          severity: "warning",
          message: "No response to the last scheduled call",
          created_at: sixHoursAgo,
          resolved_at: null,
        },
      ],
      operationalContext: {
        ...demoOperationalProfile.operationalContext!,
        ...queueUser.operationalContext!,
        familyConsentKey: "profile.familyConsentUnknown",
        summaryKey: "profile.demo.summaryGeneric",
        reasonKey: queueUser.operationalContext?.reasonKey ?? "queue.reason.default",
        recentSignalKeys: ["profile.demo.signal.genericReview", "profile.demo.signal.checkins", "profile.demo.signal.assignment"],
        recommendedQuestionKeys: ["profile.demo.question.safe", "profile.demo.question.support", "profile.demo.question.nextContact"],
      },
      isPreviewDemo: true,
    };
  }

  return {
    ...demoOperationalProfile,
    user: {
      ...demoOperationalProfile.user,
      id: queueUser.id,
      first_name: queueUser.first_name,
      last_name: queueUser.last_name,
      phone: queueUser.phone,
      date_of_birth: queueUser.date_of_birth,
      city: queueUser.city,
      language: queueUser.id === "demo-marta-schneider" ? "de" : "es",
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
              generation_confidence: "high",
              generation_assessment_json: {
                confidence: "high",
                readiness: "ready_for_review",
                source_signal_count: 3,
                critical_signal_count: 0,
                care_provider_count: 2,
                live_signal_count: 2,
                predictive_available: false,
                predictive_confidence: null,
                response_expectation: "review within 24 hours",
                reasons: [],
                trust_gate_state: "eligible",
                trust_gate_reason_codes: [],
                trust_gate_summary_text: "The live profile picture is limited but still coherent enough for a calm routine plan.",
                trust_gate_operator_action: "Keep the routine plan current and refresh it if family support or service coverage changes.",
              },
              reviewed_at: twoDaysAgo,
              reviewed_by_user_id: "demo-admin-mila",
              reviewed_by_email: "mila@redcross.example",
              review_valid_until: tomorrow,
              review_attestation_json: {
                approved_for_sharing: true,
                checked_at: twoDaysAgo,
                response_expectation: "within_24h",
                checklist_codes: [
                  "owner_assignment_clear",
                  "response_window_clear",
                  "sharing_boundary_clear",
                ],
                open_issue_codes: [],
                reason_codes: [],
                operator_confirmation_codes: ["summary", "timing", "escalation", "sharing_boundary"],
                reviewer_note: "Reviewed with family-aware wording. Routine guidance is appropriate to share with Marta and Laura.",
                generation_confidence: "high",
                audit_status: "ready",
                review_status: "ready",
              },
              change_summary_json: {
                change_kind: "update",
                action_type: "reviewed",
                changed_sections: ["summary", "goals", "caregiver_guidance"],
                signals_added: [],
                signals_removed: [],
                review_transition: "draft_to_reviewed",
                generation_confidence_transition: null,
                entries: [
                  { code: "review_marked" },
                  { code: "sections_updated", sections: ["summary", "goals", "caregiver_guidance"], count: 3 },
                ],
              },
              automated_review_json: {
                verdict: "pass",
                checked_at: twoDaysAgo,
                summary_text: "Automated reviewer found the plan calm, grounded, and safe to share within Marta's current family-supported routine.",
                grounded_signal_ids: ["signal-1", "signal-2", "signal-3"],
                strengths: [
                  "The plan stays specific without sounding alarming.",
                  "Current routines and support ownership are clear.",
                ],
                concerns: [],
                required_actions: [],
                shareability: "shareable",
                provider: "openai",
                model: "gpt-4o-mini",
                version: "health-plan-v1-review",
                audit_status: "ready",
                review_status: "ready",
              },
              automated_reviewed_at: twoDaysAgo,
              regeneration_focus: {
                state: "ready",
                summary_text: "This version is stable and shareable. The next refresh can stay light unless Marta's routine or family support picture changes.",
                primary_target_code: null,
                primary_target_detail: null,
                confidence: "high",
                readiness: "ready_for_review",
                outcome_trajectory: "improved",
                weak_review_dimensions: [],
                blocking_issue_codes: [],
                watch_issue_codes: [],
                recommended_section_targets: [],
                focus_items: [],
                verification_items: [],
                learning_highlights: [
                  "Current routines, owner clarity, and family-safe wording are already working well.",
                ],
                planning_cautions: [
                  "Refresh the wording only if the live support picture or sharing boundary changes.",
                ],
                next_task_code: null,
                next_task_title: null,
              },
              review: {
                status: "ready",
                share_ready: true,
                response_expectation: "within_24h",
                generation_confidence: "high",
                checks: [
                  { code: "owner_assignment_clear", state: "good", detail: "Follow-up ownership is clear enough to act on." },
                  { code: "response_window_clear", state: "good", detail: "The response timing is explicit enough for staff action." },
                  { code: "sharing_boundary_clear", state: "good", detail: "The sharing boundary is explicit enough for staff use." },
                ],
                next_moves: [],
              },
              quality: {
                score: 91,
                trust_level: "high",
                recommended_action: "share",
                evidence_coverage: 100,
                distinct_signal_coverage: 100,
                current_signal_coverage: 100,
                critical_action_coverage: 100,
                recommendation_use_ready_with_judgment_count: 5,
                recommendation_use_verify_before_use_count: 0,
                recommendation_use_staff_review_only_count: 0,
                urgent_recommendation_staff_review_only_count: 0,
                reviewed: true,
                generated_with_fallback: false,
                predictive_grounded: true,
                generation_confidence: "high",
                generation_readiness: "ready_for_review",
                trust_summary: {
                  state: "ready_to_share",
                  headline: "Ready for routine use.",
                  detail: "This plan is grounded enough for a low-intensity client situation even without predictive inputs, because the routine, support picture, and sharing boundary are all clear.",
                  next_action_text: "Use the plan as-is and refresh it only if the live support picture changes.",
                  reason_codes: [],
                  generation_gate_state: "eligible",
                  generation_confidence: "high",
                  freshness_state: "fresh",
                  review_status: "ready",
                  recommendation_review_urgent_count: 0,
                  recommendation_review_verify_first_count: 0,
                  recommendation_use_staff_review_only_count: 0,
                  recommendation_use_verify_before_use_count: 0,
                },
                strengths: [
                  { code: "reviewed_by_staff", state: "good" },
                  { code: "validated_llm_pipeline", state: "good" },
                  { code: "evidence_well_linked", state: "good" },
                  { code: "sharing_boundary_respected", state: "good" },
                ],
                cautions: [],
              },
              coordination: {
                state: "stable",
                response_window: "within_24h",
                sharing_boundary: "approved_circle",
                owner_name: "Laura Schneider",
                owner_missing: false,
                ready_for_share: true,
                open_commitment_codes: [],
                recommended_action_code: null,
                commitments: [
                  {
                    code: "review_plan",
                    status: "covered",
                    priority: "medium",
                    due_window: "within_24h",
                    detail: "This version has already been reviewed for routine family-supported use.",
                  },
                  {
                    code: "assign_owner",
                    status: "covered",
                    priority: "medium",
                    due_window: "within_24h",
                    detail: "The care circle already has a clear person attached to the next follow-up.",
                    signal_ids: ["signal-3"],
                  },
                  {
                    code: "contact_client",
                    status: "covered",
                    priority: "medium",
                    due_window: "within_24h",
                    detail: "The plan keeps the next routine contact inside the normal follow-up window.",
                    signal_ids: ["signal-2"],
                  },
                  {
                    code: "update_care_circle",
                    status: "covered",
                    priority: "low",
                    due_window: "within_24h",
                    detail: "Family-facing wording is already safe to use with Laura when needed.",
                    signal_ids: ["signal-3"],
                  },
                ],
              },
              execution_pack: {
                state: "stable",
                response_window: "within_24h",
                owner_name: "Laura Schneider",
                owner_missing: false,
                summary_text: "No urgent execution gaps are open, but routine follow-through is still named so the family-supported plan stays grounded.",
                next_task_code: "update_care_circle",
                high_priority_task_count: 0,
                same_day_task_count: 0,
                tasks: [
                  {
                    code: "update_care_circle",
                    title: "Update the care circle",
                    detail: "Keep Laura aligned after the next routine contact so everyone is still working from the same calm picture.",
                    priority: "low",
                    due_window: "within_24h",
                    audience: "care_circle",
                    owner_label: "Laura Schneider",
                    completion_proof: "A short family-safe note confirms the routine touchpoint and next contact window.",
                    escalation_if_not_done: "If the update slips, keep the plan staff-led until the family note is logged.",
                    signal_ids: ["signal-3"],
                    source: "coordination",
                    status: "watch",
                  },
                ],
              },
              audit: {
                status: "ready",
                review_required: false,
                regeneration_recommended: false,
                reviewed: true,
                generated_with_fallback: false,
                predictive_available_now: false,
                predictive_used_at_generation: false,
                response_expectation: "within_24h",
                review_valid_until: tomorrow,
                checked_at: sixHoursAgo,
                saved_signal_count: 3,
                referenced_signal_count: 3,
                current_signal_count: 3,
                current_critical_signal_ids: [],
                new_critical_signal_ids: [],
                unaddressed_current_critical_signal_ids: [],
                reasons: [],
              },
            }
          : demoOperationalProfile.healthPlan,
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
}
