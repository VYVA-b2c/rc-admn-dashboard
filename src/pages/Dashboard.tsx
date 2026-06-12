import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { formatDistanceToNow } from "date-fns";
import { useLocation } from "react-router-dom";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Flame,
  MapPin,
  MoreHorizontal,
  Phone,
  PhoneOff,
  Pill,
  Search,
  UserPlus,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { GISMap } from "@/components/dashboard/GISMap";
import { InterventionPanel } from "@/components/dashboard/InterventionPanel";
import { useLanguage } from "@/contexts/LanguageContext";
import { getRiskBand } from "@/lib/riskScore";
import { cn } from "@/lib/utils";
import { useGISData, type ActiveAlert, type GISUser } from "@/hooks/useGISData";

type DashboardFilter =
  | "all"
  | "urgent"
  | "review"
  | "no-response"
  | "medication"
  | "wellbeing"
  | "unassigned"
  | "overdue";

type QueueTask = {
  id: string;
  alert: ActiveAlert;
  user: GISUser | undefined;
  person: string;
  status: "urgent" | "review";
  reason: string;
  channel: string;
  lastContact: string;
  assignedTo: string;
  action: "call" | "assign" | "review" | "escalate";
  waitMinutes: number;
};

const localeMap = {
  en: "en-US",
  de: "de-DE",
  es: "es-ES",
};

const severityPriority: Record<string, number> = {
  critical: 0,
  high: 1,
  warning: 2,
  medium: 3,
  low: 4,
};

const alertReason: Record<string, string> = {
  fall_detected: "queue.reason.fall",
  missed_checkin: "queue.reason.missedCheckin",
  high_heart_rate: "queue.reason.heartRate",
  medication_missed: "queue.reason.medication",
  inactivity_detected: "queue.reason.inactivity",
  low_battery: "queue.reason.lowBattery",
  temperature_high: "queue.reason.temperature",
  door_open: "queue.reason.door",
};

const actionByAlert: Record<string, QueueTask["action"]> = {
  fall_detected: "escalate",
  missed_checkin: "call",
  high_heart_rate: "call",
  medication_missed: "review",
  inactivity_detected: "assign",
  low_battery: "assign",
  temperature_high: "review",
  door_open: "call",
};

function MetricCard({
  label,
  value,
  detail,
  tone,
  icon,
}: {
  label: string;
  value: string | number;
  detail: string;
  tone: "purple" | "red" | "orange" | "green" | "yellow";
  icon: ReactNode;
}) {
  const toneClass = {
    purple: "border-t-primary text-primary",
    red: "border-t-destructive text-destructive",
    orange: "border-t-[hsl(24,94%,53%)] text-[hsl(24,94%,53%)]",
    green: "border-t-[hsl(142,71%,45%)] text-[hsl(142,71%,45%)]",
    yellow: "border-t-[hsl(45,96%,48%)] text-[hsl(45,96%,48%)]",
  }[tone];

  return (
    <Card className={cn("overflow-hidden border-t-4 bg-white shadow-sm", toneClass)}>
      <CardContent className="flex min-h-[108px] items-center justify-between gap-4 p-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-muted-foreground">{label}</p>
          <p className={cn("mt-1 text-3xl font-extrabold tracking-tight", toneClass)}>{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
        </div>
        <div className="rounded-2xl bg-muted p-2.5 text-muted-foreground">{icon}</div>
      </CardContent>
    </Card>
  );
}

function FilterChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={cn(
        "rounded-full border px-4 py-2 text-sm font-semibold shadow-sm transition-colors",
        active
          ? "border-primary bg-primary text-white"
          : "border-border bg-white text-muted-foreground hover:border-primary/40 hover:text-foreground",
      )}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function LayerToggle({
  active,
  label,
  icon,
  onClick,
}: {
  active: boolean;
  label: string;
  icon: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-bold shadow-sm transition-colors",
        active
          ? "border-primary bg-primary text-white"
          : "border-border bg-white text-muted-foreground hover:border-primary/40 hover:text-foreground",
      )}
      onClick={onClick}
    >
      {icon}
      {label}
    </button>
  );
}

function queueStatusClass(status: QueueTask["status"]) {
  return status === "urgent"
    ? "bg-destructive/10 text-destructive border-destructive/20"
    : "bg-[hsl(24,94%,53%)]/10 text-[hsl(24,94%,53%)] border-[hsl(24,94%,53%)]/20";
}

function queueActionClass(action: QueueTask["action"]) {
  if (action === "escalate") return "bg-destructive text-white hover:bg-destructive/90";
  if (action === "call") return "bg-primary text-white hover:bg-primary/90";
  return "bg-primary/10 text-primary hover:bg-primary/15";
}

function actionLabelKey(action: QueueTask["action"]) {
  if (action === "call") return "queue.action.call";
  if (action === "assign") return "queue.action.assign";
  if (action === "escalate") return "queue.action.escalate";
  return "queue.action.review";
}

export default function Dashboard() {
  const { data, isLoading } = useGISData();
  const { language, t } = useLanguage();
  const location = useLocation();
  const [interventionUser, setInterventionUser] = useState<GISUser | null>(null);
  const [interventionOpen, setInterventionOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<DashboardFilter>("all");
  const [showSeniors, setShowSeniors] = useState(true);
  const [showOffices, setShowOffices] = useState(true);
  const [showFieldStaff, setShowFieldStaff] = useState(true);
  const [heatmapMode, setHeatmapMode] = useState(false);

  const users = useMemo(() => data?.gisUsers ?? [], [data?.gisUsers]);
  const alerts = useMemo(() => data?.activeAlerts ?? [], [data?.activeAlerts]);
  const offices = useMemo(() => data?.offices ?? [], [data?.offices]);
  const fieldStaff = useMemo(() => data?.fieldStaff ?? [], [data?.fieldStaff]);

  const todayLabel = useMemo(() => {
    const formatter = new Intl.DateTimeFormat(localeMap[language], {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
    return `${formatter.format(new Date())} · ${t("dashboard.morningShift")}`;
  }, [language, t]);

  const queueTasks = useMemo<QueueTask[]>(() => {
    return alerts
      .map((alert) => {
        const user = users.find((item) => item.id === alert.vyva_user_id);
        const waitMinutes = Math.max(0, Math.round((Date.now() - new Date(alert.created_at).getTime()) / 60000));
        const status = alert.severity === "critical" || alert.severity === "high" ? "urgent" : "review";

        return {
          id: alert.id,
          alert,
          user,
          person: alert.user_name,
          status,
          reason: t(alertReason[alert.alert_type] ?? "queue.reason.default"),
          channel: alert.phone ? t("queue.channel.phone") : t("queue.channel.app"),
          lastContact: formatDistanceToNow(new Date(alert.created_at), {
            addSuffix: true,
            locale: undefined,
          }),
          assignedTo: status === "urgent" ? t("queue.unassigned") : t("layout.operatorName"),
          action: actionByAlert[alert.alert_type] ?? "review",
          waitMinutes,
        };
      })
      .sort((a, b) => {
        const severityDiff = (severityPriority[a.alert.severity] ?? 9) - (severityPriority[b.alert.severity] ?? 9);
        return severityDiff || b.waitMinutes - a.waitMinutes;
      });
  }, [alerts, users, t]);

  const filteredTasks = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return queueTasks.filter((task) => {
      const matchesSearch =
        !q ||
        task.person.toLowerCase().includes(q) ||
        task.reason.toLowerCase().includes(q) ||
        (task.user?.city?.toLowerCase().includes(q) ?? false);
      if (!matchesSearch) return false;

      if (activeFilter === "urgent") return task.status === "urgent";
      if (activeFilter === "review") return task.status === "review";
      if (activeFilter === "no-response") return ["missed_checkin", "inactivity_detected"].includes(task.alert.alert_type);
      if (activeFilter === "medication") return task.alert.alert_type === "medication_missed";
      if (activeFilter === "wellbeing") return task.alert.alert_type === "high_heart_rate";
      if (activeFilter === "unassigned") return task.assignedTo === t("queue.unassigned");
      if (activeFilter === "overdue") return task.waitMinutes >= 60;
      return true;
    });
  }, [activeFilter, queueTasks, searchQuery, t]);

  const filteredUsers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return users.filter((user) => {
      const matchesSearch =
        !q ||
        `${user.first_name} ${user.last_name}`.toLowerCase().includes(q) ||
        (user.city?.toLowerCase().includes(q) ?? false);
      if (!matchesSearch) return false;
      if (activeFilter === "urgent") return user.criticalAlerts > 0 || getRiskBand(user.riskScore) === "high";
      if (activeFilter === "review") return user.activeAlerts > 0 && user.criticalAlerts === 0;
      if (activeFilter === "medication") return user.missedMeds7d > 0;
      return true;
    });
  }, [activeFilter, searchQuery, users]);

  const handleUserClick = useCallback((user: GISUser) => {
    setInterventionUser(user);
    setInterventionOpen(true);
  }, []);

  const urgentCount = data?.criticalAlertCount ?? filteredTasks.filter((task) => task.status === "urgent").length;
  const reviewCount = Math.max((data?.activeAlertCount ?? 0) - urgentCount, 0);
  const missedMeds = users.reduce((sum, user) => sum + (user.missedMeds7d ?? 0), 0);
  const noResponseCount = alerts.filter((alert) => ["missed_checkin", "inactivity_detected"].includes(alert.alert_type)).length;
  const checkinPercent = data?.totalUsers ? Math.round(((data.checkinsEnabled ?? 0) / data.totalUsers) * 100) : 0;

  const filterOptions: { id: DashboardFilter; label: string }[] = [
    { id: "urgent", label: t("dashboard.filter.urgent") },
    { id: "review", label: t("dashboard.filter.review") },
    { id: "no-response", label: t("dashboard.filter.noResponse") },
    { id: "medication", label: t("dashboard.filter.medication") },
    { id: "wellbeing", label: t("dashboard.filter.wellbeing") },
    { id: "unassigned", label: t("dashboard.filter.unassigned") },
    { id: "overdue", label: t("dashboard.filter.overdue") },
  ];

  const hasActiveFilters = activeFilter !== "all" || searchQuery.trim();

  useEffect(() => {
    window.requestAnimationFrame(() => {
      if (location.pathname === "/risk-queue") {
        document.getElementById("risk-queue")?.scrollIntoView({ block: "start" });
      } else if (location.pathname === "/") {
        window.scrollTo({ top: 0 });
      }
    });
  }, [location.pathname]);

  return (
    <div className="mx-auto max-w-[1520px] space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground md:text-3xl">{t("dashboard.today")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{todayLabel}</p>
        </div>
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder={t("dashboard.searchPlaceholder")}
            className="h-11 rounded-2xl border-border bg-white pl-10 shadow-sm"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <MetricCard
          label={t("metric.enrolled")}
          value={isLoading ? "—" : data?.totalUsers ?? 0}
          detail={t("metric.activePeople")}
          tone="purple"
          icon={<Users className="h-5 w-5" />}
        />
        <MetricCard
          label={t("metric.urgent")}
          value={isLoading ? "—" : urgentCount}
          detail={t("metric.immediateAction")}
          tone="red"
          icon={<AlertTriangle className="h-5 w-5" />}
        />
        <MetricCard
          label={t("metric.review")}
          value={isLoading ? "—" : reviewCount}
          detail={t("metric.today")}
          tone="orange"
          icon={<CheckCircle2 className="h-5 w-5" />}
        />
        <MetricCard
          label={t("metric.checkins")}
          value={isLoading ? "—" : `${checkinPercent}%`}
          detail={`${data?.checkinsEnabled ?? 0} / ${data?.totalUsers ?? 0}`}
          tone="green"
          icon={<Phone className="h-5 w-5" />}
        />
        <MetricCard
          label={t("metric.medication")}
          value={isLoading ? "—" : missedMeds}
          detail={t("metric.missedDoses")}
          tone="yellow"
          icon={<Pill className="h-5 w-5" />}
        />
        <MetricCard
          label={t("metric.noResponse")}
          value={isLoading ? "—" : noResponseCount}
          detail={t("metric.open")}
          tone="orange"
          icon={<PhoneOff className="h-5 w-5" />}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {filterOptions.map((filter) => (
          <FilterChip
            key={filter.id}
            active={activeFilter === filter.id}
            label={filter.label}
            onClick={() => setActiveFilter((current) => (current === filter.id ? "all" : filter.id))}
          />
        ))}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setActiveFilter("all");
              setSearchQuery("");
            }}
            className="rounded-full text-muted-foreground"
          >
            <X className="mr-1 h-4 w-4" />
            {t("dashboard.clear")}
          </Button>
        )}
      </div>

      <Card id="risk-queue" className="scroll-mt-5 overflow-hidden border-border bg-white shadow-sm">
        <CardContent className="p-0">
          <div className="relative">
            <div className="absolute left-4 top-4 z-[5] flex max-w-[calc(100%-2rem)] flex-wrap gap-2">
              <LayerToggle
                active={showSeniors}
                label={t("map.seniors")}
                icon={<MapPin className="h-3.5 w-3.5" />}
                onClick={() => setShowSeniors((value) => !value)}
              />
              <LayerToggle
                active={showOffices}
                label={t("map.offices")}
                icon={<Building2 className="h-3.5 w-3.5" />}
                onClick={() => setShowOffices((value) => !value)}
              />
              <LayerToggle
                active={showFieldStaff}
                label={t("map.fieldStaff")}
                icon={<UserRound className="h-3.5 w-3.5" />}
                onClick={() => setShowFieldStaff((value) => !value)}
              />
              <LayerToggle
                active={heatmapMode}
                label={t("dashboard.heatmap")}
                icon={<Flame className="h-3.5 w-3.5" />}
                onClick={() => setHeatmapMode((value) => !value)}
              />
            </div>
            <GISMap
              users={filteredUsers}
              offices={offices}
              fieldStaff={fieldStaff}
              onUserClick={handleUserClick}
              heatmapMode={heatmapMode}
              showUsers={showSeniors}
              showOffices={showOffices}
              showFieldStaff={showFieldStaff}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden border-border bg-white shadow-sm">
        <div className="flex flex-col gap-2 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-extrabold text-foreground">
              {t("queue.title")} <span className="text-primary">- {filteredTasks.length} {t("queue.cases")}</span>
            </h2>
          </div>
          <p className="text-xs font-medium text-muted-foreground">{t("queue.sorted")}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-left text-sm">
            <thead className="bg-muted/70 text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
              <tr>
                <th className="px-5 py-3">{t("queue.person")}</th>
                <th className="px-5 py-3">{t("queue.status")}</th>
                <th className="px-5 py-3">{t("queue.reason")}</th>
                <th className="px-5 py-3">{t("queue.channel")}</th>
                <th className="px-5 py-3">{t("queue.lastContact")}</th>
                <th className="px-5 py-3">{t("queue.assignedTo")}</th>
                <th className="px-5 py-3 text-right">{t("queue.action")}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-sm text-muted-foreground">
                    {t("queue.loading")}
                  </td>
                </tr>
              ) : filteredTasks.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-sm text-muted-foreground">
                    {t("queue.empty")}
                  </td>
                </tr>
              ) : (
                filteredTasks.slice(0, 8).map((task) => (
                  <tr
                    key={task.id}
                    className="border-t border-border transition-colors hover:bg-muted/35"
                    onClick={() => task.user && handleUserClick(task.user)}
                  >
                    <td className="px-5 py-4">
                      <div className="font-bold text-foreground">{task.person}</div>
                      <div className="text-xs text-muted-foreground">
                        {task.user?.date_of_birth ? t("queue.knownProfile") : task.user?.city ?? t("queue.unknownArea")}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <Badge variant="outline" className={cn("border font-semibold", queueStatusClass(task.status))}>
                        <span className="mr-1 h-1.5 w-1.5 rounded-full bg-current" />
                        {t(task.status === "urgent" ? "queue.status.urgent" : "queue.status.review")}
                      </Badge>
                    </td>
                    <td className="max-w-[340px] px-5 py-4 text-foreground">{task.reason}</td>
                    <td className="px-5 py-4 text-muted-foreground">{task.channel}</td>
                    <td className="px-5 py-4 text-muted-foreground">{task.lastContact}</td>
                    <td className="px-5 py-4">
                      <span className={cn(task.assignedTo === t("queue.unassigned") && "font-semibold text-destructive")}>
                        {task.assignedTo}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          className={cn("rounded-xl text-xs font-bold", queueActionClass(task.action))}
                          onClick={(event) => {
                            event.stopPropagation();
                            if (task.user) handleUserClick(task.user);
                          }}
                        >
                          {t(actionLabelKey(task.action))}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-xl text-muted-foreground"
                          aria-label={`${t("queue.action.review")} ${task.person}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            if (task.user) handleUserClick(task.user);
                          }}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <InterventionPanel
        user={interventionUser}
        alerts={alerts}
        open={interventionOpen}
        onOpenChange={setInterventionOpen}
      />
    </div>
  );
}
