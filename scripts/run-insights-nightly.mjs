import pg from "pg";

const { Pool } = pg;

const databaseUrl = process.env.DATABASE_URL || process.env.LOVABLE_DATABASE_URL || process.env.POSTGRES_URL;

if (!databaseUrl) {
  console.error("DATABASE_URL is not set. Add a database connection before running predictive insights.");
  process.exit(1);
}

function argValue(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

function sslConfig(connectionString) {
  if (process.env.DATABASE_SSL === "false" || connectionString.includes("sslmode=disable")) return false;
  if (process.env.DATABASE_SSL === "true" || connectionString.includes("sslmode=require")) {
    return { rejectUnauthorized: false };
  }
  return undefined;
}

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: sslConfig(databaseUrl),
});

const SIGNAL_WEIGHTS = {
  mood_risk: 0.25,
  medication_risk: 0.25,
  response_risk: 0.2,
  checkin_risk: 0.15,
  brain_coach_risk: 0.1,
  manual_flag_risk: 0.05,
};

const HOURS_PER_WEEK_BY_BAND = {
  low: 1.5,
  moderate: 3,
  high: 5,
};

function formatDate(value) {
  return new Date(value).toISOString().slice(0, 10);
}

function addDays(dateText, days) {
  const date = new Date(`${dateText}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return formatDate(date);
}

function mondayOfWeek(dateText) {
  const date = new Date(`${dateText}T00:00:00Z`);
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - day + 1);
  return formatDate(date);
}

function clamp(value, min = 0, max = 100) {
  return Math.min(max, Math.max(min, Number(value) || 0));
}

function round(value, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round((Number(value) || 0) * factor) / factor;
}

function parseFrequencyDays(value) {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) return value;
  if (typeof value === "string") {
    const normalized = value.toLowerCase().trim();
    const numeric = Number(normalized);
    if (Number.isInteger(numeric) && numeric > 0) return numeric;
    const match = normalized.match(/\d+/);
    if (match) return Number(match[0]);
    if (normalized === "daily") return 1;
    if (normalized === "weekly") return 7;
    if (normalized === "biweekly") return 14;
    if (normalized === "monthly") return 30;
  }
  return 1;
}

function riskBand(score) {
  if (score >= 67) return "high";
  if (score >= 38) return "moderate";
  return "low";
}

function severityForRisk(risk) {
  if (risk >= 67) return "high";
  if (risk >= 38) return "moderate";
  return "low";
}

function signalLabel(signal, rawInputs) {
  if (signal === "medication_risk") {
    const adherence = Number.isFinite(rawInputs.adherence_pct) ? Math.round(rawInputs.adherence_pct) : 100;
    return `Meds ${adherence}%`;
  }
  if (signal === "mood_risk") return "Mood declining";
  if (signal === "response_risk") {
    const missed = Number(rawInputs.missed_calls_7d || rawInputs.no_response_alerts_7d || 0);
    return missed > 0 ? `${missed} missed calls` : "No response";
  }
  if (signal === "checkin_risk") return "Check-in overdue";
  if (signal === "brain_coach_risk") return "Brain Coach down 7d";
  return "Manual flag";
}

function contributingFactors(signal) {
  const rawInputs = signal.raw_inputs || {};
  const factorRows = Object.entries(SIGNAL_WEIGHTS)
    .map(([key, weight]) => {
      const risk = Number(signal[key] || 0);
      return {
        signal: key.replace("_risk", ""),
        label: signalLabel(key, rawInputs),
        severity: severityForRisk(risk),
        contribution: risk * weight,
      };
    })
    .filter((item) => item.contribution > 0)
    .sort((a, b) => b.contribution - a.contribution)
    .slice(0, 3)
    .map(({ contribution, ...item }) => item);

  if (rawInputs.unassigned_operator) {
    return [
      { signal: "assignment", label: "Unassigned operator", severity: "high" },
      ...factorRows.filter((item) => item.signal !== "assignment"),
    ].slice(0, 4);
  }

  return factorRows;
}

function computeComposite(signal) {
  return round(
    Object.entries(SIGNAL_WEIGHTS).reduce(
      (total, [key, weight]) => total + Number(signal[key] || 0) * weight,
      0,
    ),
  );
}

function leastSquaresSlope(history) {
  if (history.length < 2) return 0;
  const xs = history.map((_, index) => index);
  const ys = history.map((item) => Number(item.composite_score || 0));
  const xMean = xs.reduce((sum, value) => sum + value, 0) / xs.length;
  const yMean = ys.reduce((sum, value) => sum + value, 0) / ys.length;
  const numerator = xs.reduce((sum, x, index) => sum + (x - xMean) * (ys[index] - yMean), 0);
  const denominator = xs.reduce((sum, x) => sum + (x - xMean) ** 2, 0);
  return denominator === 0 ? 0 : numerator / denominator;
}

function volatility(history) {
  if (history.length < 2) return 0;
  const values = history.map((item) => Number(item.composite_score || 0));
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function dominantSignal(factors = []) {
  const first = Array.isArray(factors) ? factors[0] : null;
  return String(first?.signal || "").toLowerCase();
}

async function loadSignalRows(runDate) {
  const result = await pool.query(
    `
      WITH medication_counts AS (
        SELECT
          m.vyva_user_id,
          COUNT(DISTINCT m.id)::int AS medication_count,
          COUNT(l.id)::int AS scheduled_count_7d,
          COUNT(l.id) FILTER (WHERE l.status IN ('confirmed', 'taken'))::int AS confirmed_count_7d,
          COUNT(l.id) FILTER (WHERE l.status IN ('missed', 'unconfirmed', 'pending'))::int AS missed_count_7d
        FROM public.vyva_user_medications m
        LEFT JOIN public.vyva_medication_logs l ON l.medication_id = m.id
          AND l.scheduled_date >= $1::date - INTERVAL '6 days'
          AND l.scheduled_date <= $1::date
        GROUP BY m.vyva_user_id
      ),
      alert_counts AS (
        SELECT
          vyva_user_id,
          COUNT(*) FILTER (
            WHERE resolved_at IS NULL
              AND (
                alert_type IN ('lower_mood', 'mood_decline', 'low_mood', 'sentiment_decline')
                OR COALESCE(message, '') ILIKE '%mood%'
              )
          )::int AS mood_alerts,
          COUNT(*) FILTER (
            WHERE resolved_at IS NULL
              AND (
                alert_type IN ('missed_checkin', 'inactivity_detected', 'no_response', 'noresponse')
                OR COALESCE(message, '') ILIKE '%no response%'
              )
          )::int AS no_response_alerts,
          COUNT(*) FILTER (
            WHERE resolved_at IS NULL
              AND (
                alert_type IN ('brain_coach_decline', 'cognitive_decline')
                OR COALESCE(message, '') ILIKE '%brain coach%'
              )
          )::int AS brain_coach_alerts
        FROM public.vyva_sensor_alerts
        WHERE created_at >= $1::date - INTERVAL '6 days'
          AND created_at < $1::date + INTERVAL '1 day'
        GROUP BY vyva_user_id
      ),
      primary_assignments AS (
        SELECT DISTINCT ON (a.vyva_user_id)
          a.vyva_user_id,
          a.field_staff_id
        FROM public.vyva_user_care_provider_assignments a
        WHERE a.provider_type = 'field_staff'
        ORDER BY a.vyva_user_id, a.is_primary DESC, a.created_at DESC
      ),
      manual_flags AS (
        SELECT client_id, manual_flag_risk
        FROM public.client_risk_signals_daily
        WHERE signal_date = $1::date
      )
      SELECT
        u.id::text AS client_id,
        u.organization_id::text,
        u.first_name || ' ' || u.last_name AS client_name,
        COALESCE(m.medication_count, 0) AS medication_count,
        COALESCE(m.scheduled_count_7d, 0) AS scheduled_count_7d,
        COALESCE(m.confirmed_count_7d, 0) AS confirmed_count_7d,
        COALESCE(m.missed_count_7d, 0) AS missed_count_7d,
        COALESCE(c.enabled, false) AS checkin_enabled,
        c.frequency AS checkin_frequency,
        c.paused_until,
        COALESCE(bc.enabled, false) AS brain_coach_enabled,
        bc.paused_until AS brain_coach_paused_until,
        COALESCE(ac.mood_alerts, 0) AS mood_alerts,
        COALESCE(ac.no_response_alerts, 0) AS no_response_alerts,
        COALESCE(ac.brain_coach_alerts, 0) AS brain_coach_alerts,
        pa.field_staff_id::text AS assigned_operator_id,
        COALESCE(mf.manual_flag_risk, 0) AS manual_flag_risk
      FROM public.vyva_users u
      LEFT JOIN medication_counts m ON m.vyva_user_id = u.id
      LEFT JOIN public.vyva_user_checkins c ON c.vyva_user_id = u.id
      LEFT JOIN public.vyva_user_brain_coach bc ON bc.vyva_user_id = u.id
      LEFT JOIN alert_counts ac ON ac.vyva_user_id = u.id
      LEFT JOIN primary_assignments pa ON pa.vyva_user_id = u.id
      LEFT JOIN manual_flags mf ON mf.client_id = u.id
      WHERE u.organization_id IS NOT NULL
      ORDER BY u.organization_id, u.created_at ASC
    `,
    [runDate],
  );

  return result.rows.map((row) => {
    const scheduledCount = Number(row.scheduled_count_7d || 0);
    const confirmedCount = Number(row.confirmed_count_7d || 0);
    const medicationCount = Number(row.medication_count || 0);
    const adherencePct = scheduledCount > 0 ? (confirmedCount / scheduledCount) * 100 : medicationCount > 0 ? 90 : 100;
    const pausedUntil = row.paused_until ? new Date(row.paused_until).getTime() : 0;
    const brainCoachPausedUntil = row.brain_coach_paused_until ? new Date(row.brain_coach_paused_until).getTime() : 0;
    const frequencyDays = parseFrequencyDays(row.checkin_frequency);
    const expectedCheckins = row.checkin_enabled ? Math.max(1, Math.ceil(7 / frequencyDays)) : 0;
    const isCheckinPaused = pausedUntil > Date.now();
    const isBrainCoachPaused = brainCoachPausedUntil > Date.now();
    const moodAlerts = Number(row.mood_alerts || 0);
    const noResponseAlerts = Number(row.no_response_alerts || 0);
    const brainCoachAlerts = Number(row.brain_coach_alerts || 0);

    const signal = {
      organization_id: row.organization_id,
      client_id: row.client_id,
      client_name: row.client_name,
      mood_risk: clamp(moodAlerts * 35),
      medication_risk: clamp(100 - adherencePct),
      checkin_risk: row.checkin_enabled ? (isCheckinPaused ? 40 : 0) : 70,
      response_risk: clamp(noResponseAlerts * 35),
      brain_coach_risk: clamp(brainCoachAlerts * 35 + (isBrainCoachPaused ? 15 : 0)),
      manual_flag_risk: clamp(row.manual_flag_risk),
      raw_inputs: {
        adherence_pct: round(adherencePct),
        missed_meds_7d: Number(row.missed_count_7d || 0),
        scheduled_meds_7d: scheduledCount,
        no_response_alerts_7d: noResponseAlerts,
        missed_calls_7d: noResponseAlerts,
        mood_alerts_7d: moodAlerts,
        brain_coach_alerts_7d: brainCoachAlerts,
        checkins_expected_7d: expectedCheckins,
        checkins_completed_7d: null,
        unassigned_operator: !row.assigned_operator_id,
      },
    };

    return signal;
  });
}

async function upsertSignals(client, signals, runDate) {
  for (const signal of signals) {
    await client.query(
      `
        INSERT INTO public.client_risk_signals_daily (
          organization_id,
          client_id,
          signal_date,
          mood_risk,
          medication_risk,
          checkin_risk,
          response_risk,
          brain_coach_risk,
          manual_flag_risk,
          raw_inputs,
          computed_at
        )
        VALUES ($1, $2, $3::date, $4, $5, $6, $7, $8, $9, $10::jsonb, now())
        ON CONFLICT (client_id, signal_date) DO UPDATE SET
          organization_id = EXCLUDED.organization_id,
          mood_risk = EXCLUDED.mood_risk,
          medication_risk = EXCLUDED.medication_risk,
          checkin_risk = EXCLUDED.checkin_risk,
          response_risk = EXCLUDED.response_risk,
          brain_coach_risk = EXCLUDED.brain_coach_risk,
          raw_inputs = EXCLUDED.raw_inputs,
          computed_at = now()
      `,
      [
        signal.organization_id,
        signal.client_id,
        runDate,
        signal.mood_risk,
        signal.medication_risk,
        signal.checkin_risk,
        signal.response_risk,
        signal.brain_coach_risk,
        signal.manual_flag_risk,
        JSON.stringify(signal.raw_inputs),
      ],
    );
  }
}

async function upsertScores(client, signals, runDate) {
  const priorResult = await client.query(
    `
      SELECT DISTINCT ON (client_id)
        client_id::text,
        composite_score
      FROM public.client_risk_scores_daily
      WHERE score_date < $1::date
      ORDER BY client_id, score_date DESC
    `,
    [runDate],
  );
  const priorScores = new Map(priorResult.rows.map((row) => [row.client_id, Number(row.composite_score || 0)]));
  const scoreRows = [];

  for (const signal of signals) {
    const compositeScore = computeComposite(signal);
    const priorScore = priorScores.get(signal.client_id);
    const delta = Number.isFinite(priorScore) ? round(compositeScore - priorScore) : null;
    const factors = contributingFactors(signal);
    const band = riskBand(compositeScore);

    await client.query(
      `
        INSERT INTO public.client_risk_scores_daily (
          organization_id,
          client_id,
          score_date,
          composite_score,
          risk_band,
          delta_from_prior,
          contributing_factors,
          created_at
        )
        VALUES ($1, $2, $3::date, $4, $5, $6, $7::jsonb, now())
        ON CONFLICT (client_id, score_date) DO UPDATE SET
          organization_id = EXCLUDED.organization_id,
          composite_score = EXCLUDED.composite_score,
          risk_band = EXCLUDED.risk_band,
          delta_from_prior = EXCLUDED.delta_from_prior,
          contributing_factors = EXCLUDED.contributing_factors,
          created_at = now()
      `,
      [
        signal.organization_id,
        signal.client_id,
        runDate,
        compositeScore,
        band,
        delta,
        JSON.stringify(factors),
      ],
    );

    scoreRows.push({
      organization_id: signal.organization_id,
      client_id: signal.client_id,
      composite_score: compositeScore,
      risk_band: band,
      delta_from_prior: delta,
      contributing_factors: factors,
      client_name: signal.client_name,
    });
  }

  return scoreRows;
}

async function upsertForecasts(client, scoreRows, runDate, generatedAt) {
  const historyResult = await client.query(
    `
      SELECT
        organization_id::text,
        client_id::text,
        score_date::text,
        composite_score
      FROM public.client_risk_scores_daily
      WHERE score_date >= $1::date - INTERVAL '13 days'
        AND score_date <= $1::date
      ORDER BY client_id, score_date ASC
    `,
    [runDate],
  );
  const histories = new Map();
  for (const row of historyResult.rows) {
    const list = histories.get(row.client_id) || [];
    list.push(row);
    histories.set(row.client_id, list);
  }

  const forecasts = [];
  for (const score of scoreRows) {
    const history = histories.get(score.client_id) || [{ composite_score: score.composite_score }];
    const slope = leastSquaresSlope(history);
    const historyVolatility = volatility(history);
    const baseSpread = 5 + Math.min(historyVolatility / 4, 5);
    const spreadGrowthRate = 1 + Math.min(historyVolatility / 20, 0.6);
    const historyGapPenalty = Math.max(0, (14 - history.length) / 14) * 0.25;
    const lastScore = Number(history[history.length - 1]?.composite_score ?? score.composite_score);

    for (let horizonDay = 1; horizonDay <= 30; horizonDay += 1) {
      const dampedTrend = slope * horizonDay * (0.97 ** horizonDay);
      const predictedScore = round(clamp(lastScore + dampedTrend));
      const spread = baseSpread + horizonDay * spreadGrowthRate;
      const predictedLow = round(clamp(predictedScore - spread));
      const predictedHigh = round(clamp(predictedScore + spread));
      const modelConfidence = round(clamp(1 - (horizonDay / 30) * 0.6 - historyGapPenalty, 0.2, 0.95), 3);
      const forecast = {
        organization_id: score.organization_id,
        client_id: score.client_id,
        forecast_generated_at: generatedAt,
        forecast_date: addDays(runDate, horizonDay),
        horizon_day: horizonDay,
        predicted_score: predictedScore,
        predicted_low: predictedLow,
        predicted_high: predictedHigh,
        model_confidence: modelConfidence,
        factors: score.contributing_factors,
      };

      await client.query(
        `
          INSERT INTO public.client_risk_forecasts (
            organization_id,
            client_id,
            forecast_generated_at,
            forecast_date,
            horizon_day,
            predicted_score,
            predicted_low,
            predicted_high,
            model_confidence
          )
          VALUES ($1, $2, $3::timestamptz, $4::date, $5, $6, $7, $8, $9)
          ON CONFLICT (client_id, forecast_generated_at, horizon_day) DO UPDATE SET
            organization_id = EXCLUDED.organization_id,
            forecast_date = EXCLUDED.forecast_date,
            predicted_score = EXCLUDED.predicted_score,
            predicted_low = EXCLUDED.predicted_low,
            predicted_high = EXCLUDED.predicted_high,
            model_confidence = EXCLUDED.model_confidence
        `,
        [
          forecast.organization_id,
          forecast.client_id,
          forecast.forecast_generated_at,
          forecast.forecast_date,
          forecast.horizon_day,
          forecast.predicted_score,
          forecast.predicted_low,
          forecast.predicted_high,
          forecast.model_confidence,
        ],
      );

      forecasts.push(forecast);
    }
  }

  return forecasts;
}

async function upsertOperatorCapacity(client, runDate, scoreRows) {
  const weekStart = mondayOfWeek(runDate);
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
          AND a.field_staff_id IS NOT NULL
        GROUP BY a.field_staff_id
      )
      INSERT INTO public.operator_capacity_weekly (
        organization_id,
        operator_id,
        week_start,
        capacity_hours,
        current_caseload,
        recommended_caseload,
        updated_at
      )
      SELECT
        fs.organization_id,
        fs.id,
        $1::date,
        GREATEST(COALESCE(NULLIF(fs.capacity, 0), 8) * 4, 8),
        COALESCE(cc.current_caseload, 0),
        COALESCE(ocw.recommended_caseload, 0),
        now()
      FROM public.field_staff fs
      LEFT JOIN current_counts cc ON cc.field_staff_id = fs.id
      LEFT JOIN public.operator_capacity_weekly ocw ON ocw.operator_id = fs.id AND ocw.week_start = $1::date
      WHERE fs.active = true
        AND fs.organization_id IS NOT NULL
      ON CONFLICT (operator_id, week_start) DO UPDATE SET
        organization_id = EXCLUDED.organization_id,
        current_caseload = EXCLUDED.current_caseload,
        updated_at = now()
    `,
    [weekStart],
  );

  const capacityResult = await client.query(
    `
      SELECT
        operator_id::text,
        organization_id::text,
        capacity_hours,
        current_caseload
      FROM public.operator_capacity_weekly
      WHERE week_start = $1::date
    `,
    [weekStart],
  );
  const capacities = capacityResult.rows.map((row) => ({
    operator_id: row.operator_id,
    organization_id: row.organization_id,
    capacity_hours: Number(row.capacity_hours || 0),
    current_caseload: Number(row.current_caseload || 0),
  }));

  const scoresByOrg = Map.groupBy
    ? Map.groupBy(scoreRows, (row) => row.organization_id)
    : scoreRows.reduce((map, row) => {
        const list = map.get(row.organization_id) || [];
        list.push(row);
        map.set(row.organization_id, list);
        return map;
      }, new Map());

  const capacitiesByOrg = capacities.reduce((map, row) => {
    const list = map.get(row.organization_id) || [];
    list.push(row);
    map.set(row.organization_id, list);
    return map;
  }, new Map());

  for (const [organizationId, orgCapacities] of capacitiesByOrg) {
    const orgScores = scoresByOrg.get(organizationId) || [];
    const totalHours = orgScores.reduce((sum, row) => sum + HOURS_PER_WEEK_BY_BAND[row.risk_band], 0);
    const avgHoursPerCase = orgScores.length ? Math.max(1, totalHours / orgScores.length) : 3;
    const perOperatorCaseShare = orgCapacities.length ? Math.round(orgScores.length / orgCapacities.length) : 0;

    for (const row of orgCapacities) {
      const maxByCapacity = Math.max(1, Math.floor(row.capacity_hours / avgHoursPerCase));
      const recommended = Math.min(maxByCapacity, Math.max(0, perOperatorCaseShare));
      await client.query(
        `
          UPDATE public.operator_capacity_weekly
          SET recommended_caseload = $3, updated_at = now()
          WHERE operator_id = $1 AND week_start = $2::date
        `,
        [row.operator_id, weekStart, recommended],
      );
      row.recommended_caseload = recommended;
      row.max_caseload = maxByCapacity;
    }
  }

  return { weekStart, capacities };
}

async function upsertResourceForecast(client, forecasts, scoreRows, generatedAt) {
  const latestByClient = new Map(scoreRows.map((row) => [row.client_id, row]));
  const groupedByOrgDate = forecasts.reduce((map, forecast) => {
    const key = `${forecast.organization_id}|${forecast.forecast_date}`;
    const list = map.get(key) || [];
    list.push(forecast);
    map.set(key, list);
    return map;
  }, new Map());

  const capacityRows = await client.query(
    `
      SELECT organization_id::text, SUM(capacity_hours)::numeric AS capacity_hours
      FROM public.operator_capacity_weekly
      WHERE week_start = date_trunc('week', $1::timestamptz)::date
      GROUP BY organization_id
    `,
    [generatedAt],
  );
  const capacityByOrg = new Map(
    capacityRows.rows.map((row) => [row.organization_id, Number(row.capacity_hours || 0)]),
  );

  for (const [key, list] of groupedByOrgDate) {
    const [organizationId, forecastDate] = key.split("|");
    const summary = list.reduce(
      (acc, forecast) => {
        const band = riskBand(Number(forecast.predicted_score || 0));
        const latest = latestByClient.get(forecast.client_id);
        const dominant = dominantSignal(latest?.contributing_factors);
        if (band === "high") acc.urgent += 1;
        if (band === "moderate" || band === "high") acc.review += 1;
        if (dominant.includes("medication")) acc.medication += 1;
        if (dominant.includes("response")) acc.noResponse += 1;
        acc.hoursNeeded += HOURS_PER_WEEK_BY_BAND[band] / 7;
        return acc;
      },
      { urgent: 0, review: 0, medication: 0, noResponse: 0, hoursNeeded: 0 },
    );

    await client.query(
      `
        INSERT INTO public.daily_resource_forecast (
          organization_id,
          forecast_date,
          predicted_urgent_count,
          predicted_review_count,
          predicted_medication_count,
          predicted_noresponse_count,
          predicted_hours_needed,
          available_hours,
          generated_at
        )
        VALUES ($1, $2::date, $3, $4, $5, $6, $7, $8, $9::timestamptz)
        ON CONFLICT (organization_id, forecast_date, generated_at) DO UPDATE SET
          predicted_urgent_count = EXCLUDED.predicted_urgent_count,
          predicted_review_count = EXCLUDED.predicted_review_count,
          predicted_medication_count = EXCLUDED.predicted_medication_count,
          predicted_noresponse_count = EXCLUDED.predicted_noresponse_count,
          predicted_hours_needed = EXCLUDED.predicted_hours_needed,
          available_hours = EXCLUDED.available_hours
      `,
      [
        organizationId,
        forecastDate,
        summary.urgent,
        summary.review,
        summary.medication,
        summary.noResponse,
        round(summary.hoursNeeded),
        round((capacityByOrg.get(organizationId) || 0) / 7),
        generatedAt,
      ],
    );
  }
}

async function upsertSuggestion(client, organizationId, runDate, fromOperatorId, toOperatorId, clientIds, reason) {
  const result = await client.query(
    `
      INSERT INTO public.reassignment_suggestions (
        organization_id,
        generation_date,
        from_operator_id,
        to_operator_id,
        reason,
        status,
        suggested_at
      )
      VALUES ($1, $2::date, $3, $4, $5, 'pending', now())
      RETURNING id::text
    `,
    [organizationId, runDate, fromOperatorId, toOperatorId, reason],
  );
  const suggestionId = result.rows[0].id;
  for (const clientId of clientIds) {
    await client.query(
      `
        INSERT INTO public.reassignment_suggestion_clients (suggestion_id, client_id)
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING
      `,
      [suggestionId, clientId],
    );
  }
}

async function generateSuggestions(client, runDate, weekStart) {
  const rows = await client.query(
    `
      WITH latest_scores AS (
        SELECT DISTINCT ON (s.client_id)
          s.client_id,
          s.organization_id,
          s.composite_score,
          s.risk_band,
          s.delta_from_prior
        FROM public.client_risk_scores_daily s
        WHERE s.score_date = $1::date
        ORDER BY s.client_id, s.score_date DESC
      ),
      primary_assignments AS (
        SELECT DISTINCT ON (a.vyva_user_id)
          a.vyva_user_id,
          a.field_staff_id
        FROM public.vyva_user_care_provider_assignments a
        WHERE a.provider_type = 'field_staff'
        ORDER BY a.vyva_user_id, a.is_primary DESC, a.created_at DESC
      )
      SELECT
        u.id::text AS client_id,
        u.first_name || ' ' || u.last_name AS client_name,
        u.organization_id::text,
        pa.field_staff_id::text AS operator_id,
        COALESCE(ls.composite_score, 0) AS composite_score,
        COALESCE(ls.risk_band, 'low') AS risk_band,
        COALESCE(ls.delta_from_prior, 0) AS delta_from_prior
      FROM public.vyva_users u
      LEFT JOIN latest_scores ls ON ls.client_id = u.id
      LEFT JOIN primary_assignments pa ON pa.vyva_user_id = u.id
      WHERE u.organization_id IS NOT NULL
    `,
    [runDate],
  );
  const operatorResult = await client.query(
    `
      SELECT
        ocw.operator_id::text,
        ocw.organization_id::text,
        ocw.capacity_hours,
        ocw.current_caseload,
        ocw.recommended_caseload,
        fs.full_name
      FROM public.operator_capacity_weekly ocw
      JOIN public.field_staff fs ON fs.id = ocw.operator_id
      WHERE ocw.week_start = $1::date
    `,
    [weekStart],
  );

  const operatorsByOrg = operatorResult.rows.reduce((map, row) => {
    const list = map.get(row.organization_id) || [];
    const capacityHours = Number(row.capacity_hours || 0);
    const current = Number(row.current_caseload || 0);
    const recommended = Number(row.recommended_caseload || 0);
    list.push({
      id: row.operator_id,
      organization_id: row.organization_id,
      name: row.full_name,
      capacity_hours: capacityHours,
      current_caseload: current,
      recommended_caseload: recommended,
      max_caseload: Math.max(recommended, Math.floor(capacityHours / 3)),
    });
    map.set(row.organization_id, list);
    return map;
  }, new Map());

  const clientsByOrg = rows.rows.reduce((map, row) => {
    const list = map.get(row.organization_id) || [];
    list.push({
      ...row,
      composite_score: Number(row.composite_score || 0),
      delta_from_prior: Number(row.delta_from_prior || 0),
    });
    map.set(row.organization_id, list);
    return map;
  }, new Map());

  for (const [organizationId, orgOperators] of operatorsByOrg) {
    await client.query(
      `
        DELETE FROM public.reassignment_suggestions
        WHERE organization_id = $1
          AND generation_date = $2::date
          AND status = 'pending'
      `,
      [organizationId, runDate],
    );

    const orgClients = clientsByOrg.get(organizationId) || [];
    const headroom = orgOperators
      .map((operator) => ({
        ...operator,
        headroom: Math.max(0, operator.max_caseload - operator.current_caseload),
      }))
      .filter((operator) => operator.headroom > 0)
      .sort((a, b) => b.headroom - a.headroom || a.current_caseload - b.current_caseload);

    if (!headroom.length) continue;

    const unassigned = orgClients
      .filter((item) => !item.operator_id)
      .sort((a, b) => b.composite_score - a.composite_score || b.delta_from_prior - a.delta_from_prior);

    for (const clientRow of unassigned.slice(0, Math.min(unassigned.length, headroom.length))) {
      const target = headroom[0];
      const reason = `${clientRow.client_name}'s risk score is rising with no assigned operator - ${target.name} has the most available hours.`;
      await upsertSuggestion(client, organizationId, runDate, null, target.id, [clientRow.client_id], reason);
      target.headroom -= 1;
      target.current_caseload += 1;
      headroom.sort((a, b) => b.headroom - a.headroom || a.current_caseload - b.current_caseload);
    }

    const overloaded = orgOperators
      .filter((operator) => operator.current_caseload > operator.max_caseload)
      .sort((a, b) => (b.current_caseload - b.max_caseload) - (a.current_caseload - a.max_caseload));

    for (const source of overloaded) {
      const target = headroom.find((operator) => operator.headroom > 0 && operator.id !== source.id);
      if (!target) break;
      const sourceClients = orgClients
        .filter((item) => item.operator_id === source.id)
        .sort((a, b) => {
          const bandDelta = (b.risk_band === "high" ? 2 : b.risk_band === "moderate" ? 1 : 0) -
            (a.risk_band === "high" ? 2 : a.risk_band === "moderate" ? 1 : 0);
          return bandDelta || b.delta_from_prior - a.delta_from_prior || b.composite_score - a.composite_score;
        })
        .slice(0, Math.min(2, target.headroom));
      if (!sourceClients.length) continue;
      const reason = `${source.name} is over capacity (${source.current_caseload}/${source.max_caseload} cases). ${target.name} has ${round(target.capacity_hours - target.current_caseload * 3)}h of headroom this week.`;
      await upsertSuggestion(
        client,
        organizationId,
        runDate,
        source.id,
        target.id,
        sourceClients.map((item) => item.client_id),
        reason,
      );
      target.headroom -= sourceClients.length;
      target.current_caseload += sourceClients.length;
    }
  }
}

async function run() {
  const runDate = argValue("--date") || process.env.INSIGHTS_RUN_DATE || formatDate(new Date());
  const generatedAt = `${runDate}T02:00:00.000Z`;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const signals = await loadSignalRows(runDate);
    await upsertSignals(client, signals, runDate);
    const scoreRows = await upsertScores(client, signals, runDate);
    const forecasts = await upsertForecasts(client, scoreRows, runDate, generatedAt);
    const { weekStart } = await upsertOperatorCapacity(client, runDate, scoreRows);
    await upsertResourceForecast(client, forecasts, scoreRows, generatedAt);
    await generateSuggestions(client, runDate, weekStart);
    await client.query("COMMIT");
    console.log(`Predictive insights generated for ${runDate}: ${signals.length} clients, ${forecasts.length} forecast rows.`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

try {
  await run();
} finally {
  await pool.end();
}
