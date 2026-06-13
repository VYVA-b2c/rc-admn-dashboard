import { useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Heart,
  MapPin,
  MessageCircle,
  PhoneCall,
  Pill,
  Search,
  UserRound,
  type LucideIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useLanguage } from "@/contexts/LanguageContext";
import { useGISData } from "@/hooks/useGISData";
import { authBypassEnabled } from "@/lib/authMode";
import {
  demoOperationalUsers,
  type OperationalChannel,
  type OperationalQueueUser,
  type OperationalStatus,
} from "@/lib/operationalDemoData";
import { computeRiskScore } from "@/lib/riskScore";
import { cn } from "@/lib/utils";

type FollowUpKind = "medication" | "wellbeing" | "symptoms";
type FilterKey = "all" | "urgent" | "review" | "stable";

type FollowUpRow = {
  id: string;
  action: "call" | "review";
  assignedTo?: string | null;
  channel: OperationalChannel;
  city: string;
  detail: string;
  issueScore: number;
  name: string;
  reasonKey: string;
  score: number;
  status: OperationalStatus;
};

type PageConfig = {
  accentClass: string;
  icon: LucideIcon;
  kind: FollowUpKind;
  titleKey: string;
  subtitleKey: string;
  metricKeys: [string, string, string, string];
};

const configs: Record<FollowUpKind, PageConfig> = {
  medication: {
    accentClass: "border-t-orange-500 text-orange-600",
    icon: Pill,
    kind: "medication",
    titleKey: "followup.medication.title",
    subtitleKey: "followup.medication.subtitle",
    metricKeys: [
      "followup.medication.metric.review",
      "followup.medication.metric.unconfirmed",
      "followup.medication.metric.highRisk",
      "followup.medication.metric.onTrack",
    ],
  },
  wellbeing: {
    accentClass: "border-t-emerald-500 text-emerald-600",
    icon: Heart,
    kind: "wellbeing",
    titleKey: "followup.wellbeing.title",
    subtitleKey: "followup.wellbeing.subtitle",
    metricKeys: [
      "followup.wellbeing.metric.review",
      "followup.wellbeing.metric.noResponse",
      "followup.wellbeing.metric.unassigned",
      "followup.wellbeing.metric.supported",
    ],
  },
  symptoms: {
    accentClass: "border-t-red-500 text-red-600",
    icon: Activity,
    kind: "symptoms",
    titleKey: "followup.symptoms.title",
    subtitleKey: "followup.symptoms.subtitle",
    metricKeys: [
      "followup.symptoms.metric.critical",
      "followup.symptoms.metric.alerts",
      "followup.symptoms.metric.offline",
      "followup.symptoms.metric.stable",
    ],
  },
};

const filterKeys: FilterKey[] = ["all", "urgent", "review", "stable"];

function getRiskScore(user: OperationalQueueUser) {
  if (typeof user.riskScore === "number" && user.riskScore > 0) return user.riskScore;

  return computeRiskScore({
    activeAlerts: user.activeAlerts ?? 0,
    checkinEnabled: user.checkinEnabled ?? false,
    criticalAlerts: user.criticalAlerts ?? 0,
    healthConditions: user.healthConditions ?? 0,
    missedMeds7d: user.missedMeds7d ?? 0,
    offlineSensors: user.offlineSensors ?? 0,
  });
}

function deriveStatus(user: OperationalQueueUser, score: number): OperationalStatus {
  if (user.operationalContext?.riskStatus) return user.operationalContext.riskStatus;
  if ((user.criticalAlerts ?? 0) > 0 || score >= 80) return "urgent";
  if ((user.activeAlerts ?? 0) > 0 || (user.missedMeds7d ?? 0) > 0 || !(user.checkinEnabled ?? false)) return "review";
  return "stable";
}

function statusClasses(status: OperationalStatus) {
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

function toRow(user: OperationalQueueUser, kind: FollowUpKind): FollowUpRow {
  const score = getRiskScore(user);
  const status = deriveStatus(user, score);
  const meta = user.operationalContext;
  const name = `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim() || "Unknown";
  const assignedTo = meta?.assignedTo;
  const channel = meta?.preferredChannel ?? "phone";

  if (kind === "medication") {
    const missedMeds = user.missedMeds7d ?? 0;
    return {
      id: user.id,
      action: missedMeds > 0 || status === "urgent" ? "call" : "review",
      assignedTo,
      channel,
      city: user.city ?? "",
      detail: missedMeds > 0 ? String(missedMeds) : "0",
      issueScore: missedMeds,
      name,
      reasonKey: missedMeds > 0 ? "followup.medication.reason" : "followup.medication.noIssue",
      score,
      status,
    };
  }

  if (kind === "wellbeing") {
    const noResponse = Boolean(meta?.noResponse);
    const unsupported = !assignedTo || !(user.checkinEnabled ?? false);
    return {
      id: user.id,
      action: noResponse || status === "urgent" ? "call" : "review",
      assignedTo,
      channel,
      city: user.city ?? "",
      detail: noResponse ? "1" : unsupported ? "1" : "0",
      issueScore: (noResponse ? 2 : 0) + (unsupported ? 1 : 0),
      name,
      reasonKey: noResponse ? "followup.wellbeing.reasonNoResponse" : unsupported ? "followup.wellbeing.reasonSupport" : "followup.wellbeing.noIssue",
      score,
      status: noResponse || unsupported ? (status === "stable" ? "review" : status) : status,
    };
  }

  const criticalAlerts = user.criticalAlerts ?? 0;
  const activeAlerts = user.activeAlerts ?? 0;
  const offlineSensors = user.offlineSensors ?? 0;
  return {
    id: user.id,
    action: criticalAlerts > 0 || status === "urgent" ? "call" : "review",
    assignedTo,
    channel,
    city: user.city ?? "",
    detail: String(activeAlerts + offlineSensors),
    issueScore: criticalAlerts * 3 + activeAlerts + offlineSensors,
    name,
    reasonKey: criticalAlerts > 0 ? "followup.symptoms.reasonCritical" : activeAlerts > 0 ? "followup.symptoms.reasonAlert" : offlineSensors > 0 ? "followup.symptoms.reasonOffline" : "followup.symptoms.noIssue",
    score,
    status,
  };
}

function metricValues(kind: FollowUpKind, rows: FollowUpRow[]) {
  if (kind === "medication") {
    const review = rows.filter((row) => row.issueScore > 0).length;
    const unconfirmed = rows.reduce((total, row) => total + row.issueScore, 0);
    const highRisk = rows.filter((row) => row.issueScore > 0 && row.status === "urgent").length;
    return [review, unconfirmed, highRisk, Math.max(0, rows.length - review)];
  }

  if (kind === "wellbeing") {
    const review = rows.filter((row) => row.issueScore > 0).length;
    const noResponse = rows.filter((row) => row.reasonKey === "followup.wellbeing.reasonNoResponse").length;
    const unassigned = rows.filter((row) => !row.assignedTo).length;
    return [review, noResponse, unassigned, Math.max(0, rows.length - review)];
  }

  const critical = rows.filter((row) => row.reasonKey === "followup.symptoms.reasonCritical").length;
  const alerts = rows.reduce((total, row) => total + row.issueScore, 0);
  const offline = rows.filter((row) => row.reasonKey === "followup.symptoms.reasonOffline").length;
  return [critical, alerts, offline, Math.max(0, rows.length - rows.filter((row) => row.issueScore > 0).length)];
}

export function FollowUpMonitoring({ kind }: { kind: FollowUpKind }) {
  const [search, setSearch] = useState("");
  const [cityFilter, setCityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<FilterKey>("all");
  const navigate = useNavigate();
  const { data: gisData, isLoading } = useGISData();
  const { t } = useLanguage();
  const config = configs[kind];
  const Icon = config.icon;

  const apiUsers = (gisData?.gisUsers ?? []) as OperationalQueueUser[];
  const usingPreviewData = authBypassEnabled && apiUsers.length === 0;
  const sourceUsers = usingPreviewData ? demoOperationalUsers : apiUsers;

  const rows = useMemo(
    () =>
      sourceUsers
        .map((user) => toRow(user, kind))
        .sort((a, b) => b.issueScore - a.issueScore || b.score - a.score),
    [kind, sourceUsers],
  );

  const cities = useMemo(() => Array.from(new Set(rows.map((row) => row.city).filter(Boolean))).sort(), [rows]);
  const metrics = metricValues(kind, rows);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();

    return rows.filter((row) => {
      if (cityFilter !== "all" && row.city !== cityFilter) return false;
      if (statusFilter !== "all" && row.status !== statusFilter) return false;
      if (!query) return true;

      return (
        row.name.toLowerCase().includes(query) ||
        row.city.toLowerCase().includes(query) ||
        t(row.reasonKey).toLowerCase().includes(query) ||
        (row.assignedTo ?? "").toLowerCase().includes(query)
      );
    });
  }, [cityFilter, rows, search, statusFilter, t]);

  const openAction = (row: FollowUpRow) => {
    if (row.action === "call") {
      navigate(`/risk-queue/${row.id}/prepare-call`);
      return;
    }

    navigate(`/users/${row.id}`);
  };

  if (isLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-10 w-72" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-28 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-[460px] rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1520px] space-y-5">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="rounded-xl bg-white p-2 shadow-sm ring-1 ring-border">
              <Icon className={cn("h-5 w-5", config.accentClass)} />
            </div>
            <h1 className="font-display text-2xl font-bold text-foreground">{t(config.titleKey)}</h1>
            {usingPreviewData && (
              <Badge className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                {t("usersList.previewData")}
              </Badge>
            )}
          </div>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{t(config.subtitleKey)}</p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-border bg-white px-3 py-2 text-xs font-semibold text-muted-foreground shadow-sm">
          <UserRound className="h-4 w-4 text-primary" />
          {filteredRows.length} {t("queue.cases")}
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {config.metricKeys.map((key, index) => (
          <MetricCard key={key} accentClass={config.accentClass} icon={<Icon className="h-5 w-5" />} label={t(key)} value={metrics[index]} />
        ))}
      </section>

      <Card className="overflow-hidden rounded-2xl border-border bg-white shadow-sm">
        <CardContent className="p-0">
          <div className="flex flex-col gap-3 border-b border-border bg-white p-4 xl:flex-row xl:items-center">
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t("followup.searchPlaceholder")}
                className="h-10 rounded-xl border-border bg-muted/45 pl-9 text-sm"
              />
            </div>
            <Select value={cityFilter} onValueChange={setCityFilter}>
              <SelectTrigger className="h-10 w-full rounded-xl border-border bg-muted/45 xl:w-52">
                <MapPin className="mr-2 h-4 w-4 text-muted-foreground" />
                <SelectValue placeholder={t("usersList.allCities")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("usersList.allCities")}</SelectItem>
                {cities.map((city) => (
                  <SelectItem key={city} value={city}>
                    {city}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2 overflow-x-auto border-b border-border bg-muted/35 px-4 py-3">
            {filterKeys.map((filter) => (
              <Button
                key={filter}
                type="button"
                size="sm"
                variant={statusFilter === filter ? "default" : "outline"}
                className="h-9 shrink-0 rounded-full px-4 text-xs font-bold"
                onClick={() => setStatusFilter(filter)}
              >
                {t(`followup.filter.${filter}`)}
              </Button>
            ))}
          </div>

          <div className="overflow-x-auto">
            <Table className="min-w-[920px]">
              <TableHeader>
                <TableRow className="bg-white hover:bg-white">
                  <TableHead>{t("followup.table.person")}</TableHead>
                  <TableHead>{t("followup.table.city")}</TableHead>
                  <TableHead>{t("followup.table.signal")}</TableHead>
                  <TableHead>{t("followup.table.channel")}</TableHead>
                  <TableHead>{t("followup.table.owner")}</TableHead>
                  <TableHead className="text-right">{t("followup.table.action")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-14 text-center text-muted-foreground">
                      {t("followup.empty")}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRows.map((row) => {
                    const ChannelIcon = channelIcon(row.channel);

                    return (
                      <TableRow
                        key={row.id}
                        className="cursor-pointer transition-colors hover:bg-muted/45"
                        onClick={() => navigate(`/users/${row.id}`)}
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                              {row.name.split(" ").map((part) => part[0]).join("").slice(0, 2)}
                            </div>
                            <div>
                              <p className="font-semibold text-foreground">{row.name}</p>
                              <Badge className={cn("mt-1 rounded-full px-2 py-0.5 text-[10px] font-bold ring-1", statusClasses(row.status))}>
                                {t(`profile.status.${row.status}`)}
                              </Badge>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{row.city || t("usersList.cityUnknown")}</TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium text-foreground">{t(row.reasonKey)}</p>
                            <p className="text-xs text-muted-foreground">
                              {t("followup.table.riskScore").replace("{score}", String(row.score))}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                            <ChannelIcon className="h-4 w-4 text-primary" />
                            {t(channelKey(row.channel))}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{row.assignedTo || t("usersList.unassigned")}</TableCell>
                        <TableCell className="text-right" onClick={(event) => event.stopPropagation()}>
                          <Button
                            type="button"
                            size="sm"
                            variant={row.action === "call" ? "default" : "outline"}
                            className="rounded-full px-4 text-xs font-bold"
                            onClick={() => openAction(row)}
                          >
                            {row.action === "call" ? <PhoneCall className="mr-2 h-4 w-4" /> : <AlertTriangle className="mr-2 h-4 w-4" />}
                            {t(row.action === "call" ? "followup.action.prepareCall" : "followup.action.reviewProfile")}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({
  accentClass,
  icon,
  label,
  value,
}: {
  accentClass: string;
  icon: ReactNode;
  label: string;
  value: number;
}) {
  return (
    <Card className={cn("rounded-2xl border-border border-t-4 bg-white shadow-sm", accentClass)}>
      <CardContent className="flex h-28 items-center justify-between gap-4 p-5">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase leading-snug tracking-[0.16em] text-muted-foreground">{label}</p>
          <p className="mt-2 text-4xl font-extrabold leading-none tracking-tight text-foreground">{value}</p>
        </div>
        <div className="rounded-xl bg-muted p-3">{icon}</div>
      </CardContent>
    </Card>
  );
}
