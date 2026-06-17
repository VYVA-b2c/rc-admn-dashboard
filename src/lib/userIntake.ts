export type IntakeLanguage = "en" | "de" | "es";

export type UserIntakeIdentity = {
  city: string;
  date_of_birth: string;
  emergency_notes: string;
  first_name: string;
  gender: string;
  house_number: string;
  language: string;
  last_name: string;
  phone: string;
  post_code: string;
  street: string;
};

export type MedicationIntake = {
  dosage: string;
  medication_name: string;
  purpose: string;
  schedule_times: string;
};

export type CaregiverIntake = {
  caretaker_name: string;
  caretaker_phone: string;
};

export type ServiceIntake = {
  enabled?: boolean;
  frequency: string;
  preferred_time: string;
};

type BuildUserIntakePayloadInput = {
  brainCoach?: ServiceIntake | null;
  brainCoachPresent?: boolean;
  caregiverConsent?: boolean;
  caregivers?: CaregiverIntake[];
  caregiverSource?: "manual" | "csv" | "api" | "onboarding";
  checkins?: ServiceIntake | null;
  checkinsPresent?: boolean;
  consentPresent?: boolean;
  defaultLanguage?: IntakeLanguage;
  healthConditions?: string[];
  identity: UserIntakeIdentity;
  includeEmptyRelated?: boolean;
  medications?: MedicationIntake[];
  mobilityNeeds?: string[];
  userConsent?: boolean;
};

export const intakeCadenceOptions = ["daily", "weekly", "biweekly", "monthly"] as const;

export const userIntakeTemplateHeaders = [
  "first_name",
  "last_name",
  "phone",
  "date_of_birth",
  "gender",
  "language",
  "street",
  "house_number",
  "post_code",
  "city",
  "care_safety_notes",
  "health_conditions",
  "mobility_needs",
  "medication_name",
  "medication_dosage",
  "medication_purpose",
  "medication_times",
  "caregiver_name",
  "caregiver_phone",
  "consent_given",
  "caretaker_consent",
  "checkin_enabled",
  "checkin_frequency",
  "checkin_preferred_time",
  "brain_coach_enabled",
  "brain_coach_frequency",
  "brain_coach_preferred_time",
];

export const userIntakeHeaderAliases: Record<string, string> = {
  address: "street",
  birthdate: "date_of_birth",
  caregiver: "caregiver_name",
  caregiver_number: "caregiver_phone",
  caregiver_tel: "caregiver_phone",
  contact_name: "caregiver_name",
  contact_phone: "caregiver_phone",
  conditions: "health_conditions",
  dob: "date_of_birth",
  emergency_notes: "care_safety_notes",
  family_contact: "caregiver_name",
  family_phone: "caregiver_phone",
  first: "first_name",
  firstname: "first_name",
  health: "health_conditions",
  last: "last_name",
  lastname: "last_name",
  medication: "medication_name",
  medication_dose: "medication_dosage",
  medication_schedule: "medication_times",
  medication_time: "medication_times",
  mobile: "phone",
  mobility: "mobility_needs",
  name: "first_name",
  notes: "care_safety_notes",
  phone_number: "phone",
  postcode: "post_code",
  preferred_language: "language",
  schedule_times: "medication_times",
  surname: "last_name",
};

const trueValues = new Set(["1", "active", "enabled", "ja", "si", "true", "y", "yes"]);
const falseValues = new Set(["0", "disabled", "false", "inactive", "n", "nein", "no"]);

function nullIfBlank(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function emptyMedicationIntake(): MedicationIntake {
  return {
    dosage: "",
    medication_name: "",
    purpose: "",
    schedule_times: "",
  };
}

export function emptyCaregiverIntake(): CaregiverIntake {
  return {
    caretaker_name: "",
    caretaker_phone: "",
  };
}

export function defaultServiceIntake(service?: Partial<ServiceIntake> | null, fallbackFrequency = "weekly"): ServiceIntake {
  return {
    enabled: Boolean(service?.enabled),
    frequency: service?.frequency || fallbackFrequency,
    preferred_time: service?.preferred_time || "",
  };
}

export function normalizeIntakeLanguage(value: string, fallback: IntakeLanguage = "de"): IntakeLanguage {
  const language = value.trim().toLowerCase().slice(0, 2);
  return language === "en" || language === "de" || language === "es" ? language : fallback;
}

export function isValidIntakePhone(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return true;
  const digits = trimmed.replace(/\D/g, "");
  return /^\+[1-9][0-9\s().-]{6,24}$/.test(trimmed) && digits.length >= 8 && digits.length <= 15;
}

export function isValidIntakeTime(value: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function splitIntakeList(value: string) {
  return value
    .split(/[;,|]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function parseIntakeBoolean(value: string) {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return undefined;
  if (trueValues.has(normalized)) return true;
  if (falseValues.has(normalized)) return false;
  return null;
}

export function hasMedicationDetail(medication: MedicationIntake) {
  return Boolean(
    medication.medication_name.trim() ||
      medication.dosage.trim() ||
      medication.purpose.trim() ||
      medication.schedule_times.trim(),
  );
}

export function hasCaregiverDetail(caregiver: CaregiverIntake) {
  return Boolean(caregiver.caretaker_name.trim() || caregiver.caretaker_phone.trim());
}

function normalizedMedications(medications: MedicationIntake[] = []) {
  return medications
    .map((medication) => ({
      dosage: nullIfBlank(medication.dosage),
      medication_name: medication.medication_name.trim(),
      purpose: nullIfBlank(medication.purpose),
      schedule_times: splitIntakeList(medication.schedule_times),
    }))
    .filter((medication) => medication.medication_name);
}

function normalizedCaregivers(caregivers: CaregiverIntake[] = [], source?: BuildUserIntakePayloadInput["caregiverSource"]) {
  return caregivers
    .map((caregiver) => ({
      caretaker_name: nullIfBlank(caregiver.caretaker_name),
      caretaker_phone: nullIfBlank(caregiver.caretaker_phone),
      ...(source ? { source } : {}),
    }))
    .filter((caregiver) => caregiver.caretaker_name || caregiver.caretaker_phone);
}

function normalizedService(service?: ServiceIntake | null) {
  if (!service) return null;
  return {
    enabled: Boolean(service.enabled),
    frequency: nullIfBlank(service.frequency),
    preferred_time: nullIfBlank(service.preferred_time),
  };
}

function hasServiceDetail(service?: ServiceIntake | null) {
  return Boolean(service && (service.enabled !== undefined || service.frequency.trim() || service.preferred_time.trim()));
}

export function buildUserIntakePayload({
  brainCoach,
  brainCoachPresent = false,
  caregiverConsent = false,
  caregivers = [],
  caregiverSource,
  checkins,
  checkinsPresent = false,
  consentPresent = false,
  defaultLanguage = "de",
  healthConditions = [],
  identity,
  includeEmptyRelated = false,
  medications = [],
  mobilityNeeds = [],
  userConsent = false,
}: BuildUserIntakePayloadInput): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    city: nullIfBlank(identity.city),
    date_of_birth: nullIfBlank(identity.date_of_birth),
    emergency_notes: nullIfBlank(identity.emergency_notes),
    first_name: identity.first_name.trim(),
    gender: nullIfBlank(identity.gender),
    house_number: nullIfBlank(identity.house_number),
    language: normalizeIntakeLanguage(identity.language, defaultLanguage),
    last_name: identity.last_name.trim(),
    phone: nullIfBlank(identity.phone),
    post_code: nullIfBlank(identity.post_code),
    street: nullIfBlank(identity.street),
  };

  const cleanHealthConditions = healthConditions.map((item) => item.trim()).filter(Boolean);
  const cleanMobilityNeeds = mobilityNeeds.map((item) => item.trim()).filter(Boolean);
  if (includeEmptyRelated || cleanHealthConditions.length || cleanMobilityNeeds.length) {
    payload.health = {
      health_conditions: cleanHealthConditions,
      mobility_needs: cleanMobilityNeeds,
    };
  }

  const medicationPayload = normalizedMedications(medications);
  if (includeEmptyRelated || medicationPayload.length) payload.medications = medicationPayload;

  const caregiverPayload = normalizedCaregivers(caregivers, caregiverSource);
  if (includeEmptyRelated || caregiverPayload.length) payload.caregivers = caregiverPayload;

  if (includeEmptyRelated || consentPresent || userConsent || caregiverConsent) {
    payload.consent = {
      caretaker_consent: caregiverConsent,
      consent_given: userConsent,
    };
  }

  const checkinsPayload = normalizedService(checkins);
  if (includeEmptyRelated || checkinsPresent || hasServiceDetail(checkins)) payload.checkins = checkinsPayload;

  const brainCoachPayload = normalizedService(brainCoach);
  if (includeEmptyRelated || brainCoachPresent || hasServiceDetail(brainCoach)) payload.brainCoach = brainCoachPayload;

  return payload;
}
