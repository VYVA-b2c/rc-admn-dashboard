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
}

export interface HealthPlanSourceSignal extends ProfileRecord {
  id?: string;
  label: string;
  detail?: string | null;
  category?: string | null;
  strength?: "high" | "medium" | "low" | null;
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
  generated_at?: string | null;
  reviewed_at?: string | null;
  reviewed_by_user_id?: string | null;
  reviewed_by_email?: string | null;
  updated_at?: string | null;
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
    summary_text: "Carmen is managing several daily routines well, but she needs closer follow-up this week around dizziness, medication confidence, and steady daily check-ins.",
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
    generated_at: sixHoursAgo,
    reviewed_at: null,
    reviewed_by_user_id: null,
    reviewed_by_email: null,
    updated_at: sixHoursAgo,
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
