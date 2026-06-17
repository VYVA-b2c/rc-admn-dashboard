import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const distDir = path.join(rootDir, "dist");
const schemaPath = path.join(rootDir, "server", "schema.sql");

function argValue(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

const isProduction =
  process.argv.includes("--production") ||
  process.env.NODE_ENV === "production" ||
  Boolean(process.env.REPLIT_DEPLOYMENT || process.env.REPLIT_DEPLOYMENT_ID);

const host = argValue("--host") || process.env.HOST || "0.0.0.0";
const port = Number(argValue("--port") || process.env.PORT || 8080);
const databaseUrl = process.env.DATABASE_URL || process.env.LOVABLE_DATABASE_URL || process.env.POSTGRES_URL;
const vyvaBackendApiUrl = (process.env.VYVA_BACKEND_API_URL || process.env.VYVA_API_BASE_URL || "https://api.vyva.io").replace(/\/$/, "");
const externalUserSource = "api.vyva.io";
const vyvaBackendApiDisabled = process.env.VYVA_BACKEND_API_DISABLED === "true";
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseBaseUrl = supabaseUrl ? supabaseUrl.replace(/\/$/, "") : null;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const supabaseServiceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.LOVABLE_SUPABASE_SERVICE_ROLE_KEY;
const supabaseInviteAdminFunctionUrl =
  process.env.SUPABASE_INVITE_ADMIN_URL ||
  process.env.LOVABLE_INVITE_ADMIN_URL ||
  (supabaseBaseUrl ? `${supabaseBaseUrl}/functions/v1/invite-admin` : null);
const publicAppUrl =
  process.env.PUBLIC_APP_URL ||
  process.env.APP_URL ||
  process.env.VITE_APP_URL ||
  process.env.VITE_PUBLIC_APP_URL ||
  null;
const teamInviteGuideUrlOverride = process.env.TEAM_INVITE_GUIDE_URL || process.env.VITE_TEAM_INVITE_GUIDE_URL || null;
const teamInviteGuidePath = process.env.TEAM_INVITE_GUIDE_PATH || "/guide/team-access";
const teamInviteRedirectPath = process.env.TEAM_INVITE_REDIRECT_PATH || teamInviteGuidePath;
const userManualUrlOverride =
  process.env.USER_MANUAL_URL ||
  process.env.VYVA_USER_MANUAL_URL ||
  process.env.VITE_USER_MANUAL_URL ||
  "/manual";
const teamInviteEmailFrom =
  String(process.env.TEAM_INVITE_EMAIL_FROM || process.env.INVITE_EMAIL_FROM || process.env.EMAIL_FROM || "").trim() || null;
const teamInviteEmailReplyTo =
  String(process.env.TEAM_INVITE_EMAIL_REPLY_TO || process.env.EMAIL_REPLY_TO || "").trim() || null;
const resendApiKey = String(process.env.RESEND_API_KEY || "").trim() || null;
const sendgridApiKey = String(process.env.SENDGRID_API_KEY || "").trim() || null;
const postmarkServerToken = String(process.env.POSTMARK_SERVER_TOKEN || "").trim() || null;
const apiAuthBypass =
  process.env.AUTH_BYPASS === "true" ||
  process.env.VITE_AUTH_BYPASS === "true" ||
  (!isProduction && (!supabaseUrl || !supabaseAnonKey));
const tokenUserCache = new Map();
let supabaseInviteAuthClient = null;
let supabaseHostedAuthClient = null;

function sslConfig(connectionString) {
  if (!connectionString) return undefined;
  if (process.env.DATABASE_SSL === "false" || connectionString.includes("sslmode=disable")) return false;
  if (process.env.DATABASE_SSL === "true" || connectionString.includes("sslmode=require")) {
    return { rejectUnauthorized: false };
  }
  return undefined;
}

const pool = databaseUrl
  ? new Pool({
      connectionString: databaseUrl,
      ssl: sslConfig(databaseUrl),
      max: Number(process.env.DATABASE_POOL_MAX || 10),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    })
  : null;

const fallbackOrganizations = [
  {
    id: "red-cross-zamora",
    slug: "red-cross-zamora",
    name: "Red Cross Zamora",
    country: "Spain",
    defaultLanguage: "es",
    timezone: "Europe/Madrid",
    active: true,
    createdAt: null,
    updatedAt: null,
  },
  {
    id: "red-cross-leipzig",
    slug: "red-cross-leipzig",
    name: "Red Cross Leipzig",
    country: "Germany",
    defaultLanguage: "de",
    timezone: "Europe/Berlin",
    active: true,
    createdAt: null,
    updatedAt: null,
  },
];

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "1mb" }));

function parseFrequencyDays(value) {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) return value;
  if (typeof value === "string") {
    const numeric = Number(value);
    if (Number.isInteger(numeric) && numeric > 0) return numeric;
    const match = value.match(/\d+/);
    if (match) {
      const parsed = Number(match[0]);
      if (Number.isInteger(parsed) && parsed > 0) return parsed;
    }
    if (value === "daily") return 1;
    if (value === "weekly") return 7;
    if (value === "biweekly") return 14;
    if (value === "monthly") return 30;
  }
  return 1;
}

function formatDate(value) {
  return new Date(value).toISOString().slice(0, 10);
}

function dayName(value) {
  return new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
}

function datesBetween(start, end) {
  const dates = [];
  const cursor = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  while (cursor <= last) {
    dates.push(formatDate(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

function dbUnavailable(res) {
  res.status(503).json({
    error: "Database is not configured. Add DATABASE_URL through Replit Database or Replit Secrets.",
  });
}

function appendSearchParams(url, params = {}) {
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (item !== undefined && item !== null && item !== "") url.searchParams.append(key, String(item));
      });
      continue;
    }
    url.searchParams.set(key, String(value));
  }
}

function mergeExternalCareProviderSummary(user, summary) {
  if (!summary) return user;
  const localNames = Array.isArray(summary.careProviderNames) ? summary.careProviderNames.filter(Boolean) : [];
  const upstreamNames = Array.isArray(user.careProviderNames) ? user.careProviderNames : [];
  return {
    ...user,
    careProviderCount: Number(summary.careProviderCount || 0),
    careProviderNames: localNames.length ? localNames : upstreamNames,
    primaryCaregiverName: summary.primaryCaregiverName ?? user.primaryCaregiverName ?? null,
    primaryProfessionalName: summary.primaryProfessionalName ?? user.primaryProfessionalName ?? null,
  };
}

function normalizeExternalDashboardPayload(data, assignmentSummaries = new Map()) {
  const gisUsers = Array.isArray(data?.gisUsers)
    ? data.gisUsers.map((user) => {
        const careProviderNames = Array.isArray(user.careProviderNames)
          ? user.careProviderNames
          : Array.isArray(user.caretakerNames)
            ? user.caretakerNames
            : [];
        const normalizedUser = {
          ...user,
          id: user.id == null ? user.id : String(user.id),
          coords: Array.isArray(user.coords) && user.coords.length === 2 ? [Number(user.coords[0]), Number(user.coords[1])] : null,
          careProviderNames,
          careProviderCount: Number(user.careProviderCount ?? careProviderNames.length ?? 0),
          primaryCaregiverName: user.primaryCaregiverName ?? careProviderNames[0] ?? null,
        };
        return mergeExternalCareProviderSummary(normalizedUser, assignmentSummaries.get(String(normalizedUser.id)));
      })
    : [];

  const activeAlerts = Array.isArray(data?.activeAlerts)
    ? data.activeAlerts.map((alert) => ({
        ...alert,
        id: alert.id == null ? alert.id : String(alert.id),
        vyva_user_id: alert.vyva_user_id == null ? alert.vyva_user_id : String(alert.vyva_user_id),
      }))
    : [];

  return {
    totalUsers: Number(data?.totalUsers ?? gisUsers.length),
    checkinsEnabled: Number(data?.checkinsEnabled ?? 0),
    activeAlertCount: Number(data?.activeAlertCount ?? activeAlerts.length),
    criticalAlertCount: Number(data?.criticalAlertCount ?? activeAlerts.filter((alert) => alert.severity === "critical").length),
    totalSensors: Number(data?.totalSensors ?? 0),
    caregiversLinked: Number(data?.caregiversLinked ?? 0),
    gisUsers,
    activeAlerts,
    cityDistribution: Array.isArray(data?.cityDistribution) ? data.cityDistribution : [],
  };
}

function normalizeExternalProfilePayload(data) {
  if (!data || typeof data !== "object") return data;
  const normalizeRecords = (records) =>
    Array.isArray(records)
      ? records.map((record) => ({
          ...record,
          id: record?.id == null ? record?.id : String(record.id),
          vyva_user_id: record?.vyva_user_id == null ? record?.vyva_user_id : String(record.vyva_user_id),
        }))
      : records;

  return {
    ...data,
    user: data.user
      ? {
          ...data.user,
          id: data.user.id == null ? data.user.id : String(data.user.id),
        }
      : data.user,
    consent: data.consent
      ? { ...data.consent, id: data.consent.id == null ? data.consent.id : String(data.consent.id) }
      : data.consent,
    health: data.health
      ? { ...data.health, id: data.health.id == null ? data.health.id : String(data.health.id) }
      : data.health,
    medications: normalizeRecords(data.medications),
    caregivers: normalizeRecords(data.caregivers),
    careProviders: normalizeRecords(data.careProviders),
    sensors: normalizeRecords(data.sensors),
    alerts: normalizeRecords(data.alerts),
    readings: normalizeRecords(data.readings),
  };
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value || ""));
}

function careProvidersToCompatibilityCaregivers(careProviders, userId) {
  return careProviders
    .filter((provider) => provider.provider_type === "caregiver")
    .map((provider) => ({
      id: provider.id,
      assignment_id: provider.id,
      care_provider_contact_id: provider.provider_id,
      vyva_user_id: userId,
      caretaker_name: provider.display_name,
      caretaker_phone: provider.phone,
      is_primary: provider.is_primary,
      relationship_label: provider.relationship_label,
      notes: provider.notes,
      source: provider.source,
      created_at: provider.created_at,
    }));
}

async function loadExternalAssignmentSummaries(externalIds, context) {
  const organizationId = scopeOrganizationId(context);
  const ids = Array.from(new Set(externalIds.map((id) => String(id || "").trim()).filter(Boolean)));
  if (!ids.length) return new Map();

  const rows = await optionalRows(
    `
      SELECT
        u.external_user_id,
        COUNT(a.id)::int AS care_provider_count,
        MAX(c.full_name) FILTER (WHERE a.provider_type = 'caregiver' AND a.is_primary = true) AS primary_caregiver_name,
        MAX(fs.full_name) FILTER (WHERE a.provider_type = 'field_staff' AND a.is_primary = true) AS primary_professional_name,
        ARRAY_REMOVE(ARRAY_AGG(DISTINCT COALESCE(c.full_name, fs.full_name)), NULL) AS care_provider_names
      FROM public.vyva_users u
      LEFT JOIN public.vyva_user_care_provider_assignments a ON a.vyva_user_id = u.id
      LEFT JOIN public.care_provider_contacts c ON c.id = a.care_provider_contact_id
      LEFT JOIN public.field_staff fs ON fs.id = a.field_staff_id
      WHERE u.organization_id = $1
        AND u.external_source = $2
        AND u.external_user_id = ANY($3::text[])
      GROUP BY u.external_user_id
    `,
    [organizationId, externalUserSource, ids],
  );

  return new Map(rows.map((row) => [
    String(row.external_user_id),
    {
      careProviderCount: Number(row.care_provider_count || 0),
      careProviderNames: Array.isArray(row.care_provider_names) ? row.care_provider_names : [],
      primaryCaregiverName: row.primary_caregiver_name || null,
      primaryProfessionalName: row.primary_professional_name || null,
    },
  ]));
}

async function loadLocalUserIdForExternalUser(externalUserId, context, client = { query }) {
  const organizationId = scopeOrganizationId(context);
  const result = await client.query(
    `
      SELECT id::text
      FROM public.vyva_users
      WHERE organization_id = $1
        AND external_source = $2
        AND external_user_id = $3
      LIMIT 1
    `,
    [organizationId, externalUserSource, String(externalUserId)],
  );
  return result.rows[0]?.id || null;
}

async function loadExternalUserCareProviders(externalUserId, context) {
  const localUserId = await loadLocalUserIdForExternalUser(externalUserId, context);
  return localUserId ? loadUserCareProviders(localUserId, context) : [];
}

async function loadLatestMedicationActivity(userId) {
  const rows = await optionalRows(
    `
      SELECT
        l.id::text,
        l.medication_id::text,
        m.medication_name,
        l.status,
        l.reported_at,
        l.scheduled_date::text,
        l.scheduled_time,
        COALESCE(l.reported_at, l.created_at) AS occurred_at
      FROM public.vyva_medication_logs l
      LEFT JOIN public.vyva_user_medications m ON m.id = l.medication_id
      WHERE l.vyva_user_id = $1
      ORDER BY COALESCE(l.reported_at, l.created_at) DESC, l.scheduled_date DESC, l.scheduled_time DESC NULLS LAST
      LIMIT 1
    `,
    [userId],
  );
  return rows[0] || null;
}

async function loadExternalUserLocalServices(externalUserId, context) {
  const localUserId = await loadLocalUserIdForExternalUser(externalUserId, context);
  if (!localUserId) return { checkins: null, brainCoach: null, medicationActivity: null, sensors: [], alerts: [] };

  const [checkins, brainCoach, medicationActivity, sensors, alerts] = await Promise.all([
    optionalRows("SELECT *, id::text, vyva_user_id::text AS user_id FROM public.vyva_user_checkins WHERE vyva_user_id = $1 LIMIT 1", [localUserId]),
    optionalRows("SELECT *, id::text, vyva_user_id::text AS user_id FROM public.vyva_user_brain_coach WHERE vyva_user_id = $1 LIMIT 1", [localUserId]),
    loadLatestMedicationActivity(localUserId),
    optionalRows("SELECT *, id::text, vyva_user_id::text FROM public.vyva_user_sensors WHERE vyva_user_id = $1 ORDER BY created_at DESC", [localUserId]),
    optionalRows("SELECT *, id::text, vyva_user_id::text FROM public.vyva_sensor_alerts WHERE vyva_user_id = $1 ORDER BY created_at DESC LIMIT 50", [localUserId]),
  ]);

  return {
    checkins: checkins[0] ? normalizeCheckin({ ...checkins[0], user_name: "", user_phone: null, city: null, first_name: null, last_name: null }) : null,
    brainCoach: brainCoach[0] ? normalizeBrainCoachSession({ ...brainCoach[0], user_name: "", user_phone: null, city: null }) : null,
    medicationActivity,
    sensors,
    alerts,
  };
}

async function loadExternalUserCarePlanAccess(externalUserId, context) {
  const localUserId = await loadLocalUserIdForExternalUser(externalUserId, context);
  if (!localUserId) return null;
  return (await loadCarePlanAccessMap([localUserId], context)).get(String(localUserId)) || null;
}

function mergeExternalProfileWithLocalAssignments(data, careProviders, externalUserId, localServices = {}, carePlanAccess = null, scheduledContact = null) {
  const normalized = normalizeExternalProfilePayload(data);
  const hasProviders = Array.isArray(careProviders) && careProviders.length;
  const hasServices = Boolean(localServices?.checkins || localServices?.brainCoach || localServices?.medicationActivity);
  const hasSensors = Array.isArray(localServices?.sensors) && localServices.sensors.length;
  const hasAlerts = Array.isArray(localServices?.alerts) && localServices.alerts.length;
  const hasAccess = Boolean(carePlanAccess);
  if (!hasProviders && !hasServices && !hasSensors && !hasAlerts && !hasAccess && !scheduledContact) return normalized;
  const merged = {
    ...normalized,
    careProviders: hasProviders ? careProviders : normalized.careProviders,
    caregivers: hasProviders ? careProvidersToCompatibilityCaregivers(careProviders, String(externalUserId)) : normalized.caregivers,
    checkins: localServices?.checkins || normalized.checkins,
    brainCoach: localServices?.brainCoach || normalized.brainCoach,
    medicationActivity: localServices?.medicationActivity || normalized.medicationActivity,
    sensors: hasSensors ? localServices.sensors : normalized.sensors,
    alerts: hasAlerts ? localServices.alerts : normalized.alerts,
    can_edit_care_plan: carePlanAccess?.can_edit_care_plan ?? normalized.can_edit_care_plan,
    can_edit_medications: carePlanAccess?.can_edit_medications ?? normalized.can_edit_medications,
    can_edit_checkins: carePlanAccess?.can_edit_checkins ?? normalized.can_edit_checkins,
    can_edit_brain_coach: carePlanAccess?.can_edit_brain_coach ?? normalized.can_edit_brain_coach,
    edit_block_reason: carePlanAccess?.edit_block_reason ?? normalized.edit_block_reason,
  };
  return applyScheduledSessionContact(merged, latestScheduledContact(scheduledContact, latestScheduledContactFromServices({
    checkins: merged.checkins,
    brainCoach: merged.brainCoach,
    medicationActivity: merged.medicationActivity,
  })));
}

function normalizeLivingContextValue(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "alone" || normalized === "partner" || normalized === "family") return normalized;
  return null;
}

async function fetchExternalUserProfileForShadow(externalUserId) {
  const userInfo = await requestVyvaBackend("/api/v1/user-dashboard/user-info", {
    query: {
      user_id: externalUserId,
      organization_name: "Red Cross",
    },
  });
  if (userInfo?.ok) return normalizeExternalProfilePayload(userInfo.data);

  const dashboard = await requestVyvaBackend("/api/v1/user-dashboard/users");
  const match = Array.isArray(dashboard?.data?.gisUsers)
    ? dashboard.data.gisUsers.find((user) => String(user?.id) === String(externalUserId))
    : null;
  return match ? normalizeExternalProfilePayload({ user: match }) : null;
}

function normalizedExternalShadowUser(externalUserId, externalData, organization = null) {
  const user = objectValue(externalData?.user || externalData);
  const fullName = nullIfBlank(firstValue(user.full_name, user.fullName, user.name));
  const nameParts = fullName ? fullName.split(/\s+/).filter(Boolean) : [];
  const firstName = nullIfBlank(firstValue(user.first_name, user.firstName)) || nameParts[0] || "External";
  const lastName = nullIfBlank(firstValue(user.last_name, user.lastName)) || nameParts.slice(1).join(" ") || "User";
  const dateOfBirth = nullIfBlank(firstValue(user.date_of_birth, user.dateOfBirth));
  const language = nullIfBlank(user.language) || organization?.defaultLanguage || "de";
  const safeLanguage = ["en", "de", "es"].includes(language) ? language : organization?.defaultLanguage || "de";

  return {
    external_user_id: String(externalUserId),
    external_source: externalUserSource,
    first_name: firstName,
    last_name: lastName,
    phone: nullIfBlank(user.phone),
    city: nullIfBlank(user.city),
    street: nullIfBlank(user.street),
    house_number: nullIfBlank(firstValue(user.house_number, user.houseNumber)),
    post_code: nullIfBlank(firstValue(user.post_code, user.postCode, user.postal_code, user.postalCode)),
    country: nullIfBlank(user.country) || organization?.country || "Germany",
    timezone: nullIfBlank(user.timezone) || organization?.timezone || "Europe/Berlin",
    date_of_birth: dateOfBirth && /^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth) ? dateOfBirth : null,
    gender: nullIfBlank(user.gender),
    language: safeLanguage,
    emergency_notes: nullIfBlank(firstValue(user.emergency_notes, user.emergencyNotes)),
  };
}

function externalCaregiversForShadow(externalData) {
  const caregiverFieldPayload = (value) => {
    const record = objectValue(value);
    if (!record) return null;
    const hasCaregiverKeys = [
      record.caretaker_name,
      record.caretaker_phone,
      record.caregiver_name,
      record.caregiver_phone,
      record.contact_name,
      record.contact_phone,
      record.family_contact,
      record.family_phone,
      record.emergency_contact_name,
      record.emergency_contact_phone,
    ].some(hasMeaningfulPayloadValue);
    return hasCaregiverKeys ? record : null;
  };

  const caregivers = [
    ...(Array.isArray(externalData?.caregivers) ? externalData.caregivers : []),
    ...(Array.isArray(externalData?.emergency_contacts) ? externalData.emergency_contacts : []),
    ...(Array.isArray(externalData?.emergencyContacts) ? externalData.emergencyContacts : []),
    ...(Array.isArray(externalData?.careProviders) ? externalData.careProviders.filter((provider) => normalizeCareProviderType(provider?.provider_type || provider?.type) === "caregiver") : []),
    ...[
      externalData?.caregiver,
      externalData?.emergency_contact,
      externalData?.emergencyContact,
      externalData?.contact,
      externalData?.user?.caregiver,
      externalData?.user?.emergency_contact,
      externalData?.user?.emergencyContact,
      externalData?.user?.contact,
      caregiverFieldPayload(externalData),
      caregiverFieldPayload(externalData?.user),
    ].filter(Boolean),
  ];
  return caregivers
    .map((caregiver) => objectValue(caregiver))
    .filter(hasMeaningfulPayloadValue)
    .map((caregiver) => ({
      caretaker_name: nullIfBlank(firstValue(
        caregiver.caretaker_name,
        caregiver.caregiver_name,
        caregiver.contact_name,
        caregiver.family_contact,
        caregiver.emergency_contact_name,
        caregiver.display_name,
        caregiver.name,
        caregiver.full_name,
        caregiver.fullName,
        caregiver.provider_name,
        caregiver.providerName,
      )),
      caretaker_phone: nullIfBlank(firstValue(
        caregiver.caretaker_phone,
        caregiver.caregiver_phone,
        caregiver.contact_phone,
        caregiver.family_phone,
        caregiver.emergency_contact_phone,
        caregiver.phone,
        caregiver.phone_number,
        caregiver.phoneNumber,
      )),
      relationship_label: nullIfBlank(firstValue(caregiver.relationship_label, caregiver.relationship, caregiver.relationshipLabel, caregiver.role)),
      source: normalizeContactSource(caregiver.source, "onboarding"),
    }))
    .filter((caregiver) => caregiver.caretaker_name || caregiver.caretaker_phone)
    .filter((caregiver, index, list) => {
      const signature = JSON.stringify([caregiver.caretaker_name || "", caregiver.caretaker_phone || ""]);
      return list.findIndex((candidate) => JSON.stringify([candidate.caretaker_name || "", candidate.caretaker_phone || ""]) === signature) === index;
    });
}

async function ensureLocalUserForAssignmentWithClient(client, rawUserId, context) {
  const organizationId = scopeOrganizationId(context);
  const userId = String(rawUserId || "").trim();
  if (!userId) return { error: "user_id is required" };

  if (isUuid(userId)) {
    const localUser = await client.query(
      "SELECT id::text FROM public.vyva_users WHERE id = $1 AND organization_id = $2 LIMIT 1",
      [userId, organizationId],
    );
    if (localUser.rows[0]) return { value: localUser.rows[0].id };
  }

  const existingShadowId = await loadLocalUserIdForExternalUser(userId, context, client);
  if (existingShadowId) {
    const externalData = await fetchExternalUserProfileForShadow(userId).catch(() => null);
    const onboardingCaregivers = externalCaregiversForShadow(externalData);
    if (onboardingCaregivers.length) {
      await replaceCaregiversWithClient(client, existingShadowId, onboardingCaregivers, organizationId);
    }
    return { value: existingShadowId };
  }

  const externalData = await fetchExternalUserProfileForShadow(userId);
  if (!externalData?.user) return { notFound: true };

  const shadowUser = normalizedExternalShadowUser(userId, externalData, context.organization);
  const result = await client.query(
    `
      INSERT INTO public.vyva_users (
        organization_id,
        external_user_id,
        external_source,
        first_name,
        last_name,
        phone,
        city,
        street,
        house_number,
        post_code,
        country,
        timezone,
        date_of_birth,
        gender,
        language,
        emergency_notes
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::date, $14, $15, $16)
      ON CONFLICT (organization_id, external_source, external_user_id) WHERE external_user_id IS NOT NULL
      DO UPDATE SET
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        phone = COALESCE(EXCLUDED.phone, public.vyva_users.phone),
        city = COALESCE(EXCLUDED.city, public.vyva_users.city),
        street = COALESCE(EXCLUDED.street, public.vyva_users.street),
        house_number = COALESCE(EXCLUDED.house_number, public.vyva_users.house_number),
        post_code = COALESCE(EXCLUDED.post_code, public.vyva_users.post_code),
        country = COALESCE(EXCLUDED.country, public.vyva_users.country),
        timezone = COALESCE(EXCLUDED.timezone, public.vyva_users.timezone),
        date_of_birth = COALESCE(EXCLUDED.date_of_birth, public.vyva_users.date_of_birth),
        gender = COALESCE(EXCLUDED.gender, public.vyva_users.gender),
        language = COALESCE(EXCLUDED.language, public.vyva_users.language),
        emergency_notes = COALESCE(EXCLUDED.emergency_notes, public.vyva_users.emergency_notes),
        updated_at = now()
      RETURNING id::text
    `,
    [
      organizationId,
      shadowUser.external_user_id,
      shadowUser.external_source,
      shadowUser.first_name,
      shadowUser.last_name,
      shadowUser.phone,
      shadowUser.city,
      shadowUser.street,
      shadowUser.house_number,
      shadowUser.post_code,
      shadowUser.country,
      shadowUser.timezone,
      shadowUser.date_of_birth,
      shadowUser.gender,
      shadowUser.language,
      shadowUser.emergency_notes,
    ],
  );

  const localUserId = result.rows[0]?.id;
  if (!localUserId) return { notFound: true };

  const onboardingCaregivers = externalCaregiversForShadow(externalData);
  if (onboardingCaregivers.length) {
    await replaceCaregiversWithClient(client, localUserId, onboardingCaregivers, organizationId);
  }

  return { value: localUserId };
}

async function requestVyvaBackend(pathname, { method = "GET", query: queryParams, body } = {}) {
  if (vyvaBackendApiDisabled || !vyvaBackendApiUrl) return null;

  const url = new URL(pathname, `${vyvaBackendApiUrl}/`);
  appendSearchParams(url, queryParams);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(process.env.VYVA_BACKEND_API_TIMEOUT_MS || 8000));

  try {
    const response = await fetch(url, {
      method,
      headers: body === undefined ? { Accept: "application/json" } : { Accept: "application/json", "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
    const text = await response.text();
    const data = text ? JSON.parse(text) : {};
    return {
      ok: response.ok,
      status: response.status,
      data,
    };
  } catch (error) {
    console.warn("VYVA backend API unavailable:", error instanceof Error ? error.message : "request failed");
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function handleVyvaBackendResponse(res, upstream, successStatus) {
  if (upstream?.ok) {
    res.status(successStatus || upstream.status || 200).json(upstream.data);
    return true;
  }
  if (upstream && upstream.status >= 400 && upstream.status < 500 && upstream.status !== 404) {
    res.status(upstream.status).json(upstream.data);
    return true;
  }
  return false;
}

async function query(text, params = []) {
  if (!pool) {
    const error = new Error("Database is not configured");
    error.code = "DB_NOT_CONFIGURED";
    throw error;
  }
  return pool.query(text, params);
}

async function optionalRows(text, params = []) {
  try {
    const result = await query(text, params);
    return result.rows;
  } catch (error) {
    if (["42P01", "42703"].includes(error.code)) {
      console.warn("Optional database object unavailable:", error.message);
      return [];
    }
    throw error;
  }
}

function httpError(status, message, expose = status < 500) {
  const error = new Error(message);
  error.status = status;
  error.expose = expose;
  return error;
}

const PROJECT_OWNER_PLATFORM_ADMIN_EMAILS = [
  "karim.assad@mokadigital.net",
];

function platformAdminEmails() {
  const configuredEmails = String(
    process.env.VYVA_PLATFORM_ADMIN_EMAILS ||
    process.env.PLATFORM_ADMIN_EMAILS ||
    process.env.VYVA_PLATFORM_ADMINS ||
    process.env.PLATFORM_ADMINS ||
    process.env.VYVA_SUPER_ADMIN_EMAILS ||
    process.env.SUPER_ADMIN_EMAILS ||
    "",
  )
    .split(/[\s,;]+/)
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  return Array.from(new Set([...configuredEmails, ...PROJECT_OWNER_PLATFORM_ADMIN_EMAILS]));
}

function userHasPlatformAdminMetadata(user) {
  const metadata = user?.app_metadata && typeof user.app_metadata === "object"
    ? user.app_metadata
    : user?.raw_app_meta_data && typeof user.raw_app_meta_data === "object"
      ? user.raw_app_meta_data
      : {};
  const truthyFlags = [
    metadata.is_platform_admin,
    metadata.isPlatformAdmin,
    metadata.platform_admin,
    metadata.platformAdmin,
    metadata.is_super_admin,
    metadata.isSuperAdmin,
    metadata.super_admin,
    metadata.superAdmin,
  ];
  if (truthyFlags.some((value) => value === true || String(value).toLowerCase() === "true")) return true;

  const roleValues = [
    metadata.role,
    metadata.roles,
    metadata.user_role,
    metadata.user_roles,
    metadata.platform_role,
    metadata.platformRole,
  ].flatMap((value) => {
    if (Array.isArray(value)) return value;
    if (typeof value === "string") return value.split(",");
    return [];
  });
  return roleValues
    .map((value) => String(value).trim().toLowerCase().replace(/[\s-]+/g, "_"))
    .some((value) => ["platform_admin", "platform_owner", "super_admin", "superadmin"].includes(value));
}

function decodeJwtPayload(token) {
  const payload = String(token || "").split(".")[1];
  if (!payload) return null;
  try {
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    return JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
  } catch {
    return null;
  }
}

async function devProjectAdminContextFromInvalidToken(token) {
  if (isProduction) return null;
  const payload = decodeJwtPayload(token);
  const email = normalizedEmail(payload?.email || payload?.user_metadata?.email || payload?.app_metadata?.email);
  if (!platformAdminEmails().includes(email)) return null;

  const org = await defaultOrganization();
  return {
    userId: payload?.sub || `dev-platform-admin:${email}`,
    email,
    fullName: payload?.user_metadata?.full_name || payload?.user_metadata?.name || null,
    roles: ["admin"],
    role: "admin",
    isAdmin: true,
    isPlatformAdmin: true,
    organizationId: org?.id || null,
    organization: {
      id: org?.id || null,
      slug: org?.slug || "red-cross-leipzig",
      name: org?.name || "Red Cross Leipzig",
      country: org?.country || "Germany",
      defaultLanguage: org?.default_language || "de",
      timezone: org?.timezone || "Europe/Berlin",
    },
    authToken: token,
  };
}

async function defaultOrganization() {
  const result = await query(
    `
      SELECT id::text, slug, name, country, default_language, timezone, active
      FROM public.organizations
      WHERE slug = 'red-cross-leipzig'
      LIMIT 1
    `,
  );
  return result.rows[0] || null;
}

async function loadOrganizations({ includeInactive = false } = {}) {
  const result = await query(
    `
      SELECT id::text, slug, name, country, default_language, timezone, active, created_at, updated_at
      FROM public.organizations
      WHERE ($1::boolean = true OR active = true)
      ORDER BY name ASC
    `,
    [includeInactive],
  );
  return result.rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    country: row.country,
    defaultLanguage: row.default_language,
    timezone: row.timezone,
    active: Boolean(row.active),
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  }));
}

async function loadOrganizationById(id) {
  const result = await query(
    `
      SELECT id::text, slug, name, country, default_language, timezone, active, created_at, updated_at
      FROM public.organizations
      WHERE id::text = $1 OR slug = $1
      LIMIT 1
    `,
    [String(id || "")],
  );
  return organizationRow(result.rows[0]);
}

async function verifySupabaseToken(token) {
  if (!supabaseUrl || !supabaseAnonKey) return null;
  const cached = tokenUserCache.get(token);
  if (cached && cached.expiresAt > Date.now()) return cached.user;

  const response = await fetch(`${supabaseBaseUrl}/auth/v1/user`, {
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok) return null;
  const user = await response.json();
  tokenUserCache.set(token, { user, expiresAt: Date.now() + 60_000 });
  return user;
}

function supabaseTeamInviteClient() {
  if (!supabaseUrl || !supabaseServiceRoleKey) return null;
  if (!supabaseInviteAuthClient) {
    supabaseInviteAuthClient = createSupabaseClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    });
  }
  return supabaseInviteAuthClient;
}

function supabaseHostedMagicLinkClient() {
  if (!supabaseUrl || !supabaseAnonKey) return null;
  if (!supabaseHostedAuthClient) {
    supabaseHostedAuthClient = createSupabaseClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    });
  }
  return supabaseHostedAuthClient;
}

function inviteEmailProvider() {
  if (resendApiKey) return "resend";
  if (sendgridApiKey) return "sendgrid";
  if (postmarkServerToken) return "postmark";
  return null;
}

function inviteEmailConfigurationError() {
  if (!supabaseUrl || !supabaseServiceRoleKey) return "Supabase service role key is required to generate secure invite links";
  if (!teamInviteEmailFrom) return "Invite email sender is not configured";
  if (!inviteEmailProvider()) return "Invite email provider is not configured";
  return null;
}

function requestOrigin(req) {
  const origin = req.get("origin");
  if (origin) return origin;

  const host = req.get("x-forwarded-host") || req.get("host");
  if (!host) return null;
  const protocol = (req.get("x-forwarded-proto") || req.protocol || "https").split(",")[0].trim();
  return `${protocol}://${host}`;
}

function trimTrailingSlash(value) {
  return value ? String(value).replace(/\/$/, "") : null;
}

function appBaseUrl(origin) {
  return trimTrailingSlash(publicAppUrl || origin);
}

function absoluteAppUrl(pathOrUrl, origin) {
  if (!pathOrUrl) return null;
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;

  const baseUrl = appBaseUrl(origin);
  if (!baseUrl) return null;
  const normalizedPath = String(pathOrUrl).startsWith("/") ? String(pathOrUrl) : `/${pathOrUrl}`;
  return new URL(normalizedPath, `${baseUrl}/`).toString();
}

function inviteEmailLanguage(organization) {
  const language = String(organization?.defaultLanguage || organization?.default_language || "").toLowerCase();
  if (language.startsWith("de")) return "de";
  if (language.startsWith("es")) return "es";
  return "en";
}

const consoleMagicLinkCache = new Map();
const consoleMagicLinkInFlight = new Map();
const consoleMagicLinkCacheMs = 55_000;

function consoleMagicLinkKey({ email, redirectPath, language, origin }) {
  return JSON.stringify([
    normalizedEmail(email),
    loginRedirectPath(redirectPath),
    loginEmailLanguage(language),
    origin || "",
  ]);
}

async function sendConsoleMagicLinkOnce(options) {
  const key = consoleMagicLinkKey(options);
  const active = consoleMagicLinkInFlight.get(key);
  if (active) return active;

  const promise = sendConsoleMagicLink(options)
    .finally(() => {
      consoleMagicLinkInFlight.delete(key);
    });
  consoleMagicLinkInFlight.set(key, promise);
  return promise;
}

function inviteRoleLabel(role, language) {
  if (role === "admin") {
    if (language === "de") return "Admin";
    if (language === "es") return "admin";
    return "admin";
  }
  if (language === "de") return "Operator";
  if (language === "es") return "operador";
  return "operator";
}

function teamInviteGuideUrl(origin) {
  return absoluteAppUrl(teamInviteGuideUrlOverride || teamInviteGuidePath, origin);
}

function teamInviteRedirectUrl(origin) {
  return absoluteAppUrl(teamInviteRedirectPath, origin);
}

function userManualUrl(origin) {
  return absoluteAppUrl(userManualUrlOverride, origin);
}

function teamInviteMetadata({ context, role, organization, origin }) {
  const language = inviteEmailLanguage(organization);
  const guideUrl = teamInviteGuideUrl(origin);
  const redirectUrl = teamInviteRedirectUrl(origin);
  return {
    metadata: {
      invite_type: "team_member",
      language,
      email_language: language,
      invited_role: role,
      invited_role_label: inviteRoleLabel(role, language),
      invited_by_email: context?.email || null,
      organization_id: organization?.id || null,
      organization_name: organization?.name || null,
      guide_url: guideUrl,
    },
    guideUrl,
    language,
    redirectUrl,
  };
}

async function generateSupabaseTeamMagicLink({ email, metadata, redirectUrl }) {
  const supabase = supabaseTeamInviteClient();
  if (!supabase) {
    return { actionLink: null, userId: null, error: "Supabase service role key is required to generate secure invite links" };
  }

  const { data, error } = await supabase.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: {
      data: metadata,
      redirectTo: redirectUrl || undefined,
    },
  });

  if (error) {
    return { actionLink: null, userId: null, error: error.message || "Invite link could not be generated" };
  }

  const actionLink = data?.properties?.action_link || data?.properties?.actionLink || null;
  if (!actionLink) {
    return { actionLink: null, userId: data?.user?.id || null, error: "Invite link was not returned" };
  }

  return { actionLink, userId: data?.user?.id || null, error: null };
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function inviteEmailCopy(language, values) {
  const organizationName = values.organizationName || null;
  const roleLabel = values.roleLabel || "team member";

  if (language === "de") {
    return {
      subject: "Ihre Einladung zur VYVA Konsole",
      eyebrow: "Teameinladung",
      heading: "Willkommen bei VYVA",
      intro: `Sie wurden${organizationName ? ` fuer ${organizationName}` : ""} als ${roleLabel} hinzugefuegt. Nutzen Sie den sicheren Link unten, um die Konsole zu oeffnen.`,
      button: "VYVA oeffnen",
      guideTitle: "Interaktiver Guide",
      guideText: "Nach der Anmeldung koennen Sie den Guide oeffnen, um sich in der Konsole zu orientieren.",
      guideButton: "Guide oeffnen",
      securityTitle: "Sicherheitshinweis",
      securityText: "Wenn Sie diese E-Mail nicht erwartet haben, koennen Sie sie ignorieren. Ohne Zugriff auf dieses Postfach kann sich niemand anmelden.",
      fallback: "Button funktioniert nicht? Kopieren Sie diesen Link in Ihren Browser:",
      footer: "Automatische Einladungs-E-Mail fuer autorisierte VYVA Konsolennutzer.",
    };
  }

  if (language === "es") {
    return {
      subject: "Tu invitacion a la consola VYVA",
      eyebrow: "Invitacion de equipo",
      heading: "Bienvenido a VYVA",
      intro: `Te agregaron${organizationName ? ` a ${organizationName}` : ""} como ${roleLabel}. Usa el enlace seguro de abajo para abrir la consola.`,
      button: "Abrir VYVA",
      guideTitle: "Guia interactiva",
      guideText: "Despues de iniciar sesion, puedes abrir la guia para orientarte en la consola.",
      guideButton: "Abrir guia",
      securityTitle: "Nota de seguridad",
      securityText: "Si no esperabas este correo, puedes ignorarlo. Nadie iniciara sesion sin acceso a esta bandeja de entrada.",
      fallback: "Si el boton no funciona, copia este enlace en tu navegador:",
      footer: "Correo automatico de invitacion para usuarios autorizados de la consola VYVA.",
    };
  }

  return {
    subject: "Your VYVA console invitation",
    eyebrow: "Team invite",
    heading: "Welcome to VYVA",
    intro: `You were added${organizationName ? ` to ${organizationName}` : ""} as ${roleLabel}. Use the secure link below to open the console.`,
    button: "Open VYVA",
    guideTitle: "Interactive guide",
    guideText: "After signing in, open the guide for help getting oriented in the console.",
    guideButton: "Open guide",
    securityTitle: "Security note",
    securityText: "If you were not expecting this email, you can ignore it. No one will be signed in without access to this inbox.",
    fallback: "Button not working? Copy and paste this link into your browser:",
    footer: "Automated invitation email for authorized VYVA console users.",
  };
}

function renderTeamInviteEmail({ actionLink, invite }) {
  const metadata = invite.metadata || {};
  const language = invite.language || "en";
  const copy = inviteEmailCopy(language, {
    organizationName: metadata.organization_name,
    roleLabel: metadata.invited_role_label,
  });
  const safeActionLink = escapeHtml(actionLink);
  const safeGuideUrl = invite.guideUrl ? escapeHtml(invite.guideUrl) : null;
  const plainLines = [
    copy.heading,
    "",
    copy.intro,
    "",
    `${copy.button}: ${actionLink}`,
    invite.guideUrl ? `${copy.guideButton}: ${invite.guideUrl}` : null,
    "",
    copy.securityText,
  ].filter(Boolean);

  const guideBlock = safeGuideUrl
    ? `
            <tr>
              <td style="padding:0 32px 30px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #dfe5ef;border-radius:16px;">
                  <tr>
                    <td style="padding:18px 20px;">
                      <p style="margin:0 0 8px;font-size:13px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#17172f;">${escapeHtml(copy.guideTitle)}</p>
                      <p style="margin:0 0 14px;font-size:14px;line-height:1.55;color:#5f667a;">${escapeHtml(copy.guideText)}</p>
                      <a href="${safeGuideUrl}" style="display:inline-block;color:#6c4df6;text-decoration:none;font-size:14px;font-weight:700;">${escapeHtml(copy.guideButton)}</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>`
    : "";

  return {
    subject: copy.subject,
    text: plainLines.join("\n"),
    html: `<!doctype html>
<html lang="${escapeHtml(language)}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(copy.subject)}</title>
  </head>
  <body style="margin:0;background:#eef3fb;font-family:Arial,Helvetica,sans-serif;color:#17172f;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef3fb;margin:0;padding:32px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid #dde3f0;border-radius:20px;overflow:hidden;box-shadow:0 18px 44px rgba(38,45,72,0.12);">
            <tr>
              <td style="padding:28px 32px 22px;border-bottom:1px solid #edf0f7;">
                <span style="display:inline-block;width:42px;height:42px;border-radius:14px;background:#6c4df6;color:#ffffff;font-size:20px;font-weight:700;line-height:42px;text-align:center;margin-right:12px;">V</span>
                <span style="font-size:20px;font-weight:700;color:#17172f;vertical-align:middle;">VYVA</span>
              </td>
            </tr>
            <tr>
              <td style="padding:34px 32px 8px;">
                <p style="display:inline-block;margin:0 0 14px;padding:7px 12px;border-radius:999px;background:#f0ecff;color:#6c4df6;font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;">${escapeHtml(copy.eyebrow)}</p>
                <h1 style="margin:0 0 14px;font-size:30px;line-height:1.18;color:#17172f;">${escapeHtml(copy.heading)}</h1>
                <p style="margin:0;font-size:16px;line-height:1.65;color:#5f667a;">${escapeHtml(copy.intro)}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:26px 32px 30px;">
                <a href="${safeActionLink}" style="display:inline-block;background:#6c4df6;color:#ffffff;text-decoration:none;font-size:16px;font-weight:700;line-height:1;border-radius:14px;padding:17px 24px;box-shadow:0 10px 22px rgba(108,77,246,0.28);">${escapeHtml(copy.button)}</a>
              </td>
            </tr>
            ${guideBlock}
            <tr>
              <td style="padding:0 32px 30px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f5ff;border:1px solid #ded8ff;border-radius:16px;">
                  <tr>
                    <td style="padding:18px 20px;">
                      <p style="margin:0 0 8px;font-size:13px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#6c4df6;">${escapeHtml(copy.securityTitle)}</p>
                      <p style="margin:0;font-size:14px;line-height:1.55;color:#5f667a;">${escapeHtml(copy.securityText)}</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 34px;">
                <p style="margin:0 0 8px;font-size:13px;line-height:1.55;color:#7a8297;">${escapeHtml(copy.fallback)}</p>
                <p style="margin:0;font-size:12px;line-height:1.55;color:#6c4df6;word-break:break-all;">${safeActionLink}</p>
              </td>
            </tr>
            <tr>
              <td style="background:#17172f;padding:18px 32px;">
                <p style="margin:0;font-size:12px;line-height:1.6;color:#c8ccda;">${escapeHtml(copy.footer)}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`,
  };
}

function consoleMagicLinkCopy(language) {
  if (language === "de") {
    return {
      subject: "Ihr sicherer VYVA Login-Link",
      eyebrow: "Sicherer Zugang",
      heading: "Bei VYVA anmelden",
      intro:
        "VYVA ist die Einsatzkonsole fuer koordinierte Betreuung, Check-ins, Medikationsnachverfolgung und Risikopriorisierung. Oeffnen Sie die Konsole ueber den sicheren Einmal-Link unten.",
      button: "Bei VYVA anmelden",
      platformTitle: "Was Sie in VYVA tun koennen",
      platformItems: [
        "Klienten nach Risiko und Kontaktbedarf priorisieren.",
        "Check-up-Anrufe, Brain-Coach-Routinen und Medikationshinweise pruefen.",
        "Red-Cross-Teams und Notfallkontakte koordiniert halten.",
      ],
      manualTitle: "Benutzerhandbuch",
      manualText: "Ein vollstaendiges Benutzerhandbuch wird hier verlinkt, sobald es bereitsteht.",
      manualButton: "Handbuch oeffnen",
      securityTitle: "Sicherheitshinweis",
      securityText: "Wenn Sie diese E-Mail nicht angefordert haben, koennen Sie sie ignorieren. Der Link ist nur fuer dieses Postfach bestimmt.",
      fallback: "Button funktioniert nicht? Kopieren Sie diesen Link in Ihren Browser:",
      footer: "Automatische VYVA Login-E-Mail fuer autorisierte Konsolennutzer.",
    };
  }

  if (language === "es") {
    return {
      subject: "Tu enlace seguro de acceso a VYVA",
      eyebrow: "Acceso seguro",
      heading: "Iniciar sesion en VYVA",
      intro:
        "VYVA es la consola operativa para coordinar atencion, check-ins, medicacion, asignaciones y priorizacion de riesgo. Abre la consola con el enlace seguro de un solo uso.",
      button: "Abrir VYVA",
      platformTitle: "Que puedes hacer en VYVA",
      platformItems: [
        "Priorizar clientes segun riesgo y necesidad de contacto.",
        "Revisar llamadas de seguimiento, Brain Coach y medicacion.",
        "Coordinar equipos de Cruz Roja y contactos de emergencia.",
      ],
      manualTitle: "Manual de usuario",
      manualText: "El manual completo se enlazara aqui en cuanto este disponible.",
      manualButton: "Abrir manual",
      securityTitle: "Nota de seguridad",
      securityText: "Si no solicitaste este correo, puedes ignorarlo. El enlace esta destinado solo a esta bandeja de entrada.",
      fallback: "Si el boton no funciona, copia este enlace en tu navegador:",
      footer: "Correo automatico de acceso a VYVA para usuarios autorizados de la consola.",
    };
  }

  return {
    subject: "Your secure VYVA sign-in link",
    eyebrow: "Secure access",
    heading: "Sign in to VYVA",
    intro:
      "VYVA is the operations console for coordinating care, check-ins, medication follow-up, assignments, and risk prioritization. Open the console with the secure one-time link below.",
    button: "Open VYVA",
    platformTitle: "What you can do in VYVA",
    platformItems: [
      "Prioritize clients by risk and contact need.",
      "Review check-up calls, Brain Coach routines, and medication follow-up.",
      "Coordinate Red Cross staff and emergency contacts.",
    ],
    manualTitle: "User manual",
    manualText: "A full user manual will be linked here once it is available.",
    manualButton: "Open manual",
    securityTitle: "Security note",
    securityText: "If you did not request this email, you can safely ignore it. This link is intended only for this inbox.",
    fallback: "Button not working? Copy and paste this link into your browser:",
    footer: "Automated VYVA sign-in email for authorized console users.",
  };
}

function renderConsoleMagicLinkEmail({ actionLink, language = "en", manualUrl }) {
  const copy = consoleMagicLinkCopy(language);
  const safeActionLink = escapeHtml(actionLink);
  const safeManualUrl = manualUrl ? escapeHtml(manualUrl) : null;
  const plainLines = [
    copy.heading,
    "",
    copy.intro,
    "",
    `${copy.button}: ${actionLink}`,
    manualUrl ? `${copy.manualButton}: ${manualUrl}` : null,
    "",
    copy.securityText,
  ].filter(Boolean);
  const itemList = copy.platformItems
    .map((item) => `<li style="margin:0 0 8px;color:#5f667a;font-size:14px;line-height:1.55;">${escapeHtml(item)}</li>`)
    .join("");
  const manualBlock = safeManualUrl
    ? `
            <tr>
              <td style="padding:0 32px 28px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #dfe5ef;border-radius:16px;">
                  <tr>
                    <td style="padding:18px 20px;">
                      <p style="margin:0 0 8px;font-size:13px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#17172f;">${escapeHtml(copy.manualTitle)}</p>
                      <p style="margin:0 0 14px;font-size:14px;line-height:1.55;color:#5f667a;">${escapeHtml(copy.manualText)}</p>
                      <a href="${safeManualUrl}" style="display:inline-block;color:#6c4df6;text-decoration:none;font-size:14px;font-weight:700;">${escapeHtml(copy.manualButton)}</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>`
    : "";

  return {
    subject: copy.subject,
    text: plainLines.join("\n"),
    html: `<!doctype html>
<html lang="${escapeHtml(language)}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(copy.subject)}</title>
  </head>
  <body style="margin:0;background:#eef3fb;font-family:Arial,Helvetica,sans-serif;color:#17172f;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef3fb;margin:0;padding:32px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:#ffffff;border:1px solid #dde3f0;border-radius:22px;overflow:hidden;box-shadow:0 18px 44px rgba(38,45,72,0.12);">
            <tr>
              <td style="padding:30px 32px 24px;border-bottom:1px solid #edf0f7;">
                <span style="display:inline-block;width:44px;height:44px;border-radius:14px;background:#6c4df6;color:#ffffff;font-size:21px;font-weight:700;line-height:44px;text-align:center;margin-right:12px;">V</span>
                <span style="font-size:22px;font-weight:700;color:#17172f;vertical-align:middle;">VYVA</span>
                <span style="display:block;margin-top:7px;margin-left:58px;font-size:11px;letter-spacing:0.28em;text-transform:uppercase;color:#6b7280;">Red Cross console</span>
              </td>
            </tr>
            <tr>
              <td style="padding:34px 32px 8px;">
                <p style="display:inline-block;margin:0 0 14px;padding:7px 12px;border-radius:999px;background:#f0ecff;color:#6c4df6;font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;">${escapeHtml(copy.eyebrow)}</p>
                <h1 style="margin:0 0 14px;font-size:30px;line-height:1.18;color:#17172f;">${escapeHtml(copy.heading)}</h1>
                <p style="margin:0;font-size:16px;line-height:1.65;color:#5f667a;">${escapeHtml(copy.intro)}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:26px 32px 30px;">
                <a href="${safeActionLink}" style="display:inline-block;background:#6c4df6;color:#ffffff;text-decoration:none;font-size:16px;font-weight:700;line-height:1;border-radius:14px;padding:17px 24px;box-shadow:0 10px 22px rgba(108,77,246,0.28);">${escapeHtml(copy.button)}</a>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 28px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fbfcff;border:1px solid #e3e8f4;border-radius:16px;">
                  <tr>
                    <td style="padding:18px 20px;">
                      <p style="margin:0 0 10px;font-size:13px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#17172f;">${escapeHtml(copy.platformTitle)}</p>
                      <ul style="margin:0;padding-left:18px;">${itemList}</ul>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            ${manualBlock}
            <tr>
              <td style="padding:0 32px 30px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f5ff;border:1px solid #ded8ff;border-radius:16px;">
                  <tr>
                    <td style="padding:18px 20px;">
                      <p style="margin:0 0 8px;font-size:13px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#6c4df6;">${escapeHtml(copy.securityTitle)}</p>
                      <p style="margin:0;font-size:14px;line-height:1.55;color:#5f667a;">${escapeHtml(copy.securityText)}</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 34px;">
                <p style="margin:0 0 8px;font-size:13px;line-height:1.55;color:#7a8297;">${escapeHtml(copy.fallback)}</p>
                <p style="margin:0;font-size:12px;line-height:1.55;color:#6c4df6;word-break:break-all;">${safeActionLink}</p>
              </td>
            </tr>
            <tr>
              <td style="background:#17172f;padding:18px 32px;">
                <p style="margin:0;font-size:12px;line-height:1.6;color:#c8ccda;">${escapeHtml(copy.footer)}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`,
  };
}

function parseEmailIdentity(value) {
  const text = String(value || "").trim();
  const match = text.match(/^(.*?)\s*<([^>]+)>$/);
  if (!match) return { email: text };
  const name = match[1].trim().replace(/^"|"$/g, "");
  return { email: match[2].trim(), name: name || undefined };
}

async function sendEmailProviderRequest({ url, headers, body, provider }) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });
  const responseText = await response.text().catch(() => "");
  let parsed = null;
  try {
    parsed = responseText ? JSON.parse(responseText) : null;
  } catch {
    parsed = null;
  }
  if (!response.ok) {
    const message =
      (Array.isArray(parsed?.errors) && parsed.errors[0]?.message) ||
      parsed?.message ||
      parsed?.error ||
      responseText ||
      `${provider} email request failed`;
    throw new Error(message);
  }
  return parsed;
}

async function sendRenderedTeamInviteEmail({ to, rendered }) {
  const configError = inviteEmailConfigurationError();
  if (configError) return { sent: false, error: configError, provider: null };

  const provider = inviteEmailProvider();
  try {
    if (provider === "resend") {
      await sendEmailProviderRequest({
        provider,
        url: "https://api.resend.com/emails",
        headers: { Authorization: `Bearer ${resendApiKey}` },
        body: {
          from: teamInviteEmailFrom,
          to: [to],
          subject: rendered.subject,
          html: rendered.html,
          text: rendered.text,
          reply_to: teamInviteEmailReplyTo || undefined,
        },
      });
    } else if (provider === "sendgrid") {
      const from = parseEmailIdentity(teamInviteEmailFrom);
      const replyTo = teamInviteEmailReplyTo ? parseEmailIdentity(teamInviteEmailReplyTo) : null;
      await sendEmailProviderRequest({
        provider,
        url: "https://api.sendgrid.com/v3/mail/send",
        headers: { Authorization: `Bearer ${sendgridApiKey}` },
        body: {
          personalizations: [{ to: [{ email: to }], subject: rendered.subject }],
          from,
          reply_to: replyTo || undefined,
          content: [
            { type: "text/plain", value: rendered.text },
            { type: "text/html", value: rendered.html },
          ],
        },
      });
    } else if (provider === "postmark") {
      await sendEmailProviderRequest({
        provider,
        url: "https://api.postmarkapp.com/email",
        headers: { "X-Postmark-Server-Token": postmarkServerToken },
        body: {
          From: teamInviteEmailFrom,
          To: to,
          Subject: rendered.subject,
          HtmlBody: rendered.html,
          TextBody: rendered.text,
          ReplyTo: teamInviteEmailReplyTo || undefined,
        },
      });
    }
    return { sent: true, error: null, provider };
  } catch (error) {
    return { sent: false, error: error?.message || "Invite email could not be sent", provider };
  }
}

async function reconcilePendingTeamMemberByEmail(userId, email) {
  if (!email || !pool) return;
  const pendingResult = await query(
    "SELECT user_id FROM public.profiles WHERE LOWER(email) = LOWER($1) AND user_id <> $2",
    [email, userId],
  );
  const pendingIds = pendingResult.rows.map((row) => row.user_id).filter(Boolean);
  if (!pendingIds.length) return;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const pendingId of pendingIds) {
      await client.query(
        `
          INSERT INTO public.profiles (user_id, organization_id, is_platform_admin, full_name, email)
          SELECT $1, organization_id, is_platform_admin, full_name, email
          FROM public.profiles
          WHERE user_id = $2
          ON CONFLICT (user_id) DO UPDATE SET
            organization_id = COALESCE(public.profiles.organization_id, EXCLUDED.organization_id),
            is_platform_admin = public.profiles.is_platform_admin OR EXCLUDED.is_platform_admin,
            full_name = COALESCE(public.profiles.full_name, EXCLUDED.full_name),
            email = COALESCE(public.profiles.email, EXCLUDED.email),
            updated_at = now()
        `,
        [userId, pendingId],
      );
      await client.query(
        `
          INSERT INTO public.user_roles (user_id, organization_id, role)
          SELECT $1, organization_id, role
          FROM public.user_roles
          WHERE user_id = $2
          ON CONFLICT (user_id, role) DO UPDATE SET organization_id = EXCLUDED.organization_id
        `,
        [userId, pendingId],
      );
      await client.query("DELETE FROM public.user_roles WHERE user_id = $1", [pendingId]);
      await client.query("DELETE FROM public.profiles WHERE user_id = $1", [pendingId]);
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function loadUserContext(user) {
  const authEmail = String(user.email || "").toLowerCase();
  if (authEmail) await reconcilePendingTeamMemberByEmail(user.id, authEmail);

  const rolesResult = await query(
    `
      SELECT role::text, organization_id::text
      FROM public.user_roles
      WHERE user_id = $1
      ORDER BY CASE role WHEN 'admin' THEN 0 ELSE 1 END
    `,
    [user.id],
  );
  const profileResult = await query(
    `
      SELECT
        p.user_id,
        p.full_name,
        p.email,
        p.organization_id::text,
        p.is_platform_admin,
        o.id::text AS org_id,
        o.slug AS org_slug,
        o.name AS org_name,
        o.country AS org_country,
        o.default_language,
        o.timezone
      FROM public.profiles p
      LEFT JOIN public.organizations o ON o.id = p.organization_id
      WHERE p.user_id = $1 OR ($2 <> '' AND LOWER(p.email) = LOWER($2))
      ORDER BY CASE WHEN p.user_id = $1 THEN 0 ELSE 1 END
      LIMIT 1
    `,
    [user.id, authEmail],
  );
  const profile = profileResult.rows[0] || null;
  const email = String(user.email || profile?.email || "").toLowerCase();
  const isPlatformAdmin =
    Boolean(profile?.is_platform_admin) ||
    platformAdminEmails().includes(email) ||
    userHasPlatformAdminMetadata(user);
  const roles = Array.from(new Set(
    rolesResult.rows
      .map((row) => row.role === "admin" ? "admin" : "operator")
      .filter(Boolean),
  ));
  const hasConsoleAccess = isPlatformAdmin || roles.includes("admin");
  if (!hasConsoleAccess) {
    throw httpError(403, "No console access has been granted for this email");
  }

  const primaryRole = "admin";
  const roleOrg = rolesResult.rows.find((row) => row.organization_id)?.organization_id;
  let organization = profile?.org_id
    ? {
        id: profile.org_id,
        slug: profile.org_slug,
        name: profile.org_name,
        country: profile.org_country,
        defaultLanguage: profile.default_language,
        timezone: profile.timezone,
      }
    : null;

  if (!organization && roleOrg) {
    const orgResult = await query(
      `
        SELECT id::text, slug, name, country, default_language, timezone
        FROM public.organizations
        WHERE id = $1
        LIMIT 1
      `,
      [roleOrg],
    );
    const row = orgResult.rows[0];
    if (row) {
      organization = {
        id: row.id,
        slug: row.slug,
        name: row.name,
        country: row.country,
        defaultLanguage: row.default_language,
        timezone: row.timezone,
      };
    }
  }

  if (!organization) {
    const defaultOrg = await defaultOrganization();
    organization = {
      id: defaultOrg?.id || null,
      slug: defaultOrg?.slug || null,
      name: defaultOrg?.name || null,
      country: defaultOrg?.country || null,
      defaultLanguage: defaultOrg?.default_language || "de",
      timezone: defaultOrg?.timezone || "Europe/Berlin",
    };
  }

  return {
    userId: user.id,
    email,
    fullName: profile?.full_name || null,
    roles: isPlatformAdmin && !roles.includes("admin") ? ["admin", ...roles] : roles,
    role: primaryRole,
    isAdmin: roles.includes("admin") || isPlatformAdmin,
    isPlatformAdmin,
    organizationId: organization.id,
    organization,
  };
}

async function applyOrganizationOverride(req, context) {
  const overrideId = req.get("x-organization-id") || req.query.organization_id;
  if (!overrideId) return context;
  if (overrideId === context?.organizationId || overrideId === context?.organization?.slug) return context;
  if (!context?.isPlatformAdmin) throw httpError(403, "Platform admin access required");
  const organization = await loadOrganizationById(overrideId);
  if (!organization?.id || !organization.active) throw httpError(404, "Organization not found");
  return {
    ...context,
    organizationId: organization.id,
    organization,
  };
}

async function resolveRequestContext(req, options = {}) {
  if (options.auth === "none") return null;

  const authorization = req.get("authorization") || "";
  const token = authorization.toLowerCase().startsWith("bearer ") ? authorization.slice(7).trim() : null;

  if (!token) {
    if (!apiAuthBypass) throw httpError(401, "Authentication required");
    const org = await defaultOrganization();
    return applyOrganizationOverride(req, {
      userId: "preview",
      email: null,
      roles: ["admin"],
      role: "admin",
      isAdmin: true,
      isPlatformAdmin: true,
      organizationId: org?.id || null,
      organization: {
        id: org?.id || null,
        slug: org?.slug || "red-cross-leipzig",
        name: org?.name || "Red Cross Leipzig",
        country: org?.country || "Germany",
        defaultLanguage: org?.default_language || "de",
        timezone: org?.timezone || "Europe/Berlin",
      },
      authToken: null,
    });
  }

  const user = await verifySupabaseToken(token);
  if (!user?.id) {
    const devProjectAdminContext = await devProjectAdminContextFromInvalidToken(token);
    if (devProjectAdminContext) return applyOrganizationOverride(req, devProjectAdminContext);
    throw httpError(401, "Invalid session");
  }
  const context = await loadUserContext(user);
  return applyOrganizationOverride(req, { ...context, authToken: token });
}

function normalizedEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

function loginEmailLanguage(value) {
  const language = String(value || "").trim().toLowerCase();
  if (language.startsWith("de")) return "de";
  if (language.startsWith("es")) return "es";
  return "en";
}

function loginRedirectPath(value) {
  const pathValue = String(value || "/").trim();
  if (!pathValue.startsWith("/") || pathValue.startsWith("//")) return "/";
  return pathValue;
}

function isMagicLinkRateLimitError(value) {
  const message = String(value || "").toLowerCase();
  return (
    message.includes("rate") ||
    message.includes("too many") ||
    message.includes("security purposes") ||
    message.includes("after 60 seconds") ||
    message.includes("after 1 minute")
  );
}

async function consoleLoginAccess(email) {
  const normalized = normalizedEmail(email);
  if (!normalized) return { allowed: false, language: "en" };
  const isConfiguredPlatformAdmin = platformAdminEmails().includes(normalized);

  const rows = await optionalRows(
    `
      SELECT
        p.user_id,
        p.is_platform_admin,
        COALESCE(MAX(profile_org.default_language), MAX(role_org.default_language)) AS default_language,
        COUNT(r.user_id) FILTER (WHERE r.role IS NOT NULL) AS role_count
      FROM public.profiles p
      LEFT JOIN public.user_roles r ON r.user_id = p.user_id
      LEFT JOIN public.organizations profile_org ON profile_org.id = p.organization_id
      LEFT JOIN public.organizations role_org ON role_org.id = r.organization_id
      WHERE LOWER(p.email) = LOWER($1)
      GROUP BY p.user_id, p.is_platform_admin
      LIMIT 1
    `,
    [normalized],
  );
  const row = rows[0];
  const allowed = isConfiguredPlatformAdmin || Boolean(row?.is_platform_admin) || Number(row?.role_count || 0) > 0;
  return {
    allowed,
    language: loginEmailLanguage(row?.default_language || (isConfiguredPlatformAdmin ? "en" : null)),
  };
}

async function sendConsoleMagicLink({ email, redirectPath, language, origin }) {
  const redirectUrl = absoluteAppUrl(loginRedirectPath(redirectPath), origin);
  const manualUrl = userManualUrl(origin);
  const generatedLink = await generateSupabaseTeamMagicLink({
    email,
    redirectUrl,
    metadata: {
      language,
      email_language: language,
      login_source: "vyva_console",
      manual_url: manualUrl,
    },
  });
  if (generatedLink.error) {
    const fallback = await sendHostedConsoleMagicLink({ email, redirectPath, language, origin });
    if (fallback.sent) {
      console.warn("Custom console magic-link generation failed; sent hosted Supabase magic link instead.", {
        email,
        error: generatedLink.error,
      });
      return fallback;
    }
    return {
      sent: false,
      error: fallback.error ? `${generatedLink.error}; fallback failed: ${fallback.error}` : generatedLink.error,
      provider: fallback.provider || null,
    };
  }

  const rendered = renderConsoleMagicLinkEmail({
    actionLink: generatedLink.actionLink,
    language,
    manualUrl,
  });
  const custom = await sendRenderedTeamInviteEmail({ to: email, rendered });
  if (custom.sent) return custom;

  const fallback = await sendHostedConsoleMagicLink({ email, redirectPath, language, origin });
  if (fallback.sent) {
    console.warn("Custom console magic-link email failed; sent hosted Supabase magic link instead.", {
      email,
      provider: custom.provider,
      error: custom.error,
    });
    return fallback;
  }

  return {
    sent: false,
    error: fallback.error ? `${custom.error || "Custom email could not be sent"}; fallback failed: ${fallback.error}` : custom.error,
    provider: custom.provider || fallback.provider || null,
  };
}

async function sendHostedConsoleMagicLink({ email, redirectPath, language, origin }) {
  const supabase = supabaseHostedMagicLinkClient();
  if (!supabase) return { sent: false, error: "Hosted magic-link email is not configured", provider: "supabase" };

  const redirectUrl = absoluteAppUrl(loginRedirectPath(redirectPath), origin);
  const manualUrl = userManualUrl(origin);
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: redirectUrl || undefined,
      shouldCreateUser: true,
      data: {
        language,
        email_language: language,
        login_source: "vyva_console",
        manual_url: manualUrl,
      },
    },
  });

  if (error) return { sent: false, error: error.message || "Hosted magic-link email could not be sent", provider: "supabase" };
  return { sent: true, error: null, provider: "supabase" };
}

function requireAdmin(context) {
  if (!context?.isAdmin) throw httpError(403, "Admin access required");
}

function requireTargetOrganizationAdmin(context, organizationId) {
  requireAdmin(context);
  if (!context?.isPlatformAdmin && String(organizationId || "") !== String(context?.organizationId || "")) {
    throw httpError(403, "Organization admin access required");
  }
}

function requireCampaignDraftAccess(context, status = "draft") {
  if (!context?.userId) throw httpError(401, "Authentication required");
  if (String(status || "draft") !== "draft") requireAdmin(context);
}

function requirePlatformAdmin(context) {
  if (!context?.isPlatformAdmin) throw httpError(403, "Platform admin access required");
}

function scopeOrganizationId(context) {
  if (!context?.organizationId) throw httpError(403, "Organization access required");
  return context.organizationId;
}

function publicContext(context) {
  return {
    userId: context?.userId || null,
    email: context?.email || null,
    role: context?.role || "operator",
    roles: context?.roles || [],
    isAdmin: Boolean(context?.isAdmin),
    isPlatformAdmin: Boolean(context?.isPlatformAdmin),
    organization: context?.organization || null,
  };
}

function teamMemberRow(row) {
  return {
    id: row.id,
    user_id: row.user_id,
    role: row.role,
    organization_id: row.organization_id,
    status: String(row.user_id || "").startsWith("pending:") ? "pending" : "active",
    profiles: {
      full_name: row.full_name || null,
      email: row.email || null,
    },
    created_at: row.created_at || null,
  };
}

function organizationRow(row) {
  return row
    ? {
        id: row.id,
        slug: row.slug,
        name: row.name,
        country: row.country,
        defaultLanguage: row.default_language,
        timezone: row.timezone,
        active: Boolean(row.active),
        createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
        updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
      }
    : null;
}

function normalizeOrganizationPayload(payload = {}, creating = false) {
  const name = nullIfBlank(payload.name);
  const slug = nullIfBlank(payload.slug)?.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "");
  const defaultLanguage = nullIfBlank(firstValue(payload.defaultLanguage, payload.default_language)) || (creating ? "de" : null);
  const timezone = nullIfBlank(payload.timezone) || (creating ? (defaultLanguage === "es" ? "Europe/Madrid" : "Europe/Berlin") : null);
  const active = optionalBooleanValue(payload.active);
  if (creating && !name) return { error: "name is required" };
  if (creating && !slug) return { error: "slug is required" };
  if (defaultLanguage && !["en", "de", "es"].includes(defaultLanguage)) return { error: "default_language must be en, de, or es" };
  return {
    value: {
      name,
      slug,
      country: nullIfBlank(payload.country),
      default_language: defaultLanguage,
      timezone,
      active: active ?? (creating ? true : null),
    },
  };
}

async function resolveOrganizationFromRegistration(registration) {
  const id = nullIfBlank(firstValue(registration.organization_id, registration.organizationId, registration.org_id, registration.orgId));
  const slug = normalizeOrganizationSlug(firstValue(
    registration.organization_slug,
    registration.organizationSlug,
    registration.org_slug,
    registration.orgSlug,
    registration.branch_slug,
    registration.branchSlug,
    registration.branch,
    registration.org,
  ));
  const name = nullIfBlank(firstValue(registration.organization_name, registration.organizationName));
  const country = nullIfBlank(registration.country)?.toLowerCase();
  const hasExplicitOrganization = Boolean(id || slug || name);

  if (id) {
    const result = await query(
      "SELECT id::text, slug, name, country, default_language, timezone, active FROM public.organizations WHERE id = $1 AND active = true LIMIT 1",
      [id],
    );
    if (result.rows[0]) return result.rows[0];
    return null;
  }

  const inferredSlug =
    slug ||
    (["es", "esp"].includes(country || "") || country?.includes("spain") || country?.includes("espa") ? "red-cross-zamora" : null) ||
    (["de", "deu"].includes(country || "") || country?.includes("germany") || country?.includes("deutsch") ? "red-cross-leipzig" : null) ||
    inferOrganizationSlugFromPhone(registration.phone);
  if (inferredSlug) {
    const result = await query(
      "SELECT id::text, slug, name, country, default_language, timezone, active FROM public.organizations WHERE slug = $1 AND active = true LIMIT 1",
      [inferredSlug],
    );
    if (result.rows[0]) return result.rows[0];
    if (hasExplicitOrganization) return null;
  }

  if (name) {
    const result = await query(
      "SELECT id::text, slug, name, country, default_language, timezone, active FROM public.organizations WHERE LOWER(name) = LOWER($1) AND active = true LIMIT 1",
      [name],
    );
    if (result.rows[0]) return result.rows[0];
    return null;
  }

  const activeOrgs = await query("SELECT COUNT(*)::int AS count FROM public.organizations WHERE active = true");
  if (Number(activeOrgs.rows[0]?.count || 0) > 1) return null;

  return defaultOrganization();
}

function normalizeOrganizationSlug(value) {
  const text = nullIfBlank(value)?.toLowerCase();
  if (!text) return null;
  if (text.includes("zamora") || text.includes("spain") || text.includes("espana") || text.includes("españa")) return "red-cross-zamora";
  if (text.includes("leipzig") || text.includes("germany") || text.includes("deutsch")) return "red-cross-leipzig";
  return text.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

async function userBelongsToOrganization(userId, context, client = { query }) {
  const organizationId = scopeOrganizationId(context);
  const result = await client.query(
    "SELECT id::text FROM public.vyva_users WHERE id = $1 AND organization_id = $2 LIMIT 1",
    [userId, organizationId],
  );
  return Boolean(result.rows[0]);
}

async function resolveContextFieldStaffIds(context, client = { query }) {
  if (!context?.organizationId || !context?.fullName) return [];
  if (Array.isArray(context.fieldStaffIds)) return context.fieldStaffIds;

  const result = await client.query(
    `
      SELECT id::text
      FROM public.field_staff
      WHERE organization_id = $1
        AND active = true
        AND LOWER(full_name) = LOWER($2)
    `,
    [context.organizationId, context.fullName],
  );

  const ids = result.rows.map((row) => row.id);
  context.fieldStaffIds = ids;
  return ids;
}

async function loadCheckinAccessMap(userIds, context, client = { query }) {
  if (!context?.organizationId) return new Map();

  const ids = Array.from(new Set((userIds || []).map((value) => String(value || "").trim()).filter(Boolean)));
  const uuidIds = ids.filter(isUuid);
  if (!uuidIds.length) return new Map();

  const fieldStaffIds = context.isAdmin ? [] : await resolveContextFieldStaffIds(context, client);
  const result = await client.query(
    `
      SELECT
        u.id::text AS user_id,
        COALESCE(consent.consent_given, false) AS consent_given,
        MAX(fs.full_name) FILTER (WHERE a.provider_type = 'field_staff' AND a.is_primary = true) AS primary_professional_name,
        BOOL_OR(
          a.provider_type = 'field_staff'
          AND a.is_primary = true
          AND a.field_staff_id IS NOT NULL
          AND a.field_staff_id = ANY($3::uuid[])
        ) AS assigned_to_current_provider
      FROM public.vyva_users u
      LEFT JOIN public.vyva_user_consent consent ON consent.vyva_user_id = u.id
      LEFT JOIN public.vyva_user_care_provider_assignments a ON a.vyva_user_id = u.id
      LEFT JOIN public.field_staff fs ON fs.id = a.field_staff_id
      WHERE u.organization_id = $1
        AND u.id = ANY($2::uuid[])
      GROUP BY u.id, consent.consent_given
    `,
    [context.organizationId, uuidIds, fieldStaffIds],
  );

  const map = new Map();
  for (const row of result.rows) {
    const consentGiven = Boolean(row.consent_given);
    const assignedToCurrentProvider = Boolean(row.assigned_to_current_provider);
    const canEdit = consentGiven && (Boolean(context.isAdmin) || assignedToCurrentProvider);
    map.set(String(row.user_id), {
      consent_given: consentGiven,
      assigned_to_current_provider: assignedToCurrentProvider,
      assigned_provider_name: row.primary_professional_name || null,
      can_edit: canEdit,
      edit_block_reason: !consentGiven
        ? "consent_required"
        : canEdit
          ? null
          : "assigned_provider_required",
    });
  }

  return map;
}

async function requireCheckinScheduleAccess(userId, context, client = { query }) {
  if (!(await userBelongsToOrganization(userId, context, client))) throw httpError(404, "User not found");

  const access = (await loadCheckinAccessMap([userId], context, client)).get(String(userId));
  if (!access?.consent_given) throw httpError(403, "Client consent required");
  if (!access.can_edit) throw httpError(403, "Assigned provider or admin access required");
  return access;
}

async function loadCarePlanAccessMap(userIds, context, client = { query }) {
  if (!context?.organizationId) return new Map();

  const ids = Array.from(new Set((userIds || []).map((value) => String(value || "").trim()).filter(Boolean)));
  const uuidIds = ids.filter(isUuid);
  if (!uuidIds.length) return new Map();

  const fieldStaffIds = context.isAdmin ? [] : await resolveContextFieldStaffIds(context, client);
  const result = await client.query(
    `
      SELECT
        u.id::text AS user_id,
        COALESCE(consent.consent_given, false) AS consent_given,
        MAX(fs.full_name) FILTER (WHERE a.provider_type = 'field_staff' AND a.is_primary = true) AS primary_professional_name,
        BOOL_OR(
          a.provider_type = 'field_staff'
          AND a.is_primary = true
          AND a.field_staff_id IS NOT NULL
          AND a.field_staff_id = ANY($3::uuid[])
        ) AS primary_staff_is_current_user
      FROM public.vyva_users u
      LEFT JOIN public.vyva_user_consent consent ON consent.vyva_user_id = u.id
      LEFT JOIN public.vyva_user_care_provider_assignments a ON a.vyva_user_id = u.id
      LEFT JOIN public.field_staff fs ON fs.id = a.field_staff_id
      WHERE u.organization_id = $1
        AND u.id = ANY($2::uuid[])
      GROUP BY u.id, consent.consent_given
    `,
    [context.organizationId, uuidIds, fieldStaffIds],
  );

  const map = new Map();
  for (const row of result.rows) {
    const consentGiven = Boolean(row.consent_given);
    const canEditCarePlan = Boolean(context.isAdmin) || Boolean(row.primary_staff_is_current_user);
    map.set(String(row.user_id), {
      assigned_provider_name: row.primary_professional_name || null,
      can_edit_care_plan: canEditCarePlan,
      can_edit_medications: canEditCarePlan,
      can_edit_checkins: consentGiven && canEditCarePlan,
      can_edit_brain_coach: consentGiven && canEditCarePlan,
      consent_given: consentGiven,
      edit_block_reason: !canEditCarePlan
        ? "assigned_provider_required"
        : !consentGiven
          ? "consent_required"
          : null,
    });
  }

  return map;
}

async function requireCarePlanAccess(userId, context, client = { query }) {
  if (!(await userBelongsToOrganization(userId, context, client))) throw httpError(404, "User not found");

  const access = (await loadCarePlanAccessMap([userId], context, client)).get(String(userId));
  if (!access?.can_edit_care_plan) throw httpError(403, "Assigned primary Red Cross staff or admin access required");
  return access;
}

function authUserIdFromInviteResponse(body) {
  return String(
    body?.id ||
    body?.user_id ||
    body?.userId ||
    body?.user?.id ||
    body?.data?.user?.id ||
    "",
  );
}

function pendingTeamUserId(email) {
  return `pending:${String(email || "").toLowerCase()}`;
}

async function createSupabaseAuthUserWithServiceRole({ email, password, role, organizationId, metadata = {} }) {
  const response = await fetch(`${supabaseBaseUrl}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      apikey: supabaseServiceRoleKey,
      Authorization: `Bearer ${supabaseServiceRoleKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        invited_role: role,
        organization_id: organizationId,
        ...metadata,
      },
    }),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = String(body?.msg || body?.message || "Team member could not be created");
    throw httpError(response.status === 422 ? 409 : response.status, message);
  }
  return body;
}

async function createSupabaseAuthUserWithInviteFunction({ email, password, role, organizationId, authToken, metadata = {} }) {
  if (!supabaseInviteAdminFunctionUrl || !supabaseAnonKey || !authToken) {
    throw httpError(503, "Team invite service is not configured", true);
  }

  const response = await fetch(supabaseInviteAdminFunctionUrl, {
    method: "POST",
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${authToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      password,
      role,
      organization_id: organizationId,
      invite_metadata: metadata,
    }),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = String(body?.error || body?.message || "Team member could not be created");
    throw httpError(response.status === 422 ? 409 : response.status, message, response.status < 500);
  }

  const userId = authUserIdFromInviteResponse(body);
  return userId ? { ...body, id: userId, user: { ...(body.user || {}), id: userId } } : body;
}

async function createSupabaseAuthUser({ email, password, role, organizationId, authToken, metadata = {} }) {
  if (supabaseBaseUrl && supabaseServiceRoleKey) {
    return createSupabaseAuthUserWithServiceRole({ email, password, role, organizationId, metadata });
  }
  return createSupabaseAuthUserWithInviteFunction({ email, password, role, organizationId, authToken, metadata });
}

async function loadTeamMembers(context) {
  const organizationId = scopeOrganizationId(context);
  const result = await query(
    `
      SELECT
        r.id::text,
        r.user_id,
        r.organization_id::text,
        CASE WHEN r.role::text = 'admin' THEN 'admin' ELSE 'operator' END AS role,
        p.full_name,
        p.email,
        p.created_at
      FROM public.user_roles r
      LEFT JOIN public.profiles p ON p.user_id = r.user_id
      WHERE r.organization_id = $1
      ORDER BY
        CASE r.role WHEN 'admin' THEN 0 ELSE 1 END,
        COALESCE(p.email, r.user_id) ASC
    `,
    [organizationId],
  );
  return result.rows.map(teamMemberRow);
}

function normalizeTeamMemberPayload(payload = {}) {
  const email = nullIfBlank(payload.email)?.toLowerCase();
  const password = nullIfBlank(payload.password);
  const role = nullIfBlank(payload.role) || "operator";
  const fullName = nullIfBlank(firstValue(payload.full_name, payload.fullName, payload.name));
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "email is required" };
  if (password && password.length < 6) return { error: "password must be at least 6 characters" };
  if (!["admin", "operator"].includes(role)) return { error: "role is invalid" };
  return { value: { email, password, role, fullName } };
}

function teamInviteAuthConfigured(authToken) {
  return Boolean((supabaseBaseUrl && supabaseServiceRoleKey) || (supabaseInviteAdminFunctionUrl && supabaseAnonKey && authToken));
}

async function createTeamMember(payload, context, options = {}) {
  requireAdmin(context);
  const organizationId = scopeOrganizationId(context);
  const member = normalizeTeamMemberPayload(payload);
  if (member.error) return member;

  const organization = context?.organization?.id === organizationId
    ? context.organization
    : await loadOrganizationById(organizationId);
  const invite = teamInviteMetadata({
    context,
    role: member.value.role,
    organization,
    origin: options.origin,
  });

  let userId = pendingTeamUserId(member.value.email);
  let inviteMode = "magic_link_pending";
  let inviteLink = null;
  let inviteEmailError = inviteEmailConfigurationError();

  if (!inviteEmailError) {
    const generatedLink = await generateSupabaseTeamMagicLink({
      email: member.value.email,
      metadata: invite.metadata,
      redirectUrl: invite.redirectUrl,
    });
    if (generatedLink.actionLink) {
      inviteLink = generatedLink;
      userId = generatedLink.userId || userId;
    } else {
      inviteEmailError = generatedLink.error || "Invite link could not be generated";
    }
  }

  if (!inviteLink && member.value.password && teamInviteAuthConfigured(context.authToken)) {
    try {
      const authUser = await createSupabaseAuthUser({
        email: member.value.email,
        password: member.value.password,
        role: member.value.role,
        organizationId,
        authToken: context.authToken,
        metadata: invite.metadata,
      });
      userId = authUserIdFromInviteResponse(authUser) || userId;
      inviteMode = "password";
    } catch (error) {
      console.warn("Team auth invite unavailable; created a pending magic-link team member instead.", {
        status: error.status || null,
      });
    }
  }
  if (!userId) throw httpError(502, "Team member auth record was not returned");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `
        INSERT INTO public.profiles (user_id, organization_id, full_name, email)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (user_id) DO UPDATE SET
          organization_id = EXCLUDED.organization_id,
          full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
          email = EXCLUDED.email,
          updated_at = now()
      `,
      [userId, organizationId, member.value.fullName, member.value.email],
    );
    await client.query(
      `
        INSERT INTO public.user_roles (user_id, organization_id, role)
        VALUES ($1, $2, $3::public.app_role)
        ON CONFLICT (user_id, role) DO UPDATE SET organization_id = EXCLUDED.organization_id
      `,
      [userId, organizationId, member.value.role],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  let inviteEmail = {
    sent: false,
    error: inviteEmailError,
    provider: inviteEmailProvider(),
  };

  if (inviteLink?.actionLink) {
    const rendered = renderTeamInviteEmail({ actionLink: inviteLink.actionLink, invite });
    inviteEmail = await sendRenderedTeamInviteEmail({
      to: member.value.email,
      rendered,
    }).catch((error) => ({
      sent: false,
      error: error?.message || "Invite email could not be sent",
      provider: inviteEmailProvider(),
    }));
  }

  if (inviteEmail.sent) {
    inviteMode = "magic_link_sent";
  } else {
    console.warn("Team magic-link invite email was not sent.", {
      error: inviteEmail.error,
      email: member.value.email,
    });
    if (inviteMode === "magic_link_pending") inviteMode = "magic_link_unavailable";
  }

  const members = await loadTeamMembers(context);
  const responseInviteEmailError = inviteEmail.sent ? null : inviteMode === "password" ? null : inviteEmail.error;
  return {
    inviteMode,
    inviteEmailSent: Boolean(inviteEmail.sent),
    inviteEmailError: responseInviteEmailError,
    guideUrl: invite.guideUrl,
    value: members.find((item) => item.user_id === userId && item.role === member.value.role) || null,
  };
}

async function initializeDatabase() {
  if (!pool) return;
  const schema = fs.readFileSync(schemaPath, "utf8");
  await pool.query(schema);
  console.log("Database schema is ready.");
}

function asyncRoute(handler, options = {}) {
  return async (req, res, next) => {
    try {
      if (!pool) {
        dbUnavailable(res);
        return;
      }
      req.context = await resolveRequestContext(req, options);
      await handler(req, res);
    } catch (error) {
      next(error);
    }
  };
}

function dashboardUser(row) {
  const activeAlerts = Number(row.active_alerts || 0);
  const criticalAlerts = Number(row.critical_alerts || 0);
  const sensorCount = Number(row.sensor_count || 0);
  const offlineSensors = Number(row.offline_sensors || 0);
  const healthConditions = Number(row.health_conditions || 0);
  const missedMeds7d = Number(row.missed_meds_7d || 0);
  const checkinEnabled = Boolean(row.checkin_enabled);
  const riskScore = Math.min(
    100,
    criticalAlerts * 30 +
      activeAlerts * 12 +
      offlineSensors * 8 +
      missedMeds7d * 10 +
      healthConditions * 4 +
      (checkinEnabled ? 0 : 4),
  );

  return {
    id: String(row.id),
    first_name: row.first_name,
    last_name: row.last_name,
    city: row.city,
    phone: row.phone,
    date_of_birth: row.date_of_birth,
    coords: row.latitude != null && row.longitude != null ? [Number(row.latitude), Number(row.longitude)] : null,
    activeAlerts,
    criticalAlerts,
    sensorCount,
    offlineSensors,
    checkinEnabled,
    checkinFrequency: row.checkin_frequency || null,
    checkinPreferredTime: row.checkin_preferred_time || null,
    checkinLastStatus: row.checkin_last_status || null,
    checkinLastReportedAt: row.checkin_last_reported_at || null,
    healthConditions,
    missedMeds7d,
    riskScore,
    careProviderCount: Number(row.care_provider_count || 0),
    primaryCaregiverName: row.primary_caregiver_name || null,
    primaryProfessionalName: row.primary_professional_name || null,
    careProviderNames: Array.isArray(row.care_provider_names) ? row.care_provider_names : [],
  };
}

async function loadDashboardUsers(context) {
  const organizationId = scopeOrganizationId(context);
  const users = await query(`
    WITH sensor_counts AS (
      SELECT
        vyva_user_id,
        COUNT(*)::int AS sensor_count,
        COUNT(*) FILTER (WHERE status = 'offline')::int AS offline_sensors
      FROM public.vyva_user_sensors
      GROUP BY vyva_user_id
    ),
    alert_counts AS (
      SELECT
        vyva_user_id,
        COUNT(*) FILTER (WHERE resolved_at IS NULL)::int AS active_alerts,
        COUNT(*) FILTER (WHERE resolved_at IS NULL AND severity = 'critical')::int AS critical_alerts
      FROM public.vyva_sensor_alerts
      GROUP BY vyva_user_id
    ),
    health_counts AS (
      SELECT
        vyva_user_id,
        cardinality(COALESCE(health_conditions, ARRAY[]::text[]))::int AS health_conditions
      FROM public.vyva_user_health
    ),
    missed_med_counts AS (
      SELECT
        vyva_user_id,
        COUNT(*) FILTER (
          WHERE scheduled_date >= CURRENT_DATE - INTERVAL '7 days'
            AND scheduled_date < CURRENT_DATE
            AND status IN ('missed', 'unconfirmed', 'pending')
        )::int AS missed_meds_7d
      FROM public.vyva_medication_logs
      GROUP BY vyva_user_id
    ),
    care_provider_counts AS (
      SELECT
        a.vyva_user_id,
        COUNT(*)::int AS care_provider_count,
        MAX(c.full_name) FILTER (WHERE a.provider_type = 'caregiver' AND a.is_primary = true) AS primary_caregiver_name,
        MAX(fs.full_name) FILTER (WHERE a.provider_type = 'field_staff' AND a.is_primary = true) AS primary_professional_name,
        ARRAY_REMOVE(ARRAY_AGG(DISTINCT COALESCE(c.full_name, fs.full_name)), NULL) AS care_provider_names
      FROM public.vyva_user_care_provider_assignments a
      LEFT JOIN public.care_provider_contacts c ON c.id = a.care_provider_contact_id
      LEFT JOIN public.field_staff fs ON fs.id = a.field_staff_id
      GROUP BY a.vyva_user_id
    )
    SELECT
      u.id::text,
      u.first_name,
      u.last_name,
      u.phone,
      u.city,
      u.date_of_birth::text,
      NULL::double precision AS latitude,
      NULL::double precision AS longitude,
      COALESCE(s.sensor_count, 0) AS sensor_count,
      COALESCE(s.offline_sensors, 0) AS offline_sensors,
      COALESCE(a.active_alerts, 0) AS active_alerts,
      COALESCE(a.critical_alerts, 0) AS critical_alerts,
      COALESCE(h.health_conditions, 0) AS health_conditions,
      COALESCE(m.missed_meds_7d, 0) AS missed_meds_7d,
      COALESCE(c.enabled, false) AS checkin_enabled,
      c.frequency AS checkin_frequency,
      c.preferred_time AS checkin_preferred_time,
      NULL::text AS checkin_last_status,
      NULL::text AS checkin_last_reported_at,
      u.living_context,
      COALESCE(cp.care_provider_count, 0) AS care_provider_count,
      cp.primary_caregiver_name,
      cp.primary_professional_name,
      COALESCE(cp.care_provider_names, ARRAY[]::text[]) AS care_provider_names
    FROM public.vyva_users u
    LEFT JOIN sensor_counts s ON s.vyva_user_id = u.id
    LEFT JOIN alert_counts a ON a.vyva_user_id = u.id
    LEFT JOIN health_counts h ON h.vyva_user_id = u.id
    LEFT JOIN missed_med_counts m ON m.vyva_user_id = u.id
    LEFT JOIN public.vyva_user_checkins c ON c.vyva_user_id = u.id
    LEFT JOIN care_provider_counts cp ON cp.vyva_user_id = u.id
    WHERE u.organization_id = $1
    ORDER BY COALESCE(a.critical_alerts, 0) DESC, COALESCE(a.active_alerts, 0) DESC, u.created_at DESC
  `, [organizationId]);

  const alerts = await optionalRows(`
    SELECT
      a.id::text,
      a.alert_type,
      a.severity,
      a.message,
      a.created_at,
      a.vyva_user_id::text,
      u.first_name || ' ' || u.last_name AS user_name,
      u.city,
      u.phone
    FROM public.vyva_sensor_alerts a
    JOIN public.vyva_users u ON u.id = a.vyva_user_id
    WHERE a.resolved_at IS NULL AND u.organization_id = $1
    ORDER BY
      CASE a.severity WHEN 'critical' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END,
      a.created_at DESC
    LIMIT 50
  `, [organizationId]);

  const cityRows = await query(`
    SELECT COALESCE(NULLIF(city, ''), 'Unknown') AS city, COUNT(*)::int AS count
    FROM public.vyva_users
    WHERE organization_id = $1
    GROUP BY COALESCE(NULLIF(city, ''), 'Unknown')
    ORDER BY count DESC, city ASC
  `, [organizationId]);

  const caregiverRows = await query(
    `
      SELECT COUNT(*)::int AS count
      FROM public.vyva_user_care_provider_assignments a
      JOIN public.vyva_users u ON u.id = a.vyva_user_id
      WHERE u.organization_id = $1
    `,
    [organizationId],
  );
  const checkinRows = await query(
    `
      SELECT COUNT(*)::int AS count
      FROM public.vyva_user_checkins c
      JOIN public.vyva_users u ON u.id = c.vyva_user_id
      WHERE c.enabled = true AND u.organization_id = $1
    `,
    [organizationId],
  );
  const sensorRows = await optionalRows(
    `
      SELECT COUNT(*)::int AS count
      FROM public.vyva_user_sensors s
      JOIN public.vyva_users u ON u.id = s.vyva_user_id
      WHERE u.organization_id = $1
    `,
    [organizationId],
  );

  const gisUsers = users.rows.map(dashboardUser);
  const activeAlertCount = alerts.length;
  const criticalAlertCount = alerts.filter((alert) => alert.severity === "critical").length;

  return {
    totalUsers: gisUsers.length,
    checkinsEnabled: Number(checkinRows.rows[0]?.count || 0),
    activeAlertCount,
    criticalAlertCount,
    totalSensors: Number(sensorRows[0]?.count || 0),
    caregiversLinked: Number(caregiverRows.rows[0]?.count || 0),
    gisUsers,
    activeAlerts: alerts,
    cityDistribution: cityRows.rows,
  };
}

function parseInsightsDays(value) {
  const days = Number(value || 7);
  return [7, 14, 30].includes(days) ? days : 7;
}

function insightRiskBand(score) {
  const numeric = Number(score || 0);
  if (numeric >= 67) return "high";
  if (numeric >= 38) return "moderate";
  return "low";
}

function ageFromDateOfBirth(dateOfBirth) {
  if (!dateOfBirth) return null;
  const birth = new Date(dateOfBirth);
  if (Number.isNaN(birth.getTime())) return null;
  return Math.floor((Date.now() - birth.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
}

function normalizeInsightFactors(value) {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function insightFactorText(factors) {
  return normalizeInsightFactors(factors)
    .map((factor) => `${factor?.signal || ""} ${factor?.label || ""}`.toLowerCase())
    .join(" ");
}

function insightClientMatchesFilter(client, filter) {
  if (!filter || filter === "all") return true;
  const factorText = insightFactorText(client.factors);
  if (filter === "high") return client.band === "high";
  if (filter === "mood") return factorText.includes("mood");
  if (filter === "medication") return factorText.includes("medication") || factorText.includes("meds");
  if (filter === "noresponse") return factorText.includes("response") || factorText.includes("missed calls");
  if (filter === "unassigned") return !client.operator;
  return true;
}

function forecastWindowText(client) {
  const forecast = client.forecast?.mid || [];
  const currentScore = Number(client.score || 0);
  const currentBand = insightRiskBand(currentScore);
  const highIndex = forecast.findIndex((score) => insightRiskBand(score) === "high");
  const factorText = insightFactorText(client.factors);

  if (!client.operator) return "Needs an assigned operator before risk peaks";
  if (currentBand !== "high" && highIndex >= 0) {
    const horizonDay = highIndex + 1;
    return `Risk likely to peak in ${Math.max(1, horizonDay - 2)}-${horizonDay} days`;
  }
  if (currentBand === "high" && Number(client.delta || 0) > 0) {
    return factorText.includes("response")
      ? "Escalation likely if unreached this week"
      : "High risk is still rising";
  }
  if (Number(client.delta || 0) < 0) return "Improving - keep current cadence";
  return "Stable - no action needed";
}

function insightOperatorRow(row) {
  return {
    id: row.operator_id,
    name: row.name,
    current: Number(row.current_caseload || 0),
    capacity: Number(row.capacity_hours || 0),
    recommended: Number(row.recommended_caseload || 0),
  };
}

async function loadInsightOperatorRows(organizationId, operatorIds = []) {
  const idFilter = operatorIds.length ? operatorIds : null;
  const rows = await optionalRows(
    `
      WITH latest_week AS (
        SELECT MAX(week_start) AS week_start
        FROM public.operator_capacity_weekly
        WHERE organization_id = $1
      )
      SELECT
        ocw.operator_id::text,
        fs.full_name AS name,
        ocw.capacity_hours,
        ocw.current_caseload,
        ocw.recommended_caseload
      FROM public.operator_capacity_weekly ocw
      JOIN latest_week lw ON lw.week_start = ocw.week_start
      JOIN public.field_staff fs ON fs.id = ocw.operator_id
      WHERE ocw.organization_id = $1
        AND ($2::uuid[] IS NULL OR ocw.operator_id = ANY($2::uuid[]))
      ORDER BY fs.full_name ASC
    `,
    [organizationId, idFilter],
  );
  return rows.map(insightOperatorRow);
}

async function refreshOperatorCaseloadsWithClient(client, operatorIds, organizationId) {
  const ids = Array.from(new Set(operatorIds.filter(Boolean)));
  if (!ids.length) return [];

  const weekResult = await client.query(
    `
      SELECT MAX(week_start) AS week_start
      FROM public.operator_capacity_weekly
      WHERE organization_id = $1
    `,
    [organizationId],
  );
  const weekStart = weekResult.rows[0]?.week_start ? formatDate(weekResult.rows[0].week_start) : mondayOfWeek(formatDate(new Date()));

  await client.query(
    `
      WITH current_counts AS (
        SELECT
          a.field_staff_id,
          COUNT(*)::int AS current_caseload
        FROM public.vyva_user_care_provider_assignments a
        JOIN public.vyva_users u ON u.id = a.vyva_user_id
        WHERE a.provider_type = 'field_staff'
          AND a.is_primary = true
          AND u.organization_id = $2
          AND a.field_staff_id = ANY($1::uuid[])
        GROUP BY a.field_staff_id
      )
      UPDATE public.operator_capacity_weekly ocw
      SET current_caseload = COALESCE(cc.current_caseload, 0), updated_at = now()
      FROM unnest($1::uuid[]) AS operator_ids(operator_id)
      LEFT JOIN current_counts cc ON cc.field_staff_id = operator_ids.operator_id
      WHERE ocw.operator_id = operator_ids.operator_id
        AND ocw.organization_id = $2
        AND ocw.week_start = $3::date
    `,
    [ids, organizationId, weekStart],
  );

  return loadInsightOperatorRows(organizationId, ids);
}

function mondayOfWeek(dateText) {
  const date = new Date(`${dateText}T00:00:00Z`);
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - day + 1);
  return formatDate(date);
}

function campaignTone(type, status) {
  if (type === "medication") return "purple";
  if (type === "wellbeing") return "green";
  if (type === "service") return "red";
  if (status === "active") return "orange";
  return "purple";
}

function targetRiskStatus(user) {
  if (Number(user.criticalAlerts || 0) > 0 || Number(user.riskScore || 0) >= 80) return "urgent";
  if (
    Number(user.activeAlerts || 0) > 0 ||
    Number(user.missedMeds7d || 0) > 0 ||
    Number(user.offlineSensors || 0) > 0 ||
    !user.checkinEnabled
  ) {
    return "review";
  }
  return "stable";
}

const CAMPAIGN_TEMPLATE_KEYS = [
  "general_announcement",
  "heatwave_alert",
  "medication_reminder",
  "wellbeing_check",
  "service_update",
  "custom_campaign",
];

function isCampaignTemplateKey(value) {
  return CAMPAIGN_TEMPLATE_KEYS.includes(String(value || ""));
}

function defaultTemplateKeyForType(type) {
  if (type === "medication") return "medication_reminder";
  if (type === "wellbeing") return "wellbeing_check";
  if (type === "service") return "service_update";
  return "general_announcement";
}

function campaignTemplateType(templateKey) {
  if (templateKey === "medication_reminder") return "medication";
  if (templateKey === "wellbeing_check") return "wellbeing";
  if (templateKey === "service_update") return "service";
  return "safety";
}

function resolveCampaignTemplateKey(rowOrPayload) {
  const templateKey = String(rowOrPayload?.templateKey || rowOrPayload?.template_key || "");
  if (isCampaignTemplateKey(templateKey)) return templateKey;

  const nameText = `${rowOrPayload?.name || ""} ${rowOrPayload?.name_key || ""}`.toLowerCase();
  if (nameText.includes("heatwave") || nameText.includes("calor") || nameText.includes("hitze")) {
    return "heatwave_alert";
  }

  return defaultTemplateKeyForType(String(rowOrPayload?.type || "safety"));
}

function defaultCampaignTargetRules(city = "") {
  const cleanCity = nullIfBlank(city) || "";
  return {
    geo: {
      scope: cleanCity ? "city" : "organization",
      value: cleanCity,
    },
    riskLevel: "all",
    healthConditions: [],
    careProvider: {
      mode: "all",
      providerId: "",
      providerName: "",
      providerType: "",
    },
    requireConsent: true,
    requirePhone: true,
    audienceSource: {
      mode: "existing",
      uploadedList: {
        fileName: "",
        rawRowCount: 0,
        matchedPhones: [],
        emails: [],
        unmatchedRows: 0,
      },
    },
    channels: ["voice"],
    schedule: {
      frequency: "once",
      scheduledAt: null,
    },
  };
}

function normalizeCampaignChannelList(value) {
  if (!Array.isArray(value)) return ["voice"];
  const allowed = new Set(["voice", "whatsapp", "email", "sms"]);
  const channels = Array.from(new Set(value.map((item) => String(item)).filter((item) => allowed.has(item))));
  return channels.length ? channels : ["voice"];
}

function normalizeCampaignScheduleFrequency(value) {
  const text = String(value || "");
  return ["once", "daily", "weekly", "monthly"].includes(text) ? text : "once";
}

function normalizeCampaignAudienceMode(value) {
  const text = String(value || "");
  return ["existing", "criteria", "upload"].includes(text) ? text : "existing";
}

function normalizeCampaignUploadedAudience(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      fileName: "",
      rawRowCount: 0,
      matchedPhones: [],
      emails: [],
      unmatchedRows: 0,
    };
  }
  return {
    fileName: nullIfBlank(value.fileName) || "",
    rawRowCount: Number.isFinite(Number(value.rawRowCount)) ? Number(value.rawRowCount) : 0,
    matchedPhones: Array.isArray(value.matchedPhones) ? value.matchedPhones.map((item) => String(item)).filter(Boolean) : [],
    emails: Array.isArray(value.emails) ? value.emails.map((item) => String(item).trim()).filter(Boolean) : [],
    unmatchedRows: Number.isFinite(Number(value.unmatchedRows)) ? Number(value.unmatchedRows) : 0,
  };
}

function normalizeCampaignPhoneIdentifier(value) {
  return String(value || "").replace(/[^\d+]/g, "").replace(/(?!^)\+/g, "");
}

function campaignPhoneIdentifiersMatch(uploadedPhone, userPhone) {
  const uploaded = normalizeCampaignPhoneIdentifier(uploadedPhone).replace(/^\+/, "");
  const user = normalizeCampaignPhoneIdentifier(userPhone).replace(/^\+/, "");
  if (!uploaded || !user) return false;
  return uploaded === user || uploaded.endsWith(user) || user.endsWith(uploaded);
}

function normalizeCampaignTargetRules(value, city = "") {
  let source = value;
  if (typeof source === "string" && source.trim()) {
    try {
      source = JSON.parse(source);
    } catch {
      source = null;
    }
  }
  const fallback = defaultCampaignTargetRules(city);
  if (!source || typeof source !== "object" || Array.isArray(source)) return fallback;
  const geo = source.geo && typeof source.geo === "object" ? source.geo : {};
  const careProvider = source.careProvider && typeof source.careProvider === "object" ? source.careProvider : {};
  const audienceSource = source.audienceSource && typeof source.audienceSource === "object" ? source.audienceSource : {};
  const schedule = source.schedule && typeof source.schedule === "object" ? source.schedule : {};
  const geoScope = ["organization", "country", "city", "area"].includes(String(geo.scope)) ? String(geo.scope) : fallback.geo.scope;
  const providerMode = ["all", "unassigned", "assigned"].includes(String(careProvider.mode)) ? String(careProvider.mode) : "all";
  const providerType = ["caregiver", "field_staff"].includes(String(careProvider.providerType)) ? String(careProvider.providerType) : "";
  return {
    geo: {
      scope: geoScope,
      value: nullIfBlank(geo.value) || "",
    },
    riskLevel: ["all", "stable", "review", "urgent", "high"].includes(String(source.riskLevel)) ? String(source.riskLevel) : "all",
    healthConditions: Array.isArray(source.healthConditions)
      ? source.healthConditions.map((item) => nullIfBlank(item)).filter(Boolean).slice(0, 12)
      : [],
    careProvider: {
      mode: providerMode,
      providerId: nullIfBlank(careProvider.providerId) || "",
      providerName: nullIfBlank(careProvider.providerName) || "",
      providerType,
    },
    requireConsent: source.requireConsent !== false,
    requirePhone: source.requirePhone !== false,
    audienceSource: {
      mode: normalizeCampaignAudienceMode(audienceSource.mode),
      uploadedList: normalizeCampaignUploadedAudience(audienceSource.uploadedList),
    },
    channels: normalizeCampaignChannelList(source.channels),
    schedule: {
      frequency: normalizeCampaignScheduleFrequency(schedule.frequency),
      scheduledAt: nullIfBlank(schedule.scheduledAt),
    },
  };
}

function campaignTargetRuleSkipReason(rules, user) {
  const geoValue = String(rules.geo?.value || "").trim().toLowerCase();
  const city = String(user.city || "").trim().toLowerCase();
  const country = String(user.country || "").trim().toLowerCase();
  if (rules.geo?.scope === "city" && geoValue && city !== geoValue) return "outside_geo";
  if (rules.geo?.scope === "country" && geoValue && country !== geoValue) return "outside_geo";
  if (rules.geo?.scope === "area" && geoValue && !city.includes(geoValue)) return "outside_geo";
  if (rules.audienceSource?.mode === "upload") {
    const matchedPhones = Array.isArray(rules.audienceSource.uploadedList?.matchedPhones) ? rules.audienceSource.uploadedList.matchedPhones : [];
    if (!matchedPhones.length || !matchedPhones.some((phone) => campaignPhoneIdentifiersMatch(phone, user.phone))) return "outside_geo";
  }

  const riskStatus = targetRiskStatus(user);
  if (rules.riskLevel === "urgent" && riskStatus !== "urgent") return "risk_mismatch";
  if (rules.riskLevel === "review" && riskStatus !== "review") return "risk_mismatch";
  if (rules.riskLevel === "stable" && riskStatus !== "stable") return "risk_mismatch";
  if (rules.riskLevel === "high" && Number(user.riskScore || 0) < 70) return "risk_mismatch";

  const requiredConditions = Array.isArray(rules.healthConditions) ? rules.healthConditions.map((item) => String(item).toLowerCase()) : [];
  if (requiredConditions.length) {
    const userConditions = Array.isArray(user.healthConditionNames) ? user.healthConditionNames.map((item) => String(item).toLowerCase()) : [];
    if (!requiredConditions.some((condition) => userConditions.some((existing) => existing.includes(condition) || condition.includes(existing)))) {
      return "health_condition_mismatch";
    }
  }

  const providerMode = rules.careProvider?.mode || "all";
  if (providerMode === "unassigned" && Number(user.careProviderCount || 0) > 0) return "provider_mismatch";
  if (providerMode === "assigned") {
    const providerId = String(rules.careProvider?.providerId || "");
    const providerName = String(rules.careProvider?.providerName || "").toLowerCase();
    const providerIds = Array.isArray(user.careProviderIds) ? user.careProviderIds.map(String) : [];
    const providerNames = Array.isArray(user.careProviderNames) ? user.careProviderNames.map((item) => String(item).toLowerCase()) : [];
    if (providerId && !providerIds.includes(providerId)) return "provider_mismatch";
    if (!providerId && providerName && !providerNames.includes(providerName)) return "provider_mismatch";
  }

  return null;
}

function callTemplateReasonKey(templateKey, user) {
  if (templateKey === "custom_campaign") return "campaigns.targets.reason.generalAnnouncement";
  if (templateKey === "medication_reminder") return "campaigns.targets.reason.publicHealth";
  if (templateKey === "service_update") return "campaigns.targets.reason.service";
  if (templateKey === "wellbeing_check") return "campaigns.targets.reason.safetyAdvisory";
  if (templateKey === "heatwave_alert") {
    if (Number(user.criticalAlerts || 0) > 0) return "campaigns.targets.reason.safetyCritical";
    if (Number(user.activeAlerts || 0) > 0 || targetRiskStatus(user) === "review") return "campaigns.targets.reason.safetyReview";
    return "campaigns.targets.reason.heatwave";
  }
  return "campaigns.targets.reason.generalAnnouncement";
}

function campaignUserMatchesTemplate(templateKey, user) {
  if (templateKey === "custom_campaign") {
    return Boolean(user.phone);
  }
  if (templateKey === "medication_reminder") {
    return Boolean(user.phone) && (Number(user.healthConditions || 0) > 0 || Number(user.riskScore || 0) >= 40);
  }
  if (templateKey === "wellbeing_check") {
    return Boolean(user.phone) && (Number(user.careProviderCount || 0) === 0 || Number(user.activeAlerts || 0) > 0 || Number(user.riskScore || 0) >= 50);
  }
  if (templateKey === "service_update") {
    return Number(user.careProviderCount || 0) === 0 || targetRiskStatus(user) !== "stable";
  }
  return true;
}

function targetReasonKey(campaign, user) {
  return callTemplateReasonKey(resolveCampaignTemplateKey(campaign), user);
}

function targetStatusForCampaign(campaign, user, index) {
  const riskStatus = targetRiskStatus(user);
  if (riskStatus === "urgent") return "followUp";
  if (campaign.status === "draft") return "pending";
  if (campaign.status === "scheduled") return index === 0 ? "contacted" : "pending";
  if (campaign.status === "completed") return index % 3 === 0 ? "followUp" : "confirmed";
  if (riskStatus === "review") return "followUp";
  return "confirmed";
}

function campaignTargetCandidates(campaign, users) {
  const templateKey = resolveCampaignTemplateKey(campaign);
  const city = nullIfBlank(campaign.city);
  const matches = users.filter((user) => {
    if (city && String(user.city || "").toLowerCase() !== city.toLowerCase()) return false;
    return campaignUserMatchesTemplate(templateKey, user);
  });
  return matches
    .slice()
    .sort((a, b) => Number(b.riskScore || 0) - Number(a.riskScore || 0))
    .slice(0, 20);
}

function deriveCampaignTargets(campaign, dashboardUsers) {
  return campaignTargetCandidates(campaign, dashboardUsers).map((user, index) => {
    const status = targetStatusForCampaign(campaign, user, index);
    const riskStatus = targetRiskStatus(user);
    return {
      id: `derived:${campaign.id}:${user.id}`,
      user_id: user.id,
      user,
      status,
      reasonKey: targetReasonKey(campaign, user),
      action: status === "followUp" || riskStatus === "urgent" ? "prepareCall" : "profile",
      owner: campaign.owner || null,
      channel: campaign.channel === "whatsapp" ? "whatsapp" : "phone",
      city: user.city || "",
      riskStatus,
      score: Number(user.riskScore || 0),
    };
  });
}

function normalizeCampaign(row, targets = [], latestRun = null) {
  const hasTargets = targets.length > 0;
  return {
    id: row.id,
    organizationId: row.organization_id,
    slug: row.slug,
    name: row.name,
    nameKey: row.name_key,
    objective: row.objective,
    objectiveKey: row.objective_key,
    audience: row.audience,
    audienceKey: row.audience_key,
    templateKey: resolveCampaignTemplateKey(row),
    targetRules: normalizeCampaignTargetRules(row.target_rules, row.city),
    dueKey: row.due_key || "campaigns.due.draft",
    city: row.city || "",
    owner: row.owner || "",
    type: campaignTemplateType(resolveCampaignTemplateKey(row)),
    status: row.status,
    channel: row.channel,
    scheduledAt: row.scheduled_at ? new Date(row.scheduled_at).toISOString() : null,
    callScript: row.call_script || "",
    callWindowStart: row.call_window_start || "",
    callWindowEnd: row.call_window_end || "",
    retryLimit: Number(row.retry_limit || 0),
    executionType: row.execution_type || "manual",
    total: hasTargets ? targets.length : Number(row.target_total || 0),
    contacted: hasTargets
      ? targets.filter((target) => ["contacted", "confirmed", "followUp"].includes(target.status)).length
      : Number(row.contacted_count || 0),
    confirmed: hasTargets ? targets.filter((target) => target.status === "confirmed").length : Number(row.confirmed_count || 0),
    followUp: hasTargets ? targets.filter((target) => target.status === "followUp").length : Number(row.follow_up_count || 0),
    tone: row.tone || campaignTone(row.type, row.status),
    latestRun,
    targets,
  };
}

async function loadCampaigns(context) {
  const organizationId = scopeOrganizationId(context);
  const [campaignResult, dashboardData] = await Promise.all([
    query(`
      SELECT
        id::text,
        organization_id::text,
        slug,
        name,
        name_key,
        objective,
        objective_key,
        audience,
        audience_key,
        template_key,
        target_rules,
        due_key,
        city,
        owner,
        type,
        status,
        channel,
        scheduled_at,
        call_script,
        call_window_start,
        call_window_end,
        retry_limit,
        execution_type,
        target_total,
        contacted_count,
        confirmed_count,
        follow_up_count,
        tone
      FROM public.campaigns
      WHERE organization_id = $1
      ORDER BY
        CASE status WHEN 'active' THEN 0 WHEN 'scheduled' THEN 1 WHEN 'draft' THEN 2 ELSE 3 END,
        created_at DESC
    `, [organizationId]),
    loadDashboardUsers(context),
  ]);
  const campaigns = campaignResult.rows;
  const usersById = new Map(dashboardData.gisUsers.map((user) => [user.id, user]));
  const [targetRows, latestRunRows] = campaigns.length
    ? await Promise.all([
        query(
          `
            SELECT
              id::text,
              campaign_id::text,
              vyva_user_id::text,
              status,
              reason_key,
              action,
              owner,
              channel
            FROM public.campaign_targets
            WHERE organization_id = $2 AND campaign_id = ANY($1::uuid[])
            ORDER BY
              CASE status WHEN 'followUp' THEN 0 WHEN 'pending' THEN 1 WHEN 'contacted' THEN 2 ELSE 3 END,
              created_at ASC
          `,
          [campaigns.map((campaign) => campaign.id), organizationId],
        ),
        query(
          `
            WITH latest_runs AS (
              SELECT DISTINCT ON (r.campaign_id)
                r.id,
                r.campaign_id,
                r.status,
                r.scheduled_at,
                r.eligible_count,
                r.skipped_count,
                r.call_script,
                r.call_window_start,
                r.call_window_end,
                r.retry_limit,
                r.created_at,
                r.updated_at
              FROM public.campaign_call_runs r
              WHERE r.organization_id = $2 AND r.campaign_id = ANY($1::uuid[])
              ORDER BY r.campaign_id, r.created_at DESC
            )
            SELECT
              lr.id::text,
              lr.campaign_id::text,
              lr.status,
              lr.scheduled_at,
              lr.eligible_count,
              lr.skipped_count,
              COUNT(*) FILTER (WHERE j.status = 'queued')::int AS queued_count,
              COUNT(*) FILTER (WHERE j.status = 'pending')::int AS pending_count,
              COUNT(*) FILTER (WHERE j.status = 'calling')::int AS calling_count,
              COUNT(*) FILTER (WHERE j.status = 'completed')::int AS completed_count,
              COUNT(*) FILTER (WHERE j.status = 'failed')::int AS failed_count,
              COUNT(*) FILTER (WHERE j.status = 'cancelled')::int AS cancelled_count,
              lr.call_script,
              lr.call_window_start,
              lr.call_window_end,
              lr.retry_limit,
              lr.created_at,
              lr.updated_at
            FROM latest_runs lr
            LEFT JOIN public.campaign_call_jobs j ON j.run_id = lr.id
            GROUP BY
              lr.id,
              lr.campaign_id,
              lr.status,
              lr.scheduled_at,
              lr.eligible_count,
              lr.skipped_count,
              lr.call_script,
              lr.call_window_start,
              lr.call_window_end,
              lr.retry_limit,
              lr.created_at,
              lr.updated_at
          `,
          [campaigns.map((campaign) => campaign.id), organizationId],
        ),
      ])
    : [{ rows: [] }, { rows: [] }];
  const latestRunByCampaign = new Map(latestRunRows.rows.map((row) => [row.campaign_id, normalizeCallRun(row)]));

  const targetsByCampaign = new Map();
  for (const target of targetRows.rows) {
    const user = usersById.get(target.vyva_user_id);
    if (!user) continue;
    const bucket = targetsByCampaign.get(target.campaign_id) || [];
    bucket.push({
      id: target.id,
      user_id: target.vyva_user_id,
      user,
      status: target.status,
      reasonKey: target.reason_key || "campaigns.targets.reason.monitor",
      action: target.action,
      owner: target.owner,
      channel: target.channel,
      city: user.city || "",
      riskStatus: targetRiskStatus(user),
      score: Number(user.riskScore || 0),
    });
    targetsByCampaign.set(target.campaign_id, bucket);
  }

  for (const campaign of campaigns) {
    if (targetsByCampaign.has(campaign.id)) continue;
    const derivedTargets = deriveCampaignTargets(campaign, dashboardData.gisUsers);
    if (derivedTargets.length) targetsByCampaign.set(campaign.id, derivedTargets);
  }

  return campaigns.map((campaign) => normalizeCampaign(campaign, targetsByCampaign.get(campaign.id) || [], latestRunByCampaign.get(campaign.id) || null));
}

function validateCampaignPayload(payload) {
  const name = String(payload?.name || "").trim();
  const templateKey = resolveCampaignTemplateKey(payload);
  const type = campaignTemplateType(templateKey);
  const channel = String(payload?.channel || "phone");
  const status = String(payload?.status || "draft");
  const executionType = String(payload?.executionType || payload?.execution_type || "manual");
  const retryLimit = Number(payload?.retryLimit ?? payload?.retry_limit ?? 0);
  if (!name) return "name is required";
  if (!isCampaignTemplateKey(templateKey)) return "template_key is invalid";
  if (!["safety", "wellbeing", "medication", "service"].includes(type)) return "type is invalid";
  if (!["phone", "whatsapp", "mixed"].includes(channel)) return "channel is invalid";
  if (!["active", "draft", "scheduled", "completed"].includes(status)) return "status is invalid";
  if (!["manual", "vyva_call"].includes(executionType)) return "execution_type is invalid";
  if (!Number.isInteger(retryLimit) || retryLimit < 0 || retryLimit > 5) return "retry_limit is invalid";
  return null;
}

function normalizeCampaignCallSettings(payload = {}) {
  const retryLimit = Number(payload.retryLimit ?? payload.retry_limit ?? 0);
  return {
    scheduledAt: nullIfBlank(payload.scheduledAt ?? payload.scheduled_at),
    callScript: nullIfBlank(payload.callScript ?? payload.call_script),
    callWindowStart: normalizeTimeValue(payload.callWindowStart ?? payload.call_window_start) || "09:00",
    callWindowEnd: normalizeTimeValue(payload.callWindowEnd ?? payload.call_window_end) || "18:00",
    retryLimit: Number.isInteger(retryLimit) && retryLimit >= 0 ? Math.min(retryLimit, 5) : 0,
    createdBy: nullIfBlank(payload.createdBy ?? payload.created_by ?? payload.owner),
  };
}

function normalizeTimeValue(value) {
  const text = nullIfBlank(value);
  if (!text) return null;
  return /^\d{2}:\d{2}$/.test(text) ? text : null;
}

function timestampInsideCallWindow(scheduledAt, start, end) {
  if (!scheduledAt || !start || !end) return true;
  const date = new Date(scheduledAt);
  if (Number.isNaN(date.getTime())) return true;
  const minutes = date.getHours() * 60 + date.getMinutes();
  const [startHour, startMinute] = start.split(":").map(Number);
  const [endHour, endMinute] = end.split(":").map(Number);
  const startMinutes = startHour * 60 + startMinute;
  const endMinutes = endHour * 60 + endMinute;
  if (startMinutes <= endMinutes) return minutes >= startMinutes && minutes <= endMinutes;
  return minutes >= startMinutes || minutes <= endMinutes;
}

function normalizeCallRun(row) {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    status: row.status,
    scheduledAt: row.scheduled_at ? new Date(row.scheduled_at).toISOString() : null,
    eligibleCount: Number(row.eligible_count || 0),
    skippedCount: Number(row.skipped_count || 0),
    queuedCount: Number(row.queued_count || 0),
    pendingCount: Number(row.pending_count || 0),
    callingCount: Number(row.calling_count || 0),
    completedCount: Number(row.completed_count || 0),
    failedCount: Number(row.failed_count || 0),
    cancelledCount: Number(row.cancelled_count || 0),
    callScript: row.call_script || "",
    callWindowStart: row.call_window_start || "",
    callWindowEnd: row.call_window_end || "",
    retryLimit: Number(row.retry_limit || 0),
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  };
}

async function buildCampaignCallPreview(campaignId, payload = {}, context) {
  const organizationId = scopeOrganizationId(context);
  const settings = normalizeCampaignCallSettings(payload);
  const templateKey = resolveCampaignTemplateKey(payload);
  const campaignResult = await query(
    `
      SELECT id::text, organization_id::text, city, template_key, target_rules, type, call_script, call_window_start, call_window_end, retry_limit
      FROM public.campaigns
      WHERE id = $1 AND organization_id = $2
      LIMIT 1
    `,
    [campaignId, organizationId],
  );
  const campaign = campaignResult.rows[0];
  if (!campaign) return null;

  const resolvedTemplateKey = isCampaignTemplateKey(templateKey) ? templateKey : resolveCampaignTemplateKey(campaign);
  const targetRules = normalizeCampaignTargetRules(payload.targetRules ?? payload.target_rules ?? campaign.target_rules, payload.city ?? campaign.city);
  const scheduledAt = settings.scheduledAt ?? null;
  const callWindowStart = settings.callWindowStart || campaign.call_window_start || "09:00";
  const callWindowEnd = settings.callWindowEnd || campaign.call_window_end || "18:00";
  const outsideWindow = !timestampInsideCallWindow(scheduledAt, callWindowStart, callWindowEnd);
  const dashboardData = await loadDashboardUsers(context);
  const usersById = new Map(dashboardData.gisUsers.map((user) => [user.id, user]));

  const candidates = await query(
    `
      SELECT
        u.id::text AS user_id,
        u.first_name,
        u.last_name,
        u.city,
        u.country,
        u.phone,
        COALESCE(h.health_conditions, ARRAY[]::text[]) AS health_conditions,
        COALESCE(provider_summary.provider_count, 0)::int AS provider_count,
        COALESCE(provider_summary.provider_ids, ARRAY[]::text[]) AS provider_ids,
        COALESCE(provider_summary.provider_names, ARRAY[]::text[]) AS provider_names,
        COALESCE(c.consent_given, false) AS consent_given,
        EXISTS (
          SELECT 1
          FROM public.campaign_call_jobs j
          WHERE j.campaign_id = $1
            AND j.vyva_user_id = u.id
            AND j.status IN ('pending', 'queued', 'calling')
        ) AS duplicate_target
      FROM public.vyva_users u
      LEFT JOIN public.vyva_user_consent c ON c.vyva_user_id = u.id
      LEFT JOIN public.vyva_user_health h ON h.vyva_user_id = u.id
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*)::int AS provider_count,
          ARRAY_REMOVE(ARRAY_AGG(DISTINCT COALESCE(a.care_provider_contact_id::text, a.field_staff_id::text)), NULL) AS provider_ids,
          ARRAY_REMOVE(ARRAY_AGG(DISTINCT COALESCE(cp.full_name, fs.full_name)), NULL) AS provider_names
        FROM public.vyva_user_care_provider_assignments a
        LEFT JOIN public.care_provider_contacts cp ON cp.id = a.care_provider_contact_id
        LEFT JOIN public.field_staff fs ON fs.id = a.field_staff_id
        WHERE a.vyva_user_id = u.id
      ) provider_summary ON true
      WHERE u.organization_id = $2
      ORDER BY u.created_at DESC
    `,
    [campaignId, organizationId],
  );

  const skipped = {
    noPhone: 0,
    noConsent: 0,
    outsideCallWindow: 0,
    duplicateTarget: 0,
  };
  const recipients = [];
  for (const row of candidates.rows) {
    const dashboardUserRow = usersById.get(row.user_id);
    const candidateUser = dashboardUserRow || {
      id: row.user_id,
      first_name: row.first_name || "",
      last_name: row.last_name || "",
      city: row.city || "",
      phone: row.phone || "",
      activeAlerts: 0,
      criticalAlerts: 0,
      offlineSensors: 0,
      missedMeds7d: 0,
      checkinEnabled: false,
      riskScore: 0,
      careProviderCount: 0,
      careProviderIds: [],
      careProviderNames: [],
      healthConditionNames: [],
    };
    const enrichedCandidateUser = {
      ...candidateUser,
      country: row.country || candidateUser.country || "",
      healthConditionNames: Array.isArray(row.health_conditions) ? row.health_conditions : [],
      careProviderCount: Number(row.provider_count || candidateUser.careProviderCount || 0),
      careProviderIds: Array.isArray(row.provider_ids) ? row.provider_ids : [],
      careProviderNames: Array.isArray(row.provider_names) && row.provider_names.length ? row.provider_names : candidateUser.careProviderNames || [],
    };

    let status = "eligible";
    let skipReason = null;
    const rulesSkipReason = campaignTargetRuleSkipReason(targetRules, enrichedCandidateUser);
    if (!campaignUserMatchesTemplate(resolvedTemplateKey, enrichedCandidateUser)) {
      status = "skipped";
      skipReason = "template_mismatch";
    } else if (rulesSkipReason) {
      status = "skipped";
      skipReason = rulesSkipReason;
    } else if (targetRules.requirePhone && !nullIfBlank(row.phone)) {
      status = "skipped";
      skipReason = "no_phone";
      skipped.noPhone += 1;
    } else if (targetRules.requireConsent && !row.consent_given) {
      status = "skipped";
      skipReason = "no_consent";
      skipped.noConsent += 1;
    } else if (outsideWindow) {
      status = "skipped";
      skipReason = "outside_call_window";
      skipped.outsideCallWindow += 1;
    } else if (row.duplicate_target) {
      status = "skipped";
      skipReason = "duplicate_target";
      skipped.duplicateTarget += 1;
    }

    recipients.push({
      userId: row.user_id,
      displayName: `${row.first_name || ""} ${row.last_name || ""}`.trim() || "Unknown user",
      city: row.city || "",
      riskStatus: targetRiskStatus(enrichedCandidateUser),
      reasonKey: callTemplateReasonKey(resolvedTemplateKey, enrichedCandidateUser),
      status,
      skipReason,
    });
  }
  const eligibleCount = recipients.filter((target) => target.status === "eligible").length;

  return {
    campaignId,
    organizationId,
    templateKey: resolvedTemplateKey,
    scheduledAt,
    callWindowStart,
    callWindowEnd,
    retryLimit: settings.retryLimit,
    callScript: settings.callScript || campaign.call_script || "",
    eligibleCount,
    skippedCount: recipients.length - eligibleCount,
    skipped,
    recipients,
  };
}

async function createCampaignCallRun(campaignId, payload = {}, context) {
  const preview = await buildCampaignCallPreview(campaignId, payload, context);
  if (!preview) return null;

  const scheduledAt = preview.scheduledAt ?? null;
  const scheduledDate = scheduledAt ? new Date(scheduledAt) : null;
  const isFuture = scheduledDate && !Number.isNaN(scheduledDate.getTime()) && scheduledDate.getTime() > Date.now();
  const runStatus = isFuture ? "scheduled" : "queued";
  const eligibleJobStatus = isFuture ? "pending" : "queued";
  const queuedCount = eligibleJobStatus === "queued" ? preview.eligibleCount : 0;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const runResult = await client.query(
      `
        INSERT INTO public.campaign_call_runs (
          organization_id,
          campaign_id,
          status,
          scheduled_at,
          eligible_count,
          skipped_count,
          queued_count,
          call_script,
          call_window_start,
          call_window_end,
          retry_limit,
          created_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING id::text
      `,
      [
        preview.organizationId,
        campaignId,
        runStatus,
        scheduledAt,
        preview.eligibleCount,
        preview.skippedCount,
        queuedCount,
        preview.callScript,
        preview.callWindowStart,
        preview.callWindowEnd,
        preview.retryLimit,
        normalizeCampaignCallSettings(payload).createdBy,
      ],
    );
    const runId = runResult.rows[0].id;

    for (const target of preview.recipients) {
      const status = target.status === "eligible" ? eligibleJobStatus : "skipped";
      await client.query(
        `
          INSERT INTO public.campaign_call_jobs (
            organization_id,
            run_id,
            campaign_id,
            vyva_user_id,
            status,
            skip_reason,
            scheduled_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (run_id, vyva_user_id) DO NOTHING
        `,
        [
          preview.organizationId,
          runId,
          campaignId,
          target.userId,
          status,
          target.skipReason,
          scheduledAt,
        ],
      );
    }

    await client.query("COMMIT");
    return runId;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function loadCampaignCallRuns(campaignId, context) {
  const organizationId = scopeOrganizationId(context);
  const result = await query(
    `
      SELECT
        r.id::text,
        r.campaign_id::text,
        r.status,
        r.scheduled_at,
        r.eligible_count,
        r.skipped_count,
        COUNT(j.id) FILTER (WHERE j.status = 'queued')::int AS queued_count,
        COUNT(j.id) FILTER (WHERE j.status = 'pending')::int AS pending_count,
        COUNT(j.id) FILTER (WHERE j.status = 'calling')::int AS calling_count,
        COUNT(j.id) FILTER (WHERE j.status = 'completed')::int AS completed_count,
        COUNT(j.id) FILTER (WHERE j.status = 'failed')::int AS failed_count,
        COUNT(j.id) FILTER (WHERE j.status = 'cancelled')::int AS cancelled_count,
        r.call_script,
        r.call_window_start,
        r.call_window_end,
        r.retry_limit,
        r.created_at,
        r.updated_at
      FROM public.campaign_call_runs r
      LEFT JOIN public.campaign_call_jobs j ON j.run_id = r.id
      WHERE r.campaign_id = $1 AND r.organization_id = $2
      GROUP BY r.id
      ORDER BY r.created_at DESC
    `,
    [campaignId, organizationId],
  );

  return result.rows.map(normalizeCallRun);
}

async function loadCampaignCallJobs(runId, context) {
  const organizationId = scopeOrganizationId(context);
  const result = await query(
    `
      SELECT
        j.id::text,
        j.run_id::text,
        j.campaign_id::text,
        j.vyva_user_id::text,
        j.status,
        j.skip_reason,
        j.scheduled_at,
        j.attempt_count,
        u.first_name,
        u.last_name,
        u.city,
        t.reason_key
      FROM public.campaign_call_jobs j
      JOIN public.vyva_users u ON u.id = j.vyva_user_id
      LEFT JOIN public.campaign_targets t
        ON t.campaign_id = j.campaign_id
       AND t.vyva_user_id = j.vyva_user_id
      WHERE j.run_id = $1 AND j.organization_id = $2
      ORDER BY
        CASE j.status
          WHEN 'calling' THEN 0
          WHEN 'queued' THEN 1
          WHEN 'pending' THEN 2
          WHEN 'completed' THEN 3
          WHEN 'skipped' THEN 4
          WHEN 'cancelled' THEN 5
          ELSE 6
        END,
        u.last_name ASC,
        u.first_name ASC
    `,
    [runId, organizationId],
  );

  return result.rows.map((row) => ({
    id: row.id,
    runId: row.run_id,
    campaignId: row.campaign_id,
    userId: row.vyva_user_id,
    displayName: `${row.first_name || ""} ${row.last_name || ""}`.trim() || "Unknown user",
    city: row.city || "",
    status: row.status,
    skipReason: row.skip_reason,
    scheduledAt: row.scheduled_at ? new Date(row.scheduled_at).toISOString() : null,
    attemptCount: Number(row.attempt_count || 0),
    reasonKey: row.reason_key || "campaigns.targets.reason.monitor",
  }));
}

function normalizeCheckin(row) {
  const pausedUntil = row.paused_until ? new Date(row.paused_until).toISOString() : null;
  const isPaused = Boolean(pausedUntil && new Date(pausedUntil).getTime() > Date.now());
  return {
    id: row.id,
    user_id: row.user_id,
    userName: row.user_name,
    userPhone: row.user_phone,
    city: row.city,
    type: "scheduled_call",
    is_active: Boolean(row.is_active),
    frequency_days: parseFrequencyDays(row.frequency),
    preferred_time: row.preferred_time,
    enabled: Boolean(row.is_active),
    frequency: row.frequency,
    paused_until: pausedUntil,
    pause_reason: row.pause_reason || null,
    pause_source: row.pause_source || null,
    is_paused: isPaused,
    last_checkin_at: row.last_checkin_at ? new Date(row.last_checkin_at).toISOString() : null,
    lastCheckinAt: row.last_checkin_at ? new Date(row.last_checkin_at).toISOString() : null,
    last_outcome: row.last_outcome || null,
    lastOutcome: row.last_outcome || null,
    consent_given: Boolean(row.consent_given),
    assigned_provider_name: row.assigned_provider_name || null,
    can_edit: Boolean(row.can_edit),
    edit_block_reason: row.edit_block_reason || null,
    user: {
      id: row.user_id,
      first_name: row.first_name,
      last_name: row.last_name,
      phone: row.user_phone,
      city: row.city,
    },
  };
}

function extractUpstreamList(payload, keys = []) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];
  for (const key of keys) {
    if (Array.isArray(payload[key])) return payload[key];
  }
  return [];
}

const scheduledSessionLastContactDateKeys = [
  "lastOutcomeAt",
  "last_outcome_at",
  "lastStatusAt",
  "last_status_at",
  "lastCheckinAt",
  "last_checkin_at",
  "lastCallAt",
  "last_call_at",
  "lastReportedAt",
  "last_reported_at",
  "lastCompletedAt",
  "last_completed_at",
  "completedAt",
  "completed_at",
  "reportedAt",
  "reported_at",
  "endedAt",
  "ended_at",
  "callEndedAt",
  "call_ended_at",
];
const scheduledSessionLogDateKeys = [...scheduledSessionLastContactDateKeys, "timestamp", "createdAt", "created_at"];
const scheduledSessionStatusKeys = [
  "lastOutcome",
  "last_outcome",
  "lastStatus",
  "last_status",
  "lastCheckinStatus",
  "last_checkin_status",
  "outcome",
  "status",
  "result",
];

function recordFirstString(record, keys) {
  if (!record || typeof record !== "object") return null;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function validIsoDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function scheduledSessionUserId(item) {
  return String(
    firstValue(
      item?.user_id,
      item?.vyva_user_id,
      item?.userId,
      item?.vyvaUserId,
      item?.user?.id,
      item?.vyva_users?.id,
    ) ?? "",
  );
}

function scheduledSessionMatchesUser(item, userId) {
  return scheduledSessionUserId(item) === String(userId);
}

function scheduledSessionLogRecords(item) {
  const records = [];
  for (const key of ["last_call_log", "lastCallLog", "latest_call_log", "latestCallLog", "last_log", "lastLog"]) {
    if (item?.[key] && typeof item[key] === "object") records.push(item[key]);
  }
  for (const key of ["call_logs", "callLogs", "logs", "call_history", "callHistory", "session_logs", "sessionLogs"]) {
    if (Array.isArray(item?.[key])) records.push(...item[key].filter((record) => record && typeof record === "object"));
  }
  return records;
}

function scheduledContactCandidate(record, dateKeys) {
  const at = validIsoDate(recordFirstString(record, dateKeys));
  if (!at) return null;
  return {
    at,
    status: recordFirstString(record, scheduledSessionStatusKeys),
  };
}

function normalizeScheduledContactServiceType(value) {
  const normalized = normalizeServiceType(value);
  if (normalized === "scheduled_call" || normalized === "scheduled") return "checkins";
  if (normalized === "braincoach") return "brain_coach";
  return normalized || null;
}

function buildScheduledContactCandidate(record, dateKeys, serviceType = null, statusKeys = scheduledSessionStatusKeys) {
  const at = validIsoDate(recordFirstString(record, dateKeys));
  if (!at) return null;
  return {
    at,
    status: recordFirstString(record, statusKeys),
    serviceType: normalizeScheduledContactServiceType(serviceType),
  };
}

function latestScheduledContact(...candidates) {
  return candidates
    .flat()
    .filter((candidate) => candidate?.at)
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())[0] || null;
}

function latestScheduledContactFromServices(services = {}) {
  const checkinsCandidate = buildScheduledContactCandidate(
    services.checkins,
    scheduledSessionLastContactDateKeys,
    "checkins",
  );
  const brainCoachCandidate = buildScheduledContactCandidate(
    services.brainCoach,
    ["lastSessionAt", "last_session_at", ...scheduledSessionLastContactDateKeys],
    "brain_coach",
  );
  const medicationCandidate = buildScheduledContactCandidate(
    services.medicationActivity,
    ["occurredAt", "occurred_at", "reportedAt", "reported_at", "createdAt", "created_at"],
    "medication",
  );
  return latestScheduledContact(checkinsCandidate, brainCoachCandidate, medicationCandidate);
}

function latestScheduledSessionContactFromPayload(payload, userId) {
  const list = extractUpstreamList(payload, ["checkins", "data", "sessions"]);
  const candidates = [];

  for (const item of list) {
    if (!scheduledSessionMatchesUser(item, userId)) continue;
    const serviceType = normalizeScheduledContactServiceType(item?.type);

    const parentCandidate = buildScheduledContactCandidate(item, scheduledSessionLastContactDateKeys, serviceType);
    if (parentCandidate) candidates.push(parentCandidate);

    for (const log of scheduledSessionLogRecords(item)) {
      const logCandidate = buildScheduledContactCandidate(log, scheduledSessionLogDateKeys, serviceType);
      if (logCandidate) candidates.push(logCandidate);
    }
  }

  return latestScheduledContact(candidates);
}

async function loadLatestScheduledSessionContact(userId) {
  const upstream = await requestVyvaBackend("/api/v1/checkins-dashboard/checkins", {
    query: {
      user_id: userId,
      service_type: "all",
      organization_name: "Red Cross",
    },
  });
  if (!upstream?.ok) return null;
  return latestScheduledSessionContactFromPayload(upstream.data, userId);
}

function applyScheduledSessionContact(data, contact) {
  if (!contact?.at || !data || typeof data !== "object") return data;
  const serviceType = normalizeScheduledContactServiceType(contact.serviceType);
  const checkins = data.checkins || null;
  const brainCoach = data.brainCoach || null;
  const medicationActivity = data.medicationActivity || null;
  return {
    ...data,
    ...(checkins && (!serviceType || serviceType === "checkins")
      ? {
          checkins: {
            ...checkins,
            last_checkin_at: contact.at,
            lastCheckinAt: contact.at,
            last_outcome: contact.status || checkins.last_outcome || checkins.lastOutcome || null,
            lastOutcome: contact.status || checkins.lastOutcome || checkins.last_outcome || null,
          },
        }
      : {}),
    ...(brainCoach && serviceType === "brain_coach"
      ? {
          brainCoach: {
            ...brainCoach,
            last_session_at: contact.at,
            lastSessionAt: contact.at,
            last_outcome: contact.status || brainCoach.last_outcome || brainCoach.lastOutcome || null,
            lastOutcome: contact.status || brainCoach.lastOutcome || brainCoach.last_outcome || null,
          },
        }
      : {}),
    ...(medicationActivity && serviceType === "medication"
      ? {
          medicationActivity: {
            ...medicationActivity,
            occurred_at: contact.at,
            occurredAt: contact.at,
            status: contact.status || medicationActivity.status || null,
          },
        }
      : {}),
    operationalContext: {
      ...(data.operationalContext || {}),
      lastContactAt: contact.at,
      lastContactStatus: contact.status || null,
    },
  };
}

function applyScheduledSessionContactToItem(item, contact) {
  if (!contact?.at || !item || typeof item !== "object") return item;
  const existingAt = recordFirstString(item, scheduledSessionLastContactDateKeys);
  const existingStatus = recordFirstString(item, scheduledSessionStatusKeys);
  const at = existingAt || contact.at;
  const status = existingStatus || contact.status || null;
  return {
    ...item,
    last_checkin_at: at,
    lastCheckinAt: at,
    last_outcome: status,
    lastOutcome: status,
  };
}

function normalizeServiceType(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function isBrainCoachType(value) {
  const normalized = normalizeServiceType(value);
  return normalized === "brain_coach" || normalized === "braincoach";
}

function filterUpstreamCheckins(payload, mode = "standard") {
  const list = extractUpstreamList(payload, ["checkins", "data", "sessions"]);
  const filtered = list.filter((item) => {
    const isBrainCoach = isBrainCoachType(item?.type);
    if (mode === "brain_coach") return isBrainCoach;
    if (mode === "all") return true;
    return !isBrainCoach;
  });

  if (Array.isArray(payload)) return filtered;
  if (payload && typeof payload === "object") {
    if (Array.isArray(payload.checkins)) return { ...payload, checkins: filtered };
    if (Array.isArray(payload.data)) return { ...payload, data: filtered };
  }
  return { checkins: filtered };
}

function mapUpstreamBrainCoachSessions(payload) {
  const list = extractUpstreamList(payload, ["sessions", "data", "checkins"]);

  return list
    .filter((item) => isBrainCoachType(item?.type))
    .map((item, index) => {
      const nestedUser = item?.user ?? item?.vyva_users ?? {};
      const firstName = item?.first_name ?? nestedUser?.first_name ?? null;
      const lastName = item?.last_name ?? nestedUser?.last_name ?? null;
      const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();
      const frequency = item?.frequency ?? item?.frequency_days ?? item?.cadence ?? null;

      return {
        id: String(item?.id ?? `brain-coach-${item?.user_id ?? nestedUser?.id ?? index}`),
        user_id: String(item?.user_id ?? item?.vyva_user_id ?? nestedUser?.id ?? ""),
        userName: item?.userName || item?.user_name || item?.name || nestedUser?.name || fullName || "Unknown",
        userPhone: item?.userPhone || item?.user_phone || item?.phone || nestedUser?.phone || null,
        city: item?.city || nestedUser?.city || null,
        enabled:
          typeof item?.enabled === "boolean"
            ? item.enabled
            : typeof item?.is_active === "boolean"
              ? item.is_active
              : typeof item?.active === "boolean"
                ? item.active
                : true,
        frequency: frequency == null ? null : String(frequency),
        preferred_time: item?.preferred_time ?? item?.preferredTime ?? null,
        paused_until: item?.paused_until ?? item?.pausedUntil ?? null,
        pause_reason: item?.pause_reason ?? item?.pauseReason ?? null,
        pause_source: item?.pause_source ?? item?.pauseSource ?? null,
        is_paused: Boolean(item?.is_paused ?? item?.isPaused),
      };
    })
    .filter((item) => item.user_id);
}

function routinePauseStateFromRow(row) {
  const pausedUntil = row?.paused_until ? new Date(row.paused_until).toISOString() : null;
  return {
    paused_until: pausedUntil,
    pause_reason: row?.pause_reason || null,
    pause_source: row?.pause_source || null,
    is_paused: Boolean(pausedUntil && new Date(pausedUntil).getTime() > Date.now()),
  };
}

function mergeRoutinePauseIntoItem(item, overlay) {
  if (!overlay) return item;
  return {
    ...item,
    id: overlay.id ?? item?.id,
    enabled: typeof overlay.enabled === "boolean" ? overlay.enabled : item?.enabled,
    is_active: typeof overlay.is_active === "boolean" ? overlay.is_active : item?.is_active,
    active: typeof overlay.is_active === "boolean" ? overlay.is_active : item?.active,
    frequency: overlay.frequency ?? item?.frequency ?? item?.frequency_days ?? item?.cadence ?? null,
    preferred_time: overlay.preferred_time ?? item?.preferred_time ?? item?.preferredTime ?? null,
    paused_until: overlay.paused_until,
    pause_reason: overlay.pause_reason,
    pause_source: overlay.pause_source,
    is_paused: overlay.is_paused,
  };
}

async function loadRoutineServiceOverlayMap(serviceType, userIds, context) {
  if (!context?.organizationId) return new Map();

  const ids = Array.from(new Set(userIds.map((id) => String(id || "").trim()).filter(Boolean)));
  if (!ids.length) return new Map();

  const uuidIds = ids.filter(isUuid);
  const table = serviceType === "brain_coach" ? "public.vyva_user_brain_coach" : "public.vyva_user_checkins";
  const rows = await optionalRows(
    `
      SELECT
        s.id::text AS overlay_id,
        u.id::text AS local_user_id,
        u.external_user_id,
        s.enabled,
        s.frequency,
        s.preferred_time,
        s.paused_until,
        s.pause_reason,
        s.pause_source
      FROM ${table} s
      JOIN public.vyva_users u ON u.id = s.vyva_user_id
      WHERE u.organization_id = $1
        AND (u.id = ANY($2::uuid[]) OR u.external_user_id = ANY($3::text[]))
    `,
    [scopeOrganizationId(context), uuidIds, ids],
  );

  const map = new Map();
  for (const row of rows) {
    const overlay = {
      id: row.overlay_id,
      is_active: Boolean(row.enabled),
      enabled: Boolean(row.enabled),
      frequency: row.frequency ?? null,
      preferred_time: row.preferred_time ?? null,
      ...routinePauseStateFromRow(row),
    };
    map.set(String(row.local_user_id), overlay);
    if (row.external_user_id) map.set(String(row.external_user_id), overlay);
  }
  return map;
}

async function loadRoutineServiceAccessMap(userIds, context) {
  if (!context?.organizationId) return new Map();

  const ids = Array.from(new Set((userIds || []).map((id) => String(id || "").trim()).filter(Boolean)));
  if (!ids.length) return new Map();

  const uuidIds = ids.filter(isUuid);
  const fieldStaffIds = context.isAdmin ? [] : await resolveContextFieldStaffIds(context);
  const rows = await optionalRows(
    `
      SELECT
        u.id::text AS local_user_id,
        u.external_user_id,
        COALESCE(consent.consent_given, false) AS consent_given,
        MAX(fs.full_name) FILTER (WHERE a.provider_type = 'field_staff' AND a.is_primary = true) AS assigned_provider_name,
        BOOL_OR(
          a.provider_type = 'field_staff'
          AND a.field_staff_id IS NOT NULL
          AND a.field_staff_id = ANY($4::uuid[])
        ) AS assigned_to_current_provider
      FROM public.vyva_users u
      LEFT JOIN public.vyva_user_consent consent ON consent.vyva_user_id = u.id
      LEFT JOIN public.vyva_user_care_provider_assignments a ON a.vyva_user_id = u.id
      LEFT JOIN public.field_staff fs ON fs.id = a.field_staff_id
      WHERE u.organization_id = $1
        AND (u.id = ANY($2::uuid[]) OR u.external_user_id = ANY($3::text[]))
      GROUP BY u.id, u.external_user_id, consent.consent_given
    `,
    [scopeOrganizationId(context), uuidIds, ids, fieldStaffIds],
  );

  const map = new Map();
  for (const row of rows) {
    const consentGiven = Boolean(row.consent_given);
    const assignedToCurrentProvider = Boolean(row.assigned_to_current_provider);
    const canEdit = consentGiven && (Boolean(context.isAdmin) || assignedToCurrentProvider);
    const access = {
      consent_given: consentGiven,
      assigned_provider_name: row.assigned_provider_name || null,
      can_edit: canEdit,
      edit_block_reason: !consentGiven
        ? "consent_required"
        : canEdit
          ? null
          : "assigned_provider_required",
    };
    map.set(String(row.local_user_id), access);
    if (row.external_user_id) map.set(String(row.external_user_id), access);
  }

  return map;
}

async function overlayRoutineServicePayload(payload, serviceType, context) {
  if (!context) return payload;

  const list = extractUpstreamList(payload, ["checkins", "data", "sessions"]);
  if (!list.length) return payload;

  const userIds = list.map((item) =>
    String(item?.user_id ?? item?.vyva_user_id ?? item?.user?.id ?? item?.vyva_users?.id ?? "").trim(),
  ).filter(Boolean);
  const overlays = await loadRoutineServiceOverlayMap(serviceType, userIds, context);
  const accessMap = await loadRoutineServiceAccessMap(userIds, context);
  const uniqueUserIds = Array.from(new Set(userIds));
  const listContactMap = new Map(
    uniqueUserIds
      .map((userId) => [userId, latestScheduledSessionContactFromPayload(payload, userId)])
      .filter(([, contact]) => contact?.at),
  );
  const missingContactIds = uniqueUserIds.filter((userId) => !listContactMap.has(userId));
  const fallbackContacts = await Promise.all(
    missingContactIds.map(async (userId) => [userId, await loadLatestScheduledSessionContact(userId)]),
  );
  for (const [userId, contact] of fallbackContacts) {
    if (contact?.at) listContactMap.set(userId, contact);
  }

  const augmented = list.map((item) => {
    const candidateId = String(item?.user_id ?? item?.vyva_user_id ?? item?.user?.id ?? item?.vyva_users?.id ?? "").trim();
    const merged = mergeRoutinePauseIntoItem(item, overlays.get(candidateId));
    const withContact = applyScheduledSessionContactToItem(merged, listContactMap.get(candidateId));
    const access = accessMap.get(candidateId);
    return access ? { ...withContact, ...access } : withContact;
  });

  if (Array.isArray(payload)) return augmented;
  if (payload && typeof payload === "object") {
    if (Array.isArray(payload.checkins)) return { ...payload, checkins: augmented };
    if (Array.isArray(payload.data)) return { ...payload, data: augmented };
    if (Array.isArray(payload.sessions)) return { ...payload, sessions: augmented };
  }
  return serviceType === "brain_coach" ? { sessions: augmented } : { checkins: augmented };
}

async function loadCheckins(context) {
  const organizationId = scopeOrganizationId(context);
  const fieldStaffIds = context.isAdmin ? [] : await resolveContextFieldStaffIds(context);
  const result = await query(`
    SELECT
      c.id::text,
      c.vyva_user_id::text AS user_id,
      c.enabled AS is_active,
      c.frequency,
      c.preferred_time,
      c.paused_until,
      c.pause_reason,
      c.pause_source,
      u.first_name,
      u.last_name,
      u.first_name || ' ' || u.last_name AS user_name,
      u.phone AS user_phone,
      u.city,
      COALESCE(consent.consent_given, false) AS consent_given,
      MAX(fs.full_name) FILTER (WHERE a.provider_type = 'field_staff' AND a.is_primary = true) AS assigned_provider_name,
      CASE
        WHEN COALESCE(consent.consent_given, false) = false THEN false
        WHEN $2::boolean = true THEN true
        ELSE BOOL_OR(
          a.provider_type = 'field_staff'
          AND a.is_primary = true
          AND a.field_staff_id IS NOT NULL
          AND a.field_staff_id = ANY($3::uuid[])
        )
      END AS can_edit,
      CASE
        WHEN COALESCE(consent.consent_given, false) = false THEN 'consent_required'
        WHEN $2::boolean = true THEN NULL
        WHEN BOOL_OR(
          a.provider_type = 'field_staff'
          AND a.is_primary = true
          AND a.field_staff_id IS NOT NULL
          AND a.field_staff_id = ANY($3::uuid[])
        ) THEN NULL
        ELSE 'assigned_provider_required'
      END AS edit_block_reason
    FROM public.vyva_user_checkins c
    JOIN public.vyva_users u ON u.id = c.vyva_user_id
    LEFT JOIN public.vyva_user_consent consent ON consent.vyva_user_id = u.id
    LEFT JOIN public.vyva_user_care_provider_assignments a ON a.vyva_user_id = u.id
    LEFT JOIN public.field_staff fs ON fs.id = a.field_staff_id
    WHERE u.organization_id = $1
    GROUP BY
      c.id,
      c.vyva_user_id,
      c.enabled,
      c.frequency,
      c.preferred_time,
      c.paused_until,
      c.pause_reason,
      c.pause_source,
      u.first_name,
      u.last_name,
      u.phone,
      u.city,
      consent.consent_given
    ORDER BY c.enabled DESC, u.last_name ASC, u.first_name ASC
  `, [organizationId, Boolean(context.isAdmin), fieldStaffIds]);
  return result.rows.map(normalizeCheckin);
}

function normalizeBrainCoachSession(row) {
  const pauseState = routinePauseStateFromRow(row);
  return {
    id: row.id,
    user_id: row.user_id,
    userName: row.user_name,
    userPhone: row.user_phone,
    city: row.city,
    enabled: Boolean(row.enabled),
    frequency: row.frequency,
    preferred_time: row.preferred_time,
    last_session_at: row.last_session_at ? new Date(row.last_session_at).toISOString() : null,
    lastSessionAt: row.last_session_at ? new Date(row.last_session_at).toISOString() : null,
    last_outcome: row.last_outcome || null,
    lastOutcome: row.last_outcome || null,
    ...pauseState,
  };
}

async function loadBrainCoachSessions(context) {
  const organizationId = scopeOrganizationId(context);
  const result = await query(`
    SELECT
      bc.id::text,
      bc.vyva_user_id::text AS user_id,
      bc.enabled,
      bc.frequency,
      bc.preferred_time,
      bc.paused_until,
      bc.pause_reason,
      bc.pause_source,
      u.first_name,
      u.last_name,
      u.first_name || ' ' || u.last_name AS user_name,
      u.phone AS user_phone,
      u.city
    FROM public.vyva_user_brain_coach bc
    JOIN public.vyva_users u ON u.id = bc.vyva_user_id
    WHERE u.organization_id = $1
    ORDER BY bc.enabled DESC, u.last_name ASC, u.first_name ASC
  `, [organizationId]);

  return result.rows.map(normalizeBrainCoachSession);
}

function validateCheckinPayload(payload, creating = false) {
  const userId = payload?.user_id;
  const frequencyDays = Number(payload?.frequency_days);
  const preferredTime = payload?.preferred_time || null;
  if (creating && !userId) return "user_id is required";
  if (!Number.isInteger(frequencyDays) || frequencyDays <= 0) return "frequency_days must be a positive whole number";
  if (preferredTime && !/^\d{2}:\d{2}$/.test(preferredTime)) return "preferred_time must be HH:mm";
  return null;
}

async function loadUserInfo(userId, context) {
  const organizationId = scopeOrganizationId(context);
  const userResult = await query(
    "SELECT *, id::text, organization_id::text FROM public.vyva_users WHERE id = $1 AND organization_id = $2 LIMIT 1",
    [userId, organizationId],
  );
  const user = userResult.rows[0];
  if (!user) return null;

  const [consent, health, medications, medicationActivity, checkins, brainCoach, careProviders, sensors, alerts] = await Promise.all([
    optionalRows("SELECT *, id::text FROM public.vyva_user_consent WHERE vyva_user_id = $1 LIMIT 1", [userId]),
    optionalRows("SELECT *, id::text FROM public.vyva_user_health WHERE vyva_user_id = $1 LIMIT 1", [userId]),
    optionalRows("SELECT *, id::text FROM public.vyva_user_medications WHERE vyva_user_id = $1 ORDER BY created_at DESC", [userId]),
    loadLatestMedicationActivity(userId),
    optionalRows("SELECT *, id::text FROM public.vyva_user_checkins WHERE vyva_user_id = $1 LIMIT 1", [userId]),
    optionalRows("SELECT *, id::text FROM public.vyva_user_brain_coach WHERE vyva_user_id = $1 LIMIT 1", [userId]),
    loadUserCareProviders(userId, context),
    optionalRows("SELECT *, id::text FROM public.vyva_user_sensors WHERE vyva_user_id = $1 ORDER BY created_at DESC", [userId]),
    optionalRows("SELECT *, id::text FROM public.vyva_sensor_alerts WHERE vyva_user_id = $1 ORDER BY created_at DESC LIMIT 50", [userId]),
  ]);
  const caregivers = careProviders
    .filter((provider) => provider.provider_type === "caregiver")
    .map((provider) => ({
      id: provider.id,
      assignment_id: provider.id,
      care_provider_contact_id: provider.provider_id,
      vyva_user_id: userId,
      caretaker_name: provider.display_name,
      caretaker_phone: provider.phone,
      is_primary: provider.is_primary,
      relationship_label: provider.relationship_label,
      notes: provider.notes,
      source: provider.source,
      created_at: provider.created_at,
    }));
  const carePlanAccess = (await loadCarePlanAccessMap([userId], context)).get(String(userId)) || {
    can_edit_care_plan: Boolean(context.isAdmin),
    can_edit_medications: Boolean(context.isAdmin),
    can_edit_checkins: Boolean(context.isAdmin && consent[0]?.consent_given),
    can_edit_brain_coach: Boolean(context.isAdmin && consent[0]?.consent_given),
    edit_block_reason: null,
  };

  return {
    user,
    consent: consent[0] || null,
    health: health[0] || null,
    medications,
    medicationActivity,
    checkins: checkins[0] || null,
    brainCoach: brainCoach[0] || null,
    careProviders,
    caregivers,
    sensors,
    alerts,
    readings: [],
    can_edit_care_plan: carePlanAccess.can_edit_care_plan,
    can_edit_medications: carePlanAccess.can_edit_medications,
    can_edit_checkins: carePlanAccess.can_edit_checkins,
    can_edit_brain_coach: carePlanAccess.can_edit_brain_coach,
    edit_block_reason: carePlanAccess.edit_block_reason,
  };
}

function nullIfBlank(value) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text ? text : null;
}

function normalizeUserPayload(payload, creating = false, organization = null) {
  const firstName = nullIfBlank(payload?.first_name);
  const lastName = nullIfBlank(payload?.last_name);
  const dateOfBirth = nullIfBlank(payload?.date_of_birth);
  const language = nullIfBlank(payload?.language) || organization?.defaultLanguage || "de";
  const livingContext = normalizeLivingContextValue(firstValue(payload?.living_context, payload?.livingContext));

  if (!firstName) return { error: "first_name is required" };
  if (!lastName) return { error: "last_name is required" };
  if (dateOfBirth && !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) return { error: "date_of_birth must be YYYY-MM-DD" };
  if (!["en", "de", "es"].includes(language)) return { error: "language must be en, de, or es" };

  return {
    value: {
      first_name: firstName,
      last_name: lastName,
      phone: nullIfBlank(payload?.phone),
      city: nullIfBlank(payload?.city),
      street: nullIfBlank(payload?.street),
      house_number: nullIfBlank(payload?.house_number),
      post_code: nullIfBlank(payload?.post_code),
      country: nullIfBlank(payload?.country) || (creating ? organization?.country || "Germany" : null),
      timezone: nullIfBlank(payload?.timezone) || (creating ? organization?.timezone || "Europe/Berlin" : null),
      date_of_birth: dateOfBirth,
      gender: nullIfBlank(payload?.gender),
      language,
      living_context: livingContext,
      emergency_notes: nullIfBlank(payload?.emergency_notes),
    },
  };
}

function hasOwnPayloadKey(payload, key) {
  return Boolean(payload) && Object.prototype.hasOwnProperty.call(payload, key);
}

function normalizeConsentPayload(payload) {
  return {
    value: {
      consent_given: optionalBooleanValue(payload?.consent_given, payload?.consentGiven, payload?.user_consent, payload?.userConsent) ?? false,
      caretaker_consent: optionalBooleanValue(payload?.caretaker_consent, payload?.caretakerConsent, payload?.caregiver_consent, payload?.caregiverConsent) ?? false,
    },
  };
}

function normalizeCaregiverArrayPayload(value) {
  if (!Array.isArray(value)) return { value: null };

  const caregivers = [];
  for (const item of value.map(objectValue)) {
    if (!hasMeaningfulPayloadValue(item)) continue;
    const caregiver = normalizeCaregiverPayload(item);
    if (caregiver.error) return caregiver;
    caregivers.push(caregiver.value);
  }

  return { value: caregivers };
}

function normalizeMedicationArrayPayload(value) {
  if (!Array.isArray(value)) return { value: null };

  const medications = [];
  for (const item of value.map(objectValue)) {
    if (!hasMeaningfulPayloadValue(item)) continue;
    const medication = normalizeMedicationPayload(item);
    if (medication.error) return medication;
    medications.push(medication.value);
  }

  return { value: medications };
}

function normalizeCareProfilePayload(payload, creating = false) {
  const healthPresent = hasOwnPayloadKey(payload, "health");
  const consentPresent = hasOwnPayloadKey(payload, "consent");
  const caregiversPresent = Array.isArray(payload?.caregivers);
  const medicationsPresent = Array.isArray(payload?.medications);
  const checkinsPresent = hasOwnPayloadKey(payload, "checkins") || hasOwnPayloadKey(payload, "checkin");
  const brainCoachPresent = hasOwnPayloadKey(payload, "brainCoach") || hasOwnPayloadKey(payload, "brain_coach");

  const caregiverSource = objectValue(payload?.caregiver);
  const medicationSource = objectValue(payload?.medication);

  const caregivers = normalizeCaregiverArrayPayload(payload?.caregivers);
  if (caregivers.error) return caregivers;

  const medications = normalizeMedicationArrayPayload(payload?.medications);
  if (medications.error) return medications;

  const legacyCaregiver = !caregiversPresent && hasMeaningfulPayloadValue(caregiverSource)
    ? normalizeCaregiverPayload(caregiverSource)
    : null;
  if (legacyCaregiver?.error) return legacyCaregiver;

  const legacyMedication = !medicationsPresent && hasMeaningfulPayloadValue(medicationSource)
    ? normalizeMedicationPayload(medicationSource)
    : null;
  if (legacyMedication?.error) return legacyMedication;

  const checkinsSource = objectValue(firstValue(payload?.checkins, payload?.checkin));
  const brainCoachSource = objectValue(firstValue(payload?.brainCoach, payload?.brain_coach));

  const checkins = checkinsPresent ? normalizeServicePayload(checkinsSource) : null;
  if (checkins?.error) return checkins;

  const brainCoach = brainCoachPresent ? normalizeServicePayload(brainCoachSource) : null;
  if (brainCoach?.error) return brainCoach;

  return {
    value: {
      healthPresent,
      health: healthPresent ? normalizeHealthPayload(objectValue(payload?.health)).value : null,
      consentPresent,
      consent: consentPresent ? normalizeConsentPayload(objectValue(payload?.consent)).value : null,
      caregiversPresent,
      caregivers: caregiversPresent ? caregivers.value : legacyCaregiver ? [legacyCaregiver.value] : null,
      medicationsPresent,
      medications: medicationsPresent ? medications.value : legacyMedication ? [legacyMedication.value] : null,
      checkinsPresent,
      checkins: checkins?.value ?? null,
      brainCoachPresent,
      brainCoach: brainCoach?.value ?? null,
    },
  };
}

async function upsertConsentWithClient(client, userId, consent) {
  const existing = await client.query("SELECT id::text FROM public.vyva_user_consent WHERE vyva_user_id = $1 LIMIT 1", [userId]);
  if (existing.rows[0]) {
    await client.query(
      `
        UPDATE public.vyva_user_consent
        SET consent_given = $2, caretaker_consent = $3, updated_at = now()
        WHERE id = $1
      `,
      [existing.rows[0].id, consent.consent_given, consent.caretaker_consent],
    );
    return;
  }

  await client.query(
    `
      INSERT INTO public.vyva_user_consent (vyva_user_id, consent_given, caretaker_consent)
      VALUES ($1, $2, $3)
    `,
    [userId, consent.consent_given, consent.caretaker_consent],
  );
}

async function upsertHealthWithClient(client, userId, health) {
  const existing = await client.query("SELECT id::text FROM public.vyva_user_health WHERE vyva_user_id = $1 LIMIT 1", [userId]);
  if (existing.rows[0]) {
    await client.query(
      `
        UPDATE public.vyva_user_health
        SET health_conditions = $2, mobility_needs = $3, updated_at = now()
        WHERE id = $1
      `,
      [existing.rows[0].id, health.health_conditions, health.mobility_needs],
    );
    return;
  }

  await client.query(
    `
      INSERT INTO public.vyva_user_health (vyva_user_id, health_conditions, mobility_needs)
      VALUES ($1, $2, $3)
    `,
    [userId, health.health_conditions, health.mobility_needs],
  );
}

function normalizeCareProviderType(value) {
  const text = nullIfBlank(value)?.toLowerCase().replace(/[-\s]+/g, "_");
  if (["field_staff", "fieldstaff", "professional", "staff"].includes(text)) return "field_staff";
  return "caregiver";
}

function normalizeContactSource(value, fallback = "manual") {
  const source = nullIfBlank(value)?.toLowerCase().replace(/[-\s]+/g, "_");
  return ["onboarding", "manual", "csv", "api"].includes(source) ? source : fallback;
}

function careProviderAssignmentRow(row) {
  return {
    id: row.id,
    assignment_id: row.id,
    provider_type: row.provider_type,
    provider_id: row.provider_id,
    display_name: row.display_name,
    phone: row.phone,
    role: row.role,
    team: row.team,
    status: row.status,
    source: row.source || null,
    is_primary: Boolean(row.is_primary),
    relationship_label: row.relationship_label,
    notes: row.notes,
    active: row.active === undefined ? true : Boolean(row.active),
    assignment_count: row.assignment_count === undefined ? undefined : Number(row.assignment_count || 0),
    linked_users: Array.isArray(row.linked_users) ? row.linked_users : [],
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function loadUserCareProviders(userId, context = null) {
  const organizationId = context ? scopeOrganizationId(context) : null;
  const rows = await optionalRows(
    `
      SELECT
        a.id::text,
        a.provider_type,
        COALESCE(c.id::text, fs.id::text) AS provider_id,
        COALESCE(c.full_name, fs.full_name) AS display_name,
        COALESCE(c.phone, fs.phone) AS phone,
        fs.role,
        fs.team,
        fs.status,
        c.source,
        COALESCE(c.active, fs.active, true) AS active,
        a.is_primary,
        a.relationship_label,
        a.notes,
        a.created_at,
        a.updated_at
      FROM public.vyva_user_care_provider_assignments a
      JOIN public.vyva_users u ON u.id = a.vyva_user_id
      LEFT JOIN public.care_provider_contacts c ON c.id = a.care_provider_contact_id
      LEFT JOIN public.field_staff fs ON fs.id = a.field_staff_id
      WHERE a.vyva_user_id = $1
        AND ($2::uuid IS NULL OR u.organization_id = $2)
      ORDER BY a.is_primary DESC, a.provider_type ASC, COALESCE(c.full_name, fs.full_name) ASC
    `,
    [userId, organizationId],
  );
  return rows.map(careProviderAssignmentRow);
}

async function loadCareProviderAssignmentByIdWithClient(client, assignmentId, organizationId = null) {
  const result = await client.query(
    `
      SELECT
        a.id::text,
        a.provider_type,
        COALESCE(c.id::text, fs.id::text) AS provider_id,
        COALESCE(c.full_name, fs.full_name) AS display_name,
        COALESCE(c.phone, fs.phone) AS phone,
        fs.role,
        fs.team,
        fs.status,
        c.source,
        COALESCE(c.active, fs.active, true) AS active,
        a.is_primary,
        a.relationship_label,
        a.notes,
        a.created_at,
        a.updated_at
      FROM public.vyva_user_care_provider_assignments a
      JOIN public.vyva_users u ON u.id = a.vyva_user_id
      LEFT JOIN public.care_provider_contacts c ON c.id = a.care_provider_contact_id
      LEFT JOIN public.field_staff fs ON fs.id = a.field_staff_id
      WHERE a.id = $1
        AND ($2::uuid IS NULL OR u.organization_id = $2)
      LIMIT 1
    `,
    [assignmentId, organizationId],
  );
  return result.rows[0] ? careProviderAssignmentRow(result.rows[0]) : null;
}

async function loadCareProviders(filters = {}, context) {
  const organizationId = scopeOrganizationId(context);
  const search = nullIfBlank(filters.search)?.toLowerCase() || null;
  const type = filters.type && filters.type !== "all" ? normalizeCareProviderType(filters.type) : null;
  const queryCareProviderRows = async () => optionalRows(
    `
      WITH caregiver_counts AS (
        SELECT
          a.care_provider_contact_id AS provider_id,
          COUNT(*)::int AS assignment_count,
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'id', u.id::text,
              'name', u.first_name || ' ' || u.last_name,
              'city', u.city
            )
            ORDER BY u.last_name ASC, u.first_name ASC
          ) AS linked_users
        FROM public.vyva_user_care_provider_assignments a
        JOIN public.vyva_users u ON u.id = a.vyva_user_id
        WHERE a.provider_type = 'caregiver'
          AND u.organization_id = $3
        GROUP BY a.care_provider_contact_id
      ),
      field_staff_counts AS (
        SELECT
          a.field_staff_id AS provider_id,
          COUNT(*)::int AS assignment_count,
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'id', u.id::text,
              'name', u.first_name || ' ' || u.last_name,
              'city', u.city
            )
            ORDER BY u.last_name ASC, u.first_name ASC
          ) AS linked_users
        FROM public.vyva_user_care_provider_assignments a
        JOIN public.vyva_users u ON u.id = a.vyva_user_id
        WHERE a.provider_type = 'field_staff'
          AND u.organization_id = $3
        GROUP BY a.field_staff_id
      ),
      legacy_caregiver_directory AS (
        SELECT
          CONCAT(
            'legacy-caregiver:',
            u.organization_id::text,
            ':',
            COALESCE(
              NULLIF(regexp_replace(COALESCE(c.caretaker_phone, ''), '[^0-9]', '', 'g'), ''),
              LOWER(COALESCE(NULLIF(c.caretaker_name, ''), 'care contact'))
            )
          ) AS id,
          CONCAT(
            'legacy-caregiver:',
            u.organization_id::text,
            ':',
            COALESCE(
              NULLIF(regexp_replace(COALESCE(c.caretaker_phone, ''), '[^0-9]', '', 'g'), ''),
              LOWER(COALESCE(NULLIF(c.caretaker_name, ''), 'care contact'))
            )
          ) AS provider_id,
          COALESCE(
            NULLIF((array_agg(c.caretaker_name ORDER BY c.created_at DESC, c.id DESC))[1], ''),
            'Care contact'
          ) AS display_name,
          (array_agg(c.caretaker_phone ORDER BY c.created_at DESC, c.id DESC))[1] AS phone,
          NULL::text AS role,
          NULL::text AS team,
          'active'::text AS status,
          'onboarding'::text AS source,
          true AS active,
          COUNT(DISTINCT c.vyva_user_id)::int AS assignment_count,
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'id', u.id::text,
              'name', u.first_name || ' ' || u.last_name,
              'city', u.city
            )
            ORDER BY u.last_name ASC, u.first_name ASC
          ) AS linked_users,
          'Caregiver'::text AS relationship_label,
          MAX(c.created_at) AS created_at,
          MAX(c.updated_at) AS updated_at,
          NULLIF(regexp_replace(COALESCE((array_agg(c.caretaker_phone ORDER BY c.created_at DESC, c.id DESC))[1], ''), '[^0-9]', '', 'g'), '') AS phone_digits,
          u.organization_id::text AS legacy_organization_id
        FROM public.vyva_user_caregivers c
        JOIN public.vyva_users u ON u.id = c.vyva_user_id
        WHERE
          u.organization_id = $3
          AND (NULLIF(c.caretaker_name, '') IS NOT NULL OR NULLIF(c.caretaker_phone, '') IS NOT NULL)
        GROUP BY
          u.organization_id,
          COALESCE(
            NULLIF(regexp_replace(COALESCE(c.caretaker_phone, ''), '[^0-9]', '', 'g'), ''),
            LOWER(COALESCE(NULLIF(c.caretaker_name, ''), 'care contact'))
          )
      )
      SELECT
        c.id::text AS id,
        'caregiver' AS provider_type,
        c.id::text AS provider_id,
        c.full_name AS display_name,
        c.phone,
        NULL::text AS role,
        NULL::text AS team,
        CASE WHEN c.active THEN 'active' ELSE 'inactive' END AS status,
        c.source,
        c.active,
        COALESCE(cc.assignment_count, 0) AS assignment_count,
        COALESCE(cc.linked_users, '[]'::json) AS linked_users,
        NULL::text AS relationship_label,
        c.created_at,
        c.updated_at
      FROM public.care_provider_contacts c
      LEFT JOIN caregiver_counts cc ON cc.provider_id = c.id
      WHERE
        c.active = true
        AND c.organization_id = $3
        AND ($1::text IS NULL OR LOWER(c.full_name) LIKE '%' || $1 || '%' OR COALESCE(c.phone, '') LIKE '%' || $1 || '%')
        AND ($2::text IS NULL OR $2 = 'caregiver')
      UNION ALL
      SELECT
        fs.id::text AS id,
        'field_staff' AS provider_type,
        fs.id::text AS provider_id,
        fs.full_name AS display_name,
        fs.phone,
        fs.role,
        fs.team,
        fs.status,
        NULL::text AS source,
        fs.active,
        COALESCE(fc.assignment_count, 0) AS assignment_count,
        COALESCE(fc.linked_users, '[]'::json) AS linked_users,
        NULL::text AS relationship_label,
        fs.created_at,
        fs.updated_at
      FROM public.field_staff fs
      LEFT JOIN field_staff_counts fc ON fc.provider_id = fs.id
      WHERE
        fs.active = true
        AND fs.organization_id = $3
        AND ($1::text IS NULL OR LOWER(fs.full_name) LIKE '%' || $1 || '%' OR LOWER(COALESCE(fs.team, '')) LIKE '%' || $1 || '%' OR COALESCE(fs.phone, '') LIKE '%' || $1 || '%')
        AND ($2::text IS NULL OR $2 = 'field_staff')
      UNION ALL
      SELECT
        lc.id,
        'caregiver' AS provider_type,
        lc.provider_id,
        lc.display_name,
        lc.phone,
        lc.role,
        lc.team,
        lc.status,
        lc.source,
        lc.active,
        lc.assignment_count,
        lc.linked_users,
        lc.relationship_label,
        lc.created_at,
        lc.updated_at
      FROM legacy_caregiver_directory lc
      LEFT JOIN public.care_provider_contacts existing_contact
        ON existing_contact.organization_id::text = lc.legacy_organization_id
        AND (
          (lc.phone_digits IS NOT NULL AND existing_contact.phone_digits = lc.phone_digits)
          OR (
            lc.phone_digits IS NULL
            AND existing_contact.phone_digits IS NULL
            AND LOWER(COALESCE(existing_contact.full_name, '')) = LOWER(lc.display_name)
          )
        )
      WHERE
        existing_contact.id IS NULL
        AND ($1::text IS NULL OR LOWER(lc.display_name) LIKE '%' || $1 || '%' OR COALESCE(lc.phone, '') LIKE '%' || $1 || '%')
        AND ($2::text IS NULL OR $2 = 'caregiver')
      ORDER BY display_name ASC
      LIMIT 100
    `,
    [search, type, organizationId],
  );
  let rows = await queryCareProviderRows();

  if ((type === null || type === "caregiver") && !rows.some((row) => row.provider_type === "caregiver")) {
    const upstream = await requestVyvaBackend("/api/v1/user-dashboard/users");
    const upstreamUsers = [
      upstream?.data?.gisUsers,
      upstream?.data?.users,
      upstream?.data?.clients,
      upstream?.data?.data,
      upstream?.data,
    ].find(Array.isArray) || [];
    const localShadowUsers = await optionalRows(
      `
        SELECT external_user_id::text
        FROM public.vyva_users
        WHERE organization_id = $1
          AND external_user_id IS NOT NULL
        ORDER BY updated_at DESC
        LIMIT 100
      `,
      [organizationId],
    );
    const externalIds = Array.from(new Set([
      ...upstreamUsers.map((user) => nullIfBlank(firstValue(user?.id, user?.external_user_id))),
      ...localShadowUsers.map((user) => nullIfBlank(user?.external_user_id)),
    ].filter(Boolean))).slice(0, 100);

    if (externalIds.length) {
      const client = await pool.connect();
      try {
        let synced = 0;
        for (const externalId of externalIds) {
          try {
            const result = await ensureLocalUserForAssignmentWithClient(client, externalId, context);
            if (result?.value) synced += 1;
          } catch (error) {
            console.warn("Unable to sync caregiver directory for external user:", externalId, error instanceof Error ? error.message : error);
          }
        }
        if (synced > 0) {
          rows = await queryCareProviderRows();
        }
      } finally {
        client.release();
      }
    }
  }

  return rows.map(careProviderAssignmentRow);
}

async function upsertCareProviderContactWithClient(client, payload, organizationId) {
  const caregiver = normalizeCaregiverPayload(payload);
  if (caregiver.error) return caregiver;

  const fullName = caregiver.value.caretaker_name || "Care contact";
  const phone = caregiver.value.caretaker_phone;
  const digits = phoneDigits(phone);
  const source = normalizeContactSource(caregiver.value.source);

  if (digits) {
    const existing = await client.query(
      "SELECT id::text FROM public.care_provider_contacts WHERE organization_id = $1 AND phone_digits = $2 LIMIT 1",
      [organizationId, digits],
    );
    if (existing.rows[0]) {
      const result = await client.query(
        `
          UPDATE public.care_provider_contacts
          SET
            full_name = $2,
            phone = COALESCE($3, phone),
            phone_digits = $4,
            source = CASE
              WHEN public.care_provider_contacts.source = 'manual' THEN $5
              ELSE public.care_provider_contacts.source
            END,
            active = true,
            updated_at = now()
          WHERE id = $1
          RETURNING id::text, full_name, phone, phone_digits, source
        `,
        [existing.rows[0].id, fullName, phone, digits, source],
      );
      return { value: result.rows[0] };
    }
  }

  const result = await client.query(
    `
      INSERT INTO public.care_provider_contacts (organization_id, full_name, phone, phone_digits, source)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id::text, full_name, phone, phone_digits, source
    `,
    [organizationId, fullName, phone, digits, source],
  );
  return { value: result.rows[0] };
}

async function createCareProviderContact(payload, context) {
  const organizationId = scopeOrganizationId(context);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const contact = await upsertCareProviderContactWithClient(client, payload, organizationId);
    if (contact.error) {
      await client.query("ROLLBACK");
      return contact;
    }

    const result = await client.query(
      `
        SELECT
          c.id::text AS id,
          'caregiver' AS provider_type,
          c.id::text AS provider_id,
          c.full_name AS display_name,
          c.phone,
          NULL::text AS role,
          NULL::text AS team,
          CASE WHEN c.active THEN 'active' ELSE 'inactive' END AS status,
          c.source,
          c.active,
          0::int AS assignment_count,
          '[]'::json AS linked_users,
          c.created_at,
          c.updated_at
        FROM public.care_provider_contacts c
        WHERE c.id = $1 AND c.organization_id = $2
        LIMIT 1
      `,
      [contact.value.id, organizationId],
    );
    await client.query("COMMIT");
    return result.rows[0] ? { value: careProviderAssignmentRow(result.rows[0]) } : { notFound: true };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function shouldMakePrimaryWithClient(client, userId, providerType, requestedPrimary) {
  if (requestedPrimary !== undefined) return Boolean(requestedPrimary);
  const existing = await client.query(
    `
      SELECT id::text
      FROM public.vyva_user_care_provider_assignments
      WHERE vyva_user_id = $1 AND provider_type = $2 AND is_primary = true
      LIMIT 1
    `,
    [userId, providerType],
  );
  return !existing.rows[0];
}

async function assignCareProviderWithClient(client, userId, payload, organizationId) {
  const providerType = normalizeCareProviderType(firstValue(payload?.provider_type, payload?.type));
  const providerPayload = objectValue(firstValue(payload?.provider, payload?.caregiver, payload?.contact));
  const relationshipLabel = nullIfBlank(firstValue(payload?.relationship_label, payload?.relationship, payload?.role));
  const notes = nullIfBlank(payload?.notes);
  const requestedPrimary = optionalBooleanValue(payload?.is_primary, payload?.primary);
  const makePrimary = await shouldMakePrimaryWithClient(client, userId, providerType, requestedPrimary);

  let result;
  if (providerType === "field_staff") {
    const fieldStaffId = nullIfBlank(firstValue(payload?.field_staff_id, payload?.provider_id, providerPayload.id));
    if (!fieldStaffId) return { error: "Choose a Red Cross staff member" };

    const staff = await client.query(
      "SELECT id::text FROM public.field_staff WHERE id = $1 AND organization_id = $2 AND active = true LIMIT 1",
      [fieldStaffId, organizationId],
    );
    if (!staff.rows[0]) return { error: "Red Cross staff member is not available" };

    if (makePrimary) {
      await client.query(
        "UPDATE public.vyva_user_care_provider_assignments SET is_primary = false WHERE vyva_user_id = $1 AND provider_type = 'field_staff'",
        [userId],
      );
    }

    result = await client.query(
      `
        INSERT INTO public.vyva_user_care_provider_assignments (
          vyva_user_id,
          provider_type,
          field_staff_id,
          is_primary,
          relationship_label,
          notes
        )
        VALUES ($1, 'field_staff', $2, $3, $4, $5)
        ON CONFLICT (vyva_user_id, field_staff_id) WHERE provider_type = 'field_staff' AND field_staff_id IS NOT NULL
        DO UPDATE SET
          is_primary = EXCLUDED.is_primary,
          relationship_label = COALESCE(EXCLUDED.relationship_label, public.vyva_user_care_provider_assignments.relationship_label),
          notes = COALESCE(EXCLUDED.notes, public.vyva_user_care_provider_assignments.notes),
          updated_at = now()
        RETURNING id::text
      `,
      [userId, fieldStaffId, makePrimary, relationshipLabel, notes],
    );
  } else {
    const existingContactId = nullIfBlank(firstValue(payload?.care_provider_contact_id, payload?.provider_id, providerPayload.id));
    let contact;
    if (existingContactId) {
      const contactResult = await client.query(
        "SELECT id::text FROM public.care_provider_contacts WHERE id = $1 AND organization_id = $2 AND active = true LIMIT 1",
        [existingContactId, organizationId],
      );
      if (!contactResult.rows[0]) return { error: "Emergency contact is not available" };
      contact = contactResult.rows[0];
    } else {
      const contactResult = await upsertCareProviderContactWithClient(client, {
        ...providerPayload,
        ...payload,
      }, organizationId);
      if (contactResult.error) return contactResult;
      contact = contactResult.value;
    }

    if (makePrimary) {
      await client.query(
        "UPDATE public.vyva_user_care_provider_assignments SET is_primary = false WHERE vyva_user_id = $1 AND provider_type = 'caregiver'",
        [userId],
      );
    }

    result = await client.query(
      `
        INSERT INTO public.vyva_user_care_provider_assignments (
          vyva_user_id,
          provider_type,
          care_provider_contact_id,
          is_primary,
          relationship_label,
          notes
        )
        VALUES ($1, 'caregiver', $2, $3, $4, $5)
        ON CONFLICT (vyva_user_id, care_provider_contact_id) WHERE provider_type = 'caregiver' AND care_provider_contact_id IS NOT NULL
        DO UPDATE SET
          is_primary = EXCLUDED.is_primary,
          relationship_label = COALESCE(EXCLUDED.relationship_label, public.vyva_user_care_provider_assignments.relationship_label),
          notes = COALESCE(EXCLUDED.notes, public.vyva_user_care_provider_assignments.notes),
          updated_at = now()
        RETURNING id::text
      `,
      [userId, contact.id, makePrimary, relationshipLabel, notes],
    );
  }

  const assignment = await loadCareProviderAssignmentByIdWithClient(client, result.rows[0].id, organizationId);
  return assignment ? { value: assignment } : { notFound: true };
}

async function assignCareProvider(userId, payload, context) {
  const organizationId = scopeOrganizationId(context);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const resolvedUser = await ensureLocalUserForAssignmentWithClient(client, userId, context);
    if (resolvedUser.error || resolvedUser.notFound) {
      await client.query("ROLLBACK");
      return resolvedUser;
    }

    const result = await assignCareProviderWithClient(client, resolvedUser.value, payload, organizationId);
    if (result.error || result.notFound) {
      await client.query("ROLLBACK");
      return result;
    }
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function updateCareProviderAssignment(assignmentId, payload, context) {
  const organizationId = scopeOrganizationId(context);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const existing = await client.query(
      `
        SELECT
          a.id::text,
          a.vyva_user_id::text,
          a.provider_type,
          a.care_provider_contact_id::text,
          a.field_staff_id::text
        FROM public.vyva_user_care_provider_assignments a
        JOIN public.vyva_users u ON u.id = a.vyva_user_id
        WHERE a.id = $1
          AND u.organization_id = $2
        LIMIT 1
      `,
      [assignmentId, organizationId],
    );
    const assignment = existing.rows[0];
    if (!assignment) {
      await client.query("ROLLBACK");
      return { notFound: true };
    }

    let contactId = assignment.care_provider_contact_id;
    if (assignment.provider_type === "caregiver" && hasMeaningfulPayloadValue(payload)) {
      const hasContactEdit = [
        payload?.caretaker_name,
        payload?.caregiver_name,
        payload?.name,
        payload?.full_name,
        payload?.fullName,
        payload?.caretaker_phone,
        payload?.caregiver_phone,
        payload?.phone,
        payload?.phone_number,
        payload?.phoneNumber,
      ].some((value) => nullIfBlank(value));

      if (hasContactEdit) {
        const contact = await upsertCareProviderContactWithClient(client, payload, organizationId);
        if (contact.error) {
          await client.query("ROLLBACK");
          return contact;
        }
        contactId = contact.value.id;
      }
    }

    const requestedPrimary = optionalBooleanValue(payload?.is_primary, payload?.primary);
    if (requestedPrimary === true) {
      await client.query(
        "UPDATE public.vyva_user_care_provider_assignments SET is_primary = false WHERE vyva_user_id = $1 AND provider_type = $2",
        [assignment.vyva_user_id, assignment.provider_type],
      );
    }

    const result = await client.query(
      `
        UPDATE public.vyva_user_care_provider_assignments
        SET
          care_provider_contact_id = CASE WHEN provider_type = 'caregiver' THEN $2::uuid ELSE care_provider_contact_id END,
          is_primary = COALESCE($3, is_primary),
          relationship_label = COALESCE($4, relationship_label),
          notes = COALESCE($5, notes),
          updated_at = now()
        WHERE id = $1
        RETURNING id::text
      `,
      [
        assignmentId,
        contactId,
        requestedPrimary === undefined ? null : requestedPrimary,
        nullIfBlank(firstValue(payload?.relationship_label, payload?.relationship)),
        nullIfBlank(payload?.notes),
      ],
    );

    const updated = await loadCareProviderAssignmentByIdWithClient(client, result.rows[0].id, organizationId);
    await client.query("COMMIT");
    return updated ? { value: updated } : { notFound: true };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function deleteCareProviderAssignment(assignmentId, context) {
  const organizationId = scopeOrganizationId(context);
  const result = await query(
    `
      DELETE FROM public.vyva_user_care_provider_assignments a
      USING public.vyva_users u
      WHERE a.id = $1
        AND u.id = a.vyva_user_id
        AND u.organization_id = $2
      RETURNING a.id::text
    `,
    [assignmentId, organizationId],
  );
  return result.rows[0] ? { value: result.rows[0] } : { notFound: true };
}

function compatibilityCaregiverRow(assignment) {
  return {
    id: assignment.id,
    assignment_id: assignment.id,
    care_provider_contact_id: assignment.provider_id,
    caretaker_name: assignment.display_name,
    caretaker_phone: assignment.phone,
    is_primary: assignment.is_primary,
    relationship_label: assignment.relationship_label,
    notes: assignment.notes,
    source: assignment.source || null,
    created_at: assignment.created_at,
    updated_at: assignment.updated_at,
  };
}

async function replaceCaregiversWithClient(client, userId, caregivers, organizationId) {
  await client.query(
    "DELETE FROM public.vyva_user_care_provider_assignments WHERE vyva_user_id = $1 AND provider_type = 'caregiver'",
    [userId],
  );
  for (const [index, caregiver] of caregivers.entries()) {
    await assignCareProviderWithClient(client, userId, {
      provider_type: "caregiver",
      provider: caregiver,
      is_primary: index === 0,
      relationship_label: caregiver.relationship_label || "Caregiver",
      source: caregiver.source || "manual",
    }, organizationId);
  }
}

async function replaceMedicationsWithClient(client, userId, medications) {
  await client.query("DELETE FROM public.vyva_user_medications WHERE vyva_user_id = $1", [userId]);
  for (const medication of medications) {
    await client.query(
      `
        INSERT INTO public.vyva_user_medications (vyva_user_id, medication_name, purpose, dosage, frequency, reminders_enabled, schedule_times)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `,
      [
        userId,
        medication.medication_name,
        medication.purpose,
        medication.dosage,
        medication.frequency,
        medication.reminders_enabled ?? true,
        medication.schedule_times,
      ],
    );
  }
}

async function upsertServiceWithClient(client, table, userId, config) {
  const existing = await client.query(`SELECT id::text FROM public.${table} WHERE vyva_user_id = $1 LIMIT 1`, [userId]);
  if (existing.rows[0]) {
    await client.query(
      `
        UPDATE public.${table}
        SET
          enabled = $2,
          frequency = $3,
          preferred_time = $4,
          paused_until = CASE WHEN $5 THEN $6::timestamptz ELSE paused_until END,
          pause_reason = CASE WHEN $5 THEN $7 ELSE pause_reason END,
          pause_source = CASE WHEN $5 THEN $8 ELSE pause_source END,
          updated_at = now()
        WHERE id = $1
      `,
      [
        existing.rows[0].id,
        config.enabled,
        config.frequency,
        config.preferred_time,
        config.pause_present,
        config.paused_until,
        config.pause_reason,
        config.pause_source,
      ],
    );
    return;
  }

  await client.query(
    `
      INSERT INTO public.${table} (vyva_user_id, enabled, frequency, preferred_time, paused_until, pause_reason, pause_source)
      VALUES ($1, $2, $3, $4, $5::timestamptz, $6, $7)
    `,
    [
      userId,
      config.enabled,
      config.frequency,
      config.preferred_time,
      config.pause_present ? config.paused_until : null,
      config.pause_present ? config.pause_reason : null,
      config.pause_present ? config.pause_source : null,
    ],
  );
}

async function syncCareProfileWithClient(client, userId, careProfile, organizationId) {
  if (careProfile.healthPresent && (hasMeaningfulPayloadValue(careProfile.health) || careProfile.health)) {
    await upsertHealthWithClient(client, userId, careProfile.health);
  }
  if (careProfile.consentPresent && careProfile.consent) {
    await upsertConsentWithClient(client, userId, careProfile.consent);
  }
  if (careProfile.caregivers) {
    await replaceCaregiversWithClient(client, userId, careProfile.caregivers, organizationId);
  }
  if (careProfile.medications) {
    await replaceMedicationsWithClient(client, userId, careProfile.medications);
  }
  if (careProfile.checkinsPresent && careProfile.checkins) {
    await upsertServiceWithClient(client, "vyva_user_checkins", userId, careProfile.checkins);
  }
  if (careProfile.brainCoachPresent && careProfile.brainCoach) {
    await upsertServiceWithClient(client, "vyva_user_brain_coach", userId, careProfile.brainCoach);
  }
}

async function createDashboardUser(payload, context) {
  requireAdmin(context);
  const organizationId = scopeOrganizationId(context);
  const user = normalizeUserPayload(payload, true, context.organization);
  if (user.error) return user;

  const careProfile = normalizeCareProfilePayload(payload, true);
  if (careProfile.error) return careProfile;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      `
        INSERT INTO public.vyva_users (
          organization_id,
          first_name,
          last_name,
          phone,
          city,
          street,
          house_number,
          post_code,
          country,
          timezone,
          date_of_birth,
          gender,
          language,
          living_context,
          emergency_notes
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        RETURNING *, id::text
      `,
      [
        organizationId,
        user.value.first_name,
        user.value.last_name,
        user.value.phone,
        user.value.city,
        user.value.street,
        user.value.house_number,
        user.value.post_code,
        user.value.country,
        user.value.timezone,
        user.value.date_of_birth,
        user.value.gender,
        user.value.language,
        user.value.living_context,
        user.value.emergency_notes,
      ],
    );
    const createdUser = result.rows[0];

    await syncCareProfileWithClient(client, createdUser.id, careProfile.value, organizationId);

    await client.query("COMMIT");
    return { value: createdUser };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function updateDashboardUser(userId, payload, context) {
  requireAdmin(context);
  const organizationId = scopeOrganizationId(context);
  const user = normalizeUserPayload(payload, false, context.organization);
  if (user.error) return user;

  const careProfile = normalizeCareProfilePayload(payload);
  if (careProfile.error) return careProfile;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      `
        UPDATE public.vyva_users
        SET
          first_name = $2,
          last_name = $3,
          phone = $4,
          city = $5,
          street = $6,
          house_number = $7,
          post_code = $8,
          date_of_birth = $9,
          gender = $10,
          language = $11,
          living_context = $12,
          emergency_notes = $13,
          updated_at = now()
        WHERE id = $1 AND organization_id = $14
        RETURNING *, id::text
      `,
      [
        userId,
        user.value.first_name,
        user.value.last_name,
        user.value.phone,
        user.value.city,
        user.value.street,
        user.value.house_number,
        user.value.post_code,
        user.value.date_of_birth,
        user.value.gender,
        user.value.language,
        user.value.living_context,
        user.value.emergency_notes,
        organizationId,
      ],
    );

    if (!result.rows[0]) {
      await client.query("ROLLBACK");
      return { notFound: true };
    }

    await syncCareProfileWithClient(client, userId, careProfile.value, organizationId);
    await client.query("COMMIT");
    return { value: result.rows[0] };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function appendDashboardUserNote(userId, payload, context) {
  const organizationId = scopeOrganizationId(context);
  const note = nullIfBlank(firstValue(payload?.note, payload?.text));
  if (!note) return { error: "note is required" };

  const author = nullIfBlank(context?.email);
  const timestamp = new Date().toISOString();
  const entry = `[${timestamp}${author ? ` - ${author}` : ""}] ${note}`;
  const result = await query(
    `
      UPDATE public.vyva_users
      SET
        emergency_notes = CASE
          WHEN emergency_notes IS NULL OR btrim(emergency_notes) = '' THEN $3
          ELSE emergency_notes || E'\n\n' || $3
        END,
        updated_at = now()
      WHERE id = $1 AND organization_id = $2
      RETURNING *, id::text
    `,
    [userId, organizationId, entry],
  );

  if (!result.rows[0]) return { notFound: true };
  return { value: result.rows[0] };
}

function normalizeSensorPayload(payload, creating = false) {
  const sensorType = nullIfBlank(firstValue(payload?.sensor_type, payload?.sensorType, payload?.type));
  const deviceId = nullIfBlank(firstValue(payload?.device_id, payload?.deviceId));
  if (!sensorType) return { error: "sensor_type is required" };
  if (!deviceId) return { error: "device_id is required" };

  const integrationMethod = nullIfBlank(firstValue(payload?.integration_method, payload?.integrationMethod)) || "manual";
  const integrationConfig = objectValue(firstValue(payload?.integration_config, payload?.integrationConfig)) || {};
  const statusValue = String(firstValue(payload?.status, payload?.state) || "").toLowerCase();
  const status = statusValue === "online" ? "online" : "offline";

  return {
    value: {
      vyva_user_id: nullIfBlank(firstValue(payload?.vyva_user_id, payload?.vyvaUserId, payload?.user_id, payload?.userId)),
      sensor_type: sensorType,
      device_id: deviceId,
      device_name: nullIfBlank(firstValue(payload?.device_name, payload?.deviceName)),
      integration_method: integrationMethod,
      integration_config: integrationConfig,
      status,
      notes: nullIfBlank(payload?.notes),
    },
    error: creating && !nullIfBlank(firstValue(payload?.vyva_user_id, payload?.vyvaUserId, payload?.user_id, payload?.userId))
      ? "vyva_user_id is required"
      : null,
  };
}

async function createSensor(payload, context) {
  requireAdmin(context);
  const sensor = normalizeSensorPayload(payload, true);
  if (sensor.error) return sensor;

  const user = await ensureLocalUserForAssignmentWithClient({ query }, sensor.value.vyva_user_id, context);
  if (user.error) return user;
  if (user.notFound) return { notFound: true };

  const result = await query(
    `
      INSERT INTO public.vyva_user_sensors (
        vyva_user_id,
        sensor_type,
        device_id,
        device_name,
        integration_method,
        integration_config,
        status,
        notes
      )
      VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)
      RETURNING *, id::text, vyva_user_id::text
    `,
    [
      user.value,
      sensor.value.sensor_type,
      sensor.value.device_id,
      sensor.value.device_name,
      sensor.value.integration_method,
      JSON.stringify(sensor.value.integration_config),
      sensor.value.status,
      sensor.value.notes,
    ],
  );

  return { value: { sensor: result.rows[0] } };
}

async function updateSensor(sensorId, payload, context) {
  requireAdmin(context);
  if (!isUuid(sensorId)) return { notFound: true };
  const organizationId = scopeOrganizationId(context);
  const sensor = normalizeSensorPayload(payload);
  if (sensor.error) return sensor;

  const result = await query(
    `
      UPDATE public.vyva_user_sensors s
      SET
        sensor_type = $2,
        device_id = $3,
        device_name = $4,
        integration_method = $5,
        integration_config = $6::jsonb,
        status = $7,
        notes = $8,
        updated_at = now()
      FROM public.vyva_users u
      WHERE s.id = $1
        AND u.id = s.vyva_user_id
        AND u.organization_id = $9
      RETURNING s.*, s.id::text, s.vyva_user_id::text
    `,
    [
      sensorId,
      sensor.value.sensor_type,
      sensor.value.device_id,
      sensor.value.device_name,
      sensor.value.integration_method,
      JSON.stringify(sensor.value.integration_config),
      sensor.value.status,
      sensor.value.notes,
      organizationId,
    ],
  );

  if (!result.rows[0]) return { notFound: true };
  return { value: { sensor: result.rows[0] } };
}

function normalizeMedicationPayload(payload, creating = false) {
  const medicationName = nullIfBlank(firstValue(payload?.medication_name, payload?.medicationName, payload?.name));
  if (!medicationName) return { error: "medication_name is required" };

  return {
    value: {
      vyva_user_id: nullIfBlank(firstValue(payload?.vyva_user_id, payload?.user_id, payload?.userId)),
      medication_name: medicationName,
      purpose: nullIfBlank(firstValue(payload?.purpose, payload?.reason)),
      dosage: nullIfBlank(payload?.dosage),
      frequency: nullIfBlank(firstValue(payload?.frequency, payload?.cadence, payload?.repeat)),
      reminders_enabled: optionalBooleanValue(payload?.reminders_enabled, payload?.remindersEnabled, payload?.enabled, payload?.active) ?? true,
      schedule_times: normalizeStringArray(firstValue(payload?.schedule_times, payload?.scheduleTimes, payload?.times)),
    },
    error: creating && !nullIfBlank(firstValue(payload?.vyva_user_id, payload?.user_id, payload?.userId)) ? "vyva_user_id is required" : null,
  };
}

async function createMedication(payload, context) {
  const medication = normalizeMedicationPayload(payload, true);
  if (medication.error) return medication;
  if (!(await userBelongsToOrganization(medication.value.vyva_user_id, context))) return { notFound: true };
  await requireCarePlanAccess(medication.value.vyva_user_id, context);

  const result = await query(
    `
      INSERT INTO public.vyva_user_medications (vyva_user_id, medication_name, purpose, dosage, frequency, reminders_enabled, schedule_times)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *, id::text, vyva_user_id::text
    `,
    [
      medication.value.vyva_user_id,
      medication.value.medication_name,
      medication.value.purpose,
      medication.value.dosage,
      medication.value.frequency,
      medication.value.reminders_enabled,
      medication.value.schedule_times,
    ],
  );

  return { value: result.rows[0] };
}

async function updateMedication(medicationId, payload, context) {
  const organizationId = scopeOrganizationId(context);
  const medication = normalizeMedicationPayload(payload);
  if (medication.error) return medication;
  const existing = await query(
    `
      SELECT m.vyva_user_id::text AS user_id
      FROM public.vyva_user_medications m
      JOIN public.vyva_users u ON u.id = m.vyva_user_id
      WHERE m.id = $1
        AND u.organization_id = $2
      LIMIT 1
    `,
    [medicationId, organizationId],
  );
  if (!existing.rows[0]) return { notFound: true };
  await requireCarePlanAccess(existing.rows[0].user_id, context);

  const result = await query(
    `
      UPDATE public.vyva_user_medications m
      SET medication_name = $2, purpose = $3, dosage = $4, frequency = $5, reminders_enabled = $6, schedule_times = $7, updated_at = now()
      FROM public.vyva_users u
      WHERE m.id = $1
        AND u.id = m.vyva_user_id
        AND u.organization_id = $8
      RETURNING m.*, m.id::text, m.vyva_user_id::text
    `,
    [
      medicationId,
      medication.value.medication_name,
      medication.value.purpose,
      medication.value.dosage,
      medication.value.frequency,
      medication.value.reminders_enabled,
      medication.value.schedule_times,
      organizationId,
    ],
  );

  if (!result.rows[0]) return { notFound: true };
  return { value: result.rows[0] };
}

async function deleteMedication(medicationId, context) {
  const organizationId = scopeOrganizationId(context);
  const existing = await query(
    `
      SELECT m.vyva_user_id::text AS user_id
      FROM public.vyva_user_medications m
      JOIN public.vyva_users u ON u.id = m.vyva_user_id
      WHERE m.id = $1
        AND u.organization_id = $2
      LIMIT 1
    `,
    [medicationId, organizationId],
  );
  if (!existing.rows[0]) return { notFound: true };
  await requireCarePlanAccess(existing.rows[0].user_id, context);

  const result = await query(
    `
      DELETE FROM public.vyva_user_medications m
      USING public.vyva_users u
      WHERE m.id = $1
        AND u.id = m.vyva_user_id
        AND u.organization_id = $2
      RETURNING m.id::text
    `,
    [medicationId, organizationId],
  );
  return result.rows[0] ? { value: result.rows[0] } : { notFound: true };
}

async function requireMedicationRecordAccess(medicationId, context) {
  const organizationId = scopeOrganizationId(context);
  const existing = await query(
    `
      SELECT m.vyva_user_id::text AS user_id
      FROM public.vyva_user_medications m
      JOIN public.vyva_users u ON u.id = m.vyva_user_id
      WHERE m.id = $1
        AND u.organization_id = $2
      LIMIT 1
    `,
    [medicationId, organizationId],
  );
  if (!existing.rows[0]) throw httpError(404, "Medication not found");
  await requireCarePlanAccess(existing.rows[0].user_id, context);
  return existing.rows[0];
}

function normalizeCaregiverPayload(payload, creating = false) {
  const name = nullIfBlank(firstValue(payload?.caretaker_name, payload?.caregiver_name, payload?.name, payload?.full_name, payload?.fullName));
  const phone = nullIfBlank(firstValue(payload?.caretaker_phone, payload?.caregiver_phone, payload?.phone, payload?.phone_number, payload?.phoneNumber));
  const source = normalizeContactSource(payload?.source);
  if (!name && !phone) return { error: "caretaker_name or caretaker_phone is required" };

  return {
    value: {
      vyva_user_id: nullIfBlank(firstValue(payload?.vyva_user_id, payload?.user_id, payload?.userId)),
      caretaker_name: name,
      caretaker_phone: phone,
      source,
    },
    error: creating && !nullIfBlank(firstValue(payload?.vyva_user_id, payload?.user_id, payload?.userId)) ? "vyva_user_id is required" : null,
  };
}

async function createCaregiver(payload, context) {
  const caregiver = normalizeCaregiverPayload(payload, true);
  if (caregiver.error) return caregiver;

  const result = await assignCareProvider(caregiver.value.vyva_user_id, {
    provider_type: "caregiver",
    provider: caregiver.value,
    is_primary: optionalBooleanValue(payload?.is_primary, payload?.primary),
    relationship_label: nullIfBlank(firstValue(payload?.relationship_label, payload?.relationship)) || "Caregiver",
  }, context);
  return result.value ? { value: compatibilityCaregiverRow(result.value) } : result;
}

async function updateCaregiver(caregiverId, payload, context) {
  const caregiver = normalizeCaregiverPayload(payload);
  if (caregiver.error) return caregiver;

  const result = await updateCareProviderAssignment(caregiverId, {
    ...payload,
    caretaker_name: caregiver.value.caretaker_name,
    caretaker_phone: caregiver.value.caretaker_phone,
  }, context);
  return result.value ? { value: compatibilityCaregiverRow(result.value) } : result;
}

async function deleteCaregiver(caregiverId, context) {
  return deleteCareProviderAssignment(caregiverId, context);
}

function normalizeHealthPayload(payload) {
  return {
    value: {
      health_conditions: normalizeStringArray(firstValue(payload?.health_conditions, payload?.healthConditions, payload?.conditions)),
      mobility_needs: normalizeStringArray(firstValue(payload?.mobility_needs, payload?.mobilityNeeds, payload?.mobility)),
    },
  };
}

async function upsertHealth(userId, payload, context) {
  if (!(await userBelongsToOrganization(userId, context))) return { notFound: true };
  const health = normalizeHealthPayload(payload);
  const existing = await query("SELECT id::text FROM public.vyva_user_health WHERE vyva_user_id = $1 LIMIT 1", [userId]);

  if (existing.rows[0]) {
    const result = await query(
      `
        UPDATE public.vyva_user_health
        SET health_conditions = $2, mobility_needs = $3, updated_at = now()
        WHERE id = $1
        RETURNING *, id::text, vyva_user_id::text
      `,
      [existing.rows[0].id, health.value.health_conditions, health.value.mobility_needs],
    );
    return { value: result.rows[0] };
  }

  const result = await query(
    `
      INSERT INTO public.vyva_user_health (vyva_user_id, health_conditions, mobility_needs)
      VALUES ($1, $2, $3)
      RETURNING *, id::text, vyva_user_id::text
    `,
    [userId, health.value.health_conditions, health.value.mobility_needs],
  );
  return { value: result.rows[0] };
}

function normalizeServicePayload(payload) {
  const preferredTime = nullIfBlank(firstValue(payload?.preferred_time, payload?.preferredTime, payload?.time));
  const pauseFieldsPresent =
    hasOwnPayloadKey(payload, "paused_until") ||
    hasOwnPayloadKey(payload, "pausedUntil") ||
    hasOwnPayloadKey(payload, "pause_reason") ||
    hasOwnPayloadKey(payload, "pauseReason") ||
    hasOwnPayloadKey(payload, "pause_source") ||
    hasOwnPayloadKey(payload, "pauseSource");
  const pausedUntilInput = nullIfBlank(firstValue(payload?.paused_until, payload?.pausedUntil));
  let pausedUntil = null;
  if (preferredTime && !/^\d{2}:\d{2}$/.test(preferredTime)) return { error: "preferred_time must be HH:mm" };
  if (pausedUntilInput) {
    const parsed = new Date(pausedUntilInput);
    if (Number.isNaN(parsed.getTime())) return { error: "paused_until must be a valid ISO date" };
    pausedUntil = parsed.toISOString();
  }

  return {
    value: {
      enabled: optionalBooleanValue(payload?.enabled, payload?.is_active, payload?.active) ?? false,
      frequency: nullIfBlank(firstValue(payload?.frequency, payload?.frequency_days, payload?.frequencyDays)),
      preferred_time: preferredTime,
      paused_until: pausedUntil,
      pause_reason: nullIfBlank(firstValue(payload?.pause_reason, payload?.pauseReason)),
      pause_source: nullIfBlank(firstValue(payload?.pause_source, payload?.pauseSource)),
      pause_present: pauseFieldsPresent,
    },
  };
}

async function updateCheckinConfig(checkinId, payload, context) {
  const organizationId = scopeOrganizationId(context);
  const config = normalizeServicePayload(payload);
  if (config.error) return config;

  const existing = await query(
    `
      SELECT c.id::text, c.vyva_user_id::text AS user_id
      FROM public.vyva_user_checkins c
      JOIN public.vyva_users u ON u.id = c.vyva_user_id
      WHERE c.id = $1
        AND u.organization_id = $2
      LIMIT 1
    `,
    [checkinId, organizationId],
  );

  let userId = existing.rows[0]?.user_id || null;
  if (!userId) {
    userId = nullIfBlank(firstValue(payload?.user_id, payload?.userId, payload?.vyva_user_id, payload?.vyvaUserId));
  }
  if (!userId) return { notFound: true };

  await requireCheckinScheduleAccess(userId, context);

  const result = await query(
    `
      INSERT INTO public.vyva_user_checkins (
        vyva_user_id,
        enabled,
        frequency,
        preferred_time,
        paused_until,
        pause_reason,
        pause_source
      )
      VALUES ($1, $2, $3, $4, $5::timestamptz, $6, $7)
      ON CONFLICT (vyva_user_id) DO UPDATE SET
        enabled = EXCLUDED.enabled,
        frequency = EXCLUDED.frequency,
        preferred_time = EXCLUDED.preferred_time,
        paused_until = CASE WHEN $8 THEN EXCLUDED.paused_until ELSE public.vyva_user_checkins.paused_until END,
        pause_reason = CASE WHEN $8 THEN EXCLUDED.pause_reason ELSE public.vyva_user_checkins.pause_reason END,
        pause_source = CASE WHEN $8 THEN EXCLUDED.pause_source ELSE public.vyva_user_checkins.pause_source END,
        updated_at = now()
      RETURNING *, id::text, vyva_user_id::text
    `,
    [
      userId,
      config.value.enabled,
      config.value.frequency,
      config.value.preferred_time,
      config.value.paused_until,
      config.value.pause_reason,
      config.value.pause_source,
      config.value.pause_present,
    ],
  );

  return { value: result.rows[0] };
}

async function upsertBrainCoachConfig(userId, payload, context) {
  if (!(await userBelongsToOrganization(userId, context))) return { notFound: true };
  await requireCheckinScheduleAccess(userId, context);
  const config = normalizeServicePayload(payload);
  if (config.error) return config;

  const existing = await query("SELECT id::text FROM public.vyva_user_brain_coach WHERE vyva_user_id = $1 LIMIT 1", [userId]);
  if (existing.rows[0]) {
    const result = await query(
      `
        UPDATE public.vyva_user_brain_coach
        SET
          enabled = $2,
          frequency = $3,
          preferred_time = $4,
          paused_until = CASE WHEN $5 THEN $6::timestamptz ELSE paused_until END,
          pause_reason = CASE WHEN $5 THEN $7 ELSE pause_reason END,
          pause_source = CASE WHEN $5 THEN $8 ELSE pause_source END,
          updated_at = now()
        WHERE id = $1
        RETURNING *, id::text, vyva_user_id::text
      `,
      [
        existing.rows[0].id,
        config.value.enabled,
        config.value.frequency,
        config.value.preferred_time,
        config.value.pause_present,
        config.value.paused_until,
        config.value.pause_reason,
        config.value.pause_source,
      ],
    );
    return { value: result.rows[0] };
  }

  const result = await query(
    `
      INSERT INTO public.vyva_user_brain_coach (vyva_user_id, enabled, frequency, preferred_time, paused_until, pause_reason, pause_source)
      VALUES ($1, $2, $3, $4, $5::timestamptz, $6, $7)
      RETURNING *, id::text, vyva_user_id::text
    `,
    [
      userId,
      config.value.enabled,
      config.value.frequency,
      config.value.preferred_time,
      config.value.pause_present ? config.value.paused_until : null,
      config.value.pause_present ? config.value.pause_reason : null,
      config.value.pause_present ? config.value.pause_source : null,
    ],
  );
  return { value: result.rows[0] };
}

function normalizeRoutineServiceKey(value) {
  const normalized = normalizeServiceType(value);
  return normalized === "brain_coach" ? "brain_coach" : normalized === "checkin" || normalized === "check_up_call" || normalized === "scheduled_call" ? "checkin" : null;
}

function buildPausedUntilIso(days = 30) {
  const safeDays = Number.isInteger(days) && days > 0 ? days : 30;
  return new Date(Date.now() + safeDays * 24 * 60 * 60 * 1000).toISOString();
}

function routinePauseConsequence(serviceKey, pausedUntil) {
  const label = serviceKey === "brain_coach" ? "Brain Coach sessions" : "routine check-in calls";
  const untilText = pausedUntil ? ` until ${new Date(pausedUntil).toLocaleString("en-GB", { timeZone: "UTC", dateStyle: "medium", timeStyle: "short" })} UTC` : "";
  return `${label} are paused${untilText}. Urgent safety outreach may still continue.`;
}

async function pauseRoutineService(rawUserId, payload, context) {
  const serviceKey = normalizeRoutineServiceKey(firstValue(payload?.service, payload?.service_type));
  if (!serviceKey) return { error: "service is required" };

  const pausedUntil = nullIfBlank(firstValue(payload?.paused_until, payload?.pausedUntil)) || buildPausedUntilIso(Number(payload?.days || 30));
  const pauseConfig = normalizeServicePayload({
    paused_until: pausedUntil,
    pause_reason: firstValue(payload?.pause_reason, payload?.pauseReason) || "Requested by client",
    pause_source: firstValue(payload?.pause_source, payload?.pauseSource) || "voice",
  });
  if (pauseConfig.error) return pauseConfig;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const resolvedUser = await ensureLocalUserForAssignmentWithClient(client, rawUserId, context);
    if (resolvedUser.error || resolvedUser.notFound) {
      await client.query("ROLLBACK");
      return resolvedUser;
    }
    await requireCheckinScheduleAccess(resolvedUser.value, context, client);

    const table = serviceKey === "brain_coach" ? "public.vyva_user_brain_coach" : "public.vyva_user_checkins";
    const existing = await client.query(`SELECT id::text FROM ${table} WHERE vyva_user_id = $1 LIMIT 1`, [resolvedUser.value]);
    if (existing.rows[0]) {
      await client.query(
        `
          UPDATE ${table}
          SET
            paused_until = $2::timestamptz,
            pause_reason = $3,
            pause_source = $4,
            updated_at = now()
          WHERE vyva_user_id = $1
        `,
        [
          resolvedUser.value,
          pauseConfig.value.paused_until,
          pauseConfig.value.pause_reason,
          pauseConfig.value.pause_source,
        ],
      );
    } else {
      await client.query(
        `
          INSERT INTO ${table} (vyva_user_id, enabled, frequency, preferred_time, paused_until, pause_reason, pause_source)
          VALUES ($1, true, NULL, NULL, $2::timestamptz, $3, $4)
        `,
        [
          resolvedUser.value,
          pauseConfig.value.paused_until,
          pauseConfig.value.pause_reason,
          pauseConfig.value.pause_source,
        ],
      );
    }
    await client.query("COMMIT");

    return {
      value: {
        service: serviceKey,
        user_id: resolvedUser.value,
        paused_until: pauseConfig.value.paused_until,
        pause_reason: pauseConfig.value.pause_reason,
        pause_source: pauseConfig.value.pause_source,
        is_paused: true,
        consequence: routinePauseConsequence(serviceKey, pauseConfig.value.paused_until),
      },
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function resumeRoutineService(rawUserId, payload, context) {
  const serviceKey = normalizeRoutineServiceKey(firstValue(payload?.service, payload?.service_type));
  if (!serviceKey) return { error: "service is required" };

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const resolvedUser = await ensureLocalUserForAssignmentWithClient(client, rawUserId, context);
    if (resolvedUser.error || resolvedUser.notFound) {
      await client.query("ROLLBACK");
      return resolvedUser;
    }
    await requireCheckinScheduleAccess(resolvedUser.value, context, client);

    const table = serviceKey === "brain_coach" ? "public.vyva_user_brain_coach" : "public.vyva_user_checkins";
    const existing = await client.query(`SELECT id::text FROM ${table} WHERE vyva_user_id = $1 LIMIT 1`, [resolvedUser.value]);
    if (!existing.rows[0]) {
      await client.query("ROLLBACK");
      return { notFound: true };
    }

    await client.query(
      `
        UPDATE ${table}
        SET paused_until = NULL, pause_reason = NULL, pause_source = NULL, updated_at = now()
        WHERE vyva_user_id = $1
      `,
      [resolvedUser.value],
    );
    await client.query("COMMIT");

    return {
      value: {
        service: serviceKey,
        user_id: resolvedUser.value,
        paused_until: null,
        pause_reason: null,
        pause_source: null,
        is_paused: false,
      },
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

function firstValue(...values) {
  return values.find((value) => value !== undefined && value !== null && String(value).trim() !== "");
}

function objectValue(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function hasMeaningfulPayloadValue(value) {
  if (value === undefined || value === null) return false;
  if (Array.isArray(value)) return value.some(hasMeaningfulPayloadValue);
  if (typeof value === "object") return Object.values(value).some(hasMeaningfulPayloadValue);
  if (typeof value === "boolean") return value;
  return String(value).trim() !== "";
}

function normalizeLanguage(value, fallback = "de") {
  const language = nullIfBlank(value)?.toLowerCase().slice(0, 2);
  return ["en", "de", "es"].includes(language) ? language : fallback;
}

function normalizeDateValue(value) {
  const text = nullIfBlank(value);
  if (!text) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

function normalizeTimestampValue(value) {
  const text = nullIfBlank(value);
  if (!text) return null;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function normalizeInteger(value) {
  if (value === undefined || value === null || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.round(numeric) : null;
}

function normalizeStringArray(value) {
  if (Array.isArray(value)) return value.map(nullIfBlank).filter(Boolean);
  const text = nullIfBlank(value);
  return text ? text.split(",").map((item) => item.trim()).filter(Boolean) : [];
}

function normalizeBooleanValue(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value > 0;
  const text = nullIfBlank(value)?.toLowerCase();
  if (["true", "yes", "y", "1", "consented", "active", "enabled"].includes(text)) return true;
  if (["false", "no", "n", "0", "declined", "inactive", "disabled"].includes(text)) return false;
  return false;
}

function optionalBooleanValue(...values) {
  const raw = firstValue(...values);
  return raw === undefined ? undefined : normalizeBooleanValue(raw);
}

function splitName(fullName) {
  const text = nullIfBlank(fullName);
  if (!text) return {};
  const parts = text.split(/\s+/);
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" ") || "User",
  };
}

function phoneDigits(value) {
  return nullIfBlank(value)?.replace(/\D/g, "") || null;
}

function inferOrganizationSlugFromPhone(value) {
  const digits = phoneDigits(value);
  if (!digits) return null;
  if (digits.startsWith("34") || digits.startsWith("0034")) return "red-cross-zamora";
  if (digits.startsWith("49") || digits.startsWith("0049")) return "red-cross-leipzig";
  return null;
}

function onboardingSecret() {
  return process.env.ONBOARDING_API_KEY || process.env.WEBHOOK_API_KEY || process.env.LOVABLE_API_KEY;
}

function onboardingAuthorized(req) {
  const secret = onboardingSecret();
  if (!secret) return !isProduction;

  const authorization = req.get("authorization") || "";
  const bearer = authorization.toLowerCase().startsWith("bearer ") ? authorization.slice(7).trim() : null;
  const apiKey = req.get("x-api-key") || req.get("x-webhook-secret") || req.query.token;
  return [bearer, apiKey].includes(secret);
}

function normalizePhoneRegistrationPayload(payload = {}) {
  const source = {
    ...payload,
    ...objectValue(payload.data),
    ...objectValue(payload.user),
    ...objectValue(payload.user_data),
    ...objectValue(payload.userData),
    ...objectValue(payload.registration),
    ...objectValue(payload.profile),
    ...objectValue(payload.customer),
    ...objectValue(payload.contact),
    ...objectValue(payload.caller),
    ...objectValue(payload.participant),
    ...objectValue(payload.fields),
  };
  const fullName = firstValue(source.full_name, source.fullName, source.name, source.display_name, source.displayName);
  const parsedName = splitName(fullName);
  const phone = firstValue(
    source.phone,
    source.phone_number,
    source.phoneNumber,
    source.mobile,
    source.msisdn,
    source.whatsapp,
    source.whatsapp_phone,
    source.From,
  );
  const dateOfBirth = normalizeDateValue(firstValue(source.date_of_birth, source.dateOfBirth, source.dob, source.birthdate));
  const conversationId = nullIfBlank(firstValue(
    source.conversation_id,
    source.conversationId,
    source.conversationID,
    source.call_id,
    source.callId,
    source.session_id,
    source.sessionId,
  ));

  if (!phone && !conversationId) return { error: "phone or conversation_id is required" };

  return {
    value: {
      first_name: nullIfBlank(firstValue(source.first_name, source.firstName, source.given_name)) || parsedName.firstName || "Unknown",
      last_name: nullIfBlank(firstValue(source.last_name, source.lastName, source.family_name, source.surname)) || parsedName.lastName || "User",
      organization_id: nullIfBlank(firstValue(source.organization_id, source.organizationId, source.org_id, source.orgId)),
      organization_slug: nullIfBlank(firstValue(source.organization_slug, source.organizationSlug, source.org_slug, source.orgSlug, source.org)),
      organization_name: nullIfBlank(firstValue(source.organization_name, source.organizationName)),
      phone: nullIfBlank(phone),
      city: nullIfBlank(firstValue(source.city, source.town, source.locality)),
      street: nullIfBlank(firstValue(source.street, source.address_street, source.addressLine1)),
      house_number: nullIfBlank(firstValue(source.house_number, source.houseNumber, source.house_no, source.houseNo)),
      post_code: nullIfBlank(firstValue(source.post_code, source.postCode, source.postal_code, source.zip)),
      country: nullIfBlank(firstValue(source.country, source.country_code, source.countryCode)),
      timezone: nullIfBlank(source.timezone),
      date_of_birth: dateOfBirth,
      gender: nullIfBlank(source.gender),
      language: normalizeLanguage(firstValue(source.language, source.lang, source.locale), null),
      emergency_notes: nullIfBlank(firstValue(source.emergency_notes, source.emergencyNotes, source.notes, source.summary)),
      conversation_id: conversationId,
      transcript: nullIfBlank(firstValue(source.transcript, source.call_transcript, source.callTranscript)),
      call_duration: normalizeInteger(firstValue(source.call_duration, source.callDuration, source.duration, source.duration_seconds)),
      call_timestamp: normalizeTimestampValue(firstValue(source.call_timestamp, source.callTimestamp, source.created_at, source.createdAt)),
      consent: firstValue(payload.consent, source.consent),
      health: firstValue(payload.health, source.health),
      caregivers: firstValue(payload.caregivers, payload.emergency_contacts, source.caregivers, source.emergency_contacts),
      medications: firstValue(payload.medications, source.medications),
      checkins: firstValue(payload.checkins, payload.checkin, source.checkins, source.checkin),
      brainCoach: firstValue(payload.brainCoach, payload.brain_coach, source.brainCoach, source.brain_coach),
    },
  };
}

async function findOnboardingUser(registration) {
  const digits = phoneDigits(registration.phone);
  const result = await query(
    `
      SELECT id::text
      FROM public.vyva_users
      WHERE
        organization_id = $4
        AND (
          ($1::text IS NOT NULL AND conversation_id = $1)
          OR ($2::text IS NOT NULL AND regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g') = $2)
          OR ($3::text IS NOT NULL AND phone = $3)
        )
      ORDER BY updated_at DESC
      LIMIT 1
    `,
    [registration.conversation_id, digits, registration.phone, registration.organization_id],
  );

  return result.rows[0]?.id || null;
}

async function upsertPhoneRegistrationUser(registration) {
  const existingId = await findOnboardingUser(registration);
  const params = [
    registration.organization_id,
    registration.first_name,
    registration.last_name,
    registration.phone,
    registration.city,
    registration.street,
    registration.house_number,
    registration.post_code,
    registration.country,
    registration.timezone,
    registration.date_of_birth,
    registration.gender,
    registration.language,
    registration.emergency_notes,
    registration.conversation_id,
    registration.transcript,
    registration.call_duration,
    registration.call_timestamp,
  ];

  if (!existingId) {
    const result = await query(
      `
        INSERT INTO public.vyva_users (
          organization_id,
          first_name,
          last_name,
          phone,
          city,
          street,
          house_number,
          post_code,
          country,
          timezone,
          date_of_birth,
          gender,
          language,
          emergency_notes,
          conversation_id,
          transcript,
          call_duration,
          call_timestamp
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
        RETURNING *, id::text
      `,
      params,
    );
    return { user: result.rows[0], created: true };
  }

  const result = await query(
    `
      UPDATE public.vyva_users
      SET
        first_name = COALESCE($3, first_name),
        last_name = COALESCE($4, last_name),
        phone = COALESCE($5, phone),
        city = COALESCE($6, city),
        street = COALESCE($7, street),
        house_number = COALESCE($8, house_number),
        post_code = COALESCE($9, post_code),
        country = COALESCE($10, country),
        timezone = COALESCE($11, timezone),
        date_of_birth = COALESCE($12, date_of_birth),
        gender = COALESCE($13, gender),
        language = COALESCE($14, language),
        emergency_notes = COALESCE($15, emergency_notes),
        conversation_id = COALESCE($16, conversation_id),
        transcript = COALESCE($17, transcript),
        call_duration = COALESCE($18, call_duration),
        call_timestamp = COALESCE($19, call_timestamp),
        updated_at = now()
      WHERE id = $1 AND organization_id = $2
      RETURNING *, id::text
    `,
    [existingId, ...params],
  );
  return { user: result.rows[0], created: false };
}

async function upsertOneToOneRecord(table, userId, payload, columns) {
  const source = objectValue(payload);
  if (!Object.keys(source).length) return;

  const values = columns.map((column) => column.value(source));
  if (values.every((value) => value === null || value === undefined || (Array.isArray(value) && value.length === 0))) return;

  const existing = await query(`SELECT id::text FROM public.${table} WHERE vyva_user_id = $1 LIMIT 1`, [userId]);
  const assignments = columns.map((column, index) => `${column.name} = $${index + 2}`).join(", ");
  if (existing.rows[0]) {
    await query(
      `UPDATE public.${table} SET ${assignments}, updated_at = now() WHERE vyva_user_id = $1`,
      [userId, ...values],
    );
    return;
  }

  await query(
    `INSERT INTO public.${table} (vyva_user_id, ${columns.map((column) => column.name).join(", ")}) VALUES ($1, ${columns.map((_, index) => `$${index + 2}`).join(", ")})`,
    [userId, ...values],
  );
}

async function syncOnboardingRelatedData(userId, registration) {
  await upsertOneToOneRecord("vyva_user_consent", userId, registration.consent, [
    { name: "consent_given", value: (source) => optionalBooleanValue(source.consent_given, source.consentGiven, source.user_consent, source.userConsent) },
    { name: "caretaker_consent", value: (source) => optionalBooleanValue(source.caretaker_consent, source.caretakerConsent, source.caregiver_consent, source.caregiverConsent) },
  ]);

  await upsertOneToOneRecord("vyva_user_health", userId, registration.health, [
    { name: "health_conditions", value: (source) => normalizeStringArray(firstValue(source.health_conditions, source.healthConditions, source.conditions)) },
    { name: "mobility_needs", value: (source) => normalizeStringArray(firstValue(source.mobility_needs, source.mobilityNeeds, source.mobility)) },
  ]);

  if (Array.isArray(registration.caregivers)) {
    const caregivers = [];
    for (const caregiver of registration.caregivers.map(objectValue)) {
      const name = nullIfBlank(firstValue(caregiver.caretaker_name, caregiver.name, caregiver.full_name, caregiver.fullName));
      const phone = nullIfBlank(firstValue(caregiver.caretaker_phone, caregiver.phone, caregiver.phone_number, caregiver.phoneNumber));
      if (!name && !phone) continue;
      caregivers.push({ caretaker_name: name, caretaker_phone: phone });
    }
    await replaceCaregiversWithClient({ query }, userId, caregivers, registration.organization_id);
  }

  if (Array.isArray(registration.medications)) {
    await query("DELETE FROM public.vyva_user_medications WHERE vyva_user_id = $1", [userId]);
    for (const medication of registration.medications.map(objectValue)) {
      const name = nullIfBlank(firstValue(medication.medication_name, medication.name, medication.medicationName));
      if (!name) continue;
      await query(
        `
          INSERT INTO public.vyva_user_medications (vyva_user_id, medication_name, purpose, dosage, frequency, reminders_enabled, schedule_times)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `,
        [
          userId,
          name,
          nullIfBlank(firstValue(medication.purpose, medication.reason)),
          nullIfBlank(medication.dosage),
          nullIfBlank(firstValue(medication.frequency, medication.cadence, medication.repeat)),
          optionalBooleanValue(medication.reminders_enabled, medication.remindersEnabled, medication.enabled, medication.active) ?? true,
          normalizeStringArray(firstValue(medication.schedule_times, medication.scheduleTimes, medication.times)),
        ],
      );
    }
  }

  await upsertOneToOneRecord("vyva_user_checkins", userId, registration.checkins, [
    { name: "enabled", value: (source) => optionalBooleanValue(source.enabled, source.is_active, source.active) ?? true },
    { name: "frequency", value: (source) => nullIfBlank(firstValue(source.frequency, source.frequency_days, source.frequencyDays)) },
    { name: "preferred_time", value: (source) => nullIfBlank(firstValue(source.preferred_time, source.preferredTime, source.time)) },
  ]);

  await upsertOneToOneRecord("vyva_user_brain_coach", userId, registration.brainCoach, [
    { name: "enabled", value: (source) => optionalBooleanValue(source.enabled, source.is_active, source.active) ?? true },
    { name: "frequency", value: (source) => nullIfBlank(firstValue(source.frequency, source.frequency_days, source.frequencyDays)) },
    { name: "preferred_time", value: (source) => nullIfBlank(firstValue(source.preferred_time, source.preferredTime, source.time)) },
  ]);
}

async function ingestPhoneRegistration(payload) {
  const normalized = normalizePhoneRegistrationPayload(payload);
  if (normalized.error) return normalized;
  const organization = await resolveOrganizationFromRegistration(normalized.value);
  if (!organization) return { error: "organization is required; send organization_slug, organization_id, country, or a +34/+49 phone number" };
  normalized.value.organization_id = organization.id;
  normalized.value.country = normalized.value.country || organization.country || "Germany";
  normalized.value.timezone = normalized.value.timezone || organization.timezone || "Europe/Berlin";
  normalized.value.language = normalized.value.language || organization.default_language || "de";

  const { user, created } = await upsertPhoneRegistrationUser(normalized.value);
  await syncOnboardingRelatedData(user.id, normalized.value);

  return {
    value: {
      created,
      user_id: user.id,
      user,
    },
  };
}

app.get("/api/health", async (req, res, next) => {
  try {
    if (!pool) {
      res.status(503).json({ ok: false, databaseConfigured: false });
      return;
    }
    if (req.query.deep === "true") await query("SELECT 1");
    res.json({
      ok: true,
      mode: "database",
      databaseConfigured: true,
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/v1/me", asyncRoute(async (req, res) => {
  res.json({ user: publicContext(req.context) });
}));

app.post("/api/v1/auth/magic-link", asyncRoute(async (req, res) => {
  const email = normalizedEmail(req.body?.email);
  if (!isValidEmail(email)) {
    res.status(400).json({ error: "Enter a valid email address" });
    return;
  }

  const loginAccess = await consoleLoginAccess(email);
  if (!loginAccess.allowed) {
    res.json({ sent: true });
    return;
  }

  const sent = await sendConsoleMagicLinkOnce({
    email,
    redirectPath: req.body?.redirectPath,
    language: loginAccess.language,
    origin: requestOrigin(req),
  });

  if (!sent.sent) {
    if (isMagicLinkRateLimitError(sent.error)) {
      res.json({ sent: true, delayed: true, provider: sent.provider });
      return;
    }
    res.status(503).json({ error: sent.error || "Sign-in email could not be sent" });
    return;
  }

  res.json({ sent: true, provider: sent.provider });
}, { auth: "none" }));

app.get("/api/v1/organizations", async (req, res, next) => {
  try {
    let context = null;
    if (pool) {
      try {
        context = await resolveRequestContext(req);
      } catch (error) {
        if (error.status && error.status !== 401) throw error;
      }
    }

    let organizations = fallbackOrganizations;
    if (pool) {
      try {
        const databaseOrganizations = await loadOrganizations({
          includeInactive: Boolean(context?.isPlatformAdmin) && req.query.includeInactive === "true",
        });
        if (databaseOrganizations.length) {
          organizations = context?.isPlatformAdmin
            ? databaseOrganizations
            : context?.organizationId
              ? databaseOrganizations.filter((organization) => organization.id === context.organizationId)
              : databaseOrganizations;
        }
        if (!organizations.length && context?.organization?.id) organizations = [context.organization];
      } catch (error) {
        console.warn("Organization list unavailable:", error instanceof Error ? error.message : "query failed");
      }
    }

    const requestedOrganizationId = req.get("x-organization-id") || req.query.organization_id;
    const currentOrganization =
      organizations.find((organization) => organization.id === requestedOrganizationId || organization.slug === requestedOrganizationId) ||
      context?.organization ||
      organizations.find((organization) => organization.slug === "red-cross-leipzig") ||
      organizations[0] ||
      null;

    res.json({ organizations, currentOrganization });
  } catch (error) {
    next(error);
  }
});

app.post("/api/v1/organizations", asyncRoute(async (req, res) => {
  requirePlatformAdmin(req.context);
  const payload = normalizeOrganizationPayload(req.body, true);
  if (payload.error) {
    res.status(400).json({ error: payload.error });
    return;
  }
  const result = await query(
    `
      INSERT INTO public.organizations (slug, name, country, default_language, timezone, active)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id::text, slug, name, country, default_language, timezone, active, created_at, updated_at
    `,
    [
      payload.value.slug,
      payload.value.name,
      payload.value.country,
      payload.value.default_language,
      payload.value.timezone,
      payload.value.active,
    ],
  );
  res.status(201).json({ organization: organizationRow(result.rows[0]) });
}));

app.patch("/api/v1/organizations/:id", asyncRoute(async (req, res) => {
  requireTargetOrganizationAdmin(req.context, req.params.id);
  const payload = normalizeOrganizationPayload(req.body);
  if (payload.error) {
    res.status(400).json({ error: payload.error });
    return;
  }
  if (!req.context?.isPlatformAdmin) payload.value.active = null;
  const result = await query(
    `
      UPDATE public.organizations
      SET
        name = COALESCE($2, name),
        country = COALESCE($3, country),
        default_language = COALESCE($4, default_language),
        timezone = COALESCE($5, timezone),
        active = COALESCE($6, active),
        updated_at = now()
      WHERE id = $1
      RETURNING id::text, slug, name, country, default_language, timezone, active, created_at, updated_at
    `,
    [
      req.params.id,
      payload.value.name,
      payload.value.country,
      payload.value.default_language,
      payload.value.timezone,
      payload.value.active,
    ],
  );
  if (!result.rows[0]) {
    res.status(404).json({ error: "Organization not found" });
    return;
  }
  res.json({ organization: organizationRow(result.rows[0]) });
}));

app.get("/api/v1/team-members", asyncRoute(async (req, res) => {
  requireAdmin(req.context);
  res.json({ members: await loadTeamMembers(req.context) });
}));

app.post("/api/v1/team-members", asyncRoute(async (req, res) => {
  const result = await createTeamMember(req.body, req.context, { origin: requestOrigin(req) });
  if (result.error) {
    res.status(400).json({ error: result.error });
    return;
  }
  res.status(201).json({
    inviteMode: result.inviteMode,
    inviteEmailSent: result.inviteEmailSent,
    inviteEmailError: result.inviteEmailError,
    guideUrl: result.guideUrl,
    member: result.value,
  });
}));

app.get("/api/v1/user-dashboard/users", async (req, res, next) => {
  try {
    const upstream = await requestVyvaBackend("/api/v1/user-dashboard/users", { query: req.query });
    if (upstream?.ok) {
      let assignmentSummaries = new Map();
      if (pool) {
        try {
          req.context = await resolveRequestContext(req);
          const externalIds = Array.isArray(upstream.data?.gisUsers)
            ? upstream.data.gisUsers.map((user) => user?.id).filter((id) => id !== undefined && id !== null)
            : [];
          assignmentSummaries = await loadExternalAssignmentSummaries(externalIds, req.context);
        } catch (error) {
          if (error.status && error.status !== 401) throw error;
        }
      }
      res.json(normalizeExternalDashboardPayload(upstream.data, assignmentSummaries));
      return;
    }
    if (upstream && upstream.status >= 400 && upstream.status < 500 && upstream.status !== 404) {
      res.status(upstream.status).json(upstream.data);
      return;
    }
    if (!pool) {
      dbUnavailable(res);
      return;
    }
    req.context = await resolveRequestContext(req);
    res.json(await loadDashboardUsers(req.context));
  } catch (error) {
    next(error);
  }
});

app.post("/api/v1/user-dashboard/users", asyncRoute(async (req, res) => {
  const upstream = await requestVyvaBackend("/api/v1/user-dashboard/users", { method: "POST", body: req.body });
  if (upstream?.ok) {
    res.status(upstream.status || 201).json(upstream.data);
    return;
  }
  if (upstream && upstream.status >= 400 && upstream.status < 500 && upstream.status !== 404) {
    res.status(upstream.status).json(upstream.data);
    return;
  }
  const result = await createDashboardUser(req.body, req.context);
  if (result.error) {
    res.status(400).json({ error: result.error });
    return;
  }

  res.status(201).json({ user: result.value });
}));

app.get("/api/v1/user-dashboard/user-info", async (req, res, next) => {
  try {
    const userId = String(req.query.user_id || "");
    if (!userId) {
      res.status(400).json({ error: "user_id is required" });
      return;
    }
    const upstream = await requestVyvaBackend("/api/v1/user-dashboard/user-info", {
      query: {
        ...req.query,
        user_id: userId,
        organization_name: "Red Cross",
      },
    });
    if (upstream?.ok) {
      let careProviders = [];
      let localServices = { checkins: null, brainCoach: null };
      let carePlanAccess = null;
      const scheduledContact = await loadLatestScheduledSessionContact(userId).catch(() => null);
      if (pool) {
        try {
          req.context = await resolveRequestContext(req);
          careProviders = await loadExternalUserCareProviders(userId, req.context);
          localServices = await loadExternalUserLocalServices(userId, req.context);
          carePlanAccess = await loadExternalUserCarePlanAccess(userId, req.context);
        } catch (error) {
          if (error.status && error.status !== 401) throw error;
        }
      }
      res.json(mergeExternalProfileWithLocalAssignments(upstream.data, careProviders, userId, localServices, carePlanAccess, scheduledContact));
      return;
    }
    if (upstream && upstream.status >= 400 && upstream.status < 500 && upstream.status !== 404) {
      res.status(upstream.status).json(upstream.data);
      return;
    }
    if (!pool) {
      res.status(upstream?.status || 404).json(upstream?.data || { error: "User not found" });
      return;
    }
    req.context = await resolveRequestContext(req);
    const data = await loadUserInfo(userId, req.context);
    if (!data) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    const scheduledContact = await loadLatestScheduledSessionContact(userId).catch(() => null);
    res.json(applyScheduledSessionContact(data, latestScheduledContact(
      scheduledContact,
      latestScheduledContactFromServices({
        checkins: data.checkins,
        brainCoach: data.brainCoach,
        medicationActivity: data.medicationActivity,
      }),
    )));
  } catch (error) {
    next(error);
  }
});

async function updateUserRoute(req, res) {
  const upstream = await requestVyvaBackend(`/api/v1/user-dashboard/users/${encodeURIComponent(req.params.id)}`, {
    method: req.method,
    body: req.body,
  });
  if (upstream?.ok) {
    res.json(upstream.data);
    return;
  }
  if (upstream && upstream.status >= 400 && upstream.status < 500 && upstream.status !== 404) {
    res.status(upstream.status).json(upstream.data);
    return;
  }

  const result = await updateDashboardUser(req.params.id, req.body, req.context);
  if (result.error) {
    res.status(400).json({ error: result.error });
    return;
  }
  if (result.notFound) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json({ user: result.value });
}

app.patch("/api/v1/user-dashboard/users/:id", asyncRoute(updateUserRoute));
app.put("/api/v1/user-dashboard/users/:id", asyncRoute(updateUserRoute));

app.post("/api/v1/user-dashboard/users/:id/notes", asyncRoute(async (req, res) => {
  const upstream = await requestVyvaBackend(`/api/v1/user-dashboard/users/${encodeURIComponent(req.params.id)}/notes`, {
    method: "POST",
    body: req.body,
  });
  if (upstream?.ok) {
    res.status(upstream.status || 201).json(upstream.data);
    return;
  }
  if (upstream && upstream.status >= 400 && upstream.status < 500 && upstream.status !== 404) {
    res.status(upstream.status).json(upstream.data);
    return;
  }

  const result = await appendDashboardUserNote(req.params.id, req.body, req.context);
  if (result.error) {
    res.status(400).json({ error: result.error });
    return;
  }
  if (result.notFound) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.status(201).json({ user: result.value });
}));

function sendWriteResult(res, result, okStatus = 200) {
  if (result.error) {
    res.status(400).json({ error: result.error });
    return;
  }
  if (result.notFound) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.status(okStatus).json(result.value);
}

app.get("/api/v1/care-providers", asyncRoute(async (req, res) => {
  res.json({
    providers: await loadCareProviders({
      search: req.query.search,
      type: req.query.type,
    }, req.context),
  });
}));

app.post("/api/v1/care-providers", asyncRoute(async (req, res) => {
  sendWriteResult(res, await createCareProviderContact(req.body, req.context), 201);
}));

app.post("/api/v1/user-dashboard/users/:id/care-providers", asyncRoute(async (req, res) => {
  sendWriteResult(res, await assignCareProvider(req.params.id, req.body, req.context), 201);
}));

app.patch("/api/v1/user-dashboard/care-provider-assignments/:id", asyncRoute(async (req, res) => {
  sendWriteResult(res, await updateCareProviderAssignment(req.params.id, req.body, req.context));
}));

app.delete("/api/v1/user-dashboard/care-provider-assignments/:id", asyncRoute(async (req, res) => {
  sendWriteResult(res, await deleteCareProviderAssignment(req.params.id, req.context));
}));

app.post("/api/v1/user-dashboard/medications", asyncRoute(async (req, res) => {
  if (!req.context?.isAdmin && pool) {
    const userId = nullIfBlank(firstValue(req.body?.vyva_user_id, req.body?.user_id, req.body?.userId));
    if (!userId) throw httpError(400, "vyva_user_id is required");
    await requireCarePlanAccess(userId, req.context);
  }
  const upstream = await requestVyvaBackend("/api/v1/user-dashboard/medications", {
    method: "POST",
    body: req.body,
  });
  if (handleVyvaBackendResponse(res, upstream, 201)) return;

  sendWriteResult(res, await createMedication(req.body, req.context), 201);
}));

app.put("/api/v1/user-dashboard/medications/:med_id", asyncRoute(async (req, res) => {
  if (!req.context?.isAdmin && pool) {
    await requireMedicationRecordAccess(req.params.med_id, req.context);
  }
  const upstream = await requestVyvaBackend(`/api/v1/user-dashboard/medications/${encodeURIComponent(req.params.med_id)}`, {
    method: "PUT",
    body: req.body,
  });
  if (handleVyvaBackendResponse(res, upstream)) return;

  sendWriteResult(res, await updateMedication(req.params.med_id, req.body, req.context));
}));

app.delete("/api/v1/user-dashboard/medications/:med_id", asyncRoute(async (req, res) => {
  if (!req.context?.isAdmin && pool) {
    await requireMedicationRecordAccess(req.params.med_id, req.context);
  }
  const upstream = await requestVyvaBackend(`/api/v1/user-dashboard/medications/${encodeURIComponent(req.params.med_id)}`, {
    method: "DELETE",
  });
  if (handleVyvaBackendResponse(res, upstream, 204)) return;

  sendWriteResult(res, await deleteMedication(req.params.med_id, req.context));
}));

app.post("/api/v1/user-dashboard/caregivers", asyncRoute(async (req, res) => {
  const upstream = await requestVyvaBackend("/api/v1/user-dashboard/caregivers", {
    method: "POST",
    body: req.body,
  });
  if (handleVyvaBackendResponse(res, upstream, 201)) return;

  sendWriteResult(res, await createCaregiver(req.body, req.context), 201);
}));

app.put("/api/v1/user-dashboard/caregivers/:caregiver_id", asyncRoute(async (req, res) => {
  const upstream = await requestVyvaBackend(`/api/v1/user-dashboard/caregivers/${encodeURIComponent(req.params.caregiver_id)}`, {
    method: "PUT",
    body: req.body,
  });
  if (handleVyvaBackendResponse(res, upstream)) return;

  sendWriteResult(res, await updateCaregiver(req.params.caregiver_id, req.body, req.context));
}));

app.delete("/api/v1/user-dashboard/caregivers/:caregiver_id", asyncRoute(async (req, res) => {
  const upstream = await requestVyvaBackend(`/api/v1/user-dashboard/caregivers/${encodeURIComponent(req.params.caregiver_id)}`, {
    method: "DELETE",
  });
  if (handleVyvaBackendResponse(res, upstream, 204)) return;

  sendWriteResult(res, await deleteCaregiver(req.params.caregiver_id, req.context));
}));

app.put("/api/v1/user-dashboard/health/:user_id", asyncRoute(async (req, res) => {
  const upstream = await requestVyvaBackend(`/api/v1/user-dashboard/health/${encodeURIComponent(req.params.user_id)}`, {
    method: "PUT",
    body: req.body,
  });
  if (handleVyvaBackendResponse(res, upstream)) return;

  sendWriteResult(res, await upsertHealth(req.params.user_id, req.body, req.context));
}));

app.put("/api/v1/user-dashboard/checkins/:checkin_id", asyncRoute(async (req, res) => {
  const upstream = await requestVyvaBackend(`/api/v1/user-dashboard/checkins/${encodeURIComponent(req.params.checkin_id)}`, {
    method: "PUT",
    body: req.body,
  });
  if (handleVyvaBackendResponse(res, upstream)) return;

  sendWriteResult(res, await updateCheckinConfig(req.params.checkin_id, req.body, req.context));
}));

app.put("/api/v1/user-dashboard/brain-coach/:user_id", asyncRoute(async (req, res) => {
  const upstream = await requestVyvaBackend(`/api/v1/user-dashboard/brain-coach/${encodeURIComponent(req.params.user_id)}`, {
    method: "PUT",
    body: req.body,
  });
  if (handleVyvaBackendResponse(res, upstream)) return;

  sendWriteResult(res, await upsertBrainCoachConfig(req.params.user_id, req.body, req.context));
}));

app.post("/api/v1/user-dashboard/sensors", asyncRoute(async (req, res) => {
  sendWriteResult(res, await createSensor(req.body, req.context), 201);
}));

app.put("/api/v1/user-dashboard/sensors/:sensor_id", asyncRoute(async (req, res) => {
  sendWriteResult(res, await updateSensor(req.params.sensor_id, req.body, req.context));
}));

app.post("/api/v1/routine-calls/pause", asyncRoute(async (req, res) => {
  sendWriteResult(res, await pauseRoutineService(req.body?.user_id, req.body, req.context));
}));

app.post("/api/v1/routine-calls/resume", asyncRoute(async (req, res) => {
  sendWriteResult(res, await resumeRoutineService(req.body?.user_id, req.body, req.context));
}));

async function phoneRegistrationRoute(req, res) {
  if (!onboardingAuthorized(req)) {
    res.status(401).json({
      error: onboardingSecret()
        ? "Unauthorized"
        : "ONBOARDING_API_KEY is required for phone registration ingestion in production",
    });
    return;
  }

  const result = await ingestPhoneRegistration(req.body);
  if (result.error) {
    res.status(400).json({ error: result.error });
    return;
  }

  res.status(result.value.created ? 201 : 200).json(result.value);
}

app.post("/api/v1/onboarding/phone-registration", asyncRoute(phoneRegistrationRoute, { auth: "none" }));
app.post("/api/v1/webhooks/phone-registration", asyncRoute(phoneRegistrationRoute, { auth: "none" }));

app.get("/api/v1/campaigns-dashboard/campaigns", asyncRoute(async (req, res) => {
  res.json({ campaigns: await loadCampaigns(req.context) });
}));

app.post("/api/v1/campaigns-dashboard/campaigns", asyncRoute(async (req, res) => {
  const validationError = validateCampaignPayload(req.body);
  if (validationError) {
    res.status(400).json({ error: validationError });
    return;
  }

  const templateKey = resolveCampaignTemplateKey(req.body);
  const type = campaignTemplateType(templateKey);
  const status = String(req.body.status || "draft");
  requireCampaignDraftAccess(req.context, status);
  const callSettings = normalizeCampaignCallSettings(req.body);
  const executionType = String(req.body.executionType || req.body.execution_type || "manual");
  const organizationId = scopeOrganizationId(req.context);
  const targetRules = normalizeCampaignTargetRules(req.body.targetRules ?? req.body.target_rules, req.body.city);
  const result = await query(
    `
      INSERT INTO public.campaigns (
        organization_id,
        name,
        objective,
        audience,
        template_key,
        target_rules,
        due_key,
        city,
        owner,
        type,
        status,
        channel,
        scheduled_at,
        call_script,
        call_window_start,
        call_window_end,
        retry_limit,
        execution_type,
        tone
      )
      VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
      RETURNING id::text
    `,
    [
      organizationId,
      String(req.body.name || "").trim(),
      String(req.body.objective || "").trim() || null,
      String(req.body.audience || "").trim() || null,
      templateKey,
      JSON.stringify(targetRules),
      String(req.body.dueKey || "campaigns.due.draft"),
      String(req.body.city || "").trim() || null,
      String(req.body.owner || "").trim() || null,
      type,
      status,
      String(req.body.channel || "phone"),
      callSettings.scheduledAt,
      callSettings.callScript,
      callSettings.callWindowStart,
      callSettings.callWindowEnd,
      callSettings.retryLimit,
      executionType,
      campaignTone(type, status),
    ],
  );

  const campaigns = await loadCampaigns(req.context);
  res.status(201).json({ campaign: campaigns.find((campaign) => campaign.id === result.rows[0]?.id) || null });
}));

app.patch("/api/v1/campaigns-dashboard/campaigns/:id", asyncRoute(async (req, res) => {
  const validationError = validateCampaignPayload(req.body);
  if (validationError) {
    res.status(400).json({ error: validationError });
    return;
  }

  const templateKey = resolveCampaignTemplateKey(req.body);
  const type = campaignTemplateType(templateKey);
  const status = String(req.body.status || "draft");
  requireCampaignDraftAccess(req.context, status);
  const callSettings = normalizeCampaignCallSettings(req.body);
  const executionType = String(req.body.executionType || req.body.execution_type || "manual");
  const organizationId = scopeOrganizationId(req.context);
  const targetRules = normalizeCampaignTargetRules(req.body.targetRules ?? req.body.target_rules, req.body.city);
  const updateResult = await query(
    `
      UPDATE public.campaigns
      SET
        name = $2,
        name_key = NULL,
        objective = $3,
        objective_key = NULL,
        audience = $4,
        audience_key = NULL,
        template_key = $5,
        target_rules = $6::jsonb,
        due_key = $7,
        city = $8,
        owner = $9,
        type = $10,
        status = $11,
        channel = $12,
        scheduled_at = $13,
        call_script = $14,
        call_window_start = $15,
        call_window_end = $16,
        retry_limit = $17,
        execution_type = $18,
        tone = $19
      WHERE id = $1 AND organization_id = $20
      RETURNING id::text
    `,
    [
      req.params.id,
      String(req.body.name || "").trim(),
      String(req.body.objective || "").trim() || null,
      String(req.body.audience || "").trim() || null,
      templateKey,
      JSON.stringify(targetRules),
      String(req.body.dueKey || "campaigns.due.draft"),
      String(req.body.city || "").trim() || null,
      String(req.body.owner || "").trim() || null,
      type,
      status,
      String(req.body.channel || "phone"),
      callSettings.scheduledAt,
      callSettings.callScript,
      callSettings.callWindowStart,
      callSettings.callWindowEnd,
      callSettings.retryLimit,
      executionType,
      campaignTone(type, status),
      organizationId,
    ],
  );
  if (!updateResult.rows[0]) {
    res.status(404).json({ error: "Campaign not found" });
    return;
  }

  await query("DELETE FROM public.campaign_targets WHERE campaign_id = $1 AND organization_id = $2", [req.params.id, organizationId]);
  const campaigns = await loadCampaigns(req.context);
  res.json({ campaign: campaigns.find((campaign) => campaign.id === req.params.id) || null });
}));

app.post("/api/v1/campaigns-dashboard/campaigns/:id/call-runs/preview", asyncRoute(async (req, res) => {
  requireAdmin(req.context);
  const preview = await buildCampaignCallPreview(req.params.id, req.body, req.context);
  if (!preview) {
    res.status(404).json({ error: "Campaign not found" });
    return;
  }
  res.json({ preview });
}));

app.post("/api/v1/campaigns-dashboard/campaigns/:id/call-runs", asyncRoute(async (req, res) => {
  requireAdmin(req.context);
  const preview = await buildCampaignCallPreview(req.params.id, req.body, req.context);
  if (!preview) {
    res.status(404).json({ error: "Campaign not found" });
    return;
  }
  if (preview.eligibleCount < 1) {
    res.status(400).json({ error: "No eligible call targets" });
    return;
  }

  const runId = await createCampaignCallRun(req.params.id, req.body, req.context);
  const runs = await loadCampaignCallRuns(req.params.id, req.context);
  res.status(201).json({ run: runs.find((run) => run.id === runId) || null, preview });
}));

app.get("/api/v1/campaigns-dashboard/campaigns/:id/call-runs", asyncRoute(async (req, res) => {
  res.json({ runs: await loadCampaignCallRuns(req.params.id, req.context) });
}));

app.get("/api/v1/campaigns-dashboard/call-runs/:id/jobs", asyncRoute(async (req, res) => {
  res.json({ jobs: await loadCampaignCallJobs(req.params.id, req.context) });
}));

app.post("/api/v1/campaigns-dashboard/call-jobs/:id/cancel", asyncRoute(async (req, res) => {
  requireAdmin(req.context);
  const organizationId = scopeOrganizationId(req.context);
  const result = await query(
    `
      UPDATE public.campaign_call_jobs j
      SET status = 'cancelled', updated_at = now()
      WHERE j.id = $1
        AND j.organization_id = $2
        AND j.status IN ('pending', 'queued')
      RETURNING j.id::text
    `,
    [req.params.id, organizationId],
  );
  if (!result.rows[0]) {
    res.status(404).json({ error: "Queued call job not found" });
    return;
  }
  res.json({ ok: true });
}));

app.post("/api/v1/campaigns-dashboard/call-runs/:id/cancel", asyncRoute(async (req, res) => {
  requireAdmin(req.context);
  const organizationId = scopeOrganizationId(req.context);
  const runResult = await query(
    `
      UPDATE public.campaign_call_runs
      SET status = 'cancelled', updated_at = now()
      WHERE id = $1 AND organization_id = $2 AND status IN ('scheduled', 'queued')
      RETURNING id::text, campaign_id::text
    `,
    [req.params.id, organizationId],
  );
  const run = runResult.rows[0];
  if (!run) {
    res.status(404).json({ error: "Scheduled call run not found" });
    return;
  }
  await query(
    `
      UPDATE public.campaign_call_jobs
      SET status = 'cancelled', updated_at = now()
      WHERE run_id = $1 AND organization_id = $2 AND status IN ('pending', 'queued')
    `,
    [req.params.id, organizationId],
  );
  const runs = await loadCampaignCallRuns(run.campaign_id, req.context);
  res.json({ run: runs.find((item) => item.id === req.params.id) || null });
}));

app.get("/api/v1/operational/offices", asyncRoute(async (req, res) => {
  const organizationId = scopeOrganizationId(req.context);
  const result = await optionalRows(`
    SELECT
      id::text,
      name,
      office_type,
      address,
      city,
      post_code,
      phone,
      latitude,
      longitude
    FROM public.operational_offices
    WHERE active = true AND organization_id = $1
    ORDER BY name ASC
  `, [organizationId]);

  res.json(result.map((office) => ({
    id: office.id,
    name: office.name,
    office_type: office.office_type,
    address: office.address,
    city: office.city,
    post_code: office.post_code,
    phone: office.phone,
    coords: [Number(office.latitude), Number(office.longitude)],
  })));
}));

app.get("/api/v1/operational/field-staff", asyncRoute(async (req, res) => {
  const organizationId = scopeOrganizationId(req.context);
  const result = await optionalRows(`
    SELECT
      id::text,
      full_name,
      role,
      team,
      phone,
      status,
      capacity,
      open_cases,
      last_known_latitude,
      last_known_longitude,
      last_seen_at
    FROM public.field_staff
    WHERE active = true AND organization_id = $1
    ORDER BY full_name ASC
  `, [organizationId]);

  res.json(result.map((staff) => ({
    id: staff.id,
    full_name: staff.full_name,
    role: staff.role,
    team: staff.team,
    phone: staff.phone,
    status: staff.status,
    capacity: Number(staff.capacity || 0),
    open_cases: Number(staff.open_cases || 0),
    last_seen_at: staff.last_seen_at,
    coords:
      staff.last_known_latitude != null && staff.last_known_longitude != null
        ? [Number(staff.last_known_latitude), Number(staff.last_known_longitude)]
        : null,
  })));
}));

app.get("/api/insights/kpis", asyncRoute(async (req, res) => {
  const organizationId = scopeOrganizationId(req.context);
  const rows = await optionalRows(
    `
      WITH latest_forecast_batch AS (
        SELECT MAX(forecast_generated_at) AS batch
        FROM public.client_risk_forecasts
        WHERE organization_id = $1
      ),
      forecast_7d AS (
        SELECT client_id, MAX(predicted_score) AS max_score
        FROM public.client_risk_forecasts
        WHERE organization_id = $1
          AND forecast_generated_at = (SELECT batch FROM latest_forecast_batch)
          AND horizon_day BETWEEN 1 AND 7
        GROUP BY client_id
      ),
      latest_scores AS (
        SELECT DISTINCT ON (client_id)
          client_id,
          delta_from_prior,
          contributing_factors
        FROM public.client_risk_scores_daily
        WHERE organization_id = $1
        ORDER BY client_id, score_date DESC
      ),
      latest_week AS (
        SELECT MAX(week_start) AS week_start
        FROM public.operator_capacity_weekly
        WHERE organization_id = $1
      )
      SELECT
        (SELECT COUNT(*)::int FROM forecast_7d WHERE max_score >= 67) AS predicted_escalations_7d,
        (SELECT COUNT(*)::int FROM latest_scores WHERE delta_from_prior > 0) AS clients_trending_up,
        (
          SELECT COUNT(*)::int
          FROM latest_scores
          WHERE EXISTS (
            SELECT 1
            FROM jsonb_array_elements(COALESCE(contributing_factors, '[]'::jsonb)) factor
            WHERE factor->>'signal' = 'medication'
              OR factor->>'label' ILIKE '%meds%'
          )
        ) AS adherence_risk_flags,
        (
          SELECT COUNT(*)::int
          FROM public.operator_capacity_weekly ocw
          JOIN latest_week lw ON lw.week_start = ocw.week_start
          WHERE ocw.organization_id = $1
            AND ocw.current_caseload > GREATEST(ocw.recommended_caseload, FLOOR(ocw.capacity_hours / 3))
        ) AS operators_over_capacity
    `,
    [organizationId],
  );
  const row = rows[0] || {};
  res.json({
    predictedEscalations7d: Number(row.predicted_escalations_7d || 0),
    clientsTrendingUp: Number(row.clients_trending_up || 0),
    adherenceRiskFlags: Number(row.adherence_risk_flags || 0),
    operatorsOverCapacity: Number(row.operators_over_capacity || 0),
  });
}));

app.get("/api/insights/horizon", asyncRoute(async (req, res) => {
  const organizationId = scopeOrganizationId(req.context);
  const days = parseInsightsDays(req.query.days);
  const rows = await optionalRows(
    `
      WITH latest_batch AS (
        SELECT MAX(generated_at) AS generated_at
        FROM public.daily_resource_forecast
        WHERE organization_id = $1
      )
      SELECT
        forecast_date::text,
        predicted_urgent_count,
        predicted_review_count,
        predicted_medication_count,
        predicted_noresponse_count,
        predicted_hours_needed,
        available_hours
      FROM public.daily_resource_forecast
      WHERE organization_id = $1
        AND generated_at = (SELECT generated_at FROM latest_batch)
        AND forecast_date > CURRENT_DATE
      ORDER BY forecast_date ASC
      LIMIT $2
    `,
    [organizationId, days],
  );

  res.json(rows.map((row) => ({
    date: row.forecast_date,
    urgent: Number(row.predicted_urgent_count || 0),
    review: Number(row.predicted_review_count || 0),
    medication: Number(row.predicted_medication_count || 0),
    noResponse: Number(row.predicted_noresponse_count || 0),
    hoursNeeded: Number(row.predicted_hours_needed || 0),
    hoursAvailable: Number(row.available_hours || 0),
  })));
}));

app.get("/api/insights/clients", asyncRoute(async (req, res) => {
  const organizationId = scopeOrganizationId(req.context);
  const filter = String(req.query.filter || "all");
  const days = parseInsightsDays(req.query.days || 30);
  const [clientRows, historyRows, forecastRows] = await Promise.all([
    optionalRows(
      `
        WITH latest_scores AS (
          SELECT DISTINCT ON (client_id)
            client_id,
            composite_score,
            risk_band,
            delta_from_prior,
            contributing_factors,
            score_date
          FROM public.client_risk_scores_daily
          WHERE organization_id = $1
          ORDER BY client_id, score_date DESC
        ),
        primary_assignments AS (
          SELECT DISTINCT ON (a.vyva_user_id)
            a.vyva_user_id,
            fs.full_name AS operator_name
          FROM public.vyva_user_care_provider_assignments a
          JOIN public.field_staff fs ON fs.id = a.field_staff_id
          WHERE a.provider_type = 'field_staff'
          ORDER BY a.vyva_user_id, a.is_primary DESC, a.created_at DESC
        )
        SELECT
          u.id::text,
          u.first_name || ' ' || u.last_name AS name,
          u.date_of_birth::text,
          COALESCE(NULLIF(u.city, ''), u.country, 'Unknown') AS zone,
          pa.operator_name,
          ls.composite_score,
          ls.delta_from_prior,
          ls.risk_band,
          ls.contributing_factors
        FROM latest_scores ls
        JOIN public.vyva_users u ON u.id = ls.client_id
        LEFT JOIN primary_assignments pa ON pa.vyva_user_id = u.id
        WHERE u.organization_id = $1
        ORDER BY
          CASE ls.risk_band WHEN 'high' THEN 0 WHEN 'moderate' THEN 1 ELSE 2 END,
          ls.composite_score DESC,
          u.last_name ASC
      `,
      [organizationId],
    ),
    optionalRows(
      `
        WITH ranked AS (
          SELECT
            client_id,
            score_date,
            composite_score,
            ROW_NUMBER() OVER (PARTITION BY client_id ORDER BY score_date DESC) AS rn
          FROM public.client_risk_scores_daily
          WHERE organization_id = $1
        )
        SELECT
          client_id::text,
          JSON_AGG(composite_score ORDER BY score_date ASC) AS history
        FROM ranked
        WHERE rn <= 14
        GROUP BY client_id
      `,
      [organizationId],
    ),
    optionalRows(
      `
        WITH latest_batch AS (
          SELECT MAX(forecast_generated_at) AS forecast_generated_at
          FROM public.client_risk_forecasts
          WHERE organization_id = $1
        )
        SELECT
          client_id::text,
          horizon_day,
          predicted_score,
          predicted_low,
          predicted_high
        FROM public.client_risk_forecasts
        WHERE organization_id = $1
          AND forecast_generated_at = (SELECT forecast_generated_at FROM latest_batch)
          AND horizon_day <= $2
        ORDER BY client_id, horizon_day ASC
      `,
      [organizationId, days],
    ),
  ]);

  const histories = new Map(historyRows.map((row) => [
    row.client_id,
    Array.isArray(row.history) ? row.history.map(Number) : [],
  ]));
  const forecasts = forecastRows.reduce((map, row) => {
    const current = map.get(row.client_id) || { mid: [], low: [], high: [] };
    current.mid.push(Number(row.predicted_score || 0));
    current.low.push(Number(row.predicted_low || 0));
    current.high.push(Number(row.predicted_high || 0));
    map.set(row.client_id, current);
    return map;
  }, new Map());

  const clients = clientRows.map((row) => {
    const factors = normalizeInsightFactors(row.contributing_factors);
    const client = {
      id: row.id,
      name: row.name,
      age: ageFromDateOfBirth(row.date_of_birth),
      zone: row.zone,
      operator: row.operator_name || null,
      score: Number(row.composite_score || 0),
      delta: Number(row.delta_from_prior || 0),
      band: row.risk_band || insightRiskBand(row.composite_score),
      history: histories.get(row.id) || [],
      forecast: forecasts.get(row.id) || { mid: [], low: [], high: [] },
      factors: factors.map((factor) => ({
        signal: factor.signal || null,
        label: factor.label || "Signal",
        severity: factor.severity || "moderate",
      })),
      window: "",
    };
    client.window = forecastWindowText(client);
    return client;
  }).filter((client) => insightClientMatchesFilter(client, filter));

  res.json(clients);
}));

app.get("/api/insights/operators", asyncRoute(async (req, res) => {
  const organizationId = scopeOrganizationId(req.context);
  res.json(await loadInsightOperatorRows(organizationId));
}));

app.get("/api/insights/suggestions", asyncRoute(async (req, res) => {
  const organizationId = scopeOrganizationId(req.context);
  const status = String(req.query.status || "pending");
  const rows = await optionalRows(
    `
      SELECT
        rs.id::text,
        COALESCE(source.full_name, 'Unassigned') AS from_name,
        target.full_name AS to_name,
        COUNT(rsc.client_id)::int AS client_count,
        rs.reason,
        rs.status
      FROM public.reassignment_suggestions rs
      JOIN public.field_staff target ON target.id = rs.to_operator_id
      LEFT JOIN public.field_staff source ON source.id = rs.from_operator_id
      LEFT JOIN public.reassignment_suggestion_clients rsc ON rsc.suggestion_id = rs.id
      WHERE rs.organization_id = $1
        AND ($2::text = 'all' OR rs.status = $2)
      GROUP BY rs.id, source.full_name, target.full_name
      ORDER BY rs.suggested_at DESC
      LIMIT 50
    `,
    [organizationId, status],
  );

  res.json(rows.map((row) => ({
    id: row.id,
    from: row.from_name,
    to: row.to_name,
    clientCount: Number(row.client_count || 0),
    reason: row.reason,
    status: row.status,
  })));
}));

app.post("/api/insights/suggestions/:id/apply", asyncRoute(async (req, res) => {
  const organizationId = scopeOrganizationId(req.context);
  const dbClient = await pool.connect();
  try {
    await dbClient.query("BEGIN");
    const suggestionResult = await dbClient.query(
      `
        SELECT
          id::text,
          from_operator_id::text,
          to_operator_id::text,
          status
        FROM public.reassignment_suggestions
        WHERE id = $1
          AND organization_id = $2
        FOR UPDATE
      `,
      [req.params.id, organizationId],
    );
    const suggestion = suggestionResult.rows[0];
    if (!suggestion) {
      await dbClient.query("ROLLBACK");
      res.status(404).json({ error: "Suggestion not found" });
      return;
    }
    if (suggestion.status !== "pending") {
      await dbClient.query("ROLLBACK");
      res.status(409).json({ error: "Suggestion is no longer pending" });
      return;
    }

    const clients = await dbClient.query(
      `
        SELECT rsc.client_id::text
        FROM public.reassignment_suggestion_clients rsc
        JOIN public.vyva_users u ON u.id = rsc.client_id
        WHERE rsc.suggestion_id = $1
          AND u.organization_id = $2
      `,
      [suggestion.id, organizationId],
    );

    for (const row of clients.rows) {
      if (suggestion.from_operator_id) {
        await dbClient.query(
          `
            DELETE FROM public.vyva_user_care_provider_assignments
            WHERE vyva_user_id = $1
              AND provider_type = 'field_staff'
              AND field_staff_id = $2
          `,
          [row.client_id, suggestion.from_operator_id],
        );
      }

      await dbClient.query(
        `
          UPDATE public.vyva_user_care_provider_assignments
          SET is_primary = false, updated_at = now()
          WHERE vyva_user_id = $1
            AND provider_type = 'field_staff'
        `,
        [row.client_id],
      );

      await dbClient.query(
        `
          INSERT INTO public.vyva_user_care_provider_assignments (
            vyva_user_id,
            provider_type,
            field_staff_id,
            is_primary,
            relationship_label,
            notes
          )
          VALUES ($1, 'field_staff', $2, true, 'Primary field provider', 'Applied from predictive insights suggestion')
          ON CONFLICT (vyva_user_id, field_staff_id) WHERE provider_type = 'field_staff' AND field_staff_id IS NOT NULL
          DO UPDATE SET
            is_primary = true,
            relationship_label = COALESCE(public.vyva_user_care_provider_assignments.relationship_label, EXCLUDED.relationship_label),
            notes = EXCLUDED.notes,
            updated_at = now()
        `,
        [row.client_id, suggestion.to_operator_id],
      );
    }

    await dbClient.query(
      `
        UPDATE public.reassignment_suggestions
        SET status = 'applied', applied_at = now(), applied_by = $2
        WHERE id = $1
      `,
      [suggestion.id, req.context.userId || null],
    );

    const operators = await refreshOperatorCaseloadsWithClient(
      dbClient,
      [suggestion.from_operator_id, suggestion.to_operator_id],
      organizationId,
    );

    await dbClient.query("COMMIT");
    res.json({ operators });
  } catch (error) {
    await dbClient.query("ROLLBACK");
    throw error;
  } finally {
    dbClient.release();
  }
}));

app.post("/api/insights/suggestions/:id/dismiss", asyncRoute(async (req, res) => {
  const organizationId = scopeOrganizationId(req.context);
  const result = await query(
    `
      UPDATE public.reassignment_suggestions
      SET status = 'dismissed'
      WHERE id = $1
        AND organization_id = $2
        AND status = 'pending'
      RETURNING id::text, status
    `,
    [req.params.id, organizationId],
  );
  if (!result.rows[0]) {
    res.status(404).json({ error: "Suggestion not found" });
    return;
  }
  res.json({ id: result.rows[0].id, status: result.rows[0].status });
}));

app.get("/api/v1/checkins-dashboard/checkins", async (req, res, next) => {
  try {
    const mode = String(req.query.service_type || "").toLowerCase() === "brain_coach" ? "brain_coach" : "standard";
    const upstream = await requestVyvaBackend("/api/v1/checkins-dashboard/checkins", { query: req.query });
    if (upstream?.ok) {
      let context = null;
      try {
        context = await resolveRequestContext(req);
      } catch {
        context = null;
      }
      res.json(await overlayRoutineServicePayload(filterUpstreamCheckins(upstream.data, mode), mode === "brain_coach" ? "brain_coach" : "checkin", context));
      return;
    }
    if (upstream && upstream.status >= 400 && upstream.status < 500 && upstream.status !== 404) {
      res.status(upstream.status).json(upstream.data);
      return;
    }
    if (!pool) {
      dbUnavailable(res);
      return;
    }
    req.context = await resolveRequestContext(req);
    res.json({ checkins: await loadCheckins(req.context) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/v1/checkins-dashboard/checkins", asyncRoute(async (req, res) => {
  requireAdmin(req.context);
  const validationError = validateCheckinPayload(req.body, true);
  if (validationError) {
    res.status(400).json({ error: validationError });
    return;
  }

  if (!(await userBelongsToOrganization(req.body.user_id, req.context))) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  await requireCheckinScheduleAccess(req.body.user_id, req.context);

  const result = await query(
    `
      INSERT INTO public.vyva_user_checkins (vyva_user_id, enabled, frequency, preferred_time)
      VALUES ($1, $2, $3, $4)
      RETURNING id::text
    `,
    [req.body.user_id, Boolean(req.body.is_active), String(req.body.frequency_days), req.body.preferred_time || null],
  );

  const checkins = await loadCheckins(req.context);
  res.status(201).json(
    checkins.find((item) => item.id === result.rows[0]?.id || String(item.user_id) === String(req.body.user_id)) || { id: result.rows[0]?.id },
  );
}));

app.patch("/api/v1/checkins-dashboard/checkins/:id", asyncRoute(async (req, res) => {
  const validationError = validateCheckinPayload(req.body);
  if (validationError) {
    res.status(400).json({ error: validationError });
    return;
  }

  const result = await updateCheckinConfig(req.params.id, req.body, req.context);
  if (result.notFound) {
    res.status(404).json({ error: "Scheduled call not found" });
    return;
  }
  if (result.error) {
    res.status(400).json({ error: result.error });
    return;
  }

  const checkins = await loadCheckins(req.context);
  res.json(
    checkins.find(
      (item) => item.id === result.value?.id || item.id === req.params.id || String(item.user_id) === String(result.value?.vyva_user_id ?? req.body?.user_id),
    ) || { id: result.value?.id || req.params.id },
  );
}));

app.delete("/api/v1/checkins-dashboard/checkins/:id", asyncRoute(async (req, res) => {
  requireAdmin(req.context);
  const organizationId = scopeOrganizationId(req.context);
  await query(
    `
      DELETE FROM public.vyva_user_checkins c
      USING public.vyva_users u
      WHERE c.id = $1
        AND u.id = c.vyva_user_id
        AND u.organization_id = $2
    `,
    [req.params.id, organizationId],
  );
  res.status(204).end();
}));

app.get("/api/v1/brain-coach-dashboard/sessions", async (req, res, next) => {
  try {
    const upstream = await requestVyvaBackend("/api/v1/brain-coach-dashboard/sessions", { query: req.query });
    if (upstream?.ok) {
      let context = null;
      try {
        context = await resolveRequestContext(req);
      } catch {
        context = null;
      }
      res.json(await overlayRoutineServicePayload(upstream.data, "brain_coach", context));
      return;
    }
    if (upstream && upstream.status >= 400 && upstream.status < 500 && upstream.status !== 404) {
      res.status(upstream.status).json(upstream.data);
      return;
    }

    const checkinsUpstream = await requestVyvaBackend("/api/v1/checkins-dashboard/checkins", { query: req.query });
    if (checkinsUpstream?.ok) {
      let context = null;
      try {
        context = await resolveRequestContext(req);
      } catch {
        context = null;
      }
      res.json(await overlayRoutineServicePayload({ sessions: mapUpstreamBrainCoachSessions(checkinsUpstream.data) }, "brain_coach", context));
      return;
    }
    if (!pool) {
      dbUnavailable(res);
      return;
    }

    req.context = await resolveRequestContext(req);
    res.json({ sessions: await loadBrainCoachSessions(req.context) });
  } catch (error) {
    next(error);
  }
});

app.patch("/api/v1/brain-coach-dashboard/sessions/:user_id", asyncRoute(async (req, res) => {
  requireAdmin(req.context);
  const result = await upsertBrainCoachConfig(req.params.user_id, req.body, req.context);
  if (result.notFound) {
    res.status(404).json({ error: "Brain Coach session not found" });
    return;
  }
  if (result.error) {
    res.status(400).json({ error: result.error });
    return;
  }

  const sessions = await loadBrainCoachSessions(req.context);
  res.json(sessions.find((item) => String(item.user_id) === String(req.params.user_id)) || result.value);
}));

app.post("/api/v1/medications/weekly-schedule", async (req, res, next) => {
  try {
    const userId = req.body?.user_id;
    const start = req.body?.date_start;
    const end = req.body?.date_end;
    if (!userId || !start || !end) {
      res.status(400).json({ error: "user_id, date_start, and date_end are required" });
      return;
    }

    const upstream = await requestVyvaBackend("/api/v1/medications/weekly-schedule", {
      method: "POST",
      body: req.body,
    });
    if (upstream?.ok) {
      res.json(upstream.data);
      return;
    }
    if (upstream && upstream.status >= 400 && upstream.status < 500 && upstream.status !== 404) {
      res.status(upstream.status).json(upstream.data);
      return;
    }
    if (!pool) {
      res.status(upstream?.status || 404).json(upstream?.data || { error: "Schedule not found" });
      return;
    }

    req.context = await resolveRequestContext(req);
    if (!(await userBelongsToOrganization(userId, req.context))) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const medications = await optionalRows(
      `
        SELECT id::text, medication_name, dosage, schedule_times
        FROM public.vyva_user_medications
        WHERE vyva_user_id = $1
          AND COALESCE(reminders_enabled, true) = true
        ORDER BY medication_name ASC
      `,
      [userId],
    );
    const logs = await optionalRows(
      `
        SELECT medication_id::text, scheduled_date::text, scheduled_time, status, notes
        FROM public.vyva_medication_logs
        WHERE vyva_user_id = $1 AND scheduled_date BETWEEN $2 AND $3
      `,
      [userId, start, end],
    );
    const logMap = new Map(
      logs.map((log) => [`${log.medication_id}|${log.scheduled_date}|${log.scheduled_time || ""}`, log]),
    );
    const today = formatDate(new Date());
    const schedule = {};

    for (const date of datesBetween(start, end)) {
      schedule[dayName(date)] = [];
      for (const medication of medications) {
        const times = Array.isArray(medication.schedule_times) && medication.schedule_times.length
          ? medication.schedule_times
          : [""];
        for (const time of times) {
          const log = logMap.get(`${medication.id}|${date}|${time || ""}`);
          let status = log?.status || (date < today ? "unconfirmed" : "upcoming");
          if (status === "pending") status = "unconfirmed";
          if (status === "confirmed") status = "taken";
          schedule[dayName(date)].push({
            medication_name: medication.medication_name,
            dosage: medication.dosage,
            time,
            notes: log?.notes || null,
            status,
          });
        }
      }
    }

    res.json({ schedule });
  } catch (error) {
    next(error);
  }
});

app.use((error, _req, res, _next) => {
  const status = error.status || (error.code === "23505" ? 409 : error.code === "DB_NOT_CONFIGURED" ? 503 : 500);
  if (status >= 500) console.error(error);
  res.status(status).json({
    error: status === 409 ? "Record already exists" : status >= 500 && !error.expose ? "Server error" : error.message,
  });
});

if (isProduction) {
  app.use(express.static(distDir));
  app.use((req, res, next) => {
    if (req.method !== "GET" || req.path.startsWith("/api/")) {
      next();
      return;
    }
    const indexPath = path.join(distDir, "index.html");
    if (!fs.existsSync(indexPath)) {
      res.status(500).send("Frontend build is missing. Run npm run build before starting production.");
      return;
    }
    res.sendFile(indexPath);
  });
} else {
  const { createServer: createViteServer } = await import("vite");
  const vite = await createViteServer({
    root: rootDir,
    server: {
      middlewareMode: true,
      hmr: { server: undefined },
    },
    appType: "spa",
  });
  app.use(vite.middlewares);
}

app.listen(port, host, () => {
  const mode = isProduction ? "production" : "development";
  const dbState = pool ? "configured" : "missing DATABASE_URL";
  console.log(`RC admin server running in ${mode} on http://${host}:${port} with database ${dbState}`);

  if (pool) {
    initializeDatabase().catch((error) => {
      console.error("Database schema initialization failed after startup:", error);
    });
  }
});
