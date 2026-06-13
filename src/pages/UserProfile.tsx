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
import { EditCaregiverDialog } from "@/components/user/EditCaregiverDialog";
import { EditHealthDialog } from "@/components/user/EditHealthDialog";
import { EditMedicationDialog } from "@/components/user/EditMedicationDialog";
import { EditSensorDialog } from "@/components/user/EditSensorDialog";
import { EditServiceDialog } from "@/components/user/EditServiceDialog";
import { EditUserDialog } from "@/components/user/EditUserDialog";
import { apiFetch, BASE_URL } from "@/lib/apiClient";
import { authBypassEnabled } from "@/lib/authMode";
import {
  getDemoProfileById,
  isDemoUserId,
  type OperationalChannel,
  type OperationalAlert,
  type OperationalCaregiver,
  type OperationalMedication,
  type OperationalProfileContext,
  type OperationalProfileResponse,
  type OperationalSensor,
  type OperationalStatus,
} from "@/lib/operationalDemoData";
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
      const res = await fetch(`${BASE_URL}/api/v1/user-dashboard/medications/${medId}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed");

      toast({ title: t("profile.medicationDeleted") });
      queryClient.invalidateQueries({ queryKey: ["vyva-user-profile", id] });
    } catch (error) {
      toast({ title: t("profile.deleteFailed"), variant: "destructive" });
    }
  };

  const handleDeleteCaregiver = async (caregiverId: string) => {
    if (data?.isPreviewDemo) {
      handleOperationalAction("profile.previewNoWrite");
      return;
    }

    try {
      const res = await fetch(`${BASE_URL}/api/v1/user-dashboard/caregivers/${caregiverId}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed");

      toast({ title: t("profile.caregiverDeleted") });
      queryClient.invalidateQueries({ queryKey: ["vyva-user-profile", id] });
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
  const sensors = safeArray(data.sensors);
  const alerts = safeArray(data.alerts);
  const checkins = data.checkins ?? null;
  const brainCoach = data.brainCoach ?? null;
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
  const healthScore = Math.max(0, Math.min(100, 100 - criticalAlerts * 20 - warningAlerts * 10 - healthConditions.length * 4));
  const services = [
    { key: "profile.service.checkins", active: Boolean(checkins?.enabled), icon: PhoneCall },
    { key: "profile.service.brainCoach", active: Boolean(brainCoach?.enabled), icon: Brain },
    { key: "profile.service.medications", active: medications.length > 0, icon: Pill },
    { key: "profile.service.caregivers", active: caregivers.length > 0, icon: Users },
    { key: "profile.service.sensors", active: sensors.length > 0, icon: Activity },
    { key: "profile.service.consent", active: Boolean(data.consent?.consent_given), icon: ShieldCheck },
  ];
  const servicesActive = services.filter((service) => service.active).length;

  const eventTimeline = (() => {
    const events: { date: string; label: string; tone: string }[] = [];
    if (user.created_at) events.push({ date: user.created_at, label: t("profile.timeline.onboarded"), tone: "primary" });
    if (checkins?.created_at) events.push({ date: checkins.created_at, label: t("profile.timeline.checkinsConfigured"), tone: "teal" });
    medications.forEach((med) => {
      if (med.created_at) events.push({ date: med.created_at, label: copy("profile.timeline.medicationAdded", { item: med.medication_name }), tone: "orange" });
    });
    alerts.forEach((alert) => {
      if (alert.created_at) events.push({ date: alert.created_at, label: alert.message || t("profile.timeline.alert"), tone: alert.severity === "critical" ? "red" : "orange" });
    });

    return events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 6);
  })();

  const showAdminControls = isAdmin && !authBypassEnabled && !isPreviewDemo;

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
              <MetaItem icon={Clock} label={t("profile.lastContact")} value={t(context.lastContactKey ?? "profile.lastContactUnknown")} />
              <MetaItem icon={UserRound} label={t("profile.assignedTo")} value={context.assignedTo ?? t("usersList.unassigned")} />
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

      <div className="grid gap-5 xl:grid-cols-[320px_1fr]">
        <Card className="rounded-2xl border-border bg-white shadow-sm">
          <CardHeader className="flex flex-row items-center gap-2 pb-2">
            <Users className="h-5 w-5 text-primary" />
            <CardTitle className="text-base font-bold">{t("profile.keyData")}</CardTitle>
          </CardHeader>
          <CardContent>
            <InfoRow label={t("profile.age")} value={age ? copy("profile.ageYears", { age }) : null} />
            <InfoRow label={t("profile.livesAlone")} value={context.livingContextKey ? t(context.livingContextKey) : null} />
            <InfoRow label={t("profile.language")} value={user.language ? String(user.language).toUpperCase() : null} />
            <InfoRow label={t("profile.preferredChannel")} value={t(channelKey(context.preferredChannel))} />
            <InfoRow label={t("profile.address")} value={address || null} />
            <InfoRow label={t("profile.lastContact")} value={t(context.lastContactKey ?? "profile.lastContactUnknown")} />
            <InfoRow label={t("profile.familyConsent")} value={t(context.familyConsentKey ?? "profile.familyConsentUnknown")} />
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border bg-white shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-xs font-bold text-white">V</div>
              <h2 className="text-lg font-bold text-foreground">{t("profile.summaryBeforeCall")}</h2>
            </div>
            <p className="mt-4 text-base leading-7 text-muted-foreground">
              {copy(context.summaryKey, { name: firstName })}
            </p>

            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("profile.recentSignals")}</h3>
                <ul className="mt-3 space-y-2">
                  {context.recentSignalKeys.map((signalKey) => (
                    <li key={signalKey} className="flex gap-2 text-sm font-medium text-foreground">
                      <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-red-500" />
                      <span>{t(signalKey)}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("profile.askFirst")}</h3>
                <ol className="mt-3 space-y-2">
                  {context.recommendedQuestionKeys.map((questionKey, index) => (
                    <li key={questionKey} className="flex gap-3 text-sm font-medium text-muted-foreground">
                      <span className="font-bold text-primary">{index + 1}.</span>
                      <span>{t(questionKey)}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border-l-4 border-primary bg-primary/10 px-5 py-4">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">{t("profile.suggestedOpening")}</p>
              <p className="mt-2 text-base leading-7 text-foreground">{copy(context.suggestedOpeningKey, { name: firstName })}</p>
            </div>
          </CardContent>
        </Card>
      </div>

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
              <Button variant="outline" size="sm" className="h-8 rounded-full text-xs" onClick={() => navigate(`/users/${id}/medications`)}>
                {t("profile.viewAdherence")}
              </Button>
              {showAdminControls && (
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
                      {showAdminControls && (
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
                onEdit={showAdminControls && checkins ? () => setEditCheckinOpen(true) : undefined}
              />
              <ServiceSummary
                title={t("profile.service.brainCoach")}
                enabled={Boolean(brainCoach?.enabled)}
                frequency={brainCoach?.frequency}
                preferredTime={brainCoach?.preferred_time}
                onEdit={showAdminControls && brainCoach ? () => setEditBrainOpen(true) : undefined}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border bg-white shadow-sm">
          <CardHeader className="flex flex-row items-center gap-2 pb-2">
            <Users className="h-5 w-5 text-primary" />
            <CardTitle className="text-base font-bold">{t("profile.caregivers")}</CardTitle>
            {showAdminControls && (
              <AdminIconButton
                label={t("profile.addCaregiver")}
                icon={Plus}
                onClick={() => {
                  setEditCaregiverTarget(null);
                  setEditCaregiverOpen(true);
                }}
              />
            )}
          </CardHeader>
          <CardContent>
            {caregivers.length === 0 ? (
              <EmptyLine icon={Users} label={t("profile.noCaregivers")} />
            ) : (
              <div className="space-y-2">
                {caregivers.map((caregiver) => (
                  <div key={caregiver.id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/25 p-3">
                    <div>
                      <p className="font-semibold text-foreground">{caregiver.caretaker_name || t("profile.unknownCaregiver")}</p>
                      <p className="mt-0.5 flex items-center gap-1 text-sm text-muted-foreground">
                        <Phone className="h-3.5 w-3.5" />
                        {caregiver.caretaker_phone || t("profile.noPhone")}
                      </p>
                    </div>
                    {showAdminControls && (
                      <div className="flex gap-1">
                        <AdminIconButton label={t("profile.editCaregiver")} onClick={() => { setEditCaregiverTarget(caregiver); setEditCaregiverOpen(true); }} />
                        <AdminIconButton label={t("profile.deleteCaregiver")} icon={Trash2} danger onClick={() => handleDeleteCaregiver(caregiver.id)} />
                      </div>
                    )}
                  </div>
                ))}
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
              {eventTimeline.map((event, index) => (
                <div key={`${event.date}-${index}`} className="flex gap-3 rounded-xl border border-border bg-muted/25 p-3">
                  <span className={cn("mt-1 h-3 w-3 shrink-0 rounded-full", event.tone === "red" ? "bg-red-500" : event.tone === "orange" ? "bg-orange-500" : event.tone === "teal" ? "bg-vyva-teal" : "bg-primary")} />
                  <div>
                    <p className="font-semibold text-foreground">{event.label}</p>
                    <p className="text-xs text-muted-foreground">{new Date(event.date).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {editUserOpen && <EditUserDialog open={editUserOpen} onOpenChange={setEditUserOpen} user={user} />}
      {editHealthOpen && health && <EditHealthDialog open={editHealthOpen} onOpenChange={setEditHealthOpen} vyvaUserId={user.id} health={health} />}
      {editMedOpen && <EditMedicationDialog open={editMedOpen} onOpenChange={setEditMedOpen} vyvaUserId={user.id} medication={editMedTarget} />}
      {editCaregiverOpen && <EditCaregiverDialog open={editCaregiverOpen} onOpenChange={setEditCaregiverOpen} vyvaUserId={user.id} caregiver={editCaregiverTarget} />}
      {editCheckinOpen && checkins && <EditServiceDialog open={editCheckinOpen} onOpenChange={setEditCheckinOpen} vyvaUserId={user.id} service={checkins} serviceName="Check-in" table="vyva_user_checkins" />}
      {editBrainOpen && brainCoach && <EditServiceDialog open={editBrainOpen} onOpenChange={setEditBrainOpen} vyvaUserId={user.id} service={brainCoach} serviceName="Brain Coach" table="vyva_user_brain_coach" />}
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

function ServiceSummary({
  enabled,
  frequency,
  onEdit,
  preferredTime,
  title,
}: {
  enabled: boolean;
  frequency?: string | null;
  onEdit?: () => void;
  preferredTime?: string | null;
  title: string;
}) {
  const { t } = useLanguage();

  return (
    <div className="rounded-xl border border-border bg-muted/25 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="font-semibold text-foreground">{title}</p>
        <Badge variant={enabled ? "default" : "secondary"} className="rounded-full text-[11px]">
          {enabled ? t("profile.active") : t("profile.inactive")}
        </Badge>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        {frequency || t("profile.frequencyUnknown")} · {preferredTime || t("profile.timeUnknown")}
      </p>
      {onEdit && (
        <Button variant="ghost" size="sm" className="mt-2 h-8 rounded-full px-3 text-xs text-primary hover:bg-primary/10 hover:text-primary" onClick={onEdit}>
          <Pencil className="mr-1.5 h-3.5 w-3.5" />
          {t("profile.edit")}
        </Button>
      )}
    </div>
  );
}
