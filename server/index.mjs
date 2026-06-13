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
