import { useCallback, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Pill,
  UserRound,
  X,
  type LucideIcon,
} from "lucide-react";
import { addWeeks, eachDayOfInterval, endOfWeek, format, isBefore, isSameDay, startOfDay, startOfWeek } from "date-fns";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useLanguage } from "@/contexts/LanguageContext";
import { apiFetch } from "@/lib/apiClient";
import { authBypassEnabled } from "@/lib/authMode";
import {
  getDemoProfileById,
  isDemoUserId,
  type OperationalMedication,
  type OperationalProfileResponse,
} from "@/lib/operationalDemoData";
import { cn } from "@/lib/utils";

type ScheduleStatus = "taken" | "missed" | "unconfirmed" | "upcoming";

type ScheduleEntry = {
  medication_name: string;
  dosage: string | null;
  time: string;
  notes: string | null;
  status: ScheduleStatus | "pending" | "confirmed";
};

type WeeklyScheduleResponse = {
  schedule: Record<string, ScheduleEntry[]>;
};

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;

const STATUS_CONFIG: Record<ScheduleStatus, { bg: string; color: string; icon: LucideIcon; labelKey: string; pill: string }> = {
  taken: {
    bg: "bg-emerald-50 border-emerald-200",
    color: "text-emerald-600",
    icon: Check,
    labelKey: "medAdherence.status.taken",
    pill: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  },
  missed: {
    bg: "bg-red-50 border-red-200",
    color: "text-red-600",
    icon: X,
    labelKey: "medAdherence.status.missed",
    pill: "bg-red-50 text-red-700 ring-red-200",
  },
  unconfirmed: {
    bg: "bg-amber-50 border-amber-200",
    color: "text-amber-600",
    icon: AlertCircle,
    labelKey: "medAdherence.status.unconfirmed",
    pill: "bg-amber-50 text-amber-700 ring-amber-200",
  },
  upcoming: {
    bg: "bg-slate-50 border-slate-200",
    color: "text-slate-500",
    icon: Clock,
    labelKey: "medAdherence.status.upcoming",
    pill: "bg-slate-50 text-slate-600 ring-slate-200",
  },
};

function fullName(profile?: OperationalProfileResponse | null) {
  const user = profile?.user;
  return [user?.first_name, user?.last_name].filter(Boolean).join(" ");
}

function statusFromApi(status: ScheduleEntry["status"]): ScheduleStatus {
  if (status === "confirmed") return "taken";
  if (status === "pending") return "unconfirmed";
  if (status === "taken" || status === "missed" || status === "unconfirmed" || status === "upcoming") return status;
  return "upcoming";
}

function formatDateForLocale(date: Date, language: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat(language, options).format(date);
}

function demoStatus(day: Date, todayStart: Date, dayIndex: number, medIndex: number, timeIndex: number): ScheduleStatus {
  const dateStart = startOfDay(day);
  if (!isBefore(dateStart, todayStart)) return "upcoming";
  if (dayIndex <= 3) return "taken";
  if (dayIndex === 4) {
    if (medIndex === 0 && timeIndex === 0) return "unconfirmed";
    if (medIndex === 0 && timeIndex === 1) return "missed";
    return "taken";
  }
  return "unconfirmed";
}

function buildDemoSchedule(profile: OperationalProfileResponse, weekDays: Date[], todayStart: Date): WeeklyScheduleResponse {
  const medications = profile.medications ?? [];
  const schedule: WeeklyScheduleResponse["schedule"] = {};

  weekDays.forEach((day, dayIndex) => {
    schedule[DAY_NAMES[dayIndex]] = medications.flatMap((medication, medIndex) => {
      const times = medication.schedule_times?.length ? medication.schedule_times : [""];
      return times.map((time, timeIndex) => ({
        medication_name: medication.medication_name || "",
        dosage: medication.dosage || null,
        time,
        notes: null,
        status: demoStatus(day, todayStart, dayIndex, medIndex, timeIndex),
      }));
    });
  });

  return { schedule };
}

async function fetchProfile(id: string): Promise<OperationalProfileResponse> {
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

export default function MedicationAdherence() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { language, t } = useLanguage();
  const [weekOffset, setWeekOffset] = useState(0);

  const today = new Date();
  const todayStart = startOfDay(today);
  const weekStart = startOfWeek(addWeeks(today, weekOffset), { weekStartsOn: 1 });
  const weekEnd = endOfWeek(addWeeks(today, weekOffset), { weekStartsOn: 1 });
  const weekDays = useMemo(() => eachDayOfInterval({ start: weekStart, end: weekEnd }), [weekStart, weekEnd]);

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["vyva-user-profile", id],
    queryFn: () => fetchProfile(id!),
    enabled: Boolean(id),
    retry: false,
  });

  const isPreviewProfile = Boolean(profile?.isPreviewDemo || (id && isDemoUserId(id)));

  const { data: schedule, isLoading: scheduleLoading } = useQuery({
    queryKey: ["med-weekly-schedule", id, format(weekStart, "yyyy-MM-dd"), isPreviewProfile],
    queryFn: async () => {
      if (isPreviewProfile) {
        return buildDemoSchedule(profile ?? getDemoProfileById(id), weekDays, todayStart);
      }

      return apiFetch<WeeklyScheduleResponse>("/api/v1/medications/weekly-schedule", {
        method: "POST",
        body: JSON.stringify({
          user_id: id,
          date_start: format(weekStart, "yyyy-MM-dd"),
          date_end: format(weekEnd, "yyyy-MM-dd"),
          is_present: weekOffset === 0,
        }),
      });
    },
    enabled: Boolean(id && (profile || isDemoUserId(id))),
    retry: false,
  });

  const getEffectiveStatus = useCallback((status: ScheduleEntry["status"], day: Date): ScheduleStatus => {
    const normalized = statusFromApi(status);
    if (normalized === "upcoming" && isBefore(startOfDay(day), todayStart)) return "unconfirmed";
    return normalized;
  }, [todayStart]);

  const medications = useMemo(() => {
    const medSet = new Map<string, { name: string; dosage: string | null }>();
    for (const entries of Object.values(schedule?.schedule ?? {})) {
      for (const entry of entries) {
        const key = `${entry.medication_name}||${entry.dosage || ""}`;
        if (!medSet.has(key)) medSet.set(key, { name: entry.medication_name, dosage: entry.dosage });
      }
    }
    return Array.from(medSet.values());
  }, [schedule]);

  const entryMap = useMemo(() => {
    const map: Record<string, Record<string, ScheduleEntry[]>> = {};
    for (const [dayName, entries] of Object.entries(schedule?.schedule ?? {})) {
      for (const entry of entries) {
        const key = `${entry.medication_name}||${entry.dosage || ""}`;
        map[key] ??= {};
        map[key][dayName] ??= [];
        map[key][dayName].push(entry);
      }
    }
    return map;
  }, [schedule]);

  const medicationFromProfile = useMemo(() => {
    const fallback = new Map<string, OperationalMedication>();
    for (const medication of profile?.medications ?? []) {
      fallback.set(`${medication.medication_name || ""}||${medication.dosage || ""}`, medication);
    }
    return fallback;
  }, [profile?.medications]);

  const getDayStatus = (medKey: string, dayName: string, day: Date) => {
    const entries = entryMap[medKey]?.[dayName] ?? [];
    if (!entries.length) {
      return {
        entries: [],
        status: isBefore(startOfDay(day), todayStart) ? "unconfirmed" : "upcoming" as ScheduleStatus,
      };
    }

    const statuses = entries.map((entry) => getEffectiveStatus(entry.status, day));
    if (statuses.includes("missed")) return { entries, status: "missed" as ScheduleStatus };
    if (statuses.includes("taken")) return { entries, status: "taken" as ScheduleStatus };
    if (statuses.includes("unconfirmed")) return { entries, status: "unconfirmed" as ScheduleStatus };
    return { entries, status: "upcoming" as ScheduleStatus };
  };

  const daySummary = useMemo(() => {
    return DAY_NAMES.map((name, index) => {
      const summary: Record<ScheduleStatus, number> = { taken: 0, missed: 0, unconfirmed: 0, upcoming: 0 };
      for (const med of medications) {
        const key = `${med.name}||${med.dosage || ""}`;
        const entries = entryMap[key]?.[name] ?? [];
        if (!entries.length) {
          const status = isBefore(startOfDay(weekDays[index]), todayStart) ? "unconfirmed" : "upcoming";
          summary[status] += 1;
          continue;
        }
        for (const entry of entries) summary[getEffectiveStatus(entry.status, weekDays[index])] += 1;
      }
      return summary;
    });
  }, [entryMap, getEffectiveStatus, medications, todayStart, weekDays]);

  const totals = useMemo(() => {
    return daySummary.reduce(
      (acc, day) => ({
        taken: acc.taken + day.taken,
        missed: acc.missed + day.missed,
        unconfirmed: acc.unconfirmed + day.unconfirmed,
        upcoming: acc.upcoming + day.upcoming,
      }),
      { taken: 0, missed: 0, unconfirmed: 0, upcoming: 0 },
    );
  }, [daySummary]);

  const loading = profileLoading || scheduleLoading;
  const personName = fullName(profile) || t("profile.unknownPerson");

  if (loading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-20 rounded-2xl" />
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full" onClick={() => navigate(`/users/${id}`)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
              <Pill className="h-4 w-4 text-orange-500" />
              {personName}
            </div>
            <h1 className="font-display text-2xl font-bold text-foreground">{t("medAdherence.title")}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{t("medAdherence.subtitle")}</p>
          </div>
        </div>
        <Button variant="outline" className="w-fit rounded-full" onClick={() => navigate(`/users/${id}`)}>
          <UserRound className="mr-2 h-4 w-4" />
          {t("medAdherence.backToProfile")}
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        {(Object.keys(STATUS_CONFIG) as ScheduleStatus[]).map((status) => {
          const config = STATUS_CONFIG[status];
          return (
            <Card key={status} className={cn("rounded-2xl border bg-white shadow-sm", status === "taken" && "border-t-4 border-t-emerald-500", status === "missed" && "border-t-4 border-t-red-500", status === "unconfirmed" && "border-t-4 border-t-amber-500", status === "upcoming" && "border-t-4 border-t-slate-300")}>
              <CardContent className="flex h-24 items-center justify-between p-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">{t(config.labelKey)}</p>
                  <p className="mt-2 text-2xl font-bold text-foreground">{totals[status]}</p>
                </div>
                <div className={cn("flex h-10 w-10 items-center justify-center rounded-2xl border", config.bg)}>
                  <config.icon className={cn("h-5 w-5", config.color)} />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="rounded-2xl border-border bg-white shadow-sm">
        <CardContent className="space-y-5 p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-3">
              {(Object.keys(STATUS_CONFIG) as ScheduleStatus[]).map((status) => {
                const config = STATUS_CONFIG[status];
                return (
                  <div key={status} className="flex items-center gap-1.5">
                    <span className={cn("h-3 w-3 rounded-full border", config.bg)} />
                    <span className="text-xs font-semibold text-muted-foreground">{t(config.labelKey)}</span>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button variant="outline" size="sm" className="h-10 rounded-full" onClick={() => setWeekOffset((offset) => offset - 1)}>
                <ChevronLeft className="mr-1 h-4 w-4" />
                {t("medAdherence.previous")}
              </Button>
              <div className="min-w-[180px] rounded-full bg-muted px-4 py-2 text-center text-sm font-bold text-foreground">
                {formatDateForLocale(weekStart, language, { month: "short", day: "numeric" })} - {formatDateForLocale(weekEnd, language, { month: "short", day: "numeric", year: "numeric" })}
              </div>
              <Button variant="outline" size="sm" className="h-10 rounded-full" onClick={() => setWeekOffset((offset) => offset + 1)} disabled={weekOffset >= 0}>
                {t("medAdherence.next")}
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>

          {medications.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-muted/20 py-14 text-center">
              <Pill className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
              <p className="text-lg font-bold text-foreground">{t("medAdherence.noMedsTitle")}</p>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{t("medAdherence.noMedsDescription")}</p>
              <Button variant="link" className="mt-3" onClick={() => navigate(`/users/${id}`)}>
                {t("medAdherence.goToProfile")}
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-border">
              <table className="w-full min-w-[880px] bg-white">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="w-[220px] px-4 py-4 text-left text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
                      {t("medAdherence.medication")}
                    </th>
                    {weekDays.map((day) => (
                      <th key={day.toISOString()} className={cn("px-3 py-4 text-center text-xs font-bold uppercase tracking-[0.12em]", isSameDay(day, today) ? "text-primary" : "text-muted-foreground")}>
                        <div>{formatDateForLocale(day, language, { weekday: "short" })}</div>
                        <div className="mt-1 text-[11px] font-semibold">{formatDateForLocale(day, language, { day: "numeric" })}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {medications.map((med) => {
                    const medKey = `${med.name}||${med.dosage || ""}`;
                    const profileMedication = medicationFromProfile.get(medKey);
                    return (
                      <tr key={medKey} className="border-b border-border/70 last:border-0">
                        <td className="px-4 py-4">
                          <p className="font-semibold text-foreground">{med.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {[med.dosage, profileMedication?.purpose].filter(Boolean).join(" · ")}
                          </p>
                        </td>
                        {DAY_NAMES.map((dayName, dayIndex) => {
                          const day = weekDays[dayIndex];
                          const { entries, status } = getDayStatus(medKey, dayName, day);
                          const config = STATUS_CONFIG[status];
                          const Icon = config.icon;

                          return (
                            <td key={dayName} className="px-2 py-3 text-center">
                              {entries.length === 0 ? (
                                <DosePill icon={Icon} status={status} />
                              ) : (
                                <div className="flex flex-col items-center gap-1.5">
                                  {entries.map((entry, index) => {
                                    const entryStatus = getEffectiveStatus(entry.status, day);
                                    const entryConfig = STATUS_CONFIG[entryStatus];
                                    return (
                                      <DosePill
                                        key={`${entry.time}-${index}`}
                                        icon={entryConfig.icon}
                                        status={entryStatus}
                                        time={entry.time}
                                      />
                                    );
                                  })}
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                  <tr className="bg-muted/25">
                    <td className="px-4 py-4 text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
                      {t("medAdherence.dailySummary")}
                    </td>
                    {DAY_NAMES.map((dayName, dayIndex) => {
                      const summary = daySummary[dayIndex];
                      return (
                        <td key={dayName} className="px-2 py-3 text-center">
                          <div className="flex flex-col items-center gap-1">
                            {summary.taken > 0 && <SummaryBadge status="taken" value={`${summary.taken}/${summary.taken + summary.missed + summary.unconfirmed + summary.upcoming}`} />}
                            {summary.missed > 0 && <SummaryBadge status="missed" value={`${summary.missed}`} />}
                            {summary.unconfirmed > 0 && <SummaryBadge status="unconfirmed" value={`${summary.unconfirmed}?`} />}
                            {summary.upcoming > 0 && <SummaryBadge status="upcoming" value={`${summary.upcoming}`} />}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function DosePill({ icon: Icon, status, time }: { icon: LucideIcon; status: ScheduleStatus; time?: string }) {
  const config = STATUS_CONFIG[status];

  return (
    <div className={cn("mx-auto flex min-h-9 w-full max-w-[104px] items-center justify-center gap-1 rounded-full border px-2 py-1.5", config.bg)}>
      <Icon className={cn("h-3.5 w-3.5", config.color)} />
      {time && <span className="text-[11px] font-semibold text-muted-foreground">{time}</span>}
    </div>
  );
}

function SummaryBadge({ status, value }: { status: ScheduleStatus; value: string }) {
  return (
    <Badge className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold ring-1", STATUS_CONFIG[status].pill)}>
      {value}
    </Badge>
  );
}
