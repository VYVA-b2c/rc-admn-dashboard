import express from "express";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { buildHealthPlanSignalTriage } from "../src/lib/healthPlanSignalTriage.js";
import { enrichHealthPlanSections } from "../src/lib/healthPlanRecommendationMetadata.js";
import { findHealthPlanRecommendationCarryForwardIssues } from "../src/lib/healthPlanCarryForwardRules.js";
import { buildHealthPlanClinicalCautions, findHealthPlanClinicalCautionIssues } from "../src/lib/healthPlanClinicalCautions.js";
import { buildHealthPlanConfidenceProfile } from "../src/lib/healthPlanConfidenceProfile.js";
import { buildHealthPlanRefreshStrategy, expandHealthPlanRefreshSections } from "../src/lib/healthPlanRefreshStrategy.js";
import { annotateHealthPlanHistory, buildHealthPlanRevisionChange } from "../src/lib/healthPlanRevisionDiff.js";
import { buildHealthPlanDataQualityGaps } from "../src/lib/healthPlanDataQualityGaps.js";
import { buildHealthPlanFollowThroughSummary } from "../src/lib/healthPlanFollowThrough.js";
import { buildHealthPlanFreshnessSnapshot } from "../src/lib/healthPlanFreshness.js";
import { buildHealthPlanInferredFeedbackEntries } from "../src/lib/healthPlanInferredFeedback.js";
import { buildHealthPlanOperationalActivitySummary, normalizeHealthPlanOperationalEvents } from "../src/lib/healthPlanOperationalEvents.js";
import { buildHealthPlanSectionDrift } from "../src/lib/healthPlanSectionDrift.js";
import { findHealthPlanCoverageIssues } from "../src/lib/healthPlanCoverageRules.js";
import {
  buildHealthPlanEscalationGrade,
  buildHealthPlanEscalationGradeBrief,
  buildHealthPlanReviewGovernance,
  findHealthPlanEscalationGradeIssues,
} from "../src/lib/healthPlanEscalationGrade.js";
import {
  applyHealthPlanReviewChecklistAudit,
  isHealthPlanReviewChecklistComplete,
  missingHealthPlanReviewChecklistItems,
  normalizeHealthPlanReviewChecklist,
} from "../src/lib/healthPlanReviewChecklist.js";
import { findHealthPlanSafetyIssues } from "../src/lib/healthPlanSafetyReview.js";
import { repairOperationalMonitoringLanguage } from "../src/lib/healthPlanMonitoringRepair.js";
import {
  buildHealthPlanEvidenceConflicts,
  buildHealthPlanEvidenceHierarchy,
  buildHealthPlanEvidenceHierarchyBrief,
} from "../src/lib/healthPlanEvidenceHierarchy.js";
import {
  buildHealthPlanInterventionMemory,
  buildHealthPlanInterventionMemoryBrief,
} from "../src/lib/healthPlanInterventionMemory.js";
import {
  buildHealthPlanOutcomeScores,
  buildHealthPlanOutcomeScoreBrief,
  buildHealthPlanRecommendationOutcomeMemory,
  buildHealthPlanSignalPreferenceWeights,
} from "../src/lib/healthPlanOutcomeScores.js";
import { buildHealthPlanRecommendationSurvivorship } from "../src/lib/healthPlanRecommendationSurvivorship.js";
import { buildHealthPlanRecommendationHistory } from "../src/lib/healthPlanRecommendationHistory.js";
import { buildHealthPlanRecommendationRevisionMemory } from "../src/lib/healthPlanRecommendationRevisionMemory.js";
import { buildHealthPlanOutcomePatternMemory } from "../src/lib/healthPlanOutcomePatternMemory.js";
import { buildHealthPlanQualityMemory } from "../src/lib/healthPlanQualityMemory.js";
import { buildHealthPlanQualitySnapshot, normalizeHealthPlanQualitySnapshot } from "../src/lib/healthPlanQualitySnapshot.js";
import { buildHealthPlanDraftAcceptance } from "../src/lib/healthPlanDraftAcceptance.js";
import { buildHealthPlanCandidateSelectionSnapshot, selectBestHealthPlanCandidate } from "../src/lib/healthPlanCandidateSelection.js";
import { buildHealthPlanEvidencePack } from "../src/lib/healthPlanEvidencePack.js";
import {
  buildHealthPlanBenchmarkAssessment,
  buildHealthPlanBenchmarkGuidance,
  shouldRejectHealthPlanBenchmarkAssessment,
} from "../src/lib/healthPlanBenchmarkAssessment.js";
import { buildHealthPlanBenchmarkReplayFromHistory } from "../src/lib/healthPlanBenchmarkReplayHistory.js";
import {
  annotateHealthPlanSectionsWithEditorialTrace,
  buildHealthPlanEditorialTrace,
  hasHighPriorityManualOverrideWithoutReason,
  shouldRejectHealthPlanEditorialTrace,
} from "../src/lib/healthPlanEditorialTrace.js";
import { findHealthPlanEvidenceCoverageIssues } from "../src/lib/healthPlanEvidenceCoverage.js";
import { buildHealthPlanGenerationQuality, shouldRejectHealthPlanGenerationQuality } from "../src/lib/healthPlanGenerationQuality.js";
import { buildHealthPlanRecommendationEffectiveness, findHealthPlanRecommendationEffectivenessIssues } from "../src/lib/healthPlanRecommendationEffectiveness.js";
import {
  applyHealthPlanRecommendationGroundingCalibration,
  buildHealthPlanRecommendationCalibrationSummary,
  buildHealthPlanRecommendationGrounding,
  shouldRejectHealthPlanRecommendationGrounding,
} from "../src/lib/healthPlanRecommendationGrounding.js";
import {
  buildHealthPlanCalibrationRepairBrief,
  buildHealthPlanCalibrationRepairMessage,
  shouldAttemptHealthPlanCalibrationRepair,
} from "../src/lib/healthPlanRecommendationCalibrationPolicy.js";
import { buildHealthPlanRecommendationCoverage, shouldRejectHealthPlanRecommendationCoverage } from "../src/lib/healthPlanRecommendationCoverage.js";
import { buildHealthPlanRecommendationEvidenceDiversity } from "../src/lib/healthPlanRecommendationEvidenceDiversity.js";
import {
  buildHealthPlanRecommendationReviewSummary,
  normalizeHealthPlanRecommendationReviewDecisions,
} from "../src/lib/healthPlanRecommendationReview.js";
import { buildHealthPlanRecommendationSourceRanking, findHealthPlanRecommendationSourceRankingIssues } from "../src/lib/healthPlanRecommendationSourceRanking.js";
import { buildHealthPlanRecommendationChallenges, shouldRejectHealthPlanRecommendationChallenges } from "../src/lib/healthPlanRecommendationChallenges.js";
import { buildHealthPlanRecommendationRepairBrief } from "../src/lib/healthPlanRecommendationRepair.js";
import { buildHealthPlanReadiness, shouldBlockHealthPlanReadiness } from "../src/lib/healthPlanReadiness.js";
import { buildHealthPlanClientResponseMemory } from "../src/lib/healthPlanClientResponseMemory.js";
import { buildHealthPlanCohortGuidance } from "../src/lib/healthPlanCohortGuidance.js";
import { buildHealthPlanLiveEvidenceSignals, buildHealthPlanLiveEvidenceSummary } from "../src/lib/healthPlanLiveEvidenceSummary.js";
import { buildHealthPlanLongitudinalMemory } from "../src/lib/healthPlanLongitudinalMemory.js";
import { buildHealthPlanOperationalCompleteness, shouldRejectHealthPlanOperationalCompleteness } from "../src/lib/healthPlanOperationalCompleteness.js";
import { buildHealthPlanActionImpact } from "../src/lib/healthPlanActionImpact.js";
import { buildHealthPlanRecommendationImpact } from "../src/lib/healthPlanRecommendationImpact.js";
import {
  buildHealthPlanCriticalResponseBrief,
  findHealthPlanCriticalResponseIssues,
} from "../src/lib/healthPlanCriticalResponse.js";
import {
  buildHealthPlanResponseAdjudicationBrief,
  findHealthPlanResponseAdjudicationIssues,
} from "../src/lib/healthPlanResponseAdjudication.js";
import { buildHealthPlanReviewPriorities } from "../src/lib/healthPlanReviewPriorities.js";
import { buildHealthPlanReviewReadiness } from "../src/lib/healthPlanReviewReadiness.js";
import { buildHealthPlanGenerationBrief } from "../src/lib/healthPlanGenerationBrief.js";
import { attachHealthPlanEvidenceReceipts } from "../src/lib/healthPlanEvidenceReceipts.js";
import {
  findHealthPlanGenerationBriefIssues,
  shouldRejectHealthPlanGenerationBriefIssues,
} from "../src/lib/healthPlanGenerationBriefCompliance.js";
import {
  buildCompletedHealthPlanImprovementBrief,
  buildHealthPlanImprovementActions,
  buildHealthPlanImprovementBrief,
} from "../src/lib/healthPlanImprovementActions.js";

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const distDir = path.join(rootDir, "dist");
const schemaPath = path.join(rootDir, "server", "schema.sql");
const publicManualPath = "/manuals/VYVA_Admin_Console_User_Manual.pdf";
const publicManualFilePath = path.join(rootDir, "public", "manuals", "VYVA_Admin_Console_User_Manual.pdf");
const currentManualFilePath = path.join(rootDir, "docs", "admin-manual", "current", "VYVA_Admin_Console_User_Manual.pdf");

function argValue(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

function safeUrl(value) {
  try {
    return value ? new URL(value) : null;
  } catch {
    return null;
  }
}

function resolveVyvaBackendApiUrl(configuredUrl, appUrl) {
  const fallback = defaultVyvaBackendApiUrl;
  const configured = safeUrl(configuredUrl) || safeUrl(fallback);
  const app = safeUrl(appUrl);
  if (!configured) return fallback;

  const configuredHost = configured.hostname.toLowerCase();
  const appHost = app?.hostname?.toLowerCase() || "";
  const dashboardHosts = new Set(["redcross.vyva.life", "rcadmin.vyva.life"]);
  if ((appHost && configuredHost === appHost) || dashboardHosts.has(configuredHost)) {
    return fallback;
  }

  return configured.origin.replace(/\/$/, "");
}

const isProduction =
  process.argv.includes("--production") ||
  process.env.NODE_ENV === "production" ||
  Boolean(process.env.REPLIT_DEPLOYMENT || process.env.REPLIT_DEPLOYMENT_ID);

const host = argValue("--host") || process.env.HOST || "0.0.0.0";
const port = Number(argValue("--port") || process.env.PORT || 8080);
const databaseUrl = process.env.DATABASE_URL || process.env.LOVABLE_DATABASE_URL || process.env.POSTGRES_URL;
const pgHost = process.env.PGHOST || process.env.POSTGRES_HOST;
const pgDatabase = process.env.PGDATABASE || process.env.POSTGRES_DATABASE || process.env.POSTGRES_DB;
const pgUser = process.env.PGUSER || process.env.POSTGRES_USER;
const pgPassword = process.env.PGPASSWORD || process.env.POSTGRES_PASSWORD;
const pgPort = process.env.PGPORT || process.env.POSTGRES_PORT;
const defaultVyvaBackendApiUrl = "https://api.vyva.io";
const configuredVyvaBackendApiUrl = process.env.VYVA_BACKEND_API_URL || process.env.VYVA_API_BASE_URL || defaultVyvaBackendApiUrl;
const externalUserSource = "api.vyva.io";
const phoneOnboardingUserSource = "phone-onboarding";
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
const vyvaBackendApiUrl = resolveVyvaBackendApiUrl(configuredVyvaBackendApiUrl, publicAppUrl);
const teamInviteGuideUrlOverride = process.env.TEAM_INVITE_GUIDE_URL || process.env.VITE_TEAM_INVITE_GUIDE_URL || null;
const teamInviteGuidePath = process.env.TEAM_INVITE_GUIDE_PATH || publicManualPath;
const teamInviteRedirectPath = process.env.TEAM_INVITE_REDIRECT_PATH || "/";
const userManualUrlOverrideRaw =
  process.env.USER_MANUAL_URL ||
  process.env.VYVA_USER_MANUAL_URL ||
  process.env.VITE_USER_MANUAL_URL ||
  null;
const userManualUrlOverrides = {
  en: userManualUrlOverrideRaw,
  es:
    process.env.USER_MANUAL_URL_ES ||
    process.env.VYVA_USER_MANUAL_URL_ES ||
    process.env.VITE_USER_MANUAL_URL_ES ||
    null,
  de:
    process.env.USER_MANUAL_URL_DE ||
    process.env.VYVA_USER_MANUAL_URL_DE ||
    process.env.VITE_USER_MANUAL_URL_DE ||
    null,
};
const userManualPaths = {
  en: publicManualPath,
  es: "/manuals/VYVA_Admin_Console_User_Manual_ES.pdf",
  de: "/manuals/VYVA_Admin_Console_User_Manual_DE.pdf",
};
const teamInviteEmailFrom =
  String(
    process.env.TEAM_INVITE_EMAIL_FROM ||
      process.env.INVITE_EMAIL_FROM ||
      process.env.NOTIFY_FROM_EMAIL ||
      process.env.NOTIFICATION_FROM_EMAIL ||
      process.env.NOTIFICATIONS_FROM_EMAIL ||
      process.env.RESEND_FROM ||
      process.env.RESEND_FROM_EMAIL ||
      process.env.RESEND_FROM_ADDRESS ||
      process.env.RESEND_SENDER ||
      process.env.RESEND_SENDER_EMAIL ||
      process.env.RESEND_EMAIL_FROM ||
      process.env.FROM_EMAIL ||
      process.env.FROM_ADDRESS ||
      process.env.SENDER_EMAIL ||
      process.env.SENDER_ADDRESS ||
      process.env.EMAIL_SENDER ||
      process.env.EMAIL_SENDER_ADDRESS ||
      process.env.MAIL_FROM ||
      process.env.SMTP_FROM ||
      process.env.SMTP_FROM_EMAIL ||
      process.env.EMAIL_FROM ||
      "VYVA <no-reply@vyva.life>",
  ).trim() || null;
const teamInviteEmailReplyTo =
  String(process.env.TEAM_INVITE_EMAIL_REPLY_TO || process.env.EMAIL_REPLY_TO || "").trim() || null;
const resendApiKey = String(process.env.RESEND_API_KEY || "").trim() || null;
const postmarkServerToken = String(process.env.POSTMARK_SERVER_TOKEN || "").trim() || null;
const healthPlanAiProvider = String(process.env.HEALTH_PLAN_AI_PROVIDER || "openai").trim().toLowerCase();
const openAiApiKey =
  String(
    process.env.OPENAI_API_KEY ||
      process.env.OPENAI_API_SECRET ||
      process.env.OPENAI_SECRET_KEY ||
      "",
  ).trim() || null;
const openAiBaseUrl = String(process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").trim().replace(/\/$/, "");
const healthPlanOpenAiModel =
  String(process.env.HEALTH_PLAN_OPENAI_MODEL || process.env.OPENAI_MODEL || "gpt-4o-mini").trim() || "gpt-4o-mini";
const healthPlanGeneratorVersion = "health-plan-v1";
const healthPlanDirectCandidateCountOverride = Number.parseInt(process.env.HEALTH_PLAN_DIRECT_CANDIDATE_COUNT || "", 10);
const consoleSessionSecret =
  String(process.env.SESSION_SECRET || process.env.AUTH_SESSION_SECRET || process.env.CONSOLE_SESSION_SECRET || "").trim() ||
  (!isProduction ? "dev-vyva-console-session-secret" : null);
const consoleLoginTokenTtlSeconds = 15 * 60;
const teamInviteTokenTtlSeconds = Math.max(
  60,
  Number(process.env.TEAM_INVITE_TOKEN_TTL_SECONDS || process.env.TEAM_INVITE_TOKEN_TTL_HOURS * 3600 || 7 * 24 * 60 * 60),
);
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

function databasePoolConfig() {
  if (databaseUrl) {
    return {
      connectionString: databaseUrl,
      ssl: sslConfig(databaseUrl),
      max: Number(process.env.DATABASE_POOL_MAX || 10),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    };
  }

  if (pgHost && pgDatabase && pgUser) {
    return {
      host: pgHost,
      database: pgDatabase,
      user: pgUser,
      password: pgPassword,
      port: pgPort ? Number(pgPort) : undefined,
      ssl: process.env.DATABASE_SSL === "false" ? false : { rejectUnauthorized: false },
      max: Number(process.env.DATABASE_POOL_MAX || 10),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    };
  }

  return null;
}

const poolConfig = databasePoolConfig();
const pool = poolConfig ? new Pool(poolConfig) : null;

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

function expectedWeeklyOccurrencesFromFrequency(value) {
  const frequencyDays = Math.max(1, parseFrequencyDays(value));
  return Math.max(1, Math.ceil(7 / frequencyDays));
}

function isTimestampInCurrentWeek(value) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  return date >= start && date < end;
}

function isCompletedCheckinStatus(value) {
  const normalized = String(value || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  return ["completed", "complete", "confirmed", "answered", "success", "successful", "reached", "done"].includes(normalized);
}

function weeklyCheckinExpectedForUser(user) {
  const enabled = Boolean(firstValue(user?.checkinEnabled, user?.checkin_enabled, user?.checkins?.enabled, user?.checkins?.is_active));
  if (!enabled) return 0;
  return expectedWeeklyOccurrencesFromFrequency(firstValue(user?.checkinFrequency, user?.checkin_frequency, user?.checkins?.frequency_days, user?.checkins?.frequency));
}

function weeklyCheckinCompletedForUser(user) {
  const status = firstValue(user?.checkinLastStatus, user?.checkin_last_status, user?.checkins?.last_outcome, user?.checkins?.lastOutcome);
  const at = firstValue(user?.checkinLastReportedAt, user?.checkin_last_reported_at, user?.checkins?.last_checkin_at, user?.checkins?.lastCheckinAt);
  return isCompletedCheckinStatus(status) && isTimestampInCurrentWeek(at) ? 1 : 0;
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
    error: "Database is not configured. Add DATABASE_URL or Replit PGHOST/PGDATABASE/PGUSER database variables.",
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

function normalizedBranchKey(value) {
  const text = String(value || "").trim().toLowerCase();
  if (!text) return null;
  if (text.includes("zamora")) return "zamora";
  if (text.includes("leipzig")) return "leipzig";
  return null;
}

function branchKeyFromPhone(value) {
  const country = countryKeyFromPhone(value);
  if (country === "germany") return "leipzig";
  if (country === "spain") return "zamora";
  return null;
}

function phoneFromUserLike(user) {
  if (!user || typeof user !== "object") return null;
  const nestedUser = user.user ?? user.vyva_users ?? user.client ?? {};
  return firstValue(
    user.phone,
    user.userPhone,
    user.user_phone,
    user.phone_number,
    user.phoneNumber,
    user.mobile,
    user.mobile_phone,
    user.mobilePhone,
    nestedUser.phone,
    nestedUser.userPhone,
    nestedUser.user_phone,
    nestedUser.phone_number,
    nestedUser.phoneNumber,
    nestedUser.mobile,
    nestedUser.mobile_phone,
    nestedUser.mobilePhone,
  );
}

function branchKeyFromOrganization(organization) {
  return normalizedBranchKey(firstValue(organization?.slug, organization?.name));
}

function stringOrganizationValue(value) {
  return typeof value === "string" ? value : null;
}

function externalOrganizationValues(user) {
  if (!user || typeof user !== "object") return [];
  const nestedUser = user.user ?? user.vyva_users ?? user.client ?? {};
  const nestedOrganization = user.organization ?? user.organisation ?? nestedUser.organization ?? nestedUser.organisation ?? {};
  return [
    stringOrganizationValue(user.organization),
    stringOrganizationValue(user.organisation),
    user.organization_slug,
    user.organizationSlug,
    user.organization_name,
    user.organizationName,
    user.org_slug,
    user.orgSlug,
    user.org_name,
    user.orgName,
    stringOrganizationValue(nestedUser.organization),
    stringOrganizationValue(nestedUser.organisation),
    nestedUser.organization_slug,
    nestedUser.organizationSlug,
    nestedUser.organization_name,
    nestedUser.organizationName,
    nestedUser.org_slug,
    nestedUser.orgSlug,
    nestedUser.org_name,
    nestedUser.orgName,
    nestedOrganization.slug,
    nestedOrganization.name,
  ].filter((value) => value !== undefined && value !== null && value !== "");
}

function externalUserHasGenericRedCrossOrganization(user) {
  return externalOrganizationValues(user).some((value) => {
    const text = String(value).toLowerCase();
    return text.includes("red cross") && !text.includes("leipzig") && !text.includes("zamora");
  });
}

function inferBranchKeyFromExternalUser(user) {
  if (!user || typeof user !== "object") return null;
  const nestedUser = user.user ?? user.vyva_users ?? user.client ?? {};
  const nestedOrganization = user.organization ?? user.organisation ?? nestedUser.organization ?? nestedUser.organisation ?? {};
  const explicitBranch = normalizedBranchKey(
    firstValue(
      stringOrganizationValue(user.organization),
      stringOrganizationValue(user.organisation),
      user.organization_slug,
      user.organizationSlug,
      user.organization_name,
      user.organizationName,
      user.branch_slug,
      user.branchSlug,
      user.branch,
      user.org,
      user.org_slug,
      user.orgSlug,
      user.org_name,
      user.orgName,
      nestedUser.organization_slug,
      nestedUser.organizationSlug,
      nestedUser.organization_name,
      nestedUser.organizationName,
      nestedUser.org_slug,
      nestedUser.orgSlug,
      nestedUser.org_name,
      nestedUser.orgName,
      stringOrganizationValue(nestedUser.organization),
      stringOrganizationValue(nestedUser.organisation),
      nestedOrganization.slug,
      nestedOrganization.name,
    ),
  );
  return explicitBranch || branchKeyFromPhone(phoneFromUserLike(user));
}

function externalUserHasExplicitOrganization(user) {
  if (!user || typeof user !== "object") return false;
  const nestedUser = user.user ?? user.vyva_users ?? user.client ?? {};
  const nestedOrganization = user.organization ?? user.organisation ?? nestedUser.organization ?? nestedUser.organisation ?? {};
  return Boolean(
    firstValue(
      user.organization_slug,
      user.organizationSlug,
      user.organization_name,
      user.organizationName,
      user.org_slug,
      user.orgSlug,
      user.org_name,
      user.orgName,
      nestedUser.organization_slug,
      nestedUser.organizationSlug,
      nestedUser.organization_name,
      nestedUser.organizationName,
      nestedUser.org_slug,
      nestedUser.orgSlug,
      nestedUser.org_name,
      nestedUser.orgName,
      nestedOrganization.slug,
      nestedOrganization.name,
    ),
  );
}

function externalUserExplicitlyMatchesOrganization(user, organization) {
  if (!user || typeof user !== "object" || !organization) return false;
  const nestedUser = user.user ?? user.vyva_users ?? user.client ?? {};
  const nestedOrganization = user.organization ?? user.organisation ?? nestedUser.organization ?? nestedUser.organisation ?? {};
  const organizationIds = new Set(
    [
      user.organization_id,
      user.organizationId,
      user.org_id,
      user.orgId,
      nestedUser.organization_id,
      nestedUser.organizationId,
      nestedUser.org_id,
      nestedUser.orgId,
      nestedOrganization.id,
    ]
      .map((value) => nullIfBlank(value == null ? value : String(value)))
      .filter(Boolean),
  );
  if (organization.id && organizationIds.has(String(organization.id))) return true;

  const organizationBranch = branchKeyFromOrganization(organization);
  const userBranch = inferBranchKeyFromExternalUser(user);
  if (organizationBranch && externalUserHasGenericRedCrossOrganization(user)) return true;
  return Boolean(organizationBranch && userBranch && userBranch === organizationBranch);
}

function normalizedCountryKey(value) {
  const text = String(value || "").trim().toLowerCase();
  if (!text) return null;
  if (["es", "esp", "espana", "españa", "spain"].some((term) => text.includes(term))) return "spain";
  if (["de", "deu", "deutschland", "germany"].some((term) => text.includes(term))) return "germany";
  return text;
}

function inferCountryKeyFromExternalUser(user) {
  if (!user || typeof user !== "object") return null;
  const nestedUser = user.user ?? user.vyva_users ?? user.client ?? {};
  const nestedOrganization = user.organization ?? user.organisation ?? nestedUser.organization ?? nestedUser.organisation ?? {};
  const explicitCountry = normalizedCountryKey(
    firstValue(
      user.country,
      user.country_code,
      user.countryCode,
      user.organization_country,
      user.organizationCountry,
      nestedUser.country,
      nestedUser.country_code,
      nestedUser.countryCode,
      nestedUser.organization_country,
      nestedUser.organizationCountry,
      nestedOrganization.country,
      nestedOrganization.country_code,
      nestedOrganization.countryCode,
    ),
  );
  return explicitCountry || countryKeyFromPhone(phoneFromUserLike(user));
}

function externalUserMatchesOrganization(user, organization) {
  if (!organization) return true;
  if (externalUserExplicitlyMatchesOrganization(user, organization)) return true;
  if (externalUserHasExplicitOrganization(user)) return false;

  const organizationBranch = branchKeyFromOrganization(organization);
  if (organizationBranch) {
    const userBranch = inferBranchKeyFromExternalUser(user);
    if (userBranch) return userBranch === organizationBranch;

    const organizationCountry = normalizedCountryKey(organization.country);
    const userCountry = inferCountryKeyFromExternalUser(user);
    return Boolean(organizationCountry && userCountry && userCountry === organizationCountry);
  }

  const organizationCountry = normalizedCountryKey(organization.country);
  if (!organizationCountry) return true;
  const userCountry = inferCountryKeyFromExternalUser(user);
  return Boolean(userCountry && userCountry === organizationCountry);
}

function filterExternalUsersForOrganization(users, context) {
  const list = Array.isArray(users) ? users : [];
  if (!context?.organization) return list;
  return list.filter((user) => externalUserMatchesOrganization(user, context.organization));
}

function userIdFromExternalRoutineItem(item) {
  return String(item?.user_id ?? item?.vyva_user_id ?? item?.user?.id ?? item?.vyva_users?.id ?? item?.client?.id ?? "").trim();
}

function externalRoutineItemMatchesOrganization(item, context) {
  if (!context?.organization) return true;
  const userLike = {
    ...item,
    id: userIdFromExternalRoutineItem(item),
    phone: firstValue(item?.phone, item?.userPhone, item?.user_phone, item?.user?.phone, item?.vyva_users?.phone, item?.client?.phone),
    city: firstValue(item?.city, item?.userCity, item?.user_city, item?.user?.city, item?.vyva_users?.city, item?.client?.city),
    country: firstValue(item?.country, item?.user?.country, item?.vyva_users?.country, item?.client?.country),
    coords: firstValue(item?.coords, item?.user?.coords, item?.vyva_users?.coords, item?.client?.coords),
  };
  return externalUserMatchesOrganization(userLike, context.organization);
}

function filterExternalRoutinePayloadForOrganization(payload, context) {
  if (!context?.organization) return payload;
  const list = extractUpstreamList(payload, ["checkins", "data", "sessions"]);
  if (!list.length) return payload;
  const filtered = list.filter((item) => externalRoutineItemMatchesOrganization(item, context));
  if (Array.isArray(payload)) return filtered;
  if (payload && typeof payload === "object") {
    if (Array.isArray(payload.checkins)) return { ...payload, checkins: filtered };
    if (Array.isArray(payload.data)) return { ...payload, data: filtered };
    if (Array.isArray(payload.sessions)) return { ...payload, sessions: filtered };
  }
  return { checkins: filtered };
}

function normalizeExternalDashboardPayload(data, assignmentSummaries = new Map(), context = null) {
  const filteredGisUsers = filterExternalUsersForOrganization(data?.gisUsers, context);
  const retainedUserIds = new Set(filteredGisUsers.map((user) => String(user?.id ?? "")).filter(Boolean));
  const gisUsers = filteredGisUsers.map((user) => {
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
      });

  const activeAlerts = Array.isArray(data?.activeAlerts)
    ? data.activeAlerts
      .filter((alert) => {
        const alertUserId = String(firstValue(alert?.vyva_user_id, alert?.user_id, alert?.user?.id, alert?.vyva_users?.id) || "");
        return Boolean(alertUserId && retainedUserIds.has(alertUserId));
      })
      .map((alert) => ({
        ...alert,
        id: alert.id == null ? alert.id : String(alert.id),
        vyva_user_id: alert.vyva_user_id == null ? alert.vyva_user_id : String(alert.vyva_user_id),
      }))
    : [];
  const activeCheckins = gisUsers.filter((user) => Boolean(user.checkinEnabled ?? user.checkin_enabled)).length;
  const computedTotalSensors = gisUsers.reduce((sum, user) => sum + Number(user.sensorCount ?? user.sensor_count ?? 0), 0);
  const computedCaregiversLinked = gisUsers.reduce((sum, user) => sum + Number(user.careProviderCount ?? user.care_provider_count ?? 0), 0);
  const computedWeeklyExpected =
    gisUsers.reduce((sum, user) => sum + weeklyCheckinExpectedForUser(user), 0) || activeCheckins * 7;
  const computedWeeklyCompleted = gisUsers.reduce((sum, user) => sum + weeklyCheckinCompletedForUser(user), 0);
  const computedCityDistribution = Array.from(
    gisUsers.reduce((cityCounts, user) => {
      const city = String(firstValue(user?.city, user?.userCity, user?.user_city) || "").trim();
      if (!city) return cityCounts;
      cityCounts.set(city, (cityCounts.get(city) || 0) + 1);
      return cityCounts;
    }, new Map()),
    ([city, count]) => ({ city, count }),
  );

  return {
    totalUsers: gisUsers.length,
    checkinsEnabled: activeCheckins,
    checkinsCompletedWeekly: Number(data?.checkinsCompletedWeekly ?? computedWeeklyCompleted),
    checkinsExpectedWeekly: Number(data?.checkinsExpectedWeekly ?? computedWeeklyExpected),
    activeAlertCount: activeAlerts.length,
    criticalAlertCount: activeAlerts.filter((alert) => alert.severity === "critical").length,
    totalSensors: computedTotalSensors,
    caregiversLinked: computedCaregiversLinked,
    gisUsers,
    activeAlerts,
    cityDistribution: computedCityDistribution,
  };
}

function mergeDashboardPayloads(primary, local) {
  const primaryUsers = Array.isArray(primary?.gisUsers) ? primary.gisUsers : [];
  const localUsers = Array.isArray(local?.gisUsers) ? local.gisUsers : [];
  const seenUserKeys = new Set();
  const addUserKeys = (user) => {
    const id = nullIfBlank(user?.id);
    const externalUserId = nullIfBlank(firstValue(user?.externalUserId, user?.external_user_id));
    if (id) {
      seenUserKeys.add(`id:${id}`);
      seenUserKeys.add(`external:${id}`);
    }
    if (externalUserId) seenUserKeys.add(`external:${externalUserId}`);
  };
  primaryUsers.forEach(addUserKeys);

  const mergedUsers = [...primaryUsers];
  for (const user of localUsers) {
    const id = nullIfBlank(user?.id);
    const externalUserId = nullIfBlank(firstValue(user?.externalUserId, user?.external_user_id));
    if ((id && seenUserKeys.has(`id:${id}`)) || (externalUserId && seenUserKeys.has(`external:${externalUserId}`))) continue;
    mergedUsers.push(user);
    addUserKeys(user);
  }

  const activeAlerts = [
    ...(Array.isArray(primary?.activeAlerts) ? primary.activeAlerts : []),
    ...(Array.isArray(local?.activeAlerts) ? local.activeAlerts : []),
  ];
  const cityDistribution = Array.from(
    mergedUsers.reduce((cityCounts, user) => {
      const city = String(firstValue(user?.city, user?.userCity, user?.user_city) || "").trim() || "Unknown";
      cityCounts.set(city, (cityCounts.get(city) || 0) + 1);
      return cityCounts;
    }, new Map()),
    ([city, count]) => ({ city, count }),
  );

  return {
    ...primary,
    totalUsers: mergedUsers.length,
    checkinsEnabled: mergedUsers.filter((user) => Boolean(user.checkinEnabled ?? user.checkin_enabled)).length,
    checkinsCompletedWeekly: mergedUsers.reduce((sum, user) => sum + weeklyCheckinCompletedForUser(user), 0),
    checkinsExpectedWeekly: mergedUsers.reduce((sum, user) => sum + weeklyCheckinExpectedForUser(user), 0),
    activeAlertCount: activeAlerts.length,
    criticalAlertCount: activeAlerts.filter((alert) => alert.severity === "critical").length,
    totalSensors: mergedUsers.reduce((sum, user) => sum + Number(user.sensorCount ?? user.sensor_count ?? 0), 0),
    caregiversLinked: mergedUsers.reduce((sum, user) => sum + Number(user.careProviderCount ?? user.care_provider_count ?? 0), 0),
    gisUsers: mergedUsers,
    activeAlerts,
    cityDistribution,
  };
}

function externalDashboardUserIds(data, context) {
  return new Set(
    filterExternalUsersForOrganization(data?.gisUsers, context)
      .map((user) => nullIfBlank(firstValue(user?.id, user?.externalUserId, user?.external_user_id)))
      .filter(Boolean),
  );
}

function filterDashboardPayloadUsers(payload, predicate) {
  const users = Array.isArray(payload?.gisUsers) ? payload.gisUsers.filter(predicate) : [];
  const retainedIds = new Set(users.map((user) => nullIfBlank(user?.id)).filter(Boolean));
  const retainedExternalIds = new Set(
    users.map((user) => nullIfBlank(firstValue(user?.externalUserId, user?.external_user_id))).filter(Boolean),
  );
  const activeAlerts = Array.isArray(payload?.activeAlerts)
    ? payload.activeAlerts.filter((alert) => {
        const alertUserId = nullIfBlank(firstValue(alert?.vyva_user_id, alert?.user_id, alert?.user?.id, alert?.vyva_users?.id));
        return Boolean(alertUserId && (retainedIds.has(alertUserId) || retainedExternalIds.has(alertUserId)));
      })
    : [];
  const cityDistribution = Array.from(
    users.reduce((cityCounts, user) => {
      const city = String(firstValue(user?.city, user?.userCity, user?.user_city) || "").trim() || "Unknown";
      cityCounts.set(city, (cityCounts.get(city) || 0) + 1);
      return cityCounts;
    }, new Map()),
    ([city, count]) => ({ city, count }),
  );

  return {
    ...payload,
    totalUsers: users.length,
    checkinsEnabled: users.filter((user) => Boolean(user.checkinEnabled ?? user.checkin_enabled)).length,
    checkinsCompletedWeekly: users.reduce((sum, user) => sum + weeklyCheckinCompletedForUser(user), 0),
    checkinsExpectedWeekly: users.reduce((sum, user) => sum + weeklyCheckinExpectedForUser(user), 0),
    activeAlertCount: activeAlerts.length,
    criticalAlertCount: activeAlerts.filter((alert) => alert.severity === "critical").length,
    totalSensors: users.reduce((sum, user) => sum + Number(user.sensorCount ?? user.sensor_count ?? 0), 0),
    caregiversLinked: users.reduce((sum, user) => sum + Number(user.careProviderCount ?? user.care_provider_count ?? 0), 0),
    gisUsers: users,
    activeAlerts,
    cityDistribution,
  };
}

function removeStaleExternalShadowUsers(localDashboard, upstreamData, context) {
  const upstreamIds = externalDashboardUserIds(upstreamData, context);
  return filterDashboardPayloadUsers(localDashboard, (user) => {
    const source = nullIfBlank(firstValue(user?.externalSource, user?.external_source));
    const externalUserId = nullIfBlank(firstValue(user?.externalUserId, user?.external_user_id));
    if (source !== externalUserSource || !externalUserId) return true;
    return upstreamIds.has(externalUserId);
  });
}

function normalizeExternalProfilePayload(data) {
  if (!data || typeof data !== "object") return data;
  const flatUserId = firstValue(data.id, data.user_id, data.userId, data.vyva_user_id, data.vyvaUserId, data.client_id, data.clientId);
  const sourceUser = data.user || (flatUserId ? data : null);
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
    user: sourceUser
      ? {
          ...sourceUser,
          id: flatUserId == null ? sourceUser.id : String(flatUserId),
        }
      : data.user,
    consent: data.consent
      ? { ...data.consent, id: data.consent.id == null ? data.consent.id : String(data.consent.id) }
      : data.consent,
    health: data.health
      ? { ...data.health, id: data.health.id == null ? data.health.id : String(data.health.id) }
      : data.health,
    medications: normalizeRecords(data.medications),
    healthPlan: data.healthPlan || data.health_plan ? normalizeHealthPlanRow(data.healthPlan || data.health_plan) : null,
    healthPlanFeedback: data.healthPlanFeedback || data.health_plan_feedback || null,
    caregivers: normalizeRecords(data.caregivers),
    careProviders: normalizeRecords(data.careProviders),
    sensors: normalizeRecords(data.sensors),
    alerts: normalizeRecords(data.alerts),
    readings: normalizeRecords(data.readings),
  };
}

function externalProfileHasUser(profile) {
  return Boolean(profile && typeof profile === "object" && profile.user && typeof profile.user === "object" && profile.user.id != null);
}

function externalUserIdFromUserLike(user) {
  return String(firstValue(user?.id, user?.user_id, user?.userId, user?.vyva_user_id, user?.vyvaUserId, user?.client_id, user?.clientId) || "").trim();
}

function displayNamePartsFromUserLike(user) {
  const fullName = nullIfBlank(firstValue(
    user?.full_name,
    user?.fullName,
    user?.display_name,
    user?.displayName,
    user?.name,
    user?.user_name,
    user?.userName,
    user?.client_name,
    user?.clientName,
  ));
  return fullName ? fullName.split(/\s+/).filter(Boolean) : [];
}

function normalizeExternalUserLikeForProfile(userLike, externalUserId) {
  const user = objectValue(userLike);
  const nameParts = displayNamePartsFromUserLike(user);
  const firstName = nullIfBlank(firstValue(user.first_name, user.firstName)) || nameParts[0] || "External";
  const lastName = nullIfBlank(firstValue(user.last_name, user.lastName)) || nameParts.slice(1).join(" ") || "Client";

  return normalizeExternalProfilePayload({
    user: {
      ...user,
      id: externalUserIdFromUserLike(user) || String(externalUserId),
      first_name: firstName,
      last_name: lastName,
      phone: nullIfBlank(firstValue(user.phone, user.user_phone, user.userPhone, user.client_phone, user.clientPhone)),
      city: nullIfBlank(firstValue(user.city, user.user_city, user.userCity, user.client_city, user.clientCity)),
      country: nullIfBlank(firstValue(user.country, user.country_code, user.countryCode)),
      language: nullIfBlank(firstValue(user.language, user.locale)),
      created_at: firstValue(user.created_at, user.createdAt),
    },
  });
}

function findExternalUserLikeById(payload, externalUserId) {
  const targetId = String(externalUserId || "").trim();
  const candidates = extractUpstreamList(payload, ["gisUsers", "users", "clients", "data", "items"]);
  const extraCandidates = [];
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    Object.values(payload).forEach((value) => {
      if (Array.isArray(value)) extraCandidates.push(...value);
    });
  }
  return [...candidates, ...extraCandidates].find((user) => externalUserIdFromUserLike(user) === targetId) || null;
}

function routineItemToExternalUserLike(item, externalUserId) {
  const nestedUser = objectValue(item?.user ?? item?.vyva_users ?? item?.client);
  const userLike = {
    ...nestedUser,
    id: externalUserIdFromUserLike(nestedUser) || userIdFromExternalRoutineItem(item) || String(externalUserId),
    first_name: firstValue(nestedUser.first_name, nestedUser.firstName, item?.first_name, item?.firstName),
    last_name: firstValue(nestedUser.last_name, nestedUser.lastName, item?.last_name, item?.lastName),
    full_name: firstValue(nestedUser.full_name, nestedUser.fullName, nestedUser.name, item?.user_name, item?.userName, item?.name, item?.client_name, item?.clientName),
    phone: firstValue(nestedUser.phone, item?.phone, item?.user_phone, item?.userPhone, item?.client_phone, item?.clientPhone),
    city: firstValue(nestedUser.city, item?.city, item?.user_city, item?.userCity, item?.client_city, item?.clientCity),
    country: firstValue(nestedUser.country, item?.country, item?.user_country, item?.userCountry, item?.client_country, item?.clientCountry),
    language: firstValue(nestedUser.language, item?.language, item?.locale),
    created_at: firstValue(nestedUser.created_at, nestedUser.createdAt, item?.created_at, item?.createdAt),
  };
  return normalizeExternalUserLikeForProfile(userLike, externalUserId);
}

async function fetchExternalUserProfileFromDashboardFeeds(externalUserId, context = null) {
  const dashboard = await requestVyvaBackend("/api/v1/user-dashboard/users", {
    query: scopedVyvaBackendQuery({}, context),
  });
  if (dashboard?.ok) {
    const match = findExternalUserLikeById(dashboard.data, externalUserId);
    if (match) return normalizeExternalUserLikeForProfile(match, externalUserId);
  }

  const checkins = await requestVyvaBackend("/api/v1/checkins-dashboard/checkins", {
    query: scopedVyvaBackendQuery({}, context),
  });
  if (checkins?.ok) {
    const items = extractUpstreamList(checkins.data, ["checkins", "data", "sessions", "items"]);
    const match = items.find((item) => userIdFromExternalRoutineItem(item) === String(externalUserId));
    if (match) return routineItemToExternalUserLike(match, externalUserId);
  }

  return null;
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
        AND u.external_source <> 'local'
        AND u.external_user_id = ANY($2::text[])
      GROUP BY u.external_user_id
    `,
    [organizationId, ids],
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
        AND external_source <> 'local'
        AND external_user_id = $2
      ORDER BY
        CASE external_source
          WHEN $3 THEN 0
          WHEN $4 THEN 1
          ELSE 2
        END,
        updated_at DESC
      LIMIT 1
    `,
    [organizationId, String(externalUserId), externalUserSource, phoneOnboardingUserSource],
  );
  return result.rows[0]?.id || null;
}

async function loadExternalUserCareProviders(externalUserId, context, client = { query }) {
  const localUserId = await loadLocalUserIdForExternalUser(externalUserId, context, client);
  return localUserId ? loadUserCareProviders(localUserId, context, client) : [];
}

async function loadLatestMedicationActivity(userId, client = { query }) {
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
    client,
  );
  return rows[0] || null;
}

async function loadRecentMedicationActivityHistory(userId, client = { query }, limit = 12) {
  return optionalRows(
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
      LIMIT $2
    `,
    [userId, limit],
    client,
  );
}

async function loadRecentCampaignCallJobsForUser(userId, context, client = { query }, limit = 12) {
  return optionalRows(
    `
      SELECT
        j.id::text,
        j.status,
        j.skip_reason,
        j.attempt_count,
        j.scheduled_at,
        j.created_at,
        j.updated_at,
        c.name AS campaign_name,
        c.template_key
      FROM public.campaign_call_jobs j
      JOIN public.campaigns c ON c.id = j.campaign_id
      WHERE j.vyva_user_id = $1
        AND j.organization_id = $2
      ORDER BY COALESCE(j.updated_at, j.created_at, j.scheduled_at) DESC
      LIMIT $3
    `,
    [userId, scopeOrganizationId(context), limit],
    client,
  );
}

function buildRecentOperationalEvents({
  checkins = null,
  brainCoach = null,
  medicationActivity = null,
  medicationHistory = [],
  campaignJobs = [],
} = {}) {
  const events = [];
  const checkinAt = normalizeTimestampValue(firstValue(checkins?.last_checkin_at, checkins?.lastCheckinAt, checkins?.last_session_at, checkins?.lastSessionAt));
  if (checkinAt) {
    events.push({
      id: `checkins:${checkins?.id || checkinAt}`,
      source: "checkins",
      status: firstValue(checkins?.last_outcome, checkins?.lastOutcome, checkins?.last_checkin_status, checkins?.lastCheckinStatus),
      occurred_at: checkinAt,
      label: "Check-in",
      note: "Latest scheduled check-in result.",
      signal_ids: ["service-checkins"],
    });
  }

  const brainAt = normalizeTimestampValue(firstValue(brainCoach?.last_session_at, brainCoach?.lastSessionAt, brainCoach?.last_reported_at, brainCoach?.lastReportedAt));
  if (brainAt) {
    events.push({
      id: `brain:${brainCoach?.id || brainAt}`,
      source: "brain_coach",
      status: firstValue(brainCoach?.last_outcome, brainCoach?.lastOutcome),
      occurred_at: brainAt,
      label: "Brain Coach",
      note: "Latest Brain Coach session result.",
      signal_ids: ["service-brain-coach"],
    });
  }

  for (const item of Array.isArray(medicationHistory) ? medicationHistory : []) {
    const occurredAt = normalizeTimestampValue(firstValue(item?.occurred_at, item?.reported_at));
    if (!occurredAt) continue;
    const medicationName = nullIfBlank(item?.medication_name);
    events.push({
      id: `medication:${item.id || occurredAt}`,
      source: "medication",
      status: item?.status,
      occurred_at: occurredAt,
      label: medicationName ? `Medication: ${medicationName}` : "Medication reminder",
      note: medicationName
        ? `Medication activity recorded for ${medicationName}.`
        : "Medication activity recorded.",
      signal_ids: ["medication-plan"],
    });
  }

  if (!Array.isArray(medicationHistory) || medicationHistory.length === 0) {
    const occurredAt = normalizeTimestampValue(firstValue(medicationActivity?.occurred_at, medicationActivity?.reported_at));
    if (occurredAt) {
      const medicationName = nullIfBlank(medicationActivity?.medication_name);
      events.push({
        id: `medication-latest:${medicationActivity?.id || occurredAt}`,
        source: "medication",
        status: medicationActivity?.status,
        occurred_at: occurredAt,
        label: medicationName ? `Medication: ${medicationName}` : "Medication reminder",
        note: medicationName
          ? `Latest medication activity recorded for ${medicationName}.`
          : "Latest medication activity recorded.",
        signal_ids: ["medication-plan"],
      });
    }
  }

  for (const job of Array.isArray(campaignJobs) ? campaignJobs : []) {
    const occurredAt = normalizeTimestampValue(firstValue(job?.updated_at, job?.scheduled_at, job?.created_at));
    if (!occurredAt) continue;
    const campaignName = nullIfBlank(job?.campaign_name);
    const status = nullIfBlank(job?.status);
    const skipReason = nullIfBlank(job?.skip_reason);
    events.push({
      id: `campaign:${job.id || occurredAt}`,
      source: "campaign_call",
      status,
      occurred_at: occurredAt,
      label: campaignName ? `Campaign call: ${campaignName}` : "Campaign outreach",
      note: skipReason
        ? `Campaign outreach ended with ${status || "an unresolved"} status because of ${skipReason.replaceAll("_", " ")}.`
        : `Campaign outreach ended with ${status || "an unknown"} status.`,
      signal_ids: ["service-checkins", "alert-active"],
    });
  }

  return normalizeHealthPlanOperationalEvents(events);
}

function normalizeHealthPlanSectionItems(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item, index) => {
      const record = objectValue(item);
      const text = nullIfBlank(typeof item === "string" ? item : firstValue(record?.text, record?.value, record?.label, record?.title));
      if (!text) return null;
      const id = nullIfBlank(record?.id) || `item-${index + 1}`;
      const sourceSignalIds = Array.isArray(record?.source_signal_ids)
        ? record.source_signal_ids.map((signalId) => nullIfBlank(signalId)).filter(Boolean)
        : [];
      const priority = nullIfBlank(record?.priority)?.toLowerCase();
      const confidence = nullIfBlank(record?.confidence)?.toLowerCase();
      const timing = nullIfBlank(record?.timing)?.toLowerCase();
      const verificationRequired = typeof record?.verification_required === "boolean" ? record.verification_required : null;
      const completionSignal = nullIfBlank(record?.completion_signal);
      const ownerRole = nullIfBlank(record?.owner_role)?.toLowerCase();
      const fallbackOwnerRole = nullIfBlank(record?.fallback_owner_role)?.toLowerCase();
      const originType = nullIfBlank(record?.origin_type)?.toLowerCase();
      const originalGeneratedText = nullIfBlank(record?.original_generated_text);
      const originalGeneratedAt = normalizeTimestampValue(record?.original_generated_at);
      const lastModifiedAt = normalizeTimestampValue(record?.last_modified_at);
      const lastModifiedByUserId = nullIfBlank(record?.last_modified_by_user_id);
      const lastModifiedByEmail = normalizedEmail(record?.last_modified_by_email);
      const editReason = nullIfBlank(record?.edit_reason);
      return {
        id,
        text,
        ...(sourceSignalIds.length ? { source_signal_ids: sourceSignalIds } : {}),
        ...(["high", "medium", "low"].includes(priority) ? { priority } : {}),
        ...(["high", "medium", "low"].includes(confidence) ? { confidence } : {}),
        ...(["today", "this_week", "ongoing"].includes(timing) ? { timing } : {}),
        ...(typeof verificationRequired === "boolean" ? { verification_required: verificationRequired } : {}),
        ...(completionSignal ? { completion_signal: completionSignal } : {}),
        ...(["assigned_staff", "caregiver", "on_call_coordinator", "care_team"].includes(ownerRole) ? { owner_role: ownerRole } : {}),
        ...(["assigned_staff", "caregiver", "on_call_coordinator", "care_team"].includes(fallbackOwnerRole) ? { fallback_owner_role: fallbackOwnerRole } : {}),
        ...(["ai_generated", "human_added", "human_edited"].includes(originType) ? { origin_type: originType } : {}),
        ...(originalGeneratedText ? { original_generated_text: originalGeneratedText } : {}),
        ...(originalGeneratedAt ? { original_generated_at: originalGeneratedAt } : {}),
        ...(lastModifiedAt ? { last_modified_at: lastModifiedAt } : {}),
        ...(lastModifiedByUserId ? { last_modified_by_user_id: lastModifiedByUserId } : {}),
        ...(lastModifiedByEmail ? { last_modified_by_email: lastModifiedByEmail } : {}),
        ...(editReason ? { edit_reason: editReason } : {}),
      };
    })
    .filter(Boolean);
}

function slugToken(value, fallback = "item") {
  const token = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return token || fallback;
}

function normalizeHealthPlanSignalStrength(value, fallback = "medium") {
  const normalized = nullIfBlank(value);
  if (["high", "medium", "low"].includes(normalized)) return normalized;
  return fallback;
}

function normalizeHealthPlanSignalCategory(value, fallback = "context") {
  const normalized = nullIfBlank(value);
  if (["risk", "forecast", "alert", "medication", "service", "sensor", "care-circle", "context"].includes(normalized)) {
    return normalized;
  }
  return fallback;
}

function normalizeHealthPlanSourceSignals(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item, index) => {
      const record = objectValue(item);
      const label = nullIfBlank(typeof item === "string" ? item : firstValue(record?.label, record?.title, record?.text, record?.value));
      if (!label) return null;
      const detail = nullIfBlank(firstValue(record?.detail, record?.description, record?.summary));
      const category = normalizeHealthPlanSignalCategory(record?.category);
      const id = nullIfBlank(record?.id) || `${category}-${slugToken(label, `signal-${index + 1}`)}`;
      return {
        id,
        label,
        ...(detail ? { detail } : {}),
        category,
        strength: normalizeHealthPlanSignalStrength(record?.strength),
      };
    })
    .filter(Boolean);
}

function normalizeHealthPlanDataQualityGaps(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item, index) => {
      const record = objectValue(item);
      const label = nullIfBlank(firstValue(record?.label, record?.title, record?.text, record?.value));
      if (!label) return null;
      const id = nullIfBlank(record?.id) || `gap-${index + 1}`;
      const detail = nullIfBlank(firstValue(record?.detail, record?.description, record?.summary));
      const staffAction = nullIfBlank(firstValue(record?.staff_action, record?.staffAction, record?.action));
      const kind = nullIfBlank(firstValue(record?.kind, record?.type));
      const severity = normalizeHealthPlanSignalStrength(firstValue(record?.severity, record?.strength), "medium");
      return {
        id,
        label,
        ...(detail ? { detail } : {}),
        ...(kind === "stale" || kind === "missing" ? { kind } : {}),
        severity,
        ...(staffAction ? { staff_action: staffAction } : {}),
      };
    })
    .filter(Boolean);
}

function normalizeHealthPlanActionType(value, fallback = "edited") {
  const normalized = nullIfBlank(value);
  if (["generated", "regenerated", "edited", "reviewed"].includes(normalized)) return normalized;
  return fallback;
}

function normalizeHealthPlanSignalIds(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => nullIfBlank(item)).filter(Boolean);
}

function normalizeCompletedHealthPlanImprovementActions(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const record = objectValue(item);
      const actionId = nullIfBlank(firstValue(record?.action_id, record?.actionId, record?.id));
      const title = nullIfBlank(record?.title);
      if (!actionId || !title) return null;
      return {
        action_id: actionId,
        title,
        ...(nullIfBlank(record?.section_key) ? { section_key: nullIfBlank(record?.section_key) } : {}),
        ...(normalizeTimestampValue(record?.completed_at) ? { completed_at: normalizeTimestampValue(record?.completed_at) } : {}),
        ...(nullIfBlank(record?.completed_by_user_id) ? { completed_by_user_id: nullIfBlank(record?.completed_by_user_id) } : {}),
        ...(normalizedEmail(record?.completed_by_email) ? { completed_by_email: normalizedEmail(record?.completed_by_email) } : {}),
        ...(nullIfBlank(record?.note) ? { note: nullIfBlank(record?.note) } : {}),
      };
    })
    .filter(Boolean);
}

function normalizeHealthPlanFeedbackEntries(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item, index) => {
      const record = objectValue(item);
      const sectionKey = nullIfBlank(firstValue(record?.section_key, record?.sectionKey));
      const outcome = nullIfBlank(record?.outcome);
      if (!sectionKey || !["helped", "mixed", "did_not_help", "needs_follow_up"].includes(outcome)) return null;
      const itemId = nullIfBlank(firstValue(record?.item_id, record?.itemId));
      const feedbackId = nullIfBlank(record?.id) || [sectionKey, itemId || "section", index + 1].join(":");
      const recommendedNextAction = nullIfBlank(firstValue(record?.recommended_next_action, record?.recommendedNextAction));
      const confidenceLevel = nullIfBlank(firstValue(record?.confidence_level, record?.confidenceLevel));
      return {
        id: feedbackId,
        section_key: sectionKey,
        ...(itemId ? { item_id: itemId } : {}),
        outcome,
        ...(["preserve", "verify", "rework", "retire"].includes(recommendedNextAction || "") ? { recommended_next_action: recommendedNextAction } : {}),
        ...(["high", "medium", "low"].includes(confidenceLevel || "") ? { confidence_level: confidenceLevel } : {}),
        ...(nullIfBlank(record?.source) ? { source: nullIfBlank(record?.source) } : {}),
        ...(nullIfBlank(record?.note) ? { note: nullIfBlank(record?.note) } : {}),
        ...(normalizeTimestampValue(record?.recorded_at) ? { recorded_at: normalizeTimestampValue(record?.recorded_at) } : {}),
        ...(nullIfBlank(record?.recorded_by_user_id) ? { recorded_by_user_id: nullIfBlank(record?.recorded_by_user_id) } : {}),
        ...(normalizedEmail(record?.recorded_by_email) ? { recorded_by_email: normalizedEmail(record?.recorded_by_email) } : {}),
      };
    })
    .filter(Boolean)
    .sort((left, right) => {
      const leftTime = left.recorded_at ? new Date(left.recorded_at).getTime() : 0;
      const rightTime = right.recorded_at ? new Date(right.recorded_at).getTime() : 0;
      return rightTime - leftTime;
    });
}

function normalizeHealthPlanRecommendationLearning(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const itemId = nullIfBlank(firstValue(item?.item_id, item?.itemId));
      const sectionKey = nullIfBlank(firstValue(item?.section_key, item?.sectionKey));
      const sectionLabel = nullIfBlank(firstValue(item?.section_label, item?.sectionLabel));
      const textValue = nullIfBlank(item?.text);
      if (!itemId || !sectionKey || !textValue) return null;
      return {
        item_id: itemId,
        section_key: sectionKey,
        ...(sectionLabel ? { section_label: sectionLabel } : {}),
        text: textValue,
        ...(nullIfBlank(item?.status) ? { status: nullIfBlank(item?.status) } : {}),
        ...(Number.isFinite(Number(item?.score)) ? { score: Math.round(Number(item.score)) } : {}),
        ...(nullIfBlank(item?.latest_outcome) ? { latest_outcome: nullIfBlank(item?.latest_outcome) } : {}),
        ...(nullIfBlank(item?.inherited_section_outcome) ? { inherited_section_outcome: nullIfBlank(item?.inherited_section_outcome) } : {}),
        ...(nullIfBlank(item?.latest_note) ? { latest_note: nullIfBlank(item?.latest_note) } : {}),
        ...(nullIfBlank(item?.latest_source) ? { latest_source: nullIfBlank(item?.latest_source) } : {}),
        ...(nullIfBlank(item?.latest_recommended_next_action) ? { latest_recommended_next_action: nullIfBlank(item?.latest_recommended_next_action) } : {}),
        ...(nullIfBlank(item?.latest_confidence_level) ? { latest_confidence_level: nullIfBlank(item?.latest_confidence_level) } : {}),
        ...(nullIfBlank(item?.freshness_status) ? { freshness_status: nullIfBlank(item?.freshness_status) } : {}),
        ...(Number.isFinite(Number(item?.feedback_count)) ? { feedback_count: Number(item.feedback_count) } : {}),
        ...(Number.isFinite(Number(item?.helped_count)) ? { helped_count: Number(item.helped_count) } : {}),
        ...(Number.isFinite(Number(item?.mixed_count)) ? { mixed_count: Number(item.mixed_count) } : {}),
        ...(Number.isFinite(Number(item?.did_not_help_count)) ? { did_not_help_count: Number(item.did_not_help_count) } : {}),
        ...(Number.isFinite(Number(item?.needs_follow_up_count)) ? { needs_follow_up_count: Number(item.needs_follow_up_count) } : {}),
        ...(Number.isFinite(Number(item?.operational_positive_count)) ? { operational_positive_count: Number(item.operational_positive_count) } : {}),
        ...(Number.isFinite(Number(item?.operational_caution_count)) ? { operational_caution_count: Number(item.operational_caution_count) } : {}),
        ...(nullIfBlank(item?.operational_pattern) ? { operational_pattern: nullIfBlank(item?.operational_pattern) } : {}),
        ...(Array.isArray(item?.operational_source_labels) ? { operational_source_labels: item.operational_source_labels.map((label) => nullIfBlank(label)).filter(Boolean) } : {}),
        ...(nullIfBlank(item?.operational_reason) ? { operational_reason: nullIfBlank(item?.operational_reason) } : {}),
        ...(normalizeTimestampValue(item?.last_operational_at) ? { last_operational_at: normalizeTimestampValue(item?.last_operational_at) } : {}),
        ...(nullIfBlank(item?.trajectory) ? { trajectory: nullIfBlank(item?.trajectory) } : {}),
        ...(nullIfBlank(item?.reuse_priority) ? { reuse_priority: nullIfBlank(item?.reuse_priority) } : {}),
        ...(nullIfBlank(item?.contradiction_status) ? { contradiction_status: nullIfBlank(item?.contradiction_status) } : {}),
        ...(nullIfBlank(item?.contradiction_reason) ? { contradiction_reason: nullIfBlank(item?.contradiction_reason) } : {}),
        ...(Array.isArray(item?.source_signal_ids) ? { source_signal_ids: item.source_signal_ids.map((signalId) => nullIfBlank(signalId)).filter(Boolean) } : {}),
        ...(nullIfBlank(item?.reason) ? { reason: nullIfBlank(item?.reason) } : {}),
      };
    })
    .filter(Boolean)
    .slice(0, 20);
}

function inferHealthPlanSummarySignalIds(value, sourceSignals = [], signalTriage = {}, sections = {}) {
  const normalized = normalizeHealthPlanSignalIds(value);
  if (normalized.length) return normalized;
  const validIds = new Set((Array.isArray(sourceSignals) ? sourceSignals : []).map((signal) => nullIfBlank(signal?.id)).filter(Boolean));
  const sectionRefs = [
    ...(Array.isArray(sections?.monitoring_json) ? sections.monitoring_json : []),
    ...(Array.isArray(sections?.escalation_json) ? sections.escalation_json : []),
    ...(Array.isArray(sections?.goals_json) ? sections.goals_json : []),
    ...(Array.isArray(sections?.daily_support_json) ? sections.daily_support_json : []),
  ].flatMap((item) => Array.isArray(item?.source_signal_ids) ? item.source_signal_ids : []);
  return [...new Set([
    ...normalizeHealthPlanSignalIds(signalTriage?.action_signal_ids),
    ...normalizeHealthPlanSignalIds(sectionRefs),
  ])].filter((id) => validIds.has(id)).slice(0, 4);
}

function normalizeHealthPlanRow(row) {
  if (!row) return null;
  const sourceSignals = normalizeHealthPlanSourceSignals(row.source_signals_json);
  const signalTriage = buildHealthPlanSignalTriage(sourceSignals);
  const qualitySnapshot = normalizeHealthPlanQualitySnapshot(row.quality_snapshot_json);
  const dataQualityGaps = normalizeHealthPlanDataQualityGaps(
    row.data_quality_gaps_json || buildHealthPlanDataQualityGaps({ sourceSignals }),
  );
  const completedImprovementActions = normalizeCompletedHealthPlanImprovementActions(row.completed_improvement_actions_json);
  const feedbackEntries = normalizeHealthPlanFeedbackEntries(row.feedback_entries_json);
  const inferredFeedback = normalizeHealthPlanFeedbackEntries(row.inferred_feedback_json);
  const recommendationLearning = normalizeHealthPlanRecommendationLearning(row.recommendation_learning_json);
  const enrichedSections = enrichHealthPlanSections({
    goals_json: normalizeHealthPlanSectionItems(row.goals_json),
    daily_support_json: normalizeHealthPlanSectionItems(row.daily_support_json),
    monitoring_json: normalizeHealthPlanSectionItems(row.monitoring_json),
    escalation_json: normalizeHealthPlanSectionItems(row.escalation_json),
    caregiver_guidance_json: normalizeHealthPlanSectionItems(row.caregiver_guidance_json),
  }, { sourceSignals, signalTriage });
  const sectionsWithEvidenceReceipts = attachHealthPlanEvidenceReceipts(enrichedSections, {
    sourceSignals,
    signalTriage,
    qualitySnapshot,
  });
  const summarySignalIds = inferHealthPlanSummarySignalIds(row.summary_signal_ids_json, sourceSignals, signalTriage, enrichedSections);
  return {
    id: String(row.id),
    vyva_user_id: row.vyva_user_id == null ? null : String(row.vyva_user_id),
    organization_id: row.organization_id == null ? null : String(row.organization_id),
    current_version: Number(row.current_version || 1),
    last_action_type: normalizeHealthPlanActionType(row.last_action_type, "generated"),
    last_action_at: normalizeTimestampValue(row.last_action_at),
    last_actor_user_id: nullIfBlank(row.last_actor_user_id),
    last_actor_email: nullIfBlank(row.last_actor_email),
    language: normalizeLanguage(row.language, "de"),
    status: nullIfBlank(row.status) || "current",
    review_status: nullIfBlank(row.review_status) === "reviewed" ? "reviewed" : "draft",
    escalation_grade: ["routine", "heightened", "urgent"].includes(nullIfBlank(row.escalation_grade)) ? row.escalation_grade : "routine",
    review_required: Boolean(row.review_required),
    review_window: ["today", "this_week", "ongoing"].includes(nullIfBlank(row.review_window)) ? row.review_window : "ongoing",
    review_summary: nullIfBlank(row.review_summary),
    review_reasons_json: Array.isArray(row.review_reasons_json) ? row.review_reasons_json : [],
    review_note: nullIfBlank(row.review_note),
    review_checklist_json: normalizeHealthPlanReviewChecklist(row.review_checklist_json),
    recommendation_review_decisions_json: normalizeHealthPlanRecommendationReviewDecisions(row.recommendation_review_decisions_json),
    summary_text: nullIfBlank(row.summary_text),
    summary_signal_ids: summarySignalIds,
    goals_json: sectionsWithEvidenceReceipts.goals_json,
    daily_support_json: sectionsWithEvidenceReceipts.daily_support_json,
    monitoring_json: sectionsWithEvidenceReceipts.monitoring_json,
    escalation_json: sectionsWithEvidenceReceipts.escalation_json,
    caregiver_guidance_json: sectionsWithEvidenceReceipts.caregiver_guidance_json,
    source_signals_json: sourceSignals,
    data_quality_gaps_json: dataQualityGaps,
    completed_improvement_actions_json: completedImprovementActions,
    feedback_entries_json: feedbackEntries,
    inferred_feedback_json: inferredFeedback,
    recommendation_learning_json: recommendationLearning,
    quality_snapshot_json: qualitySnapshot,
    generator_provider: nullIfBlank(row.generator_provider),
    generator_model: nullIfBlank(row.generator_model),
    generator_version: nullIfBlank(row.generator_version),
    generated_at: normalizeTimestampValue(row.generated_at),
    generated_by_user_id: nullIfBlank(row.generated_by_user_id),
    reviewed_at: normalizeTimestampValue(row.reviewed_at),
    reviewed_by_user_id: nullIfBlank(row.reviewed_by_user_id),
    reviewed_by_email: nullIfBlank(row.reviewed_by_email),
    updated_at: normalizeTimestampValue(row.updated_at),
  };
}

function normalizeHealthPlanRevisionRow(row) {
  if (!row) return null;
  const sourceSignals = normalizeHealthPlanSourceSignals(row.source_signals_json);
  const signalTriage = buildHealthPlanSignalTriage(sourceSignals);
  const qualitySnapshot = normalizeHealthPlanQualitySnapshot(row.quality_snapshot_json);
  const dataQualityGaps = normalizeHealthPlanDataQualityGaps(
    row.data_quality_gaps_json || buildHealthPlanDataQualityGaps({ sourceSignals }),
  );
  const completedImprovementActions = normalizeCompletedHealthPlanImprovementActions(row.completed_improvement_actions_json);
  const feedbackEntries = normalizeHealthPlanFeedbackEntries(row.feedback_entries_json);
  const inferredFeedback = normalizeHealthPlanFeedbackEntries(row.inferred_feedback_json);
  const recommendationLearning = normalizeHealthPlanRecommendationLearning(row.recommendation_learning_json);
  const enrichedSections = enrichHealthPlanSections({
    goals_json: normalizeHealthPlanSectionItems(row.goals_json),
    daily_support_json: normalizeHealthPlanSectionItems(row.daily_support_json),
    monitoring_json: normalizeHealthPlanSectionItems(row.monitoring_json),
    escalation_json: normalizeHealthPlanSectionItems(row.escalation_json),
    caregiver_guidance_json: normalizeHealthPlanSectionItems(row.caregiver_guidance_json),
  }, { sourceSignals, signalTriage });
  const sectionsWithEvidenceReceipts = attachHealthPlanEvidenceReceipts(enrichedSections, {
    sourceSignals,
    signalTriage,
    qualitySnapshot,
  });
  const summarySignalIds = inferHealthPlanSummarySignalIds(row.summary_signal_ids_json, sourceSignals, signalTriage, enrichedSections);
  return {
    id: String(row.id),
    health_plan_id: row.health_plan_id == null ? null : String(row.health_plan_id),
    vyva_user_id: row.vyva_user_id == null ? null : String(row.vyva_user_id),
    organization_id: row.organization_id == null ? null : String(row.organization_id),
    version_number: Number(row.version_number || 1),
    action_type: normalizeHealthPlanActionType(row.action_type, "edited"),
    actor_user_id: nullIfBlank(row.actor_user_id),
    actor_email: nullIfBlank(row.actor_email),
    created_at: normalizeTimestampValue(row.created_at),
    language: normalizeLanguage(row.language, "de"),
    status: nullIfBlank(row.status) || "current",
    review_status: nullIfBlank(row.review_status) === "reviewed" ? "reviewed" : "draft",
    escalation_grade: ["routine", "heightened", "urgent"].includes(nullIfBlank(row.escalation_grade)) ? row.escalation_grade : "routine",
    review_required: Boolean(row.review_required),
    review_window: ["today", "this_week", "ongoing"].includes(nullIfBlank(row.review_window)) ? row.review_window : "ongoing",
    review_summary: nullIfBlank(row.review_summary),
    review_reasons_json: Array.isArray(row.review_reasons_json) ? row.review_reasons_json : [],
    review_note: nullIfBlank(row.review_note),
    review_checklist_json: normalizeHealthPlanReviewChecklist(row.review_checklist_json),
    recommendation_review_decisions_json: normalizeHealthPlanRecommendationReviewDecisions(row.recommendation_review_decisions_json),
    summary_text: nullIfBlank(row.summary_text),
    summary_signal_ids: summarySignalIds,
    goals_json: sectionsWithEvidenceReceipts.goals_json,
    daily_support_json: sectionsWithEvidenceReceipts.daily_support_json,
    monitoring_json: sectionsWithEvidenceReceipts.monitoring_json,
    escalation_json: sectionsWithEvidenceReceipts.escalation_json,
    caregiver_guidance_json: sectionsWithEvidenceReceipts.caregiver_guidance_json,
    source_signals_json: sourceSignals,
    data_quality_gaps_json: dataQualityGaps,
    completed_improvement_actions_json: completedImprovementActions,
    feedback_entries_json: feedbackEntries,
    inferred_feedback_json: inferredFeedback,
    recommendation_learning_json: recommendationLearning,
    quality_snapshot_json: qualitySnapshot,
    generator_provider: nullIfBlank(row.generator_provider),
    generator_model: nullIfBlank(row.generator_model),
    generator_version: nullIfBlank(row.generator_version),
    generated_at: normalizeTimestampValue(row.generated_at),
    generated_by_user_id: nullIfBlank(row.generated_by_user_id),
    reviewed_at: normalizeTimestampValue(row.reviewed_at),
    reviewed_by_user_id: nullIfBlank(row.reviewed_by_user_id),
    reviewed_by_email: nullIfBlank(row.reviewed_by_email),
  };
}

async function loadCurrentHealthPlan(userId, context, client = { query }) {
  try {
    const result = await client.query(
      `
        SELECT *, id::text, vyva_user_id::text, organization_id::text
        FROM public.vyva_user_health_plans
        WHERE vyva_user_id = $1
          AND organization_id = $2
        LIMIT 1
      `,
      [userId, scopeOrganizationId(context)],
    );
    return normalizeHealthPlanRow(result.rows[0] || null);
  } catch (error) {
    if (error.code === "42P01") return null;
    throw error;
  }
}

async function loadHealthPlanHistory(userId, context, client = { query }) {
  try {
    const result = await client.query(
      `
        SELECT *, id::text, health_plan_id::text, vyva_user_id::text, organization_id::text
        FROM public.vyva_user_health_plan_revisions
        WHERE vyva_user_id = $1
          AND organization_id = $2
        ORDER BY version_number DESC, created_at DESC
      `,
      [userId, scopeOrganizationId(context)],
    );
    return annotateHealthPlanHistory(result.rows.map(normalizeHealthPlanRevisionRow));
  } catch (error) {
    if (error.code === "42P01") return [];
    throw error;
  }
}

function normalizeHealthPlanPeerCohortRow(row) {
  if (!row) return null;
  return {
    vyva_user_id: row.vyva_user_id == null ? null : String(row.vyva_user_id),
    language: normalizeLanguage(row.language || row.user_language, "de"),
    user_language: normalizeLanguage(row.user_language || row.language, "de"),
    living_context: normalizeLivingContextValue(row.living_context),
    health_conditions: Array.isArray(row.health_conditions) ? row.health_conditions.filter(Boolean) : [],
    mobility_needs: Array.isArray(row.mobility_needs) ? row.mobility_needs.filter(Boolean) : [],
    recommendation_learning_json: normalizeHealthPlanRecommendationLearning(row.recommendation_learning_json),
    quality_snapshot_json: normalizeHealthPlanQualitySnapshot(row.quality_snapshot_json),
    source_signals_json: normalizeHealthPlanSourceSignals(row.source_signals_json),
    reviewed_at: normalizeTimestampValue(row.reviewed_at),
    generated_at: normalizeTimestampValue(row.generated_at),
  };
}

async function loadHealthPlanPeerCohortContext(userId, organizationId, client = { query }) {
  if (!userId || !organizationId) return [];
  try {
    const result = await client.query(
      `
        SELECT
          hp.vyva_user_id::text,
          hp.language,
          hp.reviewed_at,
          hp.generated_at,
          hp.recommendation_learning_json,
          hp.quality_snapshot_json,
          hp.source_signals_json,
          u.language AS user_language,
          u.living_context,
          h.health_conditions,
          h.mobility_needs
        FROM public.vyva_user_health_plans hp
        JOIN public.vyva_users u ON u.id = hp.vyva_user_id
        LEFT JOIN public.vyva_user_health h ON h.vyva_user_id = hp.vyva_user_id
        WHERE hp.organization_id = $1
          AND hp.vyva_user_id <> $2
        ORDER BY
          CASE WHEN hp.review_status = 'reviewed' THEN 0 ELSE 1 END,
          COALESCE(hp.reviewed_at, hp.generated_at, hp.updated_at) DESC
        LIMIT 24
      `,
      [organizationId, userId],
    );
    return result.rows.map(normalizeHealthPlanPeerCohortRow).filter(Boolean);
  } catch (error) {
    if (error.code === "42P01") return [];
    throw error;
  }
}

async function loadExternalUserHealthPlan(externalUserId, context, client = { query }) {
  const localUserId = await loadLocalUserIdForExternalUser(externalUserId, context, client);
  if (!localUserId) return null;
  return loadCurrentHealthPlan(localUserId, context, client);
}

async function loadHealthPlanPredictiveContext(userId, organizationId, client = { query }) {
  const [latestScoreRows, latestForecastRows] = await Promise.all([
    optionalRows(
      `
        SELECT
          score_date::text,
          composite_score,
          risk_band,
          delta_from_prior,
          contributing_factors
        FROM public.client_risk_scores_daily
        WHERE client_id = $1
          AND organization_id = $2
        ORDER BY score_date DESC
        LIMIT 1
      `,
      [userId, organizationId],
      client,
    ),
    optionalRows(
      `
        SELECT
          forecast_date::text,
          horizon_day,
          predicted_score,
          predicted_low,
          predicted_high,
          model_confidence,
          forecast_generated_at
        FROM public.client_risk_forecasts
        WHERE client_id = $1
          AND organization_id = $2
          AND forecast_generated_at = (
            SELECT MAX(forecast_generated_at)
            FROM public.client_risk_forecasts
            WHERE client_id = $1
              AND organization_id = $2
          )
        ORDER BY horizon_day ASC
      `,
      [userId, organizationId],
      client,
    ),
  ]);

  return {
    latestScore: latestScoreRows[0] || null,
    forecastRows: latestForecastRows,
  };
}

function languageName(language) {
  if (language === "de") return "German";
  if (language === "es") return "Spanish";
  return "English";
}

function formatTimestampForPlan(value) {
  const timestamp = normalizeTimestampValue(value);
  if (!timestamp) return null;
  return timestamp.replace(".000Z", "Z");
}

function summarizeServiceStatus(service, label) {
  if (!service) return { label, detail: "Not configured yet." };
  const enabled = Boolean(service.enabled);
  const frequency = nullIfBlank(service.frequency) || "No frequency saved";
  const preferredTime = nullIfBlank(firstValue(service.preferred_time, service.preferredTime));
  const lastOutcome = nullIfBlank(firstValue(service.last_outcome, service.lastOutcome, service.status));
  const pausedUntil = normalizeTimestampValue(firstValue(service.paused_until, service.pausedUntil));
  const details = [
    enabled ? "Enabled" : "Disabled",
    frequency,
    preferredTime ? `Preferred time ${preferredTime}` : null,
    lastOutcome ? `Last outcome ${lastOutcome}` : null,
    pausedUntil ? `Paused until ${pausedUntil}` : null,
  ].filter(Boolean);
  return { label, detail: details.join(" · ") };
}

function riskStrengthFromBand(value) {
  const band = String(value || "").trim().toLowerCase();
  if (["critical", "high", "urgent"].includes(band)) return "high";
  if (["moderate", "medium"].includes(band)) return "medium";
  return "low";
}

function serviceStrengthFromStatus(service) {
  if (!service) return "low";
  const enabled = Boolean(service.enabled);
  const status = String(firstValue(service.last_outcome, service.lastOutcome, service.status) || "").trim().toLowerCase();
  if (!enabled || /\bmissed|pending|failed|unconfirmed|disabled|off\b/.test(status)) return "high";
  return "medium";
}

function assembleHealthPlanSourceSignals(profile, predictiveContext) {
  const user = profile?.user || {};
  const health = profile?.health || {};
  const medications = Array.isArray(profile?.medications) ? profile.medications : [];
  const alerts = Array.isArray(profile?.alerts) ? profile.alerts.filter((alert) => !alert?.resolved_at) : [];
  const sensors = Array.isArray(profile?.sensors) ? profile.sensors : [];
  const careProviders = Array.isArray(profile?.careProviders) ? profile.careProviders : [];
  const signalItems = [];
  const latestMedicationStatus = String(profile?.medicationActivity?.status || "").trim().toLowerCase();
  const remindersDisabled = medications.filter((med) => med?.reminders_enabled === false).length;
  const familyConsent = Boolean(profile?.consent?.caretaker_consent ?? profile?.consent?.consent_given);
  const liveEvidenceSummary = buildHealthPlanLiveEvidenceSummary({
    medications,
    medicationActivity: profile?.medicationActivity || null,
    checkins: profile?.checkins || null,
    brainCoach: profile?.brainCoach || null,
    sensors,
    alerts,
    recentOperationalEvents: profile?.recentOperationalEvents || [],
  });

  if (predictiveContext?.latestScore) {
    const score = Number(predictiveContext.latestScore.composite_score);
    const band = nullIfBlank(predictiveContext.latestScore.risk_band) || "unknown";
    const delta = predictiveContext.latestScore.delta_from_prior == null ? null : Number(predictiveContext.latestScore.delta_from_prior);
    signalItems.push({
      id: "risk-latest-score",
      label: `Predictive risk score ${Number.isFinite(score) ? score.toFixed(0) : "unknown"} (${band})`,
      category: "risk",
      strength: riskStrengthFromBand(band),
      detail: [
        predictiveContext.latestScore.score_date ? `As of ${predictiveContext.latestScore.score_date}` : null,
        delta == null || Number.isNaN(delta)
          ? null
          : delta === 0
            ? "No change from prior score"
            : delta > 0
              ? `Up ${delta.toFixed(0)} from prior`
              : `Down ${Math.abs(delta).toFixed(0)} from prior`,
      ].filter(Boolean).join(" · "),
    });
  } else {
    signalItems.push({
      id: "risk-latest-score",
      label: "Predictive insights unavailable",
      category: "risk",
      strength: "medium",
      detail: "This plan used live profile, service, medication, caregiver, and sensor data instead.",
    });
  }

  if (Array.isArray(predictiveContext?.forecastRows) && predictiveContext.forecastRows.length) {
    const nextForecast = predictiveContext.forecastRows.slice(0, 3).map((row) => {
      const score = Number(row.predicted_score);
      return `Day ${row.horizon_day}: ${Number.isFinite(score) ? score.toFixed(0) : "unknown"}`;
    }).join(" · ");
    signalItems.push({
      id: "forecast-near-term",
      label: "Risk forecast",
      category: "forecast",
      strength: "medium",
      detail: nextForecast,
    });
  }

  if (alerts.length) {
    signalItems.push({
      id: "alert-active",
      label: `${alerts.length} active alert${alerts.length === 1 ? "" : "s"}`,
      category: "alert",
      strength: "high",
      detail: alerts.slice(0, 3).map((alert) => nullIfBlank(alert.message) || nullIfBlank(alert.alert_type)).filter(Boolean).join(" · "),
    });
  }

  if (medications.length) {
    const disabled = medications.filter((med) => med?.reminders_enabled === false).length;
    const times = medications
      .flatMap((med) => Array.isArray(med?.schedule_times) ? med.schedule_times : [])
      .filter(Boolean)
      .slice(0, 4)
      .join(", ");
    signalItems.push({
      id: "medication-plan",
      label: `${medications.length} medication${medications.length === 1 ? "" : "s"} on file`,
      category: "medication",
      strength: ["missed", "late", "skipped", "unconfirmed"].includes(latestMedicationStatus) || remindersDisabled ? "high" : "medium",
      detail: [
        disabled ? `${disabled} reminder${disabled === 1 ? "" : "s"} currently off` : null,
        times ? `Saved reminder times ${times}` : null,
        profile?.medicationActivity?.status ? `Latest adherence ${profile.medicationActivity.status}` : null,
      ].filter(Boolean).join(" · "),
    });
  }

  signalItems.push({
    id: "service-checkins",
    category: "service",
    strength: serviceStrengthFromStatus(profile?.checkins),
    ...summarizeServiceStatus(profile?.checkins, "Check-ins"),
  });
  signalItems.push({
    id: "service-brain-coach",
    category: "service",
    strength: serviceStrengthFromStatus(profile?.brainCoach),
    ...summarizeServiceStatus(profile?.brainCoach, "Brain Coach"),
  });

  if (sensors.length) {
    const offline = sensors.filter((sensor) => String(sensor?.status || "").toLowerCase() !== "online").length;
    signalItems.push({
      id: "sensor-status",
      label: `${sensors.length} sensor${sensors.length === 1 ? "" : "s"} linked`,
      category: "sensor",
      strength: offline ? "high" : "medium",
      detail: offline ? `${offline} offline or not reporting` : "All currently reporting",
    });
  }

  signalItems.push({
    id: "consent-family-sharing",
    label: familyConsent ? "Family sharing consent confirmed" : "Family sharing consent not confirmed",
    category: "care-circle",
    strength: familyConsent ? "low" : "high",
    detail: familyConsent
      ? "Caregiver-facing guidance can stay practical and specific."
      : "Keep client-specific guidance narrow until the sharing boundary is confirmed.",
  });

  const healthHighlights = [
    ...(Array.isArray(health?.health_conditions) ? health.health_conditions : []),
    ...(Array.isArray(health?.mobility_needs) ? health.mobility_needs : []),
  ].filter(Boolean);
  const livingContext = normalizeLivingContextValue(firstValue(user.living_context, user.livingContext));
  if (healthHighlights.length || careProviders.length || livingContext || !careProviders.length) {
    signalItems.push({
      id: "care-circle-context",
      label: "Care circle context",
      category: "care-circle",
      strength: careProviders.length ? "medium" : "high",
      detail: [
        livingContext ? `Living context ${livingContext}` : null,
        healthHighlights.slice(0, 4).join(", ") || null,
        careProviders.length
          ? `${careProviders.length} care provider assignment${careProviders.length === 1 ? "" : "s"}`
          : "No care provider assignment recorded",
      ].filter(Boolean).join(" · "),
    });
  }

  if (healthHighlights.length || livingContext) {
    signalItems.push({
      id: "context-live-profile",
      label: "Profile context",
      category: "context",
      strength: "medium",
      detail: [
        livingContext ? `Living context ${livingContext}` : null,
        healthHighlights.slice(0, 4).join(", ") || null,
      ].filter(Boolean).join(" Â· "),
    });
  }

  signalItems.push(...buildHealthPlanLiveEvidenceSignals(liveEvidenceSummary));

  return normalizeHealthPlanSourceSignals(signalItems);
}

function findHealthPlanSignalId(sourceSignals, matcher) {
  return sourceSignals.find((signal) => matcher(signal))?.id || null;
}

function deriveCriticalHealthPlanSignalIds(profile, predictiveContext, sourceSignals) {
  const critical = [];
  const riskBand = String(predictiveContext?.latestScore?.risk_band || "").trim().toLowerCase();
  const latestMedicationStatus = String(profile?.medicationActivity?.status || "").trim().toLowerCase();
  const hasActiveAlerts = Array.isArray(profile?.alerts) && profile.alerts.some((alert) => !alert?.resolved_at);
  const sensors = Array.isArray(profile?.sensors) ? profile.sensors : [];
  const offlineSensors = sensors.some((sensor) => String(sensor?.status || "").toLowerCase() !== "online");
  const careProviders = Array.isArray(profile?.careProviders) ? profile.careProviders : [];
  const liveEvidenceSummary = buildHealthPlanLiveEvidenceSummary({
    medications: profile?.medications || [],
    medicationActivity: profile?.medicationActivity || null,
    checkins: profile?.checkins || null,
    brainCoach: profile?.brainCoach || null,
    sensors,
    alerts: profile?.alerts || [],
    recentOperationalEvents: profile?.recentOperationalEvents || [],
  });

  if (["critical", "high", "urgent"].includes(riskBand)) {
    critical.push("risk-latest-score");
  }
  if (hasActiveAlerts) {
    critical.push("alert-active");
  }
  if (["missed", "late", "skipped", "unconfirmed"].includes(latestMedicationStatus)) {
    critical.push("medication-plan");
  }
  if (offlineSensors) {
    critical.push("sensor-status");
  }
  if (!careProviders.length) {
    critical.push("care-circle-context");
  }
  if (liveEvidenceSummary?.contact_pressure?.status === "pressure") {
    critical.push("service-engagement");
    critical.push("contact-trend-window");
  }
  if (liveEvidenceSummary?.medication_adherence?.status === "pressure") {
    critical.push("medication-adherence-trend");
  }
  if (liveEvidenceSummary?.sensor_reliability?.status === "pressure") {
    critical.push("sensor-reliability");
  }

  return [...new Set(critical.filter((signalId) => sourceSignals.some((signal) => signal?.id === signalId)))];
}

const healthPlanSectionDefinitions = [
  { storageKey: "goals_json", outputKey: "goals", promptLabel: "goals" },
  { storageKey: "daily_support_json", outputKey: "daily_support", promptLabel: "daily support" },
  { storageKey: "monitoring_json", outputKey: "monitoring", promptLabel: "monitoring" },
  { storageKey: "escalation_json", outputKey: "escalation", promptLabel: "escalation signs" },
  { storageKey: "caregiver_guidance_json", outputKey: "caregiver_guidance", promptLabel: "caregiver guidance" },
];

const healthPlanSectionDefinitionByStorageKey = Object.fromEntries(
  healthPlanSectionDefinitions.map((definition) => [definition.storageKey, definition]),
);

function buildHealthPlanGovernanceSnapshot({
  sourceSignals = [],
  signalTriage = {},
  criticalSignalIds = [],
  dataQualityGaps = [],
  followThrough = null,
  sectionDrift = [],
  feedbackEntries = [],
} = {}) {
  const evidenceConflicts = buildHealthPlanEvidenceConflicts({
    sourceSignals,
    feedbackEntries,
    followThrough,
    sectionDrift,
  });
  const escalationGrade = buildHealthPlanEscalationGrade({
    sourceSignals,
    signalTriage,
    criticalSignalIds,
    followThrough,
    evidenceConflicts,
  });
  const reviewGovernance = buildHealthPlanReviewGovernance({
    escalationGrade,
    dataQualityGaps,
    followThrough,
    evidenceConflicts,
  });
  return {
    escalationGrade,
    evidenceConflicts,
    reviewGovernance,
  };
}

function applyHealthPlanConfidenceCalibration(
  plan,
  {
    sourceSignals = [],
    dataQualityGaps = [],
    evidenceConflicts = [],
    followThrough = null,
    sectionDrift = [],
  } = {},
) {
  const confidenceProfile = buildHealthPlanConfidenceProfile({
    plan,
    sourceSignals,
    dataQualityGaps,
    evidenceConflicts,
    followThrough,
    sectionDrift,
  });
  return {
    plan: confidenceProfile?.plan || plan,
    confidenceProfile,
  };
}

function normalizeHealthPlanTargetSections(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(
    value
      .map((item) => nullIfBlank(item))
      .filter((item) => item && healthPlanSectionDefinitionByStorageKey[item]),
  )];
}

function assembleHealthPlanPromptInput(
  profile,
  predictiveContext,
  sourceSignals,
  language,
  existingPlan = null,
  existingPlanFeedback = null,
  existingPlanHistory = [],
  options = {},
) {
  const user = profile?.user || {};
  const health = profile?.health || {};
  const medications = Array.isArray(profile?.medications) ? profile.medications : [];
  const sensors = Array.isArray(profile?.sensors) ? profile.sensors : [];
  const alerts = Array.isArray(profile?.alerts) ? profile.alerts : [];
  const careProviders = Array.isArray(profile?.careProviders) ? profile.careProviders : [];
  const recentOperationalEvents = buildHealthPlanOperationalActivitySummary(profile?.recentOperationalEvents, 10);
  const liveEvidenceSummary = buildHealthPlanLiveEvidenceSummary({
    medications,
    medicationActivity: profile?.medicationActivity || null,
    checkins: profile?.checkins || null,
    brainCoach: profile?.brainCoach || null,
    sensors,
    alerts,
    recentOperationalEvents: profile?.recentOperationalEvents || [],
  });
  const longitudinalMemory = buildHealthPlanLongitudinalMemory({
    liveEvidenceSummary,
    history: existingPlanHistory,
  });
  const targetSections = normalizeHealthPlanTargetSections(options?.targetSections);
  const criticalSignalIds = deriveCriticalHealthPlanSignalIds(profile, predictiveContext, sourceSignals);
  const signalTriage = buildHealthPlanSignalTriage(sourceSignals, criticalSignalIds);
  const dataQualityGaps = buildHealthPlanDataQualityGaps({ profile, predictiveContext, sourceSignals });
  const existingPlanSectionDrift = existingPlan
    ? buildHealthPlanSectionDrift({
      plan: existingPlan,
      dataQualityGaps,
      followThrough: existingPlanFeedback,
    })
    : [];
  const completedImprovementActions = normalizeCompletedHealthPlanImprovementActions(existingPlan?.completed_improvement_actions_json);
  const explicitFeedbackEntries = normalizeHealthPlanFeedbackEntries(existingPlan?.feedback_entries_json);
  const inferredOperationalFeedback = existingPlan
    ? buildHealthPlanInferredFeedbackEntries({
      plan: existingPlan,
      profile,
      predictiveContext,
      followThrough: existingPlanFeedback,
    })
    : [];
  const feedbackEntries = [...explicitFeedbackEntries, ...inferredOperationalFeedback].sort((left, right) => {
    const leftTime = left?.recorded_at ? new Date(left.recorded_at).getTime() : 0;
    const rightTime = right?.recorded_at ? new Date(right.recorded_at).getTime() : 0;
    return rightTime - leftTime;
  });
  const evidenceHierarchy = buildHealthPlanEvidenceHierarchy({
    sourceSignals,
    feedbackEntries,
  });
  const evidenceConflicts = buildHealthPlanEvidenceConflicts({
    sourceSignals,
    feedbackEntries,
    followThrough: existingPlanFeedback,
    sectionDrift: existingPlanSectionDrift,
  });
  const escalationGrade = buildHealthPlanGovernanceSnapshot({
    sourceSignals,
    signalTriage,
    criticalSignalIds,
    dataQualityGaps,
    followThrough: existingPlanFeedback,
    sectionDrift: existingPlanSectionDrift,
    feedbackEntries,
  }).escalationGrade;
  const improvementActions = buildHealthPlanImprovementActions({
    dataQualityGaps,
    followThrough: existingPlanFeedback,
    sectionDrift: existingPlanSectionDrift,
    completedActions: completedImprovementActions,
  });
  const sectionOutcomes = existingPlan
    ? buildHealthPlanOutcomeScores({
      plan: existingPlan,
      feedbackEntries,
      followThrough: existingPlanFeedback,
      sectionDrift: existingPlanSectionDrift,
    })
    : [];
  const recommendationLearning = existingPlan
    ? buildHealthPlanRecommendationOutcomeMemory({
      plan: existingPlan,
      feedbackEntries,
      followThrough: existingPlanFeedback,
      sectionDrift: existingPlanSectionDrift,
      recentOperationalEvents: profile?.recentOperationalEvents,
      sourceSignals,
    })
    : [];
  const signalPreferenceWeights = existingPlan
    ? buildHealthPlanSignalPreferenceWeights({
      plan: existingPlan,
      feedbackEntries,
      sourceSignals,
      followThrough: existingPlanFeedback,
      sectionDrift: existingPlanSectionDrift,
      recentOperationalEvents: profile?.recentOperationalEvents,
    })
    : [];
  const recommendationSurvivorship = existingPlan
    ? buildHealthPlanRecommendationSurvivorship({
      history: Array.isArray(existingPlanHistory) && existingPlanHistory.length
        ? existingPlanHistory
        : [existingPlan],
    })
    : null;
  const recommendationRevisionMemory = existingPlan || (Array.isArray(existingPlanHistory) && existingPlanHistory.length)
    ? buildHealthPlanRecommendationRevisionMemory({
      history: Array.isArray(existingPlanHistory) && existingPlanHistory.length
        ? existingPlanHistory
        : [existingPlan],
      recommendationSurvivorship,
    })
    : null;
  const qualityMemory = existingPlan || (Array.isArray(existingPlanHistory) && existingPlanHistory.length)
    ? buildHealthPlanQualityMemory({
      existingPlan,
      history: existingPlanHistory,
    })
    : null;
  const outcomePatternMemory = existingPlan || (Array.isArray(existingPlanHistory) && existingPlanHistory.length)
    ? buildHealthPlanOutcomePatternMemory({
      existingPlan,
      history: existingPlanHistory,
    })
    : null;
  const clientResponseMemory = buildHealthPlanClientResponseMemory({
    recentOperationalEvents: profile?.recentOperationalEvents,
    recommendationLearning,
    sectionOutcomes,
    sourceSignals,
  });
  const evidencePack = buildHealthPlanEvidencePack({
    sourceSignals,
    signalTriage,
    criticalSignalIds,
    evidenceHierarchy,
    evidenceConflicts,
    escalationGrade,
    dataQualityGaps,
    followThrough: existingPlanFeedback,
    qualityMemory,
  });
  const benchmarkGuidance = buildHealthPlanBenchmarkGuidance({
    sourceSignals,
    evidencePack,
  });
  const interventionMemory = existingPlan
    ? buildHealthPlanInterventionMemory({
      plan: existingPlan,
      dataQualityGaps,
      followThrough: existingPlanFeedback,
      sectionDrift: existingPlanSectionDrift,
      completedActions: completedImprovementActions,
      feedbackEntries,
    })
    : [];
  const confidenceGuardrails = buildHealthPlanConfidenceProfile({
    sourceSignals,
    dataQualityGaps,
    evidenceConflicts,
    followThrough: existingPlanFeedback,
    sectionDrift: existingPlanSectionDrift,
  });
  const clinicalCautions = buildHealthPlanClinicalCautions({
    sourceSignals,
    followThrough: existingPlanFeedback,
  });
  const criticalResponseBrief = buildHealthPlanCriticalResponseBrief({
    sourceSignals,
    evidencePack,
    escalationGrade,
    clinicalCautions,
    careProviders,
  });
  const clinicalCautionIssues = existingPlan
    ? findHealthPlanClinicalCautionIssues(existingPlan, {
      sourceSignals,
      followThrough: existingPlanFeedback,
      clinicalCautions,
    })
    : [];
  const reviewGovernance = buildHealthPlanReviewGovernance({
    escalationGrade,
    dataQualityGaps,
    followThrough: existingPlanFeedback,
    evidenceConflicts,
  });
  const existingPlanFreshness = existingPlan
    ? buildHealthPlanFreshnessSnapshot({
      plan: existingPlan,
      followThrough: existingPlanFeedback,
      recentOperationalEvents: profile?.recentOperationalEvents,
      reviewGovernance,
      sectionDrift: existingPlanSectionDrift,
    })
    : null;
  const existingPlanRefreshStrategy = existingPlan
    ? buildHealthPlanRefreshStrategy({
      freshness: existingPlanFreshness,
      sectionDrift: existingPlanSectionDrift,
      clinicalCautions,
      clinicalCautionIssues,
      reviewGovernance,
      followThrough: existingPlanFeedback,
    })
    : null;
  const reviewPriorities = buildHealthPlanReviewPriorities({
    sourceSignals,
    escalationGrade,
    reviewGovernance,
    confidenceProfile: confidenceGuardrails,
    evidencePack,
    sectionOutcomes,
    qualityMemory,
    clientResponseMemory,
    clinicalCautions,
    freshness: existingPlanFreshness,
    refreshStrategy: existingPlanRefreshStrategy,
  });
  const readiness = buildHealthPlanReadiness({
    dataQualityGaps,
    confidenceProfile: confidenceGuardrails,
    reviewGovernance,
    liveEvidenceSummary,
    freshness: existingPlanFreshness,
    longitudinalMemory,
  });
  const operationalCompleteness = existingPlan
    ? buildHealthPlanOperationalCompleteness({
      plan: existingPlan,
      reviewPriorities,
      escalationGrade,
      liveEvidenceSummary,
    })
    : null;
  const actionImpact = existingPlan
    ? buildHealthPlanActionImpact({
      plan: existingPlan,
      followThrough: existingPlanFeedback,
      recentOperationalEvents: profile?.recentOperationalEvents,
      liveEvidenceSummary,
      operationalCompleteness,
    })
    : null;
  const recommendationImpact = existingPlan
    ? buildHealthPlanRecommendationImpact({
      plan: existingPlan,
      recentOperationalEvents: profile?.recentOperationalEvents,
      liveEvidenceSummary,
      followThrough: existingPlanFeedback,
      sourceSignals,
    })
    : null;
  const recommendationEffectiveness = buildHealthPlanRecommendationEffectiveness({
    recommendationLearning,
    recommendationSurvivorship,
    recommendationImpact,
  });
  const resolvedCohortGuidance = buildHealthPlanCohortGuidance({
    profile: {
      language: normalizeLanguage(firstValue(user.language, user.lang), language),
      living_context: normalizeLivingContextValue(firstValue(user.living_context, user.livingContext)),
      health_conditions: Array.isArray(health?.health_conditions) ? health.health_conditions.filter(Boolean) : [],
      mobility_needs: Array.isArray(health?.mobility_needs) ? health.mobility_needs.filter(Boolean) : [],
    },
    peerPlans: Array.isArray(options?.peerCohort) ? options.peerCohort : [],
    clientResponseMemory,
    recommendationEffectiveness,
  });
  const recommendationHistory = existingPlan || (Array.isArray(existingPlanHistory) && existingPlanHistory.length)
    ? buildHealthPlanRecommendationHistory({
      history: Array.isArray(existingPlanHistory) && existingPlanHistory.length
        ? existingPlanHistory
        : [existingPlan],
      recommendationImpact,
      recommendationEffectiveness,
    })
    : null;
  const recommendationRepairBrief = buildHealthPlanRecommendationRepairBrief({
    recommendationLearning,
    recommendationEffectiveness,
    recommendationGrounding: null,
    recommendationChallenges: null,
    recommendationSourceRanking: null,
  });
  const recommendationEvidenceDiversity = existingPlan
    ? buildHealthPlanRecommendationEvidenceDiversity({
      recommendationSourceRanking: buildHealthPlanRecommendationSourceRanking({
        plan: existingPlan,
        sourceSignals,
        evidenceHierarchy,
        signalPreferenceWeights,
        recommendationEffectiveness,
      }),
    })
    : null;
  const recommendationReview = existingPlan
    ? buildHealthPlanRecommendationReviewSummary({
      plan: existingPlan,
      recommendationImpact,
      recommendationHistory,
      recommendationEvidenceDiversity,
      recommendationGrounding: null,
      recommendationChallenges: null,
      recommendationReviewDecisions: existingPlan.recommendation_review_decisions_json,
    })
    : null;
  const recommendationChallenges = existingPlan
    ? buildHealthPlanRecommendationChallenges({
      plan: existingPlan,
      sourceSignals,
      reviewPriorities,
      liveEvidenceSummary,
      longitudinalMemory,
    })
    : null;
  const executionBrief = existingPlan
    ? buildHealthPlanExecutionBrief({
      plan: existingPlan,
      reviewPriorities,
      escalationGrade,
      liveEvidenceSummary,
    })
    : null;
  const reviewRemediation = existingPlan?.quality_snapshot_json?.review_remediation || null;
  const existingPlanCalibration = existingPlan?.quality_snapshot_json?.recommendation_calibration
    ? buildHealthPlanCalibrationRepairBrief(existingPlan.quality_snapshot_json.recommendation_calibration)
    : null;
  const generationBrief = buildHealthPlanGenerationBrief({
    sourceSignals,
    signalTriage,
    evidenceHierarchy,
    evidencePack,
    reviewPriorities,
    clinicalCautions,
    recommendationRepairBrief,
    clientResponseMemory,
    recommendationEffectiveness,
    recommendationChallenges,
    benchmarkGuidance,
    executionBrief,
    reviewRemediation,
    cohortGuidance: resolvedCohortGuidance,
    liveEvidenceSummary,
    longitudinalMemory,
    refreshStrategy: existingPlanRefreshStrategy,
    targetSections,
  });
  const responseAdjudicationBrief = buildHealthPlanResponseAdjudicationBrief({
    generationBrief,
    criticalResponseBrief,
  });

  return {
    language,
    generation_brief: generationBrief,
    client: {
      first_name: nullIfBlank(firstValue(user.first_name, user.firstName)),
      last_name: nullIfBlank(firstValue(user.last_name, user.lastName)),
      age: getAgeFromDateOfBirth(firstValue(user.date_of_birth, user.dateOfBirth)),
      city: nullIfBlank(user.city),
      living_context: normalizeLivingContextValue(firstValue(user.living_context, user.livingContext)),
      preferred_language: normalizeLanguage(firstValue(user.language, user.lang), language),
      family_consent: Boolean(profile?.consent?.caretaker_consent ?? profile?.consent?.consent_given),
      care_notes: nullIfBlank(firstValue(user.emergency_notes, user.emergencyNotes)),
    },
    health: {
      health_conditions: Array.isArray(health?.health_conditions) ? health.health_conditions.filter(Boolean) : [],
      mobility_needs: Array.isArray(health?.mobility_needs) ? health.mobility_needs.filter(Boolean) : [],
    },
    medications: medications.map((med) => ({
      medication_name: nullIfBlank(med?.medication_name),
      dosage: nullIfBlank(med?.dosage),
      purpose: nullIfBlank(med?.purpose),
      frequency: nullIfBlank(med?.frequency),
      reminders_enabled: med?.reminders_enabled !== false,
      schedule_times: Array.isArray(med?.schedule_times) ? med.schedule_times.filter(Boolean) : [],
    })),
    medication_activity: profile?.medicationActivity
      ? {
          medication_name: nullIfBlank(profile.medicationActivity.medication_name),
          status: nullIfBlank(profile.medicationActivity.status),
          occurred_at: formatTimestampForPlan(profile.medicationActivity.occurred_at || profile.medicationActivity.reported_at),
        }
      : null,
    checkins: profile?.checkins
      ? {
          enabled: Boolean(profile.checkins.enabled),
          frequency: nullIfBlank(profile.checkins.frequency),
          preferred_time: nullIfBlank(profile.checkins.preferred_time),
          last_outcome: nullIfBlank(firstValue(profile.checkins.last_outcome, profile.checkins.lastOutcome)),
        }
      : null,
    brain_coach: profile?.brainCoach
      ? {
          enabled: Boolean(profile.brainCoach.enabled),
          frequency: nullIfBlank(profile.brainCoach.frequency),
          preferred_time: nullIfBlank(profile.brainCoach.preferred_time),
          last_outcome: nullIfBlank(firstValue(profile.brainCoach.last_outcome, profile.brainCoach.lastOutcome)),
        }
      : null,
    sensors: sensors.map((sensor) => ({
      device_name: nullIfBlank(sensor?.device_name) || nullIfBlank(sensor?.device_id),
      sensor_type: nullIfBlank(sensor?.sensor_type),
      status: nullIfBlank(sensor?.status),
      battery_level: sensor?.battery_level ?? null,
      last_reading_at: formatTimestampForPlan(sensor?.last_reading_at),
    })),
    alerts: alerts.slice(0, 10).map((alert) => ({
      severity: nullIfBlank(alert?.severity),
      message: nullIfBlank(alert?.message),
      alert_type: nullIfBlank(alert?.alert_type),
      created_at: formatTimestampForPlan(alert?.created_at),
    })),
    recent_operational_events: recentOperationalEvents.map((event) => ({
      source: event.source,
      status: nullIfBlank(event.status),
      occurred_at: formatTimestampForPlan(event.occurred_at),
      label: nullIfBlank(event.label),
      note: nullIfBlank(event.note),
      signal_ids: Array.isArray(event.signal_ids) ? event.signal_ids : [],
    })),
    live_evidence_summary: liveEvidenceSummary,
    longitudinal_memory: longitudinalMemory,
    care_providers: careProviders.map((provider) => ({
      display_name: nullIfBlank(provider?.display_name),
      provider_type: nullIfBlank(provider?.provider_type),
      is_primary: Boolean(provider?.is_primary),
      relationship_label: nullIfBlank(provider?.relationship_label),
    })),
    predictive: predictiveContext?.latestScore || predictiveContext?.forecastRows?.length
      ? predictiveContext
      : { unavailable: true },
    existing_plan: existingPlan
      ? {
          generated_at: existingPlan.generated_at || null,
          reviewed_at: existingPlan.reviewed_at || null,
          review_status: existingPlan.review_status || null,
          review_note: existingPlan.review_note || null,
          review_checklist: normalizeHealthPlanReviewChecklist(existingPlan.review_checklist_json),
          recommendation_review_decisions: normalizeHealthPlanRecommendationReviewDecisions(existingPlan.recommendation_review_decisions_json),
          summary_text: existingPlan.summary_text || null,
          summary_signal_ids: normalizeHealthPlanSignalIds(existingPlan.summary_signal_ids),
          goals: normalizeHealthPlanSectionItems(existingPlan.goals_json),
          daily_support: normalizeHealthPlanSectionItems(existingPlan.daily_support_json),
          monitoring: normalizeHealthPlanSectionItems(existingPlan.monitoring_json),
          escalation: normalizeHealthPlanSectionItems(existingPlan.escalation_json),
          caregiver_guidance: normalizeHealthPlanSectionItems(existingPlan.caregiver_guidance_json),
        }
      : null,
    existing_plan_feedback: existingPlanFeedback || null,
    existing_plan_freshness: existingPlanFreshness,
    existing_plan_refresh_strategy: existingPlanRefreshStrategy,
    existing_plan_section_drift: existingPlanSectionDrift,
    existing_plan_calibration: existingPlanCalibration,
    escalation_grade: buildHealthPlanEscalationGradeBrief(escalationGrade),
    review_governance: reviewGovernance,
    evidence_hierarchy: buildHealthPlanEvidenceHierarchyBrief(evidenceHierarchy),
    evidence_conflicts: evidenceConflicts.slice(0, 8),
    explicit_staff_feedback: explicitFeedbackEntries,
    inferred_operational_feedback: inferredOperationalFeedback,
    section_outcomes: buildHealthPlanOutcomeScoreBrief(sectionOutcomes),
    recommendation_learning: recommendationLearning.slice(0, 12).map((item) => ({
      item_id: item.item_id,
      section_key: item.section_key,
      section_label: item.section_label,
      text: item.text,
      status: item.status,
      score: item.score,
      latest_outcome: item.latest_outcome,
      inherited_section_outcome: item.inherited_section_outcome,
      freshness_status: item.freshness_status,
      feedback_count: item.feedback_count,
      helped_count: item.helped_count,
      mixed_count: item.mixed_count,
      did_not_help_count: item.did_not_help_count,
      needs_follow_up_count: item.needs_follow_up_count,
      operational_positive_count: item.operational_positive_count,
      operational_caution_count: item.operational_caution_count,
      operational_pattern: item.operational_pattern,
      operational_source_labels: item.operational_source_labels,
      operational_reason: item.operational_reason,
      last_operational_at: item.last_operational_at,
      trajectory: item.trajectory,
      reuse_priority: item.reuse_priority,
      contradiction_status: item.contradiction_status,
      contradiction_reason: item.contradiction_reason,
      reason: item.reason,
      source_signal_ids: item.source_signal_ids,
    })),
    recommendation_survivorship: recommendationSurvivorship
      ? {
          summary: recommendationSurvivorship.summary,
          durable: recommendationSurvivorship.durable.slice(0, 6),
          emerging: recommendationSurvivorship.emerging.slice(0, 6),
          fragile: recommendationSurvivorship.fragile.slice(0, 6),
          retired: recommendationSurvivorship.retired.slice(0, 6),
        }
      : null,
    recommendation_revision_memory: recommendationRevisionMemory
      ? {
          summary: recommendationRevisionMemory.summary,
          improved_count: recommendationRevisionMemory.improved_count,
          preserved_count: recommendationRevisionMemory.preserved_count,
          unresolved_count: recommendationRevisionMemory.unresolved_count,
          regressed_count: recommendationRevisionMemory.regressed_count,
          improved: recommendationRevisionMemory.improved.slice(0, 6),
          preserved: recommendationRevisionMemory.preserved.slice(0, 6),
          unresolved: recommendationRevisionMemory.unresolved.slice(0, 6),
          regressed: recommendationRevisionMemory.regressed.slice(0, 6),
        }
      : null,
    quality_memory: qualityMemory
      ? {
          summary: qualityMemory.summary,
          latest_review_judgment: qualityMemory.latest_review_judgment,
          current_guardrails: qualityMemory.current_guardrails.slice(0, 5),
          repeated_refresh_sections: qualityMemory.repeated_refresh_sections.slice(0, 5),
          recurring_quality_risks: qualityMemory.recurring_quality_risks.slice(0, 6),
          candidate_selection_memory: qualityMemory.candidate_selection_memory || null,
          durable_patterns: qualityMemory.durable_patterns.slice(0, 5),
          fragile_patterns: qualityMemory.fragile_patterns.slice(0, 5),
        }
      : null,
    outcome_pattern_memory: outcomePatternMemory
      ? {
          summary: outcomePatternMemory.summary,
          total_revisions: outcomePatternMemory.total_revisions,
          stable_response_anchors: outcomePatternMemory.stable_response_anchors.slice(0, 4),
          fragile_response_anchors: outcomePatternMemory.fragile_response_anchors.slice(0, 4),
          preserve_patterns: outcomePatternMemory.preserve_patterns.slice(0, 5),
          watch_patterns: outcomePatternMemory.watch_patterns.slice(0, 5),
          replace_patterns: outcomePatternMemory.replace_patterns.slice(0, 5),
          unstable_sections: outcomePatternMemory.unstable_sections.slice(0, 5),
          stable_domains: outcomePatternMemory.stable_domains.slice(0, 4),
          fragile_domains: outcomePatternMemory.fragile_domains.slice(0, 4),
          guardrails: outcomePatternMemory.guardrails.slice(0, 6),
        }
      : null,
    client_response_memory: clientResponseMemory,
    cohort_guidance: resolvedCohortGuidance,
    evidence_pack: evidencePack,
    benchmark_guidance: benchmarkGuidance,
    signal_preference_weights: signalPreferenceWeights.slice(0, 10),
    recommendation_effectiveness: recommendationEffectiveness,
    recommendation_impact: recommendationImpact,
    recommendation_history: recommendationHistory
      ? {
          overall_status: recommendationHistory.overall_status,
          summary: recommendationHistory.summary,
          improving_count: recommendationHistory.improving_count,
          stable_count: recommendationHistory.stable_count,
          deteriorating_count: recommendationHistory.deteriorating_count,
          volatile_count: recommendationHistory.volatile_count,
          repeated_contradiction_count: recommendationHistory.repeated_contradiction_count,
          high_priority_deteriorating_count: recommendationHistory.high_priority_deteriorating_count,
          items: recommendationHistory.items.slice(0, 6),
        }
      : null,
    recommendation_evidence_diversity: recommendationEvidenceDiversity
      ? {
          overall_status: recommendationEvidenceDiversity.overall_status,
          summary: recommendationEvidenceDiversity.summary,
          strong_count: recommendationEvidenceDiversity.strong_count,
          guarded_count: recommendationEvidenceDiversity.guarded_count,
          fragile_count: recommendationEvidenceDiversity.fragile_count,
          high_priority_fragile_count: recommendationEvidenceDiversity.high_priority_fragile_count,
          issues: recommendationEvidenceDiversity.issues.slice(0, 6),
          items: recommendationEvidenceDiversity.items.slice(0, 6),
        }
      : null,
    recommendation_review: recommendationReview,
    recommendation_challenges: recommendationChallenges,
    execution_brief: executionBrief,
    review_remediation: reviewRemediation,
    operational_completeness: operationalCompleteness,
    action_impact: actionImpact,
    recommendation_repair_brief: recommendationRepairBrief,
    critical_response_brief: criticalResponseBrief,
    response_adjudication_brief: responseAdjudicationBrief,
    intervention_memory: buildHealthPlanInterventionMemoryBrief(interventionMemory),
    completed_improvement_actions: buildCompletedHealthPlanImprovementBrief(completedImprovementActions),
    review_priorities: reviewPriorities,
    confidence_guardrails: {
      overall_status: confidenceGuardrails.overall_status,
      summary: confidenceGuardrails.summary,
      reasons: confidenceGuardrails.reasons.slice(0, 5),
      section_confidence: confidenceGuardrails.section_confidence.map((item) => ({
        section_key: item.section_key,
        max_confidence: item.max_confidence,
        reasons: item.reasons.slice(0, 3),
      })),
    },
    clinical_cautions: clinicalCautions,
    target_sections: targetSections.length
      ? targetSections.map((sectionKey) => {
          const definition = healthPlanSectionDefinitionByStorageKey[sectionKey];
          const driftItem = existingPlanSectionDrift.find((item) => item?.section_key === sectionKey);
          return {
            section_key: sectionKey,
            section_label: definition?.promptLabel || sectionKey,
            current_items: normalizeHealthPlanSectionItems(existingPlan?.[sectionKey]),
            drift_status: driftItem?.status || "fresh",
            drift_reasons: Array.isArray(driftItem?.reasons) ? driftItem.reasons : [],
          };
        })
      : [],
    critical_signal_ids: criticalSignalIds,
    signal_triage: signalTriage,
    data_quality_gaps: dataQualityGaps,
    improvement_actions: buildHealthPlanImprovementBrief(improvementActions),
    readiness,
    source_signals: sourceSignals,
  };
}

function assertHealthPlanReadinessForGeneration(promptInput, label = "Health plan generation") {
  const readiness = promptInput?.readiness || null;
  if (!shouldBlockHealthPlanReadiness(readiness)) return;
  const blocker = Array.isArray(readiness?.blocking_reasons) ? readiness.blocking_reasons[0] : null;
  const action = Array.isArray(readiness?.collection_actions) ? readiness.collection_actions[0] : null;
  const message = [
    text(blocker?.label) || text(readiness?.summary) || `${label} is blocked until more evidence is collected.`,
    text(action?.action) ? `Next step: ${text(action.action)}` : "",
  ].filter(Boolean).join(" ");
  throw healthPlanGenerationError(409, message, {
    code: "health_plan_readiness_blocked",
    readiness,
  });
}

function getAgeFromDateOfBirth(value) {
  const text = normalizeDateValue(value);
  if (!text) return null;
  const birth = new Date(`${text}T00:00:00Z`);
  if (Number.isNaN(birth.getTime())) return null;
  return Math.floor((Date.now() - birth.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
}

function buildStoredInferredFeedbackSnapshot(existingPlan, profile, predictiveContext, followThrough) {
  if (!existingPlan) return [];
  return buildHealthPlanInferredFeedbackEntries({
    plan: existingPlan,
    profile,
    predictiveContext,
    followThrough,
  });
}

function assertNoRecommendationCarryForward({
  existingPlan = null,
  nextPlan = null,
  promptInput = null,
  targetSections = [],
  label = "health plan generation",
} = {}) {
  const issues = findHealthPlanRecommendationCarryForwardIssues({
    existingPlan,
    recommendationLearning: promptInput?.recommendation_learning || [],
    nextPlan,
    targetSections,
  });
  if (!issues.length) return;
  const first = issues[0];
  throw httpError(
    502,
    `${label} repeated a recommendation that prior evidence marked for replacement in ${first.section_key || "the plan"}: ${first.text || "unchanged recommendation"}`,
  );
}

const structuredHealthPlanSectionItemSchema = {
  type: "object",
  additionalProperties: false,
  required: ["text", "source_signal_ids"],
  properties: {
    text: { type: "string" },
    source_signal_ids: {
      type: "array",
      minItems: 1,
      items: { type: "string" },
    },
    priority: {
      type: "string",
      enum: ["high", "medium", "low"],
    },
    confidence: {
      type: "string",
      enum: ["high", "medium", "low"],
    },
    timing: {
      type: "string",
      enum: ["today", "this_week", "ongoing"],
    },
    verification_required: {
      type: "boolean",
    },
    completion_signal: {
      type: "string",
    },
    owner_role: {
      type: "string",
      enum: ["assigned_staff", "caregiver", "on_call_coordinator", "care_team"],
    },
    fallback_owner_role: {
      type: "string",
      enum: ["assigned_staff", "caregiver", "on_call_coordinator", "care_team"],
    },
  },
};

const structuredHealthPlanSchema = {
  type: "object",
  additionalProperties: false,
  required: ["summary_text", "summary_signal_ids", "goals", "daily_support", "monitoring", "escalation", "caregiver_guidance"],
  properties: {
    summary_text: { type: "string" },
    summary_signal_ids: {
      type: "array",
      minItems: 1,
      items: { type: "string" },
    },
    goals: {
      type: "array",
      minItems: 1,
      items: structuredHealthPlanSectionItemSchema,
    },
    daily_support: {
      type: "array",
      minItems: 1,
      items: structuredHealthPlanSectionItemSchema,
    },
    monitoring: {
      type: "array",
      minItems: 1,
      items: structuredHealthPlanSectionItemSchema,
    },
    escalation: {
      type: "array",
      minItems: 1,
      items: structuredHealthPlanSectionItemSchema,
    },
    caregiver_guidance: {
      type: "array",
      minItems: 1,
      items: structuredHealthPlanSectionItemSchema,
    },
  },
};

function buildStructuredHealthPlanPartialSchema(sectionKeys) {
  const normalizedKeys = normalizeHealthPlanTargetSections(sectionKeys);
  return {
    type: "object",
    additionalProperties: false,
    required: ["summary_text", "summary_signal_ids", ...normalizedKeys.map((sectionKey) => healthPlanSectionDefinitionByStorageKey[sectionKey].outputKey)],
    properties: {
      summary_text: { type: "string" },
      summary_signal_ids: {
        type: "array",
        minItems: 1,
        items: { type: "string" },
      },
      ...Object.fromEntries(
        normalizedKeys.map((sectionKey) => [
          healthPlanSectionDefinitionByStorageKey[sectionKey].outputKey,
          {
            type: "array",
            minItems: 1,
            items: structuredHealthPlanSectionItemSchema,
          },
        ]),
      ),
    },
  };
}

function normalizeGeneratedHealthPlan(value) {
  const plan = objectValue(value);
  if (!plan) throw httpError(502, "Health plan generation returned an empty response");
  const summaryText = nullIfBlank(plan.summary_text);
  if (!summaryText) throw httpError(502, "Health plan generation returned an invalid summary");
  const sourceSignals = normalizeHealthPlanSourceSignals(plan.source_signals_json);
  const signalTriage = buildHealthPlanSignalTriage(sourceSignals);
  const enrichedSections = enrichHealthPlanSections({
    goals_json: normalizeHealthPlanSectionItems(plan.goals),
    daily_support_json: normalizeHealthPlanSectionItems(plan.daily_support),
    monitoring_json: normalizeHealthPlanSectionItems(plan.monitoring),
    escalation_json: normalizeHealthPlanSectionItems(plan.escalation),
    caregiver_guidance_json: normalizeHealthPlanSectionItems(plan.caregiver_guidance),
  }, { sourceSignals, signalTriage });
  return {
    summary_text: summaryText,
    summary_signal_ids: Array.isArray(plan.summary_signal_ids) ? plan.summary_signal_ids.map((item) => nullIfBlank(item)).filter(Boolean) : [],
    goals_json: enrichedSections.goals_json,
    daily_support_json: enrichedSections.daily_support_json,
    monitoring_json: enrichedSections.monitoring_json,
    escalation_json: enrichedSections.escalation_json,
    caregiver_guidance_json: enrichedSections.caregiver_guidance_json,
  };
}

function healthPlanTextContainsForbiddenMedicalClaims(text) {
  const normalized = String(text || "").toLowerCase();
  return [
    "diagnose",
    "diagnosis",
    "prescribe",
    "prescription",
    "change the medication",
    "stop the medication",
    "increase the dose",
    "decrease the dose",
    "replace the medication",
    "start a new medication",
  ].some((phrase) => normalized.includes(phrase));
}

function validateGeneratedHealthPlan(generatedPlan, sourceSignals, promptInput) {
  const sourceSignalIds = new Set(sourceSignals.map((signal) => signal.id));
  const criticalSignalIds = new Set(Array.isArray(promptInput?.critical_signal_ids) ? promptInput.critical_signal_ids : []);
  const signalTriage = promptInput?.signal_triage || {};
  generatedPlan = repairOperationalMonitoringLanguage(generatedPlan, {
    sourceSignals,
    signalTriage,
    criticalSignalIds: [...criticalSignalIds],
  });
  const escalationGrade = promptInput?.escalation_grade
    || buildHealthPlanEscalationGrade({
      sourceSignals,
      signalTriage,
      criticalSignalIds: [...criticalSignalIds],
    });
  const sections = [
    ["goals", generatedPlan.goals_json],
    ["daily_support", generatedPlan.daily_support_json],
    ["monitoring", generatedPlan.monitoring_json],
    ["escalation", generatedPlan.escalation_json],
    ["caregiver_guidance", generatedPlan.caregiver_guidance_json],
  ];
  const referencedIds = new Set();

  const requireValidSignalRefs = (items, sectionName) => {
    if (!Array.isArray(items) || items.length === 0) throw healthPlanGenerationError(502, `Health plan generation returned an empty ${sectionName} section`);
    for (const item of items) {
      if (healthPlanTextContainsForbiddenMedicalClaims(item?.text)) {
        throw healthPlanGenerationError(502, `Health plan generation returned unsafe medical guidance in ${sectionName}`);
      }
      const refs = Array.isArray(item?.source_signal_ids) ? item.source_signal_ids.filter(Boolean) : [];
      if (!refs.length) throw healthPlanGenerationError(502, `Health plan generation returned a ${sectionName} item without evidence links`);
      for (const ref of refs) {
        if (!sourceSignalIds.has(ref)) throw healthPlanGenerationError(502, `Health plan generation referenced an unknown source signal in ${sectionName}`);
        referencedIds.add(ref);
      }
    }
  };

  if (healthPlanTextContainsForbiddenMedicalClaims(generatedPlan.summary_text)) {
    throw healthPlanGenerationError(502, "Health plan generation returned unsafe medical guidance in the summary");
  }

  if (!Array.isArray(generatedPlan.summary_signal_ids) || generatedPlan.summary_signal_ids.length === 0) {
    throw healthPlanGenerationError(502, "Health plan generation returned a summary without evidence links");
  }
  for (const ref of generatedPlan.summary_signal_ids) {
    if (!sourceSignalIds.has(ref)) throw healthPlanGenerationError(502, "Health plan generation referenced an unknown source signal in the summary");
    referencedIds.add(ref);
  }

  for (const [sectionName, items] of sections) requireValidSignalRefs(items, sectionName);

  const escalationRefs = new Set((generatedPlan.escalation_json || []).flatMap((item) => item?.source_signal_ids || []));
  const monitoringRefs = new Set((generatedPlan.monitoring_json || []).flatMap((item) => item?.source_signal_ids || []));
  const summaryRefs = new Set(Array.isArray(generatedPlan.summary_signal_ids) ? generatedPlan.summary_signal_ids : []);
  const goalsRefs = new Set((generatedPlan.goals_json || []).flatMap((item) => item?.source_signal_ids || []));
  const dailyRefs = new Set((generatedPlan.daily_support_json || []).flatMap((item) => item?.source_signal_ids || []));
  for (const criticalId of criticalSignalIds) {
    if (!referencedIds.has(criticalId)) {
      throw healthPlanGenerationError(502, "Health plan generation did not address a critical client signal");
    }
  }
  if (criticalSignalIds.size && (!escalationRefs.size || !monitoringRefs.size)) {
    throw healthPlanGenerationError(502, "Health plan generation did not include enough monitoring or escalation support for critical signals");
  }

  const actionSignalIds = Array.isArray(signalTriage?.action_signal_ids) ? signalTriage.action_signal_ids.filter((id) => sourceSignalIds.has(id)) : [];
  if (actionSignalIds.length) {
    const actionCovered = actionSignalIds.some((id) => summaryRefs.has(id) || monitoringRefs.has(id) || escalationRefs.has(id));
    if (!actionCovered) {
      throw healthPlanGenerationError(502, "Health plan generation did not ground the summary or response path in the strongest action-driving signals");
    }
  }
  const stabilizingSignalIds = Array.isArray(signalTriage?.stabilizing_signal_ids) ? signalTriage.stabilizing_signal_ids.filter((id) => sourceSignalIds.has(id)) : [];
  if (stabilizingSignalIds.length) {
    const stabilizingCovered = stabilizingSignalIds.some((id) => goalsRefs.has(id) || dailyRefs.has(id));
    if (!stabilizingCovered) {
      throw healthPlanGenerationError(502, "Health plan generation did not preserve any grounded stabilizing routines in goals or daily support");
    }
  }
  const confidenceGuardrails = promptInput?.confidence_guardrails || null;
  const fragileConfidenceSections = Array.isArray(confidenceGuardrails?.section_confidence)
    ? confidenceGuardrails.section_confidence.filter((item) => item?.max_confidence === "low").map((item) => item.section_key)
    : [];
  if (
    fragileConfidenceSections.includes("monitoring_json")
    && !String(generatedPlan.summary_text || "").toLowerCase().includes("verif")
    && !String(generatedPlan.summary_text || "").toLowerCase().includes("confirm")
    && !String(generatedPlan.summary_text || "").toLowerCase().includes("check")
  ) {
    throw healthPlanGenerationError(502, "Health plan generation sounded too certain for a monitoring picture that still needs verification");
  }

  const coverageIssues = findHealthPlanCoverageIssues(generatedPlan, {
    sourceSignals,
    signalTriage,
    criticalSignalIds: [...criticalSignalIds],
  });
  if (coverageIssues.length) {
    throw healthPlanGenerationError(502, coverageIssues[0].message || "Health plan generation missed required support coverage");
  }
  const safetyIssues = findHealthPlanSafetyIssues(generatedPlan, {
    sourceSignals,
    signalTriage,
    criticalSignalIds: [...criticalSignalIds],
  });
  if (safetyIssues.length) {
    throw healthPlanGenerationError(502, safetyIssues[0].message || "Health plan generation returned wording that is not operationally safe enough");
  }
  const escalationGradeIssues = findHealthPlanEscalationGradeIssues(generatedPlan, {
    escalationGrade,
    sourceSignals,
  });
  if (escalationGradeIssues.length) {
    throw healthPlanGenerationError(502, escalationGradeIssues[0].message || "Health plan generation did not respect the required escalation floor");
  }
  const clinicalCautionIssues = findHealthPlanClinicalCautionIssues(generatedPlan, {
    sourceSignals,
    followThrough: promptInput?.existing_plan_feedback || null,
    clinicalCautions: promptInput?.clinical_cautions || null,
  });
  if (clinicalCautionIssues.length) {
    throw healthPlanGenerationError(502, clinicalCautionIssues[0].message || "Health plan generation missed a clinically important caution response");
  }
  const criticalResponseIssues = findHealthPlanCriticalResponseIssues(generatedPlan, promptInput?.critical_response_brief || null);
  if (criticalResponseIssues.length) {
    throw healthPlanGenerationError(502, criticalResponseIssues[0].message || "Health plan generation diluted a critical response contract");
  }
  const responseAdjudicationIssues = findHealthPlanResponseAdjudicationIssues(generatedPlan, promptInput?.response_adjudication_brief || null);
  if (responseAdjudicationIssues.length) {
    throw healthPlanGenerationError(502, responseAdjudicationIssues[0].message || "Health plan generation did not prioritize the right response path first");
  }
  const evidenceCoverageIssues = findHealthPlanEvidenceCoverageIssues(generatedPlan, promptInput?.evidence_pack || null);
  if (evidenceCoverageIssues.length) {
    throw healthPlanGenerationError(502, evidenceCoverageIssues[0].message || "Health plan generation did not cover the ranked evidence pack clearly enough");
  }
  let workingPlan = generatedPlan;
  let recommendationSourceRanking = buildHealthPlanRecommendationSourceRanking({
    plan: workingPlan,
    sourceSignals,
    evidenceHierarchy: promptInput?.evidence_hierarchy || [],
    signalPreferenceWeights: promptInput?.signal_preference_weights || [],
    recommendationEffectiveness: promptInput?.recommendation_effectiveness || null,
    recommendationChallenges: promptInput?.recommendation_challenges || null,
  });
  let recommendationGrounding = buildHealthPlanRecommendationGrounding({
    plan: workingPlan,
    sourceSignals,
    evidencePack: promptInput?.evidence_pack || null,
    reviewPriorities: promptInput?.review_priorities || null,
    confidenceProfile: promptInput?.confidence_guardrails || null,
    recommendationSourceRanking,
  });
  const groundingCalibration = applyHealthPlanRecommendationGroundingCalibration({
    plan: workingPlan,
    grounding: recommendationGrounding,
  });
  if (Array.isArray(groundingCalibration?.adjustments) && groundingCalibration.adjustments.length > 0) {
    workingPlan = groundingCalibration.plan || workingPlan;
    recommendationSourceRanking = buildHealthPlanRecommendationSourceRanking({
      plan: workingPlan,
      sourceSignals,
      evidenceHierarchy: promptInput?.evidence_hierarchy || [],
      signalPreferenceWeights: promptInput?.signal_preference_weights || [],
      recommendationEffectiveness: promptInput?.recommendation_effectiveness || null,
      recommendationChallenges: promptInput?.recommendation_challenges || null,
    });
    recommendationGrounding = buildHealthPlanRecommendationGrounding({
      plan: workingPlan,
      sourceSignals,
      evidencePack: promptInput?.evidence_pack || null,
      reviewPriorities: promptInput?.review_priorities || null,
      confidenceProfile: promptInput?.confidence_guardrails || null,
      recommendationSourceRanking,
    });
  }
  const generationBriefIssues = findHealthPlanGenerationBriefIssues(workingPlan, promptInput?.generation_brief || null);
  if (shouldRejectHealthPlanGenerationBriefIssues(generationBriefIssues)) {
    throw healthPlanGenerationError(
      502,
      generationBriefIssues[0]?.message || "Health plan generation drifted away from the ranked generation brief",
    );
  }
  const recommendationEffectivenessIssues = findHealthPlanRecommendationEffectivenessIssues(workingPlan, promptInput?.recommendation_effectiveness || null);
  if (recommendationEffectivenessIssues.length) {
    throw healthPlanGenerationError(502, recommendationEffectivenessIssues[0].message || "Health plan generation ignored important recommendation-level outcome learning");
  }
  const recommendationSourceRankingIssues = findHealthPlanRecommendationSourceRankingIssues(
    workingPlan,
    recommendationSourceRanking,
  );
  if (recommendationSourceRankingIssues.length) {
    throw healthPlanGenerationError(502, recommendationSourceRankingIssues[0].message || "Health plan generation leaned too heavily on weakly ranked evidence");
  }
  if (shouldRejectHealthPlanRecommendationGrounding(recommendationGrounding)) {
    throw healthPlanGenerationError(
      502,
      recommendationGrounding?.issues?.[0]?.message || "Health plan generation returned a recommendation whose certainty still outruns the evidence",
    );
  }
  const operationalCompleteness = buildHealthPlanOperationalCompleteness({
    plan: workingPlan,
    reviewPriorities: promptInput?.review_priorities || null,
    escalationGrade: promptInput?.escalation_grade || null,
    liveEvidenceSummary: promptInput?.live_evidence_summary || null,
  });
  if (shouldRejectHealthPlanOperationalCompleteness(operationalCompleteness)) {
    throw healthPlanGenerationError(
      502,
      operationalCompleteness?.issues?.[0]?.message || "Health plan generation still left critical execution details too implicit for staff use",
    );
  }
  const benchmarkAssessment = buildHealthPlanBenchmarkAssessment({
    plan: workingPlan,
    sourceSignals,
    evidencePack: promptInput?.evidence_pack || null,
    reviewPriorities: promptInput?.review_priorities || null,
    confidenceProfile: promptInput?.confidence_guardrails || null,
    followThrough: promptInput?.existing_plan_feedback || null,
  });
  if (shouldRejectHealthPlanBenchmarkAssessment(benchmarkAssessment)) {
    const weakestMatch = Array.isArray(benchmarkAssessment?.evaluations)
      ? benchmarkAssessment.evaluations.find((item) => Number(item?.match_score || 0) >= 70 && item?.overall_status === "fragile")
        || benchmarkAssessment.evaluations[0]
      : null;
    throw healthPlanGenerationError(
      502,
      weakestMatch?.top_issue?.message || benchmarkAssessment?.summary || "Health plan generation failed a matched high-risk benchmark archetype",
    );
  }

  return {
    plan: workingPlan,
    recommendation_calibration: buildHealthPlanRecommendationCalibrationSummary({
      adjustments: groundingCalibration?.adjustments || [],
      grounding: recommendationGrounding,
    }),
  };
}

function fallbackPlanText(language, key) {
  const copy = {
    en: {
      summaryLead: "This support plan focuses on safety, steady routines, and early escalation based on the current care profile.",
      goalSafety: "Keep the client safe, reachable, and supported through the next review period.",
      goalRoutine: "Protect medication, check-in, and daily support routines so small issues are caught early.",
      supportDaily: "Keep daily support practical and consistent, starting with the strongest risk signals on file.",
      supportMedication: "Use the saved medication plan and reminder times as the baseline for daily follow-up.",
      monitoringRisk: "Track the signals below every day and note any change from the current baseline.",
      monitoringAlerts: "Review unresolved alerts and any missed service activity on the same day.",
      escalationUrgent: "If safety, adherence, or contact reliability worsens, contact the responsible care lead the same day and document the agreed next action.",
      escalationCircle: "If follow-up becomes harder or the client becomes less reachable, notify the care circle within the current sharing boundary and log who will take the next contact.",
      caregiverShare: "Share short, practical updates with caregivers or staff so everyone is working from the same picture.",
      caregiverAction: "Ask the care circle to reinforce routines, confirm changes, and report concerns promptly.",
    },
    de: {
      summaryLead: "Dieser Unterstützungsplan konzentriert sich auf Sicherheit, verlässliche Routinen und frühe Eskalation auf Basis des aktuellen Pflegeprofils.",
      goalSafety: "Die Person in der nächsten Betreuungsphase sicher, erreichbar und gut unterstützt halten.",
      goalRoutine: "Medikation, Check-ins und tägliche Unterstützung stabil halten, damit kleine Probleme früh erkannt werden.",
      supportDaily: "Die tägliche Unterstützung praktisch und verlässlich gestalten und mit den wichtigsten Risikosignalen beginnen.",
      supportMedication: "Den hinterlegten Medikationsplan und die Erinnerungszeiten als Grundlage für die tägliche Nachverfolgung nutzen.",
      monitoringRisk: "Die unten genannten Signale täglich beobachten und jede Veränderung gegenüber dem aktuellen Ausgangszustand festhalten.",
      monitoringAlerts: "Offene Warnhinweise und verpasste Service-Aktivitäten noch am selben Tag prüfen.",
      escalationUrgent: "Wenn sich Sicherheit, Adhaerenz oder Erreichbarkeit verschlechtern, kontaktieren Sie noch am selben Tag die verantwortliche Pflegeleitung und dokumentieren Sie die vereinbarte naechste Massnahme.",
      escalationCircle: "Wenn die Nachverfolgung schwieriger wird oder die Person schlechter erreichbar ist, informieren Sie den Betreuungskreis innerhalb der aktuellen Freigabegrenzen und protokollieren Sie, wer den naechsten Kontakt uebernimmt.",
      caregiverShare: "Kurze, praktische Updates mit Angehörigen oder Fachkräften teilen, damit alle vom gleichen Bild ausgehen.",
      caregiverAction: "Den Betreuungskreis bitten, Routinen zu stärken, Veränderungen zu bestätigen und Sorgen zeitnah weiterzugeben.",
    },
    es: {
      summaryLead: "Este plan de apoyo se centra en la seguridad, las rutinas estables y la escalada temprana según el perfil actual de cuidado.",
      goalSafety: "Mantener a la persona segura, localizable y acompañada durante el siguiente periodo de seguimiento.",
      goalRoutine: "Proteger las rutinas de medicación, check-ins y apoyo diario para detectar los problemas pequeños a tiempo.",
      supportDaily: "Mantener el apoyo diario práctico y constante, empezando por las señales de riesgo más fuertes registradas.",
      supportMedication: "Usar el plan de medicación guardado y los horarios de recordatorio como base del seguimiento diario.",
      monitoringRisk: "Revisar cada día las señales indicadas abajo y anotar cualquier cambio respecto a la situación actual.",
      monitoringAlerts: "Revisar el mismo día las alertas abiertas y cualquier actividad de servicio perdida.",
      escalationUrgent: "Si empeoran la seguridad, la adherencia o la capacidad de contacto, contacte el mismo dia con el responsable de cuidados y documente la siguiente accion acordada.",
      escalationCircle: "Si el seguimiento se vuelve mas dificil o la persona esta menos localizable, informe al circulo de cuidado dentro del limite de consentimiento actual y registre quien hara el siguiente contacto.",
      caregiverShare: "Compartir actualizaciones breves y prácticas con cuidadores o personal para que todos trabajen con la misma información.",
      caregiverAction: "Pedir al círculo de cuidado que refuerce las rutinas, confirme los cambios y comunique cualquier preocupación a tiempo.",
    },
  };
  return (copy[language] || copy.en)[key] || copy.en[key];
}

function buildFallbackHealthPlan(profile, predictiveContext, sourceSignals, language) {
  const criticalSignalIds = deriveCriticalHealthPlanSignalIds(profile, predictiveContext, sourceSignals);
  const signalTriage = buildHealthPlanSignalTriage(sourceSignals, criticalSignalIds);
  const pickIds = (preferredMatchers, fallbackCount = 2) => {
    const matched = preferredMatchers
      .map((matcher) => sourceSignals.find(matcher)?.id)
      .filter(Boolean);
    if (matched.length) return [...new Set(matched)];
    return sourceSignals.slice(0, fallbackCount).map((signal) => signal.id).filter(Boolean);
  };
  const ensureRefs = (refs) => {
    const picked = [...new Set([...(refs || []), ...criticalSignalIds.slice(0, 1)])].filter(Boolean);
    return picked.length ? picked : sourceSignals.slice(0, 1).map((signal) => signal.id).filter(Boolean);
  };
  const medicationRefs = pickIds([(signal) => /medication/i.test(signal?.label)]);
  const riskRefs = pickIds([(signal) => /predictive risk score/i.test(signal?.label), (signal) => /risk forecast/i.test(signal?.label)]);
  const alertRefs = pickIds([(signal) => /active alert/i.test(signal?.label), (signal) => /sensor/i.test(signal?.label)]);
  const serviceRefs = pickIds([(signal) => /check-ins/i.test(signal?.label), (signal) => /brain coach/i.test(signal?.label)]);
  const consentRefs = pickIds([(signal) => /sharing consent/i.test(signal?.label)]);
  const careCircleRefs = pickIds([(signal) => /care circle context/i.test(signal?.label), (signal) => /profile context/i.test(signal?.label)]);
  const actionRefs = ensureRefs(Array.isArray(signalTriage?.action_signal_ids) ? signalTriage.action_signal_ids : [...riskRefs, ...alertRefs]);
  const verificationRefs = ensureRefs(Array.isArray(signalTriage?.verification_signal_ids) ? signalTriage.verification_signal_ids : [...alertRefs, ...medicationRefs]);
  const stabilizingRefs = ensureRefs(Array.isArray(signalTriage?.stabilizing_signal_ids) ? signalTriage.stabilizing_signal_ids : [...medicationRefs, ...careCircleRefs]);
  const enrichedSections = enrichHealthPlanSections({
    goals_json: [
      { id: "goal-1", text: fallbackPlanText(language, "goalSafety"), source_signal_ids: actionRefs },
      { id: "goal-2", text: fallbackPlanText(language, "goalRoutine"), source_signal_ids: ensureRefs([...stabilizingRefs, ...serviceRefs]) },
    ],
    daily_support_json: [
      { id: "daily-1", text: fallbackPlanText(language, "supportDaily"), source_signal_ids: ensureRefs([...stabilizingRefs, ...serviceRefs]) },
      { id: "daily-2", text: fallbackPlanText(language, "supportMedication"), source_signal_ids: ensureRefs([...medicationRefs, ...stabilizingRefs]) },
    ],
    monitoring_json: [
      { id: "monitor-1", text: `${fallbackPlanText(language, "monitoringRisk")} ${signalTriage?.caution_summary_text || ""}`.trim(), source_signal_ids: ensureRefs([...actionRefs, ...verificationRefs]) },
      { id: "monitor-2", text: fallbackPlanText(language, "monitoringAlerts"), source_signal_ids: ensureRefs([...verificationRefs, ...medicationRefs, ...serviceRefs]) },
    ],
    escalation_json: [
      { id: "escalation-1", text: fallbackPlanText(language, "escalationUrgent"), source_signal_ids: actionRefs },
      { id: "escalation-2", text: fallbackPlanText(language, "escalationCircle"), source_signal_ids: ensureRefs([...careCircleRefs, ...verificationRefs]) },
    ],
    caregiver_guidance_json: [
      { id: "caregiver-1", text: fallbackPlanText(language, "caregiverShare"), source_signal_ids: ensureRefs([...careCircleRefs, ...consentRefs]) },
      { id: "caregiver-2", text: fallbackPlanText(language, "caregiverAction"), source_signal_ids: ensureRefs([...careCircleRefs, ...alertRefs, ...consentRefs]) },
    ],
  }, { sourceSignals, signalTriage });

  return {
    summary_text: `${fallbackPlanText(language, "summaryLead")} ${signalTriage?.focus_summary_text || ""}`.trim(),
    summary_signal_ids: actionRefs,
    goals_json: enrichedSections.goals_json,
    daily_support_json: enrichedSections.daily_support_json,
    monitoring_json: enrichedSections.monitoring_json,
    escalation_json: enrichedSections.escalation_json,
    caregiver_guidance_json: enrichedSections.caregiver_guidance_json,
    generator_provider: "fallback",
    generator_model: "deterministic-template",
    generator_version: `${healthPlanGeneratorVersion}-fallback`,
  };
}

function readResponseOutputText(body) {
  if (typeof body?.output_text === "string" && body.output_text.trim()) return body.output_text;
  const fragments = [];
  for (const item of Array.isArray(body?.output) ? body.output : []) {
    for (const content of Array.isArray(item?.content) ? item.content : []) {
      if (typeof content?.text === "string" && content.text.trim()) fragments.push(content.text);
    }
  }
  return fragments.join("\n").trim() || null;
}

async function requestStructuredOpenAiJson({
  systemPrompt,
  userPrompt,
  schemaName,
  schema,
  errorLabel,
} = {}) {
  const response = await fetch(`${openAiBaseUrl}/responses`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openAiApiKey}`,
    },
    body: JSON.stringify({
      model: healthPlanOpenAiModel,
      input: [
        { role: "system", content: [{ type: "input_text", text: systemPrompt }] },
        { role: "user", content: [{ type: "input_text", text: userPrompt }] },
      ],
      text: {
        format: {
          type: "json_schema",
          name: schemaName,
          strict: true,
          schema,
        },
      },
    }),
  });

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw httpError(502, `${errorLabel} failed: ${message || response.statusText}`);
  }

  const body = await response.json();
  const outputText = readResponseOutputText(body);
  if (!outputText) throw httpError(502, `${errorLabel} returned no structured output`);

  try {
    return JSON.parse(outputText);
  } catch {
    throw httpError(502, `${errorLabel} returned malformed JSON`);
  }
}

function shouldAttemptHealthPlanRepair(error, failurePrefix) {
  if (!error) return false;
  const statusCode = Number(error?.statusCode || error?.status || 0);
  if (statusCode !== 502) return false;
  const message = String(error?.message || "");
  return !message.startsWith(`${failurePrefix} failed:`);
}

function buildHealthPlanRepairPrompt({
  promptInput,
  previousDraft,
  defectMessage,
  instruction,
  calibrationBrief = null,
} = {}) {
  return [
    instruction || "Your previous draft did not pass the server review. Repair it and return a corrected JSON response.",
    "Fix every issue listed below while staying grounded in the provided source signals.",
    JSON.stringify({
      validation_error: defectMessage,
      calibration_brief: calibrationBrief,
      previous_draft: previousDraft,
      prompt_input: promptInput,
    }, null, 2),
  ].join("\n\n");
}

function evaluateAcceptedHealthPlanDraft({
  plan,
  sourceSignals,
  promptInput,
  recommendationCalibration = null,
  label = "Health plan generation",
} = {}) {
  const acceptance = buildHealthPlanDraftAcceptance({
    plan,
    sourceSignals,
    promptInput,
    recommendationCalibration,
  });
  if (acceptance?.can_accept_for_generation) return acceptance;
  const blocker = Array.isArray(acceptance?.blocking_items) ? acceptance.blocking_items[0] || null : null;
  throw healthPlanGenerationError(
    502,
    blocker?.message || acceptance?.summary || `${label} did not pass the final usefulness and trust acceptance checks`,
    {
      code: "health_plan_draft_rejected",
      acceptance,
    },
  );
}

function resolveHealthPlanCandidateCount(promptInput, options = {}) {
  const explicitCount = Number.isFinite(Number(options?.candidateCount))
    ? Number(options.candidateCount)
    : Number.isFinite(healthPlanDirectCandidateCountOverride)
      ? healthPlanDirectCandidateCountOverride
      : null;
  if (explicitCount !== null) {
    return Math.max(1, Math.min(3, Math.round(explicitCount)));
  }

  const reviewWindow = String(promptInput?.review_governance?.review_window || "").trim().toLowerCase();
  const escalationGrade = String(promptInput?.escalation_grade?.grade || "").trim().toLowerCase();
  const liveStatus = String(promptInput?.live_evidence_summary?.status || "").trim().toLowerCase();
  const readinessStatus = String(promptInput?.readiness?.overall_status || "").trim().toLowerCase();
  const hasHighSeverityGap = Array.isArray(promptInput?.data_quality_gaps)
    && promptInput.data_quality_gaps.some((gap) => String(gap?.severity || "").trim().toLowerCase() === "high");

  if (reviewWindow === "today" || escalationGrade === "urgent" || liveStatus === "pressure") return 3;
  if (escalationGrade === "heightened" || readinessStatus === "guarded" || hasHighSeverityGap) return 2;
  return 1;
}

function assertAcceptedHealthPlanDraft({
  plan,
  sourceSignals,
  promptInput,
  recommendationCalibration = null,
  label = "Health plan generation",
} = {}) {
  return evaluateAcceptedHealthPlanDraft({
    plan,
    sourceSignals,
    promptInput,
    recommendationCalibration,
    label,
  });
}

function finalizeGeneratedHealthPlanDraft({
  parsed,
  sourceSignals,
  promptInput,
  existingPlan = null,
  label = "Health plan generation",
  generationPath = "direct",
} = {}) {
  const normalizedPlan = normalizeGeneratedHealthPlan(parsed);
  const enrichedSections = enrichHealthPlanSections({
    goals_json: normalizedPlan.goals_json,
    daily_support_json: normalizedPlan.daily_support_json,
    monitoring_json: normalizedPlan.monitoring_json,
    escalation_json: normalizedPlan.escalation_json,
    caregiver_guidance_json: normalizedPlan.caregiver_guidance_json,
  }, { sourceSignals, signalTriage: promptInput?.signal_triage || {} });
  const calibrated = applyHealthPlanConfidenceCalibration({
    ...normalizedPlan,
    ...enrichedSections,
  }, {
    sourceSignals,
    dataQualityGaps: promptInput?.data_quality_gaps || [],
    evidenceConflicts: promptInput?.evidence_conflicts || [],
    followThrough: promptInput?.existing_plan_feedback || null,
    sectionDrift: promptInput?.existing_plan_section_drift || [],
  });

  const repairedPlan = repairOperationalMonitoringLanguage(
    calibrated.plan || { ...normalizedPlan, ...enrichedSections },
    {
      sourceSignals,
      signalTriage: promptInput?.signal_triage || {},
      criticalSignalIds: promptInput?.critical_signal_ids || [],
    },
  );
  const validated = validateGeneratedHealthPlan({
    ...repairedPlan,
    generator_provider: "openai",
    generator_model: healthPlanOpenAiModel,
    generator_version: generationPath === "repair" ? `${healthPlanGeneratorVersion}-repair` : healthPlanGeneratorVersion,
  }, sourceSignals, promptInput);
  assertNoRecommendationCarryForward({
    existingPlan,
    nextPlan: validated.plan,
    promptInput,
    label,
  });
  const draftAcceptance = assertAcceptedHealthPlanDraft({
    plan: validated.plan,
    sourceSignals,
    promptInput,
    recommendationCalibration: validated.recommendation_calibration || null,
    label,
  });
  return {
    ...validated,
    draft_acceptance: draftAcceptance,
  };
}

function finalizeGeneratedHealthPlanSectionRefresh({
  parsed,
  sourceSignals,
  promptInput,
  existingPlan,
  normalizedSections,
  label = "Health plan section refresh",
  generationPath = "direct",
} = {}) {
  const refreshedSections = {};
  for (const sectionKey of normalizedSections) {
    const definition = healthPlanSectionDefinitionByStorageKey[sectionKey];
    refreshedSections[sectionKey] = normalizeHealthPlanSectionItems(parsed?.[definition.outputKey]);
  }
  const calibrated = applyHealthPlanConfidenceCalibration({
    summary_text: nullIfBlank(parsed?.summary_text) || existingPlan?.summary_text || null,
    summary_signal_ids: normalizeHealthPlanSignalIds(parsed?.summary_signal_ids),
    ...enrichHealthPlanSections(refreshedSections, { sourceSignals, signalTriage: promptInput?.signal_triage || {} }),
  }, {
    sourceSignals,
    dataQualityGaps: promptInput?.data_quality_gaps || [],
    evidenceConflicts: promptInput?.evidence_conflicts || [],
    followThrough: promptInput?.existing_plan_feedback || null,
    sectionDrift: promptInput?.existing_plan_section_drift || [],
  });

  const refreshedPlan = repairOperationalMonitoringLanguage({
    ...calibrated.plan,
    generator_provider: "openai",
    generator_model: healthPlanOpenAiModel,
    generator_version: generationPath === "repair" ? `${healthPlanGeneratorVersion}-repair` : healthPlanGeneratorVersion,
  }, {
    sourceSignals,
    signalTriage: promptInput?.signal_triage || {},
    criticalSignalIds: promptInput?.critical_signal_ids || [],
  });
  assertNoRecommendationCarryForward({
    existingPlan,
    nextPlan: refreshedPlan,
    promptInput,
    targetSections: normalizedSections,
    label,
  });
  const mergedPlan = {
    summary_text: refreshedPlan.summary_text || existingPlan.summary_text,
    summary_signal_ids: refreshedPlan.summary_signal_ids?.length ? refreshedPlan.summary_signal_ids : existingPlan.summary_signal_ids,
    goals_json: normalizedSections.includes("goals_json") ? refreshedPlan.goals_json : existingPlan.goals_json,
    daily_support_json: normalizedSections.includes("daily_support_json") ? refreshedPlan.daily_support_json : existingPlan.daily_support_json,
    monitoring_json: normalizedSections.includes("monitoring_json") ? refreshedPlan.monitoring_json : existingPlan.monitoring_json,
    escalation_json: normalizedSections.includes("escalation_json") ? refreshedPlan.escalation_json : existingPlan.escalation_json,
    caregiver_guidance_json: normalizedSections.includes("caregiver_guidance_json") ? refreshedPlan.caregiver_guidance_json : existingPlan.caregiver_guidance_json,
    generator_provider: refreshedPlan.generator_provider,
    generator_model: refreshedPlan.generator_model,
    generator_version: refreshedPlan.generator_version,
  };
  const validated = validateGeneratedHealthPlan(mergedPlan, sourceSignals, promptInput);
  const draftAcceptance = assertAcceptedHealthPlanDraft({
    plan: validated.plan,
    sourceSignals,
    promptInput,
    recommendationCalibration: validated.recommendation_calibration || null,
    label,
  });
  return {
    ...validated,
    draft_acceptance: draftAcceptance,
  };
}

async function generateHealthPlanWithOpenAI(
  profile,
  predictiveContext,
  sourceSignals,
  language,
  existingPlan = null,
  existingPlanFeedback = null,
  existingPlanHistory = [],
  options = {},
) {
  if (!openAiApiKey) throw httpError(503, "OPENAI_API_KEY is required before health plans can be generated");

  const promptInput = options?.promptInput || assembleHealthPlanPromptInput(
    profile,
    predictiveContext,
    sourceSignals,
    language,
    existingPlan,
    existingPlanFeedback,
    existingPlanHistory,
    options,
  );
  const systemPrompt = [
    "You create personalized client support plans for a Red Cross operations console.",
    "Produce care coordination guidance only. Do not diagnose, prescribe, or change treatment.",
    `Write all user-facing text in ${languageName(language)}.`,
    "Use plain, practical, reassuring language that can be shared with the client or caregiver.",
    "Be specific to the provided profile, but avoid inventing facts.",
    "Keep each list item concise and actionable.",
    "Every summary and recommendation must cite one or more source signal ids from the provided source_signals array.",
    "If a recommendation is marked high priority, today, or high confidence, ground it in strong live evidence rather than broad profile context alone.",
    "When more than one relevant live signal is available, use multiple corroborating source_signal_ids for urgent guidance instead of leaning on a single weak cue.",
    "If only weak or background context is available, soften the recommendation into verification, re-checking, or cautious follow-up language.",
    "When the evidence is clear enough, include priority, confidence, and timing on each recommendation item using only the allowed enum values.",
    "For same-day or high-priority recommendations, set verification_required to true unless the recommendation is purely stabilizing routine guidance with no live uncertainty.",
    "For same-day or high-priority monitoring, escalation, or caregiver guidance recommendations, include owner_role so staff can see who owns the next step without inference. Use only one of: assigned_staff, caregiver, on_call_coordinator, care_team.",
    "For same-day or high-priority recommendations, include completion_signal so staff know what outcome, confirmation, or documented handoff closes the loop.",
    "For escalation or urgent follow-up recommendations, include fallback_owner_role when another person or team should take over if the first outreach path fails. Use only one of: assigned_staff, caregiver, on_call_coordinator, care_team.",
    "Critical signal ids must be addressed clearly in monitoring or escalation guidance.",
    "Treat signal_triage as the decision brief for this case: action_signal_ids should drive the summary and same-day response, verification_signal_ids should justify confirm or re-check language, stabilizing_signal_ids should preserve routines that are still helping, and background_signal_ids should stay secondary.",
    "Treat generation_brief as the first-pass writing map. Start from its priority_signals and section_briefs before scanning the wider context. If lower-rank background context conflicts with this brief, keep the brief's act-now and verify priorities unless fresher explicit human judgment clearly overturns them.",
    "Use evidence_pack as the ranked pre-write brief. Cover must_address_facts directly in the summary, monitoring, or escalation sections. Turn verification_needs into explicit confirm, re-check, or do-not-assume language. Preserve stabilizing_facts when they still fit the live picture. Resolve contradictions openly instead of smoothing them over. When a contradiction includes preferred_signal_ids, let those signals lead the wording. When it includes preserve_signal_ids, keep them only as conditional supporting context. If requires_verification is true, make the recommendation explicitly verification-led and respect contradiction.response_window timing. Do not let fragile_pattern_warnings slip back in without a fresh evidence-backed reason.",
    "Treat escalation_grade as the minimum urgency floor for this case. If the grade is urgent, the summary, monitoring, and escalation sections should all read as same-day coordination guidance. If the grade is heightened, do not flatten it into routine wording.",
    "When existing_plan.review_note is present, treat it as the latest explicit human review judgment about what was confirmed, what still needs watching, or why the plan was accepted.",
    "When existing_plan.recommendation_review_decisions is present, treat it as the most specific human judgment on exact recommendations. Preserve approved recommendations when the live evidence still supports them, keep watch recommendations cautious and verification-led, and rewrite needs_edit recommendations substantively instead of lightly polishing them.",
    "When existing_plan_calibration is present, treat it as the memory of where earlier AI drafts overstated certainty. Do not repeat those overconfident patterns. If a prior recommendation needed softer confidence or explicit verification wording, bake that caution directly into this draft instead of waiting for validator correction.",
    "Use data_quality_gaps to narrow or soften claims when the underlying inputs are incomplete. When a high-severity gap exists, prefer verification language and conservative support guidance over assumptions.",
    "Use improvement_actions as the ranked list of unresolved plan weaknesses. If an action is high priority, address it directly instead of repeating generic guidance.",
    "Use completed_improvement_actions as proof of what staff already fixed or confirmed. Do not keep talking as if those exact issues are still unresolved unless the live signals clearly show they remain open.",
    "Use explicit_staff_feedback and section_outcomes as the strongest evidence of what held up in practice. Preserve sections that staff marked helped unless stronger new evidence contradicts them. Rework sections marked did_not_help or needs_follow_up before repeating their old guidance.",
    "When section_outcomes shows a strengthening trend or supportive evidence_balance, preserve that section's core routine unless stronger live evidence now contradicts it. When section_outcomes shows a weakening trend or caution evidence_balance, rewrite that section substantively instead of lightly polishing it. Use operational_learning_summary as the short explanation of what real follow-through has been teaching us.",
    "Use client_response_memory to adapt the plan to how this specific client actually responds. Lean more on strongest_anchors when they still fit the live picture. Treat fragile_anchors as categories that need caution, tighter verification, or a different approach. Use response_by_source and category_patterns to understand whether outreach, check-ins, medication structure, or caregiver reinforcement is currently landing or breaking down.",
    "Use cohort_guidance only as cautious same-organization fallback learning when this client's own history is thin or mixed. Never let cohort patterns override fresher client_response_memory, explicit_staff_feedback, live alerts, direct follow-through, or recommendation_effectiveness.",
    "Use inferred_operational_feedback as observed evidence from real activity after the last plan, including check-in outcomes, Brain Coach outcomes, medication logs, alerts, and risk movement. Treat it as weaker than explicit human judgment but stronger than generic background context.",
    "Use recent_operational_events as the freshest contact record across scheduled services, medication logs, and outreach activity. If these events show repeated misses or failed outreach, tighten monitoring and escalation wording.",
    "Use live_evidence_summary as the pattern-level read of the current situation. Repeated missed touchpoints, unstable medication adherence, alert-heavy sensor pressure, or weak reachability should change the plan more than any single isolated event.",
    "Use longitudinal_memory as the longer-pattern check. If a pressure area keeps resurfacing across recent plan cycles, treat it as persistent instability rather than short-lived noise, and avoid overly optimistic wording just because one recent signal looks calmer.",
    "Use readiness as the evidence-sufficiency brief. If readiness is guarded, keep the wording modest and explicit about what still needs confirmation. Do not write as if blocked evidence gaps are already resolved.",
    "Before finalizing each recommendation, challenge it: ask whether the evidence is strong enough, whether the wording sounds too optimistic for the live pressure, and what fallback applies if the first step fails.",
    "Use existing_plan_freshness as the trust meter for the prior plan. If it is stale or critical, do not lightly recycle old guidance: refresh the affected sections decisively and treat post-checkpoint caution events as stronger than older reassuring signals.",
    "Use existing_plan_refresh_strategy to see which sections deserve refresh first and which sections look stable enough to preserve. When it says full_regeneration_preferred, rebuild the plan decisively instead of making cosmetic edits.",
    "Use recommendation_learning and signal_preference_weights to learn at the recommendation level, not just the section level. Prefer wording and routines tied to preserve signals, reuse_priority preserve recommendations, strengthening trajectories, and operational_pattern reinforcing. Be skeptical of recommendations tied to recheck signals, reuse_priority replace recommendations, weakening trajectories, or operational_pattern conflicting.",
    "Use recommendation_effectiveness as the actionable keep-or-change brief. Protect preserve_now routines unless stronger live evidence now contradicts them. Rework rework_now routines instead of copying them forward unchanged. Do not let retire_now language come back unchanged unless fresh evidence now clearly reverses the old outcome.",
    "Use recommendation_repair_brief as the per-recommendation edit map. Preserve items marked preserve unless fresher live evidence clearly overturns them. Rewrite items marked rework with clearer evidence, fallback, or verification wording. Replace items marked retire instead of bringing them back unchanged. Treat verify items as needing explicit confirm or re-check language.",
    "Use recommendation_challenges as the skepticism map from the previous plan. If a recommendation was challenged for weak evidence, optimistic tone, or a missing fallback, fix that weakness directly instead of carrying the old pattern forward.",
    "Use recommendation_survivorship as the cross-version memory of what keeps surviving for this client. Protect durable patterns unless fresher evidence clearly beats them, treat emerging patterns as promising but not proven, and do not resurrect retired patterns without a new reason.",
    "Use recommendation_revision_memory as the rewrite-outcome memory across versions. Preserve recommendations that genuinely improved, keep steady preserved recommendations aligned with the current signals, fix unresolved rewrites directly instead of lightly polishing them, and do not resurrect regressed wording without fresh evidence.",
    "Use quality_memory as the saved audit memory of where earlier plans stayed trustworthy or kept breaking down. Preserve durable_patterns unless fresher evidence clearly overturns them. If recurring_quality_risks or repeated_refresh_sections keep pointing at the same weakness, fix that weakness directly instead of lightly rephrasing it. Treat current_guardrails as live ceilings on certainty and keep fragile_patterns from slipping back in without a new evidence-backed reason.",
    "Use quality_memory.candidate_selection_memory as the record of which recent drafts actually won and held up. Prefer the traits that recur in winning_strengths, and avoid the weak patterns called out in recurring_fragilities or guardrails when you have two plausible ways to phrase the plan.",
    "Use outcome_pattern_memory as the cross-version record of what actually held up after follow-through. Prefer preserve_patterns, stable_response_anchors, and stable_domains when the same live evidence still exists. Keep watch_patterns and unstable_sections verification-led. Do not bring replace_patterns back unchanged unless fresh evidence clearly overturns the older outcome.",
    "Use execution_brief as the operational handoff pattern from the prior plan. If it highlighted same-day actions, verification gaps, fallback gaps, or weak close-the-loop wording, fix those exact execution weaknesses directly in the new draft.",
    "Use review_remediation as the concrete fix list from the previous quality review. If it called for section refreshes or a full rebuild, repair those weaknesses explicitly instead of lightly polishing around them.",
    "Use operational_completeness as the execution-quality check. High-pressure sections should name who acts next, when they act, what trigger changes the response, and what the fallback route is if the first step fails. Caregiver guidance should say how to report back.",
    "Use action_impact as the closed-loop outcome check on the prior plan. Preserve sections marked reinforced unless fresher live evidence now overturns them. Rewrite sections marked contradicted decisively instead of lightly polishing them. Treat mixed sections as needing tighter verification, fallback, or ownership wording before trusting them heavily.",
    "Use recommendation_impact as the exact recommendation-level outcome check on the prior plan. Protect recommendations marked preserve or reinforced. Rewrite recommendations marked mixed with clearer verification or fallback wording. Replace recommendations marked contradicted or retire when fresher real-world evidence is already proving they are the wrong routine for this client.",
    "Use recommendation_history as the cross-version outcome memory for exact recommendations. Protect stable or improving recommendations when they still fit the live picture, but replace deteriorating recommendations and tighten volatile ones instead of treating them as settled.",
    "Use recommendation_evidence_diversity as the corroboration check for each recommendation. Be skeptical of recommendations marked fragile because they lean on one narrow or indirect source. When diversity is guarded, soften certainty or add explicit verification wording before staff act on it.",
    "Use recommendation_review as the explicit human override lane for flagged recommendations. If staff marked a recommendation approved, preserve its core meaning unless fresher evidence clearly overturns it. If staff marked watch, keep it but make the wording explicitly monitored or verification-led. If staff marked needs_edit, rewrite it substantively and do not carry the old wording forward unchanged.",
    "Use benchmark_guidance as the archetype backstop for this case. When a matched benchmark archetype is present, satisfy its required sections, timing pressure, verification language, and stabilizing anchors unless fresher client-specific evidence clearly makes that archetype irrelevant.",
    "Use review_priorities as the human-review map. If a section is marked high priority or response_window today, make the wording concrete, explicitly verified, and operationally owned rather than generic. Treat why_now as the reason staff would pause on that section first.",
    "Recent feedback should outweigh stale feedback. When older positive feedback now conflicts with live alerts, worsening risk, or drifted sections, prefer the live evidence and conservative verification language.",
    "Use evidence_hierarchy to decide what should win when sources disagree: fresh staff feedback first, then live alerts and blocking operational signals, then live service or medication state, then predictive signals, and finally broader context.",
    "Use evidence_conflicts to name where the record is disagreeing with itself. Resolve those conflicts explicitly instead of smoothing them over with generic wording.",
    "Use intervention_memory as the client-specific learning loop. Preserve routines marked helping unless stronger new evidence contradicts them. Tighten, replace, or explicitly re-check routines marked fragile. Keep routines marked unproven conservative until fresh evidence supports them.",
    "Use clinical_cautions as non-negotiable safety pressure. If a caution is present, the plan must include the named response path in the required sections instead of staying generic.",
    "Use critical_response_brief as the life-safety action contract. For each active contract, carry its trigger signal ids into the named sections, keep the response window explicit, and do not omit owner, fallback, verification, or close-the-loop outcome.",
    "Do not merge multiple same-day response contracts into one vague sentence. If two different high-risk contracts are active, keep both operationally visible in the relevant sections.",
    "Use response_adjudication_brief as the ranking check for what should come first. Lead the summary, monitoring, and escalation sections with the top-ranked same-day contract before secondary risks. Keep the second-ranked same-day contract visible near the top instead of burying it later in the section.",
    "When existing_plan_feedback is present, treat it as the reality check on the last plan. If it shows unresolved alerts, worsening risk, or no fresh follow-through, update the plan decisively rather than lightly rephrasing the prior version.",
    "When existing_plan_section_drift is present, refresh the sections marked needs_refresh first. Preserve sections marked fresh unless the new evidence clearly contradicts them.",
    "Use confidence_guardrails as a ceiling, not decoration. If a section is capped at medium or low confidence, write it with explicit verification language and avoid overstating certainty.",
    "Do not let calmer background context outweigh the action or verification signals when they conflict.",
    "Return only valid JSON that matches the provided schema.",
  ].join(" ");
  const userPrompt = [
    "Generate a structured personalized health plan from this profile context.",
    "If predictive data is missing, rely on the live care profile, services, medication, sensors, and alerts.",
    JSON.stringify(promptInput, null, 2),
  ].join("\n\n");
  const candidateCount = resolveHealthPlanCandidateCount(promptInput, options);
  const directCandidates = [];
  let repairSeedDraft = null;
  let repairSeedError = null;

  for (let attempt = 0; attempt < candidateCount; attempt += 1) {
    const candidateLabel = candidateCount > 1
      ? `Health plan generation candidate ${attempt + 1}/${candidateCount}`
      : "Health plan generation";
    let parsed = null;
    try {
      parsed = await requestStructuredOpenAiJson({
        systemPrompt,
        userPrompt,
        schemaName: "personalized_health_plan",
        schema: structuredHealthPlanSchema,
        errorLabel: candidateLabel,
      });
      repairSeedDraft = parsed;
      const finalized = finalizeGeneratedHealthPlanDraft({
        parsed,
        sourceSignals,
        promptInput,
        existingPlan,
        label: candidateLabel,
      });
      directCandidates.push({
        ...finalized,
        candidate_id: `candidate-${attempt + 1}`,
      });
    } catch (error) {
      if (!repairSeedError && shouldAttemptHealthPlanRepair(error, candidateLabel)) {
        repairSeedError = error;
      }
      if (candidateCount === 1) {
        repairSeedDraft = parsed || repairSeedDraft;
      }
    }
  }

  if (directCandidates.length > 0) {
    const selection = selectBestHealthPlanCandidate(directCandidates);
    const finalized = selection?.winner || directCandidates[0];
    if (candidateCount > 1 && selection?.winner?.candidate_id) {
      console.info(`Health plan generation selected ${selection.winner.candidate_id} from ${directCandidates.length} accepted candidate(s).`);
    }
    if (!shouldAttemptHealthPlanCalibrationRepair(finalized?.recommendation_calibration)) {
      return {
        ...finalized,
        candidate_selection: buildHealthPlanCandidateSelectionSnapshot(selection),
        cohort_guidance: promptInput?.cohort_guidance || null,
      };
    }
    try {
      const repaired = await requestStructuredOpenAiJson({
        systemPrompt,
        userPrompt: buildHealthPlanRepairPrompt({
          promptInput,
          previousDraft: finalized.plan,
          defectMessage: buildHealthPlanCalibrationRepairMessage(finalized.recommendation_calibration),
          calibrationBrief: buildHealthPlanCalibrationRepairBrief(finalized.recommendation_calibration),
          instruction: "Your previous personalized health plan draft only became acceptable after the server softened its confidence or added verification language. Rewrite it so those corrections are naturally present in the draft while staying client-specific and operationally useful.",
        }),
        schemaName: "personalized_health_plan_calibration_repair",
        schema: structuredHealthPlanSchema,
        errorLabel: "Health plan generation calibration repair",
      });
      return {
        ...finalizeGeneratedHealthPlanDraft({
          parsed: repaired,
          sourceSignals,
          promptInput,
          existingPlan,
          label: "Health plan generation calibration repair",
          generationPath: "repair",
        }),
        candidate_selection: buildHealthPlanCandidateSelectionSnapshot(selection),
        cohort_guidance: promptInput?.cohort_guidance || null,
      };
    } catch (repairError) {
      console.warn("Health plan calibration-aware repair failed, keeping validated draft:", repairError?.message || repairError);
      return {
        ...finalized,
        candidate_selection: buildHealthPlanCandidateSelectionSnapshot(selection),
        cohort_guidance: promptInput?.cohort_guidance || null,
      };
    }
  }

  if (!repairSeedError || !repairSeedDraft) {
    throw repairSeedError || httpError(502, "Health plan generation did not produce an accepted draft");
  }

  const repaired = await requestStructuredOpenAiJson({
    systemPrompt,
    userPrompt: buildHealthPlanRepairPrompt({
      promptInput,
      previousDraft: repairSeedDraft,
      defectMessage: repairSeedError?.message || "The draft did not pass validation.",
      calibrationBrief: existingPlan?.quality_snapshot_json?.recommendation_calibration || null,
      instruction: "Your previous personalized health plan draft failed the server safety and evidence review. Repair it without weakening the client-specific guidance.",
    }),
    schemaName: "personalized_health_plan_repair",
    schema: structuredHealthPlanSchema,
    errorLabel: "Health plan generation repair",
  });
  return {
    ...finalizeGeneratedHealthPlanDraft({
      parsed: repaired,
      sourceSignals,
      promptInput,
      existingPlan,
      label: "Health plan generation repair",
      generationPath: "repair",
    }),
    candidate_selection: buildHealthPlanCandidateSelectionSnapshot({
      attempted_count: candidateCount,
      accepted_count: 0,
      rejected_count: candidateCount,
      selection_summary: "No direct draft cleared acceptance, so a repair pass was used.",
      winner: null,
      ranked_candidates: [],
    }),
    cohort_guidance: promptInput?.cohort_guidance || null,
  };
}

async function generateHealthPlan(
  profile,
  predictiveContext,
  sourceSignals,
  language,
  existingPlan = null,
  existingPlanFeedback = null,
  existingPlanHistory = [],
  options = {},
) {
  const promptInput = assembleHealthPlanPromptInput(
    profile,
    predictiveContext,
    sourceSignals,
    language,
    existingPlan,
    existingPlanFeedback,
    existingPlanHistory,
    options,
  );
  assertHealthPlanReadinessForGeneration(promptInput, "Health plan generation");
  if (healthPlanAiProvider === "openai" && openAiApiKey) {
    try {
      return await generateHealthPlanWithOpenAI(
        profile,
        predictiveContext,
        sourceSignals,
        language,
        existingPlan,
        existingPlanFeedback,
        existingPlanHistory,
        { ...options, promptInput },
      );
    } catch (error) {
      if (Number(error?.statusCode || error?.status || 0) === 409) throw error;
      console.warn("Health plan LLM generation failed, using deterministic fallback:", error?.message || error);
      const fallbackPlan = buildFallbackHealthPlan(profile, predictiveContext, sourceSignals, language);
      return {
        plan: applyHealthPlanConfidenceCalibration(fallbackPlan, {
          sourceSignals,
          dataQualityGaps: promptInput?.data_quality_gaps || [],
          evidenceConflicts: promptInput?.evidence_conflicts || [],
          followThrough: promptInput?.existing_plan_feedback || null,
          sectionDrift: promptInput?.existing_plan_section_drift || [],
        }).plan,
        recommendation_calibration: null,
        candidate_selection: null,
        cohort_guidance: promptInput?.cohort_guidance || null,
      };
    }
  }
  const fallbackPlan = buildFallbackHealthPlan(profile, predictiveContext, sourceSignals, language);
  return {
    plan: applyHealthPlanConfidenceCalibration(fallbackPlan, {
      sourceSignals,
      dataQualityGaps: promptInput?.data_quality_gaps || [],
      evidenceConflicts: promptInput?.evidence_conflicts || [],
      followThrough: promptInput?.existing_plan_feedback || null,
      sectionDrift: promptInput?.existing_plan_section_drift || [],
    }).plan,
    recommendation_calibration: null,
    candidate_selection: null,
    cohort_guidance: promptInput?.cohort_guidance || null,
  };
}

async function generateHealthPlanSectionsWithOpenAI(
  profile,
  predictiveContext,
  sourceSignals,
  language,
  existingPlan,
  existingPlanFeedback,
  existingPlanHistory,
  targetSections,
  options = {},
) {
  if (!openAiApiKey) throw httpError(503, "OPENAI_API_KEY is required before health plans can be generated");
  const normalizedSections = normalizeHealthPlanTargetSections(targetSections);
  if (!normalizedSections.length) throw httpError(400, "At least one health plan section is required");

  const promptInput = options?.promptInput || assembleHealthPlanPromptInput(
    profile,
    predictiveContext,
    sourceSignals,
    language,
    existingPlan,
    existingPlanFeedback,
    existingPlanHistory,
    { ...options, targetSections: normalizedSections },
  );
  const sectionLabels = normalizedSections
    .map((sectionKey) => healthPlanSectionDefinitionByStorageKey[sectionKey]?.promptLabel || sectionKey)
    .join(", ");
  const partialSchema = buildStructuredHealthPlanPartialSchema(normalizedSections);
  const systemPrompt = [
    "You refresh targeted sections inside an existing personalized client support plan for a Red Cross operations console.",
    "Produce care coordination guidance only. Do not diagnose, prescribe, or change treatment.",
    `Write all user-facing text in ${languageName(language)}.`,
    "Use plain, practical, reassuring language that can be shared with the client or caregiver.",
    "Be specific to the provided profile, but avoid inventing facts.",
    "Keep each list item concise and actionable.",
    "Every recommendation must cite one or more source signal ids from the provided source_signals array.",
    "When the evidence is clear enough, include priority, confidence, and timing on each recommendation item using only the allowed enum values.",
    "For same-day or high-priority recommendations, set verification_required to true unless the recommendation is purely stabilizing routine guidance with no live uncertainty.",
    "For same-day or high-priority monitoring, escalation, or caregiver guidance recommendations, include owner_role so staff can see who owns the next step without inference. Use only one of: assigned_staff, caregiver, on_call_coordinator, care_team.",
    "For same-day or high-priority recommendations, include completion_signal so staff know what outcome, confirmation, or documented handoff closes the loop.",
    "For escalation or urgent follow-up recommendations, include fallback_owner_role when another person or team should take over if the first outreach path fails. Use only one of: assigned_staff, caregiver, on_call_coordinator, care_team.",
    "Return an updated summary_text plus only the requested sections. Do not return any unrequested sections.",
    "Treat signal_triage as the decision brief for this case: action_signal_ids should drive same-day response, verification_signal_ids should justify confirm or re-check language, stabilizing_signal_ids should preserve routines that are still helping, and background_signal_ids should stay secondary.",
    "Treat generation_brief as the first-pass writing map for the requested sections. Start from its priority_signals and section_briefs before scanning the wider context. If lower-rank background context conflicts with this brief, keep the brief's act-now and verify priorities unless fresher explicit human judgment clearly overturns them.",
    "Use evidence_pack as the ranked pre-write brief for the requested sections. Carry must_address_facts into the refreshed wording, turn verification_needs into explicit re-check language where needed, preserve stabilizing_facts when they still fit, and resolve contradictions directly instead of writing around them. When a contradiction includes preferred_signal_ids, let those signals lead the refreshed wording. When it includes preserve_signal_ids, keep them only as conditional support. If requires_verification is true, make the refreshed recommendation explicitly verification-led and respect contradiction.response_window timing. Do not let fragile_pattern_warnings return without a fresh evidence-backed reason.",
    "Treat escalation_grade as the minimum urgency floor for this case. If the grade is urgent, the refreshed sections should stay same-day and explicit. If the grade is heightened, keep stronger monitoring or escalation language in place.",
    "When existing_plan.review_note is present, treat it as the latest explicit human review judgment about what was confirmed, what still needs watching, or why the plan was accepted.",
    "When existing_plan.recommendation_review_decisions is present, treat it as the specific human judgment on exact recommendations. Preserve approved recommendations when the live evidence still supports them, keep watch recommendations cautious and verification-led, and rewrite needs_edit recommendations substantively instead of lightly polishing them.",
    "When existing_plan_calibration is present, treat it as the memory of where earlier AI drafts overstated certainty. Do not repeat those overconfident patterns in the refreshed sections. If a prior recommendation needed softer confidence or explicit verification wording, carry that caution directly into the refreshed draft.",
    "Use data_quality_gaps to narrow or soften claims when the underlying inputs are incomplete. When a high-severity gap exists, prefer verification language and conservative support guidance over assumptions.",
    "Use improvement_actions as the ranked list of unresolved weaknesses from the previous plan state. If one maps to a requested section, fix that weakness directly rather than lightly rewriting the old wording.",
    "Use completed_improvement_actions as proof of what staff already fixed or confirmed. Do not carry old weakness language forward unless the current signals still support it.",
    "Use explicit_staff_feedback and section_outcomes as the strongest evidence of what held up in practice. Preserve sections that staff marked helped unless stronger new evidence contradicts them. Rework sections marked did_not_help or needs_follow_up before repeating their old guidance.",
    "When section_outcomes shows a strengthening trend or supportive evidence_balance, preserve that section's core routine unless stronger live evidence now contradicts it. When section_outcomes shows a weakening trend or caution evidence_balance, rewrite that section decisively instead of lightly polishing it. Use operational_learning_summary as the short explanation of what real follow-through has been teaching us.",
    "Use client_response_memory to adapt the requested sections to how this specific client actually responds. Lean more on strongest_anchors when they still fit the live picture. Treat fragile_anchors as categories that need caution, tighter verification, or a different approach. Use response_by_source and category_patterns to understand whether outreach, check-ins, medication structure, or caregiver reinforcement is currently landing or breaking down.",
    "Use cohort_guidance only as cautious same-organization fallback learning when this client's own history is thin or mixed. Never let cohort patterns override fresher client_response_memory, explicit_staff_feedback, live alerts, direct follow-through, or recommendation_effectiveness.",
    "Use inferred_operational_feedback as observed evidence from real activity after the last plan, including check-in outcomes, Brain Coach outcomes, medication logs, alerts, and risk movement. Treat it as weaker than explicit human judgment but stronger than generic background context.",
    "Use recent_operational_events as the freshest contact record across scheduled services, medication logs, and outreach activity. If these events show repeated misses or failed outreach, tighten monitoring and escalation wording.",
    "Use live_evidence_summary as the pattern-level read for the requested sections. Repeated missed touchpoints, unstable medication adherence, alert-heavy sensor pressure, or weak reachability should change the refreshed wording more than any single isolated event.",
    "Use longitudinal_memory as the longer-pattern check for the requested sections. If an instability keeps resurfacing across recent plan cycles, refresh that section as a recurring pattern rather than a short-lived blip.",
    "Use readiness as the evidence-sufficiency brief for the requested sections. If readiness is guarded, keep the refreshed wording modest and explicit about what still needs confirmation. Do not write as if blocked evidence gaps are already resolved.",
    "Before finalizing each refreshed recommendation, challenge it: ask whether the evidence is strong enough, whether the wording sounds too optimistic for the live pressure, and what fallback applies if the first step fails.",
    "Use existing_plan_freshness as the trust meter for the prior plan. If it is stale or critical, do not preserve wording just because it was reviewed before; update the target sections to match the newer signals.",
    "Use existing_plan_refresh_strategy to understand why these target sections were chosen and which neighboring sections should stay aligned. If monitoring or escalation is part of the high-priority refresh path, keep their logic in sync.",
    "Use recommendation_learning and signal_preference_weights to learn at the recommendation level, not just the section level. Prefer wording and routines tied to preserve signals, reuse_priority preserve recommendations, strengthening trajectories, and operational_pattern reinforcing. Be skeptical of recommendations tied to recheck signals, reuse_priority replace recommendations, weakening trajectories, or operational_pattern conflicting.",
    "Use recommendation_effectiveness as the actionable keep-or-change brief for the requested sections. Protect preserve_now routines unless stronger live evidence now contradicts them. Rework rework_now routines instead of copying them forward unchanged. Do not let retire_now language come back unchanged unless fresh evidence now clearly reverses the old outcome.",
    "Use recommendation_repair_brief as the per-recommendation edit map for the requested sections. Preserve items marked preserve unless fresher evidence clearly overturns them. Rewrite items marked rework with clearer evidence, fallback, or verification wording. Replace items marked retire instead of bringing them back back unchanged. Treat verify items as needing explicit confirm or re-check language.",
    "Use recommendation_challenges as the skepticism map from the previous plan. If a recommendation was challenged for weak evidence, optimistic tone, or a missing fallback, fix that weakness directly instead of carrying the old pattern forward.",
    "Use recommendation_survivorship as the cross-version memory of what keeps surviving for this client. Preserve durable recommendation patterns when they still fit the live picture, but let fragile or retired patterns fall away unless new evidence now supports them.",
    "Use recommendation_revision_memory as the rewrite-outcome memory for the requested sections. If a rewrite improved, protect the stronger version. If it stayed unresolved, rewrite that weakness directly instead of making cosmetic edits. If it regressed, do not bring the old wording back without new evidence.",
    "Use quality_memory as the saved audit memory of what previous plan versions kept getting wrong or right. If recurring_quality_risks or repeated_refresh_sections keep targeting one of the requested sections, rewrite that section substantively instead of making cosmetic edits. Preserve durable_patterns when they still fit, keep fragile_patterns from returning without new proof, and treat current_guardrails as ceilings on certainty.",
    "Use quality_memory.candidate_selection_memory as the record of which recent drafts actually won and held up. In the refreshed sections, prefer patterns that recur in winning_strengths and avoid patterns flagged in recurring_fragilities or guardrails when the wording choice is close.",
    "Use outcome_pattern_memory as the cross-version record of what actually held up after follow-through for these requested sections. Prefer preserve_patterns, stable_response_anchors, and stable_domains when the same live evidence still exists. Keep watch_patterns and unstable_sections verification-led. Do not bring replace_patterns back unchanged unless fresh evidence clearly overturns the older outcome.",
    "Use execution_brief as the operational handoff pattern from the prior plan. If it highlighted same-day actions, verification gaps, fallback gaps, or weak close-the-loop wording, fix those exact execution weaknesses directly in the refreshed sections.",
    "Use review_remediation as the concrete fix list from the previous quality review. If it called for section refreshes or a full rebuild, repair those weaknesses explicitly instead of lightly polishing around them.",
    "Use operational_completeness as the execution-quality check for the requested sections. Refresh vague wording until the section makes timing, trigger, owner, and fallback concrete enough for staff to execute under pressure.",
    "Use action_impact as the closed-loop outcome check for the requested sections. Protect reinforced sections unless fresher live evidence now overturns them. Rewrite contradicted sections decisively instead of cosmetic edits. Treat mixed sections as needing tighter verification, fallback, or ownership wording before staff trust them heavily.",
    "Use recommendation_impact as the exact recommendation-level outcome check for the requested sections. Protect reinforced recommendations that are still landing. Refresh mixed recommendations with clearer verification, ownership, or fallback wording. Replace contradicted recommendations instead of lightly polishing them.",
    "Use recommendation_history as the cross-version outcome memory for the requested sections. If a recommendation has been deteriorating or volatile across saved versions, rewrite it substantively rather than preserving the old pattern.",
    "Use recommendation_evidence_diversity as the corroboration check for the requested sections. If a recommendation is fragile because it relies on one narrow or indirect source, either add a stronger live anchor or make the wording more conditional and verification-led.",
    "Use recommendation_review as the explicit human override lane for the requested sections. Preserve approved recommendations when the live evidence still supports them, keep watch recommendations under explicit verification, and fully rewrite recommendations marked needs_edit instead of making cosmetic wording changes.",
    "Use benchmark_guidance as the archetype backstop for the requested sections. If a matched benchmark archetype expects same-day timing, explicit verification, a fallback path, or stabilizing support continuity, keep those qualities present in the refreshed wording.",
    "Use review_priorities as the human-review map for the requested sections. If a requested section is marked high priority or response_window today, refresh it decisively with concrete verification and ownership instead of cosmetic wording changes.",
    "Recent feedback should outweigh stale feedback. When older positive feedback now conflicts with live alerts, worsening risk, or drifted sections, prefer the live evidence and conservative verification language.",
    "Use evidence_hierarchy to decide what should win when sources disagree: fresh staff feedback first, then live alerts and blocking operational signals, then live service or medication state, then predictive signals, and finally broader context.",
    "Use evidence_conflicts to name where the record is disagreeing with itself. Resolve those conflicts explicitly instead of smoothing them over with generic wording.",
    "Use intervention_memory as the client-specific learning loop. Preserve routines marked helping unless stronger new evidence contradicts them. Tighten, replace, or explicitly re-check routines marked fragile. Keep routines marked unproven conservative until fresh evidence supports them.",
    "Use clinical_cautions as non-negotiable safety pressure. If a caution is present, the refreshed sections must include the named response path instead of staying generic.",
    "Use critical_response_brief as the life-safety action contract for the refreshed sections. Keep each active same-day contract explicit, with trigger signals, owner, fallback, verification, and close-the-loop outcome still visible after the refresh.",
    "Do not collapse multiple same-day response contracts into one soft sentence during section refresh.",
    "Use response_adjudication_brief as the ranking check for the refreshed sections. Keep the top-ranked same-day contract first in the refreshed monitoring and escalation wording, and keep the next-ranked contract visible near the top rather than letting it drift into background support language.",
    "Use existing_plan_feedback and existing_plan_section_drift as the quality check on the previous plan. Prioritize sections marked needs_refresh, and preserve the strongest routines unless the new evidence clearly contradicts them.",
    "Use confidence_guardrails as a ceiling, not decoration. If a requested section is capped at medium or low confidence, write it with explicit verification language and avoid overstating certainty.",
    "Do not let calmer background context outweigh the action or verification signals when they conflict.",
    "Return only valid JSON that matches the provided schema.",
  ].join(" ");
  const userPrompt = [
    `Refresh only these health plan sections: ${sectionLabels}.`,
    "Keep the updated sections aligned with the rest of the saved plan.",
    JSON.stringify(promptInput, null, 2),
  ].join("\n\n");
  const parsed = await requestStructuredOpenAiJson({
    systemPrompt,
    userPrompt,
    schemaName: "personalized_health_plan_partial_refresh",
    schema: partialSchema,
    errorLabel: "Health plan section refresh",
  });

  try {
    const finalized = finalizeGeneratedHealthPlanSectionRefresh({
      parsed,
      sourceSignals,
      promptInput,
      existingPlan,
      normalizedSections,
      label: "Health plan section refresh",
    });
    if (!shouldAttemptHealthPlanCalibrationRepair(finalized?.recommendation_calibration)) {
      return {
        ...finalized,
        cohort_guidance: promptInput?.cohort_guidance || null,
      };
    }
    try {
      const repaired = await requestStructuredOpenAiJson({
        systemPrompt,
        userPrompt: buildHealthPlanRepairPrompt({
          promptInput,
          previousDraft: finalized.plan,
          defectMessage: buildHealthPlanCalibrationRepairMessage(finalized.recommendation_calibration),
          calibrationBrief: buildHealthPlanCalibrationRepairBrief(finalized.recommendation_calibration),
          instruction: `Your previous targeted refresh for ${sectionLabels} only became acceptable after the server softened confidence or added verification wording. Rewrite only the requested sections so those corrections are naturally present while staying aligned with the saved plan.`,
        }),
        schemaName: "personalized_health_plan_partial_refresh_calibration_repair",
        schema: partialSchema,
        errorLabel: "Health plan section refresh calibration repair",
      });
      return {
        ...finalizeGeneratedHealthPlanSectionRefresh({
          parsed: repaired,
          sourceSignals,
          promptInput,
          existingPlan,
          normalizedSections,
          label: "Health plan section refresh calibration repair",
          generationPath: "repair",
        }),
        cohort_guidance: promptInput?.cohort_guidance || null,
      };
    } catch (repairError) {
      console.warn("Health plan section calibration-aware repair failed, keeping validated refresh:", repairError?.message || repairError);
      return {
        ...finalized,
        cohort_guidance: promptInput?.cohort_guidance || null,
      };
    }
  } catch (error) {
    if (!shouldAttemptHealthPlanRepair(error, "Health plan section refresh")) throw error;
    const repaired = await requestStructuredOpenAiJson({
      systemPrompt,
      userPrompt: buildHealthPlanRepairPrompt({
        promptInput,
        previousDraft: parsed,
        defectMessage: error?.message || "The refreshed sections did not pass validation.",
        calibrationBrief: existingPlan?.quality_snapshot_json?.recommendation_calibration || null,
        instruction: `Your previous targeted refresh for ${sectionLabels} failed the server review. Repair only the requested sections and keep them aligned with the saved plan.`,
      }),
      schemaName: "personalized_health_plan_partial_refresh_repair",
      schema: partialSchema,
      errorLabel: "Health plan section refresh repair",
    });
    return {
      ...finalizeGeneratedHealthPlanSectionRefresh({
        parsed: repaired,
        sourceSignals,
        promptInput,
        existingPlan,
        normalizedSections,
        label: "Health plan section refresh repair",
        generationPath: "repair",
      }),
      cohort_guidance: promptInput?.cohort_guidance || null,
    };
  }
}

async function generateTargetedHealthPlanSections(
  profile,
  predictiveContext,
  sourceSignals,
  language,
  existingPlan,
  existingPlanFeedback,
  existingPlanHistory,
  targetSections,
  options = {},
) {
  const normalizedSections = normalizeHealthPlanTargetSections(targetSections);
  if (!normalizedSections.length) throw httpError(400, "At least one health plan section is required");
  const promptInput = assembleHealthPlanPromptInput(
    profile,
    predictiveContext,
    sourceSignals,
    language,
    existingPlan,
    existingPlanFeedback,
    existingPlanHistory,
    { ...options, targetSections: normalizedSections },
  );
  assertHealthPlanReadinessForGeneration(promptInput, "Health plan section refresh");

  if (healthPlanAiProvider === "openai" && openAiApiKey) {
    try {
      return await generateHealthPlanSectionsWithOpenAI(
        profile,
        predictiveContext,
        sourceSignals,
        language,
        existingPlan,
        existingPlanFeedback,
        existingPlanHistory,
        normalizedSections,
        { ...options, promptInput },
      );
    } catch (error) {
      if (Number(error?.statusCode || error?.status || 0) === 409) throw error;
      console.warn("Health plan section refresh failed, using deterministic fallback:", error?.message || error);
    }
  }

  const fallbackPlan = buildFallbackHealthPlan(profile, predictiveContext, sourceSignals, language);
  const calibrated = applyHealthPlanConfidenceCalibration(fallbackPlan, {
    sourceSignals,
    dataQualityGaps: promptInput?.data_quality_gaps || [],
    evidenceConflicts: promptInput?.evidence_conflicts || [],
    followThrough: promptInput?.existing_plan_feedback || null,
    sectionDrift: promptInput?.existing_plan_section_drift || [],
  });
  const partialPlan = {
    summary_text: calibrated.plan?.summary_text || fallbackPlan.summary_text,
    summary_signal_ids: normalizeHealthPlanSignalIds(calibrated.plan?.summary_signal_ids || fallbackPlan.summary_signal_ids),
    ...Object.fromEntries(
      normalizedSections.map((sectionKey) => [sectionKey, normalizeHealthPlanSectionItems(calibrated.plan?.[sectionKey] || fallbackPlan?.[sectionKey])]),
    ),
    generator_provider: fallbackPlan.generator_provider,
    generator_model: fallbackPlan.generator_model,
    generator_version: fallbackPlan.generator_version,
  };
  return {
    plan: {
      summary_text: partialPlan.summary_text || existingPlan.summary_text,
      summary_signal_ids: partialPlan.summary_signal_ids?.length ? partialPlan.summary_signal_ids : existingPlan.summary_signal_ids,
      goals_json: normalizedSections.includes("goals_json") ? partialPlan.goals_json : existingPlan.goals_json,
      daily_support_json: normalizedSections.includes("daily_support_json") ? partialPlan.daily_support_json : existingPlan.daily_support_json,
      monitoring_json: normalizedSections.includes("monitoring_json") ? partialPlan.monitoring_json : existingPlan.monitoring_json,
      escalation_json: normalizedSections.includes("escalation_json") ? partialPlan.escalation_json : existingPlan.escalation_json,
      caregiver_guidance_json: normalizedSections.includes("caregiver_guidance_json") ? partialPlan.caregiver_guidance_json : existingPlan.caregiver_guidance_json,
      generator_provider: partialPlan.generator_provider,
      generator_model: partialPlan.generator_model,
      generator_version: partialPlan.generator_version,
    },
    recommendation_calibration: null,
    cohort_guidance: promptInput?.cohort_guidance || null,
  };
}

function normalizeHealthPlanPayload(
  payload,
  {
    fallbackLanguage = "de",
    sourceSignals = [],
    generator = null,
    generatedByUserId = null,
    reviewedByEmail = null,
    actionType = "edited",
    actorUserId = null,
    actorEmail = null,
  } = {},
) {
  const reviewStatus = payload?.review_status === "reviewed" ? "reviewed" : "draft";
  const normalizedSourceSignals = normalizeHealthPlanSourceSignals(payload?.source_signals_json ?? sourceSignals);
  const normalizedDataQualityGaps = normalizeHealthPlanDataQualityGaps(payload?.data_quality_gaps_json);
  const normalizedCompletedImprovementActions = normalizeCompletedHealthPlanImprovementActions(payload?.completed_improvement_actions_json);
  const normalizedFeedbackEntries = normalizeHealthPlanFeedbackEntries(payload?.feedback_entries_json);
  const normalizedInferredFeedback = normalizeHealthPlanFeedbackEntries(payload?.inferred_feedback_json);
  const normalizedRecommendationLearning = normalizeHealthPlanRecommendationLearning(payload?.recommendation_learning_json);
  const signalTriage = buildHealthPlanSignalTriage(normalizedSourceSignals);
  const enrichedSections = enrichHealthPlanSections({
    goals_json: normalizeHealthPlanSectionItems(payload?.goals_json ?? payload?.goals),
    daily_support_json: normalizeHealthPlanSectionItems(payload?.daily_support_json ?? payload?.daily_support),
    monitoring_json: normalizeHealthPlanSectionItems(payload?.monitoring_json ?? payload?.monitoring),
    escalation_json: normalizeHealthPlanSectionItems(payload?.escalation_json ?? payload?.escalation),
    caregiver_guidance_json: normalizeHealthPlanSectionItems(payload?.caregiver_guidance_json ?? payload?.caregiver_guidance),
  }, { sourceSignals: normalizedSourceSignals, signalTriage });
  const summarySignalIds = inferHealthPlanSummarySignalIds(payload?.summary_signal_ids, normalizedSourceSignals, signalTriage, enrichedSections);
  return {
    action_type: normalizeHealthPlanActionType(payload?.action_type, actionType),
    actor_user_id: nullIfBlank(payload?.actor_user_id) || actorUserId || generatedByUserId || null,
    actor_email: normalizedEmail(payload?.actor_email || actorEmail || reviewedByEmail) || null,
    language: normalizeLanguage(payload?.language, fallbackLanguage),
    status: "current",
    review_status: reviewStatus,
    escalation_grade: ["routine", "heightened", "urgent"].includes(nullIfBlank(payload?.escalation_grade)) ? payload.escalation_grade : "routine",
    review_required: Boolean(payload?.review_required),
    review_window: ["today", "this_week", "ongoing"].includes(nullIfBlank(payload?.review_window)) ? payload.review_window : "ongoing",
    review_summary: nullIfBlank(payload?.review_summary),
    review_reasons_json: Array.isArray(payload?.review_reasons_json) ? payload.review_reasons_json : [],
    review_note: reviewStatus === "reviewed" ? nullIfBlank(payload?.review_note) : null,
    review_checklist_json: reviewStatus === "reviewed"
      ? normalizeHealthPlanReviewChecklist(payload?.review_checklist_json)
      : normalizeHealthPlanReviewChecklist(null),
    recommendation_review_decisions_json: normalizeHealthPlanRecommendationReviewDecisions(payload?.recommendation_review_decisions_json),
    summary_text: nullIfBlank(payload?.summary_text),
    summary_signal_ids: summarySignalIds,
    goals_json: enrichedSections.goals_json,
    daily_support_json: enrichedSections.daily_support_json,
    monitoring_json: enrichedSections.monitoring_json,
    escalation_json: enrichedSections.escalation_json,
    caregiver_guidance_json: enrichedSections.caregiver_guidance_json,
    source_signals_json: normalizedSourceSignals,
    data_quality_gaps_json: normalizedDataQualityGaps,
    completed_improvement_actions_json: normalizedCompletedImprovementActions,
    feedback_entries_json: normalizedFeedbackEntries,
    inferred_feedback_json: normalizedInferredFeedback,
    recommendation_learning_json: normalizedRecommendationLearning,
    generator_provider: nullIfBlank(payload?.generator_provider) || generator?.provider || null,
    generator_model: nullIfBlank(payload?.generator_model) || generator?.model || null,
    generator_version: nullIfBlank(payload?.generator_version) || generator?.version || null,
    generated_by_user_id: nullIfBlank(payload?.generated_by_user_id) || generatedByUserId || null,
    reviewed_at: reviewStatus === "reviewed" ? normalizeTimestampValue(payload?.reviewed_at) || new Date().toISOString() : null,
    reviewed_by_user_id: reviewStatus === "reviewed" ? nullIfBlank(payload?.reviewed_by_user_id) || generatedByUserId || null : null,
    reviewed_by_email: reviewStatus === "reviewed" ? normalizedEmail(payload?.reviewed_by_email || reviewedByEmail) : null,
  };
}

async function saveHealthPlan(client, userId, context, payload) {
  const normalized = normalizeHealthPlanPayload(payload, {
    fallbackLanguage: normalizeLanguage(payload?.language, context?.organization?.defaultLanguage || "de"),
    sourceSignals: payload?.source_signals_json,
    generator: {
      provider: payload?.generator_provider,
      model: payload?.generator_model,
      version: payload?.generator_version,
    },
    generatedByUserId: payload?.generated_by_user_id || context?.userId || null,
    reviewedByEmail: context?.email || null,
    actionType: payload?.action_type || "edited",
    actorUserId: context?.userId || null,
    actorEmail: context?.email || null,
  });
  if (!normalized.summary_text) return { error: "summary_text is required" };
  const criticalSignalIds = normalizeHealthPlanSignalIds(payload?.critical_signal_ids);
  const signalTriage = buildHealthPlanSignalTriage(normalized.source_signals_json, criticalSignalIds);
  if (["generated", "regenerated"].includes(normalized.action_type)) {
    const repairedGeneratedPlan = repairOperationalMonitoringLanguage({
      summary_text: normalized.summary_text,
      summary_signal_ids: normalized.summary_signal_ids,
      goals_json: normalized.goals_json,
      daily_support_json: normalized.daily_support_json,
      monitoring_json: normalized.monitoring_json,
      escalation_json: normalized.escalation_json,
      caregiver_guidance_json: normalized.caregiver_guidance_json,
    }, {
      sourceSignals: normalized.source_signals_json,
      signalTriage,
      criticalSignalIds,
    });
    normalized.monitoring_json = repairedGeneratedPlan.monitoring_json;
  }
  const escalationGrade = buildHealthPlanEscalationGrade({
    sourceSignals: normalized.source_signals_json,
    signalTriage,
    criticalSignalIds,
  });
  const coverageIssues = findHealthPlanCoverageIssues({
    summary_signal_ids: normalized.summary_signal_ids,
    goals_json: normalized.goals_json,
    daily_support_json: normalized.daily_support_json,
    monitoring_json: normalized.monitoring_json,
    escalation_json: normalized.escalation_json,
    caregiver_guidance_json: normalized.caregiver_guidance_json,
  }, {
    sourceSignals: normalized.source_signals_json,
    signalTriage,
    criticalSignalIds,
  });
  if (coverageIssues.length) return { error: coverageIssues[0].message || "Health plan is missing required support coverage" };
  const safetyIssues = findHealthPlanSafetyIssues({
    summary_text: normalized.summary_text,
    summary_signal_ids: normalized.summary_signal_ids,
    goals_json: normalized.goals_json,
    daily_support_json: normalized.daily_support_json,
    monitoring_json: normalized.monitoring_json,
    escalation_json: normalized.escalation_json,
    caregiver_guidance_json: normalized.caregiver_guidance_json,
  }, {
    sourceSignals: normalized.source_signals_json,
    signalTriage,
    criticalSignalIds,
  });
  if (safetyIssues.length) return { error: safetyIssues[0].message || "Health plan wording is not operationally safe enough" };
  const escalationGradeIssues = findHealthPlanEscalationGradeIssues({
    summary_text: normalized.summary_text,
    summary_signal_ids: normalized.summary_signal_ids,
    goals_json: normalized.goals_json,
    daily_support_json: normalized.daily_support_json,
    monitoring_json: normalized.monitoring_json,
    escalation_json: normalized.escalation_json,
    caregiver_guidance_json: normalized.caregiver_guidance_json,
  }, {
    escalationGrade,
    sourceSignals: normalized.source_signals_json,
  });
  if (escalationGradeIssues.length) return { error: escalationGradeIssues[0].message || "Health plan does not match the current escalation floor" };
  const clinicalCautions = buildHealthPlanClinicalCautions({
    sourceSignals: normalized.source_signals_json,
    followThrough: payload?.follow_through || null,
  });
  const clinicalCautionIssues = findHealthPlanClinicalCautionIssues({
    summary_text: normalized.summary_text,
    summary_signal_ids: normalized.summary_signal_ids,
    goals_json: normalized.goals_json,
    daily_support_json: normalized.daily_support_json,
    monitoring_json: normalized.monitoring_json,
    escalation_json: normalized.escalation_json,
    caregiver_guidance_json: normalized.caregiver_guidance_json,
  }, {
    sourceSignals: normalized.source_signals_json,
    followThrough: payload?.follow_through || null,
    clinicalCautions,
  });
  if (clinicalCautionIssues.length) return { error: clinicalCautionIssues[0].message || "Health plan missed a clinically important caution response" };
  const combinedFeedbackEntries = [
    ...normalizeHealthPlanFeedbackEntries(normalized.feedback_entries_json),
    ...normalizeHealthPlanFeedbackEntries(normalized.inferred_feedback_json),
  ].sort((left, right) => {
    const leftTime = left?.recorded_at ? new Date(left.recorded_at).getTime() : 0;
    const rightTime = right?.recorded_at ? new Date(right.recorded_at).getTime() : 0;
    return rightTime - leftTime;
  });
  const recommendationLearningSnapshot = normalizeHealthPlanRecommendationLearning(
    normalized.recommendation_learning_json?.length
      ? normalized.recommendation_learning_json
      : buildHealthPlanRecommendationOutcomeMemory({
        plan: {
          goals_json: normalized.goals_json,
          daily_support_json: normalized.daily_support_json,
          monitoring_json: normalized.monitoring_json,
          escalation_json: normalized.escalation_json,
          caregiver_guidance_json: normalized.caregiver_guidance_json,
        },
        feedbackEntries: combinedFeedbackEntries,
        followThrough: payload?.follow_through || null,
        sectionDrift: payload?.section_drift || [],
        recentOperationalEvents: payload?.recent_operational_events || [],
        sourceSignals: normalized.source_signals_json,
      }),
  );
  const generatedAt = normalizeTimestampValue(payload?.generated_at) || new Date().toISOString();
  const organizationId = scopeOrganizationId(context);
  const currentResult = await client.query(
    `
      SELECT id::text, current_version, review_checklist_json
      FROM public.vyva_user_health_plans
      WHERE vyva_user_id = $1
        AND organization_id = $2
      LIMIT 1
      FOR UPDATE
    `,
    [userId, organizationId],
  );

  const existing = currentResult.rows[0] || null;
  const nextVersion = Math.max(1, Number(existing?.current_version || 0) + (existing ? 1 : 0));
  const effectiveActionType = existing
    ? normalized.action_type === "generated"
      ? "regenerated"
      : normalized.action_type
    : normalized.action_type === "regenerated"
      ? "generated"
      : normalized.action_type;
  if (normalized.review_status === "reviewed") {
    normalized.review_checklist_json = applyHealthPlanReviewChecklistAudit(
      normalized.review_checklist_json,
      {
        previousChecklist: existing?.review_checklist_json || null,
        reviewedAt: normalized.reviewed_at,
        actorUserId: normalized.reviewed_by_user_id || normalized.actor_user_id || null,
        actorEmail: normalized.reviewed_by_email || normalized.actor_email || null,
        actionType: effectiveActionType,
      },
    );
  }
  const historyBeforeSave = existing ? await loadHealthPlanHistory(userId, context, client) : [];
  const previousPlan = historyBeforeSave[0] || null;
  const annotatedSections = annotateHealthPlanSectionsWithEditorialTrace(
    {
      goals_json: normalized.goals_json,
      daily_support_json: normalized.daily_support_json,
      monitoring_json: normalized.monitoring_json,
      escalation_json: normalized.escalation_json,
      caregiver_guidance_json: normalized.caregiver_guidance_json,
    },
    {
      previousPlan,
      actionType: effectiveActionType,
      actorUserId: normalized.actor_user_id,
      actorEmail: normalized.actor_email,
      recordedAt: generatedAt,
      manualOverrideReason: payload?.manual_override_reason,
    },
  );
  const evidenceConflicts = buildHealthPlanEvidenceConflicts({
    sourceSignals: normalized.source_signals_json,
    feedbackEntries: combinedFeedbackEntries,
    followThrough: payload?.follow_through || null,
    sectionDrift: payload?.section_drift || [],
  });
  const reviewGovernance = buildHealthPlanReviewGovernance({
    escalationGrade,
    dataQualityGaps: normalized.data_quality_gaps_json,
    followThrough: payload?.follow_through || null,
    evidenceConflicts,
  });
  const sectionOutcomes = buildHealthPlanOutcomeScores({
    plan: {
      goals_json: annotatedSections.goals_json,
      daily_support_json: annotatedSections.daily_support_json,
      monitoring_json: annotatedSections.monitoring_json,
      escalation_json: annotatedSections.escalation_json,
      caregiver_guidance_json: annotatedSections.caregiver_guidance_json,
    },
    feedbackEntries: combinedFeedbackEntries,
    followThrough: payload?.follow_through || null,
    sectionDrift: payload?.section_drift || [],
  });
  const confidenceProfile = buildHealthPlanConfidenceProfile({
    plan: {
      goals_json: annotatedSections.goals_json,
      daily_support_json: annotatedSections.daily_support_json,
      monitoring_json: annotatedSections.monitoring_json,
      escalation_json: annotatedSections.escalation_json,
      caregiver_guidance_json: annotatedSections.caregiver_guidance_json,
    },
    sourceSignals: normalized.source_signals_json,
    dataQualityGaps: normalized.data_quality_gaps_json,
    evidenceConflicts,
    followThrough: payload?.follow_through || null,
    sectionDrift: payload?.section_drift || [],
  });
  const decisionTracePlan = {
    goals_json: annotatedSections.goals_json,
    daily_support_json: annotatedSections.daily_support_json,
    monitoring_json: annotatedSections.monitoring_json,
    escalation_json: annotatedSections.escalation_json,
    caregiver_guidance_json: annotatedSections.caregiver_guidance_json,
    recommendation_review_decisions_json: normalized.recommendation_review_decisions_json,
  };
  const freshnessSnapshot = buildHealthPlanFreshnessSnapshot({
    plan: {
      ...decisionTracePlan,
      generated_at: generatedAt,
      reviewed_at: normalized.reviewed_at,
      review_status: normalized.review_status,
    },
    followThrough: payload?.follow_through || null,
    recentOperationalEvents: payload?.recent_operational_events || [],
    reviewGovernance,
    sectionDrift: payload?.section_drift || [],
  });
  const refreshStrategySnapshot = buildHealthPlanRefreshStrategy({
    freshness: freshnessSnapshot,
    sectionDrift: payload?.section_drift || [],
    reviewGovernance,
    followThrough: payload?.follow_through || null,
  });
  const currentDraftRevision = {
    version_number: nextVersion,
    goals_json: annotatedSections.goals_json,
    daily_support_json: annotatedSections.daily_support_json,
    monitoring_json: annotatedSections.monitoring_json,
    escalation_json: annotatedSections.escalation_json,
    caregiver_guidance_json: annotatedSections.caregiver_guidance_json,
    recommendation_learning_json: recommendationLearningSnapshot,
    recommendation_review_decisions_json: normalized.recommendation_review_decisions_json,
  };
  const survivorshipSnapshot = buildHealthPlanRecommendationSurvivorship({
    history: [
      currentDraftRevision,
      ...historyBeforeSave,
    ],
  });
  const signalPreferenceWeights = buildHealthPlanSignalPreferenceWeights({
    plan: decisionTracePlan,
    feedbackEntries: combinedFeedbackEntries,
    sourceSignals: normalized.source_signals_json,
    followThrough: payload?.follow_through || null,
    sectionDrift: payload?.section_drift || [],
    recentOperationalEvents: payload?.recent_operational_events || [],
  });
  const liveEvidenceSummary = payload?.live_evidence_summary || buildHealthPlanLiveEvidenceSummary({
    recentOperationalEvents: payload?.recent_operational_events || [],
  });
  const longitudinalMemory = payload?.longitudinal_memory || buildHealthPlanLongitudinalMemory({
    liveEvidenceSummary,
    history: historyBeforeSave,
  });
  const evidenceHierarchy = buildHealthPlanEvidenceHierarchy({
    sourceSignals: normalized.source_signals_json,
    feedbackEntries: combinedFeedbackEntries,
  });
  const evidencePack = payload?.evidence_pack || buildHealthPlanEvidencePack({
    sourceSignals: normalized.source_signals_json,
    signalTriage,
    criticalSignalIds,
    evidenceHierarchy,
    evidenceConflicts,
    escalationGrade,
    dataQualityGaps: normalized.data_quality_gaps_json,
    followThrough: payload?.follow_through || null,
  });
  const interventionMemory = buildHealthPlanInterventionMemory({
    plan: decisionTracePlan,
    dataQualityGaps: normalized.data_quality_gaps_json,
    followThrough: payload?.follow_through || null,
    sectionDrift: payload?.section_drift || [],
    completedActions: normalized.completed_improvement_actions_json,
    feedbackEntries: combinedFeedbackEntries,
  });
  const clientResponseMemory = buildHealthPlanClientResponseMemory({
    recentOperationalEvents: payload?.recent_operational_events || [],
    recommendationLearning: recommendationLearningSnapshot,
    sectionOutcomes,
    sourceSignals: normalized.source_signals_json,
  });
  const reviewPriorities = payload?.review_priorities || buildHealthPlanReviewPriorities({
    sourceSignals: normalized.source_signals_json,
    escalationGrade,
    reviewGovernance,
    confidenceProfile,
    sectionOutcomes,
    clientResponseMemory,
    clinicalCautions: payload?.clinical_cautions || [],
    freshness: freshnessSnapshot,
    refreshStrategy: refreshStrategySnapshot,
  });
  const generationQuality = buildHealthPlanGenerationQuality({
    plan: decisionTracePlan,
    reviewPriorities,
    confidenceProfile,
  });
  const operationalCompleteness = buildHealthPlanOperationalCompleteness({
    plan: decisionTracePlan,
    reviewPriorities,
    escalationGrade,
    liveEvidenceSummary,
  });
  const recommendationImpact = buildHealthPlanRecommendationImpact({
    plan: decisionTracePlan,
    recentOperationalEvents: payload?.recent_operational_events || [],
    liveEvidenceSummary,
    followThrough: payload?.follow_through || null,
    sourceSignals: normalized.source_signals_json,
  });
  const recommendationEffectiveness = buildHealthPlanRecommendationEffectiveness({
    recommendationLearning: recommendationLearningSnapshot,
    recommendationSurvivorship: survivorshipSnapshot,
    recommendationImpact,
  });
  const outcomePatternMemory = buildHealthPlanOutcomePatternMemory({
    history: [
      {
        version_number: nextVersion,
        quality_snapshot_json: {
          client_response_memory: clientResponseMemory,
          recommendation_effectiveness: recommendationEffectiveness,
          section_outcomes: buildHealthPlanOutcomeScoreBrief(sectionOutcomes),
          intervention_memory: buildHealthPlanInterventionMemoryBrief(interventionMemory),
        },
      },
      ...historyBeforeSave,
    ],
  });
  const recommendationHistory = buildHealthPlanRecommendationHistory({
    history: [
      {
        ...currentDraftRevision,
        summary_text: normalized.summary_text,
        goals_json: annotatedSections.goals_json,
        daily_support_json: annotatedSections.daily_support_json,
        monitoring_json: annotatedSections.monitoring_json,
        escalation_json: annotatedSections.escalation_json,
        caregiver_guidance_json: annotatedSections.caregiver_guidance_json,
        quality_snapshot_json: {
          recommendation_impact: recommendationImpact,
          recommendation_effectiveness: recommendationEffectiveness,
        },
      },
      ...historyBeforeSave,
    ],
    recommendationImpact,
    recommendationEffectiveness,
  });
  const recommendationChallenges = buildHealthPlanRecommendationChallenges({
    plan: decisionTracePlan,
    sourceSignals: normalized.source_signals_json,
    reviewPriorities,
    liveEvidenceSummary,
    longitudinalMemory,
  });
  const recommendationSourceRanking = buildHealthPlanRecommendationSourceRanking({
    plan: decisionTracePlan,
    sourceSignals: normalized.source_signals_json,
    evidenceHierarchy,
    signalPreferenceWeights,
    recommendationEffectiveness,
    recommendationChallenges,
  });
  const recommendationEvidenceDiversity = buildHealthPlanRecommendationEvidenceDiversity({
    recommendationSourceRanking,
  });
  const recommendationGrounding = buildHealthPlanRecommendationGrounding({
    plan: decisionTracePlan,
    sourceSignals: normalized.source_signals_json,
    evidencePack,
    reviewPriorities,
    confidenceProfile,
    recommendationSourceRanking,
  });
  const recommendationCoverage = buildHealthPlanRecommendationCoverage({
    plan: decisionTracePlan,
    evidencePack,
    reviewPriorities,
    followThrough: payload?.follow_through || null,
  });
  const recommendationReview = buildHealthPlanRecommendationReviewSummary({
    plan: decisionTracePlan,
    recommendationImpact,
    recommendationHistory,
    recommendationEvidenceDiversity,
    recommendationGrounding,
    recommendationChallenges,
    recommendationReviewDecisions: normalized.recommendation_review_decisions_json,
  });
  const editorialTrace = buildHealthPlanEditorialTrace({ plan: decisionTracePlan });
  const recommendationChangeAudit = buildHealthPlanRevisionChange(
    {
      ...currentDraftRevision,
      summary_text: normalized.summary_text,
      review_status: normalized.review_status,
      quality_snapshot_json: {
        recommendation_source_ranking: recommendationSourceRanking,
        recommendation_effectiveness: recommendationEffectiveness,
      },
    },
    previousPlan,
  );
  if ((effectiveActionType === "edited" || effectiveActionType === "reviewed") && hasHighPriorityManualOverrideWithoutReason(editorialTrace)) {
    return {
      error: "manual_override_reason is required when saving high-priority manual health plan overrides",
    };
  }
  const benchmarkAssessment = buildHealthPlanBenchmarkAssessment({
    plan: decisionTracePlan,
    sourceSignals: normalized.source_signals_json,
    evidencePack,
    reviewPriorities,
    confidenceProfile,
    followThrough: payload?.follow_through || null,
  });
  const readiness = buildHealthPlanReadiness({
    dataQualityGaps: normalized.data_quality_gaps_json,
    confidenceProfile,
    reviewGovernance,
    liveEvidenceSummary,
    freshness: freshnessSnapshot,
    longitudinalMemory,
  });
  const actionImpact = buildHealthPlanActionImpact({
    plan: decisionTracePlan,
    followThrough: payload?.follow_through || null,
    recentOperationalEvents: payload?.recent_operational_events || [],
    liveEvidenceSummary,
    operationalCompleteness,
  });
  const reviewReadiness = buildHealthPlanReviewReadiness({
    reviewGovernance,
    readiness,
    generationQuality,
    operationalCompleteness,
    actionImpact,
    recommendationImpact,
    recommendationHistory,
    recommendationEvidenceDiversity,
    recommendationGrounding,
    recommendationCoverage,
    recommendationChallenges,
    recommendationReview,
    recommendationChangeAudit,
    benchmarkAssessment,
    editorialTrace,
  });
  if (normalized.review_status === "reviewed" && reviewReadiness?.can_mark_reviewed === false) {
    return {
      error: reviewReadiness?.blocking_items?.[0]?.label || reviewReadiness?.summary || "This plan still needs quality fixes before it can be marked reviewed",
      review_blockers: reviewReadiness?.blocking_items || [],
    };
  }
  const qualitySnapshot = buildHealthPlanQualitySnapshot({
    plan: decisionTracePlan,
    sourceSignals: normalized.source_signals_json,
    criticalSignalIds,
    dataQualityGaps: normalized.data_quality_gaps_json,
    followThrough: payload?.follow_through || null,
    sectionDrift: payload?.section_drift || [],
    feedbackEntries: combinedFeedbackEntries,
    completedActions: normalized.completed_improvement_actions_json,
    escalationGrade,
    reviewGovernance,
    evidenceConflicts,
    evidenceHierarchy,
    confidenceProfile,
    freshness: freshnessSnapshot,
    refreshStrategy: refreshStrategySnapshot,
    recommendationSurvivorship: survivorshipSnapshot,
    recommendationLearning: recommendationLearningSnapshot,
    signalPreferenceWeights,
    recommendationEffectiveness,
    recommendationImpact,
    recommendationHistory,
    recommendationEvidenceDiversity,
    recommendationReview,
    sectionOutcomes,
    clientResponseMemory,
    cohortGuidance: payload?.cohort_guidance || null,
    reviewPriorities,
    generationQuality,
    operationalCompleteness,
    actionImpact,
    recommendationGrounding,
    recommendationCoverage,
    benchmarkAssessment,
    benchmarkGuidance: payload?.benchmark_guidance || null,
    liveEvidenceSummary,
    longitudinalMemory,
    readiness,
    recommendationChallenges,
    recommendationSourceRanking,
    recommendationEvidenceDiversity,
    recommendationCalibration: payload?.recommendation_calibration || null,
    candidateSelection: payload?.candidate_selection || existing?.quality_snapshot_json?.candidate_selection || null,
    outcomePatternMemory,
    recommendationChangeAudit,
    editorialTrace,
    evidencePack,
    qualityMemory: payload?.quality_memory || null,
    clinicalCautions: payload?.clinical_cautions || [],
    interventionMemory,
    recentOperationalEvents: payload?.recent_operational_events || [],
    capturedAt: generatedAt,
  });
  qualitySnapshot.recommendation_history = recommendationHistory;
  qualitySnapshot.recommendation_review = recommendationReview;
  qualitySnapshot.editorial_trace = editorialTrace;
  qualitySnapshot.recommendation_change_audit = recommendationChangeAudit;
  qualitySnapshot.recommendation_revision_memory = buildHealthPlanRecommendationRevisionMemory({
    history: [
      {
        ...currentDraftRevision,
        summary_text: normalized.summary_text,
        review_status: normalized.review_status,
        goals_json: annotatedSections.goals_json,
        daily_support_json: annotatedSections.daily_support_json,
        monitoring_json: annotatedSections.monitoring_json,
        escalation_json: annotatedSections.escalation_json,
        caregiver_guidance_json: annotatedSections.caregiver_guidance_json,
        quality_snapshot_json: qualitySnapshot,
        change: qualitySnapshot.recommendation_change_audit,
      },
      ...historyBeforeSave,
    ],
  });

  if (normalized.review_status === "reviewed" && qualitySnapshot?.operational_release?.can_use_for_staff_workflow === false) {
    return {
      error: qualitySnapshot?.operational_release?.blocking_items?.[0]?.label
        || qualitySnapshot?.operational_release?.summary
        || "This plan still has operational release blockers and cannot be marked reviewed yet",
      review_blockers: qualitySnapshot?.operational_release?.blocking_items || [],
    };
  }

  let currentPlanId = existing?.id || null;
  let result;
  if (!existing) {
    result = await client.query(
      `
        INSERT INTO public.vyva_user_health_plans (
          vyva_user_id,
          organization_id,
          current_version,
          last_action_type,
          last_action_at,
          last_actor_user_id,
          last_actor_email,
          language,
          status,
          review_status,
          escalation_grade,
          review_required,
          review_window,
          review_summary,
          review_reasons_json,
          summary_text,
          summary_signal_ids_json,
          goals_json,
          daily_support_json,
          monitoring_json,
          escalation_json,
          caregiver_guidance_json,
          source_signals_json,
          data_quality_gaps_json,
          completed_improvement_actions_json,
          feedback_entries_json,
          inferred_feedback_json,
          recommendation_learning_json,
          quality_snapshot_json,
          generator_provider,
          generator_model,
          generator_version,
          generated_at,
          generated_by_user_id,
          review_note,
          review_checklist_json,
          recommendation_review_decisions_json,
          reviewed_at,
          reviewed_by_user_id,
          reviewed_by_email
        )
        VALUES ($1, $2, $3, $4, now(), $5, $6, $7, 'current', $8, $9, $10, $11, $12, $13::jsonb, $14, $15::jsonb, $16::jsonb, $17::jsonb, $18::jsonb, $19::jsonb, $20::jsonb, $21::jsonb, $22::jsonb, $23::jsonb, $24::jsonb, $25::jsonb, $26::jsonb, $27::jsonb, $28, $29, $30, $31::timestamptz, $32, $33, $34::jsonb, $35::jsonb, $36::timestamptz, $37, $38)
        RETURNING *, id::text, vyva_user_id::text, organization_id::text
      `,
      [
        userId,
        organizationId,
        nextVersion,
        effectiveActionType,
        normalized.actor_user_id,
        normalized.actor_email,
        normalized.language,
        normalized.review_status,
        normalized.escalation_grade,
        normalized.review_required,
        normalized.review_window,
        normalized.review_summary,
        JSON.stringify(normalized.review_reasons_json),
        normalized.summary_text,
        JSON.stringify(normalized.summary_signal_ids),
        JSON.stringify(annotatedSections.goals_json),
        JSON.stringify(annotatedSections.daily_support_json),
        JSON.stringify(annotatedSections.monitoring_json),
        JSON.stringify(annotatedSections.escalation_json),
        JSON.stringify(annotatedSections.caregiver_guidance_json),
        JSON.stringify(normalized.source_signals_json),
        JSON.stringify(normalized.data_quality_gaps_json),
        JSON.stringify(normalized.completed_improvement_actions_json),
        JSON.stringify(normalized.feedback_entries_json),
        JSON.stringify(normalized.inferred_feedback_json),
        JSON.stringify(recommendationLearningSnapshot),
        JSON.stringify(qualitySnapshot),
        normalized.generator_provider,
        normalized.generator_model,
        normalized.generator_version,
        generatedAt,
        normalized.generated_by_user_id,
        normalized.review_note,
        JSON.stringify(normalized.review_checklist_json),
        JSON.stringify(normalized.recommendation_review_decisions_json),
        normalized.reviewed_at,
        normalized.reviewed_by_user_id,
        normalized.reviewed_by_email,
      ],
    );
    currentPlanId = result.rows[0]?.id || null;
  } else {
    currentPlanId = existing.id;
    result = await client.query(
      `
        UPDATE public.vyva_user_health_plans
        SET
          current_version = $3,
          last_action_type = $4,
          last_action_at = now(),
          last_actor_user_id = $5,
          last_actor_email = $6,
          language = $7,
          status = 'current',
          review_status = $8,
          escalation_grade = $9,
          review_required = $10,
          review_window = $11,
          review_summary = $12,
          review_reasons_json = $13::jsonb,
          summary_text = $14,
          summary_signal_ids_json = $15::jsonb,
          goals_json = $16::jsonb,
          daily_support_json = $17::jsonb,
          monitoring_json = $18::jsonb,
          escalation_json = $19::jsonb,
          caregiver_guidance_json = $20::jsonb,
          source_signals_json = $21::jsonb,
          data_quality_gaps_json = $22::jsonb,
          completed_improvement_actions_json = $23::jsonb,
          feedback_entries_json = $24::jsonb,
          inferred_feedback_json = $25::jsonb,
          recommendation_learning_json = $26::jsonb,
          quality_snapshot_json = $27::jsonb,
          generator_provider = $28,
          generator_model = $29,
          generator_version = $30,
          generated_at = $31::timestamptz,
          generated_by_user_id = $32,
          review_note = $33,
          review_checklist_json = $34::jsonb,
          recommendation_review_decisions_json = $35::jsonb,
          reviewed_at = $36::timestamptz,
          reviewed_by_user_id = $37,
          reviewed_by_email = $38,
          updated_at = now()
        WHERE id = $1
          AND organization_id = $2
        RETURNING *, id::text, vyva_user_id::text, organization_id::text
      `,
      [
        currentPlanId,
        organizationId,
        nextVersion,
        effectiveActionType,
        normalized.actor_user_id,
        normalized.actor_email,
        normalized.language,
        normalized.review_status,
        normalized.escalation_grade,
        normalized.review_required,
        normalized.review_window,
        normalized.review_summary,
        JSON.stringify(normalized.review_reasons_json),
        normalized.summary_text,
        JSON.stringify(normalized.summary_signal_ids),
        JSON.stringify(annotatedSections.goals_json),
        JSON.stringify(annotatedSections.daily_support_json),
        JSON.stringify(annotatedSections.monitoring_json),
        JSON.stringify(annotatedSections.escalation_json),
        JSON.stringify(annotatedSections.caregiver_guidance_json),
        JSON.stringify(normalized.source_signals_json),
        JSON.stringify(normalized.data_quality_gaps_json),
        JSON.stringify(normalized.completed_improvement_actions_json),
        JSON.stringify(normalized.feedback_entries_json),
        JSON.stringify(normalized.inferred_feedback_json),
        JSON.stringify(recommendationLearningSnapshot),
        JSON.stringify(qualitySnapshot),
        normalized.generator_provider,
        normalized.generator_model,
        normalized.generator_version,
        generatedAt,
        normalized.generated_by_user_id,
        normalized.review_note,
        JSON.stringify(normalized.review_checklist_json),
        JSON.stringify(normalized.recommendation_review_decisions_json),
        normalized.reviewed_at,
        normalized.reviewed_by_user_id,
        normalized.reviewed_by_email,
      ],
    );
  }

  if (!currentPlanId) return { error: "Failed to persist health plan" };

  await client.query(
    `
      INSERT INTO public.vyva_user_health_plan_revisions (
        health_plan_id,
        vyva_user_id,
        organization_id,
        version_number,
        action_type,
        actor_user_id,
        actor_email,
        language,
        status,
        review_status,
        escalation_grade,
        review_required,
        review_window,
        review_summary,
        review_reasons_json,
        summary_text,
        summary_signal_ids_json,
        goals_json,
        daily_support_json,
        monitoring_json,
        escalation_json,
        caregiver_guidance_json,
        source_signals_json,
        data_quality_gaps_json,
        completed_improvement_actions_json,
        feedback_entries_json,
        inferred_feedback_json,
        recommendation_learning_json,
        quality_snapshot_json,
        generator_provider,
        generator_model,
        generator_version,
        generated_at,
        generated_by_user_id,
        review_note,
        review_checklist_json,
        recommendation_review_decisions_json,
        reviewed_at,
        reviewed_by_user_id,
        reviewed_by_email
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'current', $9, $10, $11, $12, $13, $14::jsonb, $15, $16::jsonb, $17::jsonb, $18::jsonb, $19::jsonb, $20::jsonb, $21::jsonb, $22::jsonb, $23::jsonb, $24::jsonb, $25::jsonb, $26::jsonb, $27::jsonb, $28, $29, $30, $31::timestamptz, $32, $33, $34::jsonb, $35::jsonb, $36::timestamptz, $37, $38)
    `,
    [
      currentPlanId,
      userId,
      organizationId,
      nextVersion,
      effectiveActionType,
      normalized.actor_user_id,
      normalized.actor_email,
      normalized.language,
      normalized.review_status,
      normalized.escalation_grade,
      normalized.review_required,
      normalized.review_window,
      normalized.review_summary,
      JSON.stringify(normalized.review_reasons_json),
      normalized.summary_text,
      JSON.stringify(normalized.summary_signal_ids),
      JSON.stringify(annotatedSections.goals_json),
      JSON.stringify(annotatedSections.daily_support_json),
      JSON.stringify(annotatedSections.monitoring_json),
      JSON.stringify(annotatedSections.escalation_json),
      JSON.stringify(annotatedSections.caregiver_guidance_json),
      JSON.stringify(normalized.source_signals_json),
      JSON.stringify(normalized.data_quality_gaps_json),
      JSON.stringify(normalized.completed_improvement_actions_json),
      JSON.stringify(normalized.feedback_entries_json),
      JSON.stringify(normalized.inferred_feedback_json),
      JSON.stringify(recommendationLearningSnapshot),
      JSON.stringify(qualitySnapshot),
      normalized.generator_provider,
      normalized.generator_model,
      normalized.generator_version,
      generatedAt,
      normalized.generated_by_user_id,
      normalized.review_note,
      JSON.stringify(normalized.review_checklist_json),
      JSON.stringify(normalized.recommendation_review_decisions_json),
      normalized.reviewed_at,
      normalized.reviewed_by_user_id,
      normalized.reviewed_by_email,
    ],
  );

  return { value: normalizeHealthPlanRow(result.rows[0] || null) };
}

async function resolveHealthPlanUserId(rawUserId, context, { createShadow = false, client = { query } } = {}) {
  const userId = String(rawUserId || "").trim();
  if (!userId) return { error: "user_id is required" };
  if (isUuid(userId)) {
    if (await userBelongsToOrganization(userId, context, client)) return { value: userId };
    return { notFound: true };
  }
  if (createShadow) {
    return ensureLocalUserForAssignmentWithClient(client, userId, context);
  }
  const localUserId = await loadLocalUserIdForExternalUser(userId, context, client);
  return localUserId ? { value: localUserId } : { notFound: true };
}

async function loadHealthPlanProfile(rawUserId, context, { createShadow = false, client = { query } } = {}) {
  const resolved = await resolveHealthPlanUserId(rawUserId, context, { createShadow, client });
  if (resolved.error || resolved.notFound) return resolved;
  const profile = await loadUserInfo(resolved.value, context, {
    client,
    includeHealthPlan: false,
    includeCarePlanAccess: false,
  });
  if (!profile) return { notFound: true };
  return {
    value: {
      userId: resolved.value,
      profile,
    },
  };
}

async function loadExternalUserLocalServices(externalUserId, context) {
  const localUserId = await loadLocalUserIdForExternalUser(externalUserId, context);
  if (!localUserId) return { checkins: null, brainCoach: null, medicationActivity: null, sensors: [], alerts: [], healthPlan: null };

  const [checkins, brainCoach, medicationActivity, sensors, alerts, healthPlan] = await Promise.all([
    optionalRows("SELECT *, id::text, vyva_user_id::text AS user_id FROM public.vyva_user_checkins WHERE vyva_user_id = $1 LIMIT 1", [localUserId]),
    optionalRows("SELECT *, id::text, vyva_user_id::text AS user_id FROM public.vyva_user_brain_coach WHERE vyva_user_id = $1 LIMIT 1", [localUserId]),
    loadLatestMedicationActivity(localUserId),
    optionalRows("SELECT *, id::text, vyva_user_id::text FROM public.vyva_user_sensors WHERE vyva_user_id = $1 ORDER BY created_at DESC", [localUserId]),
    optionalRows("SELECT *, id::text, vyva_user_id::text FROM public.vyva_sensor_alerts WHERE vyva_user_id = $1 ORDER BY created_at DESC LIMIT 50", [localUserId]),
    loadCurrentHealthPlan(localUserId, context),
  ]);

  return {
    checkins: checkins[0] ? normalizeCheckin({ ...checkins[0], user_name: "", user_phone: null, city: null, first_name: null, last_name: null }) : null,
    brainCoach: brainCoach[0] ? normalizeBrainCoachSession({ ...brainCoach[0], user_name: "", user_phone: null, city: null }) : null,
    medicationActivity,
    sensors,
    alerts,
    healthPlan,
  };
}

async function loadExternalUserCarePlanAccess(externalUserId, context) {
  const localUserId = await loadLocalUserIdForExternalUser(externalUserId, context);
  if (!localUserId) return null;
  return (await loadCarePlanAccessMap([localUserId], context)).get(String(localUserId)) || null;
}

async function loadLocalProfileForExternalUser(externalUserId, context, client = { query }) {
  const localUserId = await loadLocalUserIdForExternalUser(externalUserId, context, client);
  return localUserId ? loadUserInfo(localUserId, context, { client }) : null;
}

function localServicesFromProfile(profile) {
  return {
    checkins: profile?.checkins || null,
    brainCoach: profile?.brainCoach || null,
    medicationActivity: profile?.medicationActivity || null,
    sensors: Array.isArray(profile?.sensors) ? profile.sensors : [],
    alerts: Array.isArray(profile?.alerts) ? profile.alerts : [],
    healthPlan: profile?.healthPlan || null,
  };
}

function carePlanAccessFromProfile(profile) {
  if (!profile?.user?.id) return null;
  return {
    can_edit_care_plan: Boolean(profile.can_edit_care_plan),
    can_edit_medications: Boolean(profile.can_edit_medications),
    can_edit_checkins: Boolean(profile.can_edit_checkins),
    can_edit_brain_coach: Boolean(profile.can_edit_brain_coach),
    edit_block_reason: profile.edit_block_reason || null,
  };
}

function preferredNonEmptyArray(primary, fallback) {
  if (Array.isArray(primary) && primary.length) return primary;
  return fallback;
}

function mergeExternalAndLocalProfileUser(externalUser, localUser, externalUserId) {
  const external = objectValue(externalUser) || {};
  const local = objectValue(localUser);
  const retainedExternalId = nullIfBlank(firstValue(
    local?.external_user_id,
    local?.externalUserId,
    external.external_user_id,
    external.externalUserId,
    external.id,
    externalUserId,
  ));
  const retainedExternalSource = nullIfBlank(firstValue(
    local?.external_source,
    local?.externalSource,
    external.external_source,
    external.externalSource,
  )) || externalUserSource;

  if (!local?.id) {
    return {
      ...external,
      external_user_id: retainedExternalId,
      externalUserId: retainedExternalId,
      external_source: retainedExternalSource,
      externalSource: retainedExternalSource,
    };
  }

  return {
    ...external,
    ...local,
    id: String(local.id),
    external_user_id: retainedExternalId,
    externalUserId: retainedExternalId,
    external_source: retainedExternalSource,
    externalSource: retainedExternalSource,
    upstream_id: nullIfBlank(firstValue(external.id, external.user_id, external.userId)) || retainedExternalId,
  };
}

function mergeExternalProfileWithLocalAssignments(
  data,
  careProviders,
  externalUserId,
  localServices = {},
  carePlanAccess = null,
  scheduledContact = null,
  localProfile = null,
) {
  const normalized = normalizeExternalProfilePayload(data) || {};
  const localUser = objectValue(localProfile?.user);
  const hasLocalProfile = Boolean(localUser?.id);
  const localProfileServices = localServicesFromProfile(localProfile);
  const resolvedServices = {
    checkins: localServices?.checkins || localProfileServices.checkins,
    brainCoach: localServices?.brainCoach || localProfileServices.brainCoach,
    medicationActivity: localServices?.medicationActivity || localProfileServices.medicationActivity,
    sensors: preferredNonEmptyArray(localServices?.sensors, localProfileServices.sensors),
    alerts: preferredNonEmptyArray(localServices?.alerts, localProfileServices.alerts),
    healthPlan: localServices?.healthPlan || localProfileServices.healthPlan,
  };
  const resolvedAccess = carePlanAccess || carePlanAccessFromProfile(localProfile);
  const hasProviders = Array.isArray(careProviders) && careProviders.length;
  const mergedCareProviders = hasProviders
    ? careProviders
    : preferredNonEmptyArray(localProfile?.careProviders, normalized.careProviders);
  const mergedCaregivers = Array.isArray(mergedCareProviders) && mergedCareProviders.length
    ? careProvidersToCompatibilityCaregivers(mergedCareProviders, hasLocalProfile ? localUser.id : String(externalUserId))
    : preferredNonEmptyArray(localProfile?.caregivers, normalized.caregivers);
  const merged = {
    ...normalized,
    user: mergeExternalAndLocalProfileUser(normalized.user, localUser, externalUserId),
    consent: localProfile?.consent || normalized.consent,
    health: localProfile?.health || normalized.health,
    medications: preferredNonEmptyArray(localProfile?.medications, normalized.medications),
    careProviders: mergedCareProviders,
    caregivers: mergedCaregivers,
    checkins: resolvedServices.checkins || normalized.checkins,
    brainCoach: resolvedServices.brainCoach || normalized.brainCoach,
    medicationActivity: resolvedServices.medicationActivity || normalized.medicationActivity,
    sensors: preferredNonEmptyArray(resolvedServices.sensors, normalized.sensors),
    alerts: preferredNonEmptyArray(resolvedServices.alerts, normalized.alerts),
    readings: preferredNonEmptyArray(localProfile?.readings, normalized.readings),
    recentOperationalEvents: preferredNonEmptyArray(localProfile?.recentOperationalEvents, normalized.recentOperationalEvents),
    healthPlan: resolvedServices.healthPlan || normalized.healthPlan || null,
    can_edit_care_plan: hasLocalProfile ? Boolean(resolvedAccess?.can_edit_care_plan ?? normalized.can_edit_care_plan) : false,
    can_edit_medications: hasLocalProfile ? Boolean(resolvedAccess?.can_edit_medications ?? normalized.can_edit_medications) : false,
    can_edit_checkins: hasLocalProfile ? Boolean(resolvedAccess?.can_edit_checkins ?? normalized.can_edit_checkins) : false,
    can_edit_brain_coach: hasLocalProfile ? Boolean(resolvedAccess?.can_edit_brain_coach ?? normalized.can_edit_brain_coach) : false,
    edit_block_reason: hasLocalProfile
      ? resolvedAccess?.edit_block_reason ?? normalized.edit_block_reason
      : normalized.edit_block_reason || "external_profile_read_only",
  };
  const withScheduledContact = applyScheduledSessionContact(merged, latestScheduledContact(scheduledContact, latestScheduledContactFromServices({
    checkins: merged.checkins,
    brainCoach: merged.brainCoach,
    medicationActivity: merged.medicationActivity,
  })));
  return {
    ...withScheduledContact,
    healthPlanFeedback: withScheduledContact.healthPlan
      ? buildHealthPlanFollowThroughSummary({
        plan: withScheduledContact.healthPlan,
        profile: withScheduledContact,
      })
      : null,
  };
}

function normalizeLivingContextValue(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "alone" || normalized === "partner" || normalized === "family") return normalized;
  return null;
}

async function fetchExternalUserProfileForShadow(externalUserId, context = null) {
  const userInfo = await requestVyvaBackend("/api/v1/user-dashboard/user-info", {
    query: scopedVyvaBackendQuery({
      user_id: externalUserId,
    }, context),
  });
  if (userInfo?.ok) {
    const normalizedProfile = normalizeExternalProfilePayload(userInfo.data);
    if (externalProfileHasUser(normalizedProfile)) return normalizedProfile;
  }

  const fallbackProfile = await fetchExternalUserProfileFromDashboardFeeds(externalUserId, context);
  return externalProfileHasUser(fallbackProfile) ? fallbackProfile : null;
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
    const externalData = await fetchExternalUserProfileForShadow(userId, context).catch(() => null);
    const onboardingCaregivers = externalCaregiversForShadow(externalData);
    if (onboardingCaregivers.length) {
      await replaceCaregiversWithClient(client, existingShadowId, onboardingCaregivers, organizationId);
    }
    return { value: existingShadowId };
  }

  const externalData = await fetchExternalUserProfileForShadow(userId, context);
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

function scopedVyvaBackendQuery(queryParams, context) {
  const scoped = { ...(queryParams || {}) };
  const organization = context?.organization;
  if (!organization) return scoped;

  if (!organization.slug && organization.name && !scoped.organization_name && !scoped.organizationName) {
    scoped.organization_name = organization.name;
  }
  if (organization.slug) {
    delete scoped.organization_name;
    delete scoped.organizationName;
  }
  delete scoped.organization_id;
  delete scoped.organizationId;
  if (organization.slug && !scoped.organization_slug && !scoped.organizationSlug) {
    scoped.organization_slug = organization.slug;
  }
  return scoped;
}

function scopedVyvaBackendBody(body, context) {
  if (body === undefined) return undefined;
  if (!body || typeof body !== "object" || Array.isArray(body)) return body;
  return scopedVyvaBackendQuery(body, context);
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

async function optionalRows(text, params = [], client = { query }) {
  try {
    const result = await client.query(text, params);
    return result.rows;
  } catch (error) {
    if (["42P01", "42703"].includes(error.code)) {
      console.warn("Optional database object unavailable:", error.message);
      return [];
    }
    throw error;
  }
}

function httpError(status, message, expose = status < 500, details = null) {
  const error = new Error(message);
  error.status = status;
  error.expose = expose;
  error.details = details;
  return error;
}

function healthPlanGenerationError(status, message, details = null) {
  return httpError(status, message, true, details);
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

function encodeTokenPart(value) {
  return Buffer.from(typeof value === "string" ? value : JSON.stringify(value)).toString("base64url");
}

function signTokenPayload(encodedPayload) {
  if (!consoleSessionSecret) return null;
  return crypto.createHmac("sha256", consoleSessionSecret).update(encodedPayload).digest("base64url");
}

function createConsoleToken(payload) {
  const encodedPayload = encodeTokenPart(payload);
  const signature = signTokenPayload(encodedPayload);
  if (!signature) return null;
  return `${encodedPayload}.${signature}`;
}

function verifyConsoleToken(token, expectedKind) {
  if (!consoleSessionSecret) return null;
  const [encodedPayload, signature] = String(token || "").split(".");
  if (!encodedPayload || !signature) return null;
  const expectedSignature = signTokenPayload(encodedPayload);
  const actual = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature || "");
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return null;

  let payload = null;
  try {
    payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
  } catch {
    return null;
  }

  if (payload?.typ !== "vyva_console") return null;
  if (expectedKind && payload?.kind !== expectedKind) return null;
  if (!payload?.email || !isValidEmail(payload.email)) return null;
  if (Number(payload?.exp || 0) <= Math.floor(Date.now() / 1000)) return null;
  return payload;
}

function createConsoleLoginToken({ email, redirectPath, ttlSeconds = consoleLoginTokenTtlSeconds }) {
  const now = Math.floor(Date.now() / 1000);
  return createConsoleToken({
    typ: "vyva_console",
    kind: "login_link",
    email: normalizedEmail(email),
    next: loginRedirectPath(redirectPath),
    iat: now,
    exp: now + ttlSeconds,
  });
}

function createConsoleSessionToken({ email, userId }) {
  const now = Math.floor(Date.now() / 1000);
  return createConsoleToken({
    typ: "vyva_console",
    kind: "session",
    sub: userId || `console:${normalizedEmail(email)}`,
    email: normalizedEmail(email),
    iat: now,
    exp: now + 12 * 60 * 60,
  });
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
  if (postmarkServerToken) return "postmark";
  return null;
}

function inviteEmailProviders() {
  return [
    resendApiKey ? "resend" : null,
    postmarkServerToken ? "postmark" : null,
  ].filter(Boolean);
}

function inviteEmailConfigurationError() {
  if (!teamInviteEmailFrom) return "Email sender address is not configured";
  if (!inviteEmailProvider()) return "Email provider is not configured";
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

function isLocalOrigin(origin) {
  const parsed = safeUrl(origin);
  if (!parsed) return false;
  const host = String(parsed.hostname || "").toLowerCase();
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
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

function normalizePublicGuideUrl(url) {
  return url ? String(url).replace(/^https:\/\/rcadmin\.vyva\.life(?=\/|$)/i, "https://redcross.vyva.life") : null;
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

function consoleMagicLinkKey({ email, redirectPath, language, origin, organizationName }) {
  return JSON.stringify([
    normalizedEmail(email),
    loginRedirectPath(redirectPath),
    loginEmailLanguage(language),
    origin || "",
    organizationName || "",
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
  return normalizePublicGuideUrl(absoluteAppUrl(teamInviteGuideUrlOverride || userManualUrlOverrideRaw || teamInviteGuidePath, origin));
}

function teamInviteRedirectUrl(origin) {
  return absoluteAppUrl(teamInviteRedirectPath, origin);
}

function userManualUrl(origin, language = "en") {
  const normalizedLanguage = loginEmailLanguage(language);
  const manualPathOrUrl =
    userManualUrlOverrides[normalizedLanguage] ||
    (normalizedLanguage === "en" ? userManualUrlOverrideRaw : null) ||
    userManualPaths[normalizedLanguage] ||
    userManualPaths.en;
  return normalizePublicGuideUrl(absoluteAppUrl(manualPathOrUrl, origin));
}

function teamInviteMetadata({ context, role, organization, origin }) {
  const language = inviteEmailLanguage(organization);
  const guideUrl = teamInviteGuideUrl(origin);
  const manualUrl = userManualUrl(origin, language);
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
      manual_url: manualUrl,
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

function renderVyvaEmailHeader(language = "en", organizationName = null) {
  const redCrossLabel =
    organizationName || (language === "de" ? "Rotes Kreuz" : language === "es" ? "Cruz Roja" : "Red Cross");
  const poweredByLabel = "Powered by VYVA";

  return `
            <tr>
              <td style="padding:0;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;">
                  <tr>
                    <td style="padding:28px 36px 24px;">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                          <td style="vertical-align:middle;">
                            <table role="presentation" cellpadding="0" cellspacing="0">
                              <tr>
                                <td style="vertical-align:middle;padding-right:14px;">
                                  <span style="display:inline-block;width:48px;height:48px;border-radius:999px;background:#e30613;color:#ffffff;font-size:30px;font-weight:900;line-height:48px;text-align:center;box-shadow:0 10px 22px rgba(227,6,19,0.20);">+</span>
                                </td>
                                <td style="vertical-align:middle;">
                                  <div style="font-size:24px;font-weight:900;letter-spacing:0.01em;color:#17172f;line-height:1;">${escapeHtml(redCrossLabel)}</div>
                                  <div style="padding-top:6px;font-size:11px;font-weight:800;letter-spacing:0.16em;text-transform:uppercase;color:#e30613;">Operations console</div>
                                </td>
                              </tr>
                            </table>
                          </td>
                          <td align="right" style="vertical-align:middle;">
                            <div style="display:inline-block;text-align:right;">
                              <div style="font-size:11px;font-weight:800;letter-spacing:0.16em;text-transform:uppercase;color:#8a91a6;">${escapeHtml(poweredByLabel)}</div>
                            </div>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td style="height:5px;background:#e30613;font-size:0;line-height:0;">&nbsp;</td>
                  </tr>
                </table>
              </td>
            </tr>`;
}

function inviteEmailCopy(language, values) {
  const organizationName = values.organizationName || null;
  const roleLabel = values.roleLabel || "team member";
  const organizationFooter = organizationName ? `${organizationName} operations console` : null;

  if (language === "de") {
    return {
      subject: "Ihre Einladung zur Rotes Kreuz Operationskonsole",
      eyebrow: "Teameinladung",
      heading: "Zugang zur Operationskonsole",
      intro: `Sie wurden${organizationName ? ` fuer ${organizationName}` : ""} als ${roleLabel} hinzugefuegt. Nutzen Sie den sicheren Link unten, um die Konsole zu oeffnen.`,
      button: "Konsole oeffnen",
      guideTitle: "Benutzerhandbuch",
      guideText: "Bei Bedarf hilft das Benutzerhandbuch bei der Orientierung in der Konsole.",
      guideButton: "Handbuch oeffnen",
      securityTitle: "Sicherheitshinweis",
      securityText: "Wenn Sie diese E-Mail nicht erwartet haben, koennen Sie sie ignorieren. Ohne Zugriff auf dieses Postfach kann sich niemand anmelden.",
      fallback: "Button funktioniert nicht? Kopieren Sie diesen Link in Ihren Browser:",
      footer: organizationFooter || "Automatische Einladungs-E-Mail fuer autorisierte Konsolennutzer.",
    };
  }

  if (language === "es") {
    return {
      subject: "Tu invitacion a la consola de operaciones de Cruz Roja",
      eyebrow: "Invitacion de equipo",
      heading: "Acceso a la consola de operaciones",
      intro: `Te agregaron${organizationName ? ` a ${organizationName}` : ""} como ${roleLabel}. Usa el enlace seguro de abajo para abrir la consola.`,
      button: "Abrir consola",
      guideTitle: "Manual de usuario",
      guideText: "Si necesitas ayuda, el manual de usuario te orienta dentro de la consola.",
      guideButton: "Abrir manual",
      securityTitle: "Nota de seguridad",
      securityText: "Si no esperabas este correo, puedes ignorarlo. Nadie iniciara sesion sin acceso a esta bandeja de entrada.",
      fallback: "Si el boton no funciona, copia este enlace en tu navegador:",
      footer: organizationFooter || "Correo automatico de invitacion para usuarios autorizados de la consola.",
    };
  }

  return {
    subject: "Your Red Cross Operations Console invitation",
    eyebrow: "Team invite",
    heading: "Operations Console access",
    intro: `You were added${organizationName ? ` to ${organizationName}` : ""} as ${roleLabel}. Use the secure link below to open the console.`,
    button: "Open console",
    guideTitle: "User manual",
    guideText: "The user manual is available if you need help getting oriented in the console.",
    guideButton: "Open manual",
    securityTitle: "Security note",
    securityText: "If you were not expecting this email, you can ignore it. No one will be signed in without access to this inbox.",
    fallback: "Button not working? Copy and paste this link into your browser:",
    footer: organizationFooter || "Automated invitation email for authorized console users.",
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
            ${renderVyvaEmailHeader(language, metadata.organization_name)}
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
      subject: "Ihr Zugang zur Rotes Kreuz Operationskonsole",
      eyebrow: "Einmaliger Link",
      heading: "Rotes Kreuz Operationskonsole",
      intro:
        "Oeffnen Sie die Konsole mit diesem sicheren Link.",
      button: "Konsole oeffnen",
      manualTitle: "Benutzerhandbuch",
      manualText: "Das Benutzerhandbuch ist verfuegbar, falls Sie Hilfe bei der Orientierung brauchen.",
      manualButton: "Handbuch oeffnen",
      securityText: "Wenn Sie diese E-Mail nicht angefordert haben, koennen Sie sie einfach ignorieren.",
      fallback: "Button funktioniert nicht? Kopieren Sie diesen Link in Ihren Browser:",
      footer: "Rotes Kreuz Operationskonsole",
    };
  }

  if (language === "es") {
    return {
      subject: "Tu acceso a la consola de operaciones de Cruz Roja",
      eyebrow: "Enlace de un solo uso",
      heading: "Consola de operaciones de Cruz Roja",
      intro:
        "Abre la consola con este enlace seguro.",
      button: "Abrir consola",
      manualTitle: "Manual de usuario",
      manualText: "El manual de usuario esta disponible si necesitas ayuda para orientarte.",
      manualButton: "Abrir manual",
      securityText: "Si no solicitaste este correo, puedes ignorarlo.",
      fallback: "Si el boton no funciona, copia este enlace en tu navegador:",
      footer: "Consola de operaciones de Cruz Roja",
    };
  }

  return {
    subject: "Your Red Cross Operations Console access link",
    eyebrow: "One-time link",
    heading: "Red Cross Operations Console",
    intro:
      "Open the console with this secure link.",
    button: "Open console",
    manualTitle: "User manual",
    manualText: "The user manual is available if you need help getting oriented.",
    manualButton: "Open manual",
    securityText: "If you did not request this email, you can safely ignore it.",
    fallback: "Button not working? Copy and paste this link into your browser:",
    footer: "Red Cross Operations Console",
  };
}

function renderConsoleMagicLinkEmail({ actionLink, language = "en", manualUrl, organizationName = null }) {
  const copy = consoleMagicLinkCopy(language);
  const footerText = organizationName ? `${organizationName} operations console` : copy.footer;
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
  const manualBlock = safeManualUrl
    ? `
            <tr>
              <td style="padding:0 38px 28px;">
                <p style="margin:0;font-size:14px;line-height:1.6;color:#6b7280;">
                  ${escapeHtml(copy.manualText)}
                  <a href="${safeManualUrl}" style="display:inline-block;margin-top:10px;background:#6c4df6;color:#ffffff;text-decoration:none;font-size:14px;font-weight:800;line-height:1;border-radius:12px;padding:13px 18px;box-shadow:0 8px 18px rgba(108,77,246,0.22);">${escapeHtml(copy.manualButton)}</a>
                </p>
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
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef3fb;margin:0;padding:40px 14px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #dde3f0;border-radius:22px;overflow:hidden;box-shadow:0 18px 44px rgba(38,45,72,0.10);">
            ${renderVyvaEmailHeader(language, organizationName)}
            <tr>
              <td style="padding:38px 38px 10px;">
                <p style="display:inline-block;margin:0 0 16px;padding:7px 12px;border-radius:999px;background:#f0ecff;color:#6c4df6;font-size:12px;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;">${escapeHtml(copy.eyebrow)}</p>
                <h1 style="margin:0 0 14px;font-size:30px;line-height:1.18;color:#17172f;">${escapeHtml(copy.heading)}</h1>
                <p style="margin:0;font-size:16px;line-height:1.62;color:#5f667a;">${escapeHtml(copy.intro)}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:26px 38px 30px;">
                <a href="${safeActionLink}" style="display:inline-block;background:#6c4df6;color:#ffffff;text-decoration:none;font-size:16px;font-weight:800;line-height:1;border-radius:14px;padding:17px 25px;box-shadow:0 10px 22px rgba(108,77,246,0.24);">${escapeHtml(copy.button)}</a>
              </td>
            </tr>
            ${manualBlock}
            <tr>
              <td style="padding:0 38px 28px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fbfcff;border:1px solid #e3e8f4;border-radius:16px;">
                  <tr>
                    <td style="padding:16px 18px;">
                      <p style="margin:0;font-size:14px;line-height:1.55;color:#6b7280;">${escapeHtml(copy.securityText)}</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:0 38px 34px;">
                <p style="margin:0 0 7px;font-size:12px;line-height:1.55;color:#8a91a6;">${escapeHtml(copy.fallback)}</p>
                <p style="margin:0;font-size:11px;line-height:1.5;color:#6c4df6;word-break:break-all;">${safeActionLink}</p>
              </td>
            </tr>
          </table>
          <p style="max-width:560px;margin:18px auto 0;font-size:12px;line-height:1.6;color:#8a91a6;text-align:center;">${escapeHtml(footerText)}</p>
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

function formatEmailIdentity({ email, name }) {
  const address = String(email || "").trim();
  if (!address) return "";
  const displayName = String(name || "").trim();
  if (!displayName) return address;
  const safeName = displayName.replace(/"/g, "'");
  return `"${safeName}" <${address}>`;
}

function brandedEmailFrom(organizationName = null) {
  const identity = parseEmailIdentity(teamInviteEmailFrom);
  if (!organizationName || !identity.email) return teamInviteEmailFrom;
  return formatEmailIdentity({
    email: identity.email,
    name: `VYVA x ${organizationName}`,
  });
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

async function sendRenderedTeamInviteEmail({ to, rendered, organizationName = null }) {
  const configError = inviteEmailConfigurationError();
  if (configError) return { sent: false, error: configError, provider: null };

  const providers = inviteEmailProviders();
  const failures = [];
  const fromAddress = brandedEmailFrom(organizationName);

  for (const provider of providers) {
    try {
    if (provider === "resend") {
      await sendEmailProviderRequest({
        provider,
        url: "https://api.resend.com/emails",
        headers: { Authorization: `Bearer ${resendApiKey}` },
        body: {
          from: fromAddress,
          to: [to],
          subject: rendered.subject,
          html: rendered.html,
          text: rendered.text,
          reply_to: teamInviteEmailReplyTo || undefined,
        },
      });
    } else if (provider === "postmark") {
      await sendEmailProviderRequest({
        provider,
        url: "https://api.postmarkapp.com/email",
        headers: { "X-Postmark-Server-Token": postmarkServerToken },
        body: {
          From: fromAddress,
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
      failures.push({
        provider,
        error: error?.message || `${provider} email could not be sent`,
      });
    }
  }

  const lastFailure = failures[failures.length - 1] || null;
  return {
    sent: false,
    error: lastFailure?.error || "Invite email could not be sent",
    provider: lastFailure?.provider || providers[0] || null,
    failures,
  };
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

function consoleTeamUserIdForEmail(email) {
  return `console:${normalizedEmail(email)}`;
}

async function activatePendingConsoleTeamMember(email) {
  const normalized = normalizedEmail(email);
  if (!normalized) return null;
  const consoleId = consoleTeamUserIdForEmail(normalized);
  await reconcilePendingTeamMemberByEmail(consoleId, normalized);
  return consoleId;
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
    const consoleSessionContext = await contextFromConsoleSessionToken(token);
    if (consoleSessionContext) return applyOrganizationOverride(req, consoleSessionContext);
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
        COALESCE(MAX(profile_org.name), MAX(role_org.name)) AS organization_name,
        COALESCE(MAX(profile_org.default_language), MAX(role_org.default_language)) AS default_language,
        COUNT(r.user_id) FILTER (WHERE r.role IS NOT NULL) AS role_count
      FROM public.profiles p
      LEFT JOIN public.user_roles r ON r.user_id = p.user_id
      LEFT JOIN public.organizations profile_org ON profile_org.id = p.organization_id
      LEFT JOIN public.organizations role_org ON role_org.id = r.organization_id
      WHERE LOWER(p.email) = LOWER($1)
      GROUP BY p.user_id, p.is_platform_admin
      ORDER BY CASE WHEN p.user_id LIKE 'pending:%' THEN 1 ELSE 0 END
      LIMIT 1
    `,
    [normalized],
  );
  const row = rows[0];
  const allowed = isConfiguredPlatformAdmin || Boolean(row?.is_platform_admin) || Number(row?.role_count || 0) > 0;
  return {
    allowed,
    userId: row?.user_id || null,
    isPlatformAdmin: isConfiguredPlatformAdmin || Boolean(row?.is_platform_admin),
    organizationName: row?.organization_name || null,
    language: loginEmailLanguage(row?.default_language || (isConfiguredPlatformAdmin ? "en" : null)),
  };
}

async function loadConsoleContextByEmail(email) {
  const normalized = normalizedEmail(email);
  const access = await consoleLoginAccess(normalized);
  if (!access.allowed) throw httpError(403, "No console access has been granted for this email");

  if (access.userId) {
    const userId = String(access.userId || "").startsWith("pending:")
      ? await activatePendingConsoleTeamMember(normalized)
      : access.userId;
    return loadUserContext({ id: userId, email: normalized });
  }

  if (access.isPlatformAdmin) {
    const org = await defaultOrganization();
    return {
      userId: `platform-admin:${normalized}`,
      email: normalized,
      fullName: null,
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
    };
  }

  throw httpError(403, "No console access has been granted for this email");
}

async function contextFromConsoleSessionToken(token) {
  const payload = verifyConsoleToken(token, "session");
  if (!payload) return null;
  const context = await loadConsoleContextByEmail(payload.email);
  return { ...context, authToken: token };
}

async function sendConsoleMagicLink({ email, redirectPath, language, origin, organizationName = null }) {
  const loginToken = createConsoleLoginToken({ email, redirectPath });
  if (!loginToken) {
    return {
      sent: false,
      error: "Console session secret is not configured",
      provider: null,
      actionLink: null,
    };
  }

  const nextPath = loginRedirectPath(redirectPath);
  const loginUrl = absoluteAppUrl("/login", origin);
  if (!loginUrl) {
    return {
      sent: false,
      error: "Console app URL is not configured",
      provider: null,
      actionLink: null,
    };
  }
  const actionUrl = new URL(loginUrl);
  actionUrl.searchParams.set("console_token", loginToken);
  if (nextPath !== "/") actionUrl.searchParams.set("next", nextPath);
  const actionLink = actionUrl.toString();

  const manualUrl = userManualUrl(origin, language);
  const rendered = renderConsoleMagicLinkEmail({
    actionLink,
    language,
    manualUrl,
    organizationName,
  });
  const custom = await sendRenderedTeamInviteEmail({ to: email, rendered, organizationName });
  if (custom.sent) return { ...custom, actionLink };
  if (inviteEmailProvider()) return { ...custom, actionLink };

  const hosted = await sendHostedConsoleMagicLink({ email, redirectPath: nextPath, language, origin, organizationName });
  if (hosted.sent) return { ...hosted, actionLink };

  return {
    sent: false,
    error: hosted.error || custom.error || "VYVA email sender is not configured",
    provider: hosted.provider || custom.provider || null,
    actionLink,
    failures: [custom, hosted].filter(Boolean),
  };
}

async function sendHostedConsoleMagicLink({ email, redirectPath, language, origin, organizationName = null }) {
  const supabase = supabaseHostedMagicLinkClient();
  if (!supabase) return { sent: false, error: "Hosted magic-link email is not configured", provider: "supabase" };

  const redirectUrl = absoluteAppUrl(loginRedirectPath(redirectPath), origin);
  const manualUrl = userManualUrl(origin, language);
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: redirectUrl || undefined,
      shouldCreateUser: true,
      data: {
        language,
        email_language: language,
        login_source: "vyva_console",
        organization_name: organizationName,
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
  const hasExplicitOrganization = Boolean(id || slug || name);

  if (id) {
    const result = await query(
      "SELECT id::text, slug, name, country, default_language, timezone, active FROM public.organizations WHERE id = $1 AND active = true LIMIT 1",
      [id],
    );
    if (result.rows[0]) return result.rows[0];
    return null;
  }

  if (slug) {
    const result = await query(
      "SELECT id::text, slug, name, country, default_language, timezone, active FROM public.organizations WHERE slug = $1 AND active = true LIMIT 1",
      [slug],
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

  const addressBranchKey = normalizedBranchKey(firstValue(
    registration.city,
    registration.town,
    registration.locality,
    registration.address,
    registration.street,
  ));
  const activeOrganizations = await query(
    "SELECT id::text, slug, name, country, default_language, timezone, active FROM public.organizations WHERE active = true",
  );
  if (addressBranchKey) {
    const matches = activeOrganizations.rows.filter((organization) => branchKeyFromOrganization(organization) === addressBranchKey);
    if (matches.length === 1) return matches[0];
  }

  const countryKey = normalizedCountryKey(registration.country);
  if (countryKey) {
    const matches = activeOrganizations.rows.filter((organization) => normalizedCountryKey(organization.country) === countryKey);
    if (matches.length === 1) return matches[0];
  }

  const phoneCountryKey = countryKeyFromPhone(registration.phone);
  if (phoneCountryKey) {
    const matches = activeOrganizations.rows.filter((organization) => normalizedCountryKey(organization.country) === phoneCountryKey);
    if (matches.length === 1) return matches[0];
  }

  if (activeOrganizations.rows.length > 1) return null;

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

function teamInviteSetupError(hasPassword) {
  if (hasPassword) {
    return "Team member was not created. Temporary passwords require an external auth provider. Leave the password blank to send a secure console magic link.";
  }
  return "Team member was not created. Configure CONSOLE_SESSION_SECRET and an invite email provider before sending secure invite links.";
}

function createConsoleTeamInviteLink({ email, redirectPath, origin }) {
  const loginToken = createConsoleLoginToken({ email, redirectPath, ttlSeconds: teamInviteTokenTtlSeconds });
  if (!loginToken) return { actionLink: null, error: "Console session secret is not configured" };

  const loginUrl = absoluteAppUrl("/login", origin);
  if (!loginUrl) return { actionLink: null, error: "Console app URL is not configured" };

  const nextPath = loginRedirectPath(redirectPath);
  const actionUrl = new URL(loginUrl);
  actionUrl.searchParams.set("console_token", loginToken);
  if (nextPath !== "/") actionUrl.searchParams.set("next", nextPath);
  return { actionLink: actionUrl.toString(), error: null };
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
  let authCreateError = null;

  if (!inviteEmailError) {
    const generatedLink = createConsoleTeamInviteLink({
      email: member.value.email,
      redirectPath: teamInviteRedirectPath,
      origin: options.origin,
    });
    if (generatedLink.actionLink) {
      inviteLink = generatedLink;
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
      authCreateError = error?.message || teamInviteSetupError(true);
      console.warn("Team auth invite unavailable; team member was not created.", {
        status: error.status || null,
      });
    }
  }
  if (!inviteLink && inviteMode !== "password") {
    return {
      error: member.value.password
        ? authCreateError || teamInviteSetupError(true)
        : inviteEmailError || "Team member was not created. Configure CONSOLE_SESSION_SECRET and an invite email provider before sending secure invite links.",
      status: 503,
    };
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
      organizationName: invite.metadata.organization_name,
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
    externalUserId: row.external_user_id || null,
    externalSource: row.external_source || "local",
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
    due_medication_slots AS (
      SELECT
        m.vyva_user_id,
        m.id AS medication_id,
        slot_date::date AS scheduled_date,
        scheduled_time.value AS scheduled_time
      FROM public.vyva_user_medications m
      CROSS JOIN LATERAL generate_series(
        date_trunc('week', CURRENT_DATE)::date,
        CURRENT_DATE,
        INTERVAL '1 day'
      ) AS slot_date
      CROSS JOIN LATERAL unnest(
        CASE
          WHEN cardinality(COALESCE(m.schedule_times, ARRAY[]::text[])) > 0 THEN m.schedule_times
          ELSE ARRAY['']::text[]
        END
      ) AS scheduled_time(value)
      WHERE COALESCE(m.reminders_enabled, true) = true
        AND (
          slot_date::date < CURRENT_DATE
          OR scheduled_time.value = ''
          OR scheduled_time.value <= to_char(CURRENT_TIMESTAMP, 'HH24:MI')
        )
    ),
    missed_med_counts AS (
      SELECT
        slots.vyva_user_id,
        COUNT(*) FILTER (
          WHERE COALESCE(logs.status, 'unconfirmed') IN ('missed', 'unconfirmed', 'pending')
        )::int AS missed_meds_7d
      FROM due_medication_slots slots
      LEFT JOIN public.vyva_medication_logs logs
        ON logs.medication_id = slots.medication_id
       AND logs.scheduled_date = slots.scheduled_date
       AND COALESCE(logs.scheduled_time, '') = COALESCE(slots.scheduled_time, '')
      GROUP BY slots.vyva_user_id
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
      u.external_user_id,
      u.external_source,
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
  const checkinsExpectedWeekly = users.rows.reduce((sum, row) => {
    if (!row.checkin_enabled) return sum;
    return sum + expectedWeeklyOccurrencesFromFrequency(row.checkin_frequency);
  }, 0);
  const checkinsCompletedWeekly = users.rows.reduce((sum, row) => sum + weeklyCheckinCompletedForUser(row), 0);

  return {
    totalUsers: gisUsers.length,
    checkinsEnabled: Number(checkinRows.rows[0]?.count || 0),
    checkinsCompletedWeekly,
    checkinsExpectedWeekly,
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
      ORDER BY created_at DESC
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
    created_at: row.created_at ? new Date(row.created_at).toISOString() : null,
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

async function loadLatestScheduledSessionContact(userId, context = null) {
  const upstream = await requestVyvaBackend("/api/v1/checkins-dashboard/checkins", {
    query: scopedVyvaBackendQuery({
      user_id: userId,
      service_type: "all",
    }, context),
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
  const serviceType = normalizeScheduledContactServiceType(contact.serviceType);
  const isBrainCoach = serviceType === "brain_coach";
  return {
    ...item,
    last_checkin_at: at,
    lastCheckinAt: at,
    ...(isBrainCoach
      ? {
          last_session_at: at,
          lastSessionAt: at,
        }
      : {}),
    last_outcome: status,
    lastOutcome: status,
  };
}

const checkinAdherenceDateKeys = [
  "scheduled_date",
  "scheduledDate",
  "call_date",
  "callDate",
  "date",
  "day",
  "scheduled_for",
  "scheduledFor",
  ...scheduledSessionLogDateKeys,
];
const checkinAdherenceTimeKeys = [
  "scheduled_time",
  "scheduledTime",
  "call_time",
  "callTime",
  "preferred_time",
  "preferredTime",
  "time",
  "started_at",
  "startedAt",
  "created_at",
  "createdAt",
];
const checkinAdherenceNoteKeys = ["notes", "note", "summary", "reason", "failure_reason", "failureReason"];

function recordFirstText(record, keys) {
  if (!record || typeof record !== "object") return null;
  for (const key of keys) {
    const value = record[key];
    if (value === undefined || value === null || String(value).trim() === "") continue;
    return String(value).trim();
  }
  return null;
}

function dateOnlyFromValue(value) {
  if (!value) return null;
  const text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

function timeOnlyFromValue(value) {
  if (!value) return null;
  const text = String(value).trim();
  const match = text.match(/\b([01]\d|2[0-3]):([0-5]\d)\b/);
  if (match) return `${match[1]}:${match[2]}`;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(11, 16);
}

function normalizeCheckinAdherenceStatus(value) {
  const normalized = normalizeServiceType(value);
  if (!normalized) return null;
  if (["completed", "complete", "confirmed", "answered", "success", "successful", "reached", "done"].includes(normalized)) {
    return "completed";
  }
  if (
    [
      "missed",
      "no_answer",
      "no_response",
      "unanswered",
      "failed",
      "failure",
      "busy",
      "timeout",
      "not_reached",
      "declined",
      "cancelled",
      "canceled",
    ].includes(normalized)
  ) {
    return "missed";
  }
  if (["pending", "scheduled", "unconfirmed", "unknown", "in_progress", "queued", "no_record", "no_result"].includes(normalized)) {
    return "no_record";
  }
  if (["upcoming", "future", "planned"].includes(normalized)) return "upcoming";
  return null;
}

function normalizeCheckinAdherenceItem(item = {}, userId = "") {
  const nestedUser = item.user ?? item.vyva_users ?? {};
  const firstName = item.first_name ?? nestedUser.first_name ?? null;
  const lastName = item.last_name ?? nestedUser.last_name ?? null;
  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();
  const frequency = firstValue(item.frequency_days, item.frequency, item.cadence);
  const preferredTime = timeOnlyFromValue(firstValue(item.preferred_time, item.preferredTime, item.time));
  const isActive =
    typeof item.is_active === "boolean"
      ? item.is_active
      : typeof item.enabled === "boolean"
        ? item.enabled
        : typeof item.active === "boolean"
          ? item.active
          : true;

  return {
    id: String(firstValue(item.id, item.checkin_id, item.checkinId, "") || ""),
    user_id: String(firstValue(item.user_id, item.vyva_user_id, item.userId, item.vyvaUserId, nestedUser.id, userId) || ""),
    userName: firstValue(item.userName, item.user_name, item.name, nestedUser.name, fullName) || "Unknown user",
    type: firstValue(item.type, item.service_type, item.serviceType, "scheduled_call") || "scheduled_call",
    is_active: isActive,
    frequency_days: parseFrequencyDays(frequency),
    frequency: frequency == null ? null : String(frequency),
    preferred_time: preferredTime,
    created_at: dateOnlyFromValue(firstValue(item.created_at, item.createdAt)),
  };
}

function checkinAdherenceLogFromRecord(record, fallbackTime) {
  const date = dateOnlyFromValue(recordFirstText(record, checkinAdherenceDateKeys));
  if (!date) return null;
  return {
    date,
    time: timeOnlyFromValue(recordFirstText(record, checkinAdherenceTimeKeys)) || fallbackTime || null,
    status: normalizeCheckinAdherenceStatus(recordFirstText(record, scheduledSessionStatusKeys)),
    notes: recordFirstText(record, checkinAdherenceNoteKeys),
  };
}

function defaultCheckinAdherenceStatus(date, time) {
  const today = formatDate(new Date());
  if (date < today) return "no_record";
  if (date > today) return "upcoming";
  if (!time) return "upcoming";
  return new Date(`${date}T${time}:00`).getTime() <= Date.now() ? "no_record" : "upcoming";
}

function isCheckinScheduledForDate(checkin, date, start) {
  if (!checkin?.is_active) return false;
  const frequencyDays = Math.max(1, parseFrequencyDays(checkin.frequency_days || checkin.frequency));
  if (frequencyDays === 1) return true;
  const anchor = checkin.created_at || start;
  const cursor = new Date(`${date}T00:00:00Z`);
  const first = new Date(`${anchor}T00:00:00Z`);
  const diffDays = Math.floor((cursor.getTime() - first.getTime()) / 86_400_000);
  return diffDays >= 0 && diffDays % frequencyDays === 0;
}

function buildCheckinAdherenceSchedule(item, start, end, userId) {
  const checkin = normalizeCheckinAdherenceItem(item, userId);
  const logsByDate = new Map();
  const records = [item, ...scheduledSessionLogRecords(item)];

  for (const record of records) {
    const log = checkinAdherenceLogFromRecord(record, checkin.preferred_time);
    if (!log) continue;
    if (!logsByDate.has(log.date)) logsByDate.set(log.date, []);
    logsByDate.get(log.date).push(log);
  }

  const schedule = {};
  for (const date of datesBetween(start, end)) {
    const day = dayName(date);
    const logs = logsByDate.get(date) || [];
    schedule[day] = logs.length
      ? logs.map((log) => ({
          call_type: checkin.type,
          frequency: checkin.frequency,
          time: log.time,
          notes: log.notes,
          status: log.status || defaultCheckinAdherenceStatus(date, log.time || checkin.preferred_time),
        }))
      : [];

    if (!schedule[day].length && isCheckinScheduledForDate(checkin, date, start)) {
      schedule[day].push({
        call_type: checkin.type,
        frequency: checkin.frequency,
        time: checkin.preferred_time,
        notes: null,
        status: defaultCheckinAdherenceStatus(date, checkin.preferred_time),
      });
    }
  }

  return { schedule, checkin };
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
        last_session_at:
          item?.last_session_at ??
          item?.lastSessionAt ??
          item?.last_checkin_at ??
          item?.lastCheckinAt ??
          item?.last_reported_at ??
          item?.lastReportedAt ??
          item?.last_completed_at ??
          item?.lastCompletedAt ??
          null,
        lastSessionAt:
          item?.lastSessionAt ??
          item?.last_session_at ??
          item?.lastCheckinAt ??
          item?.last_checkin_at ??
          item?.lastReportedAt ??
          item?.last_reported_at ??
          item?.lastCompletedAt ??
          item?.last_completed_at ??
          null,
        last_outcome:
          item?.last_outcome ??
          item?.lastOutcome ??
          item?.last_status ??
          item?.lastStatus ??
          item?.last_checkin_status ??
          item?.lastCheckinStatus ??
          item?.outcome ??
          null,
        lastOutcome:
          item?.lastOutcome ??
          item?.last_outcome ??
          item?.lastStatus ??
          item?.last_status ??
          item?.lastCheckinStatus ??
          item?.last_checkin_status ??
          item?.outcome ??
          null,
        last_outcome_at: item?.last_outcome_at ?? item?.lastOutcomeAt ?? item?.last_status_at ?? item?.lastStatusAt ?? null,
        lastOutcomeAt: item?.lastOutcomeAt ?? item?.last_outcome_at ?? item?.lastStatusAt ?? item?.last_status_at ?? null,
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
    missingContactIds.map(async (userId) => [userId, await loadLatestScheduledSessionContact(userId, context)]),
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
      c.created_at,
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
      c.created_at,
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

async function loadUserInfo(
  userId,
  context,
  {
    client = { query },
    includeHealthPlan = true,
    includeCarePlanAccess = true,
  } = {},
) {
  if (!isUuid(userId)) return null;
  const organizationId = scopeOrganizationId(context);
  const userResult = await client.query(
    "SELECT *, id::text, organization_id::text FROM public.vyva_users WHERE id = $1 AND organization_id = $2 LIMIT 1",
    [userId, organizationId],
  );
  const user = userResult.rows[0];
  if (!user) return null;

  const [consent, health, medications, medicationActivity, medicationHistory, checkins, brainCoach, careProviders, sensors, alerts, campaignJobs, healthPlan] = await Promise.all([
    optionalRows("SELECT *, id::text FROM public.vyva_user_consent WHERE vyva_user_id = $1 LIMIT 1", [userId], client),
    optionalRows("SELECT *, id::text FROM public.vyva_user_health WHERE vyva_user_id = $1 LIMIT 1", [userId], client),
    optionalRows("SELECT *, id::text FROM public.vyva_user_medications WHERE vyva_user_id = $1 ORDER BY created_at DESC", [userId], client),
    loadLatestMedicationActivity(userId, client),
    loadRecentMedicationActivityHistory(userId, client),
    optionalRows("SELECT *, id::text FROM public.vyva_user_checkins WHERE vyva_user_id = $1 LIMIT 1", [userId], client),
    optionalRows("SELECT *, id::text FROM public.vyva_user_brain_coach WHERE vyva_user_id = $1 LIMIT 1", [userId], client),
    loadUserCareProviders(userId, context, client),
    optionalRows("SELECT *, id::text FROM public.vyva_user_sensors WHERE vyva_user_id = $1 ORDER BY created_at DESC", [userId], client),
    optionalRows("SELECT *, id::text FROM public.vyva_sensor_alerts WHERE vyva_user_id = $1 ORDER BY created_at DESC LIMIT 50", [userId], client),
    loadRecentCampaignCallJobsForUser(userId, context, client),
    includeHealthPlan ? loadCurrentHealthPlan(userId, context, client) : Promise.resolve(null),
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
  const carePlanAccess = includeCarePlanAccess
    ? (await loadCarePlanAccessMap([userId], context, client)).get(String(userId)) || {
        can_edit_care_plan: Boolean(context.isAdmin),
        can_edit_medications: Boolean(context.isAdmin),
        can_edit_checkins: Boolean(context.isAdmin && consent[0]?.consent_given),
        can_edit_brain_coach: Boolean(context.isAdmin && consent[0]?.consent_given),
        edit_block_reason: null,
      }
    : {
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
    healthPlan,
    checkins: checkins[0] || null,
    brainCoach: brainCoach[0] || null,
    careProviders,
    caregivers,
    sensors,
    alerts,
    recentOperationalEvents: buildRecentOperationalEvents({
      checkins: checkins[0] || null,
      brainCoach: brainCoach[0] || null,
      medicationActivity,
      medicationHistory,
      campaignJobs,
    }),
    readings: [],
    healthPlanFeedback: healthPlan
      ? buildHealthPlanFollowThroughSummary({
        plan: healthPlan,
        profile: {
          checkins: checkins[0] || null,
          brainCoach: brainCoach[0] || null,
          medicationActivity,
          alerts,
        },
      })
      : null,
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

async function loadUserCareProviders(userId, context = null, client = { query }) {
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
    client,
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
    const upstream = await requestVyvaBackend("/api/v1/user-dashboard/users", {
      query: scopedVyvaBackendQuery({}, context),
    });
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

function countryKeyFromPhone(value) {
  const digits = phoneDigits(value);
  if (!digits) return null;
  const normalized = digits.startsWith("00") ? digits.slice(2) : digits;
  if (normalized.startsWith("34")) return "spain";
  if (normalized.startsWith("49")) return "germany";
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
    phoneOnboardingUserSource,
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
          emergency_notes,
          conversation_id,
          transcript,
          call_duration,
          call_timestamp
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
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
        external_source = $3,
        first_name = COALESCE($4, first_name),
        last_name = COALESCE($5, last_name),
        phone = COALESCE($6, phone),
        city = COALESCE($7, city),
        street = COALESCE($8, street),
        house_number = COALESCE($9, house_number),
        post_code = COALESCE($10, post_code),
        country = COALESCE($11, country),
        timezone = COALESCE($12, timezone),
        date_of_birth = COALESCE($13, date_of_birth),
        gender = COALESCE($14, gender),
        language = COALESCE($15, language),
        emergency_notes = COALESCE($16, emergency_notes),
        conversation_id = COALESCE($17, conversation_id),
        transcript = COALESCE($18, transcript),
        call_duration = COALESCE($19, call_duration),
        call_timestamp = COALESCE($20, call_timestamp),
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
  if (!organization) return { error: "organization is required; send organization_slug, organization_id, or organization_name" };
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

app.get(publicManualPath, (_req, res, next) => {
  const manualPath = fs.existsSync(publicManualFilePath) ? publicManualFilePath : currentManualFilePath;
  if (!fs.existsSync(manualPath)) {
    next();
    return;
  }
  res.type("application/pdf");
  res.setHeader("Cache-Control", "public, max-age=300");
  res.sendFile(manualPath);
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
    organizationName: loginAccess.organizationName,
    origin: requestOrigin(req),
  });

  if (!sent.sent && sent.actionLink && isLocalOrigin(requestOrigin(req))) {
    res.json({ sent: true, provider: sent.provider, actionLink: sent.actionLink, local: true });
    return;
  }

  if (!sent.sent) {
    if (isMagicLinkRateLimitError(sent.error)) {
      res.status(429).json({ error: "Email sender asked us to wait before sending another sign-in link" });
      return;
    }
    res.status(503).json({ error: sent.error || "Sign-in email could not be sent" });
    return;
  }

  res.json({ sent: true, provider: sent.provider });
}, { auth: "none" }));

app.post("/api/v1/auth/session", asyncRoute(async (req, res) => {
  const payload = verifyConsoleToken(req.body?.token, "login_link");
  if (!payload) {
    res.status(401).json({ error: "Sign-in link is invalid or expired" });
    return;
  }

  const context = await loadConsoleContextByEmail(payload.email);
  const sessionToken = createConsoleSessionToken({
    email: context.email,
    userId: context.userId,
  });
  const sessionPayload = verifyConsoleToken(sessionToken, "session");
  if (!sessionToken || !sessionPayload) {
    res.status(503).json({ error: "Console session could not be created" });
    return;
  }

  res.json({
    session: {
      access_token: sessionToken,
      expires_at: sessionPayload.exp,
      token_type: "bearer",
      user: {
        id: context.userId,
        email: context.email,
        user_metadata: {
          full_name: context.fullName || undefined,
        },
        app_metadata: {
          provider: "vyva_console",
        },
        aud: "authenticated",
        role: "authenticated",
      },
    },
    user: publicContext(context),
    next: loginRedirectPath(payload.next),
  });
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
    res.status(result.status || 400).json({ error: result.error });
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
    let context = null;
    if (pool) {
      context = await resolveRequestContext(req);
      req.context = context;
    }
    if (context) {
      const localDashboard = await loadDashboardUsers(context);
      const upstream = await requestVyvaBackend("/api/v1/user-dashboard/users", {
        query: scopedVyvaBackendQuery(req.query, context),
      });
      if (upstream?.ok) {
        const externalIds = Array.isArray(upstream.data?.gisUsers)
          ? upstream.data.gisUsers.map((user) => user?.id).filter((id) => id !== undefined && id !== null)
          : [];
        const assignmentSummaries = await loadExternalAssignmentSummaries(externalIds, context);
        const upstreamDashboard = normalizeExternalDashboardPayload(upstream.data, assignmentSummaries, context);
        const cleanedLocalDashboard = removeStaleExternalShadowUsers(localDashboard, upstream.data, context);
        res.json(mergeDashboardPayloads(upstreamDashboard, cleanedLocalDashboard));
        return;
      }
      res.json(localDashboard);
      return;
    }
    const upstream = await requestVyvaBackend("/api/v1/user-dashboard/users", {
      query: scopedVyvaBackendQuery(req.query, context),
    });
    if (upstream?.ok) {
      let assignmentSummaries = new Map();
      if (context) {
        const externalIds = Array.isArray(upstream.data?.gisUsers)
          ? upstream.data.gisUsers.map((user) => user?.id).filter((id) => id !== undefined && id !== null)
          : [];
        assignmentSummaries = await loadExternalAssignmentSummaries(externalIds, context);
      }
      const upstreamDashboard = normalizeExternalDashboardPayload(upstream.data, assignmentSummaries, context);
      const localDashboard = context ? await loadDashboardUsers(context) : null;
      res.json(localDashboard ? mergeDashboardPayloads(upstreamDashboard, localDashboard) : upstreamDashboard);
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
    res.json(await loadDashboardUsers(req.context));
  } catch (error) {
    next(error);
  }
});

app.post("/api/v1/user-dashboard/users", asyncRoute(async (req, res) => {
  const upstream = await requestVyvaBackend("/api/v1/user-dashboard/users", {
    method: "POST",
    body: scopedVyvaBackendBody(req.body, req.context),
  });
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
    let context = null;
    if (pool) {
      context = await resolveRequestContext(req);
      req.context = context;
    }
    const upstream = await requestVyvaBackend("/api/v1/user-dashboard/user-info", {
      query: scopedVyvaBackendQuery({
        ...req.query,
        user_id: userId,
      }, context),
    });
    if (upstream?.ok) {
      let careProviders = [];
      let localServices = { checkins: null, brainCoach: null };
      let carePlanAccess = null;
      const scheduledContact = await loadLatestScheduledSessionContact(userId, context).catch(() => null);
      let localProfile = null;
      if (context) {
        localProfile = await loadLocalProfileForExternalUser(userId, context).catch(() => null);
        careProviders = Array.isArray(localProfile?.careProviders)
          ? localProfile.careProviders
          : await loadExternalUserCareProviders(userId, context);
        localServices = localProfile
          ? localServicesFromProfile(localProfile)
          : await loadExternalUserLocalServices(userId, context);
        carePlanAccess = carePlanAccessFromProfile(localProfile) || await loadExternalUserCarePlanAccess(userId, context);
      }
      let normalizedProfile = normalizeExternalProfilePayload(upstream.data);
      if (!externalProfileHasUser(normalizedProfile)) {
        normalizedProfile = await fetchExternalUserProfileForShadow(userId, context).catch(() => null);
      }
      if (externalProfileHasUser(normalizedProfile)) {
        if (context?.organization && !externalUserMatchesOrganization(normalizedProfile.user, context.organization)) {
          res.status(404).json({ error: "User not found" });
          return;
        }
        res.json(mergeExternalProfileWithLocalAssignments(
          normalizedProfile,
          careProviders,
          userId,
          localServices,
          carePlanAccess,
          scheduledContact,
          localProfile,
        ));
        return;
      }
    }
    if (upstream && upstream.status >= 400 && upstream.status < 500 && upstream.status !== 404) {
      res.status(upstream.status).json(upstream.data);
      return;
    }
    if (!pool) {
      res.status(upstream?.status || 404).json(upstream?.data || { error: "User not found" });
      return;
    }
    const data = isUuid(userId)
      ? await loadUserInfo(userId, req.context)
      : await loadLocalProfileForExternalUser(userId, req.context).catch(() => null);
    if (!data) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    const scheduledContact = await loadLatestScheduledSessionContact(userId, req.context).catch(() => null);
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

app.get("/api/v1/user-dashboard/users/:id/health-plan", asyncRoute(async (req, res) => {
  if (!pool) {
    res.json(null);
    return;
  }
  const resolved = await resolveHealthPlanUserId(req.params.id, req.context, { createShadow: false });
  if (resolved.notFound) {
    res.json(null);
    return;
  }
  if (resolved.error) throw httpError(400, resolved.error);
  res.json(await loadCurrentHealthPlan(resolved.value, req.context));
}));

app.get("/api/v1/user-dashboard/users/:id/health-plan/history", asyncRoute(async (req, res) => {
  if (!pool) {
    res.json([]);
    return;
  }
  const resolved = await resolveHealthPlanUserId(req.params.id, req.context, { createShadow: false });
  if (resolved.notFound) {
    res.json([]);
    return;
  }
  if (resolved.error) throw httpError(400, resolved.error);
  res.json(await loadHealthPlanHistory(resolved.value, req.context));
}));

app.get("/api/v1/user-dashboard/users/:id/health-plan/history-replay", asyncRoute(async (req, res) => {
  if (!pool) {
    res.json(null);
    return;
  }
  const resolved = await resolveHealthPlanUserId(req.params.id, req.context, { createShadow: false });
  if (resolved.notFound) {
    res.json(null);
    return;
  }
  if (resolved.error) throw httpError(400, resolved.error);
  const [currentPlan, history] = await Promise.all([
    loadCurrentHealthPlan(resolved.value, req.context),
    loadHealthPlanHistory(resolved.value, req.context),
  ]);
  res.json(buildHealthPlanBenchmarkReplayFromHistory({
    history,
    currentPlan,
  }));
}));

app.post("/api/v1/user-dashboard/users/:id/health-plan/generate", asyncRoute(async (req, res) => {
  if (!pool) throw httpError(503, "Database is not configured");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const profileResult = await loadHealthPlanProfile(req.params.id, req.context, { createShadow: true, client });
    if (profileResult.notFound) {
      await client.query("ROLLBACK");
      res.status(404).json({ error: "User not found" });
      return;
    }
    if (profileResult.error) {
      await client.query("ROLLBACK");
      res.status(400).json({ error: profileResult.error });
      return;
    }

    await requireCarePlanAccess(profileResult.value.userId, req.context, client);

    const language = normalizeLanguage(
      profileResult.value.profile?.user?.language,
      req.context?.organization?.defaultLanguage || "de",
    );
    const predictiveContext = await loadHealthPlanPredictiveContext(profileResult.value.userId, scopeOrganizationId(req.context), client);
    const sourceSignals = assembleHealthPlanSourceSignals(profileResult.value.profile, predictiveContext);
    const peerCohort = await loadHealthPlanPeerCohortContext(profileResult.value.userId, scopeOrganizationId(req.context), client);
    const liveEvidenceSummary = buildHealthPlanLiveEvidenceSummary({
      medications: profileResult.value.profile?.medications || [],
      medicationActivity: profileResult.value.profile?.medicationActivity || null,
      checkins: profileResult.value.profile?.checkins || null,
      brainCoach: profileResult.value.profile?.brainCoach || null,
      sensors: profileResult.value.profile?.sensors || [],
      alerts: profileResult.value.profile?.alerts || [],
      recentOperationalEvents: profileResult.value.profile?.recentOperationalEvents || [],
    });
    const dataQualityGaps = buildHealthPlanDataQualityGaps({
      profile: profileResult.value.profile,
      predictiveContext,
      sourceSignals,
    });
    const criticalSignalIds = deriveCriticalHealthPlanSignalIds(profileResult.value.profile, predictiveContext, sourceSignals);
    const signalTriage = buildHealthPlanSignalTriage(sourceSignals, criticalSignalIds);
    const existingPlan = await loadCurrentHealthPlan(profileResult.value.userId, req.context, client);
    const existingPlanHistory = existingPlan
      ? await loadHealthPlanHistory(profileResult.value.userId, req.context, client)
      : [];
    const longitudinalMemory = buildHealthPlanLongitudinalMemory({
      liveEvidenceSummary,
      history: existingPlanHistory,
    });
    const existingPlanFeedback = existingPlan
      ? buildHealthPlanFollowThroughSummary({
        plan: existingPlan,
        profile: profileResult.value.profile,
        predictiveContext,
      })
      : null;
    const sectionDrift = existingPlan
      ? buildHealthPlanSectionDrift({
        plan: existingPlan,
        dataQualityGaps,
        followThrough: existingPlanFeedback,
      })
      : [];
    const governance = buildHealthPlanGovernanceSnapshot({
      sourceSignals,
      signalTriage,
      criticalSignalIds,
      dataQualityGaps,
      followThrough: existingPlanFeedback,
      sectionDrift,
      feedbackEntries: existingPlan?.feedback_entries_json || [],
    });
    const inferredFeedbackSnapshot = buildStoredInferredFeedbackSnapshot(
      existingPlan,
      profileResult.value.profile,
      predictiveContext,
      existingPlanFeedback,
    );
    const generated = await generateHealthPlan(
      profileResult.value.profile,
      predictiveContext,
      sourceSignals,
      language,
      existingPlan,
      existingPlanFeedback,
      existingPlanHistory,
      { peerCohort },
    );
    const saved = await saveHealthPlan(client, profileResult.value.userId, req.context, {
      action_type: "generated",
      language,
      review_status: "draft",
      escalation_grade: governance.reviewGovernance.escalation_grade,
      review_required: governance.reviewGovernance.review_required,
      review_window: governance.reviewGovernance.review_window,
      review_summary: governance.reviewGovernance.review_summary,
      review_reasons_json: governance.reviewGovernance.review_reasons_json,
      summary_text: generated.plan.summary_text,
      summary_signal_ids: generated.plan.summary_signal_ids,
      goals_json: generated.plan.goals_json,
      daily_support_json: generated.plan.daily_support_json,
      monitoring_json: generated.plan.monitoring_json,
      escalation_json: generated.plan.escalation_json,
      caregiver_guidance_json: generated.plan.caregiver_guidance_json,
      source_signals_json: sourceSignals,
      live_evidence_summary: liveEvidenceSummary,
      longitudinal_memory: longitudinalMemory,
      cohort_guidance: generated.cohort_guidance || null,
      data_quality_gaps_json: dataQualityGaps,
      completed_improvement_actions_json: existingPlan?.completed_improvement_actions_json || [],
      feedback_entries_json: existingPlan?.feedback_entries_json || [],
      inferred_feedback_json: inferredFeedbackSnapshot,
      recommendation_review_decisions_json: existingPlan?.recommendation_review_decisions_json || [],
      follow_through: existingPlanFeedback,
      section_drift: sectionDrift,
      critical_signal_ids: criticalSignalIds,
      generator_provider: generated.plan.generator_provider,
      generator_model: generated.plan.generator_model,
      generator_version: generated.plan.generator_version,
      recommendation_calibration: generated.recommendation_calibration,
      candidate_selection: generated.candidate_selection || null,
      generated_by_user_id: req.context?.userId || null,
    });
    if (saved.error) {
      await client.query("ROLLBACK");
      res.status(400).json({ error: saved.error, ...(saved.review_blockers ? { review_blockers: saved.review_blockers } : {}) });
      return;
    }

    await client.query("COMMIT");
    res.json(saved.value);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}));

app.post("/api/v1/user-dashboard/users/:id/health-plan/regenerate-sections", asyncRoute(async (req, res) => {
  if (!pool) throw httpError(503, "Database is not configured");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const profileResult = await loadHealthPlanProfile(req.params.id, req.context, { createShadow: true, client });
    if (profileResult.notFound) {
      await client.query("ROLLBACK");
      res.status(404).json({ error: "User not found" });
      return;
    }
    if (profileResult.error) {
      await client.query("ROLLBACK");
      res.status(400).json({ error: profileResult.error });
      return;
    }

    await requireCarePlanAccess(profileResult.value.userId, req.context, client);

    const existingPlan = await loadCurrentHealthPlan(profileResult.value.userId, req.context, client);
    if (!existingPlan) {
      await client.query("ROLLBACK");
      res.status(404).json({ error: "Health plan not found" });
      return;
    }
    const existingPlanHistory = await loadHealthPlanHistory(profileResult.value.userId, req.context, client);

    const requestedSections = normalizeHealthPlanTargetSections(req.body?.sections);
    if (!requestedSections.length) {
      await client.query("ROLLBACK");
      res.status(400).json({ error: "At least one health plan section is required" });
      return;
    }

    const language = normalizeLanguage(
      existingPlan.language,
      profileResult.value.profile?.user?.language || req.context?.organization?.defaultLanguage || "de",
    );
    const predictiveContext = await loadHealthPlanPredictiveContext(profileResult.value.userId, scopeOrganizationId(req.context), client);
    const sourceSignals = assembleHealthPlanSourceSignals(profileResult.value.profile, predictiveContext);
    const liveEvidenceSummary = buildHealthPlanLiveEvidenceSummary({
      medications: profileResult.value.profile?.medications || [],
      medicationActivity: profileResult.value.profile?.medicationActivity || null,
      checkins: profileResult.value.profile?.checkins || null,
      brainCoach: profileResult.value.profile?.brainCoach || null,
      sensors: profileResult.value.profile?.sensors || [],
      alerts: profileResult.value.profile?.alerts || [],
      recentOperationalEvents: profileResult.value.profile?.recentOperationalEvents || [],
    });
    const longitudinalMemory = buildHealthPlanLongitudinalMemory({
      liveEvidenceSummary,
      history: existingPlanHistory,
    });
    const dataQualityGaps = buildHealthPlanDataQualityGaps({
      profile: profileResult.value.profile,
      predictiveContext,
      sourceSignals,
    });
    const criticalSignalIds = deriveCriticalHealthPlanSignalIds(profileResult.value.profile, predictiveContext, sourceSignals);
    const signalTriage = buildHealthPlanSignalTriage(sourceSignals, criticalSignalIds);
    const existingPlanFeedback = buildHealthPlanFollowThroughSummary({
      plan: existingPlan,
      profile: profileResult.value.profile,
      predictiveContext,
    });
    const sectionDrift = buildHealthPlanSectionDrift({
      plan: existingPlan,
      dataQualityGaps,
      followThrough: existingPlanFeedback,
    });
    const clinicalCautions = buildHealthPlanClinicalCautions({
      sourceSignals,
      followThrough: existingPlanFeedback,
    });
    const clinicalCautionIssues = findHealthPlanClinicalCautionIssues(existingPlan, {
      sourceSignals,
      followThrough: existingPlanFeedback,
      clinicalCautions,
    });
    const governance = buildHealthPlanGovernanceSnapshot({
      sourceSignals,
      signalTriage,
      criticalSignalIds,
      dataQualityGaps,
      followThrough: existingPlanFeedback,
      sectionDrift,
      feedbackEntries: existingPlan.feedback_entries_json || [],
    });
    const inferredFeedbackSnapshot = buildStoredInferredFeedbackSnapshot(
      existingPlan,
      profileResult.value.profile,
      predictiveContext,
      existingPlanFeedback,
    );
    const freshness = buildHealthPlanFreshnessSnapshot({
      plan: existingPlan,
      followThrough: existingPlanFeedback,
      recentOperationalEvents: profileResult.value.profile?.recentOperationalEvents,
      reviewGovernance: governance.reviewGovernance,
      sectionDrift,
    });
    const refreshStrategy = buildHealthPlanRefreshStrategy({
      freshness,
      sectionDrift,
      clinicalCautions,
      clinicalCautionIssues,
      reviewGovernance: governance.reviewGovernance,
      followThrough: existingPlanFeedback,
    });
    const targetSections = expandHealthPlanRefreshSections(requestedSections, refreshStrategy);
    const refreshed = await generateTargetedHealthPlanSections(
      profileResult.value.profile,
      predictiveContext,
      sourceSignals,
      language,
      existingPlan,
      existingPlanFeedback,
      existingPlanHistory,
      targetSections,
      { peerCohort },
    );
    const mergedPlan = refreshed.plan;
    const coverageIssues = findHealthPlanCoverageIssues(mergedPlan, {
      sourceSignals,
      signalTriage: buildHealthPlanSignalTriage(sourceSignals, criticalSignalIds),
      criticalSignalIds,
    }, {
      targetSections: ["summary", ...targetSections],
    });
    if (coverageIssues.length) {
      await client.query("ROLLBACK");
      res.status(502).json({ error: coverageIssues[0].message || "Health plan refresh missed required support coverage" });
      return;
    }

    const saved = await saveHealthPlan(client, profileResult.value.userId, req.context, {
      action_type: "regenerated",
      language,
      review_status: "draft",
      escalation_grade: governance.reviewGovernance.escalation_grade,
      review_required: governance.reviewGovernance.review_required,
      review_window: governance.reviewGovernance.review_window,
      review_summary: governance.reviewGovernance.review_summary,
      review_reasons_json: governance.reviewGovernance.review_reasons_json,
      summary_text: mergedPlan.summary_text,
      summary_signal_ids: mergedPlan.summary_signal_ids,
      goals_json: mergedPlan.goals_json,
      daily_support_json: mergedPlan.daily_support_json,
      monitoring_json: mergedPlan.monitoring_json,
      escalation_json: mergedPlan.escalation_json,
      caregiver_guidance_json: mergedPlan.caregiver_guidance_json,
      source_signals_json: sourceSignals,
      live_evidence_summary: liveEvidenceSummary,
      longitudinal_memory: longitudinalMemory,
      cohort_guidance: refreshed.cohort_guidance || null,
      data_quality_gaps_json: dataQualityGaps,
      completed_improvement_actions_json: existingPlan.completed_improvement_actions_json || [],
      feedback_entries_json: existingPlan.feedback_entries_json || [],
      inferred_feedback_json: inferredFeedbackSnapshot,
      recommendation_review_decisions_json: existingPlan.recommendation_review_decisions_json || [],
      follow_through: existingPlanFeedback,
      section_drift: sectionDrift,
      critical_signal_ids: criticalSignalIds,
      generator_provider: mergedPlan.generator_provider || existingPlan.generator_provider,
      generator_model: mergedPlan.generator_model || existingPlan.generator_model,
      generator_version: mergedPlan.generator_version || existingPlan.generator_version,
      recommendation_calibration: refreshed.recommendation_calibration,
    });
    if (saved.error) {
      await client.query("ROLLBACK");
      res.status(400).json({ error: saved.error, ...(saved.review_blockers ? { review_blockers: saved.review_blockers } : {}) });
      return;
    }

    await client.query("COMMIT");
    res.json(saved.value);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}));

app.post("/api/v1/user-dashboard/users/:id/health-plan/improvement-actions/complete", asyncRoute(async (req, res) => {
  if (!pool) throw httpError(503, "Database is not configured");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const profileResult = await loadHealthPlanProfile(req.params.id, req.context, { createShadow: true, client });
    if (profileResult.notFound) {
      await client.query("ROLLBACK");
      res.status(404).json({ error: "User not found" });
      return;
    }
    if (profileResult.error) {
      await client.query("ROLLBACK");
      res.status(400).json({ error: profileResult.error });
      return;
    }

    await requireCarePlanAccess(profileResult.value.userId, req.context, client);

    const existingPlan = await loadCurrentHealthPlan(profileResult.value.userId, req.context, client);
    if (!existingPlan) {
      await client.query("ROLLBACK");
      res.status(404).json({ error: "Health plan not found" });
      return;
    }

    const actionId = nullIfBlank(req.body?.action_id);
    if (!actionId) {
      await client.query("ROLLBACK");
      res.status(400).json({ error: "action_id is required" });
      return;
    }

    const predictiveContext = await loadHealthPlanPredictiveContext(profileResult.value.userId, scopeOrganizationId(req.context), client);
    const sourceSignals = assembleHealthPlanSourceSignals(profileResult.value.profile, predictiveContext);
    const dataQualityGaps = buildHealthPlanDataQualityGaps({
      profile: profileResult.value.profile,
      predictiveContext,
      sourceSignals,
    });
    const criticalSignalIds = deriveCriticalHealthPlanSignalIds(profileResult.value.profile, predictiveContext, sourceSignals);
    const followThrough = buildHealthPlanFollowThroughSummary({
      plan: existingPlan,
      profile: profileResult.value.profile,
      predictiveContext,
    });
    const sectionDrift = buildHealthPlanSectionDrift({
      plan: existingPlan,
      dataQualityGaps,
      followThrough,
    });
    const openActions = buildHealthPlanImprovementActions({
      dataQualityGaps,
      followThrough,
      sectionDrift,
      completedActions: existingPlan.completed_improvement_actions_json || [],
    });
    const signalTriage = buildHealthPlanSignalTriage(sourceSignals, criticalSignalIds);
    const governance = buildHealthPlanGovernanceSnapshot({
      sourceSignals,
      signalTriage,
      criticalSignalIds,
      dataQualityGaps,
      followThrough,
      sectionDrift,
      feedbackEntries: existingPlan.feedback_entries_json || [],
    });
    const inferredFeedbackSnapshot = buildStoredInferredFeedbackSnapshot(
      existingPlan,
      profileResult.value.profile,
      predictiveContext,
      followThrough,
    );
    const matchedAction = openActions.find((item) => item?.id === actionId);
    if (!matchedAction) {
      await client.query("ROLLBACK");
      res.status(404).json({ error: "Improvement action not found" });
      return;
    }

    const completedActions = normalizeCompletedHealthPlanImprovementActions([
      ...(existingPlan.completed_improvement_actions_json || []),
      {
        action_id: matchedAction.id,
        title: matchedAction.title,
        section_key: matchedAction.section_key,
        completed_at: new Date().toISOString(),
        completed_by_user_id: req.context?.userId || null,
        completed_by_email: req.context?.email || null,
        note: nullIfBlank(req.body?.note) || null,
      },
    ]);

    const saved = await saveHealthPlan(client, profileResult.value.userId, req.context, {
      action_type: "edited",
      language: existingPlan.language,
      review_status: existingPlan.review_status,
      review_note: existingPlan.review_note,
      escalation_grade: governance.reviewGovernance.escalation_grade,
      review_required: governance.reviewGovernance.review_required,
      review_window: governance.reviewGovernance.review_window,
      review_summary: governance.reviewGovernance.review_summary,
      review_reasons_json: governance.reviewGovernance.review_reasons_json,
      summary_text: existingPlan.summary_text,
      summary_signal_ids: existingPlan.summary_signal_ids,
      goals_json: existingPlan.goals_json,
      daily_support_json: existingPlan.daily_support_json,
      monitoring_json: existingPlan.monitoring_json,
      escalation_json: existingPlan.escalation_json,
      caregiver_guidance_json: existingPlan.caregiver_guidance_json,
      source_signals_json: sourceSignals,
      data_quality_gaps_json: dataQualityGaps,
      completed_improvement_actions_json: completedActions,
      feedback_entries_json: existingPlan.feedback_entries_json || [],
      inferred_feedback_json: inferredFeedbackSnapshot,
      recommendation_review_decisions_json: existingPlan.recommendation_review_decisions_json || [],
      follow_through: followThrough,
      section_drift: sectionDrift,
      critical_signal_ids: criticalSignalIds,
      generator_provider: existingPlan.generator_provider,
      generator_model: existingPlan.generator_model,
      generator_version: existingPlan.generator_version,
      generated_by_user_id: existingPlan.generated_by_user_id || req.context?.userId || null,
      generated_at: existingPlan.generated_at,
      reviewed_at: existingPlan.reviewed_at,
      reviewed_by_user_id: existingPlan.reviewed_by_user_id,
      reviewed_by_email: existingPlan.reviewed_by_email,
    });
    if (saved.error) {
      await client.query("ROLLBACK");
      res.status(400).json({ error: saved.error, ...(saved.review_blockers ? { review_blockers: saved.review_blockers } : {}) });
      return;
    }

    await client.query("COMMIT");
    res.json(saved.value);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}));

app.post("/api/v1/user-dashboard/users/:id/health-plan/feedback", asyncRoute(async (req, res) => {
  if (!pool) throw httpError(503, "Database is not configured");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const profileResult = await loadHealthPlanProfile(req.params.id, req.context, { createShadow: true, client });
    if (profileResult.notFound) {
      await client.query("ROLLBACK");
      res.status(404).json({ error: "User not found" });
      return;
    }
    if (profileResult.error) {
      await client.query("ROLLBACK");
      res.status(400).json({ error: profileResult.error });
      return;
    }

    await requireCarePlanAccess(profileResult.value.userId, req.context, client);

    const existingPlan = await loadCurrentHealthPlan(profileResult.value.userId, req.context, client);
    if (!existingPlan) {
      await client.query("ROLLBACK");
      res.status(404).json({ error: "Health plan not found" });
      return;
    }

    const sectionKey = nullIfBlank(req.body?.section_key);
    const itemId = nullIfBlank(req.body?.item_id);
    const outcome = nullIfBlank(req.body?.outcome);
    if (!sectionKey || !healthPlanSectionDefinitionByStorageKey[sectionKey]) {
      await client.query("ROLLBACK");
      res.status(400).json({ error: "section_key is required" });
      return;
    }
    if (!["helped", "mixed", "did_not_help", "needs_follow_up"].includes(outcome)) {
      await client.query("ROLLBACK");
      res.status(400).json({ error: "outcome is required" });
      return;
    }

    const existingFeedback = normalizeHealthPlanFeedbackEntries(existingPlan.feedback_entries_json);
    const nextFeedback = normalizeHealthPlanFeedbackEntries([
      ...existingFeedback.filter((item) => {
        if (item.section_key !== sectionKey) return true;
        const existingItemId = nullIfBlank(item?.item_id);
        if (!itemId && !existingItemId) return false;
        if (itemId && existingItemId === itemId) return false;
        return true;
      }),
      {
        id: `${sectionKey}:${itemId || "section"}`,
        section_key: sectionKey,
        item_id: itemId || undefined,
        outcome,
        note: nullIfBlank(req.body?.note) || null,
        recorded_at: new Date().toISOString(),
        recorded_by_user_id: req.context?.userId || null,
        recorded_by_email: req.context?.email || null,
      },
    ]);
    const predictiveContext = await loadHealthPlanPredictiveContext(profileResult.value.userId, scopeOrganizationId(req.context), client);
    const sourceSignals = assembleHealthPlanSourceSignals(profileResult.value.profile, predictiveContext);
    const criticalSignalIds = deriveCriticalHealthPlanSignalIds(profileResult.value.profile, predictiveContext, sourceSignals);
    const signalTriage = buildHealthPlanSignalTriage(sourceSignals, criticalSignalIds);
    const dataQualityGaps = buildHealthPlanDataQualityGaps({
      profile: profileResult.value.profile,
      predictiveContext,
      sourceSignals,
    });
    const followThrough = buildHealthPlanFollowThroughSummary({
      plan: existingPlan,
      profile: profileResult.value.profile,
      predictiveContext,
    });
    const sectionDrift = buildHealthPlanSectionDrift({
      plan: existingPlan,
      dataQualityGaps,
      followThrough,
    });
    const governance = buildHealthPlanGovernanceSnapshot({
      sourceSignals,
      signalTriage,
      criticalSignalIds,
      dataQualityGaps,
      followThrough,
      sectionDrift,
      feedbackEntries: nextFeedback,
    });
    const inferredFeedbackSnapshot = buildStoredInferredFeedbackSnapshot(
      existingPlan,
      profileResult.value.profile,
      predictiveContext,
      followThrough,
    );

    const saved = await saveHealthPlan(client, profileResult.value.userId, req.context, {
      action_type: "edited",
      language: existingPlan.language,
      review_status: existingPlan.review_status,
      review_note: existingPlan.review_note,
      escalation_grade: governance.reviewGovernance.escalation_grade,
      review_required: governance.reviewGovernance.review_required,
      review_window: governance.reviewGovernance.review_window,
      review_summary: governance.reviewGovernance.review_summary,
      review_reasons_json: governance.reviewGovernance.review_reasons_json,
      summary_text: existingPlan.summary_text,
      summary_signal_ids: existingPlan.summary_signal_ids,
      goals_json: existingPlan.goals_json,
      daily_support_json: existingPlan.daily_support_json,
      monitoring_json: existingPlan.monitoring_json,
      escalation_json: existingPlan.escalation_json,
      caregiver_guidance_json: existingPlan.caregiver_guidance_json,
      source_signals_json: sourceSignals,
      data_quality_gaps_json: dataQualityGaps,
      completed_improvement_actions_json: existingPlan.completed_improvement_actions_json || [],
      feedback_entries_json: nextFeedback,
      inferred_feedback_json: inferredFeedbackSnapshot,
      recommendation_review_decisions_json: existingPlan.recommendation_review_decisions_json || [],
      follow_through: followThrough,
      section_drift: sectionDrift,
      critical_signal_ids: criticalSignalIds,
      generator_provider: existingPlan.generator_provider,
      generator_model: existingPlan.generator_model,
      generator_version: existingPlan.generator_version,
      generated_by_user_id: existingPlan.generated_by_user_id || req.context?.userId || null,
      generated_at: existingPlan.generated_at,
      reviewed_at: existingPlan.reviewed_at,
      reviewed_by_user_id: existingPlan.reviewed_by_user_id,
      reviewed_by_email: existingPlan.reviewed_by_email,
    });
    if (saved.error) {
      await client.query("ROLLBACK");
      res.status(400).json({ error: saved.error, ...(saved.review_blockers ? { review_blockers: saved.review_blockers } : {}) });
      return;
    }

    await client.query("COMMIT");
    res.json(saved.value);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}));

app.put("/api/v1/user-dashboard/users/:id/health-plan", asyncRoute(async (req, res) => {
  if (!pool) throw httpError(503, "Database is not configured");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const profileResult = await loadHealthPlanProfile(req.params.id, req.context, { createShadow: true, client });
    if (profileResult.notFound) {
      await client.query("ROLLBACK");
      res.status(404).json({ error: "User not found" });
      return;
    }
    if (profileResult.error) {
      await client.query("ROLLBACK");
      res.status(400).json({ error: profileResult.error });
      return;
    }

    await requireCarePlanAccess(profileResult.value.userId, req.context, client);
    const existing = await loadCurrentHealthPlan(profileResult.value.userId, req.context, client);
    if (!existing) {
      await client.query("ROLLBACK");
      res.status(404).json({ error: "Health plan not found" });
      return;
    }

    const requestedReviewStatus =
      req.body?.review_status === "reviewed"
        ? "reviewed"
        : req.body?.review_status === "draft"
          ? "draft"
          : existing.review_status === "reviewed"
            ? "reviewed"
            : "draft";
    const preserveReviewedMetadata = requestedReviewStatus === "reviewed" && req.body?.review_status !== "reviewed";
    const actionType = req.body?.review_status === "reviewed" ? "reviewed" : "edited";
    const predictiveContext = await loadHealthPlanPredictiveContext(profileResult.value.userId, scopeOrganizationId(req.context), client);
    const sourceSignals = assembleHealthPlanSourceSignals(profileResult.value.profile, predictiveContext);
    const criticalSignalIds = deriveCriticalHealthPlanSignalIds(profileResult.value.profile, predictiveContext, sourceSignals);
    const dataQualityGaps = buildHealthPlanDataQualityGaps({
      profile: profileResult.value.profile,
      predictiveContext,
      sourceSignals,
    });
    const followThrough = buildHealthPlanFollowThroughSummary({
      plan: existing,
      profile: profileResult.value.profile,
      predictiveContext,
    });
    const clinicalCautions = buildHealthPlanClinicalCautions({
      sourceSignals,
      followThrough,
    });
    const liveEvidenceSummary = buildHealthPlanLiveEvidenceSummary({
      medications: profileResult.value.profile?.medications || [],
      medicationActivity: profileResult.value.profile?.medicationActivity || null,
      checkins: profileResult.value.profile?.checkins || null,
      brainCoach: profileResult.value.profile?.brainCoach || null,
      sensors: profileResult.value.profile?.sensors || [],
      alerts: profileResult.value.profile?.alerts || [],
      recentOperationalEvents: profileResult.value.profile?.recentOperationalEvents || [],
    });
    const healthPlanHistory = await loadHealthPlanHistory(profileResult.value.userId, req.context, client);
    const longitudinalMemory = buildHealthPlanLongitudinalMemory({
      liveEvidenceSummary,
      history: healthPlanHistory,
    });
    const sectionDrift = buildHealthPlanSectionDrift({
      plan: existing,
      dataQualityGaps,
      followThrough,
    });
    const signalTriage = buildHealthPlanSignalTriage(sourceSignals, criticalSignalIds);
    const governance = buildHealthPlanGovernanceSnapshot({
      sourceSignals,
      signalTriage,
      criticalSignalIds,
      dataQualityGaps,
      followThrough,
      sectionDrift,
      feedbackEntries: existing.feedback_entries_json || [],
    });
    const inferredFeedbackSnapshot = buildStoredInferredFeedbackSnapshot(
      existing,
      profileResult.value.profile,
      predictiveContext,
      followThrough,
    );
    const reviewNote = nullIfBlank(req.body?.review_note);
    const reviewChecklist = preserveReviewedMetadata
      ? normalizeHealthPlanReviewChecklist(existing.review_checklist_json)
      : normalizeHealthPlanReviewChecklist(req.body?.review_checklist_json);
    const recommendationReviewDecisions = preserveReviewedMetadata
      ? normalizeHealthPlanRecommendationReviewDecisions(existing.recommendation_review_decisions_json)
      : normalizeHealthPlanRecommendationReviewDecisions(
        req.body?.recommendation_review_decisions_json ?? existing.recommendation_review_decisions_json,
      );
    const urgentReviewNoteRequired =
      requestedReviewStatus === "reviewed"
      && governance.reviewGovernance.review_required
      && governance.reviewGovernance.review_window === "today"
      && !preserveReviewedMetadata;
    if (urgentReviewNoteRequired && !reviewNote) {
      await client.query("ROLLBACK");
      res.status(400).json({ error: "review_note is required before marking an urgent health plan as reviewed" });
      return;
    }
    if (urgentReviewNoteRequired && !isHealthPlanReviewChecklistComplete(reviewChecklist, { clinicalCautions })) {
      await client.query("ROLLBACK");
      res.status(400).json({
        error: "review_checklist_json must confirm all urgent review checks before marking this plan as reviewed",
        missing_items: missingHealthPlanReviewChecklistItems(reviewChecklist, { clinicalCautions }),
      });
      return;
    }

    const saved = await saveHealthPlan(client, profileResult.value.userId, req.context, {
      action_type: actionType,
      language: req.body?.language || existing.language,
      review_status: requestedReviewStatus,
      escalation_grade: governance.reviewGovernance.escalation_grade,
      review_required: governance.reviewGovernance.review_required,
      review_window: governance.reviewGovernance.review_window,
      review_summary: governance.reviewGovernance.review_summary,
      review_reasons_json: governance.reviewGovernance.review_reasons_json,
      manual_override_reason: req.body?.manual_override_reason,
      summary_text: req.body?.summary_text,
      summary_signal_ids: req.body?.summary_signal_ids || existing.summary_signal_ids,
      goals_json: req.body?.goals_json,
      daily_support_json: req.body?.daily_support_json,
      monitoring_json: req.body?.monitoring_json,
      escalation_json: req.body?.escalation_json,
      caregiver_guidance_json: req.body?.caregiver_guidance_json,
      source_signals_json: sourceSignals,
      data_quality_gaps_json: dataQualityGaps,
      completed_improvement_actions_json: existing.completed_improvement_actions_json || [],
      feedback_entries_json: existing.feedback_entries_json || [],
      inferred_feedback_json: inferredFeedbackSnapshot,
      recent_operational_events: profileResult.value.profile?.recentOperationalEvents || [],
      live_evidence_summary: liveEvidenceSummary,
      longitudinal_memory: longitudinalMemory,
      follow_through: followThrough,
      section_drift: sectionDrift,
      critical_signal_ids: criticalSignalIds,
      generator_provider: existing.generator_provider,
      generator_model: existing.generator_model,
      generator_version: existing.generator_version,
      generated_by_user_id: existing.generated_by_user_id || req.context?.userId || null,
      generated_at: existing.generated_at,
      review_note: preserveReviewedMetadata ? existing.review_note : reviewNote,
      review_checklist_json: reviewChecklist,
      recommendation_review_decisions_json: recommendationReviewDecisions,
      reviewed_at: preserveReviewedMetadata ? existing.reviewed_at : undefined,
      reviewed_by_user_id: preserveReviewedMetadata ? existing.reviewed_by_user_id : undefined,
      reviewed_by_email: preserveReviewedMetadata ? existing.reviewed_by_email : undefined,
    });
    if (saved.error) {
      await client.query("ROLLBACK");
      res.status(400).json({ error: saved.error, ...(saved.review_blockers ? { review_blockers: saved.review_blockers } : {}) });
      return;
    }

    await client.query("COMMIT");
    res.json(saved.value);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}));

async function updateUserRoute(req, res) {
  const upstream = await requestVyvaBackend(`/api/v1/user-dashboard/users/${encodeURIComponent(req.params.id)}`, {
    method: req.method,
    body: scopedVyvaBackendBody(req.body, req.context),
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
    body: scopedVyvaBackendBody(req.body, req.context),
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
    body: scopedVyvaBackendBody(req.body, req.context),
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
    body: scopedVyvaBackendBody(req.body, req.context),
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
    query: scopedVyvaBackendQuery({}, req.context),
  });
  if (handleVyvaBackendResponse(res, upstream, 204)) return;

  sendWriteResult(res, await deleteMedication(req.params.med_id, req.context));
}));

app.post("/api/v1/user-dashboard/caregivers", asyncRoute(async (req, res) => {
  const upstream = await requestVyvaBackend("/api/v1/user-dashboard/caregivers", {
    method: "POST",
    body: scopedVyvaBackendBody(req.body, req.context),
  });
  if (handleVyvaBackendResponse(res, upstream, 201)) return;

  sendWriteResult(res, await createCaregiver(req.body, req.context), 201);
}));

app.put("/api/v1/user-dashboard/caregivers/:caregiver_id", asyncRoute(async (req, res) => {
  const upstream = await requestVyvaBackend(`/api/v1/user-dashboard/caregivers/${encodeURIComponent(req.params.caregiver_id)}`, {
    method: "PUT",
    body: scopedVyvaBackendBody(req.body, req.context),
  });
  if (handleVyvaBackendResponse(res, upstream)) return;

  sendWriteResult(res, await updateCaregiver(req.params.caregiver_id, req.body, req.context));
}));

app.delete("/api/v1/user-dashboard/caregivers/:caregiver_id", asyncRoute(async (req, res) => {
  const upstream = await requestVyvaBackend(`/api/v1/user-dashboard/caregivers/${encodeURIComponent(req.params.caregiver_id)}`, {
    method: "DELETE",
    query: scopedVyvaBackendQuery({}, req.context),
  });
  if (handleVyvaBackendResponse(res, upstream, 204)) return;

  sendWriteResult(res, await deleteCaregiver(req.params.caregiver_id, req.context));
}));

app.put("/api/v1/user-dashboard/health/:user_id", asyncRoute(async (req, res) => {
  const upstream = await requestVyvaBackend(`/api/v1/user-dashboard/health/${encodeURIComponent(req.params.user_id)}`, {
    method: "PUT",
    body: scopedVyvaBackendBody(req.body, req.context),
  });
  if (handleVyvaBackendResponse(res, upstream)) return;

  sendWriteResult(res, await upsertHealth(req.params.user_id, req.body, req.context));
}));

app.put("/api/v1/user-dashboard/checkins/:checkin_id", asyncRoute(async (req, res) => {
  const upstream = await requestVyvaBackend(`/api/v1/user-dashboard/checkins/${encodeURIComponent(req.params.checkin_id)}`, {
    method: "PUT",
    body: scopedVyvaBackendBody(req.body, req.context),
  });
  if (handleVyvaBackendResponse(res, upstream)) return;

  sendWriteResult(res, await updateCheckinConfig(req.params.checkin_id, req.body, req.context));
}));

app.put("/api/v1/user-dashboard/brain-coach/:user_id", asyncRoute(async (req, res) => {
  const upstream = await requestVyvaBackend(`/api/v1/user-dashboard/brain-coach/${encodeURIComponent(req.params.user_id)}`, {
    method: "PUT",
    body: scopedVyvaBackendBody(req.body, req.context),
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

  const payload = objectValue(req.body);
  const organizationHints = {
    organization_id: nullIfBlank(firstValue(payload.organization_id, payload.organizationId, req.get("x-organization-id"), req.query.organization_id, req.query.organizationId)),
    organization_slug: nullIfBlank(firstValue(payload.organization_slug, payload.organizationSlug, req.get("x-organization-slug"), req.query.organization_slug, req.query.organizationSlug)),
    organization_name: nullIfBlank(firstValue(payload.organization_name, payload.organizationName, req.get("x-organization-name"), req.query.organization_name, req.query.organizationName)),
  };
  const result = await ingestPhoneRegistration({ ...payload, ...Object.fromEntries(Object.entries(organizationHints).filter(([, value]) => value)) });
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
    let context = null;
    if (pool) {
      context = await resolveRequestContext(req);
      req.context = context;
    }
    const upstream = await requestVyvaBackend("/api/v1/checkins-dashboard/checkins", {
      query: scopedVyvaBackendQuery(req.query, context),
    });
    if (upstream?.ok) {
      const scopedPayload = filterExternalRoutinePayloadForOrganization(upstream.data, context);
      res.json(await overlayRoutineServicePayload(filterUpstreamCheckins(scopedPayload, mode), mode === "brain_coach" ? "brain_coach" : "checkin", context));
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

app.post("/api/v1/checkins/weekly-adherence", async (req, res, next) => {
  try {
    const userId = req.body?.user_id;
    const start = req.body?.date_start;
    const end = req.body?.date_end;
    if (!userId || !start || !end) {
      res.status(400).json({ error: "user_id, date_start, and date_end are required" });
      return;
    }
    let context = null;
    if (pool) {
      context = await resolveRequestContext(req);
      req.context = context;
    }

    const upstream = await requestVyvaBackend("/api/v1/checkins-dashboard/checkins", {
      query: scopedVyvaBackendQuery({
        user_id: userId,
        service_type: "all",
      }, context),
    });
    if (upstream?.ok) {
      const payload = filterUpstreamCheckins(upstream.data, "standard");
      const item = extractUpstreamList(payload, ["checkins", "data", "sessions"]).find((entry) =>
        scheduledSessionMatchesUser(entry, userId),
      );
      if (item) {
        res.json(buildCheckinAdherenceSchedule(item, start, end, userId));
        return;
      }
    }
    if (upstream && upstream.status >= 400 && upstream.status < 500 && upstream.status !== 404) {
      res.status(upstream.status).json(upstream.data);
      return;
    }

    if (!pool) {
      res.json({ schedule: Object.fromEntries(datesBetween(start, end).map((date) => [dayName(date), []])), checkin: null });
      return;
    }

    if (!(await userBelongsToOrganization(userId, req.context))) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const checkins = await loadCheckins(req.context);
    const checkin = checkins.find((item) => String(item.user_id) === String(userId));
    if (!checkin) {
      res.json({ schedule: Object.fromEntries(datesBetween(start, end).map((date) => [dayName(date), []])), checkin: null });
      return;
    }

    res.json(buildCheckinAdherenceSchedule(checkin, start, end, userId));
  } catch (error) {
    next(error);
  }
});

app.get("/api/v1/brain-coach-dashboard/sessions", async (req, res, next) => {
  try {
    let context = null;
    if (pool) {
      context = await resolveRequestContext(req);
      req.context = context;
    }
    const upstream = await requestVyvaBackend("/api/v1/brain-coach-dashboard/sessions", {
      query: scopedVyvaBackendQuery(req.query, context),
    });
    if (upstream?.ok) {
      const scopedPayload = filterExternalRoutinePayloadForOrganization(upstream.data, context);
      res.json(await overlayRoutineServicePayload(scopedPayload, "brain_coach", context));
      return;
    }
    if (upstream && upstream.status >= 400 && upstream.status < 500 && upstream.status !== 404) {
      res.status(upstream.status).json(upstream.data);
      return;
    }

    const checkinsUpstream = await requestVyvaBackend("/api/v1/checkins-dashboard/checkins", {
      query: scopedVyvaBackendQuery(req.query, context),
    });
    if (checkinsUpstream?.ok) {
      const scopedPayload = filterExternalRoutinePayloadForOrganization(checkinsUpstream.data, context);
      res.json(await overlayRoutineServicePayload({ sessions: mapUpstreamBrainCoachSessions(scopedPayload) }, "brain_coach", context));
      return;
    }
    if (!pool) {
      dbUnavailable(res);
      return;
    }

    res.json({ sessions: await loadBrainCoachSessions(req.context) });
  } catch (error) {
    next(error);
  }
});

function normalizeBrainCoachReportPayload(payload, fallbackUserId) {
  const body = payload?.data && typeof payload.data === "object" && !Array.isArray(payload.data) ? payload.data : payload;
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;

  const user = body.user ?? body.client ?? body.vyva_user ?? null;
  const summary = body.summary ?? body.metrics ?? {};
  const sessions = extractUpstreamList(body, ["sessions", "session_history", "data"]);
  const performance = extractUpstreamList(body, ["performance", "score_trend", "trend"]);

  return {
    user: {
      id: String(user?.id ?? fallbackUserId ?? ""),
      name: user?.name ?? [user?.first_name, user?.last_name].filter(Boolean).join(" ").trim() ?? null,
      phone: user?.phone ?? user?.phone_number ?? null,
      city: user?.city ?? null,
    },
    summary: {
      averageScore: Number(summary.averageScore ?? summary.average_score ?? summary.avg_score ?? 0) || 0,
      sessionsCompleted: Number(summary.sessionsCompleted ?? summary.sessions_completed ?? summary.completed_sessions ?? sessions.length ?? 0) || 0,
      totalQuestions: Number(summary.totalQuestions ?? summary.total_questions ?? summary.questions_answered ?? 0) || 0,
      streakDays: Number(summary.streakDays ?? summary.streak_days ?? summary.streak ?? 0) || 0,
    },
    performance: performance.map((item) => ({
      date: item?.date ?? item?.created_at ?? item?.session_at ?? item?.completed_at ?? null,
      score: item?.score ?? item?.average_score ?? item?.avg_score ?? null,
    })),
    sessions: sessions.map((item, index) => ({
      id: item?.id ?? `brain-coach-session-${fallbackUserId}-${index}`,
      date: item?.date ?? item?.created_at ?? item?.session_at ?? item?.completed_at ?? item?.last_session_at ?? null,
      status: item?.status ?? item?.outcome ?? item?.last_outcome ?? null,
      score: item?.score ?? item?.average_score ?? item?.avg_score ?? null,
      questions: item?.questions ?? item?.question_count ?? item?.total_questions ?? null,
      durationMinutes: item?.duration_minutes ?? item?.durationMinutes ?? null,
    })),
  };
}

function buildBrainCoachReportFromSession(session, userId) {
  const lastDate =
    session?.lastOutcomeAt ??
    session?.last_outcome_at ??
    session?.lastSessionAt ??
    session?.last_session_at ??
    session?.last_status_at ??
    session?.lastCheckinAt ??
    session?.last_checkin_at ??
    null;
  const lastStatus = session?.lastOutcome ?? session?.last_outcome ?? session?.last_status ?? null;
  const hasSession = Boolean(lastDate || lastStatus);

  return {
    user: {
      id: String(session?.user_id ?? userId ?? ""),
      name: session?.userName ?? "Unknown",
      phone: session?.userPhone ?? null,
      city: session?.city ?? null,
    },
    summary: {
      averageScore: 0,
      sessionsCompleted: hasSession && ["completed", "confirmed", "success"].includes(String(lastStatus || "").toLowerCase()) ? 1 : 0,
      totalQuestions: 0,
      streakDays: 0,
    },
    performance: [],
    sessions: hasSession
      ? [{
          id: `brain-coach-last-${String(session?.user_id ?? userId ?? "unknown")}`,
          date: lastDate,
          status: lastStatus ?? "pending",
          score: null,
          questions: null,
          durationMinutes: null,
        }]
      : [],
  };
}

function parseBrainCoachDurationMinutes(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const match = String(value ?? "").match(/(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : null;
}

function parseBrainCoachPercent(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value <= 10 ? value * 10 : value;
  }
  const match = String(value ?? "").match(/(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : null;
}

function normalizeCaregiverBrainCoachReport({ stats, trend, history }, fallbackUserId, fallbackUser = null) {
  const sessions = Array.isArray(history?.sessions) ? history.sessions : [];
  const performance = Array.isArray(trend?.trend) ? trend.trend : [];

  return {
    user: {
      id: String(fallbackUser?.id ?? fallbackUserId ?? ""),
      name: fallbackUser?.name ?? fallbackUser?.userName ?? null,
      phone: fallbackUser?.phone ?? fallbackUser?.userPhone ?? null,
      city: fallbackUser?.city ?? null,
    },
    summary: {
      averageScore: Number(stats?.average_session_score ?? 0) || 0,
      sessionsCompleted: Number(stats?.total_sessions ?? sessions.length ?? 0) || 0,
      totalQuestions: Number(stats?.total_questions ?? sessions.reduce((sum, item) => sum + (Number(item?.Questions ?? item?.questions ?? 0) || 0), 0)) || 0,
      streakDays: Number(stats?.streak ?? 0) || 0,
    },
    performance: performance.map((item) => ({
      date: item?.date ?? item?.display_date ?? null,
      score: parseBrainCoachPercent(item?.score),
    })),
    sessions: sessions.map((item, index) => ({
      id: item?.session_id ?? item?.id ?? `brain-coach-session-${fallbackUserId}-${index}`,
      date: item?.date ?? item?.created_at ?? item?.session_at ?? null,
      status: item?.status ?? "completed",
      score: parseBrainCoachPercent(item?.accuracy ?? item?.score),
      questions: Number(item?.Questions ?? item?.questions ?? item?.question_count ?? 0) || 0,
      durationMinutes: parseBrainCoachDurationMinutes(item?.duration ?? item?.duration_minutes),
    })),
  };
}

async function loadCaregiverBrainCoachReport(userId, query = {}, fallbackUser = null, context = null) {
  const encodedUserId = encodeURIComponent(String(userId));
  const days = Number(query.days ?? 7) || 7;
  const reportQuery = scopedVyvaBackendQuery({ days }, context);
  const historyQuery = scopedVyvaBackendQuery({ days, limit: query.limit ?? 50, offset: query.offset ?? 0 }, context);
  const [stats, trend, history] = await Promise.all([
    requestVyvaBackend(`/api/v1/brain-coach/brain-coach-info/${encodedUserId}`, { query: reportQuery }),
    requestVyvaBackend(`/api/v1/brain-coach/cognitive-trend/${encodedUserId}`, { query: reportQuery }),
    requestVyvaBackend(`/api/v1/brain-coach/session-history/${encodedUserId}`, { query: historyQuery }),
  ]);

  if (!stats?.ok && !trend?.ok && !history?.ok) return null;

  return normalizeCaregiverBrainCoachReport({
    stats: stats?.ok ? stats.data : null,
    trend: trend?.ok ? trend.data : null,
    history: history?.ok ? history.data : null,
  }, userId, fallbackUser);
}

async function externalUserIdMatchesActiveOrganization(userId, context) {
  if (!context?.organization) return true;
  const externalId = String(userId || "").trim();
  if (!externalId) return false;

  const localMatch = await optionalRows(
    `
      SELECT id::text
      FROM public.vyva_users
      WHERE organization_id = $1
        AND (id::text = $2 OR external_user_id = $2)
      LIMIT 1
    `,
    [scopeOrganizationId(context), externalId],
  );
  if (localMatch[0]) return true;

  const upstream = await requestVyvaBackend("/api/v1/user-dashboard/users", {
    query: scopedVyvaBackendQuery({}, context),
  });
  if (!upstream?.ok) return true;
  const users = Array.isArray(upstream.data?.gisUsers) ? upstream.data.gisUsers : [];
  const user = users.find((item) => String(item?.id ?? "") === externalId);
  if (!user) return false;
  return externalUserMatchesOrganization(user, context.organization);
}

app.get("/api/v1/brain-coach-dashboard/users/:user_id/report", async (req, res, next) => {
  try {
    const userId = String(req.params.user_id || "");
    const encodedUserId = encodeURIComponent(userId);
    let context = null;
    if (pool) {
      try {
        context = await resolveRequestContext(req);
        req.context = context;
      } catch {
        context = null;
      }
    }
    if (context && !(await externalUserIdMatchesActiveOrganization(userId, context))) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    const candidatePaths = [
      `/api/v1/brain-coach-dashboard/users/${encodedUserId}/report`,
      `/api/v1/brain-coach-dashboard/users/${encodedUserId}/reports`,
      `/api/v1/brain-coach/reports/${encodedUserId}`,
      `/api/v1/cognitive-activity/${encodedUserId}`,
    ];

    for (const path of candidatePaths) {
      const upstream = await requestVyvaBackend(path, { query: scopedVyvaBackendQuery(req.query, context) });
      if (upstream?.ok) {
        const normalized = normalizeBrainCoachReportPayload(upstream.data, userId);
        if (normalized) {
          res.json(normalized);
          return;
        }
      }
    }

    let sessions = [];
    try {
      const upstreamSessions = await requestVyvaBackend("/api/v1/brain-coach-dashboard/sessions", {
        query: scopedVyvaBackendQuery(req.query, context),
      });
      if (upstreamSessions?.ok) sessions = mapUpstreamBrainCoachSessions(filterExternalRoutinePayloadForOrganization(upstreamSessions.data, context));
    } catch {
      sessions = [];
    }

    if (!sessions.length) {
      try {
        const checkinsUpstream = await requestVyvaBackend("/api/v1/checkins-dashboard/checkins", {
          query: scopedVyvaBackendQuery(req.query, context),
        });
        if (checkinsUpstream?.ok) sessions = mapUpstreamBrainCoachSessions(filterExternalRoutinePayloadForOrganization(checkinsUpstream.data, context));
      } catch {
        sessions = [];
      }
    }

    if (!sessions.length && context) {
      sessions = await loadBrainCoachSessions(context);
    }

    const session = sessions.find((item) => String(item.user_id) === userId);
    const caregiverReport = await loadCaregiverBrainCoachReport(userId, req.query, session, context);
    if (caregiverReport && ((caregiverReport.sessions?.length ?? 0) > 0 || (caregiverReport.summary?.sessionsCompleted ?? 0) > 0)) {
      res.json(caregiverReport);
      return;
    }

    res.json(buildBrainCoachReportFromSession(session, userId));
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

    let context = null;
    if (pool) {
      context = await resolveRequestContext(req);
      req.context = context;
    }

    const upstream = await requestVyvaBackend("/api/v1/medications/weekly-schedule", {
      method: "POST",
      body: scopedVyvaBackendBody(req.body, context),
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
    error: error.code === "23505" ? "Record already exists" : status >= 500 && !error.expose ? "Server error" : error.message,
    ...(error.details && typeof error.details === "object" ? error.details : {}),
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
  const dbState = pool ? "configured" : "missing database configuration";
  console.log(`RC admin server running in ${mode} on http://${host}:${port} with database ${dbState}`);

  if (pool) {
    initializeDatabase().catch((error) => {
      console.error("Database schema initialization failed after startup:", error);
    });
  }
});
