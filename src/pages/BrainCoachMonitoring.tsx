import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { BarChart3, Brain, PauseCircle, Pencil, Play, Power, PowerOff, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatCard } from "@/components/StatCard";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAdminRole } from "@/hooks/useAdminRole";
import { useCurrentUserContext } from "@/hooks/useCurrentUserContext";
import { toast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/apiClient";
import { authBypassEnabled } from "@/lib/authMode";
import { cn } from "@/lib/utils";

type FilterTab = "all" | "active" | "inactive";

type BrainCoachSession = {
  id: string;
  user_id: string;
  userName: string;
  userPhone?: string | null;
  city?: string | null;
  enabled: boolean;
  frequency?: string | null;
  preferred_time?: string | null;
  paused_until?: string | null;
  pause_reason?: string | null;
  pause_source?: string | null;
  is_paused?: boolean;
  lastOutcome?: string | null;
  lastOutcomeAt?: string | null;
  last_outcome?: string | null;
  last_outcome_at?: string | null;
  last_session_at?: string | null;
  lastSessionAt?: string | null;
  last_status?: string | null;
  last_status_at?: string | null;
  last_checkin_at?: string | null;
  lastCheckinAt?: string | null;
  last_reported_at?: string | null;
  last_completed_at?: string | null;
};

type BrainCoachSessionResponse =
  | BrainCoachSession[]
  | {
      sessions?: BrainCoachSession[];
      data?: BrainCoachSession[];
    };

type ScheduledCallFallbackItem = {
  id?: string | number;
  user_id?: string | number;
  vyva_user_id?: string | number;
  userName?: string;
  user_name?: string;
  name?: string | null;
  phone?: string | null;
  userPhone?: string | null;
  user_phone?: string | null;
  city?: string | null;
  type?: string | null;
  enabled?: boolean;
  active?: boolean;
  is_active?: boolean;
  frequency?: string | number | null;
  frequency_days?: string | number | null;
  preferred_time?: string | null;
  preferredTime?: string | null;
  lastOutcome?: string | null;
  lastOutcomeAt?: string | null;
  last_outcome?: string | null;
  last_outcome_at?: string | null;
  last_session_at?: string | null;
  lastSessionAt?: string | null;
  last_status?: string | null;
  last_status_at?: string | null;
  last_checkin_at?: string | null;
  lastCheckinAt?: string | null;
  last_reported_at?: string | null;
  last_completed_at?: string | null;
  user?: {
    id?: string | number;
    first_name?: string | null;
    last_name?: string | null;
    name?: string | null;
    phone?: string | null;
    city?: string | null;
  } | null;
  vyva_users?: {
    id?: string | number;
    first_name?: string | null;
    last_name?: string | null;
    name?: string | null;
    phone?: string | null;
    city?: string | null;
  } | null;
};

type ScheduledCallFallbackResponse =
  | ScheduledCallFallbackItem[]
  | {
      checkins?: ScheduledCallFallbackItem[];
      data?: ScheduledCallFallbackItem[];
    };

type FormState = {
  enabled: boolean;
  frequency: string;
  preferred_time: string;
};

const REQUEST_TIMEOUT_MS = 10_000;
const validTimePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
const frequencyOptions = ["daily", "weekly", "biweekly", "monthly"] as const;

function normalizeResponse(response: BrainCoachSessionResponse): BrainCoachSession[] {
  const list = Array.isArray(response) ? response : response.sessions ?? response.data ?? [];
  return normalizeFallbackResponse(list as ScheduledCallFallbackItem[]);
}

function pickString(...values: unknown[]) {
  const value = values.find((item) => typeof item === "string" && item.trim().length > 0);
  return typeof value === "string" ? value : undefined;
}

function pickId(...values: unknown[]) {
  const value = values.find((item) => typeof item === "string" || typeof item === "number");
  return value == null ? "" : String(value);
}

function fullName(firstName?: string | null, lastName?: string | null) {
  return [firstName, lastName].filter(Boolean).join(" ").trim();
}

function normalizeFallbackResponse(response: ScheduledCallFallbackResponse): BrainCoachSession[] {
  const list = Array.isArray(response) ? response : response.checkins ?? response.data ?? [];
  return list.map((item) => {
    const nestedUser = item.user ?? item.vyva_users;
    return {
      id: pickId(item.id, `brain-coach-${pickId(item.user_id, item.vyva_user_id, nestedUser?.id)}`),
      user_id: pickId(item.user_id, item.vyva_user_id, nestedUser?.id),
      userName:
        pickString(
          item.userName,
          item.user_name,
          item.name,
          nestedUser?.name,
          fullName(nestedUser?.first_name, nestedUser?.last_name),
        ) ?? "Unknown",
      userPhone: pickString(item.userPhone, item.user_phone, item.phone, nestedUser?.phone) ?? null,
      city: pickString(item.city, nestedUser?.city) ?? null,
      enabled:
        typeof item.enabled === "boolean"
          ? item.enabled
          : typeof item.is_active === "boolean"
            ? item.is_active
            : typeof item.active === "boolean"
              ? item.active
              : true,
      frequency: pickString(item.frequency, item.frequency_days) ?? null,
      preferred_time: item.preferred_time ?? item.preferredTime ?? null,
      paused_until: item.paused_until ?? null,
      pause_reason: item.pause_reason ?? null,
      pause_source: item.pause_source ?? null,
      is_paused: Boolean(item.is_paused),
      lastOutcome: item.lastOutcome ?? item.last_outcome ?? item.last_status ?? null,
      lastOutcomeAt:
        item.lastOutcomeAt ??
        item.last_outcome_at ??
        item.lastSessionAt ??
        item.last_session_at ??
        item.last_status_at ??
        item.lastCheckinAt ??
        item.last_checkin_at ??
        item.last_reported_at ??
        item.last_completed_at ??
        null,
    };
  }).filter((item) => item.user_id);
}

function formatFrequency(value: string | null | undefined, t: (key: string) => string) {
  if (!value) return "-";
  const key = `userForm.frequency.${value}`;
  const translated = t(key);
  return translated === key ? value : translated;
}

function statusLabel(enabled: boolean, t: (key: string) => string) {
  return enabled ? t("brainCoach.active") : t("brainCoach.inactive");
}

function scheduledTodayAt(value?: string | null) {
  if (!value) return null;
  const [hour, minute] = value.split(":").map((part) => Number(part));
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null;
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  return date;
}

function timeToMinutes(value?: string | null) {
  if (!value) return null;
  const [hour, minute] = value.split(":").map((part) => Number(part));
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return hour * 60 + minute;
}

function nowMinutesInTimezone(timeZone?: string | null) {
  try {
    const formatter = new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: timeZone || undefined,
    });
    const parts = formatter.formatToParts(new Date());
    const hour = Number(parts.find((part) => part.type === "hour")?.value);
    const minute = Number(parts.find((part) => part.type === "minute")?.value);
    if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null;
    return hour * 60 + minute;
  } catch {
    return null;
  }
}

function hasScheduledTimePassed(value?: string | null, timeZone?: string | null) {
  const scheduledMinutes = timeToMinutes(value);
  if (scheduledMinutes == null) return false;
  const currentMinutes = nowMinutesInTimezone(timeZone) ?? nowMinutesInTimezone();
  if (currentMinutes == null) return false;
  return currentMinutes >= scheduledMinutes;
}

function normalizeOutcome(value?: string | null) {
  const normalized = String(value || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (!normalized) return null;
  if (["success", "completed", "complete", "answered", "reached", "confirmed"].includes(normalized)) return "confirmed";
  if (["missed", "failed", "no_answer", "unanswered", "not_reached"].includes(normalized)) return "missed";
  if (["escalated", "emergency", "emergency_protocol", "urgent_escalation"].includes(normalized)) return "escalated";
  if (["unconfirmed", "unknown", "pending"].includes(normalized)) return normalized;
  return normalized;
}

type BrainCoachOutcomeDisplay = {
  label: string;
  status: string;
};

function sessionOutcomeDisplay(session: BrainCoachSession, t: (key: string) => string, timeZone?: string | null): BrainCoachOutcomeDisplay {
  const normalized = normalizeOutcome(session.lastOutcome ?? session.last_outcome ?? session.last_status);
  if (normalized) {
    const key = `checkin.outcome.${normalized}`;
    const translated = t(key);
    return {
      label: translated !== key ? translated : normalized.replace(/_/g, " "),
      status: normalized,
    };
  }

  if (!session.preferred_time || !session.enabled || isPaused(session)) {
    return { label: t("checkin.outcomeNoHistory"), status: "unknown" };
  }

  if (hasScheduledTimePassed(session.preferred_time, timeZone)) {
    return { label: t("checkin.outcomeMissedToday"), status: "missed" };
  }

  return { label: t("checkin.outcomeScheduledToday"), status: "pending" };
}

function outcomeBadgeClass(status: string) {
  if (status === "confirmed") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "missed") return "border-red-200 bg-red-50 text-red-700";
  if (status === "escalated") return "border-orange-200 bg-orange-50 text-orange-700";
  if (status === "pending") return "border-slate-200 bg-slate-50 text-slate-600";
  return "border-slate-200 bg-slate-50 text-slate-600";
}

function formatSessionTime(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
  } catch {
    return date.toLocaleString();
  }
}

function lastSessionTime(session: BrainCoachSession) {
  const actual = formatSessionTime(
    session.lastOutcomeAt ??
      session.last_outcome_at ??
      session.lastSessionAt ??
      session.last_session_at ??
      session.last_status_at ??
      session.lastCheckinAt ??
      session.last_checkin_at ??
      session.last_reported_at ??
      session.last_completed_at,
  );
  if (actual) return actual;
  const scheduledAt = scheduledTodayAt(session.preferred_time);
  if (!scheduledAt || session.lastOutcome || session.last_outcome || session.last_status) return null;
  try {
    return new Intl.DateTimeFormat(undefined, { timeStyle: "short" }).format(scheduledAt);
  } catch {
    return session.preferred_time ?? null;
  }
}

function isPaused(session: Pick<BrainCoachSession, "is_paused" | "paused_until">) {
  if (session.is_paused) return true;
  if (!session.paused_until) return false;
  return new Date(session.paused_until).getTime() > Date.now();
}

function formatPausedUntil(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
  } catch {
    return date.toLocaleString();
  }
}

function pauseDescription(session: BrainCoachSession, t: (key: string) => string) {
  const until = formatPausedUntil(session.paused_until);
  const sourceKey = session.pause_source ? `routineCalls.pauseSource.${session.pause_source}` : "";
  const sourceLabel = sourceKey ? t(sourceKey) : "";
  const source = sourceLabel && sourceLabel !== sourceKey ? sourceLabel : "";
  const explanation = until
    ? t("routineCalls.pauseExplanation").replace("{date}", until)
    : t("routineCalls.pauseExplanationOpen");
  return source ? `${source} - ${explanation}` : explanation;
}

export default function BrainCoachMonitoring() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterTab>("all");
  const [editingSession, setEditingSession] = useState<BrainCoachSession | null>(null);
  const [form, setForm] = useState<FormState>({ enabled: false, frequency: "weekly", preferred_time: "10:00" });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useLanguage();
  const { isAdmin } = useAdminRole();
  const { data: currentUserContext } = useCurrentUserContext();
  const organizationTimezone = currentUserContext?.user?.organization?.timezone ?? "Europe/Berlin";
  const canEdit = isAdmin && !authBypassEnabled;

  const {
    data: sessionsData,
    error,
    isError,
    isLoading,
  } = useQuery({
    queryKey: ["brain-coach-monitoring"],
    queryFn: async (): Promise<BrainCoachSession[]> => {
      try {
        const response = await apiFetch<BrainCoachSessionResponse>("/api/v1/brain-coach-dashboard/sessions", {
          timeoutMs: REQUEST_TIMEOUT_MS,
        });
        return normalizeResponse(response);
      } catch (error) {
        if (authBypassEnabled) return [];
        const fallbackResponse = await apiFetch<ScheduledCallFallbackResponse>("/api/v1/checkins-dashboard/checkins?service_type=brain_coach", {
          timeoutMs: REQUEST_TIMEOUT_MS,
        });
        return normalizeFallbackResponse(fallbackResponse);
      }
    },
    retry: false,
  });

  const sessions = useMemo(() => sessionsData ?? [], [sessionsData]);

  useEffect(() => {
    if (!isError) return;
    toast({
      title: t("brainCoach.loadFailed"),
      description: error instanceof Error ? error.message : undefined,
      variant: "destructive",
    });
  }, [error, isError, t]);

  useEffect(() => {
    if (!editingSession) return;
    setForm({
      enabled: editingSession.enabled,
      frequency: editingSession.frequency || "weekly",
      preferred_time: editingSession.preferred_time || "10:00",
    });
  }, [editingSession]);

  const saveMutation = useMutation({
    mutationFn: (payload: { session: BrainCoachSession; form: FormState }) =>
      apiFetch(`/api/v1/brain-coach-dashboard/sessions/${payload.session.user_id}`, {
        method: "PATCH",
        body: JSON.stringify({
          enabled: payload.form.enabled,
          frequency: payload.form.frequency,
          preferred_time: payload.form.preferred_time || null,
        }),
      }),
    onSuccess: () => {
      toast({ title: t("brainCoach.updated") });
      setEditingSession(null);
      queryClient.invalidateQueries({ queryKey: ["brain-coach-monitoring"] });
    },
    onError: (mutationError) => {
      toast({
        title: t("brainCoach.saveFailed"),
        description: mutationError instanceof Error ? mutationError.message : undefined,
        variant: "destructive",
      });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: (session: BrainCoachSession) =>
      apiFetch(`/api/v1/brain-coach-dashboard/sessions/${session.user_id}`, {
        method: "PATCH",
        body: JSON.stringify({
          enabled: !session.enabled,
          frequency: session.frequency || "weekly",
          preferred_time: session.preferred_time || null,
        }),
      }),
    onSuccess: (_data, session) => {
      toast({ title: session.enabled ? t("brainCoach.disabled") : t("brainCoach.enabled") });
      queryClient.invalidateQueries({ queryKey: ["brain-coach-monitoring"] });
    },
    onError: (mutationError) => {
      toast({
        title: t("brainCoach.saveFailed"),
        description: mutationError instanceof Error ? mutationError.message : undefined,
        variant: "destructive",
      });
    },
  });

  const pauseMutation = useMutation({
    mutationFn: (session: BrainCoachSession) =>
      apiFetch("/api/v1/routine-calls/pause", {
        method: "POST",
        body: JSON.stringify({
          user_id: String(session.user_id),
          service: "brain_coach",
          days: 30,
          pause_source: "staff",
          pause_reason: "Paused by operations team",
        }),
      }),
    onSuccess: () => {
      toast({ title: t("routineCalls.paused") });
      queryClient.invalidateQueries({ queryKey: ["brain-coach-monitoring"] });
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["user-profile"] });
    },
    onError: (mutationError) => {
      toast({
        title: t("routineCalls.pauseFailed"),
        description: mutationError instanceof Error ? mutationError.message : undefined,
        variant: "destructive",
      });
    },
  });

  const resumeMutation = useMutation({
    mutationFn: (session: BrainCoachSession) =>
      apiFetch("/api/v1/routine-calls/resume", {
        method: "POST",
        body: JSON.stringify({
          user_id: String(session.user_id),
          service: "brain_coach",
        }),
      }),
    onSuccess: () => {
      toast({ title: t("routineCalls.resumed") });
      queryClient.invalidateQueries({ queryKey: ["brain-coach-monitoring"] });
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["user-profile"] });
    },
    onError: (mutationError) => {
      toast({
        title: t("routineCalls.resumeFailed"),
        description: mutationError instanceof Error ? mutationError.message : undefined,
        variant: "destructive",
      });
    },
  });

  const stats = useMemo(() => ({
    total: sessions.length,
    active: sessions.filter((session) => session.enabled).length,
    inactive: sessions.filter((session) => !session.enabled).length,
  }), [sessions]);

  const filtered = useMemo(() => {
    let list = sessions;
    if (filter === "active") list = list.filter((session) => session.enabled);
    if (filter === "inactive") list = list.filter((session) => !session.enabled);
    if (!search.trim()) return list;

    const query = search.toLowerCase();
    return list.filter((session) =>
      (session.userName ?? "").toLowerCase().includes(query) ||
      (session.userPhone ?? "").toLowerCase().includes(query) ||
      (session.city ?? "").toLowerCase().includes(query),
    );
  }, [filter, search, sessions]);

  const tabs: { key: FilterTab; label: string }[] = [
    { key: "all", label: `${t("brainCoach.all")} (${stats.total})` },
    { key: "active", label: `${t("brainCoach.active")} (${stats.active})` },
    { key: "inactive", label: `${t("brainCoach.inactive")} (${stats.inactive})` },
  ];

  const actionColSpan = canEdit ? 7 : 6;

  const handleSave = async () => {
    if (!editingSession) return;
    if (!form.frequency) {
      toast({ title: t("brainCoach.validation.frequency"), variant: "destructive" });
      return;
    }
    if (form.preferred_time && !validTimePattern.test(form.preferred_time)) {
      toast({ title: t("brainCoach.validation.time"), variant: "destructive" });
      return;
    }

    await saveMutation.mutateAsync({ session: editingSession, form });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-secondary/10 p-2">
          <Brain className="h-5 w-5 text-secondary" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">{t("brainCoach.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("brainCoach.subtitle")}</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard title={t("brainCoach.totalScheduled")} value={isLoading ? "-" : stats.total} icon={<Brain className="h-5 w-5" />} gradient="bg-gradient-to-br from-primary to-primary/70" />
        <StatCard title={t("brainCoach.activeSessions")} value={isLoading ? "-" : stats.active} icon={<Power className="h-5 w-5" />} gradient="bg-gradient-to-br from-emerald-500 to-emerald-600" />
        <StatCard title={t("brainCoach.inactiveSessions")} value={isLoading ? "-" : stats.inactive} icon={<PowerOff className="h-5 w-5" />} gradient="bg-gradient-to-br from-orange-500 to-orange-600" />
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1 rounded-lg border bg-muted/50 p-1">
          {tabs.map((tab) => (
            <Button key={tab.key} variant={filter === tab.key ? "default" : "ghost"} size="sm" onClick={() => setFilter(tab.key)} className="text-xs">
              {tab.label}
            </Button>
          ))}
        </div>
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder={t("brainCoach.searchPlaceholder")} value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>{t("brainCoach.userName")}</TableHead>
              <TableHead>{t("brainCoach.phone")}</TableHead>
              <TableHead>{t("brainCoach.status")}</TableHead>
              <TableHead>{t("brainCoach.lastSession")}</TableHead>
              <TableHead>{t("brainCoach.frequency")}</TableHead>
              <TableHead>{t("brainCoach.preferredTime")}</TableHead>
              {canEdit && <TableHead className="text-right">{t("brainCoach.actions")}</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, index) => (
                <TableRow key={index}>
                  {Array.from({ length: actionColSpan }).map((_, cellIndex) => (
                    <TableCell key={cellIndex}><Skeleton className="h-4 w-24" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : isError ? (
              <TableRow>
                <TableCell colSpan={actionColSpan} className="py-12 text-center text-destructive">
                  {t("brainCoach.loadFailed")}
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={actionColSpan} className="py-12 text-center text-muted-foreground">
                  {sessions.length === 0 ? t("brainCoach.noDataYet") : t("brainCoach.noMatch")}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((session) => {
                const paused = isPaused(session);
                const outcome = sessionOutcomeDisplay(session, t, organizationTimezone);
                const outcomeTime = lastSessionTime(session);

                return (
                  <TableRow
                    key={session.id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/brain-coach/${session.user_id}`)}
                  >
                    <TableCell>
                      <div className="font-medium text-foreground">{session.userName || t("common.unknown")}</div>
                      {session.city && <div className="text-xs text-muted-foreground">{session.city}</div>}
                    </TableCell>
                    <TableCell>{session.userPhone || "-"}</TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div>{paused ? t("routineCalls.pausedLabel") : statusLabel(session.enabled, t)}</div>
                        {paused && <p className="max-w-[280px] text-xs text-amber-700">{pauseDescription(session, t)}</p>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-0.5">
                        <Badge variant="outline" className={cn("rounded-full text-xs", outcomeBadgeClass(outcome.status))}>
                          {outcome.label}
                        </Badge>
                        {outcomeTime && <p className="text-xs text-muted-foreground">{outcomeTime}</p>}
                      </div>
                    </TableCell>
                    <TableCell>{formatFrequency(session.frequency, t)}</TableCell>
                    <TableCell>{session.preferred_time || "-"}</TableCell>
                    {canEdit && (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(event) => {
                              event.stopPropagation();
                              setEditingSession(session);
                            }}
                            aria-label={t("brainCoach.edit")}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(event) => {
                              event.stopPropagation();
                              toggleMutation.mutate(session);
                            }}
                            aria-label={session.enabled ? t("brainCoach.disable") : t("brainCoach.enable")}
                          >
                            {session.enabled ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(event) => {
                              event.stopPropagation();
                              paused ? resumeMutation.mutate(session) : pauseMutation.mutate(session);
                            }}
                            aria-label={paused ? t("routineCalls.resumeAction") : t("routineCalls.pauseAction")}
                          >
                            {paused ? <Play className="h-4 w-4" /> : <PauseCircle className="h-4 w-4" />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(event) => {
                              event.stopPropagation();
                              navigate(`/brain-coach/${session.user_id}`);
                            }}
                            aria-label={t("brainCoach.openReport")}
                          >
                            <BarChart3 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={Boolean(editingSession)} onOpenChange={(open) => !open && setEditingSession(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("brainCoach.dialogTitle")}</DialogTitle>
            <DialogDescription>{t("brainCoach.dialogDescription")}</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label>{t("brainCoach.client")}</Label>
              <div className="rounded-xl border bg-muted/40 px-3 py-2 text-sm text-foreground">
                {editingSession?.userName || "-"}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="brain-coach-frequency">{t("brainCoach.frequencyLabel")}</Label>
                <Select value={form.frequency} onValueChange={(value) => setForm((current) => ({ ...current, frequency: value }))}>
                  <SelectTrigger id="brain-coach-frequency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {frequencyOptions.map((option) => (
                      <SelectItem key={option} value={option}>
                        {t(`userForm.frequency.${option}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="brain-coach-time">{t("brainCoach.preferredTime")}</Label>
                <Input
                  id="brain-coach-time"
                  type="time"
                  value={form.preferred_time}
                  onChange={(event) => setForm((current) => ({ ...current, preferred_time: event.target.value }))}
                />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-xl border px-3 py-2">
              <div>
                <Label>{t("brainCoach.statusLabel")}</Label>
                <p className="text-xs text-muted-foreground">{statusLabel(form.enabled, t)}</p>
              </div>
              <Switch checked={form.enabled} onCheckedChange={(checked) => setForm((current) => ({ ...current, enabled: checked }))} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingSession(null)} disabled={saveMutation.isPending}>
              {t("brainCoach.cancel")}
            </Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? t("brainCoach.saving") : t("brainCoach.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
