import type { ReactNode } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  Download,
  HeartPulse,
  Link2,
  PhoneCall,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type Accent = "purple" | "red" | "orange" | "green" | "yellow" | "slate";

const populationRows = [
  { key: "reports.population.stable", value: 104, tone: "bg-emerald-500" },
  { key: "reports.population.monitor", value: 28, tone: "bg-amber-500" },
  { key: "reports.population.review", value: 7, tone: "bg-orange-500" },
  { key: "reports.population.urgent", value: 3, tone: "bg-red-500" },
];

const channelRows = [
  { key: "reports.channel.phone", value: 68 },
  { key: "reports.channel.whatsapp", value: 17 },
  { key: "reports.channel.app", value: 10 },
  { key: "reports.channel.webCaregiver", value: 3 },
  { key: "reports.channel.servicePoint", value: 2 },
];

const wellbeingRows = [
  { key: "reports.wellbeing.isolation", value: 18 },
  { key: "reports.wellbeing.referrals", value: 6 },
  { key: "reports.wellbeing.engagement", value: 4 },
];

const serviceRows = [
  { key: "reports.services.phone", value: 6, tone: "bg-primary" },
  { key: "reports.services.medication", value: 3, tone: "bg-orange-500" },
  { key: "reports.services.pharmacy", value: 2, tone: "bg-amber-500" },
  { key: "reports.services.postDischarge", value: 1, tone: "bg-emerald-500" },
];

function accentClasses(accent: Accent) {
  switch (accent) {
    case "purple":
      return "border-t-primary text-primary";
    case "red":
      return "border-t-red-500 text-red-600";
    case "orange":
      return "border-t-orange-500 text-orange-600";
    case "green":
      return "border-t-emerald-500 text-emerald-600";
    case "yellow":
      return "border-t-amber-500 text-amber-600";
    case "slate":
      return "border-t-slate-300 text-slate-800";
  }
}

export default function Reports() {
  const { t } = useLanguage();
  const navigate = useNavigate();

  const handleAction = (descriptionKey: string) => {
    toast({
      title: t("reports.action.ready"),
      description: t(descriptionKey),
    });
  };

  const metricCards = [
    { label: t("reports.metric.activePeople"), value: "142", accent: "purple" as const },
    { label: t("reports.metric.urgentCases"), value: "3", accent: "red" as const },
    { label: t("reports.metric.operatorReview"), value: "7", accent: "orange" as const },
    { label: t("reports.metric.checkinsCompleted"), value: "89%", accent: "green" as const },
    { label: t("reports.metric.medicationConfirmation"), value: "74%", accent: "yellow" as const },
    { label: t("reports.metric.serviceReferrals"), value: "12", accent: "slate" as const },
  ];

  return (
    <div className="mx-auto max-w-[1680px] space-y-5">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="max-w-full break-words font-display text-xl font-bold leading-tight text-foreground sm:text-2xl">
            {t("reports.title")}
          </h1>
          <p className="text-sm font-medium text-muted-foreground">{t("reports.subtitle")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-10 rounded-full border-primary/20 bg-primary/5 px-4 text-sm font-bold text-primary hover:bg-primary/10 hover:text-primary"
            onClick={() => handleAction("reports.action.exportLocal")}
          >
            <Download className="mr-2 h-4 w-4" />
            {t("reports.export")}
          </Button>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
        {metricCards.map((metric) => (
          <MetricCard key={metric.label} {...metric} />
        ))}
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card className="rounded-2xl border-border bg-white shadow-sm">
          <CardContent className="grid min-h-[310px] gap-6 p-6 md:grid-cols-[220px_minmax(0,1fr)] md:items-center">
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-foreground">{t("reports.population.title")}</h2>
              <div className="flex h-28 items-center justify-center">
                <PopulationGlyph />
              </div>
            </div>
            <div className="space-y-4">
              {populationRows.map((row) => (
                <DataLine key={row.key} label={t(row.key)} value={row.value} dotClassName={row.tone} />
              ))}
              <div className="border-t border-border pt-4">
                <DataLine label={t("reports.population.total")} value={142} valueClassName="text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border bg-white shadow-sm">
          <CardContent className="min-h-[310px] p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <h2 className="text-lg font-bold text-foreground">{t("reports.channels.title")}</h2>
              <Badge className="w-fit rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                {t("reports.channels.leader")}
              </Badge>
            </div>
            <div className="mt-8 space-y-4">
              {channelRows.map((row) => (
                <HorizontalBar key={row.key} label={t(row.key)} value={row.value} />
              ))}
            </div>
            <div className="mt-4 grid grid-cols-5 border-t border-muted-foreground/40 pt-2 text-xs font-medium text-muted-foreground">
              <span>0%</span>
              <span>25%</span>
              <span>50%</span>
              <span>75%</span>
              <span className="text-right">100%</span>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-5 lg:grid-cols-2 2xl:grid-cols-4">
        <InsightCard icon={ArrowUpRight} title={t("reports.wellbeing.title")} iconClassName="text-primary">
          {wellbeingRows.map((row) => (
            <DataLine key={row.key} label={t(row.key)} value={row.value} />
          ))}
        </InsightCard>

        <InsightCard icon={Link2} title={t("reports.medication.title")} iconClassName="text-orange-500">
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm font-semibold">
              <span className="text-muted-foreground">{t("reports.medication.weeklyConfirmation")}</span>
              <span className="text-foreground">74%</span>
            </div>
            <Progress value={74} className="h-2 bg-muted [&>div]:bg-orange-500" />
          </div>
          <DataLine label={t("reports.medication.unconfirmedDoses")} value={8} />
          <DataLine label={t("reports.medication.repeatedPattern")} value={3} />
        </InsightCard>

        <InsightCard icon={AlertTriangle} title={t("reports.campaign.title")} iconClassName="text-amber-500">
          <button
            type="button"
            className="text-left text-sm font-bold text-primary"
            onClick={() => navigate("/campaigns")}
          >
            {t("reports.campaign.name")}
          </button>
          <DataLine label={t("reports.campaign.contacted")} value={420} valueClassName="text-primary" />
          <DataLine label={t("reports.campaign.confirmedSafe")} value={314} valueClassName="text-emerald-600" />
          <DataLine label={t("reports.campaign.followUp")} value={58} valueClassName="text-orange-600" />
        </InsightCard>

        <InsightCard icon={Users} title={t("reports.services.title")} iconClassName="text-primary">
          {serviceRows.map((row) => (
            <DataLine key={row.key} label={t(row.key)} value={row.value} dotClassName={row.tone} />
          ))}
        </InsightCard>
      </section>

      <section className="grid gap-5 lg:grid-cols-3">
        <CompactPanel icon={PhoneCall} title={t("reports.operator.title")} value="7" detail={t("reports.operator.detail")} accent="orange" />
        <CompactPanel icon={HeartPulse} title={t("reports.safety.title")} value="96%" detail={t("reports.safety.detail")} accent="green" />
        <CompactPanel icon={Wrench} title={t("reports.servicesBacklog.title")} value="4" detail={t("reports.servicesBacklog.detail")} accent="purple" />
      </section>
    </div>
  );
}

function MetricCard({ accent, label, value }: { accent: Accent; label: string; value: string }) {
  const accentClass = accentClasses(accent);

  return (
    <Card className={cn("rounded-2xl border-border border-t-4 bg-white shadow-sm", accentClass)}>
      <CardContent className="flex h-28 flex-col justify-center p-5">
        <p className="text-xs font-bold uppercase leading-snug tracking-[0.18em] text-muted-foreground">{label}</p>
        <p className={cn("mt-2 text-4xl font-extrabold leading-none tracking-tight", accentClass)}>{value}</p>
      </CardContent>
    </Card>
  );
}

function InsightCard({
  children,
  icon: Icon,
  iconClassName,
  title,
}: {
  children: ReactNode;
  icon: LucideIcon;
  iconClassName: string;
  title: string;
}) {
  return (
    <Card className="rounded-2xl border-border bg-white shadow-sm">
      <CardContent className="space-y-4 p-5">
        <h2 className="flex items-center gap-2 text-base font-extrabold uppercase tracking-[0.04em] text-foreground">
          <Icon className={cn("h-4 w-4", iconClassName)} />
          {title}
        </h2>
        <div className="space-y-3">{children}</div>
      </CardContent>
    </Card>
  );
}

function DataLine({
  dotClassName,
  label,
  value,
  valueClassName,
}: {
  dotClassName?: string;
  label: string;
  value: number;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border/70 pb-3 last:border-b-0 last:pb-0">
      <span className="flex min-w-0 items-center gap-3 text-sm font-medium text-muted-foreground">
        {dotClassName && <span className={cn("h-3 w-3 shrink-0 rounded-full", dotClassName)} />}
        <span className="min-w-0 truncate">{label}</span>
      </span>
      <span className={cn("shrink-0 text-base font-bold text-foreground", valueClassName)}>{value}</span>
    </div>
  );
}

function HorizontalBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="grid grid-cols-[110px_minmax(0,1fr)] items-center gap-3">
      <span className="text-right text-sm font-medium text-muted-foreground">{label}</span>
      <div className="h-6 rounded-md bg-transparent">
        <div className="h-full rounded-md bg-primary" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function CompactPanel({
  accent,
  detail,
  icon: Icon,
  title,
  value,
}: {
  accent: "purple" | "orange" | "green";
  detail: string;
  icon: LucideIcon;
  title: string;
  value: string;
}) {
  const toneClass = {
    purple: "text-primary bg-primary/10",
    orange: "text-orange-600 bg-orange-50",
    green: "text-emerald-600 bg-emerald-50",
  }[accent];

  return (
    <Card className="rounded-2xl border-border bg-white shadow-sm">
      <CardContent className="flex items-center justify-between gap-4 p-5">
        <div>
          <p className="text-sm font-bold text-foreground">{title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
        </div>
        <div className={cn("flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl", toneClass)}>
          <Icon className="h-4 w-4" />
          <span className="mt-1 text-sm font-extrabold">{value}</span>
        </div>
      </CardContent>
    </Card>
  );
}

function PopulationGlyph() {
  return (
    <div className="relative h-20 w-20">
      <div className="absolute left-5 top-7 h-9 w-10 rounded-b-sm rounded-t-[4px] bg-emerald-500" />
      <div className="absolute left-4 top-5 h-1.5 w-11 -rotate-[22deg] rounded-full bg-amber-500" />
      <div className="absolute left-4 top-8 h-1.5 w-11 -rotate-[22deg] rounded-full bg-white" />
    </div>
  );
}
