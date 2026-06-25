import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Brain,
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  HeartPulse,
  MessageCircle,
  Pencil,
  Phone,
  PhoneCall,
  Pill,
  Plus,
  RefreshCw,
  ShieldCheck,
  Target,
  Trash2,
  UserRound,
  Users,
  Volume2,
  Wifi,
  WifiOff,
  type LucideIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAdminRole } from "@/hooks/useAdminRole";
import { useActiveOrganizationId } from "@/hooks/useActiveOrganizationId";
import { toast } from "@/hooks/use-toast";
import { AssignCareProviderDialog } from "@/components/user/AssignCareProviderDialog";
import { EditCaregiverDialog } from "@/components/user/EditCaregiverDialog";
import { EditHealthDialog } from "@/components/user/EditHealthDialog";
import { EditHealthPlanDialog } from "@/components/user/EditHealthPlanDialog";
import { EditMedicationDialog } from "@/components/user/EditMedicationDialog";
import { EditSensorDialog } from "@/components/user/EditSensorDialog";
import { EditServiceDialog } from "@/components/user/EditServiceDialog";
import { EditUserDialog } from "@/components/user/EditUserDialog";
import { ApiError, apiFetch } from "@/lib/apiClient";
import { authBypassEnabled } from "@/lib/authMode";
import {
  getDemoProfileById,
  isDemoUserId,
  type OperationalChannel,
  type OperationalAlert,
  type OperationalCaregiver,
  type OperationalCareProviderAssignment,
  type OperationalConsent,
  type OperationalHealth,
  type OperationalHealthPlan,
  type OperationalMedication,
  type OperationalMedicationActivity,
  type OperationalProfileContext,
  type OperationalProfileResponse,
  type OperationalQueueUser,
  type OperationalHealthPlanRevision,
  type OperationalSensor,
  type OperationalService,
  type OperationalStatus,
} from "@/lib/operationalDemoData";
import { providerCoverageLabel, providerTypeKey } from "@/lib/careProviders";
import { buildHealthPlanDataQualityGaps } from "@/lib/healthPlanDataQualityGaps";
import { buildHealthPlanDecisionTrace } from "@/lib/healthPlanDecisionTrace";
import { buildHealthPlanConfidenceProfile } from "@/lib/healthPlanConfidenceProfile";
import { buildHealthPlanClinicalCautions, findHealthPlanClinicalCautionIssues } from "@/lib/healthPlanClinicalCautions";
import { buildHealthPlanEscalationGrade, buildHealthPlanReviewGovernance } from "@/lib/healthPlanEscalationGrade";
import { buildHealthPlanEvidencePack } from "@/lib/healthPlanEvidencePack";
import { buildHealthPlanBenchmarkAssessment } from "@/lib/healthPlanBenchmarkAssessment";
import { buildHealthPlanEvidenceConflicts, buildHealthPlanEvidenceHierarchy } from "@/lib/healthPlanEvidenceHierarchy";
import { buildHealthPlanFollowThroughSummary } from "@/lib/healthPlanFollowThrough";
import { buildHealthPlanFreshnessSnapshot } from "@/lib/healthPlanFreshness";
import { buildHealthPlanGenerationQuality } from "@/lib/healthPlanGenerationQuality";
import { buildHealthPlanLiveEvidenceSummary } from "@/lib/healthPlanLiveEvidenceSummary";
import { buildHealthPlanLongitudinalMemory } from "@/lib/healthPlanLongitudinalMemory";
import { buildHealthPlanOperationalCompleteness } from "@/lib/healthPlanOperationalCompleteness";
import { buildHealthPlanActionImpact } from "@/lib/healthPlanActionImpact";
import { buildHealthPlanRecommendationImpact } from "@/lib/healthPlanRecommendationImpact";
import { buildHealthPlanRecommendationHistory } from "@/lib/healthPlanRecommendationHistory";
import { buildHealthPlanReadiness } from "@/lib/healthPlanReadiness";
import { buildHealthPlanReviewReadiness } from "@/lib/healthPlanReviewReadiness";
import { buildHealthPlanReviewRemediation } from "@/lib/healthPlanReviewRemediation";
import { buildHealthPlanRecommendationGrounding } from "@/lib/healthPlanRecommendationGrounding";
import { buildHealthPlanRecommendationEvidenceDiversity } from "@/lib/healthPlanRecommendationEvidenceDiversity";
import { buildHealthPlanRefreshStrategy } from "@/lib/healthPlanRefreshStrategy";
import { buildHealthPlanRecommendationCoverage } from "@/lib/healthPlanRecommendationCoverage";
import { buildHealthPlanRecommendationEffectiveness } from "@/lib/healthPlanRecommendationEffectiveness";
import { buildHealthPlanRecommendationChallenges } from "@/lib/healthPlanRecommendationChallenges";
import { buildHealthPlanRecommendationRepairBrief } from "@/lib/healthPlanRecommendationRepair";
import { buildHealthPlanGenerationBrief } from "@/lib/healthPlanGenerationBrief";
import { findHealthPlanGenerationBriefIssues } from "@/lib/healthPlanGenerationBriefCompliance";
import { buildHealthPlanTrustVerdict } from "@/lib/healthPlanTrustVerdict";
import {
  buildHealthPlanRecommendationReviewSummary,
  missingHealthPlanRecommendationReviewDecisions,
} from "@/lib/healthPlanRecommendationReview";
import { buildHealthPlanRecommendationRevisionMemory } from "@/lib/healthPlanRecommendationRevisionMemory";
import { buildHealthPlanRecommendationSurvivorship } from "@/lib/healthPlanRecommendationSurvivorship";
import { buildHealthPlanInferredFeedbackEntries } from "@/lib/healthPlanInferredFeedback";
import { buildHealthPlanInterventionMemory } from "@/lib/healthPlanInterventionMemory";
import { buildHealthPlanClientResponseMemory } from "@/lib/healthPlanClientResponseMemory";
import { buildHealthPlanOutcomeScores, buildHealthPlanRecommendationOutcomeMemory, buildHealthPlanSignalPreferenceWeights } from "@/lib/healthPlanOutcomeScores";
import { buildHealthPlanOutcomePatternMemory } from "@/lib/healthPlanOutcomePatternMemory";
import { buildHealthPlanImprovementActions } from "@/lib/healthPlanImprovementActions";
import { buildHealthPlanQualityMemory } from "@/lib/healthPlanQualityMemory";
import { buildHealthPlanReviewPriorities } from "@/lib/healthPlanReviewPriorities";
import { buildHealthPlanRecommendationSourceRanking } from "@/lib/healthPlanRecommendationSourceRanking";
import { buildHealthPlanSignalTriage } from "@/lib/healthPlanSignalTriage";
import { buildHealthPlanExecutionBrief } from "@/lib/healthPlanExecutionBrief";
import {
  buildHealthPlanLifeSafetyReviewItems,
  missingHealthPlanReviewChecklistItems,
  normalizeHealthPlanReviewChecklist,
} from "@/lib/healthPlanReviewChecklist";
import { buildHealthPlanSectionDrift } from "@/lib/healthPlanSectionDrift";
import { cn } from "@/lib/utils";

function interpolate(template: string, values: Record<string, string | number | undefined>) {
  return Object.entries(values).reduce(
    (value, [key, replacement]) => value.replaceAll(`{${key}}`, String(replacement ?? "")),
    template,
  );
}

function getAge(dateOfBirth?: string | null) {
  if (!dateOfBirth) return undefined;
  const birth = new Date(dateOfBirth);
  if (Number.isNaN(birth.getTime())) return undefined;
  return Math.floor((Date.now() - birth.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
}

function getInitials(firstName?: string | null, lastName?: string | null) {
  return `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase() || "VP";
}

function safeArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value.filter((item): item is T => item !== null && item !== undefined) : [];
}

function safeRecord<T extends Record<string, unknown>>(value: unknown): T | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as T) : null;
}

function stringValue(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function readableStringValue(value: unknown): string | null {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value).trim() || null;
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return (
      readableStringValue(record.label) ??
      readableStringValue(record.name) ??
      readableStringValue(record.value) ??
      readableStringValue(record.condition) ??
      readableStringValue(record.text) ??
      readableStringValue(record.title)
    );
  }

  return null;
}

function normalizeStringList(value: unknown): string[] {
  const source = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[,\n;]/)
      : [];

  return Array.from(
    new Set(
      source
        .map((item) => readableStringValue(item))
        .filter((item): item is string => Boolean(item)),
    ),
  );
}

function optionalProfileString(value: unknown): string | null {
  return readableStringValue(value);
}

function normalizeTranslationKey(value: unknown, fallback: string): string {
  return optionalProfileString(value) ?? fallback;
}

function normalizeOperationalChannel(value: unknown, fallback: OperationalChannel): OperationalChannel {
  const normalized = optionalProfileString(value)?.toLowerCase();
  if (normalized === "phone" || normalized === "whatsapp" || normalized === "app") return normalized;
  return fallback;
}

function normalizeOperationalStatus(value: unknown, fallback: OperationalStatus): OperationalStatus {
  const normalized = optionalProfileString(value)?.toLowerCase();
  if (normalized === "urgent" || normalized === "review" || normalized === "stable") return normalized;
  return fallback;
}

function normalizeOperationalAge(value: unknown, fallback?: number): number | undefined {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) return Math.floor(value);
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed >= 0) return Math.floor(parsed);
  }
  return fallback;
}

function normalizeDateValue(value: unknown, fallback?: string | null): string | null | undefined {
  const candidate = optionalProfileString(value);
  if (candidate) {
    const date = new Date(candidate);
    if (!Number.isNaN(date.getTime())) return candidate;
  }
  return fallback;
}

function normalizeOperationalContext(
  value: unknown,
  fallback: OperationalProfileContext,
): OperationalProfileContext {
  if (!value || typeof value !== "object" || Array.isArray(value)) return fallback;
  const record = value as Record<string, unknown>;

  return {
    age: normalizeOperationalAge(record.age, fallback.age),
    assignedTo: optionalProfileString(record.assignedTo) ?? fallback.assignedTo ?? null,
    familyConsentKey: normalizeTranslationKey(record.familyConsentKey, fallback.familyConsentKey ?? "profile.familyConsentUnknown"),
    preferredChannel: normalizeOperationalChannel(record.preferredChannel, fallback.preferredChannel),
    lastContactKey: normalizeTranslationKey(record.lastContactKey, fallback.lastContactKey ?? "profile.lastContactUnknown"),
    lastContactAt: normalizeDateValue(record.lastContactAt, fallback.lastContactAt ?? null) ?? null,
    lastContactStatus: optionalProfileString(record.lastContactStatus) ?? fallback.lastContactStatus ?? null,
    livingContextKey: normalizeTranslationKey(record.livingContextKey, fallback.livingContextKey ?? "profile.livingContextUnknown"),
    nextActionKey: normalizeTranslationKey(record.nextActionKey, fallback.nextActionKey ?? "usersList.nextAction.review"),
    noResponse: typeof record.noResponse === "boolean" ? record.noResponse : fallback.noResponse,
    reasonKey: normalizeTranslationKey(record.reasonKey, fallback.reasonKey),
    riskStatus: normalizeOperationalStatus(record.riskStatus, fallback.riskStatus),
    summaryKey: normalizeTranslationKey(record.summaryKey, fallback.summaryKey),
    recentSignalKeys: normalizeStringList(record.recentSignalKeys).length
      ? normalizeStringList(record.recentSignalKeys)
      : fallback.recentSignalKeys,
    recommendedQuestionKeys: normalizeStringList(record.recommendedQuestionKeys).length
      ? normalizeStringList(record.recommendedQuestionKeys)
      : fallback.recommendedQuestionKeys,
    suggestedOpeningKey: normalizeTranslationKey(record.suggestedOpeningKey, fallback.suggestedOpeningKey),
  };
}

function normalizeTimeList(value: unknown): string[] {
  const source = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[,\n;]/)
      : [];

  return source
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((time) => /^\d{2}:\d{2}$/.test(time));
}

function extractHealthPlanGenerationDiagnostics(error: unknown): HealthPlanGenerationDiagnosticsState | null {
  if (!(error instanceof ApiError) || !error.data || typeof error.data !== "object") return null;
  const payload = error.data as Record<string, unknown>;
  const readiness = payload.readiness && typeof payload.readiness === "object" ? payload.readiness : null;
  const acceptance = payload.acceptance && typeof payload.acceptance === "object" ? payload.acceptance : null;
  const code = typeof payload.code === "string" ? payload.code : null;
  if (!readiness && !acceptance && !code) return null;
  return {
    code,
    readiness: readiness as HealthPlanGenerationDiagnosticsState["readiness"],
    acceptance: acceptance as HealthPlanGenerationDiagnosticsState["acceptance"],
  };
}

function isHealthPlanSignalReviewError(error: unknown) {
  if (!(error instanceof ApiError) || !error.data || typeof error.data !== "object") return false;
  const payload = error.data as Record<string, unknown>;
  const code = typeof payload.code === "string" ? payload.code : "";
  return error.status === 409 && [
    "health_plan_readiness_blocked",
    "health_plan_signal_review_required",
  ].includes(code);
}

type HealthPlanRecommendationReviewDecisionState = {
  item_key?: string | null;
  item_id?: string | null;
  section_key?: string | null;
  section_label?: string | null;
  text?: string | null;
  decision_status?: "approved" | "watch" | "needs_edit" | null;
  rationale?: string | null;
  updated_at?: string | null;
  updated_by_user_id?: string | null;
  updated_by_email?: string | null;
};

type HealthPlanGenerationDiagnosticsState = {
  code?: string | null;
  readiness?: {
    overall_status?: "ready" | "guarded" | "blocked" | null;
    summary?: string | null;
    blocker_count?: number | null;
    caution_count?: number | null;
    blocking_reasons?: Array<{
      id?: string | null;
      label?: string | null;
      detail?: string | null;
      severity?: "high" | "medium" | "low" | null;
    }> | null;
    caution_reasons?: Array<{
      id?: string | null;
      label?: string | null;
      detail?: string | null;
      severity?: "high" | "medium" | "low" | null;
    }> | null;
    collection_actions?: Array<{
      id?: string | null;
      label?: string | null;
      action?: string | null;
      priority?: "high" | "medium" | "low" | null;
    }> | null;
  } | null;
  acceptance?: {
    overall_status?: "accepted" | "guarded" | "blocked" | null;
    summary?: string | null;
    blocker_count?: number | null;
    caution_count?: number | null;
    blocking_items?: Array<{
      type?: string | null;
      severity?: "high" | "medium" | "low" | null;
      message?: string | null;
      detail?: string | null;
      section_key?: string | null;
    }> | null;
    caution_items?: Array<{
      type?: string | null;
      severity?: "high" | "medium" | "low" | null;
      message?: string | null;
      detail?: string | null;
      section_key?: string | null;
    }> | null;
    generation_quality?: { overall_status?: "strong" | "guarded" | "fragile" | null } | null;
    operational_completeness?: { overall_status?: "strong" | "guarded" | "fragile" | null; issue_count?: number | null } | null;
    recommendation_coverage?: { overall_status?: "strong" | "guarded" | "fragile" | null } | null;
    recommendation_grounding?: { overall_status?: "strong" | "guarded" | "fragile" | null; fragile_count?: number | null } | null;
  } | null;
};

function providerFromCaregiver(caregiver: OperationalCaregiver): OperationalCareProviderAssignment {
  return {
    id: caregiver.assignment_id || caregiver.id,
    assignment_id: caregiver.assignment_id || caregiver.id,
    provider_type: "caregiver",
    provider_id: caregiver.care_provider_contact_id || caregiver.id,
    display_name: caregiver.caretaker_name,
    phone: caregiver.caretaker_phone,
    is_primary: caregiver.is_primary,
    relationship_label: caregiver.relationship_label,
    notes: caregiver.notes,
    active: true,
    created_at: caregiver.created_at,
  };
}

function careProvidersFromPayload(value: unknown, caregivers: OperationalCaregiver[]): OperationalCareProviderAssignment[] {
  const direct = safeArray<OperationalCareProviderAssignment>(value);
  if (direct.length > 0) return direct;

  if (value && typeof value === "object" && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    const nested = [
      ...safeArray<OperationalCareProviderAssignment>(record.providers),
      ...safeArray<OperationalCareProviderAssignment>(record.assignments),
      ...safeArray<OperationalCareProviderAssignment>(record.careProviders),
      ...safeArray<OperationalCareProviderAssignment>(record.emergencyContacts),
      ...safeArray<OperationalCareProviderAssignment>(record.redCrossStaff),
    ];

    if (nested.length > 0) return nested;
  }

  return caregivers.map(providerFromCaregiver);
}

function normalizeMedication(medication: OperationalMedication): OperationalMedication {
  const record = medication as OperationalMedication & Record<string, unknown>;
  return {
    ...medication,
    id: stringValue(record.id) ?? stringValue(record.medication_id) ?? stringValue(record.medication_name) ?? "medication",
    medication_name: stringValue(record.medication_name) ?? stringValue(record.name) ?? "Medication",
    schedule_times: normalizeTimeList(record.schedule_times ?? record.scheduleTimes ?? record.schedule_time),
  };
}

function profileStatusClasses(status: OperationalStatus) {
  switch (status) {
    case "urgent":
      return "bg-red-50 text-red-700 ring-red-200";
    case "review":
      return "bg-orange-50 text-orange-700 ring-orange-200";
    case "stable":
      return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  }
}

function channelIcon(channel: OperationalChannel) {
  if (channel === "whatsapp") return MessageCircle;
  if (channel === "app") return CheckCircle2;
  return PhoneCall;
}

function inferHealthPlanSignalStrength(signal?: { label?: string | null; detail?: string | null; strength?: string | null }) {
  const normalizedStrength = String(signal?.strength || "").trim().toLowerCase();
  if (["high", "medium", "low"].includes(normalizedStrength)) return normalizedStrength as "high" | "medium" | "low";
  const text = `${signal?.label || ""} ${signal?.detail || ""}`.toLowerCase();
  if (/(high|critical|urgent|active alert|offline|unconfirmed|missed|limited)/.test(text)) return "high";
  if (/(forecast|enabled|profile context|medication|sensor)/.test(text)) return "medium";
  return "low";
}

function formatDateTimeValue(date?: string | null) {
  if (!date) return "";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateTime(date?: string | null) {
  return formatDateTimeValue(date);
}

function healthPlanSignalBadgeClasses(strength?: "high" | "medium" | "low" | null) {
  if (strength === "high") return "border-red-200 bg-red-50 text-red-700";
  if (strength === "medium") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

function healthPlanGapSeverityClasses(severity?: "high" | "medium" | "low" | null) {
  if (severity === "high") return "border-red-200 bg-red-50 text-red-700";
  if (severity === "medium") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function healthPlanGapSeverityLabel(t: (key: string) => string, severity?: "high" | "medium" | "low" | null) {
  if (severity === "high") return t("profile.healthPlanGapHigh");
  if (severity === "medium") return t("profile.healthPlanGapMedium");
  return t("profile.healthPlanGapLow");
}

function healthPlanGapKindLabel(t: (key: string) => string, kind?: "missing" | "stale" | null) {
  if (kind === "stale") return t("profile.healthPlanGapKindStale");
  return t("profile.healthPlanGapKindMissing");
}

function healthPlanImprovePriorityLabel(t: (key: string) => string, priority?: "high" | "medium" | "low" | null) {
  if (priority === "high") return t("profile.healthPlanImprovePriorityHigh");
  if (priority === "medium") return t("profile.healthPlanImprovePriorityMedium");
  return t("profile.healthPlanImprovePriorityLow");
}

function healthPlanImprovePriorityClasses(priority?: "high" | "medium" | "low" | null) {
  if (priority === "high") return "border-rose-200 bg-rose-50 text-rose-700";
  if (priority === "medium") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function healthPlanFollowThroughTone(status?: "fresh" | "mixed" | "needs_review" | null) {
  if (status === "fresh") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "mixed") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-red-200 bg-red-50 text-red-700";
}

function healthPlanFollowThroughLabel(t: (key: string) => string, status?: "fresh" | "mixed" | "needs_review" | null) {
  if (status === "fresh") return t("profile.healthPlanFollowThroughFresh");
  if (status === "mixed") return t("profile.healthPlanFollowThroughMixed");
  return t("profile.healthPlanFollowThroughNeedsReview");
}

function healthPlanFreshnessTone(status?: "current" | "aging" | "stale" | "critical" | null) {
  if (status === "current") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "aging") return "border-sky-200 bg-sky-50 text-sky-700";
  if (status === "stale") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-rose-200 bg-rose-50 text-rose-700";
}

function healthPlanFreshnessLabel(t: (key: string) => string, status?: "current" | "aging" | "stale" | "critical" | null) {
  if (status === "current") return t("profile.healthPlanFreshnessCurrent");
  if (status === "aging") return t("profile.healthPlanFreshnessAging");
  if (status === "stale") return t("profile.healthPlanFreshnessStale");
  return t("profile.healthPlanFreshnessCritical");
}

function healthPlanGenerationStatusTone(status?: "strong" | "guarded" | "fragile" | null) {
  if (status === "strong") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "guarded") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-rose-200 bg-rose-50 text-rose-700";
}

function healthPlanGenerationStatusLabel(t: (key: string) => string, status?: "strong" | "guarded" | "fragile" | null) {
  if (status === "strong") return t("profile.healthPlanGenerationQualityStrong");
  if (status === "guarded") return t("profile.healthPlanGenerationQualityGuarded");
  return t("profile.healthPlanGenerationQualityFragile");
}

function healthPlanOperationalCompletenessTone(status?: "strong" | "guarded" | "fragile" | null) {
  if (status === "strong") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "guarded") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-rose-200 bg-rose-50 text-rose-700";
}

function healthPlanOperationalCompletenessLabel(t: (key: string) => string, status?: "strong" | "guarded" | "fragile" | null) {
  if (status === "strong") return t("profile.healthPlanOperationalCompletenessStrong");
  if (status === "guarded") return t("profile.healthPlanOperationalCompletenessGuarded");
  return t("profile.healthPlanOperationalCompletenessFragile");
}

function healthPlanActionImpactTone(status?: "reinforcing" | "mixed" | "contradicted" | "limited" | null) {
  if (status === "reinforcing") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "mixed") return "border-amber-200 bg-amber-50 text-amber-700";
  if (status === "contradicted") return "border-rose-200 bg-rose-50 text-rose-700";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function healthPlanActionImpactLabel(t: (key: string) => string, status?: "reinforcing" | "mixed" | "contradicted" | "limited" | null) {
  if (status === "reinforcing") return t("profile.healthPlanActionImpactReinforcing");
  if (status === "mixed") return t("profile.healthPlanActionImpactMixed");
  if (status === "contradicted") return t("profile.healthPlanActionImpactContradicted");
  return t("profile.healthPlanActionImpactLimited");
}

function normalizedRecommendationImpactStatus(status?: "reinforcing" | "reinforced" | "mixed" | "contradicted" | "limited" | null) {
  return status === "reinforced" ? "reinforcing" : status;
}

function healthPlanRecommendationImpactTone(status?: "reinforcing" | "reinforced" | "mixed" | "contradicted" | "limited" | null) {
  return healthPlanActionImpactTone(normalizedRecommendationImpactStatus(status));
}

function healthPlanRecommendationImpactLabel(t: (key: string) => string, status?: "reinforcing" | "reinforced" | "mixed" | "contradicted" | "limited" | null) {
  const normalized = normalizedRecommendationImpactStatus(status);
  if (normalized === "reinforcing") return t("profile.healthPlanRecommendationImpactReinforcing");
  if (normalized === "mixed") return t("profile.healthPlanRecommendationImpactMixed");
  if (normalized === "contradicted") return t("profile.healthPlanRecommendationImpactContradicted");
  return t("profile.healthPlanRecommendationImpactLimited");
}

function healthPlanRecommendationHistoryTone(status?: "supportive" | "mixed" | "deteriorating" | "limited" | null) {
  if (status === "supportive") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "mixed") return "border-amber-200 bg-amber-50 text-amber-700";
  if (status === "deteriorating") return "border-rose-200 bg-rose-50 text-rose-700";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function healthPlanRecommendationHistoryLabel(t: (key: string) => string, status?: "supportive" | "mixed" | "deteriorating" | "limited" | null) {
  if (status === "supportive") return t("profile.healthPlanRecommendationHistorySupportive");
  if (status === "mixed") return t("profile.healthPlanRecommendationHistoryMixed");
  if (status === "deteriorating") return t("profile.healthPlanRecommendationHistoryDeteriorating");
  return t("profile.healthPlanRecommendationHistoryLimited");
}

function healthPlanRecommendationTrendTone(status?: "improving" | "stable" | "deteriorating" | "volatile" | "limited" | null) {
  if (status === "improving" || status === "stable") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "volatile") return "border-amber-200 bg-amber-50 text-amber-700";
  if (status === "deteriorating") return "border-rose-200 bg-rose-50 text-rose-700";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function healthPlanRecommendationTrendLabel(t: (key: string) => string, status?: "improving" | "stable" | "deteriorating" | "volatile" | "limited" | null) {
  if (status === "improving") return t("profile.healthPlanRecommendationTrendImproving");
  if (status === "stable") return t("profile.healthPlanRecommendationTrendStable");
  if (status === "deteriorating") return t("profile.healthPlanRecommendationTrendDeteriorating");
  if (status === "volatile") return t("profile.healthPlanRecommendationTrendVolatile");
  return t("profile.healthPlanRecommendationTrendLimited");
}

function healthPlanEvidenceDiversityTone(status?: "strong" | "guarded" | "fragile" | null) {
  if (status === "strong") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "guarded") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-rose-200 bg-rose-50 text-rose-700";
}

function healthPlanEvidenceDiversityLabel(t: (key: string) => string, status?: "strong" | "guarded" | "fragile" | null) {
  if (status === "strong") return t("profile.healthPlanEvidenceDiversityStrong");
  if (status === "guarded") return t("profile.healthPlanEvidenceDiversityGuarded");
  return t("profile.healthPlanEvidenceDiversityFragile");
}

function healthPlanGenerationPathLabel(t: (key: string) => string, path?: "direct" | "repair" | "fallback" | null) {
  if (path === "repair") return t("profile.healthPlanGenerationPathRepair");
  if (path === "fallback") return t("profile.healthPlanGenerationPathFallback");
  return t("profile.healthPlanGenerationPathDirect");
}

function healthPlanCoverageTone(status?: "strong" | "guarded" | "fragile" | null) {
  if (status === "strong") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "guarded") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-rose-200 bg-rose-50 text-rose-700";
}

function healthPlanCoverageLabel(t: (key: string) => string, status?: "strong" | "guarded" | "fragile" | null) {
  if (status === "strong") return t("profile.healthPlanCoverageStrong");
  if (status === "guarded") return t("profile.healthPlanCoverageGuarded");
  return t("profile.healthPlanCoverageFragile");
}

function healthPlanGroundingTone(status?: "strong" | "guarded" | "fragile" | null) {
  if (status === "strong") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "guarded") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-rose-200 bg-rose-50 text-rose-700";
}

function healthPlanGroundingLabel(t: (key: string) => string, status?: "strong" | "guarded" | "fragile" | null) {
  if (status === "strong") return t("profile.healthPlanGroundingStrong");
  if (status === "guarded") return t("profile.healthPlanGroundingGuarded");
  return t("profile.healthPlanGroundingFragile");
}

function healthPlanBenchmarkTone(status?: "strong" | "guarded" | "fragile" | "unmatched" | null) {
  if (status === "strong") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "guarded") return "border-amber-200 bg-amber-50 text-amber-700";
  if (status === "fragile") return "border-rose-200 bg-rose-50 text-rose-700";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function healthPlanBenchmarkLabel(t: (key: string) => string, status?: "strong" | "guarded" | "fragile" | "unmatched" | null) {
  if (status === "strong") return t("profile.healthPlanBenchmarkStrong");
  if (status === "guarded") return t("profile.healthPlanBenchmarkGuarded");
  if (status === "fragile") return t("profile.healthPlanBenchmarkFragile");
  return t("profile.healthPlanBenchmarkUnmatched");
}

function healthPlanReplayGateTone(status?: "passed" | "failed" | null) {
  if (status === "passed") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "failed") return "border-rose-200 bg-rose-50 text-rose-700";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function healthPlanReplayGateLabel(t: (key: string) => string, status?: "passed" | "failed" | null) {
  if (status === "passed") return t("profile.healthPlanReplayPassed");
  if (status === "failed") return t("profile.healthPlanReplayFailed");
  return t("profile.healthPlanBenchmarkUnmatched");
}

function healthPlanBenchmarkDimensionLabel(id?: string | null) {
  if (id === "owner_clarity") return "Owner clarity";
  if (id === "fallback_completeness") return "Fallback completeness";
  if (id === "verification_clarity") return "Verification clarity";
  if (id === "urgency_calibration") return "Urgency calibration";
  if (id === "support_continuity") return "Support continuity";
  if (id === "caregiver_usability") return "Caregiver usability";
  return id || "-";
}

function healthPlanChallengeTone(status?: "supported" | "guarded" | "challenged" | null) {
  if (status === "supported") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "guarded") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-rose-200 bg-rose-50 text-rose-700";
}

function healthPlanChallengeLabel(t: (key: string) => string, status?: "supported" | "guarded" | "challenged" | null) {
  if (status === "supported") return t("profile.healthPlanChallengeSupported");
  if (status === "guarded") return t("profile.healthPlanChallengeGuarded");
  return t("profile.healthPlanChallengeChallenged");
}

function healthPlanChallengeEvidenceLabel(t: (key: string) => string, support?: "strong" | "mixed" | "thin" | null) {
  if (support === "strong") return t("profile.healthPlanChallengeEvidenceStrong");
  if (support === "mixed") return t("profile.healthPlanChallengeEvidenceMixed");
  return t("profile.healthPlanChallengeEvidenceThin");
}

function healthPlanReadinessTone(status?: "ready" | "guarded" | "blocked" | null) {
  if (status === "ready") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "guarded") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-rose-200 bg-rose-50 text-rose-700";
}

function healthPlanReadinessLabel(t: (key: string) => string, status?: "ready" | "guarded" | "blocked" | null) {
  if (status === "ready") return t("profile.healthPlanReadinessReady");
  if (status === "guarded") return t("profile.healthPlanReadinessGuarded");
  return t("profile.healthPlanReadinessBlocked");
}

type HealthPlanReadinessAction = {
  id?: string | null;
  label?: string | null;
  action?: string | null;
  priority?: "high" | "medium" | "low" | null;
};

type HealthPlanReadinessActionTarget = "profile" | "health" | "medication" | "checkin" | "brain" | "care" | "sensor" | "timeline" | null;

function healthPlanReadinessActionTarget(action?: HealthPlanReadinessAction | null): HealthPlanReadinessActionTarget {
  const text = [action?.id, action?.label, action?.action].filter(Boolean).join(" ").toLowerCase();
  if (!text) return null;
  if (/\b(medication|medicine|dose|dosage|pill|reminder|adherence)\b/.test(text)) return "medication";
  if (/\bbrain\b|brain coach|coach session/.test(text)) return "brain";
  if (/check-?in|call log|last contact|contact outcome|outreach/.test(text)) return "checkin";
  if (/\b(sensor|device|alert|fall detector|blood pressure|heart rate)\b/.test(text)) return "sensor";
  if (/care provider|caregiver|care coverage|family|support network|household/.test(text)) return "care";
  if (/\b(health|condition|mobility|diagnosis|clinical)\b/.test(text)) return "health";
  if (/\b(living|address|language|consent|profile|context|city)\b/.test(text)) return "profile";
  if (/\b(activity|timeline|history|event)\b/.test(text)) return "timeline";
  return null;
}

function speechLanguageCode(language?: string | null) {
  const normalized = String(language || "").trim().toLowerCase();
  if (normalized.startsWith("de") || normalized.includes("german")) return "de-DE";
  if (normalized.startsWith("es") || normalized.includes("spanish")) return "es-ES";
  return "en-US";
}

function shouldPauseHealthPlanGenerationForSignalReview() {
  return false;
}

function healthPlanReviewReadinessTone(status?: "ready" | "guarded" | "blocked" | null) {
  if (status === "ready") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "guarded") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-rose-200 bg-rose-50 text-rose-700";
}

function healthPlanReviewReadinessLabel(t: (key: string) => string, status?: "ready" | "guarded" | "blocked" | null) {
  if (status === "ready") return t("profile.healthPlanReviewReadinessReady");
  if (status === "guarded") return t("profile.healthPlanReviewReadinessGuarded");
  return t("profile.healthPlanReviewReadinessBlocked");
}

function healthPlanTrustTone(status?: string | null) {
  if (["trusted", "strong", "ready", "supportive", "clean"].includes(String(status || "").trim().toLowerCase())) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (["guarded", "mixed", "adjusted"].includes(String(status || "").trim().toLowerCase())) {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  return "border-rose-200 bg-rose-50 text-rose-700";
}

function healthPlanTrustLabel(t: (key: string) => string, status?: string | null) {
  const normalized = String(status || "").trim().toLowerCase();
  if (["trusted", "strong", "ready", "supportive", "clean"].includes(normalized)) return t("profile.healthPlanTrustTrusted");
  if (["guarded", "mixed", "adjusted"].includes(normalized)) return t("profile.healthPlanTrustGuarded");
  return t("profile.healthPlanTrustFragile");
}

function healthPlanEffectivenessTone(status?: "supportive" | "mixed" | "fragile" | null) {
  if (status === "supportive") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "mixed") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-rose-200 bg-rose-50 text-rose-700";
}

function healthPlanEffectivenessLabel(t: (key: string) => string, status?: "supportive" | "mixed" | "fragile" | null) {
  if (status === "supportive") return t("profile.healthPlanEffectivenessSupportive");
  if (status === "mixed") return t("profile.healthPlanEffectivenessMixed");
  return t("profile.healthPlanEffectivenessFragile");
}

function healthPlanRevisionMemoryTone(status?: "improved" | "preserved" | "unresolved" | "regressed" | null) {
  if (status === "improved") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "preserved") return "border-sky-200 bg-sky-50 text-sky-700";
  if (status === "unresolved") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-rose-200 bg-rose-50 text-rose-700";
}

function healthPlanRevisionMemoryLabel(t: (key: string) => string, status?: "improved" | "preserved" | "unresolved" | "regressed" | null) {
  if (status === "improved") return t("profile.healthPlanRevisionMemoryImproved");
  if (status === "preserved") return t("profile.healthPlanRevisionMemoryPreserved");
  if (status === "unresolved") return t("profile.healthPlanRevisionMemoryUnresolved");
  return t("profile.healthPlanRevisionMemoryRegressed");
}

function healthPlanRepairActionTone(action?: "preserve" | "rework" | "retire" | "verify" | null) {
  if (action === "preserve") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (action === "verify") return "border-amber-200 bg-amber-50 text-amber-700";
  if (action === "rework") return "border-orange-200 bg-orange-50 text-orange-700";
  return "border-rose-200 bg-rose-50 text-rose-700";
}

function healthPlanRepairActionLabel(t: (key: string) => string, action?: "preserve" | "rework" | "retire" | "verify" | null) {
  if (action === "preserve") return t("profile.healthPlanRepairPreserve");
  if (action === "verify") return t("profile.healthPlanRepairVerify");
  if (action === "rework") return t("profile.healthPlanRepairRework");
  return t("profile.healthPlanRepairRetire");
}

function healthPlanOperationalPatternTone(pattern?: "reinforcing" | "mixed" | "conflicting" | "limited" | null) {
  if (pattern === "reinforcing") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (pattern === "mixed") return "border-amber-200 bg-amber-50 text-amber-700";
  if (pattern === "conflicting") return "border-rose-200 bg-rose-50 text-rose-700";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function healthPlanOperationalPatternLabel(t: (key: string) => string, pattern?: "reinforcing" | "mixed" | "conflicting" | "limited" | null) {
  if (pattern === "reinforcing") return t("profile.healthPlanOperationalPatternReinforcing");
  if (pattern === "mixed") return t("profile.healthPlanOperationalPatternMixed");
  if (pattern === "conflicting") return t("profile.healthPlanOperationalPatternConflicting");
  return t("profile.healthPlanOperationalPatternLimited");
}

function healthPlanLiveEvidenceTone(status?: "stable" | "watch" | "pressure" | null) {
  if (status === "stable") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "watch") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-rose-200 bg-rose-50 text-rose-700";
}

function healthPlanLiveEvidenceLabel(t: (key: string) => string, status?: "stable" | "watch" | "pressure" | null) {
  if (status === "stable") return t("profile.healthPlanLiveEvidenceStable");
  if (status === "watch") return t("profile.healthPlanLiveEvidenceWatch");
  return t("profile.healthPlanLiveEvidencePressure");
}

function healthPlanLiveEvidenceTrendTone(trend?: "worsening" | "improving" | "mixed" | "steady" | null) {
  if (trend === "worsening") return "border-rose-200 bg-rose-50 text-rose-700";
  if (trend === "improving") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (trend === "mixed") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function healthPlanLiveEvidenceTrendLabel(
  t: (key: string) => string,
  trend?: "worsening" | "improving" | "mixed" | "steady" | null,
) {
  if (trend === "worsening") return t("profile.healthPlanLiveTrendWorsening");
  if (trend === "improving") return t("profile.healthPlanLiveTrendImproving");
  if (trend === "mixed") return t("profile.healthPlanLiveTrendMixed");
  return t("profile.healthPlanLiveTrendSteady");
}

function healthPlanLongitudinalLabel(
  t: (key: string) => string,
  status?: "persistent_pressure" | "recurrent_watch" | "stabilizing" | "limited_history" | null,
) {
  if (status === "persistent_pressure") return t("profile.healthPlanLongitudinalPersistent");
  if (status === "recurrent_watch") return t("profile.healthPlanLongitudinalRecurrent");
  if (status === "stabilizing") return t("profile.healthPlanLongitudinalStabilizing");
  return t("profile.healthPlanLongitudinalLimited");
}

function healthPlanLongitudinalTone(
  status?: "persistent_pressure" | "recurrent_watch" | "stabilizing" | "limited_history" | null,
) {
  if (status === "persistent_pressure") return "border-rose-200 bg-rose-50 text-rose-700";
  if (status === "recurrent_watch") return "border-amber-200 bg-amber-50 text-amber-700";
  if (status === "stabilizing") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function healthPlanInterventionTone(status?: "helping" | "fragile" | "unproven" | null) {
  if (status === "helping") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "fragile") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function healthPlanInterventionLabel(t: (key: string) => string, status?: "helping" | "fragile" | "unproven" | null) {
  if (status === "helping") return t("profile.healthPlanInterventionHelping");
  if (status === "fragile") return t("profile.healthPlanInterventionFragile");
  return t("profile.healthPlanInterventionUnproven");
}

function healthPlanResponseAnchorTone(value?: "responsive" | "mostly_responsive" | "mixed" | "fragile" | "unreliable" | "unknown" | null) {
  if (value === "responsive" || value === "mostly_responsive") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (value === "fragile" || value === "unreliable") return "border-rose-200 bg-rose-50 text-rose-700";
  if (value === "mixed") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function healthPlanResponseAnchorLabel(
  t: (key: string) => string,
  value?: "responsive" | "mostly_responsive" | "mixed" | "fragile" | "unreliable" | "unknown" | null,
) {
  if (value === "responsive") return t("profile.healthPlanOutcomePatternResponsive");
  if (value === "mostly_responsive") return t("profile.healthPlanOutcomePatternMostlyResponsive");
  if (value === "mixed") return t("profile.healthPlanOutcomePatternMixed");
  if (value === "fragile") return t("profile.healthPlanOutcomePatternFragile");
  if (value === "unreliable") return t("profile.healthPlanOutcomePatternUnreliable");
  return t("profile.healthPlanOutcomePatternUnknown");
}

function healthPlanSurvivorshipTone(status?: "durable" | "emerging" | "fragile" | "retired" | null) {
  if (status === "durable") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "emerging") return "border-sky-200 bg-sky-50 text-sky-700";
  if (status === "fragile") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function healthPlanSurvivorshipLabel(t: (key: string) => string, status?: "durable" | "emerging" | "fragile" | "retired" | null) {
  if (status === "durable") return t("profile.healthPlanSurvivorshipDurable");
  if (status === "emerging") return t("profile.healthPlanSurvivorshipEmerging");
  if (status === "fragile") return t("profile.healthPlanSurvivorshipFragile");
  return t("profile.healthPlanSurvivorshipRetired");
}

function healthPlanOutcomeStatusTone(status?: "helping" | "mixed" | "fragile" | "unproven" | null) {
  if (status === "helping") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "mixed") return "border-sky-200 bg-sky-50 text-sky-700";
  if (status === "fragile") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function healthPlanOutcomeStatusLabel(t: (key: string) => string, status?: "helping" | "mixed" | "fragile" | "unproven" | null) {
  if (status === "helping") return t("profile.healthPlanOutcomeHelping");
  if (status === "mixed") return t("profile.healthPlanOutcomeMixed");
  if (status === "fragile") return t("profile.healthPlanOutcomeFragile");
  return t("profile.healthPlanOutcomeUnproven");
}

function healthPlanFeedbackFreshnessLabel(t: (key: string) => string, status?: "fresh" | "aging" | "stale" | null) {
  if (status === "fresh") return t("profile.healthPlanFeedbackFresh");
  if (status === "aging") return t("profile.healthPlanFeedbackAging");
  return t("profile.healthPlanFeedbackStale");
}

function healthPlanFeedbackFreshnessTone(status?: "fresh" | "aging" | "stale" | null) {
  if (status === "fresh") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "aging") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function healthPlanContradictionLabel(
  t: (key: string) => string,
  status?: "live_conflict" | "improving_against_feedback" | "section_conflict" | null,
) {
  if (status === "improving_against_feedback") return t("profile.healthPlanFeedbackImproving");
  return t("profile.healthPlanFeedbackConflict");
}

function healthPlanContradictionTone(status?: "live_conflict" | "improving_against_feedback" | "section_conflict" | null) {
  if (status === "improving_against_feedback") return "border-sky-200 bg-sky-50 text-sky-700";
  return "border-rose-200 bg-rose-50 text-rose-700";
}

function healthPlanTrajectoryLabel(
  t: (key: string) => string,
  value?: "strengthening" | "stable" | "watch" | "weakening" | "volatile" | "untested" | null,
) {
  if (value === "strengthening") return t("profile.healthPlanTrajectoryStrengthening");
  if (value === "stable") return t("profile.healthPlanTrajectoryStable");
  if (value === "watch") return t("profile.healthPlanTrajectoryWatch");
  if (value === "weakening") return t("profile.healthPlanTrajectoryWeakening");
  if (value === "volatile") return t("profile.healthPlanTrajectoryVolatile");
  return t("profile.healthPlanTrajectoryUntested");
}

function healthPlanTrajectoryTone(value?: "strengthening" | "stable" | "watch" | "weakening" | "volatile" | "untested" | null) {
  if (value === "strengthening" || value === "stable") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (value === "watch" || value === "volatile") return "border-amber-200 bg-amber-50 text-amber-700";
  if (value === "weakening") return "border-rose-200 bg-rose-50 text-rose-700";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function healthPlanReusePriorityLabel(
  t: (key: string) => string,
  value?: "preserve" | "refine" | "replace" | "verify" | null,
) {
  if (value === "preserve") return t("profile.healthPlanReusePreserve");
  if (value === "refine") return t("profile.healthPlanReuseRefine");
  if (value === "replace") return t("profile.healthPlanReuseReplace");
  return t("profile.healthPlanReuseVerify");
}

function healthPlanReusePriorityTone(value?: "preserve" | "refine" | "replace" | "verify" | null) {
  if (value === "preserve") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (value === "replace") return "border-rose-200 bg-rose-50 text-rose-700";
  if (value === "refine") return "border-sky-200 bg-sky-50 text-sky-700";
  return "border-amber-200 bg-amber-50 text-amber-700";
}

function healthPlanFeedbackSourceLabel(t: (key: string) => string, value?: string | null) {
  return value === "inferred_operational"
    ? t("profile.healthPlanFeedbackSourceObserved")
    : t("profile.healthPlanFeedbackSourceManual");
}

function healthPlanFeedbackOutcomeLabel(
  t: (key: string) => string,
  outcome?: "helped" | "mixed" | "did_not_help" | "needs_follow_up" | null,
) {
  if (outcome === "helped") return t("profile.healthPlanFeedbackHelped");
  if (outcome === "mixed") return t("profile.healthPlanFeedbackMixed");
  if (outcome === "did_not_help") return t("profile.healthPlanFeedbackDidNotHelp");
  return t("profile.healthPlanFeedbackNeedsFollowUp");
}

function healthPlanFeedbackNextActionLabel(
  t: (key: string) => string,
  value?: "preserve" | "verify" | "rework" | "retire" | null,
) {
  if (value === "preserve") return t("profile.healthPlanFeedbackNextActionPreserve");
  if (value === "verify") return t("profile.healthPlanFeedbackNextActionVerify");
  if (value === "rework") return t("profile.healthPlanFeedbackNextActionRework");
  return t("profile.healthPlanFeedbackNextActionRetire");
}

function healthPlanFeedbackNextActionTone(value?: "preserve" | "verify" | "rework" | "retire" | null) {
  if (value === "preserve") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (value === "retire") return "border-rose-200 bg-rose-50 text-rose-700";
  if (value === "rework") return "border-sky-200 bg-sky-50 text-sky-700";
  return "border-amber-200 bg-amber-50 text-amber-700";
}

function healthPlanFeedbackConfidenceLabel(
  t: (key: string) => string,
  value?: "high" | "medium" | "low" | null,
) {
  if (value === "high") return t("profile.healthPlanFeedbackConfidenceHigh");
  if (value === "low") return t("profile.healthPlanFeedbackConfidenceLow");
  return t("profile.healthPlanFeedbackConfidenceMedium");
}

function defaultHealthPlanFeedbackNextAction(outcome?: "helped" | "mixed" | "did_not_help" | "needs_follow_up" | null) {
  if (outcome === "helped") return "preserve";
  if (outcome === "mixed") return "rework";
  if (outcome === "did_not_help") return "retire";
  return "verify";
}

function copyItemFeedbackLabel(
  t: (key: string) => string,
  outcome?: "helped" | "mixed" | "did_not_help" | "needs_follow_up" | null,
) {
  return `${t("profile.healthPlanFeedbackInherited")} ${healthPlanFeedbackOutcomeLabel(t, outcome)}`;
}

function healthPlanDriftTone(status?: "fresh" | "mixed" | "needs_refresh" | null) {
  if (status === "fresh") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "mixed") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-red-200 bg-red-50 text-red-700";
}

function healthPlanDriftLabel(t: (key: string) => string, status?: "fresh" | "mixed" | "needs_refresh" | null) {
  if (status === "fresh") return t("profile.healthPlanDriftFresh");
  if (status === "mixed") return t("profile.healthPlanDriftMixed");
  return t("profile.healthPlanDriftNeedsRefresh");
}

function healthPlanConfidenceTone(status?: "strong" | "guarded" | "fragile" | null) {
  if (status === "strong") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "fragile") return "border-rose-200 bg-rose-50 text-rose-700";
  return "border-amber-200 bg-amber-50 text-amber-700";
}

function healthPlanConfidenceLabel(t: (key: string) => string, status?: "strong" | "guarded" | "fragile" | null) {
  if (status === "strong") return t("profile.healthPlanConfidenceStatusStrong");
  if (status === "fragile") return t("profile.healthPlanConfidenceStatusFragile");
  return t("profile.healthPlanConfidenceStatusGuarded");
}

function healthPlanCalibrationTone(status?: "clean" | "adjusted" | null) {
  if (status === "adjusted") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

function healthPlanCalibrationLabel(t: (key: string) => string, status?: "clean" | "adjusted" | null) {
  if (status === "adjusted") return t("profile.healthPlanCalibrationAdjusted");
  return t("profile.healthPlanCalibrationClean");
}

function healthPlanRecommendationPriorityClasses(priority?: string | null) {
  if (priority === "high") return "border-red-200 bg-red-50 text-red-700";
  if (priority === "medium") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function healthPlanRecommendationTimingClasses(timing?: string | null) {
  if (timing === "today") return "border-violet-200 bg-violet-50 text-violet-700";
  if (timing === "this_week") return "border-sky-200 bg-sky-50 text-sky-700";
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

function healthPlanRecommendationPriorityLabel(
  t: (key: string) => string,
  priority?: "high" | "medium" | "low" | null,
) {
  if (priority === "high") return t("profile.healthPlanRecommendationHigh");
  if (priority === "medium") return t("profile.healthPlanRecommendationMedium");
  return t("profile.healthPlanRecommendationLow");
}

function healthPlanRecommendationConfidenceLabel(
  t: (key: string) => string,
  confidence?: "high" | "medium" | "low" | null,
) {
  if (confidence === "high") return t("profile.healthPlanConfidenceHigh");
  if (confidence === "medium") return t("profile.healthPlanConfidenceMedium");
  return t("profile.healthPlanConfidenceLow");
}

function healthPlanRecommendationTimingLabel(
  t: (key: string) => string,
  timing?: "today" | "this_week" | "ongoing" | null,
) {
  if (timing === "today") return t("profile.healthPlanTimingToday");
  if (timing === "this_week") return t("profile.healthPlanTimingThisWeek");
  return t("profile.healthPlanTimingOngoing");
}

function healthPlanExecutionBriefTone(status?: "same_day" | "this_week" | "routine" | string | null) {
  if (status === "same_day") return "border-rose-200 bg-rose-50 text-rose-700";
  if (status === "this_week") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

function healthPlanExecutionBriefLabel(
  t: (key: string) => string,
  status?: "same_day" | "this_week" | "routine" | string | null,
) {
  if (status === "same_day") return t("profile.healthPlanExecutionSameDay");
  if (status === "this_week") return t("profile.healthPlanExecutionThisWeek");
  return t("profile.healthPlanExecutionRoutine");
}

function channelKey(channel: OperationalChannel) {
  if (channel === "whatsapp") return "profile.channel.whatsApp";
  if (channel === "app") return "profile.channel.app";
  return "profile.channel.phone";
}

function sensorTypeKey(type?: string | null) {
  switch (type) {
    case "heart_rate":
      return "profile.sensor.heartRate";
    case "blood_pressure":
      return "profile.sensor.bloodPressure";
    case "fall_detector":
      return "profile.sensor.fallDetector";
    case "activity_monitor":
      return "profile.sensor.activityMonitor";
    default:
      return "profile.sensor.device";
  }
}

function recordString(record: Record<string, unknown> | undefined | null, keys: string[]) {
  if (!record) return null;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return null;
}

function recordDate(record: Record<string, unknown> | undefined | null, keys: string[]) {
  const value = recordString(record, keys);
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : value;
}

function isServicePaused(service: Record<string, unknown> | undefined | null) {
  if (!service) return false;
  if (service.is_paused === true) return true;
  const pausedUntil = recordString(service, ["paused_until", "pausedUntil"]);
  return Boolean(pausedUntil && new Date(pausedUntil).getTime() > Date.now());
}

function livingContextKey(value?: string | null) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "alone") return "usersList.livingAlone";
  if (normalized === "partner") return "usersList.livingWithPartner";
  if (normalized === "family") return "usersList.livingWithFamily";
  return null;
}

type HealthPlanReviewChecklistKey =
  | "reachability_confirmed"
  | "medication_risk_checked"
  | "escalation_path_confirmed"
  | "next_touchpoint_confirmed";

type HealthPlanLifeSafetyChecklistState = Record<string, {
  confirmed: boolean;
  label: string | null;
  confirmed_at?: string | null;
  confirmed_by_user_id?: string | null;
  confirmed_by_email?: string | null;
}>;

type HealthPlanReviewChecklistAuditState = Record<string, {
  label: string | null;
  confirmed_at?: string | null;
  confirmed_by_user_id?: string | null;
  confirmed_by_email?: string | null;
}>;

type HealthPlanReviewChecklistState = Record<HealthPlanReviewChecklistKey, boolean> & {
  life_safety_confirmations: HealthPlanLifeSafetyChecklistState;
  confirmation_audit: HealthPlanReviewChecklistAuditState;
};

function emptyHealthPlanReviewChecklist(): HealthPlanReviewChecklistState {
  return {
    reachability_confirmed: false,
    medication_risk_checked: false,
    escalation_path_confirmed: false,
    next_touchpoint_confirmed: false,
    life_safety_confirmations: {},
    confirmation_audit: {},
  };
}

function normalizeHealthPlanReviewChecklistState(
  value: unknown,
  lifeSafetyItems: Array<{ caution_id: string; label: string }> = [],
): HealthPlanReviewChecklistState {
  const checklist = normalizeHealthPlanReviewChecklist(value) as Record<string, unknown>;
  const storedLifeSafetyConfirmations = checklist.life_safety_confirmations && typeof checklist.life_safety_confirmations === "object"
    ? checklist.life_safety_confirmations as Record<string, { confirmed?: boolean; label?: string | null; confirmed_at?: string | null; confirmed_by_user_id?: string | null; confirmed_by_email?: string | null }>
    : {};
  const storedConfirmationAudit = checklist.confirmation_audit && typeof checklist.confirmation_audit === "object"
    ? checklist.confirmation_audit as Record<string, { label?: string | null; confirmed_at?: string | null; confirmed_by_user_id?: string | null; confirmed_by_email?: string | null }>
    : {};
  const lifeSafetyConfirmations = Object.entries(storedLifeSafetyConfirmations).reduce<HealthPlanLifeSafetyChecklistState>((accumulator, [cautionId, entry]) => {
    if (!cautionId) return accumulator;
    accumulator[cautionId] = {
      confirmed: entry?.confirmed === true,
      label: entry?.label || null,
      confirmed_at: entry?.confirmed_at || null,
      confirmed_by_user_id: entry?.confirmed_by_user_id || null,
      confirmed_by_email: entry?.confirmed_by_email || null,
    };
    return accumulator;
  }, {});
  const confirmationAudit = Object.entries(storedConfirmationAudit).reduce<HealthPlanReviewChecklistAuditState>((accumulator, [itemKey, entry]) => {
    if (!itemKey) return accumulator;
    accumulator[itemKey] = {
      label: entry?.label || null,
      confirmed_at: entry?.confirmed_at || null,
      confirmed_by_user_id: entry?.confirmed_by_user_id || null,
      confirmed_by_email: entry?.confirmed_by_email || null,
    };
    return accumulator;
  }, {});

  for (const item of lifeSafetyItems) {
    if (!item.caution_id) continue;
    if (!lifeSafetyConfirmations[item.caution_id]) {
      lifeSafetyConfirmations[item.caution_id] = {
        confirmed: false,
        label: item.label,
        confirmed_at: null,
        confirmed_by_user_id: null,
        confirmed_by_email: null,
      };
      continue;
    }
    if (!lifeSafetyConfirmations[item.caution_id].label) {
      lifeSafetyConfirmations[item.caution_id].label = item.label;
    }
  }

  return {
    reachability_confirmed: checklist.reachability_confirmed === true,
    medication_risk_checked: checklist.medication_risk_checked === true,
    escalation_path_confirmed: checklist.escalation_path_confirmed === true,
    next_touchpoint_confirmed: checklist.next_touchpoint_confirmed === true,
    life_safety_confirmations: lifeSafetyConfirmations,
    confirmation_audit: confirmationAudit,
  };
}

function healthPlanReviewChecklistItems(t: (key: string) => string): Array<{ key: HealthPlanReviewChecklistKey; label: string }> {
  return [
    { key: "reachability_confirmed", label: t("profile.healthPlanReviewChecklistReachability") },
    { key: "medication_risk_checked", label: t("profile.healthPlanReviewChecklistMedication") },
    { key: "escalation_path_confirmed", label: t("profile.healthPlanReviewChecklistEscalationPath") },
    { key: "next_touchpoint_confirmed", label: t("profile.healthPlanReviewChecklistNextTouchpoint") },
  ];
}

function buildHealthPlanRecommendationReviewDrafts(summary: any): HealthPlanRecommendationReviewDecisionState[] {
  return safeArray(summary?.items).map((item) => ({
    item_key: item?.item_key || null,
    item_id: item?.item_id || null,
    section_key: item?.section_key || null,
    section_label: item?.section_label || null,
    text: item?.text || null,
    decision_status: item?.decision_status || null,
    rationale: item?.rationale || "",
    updated_at: item?.updated_at || null,
    updated_by_user_id: item?.updated_by_user_id || null,
    updated_by_email: item?.updated_by_email || null,
  }));
}

function healthPlanRecommendationReviewTone(status?: "ready" | "guarded" | "blocked" | null) {
  if (status === "blocked") return "border-rose-200 bg-rose-50 text-rose-700";
  if (status === "guarded") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

function healthPlanRecommendationReviewStatusLabel(
  t: (key: string) => string,
  status?: "approved" | "watch" | "needs_edit" | null,
) {
  if (status === "approved") return t("profile.healthPlanRecommendationReviewApproved");
  if (status === "watch") return t("profile.healthPlanRecommendationReviewWatch");
  if (status === "needs_edit") return t("profile.healthPlanRecommendationReviewNeedsEdit");
  return t("profile.healthPlanRecommendationReviewPending");
}

type DashboardUsersPayload = {
  users?: unknown;
  clients?: unknown;
  gisUsers?: unknown;
  data?: unknown;
  items?: unknown;
  records?: unknown;
  results?: unknown;
  rows?: unknown;
  list?: unknown;
  people?: unknown;
};

function dashboardUsersFromPayload(payload: unknown): OperationalQueueUser[] {
  const collect = (value: unknown, depth = 0): OperationalQueueUser[] => {
    if (Array.isArray(value)) return value as OperationalQueueUser[];
    if (!value || typeof value !== "object" || depth > 3) return [];

    const record = value as DashboardUsersPayload;
    return ["users", "clients", "gisUsers", "data", "items", "records", "results", "rows", "list", "people"].flatMap((key) =>
      collect(record[key as keyof DashboardUsersPayload], depth + 1),
    );
  };

  const seen = new Set<string>();
  return collect(payload).filter((user, index) => {
    const record = user as Record<string, unknown>;
    const stableId =
      cleanScalarString(record.id) ??
      cleanScalarString(record.user_id) ??
      cleanScalarString(record.userId) ??
      cleanScalarString(record.client_id) ??
      cleanScalarString(record.clientId) ??
      cleanScalarString(record.external_user_id) ??
      cleanScalarString(record.externalUserId) ??
      String(index);
    if (seen.has(stableId)) return false;
    seen.add(stableId);
    return true;
  });
}

function profileIdMatches(value: unknown, id: string) {
  return String(value ?? "").trim() === id.trim();
}

function queueUserMatchesProfileId(user: OperationalQueueUser, id: string) {
  const record = user as Record<string, unknown>;
  const nestedRecords = [record.user, record.client, record.person].filter(
    (value): value is Record<string, unknown> => Boolean(value) && typeof value === "object",
  );
  const candidateIds = [
    record.id,
    record.user_id,
    record.userId,
    record.profile_id,
    record.profileId,
    record.vyva_user_id,
    record.vyvaUserId,
    record.client_id,
    record.clientId,
    record.person_id,
    record.personId,
    record.external_user_id,
    record.externalUserId,
    record.external_id,
    record.externalId,
    record.source_id,
    record.sourceId,
    record.original_id,
    record.originalId,
    ...nestedRecords.flatMap((nested) => [
      nested.id,
      nested.user_id,
      nested.userId,
      nested.client_id,
      nested.clientId,
      nested.external_user_id,
      nested.externalUserId,
      nested.external_id,
      nested.externalId,
    ]),
  ];

  return candidateIds.some((value) => profileIdMatches(value, id));
}

function queueUserProfileId(record: Record<string, unknown>, routeId: string) {
  return (
    cleanScalarString(record.id) ??
    cleanScalarString(record.user_id) ??
    cleanScalarString(record.userId) ??
    cleanScalarString(record.profile_id) ??
    cleanScalarString(record.profileId) ??
    cleanScalarString(record.vyva_user_id) ??
    cleanScalarString(record.vyvaUserId) ??
    cleanScalarString(record.client_id) ??
    cleanScalarString(record.clientId) ??
    cleanScalarString(record.external_user_id) ??
    cleanScalarString(record.externalUserId) ??
    cleanScalarString(record.external_id) ??
    cleanScalarString(record.externalId) ??
    routeId
  );
}

function arrayFromQueueValue(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
    } catch {
      return value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    }
  }
  return [];
}

function nestedQueueRecord(record: Record<string, any>, key: string) {
  const value = record[key];
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, any>) : {};
}

function queueDateValue(record: Record<string, any>, ...keys: string[]) {
  for (const key of keys) {
    const value = cleanString(record[key]);
    if (value) return value;
  }
  return null;
}

function queueBooleanValue(record: Record<string, any>, key: string, fallback = false) {
  const value = record[key];
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return ["true", "1", "yes", "active"].includes(value.toLowerCase());
  if (typeof value === "number") return value > 0;
  return fallback;
}

function queuePrimaryCareProviderNames(record: Record<string, any>) {
  const careProviderNames = Array.isArray(record.careProviderNames)
    ? record.careProviderNames
    : Array.isArray(record.care_provider_names)
      ? record.care_provider_names
      : [];
  return careProviderNames.map(String).filter(Boolean);
}

function queueFirstNestedValue(record: Record<string, any>, ...paths: string[]) {
  for (const path of paths) {
    const parts = path.split(".");
    let current: unknown = record;
    for (const part of parts) {
      current =
        current && typeof current === "object"
          ? (current as Record<string, unknown>)[part]
          : undefined;
    }
    const cleaned = cleanString(current);
    if (cleaned) return cleaned;
  }
  return null;
}

function queuePreferredLanguage(record: Record<string, any>) {
  const language =
    cleanString(record.language) ??
    cleanString(record.preferred_language) ??
    cleanString(record.preferredLanguage) ??
    queueFirstNestedValue(record, "user.language", "client.language");
  return language ? language.toUpperCase() : undefined;
}

function queueProfileFallbackUser(record: Record<string, any>, id: string) {
  const nestedUser = nestedQueueRecord(record, "user");
  const nestedClient = nestedQueueRecord(record, "client");
  return {
    ...nestedClient,
    ...nestedUser,
    ...record,
    id: queueUserProfileId(record, id),
  };
}

function cleanString(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function cleanScalarString(value: unknown): string | null {
  return cleanString(value);
}

function cleanNumber(value: unknown): number | undefined {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : undefined;
}

function queueUserNameParts(user: OperationalQueueUser) {
  const record = user as Record<string, unknown>;
  const nestedUser = nestedQueueRecord(record as Record<string, any>, "user");
  const nestedClient = nestedQueueRecord(record as Record<string, any>, "client");
  const source = { ...nestedClient, ...nestedUser, ...record };
  const firstName = cleanString(source.first_name) ?? cleanString(source.firstName);
  const lastName = cleanString(source.last_name) ?? cleanString(source.lastName);
  if (firstName || lastName) return { firstName: firstName ?? "Client", lastName: lastName ?? "" };

  const fullName =
    cleanString(source.name) ??
    cleanString(source.full_name) ??
    cleanString(source.fullName) ??
    cleanString(source.displayName) ??
    "Client";
  const [first = "Client", ...rest] = fullName.split(/\s+/);
  return { firstName: first, lastName: rest.join(" ") };
}

function normalizeQueueChannel(value: unknown): OperationalChannel {
  return value === "whatsapp" || value === "app" || value === "phone" ? value : "phone";
}

function normalizeQueueStatus(value: unknown): OperationalStatus {
  return value === "urgent" || value === "review" || value === "stable" ? value : "stable";
}

function buildProfileFromQueueUser(user: OperationalQueueUser, id: string): OperationalProfileResponse {
  const record = queueProfileFallbackUser(user as Record<string, any>, id);
  const healthRecord = nestedQueueRecord(record, "health");
  const consentRecord = nestedQueueRecord(record, "consent");
  const operationalContextRecord =
    record.operationalContext && typeof record.operationalContext === "object"
      ? (record.operationalContext as Record<string, any>)
      : {};
  const { firstName, lastName } = queueUserNameParts(record as OperationalQueueUser);
  const now = new Date().toISOString();
  const phone =
    cleanString(record.phone) ??
    cleanString(record.phone_number) ??
    cleanString(record.phoneNumber) ??
    cleanString(record.mobile);
  const careProviderNames = queuePrimaryCareProviderNames(record);
  const primaryCaregiverName =
    cleanString(record.primaryCaregiverName) ??
    cleanString(record.primary_caregiver_name) ??
    careProviderNames[0] ??
    queueFirstNestedValue(record, "primaryCaregiver.name", "primary_caregiver.name");
  const primaryCaregiverPhone =
    cleanString(record.primaryCaregiverPhone) ??
    cleanString(record.primary_caregiver_phone) ??
    queueFirstNestedValue(record, "primaryCaregiver.phone", "primary_caregiver.phone");

  return {
    user: {
      ...record,
      id: queueUserProfileId(record, id),
      first_name: firstName,
      last_name: lastName,
      city: cleanString(record.city),
      created_at: cleanString(record.created_at) ?? cleanString(record.createdAt) ?? now,
      date_of_birth: cleanString(record.date_of_birth) ?? cleanString(record.dateOfBirth),
      emergency_notes: cleanString(record.emergency_notes) ?? cleanString(record.emergencyNotes),
      gender: cleanString(record.gender),
      house_number: cleanString(record.house_number) ?? cleanString(record.houseNumber),
      language: queuePreferredLanguage(record),
      living_context: cleanString(record.living_context) ?? cleanString(record.livingContext),
      phone,
      photo_url: cleanString(record.photo_url) ?? cleanString(record.photoUrl),
      post_code: cleanString(record.post_code) ?? cleanString(record.postCode) ?? cleanString(record.postal_code),
      street: cleanString(record.street),
    },
    consent: {
      consent_given: queueBooleanValue(consentRecord, "consent_given", queueBooleanValue(record, "consent_given", true)),
      caretaker_consent: queueBooleanValue(
        consentRecord,
        "caretaker_consent",
        queueBooleanValue(record, "caretaker_consent", false),
      ),
      created_at: cleanString(record.created_at) ?? now,
    },
    health: {
      health_conditions:
        arrayFromQueueValue(record.healthConditions).length > 0
          ? arrayFromQueueValue(record.healthConditions)
          : arrayFromQueueValue(record.health_conditions ?? healthRecord.health_conditions),
      mobility_needs:
        arrayFromQueueValue(record.mobilityNeeds).length > 0
          ? arrayFromQueueValue(record.mobilityNeeds)
          : arrayFromQueueValue(record.mobility_needs ?? healthRecord.mobility_needs),
    },
    medications: [],
    medicationActivity: null,
    healthPlan: null,
    healthPlanFeedback: null,
    healthPlanHistory: [],
    healthPlanBenchmarkReplay: null,
    checkins: null,
    brainCoach: null,
    careProviders: [],
    caregivers: primaryCaregiverName
      ? ([
          {
            id: `fallback-${id}-emergency-contact`,
            caretaker_name: primaryCaregiverName,
            caretaker_phone: primaryCaregiverPhone,
            relationship_label: "Emergency contact",
            is_primary: true,
            created_at: cleanString(record.created_at) ?? now,
          },
        ] as OperationalCaregiver[])
      : [],
    sensors: [],
    alerts: [],
    recentOperationalEvents: [],
    readings: [],
    operationalContext: {
      age: cleanNumber(operationalContextRecord.age ?? record.age),
      assignedTo: cleanString(operationalContextRecord.assignedTo ?? record.assigned_to ?? record.assignedTo),
      preferredChannel: normalizeQueueChannel(operationalContextRecord.preferredChannel ?? record.preferredChannel ?? record.channel),
      lastContactKey: cleanString(operationalContextRecord.lastContactKey ?? record.lastContactKey) ?? undefined,
      lastContactAt: cleanString(operationalContextRecord.lastContactAt ?? record.lastContactAt ?? record.checkinLastReportedAt),
      lastContactStatus: cleanString(operationalContextRecord.lastContactStatus ?? record.lastContactStatus ?? record.checkinLastStatus),
      livingContextKey: cleanString(operationalContextRecord.livingContextKey ?? record.livingContextKey) ?? "profile.livingContextUnknown",
      nextActionKey: cleanString(operationalContextRecord.nextActionKey ?? record.nextActionKey) ?? "profile.nextActionReview",
      noResponse: Boolean(operationalContextRecord.noResponse ?? record.noResponse),
      reasonKey: cleanString(operationalContextRecord.reasonKey ?? record.reasonKey) ?? "profile.reasonReview",
      riskStatus: normalizeQueueStatus(operationalContextRecord.riskStatus ?? record.riskStatus ?? record.risk_status),
      familyConsentKey: "profile.familyConsentUnknown",
      recentSignalKeys: ["profile.signalNoRecentAlerts"],
      recommendedQuestionKeys: [
        "profile.demo.question.safe",
        "profile.demo.question.support",
        "profile.demo.question.nextContact",
      ],
      suggestedOpeningKey: "profile.suggestedOpeningDefault",
      summaryKey: "profile.summaryDefault",
    },
    isPreviewDemo: false,
    can_edit_care_plan: false,
    can_edit_medications: false,
    can_edit_checkins: false,
    can_edit_brain_coach: false,
    edit_block_reason: "profile.detailFromClientFeed",
  };
}

async function fetchUserProfileFromDashboardList(
  id: string,
  organizationId?: string | null,
): Promise<OperationalProfileResponse | null> {
  const params = new URLSearchParams();
  if (organizationId) params.set("organization_id", organizationId);
  const suffix = params.toString() ? `?${params.toString()}` : "";
  const payload = await apiFetch<DashboardUsersPayload | OperationalQueueUser[]>(`/api/v1/user-dashboard/users${suffix}`);
  const match = dashboardUsersFromPayload(payload).find((user) => queueUserMatchesProfileId(user, id));
  return match ? buildProfileFromQueueUser(match, id) : null;
}

async function fetchUserProfile(id: string, organizationId?: string | null): Promise<OperationalProfileResponse> {
  if (isDemoUserId(id)) return getDemoProfileById(id);

  try {
    const params = new URLSearchParams({ user_id: id });
    if (organizationId) params.set("organization_id", organizationId);
    const response = await apiFetch<OperationalProfileResponse | null>(`/api/v1/user-dashboard/user-info?${params.toString()}`);

    if (response?.user) return response;

    const fallbackProfile = await fetchUserProfileFromDashboardList(id, organizationId).catch(() => null);
    if (fallbackProfile) return fallbackProfile;
    if (authBypassEnabled) return getDemoProfileById(id);
    throw new Error("Client profile was empty");
  } catch (error) {
    const fallbackProfile = await fetchUserProfileFromDashboardList(id, organizationId).catch(() => null);
    if (fallbackProfile) return fallbackProfile;
    if (authBypassEnabled) return getDemoProfileById(id);
    throw error;
  }
}

async function fetchHealthPlanHistory(id: string): Promise<OperationalHealthPlanRevision[]> {
  if (isDemoUserId(id)) return getDemoProfileById(id).healthPlanHistory || [];

  try {
    return await apiFetch<OperationalHealthPlanRevision[]>(`/api/v1/user-dashboard/users/${encodeURIComponent(id)}/health-plan/history`);
  } catch (error) {
    if (authBypassEnabled) return getDemoProfileById(id).healthPlanHistory || [];
    throw error;
  }
}

async function fetchHealthPlanHistoryReplay(id: string): Promise<Record<string, any> | null> {
  if (isDemoUserId(id)) return getDemoProfileById(id).healthPlanBenchmarkReplay || null;

  try {
    return await apiFetch<Record<string, any> | null>(`/api/v1/user-dashboard/users/${encodeURIComponent(id)}/health-plan/history-replay`);
  } catch (error) {
    if (authBypassEnabled) return getDemoProfileById(id).healthPlanBenchmarkReplay || null;
    throw error;
  }
}

export default function UserProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useLanguage();
  const { isAdmin } = useAdminRole();
  const organizationId = useActiveOrganizationId();
  const copy = (key: string, values: Record<string, string | number | undefined> = {}) => interpolate(t(key), values);

  const [profileTab, setProfileTab] = useState("overview");
  const [editUserOpen, setEditUserOpen] = useState(false);
  const [editHealthOpen, setEditHealthOpen] = useState(false);
  const [editMedOpen, setEditMedOpen] = useState(false);
  const [editMedTarget, setEditMedTarget] = useState<OperationalMedication | null>(null);
  const [editCaregiverOpen, setEditCaregiverOpen] = useState(false);
  const [editCaregiverTarget, setEditCaregiverTarget] = useState<OperationalCaregiver | null>(null);
  const [assignProviderOpen, setAssignProviderOpen] = useState(false);
  const [editCheckinOpen, setEditCheckinOpen] = useState(false);
  const [editBrainOpen, setEditBrainOpen] = useState(false);
  const [editSensorOpen, setEditSensorOpen] = useState(false);
  const [editSensorTarget, setEditSensorTarget] = useState<OperationalSensor | null>(null);
  const [editHealthPlanOpen, setEditHealthPlanOpen] = useState(false);
  const [addNoteOpen, setAddNoteOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [generatingHealthPlan, setGeneratingHealthPlan] = useState(false);
  const [refreshingHealthPlanSections, setRefreshingHealthPlanSections] = useState<string[]>([]);
  const [completingHealthPlanActionIds, setCompletingHealthPlanActionIds] = useState<string[]>([]);
  const [healthPlanFeedbackOpen, setHealthPlanFeedbackOpen] = useState(false);
  const [healthPlanFeedbackSectionKey, setHealthPlanFeedbackSectionKey] = useState<string | null>(null);
  const [healthPlanFeedbackItemId, setHealthPlanFeedbackItemId] = useState<string | null>(null);
  const [healthPlanFeedbackItemLabel, setHealthPlanFeedbackItemLabel] = useState<string | null>(null);
  const [healthPlanFeedbackOutcome, setHealthPlanFeedbackOutcome] = useState<"helped" | "mixed" | "did_not_help" | "needs_follow_up">("helped");
  const [healthPlanFeedbackNextAction, setHealthPlanFeedbackNextAction] = useState<"preserve" | "verify" | "rework" | "retire">("preserve");
  const [healthPlanFeedbackConfidence, setHealthPlanFeedbackConfidence] = useState<"high" | "medium" | "low">("medium");
  const [healthPlanFeedbackNote, setHealthPlanFeedbackNote] = useState("");
  const [savingHealthPlanFeedback, setSavingHealthPlanFeedback] = useState(false);
  const [healthPlanReviewOpen, setHealthPlanReviewOpen] = useState(false);
  const [healthPlanReviewNote, setHealthPlanReviewNote] = useState("");
  const [healthPlanReviewChecklist, setHealthPlanReviewChecklist] = useState<HealthPlanReviewChecklistState>(emptyHealthPlanReviewChecklist);
  const [healthPlanRecommendationReviewDrafts, setHealthPlanRecommendationReviewDrafts] = useState<HealthPlanRecommendationReviewDecisionState[]>([]);
  const [savingHealthPlanReview, setSavingHealthPlanReview] = useState(false);
  const [healthPlanError, setHealthPlanError] = useState<string | null>(null);
  const [healthPlanGenerationDiagnostics, setHealthPlanGenerationDiagnostics] = useState<HealthPlanGenerationDiagnosticsState | null>(null);
  const [insufficientHealthPlanSignalsOpen, setInsufficientHealthPlanSignalsOpen] = useState(false);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["vyva-user-profile", organizationId, id],
    queryFn: () => fetchUserProfile(id!, organizationId),
    enabled: Boolean(id && organizationId),
    retry: false,
  });
  const { data: healthPlanHistoryQuery = [] } = useQuery({
    queryKey: ["vyva-user-health-plan-history", organizationId, id],
    queryFn: () => fetchHealthPlanHistory(id!),
    enabled: Boolean(id && organizationId),
    retry: false,
  });
  const { data: healthPlanHistoryReplayQuery = null } = useQuery({
    queryKey: ["vyva-user-health-plan-history-replay", organizationId, id],
    queryFn: () => fetchHealthPlanHistoryReplay(id!),
    enabled: Boolean(id && organizationId),
    retry: false,
  });

  const invalidateHealthPlanQueries = async () => {
    await queryClient.invalidateQueries({ queryKey: ["vyva-user-profile"] });
    await queryClient.invalidateQueries({ queryKey: ["vyva-user-health-plan-history"] });
    await queryClient.invalidateQueries({ queryKey: ["vyva-user-health-plan-history-replay"] });
  };

  const handleOperationalAction = (descriptionKey: string) => {
    toast({
      title: t("profile.actionQueued"),
      description: t(descriptionKey),
    });
  };

  const handleDeleteMedication = async (medId: string) => {
    if (data?.isPreviewDemo) {
      handleOperationalAction("profile.previewNoWrite");
      return;
    }

    try {
      await apiFetch(`/api/v1/user-dashboard/medications/${medId}`, {
        method: "DELETE",
      });

      toast({ title: t("profile.medicationDeleted") });
      queryClient.invalidateQueries({ queryKey: ["vyva-user-profile"] });
    } catch (error) {
      toast({ title: t("profile.deleteFailed"), variant: "destructive" });
    }
  };

  const handleUnassignCareProvider = async (assignmentId: string) => {
    if (data?.isPreviewDemo) {
      handleOperationalAction("profile.previewNoWrite");
      return;
    }

    try {
      await apiFetch(`/api/v1/user-dashboard/care-provider-assignments/${assignmentId}`, {
        method: "DELETE",
      });

      toast({ title: t("careProviders.unassigned") });
      queryClient.invalidateQueries({ queryKey: ["vyva-user-profile"] });
      queryClient.invalidateQueries({ queryKey: ["gis-data"] });
      queryClient.invalidateQueries({ queryKey: ["care-providers"] });
    } catch (error) {
      toast({ title: t("profile.deleteFailed"), variant: "destructive" });
    }
  };

  const handleGenerateHealthPlan = async (regenerate = false, mode: "standard" | "cautious" = "standard") => {
    if (!id || !data?.user) return;
    if (shouldPauseHealthPlanGenerationForSignalReview()) {
      setHealthPlanError(null);
      setHealthPlanGenerationDiagnostics(null);
      setInsufficientHealthPlanSignalsOpen(true);
      return;
    }

    if (data.isPreviewDemo || authBypassEnabled) {
      handleOperationalAction("profile.previewNoWrite");
      return;
    }
    if (regenerate && !window.confirm(t("profile.healthPlanRegenerateConfirm"))) return;

    setGeneratingHealthPlan(true);
    setHealthPlanError(null);
    setHealthPlanGenerationDiagnostics(null);
    try {
      await apiFetch(`/api/v1/user-dashboard/users/${encodeURIComponent(data.user.id)}/health-plan/generate`, {
        method: "POST",
        body: JSON.stringify({ mode }),
        timeoutMs: 90000,
      });
      toast({ title: mode === "cautious" ? t("profile.healthPlanCautiousDraftGenerated") : regenerate ? t("profile.healthPlanRegenerated") : t("profile.healthPlanGenerated") });
      await invalidateHealthPlanQueries();
    } catch (error) {
      const message = error instanceof Error ? error.message : t("profile.healthPlanGenerationFailed");
      const diagnostics = extractHealthPlanGenerationDiagnostics(error);
      setHealthPlanGenerationDiagnostics(diagnostics);
      if (isHealthPlanSignalReviewError(error)) {
        setHealthPlanError(null);
        setInsufficientHealthPlanSignalsOpen(true);
        return;
      }
      setHealthPlanError(message);
      toast({
        title: t("profile.healthPlanGenerationFailed"),
        description: message,
        variant: "destructive",
      });
    } finally {
      setGeneratingHealthPlan(false);
    }
  };

  const handleRefreshHealthPlanSections = async (sectionKeys: string[]) => {
    if (!id || !data?.user || !healthPlan) return;
    if (data.isPreviewDemo || authBypassEnabled) {
      handleOperationalAction("profile.previewNoWrite");
      return;
    }

    const uniqueSections = [...new Set(sectionKeys.filter(Boolean))];
    if (!uniqueSections.length) return;

    setRefreshingHealthPlanSections(uniqueSections);
    setHealthPlanError(null);
    setHealthPlanGenerationDiagnostics(null);
    try {
      await apiFetch(`/api/v1/user-dashboard/users/${encodeURIComponent(data.user.id)}/health-plan/regenerate-sections`, {
        method: "POST",
        body: JSON.stringify({ sections: uniqueSections }),
        timeoutMs: 90000,
      });
      toast({
        title: uniqueSections.length > 1 ? t("profile.healthPlanSectionsRefreshed") : t("profile.healthPlanSectionRefreshed"),
      });
      await invalidateHealthPlanQueries();
    } catch (error) {
      const message = error instanceof Error ? error.message : t("profile.healthPlanSectionRefreshFailed");
      setHealthPlanGenerationDiagnostics(extractHealthPlanGenerationDiagnostics(error));
      setHealthPlanError(message);
      toast({
        title: t("profile.healthPlanSectionRefreshFailed"),
        description: message,
        variant: "destructive",
      });
    } finally {
      setRefreshingHealthPlanSections([]);
    }
  };

  const handleCompleteHealthPlanImprovementAction = async (actionId: string) => {
    if (!id || !data?.user || !healthPlan) return;
    if (data.isPreviewDemo || authBypassEnabled) {
      handleOperationalAction("profile.previewNoWrite");
      return;
    }
    if (!actionId) return;

    setCompletingHealthPlanActionIds((current) => [...new Set([...current, actionId])]);
    try {
      await apiFetch(`/api/v1/user-dashboard/users/${encodeURIComponent(data.user.id)}/health-plan/improvement-actions/complete`, {
        method: "POST",
        body: JSON.stringify({ action_id: actionId }),
      });
      toast({ title: t("profile.healthPlanImproveCompleted") });
      await invalidateHealthPlanQueries();
    } catch (error) {
      toast({
        title: t("profile.healthPlanImproveCompleteFailed"),
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    } finally {
      setCompletingHealthPlanActionIds((current) => current.filter((item) => item !== actionId));
    }
  };

  const openHealthPlanFeedbackDialog = (
    sectionKey: string,
    latestOutcome?: "helped" | "mixed" | "did_not_help" | "needs_follow_up" | null,
    latestNote?: string | null,
    itemId?: string | null,
    itemLabel?: string | null,
    latestRecommendedNextAction?: "preserve" | "verify" | "rework" | "retire" | null,
    latestConfidenceLevel?: "high" | "medium" | "low" | null,
  ) => {
    setHealthPlanFeedbackSectionKey(sectionKey);
    setHealthPlanFeedbackItemId(itemId || null);
    setHealthPlanFeedbackItemLabel(itemLabel || null);
    setHealthPlanFeedbackOutcome(latestOutcome || "helped");
    setHealthPlanFeedbackNextAction(latestRecommendedNextAction || defaultHealthPlanFeedbackNextAction(latestOutcome));
    setHealthPlanFeedbackConfidence(latestConfidenceLevel || "medium");
    setHealthPlanFeedbackNote(latestNote || "");
    setHealthPlanFeedbackOpen(true);
  };

  const handleSaveHealthPlanFeedback = async () => {
    if (!id || !data?.user || !healthPlanFeedbackSectionKey) return;
    if (data.isPreviewDemo || authBypassEnabled) {
      handleOperationalAction("profile.previewNoWrite");
      return;
    }

    setSavingHealthPlanFeedback(true);
    try {
      await apiFetch(`/api/v1/user-dashboard/users/${encodeURIComponent(data.user.id)}/health-plan/feedback`, {
        method: "POST",
        body: JSON.stringify({
          section_key: healthPlanFeedbackSectionKey,
          item_id: healthPlanFeedbackItemId || undefined,
          outcome: healthPlanFeedbackOutcome,
          recommended_next_action: healthPlanFeedbackNextAction,
          confidence_level: healthPlanFeedbackConfidence,
          note: healthPlanFeedbackNote.trim() || undefined,
        }),
      });
      toast({ title: t("profile.healthPlanFeedbackSaved") });
      setHealthPlanFeedbackOpen(false);
      setHealthPlanFeedbackSectionKey(null);
      setHealthPlanFeedbackItemId(null);
      setHealthPlanFeedbackItemLabel(null);
      setHealthPlanFeedbackNextAction("preserve");
      setHealthPlanFeedbackConfidence("medium");
      setHealthPlanFeedbackNote("");
      await invalidateHealthPlanQueries();
    } catch (error) {
      toast({
        title: t("profile.healthPlanFeedbackSaveFailed"),
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    } finally {
      setSavingHealthPlanFeedback(false);
    }
  };

  const openHealthPlanReviewDialog = () => {
    if (!healthPlan) return;
    setHealthPlanReviewNote(healthPlan.review_note || "");
    setHealthPlanReviewChecklist(normalizeHealthPlanReviewChecklistState(healthPlan.review_checklist_json, healthPlanLifeSafetyReviewItems));
    setHealthPlanRecommendationReviewDrafts(buildHealthPlanRecommendationReviewDrafts(healthPlanRecommendationReview));
    setHealthPlanReviewOpen(true);
  };

  const handleMarkHealthPlanReviewed = async () => {
    if (!id || !data?.user || !healthPlan) return;
    if (data.isPreviewDemo || authBypassEnabled) {
      handleOperationalAction("profile.previewNoWrite");
      return;
    }
    if (healthPlanReviewReadiness?.can_mark_reviewed === false) {
      const blocker = safeArray(healthPlanReviewReadiness?.blocking_items)[0];
      toast({
        title: t("profile.healthPlanReviewReadinessBlockedTitle"),
        description: blocker?.label || healthPlanReviewReadiness?.summary,
        variant: "destructive",
      });
      return;
    }
    if (healthPlanReviewGovernance.review_required && healthPlanReviewGovernance.review_window === "today" && !healthPlanReviewNote.trim()) {
      toast({
        title: t("profile.healthPlanReviewNoteRequiredTitle"),
        description: t("profile.healthPlanReviewNoteRequiredDescription"),
        variant: "destructive",
      });
      return;
    }
    if (healthPlanReviewGovernance.review_required && healthPlanReviewGovernance.review_window === "today") {
      const missingChecklistItems = missingHealthPlanReviewChecklistItems(healthPlanReviewChecklist, {
        clinicalCautions: healthPlanClinicalCautions,
      });
      if (missingChecklistItems.length > 0) {
        toast({
          title: t("profile.healthPlanReviewChecklistRequiredTitle"),
          description: t("profile.healthPlanReviewChecklistRequiredDescription"),
          variant: "destructive",
        });
        return;
      }
    }
    const missingRecommendationDecisions = missingHealthPlanRecommendationReviewDecisions(healthPlanRecommendationReviewDraftSummary);
    if (missingRecommendationDecisions.length > 0) {
      toast({
        title: t("profile.healthPlanRecommendationReviewRequiredTitle"),
        description: t("profile.healthPlanRecommendationReviewRequiredDescription"),
        variant: "destructive",
      });
      return;
    }
    if (healthPlanRecommendationReviewDraftSummary?.can_mark_reviewed === false) {
      const blocker = safeArray(healthPlanRecommendationReviewDraftSummary?.blocking_items)[0];
      toast({
        title: t("profile.healthPlanRecommendationReviewRequiredTitle"),
        description: blocker?.label || healthPlanRecommendationReviewDraftSummary?.summary || t("profile.healthPlanRecommendationReviewRequiredDescription"),
        variant: "destructive",
      });
      return;
    }

    try {
      setSavingHealthPlanReview(true);
      await apiFetch(`/api/v1/user-dashboard/users/${encodeURIComponent(data.user.id)}/health-plan`, {
        method: "PUT",
        body: JSON.stringify({
          language: healthPlan.language || user.language,
          review_status: "reviewed",
          review_note: healthPlanReviewNote.trim() || undefined,
          summary_text: healthPlan.summary_text,
          goals_json: healthPlan.goals_json || [],
          daily_support_json: healthPlan.daily_support_json || [],
          monitoring_json: healthPlan.monitoring_json || [],
          escalation_json: healthPlan.escalation_json || [],
          caregiver_guidance_json: healthPlan.caregiver_guidance_json || [],
          review_checklist_json: healthPlanReviewChecklist,
          recommendation_review_decisions_json: healthPlanRecommendationReviewDrafts.map((item) => ({
            item_key: item.item_key,
            item_id: item.item_id,
            section_key: item.section_key,
            section_label: item.section_label,
            text: item.text,
            decision_status: item.decision_status || undefined,
            rationale: item.rationale?.trim() || undefined,
          })),
        }),
      });
      toast({ title: t("profile.healthPlanMarkedReviewed") });
      await invalidateHealthPlanQueries();
      setHealthPlanReviewOpen(false);
      setHealthPlanRecommendationReviewDrafts([]);
    } catch (error) {
      toast({
        title: t("profile.healthPlanMarkReviewedFailed"),
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    } finally {
      setSavingHealthPlanReview(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-72 rounded-2xl" />
        <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
          <Skeleton className="h-80 rounded-2xl" />
          <Skeleton className="h-80 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-white px-6 py-16 text-center shadow-sm">
        <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-amber-600" />
        <p className="font-semibold text-foreground">Client profile could not load.</p>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
          {error instanceof Error && error.message
            ? error.message
            : "The client list is still available. Try reopening the profile or refresh the console."}
        </p>
        <Button variant="link" onClick={() => navigate("/users")}>
          {t("profile.backToPeople")}
        </Button>
      </div>
    );
  }

  if (!data?.user) {
    return (
      <div className="rounded-2xl border border-border bg-white px-6 py-16 text-center shadow-sm">
        <UserRound className="mx-auto mb-3 h-10 w-10 text-muted-foreground/60" />
        <p className="font-semibold text-foreground">{t("profile.notFound")}</p>
        <Button variant="link" onClick={() => navigate("/users")}>
          {t("profile.backToPeople")}
        </Button>
      </div>
    );
  }

  const { user } = data;
  const health = safeRecord<OperationalHealth>(data.health);
  const consent = safeRecord<OperationalConsent>(data.consent);
  const medications = safeArray<OperationalMedication>(data.medications).map(normalizeMedication);
  const caregivers = safeArray<OperationalCaregiver>(data.caregivers);
  const careProviders = careProvidersFromPayload(data.careProviders, caregivers);
  const emergencyContacts = careProviders.filter((provider) => provider.provider_type === "caregiver");
  const redCrossStaffProviders = careProviders.filter((provider) => provider.provider_type === "field_staff");
  const primaryCaregiver = careProviders.find((provider) => provider.provider_type === "caregiver" && provider.is_primary) ?? careProviders.find((provider) => provider.provider_type === "caregiver") ?? null;
  const primaryProfessional = careProviders.find((provider) => provider.provider_type === "field_staff" && provider.is_primary) ?? careProviders.find((provider) => provider.provider_type === "field_staff") ?? null;
  const additionalEmergencyContacts = emergencyContacts.filter((provider) => provider.id !== primaryCaregiver?.id);
  const sensors = safeArray<OperationalSensor>(data.sensors);
  const alerts = safeArray<OperationalAlert>(data.alerts);
  const recentOperationalEvents = safeArray(data.recentOperationalEvents);
  const checkins = safeRecord<OperationalService>(data.checkins);
  const brainCoach = safeRecord<OperationalService>(data.brainCoach);
  const medicationActivity = safeRecord<OperationalMedicationActivity>(data.medicationActivity);
  const healthPlan = safeRecord<OperationalHealthPlan>(data.healthPlan);
  const isPreviewDemo = Boolean(data.isPreviewDemo);
  const openAddNoteDialog = () => {
    setNoteDraft("");
    setAddNoteOpen(true);
  };
  const handleSaveProfileNote = async () => {
    const note = noteDraft.trim();
    if (!note) {
      toast({ title: t("profile.noteRequired"), variant: "destructive" });
      return;
    }
    if (isPreviewDemo || authBypassEnabled) {
      handleOperationalAction("profile.previewNoWrite");
      return;
    }

    setSavingNote(true);
    try {
      await apiFetch(`/api/v1/user-dashboard/users/${user.id}/notes`, {
        method: "POST",
        body: JSON.stringify({ note }),
      });
      toast({ title: t("profile.noteSaved") });
      setAddNoteOpen(false);
      setNoteDraft("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["vyva-user-profile"] }),
        queryClient.invalidateQueries({ queryKey: ["gis-data"] }),
      ]);
    } catch {
      toast({ title: t("profile.noteSaveFailed"), variant: "destructive" });
    } finally {
      setSavingNote(false);
    }
  };

  const userFirstName = optionalProfileString(user.first_name) ?? "";
  const userLastName = optionalProfileString(user.last_name) ?? "";
  const userCity = optionalProfileString(user.city);
  const fullName = [userFirstName, userLastName].filter(Boolean).join(" ").trim() || t("profile.unknownPerson");
  const firstName = userFirstName || fullName.split(" ")[0] || t("profile.unknownPerson");
  const activeAlerts = alerts.filter((alert) => !alert.resolved_at);
  const criticalAlerts = activeAlerts.filter((alert) => alert.severity === "critical").length;
  const warningAlerts = activeAlerts.filter((alert) => alert.severity === "warning").length;
  const healthConditions = normalizeStringList(health?.health_conditions);
  const mobilityNeeds = normalizeStringList(health?.mobility_needs);
  const fallbackContext: OperationalProfileContext = {
    age: getAge(user.date_of_birth),
    assignedTo: null,
    familyConsentKey: consent?.consent_given ? "profile.familyConsentActive" : "profile.familyConsentUnknown",
    preferredChannel: "phone",
    lastContactKey: "profile.lastContactUnknown",
    livingContextKey: livingContextKey(user.living_context) ?? "profile.livingContextUnknown",
    nextActionKey: "usersList.nextAction.review",
    reasonKey: criticalAlerts ? "queue.reason.default" : "profile.reasonReview",
    riskStatus: criticalAlerts ? "urgent" : warningAlerts ? "review" : "stable",
    summaryKey: "profile.summaryDefault",
    recentSignalKeys: activeAlerts.length ? activeAlerts.slice(0, 3).map((alert) => alert.message || "queue.reason.default") : ["profile.signalNoRecentAlerts"],
    recommendedQuestionKeys: ["profile.questionWellbeing", "profile.questionSupport", "profile.questionNextContact"],
    suggestedOpeningKey: "profile.suggestedOpeningDefault",
  };
  const context = normalizeOperationalContext(data.operationalContext, fallbackContext);

  const age = context.age ?? getAge(user.date_of_birth);
  const ChannelIcon = channelIcon(context.preferredChannel);
  const address = [
    optionalProfileString(user.street),
    optionalProfileString(user.house_number),
    optionalProfileString(user.post_code),
    userCity,
  ].filter(Boolean).join(" ");
  const assignedProviderLabel = context.assignedTo ?? primaryProfessional?.display_name ?? primaryCaregiver?.display_name ?? null;
  const healthScore = Math.max(0, Math.min(100, 100 - criticalAlerts * 20 - warningAlerts * 10 - healthConditions.length * 4));
  const services = [
    { key: "profile.service.checkins", active: Boolean(checkins?.enabled), icon: PhoneCall },
    { key: "profile.service.brainCoach", active: Boolean(brainCoach?.enabled), icon: Brain },
    { key: "profile.service.medications", active: medications.length > 0, icon: Pill },
    { key: "profile.service.caregivers", active: careProviders.length > 0, icon: Users },
    { key: "profile.service.sensors", active: sensors.length > 0, icon: Activity },
    { key: "profile.service.consent", active: Boolean(consent?.consent_given), icon: ShieldCheck },
  ];
  const servicesActive = services.filter((service) => service.active).length;

  const formatOutcomeLabel = (value?: string | null) => {
    if (!value) return t("checkin.outcomeUnknown");
    const normalized = String(value).trim().toLowerCase().replace(/\s+/g, "_");
    const key = `checkin.outcome.${normalized}`;
    const label = t(key);
    if (label !== key) return label;
    return normalized
      .replace(/_/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  };

  const scheduledTodayAt = (value?: string | null) => {
    if (!value) return null;
    const [hour, minute] = value.split(":").map((part) => Number(part));
    if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null;
    const date = new Date();
    date.setHours(hour, minute, 0, 0);
    return date;
  };

  const scheduledStatusFor = (date: Date) =>
    date.getTime() <= Date.now() ? t("checkin.outcomeMissedToday") : t("checkin.outcomeScheduledToday");

  const medicationScheduleTimes = (medication: OperationalMedication) =>
    Array.isArray(medication.schedule_times)
      ? medication.schedule_times.filter((time) => typeof time === "string" && /^\d{2}:\d{2}$/.test(time))
      : [];

  const latestMedicationReminderCandidate = () => {
    const candidates = medications
      .filter((medication) => medication.reminders_enabled !== false)
      .flatMap((medication) =>
        medicationScheduleTimes(medication).map((time) => ({
          medication,
          time,
          date: scheduledTodayAt(time),
        })),
      )
      .filter((candidate): candidate is { medication: OperationalMedication; time: string; date: Date } => Boolean(candidate.date));

    const due = candidates
      .filter((candidate) => candidate.date.getTime() <= Date.now())
      .sort((a, b) => b.date.getTime() - a.date.getTime())[0];
    if (due) return due;

    return candidates.sort((a, b) => a.date.getTime() - b.date.getTime())[0] || null;
  };

  const scheduledContactFallback = () => {
    const preferredTime = recordString(checkins, ["preferred_time", "preferredTime"]);
    const scheduledAt = scheduledTodayAt(preferredTime);
    const isEnabled = Boolean(checkins?.enabled ?? checkins?.is_active);
    if (!scheduledAt || !isEnabled) return t(context.lastContactKey ?? "profile.lastContactUnknown");
    const label = scheduledAt.getTime() <= Date.now()
      ? t("checkin.outcomeMissedToday")
      : t("checkin.outcomeScheduledToday");
    const time = new Intl.DateTimeFormat(undefined, { timeStyle: "short" }).format(scheduledAt);
    return `${label} - ${time}`;
  };

  const scheduledLastContactAt =
    context.lastContactAt ??
    recordDate(checkins, ["last_checkin_at", "lastCheckinAt", "last_completed_at", "lastCompletedAt", "last_call_at", "lastCallAt", "last_reported_at", "lastReportedAt", "last_status_at", "lastStatusAt"]);
  const scheduledLastContactStatus =
    context.lastContactStatus ??
    recordString(checkins, ["last_outcome", "lastOutcome", "last_status", "lastStatus", "outcome", "status"]);
  const lastContactValue = scheduledLastContactAt
    ? [formatDateTime(scheduledLastContactAt), scheduledLastContactStatus ? formatOutcomeLabel(scheduledLastContactStatus) : null].filter(Boolean).join(" - ")
    : scheduledContactFallback();

  const outcomeTone = (value?: string | null) => {
    const normalized = String(value || "").trim().toLowerCase();
    if (["missed", "failed", "escalated"].includes(normalized)) return "red";
    if (["confirmed", "completed", "taken"].includes(normalized)) return "teal";
    return "orange";
  };

  const eventTimeline = (() => {
    const events: { date?: string | null; label: string; detail?: string; tone: string; icon: LucideIcon }[] = [];
    if (user.created_at) events.push({ date: user.created_at, label: t("profile.timeline.onboarded"), detail: t("profile.timeline.onboardedDetail"), tone: "primary", icon: UserRound });
    if (checkins) {
      const lastDate = recordDate(checkins, ["last_checkin_at", "lastCheckinAt", "last_completed_at", "lastCompletedAt", "last_call_at", "lastCallAt", "last_reported_at", "lastReportedAt", "last_status_at", "lastStatusAt"]);
      if (lastDate) {
        const outcome = recordString(checkins, ["last_outcome", "lastOutcome", "last_status", "lastStatus", "outcome", "status"]);
        events.push({
          date: lastDate,
          label: t("profile.timeline.lastCheckin"),
          detail: formatOutcomeLabel(outcome),
          tone: outcomeTone(outcome),
          icon: CheckCircle2,
        });
      } else if (Boolean(checkins.enabled) && checkins.preferred_time) {
        const scheduledAt = scheduledTodayAt(checkins.preferred_time);
        if (scheduledAt) {
          const isMissed = scheduledAt.getTime() <= Date.now();
          events.push({
            date: scheduledAt.toISOString(),
            label: t("profile.timeline.lastCheckin"),
            detail: `${scheduledStatusFor(scheduledAt)} - ${checkins.preferred_time}`,
            tone: isMissed ? "red" : "orange",
            icon: PhoneCall,
          });
        }
      }
    }
    if (brainCoach) {
      const lastDate = recordDate(brainCoach, ["last_session_at", "lastSessionAt", "last_completed_at", "lastCompletedAt", "last_call_at", "lastCallAt", "last_reported_at", "lastReportedAt", "last_status_at", "lastStatusAt"]);
      if (lastDate) {
        const outcome = recordString(brainCoach, ["last_outcome", "lastOutcome", "last_status", "lastStatus", "outcome", "status"]);
        events.push({
          date: lastDate,
          label: t("profile.service.brainCoach"),
          detail: formatOutcomeLabel(outcome),
          tone: outcomeTone(outcome),
          icon: Brain,
        });
      } else if (Boolean(brainCoach.enabled) && brainCoach.preferred_time) {
        const scheduledAt = scheduledTodayAt(brainCoach.preferred_time);
        if (scheduledAt) {
          const isMissed = scheduledAt.getTime() <= Date.now();
          events.push({
            date: scheduledAt.toISOString(),
            label: t("profile.timeline.brainCoachSession"),
            detail: `${scheduledStatusFor(scheduledAt)} - ${brainCoach.preferred_time}`,
            tone: isMissed ? "red" : "orange",
            icon: Brain,
          });
        }
      }
    }
    if (medicationActivity) {
      const lastDate = recordDate(medicationActivity, ["occurred_at", "occurredAt", "reported_at", "reportedAt", "created_at", "scheduled_date", "scheduledDate"]);
      const medicationName = recordString(medicationActivity, ["medication_name", "medicationName"]);
      const status = recordString(medicationActivity, ["status", "last_status", "lastStatus"]);
      if (lastDate) {
        events.push({
          date: lastDate,
          label: t("profile.service.medications"),
          detail: [medicationName, formatOutcomeLabel(status)].filter(Boolean).join(" - "),
          tone: outcomeTone(status),
          icon: Pill,
        });
      }
    } else {
      const reminder = latestMedicationReminderCandidate();
      if (reminder) {
        const isDue = reminder.date.getTime() <= Date.now();
        events.push({
          date: reminder.date.toISOString(),
          label: t("profile.timeline.medicationReminder"),
          detail: [reminder.medication.medication_name, isDue ? t("checkin.outcome.unconfirmed") : t("checkin.outcome.pending"), reminder.time].filter(Boolean).join(" - "),
          tone: isDue ? "orange" : "primary",
          icon: Pill,
        });
      }
    }
    if (careProviders.length) {
      events.push({
        date: careProviders.map((provider) => recordDate(provider, ["updated_at", "created_at"])).filter(Boolean).sort().at(-1) || user.created_at,
        label: copy("profile.timeline.careCoverage", { count: careProviders.length }),
        detail: [primaryCaregiver?.display_name, primaryProfessional?.display_name].filter(Boolean).join(" · ") || t("careProviders.coverage"),
        tone: "primary",
        icon: Users,
      });
    }
    if (consent) {
      events.push({
        date: recordDate(consent, ["updated_at", "created_at"]) || user.created_at,
        label: t(consent.consent_given ? "profile.timeline.consentActive" : "profile.timeline.consentMissing"),
        detail: t("profile.timeline.consentDetail"),
        tone: consent.consent_given ? "teal" : "orange",
        icon: ShieldCheck,
      });
    }
    if (healthConditions.length || mobilityNeeds.length) {
      events.push({
        date: recordDate(health, ["updated_at", "created_at"]) || user.created_at,
        label: t("profile.timeline.healthProfile"),
        detail: copy("profile.timeline.healthProfileDetail", { conditions: healthConditions.length, mobility: mobilityNeeds.length }),
        tone: "pink",
        icon: HeartPulse,
      });
    }
    alerts.forEach((alert) => {
      if (alert.created_at) events.push({ date: alert.created_at, label: alert.message || t("profile.timeline.alert"), detail: alert.resolved_at ? t("profile.timeline.alertResolved") : t("profile.timeline.alertActive"), tone: alert.severity === "critical" ? "red" : "orange", icon: AlertTriangle });
    });

    return events
      .sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime())
      .slice(0, 8);
  })();

  const showAdminControls = isAdmin && !authBypassEnabled && !isPreviewDemo;
  const canEditProfile = !authBypassEnabled && !isPreviewDemo && Boolean(data.can_edit_care_plan ?? isAdmin);
  const canAssignProviders = !authBypassEnabled && !isPreviewDemo;
  const canEditMedications = !authBypassEnabled && !isPreviewDemo && Boolean(data.can_edit_medications ?? isAdmin);
  const canEditCheckins = !authBypassEnabled && !isPreviewDemo && Boolean(data.can_edit_checkins ?? isAdmin);
  const canEditBrainCoach = !authBypassEnabled && !isPreviewDemo && Boolean(data.can_edit_brain_coach ?? isAdmin);
  const canManageHealthPlan = canEditProfile;
  const handleHealthPlanReadinessAction = (action: HealthPlanReadinessAction) => {
    const target = healthPlanReadinessActionTarget(action);

    if (target === "medication") {
      setProfileTab("overview");
      if (canEditMedications) {
        setEditMedTarget(medications[0] ?? null);
        setEditMedOpen(true);
      }
      return;
    }

    if (target === "checkin") {
      setProfileTab("overview");
      if (canEditCheckins) setEditCheckinOpen(true);
      return;
    }

    if (target === "brain") {
      setProfileTab("overview");
      if (canEditBrainCoach) setEditBrainOpen(true);
      return;
    }

    if (target === "care") {
      setProfileTab("support");
      if (canAssignProviders) setAssignProviderOpen(true);
      return;
    }

    if (target === "sensor") {
      setProfileTab("support");
      if (showAdminControls) {
        setEditSensorTarget(sensors[0] ?? null);
        setEditSensorOpen(true);
      }
      return;
    }

    if (target === "health") {
      setProfileTab("overview");
      if (showAdminControls) setEditHealthOpen(true);
      return;
    }

    if (target === "profile") {
      setProfileTab("overview");
      if (canEditProfile) setEditUserOpen(true);
      return;
    }

    if (target === "timeline") {
      setProfileTab("timeline");
      return;
    }

    setProfileTab("overview");
  };
  const healthPlanSectionCount = healthPlan
    ? [
        safeArray(healthPlan.goals_json).length,
        safeArray(healthPlan.daily_support_json).length,
        safeArray(healthPlan.monitoring_json).length,
        safeArray(healthPlan.escalation_json).length,
        safeArray(healthPlan.caregiver_guidance_json).length,
      ].reduce((total, value) => total + value, 0)
    : 0;
  const healthPlanSignalCount = safeArray(healthPlan?.source_signals_json).length;
  const healthPlanIsReviewed = healthPlan?.review_status === "reviewed";
  const healthPlanReviewedBy = healthPlan?.reviewed_by_email || healthPlan?.reviewed_by_user_id || null;
  const healthPlanSignals = safeArray(healthPlan?.source_signals_json);
  const healthPlanSignalLookup = new Map(
    healthPlanSignals
      .map((signal) => [signal.id || signal.label || "", signal] as const)
      .filter(([key]) => Boolean(key)),
  );
  const computedHealthPlanDataQualityGaps = buildHealthPlanDataQualityGaps({
    profile: {
      user,
      health,
      medications,
      medicationActivity,
      sensors,
      careProviders,
      consent,
      checkins,
      brainCoach,
      alerts,
      recentOperationalEvents,
    },
    sourceSignals: healthPlanSignals,
  });
  const healthPlanDataQualityGaps = healthPlan && safeArray(healthPlan.data_quality_gaps_json).length
    ? safeArray(healthPlan.data_quality_gaps_json)
    : computedHealthPlanDataQualityGaps;
  const healthPlanFollowThrough = healthPlan
    ? (data.healthPlanFeedback || buildHealthPlanFollowThroughSummary({
      plan: healthPlan,
      profile: {
        checkins,
        brainCoach,
        medicationActivity,
        alerts,
      },
    }))
    : null;
  const healthPlanSectionDrift = healthPlan
    ? buildHealthPlanSectionDrift({
      plan: healthPlan,
      dataQualityGaps: healthPlanDataQualityGaps,
      followThrough: healthPlanFollowThrough,
    })
    : [];
  const healthPlanUsesFallback = healthPlan?.generator_provider === "fallback";
  const profileHealthPlanHistory = safeArray<OperationalHealthPlanRevision>(data?.healthPlanHistory);
  const queryHealthPlanHistory = safeArray<OperationalHealthPlanRevision>(healthPlanHistoryQuery);
  const healthPlanHistory = profileHealthPlanHistory.length > 0 ? profileHealthPlanHistory : queryHealthPlanHistory;
  const healthPlanHistoryReplay = safeRecord(data?.healthPlanBenchmarkReplay) || safeRecord(healthPlanHistoryReplayQuery);
  const healthPlanRecommendationSurvivorship = buildHealthPlanRecommendationSurvivorship({
    history: healthPlanHistory.length
      ? healthPlanHistory
      : (healthPlan ? [healthPlan] : []),
  });
  const latestHealthPlanRevision = safeArray(healthPlanHistory)[0] || null;
  const latestHealthPlanChange = latestHealthPlanRevision?.version_number === healthPlan?.current_version
    ? latestHealthPlanRevision.change || healthPlan?.quality_snapshot_json?.recommendation_change_audit || null
    : healthPlan?.quality_snapshot_json?.recommendation_change_audit || null;
  const healthPlanHighPrioritySignals = healthPlanSignals.filter((signal) => inferHealthPlanSignalStrength(signal) === "high").length;
  const healthPlanExplicitFeedbackEntries = safeArray(healthPlan?.feedback_entries_json);
  const healthPlanInferredFeedbackEntries = healthPlan
    ? buildHealthPlanInferredFeedbackEntries({
      plan: healthPlan,
      profile: {
        checkins,
        brainCoach,
        medicationActivity,
      },
      followThrough: healthPlanFollowThrough,
    })
    : [];
  const healthPlanFeedbackEntries = [...healthPlanExplicitFeedbackEntries, ...healthPlanInferredFeedbackEntries].sort((left, right) => {
    const leftTime = left?.recorded_at ? new Date(left.recorded_at).getTime() : 0;
    const rightTime = right?.recorded_at ? new Date(right.recorded_at).getTime() : 0;
    return rightTime - leftTime;
  });
  const healthPlanDecisionTrace = healthPlan
    ? buildHealthPlanDecisionTrace({
      plan: healthPlan,
      sourceSignals: healthPlanSignals,
      dataQualityGaps: healthPlanDataQualityGaps,
      followThrough: healthPlanFollowThrough,
      sectionDrift: healthPlanSectionDrift,
    })
    : [];
  const healthPlanDecisionTraceLookup = new Map(
    healthPlanDecisionTrace.map((item) => [item.section_key || "", item] as const).filter(([key]) => Boolean(key)),
  );
  const healthPlanImprovementActions = buildHealthPlanImprovementActions({
    dataQualityGaps: healthPlanDataQualityGaps,
    followThrough: healthPlanFollowThrough,
    sectionDrift: healthPlanSectionDrift,
    completedActions: healthPlan?.completed_improvement_actions_json,
  });
  const healthPlanInterventionMemory = healthPlan
    ? buildHealthPlanInterventionMemory({
      plan: healthPlan,
      dataQualityGaps: healthPlanDataQualityGaps,
      followThrough: healthPlanFollowThrough,
      sectionDrift: healthPlanSectionDrift,
      completedActions: healthPlan.completed_improvement_actions_json,
      feedbackEntries: healthPlanFeedbackEntries,
    })
    : [];
  const healthPlanQualityMemory = healthPlan
    ? buildHealthPlanQualityMemory({
      existingPlan: healthPlan,
      history: healthPlanHistory,
    })
    : null;
  const healthPlanOutcomePatternMemory = healthPlan?.quality_snapshot_json?.outcome_pattern_memory || (healthPlan
    ? buildHealthPlanOutcomePatternMemory({
      existingPlan: healthPlan,
      history: healthPlanHistory,
    })
    : null);
  const healthPlanOutcomeScores = healthPlan
    ? buildHealthPlanOutcomeScores({
      plan: healthPlan,
      feedbackEntries: healthPlanFeedbackEntries,
      followThrough: healthPlanFollowThrough,
      sectionDrift: healthPlanSectionDrift,
    })
    : [];
  const healthPlanRecommendationLearning = healthPlan
    ? buildHealthPlanRecommendationOutcomeMemory({
      plan: healthPlan,
      feedbackEntries: healthPlanFeedbackEntries,
      followThrough: healthPlanFollowThrough,
      sectionDrift: healthPlanSectionDrift,
    })
    : [];
  const healthPlanClientResponseMemory = buildHealthPlanClientResponseMemory({
    recentOperationalEvents,
    recommendationLearning: healthPlanRecommendationLearning,
    sectionOutcomes: healthPlanOutcomeScores,
    sourceSignals: healthPlanSignals,
  });
  const healthPlanSignalPreferenceWeights = healthPlan
    ? buildHealthPlanSignalPreferenceWeights({
      plan: healthPlan,
      feedbackEntries: healthPlanFeedbackEntries,
      sourceSignals: healthPlanSignals,
      followThrough: healthPlanFollowThrough,
      sectionDrift: healthPlanSectionDrift,
    })
    : [];
  const healthPlanRecommendationLearningLookup = new Map(
    healthPlanRecommendationLearning.map((item) => [item.item_id || "", item] as const).filter(([key]) => Boolean(key)),
  );
  const healthPlanCriticalSignalIds = safeArray(healthPlan?.quality_snapshot_json?.critical_signal_ids);
  const healthPlanSignalTriage = buildHealthPlanSignalTriage(healthPlanSignals, healthPlanCriticalSignalIds);
  const healthPlanEvidenceHierarchy = buildHealthPlanEvidenceHierarchy({
    sourceSignals: healthPlanSignals,
    feedbackEntries: healthPlanFeedbackEntries,
  });
  const healthPlanEvidenceConflicts = buildHealthPlanEvidenceConflicts({
    sourceSignals: healthPlanSignals,
    feedbackEntries: healthPlanFeedbackEntries,
    followThrough: healthPlanFollowThrough,
    sectionDrift: healthPlanSectionDrift,
  });
  const healthPlanClinicalCautions = buildHealthPlanClinicalCautions({
    sourceSignals: healthPlanSignals,
    followThrough: healthPlanFollowThrough,
  });
  const healthPlanClinicalCautionIssues = healthPlan
    ? findHealthPlanClinicalCautionIssues(healthPlan, {
      sourceSignals: healthPlanSignals,
      followThrough: healthPlanFollowThrough,
      clinicalCautions: healthPlanClinicalCautions,
    })
    : [];
  const healthPlanEscalationGrade = buildHealthPlanEscalationGrade({
    sourceSignals: healthPlanSignals,
    followThrough: healthPlanFollowThrough,
    evidenceConflicts: healthPlanEvidenceConflicts,
  });
  const healthPlanConfidenceProfile = healthPlan
    ? buildHealthPlanConfidenceProfile({
      plan: healthPlan,
      sourceSignals: healthPlanSignals,
      dataQualityGaps: healthPlanDataQualityGaps,
      evidenceConflicts: healthPlanEvidenceConflicts,
      followThrough: healthPlanFollowThrough,
      sectionDrift: healthPlanSectionDrift,
    })
    : null;
  const computedHealthPlanReviewGovernance = buildHealthPlanReviewGovernance({
    escalationGrade: healthPlanEscalationGrade,
    dataQualityGaps: healthPlanDataQualityGaps,
    followThrough: healthPlanFollowThrough,
    evidenceConflicts: healthPlanEvidenceConflicts,
  });
  const healthPlanReviewGovernance = healthPlan
    ? {
        escalation_grade: healthPlan.escalation_grade || computedHealthPlanReviewGovernance.escalation_grade,
        review_required: healthPlan.review_required ?? computedHealthPlanReviewGovernance.review_required,
        review_window: healthPlan.review_window || computedHealthPlanReviewGovernance.review_window,
        review_summary: healthPlan.review_summary || computedHealthPlanReviewGovernance.review_summary,
        review_reasons_json: safeArray(healthPlan.review_reasons_json).length
          ? safeArray(healthPlan.review_reasons_json)
          : computedHealthPlanReviewGovernance.review_reasons_json,
      }
    : computedHealthPlanReviewGovernance;
  const healthPlanFreshness = healthPlan
    ? buildHealthPlanFreshnessSnapshot({
      plan: healthPlan,
      followThrough: healthPlanFollowThrough,
      recentOperationalEvents,
      reviewGovernance: healthPlanReviewGovernance,
      sectionDrift: healthPlanSectionDrift,
    })
    : null;
  const healthPlanRefreshStrategy = healthPlan
    ? buildHealthPlanRefreshStrategy({
      freshness: healthPlanFreshness,
      sectionDrift: healthPlanSectionDrift,
      clinicalCautions: healthPlanClinicalCautions,
      clinicalCautionIssues: healthPlanClinicalCautionIssues,
      reviewGovernance: healthPlanReviewGovernance,
      followThrough: healthPlanFollowThrough,
    })
    : null;
  const healthPlanReviewPriorities = healthPlan?.quality_snapshot_json?.review_priorities || buildHealthPlanReviewPriorities({
    sourceSignals: healthPlanSignals,
    escalationGrade: healthPlanEscalationGrade,
    reviewGovernance: healthPlanReviewGovernance,
    confidenceProfile: healthPlanConfidenceProfile,
    sectionOutcomes: healthPlanOutcomeScores,
    qualityMemory: healthPlanQualityMemory,
    clientResponseMemory: healthPlanClientResponseMemory,
    clinicalCautions: healthPlanClinicalCautions,
    freshness: healthPlanFreshness,
    refreshStrategy: healthPlanRefreshStrategy,
  });
  const healthPlanLiveEvidence = healthPlan?.quality_snapshot_json?.live_evidence_summary || buildHealthPlanLiveEvidenceSummary({
    medications,
    medicationActivity,
    checkins,
    brainCoach,
    sensors,
    alerts,
    recentOperationalEvents,
  });
  const healthPlanLongitudinalMemory = healthPlan?.quality_snapshot_json?.longitudinal_memory || buildHealthPlanLongitudinalMemory({
    liveEvidenceSummary: healthPlanLiveEvidence,
    history: healthPlanHistory,
  });
  const healthPlanReadiness = healthPlan?.quality_snapshot_json?.readiness || buildHealthPlanReadiness({
    dataQualityGaps: healthPlanDataQualityGaps,
    confidenceProfile: healthPlanConfidenceProfile,
    reviewGovernance: healthPlanReviewGovernance,
    liveEvidenceSummary: healthPlanLiveEvidence,
    freshness: healthPlanFreshness,
    longitudinalMemory: healthPlanLongitudinalMemory,
  });
  const displayedHealthPlanReadiness = healthPlanGenerationDiagnostics?.readiness || healthPlanReadiness;
  const healthPlanSignalReviewItems = [
    ...safeArray(displayedHealthPlanReadiness?.blocking_reasons).map((item) => ({
      id: item?.id || item?.label || item?.detail,
      title: item?.label,
      detail: item?.detail,
      tone: item?.severity || "high",
    })),
    ...safeArray(displayedHealthPlanReadiness?.collection_actions).map((item) => ({
      id: item?.id || item?.label || item?.action,
      title: item?.label,
      detail: item?.action,
      tone: item?.priority || "medium",
    })),
    ...safeArray(displayedHealthPlanReadiness?.caution_reasons).map((item) => ({
      id: item?.id || item?.label || item?.detail,
      title: item?.label,
      detail: item?.detail,
      tone: item?.severity || "medium",
    })),
  ].filter((item) => item.title || item.detail).slice(0, 5);
  const healthPlanReadinessVoiceContext = {
    clientName: fullName,
    language: user.language,
    livingContext: context.livingContextKey ? t(context.livingContextKey) : null,
    medicationCount: medications.length,
    careProviderCount: careProviders.length,
    sensorCount: sensors.length,
    activeAlertCount: activeAlerts.length,
  };
  const healthPlanGenerationAcceptance = healthPlanGenerationDiagnostics?.acceptance || null;
  const healthPlanRecommendationImpact = healthPlan?.quality_snapshot_json?.recommendation_impact || buildHealthPlanRecommendationImpact({
    plan: healthPlan,
    recentOperationalEvents,
    liveEvidenceSummary: healthPlanLiveEvidence,
    followThrough: healthPlanFollowThrough,
    sourceSignals: healthPlanSignals,
  });
  const healthPlanRecommendationEffectiveness = healthPlan?.quality_snapshot_json?.recommendation_effectiveness || buildHealthPlanRecommendationEffectiveness({
    recommendationLearning: healthPlanRecommendationLearning,
    recommendationSurvivorship: healthPlanRecommendationSurvivorship,
    recommendationImpact: healthPlanRecommendationImpact,
  });
  const healthPlanRecommendationHistory = healthPlan?.quality_snapshot_json?.recommendation_history || buildHealthPlanRecommendationHistory({
    history: healthPlanHistory.length
      ? healthPlanHistory
      : (healthPlan ? [healthPlan] : []),
    recommendationImpact: healthPlanRecommendationImpact,
    recommendationEffectiveness: healthPlanRecommendationEffectiveness,
  });
  const healthPlanGenerationQuality = healthPlan?.quality_snapshot_json?.generation_quality || buildHealthPlanGenerationQuality({
    plan: healthPlan,
    reviewPriorities: healthPlanReviewPriorities,
    confidenceProfile: healthPlanConfidenceProfile,
  });
  const healthPlanOperationalCompleteness = healthPlan?.quality_snapshot_json?.operational_completeness || buildHealthPlanOperationalCompleteness({
    plan: healthPlan,
    reviewPriorities: healthPlanReviewPriorities,
    escalationGrade: healthPlanEscalationGrade,
    liveEvidenceSummary: healthPlanLiveEvidence,
  });
  const healthPlanRecommendationChallenges = healthPlan?.quality_snapshot_json?.recommendation_challenges || buildHealthPlanRecommendationChallenges({
    plan: healthPlan,
    sourceSignals: healthPlanSignals,
    reviewPriorities: healthPlanReviewPriorities,
    liveEvidenceSummary: healthPlanLiveEvidence,
    longitudinalMemory: healthPlanLongitudinalMemory,
  });
  const healthPlanRecommendationSourceRanking = healthPlan?.quality_snapshot_json?.recommendation_source_ranking || buildHealthPlanRecommendationSourceRanking({
    plan: healthPlan,
    sourceSignals: healthPlanSignals,
    evidenceHierarchy: healthPlanEvidenceHierarchy,
    signalPreferenceWeights: healthPlanSignalPreferenceWeights,
    recommendationEffectiveness: healthPlanRecommendationEffectiveness,
    recommendationChallenges: healthPlanRecommendationChallenges,
  });
  const healthPlanRecommendationEvidenceDiversity = healthPlan?.quality_snapshot_json?.recommendation_evidence_diversity || buildHealthPlanRecommendationEvidenceDiversity({
    recommendationSourceRanking: healthPlanRecommendationSourceRanking,
  });
  const healthPlanEvidencePack = buildHealthPlanEvidencePack({
    sourceSignals: healthPlanSignals,
    signalTriage: healthPlanSignalTriage,
    criticalSignalIds: healthPlanCriticalSignalIds,
    evidenceHierarchy: healthPlanEvidenceHierarchy,
    evidenceConflicts: healthPlanEvidenceConflicts,
    escalationGrade: healthPlanEscalationGrade,
    dataQualityGaps: healthPlanDataQualityGaps,
    followThrough: healthPlanFollowThrough,
    qualityMemory: healthPlanQualityMemory,
  });
  const healthPlanRecommendationGrounding = healthPlan?.quality_snapshot_json?.recommendation_grounding || buildHealthPlanRecommendationGrounding({
    plan: healthPlan,
    sourceSignals: healthPlanSignals,
    evidencePack: healthPlanEvidencePack,
    reviewPriorities: healthPlanReviewPriorities,
    confidenceProfile: healthPlanConfidenceProfile,
    recommendationSourceRanking: healthPlanRecommendationSourceRanking,
  });
  const healthPlanRecommendationCalibration = healthPlan?.quality_snapshot_json?.recommendation_calibration || null;
  const healthPlanBenchmarkAssessment = healthPlan?.quality_snapshot_json?.benchmark_assessment || buildHealthPlanBenchmarkAssessment({
    plan: healthPlan,
    sourceSignals: healthPlanSignals,
    evidencePack: healthPlanEvidencePack,
    reviewPriorities: healthPlanReviewPriorities,
    confidenceProfile: healthPlanConfidenceProfile,
    followThrough: healthPlanFollowThrough,
  });
  const healthPlanRecommendationCoverage = healthPlan?.quality_snapshot_json?.recommendation_coverage || buildHealthPlanRecommendationCoverage({
    plan: healthPlan,
    evidencePack: healthPlanEvidencePack,
    reviewPriorities: healthPlanReviewPriorities,
    followThrough: healthPlanFollowThrough,
  });
  const healthPlanRecommendationRepair = healthPlan?.quality_snapshot_json?.recommendation_repair || buildHealthPlanRecommendationRepairBrief({
    recommendationLearning: safeArray(healthPlan?.recommendation_learning_json),
    recommendationEffectiveness: healthPlanRecommendationEffectiveness,
    recommendationGrounding: healthPlanRecommendationGrounding,
    recommendationChallenges: healthPlanRecommendationChallenges,
    recommendationSourceRanking: healthPlanRecommendationSourceRanking,
  });
  const healthPlanGenerationBrief = healthPlan?.quality_snapshot_json?.generation_brief || buildHealthPlanGenerationBrief({
    sourceSignals: healthPlanSignals,
    signalTriage: healthPlanSignalTriage,
    evidencePack: healthPlanEvidencePack,
    reviewPriorities: healthPlanReviewPriorities,
    clinicalCautions: healthPlanClinicalCautions,
    recommendationRepairBrief: healthPlanRecommendationRepair,
    liveEvidenceSummary: healthPlanLiveEvidence,
    longitudinalMemory: healthPlanLongitudinalMemory,
    refreshStrategy: healthPlanRefreshStrategy,
  });
  const healthPlanGenerationBriefIssues = safeArray(healthPlan?.quality_snapshot_json?.generation_brief_issues).length > 0
    ? safeArray(healthPlan?.quality_snapshot_json?.generation_brief_issues)
    : (healthPlan ? findHealthPlanGenerationBriefIssues(healthPlan, healthPlanGenerationBrief) : []);
  const healthPlanRecommendationRevisionMemory = healthPlan?.quality_snapshot_json?.recommendation_revision_memory || buildHealthPlanRecommendationRevisionMemory({
    history: healthPlanHistory.length
      ? healthPlanHistory
      : (healthPlan ? [healthPlan] : []),
    recommendationSurvivorship: healthPlanRecommendationSurvivorship,
    recommendationRepair: healthPlanRecommendationRepair,
    recommendationGrounding: healthPlanRecommendationGrounding,
    recommendationChallenges: healthPlanRecommendationChallenges,
  });
  const healthPlanRecommendationReview = healthPlan?.quality_snapshot_json?.recommendation_review || buildHealthPlanRecommendationReviewSummary({
    plan: healthPlan,
    recommendationImpact: healthPlanRecommendationImpact,
    recommendationHistory: healthPlanRecommendationHistory,
    recommendationEvidenceDiversity: healthPlanRecommendationEvidenceDiversity,
    recommendationGrounding: healthPlanRecommendationGrounding,
    recommendationChallenges: healthPlanRecommendationChallenges,
    recommendationReviewDecisions: healthPlan?.recommendation_review_decisions_json || [],
  });
  const healthPlanActionImpact = healthPlan?.quality_snapshot_json?.action_impact || buildHealthPlanActionImpact({
    plan: healthPlan,
    followThrough: healthPlanFollowThrough,
    recentOperationalEvents: safeArray(data?.profile?.recentOperationalEvents),
    liveEvidenceSummary: healthPlanLiveEvidence,
    operationalCompleteness: healthPlanOperationalCompleteness,
  });
  const healthPlanReviewReadiness = healthPlan?.quality_snapshot_json?.review_readiness || buildHealthPlanReviewReadiness({
    reviewGovernance: healthPlanReviewGovernance,
    readiness: healthPlanReadiness,
    generationQuality: healthPlanGenerationQuality,
    operationalCompleteness: healthPlanOperationalCompleteness,
    actionImpact: healthPlanActionImpact,
    recommendationImpact: healthPlanRecommendationImpact,
    recommendationHistory: healthPlanRecommendationHistory,
    recommendationEvidenceDiversity: healthPlanRecommendationEvidenceDiversity,
    recommendationGrounding: healthPlanRecommendationGrounding,
    recommendationCalibration: healthPlanRecommendationCalibration,
    recommendationCoverage: healthPlanRecommendationCoverage,
    recommendationChallenges: healthPlanRecommendationChallenges,
    recommendationReview: healthPlanRecommendationReview,
    recommendationChangeAudit: latestHealthPlanChange,
    benchmarkAssessment: healthPlanBenchmarkAssessment,
  });
  const healthPlanReviewRemediation = healthPlan?.quality_snapshot_json?.review_remediation || buildHealthPlanReviewRemediation({
    reviewReadiness: healthPlanReviewReadiness,
    refreshStrategy: healthPlanRefreshStrategy,
    improvementActions: healthPlanImprovementActions,
    reviewGovernance: healthPlanReviewGovernance,
  });
  const healthPlanTrustVerdict = healthPlan?.quality_snapshot_json?.trust_verdict || (healthPlan ? buildHealthPlanTrustVerdict({
    generationQuality: healthPlanGenerationQuality,
    operationalCompleteness: healthPlanOperationalCompleteness,
    recommendationGrounding: healthPlanRecommendationGrounding,
    recommendationCalibration: healthPlanRecommendationCalibration,
    recommendationCoverage: healthPlanRecommendationCoverage,
    benchmarkAssessment: healthPlanBenchmarkAssessment,
    recommendationChallenges: healthPlanRecommendationChallenges,
    generationBriefIssues: healthPlanGenerationBriefIssues,
  }) : null);
  const healthPlanExecutionBrief = healthPlan?.quality_snapshot_json?.execution_brief || (healthPlan ? buildHealthPlanExecutionBrief({
    plan: healthPlan,
    reviewPriorities: healthPlanReviewPriorities,
    escalationGrade: healthPlanEscalationGrade,
    liveEvidenceSummary: healthPlanLiveEvidence,
  }) : null);
  const healthPlanRecommendationSourceRankingLookup = new Map(
    safeArray(healthPlanRecommendationSourceRanking?.items)
      .map((item) => [item?.item_id || "", item] as const)
      .filter(([key]) => Boolean(key)),
  );
  const healthPlanRecommendationGroundingLookup = new Map(
    safeArray(healthPlanRecommendationGrounding?.items)
      .map((item) => [item?.item_id || "", item] as const)
      .filter(([key]) => Boolean(key)),
  );
  const healthPlanRecommendationRepairLookup = new Map(
    safeArray(healthPlanRecommendationRepair?.items)
      .map((item) => [item?.item_id || "", item] as const)
      .filter(([key]) => Boolean(key)),
  );
  const healthPlanReviewPending = Boolean(healthPlanReviewGovernance.review_required) && !healthPlanIsReviewed;
  const healthPlanReviewReasons = safeArray(healthPlanReviewGovernance.review_reasons_json);
  const urgentHealthPlanReviewRequired = Boolean(healthPlanReviewGovernance.review_required) && healthPlanReviewGovernance.review_window === "today";
  const healthPlanReviewChecklistFields = healthPlanReviewChecklistItems(t);
  const healthPlanLifeSafetyReviewItems = buildHealthPlanLifeSafetyReviewItems({
    clinicalCautions: healthPlanClinicalCautions,
  });
  const healthPlanRecommendationReviewDraftSummary = buildHealthPlanRecommendationReviewSummary({
    plan: healthPlan,
    recommendationImpact: healthPlanRecommendationImpact,
    recommendationHistory: healthPlanRecommendationHistory,
    recommendationEvidenceDiversity: healthPlanRecommendationEvidenceDiversity,
    recommendationGrounding: healthPlanRecommendationGrounding,
    recommendationChallenges: healthPlanRecommendationChallenges,
    recommendationReviewDecisions: healthPlanRecommendationReviewDrafts,
  });
  const healthPlanEvidenceLinkedCount = healthPlan
    ? [
        ...safeArray(healthPlan.goals_json),
        ...safeArray(healthPlan.daily_support_json),
        ...safeArray(healthPlan.monitoring_json),
        ...safeArray(healthPlan.escalation_json),
        ...safeArray(healthPlan.caregiver_guidance_json),
      ].filter((item) => safeArray(item.source_signal_ids).length > 0).length
    : 0;
  const planWorkspaceActive = profileTab === "plan";

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full" onClick={() => navigate("/users")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">{t("profile.title")}</h1>
            <p className="text-sm font-medium text-muted-foreground">
              {copy("profile.detailFor", { name: fullName })}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isPreviewDemo && (
            <Badge className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              {t("profile.previewData")}
            </Badge>
          )}
          {canEditProfile && !planWorkspaceActive && (
            <Button variant="outline" className="h-10 rounded-full border-primary/20 text-primary hover:bg-primary/10" onClick={() => setEditUserOpen(true)}>
              <Pencil className="mr-2 h-4 w-4" />
              {t("profile.editProfile")}
            </Button>
          )}
        </div>
      </div>

      {planWorkspaceActive ? (
        <Card className="rounded-2xl border-primary/10 bg-white shadow-sm">
          <CardContent className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-white shadow-sm">
                {getInitials(user.first_name, user.last_name)}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="truncate text-lg font-bold tracking-tight text-foreground">{fullName}</h2>
                  <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-bold ring-1", profileStatusClasses(context.riskStatus))}>
                    {t(`profile.status.${context.riskStatus}`)}
                  </span>
                </div>
                <p className="mt-1 text-sm font-medium text-muted-foreground">
                  {[age ? copy("profile.ageYears", { age }) : null, context.livingContextKey ? t(context.livingContextKey) : null, userCity].filter(Boolean).join(" · ")}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 lg:justify-end">
              <Badge variant="outline" className="rounded-full px-3 py-1 text-xs font-semibold">
                {t("profile.language")}: {(user.language || "-").toString().toUpperCase()}
              </Badge>
              <Badge variant="outline" className="rounded-full px-3 py-1 text-xs font-semibold">
                {t("profile.lastContact")}: {lastContactValue || t("profile.lastContactUnknown")}
              </Badge>
              <Badge variant="outline" className="rounded-full px-3 py-1 text-xs font-semibold">
                {t("profile.healthPlanSourceSignals")}: {healthPlanSignalCount}
              </Badge>
              {canEditProfile && (
                <Button variant="outline" className="h-9 rounded-full border-primary/20 px-3 text-xs font-bold text-primary hover:bg-primary/10" onClick={() => setEditUserOpen(true)}>
                  <Pencil className="mr-1.5 h-3.5 w-3.5" />
                  {t("profile.editProfile")}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
      <Card className="rounded-2xl border-border bg-white shadow-sm">
        <CardContent className="p-5 lg:p-7">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0">
              <div className="flex flex-col gap-4 md:flex-row md:items-start">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-bold text-white shadow-sm">
                  {getInitials(user.first_name, user.last_name)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-2xl font-bold tracking-tight text-foreground">{fullName}</h2>
                    <span className={cn("rounded-full px-3 py-1 text-sm font-bold ring-1", profileStatusClasses(context.riskStatus))}>
                      {t(`profile.status.${context.riskStatus}`)}
                    </span>
                  </div>
                  <p className="mt-1 text-base font-medium text-muted-foreground">
                    {[age ? copy("profile.ageYears", { age }) : null, context.livingContextKey ? t(context.livingContextKey) : null, userCity].filter(Boolean).join(" · ")}
                  </p>
                  <div className="mt-5 inline-flex max-w-full items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span className="truncate">{t(context.reasonKey)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold text-muted-foreground xl:justify-end">
              <MetaItem icon={ChannelIcon} label={t("profile.preferredChannel")} value={t(channelKey(context.preferredChannel))} />
              <MetaItem icon={Phone} label={t("profile.phoneNumber")} value={user.phone || t("profile.noPhone")} />
            </div>
          </div>

          <div className="mt-6 border-t border-border pt-5">
            <div className="flex flex-wrap gap-2">
              <ActionButton tone="primary" icon={PhoneCall} label={t("profile.callGatewayRequired")} onClick={() => handleOperationalAction("profile.action.callGatewayRequired")} />
              <ActionButton icon={MessageCircle} label={t("profile.whatsAppGatewayRequired")} onClick={() => handleOperationalAction("profile.action.whatsAppGatewayRequired")} />
              <ActionButton icon={Users} label={t("profile.careProviderGatewayRequired")} onClick={() => handleOperationalAction("profile.action.careProviderGatewayRequired")} />
              <ActionButton icon={Pencil} label={t("profile.addNote")} onClick={openAddNoteDialog} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border bg-white shadow-sm">
        <CardHeader className="flex flex-row items-center gap-2 pb-2">
          <Users className="h-5 w-5 text-primary" />
          <CardTitle className="text-base font-bold">{t("profile.keyData")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <InfoTile label={t("profile.age")} value={age ? copy("profile.ageYears", { age }) : null} />
            <InfoTile label={t("profile.livesAlone")} value={context.livingContextKey ? t(context.livingContextKey) : null} />
            <InfoTile label={t("profile.language")} value={user.language ? String(user.language).toUpperCase() : null} />
            <InfoTile label={t("profile.preferredChannel")} value={t(channelKey(context.preferredChannel))} />
            <InfoTile label={t("profile.phoneNumber")} value={user.phone || t("profile.noPhone")} />
            <InfoTile label={t("profile.address")} value={address || null} />
            <InfoTile label={t("profile.lastContact")} value={lastContactValue} />
            <InfoTile label={t("profile.familyConsent")} value={t(context.familyConsentKey ?? "profile.familyConsentUnknown")} />
          </div>
          {user.emergency_notes && (
            <div className="mt-4 rounded-xl border border-border/70 bg-muted/25 px-4 py-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("profile.careNotes")}</p>
              <p className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-6 text-foreground">{user.emergency_notes}</p>
            </div>
          )}
        </CardContent>
      </Card>
        </>
      )}

      <Tabs value={profileTab} onValueChange={setProfileTab} className="flex flex-col gap-5">
        <div className="sticky top-3 z-10 rounded-2xl border border-border/80 bg-background/95 p-2 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <TabsList className="flex h-auto flex-wrap gap-2 bg-transparent p-0">
            <TabsTrigger
              value="overview"
              className="flex min-h-14 flex-1 items-center justify-start rounded-xl border border-transparent px-4 py-3 text-left text-sm font-semibold text-muted-foreground data-[state=active]:border-primary/15 data-[state=active]:bg-white data-[state=active]:text-foreground data-[state=active]:shadow-sm"
            >
              <HeartPulse className="mr-2 h-4 w-4 text-vyva-pink" />
              {t("profile.navOverview")}
            </TabsTrigger>
            <TabsTrigger
              value="support"
              className="flex min-h-14 flex-1 items-center justify-start rounded-xl border border-transparent px-4 py-3 text-left text-sm font-semibold text-muted-foreground data-[state=active]:border-primary/15 data-[state=active]:bg-white data-[state=active]:text-foreground data-[state=active]:shadow-sm"
            >
              <Users className="mr-2 h-4 w-4 text-primary" />
              {t("profile.navSupport")}
            </TabsTrigger>
            <TabsTrigger
              value="plan"
              className="flex min-h-14 flex-1 items-center justify-start rounded-xl border border-transparent px-4 py-3 text-left text-sm font-semibold text-muted-foreground data-[state=active]:border-primary/15 data-[state=active]:bg-white data-[state=active]:text-foreground data-[state=active]:shadow-sm"
            >
              <Brain className="mr-2 h-4 w-4 text-primary" />
              {t("profile.navHealthPlan")}
            </TabsTrigger>
            <TabsTrigger
              value="timeline"
              className="flex min-h-14 flex-1 items-center justify-start rounded-xl border border-transparent px-4 py-3 text-left text-sm font-semibold text-muted-foreground data-[state=active]:border-primary/15 data-[state=active]:bg-white data-[state=active]:text-foreground data-[state=active]:shadow-sm"
            >
              <Clock className="mr-2 h-4 w-4 text-vyva-teal" />
              {t("profile.navTimeline")}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview" className="mt-0">
          <div className="grid gap-5 xl:grid-cols-2">
        <Card className="rounded-2xl border-border bg-white shadow-sm">
          <CardHeader className="flex flex-row items-center gap-2 pb-2">
            <HeartPulse className="h-5 w-5 text-vyva-pink" />
            <CardTitle className="text-base font-bold">{t("profile.healthCare")}</CardTitle>
            {showAdminControls && (
              <AdminIconButton label={t("profile.editHealth")} onClick={() => setEditHealthOpen(true)} />
            )}
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="font-semibold text-muted-foreground">{t("profile.healthScore")}</span>
                <span className="font-bold text-foreground">{healthScore}</span>
              </div>
              <Progress value={healthScore} className="h-2" />
            </div>
            <ChipList
              emptyLabel={t("profile.noHealthConditions")}
              items={[...healthConditions, ...mobilityNeeds]}
              tone="pink"
            />
            <div className="grid gap-2 sm:grid-cols-2">
              {services.map((service) => {
                const Icon = service.icon;
                return (
                  <div key={service.key} className="flex items-center justify-between rounded-xl border border-border bg-muted/35 px-3 py-2">
                    <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <Icon className="h-4 w-4 text-primary" />
                      {t(service.key)}
                    </span>
                    <Badge variant={service.active ? "default" : "secondary"} className="rounded-full text-[11px]">
                      {service.active ? t("profile.active") : t("profile.inactive")}
                    </Badge>
                  </div>
                );
              })}
            </div>
            <p className="text-xs font-semibold text-muted-foreground">
              {copy("profile.servicesActive", { active: servicesActive, total: services.length })}
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border bg-white shadow-sm">
          <CardHeader className="flex flex-row items-center gap-2 pb-2">
            <Pill className="h-5 w-5 text-orange-500" />
            <CardTitle className="text-base font-bold">{t("profile.medicationCheckins")}</CardTitle>
            <div className="ml-auto flex gap-1">
              <Button size="sm" className="h-9 rounded-full px-3 text-xs font-bold shadow-sm" onClick={() => navigate(`/users/${id}/medications`)}>
                <Calendar className="mr-1.5 h-3.5 w-3.5" />
                {t("profile.viewAdherence")}
              </Button>
              {canEditMedications && (
                <AdminIconButton
                  label={t("profile.addMedication")}
                  icon={Plus}
                  onClick={() => {
                    setEditMedTarget(null);
                    setEditMedOpen(true);
                  }}
                />
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {medications.length === 0 ? (
              <EmptyLine icon={Pill} label={t("profile.noMedications")} />
            ) : (
              <div className="space-y-2">
                {medications.map((med) => {
                  const scheduleTimes = medicationScheduleTimes(med);
                  return (
                    <div key={med.id} className="rounded-xl border border-border bg-muted/25 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-foreground">{med.medication_name}</p>
                          <p className="text-sm text-muted-foreground">
                            {[med.dosage, med.purpose].filter(Boolean).join(" · ") || t("profile.noExtraDetails")}
                          </p>
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            <Badge variant={med.reminders_enabled ?? true ? "default" : "secondary"} className="rounded-full text-[11px]">
                              {(med.reminders_enabled ?? true) ? t("profile.medicationRemindersOn") : t("profile.medicationRemindersOff")}
                            </Badge>
                          </div>
                          {scheduleTimes.length > 0 && (
                            <p className={cn("mt-1 text-xs font-semibold", (med.reminders_enabled ?? true) ? "text-primary" : "text-muted-foreground")}>
                              {scheduleTimes.join(", ")}
                            </p>
                          )}
                          {med.frequency && (
                            <p className="mt-1 text-xs text-muted-foreground">
                              {t("profile.medicationFrequency")}: {med.frequency}
                            </p>
                          )}
                        </div>
                        {canEditMedications && (
                          <div className="flex gap-1">
                            <AdminIconButton label={t("profile.editMedication")} onClick={() => { setEditMedTarget(med); setEditMedOpen(true); }} />
                            <AdminIconButton label={t("profile.deleteMedication")} icon={Trash2} danger onClick={() => handleDeleteMedication(med.id)} />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <ServiceSummary
                title={t("profile.service.checkins")}
                enabled={Boolean(checkins?.enabled)}
                frequency={checkins?.frequency}
                preferredTime={checkins?.preferred_time}
                pausedUntil={checkins?.paused_until}
                pauseSource={checkins?.pause_source}
                isPaused={Boolean(checkins?.is_paused)}
                onEdit={canEditCheckins ? () => setEditCheckinOpen(true) : undefined}
              />
              <ServiceSummary
                title={t("profile.service.brainCoach")}
                enabled={Boolean(brainCoach?.enabled)}
                frequency={brainCoach?.frequency}
                preferredTime={brainCoach?.preferred_time}
                pausedUntil={brainCoach?.paused_until}
                pauseSource={brainCoach?.pause_source}
                isPaused={Boolean(brainCoach?.is_paused)}
                onEdit={canEditBrainCoach ? () => setEditBrainOpen(true) : undefined}
              />
            </div>
          </CardContent>
        </Card>
          </div>
        </TabsContent>

        <TabsContent value="support" className="mt-0">
          <div className="grid gap-5 xl:grid-cols-2">
        <Card className="rounded-2xl border-border bg-white shadow-sm">
          <CardHeader className="flex flex-row items-center gap-2 pb-2">
            <Users className="h-5 w-5 text-primary" />
            <CardTitle className="text-base font-bold">{t("careProviders.title")}</CardTitle>
            {canAssignProviders && (
              <AdminIconButton
                label={t("careProviders.assign")}
                icon={Plus}
                onClick={() => setAssignProviderOpen(true)}
              />
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <ProviderHighlight label={t("careProviders.primaryCaregiver")} provider={primaryCaregiver} emptyLabel={t("careProviders.noPrimaryCaregiver")} />
              <ProviderHighlight label={t("careProviders.primaryProfessional")} provider={primaryProfessional} emptyLabel={t("careProviders.noPrimaryProfessional")} />
            </div>
            {careProviders.length === 0 ? (
              <EmptyLine icon={Users} label={t("careProviders.noProviders")} />
            ) : (
              <div className="space-y-4">
                {additionalEmergencyContacts.length > 0 && (
                  <ProviderGroup
                    title={t("careProviders.informalShort")}
                    providers={additionalEmergencyContacts}
                    emptyLabel={t("careProviders.noAdditionalEmergencyContacts")}
                    canAssignProviders={canAssignProviders}
                    showAdminControls={showAdminControls}
                    onEditCaregiver={(provider) => {
                      setEditCaregiverTarget({
                        id: provider.id,
                        assignment_id: provider.id,
                        care_provider_contact_id: provider.provider_id,
                        caretaker_name: provider.display_name,
                        caretaker_phone: provider.phone,
                        is_primary: provider.is_primary,
                        relationship_label: provider.relationship_label,
                        notes: provider.notes,
                      });
                      setEditCaregiverOpen(true);
                    }}
                    onUnassign={handleUnassignCareProvider}
                  />
                )}
                {redCrossStaffProviders.length > 0 && (
                  <ProviderGroup
                    title={t("careProviders.professionalShort")}
                    providers={redCrossStaffProviders}
                    emptyLabel={t("careProviders.noPrimaryProfessional")}
                    canAssignProviders={canAssignProviders}
                    showAdminControls={showAdminControls}
                    onUnassign={handleUnassignCareProvider}
                  />
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border bg-white shadow-sm">
          <CardHeader className="flex flex-row items-center gap-2 pb-2">
            <Activity className="h-5 w-5 text-vyva-teal" />
            <CardTitle className="text-base font-bold">{t("profile.sensorsAlerts")}</CardTitle>
            {showAdminControls && (
              <AdminIconButton
                label={t("profile.addSensor")}
                icon={Plus}
                onClick={() => {
                  setEditSensorTarget(null);
                  setEditSensorOpen(true);
                }}
              />
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {sensors.length === 0 ? (
              <EmptyLine icon={Activity} label={t("profile.noSensors")} />
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {sensors.map((sensor) => {
                  const online = sensor.status === "online";
                  return (
                    <div key={sensor.id} className="rounded-xl border border-border bg-muted/25 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="flex items-center gap-2 font-semibold text-foreground">
                            {online ? <Wifi className="h-4 w-4 text-emerald-600" /> : <WifiOff className="h-4 w-4 text-muted-foreground" />}
                            {sensor.device_name || sensor.device_id}
                          </p>
                          <p className="mt-1 text-xs font-semibold text-muted-foreground">{t(sensorTypeKey(sensor.sensor_type))}</p>
                        </div>
                        {showAdminControls && (
                          <AdminIconButton label={t("profile.editSensor")} onClick={() => { setEditSensorTarget(sensor); setEditSensorOpen(true); }} />
                        )}
                      </div>
                      {sensor.battery_level !== null && sensor.battery_level !== undefined && (
                        <div className="mt-3">
                          <div className="mb-1 flex justify-between text-xs font-semibold text-muted-foreground">
                            <span>{t("profile.battery")}</span>
                            <span>{sensor.battery_level}%</span>
                          </div>
                          <Progress value={sensor.battery_level} className="h-1.5" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="rounded-xl border border-border bg-muted/25 p-3">
              <div className="mb-3 flex items-center justify-between">
                <p className="font-semibold text-foreground">{t("profile.activeAlerts")}</p>
                <Badge variant={activeAlerts.length ? "destructive" : "secondary"} className="rounded-full">
                  {activeAlerts.length}
                </Badge>
              </div>
              {activeAlerts.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("profile.noActiveAlerts")}</p>
              ) : (
                <div className="space-y-2">
                  {activeAlerts.slice(0, 4).map((alert) => (
                    <div key={alert.id} className="flex gap-2 rounded-lg bg-white px-3 py-2 text-sm">
                      <AlertTriangle className={cn("mt-0.5 h-4 w-4 shrink-0", alert.severity === "critical" ? "text-red-600" : "text-orange-500")} />
                      <span className="font-medium text-foreground">{alert.message || t("queue.reason.default")}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
          </div>
        </TabsContent>

        <TabsContent value="plan" className="mt-0">
      <Card className="rounded-2xl border-border bg-white shadow-sm">
        <CardHeader className="flex flex-col gap-3 pb-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              <CardTitle className="text-base font-bold">{t("profile.healthPlanTitle")}</CardTitle>
            </div>
            <p className="text-sm text-muted-foreground">{t("profile.healthPlanDescription")}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {healthPlan && (
              <Button
                variant="outline"
                className="h-9 rounded-full px-3 text-xs font-bold"
                disabled={!canManageHealthPlan || generatingHealthPlan || refreshingHealthPlanSections.length > 0}
                onClick={() => setEditHealthPlanOpen(true)}
              >
                <Pencil className="mr-1.5 h-3.5 w-3.5" />
                {t("profile.edit")}
              </Button>
            )}
            {healthPlan && canManageHealthPlan && !healthPlanIsReviewed && (
              <Button
                variant="outline"
                className="h-9 rounded-full border-emerald-200 bg-emerald-50 px-3 text-xs font-bold text-emerald-700 hover:bg-emerald-100 hover:text-emerald-700"
                disabled={generatingHealthPlan || refreshingHealthPlanSections.length > 0}
                onClick={openHealthPlanReviewDialog}
              >
                <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
                {healthPlanReviewGovernance.review_required ? t("profile.healthPlanMarkReviewedUrgent") : t("profile.healthPlanMarkReviewed")}
              </Button>
            )}
            {canManageHealthPlan && (
              <Button
                className="h-9 rounded-full px-3 text-xs font-bold shadow-sm"
                disabled={generatingHealthPlan || refreshingHealthPlanSections.length > 0}
                onClick={() => void handleGenerateHealthPlan(Boolean(healthPlan))}
              >
                <Brain className={cn("mr-1.5 h-3.5 w-3.5", generatingHealthPlan && "animate-spin")} />
                {healthPlan ? t("profile.healthPlanRegenerate") : t("profile.healthPlanGenerate")}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {healthPlanError && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <p className="font-semibold">{t("profile.healthPlanGenerationFailed")}</p>
              <p className="mt-1">{healthPlanError}</p>
            </div>
          )}
          {healthPlanGenerationAcceptance && (
            <HealthPlanGenerationBlockersPanel acceptance={healthPlanGenerationAcceptance} />
          )}
          {displayedHealthPlanReadiness && (
            <HealthPlanPreGenerationChecklist
              summary={displayedHealthPlanReadiness}
              onActionSelect={handleHealthPlanReadinessAction}
              canGenerate={canManageHealthPlan}
              generating={generatingHealthPlan || refreshingHealthPlanSections.length > 0}
              hasPlan={Boolean(healthPlan)}
              onGenerate={() => void handleGenerateHealthPlan(Boolean(healthPlan))}
              onGenerateCautious={() => void handleGenerateHealthPlan(false, "cautious")}
            />
          )}
          <HealthPlanConditionSensorConfidencePanel
            healthConditions={healthConditions}
            mobilityNeeds={mobilityNeeds}
            medications={medications}
            medicationActivity={medicationActivity}
            checkins={checkins}
            brainCoach={brainCoach}
            sensors={sensors}
            careProviders={careProviders}
            livingContextKnown={context.livingContextKey !== "profile.livingContextUnknown"}
            sourceSignalCount={healthPlanSignalCount}
            activeAlertCount={activeAlerts.length}
          />

          {!healthPlan ? (
            <div className="grid gap-5 rounded-[24px] border border-dashed border-border/80 bg-[linear-gradient(180deg,rgba(245,243,255,0.7),rgba(255,255,255,0.96))] p-6 lg:grid-cols-[minmax(0,1.7fr)_280px]">
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="rounded-full bg-primary/10 px-3 py-1 text-primary hover:bg-primary/10">
                    {t("profile.healthPlanDraftBadge")}
                  </Badge>
                  <Badge variant="secondary" className="rounded-full px-3 py-1">
                    {t("profile.healthPlanReviewRequired")}
                  </Badge>
                </div>
                <div className="rounded-[18px] border border-white/80 bg-white/80 px-4 py-3">
                  <p className="max-w-4xl text-sm leading-7 text-muted-foreground">{t("profile.healthPlanEmpty")}</p>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-foreground/80">{t("profile.healthPlanReadyToShare")}</p>
                </div>
              </div>
              <div className="rounded-[20px] border border-white/80 bg-white/85 p-5 shadow-sm">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("profile.healthPlanReviewTitle")}</p>
                <div className="mt-4 space-y-3">
                  <HealthPlanChecklistItem text={t("profile.healthPlanReviewSummary")} />
                  <HealthPlanChecklistItem text={t("profile.healthPlanReviewTiming")} />
                  <HealthPlanChecklistItem text={t("profile.healthPlanReviewEscalation")} />
                </div>
              </div>
            </div>
          ) : (
            <div className="overflow-hidden rounded-[24px] border border-primary/12 bg-[linear-gradient(180deg,rgba(246,243,255,0.82),rgba(255,255,255,1))]">
              <div className="px-6 py-6">
                <div className="flex flex-col gap-5">
                  <div className="min-w-0 space-y-4">
                    <div className="flex flex-wrap items-center gap-2">
                      {healthPlanIsReviewed ? (
                        <Badge className="rounded-full bg-emerald-600 px-3 py-1 text-white hover:bg-emerald-600">
                          {healthPlanReviewGovernance.review_required ? t("profile.healthPlanReviewedUrgentBadge") : t("profile.healthPlanReviewedBadge")}
                        </Badge>
                      ) : (
                        <>
                          <Badge className="rounded-full bg-primary px-3 py-1 text-white hover:bg-primary">
                            {t("profile.healthPlanDraftBadge")}
                          </Badge>
                          <Badge
                            variant="secondary"
                            className={cn(
                              "rounded-full px-3 py-1",
                              healthPlanReviewPending && healthPlanReviewGovernance.review_window === "today" && "bg-rose-100 text-rose-700",
                              healthPlanReviewPending && healthPlanReviewGovernance.review_window === "this_week" && "bg-amber-100 text-amber-800",
                            )}
                          >
                            {healthPlanReviewPending
                              ? healthPlanReviewGovernance.review_window === "today"
                                ? t("profile.healthPlanReviewUrgentPending")
                                : healthPlanReviewGovernance.review_window === "this_week"
                                  ? t("profile.healthPlanReviewThisWeekPending")
                                  : t("profile.healthPlanReviewRequired")
                              : t("profile.healthPlanReviewRequired")}
                          </Badge>
                        </>
                      )}
                      {healthPlanFreshness && healthPlanFreshness.status !== "current" && (
                        <Badge variant="outline" className={cn("rounded-full px-3 py-1 font-semibold", healthPlanFreshnessTone(healthPlanFreshness.status))}>
                          {healthPlanFreshnessLabel(t, healthPlanFreshness.status)}
                        </Badge>
                      )}
                    </div>
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("profile.healthPlanSummary")}</p>
                      <p className="mt-3 max-w-5xl text-[15px] font-medium leading-8 text-foreground">{healthPlan.summary_text || "-"}</p>
                    </div>
                    <p className="text-sm leading-6 text-foreground/75">
                      {healthPlanIsReviewed
                        ? (healthPlanFreshness && ["stale", "critical"].includes(healthPlanFreshness.status || "")
                          ? t("profile.healthPlanReviewedStaleSummary")
                          : (healthPlanReviewGovernance.review_required ? t("profile.healthPlanReviewedUrgentSummary") : t("profile.healthPlanReviewedSummary")))
                        : (healthPlanReviewGovernance.review_summary || t("profile.healthPlanReadyToShare"))}
                    </p>
                    <HealthPlanPriorityHandoffBanner summary={healthPlanExecutionBrief} />
                    <div className="flex flex-wrap gap-2.5">
                      <HealthPlanMetaChip label={t("profile.healthPlanLastGenerated")} value={healthPlan.generated_at ? formatDateTime(healthPlan.generated_at) : "-"} />
                      <HealthPlanMetaChip label={t("profile.language")} value={(healthPlan.language || user.language || "-").toString().toUpperCase()} />
                      <HealthPlanMetaChip label={t("profile.healthPlanGoals")} value={String(healthPlanSectionCount)} />
                      <HealthPlanMetaChip label={t("profile.healthPlanGenerationMode")} value={healthPlanUsesFallback ? t("profile.healthPlanModeFallback") : t("profile.healthPlanModeAI")} />
                      <HealthPlanMetaChip label={t("profile.healthPlanHighPrioritySignals")} value={String(healthPlanHighPrioritySignals)} />
                      <HealthPlanMetaChip label={t("profile.healthPlanEscalationGrade")} value={healthPlanEscalationGradeLabel(t, healthPlanEscalationGrade.grade)} />
                      <HealthPlanMetaChip label={t("profile.healthPlanReviewReadinessChip")} value={healthPlanReviewReadinessLabel(t, healthPlanReviewReadiness?.overall_status)} />
                      <HealthPlanMetaChip label={t("profile.healthPlanFreshnessLabel")} value={healthPlanFreshness ? healthPlanFreshnessLabel(t, healthPlanFreshness.status) : "-"} />
                    </div>
                    <Tabs defaultValue="plan" className="flex flex-col gap-5">
                      <TabsList className="flex h-auto flex-wrap gap-2 bg-slate-100/85 p-1">
                        <TabsTrigger className="rounded-full px-4 py-2 text-sm font-semibold data-[state=active]:bg-white data-[state=active]:shadow-sm" value="plan">
                          {t("profile.healthPlanWorkspacePlan")}
                        </TabsTrigger>
                        <TabsTrigger className="rounded-full px-4 py-2 text-sm font-semibold data-[state=active]:bg-white data-[state=active]:shadow-sm" value="review">
                          {t("profile.healthPlanWorkspaceReview")}
                        </TabsTrigger>
                        <TabsTrigger className="rounded-full px-4 py-2 text-sm font-semibold data-[state=active]:bg-white data-[state=active]:shadow-sm" value="signals">
                          {t("profile.healthPlanWorkspaceSignals")}
                        </TabsTrigger>
                        <TabsTrigger className="rounded-full px-4 py-2 text-sm font-semibold data-[state=active]:bg-white data-[state=active]:shadow-sm" value="history">
                          {t("profile.healthPlanWorkspaceHistory")}
                        </TabsTrigger>
                      </TabsList>

                      <TabsContent value="review" className="mt-0 space-y-4">
                    {(healthPlanSectionDrift.length > 0 || safeArray(healthPlanRefreshStrategy?.recommended_sections).length > 0) && (
                      <HealthPlanSectionDriftPanel
                        drift={healthPlanSectionDrift}
                        refreshStrategy={healthPlanRefreshStrategy}
                        canManage={canManageHealthPlan}
                        refreshingSectionKeys={refreshingHealthPlanSections}
                        onRefreshSection={(sectionKey) => void handleRefreshHealthPlanSections([sectionKey])}
                        onRefreshHighlighted={
                          safeArray(healthPlanRefreshStrategy?.refresh_now_section_keys).length > 1
                            ? () => void handleRefreshHealthPlanSections(safeArray(healthPlanRefreshStrategy?.refresh_now_section_keys))
                            : undefined
                        }
                        onRegenerateAll={healthPlanRefreshStrategy?.full_regeneration_preferred ? () => void handleGenerateHealthPlan(true) : undefined}
                      />
                    )}
                    {healthPlanFreshness && (
                      <HealthPlanFreshnessPanel summary={healthPlanFreshness} />
                    )}
                    {healthPlanExecutionBrief && (
                      <HealthPlanExecutionBriefPanel summary={healthPlanExecutionBrief} />
                    )}
                    {healthPlanFollowThrough && (
                      <HealthPlanFollowThroughPanel summary={healthPlanFollowThrough} />
                    )}
                    {healthPlanActionImpact && (
                      <HealthPlanActionImpactPanel summary={healthPlanActionImpact} />
                    )}
                    {healthPlanRecommendationImpact && (
                      <HealthPlanRecommendationImpactPanel summary={healthPlanRecommendationImpact} />
                    )}
                    {healthPlanRecommendationHistory && (
                      <HealthPlanRecommendationHistoryPanel summary={healthPlanRecommendationHistory} />
                    )}
                    {healthPlanOutcomePatternMemory && (
                      <HealthPlanOutcomePatternMemoryPanel summary={healthPlanOutcomePatternMemory} />
                    )}
                    {healthPlanRecommendationEvidenceDiversity && (
                      <HealthPlanRecommendationEvidenceDiversityPanel summary={healthPlanRecommendationEvidenceDiversity} />
                    )}
                    {healthPlanRecommendationReview?.item_count > 0 && (
                      <HealthPlanRecommendationReviewSummaryPanel summary={healthPlanRecommendationReview} />
                    )}
                    {healthPlanLiveEvidence && (
                      <HealthPlanLiveEvidencePanel summary={healthPlanLiveEvidence} />
                    )}
                    {healthPlanLongitudinalMemory && safeArray(healthPlanLongitudinalMemory?.domains).length > 0 && (
                      <HealthPlanLongitudinalMemoryPanel summary={healthPlanLongitudinalMemory} />
                    )}
                    {healthPlanReviewReadiness && (
                      <HealthPlanReviewReadinessPanel summary={healthPlanReviewReadiness} />
                    )}
                    {healthPlanTrustVerdict && (
                      <HealthPlanTrustVerdictPanel summary={healthPlanTrustVerdict} />
                    )}
                    {healthPlanReviewRemediation && (
                      <HealthPlanReviewRemediationPanel
                        summary={healthPlanReviewRemediation}
                        canManage={canManageHealthPlan}
                        refreshingSectionKeys={refreshingHealthPlanSections}
                        generating={generatingHealthPlan}
                        onRefreshSections={(sectionKeys) => void handleRefreshHealthPlanSections(sectionKeys)}
                        onRegenerateAll={() => void handleGenerateHealthPlan(true)}
                        onOpenReview={openHealthPlanReviewDialog}
                      />
                    )}
                    {healthPlanRecommendationEffectiveness && (
                      <HealthPlanRecommendationEffectivenessPanel summary={healthPlanRecommendationEffectiveness} />
                    )}
                    {healthPlanRecommendationRevisionMemory && (
                      <HealthPlanRecommendationRevisionMemoryPanel summary={healthPlanRecommendationRevisionMemory} />
                    )}
                    {healthPlanOperationalCompleteness && (
                      <HealthPlanOperationalCompletenessPanel summary={healthPlanOperationalCompleteness} />
                    )}
                    {healthPlanGenerationQuality && (
                      <HealthPlanGenerationQualityPanel summary={healthPlanGenerationQuality} />
                    )}
                    {healthPlanRecommendationGrounding && (
                      <HealthPlanRecommendationGroundingPanel summary={healthPlanRecommendationGrounding} />
                    )}
                    {healthPlanRecommendationCalibration?.adjustment_count > 0 && (
                      <HealthPlanRecommendationCalibrationPanel summary={healthPlanRecommendationCalibration} />
                    )}
                    {healthPlanBenchmarkAssessment && (
                      <HealthPlanBenchmarkPanel summary={healthPlanBenchmarkAssessment} />
                    )}
                    {healthPlanHistoryReplay?.total_tracks > 0 && (
                      <HealthPlanHistoryReplayPanel summary={healthPlanHistoryReplay} />
                    )}
                    {healthPlanRecommendationCoverage && (
                      <HealthPlanRecommendationCoveragePanel summary={healthPlanRecommendationCoverage} />
                    )}
                    {healthPlanRecommendationChallenges && (
                      <HealthPlanRecommendationChallengePanel summary={healthPlanRecommendationChallenges} />
                    )}
                    {safeArray(healthPlanReviewPriorities?.items).length > 0 && (
                      <HealthPlanReviewPriorityPanel summary={healthPlanReviewPriorities} />
                    )}
                    {healthPlanClinicalCautions.length > 0 && (
                      <HealthPlanClinicalCautionPanel
                        cautions={healthPlanClinicalCautions}
                        issues={healthPlanClinicalCautionIssues}
                      />
                    )}
                    <HealthPlanEscalationPanel grade={healthPlanEscalationGrade} />
                    {healthPlanConfidenceProfile && (
                      <HealthPlanConfidencePanel profile={healthPlanConfidenceProfile} />
                    )}
                    {healthPlanEvidenceConflicts.length > 0 && (
                      <HealthPlanEvidenceConflictPanel items={healthPlanEvidenceConflicts} />
                    )}
                    {healthPlanEvidenceHierarchy.length > 0 && (
                      <HealthPlanEvidenceHierarchyPanel items={healthPlanEvidenceHierarchy} />
                    )}
                    {healthPlanOutcomeScores.length > 0 && (
                      <HealthPlanOutcomePanel
                        items={healthPlanOutcomeScores}
                        canManage={canManageHealthPlan}
                        onRecordFeedback={(sectionKey, latestOutcome, latestNote) => openHealthPlanFeedbackDialog(sectionKey, latestOutcome, latestNote)}
                      />
                    )}
                    {healthPlanInterventionMemory.length > 0 && (
                      <HealthPlanInterventionMemoryPanel items={healthPlanInterventionMemory} />
                    )}
                    {healthPlanRecommendationSurvivorship.total_patterns > 0 && (
                      <HealthPlanRecommendationSurvivorshipPanel summary={healthPlanRecommendationSurvivorship} />
                    )}
                    {canManageHealthPlan && healthPlanImprovementActions.length > 0 && (
                      <HealthPlanImprovementPanel
                        actions={healthPlanImprovementActions}
                        completingActionIds={completingHealthPlanActionIds}
                        onCompleteAction={(actionId) => void handleCompleteHealthPlanImprovementAction(actionId)}
                      />
                    )}
                    {healthPlanUsesFallback && (
                      <div className="rounded-[18px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                        <p className="font-semibold">{t("profile.healthPlanModeFallback")}</p>
                        <p className="mt-1">{t("profile.healthPlanFallbackSummary")}</p>
                      </div>
                    )}
                    {healthPlanIsReviewed && (healthPlan.reviewed_at || healthPlanReviewedBy) && (
                      <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
                        {healthPlan.reviewed_at && (
                          <span>
                            {t("profile.healthPlanReviewedAt")}: <span className="font-medium text-foreground">{formatDateTime(healthPlan.reviewed_at)}</span>
                          </span>
                        )}
                        {healthPlanReviewedBy && (
                          <span>
                            {t("profile.healthPlanReviewedBy")}: <span className="font-medium text-foreground">{healthPlanReviewedBy}</span>
                          </span>
                        )}
                        {healthPlan.review_note && (
                          <span className="basis-full">
                            {t("profile.healthPlanReviewNoteLabel")}: <span className="font-medium text-foreground">{healthPlan.review_note}</span>
                          </span>
                        )}
                      </div>
                    )}
                    {healthPlanIsReviewed && (
                      <HealthPlanReviewChecklistSummary checklist={healthPlan.review_checklist_json} className="max-w-3xl" />
                    )}
                      </TabsContent>

                      <TabsContent value="plan" className="mt-0">

              {latestHealthPlanChange && (
                <div className="border-t border-primary/10 bg-slate-50/55 px-6 py-5">
                  <HealthPlanRecommendationChangePanel change={latestHealthPlanChange} />
                </div>
              )}

              <div className="space-y-5 border-t border-primary/10 bg-white/80 p-6">
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-[18px] border border-border/80 bg-white/92 px-4 py-4 shadow-sm">
                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("profile.healthPlanReviewTitle")}</p>
                    <p className="mt-2 text-sm font-semibold text-foreground">
                      {healthPlanIsReviewed ? t("profile.healthPlanReviewedBadge") : t("profile.healthPlanReviewRequired")}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">{healthPlanReviewWindowLabel(t, healthPlanReviewGovernance.review_window)}</p>
                  </div>
                  <div className="rounded-[18px] border border-border/80 bg-white/92 px-4 py-4 shadow-sm">
                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("profile.healthPlanSourceSignals")}</p>
                    <p className="mt-2 text-sm font-semibold text-foreground">{healthPlanSignalCount}</p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">{t("profile.healthPlanEvidenceLinked")}: {healthPlanEvidenceLinkedCount}</p>
                  </div>
                  <div className="rounded-[18px] border border-border/80 bg-white/92 px-4 py-4 shadow-sm">
                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("profile.healthPlanGenerationQualityChip")}</p>
                    <p className="mt-2 text-sm font-semibold text-foreground">{healthPlanGenerationStatusLabel(t, healthPlanGenerationQuality?.overall_status)}</p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">{t("profile.healthPlanGapCount")}: {healthPlanDataQualityGaps.length}</p>
                  </div>
                </div>

                <div className="min-w-0 space-y-4">
                  <Tabs defaultValue="support" className="space-y-5">
                    <TabsList className="h-auto rounded-full bg-slate-100/90 p-1">
                      <TabsTrigger className="rounded-full px-4 py-2 text-sm font-semibold data-[state=active]:bg-white data-[state=active]:shadow-sm" value="support">
                        {t("profile.healthPlanGoals")}
                      </TabsTrigger>
                      <TabsTrigger className="rounded-full px-4 py-2 text-sm font-semibold data-[state=active]:bg-white data-[state=active]:shadow-sm" value="monitoring">
                        {t("profile.healthPlanMonitoring")}
                      </TabsTrigger>
                      <TabsTrigger className="rounded-full px-4 py-2 text-sm font-semibold data-[state=active]:bg-white data-[state=active]:shadow-sm" value="caregiver">
                        {t("profile.healthPlanCaregiverGuidance")}
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="support" className="mt-0">
                      <div className="grid gap-5 lg:grid-cols-2">
                        <HealthPlanTextSection
                          title={t("profile.healthPlanGoals")}
                          items={healthPlan.goals_json}
                          signalLookup={healthPlanSignalLookup}
                          evidenceLabel={t("profile.healthPlanEvidence")}
                          trace={healthPlanDecisionTraceLookup.get("goals_json")}
                          showTrace={canManageHealthPlan}
                          canRecordFeedback={canManageHealthPlan}
                          recommendationLearningLookup={healthPlanRecommendationLearningLookup}
                          recommendationSourceRankingLookup={healthPlanRecommendationSourceRankingLookup}
                          recommendationGroundingLookup={healthPlanRecommendationGroundingLookup}
                          recommendationRepairLookup={healthPlanRecommendationRepairLookup}
                          sectionKey="goals_json"
                          onRefreshSection={canManageHealthPlan ? () => void handleRefreshHealthPlanSections(["goals_json"]) : undefined}
                          onRecordFeedback={(item) => openHealthPlanFeedbackDialog("goals_json", healthPlanRecommendationLearningLookup.get(item.id || "")?.latest_outcome, healthPlanRecommendationLearningLookup.get(item.id || "")?.latest_note, item.id || null, item.text || null, healthPlanRecommendationLearningLookup.get(item.id || "")?.latest_recommended_next_action, healthPlanRecommendationLearningLookup.get(item.id || "")?.latest_confidence_level)}
                        />
                        <HealthPlanTextSection
                          title={t("profile.healthPlanDailySupport")}
                          items={healthPlan.daily_support_json}
                          signalLookup={healthPlanSignalLookup}
                          evidenceLabel={t("profile.healthPlanEvidence")}
                          trace={healthPlanDecisionTraceLookup.get("daily_support_json")}
                          showTrace={canManageHealthPlan}
                          canRecordFeedback={canManageHealthPlan}
                          recommendationLearningLookup={healthPlanRecommendationLearningLookup}
                          recommendationSourceRankingLookup={healthPlanRecommendationSourceRankingLookup}
                          recommendationGroundingLookup={healthPlanRecommendationGroundingLookup}
                          recommendationRepairLookup={healthPlanRecommendationRepairLookup}
                          sectionKey="daily_support_json"
                          onRefreshSection={canManageHealthPlan ? () => void handleRefreshHealthPlanSections(["daily_support_json"]) : undefined}
                          onRecordFeedback={(item) => openHealthPlanFeedbackDialog("daily_support_json", healthPlanRecommendationLearningLookup.get(item.id || "")?.latest_outcome, healthPlanRecommendationLearningLookup.get(item.id || "")?.latest_note, item.id || null, item.text || null, healthPlanRecommendationLearningLookup.get(item.id || "")?.latest_recommended_next_action, healthPlanRecommendationLearningLookup.get(item.id || "")?.latest_confidence_level)}
                        />
                      </div>
                    </TabsContent>

                    <TabsContent value="monitoring" className="mt-0">
                      <div className="grid gap-5 lg:grid-cols-2">
                        <HealthPlanTextSection
                          title={t("profile.healthPlanMonitoring")}
                          items={healthPlan.monitoring_json}
                          signalLookup={healthPlanSignalLookup}
                          evidenceLabel={t("profile.healthPlanEvidence")}
                          trace={healthPlanDecisionTraceLookup.get("monitoring_json")}
                          showTrace={canManageHealthPlan}
                          canRecordFeedback={canManageHealthPlan}
                          recommendationLearningLookup={healthPlanRecommendationLearningLookup}
                          recommendationSourceRankingLookup={healthPlanRecommendationSourceRankingLookup}
                          recommendationGroundingLookup={healthPlanRecommendationGroundingLookup}
                          recommendationRepairLookup={healthPlanRecommendationRepairLookup}
                          sectionKey="monitoring_json"
                          onRefreshSection={canManageHealthPlan ? () => void handleRefreshHealthPlanSections(["monitoring_json"]) : undefined}
                          onRecordFeedback={(item) => openHealthPlanFeedbackDialog("monitoring_json", healthPlanRecommendationLearningLookup.get(item.id || "")?.latest_outcome, healthPlanRecommendationLearningLookup.get(item.id || "")?.latest_note, item.id || null, item.text || null, healthPlanRecommendationLearningLookup.get(item.id || "")?.latest_recommended_next_action, healthPlanRecommendationLearningLookup.get(item.id || "")?.latest_confidence_level)}
                        />
                        <HealthPlanTextSection
                          title={t("profile.healthPlanEscalation")}
                          items={healthPlan.escalation_json}
                          signalLookup={healthPlanSignalLookup}
                          evidenceLabel={t("profile.healthPlanEvidence")}
                          trace={healthPlanDecisionTraceLookup.get("escalation_json")}
                          showTrace={canManageHealthPlan}
                          canRecordFeedback={canManageHealthPlan}
                          recommendationLearningLookup={healthPlanRecommendationLearningLookup}
                          recommendationSourceRankingLookup={healthPlanRecommendationSourceRankingLookup}
                          recommendationGroundingLookup={healthPlanRecommendationGroundingLookup}
                          recommendationRepairLookup={healthPlanRecommendationRepairLookup}
                          sectionKey="escalation_json"
                          onRefreshSection={canManageHealthPlan ? () => void handleRefreshHealthPlanSections(["escalation_json"]) : undefined}
                          onRecordFeedback={(item) => openHealthPlanFeedbackDialog("escalation_json", healthPlanRecommendationLearningLookup.get(item.id || "")?.latest_outcome, healthPlanRecommendationLearningLookup.get(item.id || "")?.latest_note, item.id || null, item.text || null, healthPlanRecommendationLearningLookup.get(item.id || "")?.latest_recommended_next_action, healthPlanRecommendationLearningLookup.get(item.id || "")?.latest_confidence_level)}
                        />
                      </div>
                    </TabsContent>

                    <TabsContent value="caregiver" className="mt-0">
                      <HealthPlanTextSection
                        title={t("profile.healthPlanCaregiverGuidance")}
                        items={healthPlan.caregiver_guidance_json}
                        signalLookup={healthPlanSignalLookup}
                        evidenceLabel={t("profile.healthPlanEvidence")}
                        trace={healthPlanDecisionTraceLookup.get("caregiver_guidance_json")}
                        showTrace={canManageHealthPlan}
                        canRecordFeedback={canManageHealthPlan}
                        recommendationLearningLookup={healthPlanRecommendationLearningLookup}
                        recommendationSourceRankingLookup={healthPlanRecommendationSourceRankingLookup}
                        recommendationGroundingLookup={healthPlanRecommendationGroundingLookup}
                        recommendationRepairLookup={healthPlanRecommendationRepairLookup}
                        sectionKey="caregiver_guidance_json"
                        onRefreshSection={canManageHealthPlan ? () => void handleRefreshHealthPlanSections(["caregiver_guidance_json"]) : undefined}
                        onRecordFeedback={(item) => openHealthPlanFeedbackDialog("caregiver_guidance_json", healthPlanRecommendationLearningLookup.get(item.id || "")?.latest_outcome, healthPlanRecommendationLearningLookup.get(item.id || "")?.latest_note, item.id || null, item.text || null, healthPlanRecommendationLearningLookup.get(item.id || "")?.latest_recommended_next_action, healthPlanRecommendationLearningLookup.get(item.id || "")?.latest_confidence_level)}
                      />
                    </TabsContent>
                  </Tabs>
                </div>

                {false && (
                  <aside className="overflow-hidden rounded-[22px] border border-border/80 bg-white/88 shadow-sm">
                  <div className="p-5">
                    <div className="flex items-start gap-3">
                      <span className={cn(
                        "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm",
                        healthPlanIsReviewed ? "text-emerald-600" : "text-primary",
                      )}>
                        <ShieldCheck className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          {healthPlanIsReviewed ? t("profile.healthPlanReviewReceipt") : t("profile.healthPlanReviewTitle")}
                        </p>
                        <p className="mt-1 text-sm leading-6 text-muted-foreground">
                          {healthPlanIsReviewed
                            ? (healthPlanFreshness && ["stale", "critical"].includes(healthPlanFreshness.status || "")
                              ? t("profile.healthPlanReviewedStaleSummary")
                              : (healthPlanReviewGovernance.review_required ? t("profile.healthPlanReviewedUrgentSummary") : t("profile.healthPlanReviewedSummary")))
                            : (healthPlanReviewGovernance.review_summary || t("profile.healthPlanReviewDescription"))}
                        </p>
                      </div>
                    </div>
                    {healthPlanReviewReasons.length > 0 && (
                      <div className="mt-4 space-y-3">
                        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("profile.healthPlanReviewDrivers")}</p>
                        {healthPlanReviewReasons.slice(0, 3).map((item, index) => (
                          <div key={item.id || `${item.label}-${index}`} className="rounded-[16px] border border-border/80 bg-slate-50/80 px-3.5 py-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-semibold text-foreground">{item.label || "-"}</p>
                              <Badge
                                variant="outline"
                                className={cn(
                                  "rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                                  item.severity === "high" ? "border-rose-200 text-rose-700" : item.severity === "low" ? "border-emerald-200 text-emerald-700" : "border-amber-200 text-amber-700",
                                )}
                              >
                                {item.severity === "high" ? t("profile.healthPlanSignalHigh") : item.severity === "low" ? t("profile.healthPlanSignalLow") : t("profile.healthPlanSignalMedium")}
                              </Badge>
                            </div>
                            {item.detail && <p className="mt-1 text-sm leading-6 text-muted-foreground">{item.detail}</p>}
                          </div>
                        ))}
                      </div>
                    )}
                    {healthPlanIsReviewed ? (
                      <div className="mt-4 space-y-4">
                        {(healthPlan.reviewed_at || healthPlanReviewedBy) && (
                          <div className="rounded-[18px] border border-emerald-100 bg-emerald-50 px-4 py-4 text-sm text-emerald-950">
                            {healthPlan.reviewed_at && (
                              <p>{t("profile.healthPlanReviewedAt")}: {formatDateTime(healthPlan.reviewed_at)}</p>
                            )}
                            {healthPlanReviewedBy && (
                              <p className={cn(healthPlan.reviewed_at && "mt-1.5")}>
                                {t("profile.healthPlanReviewedBy")}: {healthPlanReviewedBy}
                              </p>
                            )}
                            {healthPlan.review_note && (
                              <p className={cn((healthPlan.reviewed_at || healthPlanReviewedBy) && "mt-1.5")}>
                                {t("profile.healthPlanReviewNoteLabel")}: {healthPlan.review_note}
                              </p>
                            )}
                          </div>
                        )}
                        {healthPlanIsReviewed && <HealthPlanReviewChecklistSummary checklist={healthPlan.review_checklist_json} />}
                        <div className="rounded-[18px] border border-border/80 bg-slate-50/85 px-4 py-3 text-sm text-foreground/80">
                          <p>
                            {t("profile.healthPlanReviewWindowLabel")}: <span className="font-medium text-foreground">{healthPlanReviewWindowLabel(t, healthPlanReviewGovernance.review_window)}</span>
                          </p>
                        </div>
                        <div className="space-y-3">
                          <HealthPlanChecklistItem text={t("profile.healthPlanReviewSummary")} />
                          <HealthPlanChecklistItem text={t("profile.healthPlanReviewTiming")} />
                          <HealthPlanChecklistItem text={t("profile.healthPlanReviewEscalation")} />
                        </div>
                      </div>
                    ) : (
                      <div className="mt-4 space-y-3">
                        <HealthPlanChecklistItem text={t("profile.healthPlanReviewSummary")} />
                        <HealthPlanChecklistItem text={t("profile.healthPlanReviewTiming")} />
                        <HealthPlanChecklistItem text={t("profile.healthPlanReviewEscalation")} />
                      </div>
                    )}
                  </div>
                  <div className="border-t border-border/80 px-5 py-4">
                    <div className="pb-4">
                      <HealthPlanDataQualityPanel gaps={healthPlanDataQualityGaps} />
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("profile.healthPlanSourceSignals")}</p>
                      </div>
                      <Badge variant="secondary" className="rounded-full px-3 py-1">{healthPlanSignalCount}</Badge>
                    </div>
                  </div>
                  <div className="max-h-[520px] overflow-y-auto px-5 pb-3">
                    {Array.isArray(healthPlan.source_signals_json) && healthPlan.source_signals_json.length > 0 ? (
                      healthPlan.source_signals_json.map((signal, index) => (
                        <div
                          key={signal.id || `${signal.label}-${index}`}
                          className={cn("py-3", index > 0 && "border-t border-border/70")}
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold leading-6 text-foreground">{signal.label}</p>
                            <Badge
                              variant="outline"
                              className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", healthPlanSignalBadgeClasses(inferHealthPlanSignalStrength(signal)))}
                            >
                              {t(`profile.healthPlanSignal${inferHealthPlanSignalStrength(signal).charAt(0).toUpperCase()}${inferHealthPlanSignalStrength(signal).slice(1)}`)}
                            </Badge>
                          </div>
                          {signal.detail && <p className="mt-1 text-xs leading-5 text-muted-foreground">{signal.detail}</p>}
                        </div>
                      ))
                    ) : (
                      <p className="py-3 text-sm text-muted-foreground">{t("profile.healthPlanNoSourceSignals")}</p>
                    )}
                  </div>
                  </aside>
                )}
              </div>

                      </TabsContent>

                      <TabsContent value="signals" className="mt-0">
                        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
                          <HealthPlanDataQualityPanel gaps={healthPlanDataQualityGaps} />
                          <div className="overflow-hidden rounded-[22px] border border-border/80 bg-white/88 shadow-sm">
                            <div className="border-b border-border/80 px-5 py-4">
                              <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("profile.healthPlanSourceSignals")}</p>
                      </div>
                                <Badge variant="secondary" className="rounded-full px-3 py-1">{healthPlanSignalCount}</Badge>
                              </div>
                            </div>
                            <div className="max-h-[760px] overflow-y-auto px-5 pb-3 pt-1">
                              {Array.isArray(healthPlan.source_signals_json) && healthPlan.source_signals_json.length > 0 ? (
                                healthPlan.source_signals_json.map((signal, index) => (
                                  <div
                                    key={signal.id || `${signal.label}-${index}`}
                                    className={cn("py-3", index > 0 && "border-t border-border/70")}
                                  >
                                    <div className="flex flex-wrap items-center gap-2">
                                      <p className="text-sm font-semibold leading-6 text-foreground">{signal.label}</p>
                                      <Badge
                                        variant="outline"
                                        className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", healthPlanSignalBadgeClasses(inferHealthPlanSignalStrength(signal)))}
                                      >
                                        {t(`profile.healthPlanSignal${inferHealthPlanSignalStrength(signal).charAt(0).toUpperCase()}${inferHealthPlanSignalStrength(signal).slice(1)}`)}
                                      </Badge>
                                    </div>
                                    {signal.detail && <p className="mt-1 text-xs leading-5 text-muted-foreground">{signal.detail}</p>}
                                  </div>
                                ))
                              ) : (
                                <p className="py-3 text-sm text-muted-foreground">{t("profile.healthPlanNoSourceSignals")}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      </TabsContent>

                      <TabsContent value="history" className="mt-0">
                        <div className="border-t border-primary/10 bg-slate-50/70 px-6 py-6">
                          <HealthPlanHistorySection history={healthPlanHistory} />
                        </div>
                      </TabsContent>
                      </Tabs>
                  </div>
                </div>
              </div>
            </div>
            )}
        </CardContent>
      </Card>
        </TabsContent>

        <TabsContent value="timeline" className="mt-0">
      <Card className="rounded-2xl border-border bg-white shadow-sm">
        <CardHeader className="flex flex-row items-center gap-2 pb-2">
          <FileText className="h-5 w-5 text-primary" />
          <CardTitle className="text-base font-bold">{t("profile.activityTimeline")}</CardTitle>
        </CardHeader>
        <CardContent>
          {eventTimeline.length === 0 ? (
            <EmptyLine icon={Clock} label={t("profile.noTimeline")} />
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {eventTimeline.map((event, index) => {
                const EventIcon = event.icon;
                return (
                  <div key={`${event.label}-${event.date || index}`} className="flex gap-3 rounded-xl border border-border bg-muted/25 p-3">
                    <span
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                        event.tone === "red" && "bg-red-50 text-red-600",
                        event.tone === "orange" && "bg-orange-50 text-orange-600",
                        event.tone === "teal" && "bg-emerald-50 text-emerald-600",
                        event.tone === "pink" && "bg-vyva-pink/10 text-vyva-pink",
                        event.tone === "muted" && "bg-muted text-muted-foreground",
                        event.tone === "primary" && "bg-primary/10 text-primary",
                      )}
                    >
                      <EventIcon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground">{event.label}</p>
                      {event.detail && <p className="mt-1 text-sm leading-5 text-muted-foreground">{event.detail}</p>}
                      {event.date && <p className="mt-1 text-xs font-medium text-muted-foreground">{formatDateTime(event.date)}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
        </TabsContent>
      </Tabs>

      {editUserOpen && <EditUserDialog open={editUserOpen} onOpenChange={setEditUserOpen} user={user} profileData={data} />}
      {editHealthOpen && health && <EditHealthDialog open={editHealthOpen} onOpenChange={setEditHealthOpen} vyvaUserId={user.id} health={health} />}
      {editMedOpen && <EditMedicationDialog open={editMedOpen} onOpenChange={setEditMedOpen} vyvaUserId={user.id} medication={editMedTarget} />}
      {editCaregiverOpen && <EditCaregiverDialog open={editCaregiverOpen} onOpenChange={setEditCaregiverOpen} vyvaUserId={user.id} caregiver={editCaregiverTarget} />}
      {assignProviderOpen && (
        <AssignCareProviderDialog
          open={assignProviderOpen}
          onOpenChange={setAssignProviderOpen}
          userId={user.id}
          userName={fullName}
        />
      )}
      {editCheckinOpen && <EditServiceDialog open={editCheckinOpen} onOpenChange={setEditCheckinOpen} vyvaUserId={user.id} service={checkins} serviceName="Check-in" serviceType="checkin" />}
      {editBrainOpen && <EditServiceDialog open={editBrainOpen} onOpenChange={setEditBrainOpen} vyvaUserId={user.id} service={brainCoach} serviceName="Brain Coach" serviceType="brainCoach" />}
      {editSensorOpen && <EditSensorDialog open={editSensorOpen} onOpenChange={setEditSensorOpen} vyvaUserId={user.id} sensor={editSensorTarget} />}
      {editHealthPlanOpen && healthPlan && (
        <EditHealthPlanDialog
          open={editHealthPlanOpen}
          onOpenChange={setEditHealthPlanOpen}
          vyvaUserId={user.id}
          plan={healthPlan}
        />
      )}
      <Dialog open={insufficientHealthPlanSignalsOpen} onOpenChange={setInsufficientHealthPlanSignalsOpen}>
        <DialogContent className="max-w-lg rounded-2xl border-border bg-white">
          <DialogHeader>
            <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-amber-50 text-amber-600">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <DialogTitle>{t("profile.healthPlanInsufficientSignalsTitle")}</DialogTitle>
            <DialogDescription className="leading-6">
              {t("profile.healthPlanInsufficientSignalsDescription")}
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">
            {t("profile.healthPlanInsufficientSignalsNext")}
          </div>
          {healthPlanSignalReviewItems.length > 0 && (
            <div className="space-y-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                {t("profile.healthPlanInsufficientSignalsChecklist")}
              </p>
              <div className="space-y-2">
                {healthPlanSignalReviewItems.map((item, index) => (
                  <div
                    key={`${item.id || item.title || index}-${index}`}
                    className="rounded-xl border border-border/80 bg-slate-50/80 px-3.5 py-3"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold leading-5 text-foreground">{item.title || t("profile.healthPlanGenerationBlockedFallback")}</p>
                      <Badge
                        variant="outline"
                        className={cn(
                          "rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                          item.tone === "high" ? "border-rose-200 text-rose-700" : item.tone === "low" ? "border-emerald-200 text-emerald-700" : "border-amber-200 text-amber-700",
                        )}
                      >
                        {item.tone === "high" ? t("profile.healthPlanSignalHigh") : item.tone === "low" ? t("profile.healthPlanSignalLow") : t("profile.healthPlanSignalMedium")}
                      </Badge>
                    </div>
                    {item.detail && (
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">{item.detail}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setInsufficientHealthPlanSignalsOpen(false)}>
              {t("profile.healthPlanInsufficientSignalsClose")}
            </Button>
            <Button
              variant="outline"
              disabled={generatingHealthPlan}
              onClick={() => {
                setInsufficientHealthPlanSignalsOpen(false);
                void handleGenerateHealthPlan(false, "cautious");
              }}
            >
              {generatingHealthPlan ? t("profile.healthPlanGeneratingCautiousDraft") : t("profile.healthPlanGenerateCautiousDraft")}
            </Button>
            <Button
              onClick={() => {
                setInsufficientHealthPlanSignalsOpen(false);
                setProfileTab("overview");
              }}
            >
              {t("profile.healthPlanInsufficientSignalsReviewProfile")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={healthPlanReviewOpen}
        onOpenChange={(open) => {
          if (savingHealthPlanReview) return;
          setHealthPlanReviewOpen(open);
          if (!open) {
            setHealthPlanReviewNote(healthPlan?.review_note || "");
            setHealthPlanReviewChecklist(normalizeHealthPlanReviewChecklistState(healthPlan?.review_checklist_json, healthPlanLifeSafetyReviewItems));
            setHealthPlanRecommendationReviewDrafts(buildHealthPlanRecommendationReviewDrafts(healthPlanRecommendationReview));
          }
        }}
      >
        <DialogContent className="max-w-4xl rounded-2xl border-border bg-white">
          <DialogHeader>
            <DialogTitle>{t("profile.healthPlanReviewNoteTitle")}</DialogTitle>
            <DialogDescription>
              {urgentHealthPlanReviewRequired
                ? t("profile.healthPlanReviewNoteDescriptionUrgent")
                : t("profile.healthPlanReviewNoteDescription")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-xl border border-border/80 bg-slate-50/80 px-4 py-3 text-sm text-foreground/80">
              <p>
                {t("profile.healthPlanReviewWindowLabel")}: <span className="font-medium text-foreground">{healthPlanReviewWindowLabel(t, healthPlanReviewGovernance.review_window)}</span>
              </p>
            </div>
            {healthPlanReviewReadiness && (
              <HealthPlanReviewReadinessPanel summary={healthPlanReviewReadiness} compact />
            )}
            {healthPlanRecommendationReviewDraftSummary?.item_count > 0 && (
              <div className="rounded-2xl border border-border/80 bg-slate-50/70 px-4 py-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-foreground">{t("profile.healthPlanRecommendationReviewTitle")}</p>
                    <p className="text-sm leading-6 text-foreground/75">{t("profile.healthPlanRecommendationReviewDescription")}</p>
                  </div>
                  <Badge variant="outline" className={cn("rounded-full px-3 py-1 text-xs font-semibold", healthPlanRecommendationReviewTone(healthPlanRecommendationReviewDraftSummary?.overall_status))}>
                    {interpolate(t("profile.healthPlanRecommendationReviewCount"), { count: Number(healthPlanRecommendationReviewDraftSummary?.item_count || 0) })}
                  </Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  <Badge variant="outline" className="rounded-full px-3 py-1">{interpolate(t("profile.healthPlanRecommendationReviewApprovedCount"), { count: Number(healthPlanRecommendationReviewDraftSummary?.approved_count || 0) })}</Badge>
                  <Badge variant="outline" className="rounded-full px-3 py-1">{interpolate(t("profile.healthPlanRecommendationReviewWatchCount"), { count: Number(healthPlanRecommendationReviewDraftSummary?.watch_count || 0) })}</Badge>
                  <Badge variant="outline" className="rounded-full px-3 py-1">{interpolate(t("profile.healthPlanRecommendationReviewNeedsEditCount"), { count: Number(healthPlanRecommendationReviewDraftSummary?.needs_edit_count || 0) })}</Badge>
                  <Badge variant="outline" className="rounded-full px-3 py-1">{interpolate(t("profile.healthPlanRecommendationReviewMissingCount"), { count: Number(healthPlanRecommendationReviewDraftSummary?.missing_count || 0) })}</Badge>
                </div>
                <div className="mt-4 space-y-4">
                  {safeArray(healthPlanRecommendationReviewDraftSummary?.items).map((item) => {
                    const draft = healthPlanRecommendationReviewDrafts.find((entry) =>
                      (entry.item_id && item?.item_id && entry.item_id === item.item_id && entry.section_key === item.section_key)
                      || (entry.item_key && item?.item_key && entry.item_key === item.item_key)
                    ) || item;
                    const decisionStatus = draft?.decision_status || null;
                    const rationale = draft?.rationale || "";
                    const matchDraft = (patch: Partial<HealthPlanRecommendationReviewDecisionState>) => {
                      setHealthPlanRecommendationReviewDrafts((current) =>
                        current.map((entry) =>
                          ((entry.item_id && item?.item_id && entry.item_id === item.item_id && entry.section_key === item.section_key)
                            || (entry.item_key && item?.item_key && entry.item_key === item.item_key))
                            ? { ...entry, ...patch }
                            : entry,
                        ),
                      );
                    };
                    return (
                      <div key={item?.item_id || item?.item_key || item?.text} className="rounded-2xl border border-white/90 bg-white/95 px-4 py-4 shadow-sm">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div className="min-w-0 space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="outline" className="rounded-full px-3 py-1 text-[11px] font-semibold">{item?.section_label || "-"}</Badge>
                              <Badge variant="outline" className={cn("rounded-full px-3 py-1 text-[11px] font-semibold", healthPlanRecommendationReviewTone(item?.concern_level === "high" ? "blocked" : item?.concern_level === "medium" ? "guarded" : "ready"))}>
                                {item?.concern_level === "high" ? t("profile.healthPlanRecommendationHigh") : item?.concern_level === "medium" ? t("profile.healthPlanRecommendationMedium") : t("profile.healthPlanRecommendationLow")}
                              </Badge>
                            </div>
                            <p className="text-sm font-semibold leading-6 text-foreground">{item?.text || t("profile.healthPlanReviewReadinessItemFallback")}</p>
                            <div className="space-y-2">
                              {safeArray(item?.concerns).slice(0, 3).map((concern, index) => (
                                <div key={`${item?.item_key || item?.item_id || index}-${index}`} className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2.5">
                                  <p className="text-sm font-medium leading-6 text-foreground">{concern?.label || t("profile.healthPlanReviewReadinessItemFallback")}</p>
                                  {concern?.detail && (
                                    <p className="mt-1 text-xs leading-5 text-muted-foreground">{concern.detail}</p>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="w-full max-w-sm space-y-3 lg:shrink-0">
                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                              {(["approved", "watch", "needs_edit"] as const).map((status) => (
                                <Button
                                  key={status}
                                  type="button"
                                  variant={decisionStatus === status ? "default" : "outline"}
                                  className="rounded-xl"
                                  onClick={() => matchDraft({ decision_status: status })}
                                >
                                  {healthPlanRecommendationReviewStatusLabel(t, status)}
                                </Button>
                              ))}
                            </div>
                            <div className="space-y-2">
                              <Label>{t("profile.healthPlanRecommendationReviewRationaleLabel")}</Label>
                              <Textarea
                                value={rationale}
                                onChange={(event) => matchDraft({ rationale: event.target.value })}
                                placeholder={t("profile.healthPlanRecommendationReviewRationalePlaceholder")}
                                className="min-h-24 rounded-xl"
                              />
                              <p className="text-xs leading-5 text-muted-foreground">
                                {decisionStatus
                                  ? healthPlanRecommendationReviewStatusLabel(t, decisionStatus)
                                  : t("profile.healthPlanRecommendationReviewPending")}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {urgentHealthPlanReviewRequired && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50/70 px-4 py-4">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-foreground">{t("profile.healthPlanReviewChecklistTitle")}</p>
                  <p className="text-sm leading-6 text-foreground/75">{t("profile.healthPlanReviewChecklistDescription")}</p>
                </div>
                <div className="mt-4 space-y-3">
                  {healthPlanReviewChecklistFields.map((item) => (
                    <label
                      key={item.key}
                      htmlFor={`health-plan-review-${item.key}`}
                      className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/80 bg-white/90 px-3 py-3"
                    >
                      <Checkbox
                        id={`health-plan-review-${item.key}`}
                        checked={healthPlanReviewChecklist[item.key]}
                        onCheckedChange={(checked) => {
                          setHealthPlanReviewChecklist((current) => ({
                            ...current,
                            [item.key]: checked === true,
                          }));
                        }}
                        className="mt-0.5"
                      />
                      <span className="text-sm font-medium leading-6 text-foreground">{item.label}</span>
                    </label>
                  ))}
                </div>
                {healthPlanLifeSafetyReviewItems.length > 0 && (
                  <div className="mt-4 rounded-xl border border-rose-100 bg-rose-50/80 px-3 py-3.5">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-foreground">{t("profile.healthPlanLifeSafetyChecklistTitle")}</p>
                      <p className="text-sm leading-6 text-foreground/75">{t("profile.healthPlanLifeSafetyChecklistDescription")}</p>
                    </div>
                    <div className="mt-3 space-y-3">
                      {healthPlanLifeSafetyReviewItems.map((item) => (
                        <label
                          key={item.key}
                          htmlFor={`health-plan-review-${item.caution_id}`}
                          className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/80 bg-white/95 px-3 py-3"
                        >
                          <Checkbox
                            id={`health-plan-review-${item.caution_id}`}
                            checked={healthPlanReviewChecklist.life_safety_confirmations[item.caution_id]?.confirmed === true}
                            onCheckedChange={(checked) => {
                              setHealthPlanReviewChecklist((current) => ({
                                ...current,
                                life_safety_confirmations: {
                                  ...current.life_safety_confirmations,
                                  [item.caution_id]: {
                                    confirmed: checked === true,
                                    label: item.label,
                                  },
                                },
                              }));
                            }}
                            className="mt-0.5"
                          />
                          <div className="space-y-1">
                            <span className="text-sm font-medium leading-6 text-foreground">{item.label}</span>
                            {(item.detail || item.guidance) && (
                              <p className="text-xs leading-5 text-muted-foreground">
                                {item.detail || item.guidance}
                              </p>
                            )}
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="health-plan-review-note">
                {t("profile.healthPlanReviewNoteLabel")}
                {urgentHealthPlanReviewRequired ? " *" : ""}
              </Label>
              <Textarea
                id="health-plan-review-note"
                value={healthPlanReviewNote}
                onChange={(event) => setHealthPlanReviewNote(event.target.value)}
                placeholder={t("profile.healthPlanReviewNotePlaceholder")}
                className="min-h-28 rounded-xl"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" className="rounded-full" disabled={savingHealthPlanReview} onClick={() => setHealthPlanReviewOpen(false)}>
              {t("userForm.cancel")}
            </Button>
            <Button type="button" className="rounded-full" disabled={savingHealthPlanReview} onClick={() => void handleMarkHealthPlanReviewed()}>
              {savingHealthPlanReview ? t("userForm.saving") : (healthPlanReviewGovernance.review_required ? t("profile.healthPlanMarkReviewedUrgent") : t("profile.healthPlanMarkReviewed"))}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={healthPlanFeedbackOpen}
        onOpenChange={(open) => {
          if (savingHealthPlanFeedback) return;
          setHealthPlanFeedbackOpen(open);
          if (!open) {
            setHealthPlanFeedbackSectionKey(null);
            setHealthPlanFeedbackItemId(null);
            setHealthPlanFeedbackItemLabel(null);
            setHealthPlanFeedbackNextAction("preserve");
            setHealthPlanFeedbackConfidence("medium");
            setHealthPlanFeedbackNote("");
          }
        }}
      >
        <DialogContent className="max-w-lg rounded-2xl border-border bg-white">
          <DialogHeader>
            <DialogTitle>{t("profile.healthPlanOutcomeDialogTitle")}</DialogTitle>
            <DialogDescription>
              {copy("profile.healthPlanOutcomeDialogDescription", {
                section:
                  healthPlanFeedbackItemLabel
                  || healthPlanOutcomeScores.find((item) => item.section_key === healthPlanFeedbackSectionKey)?.label
                  || healthPlanFeedbackSectionKey
                  || t("profile.healthPlanOutcomeSectionFallback"),
              })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t("profile.healthPlanOutcomeField")}</Label>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {([
                  "helped",
                  "mixed",
                  "did_not_help",
                  "needs_follow_up",
                ] as Array<"helped" | "mixed" | "did_not_help" | "needs_follow_up">).map((outcome) => (
                  <Button
                    key={outcome}
                    type="button"
                    variant={healthPlanFeedbackOutcome === outcome ? "default" : "outline"}
                    className="h-auto min-h-11 rounded-2xl px-3 py-3 text-left text-xs font-semibold"
                    onClick={() => {
                      setHealthPlanFeedbackOutcome(outcome);
                      setHealthPlanFeedbackNextAction(defaultHealthPlanFeedbackNextAction(outcome));
                    }}
                  >
                    {healthPlanFeedbackOutcomeLabel(t, outcome)}
                  </Button>
                ))}
              </div>
            </div>
            <div>
              <Label>{t("profile.healthPlanFeedbackNextActionField")}</Label>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {([
                  "preserve",
                  "verify",
                  "rework",
                  "retire",
                ] as Array<"preserve" | "verify" | "rework" | "retire">).map((action) => (
                  <Button
                    key={action}
                    type="button"
                    variant={healthPlanFeedbackNextAction === action ? "default" : "outline"}
                    className="h-auto min-h-11 rounded-2xl px-3 py-3 text-left text-xs font-semibold"
                    onClick={() => setHealthPlanFeedbackNextAction(action)}
                  >
                    {healthPlanFeedbackNextActionLabel(t, action)}
                  </Button>
                ))}
              </div>
            </div>
            <div>
              <Label>{t("profile.healthPlanFeedbackConfidenceField")}</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {([
                  "high",
                  "medium",
                  "low",
                ] as Array<"high" | "medium" | "low">).map((value) => (
                  <Button
                    key={value}
                    type="button"
                    variant={healthPlanFeedbackConfidence === value ? "default" : "outline"}
                    className="rounded-full px-3 py-2 text-xs font-semibold"
                    onClick={() => setHealthPlanFeedbackConfidence(value)}
                  >
                    {healthPlanFeedbackConfidenceLabel(t, value)}
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="health-plan-feedback-note">{t("profile.healthPlanOutcomeNote")}</Label>
              <Textarea
                id="health-plan-feedback-note"
                value={healthPlanFeedbackNote}
                onChange={(event) => setHealthPlanFeedbackNote(event.target.value)}
                placeholder={t("profile.healthPlanOutcomeNotePlaceholder")}
                className="min-h-28 rounded-xl"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" className="rounded-full" disabled={savingHealthPlanFeedback} onClick={() => setHealthPlanFeedbackOpen(false)}>
              {t("userForm.cancel")}
            </Button>
            <Button type="button" className="rounded-full" disabled={savingHealthPlanFeedback || !healthPlanFeedbackSectionKey} onClick={handleSaveHealthPlanFeedback}>
              {savingHealthPlanFeedback ? t("userForm.saving") : t("profile.healthPlanOutcomeSave")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={addNoteOpen} onOpenChange={(open) => !savingNote && setAddNoteOpen(open)}>
        <DialogContent className="max-w-lg rounded-2xl border-border bg-white">
          <DialogHeader>
            <DialogTitle>{t("profile.addNoteTitle")}</DialogTitle>
            <DialogDescription>{t("profile.addNoteDescription")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="profile-note">{t("profile.note")}</Label>
            <Textarea
              id="profile-note"
              value={noteDraft}
              onChange={(event) => setNoteDraft(event.target.value)}
              placeholder={t("profile.notePlaceholder")}
              className="min-h-32 rounded-xl"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" className="rounded-full" disabled={savingNote} onClick={() => setAddNoteOpen(false)}>
              {t("userForm.cancel")}
            </Button>
            <Button type="button" className="rounded-full" disabled={savingNote} onClick={handleSaveProfileNote}>
              {savingNote ? t("userForm.saving") : t("userForm.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function HealthPlanTextSection({
  title,
  items,
  variant = "list",
  signalLookup,
  evidenceLabel,
  trace,
  sectionKey,
  showTrace = false,
  canRecordFeedback = false,
  recommendationLearningLookup,
  recommendationSourceRankingLookup,
  recommendationGroundingLookup,
  recommendationRepairLookup,
  onRefreshSection,
  onRecordFeedback,
}: {
  title: string;
  items?: Array<{
    id?: string;
    text?: string | null;
    source_signal_ids?: string[];
    priority?: "high" | "medium" | "low" | null;
    confidence?: "high" | "medium" | "low" | null;
    timing?: "today" | "this_week" | "ongoing" | null;
    verification_required?: boolean | null;
    completion_signal?: string | null;
    owner_role?: "assigned_staff" | "caregiver" | "on_call_coordinator" | "care_team" | null;
    fallback_owner_role?: "assigned_staff" | "caregiver" | "on_call_coordinator" | "care_team" | null;
    origin_type?: "ai_generated" | "human_added" | "human_edited" | null;
    original_generated_text?: string | null;
    edit_reason?: string | null;
    last_modified_at?: string | null;
    last_modified_by_email?: string | null;
    evidence_receipt?: {
      trust_level?: "strong" | "guarded" | "fragile" | null;
      support_mode?: "action" | "verification" | "stabilizing" | "context" | null;
      driver_signal_ids?: string[];
      driver_labels?: string[];
      summary?: string | null;
      attention_status?: "reinforced" | "mixed" | "contradicted" | "verify" | "watch" | null;
      attention_note?: string | null;
    } | null;
  }> | null;
  variant?: "list" | "summary";
  signalLookup?: Map<string, { id?: string; label?: string | null; detail?: string | null; strength?: string | null }>;
  evidenceLabel?: string;
  sectionKey?: string;
  trace?: {
    section_key?: string;
    driver_signals?: Array<{ id?: string; label?: string | null; strength?: "high" | "medium" | "low" | null }>;
    driver_strength?: "high" | "medium" | "low" | null;
    confidence_state?: "strong" | "moderate" | "limited" | null;
    limitation_labels?: string[];
    review_actions?: string[];
  } | null;
  showTrace?: boolean;
  canRecordFeedback?: boolean;
  recommendationLearningLookup?: Map<string, {
    item_id?: string | null;
    status?: "helping" | "mixed" | "fragile" | "unproven" | null;
    latest_outcome?: "helped" | "mixed" | "did_not_help" | "needs_follow_up" | null;
    inherited_section_outcome?: "helped" | "mixed" | "did_not_help" | "needs_follow_up" | null;
    latest_note?: string | null;
    latest_recommended_next_action?: "preserve" | "verify" | "rework" | "retire" | null;
    latest_confidence_level?: "high" | "medium" | "low" | null;
    freshness_status?: "fresh" | "aging" | "stale" | null;
    feedback_count?: number | null;
    helped_count?: number | null;
    mixed_count?: number | null;
    did_not_help_count?: number | null;
    needs_follow_up_count?: number | null;
    operational_positive_count?: number | null;
    operational_caution_count?: number | null;
    operational_pattern?: "reinforcing" | "mixed" | "conflicting" | "limited" | null;
    operational_source_labels?: string[] | null;
    operational_reason?: string | null;
    last_operational_at?: string | null;
    trajectory?: "strengthening" | "stable" | "weakening" | "volatile" | "untested" | null;
    reuse_priority?: "preserve" | "refine" | "replace" | "verify" | null;
    contradiction_status?: "live_conflict" | "improving_against_feedback" | "section_conflict" | null;
    contradiction_reason?: string | null;
  }>;
  recommendationSourceRankingLookup?: Map<string, {
    item_id?: string | null;
    evidence_quality?: "strong" | "mixed" | "thin" | null;
    top_summary?: string | null;
    ranked_sources?: Array<{
      signal_id?: string | null;
      label?: string | null;
      authority_level?: "highest" | "high" | "medium" | "supporting" | null;
    }> | null;
  }>;
  recommendationGroundingLookup?: Map<string, {
    item_id?: string | null;
    grounding_status?: "strong" | "guarded" | "fragile" | null;
    staff_note?: string | null;
    top_source_authority?: "highest" | "high" | "medium" | "supporting" | null;
  }>;
  recommendationRepairLookup?: Map<string, {
    item_id?: string | null;
    recommended_action?: "preserve" | "rework" | "retire" | "verify" | null;
    priority?: "high" | "medium" | "low" | null;
    reason?: string | null;
    rewrite_guidance?: string | null;
    evidence_quality?: "strong" | "mixed" | "thin" | null;
    grounding_status?: "strong" | "guarded" | "fragile" | null;
    challenge_status?: "supported" | "guarded" | "challenged" | null;
  }>;
  onRefreshSection?: (() => void) | undefined;
  onRecordFeedback?: ((item: { id?: string; text?: string | null }) => void) | undefined;
}) {
  const { t } = useLanguage();
  const content = safeArray(items).filter((item) => item?.text);
  const driverLabels = safeArray(trace?.driver_signals).map((signal) => signal.label).filter(Boolean).slice(0, 3).join(", ");
  const confidenceText =
    safeArray(trace?.limitation_labels).length > 0
      ? interpolate(t("profile.healthPlanTraceConfidenceLimited"), { signals: safeArray(trace?.limitation_labels).slice(0, 3).join(", ") })
      : trace?.confidence_state === "strong"
        ? t("profile.healthPlanTraceConfidenceStrong")
        : t("profile.healthPlanTraceConfidenceModerate");
  const whyText = driverLabels
    ? trace?.driver_strength === "high"
      ? interpolate(t("profile.healthPlanTraceWhyStrong"), { signals: driverLabels })
      : interpolate(t("profile.healthPlanTraceWhyContext"), { signals: driverLabels })
    : "-";
  const reviewNext = safeArray(trace?.review_actions)[0] || t("profile.healthPlanTraceReviewFallback");
  return (
    <div className="rounded-[18px] border border-border/70 bg-white/72 px-5 py-5">
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{title}</p>
      {content.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">-</p>
      ) : variant === "summary" ? (
        <p className="mt-3 text-sm font-medium leading-7 text-foreground">{content[0].text}</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {content.map((item, index) => {
            const learning = recommendationLearningLookup?.get(item.id || "");
            const grounding = recommendationGroundingLookup?.get(item.id || "");
            const repair = recommendationRepairLookup?.get(item.id || "");
            return (
            <li key={item.id || `${sectionKey || title}-${index}`} className="flex gap-2.5 text-sm leading-7 text-foreground">
              <span className="mt-[0.85rem] h-1.5 w-1.5 shrink-0 rounded-full bg-primary/80" />
              <div className="min-w-0">
                {(() => {
                  const ranking = recommendationSourceRankingLookup?.get(item.id || "");
                  const rankedSignals = safeArray(ranking?.ranked_sources)
                    .map((ranked) => signalLookup?.get(ranked?.signal_id || "") || ranked)
                    .filter(Boolean);
                  const evidenceSignals = rankedSignals.length
                    ? rankedSignals
                    : signalLookup
                      ? safeArray(item.source_signal_ids)
                        .map((signalId) => signalLookup.get(signalId))
                        .filter(Boolean)
                      : [];
                  const showEvidenceMeta = Boolean(
                    evidenceSignals.length ||
                    ranking?.evidence_quality ||
                    grounding?.grounding_status ||
                    item.verification_required ||
                    item.owner_role ||
                    item.fallback_owner_role,
                  );
                  return (
                    <>
                      <span>{item.text}</span>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {item.origin_type === "ai_generated" && (
                          <Badge variant="outline" className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold">
                            {t("profile.healthPlanOriginAI")}
                          </Badge>
                        )}
                        {item.origin_type === "human_edited" && (
                          <Badge variant="outline" className="rounded-full border-amber-200 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700">
                            {t("profile.healthPlanOriginEdited")}
                          </Badge>
                        )}
                        {item.origin_type === "human_added" && (
                          <Badge variant="outline" className="rounded-full border-violet-200 px-2.5 py-0.5 text-[11px] font-semibold text-violet-700">
                            {t("profile.healthPlanOriginAdded")}
                          </Badge>
                        )}
                        {item.last_modified_at && item.origin_type !== "ai_generated" && (
                          <Badge variant="outline" className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold">
                            {interpolate(t("profile.healthPlanOriginTouched"), { date: formatDateTime(item.last_modified_at) })}
                          </Badge>
                        )}
                      </div>
                      {item.origin_type === "human_edited" && item.original_generated_text && item.original_generated_text !== item.text && (
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                          {interpolate(t("profile.healthPlanOriginOriginally"), { text: item.original_generated_text })}
                        </p>
                      )}
                      {item.edit_reason && item.origin_type !== "ai_generated" && (
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                          {interpolate(t("profile.healthPlanOriginReason"), { text: item.edit_reason })}
                        </p>
                      )}
                      {item.evidence_receipt?.summary ? (
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.evidence_receipt.summary}</p>
                      ) : ranking?.top_summary ? (
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">{ranking.top_summary}</p>
                      ) : null}
                      {item.evidence_receipt?.attention_note ? (
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.evidence_receipt.attention_note}</p>
                      ) : grounding?.staff_note ? (
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">{grounding.staff_note}</p>
                      ) : null}
                      {item.completion_signal && (
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                          {interpolate(t("profile.healthPlanCompletionSignal"), { text: item.completion_signal })}
                        </p>
                      )}
                      {showEvidenceMeta && (
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          {evidenceLabel && evidenceSignals.length > 0 && (
                            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{evidenceLabel}</span>
                          )}
                          {evidenceSignals
                            .slice(0, 3)
                            .map((signal, signalIndex) => {
                              const strength = inferHealthPlanSignalStrength(signal);
                              return (
                                <Badge
                                  key={signal?.id || `${title}-${index}-${signalIndex}`}
                                  variant="outline"
                                  className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", healthPlanSignalBadgeClasses(strength))}
                                >
                                  {signal?.label || "-"}
                                </Badge>
                              );
                            })}
                          {ranking?.evidence_quality && (
                            <Badge variant="outline" className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold">
                              {ranking.evidence_quality}
                            </Badge>
                          )}
                          {grounding?.grounding_status && (
                            <Badge variant="outline" className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", healthPlanGroundingTone(grounding.grounding_status))}>
                              {healthPlanGroundingLabel(t, grounding.grounding_status)}
                            </Badge>
                          )}
                          {item.verification_required && (
                            <Badge variant="outline" className="rounded-full border-amber-200 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700">
                              {t("profile.healthPlanVerificationRequired")}
                            </Badge>
                          )}
                          {item.owner_role && (
                            <Badge variant="outline" className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold">
                              {interpolate(t("profile.healthPlanPrimaryOwner"), { owner: healthPlanFallbackOwnerLabel(t, item.owner_role) })}
                            </Badge>
                          )}
                          {item.fallback_owner_role && (
                            <Badge variant="outline" className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold">
                              {interpolate(t("profile.healthPlanFallbackOwner"), { owner: healthPlanFallbackOwnerLabel(t, item.fallback_owner_role) })}
                            </Badge>
                          )}
                        </div>
                      )}
                    </>
                  );
                })()}
                {(() => {
                  if (!learning && !canRecordFeedback) return null;
                  return (
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {learning?.status && (
                        <Badge variant="outline" className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", healthPlanOutcomeStatusTone(learning.status))}>
                          {healthPlanOutcomeStatusLabel(t, learning.status)}
                        </Badge>
                      )}
                      {learning?.latest_outcome && (
                        <Badge variant="outline" className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold">
                          {healthPlanFeedbackOutcomeLabel(t, learning.latest_outcome)}
                        </Badge>
                      )}
                      {learning?.latest_recommended_next_action && (
                        <Badge variant="outline" className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", healthPlanFeedbackNextActionTone(learning.latest_recommended_next_action))}>
                          {healthPlanFeedbackNextActionLabel(t, learning.latest_recommended_next_action)}
                        </Badge>
                      )}
                      {learning?.latest_confidence_level && (
                        <Badge variant="outline" className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold">
                          {healthPlanFeedbackConfidenceLabel(t, learning.latest_confidence_level)}
                        </Badge>
                      )}
                      {!learning?.latest_outcome && learning?.inherited_section_outcome && (
                        <Badge variant="outline" className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold">
                          {copyItemFeedbackLabel(t, learning.inherited_section_outcome)}
                        </Badge>
                      )}
                      {learning?.freshness_status && (
                        <Badge variant="outline" className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", healthPlanFeedbackFreshnessTone(learning.freshness_status))}>
                          {healthPlanFeedbackFreshnessLabel(t, learning.freshness_status)}
                        </Badge>
                      )}
                      {learning?.operational_pattern && (
                        <Badge variant="outline" className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", healthPlanOperationalPatternTone(learning.operational_pattern))}>
                          {healthPlanOperationalPatternLabel(t, learning.operational_pattern)}
                        </Badge>
                      )}
                      {learning?.trajectory && (
                        <Badge variant="outline" className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", healthPlanTrajectoryTone(learning.trajectory))}>
                          {healthPlanTrajectoryLabel(t, learning.trajectory)}
                        </Badge>
                      )}
                      {learning?.reuse_priority && (
                        <Badge variant="outline" className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", healthPlanReusePriorityTone(learning.reuse_priority))}>
                          {healthPlanReusePriorityLabel(t, learning.reuse_priority)}
                        </Badge>
                      )}
                      {learning?.contradiction_status && (
                        <Badge variant="outline" className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", healthPlanContradictionTone(learning.contradiction_status))}>
                          {healthPlanContradictionLabel(t, learning.contradiction_status)}
                        </Badge>
                      )}
                      {repair?.recommended_action && (
                        <Badge variant="outline" className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", healthPlanRepairActionTone(repair.recommended_action))}>
                          {healthPlanRepairActionLabel(t, repair.recommended_action)}
                        </Badge>
                      )}
                      {canRecordFeedback && onRecordFeedback && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 rounded-full px-2.5 text-[11px] font-semibold"
                          onClick={() => onRecordFeedback(item)}
                        >
                          {t("profile.healthPlanOutcomeRecord")}
                        </Button>
                      )}
                      {onRefreshSection && repair?.recommended_action && ["rework", "verify", "retire"].includes(repair.recommended_action) && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 rounded-full px-2.5 text-[11px] font-semibold"
                          onClick={onRefreshSection}
                        >
                          {t("profile.healthPlanRepairRefresh")}
                        </Button>
                      )}
                    </div>
                  );
                })()}
                {(repair?.reason || repair?.rewrite_guidance) && (
                  <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5">
                    {repair?.reason && (
                      <p className="text-xs leading-5 text-foreground/80">{repair.reason}</p>
                    )}
                    {repair?.rewrite_guidance && (
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">{repair.rewrite_guidance}</p>
                    )}
                  </div>
                )}
                {learning?.contradiction_reason && (
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">{learning.contradiction_reason}</p>
                )}
                {Number(learning?.feedback_count || 0) > 0 && (
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    {copy("profile.healthPlanLearningCounts", {
                      total: Number(learning?.feedback_count || 0),
                      helped: Number(learning?.helped_count || 0),
                      failed: Number(learning?.did_not_help_count || 0) + Number(learning?.needs_follow_up_count || 0),
                    })}
                  </p>
                )}
                {((Number(learning?.operational_positive_count || 0) > 0) || (Number(learning?.operational_caution_count || 0) > 0) || learning?.operational_reason) && (
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    {interpolate(t("profile.healthPlanOperationalCounts"), {
                      positive: Number(learning?.operational_positive_count || 0),
                      caution: Number(learning?.operational_caution_count || 0),
                    })}
                    {learning?.operational_source_labels?.length ? ` ${learning.operational_source_labels.join(", ")}.` : ""}
                    {learning?.operational_reason ? ` ${learning.operational_reason}` : ""}
                  </p>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <Badge
                    variant="outline"
                    className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", healthPlanRecommendationPriorityClasses(item.priority))}
                  >
                    {healthPlanRecommendationPriorityLabel(t, item.priority)}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", healthPlanRecommendationTimingClasses(item.timing))}
                  >
                    {healthPlanRecommendationTimingLabel(t, item.timing)}
                  </Badge>
                  <span className="text-xs font-medium text-muted-foreground">
                    {healthPlanRecommendationConfidenceLabel(t, item.confidence)}
                  </span>
                </div>
              </div>
            </li>
          );
          })}
        </ul>
      )}
      {showTrace && trace && (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/90 px-4 py-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("profile.healthPlanTraceTitle")}</p>
            <Badge variant="secondary" className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold">
              {t("profile.healthPlanTraceBadge")}
            </Badge>
          </div>
          <div className="mt-3 space-y-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{t("profile.healthPlanTraceWhy")}</p>
              <p className="mt-1 text-sm leading-6 text-foreground/85">{whyText}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{t("profile.healthPlanTraceConfidence")}</p>
              <p className="mt-1 text-sm leading-6 text-foreground/85">{confidenceText}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{t("profile.healthPlanTraceReviewNext")}</p>
              <p className="mt-1 text-sm leading-6 text-foreground/85">{reviewNext}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function healthPlanHistoryActionTone(actionType?: string | null) {
  if (actionType === "reviewed") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (actionType === "regenerated") return "border-violet-200 bg-violet-50 text-violet-700";
  if (actionType === "edited") return "border-sky-200 bg-sky-50 text-sky-700";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function healthPlanHistoryActionLabel(t: (key: string) => string, actionType?: string | null) {
  if (actionType === "reviewed") return t("profile.healthPlanHistoryReviewed");
  if (actionType === "regenerated") return t("profile.healthPlanHistoryRegenerated");
  if (actionType === "edited") return t("profile.healthPlanHistoryEdited");
  return t("profile.healthPlanHistoryGenerated");
}

function healthPlanHistorySectionLabel(t: (key: string) => string, sectionKey?: string | null) {
  if (sectionKey === "summary") return t("profile.healthPlanSummary");
  if (sectionKey === "goals_json") return t("profile.healthPlanGoals");
  if (sectionKey === "daily_support_json") return t("profile.healthPlanDailySupport");
  if (sectionKey === "monitoring_json") return t("profile.healthPlanMonitoring");
  if (sectionKey === "escalation_json") return t("profile.healthPlanEscalation");
  if (sectionKey === "caregiver_guidance_json") return t("profile.healthPlanCaregiverGuidance");
  return sectionKey || "-";
}

function healthPlanRecommendationChangeTone(action?: string | null) {
  if (action === "replaced") return "border-rose-200 bg-rose-50 text-rose-700";
  if (action === "tightened") return "border-amber-200 bg-amber-50 text-amber-700";
  if (action === "preserved") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  return "border-sky-200 bg-sky-50 text-sky-700";
}

function healthPlanRecommendationChangeLabel(t: (key: string) => string, action?: string | null) {
  if (action === "replaced") return t("profile.healthPlanChangeReplaced");
  if (action === "tightened") return t("profile.healthPlanChangeTightened");
  if (action === "preserved") return t("profile.healthPlanChangePreserved");
  return t("profile.healthPlanChangeAdded");
}

function healthPlanChangeJustificationTone(status?: string | null) {
  if (status === "manual_override") return "border-violet-200 bg-violet-50 text-violet-700";
  if (status === "evidence_backed") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "learning_backed") return "border-sky-200 bg-sky-50 text-sky-700";
  return "border-amber-200 bg-amber-50 text-amber-700";
}

function healthPlanChangeJustificationLabel(t: (key: string) => string, status?: string | null) {
  if (status === "manual_override") return t("profile.healthPlanChangeJustificationManual");
  if (status === "evidence_backed") return t("profile.healthPlanChangeJustificationEvidence");
  if (status === "learning_backed") return t("profile.healthPlanChangeJustificationLearning");
  return t("profile.healthPlanChangeJustificationThin");
}

function HealthPlanRecommendationChangePanel({
  change,
  compact = false,
}: {
  change?: {
    recommendation_changes?: {
      added_count?: number;
      preserved_count?: number;
      tightened_count?: number;
      replaced_count?: number;
      evidence_backed_count?: number;
      learning_backed_count?: number;
      manual_override_count?: number;
      thin_justification_count?: number;
      highlights?: Array<{
        action?: "added" | "preserved" | "tightened" | "replaced" | null;
        section_key?: string | null;
        text?: string | null;
        reason?: string | null;
        evidence_shift?: string | null;
        learning_shift?: string | null;
        previous_top_source?: string | null;
        current_top_source?: string | null;
        justification_status?: "manual_override" | "evidence_backed" | "learning_backed" | "thin" | null;
      }>;
    } | null;
  } | null;
  compact?: boolean;
}) {
  const { t } = useLanguage();
  const recommendationChanges = change?.recommendation_changes || null;
  const highlights = safeArray(recommendationChanges?.highlights).filter((item) => item?.text);
  if (
    !recommendationChanges
    || (
      Number(recommendationChanges.added_count || 0) === 0
      && Number(recommendationChanges.preserved_count || 0) === 0
      && Number(recommendationChanges.tightened_count || 0) === 0
      && Number(recommendationChanges.replaced_count || 0) === 0
      && highlights.length === 0
    )
  ) {
    return null;
  }

  return (
    <div className={cn("rounded-[18px] border border-border/80 bg-white/92 px-4 py-4", compact ? "mt-3" : "")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("profile.healthPlanChangeTitle")}</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{t("profile.healthPlanChangeDescription")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {Number(recommendationChanges.added_count || 0) > 0 && (
            <Badge variant="outline" className={cn("rounded-full px-3 py-1 text-xs font-semibold", healthPlanRecommendationChangeTone("added"))}>
              {interpolate(t("profile.healthPlanChangeAddedCount"), { count: recommendationChanges.added_count || 0 })}
            </Badge>
          )}
          {Number(recommendationChanges.preserved_count || 0) > 0 && (
            <Badge variant="outline" className={cn("rounded-full px-3 py-1 text-xs font-semibold", healthPlanRecommendationChangeTone("preserved"))}>
              {interpolate(t("profile.healthPlanChangePreservedCount"), { count: recommendationChanges.preserved_count || 0 })}
            </Badge>
          )}
          {Number(recommendationChanges.tightened_count || 0) > 0 && (
            <Badge variant="outline" className={cn("rounded-full px-3 py-1 text-xs font-semibold", healthPlanRecommendationChangeTone("tightened"))}>
              {interpolate(t("profile.healthPlanChangeTightenedCount"), { count: recommendationChanges.tightened_count || 0 })}
            </Badge>
          )}
          {Number(recommendationChanges.replaced_count || 0) > 0 && (
            <Badge variant="outline" className={cn("rounded-full px-3 py-1 text-xs font-semibold", healthPlanRecommendationChangeTone("replaced"))}>
              {interpolate(t("profile.healthPlanChangeReplacedCount"), { count: recommendationChanges.replaced_count || 0 })}
            </Badge>
          )}
          {Number(recommendationChanges.evidence_backed_count || 0) > 0 && (
            <Badge variant="outline" className={cn("rounded-full px-3 py-1 text-xs font-semibold", healthPlanChangeJustificationTone("evidence_backed"))}>
              {interpolate(t("profile.healthPlanChangeEvidenceBackedCount"), { count: recommendationChanges.evidence_backed_count || 0 })}
            </Badge>
          )}
          {Number(recommendationChanges.learning_backed_count || 0) > 0 && (
            <Badge variant="outline" className={cn("rounded-full px-3 py-1 text-xs font-semibold", healthPlanChangeJustificationTone("learning_backed"))}>
              {interpolate(t("profile.healthPlanChangeLearningBackedCount"), { count: recommendationChanges.learning_backed_count || 0 })}
            </Badge>
          )}
          {Number(recommendationChanges.manual_override_count || 0) > 0 && (
            <Badge variant="outline" className={cn("rounded-full px-3 py-1 text-xs font-semibold", healthPlanChangeJustificationTone("manual_override"))}>
              {interpolate(t("profile.healthPlanChangeManualCount"), { count: recommendationChanges.manual_override_count || 0 })}
            </Badge>
          )}
          {Number(recommendationChanges.thin_justification_count || 0) > 0 && (
            <Badge variant="outline" className={cn("rounded-full px-3 py-1 text-xs font-semibold", healthPlanChangeJustificationTone("thin"))}>
              {interpolate(t("profile.healthPlanChangeThinCount"), { count: recommendationChanges.thin_justification_count || 0 })}
            </Badge>
          )}
        </div>
      </div>
      {highlights.length > 0 && (
        <div className="mt-4 space-y-3">
          {highlights.slice(0, compact ? 2 : 4).map((item, index) => (
            <div key={`${item.section_key}-${item.text}-${index}`} className="rounded-2xl border border-border/70 bg-slate-50/75 px-3.5 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", healthPlanRecommendationChangeTone(item.action))}>
                  {healthPlanRecommendationChangeLabel(t, item.action)}
                </Badge>
                <span className="text-sm font-medium text-foreground">{healthPlanHistorySectionLabel(t, item.section_key)}</span>
                <Badge variant="outline" className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", healthPlanChangeJustificationTone(item.justification_status))}>
                  {healthPlanChangeJustificationLabel(t, item.justification_status)}
                </Badge>
              </div>
              <p className="mt-2 text-sm leading-6 text-foreground">{item.text}</p>
              {item.reason && <p className="mt-1 text-sm leading-6 text-muted-foreground">{item.reason}</p>}
              {item.evidence_shift && (
                <p className="mt-1 text-sm leading-6 text-foreground/80">
                  <span className="font-medium text-foreground">{t("profile.healthPlanChangeEvidenceShift")}: </span>
                  {item.evidence_shift}
                </p>
              )}
              {item.learning_shift && (
                <p className="mt-1 text-sm leading-6 text-foreground/80">
                  <span className="font-medium text-foreground">{t("profile.healthPlanChangeLearningShift")}: </span>
                  {item.learning_shift}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function HealthPlanHistorySection({ history }: { history?: OperationalHealthPlanRevision[] | null }) {
  const { t } = useLanguage();
  const items = safeArray(history);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("profile.healthPlanHistoryTitle")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t("profile.healthPlanHistoryDescription")}</p>
        </div>
        <Badge variant="secondary" className="rounded-full px-3 py-1">
          {items.length}
        </Badge>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("profile.healthPlanHistoryEmpty")}</p>
      ) : (
        <div className="space-y-3">
          {items.slice(0, 5).map((revision, index) => {
            const change = revision.change || null;
            const changedSections = safeArray(change?.changed_sections).slice(0, 4);
            const highPriorityDelta = Number(change?.high_priority_delta || 0);
            const inferredFeedback = safeArray(revision.inferred_feedback_json);
            const recommendationLearning = safeArray(revision.recommendation_learning_json);
            const recommendationHighlights = recommendationLearning
              .filter((item) => item?.text && item?.reuse_priority)
              .sort((left, right) => {
                const leftWeight = left.reuse_priority === "replace" ? 0 : left.reuse_priority === "refine" ? 1 : left.reuse_priority === "verify" ? 2 : 3;
                const rightWeight = right.reuse_priority === "replace" ? 0 : right.reuse_priority === "refine" ? 1 : right.reuse_priority === "verify" ? 2 : 3;
                if (leftWeight !== rightWeight) return leftWeight - rightWeight;
                return (Number(right.feedback_count || 0) - Number(left.feedback_count || 0));
              })
              .slice(0, 3);
            return (
              <div
                key={revision.id || `${revision.version_number || index}`}
                className="rounded-[20px] border border-border/80 bg-white px-4 py-4 shadow-sm"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="rounded-full px-3 py-1 text-[11px] font-semibold">
                        {t("profile.healthPlanHistoryVersionLabel")} {revision.version_number || index + 1}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={cn("rounded-full px-3 py-1 text-[11px] font-semibold", healthPlanHistoryActionTone(revision.action_type))}
                      >
                        {healthPlanHistoryActionLabel(t, revision.action_type)}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={cn(
                          "rounded-full px-3 py-1 text-[11px] font-semibold",
                          revision.review_status === "reviewed" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700",
                        )}
                      >
                        {revision.review_status === "reviewed" ? t("profile.healthPlanReviewedBadge") : t("profile.healthPlanDraftBadge")}
                      </Badge>
                    </div>
                    <p className="mt-3 text-sm font-semibold text-foreground">
                      {change?.previous_version_number == null
                        ? t("profile.healthPlanHistoryInitial")
                        : interpolate(t("profile.healthPlanHistoryChanged"), { version: change.previous_version_number })}
                    </p>
                    {changedSections.length > 0 && (
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">
                        {changedSections.map((section) => healthPlanHistorySectionLabel(t, section)).join(" · ")}
                      </p>
                    )}
                    {revision.summary_text && (
                      <p className="mt-2 line-clamp-2 text-sm leading-6 text-foreground/80">{revision.summary_text}</p>
                    )}
                    {revision.review_note && (
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        {t("profile.healthPlanReviewNoteLabel")}: <span className="text-foreground/85">{revision.review_note}</span>
                      </p>
                    )}
                    {revision.review_status === "reviewed" && (
                      <HealthPlanReviewChecklistSummary checklist={revision.review_checklist_json} className="mt-3" />
                    )}
                    {revision.quality_snapshot_json?.recommendation_review?.item_count > 0 && (
                      <HealthPlanRecommendationReviewSummaryPanel summary={revision.quality_snapshot_json?.recommendation_review} compact />
                    )}
                  </div>
                  <div className="shrink-0 text-sm text-muted-foreground">
                    <p>{revision.created_at ? formatDateTime(revision.created_at) : "-"}</p>
                    {(revision.actor_email || revision.reviewed_by_email) && (
                      <p className="mt-1 text-right">{revision.actor_email || revision.reviewed_by_email}</p>
                    )}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {Number(change?.added_items || 0) > 0 && (
                    <Badge variant="secondary" className="rounded-full px-3 py-1">
                      +{change?.added_items} {t("profile.healthPlanHistoryAdded")}
                    </Badge>
                  )}
                  {Number(change?.removed_items || 0) > 0 && (
                    <Badge variant="secondary" className="rounded-full px-3 py-1">
                      -{change?.removed_items} {t("profile.healthPlanHistoryRemoved")}
                    </Badge>
                  )}
                  {Number(change?.rewritten_items || 0) > 0 && (
                    <Badge variant="secondary" className="rounded-full px-3 py-1">
                      {change?.rewritten_items} {t("profile.healthPlanHistoryRewritten")}
                    </Badge>
                  )}
                  {highPriorityDelta !== 0 && (
                    <Badge variant="secondary" className="rounded-full px-3 py-1">
                      {highPriorityDelta > 0 ? "+" : ""}
                      {highPriorityDelta} {t("profile.healthPlanHistoryHighPriorityDelta")}
                    </Badge>
                  )}
                  {change?.review_status_changed && (
                    <Badge variant="secondary" className="rounded-full px-3 py-1">
                      {t("profile.healthPlanHistoryReviewChanged")}
                    </Badge>
                  )}
                  {inferredFeedback.length > 0 && (
                    <Badge variant="secondary" className="rounded-full px-3 py-1">
                      {interpolate(t("profile.healthPlanHistoryObservedCount"), { count: inferredFeedback.length })}
                    </Badge>
                  )}
                  {recommendationLearning.length > 0 && (
                    <Badge variant="secondary" className="rounded-full px-3 py-1">
                      {interpolate(t("profile.healthPlanHistoryLearningCount"), { count: recommendationLearning.length })}
                    </Badge>
                  )}
                </div>
                {inferredFeedback.length > 0 && (
                  <div className="mt-3 rounded-2xl border border-border/70 bg-slate-50/80 px-3.5 py-3">
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                      {t("profile.healthPlanHistoryObservedTitle")}
                    </p>
                    <div className="mt-2 space-y-2">
                      {inferredFeedback.slice(0, 3).map((item, feedbackIndex) => (
                        <div key={item.id || `${item.section_key}-${feedbackIndex}`} className="rounded-xl border border-white/80 bg-white/90 px-3 py-2.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium text-foreground">
                              {healthPlanHistorySectionLabel(t, item.section_key)}
                            </span>
                            {item.outcome && (
                              <Badge variant="outline" className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold">
                                {healthPlanFeedbackOutcomeLabel(t, item.outcome)}
                              </Badge>
                            )}
                            {item.recorded_at && (
                              <span className="text-xs text-muted-foreground">{formatDateTimeValue(item.recorded_at)}</span>
                            )}
                          </div>
                          {item.note && <p className="mt-1 text-sm leading-6 text-foreground/80">{item.note}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {recommendationHighlights.length > 0 && (
                  <div className="mt-3 rounded-2xl border border-border/70 bg-white/95 px-3.5 py-3">
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                      {t("profile.healthPlanHistoryLearningTitle")}
                    </p>
                    <div className="mt-2 space-y-2">
                      {recommendationHighlights.map((item, learningIndex) => (
                        <div key={item.item_id || `${item.section_key}-${learningIndex}`} className="rounded-xl border border-border/70 bg-slate-50/70 px-3 py-2.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium text-foreground">{item.text}</span>
                            {item.reuse_priority && (
                              <Badge variant="outline" className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", healthPlanReusePriorityTone(item.reuse_priority))}>
                                {healthPlanReusePriorityLabel(t, item.reuse_priority)}
                              </Badge>
                            )}
                            {item.trajectory && (
                              <Badge variant="outline" className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", healthPlanTrajectoryTone(item.trajectory))}>
                                {healthPlanTrajectoryLabel(t, item.trajectory)}
                              </Badge>
                            )}
                            {item.feedback_count ? (
                              <span className="text-xs text-muted-foreground">
                                {interpolate(t("profile.healthPlanHistoryLearningEvidence"), { count: item.feedback_count })}
                              </span>
                            ) : null}
                          </div>
                          {item.reason && <p className="mt-1 text-sm leading-6 text-foreground/80">{item.reason}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <HealthPlanRecommendationChangePanel change={change} compact />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function HealthPlanDataQualityPanel({
  gaps,
}: {
  gaps?: Array<{ id?: string; label?: string | null; detail?: string | null; kind?: "missing" | "stale" | null; severity?: "high" | "medium" | "low" | null; staff_action?: string | null }> | null;
}) {
  const { t } = useLanguage();
  const items = safeArray(gaps);

  return (
    <div className="rounded-[18px] border border-border/80 bg-slate-50/70 px-4 py-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-amber-600 shadow-sm">
          <AlertTriangle className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{t("profile.healthPlanGapTitle")}</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{t("profile.healthPlanGapDescription")}</p>
        </div>
      </div>
      {items.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">{t("profile.healthPlanGapEmpty")}</p>
      ) : (
        <div className="mt-4 space-y-3">
          {items.map((gap, index) => (
            <div key={gap.id || `${gap.label}-${index}`} className={cn("rounded-2xl border bg-white px-3.5 py-3", healthPlanGapSeverityClasses(gap.severity))}>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold">{gap.label || "-"}</p>
                <Badge variant="outline" className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold">
                  {healthPlanGapKindLabel(t, gap.kind)}
                </Badge>
                <Badge variant="outline" className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", healthPlanGapSeverityClasses(gap.severity))}>
                  {healthPlanGapSeverityLabel(t, gap.severity)}
                </Badge>
              </div>
              {gap.detail && <p className="mt-1 text-sm leading-6 text-foreground/75">{gap.detail}</p>}
              {gap.staff_action && <p className="mt-2 text-xs font-medium leading-5 text-muted-foreground">{gap.staff_action}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function HealthPlanImprovementPanel({
  actions,
  completingActionIds = [],
  onCompleteAction,
}: {
  actions?: Array<{
    id?: string;
    title?: string | null;
    reason?: string | null;
    next_step?: string | null;
    priority?: "high" | "medium" | "low" | null;
    section_label?: string | null;
  }> | null;
  completingActionIds?: string[];
  onCompleteAction?: ((actionId: string) => void) | undefined;
}) {
  const { t } = useLanguage();
  const items = safeArray(actions);
  const completingLookup = new Set(safeArray(completingActionIds));

  return (
    <div className="rounded-[18px] border border-border/80 bg-white/90 px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("profile.healthPlanImproveTitle")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t("profile.healthPlanImproveDescription")}</p>
        </div>
        <Badge variant="secondary" className="rounded-full px-3 py-1">
          {items.length}
        </Badge>
      </div>
      {items.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">{t("profile.healthPlanImproveEmpty")}</p>
      ) : (
        <div className="mt-4 space-y-3">
          {items.slice(0, 5).map((item, index) => (
            <div key={item.id || `${item.title}-${index}`} className="rounded-2xl border border-border/80 bg-slate-50/70 px-3.5 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-foreground">{item.title || "-"}</p>
                <Badge variant="outline" className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", healthPlanImprovePriorityClasses(item.priority))}>
                  {healthPlanImprovePriorityLabel(t, item.priority)}
                </Badge>
                {item.section_label && (
                  <Badge variant="outline" className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold">
                    {item.section_label}
                  </Badge>
                )}
                {item.id && onCompleteAction && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="ml-auto h-8 rounded-full px-3 text-xs font-semibold"
                    disabled={completingLookup.has(item.id)}
                    onClick={() => onCompleteAction(item.id!)}
                  >
                    {completingLookup.has(item.id) ? t("profile.healthPlanImproveCompleting") : t("profile.healthPlanImproveComplete")}
                  </Button>
                )}
              </div>
              {item.reason && (
                <div className="mt-2">
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{t("profile.healthPlanImproveReason")}</p>
                  <p className="mt-1 text-sm leading-6 text-foreground/80">{item.reason}</p>
                </div>
              )}
              {item.next_step && (
                <div className="mt-2">
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{t("profile.healthPlanImproveNextStep")}</p>
                  <p className="mt-1 text-sm leading-6 text-foreground/80">{item.next_step}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function HealthPlanOutcomePanel({
  items,
  canManage = false,
  onRecordFeedback,
}: {
  items?: Array<{
    section_key?: string | null;
    label?: string | null;
    status?: "helping" | "mixed" | "fragile" | "unproven" | null;
    score?: number | null;
    latest_outcome?: "helped" | "mixed" | "did_not_help" | "needs_follow_up" | null;
    latest_note?: string | null;
    latest_source?: string | null;
    latest_recommended_next_action?: "preserve" | "verify" | "rework" | "retire" | null;
    latest_confidence_level?: "high" | "medium" | "low" | null;
    recorded_at?: string | null;
    recorded_by_email?: string | null;
    freshness_status?: "fresh" | "aging" | "stale" | null;
    contradiction_status?: "live_conflict" | "improving_against_feedback" | "section_conflict" | null;
    contradiction_reason?: string | null;
    reason?: string | null;
  }> | null;
  canManage?: boolean;
  onRecordFeedback?: ((sectionKey: string, latestOutcome?: "helped" | "mixed" | "did_not_help" | "needs_follow_up" | null, latestNote?: string | null) => void) | undefined;
}) {
  const { t } = useLanguage();
  const sections = safeArray(items);

  return (
    <div className="rounded-[18px] border border-border/80 bg-white/90 px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("profile.healthPlanOutcomeTitle")}</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{t("profile.healthPlanOutcomeDescription")}</p>
        </div>
        <Badge variant="secondary" className="rounded-full px-3 py-1">
          {sections.length}
        </Badge>
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {sections.map((item, index) => (
          <div key={item.section_key || `${item.label}-${index}`} className="rounded-2xl border border-border/80 bg-slate-50/70 px-3.5 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-foreground">{item.label || "-"}</p>
              <Badge variant="outline" className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", healthPlanOutcomeStatusTone(item.status))}>
                {healthPlanOutcomeStatusLabel(t, item.status)}
              </Badge>
              <Badge variant="outline" className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold">
                {copyScore(item.score)}
              </Badge>
              {item.freshness_status && (
                <Badge variant="outline" className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", healthPlanFeedbackFreshnessTone(item.freshness_status))}>
                  {healthPlanFeedbackFreshnessLabel(t, item.freshness_status)}
                </Badge>
              )}
              {item.contradiction_status && (
                <Badge variant="outline" className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", healthPlanContradictionTone(item.contradiction_status))}>
                  {healthPlanContradictionLabel(t, item.contradiction_status)}
                </Badge>
              )}
              {item.section_key && canManage && onRecordFeedback && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="ml-auto h-8 rounded-full px-3 text-xs font-semibold"
                  onClick={() => onRecordFeedback(item.section_key!, item.latest_outcome, item.latest_note)}
                >
                  {t("profile.healthPlanOutcomeRecord")}
                </Button>
              )}
            </div>
            {item.reason && <p className="mt-2 text-sm leading-6 text-foreground/80">{item.reason}</p>}
            {item.contradiction_reason && (
              <p className="mt-2 text-xs leading-5 text-muted-foreground">{item.contradiction_reason}</p>
            )}
            {(item.latest_outcome || item.latest_note || item.recorded_at) && (
              <div className="mt-3 rounded-xl border border-border/70 bg-white/90 px-3 py-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  {item.latest_outcome && (
                    <Badge variant="outline" className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold">
                      {healthPlanFeedbackOutcomeLabel(t, item.latest_outcome)}
                    </Badge>
                  )}
                  {item.latest_recommended_next_action && (
                    <Badge variant="outline" className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", healthPlanFeedbackNextActionTone(item.latest_recommended_next_action))}>
                      {healthPlanFeedbackNextActionLabel(t, item.latest_recommended_next_action)}
                    </Badge>
                  )}
                  {item.latest_confidence_level && (
                    <Badge variant="outline" className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold">
                      {healthPlanFeedbackConfidenceLabel(t, item.latest_confidence_level)}
                    </Badge>
                  )}
                  {item.latest_source && (
                    <Badge variant="outline" className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold">
                      {healthPlanFeedbackSourceLabel(t, item.latest_source)}
                    </Badge>
                  )}
                  {item.recorded_at && (
                    <span className="text-xs text-muted-foreground">{formatDateTimeValue(item.recorded_at)}</span>
                  )}
                </div>
                {item.latest_note && <p className="mt-2 text-sm leading-6 text-foreground/80">{item.latest_note}</p>}
                {item.recorded_by_email && <p className="mt-1 text-xs text-muted-foreground">{item.recorded_by_email}</p>}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function copyScore(score?: number | null) {
  if (!Number.isFinite(Number(score))) return "-";
  return `${Math.max(0, Math.min(100, Math.round(Number(score))))}/100`;
}

function healthPlanEscalationGradeLabel(
  t: (key: string) => string,
  grade?: "routine" | "heightened" | "urgent" | string | null,
) {
  if (grade === "urgent") return t("profile.healthPlanEscalationUrgent");
  if (grade === "heightened") return t("profile.healthPlanEscalationHeightened");
  return t("profile.healthPlanEscalationRoutine");
}

function healthPlanReviewWindowLabel(
  t: (key: string) => string,
  value?: "today" | "this_week" | "ongoing" | string | null,
) {
  if (value === "today") return t("profile.healthPlanReviewWindowToday");
  if (value === "this_week") return t("profile.healthPlanReviewWindowThisWeek");
  return t("profile.healthPlanReviewWindowOngoing");
}

function healthPlanEscalationResponseLabel(
  t: (key: string) => string,
  value?: "today" | "this_week" | "ongoing" | string | null,
) {
  if (value === "today") return t("profile.healthPlanEscalationResponseToday");
  if (value === "this_week") return t("profile.healthPlanEscalationResponseThisWeek");
  return t("profile.healthPlanEscalationResponseOngoing");
}

function healthPlanEscalationTone(grade?: "routine" | "heightened" | "urgent" | string | null) {
  if (grade === "urgent") return "border-rose-200 bg-rose-50/85";
  if (grade === "heightened") return "border-amber-200 bg-amber-50/85";
  return "border-emerald-200 bg-emerald-50/85";
}

function healthPlanEscalationBadgeTone(grade?: "routine" | "heightened" | "urgent" | string | null) {
  if (grade === "urgent") return "border-rose-200 text-rose-700";
  if (grade === "heightened") return "border-amber-200 text-amber-700";
  return "border-emerald-200 text-emerald-700";
}

function HealthPlanEscalationPanel({
  grade,
}: {
  grade?: {
    grade?: "routine" | "heightened" | "urgent" | string | null;
    response_window?: "today" | "this_week" | "ongoing" | string | null;
    summary?: string | null;
    reasons?: Array<{
      id?: string | null;
      label?: string | null;
      detail?: string | null;
      severity?: "high" | "medium" | "low" | string | null;
    }> | null;
  } | null;
}) {
  const { t } = useLanguage();
  const reasons = safeArray(grade?.reasons);

  return (
    <div className={cn("rounded-[18px] border px-4 py-4", healthPlanEscalationTone(grade?.grade))}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("profile.healthPlanEscalationTitle")}</p>
          <p className="mt-1 text-sm leading-6 text-foreground/80">{t("profile.healthPlanEscalationDescription")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className={cn("rounded-full px-3 py-1 text-xs font-semibold", healthPlanEscalationBadgeTone(grade?.grade))}>
            {healthPlanEscalationGradeLabel(t, grade?.grade)}
          </Badge>
          <Badge variant="outline" className="rounded-full px-3 py-1 text-xs font-semibold">
            {t("profile.healthPlanEscalationResponse")}: {healthPlanEscalationResponseLabel(t, grade?.response_window)}
          </Badge>
        </div>
      </div>
      {grade?.summary && <p className="mt-4 text-sm leading-6 text-foreground/85">{grade.summary}</p>}
      <div className="mt-4 space-y-3">
        {reasons.length > 0 ? reasons.slice(0, 4).map((item, index) => (
          <div key={item.id || `${item.label}-${index}`} className="rounded-2xl border border-white/70 bg-white/90 px-3.5 py-3 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-foreground">{item.label || "-"}</p>
              <Badge variant="outline" className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold">
                {item.severity === "high" ? t("profile.healthPlanSignalHigh") : item.severity === "low" ? t("profile.healthPlanSignalLow") : t("profile.healthPlanSignalMedium")}
              </Badge>
            </div>
            {item.detail && <p className="mt-1 text-sm leading-6 text-foreground/80">{item.detail}</p>}
          </div>
        )) : (
          <div className="rounded-2xl border border-white/70 bg-white/85 px-3.5 py-3">
            <p className="text-sm text-foreground/80">{t("profile.healthPlanEscalationNoDrivers")}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function HealthPlanEvidenceConflictPanel({
  items,
}: {
  items?: Array<{
    id?: string | null;
    severity?: "high" | "medium" | "low" | null;
    summary?: string | null;
    detail?: string | null;
    section_key?: string | null;
  }> | null;
}) {
  const { t } = useLanguage();
  const conflicts = safeArray(items);
  if (conflicts.length === 0) return null;

  return (
    <div className="rounded-[18px] border border-rose-200 bg-rose-50/85 px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-rose-700">{t("profile.healthPlanEvidenceConflictsTitle")}</p>
          <p className="mt-1 text-sm leading-6 text-rose-950/80">{t("profile.healthPlanEvidenceConflictsDescription")}</p>
        </div>
        <Badge variant="outline" className="rounded-full border-rose-200 px-3 py-1 text-rose-700">
          {conflicts.length}
        </Badge>
      </div>
      <div className="mt-4 space-y-3">
        {conflicts.slice(0, 4).map((item, index) => (
          <div key={item.id || `${item.summary}-${index}`} className="rounded-2xl border border-rose-200 bg-white/85 px-3.5 py-3">
            <p className="text-sm font-semibold text-foreground">{item.summary || "-"}</p>
            {item.detail && <p className="mt-1 text-sm leading-6 text-foreground/80">{item.detail}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

function HealthPlanEvidenceHierarchyPanel({
  items,
}: {
  items?: Array<{
    id?: string | null;
    label?: string | null;
    authority_level?: "highest" | "high" | "medium" | "supporting" | null;
    source_type?: string | null;
    reason?: string | null;
  }> | null;
}) {
  const { t } = useLanguage();
  const evidence = safeArray(items);
  if (evidence.length === 0) return null;

  return (
    <div className="rounded-[18px] border border-border/80 bg-white/90 px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("profile.healthPlanEvidenceHierarchyTitle")}</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{t("profile.healthPlanEvidenceHierarchyDescription")}</p>
        </div>
        <Badge variant="secondary" className="rounded-full px-3 py-1">
          {evidence.length}
        </Badge>
      </div>
      <div className="mt-4 space-y-3">
        {evidence.slice(0, 6).map((item, index) => (
          <div key={item.id || `${item.label}-${index}`} className="rounded-2xl border border-border/70 bg-slate-50/70 px-3.5 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-foreground">{item.label || "-"}</p>
              <Badge variant="outline" className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold">
                {item.authority_level || "supporting"}
              </Badge>
              {item.source_type && (
                <Badge variant="outline" className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold">
                  {item.source_type}
                </Badge>
              )}
            </div>
            {item.reason && <p className="mt-2 text-sm leading-6 text-foreground/80">{item.reason}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

function HealthPlanInterventionMemoryPanel({
  items,
}: {
  items?: Array<{
    id?: string;
    label?: string | null;
    status?: "helping" | "fragile" | "unproven" | null;
    reason?: string | null;
    supporting_points?: string[];
    section_labels?: string[];
  }> | null;
}) {
  const { t } = useLanguage();
  const grouped = {
    helping: safeArray(items).filter((item) => item.status === "helping"),
    fragile: safeArray(items).filter((item) => item.status === "fragile"),
    unproven: safeArray(items).filter((item) => item.status === "unproven"),
  };

  return (
    <div className="rounded-[18px] border border-border/80 bg-white/90 px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("profile.healthPlanInterventionTitle")}</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{t("profile.healthPlanInterventionDescription")}</p>
        </div>
        <Badge variant="secondary" className="rounded-full px-3 py-1">
          {safeArray(items).length}
        </Badge>
      </div>
      <div className="mt-4 grid gap-3 xl:grid-cols-3">
        {[
          { key: "helping", title: t("profile.healthPlanInterventionHelping"), items: grouped.helping },
          { key: "fragile", title: t("profile.healthPlanInterventionFragile"), items: grouped.fragile },
          { key: "unproven", title: t("profile.healthPlanInterventionUnproven"), items: grouped.unproven },
        ].map((group) => (
          <div key={group.key} className="rounded-2xl border border-border/70 bg-slate-50/70 p-3.5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">{group.title}</p>
              <Badge variant="outline" className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold">
                {group.items.length}
              </Badge>
            </div>
            {group.items.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">{t("profile.healthPlanInterventionEmptyGroup")}</p>
            ) : (
              <div className="mt-3 space-y-3">
                {group.items.map((item, index) => (
                  <div key={item.id || `${item.label}-${index}`} className={cn("rounded-2xl border px-3.5 py-3", healthPlanInterventionTone(item.status))}>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold">{item.label || "-"}</p>
                      <Badge variant="outline" className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", healthPlanInterventionTone(item.status))}>
                        {healthPlanInterventionLabel(t, item.status)}
                      </Badge>
                    </div>
                    {item.reason && <p className="mt-2 text-sm leading-6">{item.reason}</p>}
                    {safeArray(item.section_labels).length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {safeArray(item.section_labels).slice(0, 3).map((label, labelIndex) => (
                          <Badge key={`${label}-${labelIndex}`} variant="outline" className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold">
                            {label}
                          </Badge>
                        ))}
                      </div>
                    )}
                    {safeArray(item.supporting_points).length > 0 && (
                      <div className="mt-3 space-y-1">
                        {safeArray(item.supporting_points).slice(0, 3).map((point, pointIndex) => (
                          <p key={`${point}-${pointIndex}`} className="text-xs leading-5 opacity-85">
                            {point}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function HealthPlanRecommendationSurvivorshipPanel({
  summary,
}: {
  summary?: {
    summary?: string | null;
    durable?: Array<any>;
    emerging?: Array<any>;
    fragile?: Array<any>;
    retired?: Array<any>;
  } | null;
}) {
  const { t } = useLanguage();
  const groups = [
    { key: "durable", title: t("profile.healthPlanSurvivorshipDurable"), items: safeArray(summary?.durable) },
    { key: "emerging", title: t("profile.healthPlanSurvivorshipEmerging"), items: safeArray(summary?.emerging) },
    { key: "fragile", title: t("profile.healthPlanSurvivorshipFragile"), items: safeArray(summary?.fragile) },
    { key: "retired", title: t("profile.healthPlanSurvivorshipRetired"), items: safeArray(summary?.retired) },
  ].filter((group) => group.items.length > 0);

  if (groups.length === 0) return null;

  return (
    <div className="rounded-[18px] border border-border/80 bg-white/90 px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("profile.healthPlanSurvivorshipTitle")}</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{summary?.summary || t("profile.healthPlanSurvivorshipDescription")}</p>
        </div>
        <Badge variant="secondary" className="rounded-full px-3 py-1">
          {groups.reduce((total, group) => total + group.items.length, 0)}
        </Badge>
      </div>
      <div className="mt-4 grid gap-3 xl:grid-cols-2">
        {groups.map((group) => (
          <div key={group.key} className="rounded-2xl border border-border/70 bg-slate-50/70 p-3.5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">{group.title}</p>
              <Badge variant="outline" className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold">
                {group.items.length}
              </Badge>
            </div>
            <div className="mt-3 space-y-3">
              {group.items.slice(0, 3).map((item, index) => (
                <div key={item.item_key || `${item.text}-${index}`} className={cn("rounded-2xl border px-3.5 py-3", healthPlanSurvivorshipTone(item.status))}>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold">{item.text || "-"}</p>
                    <Badge variant="outline" className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", healthPlanSurvivorshipTone(item.status))}>
                      {healthPlanSurvivorshipLabel(t, item.status)}
                    </Badge>
                    {item.reuse_priority && (
                      <Badge variant="outline" className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", healthPlanReusePriorityTone(item.reuse_priority))}>
                        {healthPlanReusePriorityLabel(t, item.reuse_priority)}
                      </Badge>
                    )}
                  </div>
                  {item.reason && <p className="mt-2 text-sm leading-6">{item.reason}</p>}
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <Badge variant="outline" className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold">
                      {healthPlanHistorySectionLabel(t, item.section_key)}
                    </Badge>
                    <Badge variant="outline" className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold">
                      {interpolate(t("profile.healthPlanSurvivorshipVersions"), { count: item.appearance_count })}
                    </Badge>
                    {Number(item.helped_count || 0) > 0 && (
                      <Badge variant="outline" className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold">
                        {interpolate(t("profile.healthPlanSurvivorshipHelped"), { count: item.helped_count })}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function HealthPlanFollowThroughPanel({
  summary,
}: {
  summary?: {
    status?: "fresh" | "mixed" | "needs_review" | null;
    summary?: string | null;
    recommendation?: string | null;
    positive_signals?: Array<{ id?: string; label?: string | null; detail?: string | null }>;
    caution_signals?: Array<{ id?: string; label?: string | null; detail?: string | null }>;
  } | null;
}) {
  const { t } = useLanguage();
  if (!summary) return null;

  return (
    <div className="rounded-[18px] border border-border/80 bg-white/85 px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("profile.healthPlanFollowThroughTitle")}</p>
          <p className="mt-1 text-sm leading-6 text-foreground/80">{summary.summary || "-"}</p>
        </div>
        <Badge variant="outline" className={cn("rounded-full px-3 py-1 text-[11px] font-semibold", healthPlanFollowThroughTone(summary.status))}>
          {healthPlanFollowThroughLabel(t, summary.status)}
        </Badge>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">{t("profile.healthPlanFollowThroughPositive")}</p>
          {safeArray(summary.positive_signals).length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("profile.healthPlanFollowThroughNoPositive")}</p>
          ) : (
            safeArray(summary.positive_signals).slice(0, 3).map((item, index) => (
              <div key={item.id || `${item.label}-${index}`} className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2">
                <p className="text-sm font-semibold text-emerald-900">{item.label || "-"}</p>
                {item.detail && <p className="mt-1 text-sm leading-5 text-emerald-950/80">{item.detail}</p>}
              </div>
            ))
          )}
        </div>
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">{t("profile.healthPlanFollowThroughCaution")}</p>
          {safeArray(summary.caution_signals).length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("profile.healthPlanFollowThroughNoCaution")}</p>
          ) : (
            safeArray(summary.caution_signals).slice(0, 3).map((item, index) => (
              <div key={item.id || `${item.label}-${index}`} className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2">
                <p className="text-sm font-semibold text-amber-900">{item.label || "-"}</p>
                {item.detail && <p className="mt-1 text-sm leading-5 text-amber-950/80">{item.detail}</p>}
              </div>
            ))
          )}
        </div>
      </div>
      {summary.recommendation && (
        <p className="mt-4 text-sm font-medium text-foreground">{summary.recommendation}</p>
      )}
    </div>
  );
}

function HealthPlanFreshnessPanel({
  summary,
}: {
  summary?: {
    status?: "current" | "aging" | "stale" | "critical" | null;
    summary?: string | null;
    recommendation?: string | null;
    checkpoint_type?: "generated" | "reviewed" | null;
    checkpoint_at?: string | null;
    drivers?: Array<{
      id?: string | null;
      label?: string | null;
      detail?: string | null;
      severity?: "high" | "medium" | "low" | null;
    }>;
  } | null;
}) {
  const { t } = useLanguage();
  if (!summary) return null;

  return (
    <div className="rounded-[18px] border border-border/80 bg-white/85 px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("profile.healthPlanFreshnessTitle")}</p>
          <p className="mt-1 text-sm leading-6 text-foreground/80">{summary.summary || "-"}</p>
          {summary.checkpoint_at && (
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              {summary.checkpoint_type === "reviewed"
                ? t("profile.healthPlanFreshnessCheckpointReviewed")
                : t("profile.healthPlanFreshnessCheckpointGenerated")}: {formatDateTime(summary.checkpoint_at)}
            </p>
          )}
        </div>
        <Badge variant="outline" className={cn("rounded-full px-3 py-1 text-[11px] font-semibold", healthPlanFreshnessTone(summary.status))}>
          {healthPlanFreshnessLabel(t, summary.status)}
        </Badge>
      </div>
      {safeArray(summary.drivers).length > 0 && (
        <div className="mt-4 space-y-2">
          {safeArray(summary.drivers).slice(0, 3).map((item, index) => (
            <div key={item.id || `${item.label}-${index}`} className="rounded-xl border border-slate-200 bg-slate-50/85 px-3 py-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-foreground">{item.label || "-"}</p>
                <Badge variant="outline" className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", healthPlanClinicalSeverityTone(item.severity))}>
                  {healthPlanClinicalSeverityLabel(t, item.severity)}
                </Badge>
              </div>
              {item.detail && <p className="mt-1 text-sm leading-5 text-muted-foreground">{item.detail}</p>}
            </div>
          ))}
        </div>
      )}
      {summary.recommendation && (
        <div className="mt-4 rounded-xl border border-primary/10 bg-primary/5 px-3 py-2.5">
          <p className="text-sm font-medium text-foreground">{summary.recommendation}</p>
        </div>
      )}
    </div>
  );
}

function healthPlanClinicalSeverityTone(severity?: "high" | "medium" | "low" | string | null) {
  if (severity === "high") return "border-rose-200 bg-rose-50 text-rose-700";
  if (severity === "medium") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function healthPlanClinicalSeverityLabel(t: (key: string) => string, severity?: "high" | "medium" | "low" | string | null) {
  if (severity === "high") return t("profile.healthPlanSignalHigh");
  if (severity === "medium") return t("profile.healthPlanSignalMedium");
  return t("profile.healthPlanSignalLow");
}

function healthPlanFallbackOwnerLabel(
  t: (key: string) => string,
  owner?: "assigned_staff" | "caregiver" | "on_call_coordinator" | "care_team" | string | null,
) {
  if (owner === "assigned_staff") return t("profile.healthPlanFallbackAssignedStaff");
  if (owner === "caregiver") return t("profile.healthPlanFallbackCaregiver");
  if (owner === "on_call_coordinator") return t("profile.healthPlanFallbackCoordinator");
  if (owner === "care_team") return t("profile.healthPlanFallbackCareTeam");
  return t("profile.healthPlanFallbackUnknown");
}

function HealthPlanPriorityHandoffBanner({
  summary,
}: {
  summary?: {
    overall_status?: "same_day" | "this_week" | "routine" | string | null;
    same_day_count?: number | null;
    actions?: Array<{
      id?: string | null;
      section_key?: string | null;
      section_label?: string | null;
      action_text?: string | null;
      response_window?: "today" | "this_week" | "ongoing" | string | null;
      priority?: "high" | "medium" | "low" | string | null;
      owner_role?: "assigned_staff" | "caregiver" | "on_call_coordinator" | "care_team" | string | null;
      fallback_owner_role?: "assigned_staff" | "caregiver" | "on_call_coordinator" | "care_team" | string | null;
      verification_required?: boolean | null;
      completion_signal?: string | null;
      why_now?: string | null;
    }> | null;
    gaps?: Array<{
      id?: string | null;
      label?: string | null;
    }> | null;
  } | null;
}) {
  const { t } = useLanguage();
  const actions = safeArray(summary?.actions);
  const sameDayActions = actions.filter((item) => item?.response_window === "today");
  const spotlightActions = (sameDayActions.length ? sameDayActions : actions).slice(0, 2);
  const gaps = safeArray(summary?.gaps);

  if (!summary || summary.overall_status !== "same_day" || spotlightActions.length === 0) {
    return null;
  }

  return (
    <div className="rounded-[18px] border border-rose-200/80 bg-[linear-gradient(135deg,rgba(255,252,252,0.98),rgba(255,242,244,0.96))] px-4 py-4 shadow-[0_18px_36px_rgba(15,23,42,0.06)]">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="rounded-full border-rose-200 bg-white/90 px-3 py-1 text-[11px] font-semibold text-rose-700">
              {t("profile.healthPlanPriorityHandoffTitle")}
            </Badge>
            <Badge variant="outline" className="rounded-full border-amber-200 bg-amber-50/90 px-3 py-1 text-[11px] font-semibold text-amber-800">
              {interpolate(t("profile.healthPlanPriorityHandoffTodayCount"), {
                count: Number(summary.same_day_count || sameDayActions.length || spotlightActions.length),
              })}
            </Badge>
            {gaps.length > 0 && (
              <Badge variant="outline" className="rounded-full border-rose-200 bg-white/90 px-3 py-1 text-[11px] font-semibold text-rose-700">
                {interpolate(t("profile.healthPlanPriorityHandoffGapCount"), { count: gaps.length })}
              </Badge>
            )}
          </div>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-foreground/78">
            {t("profile.healthPlanPriorityHandoffDescription")}
          </p>
        </div>
        <div className="rounded-2xl border border-white/80 bg-white/88 px-4 py-3 text-right shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
            {t("profile.healthPlanExecutionTitle")}
          </p>
          <p className="mt-1 text-sm font-semibold text-foreground">
            {healthPlanExecutionBriefLabel(t, summary.overall_status)}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-2">
        {spotlightActions.map((item, index) => (
          <div
            key={item.id || `${item.section_key || "handoff"}-${index}`}
            className="rounded-[16px] border border-white/90 bg-white/92 px-4 py-4 shadow-sm"
          >
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold">
                {item.section_label || healthPlanHistorySectionLabel(t, item.section_key)}
              </Badge>
              <Badge
                variant="outline"
                className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", healthPlanRecommendationPriorityClasses(item.priority))}
              >
                {healthPlanRecommendationPriorityLabel(t, item.priority as "high" | "medium" | "low" | null)}
              </Badge>
              {item.verification_required && (
                <Badge variant="outline" className="rounded-full border-amber-200 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700">
                  {t("profile.healthPlanExecutionVerifyFirst")}
                </Badge>
              )}
            </div>
            <p className="mt-3 text-sm font-semibold leading-6 text-foreground">
              {item.action_text || t("profile.healthPlanPriorityHandoffActionFallback")}
            </p>
            {(item.why_now || item.completion_signal) && (
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                {item.why_now && (
                  <div className="rounded-2xl border border-rose-100 bg-rose-50/70 px-3 py-2.5">
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-rose-700">{t("profile.healthPlanExecutionWhyNow")}</p>
                    <p className="mt-1 text-sm leading-6 text-foreground/85">{item.why_now}</p>
                  </div>
                )}
                {item.completion_signal && (
                  <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/75 px-3 py-2.5">
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-800">{t("profile.healthPlanExecutionCompletion")}</p>
                    <p className="mt-1 text-sm leading-6 text-foreground/85">{item.completion_signal}</p>
                  </div>
                )}
              </div>
            )}
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              <div className="rounded-2xl border border-border/70 bg-slate-50/85 px-3 py-2.5">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{t("profile.healthPlanExecutionPrimaryOwner")}</p>
                <p className="mt-1 text-sm font-semibold text-foreground">{healthPlanFallbackOwnerLabel(t, item.owner_role)}</p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-slate-50/85 px-3 py-2.5">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{t("profile.healthPlanExecutionFallbackOwner")}</p>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  {item.fallback_owner_role ? healthPlanFallbackOwnerLabel(t, item.fallback_owner_role) : t("profile.healthPlanFallbackUnknown")}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function HealthPlanExecutionBriefPanel({
  summary,
}: {
  summary?: {
    overall_status?: "same_day" | "this_week" | "routine" | string | null;
    summary?: string | null;
    action_count?: number | null;
    same_day_count?: number | null;
    this_week_count?: number | null;
    actions?: Array<{
      id?: string | null;
      section_key?: string | null;
      section_label?: string | null;
      action_text?: string | null;
      response_window?: "today" | "this_week" | "ongoing" | string | null;
      priority?: "high" | "medium" | "low" | string | null;
      owner_role?: "assigned_staff" | "caregiver" | "on_call_coordinator" | "care_team" | string | null;
      fallback_owner_role?: "assigned_staff" | "caregiver" | "on_call_coordinator" | "care_team" | string | null;
      verification_required?: boolean | null;
      completion_signal?: string | null;
      why_now?: string | null;
      execution_gaps?: Array<{
        id?: string | null;
        label?: string | null;
      }> | null;
    }> | null;
    gaps?: Array<{
      id?: string | null;
      label?: string | null;
      severity?: "high" | "medium" | "low" | string | null;
    }> | null;
  } | null;
}) {
  const { t } = useLanguage();
  const actions = safeArray(summary?.actions);
  const gaps = safeArray(summary?.gaps);

  if (!summary || actions.length === 0) return null;

  return (
    <div className="rounded-[20px] border border-primary/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(246,243,255,0.86))] px-5 py-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("profile.healthPlanExecutionTitle")}</p>
            <Badge variant="outline" className={cn("rounded-full px-3 py-1 text-xs font-semibold", healthPlanExecutionBriefTone(summary?.overall_status))}>
              {healthPlanExecutionBriefLabel(t, summary?.overall_status)}
            </Badge>
          </div>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            {summary?.summary || t("profile.healthPlanExecutionDescription")}
          </p>
        </div>
        <div className="grid min-w-[220px] gap-2 sm:grid-cols-3 lg:min-w-[300px]">
          <div className="rounded-2xl border border-border/70 bg-white/90 px-3.5 py-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{t("profile.healthPlanExecutionActionCountLabel")}</p>
            <p className="mt-1 text-2xl font-bold text-foreground">{Number(summary?.action_count || 0)}</p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-white/90 px-3.5 py-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{t("profile.healthPlanExecutionSameDayCountLabel")}</p>
            <p className="mt-1 text-2xl font-bold text-foreground">{Number(summary?.same_day_count || 0)}</p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-white/90 px-3.5 py-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{t("profile.healthPlanExecutionThisWeekCountLabel")}</p>
            <p className="mt-1 text-2xl font-bold text-foreground">{Number(summary?.this_week_count || 0)}</p>
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-3">
        {actions.map((item, index) => (
          <div key={item.id || `${item.section_key || "action"}-${index}`} className="rounded-[18px] border border-border/70 bg-white/92 px-4 py-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold">
                    {item.section_label || healthPlanHistorySectionLabel(t, item.section_key)}
                  </Badge>
                  <Badge variant="outline" className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", healthPlanRecommendationPriorityClasses(item.priority))}>
                    {healthPlanRecommendationPriorityLabel(t, item.priority as "high" | "medium" | "low" | null)}
                  </Badge>
                  <Badge variant="outline" className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", healthPlanRecommendationTimingClasses(item.response_window))}>
                    {healthPlanRecommendationTimingLabel(t, item.response_window as "today" | "this_week" | "ongoing" | null)}
                  </Badge>
                  {item.verification_required && (
                    <Badge variant="outline" className="rounded-full border-amber-200 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700">
                      {t("profile.healthPlanExecutionVerifyFirst")}
                    </Badge>
                  )}
                </div>
                <p className="mt-3 text-sm font-semibold leading-6 text-foreground">{item.action_text || "-"}</p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:w-[320px]">
                <div className="rounded-2xl border border-border/70 bg-slate-50/80 px-3 py-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{t("profile.healthPlanExecutionPrimaryOwner")}</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">{healthPlanFallbackOwnerLabel(t, item.owner_role)}</p>
                </div>
                <div className="rounded-2xl border border-border/70 bg-slate-50/80 px-3 py-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{t("profile.healthPlanExecutionFallbackOwner")}</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">{item.fallback_owner_role ? healthPlanFallbackOwnerLabel(t, item.fallback_owner_role) : t("profile.healthPlanFallbackUnknown")}</p>
                </div>
              </div>
            </div>
            {item.why_now && (
              <div className="mt-3 rounded-2xl border border-primary/10 bg-primary/5 px-3.5 py-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-primary/80">{t("profile.healthPlanExecutionWhyNow")}</p>
                <p className="mt-1 text-sm leading-6 text-foreground/85">{item.why_now}</p>
              </div>
            )}
            {item.completion_signal && (
              <div className="mt-3 rounded-2xl border border-emerald-200/80 bg-emerald-50/80 px-3.5 py-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-800">{t("profile.healthPlanExecutionCompletion")}</p>
                <p className="mt-1 text-sm leading-6 text-foreground/85">{item.completion_signal}</p>
              </div>
            )}
            {safeArray(item.execution_gaps).length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {safeArray(item.execution_gaps).slice(0, 2).map((gap, gapIndex) => (
                  <Badge key={gap.id || `${item.id || index}-gap-${gapIndex}`} variant="outline" className="rounded-full border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800">
                    {gap.label || t("profile.healthPlanExecutionGapFallback")}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {gaps.length > 0 && (
        <div className="mt-4 rounded-[18px] border border-amber-200 bg-amber-50/80 px-4 py-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-amber-800">{t("profile.healthPlanExecutionGapsTitle")}</p>
            <Badge variant="outline" className="rounded-full border-amber-200 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800">
              {gaps.length}
            </Badge>
          </div>
          <div className="mt-3 space-y-2">
            {gaps.slice(0, 4).map((gap, index) => (
              <div key={gap.id || `gap-${index}`} className="flex items-start gap-2 rounded-2xl bg-white/80 px-3 py-2.5">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                <div className="min-w-0">
                  <p className="text-sm leading-6 text-foreground/85">{gap.label || t("profile.healthPlanExecutionGapFallback")}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function HealthPlanClinicalCautionPanel({
  cautions,
  issues,
}: {
  cautions?: Array<{
    id?: string | null;
    label?: string | null;
    detail?: string | null;
    severity?: "high" | "medium" | "low" | string | null;
    guidance?: string | null;
  }> | null;
  issues?: Array<{
    id?: string | null;
    section_key?: string | null;
    message?: string | null;
  }> | null;
}) {
  const { t } = useLanguage();
  const items = safeArray(cautions);
  const issueList = safeArray(issues);

  return (
    <div className="rounded-[18px] border border-rose-200/70 bg-white/92 px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("profile.healthPlanClinicalTitle")}</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{t("profile.healthPlanClinicalDescription")}</p>
        </div>
        <Badge variant="outline" className={cn("rounded-full px-3 py-1 text-xs font-semibold", issueList.length ? "border-rose-200 text-rose-700" : "border-emerald-200 text-emerald-700")}>
          {issueList.length ? interpolate(t("profile.healthPlanClinicalOpen"), { count: issueList.length }) : t("profile.healthPlanClinicalCovered")}
        </Badge>
      </div>
      <div className="mt-4 space-y-3">
        {items.map((item, index) => {
          const itemIssues = issueList.filter((issue) => issue.id === item.id);
          return (
            <div key={item.id || `${item.label}-${index}`} className="rounded-2xl border border-border/80 bg-slate-50/70 px-3.5 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-foreground">{item.label || "-"}</p>
                <Badge variant="outline" className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", healthPlanClinicalSeverityTone(item.severity))}>
                  {healthPlanClinicalSeverityLabel(t, item.severity)}
                </Badge>
                {itemIssues.length > 0 && (
                  <Badge variant="outline" className="rounded-full border-rose-200 px-2.5 py-0.5 text-[11px] font-semibold text-rose-700">
                    {t("profile.healthPlanClinicalNeedsWork")}
                  </Badge>
                )}
              </div>
              {item.detail && <p className="mt-1 text-sm leading-6 text-foreground/80">{item.detail}</p>}
              {item.guidance && <p className="mt-2 text-xs font-medium leading-5 text-muted-foreground">{item.guidance}</p>}
              {itemIssues.length > 0 && (
                <div className="mt-3 space-y-2">
                  {itemIssues.map((issue, issueIndex) => (
                    <div key={`${issue.id}-${issue.section_key}-${issueIndex}`} className="rounded-xl border border-rose-100 bg-white px-3 py-2.5">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-rose-700">
                        {healthPlanHistorySectionLabel(t, issue.section_key)}
                      </p>
                      {issue.message && <p className="mt-1 text-sm leading-6 text-foreground/85">{issue.message}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function HealthPlanConfidencePanel({
  profile,
}: {
  profile?: {
    overall_status?: "strong" | "guarded" | "fragile" | null;
    summary?: string | null;
    reasons?: Array<{
      id?: string | null;
      label?: string | null;
      detail?: string | null;
      severity?: "high" | "medium" | "low" | null;
      section_key?: string | null;
    }> | null;
    section_confidence?: Array<{
      section_key?: string | null;
      max_confidence?: "high" | "medium" | "low" | null;
      reasons?: Array<{ label?: string | null }> | null;
    }> | null;
  } | null;
}) {
  const { t } = useLanguage();
  const reasons = safeArray(profile?.reasons);
  const sections = safeArray(profile?.section_confidence);

  return (
    <div className="rounded-[18px] border border-border/80 bg-white/90 px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("profile.healthPlanConfidencePanelTitle")}</p>
          <p className="mt-1 text-sm leading-6 text-foreground/80">{profile?.summary || t("profile.healthPlanConfidencePanelFallback")}</p>
        </div>
        <Badge variant="outline" className={cn("rounded-full px-3 py-1 text-xs font-semibold", healthPlanConfidenceTone(profile?.overall_status))}>
          {healthPlanConfidenceLabel(t, profile?.overall_status)}
        </Badge>
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(280px,1fr)]">
        <div className="space-y-3">
          {reasons.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("profile.healthPlanConfidenceReasonsEmpty")}</p>
          ) : (
            reasons.slice(0, 4).map((reason, index) => (
              <div key={`${reason.id || reason.label || "reason"}-${index}`} className="rounded-2xl border border-border/70 bg-slate-50/70 px-3.5 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-foreground">{reason.label || "-"}</p>
                  <Badge variant="outline" className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", healthPlanGapSeverityClasses(reason.severity))}>
                    {healthPlanGapSeverityLabel(t, reason.severity)}
                  </Badge>
                </div>
                {reason.detail && <p className="mt-1 text-sm leading-6 text-foreground/80">{reason.detail}</p>}
              </div>
            ))
          )}
        </div>
        <div className="rounded-2xl border border-border/70 bg-slate-50/70 px-3.5 py-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("profile.healthPlanConfidenceSectionCaps")}</p>
          <div className="mt-3 space-y-2.5">
            {sections.slice(0, 5).map((section, index) => (
              <div key={section.section_key || index} className="flex items-center justify-between gap-3 rounded-xl border border-white/80 bg-white/90 px-3 py-2.5">
                <span className="text-sm font-medium text-foreground">{healthPlanHistorySectionLabel(t, section.section_key)}</span>
                <Badge
                  variant="outline"
                  className={cn(
                    "rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                    section.max_confidence === "high" && "border-emerald-200 bg-emerald-50 text-emerald-700",
                    section.max_confidence === "medium" && "border-amber-200 bg-amber-50 text-amber-700",
                    section.max_confidence === "low" && "border-rose-200 bg-rose-50 text-rose-700",
                  )}
                >
                  {section.max_confidence === "high"
                    ? t("profile.healthPlanConfidenceCapHigh")
                    : section.max_confidence === "medium"
                      ? t("profile.healthPlanConfidenceCapMedium")
                      : t("profile.healthPlanConfidenceCapLow")}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function HealthPlanReviewPriorityPanel({
  summary,
}: {
  summary?: {
    summary?: string | null;
    items?: Array<{
      id?: string | null;
      section_key?: string | null;
      section_label?: string | null;
      priority?: "high" | "medium" | "low" | null;
      response_window?: "today" | "this_week" | "ongoing" | string | null;
      why_now?: string | null;
      recommended_staff_check?: string | null;
    }> | null;
  } | null;
}) {
  const { t } = useLanguage();
  const items = safeArray(summary?.items);

  return (
    <div className="rounded-[18px] border border-border/80 bg-white/90 px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("profile.healthPlanPriorityTitle")}</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{summary?.summary || t("profile.healthPlanPriorityDescription")}</p>
        </div>
        <Badge variant="secondary" className="rounded-full px-3 py-1">
          {items.length}
        </Badge>
      </div>
      {items.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">{t("profile.healthPlanPriorityEmpty")}</p>
      ) : (
        <div className="mt-4 grid gap-3 xl:grid-cols-2">
          {items.slice(0, 4).map((item, index) => (
            <div key={item.id || `${item.section_key}-${index}`} className="rounded-2xl border border-border/70 bg-slate-50/70 px-3.5 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-foreground">{item.section_label || healthPlanHistorySectionLabel(t, item.section_key)}</p>
                <Badge variant="outline" className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", healthPlanImprovePriorityClasses(item.priority))}>
                  {healthPlanImprovePriorityLabel(t, item.priority)}
                </Badge>
                <Badge variant="outline" className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold">
                  {healthPlanReviewWindowLabel(t, item.response_window)}
                </Badge>
              </div>
              {item.why_now && (
                <div className="mt-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{t("profile.healthPlanPriorityWhyNow")}</p>
                  <p className="mt-1 text-sm leading-6 text-foreground/80">{item.why_now}</p>
                </div>
              )}
              {item.recommended_staff_check && (
                <div className="mt-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{t("profile.healthPlanPriorityCheck")}</p>
                  <p className="mt-1 text-sm leading-6 text-foreground/80">{item.recommended_staff_check}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function HealthPlanGenerationQualityPanel({
  summary,
}: {
  summary?: {
    overall_status?: "strong" | "guarded" | "fragile" | null;
    score?: number | null;
    generation_path?: "direct" | "repair" | "fallback" | null;
    summary?: string | null;
    issues?: Array<{
      section_key?: string | null;
      severity?: "high" | "medium" | "low" | null;
      message?: string | null;
    }> | null;
  } | null;
}) {
  const { t } = useLanguage();
  const issues = safeArray(summary?.issues);

  return (
    <div className="rounded-[18px] border border-border/80 bg-white/90 px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("profile.healthPlanGenerationQualityTitle")}</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{summary?.summary || t("profile.healthPlanGenerationQualityDescription")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className={cn("rounded-full px-3 py-1 text-xs font-semibold", healthPlanGenerationStatusTone(summary?.overall_status))}>
            {healthPlanGenerationStatusLabel(t, summary?.overall_status)}
          </Badge>
          <Badge variant="outline" className="rounded-full px-3 py-1 text-xs font-semibold">
            {healthPlanGenerationPathLabel(t, summary?.generation_path)}
          </Badge>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Badge variant="secondary" className="rounded-full px-3 py-1">
          {interpolate(t("profile.healthPlanGenerationQualityScore"), { score: Number(summary?.score || 0) })}
        </Badge>
        <Badge variant="secondary" className="rounded-full px-3 py-1">
          {interpolate(t("profile.healthPlanGenerationQualityIssues"), { count: issues.length })}
        </Badge>
      </div>
      {issues.length > 0 && (
        <div className="mt-4 grid gap-3 xl:grid-cols-2">
          {issues.slice(0, 4).map((issue, index) => (
            <div key={`${issue.section_key}-${issue.message}-${index}`} className="rounded-2xl border border-border/70 bg-slate-50/70 px-3.5 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-foreground">{healthPlanHistorySectionLabel(t, issue.section_key)}</p>
                <Badge variant="outline" className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", healthPlanGapSeverityClasses(issue.severity))}>
                  {healthPlanGapSeverityLabel(t, issue.severity)}
                </Badge>
              </div>
              {issue.message && <p className="mt-2 text-sm leading-6 text-foreground/80">{issue.message}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function HealthPlanRecommendationCoveragePanel({
  summary,
}: {
  summary?: {
    overall_status?: "strong" | "guarded" | "fragile" | null;
    score?: number | null;
    summary?: string | null;
    must_address_count?: number | null;
    must_address_covered_count?: number | null;
    verification_need_count?: number | null;
    verification_covered_count?: number | null;
    stabilizing_fact_count?: number | null;
    stabilizing_preserved_count?: number | null;
    issues?: Array<{
      section_key?: string | null;
      severity?: "high" | "medium" | "low" | null;
      message?: string | null;
    }> | null;
  } | null;
}) {
  const { t } = useLanguage();
  const issues = safeArray(summary?.issues);

  return (
    <div className="rounded-[18px] border border-border/80 bg-white/90 px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("profile.healthPlanCoverageTitle")}</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{summary?.summary || t("profile.healthPlanCoverageDescription")}</p>
        </div>
        <Badge variant="outline" className={cn("rounded-full px-3 py-1 text-xs font-semibold", healthPlanCoverageTone(summary?.overall_status))}>
          {healthPlanCoverageLabel(t, summary?.overall_status)}
        </Badge>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Badge variant="secondary" className="rounded-full px-3 py-1">
          {interpolate(t("profile.healthPlanCoverageScore"), { score: Number(summary?.score || 0) })}
        </Badge>
        <Badge variant="secondary" className="rounded-full px-3 py-1">
          {interpolate(t("profile.healthPlanCoverageMustAddress"), {
            covered: Number(summary?.must_address_covered_count || 0),
            total: Number(summary?.must_address_count || 0),
          })}
        </Badge>
        <Badge variant="secondary" className="rounded-full px-3 py-1">
          {interpolate(t("profile.healthPlanCoverageVerification"), {
            covered: Number(summary?.verification_covered_count || 0),
            total: Number(summary?.verification_need_count || 0),
          })}
        </Badge>
        {Number(summary?.stabilizing_fact_count || 0) > 0 && (
          <Badge variant="secondary" className="rounded-full px-3 py-1">
            {interpolate(t("profile.healthPlanCoverageStabilizing"), {
              covered: Number(summary?.stabilizing_preserved_count || 0),
              total: Number(summary?.stabilizing_fact_count || 0),
            })}
          </Badge>
        )}
      </div>
      {issues.length > 0 && (
        <div className="mt-4 grid gap-3 xl:grid-cols-2">
          {issues.slice(0, 4).map((issue, index) => (
            <div key={`${issue.section_key}-${issue.message}-${index}`} className="rounded-2xl border border-border/70 bg-slate-50/70 px-3.5 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-foreground">{healthPlanHistorySectionLabel(t, issue.section_key)}</p>
                <Badge variant="outline" className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", healthPlanGapSeverityClasses(issue.severity))}>
                  {healthPlanGapSeverityLabel(t, issue.severity)}
                </Badge>
              </div>
              {issue.message && <p className="mt-2 text-sm leading-6 text-foreground/80">{issue.message}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function HealthPlanRecommendationGroundingPanel({
  summary,
}: {
  summary?: {
    overall_status?: "strong" | "guarded" | "fragile" | null;
    score?: number | null;
    summary?: string | null;
    strong_count?: number | null;
    guarded_count?: number | null;
    fragile_count?: number | null;
    issues?: Array<{
      section_key?: string | null;
      severity?: "high" | "medium" | "low" | null;
      message?: string | null;
    }> | null;
    items?: Array<{
      item_id?: string | null;
      section_key?: string | null;
      text?: string | null;
      grounding_status?: "strong" | "guarded" | "fragile" | null;
      top_source_label?: string | null;
      evidence_quality?: "strong" | "mixed" | "thin" | null;
    }> | null;
  } | null;
}) {
  const { t } = useLanguage();
  const issues = safeArray(summary?.issues);
  const items = safeArray(summary?.items);
  const fragileItems = items.filter((item) => item.grounding_status !== "strong");

  return (
    <div className="rounded-[18px] border border-border/80 bg-white/90 px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("profile.healthPlanGroundingTitle")}</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{summary?.summary || t("profile.healthPlanGroundingDescription")}</p>
        </div>
        <Badge variant="outline" className={cn("rounded-full px-3 py-1 text-xs font-semibold", healthPlanGroundingTone(summary?.overall_status))}>
          {healthPlanGroundingLabel(t, summary?.overall_status)}
        </Badge>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Badge variant="secondary" className="rounded-full px-3 py-1">
          {interpolate(t("profile.healthPlanGroundingScore"), { score: Number(summary?.score || 0) })}
        </Badge>
        <Badge variant="secondary" className="rounded-full px-3 py-1">
          {interpolate(t("profile.healthPlanGroundingStrongCount"), { count: Number(summary?.strong_count || 0) })}
        </Badge>
        <Badge variant="secondary" className="rounded-full px-3 py-1">
          {interpolate(t("profile.healthPlanGroundingFragileCount"), { count: Number(summary?.fragile_count || 0) })}
        </Badge>
      </div>
      {fragileItems.length > 0 && (
        <div className="mt-4 grid gap-3 xl:grid-cols-2">
          {fragileItems.slice(0, 4).map((item, index) => (
            <div key={item.item_id || `${item.section_key}-${index}`} className="rounded-2xl border border-border/70 bg-slate-50/70 px-3.5 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-foreground">{item.text || "-"}</p>
                <Badge variant="outline" className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", healthPlanGroundingTone(item.grounding_status))}>
                  {healthPlanGroundingLabel(t, item.grounding_status)}
                </Badge>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {item.section_key && (
                  <Badge variant="outline" className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold">
                    {healthPlanHistorySectionLabel(t, item.section_key)}
                  </Badge>
                )}
                {item.evidence_quality && (
                  <Badge variant="outline" className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold">
                    {item.evidence_quality}
                  </Badge>
                )}
              </div>
              {item.top_source_label && <p className="mt-2 text-sm leading-6 text-foreground/80">{item.top_source_label}</p>}
            </div>
          ))}
        </div>
      )}
      {issues.length > 0 && (
        <div className="mt-4 grid gap-3 xl:grid-cols-2">
          {issues.slice(0, 4).map((issue, index) => (
            <div key={`${issue.section_key}-${issue.message}-${index}`} className="rounded-2xl border border-border/70 bg-slate-50/70 px-3.5 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-foreground">{healthPlanHistorySectionLabel(t, issue.section_key)}</p>
                <Badge variant="outline" className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", healthPlanGapSeverityClasses(issue.severity))}>
                  {healthPlanGapSeverityLabel(t, issue.severity)}
                </Badge>
              </div>
              {issue.message && <p className="mt-2 text-sm leading-6 text-foreground/80">{issue.message}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function HealthPlanBenchmarkPanel({
  summary,
}: {
  summary?: {
    summary?: string | null;
    matched_case_count?: number | null;
    average_score?: number | null;
    average_rubric_score?: number | null;
    overall_status?: "strong" | "guarded" | "fragile" | "unmatched" | null;
    evaluations?: Array<{
      case_id?: string | null;
      case_label?: string | null;
      match_score?: number | null;
      overall_status?: "strong" | "guarded" | "fragile" | null;
      score?: number | null;
      rubric_overall_score?: number | null;
      strongest_dimension?: string | null;
      weakest_dimension?: string | null;
      top_issue?: {
        message?: string | null;
        severity?: "high" | "medium" | "low" | null;
      } | null;
    }> | null;
  } | null;
}) {
  const { t } = useLanguage();
  const evaluations = safeArray(summary?.evaluations);

  return (
    <div className="rounded-[18px] border border-border/80 bg-white/90 px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("profile.healthPlanBenchmarkTitle")}</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{summary?.summary || t("profile.healthPlanBenchmarkDescription")}</p>
        </div>
        <Badge variant="outline" className={cn("rounded-full px-3 py-1 text-xs font-semibold", healthPlanBenchmarkTone(summary?.overall_status))}>
          {healthPlanBenchmarkLabel(t, summary?.overall_status)}
        </Badge>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Badge variant="secondary" className="rounded-full px-3 py-1">
          {interpolate(t("profile.healthPlanBenchmarkMatches"), { count: Number(summary?.matched_case_count || 0) })}
        </Badge>
        <Badge variant="secondary" className="rounded-full px-3 py-1">
          {interpolate(t("profile.healthPlanBenchmarkPlanScore"), { score: Number(summary?.average_score || 0) })}
        </Badge>
        <Badge variant="secondary" className="rounded-full px-3 py-1">
          {interpolate(t("profile.healthPlanBenchmarkRubricScore"), { score: Number(summary?.average_rubric_score || 0) })}
        </Badge>
      </div>
      {evaluations.length > 0 && (
        <div className="mt-4 grid gap-3 xl:grid-cols-2">
          {evaluations.slice(0, 4).map((item, index) => (
            <div key={item.case_id || `${item.case_label}-${index}`} className="rounded-2xl border border-border/70 bg-slate-50/70 px-3.5 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-foreground">{item.case_label || "-"}</p>
                <Badge variant="outline" className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", healthPlanBenchmarkTone(item.overall_status))}>
                  {healthPlanBenchmarkLabel(t, item.overall_status)}
                </Badge>
                <Badge variant="outline" className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold">
                  {interpolate(t("profile.healthPlanBenchmarkMatchScore"), { score: Number(item.match_score || 0) })}
                </Badge>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge variant="secondary" className="rounded-full px-2.5 py-0.5 text-[11px]">
                  {interpolate(t("profile.healthPlanBenchmarkCaseScore"), { score: Number(item.score || 0) })}
                </Badge>
                <Badge variant="secondary" className="rounded-full px-2.5 py-0.5 text-[11px]">
                  {interpolate(t("profile.healthPlanBenchmarkCaseRubric"), { score: Number(item.rubric_overall_score || 0) })}
                </Badge>
              </div>
              {(item.strongest_dimension || item.weakest_dimension) && (
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  {item.strongest_dimension ? `${t("profile.healthPlanBenchmarkStrongest")}: ${healthPlanBenchmarkDimensionLabel(item.strongest_dimension)}` : ""}
                  {item.strongest_dimension && item.weakest_dimension ? " · " : ""}
                  {item.weakest_dimension ? `${t("profile.healthPlanBenchmarkWeakest")}: ${healthPlanBenchmarkDimensionLabel(item.weakest_dimension)}` : ""}
                </p>
              )}
              {item.top_issue?.message && (
                <p className="mt-2 text-sm leading-6 text-foreground/80">{item.top_issue.message}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function HealthPlanHistoryReplayPanel({
  summary,
}: {
  summary?: {
    summary?: string | null;
    total_tracks?: number | null;
    improved_count?: number | null;
    regressed_count?: number | null;
    average_latest_score?: number | null;
    eligible_revision_count?: number | null;
    matched_scenarios?: Array<{
      scenario_id?: string | null;
      scenario_label?: string | null;
      snapshot_count?: number | null;
      max_match_score?: number | null;
    }> | null;
    release_gate?: {
      status?: "passed" | "failed" | null;
      passed?: boolean | null;
      blocking_reasons?: string[] | null;
      weak_tracks?: Array<{
        track_id?: string | null;
        track_label?: string | null;
        latest_status?: "strong" | "guarded" | "fragile" | null;
        latest_score?: number | null;
      }> | null;
      recommended_actions?: Array<{
        id?: string | null;
        label?: string | null;
        priority?: "high" | "medium" | "low" | null;
        action_text?: string | null;
      }> | null;
    } | null;
  } | null;
}) {
  const { t } = useLanguage();
  const matchedScenarios = safeArray(summary?.matched_scenarios);
  const weakTracks = safeArray(summary?.release_gate?.weak_tracks);
  const recommendedActions = safeArray(summary?.release_gate?.recommended_actions);
  const blockingReasons = safeArray(summary?.release_gate?.blocking_reasons);

  return (
    <div className="rounded-[18px] border border-border/80 bg-white/90 px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("profile.healthPlanReplayTitle")}</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{summary?.summary || t("profile.healthPlanReplayDescription")}</p>
        </div>
        <Badge variant="outline" className={cn("rounded-full px-3 py-1 text-xs font-semibold", healthPlanReplayGateTone(summary?.release_gate?.status))}>
          {healthPlanReplayGateLabel(t, summary?.release_gate?.status)}
        </Badge>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Badge variant="secondary" className="rounded-full px-3 py-1">
          {interpolate(t("profile.healthPlanReplayTracks"), { count: Number(summary?.total_tracks || 0) })}
        </Badge>
        <Badge variant="secondary" className="rounded-full px-3 py-1">
          {interpolate(t("profile.healthPlanReplayImproved"), { count: Number(summary?.improved_count || 0) })}
        </Badge>
        <Badge variant="secondary" className="rounded-full px-3 py-1">
          {interpolate(t("profile.healthPlanReplayRevisions"), { count: Number(summary?.eligible_revision_count || 0) })}
        </Badge>
        <Badge variant="secondary" className="rounded-full px-3 py-1">
          {interpolate(t("profile.healthPlanReplayAverageScore"), { score: Number(summary?.average_latest_score || 0) })}
        </Badge>
      </div>
      {matchedScenarios.length > 0 && (
        <div className="mt-4 grid gap-3 xl:grid-cols-2">
          {matchedScenarios.slice(0, 4).map((item, index) => (
            <div key={item.scenario_id || `${item.scenario_label}-${index}`} className="rounded-2xl border border-border/70 bg-slate-50/70 px-3.5 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-foreground">{item.scenario_label || "-"}</p>
                <Badge variant="outline" className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold">
                  {interpolate(t("profile.healthPlanReplayScenarioVersions"), { count: Number(item.snapshot_count || 0) })}
                </Badge>
              </div>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                {interpolate(t("profile.healthPlanReplayMatchScore"), { score: Number(item.max_match_score || 0) })}
              </p>
            </div>
          ))}
        </div>
      )}
      {blockingReasons.length > 0 && (
        <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50/80 px-3.5 py-3">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-rose-700">{t("profile.healthPlanReplayBlockingTitle")}</p>
          <div className="mt-2 space-y-2">
            {blockingReasons.slice(0, 3).map((reason, index) => (
              <p key={`${reason}-${index}`} className="text-sm leading-6 text-rose-900">{reason}</p>
            ))}
          </div>
        </div>
      )}
      {(weakTracks.length > 0 || recommendedActions.length > 0) && (
        <div className="mt-4 grid gap-3 xl:grid-cols-2">
          <div className="rounded-2xl border border-border/70 bg-slate-50/70 px-3.5 py-3">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">{t("profile.healthPlanReplayWeakTracksTitle")}</p>
            {weakTracks.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">{t("profile.healthPlanReplayEmptyWeakTracks")}</p>
            ) : (
              <div className="mt-3 space-y-3">
                {weakTracks.slice(0, 3).map((item, index) => (
                  <div key={item.track_id || `${item.track_label}-${index}`} className="rounded-2xl border border-white/80 bg-white/90 px-3 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-foreground">{item.track_label || "-"}</p>
                      <Badge variant="outline" className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", healthPlanBenchmarkTone(item.latest_status))}>
                        {healthPlanBenchmarkLabel(t, item.latest_status)}
                      </Badge>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">
                      {interpolate(t("profile.healthPlanReplayAverageScore"), { score: Number(item.latest_score || 0) })}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="rounded-2xl border border-border/70 bg-slate-50/70 px-3.5 py-3">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">{t("profile.healthPlanReplayRecommendedTitle")}</p>
            {recommendedActions.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">{t("profile.healthPlanReplayEmptyRecommended")}</p>
            ) : (
              <div className="mt-3 space-y-3">
                {recommendedActions.slice(0, 4).map((item, index) => (
                  <div key={item.id || `${item.label}-${index}`} className="rounded-2xl border border-white/80 bg-white/90 px-3 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-foreground">{item.label || "-"}</p>
                      {item.priority && (
                        <Badge variant="outline" className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", healthPlanGapSeverityClasses(item.priority))}>
                          {healthPlanGapSeverityLabel(t, item.priority)}
                        </Badge>
                      )}
                    </div>
                    {item.action_text && <p className="mt-2 text-sm leading-6 text-foreground/80">{item.action_text}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function HealthPlanPreGenerationChecklist({
  summary,
  onActionSelect,
  canGenerate = false,
  generating = false,
  hasPlan = false,
  onGenerate,
  onGenerateCautious,
}: {
  summary?: {
    overall_status?: "ready" | "guarded" | "blocked" | null;
    summary?: string | null;
    blocker_count?: number | null;
    caution_count?: number | null;
    blocking_reasons?: Array<{
      id?: string | null;
      label?: string | null;
      detail?: string | null;
      severity?: "high" | "medium" | "low" | null;
    }> | null;
    caution_reasons?: Array<{
      id?: string | null;
      label?: string | null;
      detail?: string | null;
      severity?: "high" | "medium" | "low" | null;
    }> | null;
    collection_actions?: HealthPlanReadinessAction[] | null;
  } | null;
  onActionSelect?: (action: HealthPlanReadinessAction) => void;
  canGenerate?: boolean;
  generating?: boolean;
  hasPlan?: boolean;
  onGenerate?: () => void;
  onGenerateCautious?: () => void;
}) {
  const { t } = useLanguage();
  const status = summary?.overall_status || "blocked";
  const blockers = safeArray(summary?.blocking_reasons);
  const cautions = safeArray(summary?.caution_reasons);
  const actions = safeArray(summary?.collection_actions);
  const checklistItems = [
    ...blockers.map((item) => ({
      id: item?.id || item?.label || item?.detail,
      title: item?.label,
      detail: item?.detail,
      tone: item?.severity || "high",
      action: actions.find((action) => action?.id === item?.id || action?.label === item?.label) || null,
    })),
    ...actions.map((item) => ({
      id: item?.id || item?.label || item?.action,
      title: item?.label,
      detail: item?.action,
      tone: item?.priority || "medium",
      action: item,
    })),
    ...cautions.map((item) => ({
      id: item?.id || item?.label || item?.detail,
      title: item?.label,
      detail: item?.detail,
      tone: item?.severity || "medium",
      action: null,
    })),
  ]
    .filter((item) => item.title || item.detail)
    .filter((item, index, list) => list.findIndex((candidate) => (candidate.id || candidate.title) === (item.id || item.title)) === index)
    .slice(0, 3);
  const statusCopy =
    status === "ready"
      ? t("profile.healthPlanPreflightReady")
      : status === "guarded"
        ? t("profile.healthPlanPreflightGuarded")
        : t("profile.healthPlanPreflightBlocked");
  const statusDescription =
    status === "ready"
      ? t("profile.healthPlanPreflightReadyDescription")
      : status === "guarded"
        ? t("profile.healthPlanPreflightGuardedDescription")
        : t("profile.healthPlanPreflightBlockedDescription");

  return (
    <div className="rounded-[22px] border border-border/80 bg-white px-5 py-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <div className={cn(
              "flex h-9 w-9 items-center justify-center rounded-full",
              status === "ready" ? "bg-emerald-50 text-emerald-600" : status === "guarded" ? "bg-amber-50 text-amber-600" : "bg-rose-50 text-rose-600",
            )}>
              {status === "ready" ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
            </div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("profile.healthPlanPreflightTitle")}</p>
            <Badge variant="outline" className={cn("rounded-full px-3 py-1 text-xs font-bold", healthPlanReadinessTone(status))}>
              {statusCopy}
            </Badge>
          </div>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
            {summary?.summary || statusDescription}
          </p>
        </div>
        <div className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 lg:w-auto lg:min-w-64">
          <p className="text-sm font-semibold text-foreground">
            {status === "ready"
              ? t("profile.healthPlanPreflightCanGenerate")
              : interpolate(t("profile.healthPlanPreflightMissingCount"), { count: checklistItems.length || Number(summary?.blocker_count || summary?.caution_count || 0) })}
          </p>
          <div className="mt-3 flex flex-col gap-2">
            <Button
              type="button"
              className="rounded-full px-4 font-bold"
              disabled={!canGenerate || generating}
              onClick={onGenerate}
            >
              <Brain className={cn("mr-2 h-4 w-4", generating && "animate-spin")} />
              {canGenerate
                ? hasPlan ? t("profile.healthPlanRegenerate") : t("profile.healthPlanGenerate")
                : t("profile.healthPlanAdminRequired")}
            </Button>
            {status !== "ready" && canGenerate && onGenerateCautious && (
              <Button
                type="button"
                variant="outline"
                className="rounded-full px-4 font-bold"
                disabled={generating}
                onClick={onGenerateCautious}
              >
                {generating ? t("profile.healthPlanGeneratingCautiousDraft") : t("profile.healthPlanGenerateCautiousDraft")}
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        {checklistItems.length > 0 ? (
          checklistItems.map((item, index) => {
            const target = healthPlanReadinessActionTarget(item.action);
            return (
              <div key={`${item.id || item.title || index}-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", healthPlanGapSeverityClasses(item.tone))}>
                    {healthPlanGapSeverityLabel(t, item.tone)}
                  </Badge>
                  <p className="text-sm font-bold text-foreground">{item.title || t("profile.healthPlanReadinessReasonFallback")}</p>
                </div>
                {item.detail && <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.detail}</p>}
                {target && item.action && onActionSelect && (
                  <Button
                    type="button"
                    variant="link"
                    className="mt-2 h-auto p-0 text-xs font-bold text-primary"
                    onClick={() => onActionSelect(item.action!)}
                  >
                    {t("profile.healthPlanPreflightOpenSection")}
                  </Button>
                )}
              </div>
            );
          })
        ) : (
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 lg:col-span-3">
            <p className="text-sm font-bold text-emerald-900">{t("profile.healthPlanPreflightNoMissingTitle")}</p>
            <p className="mt-1 text-sm leading-6 text-emerald-800">{t("profile.healthPlanPreflightNoMissingDescription")}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function healthPlanConfidenceBand(score: number): "high" | "medium" | "low" {
  if (score >= 80) return "high";
  if (score >= 50) return "medium";
  return "low";
}

function healthPlanConfidenceBandLabel(t: (key: string) => string, band: "high" | "medium" | "low") {
  if (band === "high") return t("profile.healthPlanConfidenceHigh");
  if (band === "medium") return t("profile.healthPlanConfidenceMedium");
  return t("profile.healthPlanConfidenceLow");
}

function healthPlanConfidenceBandClasses(band: "high" | "medium" | "low") {
  if (band === "high") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (band === "medium") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-rose-200 bg-rose-50 text-rose-700";
}

function isRecentSensorReading(value?: string | null) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return Date.now() - date.getTime() <= 24 * 60 * 60 * 1000;
}

function HealthPlanConditionSensorConfidencePanel({
  healthConditions,
  mobilityNeeds,
  medications,
  medicationActivity,
  checkins,
  brainCoach,
  sensors,
  careProviders,
  livingContextKnown,
  sourceSignalCount,
  activeAlertCount,
}: {
  healthConditions: string[];
  mobilityNeeds: string[];
  medications: OperationalMedication[];
  medicationActivity?: OperationalMedicationActivity | null;
  checkins?: OperationalService | null;
  brainCoach?: OperationalService | null;
  sensors: OperationalSensor[];
  careProviders: OperationalCareProviderAssignment[];
  livingContextKnown: boolean;
  sourceSignalCount: number;
  activeAlertCount: number;
}) {
  const { t } = useLanguage();
  const conditionNames = [...healthConditions, ...mobilityNeeds.map((item) => `${item}`)].filter(Boolean);
  const medicationTimesComplete = medications.length > 0 && medications.every((medication) => safeArray(medication.schedule_times).length > 0);
  const recentSensorCount = sensors.filter((sensor) => sensor.status === "online" && isRecentSensorReading(sensor.last_reading_at)).length;
  const activeSensorCount = sensors.filter((sensor) => sensor.status === "online").length;
  const signalContributions = [
    { key: "profile", active: livingContextKnown, points: 10, label: t("profile.healthPlanConfidenceSignalProfile") },
    { key: "conditions", active: conditionNames.length > 0, points: 15, label: t("profile.healthPlanConfidenceSignalConditions") },
    { key: "medications", active: medicationTimesComplete, points: 15, label: t("profile.healthPlanConfidenceSignalMedications") },
    { key: "medicationActivity", active: Boolean(medicationActivity?.status), points: 10, label: t("profile.healthPlanConfidenceSignalAdherence") },
    { key: "checkins", active: Boolean(checkins?.enabled && (checkins.last_outcome || checkins.last_reported_at || checkins.preferred_time)), points: 10, label: t("profile.healthPlanConfidenceSignalCheckins") },
    { key: "brain", active: Boolean(brainCoach?.enabled && (brainCoach.last_outcome || brainCoach.last_reported_at || brainCoach.preferred_time)), points: 5, label: t("profile.healthPlanConfidenceSignalBrain") },
    { key: "care", active: careProviders.length > 0, points: 10, label: t("profile.healthPlanConfidenceSignalCare") },
    { key: "sensors", active: recentSensorCount > 0, points: 10, label: t("profile.healthPlanConfidenceSignalSensors") },
    { key: "alerts", active: activeAlertCount > 0, points: 5, label: t("profile.healthPlanConfidenceSignalAlerts") },
    { key: "sources", active: sourceSignalCount > 0, points: 10, label: t("profile.healthPlanConfidenceSignalSources") },
  ];
  const overallScore = Math.min(100, 10 + signalContributions.reduce((total, item) => total + (item.active ? item.points : 0), 0));
  const overallBand = healthPlanConfidenceBand(overallScore);
  const conditionBase = 30
    + (livingContextKnown ? 10 : 0)
    + (medicationTimesComplete ? 15 : medications.length > 0 ? 8 : 0)
    + (Boolean(medicationActivity?.status) ? 10 : 0)
    + (careProviders.length > 0 ? 10 : 0)
    + (recentSensorCount > 0 ? 10 : activeSensorCount > 0 ? 5 : 0)
    + (sourceSignalCount > 0 ? 10 : 0);
  const conditionItems = conditionNames.slice(0, 4).map((condition) => {
    const score = Math.max(15, Math.min(95, conditionBase + (/fall|mobility|walking|balance|sturz|caida/i.test(condition) && recentSensorCount > 0 ? 5 : 0)));
    const band = healthPlanConfidenceBand(score);
    return { condition, score, band };
  });
  const sensorItems = sensors.slice(0, 4).map((sensor) => {
    const recent = isRecentSensorReading(sensor.last_reading_at);
    const online = sensor.status === "online";
    const contribution = online && recent ? 12 : online ? 6 : 0;
    const band = online && recent ? "high" : online ? "medium" : "low";
    return { sensor, recent, online, contribution, band: band as "high" | "medium" | "low" };
  });

  return (
    <div className="rounded-[22px] border border-border/80 bg-white px-5 py-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <HeartPulse className="h-5 w-5 text-vyva-pink" />
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("profile.healthPlanConditionConfidenceTitle")}</p>
            <Badge variant="outline" className={cn("rounded-full px-3 py-1 text-xs font-bold", healthPlanConfidenceBandClasses(overallBand))}>
              {healthPlanConfidenceBandLabel(t, overallBand)}
            </Badge>
          </div>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">{t("profile.healthPlanConditionConfidenceDescription")}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-3xl font-black leading-none tracking-normal text-foreground">{overallScore}</p>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{t("profile.healthPlanConditionConfidenceScore")}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-4">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">{t("profile.healthPlanConditionConfidenceConditions")}</p>
          {conditionItems.length > 0 ? (
            <div className="mt-3 space-y-3">
              {conditionItems.map((item) => (
                <div key={item.condition} className="rounded-2xl border border-white/80 bg-white px-3.5 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-bold text-foreground">{item.condition}</p>
                    <Badge variant="outline" className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", healthPlanConfidenceBandClasses(item.band))}>
                      {healthPlanConfidenceBandLabel(t, item.band)}
                    </Badge>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    {interpolate(t("profile.healthPlanConditionConfidenceConditionScore"), { score: item.score })}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm leading-6 text-muted-foreground">{t("profile.healthPlanConditionConfidenceNoConditions")}</p>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-4">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">{t("profile.healthPlanConditionConfidenceSensors")}</p>
          {sensorItems.length > 0 ? (
            <div className="mt-3 space-y-3">
              {sensorItems.map((item) => (
                <div key={item.sensor.id || item.sensor.device_id || item.sensor.device_name} className="rounded-2xl border border-white/80 bg-white px-3.5 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-bold text-foreground">{item.sensor.device_name || item.sensor.device_id || t(sensorTypeKey(item.sensor.sensor_type))}</p>
                    <Badge variant="outline" className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", healthPlanConfidenceBandClasses(item.band))}>
                      {item.online ? item.recent ? t("profile.healthPlanConditionConfidenceSensorRecent") : t("profile.healthPlanConditionConfidenceSensorStale") : t("profile.healthPlanConditionConfidenceSensorOffline")}
                    </Badge>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    {interpolate(t("profile.healthPlanConditionConfidenceSensorContribution"), { points: item.contribution })}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm leading-6 text-muted-foreground">{t("profile.healthPlanConditionConfidenceNoSensors")}</p>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {signalContributions.map((item) => (
          <Badge
            key={item.key}
            variant="outline"
            className={cn("rounded-full px-3 py-1 text-xs font-semibold", item.active ? "border-emerald-200 text-emerald-700" : "border-slate-200 text-muted-foreground")}
          >
            {item.label}: {item.active ? `+${item.points}` : "+0"}
          </Badge>
        ))}
      </div>
    </div>
  );
}

function HealthPlanReadinessPanel({
  summary,
  voiceContext,
  onActionSelect,
}: {
  summary?: {
    overall_status?: "ready" | "guarded" | "blocked" | null;
    summary?: string | null;
    blocker_count?: number | null;
    caution_count?: number | null;
    high_gap_count?: number | null;
    low_confidence_section_count?: number | null;
    live_pressure_count?: number | null;
    blocking_reasons?: Array<{
      id?: string | null;
      label?: string | null;
      detail?: string | null;
      severity?: "high" | "medium" | "low" | null;
    }> | null;
    caution_reasons?: Array<{
      id?: string | null;
      label?: string | null;
      detail?: string | null;
      severity?: "high" | "medium" | "low" | null;
    }> | null;
    collection_actions?: HealthPlanReadinessAction[] | null;
  } | null;
  voiceContext?: {
    clientName?: string | null;
    language?: string | null;
    livingContext?: string | null;
    medicationCount?: number | null;
    careProviderCount?: number | null;
    sensorCount?: number | null;
    activeAlertCount?: number | null;
  };
  onActionSelect?: (action: HealthPlanReadinessAction) => void;
}) {
  const { t } = useLanguage();
  const [speaking, setSpeaking] = useState(false);
  const blockers = safeArray(summary?.blocking_reasons);
  const cautions = safeArray(summary?.caution_reasons);
  const actions = safeArray(summary?.collection_actions);
  const status = summary?.overall_status || "blocked";
  const blockerCount = Number(summary?.blocker_count || blockers.length || 0);
  const cautionCount = Number(summary?.caution_count || cautions.length || 0);
  const livePressureCount = Number(summary?.live_pressure_count || 0);
  const highGapCount = Number(summary?.high_gap_count || 0);
  const lowConfidenceCount = Number(summary?.low_confidence_section_count || 0);
  const readinessScore = Math.max(
    8,
    Math.min(
      96,
      status === "ready"
        ? 92 - Math.min(cautionCount, 2) * 4
        : status === "guarded"
          ? 74 - Math.min(cautionCount, 5) * 6 - Math.min(highGapCount, 2) * 7
          : 42 - Math.min(blockerCount, 4) * 7 - Math.min(highGapCount, 3) * 5,
    ),
  );
  const reasons = [...blockers, ...cautions].slice(0, 4);
  const primaryAction = actions[0];
  const profileCues = [
    voiceContext?.clientName ? interpolate(t("profile.healthPlanArenaCueClient"), { name: voiceContext.clientName }) : null,
    voiceContext?.livingContext ? interpolate(t("profile.healthPlanArenaCueLiving"), { value: voiceContext.livingContext }) : null,
    typeof voiceContext?.medicationCount === "number" ? interpolate(t("profile.healthPlanArenaCueMedications"), { count: voiceContext.medicationCount }) : null,
    typeof voiceContext?.careProviderCount === "number"
      ? voiceContext.careProviderCount > 0
        ? interpolate(t("profile.healthPlanArenaCueCareCoverage"), { count: voiceContext.careProviderCount })
        : t("profile.healthPlanArenaCueNoCareCoverage")
      : null,
    typeof voiceContext?.sensorCount === "number" && voiceContext.sensorCount > 0 ? interpolate(t("profile.healthPlanArenaCueSensors"), { count: voiceContext.sensorCount }) : null,
    typeof voiceContext?.activeAlertCount === "number" && voiceContext.activeAlertCount > 0 ? interpolate(t("profile.healthPlanArenaCueAlerts"), { count: voiceContext.activeAlertCount }) : null,
  ].filter(Boolean);
  const baseVoiceScript = interpolate(
    status === "ready"
      ? t("profile.healthPlanArenaVoiceReady")
      : status === "guarded"
        ? t("profile.healthPlanArenaVoiceGuarded")
        : t("profile.healthPlanArenaVoiceBlocked"),
    {
      score: readinessScore,
      blockers: blockerCount,
      cautions: cautionCount,
      action: primaryAction?.action || primaryAction?.label || t("profile.healthPlanReadinessActionFallback"),
    },
  );
  const voiceScript = [
    profileCues.length > 0 ? interpolate(t("profile.healthPlanArenaVoiceProfileCue"), { cues: profileCues.slice(0, 4).join(", ") }) : null,
    baseVoiceScript,
  ].filter(Boolean).join(" ");
  const playVoiceGuide = () => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(voiceScript);
    utterance.lang = speechLanguageCode(voiceContext?.language);
    utterance.rate = 0.95;
    utterance.pitch = 1;
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.cancel();
    setSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };
  const lanes = [
    {
      label: t("profile.healthPlanArenaEvidence"),
      value: highGapCount > 0 ? interpolate(t("profile.healthPlanArenaHighGaps"), { count: highGapCount }) : t("profile.healthPlanArenaNoHighGaps"),
      tone: highGapCount > 0 ? "border-amber-300/70 bg-amber-50 text-amber-900" : "border-emerald-300/70 bg-emerald-50 text-emerald-900",
      icon: ShieldCheck,
    },
    {
      label: t("profile.healthPlanArenaPressure"),
      value: livePressureCount > 0 ? interpolate(t("profile.healthPlanArenaPressureCount"), { count: livePressureCount }) : t("profile.healthPlanArenaStablePressure"),
      tone: livePressureCount > 0 ? "border-rose-300/70 bg-rose-50 text-rose-900" : "border-sky-300/70 bg-sky-50 text-sky-900",
      icon: Activity,
    },
    {
      label: t("profile.healthPlanArenaConfidence"),
      value: lowConfidenceCount > 0 ? interpolate(t("profile.healthPlanArenaLowConfidence"), { count: lowConfidenceCount }) : t("profile.healthPlanArenaConfidenceGood"),
      tone: lowConfidenceCount > 0 ? "border-orange-300/70 bg-orange-50 text-orange-900" : "border-cyan-300/70 bg-cyan-50 text-cyan-900",
      icon: Target,
    },
  ];
  const primaryActionTarget = healthPlanReadinessActionTarget(primaryAction);
  const primaryActionText =
    primaryAction?.action ||
    primaryAction?.label ||
    (status === "ready" ? t("profile.healthPlanGenerate") : t("profile.healthPlanReadinessActionFallback"));
  const actionButtonLabel = primaryActionTarget ? t("profile.healthPlanArenaOpenAction") : t("profile.healthPlanArenaReviewAction");

  return (
    <div className="overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-sm">
      <div className="grid gap-5 p-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("profile.healthPlanArenaTitle")}</p>
                <Badge variant="outline" className={cn("rounded-full px-3 py-1 text-xs font-bold", healthPlanReadinessTone(status))}>
                  {healthPlanReadinessLabel(t, status)}
                </Badge>
              </div>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
                {summary?.summary || t("profile.healthPlanReadinessDescription")}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div>
                <p className="text-3xl font-black leading-none tracking-normal text-foreground">{readinessScore}</p>
                <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{t("profile.healthPlanArenaScore")}</p>
              </div>
              <div className="h-12 w-24">
                <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      status === "ready" ? "bg-emerald-500" : status === "guarded" ? "bg-amber-500" : "bg-rose-500",
                    )}
                    style={{ width: `${readinessScore}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            {lanes.map((lane) => {
              const Icon = lane.icon;
              return (
                <div key={lane.label} className={cn("rounded-2xl border px-4 py-3", lane.tone)}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] opacity-75">{lane.label}</p>
                    <Icon className="h-4 w-4" />
                  </div>
                  <p className="mt-2 text-sm font-bold leading-5">{lane.value}</p>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 gap-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <Volume2 className="h-4 w-4 text-primary" />
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">{t("profile.healthPlanArenaVoiceGuide")}</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="h-8 rounded-full px-3 text-xs font-bold"
                  onClick={playVoiceGuide}
                >
                  {speaking ? t("profile.healthPlanArenaStopVoice") : t("profile.healthPlanArenaPlayVoice")}
                </Button>
              </div>
              <p className="mt-3 text-sm leading-6 text-foreground/80">{voiceScript}</p>
            </div>

            <div className="rounded-2xl border border-primary/15 bg-primary/5 px-4 py-4">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">{t("profile.healthPlanArenaNextMove")}</p>
              <p className="mt-2 text-sm font-semibold leading-6 text-foreground">{primaryActionText}</p>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">{t("profile.healthPlanArenaActionHelp")}</p>
              {primaryAction && onActionSelect && (
                <Button
                  type="button"
                  className="mt-3 h-9 rounded-full px-3 text-xs font-bold shadow-sm"
                  onClick={() => onActionSelect(primaryAction)}
                  variant={primaryActionTarget ? "default" : "outline"}
                >
                  <Target className="mr-2 h-3.5 w-3.5" />
                  {actionButtonLabel}
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">{t("profile.healthPlanArenaDataLineup")}</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Badge variant="outline" className="justify-center rounded-full bg-white px-3 py-1 text-xs font-semibold">
              {interpolate(t("profile.healthPlanReadinessBlockers"), { count: blockerCount })}
            </Badge>
            <Badge variant="outline" className="justify-center rounded-full bg-white px-3 py-1 text-xs font-semibold">
              {interpolate(t("profile.healthPlanReadinessCautions"), { count: cautionCount })}
            </Badge>
          </div>

          {reasons.length > 0 ? (
            <div className="mt-4 space-y-2.5">
              {reasons.map((reason, index) => (
                <div key={reason.id || index} className="rounded-xl border border-white bg-white px-3 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-bold text-foreground">{reason.label || t("profile.healthPlanReadinessReasonFallback")}</p>
                    <Badge variant="outline" className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", healthPlanGapSeverityClasses(reason.severity))}>
                      {healthPlanGapSeverityLabel(t, reason.severity)}
                    </Badge>
                  </div>
                  {reason.detail && <p className="mt-2 text-xs leading-5 text-muted-foreground">{reason.detail}</p>}
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm leading-6 text-muted-foreground">{t("profile.healthPlanArenaNoReviewIssues")}</p>
          )}
        </div>
      </div>

      {actions.length > 0 && (
        <div className="border-t border-slate-200 bg-slate-50/75 p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">{t("profile.healthPlanReadinessCollectNext")}</p>
            <p className="text-sm text-muted-foreground">{t("profile.healthPlanArenaActionListHelp")}</p>
          </div>
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            {actions.slice(0, 4).map((action, index) => {
              const actionTarget = healthPlanReadinessActionTarget(action);
              const canOpenAction = Boolean(actionTarget && onActionSelect);
              const actionContent = (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-bold text-foreground">{action.label || t("profile.healthPlanReadinessActionFallback")}</p>
                    <Badge variant="outline" className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", healthPlanImprovePriorityClasses(action.priority))}>
                      {healthPlanImprovePriorityLabel(t, action.priority)}
                    </Badge>
                    {canOpenAction && (
                      <span className="ml-auto rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-primary">
                        {t("profile.healthPlanArenaOpenAction")}
                      </span>
                    )}
                  </div>
                  {action.action && <p className="mt-2 text-sm leading-6 text-muted-foreground">{action.action}</p>}
                </>
              );

              if (canOpenAction) {
                return (
                  <button
                    key={action.id || index}
                    type="button"
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left shadow-sm transition hover:border-primary/30 hover:bg-primary/5 focus:outline-none focus:ring-2 focus:ring-primary/25"
                    onClick={() => onActionSelect(action)}
                  >
                    {actionContent}
                  </button>
                );
              }

              return (
                <div key={action.id || index} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                  {actionContent}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function HealthPlanGenerationBlockersPanel({
  acceptance,
}: {
  acceptance?: HealthPlanGenerationDiagnosticsState["acceptance"];
}) {
  const { t } = useLanguage();
  const blockers = safeArray(acceptance?.blocking_items);
  const cautions = safeArray(acceptance?.caution_items);
  const items = [...blockers, ...cautions];

  if (!acceptance || items.length === 0) return null;

  return (
    <div className="rounded-[18px] border border-rose-200 bg-rose-50/80 px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-rose-700">{t("profile.healthPlanGenerationBlockedTitle")}</p>
          <p className="mt-1 text-sm leading-6 text-rose-950/85">
            {acceptance.summary || t("profile.healthPlanGenerationBlockedDescription")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="rounded-full border-rose-200 bg-white/90 px-3 py-1 text-xs font-semibold text-rose-700">
            {interpolate(t("profile.healthPlanReadinessBlockers"), { count: Number(acceptance.blocker_count || 0) })}
          </Badge>
          <Badge variant="outline" className="rounded-full border-amber-200 bg-white/90 px-3 py-1 text-xs font-semibold text-amber-700">
            {interpolate(t("profile.healthPlanReadinessCautions"), { count: Number(acceptance.caution_count || 0) })}
          </Badge>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {acceptance.operational_completeness?.overall_status && (
          <Badge variant="outline" className={cn("rounded-full px-3 py-1 text-xs font-semibold", healthPlanOperationalCompletenessTone(acceptance.operational_completeness.overall_status))}>
            {t("profile.healthPlanOperationalCompletenessTitle")}: {healthPlanOperationalCompletenessLabel(t, acceptance.operational_completeness.overall_status)}
          </Badge>
        )}
        {acceptance.recommendation_grounding?.overall_status && (
          <Badge variant="outline" className={cn("rounded-full px-3 py-1 text-xs font-semibold", healthPlanGroundingTone(acceptance.recommendation_grounding.overall_status))}>
            {t("profile.healthPlanGroundingTitle")}: {healthPlanGroundingLabel(t, acceptance.recommendation_grounding.overall_status)}
          </Badge>
        )}
        {acceptance.recommendation_coverage?.overall_status && (
          <Badge variant="outline" className={cn("rounded-full px-3 py-1 text-xs font-semibold", healthPlanCoverageTone(acceptance.recommendation_coverage.overall_status))}>
            {t("profile.healthPlanCoverageTitle")}: {healthPlanCoverageLabel(t, acceptance.recommendation_coverage.overall_status)}
          </Badge>
        )}
        {acceptance.generation_quality?.overall_status && (
          <Badge variant="outline" className={cn("rounded-full px-3 py-1 text-xs font-semibold", healthPlanGenerationStatusTone(acceptance.generation_quality.overall_status))}>
            {t("profile.healthPlanGenerationQualityTitle")}: {healthPlanGenerationStatusLabel(t, acceptance.generation_quality.overall_status)}
          </Badge>
        )}
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-2">
        {items.slice(0, 4).map((item, index) => (
          <div key={`${item.type || "issue"}-${item.section_key || "plan"}-${index}`} className="rounded-2xl border border-white/90 bg-white/95 px-3.5 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-foreground">
                {item.section_key ? healthPlanHistorySectionLabel(t, item.section_key) : t("profile.healthPlanGenerationBlockedFallback")}
              </p>
              <Badge variant="outline" className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", healthPlanGapSeverityClasses(item.severity))}>
                {healthPlanGapSeverityLabel(t, item.severity)}
              </Badge>
            </div>
            {item.message && <p className="mt-2 text-sm leading-6 text-foreground/85">{item.message}</p>}
            {item.detail && <p className="mt-2 text-xs leading-5 text-muted-foreground">{item.detail}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

function HealthPlanReviewReadinessPanel({
  summary,
  compact = false,
}: {
  summary?: {
    overall_status?: "ready" | "guarded" | "blocked" | null;
    summary?: string | null;
    can_mark_reviewed?: boolean | null;
    blocker_count?: number | null;
    caution_count?: number | null;
    blocking_items?: Array<{
      type?: string | null;
      label?: string | null;
      detail?: string | null;
    }> | null;
    caution_items?: Array<{
      type?: string | null;
      label?: string | null;
      detail?: string | null;
    }> | null;
  } | null;
  compact?: boolean;
}) {
  const { t } = useLanguage();
  const blockers = safeArray(summary?.blocking_items);
  const cautions = safeArray(summary?.caution_items);
  const items = [...blockers, ...cautions];

  return (
    <div className="rounded-[18px] border border-border/80 bg-white/90 px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("profile.healthPlanReviewReadinessTitle")}</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{summary?.summary || t("profile.healthPlanReviewReadinessDescription")}</p>
        </div>
        <Badge variant="outline" className={cn("rounded-full px-3 py-1 text-xs font-semibold", healthPlanReviewReadinessTone(summary?.overall_status))}>
          {healthPlanReviewReadinessLabel(t, summary?.overall_status)}
        </Badge>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Badge variant="secondary" className="rounded-full px-3 py-1">
          {interpolate(t("profile.healthPlanReviewReadinessBlockers"), { count: Number(summary?.blocker_count || 0) })}
        </Badge>
        <Badge variant="secondary" className="rounded-full px-3 py-1">
          {interpolate(t("profile.healthPlanReviewReadinessCautions"), { count: Number(summary?.caution_count || 0) })}
        </Badge>
      </div>
      {items.length > 0 && (
        <div className={cn("mt-4 grid gap-3", compact ? "grid-cols-1" : "xl:grid-cols-2")}>
          {items.slice(0, compact ? 3 : 4).map((item, index) => (
            <div key={`${item.type || "item"}-${index}`} className="rounded-2xl border border-border/70 bg-slate-50/70 px-3.5 py-3">
              <p className="text-sm font-semibold text-foreground">{item.label || t("profile.healthPlanReviewReadinessItemFallback")}</p>
              {item.detail && <p className="mt-2 text-sm leading-6 text-foreground/80">{item.detail}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function HealthPlanRecommendationCalibrationPanel({
  summary,
}: {
  summary?: {
    overall_status?: "clean" | "adjusted" | null;
    summary?: string | null;
    adjustment_count?: number | null;
    confidence_downgrade_count?: number | null;
    verification_added_count?: number | null;
    high_pressure_adjustment_count?: number | null;
    items?: Array<{
      item_id?: string | null;
      section_key?: string | null;
      text?: string | null;
      requested_confidence?: "high" | "medium" | "low" | null;
      applied_confidence?: "high" | "medium" | "low" | null;
      verification_added?: boolean | null;
      high_pressure?: boolean | null;
      reason?: string | null;
    }> | null;
  } | null;
}) {
  const { t } = useLanguage();
  const items = safeArray(summary?.items);

  return (
    <div className="rounded-[18px] border border-border/80 bg-white/90 px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("profile.healthPlanCalibrationTitle")}</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{summary?.summary || t("profile.healthPlanCalibrationDescription")}</p>
        </div>
        <Badge variant="outline" className={cn("rounded-full px-3 py-1 text-xs font-semibold", healthPlanCalibrationTone(summary?.overall_status))}>
          {healthPlanCalibrationLabel(t, summary?.overall_status)}
        </Badge>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Badge variant="secondary" className="rounded-full px-3 py-1">
          {interpolate(t("profile.healthPlanCalibrationAdjustedCount"), { count: Number(summary?.adjustment_count || 0) })}
        </Badge>
        <Badge variant="secondary" className="rounded-full px-3 py-1">
          {interpolate(t("profile.healthPlanCalibrationConfidenceCount"), { count: Number(summary?.confidence_downgrade_count || 0) })}
        </Badge>
        <Badge variant="secondary" className="rounded-full px-3 py-1">
          {interpolate(t("profile.healthPlanCalibrationVerificationCount"), { count: Number(summary?.verification_added_count || 0) })}
        </Badge>
        <Badge variant="secondary" className="rounded-full px-3 py-1">
          {interpolate(t("profile.healthPlanCalibrationHighPressureCount"), { count: Number(summary?.high_pressure_adjustment_count || 0) })}
        </Badge>
      </div>
      {items.length > 0 && (
        <div className="mt-4 grid gap-3 xl:grid-cols-2">
          {items.slice(0, 4).map((item, index) => (
            <div key={item.item_id || `${item.section_key}-${index}`} className="rounded-2xl border border-border/70 bg-slate-50/70 px-3.5 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-foreground">{item.text || "-"}</p>
                {item.high_pressure && (
                  <Badge variant="outline" className="rounded-full border-rose-200 bg-rose-50 px-2.5 py-0.5 text-[11px] font-semibold text-rose-700">
                    {t("profile.healthPlanRecommendationHigh")}
                  </Badge>
                )}
                {item.verification_added && (
                  <Badge variant="outline" className="rounded-full border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700">
                    {t("profile.healthPlanCalibrationVerificationAdded")}
                  </Badge>
                )}
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {item.section_key && (
                  <Badge variant="outline" className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold">
                    {healthPlanHistorySectionLabel(t, item.section_key)}
                  </Badge>
                )}
                <Badge variant="outline" className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold">
                  {healthPlanRecommendationConfidenceLabel(t, item.requested_confidence)}
                  {" -> "}
                  {healthPlanRecommendationConfidenceLabel(t, item.applied_confidence)}
                </Badge>
              </div>
              {item.reason && <p className="mt-2 text-sm leading-6 text-foreground/80">{item.reason}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function healthPlanTrustDimensionLabel(t: (key: string) => string, dimension?: string | null) {
  if (dimension === "generation_quality") return t("profile.healthPlanGenerationQualityTitle");
  if (dimension === "operational_completeness") return t("profile.healthPlanOperationalCompletenessTitle");
  if (dimension === "recommendation_grounding") return t("profile.healthPlanGroundingTitle");
  if (dimension === "recommendation_calibration") return t("profile.healthPlanCalibrationTitle");
  if (dimension === "recommendation_coverage") return t("profile.healthPlanCoverageTitle");
  if (dimension === "benchmark_assessment") return t("profile.healthPlanBenchmarkTitle");
  if (dimension === "recommendation_challenges") return t("profile.healthPlanChallengeTitle");
  if (dimension === "generation_brief_compliance") return t("profile.healthPlanTrustBriefDimension");
  return t("profile.healthPlanTrustDimensionFallback");
}

function HealthPlanTrustVerdictPanel({
  summary,
}: {
  summary?: {
    overall_status?: "trusted" | "guarded" | "fragile" | null;
    trust_score?: number | null;
    summary?: string | null;
    can_trust_for_staff_use?: boolean | null;
    blocker_count?: number | null;
    caution_count?: number | null;
    blocking_items?: Array<{
      type?: string | null;
      label?: string | null;
      detail?: string | null;
      severity?: "high" | "medium" | "low" | null;
      section_keys?: string[] | null;
    }> | null;
    caution_items?: Array<{
      type?: string | null;
      label?: string | null;
      detail?: string | null;
      severity?: "high" | "medium" | "low" | null;
      section_keys?: string[] | null;
    }> | null;
    next_actions?: string[] | null;
    dimensions?: Array<{
      name?: string | null;
      overall_status?: "trusted" | "guarded" | "fragile" | null;
      summary?: string | null;
    }> | null;
  } | null;
}) {
  const { t } = useLanguage();
  const blockers = safeArray(summary?.blocking_items);
  const cautions = safeArray(summary?.caution_items);
  const actions = safeArray(summary?.next_actions);
  const dimensions = safeArray(summary?.dimensions);
  const items = [...blockers, ...cautions];

  return (
    <div className="rounded-[20px] border border-border/80 bg-white/95 px-4 py-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("profile.healthPlanTrustTitle")}</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{summary?.summary || t("profile.healthPlanTrustDescription")}</p>
        </div>
        <Badge variant="outline" className={cn("rounded-full px-3 py-1 text-xs font-semibold", healthPlanTrustTone(summary?.overall_status))}>
          {healthPlanTrustLabel(t, summary?.overall_status)}
        </Badge>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Badge variant="secondary" className="rounded-full px-3 py-1">
          {interpolate(t("profile.healthPlanTrustScore"), { score: Number(summary?.trust_score || 0) })}
        </Badge>
        <Badge variant="secondary" className="rounded-full px-3 py-1">
          {interpolate(t("profile.healthPlanTrustBlockers"), { count: Number(summary?.blocker_count || 0) })}
        </Badge>
        <Badge variant="secondary" className="rounded-full px-3 py-1">
          {interpolate(t("profile.healthPlanTrustCautions"), { count: Number(summary?.caution_count || 0) })}
        </Badge>
        <Badge variant="outline" className={cn("rounded-full px-3 py-1 text-xs font-semibold", summary?.can_trust_for_staff_use ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700")}>
          {summary?.can_trust_for_staff_use ? t("profile.healthPlanTrustUseReady") : t("profile.healthPlanTrustUseHold")}
        </Badge>
      </div>
      {dimensions.length > 0 && (
        <div className="mt-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{t("profile.healthPlanTrustDimensionTitle")}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {dimensions.slice(0, 8).map((item, index) => (
              <Badge key={`${item.name || index}-${index}`} variant="outline" className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", healthPlanTrustTone(item.overall_status))}>
                {healthPlanTrustDimensionLabel(t, item.name)}
              </Badge>
            ))}
          </div>
        </div>
      )}
      {items.length > 0 && (
        <div className="mt-4 grid gap-3 xl:grid-cols-2">
          {items.slice(0, 4).map((item, index) => (
            <div key={`${item.type || "item"}-${index}`} className="rounded-2xl border border-border/70 bg-slate-50/70 px-3.5 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-foreground">{item.label || t("profile.healthPlanTrustIssueFallback")}</p>
                <Badge variant="outline" className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", healthPlanGapSeverityClasses(item.severity))}>
                  {healthPlanGapSeverityLabel(t, item.severity)}
                </Badge>
              </div>
              {safeArray(item.section_keys).length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {safeArray(item.section_keys).slice(0, 2).map((sectionKey) => (
                    <Badge key={sectionKey} variant="outline" className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold">
                      {healthPlanHistorySectionLabel(t, sectionKey)}
                    </Badge>
                  ))}
                </div>
              )}
              {item.detail && <p className="mt-2 text-sm leading-6 text-foreground/80">{item.detail}</p>}
            </div>
          ))}
        </div>
      )}
      <div className="mt-4 rounded-2xl border border-border/70 bg-slate-50/70 px-3.5 py-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{t("profile.healthPlanTrustNextActions")}</p>
        {actions.length > 0 ? (
          <div className="mt-3 space-y-2">
            {actions.slice(0, 4).map((action, index) => (
              <div key={index} className="rounded-xl border border-white/80 bg-white/90 px-3 py-2.5">
                <p className="text-sm leading-6 text-foreground/85">{action}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{t("profile.healthPlanTrustNoActions")}</p>
        )}
      </div>
    </div>
  );
}

function HealthPlanReviewRemediationPanel({
  summary,
  canManage = false,
  refreshingSectionKeys = [],
  generating = false,
  onRefreshSections,
  onRegenerateAll,
  onOpenReview,
}: {
  summary?: {
    overall_status?: "ready" | "guarded" | "blocked" | null;
    summary?: string | null;
    action_count?: number | null;
    actions?: Array<{
      id?: string | null;
      action_kind?: "refresh_sections" | "regenerate_all" | "open_review" | "manual_follow_up" | null;
      priority?: "high" | "medium" | "low" | null;
      title?: string | null;
      reasons?: string[] | null;
      section_keys?: string[] | null;
      section_labels?: string[] | null;
    }> | null;
  } | null;
  canManage?: boolean;
  refreshingSectionKeys?: string[];
  generating?: boolean;
  onRefreshSections?: ((sectionKeys: string[]) => void) | undefined;
  onRegenerateAll?: (() => void) | undefined;
  onOpenReview?: (() => void) | undefined;
}) {
  const { t } = useLanguage();
  const actions = safeArray(summary?.actions);
  const refreshingSet = new Set(refreshingSectionKeys);

  return (
    <div className="rounded-[18px] border border-border/80 bg-white/90 px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("profile.healthPlanReviewRemediationTitle")}</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{summary?.summary || t("profile.healthPlanReviewRemediationDescription")}</p>
        </div>
        <Badge variant="secondary" className="rounded-full px-3 py-1">
          {interpolate(t("profile.healthPlanReviewRemediationCount"), { count: Number(summary?.action_count || 0) })}
        </Badge>
      </div>
      {actions.length > 0 ? (
        <div className="mt-4 space-y-3">
          {actions.map((action, index) => {
            const sectionKeys = safeArray(action.section_keys);
            const isRefreshing = sectionKeys.length > 0 && sectionKeys.every((sectionKey) => refreshingSet.has(sectionKey));
            return (
              <div key={action.id || index} className="rounded-2xl border border-border/70 bg-slate-50/70 px-3.5 py-3.5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-foreground">{action.title || t("profile.healthPlanReviewRemediationItemFallback")}</p>
                      <Badge variant="outline" className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", healthPlanImprovePriorityClasses(action.priority))}>
                        {healthPlanImprovePriorityLabel(t, action.priority)}
                      </Badge>
                    </div>
                    {safeArray(action.section_labels).length > 0 && (
                      <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
                        {safeArray(action.section_labels).join(" · ")}
                      </p>
                    )}
                    {safeArray(action.reasons).length > 0 && (
                      <div className="mt-2 space-y-1.5">
                        {safeArray(action.reasons).slice(0, 2).map((reason, reasonIndex) => (
                          <p key={reasonIndex} className="text-sm leading-6 text-foreground/80">{reason}</p>
                        ))}
                      </div>
                    )}
                  </div>
                  {canManage && action.action_kind === "refresh_sections" && sectionKeys.length > 0 && onRefreshSections && (
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-full"
                      disabled={generating || isRefreshing}
                      onClick={() => onRefreshSections(sectionKeys)}
                    >
                      {isRefreshing ? t("profile.healthPlanRefreshingSection") : t("profile.healthPlanReviewRemediationRefresh")}
                    </Button>
                  )}
                  {canManage && action.action_kind === "regenerate_all" && onRegenerateAll && (
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-full"
                      disabled={generating}
                      onClick={onRegenerateAll}
                    >
                      {generating ? t("profile.healthPlanGenerating") : t("profile.healthPlanReviewRemediationRegenerate")}
                    </Button>
                  )}
                  {canManage && action.action_kind === "open_review" && onOpenReview && (
                    <Button type="button" variant="outline" className="rounded-full" onClick={onOpenReview}>
                      {t("profile.healthPlanReviewRemediationReview")}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="mt-4 text-sm leading-6 text-muted-foreground">{t("profile.healthPlanReviewRemediationEmpty")}</p>
      )}
    </div>
  );
}

function HealthPlanRecommendationEffectivenessPanel({
  summary,
}: {
  summary?: {
    overall_status?: "supportive" | "mixed" | "fragile" | null;
    summary?: string | null;
    preserve_count?: number | null;
    rework_count?: number | null;
    retire_count?: number | null;
    preserve_now?: Array<{
      item_id?: string | null;
      section_key?: string | null;
      text?: string | null;
      action_reason?: string | null;
      impact_status?: "reinforced" | "mixed" | "contradicted" | "limited" | null;
      reuse_priority?: "preserve" | "refine" | "replace" | "verify" | null;
      trajectory?: "strengthening" | "stable" | "weakening" | "volatile" | "untested" | null;
    }> | null;
    rework_now?: Array<{
      item_id?: string | null;
      section_key?: string | null;
      text?: string | null;
      action?: "rework" | "verify" | null;
      action_reason?: string | null;
      impact_status?: "reinforced" | "mixed" | "contradicted" | "limited" | null;
      reuse_priority?: "preserve" | "refine" | "replace" | "verify" | null;
      trajectory?: "strengthening" | "stable" | "weakening" | "volatile" | "untested" | null;
    }> | null;
    retire_now?: Array<{
      item_id?: string | null;
      section_key?: string | null;
      text?: string | null;
      action_reason?: string | null;
      impact_status?: "reinforced" | "mixed" | "contradicted" | "limited" | null;
      reuse_priority?: "preserve" | "refine" | "replace" | "verify" | null;
      trajectory?: "strengthening" | "stable" | "weakening" | "volatile" | "untested" | null;
    }> | null;
  } | null;
}) {
  const { t } = useLanguage();
  const groups = [
    { key: "preserve", title: t("profile.healthPlanEffectivenessPreserve"), items: safeArray(summary?.preserve_now), count: Number(summary?.preserve_count || 0) },
    { key: "rework", title: t("profile.healthPlanEffectivenessRework"), items: safeArray(summary?.rework_now), count: Number(summary?.rework_count || 0) },
    { key: "retire", title: t("profile.healthPlanEffectivenessRetire"), items: safeArray(summary?.retire_now), count: Number(summary?.retire_count || 0) },
  ];

  return (
    <div className="rounded-[18px] border border-border/80 bg-white/90 px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("profile.healthPlanEffectivenessTitle")}</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{summary?.summary || t("profile.healthPlanEffectivenessDescription")}</p>
        </div>
        <Badge variant="outline" className={cn("rounded-full px-3 py-1 text-xs font-semibold", healthPlanEffectivenessTone(summary?.overall_status))}>
          {healthPlanEffectivenessLabel(t, summary?.overall_status)}
        </Badge>
      </div>
      <div className="mt-4 grid gap-3 xl:grid-cols-3">
        {groups.map((group) => (
          <div key={group.key} className="rounded-2xl border border-border/70 bg-slate-50/70 p-3.5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">{group.title}</p>
              <Badge variant="outline" className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold">
                {group.count}
              </Badge>
            </div>
            {group.items.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">{t("profile.healthPlanEffectivenessEmptyGroup")}</p>
            ) : (
              <div className="mt-3 space-y-3">
                {group.items.slice(0, 3).map((item, index) => (
                  <div key={item.item_id || `${item.text}-${index}`} className="rounded-2xl border border-white/80 bg-white/90 px-3.5 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-foreground">{item.text || "-"}</p>
                      {item.reuse_priority && (
                        <Badge variant="outline" className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", healthPlanReusePriorityTone(item.reuse_priority))}>
                          {healthPlanReusePriorityLabel(t, item.reuse_priority)}
                        </Badge>
                      )}
                      {item.trajectory && (
                        <Badge variant="outline" className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", healthPlanTrajectoryTone(item.trajectory))}>
                          {healthPlanTrajectoryLabel(t, item.trajectory)}
                        </Badge>
                      )}
                      {item.impact_status && (
                        <Badge variant="outline" className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", healthPlanRecommendationImpactTone(item.impact_status))}>
                          {healthPlanRecommendationImpactLabel(t, item.impact_status)}
                        </Badge>
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {item.section_key && (
                        <Badge variant="outline" className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold">
                          {healthPlanHistorySectionLabel(t, item.section_key)}
                        </Badge>
                      )}
                    </div>
                    {item.action_reason && <p className="mt-2 text-sm leading-6 text-foreground/80">{item.action_reason}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function HealthPlanRecommendationImpactPanel({
  summary,
}: {
  summary?: {
    overall_status?: "reinforcing" | "mixed" | "contradicted" | "limited" | null;
    summary?: string | null;
    reinforced_count?: number | null;
    contradicted_count?: number | null;
    preserve_count?: number | null;
    retire_count?: number | null;
    items?: Array<{
      item_id?: string | null;
      section_key?: string | null;
      section_label?: string | null;
      text?: string | null;
      impact_status?: "reinforced" | "mixed" | "contradicted" | "limited" | null;
      recommended_action?: "preserve" | "rework" | "retire" | "verify" | null;
      is_high_priority?: boolean | null;
      reason?: string | null;
      next_step?: string | null;
    }> | null;
  } | null;
}) {
  const { t } = useLanguage();
  const items = safeArray(summary?.items);

  return (
    <div className="rounded-[18px] border border-border/80 bg-white/90 px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("profile.healthPlanRecommendationImpactTitle")}</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{summary?.summary || t("profile.healthPlanRecommendationImpactDescription")}</p>
        </div>
        <Badge variant="outline" className={cn("rounded-full px-3 py-1 text-xs font-semibold", healthPlanRecommendationImpactTone(summary?.overall_status))}>
          {healthPlanRecommendationImpactLabel(t, summary?.overall_status)}
        </Badge>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Badge variant="secondary" className="rounded-full px-3 py-1">
          {interpolate(t("profile.healthPlanRecommendationImpactReinforcedCount"), { count: Number(summary?.reinforced_count || 0) })}
        </Badge>
        <Badge variant="secondary" className="rounded-full px-3 py-1">
          {interpolate(t("profile.healthPlanRecommendationImpactContradictedCount"), { count: Number(summary?.contradicted_count || 0) })}
        </Badge>
        <Badge variant="secondary" className="rounded-full px-3 py-1">
          {interpolate(t("profile.healthPlanRecommendationImpactPreserveCount"), { count: Number(summary?.preserve_count || 0) })}
        </Badge>
        <Badge variant="secondary" className="rounded-full px-3 py-1">
          {interpolate(t("profile.healthPlanRecommendationImpactRetireCount"), { count: Number(summary?.retire_count || 0) })}
        </Badge>
      </div>
      {items.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">{t("profile.healthPlanRecommendationImpactEmpty")}</p>
      ) : (
        <div className="mt-4 grid gap-3 xl:grid-cols-2">
          {items.slice(0, 4).map((item, index) => (
            <div key={item.item_id || `${item.text}-${index}`} className="rounded-2xl border border-border/70 bg-slate-50/70 px-3.5 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-foreground">{item.text || "-"}</p>
                {item.impact_status && (
                  <Badge variant="outline" className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", healthPlanRecommendationImpactTone(item.impact_status))}>
                    {healthPlanRecommendationImpactLabel(t, item.impact_status)}
                  </Badge>
                )}
                {item.recommended_action && (
                  <Badge variant="outline" className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", healthPlanRepairActionTone(item.recommended_action === "verify" ? "verify" : item.recommended_action))}>
                    {healthPlanRepairActionLabel(t, item.recommended_action === "verify" ? "verify" : item.recommended_action)}
                  </Badge>
                )}
                {item.is_high_priority && (
                  <Badge variant="outline" className="rounded-full border-rose-200 bg-rose-50 px-2.5 py-0.5 text-[11px] font-semibold text-rose-700">
                    {t("profile.healthPlanRecommendationHigh")}
                  </Badge>
                )}
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {item.section_key && (
                  <Badge variant="outline" className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold">
                    {item.section_label || healthPlanHistorySectionLabel(t, item.section_key)}
                  </Badge>
                )}
              </div>
              {item.reason && <p className="mt-2 text-sm leading-6 text-foreground/80">{item.reason}</p>}
              {item.next_step && (
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  <span className="font-semibold text-foreground/80">{t("profile.healthPlanRecommendationImpactNextStep")}:</span> {item.next_step}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function HealthPlanRecommendationReviewSummaryPanel({
  summary,
  compact = false,
}: {
  summary?: Record<string, any> | null;
  compact?: boolean;
}) {
  const { t } = useLanguage();
  const items = safeArray(summary?.items);
  if (!items.length) return null;

  return (
    <div className={cn("rounded-[18px] border border-border/80 bg-white/90 px-4 py-4", compact && "mt-3")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("profile.healthPlanRecommendationReviewTitle")}</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{summary?.summary || t("profile.healthPlanRecommendationReviewDescription")}</p>
        </div>
        <Badge variant="outline" className={cn("rounded-full px-3 py-1 text-xs font-semibold", healthPlanRecommendationReviewTone(summary?.overall_status))}>
          {interpolate(t("profile.healthPlanRecommendationReviewCount"), { count: Number(summary?.item_count || 0) })}
        </Badge>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Badge variant="secondary" className="rounded-full px-3 py-1">
          {interpolate(t("profile.healthPlanRecommendationReviewApprovedCount"), { count: Number(summary?.approved_count || 0) })}
        </Badge>
        <Badge variant="secondary" className="rounded-full px-3 py-1">
          {interpolate(t("profile.healthPlanRecommendationReviewWatchCount"), { count: Number(summary?.watch_count || 0) })}
        </Badge>
        <Badge variant="secondary" className="rounded-full px-3 py-1">
          {interpolate(t("profile.healthPlanRecommendationReviewNeedsEditCount"), { count: Number(summary?.needs_edit_count || 0) })}
        </Badge>
        <Badge variant="secondary" className="rounded-full px-3 py-1">
          {interpolate(t("profile.healthPlanRecommendationReviewMissingCount"), { count: Number(summary?.missing_count || 0) })}
        </Badge>
      </div>
      <div className={cn("mt-4 grid gap-3", compact ? "md:grid-cols-1" : "xl:grid-cols-2")}>
        {items.slice(0, compact ? 2 : 4).map((item, index) => (
          <div key={item?.item_key || item?.item_id || `${item?.text}-${index}`} className="rounded-2xl border border-border/70 bg-slate-50/70 px-3.5 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-foreground">{item?.text || t("profile.healthPlanReviewReadinessItemFallback")}</p>
              <Badge
                variant="outline"
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                  healthPlanRecommendationReviewTone(
                    item?.decision_status === "needs_edit"
                      ? "blocked"
                      : item?.decision_status === "watch"
                        ? "guarded"
                        : item?.decision_status === "approved"
                          ? "ready"
                          : "blocked",
                  ),
                )}
              >
                {healthPlanRecommendationReviewStatusLabel(t, item?.decision_status)}
              </Badge>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {item?.section_key && (
                <Badge variant="outline" className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold">
                  {item?.section_label || healthPlanHistorySectionLabel(t, item.section_key)}
                </Badge>
              )}
            </div>
            {item?.rationale && <p className="mt-2 text-sm leading-6 text-foreground/80">{item.rationale}</p>}
            {item?.updated_at && (
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                {formatDateTime(item.updated_at)}
                {item?.updated_by_email ? ` · ${item.updated_by_email}` : ""}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function HealthPlanRecommendationHistoryPanel({
  summary,
}: {
  summary?: {
    overall_status?: "supportive" | "mixed" | "deteriorating" | "limited" | null;
    summary?: string | null;
    improving_count?: number | null;
    stable_count?: number | null;
    deteriorating_count?: number | null;
    volatile_count?: number | null;
    repeated_contradiction_count?: number | null;
    items?: Array<{
      item_key?: string | null;
      section_key?: string | null;
      section_label?: string | null;
      text?: string | null;
      trend_status?: "improving" | "stable" | "deteriorating" | "volatile" | "limited" | null;
      current_impact_status?: "reinforced" | "mixed" | "contradicted" | "limited" | null;
      current_recommended_action?: "preserve" | "rework" | "retire" | "verify" | null;
      appearance_count?: number | null;
      is_high_priority?: boolean | null;
      reason?: string | null;
      next_step?: string | null;
    }> | null;
  } | null;
}) {
  const { t } = useLanguage();
  const items = safeArray(summary?.items);

  return (
    <div className="rounded-[18px] border border-border/80 bg-white/90 px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("profile.healthPlanRecommendationHistoryTitle")}</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{summary?.summary || t("profile.healthPlanRecommendationHistoryDescription")}</p>
        </div>
        <Badge variant="outline" className={cn("rounded-full px-3 py-1 text-xs font-semibold", healthPlanRecommendationHistoryTone(summary?.overall_status))}>
          {healthPlanRecommendationHistoryLabel(t, summary?.overall_status)}
        </Badge>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Badge variant="secondary" className="rounded-full px-3 py-1">
          {interpolate(t("profile.healthPlanRecommendationHistoryImprovingCount"), { count: Number(summary?.improving_count || 0) })}
        </Badge>
        <Badge variant="secondary" className="rounded-full px-3 py-1">
          {interpolate(t("profile.healthPlanRecommendationHistoryStableCount"), { count: Number(summary?.stable_count || 0) })}
        </Badge>
        <Badge variant="secondary" className="rounded-full px-3 py-1">
          {interpolate(t("profile.healthPlanRecommendationHistoryDeterioratingCount"), { count: Number(summary?.deteriorating_count || 0) })}
        </Badge>
        <Badge variant="secondary" className="rounded-full px-3 py-1">
          {interpolate(t("profile.healthPlanRecommendationHistoryVolatileCount"), { count: Number(summary?.volatile_count || 0) })}
        </Badge>
      </div>
      {items.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">{t("profile.healthPlanRecommendationHistoryEmpty")}</p>
      ) : (
        <div className="mt-4 grid gap-3 xl:grid-cols-2">
          {items.slice(0, 4).map((item, index) => (
            <div key={item.item_key || `${item.text}-${index}`} className="rounded-2xl border border-border/70 bg-slate-50/70 px-3.5 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-foreground">{item.text || "-"}</p>
                {item.trend_status && (
                  <Badge variant="outline" className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", healthPlanRecommendationTrendTone(item.trend_status))}>
                    {healthPlanRecommendationTrendLabel(t, item.trend_status)}
                  </Badge>
                )}
                {item.current_impact_status && (
                  <Badge variant="outline" className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", healthPlanRecommendationImpactTone(item.current_impact_status))}>
                    {healthPlanRecommendationImpactLabel(t, item.current_impact_status)}
                  </Badge>
                )}
                {item.current_recommended_action && (
                  <Badge variant="outline" className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", healthPlanRepairActionTone(item.current_recommended_action))}>
                    {healthPlanRepairActionLabel(t, item.current_recommended_action)}
                  </Badge>
                )}
                {item.is_high_priority && (
                  <Badge variant="outline" className="rounded-full border-rose-200 bg-rose-50 px-2.5 py-0.5 text-[11px] font-semibold text-rose-700">
                    {t("profile.healthPlanRecommendationHigh")}
                  </Badge>
                )}
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {item.section_key && (
                  <Badge variant="outline" className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold">
                    {item.section_label || healthPlanHistorySectionLabel(t, item.section_key)}
                  </Badge>
                )}
                <Badge variant="outline" className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold">
                  {interpolate(t("profile.healthPlanRecommendationHistorySeenCount"), { count: Number(item.appearance_count || 0) })}
                </Badge>
              </div>
              {item.reason && <p className="mt-2 text-sm leading-6 text-foreground/80">{item.reason}</p>}
              {item.next_step && (
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  <span className="font-semibold text-foreground/80">{t("profile.healthPlanRecommendationHistoryNextStep")}:</span> {item.next_step}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function HealthPlanOutcomePatternMemoryPanel({
  summary,
}: {
  summary?: {
    summary?: string | null;
    total_revisions?: number | null;
    stable_response_anchors?: Array<{
      category?: string | null;
      labels?: string[] | null;
      stable_count?: number | null;
      fragile_count?: number | null;
      latest_reason?: string | null;
      latest_response_profile?: "responsive" | "mostly_responsive" | "mixed" | "fragile" | "unreliable" | "unknown" | null;
    }> | null;
    fragile_response_anchors?: Array<{
      category?: string | null;
      labels?: string[] | null;
      stable_count?: number | null;
      fragile_count?: number | null;
      latest_reason?: string | null;
      latest_response_profile?: "responsive" | "mostly_responsive" | "mixed" | "fragile" | "unreliable" | "unknown" | null;
    }> | null;
    preserve_patterns?: Array<{
      section_key?: string | null;
      section_label?: string | null;
      text?: string | null;
      preserve_count?: number | null;
      latest_reason?: string | null;
    }> | null;
    watch_patterns?: Array<{
      section_key?: string | null;
      section_label?: string | null;
      text?: string | null;
      watch_count?: number | null;
      latest_action?: string | null;
      latest_reason?: string | null;
    }> | null;
    replace_patterns?: Array<{
      section_key?: string | null;
      section_label?: string | null;
      text?: string | null;
      replace_count?: number | null;
      latest_reason?: string | null;
    }> | null;
    unstable_sections?: Array<{
      section_key?: string | null;
      section_label?: string | null;
      pressure_count?: number | null;
      fragile_count?: number | null;
      weakening_count?: number | null;
      latest_status?: "helping" | "mixed" | "fragile" | "unproven" | null;
      latest_trend?: "strengthening" | "stable" | "watch" | "weakening" | "volatile" | "untested" | null;
      latest_reason?: string | null;
      reasons?: string[] | null;
    }> | null;
    stable_domains?: Array<{
      id?: string | null;
      label?: string | null;
      helping_count?: number | null;
      fragile_count?: number | null;
      latest_reason?: string | null;
      section_labels?: string[] | null;
    }> | null;
    fragile_domains?: Array<{
      id?: string | null;
      label?: string | null;
      helping_count?: number | null;
      fragile_count?: number | null;
      latest_reason?: string | null;
      section_labels?: string[] | null;
    }> | null;
    guardrails?: string[] | null;
  } | null;
}) {
  const { t } = useLanguage();
  const stableAnchors = safeArray(summary?.stable_response_anchors);
  const fragileAnchors = safeArray(summary?.fragile_response_anchors);
  const preservePatterns = safeArray(summary?.preserve_patterns);
  const watchPatterns = safeArray(summary?.watch_patterns);
  const replacePatterns = safeArray(summary?.replace_patterns);
  const unstableSections = safeArray(summary?.unstable_sections);
  const stableDomains = safeArray(summary?.stable_domains);
  const fragileDomains = safeArray(summary?.fragile_domains);
  const guardrails = safeArray(summary?.guardrails);

  if (
    !summary
    || (
      stableAnchors.length === 0
      && fragileAnchors.length === 0
      && preservePatterns.length === 0
      && watchPatterns.length === 0
      && replacePatterns.length === 0
      && unstableSections.length === 0
      && stableDomains.length === 0
      && fragileDomains.length === 0
    )
  ) {
    return null;
  }

  return (
    <div className="rounded-[18px] border border-border/80 bg-white/90 px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("profile.healthPlanOutcomePatternTitle")}</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{summary?.summary || t("profile.healthPlanOutcomePatternDescription")}</p>
        </div>
        <Badge variant="outline" className="rounded-full px-3 py-1 text-xs font-semibold">
          {interpolate(t("profile.healthPlanOutcomePatternRevisionCount"), { count: Number(summary?.total_revisions || 0) })}
        </Badge>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Badge variant="secondary" className="rounded-full px-3 py-1">
          {interpolate(t("profile.healthPlanOutcomePatternPreserveCount"), { count: preservePatterns.length })}
        </Badge>
        <Badge variant="secondary" className="rounded-full px-3 py-1">
          {interpolate(t("profile.healthPlanOutcomePatternReplaceCount"), { count: replacePatterns.length })}
        </Badge>
        <Badge variant="secondary" className="rounded-full px-3 py-1">
          {interpolate(t("profile.healthPlanOutcomePatternUnstableCount"), { count: unstableSections.length })}
        </Badge>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-800">{t("profile.healthPlanOutcomePatternWorkingTitle")}</p>
            <Badge variant="outline" className="rounded-full border-emerald-200 bg-white/80 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
              {stableAnchors.length + preservePatterns.length + stableDomains.length}
            </Badge>
          </div>
          <div className="mt-3 space-y-3">
            {stableAnchors.slice(0, 2).map((anchor, index) => (
              <div key={`${anchor.category}-${index}`} className="rounded-2xl border border-emerald-200 bg-white/80 px-3.5 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-foreground">{safeArray(anchor.labels)[0] || anchor.category || "-"}</p>
                  <Badge variant="outline" className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", healthPlanResponseAnchorTone(anchor.latest_response_profile))}>
                    {healthPlanResponseAnchorLabel(t, anchor.latest_response_profile)}
                  </Badge>
                  <Badge variant="outline" className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold">
                    {interpolate(t("profile.healthPlanOutcomePatternHeldCount"), { count: Number(anchor.stable_count || 0) })}
                  </Badge>
                </div>
                {anchor.latest_reason && <p className="mt-2 text-sm leading-6 text-foreground/80">{anchor.latest_reason}</p>}
              </div>
            ))}
            {stableDomains.slice(0, 2).map((domain, index) => (
              <div key={domain.id || `${domain.label}-${index}`} className="rounded-2xl border border-emerald-200 bg-white/80 px-3.5 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-foreground">{domain.label || "-"}</p>
                  <Badge variant="outline" className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", healthPlanInterventionTone("helping"))}>
                    {healthPlanInterventionLabel(t, "helping")}
                  </Badge>
                  <Badge variant="outline" className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold">
                    {interpolate(t("profile.healthPlanOutcomePatternHeldCount"), { count: Number(domain.helping_count || 0) })}
                  </Badge>
                </div>
                {domain.latest_reason && <p className="mt-2 text-sm leading-6 text-foreground/80">{domain.latest_reason}</p>}
              </div>
            ))}
            {preservePatterns.slice(0, 2).map((item, index) => (
              <div key={`${item.section_key}-${item.text}-${index}`} className="rounded-2xl border border-emerald-200 bg-white/80 px-3.5 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-foreground">{item.text || "-"}</p>
                  <Badge variant="outline" className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", healthPlanReusePriorityTone("preserve"))}>
                    {healthPlanReusePriorityLabel(t, "preserve")}
                  </Badge>
                  {item.section_key && (
                    <Badge variant="outline" className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold">
                      {healthPlanHistorySectionLabel(t, item.section_key)}
                    </Badge>
                  )}
                </div>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  {interpolate(t("profile.healthPlanOutcomePatternHeldCount"), { count: Number(item.preserve_count || 0) })}
                </p>
                {item.latest_reason && <p className="mt-2 text-sm leading-6 text-foreground/80">{item.latest_reason}</p>}
              </div>
            ))}
            {stableAnchors.length === 0 && stableDomains.length === 0 && preservePatterns.length === 0 && (
              <p className="text-sm text-muted-foreground">{t("profile.healthPlanOutcomePatternEmptyGroup")}</p>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-rose-100 bg-rose-50/60 p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-rose-800">{t("profile.healthPlanOutcomePatternBreakingTitle")}</p>
            <Badge variant="outline" className="rounded-full border-rose-200 bg-white/80 px-2.5 py-0.5 text-[11px] font-semibold text-rose-700">
              {fragileAnchors.length + replacePatterns.length + fragileDomains.length}
            </Badge>
          </div>
          <div className="mt-3 space-y-3">
            {fragileAnchors.slice(0, 2).map((anchor, index) => (
              <div key={`${anchor.category}-${index}`} className="rounded-2xl border border-rose-200 bg-white/80 px-3.5 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-foreground">{safeArray(anchor.labels)[0] || anchor.category || "-"}</p>
                  <Badge variant="outline" className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", healthPlanResponseAnchorTone(anchor.latest_response_profile))}>
                    {healthPlanResponseAnchorLabel(t, anchor.latest_response_profile)}
                  </Badge>
                  <Badge variant="outline" className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold">
                    {interpolate(t("profile.healthPlanOutcomePatternFragileCount"), { count: Number(anchor.fragile_count || 0) })}
                  </Badge>
                </div>
                {anchor.latest_reason && <p className="mt-2 text-sm leading-6 text-foreground/80">{anchor.latest_reason}</p>}
              </div>
            ))}
            {fragileDomains.slice(0, 2).map((domain, index) => (
              <div key={domain.id || `${domain.label}-${index}`} className="rounded-2xl border border-rose-200 bg-white/80 px-3.5 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-foreground">{domain.label || "-"}</p>
                  <Badge variant="outline" className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", healthPlanInterventionTone("fragile"))}>
                    {healthPlanInterventionLabel(t, "fragile")}
                  </Badge>
                  <Badge variant="outline" className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold">
                    {interpolate(t("profile.healthPlanOutcomePatternFragileCount"), { count: Number(domain.fragile_count || 0) })}
                  </Badge>
                </div>
                {domain.latest_reason && <p className="mt-2 text-sm leading-6 text-foreground/80">{domain.latest_reason}</p>}
              </div>
            ))}
            {replacePatterns.slice(0, 2).map((item, index) => (
              <div key={`${item.section_key}-${item.text}-${index}`} className="rounded-2xl border border-rose-200 bg-white/80 px-3.5 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-foreground">{item.text || "-"}</p>
                  <Badge variant="outline" className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", healthPlanReusePriorityTone("replace"))}>
                    {healthPlanReusePriorityLabel(t, "replace")}
                  </Badge>
                  {item.section_key && (
                    <Badge variant="outline" className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold">
                      {healthPlanHistorySectionLabel(t, item.section_key)}
                    </Badge>
                  )}
                </div>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  {interpolate(t("profile.healthPlanOutcomePatternFragileCount"), { count: Number(item.replace_count || 0) })}
                </p>
                {item.latest_reason && <p className="mt-2 text-sm leading-6 text-foreground/80">{item.latest_reason}</p>}
              </div>
            ))}
            {fragileAnchors.length === 0 && fragileDomains.length === 0 && replacePatterns.length === 0 && (
              <p className="text-sm text-muted-foreground">{t("profile.healthPlanOutcomePatternEmptyGroup")}</p>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-2xl border border-border/70 bg-slate-50/70 p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">{t("profile.healthPlanOutcomePatternPressureTitle")}</p>
            <Badge variant="outline" className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold">
              {unstableSections.length + watchPatterns.length}
            </Badge>
          </div>
          {unstableSections.length === 0 && watchPatterns.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">{t("profile.healthPlanOutcomePatternEmptyGroup")}</p>
          ) : (
            <div className="mt-3 space-y-3">
              {unstableSections.slice(0, 3).map((item, index) => (
                <div key={item.section_key || `${item.section_label}-${index}`} className="rounded-2xl border border-border/70 bg-white/90 px-3.5 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-foreground">{item.section_key ? healthPlanHistorySectionLabel(t, item.section_key) : item.section_label || "-"}</p>
                    {item.latest_status && (
                      <Badge variant="outline" className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", healthPlanOutcomeStatusTone(item.latest_status))}>
                        {healthPlanOutcomeStatusLabel(t, item.latest_status)}
                      </Badge>
                    )}
                    {item.latest_trend && (
                      <Badge variant="outline" className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", healthPlanTrajectoryTone(item.latest_trend))}>
                        {healthPlanTrajectoryLabel(t, item.latest_trend)}
                      </Badge>
                    )}
                    <Badge variant="outline" className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold">
                      {interpolate(t("profile.healthPlanOutcomePatternPressureCount"), { count: Number(item.pressure_count || 0) })}
                    </Badge>
                  </div>
                  {item.latest_reason && <p className="mt-2 text-sm leading-6 text-foreground/80">{item.latest_reason}</p>}
                </div>
              ))}
              {watchPatterns.slice(0, 2).map((item, index) => (
                <div key={`${item.section_key}-${item.text}-${index}`} className="rounded-2xl border border-amber-200 bg-amber-50/70 px-3.5 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-foreground">{item.text || "-"}</p>
                    <Badge variant="outline" className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", healthPlanReusePriorityTone("verify"))}>
                      {healthPlanReusePriorityLabel(t, "verify")}
                    </Badge>
                    {item.section_key && (
                      <Badge variant="outline" className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold">
                        {healthPlanHistorySectionLabel(t, item.section_key)}
                      </Badge>
                    )}
                  </div>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    {interpolate(t("profile.healthPlanOutcomePatternWatchCount"), { count: Number(item.watch_count || 0) })}
                  </p>
                  {item.latest_reason && <p className="mt-2 text-sm leading-6 text-foreground/80">{item.latest_reason}</p>}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-border/70 bg-slate-50/70 p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">{t("profile.healthPlanOutcomePatternGuardrailsTitle")}</p>
            <Badge variant="outline" className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold">
              {guardrails.length}
            </Badge>
          </div>
          {guardrails.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">{t("profile.healthPlanOutcomePatternEmptyGroup")}</p>
          ) : (
            <div className="mt-3 space-y-2">
              {guardrails.slice(0, 5).map((item, index) => (
                <div key={`${item}-${index}`} className="rounded-2xl border border-border/70 bg-white/90 px-3.5 py-3">
                  <p className="text-sm leading-6 text-foreground/85">{item}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function HealthPlanRecommendationEvidenceDiversityPanel({
  summary,
}: {
  summary?: {
    overall_status?: "strong" | "guarded" | "fragile" | null;
    summary?: string | null;
    strong_count?: number | null;
    guarded_count?: number | null;
    fragile_count?: number | null;
    high_priority_fragile_count?: number | null;
    items?: Array<{
      item_id?: string | null;
      section_key?: string | null;
      section_label?: string | null;
      text?: string | null;
      diversity_status?: "strong" | "guarded" | "fragile" | null;
      distinct_source_type_count?: number | null;
      live_source_count?: number | null;
      high_pressure?: boolean | null;
      high_confidence?: boolean | null;
      reason?: string | null;
      next_step?: string | null;
    }> | null;
  } | null;
}) {
  const { t } = useLanguage();
  const items = safeArray(summary?.items);

  return (
    <div className="rounded-[18px] border border-border/80 bg-white/90 px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("profile.healthPlanEvidenceDiversityTitle")}</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{summary?.summary || t("profile.healthPlanEvidenceDiversityDescription")}</p>
        </div>
        <Badge variant="outline" className={cn("rounded-full px-3 py-1 text-xs font-semibold", healthPlanEvidenceDiversityTone(summary?.overall_status))}>
          {healthPlanEvidenceDiversityLabel(t, summary?.overall_status)}
        </Badge>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Badge variant="secondary" className="rounded-full px-3 py-1">
          {interpolate(t("profile.healthPlanEvidenceDiversityStrongCount"), { count: Number(summary?.strong_count || 0) })}
        </Badge>
        <Badge variant="secondary" className="rounded-full px-3 py-1">
          {interpolate(t("profile.healthPlanEvidenceDiversityGuardedCount"), { count: Number(summary?.guarded_count || 0) })}
        </Badge>
        <Badge variant="secondary" className="rounded-full px-3 py-1">
          {interpolate(t("profile.healthPlanEvidenceDiversityFragileCount"), { count: Number(summary?.fragile_count || 0) })}
        </Badge>
      </div>
      {items.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">{t("profile.healthPlanEvidenceDiversityEmpty")}</p>
      ) : (
        <div className="mt-4 grid gap-3 xl:grid-cols-2">
          {items.slice(0, 4).map((item, index) => (
            <div key={item.item_id || `${item.text}-${index}`} className="rounded-2xl border border-border/70 bg-slate-50/70 px-3.5 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-foreground">{item.text || "-"}</p>
                {item.diversity_status && (
                  <Badge variant="outline" className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", healthPlanEvidenceDiversityTone(item.diversity_status))}>
                    {healthPlanEvidenceDiversityLabel(t, item.diversity_status)}
                  </Badge>
                )}
                {item.high_pressure && (
                  <Badge variant="outline" className="rounded-full border-rose-200 bg-rose-50 px-2.5 py-0.5 text-[11px] font-semibold text-rose-700">
                    {t("profile.healthPlanRecommendationHigh")}
                  </Badge>
                )}
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {item.section_key && (
                  <Badge variant="outline" className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold">
                    {item.section_label || healthPlanHistorySectionLabel(t, item.section_key)}
                  </Badge>
                )}
                <Badge variant="outline" className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold">
                  {interpolate(t("profile.healthPlanEvidenceDiversitySourceTypes"), { count: Number(item.distinct_source_type_count || 0) })}
                </Badge>
                <Badge variant="outline" className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold">
                  {interpolate(t("profile.healthPlanEvidenceDiversityLiveSources"), { count: Number(item.live_source_count || 0) })}
                </Badge>
              </div>
              {item.reason && <p className="mt-2 text-sm leading-6 text-foreground/80">{item.reason}</p>}
              {item.next_step && (
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  <span className="font-semibold text-foreground/80">{t("profile.healthPlanEvidenceDiversityNextStep")}:</span> {item.next_step}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function HealthPlanRecommendationRevisionMemoryPanel({
  summary,
}: {
  summary?: {
    summary?: string | null;
    improved_count?: number | null;
    preserved_count?: number | null;
    unresolved_count?: number | null;
    regressed_count?: number | null;
    improved?: Array<{
      item_key?: string | null;
      section_key?: string | null;
      section_label?: string | null;
      text?: string | null;
      status?: "improved" | "preserved" | "unresolved" | "regressed" | null;
      current_repair_action?: "preserve" | "rework" | "verify" | "retire" | null;
      latest_action?: "added" | "preserved" | "tightened" | "replaced" | null;
      latest_evidence_shift?: string | null;
      latest_learning_shift?: string | null;
      reason?: string | null;
      next_step?: string | null;
    }> | null;
    preserved?: Array<{
      item_key?: string | null;
      section_key?: string | null;
      section_label?: string | null;
      text?: string | null;
      status?: "improved" | "preserved" | "unresolved" | "regressed" | null;
      current_repair_action?: "preserve" | "rework" | "verify" | "retire" | null;
      latest_action?: "added" | "preserved" | "tightened" | "replaced" | null;
      latest_evidence_shift?: string | null;
      latest_learning_shift?: string | null;
      reason?: string | null;
      next_step?: string | null;
    }> | null;
    unresolved?: Array<{
      item_key?: string | null;
      section_key?: string | null;
      section_label?: string | null;
      text?: string | null;
      status?: "improved" | "preserved" | "unresolved" | "regressed" | null;
      current_repair_action?: "preserve" | "rework" | "verify" | "retire" | null;
      latest_action?: "added" | "preserved" | "tightened" | "replaced" | null;
      latest_evidence_shift?: string | null;
      latest_learning_shift?: string | null;
      reason?: string | null;
      next_step?: string | null;
    }> | null;
    regressed?: Array<{
      item_key?: string | null;
      section_key?: string | null;
      section_label?: string | null;
      text?: string | null;
      status?: "improved" | "preserved" | "unresolved" | "regressed" | null;
      current_repair_action?: "preserve" | "rework" | "verify" | "retire" | null;
      latest_action?: "added" | "preserved" | "tightened" | "replaced" | null;
      latest_evidence_shift?: string | null;
      latest_learning_shift?: string | null;
      reason?: string | null;
      next_step?: string | null;
    }> | null;
  } | null;
}) {
  const { t } = useLanguage();
  const groups = [
    { key: "improved", title: t("profile.healthPlanRevisionMemoryImproved"), items: safeArray(summary?.improved), count: Number(summary?.improved_count || 0) },
    { key: "preserved", title: t("profile.healthPlanRevisionMemoryPreserved"), items: safeArray(summary?.preserved), count: Number(summary?.preserved_count || 0) },
    { key: "unresolved", title: t("profile.healthPlanRevisionMemoryUnresolved"), items: safeArray(summary?.unresolved), count: Number(summary?.unresolved_count || 0) },
    { key: "regressed", title: t("profile.healthPlanRevisionMemoryRegressed"), items: safeArray(summary?.regressed), count: Number(summary?.regressed_count || 0) },
  ];
  const totalCount = groups.reduce((total, group) => total + group.count, 0);

  return (
    <div className="rounded-[18px] border border-border/80 bg-white/90 px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("profile.healthPlanRevisionMemoryTitle")}</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{summary?.summary || t("profile.healthPlanRevisionMemoryDescription")}</p>
        </div>
        <Badge variant="secondary" className="rounded-full px-3 py-1">
          {interpolate(t("profile.healthPlanRevisionMemoryCount"), { count: totalCount })}
        </Badge>
      </div>
      <div className="mt-4 grid gap-3 xl:grid-cols-2">
        {groups.map((group) => (
          <div key={group.key} className="rounded-2xl border border-border/70 bg-slate-50/70 p-3.5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">{group.title}</p>
              <Badge variant="outline" className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", healthPlanRevisionMemoryTone(group.key as "improved" | "preserved" | "unresolved" | "regressed"))}>
                {group.count}
              </Badge>
            </div>
            {group.items.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">{t("profile.healthPlanRevisionMemoryEmptyGroup")}</p>
            ) : (
              <div className="mt-3 space-y-3">
                {group.items.slice(0, 2).map((item, index) => (
                  <div key={item.item_key || `${item.text}-${index}`} className="rounded-2xl border border-white/80 bg-white/90 px-3.5 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-foreground">{item.text || "-"}</p>
                      <Badge variant="outline" className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", healthPlanRevisionMemoryTone(item.status))}>
                        {healthPlanRevisionMemoryLabel(t, item.status)}
                      </Badge>
                      {item.current_repair_action && (
                        <Badge variant="outline" className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", healthPlanRepairActionTone(item.current_repair_action))}>
                          {healthPlanRepairActionLabel(t, item.current_repair_action)}
                        </Badge>
                      )}
                      {item.section_key && (
                        <Badge variant="outline" className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold">
                          {item.section_label || healthPlanHistorySectionLabel(t, item.section_key)}
                        </Badge>
                      )}
                    </div>
                    {item.reason && <p className="mt-2 text-sm leading-6 text-foreground/80">{item.reason}</p>}
                    {(item.latest_evidence_shift || item.latest_learning_shift) && (
                      <div className="mt-3 space-y-1.5">
                        {item.latest_evidence_shift && (
                          <p className="text-xs leading-5 text-muted-foreground">
                            <span className="font-semibold text-foreground/80">{t("profile.healthPlanChangeEvidenceShift")}:</span> {item.latest_evidence_shift}
                          </p>
                        )}
                        {item.latest_learning_shift && (
                          <p className="text-xs leading-5 text-muted-foreground">
                            <span className="font-semibold text-foreground/80">{t("profile.healthPlanChangeLearningShift")}:</span> {item.latest_learning_shift}
                          </p>
                        )}
                      </div>
                    )}
                    {item.next_step && (
                      <p className="mt-3 text-xs leading-5 text-muted-foreground">
                        <span className="font-semibold text-foreground/80">{t("profile.healthPlanRevisionMemoryNextStep")}:</span> {item.next_step}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function HealthPlanOperationalCompletenessPanel({
  summary,
}: {
  summary?: {
    overall_status?: "strong" | "guarded" | "fragile" | null;
    summary?: string | null;
    score?: number | null;
    issue_count?: number | null;
    issues?: Array<{
      type?: string | null;
      section_key?: string | null;
      severity?: "high" | "medium" | "low" | null;
      message?: string | null;
      detail?: string | null;
    }> | null;
    section_checks?: Array<{
      section_key?: string | null;
      section_label?: string | null;
      overall_status?: "strong" | "guarded" | "fragile" | null;
      summary?: string | null;
    }> | null;
  } | null;
}) {
  const { t } = useLanguage();
  const issues = safeArray(summary?.issues);
  const sections = safeArray(summary?.section_checks).filter((item) => item?.overall_status && item.overall_status !== "strong");

  return (
    <div className="rounded-[18px] border border-border/80 bg-white/90 px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("profile.healthPlanOperationalCompletenessTitle")}</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{summary?.summary || t("profile.healthPlanOperationalCompletenessDescription")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className={cn("rounded-full px-3 py-1 text-xs font-semibold", healthPlanOperationalCompletenessTone(summary?.overall_status))}>
            {healthPlanOperationalCompletenessLabel(t, summary?.overall_status)}
          </Badge>
          <Badge variant="secondary" className="rounded-full px-3 py-1">
            {interpolate(t("profile.healthPlanOperationalCompletenessIssues"), { count: Number(summary?.issue_count || 0) })}
          </Badge>
        </div>
      </div>
      {sections.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {sections.slice(0, 4).map((section, index) => (
            <Badge key={section.section_key || `${section.section_label}-${index}`} variant="outline" className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", healthPlanOperationalCompletenessTone(section.overall_status))}>
              {section.section_label || healthPlanHistorySectionLabel(t, section.section_key)}
            </Badge>
          ))}
        </div>
      )}
      {issues.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">{t("profile.healthPlanOperationalCompletenessEmpty")}</p>
      ) : (
        <div className="mt-4 grid gap-3 xl:grid-cols-2">
          {issues.slice(0, 4).map((item, index) => (
            <div key={`${item.section_key}-${item.type}-${index}`} className="rounded-2xl border border-border/70 bg-slate-50/70 px-3.5 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-foreground">{healthPlanHistorySectionLabel(t, item.section_key)}</p>
                <Badge variant="outline" className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", healthPlanGapSeverityClasses(item.severity))}>
                  {healthPlanGapSeverityLabel(t, item.severity)}
                </Badge>
              </div>
              {item.message && <p className="mt-2 text-sm leading-6 text-foreground/80">{item.message}</p>}
              {item.detail && <p className="mt-2 text-xs leading-5 text-muted-foreground">{item.detail}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function HealthPlanActionImpactPanel({
  summary,
}: {
  summary?: {
    overall_status?: "reinforcing" | "mixed" | "contradicted" | "limited" | null;
    summary?: string | null;
    reinforced_count?: number | null;
    mixed_count?: number | null;
    contradicted_count?: number | null;
    limited_count?: number | null;
    items?: Array<{
      section_key?: string | null;
      section_label?: string | null;
      impact_status?: "reinforced" | "mixed" | "contradicted" | "limited" | null;
      score?: number | null;
      operational_completeness_status?: "strong" | "guarded" | "fragile" | null;
      positive_signal_count?: number | null;
      caution_signal_count?: number | null;
      positive_event_count?: number | null;
      caution_event_count?: number | null;
      live_pressure_count?: number | null;
      live_watch_count?: number | null;
      reason?: string | null;
      next_step?: string | null;
    }> | null;
  } | null;
}) {
  const { t } = useLanguage();
  const items = safeArray(summary?.items);

  return (
    <div className="rounded-[18px] border border-border/80 bg-white/90 px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("profile.healthPlanActionImpactTitle")}</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{summary?.summary || t("profile.healthPlanActionImpactDescription")}</p>
        </div>
        <Badge variant="outline" className={cn("rounded-full px-3 py-1 text-xs font-semibold", healthPlanActionImpactTone(summary?.overall_status))}>
          {healthPlanActionImpactLabel(t, summary?.overall_status)}
        </Badge>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Badge variant="secondary" className="rounded-full px-3 py-1">
          {interpolate(t("profile.healthPlanActionImpactReinforcedCount"), { count: Number(summary?.reinforced_count || 0) })}
        </Badge>
        <Badge variant="secondary" className="rounded-full px-3 py-1">
          {interpolate(t("profile.healthPlanActionImpactMixedCount"), { count: Number(summary?.mixed_count || 0) })}
        </Badge>
        <Badge variant="secondary" className="rounded-full px-3 py-1">
          {interpolate(t("profile.healthPlanActionImpactContradictedCount"), { count: Number(summary?.contradicted_count || 0) })}
        </Badge>
        <Badge variant="secondary" className="rounded-full px-3 py-1">
          {interpolate(t("profile.healthPlanActionImpactLimitedCount"), { count: Number(summary?.limited_count || 0) })}
        </Badge>
      </div>
      {items.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">{t("profile.healthPlanActionImpactEmpty")}</p>
      ) : (
        <div className="mt-4 grid gap-3 xl:grid-cols-2">
          {items.slice(0, 4).map((item, index) => (
            <div key={`${item.section_key}-${item.impact_status}-${index}`} className="rounded-2xl border border-border/70 bg-slate-50/70 px-3.5 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-foreground">{item.section_label || healthPlanHistorySectionLabel(t, item.section_key)}</p>
                <Badge variant="outline" className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", healthPlanActionImpactTone(
                  item.impact_status === "reinforced" ? "reinforcing" : item.impact_status,
                ))}>
                  {healthPlanActionImpactLabel(t, item.impact_status === "reinforced" ? "reinforcing" : item.impact_status)}
                </Badge>
                <Badge variant="outline" className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", healthPlanOperationalCompletenessTone(item.operational_completeness_status))}>
                  {healthPlanOperationalCompletenessLabel(t, item.operational_completeness_status)}
                </Badge>
              </div>
              {item.reason && <p className="mt-2 text-sm leading-6 text-foreground/80">{item.reason}</p>}
              <p className="mt-3 text-xs leading-5 text-muted-foreground">
                {interpolate(t("profile.healthPlanOperationalCounts"), {
                  positive: Number(item.positive_event_count || 0) + Number(item.positive_signal_count || 0),
                  caution: Number(item.caution_event_count || 0) + Number(item.caution_signal_count || 0) + Number(item.live_pressure_count || 0),
                })}
              </p>
              {item.next_step && (
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  <span className="font-semibold text-foreground/80">{t("profile.healthPlanActionImpactNextStep")}:</span> {item.next_step}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function HealthPlanRecommendationChallengePanel({
  summary,
}: {
  summary?: {
    overall_status?: "supported" | "guarded" | "challenged" | null;
    summary?: string | null;
    challenged_count?: number | null;
    high_risk_count?: number | null;
    items?: Array<{
      item_id?: string | null;
      section_key?: string | null;
      section_label?: string | null;
      text?: string | null;
      challenge_status?: "supported" | "guarded" | "challenged" | null;
      evidence_support?: "strong" | "mixed" | "thin" | null;
      high_risk?: boolean | null;
      why_it_is_questioned?: string | null;
      safer_reframe?: string | null;
    }> | null;
  } | null;
}) {
  const { t } = useLanguage();
  const items = safeArray(summary?.items);
  const flagged = items.filter((item) => item.challenge_status !== "supported");

  return (
    <div className="rounded-[18px] border border-border/80 bg-white/90 px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("profile.healthPlanChallengeTitle")}</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{summary?.summary || t("profile.healthPlanChallengeDescription")}</p>
        </div>
        <Badge variant="outline" className={cn("rounded-full px-3 py-1 text-xs font-semibold", healthPlanChallengeTone(summary?.overall_status))}>
          {healthPlanChallengeLabel(t, summary?.overall_status)}
        </Badge>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Badge variant="secondary" className="rounded-full px-3 py-1">
          {interpolate(t("profile.healthPlanChallengeCount"), { count: Number(summary?.challenged_count || 0) })}
        </Badge>
        <Badge variant="secondary" className="rounded-full px-3 py-1">
          {interpolate(t("profile.healthPlanChallengeHighRiskCount"), { count: Number(summary?.high_risk_count || 0) })}
        </Badge>
      </div>
      {flagged.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">{t("profile.healthPlanChallengeEmpty")}</p>
      ) : (
        <div className="mt-4 grid gap-3 xl:grid-cols-2">
          {flagged.slice(0, 4).map((item, index) => (
            <div key={item.item_id || `${item.section_key}-${index}`} className="rounded-2xl border border-border/70 bg-slate-50/70 px-3.5 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-foreground">{item.section_label || healthPlanHistorySectionLabel(t, item.section_key)}</p>
                <Badge variant="outline" className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", healthPlanChallengeTone(item.challenge_status))}>
                  {healthPlanChallengeLabel(t, item.challenge_status)}
                </Badge>
                <Badge variant="outline" className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold">
                  {healthPlanChallengeEvidenceLabel(t, item.evidence_support)}
                </Badge>
                {item.high_risk && (
                  <Badge variant="outline" className="rounded-full border-rose-200 bg-rose-50 px-2.5 py-0.5 text-[11px] font-semibold text-rose-700">
                    {t("profile.healthPlanChallengeHighRisk")}
                  </Badge>
                )}
              </div>
              {item.text && <p className="mt-3 text-sm font-medium leading-6 text-foreground">{item.text}</p>}
              {item.why_it_is_questioned && (
                <div className="mt-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{t("profile.healthPlanChallengeWhy")}</p>
                  <p className="mt-1 text-sm leading-6 text-foreground/80">{item.why_it_is_questioned}</p>
                </div>
              )}
              {item.safer_reframe && (
                <div className="mt-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{t("profile.healthPlanChallengeSaferReframe")}</p>
                  <p className="mt-1 text-sm leading-6 text-foreground/80">{item.safer_reframe}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function HealthPlanLiveEvidencePanel({
  summary,
}: {
  summary?: {
    status?: "stable" | "watch" | "pressure" | null;
    summary?: string | null;
    service_engagement?: { status?: "stable" | "watch" | "pressure" | null; summary?: string | null; caution_count?: number | null; windows?: { trend?: "worsening" | "improving" | "mixed" | "steady" | null } | null } | null;
    medication_adherence?: { status?: "stable" | "watch" | "pressure" | null; summary?: string | null; reminders_disabled_count?: number | null; windows?: { trend?: "worsening" | "improving" | "mixed" | "steady" | null } | null } | null;
    sensor_reliability?: { status?: "stable" | "watch" | "pressure" | null; summary?: string | null; active_alert_count?: number | null; offline_count?: number | null; windows?: { trend?: "worsening" | "improving" | "mixed" | "steady" | null } | null } | null;
    attention_flags?: Array<{ id?: string | null; label?: string | null; severity?: "high" | "medium" | "low" | null; detail?: string | null; section_key?: string | null }> | null;
  } | null;
}) {
  const { t } = useLanguage();
  const flags = safeArray(summary?.attention_flags);
  const blocks = [
    { key: "service", title: t("profile.healthPlanLiveEvidenceService"), value: summary?.service_engagement },
    { key: "medication", title: t("profile.healthPlanLiveEvidenceMedication"), value: summary?.medication_adherence },
    { key: "sensor", title: t("profile.healthPlanLiveEvidenceSensor"), value: summary?.sensor_reliability },
  ];

  return (
    <div className="rounded-[18px] border border-border/80 bg-white/90 px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("profile.healthPlanLiveEvidenceTitle")}</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{summary?.summary || t("profile.healthPlanLiveEvidenceDescription")}</p>
        </div>
        <Badge variant="outline" className={cn("rounded-full px-3 py-1 text-xs font-semibold", healthPlanLiveEvidenceTone(summary?.status))}>
          {healthPlanLiveEvidenceLabel(t, summary?.status)}
        </Badge>
      </div>
      <div className="mt-4 grid gap-3 xl:grid-cols-3">
        {blocks.map((block) => (
            <div key={block.key} className="rounded-2xl border border-border/70 bg-slate-50/70 px-3.5 py-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">{block.title}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", healthPlanLiveEvidenceTone(block.value?.status))}>
                    {healthPlanLiveEvidenceLabel(t, block.value?.status)}
                  </Badge>
                  <Badge variant="outline" className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", healthPlanLiveEvidenceTrendTone(block.value?.windows?.trend))}>
                    {healthPlanLiveEvidenceTrendLabel(t, block.value?.windows?.trend)}
                  </Badge>
                </div>
              </div>
              <p className="mt-3 text-sm leading-6 text-foreground/80">{block.value?.summary || "-"}</p>
            </div>
        ))}
      </div>
      {flags.length > 0 && (
        <div className="mt-4 grid gap-3 xl:grid-cols-2">
          {flags.slice(0, 4).map((flag, index) => (
            <div key={flag.id || `${flag.label}-${index}`} className="rounded-2xl border border-border/70 bg-slate-50/70 px-3.5 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-foreground">{flag.label || "-"}</p>
                <Badge variant="outline" className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", healthPlanGapSeverityClasses(flag.severity))}>
                  {healthPlanGapSeverityLabel(t, flag.severity)}
                </Badge>
                {flag.section_key && (
                  <Badge variant="outline" className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold">
                    {healthPlanHistorySectionLabel(t, flag.section_key)}
                  </Badge>
                )}
              </div>
              {flag.detail && <p className="mt-2 text-sm leading-6 text-foreground/80">{flag.detail}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function HealthPlanLongitudinalMemoryPanel({
  summary,
}: {
  summary?: {
    summary?: string | null;
    persistent_count?: number | null;
    recurrent_count?: number | null;
    stabilizing_count?: number | null;
    domains?: Array<{
      id?: string | null;
      key?: string | null;
      label?: string | null;
      status?: "persistent_pressure" | "recurrent_watch" | "stabilizing" | "limited_history" | null;
      current_trend?: "worsening" | "improving" | "mixed" | "steady" | null;
      why_it_matters?: string | null;
      action_bias?: string | null;
      repeated_count?: number | null;
    }> | null;
  } | null;
}) {
  const { t } = useLanguage();
  const items = safeArray(summary?.domains);

  return (
    <div className="rounded-[18px] border border-border/80 bg-white/90 px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("profile.healthPlanLongitudinalTitle")}</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{summary?.summary || t("profile.healthPlanLongitudinalDescription")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary" className="rounded-full px-3 py-1">
            {interpolate(t("profile.healthPlanLongitudinalPersistentCount"), { count: Number(summary?.persistent_count || 0) })}
          </Badge>
          <Badge variant="secondary" className="rounded-full px-3 py-1">
            {interpolate(t("profile.healthPlanLongitudinalRecurrentCount"), { count: Number(summary?.recurrent_count || 0) })}
          </Badge>
        </div>
      </div>
      <div className="mt-4 grid gap-3 xl:grid-cols-3">
        {items.slice(0, 3).map((item, index) => (
          <div key={item.id || `${item.key}-${index}`} className="rounded-2xl border border-border/70 bg-slate-50/70 px-3.5 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-foreground">{item.label || "-"}</p>
              <Badge variant="outline" className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", healthPlanLongitudinalTone(item.status))}>
                {healthPlanLongitudinalLabel(t, item.status)}
              </Badge>
              <Badge variant="outline" className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", healthPlanLiveEvidenceTrendTone(item.current_trend))}>
                {healthPlanLiveEvidenceTrendLabel(t, item.current_trend)}
              </Badge>
            </div>
            {item.why_it_matters && <p className="mt-2 text-sm leading-6 text-foreground/80">{item.why_it_matters}</p>}
            {item.action_bias && (
              <p className="mt-3 text-xs leading-5 text-muted-foreground">
                {item.action_bias}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function HealthPlanSectionDriftPanel({
  drift,
  refreshStrategy,
  canManage = false,
  refreshingSectionKeys = [],
  onRefreshSection,
  onRefreshHighlighted,
  onRegenerateAll,
}: {
  drift?: Array<{ section_key?: string; label?: string | null; status?: "fresh" | "mixed" | "needs_refresh" | null; reasons?: string[] }> | null;
  refreshStrategy?: {
    full_regeneration_preferred?: boolean;
    recommended_sections?: Array<{ section_key?: string; priority?: "high" | "medium" | "low" | null; reasons?: string[] }>;
    refresh_now_section_keys?: string[];
    recommendation?: string | null;
  } | null;
  canManage?: boolean;
  refreshingSectionKeys?: string[];
  onRefreshSection?: ((sectionKey: string) => void) | undefined;
  onRefreshHighlighted?: (() => void) | undefined;
  onRegenerateAll?: (() => void) | undefined;
}) {
  const { t } = useLanguage();
  const items = safeArray(drift);
  const highlighted = items.filter((item) => item.status !== "fresh");
  const refreshingLookup = new Set(safeArray(refreshingSectionKeys));
  const recommendedSections = safeArray(refreshStrategy?.recommended_sections);
  const refreshNowKeys = new Set(safeArray(refreshStrategy?.refresh_now_section_keys));
  const visibleItems = recommendedSections.length > 0 ? recommendedSections : highlighted;

  return (
    <div className="rounded-[18px] border border-border/80 bg-white/85 px-4 py-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("profile.healthPlanDriftTitle")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t("profile.healthPlanDriftDescription")}</p>
          {refreshStrategy?.recommendation && (
            <p className="mt-2 text-sm font-medium text-foreground/80">{refreshStrategy.recommendation}</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="rounded-full px-3 py-1">
            {safeArray(refreshStrategy?.refresh_now_section_keys).length || highlighted.length}
          </Badge>
          {canManage && safeArray(refreshStrategy?.refresh_now_section_keys).length > 1 && onRefreshHighlighted && (
            <Button type="button" variant="outline" size="sm" disabled={refreshingLookup.size > 0} onClick={onRefreshHighlighted}>
              <RefreshCw className={cn("mr-1.5 h-3.5 w-3.5", refreshingLookup.size > 0 && "animate-spin")} />
              {refreshingLookup.size > 0 ? t("profile.healthPlanRefreshingSection") : t("profile.healthPlanRefreshRecommended")}
            </Button>
          )}
          {canManage && refreshStrategy?.full_regeneration_preferred && onRegenerateAll && (
            <Button type="button" size="sm" disabled={refreshingLookup.size > 0} onClick={onRegenerateAll}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              {t("profile.healthPlanRegenerate")}
            </Button>
          )}
        </div>
      </div>
      {visibleItems.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">{t("profile.healthPlanDriftEmpty")}</p>
      ) : (
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {visibleItems.map((item, index) => (
            <div
              key={item.section_key || `${item.label}-${index}`}
              className={cn(
                "rounded-2xl border px-3.5 py-3",
                "status" in item ? healthPlanDriftTone(item.status) : healthPlanGapSeverityClasses(item.priority),
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold">
                      {"label" in item && item.label
                        ? item.label
                        : healthPlanHistorySectionLabel(t, item.section_key)}
                    </p>
                    <Badge
                      variant="outline"
                      className={cn(
                        "rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                        "status" in item ? healthPlanDriftTone(item.status) : healthPlanGapSeverityClasses(item.priority),
                      )}
                    >
                      {"status" in item ? healthPlanDriftLabel(t, item.status) : healthPlanGapSeverityLabel(t, item.priority)}
                    </Badge>
                    {refreshNowKeys.has(item.section_key || "") && (
                      <Badge variant="outline" className="rounded-full border-primary/20 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
                        {t("profile.healthPlanRefreshRecommendedTag")}
                      </Badge>
                    )}
                    {refreshStrategy?.full_regeneration_preferred && refreshNowKeys.has(item.section_key || "") && (
                      <Badge variant="outline" className="rounded-full border-rose-200 px-2.5 py-0.5 text-[11px] font-semibold text-rose-700">
                        {t("profile.healthPlanRefreshFullPreferred")}
                      </Badge>
                    )}
                  </div>
                </div>
                {canManage && item.section_key && onRefreshSection && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={refreshingLookup.size > 0}
                    onClick={() => onRefreshSection(item.section_key!)}
                  >
                    <RefreshCw className={cn("mr-1.5 h-3.5 w-3.5", refreshingLookup.has(item.section_key) && "animate-spin")} />
                    {refreshingLookup.has(item.section_key) ? t("profile.healthPlanRefreshingSection") : t("profile.healthPlanRefreshSection")}
                  </Button>
                )}
              </div>
              {safeArray(item.reasons).slice(0, 2).map((reason, reasonIndex) => (
                <p key={`${item.section_key}-${reasonIndex}`} className="mt-1 text-sm leading-6 text-foreground/80">
                  {reason}
                </p>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function HealthPlanMetaChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-full border border-primary/10 bg-white/88 px-3.5 py-2 shadow-sm">
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

function HealthPlanChecklistItem({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2.5 text-sm leading-6 text-foreground">
      <span className="mt-1.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
        <CheckCircle2 className="h-3.5 w-3.5" />
      </span>
      <span>{text}</span>
    </div>
  );
}

function formatHealthPlanChecklistAudit(
  t: (key: string) => string,
  audit?: {
    confirmed_at?: string | null;
    confirmed_by_user_id?: string | null;
    confirmed_by_email?: string | null;
  } | null,
) {
  if (!audit) return null;
  const reviewer = audit.confirmed_by_email || audit.confirmed_by_user_id || null;
  const when = audit.confirmed_at ? formatDateTime(audit.confirmed_at) : null;
  if (reviewer && when) return `${t("profile.healthPlanChecklistConfirmedBy")} ${reviewer} · ${when}`;
  if (reviewer) return `${t("profile.healthPlanChecklistConfirmedBy")} ${reviewer}`;
  if (when) return `${t("profile.healthPlanChecklistConfirmedAt")} ${when}`;
  return null;
}

function HealthPlanReviewChecklistSummary({
  checklist,
  className,
}: {
  checklist?: unknown;
  className?: string;
}) {
  const { t } = useLanguage();
  const normalized = normalizeHealthPlanReviewChecklistState(checklist);
  const items = healthPlanReviewChecklistItems(t)
    .filter((item) => normalized[item.key])
    .map((item) => ({
      label: item.label,
      auditText: formatHealthPlanChecklistAudit(t, normalized.confirmation_audit[item.key]),
      icon: "check" as const,
    }));
  const lifeSafetyItems = Object.values(normalized.life_safety_confirmations)
    .filter((item) => item?.confirmed && item?.label)
    .map((item) => ({
      label: item.label as string,
      auditText: formatHealthPlanChecklistAudit(t, item),
      icon: "shield" as const,
    }));

  if (items.length === 0 && lifeSafetyItems.length === 0) return null;

  return (
    <div className={cn("rounded-[18px] border border-emerald-100 bg-emerald-50/70 px-4 py-4", className)}>
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-700">{t("profile.healthPlanReviewChecklistTitle")}</p>
      <div className="mt-3 space-y-2">
        {[...items, ...lifeSafetyItems].map((item) => (
          <div key={item.label} className="flex items-start gap-2.5 text-sm leading-6 text-emerald-950">
            <span className="mt-1.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white text-emerald-600 shadow-sm">
              {item.icon === "shield" ? <ShieldCheck className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            </span>
            <div>
              <span>{item.label}</span>
              {item.auditText && <p className="mt-0.5 text-xs leading-5 text-emerald-800/80">{item.auditText}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MetaItem({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4 shrink-0 text-primary" />
      <span className="min-w-0 truncate text-muted-foreground">
        {label}: <span className="text-foreground">{value}</span>
      </span>
    </div>
  );
}

function ActionButton({
  icon: Icon,
  label,
  onClick,
  tone = "secondary",
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  tone?: "primary" | "secondary" | "danger";
}) {
  return (
    <Button
      type="button"
      variant={tone === "primary" ? "default" : "outline"}
      className={cn(
        "h-11 rounded-xl px-4 text-sm font-bold",
        tone === "secondary" && "border-primary/20 bg-primary/5 text-primary hover:bg-primary/10 hover:text-primary",
        tone === "danger" && "border-red-200 bg-red-50 text-red-700 hover:bg-red-100 hover:text-red-700",
      )}
      onClick={onClick}
    >
      <Icon className="mr-2 h-4 w-4" />
      {label}
    </Button>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border/70 py-3 last:border-0">
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      <span className="max-w-[180px] text-right text-sm font-bold text-foreground">{value || "—"}</span>
    </div>
  );
}

function InfoTile({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="rounded-xl border border-border/70 bg-muted/25 px-4 py-3">
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-sm font-bold leading-5 text-foreground">{value || "-"}</p>
    </div>
  );
}

function AdminIconButton({
  label,
  onClick,
  icon: Icon = Pencil,
  danger = false,
}: {
  label: string;
  onClick: () => void;
  icon?: LucideIcon;
  danger?: boolean;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn("ml-auto h-8 w-8 rounded-full", danger ? "text-red-600 hover:bg-red-50 hover:text-red-700" : "text-muted-foreground hover:bg-primary/10 hover:text-primary")}
      onClick={onClick}
      title={label}
      aria-label={label}
    >
      <Icon className="h-4 w-4" />
    </Button>
  );
}

function ChipList({ items, emptyLabel, tone }: { items: string[]; emptyLabel: string; tone: "pink" | "primary" }) {
  if (items.length === 0) return <p className="text-sm text-muted-foreground">{emptyLabel}</p>;

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <Badge
          key={item}
          className={cn(
            "rounded-full px-3 py-1 text-xs font-semibold",
            tone === "pink" ? "bg-vyva-pink/10 text-vyva-pink" : "bg-primary/10 text-primary",
          )}
        >
          {item}
        </Badge>
      ))}
    </div>
  );
}

function EmptyLine({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-dashed border-border bg-muted/20 px-3 py-4 text-sm font-medium text-muted-foreground">
      <Icon className="h-4 w-4" />
      {label}
    </div>
  );
}

function ProviderHighlight({
  emptyLabel,
  label,
  provider,
}: {
  emptyLabel: string;
  label: string;
  provider?: OperationalCareProviderAssignment | null;
}) {
  const { t } = useLanguage();

  return (
    <div className="rounded-xl border border-border bg-muted/25 p-3">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      {provider ? (
        <div className="mt-2">
          <p className="font-semibold text-foreground">{provider.display_name || t("careProviders.unknown")}</p>
          <p className="mt-0.5 text-xs font-semibold text-muted-foreground">{provider.phone || t("profile.noPhone")}</p>
        </div>
      ) : (
        <p className="mt-2 text-sm font-medium text-muted-foreground">{emptyLabel}</p>
      )}
    </div>
  );
}

function ProviderGroup({
  title,
  providers,
  emptyLabel,
  canAssignProviders,
  showAdminControls,
  onEditCaregiver,
  onUnassign,
}: {
  title: string;
  providers: OperationalCareProviderAssignment[];
  emptyLabel: string;
  canAssignProviders: boolean;
  showAdminControls: boolean;
  onEditCaregiver?: (provider: OperationalCareProviderAssignment) => void;
  onUnassign: (assignmentId: string) => void;
}) {
  const { t } = useLanguage();

  return (
    <div className="space-y-2">
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{title}</p>
      {providers.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/20 px-3 py-4 text-sm font-medium text-muted-foreground">
          {emptyLabel}
        </div>
      ) : (
        providers.map((provider) => (
          <div key={provider.id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/25 p-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold text-foreground">{provider.display_name || t("careProviders.unknown")}</p>
                <Badge variant={provider.is_primary ? "default" : "secondary"} className="rounded-full text-[11px]">
                  {provider.is_primary ? t("careProviders.primary") : t(providerTypeKey(provider.provider_type))}
                </Badge>
              </div>
              <p className="mt-0.5 flex items-center gap-1 text-sm text-muted-foreground">
                <Phone className="h-3.5 w-3.5" />
                {provider.phone || t("profile.noPhone")}
              </p>
              {providerCoverageLabel(provider) && (
                <p className="mt-1 text-xs font-semibold text-muted-foreground">{providerCoverageLabel(provider)}</p>
              )}
            </div>
            {canAssignProviders && (
              <div className="flex gap-1">
                {showAdminControls && provider.provider_type === "caregiver" && onEditCaregiver && (
                  <AdminIconButton
                    label={t("profile.editCaregiver")}
                    onClick={() => onEditCaregiver(provider)}
                  />
                )}
                <AdminIconButton label={t("careProviders.unassign")} icon={Trash2} danger onClick={() => onUnassign(provider.id)} />
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}

function ServiceSummary({
  enabled,
  frequency,
  isPaused,
  onEdit,
  pauseSource,
  pausedUntil,
  preferredTime,
  title,
}: {
  enabled: boolean;
  frequency?: string | null;
  isPaused?: boolean;
  onEdit?: () => void;
  pauseSource?: string | null;
  pausedUntil?: string | null;
  preferredTime?: string | null;
  title: string;
}) {
  const { t } = useLanguage();
  const paused = Boolean(isPaused || (pausedUntil && new Date(pausedUntil).getTime() > Date.now()));
  const until = pausedUntil
    ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(pausedUntil))
    : null;
  const sourceKey = pauseSource ? `routineCalls.pauseSource.${pauseSource}` : "";
  const sourceLabel = sourceKey ? t(sourceKey) : "";
  const source = sourceLabel && sourceLabel !== sourceKey ? sourceLabel : "";
  const explanation = until
    ? t("routineCalls.pauseExplanation").replace("{date}", until)
    : t("routineCalls.pauseExplanationOpen");

  return (
    <div className="rounded-xl border border-border bg-muted/25 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="font-semibold text-foreground">{title}</p>
        <Badge variant={paused ? "secondary" : enabled ? "default" : "secondary"} className="rounded-full text-[11px]">
          {paused ? t("routineCalls.pausedLabel") : enabled ? t("profile.active") : t("profile.inactive")}
        </Badge>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        {frequency || t("profile.frequencyUnknown")} · {preferredTime || t("profile.timeUnknown")}
      </p>
      {paused && (
        <p className="mt-2 text-xs font-medium text-amber-700">
          {source ? `${source} · ${explanation}` : explanation}
        </p>
      )}
      {onEdit && (
        <Button variant="ghost" size="sm" className="mt-2 h-8 rounded-full px-3 text-xs text-primary hover:bg-primary/10 hover:text-primary" onClick={onEdit}>
          <Pencil className="mr-1.5 h-3.5 w-3.5" />
          {t("profile.edit")}
        </Button>
      )}
    </div>
  );
}

