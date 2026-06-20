import { useRef, useState } from "react";
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
  Copy,
  FileText,
  HeartPulse,
  MessageCircle,
  Pencil,
  Phone,
  PhoneCall,
  Pill,
  Plus,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserRound,
  Users,
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
import { toast } from "@/hooks/use-toast";
import { AssignCareProviderDialog } from "@/components/user/AssignCareProviderDialog";
import { EditCaregiverDialog } from "@/components/user/EditCaregiverDialog";
import { EditHealthDialog } from "@/components/user/EditHealthDialog";
import { EditHealthPlanDialog } from "@/components/user/EditHealthPlanDialog";
import { EditMedicationDialog } from "@/components/user/EditMedicationDialog";
import { EditSensorDialog } from "@/components/user/EditSensorDialog";
import { EditServiceDialog } from "@/components/user/EditServiceDialog";
import { EditUserDialog } from "@/components/user/EditUserDialog";
import { apiFetch } from "@/lib/apiClient";
import { authBypassEnabled } from "@/lib/authMode";
import {
  getDemoProfileById,
  type HealthPlanSectionItem,
  type HealthPlanSourceSignal,
  isDemoUserId,
  type OperationalChannel,
  type OperationalAlert,
  type OperationalCaregiver,
  type OperationalCareProviderAssignment,
  type OperationalHealthPlanApprovalGate,
  type OperationalHealthPlanCoordination,
  type OperationalHealthPlanContextSnapshot,
  type OperationalHealthPlanRegenerationFocus,
  type OperationalHealthPlanRegenerationFocusItem,
  type OperationalHealthPlanRevision,
  type OperationalMedication,
  type OperationalProfileContext,
  type OperationalProfileResponse,
  type OperationalSensor,
  type OperationalStatus,
} from "@/lib/operationalDemoData";
import { providerCoverageLabel, providerTypeKey } from "@/lib/careProviders";
import {
  buildHealthPlanHandoffNote,
  buildHealthPlanHandoffStatusNote,
  deriveHealthPlanHandoffProgress,
  deriveHealthPlanHandoff,
  parseHealthPlanHandoffNotes,
  parseHealthPlanHandoffStatusNotes,
  stripHealthPlanSystemNotes,
  type HealthPlanHandoffAction,
  type HealthPlanHandoffStatusCode,
  type HealthPlanHandoffSummary,
} from "@/lib/healthPlanHandoff";
import { deriveHealthPlanAccountability } from "@/lib/healthPlanAccountability";
import { deriveHealthPlanSafetySnapshot } from "@/lib/healthPlanSafetySnapshot";
import { deriveHealthPlanIncidentPlaybooks } from "@/lib/healthPlanIncidentPlaybooks";
import {
  buildHealthPlanIncidentEpisodeNote,
  deriveHealthPlanIncidentEpisodeSummary,
  parseHealthPlanIncidentEpisodeNotes,
  stripHealthPlanIncidentEpisodeNotes,
  type HealthPlanIncidentEpisodeStatus,
} from "@/lib/healthPlanIncidentEpisodes";
import {
  buildHealthPlanOutreachNote,
  deriveHealthPlanOutreachStatus,
  parseHealthPlanOutreachNotes,
  stripHealthPlanOutreachNotes,
  type HealthPlanOutreachAudience,
  type HealthPlanOutreachChannel,
} from "@/lib/healthPlanOutreach";
import { deriveHealthPlanDraftPack } from "@/lib/healthPlanDrafts";
import { deriveHealthPlanCommunicationPack } from "@/lib/healthPlanCommunication";
import { deriveHealthPlanShareAccess, deriveHealthPlanSharePack } from "@/lib/healthPlanSharing";
import { deriveHealthPlanAudienceBriefingsPack } from "@/lib/healthPlanAudienceBriefings";
import { deriveHealthPlanCareCircleBridge } from "@/lib/healthPlanCareCircleBridge";
import {
  buildHealthPlanConfirmationNote,
  deriveHealthPlanConfirmationStatus,
  findLatestHealthPlanConfirmationReceipt,
  parseHealthPlanConfirmationNotes,
  resolveHealthPlanConfirmationCode,
  stripHealthPlanConfirmationNotes,
  type HealthPlanConfirmationStatus,
} from "@/lib/healthPlanConfirmations";
import {
  deriveHealthPlanItemEvidenceStatus,
  deriveHealthPlanSectionProvenance,
  type HealthPlanProvenanceDriver,
  type HealthPlanProvenanceSupportLevel,
} from "@/lib/healthPlanProvenance";
import { deriveHealthPlanRecommendationRationale } from "@/lib/healthPlanRecommendationRationale";
import { deriveHealthPlanVersionDeltaBrief } from "@/lib/healthPlanVersionDelta";
import { deriveHealthPlanRecommendationConfidence } from "@/lib/healthPlanRecommendationConfidence";
import { deriveHealthPlanResponseTracker } from "@/lib/healthPlanResponseTracker";
import { deriveHealthPlanActionBrief } from "@/lib/healthPlanActionBrief";
import { deriveHealthPlanRapidResponse } from "@/lib/healthPlanRapidResponse";
import { cn } from "@/lib/utils";

type HealthPlanEditorSection =
  | "summary_text"
  | "goals_json"
  | "daily_support_json"
  | "monitoring_json"
  | "escalation_json"
  | "caregiver_guidance_json";

const healthPlanReviewConfirmationKeys = ["summary", "timing", "escalation", "sharing_boundary"] as const;
type HealthPlanReviewConfirmationKey = typeof healthPlanReviewConfirmationKeys[number];
type HealthPlanVerificationEntry = {
  code?: string | null;
  text?: string | null;
  priority?: "high" | "medium" | null;
  due_window?: "same_day" | "within_24h" | null;
  signal_ids?: string[];
};
type HealthPlanSectionCode = "summary" | "goals" | "daily_support" | "monitoring" | "escalation" | "caregiver_guidance";
type HealthPlanRecommendationDisposition = NonNullable<HealthPlanSectionItem["staff_disposition"]>;
type HealthPlanSectionField = "goals_json" | "daily_support_json" | "monitoring_json" | "escalation_json" | "caregiver_guidance_json";

const healthPlanSectionFieldMap: Record<Exclude<HealthPlanSectionCode, "summary">, HealthPlanSectionField> = {
  goals: "goals_json",
  daily_support: "daily_support_json",
  monitoring: "monitoring_json",
  escalation: "escalation_json",
  caregiver_guidance: "caregiver_guidance_json",
};

function formatDateTime(date?: string | null) {
  if (!date) return "";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleString();
}

function formatRelativeTime(date?: string | null) {
  if (!date) return "";
  const parsed = new Date(date);
  const time = parsed.getTime();
  if (Number.isNaN(time)) return "";
  const diffMinutes = Math.round((Date.now() - time) / (1000 * 60));
  const absMinutes = Math.abs(diffMinutes);
  if (absMinutes < 1) return "now";
  if (absMinutes < 60) return `${absMinutes}m ${diffMinutes >= 0 ? "ago" : "ahead"}`;
  const absHours = Math.round(absMinutes / 60);
  if (absHours < 48) return `${absHours}h ${diffMinutes >= 0 ? "ago" : "ahead"}`;
  const absDays = Math.round(absHours / 24);
  return `${absDays}d ${diffMinutes >= 0 ? "ago" : "ahead"}`;
}

function getTimestampMs(date?: string | null) {
  if (!date) return null;
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.getTime();
}

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

function safeArray<T>(value: T[] | undefined | null): T[] {
  return Array.isArray(value) ? value : [];
}

function healthPlanRecommendationDispositionClasses(disposition: HealthPlanRecommendationDisposition) {
  if (disposition === "confirmed") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (disposition === "deferred") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-red-200 bg-red-50 text-red-700";
}

function healthPlanRecommendationPriorityClasses(priority?: "high" | "medium" | "low" | null) {
  if (priority === "high") return "border-red-200 bg-red-50 text-red-700";
  if (priority === "low") return "border-slate-200 bg-slate-100 text-slate-700";
  return "border-amber-200 bg-amber-50 text-amber-700";
}

function healthPlanRecommendationFreshnessClasses(freshness?: "live" | "recent" | "stale" | "unknown" | "mixed" | null) {
  if (freshness === "live") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (freshness === "recent") return "border-sky-200 bg-sky-50 text-sky-700";
  if (freshness === "mixed") return "border-amber-200 bg-amber-50 text-amber-700";
  if (freshness === "stale") return "border-red-200 bg-red-50 text-red-700";
  return "border-slate-200 bg-slate-100 text-slate-700";
}

function healthPlanRecommendationConflictClasses(conflict?: "clear" | "conflicted" | "freshness_gap" | null) {
  if (conflict === "conflicted") return "border-red-200 bg-red-50 text-red-700";
  if (conflict === "freshness_gap") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

function defaultHealthPlanReviewConfirmations(): Record<HealthPlanReviewConfirmationKey, boolean> {
  return {
    summary: false,
    timing: false,
    escalation: false,
    sharing_boundary: false,
  };
}

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

function healthPlanSignalBadgeClasses(strength?: "high" | "medium" | "low" | null) {
  if (strength === "high") return "border-red-200 bg-red-50 text-red-700";
  if (strength === "medium") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

function healthPlanAuditToneClasses(status?: string | null) {
  if (status === "needs_regeneration") return "border-red-200 bg-red-50/90 text-red-950";
  if (status === "needs_review") return "border-amber-200 bg-amber-50/90 text-amber-950";
  return "border-emerald-200 bg-emerald-50/90 text-emerald-950";
}

function healthPlanAuditBadgeClasses(status?: string | null) {
  if (status === "needs_regeneration") return "bg-red-600 text-white hover:bg-red-600";
  if (status === "needs_review") return "bg-amber-500 text-white hover:bg-amber-500";
  return "bg-emerald-600 text-white hover:bg-emerald-600";
}

function healthPlanQualityToneClasses(level?: string | null) {
  if (level === "low") return "border-red-200 bg-red-50/90 text-red-950";
  if (level === "medium") return "border-amber-200 bg-amber-50/90 text-amber-950";
  return "border-emerald-200 bg-emerald-50/90 text-emerald-950";
}

function healthPlanQualityBadgeClasses(level?: string | null) {
  if (level === "low") return "bg-red-600 text-white hover:bg-red-600";
  if (level === "medium") return "bg-amber-500 text-white hover:bg-amber-500";
  return "bg-emerald-600 text-white hover:bg-emerald-600";
}

function healthPlanQualityCheckClasses(state?: string | null) {
  if (state === "critical") return "border-red-200 bg-red-50 text-red-800";
  if (state === "watch") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-emerald-200 bg-emerald-50 text-emerald-800";
}

function healthPlanImprovementToneClasses(status?: string | null) {
  if (status === "regressed") return "border-red-200 bg-red-50/90 text-red-950";
  if (status === "mixed") return "border-amber-200 bg-amber-50/90 text-amber-950";
  if (status === "improved") return "border-emerald-200 bg-emerald-50/90 text-emerald-950";
  return "border-slate-200 bg-slate-50/90 text-slate-950";
}

function healthPlanImprovementBadgeClasses(status?: string | null) {
  if (status === "regressed") return "bg-red-600 text-white hover:bg-red-600";
  if (status === "mixed") return "bg-amber-500 text-white hover:bg-amber-500";
  if (status === "improved") return "bg-emerald-600 text-white hover:bg-emerald-600";
  return "bg-slate-700 text-white hover:bg-slate-700";
}

function healthPlanFreshnessToneClasses(status?: string | null) {
  if (status === "stale") return "border-red-200 bg-red-50/90 text-red-950";
  if (status === "aging") return "border-amber-200 bg-amber-50/90 text-amber-950";
  if (status === "watch") return "border-slate-200 bg-slate-50/90 text-slate-950";
  return "border-emerald-200 bg-emerald-50/90 text-emerald-950";
}

function healthPlanFreshnessBadgeClasses(status?: string | null) {
  if (status === "stale") return "bg-red-600 text-white hover:bg-red-600";
  if (status === "aging") return "bg-amber-500 text-white hover:bg-amber-500";
  if (status === "watch") return "bg-slate-700 text-white hover:bg-slate-700";
  return "bg-emerald-600 text-white hover:bg-emerald-600";
}

function healthPlanReviewToneClasses(status?: string | null) {
  if (status === "hold") return "border-red-200 bg-red-50/90 text-red-950";
  if (status === "needs_review") return "border-amber-200 bg-amber-50/90 text-amber-950";
  return "border-emerald-200 bg-emerald-50/90 text-emerald-950";
}

function healthPlanReviewBadgeClasses(status?: string | null) {
  if (status === "hold") return "bg-red-600 text-white hover:bg-red-600";
  if (status === "needs_review") return "bg-amber-500 text-white hover:bg-amber-500";
  return "bg-emerald-600 text-white hover:bg-emerald-600";
}

function formatHealthPlanDelta(value?: number | null) {
  if (value == null || Number.isNaN(value)) return "-";
  const rounded = Math.round(value);
  return `${rounded > 0 ? "+" : ""}${rounded}`;
}

function deriveHealthPlanApprovalGateFallback(plan?: OperationalProfileResponse["healthPlan"] | null): OperationalHealthPlanApprovalGate | null {
  if (!plan) return null;
  if (plan.approval_gate) return plan.approval_gate;

  const audit = plan.audit;
  const review = plan.review;
  const quality = plan.quality;
  const coordination = plan.coordination;
  const blockingIssues = [
    ...safeArray(audit?.reasons).filter((item) => item?.severity === "high").map((item) => ({
      code: item.code || "audit_issue",
      detail: item.detail || null,
      source: "audit" as const,
      signal_ids: safeArray(item.signal_ids as string[]),
      priority: "high" as const,
      due_window: audit?.response_expectation || null,
    })),
    ...safeArray(review?.checks).filter((item) => item?.state === "critical").map((item) => ({
      code: item.code || "review_issue",
      detail: item.detail || null,
      source: "review" as const,
      signal_ids: [] as string[],
      priority: "high" as const,
      due_window: review?.response_expectation || null,
    })),
    ...safeArray(coordination?.commitments).filter((item) => item?.status === "open" && item?.priority === "high").map((item) => ({
      code: item.code || "coordination_issue",
      detail: item.detail || null,
      source: "coordination" as const,
      signal_ids: safeArray(item.signal_ids as string[]),
      priority: "high" as const,
      due_window: item.due_window || null,
    })),
  ];
  const watchIssues = [
    ...safeArray(audit?.reasons).filter((item) => item?.severity !== "high").map((item) => ({
      code: item.code || "audit_watch",
      detail: item.detail || null,
      source: "audit" as const,
      signal_ids: safeArray(item.signal_ids as string[]),
      priority: "medium" as const,
      due_window: audit?.response_expectation || null,
    })),
    ...safeArray(review?.checks).filter((item) => item?.state === "watch").map((item) => ({
      code: item.code || "review_watch",
      detail: item.detail || null,
      source: "review" as const,
      signal_ids: [] as string[],
      priority: "medium" as const,
      due_window: review?.response_expectation || null,
    })),
    ...safeArray(coordination?.commitments).filter((item) => item?.status === "open" && item?.priority !== "high").map((item) => ({
      code: item.code || "coordination_watch",
      detail: item.detail || null,
      source: "coordination" as const,
      signal_ids: safeArray(item.signal_ids as string[]),
      priority: (item.priority as "medium" | "low" | null) || "medium",
      due_window: item.due_window || null,
    })),
  ];
  const dedupe = <T extends { code: string }>(items: T[]) => Array.from(new Map(items.map((item) => [item.code, item])).values());
  const uniqueBlocking = dedupe(blockingIssues);
  const uniqueWatch = dedupe(watchIssues).filter((item) => !uniqueBlocking.some((blocking) => blocking.code === item.code));
  const state = uniqueBlocking.length > 0 ? "blocked" : uniqueWatch.length > 0 ? "review" : "ready";

  return {
    state,
    ready_for_approval: state === "ready" && audit?.status === "ready" && review?.status === "ready",
    ready_for_share: state === "ready" && plan.review_status === "reviewed" && quality?.trust_level !== "low" && coordination?.state === "stable",
    must_regenerate: audit?.status === "needs_regeneration",
    response_window: review?.response_expectation || audit?.response_expectation || null,
    summary_text:
      state === "blocked"
        ? "This plan still has blocking safety or coordination gaps before approval."
        : state === "review"
          ? "This plan is close, but staff should resolve the remaining follow-through items before relying on it broadly."
          : "This plan has the evidence, review, and coordination coverage needed for staff approval.",
    blocking_issue_codes: uniqueBlocking.map((item) => item.code),
    watch_issue_codes: uniqueWatch.map((item) => item.code),
    blocking_issues: uniqueBlocking,
    watch_issues: uniqueWatch,
  };
}

function deriveHealthPlanRegenerationFocusFallback(plan?: OperationalProfileResponse["healthPlan"] | null): OperationalHealthPlanRegenerationFocus | null {
  if (!plan) return null;
  if (plan.regeneration_focus) return plan.regeneration_focus;

  const approvalGate = deriveHealthPlanApprovalGateFallback(plan);
  const audit = plan.audit;
  const review = plan.review;
  const quality = plan.quality;
  const generationAssessment = plan.generation_assessment_json;
  const automatedReview = plan.automated_review_json;
  const contextSnapshot = plan.context_snapshot_json;
  const weakReviewDimensions = automatedReview?.rubric_scores
    ? [
        automatedReview.rubric_scores.actionability != null && automatedReview.rubric_scores.actionability < 60 ? "actionability" : null,
        automatedReview.rubric_scores.grounding != null && automatedReview.rubric_scores.grounding < 60 ? "grounding" : null,
        automatedReview.rubric_scores.timeliness != null && automatedReview.rubric_scores.timeliness < 60 ? "timeliness" : null,
        automatedReview.rubric_scores.safety != null && automatedReview.rubric_scores.safety < 60 ? "safety" : null,
        automatedReview.rubric_scores.shareability != null && automatedReview.rubric_scores.shareability < 60 ? "shareability" : null,
      ].filter((value): value is string => Boolean(value))
    : [];
  const focusItems: OperationalHealthPlanRegenerationFocusItem[] = [];
  const seen = new Set<string>();
  const pushItem = (item?: OperationalHealthPlanRegenerationFocusItem | null) => {
    if (!item?.code) return;
    if (seen.has(item.code)) return;
    seen.add(item.code);
    focusItems.push(item);
  };

  safeArray(approvalGate?.blocking_issues).forEach((issue) =>
    pushItem({
      code: issue.code,
      detail: issue.detail || null,
      priority: issue.priority || "high",
      source: issue.source || "approval",
      signal_ids: safeArray(issue.signal_ids),
      due_window: issue.due_window || null,
    }),
  );
  safeArray(approvalGate?.watch_issues).forEach((issue) =>
    pushItem({
      code: issue.code,
      detail: issue.detail || null,
      priority: issue.priority || "medium",
      source: issue.source || "approval",
      signal_ids: safeArray(issue.signal_ids),
      due_window: issue.due_window || null,
    }),
  );
  safeArray(audit?.reasons).forEach((reason) =>
    pushItem({
      code: reason.code,
      detail: reason.detail || null,
      priority: reason.severity || "medium",
      source: "audit",
      signal_ids: safeArray(reason.signal_ids as string[]),
    }),
  );
  safeArray(generationAssessment?.reasons).forEach((reason) =>
    pushItem({
      code: reason.code,
      detail: reason.detail || null,
      priority: reason.severity || "medium",
      source: "generation",
    }),
  );
  safeArray(automatedReview?.concerns).forEach((reason) =>
    pushItem({
      code: reason.code,
      detail: reason.detail || null,
      priority: reason.severity || "medium",
      source: "automated_review",
    }),
  );
  safeArray(automatedReview?.required_actions).slice(0, 4).forEach((detail, index) =>
    pushItem({
      code: `required_action_${index + 1}`,
      detail,
      priority: automatedReview?.verdict === "block" ? "high" : "medium",
      source: "automated_review",
    }),
  );
  safeArray(review?.next_moves).forEach((move) =>
    pushItem({
      code: move.code,
      detail: move.text || null,
      priority: move.priority || "medium",
      source: "review",
      signal_ids: safeArray(move.signal_ids),
      due_window: move.due_window || null,
    }),
  );

  const state =
    approvalGate?.must_regenerate || quality?.recommended_action === "regenerate"
      ? "regenerate"
      : approvalGate?.state === "blocked" || approvalGate?.state === "review" || quality?.recommended_action === "review" || weakReviewDimensions.length > 0
        ? "refine"
        : "ready";
  const primaryTarget = focusItems[0] || null;
  const verificationItems = [
    ...safeArray(contextSnapshot?.open_questions as OperationalHealthPlanRegenerationFocus["verification_items"]),
    ...safeArray(contextSnapshot?.next_confirmations as OperationalHealthPlanRegenerationFocus["verification_items"]),
  ].slice(0, 6);

  return {
    state,
    summary_text:
      primaryTarget?.detail
        || approvalGate?.summary_text
        || review?.next_moves?.[0]?.text
        || null,
    primary_target_code: primaryTarget?.code || null,
    primary_target_detail: primaryTarget?.detail || null,
    confidence: generationAssessment?.confidence || null,
    readiness: generationAssessment?.readiness || null,
    outcome_trajectory: quality?.outcome_trajectory || null,
    weak_review_dimensions: weakReviewDimensions,
    blocking_issue_codes: safeArray(approvalGate?.blocking_issue_codes),
    watch_issue_codes: safeArray(approvalGate?.watch_issue_codes),
    recommended_section_targets: [],
    focus_items: focusItems.slice(0, 6),
    verification_items: verificationItems,
    learning_highlights: [],
    planning_cautions: [],
    next_task_code: null,
    next_task_title: null,
  };
}

function healthPlanAutomatedReviewToneClasses(verdict?: string | null) {
  if (verdict === "block") return "border-red-200 bg-red-50/90 text-red-950";
  if (verdict === "revise") return "border-amber-200 bg-amber-50/90 text-amber-950";
  return "border-emerald-200 bg-emerald-50/90 text-emerald-950";
}

function healthPlanAutomatedReviewBadgeClasses(verdict?: string | null) {
  if (verdict === "block") return "bg-red-600 text-white hover:bg-red-600";
  if (verdict === "revise") return "bg-amber-500 text-white hover:bg-amber-500";
  return "bg-emerald-600 text-white hover:bg-emerald-600";
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

async function fetchUserProfile(id: string): Promise<OperationalProfileResponse> {
  if (isDemoUserId(id)) return getDemoProfileById(id);

  const orgName = encodeURIComponent("Red Cross");

  try {
    const response = await apiFetch<OperationalProfileResponse>(
      `/api/v1/user-dashboard/user-info?user_id=${encodeURIComponent(id)}&organization_name=${orgName}`,
    );

    if (authBypassEnabled && !response?.user) return getDemoProfileById(id);
    return response;
  } catch (error) {
    if (authBypassEnabled) return getDemoProfileById(id);
    throw error;
  }
}

function buildDemoHealthPlanHistory(id: string): OperationalHealthPlanRevision[] {
  const profile = getDemoProfileById(id);
  const plan = profile.healthPlan;
  if (!plan) return [];

  const currentRevision: OperationalHealthPlanRevision = {
    id: `${plan.id}-v${plan.current_version || 1}`,
    health_plan_id: plan.id,
    vyva_user_id: profile.user.id,
    version_number: plan.current_version || 1,
    action_type: plan.last_action_type || (plan.review_status === "reviewed" ? "reviewed" : "generated"),
    actor_email: plan.last_actor_email || plan.reviewed_by_email || null,
    actor_user_id: plan.last_actor_user_id || plan.reviewed_by_user_id || null,
    created_at: plan.last_action_at || plan.reviewed_at || plan.generated_at || plan.updated_at || null,
    language: plan.language,
    status: plan.status,
    review_status: plan.review_status,
    summary_text: plan.summary_text,
    goals_json: plan.goals_json,
    daily_support_json: plan.daily_support_json,
    monitoring_json: plan.monitoring_json,
    escalation_json: plan.escalation_json,
    caregiver_guidance_json: plan.caregiver_guidance_json,
    source_signals_json: plan.source_signals_json,
    generator_provider: plan.generator_provider,
    generator_model: plan.generator_model,
    generator_version: plan.generator_version,
    generation_confidence: plan.generation_confidence,
    generation_assessment_json: plan.generation_assessment_json,
    change_summary_json: plan.change_summary_json,
    review_valid_until: plan.review_valid_until,
    review_attestation_json: plan.review_attestation_json,
    automated_review_json: plan.automated_review_json,
    automated_reviewed_at: plan.automated_reviewed_at,
    generated_at: plan.generated_at,
    generated_by_user_id: plan.reviewed_by_user_id || null,
    reviewed_at: plan.reviewed_at,
    reviewed_by_user_id: plan.reviewed_by_user_id,
    reviewed_by_email: plan.reviewed_by_email,
  };

  return [currentRevision];
}

async function fetchHealthPlanHistory(id: string): Promise<OperationalHealthPlanRevision[]> {
  if (isDemoUserId(id)) return buildDemoHealthPlanHistory(id);
  try {
    return await apiFetch<OperationalHealthPlanRevision[]>(`/api/v1/user-dashboard/users/${encodeURIComponent(id)}/health-plan/history`);
  } catch {
    return [];
  }
}

export default function UserProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useLanguage();
  const { isAdmin } = useAdminRole();
  const copy = (key: string, values: Record<string, string | number | undefined> = {}) => interpolate(t(key), values);

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
  const [reviewHealthPlanOpen, setReviewHealthPlanOpen] = useState(false);
  const [reviewHealthPlanNote, setReviewHealthPlanNote] = useState("");
  const [reviewHealthPlanConfirmations, setReviewHealthPlanConfirmations] = useState<Record<HealthPlanReviewConfirmationKey, boolean>>(
    defaultHealthPlanReviewConfirmations(),
  );
  const [reviewHealthPlanSaving, setReviewHealthPlanSaving] = useState(false);
  const [healthPlanEditorFocus, setHealthPlanEditorFocus] = useState<HealthPlanEditorSection | null>(null);
  const [healthPlanEditorHint, setHealthPlanEditorHint] = useState<string | null>(null);
  const [healthPlanHistoryOpen, setHealthPlanHistoryOpen] = useState(false);
  const [addNoteOpen, setAddNoteOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [noteDialogHint, setNoteDialogHint] = useState<string | null>(null);
  const [savingNote, setSavingNote] = useState(false);
  const [assignProviderHint, setAssignProviderHint] = useState<string | null>(null);
  const [assignProviderRole, setAssignProviderRole] = useState<string | null>(null);
  const [assignProviderNotes, setAssignProviderNotes] = useState<string | null>(null);
  const [recordingHandoff, setRecordingHandoff] = useState(false);
  const [recordingHandoffStatus, setRecordingHandoffStatus] = useState<HealthPlanHandoffStatusCode | null>(null);
  const [loggingIncidentCode, setLoggingIncidentCode] = useState<string | null>(null);
  const [loggingIncidentStatus, setLoggingIncidentStatus] = useState<HealthPlanIncidentEpisodeStatus | null>(null);
  const [outreachChannel, setOutreachChannel] = useState<HealthPlanOutreachChannel>("phone");
  const [loggingOutreachAudience, setLoggingOutreachAudience] = useState<HealthPlanOutreachAudience | null>(null);
  const [recordingConfirmationCode, setRecordingConfirmationCode] = useState<string | null>(null);
  const [savingRecommendationKey, setSavingRecommendationKey] = useState<string | null>(null);
  const [generatingHealthPlan, setGeneratingHealthPlan] = useState(false);
  const [healthPlanError, setHealthPlanError] = useState<string | null>(null);
  const healthPlanHandoffRef = useRef<HTMLDivElement | null>(null);
  const healthPlanOutreachRef = useRef<HTMLDivElement | null>(null);
  const healthPlanReviewBoardRef = useRef<HTMLDivElement | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["vyva-user-profile", id],
    queryFn: () => fetchUserProfile(id!),
    enabled: Boolean(id),
    retry: false,
  });

  const { data: healthPlanHistory = [], isLoading: healthPlanHistoryLoading } = useQuery({
    queryKey: ["vyva-user-health-plan-history", id],
    queryFn: () => fetchHealthPlanHistory(id!),
    enabled: Boolean(id) && healthPlanHistoryOpen,
    retry: false,
  });

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
      queryClient.invalidateQueries({ queryKey: ["vyva-user-profile", id] });
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
      queryClient.invalidateQueries({ queryKey: ["vyva-user-profile", id] });
      queryClient.invalidateQueries({ queryKey: ["gis-data"] });
      queryClient.invalidateQueries({ queryKey: ["care-providers"] });
    } catch (error) {
      toast({ title: t("profile.deleteFailed"), variant: "destructive" });
    }
  };

  const handleGenerateHealthPlan = async (regenerate = false) => {
    if (!id || !data?.user) return;
    if (data.isPreviewDemo || authBypassEnabled) {
      handleOperationalAction("profile.previewNoWrite");
      return;
    }
    if (regenerate && !window.confirm(t("profile.healthPlanRegenerateConfirm"))) return;

    setGeneratingHealthPlan(true);
    setHealthPlanError(null);
    try {
      await apiFetch(`/api/v1/user-dashboard/users/${encodeURIComponent(data.user.id)}/health-plan/generate`, {
        method: "POST",
      });
      toast({ title: regenerate ? t("profile.healthPlanRegenerated") : t("profile.healthPlanGenerated") });
      await queryClient.invalidateQueries({ queryKey: ["vyva-user-profile", id] });
    } catch (error) {
      const message = error instanceof Error ? error.message : t("profile.healthPlanGenerationFailed");
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

  const handleSetRecommendationDisposition = async (
    section: Exclude<HealthPlanSectionCode, "summary">,
    itemId: string,
    disposition: HealthPlanRecommendationDisposition | null,
  ) => {
    if (!id || !data?.user || !healthPlan) return;
    if (data.isPreviewDemo || authBypassEnabled) {
      handleOperationalAction("profile.previewNoWrite");
      return;
    }

    const field = healthPlanSectionFieldMap[section];
    const currentItems = safeArray(healthPlan[field]) as HealthPlanSectionItem[];
    const nextItems = currentItems.map((item) => item.id === itemId
      ? {
        ...item,
        staff_disposition: disposition,
        ...(disposition ? {} : {
          staff_disposition_note: null,
        }),
      }
      : item);

    setSavingRecommendationKey(`${section}:${itemId}`);
    try {
      const updatedPlan = await apiFetch<OperationalProfileResponse["healthPlan"]>(
        `/api/v1/user-dashboard/users/${encodeURIComponent(data.user.id)}/health-plan`,
        {
          method: "PUT",
          body: JSON.stringify({
            [field]: nextItems,
          }),
        },
      );
      queryClient.setQueryData<OperationalProfileResponse | undefined>(["vyva-user-profile", id], (current) => (
        current ? { ...current, healthPlan: updatedPlan ?? current.healthPlan ?? null } : current
      ));
      toast({ title: t("profile.healthPlanRecommendationSaved") });
    } catch (error) {
      toast({
        title: t("profile.healthPlanRecommendationSaveFailed"),
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    } finally {
      setSavingRecommendationKey(null);
    }
  };

  const openReviewHealthPlanDialog = () => {
    setReviewHealthPlanConfirmations(defaultHealthPlanReviewConfirmations());
    setReviewHealthPlanNote("");
    setReviewHealthPlanOpen(true);
  };

  const healthPlanReviewConfirmationLabel = (key: HealthPlanReviewConfirmationKey) => {
    if (key === "summary") return t("profile.healthPlanReviewSummary");
    if (key === "timing") return t("profile.healthPlanReviewTiming");
    if (key === "escalation") return t("profile.healthPlanReviewEscalation");
    return t("profile.healthPlanReviewBoundary");
  };

  const handleMarkHealthPlanReviewed = async () => {
    if (!id || !data?.user || !healthPlan) return;
    if (data.isPreviewDemo || authBypassEnabled) {
      handleOperationalAction("profile.previewNoWrite");
      return;
    }
    if (!healthPlanReviewAllConfirmed) {
      toast({ title: t("profile.healthPlanReviewConfirmRequired"), variant: "destructive" });
      return;
    }
    if (!healthPlanApprovalGate?.ready_for_approval) {
      toast({
        title: t("profile.healthPlanMarkReviewedFailed"),
        description: healthPlanApprovalGate?.summary_text || t("profile.healthPlanApprovalGateBlockedSummary"),
        variant: "destructive",
      });
      return;
    }

    setReviewHealthPlanSaving(true);
    try {
      await apiFetch(`/api/v1/user-dashboard/users/${encodeURIComponent(data.user.id)}/health-plan`, {
        method: "PUT",
        body: JSON.stringify({
          language: healthPlan.language || user.language,
          review_status: "reviewed",
          summary_text: healthPlan.summary_text,
          goals_json: healthPlan.goals_json || [],
          daily_support_json: healthPlan.daily_support_json || [],
          monitoring_json: healthPlan.monitoring_json || [],
          escalation_json: healthPlan.escalation_json || [],
          caregiver_guidance_json: healthPlan.caregiver_guidance_json || [],
          review_attestation_json: {
            operator_confirmation_codes: healthPlanReviewConfirmationKeys.filter((key) => reviewHealthPlanConfirmations[key]),
            reviewer_note: reviewHealthPlanNote.trim() || null,
          },
        }),
      });
      toast({ title: t("profile.healthPlanMarkedReviewed") });
      setReviewHealthPlanOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["vyva-user-profile", id] });
    } catch (error) {
      toast({
        title: t("profile.healthPlanMarkReviewedFailed"),
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    } finally {
      setReviewHealthPlanSaving(false);
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
  const health = data.health ?? null;
  const medications = safeArray(data.medications);
  const caregivers = safeArray(data.caregivers);
  const careProviders = safeArray(data.careProviders).length
    ? safeArray(data.careProviders)
    : caregivers.map(providerFromCaregiver);
  const emergencyContacts = careProviders.filter((provider) => provider.provider_type === "caregiver");
  const redCrossStaffProviders = careProviders.filter((provider) => provider.provider_type === "field_staff");
  const primaryCaregiver = careProviders.find((provider) => provider.provider_type === "caregiver" && provider.is_primary) ?? careProviders.find((provider) => provider.provider_type === "caregiver") ?? null;
  const primaryProfessional = careProviders.find((provider) => provider.provider_type === "field_staff" && provider.is_primary) ?? careProviders.find((provider) => provider.provider_type === "field_staff") ?? null;
  const additionalEmergencyContacts = emergencyContacts.filter((provider) => provider.id !== primaryCaregiver?.id);
  const sensors = safeArray(data.sensors);
  const alerts = safeArray(data.alerts);
  const checkins = data.checkins ?? null;
  const brainCoach = data.brainCoach ?? null;
  const medicationActivity = data.medicationActivity ?? null;
  const healthPlan = data.healthPlan ?? null;
  const isPreviewDemo = Boolean(data.isPreviewDemo);
  const openAddNoteDialog = (draft = "", hint?: string | null) => {
    setNoteDraft(draft);
    setNoteDialogHint(hint ?? null);
    setAddNoteOpen(true);
  };
  const openAssignProviderDialog = (role?: string | null, notes?: string | null, hint?: string | null) => {
    setAssignProviderRole(role ?? null);
    setAssignProviderNotes(notes ?? null);
    setAssignProviderHint(hint ?? null);
    setAssignProviderOpen(true);
  };
  const handleAssignProviderOpenChange = (open: boolean) => {
    setAssignProviderOpen(open);
    if (!open) {
      setAssignProviderRole(null);
      setAssignProviderNotes(null);
      setAssignProviderHint(null);
    }
  };
  const openHealthPlanEditor = (section?: HealthPlanEditorSection | null, hint?: string | null) => {
    setHealthPlanEditorFocus(section ?? null);
    setHealthPlanEditorHint(hint ?? null);
    setEditHealthPlanOpen(true);
  };
  const handleHealthPlanEditorOpenChange = (open: boolean) => {
    setEditHealthPlanOpen(open);
    if (!open) {
      setHealthPlanEditorFocus(null);
      setHealthPlanEditorHint(null);
    }
  };
  const handleAddNoteOpenChange = (open: boolean) => {
    if (savingNote) return;
    setAddNoteOpen(open);
    if (!open) {
      setNoteDialogHint(null);
      setNoteDraft("");
    }
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
        queryClient.invalidateQueries({ queryKey: ["vyva-user-profile", id] }),
        queryClient.invalidateQueries({ queryKey: ["gis-data"] }),
      ]);
    } catch {
      toast({ title: t("profile.noteSaveFailed"), variant: "destructive" });
    } finally {
      setSavingNote(false);
    }
  };

  const fullName = `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim() || t("profile.unknownPerson");
  const firstName = String(user.first_name ?? fullName.split(" ")[0] ?? t("profile.unknownPerson"));
  const activeAlerts = alerts.filter((alert) => !alert.resolved_at);
  const criticalAlerts = activeAlerts.filter((alert) => alert.severity === "critical").length;
  const warningAlerts = activeAlerts.filter((alert) => alert.severity === "warning").length;
  const healthConditions = safeArray<string>(health?.health_conditions);
  const mobilityNeeds = safeArray<string>(health?.mobility_needs);
  const context: OperationalProfileContext = {
    age: getAge(user.date_of_birth),
    assignedTo: null,
    familyConsentKey: data.consent?.consent_given ? "profile.familyConsentActive" : "profile.familyConsentUnknown",
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
    ...data.operationalContext,
  };

  const age = context.age ?? getAge(user.date_of_birth);
  const ChannelIcon = channelIcon(context.preferredChannel);
  const address = [user.street, user.house_number, user.post_code, user.city].filter(Boolean).join(" ");
  const assignedProviderLabel = context.assignedTo ?? primaryProfessional?.display_name ?? primaryCaregiver?.display_name ?? null;
  const healthScore = Math.max(0, Math.min(100, 100 - criticalAlerts * 20 - warningAlerts * 10 - healthConditions.length * 4));
  const services = [
    { key: "profile.service.checkins", active: Boolean(checkins?.enabled), icon: PhoneCall },
    { key: "profile.service.brainCoach", active: Boolean(brainCoach?.enabled), icon: Brain },
    { key: "profile.service.medications", active: medications.length > 0, icon: Pill },
    { key: "profile.service.caregivers", active: careProviders.length > 0, icon: Users },
    { key: "profile.service.sensors", active: sensors.length > 0, icon: Activity },
    { key: "profile.service.consent", active: Boolean(data.consent?.consent_given), icon: ShieldCheck },
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
    const latestHandoff = parseHealthPlanHandoffNotes(user.emergency_notes)
      .slice()
      .sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime())[0] || null;
    const latestStatusEvents = parseHealthPlanHandoffStatusNotes(user.emergency_notes)
      .slice()
      .sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime())
      .slice(0, 3);
    const latestOutreachEvents = parseHealthPlanOutreachNotes(user.emergency_notes)
      .slice()
      .sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime())
      .slice(0, 3);
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
    if (data.consent) {
      events.push({
        date: recordDate(data.consent, ["updated_at", "created_at"]) || user.created_at,
        label: t(data.consent.consent_given ? "profile.timeline.consentActive" : "profile.timeline.consentMissing"),
        detail: t("profile.timeline.consentDetail"),
        tone: data.consent.consent_given ? "teal" : "orange",
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
    if (latestHandoff?.timestamp) {
      events.push({
        date: latestHandoff.timestamp,
        label: t("profile.timeline.handoffRecorded"),
        detail: [
          latestHandoff.handoff.responseWindow === "same_day" ? t("profile.healthPlanHandoffResponseSameDay") : t("profile.healthPlanHandoffResponse24h"),
          latestHandoff.handoff.ownerMissing ? t("profile.healthPlanHandoffOwnerMissing") : latestHandoff.handoff.ownerName,
        ].filter(Boolean).join(" - "),
        tone: latestHandoff.handoff.priority === "high" ? "teal" : "primary",
        icon: ShieldCheck,
      });
    }
    latestStatusEvents.forEach((entry) => {
      events.push({
        date: entry.timestamp,
        label:
          entry.status === "owner_assigned"
            ? t("profile.timeline.handoffOwnerAssigned")
            : entry.status === "first_contact_made"
              ? t("profile.timeline.handoffFirstContact")
              : t("profile.timeline.handoffEscalationClosed"),
        detail:
          entry.status === "owner_assigned"
            ? entry.ownerName || t("profile.healthPlanHandoffOwnerMissing")
            : entry.responseWindow === "same_day"
              ? t("profile.healthPlanHandoffResponseSameDay")
              : t("profile.healthPlanHandoffResponse24h"),
        tone: "teal",
        icon: CheckCircle2,
      });
    });
    latestOutreachEvents.forEach((entry) => {
      events.push({
        date: entry.timestamp,
        label: entry.audience === "client" ? t("profile.timeline.outreachClientShared") : t("profile.timeline.outreachCareCircleShared"),
        detail: [
          entry.channel === "whatsapp"
            ? t("profile.channel.whatsApp")
            : entry.channel === "app"
              ? t("profile.channel.app")
              : entry.channel === "in_person"
                ? t("profile.healthPlanOutreachChannelInPerson")
                : t("profile.channel.phone"),
          entry.state === "hold"
            ? t("profile.healthPlanCommunicationHold")
            : entry.state === "review"
              ? t("profile.healthPlanCommunicationReview")
              : t("profile.healthPlanCommunicationReady"),
        ].filter(Boolean).join(" - "),
        tone: entry.audience === "client" ? "primary" : "teal",
        icon: MessageCircle,
      });
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
  const healthPlanAudit = healthPlan?.audit || null;
  const healthPlanReview = healthPlan?.review || null;
  const healthPlanQuality = healthPlan?.quality || null;
  const healthPlanTrustSummary = healthPlanQuality?.trust_summary || null;
  const healthPlanRegenerationFocus = healthPlan ? deriveHealthPlanRegenerationFocusFallback(healthPlan) : null;
  const healthPlanReviewValidUntil = healthPlan?.review_valid_until || healthPlanAudit?.review_valid_until || null;
  const healthPlanReviewExpired = Boolean(
    healthPlanReviewValidUntil
    && !Number.isNaN(new Date(healthPlanReviewValidUntil).getTime())
    && new Date(healthPlanReviewValidUntil).getTime() < Date.now(),
  );
  const healthPlanGenerationAssessment = healthPlan?.generation_assessment_json || null;
  const healthPlanSignals = safeArray(healthPlan?.source_signals_json);
  const healthPlanSignalLookup = new Map(
    healthPlanSignals
      .map((signal) => [signal.id || signal.label || "", signal] as const)
      .filter(([key]) => Boolean(key)),
  );
  const healthPlanContextSnapshot = healthPlan?.context_snapshot_json || null;
  const healthPlanKnownFacts = safeArray(healthPlanContextSnapshot?.known_facts as HealthPlanVerificationEntry[]);
  const healthPlanOpenQuestions = safeArray(healthPlanContextSnapshot?.open_questions as HealthPlanVerificationEntry[]);
  const healthPlanNextConfirmations = safeArray(healthPlanContextSnapshot?.next_confirmations as HealthPlanVerificationEntry[]);
  const healthPlanSummaryProvenance = deriveHealthPlanSectionProvenance({
    section: "summary",
    signals: healthPlanSignals,
    contextSnapshot: healthPlanContextSnapshot as OperationalHealthPlanContextSnapshot | null,
  });
  const healthPlanGoalsProvenance = deriveHealthPlanSectionProvenance({
    section: "goals",
    items: healthPlan?.goals_json,
    signals: healthPlanSignals,
  });
  const healthPlanDailySupportProvenance = deriveHealthPlanSectionProvenance({
    section: "daily_support",
    items: healthPlan?.daily_support_json,
    signals: healthPlanSignals,
  });
  const healthPlanMonitoringProvenance = deriveHealthPlanSectionProvenance({
    section: "monitoring",
    items: healthPlan?.monitoring_json,
    signals: healthPlanSignals,
  });
  const healthPlanEscalationProvenance = deriveHealthPlanSectionProvenance({
    section: "escalation",
    items: healthPlan?.escalation_json,
    signals: healthPlanSignals,
  });
  const healthPlanCaregiverGuidanceProvenance = deriveHealthPlanSectionProvenance({
    section: "caregiver_guidance",
    items: healthPlan?.caregiver_guidance_json,
    signals: healthPlanSignals,
  });
  const healthPlanVerificationVisible =
    healthPlanKnownFacts.length > 0 || healthPlanOpenQuestions.length > 0 || healthPlanNextConfirmations.length > 0;
  const healthPlanUsesFallback = healthPlan?.generator_provider === "fallback";
  const healthPlanHighPrioritySignals = healthPlanSignals.filter((signal) => inferHealthPlanSignalStrength(signal) === "high").length;
  const healthPlanEvidenceDigest = healthPlanContextSnapshot?.evidence_digest as Record<string, unknown> | null | undefined;
  const healthPlanFreshLiveSignals = Array.isArray(healthPlanEvidenceDigest?.live_signal_ids) ? healthPlanEvidenceDigest.live_signal_ids.length : 0;
  const healthPlanStaleSignals = Array.isArray(healthPlanEvidenceDigest?.stale_signal_ids) ? healthPlanEvidenceDigest.stale_signal_ids.length : 0;
  const healthPlanUnknownFreshnessSignals = Array.isArray(healthPlanEvidenceDigest?.unknown_freshness_signal_ids) ? healthPlanEvidenceDigest.unknown_freshness_signal_ids.length : 0;
  const healthPlanAuditReasons = safeArray(healthPlanAudit?.reasons).slice(0, 3);
  const healthPlanReviewChecks = safeArray(healthPlanReview?.checks);
  const healthPlanReviewStrengths = healthPlanReviewChecks.filter((item) => item.state === "good").slice(0, 3);
  const healthPlanReviewFocus = healthPlanReviewChecks.filter((item) => item.state !== "good").slice(0, 4);
  const healthPlanReviewNextMoves = safeArray(healthPlanReview?.next_moves).slice(0, 4);
  const healthPlanReviewAllConfirmed = healthPlanReviewConfirmationKeys.every((key) => reviewHealthPlanConfirmations[key]);
  const healthPlanReviewAttestation = healthPlan?.review_attestation_json || null;
  const healthPlanAutomatedReview = healthPlan?.automated_review_json || null;
  const healthPlanApprovalGate = deriveHealthPlanApprovalGateFallback(healthPlan);
  const healthPlanCoordination = healthPlan?.coordination || null;
  const healthPlanExecutionPack = healthPlan?.execution_pack || null;
  const healthPlanImprovementSummary = healthPlanQuality?.improvement_summary || null;
  const healthPlanFreshnessDecay = healthPlanQuality?.freshness_decay || null;
  const healthPlanReadyWithJudgmentRecommendations = Number(healthPlanQuality?.recommendation_use_ready_with_judgment_count || 0);
  const healthPlanVerifyBeforeUseRecommendations = Number(
    healthPlanQuality?.recommendation_use_verify_before_use_count
    ?? healthPlanTrustSummary?.recommendation_use_verify_before_use_count
    ?? 0,
  );
  const healthPlanStaffReviewOnlyRecommendations = Number(
    healthPlanQuality?.recommendation_use_staff_review_only_count
    ?? healthPlanTrustSummary?.recommendation_use_staff_review_only_count
    ?? 0,
  );
  const healthPlanUrgentStaffReviewOnlyRecommendations = Number(healthPlanQuality?.urgent_recommendation_staff_review_only_count || 0);
  const healthPlanRecommendationUseTotal =
    healthPlanReadyWithJudgmentRecommendations
    + healthPlanVerifyBeforeUseRecommendations
    + healthPlanStaffReviewOnlyRecommendations;
  const healthPlanTimedRecommendationChecks = Number(healthPlanFreshnessDecay?.recommendation_timed_item_count || 0);
  const healthPlanDueSoonRecommendationChecks = Number(healthPlanFreshnessDecay?.recommendation_due_soon_count || 0);
  const healthPlanOverdueRecommendationChecks = Number(healthPlanFreshnessDecay?.recommendation_overdue_count || 0);
  const healthPlanSameDayOverdueRecommendationChecks = Number(healthPlanFreshnessDecay?.recommendation_overdue_same_day_count || 0);
  const healthPlanFreshnessBoundaryActive =
    Boolean(healthPlanFreshnessDecay?.requires_refresh)
    || healthPlanDueSoonRecommendationChecks > 0
    || healthPlanOverdueRecommendationChecks > 0;
  const healthPlanVersionDelta = healthPlan ? deriveHealthPlanVersionDeltaBrief(healthPlan) : null;
  const healthPlanApprovalBlockingIssues = safeArray(healthPlanApprovalGate?.blocking_issues).slice(0, 4);
  const healthPlanApprovalWatchIssues = safeArray(healthPlanApprovalGate?.watch_issues).slice(0, 4);
  const healthPlanReviewCanApprove = healthPlanReviewAllConfirmed && Boolean(healthPlanApprovalGate?.ready_for_approval);
  const healthPlanReviewConfirmedItems = safeArray(healthPlanReviewAttestation?.operator_confirmation_codes as string[])
    .filter((code): code is HealthPlanReviewConfirmationKey =>
      healthPlanReviewConfirmationKeys.includes(code as HealthPlanReviewConfirmationKey),
    );
  const healthPlanGenerationReasons = safeArray(healthPlanGenerationAssessment?.reasons).slice(0, 3);
  const healthPlanTrustBoundaryState = healthPlanTrustSummary?.state
    || (healthPlanUsesFallback
      ? "do_not_share"
      : healthPlanGenerationAssessment?.confidence === "low"
        ? "staff_review_only"
        : "ready_to_share");
  const healthPlanNeedsTrustBoundary =
    healthPlanTrustBoundaryState !== "ready_to_share"
    || healthPlanGenerationAssessment?.trust_gate_state === "review_only"
    || healthPlanGenerationAssessment?.trust_gate_state === "fallback_only"
    || healthPlanUsesFallback
    || healthPlanGenerationAssessment?.confidence === "low"
    || healthPlanGenerationReasons.length > 0
    || healthPlanNextConfirmations.length > 0
    || healthPlanFreshnessBoundaryActive;
  const healthPlanTrustBoundaryReasons = [
    ...healthPlanGenerationReasons.slice(0, 4),
    ...(healthPlanFreshnessBoundaryActive
      ? [{
          code: "freshness_decay",
          detail: healthPlanFreshnessDecay?.summary_text || t("profile.healthPlanQualityFreshnessSummaryFallback"),
        }]
      : []),
  ].slice(0, 4);
  const healthPlanTrustBoundaryConfirmations = [
    ...(healthPlanOverdueRecommendationChecks > 0
      ? [{
          code: "recommendation_rechecks_overdue",
          text: copy("profile.healthPlanTrustBoundaryRecheckOverdue", { count: healthPlanOverdueRecommendationChecks }),
          due_window: healthPlanSameDayOverdueRecommendationChecks > 0 ? "same_day" : "within_24h",
        } satisfies HealthPlanVerificationEntry]
      : healthPlanDueSoonRecommendationChecks > 0
        ? [{
            code: "recommendation_rechecks_due_soon",
            text: copy("profile.healthPlanTrustBoundaryRecheckDueSoon", { count: healthPlanDueSoonRecommendationChecks }),
            due_window: healthPlanFreshnessDecay?.response_expectation === "same_day" ? "same_day" : "within_24h",
          } satisfies HealthPlanVerificationEntry]
        : []),
    ...healthPlanNextConfirmations,
  ].slice(0, 3);
  const healthPlanTrustBoundaryReasonItems = (() => {
    const items = new Map<string, { code?: string | null; detail?: string | null }>();
    healthPlanTrustBoundaryReasons.forEach((item, index) => {
      const key = item.code || `detail-${index}`;
      if (!items.has(key)) items.set(key, item);
    });
    safeArray(healthPlanTrustSummary?.reason_codes).forEach((code) => {
      if (!items.has(code)) items.set(code, { code });
    });
    return Array.from(items.values()).slice(0, 4);
  })();
  const healthPlanTrustBoundaryHeadline = healthPlanTrustSummary?.headline
    || (healthPlanTrustBoundaryState === "do_not_share"
      ? t("profile.healthPlanTrustBoundaryStateDoNotShare")
      : t("profile.healthPlanTrustBoundaryStateReviewOnly"));
  const healthPlanTrustBoundaryDetail = healthPlanTrustSummary?.detail
    || (healthPlanUsesFallback ? t("profile.healthPlanFallbackSummary") : t("profile.healthPlanTrustBoundarySummary"));
  const healthPlanTrustBoundaryNextAction = healthPlanTrustSummary?.next_action_text || healthPlanTrustBoundaryConfirmations[0]?.text || null;
  const healthPlanAutomatedReviewSignals = safeArray(healthPlanAutomatedReview?.grounded_signal_ids)
    .map((signalId) => healthPlanSignalLookup.get(signalId))
    .filter(Boolean)
    .slice(0, 4);
  const healthPlanAutomatedReviewStrengths = safeArray(healthPlanAutomatedReview?.strengths).slice(0, 3);
  const healthPlanAutomatedReviewConcerns = safeArray(healthPlanAutomatedReview?.concerns).slice(0, 4);
  const healthPlanAutomatedReviewActions = safeArray(healthPlanAutomatedReview?.required_actions).slice(0, 4);
  const healthPlanQualityStrengths = safeArray(healthPlanQuality?.strengths).slice(0, 4);
  const healthPlanQualityCautions = safeArray(healthPlanQuality?.cautions).slice(0, 4);
  const healthPlanFocusItems = safeArray(healthPlanRegenerationFocus?.focus_items).slice(0, 4);
  const healthPlanFocusVerificationItems = safeArray(healthPlanRegenerationFocus?.verification_items).slice(0, 4);
  const healthPlanFocusLearningHighlights = safeArray(healthPlanRegenerationFocus?.learning_highlights).slice(0, 3);
  const healthPlanFocusPlanningCautions = safeArray(healthPlanRegenerationFocus?.planning_cautions).slice(0, 3);
  const healthPlanFocusWeakDimensions = safeArray(healthPlanRegenerationFocus?.weak_review_dimensions).slice(0, 4);
  const healthPlanEvidenceLinkedCount = healthPlan
    ? [
        ...safeArray(healthPlan.goals_json),
        ...safeArray(healthPlan.daily_support_json),
        ...safeArray(healthPlan.monitoring_json),
        ...safeArray(healthPlan.escalation_json),
        ...safeArray(healthPlan.caregiver_guidance_json),
        ].filter((item) => safeArray(item.source_signal_ids).length > 0).length
    : 0;
  const healthPlanHandoff = healthPlan
    ? deriveHealthPlanHandoff({
        alerts: data.alerts,
        brainCoach: data.brainCoach,
        careProviders: data.careProviders,
        checkins: data.checkins,
        consent: data.consent,
        healthPlan,
        medicationActivity: data.medicationActivity,
        sensors: data.sensors,
      })
    : null;
  const healthPlanSharePack = healthPlan
    ? deriveHealthPlanSharePack(
        {
          consent: data.consent,
          healthPlan,
        },
        healthPlanHandoff,
      )
    : null;
  const healthPlanCommunicationPack = healthPlan
    ? deriveHealthPlanCommunicationPack(
        {
          healthPlan,
        },
        healthPlanSharePack,
        healthPlanHandoff,
      )
    : null;
  const healthPlanAudienceBriefingsPack = deriveHealthPlanAudienceBriefingsPack({
    communicationPack: healthPlanCommunicationPack,
    sharePack: healthPlanSharePack,
    nextConfirmations: healthPlanNextConfirmations,
    openQuestions: healthPlanOpenQuestions,
    responseWindow: healthPlanHandoff?.responseWindow || null,
  });
  const healthPlanDraftPack = healthPlan
    ? deriveHealthPlanDraftPack({
        firstName,
        language: healthPlan.language || user.language || "en",
        communicationPack: healthPlanCommunicationPack,
        sharePack: healthPlanSharePack,
        handoff: healthPlanHandoff,
      })
    : null;
  const healthPlanShareAccess = deriveHealthPlanShareAccess(healthPlanSharePack);
  const canShareHealthPlanWithClient = healthPlanShareAccess.canShareWithClient;
  const canShareHealthPlanWithCareCircle = healthPlanShareAccess.canShareWithCareCircle;
  const handoffNotes = parseHealthPlanHandoffNotes(user.emergency_notes);
  const handoffStatusNotes = parseHealthPlanHandoffStatusNotes(user.emergency_notes);
  const incidentEpisodeNotes = parseHealthPlanIncidentEpisodeNotes(user.emergency_notes);
  const outreachNotes = parseHealthPlanOutreachNotes(user.emergency_notes);
  const confirmationNotes = parseHealthPlanConfirmationNotes(user.emergency_notes);
  const handoffProgress = deriveHealthPlanHandoffProgress(handoffStatusNotes);
  const outreachStatus = deriveHealthPlanOutreachStatus(outreachNotes);
  const healthPlanConfirmationStatuses = deriveHealthPlanConfirmationStatus(healthPlanNextConfirmations, confirmationNotes);
  const healthPlanConfirmationStatusByCode = new Map(
    healthPlanConfirmationStatuses.map((entry) => [entry.code, entry] as const),
  );
  const healthPlanLatestConfirmation = findLatestHealthPlanConfirmationReceipt(healthPlanConfirmationStatuses);
  const healthPlanResponseTracker = healthPlan
    ? deriveHealthPlanResponseTracker({
        healthPlan,
        handoff: healthPlanHandoff,
        progress: handoffProgress,
        outreachStatus,
        sharePack: healthPlanSharePack,
      })
    : null;
  const healthPlanSafetySnapshot = healthPlan
    ? deriveHealthPlanSafetySnapshot({
        healthPlan,
        handoff: healthPlanHandoff,
        sharePack: healthPlanSharePack,
        alerts: data.alerts,
      })
    : null;
  const healthPlanRapidResponse = healthPlan
    ? deriveHealthPlanRapidResponse({
        user,
        preferredChannel: context.preferredChannel,
        consent: data.consent,
        caregivers: data.caregivers,
        careProviders: data.careProviders,
        handoff: healthPlanHandoff,
      })
    : null;
  const healthPlanIncidentPlaybooks = healthPlan
    ? deriveHealthPlanIncidentPlaybooks({
        healthPlan,
        handoff: healthPlanHandoff,
        progress: handoffProgress,
        outreachStatus,
      })
    : [];
  const healthPlanAccountability = healthPlan
    ? deriveHealthPlanAccountability({
        healthPlan,
        handoff: healthPlanHandoff,
        progress: handoffProgress,
        handoffNotes,
        handoffStatusEntries: handoffStatusNotes,
        outreachStatus,
        outreachEntries: outreachNotes,
        sharePack: healthPlanSharePack,
      })
    : null;
  const healthPlanActionBrief = healthPlan
    ? deriveHealthPlanActionBrief({
        healthPlan,
        coordination: healthPlanCoordination,
        responseTracker: healthPlanResponseTracker,
        accountability: healthPlanAccountability,
        sharePack: healthPlanSharePack,
        communicationPack: healthPlanCommunicationPack,
        incidentPlaybooks: healthPlanIncidentPlaybooks,
      })
    : null;
  const healthPlanCareCircleBridge = deriveHealthPlanCareCircleBridge({
    handoff: healthPlanHandoff,
    accountability: healthPlanAccountability,
    sharePack: healthPlanSharePack,
    audienceBriefings: healthPlanAudienceBriefingsPack,
    nextConfirmations: healthPlanNextConfirmations,
    confirmationStatuses: healthPlanConfirmationStatuses,
    openQuestions: healthPlanOpenQuestions,
  });
  const healthPlanCareCircleLatestMovement =
    (getTimestampMs(healthPlanLatestConfirmation?.timestamp) ?? -Infinity) > (getTimestampMs(healthPlanAccountability?.lastMovementAt) ?? -Infinity)
      ? healthPlanLatestConfirmation
      : null;
  const healthPlanCareCircleVerifiedAt =
    healthPlanCareCircleLatestMovement?.timestamp
    || healthPlanAccountability?.lastMovementAt
    || healthPlanReviewAttestation?.checked_at
    || healthPlan?.reviewed_at
    || healthPlan?.generated_at
    || null;
  const healthPlanCareCircleVerifiedBy =
    healthPlanCareCircleLatestMovement?.author
    || healthPlanAccountability?.lastMovementBy
    || healthPlanReviewedBy
    || null;
  const healthPlanCareCirclePendingReceiptCode =
    safeArray(healthPlanAccountability?.receipts).find((receipt) => receipt?.status === "pending")?.code || null;
  const healthPlanCareCirclePendingConfirmation =
    healthPlanConfirmationStatuses.find((entry) => !entry.confirmed) || null;
  const healthPlanExecutionTasks = safeArray(healthPlanExecutionPack?.tasks);
  const healthPlanExecutionNextTask = healthPlanExecutionPack?.next_task_code
    ? healthPlanExecutionTasks.find((task) => task.code === healthPlanExecutionPack.next_task_code) || healthPlanExecutionTasks[0]
    : healthPlanExecutionTasks[0];
  const healthPlanIncidentEpisodeSummary = deriveHealthPlanIncidentEpisodeSummary(
    healthPlanIncidentPlaybooks,
    incidentEpisodeNotes,
  );
  const healthPlanIncidentEpisodeSummaryByCode = new Map(
    healthPlanIncidentEpisodeSummary.map((item) => [item.code, item]),
  );
  const latestHandoffNote = handoffNotes
    .slice()
    .sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime())[0] || null;
  const visibleCareNotes = stripHealthPlanConfirmationNotes(
    stripHealthPlanOutreachNotes(stripHealthPlanIncidentEpisodeNotes(stripHealthPlanSystemNotes(user.emergency_notes))),
  );
  const reviewBoardNeedsAction = (healthPlanReview?.status || "") !== "ready";

  const scrollToPanel = (ref: { current: HTMLDivElement | null }) => {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleLogHealthPlanOutreach = async (audience: HealthPlanOutreachAudience) => {
    if (!id || !data?.user || !healthPlanCommunicationPack) return;
    if (isPreviewDemo || authBypassEnabled) {
      handleOperationalAction("profile.previewNoWrite");
      return;
    }
    if (audience === "client" && !canShareHealthPlanWithClient) {
      toast({ title: t("profile.healthPlanOutreachBlockedReview"), variant: "destructive" });
      return;
    }
    if (audience === "care_circle" && !canShareHealthPlanWithCareCircle) {
      toast({
        title:
          healthPlanShareAccess.careCircleBlockedReason === "consent_required"
            ? t("profile.healthPlanOutreachBlockedConsent")
            : t("profile.healthPlanOutreachBlockedReview"),
        variant: "destructive",
      });
      return;
    }

    setLoggingOutreachAudience(audience);
    try {
      await apiFetch(`/api/v1/user-dashboard/users/${user.id}/notes`, {
        method: "POST",
        body: JSON.stringify({
          note: buildHealthPlanOutreachNote(audience, outreachChannel, healthPlanCommunicationPack),
        }),
      });
      toast({
        title: audience === "client" ? t("profile.healthPlanOutreachClientLogged") : t("profile.healthPlanOutreachCareCircleLogged"),
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["vyva-user-profile", id] }),
        queryClient.invalidateQueries({ queryKey: ["gis-data"] }),
      ]);
    } catch (error) {
      toast({
        title: t("profile.healthPlanOutreachLogFailed"),
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    } finally {
      setLoggingOutreachAudience(null);
    }
  };

  const handleRecordHealthPlanConfirmation = async (item: HealthPlanVerificationEntry | HealthPlanConfirmationStatus) => {
    if (!id || !data?.user) return;
    const confirmationCode = resolveHealthPlanConfirmationCode(item);
    if (!confirmationCode) return;
    if (isPreviewDemo || authBypassEnabled) {
      handleOperationalAction("profile.previewNoWrite");
      return;
    }

    setRecordingConfirmationCode(confirmationCode);
    try {
      await apiFetch(`/api/v1/user-dashboard/users/${user.id}/notes`, {
        method: "POST",
        body: JSON.stringify({
          note: buildHealthPlanConfirmationNote({
            code: item.code,
            text: item.text,
            priority: item.priority,
            due_window: "dueWindow" in item ? item.dueWindow : item.due_window,
          }),
        }),
      });
      toast({ title: t("profile.healthPlanConfirmationRecorded") });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["vyva-user-profile", id] }),
        queryClient.invalidateQueries({ queryKey: ["gis-data"] }),
      ]);
    } catch (error) {
      toast({
        title: t("profile.healthPlanConfirmationRecordFailed"),
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    } finally {
      setRecordingConfirmationCode(null);
    }
  };

  const handleRecordHealthPlanHandoff = async () => {
    if (!id || !data?.user || !healthPlanHandoff) return;
    if (isPreviewDemo || authBypassEnabled) {
      handleOperationalAction("profile.previewNoWrite");
      return;
    }

    setRecordingHandoff(true);
    try {
      await apiFetch(`/api/v1/user-dashboard/users/${user.id}/notes`, {
        method: "POST",
        body: JSON.stringify({ note: buildHealthPlanHandoffNote(healthPlanHandoff) }),
      });
      toast({ title: t("profile.healthPlanHandoffRecorded") });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["vyva-user-profile", id] }),
        queryClient.invalidateQueries({ queryKey: ["gis-data"] }),
      ]);
    } catch (error) {
      toast({
        title: t("profile.healthPlanHandoffRecordFailed"),
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    } finally {
      setRecordingHandoff(false);
    }
  };

  const handleRecordHealthPlanHandoffStatus = async (status: HealthPlanHandoffStatusCode) => {
    if (!id || !data?.user || !healthPlanHandoff) return;
    if (isPreviewDemo || authBypassEnabled) {
      handleOperationalAction("profile.previewNoWrite");
      return;
    }

    setRecordingHandoffStatus(status);
    try {
      await apiFetch(`/api/v1/user-dashboard/users/${user.id}/notes`, {
        method: "POST",
        body: JSON.stringify({ note: buildHealthPlanHandoffStatusNote(status, healthPlanHandoff) }),
      });
      toast({ title: t("profile.healthPlanHandoffStatusRecorded") });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["vyva-user-profile", id] }),
        queryClient.invalidateQueries({ queryKey: ["gis-data"] }),
      ]);
    } catch (error) {
      toast({
        title: t("profile.healthPlanHandoffStatusRecordFailed"),
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    } finally {
      setRecordingHandoffStatus(null);
    }
  };
  const handleLogHealthPlanIncidentEpisode = async (
    code: "urgent_welfare_check" | "medication_recovery" | "sensor_fallback",
    status: HealthPlanIncidentEpisodeStatus,
  ) => {
    if (!id || !data?.user || !healthPlanHandoff) return;
    if (isPreviewDemo || authBypassEnabled) {
      handleOperationalAction("profile.previewNoWrite");
      return;
    }

    setLoggingIncidentCode(code);
    setLoggingIncidentStatus(status);
    try {
      await apiFetch(`/api/v1/user-dashboard/users/${user.id}/notes`, {
        method: "POST",
        body: JSON.stringify({ note: buildHealthPlanIncidentEpisodeNote(code, status, healthPlanHandoff) }),
      });
      toast({
        title: status === "open" ? t("profile.healthPlanIncidentStarted") : t("profile.healthPlanIncidentClosed"),
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["vyva-user-profile", id] }),
        queryClient.invalidateQueries({ queryKey: ["gis-data"] }),
      ]);
    } catch (error) {
      toast({
        title: t("profile.healthPlanIncidentLogFailed"),
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    } finally {
      setLoggingIncidentCode(null);
      setLoggingIncidentStatus(null);
    }
  };

  const healthPlanTargetedActionLabel = (code?: string | null) => {
    if (code === "owner_assignment_missing") return t("profile.healthPlanReviewTargetAssignOwner");
    if (code === "alert_response_missing" || code === "add_alert_outreach") return t("profile.healthPlanReviewTargetOpenOutreach");
    if (code === "clarify_same_day_window" || code === "response_window_unclear") return t("profile.healthPlanReviewTargetFixTiming");
    if (code === "medication_followup_missing") return t("profile.healthPlanReviewTargetFixMedication");
    if (code === "sharing_boundary_missing") return t("profile.healthPlanReviewTargetFixBoundary");
    if (code === "sensor_reliability_missing") return t("profile.healthPlanReviewTargetCheckSensors");
    if (code === "enrich_live_context") return t("profile.healthPlanReviewTargetCaptureContext");
    return t("profile.healthPlanReviewTargetOpenPlan");
  };

  const handleHealthPlanTargetedAction = (code?: string | null) => {
    if (code === "owner_assignment_missing") {
      if (canAssignProviders) {
        openAssignProviderDialog(
          "primary_field_staff",
          copy("profile.healthPlanReviewAssignOwnerDraft", { client: fullName }),
          t("profile.healthPlanReviewAssignOwnerHint"),
        );
      }
      else if (healthPlanHandoff) scrollToPanel(healthPlanHandoffRef);
      return;
    }
    if (code === "alert_response_missing" || code === "add_alert_outreach") {
      setOutreachChannel("phone");
      scrollToPanel(healthPlanOutreachRef);
      return;
    }
    if (code === "enrich_live_context") {
      openAddNoteDialog(copy("profile.healthPlanReviewContextDraft", { client: fullName }), t("profile.healthPlanReviewContextHint"));
      return;
    }
    if (code === "clarify_same_day_window" || code === "response_window_unclear") {
      if (canManageHealthPlan) openHealthPlanEditor("escalation_json", t("profile.healthPlanReviewTimingHint"));
      return;
    }
    if (code === "sharing_boundary_missing") {
      if (canManageHealthPlan) openHealthPlanEditor("caregiver_guidance_json", t("profile.healthPlanReviewBoundaryHint"));
      return;
    }
    if (code === "medication_followup_missing") {
      if (canEditMedications && medications[0]) {
        setEditMedTarget(medications[0]);
        setEditMedOpen(true);
      } else if (canManageHealthPlan) {
        openHealthPlanEditor("daily_support_json", t("profile.healthPlanReviewMedicationHint"));
      }
      return;
    }
    if (code === "sensor_reliability_missing") {
      if (showAdminControls && sensors[0]) {
        setEditSensorTarget(sensors[0]);
        setEditSensorOpen(true);
      } else if (canManageHealthPlan) {
        openHealthPlanEditor("monitoring_json", t("profile.healthPlanReviewSensorsHint"));
      }
      return;
    }
    if (canManageHealthPlan) openHealthPlanEditor("summary_text", t("profile.healthPlanReviewPlanHint"));
  };

  const handleHealthPlanResponseTrackerAction = (code?: string | null) => {
    if (code === "review_plan") {
      if (healthPlanReview?.status === "ready" && !healthPlanIsReviewed && canManageHealthPlan) {
        openReviewHealthPlanDialog();
      } else {
        scrollToPanel(healthPlanReviewBoardRef);
      }
      return;
    }
    if (code === "assign_owner") {
      handleHealthPlanTargetedAction("owner_assignment_missing");
      return;
    }
    if (code === "contact_client") {
      setOutreachChannel("phone");
      scrollToPanel(healthPlanOutreachRef);
      return;
    }
    if (code === "update_care_circle") {
      setOutreachChannel("whatsapp");
      scrollToPanel(healthPlanOutreachRef);
      return;
    }
    if (code === "close_loop") {
      scrollToPanel(healthPlanHandoffRef);
    }
  };
  const handleHealthPlanCoordinationAction = (code?: string | null) => {
    if (code === "review_plan") {
      handleHealthPlanResponseTrackerAction("review_plan");
      return;
    }
    if (code === "assign_owner") {
      handleHealthPlanTargetedAction("owner_assignment_missing");
      return;
    }
    if (code === "contact_client" || code === "review_alerts") {
      setOutreachChannel("phone");
      scrollToPanel(healthPlanOutreachRef);
      return;
    }
    if (code === "verify_medication") {
      handleHealthPlanTargetedAction("medication_followup_missing");
      return;
    }
    if (code === "check_sensors") {
      handleHealthPlanTargetedAction("sensor_reliability_missing");
      return;
    }
    if (code === "update_care_circle") {
      setOutreachChannel("whatsapp");
      scrollToPanel(healthPlanOutreachRef);
      return;
    }
    if (code === "respect_sharing_boundary") {
      handleHealthPlanTargetedAction("sharing_boundary_missing");
      return;
    }
    if (code === "refresh_plan") {
      if (canManageHealthPlan) {
        void handleGenerateHealthPlan(true);
      }
    }
  };
  const handleHealthPlanExecutionAction = (code?: string | null) => {
    if (code === "refresh_live_status" || code === "enrich_live_context") {
      setOutreachChannel("phone");
      scrollToPanel(healthPlanOutreachRef);
      return;
    }
    handleHealthPlanCoordinationAction(code);
  };

  const countRevisionEvidence = (revision?: OperationalHealthPlanRevision | null) =>
    revision
      ? [
          ...safeArray(revision.goals_json),
          ...safeArray(revision.daily_support_json),
          ...safeArray(revision.monitoring_json),
          ...safeArray(revision.escalation_json),
          ...safeArray(revision.caregiver_guidance_json),
        ].filter((item) => safeArray(item.source_signal_ids).length > 0).length
      : 0;

  const summarizeHealthPlanRevisionLineage = (revision?: OperationalHealthPlanRevision | null) => {
    const summary = revision?.change_summary_json;
    const entryCodes = new Set(safeArray(summary?.entries).map((entry) => entry?.code).filter(Boolean));
    const changedSections = safeArray(summary?.changed_sections);
    const sourceSignalsAdded = safeArray(summary?.source_signals_added).length;
    const sourceSignalsRemoved = safeArray(summary?.source_signals_removed).length;
    const contentChanged = changedSections.length > 0;
    const evidenceShifted =
      sourceSignalsAdded > 0 ||
      sourceSignalsRemoved > 0 ||
      entryCodes.has("evidence_inputs_changed") ||
      entryCodes.has("content_stable_evidence_shifted");
    const reviewUpdated =
      Boolean(summary?.review_transition) ||
      entryCodes.has("review_marked") ||
      entryCodes.has("review_reopened") ||
      entryCodes.has("review_attestation_updated") ||
      entryCodes.has("review_window_updated") ||
      entryCodes.has("automated_review_refreshed");

    return {
      contentChanged,
      evidenceShifted,
      reviewUpdated,
      sourceSignalsAdded,
      sourceSignalsRemoved,
    };
  };

  const healthPlanActionLabel = (action?: string | null) => {
    const normalized = String(action || "").trim().toLowerCase();
    if (normalized === "generated") return t("profile.healthPlanActionGenerated");
    if (normalized === "regenerated") return t("profile.healthPlanActionRegenerated");
    if (normalized === "reviewed") return t("profile.healthPlanActionReviewed");
    return t("profile.healthPlanActionEdited");
  };
  const healthPlanChangeSectionLabel = (section?: string | null) => {
    if (section === "summary") return t("profile.healthPlanSummary");
    if (section === "goals") return t("profile.healthPlanGoals");
    if (section === "daily_support") return t("profile.healthPlanDailySupport");
    if (section === "monitoring") return t("profile.healthPlanMonitoring");
    if (section === "escalation") return t("profile.healthPlanEscalation");
    if (section === "caregiver_guidance") return t("profile.healthPlanCaregiverGuidance");
    return section || t("profile.healthPlanReviewDescription");
  };
  const healthPlanChangeEntryLabel = (entry?: { code?: string; sections?: string[]; signal_ids?: string[]; count?: number; from?: string | null; to?: string | null }) => {
    const sections = safeArray(entry?.sections).map((section) => healthPlanChangeSectionLabel(section)).join(", ");
    if (entry?.code === "baseline_created") return t("profile.healthPlanChangeBaselineCreated");
    if (entry?.code === "plan_regenerated") return t("profile.healthPlanChangeRegenerated");
    if (entry?.code === "review_marked") return t("profile.healthPlanChangeReviewed");
    if (entry?.code === "review_reopened") return t("profile.healthPlanChangeReopened");
    if (entry?.code === "sections_updated") return copy("profile.healthPlanChangeSectionsUpdated", { sections });
    if (entry?.code === "signals_added") return copy("profile.healthPlanChangeSignalsAdded", { count: entry?.count || safeArray(entry?.signal_ids).length || 0 });
    if (entry?.code === "signals_removed") return copy("profile.healthPlanChangeSignalsRemoved", { count: entry?.count || 0 });
    if (entry?.code === "evidence_inputs_changed") return copy("profile.healthPlanChangeEvidenceInputsChanged", { count: entry?.count || 0 });
    if (entry?.code === "content_stable_evidence_shifted") return t("profile.healthPlanChangeContentStableEvidenceShifted");
    if (entry?.code === "generation_confidence_changed") {
      return copy("profile.healthPlanChangeConfidenceChanged", {
        from: entry?.from ? t(`profile.healthPlanGenerationConfidence${entry.from[0]?.toUpperCase()}${entry.from.slice(1)}`) : "-",
        to: entry?.to ? t(`profile.healthPlanGenerationConfidence${entry.to[0]?.toUpperCase()}${entry.to.slice(1)}`) : "-",
      });
    }
    if (entry?.code === "automated_review_refreshed") return t("profile.healthPlanChangeAutomatedReviewRefreshed");
    if (entry?.code === "review_attestation_updated") return t("profile.healthPlanChangeReviewAttestationUpdated");
    if (entry?.code === "review_window_updated") return t("profile.healthPlanChangeReviewWindowUpdated");
    return t("profile.healthPlanChangeMetadataOnly");
  };
  const healthPlanVersionDeltaShiftLabel = (code?: string | null) => {
    if (code === "alternate_route") return t("profile.healthPlanVersionShiftAlternateRoute");
    if (code === "stronger_next_move") return t("profile.healthPlanVersionShiftStrongerMove");
    if (code === "completion_receipt") return t("profile.healthPlanVersionShiftCompletionReceipt");
    if (code === "material_change") return t("profile.healthPlanVersionShiftMaterialChange");
    if (code === "freshness_gap") return t("profile.healthPlanVersionShiftFreshness");
    if (code === "conflicting_evidence") return t("profile.healthPlanVersionShiftConflict");
    return t("profile.healthPlanReviewDescription");
  };
  const healthPlanAuditStatusLabel = (status?: string | null) => {
    if (status === "needs_regeneration") return t("profile.healthPlanAuditNeedsRegeneration");
    if (status === "needs_review") return t("profile.healthPlanAuditNeedsReview");
    return t("profile.healthPlanAuditReady");
  };
  const healthPlanAuditSummary = (status?: string | null) => {
    if (status === "needs_regeneration") return t("profile.healthPlanAuditNeedsRegenerationSummary");
    if (status === "needs_review") return t("profile.healthPlanAuditNeedsReviewSummary");
    return t("profile.healthPlanAuditReadySummary");
  };
  const healthPlanAuditReasonLabel = (code?: string | null) => {
    if (code === "draft_review_required") return t("profile.healthPlanAuditReasonDraft");
    if (code === "fallback_generation") return t("profile.healthPlanAuditReasonFallback");
    if (code === "missing_generation_time") return t("profile.healthPlanAuditReasonMissingGenerationTime");
    if (code === "stale_same_day_window") return t("profile.healthPlanAuditReasonStaleUrgent");
    if (code === "stale_review_window") return t("profile.healthPlanAuditReasonStale");
    if (code === "missing_saved_signals") return t("profile.healthPlanAuditReasonMissingSignals");
    if (code === "items_missing_evidence") return t("profile.healthPlanAuditReasonEvidence");
    if (code === "predictive_now_available") return t("profile.healthPlanAuditReasonPredictive");
    if (code === "new_critical_signals") return t("profile.healthPlanAuditReasonNewCritical");
    if (code === "critical_signals_not_actioned") return t("profile.healthPlanAuditReasonNotActioned");
    if (code === "review_attestation_expired") return t("profile.healthPlanAuditReasonReviewExpired");
    return t("profile.healthPlanReviewDescription");
  };
  const healthPlanQualityLevelLabel = (level?: string | null) => {
    if (level === "low") return t("profile.healthPlanQualityLow");
    if (level === "medium") return t("profile.healthPlanQualityMedium");
    return t("profile.healthPlanQualityHigh");
  };
  const healthPlanQualityActionLabel = (action?: string | null) => {
    if (action === "regenerate") return t("profile.healthPlanQualityActionRegenerate");
    if (action === "review") return t("profile.healthPlanQualityActionReview");
    return t("profile.healthPlanQualityActionShare");
  };
  const healthPlanImprovementStatusLabel = (status?: string | null) => {
    if (status === "improved") return t("profile.healthPlanQualityVersionImproved");
    if (status === "stable") return t("profile.healthPlanQualityVersionStable");
    if (status === "mixed") return t("profile.healthPlanQualityVersionMixed");
    if (status === "regressed") return t("profile.healthPlanQualityVersionRegressed");
    return t("profile.healthPlanQualityVersionBaseline");
  };
  const healthPlanFreshnessStatusLabel = (status?: string | null) => {
    if (status === "stale") return t("profile.healthPlanQualityFreshnessStale");
    if (status === "aging") return t("profile.healthPlanQualityFreshnessAging");
    if (status === "watch") return t("profile.healthPlanQualityFreshnessWatch");
    return t("profile.healthPlanQualityFreshnessFresh");
  };
  const healthPlanQualityCheckLabel = (code?: string | null) => {
    if (code === "reviewed_by_staff") return t("profile.healthPlanQualityCheckReviewed");
    if (code === "staff_review_pending") return t("profile.healthPlanQualityCheckPendingReview");
    if (code === "review_attestation_expired") return t("profile.healthPlanQualityCheckReviewExpired");
    if (code === "validated_llm_pipeline") return t("profile.healthPlanQualityCheckValidatedPipeline");
    if (code === "fallback_plan_in_use") return t("profile.healthPlanQualityCheckFallback");
    if (code === "evidence_well_linked") return t("profile.healthPlanQualityCheckEvidenceStrong");
    if (code === "evidence_links_thin") return t("profile.healthPlanQualityCheckEvidenceThin");
    if (code === "broad_signal_coverage") return t("profile.healthPlanQualityCheckSignalsBroad");
    if (code === "signal_coverage_narrow") return t("profile.healthPlanQualityCheckSignalsNarrow");
    if (code === "critical_signals_actioned") return t("profile.healthPlanQualityCheckCriticalCovered");
    if (code === "critical_signals_open") return t("profile.healthPlanQualityCheckCriticalOpen");
    if (code === "predictive_context_aligned") return t("profile.healthPlanQualityCheckPredictiveAligned");
    if (code === "predictive_context_missing") return t("profile.healthPlanQualityCheckPredictiveMissing");
    if (code === "sharing_boundary_respected") return t("profile.healthPlanQualityCheckSharingSafe");
    if (code === "sharing_boundary_needs_attention") return t("profile.healthPlanQualityCheckSharingRisk");
    if (code === "follow_up_owner_clear") return t("profile.healthPlanQualityCheckOwnerClear");
    if (code === "follow_up_owner_missing") return t("profile.healthPlanQualityCheckOwnerMissing");
    if (code === "generation_context_strong") return t("profile.healthPlanQualityCheckGenerationStrong");
    if (code === "generation_context_limited") return t("profile.healthPlanQualityCheckGenerationLimited");
    if (code === "generation_context_review") return t("profile.healthPlanQualityCheckGenerationReview");
    if (code === "operational_review_ready") return t("profile.healthPlanQualityCheckReviewReady");
    if (code === "operational_review_pending") return t("profile.healthPlanQualityCheckReviewPending");
    if (code === "operational_review_blocked") return t("profile.healthPlanQualityCheckReviewBlocked");
    return t("profile.healthPlanReviewDescription");
  };
  const healthPlanReviewStatusLabel = (status?: string | null) => {
    if (status === "hold") return t("profile.healthPlanReviewBoardHold");
    if (status === "needs_review") return t("profile.healthPlanReviewBoardReview");
    return t("profile.healthPlanReviewBoardReady");
  };
  const healthPlanReviewStatusSummary = (status?: string | null) => {
    if (status === "hold") return t("profile.healthPlanReviewBoardHoldSummary");
    if (status === "needs_review") return t("profile.healthPlanReviewBoardReviewSummary");
    return t("profile.healthPlanReviewBoardReadySummary");
  };
  const healthPlanReviewCheckLabel = (code?: string | null, detail?: string | null) => {
    if (code === "owner_assignment_missing") return t("profile.healthPlanReviewCheckOwnerMissing");
    if (code === "owner_assignment_clear") return t("profile.healthPlanReviewCheckOwnerClear");
    if (code === "response_window_unclear") return t("profile.healthPlanReviewCheckTimingMissing");
    if (code === "response_window_clear") return t("profile.healthPlanReviewCheckTimingClear");
    if (code === "medication_followup_missing") return t("profile.healthPlanReviewCheckMedicationMissing");
    if (code === "medication_followup_present") return t("profile.healthPlanReviewCheckMedicationClear");
    if (code === "alert_response_missing") return t("profile.healthPlanReviewCheckAlertsMissing");
    if (code === "alert_response_present") return t("profile.healthPlanReviewCheckAlertsClear");
    if (code === "sensor_reliability_missing") return t("profile.healthPlanReviewCheckSensorsMissing");
    if (code === "sensor_reliability_present") return t("profile.healthPlanReviewCheckSensorsClear");
    if (code === "sharing_boundary_missing") return t("profile.healthPlanReviewCheckBoundaryMissing");
    if (code === "sharing_boundary_clear") return t("profile.healthPlanReviewCheckBoundaryClear");
    if (code === "verification_window_overdue") return t("profile.healthPlanReviewCheckVerificationOverdue");
    if (code === "verification_window_due_soon") return t("profile.healthPlanReviewCheckVerificationDueSoon");
    if (code === "verification_window_current") return t("profile.healthPlanReviewCheckVerificationCurrent");
    return detail || t("profile.healthPlanReviewDescription");
  };
  const healthPlanTrustBoundaryReasonLabel = (code?: string | null, detail?: string | null) => {
    if (code === "freshness_decay") return detail || t("profile.healthPlanQualityFreshnessSummaryFallback");
    if (code === "generation_confidence_not_high") return t("profile.healthPlanTrustBoundaryReasonConfidence");
    if (code === "fresh_live_evidence_limited") return t("profile.healthPlanTrustBoundaryReasonFreshness");
    if (code === "critical_signals_need_fresher_followup") return t("profile.healthPlanTrustBoundaryReasonCriticalFollowup");
    if (code === "multiple_moderate_uncertainties") return t("profile.healthPlanTrustBoundaryReasonUncertainty");
    if (code === "conflicted_live_picture_too_thin") return t("profile.healthPlanTrustBoundaryReasonConflict");
    if (code === "automated_review_rubric_low") return t("profile.healthPlanTrustBoundaryReasonRubric");
    if (code === "plan_actionability_weak") return t("profile.healthPlanTrustBoundaryReasonActionability");
    return healthPlanGenerationReasonLabel(code, detail);
  };
  const healthPlanTrustBoundaryStateLabel = (state?: string | null) => {
    if (state === "do_not_share") return t("profile.healthPlanTrustBoundaryStateDoNotShare");
    if (state === "ready_to_share") return t("profile.healthPlanTrustBoundaryStateReady");
    return t("profile.healthPlanTrustBoundaryStateReviewOnly");
  };
  const healthPlanReviewMoveLabel = (code?: string | null, text?: string | null) => {
    if (code === "enrich_live_context") return t("profile.healthPlanReviewMoveEnrich");
    if (code === "clarify_same_day_window") return t("profile.healthPlanReviewMoveTiming");
    if (code === "add_alert_outreach") return t("profile.healthPlanReviewMoveAlerts");
    return text || t("profile.healthPlanReviewDescription");
  };
  const healthPlanApprovalGateStateLabel = (state?: string | null) => {
    if (state === "blocked") return t("profile.healthPlanApprovalGateBlocked");
    if (state === "review") return t("profile.healthPlanApprovalGateReview");
    return t("profile.healthPlanApprovalGateReady");
  };
  const healthPlanApprovalIssueLabel = (issue?: { code?: string | null; detail?: string | null; source?: string | null }) => {
    if (issue?.source === "audit") return healthPlanAuditReasonLabel(issue.code);
    if (issue?.source === "review") return healthPlanReviewCheckLabel(issue.code, issue.detail);
    if (issue?.source === "coordination") return healthPlanCoordinationCommitmentLabel(issue.code);
    return issue?.detail || t("profile.healthPlanReviewDescription");
  };
  const healthPlanApprovalIssueAction = (issue?: { code?: string | null; source?: string | null }) => {
    if (issue?.source === "review") {
      handleHealthPlanTargetedAction(issue.code);
      return;
    }
    if (issue?.source === "coordination") {
      handleHealthPlanCoordinationAction(issue.code);
      return;
    }
    if (issue?.code === "draft_review_required") {
      handleHealthPlanResponseTrackerAction("review_plan");
      return;
    }
    if (issue?.code === "new_critical_signals" || issue?.code === "critical_signals_not_actioned" || issue?.code === "critical_alert_outreach_missing") {
      setOutreachChannel("phone");
      scrollToPanel(healthPlanOutreachRef);
      return;
    }
    if (issue?.code === "same_day_owner_required") {
      handleHealthPlanTargetedAction("owner_assignment_missing");
      return;
    }
    if (issue?.code === "review_attestation_expired" || issue?.code === "same_day_plan_stale") {
      if (canManageHealthPlan) void handleGenerateHealthPlan(true);
      return;
    }
    if (issue?.code === "predictive_now_available" || issue?.code === "fallback_generation") {
      if (canManageHealthPlan) void handleGenerateHealthPlan(true);
      return;
    }
    scrollToPanel(healthPlanReviewBoardRef);
  };
  const healthPlanAccountabilityStateLabel = (state?: string | null) => {
    if (state === "urgent") return t("profile.healthPlanAccountabilityUrgent");
    if (state === "watch") return t("profile.healthPlanAccountabilityWatch");
    return t("profile.healthPlanAccountabilityStable");
  };
  const healthPlanAccountabilityMovementLabel = (state?: string | null) => {
    if (state === "stalled") return t("profile.healthPlanAccountabilityMovementStalled");
    if (state === "quiet") return t("profile.healthPlanAccountabilityMovementQuiet");
    return t("profile.healthPlanAccountabilityMovementFresh");
  };
  const healthPlanAccountabilityReceiptLabel = (code?: string | null) => {
    if (code === "plan_reviewed") return t("profile.healthPlanAccountabilityReceiptReviewed");
    if (code === "handoff_recorded") return t("profile.healthPlanAccountabilityReceiptHandoff");
    if (code === "owner_assigned") return t("profile.healthPlanAccountabilityReceiptOwner");
    if (code === "first_contact_made") return t("profile.healthPlanAccountabilityReceiptContact");
    if (code === "client_brief_shared") return t("profile.healthPlanAccountabilityReceiptClientShare");
    if (code === "care_circle_brief_shared") return t("profile.healthPlanAccountabilityReceiptCareCircleShare");
    return t("profile.healthPlanAccountabilityReceiptLoop");
  };
  const healthPlanAccountabilityReceiptStatusLabel = (status?: string | null) => {
    if (status === "done") return t("profile.healthPlanCoordinationCovered");
    if (status === "not_needed") return t("profile.healthPlanCoordinationNotNeeded");
    return t("profile.healthPlanCoordinationOpen");
  };
  const healthPlanAccountabilityActionLabel = (code?: string | null) => {
    if (code === "owner_assigned") return t("profile.healthPlanCoordinationActionOwner");
    if (code === "first_contact_made" || code === "client_brief_shared") return t("profile.healthPlanCoordinationActionClient");
    if (code === "care_circle_brief_shared") return t("profile.healthPlanCoordinationActionCareCircle");
    if (code === "loop_closed") return t("profile.healthPlanTrackerActionCloseLoop");
    if (code === "handoff_recorded") return t("profile.healthPlanReviewBoardActionHandoff");
    return t("profile.healthPlanCoordinationActionReview");
  };
  const healthPlanSafetyStateLabel = (state?: string | null) => {
    if (state === "urgent") return t("profile.healthPlanSafetyUrgent");
    if (state === "watch") return t("profile.healthPlanSafetyWatch");
    return t("profile.healthPlanSafetyStable");
  };
  const healthPlanSafetyFlagText = (flag?: { kind?: string; code?: string | null; text?: string | null }) => {
    if (flag?.kind === "plan" && flag.text) return flag.text;
    if (flag?.code === "active_alerts") return t("profile.healthPlanSafetyFlagAlerts");
    if (flag?.code === "missed_medication") return t("profile.healthPlanSafetyFlagMedication");
    return t("profile.healthPlanSafetyFlagSensors");
  };
  const healthPlanRapidResponseStepLabel = (code?: string | null) => {
    if (code === "reach_elder") return t("profile.healthPlanRapidResponseStepElder");
    if (code === "reach_care_circle") return t("profile.healthPlanRapidResponseStepCareCircle");
    return t("profile.healthPlanRapidResponseStepOwner");
  };
  const healthPlanRapidResponseStepDescription = (code?: string | null) => {
    if (code === "reach_elder") return t("profile.healthPlanRapidResponseStepElderDescription");
    if (code === "reach_care_circle") return t("profile.healthPlanRapidResponseStepCareCircleDescription");
    return t("profile.healthPlanRapidResponseStepOwnerDescription");
  };
  const healthPlanRapidResponseFallbackText = (code?: string | null) => {
    if (code === "care_circle_then_owner") return t("profile.healthPlanRapidResponseFallbackCareCircleThenOwner");
    if (code === "owner_then_keep_urgent") return t("profile.healthPlanRapidResponseFallbackOwnerThenKeepUrgent");
    return t("profile.healthPlanRapidResponseFallbackKeepUrgent");
  };
  const healthPlanIncidentPlaybookTitle = (code?: string | null) => {
    if (code === "urgent_welfare_check") return t("profile.healthPlanPlaybookUrgentTitle");
    if (code === "medication_recovery") return t("profile.healthPlanPlaybookMedicationTitle");
    return t("profile.healthPlanPlaybookSensorTitle");
  };
  const healthPlanIncidentPlaybookActionLabel = (code?: string | null) => {
    if (code === "assign_owner") return t("profile.healthPlanCoordinationActionOwner");
    if (code === "review_medication") return t("profile.healthPlanCoordinationActionMedication");
    if (code === "check_sensors") return t("profile.healthPlanCoordinationActionSensors");
    if (code === "record_handoff") return t("profile.healthPlanReviewBoardActionHandoff");
    return t("profile.healthPlanCoordinationActionClient");
  };
  const healthPlanIncidentEpisodeStatusLabel = (status?: string | null) => {
    if (status === "open") return t("profile.healthPlanIncidentStatusOpen");
    if (status === "closed") return t("profile.healthPlanIncidentStatusClosed");
    return t("profile.healthPlanIncidentStatusNotStarted");
  };
  const handleHealthPlanIncidentPlaybookAction = (code?: string | null) => {
    if (code === "assign_owner") {
      handleHealthPlanTargetedAction("owner_assignment_missing");
      return;
    }
    if (code === "review_medication") {
      handleHealthPlanTargetedAction("medication_followup_missing");
      return;
    }
    if (code === "check_sensors") {
      handleHealthPlanTargetedAction("sensor_reliability_missing");
      return;
    }
    if (code === "record_handoff") {
      scrollToPanel(healthPlanHandoffRef);
      return;
    }
    setOutreachChannel("phone");
    scrollToPanel(healthPlanOutreachRef);
  };
  const handleHealthPlanAccountabilityAction = (code?: string | null) => {
    if (code === "owner_assigned") {
      handleHealthPlanTargetedAction("owner_assignment_missing");
      return;
    }
    if (code === "first_contact_made" || code === "client_brief_shared") {
      setOutreachChannel("phone");
      scrollToPanel(healthPlanOutreachRef);
      return;
    }
    if (code === "care_circle_brief_shared") {
      setOutreachChannel("whatsapp");
      scrollToPanel(healthPlanOutreachRef);
      return;
    }
    if (code === "loop_closed" || code === "handoff_recorded") {
      scrollToPanel(healthPlanHandoffRef);
      return;
    }
    scrollToPanel(healthPlanReviewBoardRef);
  };
  const handleHealthPlanActionBriefReceiptAction = (code?: string | null) => {
    if (code === "owner_assigned") {
      void handleRecordHealthPlanHandoffStatus("owner_assigned");
      return;
    }
    if (code === "first_contact_made") {
      void handleRecordHealthPlanHandoffStatus("first_contact_made");
      return;
    }
    if (code === "client_brief_shared") {
      void handleLogHealthPlanOutreach("client");
      return;
    }
    if (code === "care_circle_brief_shared") {
      void handleLogHealthPlanOutreach("care_circle");
      return;
    }
    if (code === "loop_closed") {
      void handleRecordHealthPlanHandoffStatus("escalation_closed");
      return;
    }
    if (code === "handoff_recorded") {
      void handleRecordHealthPlanHandoff();
      return;
    }
    handleHealthPlanAccountabilityAction(code);
  };
  const healthPlanActionBriefReceiptBusy = (code?: string | null) => {
    if (code === "owner_assigned") return recordingHandoffStatus === "owner_assigned";
    if (code === "first_contact_made") return recordingHandoffStatus === "first_contact_made";
    if (code === "client_brief_shared") return loggingOutreachAudience === "client";
    if (code === "care_circle_brief_shared") return loggingOutreachAudience === "care_circle";
    if (code === "loop_closed") return recordingHandoffStatus === "escalation_closed";
    if (code === "handoff_recorded") return recordingHandoff;
    return false;
  };
  const healthPlanGenerationConfidenceLabel = (level?: string | null) => {
    if (!level) return "-";
    if (level === "low") return t("profile.healthPlanGenerationConfidenceLow");
    if (level === "medium") return t("profile.healthPlanGenerationConfidenceMedium");
    return t("profile.healthPlanGenerationConfidenceHigh");
  };
  const healthPlanGenerationReadinessLabel = (value?: string | null) => {
    if (!value) return "-";
    if (value === "review_and_enrich") return t("profile.healthPlanGenerationReadinessEnrich");
    if (value === "review_before_share") return t("profile.healthPlanGenerationReadinessReview");
    return t("profile.healthPlanGenerationReadinessReady");
  };
  const healthPlanResponseWindowLabel = (value?: string | null) => {
    const normalized = String(value || "").trim().toLowerCase();
    if (normalized.includes("same")) return t("profile.healthPlanHandoffResponseSameDay");
    if (normalized) return t("profile.healthPlanHandoffResponse24h");
    return "-";
  };
  const healthPlanAutomatedReviewVerdictLabel = (value?: string | null) => {
    if (value === "block") return t("profile.healthPlanAutomatedReviewBlock");
    if (value === "revise") return t("profile.healthPlanAutomatedReviewRevise");
    return t("profile.healthPlanAutomatedReviewPass");
  };
  const healthPlanAutomatedReviewShareabilityLabel = (value?: string | null) => {
    if (value === "staff_only") return t("profile.healthPlanHandoffSharingStaffOnly");
    return t("profile.healthPlanShareReady");
  };
  const healthPlanAutomatedReviewConcernLabel = (code?: string | null, detail?: string | null) => {
    if (code === "same_day_owner_required") return t("profile.healthPlanAutomatedConcernOwner");
    if (code === "same_day_plan_stale") return t("profile.healthPlanAutomatedConcernStale");
    if (code === "critical_alert_outreach_missing") return t("profile.healthPlanAutomatedConcernOutreach");
    if (code === "critical_alert_timing_missing") return t("profile.healthPlanAutomatedConcernTiming");
    if (code === "automated_review_blocked") return t("profile.healthPlanAutomatedConcernBlocked");
    if (code === "automated_review_requested_revisions") return t("profile.healthPlanAutomatedConcernRevise");
    return detail || t("profile.healthPlanReviewDescription");
  };
  const healthPlanGenerationReasonLabel = (code?: string | null, detail?: string | null) => {
    if (code === "thin_signal_snapshot") return t("profile.healthPlanGenerationReasonThin");
    if (code === "no_named_owner") return t("profile.healthPlanGenerationReasonOwner");
    if (code === "medication_schedule_incomplete") return t("profile.healthPlanGenerationReasonMedication");
    if (code === "limited_live_feedback") return t("profile.healthPlanGenerationReasonFeedback");
    if (code === "critical_signals_stale") return t("profile.healthPlanGenerationReasonStaleCritical");
    if (code === "critical_freshness_unknown") return t("profile.healthPlanGenerationReasonFreshnessUnknown");
    if (code === "live_picture_stale") return t("profile.healthPlanGenerationReasonLivePicture");
    if (code === "predictive_context_missing") return t("profile.healthPlanGenerationReasonPredictiveMissing");
    if (code === "predictive_confidence_low") return t("profile.healthPlanGenerationReasonPredictiveLow");
    if (code === "no_structured_follow_up_path") return t("profile.healthPlanGenerationReasonFollowUp");
    if (code === "critical_freshness_gap") return t("profile.healthPlanGenerationReasonGuardrailFreshness");
    if (code === "critical_signal_snapshot_too_thin") return t("profile.healthPlanGenerationReasonGuardrailThin");
    if (code === "urgent_followup_path_missing") return t("profile.healthPlanGenerationReasonGuardrailOwner");
    return detail || t("profile.healthPlanReviewDescription");
  };
  const healthPlanRegenerationFocusStateLabel = (state?: string | null) => {
    if (state === "regenerate") return t("profile.healthPlanFocusStateRegenerate");
    if (state === "refine") return t("profile.healthPlanFocusStateRefine");
    return t("profile.healthPlanFocusStateReady");
  };
  const healthPlanRegenerationFocusSourceLabel = (source?: string | null) => {
    if (source === "approval") return t("profile.healthPlanFocusSourceApproval");
    if (source === "audit") return t("profile.healthPlanFocusSourceAudit");
    if (source === "generation") return t("profile.healthPlanFocusSourceGeneration");
    if (source === "review") return t("profile.healthPlanFocusSourceReview");
    if (source === "automated_review") return t("profile.healthPlanFocusSourceAutomation");
    if (source === "coverage") return t("profile.healthPlanFocusSourceCoverage");
    return t("profile.healthPlanFocusSourceReview");
  };
  const healthPlanOutcomeTrajectoryLabel = (value?: string | null) => {
    if (value === "worsened") return t("profile.healthPlanFocusOutcomeWorsened");
    if (value === "stalled") return t("profile.healthPlanFocusOutcomeStalled");
    if (value === "improved") return t("profile.healthPlanFocusOutcomeImproved");
    return "-";
  };
  const healthPlanWeakDimensionLabel = (value?: string | null) => {
    if (value === "actionability") return t("profile.healthPlanFocusDimensionActionability");
    if (value === "grounding") return t("profile.healthPlanFocusDimensionGrounding");
    if (value === "timeliness") return t("profile.healthPlanFocusDimensionTimeliness");
    if (value === "safety") return t("profile.healthPlanFocusDimensionSafety");
    if (value === "shareability") return t("profile.healthPlanFocusDimensionShareability");
    return value || t("profile.healthPlanReviewDescription");
  };
  const healthPlanRegenerationFocusItemText = (item?: OperationalHealthPlanRegenerationFocusItem | null) => {
    if (!item) return t("profile.healthPlanReviewDescription");
    if (item.source === "audit") return healthPlanAuditReasonLabel(item.code);
    if (item.source === "generation") return healthPlanGenerationReasonLabel(item.code, item.detail);
    if (item.source === "automated_review") return healthPlanAutomatedReviewConcernLabel(item.code, item.detail);
    if (item.source === "review") return item.detail || healthPlanReviewMoveLabel(item.code, item.detail);
    if (item.source === "approval") return item.detail || t("profile.healthPlanFocusApprovalFallback");
    if (item.source === "coverage") return item.detail || t("profile.healthPlanFocusCoverageFallback");
    return item.detail || t("profile.healthPlanReviewDescription");
  };
  const normalizeHealthPlanEditorSection = (value?: string | null): HealthPlanEditorSection | null => {
    if (value === "summary" || value === "summary_text") return "summary_text";
    if (value === "goals" || value === "goals_json") return "goals_json";
    if (value === "daily_support" || value === "daily_support_json") return "daily_support_json";
    if (value === "monitoring" || value === "monitoring_json") return "monitoring_json";
    if (value === "escalation" || value === "escalation_json") return "escalation_json";
    if (value === "caregiver_guidance" || value === "caregiver_guidance_json") return "caregiver_guidance_json";
    return null;
  };
  const handleHealthPlanRegenerationFocusAction = (item?: OperationalHealthPlanRegenerationFocusItem | null) => {
    if (!item) return;
    const code = item.code || null;
    if (
      code === "owner_assignment_missing"
      || code === "alert_response_missing"
      || code === "add_alert_outreach"
      || code === "clarify_same_day_window"
      || code === "response_window_unclear"
      || code === "medication_followup_missing"
      || code === "sharing_boundary_missing"
      || code === "sensor_reliability_missing"
      || code === "enrich_live_context"
    ) {
      handleHealthPlanTargetedAction(code);
      return;
    }
    if (
      code === "review_plan"
      || code === "assign_owner"
      || code === "contact_client"
      || code === "review_alerts"
      || code === "verify_medication"
      || code === "check_sensors"
      || code === "update_care_circle"
      || code === "respect_sharing_boundary"
      || code === "refresh_plan"
      || code === "refresh_live_status"
    ) {
      handleHealthPlanExecutionAction(code);
      return;
    }
    const targetSection = safeArray(item.section_targets).map((value) => normalizeHealthPlanEditorSection(value)).find(Boolean) || null;
    if (canManageHealthPlan && targetSection) {
      openHealthPlanEditor(targetSection, item.detail || t("profile.healthPlanFocusFallbackHint"));
      return;
    }
    if (canManageHealthPlan) {
      openHealthPlanEditor("summary_text", item.detail || t("profile.healthPlanFocusFallbackHint"));
      return;
    }
    scrollToPanel(healthPlanReviewBoardRef);
  };
  const healthPlanVerificationDueLabel = (value?: string | null) => {
    if (value === "same_day") return t("profile.healthPlanRealityCheckDueSameDay");
    if (value === "within_24h") return t("profile.healthPlanRealityCheckDue24h");
    return null;
  };
  const healthPlanShareStateLabel = (state?: string | null) => {
    if (state === "hold") return t("profile.healthPlanShareHold");
    if (state === "review") return t("profile.healthPlanShareReview");
    return t("profile.healthPlanShareReady");
  };
  const healthPlanCommunicationStateLabel = (state?: string | null) => {
    if (state === "hold") return t("profile.healthPlanCommunicationHold");
    if (state === "review") return t("profile.healthPlanCommunicationReview");
    return t("profile.healthPlanCommunicationReady");
  };
  const healthPlanShareBlockedReasonLabel = (reason?: "review_required" | "consent_required" | null) => {
    if (reason === "consent_required") return t("profile.healthPlanShareCareCircleBlockedConsent");
    if (reason === "review_required") return t("profile.healthPlanShareBlockedReview");
    return t("profile.healthPlanShareReady");
  };
  const healthPlanActionBriefStateLabel = (state?: string | null) => {
    if (state === "urgent") return t("profile.healthPlanActionBriefUrgent");
    if (state === "watch") return t("profile.healthPlanActionBriefWatch");
    return t("profile.healthPlanActionBriefStable");
  };
  const healthPlanCareCircleBridgeRealityLabel = (state?: string | null) => {
    if (state === "stalled") return t("profile.healthPlanCareCircleRealityStalled");
    if (state === "verify_today") return t("profile.healthPlanCareCircleRealityVerifyToday");
    return t("profile.healthPlanCareCircleRealityFresh");
  };
  const healthPlanCareCircleBridgeShareLabel = (state?: string | null) => {
    if (state === "hold") return t("profile.healthPlanCareCircleShareHold");
    if (state === "review") return t("profile.healthPlanCareCircleShareReview");
    return t("profile.healthPlanCareCircleShareReady");
  };
  const healthPlanProvenanceDriverLabel = (driver?: HealthPlanProvenanceDriver | null) => {
    if (driver === "risk_outlook") return t("profile.healthPlanProvenanceDriverRisk");
    if (driver === "active_alerts") return t("profile.healthPlanProvenanceDriverAlerts");
    if (driver === "medication_followup") return t("profile.healthPlanProvenanceDriverMedication");
    if (driver === "sensor_reliability") return t("profile.healthPlanProvenanceDriverSensors");
    if (driver === "support_routines") return t("profile.healthPlanProvenanceDriverRoutines");
    if (driver === "care_circle_context") return t("profile.healthPlanProvenanceDriverCareCircle");
    return t("profile.healthPlanProvenanceDriverProfile");
  };
  const healthPlanProvenanceHeadline = (drivers?: HealthPlanProvenanceDriver[] | null) => {
    const labels = safeArray(drivers).map((driver) => healthPlanProvenanceDriverLabel(driver)).filter(Boolean);
    if (labels.length === 0) return t("profile.healthPlanProvenanceFallback");
    return copy("profile.healthPlanProvenanceHeadline", {
      drivers: labels.join(", "),
    });
  };
  const healthPlanProvenanceSupportLabel = (level?: HealthPlanProvenanceSupportLevel | null) => {
    if (level === "strong") return t("profile.healthPlanProvenanceSupportStrong");
    if (level === "mixed") return t("profile.healthPlanProvenanceSupportMixed");
    return t("profile.healthPlanProvenanceSupportThin");
  };
  const healthPlanProvenanceSupportBadgeClasses = (level?: HealthPlanProvenanceSupportLevel | null) => {
    if (level === "strong") return "border-emerald-200 bg-emerald-50 text-emerald-700";
    if (level === "mixed") return "border-amber-200 bg-amber-50 text-amber-700";
    return "border-slate-200 bg-slate-100 text-slate-700";
  };
  const healthPlanProvenanceCaution = (input?: {
    staleSignalCount?: number | null;
    uncoveredItemCount?: number | null;
    supportLevel?: HealthPlanProvenanceSupportLevel | null;
  } | null) => {
    if (Number(input?.uncoveredItemCount || 0) > 0) return t("profile.healthPlanProvenanceNeedsLinks");
    if (Number(input?.staleSignalCount || 0) > 0) return t("profile.healthPlanProvenanceCaution");
    if (input?.supportLevel === "thin") return t("profile.healthPlanProvenanceThin");
    return t("profile.healthPlanProvenanceFresh");
  };
  const healthPlanConfirmationStatusLabel = (status?: HealthPlanConfirmationStatus | null) =>
    status?.confirmed ? t("profile.healthPlanConfirmationConfirmed") : t("profile.healthPlanConfirmationPending");
  const healthPlanConfirmationReceiptLine = (status?: HealthPlanConfirmationStatus | null) => {
    if (!status?.confirmedAt) return null;
    if (status.confirmedBy) {
      return copy("profile.healthPlanConfirmationRecordedBy", {
        date: formatDateTime(status.confirmedAt),
        author: status.confirmedBy,
      });
    }
    return copy("profile.healthPlanConfirmationRecordedAt", {
      date: formatDateTime(status.confirmedAt),
    });
  };
  const formatActionBriefDuration = (minutes?: number | null) => {
    if (minutes == null || !Number.isFinite(minutes) || minutes < 0) return null;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    if (hours > 0 && remainingMinutes > 0) return copy("profile.healthPlanActionBriefDurationHoursMinutes", { hours, minutes: remainingMinutes });
    if (hours > 0) return copy("profile.healthPlanActionBriefDurationHours", { hours });
    return copy("profile.healthPlanActionBriefDurationMinutes", { minutes: remainingMinutes });
  };
  const healthPlanActionBriefClockText = (brief?: typeof healthPlanActionBrief | null) => {
    if (!brief) return null;
    if (brief.minutesOverdue != null && brief.minutesOverdue > 0) {
      return copy("profile.healthPlanActionBriefClockOverdue", { duration: formatActionBriefDuration(brief.minutesOverdue) || "0m" });
    }
    if (brief.minutesSinceMovement != null && brief.minutesSinceMovement > 0) {
      return copy("profile.healthPlanActionBriefClockSince", { duration: formatActionBriefDuration(brief.minutesSinceMovement) || "0m" });
    }
    if (brief.minutesUntilStale != null) {
      return copy("profile.healthPlanActionBriefClockDue", { duration: formatActionBriefDuration(brief.minutesUntilStale) || "0m" });
    }
    return null;
  };
  const healthPlanResponseTrackerStateLabel = (state?: string | null) => {
    if (state === "urgent") return t("profile.healthPlanTrackerUrgent");
    if (state === "watch") return t("profile.healthPlanTrackerWatch");
    return t("profile.healthPlanTrackerStable");
  };
  const healthPlanResponseTrackerStepLabel = (code?: string | null) => {
    if (code === "review_plan") return t("profile.healthPlanTrackerStepReview");
    if (code === "assign_owner") return t("profile.healthPlanTrackerStepOwner");
    if (code === "contact_client") return t("profile.healthPlanTrackerStepClient");
    if (code === "update_care_circle") return t("profile.healthPlanTrackerStepCareCircle");
    if (code === "close_loop") return t("profile.healthPlanTrackerStepCloseLoop");
    return t("profile.healthPlanReviewDescription");
  };
  const healthPlanResponseTrackerActionLabel = (code?: string | null) => {
    if (code === "review_plan") return t("profile.healthPlanTrackerActionReview");
    if (code === "assign_owner") return t("profile.healthPlanTrackerActionOwner");
    if (code === "contact_client") return t("profile.healthPlanTrackerActionClient");
    if (code === "update_care_circle") return t("profile.healthPlanTrackerActionCareCircle");
    if (code === "close_loop") return t("profile.healthPlanTrackerActionCloseLoop");
    return t("profile.healthPlanReviewTargetOpenPlan");
  };
  const healthPlanCommitmentProofLabel = (code?: string | null) => {
    if (code === "review_plan") return t("profile.healthPlanProofReview");
    if (code === "assign_owner") return t("profile.healthPlanProofOwner");
    if (code === "contact_client") return t("profile.healthPlanProofClient");
    if (code === "review_alerts") return t("profile.healthPlanProofAlerts");
    if (code === "verify_medication") return t("profile.healthPlanProofMedication");
    if (code === "check_sensors") return t("profile.healthPlanProofSensors");
    if (code === "update_care_circle") return t("profile.healthPlanProofCareCircle");
    if (code === "respect_sharing_boundary") return t("profile.healthPlanProofBoundary");
    if (code === "refresh_plan") return t("profile.healthPlanProofRefresh");
    if (code === "close_loop") return t("profile.healthPlanProofCloseLoop");
    return t("profile.healthPlanReviewDescription");
  };
  const healthPlanCoordinationStateLabel = (state?: string | null) => {
    if (state === "urgent") return t("profile.healthPlanCoordinationUrgent");
    if (state === "watch") return t("profile.healthPlanCoordinationWatch");
    return t("profile.healthPlanCoordinationStable");
  };
  const healthPlanCoordinationCommitmentLabel = (code?: string | null) => {
    if (code === "review_plan") return t("profile.healthPlanCoordinationCommitmentReview");
    if (code === "assign_owner") return t("profile.healthPlanCoordinationCommitmentOwner");
    if (code === "contact_client") return t("profile.healthPlanCoordinationCommitmentClient");
    if (code === "review_alerts") return t("profile.healthPlanCoordinationCommitmentAlerts");
    if (code === "verify_medication") return t("profile.healthPlanCoordinationCommitmentMedication");
    if (code === "check_sensors") return t("profile.healthPlanCoordinationCommitmentSensors");
    if (code === "update_care_circle") return t("profile.healthPlanCoordinationCommitmentCareCircle");
    if (code === "respect_sharing_boundary") return t("profile.healthPlanCoordinationCommitmentBoundary");
    if (code === "refresh_plan") return t("profile.healthPlanCoordinationCommitmentRefresh");
    return t("profile.healthPlanReviewDescription");
  };
  const healthPlanCoordinationCommitmentStatusLabel = (status?: string | null) => {
    if (status === "covered") return t("profile.healthPlanCoordinationCovered");
    if (status === "not_needed") return t("profile.healthPlanCoordinationNotNeeded");
    return t("profile.healthPlanCoordinationOpen");
  };
  const healthPlanCoordinationActionLabel = (code?: string | null) => {
    if (code === "review_plan") return t("profile.healthPlanCoordinationActionReview");
    if (code === "assign_owner") return t("profile.healthPlanCoordinationActionOwner");
    if (code === "contact_client") return t("profile.healthPlanCoordinationActionClient");
    if (code === "review_alerts") return t("profile.healthPlanCoordinationActionAlerts");
    if (code === "verify_medication") return t("profile.healthPlanCoordinationActionMedication");
    if (code === "check_sensors") return t("profile.healthPlanCoordinationActionSensors");
    if (code === "update_care_circle") return t("profile.healthPlanCoordinationActionCareCircle");
    if (code === "respect_sharing_boundary") return t("profile.healthPlanCoordinationActionBoundary");
    if (code === "refresh_plan") return t("profile.healthPlanCoordinationActionRefresh");
    return t("profile.healthPlanReviewTargetOpenPlan");
  };
  const healthPlanExecutionStateLabel = (state?: string | null) => {
    if (state === "urgent") return t("profile.healthPlanExecutionUrgent");
    if (state === "watch") return t("profile.healthPlanExecutionWatch");
    return t("profile.healthPlanExecutionStable");
  };
  const healthPlanExecutionTaskLabel = (code?: string | null) => {
    if (code === "refresh_live_status") return t("profile.healthPlanExecutionTaskRefreshLive");
    if (code === "enrich_live_context") return t("profile.healthPlanExecutionTaskEnrichContext");
    return healthPlanCoordinationCommitmentLabel(code);
  };
  const healthPlanExecutionAudienceLabel = (audience?: string | null) => {
    if (audience === "elder") return t("profile.healthPlanExecutionAudienceElder");
    if (audience === "care_circle") return t("profile.healthPlanExecutionAudienceCareCircle");
    return t("profile.healthPlanExecutionAudienceStaff");
  };
  const healthPlanExecutionActionLabel = (code?: string | null) => {
    if (code === "refresh_live_status") return t("profile.healthPlanExecutionActionRefreshLive");
    if (code === "enrich_live_context") return t("profile.healthPlanExecutionActionEnrichContext");
    return healthPlanCoordinationActionLabel(code);
  };
  const healthPlanCommunicationGuardrailLabel = (code?: string | null) => {
    if (code === "hold_staff_only") return t("profile.healthPlanCommunicationGuardrailHold");
    if (code === "review_before_share") return t("profile.healthPlanCommunicationGuardrailReview");
    if (code === "assign_owner_first") return t("profile.healthPlanCommunicationGuardrailOwner");
    if (code === "same_day_tone") return t("profile.healthPlanCommunicationGuardrailSameDay");
    if (code === "protect_family_boundary") return t("profile.healthPlanCommunicationGuardrailBoundary");
    return t("profile.healthPlanReviewDescription");
  };
  const outreachChannelLabel = (channel?: string | null) => {
    if (channel === "whatsapp") return t("profile.channel.whatsApp");
    if (channel === "app") return t("profile.channel.app");
    if (channel === "in_person") return t("profile.healthPlanOutreachChannelInPerson");
    return t("profile.channel.phone");
  };
  const copyHealthPlanDraft = async (value?: string | null, titleKey = "profile.healthPlanDraftCopied") => {
    const text = String(value || "").trim();
    if (!text || !navigator.clipboard) return;
    await navigator.clipboard.writeText(text);
    toast({ title: t(titleKey) });
  };
  const copyGuardedHealthPlanDraft = async (
    value: string | null | undefined,
    audience: "client" | "care_circle" | "staff",
    titleKey = "profile.healthPlanDraftCopied",
  ) => {
    if (audience === "client" && !canShareHealthPlanWithClient) {
      toast({ title: t("profile.healthPlanShareBlockedReview"), variant: "destructive" });
      return;
    }
    if (audience === "care_circle" && !canShareHealthPlanWithCareCircle) {
      toast({
        title: healthPlanShareBlockedReasonLabel(healthPlanShareAccess.careCircleBlockedReason),
        variant: "destructive",
      });
      return;
    }
    await copyHealthPlanDraft(value, titleKey);
  };

  return (
    <div className="space-y-5">
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
          {canEditProfile && (
            <Button variant="outline" className="h-10 rounded-full border-primary/20 text-primary hover:bg-primary/10" onClick={() => setEditUserOpen(true)}>
              <Pencil className="mr-2 h-4 w-4" />
              {t("profile.editProfile")}
            </Button>
          )}
        </div>
      </div>

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
                    {[age ? copy("profile.ageYears", { age }) : null, context.livingContextKey ? t(context.livingContextKey) : null, user.city].filter(Boolean).join(" · ")}
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
          {visibleCareNotes && (
            <div className="mt-4 rounded-xl border border-border/70 bg-muted/25 px-4 py-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("profile.careNotes")}</p>
              <p className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-6 text-foreground">{visibleCareNotes}</p>
            </div>
          )}
        </CardContent>
      </Card>

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
                {medications.map((med) => (
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
                        {Array.isArray(med.schedule_times) && med.schedule_times.length > 0 && (
                          <p className={cn("mt-1 text-xs font-semibold", (med.reminders_enabled ?? true) ? "text-primary" : "text-muted-foreground")}>
                            {med.schedule_times.join(", ")}
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
                ))}
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

      <Card className="rounded-2xl border-border bg-white shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0 space-y-3">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Brain className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <CardTitle className="text-[22px] font-bold tracking-tight text-foreground">
                    {t("profile.healthPlanTitle")}
                  </CardTitle>
                  <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
                    {t("profile.healthPlanDescription")}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                    {healthPlanIsReviewed ? (
                        <Badge className="rounded-full bg-emerald-600 px-3 py-1 text-white hover:bg-emerald-600">
                          {t("profile.healthPlanReviewedBadge")}
                        </Badge>
                ) : (
                  <Badge className="rounded-full bg-primary/10 px-3 py-1 text-primary hover:bg-primary/10">
                    {t("profile.healthPlanDraftBadge")}
                  </Badge>
                )}
                <Badge variant="secondary" className="rounded-full px-3 py-1">
                  {healthPlanIsReviewed ? t("profile.healthPlanShareReady") : t("profile.healthPlanReviewRequired")}
                </Badge>
                {healthPlan && (
                  <Badge variant="outline" className="rounded-full border-slate-200 bg-white px-3 py-1 text-slate-700">
                    {t("profile.healthPlanVersion")} {healthPlan.current_version || 1}
                  </Badge>
                )}
              </div>
            </div>

            <div className="w-full rounded-[20px] border border-slate-200 bg-slate-50/90 p-2.5 shadow-sm xl:w-auto xl:min-w-[356px]">
              {healthPlan && (
                <div className="rounded-2xl border border-white/80 bg-white/92 px-4 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                    {t("profile.healthPlanLastGenerated")}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-foreground">
                    {healthPlan.generated_at ? formatDateTime(healthPlan.generated_at) : "-"}
                  </p>
                </div>
              )}
              <div className={cn("grid gap-2", healthPlan ? "mt-2 sm:grid-cols-2 xl:grid-cols-2" : "sm:grid-cols-1")}>
                {healthPlan && (
                  <Button
                    variant="outline"
                    className="h-10 rounded-2xl border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-white"
                    onClick={() => setHealthPlanHistoryOpen(true)}
                  >
                    <Clock className="mr-1.5 h-3.5 w-3.5" />
                    {t("profile.healthPlanHistory")}
                  </Button>
                )}
                {healthPlan && (
                  <Button
                    variant="outline"
                    className="h-10 rounded-2xl border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-white"
                    disabled={!canManageHealthPlan || generatingHealthPlan}
                    onClick={() => setEditHealthPlanOpen(true)}
                  >
                    <Pencil className="mr-1.5 h-3.5 w-3.5" />
                    {t("profile.edit")}
                  </Button>
                )}
                {healthPlan && canManageHealthPlan && !healthPlanIsReviewed && (
                  <Button
                    variant="outline"
                    className="h-10 rounded-2xl border-emerald-200 bg-emerald-50 px-3 text-xs font-bold text-emerald-700 hover:bg-emerald-100 hover:text-emerald-700"
                    disabled={generatingHealthPlan}
                    onClick={() => void handleMarkHealthPlanReviewed()}
                  >
                    <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
                    {t("profile.healthPlanMarkReviewed")}
                  </Button>
                )}
                {canManageHealthPlan && (
                  <Button
                    className={cn(
                      "h-10 rounded-2xl px-3 text-xs font-bold shadow-sm",
                      healthPlan && !healthPlanIsReviewed && "sm:col-span-2",
                    )}
                    disabled={generatingHealthPlan}
                    onClick={() => void handleGenerateHealthPlan(Boolean(healthPlan))}
                  >
                    <Brain className={cn("mr-1.5 h-3.5 w-3.5", generatingHealthPlan && "animate-spin")} />
                    {healthPlan ? t("profile.healthPlanRegenerate") : t("profile.healthPlanGenerate")}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {healthPlanError && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <p className="font-semibold">{t("profile.healthPlanGenerationFailed")}</p>
              <p className="mt-1">{healthPlanError}</p>
            </div>
          )}

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
                <p className="max-w-4xl text-sm leading-7 text-muted-foreground">{t("profile.healthPlanEmpty")}</p>
                <p className="max-w-3xl text-sm leading-6 text-foreground/80">{t("profile.healthPlanReadyToShare")}</p>
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
                          {t("profile.healthPlanReviewedBadge")}
                        </Badge>
                      ) : (
                        <>
                          <Badge className="rounded-full bg-primary px-3 py-1 text-white hover:bg-primary">
                            {t("profile.healthPlanDraftBadge")}
                          </Badge>
                          <Badge variant="secondary" className="rounded-full px-3 py-1">
                            {t("profile.healthPlanReviewRequired")}
                          </Badge>
                        </>
                      )}
                    </div>
                    {healthPlanRegenerationFocus && (
                      <div
                        className={cn(
                          "rounded-[22px] border px-4 py-4 shadow-sm",
                          healthPlanRegenerationFocus.state === "regenerate"
                            ? "border-red-200 bg-[linear-gradient(180deg,rgba(254,242,242,0.98),rgba(255,255,255,0.98))]"
                            : healthPlanRegenerationFocus.state === "refine"
                              ? "border-amber-200 bg-[linear-gradient(180deg,rgba(255,251,235,0.98),rgba(255,255,255,0.98))]"
                              : "border-emerald-200 bg-[linear-gradient(180deg,rgba(236,253,245,0.95),rgba(255,255,255,0.98))]",
                        )}
                      >
                        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                          <div className="min-w-0">
                            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("profile.healthPlanFocusTitle")}</p>
                            <div className="mt-2 flex flex-wrap items-center gap-3">
                              <p className="text-xl font-bold text-foreground">{healthPlanRegenerationFocusStateLabel(healthPlanRegenerationFocus.state)}</p>
                              <Badge
                                variant="outline"
                                className={cn(
                                  "rounded-full px-3 py-1 text-xs font-bold",
                                  healthPlanRegenerationFocus.state === "regenerate"
                                    ? "border-red-200 bg-red-50 text-red-700"
                                    : healthPlanRegenerationFocus.state === "refine"
                                      ? "border-amber-200 bg-amber-50 text-amber-700"
                                      : "border-emerald-200 bg-emerald-50 text-emerald-700",
                                )}
                              >
                                {healthPlanRegenerationFocusStateLabel(healthPlanRegenerationFocus.state)}
                              </Badge>
                            </div>
                            <p className="mt-2 max-w-3xl text-sm leading-6 text-foreground/80">
                              {healthPlanRegenerationFocus.summary_text || t("profile.healthPlanFocusDescription")}
                            </p>
                          </div>
                          <div className="grid min-w-[260px] gap-2 sm:grid-cols-2 xl:grid-cols-1">
                            <HealthPlanMetaChip
                              label={t("profile.healthPlanReviewBoardConfidence")}
                              value={healthPlanGenerationConfidenceLabel(healthPlanRegenerationFocus.confidence)}
                            />
                            <HealthPlanMetaChip
                              label={t("profile.healthPlanReviewBoardReadiness")}
                              value={healthPlanGenerationReadinessLabel(healthPlanRegenerationFocus.readiness)}
                            />
                            {healthPlanImprovementSummary ? (
                              <HealthPlanMetaChip
                                label={t("profile.healthPlanQualityVersionTitle")}
                                value={healthPlanImprovementStatusLabel(healthPlanImprovementSummary.status)}
                              />
                            ) : (
                              <HealthPlanMetaChip
                                label={t("profile.healthPlanFocusOutcome")}
                                value={healthPlanOutcomeTrajectoryLabel(healthPlanRegenerationFocus.outcome_trajectory)}
                              />
                            )}
                            {healthPlanFreshnessDecay ? (
                              <HealthPlanMetaChip
                                label={t("profile.healthPlanQualityFreshnessTitle")}
                                value={healthPlanFreshnessStatusLabel(healthPlanFreshnessDecay.status)}
                              />
                            ) : (
                              <HealthPlanMetaChip
                                label={t("profile.healthPlanFocusNextTask")}
                                value={healthPlanRegenerationFocus.next_task_title || t("profile.healthPlanTrackerComplete")}
                              />
                            )}
                          </div>
                        </div>
                        {healthPlanFocusWeakDimensions.length > 0 && (
                          <div className="mt-4 flex flex-wrap gap-2">
                            {healthPlanFocusWeakDimensions.map((dimension) => (
                              <Badge key={`focus-dimension-${dimension}`} variant="outline" className="rounded-full border-amber-200 bg-white/85 px-2.5 py-1 text-[11px] font-semibold text-amber-800">
                                {healthPlanWeakDimensionLabel(dimension)}
                              </Badge>
                            ))}
                          </div>
                        )}
                        <div className="mt-4 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                          <div className="rounded-2xl border border-white/80 bg-white/88 p-4">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("profile.healthPlanFocusFixFirst")}</p>
                              <Badge variant="secondary" className="rounded-full px-2.5 py-0.5 text-[11px]">
                                {healthPlanFocusItems.length}
                              </Badge>
                            </div>
                            <div className="mt-3 space-y-3">
                              {healthPlanFocusItems.length > 0 ? (
                                healthPlanFocusItems.map((item, index) => (
                                  <div key={`${item.code}-${index}`} className="rounded-[18px] border border-slate-200 bg-slate-50/80 px-4 py-3">
                                    <div className="flex flex-wrap items-start justify-between gap-2">
                                      <div className="min-w-0 flex-1">
                                        <p className="text-sm font-semibold leading-6 text-foreground">{healthPlanRegenerationFocusItemText(item)}</p>
                                      </div>
                                      <Badge
                                        variant="outline"
                                        className={cn(
                                          "rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                                          item.priority === "high"
                                            ? "border-red-200 bg-red-50 text-red-700"
                                            : item.priority === "low"
                                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                              : "border-amber-200 bg-amber-50 text-amber-700",
                                        )}
                                      >
                                        {item.priority === "high"
                                          ? t("profile.healthPlanCoordinationPriorityHigh")
                                          : item.priority === "low"
                                            ? t("profile.healthPlanCoordinationPriorityLow")
                                            : t("profile.healthPlanCoordinationPriorityMedium")}
                                      </Badge>
                                    </div>
                                    <div className="mt-3 flex flex-wrap gap-2">
                                      <Badge variant="secondary" className="rounded-full px-2.5 py-0.5 text-[11px]">
                                        {healthPlanRegenerationFocusSourceLabel(item.source)}
                                      </Badge>
                                      {item.due_window && (
                                        <Badge variant="secondary" className="rounded-full px-2.5 py-0.5 text-[11px]">
                                          {healthPlanResponseWindowLabel(item.due_window)}
                                        </Badge>
                                      )}
                                      {safeArray(item.section_targets).map((section) => (
                                        <Badge key={`${item.code}-${section}`} variant="outline" className="rounded-full border-slate-200 bg-white px-2.5 py-0.5 text-[11px] font-semibold text-slate-700">
                                          {healthPlanChangeSectionLabel(section)}
                                        </Badge>
                                      ))}
                                    </div>
                                    <div className="mt-3">
                                      <Button
                                        type="button"
                                        variant="outline"
                                        className="h-8 rounded-full px-3 text-[11px] font-bold"
                                        onClick={() => handleHealthPlanRegenerationFocusAction(item)}
                                      >
                                        {t("profile.healthPlanFocusResolveAction")}
                                      </Button>
                                    </div>
                                  </div>
                                ))
                              ) : (
                                <p className="text-sm leading-6 text-muted-foreground">{t("profile.healthPlanFocusNoFixes")}</p>
                              )}
                            </div>
                          </div>
                          <div className="space-y-4">
                            {(healthPlanImprovementSummary || healthPlanFreshnessDecay) && (
                              <div className="grid gap-4">
                                {healthPlanImprovementSummary && (
                                  <div className={cn("rounded-2xl border p-4", healthPlanImprovementToneClasses(healthPlanImprovementSummary.status))}>
                                    <div className="flex items-center justify-between gap-3">
                                      <p className="text-[11px] font-bold uppercase tracking-[0.16em] opacity-70">{t("profile.healthPlanQualityVersionTitle")}</p>
                                      <Badge className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-bold", healthPlanImprovementBadgeClasses(healthPlanImprovementSummary.status))}>
                                        {healthPlanImprovementStatusLabel(healthPlanImprovementSummary.status)}
                                      </Badge>
                                    </div>
                                    <p className="mt-3 text-sm leading-6 opacity-90">
                                      {healthPlanImprovementSummary.summary_text || t("profile.healthPlanQualityVersionBaselineSummary")}
                                    </p>
                                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                      <HealthPlanMetaChip
                                        label={t("profile.healthPlanQualityVersionScoreDelta")}
                                        value={formatHealthPlanDelta(healthPlanImprovementSummary.score_delta)}
                                      />
                                      <HealthPlanMetaChip
                                        label={t("profile.healthPlanQualityVersionResolved")}
                                        value={String(safeArray(healthPlanImprovementSummary.resolved_issue_codes).length)}
                                      />
                                      <HealthPlanMetaChip
                                        label={t("profile.healthPlanQualityVersionNew")}
                                        value={String(safeArray(healthPlanImprovementSummary.new_issue_codes).length)}
                                      />
                                      <HealthPlanMetaChip
                                        label={t("profile.healthPlanQualityVersionChanged")}
                                        value={String(safeArray(healthPlanImprovementSummary.changed_sections).length)}
                                      />
                                    </div>
                                  </div>
                                )}
                                {healthPlanFreshnessDecay && (
                                  <div className={cn("rounded-2xl border p-4", healthPlanFreshnessToneClasses(healthPlanFreshnessDecay.status))}>
                                    <div className="flex items-center justify-between gap-3">
                                      <p className="text-[11px] font-bold uppercase tracking-[0.16em] opacity-70">{t("profile.healthPlanQualityFreshnessTitle")}</p>
                                      <Badge className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-bold", healthPlanFreshnessBadgeClasses(healthPlanFreshnessDecay.status))}>
                                        {healthPlanFreshnessStatusLabel(healthPlanFreshnessDecay.status)}
                                      </Badge>
                                    </div>
                                    <p className="mt-3 text-sm leading-6 opacity-90">
                                      {healthPlanFreshnessDecay.summary_text || t("profile.healthPlanQualityFreshnessSummaryFallback")}
                                    </p>
                                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                      <HealthPlanMetaChip
                                        label={t("profile.healthPlanQualityFreshnessRefreshBy")}
                                        value={healthPlanFreshnessDecay.refresh_recommended_by_at ? formatDateTime(healthPlanFreshnessDecay.refresh_recommended_by_at) : "-"}
                                      />
                                      <HealthPlanMetaChip
                                        label={t("profile.healthPlanQualityFreshnessNext")}
                                        value={
                                          healthPlanFreshnessDecay.next_status_at
                                            ? `${healthPlanFreshnessStatusLabel(healthPlanFreshnessDecay.next_status)} · ${formatDateTime(healthPlanFreshnessDecay.next_status_at)}`
                                            : healthPlanFreshnessStatusLabel(healthPlanFreshnessDecay.next_status)
                                        }
                                      />
                                      <HealthPlanMetaChip
                                        label={t("profile.healthPlanQualityFreshnessLive")}
                                        value={String(healthPlanFreshnessDecay.live_signal_count ?? 0)}
                                      />
                                      <HealthPlanMetaChip
                                        label={t("profile.healthPlanQualityFreshnessStaleSignals")}
                                        value={String(healthPlanFreshnessDecay.stale_signal_count ?? 0)}
                                      />
                                      <HealthPlanMetaChip
                                        label={t("profile.healthPlanQualityFreshnessTimedChecks")}
                                        value={String(healthPlanTimedRecommendationChecks)}
                                      />
                                      <HealthPlanMetaChip
                                        label={t("profile.healthPlanQualityFreshnessOverdueChecks")}
                                        value={String(healthPlanOverdueRecommendationChecks)}
                                      />
                                      <HealthPlanMetaChip
                                        label={t("profile.healthPlanQualityFreshnessNextRecheck")}
                                        value={healthPlanFreshnessDecay.earliest_recheck_due_at ? formatDateTime(healthPlanFreshnessDecay.earliest_recheck_due_at) : "-"}
                                      />
                                    </div>
                                    {healthPlanFreshnessDecay.refresh_overdue && (
                                      <div className="mt-3 rounded-xl border border-red-200 bg-white/75 px-3 py-3 text-sm font-medium text-red-900">
                                        {t("profile.healthPlanQualityFreshnessOverdueSummary")}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                            <div className="rounded-2xl border border-white/80 bg-white/88 p-4">
                              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("profile.healthPlanFocusVerifyTitle")}</p>
                              <div className="mt-3 space-y-2">
                                {healthPlanFocusVerificationItems.length > 0 ? (
                                  healthPlanFocusVerificationItems.map((item, index) => (
                                    <div key={`${item.code || "verify"}-${index}`} className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5 text-sm text-slate-900">
                                      <div className="flex items-start gap-2">
                                        <Clock className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                                        <div className="min-w-0">
                                          <p className="leading-6">{item.text || t("profile.healthPlanReviewDescription")}</p>
                                          {healthPlanVerificationDueLabel(item.due_window) && (
                                            <p className="mt-1 text-xs text-muted-foreground">{healthPlanVerificationDueLabel(item.due_window)}</p>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  ))
                                ) : (
                                  <p className="text-sm leading-6 text-muted-foreground">{t("profile.healthPlanFocusNoVerification")}</p>
                                )}
                              </div>
                            </div>
                            {(healthPlanFocusPlanningCautions.length > 0 || healthPlanFocusLearningHighlights.length > 0) && (
                              <div className="rounded-2xl border border-white/80 bg-white/88 p-4">
                                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("profile.healthPlanFocusKeepInMind")}</p>
                                <div className="mt-3 space-y-2">
                                  {healthPlanFocusPlanningCautions.map((item, index) => (
                                    <HealthPlanChecklistItem key={`focus-caution-${index}`} text={item} />
                                  ))}
                                  {healthPlanFocusLearningHighlights.map((item, index) => (
                                    <HealthPlanChecklistItem key={`focus-highlight-${index}`} text={item} />
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                    {healthPlanSafetySnapshot && (
                      <div className="rounded-[22px] border border-primary/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(240,244,255,0.86))] px-4 py-4 shadow-sm">
                        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                          <div className="min-w-0">
                            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("profile.healthPlanSafetyTitle")}</p>
                            <p className="mt-2 max-w-3xl text-sm leading-6 text-foreground/80">{t("profile.healthPlanSafetyDescription")}</p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Badge
                              variant="outline"
                              className={cn(
                                "rounded-full px-3 py-1 text-xs font-bold",
                                healthPlanSafetySnapshot.state === "urgent"
                                  ? "border-red-200 bg-red-50 text-red-700"
                                  : healthPlanSafetySnapshot.state === "watch"
                                    ? "border-amber-200 bg-amber-50 text-amber-700"
                                    : "border-emerald-200 bg-emerald-50 text-emerald-700",
                              )}
                            >
                              {healthPlanSafetyStateLabel(healthPlanSafetySnapshot.state)}
                            </Badge>
                            <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs font-semibold">
                              {healthPlanResponseWindowLabel(healthPlanSafetySnapshot.responseWindow)}
                            </Badge>
                          </div>
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2.5">
                          <HealthPlanMetaChip
                            label={t("profile.healthPlanHandoffOwner")}
                            value={healthPlanSafetySnapshot.ownerMissing ? t("profile.healthPlanHandoffOwnerMissing") : healthPlanSafetySnapshot.ownerName || "-"}
                          />
                          <HealthPlanMetaChip
                            label={t("profile.healthPlanHandoffSharing")}
                            value={healthPlanSafetySnapshot.sharingBoundary === "staff_only" ? t("profile.healthPlanHandoffSharingStaffOnly") : t("profile.healthPlanHandoffSharingCareCircle")}
                          />
                          <HealthPlanMetaChip
                            label={t("profile.healthPlanAuditCriticalNow")}
                            value={String(healthPlanSafetySnapshot.redFlags.length)}
                          />
                        </div>
                        <div className="mt-4 grid gap-4 xl:grid-cols-3">
                          <div className="rounded-2xl border border-border/70 bg-white/82 p-4">
                            <div className="flex items-center gap-2">
                              <HeartPulse className="h-4 w-4 text-primary" />
                              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("profile.healthPlanSafetyElder")}</p>
                            </div>
                            <div className="mt-3 space-y-2">
                              {healthPlanSafetySnapshot.elderToday.length > 0 ? (
                                healthPlanSafetySnapshot.elderToday.map((item, index) => (
                                  <HealthPlanChecklistItem key={`safety-elder-${index}`} text={item} />
                                ))
                              ) : (
                                <p className="text-sm leading-6 text-muted-foreground">{t("profile.healthPlanSafetyEmptyElder")}</p>
                              )}
                            </div>
                          </div>
                          <div className="rounded-2xl border border-border/70 bg-white/82 p-4">
                            <div className="flex items-center gap-2">
                              <Users className="h-4 w-4 text-primary" />
                              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("profile.healthPlanSafetyCareCircle")}</p>
                            </div>
                            <div className="mt-3 space-y-2">
                              {healthPlanSafetySnapshot.careCircleNow.map((action) => (
                                <HealthPlanChecklistItem key={`safety-action-${action}`} text={healthPlanHandoffActionText(t, { code: action, tone: "medium" })} />
                              ))}
                            </div>
                          </div>
                          <div className="rounded-2xl border border-border/70 bg-white/82 p-4">
                            <div className="flex items-center gap-2">
                              <AlertTriangle className="h-4 w-4 text-red-600" />
                              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("profile.healthPlanSafetyEscalate")}</p>
                            </div>
                            <div className="mt-3 space-y-2">
                              {healthPlanSafetySnapshot.redFlags.length > 0 ? (
                                healthPlanSafetySnapshot.redFlags.map((flag, index) => (
                                  <div key={`safety-flag-${index}`} className="flex items-start gap-2.5 rounded-xl border border-red-100 bg-red-50/80 px-3 py-2.5 text-sm leading-6 text-red-900">
                                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                                    <span>{healthPlanSafetyFlagText(flag)}</span>
                                  </div>
                                ))
                              ) : (
                                <p className="text-sm leading-6 text-muted-foreground">{t("profile.healthPlanSafetyEmptyEscalation")}</p>
                              )}
                            </div>
                          </div>
                        </div>
                        {(healthPlanSafetySnapshot.elderMessage || healthPlanSafetySnapshot.careCircleMessage) && (
                          <div className="mt-4 rounded-2xl border border-border/70 bg-white/82 p-4">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                              <div>
                                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("profile.healthPlanSafetyMessagesTitle")}</p>
                                <p className="mt-1 text-sm text-muted-foreground">{t("profile.healthPlanSafetyMessagesDescription")}</p>
                              </div>
                            </div>
                            <div className="mt-4 grid gap-4 xl:grid-cols-2">
                              {healthPlanSafetySnapshot.elderMessage && (
                                <div className="rounded-2xl border border-border/70 bg-white/88 p-4">
                                  <div className="flex items-center justify-between gap-3">
                                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("profile.healthPlanSafetyMessageElder")}</p>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      className="h-8 rounded-full px-3 text-xs font-bold"
                                      disabled={!canShareHealthPlanWithClient}
                                      onClick={() => void copyGuardedHealthPlanDraft(healthPlanSafetySnapshot.elderMessage, "client")}
                                    >
                                      <Copy className="mr-1.5 h-3.5 w-3.5" />
                                      {t("profile.healthPlanDraftCopy")}
                                    </Button>
                                  </div>
                                  <pre className="mt-3 whitespace-pre-wrap rounded-xl border border-border/70 bg-muted/10 p-3 text-sm leading-6 text-foreground">{healthPlanSafetySnapshot.elderMessage}</pre>
                                </div>
                              )}
                              {healthPlanSafetySnapshot.careCircleMessage && (
                                <div className="rounded-2xl border border-border/70 bg-white/88 p-4">
                                  <div className="flex items-center justify-between gap-3">
                                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("profile.healthPlanSafetyMessageCareCircle")}</p>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      className="h-8 rounded-full px-3 text-xs font-bold"
                                      disabled={!canShareHealthPlanWithCareCircle}
                                      onClick={() => void copyGuardedHealthPlanDraft(healthPlanSafetySnapshot.careCircleMessage, "care_circle")}
                                    >
                                      <Copy className="mr-1.5 h-3.5 w-3.5" />
                                      {t("profile.healthPlanDraftCopy")}
                                    </Button>
                                  </div>
                                  <pre className="mt-3 whitespace-pre-wrap rounded-xl border border-border/70 bg-muted/10 p-3 text-sm leading-6 text-foreground">{healthPlanSafetySnapshot.careCircleMessage}</pre>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                        {healthPlanCareCircleBridge && (
                          <div className="mt-4 rounded-2xl border border-border/70 bg-white/82 p-4">
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                              <div className="min-w-0">
                                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("profile.healthPlanCareCircleBridgeTitle")}</p>
                                <p className="mt-2 max-w-3xl text-sm leading-6 text-foreground/80">{t("profile.healthPlanCareCircleBridgeDescription")}</p>
                              </div>
                              <Badge
                                variant="outline"
                                className={cn(
                                  "rounded-full px-3 py-1 text-xs font-bold",
                                  healthPlanCareCircleBridge.state === "urgent"
                                    ? "border-red-200 bg-red-50 text-red-700"
                                    : healthPlanCareCircleBridge.state === "watch"
                                      ? "border-amber-200 bg-amber-50 text-amber-700"
                                      : "border-emerald-200 bg-emerald-50 text-emerald-700",
                                )}
                              >
                                {healthPlanActionBriefStateLabel(healthPlanCareCircleBridge.state)}
                              </Badge>
                            </div>
                            <p className="mt-4 text-sm leading-6 text-foreground/90">{healthPlanCareCircleBridge.summaryText}</p>
                            <div className="mt-4 flex flex-wrap gap-2.5">
                              <HealthPlanMetaChip
                                label={t("profile.healthPlanHandoffOwner")}
                                value={healthPlanCareCircleBridge.ownerMissing ? t("profile.healthPlanHandoffOwnerMissing") : (healthPlanCareCircleBridge.ownerName || "-")}
                              />
                              <HealthPlanMetaChip
                                label={t("profile.healthPlanCareCircleRealityTitle")}
                                value={healthPlanCareCircleBridgeRealityLabel(healthPlanCareCircleBridge.realityState)}
                              />
                              <HealthPlanMetaChip
                                label={t("profile.healthPlanCareCircleShareTitle")}
                                value={healthPlanCareCircleBridgeShareLabel(healthPlanCareCircleBridge.shareState)}
                              />
                              <HealthPlanMetaChip
                                label={t("profile.healthPlanHandoffResponse")}
                                value={healthPlanResponseWindowLabel(healthPlanCareCircleBridge.responseWindow)}
                              />
                            </div>
                            {(healthPlanCareCircleVerifiedAt || healthPlanCareCircleVerifiedBy) && (
                              <div className="mt-4 rounded-2xl border border-border/70 bg-muted/10 p-4">
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                  <div>
                                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("profile.healthPlanCareCircleVerifiedTitle")}</p>
                                    <p className="mt-1 text-sm leading-6 text-foreground/80">
                                      {healthPlanCareCircleVerifiedAt ? formatDateTime(healthPlanCareCircleVerifiedAt) : "-"}
                                    </p>
                                  </div>
                                  {healthPlanCareCircleVerifiedBy && (
                                    <p className="text-sm text-muted-foreground">
                                      <span className="font-semibold text-foreground/80">{t("profile.healthPlanReviewedBy")}: </span>
                                      {healthPlanCareCircleVerifiedBy}
                                    </p>
                                  )}
                                </div>
                              </div>
                            )}
                            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
                              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-amber-800">{t("profile.healthPlanCareCircleCautionTitle")}</p>
                              <p className="mt-2 text-sm leading-6 text-amber-900">{healthPlanCareCircleBridge.cautionText}</p>
                            </div>
                            {((healthPlanResponseTracker?.nextStepCode) || healthPlanCareCirclePendingConfirmation || healthPlanCareCirclePendingReceiptCode) && (
                              <div className="mt-4 rounded-2xl border border-border/70 bg-white/88 p-4">
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                  <div>
                                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("profile.healthPlanCareCircleMovesTitle")}</p>
                                    <p className="mt-1 text-sm text-muted-foreground">{t("profile.healthPlanCareCircleMovesDescription")}</p>
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    {healthPlanResponseTracker?.nextStepCode && (
                                      <Button
                                        type="button"
                                        className="h-9 rounded-full px-3 text-xs font-bold shadow-sm"
                                        onClick={() => handleHealthPlanResponseTrackerAction(healthPlanResponseTracker.nextStepCode)}
                                      >
                                        {healthPlanResponseTrackerActionLabel(healthPlanResponseTracker.nextStepCode)}
                                      </Button>
                                    )}
                                    {healthPlanCareCirclePendingConfirmation && (
                                      <Button
                                        type="button"
                                        variant="outline"
                                        className="h-9 rounded-full px-3 text-xs font-bold"
                                        disabled={recordingConfirmationCode === healthPlanCareCirclePendingConfirmation.code}
                                        onClick={() => void handleRecordHealthPlanConfirmation(healthPlanCareCirclePendingConfirmation)}
                                      >
                                        {recordingConfirmationCode === healthPlanCareCirclePendingConfirmation.code
                                          ? t("userForm.saving")
                                          : t("profile.healthPlanConfirmationMark")}
                                      </Button>
                                    )}
                                    {healthPlanCareCirclePendingReceiptCode && (
                                      <Button
                                        type="button"
                                        variant="outline"
                                        className="h-9 rounded-full px-3 text-xs font-bold"
                                        disabled={healthPlanActionBriefReceiptBusy(healthPlanCareCirclePendingReceiptCode)}
                                        onClick={() => handleHealthPlanActionBriefReceiptAction(healthPlanCareCirclePendingReceiptCode)}
                                      >
                                        {healthPlanActionBriefReceiptBusy(healthPlanCareCirclePendingReceiptCode)
                                          ? t("userForm.saving")
                                          : healthPlanAccountabilityActionLabel(healthPlanCareCirclePendingReceiptCode)}
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}
                            <div className="mt-4 grid gap-4 xl:grid-cols-3">
                              <div className="rounded-2xl border border-border/70 bg-white/88 p-4">
                                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("profile.healthPlanActionBriefElder")}</p>
                                <div className="mt-3 space-y-2">
                                  {healthPlanCareCircleBridge.elderLead ? (
                                    <HealthPlanChecklistItem text={healthPlanCareCircleBridge.elderLead} />
                                  ) : (
                                    <p className="text-sm leading-6 text-muted-foreground">{t("profile.healthPlanCareCircleElderEmpty")}</p>
                                  )}
                                </div>
                              </div>
                              <div className="rounded-2xl border border-border/70 bg-white/88 p-4">
                                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("profile.healthPlanActionBriefCareCircle")}</p>
                                <div className="mt-3 space-y-2">
                                  {healthPlanCareCircleBridge.careCircleLead ? (
                                    <HealthPlanChecklistItem text={healthPlanCareCircleBridge.careCircleLead} />
                                  ) : (
                                    <p className="text-sm leading-6 text-muted-foreground">
                                      {healthPlanCareCircleBridge.sharingBoundary === "staff_only"
                                        ? t("profile.healthPlanShareStaffOnlyNotice")
                                        : t("profile.healthPlanShareReviewNotice")}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <div className="rounded-2xl border border-border/70 bg-white/88 p-4">
                                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("profile.healthPlanCareCircleConfirmTitle")}</p>
                                <div className="mt-3 space-y-2">
                                  {healthPlanConfirmationStatuses.length > 0 ? (
                                    healthPlanConfirmationStatuses.map((item) => {
                                      const receiptLine = healthPlanConfirmationReceiptLine(item);
                                      return (
                                        <div key={item.code} className="rounded-2xl border border-border/70 bg-muted/10 px-3 py-3">
                                          <div className="flex flex-wrap items-start justify-between gap-3">
                                            <div className="min-w-0 flex-1">
                                              <p className="text-sm leading-6 text-foreground">{item.text || "-"}</p>
                                              {receiptLine && (
                                                <p className="mt-1 text-xs text-muted-foreground">{receiptLine}</p>
                                              )}
                                            </div>
                                            <div className="flex shrink-0 flex-wrap items-center gap-2">
                                              <Badge
                                                variant={item.confirmed ? "secondary" : "outline"}
                                                className={cn(
                                                  "rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                                                  item.confirmed ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "",
                                                )}
                                              >
                                                {healthPlanConfirmationStatusLabel(item)}
                                              </Badge>
                                              {!item.confirmed && !isPreviewDemo && !authBypassEnabled && (
                                                <Button
                                                  type="button"
                                                  variant="outline"
                                                  className="h-8 rounded-full px-3 text-xs font-bold"
                                                  disabled={recordingConfirmationCode === item.code}
                                                  onClick={() => void handleRecordHealthPlanConfirmation(item)}
                                                >
                                                  {recordingConfirmationCode === item.code ? t("userForm.saving") : t("profile.healthPlanConfirmationMark")}
                                                </Button>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })
                                  ) : (
                                    <p className="text-sm leading-6 text-muted-foreground">{t("profile.healthPlanCareCircleConfirmEmpty")}</p>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                        {healthPlanRapidResponse && healthPlanRapidResponse.steps.length > 0 && (
                          <div className="mt-4 rounded-2xl border border-border/70 bg-white/82 p-4">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                              <div>
                                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("profile.healthPlanRapidResponseTitle")}</p>
                                <p className="mt-1 text-sm text-muted-foreground">{t("profile.healthPlanRapidResponseDescription")}</p>
                              </div>
                              <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs font-semibold">
                                {healthPlanResponseWindowLabel(healthPlanRapidResponse.responseWindow)}
                              </Badge>
                            </div>
                            {healthPlanRapidResponse.reasonLines.length > 0 && (
                              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
                                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-amber-800">
                                  {t("profile.healthPlanRapidResponseWhy")}
                                </p>
                                <div className="mt-3 space-y-2">
                                  {healthPlanRapidResponse.reasonLines.map((line, index) => (
                                    <div key={`rapid-reason-${index}`} className="flex items-start gap-2.5 text-sm leading-6 text-amber-950">
                                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                                      <span>{line}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            <div className="mt-4 space-y-3">
                              {healthPlanRapidResponse.steps.map((step, index) => {
                                const contactSummary = [step.contactName, step.phone].filter(Boolean).join(" - ");
                                return (
                                  <div key={`rapid-${step.code}-${index}`} className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-white/88 p-4 lg:flex-row lg:items-center lg:justify-between">
                                    <div className="flex min-w-0 items-start gap-3">
                                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                                        {index + 1}
                                      </span>
                                      <div className="min-w-0">
                                        <p className="text-sm font-semibold text-foreground">{healthPlanRapidResponseStepLabel(step.code)}</p>
                                        <p className="mt-1 text-sm text-foreground/80">{step.contactName}</p>
                                        <p className="mt-1 text-sm text-muted-foreground">{healthPlanRapidResponseStepDescription(step.code)}</p>
                                        <div className="mt-2 flex flex-wrap items-center gap-2">
                                          <Badge variant="outline" className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold">
                                            {step.phone || t("profile.noPhone")}
                                          </Badge>
                                          {step.channel && (
                                            <Badge variant="secondary" className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold">
                                              {t(channelKey(step.channel))}
                                            </Badge>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                    {contactSummary && (
                                      <Button
                                        type="button"
                                        variant="outline"
                                        className="h-8 rounded-full px-3 text-xs font-bold"
                                        onClick={() => void copyHealthPlanDraft(contactSummary)}
                                      >
                                        <Copy className="mr-1.5 h-3.5 w-3.5" />
                                        {t("profile.healthPlanDraftCopy")}
                                      </Button>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                            <div className="mt-4 grid gap-4 xl:grid-cols-2">
                              <div className="rounded-2xl border border-border/70 bg-white/88 p-4">
                                <div className="flex items-center justify-between gap-3">
                                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                                    {t("profile.healthPlanRapidResponseBriefing")}
                                  </p>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    className="h-8 rounded-full px-3 text-xs font-bold"
                                    onClick={() => void copyHealthPlanDraft(healthPlanRapidResponse.briefingMessage)}
                                  >
                                    <Copy className="mr-1.5 h-3.5 w-3.5" />
                                    {t("profile.healthPlanDraftCopy")}
                                  </Button>
                                </div>
                                <pre className="mt-3 whitespace-pre-wrap rounded-xl border border-border/70 bg-muted/10 p-3 text-sm leading-6 text-foreground">
                                  {healthPlanRapidResponse.briefingMessage}
                                </pre>
                              </div>
                              <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
                                <div className="flex items-center justify-between gap-3">
                                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-amber-800">
                                    {t("profile.healthPlanRapidResponseNoAnswer")}
                                  </p>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    className="h-8 rounded-full border-amber-200 bg-white/80 px-3 text-xs font-bold text-amber-900 hover:bg-white"
                                    onClick={() => void copyHealthPlanDraft(healthPlanRapidResponse.noAnswerMessage)}
                                  >
                                    <Copy className="mr-1.5 h-3.5 w-3.5" />
                                    {t("profile.healthPlanDraftCopy")}
                                  </Button>
                                </div>
                                <p className="mt-3 text-sm leading-6 text-amber-950">
                                  {healthPlanRapidResponseFallbackText(healthPlanRapidResponse.fallbackCode)}
                                </p>
                                <pre className="mt-3 whitespace-pre-wrap rounded-xl border border-amber-200 bg-white/75 p-3 text-sm leading-6 text-amber-950">
                                  {healthPlanRapidResponse.noAnswerMessage}
                                </pre>
                              </div>
                            </div>
                          </div>
                        )}
                        {(healthPlanSafetySnapshot.state !== "stable" || healthPlanSafetySnapshot.ownerMissing) && (
                          <div className="mt-4 flex flex-wrap gap-2">
                            {healthPlanSafetySnapshot.ownerMissing && (
                              <Button
                                type="button"
                                variant="outline"
                                className="h-9 rounded-full px-3 text-xs font-bold"
                                onClick={() => handleHealthPlanTargetedAction("owner_assignment_missing")}
                              >
                                {t("profile.healthPlanCoordinationActionOwner")}
                              </Button>
                            )}
                            <Button
                              type="button"
                              variant="outline"
                              className="h-9 rounded-full px-3 text-xs font-bold"
                              onClick={() => {
                                setOutreachChannel("phone");
                                scrollToPanel(healthPlanOutreachRef);
                              }}
                            >
                              {t("profile.healthPlanCoordinationActionClient")}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              className="h-9 rounded-full px-3 text-xs font-bold"
                              onClick={() => scrollToPanel(healthPlanHandoffRef)}
                            >
                              {t("profile.healthPlanReviewBoardActionHandoff")}
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                    {healthPlanIncidentPlaybooks.length > 0 && (
                      <div className="rounded-[22px] border border-red-100 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(255,244,245,0.82))] px-4 py-4 shadow-sm">
                        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                          <div className="min-w-0">
                            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("profile.healthPlanPlaybooksTitle")}</p>
                            <p className="mt-2 max-w-3xl text-sm leading-6 text-foreground/80">{t("profile.healthPlanPlaybooksDescription")}</p>
                          </div>
                          <Badge variant="outline" className="rounded-full border-red-200 bg-red-50 px-3 py-1 text-xs font-bold text-red-700">
                            {healthPlanIncidentPlaybooks.length} {t("profile.healthPlanPlaybooksOpen")}
                          </Badge>
                        </div>
                        <div className="mt-4 grid gap-4 xl:grid-cols-3">
                          {healthPlanIncidentPlaybooks.map((playbook) => {
                            const incidentSummary = healthPlanIncidentEpisodeSummaryByCode.get(playbook.code);
                            const incidentBusy = loggingIncidentCode === playbook.code;
                            return (
                            <div key={playbook.code} className="rounded-2xl border border-red-100 bg-white/88 p-4 shadow-sm">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="text-sm font-bold text-foreground">{healthPlanIncidentPlaybookTitle(playbook.code)}</p>
                                  <p className="mt-1 text-sm leading-6 text-muted-foreground">{playbook.triggerReason}</p>
                                </div>
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                                    playbook.priority === "high"
                                      ? "border-red-200 bg-red-50 text-red-700"
                                      : "border-amber-200 bg-amber-50 text-amber-700",
                                  )}
                                >
                                  {playbook.responseWindow === "same_day" ? t("profile.healthPlanHandoffResponseSameDay") : t("profile.healthPlanHandoffResponse24h")}
                                </Badge>
                              </div>
                              <div className="mt-3 rounded-xl border border-border/70 bg-muted/10 px-3 py-3">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{t("profile.healthPlanPlaybookStatus")}</p>
                                  <Badge variant="outline" className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold">
                                    {healthPlanIncidentEpisodeStatusLabel(incidentSummary?.status)}
                                  </Badge>
                                </div>
                                {(incidentSummary?.latestEventAt || incidentSummary?.latestEventBy || incidentSummary?.ownerName) && (
                                  <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                                    {incidentSummary?.latestEventAt && <p>{formatDateTime(incidentSummary.latestEventAt)}</p>}
                                    {(incidentSummary?.latestEventBy || incidentSummary?.ownerName) && (
                                      <p>{[incidentSummary?.latestEventBy, incidentSummary?.ownerName].filter(Boolean).join(" - ")}</p>
                                    )}
                                  </div>
                                )}
                              </div>
                              <div className="mt-4 space-y-4">
                                <div>
                                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("profile.healthPlanSafetyElder")}</p>
                                  <div className="mt-2 space-y-2">
                                    {playbook.clientSteps.map((item, index) => (
                                      <HealthPlanChecklistItem key={`${playbook.code}-client-${index}`} text={item} />
                                    ))}
                                  </div>
                                </div>
                                {playbook.careCircleSteps.length > 0 && (
                                  <div>
                                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("profile.healthPlanSafetyCareCircle")}</p>
                                    <div className="mt-2 space-y-2">
                                      {playbook.careCircleSteps.map((item, index) => (
                                        <HealthPlanChecklistItem key={`${playbook.code}-care-circle-${index}`} text={item} />
                                      ))}
                                    </div>
                                  </div>
                                )}
                                <div>
                                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("profile.healthPlanPlaybookTeam")}</p>
                                  <div className="mt-2 space-y-2">
                                    {playbook.teamSteps.map((item, index) => (
                                      <HealthPlanChecklistItem key={`${playbook.code}-team-${index}`} text={item} />
                                    ))}
                                  </div>
                                </div>
                                <div>
                                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("profile.healthPlanPlaybookClose")}</p>
                                  <div className="mt-2 space-y-2">
                                    {playbook.closeWhen.map((item, index) => (
                                      <HealthPlanChecklistItem key={`${playbook.code}-close-${index}`} text={item} />
                                    ))}
                                  </div>
                                </div>
                              </div>
                              <div className="mt-4 flex flex-wrap gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  className="h-9 rounded-full px-3 text-xs font-bold"
                                  onClick={() => handleHealthPlanIncidentPlaybookAction(playbook.actionCode)}
                                >
                                  {healthPlanIncidentPlaybookActionLabel(playbook.actionCode)}
                                </Button>
                                {incidentSummary?.status !== "open" && (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    className="h-9 rounded-full px-3 text-xs font-bold"
                                    disabled={incidentBusy}
                                    onClick={() => void handleLogHealthPlanIncidentEpisode(playbook.code, "open")}
                                  >
                                    {incidentBusy && loggingIncidentStatus === "open" ? t("userForm.saving") : t("profile.healthPlanIncidentStart")}
                                  </Button>
                                )}
                                {incidentSummary?.status === "open" && (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    className="h-9 rounded-full px-3 text-xs font-bold"
                                    disabled={incidentBusy}
                                    onClick={() => void handleLogHealthPlanIncidentEpisode(playbook.code, "closed")}
                                  >
                                    {incidentBusy && loggingIncidentStatus === "closed" ? t("userForm.saving") : t("profile.healthPlanIncidentClose")}
                                  </Button>
                                )}
                              </div>
                            </div>
                          )})}
                        </div>
                      </div>
                    )}
                    {healthPlanAudit && (
                      <div className={cn("rounded-[20px] border px-4 py-4 shadow-sm", healthPlanAuditToneClasses(healthPlanAudit.status))}>
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div className="min-w-0">
                            <p className="text-[11px] font-bold uppercase tracking-[0.16em] opacity-70">{t("profile.healthPlanAuditTitle")}</p>
                            <p className="mt-2 text-base font-bold">{healthPlanAuditStatusLabel(healthPlanAudit.status)}</p>
                            <p className="mt-1 max-w-3xl text-sm leading-6 opacity-90">{healthPlanAuditSummary(healthPlanAudit.status)}</p>
                          </div>
                          <Badge className={cn("rounded-full px-3 py-1 text-xs font-bold", healthPlanAuditBadgeClasses(healthPlanAudit.status))}>
                            {healthPlanAuditStatusLabel(healthPlanAudit.status)}
                          </Badge>
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2.5">
                          <HealthPlanMetaChip
                            label={t("profile.healthPlanAuditCheckedAt")}
                            value={healthPlanAudit.checked_at ? formatDateTime(healthPlanAudit.checked_at) : "-"}
                          />
                          <HealthPlanMetaChip
                            label={t("profile.healthPlanAuditResponse")}
                            value={
                              healthPlanAudit.response_expectation === "same_day"
                                ? t("profile.healthPlanHandoffResponseSameDay")
                                : t("profile.healthPlanHandoffResponse24h")
                            }
                          />
                          <HealthPlanMetaChip
                            label={t("profile.healthPlanAuditCriticalNow")}
                            value={String(safeArray(healthPlanAudit.current_critical_signal_ids).length)}
                          />
                        </div>
                        {healthPlanAuditReasons.length > 0 && (
                          <div className="mt-4 space-y-2">
                            {healthPlanAuditReasons.map((reason, index) => (
                              <div key={`${reason.code}-${index}`} className="flex items-start gap-2 text-sm">
                                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 opacity-80" />
                                <span>{healthPlanAuditReasonLabel(reason.code)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    {healthPlanQuality && (
                      <div className={cn("rounded-[20px] border px-4 py-4 shadow-sm", healthPlanQualityToneClasses(healthPlanQuality.trust_level))}>
                        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                          <div className="min-w-0">
                            <p className="text-[11px] font-bold uppercase tracking-[0.16em] opacity-70">{t("profile.healthPlanQualityTitle")}</p>
                            <div className="mt-2 flex flex-wrap items-center gap-3">
                              <p className="text-2xl font-bold">{copy("profile.healthPlanQualityScore", { score: healthPlanQuality.score || 0 })}</p>
                              <Badge className={cn("rounded-full px-3 py-1 text-xs font-bold", healthPlanQualityBadgeClasses(healthPlanQuality.trust_level))}>
                                {healthPlanQualityLevelLabel(healthPlanQuality.trust_level)}
                              </Badge>
                            </div>
                            <p className="mt-2 max-w-3xl text-sm leading-6 opacity-90">
                              {copy("profile.healthPlanQualityActionSummary", {
                                action: healthPlanQualityActionLabel(healthPlanQuality.recommended_action),
                              })}
                            </p>
                          </div>
                          <div className="grid min-w-[240px] gap-2 sm:grid-cols-2 xl:grid-cols-1">
                            <HealthPlanMetaChip label={t("profile.healthPlanQualityEvidence")} value={`${healthPlanQuality.evidence_coverage ?? 0}%`} />
                            <HealthPlanMetaChip label={t("profile.healthPlanQualitySignals")} value={`${healthPlanQuality.distinct_signal_coverage ?? 0}%`} />
                            <HealthPlanMetaChip label={t("profile.healthPlanQualityCritical")} value={`${healthPlanQuality.critical_action_coverage ?? 0}%`} />
                            <HealthPlanMetaChip label={t("profile.healthPlanQualityNextStep")} value={healthPlanQualityActionLabel(healthPlanQuality.recommended_action)} />
                          </div>
                        </div>
                        {healthPlanRecommendationUseTotal > 0 && (
                          <div className="mt-4 rounded-2xl border border-white/70 bg-white/60 p-4">
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                              <div className="min-w-0">
                                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                                  {t("profile.healthPlanQualityRecommendationUseTitle")}
                                </p>
                                <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                                  {t("profile.healthPlanQualityRecommendationUseSummary")}
                                </p>
                              </div>
                              <div className="grid min-w-[260px] gap-2 sm:grid-cols-2 xl:grid-cols-4">
                                <HealthPlanMetaChip
                                  label={t("profile.healthPlanQualityRecommendationUseReady")}
                                  value={String(healthPlanReadyWithJudgmentRecommendations)}
                                />
                                <HealthPlanMetaChip
                                  label={t("profile.healthPlanQualityRecommendationUseVerify")}
                                  value={String(healthPlanVerifyBeforeUseRecommendations)}
                                />
                                <HealthPlanMetaChip
                                  label={t("profile.healthPlanQualityRecommendationUseStaffReview")}
                                  value={String(healthPlanStaffReviewOnlyRecommendations)}
                                />
                                <HealthPlanMetaChip
                                  label={t("profile.healthPlanQualityRecommendationUseUrgent")}
                                  value={String(healthPlanUrgentStaffReviewOnlyRecommendations)}
                                />
                              </div>
                            </div>
                          </div>
                        )}
                        <div className="mt-4 grid gap-4 lg:grid-cols-2">
                          {healthPlanImprovementSummary && (
                            <div className={cn("rounded-2xl border p-4 shadow-sm", healthPlanImprovementToneClasses(healthPlanImprovementSummary.status))}>
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] opacity-70">{t("profile.healthPlanQualityVersionTitle")}</p>
                                  <p className="mt-2 text-base font-bold">{healthPlanImprovementStatusLabel(healthPlanImprovementSummary.status)}</p>
                                </div>
                                <Badge className={cn("rounded-full px-3 py-1 text-xs font-bold", healthPlanImprovementBadgeClasses(healthPlanImprovementSummary.status))}>
                                  {healthPlanImprovementStatusLabel(healthPlanImprovementSummary.status)}
                                </Badge>
                              </div>
                              <p className="mt-3 text-sm leading-6 opacity-90">
                                {healthPlanImprovementSummary.summary_text || t("profile.healthPlanQualityVersionBaselineSummary")}
                              </p>
                              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                                <HealthPlanMetaChip
                                  label={t("profile.healthPlanQualityVersionScoreDelta")}
                                  value={formatHealthPlanDelta(healthPlanImprovementSummary.score_delta)}
                                />
                                <HealthPlanMetaChip
                                  label={t("profile.healthPlanQualityVersionResolved")}
                                  value={String(safeArray(healthPlanImprovementSummary.resolved_issue_codes).length)}
                                />
                                <HealthPlanMetaChip
                                  label={t("profile.healthPlanQualityVersionNew")}
                                  value={String(safeArray(healthPlanImprovementSummary.new_issue_codes).length)}
                                />
                                <HealthPlanMetaChip
                                  label={t("profile.healthPlanQualityVersionChanged")}
                                  value={String(safeArray(healthPlanImprovementSummary.changed_sections).length)}
                                />
                              </div>
                            </div>
                          )}
                          {healthPlanFreshnessDecay && (
                            <div className={cn("rounded-2xl border p-4 shadow-sm", healthPlanFreshnessToneClasses(healthPlanFreshnessDecay.status))}>
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] opacity-70">{t("profile.healthPlanQualityFreshnessTitle")}</p>
                                  <p className="mt-2 text-base font-bold">{healthPlanFreshnessStatusLabel(healthPlanFreshnessDecay.status)}</p>
                                </div>
                                <Badge className={cn("rounded-full px-3 py-1 text-xs font-bold", healthPlanFreshnessBadgeClasses(healthPlanFreshnessDecay.status))}>
                                  {healthPlanFreshnessStatusLabel(healthPlanFreshnessDecay.status)}
                                </Badge>
                              </div>
                              <p className="mt-3 text-sm leading-6 opacity-90">
                                {healthPlanFreshnessDecay.summary_text || t("profile.healthPlanQualityFreshnessSummaryFallback")}
                              </p>
                              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                                <HealthPlanMetaChip
                                  label={t("profile.healthPlanQualityFreshnessRefreshBy")}
                                  value={healthPlanFreshnessDecay.refresh_recommended_by_at ? formatDateTime(healthPlanFreshnessDecay.refresh_recommended_by_at) : "-"}
                                />
                                <HealthPlanMetaChip
                                  label={t("profile.healthPlanQualityFreshnessNext")}
                                  value={
                                    healthPlanFreshnessDecay.next_status_at
                                      ? `${healthPlanFreshnessStatusLabel(healthPlanFreshnessDecay.next_status)} · ${formatDateTime(healthPlanFreshnessDecay.next_status_at)}`
                                      : healthPlanFreshnessStatusLabel(healthPlanFreshnessDecay.next_status)
                                  }
                                />
                                <HealthPlanMetaChip
                                  label={t("profile.healthPlanQualityFreshnessLive")}
                                  value={String(healthPlanFreshnessDecay.live_signal_count ?? 0)}
                                />
                                <HealthPlanMetaChip
                                  label={t("profile.healthPlanQualityFreshnessStaleSignals")}
                                  value={String(healthPlanFreshnessDecay.stale_signal_count ?? 0)}
                                />
                                <HealthPlanMetaChip
                                  label={t("profile.healthPlanQualityFreshnessTimedChecks")}
                                  value={String(healthPlanTimedRecommendationChecks)}
                                />
                                <HealthPlanMetaChip
                                  label={t("profile.healthPlanQualityFreshnessOverdueChecks")}
                                  value={String(healthPlanOverdueRecommendationChecks)}
                                />
                                <HealthPlanMetaChip
                                  label={t("profile.healthPlanQualityFreshnessNextRecheck")}
                                  value={healthPlanFreshnessDecay.earliest_recheck_due_at ? formatDateTime(healthPlanFreshnessDecay.earliest_recheck_due_at) : "-"}
                                />
                              </div>
                              {healthPlanFreshnessDecay.refresh_overdue && (
                                <div className="mt-4 rounded-xl border border-red-200 bg-white/75 px-3 py-3 text-sm font-medium text-red-900">
                                  {t("profile.healthPlanQualityFreshnessOverdueSummary")}
                                </div>
                              )}
                            </div>
                          )}
                          <div className="rounded-2xl border border-white/70 bg-white/60 p-4">
                            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("profile.healthPlanQualityWorking")}</p>
                            <div className="mt-3 space-y-2">
                              {healthPlanQualityStrengths.length === 0 ? (
                                <p className="text-sm text-muted-foreground">{t("profile.healthPlanQualityNoStrengths")}</p>
                              ) : (
                                healthPlanQualityStrengths.map((item, index) => (
                                  <div key={`${item.code}-${index}`} className={cn("flex items-start gap-2 rounded-xl border px-3 py-2 text-sm", healthPlanQualityCheckClasses(item.state))}>
                                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                                    <span>{healthPlanQualityCheckLabel(item.code)}</span>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                          <div className="rounded-2xl border border-white/70 bg-white/60 p-4">
                            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("profile.healthPlanQualityWatch")}</p>
                            <div className="mt-3 space-y-2">
                              {healthPlanQualityCautions.length === 0 ? (
                                <p className="text-sm text-muted-foreground">{t("profile.healthPlanQualityNoCautions")}</p>
                              ) : (
                                healthPlanQualityCautions.map((item, index) => (
                                  <div key={`${item.code}-${index}`} className={cn("flex items-start gap-2 rounded-xl border px-3 py-2 text-sm", healthPlanQualityCheckClasses(item.state))}>
                                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                                    <span>{healthPlanQualityCheckLabel(item.code)}</span>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    {healthPlanApprovalGate && (
                      <div
                        className={cn(
                          "rounded-[20px] border px-4 py-4 shadow-sm",
                          healthPlanApprovalGate.state === "blocked"
                            ? "border-red-200 bg-red-50/90 text-red-950"
                            : healthPlanApprovalGate.state === "review"
                              ? "border-amber-200 bg-amber-50/90 text-amber-950"
                              : "border-emerald-200 bg-emerald-50/90 text-emerald-950",
                        )}
                      >
                        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                          <div className="min-w-0">
                            <p className="text-[11px] font-bold uppercase tracking-[0.16em] opacity-70">{t("profile.healthPlanApprovalGateTitle")}</p>
                            <p className="mt-2 text-xl font-bold">{healthPlanApprovalGateStateLabel(healthPlanApprovalGate.state)}</p>
                            <p className="mt-2 max-w-3xl text-sm leading-6 opacity-90">
                              {healthPlanApprovalGate.summary_text || t("profile.healthPlanApprovalGateReadySummary")}
                            </p>
                          </div>
                          <div className="grid min-w-[260px] gap-2 sm:grid-cols-2 xl:grid-cols-1">
                            <HealthPlanMetaChip
                              label={t("profile.healthPlanApprovalGateResponse")}
                              value={healthPlanResponseWindowLabel(healthPlanApprovalGate.response_window)}
                            />
                            <HealthPlanMetaChip
                              label={t("profile.healthPlanApprovalGateBlockers")}
                              value={String(healthPlanApprovalBlockingIssues.length)}
                            />
                            <HealthPlanMetaChip
                              label={t("profile.healthPlanApprovalGateFollowThrough")}
                              value={String(healthPlanApprovalWatchIssues.length)}
                            />
                            <HealthPlanMetaChip
                              label={t("profile.healthPlanApprovalGateShare")}
                              value={healthPlanApprovalGate.ready_for_share ? t("profile.healthPlanShareReady") : t("profile.healthPlanShareReview")}
                            />
                          </div>
                        </div>
                        <div className="mt-4 grid gap-4 xl:grid-cols-2">
                          <div className="rounded-2xl border border-white/70 bg-white/65 p-4">
                            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("profile.healthPlanApprovalGateMustFix")}</p>
                            <div className="mt-3 space-y-2">
                              {healthPlanApprovalBlockingIssues.length > 0 ? (
                                healthPlanApprovalBlockingIssues.map((issue, index) => (
                                  <div key={`${issue.code}-${index}`} className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
                                    <div className="flex items-start gap-2">
                                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                                      <span>{healthPlanApprovalIssueLabel(issue)}</span>
                                    </div>
                                    <div className="mt-2">
                                      <Button
                                        type="button"
                                        variant="outline"
                                        className="h-8 rounded-full border-current/30 bg-white/80 px-3 text-[11px] font-bold"
                                        onClick={() => healthPlanApprovalIssueAction(issue)}
                                      >
                                        {t("profile.healthPlanApprovalGateFixAction")}
                                      </Button>
                                    </div>
                                  </div>
                                ))
                              ) : (
                                <p className="text-sm text-muted-foreground">{t("profile.healthPlanApprovalGateNoBlockers")}</p>
                              )}
                            </div>
                          </div>
                          <div className="rounded-2xl border border-white/70 bg-white/65 p-4">
                            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("profile.healthPlanApprovalGateWatch")}</p>
                            <div className="mt-3 space-y-2">
                              {healthPlanApprovalWatchIssues.length > 0 ? (
                                healthPlanApprovalWatchIssues.map((issue, index) => (
                                  <div key={`${issue.code}-${index}`} className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                                    <div className="flex items-start gap-2">
                                      <Clock className="mt-0.5 h-4 w-4 shrink-0" />
                                      <span>{healthPlanApprovalIssueLabel(issue)}</span>
                                    </div>
                                  </div>
                                ))
                              ) : (
                                <p className="text-sm text-muted-foreground">{t("profile.healthPlanApprovalGateNoWatch")}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    {(healthPlanReview || healthPlanGenerationAssessment) && (
                      <div
                        ref={healthPlanReviewBoardRef}
                        className={cn(
                          "rounded-[20px] border px-4 py-4 shadow-sm",
                          healthPlanReviewToneClasses(
                            healthPlanReview?.status || (healthPlanGenerationAssessment?.confidence === "low" ? "hold" : "needs_review"),
                          ),
                        )}
                      >
                        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                          <div className="min-w-0">
                            <p className="text-[11px] font-bold uppercase tracking-[0.16em] opacity-70">{t("profile.healthPlanReviewBoardTitle")}</p>
                            <div className="mt-2 flex flex-wrap items-center gap-3">
                              <p className="text-xl font-bold">
                                {healthPlanReviewStatusLabel(
                                  healthPlanReview?.status || (healthPlanGenerationAssessment?.confidence === "low" ? "hold" : "needs_review"),
                                )}
                              </p>
                              <Badge
                                className={cn(
                                  "rounded-full px-3 py-1 text-xs font-bold",
                                  healthPlanReviewBadgeClasses(
                                    healthPlanReview?.status || (healthPlanGenerationAssessment?.confidence === "low" ? "hold" : "needs_review"),
                                  ),
                                )}
                              >
                                {healthPlanReviewStatusLabel(
                                  healthPlanReview?.status || (healthPlanGenerationAssessment?.confidence === "low" ? "hold" : "needs_review"),
                                )}
                              </Badge>
                            </div>
                            <p className="mt-2 max-w-3xl text-sm leading-6 opacity-90">
                              {healthPlanReviewStatusSummary(
                                healthPlanReview?.status || (healthPlanGenerationAssessment?.confidence === "low" ? "hold" : "needs_review"),
                              )}
                            </p>
                          </div>
                          <div className="grid min-w-[260px] gap-2 sm:grid-cols-2 xl:grid-cols-1">
                            <HealthPlanMetaChip
                              label={t("profile.healthPlanReviewBoardResponse")}
                              value={healthPlanResponseWindowLabel(healthPlanReview?.response_expectation || healthPlanGenerationAssessment?.response_expectation)}
                            />
                            <HealthPlanMetaChip
                              label={t("profile.healthPlanReviewBoardConfidence")}
                              value={healthPlanGenerationConfidenceLabel(healthPlanGenerationAssessment?.confidence || healthPlanReview?.generation_confidence)}
                            />
                            <HealthPlanMetaChip
                              label={t("profile.healthPlanReviewBoardReadiness")}
                              value={healthPlanGenerationReadinessLabel(healthPlanGenerationAssessment?.readiness)}
                            />
                            <HealthPlanMetaChip
                              label={t("profile.healthPlanReviewBoardMoves")}
                              value={String(healthPlanReviewNextMoves.length)}
                            />
                          </div>
                        </div>
                        <div className="mt-4 grid gap-4 xl:grid-cols-2">
                          <div className="rounded-2xl border border-white/70 bg-white/65 p-4">
                            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("profile.healthPlanReviewBoardFocus")}</p>
                            <div className="mt-3 space-y-2">
                              {healthPlanReviewFocus.length > 0 ? (
                                healthPlanReviewFocus.map((item, index) => (
                                  <div key={`${item.code}-${index}`} className={cn("rounded-xl border px-3 py-2 text-sm", healthPlanQualityCheckClasses(item.state))}>
                                    <div className="flex items-start gap-2">
                                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                                      <span>{healthPlanReviewCheckLabel(item.code, item.detail)}</span>
                                    </div>
                                    <div className="mt-2">
                                      <Button
                                        type="button"
                                        variant="outline"
                                        className="h-8 rounded-full border-current/30 bg-white/70 px-3 text-[11px] font-bold"
                                        onClick={() => handleHealthPlanTargetedAction(item.code)}
                                      >
                                        {healthPlanTargetedActionLabel(item.code)}
                                      </Button>
                                    </div>
                                  </div>
                                ))
                              ) : (
                                healthPlanReviewStrengths.map((item, index) => (
                                  <div key={`${item.code}-${index}`} className={cn("flex items-start gap-2 rounded-xl border px-3 py-2 text-sm", healthPlanQualityCheckClasses(item.state))}>
                                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                                    <span>{healthPlanReviewCheckLabel(item.code, item.detail)}</span>
                                  </div>
                                ))
                              )}
                              {healthPlanReviewFocus.length === 0 && healthPlanReviewStrengths.length === 0 && (
                                <p className="text-sm text-muted-foreground">{t("profile.healthPlanReviewBoardNoFocus")}</p>
                              )}
                            </div>
                          </div>
                          <div className="rounded-2xl border border-white/70 bg-white/65 p-4">
                            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("profile.healthPlanReviewBoardNextMoves")}</p>
                            <div className="mt-3 space-y-2">
                              {healthPlanReviewNextMoves.length > 0 ? (
                                healthPlanReviewNextMoves.map((item, index) => (
                                  <div key={`${item.code}-${index}`} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900">
                                    <div className="flex items-start gap-2">
                                      <Clock className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                                      <span>{healthPlanReviewMoveLabel(item.code, item.text)}</span>
                                    </div>
                                    <div className="mt-2">
                                      <Button
                                        type="button"
                                        variant="outline"
                                        className="h-8 rounded-full px-3 text-[11px] font-bold"
                                        onClick={() => handleHealthPlanTargetedAction(item.code)}
                                      >
                                        {healthPlanTargetedActionLabel(item.code)}
                                      </Button>
                                    </div>
                                  </div>
                                ))
                              ) : (
                                <p className="text-sm text-muted-foreground">{t("profile.healthPlanReviewBoardNoMoves")}</p>
                              )}
                            </div>
                          </div>
                        </div>
                        {healthPlanAutomatedReview && (
                          <div className={cn("mt-4 rounded-2xl border p-4 shadow-sm", healthPlanAutomatedReviewToneClasses(healthPlanAutomatedReview.verdict))}>
                            <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                              <div className="min-w-0">
                                <p className="text-[11px] font-bold uppercase tracking-[0.16em] opacity-70">{t("profile.healthPlanAutomatedReviewTitle")}</p>
                                <div className="mt-2 flex flex-wrap items-center gap-3">
                                  <p className="text-xl font-bold">{healthPlanAutomatedReviewVerdictLabel(healthPlanAutomatedReview.verdict)}</p>
                                  <Badge className={cn("rounded-full px-3 py-1 text-xs font-bold", healthPlanAutomatedReviewBadgeClasses(healthPlanAutomatedReview.verdict))}>
                                    {healthPlanAutomatedReviewVerdictLabel(healthPlanAutomatedReview.verdict)}
                                  </Badge>
                                </div>
                                <p className="mt-2 max-w-3xl text-sm leading-6 opacity-90">
                                  {healthPlanAutomatedReview.summary_text || t("profile.healthPlanAutomatedReviewFallbackSummary")}
                                </p>
                              </div>
                              <div className="grid min-w-[260px] gap-2 sm:grid-cols-2 xl:grid-cols-1">
                                <HealthPlanMetaChip
                                  label={t("profile.healthPlanAutomatedReviewChecked")}
                                  value={healthPlanAutomatedReview.checked_at ? formatDateTime(healthPlanAutomatedReview.checked_at) : "-"}
                                />
                                <HealthPlanMetaChip
                                  label={t("profile.healthPlanAutomatedReviewShareability")}
                                  value={healthPlanAutomatedReviewShareabilityLabel(healthPlanAutomatedReview.shareability)}
                                />
                                <HealthPlanMetaChip
                                  label={t("profile.healthPlanAutomatedReviewProvider")}
                                  value={healthPlanAutomatedReview.provider || healthPlan?.generator_provider || "-"}
                                />
                                <HealthPlanMetaChip
                                  label={t("profile.healthPlanAutomatedReviewGrounding")}
                                  value={String(healthPlanAutomatedReviewSignals.length)}
                                />
                              </div>
                            </div>
                            <div className="mt-4 grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
                              <div className="space-y-4">
                                <div className="rounded-2xl border border-white/70 bg-white/65 p-4">
                                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("profile.healthPlanAutomatedReviewGroundedBy")}</p>
                                  <div className="mt-3 flex flex-wrap gap-2">
                                    {healthPlanAutomatedReviewSignals.length > 0 ? (
                                      healthPlanAutomatedReviewSignals.map((signal, index) => (
                                        <Badge
                                          key={signal?.id || `auto-signal-${index}`}
                                          variant="outline"
                                          className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", healthPlanSignalBadgeClasses(inferHealthPlanSignalStrength(signal)))}
                                        >
                                          {signal?.label || "-"}
                                        </Badge>
                                      ))
                                    ) : (
                                      <p className="text-sm text-muted-foreground">{t("profile.healthPlanAutomatedReviewNoSignals")}</p>
                                    )}
                                  </div>
                                </div>
                                <div className="rounded-2xl border border-white/70 bg-white/65 p-4">
                                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("profile.healthPlanAutomatedReviewStrengths")}</p>
                                  <div className="mt-3 space-y-2">
                                    {healthPlanAutomatedReviewStrengths.length > 0 ? (
                                      healthPlanAutomatedReviewStrengths.map((item, index) => (
                                        <div key={`auto-strength-${index}`} className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                                          <span>{item}</span>
                                        </div>
                                      ))
                                    ) : (
                                      <p className="text-sm text-muted-foreground">{t("profile.healthPlanAutomatedReviewNoStrengths")}</p>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="space-y-4">
                                <div className="rounded-2xl border border-white/70 bg-white/65 p-4">
                                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("profile.healthPlanAutomatedReviewConcerns")}</p>
                                  <div className="mt-3 space-y-2">
                                    {healthPlanAutomatedReviewConcerns.length > 0 ? (
                                      healthPlanAutomatedReviewConcerns.map((item, index) => (
                                        <div key={`${item.code}-${index}`} className={cn("flex items-start gap-2 rounded-xl border px-3 py-2 text-sm", healthPlanQualityCheckClasses(item.severity === "high" ? "critical" : "watch"))}>
                                          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                                          <span>{healthPlanAutomatedReviewConcernLabel(item.code, item.detail)}</span>
                                        </div>
                                      ))
                                    ) : (
                                      <p className="text-sm text-muted-foreground">{t("profile.healthPlanAutomatedReviewNoConcerns")}</p>
                                    )}
                                  </div>
                                </div>
                                <div className="rounded-2xl border border-white/70 bg-white/65 p-4">
                                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("profile.healthPlanAutomatedReviewActions")}</p>
                                  <div className="mt-3 space-y-2">
                                    {healthPlanAutomatedReviewActions.length > 0 ? (
                                      healthPlanAutomatedReviewActions.map((item, index) => (
                                        <div key={`auto-action-${index}`} className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900">
                                          <Clock className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                                          <span>{item}</span>
                                        </div>
                                      ))
                                    ) : (
                                      <p className="text-sm text-muted-foreground">{t("profile.healthPlanAutomatedReviewNoActions")}</p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                        {healthPlanGenerationReasons.length > 0 && (
                          <div className="mt-4 rounded-2xl border border-white/70 bg-white/55 p-4">
                            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("profile.healthPlanReviewBoardWhy")}</p>
                            <div className="mt-3 space-y-2">
                              {healthPlanGenerationReasons.map((item, index) => (
                                <div key={`${item.code}-${index}`} className="flex items-start gap-2 text-sm">
                                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 opacity-80" />
                                  <span>{healthPlanGenerationReasonLabel(item.code, item.detail)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        <div className="mt-4 rounded-2xl border border-white/70 bg-white/55 p-4">
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                            <div>
                              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("profile.healthPlanReviewBoardActions")}</p>
                              <p className="mt-1 text-sm leading-6 text-foreground/80">{t("profile.healthPlanReviewBoardActionsDescription")}</p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {canManageHealthPlan && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  className="h-9 rounded-full px-3 text-xs font-bold"
                                  onClick={() => setEditHealthPlanOpen(true)}
                                >
                                  <Pencil className="mr-1.5 h-3.5 w-3.5" />
                                  {t("profile.healthPlanReviewBoardActionEdit")}
                                </Button>
                              )}
                              {healthPlanHandoff && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  className="h-9 rounded-full px-3 text-xs font-bold"
                                  disabled={recordingHandoff}
                                  onClick={() => void handleRecordHealthPlanHandoff()}
                                >
                                  <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
                                  {t("profile.healthPlanReviewBoardActionHandoff")}
                                </Button>
                              )}
                              {reviewBoardNeedsAction && canManageHealthPlan && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  className="h-9 rounded-full border-amber-200 bg-amber-50 px-3 text-xs font-bold text-amber-800 hover:bg-amber-100 hover:text-amber-900"
                                  onClick={openAddNoteDialog}
                                >
                                  <FileText className="mr-1.5 h-3.5 w-3.5" />
                                  {t("profile.healthPlanReviewBoardActionNote")}
                                </Button>
                              )}
                              {canManageHealthPlan && (healthPlanQuality?.recommended_action === "regenerate" || healthPlanReview?.status === "hold") && (
                                <Button
                                  type="button"
                                  className="h-9 rounded-full px-3 text-xs font-bold shadow-sm"
                                  disabled={generatingHealthPlan}
                                  onClick={() => void handleGenerateHealthPlan(true)}
                                >
                                  <Brain className={cn("mr-1.5 h-3.5 w-3.5", generatingHealthPlan && "animate-spin")} />
                                  {t("profile.healthPlanReviewBoardActionRegenerate")}
                                </Button>
                              )}
                              {canManageHealthPlan && healthPlanReview?.status === "ready" && !healthPlanIsReviewed && (
                                <Button
                                  type="button"
                                  className="h-9 rounded-full bg-emerald-600 px-3 text-xs font-bold text-white shadow-sm hover:bg-emerald-700"
                                  onClick={openReviewHealthPlanDialog}
                                >
                                  <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                                  {t("profile.healthPlanReviewBoardActionApprove")}
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    {healthPlanResponseTracker && (
                      <div
                        className={cn(
                          "rounded-[20px] border px-4 py-4 shadow-sm",
                          healthPlanResponseTracker.state === "urgent"
                            ? "border-red-200 bg-red-50/90"
                            : healthPlanResponseTracker.state === "watch"
                              ? "border-amber-200 bg-amber-50/90"
                              : "border-emerald-200 bg-emerald-50/80",
                        )}
                      >
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div className="min-w-0">
                            <p className="text-[11px] font-bold uppercase tracking-[0.16em] opacity-70">{t("profile.healthPlanTrackerTitle")}</p>
                            <div className="mt-2 flex flex-wrap items-center gap-3">
                              <p className="text-xl font-bold">{healthPlanResponseTrackerStateLabel(healthPlanResponseTracker.state)}</p>
                              <Badge
                                className={cn(
                                  "rounded-full px-3 py-1 text-xs font-bold",
                                  healthPlanResponseTracker.state === "urgent"
                                    ? "bg-red-600 text-white hover:bg-red-600"
                                    : healthPlanResponseTracker.state === "watch"
                                      ? "bg-amber-500 text-white hover:bg-amber-500"
                                      : "bg-emerald-600 text-white hover:bg-emerald-600",
                                )}
                              >
                                {healthPlanResponseTrackerStateLabel(healthPlanResponseTracker.state)}
                              </Badge>
                            </div>
                            <p className="mt-2 max-w-3xl text-sm leading-6 opacity-90">{t("profile.healthPlanTrackerDescription")}</p>
                          </div>
                          <div className="grid min-w-[260px] gap-2 sm:grid-cols-2 xl:grid-cols-1">
                            <HealthPlanMetaChip
                              label={t("profile.healthPlanTrackerResponse")}
                              value={healthPlanResponseWindowLabel(healthPlanResponseTracker.responseWindow)}
                            />
                            <HealthPlanMetaChip
                              label={t("profile.healthPlanTrackerProgress")}
                              value={`${healthPlanResponseTracker.completedCount}/${healthPlanResponseTracker.totalCount}`}
                            />
                            <HealthPlanMetaChip
                              label={t("profile.healthPlanTrackerNext")}
                              value={healthPlanResponseTracker.nextStepCode ? healthPlanResponseTrackerStepLabel(healthPlanResponseTracker.nextStepCode) : t("profile.healthPlanTrackerComplete")}
                            />
                          </div>
                        </div>
                        <div className="mt-4 grid gap-3 lg:grid-cols-2">
                          {healthPlanResponseTracker.steps.map((step) => (
                            <div
                              key={step.code}
                              className={cn(
                                "rounded-2xl border bg-white/80 px-4 py-3 shadow-sm",
                                step.state === "done" ? "border-emerald-200" : step.priority === "high" ? "border-red-200" : "border-amber-200",
                              )}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex items-start gap-2.5">
                                  <span
                                    className={cn(
                                      "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
                                      step.state === "done" ? "bg-emerald-50 text-emerald-600" : step.priority === "high" ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-700",
                                    )}
                                  >
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                  </span>
                                  <div>
                                    <p className="text-sm font-semibold text-foreground">{healthPlanResponseTrackerStepLabel(step.code)}</p>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                      {step.state === "done" ? t("profile.healthPlanTrackerStepDone") : t("profile.healthPlanTrackerStepPending")}
                                    </p>
                                    <p className="mt-2 text-xs leading-5 text-muted-foreground">
                                      <span className="font-semibold text-foreground/80">{t("profile.healthPlanProofLabel")}: </span>
                                      {healthPlanCommitmentProofLabel(step.code)}
                                    </p>
                                  </div>
                                </div>
                                {step.state !== "done" && (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    className="h-8 rounded-full px-3 text-[11px] font-bold"
                                    onClick={() => handleHealthPlanResponseTrackerAction(step.code)}
                                  >
                                    {healthPlanResponseTrackerActionLabel(step.code)}
                                  </Button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {healthPlanCoordination && (
                      <div className="rounded-[20px] border border-border/80 bg-white/92 px-4 py-4 shadow-sm">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div className="min-w-0">
                            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("profile.healthPlanCoordinationTitle")}</p>
                            <p className="mt-2 max-w-3xl text-sm leading-6 text-foreground/80">{t("profile.healthPlanCoordinationDescription")}</p>
                          </div>
                          <Badge
                            variant="outline"
                            className={cn(
                              "rounded-full px-3 py-1 text-xs font-bold",
                              healthPlanCoordination.state === "urgent"
                                ? "border-red-200 bg-red-50 text-red-700"
                                : healthPlanCoordination.state === "watch"
                                  ? "border-amber-200 bg-amber-50 text-amber-700"
                                  : "border-emerald-200 bg-emerald-50 text-emerald-700",
                            )}
                          >
                            {healthPlanCoordinationStateLabel(healthPlanCoordination.state)}
                          </Badge>
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2.5">
                          <HealthPlanMetaChip
                            label={t("profile.healthPlanCoordinationResponse")}
                            value={healthPlanResponseWindowLabel(healthPlanCoordination.response_window)}
                          />
                          <HealthPlanMetaChip
                            label={t("profile.healthPlanCoordinationBoundary")}
                            value={
                              healthPlanCoordination.sharing_boundary === "staff_only"
                                ? t("profile.healthPlanHandoffSharingStaffOnly")
                                : t("profile.healthPlanHandoffSharingCareCircle")
                            }
                          />
                          <HealthPlanMetaChip
                            label={t("profile.healthPlanCoordinationOwner")}
                            value={healthPlanCoordination.owner_missing ? t("profile.healthPlanHandoffOwnerMissing") : (healthPlanCoordination.owner_name || "-")}
                          />
                          <HealthPlanMetaChip
                            label={t("profile.healthPlanCoordinationReadiness")}
                            value={healthPlanCoordination.ready_for_share ? t("profile.healthPlanShareReady") : t("profile.healthPlanShareReview")}
                          />
                        </div>
                        <div className="mt-4 rounded-2xl border border-border/70 bg-muted/15 p-4">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("profile.healthPlanCoordinationCommitments")}</p>
                              <p className="mt-1 text-sm text-muted-foreground">
                                {healthPlanCoordination.recommended_action_code
                                  ? interpolate(t("profile.healthPlanCoordinationNext"), {
                                      action: healthPlanCoordinationCommitmentLabel(healthPlanCoordination.recommended_action_code),
                                    })
                                  : t("profile.healthPlanCoordinationAllCovered")}
                              </p>
                            </div>
                            <Badge variant="secondary" className="rounded-full px-3 py-1">
                              {safeArray(healthPlanCoordination.open_commitment_codes).length}
                            </Badge>
                          </div>
                          <div className="mt-4 grid gap-3 xl:grid-cols-2">
                            {safeArray(healthPlanCoordination.commitments)
                              .filter((item) => item.status !== "not_needed")
                              .map((item) => (
                                <div
                                  key={String(item.code)}
                                  className={cn(
                                    "rounded-[18px] border px-4 py-3 shadow-sm",
                                    item.status === "covered"
                                      ? "border-emerald-100 bg-emerald-50/70"
                                      : item.priority === "high"
                                        ? "border-red-100 bg-red-50/70"
                                        : "border-amber-100 bg-amber-50/70",
                                  )}
                                >
                                  <div className="flex flex-wrap items-start justify-between gap-2">
                                    <div className="min-w-0">
                                      <p className="text-sm font-semibold text-foreground">{healthPlanCoordinationCommitmentLabel(item.code)}</p>
                                      {item.detail && <p className="mt-1 text-sm leading-6 text-muted-foreground">{item.detail}</p>}
                                      <p className="mt-2 text-xs leading-5 text-muted-foreground">
                                        <span className="font-semibold text-foreground/80">{t("profile.healthPlanProofLabel")}: </span>
                                        {healthPlanCommitmentProofLabel(item.code)}
                                      </p>
                                    </div>
                                    <Badge
                                      variant="outline"
                                      className={cn(
                                        "rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                                        item.status === "covered"
                                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                          : item.priority === "high"
                                            ? "border-red-200 bg-red-50 text-red-700"
                                            : "border-amber-200 bg-amber-50 text-amber-700",
                                      )}
                                    >
                                      {healthPlanCoordinationCommitmentStatusLabel(item.status)}
                                    </Badge>
                                  </div>
                                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                                    <div className="flex flex-wrap gap-2">
                                      <Badge variant="secondary" className="rounded-full px-2.5 py-0.5 text-[11px]">
                                        {healthPlanResponseWindowLabel(item.due_window)}
                                      </Badge>
                                      <Badge variant="secondary" className="rounded-full px-2.5 py-0.5 text-[11px]">
                                        {item.priority === "high"
                                          ? t("profile.healthPlanCoordinationPriorityHigh")
                                          : item.priority === "medium"
                                            ? t("profile.healthPlanCoordinationPriorityMedium")
                                            : t("profile.healthPlanCoordinationPriorityLow")}
                                      </Badge>
                                    </div>
                                    {item.status === "open" && (
                                      <Button
                                        type="button"
                                        variant="outline"
                                        className="h-8 rounded-full px-3 text-[11px] font-bold"
                                        onClick={() => handleHealthPlanCoordinationAction(item.code)}
                                      >
                                        {healthPlanCoordinationActionLabel(item.code)}
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              ))}
                          </div>
                        </div>
                      </div>
                    )}
                    {healthPlanExecutionPack && (
                      <div className="rounded-[20px] border border-primary/14 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(244,246,255,0.78))] px-4 py-4 shadow-sm">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div className="min-w-0">
                            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("profile.healthPlanExecutionTitle")}</p>
                            <p className="mt-2 max-w-3xl text-sm leading-6 text-foreground/80">{t("profile.healthPlanExecutionDescription")}</p>
                          </div>
                          <Badge
                            variant="outline"
                            className={cn(
                              "rounded-full px-3 py-1 text-xs font-bold",
                              healthPlanExecutionPack.state === "urgent"
                                ? "border-red-200 bg-red-50 text-red-700"
                                : healthPlanExecutionPack.state === "watch"
                                  ? "border-amber-200 bg-amber-50 text-amber-700"
                                  : "border-emerald-200 bg-emerald-50 text-emerald-700",
                            )}
                          >
                            {healthPlanExecutionStateLabel(healthPlanExecutionPack.state)}
                          </Badge>
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2.5">
                          <HealthPlanMetaChip
                            label={t("profile.healthPlanCoordinationResponse")}
                            value={healthPlanResponseWindowLabel(healthPlanExecutionPack.response_window)}
                          />
                          <HealthPlanMetaChip
                            label={t("profile.healthPlanExecutionNext")}
                            value={healthPlanExecutionNextTask ? healthPlanExecutionTaskLabel(healthPlanExecutionNextTask.code) : t("profile.healthPlanCoordinationAllCovered")}
                          />
                          <HealthPlanMetaChip
                            label={t("profile.healthPlanCoordinationOwner")}
                            value={healthPlanExecutionPack.owner_missing ? t("profile.healthPlanHandoffOwnerMissing") : (healthPlanExecutionPack.owner_name || "-")}
                          />
                          <HealthPlanMetaChip
                            label={t("profile.healthPlanExecutionSameDay")}
                            value={String(healthPlanExecutionPack.same_day_task_count || 0)}
                          />
                        </div>
                        {healthPlanExecutionNextTask && (
                          <div className="mt-4 rounded-2xl border border-border/70 bg-white/88 p-4 shadow-sm">
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                              <div className="min-w-0">
                                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("profile.healthPlanExecutionNext")}</p>
                                <p className="mt-2 text-base font-semibold text-foreground">{healthPlanExecutionTaskLabel(healthPlanExecutionNextTask.code)}</p>
                                {healthPlanExecutionNextTask.detail && (
                                  <p className="mt-2 text-sm leading-6 text-foreground/80">{healthPlanExecutionNextTask.detail}</p>
                                )}
                              </div>
                              <Button
                                type="button"
                                className="h-9 rounded-full px-4 text-xs font-bold"
                                onClick={() => handleHealthPlanExecutionAction(healthPlanExecutionNextTask.code)}
                              >
                                {healthPlanExecutionActionLabel(healthPlanExecutionNextTask.code)}
                              </Button>
                            </div>
                            <div className="mt-4 grid gap-3 xl:grid-cols-3">
                              <div className="rounded-xl border border-border/70 bg-muted/10 px-3 py-3">
                                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("profile.healthPlanExecutionAudience")}</p>
                                <p className="mt-2 text-sm font-semibold text-foreground">{healthPlanExecutionAudienceLabel(healthPlanExecutionNextTask.audience)}</p>
                              </div>
                              <div className="rounded-xl border border-border/70 bg-muted/10 px-3 py-3">
                                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("profile.healthPlanExecutionProof")}</p>
                                <p className="mt-2 text-sm leading-6 text-foreground/80">{healthPlanExecutionNextTask.completion_proof || "-"}</p>
                              </div>
                              <div className="rounded-xl border border-border/70 bg-muted/10 px-3 py-3">
                                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("profile.healthPlanExecutionEscalation")}</p>
                                <p className="mt-2 text-sm leading-6 text-foreground/80">{healthPlanExecutionNextTask.escalation_if_not_done || t("profile.healthPlanExecutionEscalationNone")}</p>
                              </div>
                            </div>
                          </div>
                        )}
                        <div className="mt-4 rounded-2xl border border-border/70 bg-white/80 p-4">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("profile.healthPlanExecutionTasks")}</p>
                              <p className="mt-1 text-sm text-muted-foreground">{t("profile.healthPlanExecutionTasksDescription")}</p>
                            </div>
                            <Badge variant="secondary" className="rounded-full px-3 py-1">
                              {healthPlanExecutionTasks.length}
                            </Badge>
                          </div>
                          {healthPlanExecutionTasks.length > 0 ? (
                            <div className="mt-4 grid gap-3 xl:grid-cols-2">
                              {healthPlanExecutionTasks.map((task) => (
                                <div
                                  key={String(task.code)}
                                  className={cn(
                                    "rounded-[18px] border px-4 py-3 shadow-sm",
                                    task.priority === "high"
                                      ? "border-red-100 bg-red-50/70"
                                      : task.priority === "medium"
                                        ? "border-amber-100 bg-amber-50/70"
                                        : "border-emerald-100 bg-emerald-50/70",
                                  )}
                                >
                                  <div className="flex flex-wrap items-start justify-between gap-2">
                                    <div className="min-w-0">
                                      <p className="text-sm font-semibold text-foreground">{healthPlanExecutionTaskLabel(task.code)}</p>
                                      {task.detail && <p className="mt-1 text-sm leading-6 text-muted-foreground">{task.detail}</p>}
                                    </div>
                                    <Badge variant="outline" className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold">
                                      {healthPlanExecutionAudienceLabel(task.audience)}
                                    </Badge>
                                  </div>
                                  <div className="mt-3 flex flex-wrap gap-2">
                                    <Badge variant="secondary" className="rounded-full px-2.5 py-0.5 text-[11px]">
                                      {healthPlanResponseWindowLabel(task.due_window)}
                                    </Badge>
                                    <Badge variant="secondary" className="rounded-full px-2.5 py-0.5 text-[11px]">
                                      {task.priority === "high"
                                        ? t("profile.healthPlanCoordinationPriorityHigh")
                                        : task.priority === "medium"
                                          ? t("profile.healthPlanCoordinationPriorityMedium")
                                          : t("profile.healthPlanCoordinationPriorityLow")}
                                    </Badge>
                                  </div>
                                  {(task.owner_label || task.completion_proof || task.escalation_if_not_done) && (
                                    <div className="mt-3 space-y-2 text-xs leading-5 text-muted-foreground">
                                      {task.owner_label && (
                                        <p>
                                          <span className="font-semibold text-foreground/80">{t("profile.healthPlanCoordinationOwner")}: </span>
                                          {task.owner_label}
                                        </p>
                                      )}
                                      {task.completion_proof && (
                                        <p>
                                          <span className="font-semibold text-foreground/80">{t("profile.healthPlanExecutionProof")}: </span>
                                          {task.completion_proof}
                                        </p>
                                      )}
                                      {task.escalation_if_not_done && (
                                        <p>
                                          <span className="font-semibold text-foreground/80">{t("profile.healthPlanExecutionEscalation")}: </span>
                                          {task.escalation_if_not_done}
                                        </p>
                                      )}
                                    </div>
                                  )}
                                  <div className="mt-3">
                                    <Button
                                      type="button"
                                      variant={healthPlanExecutionPack.next_task_code === task.code ? "default" : "outline"}
                                      className="h-8 rounded-full px-3 text-[11px] font-bold"
                                      onClick={() => handleHealthPlanExecutionAction(task.code)}
                                    >
                                      {healthPlanExecutionActionLabel(task.code)}
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="mt-4 text-sm text-muted-foreground">{t("profile.healthPlanExecutionNoTasks")}</p>
                          )}
                        </div>
                      </div>
                    )}
                    {healthPlanSharePack && (
                      <div className="rounded-[20px] border border-slate-200 bg-white/88 px-4 py-4 shadow-sm">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div className="min-w-0">
                            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("profile.healthPlanShareTitle")}</p>
                            <p className="mt-2 max-w-3xl text-sm leading-6 text-foreground/80">{t("profile.healthPlanShareDescription")}</p>
                          </div>
                          <Badge
                            variant="outline"
                            className={cn(
                              "rounded-full px-3 py-1 text-xs font-bold",
                              healthPlanSharePack.shareState === "hold"
                                ? "border-red-200 bg-red-50 text-red-700"
                                : healthPlanSharePack.shareState === "review"
                                  ? "border-amber-200 bg-amber-50 text-amber-700"
                                  : "border-emerald-200 bg-emerald-50 text-emerald-700",
                            )}
                          >
                            {healthPlanShareStateLabel(healthPlanSharePack.shareState)}
                          </Badge>
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2.5">
                          <HealthPlanMetaChip
                            label={t("profile.healthPlanShareBoundary")}
                            value={
                              healthPlanSharePack.sharingBoundary === "staff_only"
                                ? t("profile.healthPlanHandoffSharingStaffOnly")
                                : t("profile.healthPlanHandoffSharingCareCircle")
                            }
                          />
                          <HealthPlanMetaChip
                            label={t("profile.healthPlanShareToday")}
                            value={String(healthPlanSharePack.todayFocus.length)}
                          />
                        </div>
                        <div className="mt-4 grid gap-3 lg:grid-cols-2">
                          <div className="rounded-2xl border border-border/70 bg-muted/15 p-4">
                            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("profile.healthPlanShareClient")}</p>
                            <p className={cn("mt-2 text-sm leading-6", canShareHealthPlanWithClient ? "text-emerald-700" : "text-amber-900")}>
                              {canShareHealthPlanWithClient
                                ? t("profile.healthPlanShareReady")
                                : healthPlanShareBlockedReasonLabel(healthPlanShareAccess.clientBlockedReason)}
                            </p>
                          </div>
                          <div className="rounded-2xl border border-border/70 bg-muted/15 p-4">
                            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("profile.healthPlanShareCareCircle")}</p>
                            <p className={cn("mt-2 text-sm leading-6", canShareHealthPlanWithCareCircle ? "text-emerald-700" : "text-amber-900")}>
                              {canShareHealthPlanWithCareCircle
                                ? t("profile.healthPlanShareReady")
                                : healthPlanShareBlockedReasonLabel(healthPlanShareAccess.careCircleBlockedReason)}
                            </p>
                          </div>
                        </div>
                        <div className="mt-4 grid gap-4 xl:grid-cols-3">
                          <div className="rounded-2xl border border-border/70 bg-muted/15 p-4">
                            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("profile.healthPlanShareClient")}</p>
                            <div className="mt-3 space-y-2">
                              {healthPlanSharePack.clientHighlights.map((item, index) => (
                                <HealthPlanChecklistItem key={`client-${index}`} text={item} />
                              ))}
                            </div>
                          </div>
                          <div className="rounded-2xl border border-border/70 bg-muted/15 p-4">
                            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("profile.healthPlanShareCareCircle")}</p>
                            <div className="mt-3 space-y-2">
                              {healthPlanSharePack.careCircleHighlights.length > 0 ? (
                                healthPlanSharePack.careCircleHighlights.map((item, index) => (
                                  <HealthPlanChecklistItem key={`circle-${index}`} text={item} />
                                ))
                              ) : (
                                <p className="text-sm leading-6 text-muted-foreground">
                                  {healthPlanSharePack.sharingBoundary === "staff_only"
                                    ? t("profile.healthPlanShareStaffOnlyNotice")
                                    : t("profile.healthPlanShareReviewNotice")}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="rounded-2xl border border-border/70 bg-muted/15 p-4">
                            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("profile.healthPlanShareToday")}</p>
                            <div className="mt-3 space-y-2">
                              {healthPlanSharePack.todayFocus.map((item, index) => (
                                <HealthPlanChecklistItem key={`focus-${index}`} text={item} />
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    {healthPlanCommunicationPack && (
                      <div className="rounded-[20px] border border-primary/14 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(239,246,255,0.7))] px-4 py-4 shadow-sm">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div className="min-w-0">
                            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("profile.healthPlanActionBriefTitle")}</p>
                            <p className="mt-2 max-w-3xl text-sm leading-6 text-foreground/80">{t("profile.healthPlanActionBriefDescription")}</p>
                          </div>
                          {healthPlanActionBrief && (
                            <Badge
                              variant="outline"
                              className={cn(
                                "rounded-full px-3 py-1 text-xs font-bold",
                                healthPlanActionBrief.state === "urgent"
                                  ? "border-red-200 bg-red-50 text-red-700"
                                  : healthPlanActionBrief.state === "watch"
                                    ? "border-amber-200 bg-amber-50 text-amber-700"
                                    : "border-emerald-200 bg-emerald-50 text-emerald-700",
                              )}
                            >
                              {healthPlanActionBriefStateLabel(healthPlanActionBrief.state)}
                            </Badge>
                          )}
                        </div>
                        {healthPlanActionBrief && (
                          <>
                            <div className="mt-4 flex flex-wrap gap-2.5">
                              <HealthPlanMetaChip
                                label={t("profile.healthPlanActionBriefWindow")}
                                value={healthPlanResponseWindowLabel(healthPlanActionBrief.responseWindow)}
                              />
                              <HealthPlanMetaChip
                                label={t("profile.healthPlanActionBriefNext")}
                                value={
                                  healthPlanActionBrief.nextActionCode
                                    ? healthPlanCoordinationCommitmentLabel(healthPlanActionBrief.nextActionCode)
                                    : t("profile.healthPlanTrackerComplete")
                                }
                              />
                              <HealthPlanMetaChip
                                label={t("profile.healthPlanActionBriefMovement")}
                                value={healthPlanActionBrief.movementState ? healthPlanAccountabilityMovementLabel(healthPlanActionBrief.movementState) : "-"}
                              />
                              <HealthPlanMetaChip
                                label={t("profile.healthPlanActionBriefLastMove")}
                                value={healthPlanActionBrief.lastMovementAt ? formatDateTime(healthPlanActionBrief.lastMovementAt) : t("profile.healthPlanAccountabilityNoReceipt")}
                              />
                              {healthPlanActionBriefClockText(healthPlanActionBrief) && (
                                <HealthPlanMetaChip
                                  label={t("profile.healthPlanActionBriefClock")}
                                  value={healthPlanActionBriefClockText(healthPlanActionBrief) || "-"}
                                />
                              )}
                            </div>
                            {(healthPlanActionBrief.movementSummary || healthPlanActionBrief.lastMovementBy || healthPlanActionBrief.blockedReceiptCodes.length > 0) && (
                              <div className="mt-4 rounded-2xl border border-border/70 bg-white/78 p-4">
                                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                  <div className="min-w-0">
                                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("profile.healthPlanActionBriefLoop")}</p>
                                    {healthPlanActionBrief.movementSummary && (
                                      <p className="mt-2 text-sm leading-6 text-foreground/80">{healthPlanActionBrief.movementSummary}</p>
                                    )}
                                    {healthPlanActionBrief.lastMovementBy && (
                                      <p className="mt-2 text-xs leading-5 text-muted-foreground">
                                        <span className="font-semibold text-foreground/80">{t("profile.healthPlanActionBriefLastBy")}: </span>
                                        {healthPlanActionBrief.lastMovementBy}
                                      </p>
                                    )}
                                    {healthPlanActionBrief.lastMovementCode && (
                                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                                        <span className="font-semibold text-foreground/80">{t("profile.healthPlanActionBriefLastReceipt")}: </span>
                                        {healthPlanAccountabilityReceiptLabel(healthPlanActionBrief.lastMovementCode)}
                                      </p>
                                    )}
                                  </div>
                                  {healthPlanActionBrief.blockedReceiptCodes.length > 0 && (
                                    <div className="min-w-[240px]">
                                      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("profile.healthPlanActionBriefBlocked")}</p>
                                      <div className="mt-2 flex flex-wrap gap-2">
                                        {healthPlanActionBrief.blockedReceiptCodes.map((code) => (
                                          <Badge key={`brief-blocked-${code}`} variant="outline" className="rounded-full border-red-200 bg-red-50 px-2.5 py-0.5 text-[11px] font-semibold text-red-700">
                                            {healthPlanAccountabilityReceiptLabel(code)}
                                          </Badge>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                            {healthPlanActionBrief.quickActions.length > 0 && (
                              <div className="mt-4 rounded-2xl border border-border/70 bg-white/78 p-4">
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                  <div>
                                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("profile.healthPlanActionBriefMoves")}</p>
                                    <p className="mt-1 text-sm text-muted-foreground">{t("profile.healthPlanActionBriefMovesDescription")}</p>
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    {healthPlanActionBrief.quickActions.map((code) => (
                                      <Button
                                        key={`brief-action-${code}`}
                                        type="button"
                                        variant={healthPlanActionBrief.nextActionCode === code ? "default" : "outline"}
                                        className="h-9 rounded-full px-3 text-xs font-bold shadow-sm"
                                        onClick={() => handleHealthPlanResponseTrackerAction(code)}
                                      >
                                        {healthPlanResponseTrackerActionLabel(code)}
                                      </Button>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            )}
                            {healthPlanActionBrief.receiptActions.length > 0 && (
                              <div className="mt-4 rounded-2xl border border-border/70 bg-white/78 p-4">
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                  <div>
                                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("profile.healthPlanActionBriefReceipts")}</p>
                                    <p className="mt-1 text-sm text-muted-foreground">{t("profile.healthPlanActionBriefReceiptsDescription")}</p>
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    {healthPlanActionBrief.receiptActions.map((code) => (
                                      <Button
                                        key={`brief-receipt-${code}`}
                                        type="button"
                                        variant="outline"
                                        className="h-9 rounded-full px-3 text-xs font-bold"
                                        disabled={healthPlanActionBriefReceiptBusy(code)}
                                        onClick={() => handleHealthPlanActionBriefReceiptAction(code)}
                                      >
                                        {healthPlanActionBriefReceiptBusy(code)
                                          ? t("userForm.saving")
                                          : healthPlanAccountabilityActionLabel(code)}
                                      </Button>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            )}
                            <div className="mt-4 grid gap-4 xl:grid-cols-4">
                              <div className="rounded-2xl border border-border/70 bg-white/80 p-4">
                                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("profile.healthPlanActionBriefStaff")}</p>
                                <div className="mt-3 space-y-2">
                                  {healthPlanActionBrief.staffNow.map((item, index) => (
                                    <HealthPlanChecklistItem key={`brief-staff-${index}`} text={item} />
                                  ))}
                                </div>
                              </div>
                              <div className="rounded-2xl border border-border/70 bg-white/80 p-4">
                                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("profile.healthPlanActionBriefElder")}</p>
                                <div className="mt-3 space-y-2">
                                  {healthPlanActionBrief.elderNow.map((item, index) => (
                                    <HealthPlanChecklistItem key={`brief-elder-${index}`} text={item} />
                                  ))}
                                </div>
                              </div>
                              <div className="rounded-2xl border border-border/70 bg-white/80 p-4">
                                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("profile.healthPlanActionBriefCareCircle")}</p>
                                <div className="mt-3 space-y-2">
                                  {healthPlanActionBrief.careCircleNow.length > 0 ? (
                                    healthPlanActionBrief.careCircleNow.map((item, index) => (
                                      <HealthPlanChecklistItem key={`brief-circle-${index}`} text={item} />
                                    ))
                                  ) : (
                                    <p className="text-sm leading-6 text-muted-foreground">
                                      {healthPlanActionBrief.staffOnlyBoundary
                                        ? t("profile.healthPlanShareStaffOnlyNotice")
                                        : t("profile.healthPlanShareReviewNotice")}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <div className="rounded-2xl border border-border/70 bg-white/80 p-4">
                                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("profile.healthPlanActionBriefSuccess")}</p>
                                <div className="mt-3 space-y-2">
                                  {healthPlanActionBrief.successChecks.map((item, index) => (
                                    <HealthPlanChecklistItem key={`brief-success-${index}`} text={item} />
                                  ))}
                                </div>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                    {healthPlanCommunicationPack && healthPlanAudienceBriefingsPack && (
                      <div className="rounded-[20px] border border-primary/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(245,243,255,0.65))] px-4 py-4 shadow-sm">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div className="min-w-0">
                            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("profile.healthPlanCommunicationTitle")}</p>
                            <p className="mt-2 max-w-3xl text-sm leading-6 text-foreground/80">{t("profile.healthPlanCommunicationDescription")}</p>
                          </div>
                          <Badge
                            variant="outline"
                            className={cn(
                              "rounded-full px-3 py-1 text-xs font-bold",
                              healthPlanCommunicationPack.state === "hold"
                                ? "border-red-200 bg-red-50 text-red-700"
                                : healthPlanCommunicationPack.state === "review"
                                  ? "border-amber-200 bg-amber-50 text-amber-700"
                                  : "border-emerald-200 bg-emerald-50 text-emerald-700",
                            )}
                          >
                            {healthPlanCommunicationStateLabel(healthPlanCommunicationPack.state)}
                          </Badge>
                        </div>
                        <div className="mt-4 grid gap-4 xl:grid-cols-3">
                          <div className="rounded-2xl border border-border/70 bg-white/78 p-4">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("profile.healthPlanCommunicationElder")}</p>
                              {healthPlanAudienceBriefingsPack.elderLines.length > 0 && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  className="h-8 rounded-full px-3 text-xs font-bold"
                                  disabled={!canShareHealthPlanWithClient}
                                  onClick={() => void copyGuardedHealthPlanDraft(healthPlanAudienceBriefingsPack.elderLines.join("\n"), "client")}
                                >
                                  <Copy className="mr-1.5 h-3.5 w-3.5" />
                                  {t("profile.healthPlanDraftCopy")}
                                </Button>
                              )}
                            </div>
                            <div className="mt-3 space-y-2">
                              {healthPlanAudienceBriefingsPack.elderLines.map((item, index) => (
                                <HealthPlanChecklistItem key={`client-script-${index}`} text={item} />
                              ))}
                            </div>
                          </div>
                          <div className="rounded-2xl border border-border/70 bg-white/78 p-4">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("profile.healthPlanCommunicationCareCircleHelp")}</p>
                              {healthPlanAudienceBriefingsPack.careCircleLines.length > 0 && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  className="h-8 rounded-full px-3 text-xs font-bold"
                                  disabled={!canShareHealthPlanWithCareCircle}
                                  onClick={() => void copyGuardedHealthPlanDraft(healthPlanAudienceBriefingsPack.careCircleLines.join("\n"), "care_circle")}
                                >
                                  <Copy className="mr-1.5 h-3.5 w-3.5" />
                                  {t("profile.healthPlanDraftCopy")}
                                </Button>
                              )}
                            </div>
                            <div className="mt-3 space-y-2">
                              {healthPlanAudienceBriefingsPack.careCircleLines.length > 0 ? (
                                healthPlanAudienceBriefingsPack.careCircleLines.map((item, index) => (
                                  <HealthPlanChecklistItem key={`circle-script-${index}`} text={item} />
                                ))
                              ) : (
                                <p className="text-sm leading-6 text-muted-foreground">
                                  {healthPlanSharePack?.sharingBoundary === "staff_only"
                                    ? t("profile.healthPlanShareStaffOnlyNotice")
                                    : t("profile.healthPlanShareReviewNotice")}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="rounded-2xl border border-border/70 bg-white/78 p-4">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("profile.healthPlanCommunicationStaffNow")}</p>
                              {healthPlanAudienceBriefingsPack.staffItems.length > 0 && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  className="h-8 rounded-full px-3 text-xs font-bold"
                                  onClick={() => void copyHealthPlanDraft(healthPlanAudienceBriefingsPack.staffItems.map((item) => item.text).join("\n"))}
                                >
                                  <Copy className="mr-1.5 h-3.5 w-3.5" />
                                  {t("profile.healthPlanDraftCopy")}
                                </Button>
                              )}
                            </div>
                            <div className="mt-3 space-y-2">
                              {healthPlanAudienceBriefingsPack.staffItems.length > 0 ? (
                                healthPlanAudienceBriefingsPack.staffItems.map((item, index) => (
                                  <div key={`staff-brief-${index}`} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900">
                                    <div className="flex items-start gap-2">
                                      <Clock className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                                      <span>{item.text}</span>
                                    </div>
                                    {healthPlanVerificationDueLabel(item.dueWindow) && (
                                      <div className="mt-2">
                                        <Badge variant="outline" className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold">
                                          {healthPlanVerificationDueLabel(item.dueWindow)}
                                        </Badge>
                                      </div>
                                    )}
                                  </div>
                                ))
                              ) : (
                                <p className="text-sm leading-6 text-muted-foreground">{t("profile.healthPlanReviewBoardNoMoves")}</p>
                              )}
                            </div>
                            {healthPlanCommunicationPack.staffGuardrails.length > 0 && (
                              <div className="mt-4 border-t border-border/70 pt-4">
                                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("profile.healthPlanCommunicationStaff")}</p>
                                <div className="mt-3 space-y-2">
                                  {healthPlanCommunicationPack.staffGuardrails.map((item, index) => (
                                    <div key={`guardrail-${index}`} className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                                      <span>{healthPlanCommunicationGuardrailLabel(item)}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                    {healthPlanDraftPack && (
                      <div className="rounded-[20px] border border-border/80 bg-white/92 px-4 py-4 shadow-sm">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div className="min-w-0">
                            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("profile.healthPlanDraftsTitle")}</p>
                            <p className="mt-2 max-w-3xl text-sm leading-6 text-foreground/80">{t("profile.healthPlanDraftsDescription")}</p>
                          </div>
                        </div>
                        <div className="mt-4 grid gap-4 xl:grid-cols-3">
                          <div className="rounded-2xl border border-border/70 bg-muted/15 p-4">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("profile.healthPlanDraftPhone")}</p>
                              <Button
                                type="button"
                                variant="outline"
                                className="h-8 rounded-full px-3 text-xs font-bold"
                                disabled={!canShareHealthPlanWithClient}
                                onClick={() => void copyGuardedHealthPlanDraft(healthPlanDraftPack.phoneScript, "client")}
                              >
                                <Copy className="mr-1.5 h-3.5 w-3.5" />
                                {t("profile.healthPlanDraftCopy")}
                              </Button>
                            </div>
                            <pre className="mt-3 whitespace-pre-wrap rounded-xl border border-border/70 bg-white/85 p-3 text-sm leading-6 text-foreground">{healthPlanDraftPack.phoneScript}</pre>
                          </div>
                          <div className="rounded-2xl border border-border/70 bg-muted/15 p-4">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("profile.healthPlanDraftWhatsApp")}</p>
                              <Button
                                type="button"
                                variant="outline"
                                className="h-8 rounded-full px-3 text-xs font-bold"
                                disabled={!canShareHealthPlanWithClient}
                                onClick={() => void copyGuardedHealthPlanDraft(healthPlanDraftPack.whatsappDraft, "client")}
                              >
                                <Copy className="mr-1.5 h-3.5 w-3.5" />
                                {t("profile.healthPlanDraftCopy")}
                              </Button>
                            </div>
                            <pre className="mt-3 whitespace-pre-wrap rounded-xl border border-border/70 bg-white/85 p-3 text-sm leading-6 text-foreground">{healthPlanDraftPack.whatsappDraft}</pre>
                          </div>
                          <div className="rounded-2xl border border-border/70 bg-muted/15 p-4">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("profile.healthPlanDraftCareCircle")}</p>
                              {healthPlanDraftPack.careCircleDraft ? (
                                <Button
                                  type="button"
                                  variant="outline"
                                  className="h-8 rounded-full px-3 text-xs font-bold"
                                  disabled={!canShareHealthPlanWithCareCircle}
                                  onClick={() => void copyGuardedHealthPlanDraft(healthPlanDraftPack.careCircleDraft, "care_circle")}
                                >
                                  <Copy className="mr-1.5 h-3.5 w-3.5" />
                                  {t("profile.healthPlanDraftCopy")}
                                </Button>
                              ) : null}
                            </div>
                            {healthPlanDraftPack.careCircleDraft ? (
                              <pre className="mt-3 whitespace-pre-wrap rounded-xl border border-border/70 bg-white/85 p-3 text-sm leading-6 text-foreground">{healthPlanDraftPack.careCircleDraft}</pre>
                            ) : (
                              <p className="mt-3 text-sm leading-6 text-muted-foreground">{t("profile.healthPlanDraftCareCircleUnavailable")}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                    {healthPlanCommunicationPack && (
                      <div ref={healthPlanOutreachRef} className="rounded-[20px] border border-border/80 bg-white/92 px-4 py-4 shadow-sm">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div className="min-w-0">
                            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("profile.healthPlanOutreachTitle")}</p>
                            <p className="mt-2 max-w-3xl text-sm leading-6 text-foreground/80">{t("profile.healthPlanOutreachDescription")}</p>
                          </div>
                          <Badge variant="outline" className="rounded-full px-3 py-1 text-xs font-bold">
                            {healthPlanCommunicationStateLabel(healthPlanCommunicationPack.state)}
                          </Badge>
                        </div>
                        <div className="mt-4">
                          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("profile.healthPlanOutreachChannel")}</p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {(["phone", "whatsapp", "app", "in_person"] as const).map((channel) => (
                              <Button
                                key={channel}
                                type="button"
                                variant={outreachChannel === channel ? "default" : "outline"}
                                className="h-9 rounded-full px-3 text-xs font-bold"
                                onClick={() => setOutreachChannel(channel)}
                              >
                                {outreachChannelLabel(channel)}
                              </Button>
                            ))}
                          </div>
                        </div>
                        <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
                          <div className="rounded-2xl border border-border/70 bg-muted/15 p-4">
                            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("profile.healthPlanOutreachActions")}</p>
                            <div className="mt-3 flex flex-wrap gap-2">
                              <Button
                                type="button"
                                className="h-9 rounded-full px-3 text-xs font-bold shadow-sm"
                                disabled={loggingOutreachAudience !== null || !canShareHealthPlanWithClient}
                                onClick={() => void handleLogHealthPlanOutreach("client")}
                              >
                                {loggingOutreachAudience === "client" ? t("userForm.saving") : t("profile.healthPlanOutreachLogClient")}
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                className="h-9 rounded-full px-3 text-xs font-bold"
                                disabled={loggingOutreachAudience !== null || !canShareHealthPlanWithCareCircle}
                                onClick={() => void handleLogHealthPlanOutreach("care_circle")}
                              >
                                {loggingOutreachAudience === "care_circle" ? t("userForm.saving") : t("profile.healthPlanOutreachLogCareCircle")}
                              </Button>
                            </div>
                            {!canShareHealthPlanWithClient && (
                              <p className="mt-3 text-sm leading-6 text-muted-foreground">{t("profile.healthPlanOutreachBlockedReview")}</p>
                            )}
                            {canShareHealthPlanWithClient && !canShareHealthPlanWithCareCircle && (
                              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                                {healthPlanShareAccess.careCircleBlockedReason === "consent_required"
                                  ? t("profile.healthPlanOutreachBlockedConsent")
                                  : t("profile.healthPlanOutreachBlockedReview")}
                              </p>
                            )}
                          </div>
                          <div className="rounded-2xl border border-border/70 bg-muted/15 p-4">
                            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("profile.healthPlanOutreachStatus")}</p>
                            <div className="mt-3 space-y-3">
                              <div className="rounded-xl border border-border/70 bg-white/80 px-3 py-3">
                                <p className="text-sm font-semibold text-foreground">{t("profile.healthPlanOutreachClientStatus")}</p>
                                <p className="mt-1 text-sm text-muted-foreground">
                                  {outreachStatus.clientShared && outreachStatus.latestClientShare
                                    ? copy("profile.healthPlanOutreachLastShared", {
                                        date: formatDateTime(outreachStatus.latestClientShare.timestamp),
                                        channel: outreachChannelLabel(outreachStatus.latestClientShare.channel),
                                      })
                                    : t("profile.healthPlanOutreachNotSharedYet")}
                                </p>
                              </div>
                              <div className="rounded-xl border border-border/70 bg-white/80 px-3 py-3">
                                <p className="text-sm font-semibold text-foreground">{t("profile.healthPlanOutreachCareCircleStatus")}</p>
                                <p className="mt-1 text-sm text-muted-foreground">
                                  {outreachStatus.careCircleShared && outreachStatus.latestCareCircleShare
                                    ? copy("profile.healthPlanOutreachLastShared", {
                                        date: formatDateTime(outreachStatus.latestCareCircleShare.timestamp),
                                        channel: outreachChannelLabel(outreachStatus.latestCareCircleShare.channel),
                                      })
                                    : healthPlanSharePack?.sharingBoundary === "staff_only"
                                      ? t("profile.healthPlanShareStaffOnlyNotice")
                                      : t("profile.healthPlanOutreachNotSharedYet")}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    {healthPlanVerificationVisible && (
                      <div className="rounded-[20px] border border-border/80 bg-white/92 px-4 py-4 shadow-sm">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div className="min-w-0">
                            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("profile.healthPlanRealityCheckTitle")}</p>
                            <p className="mt-2 max-w-3xl text-sm leading-6 text-foreground/80">{t("profile.healthPlanRealityCheckDescription")}</p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {healthPlanContextSnapshot?.captured_at && (
                              <HealthPlanMetaChip
                                label={t("profile.healthPlanRealityCheckCaptured")}
                                value={formatDateTime(healthPlanContextSnapshot.captured_at)}
                              />
                            )}
                            {healthPlanContextSnapshot?.policy?.response_expectation && (
                              <HealthPlanMetaChip
                                label={t("profile.healthPlanRealityCheckWindow")}
                                value={
                                  String(healthPlanContextSnapshot.policy.response_expectation).toLowerCase().includes("same-day")
                                    ? t("profile.healthPlanHandoffResponseSameDay")
                                    : t("profile.healthPlanHandoffResponse24h")
                                }
                              />
                            )}
                          </div>
                        </div>
                        <div className="mt-4 grid gap-4 xl:grid-cols-3">
                          <HealthPlanVerificationColumn
                            icon={ShieldCheck}
                            tone="emerald"
                            title={t("profile.healthPlanRealityCheckKnown")}
                            description={t("profile.healthPlanRealityCheckKnownDescription")}
                            emptyLabel={t("profile.healthPlanRealityCheckKnownEmpty")}
                            items={healthPlanKnownFacts}
                            signalLookup={healthPlanSignalLookup}
                          />
                          <HealthPlanVerificationColumn
                            icon={AlertTriangle}
                            tone="amber"
                            title={t("profile.healthPlanRealityCheckQuestions")}
                            description={t("profile.healthPlanRealityCheckQuestionsDescription")}
                            emptyLabel={t("profile.healthPlanRealityCheckQuestionsEmpty")}
                            items={healthPlanOpenQuestions}
                            signalLookup={healthPlanSignalLookup}
                          />
                          <HealthPlanVerificationColumn
                            icon={Clock}
                            tone="primary"
                            title={t("profile.healthPlanRealityCheckConfirm")}
                            description={t("profile.healthPlanRealityCheckConfirmDescription")}
                            emptyLabel={t("profile.healthPlanRealityCheckConfirmEmpty")}
                            items={healthPlanNextConfirmations}
                            signalLookup={healthPlanSignalLookup}
                            confirmationStatuses={healthPlanConfirmationStatusByCode}
                            onConfirmItem={isPreviewDemo || authBypassEnabled ? undefined : handleRecordHealthPlanConfirmation}
                            confirmingCode={recordingConfirmationCode}
                            confirmationStatusLabel={healthPlanConfirmationStatusLabel}
                            confirmationReceiptLine={healthPlanConfirmationReceiptLine}
                          />
                        </div>
                      </div>
                    )}
                    <div className="rounded-[22px] border border-slate-200 bg-slate-50/70 px-5 py-5">
                      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("profile.healthPlanSummary")}</p>
                      <p className="mt-3 max-w-5xl text-[15px] font-medium leading-8 text-foreground">{healthPlan.summary_text || "-"}</p>
                      {healthPlanSummaryProvenance && (
                        <HealthPlanProvenanceBlock
                          title={t("profile.healthPlanProvenanceTitle")}
                          headline={healthPlanProvenanceHeadline(healthPlanSummaryProvenance.driverCodes)}
                          signalLabels={healthPlanSummaryProvenance.signalLabels}
                          cautionText={healthPlanProvenanceCaution(healthPlanSummaryProvenance)}
                          supportLevel={healthPlanSummaryProvenance.supportLevel}
                          linkedItemCount={healthPlanSummaryProvenance.linkedItemCount}
                          totalItemCount={healthPlanSummaryProvenance.totalItemCount}
                          liveSignalCount={healthPlanSummaryProvenance.liveSignalCount}
                          staleSignalCount={healthPlanSummaryProvenance.staleSignalCount}
                          className="mt-4"
                          compact
                        />
                      )}
                    </div>
                    <p className="text-sm leading-6 text-foreground/75">
                      {healthPlanIsReviewed ? t("profile.healthPlanReviewedSummary") : t("profile.healthPlanReadyToShare")}
                    </p>
                    <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
                      <HealthPlanMetaChip label={t("profile.healthPlanLastGenerated")} value={healthPlan.generated_at ? formatDateTime(healthPlan.generated_at) : "-"} />
                      <HealthPlanMetaChip label={t("profile.healthPlanVersion")} value={String(healthPlan.current_version || 1)} />
                      <HealthPlanMetaChip label={t("profile.language")} value={(healthPlan.language || user.language || "-").toString().toUpperCase()} />
                      <HealthPlanMetaChip label={t("profile.healthPlanGoals")} value={String(healthPlanSectionCount)} />
                      <HealthPlanMetaChip label={t("profile.healthPlanGenerationMode")} value={healthPlanUsesFallback ? t("profile.healthPlanModeFallback") : t("profile.healthPlanModeAI")} />
                      <HealthPlanMetaChip label={t("profile.healthPlanEvidenceLinked")} value={String(healthPlanEvidenceLinkedCount)} />
                      <HealthPlanMetaChip label={t("profile.healthPlanHighPrioritySignals")} value={String(healthPlanHighPrioritySignals)} />
                    </div>
                    {healthPlanNeedsTrustBoundary && (
                      <div
                        className={cn(
                          "rounded-[18px] border px-4 py-4 shadow-sm",
                          healthPlanTrustBoundaryState === "do_not_share"
                            ? "border-amber-200 bg-amber-50/90 text-amber-950"
                            : healthPlanTrustBoundaryState === "staff_review_only"
                              ? "border-slate-200 bg-slate-50/90 text-slate-950"
                              : "border-emerald-200 bg-emerald-50/90 text-emerald-950",
                        )}
                      >
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div className="min-w-0">
                            <p className="text-[11px] font-bold uppercase tracking-[0.16em] opacity-70">{t("profile.healthPlanTrustBoundaryTitle")}</p>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <p className="text-base font-bold">{healthPlanTrustBoundaryHeadline}</p>
                              <Badge
                                variant="outline"
                                className={cn(
                                  "rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                                  healthPlanTrustBoundaryState === "do_not_share"
                                    ? "border-amber-300 bg-white/80 text-amber-900"
                                    : healthPlanTrustBoundaryState === "staff_review_only"
                                      ? "border-slate-300 bg-white/80 text-slate-900"
                                      : "border-emerald-300 bg-white/80 text-emerald-900",
                                )}
                              >
                                {healthPlanTrustBoundaryStateLabel(healthPlanTrustBoundaryState)}
                              </Badge>
                            </div>
                            <p className="mt-1 max-w-3xl text-sm leading-6 opacity-90">{healthPlanTrustBoundaryDetail}</p>
                          </div>
                          <div className="grid min-w-[260px] gap-2 sm:grid-cols-2 xl:grid-cols-1">
                            <HealthPlanMetaChip
                              label={t("profile.healthPlanReviewBoardConfidence")}
                              value={healthPlanGenerationConfidenceLabel(healthPlanTrustSummary?.generation_confidence || healthPlanGenerationAssessment?.confidence)}
                            />
                            <HealthPlanMetaChip label={t("profile.healthPlanTrustBoundaryLive")} value={String(healthPlanFreshLiveSignals)} />
                            <HealthPlanMetaChip label={t("profile.healthPlanTrustBoundaryStale")} value={String(healthPlanStaleSignals)} />
                            <HealthPlanMetaChip label={t("profile.healthPlanTrustBoundaryUnknown")} value={String(healthPlanUnknownFreshnessSignals)} />
                            <HealthPlanMetaChip
                              label={t("profile.healthPlanQualityRecommendationUseVerify")}
                              value={String(healthPlanVerifyBeforeUseRecommendations)}
                            />
                            <HealthPlanMetaChip
                              label={t("profile.healthPlanQualityRecommendationUseStaffReview")}
                              value={String(healthPlanStaffReviewOnlyRecommendations)}
                            />
                          </div>
                        </div>
                        {healthPlanTrustBoundaryNextAction && (
                          <div className="mt-4 rounded-2xl border border-white/70 bg-white/70 px-4 py-3">
                            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                              {t("profile.healthPlanTrustBoundaryNextAction")}
                            </p>
                            <div className="mt-2 flex items-start gap-2 text-sm text-slate-900">
                              <Clock className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                              <span>{healthPlanTrustBoundaryNextAction}</span>
                            </div>
                          </div>
                        )}
                        <div className="mt-4 grid gap-4 xl:grid-cols-2">
                          <div className="rounded-2xl border border-white/70 bg-white/70 p-4">
                            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("profile.healthPlanTrustBoundaryWhy")}</p>
                            <div className="mt-3 space-y-2">
                              {healthPlanTrustBoundaryReasonItems.length > 0 ? (
                                healthPlanTrustBoundaryReasonItems.map((item, index) => (
                                  <div key={`trust-reason-${item.code || index}`} className="flex items-start gap-2 rounded-xl border border-amber-200 bg-white/80 px-3 py-2 text-sm">
                                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                                    <span>{healthPlanTrustBoundaryReasonLabel(item.code, item.detail)}</span>
                                  </div>
                                ))
                              ) : (
                                <p className="text-sm text-muted-foreground">{t("profile.healthPlanTrustBoundaryNoReasons")}</p>
                              )}
                            </div>
                          </div>
                          <div className="rounded-2xl border border-white/70 bg-white/70 p-4">
                            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("profile.healthPlanTrustBoundaryConfirm")}</p>
                            <div className="mt-3 space-y-2">
                              {healthPlanTrustBoundaryConfirmations.length > 0 ? (
                                healthPlanTrustBoundaryConfirmations.map((item, index) => (
                                  <div key={`trust-confirm-${item.code || index}`} className="rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm text-slate-900">
                                    <div className="flex items-start gap-2">
                                      <Clock className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                                      <span>{item.text}</span>
                                    </div>
                                    {healthPlanVerificationDueLabel(item.due_window) && (
                                      <div className="mt-2">
                                        <Badge variant="outline" className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold">
                                          {healthPlanVerificationDueLabel(item.due_window)}
                                        </Badge>
                                      </div>
                                    )}
                                  </div>
                                ))
                              ) : (
                                <p className="text-sm text-muted-foreground">{t("profile.healthPlanTrustBoundaryNoConfirmations")}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    {healthPlanVersionDelta && (
                      <HealthPlanVersionDeltaPanel
                        title={t("profile.healthPlanVersionDeltaTitle")}
                        statusLabel={healthPlanImprovementStatusLabel(healthPlanVersionDelta.status)}
                        summaryText={healthPlanVersionDelta.summaryText || t("profile.healthPlanVersionDeltaSummaryFallback")}
                        changedSectionLabels={healthPlanVersionDelta.changedSectionCodes.map((section) => healthPlanChangeSectionLabel(section))}
                        reasonItems={healthPlanVersionDelta.reasons.map((reason) => ({
                          label: healthPlanChangeEntryLabel({ code: reason.code, sections: reason.sectionCodes }),
                          signalLabels: reason.signalLabels,
                        }))}
                        driverSignalLabels={healthPlanVersionDelta.driverSignalLabels}
                        unresolvedDetails={healthPlanVersionDelta.unresolvedDetails}
                        responseShiftLabels={healthPlanVersionDelta.responseShiftCodes.map((code) => healthPlanVersionDeltaShiftLabel(code))}
                        sourceSignalsAdded={healthPlanVersionDelta.sourceSignalsAdded}
                        sourceSignalsRemoved={healthPlanVersionDelta.sourceSignalsRemoved}
                      />
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
                        {healthPlanReviewValidUntil && (
                          <span className={cn(healthPlanReviewExpired && "text-amber-700")}>
                            {t("profile.healthPlanReviewValidUntil")}: <span className="font-medium text-foreground">{formatDateTime(healthPlanReviewValidUntil)}</span>
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid gap-6 border-t border-primary/10 bg-white/80 p-6 xl:grid-cols-[minmax(0,1.85fr)_320px]">
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
                          section="goals"
                          signalLookup={healthPlanSignalLookup}
                          evidenceLabel={t("profile.healthPlanEvidence")}
                          contextSnapshot={healthPlanContextSnapshot as OperationalHealthPlanContextSnapshot | null}
                          canManageRecommendations={canEditProfile}
                          savingRecommendationKey={savingRecommendationKey}
                          onSetRecommendationDisposition={handleSetRecommendationDisposition}
                          provenance={healthPlanGoalsProvenance ? {
                            title: t("profile.healthPlanProvenanceTitle"),
                            headline: healthPlanProvenanceHeadline(healthPlanGoalsProvenance.driverCodes),
                            signalLabels: healthPlanGoalsProvenance.signalLabels,
                            cautionText: healthPlanProvenanceCaution(healthPlanGoalsProvenance),
                            supportLevel: healthPlanGoalsProvenance.supportLevel,
                            linkedItemCount: healthPlanGoalsProvenance.linkedItemCount,
                            totalItemCount: healthPlanGoalsProvenance.totalItemCount,
                            liveSignalCount: healthPlanGoalsProvenance.liveSignalCount,
                            staleSignalCount: healthPlanGoalsProvenance.staleSignalCount,
                          } : null}
                        />
                        <HealthPlanTextSection
                          title={t("profile.healthPlanDailySupport")}
                          items={healthPlan.daily_support_json}
                          section="daily_support"
                          signalLookup={healthPlanSignalLookup}
                          evidenceLabel={t("profile.healthPlanEvidence")}
                          contextSnapshot={healthPlanContextSnapshot as OperationalHealthPlanContextSnapshot | null}
                          canManageRecommendations={canEditProfile}
                          savingRecommendationKey={savingRecommendationKey}
                          onSetRecommendationDisposition={handleSetRecommendationDisposition}
                          provenance={healthPlanDailySupportProvenance ? {
                            title: t("profile.healthPlanProvenanceTitle"),
                            headline: healthPlanProvenanceHeadline(healthPlanDailySupportProvenance.driverCodes),
                            signalLabels: healthPlanDailySupportProvenance.signalLabels,
                            cautionText: healthPlanProvenanceCaution(healthPlanDailySupportProvenance),
                            supportLevel: healthPlanDailySupportProvenance.supportLevel,
                            linkedItemCount: healthPlanDailySupportProvenance.linkedItemCount,
                            totalItemCount: healthPlanDailySupportProvenance.totalItemCount,
                            liveSignalCount: healthPlanDailySupportProvenance.liveSignalCount,
                            staleSignalCount: healthPlanDailySupportProvenance.staleSignalCount,
                          } : null}
                        />
                      </div>
                    </TabsContent>

                    <TabsContent value="monitoring" className="mt-0">
                      <div className="grid gap-5 lg:grid-cols-2">
                        <HealthPlanTextSection
                          title={t("profile.healthPlanMonitoring")}
                          items={healthPlan.monitoring_json}
                          section="monitoring"
                          signalLookup={healthPlanSignalLookup}
                          evidenceLabel={t("profile.healthPlanEvidence")}
                          contextSnapshot={healthPlanContextSnapshot as OperationalHealthPlanContextSnapshot | null}
                          canManageRecommendations={canEditProfile}
                          savingRecommendationKey={savingRecommendationKey}
                          onSetRecommendationDisposition={handleSetRecommendationDisposition}
                          provenance={healthPlanMonitoringProvenance ? {
                            title: t("profile.healthPlanProvenanceTitle"),
                            headline: healthPlanProvenanceHeadline(healthPlanMonitoringProvenance.driverCodes),
                            signalLabels: healthPlanMonitoringProvenance.signalLabels,
                            cautionText: healthPlanProvenanceCaution(healthPlanMonitoringProvenance),
                            supportLevel: healthPlanMonitoringProvenance.supportLevel,
                            linkedItemCount: healthPlanMonitoringProvenance.linkedItemCount,
                            totalItemCount: healthPlanMonitoringProvenance.totalItemCount,
                            liveSignalCount: healthPlanMonitoringProvenance.liveSignalCount,
                            staleSignalCount: healthPlanMonitoringProvenance.staleSignalCount,
                          } : null}
                        />
                        <HealthPlanTextSection
                          title={t("profile.healthPlanEscalation")}
                          items={healthPlan.escalation_json}
                          section="escalation"
                          signalLookup={healthPlanSignalLookup}
                          evidenceLabel={t("profile.healthPlanEvidence")}
                          contextSnapshot={healthPlanContextSnapshot as OperationalHealthPlanContextSnapshot | null}
                          canManageRecommendations={canEditProfile}
                          savingRecommendationKey={savingRecommendationKey}
                          onSetRecommendationDisposition={handleSetRecommendationDisposition}
                          provenance={healthPlanEscalationProvenance ? {
                            title: t("profile.healthPlanProvenanceTitle"),
                            headline: healthPlanProvenanceHeadline(healthPlanEscalationProvenance.driverCodes),
                            signalLabels: healthPlanEscalationProvenance.signalLabels,
                            cautionText: healthPlanProvenanceCaution(healthPlanEscalationProvenance),
                            supportLevel: healthPlanEscalationProvenance.supportLevel,
                            linkedItemCount: healthPlanEscalationProvenance.linkedItemCount,
                            totalItemCount: healthPlanEscalationProvenance.totalItemCount,
                            liveSignalCount: healthPlanEscalationProvenance.liveSignalCount,
                            staleSignalCount: healthPlanEscalationProvenance.staleSignalCount,
                          } : null}
                        />
                      </div>
                    </TabsContent>

                    <TabsContent value="caregiver" className="mt-0">
                      <HealthPlanTextSection
                        title={t("profile.healthPlanCaregiverGuidance")}
                        items={healthPlan.caregiver_guidance_json}
                        section="caregiver_guidance"
                        signalLookup={healthPlanSignalLookup}
                        evidenceLabel={t("profile.healthPlanEvidence")}
                        contextSnapshot={healthPlanContextSnapshot as OperationalHealthPlanContextSnapshot | null}
                        canManageRecommendations={canEditProfile}
                        savingRecommendationKey={savingRecommendationKey}
                        onSetRecommendationDisposition={handleSetRecommendationDisposition}
                        provenance={healthPlanCaregiverGuidanceProvenance ? {
                          title: t("profile.healthPlanProvenanceTitle"),
                          headline: healthPlanProvenanceHeadline(healthPlanCaregiverGuidanceProvenance.driverCodes),
                          signalLabels: healthPlanCaregiverGuidanceProvenance.signalLabels,
                          cautionText: healthPlanProvenanceCaution(healthPlanCaregiverGuidanceProvenance),
                          supportLevel: healthPlanCaregiverGuidanceProvenance.supportLevel,
                          linkedItemCount: healthPlanCaregiverGuidanceProvenance.linkedItemCount,
                          totalItemCount: healthPlanCaregiverGuidanceProvenance.totalItemCount,
                          liveSignalCount: healthPlanCaregiverGuidanceProvenance.liveSignalCount,
                          staleSignalCount: healthPlanCaregiverGuidanceProvenance.staleSignalCount,
                        } : null}
                      />
                    </TabsContent>
                  </Tabs>
                </div>

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
                          {healthPlanIsReviewed ? t("profile.healthPlanReviewedSummary") : t("profile.healthPlanReviewDescription")}
                        </p>
                      </div>
                    </div>
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
                            {healthPlanReviewValidUntil && (
                              <p className={cn((healthPlan.reviewed_at || healthPlanReviewedBy) && "mt-1.5")}>
                                {t("profile.healthPlanReviewValidUntil")}: {formatDateTime(healthPlanReviewValidUntil)}
                              </p>
                            )}
                            {healthPlanReviewExpired && (
                              <p className="mt-1.5 font-medium text-amber-800">{t("profile.healthPlanReviewExpiredNotice")}</p>
                            )}
                          </div>
                        )}
                        <div className="rounded-[18px] border border-border/80 bg-white/80 px-4 py-4">
                          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                            {t("profile.healthPlanReviewAttestationTitle")}
                          </p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <HealthPlanMetaChip
                              label={t("profile.healthPlanReviewAttestationShare")}
                              value={healthPlanReviewAttestation?.approved_for_sharing ? t("profile.healthPlanShareReady") : t("profile.healthPlanShareReview")}
                            />
                            <HealthPlanMetaChip
                              label={t("profile.healthPlanReviewAttestationResponse")}
                              value={healthPlanResponseWindowLabel(healthPlanReviewAttestation?.response_expectation || healthPlanReview?.response_expectation)}
                            />
                            <HealthPlanMetaChip
                              label={t("profile.healthPlanReviewBoardConfidence")}
                              value={healthPlanGenerationConfidenceLabel(healthPlanReviewAttestation?.generation_confidence || healthPlanGenerationAssessment?.confidence)}
                            />
                          </div>
                          {healthPlanReviewConfirmedItems.length > 0 && (
                            <div className="mt-4 space-y-3">
                              <p className="text-sm font-semibold text-foreground">{t("profile.healthPlanReviewAttestationChecks")}</p>
                              <div className="space-y-2">
                                {healthPlanReviewConfirmedItems.map((code) => (
                                  <HealthPlanChecklistItem key={code} text={healthPlanReviewConfirmationLabel(code)} />
                                ))}
                              </div>
                            </div>
                          )}
                          {healthPlanReviewAttestation?.reviewer_note && (
                            <div className="mt-4 rounded-xl border border-border/70 bg-muted/15 px-3 py-3">
                              <p className="text-sm font-semibold text-foreground">{t("profile.healthPlanReviewNoteLabel")}</p>
                              <p className="mt-1 text-sm leading-6 text-muted-foreground">{healthPlanReviewAttestation.reviewer_note}</p>
                            </div>
                          )}
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
                    {healthPlanHandoff && (
                      <div ref={healthPlanHandoffRef} className="mb-4 rounded-[18px] border border-primary/10 bg-[linear-gradient(180deg,rgba(245,243,255,0.9),rgba(255,255,255,0.98))] p-4">
                        <HealthPlanOperationalHandoffPanel
                          handoff={healthPlanHandoff}
                          progress={handoffProgress}
                          canRecord={canManageHealthPlan}
                          onRecord={() => void handleRecordHealthPlanHandoff()}
                          onRecordStatus={(status) => void handleRecordHealthPlanHandoffStatus(status)}
                          recording={recordingHandoff}
                          recordingStatus={recordingHandoffStatus}
                          latestRecordedAt={latestHandoffNote?.timestamp || null}
                          latestRecordedBy={latestHandoffNote?.author || null}
                        />
                      </div>
                    )}
                    {healthPlanAccountability && (
                      <div className="mb-4 rounded-[18px] border border-border/80 bg-white/90 p-4 shadow-sm">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("profile.healthPlanAccountabilityTitle")}</p>
                            <p className="mt-1 text-sm leading-6 text-muted-foreground">{t("profile.healthPlanAccountabilityDescription")}</p>
                          </div>
                          <Badge
                            variant="outline"
                            className={cn(
                              "rounded-full px-3 py-1 text-[11px] font-semibold",
                              healthPlanAccountability.state === "urgent"
                                ? "border-red-200 bg-red-50 text-red-700"
                                : healthPlanAccountability.state === "watch"
                                  ? "border-amber-200 bg-amber-50 text-amber-700"
                                  : "border-emerald-200 bg-emerald-50 text-emerald-700",
                            )}
                          >
                            {healthPlanAccountabilityStateLabel(healthPlanAccountability.state)}
                          </Badge>
                        </div>
                        <p className="mt-3 text-sm leading-6 text-foreground/80">{healthPlanAccountability.summaryText}</p>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <HealthPlanMetaChip
                            label={t("profile.healthPlanAccountabilityLastMove")}
                            value={healthPlanAccountability.lastMovementAt ? formatDateTime(healthPlanAccountability.lastMovementAt) : "-"}
                          />
                          <HealthPlanMetaChip
                            label={t("profile.healthPlanAccountabilityMovement")}
                            value={healthPlanAccountabilityMovementLabel(healthPlanAccountability.movementState)}
                          />
                          <HealthPlanMetaChip
                            label={t("profile.healthPlanAccountabilityPending")}
                            value={String(healthPlanAccountability.pendingCount)}
                          />
                        </div>
                        {healthPlanAccountability.stalled && (
                          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-900">
                            {copy("profile.healthPlanAccountabilityStalledHint", { hours: healthPlanAccountability.staleAfterHours })}
                          </div>
                        )}
                        <div className="mt-4 space-y-2">
                          {healthPlanAccountability.receipts.map((receipt) => (
                            <div key={receipt.code} className="rounded-xl border border-border/70 bg-muted/10 px-3 py-3">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold text-foreground">{healthPlanAccountabilityReceiptLabel(receipt.code)}</p>
                                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                                    {receipt.timestamp
                                      ? [formatDateTime(receipt.timestamp), receipt.author || null].filter(Boolean).join(" - ")
                                      : t("profile.healthPlanAccountabilityNoReceipt")}
                                  </p>
                                </div>
                                <Badge variant="outline" className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold">
                                  {healthPlanAccountabilityReceiptStatusLabel(receipt.status)}
                                </Badge>
                              </div>
                              {receipt.status === "pending" && (
                                <div className="mt-2">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    className="h-8 rounded-full px-3 text-[11px] font-bold"
                                    onClick={() => handleHealthPlanAccountabilityAction(receipt.code)}
                                  >
                                    {healthPlanAccountabilityActionLabel(receipt.code)}
                                  </Button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("profile.healthPlanSourceSignals")}</p>
                        {healthPlan.generator_provider && (
                          <p className="mt-1 text-xs font-medium text-muted-foreground">
                            {healthPlan.generator_provider}
                            {healthPlan.generator_model ? ` · ${healthPlan.generator_model}` : ""}
                          </p>
                        )}
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
              </div>
            </div>
          )}
        </CardContent>
      </Card>

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

      {editUserOpen && <EditUserDialog open={editUserOpen} onOpenChange={setEditUserOpen} user={user} profileData={data} />}
      {editHealthOpen && health && <EditHealthDialog open={editHealthOpen} onOpenChange={setEditHealthOpen} vyvaUserId={user.id} health={health} />}
      {editMedOpen && <EditMedicationDialog open={editMedOpen} onOpenChange={setEditMedOpen} vyvaUserId={user.id} medication={editMedTarget} />}
      {editCaregiverOpen && <EditCaregiverDialog open={editCaregiverOpen} onOpenChange={setEditCaregiverOpen} vyvaUserId={user.id} caregiver={editCaregiverTarget} />}
      {assignProviderOpen && (
        <AssignCareProviderDialog
          open={assignProviderOpen}
          onOpenChange={handleAssignProviderOpenChange}
          userId={user.id}
          userName={fullName}
          initialStaffRole={assignProviderRole}
          initialNotes={assignProviderNotes}
          contextHint={assignProviderHint}
        />
      )}
      {editCheckinOpen && <EditServiceDialog open={editCheckinOpen} onOpenChange={setEditCheckinOpen} vyvaUserId={user.id} service={checkins} serviceName="Check-in" serviceType="checkin" />}
      {editBrainOpen && <EditServiceDialog open={editBrainOpen} onOpenChange={setEditBrainOpen} vyvaUserId={user.id} service={brainCoach} serviceName="Brain Coach" serviceType="brainCoach" />}
      {editSensorOpen && <EditSensorDialog open={editSensorOpen} onOpenChange={setEditSensorOpen} vyvaUserId={user.id} sensor={editSensorTarget} />}
      {editHealthPlanOpen && healthPlan && (
        <EditHealthPlanDialog
          open={editHealthPlanOpen}
          onOpenChange={handleHealthPlanEditorOpenChange}
          vyvaUserId={user.id}
          plan={healthPlan}
          initialFocusSection={healthPlanEditorFocus}
          contextHint={healthPlanEditorHint}
        />
      )}
      <Dialog open={healthPlanHistoryOpen} onOpenChange={setHealthPlanHistoryOpen}>
        <DialogContent className="max-w-4xl rounded-2xl border-border bg-white">
          <DialogHeader>
            <DialogTitle>{t("profile.healthPlanHistoryTitle")}</DialogTitle>
            <DialogDescription>{t("profile.healthPlanHistoryDescription")}</DialogDescription>
          </DialogHeader>
          <div className="max-h-[70vh] space-y-3 overflow-y-auto pr-1">
            {healthPlanHistoryLoading ? (
              <>
                <Skeleton className="h-32 rounded-2xl" />
                <Skeleton className="h-32 rounded-2xl" />
              </>
            ) : healthPlanHistory.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
                {t("profile.healthPlanNoHistory")}
              </div>
            ) : (
              healthPlanHistory.map((revision) => {
                const revisionReviewedBy = revision.reviewed_by_email || revision.reviewed_by_user_id || revision.actor_email || revision.actor_user_id || "-";
                const revisionUsesFallback = revision.generator_provider === "fallback";
                const revisionLineage = summarizeHealthPlanRevisionLineage(revision);
                const revisionDelta = deriveHealthPlanVersionDeltaBrief(revision);
                return (
                  <div key={revision.id} className="rounded-2xl border border-border/80 bg-white/90 p-4 shadow-sm">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge className="rounded-full bg-primary/10 px-3 py-1 text-primary hover:bg-primary/10">
                            {copy("profile.healthPlanVersionBadge", { version: revision.version_number || 1 })}
                          </Badge>
                          <Badge variant="secondary" className="rounded-full px-3 py-1">
                            {healthPlanActionLabel(revision.action_type)}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={cn(
                              "rounded-full px-3 py-1",
                              revision.review_status === "reviewed"
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                : "border-amber-200 bg-amber-50 text-amber-700",
                            )}
                          >
                            {revision.review_status === "reviewed" ? t("profile.healthPlanReviewedBadge") : t("profile.healthPlanDraftBadge")}
                          </Badge>
                        </div>
                        <p className="text-sm font-semibold text-foreground">{revision.summary_text || "-"}</p>
                        <div className="flex flex-wrap gap-2">
                          <HealthPlanMetaChip label={t("profile.healthPlanGenerationMode")} value={revisionUsesFallback ? t("profile.healthPlanModeFallback") : t("profile.healthPlanModeAI")} />
                          <HealthPlanMetaChip label={t("profile.healthPlanEvidenceLinked")} value={String(countRevisionEvidence(revision))} />
                          <HealthPlanMetaChip label={t("profile.healthPlanSourceSignals")} value={String(safeArray(revision.source_signals_json).length)} />
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Badge
                            variant="outline"
                            className={cn(
                              "rounded-full px-3 py-1 text-[11px] font-semibold",
                              revisionLineage.contentChanged
                                ? "border-primary/25 bg-primary/10 text-primary"
                                : "border-slate-200 bg-slate-50 text-slate-600",
                            )}
                          >
                            {revisionLineage.contentChanged ? t("profile.healthPlanHistoryContentChanged") : t("profile.healthPlanHistoryContentStable")}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={cn(
                              "rounded-full px-3 py-1 text-[11px] font-semibold",
                              revisionLineage.evidenceShifted
                                ? "border-amber-200 bg-amber-50 text-amber-700"
                                : "border-slate-200 bg-slate-50 text-slate-600",
                            )}
                          >
                            {revisionLineage.evidenceShifted ? t("profile.healthPlanHistoryEvidenceShifted") : t("profile.healthPlanHistoryEvidenceStable")}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={cn(
                              "rounded-full px-3 py-1 text-[11px] font-semibold",
                              revisionLineage.reviewUpdated
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                : "border-slate-200 bg-slate-50 text-slate-600",
                            )}
                          >
                            {revisionLineage.reviewUpdated ? t("profile.healthPlanHistoryReviewUpdated") : t("profile.healthPlanHistoryReviewStable")}
                          </Badge>
                        </div>
                        {safeArray(revision.change_summary_json?.entries).length > 0 && (
                          <div className="rounded-[18px] border border-border/70 bg-muted/15 px-4 py-3">
                            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                              {t("profile.healthPlanChangeSummaryTitle")}
                            </p>
                            <ul className="mt-2 space-y-1.5 text-sm text-foreground">
                              {safeArray(revision.change_summary_json?.entries).slice(0, 4).map((entry, index) => (
                                <li key={`${entry.code || "change"}-${index}`} className="flex gap-2">
                                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary/60" />
                                  <span>{healthPlanChangeEntryLabel(entry)}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {revisionDelta && (
                          <HealthPlanVersionDeltaPanel
                            title={t("profile.healthPlanVersionDeltaTitle")}
                            statusLabel={healthPlanImprovementStatusLabel(revisionDelta.status)}
                            summaryText={revisionDelta.summaryText || t("profile.healthPlanVersionDeltaSummaryFallback")}
                            changedSectionLabels={revisionDelta.changedSectionCodes.map((section) => healthPlanChangeSectionLabel(section))}
                            reasonItems={revisionDelta.reasons.map((reason) => ({
                              label: healthPlanChangeEntryLabel({ code: reason.code, sections: reason.sectionCodes }),
                              signalLabels: reason.signalLabels,
                            }))}
                            driverSignalLabels={revisionDelta.driverSignalLabels}
                            unresolvedDetails={revisionDelta.unresolvedDetails}
                            responseShiftLabels={revisionDelta.responseShiftCodes.map((code) => healthPlanVersionDeltaShiftLabel(code))}
                            sourceSignalsAdded={revisionDelta.sourceSignalsAdded}
                            sourceSignalsRemoved={revisionDelta.sourceSignalsRemoved}
                            compact
                            className="mt-3"
                          />
                        )}
                      </div>
                      <div className="min-w-[220px] rounded-[18px] border border-border/70 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                        <p>{t("profile.healthPlanChangedAt")}: <span className="font-medium text-foreground">{revision.created_at ? formatDateTime(revision.created_at) : "-"}</span></p>
                        <p className="mt-1.5">{t("profile.healthPlanChangedBy")}: <span className="font-medium text-foreground">{revisionReviewedBy}</span></p>
                        <p className="mt-1.5">{t("profile.healthPlanHistorySignalDelta")}: <span className="font-medium text-foreground">{`+${revisionLineage.sourceSignalsAdded} / -${revisionLineage.sourceSignalsRemoved}`}</span></p>
                        {revision.generated_at && (
                          <p className="mt-1.5">{t("profile.healthPlanLastGenerated")}: <span className="font-medium text-foreground">{formatDateTime(revision.generated_at)}</span></p>
                        )}
                        {revision.automated_reviewed_at && (
                          <p className="mt-1.5">{t("profile.healthPlanHistoryAutomatedReviewedAt")}: <span className="font-medium text-foreground">{formatDateTime(revision.automated_reviewed_at)}</span></p>
                        )}
                        {revision.review_attestation_json?.checked_at && (
                          <p className="mt-1.5">{t("profile.healthPlanHistoryStaffReviewedAt")}: <span className="font-medium text-foreground">{formatDateTime(revision.review_attestation_json.checked_at)}</span></p>
                        )}
                        {revision.review_valid_until && (
                          <p className="mt-1.5">{t("profile.healthPlanReviewValidUntil")}: <span className="font-medium text-foreground">{formatDateTime(revision.review_valid_until)}</span></p>
                        )}
                        {revision.review_attestation_json?.reviewer_note && (
                          <p className="mt-1.5">{t("profile.healthPlanReviewNoteLabel")}: <span className="font-medium text-foreground">{revision.review_attestation_json.reviewer_note}</span></p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" className="rounded-full" onClick={() => setHealthPlanHistoryOpen(false)}>
              {t("userForm.cancel")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={reviewHealthPlanOpen} onOpenChange={(open) => !reviewHealthPlanSaving && setReviewHealthPlanOpen(open)}>
        <DialogContent className="max-w-2xl rounded-2xl border-border bg-white">
          <DialogHeader>
            <DialogTitle>{t("profile.healthPlanReviewConfirmTitle")}</DialogTitle>
            <DialogDescription>{t("profile.healthPlanReviewConfirmDescription")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
              {t("profile.healthPlanReviewConfirmHint")}
            </div>
            {healthPlanApprovalGate && (
              <div
                className={cn(
                  "rounded-2xl border px-4 py-3 text-sm",
                  healthPlanApprovalGate.state === "blocked"
                    ? "border-red-200 bg-red-50 text-red-950"
                    : healthPlanApprovalGate.state === "review"
                      ? "border-amber-200 bg-amber-50 text-amber-950"
                      : "border-emerald-200 bg-emerald-50 text-emerald-950",
                )}
              >
                <p className="font-semibold">{healthPlanApprovalGateStateLabel(healthPlanApprovalGate.state)}</p>
                <p className="mt-1 leading-6">
                  {healthPlanApprovalGate.summary_text || t("profile.healthPlanApprovalGateReadySummary")}
                </p>
                {healthPlanApprovalBlockingIssues.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {healthPlanApprovalBlockingIssues.map((issue, index) => (
                      <div key={`review-blocker-${issue.code}-${index}`} className="flex items-start gap-2">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                        <span>{healthPlanApprovalIssueLabel(issue)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            <div className="space-y-3">
              {healthPlanReviewConfirmationKeys.map((key) => (
                <label
                  key={key}
                  className="flex items-start gap-3 rounded-2xl border border-border/80 bg-muted/10 px-4 py-3 text-sm text-foreground"
                >
                  <Checkbox
                    checked={reviewHealthPlanConfirmations[key]}
                    onCheckedChange={(checked) =>
                      setReviewHealthPlanConfirmations((current) => ({ ...current, [key]: checked === true }))
                    }
                    className="mt-0.5"
                  />
                  <span className="leading-6">{healthPlanReviewConfirmationLabel(key)}</span>
                </label>
              ))}
            </div>
            <div className="space-y-2">
              <Label htmlFor="health-plan-review-note">{t("profile.healthPlanReviewNoteLabel")}</Label>
              <Textarea
                id="health-plan-review-note"
                value={reviewHealthPlanNote}
                onChange={(event) => setReviewHealthPlanNote(event.target.value)}
                placeholder={t("profile.healthPlanReviewNotePlaceholder")}
                className="min-h-24 rounded-xl"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="rounded-full"
              disabled={reviewHealthPlanSaving}
              onClick={() => setReviewHealthPlanOpen(false)}
            >
              {t("userForm.cancel")}
            </Button>
            <Button
              type="button"
              className="rounded-full bg-emerald-600 text-white hover:bg-emerald-700"
              disabled={reviewHealthPlanSaving || !healthPlanReviewCanApprove}
              onClick={() => void handleMarkHealthPlanReviewed()}
            >
              {reviewHealthPlanSaving ? t("userForm.saving") : t("profile.healthPlanReviewBoardActionApprove")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={addNoteOpen} onOpenChange={handleAddNoteOpenChange}>
        <DialogContent className="max-w-lg rounded-2xl border-border bg-white">
          <DialogHeader>
            <DialogTitle>{t("profile.addNoteTitle")}</DialogTitle>
            <DialogDescription>{t("profile.addNoteDescription")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {noteDialogHint ? (
              <div className="rounded-2xl border border-primary/15 bg-primary/5 px-4 py-3 text-sm text-muted-foreground">
                {noteDialogHint}
              </div>
            ) : null}
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
            <Button type="button" variant="outline" className="rounded-full" disabled={savingNote} onClick={() => handleAddNoteOpenChange(false)}>
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
  contextSnapshot,
  section,
  provenance,
  canManageRecommendations = false,
  savingRecommendationKey = null,
  onSetRecommendationDisposition,
}: {
  title: string;
  items?: HealthPlanSectionItem[] | null;
  variant?: "list" | "summary";
  signalLookup?: Map<string, { id?: string; label?: string | null; detail?: string | null; strength?: string | null; freshness?: string | null }>;
  evidenceLabel?: string;
  contextSnapshot?: OperationalHealthPlanContextSnapshot | null;
  section: HealthPlanSectionCode;
  provenance?: {
    title: string;
    headline: string;
    signalLabels: string[];
    cautionText: string;
    supportLevel: HealthPlanProvenanceSupportLevel;
    linkedItemCount: number;
    totalItemCount: number;
    liveSignalCount: number;
    staleSignalCount: number;
  } | null;
  canManageRecommendations?: boolean;
  savingRecommendationKey?: string | null;
  onSetRecommendationDisposition?: (
    section: Exclude<HealthPlanSectionCode, "summary">,
    itemId: string,
    disposition: HealthPlanRecommendationDisposition | null,
  ) => void | Promise<void>;
}) {
  const { t, copy } = useLanguage();
  const content = safeArray(items).filter((item) => item?.text);
  return (
    <div className="rounded-[20px] border border-slate-200 bg-slate-50/55 px-5 py-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{title}</p>
        {provenance ? (
          <p className="max-w-[280px] text-xs leading-5 text-muted-foreground sm:text-right">{provenance.headline}</p>
        ) : null}
      </div>
      {provenance && (
        <HealthPlanProvenanceBlock
          title={provenance.title}
          headline={provenance.headline}
          signalLabels={provenance.signalLabels}
          cautionText={provenance.cautionText}
          supportLevel={provenance.supportLevel}
          linkedItemCount={provenance.linkedItemCount}
          totalItemCount={provenance.totalItemCount}
          liveSignalCount={provenance.liveSignalCount}
          staleSignalCount={provenance.staleSignalCount}
          className="mt-3"
          compact
        />
      )}
      {content.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">-</p>
      ) : variant === "summary" ? (
        <p className="mt-3 text-sm font-medium leading-7 text-foreground">{content[0].text}</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {content.map((item, index) => (
            <li key={item.id || `${title}-${index}`} className="rounded-2xl border border-white/80 bg-white/88 px-4 py-3">
              {(() => {
                const evidenceStatus = deriveHealthPlanItemEvidenceStatus({
                  item,
                  signals: signalLookup ? Array.from(signalLookup.values()) : [],
                });
                const recommendationRationale = deriveHealthPlanRecommendationRationale({
                  item,
                  signals: signalLookup ? Array.from(signalLookup.values()) : [],
                  contextSnapshot,
                  section,
                });
                const recommendationConfidence = deriveHealthPlanRecommendationConfidence({
                  item,
                  signals: signalLookup ? Array.from(signalLookup.values()) : [],
                  contextSnapshot,
                  section,
                });
                const recommendationPriority = item.priority
                  || (recommendationConfidence?.state === "urgent_review"
                    ? "high"
                    : recommendationConfidence?.state === "verify_first" || recommendationConfidence?.state === "staff_review_only"
                      ? "medium"
                      : section === "caregiver_guidance"
                        ? "low"
                        : "medium");
                const recommendationDueWindow = item.due_window
                  || (
                    String(contextSnapshot?.policy?.response_expectation || "").toLowerCase() === "same-day review"
                    && section !== "caregiver_guidance"
                      ? "same_day"
                      : "within_24h"
                  );
                const recommendationFreshness = item.evidence_freshness || (
                  evidenceStatus?.state === "stale"
                    ? "stale"
                    : evidenceStatus?.state === "missing"
                      ? "unknown"
                      : evidenceStatus?.liveSignalCount
                        ? "live"
                        : "recent"
                );
                const recommendationConflict = item.evidence_conflict || (
                  recommendationConfidence?.reasonCodes.includes("urgent_signal_linked")
                    ? "conflicted"
                    : recommendationConfidence?.reasonCodes.includes("stale_inputs") || recommendationConfidence?.reasonCodes.includes("fresh_check_needed")
                      ? "freshness_gap"
                      : "clear"
                );
                const recommendationLastVerifiedAt = item.last_verified_at || null;
                const recommendationRecheckDueAt = item.recheck_due_at || null;
                const recommendationRecheckOverdue = Boolean(
                  recommendationRecheckDueAt
                  && getTimestampMs(recommendationRecheckDueAt) != null
                  && (getTimestampMs(recommendationRecheckDueAt) as number) <= Date.now(),
                );
                const hasMetaBadges = Boolean(
                  evidenceStatus || recommendationConfidence || recommendationPriority || recommendationDueWindow || recommendationFreshness || recommendationConflict,
                );
                return hasMetaBadges ? (
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <Badge
                      variant="outline"
                      className={cn(
                        "rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                        healthPlanRecommendationPriorityClasses(recommendationPriority),
                      )}
                    >
                      {recommendationPriority === "high"
                        ? t("profile.healthPlanRecommendationPriorityHigh")
                        : recommendationPriority === "low"
                          ? t("profile.healthPlanRecommendationPriorityLow")
                          : t("profile.healthPlanRecommendationPriorityMedium")}
                    </Badge>
                    <Badge variant="outline" className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold">
                      {recommendationDueWindow === "same_day"
                        ? t("profile.healthPlanRecommendationDueSameDay")
                        : t("profile.healthPlanRecommendationDue24h")}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={cn(
                        "rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                        healthPlanRecommendationFreshnessClasses(recommendationFreshness),
                      )}
                    >
                      {recommendationFreshness === "live"
                        ? t("profile.healthPlanRecommendationFreshnessLive")
                        : recommendationFreshness === "recent"
                          ? t("profile.healthPlanRecommendationFreshnessRecent")
                          : recommendationFreshness === "mixed"
                            ? t("profile.healthPlanRecommendationFreshnessMixed")
                            : recommendationFreshness === "stale"
                              ? t("profile.healthPlanRecommendationFreshnessStale")
                              : t("profile.healthPlanRecommendationFreshnessUnknown")}
                    </Badge>
                    {recommendationConflict !== "clear" && (
                      <Badge
                        variant="outline"
                        className={cn(
                          "rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                          healthPlanRecommendationConflictClasses(recommendationConflict),
                        )}
                      >
                        {recommendationConflict === "conflicted"
                          ? t("profile.healthPlanRecommendationConflictConflicted")
                          : t("profile.healthPlanRecommendationConflictFreshnessGap")}
                      </Badge>
                    )}
                    {evidenceStatus ? (
                      <>
                    <Badge
                      variant="outline"
                      className={cn(
                        "rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                        evidenceStatus.state === "missing"
                          ? "border-amber-200 bg-amber-50 text-amber-700"
                          : evidenceStatus.state === "stale"
                            ? "border-slate-200 bg-slate-100 text-slate-700"
                            : "border-emerald-200 bg-emerald-50 text-emerald-700",
                      )}
                    >
                      {evidenceStatus.state === "missing"
                        ? t("profile.healthPlanEvidenceNeedsLink")
                        : evidenceStatus.state === "stale"
                          ? t("profile.healthPlanEvidenceNeedsFreshCheck")
                          : t("profile.healthPlanEvidenceLinked")}
                    </Badge>
                    {evidenceStatus.state !== "missing" && evidenceStatus.signalLabels.length > 0 && (
                      <p className="text-xs leading-5 text-muted-foreground">
                        {copy("profile.healthPlanEvidenceLinkedSummary", {
                          signals: evidenceStatus.signalLabels.join(", "),
                        })}
                      </p>
                    )}
                      </>
                    ) : null}
                    {recommendationConfidence && (
                      <div className="basis-full">
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <Badge
                            variant="outline"
                            className={cn(
                              "rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                              recommendationConfidence.state === "urgent_review"
                                ? "border-red-200 bg-red-50 text-red-700"
                                : recommendationConfidence.state === "verify_first"
                                  ? "border-amber-200 bg-amber-50 text-amber-700"
                                  : recommendationConfidence.state === "staff_review_only"
                                    ? "border-slate-300 bg-slate-100 text-slate-700"
                                  : "border-emerald-200 bg-emerald-50 text-emerald-700",
                            )}
                          >
                            {recommendationConfidence.state === "urgent_review"
                              ? t("profile.healthPlanRecommendationUrgentReview")
                              : recommendationConfidence.state === "verify_first"
                                ? t("profile.healthPlanRecommendationVerifyFirst")
                                : recommendationConfidence.state === "staff_review_only"
                                  ? t("profile.healthPlanRecommendationStaffReviewOnly")
                                : t("profile.healthPlanRecommendationReady")}
                          </Badge>
                          <p className="text-xs leading-5 text-muted-foreground">
                            {recommendationConfidence.verificationText}
                          </p>
                        </div>
                      </div>
                    )}
                    {recommendationConflict !== "clear" && (
                      <div className="basis-full">
                        <p className="text-xs leading-5 text-muted-foreground">
                          {recommendationConflict === "conflicted"
                            ? t("profile.healthPlanRecommendationConflictConflictedHint")
                            : t("profile.healthPlanRecommendationConflictFreshnessGapHint")}
                        </p>
                      </div>
                    )}
                    {(recommendationLastVerifiedAt || recommendationRecheckDueAt) && (
                      <div className="basis-full">
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs leading-5 text-muted-foreground">
                          {recommendationLastVerifiedAt && (
                            <span>
                              {copy("profile.healthPlanRecommendationLastVerified", {
                                date: formatDateTime(recommendationLastVerifiedAt),
                                relative: formatRelativeTime(recommendationLastVerifiedAt),
                              })}
                            </span>
                          )}
                          {recommendationRecheckDueAt && (
                            <span className={cn(recommendationRecheckOverdue && "text-amber-700")}>
                              {copy(
                                recommendationRecheckOverdue
                                  ? "profile.healthPlanRecommendationRecheckOverdue"
                                  : "profile.healthPlanRecommendationRecheckBy",
                                {
                                  date: formatDateTime(recommendationRecheckDueAt),
                                  relative: formatRelativeTime(recommendationRecheckDueAt),
                                },
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ) : null;
              })()}
              {(() => {
                const recommendationRationale = deriveHealthPlanRecommendationRationale({
                  item,
                  signals: signalLookup ? Array.from(signalLookup.values()) : [],
                  contextSnapshot,
                  section,
                });
                if (!recommendationRationale) return null;
                const driverLabels = recommendationRationale.driverCodes
                  .map((driver) => healthPlanProvenanceDriverLabel(driver))
                  .filter(Boolean);
                return (
                  <div className="mb-3 rounded-2xl border border-primary/10 bg-primary/5 px-3 py-3">
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                      {t("profile.healthPlanRecommendationWhyNow")}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-foreground">
                      {driverLabels.length > 0
                        ? copy("profile.healthPlanRecommendationDrivenBy", {
                          drivers: driverLabels.join(", "),
                        })
                        : t("profile.healthPlanRecommendationDrivenFallback")}
                    </p>
                    {recommendationRationale.signalLabels.length > 0 && (
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        {copy("profile.healthPlanRecommendationGroundedIn", {
                          signals: recommendationRationale.signalLabels.join(", "),
                        })}
                      </p>
                    )}
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      {recommendationRationale.verificationText}
                    </p>
                  </div>
                );
              })()}
              {section !== "summary" && canManageRecommendations && item.id && onSetRecommendationDisposition && (
                <div className="mb-3 rounded-2xl border border-slate-200 bg-slate-50/75 px-3 py-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                        {t("profile.healthPlanRecommendationDecision")}
                      </p>
                      {item.staff_disposition ? (
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <Badge
                            variant="outline"
                            className={cn(
                              "rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                              healthPlanRecommendationDispositionClasses(item.staff_disposition),
                            )}
                          >
                            {item.staff_disposition === "confirmed"
                              ? t("profile.healthPlanRecommendationConfirmed")
                              : item.staff_disposition === "deferred"
                                ? t("profile.healthPlanRecommendationDeferred")
                                : t("profile.healthPlanRecommendationEscalated")}
                          </Badge>
                          {(item.staff_disposition_updated_at || item.staff_disposition_updated_by_email || item.staff_disposition_updated_by) && (
                            <p className="text-xs leading-5 text-muted-foreground">
                              {copy("profile.healthPlanRecommendationUpdated", {
                                actor: item.staff_disposition_updated_by_email || item.staff_disposition_updated_by || t("profile.healthPlanRecommendationTeam"),
                                date: item.staff_disposition_updated_at ? formatDateTime(item.staff_disposition_updated_at) : "-",
                              })}
                            </p>
                          )}
                        </div>
                      ) : (
                        <p className="mt-2 text-xs leading-5 text-muted-foreground">{t("profile.healthPlanRecommendationNeedsDecision")}</p>
                      )}
                    </div>
                    {savingRecommendationKey === `${section}:${item.id}` && (
                      <Badge variant="outline" className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold">
                        {t("userForm.saving")}
                      </Badge>
                    )}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={item.staff_disposition === "confirmed" ? "default" : "outline"}
                      className="rounded-full"
                      disabled={savingRecommendationKey === `${section}:${item.id}`}
                      onClick={() => onSetRecommendationDisposition(section, item.id!, item.staff_disposition === "confirmed" ? null : "confirmed")}
                    >
                      <CheckCircle2 className="mr-1.5 h-4 w-4" />
                      {t("profile.healthPlanRecommendationActionConfirm")}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={item.staff_disposition === "deferred" ? "default" : "outline"}
                      className="rounded-full"
                      disabled={savingRecommendationKey === `${section}:${item.id}`}
                      onClick={() => onSetRecommendationDisposition(section, item.id!, item.staff_disposition === "deferred" ? null : "deferred")}
                    >
                      <Clock className="mr-1.5 h-4 w-4" />
                      {t("profile.healthPlanRecommendationActionDefer")}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={item.staff_disposition === "escalated" ? "destructive" : "outline"}
                      className="rounded-full"
                      disabled={savingRecommendationKey === `${section}:${item.id}`}
                      onClick={() => onSetRecommendationDisposition(section, item.id!, item.staff_disposition === "escalated" ? null : "escalated")}
                    >
                      <AlertTriangle className="mr-1.5 h-4 w-4" />
                      {t("profile.healthPlanRecommendationActionEscalate")}
                    </Button>
                    {item.staff_disposition && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="rounded-full"
                        disabled={savingRecommendationKey === `${section}:${item.id}`}
                        onClick={() => onSetRecommendationDisposition(section, item.id!, null)}
                      >
                        {t("profile.healthPlanRecommendationActionReset")}
                      </Button>
                    )}
                  </div>
                </div>
              )}
              {(item.owner_label || item.completion_proof || item.escalation_if_not_done) && (
                <div className="mb-3 grid gap-2 rounded-2xl border border-slate-200 bg-slate-50/65 px-3 py-3">
                  {item.owner_label && (
                    <div className="flex items-start gap-2.5 text-sm">
                      <UserRound className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                          {t("profile.healthPlanRecommendationOwner")}
                        </p>
                        <p className="mt-1 leading-6 text-foreground">{item.owner_label}</p>
                      </div>
                    </div>
                  )}
                  {item.completion_proof && (
                    <div className="flex items-start gap-2.5 text-sm">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                          {t("profile.healthPlanRecommendationCompletionProof")}
                        </p>
                        <p className="mt-1 leading-6 text-foreground">{item.completion_proof}</p>
                      </div>
                    </div>
                  )}
                  {item.escalation_if_not_done && (
                    <div className="flex items-start gap-2.5 text-sm">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                          {t("profile.healthPlanRecommendationFallback")}
                        </p>
                        <p className="mt-1 leading-6 text-foreground">{item.escalation_if_not_done}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
              <div className="flex gap-2.5 text-sm leading-7 text-foreground">
                <span className="mt-[0.85rem] h-1.5 w-1.5 shrink-0 rounded-full bg-primary/80" />
                <div className="min-w-0">
                  <span>{item.text}</span>
                </div>
              </div>
              {signalLookup && safeArray(item.source_signal_ids).length > 0 && (
                <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-3">
                  {evidenceLabel && (
                    <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{evidenceLabel}</span>
                  )}
                  {safeArray(item.source_signal_ids)
                    .map((signalId) => signalLookup.get(signalId))
                    .filter(Boolean)
                    .slice(0, 3)
                    .map((signal, signalIndex) => {
                      const strength = inferHealthPlanSignalStrength(signal);
                      return (
                        <Badge
                          key={signal?.id || `${title}-${index}-${signalIndex}`}
                          variant="outline"
                          className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-white", healthPlanSignalBadgeClasses(strength))}
                        >
                          {signal?.label || "-"}
                        </Badge>
                      );
                    })}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function HealthPlanVersionDeltaPanel({
  title,
  statusLabel,
  summaryText,
  changedSectionLabels,
  reasonItems,
  driverSignalLabels,
  unresolvedDetails,
  responseShiftLabels,
  sourceSignalsAdded,
  sourceSignalsRemoved,
  compact = false,
  className,
}: {
  title: string;
  statusLabel: string;
  summaryText: string;
  changedSectionLabels: string[];
  reasonItems: Array<{ label: string; signalLabels: string[] }>;
  driverSignalLabels: string[];
  unresolvedDetails: string[];
  responseShiftLabels: string[];
  sourceSignalsAdded: number;
  sourceSignalsRemoved: number;
  compact?: boolean;
  className?: string;
}) {
  const { t, copy } = useLanguage();
  return (
    <div className={cn("rounded-[20px] border border-slate-200 bg-white/88 px-4 py-4 shadow-sm", className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{title}</p>
          <p className={cn("mt-2 font-bold text-foreground", compact ? "text-sm" : "text-base")}>{statusLabel}</p>
          <p className="mt-1 text-sm leading-6 text-foreground/80">{summaryText}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <HealthPlanMetaChip label={t("profile.healthPlanHistorySignalDelta")} value={`+${sourceSignalsAdded} / -${sourceSignalsRemoved}`} />
          <HealthPlanMetaChip label={t("profile.healthPlanQualityVersionChanged")} value={String(changedSectionLabels.length)} />
        </div>
      </div>
      <div className={cn("mt-4 grid gap-4", compact ? "lg:grid-cols-2" : "xl:grid-cols-[1.1fr_0.9fr]")}>
        <div className="space-y-3">
          {changedSectionLabels.length > 0 && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("profile.healthPlanVersionDeltaChangedSections")}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {changedSectionLabels.map((label) => (
                  <Badge key={label} variant="outline" className="rounded-full border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700">
                    {label}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          {responseShiftLabels.length > 0 && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("profile.healthPlanVersionDeltaShiftTitle")}</p>
              <div className="mt-2 space-y-2">
                {responseShiftLabels.map((label) => (
                  <div key={label} className="flex items-start gap-2 rounded-xl border border-primary/10 bg-primary/5 px-3 py-2 text-sm text-foreground">
                    <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>{label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {reasonItems.length > 0 && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("profile.healthPlanVersionDeltaWhyTitle")}</p>
              <div className="mt-2 space-y-2">
                {reasonItems.map((item, index) => (
                  <div key={`${item.label}-${index}`} className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2.5 text-sm text-foreground">
                    <p>{item.label}</p>
                    {item.signalLabels.length > 0 && (
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        {copy("profile.healthPlanEvidenceLinkedSummary", {
                          signals: item.signalLabels.join(", "),
                        })}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="space-y-3">
          {driverSignalLabels.length > 0 && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("profile.healthPlanVersionDeltaSignalsTitle")}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {driverSignalLabels.map((label) => (
                  <Badge key={label} variant="outline" className="rounded-full border-slate-200 bg-white px-2.5 py-0.5 text-[11px] font-semibold text-slate-700">
                    {label}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          {unresolvedDetails.length > 0 && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("profile.healthPlanVersionDeltaStillOpenTitle")}</p>
              <div className="mt-2 space-y-2">
                {unresolvedDetails.map((detail, index) => (
                  <div key={`${detail}-${index}`} className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-2.5 text-sm text-amber-950">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                    <span>{detail}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function HealthPlanMetaChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white/88 px-3.5 py-3 shadow-sm">
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

function healthPlanHandoffToneClasses(priority: HealthPlanHandoffSummary["priority"]) {
  if (priority === "high") return "border-red-200 bg-red-50 text-red-700";
  if (priority === "medium") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

function healthPlanHandoffActionText(t: (key: string) => string, action: HealthPlanHandoffAction) {
  if (action.code === "confirm_today_touchpoint") return t("profile.healthPlanHandoffCheckTouchpoint");
  if (action.code === "review_alerts") return t("profile.healthPlanHandoffCheckAlerts");
  if (action.code === "verify_medication") return t("profile.healthPlanHandoffCheckMedication");
  if (action.code === "check_sensors") return t("profile.healthPlanHandoffCheckSensors");
  if (action.code === "assign_owner") return t("profile.healthPlanHandoffCheckAssignOwner");
  if (action.code === "confirm_sharing_boundary") return t("profile.healthPlanHandoffCheckSharing");
  return t("profile.healthPlanHandoffCheckMaintainRoutine");
}

function healthPlanHandoffStatusText(t: (key: string) => string, status: HealthPlanHandoffStatusCode) {
  if (status === "owner_assigned") return t("profile.healthPlanHandoffStatusOwnerAssigned");
  if (status === "first_contact_made") return t("profile.healthPlanHandoffStatusFirstContact");
  return t("profile.healthPlanHandoffStatusEscalationClosed");
}

function HealthPlanOperationalHandoffPanel({
  handoff,
  progress,
  canRecord,
  onRecord,
  onRecordStatus,
  recording,
  recordingStatus,
  latestRecordedAt,
  latestRecordedBy,
}: {
  handoff: HealthPlanHandoffSummary;
  progress: { ownerAssigned: boolean; firstContactMade: boolean; escalationClosed: boolean; completedCount: number };
  canRecord: boolean;
  onRecord: () => void;
  onRecordStatus: (status: HealthPlanHandoffStatusCode) => void;
  recording: boolean;
  recordingStatus: HealthPlanHandoffStatusCode | null;
  latestRecordedAt?: string | null;
  latestRecordedBy?: string | null;
}) {
  const { t } = useLanguage();
  const priorityLabel =
    handoff.priority === "high"
      ? t("profile.healthPlanHandoffPriorityHigh")
      : handoff.priority === "medium"
        ? t("profile.healthPlanHandoffPriorityMedium")
        : t("profile.healthPlanHandoffPriorityLow");

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("profile.healthPlanHandoffTitle")}</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{t("profile.healthPlanHandoffDescription")}</p>
        </div>
        <Badge variant="outline" className={cn("rounded-full px-3 py-1 text-[11px] font-semibold", healthPlanHandoffToneClasses(handoff.priority))}>
          {priorityLabel}
        </Badge>
      </div>

      <div className="grid gap-3">
        <InfoRow
          label={t("profile.healthPlanHandoffResponse")}
          value={handoff.responseWindow === "same_day" ? t("profile.healthPlanHandoffResponseSameDay") : t("profile.healthPlanHandoffResponse24h")}
        />
        <InfoRow
          label={t("profile.healthPlanHandoffOwner")}
          value={handoff.ownerMissing ? t("profile.healthPlanHandoffOwnerMissing") : handoff.ownerName}
        />
        <InfoRow
          label={t("profile.healthPlanHandoffSharing")}
          value={handoff.sharingBoundary === "staff_only" ? t("profile.healthPlanHandoffSharingStaffOnly") : t("profile.healthPlanHandoffSharingCareCircle")}
        />
      </div>

      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("profile.healthPlanHandoffChecks")}</p>
        <div className="mt-3 space-y-3">
          {handoff.actions.map((action) => (
            <HealthPlanChecklistItem key={action.code} text={healthPlanHandoffActionText(t, action)} />
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("profile.healthPlanHandoffMilestones")}</p>
          <Badge variant="secondary" className="rounded-full px-3 py-1">
            {progress.completedCount}/3
          </Badge>
        </div>
        <div className="mt-3 grid gap-2">
          {([
            ["owner_assigned", progress.ownerAssigned],
            ["first_contact_made", progress.firstContactMade],
            ["escalation_closed", progress.escalationClosed],
          ] as Array<[HealthPlanHandoffStatusCode, boolean]>).map(([status, done]) => (
            <div key={status} className="flex items-center justify-between gap-3 rounded-[14px] border border-white/90 bg-white/88 px-3 py-2.5 shadow-sm">
              <div className="flex items-center gap-2.5">
                <span className={cn("flex h-6 w-6 items-center justify-center rounded-full", done ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500")}>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                </span>
                <span className="text-sm font-medium text-foreground">{healthPlanHandoffStatusText(t, status)}</span>
              </div>
              {canRecord && !done && (
                <Button
                  type="button"
                  variant="outline"
                  className="h-8 rounded-full px-3 text-xs font-bold"
                  disabled={Boolean(recordingStatus)}
                  onClick={() => onRecordStatus(status)}
                >
                  {recordingStatus === status ? t("userForm.saving") : t("profile.healthPlanHandoffMarkDone")}
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>

      {(latestRecordedAt || latestRecordedBy || canRecord) && (
        <div className="rounded-[16px] border border-white/90 bg-white/88 p-3 shadow-sm">
          {(latestRecordedAt || latestRecordedBy) && (
            <div className="space-y-1.5 text-sm text-muted-foreground">
              {latestRecordedAt && <p>{t("profile.healthPlanHandoffLastRecorded")}: <span className="font-medium text-foreground">{formatDateTime(latestRecordedAt)}</span></p>}
              {latestRecordedBy && <p>{t("profile.healthPlanReviewedBy")}: <span className="font-medium text-foreground">{latestRecordedBy}</span></p>}
            </div>
          )}
          {canRecord && (
            <Button type="button" className="mt-3 h-9 rounded-full px-3 text-xs font-bold" disabled={recording} onClick={onRecord}>
              <CheckCircle2 className={cn("mr-1.5 h-3.5 w-3.5", recording && "animate-spin")} />
              {recording ? t("userForm.saving") : t("profile.healthPlanHandoffRecord")}
            </Button>
          )}
        </div>
      )}
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

function HealthPlanProvenanceBlock({
  title,
  headline,
  signalLabels,
  cautionText,
  supportLevel,
  linkedItemCount,
  totalItemCount,
  liveSignalCount,
  staleSignalCount,
  className,
  compact = false,
}: {
  title: string;
  headline: string;
  signalLabels: string[];
  cautionText: string;
  supportLevel: HealthPlanProvenanceSupportLevel;
  linkedItemCount: number;
  totalItemCount: number;
  liveSignalCount: number;
  staleSignalCount: number;
  className?: string;
  compact?: boolean;
}) {
  const { t, copy } = useLanguage();
  return (
    <div
      className={cn(
        compact
          ? "rounded-2xl border border-slate-200 bg-white/76 px-4 py-3"
          : "rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{title}</p>
        <Badge
          variant="outline"
          className={cn(
            "rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
            supportLevel === "strong"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : supportLevel === "mixed"
                ? "border-amber-200 bg-amber-50 text-amber-700"
                : "border-slate-200 bg-slate-100 text-slate-700",
          )}
        >
          {supportLevel === "strong"
            ? t("profile.healthPlanProvenanceSupportStrong")
            : supportLevel === "mixed"
              ? t("profile.healthPlanProvenanceSupportMixed")
              : t("profile.healthPlanProvenanceSupportThin")}
        </Badge>
      </div>
      {!compact && <p className="mt-2 text-sm leading-6 text-foreground/90">{headline}</p>}
      {compact && <p className="mt-1 text-sm leading-6 text-foreground/85">{headline}</p>}
      <div className="mt-2 flex flex-wrap gap-1.5">
        <Badge variant="outline" className="rounded-full bg-white/90 px-2.5 py-0.5 text-[11px] font-semibold">
          {copy("profile.healthPlanProvenanceCoverageValue", {
            linked: linkedItemCount,
            total: totalItemCount,
          })}
        </Badge>
        <Badge variant="outline" className="rounded-full bg-white/90 px-2.5 py-0.5 text-[11px] font-semibold">
          {copy("profile.healthPlanProvenanceLiveValue", { count: liveSignalCount })}
        </Badge>
        {staleSignalCount > 0 && (
          <Badge variant="outline" className="rounded-full border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700">
            {copy("profile.healthPlanProvenanceStaleValue", { count: staleSignalCount })}
          </Badge>
        )}
      </div>
      {signalLabels.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {signalLabels.map((label) => (
            <Badge key={label} variant="outline" className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-white/90">
              {label}
            </Badge>
          ))}
        </div>
      )}
      <p className={cn("mt-2 text-xs leading-5 text-muted-foreground", compact && "text-[11px]")}>{cautionText}</p>
    </div>
  );
}

function healthPlanVerificationToneClasses(tone: "emerald" | "amber" | "primary") {
  if (tone === "emerald") return "border-emerald-100 bg-emerald-50/70 text-emerald-700";
  if (tone === "amber") return "border-amber-100 bg-amber-50/80 text-amber-700";
  return "border-primary/10 bg-primary/5 text-primary";
}

function healthPlanVerificationPriorityClasses(priority?: "high" | "medium" | null) {
  return priority === "high"
    ? "border-red-200 bg-red-50 text-red-700"
    : "border-slate-200 bg-slate-50 text-slate-700";
}

function HealthPlanVerificationColumn({
  icon: Icon,
  title,
  description,
  emptyLabel,
  items,
  signalLookup,
  tone,
  confirmationStatuses,
  onConfirmItem,
  confirmingCode,
  confirmationStatusLabel,
  confirmationReceiptLine,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  emptyLabel: string;
  items: HealthPlanVerificationEntry[];
  signalLookup: Map<string, HealthPlanSourceSignal>;
  tone: "emerald" | "amber" | "primary";
  confirmationStatuses?: Map<string, HealthPlanConfirmationStatus>;
  onConfirmItem?: (item: HealthPlanVerificationEntry) => void;
  confirmingCode?: string | null;
  confirmationStatusLabel?: (status?: HealthPlanConfirmationStatus | null) => string;
  confirmationReceiptLine?: (status?: HealthPlanConfirmationStatus | null) => string | null;
}) {
  const { t } = useLanguage();
  const content = safeArray(items).filter((item) => item?.text);
  const dueWindowLabel = (value?: HealthPlanVerificationEntry["due_window"] | string | null) => {
    if (value === "same_day") return t("profile.healthPlanRealityCheckDueSameDay");
    if (value === "within_24h") return t("profile.healthPlanRealityCheckDue24h");
    return null;
  };

  return (
    <div className="rounded-[18px] border border-border/80 bg-muted/10 p-4">
      <div className="flex items-start gap-3">
        <span className={cn("mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border", healthPlanVerificationToneClasses(tone))}>
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-foreground">{title}</p>
            <Badge variant="outline" className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold">{content.length}</Badge>
          </div>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
        </div>
      </div>
      {content.length === 0 ? (
        <p className="mt-4 text-sm leading-6 text-muted-foreground">{emptyLabel}</p>
      ) : (
        <div className="mt-4 space-y-3">
          {content.map((item, index) => {
            const evidenceSignals = safeArray(item.signal_ids)
              .map((signalId) => signalLookup.get(signalId))
              .filter(Boolean)
              .slice(0, 3);
            const confirmationCode = resolveHealthPlanConfirmationCode(item);
            const confirmationStatus = confirmationCode ? confirmationStatuses?.get(confirmationCode) : null;
            const confirmationBusy = Boolean(confirmationCode && confirmingCode === confirmationCode);
            const receiptLine = confirmationReceiptLine?.(confirmationStatus);
            return (
              <div key={item.code || `${title}-${index}`} className="rounded-2xl border border-border/70 bg-white/85 px-3 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", healthPlanVerificationPriorityClasses(item.priority))}>
                    {item.priority === "high" ? t("profile.healthPlanRealityCheckPriorityHigh") : t("profile.healthPlanRealityCheckPriorityMedium")}
                  </Badge>
                  {dueWindowLabel(item.due_window) && (
                    <Badge variant="secondary" className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold">
                      {dueWindowLabel(item.due_window)}
                    </Badge>
                  )}
                  {confirmationStatusLabel && confirmationStatus && (
                    <Badge
                      variant={confirmationStatus.confirmed ? "secondary" : "outline"}
                      className={cn(
                        "rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                        confirmationStatus.confirmed ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "",
                      )}
                    >
                      {confirmationStatusLabel(confirmationStatus)}
                    </Badge>
                  )}
                </div>
                <p className="mt-2 text-sm leading-6 text-foreground">{item.text}</p>
                {(receiptLine || onConfirmItem) && (
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="min-h-[20px] text-xs text-muted-foreground">
                      {receiptLine || (!confirmationStatus?.confirmed && confirmationStatusLabel ? confirmationStatusLabel(confirmationStatus) : "")}
                    </div>
                    {onConfirmItem && !confirmationStatus?.confirmed && (
                      <Button
                        type="button"
                        variant="outline"
                        className="h-8 rounded-full px-3 text-xs font-bold"
                        disabled={confirmationBusy}
                        onClick={() => onConfirmItem(item)}
                      >
                        {confirmationBusy ? t("userForm.saving") : t("profile.healthPlanConfirmationMark")}
                      </Button>
                    )}
                  </div>
                )}
                {evidenceSignals.length > 0 && (
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{t("profile.healthPlanEvidence")}</span>
                    {evidenceSignals.map((signal, signalIndex) => {
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
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
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
