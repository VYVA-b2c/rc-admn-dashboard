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
