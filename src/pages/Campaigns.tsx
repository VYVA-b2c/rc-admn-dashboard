import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock,
  CopyPlus,
  Download,
  Megaphone,
  Pencil,
  PhoneCall,
  Plus,
  Radio,
  Search,
  Send,
  Share2,
  ShieldCheck,
  Sparkles,
  Users,
  XCircle,
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
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAdminRole } from "@/hooks/useAdminRole";
import { toast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/apiClient";
import { authBypassEnabled } from "@/lib/authMode";
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
type CampaignExecutionType = "manual" | "vyva_call";
type CampaignTargetStatus = "pending" | "contacted" | "confirmed" | "followUp";
type CampaignCallRunStatus = "draft" | "scheduled" | "queued" | "running" | "completed" | "cancelled" | "failed";

type Campaign = {
  id: string;
  slug?: string;
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
  scheduledAt?: string | null;
  callScript?: string;
  callWindowStart?: string;
  callWindowEnd?: string;
  retryLimit?: number;
  executionType?: CampaignExecutionType;
  total: number;
  contacted: number;
  confirmed: number;
  followUp: number;
  tone: "purple" | "orange" | "green" | "red";
  targets?: CampaignTarget[];
};

type FormState = {
  name: string;
  type: CampaignType;
  audience: string;
  city: string;
  channel: CampaignChannel;
  objective: string;
  executionType: CampaignExecutionType;
  scheduledAt: string;
  callScript: string;
  callWindowStart: string;
  callWindowEnd: string;
  retryLimit: number;
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

type CampaignPayload = {
  audience: string;
  channel: CampaignChannel;
  city: string;
  callScript?: string | null;
  callWindowEnd?: string;
  callWindowStart?: string;
  dueKey: string;
  executionType?: CampaignExecutionType;
  name: string;
  objective: string;
  owner: string;
  retryLimit?: number;
  scheduledAt?: string | null;
  status: CampaignStatus;
  type: CampaignType;
};

type CampaignAssistantDraft = {
  audience: string;
  callScript: string;
  name: string;
  objective: string;
  operatorFocus: string[];
};

type CampaignCallRun = {
  id: string;
  campaignId: string;
  status: CampaignCallRunStatus;
  scheduledAt?: string | null;
  eligibleCount: number;
  skippedCount: number;
  queuedCount: number;
  pendingCount: number;
  callingCount: number;
  completedCount: number;
  failedCount: number;
  cancelledCount: number;
  callScript?: string;
  callWindowStart?: string;
  callWindowEnd?: string;
  retryLimit?: number;
  createdAt?: string | null;
};

type CampaignCallPreview = {
  campaignId: string;
  scheduledAt?: string | null;
  callWindowStart: string;
  callWindowEnd: string;
  retryLimit: number;
  callScript: string;
  eligibleCount: number;
  skippedCount: number;
  skipped: {
    noPhone: number;
    noConsent: number;
    outsideCallWindow: number;
    duplicateTarget: number;
  };
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

function callRunStatusClasses(status: CampaignCallRunStatus) {
  switch (status) {
    case "scheduled":
      return "bg-primary/10 text-primary ring-primary/20";
    case "queued":
    case "running":
      return "bg-orange-50 text-orange-700 ring-orange-200";
    case "completed":
      return "bg-emerald-50 text-emerald-700 ring-emerald-200";
    case "cancelled":
    case "failed":
      return "bg-red-50 text-red-700 ring-red-200";
    case "draft":
      return "bg-slate-100 text-slate-700 ring-slate-200";
  }
}

function callRunCompletion(run?: CampaignCallRun) {
  if (!run || run.eligibleCount <= 0) return 0;
  return Math.round(((run.completedCount + run.failedCount + run.cancelledCount) / run.eligibleCount) * 100);
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
  executionType: "manual",
  scheduledAt: "",
  callScript: "",
  callWindowStart: "09:00",
  callWindowEnd: "18:00",
  retryLimit: 1,
};

const campaignAssistantKeys: Record<CampaignType, { audience: string; callScript: string; name: string; objective: string; focus: [string, string, string] }> = {
  safety: {
    audience: "campaigns.ai.safety.audience",
    callScript: "campaigns.ai.safety.callScript",
    name: "campaigns.ai.safety.name",
    objective: "campaigns.ai.safety.objective",
    focus: ["campaigns.ai.safety.focus1", "campaigns.ai.safety.focus2", "campaigns.ai.safety.focus3"],
  },
  wellbeing: {
    audience: "campaigns.ai.wellbeing.audience",
    callScript: "campaigns.ai.wellbeing.callScript",
    name: "campaigns.ai.wellbeing.name",
    objective: "campaigns.ai.wellbeing.objective",
    focus: ["campaigns.ai.wellbeing.focus1", "campaigns.ai.wellbeing.focus2", "campaigns.ai.wellbeing.focus3"],
  },
  medication: {
    audience: "campaigns.ai.medication.audience",
    callScript: "campaigns.ai.medication.callScript",
    name: "campaigns.ai.medication.name",
    objective: "campaigns.ai.medication.objective",
    focus: ["campaigns.ai.medication.focus1", "campaigns.ai.medication.focus2", "campaigns.ai.medication.focus3"],
  },
  service: {
    audience: "campaigns.ai.service.audience",
    callScript: "campaigns.ai.service.callScript",
    name: "campaigns.ai.service.name",
    objective: "campaigns.ai.service.objective",
    focus: ["campaigns.ai.service.focus1", "campaigns.ai.service.focus2", "campaigns.ai.service.focus3"],
  },
};

function fillTemplate(template: string, values: Record<string, string>) {
  return Object.entries(values).reduce((text, [key, value]) => text.replaceAll(`{${key}}`, value), template);
}

function toDateTimeLocal(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function toIsoOrNull(value: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function formatSchedule(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default function Campaigns() {
  const { t } = useLanguage();
  const { isAdmin } = useAdminRole();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [localCampaigns, setLocalCampaigns] = useState<Campaign[]>(initialCampaigns);
  const [selectedId, setSelectedId] = useState(initialCampaigns[0].id);
  const [statusFilter, setStatusFilter] = useState<CampaignStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(defaultForm);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [assistantDraft, setAssistantDraft] = useState<CampaignAssistantDraft | null>(null);
  const [callPreview, setCallPreview] = useState<CampaignCallPreview | null>(null);
  const [callPreviewCampaignId, setCallPreviewCampaignId] = useState<string | null>(null);
  const [callPreviewPayload, setCallPreviewPayload] = useState<CampaignPayload | null>(null);
  const [callPreviewOpen, setCallPreviewOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const cityRef = useRef<HTMLInputElement>(null);
  const audienceRef = useRef<HTMLInputElement>(null);
  const objectiveRef = useRef<HTMLTextAreaElement>(null);
  const canManageCallCampaigns = isAdmin && !authBypassEnabled;

  const { data: campaignData } = useQuery({
    queryKey: ["campaigns-dashboard", "campaigns"],
    queryFn: async (): Promise<{ campaigns: Campaign[] } | null> => {
      try {
        return await apiFetch<{ campaigns: Campaign[] }>("/api/v1/campaigns-dashboard/campaigns", { timeoutMs: 1500 });
      } catch (error) {
        console.warn("Campaigns API unavailable:", error instanceof Error ? error.message : error);
        return null;
      }
    },
    retry: false,
  });

  const createCampaignMutation = useMutation({
    mutationFn: (payload: CampaignPayload) =>
      apiFetch<{ campaign: Campaign }>("/api/v1/campaigns-dashboard/campaigns", {
        method: "POST",
        body: JSON.stringify(payload),
        timeoutMs: 1500,
      }),
    onSuccess: (data) => {
      if (data.campaign?.id) setSelectedId(data.campaign.id);
      queryClient.invalidateQueries({ queryKey: ["campaigns-dashboard", "campaigns"] });
    },
  });

  const updateCampaignMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: CampaignPayload }) =>
      apiFetch<{ campaign: Campaign }>(`/api/v1/campaigns-dashboard/campaigns/${id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
        timeoutMs: 1500,
      }),
    onSuccess: (data) => {
      if (data.campaign?.id) setSelectedId(data.campaign.id);
      queryClient.invalidateQueries({ queryKey: ["campaigns-dashboard", "campaigns"] });
    },
  });

  const previewCallRunMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: CampaignPayload }) =>
      apiFetch<{ preview: CampaignCallPreview }>(`/api/v1/campaigns-dashboard/campaigns/${id}/call-runs/preview`, {
        method: "POST",
        body: JSON.stringify(payload),
        timeoutMs: 3500,
      }),
  });

  const createCallRunMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: CampaignPayload }) =>
      apiFetch<{ run: CampaignCallRun; preview: CampaignCallPreview }>(`/api/v1/campaigns-dashboard/campaigns/${id}/call-runs`, {
        method: "POST",
        body: JSON.stringify(payload),
        timeoutMs: 3500,
      }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["campaigns-dashboard", "call-runs", variables.id] });
      queryClient.invalidateQueries({ queryKey: ["campaigns-dashboard", "campaigns"] });
    },
  });

  const cancelCallRunMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ run: CampaignCallRun }>(`/api/v1/campaigns-dashboard/call-runs/${id}/cancel`, {
        method: "POST",
        timeoutMs: 3500,
      }),
    onSuccess: () => {
      if (selectedCampaign?.id) {
        queryClient.invalidateQueries({ queryKey: ["campaigns-dashboard", "call-runs", selectedCampaign.id] });
      }
    },
  });

  const campaigns = campaignData?.campaigns?.length ? campaignData.campaigns : localCampaigns;
  const savingCampaign =
    createCampaignMutation.isPending ||
    updateCampaignMutation.isPending ||
    previewCallRunMutation.isPending ||
    createCallRunMutation.isPending;

  useEffect(() => {
    if (searchParams.get("create") !== "1") return;
    setDialogOpen(true);
    setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (campaigns.length === 0) return;
    if (!campaigns.some((campaign) => campaign.id === selectedId)) {
      setSelectedId(campaigns[0].id);
    }
  }, [campaigns, selectedId]);

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
    () => (selectedCampaign?.targets?.length ? selectedCampaign.targets : selectedCampaign ? campaignTargets(selectedCampaign) : []),
    [selectedCampaign],
  );
  const { data: callRunData } = useQuery({
    queryKey: ["campaigns-dashboard", "call-runs", selectedCampaign?.id],
    enabled: Boolean(selectedCampaign?.id) && !authBypassEnabled,
    retry: false,
    queryFn: async (): Promise<{ runs: CampaignCallRun[] }> =>
      apiFetch<{ runs: CampaignCallRun[] }>(`/api/v1/campaigns-dashboard/campaigns/${selectedCampaign!.id}/call-runs`, {
        timeoutMs: 3500,
      }),
  });
  const callRuns = callRunData?.runs ?? [];
  const latestCallRun = callRuns[0];

  const buildAssistantDraft = (currentForm: FormState): CampaignAssistantDraft => {
    const city = currentForm.city.trim() || "Madrid";
    const channel = t(`campaigns.channel.${currentForm.channel}`).toLowerCase();
    const keys = campaignAssistantKeys[currentForm.type];
    const values = { city, channel };

    return {
      name: fillTemplate(t(keys.name), values),
      audience: fillTemplate(t(keys.audience), values),
      objective: fillTemplate(t(keys.objective), values),
      callScript: fillTemplate(t(keys.callScript), values),
      operatorFocus: keys.focus.map((key) => fillTemplate(t(key), values)),
    };
  };

  const openAssistant = () => {
    const draft = buildAssistantDraft(form);
    setAssistantDraft(draft);
    setAssistantOpen(true);
  };

  const applyAssistantDraft = () => {
    if (!assistantDraft) return;
    setForm((current) => ({
      ...current,
      name: assistantDraft.name,
      audience: assistantDraft.audience,
      objective: assistantDraft.objective,
      callScript: assistantDraft.callScript,
    }));
    toast({
      title: t("campaigns.ai.appliedTitle"),
      description: t("campaigns.ai.appliedDescription"),
    });
  };

  const openCreateDialog = () => {
    setEditingId(null);
    setForm(defaultForm);
    setAssistantOpen(false);
    setAssistantDraft(null);
    setDialogOpen(true);
  };

  const openEditDialog = () => {
    if (!selectedCampaign) return;
    setEditingId(selectedCampaign.id);
    setForm({
      name: itemText(selectedCampaign, "name", t),
      type: selectedCampaign.type,
      audience: itemText(selectedCampaign, "audience", t),
      city: selectedCampaign.city || "Madrid",
      channel: selectedCampaign.channel,
      objective: itemText(selectedCampaign, "objective", t),
      executionType: selectedCampaign.executionType === "vyva_call" ? "vyva_call" : "manual",
      scheduledAt: toDateTimeLocal(selectedCampaign.scheduledAt),
      callScript: selectedCampaign.callScript || "",
      callWindowStart: selectedCampaign.callWindowStart || "09:00",
      callWindowEnd: selectedCampaign.callWindowEnd || "18:00",
      retryLimit: selectedCampaign.retryLimit ?? 1,
    });
    setAssistantOpen(false);
    setAssistantDraft(null);
    setDialogOpen(true);
  };

  const updateForm = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const buildCampaignPayload = (status: CampaignStatus): CampaignPayload | null => {
    const name = (nameRef.current?.value ?? form.name).trim();
    const audience = (audienceRef.current?.value ?? form.audience).trim();
    const city = (cityRef.current?.value ?? form.city).trim();
    const objective = (objectiveRef.current?.value ?? form.objective).trim();

    if (!name) {
      toast({ title: t("campaigns.validation.name"), variant: "destructive" });
      return null;
    }

    const isCallCampaign = form.executionType === "vyva_call";
    const callScript = form.callScript.trim() || objective || t("campaigns.call.defaultScript");
    return {
      audience,
      channel: form.channel,
      city: city || "Madrid",
      callScript: isCallCampaign ? callScript : null,
      callWindowEnd: form.callWindowEnd || "18:00",
      callWindowStart: form.callWindowStart || "09:00",
      dueKey:
        status === "active"
          ? "campaigns.due.today"
          : status === "scheduled"
            ? "campaigns.due.scheduled"
            : editingId && selectedCampaign
              ? selectedCampaign.dueKey
              : "campaigns.due.draft",
      executionType: form.executionType,
      name,
      objective: objective || t("campaigns.defaultObjective"),
      owner: t("layout.operatorName"),
      retryLimit: form.retryLimit,
      scheduledAt: isCallCampaign ? toIsoOrNull(form.scheduledAt) : null,
      status,
      type: form.type,
    };
  };

  const saveCampaign = async (status: CampaignStatus, options: { previewCalls?: boolean } = {}) => {
    if (options.previewCalls && !canManageCallCampaigns) {
      toast({
        title: t("campaigns.call.adminOnlyTitle"),
        description: t(authBypassEnabled ? "campaigns.call.previewReadOnly" : "campaigns.call.adminOnlyDescription"),
        variant: "destructive",
      });
      return;
    }

    const payload = buildCampaignPayload(status);
    if (!payload) return;

    if (options.previewCalls && payload.executionType !== "vyva_call") {
      payload.executionType = "vyva_call";
    }

    if (options.previewCalls && !payload.callScript?.trim()) {
      toast({ title: t("campaigns.call.scriptRequired"), variant: "destructive" });
      return;
    }

    try {
      let savedCampaign: Campaign | undefined;
      if (editingId) {
        const result = await updateCampaignMutation.mutateAsync({ id: editingId, payload });
        savedCampaign = result.campaign;
      } else {
        const result = await createCampaignMutation.mutateAsync(payload);
        savedCampaign = result.campaign;
      }
      const savedId = savedCampaign?.id ?? editingId;
      if (savedId) setSelectedId(savedId);
      setDialogOpen(false);
      setEditingId(null);

      if (options.previewCalls && savedId) {
        const previewResult = await previewCallRunMutation.mutateAsync({ id: savedId, payload });
        setCallPreview(previewResult.preview);
        setCallPreviewCampaignId(savedId);
        setCallPreviewPayload(payload);
        setCallPreviewOpen(true);
        return;
      }

      toast({
        title: t("campaigns.action.ready"),
        description: t(
          status === "draft"
            ? "campaigns.action.draftSaved"
            : status === "scheduled"
              ? "campaigns.action.scheduledSaved"
              : "campaigns.action.publishedSaved",
        ),
      });
    } catch (error) {
      const fallbackCampaign: Campaign = {
        id: editingId || `local-${Date.now()}`,
        name: payload.name,
        objective: payload.objective,
        audience: payload.audience || t("campaigns.defaultAudience"),
        dueKey: payload.dueKey,
        city: payload.city,
        owner: payload.owner,
        type: payload.type,
        status: payload.status,
        channel: payload.channel,
        scheduledAt: payload.scheduledAt,
        callScript: payload.callScript || "",
        callWindowStart: payload.callWindowStart,
        callWindowEnd: payload.callWindowEnd,
        retryLimit: payload.retryLimit,
        executionType: payload.executionType,
        total: selectedCampaign?.total ?? 0,
        contacted: selectedCampaign?.contacted ?? 0,
        confirmed: selectedCampaign?.confirmed ?? 0,
        followUp: selectedCampaign?.followUp ?? 0,
        tone: selectedCampaign?.tone ?? "purple",
      };

      setLocalCampaigns((current) =>
        editingId
          ? current.map((campaign) => (campaign.id === editingId ? fallbackCampaign : campaign))
          : [fallbackCampaign, ...current],
      );
      setSelectedId(fallbackCampaign.id);
      setDialogOpen(false);
      setEditingId(null);
      console.warn("Campaign save API unavailable:", error instanceof Error ? error.message : error);
      toast({
        title: t("campaigns.action.ready"),
        description: t(editingId ? "campaigns.action.updatedLocal" : "campaigns.action.createdLocal"),
      });
    }
  };

  const copyBrief = async (payload: CampaignPayload) => {
    const brief = [
      `${t("campaigns.share.title")}: ${payload.name}`,
      `${t("campaigns.form.type")}: ${t(`campaigns.type.${payload.type}`)}`,
      `${t("campaigns.form.channel")}: ${t(`campaigns.channel.${payload.channel}`)}`,
      `${t("campaigns.form.city")}: ${payload.city}`,
      `${t("campaigns.form.audience")}: ${payload.audience || t("campaigns.defaultAudience")}`,
      `${t("campaigns.form.objective")}: ${payload.objective}`,
      payload.executionType === "vyva_call" ? `${t("campaigns.call.script")}: ${payload.callScript}` : "",
      payload.scheduledAt ? `${t("campaigns.call.schedule")}: ${formatSchedule(payload.scheduledAt)}` : "",
    ].filter(Boolean).join("\n");

    try {
      await navigator.clipboard.writeText(brief);
      toast({ title: t("campaigns.share.copiedTitle"), description: t("campaigns.share.copiedDescription") });
    } catch {
      toast({ title: t("campaigns.share.copyFailed"), variant: "destructive" });
    }
  };

  const handleShareBrief = async () => {
    const payload = buildCampaignPayload(editingId && selectedCampaign ? selectedCampaign.status : "draft");
    if (!payload) return;
    await copyBrief(payload);
  };

  const handleShareSelectedCampaign = async (campaign: Campaign) => {
    await copyBrief({
      audience: itemText(campaign, "audience", t),
      channel: campaign.channel,
      city: campaign.city,
      callScript: campaign.callScript || "",
      callWindowEnd: campaign.callWindowEnd,
      callWindowStart: campaign.callWindowStart,
      dueKey: campaign.dueKey,
      executionType: campaign.executionType || "manual",
      name: itemText(campaign, "name", t),
      objective: itemText(campaign, "objective", t),
      owner: campaign.owner,
      retryLimit: campaign.retryLimit,
      scheduledAt: campaign.scheduledAt,
      status: campaign.status,
      type: campaign.type,
    });
  };

  const handleConfirmCallRun = async () => {
    if (!callPreviewCampaignId || !callPreviewPayload || !callPreview) return;
    if (!canManageCallCampaigns) {
      toast({ title: t("campaigns.call.adminOnlyTitle"), variant: "destructive" });
      return;
    }
    if (callPreview.eligibleCount < 1) {
      toast({ title: t("campaigns.call.noEligibleTitle"), description: t("campaigns.call.noEligibleDescription"), variant: "destructive" });
      return;
    }

    try {
      await createCallRunMutation.mutateAsync({ id: callPreviewCampaignId, payload: callPreviewPayload });
      setCallPreviewOpen(false);
      setCallPreview(null);
      setCallPreviewCampaignId(null);
      setCallPreviewPayload(null);
      toast({ title: t("campaigns.call.queuedTitle"), description: t("campaigns.call.queuedDescription") });
    } catch {
      toast({ title: t("campaigns.call.queueFailed"), variant: "destructive" });
    }
  };

  const handleCancelLatestRun = async () => {
    if (!latestCallRun || !canManageCallCampaigns) return;
    try {
      await cancelCallRunMutation.mutateAsync(latestCallRun.id);
      toast({ title: t("campaigns.call.cancelledTitle"), description: t("campaigns.call.cancelledDescription") });
    } catch {
      toast({ title: t("campaigns.call.cancelFailed"), variant: "destructive" });
    }
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
                          <TableCell className="text-sm">
                            <div className="flex flex-col gap-1">
                              <span>{t(`campaigns.channel.${campaign.channel}`)}</span>
                              {campaign.executionType === "vyva_call" && (
                                <span className="inline-flex w-fit items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">
                                  <Radio className="h-3 w-3" />
                                  {t("campaigns.call.badge")}
                                </span>
                              )}
                            </div>
                          </TableCell>
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
                <DetailStat
                  label={t("campaigns.detail.due")}
                  value={selectedCampaign.scheduledAt ? formatSchedule(selectedCampaign.scheduledAt) : t(selectedCampaign.dueKey)}
                />
              </div>

              {selectedCampaign.executionType === "vyva_call" || latestCallRun ? (
                <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-primary">
                        <Radio className="h-4 w-4" />
                        {t("campaigns.call.queueTitle")}
                      </p>
                      <p className="mt-2 text-sm font-semibold text-foreground">
                        {latestCallRun?.scheduledAt
                          ? t("campaigns.call.scheduledFor").replace("{date}", formatSchedule(latestCallRun.scheduledAt))
                          : t("campaigns.call.noRunYet")}
                      </p>
                    </div>
                    {latestCallRun && (
                      <Badge className={cn("rounded-full text-xs ring-1", callRunStatusClasses(latestCallRun.status))}>
                        {t(`campaigns.call.status.${latestCallRun.status}`)}
                      </Badge>
                    )}
                  </div>

                  {latestCallRun ? (
                    <div className="mt-4 space-y-3">
                      <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                        <MiniStat label={t("campaigns.call.eligible")} value={latestCallRun.eligibleCount} />
                        <MiniStat label={t("campaigns.call.pending")} value={latestCallRun.pendingCount + latestCallRun.queuedCount} />
                        <MiniStat label={t("campaigns.call.completed")} value={latestCallRun.completedCount} />
                        <MiniStat label={t("campaigns.call.skipped")} value={latestCallRun.skippedCount} />
                      </div>
                      <Progress value={callRunCompletion(latestCallRun)} className="h-2 bg-white [&>div]:bg-primary" />
                      {canManageCallCampaigns && ["scheduled", "queued"].includes(latestCallRun.status) && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-9 rounded-full border-red-200 bg-white text-xs font-bold text-red-600 hover:bg-red-50 hover:text-red-700"
                          onClick={handleCancelLatestRun}
                          disabled={cancelCallRunMutation.isPending}
                        >
                          <XCircle className="mr-2 h-4 w-4" />
                          {t("campaigns.call.cancelRun")}
                        </Button>
                      )}
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-muted-foreground">{t("campaigns.call.noRunDescription")}</p>
                  )}
                </div>
              ) : (
                <div className="rounded-2xl bg-primary/5 p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">
                    {t("campaigns.detail.nextAction")}
                  </p>
                  <p className="mt-2 text-sm font-semibold text-foreground">{t("campaigns.detail.nextActionBody")}</p>
                </div>
              )}

              <div className="space-y-2">
                <Button className="w-full rounded-xl" onClick={openEditDialog}>
                  <Pencil className="mr-2 h-4 w-4" />
                  {t("campaigns.action.edit")}
                </Button>
                <div className="grid gap-2 sm:grid-cols-3">
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
                    onClick={() => handleShareSelectedCampaign(selectedCampaign)}
                  >
                    <Share2 className="mr-2 h-4 w-4" />
                    {t("campaigns.share.button")}
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

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setEditingId(null);
            setAssistantOpen(false);
            setAssistantDraft(null);
          }
        }}
      >
        <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t(editingId ? "campaigns.form.editTitle" : "campaigns.form.title")}</DialogTitle>
            <DialogDescription>
              {t(editingId ? "campaigns.form.editDescription" : "campaigns.form.description")}
            </DialogDescription>
          </DialogHeader>

          <form
            ref={formRef}
            className="grid gap-4 py-2"
            onSubmit={(event) => {
              event.preventDefault();
              saveCampaign("draft");
            }}
          >
            <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-white">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground">{t("campaigns.ai.title")}</p>
                    <p className="mt-1 text-sm leading-5 text-muted-foreground">{t("campaigns.ai.description")}</p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 shrink-0 rounded-full border-primary/20 bg-white px-3 text-xs font-bold text-primary hover:bg-primary/10 hover:text-primary"
                  onClick={openAssistant}
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  {t(assistantOpen ? "campaigns.ai.regenerate" : "campaigns.ai.open")}
                </Button>
              </div>

              {assistantOpen && assistantDraft && (
                <div className="mt-4 grid gap-3 rounded-xl border border-primary/10 bg-white p-4 shadow-sm">
                  <div className="grid gap-3 md:grid-cols-3">
                    <AssistantSuggestion label={t("campaigns.form.name")} value={assistantDraft.name} />
                    <AssistantSuggestion label={t("campaigns.form.audience")} value={assistantDraft.audience} />
                    <AssistantSuggestion label={t("campaigns.form.objective")} value={assistantDraft.objective} />
                  </div>
                  <AssistantSuggestion label={t("campaigns.call.script")} value={assistantDraft.callScript} />
                  <div className="rounded-xl bg-muted/45 p-3">
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
                      {t("campaigns.ai.operatorFocus")}
                    </p>
                    <ul className="mt-2 grid gap-2 text-sm text-muted-foreground md:grid-cols-3">
                      {assistantDraft.operatorFocus.map((item) => (
                        <li key={item} className="flex gap-2">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="flex justify-end">
                    <Button type="button" className="h-9 rounded-full px-4 text-xs font-bold" onClick={applyAssistantDraft}>
                      {t("campaigns.ai.apply")}
                    </Button>
                  </div>
                </div>
              )}
            </div>

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

            <div className="rounded-2xl border border-border bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Radio className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground">{t("campaigns.call.panelTitle")}</p>
                    <p className="mt-1 text-sm leading-5 text-muted-foreground">
                      {canManageCallCampaigns ? t("campaigns.call.panelDescription") : t("campaigns.call.adminOnlyDescription")}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
                    {t("campaigns.call.enable")}
                  </span>
                  <Switch
                    checked={form.executionType === "vyva_call"}
                    disabled={!canManageCallCampaigns}
                    onCheckedChange={(checked) => updateForm("executionType", checked ? "vyva_call" : "manual")}
                  />
                </div>
              </div>

              {authBypassEnabled && (
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-medium text-amber-800">
                  {t("campaigns.call.previewReadOnly")}
                </div>
              )}

              {form.executionType === "vyva_call" && (
                <div className="mt-4 grid gap-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="campaign-scheduled-at">{t("campaigns.call.schedule")}</Label>
                      <Input
                        id="campaign-scheduled-at"
                        type="datetime-local"
                        value={form.scheduledAt}
                        onChange={(event) => updateForm("scheduledAt", event.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="campaign-retry-limit">{t("campaigns.call.retryLimit")}</Label>
                      <Input
                        id="campaign-retry-limit"
                        type="number"
                        min={0}
                        max={5}
                        value={form.retryLimit}
                        onChange={(event) => updateForm("retryLimit", Number(event.target.value))}
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="campaign-window-start">{t("campaigns.call.windowStart")}</Label>
                      <Input
                        id="campaign-window-start"
                        type="time"
                        value={form.callWindowStart}
                        onChange={(event) => updateForm("callWindowStart", event.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="campaign-window-end">{t("campaigns.call.windowEnd")}</Label>
                      <Input
                        id="campaign-window-end"
                        type="time"
                        value={form.callWindowEnd}
                        onChange={(event) => updateForm("callWindowEnd", event.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="campaign-call-script">{t("campaigns.call.script")}</Label>
                    <Textarea
                      id="campaign-call-script"
                      value={form.callScript}
                      onChange={(event) => updateForm("callScript", event.target.value)}
                      placeholder={t("campaigns.call.scriptPlaceholder")}
                      rows={4}
                    />
                    <p className="text-xs text-muted-foreground">{t("campaigns.call.scriptHelp")}</p>
                  </div>

                  <div className="grid gap-3 rounded-xl bg-muted/40 p-3 text-sm sm:grid-cols-3">
                    <div className="flex items-center gap-2 font-semibold text-foreground">
                      <ShieldCheck className="h-4 w-4 text-emerald-600" />
                      {t("campaigns.call.consentOnly")}
                    </div>
                    <div className="flex items-center gap-2 font-semibold text-foreground">
                      <Clock className="h-4 w-4 text-primary" />
                      {t("campaigns.call.windowGuard")}
                    </div>
                    <div className="flex items-center gap-2 font-semibold text-foreground">
                      <XCircle className="h-4 w-4 text-red-500" />
                      {t("campaigns.call.noRealCalls")}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="gap-2 sm:justify-between">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                {t("campaigns.form.cancel")}
              </Button>
              <div className="flex flex-wrap justify-end gap-2">
                <Button type="button" variant="outline" onClick={handleShareBrief}>
                  <Share2 className="mr-2 h-4 w-4" />
                  {t("campaigns.share.button")}
                </Button>
                <Button type="button" variant="outline" onClick={() => saveCampaign("draft")} disabled={savingCampaign}>
                  {t("campaigns.action.saveDraft")}
                </Button>
                {form.executionType === "vyva_call" && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => saveCampaign("scheduled", { previewCalls: true })}
                    disabled={savingCampaign || !canManageCallCampaigns}
                  >
                    <CalendarDays className="mr-2 h-4 w-4" />
                    {t("campaigns.action.scheduleCalls")}
                  </Button>
                )}
                <Button
                  type="button"
                  onClick={() => saveCampaign("active", { previewCalls: form.executionType === "vyva_call" })}
                  disabled={savingCampaign || (form.executionType === "vyva_call" && !canManageCallCampaigns)}
                >
                  <Send className="mr-2 h-4 w-4" />
                  {form.executionType === "vyva_call" ? t("campaigns.action.publishQueue") : t("campaigns.action.publish")}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={callPreviewOpen} onOpenChange={setCallPreviewOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("campaigns.call.confirmTitle")}</DialogTitle>
            <DialogDescription>{t("campaigns.call.confirmDescription")}</DialogDescription>
          </DialogHeader>

          {callPreview && (
            <div className="space-y-4 py-2">
              <div className="grid gap-3 sm:grid-cols-3">
                <PreviewStat tone="green" label={t("campaigns.call.eligible")} value={callPreview.eligibleCount} />
                <PreviewStat tone="red" label={t("campaigns.call.skipped")} value={callPreview.skippedCount} />
                <PreviewStat
                  tone="purple"
                  label={t("campaigns.call.schedule")}
                  value={callPreview.scheduledAt ? formatSchedule(callPreview.scheduledAt) : t("campaigns.call.immediateQueue")}
                />
              </div>

              <div className="rounded-2xl border bg-muted/30 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
                  {t("campaigns.call.skipReasons")}
                </p>
                <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                  <MiniStat label={t("campaigns.call.noPhone")} value={callPreview.skipped.noPhone} />
                  <MiniStat label={t("campaigns.call.noConsent")} value={callPreview.skipped.noConsent} />
                  <MiniStat label={t("campaigns.call.outsideWindow")} value={callPreview.skipped.outsideCallWindow} />
                  <MiniStat label={t("campaigns.call.duplicateTarget")} value={callPreview.skipped.duplicateTarget} />
                </div>
              </div>

              <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">
                  {t("campaigns.call.scriptPreview")}
                </p>
                <p className="mt-2 whitespace-pre-line text-sm leading-6 text-foreground">
                  {callPreview.callScript || t("campaigns.call.defaultScript")}
                </p>
              </div>

              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-medium text-amber-900">
                {t("campaigns.call.noRealCalls")}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCallPreviewOpen(false)}>
              {t("campaigns.form.cancel")}
            </Button>
            <Button
              type="button"
              onClick={handleConfirmCallRun}
              disabled={!callPreview || callPreview.eligibleCount < 1 || createCallRunMutation.isPending}
            >
              <Radio className="mr-2 h-4 w-4" />
              {t("campaigns.call.confirmQueue")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AssistantSuggestion({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-muted/30 p-3">
      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-sm font-semibold leading-5 text-foreground">{value}</p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl bg-white/75 px-3 py-2">
      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-base font-extrabold text-foreground">{value}</p>
    </div>
  );
}

function PreviewStat({ label, tone, value }: { label: string; tone: "green" | "purple" | "red"; value: number | string }) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-4",
        tone === "green" && "border-emerald-200 bg-emerald-50 text-emerald-700",
        tone === "purple" && "border-primary/20 bg-primary/5 text-primary",
        tone === "red" && "border-red-200 bg-red-50 text-red-700",
      )}
    >
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] opacity-80">{label}</p>
      <p className="mt-2 text-2xl font-extrabold leading-tight">{value}</p>
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
