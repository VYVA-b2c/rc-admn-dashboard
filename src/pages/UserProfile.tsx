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
  ShieldAlert,
  ShieldCheck,
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
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAdminRole } from "@/hooks/useAdminRole";
import { toast } from "@/hooks/use-toast";
import { AssignCareProviderDialog } from "@/components/user/AssignCareProviderDialog";
import { EditCaregiverDialog } from "@/components/user/EditCaregiverDialog";
import { EditHealthDialog } from "@/components/user/EditHealthDialog";
import { EditMedicationDialog } from "@/components/user/EditMedicationDialog";
import { EditSensorDialog } from "@/components/user/EditSensorDialog";
import { EditServiceDialog } from "@/components/user/EditServiceDialog";
import { EditUserDialog } from "@/components/user/EditUserDialog";
import { apiFetch } from "@/lib/apiClient";
import { authBypassEnabled } from "@/lib/authMode";
import {
  getDemoProfileById,
  isDemoUserId,
  type OperationalChannel,
  type OperationalAlert,
  type OperationalCaregiver,
  type OperationalCareProviderAssignment,
  type OperationalMedication,
  type OperationalProfileContext,
  type OperationalProfileResponse,
  type OperationalSensor,
  type OperationalStatus,
} from "@/lib/operationalDemoData";
import { providerCoverageLabel, providerTypeKey } from "@/lib/careProviders";
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

function safeArray<T>(value: T[] | undefined | null): T[] {
  return Array.isArray(value) ? value : [];
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

  const { data, isLoading } = useQuery({
    queryKey: ["vyva-user-profile", id],
    queryFn: () => fetchUserProfile(id!),
    enabled: Boolean(id),
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
  const sensors = safeArray(data.sensors);
  const alerts = safeArray(data.alerts);
  const checkins = data.checkins ?? null;
  const brainCoach = data.brainCoach ?? null;
  const medicationActivity = data.medicationActivity ?? null;
  const isPreviewDemo = Boolean(data.isPreviewDemo);

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
    livingContextKey: "profile.livingContextUnknown",
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

  const formatDateTime = (date?: string | null) => {
    if (!date) return "";
    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) return "";
    return parsed.toLocaleString();
  };

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

    return events
      .sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime())
      .slice(0, 8);
  })();

  const showAdminControls = isAdmin && !authBypassEnabled && !isPreviewDemo;
  const canAssignProviders = !authBypassEnabled && !isPreviewDemo;
  const canEditMedications = !authBypassEnabled && !isPreviewDemo && Boolean(data.can_edit_medications ?? isAdmin);
  const canEditCheckins = !authBypassEnabled && !isPreviewDemo && Boolean(data.can_edit_checkins ?? isAdmin);
  const canEditBrainCoach = !authBypassEnabled && !isPreviewDemo && Boolean(data.can_edit_brain_coach ?? isAdmin);

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
          {showAdminControls && (
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
              <MetaItem icon={Clock} label={t("profile.lastContact")} value={t(context.lastContactKey ?? "profile.lastContactUnknown")} />
              <MetaItem icon={UserRound} label={t("careProviders.coverage")} value={assignedProviderLabel ?? t("usersList.unassigned")} />
            </div>
          </div>

          <div className="mt-6 border-t border-border pt-5">
            <div className="flex flex-wrap gap-2">
              <ActionButton tone="primary" icon={PhoneCall} label={t("profile.callNow")} onClick={() => navigate(`/risk-queue/${user.id}/prepare-call`)} />
              <ActionButton icon={MessageCircle} label={t("profile.sendWhatsApp")} onClick={() => handleOperationalAction("profile.action.whatsapp")} />
              <ActionButton icon={Calendar} label={t("profile.createFollowUp")} onClick={() => handleOperationalAction("profile.action.followUp")} />
              <ActionButton icon={Users} label={t("profile.contactCaregiver")} onClick={() => handleOperationalAction("profile.action.caregiver")} />
              <ActionButton tone="danger" icon={ShieldAlert} label={t("profile.escalate")} onClick={() => handleOperationalAction("profile.action.escalate")} />
              <ActionButton icon={Pencil} label={t("profile.addNote")} onClick={() => handleOperationalAction("profile.action.note")} />
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
            <InfoTile label={t("profile.lastContact")} value={t(context.lastContactKey ?? "profile.lastContactUnknown")} />
            <InfoTile label={t("profile.familyConsent")} value={t(context.familyConsentKey ?? "profile.familyConsentUnknown")} />
          </div>
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
                        {Array.isArray(med.schedule_times) && med.schedule_times.length > 0 && (
                          <p className="mt-1 text-xs font-semibold text-primary">{med.schedule_times.join(", ")}</p>
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
                onEdit={canEditCheckins && checkins ? () => setEditCheckinOpen(true) : undefined}
              />
              <ServiceSummary
                title={t("profile.service.brainCoach")}
                enabled={Boolean(brainCoach?.enabled)}
                frequency={brainCoach?.frequency}
                preferredTime={brainCoach?.preferred_time}
                pausedUntil={brainCoach?.paused_until}
                pauseSource={brainCoach?.pause_source}
                isPaused={Boolean(brainCoach?.is_paused)}
                onEdit={canEditBrainCoach && brainCoach ? () => setEditBrainOpen(true) : undefined}
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
                <ProviderGroup
                  title={t("careProviders.informalShort")}
                  providers={emergencyContacts}
                  emptyLabel={t("careProviders.noEmergencyContacts")}
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
          onOpenChange={setAssignProviderOpen}
          userId={user.id}
          userName={fullName}
        />
      )}
      {editCheckinOpen && checkins && <EditServiceDialog open={editCheckinOpen} onOpenChange={setEditCheckinOpen} vyvaUserId={user.id} service={checkins} serviceName="Check-in" serviceType="checkin" />}
      {editBrainOpen && brainCoach && <EditServiceDialog open={editBrainOpen} onOpenChange={setEditBrainOpen} vyvaUserId={user.id} service={brainCoach} serviceName="Brain Coach" serviceType="brainCoach" />}
      {editSensorOpen && <EditSensorDialog open={editSensorOpen} onOpenChange={setEditSensorOpen} vyvaUserId={user.id} sensor={editSensorTarget} />}
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
          <p className="mt-0.5 text-xs font-semibold text-muted-foreground">
            {[t(providerTypeKey(provider.provider_type)), providerCoverageLabel(provider)].filter(Boolean).join(" / ")}
          </p>
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
