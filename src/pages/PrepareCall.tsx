import { useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, ExternalLink, MessageCircle, Pencil, PhoneCall, ShieldAlert, UserRound } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/contexts/LanguageContext";
import { useActiveOrganizationId } from "@/hooks/useActiveOrganizationId";
import { toast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/apiClient";
import { authBypassEnabled } from "@/lib/authMode";
import {
  getDemoProfileById,
  isDemoUserId,
  type OperationalChannel,
  type OperationalProfileContext,
  type OperationalProfileResponse,
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

function channelKey(channel: OperationalChannel) {
  if (channel === "whatsapp") return "profile.channel.whatsApp";
  if (channel === "app") return "profile.channel.app";
  return "profile.channel.phone";
}

async function fetchPrepareCallProfile(id: string): Promise<OperationalProfileResponse> {
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

export default function PrepareCall() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const organizationId = useActiveOrganizationId();
  const copy = (key: string, values: Record<string, string | number | undefined> = {}) => interpolate(t(key), values);
  const [callStarted, setCallStarted] = useState(false);
  const [note, setNote] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["vyva-prepare-call", organizationId, id],
    queryFn: () => fetchPrepareCallProfile(id!),
    enabled: Boolean(id && organizationId),
    retry: false,
  });

  const handleLocalAction = (messageKey: string) => {
    toast({
      title: t("callPrep.actionReady"),
      description: t(messageKey),
    });
  };

  const startCall = () => {
    setCallStarted(true);
    handleLocalAction("callPrep.action.callStarted");
  };

  const saveNote = () => {
    toast({
      title: t("callPrep.noteSaved"),
      description: note.trim() ? t("callPrep.noteSavedLocal") : t("callPrep.noteEmpty"),
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-14 w-96" />
        <div className="grid gap-5 xl:grid-cols-[300px_1fr_280px]">
          <Skeleton className="h-[430px] rounded-2xl" />
          <Skeleton className="h-[430px] rounded-2xl" />
          <Skeleton className="h-[430px] rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!data?.user) {
    return (
      <div className="rounded-2xl border border-border bg-white px-6 py-16 text-center shadow-sm">
        <UserRound className="mx-auto mb-3 h-10 w-10 text-muted-foreground/60" />
        <p className="font-semibold text-foreground">{t("profile.notFound")}</p>
        <Button variant="link" onClick={() => navigate("/risk-queue")}>
          {t("callPrep.backToQueue")}
        </Button>
      </div>
    );
  }

  const { user } = data;
  const fullName = `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim() || t("profile.unknownPerson");
  const firstName = String(user.first_name ?? fullName.split(" ")[0] ?? t("profile.unknownPerson"));
  const context: OperationalProfileContext = {
    age: getAge(user.date_of_birth),
    assignedTo: null,
    preferredChannel: "phone",
    reasonKey: "profile.reasonReview",
    riskStatus: "review",
    summaryKey: "profile.summaryDefault",
    recentSignalKeys: ["profile.signalNoRecentAlerts"],
    recommendedQuestionKeys: ["profile.questionWellbeing", "profile.questionSupport", "profile.questionNextContact"],
    suggestedOpeningKey: "profile.suggestedOpeningDefault",
    ...data.operationalContext,
  };
  const age = context.age ?? getAge(user.date_of_birth);
  const healthConditions = data.health?.health_conditions ?? [];
  const caregivers = data.caregivers ?? [];
  const primaryCaregiver = caregivers[0];
  const conditionText = healthConditions.length ? healthConditions.join(", ") : t("callPrep.noConditions");

  const urgencyReasons = [
    { tone: "red", labelKey: "callPrep.reason.symptom", bodyKey: "callPrep.reason.symptomBody" },
    { tone: "orange", labelKey: "callPrep.reason.medication", bodyKey: "callPrep.reason.medicationBody" },
    { tone: "yellow", labelKey: "callPrep.reason.context", bodyKey: "callPrep.reason.contextBody" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold leading-tight text-foreground">
            {copy("callPrep.title", { name: fullName })}
          </h1>
          <p className="mt-1 text-sm font-bold text-red-600">{t(context.reasonKey)}</p>
        </div>
        <Button className="h-12 rounded-xl px-5 text-sm font-bold shadow-sm lg:min-w-48" onClick={startCall}>
          <PhoneCall className="mr-2 h-4 w-4" />
          {callStarted ? t("callPrep.callInProgress") : t("callPrep.startCall")}
        </Button>
      </div>

      <div className="grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)] 2xl:grid-cols-[300px_minmax(0,1fr)_280px]">
        <Card className="rounded-2xl border-border bg-white shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary text-base font-bold text-white">
                {getInitials(user.first_name, user.last_name)}
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground">{fullName}</h2>
                <p className="text-sm font-medium text-muted-foreground">
                  {[age ? copy("profile.ageYears", { age }) : null, context.livingContextKey ? t(context.livingContextKey) : null].filter(Boolean).join(" · ")}
                </p>
              </div>
            </div>

            <Badge className="mt-6 rounded-full bg-red-50 px-3 py-1 text-sm font-bold text-red-700 ring-1 ring-red-200">
              <span className="mr-2 h-2 w-2 rounded-full bg-red-500" />
              {t("profile.status.urgent")}
            </Badge>

            <div className="mt-5 space-y-4">
              <InfoLine label={t("callPrep.channel")} value={t(channelKey(context.preferredChannel))} icon={<PhoneCall className="h-4 w-4 text-vyva-pink" />} />
              <InfoLine label={t("callPrep.conditions")} value={conditionText} />
              <InfoLine label={t("callPrep.contact")} value={primaryCaregiver?.caretaker_name ?? t("callPrep.noCaregiver")} />
            </div>

            <div className="mt-6 space-y-2">
              <Button className="h-12 w-full rounded-xl text-sm font-bold" onClick={startCall}>
                <PhoneCall className="mr-2 h-4 w-4" />
                {t("callPrep.startCall")}
              </Button>
              <Button
                variant="outline"
                className="h-12 w-full rounded-xl border-primary/20 bg-primary/5 text-sm font-bold text-primary hover:bg-primary/10 hover:text-primary"
                onClick={() => handleLocalAction("callPrep.action.whatsapp")}
              >
                <MessageCircle className="mr-2 h-4 w-4" />
                {t("profile.sendWhatsApp")}
              </Button>
              <Button
                variant="outline"
                className="h-12 w-full rounded-xl border-primary/20 bg-primary/5 text-sm font-bold text-primary hover:bg-primary/10 hover:text-primary"
                onClick={() => navigate(`/users/${id}`)}
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                {t("callPrep.viewFullProfile")}
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-5">
          <Card className="rounded-2xl border-border bg-white shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-xs font-bold text-white">V</div>
                <h2 className="text-lg font-bold text-foreground">{t("callPrep.summaryTitle")}</h2>
              </div>
              <p className="mt-4 text-base leading-7 text-muted-foreground">
                {copy(context.summaryKey, { name: firstName })}
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border bg-white shadow-sm">
            <CardContent className="p-6">
              <h2 className="text-lg font-bold text-foreground">{t("callPrep.whyUrgent")}</h2>
              <div className="mt-5 grid gap-3 lg:grid-cols-3">
                {urgencyReasons.map((reason) => (
                  <div
                    key={reason.labelKey}
                    className={cn(
                      "rounded-2xl border p-4",
                      reason.tone === "red" && "border-red-200 bg-red-50",
                      reason.tone === "orange" && "border-orange-200 bg-orange-50",
                      reason.tone === "yellow" && "border-yellow-300 bg-yellow-50",
                    )}
                  >
                    <p
                      className={cn(
                        "flex items-center gap-2 text-sm font-bold",
                        reason.tone === "red" && "text-red-700",
                        reason.tone === "orange" && "text-orange-700",
                        reason.tone === "yellow" && "text-amber-700",
                      )}
                    >
                      <span
                        className={cn(
                          "h-2.5 w-2.5 rounded-full",
                          reason.tone === "red" && "bg-red-500",
                          reason.tone === "orange" && "bg-orange-500",
                          reason.tone === "yellow" && "bg-amber-500",
                        )}
                      />
                      {t(reason.labelKey)}
                    </p>
                    <p className="mt-3 text-sm font-medium leading-6 text-muted-foreground">{t(reason.bodyKey)}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border bg-white shadow-sm">
            <CardContent className="p-6">
              <h2 className="text-lg font-bold text-foreground">{t("callPrep.recommendedQuestions")}</h2>
              <div className="mt-4 divide-y divide-border">
                {context.recommendedQuestionKeys.map((questionKey, index) => (
                  <div key={questionKey} className="flex items-center gap-4 py-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">
                      {index + 1}
                    </span>
                    <p className="text-base font-semibold text-foreground">{t(questionKey)}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-5 xl:col-span-2 xl:grid xl:grid-cols-3 xl:gap-5 xl:space-y-0 2xl:col-span-1 2xl:block 2xl:space-y-5">
          <Card className="rounded-2xl border-border bg-white shadow-sm">
            <CardContent className="p-5">
              <h2 className="text-base font-extrabold uppercase tracking-[0.04em] text-foreground">{t("callPrep.nextBestAction")}</h2>
              <Button className="mt-5 h-12 w-full rounded-xl text-sm font-bold" onClick={startCall}>
                <PhoneCall className="mr-2 h-4 w-4" />
                {t("profile.callNow")}
              </Button>
              <p className="mt-5 text-xs font-extrabold uppercase tracking-[0.14em] text-muted-foreground">{t("callPrep.ifNoResponse")}</p>
              <ol className="mt-3 space-y-3 text-sm font-medium leading-6 text-muted-foreground">
                {["callPrep.noResponse.retry", "callPrep.noResponse.whatsapp", "callPrep.noResponse.caregiver", "callPrep.noResponse.escalate"].map((stepKey, index) => (
                  <li key={stepKey} className="flex gap-3">
                    <span className="font-bold text-primary">{index + 1}.</span>
                    <span>{t(stepKey)}</span>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border bg-white shadow-sm">
            <CardContent className="p-5">
              <h2 className="text-base font-extrabold uppercase tracking-[0.04em] text-foreground">{t("callPrep.contactOptions")}</h2>
              <div className="mt-5 space-y-3">
                <Button
                  variant="outline"
                  className="h-11 w-full rounded-xl border-primary/20 bg-primary/5 text-sm font-bold text-primary hover:bg-primary/10 hover:text-primary"
                  onClick={() => handleLocalAction("callPrep.action.whatsapp")}
                >
                  <MessageCircle className="mr-2 h-4 w-4" />
                  {t("profile.channel.whatsApp")}
                </Button>
                <Button
                  variant="outline"
                  className="h-11 w-full rounded-xl border-red-200 bg-red-50 text-sm font-bold text-red-700 hover:bg-red-100 hover:text-red-700"
                  onClick={() => handleLocalAction("callPrep.action.escalate")}
                >
                  <ShieldAlert className="mr-2 h-4 w-4" />
                  {t("profile.escalate")}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border bg-white shadow-sm">
            <CardContent className="p-5">
              <h2 className="flex items-center gap-2 text-base font-extrabold uppercase tracking-[0.04em] text-foreground">
                <Pencil className="h-4 w-4 text-primary" />
                {t("callPrep.postCallNote")}
              </h2>
              <div className="mt-4 rounded-2xl bg-muted/60 p-3">
                <p className="flex items-start gap-2 text-sm font-medium leading-6 text-muted-foreground">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  {t("callPrep.noteHint")}
                </p>
              </div>
              <Textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder={t("callPrep.notePlaceholder")}
                className="mt-4 min-h-28 rounded-xl border-border bg-muted/35 text-sm"
              />
              <Button variant="outline" className="mt-3 h-10 w-full rounded-xl text-sm font-bold" onClick={saveNote}>
                {t("callPrep.saveNote")}
              </Button>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function InfoLine({ icon, label, value }: { icon?: ReactNode; label: string; value: string }) {
  return (
    <div className="grid grid-cols-[90px_1fr] items-start gap-3 text-sm">
      <span className="font-medium text-muted-foreground">{label}</span>
      <span className="flex items-start justify-end gap-2 text-right font-bold text-foreground">
        {icon}
        {value}
      </span>
    </div>
  );
}
