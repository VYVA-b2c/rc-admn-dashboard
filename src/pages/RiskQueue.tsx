import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Clock,
  MapPin,
  MessageCircle,
  PhoneCall,
  Search,
  ShieldAlert,
  UserRound,
  Users,
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
import { toast } from "@/hooks/use-toast";
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

type FilterKey = "all" | "urgent" | "review" | "no-response" | "medication" | "checkins" | "unassigned";
type QueueAction = "call" | "review" | "assign" | "monitor";

type RiskQueueRow = {
  id: string;
  name: string;
  initials: string;
  city: string;
  age?: number;
  score: number;
  status: OperationalStatus;
  reasonKey: string;
  channel: OperationalChannel;
  lastContactKey: string;
  assignedTo?: string | null;
  action: QueueAction;
  hasMedicationIssue: boolean;
  hasCheckinIssue: boolean;
  hasNoResponse: boolean;
  isUnassigned: boolean;
  livingContextKey?: string;
};

const filterKeys: FilterKey[] = ["all", "urgent", "review", "no-response", "medication", "checkins", "unassigned"];

function getAge(dateOfBirth?: string | null) {
  if (!dateOfBirth) return undefined;
  const birth = new Date(dateOfBirth);
  if (Number.isNaN(birth.getTime())) return undefined;
  return Math.floor((Date.now() - birth.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
}

function getInitials(firstName?: string | null, lastName?: string | null) {
  return `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase() || "VP";
}

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

function deriveStatus(score: number, user: OperationalQueueUser): OperationalStatus {
  if (user.operationalContext?.riskStatus) return user.operationalContext.riskStatus;
  if ((user.criticalAlerts ?? 0) > 0 || score >= 80) return "urgent";
  if ((user.activeAlerts ?? 0) > 0 || (user.missedMeds7d ?? 0) > 0 || !(user.checkinEnabled ?? false)) return "review";
  return "stable";
}

function deriveReasonKey(user: OperationalQueueUser, status: OperationalStatus) {
  if (user.operationalContext?.reasonKey) return user.operationalContext.reasonKey;
  if ((user.missedMeds7d ?? 0) > 0) return "usersList.reason.medication";
  if (!(user.checkinEnabled ?? false)) return "usersList.reason.checkins";
  if ((user.activeAlerts ?? 0) > 0) return status === "urgent" ? "queue.reason.default" : "usersList.reason.review";
  return "usersList.reason.stable";
}

function deriveAction(row: Pick<RiskQueueRow, "status" | "hasNoResponse" | "isUnassigned">): QueueAction {
  if (row.status === "urgent" || row.hasNoResponse) return "call";
  if (row.isUnassigned) return "assign";
  if (row.status === "stable") return "monitor";
  return "review";
}

function toRiskQueueRow(user: OperationalQueueUser): RiskQueueRow {
  const score = getRiskScore(user);
  const status = deriveStatus(score, user);
  const meta = user.operationalContext;
  const baseRow = {
    id: user.id,
    name: `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim() || "Unknown",
    initials: getInitials(user.first_name, user.last_name),
    city: user.city ?? "",
    age: meta?.age ?? getAge(user.date_of_birth),
    score,
    status,
    reasonKey: deriveReasonKey(user, status),
    channel: meta?.preferredChannel ?? "phone",
    lastContactKey: meta?.lastContactKey ?? "usersList.lastContactUnknown",
    assignedTo: meta?.assignedTo,
    hasMedicationIssue: (user.missedMeds7d ?? 0) > 0 || meta?.reasonKey === "usersList.reason.medication",
    hasCheckinIssue: !(user.checkinEnabled ?? false),
    hasNoResponse: Boolean(meta?.noResponse),
    isUnassigned: meta?.assignedTo === null || meta?.assignedTo === undefined,
    livingContextKey: meta?.livingContextKey,
  };

  return {
    ...baseRow,
    action: deriveAction(baseRow),
  };
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

function actionClasses(action: QueueAction) {
  if (action === "call") return "bg-primary text-white hover:bg-primary/90";
  if (action === "assign") return "border-primary/20 bg-primary/5 text-primary hover:bg-primary/10 hover:text-primary";
  return "border-border bg-white text-muted-foreground hover:bg-primary/10 hover:text-primary";
}

function actionLabelKey(action: QueueAction) {
  if (action === "call") return "riskQueue.action.prepareCall";
  if (action === "assign") return "queue.action.assign";
  if (action === "monitor") return "usersList.nextAction.monitor";
  return "queue.action.review";
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

export default function RiskQueue() {
  const [search, setSearch] = useState("");
  const [cityFilter, setCityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<FilterKey>("all");
  const navigate = useNavigate();
  const { data: gisData, isLoading } = useGISData();
  const { t } = useLanguage();

  const apiUsers = (gisData?.gisUsers ?? []) as OperationalQueueUser[];
  const usingPreviewData = authBypassEnabled && apiUsers.length === 0;
  const sourceUsers = usingPreviewData ? demoOperationalUsers : apiUsers;

  const queueRows = useMemo(
    () =>
      sourceUsers
        .map(toRiskQueueRow)
        .filter((row) => row.status !== "stable" || row.hasNoResponse || row.hasMedicationIssue || row.hasCheckinIssue || row.isUnassigned)
        .sort((a, b) => {
          const statusDelta = (a.status === "urgent" ? 0 : a.status === "review" ? 1 : 2) - (b.status === "urgent" ? 0 : b.status === "review" ? 1 : 2);
          return statusDelta || b.score - a.score;
        }),
    [sourceUsers],
  );

  const cities = useMemo(() => {
    const uniqueCities = new Set(queueRows.map((row) => row.city).filter(Boolean));
    return Array.from(uniqueCities).sort();
  }, [queueRows]);

  const filteredRows = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return queueRows.filter((row) => {
      if (cityFilter !== "all" && row.city !== cityFilter) return false;
      if (statusFilter === "urgent" && row.status !== "urgent") return false;
      if (statusFilter === "review" && row.status !== "review") return false;
      if (statusFilter === "no-response" && !row.hasNoResponse) return false;
      if (statusFilter === "medication" && !row.hasMedicationIssue) return false;
      if (statusFilter === "checkins" && !row.hasCheckinIssue) return false;
      if (statusFilter === "unassigned" && !row.isUnassigned) return false;

      if (!normalizedSearch) return true;

      return (
        row.name.toLowerCase().includes(normalizedSearch) ||
        row.city.toLowerCase().includes(normalizedSearch) ||
        t(row.reasonKey).toLowerCase().includes(normalizedSearch) ||
        (row.assignedTo ?? "").toLowerCase().includes(normalizedSearch)
      );
    });
  }, [cityFilter, queueRows, search, statusFilter, t]);

  const urgentCount = queueRows.filter((row) => row.status === "urgent").length;
  const reviewCount = queueRows.filter((row) => row.status === "review").length;
  const noResponseCount = queueRows.filter((row) => row.hasNoResponse).length;
  const unassignedCount = queueRows.filter((row) => row.isUnassigned).length;
  const medicationCount = queueRows.filter((row) => row.hasMedicationIssue).length;

  const openPrimaryAction = (row: RiskQueueRow) => {
    if (row.action === "call") {
      navigate(`/risk-queue/${row.id}/prepare-call`);
      return;
    }

    if (row.action === "assign") {
      toast({
        title: t("riskQueue.action.assignReady"),
        description: t("riskQueue.action.assignLocal"),
      });
      return;
    }

    navigate(`/users/${row.id}`);
  };

  if (isLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-10 w-72" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-28 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-[480px] rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1520px] space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-2xl font-bold text-foreground">{t("riskQueue.title")}</h1>
            {usingPreviewData && (
              <Badge className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                {t("usersList.previewData")}
              </Badge>
            )}
          </div>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{t("riskQueue.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-border bg-white px-3 py-2 text-xs font-semibold text-muted-foreground shadow-sm">
          <ShieldAlert className="h-4 w-4 text-primary" />
          {filteredRows.length} {t("queue.cases")}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard accent="border-t-red-500" icon={AlertTriangle} label={t("riskQueue.metric.urgent")} value={urgentCount} />
        <MetricCard accent="border-t-orange-500" icon={Clock} label={t("riskQueue.metric.review")} value={reviewCount} />
        <MetricCard accent="border-t-primary" icon={PhoneCall} label={t("riskQueue.metric.noResponse")} value={noResponseCount} />
        <MetricCard accent="border-t-amber-500" icon={MessageCircle} label={t("riskQueue.metric.medication")} value={medicationCount} />
        <MetricCard accent="border-t-slate-300" icon={UserRound} label={t("riskQueue.metric.unassigned")} value={unassignedCount} />
      </div>

      <Card className="overflow-hidden rounded-2xl border-border bg-white shadow-sm">
        <CardContent className="p-0">
          <div className="flex flex-col gap-3 border-b border-border bg-white p-4 xl:flex-row xl:items-center">
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t("riskQueue.searchPlaceholder")}
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
                variant={statusFilter === filter ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter(filter)}
                className={cn(
                  "h-9 shrink-0 rounded-full px-4 text-xs font-semibold",
                  statusFilter !== filter && "border-border bg-white text-muted-foreground hover:bg-primary/10 hover:text-primary",
                )}
              >
                {t(`usersList.filter.${filter}`)}
              </Button>
            ))}
          </div>

          {filteredRows.length === 0 ? (
            <div className="px-4 py-16 text-center">
              <ShieldAlert className="mx-auto mb-3 h-10 w-10 text-muted-foreground/60" />
              <p className="text-base font-semibold text-foreground">
                {queueRows.length === 0 ? t("riskQueue.noCasesYet") : t("riskQueue.noCasesMatch")}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {queueRows.length === 0 ? t("riskQueue.dataWillAppear") : t("usersList.adjustFilters")}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="min-w-[260px] text-xs font-bold uppercase tracking-[0.12em]">
                      {t("queue.person")}
                    </TableHead>
                    <TableHead className="hidden min-w-[150px] text-xs font-bold uppercase tracking-[0.12em] 2xl:table-cell">
                      {t("queue.status")}
                    </TableHead>
                    <TableHead className="min-w-[300px] text-xs font-bold uppercase tracking-[0.12em]">
                      {t("queue.reason")}
                    </TableHead>
                    <TableHead className="min-w-[140px] text-xs font-bold uppercase tracking-[0.12em]">
                      {t("queue.channel")}
                    </TableHead>
                    <TableHead className="hidden min-w-[150px] text-xs font-bold uppercase tracking-[0.12em] 2xl:table-cell">
                      {t("queue.lastContact")}
                    </TableHead>
                    <TableHead className="hidden min-w-[170px] text-xs font-bold uppercase tracking-[0.12em] 2xl:table-cell">
                      {t("queue.assignedTo")}
                    </TableHead>
                    <TableHead className="sticky right-0 z-10 min-w-[210px] bg-muted/40 text-right text-xs font-bold uppercase tracking-[0.12em] shadow-[-12px_0_18px_-18px_rgba(15,23,42,0.45)]">
                      {t("queue.action")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRows.map((row) => {
                    const ChannelIcon = channelIcon(row.channel);
                    const assignedLabel = row.assignedTo ?? t("usersList.unassigned");
                    const lastContactLabel = t(row.lastContactKey);
                    return (
                      <TableRow
                        key={row.id}
                        className="cursor-pointer bg-white hover:bg-primary/5"
                        onClick={() => navigate(`/users/${row.id}`)}
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">
                              {row.initials}
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-foreground">{row.name}</p>
                              <div className="mt-1 flex items-center gap-2 2xl:hidden">
                                <span className={cn("rounded-full px-2.5 py-1 text-xs font-bold ring-1", statusClasses(row.status))}>
                                  {t(`usersList.status.${row.status}`)}
                                </span>
                                <span className="text-xs font-semibold text-muted-foreground">{row.score}</span>
                              </div>
                              <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                                {row.age ? <span>{row.age} {t("profile.yearsShort")}</span> : null}
                                {row.age && row.city ? <span>·</span> : null}
                                {row.city ? <span>{row.city}</span> : null}
                                {row.livingContextKey ? (
                                  <>
                                    <span>·</span>
                                    <span>{t(row.livingContextKey)}</span>
                                  </>
                                ) : null}
                                <span className="hidden sm:inline 2xl:hidden">·</span>
                                <span className="hidden sm:inline 2xl:hidden">
                                  {lastContactLabel}
                                </span>
                                <span className="hidden sm:inline 2xl:hidden">·</span>
                                <span className="hidden sm:inline 2xl:hidden">
                                  {t("queue.assignedTo")}: {assignedLabel}
                                </span>
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden 2xl:table-cell">
                          <div className="flex items-center gap-2">
                            <span className={cn("rounded-full px-2.5 py-1 text-xs font-bold ring-1", statusClasses(row.status))}>
                              {t(`usersList.status.${row.status}`)}
                            </span>
                            <span className="text-xs font-semibold text-muted-foreground">{row.score}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <p className="max-w-md text-sm font-medium text-foreground">{t(row.reasonKey)}</p>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <ChannelIcon className="h-4 w-4 text-primary" />
                            {t(channelKey(row.channel))}
                          </div>
                        </TableCell>
                        <TableCell className="hidden text-sm text-muted-foreground 2xl:table-cell">{lastContactLabel}</TableCell>
                        <TableCell className="hidden 2xl:table-cell">
                          {row.assignedTo ? (
                            <span className="text-sm font-semibold text-foreground">{row.assignedTo}</span>
                          ) : (
                            <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                              {t("usersList.unassigned")}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="sticky right-0 z-10 bg-white text-right shadow-[-12px_0_18px_-18px_rgba(15,23,42,0.45)]">
                          <div className="flex justify-end gap-2">
                            <Button
                              type="button"
                              variant={row.action === "call" ? "default" : "outline"}
                              size="sm"
                              className={cn("h-9 rounded-full px-3 text-xs font-semibold", actionClasses(row.action))}
                              onClick={(event) => {
                                event.stopPropagation();
                                openPrimaryAction(row);
                              }}
                            >
                              {t(actionLabelKey(row.action))}
                              <ChevronRight className="ml-1 h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-9 rounded-full border-border bg-white px-3 text-xs font-semibold text-muted-foreground hover:bg-primary/10 hover:text-primary"
                              onClick={(event) => {
                                event.stopPropagation();
                                navigate(`/users/${row.id}`);
                              }}
                            >
                              {t("riskQueue.action.profile")}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({
  accent,
  icon: Icon,
  label,
  value,
}: {
  accent: string;
  icon: LucideIcon;
  label: string;
  value: number | string;
}) {
  return (
    <Card className={cn("rounded-2xl border-border bg-white shadow-sm", "border-t-4", accent)}>
      <CardContent className="flex h-28 items-center justify-between p-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-foreground">{value}</p>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}
