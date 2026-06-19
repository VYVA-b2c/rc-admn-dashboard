import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BrainCircuit,
  CheckCircle2,
  Clock3,
  HelpCircle,
  LineChart,
  Loader2,
  Pill,
  ShieldAlert,
  UserRoundCheck,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "@/hooks/use-toast";
import { useActiveOrganizationId } from "@/hooks/useActiveOrganizationId";
import { useGISData, type GISFieldStaff, type GISUser } from "@/hooks/useGISData";
import { apiFetch } from "@/lib/apiClient";
import { authBypassEnabled } from "@/lib/authMode";
import { deriveRiskQueueRows, type RiskQueueRow } from "@/lib/riskQueue";
import { cn } from "@/lib/utils";

type Kpis = {
  predictedEscalations7d: number;
  clientsTrendingUp: number;
  adherenceRiskFlags: number;
  operatorsOverCapacity: number;
};

type HorizonRow = {
  date: string;
  urgent: number;
  review: number;
  medication: number;
  noResponse: number;
  hoursNeeded: number;
  hoursAvailable: number;
};

type InsightFactor = {
  signal?: string | null;
  label: string;
  severity: "low" | "moderate" | "high";
};

type InsightClient = {
  id: string;
  name: string;
  age?: number | null;
  zone?: string | null;
  operator?: string | null;
  score: number;
  delta: number;
  band: "low" | "moderate" | "high";
  history: number[];
  forecast: { mid: number[]; low: number[]; high: number[] };
  factors: InsightFactor[];
  window: string;
};

type OperatorCapacity = {
  id: string;
  name: string;
  current: number;
  capacity: number;
  recommended: number;
};

type Suggestion = {
  id: string;
  from: string;
  to: string;
  clientCount: number;
  reason: string;
  status: "pending" | "applied" | "dismissed";
};

type InsightsPayload = {
  kpis: Kpis;
  horizon: HorizonRow[];
  clients: InsightClient[];
  operators: OperatorCapacity[];
  suggestions: Suggestion[];
  isPreview: boolean;
  source: "predicted" | "operational" | "preview";
};

const horizonOptions = [7, 14, 30] as const;
const filterOptions = [
  { value: "all", label: "All" },
  { value: "high", label: "High" },
  { value: "mood", label: "Mood" },
  { value: "medication", label: "Medication" },
  { value: "noresponse", label: "No response" },
  { value: "unassigned", label: "Unassigned" },
] as const;

function HelpButton({ title, body }: { title: string; body: string }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          title={title}
          aria-label={title}
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-white text-muted-foreground shadow-sm transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <HelpCircle className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 rounded-xl border-border p-4">
        <p className="text-sm font-bold text-foreground">{title}</p>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{body}</p>
      </PopoverContent>
    </Popover>
  );
}

const demoClients: InsightClient[] = [
  {
    id: "demo-carmen-lopez",
    name: "Carmen Lopez",
    age: 84,
    zone: "Madrid",
    operator: "Ana Novak",
    score: 82,
    delta: 6,
    band: "high",
    history: [64, 66, 67, 68, 72, 70, 74, 76, 78, 77, 79, 81, 80, 82],
    forecast: {
      mid: [84, 85, 86, 87, 88, 88, 89, 89, 90, 90, 90, 91, 91, 91],
      low: [77, 77, 76, 76, 75, 74, 74, 73, 72, 72, 71, 70, 70, 69],
      high: [91, 93, 96, 98, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100],
    },
    factors: [
      { signal: "response", label: "2 missed calls", severity: "high" },
      { signal: "medication", label: "Meds 58%", severity: "high" },
      { signal: "mood", label: "Mood declining", severity: "moderate" },
    ],
    window: "Escalation likely if unreached this week",
  },
  {
    id: "demo-hans-mueller",
    name: "Hans Mueller",
    age: 86,
    zone: "Dresden",
    operator: "Mila Weber",
    score: 59,
    delta: 4,
    band: "moderate",
    history: [42, 44, 45, 48, 49, 50, 52, 54, 53, 55, 56, 57, 58, 59],
    forecast: {
      mid: [61, 62, 63, 65, 66, 67, 68, 69, 70, 70, 71, 72, 72, 73],
      low: [55, 55, 54, 54, 53, 52, 52, 51, 51, 50, 49, 49, 48, 48],
      high: [67, 69, 72, 75, 78, 80, 83, 86, 88, 90, 93, 95, 96, 98],
    },
    factors: [
      { signal: "response", label: "No response", severity: "moderate" },
      { signal: "checkin", label: "Check-in overdue", severity: "moderate" },
    ],
    window: "Risk likely to peak in 4-6 days",
  },
  {
    id: "demo-elena-garcia",
    name: "Elena Garcia",
    age: 77,
    zone: "Madrid",
    operator: null,
    score: 45,
    delta: 2,
    band: "moderate",
    history: [36, 37, 38, 39, 39, 40, 41, 42, 42, 43, 44, 43, 44, 45],
    forecast: {
      mid: [46, 47, 48, 49, 50, 51, 52, 52, 53, 54, 55, 55, 56, 56],
      low: [39, 39, 39, 38, 38, 37, 37, 36, 36, 35, 35, 34, 34, 33],
      high: [53, 55, 57, 60, 62, 65, 67, 69, 71, 73, 75, 77, 78, 80],
    },
    factors: [
      { signal: "assignment", label: "Unassigned operator", severity: "high" },
      { signal: "medication", label: "Meds 74%", severity: "moderate" },
    ],
    window: "Needs an assigned operator before risk peaks",
  },
];

const demoOperators: OperatorCapacity[] = [
  { id: "demo-ana", name: "Ana Novak", current: 11, capacity: 32, recommended: 8 },
  { id: "demo-mila", name: "Mila Weber", current: 6, capacity: 32, recommended: 8 },
  { id: "demo-joel", name: "Joel Martin", current: 4, capacity: 28, recommended: 7 },
];

const demoSuggestions: Suggestion[] = [
  {
    id: "demo-suggestion-1",
    from: "Unassigned",
    to: "Joel Martin",
    clientCount: 1,
    reason: "Elena Garcia's risk score is rising with no assigned operator - Joel Martin has the most available hours.",
    status: "pending",
  },
  {
    id: "demo-suggestion-2",
    from: "Ana Novak",
    to: "Mila Weber",
    clientCount: 2,
    reason: "Ana Novak is over capacity (11/8 cases). Mila Weber has 8h of headroom this week.",
    status: "pending",
  },
];

function demoHorizon(days: number): HorizonRow[] {
  return Array.from({ length: days }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() + index + 1);
    return {
      date: date.toISOString().slice(0, 10),
      urgent: index < 4 ? 2 + (index % 2) : 3 + (index % 3 === 0 ? 1 : 0),
      review: 6 + Math.round(index / 3),
      medication: 3 + (index % 3),
      noResponse: 2 + (index % 2),
      hoursNeeded: 18 + index * 0.9,
      hoursAvailable: 21,
    };
  });
}

function filterDemoClients(filter: string) {
  if (filter === "all") return demoClients;
  if (filter === "high") return demoClients.filter((client) => client.band === "high");
  if (filter === "unassigned") return demoClients.filter((client) => !client.operator);
  return demoClients.filter((client) =>
    client.factors.some((factor) => `${factor.signal || ""} ${factor.label}`.toLowerCase().includes(filter)),
  );
}

function previewPayload(days: number, filter: string): InsightsPayload {
  return {
    kpis: {
      predictedEscalations7d: 6,
      clientsTrendingUp: 18,
      adherenceRiskFlags: 9,
      operatorsOverCapacity: 1,
    },
    horizon: demoHorizon(days),
    clients: filterDemoClients(filter),
    operators: demoOperators,
    suggestions: demoSuggestions,
    isPreview: true,
    source: "preview",
  };
}

function fallbackBand(score: number): InsightClient["band"] {
  if (score >= 67) return "high";
  if (score >= 38) return "moderate";
  return "low";
}

function fallbackHistory(score: number) {
  return Array.from({ length: 14 }, (_, index) => {
    const drift = (index - 13) * 0.7;
    return Math.max(0, Math.min(100, Math.round(score + drift)));
  });
}

function fallbackForecast(score: number, row: RiskQueueRow, days: number) {
  const trend = row.status === "urgent" || row.hasNoResponse ? 0.8 : row.hasMedicationIssue || row.hasCheckinIssue ? 0.35 : 0;
  const mid = Array.from({ length: days }, (_, index) => Math.max(0, Math.min(100, Math.round(score + (index + 1) * trend))));
  return {
    mid,
    low: mid.map((value) => Math.max(0, value - 7)),
    high: mid.map((value) => Math.min(100, value + 7)),
  };
}

function fallbackFactors(row: RiskQueueRow): InsightFactor[] {
  const factors: InsightFactor[] = [];
  if (row.status === "urgent") factors.push({ signal: "risk", label: "Urgent risk", severity: "high" });
  if (row.hasNoResponse) factors.push({ signal: "response", label: "No response", severity: "high" });
  if (row.hasMedicationIssue) factors.push({ signal: "medication", label: "Medication follow-up", severity: "high" });
  if (row.hasCheckinIssue) factors.push({ signal: "checkin", label: "Check-in inactive", severity: "moderate" });
  if (row.isUnassigned) factors.push({ signal: "assignment", label: "Unassigned", severity: "high" });
  if (!factors.length) factors.push({ signal: "review", label: "Operator review", severity: "moderate" });
  return factors;
}

function fallbackWindow(row: RiskQueueRow) {
  if (row.status === "urgent" || row.hasNoResponse) return "Immediate operator review recommended from live risk signals.";
  if (row.isUnassigned) return "Assign a care provider before the next follow-up.";
  if (row.hasMedicationIssue) return "Medication confirmation should be checked during the next outreach.";
  if (row.hasCheckinIssue) return "Scheduled check-in setup needs review.";
  return "Continue routine monitoring.";
}

function fallbackClientMatchesFilter(client: InsightClient, filter: string) {
  if (filter === "all") return true;
  if (filter === "high") return client.band === "high";
  if (filter === "unassigned") return !client.operator;
  if (filter === "noresponse") return client.factors.some((factor) => factor.signal === "response");
  return client.factors.some((factor) => `${factor.signal || ""} ${factor.label}`.toLowerCase().includes(filter));
}

function fallbackHorizon(rows: RiskQueueRow[], fieldStaff: GISFieldStaff[], days: number): HorizonRow[] {
  if (!rows.length) return [];
  const urgent = rows.filter((row) => row.status === "urgent").length;
  const review = rows.filter((row) => row.status !== "urgent").length;
  const medication = rows.filter((row) => row.hasMedicationIssue).length;
  const noResponse = rows.filter((row) => row.hasNoResponse).length;
  const availableHours = fieldStaff.reduce((sum, staff) => sum + Number(staff.capacity || 0), 0) || 21;
  const baseHoursNeeded = urgent * 1.5 + review * 0.75 + medication * 0.5 + noResponse * 0.5;

  return Array.from({ length: days }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() + index + 1);
    const pressureBump = index >= 7 ? Math.floor(index / 7) : 0;
    return {
      date: date.toISOString().slice(0, 10),
      urgent: urgent + (pressureBump && urgent > 0 ? 1 : 0),
      review: review + pressureBump,
      medication,
      noResponse,
      hoursNeeded: Number((baseHoursNeeded + pressureBump * 0.75).toFixed(1)),
      hoursAvailable: availableHours,
    };
  });
}

function fallbackOperators(rows: RiskQueueRow[], fieldStaff: GISFieldStaff[]): OperatorCapacity[] {
  if (fieldStaff.length) {
    return fieldStaff.map((staff) => {
      const capacity = Number(staff.capacity || 0) || 32;
      return {
        id: staff.id,
        name: staff.full_name,
        current: Number(staff.open_cases || 0),
        capacity,
        recommended: Math.max(1, Math.round(capacity / 3)),
      };
    });
  }

  const assignedCounts = new Map<string, number>();
  rows.forEach((row) => {
    if (!row.assignedTo) return;
    assignedCounts.set(row.assignedTo, (assignedCounts.get(row.assignedTo) || 0) + 1);
  });
  return Array.from(assignedCounts.entries()).map(([name, current], index) => ({
    id: `fallback-operator-${index}`,
    name,
    current,
    capacity: 32,
    recommended: 8,
  }));
}

function operationalFallbackPayload(users: GISUser[], fieldStaff: GISFieldStaff[], days: number, filter: string): InsightsPayload {
  const rows = deriveRiskQueueRows(users);
  const clients = rows
    .map((row) => ({
      id: row.id,
      name: row.name,
      age: row.age ?? null,
      zone: row.city || null,
      operator: row.assignedTo || null,
      score: row.score,
      delta: row.status === "urgent" ? 3 : row.hasMedicationIssue || row.hasCheckinIssue ? 1 : 0,
      band: fallbackBand(row.score),
      history: fallbackHistory(row.score),
      forecast: fallbackForecast(row.score, row, days),
      factors: fallbackFactors(row),
      window: fallbackWindow(row),
    }))
    .filter((client) => fallbackClientMatchesFilter(client, filter));

  return {
    kpis: {
      predictedEscalations7d: rows.filter((row) => row.status === "urgent" || row.score >= 67).length,
      clientsTrendingUp: rows.filter((row) => row.score >= 38).length,
      adherenceRiskFlags: rows.filter((row) => row.hasMedicationIssue).length,
      operatorsOverCapacity: fallbackOperators(rows, fieldStaff).filter((operator) => operator.current > Math.max(1, operator.recommended)).length,
    },
    horizon: fallbackHorizon(rows, fieldStaff, days),
    clients,
    operators: fallbackOperators(rows, fieldStaff),
    suggestions: [],
    isPreview: false,
    source: "operational",
  };
}

async function fetchInsights(days: number, filter: string): Promise<InsightsPayload> {
  try {
    const [kpis, horizon, clients, operators, suggestions] = await Promise.all([
      apiFetch<Kpis>("/api/insights/kpis"),
      apiFetch<HorizonRow[]>(`/api/insights/horizon?days=${days}`),
      apiFetch<InsightClient[]>(`/api/insights/clients?filter=${filter}&days=${days}`),
      apiFetch<OperatorCapacity[]>("/api/insights/operators"),
      apiFetch<Suggestion[]>("/api/insights/suggestions?status=pending"),
    ]);
    const hasData = horizon.length > 0 || clients.length > 0 || operators.length > 0 || suggestions.length > 0;
    if (!hasData && authBypassEnabled) return previewPayload(days, filter);
    return { kpis, horizon, clients, operators, suggestions, isPreview: false, source: "predicted" };
  } catch (error) {
    if (authBypassEnabled) return previewPayload(days, filter);
    throw error;
  }
}

function bandClasses(band: InsightClient["band"]) {
  if (band === "high") return "bg-red-50 text-red-700 ring-red-200";
  if (band === "moderate") return "bg-orange-50 text-orange-700 ring-orange-200";
  return "bg-emerald-50 text-emerald-700 ring-emerald-200";
}

function factorClasses(severity: InsightFactor["severity"]) {
  if (severity === "high") return "bg-red-50 text-red-700 ring-red-200";
  if (severity === "moderate") return "bg-amber-50 text-amber-700 ring-amber-200";
  return "bg-slate-50 text-slate-600 ring-slate-200";
}

function shortDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date);
}

function linePath(points: Array<[number, number]>) {
  return points.map(([x, y], index) => `${index === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
}

function polygonPath(high: Array<[number, number]>, low: Array<[number, number]>) {
  return [...high, ...low.slice().reverse()]
    .map(([x, y], index) => `${index === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`)
    .join(" ") + " Z";
}

function RiskTrajectory({ client }: { client: InsightClient }) {
  const history = client.history.length ? client.history : [client.score];
  const mid = client.forecast.mid.length ? client.forecast.mid : [client.score];
  const low = client.forecast.low.length ? client.forecast.low : mid.map((value) => Math.max(0, value - 7));
  const high = client.forecast.high.length ? client.forecast.high : mid.map((value) => Math.min(100, value + 7));
  const width = 300;
  const height = 106;
  const padX = 10;
  const padY = 12;
  const values = [...history, ...mid, ...low, ...high];
  const minValue = Math.max(0, Math.min(...values) - 8);
  const maxValue = Math.min(100, Math.max(...values) + 8);
  const span = Math.max(1, maxValue - minValue);
  const totalPoints = history.length + mid.length;
  const step = (width - padX * 2) / Math.max(1, totalPoints - 1);
  const yFor = (value: number) => height - padY - ((value - minValue) / span) * (height - padY * 2);
  const historyPoints = history.map((value, index) => [padX + index * step, yFor(value)] as [number, number]);
  const forecastStart = history.length - 1;
  const midPoints = [history[history.length - 1], ...mid].map(
    (value, index) => [padX + (forecastStart + index) * step, yFor(value)] as [number, number],
  );
  const highPoints = [history[history.length - 1], ...high].map(
    (value, index) => [padX + (forecastStart + index) * step, yFor(value)] as [number, number],
  );
  const lowPoints = [history[history.length - 1], ...low].map(
    (value, index) => [padX + (forecastStart + index) * step, yFor(value)] as [number, number],
  );

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-28 w-full overflow-visible" role="img" aria-label={`${client.name} risk trajectory`}>
      <path d={polygonPath(highPoints, lowPoints)} className="fill-primary/10" />
      <path d={linePath(historyPoints)} className="fill-none stroke-slate-400" strokeWidth="2.5" />
      <path d={linePath(midPoints)} className="fill-none stroke-primary" strokeWidth="3" strokeLinecap="round" />
      <line
        x1={historyPoints[historyPoints.length - 1][0]}
        x2={historyPoints[historyPoints.length - 1][0]}
        y1={padY}
        y2={height - padY}
        className="stroke-slate-200"
        strokeDasharray="4 4"
      />
      <circle
        cx={historyPoints[historyPoints.length - 1][0]}
        cy={historyPoints[historyPoints.length - 1][1]}
        r="4"
        className="fill-white stroke-primary"
        strokeWidth="2.5"
      />
    </svg>
  );
}

export default function RiskQueue() {
  const { t } = useLanguage();
  const [days, setDays] = useState<(typeof horizonOptions)[number]>(7);
  const [filter, setFilter] = useState<(typeof filterOptions)[number]["value"]>("all");
  const queryClient = useQueryClient();
  const organizationId = useActiveOrganizationId();
  const operationalQuery = useGISData();
  const insightsQuery = useQuery({
    queryKey: ["insights", organizationId, days, filter],
    queryFn: () => fetchInsights(days, filter),
    enabled: Boolean(organizationId),
    retry: false,
  });

  const applyMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/insights/suggestions/${id}/apply`, { method: "POST" }),
    onSuccess: async () => {
      toast({ title: "Suggestion applied" });
      await queryClient.invalidateQueries({ queryKey: ["insights"] });
    },
    onError: (error) => {
      toast({
        title: "Could not apply suggestion",
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    },
  });

  const dismissMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/insights/suggestions/${id}/dismiss`, { method: "POST" }),
    onSuccess: async () => {
      toast({ title: "Suggestion dismissed" });
      await queryClient.invalidateQueries({ queryKey: ["insights"] });
    },
  });

  const operationalFallback = useMemo(
    () => operationalFallbackPayload(operationalQuery.data?.gisUsers ?? [], operationalQuery.data?.fieldStaff ?? [], days, filter),
    [days, filter, operationalQuery.data?.fieldStaff, operationalQuery.data?.gisUsers],
  );
  const data = insightsQuery.data ?? (insightsQuery.isError && !operationalQuery.isLoading ? operationalFallback : undefined);
  const maxHours = useMemo(
    () => Math.max(1, ...(data?.horizon ?? []).map((row) => Math.max(row.hoursNeeded, row.hoursAvailable))),
    [data?.horizon],
  );
  const kpiHelp = {
    escalations: {
      title: t("riskQueue.help.escalations.title"),
      body: t("riskQueue.help.escalations.body"),
    },
    trending: {
      title: t("riskQueue.help.trending.title"),
      body: t("riskQueue.help.trending.body"),
    },
    adherence: {
      title: t("riskQueue.help.adherence.title"),
      body: t("riskQueue.help.adherence.body"),
    },
    capacity: {
      title: t("riskQueue.help.capacity.title"),
      body: t("riskQueue.help.capacity.body"),
    },
  };

  if (insightsQuery.isLoading || (insightsQuery.isError && operationalQuery.isLoading)) {
    return (
      <div className="mx-auto max-w-[1520px] space-y-5">
        <Skeleton className="h-10 w-80" />
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-28 rounded-lg" />)}
        </div>
        <Skeleton className="h-[540px] rounded-lg" />
      </div>
    );
  }

  if (!data) {
    return (
      <Card className="mx-auto max-w-2xl border-border bg-white">
        <CardContent className="p-8 text-center">
          <ShieldAlert className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-base font-semibold text-foreground">Predictive insights are unavailable.</p>
          <p className="mt-1 text-sm text-muted-foreground">The precomputed risk tables could not be read.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="mx-auto max-w-[1520px] space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-2xl font-bold text-foreground">{t("riskQueue.title")}</h1>
            {data.source !== "predicted" && (
              <Badge className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                {data.source === "operational" ? "Operational data" : "Preview data"}
              </Badge>
            )}
          </div>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            {data.source === "operational"
              ? "Forecast tables are unavailable, so this view is using live risk queue signals from the client dashboard."
              : "Risk forecasting, operator capacity, and reassignment suggestions on the same horizon."}
          </p>
        </div>
        <div className="flex rounded-lg border border-border bg-white p-1 shadow-sm">
          {horizonOptions.map((option) => (
            <Button
              key={option}
              type="button"
              size="sm"
              variant={days === option ? "default" : "ghost"}
              onClick={() => setDays(option)}
              className="h-8 rounded-md px-3 text-xs font-semibold"
            >
              {option}d
            </Button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard icon={AlertTriangle} label="Escalations 7d" value={data.kpis.predictedEscalations7d} tone="red" help={kpiHelp.escalations} />
        <KpiCard icon={ArrowUpRight} label="Trending up" value={data.kpis.clientsTrendingUp} tone="orange" help={kpiHelp.trending} />
        <KpiCard icon={Pill} label="Adherence risk" value={data.kpis.adherenceRiskFlags} tone="amber" help={kpiHelp.adherence} />
        <KpiCard icon={UsersRound} label="Over capacity" value={data.kpis.operatorsOverCapacity} tone="slate" help={kpiHelp.capacity} />
      </div>

      <Card className="border-border bg-white shadow-sm">
        <CardHeader className="flex-row items-center justify-between gap-4 p-5">
          <div>
            <CardTitle className="text-base font-bold">Forecast horizon</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">Daily predicted demand versus available operator hours.</p>
          </div>
          <div className="flex items-center gap-2">
            <HelpButton title={t("riskQueue.help.horizon.title")} body={t("riskQueue.help.horizon.body")} />
            <Clock3 className="h-5 w-5 text-primary" />
          </div>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          {data.horizon.length === 0 ? (
            <EmptyState label="No horizon forecast yet" />
          ) : (
            <div className="grid gap-3 md:grid-cols-7">
              {data.horizon.map((row) => {
                const pressure = row.hoursAvailable > 0 ? row.hoursNeeded / row.hoursAvailable : 0;
                return (
                  <div key={row.date} className="rounded-lg border border-border bg-muted/30 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">{shortDate(row.date)}</p>
                      <Badge
                        variant="outline"
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-bold",
                          pressure > 1 ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700",
                        )}
                      >
                        {pressure > 1 ? "gap" : "ok"}
                      </Badge>
                    </div>
                    <div className="mt-3 flex h-24 items-end gap-2">
                      <div className="w-full rounded-t bg-red-500" style={{ height: `${Math.max(8, (row.urgent / 8) * 100)}%` }} />
                      <div className="w-full rounded-t bg-orange-400" style={{ height: `${Math.max(8, (row.review / 12) * 100)}%` }} />
                      <div className="w-full rounded-t bg-amber-400" style={{ height: `${Math.max(8, (row.medication / 8) * 100)}%` }} />
                      <div className="w-full rounded-t bg-primary" style={{ height: `${Math.max(8, (row.noResponse / 8) * 100)}%` }} />
                    </div>
                    <div className="mt-3 space-y-1 text-xs font-medium text-muted-foreground">
                      <div className="flex justify-between"><span>Needed</span><span>{row.hoursNeeded.toFixed(1)}h</span></div>
                      <Progress value={(row.hoursNeeded / maxHours) * 100} className="h-1.5 bg-slate-100" />
                      <div className="flex justify-between"><span>Available</span><span>{row.hoursAvailable.toFixed(1)}h</span></div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.55fr)]">
        <Card className="border-border bg-white shadow-sm">
          <CardHeader className="gap-4 p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle className="text-base font-bold">Client trajectories</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">Composite score history with 30-day uncertainty cones.</p>
              </div>
              <div className="flex items-center gap-2">
                <HelpButton title={t("riskQueue.help.trajectories.title")} body={t("riskQueue.help.trajectories.body")} />
                <div className="flex max-w-full gap-2 overflow-x-auto">
                  {filterOptions.map((option) => (
                    <Button
                      key={option.value}
                      type="button"
                      size="sm"
                      variant={filter === option.value ? "default" : "outline"}
                      onClick={() => setFilter(option.value)}
                      className={cn(
                        "h-8 shrink-0 rounded-full px-3 text-xs font-semibold",
                        filter !== option.value && "border-border bg-white text-muted-foreground",
                      )}
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 px-5 pb-5">
            {data.clients.length === 0 ? (
              <EmptyState label="No clients match this forecast filter" />
            ) : (
              data.clients.map((client) => <ClientTrajectoryCard key={client.id} client={client} />)
            )}
          </CardContent>
        </Card>

        <div className="space-y-5">
          <Card className="border-border bg-white shadow-sm">
            <CardHeader className="flex-row items-center justify-between gap-4 p-5">
              <div>
                <CardTitle className="text-base font-bold">Operator capacity</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">Current caseload against recommended load.</p>
              </div>
              <div className="flex items-center gap-2">
                <HelpButton title={t("riskQueue.help.operator.title")} body={t("riskQueue.help.operator.body")} />
                <UserRoundCheck className="h-5 w-5 text-primary" />
              </div>
            </CardHeader>
            <CardContent className="space-y-4 px-5 pb-5">
              {data.operators.length === 0 ? (
                <EmptyState label="No capacity rows yet" />
              ) : (
                data.operators.map((operator) => <OperatorRow key={operator.id} operator={operator} />)
              )}
            </CardContent>
          </Card>

          <Card className="border-border bg-white shadow-sm">
            <CardHeader className="flex-row items-center justify-between gap-4 p-5">
              <div>
                <CardTitle className="text-base font-bold">Reassignment suggestions</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">Pending moves generated by the nightly run.</p>
              </div>
              <div className="flex items-center gap-2">
                <HelpButton title={t("riskQueue.help.reassignment.title")} body={t("riskQueue.help.reassignment.body")} />
                <BrainCircuit className="h-5 w-5 text-primary" />
              </div>
            </CardHeader>
            <CardContent className="space-y-3 px-5 pb-5">
              {data.suggestions.length === 0 ? (
                <EmptyState label="No pending suggestions" />
              ) : (
                data.suggestions.map((suggestion) => (
                  <div key={suggestion.id} className="rounded-lg border border-border bg-muted/25 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-foreground">{suggestion.from} to {suggestion.to}</p>
                        <p className="mt-1 text-xs font-semibold text-muted-foreground">{suggestion.clientCount} client{suggestion.clientCount === 1 ? "" : "s"}</p>
                      </div>
                      <Badge className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                        {suggestion.status}
                      </Badge>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">{suggestion.reason}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        disabled={data.source !== "predicted" || applyMutation.isPending}
                        onClick={() => applyMutation.mutate(suggestion.id)}
                        className="h-8 rounded-full px-3 text-xs font-semibold"
                      >
                        {applyMutation.isPending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="mr-1 h-3.5 w-3.5" />}
                        Apply
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={data.source !== "predicted" || dismissMutation.isPending}
                        onClick={() => dismissMutation.mutate(suggestion.id)}
                        className="h-8 rounded-full border-border bg-white px-3 text-xs font-semibold text-muted-foreground"
                      >
                        Dismiss
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  tone,
  help,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  tone: "red" | "orange" | "amber" | "slate";
  help?: { title: string; body: string };
}) {
  const toneClass = {
    red: "bg-red-50 text-red-700",
    orange: "bg-orange-50 text-orange-700",
    amber: "bg-amber-50 text-amber-700",
    slate: "bg-slate-100 text-slate-700",
  }[tone];

  return (
    <Card className="border-border bg-white shadow-sm">
      <CardContent className="flex h-28 items-start justify-between gap-3 p-5">
        <div className="min-w-0">
          <div className="flex items-start gap-2">
            <p className="min-w-0 text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
            {help ? <HelpButton title={help.title} body={help.body} /> : null}
          </div>
          <p className="mt-2 text-3xl font-bold tracking-tight text-foreground">{value}</p>
        </div>
        <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-lg", toneClass)}>
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}

function ClientTrajectoryCard({ client }: { client: InsightClient }) {
  const DeltaIcon = client.delta >= 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <div className="grid gap-4 rounded-lg border border-border bg-white p-4 lg:grid-cols-[minmax(180px,0.65fr)_minmax(240px,1fr)] 2xl:grid-cols-[minmax(230px,0.72fr)_minmax(280px,1fr)_minmax(210px,0.52fr)]">
      <div className="min-w-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-base font-bold text-foreground">{client.name}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {[client.age ? `${client.age}y` : null, client.zone, client.operator || "Unassigned"].filter(Boolean).join(" / ")}
            </p>
          </div>
          <Badge className={cn("shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ring-1", bandClasses(client.band))}>
            {client.band}
          </Badge>
        </div>
        <div className="mt-4 flex items-end gap-3">
          <p className="text-4xl font-bold tracking-tight text-foreground">{Math.round(client.score)}</p>
          <div className={cn("mb-1 flex items-center gap-1 text-sm font-bold", client.delta >= 0 ? "text-red-600" : "text-emerald-600")}>
            <DeltaIcon className="h-4 w-4" />
            {Math.abs(client.delta).toFixed(1)}
          </div>
        </div>
      </div>

      <RiskTrajectory client={client} />

      <div className="min-w-0 lg:col-span-2 2xl:col-span-1">
        <p className="text-sm font-semibold text-foreground">{client.window}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {client.factors.slice(0, 4).map((factor) => (
            <span key={`${client.id}-${factor.label}`} className={cn("rounded-full px-2.5 py-1 text-xs font-bold ring-1", factorClasses(factor.severity))}>
              {factor.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function OperatorRow({ operator }: { operator: OperatorCapacity }) {
  const target = Math.max(1, operator.recommended || Math.round(operator.capacity / 3));
  const percent = Math.min(100, (operator.current / target) * 100);
  const overloaded = operator.current > target;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-foreground">{operator.name}</p>
          <p className="text-xs font-medium text-muted-foreground">{operator.capacity.toFixed(0)}h capacity</p>
        </div>
        <Badge
          variant="outline"
          className={cn(
            "rounded-full px-2.5 py-1 text-xs font-bold",
            overloaded ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700",
          )}
        >
          {operator.current}/{target}
        </Badge>
      </div>
      <Progress value={percent} className={cn("h-2 bg-slate-100", overloaded && "[&>div]:bg-red-500")} />
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-muted/20 px-4 py-10 text-center">
      <LineChart className="mx-auto mb-3 h-8 w-8 text-muted-foreground/60" />
      <p className="text-sm font-semibold text-muted-foreground">{label}</p>
    </div>
  );
}
