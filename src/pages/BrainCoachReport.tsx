import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Brain, CheckCircle2, HelpCircle, LineChart, ListChecks, Trophy } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useLanguage } from "@/contexts/LanguageContext";
import { apiFetch } from "@/lib/apiClient";
import { cn } from "@/lib/utils";

type ReportRange = 7 | 30 | 90;
type ReportTab = "performance" | "sessions";

type BrainCoachReportResponse = {
  user?: {
    id?: string;
    name?: string;
    phone?: string | null;
    city?: string | null;
  } | null;
  summary?: {
    averageScore?: number | null;
    sessionsCompleted?: number | null;
    totalQuestions?: number | null;
    streakDays?: number | null;
  } | null;
  performance?: Array<{
    date?: string | null;
    score?: number | null;
  }> | null;
  sessions?: Array<{
    id?: string | number | null;
    date?: string | null;
    status?: string | null;
    score?: number | null;
    questions?: number | null;
    durationMinutes?: number | null;
  }> | null;
};

const ranges: ReportRange[] = [7, 30, 90];

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function formatPercent(value?: number | null) {
  if (typeof value !== "number" || Number.isNaN(value)) return "0%";
  return `${Math.round(value)}%`;
}

function statusClass(status?: string | null) {
  const normalized = String(status || "").toLowerCase();
  if (["completed", "confirmed", "success"].includes(normalized)) return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (["missed", "failed", "no_answer"].includes(normalized)) return "border-red-200 bg-red-50 text-red-700";
  if (["escalated", "urgent"].includes(normalized)) return "border-orange-200 bg-orange-50 text-orange-700";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function MiniTrend({ data, emptyLabel }: { data: Array<{ date?: string | null; score?: number | null }>; emptyLabel: string }) {
  const points = data.filter((item) => typeof item.score === "number") as Array<{ date?: string | null; score: number }>;
  if (points.length < 2) {
    return <div className="flex h-64 items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">{emptyLabel}</div>;
  }

  const width = 720;
  const height = 260;
  const padding = 34;
  const maxScore = 100;
  const path = points.map((point, index) => {
    const x = padding + (index / Math.max(points.length - 1, 1)) * (width - padding * 2);
    const y = height - padding - (Math.max(0, Math.min(point.score, maxScore)) / maxScore) * (height - padding * 2);
    return `${index === 0 ? "M" : "L"} ${x} ${y}`;
  }).join(" ");

  return (
    <div className="overflow-hidden rounded-xl border bg-card p-4">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-64 w-full">
        {[20, 40, 60, 80, 100].map((line) => {
          const y = height - padding - (line / 100) * (height - padding * 2);
          return (
            <g key={line}>
              <line x1={padding} x2={width - padding} y1={y} y2={y} stroke="#e5e7eb" strokeDasharray="4 6" />
              <text x={padding - 8} y={y + 4} textAnchor="end" className="fill-slate-400 text-[11px]">{line}%</text>
            </g>
          );
        })}
        <path d={path} fill="none" stroke="#6d4df2" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((point, index) => {
          const x = padding + (index / Math.max(points.length - 1, 1)) * (width - padding * 2);
          const y = height - padding - (Math.max(0, Math.min(point.score, maxScore)) / maxScore) * (height - padding * 2);
          return <circle key={`${point.date}-${index}`} cx={x} cy={y} r="5" fill="#6d4df2" />;
        })}
      </svg>
    </div>
  );
}

export default function BrainCoachReport() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [range, setRange] = useState<ReportRange>(7);
  const [tab, setTab] = useState<ReportTab>("performance");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["brain-coach-report", id, range],
    queryFn: () => apiFetch<BrainCoachReportResponse>(`/api/v1/brain-coach-dashboard/users/${encodeURIComponent(id || "")}/report?days=${range}`),
    enabled: Boolean(id),
    retry: false,
  });

  const sessions = useMemo(() => data?.sessions ?? [], [data?.sessions]);
  const performance = useMemo(() => data?.performance ?? [], [data?.performance]);
  const summary = data?.summary ?? {};
  const name = data?.user?.name || t("brainCoach.reportUnknownClient");

  const metricCards = [
    {
      title: t("brainCoach.reportAverageScore"),
      value: formatPercent(summary.averageScore),
      detail: t("brainCoach.reportLastDays").replace("{days}", String(range)),
      icon: LineChart,
      color: "text-primary",
    },
    {
      title: t("brainCoach.reportSessionsCompleted"),
      value: String(summary.sessionsCompleted ?? 0),
      detail: t("brainCoach.reportCompleted"),
      icon: CheckCircle2,
      color: "text-emerald-600",
    },
    {
      title: t("brainCoach.reportTotalQuestions"),
      value: String(summary.totalQuestions ?? 0),
      detail: t("brainCoach.reportQuestions"),
      icon: HelpCircle,
      color: "text-orange-600",
    },
    {
      title: t("brainCoach.reportStreak"),
      value: String(summary.streakDays ?? 0),
      detail: (summary.streakDays ?? 0) > 0 ? t("brainCoach.reportDays") : t("brainCoach.reportNoStreak"),
      icon: Trophy,
      color: "text-amber-600",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 border-b bg-card/60 px-1 pb-5 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/brain-coach")} aria-label={t("brainCoach.reportBack")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-secondary" />
              <h1 className="font-display text-2xl font-bold text-foreground">{name}</h1>
            </div>
            <p className="text-sm text-muted-foreground">{t("brainCoach.reportSubtitle")}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {ranges.map((item) => (
            <Button key={item} variant={range === item ? "default" : "outline"} onClick={() => setRange(item)}>
              {t(`brainCoach.reportRange${item}`)}
            </Button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-32 rounded-xl" />)}
        </div>
      ) : isError ? (
        <div className="rounded-xl border bg-card p-8 text-center text-destructive">{t("brainCoach.reportLoadFailed")}</div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            {metricCards.map((card) => {
              const Icon = card.icon;
              return (
                <div key={card.title} className="rounded-xl border bg-card p-5 shadow-sm">
                  <div className="mb-4 flex items-center justify-between">
                    <p className="text-sm font-medium text-muted-foreground">{card.title}</p>
                    <Icon className={cn("h-5 w-5", card.color)} />
                  </div>
                  <p className="font-display text-3xl font-bold text-foreground">{card.value}</p>
                  <p className="mt-2 text-sm text-muted-foreground">{card.detail}</p>
                </div>
              );
            })}
          </div>

          <div className="flex w-fit gap-1 rounded-lg border bg-muted/50 p-1">
            <Button variant={tab === "performance" ? "default" : "ghost"} size="sm" onClick={() => setTab("performance")}>
              {t("brainCoach.reportPerformance")}
            </Button>
            <Button variant={tab === "sessions" ? "default" : "ghost"} size="sm" onClick={() => setTab("sessions")}>
              {t("brainCoach.reportSessions")}
            </Button>
          </div>

          {tab === "performance" ? (
            <section className="rounded-xl border bg-card p-5 shadow-sm">
              <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold">
                <Brain className="h-5 w-5 text-primary" />
                {t("brainCoach.reportScoreTrend")}
              </h2>
              <MiniTrend data={performance} emptyLabel={t("brainCoach.reportNoPerformance")} />
            </section>
          ) : (
            <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
              <div className="border-b p-5">
                <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
                  <ListChecks className="h-5 w-5 text-primary" />
                  {t("brainCoach.reportSessionHistory")}
                </h2>
              </div>
              {sessions.length === 0 ? (
                <div className="p-10 text-center text-muted-foreground">{t("brainCoach.reportNoSessions")}</div>
              ) : (
                <div className="divide-y">
                  {sessions.map((session, index) => (
                    <div key={String(session.id ?? index)} className="grid gap-3 p-5 md:grid-cols-[1fr_auto_auto_auto] md:items-center">
                      <div>
                        <p className="font-medium text-foreground">{formatDate(session.date)}</p>
                        <p className="text-sm text-muted-foreground">
                          {session.durationMinutes ? `${session.durationMinutes} min` : t("brainCoach.reportSession")}
                        </p>
                      </div>
                      <Badge variant="outline" className={cn("w-fit rounded-full", statusClass(session.status))}>
                        {session.status || t("brainCoach.reportUnknownStatus")}
                      </Badge>
                      <p className="text-sm text-muted-foreground">{t("brainCoach.reportScore")}: {formatPercent(session.score)}</p>
                      <p className="text-sm text-muted-foreground">{t("brainCoach.reportQuestions")}: {session.questions ?? 0}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}
