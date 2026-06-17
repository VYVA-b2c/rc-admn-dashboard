import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Calendar,
  CheckCircle,
  Info,
  PauseCircle,
  Pencil,
  Play,
  PhoneCall,
  Plus,
  Power,
  PowerOff,
  Search,
  Trash2,
  XCircle,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScheduledCallDialog } from "@/components/checkins/ScheduledCallDialog";
import { StatCard } from "@/components/StatCard";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAdminRole } from "@/hooks/useAdminRole";
import { toast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/apiClient";
import { authBypassEnabled } from "@/lib/authMode";
import type { ScheduledCall, ScheduledCallPayload, ScheduledCallUser } from "@/types/scheduledCalls";

type FilterTab = "all" | "active" | "inactive";

type UserDashboardResponse = {
  gisUsers?: Array<{
    id: string | number;
    first_name?: string;
    last_name?: string;
    phone?: string | null;
    city?: string | null;
    checkinEnabled?: boolean;
    checkinFrequency?: string | null;
    checkinPreferredTime?: string | null;
    checkinLastStatus?: string | null;
    checkinLastReportedAt?: string | null;
  }>;
};

type ScheduledCallRow = ScheduledCall & {
  isFallback?: boolean;
  displayFrequency?: string | null;
  lastOutcome?: string | null;
  lastOutcomeAt?: string | null;
};

type ScheduledCallApiItem = Partial<ScheduledCall> & {
  name?: string | null;
  phone?: string | null;
  user_name?: string;
  user_phone?: string;
  preferredTime?: string | null;
  active?: boolean;
  enabled?: boolean;
  is_paused?: boolean;
  frequency?: number | string | null;
  pause_reason?: string | null;
  pause_source?: string | null;
  paused_until?: string | null;
  consent_given?: boolean;
  assigned_provider_name?: string | null;
  can_edit?: boolean;
  edit_block_reason?: "consent_required" | "assigned_provider_required" | null;
  lastOutcome?: string | null;
  lastOutcomeAt?: string | null;
  last_outcome?: string | null;
  last_outcome_at?: string | null;
  last_status?: string | null;
  last_status_at?: string | null;
  last_checkin_status?: string | null;
  last_checkin_at?: string | null;
  last_reported_at?: string | null;
  last_completed_at?: string | null;
  vyva_user_id?: number | string;
  user?: {
    id?: number | string;
    first_name?: string | null;
    last_name?: string | null;
    name?: string | null;
    phone?: string | null;
    city?: string | null;
  } | null;
  vyva_users?: {
    id?: number | string;
    first_name?: string | null;
    last_name?: string | null;
    phone?: string | null;
    city?: string | null;
  } | null;
};

type ScheduledCallsResponse =
  | ScheduledCallApiItem[]
  | {
      checkins?: ScheduledCallApiItem[];
      data?: ScheduledCallApiItem[];
    };

function callToPayload(call: ScheduledCall, overrides: Partial<ScheduledCallPayload> = {}): ScheduledCallPayload {
  return {
    user_id: String(call.user_id),
    type: call.type || "scheduled_call",
    is_active: call.is_active,
    frequency_days: call.frequency_days || 1,
    preferred_time: call.preferred_time || null,
    ...overrides,
  };
}

function pickString(...values: unknown[]) {
  const value = values.find((item) => typeof item === "string" && item.trim().length > 0);
  return typeof value === "string" ? value : undefined;
}

function pickId(...values: unknown[]) {
  const value = values.find((item) => typeof item === "string" || typeof item === "number");
  return value === undefined ? "" : value;
}

function fullName(firstName?: string | null, lastName?: string | null) {
  return [firstName, lastName].filter(Boolean).join(" ").trim();
}

function normalizeScheduledCall(raw: ScheduledCallApiItem): ScheduledCall {
  const nestedUser = raw.user ?? raw.vyva_users;
  const userId = pickId(raw.user_id, raw.vyva_user_id, nestedUser?.id);
  const name =
    pickString(
      raw.userName,
      raw.user_name,
      raw.name,
      nestedUser?.name,
      fullName(nestedUser?.first_name, nestedUser?.last_name),
    ) ?? String(userId || "Unknown");
  const frequency = Number(raw.frequency_days ?? raw.frequency ?? 1);

  return {
    id: pickId(raw.id),
    user_id: userId,
    userName: name,
    userPhone: pickString(raw.userPhone, raw.user_phone, raw.phone, nestedUser?.phone),
    city: pickString(raw.city, nestedUser?.city) ?? null,
    type: raw.type || "scheduled_call",
    is_active:
      typeof raw.is_active === "boolean"
        ? raw.is_active
        : typeof raw.active === "boolean"
          ? raw.active
          : typeof raw.enabled === "boolean"
            ? raw.enabled
            : true,
    frequency_days: Number.isInteger(frequency) && frequency > 0 ? frequency : 1,
    preferred_time: raw.preferred_time ?? raw.preferredTime ?? null,
    paused_until: raw.paused_until ?? null,
    pause_reason: raw.pause_reason ?? null,
    pause_source: raw.pause_source ?? null,
    is_paused: Boolean(raw.is_paused),
    consent_given: typeof raw.consent_given === "boolean" ? raw.consent_given : undefined,
    assigned_provider_name: raw.assigned_provider_name ?? null,
    can_edit: Boolean(raw.can_edit),
    edit_block_reason: raw.edit_block_reason ?? null,
    lastOutcome: raw.lastOutcome ?? raw.last_outcome ?? raw.last_status ?? raw.last_checkin_status ?? null,
    lastOutcomeAt: raw.lastOutcomeAt ?? raw.last_outcome_at ?? raw.last_status_at ?? raw.last_checkin_at ?? raw.last_reported_at ?? raw.last_completed_at ?? null,
  };
}

function normalizeScheduledCalls(response: ScheduledCallsResponse): ScheduledCall[] {
  const list = Array.isArray(response) ? response : response.checkins ?? response.data ?? [];
  return list.map(normalizeScheduledCall);
}

function normalizeFallbackCheckins(response: UserDashboardResponse): ScheduledCallRow[] {
  return (response.gisUsers ?? [])
    .filter((user) => Boolean(user.checkinEnabled))
    .map((user) => ({
      id: `fallback:${user.id}`,
      user_id: user.id,
      userName: fullName(user.first_name, user.last_name) || String(user.id),
      userPhone: user.phone,
      city: user.city ?? null,
      type: "scheduled_call",
      is_active: true,
      frequency_days: 1,
      preferred_time: user.checkinPreferredTime ?? null,
      displayFrequency: user.checkinFrequency ?? null,
      lastOutcome: user.checkinLastStatus ?? null,
      lastOutcomeAt: user.checkinLastReportedAt ?? null,
      isFallback: true,
    }));
}

function typeLabel(type: string | undefined, t: (key: string) => string) {
  if (!type) return "—";
  const key = `checkin.type.${type}`;
  const translated = t(key);
  if (translated !== key) return translated;
  return type.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatFrequencyLabel(call: ScheduledCallRow, t: (key: string) => string) {
  if (call.displayFrequency) {
    const key = `userForm.frequency.${call.displayFrequency}`;
    const translated = t(key);
    if (translated !== key) return translated;
    return call.displayFrequency;
  }
  if (!call.frequency_days) return "-";
  if (call.frequency_days === 1) return t("checkin.everyDay");
  return t("checkin.everyDays").replace("{count}", String(call.frequency_days));
}

function lastOutcomeLabel(call: ScheduledCallRow, t: (key: string) => string) {
  if (!call.lastOutcome) return t("checkin.outcomeUnknown");
  const key = `checkin.outcome.${call.lastOutcome}`;
  const translated = t(key);
  return translated !== key ? translated : call.lastOutcome;
}

function lastOutcomeTime(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function formatPreferredTime(value?: string | null) {
  if (!value) return "—";
  return value.slice(0, 5);
}

function isPaused(call: Pick<ScheduledCallRow, "is_paused" | "paused_until">) {
  if (call.is_paused) return true;
  if (!call.paused_until) return false;
  return new Date(call.paused_until).getTime() > Date.now();
}

function formatPausedUntil(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function pauseDescription(call: ScheduledCallRow, t: (key: string) => string) {
  const until = formatPausedUntil(call.paused_until);
  const sourceKey = call.pause_source ? `routineCalls.pauseSource.${call.pause_source}` : "";
  const sourceLabel = sourceKey ? t(sourceKey) : "";
  const source = sourceLabel && sourceLabel !== sourceKey ? sourceLabel : "";
  const explanation = until
    ? t("routineCalls.pauseExplanation").replace("{date}", until)
    : t("routineCalls.pauseExplanationOpen");
  return source ? `${source} · ${explanation}` : explanation;
}

function editPermissionLabel(call: ScheduledCallRow, t: (key: string) => string) {
  if (call.edit_block_reason === "consent_required") return t("checkin.permission.consentRequired");
  if (call.edit_block_reason === "assigned_provider_required") return t("checkin.permission.assignedProviderRequired");
  return t("checkin.permission.readOnly");
}

export default function CheckInMonitoring() {
  const CHECKIN_REQUEST_TIMEOUT_MS = 10_000;
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterTab>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCall, setEditingCall] = useState<ScheduledCall | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ScheduledCall | null>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useLanguage();
  const { isAdmin } = useAdminRole();

  const {
    data: checkinsData,
    error: checkinsError,
    isError,
    isLoading,
  } = useQuery({
    queryKey: ["checkin-monitoring"],
    queryFn: async (): Promise<ScheduledCallRow[]> => {
      try {
        const response = await apiFetch<ScheduledCallsResponse>("/api/v1/checkins-dashboard/checkins", {
          timeoutMs: CHECKIN_REQUEST_TIMEOUT_MS,
        });
        return normalizeScheduledCalls(response);
      } catch (error) {
        if (authBypassEnabled) return [];
        try {
          const fallbackResponse = await apiFetch<UserDashboardResponse>("/api/v1/user-dashboard/users", {
            timeoutMs: CHECKIN_REQUEST_TIMEOUT_MS,
          });
          return normalizeFallbackCheckins(fallbackResponse);
        } catch {
          throw error;
        }
      }
    },
    retry: false,
  });

  const checkins = useMemo(() => checkinsData ?? [], [checkinsData]);
  const usingFallbackData = useMemo(() => checkins.some((call) => call.isFallback), [checkins]);
  const canCreate = isAdmin && !authBypassEnabled && !usingFallbackData;
  const canShowActions = !usingFallbackData && (isAdmin || checkins.some((call) => call.can_edit));

  useEffect(() => {
    if (!isError) return;
    toast({
      title: t("checkin.loadFailed"),
      description: checkinsError instanceof Error ? checkinsError.message : undefined,
      variant: "destructive",
    });
  }, [checkinsError, isError, t]);

  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ["scheduled-call-users"],
    enabled: canCreate,
    retry: false,
    queryFn: async (): Promise<ScheduledCallUser[]> => {
      try {
        const response = await apiFetch<UserDashboardResponse | ScheduledCallUser[]>("/api/v1/user-dashboard/users", {
          timeoutMs: CHECKIN_REQUEST_TIMEOUT_MS,
        });
        if (Array.isArray(response)) return response;
        return (response.gisUsers ?? []).map((user) => ({
          id: user.id,
          first_name: user.first_name,
          last_name: user.last_name,
          phone: user.phone,
          city: user.city,
        }));
      } catch (error) {
        console.warn("Scheduled call users unavailable:", error instanceof Error ? error.message : error);
        return [];
      }
    },
  });

  const saveMutation = useMutation({
    mutationFn: ({ payload, call }: { payload: ScheduledCallPayload; call: ScheduledCall | null }) => {
      const endpoint = call
        ? `/api/v1/checkins-dashboard/checkins/${call.id}`
        : "/api/v1/checkins-dashboard/checkins";
      return apiFetch(endpoint, {
        method: call ? "PATCH" : "POST",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: (_data, variables) => {
      toast({ title: variables.call ? t("checkin.updated") : t("checkin.created") });
      queryClient.invalidateQueries({ queryKey: ["checkin-monitoring"] });
    },
    onError: (error) => {
      toast({
        title: t("checkin.saveFailed"),
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: (call: ScheduledCall) =>
      apiFetch(`/api/v1/checkins-dashboard/checkins/${call.id}`, {
        method: "PATCH",
        body: JSON.stringify(callToPayload(call, { is_active: !call.is_active })),
      }),
    onSuccess: (_data, call) => {
      toast({ title: call.is_active ? t("checkin.disabled") : t("checkin.enabled") });
      queryClient.invalidateQueries({ queryKey: ["checkin-monitoring"] });
    },
    onError: (error) => {
      toast({
        title: t("checkin.saveFailed"),
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (call: ScheduledCall) =>
      apiFetch(`/api/v1/checkins-dashboard/checkins/${call.id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      toast({ title: t("checkin.deleted") });
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ["checkin-monitoring"] });
    },
    onError: (error) => {
      toast({
        title: t("checkin.deleteFailed"),
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    },
  });

  const pauseMutation = useMutation({
    mutationFn: (call: ScheduledCallRow) =>
      apiFetch("/api/v1/routine-calls/pause", {
        method: "POST",
        body: JSON.stringify({
          user_id: String(call.user_id),
          service: "checkin",
          days: 30,
          pause_source: "staff",
          pause_reason: "Paused by operations team",
        }),
      }),
    onSuccess: () => {
      toast({ title: t("routineCalls.paused") });
      queryClient.invalidateQueries({ queryKey: ["checkin-monitoring"] });
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["user-profile"] });
    },
    onError: (error) => {
      toast({
        title: t("routineCalls.pauseFailed"),
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    },
  });

  const resumeMutation = useMutation({
    mutationFn: (call: ScheduledCallRow) =>
      apiFetch("/api/v1/routine-calls/resume", {
        method: "POST",
        body: JSON.stringify({
          user_id: String(call.user_id),
          service: "checkin",
        }),
      }),
    onSuccess: () => {
      toast({ title: t("routineCalls.resumed") });
      queryClient.invalidateQueries({ queryKey: ["checkin-monitoring"] });
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["user-profile"] });
    },
    onError: (error) => {
      toast({
        title: t("routineCalls.resumeFailed"),
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    },
  });

  const stats = useMemo(() => {
    return {
      total: checkins.length,
      active: checkins.filter((c) => c.is_active).length,
      inactive: checkins.filter((c) => !c.is_active).length,
    };
  }, [checkins]);

  const filtered = useMemo(() => {
    let list = checkins;
    if (filter === "active") list = list.filter((c) => c.is_active);
    if (filter === "inactive") list = list.filter((c) => !c.is_active);
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(
        (c) =>
          c.userName?.toLowerCase().includes(s) ||
          c.type?.toLowerCase().includes(s) ||
          c.userPhone?.toLowerCase().includes(s) ||
          c.city?.toLowerCase().includes(s),
      );
    }
    return list;
  }, [checkins, filter, search]);

  const tabs: { key: FilterTab; label: string }[] = [
    { key: "all", label: `${t("checkin.all")} (${stats.total})` },
    { key: "active", label: `${t("checkin.active")} (${stats.active})` },
    { key: "inactive", label: `${t("checkin.inactive")} (${stats.inactive})` },
  ];

  const openCreateDialog = () => {
    setEditingCall(null);
    setDialogOpen(true);
  };

  const openEditDialog = (call: ScheduledCall) => {
    setEditingCall(call);
    setDialogOpen(true);
  };

  const handleSubmit = async (payload: ScheduledCallPayload, call: ScheduledCall | null) => {
    try {
      await saveMutation.mutateAsync({ payload, call });
      return true;
    } catch {
      return false;
    }
  };

  const actionColSpan = canShowActions ? 8 : 7;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-secondary/10 p-2">
            <PhoneCall className="h-5 w-5 text-secondary" />
          </div>
          <h1 className="font-display text-2xl font-bold text-foreground">{t("checkin.title")}</h1>
        </div>
        {canCreate && (
          <Button onClick={openCreateDialog} disabled={usersLoading} className="rounded-xl">
            <Plus className="h-4 w-4" />
            {t("checkin.addScheduledCall")}
          </Button>
        )}
      </div>

      {usingFallbackData && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{t("checkin.fallbackNotice")}</p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard title={t("checkin.totalScheduled")} value={isLoading ? "—" : stats.total} icon={<Calendar className="h-5 w-5" />} gradient="bg-gradient-to-br from-primary to-primary/70" />
        <StatCard title={t("checkin.activeCheckins")} value={isLoading ? "—" : stats.active} icon={<CheckCircle className="h-5 w-5" />} gradient="bg-gradient-to-br from-emerald-500 to-emerald-600" />
        <StatCard title={t("checkin.inactiveCheckins")} value={isLoading ? "—" : stats.inactive} icon={<XCircle className="h-5 w-5" />} gradient="bg-gradient-to-br from-orange-500 to-orange-600" />
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
          <Input placeholder={t("checkin.searchPlaceholder")} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>{t("checkin.userName")}</TableHead>
              <TableHead>{t("checkin.phone")}</TableHead>
              <TableHead>{t("checkin.Type")}</TableHead>
              <TableHead>{t("checkin.status")}</TableHead>
              <TableHead>{t("checkin.lastCheckin")}</TableHead>
              <TableHead>{t("checkin.frequency")}</TableHead>
              <TableHead>{t("checkin.preferredTime")}</TableHead>
              {canShowActions && <TableHead className="text-right">{t("checkin.actions")}</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: actionColSpan }).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-24" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : isError ? (
              <TableRow>
                <TableCell colSpan={actionColSpan} className="py-12 text-center text-destructive">
                  {t("checkin.loadFailed")}
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={actionColSpan} className="py-12 text-center text-muted-foreground">
                  {checkins.length === 0 ? t("checkin.noDataYet") : t("checkin.noMatch")}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((c) => {
                const canWriteRow = Boolean(c.user_id);
                const paused = isPaused(c);
                const canManageRow = Boolean(c.can_edit && canWriteRow);
                const canDeleteRow = Boolean(isAdmin && canWriteRow);

                return (
                  <TableRow
                    key={String(c.id || `${c.user_id}-${c.type}-${c.preferred_time}`)}
                    className={c.user_id ? "cursor-pointer transition-colors hover:bg-muted/50" : "transition-colors"}
                    onClick={() => {
                      if (c.user_id) navigate(`/users/${c.user_id}`);
                    }}
                  >
                    <TableCell className="font-medium">{c.userName}</TableCell>
                    <TableCell className="text-muted-foreground">{c.userPhone || "?"}</TableCell>
                    <TableCell>{typeLabel(c.type, t)}</TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <Badge variant={paused ? "secondary" : c.is_active ? "default" : "secondary"} className="text-xs">
                          {paused ? t("routineCalls.pausedLabel") : c.is_active ? t("checkin.active") : t("checkin.inactive")}
                        </Badge>
                        {paused && <p className="max-w-[280px] text-xs text-amber-700">{pauseDescription(c, t)}</p>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-0.5">
                        <p>{lastOutcomeLabel(c, t)}</p>
                        {lastOutcomeTime(c.lastOutcomeAt) && (
                          <p className="text-xs text-muted-foreground">{lastOutcomeTime(c.lastOutcomeAt)}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{formatFrequencyLabel(c, t)}</TableCell>
                    <TableCell>{formatPreferredTime(c.preferred_time)}</TableCell>
                    {canShowActions && (
                      <TableCell onClick={(event) => event.stopPropagation()}>
                        <div className="flex justify-end gap-1">
                          {canManageRow && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                title={t("checkin.edit")}
                                aria-label={`${t("checkin.edit")} ${c.userName}`}
                                className="h-8 w-8 rounded-xl"
                                disabled={toggleMutation.isPending || saveMutation.isPending}
                                onClick={() => openEditDialog(c)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                title={c.is_active ? t("checkin.disable") : t("checkin.enable")}
                                aria-label={`${c.is_active ? t("checkin.disable") : t("checkin.enable")} ${c.userName}`}
                                className="h-8 w-8 rounded-xl"
                                disabled={toggleMutation.isPending}
                                onClick={() => toggleMutation.mutate(c)}
                              >
                                {c.is_active ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                title={paused ? t("routineCalls.resumeAction") : t("routineCalls.pauseAction")}
                                aria-label={`${paused ? t("routineCalls.resumeAction") : t("routineCalls.pauseAction")} ${c.userName}`}
                                className="h-8 w-8 rounded-xl"
                                disabled={pauseMutation.isPending || resumeMutation.isPending}
                                onClick={() => (paused ? resumeMutation.mutate(c) : pauseMutation.mutate(c))}
                              >
                                {paused ? <Play className="h-4 w-4" /> : <PauseCircle className="h-4 w-4" />}
                              </Button>
                            </>
                          )}
                          {canDeleteRow && (
                            <Button
                              variant="ghost"
                              size="icon"
                              title={t("checkin.delete")}
                              aria-label={`${t("checkin.delete")} ${c.userName}`}
                              className="h-8 w-8 rounded-xl text-destructive hover:text-destructive"
                              disabled={!canWriteRow}
                              onClick={() => setDeleteTarget(c)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                          {!canManageRow && !canDeleteRow && (
                            <span className="max-w-[220px] text-right text-xs text-muted-foreground">
                              {editPermissionLabel(c, t)}
                            </span>
                          )}
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

      {canShowActions && (
        <>
          <ScheduledCallDialog
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            call={editingCall}
            users={users}
            onSubmit={handleSubmit}
            submitting={saveMutation.isPending}
          />
          <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("checkin.deleteConfirmTitle")}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t("checkin.deleteConfirmDescription").replace("{name}", deleteTarget?.userName ?? "")}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={deleteMutation.isPending}>{t("checkin.cancel")}</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  disabled={deleteMutation.isPending}
                  onClick={(event) => {
                    event.preventDefault();
                    if (deleteTarget) deleteMutation.mutate(deleteTarget);
                  }}
                >
                  {deleteMutation.isPending ? t("checkin.deleting") : t("checkin.delete")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </div>
  );
}
