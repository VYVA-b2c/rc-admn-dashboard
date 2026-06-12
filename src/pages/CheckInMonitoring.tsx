import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Calendar,
  CheckCircle,
  Pencil,
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
  }>;
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

function typeLabel(type: string | undefined, t: (key: string) => string) {
  if (!type) return "—";
  const key = `checkin.type.${type}`;
  const translated = t(key);
  if (translated !== key) return translated;
  return type.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function CheckInMonitoring() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterTab>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCall, setEditingCall] = useState<ScheduledCall | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ScheduledCall | null>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useLanguage();
  const { isAdmin } = useAdminRole();
  const canEdit = isAdmin && !authBypassEnabled;

  const { data: checkinsData, isLoading } = useQuery({
    queryKey: ["checkin-monitoring"],
    queryFn: async (): Promise<ScheduledCall[]> => {
      try {
        return await apiFetch<ScheduledCall[]>("/api/v1/checkins-dashboard/checkins");
      } catch (error) {
        if (!authBypassEnabled) {
          console.warn("Check-in API unavailable:", error instanceof Error ? error.message : error);
        }
        return [];
      }
    },
    retry: false,
  });

  const checkins = useMemo(() => checkinsData ?? [], [checkinsData]);

  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ["scheduled-call-users"],
    enabled: canEdit,
    retry: false,
    queryFn: async (): Promise<ScheduledCallUser[]> => {
      try {
        const response = await apiFetch<UserDashboardResponse | ScheduledCallUser[]>("/api/v1/user-dashboard/users");
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

  const stats = useMemo(() => {
    return {
      total: checkins.length,
      active: checkins.filter((c) => c.is_active).length,
      inactive: checkins.filter((c) => !c.is_active).length,
    };
  }, [checkins]);

  function formatFrequency(days?: number) {
    if (!days) return "—";
    if (days === 1) return t("checkin.everyDay");
    return t("checkin.everyDays").replace("{count}", String(days));
  }

  const filtered = useMemo(() => {
    let list = checkins;
    if (filter === "active") list = list.filter((c) => c.is_active);
    if (filter === "inactive") list = list.filter((c) => !c.is_active);
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(
        (c) =>
          c.userName.toLowerCase().includes(s) ||
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

  const actionColSpan = canEdit ? 7 : 6;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-secondary/10 p-2">
            <PhoneCall className="h-5 w-5 text-secondary" />
          </div>
          <h1 className="font-display text-2xl font-bold text-foreground">{t("checkin.title")}</h1>
        </div>
        {canEdit && (
          <Button onClick={openCreateDialog} disabled={usersLoading} className="rounded-xl">
            <Plus className="h-4 w-4" />
            {t("checkin.addScheduledCall")}
          </Button>
        )}
      </div>

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
              <TableHead>{t("checkin.frequency")}</TableHead>
              <TableHead>{t("checkin.preferredTime")}</TableHead>
              {canEdit && <TableHead className="text-right">{t("checkin.actions")}</TableHead>}
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
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={actionColSpan} className="py-12 text-center text-muted-foreground">
                  {checkins.length === 0 ? t("checkin.noDataYet") : t("checkin.noMatch")}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((c) => (
                <TableRow key={c.id} className="cursor-pointer transition-colors hover:bg-muted/50" onClick={() => navigate(`/users/${c.user_id}`)}>
                  <TableCell className="font-medium">{c.userName}</TableCell>
                  <TableCell className="text-muted-foreground">{c.userPhone || "—"}</TableCell>
                  <TableCell>{typeLabel(c.type, t)}</TableCell>
                  <TableCell>
                    <Badge variant={c.is_active ? "default" : "secondary"} className="text-xs">
                      {c.is_active ? t("checkin.active") : t("checkin.inactive")}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatFrequency(c.frequency_days)}</TableCell>
                  <TableCell>{c.preferred_time || "—"}</TableCell>
                  {canEdit && (
                    <TableCell onClick={(event) => event.stopPropagation()}>
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          title={t("checkin.edit")}
                          aria-label={`${t("checkin.edit")} ${c.userName}`}
                          className="h-8 w-8 rounded-xl"
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
                          title={t("checkin.delete")}
                          aria-label={`${t("checkin.delete")} ${c.userName}`}
                          className="h-8 w-8 rounded-xl text-destructive hover:text-destructive"
                          onClick={() => setDeleteTarget(c)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {canEdit && (
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
