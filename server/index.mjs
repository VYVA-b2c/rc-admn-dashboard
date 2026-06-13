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

async function createDashboardUser(payload) {
  const user = normalizeUserPayload(payload, true);
  if (user.error) return user;

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

  return { value: result.rows[0] };
}

async function updateDashboardUser(userId, payload) {
  const user = normalizeUserPayload(payload);
  if (user.error) return user;

  const result = await query(
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

  if (!result.rows[0]) return { notFound: true };
  return { value: result.rows[0] };
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

await initializeDatabase();

app.listen(port, host, () => {
  const mode = isProduction ? "production" : "development";
  const dbState = pool ? "configured" : "missing DATABASE_URL";
  console.log(`RC admin server running in ${mode} on http://${host}:${port} with database ${dbState}`);
});
