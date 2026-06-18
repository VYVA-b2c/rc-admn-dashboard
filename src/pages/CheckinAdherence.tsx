import { useCallback, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  PhoneCall,
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
import { getDemoProfileById, isDemoUserId, type OperationalProfileResponse } from "@/lib/operationalDemoData";
import { cn } from "@/lib/utils";

type CheckinStatus = "completed" | "missed" | "no_record" | "upcoming";

type CheckinScheduleEntry = {
  call_type?: string | null;
  frequency?: string | null;
  time?: string | null;
  notes?: string | null;
  status: CheckinStatus | string;
};

type WeeklyCheckinAdherenceResponse = {
  schedule: Record<string, CheckinScheduleEntry[]>;
  checkin?: {
    type?: string | null;
    frequency?: string | null;
    preferred_time?: string | null;
    is_active?: boolean;
  } | null;
};

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;

const STATUS_CONFIG: Record<CheckinStatus, { bg: string; color: string; icon: LucideIcon; labelKey: string; pill: string }> = {
  completed: {
    bg: "bg-emerald-50 border-emerald-200",
    color: "text-emerald-600",
    icon: Check,
    labelKey: "checkinAdherence.status.completed",
    pill: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  },
  missed: {
    bg: "bg-red-50 border-red-200",
    color: "text-red-600",
    icon: X,
    labelKey: "checkinAdherence.status.missed",
    pill: "bg-red-50 text-red-700 ring-red-200",
  },
  no_record: {
    bg: "bg-amber-50 border-amber-200",
    color: "text-amber-600",
    icon: AlertCircle,
    labelKey: "checkinAdherence.status.noRecord",
    pill: "bg-amber-50 text-amber-700 ring-amber-200",
  },
  upcoming: {
    bg: "bg-slate-50 border-slate-200",
    color: "text-slate-500",
    icon: Clock,
    labelKey: "checkinAdherence.status.upcoming",
    pill: "bg-slate-50 text-slate-600 ring-slate-200",
  },
};

function fullName(profile?: OperationalProfileResponse | null) {
  const user = profile?.user;
  return [user?.first_name, user?.last_name].filter(Boolean).join(" ");
}

function statusFromApi(status: CheckinScheduleEntry["status"]): CheckinStatus {
  const normalized = String(status || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
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
  if (["pending", "scheduled", "unconfirmed", "unknown", "in_progress", "queued", "no_record", "no_result"].includes(normalized)) return "no_record";
  if (["upcoming", "future", "planned"].includes(normalized)) return "upcoming";
  return "upcoming";
}

function formatDateForLocale(date: Date, language: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat(language, options).format(date);
}

function formatTime(value?: string | null) {
  if (!value) return null;
  const match = value.match(/\b([01]\d|2[0-3]):([0-5]\d)\b/);
  return match ? `${match[1]}:${match[2]}` : value.slice(0, 5);
}

function typeLabel(type: string | undefined | null, t: (key: string) => string) {
  if (!type) return t("checkin.type.scheduled_call");
  const key = `checkin.type.${type}`;
  const translated = t(key);
  if (translated !== key) return translated;
  return type.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function frequencyLabel(value: string | number | null | undefined, t: (key: string) => string) {
  if (!value) return "";
  const normalized = String(value);
  const numeric = Number(normalized);
  if (Number.isInteger(numeric) && numeric > 0) {
    return numeric === 1 ? t("checkin.everyDay") : t("checkin.everyDays").replace("{count}", String(numeric));
  }
  const key = `userForm.frequency.${normalized}`;
  const translated = t(key);
  return translated !== key ? translated : normalized;
}

function demoStatus(day: Date, todayStart: Date, dayIndex: number): CheckinStatus {
  if (!isBefore(startOfDay(day), todayStart)) return "upcoming";
  if (dayIndex === 2) return "missed";
  if (dayIndex === 3) return "no_record";
  return "completed";
}

function emptySchedule() {
  return Object.fromEntries(DAY_NAMES.map((day) => [day, []])) as WeeklyCheckinAdherenceResponse["schedule"];
}

function buildDemoSchedule(profile: OperationalProfileResponse, weekDays: Date[], todayStart: Date): WeeklyCheckinAdherenceResponse {
  const checkin = profile.checkins;
  if (!checkin?.enabled) return { schedule: emptySchedule(), checkin: null };

  const schedule: WeeklyCheckinAdherenceResponse["schedule"] = {};
  weekDays.forEach((day, dayIndex) => {
    schedule[DAY_NAMES[dayIndex]] = [
      {
        call_type: "scheduled_call",
        frequency: checkin.frequency || "daily",
        time: checkin.preferred_time || null,
        notes: null,
        status: demoStatus(day, todayStart, dayIndex),
      },
    ];
  });

  return {
    schedule,
    checkin: {
      type: "scheduled_call",
      frequency: checkin.frequency || "daily",
      preferred_time: checkin.preferred_time || null,
      is_active: checkin.enabled,
    },
  };
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

export default function CheckinAdherence() {
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
    queryKey: ["checkin-weekly-adherence", id, format(weekStart, "yyyy-MM-dd"), isPreviewProfile],
    queryFn: async () => {
      if (isPreviewProfile) {
        return buildDemoSchedule(profile ?? getDemoProfileById(id || ""), weekDays, todayStart);
      }

      return apiFetch<WeeklyCheckinAdherenceResponse>("/api/v1/checkins/weekly-adherence", {
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

  const getEffectiveStatus = useCallback((status: CheckinScheduleEntry["status"], day: Date): CheckinStatus => {
    const normalized = statusFromApi(status);
    if (normalized === "upcoming" && isBefore(startOfDay(day), todayStart)) return "no_record";
    return normalized;
  }, [todayStart]);

  const calls = useMemo(() => {
    const callMap = new Map<string, { type: string; frequency: string | null; time: string | null }>();
    const configuredType = schedule?.checkin?.type || "scheduled_call";
    if (schedule?.checkin) {
      callMap.set(configuredType, {
        type: configuredType,
        frequency: schedule.checkin.frequency || null,
        time: schedule.checkin.preferred_time || null,
      });
    }

    for (const entries of Object.values(schedule?.schedule ?? {})) {
      for (const entry of entries) {
        const type = entry.call_type || configuredType;
        if (!callMap.has(type)) {
          callMap.set(type, { type, frequency: entry.frequency || null, time: entry.time || null });
        }
      }
    }
    return Array.from(callMap.values());
  }, [schedule]);

  const entryMap = useMemo(() => {
    const map: Record<string, Record<string, CheckinScheduleEntry[]>> = {};
    for (const [dayName, entries] of Object.entries(schedule?.schedule ?? {})) {
      for (const entry of entries) {
        const key = entry.call_type || schedule?.checkin?.type || "scheduled_call";
        map[key] ??= {};
        map[key][dayName] ??= [];
        map[key][dayName].push(entry);
      }
    }
    return map;
  }, [schedule]);

  const daySummary = useMemo(() => {
    return DAY_NAMES.map((name, index) => {
      const summary: Record<CheckinStatus, number> = { completed: 0, missed: 0, no_record: 0, upcoming: 0 };
      for (const call of calls) {
        const entries = entryMap[call.type]?.[name] ?? [];
        for (const entry of entries) summary[getEffectiveStatus(entry.status, weekDays[index])] += 1;
      }
      return summary;
    });
  }, [calls, entryMap, getEffectiveStatus, weekDays]);

  const totals = useMemo(() => {
    return daySummary.reduce(
      (acc, day) => ({
        completed: acc.completed + day.completed,
        missed: acc.missed + day.missed,
        no_record: acc.no_record + day.no_record,
        upcoming: acc.upcoming + day.upcoming,
      }),
      { completed: 0, missed: 0, no_record: 0, upcoming: 0 },
    );
  }, [daySummary]);

  const loading = profileLoading || scheduleLoading;
  const personName = fullName(profile) || t("profile.unknownPerson");
  const hasScheduledEntries = Object.values(totals).some((count) => count > 0);

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
          <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full" onClick={() => navigate("/checkin-monitoring")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
              <PhoneCall className="h-4 w-4 text-secondary" />
              {personName}
            </div>
            <h1 className="font-display text-2xl font-bold text-foreground">{t("checkinAdherence.title")}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{t("checkinAdherence.subtitle")}</p>
          </div>
        </div>
        <Button variant="outline" className="w-fit rounded-full" onClick={() => navigate(`/users/${id}`)}>
          <UserRound className="mr-2 h-4 w-4" />
          {t("checkinAdherence.backToProfile")}
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        {(Object.keys(STATUS_CONFIG) as CheckinStatus[]).map((status) => {
          const config = STATUS_CONFIG[status];
          return (
            <Card key={status} className={cn("rounded-2xl border bg-white shadow-sm", status === "completed" && "border-t-4 border-t-emerald-500", status === "missed" && "border-t-4 border-t-red-500", status === "no_record" && "border-t-4 border-t-amber-500", status === "upcoming" && "border-t-4 border-t-slate-300")}>
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
              {(Object.keys(STATUS_CONFIG) as CheckinStatus[]).map((status) => {
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
                {t("checkinAdherence.previous")}
              </Button>
              <div className="min-w-[180px] rounded-full bg-muted px-4 py-2 text-center text-sm font-bold text-foreground">
                {formatDateForLocale(weekStart, language, { month: "short", day: "numeric" })} - {formatDateForLocale(weekEnd, language, { month: "short", day: "numeric", year: "numeric" })}
              </div>
              <Button variant="outline" size="sm" className="h-10 rounded-full" onClick={() => setWeekOffset((offset) => offset + 1)} disabled={weekOffset >= 0}>
                {t("checkinAdherence.next")}
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>

          {!hasScheduledEntries ? (
            <div className="rounded-2xl border border-dashed border-border bg-muted/20 py-14 text-center">
              <PhoneCall className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
              <p className="text-lg font-bold text-foreground">{t("checkinAdherence.noScheduleTitle")}</p>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{t("checkinAdherence.noScheduleDescription")}</p>
              <Button variant="link" className="mt-3" onClick={() => navigate("/checkin-monitoring")}>
                {t("checkinAdherence.goToScheduledCalls")}
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-border">
              <table className="w-full min-w-[880px] bg-white">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="w-[220px] px-4 py-4 text-left text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
                      {t("checkinAdherence.call")}
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
                  {calls.map((call) => (
                    <tr key={call.type} className="border-b border-border/70 last:border-0">
                      <td className="px-4 py-4">
                        <p className="font-semibold text-foreground">{typeLabel(call.type, t)}</p>
                        <p className="text-xs text-muted-foreground">
                          {[frequencyLabel(call.frequency, t), formatTime(call.time)].filter(Boolean).join(" - ")}
                        </p>
                      </td>
                      {DAY_NAMES.map((dayName, dayIndex) => {
                        const day = weekDays[dayIndex];
                        const entries = entryMap[call.type]?.[dayName] ?? [];

                        return (
                          <td key={dayName} className="px-2 py-3 text-center">
                            {entries.length === 0 ? (
                              <span className="text-xs font-semibold text-muted-foreground/60">-</span>
                            ) : (
                              <div className="flex flex-col items-center gap-1.5">
                                {entries.map((entry, index) => {
                                  const entryStatus = getEffectiveStatus(entry.status, day);
                                  const entryConfig = STATUS_CONFIG[entryStatus];
                                  return (
                                    <CallPill
                                      key={`${entry.time || "call"}-${index}`}
                                      icon={entryConfig.icon}
                                      status={entryStatus}
                                      time={formatTime(entry.time)}
                                    />
                                  );
                                })}
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  <tr className="bg-muted/25">
                    <td className="px-4 py-4 text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
                      {t("checkinAdherence.dailySummary")}
                    </td>
                    {DAY_NAMES.map((dayName, dayIndex) => {
                      const summary = daySummary[dayIndex];
                      const total = summary.completed + summary.missed + summary.no_record + summary.upcoming;
                      return (
                        <td key={dayName} className="px-2 py-3 text-center">
                          <div className="flex flex-col items-center gap-1">
                            {summary.completed > 0 && <SummaryBadge status="completed" value={`${summary.completed}/${total}`} />}
                            {summary.missed > 0 && <SummaryBadge status="missed" value={`${summary.missed}`} />}
                            {summary.no_record > 0 && <SummaryBadge status="no_record" value={`${summary.no_record}`} />}
                            {summary.upcoming > 0 && <SummaryBadge status="upcoming" value={`${summary.upcoming}`} />}
                            {total === 0 && <span className="text-xs font-semibold text-muted-foreground/60">-</span>}
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

function CallPill({ icon: Icon, status, time }: { icon: LucideIcon; status: CheckinStatus; time?: string | null }) {
  const config = STATUS_CONFIG[status];

  return (
    <div className={cn("mx-auto flex min-h-9 w-full max-w-[112px] items-center justify-center gap-1 rounded-full border px-2 py-1.5", config.bg)}>
      <Icon className={cn("h-3.5 w-3.5", config.color)} />
      {time && <span className="text-[11px] font-semibold text-muted-foreground">{time}</span>}
    </div>
  );
}

function SummaryBadge({ status, value }: { status: CheckinStatus; value: string }) {
  return (
    <Badge className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold ring-1", STATUS_CONFIG[status].pill)}>
      {value}
    </Badge>
  );
}
