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

async function initializeDatabase() {
  if (!pool) return;
  const schema = fs.readFileSync(schemaPath, "utf8");
  await pool.query(schema);
  console.log("Database schema is ready.");
}

function asyncRoute(handler) {
  return async (req, res, next) => {
    try {
      if (!pool) {
        dbUnavailable(res);
        return;
      }
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
    healthConditions,
    missedMeds7d,
    riskScore,
  };
}

async function loadDashboardUsers() {
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
      COALESCE(c.enabled, false) AS checkin_enabled
    FROM public.vyva_users u
    LEFT JOIN sensor_counts s ON s.vyva_user_id = u.id
    LEFT JOIN alert_counts a ON a.vyva_user_id = u.id
    LEFT JOIN health_counts h ON h.vyva_user_id = u.id
    LEFT JOIN missed_med_counts m ON m.vyva_user_id = u.id
    LEFT JOIN public.vyva_user_checkins c ON c.vyva_user_id = u.id
    ORDER BY COALESCE(a.critical_alerts, 0) DESC, COALESCE(a.active_alerts, 0) DESC, u.created_at DESC
  `);

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
    WHERE a.resolved_at IS NULL
    ORDER BY
      CASE a.severity WHEN 'critical' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END,
      a.created_at DESC
    LIMIT 50
  `);

  const cityRows = await query(`
    SELECT COALESCE(NULLIF(city, ''), 'Unknown') AS city, COUNT(*)::int AS count
    FROM public.vyva_users
    GROUP BY COALESCE(NULLIF(city, ''), 'Unknown')
    ORDER BY count DESC, city ASC
  `);

  const caregiverRows = await query("SELECT COUNT(*)::int AS count FROM public.vyva_user_caregivers");
  const checkinRows = await query("SELECT COUNT(*)::int AS count FROM public.vyva_user_checkins WHERE enabled = true");
  const sensorRows = await optionalRows("SELECT COUNT(*)::int AS count FROM public.vyva_user_sensors");

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
            campaign_id,
            vyva_user_id,
            status,
            reason_key,
            action,
            owner,
            channel
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (campaign_id, vyva_user_id) DO NOTHING
        `,
        [
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

async function loadCampaigns() {
  const campaignResult = await query(`
    SELECT
      id::text,
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
      target_total,
      contacted_count,
      confirmed_count,
      follow_up_count,
      tone
    FROM public.campaigns
    ORDER BY
      CASE status WHEN 'active' THEN 0 WHEN 'scheduled' THEN 1 WHEN 'draft' THEN 2 ELSE 3 END,
      created_at DESC
  `);
  const campaigns = campaignResult.rows;
  const dashboardData = await loadDashboardUsers();
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
          WHERE campaign_id = ANY($1::uuid[])
          ORDER BY
            CASE status WHEN 'followUp' THEN 0 WHEN 'pending' THEN 1 WHEN 'contacted' THEN 2 ELSE 3 END,
            created_at ASC
        `,
        [campaigns.map((campaign) => campaign.id)],
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
  if (!name) return "name is required";
  if (!["safety", "wellbeing", "medication", "service"].includes(type)) return "type is invalid";
  if (!["phone", "whatsapp", "mixed"].includes(channel)) return "channel is invalid";
  if (!["active", "draft", "scheduled", "completed"].includes(status)) return "status is invalid";
  return null;
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

async function loadCheckins() {
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
    ORDER BY c.enabled DESC, u.last_name ASC, u.first_name ASC
  `);
  return result.rows.map(normalizeCheckin);
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

async function loadUserInfo(userId) {
  const userResult = await query("SELECT *, id::text FROM public.vyva_users WHERE id = $1 LIMIT 1", [userId]);
  const user = userResult.rows[0];
  if (!user) return null;

  const [consent, health, medications, checkins, brainCoach, caregivers, sensors, alerts] = await Promise.all([
    optionalRows("SELECT *, id::text FROM public.vyva_user_consent WHERE vyva_user_id = $1 LIMIT 1", [userId]),
    optionalRows("SELECT *, id::text FROM public.vyva_user_health WHERE vyva_user_id = $1 LIMIT 1", [userId]),
    optionalRows("SELECT *, id::text FROM public.vyva_user_medications WHERE vyva_user_id = $1 ORDER BY created_at DESC", [userId]),
    optionalRows("SELECT *, id::text FROM public.vyva_user_checkins WHERE vyva_user_id = $1 LIMIT 1", [userId]),
    optionalRows("SELECT *, id::text FROM public.vyva_user_brain_coach WHERE vyva_user_id = $1 LIMIT 1", [userId]),
    optionalRows("SELECT *, id::text FROM public.vyva_user_caregivers WHERE vyva_user_id = $1 ORDER BY created_at DESC", [userId]),
    optionalRows("SELECT *, id::text FROM public.vyva_user_sensors WHERE vyva_user_id = $1 ORDER BY created_at DESC", [userId]),
    optionalRows("SELECT *, id::text FROM public.vyva_sensor_alerts WHERE vyva_user_id = $1 ORDER BY created_at DESC LIMIT 50", [userId]),
  ]);

  return {
    user,
    consent: consent[0] || null,
    health: health[0] || null,
    medications,
    checkins: checkins[0] || null,
    brainCoach: brainCoach[0] || null,
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

function normalizeUserPayload(payload, creating = false) {
  const firstName = nullIfBlank(payload?.first_name);
  const lastName = nullIfBlank(payload?.last_name);
  const dateOfBirth = nullIfBlank(payload?.date_of_birth);
  const language = nullIfBlank(payload?.language) || "de";

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
      country: nullIfBlank(payload?.country) || (creating ? "Germany" : null),
      timezone: nullIfBlank(payload?.timezone) || (creating ? "Europe/Berlin" : null),
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

async function replaceCaregiversWithClient(client, userId, caregivers) {
  await client.query("DELETE FROM public.vyva_user_caregivers WHERE vyva_user_id = $1", [userId]);
  for (const caregiver of caregivers) {
    await client.query(
      "INSERT INTO public.vyva_user_caregivers (vyva_user_id, caretaker_name, caretaker_phone) VALUES ($1, $2, $3)",
      [userId, caregiver.caretaker_name, caregiver.caretaker_phone],
    );
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

async function syncCareProfileWithClient(client, userId, careProfile) {
  if (careProfile.healthPresent && (hasMeaningfulPayloadValue(careProfile.health) || careProfile.health)) {
    await upsertHealthWithClient(client, userId, careProfile.health);
  }
  if (careProfile.consentPresent && careProfile.consent) {
    await upsertConsentWithClient(client, userId, careProfile.consent);
  }
  if (careProfile.caregivers) {
    await replaceCaregiversWithClient(client, userId, careProfile.caregivers);
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

async function createDashboardUser(payload) {
  const user = normalizeUserPayload(payload, true);
  if (user.error) return user;

  const careProfile = normalizeCareProfilePayload(payload, true);
  if (careProfile.error) return careProfile;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      `
        INSERT INTO public.vyva_users (
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
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *, id::text
      `,
      [
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

    await syncCareProfileWithClient(client, createdUser.id, careProfile.value);

    await client.query("COMMIT");
    return { value: createdUser };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function updateDashboardUser(userId, payload) {
  const user = normalizeUserPayload(payload);
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
        WHERE id = $1
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
      ],
    );

    if (!result.rows[0]) {
      await client.query("ROLLBACK");
      return { notFound: true };
    }

    await syncCareProfileWithClient(client, userId, careProfile.value);
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

async function createMedication(payload) {
  const medication = normalizeMedicationPayload(payload, true);
  if (medication.error) return medication;

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

async function updateMedication(medicationId, payload) {
  const medication = normalizeMedicationPayload(payload);
  if (medication.error) return medication;

  const result = await query(
    `
      UPDATE public.vyva_user_medications
      SET medication_name = $2, purpose = $3, dosage = $4, schedule_times = $5, updated_at = now()
      WHERE id = $1
      RETURNING *, id::text, vyva_user_id::text
    `,
    [
      medicationId,
      medication.value.medication_name,
      medication.value.purpose,
      medication.value.dosage,
      medication.value.schedule_times,
    ],
  );

  if (!result.rows[0]) return { notFound: true };
  return { value: result.rows[0] };
}

async function deleteMedication(medicationId) {
  const result = await query("DELETE FROM public.vyva_user_medications WHERE id = $1 RETURNING id::text", [medicationId]);
  return result.rows[0] ? { value: result.rows[0] } : { notFound: true };
}

function normalizeCaregiverPayload(payload, creating = false) {
  const name = nullIfBlank(firstValue(payload?.caretaker_name, payload?.caregiver_name, payload?.name, payload?.full_name, payload?.fullName));
  const phone = nullIfBlank(firstValue(payload?.caretaker_phone, payload?.caregiver_phone, payload?.phone, payload?.phone_number, payload?.phoneNumber));
  if (!name && !phone) return { error: "caretaker_name or caretaker_phone is required" };

  return {
    value: {
      vyva_user_id: nullIfBlank(firstValue(payload?.vyva_user_id, payload?.user_id, payload?.userId)),
      caretaker_name: name,
      caretaker_phone: phone,
    },
    error: creating && !nullIfBlank(firstValue(payload?.vyva_user_id, payload?.user_id, payload?.userId)) ? "vyva_user_id is required" : null,
  };
}

async function createCaregiver(payload) {
  const caregiver = normalizeCaregiverPayload(payload, true);
  if (caregiver.error) return caregiver;

  const result = await query(
    `
      INSERT INTO public.vyva_user_caregivers (vyva_user_id, caretaker_name, caretaker_phone)
      VALUES ($1, $2, $3)
      RETURNING *, id::text, vyva_user_id::text
    `,
    [caregiver.value.vyva_user_id, caregiver.value.caretaker_name, caregiver.value.caretaker_phone],
  );

  return { value: result.rows[0] };
}

async function updateCaregiver(caregiverId, payload) {
  const caregiver = normalizeCaregiverPayload(payload);
  if (caregiver.error) return caregiver;

  const result = await query(
    `
      UPDATE public.vyva_user_caregivers
      SET caretaker_name = $2, caretaker_phone = $3, updated_at = now()
      WHERE id = $1
      RETURNING *, id::text, vyva_user_id::text
    `,
    [caregiverId, caregiver.value.caretaker_name, caregiver.value.caretaker_phone],
  );

  if (!result.rows[0]) return { notFound: true };
  return { value: result.rows[0] };
}

async function deleteCaregiver(caregiverId) {
  const result = await query("DELETE FROM public.vyva_user_caregivers WHERE id = $1 RETURNING id::text", [caregiverId]);
  return result.rows[0] ? { value: result.rows[0] } : { notFound: true };
}

function normalizeHealthPayload(payload) {
  return {
    value: {
      health_conditions: normalizeStringArray(firstValue(payload?.health_conditions, payload?.healthConditions, payload?.conditions)),
      mobility_needs: normalizeStringArray(firstValue(payload?.mobility_needs, payload?.mobilityNeeds, payload?.mobility)),
    },
  };
}

async function upsertHealth(userId, payload) {
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

async function updateCheckinConfig(checkinId, payload) {
  const config = normalizeServicePayload(payload);
  if (config.error) return config;

  const result = await query(
    `
      UPDATE public.vyva_user_checkins
      SET enabled = $2, frequency = $3, preferred_time = $4, updated_at = now()
      WHERE id = $1
      RETURNING *, id::text, vyva_user_id::text
    `,
    [checkinId, config.value.enabled, config.value.frequency, config.value.preferred_time],
  );

  if (!result.rows[0]) return { notFound: true };
  return { value: result.rows[0] };
}

async function upsertBrainCoachConfig(userId, payload) {
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

function normalizeLanguage(value) {
  const language = nullIfBlank(value)?.toLowerCase().slice(0, 2);
  return ["en", "de", "es"].includes(language) ? language : "de";
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
    ...objectValue(payload.user),
    ...objectValue(payload.registration),
    ...objectValue(payload.profile),
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
      phone: nullIfBlank(phone),
      city: nullIfBlank(firstValue(source.city, source.town, source.locality)),
      street: nullIfBlank(firstValue(source.street, source.address_street, source.addressLine1)),
      house_number: nullIfBlank(firstValue(source.house_number, source.houseNumber, source.house_no, source.houseNo)),
      post_code: nullIfBlank(firstValue(source.post_code, source.postCode, source.postal_code, source.zip)),
      country: nullIfBlank(source.country) || "Germany",
      timezone: nullIfBlank(source.timezone) || "Europe/Berlin",
      date_of_birth: dateOfBirth,
      gender: nullIfBlank(source.gender),
      language: normalizeLanguage(firstValue(source.language, source.lang, source.locale)),
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
        ($1::text IS NOT NULL AND conversation_id = $1)
        OR ($2::text IS NOT NULL AND regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g') = $2)
        OR ($3::text IS NOT NULL AND phone = $3)
      ORDER BY updated_at DESC
      LIMIT 1
    `,
    [registration.conversation_id, digits, registration.phone],
  );

  return result.rows[0]?.id || null;
}

async function upsertPhoneRegistrationUser(registration) {
  const existingId = await findOnboardingUser(registration);
  const params = [
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
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
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
        first_name = COALESCE($2, first_name),
        last_name = COALESCE($3, last_name),
        phone = COALESCE($4, phone),
        city = COALESCE($5, city),
        street = COALESCE($6, street),
        house_number = COALESCE($7, house_number),
        post_code = COALESCE($8, post_code),
        country = COALESCE($9, country),
        timezone = COALESCE($10, timezone),
        date_of_birth = COALESCE($11, date_of_birth),
        gender = COALESCE($12, gender),
        language = COALESCE($13, language),
        emergency_notes = COALESCE($14, emergency_notes),
        conversation_id = COALESCE($15, conversation_id),
        transcript = COALESCE($16, transcript),
        call_duration = COALESCE($17, call_duration),
        call_timestamp = COALESCE($18, call_timestamp),
        updated_at = now()
      WHERE id = $1
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
    await query("DELETE FROM public.vyva_user_caregivers WHERE vyva_user_id = $1", [userId]);
    for (const caregiver of registration.caregivers.map(objectValue)) {
      const name = nullIfBlank(firstValue(caregiver.caretaker_name, caregiver.name, caregiver.full_name, caregiver.fullName));
      const phone = nullIfBlank(firstValue(caregiver.caretaker_phone, caregiver.phone, caregiver.phone_number, caregiver.phoneNumber));
      if (!name && !phone) continue;
      await query(
        "INSERT INTO public.vyva_user_caregivers (vyva_user_id, caretaker_name, caretaker_phone) VALUES ($1, $2, $3)",
        [userId, name, phone],
      );
    }
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

app.get("/api/v1/user-dashboard/users", asyncRoute(async (_req, res) => {
  res.json(await loadDashboardUsers());
}));

app.post("/api/v1/user-dashboard/users", asyncRoute(async (req, res) => {
  const result = await createDashboardUser(req.body);
  if (result.error) {
    res.status(400).json({ error: result.error });
    return;
  }

  res.status(201).json({ user: result.value });
}));

app.get("/api/v1/user-dashboard/user-info", asyncRoute(async (req, res) => {
  const userId = String(req.query.user_id || "");
  if (!userId) {
    res.status(400).json({ error: "user_id is required" });
    return;
  }
  const data = await loadUserInfo(userId);
  if (!data) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json(data);
}));

async function updateUserRoute(req, res) {
  const result = await updateDashboardUser(req.params.id, req.body);
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

app.post("/api/v1/user-dashboard/medications", asyncRoute(async (req, res) => {
  sendWriteResult(res, await createMedication(req.body), 201);
}));

app.put("/api/v1/user-dashboard/medications/:med_id", asyncRoute(async (req, res) => {
  sendWriteResult(res, await updateMedication(req.params.med_id, req.body));
}));

app.delete("/api/v1/user-dashboard/medications/:med_id", asyncRoute(async (req, res) => {
  sendWriteResult(res, await deleteMedication(req.params.med_id));
}));

app.post("/api/v1/user-dashboard/caregivers", asyncRoute(async (req, res) => {
  sendWriteResult(res, await createCaregiver(req.body), 201);
}));

app.put("/api/v1/user-dashboard/caregivers/:caregiver_id", asyncRoute(async (req, res) => {
  sendWriteResult(res, await updateCaregiver(req.params.caregiver_id, req.body));
}));

app.delete("/api/v1/user-dashboard/caregivers/:caregiver_id", asyncRoute(async (req, res) => {
  sendWriteResult(res, await deleteCaregiver(req.params.caregiver_id));
}));

app.put("/api/v1/user-dashboard/health/:user_id", asyncRoute(async (req, res) => {
  sendWriteResult(res, await upsertHealth(req.params.user_id, req.body));
}));

app.put("/api/v1/user-dashboard/checkins/:checkin_id", asyncRoute(async (req, res) => {
  sendWriteResult(res, await updateCheckinConfig(req.params.checkin_id, req.body));
}));

app.put("/api/v1/user-dashboard/brain-coach/:user_id", asyncRoute(async (req, res) => {
  sendWriteResult(res, await upsertBrainCoachConfig(req.params.user_id, req.body));
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

app.post("/api/v1/onboarding/phone-registration", asyncRoute(phoneRegistrationRoute));
app.post("/api/v1/webhooks/phone-registration", asyncRoute(phoneRegistrationRoute));

app.get("/api/v1/campaigns-dashboard/campaigns", asyncRoute(async (_req, res) => {
  res.json({ campaigns: await loadCampaigns() });
}));

app.post("/api/v1/campaigns-dashboard/campaigns", asyncRoute(async (req, res) => {
  const validationError = validateCampaignPayload(req.body);
  if (validationError) {
    res.status(400).json({ error: validationError });
    return;
  }

  const type = String(req.body.type || "safety");
  const status = String(req.body.status || "draft");
  const result = await query(
    `
      INSERT INTO public.campaigns (
        name,
        objective,
        audience,
        due_key,
        city,
        owner,
        type,
        status,
        channel,
        tone
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id::text
    `,
    [
      String(req.body.name || "").trim(),
      String(req.body.objective || "").trim() || null,
      String(req.body.audience || "").trim() || null,
      String(req.body.dueKey || "campaigns.due.draft"),
      String(req.body.city || "").trim() || null,
      String(req.body.owner || "Ana Novak").trim(),
      type,
      status,
      String(req.body.channel || "phone"),
      campaignTone(type, status),
    ],
  );

  const campaigns = await loadCampaigns();
  res.status(201).json({ campaign: campaigns.find((campaign) => campaign.id === result.rows[0]?.id) || null });
}));

app.patch("/api/v1/campaigns-dashboard/campaigns/:id", asyncRoute(async (req, res) => {
  const validationError = validateCampaignPayload(req.body);
  if (validationError) {
    res.status(400).json({ error: validationError });
    return;
  }

  const type = String(req.body.type || "safety");
  const status = String(req.body.status || "draft");
  await query(
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
        tone = $11
      WHERE id = $1
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
      campaignTone(type, status),
    ],
  );

  await query("DELETE FROM public.campaign_targets WHERE campaign_id = $1", [req.params.id]);
  const campaigns = await loadCampaigns();
  res.json({ campaign: campaigns.find((campaign) => campaign.id === req.params.id) || null });
}));

app.get("/api/v1/operational/offices", asyncRoute(async (_req, res) => {
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
    WHERE active = true
    ORDER BY name ASC
  `);

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

app.get("/api/v1/operational/field-staff", asyncRoute(async (_req, res) => {
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
    WHERE active = true
    ORDER BY full_name ASC
  `);

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

app.get("/api/v1/checkins-dashboard/checkins", asyncRoute(async (_req, res) => {
  res.json({ checkins: await loadCheckins() });
}));

app.post("/api/v1/checkins-dashboard/checkins", asyncRoute(async (req, res) => {
  const validationError = validateCheckinPayload(req.body, true);
  if (validationError) {
    res.status(400).json({ error: validationError });
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

  const checkins = await loadCheckins();
  res.status(201).json(checkins.find((item) => item.id === result.rows[0]?.id) || { id: result.rows[0]?.id });
}));

app.patch("/api/v1/checkins-dashboard/checkins/:id", asyncRoute(async (req, res) => {
  const validationError = validateCheckinPayload(req.body);
  if (validationError) {
    res.status(400).json({ error: validationError });
    return;
  }

  await query(
    `
      UPDATE public.vyva_user_checkins
      SET enabled = $2, frequency = $3, preferred_time = $4
      WHERE id = $1
    `,
    [req.params.id, Boolean(req.body.is_active), String(req.body.frequency_days), req.body.preferred_time || null],
  );

  const checkins = await loadCheckins();
  res.json(checkins.find((item) => item.id === req.params.id) || { id: req.params.id });
}));

app.delete("/api/v1/checkins-dashboard/checkins/:id", asyncRoute(async (req, res) => {
  await query("DELETE FROM public.vyva_user_checkins WHERE id = $1", [req.params.id]);
  res.status(204).end();
}));

app.post("/api/v1/medications/weekly-schedule", asyncRoute(async (req, res) => {
  const userId = req.body?.user_id;
  const start = req.body?.date_start;
  const end = req.body?.date_end;
  if (!userId || !start || !end) {
    res.status(400).json({ error: "user_id, date_start, and date_end are required" });
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
}));

app.use((error, _req, res, _next) => {
  console.error(error);
  const status = error.code === "23505" ? 409 : error.code === "DB_NOT_CONFIGURED" ? 503 : 500;
  res.status(status).json({
    error: status === 409 ? "Record already exists" : "Server error",
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
