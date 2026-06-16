import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

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
const apiAuthBypass =
  process.env.AUTH_BYPASS === "true" ||
  process.env.VITE_AUTH_BYPASS === "true" ||
  (!isProduction && (!supabaseUrl || !supabaseAnonKey));
const tokenUserCache = new Map();

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

function mergeExternalProfileWithLocalAssignments(data, careProviders, externalUserId) {
  const normalized = normalizeExternalProfilePayload(data);
  if (!Array.isArray(careProviders) || !careProviders.length) return normalized;
  return {
    ...normalized,
    careProviders,
    caregivers: careProvidersToCompatibilityCaregivers(careProviders, String(externalUserId)),
  };
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
  const caregivers = Array.isArray(externalData?.caregivers) ? externalData.caregivers : [];
  return caregivers
    .map((caregiver) => objectValue(caregiver))
    .filter(hasMeaningfulPayloadValue)
    .map((caregiver) => ({
      caretaker_name: nullIfBlank(firstValue(caregiver.caretaker_name, caregiver.name, caregiver.full_name, caregiver.fullName)),
      caretaker_phone: nullIfBlank(firstValue(caregiver.caretaker_phone, caregiver.phone, caregiver.phone_number, caregiver.phoneNumber)),
      source: "onboarding",
    }))
    .filter((caregiver) => caregiver.caretaker_name || caregiver.caretaker_phone);
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
  if (existingShadowId) return { value: existingShadowId };

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

function platformAdminEmails() {
  return String(process.env.VYVA_PLATFORM_ADMIN_EMAILS || process.env.PLATFORM_ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
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
      WHERE id = $1
      LIMIT 1
    `,
    [id],
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
      ORDER BY CASE role WHEN 'admin' THEN 0 WHEN 'coordinator' THEN 1 ELSE 2 END
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
      WHERE p.user_id = $1
      LIMIT 1
    `,
    [user.id],
  );
  const profile = profileResult.rows[0] || null;
  const email = String(user.email || profile?.email || "").toLowerCase();
  const isPlatformAdmin = Boolean(profile?.is_platform_admin) || platformAdminEmails().includes(email);
  const roles = rolesResult.rows.map((row) => row.role);
  const primaryRole = roles.includes("admin") ? "admin" : roles[0] || "operator";
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
    roles,
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
  if (!context?.isAdmin) throw httpError(403, "Admin access required");
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
  if (!user?.id) throw httpError(401, "Invalid session");
  const context = await loadUserContext(user);
  return applyOrganizationOverride(req, { ...context, authToken: token });
}

function requireAdmin(context) {
  if (!context?.isAdmin) throw httpError(403, "Admin access required");
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

async function createSupabaseAuthUserWithServiceRole({ email, password, role, organizationId }) {
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

async function createSupabaseAuthUserWithInviteFunction({ email, password, role, organizationId, authToken }) {
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

async function createSupabaseAuthUser({ email, password, role, organizationId, authToken }) {
  if (supabaseBaseUrl && supabaseServiceRoleKey) {
    return createSupabaseAuthUserWithServiceRole({ email, password, role, organizationId });
  }
  return createSupabaseAuthUserWithInviteFunction({ email, password, role, organizationId, authToken });
}

async function loadTeamMembers(context) {
  const organizationId = scopeOrganizationId(context);
  const result = await query(
    `
      SELECT
        r.id::text,
        r.user_id,
        r.organization_id::text,
        r.role::text,
        p.full_name,
        p.email,
        p.created_at
      FROM public.user_roles r
      LEFT JOIN public.profiles p ON p.user_id = r.user_id
      WHERE r.organization_id = $1
      ORDER BY
        CASE r.role WHEN 'admin' THEN 0 WHEN 'coordinator' THEN 1 ELSE 2 END,
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
  if (!["admin", "operator", "coordinator"].includes(role)) return { error: "role is invalid" };
  return { value: { email, password, role, fullName } };
}

function teamInviteAuthConfigured(authToken) {
  return Boolean((supabaseBaseUrl && supabaseServiceRoleKey) || (supabaseInviteAdminFunctionUrl && supabaseAnonKey && authToken));
}

async function createTeamMember(payload, context) {
  requireAdmin(context);
  const organizationId = scopeOrganizationId(context);
  const member = normalizeTeamMemberPayload(payload);
  if (member.error) return member;

  let userId = pendingTeamUserId(member.value.email);
  let inviteMode = "magic_link_pending";
  if (member.value.password && teamInviteAuthConfigured(context.authToken)) {
    try {
      const authUser = await createSupabaseAuthUser({
        email: member.value.email,
        password: member.value.password,
        role: member.value.role,
        organizationId,
        authToken: context.authToken,
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

  const members = await loadTeamMembers(context);
  return {
    inviteMode,
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

function targetReasonKey(campaign, user) {
  if (campaign.type === "medication") {
    return Number(user.missedMeds7d || 0) > 0 ? "campaigns.targets.reason.medication" : "campaigns.targets.reason.monitor";
  }
  if (campaign.type === "wellbeing") {
    if (!user.checkinEnabled) return "campaigns.targets.reason.noResponse";
    return "campaigns.targets.reason.isolation";
  }
  if (campaign.type === "service") return "campaigns.targets.reason.service";
  if (Number(user.criticalAlerts || 0) > 0) return "campaigns.targets.reason.safetyCritical";
  if (Number(user.activeAlerts || 0) > 0) return "campaigns.targets.reason.safetyReview";
  return "campaigns.targets.reason.safetyCheck";
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
  const matches = users.filter((user) => {
    if (campaign.type === "medication") return Number(user.missedMeds7d || 0) > 0;
    if (campaign.type === "wellbeing") return !user.checkinEnabled || targetRiskStatus(user) !== "stable";
    if (campaign.type === "service") return user.city === campaign.city || targetRiskStatus(user) !== "stable";
    return user.city === campaign.city || Number(user.criticalAlerts || 0) > 0 || Number(user.activeAlerts || 0) > 0;
  });
  return (matches.length ? matches : users)
    .slice()
    .sort((a, b) => Number(b.riskScore || 0) - Number(a.riskScore || 0))
    .slice(0, 20);
}

async function ensureCampaignTargets(campaigns, dashboardUsers) {
  if (!campaigns.length || !dashboardUsers.length) return;

  const counts = await query(
    `
      SELECT campaign_id::text, COUNT(*)::int AS count
      FROM public.campaign_targets
      WHERE campaign_id = ANY($1::uuid[])
      GROUP BY campaign_id
    `,
    [campaigns.map((campaign) => campaign.id)],
  );
  const countMap = new Map(counts.rows.map((row) => [row.campaign_id, Number(row.count || 0)]));

  for (const campaign of campaigns) {
    if ((countMap.get(campaign.id) || 0) > 0) continue;
    const candidates = campaignTargetCandidates(campaign, dashboardUsers);
    for (const [index, user] of candidates.entries()) {
      const status = targetStatusForCampaign(campaign, user, index);
      const riskStatus = targetRiskStatus(user);
      await query(
        `
          INSERT INTO public.campaign_targets (
            organization_id,
            campaign_id,
            vyva_user_id,
            status,
            reason_key,
            action,
            owner,
            channel
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (campaign_id, vyva_user_id) DO NOTHING
        `,
        [
          campaign.organization_id,
          campaign.id,
          user.id,
          status,
          targetReasonKey(campaign, user),
          status === "followUp" || riskStatus === "urgent" ? "prepareCall" : "profile",
          campaign.owner || null,
          campaign.channel === "whatsapp" ? "whatsapp" : "phone",
        ],
      );
    }
  }
}

function normalizeCampaign(row, targets = []) {
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
    dueKey: row.due_key || "campaigns.due.draft",
    city: row.city || "",
    owner: row.owner || "",
    type: row.type,
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
    targets,
  };
}

async function loadCampaigns(context) {
  const organizationId = scopeOrganizationId(context);
  const campaignResult = await query(`
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
  `, [organizationId]);
  const campaigns = campaignResult.rows;
  const dashboardData = await loadDashboardUsers(context);
  const usersById = new Map(dashboardData.gisUsers.map((user) => [user.id, user]));

  await ensureCampaignTargets(campaigns, dashboardData.gisUsers);

  const targetRows = campaigns.length
    ? await query(
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
      )
    : { rows: [] };

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

  return campaigns.map((campaign) => normalizeCampaign(campaign, targetsByCampaign.get(campaign.id) || []));
}

function validateCampaignPayload(payload) {
  const name = String(payload?.name || "").trim();
  const type = String(payload?.type || "safety");
  const channel = String(payload?.channel || "phone");
  const status = String(payload?.status || "draft");
  const executionType = String(payload?.executionType || payload?.execution_type || "manual");
  const retryLimit = Number(payload?.retryLimit ?? payload?.retry_limit ?? 0);
  if (!name) return "name is required";
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
  const campaignResult = await query(
    `
      SELECT id::text, organization_id::text, city, call_script, call_window_start, call_window_end, retry_limit
      FROM public.campaigns
      WHERE id = $1 AND organization_id = $2
      LIMIT 1
    `,
    [campaignId, organizationId],
  );
  const campaign = campaignResult.rows[0];
  if (!campaign) return null;

  const city = nullIfBlank(payload.city) ?? nullIfBlank(campaign.city);
  const scheduledAt = settings.scheduledAt ?? null;
  const callWindowStart = settings.callWindowStart || campaign.call_window_start || "09:00";
  const callWindowEnd = settings.callWindowEnd || campaign.call_window_end || "18:00";
  const outsideWindow = !timestampInsideCallWindow(scheduledAt, callWindowStart, callWindowEnd);

  const candidates = await query(
    `
      SELECT
        u.id::text AS user_id,
        u.phone,
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
      WHERE u.organization_id = $3
        AND ($2::text IS NULL OR LOWER(COALESCE(u.city, '')) = LOWER($2::text))
      ORDER BY u.created_at DESC
    `,
    [campaignId, city, organizationId],
  );

  const skipped = {
    noPhone: 0,
    noConsent: 0,
    outsideCallWindow: 0,
    duplicateTarget: 0,
  };
  const targets = candidates.rows.map((row) => {
    let status = "eligible";
    let skipReason = null;
    if (!nullIfBlank(row.phone)) {
      status = "skipped";
      skipReason = "no_phone";
      skipped.noPhone += 1;
    } else if (!row.consent_given) {
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

    return {
      userId: row.user_id,
      status,
      skipReason,
    };
  });
  const eligibleCount = targets.filter((target) => target.status === "eligible").length;

  return {
    campaignId,
    organizationId,
    scheduledAt,
    callWindowStart,
    callWindowEnd,
    retryLimit: settings.retryLimit,
    callScript: settings.callScript || campaign.call_script || "",
    eligibleCount,
    skippedCount: targets.length - eligibleCount,
    skipped,
    targets,
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

    for (const target of preview.targets) {
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

function normalizeCheckin(row) {
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
    user: {
      id: row.user_id,
      first_name: row.first_name,
      last_name: row.last_name,
      phone: row.user_phone,
      city: row.city,
    },
  };
}

async function loadCheckins(context) {
  const organizationId = scopeOrganizationId(context);
  const result = await query(`
    SELECT
      c.id::text,
      c.vyva_user_id::text AS user_id,
      c.enabled AS is_active,
      c.frequency,
      c.preferred_time,
      u.first_name,
      u.last_name,
      u.first_name || ' ' || u.last_name AS user_name,
      u.phone AS user_phone,
      u.city
    FROM public.vyva_user_checkins c
    JOIN public.vyva_users u ON u.id = c.vyva_user_id
    WHERE u.organization_id = $1
    ORDER BY c.enabled DESC, u.last_name ASC, u.first_name ASC
  `, [organizationId]);
  return result.rows.map(normalizeCheckin);
}

function normalizeBrainCoachSession(row) {
  return {
    id: row.id,
    user_id: row.user_id,
    userName: row.user_name,
    userPhone: row.user_phone,
    city: row.city,
    enabled: Boolean(row.enabled),
    frequency: row.frequency,
    preferred_time: row.preferred_time,
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

  const [consent, health, medications, checkins, brainCoach, careProviders, sensors, alerts] = await Promise.all([
    optionalRows("SELECT *, id::text FROM public.vyva_user_consent WHERE vyva_user_id = $1 LIMIT 1", [userId]),
    optionalRows("SELECT *, id::text FROM public.vyva_user_health WHERE vyva_user_id = $1 LIMIT 1", [userId]),
    optionalRows("SELECT *, id::text FROM public.vyva_user_medications WHERE vyva_user_id = $1 ORDER BY created_at DESC", [userId]),
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

  return {
    user,
    consent: consent[0] || null,
    health: health[0] || null,
    medications,
    checkins: checkins[0] || null,
    brainCoach: brainCoach[0] || null,
    careProviders,
    caregivers,
    sensors,
    alerts,
    readings: [],
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
  const rows = await optionalRows(
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
        fs.created_at,
        fs.updated_at
      FROM public.field_staff fs
      LEFT JOIN field_staff_counts fc ON fc.provider_id = fs.id
      WHERE
        fs.active = true
        AND fs.organization_id = $3
        AND ($1::text IS NULL OR LOWER(fs.full_name) LIKE '%' || $1 || '%' OR LOWER(COALESCE(fs.team, '')) LIKE '%' || $1 || '%' OR COALESCE(fs.phone, '') LIKE '%' || $1 || '%')
        AND ($2::text IS NULL OR $2 = 'field_staff')
      ORDER BY display_name ASC
      LIMIT 100
    `,
    [search, type, organizationId],
  );
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
      relationship_label: "Caregiver",
      source: caregiver.source || "manual",
    }, organizationId);
  }
}

async function replaceMedicationsWithClient(client, userId, medications) {
  await client.query("DELETE FROM public.vyva_user_medications WHERE vyva_user_id = $1", [userId]);
  for (const medication of medications) {
    await client.query(
      `
        INSERT INTO public.vyva_user_medications (vyva_user_id, medication_name, purpose, dosage, schedule_times)
        VALUES ($1, $2, $3, $4, $5)
      `,
      [userId, medication.medication_name, medication.purpose, medication.dosage, medication.schedule_times],
    );
  }
}

async function upsertServiceWithClient(client, table, userId, config) {
  const existing = await client.query(`SELECT id::text FROM public.${table} WHERE vyva_user_id = $1 LIMIT 1`, [userId]);
  if (existing.rows[0]) {
    await client.query(
      `
        UPDATE public.${table}
        SET enabled = $2, frequency = $3, preferred_time = $4, updated_at = now()
        WHERE id = $1
      `,
      [existing.rows[0].id, config.enabled, config.frequency, config.preferred_time],
    );
    return;
  }

  await client.query(
    `
      INSERT INTO public.${table} (vyva_user_id, enabled, frequency, preferred_time)
      VALUES ($1, $2, $3, $4)
    `,
    [userId, config.enabled, config.frequency, config.preferred_time],
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
          emergency_notes
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
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
          emergency_notes = $12,
          updated_at = now()
        WHERE id = $1 AND organization_id = $13
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

function normalizeMedicationPayload(payload, creating = false) {
  const medicationName = nullIfBlank(firstValue(payload?.medication_name, payload?.medicationName, payload?.name));
  if (!medicationName) return { error: "medication_name is required" };

  return {
    value: {
      vyva_user_id: nullIfBlank(firstValue(payload?.vyva_user_id, payload?.user_id, payload?.userId)),
      medication_name: medicationName,
      purpose: nullIfBlank(firstValue(payload?.purpose, payload?.reason)),
      dosage: nullIfBlank(payload?.dosage),
      schedule_times: normalizeStringArray(firstValue(payload?.schedule_times, payload?.scheduleTimes, payload?.times)),
    },
    error: creating && !nullIfBlank(firstValue(payload?.vyva_user_id, payload?.user_id, payload?.userId)) ? "vyva_user_id is required" : null,
  };
}

async function createMedication(payload, context) {
  const medication = normalizeMedicationPayload(payload, true);
  if (medication.error) return medication;
  if (!(await userBelongsToOrganization(medication.value.vyva_user_id, context))) return { notFound: true };

  const result = await query(
    `
      INSERT INTO public.vyva_user_medications (vyva_user_id, medication_name, purpose, dosage, schedule_times)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *, id::text, vyva_user_id::text
    `,
    [
      medication.value.vyva_user_id,
      medication.value.medication_name,
      medication.value.purpose,
      medication.value.dosage,
      medication.value.schedule_times,
    ],
  );

  return { value: result.rows[0] };
}

async function updateMedication(medicationId, payload, context) {
  const organizationId = scopeOrganizationId(context);
  const medication = normalizeMedicationPayload(payload);
  if (medication.error) return medication;

  const result = await query(
    `
      UPDATE public.vyva_user_medications m
      SET medication_name = $2, purpose = $3, dosage = $4, schedule_times = $5, updated_at = now()
      FROM public.vyva_users u
      WHERE m.id = $1
        AND u.id = m.vyva_user_id
        AND u.organization_id = $6
      RETURNING m.*, m.id::text, m.vyva_user_id::text
    `,
    [
      medicationId,
      medication.value.medication_name,
      medication.value.purpose,
      medication.value.dosage,
      medication.value.schedule_times,
      organizationId,
    ],
  );

  if (!result.rows[0]) return { notFound: true };
  return { value: result.rows[0] };
}

async function deleteMedication(medicationId, context) {
  const organizationId = scopeOrganizationId(context);
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
  if (preferredTime && !/^\d{2}:\d{2}$/.test(preferredTime)) return { error: "preferred_time must be HH:mm" };

  return {
    value: {
      enabled: optionalBooleanValue(payload?.enabled, payload?.is_active, payload?.active) ?? false,
      frequency: nullIfBlank(firstValue(payload?.frequency, payload?.frequency_days, payload?.frequencyDays)),
      preferred_time: preferredTime,
    },
  };
}

async function updateCheckinConfig(checkinId, payload, context) {
  const organizationId = scopeOrganizationId(context);
  const config = normalizeServicePayload(payload);
  if (config.error) return config;

  const result = await query(
    `
      UPDATE public.vyva_user_checkins c
      SET enabled = $2, frequency = $3, preferred_time = $4, updated_at = now()
      FROM public.vyva_users u
      WHERE c.id = $1
        AND u.id = c.vyva_user_id
        AND u.organization_id = $5
      RETURNING c.*, c.id::text, c.vyva_user_id::text
    `,
    [checkinId, config.value.enabled, config.value.frequency, config.value.preferred_time, organizationId],
  );

  if (!result.rows[0]) return { notFound: true };
  return { value: result.rows[0] };
}

async function upsertBrainCoachConfig(userId, payload, context) {
  if (!(await userBelongsToOrganization(userId, context))) return { notFound: true };
  const config = normalizeServicePayload(payload);
  if (config.error) return config;

  const existing = await query("SELECT id::text FROM public.vyva_user_brain_coach WHERE vyva_user_id = $1 LIMIT 1", [userId]);
  if (existing.rows[0]) {
    const result = await query(
      `
        UPDATE public.vyva_user_brain_coach
        SET enabled = $2, frequency = $3, preferred_time = $4, updated_at = now()
        WHERE id = $1
        RETURNING *, id::text, vyva_user_id::text
      `,
      [existing.rows[0].id, config.value.enabled, config.value.frequency, config.value.preferred_time],
    );
    return { value: result.rows[0] };
  }

  const result = await query(
    `
      INSERT INTO public.vyva_user_brain_coach (vyva_user_id, enabled, frequency, preferred_time)
      VALUES ($1, $2, $3, $4)
      RETURNING *, id::text, vyva_user_id::text
    `,
    [userId, config.value.enabled, config.value.frequency, config.value.preferred_time],
  );
  return { value: result.rows[0] };
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
          INSERT INTO public.vyva_user_medications (vyva_user_id, medication_name, purpose, dosage, schedule_times)
          VALUES ($1, $2, $3, $4, $5)
        `,
        [
          userId,
          name,
          nullIfBlank(firstValue(medication.purpose, medication.reason)),
          nullIfBlank(medication.dosage),
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
          includeInactive: Boolean(context?.isAdmin) && req.query.includeInactive === "true",
        });
        if (databaseOrganizations.length) organizations = databaseOrganizations;
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
  requireAdmin(req.context);
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
  requireAdmin(req.context);
  const payload = normalizeOrganizationPayload(req.body);
  if (payload.error) {
    res.status(400).json({ error: payload.error });
    return;
  }
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
  const result = await createTeamMember(req.body, req.context);
  if (result.error) {
    res.status(400).json({ error: result.error });
    return;
  }
  res.status(201).json({ inviteMode: result.inviteMode, member: result.value });
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
      if (pool) {
        try {
          req.context = await resolveRequestContext(req);
          careProviders = await loadExternalUserCareProviders(userId, req.context);
        } catch (error) {
          if (error.status && error.status !== 401) throw error;
        }
      }
      res.json(mergeExternalProfileWithLocalAssignments(upstream.data, careProviders, userId));
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
    res.json(data);
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
  const upstream = await requestVyvaBackend("/api/v1/user-dashboard/medications", {
    method: "POST",
    body: req.body,
  });
  if (handleVyvaBackendResponse(res, upstream, 201)) return;

  sendWriteResult(res, await createMedication(req.body, req.context), 201);
}));

app.put("/api/v1/user-dashboard/medications/:med_id", asyncRoute(async (req, res) => {
  const upstream = await requestVyvaBackend(`/api/v1/user-dashboard/medications/${encodeURIComponent(req.params.med_id)}`, {
    method: "PUT",
    body: req.body,
  });
  if (handleVyvaBackendResponse(res, upstream)) return;

  sendWriteResult(res, await updateMedication(req.params.med_id, req.body, req.context));
}));

app.delete("/api/v1/user-dashboard/medications/:med_id", asyncRoute(async (req, res) => {
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
  requireAdmin(req.context);
  const validationError = validateCampaignPayload(req.body);
  if (validationError) {
    res.status(400).json({ error: validationError });
    return;
  }

  const type = String(req.body.type || "safety");
  const status = String(req.body.status || "draft");
  const callSettings = normalizeCampaignCallSettings(req.body);
  const executionType = String(req.body.executionType || req.body.execution_type || "manual");
  const organizationId = scopeOrganizationId(req.context);
  const result = await query(
    `
      INSERT INTO public.campaigns (
        organization_id,
        name,
        objective,
        audience,
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
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING id::text
    `,
    [
      organizationId,
      String(req.body.name || "").trim(),
      String(req.body.objective || "").trim() || null,
      String(req.body.audience || "").trim() || null,
      String(req.body.dueKey || "campaigns.due.draft"),
      String(req.body.city || "").trim() || null,
      String(req.body.owner || "Ana Novak").trim(),
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
  requireAdmin(req.context);
  const validationError = validateCampaignPayload(req.body);
  if (validationError) {
    res.status(400).json({ error: validationError });
    return;
  }

  const type = String(req.body.type || "safety");
  const status = String(req.body.status || "draft");
  const callSettings = normalizeCampaignCallSettings(req.body);
  const executionType = String(req.body.executionType || req.body.execution_type || "manual");
  const organizationId = scopeOrganizationId(req.context);
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
        due_key = $5,
        city = $6,
        owner = $7,
        type = $8,
        status = $9,
        channel = $10,
        scheduled_at = $11,
        call_script = $12,
        call_window_start = $13,
        call_window_end = $14,
        retry_limit = $15,
        execution_type = $16,
        tone = $17
      WHERE id = $1 AND organization_id = $18
      RETURNING id::text
    `,
    [
      req.params.id,
      String(req.body.name || "").trim(),
      String(req.body.objective || "").trim() || null,
      String(req.body.audience || "").trim() || null,
      String(req.body.dueKey || "campaigns.due.draft"),
      String(req.body.city || "").trim() || null,
      String(req.body.owner || "Ana Novak").trim(),
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

app.get("/api/v1/checkins-dashboard/checkins", asyncRoute(async (req, res) => {
  res.json({ checkins: await loadCheckins(req.context) });
}));

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

  const result = await query(
    `
      INSERT INTO public.vyva_user_checkins (vyva_user_id, enabled, frequency, preferred_time)
      VALUES ($1, $2, $3, $4)
      RETURNING id::text
    `,
    [req.body.user_id, Boolean(req.body.is_active), String(req.body.frequency_days), req.body.preferred_time || null],
  );

  const checkins = await loadCheckins(req.context);
  res.status(201).json(checkins.find((item) => item.id === result.rows[0]?.id) || { id: result.rows[0]?.id });
}));

app.patch("/api/v1/checkins-dashboard/checkins/:id", asyncRoute(async (req, res) => {
  requireAdmin(req.context);
  const organizationId = scopeOrganizationId(req.context);
  const validationError = validateCheckinPayload(req.body);
  if (validationError) {
    res.status(400).json({ error: validationError });
    return;
  }

  const result = await query(
    `
      UPDATE public.vyva_user_checkins c
      SET enabled = $2, frequency = $3, preferred_time = $4
      FROM public.vyva_users u
      WHERE c.id = $1
        AND u.id = c.vyva_user_id
        AND u.organization_id = $5
      RETURNING c.id::text
    `,
    [req.params.id, Boolean(req.body.is_active), String(req.body.frequency_days), req.body.preferred_time || null, organizationId],
  );
  if (!result.rows[0]) {
    res.status(404).json({ error: "Scheduled call not found" });
    return;
  }

  const checkins = await loadCheckins(req.context);
  res.json(checkins.find((item) => item.id === req.params.id) || { id: req.params.id });
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

app.get("/api/v1/brain-coach-dashboard/sessions", asyncRoute(async (req, res) => {
  res.json({ sessions: await loadBrainCoachSessions(req.context) });
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
