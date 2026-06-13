import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Clock,
  Code2,
  FileUp,
  MapPin,
  MessageCircle,
  PhoneCall,
  Plus,
  Search,
  UserRound,
  Users,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EditUserDialog } from "@/components/user/EditUserDialog";
import { UserApiIntakeDialog } from "@/components/user/UserApiIntakeDialog";
import { UserCsvImportDialog } from "@/components/user/UserCsvImportDialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAdminRole } from "@/hooks/useAdminRole";
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

type QueueRow = {
  id: string;
  name: string;
  initials: string;
  city: string;
  age?: number;
  status: OperationalStatus;
  score: number;
  reasonKey: string;
  channel: OperationalChannel;
  lastContactKey: string;
  assignedTo?: string | null;
  nextActionKey: string;
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

function toQueueRow(user: OperationalQueueUser): QueueRow {
  const score = getRiskScore(user);
  const status = deriveStatus(score, user);
  const meta = user.operationalContext;

  return {
    id: user.id,
    name: `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim() || "Unknown",
    initials: getInitials(user.first_name, user.last_name),
    city: user.city ?? "",
    age: meta?.age ?? getAge(user.date_of_birth),
    status,
    score,
    reasonKey: deriveReasonKey(user, status),
    channel: meta?.preferredChannel ?? "phone",
    lastContactKey: meta?.lastContactKey ?? "usersList.lastContactUnknown",
    assignedTo: meta?.assignedTo,
    nextActionKey:
      meta?.nextActionKey ??
      (status === "urgent" ? "usersList.nextAction.callNow" : status === "review" ? "usersList.nextAction.review" : "usersList.nextAction.monitor"),
    hasMedicationIssue: (user.missedMeds7d ?? 0) > 0 || meta?.reasonKey === "usersList.reason.medication",
    hasCheckinIssue: !(user.checkinEnabled ?? false),
    hasNoResponse: Boolean(meta?.noResponse),
    isUnassigned: meta?.assignedTo === null || meta?.assignedTo === undefined,
    livingContextKey: meta?.livingContextKey,
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

export default function UsersList() {
  const [search, setSearch] = useState("");
  const [cityFilter, setCityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<FilterKey>("all");
  const [addUserOpen, setAddUserOpen] = useState(false);
  const [csvImportOpen, setCsvImportOpen] = useState(false);
  const [apiIntakeOpen, setApiIntakeOpen] = useState(false);
  const navigate = useNavigate();
  const { data: gisData, isLoading } = useGISData();
  const { isAdmin } = useAdminRole();
  const { t } = useLanguage();

  const apiUsers = (gisData?.gisUsers ?? []) as OperationalQueueUser[];
  const usingPreviewData = authBypassEnabled && apiUsers.length === 0;
  const sourceUsers = usingPreviewData ? demoOperationalUsers : apiUsers;

  const queueRows = useMemo(() => sourceUsers.map(toQueueRow), [sourceUsers]);

  const cities = useMemo(() => {
    const uniqueCities = new Set(queueRows.map((user) => user.city).filter(Boolean));
    return Array.from(uniqueCities).sort();
  }, [queueRows]);

  const filteredRows = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return queueRows
      .filter((user) => {
        if (cityFilter !== "all" && user.city !== cityFilter) return false;
        if (statusFilter === "urgent" && user.status !== "urgent") return false;
        if (statusFilter === "review" && user.status !== "review") return false;
        if (statusFilter === "no-response" && !user.hasNoResponse) return false;
        if (statusFilter === "medication" && !user.hasMedicationIssue) return false;
        if (statusFilter === "checkins" && !user.hasCheckinIssue) return false;
        if (statusFilter === "unassigned" && !user.isUnassigned) return false;

        if (!normalizedSearch) return true;

        return (
          user.name.toLowerCase().includes(normalizedSearch) ||
          user.city.toLowerCase().includes(normalizedSearch) ||
          t(user.reasonKey).toLowerCase().includes(normalizedSearch) ||
          (user.assignedTo ?? "").toLowerCase().includes(normalizedSearch)
        );
      })
      .sort((a, b) => b.score - a.score);
  }, [cityFilter, queueRows, search, statusFilter, t]);

  const activePeople = queueRows.length;
  const urgentCases = queueRows.filter((user) => user.status === "urgent").length;
  const reviewCases = queueRows.filter((user) => user.status === "review").length;
  const checkinEnabled = sourceUsers.filter((user) => user.checkinEnabled).length;
  const canManageUsers = isAdmin && !authBypassEnabled;

  if (isLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-10 w-56" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-28 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-[420px] rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-2xl font-bold text-foreground">{t("usersList.title")}</h1>
            {usingPreviewData && (
              <Badge className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                {t("usersList.previewData")}
              </Badge>
            )}
          </div>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t("usersList.operationalSubtitle")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canManageUsers && (
            <>
              <Button type="button" className="h-10 rounded-full px-4 text-sm font-semibold" onClick={() => setAddUserOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                {t("usersList.addOneByOne")}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-10 rounded-full border-border bg-white px-4 text-sm font-semibold text-foreground"
                onClick={() => setCsvImportOpen(true)}
              >
                <FileUp className="mr-2 h-4 w-4" />
                {t("usersList.uploadCsv")}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-10 rounded-full border-border bg-white px-4 text-sm font-semibold text-foreground"
                onClick={() => setApiIntakeOpen(true)}
              >
                <Code2 className="mr-2 h-4 w-4" />
                {t("usersList.apiIntake")}
              </Button>
            </>
          )}
          <div className="flex items-center gap-2 rounded-full border border-border bg-white px-3 py-2 text-xs font-semibold text-muted-foreground shadow-sm">
            <Users className="h-4 w-4 text-primary" />
            {filteredRows.length} {t("usersList.peopleShown")}
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard accent="border-t-primary" icon={Users} label={t("usersList.activePeople")} value={activePeople} />
        <MetricCard accent="border-t-red-500" icon={AlertTriangle} label={t("usersList.urgentCases")} value={urgentCases} />
        <MetricCard accent="border-t-orange-500" icon={Clock} label={t("usersList.operatorReview")} value={reviewCases} />
        <MetricCard accent="border-t-emerald-500" icon={CheckCircle2} label={t("usersList.checkinsReady")} value={`${checkinEnabled}/${activePeople}`} />
      </div>

      <Card className="overflow-hidden rounded-2xl border-border bg-white shadow-sm">
        <CardContent className="p-0">
          <div className="flex flex-col gap-3 border-b border-border bg-white p-4 xl:flex-row xl:items-center">
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t("usersList.searchPlaceholder")}
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
              <UserRound className="mx-auto mb-3 h-10 w-10 text-muted-foreground/60" />
              <p className="text-base font-semibold text-foreground">
                {queueRows.length === 0 ? t("usersList.noUsersYet") : t("usersList.noUsersMatch")}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {queueRows.length === 0 ? t("usersList.dataWillAppear") : t("usersList.adjustFilters")}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="min-w-[260px] text-xs font-bold uppercase tracking-[0.12em]">
                    {t("usersList.person")}
                  </TableHead>
                  <TableHead className="min-w-[150px] text-xs font-bold uppercase tracking-[0.12em]">
                    {t("usersList.risk")}
                  </TableHead>
                  <TableHead className="min-w-[270px] text-xs font-bold uppercase tracking-[0.12em]">
                    {t("usersList.reason")}
                  </TableHead>
                  <TableHead className="min-w-[140px] text-xs font-bold uppercase tracking-[0.12em]">
                    {t("usersList.channel")}
                  </TableHead>
                  <TableHead className="min-w-[150px] text-xs font-bold uppercase tracking-[0.12em]">
                    {t("usersList.lastContact")}
                  </TableHead>
                  <TableHead className="min-w-[170px] text-xs font-bold uppercase tracking-[0.12em]">
                    {t("usersList.assignedOperator")}
                  </TableHead>
                  <TableHead className="min-w-[160px] text-right text-xs font-bold uppercase tracking-[0.12em]">
                    {t("usersList.nextAction")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRows.map((user) => {
                  const ChannelIcon = channelIcon(user.channel);
                  return (
                    <TableRow
                      key={user.id}
                      className="cursor-pointer bg-white hover:bg-primary/5"
                      onClick={() => navigate(`/users/${user.id}`)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">
                            {user.initials}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-foreground">{user.name}</p>
                            <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                              {user.age ? <span>{user.age} {t("profile.yearsShort")}</span> : null}
                              {user.age && user.city ? <span>·</span> : null}
                              {user.city ? <span>{user.city}</span> : null}
                              {user.livingContextKey ? (
                                <>
                                  <span>·</span>
                                  <span>{t(user.livingContextKey)}</span>
                                </>
                              ) : null}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className={cn("rounded-full px-2.5 py-1 text-xs font-bold ring-1", statusClasses(user.status))}>
                            {t(`usersList.status.${user.status}`)}
                          </span>
                          <span className="text-xs font-semibold text-muted-foreground">{user.score}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="max-w-md text-sm font-medium text-foreground">{t(user.reasonKey)}</p>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <ChannelIcon className="h-4 w-4 text-primary" />
                          {t(channelKey(user.channel))}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{t(user.lastContactKey)}</TableCell>
                      <TableCell>
                        {user.assignedTo ? (
                          <span className="text-sm font-semibold text-foreground">{user.assignedTo}</span>
                        ) : (
                          <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                            {t("usersList.unassigned")}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          size="sm"
                          className="h-9 rounded-full px-3 text-xs font-semibold"
                          onClick={(event) => {
                            event.stopPropagation();
                            navigate(`/users/${user.id}`);
                          }}
                        >
                          {t(user.nextActionKey)}
                          <ChevronRight className="ml-1 h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {addUserOpen && (
        <EditUserDialog
          open={addUserOpen}
          onOpenChange={setAddUserOpen}
          user={null}
          onSaved={(savedUser) => navigate(`/users/${savedUser.id}`)}
        />
      )}
      {csvImportOpen && <UserCsvImportDialog open={csvImportOpen} onOpenChange={setCsvImportOpen} />}
      {apiIntakeOpen && <UserApiIntakeDialog open={apiIntakeOpen} onOpenChange={setApiIntakeOpen} />}
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
  icon: typeof Users;
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
