import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  CopyPlus,
  Download,
  Megaphone,
  PhoneCall,
  Plus,
  Search,
  Send,
  Users,
  type LucideIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "@/hooks/use-toast";
import {
  demoOperationalUsers,
  type OperationalChannel,
  type OperationalQueueUser,
  type OperationalStatus,
} from "@/lib/operationalDemoData";
import { cn } from "@/lib/utils";

type CampaignStatus = "active" | "draft" | "scheduled" | "completed";
type CampaignChannel = "phone" | "whatsapp" | "mixed";
type CampaignType = "safety" | "wellbeing" | "medication" | "service";
type CampaignTargetStatus = "pending" | "contacted" | "confirmed" | "followUp";

type Campaign = {
  id: string;
  name?: string;
  nameKey?: string;
  objective?: string;
  objectiveKey?: string;
  audience?: string;
  audienceKey?: string;
  dueKey: string;
  city: string;
  owner: string;
  type: CampaignType;
  status: CampaignStatus;
  channel: CampaignChannel;
  total: number;
  contacted: number;
  confirmed: number;
  followUp: number;
  tone: "purple" | "orange" | "green" | "red";
};

type FormState = {
  name: string;
  type: CampaignType;
  audience: string;
  city: string;
  channel: CampaignChannel;
  objective: string;
};

type CampaignTarget = {
  action: "profile" | "prepareCall";
  channel: OperationalChannel;
  city: string;
  owner?: string | null;
  reasonKey: string;
  riskStatus: OperationalStatus;
  score: number;
  status: CampaignTargetStatus;
  user: OperationalQueueUser;
};

const initialCampaigns: Campaign[] = [
  {
    id: "heatwave",
    nameKey: "campaigns.demo.heatwave.name",
    objectiveKey: "campaigns.demo.heatwave.objective",
    audienceKey: "campaigns.demo.heatwave.audience",
    dueKey: "campaigns.due.today",
    city: "Madrid",
    owner: "Ana Novak",
    type: "safety",
    status: "active",
    channel: "phone",
    total: 420,
    contacted: 420,
    confirmed: 314,
    followUp: 58,
    tone: "orange",
  },
  {
    id: "medication",
    nameKey: "campaigns.demo.medication.name",
    objectiveKey: "campaigns.demo.medication.objective",
    audienceKey: "campaigns.demo.medication.audience",
    dueKey: "campaigns.due.tomorrow",
    city: "Madrid",
    owner: "Team North",
    type: "medication",
    status: "scheduled",
    channel: "mixed",
    total: 86,
    contacted: 18,
    confirmed: 11,
    followUp: 9,
    tone: "purple",
  },
  {
    id: "isolation",
    nameKey: "campaigns.demo.isolation.name",
    objectiveKey: "campaigns.demo.isolation.objective",
    audienceKey: "campaigns.demo.isolation.audience",
    dueKey: "campaigns.due.friday",
    city: "Dresden",
    owner: "Team East",
    type: "wellbeing",
    status: "draft",
    channel: "phone",
    total: 64,
    contacted: 0,
    confirmed: 0,
    followUp: 0,
    tone: "green",
  },
  {
    id: "post-discharge",
    nameKey: "campaigns.demo.postDischarge.name",
    objectiveKey: "campaigns.demo.postDischarge.objective",
    audienceKey: "campaigns.demo.postDischarge.audience",
    dueKey: "campaigns.due.completed",
    city: "Leipzig",
    owner: "Services desk",
    type: "service",
    status: "completed",
    channel: "whatsapp",
    total: 52,
    contacted: 52,
    confirmed: 47,
    followUp: 3,
    tone: "red",
  },
];

const statusFilters: Array<CampaignStatus | "all"> = ["all", "active", "scheduled", "draft", "completed"];

function userName(user: OperationalQueueUser) {
  return `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim() || "Unknown";
}

function channelKey(channel: OperationalChannel) {
  if (channel === "whatsapp") return "profile.channel.whatsApp";
  if (channel === "app") return "profile.channel.app";
  return "profile.channel.phone";
}

function itemText(item: Campaign, key: "name" | "objective" | "audience", t: (key: string) => string) {
  const textKey = item[`${key}Key` as keyof Campaign];
  if (typeof textKey === "string") return t(textKey);
  return (item[key] as string | undefined) ?? "";
}

function statusClasses(status: CampaignStatus) {
  switch (status) {
    case "active":
      return "bg-emerald-50 text-emerald-700 ring-emerald-200";
    case "scheduled":
      return "bg-primary/10 text-primary ring-primary/20";
    case "draft":
      return "bg-amber-50 text-amber-700 ring-amber-200";
    case "completed":
      return "bg-slate-100 text-slate-700 ring-slate-200";
  }
}

function toneClass(tone: Campaign["tone"]) {
  switch (tone) {
    case "purple":
      return "border-t-primary text-primary";
    case "orange":
      return "border-t-orange-500 text-orange-600";
    case "green":
      return "border-t-emerald-500 text-emerald-600";
    case "red":
      return "border-t-red-500 text-red-600";
  }
}

function completion(campaign: Campaign) {
  if (campaign.total <= 0) return 0;
  return Math.round((campaign.contacted / campaign.total) * 100);
}

function targetStatusClasses(status: CampaignTargetStatus) {
  switch (status) {
    case "pending":
      return "bg-slate-100 text-slate-700 ring-slate-200";
    case "contacted":
      return "bg-primary/10 text-primary ring-primary/20";
    case "confirmed":
      return "bg-emerald-50 text-emerald-700 ring-emerald-200";
    case "followUp":
      return "bg-orange-50 text-orange-700 ring-orange-200";
  }
}

function targetReasonKey(campaign: Campaign, user: OperationalQueueUser) {
  if (campaign.type === "medication") {
    return (user.missedMeds7d ?? 0) > 0 ? "campaigns.targets.reason.medication" : "campaigns.targets.reason.monitor";
  }

  if (campaign.type === "wellbeing") {
    if (user.operationalContext?.noResponse) return "campaigns.targets.reason.noResponse";
    if (!user.operationalContext?.assignedTo || !(user.checkinEnabled ?? false)) return "campaigns.targets.reason.support";
    return "campaigns.targets.reason.isolation";
  }

  if (campaign.type === "service") return "campaigns.targets.reason.service";

  if ((user.criticalAlerts ?? 0) > 0) return "campaigns.targets.reason.safetyCritical";
  if ((user.activeAlerts ?? 0) > 0) return "campaigns.targets.reason.safetyReview";
  return "campaigns.targets.reason.safetyCheck";
}

function targetStatus(campaign: Campaign, user: OperationalQueueUser, index: number): CampaignTargetStatus {
  const riskStatus = user.operationalContext?.riskStatus;
  if (riskStatus === "urgent" || (user.criticalAlerts ?? 0) > 0) return "followUp";
  if (campaign.status === "draft") return "pending";
  if (campaign.status === "scheduled") return index === 0 ? "contacted" : "pending";
  if (campaign.status === "completed") return index % 3 === 0 ? "followUp" : "confirmed";
  if (riskStatus === "review" || (user.activeAlerts ?? 0) > 0 || (user.missedMeds7d ?? 0) > 0) return "followUp";
  return "confirmed";
}

function campaignTargets(campaign: Campaign): CampaignTarget[] {
  const candidates = demoOperationalUsers.filter((user) => {
    if (campaign.type === "medication") return (user.missedMeds7d ?? 0) > 0;
    if (campaign.type === "wellbeing") {
      return Boolean(user.operationalContext?.noResponse) || !user.operationalContext?.assignedTo || !(user.checkinEnabled ?? false);
    }
    if (campaign.type === "service") return user.city === campaign.city || user.operationalContext?.riskStatus !== "stable";
    return user.city === campaign.city || (user.criticalAlerts ?? 0) > 0 || (user.activeAlerts ?? 0) > 0;
  });

  return (candidates.length ? candidates : demoOperationalUsers).map((user, index) => {
    const status = targetStatus(campaign, user, index);
    const riskStatus = user.operationalContext?.riskStatus ?? "stable";

    return {
      action: status === "followUp" || riskStatus === "urgent" ? "prepareCall" : "profile",
      channel: user.operationalContext?.preferredChannel ?? "phone",
      city: user.city ?? "",
      owner: user.operationalContext?.assignedTo,
      reasonKey: targetReasonKey(campaign, user),
      riskStatus,
      score: user.riskScore ?? 0,
      status,
      user,
    };
  });
}

const defaultForm: FormState = {
  name: "",
  type: "safety",
  audience: "",
  city: "Madrid",
  channel: "phone",
  objective: "",
};

export default function Campaigns() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [campaigns, setCampaigns] = useState<Campaign[]>(initialCampaigns);
  const [selectedId, setSelectedId] = useState(initialCampaigns[0].id);
  const [statusFilter, setStatusFilter] = useState<CampaignStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(defaultForm);
  const formRef = useRef<HTMLFormElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const cityRef = useRef<HTMLInputElement>(null);
  const audienceRef = useRef<HTMLInputElement>(null);
  const objectiveRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (searchParams.get("create") !== "1") return;
    setDialogOpen(true);
    setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams]);

  const stats = useMemo(() => {
    return {
      active: campaigns.filter((campaign) => campaign.status === "active").length,
      contacted: campaigns.reduce((total, campaign) => total + campaign.contacted, 0),
      confirmed: campaigns.reduce((total, campaign) => total + campaign.confirmed, 0),
      followUp: campaigns.reduce((total, campaign) => total + campaign.followUp, 0),
    };
  }, [campaigns]);

  const filteredCampaigns = useMemo(() => {
    const query = search.trim().toLowerCase();
    return campaigns.filter((campaign) => {
      if (statusFilter !== "all" && campaign.status !== statusFilter) return false;
      if (!query) return true;

      return [
        itemText(campaign, "name", t),
        itemText(campaign, "audience", t),
        t(`campaigns.type.${campaign.type}`),
        t(`campaigns.channel.${campaign.channel}`),
        campaign.city,
        campaign.owner,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [campaigns, search, statusFilter, t]);

  const selectedCampaign = campaigns.find((campaign) => campaign.id === selectedId) ?? campaigns[0];
  const selectedTargets = useMemo(
    () => (selectedCampaign ? campaignTargets(selectedCampaign) : []),
    [selectedCampaign],
  );

  const openCreateDialog = () => {
    setForm(defaultForm);
    setDialogOpen(true);
  };

  const updateForm = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleCreate = () => {
    const name = (nameRef.current?.value ?? form.name).trim();
    const audience = (audienceRef.current?.value ?? form.audience).trim();
    const city = (cityRef.current?.value ?? form.city).trim();
    const objective = (objectiveRef.current?.value ?? form.objective).trim();

    if (!name) {
      toast({ title: t("campaigns.validation.name"), variant: "destructive" });
      return;
    }

    const campaign: Campaign = {
      id: `local-${Date.now()}`,
      name,
      objective: objective || t("campaigns.defaultObjective"),
      audience: audience || t("campaigns.defaultAudience"),
      dueKey: "campaigns.due.draft",
      city: city || "Madrid",
      owner: t("layout.operatorName"),
      type: form.type,
      status: "draft",
      channel: form.channel,
      total: 0,
      contacted: 0,
      confirmed: 0,
      followUp: 0,
      tone: "purple",
    };

    setCampaigns((current) => [campaign, ...current]);
    setSelectedId(campaign.id);
    setDialogOpen(false);
    toast({
      title: t("campaigns.action.ready"),
      description: t("campaigns.action.createdLocal"),
    });
  };

  const handleLocalAction = (descriptionKey: string) => {
    toast({
      title: t("campaigns.action.ready"),
      description: t(descriptionKey),
    });
  };

  return (
    <div className="mx-auto max-w-[1680px] space-y-5">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="max-w-full break-words font-display text-xl font-bold leading-tight text-foreground sm:text-2xl">
            {t("campaigns.title")}
          </h1>
          <p className="text-sm font-medium text-muted-foreground">{t("campaigns.subtitle")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-10 rounded-full border-primary/20 bg-primary/5 px-4 text-sm font-bold text-primary hover:bg-primary/10 hover:text-primary"
            onClick={() => handleLocalAction("campaigns.action.exportLocal")}
          >
            <Download className="mr-2 h-4 w-4" />
            {t("campaigns.export")}
          </Button>
          <Button type="button" className="h-10 rounded-full px-4 text-sm font-bold" onClick={openCreateDialog}>
            <Plus className="mr-2 h-4 w-4" />
            {t("campaigns.newCampaign")}
          </Button>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={Megaphone} label={t("campaigns.metric.active")} value={stats.active} accent="purple" />
        <MetricCard icon={PhoneCall} label={t("campaigns.metric.contacted")} value={stats.contacted} accent="orange" />
        <MetricCard icon={CheckCircle2} label={t("campaigns.metric.confirmed")} value={stats.confirmed} accent="green" />
        <MetricCard icon={ClipboardList} label={t("campaigns.metric.followUp")} value={stats.followUp} accent="red" />
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.55fr)]">
        <Card className="rounded-2xl border-border bg-white shadow-sm">
          <CardContent className="space-y-4 p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap gap-1 rounded-xl border bg-muted/50 p-1">
                {statusFilters.map((filter) => (
                  <Button
                    key={filter}
                    type="button"
                    variant={statusFilter === filter ? "default" : "ghost"}
                    size="sm"
                    className="h-8 rounded-lg px-3 text-xs"
                    onClick={() => setStatusFilter(filter)}
                  >
                    {t(`campaigns.filter.${filter}`)}
                  </Button>
                ))}
              </div>
              <div className="relative w-full lg:w-80">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={t("campaigns.searchPlaceholder")}
                  className="h-10 rounded-xl pl-9"
                />
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="min-w-[260px]">{t("campaigns.column.campaign")}</TableHead>
                    <TableHead>{t("campaigns.column.status")}</TableHead>
                    <TableHead className="min-w-[180px]">{t("campaigns.column.audience")}</TableHead>
                    <TableHead>{t("campaigns.column.channel")}</TableHead>
                    <TableHead className="min-w-[160px]">{t("campaigns.column.progress")}</TableHead>
                    <TableHead>{t("campaigns.column.followUp")}</TableHead>
                    <TableHead>{t("campaigns.column.owner")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCampaigns.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                        {t("campaigns.noMatch")}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredCampaigns.map((campaign) => {
                      const selected = selectedCampaign?.id === campaign.id;
                      const percent = completion(campaign);

                      return (
                        <TableRow
                          key={campaign.id}
                          className={cn(
                            "cursor-pointer transition-colors hover:bg-primary/5",
                            selected && "bg-primary/5",
                          )}
                          onClick={() => setSelectedId(campaign.id)}
                        >
                          <TableCell>
                            <div className="flex items-start gap-3">
                              <span
                                className={cn(
                                  "mt-1 h-3 w-3 shrink-0 rounded-full",
                                  campaign.status === "active" && "bg-emerald-500",
                                  campaign.status === "scheduled" && "bg-primary",
                                  campaign.status === "draft" && "bg-amber-500",
                                  campaign.status === "completed" && "bg-slate-400",
                                )}
                              />
                              <div className="min-w-0">
                                <p className="font-bold text-foreground">{itemText(campaign, "name", t)}</p>
                                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                                  {itemText(campaign, "objective", t)}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={cn("rounded-full text-xs ring-1", statusClasses(campaign.status))}>
                              {t(`campaigns.status.${campaign.status}`)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {itemText(campaign, "audience", t)}
                          </TableCell>
                          <TableCell className="text-sm">{t(`campaigns.channel.${campaign.channel}`)}</TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-muted-foreground">{campaign.contacted}/{campaign.total}</span>
                                <span className="font-bold text-foreground">{percent}%</span>
                              </div>
                              <Progress value={percent} className="h-2 bg-muted [&>div]:bg-primary" />
                            </div>
                          </TableCell>
                          <TableCell className={campaign.followUp > 20 ? "font-bold text-orange-600" : "font-bold"}>
                            {campaign.followUp}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{campaign.owner}</TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {selectedCampaign && (
          <Card className={cn("rounded-2xl border-border border-t-4 bg-white shadow-sm", toneClass(selectedCampaign.tone))}>
            <CardContent className="space-y-5 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
                    {t("campaigns.detail.title")}
                  </p>
                  <h2 className="mt-2 text-xl font-extrabold leading-tight text-foreground">
                    {itemText(selectedCampaign, "name", t)}
                  </h2>
                </div>
                <Badge className={cn("rounded-full text-xs ring-1", statusClasses(selectedCampaign.status))}>
                  {t(`campaigns.status.${selectedCampaign.status}`)}
                </Badge>
              </div>

              <p className="text-sm leading-6 text-muted-foreground">{itemText(selectedCampaign, "objective", t)}</p>

              <div className="grid grid-cols-2 gap-3">
                <DetailStat label={t("campaigns.detail.contacted")} value={selectedCampaign.contacted} />
                <DetailStat label={t("campaigns.detail.confirmed")} value={selectedCampaign.confirmed} />
                <DetailStat label={t("campaigns.detail.followUp")} value={selectedCampaign.followUp} />
                <DetailStat label={t("campaigns.detail.due")} value={t(selectedCampaign.dueKey)} />
              </div>

              <div className="rounded-2xl bg-primary/5 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">
                  {t("campaigns.detail.nextAction")}
                </p>
                <p className="mt-2 text-sm font-semibold text-foreground">{t("campaigns.detail.nextActionBody")}</p>
              </div>

              <div className="space-y-2">
                <Button className="w-full rounded-xl" onClick={() => handleLocalAction("campaigns.action.startLocal")}>
                  <Send className="mr-2 h-4 w-4" />
                  {t("campaigns.action.start")}
                </Button>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Button
                    variant="outline"
                    className="rounded-xl"
                    onClick={() => handleLocalAction("campaigns.action.duplicateLocal")}
                  >
                    <CopyPlus className="mr-2 h-4 w-4" />
                    {t("campaigns.action.duplicate")}
                  </Button>
                  <Button
                    variant="outline"
                    className="rounded-xl"
                    onClick={() => handleLocalAction("campaigns.action.exportLocal")}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    {t("campaigns.export")}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </section>

      {selectedCampaign && (
        <Card className="rounded-2xl border-border bg-white shadow-sm">
          <CardContent className="space-y-4 p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-extrabold text-foreground">{t("campaigns.targets.title")}</h2>
                  <Badge className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                    {t("campaigns.targets.preview")}
                  </Badge>
                </div>
                <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{t("campaigns.targets.subtitle")}</p>
              </div>
              <div className="rounded-full border border-border bg-muted/40 px-3 py-1.5 text-xs font-bold text-muted-foreground">
                {selectedTargets.length} {t("queue.cases")}
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border">
              <Table className="min-w-[900px]">
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="min-w-[220px]">{t("campaigns.targets.person")}</TableHead>
                    <TableHead>{t("campaigns.targets.status")}</TableHead>
                    <TableHead className="min-w-[220px]">{t("campaigns.targets.reason")}</TableHead>
                    <TableHead>{t("campaigns.targets.channel")}</TableHead>
                    <TableHead>{t("campaigns.targets.owner")}</TableHead>
                    <TableHead className="text-right">{t("campaigns.targets.action")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedTargets.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
                        {t("campaigns.targets.empty")}
                      </TableCell>
                    </TableRow>
                  ) : (
                    selectedTargets.map((target) => {
                      const name = userName(target.user);

                      return (
                        <TableRow
                          key={`${selectedCampaign.id}-${target.user.id}`}
                          className="cursor-pointer transition-colors hover:bg-primary/5"
                          onClick={() => navigate(`/users/${target.user.id}`)}
                        >
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                                {name.split(" ").map((part) => part[0]).join("").slice(0, 2)}
                              </div>
                              <div>
                                <p className="font-semibold text-foreground">{name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {target.city || t("usersList.cityUnknown")} - {t("campaigns.targets.riskScore").replace("{score}", String(target.score))}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={cn("rounded-full text-xs ring-1", targetStatusClasses(target.status))}>
                              {t(`campaigns.targets.status.${target.status}`)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="text-sm font-semibold text-foreground">{t(target.reasonKey)}</p>
                              <p className="text-xs text-muted-foreground">{t(`profile.status.${target.riskStatus}`)}</p>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{t(channelKey(target.channel))}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {target.owner ?? t("usersList.unassigned")}
                          </TableCell>
                          <TableCell className="text-right" onClick={(event) => event.stopPropagation()}>
                            <Button
                              type="button"
                              size="sm"
                              variant={target.action === "prepareCall" ? "default" : "outline"}
                              className="rounded-full px-4 text-xs font-bold"
                              onClick={() =>
                                navigate(target.action === "prepareCall" ? `/risk-queue/${target.user.id}/prepare-call` : `/users/${target.user.id}`)
                              }
                            >
                              {target.action === "prepareCall" ? (
                                <AlertTriangle className="mr-2 h-4 w-4" />
                              ) : (
                                <ArrowUpRight className="mr-2 h-4 w-4" />
                              )}
                              {t(target.action === "prepareCall" ? "campaigns.targets.action.prepareCall" : "campaigns.targets.action.openProfile")}
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
      )}

      <section className="grid gap-5 lg:grid-cols-2">
        <Card className="rounded-2xl border-border bg-white shadow-sm">
          <CardContent className="space-y-4 p-5">
            <h2 className="flex items-center gap-2 text-base font-extrabold uppercase tracking-[0.04em] text-foreground">
              <CalendarDays className="h-4 w-4 text-primary" />
              {t("campaigns.playbook.title")}
            </h2>
            {["identify", "message", "assign", "follow"].map((step, index) => (
              <div key={step} className="flex gap-3 border-b border-border/70 pb-3 last:border-b-0 last:pb-0">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
                  {index + 1}
                </span>
                <div>
                  <p className="text-sm font-bold text-foreground">{t(`campaigns.playbook.${step}.title`)}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{t(`campaigns.playbook.${step}.body`)}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border bg-white shadow-sm">
          <CardContent className="space-y-4 p-5">
            <h2 className="flex items-center gap-2 text-base font-extrabold uppercase tracking-[0.04em] text-foreground">
              <Users className="h-4 w-4 text-primary" />
              {t("campaigns.segments.title")}
            </h2>
            {([
              ["campaigns.segments.isolation", 18, "bg-primary"],
              ["campaigns.segments.medication", 8, "bg-orange-500"],
              ["campaigns.segments.safety", 58, "bg-red-500"],
              ["campaigns.segments.services", 12, "bg-emerald-500"],
            ] satisfies Array<[string, number, string]>).map(([key, value, dot]) => (
              <div key={String(key)} className="flex items-center justify-between border-b border-border/70 pb-3 last:border-b-0 last:pb-0">
                <span className="flex items-center gap-3 text-sm font-medium text-muted-foreground">
                  <span className={cn("h-3 w-3 rounded-full", dot)} />
                  {t(String(key))}
                </span>
                <span className="text-base font-bold text-foreground">{value}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("campaigns.form.title")}</DialogTitle>
            <DialogDescription>{t("campaigns.form.description")}</DialogDescription>
          </DialogHeader>

          <form
            ref={formRef}
            className="grid gap-4 py-2"
            onSubmit={(event) => {
              event.preventDefault();
              handleCreate();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="campaign-name">{t("campaigns.form.name")}</Label>
              <Input
                id="campaign-name"
                ref={nameRef}
                name="name"
                value={form.name}
                onChange={(event) => updateForm("name", event.target.value)}
                placeholder={t("campaigns.form.namePlaceholder")}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>{t("campaigns.form.type")}</Label>
                <Select value={form.type} onValueChange={(value) => updateForm("type", value as CampaignType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="safety">{t("campaigns.type.safety")}</SelectItem>
                    <SelectItem value="wellbeing">{t("campaigns.type.wellbeing")}</SelectItem>
                    <SelectItem value="medication">{t("campaigns.type.medication")}</SelectItem>
                    <SelectItem value="service">{t("campaigns.type.service")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{t("campaigns.form.channel")}</Label>
                <Select value={form.channel} onValueChange={(value) => updateForm("channel", value as CampaignChannel)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="phone">{t("campaigns.channel.phone")}</SelectItem>
                    <SelectItem value="whatsapp">{t("campaigns.channel.whatsapp")}</SelectItem>
                    <SelectItem value="mixed">{t("campaigns.channel.mixed")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="campaign-city">{t("campaigns.form.city")}</Label>
                <Input
                  id="campaign-city"
                  ref={cityRef}
                  name="city"
                  value={form.city}
                  onChange={(event) => updateForm("city", event.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="campaign-audience">{t("campaigns.form.audience")}</Label>
              <Input
                id="campaign-audience"
                ref={audienceRef}
                name="audience"
                value={form.audience}
                onChange={(event) => updateForm("audience", event.target.value)}
                placeholder={t("campaigns.form.audiencePlaceholder")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="campaign-objective">{t("campaigns.form.objective")}</Label>
              <Textarea
                id="campaign-objective"
                ref={objectiveRef}
                name="objective"
                value={form.objective}
                onChange={(event) => updateForm("objective", event.target.value)}
                placeholder={t("campaigns.form.objectivePlaceholder")}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                {t("campaigns.form.cancel")}
              </Button>
              <Button type="button" onClick={handleCreate}>
                {t("campaigns.form.create")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MetricCard({
  accent,
  icon: Icon,
  label,
  value,
}: {
  accent: Campaign["tone"];
  icon: LucideIcon;
  label: string;
  value: number;
}) {
  const accentClass = toneClass(accent);

  return (
    <Card className={cn("rounded-2xl border-border border-t-4 bg-white shadow-sm", accentClass)}>
      <CardContent className="flex h-28 items-center justify-between gap-4 p-5">
        <div>
          <p className="text-xs font-bold uppercase leading-snug tracking-[0.18em] text-muted-foreground">{label}</p>
          <p className={cn("mt-2 text-4xl font-extrabold leading-none tracking-tight", accentClass)}>{value}</p>
        </div>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}

function DetailStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl border border-border bg-muted/30 p-3">
      <p className="text-xs font-semibold text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-extrabold text-foreground">{value}</p>
    </div>
  );
}
