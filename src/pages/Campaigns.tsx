import { type ReactNode, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import {
  CalendarClock,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Clock3,
  Flame,
  MapPin,
  Megaphone,
  PhoneCall,
  Plus,
  Search,
  Sparkles,
  ShieldAlert,
} from "lucide-react";

import { StatCard } from "@/components/StatCard";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAdminRole } from "@/hooks/useAdminRole";
import { useGISData, type GISUser } from "@/hooks/useGISData";
import { toast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/apiClient";
import { authBypassEnabled } from "@/lib/authMode";
import { demoOperationalUsers } from "@/lib/operationalDemoData";
import { cn } from "@/lib/utils";

type TemplateKey =
  | "general_announcement"
  | "heatwave_alert"
  | "medication_reminder"
  | "wellbeing_check"
  | "service_update"
  | "custom_campaign";

type CampaignState = "draft" | "scheduled" | "queued" | "completed" | "cancelled" | "failed";
type FilterKey = "all" | CampaignState;
type PreviewAction = "preview" | "schedule" | "queue";
type WizardStep = 1 | 2 | 3 | 4;

type Campaign = {
  id: string;
  name: string;
  objective?: string | null;
  audience?: string | null;
  city?: string | null;
  targetRules?: CampaignTargetRules | null;
  status: string;
  type?: string | null;
  templateKey?: TemplateKey;
  scheduledAt?: string | null;
  callScript?: string | null;
  callWindowStart?: string | null;
  callWindowEnd?: string | null;
  retryLimit?: number | null;
  executionType?: string | null;
  latestRun?: CallRun | null;
};

type CallRun = {
  id: string;
  campaignId: string;
  status: string;
  scheduledAt?: string | null;
  eligibleCount: number;
  skippedCount: number;
  queuedCount: number;
  pendingCount: number;
  callingCount: number;
  completedCount: number;
  failedCount: number;
  cancelledCount: number;
  callScript?: string | null;
  callWindowStart?: string | null;
  callWindowEnd?: string | null;
  retryLimit?: number | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type PreviewRecipient = {
  userId: string;
  displayName: string;
  city?: string | null;
  riskStatus?: string | null;
  reasonKey: string;
  status: "eligible" | "skipped";
  skipReason?: string | null;
};

type CampaignTargetRules = {
  geo: {
    scope: "organization" | "country" | "city" | "area";
    value: string;
  };
  riskLevel: "all" | "stable" | "review" | "urgent" | "high";
  healthConditions: string[];
  careProvider: {
    mode: "all" | "unassigned" | "assigned";
    providerId: string;
    providerName: string;
    providerType: "caregiver" | "field_staff" | "";
  };
  requireConsent: boolean;
  requirePhone: boolean;
};

type CallPreview = {
  campaignId: string;
  templateKey: TemplateKey;
  scheduledAt?: string | null;
  callWindowStart?: string | null;
  callWindowEnd?: string | null;
  retryLimit?: number | null;
  callScript?: string | null;
  eligibleCount: number;
  skippedCount: number;
  skipped: {
    noPhone: number;
    noConsent: number;
    outsideCallWindow: number;
    duplicateTarget: number;
  };
  recipients: PreviewRecipient[];
};

type CallJob = {
  id: string;
  runId: string;
  campaignId: string;
  userId: string;
  displayName: string;
  city?: string | null;
  status: string;
  skipReason?: string | null;
  scheduledAt?: string | null;
  attemptCount?: number;
  reasonKey: string;
};

type CampaignsResponse = {
  campaigns?: Campaign[];
};

type RunsResponse = {
  runs?: CallRun[];
};

type PreviewResponse = {
  preview?: CallPreview;
};

type RunResponse = {
  run?: CallRun | null;
  preview?: CallPreview;
};

type JobsResponse = {
  jobs?: CallJob[];
};

type CampaignFormState = {
  id?: string;
  name: string;
  templateKey: TemplateKey;
  audience: string;
  city: string;
  targetRules: CampaignTargetRules;
  objective: string;
  scheduledAt: string;
  callWindowStart: string;
  callWindowEnd: string;
  retryLimit: string;
  callScript: string;
  aiPrompt: string;
};

type CampaignAiSuggestion = {
  templateKey: TemplateKey;
  name: string;
  audience: string;
  objective: string;
  callScript: string;
  focus: string[];
};

type OpportunityUser = GISUser;

const REQUEST_TIMEOUT_MS = 10_000;

const templateKeys: TemplateKey[] = [
  "general_announcement",
  "heatwave_alert",
  "medication_reminder",
  "wellbeing_check",
  "service_update",
];

const createTemplateKeys: TemplateKey[] = [
  "general_announcement",
  "heatwave_alert",
  "medication_reminder",
  "wellbeing_check",
  "service_update",
  "custom_campaign",
];

function isTemplateKey(value: string | null): value is TemplateKey {
  return value === "general_announcement"
    || value === "heatwave_alert"
    || value === "medication_reminder"
    || value === "wellbeing_check"
    || value === "service_update"
    || value === "custom_campaign";
}

function templateType(templateKey: TemplateKey) {
  if (templateKey === "medication_reminder") return "medication";
  if (templateKey === "wellbeing_check") return "wellbeing";
  if (templateKey === "service_update") return "service";
  return "safety";
}

function isCustomTemplate(templateKey: TemplateKey) {
  return templateKey === "custom_campaign";
}

function defaultTargetRules(city = ""): CampaignTargetRules {
  return {
    geo: {
      scope: city.trim() ? "city" : "organization",
      value: city.trim(),
    },
    riskLevel: "all",
    healthConditions: [],
    careProvider: {
      mode: "all",
      providerId: "",
      providerName: "",
      providerType: "",
    },
    requireConsent: true,
    requirePhone: true,
  };
}

function normalizeTargetRules(value: unknown, city = ""): CampaignTargetRules {
  const fallback = defaultTargetRules(city);
  if (!value || typeof value !== "object") return fallback;
  const source = value as Partial<CampaignTargetRules>;
  const geo = source.geo && typeof source.geo === "object" ? source.geo : fallback.geo;
  const careProvider = source.careProvider && typeof source.careProvider === "object" ? source.careProvider : fallback.careProvider;
  return {
    geo: {
      scope: ["organization", "country", "city", "area"].includes(String(geo.scope)) ? geo.scope : fallback.geo.scope,
      value: String(geo.value || ""),
    } as CampaignTargetRules["geo"],
    riskLevel: ["all", "stable", "review", "urgent", "high"].includes(String(source.riskLevel)) ? source.riskLevel as CampaignTargetRules["riskLevel"] : fallback.riskLevel,
    healthConditions: Array.isArray(source.healthConditions)
      ? source.healthConditions.map((item) => String(item).trim()).filter(Boolean)
      : fallback.healthConditions,
    careProvider: {
      mode: ["all", "unassigned", "assigned"].includes(String(careProvider.mode)) ? careProvider.mode : fallback.careProvider.mode,
      providerId: String(careProvider.providerId || ""),
      providerName: String((careProvider as CampaignTargetRules["careProvider"]).providerName || ""),
      providerType: ["caregiver", "field_staff"].includes(String(careProvider.providerType)) ? careProvider.providerType : "",
    } as CampaignTargetRules["careProvider"],
    requireConsent: source.requireConsent !== false,
    requirePhone: source.requirePhone !== false,
  };
}

function defaultForm(templateKey: TemplateKey, getTemplateScript: (key: TemplateKey) => string): CampaignFormState {
  return {
    name: "",
    templateKey,
    audience: "",
    city: "",
    targetRules: defaultTargetRules(),
    objective: "",
    scheduledAt: "",
    callWindowStart: "09:00",
    callWindowEnd: "18:00",
    retryLimit: "1",
    callScript: getTemplateScript(templateKey),
    aiPrompt: "",
  };
}

function toDateTimeLocal(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function toIsoOrNull(value?: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function sumRunJobs(run?: CallRun | null) {
  if (!run) return 0;
  return run.queuedCount + run.pendingCount + run.callingCount + run.completedCount + run.failedCount + run.cancelledCount + run.skippedCount;
}

function operationalState(campaign: Campaign): CampaignState {
  const runStatus = campaign.latestRun?.status;
  if (runStatus === "scheduled") return "scheduled";
  if (runStatus === "queued" || runStatus === "pending" || runStatus === "calling") return "queued";
  if (runStatus === "completed") return "completed";
  if (runStatus === "cancelled") return "cancelled";
  if (runStatus === "failed") return "failed";
  if (campaign.status === "scheduled") return "scheduled";
  if (campaign.status === "completed") return "completed";
  return "draft";
}

function isAwaitingVoiceConnector(campaign: Campaign) {
  const runStatus = campaign.latestRun?.status;
  return runStatus === "queued" || runStatus === "pending" || runStatus === "calling";
}

function stateClasses(state: CampaignState) {
  switch (state) {
    case "draft":
      return "bg-slate-100 text-slate-700";
    case "scheduled":
      return "bg-amber-100 text-amber-700";
    case "queued":
      return "bg-primary/10 text-primary";
    case "completed":
      return "bg-emerald-100 text-emerald-700";
    case "cancelled":
      return "bg-orange-100 text-orange-700";
    case "failed":
      return "bg-red-100 text-red-700";
  }
}

function templateIcon(templateKey: TemplateKey) {
  switch (templateKey) {
    case "custom_campaign":
      return Sparkles;
    case "heatwave_alert":
      return Flame;
    case "medication_reminder":
      return CalendarClock;
    case "wellbeing_check":
      return ShieldAlert;
    case "service_update":
      return PhoneCall;
    case "general_announcement":
    default:
      return Megaphone;
  }
}

function skipReasonKey(skipReason?: string | null) {
  switch (skipReason) {
    case "no_phone":
      return "campaigns.call.noPhone";
    case "no_consent":
      return "campaigns.call.noConsent";
    case "outside_call_window":
      return "campaigns.call.outsideWindow";
    case "duplicate_target":
      return "campaigns.call.duplicateTarget";
    case "outside_geo":
      return "campaigns.call.outsideGeo";
    case "risk_mismatch":
      return "campaigns.call.riskMismatch";
    case "health_condition_mismatch":
      return "campaigns.call.healthMismatch";
    case "provider_mismatch":
      return "campaigns.call.providerMismatch";
    case "template_mismatch":
      return "campaigns.call.templateMismatch";
    default:
      return "campaigns.preview.notEligible";
  }
}

function runJobStatusKey(status?: string | null) {
  switch (status) {
    case "queued":
      return "campaigns.call.status.queued";
    case "pending":
      return "campaigns.jobs.pending";
    case "calling":
      return "campaigns.jobs.calling";
    case "completed":
      return "campaigns.call.status.completed";
    case "failed":
      return "campaigns.call.status.failed";
    case "cancelled":
      return "campaigns.call.status.cancelled";
    case "skipped":
      return "campaigns.call.skipped";
    default:
      return "campaigns.call.status.draft";
  }
}

function campaignOpportunityMatchesTemplate(user: OpportunityUser, templateKey: TemplateKey) {
  if (templateKey === "custom_campaign") return Boolean(user.phone);
  if (templateKey === "medication_reminder") return Boolean(user.phone) && (Number(user.healthConditions || 0) > 0 || Number(user.riskScore || 0) >= 40);
  if (templateKey === "wellbeing_check") return Boolean(user.phone) && ((user.careProviderCount ?? 0) < 1 || Number(user.activeAlerts || 0) > 0 || Number(user.riskScore || 0) >= 50);
  if (templateKey === "service_update") return (user.careProviderCount ?? 0) < 1 || Number(user.activeAlerts || 0) > 0;
  if (templateKey === "heatwave_alert") return Number(user.riskScore || 0) >= 60 || Number(user.healthConditions || 0) > 0;
  return Boolean(user.phone);
}

function campaignOpportunityReasonKey(user: OpportunityUser, templateKey: TemplateKey) {
  if (templateKey === "custom_campaign") return "campaigns.targets.reason.generalAnnouncement";
  if (templateKey === "medication_reminder") return "campaigns.targets.reason.publicHealth";
  if (templateKey === "wellbeing_check") return "campaigns.targets.reason.safetyAdvisory";
  if (templateKey === "service_update") return (user.careProviderCount ?? 0) < 1 ? "usersList.nextAction.assign" : "campaigns.targets.reason.service";
  if (templateKey === "heatwave_alert") return "campaigns.targets.reason.heatwave";
  return "campaigns.targets.reason.safetyCheck";
}

export default function Campaigns() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [guideDialogOpen, setGuideDialogOpen] = useState(false);
  const [guideExpanded, setGuideExpanded] = useState(false);
  const [guidePromptShown, setGuidePromptShown] = useState(false);
  const [form, setForm] = useState<CampaignFormState | null>(null);
  const [previewAction, setPreviewAction] = useState<PreviewAction>("preview");
  const [previewData, setPreviewData] = useState<CallPreview | null>(null);
  const [aiSuggestion, setAiSuggestion] = useState<CampaignAiSuggestion | null>(null);
  const [wizardStep, setWizardStep] = useState<WizardStep>(1);
  const [healthConditionDraft, setHealthConditionDraft] = useState("");
  const queryClient = useQueryClient();
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const { isAdmin } = useAdminRole();
  const { data: gisData } = useGISData();
  const canDraftCampaigns = Boolean(user) && !authBypassEnabled;
  const canManageCampaigns = isAdmin && canDraftCampaigns;

  const templateLabel = (templateKey: TemplateKey) => {
    const translated = t(`campaigns.template.${templateKey}.title`);
    return translated === `campaigns.template.${templateKey}.title`
      ? templateKey.replace(/_/g, " ")
      : translated;
  };

  const templateDescription = (templateKey: TemplateKey) => {
    const translated = t(`campaigns.template.${templateKey}.description`);
    return translated === `campaigns.template.${templateKey}.description` ? "" : translated;
  };

  const templateObjective = (templateKey: TemplateKey, city: string) => {
    const translated = t(`campaigns.template.${templateKey}.objective`);
    const base = translated === `campaigns.template.${templateKey}.objective` ? "" : translated;
    return base.replace("{city}", city || t("campaigns.scope.allCities"));
  };

  const templateAudience = (templateKey: TemplateKey, city: string) => {
    const translated = t(`campaigns.template.${templateKey}.audience`);
    const base = translated === `campaigns.template.${templateKey}.audience` ? "" : translated;
    return base.replace("{city}", city || t("campaigns.scope.allCities"));
  };

  const templateScript = (templateKey: TemplateKey) => {
    const translated = t(`campaigns.template.${templateKey}.script`);
    if (translated === `campaigns.template.${templateKey}.script`) return isCustomTemplate(templateKey) ? "" : t("campaigns.call.defaultScript");
    return translated;
  };

  const aiTemplateName = (templateKey: TemplateKey, city: string) => {
    const cityLabel = city || t("campaigns.scope.allCities");
    const key =
      templateKey === "general_announcement"
        ? "campaigns.ai.general.name"
        : templateKey === "heatwave_alert"
          ? "campaigns.ai.safety.name"
          : templateKey === "medication_reminder"
            ? "campaigns.ai.medication.name"
            : templateKey === "wellbeing_check"
              ? "campaigns.ai.wellbeing.name"
              : templateKey === "service_update"
                ? "campaigns.ai.service.name"
                : "campaigns.ai.general.name";
    return t(key).replace("{city}", cityLabel);
  };

  const aiTemplateAudience = (templateKey: TemplateKey, city: string) => {
    const cityLabel = city || t("campaigns.scope.allCities");
    const key =
      templateKey === "general_announcement"
        ? "campaigns.ai.general.audience"
        : templateKey === "heatwave_alert"
          ? "campaigns.ai.safety.audience"
          : templateKey === "medication_reminder"
            ? "campaigns.ai.medication.audience"
            : templateKey === "wellbeing_check"
              ? "campaigns.ai.wellbeing.audience"
              : templateKey === "service_update"
                ? "campaigns.ai.service.audience"
                : "campaigns.ai.general.audience";
    return t(key).replace("{city}", cityLabel);
  };

  const aiTemplateObjective = (templateKey: TemplateKey, city: string) => {
    const cityLabel = city || t("campaigns.scope.allCities");
    const channel = t("campaigns.channel.phone");
    const key =
      templateKey === "general_announcement"
        ? "campaigns.ai.general.objective"
        : templateKey === "heatwave_alert"
          ? "campaigns.ai.safety.objective"
          : templateKey === "medication_reminder"
            ? "campaigns.ai.medication.objective"
            : templateKey === "wellbeing_check"
              ? "campaigns.ai.wellbeing.objective"
              : templateKey === "service_update"
                ? "campaigns.ai.service.objective"
                : "campaigns.ai.general.objective";
    return t(key).replace("{city}", cityLabel).replace("{channel}", channel);
  };

  const aiTemplateScript = (templateKey: TemplateKey) => {
    const key =
      templateKey === "general_announcement"
        ? "campaigns.ai.general.callScript"
        : templateKey === "heatwave_alert"
          ? "campaigns.ai.safety.callScript"
          : templateKey === "medication_reminder"
            ? "campaigns.ai.medication.callScript"
            : templateKey === "wellbeing_check"
              ? "campaigns.ai.wellbeing.callScript"
              : templateKey === "service_update"
                ? "campaigns.ai.service.callScript"
                : "campaigns.ai.general.callScript";
    return t(key);
  };

  const aiTemplateFocus = (templateKey: TemplateKey) => {
    const prefix =
      templateKey === "general_announcement"
        ? "campaigns.ai.general"
        : templateKey === "heatwave_alert"
          ? "campaigns.ai.safety"
          : templateKey === "medication_reminder"
            ? "campaigns.ai.medication"
            : templateKey === "wellbeing_check"
              ? "campaigns.ai.wellbeing"
              : templateKey === "service_update"
                ? "campaigns.ai.service"
                : "campaigns.ai.general";
    return [t(`${prefix}.focus1`), t(`${prefix}.focus2`), t(`${prefix}.focus3`)];
  };

  const formatDateTime = (value?: string | null) => {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return new Intl.DateTimeFormat(language === "de" ? "de-DE" : language === "es" ? "es-ES" : "en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  };

  const formatTimeRange = (start?: string | null, end?: string | null) => {
    if (start && end) return `${start} - ${end}`;
    if (start) return start;
    if (end) return end;
    return "—";
  };

  const campaignsQuery = useQuery({
    queryKey: ["campaigns-dashboard"],
    queryFn: async () => {
      const response = await apiFetch<CampaignsResponse>("/api/v1/campaigns-dashboard/campaigns", {
        timeoutMs: REQUEST_TIMEOUT_MS,
      });
      return response.campaigns ?? [];
    },
  });

  const campaigns = campaignsQuery.data ?? [];

  useEffect(() => {
    if (!campaigns.length) {
      setSelectedCampaignId(null);
      return;
    }
    if (!selectedCampaignId || !campaigns.some((campaign) => campaign.id === selectedCampaignId)) {
      setSelectedCampaignId(campaigns[0].id);
    }
  }, [campaigns, selectedCampaignId]);

  const selectedCampaign = useMemo(
    () => campaigns.find((campaign) => campaign.id === selectedCampaignId) ?? null,
    [campaigns, selectedCampaignId],
  );

  const runsQuery = useQuery({
    queryKey: ["campaign-call-runs", selectedCampaignId],
    enabled: Boolean(selectedCampaignId),
    queryFn: async () => {
      const response = await apiFetch<RunsResponse>(`/api/v1/campaigns-dashboard/campaigns/${selectedCampaignId}/call-runs`, {
        timeoutMs: REQUEST_TIMEOUT_MS,
      });
      return response.runs ?? [];
    },
  });

  const runs = runsQuery.data ?? [];

  useEffect(() => {
    if (!runs.length) {
      setSelectedRunId(null);
      return;
    }
    if (!selectedRunId || !runs.some((run) => run.id === selectedRunId)) {
      setSelectedRunId(runs[0].id);
    }
  }, [runs, selectedRunId]);

  const selectedRun = useMemo(
    () => runs.find((run) => run.id === selectedRunId) ?? null,
    [runs, selectedRunId],
  );

  const jobsQuery = useQuery({
    queryKey: ["campaign-call-jobs", selectedRunId],
    enabled: Boolean(selectedRunId),
    queryFn: async () => {
      const response = await apiFetch<JobsResponse>(`/api/v1/campaigns-dashboard/call-runs/${selectedRunId}/jobs`, {
        timeoutMs: REQUEST_TIMEOUT_MS,
      });
      return response.jobs ?? [];
    },
  });

  const jobs = jobsQuery.data ?? [];

  const filteredCampaigns = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return campaigns.filter((campaign) => {
      const state = operationalState(campaign);
      if (filter !== "all" && state !== filter) return false;
      if (!normalized) return true;
      return (
        campaign.name.toLowerCase().includes(normalized)
        || templateLabel(campaign.templateKey ?? "general_announcement").toLowerCase().includes(normalized)
        || (campaign.city ?? "").toLowerCase().includes(normalized)
        || t(`campaigns.state.${state}`).toLowerCase().includes(normalized)
      );
    });
  }, [campaigns, filter, search, t]);

  const stats = useMemo(() => ({
    drafts: campaigns.filter((campaign) => operationalState(campaign) === "draft").length,
    scheduled: campaigns.filter((campaign) => operationalState(campaign) === "scheduled").length,
    queued: campaigns.filter((campaign) => operationalState(campaign) === "queued").length,
    completed: campaigns.filter((campaign) => operationalState(campaign) === "completed").length,
  }), [campaigns]);

  const noCampaignsCreated = !campaignsQuery.isLoading && campaigns.length === 0;
  const opportunityUsers = useMemo<OpportunityUser[]>(() => {
    const apiUsers = gisData?.gisUsers ?? [];
    if (apiUsers.length > 0) return apiUsers;
    if (authBypassEnabled) return demoOperationalUsers as OpportunityUser[];
    return [];
  }, [gisData?.gisUsers]);

  const templateOpportunities = useMemo(() => {
    return templateKeys.map((templateKey) => {
      const matching = opportunityUsers
        .filter((user) => campaignOpportunityMatchesTemplate(user, templateKey))
        .sort((a, b) => (b.riskScore ?? 0) - (a.riskScore ?? 0));
      return { templateKey, matching };
    });
  }, [opportunityUsers]);

  const likelyRecipients = useMemo(() => {
    return opportunityUsers
      .filter((user) => Number(user.criticalAlerts || 0) > 0 || Number(user.activeAlerts || 0) > 0 || Number(user.missedMeds7d || 0) > 0 || !user.checkinEnabled)
      .sort((a, b) => (b.riskScore ?? 0) - (a.riskScore ?? 0))
      .slice(0, 5);
  }, [opportunityUsers]);

  const operationalGaps = useMemo(() => {
    const missingPhone = opportunityUsers.filter((user) => !user.phone).length;
    const checkinsOff = opportunityUsers.filter((user) => !user.checkinEnabled).length;
    const medicationSignals = opportunityUsers.filter((user) => Number(user.missedMeds7d || 0) > 0).length;
    const unassignedCoverage = opportunityUsers.filter((user) => (user.careProviderCount ?? 0) < 1).length;
    const urgentSignals = opportunityUsers.filter((user) => Number(user.criticalAlerts || 0) > 0 || Number(user.riskScore || 0) >= 80).length;
    return { missingPhone, checkinsOff, medicationSignals, unassignedCoverage, urgentSignals };
  }, [opportunityUsers]);

  const careProviderOptions = useMemo(() => {
    const names = new Set<string>();
    for (const user of opportunityUsers) {
      for (const name of user.careProviderNames ?? []) {
        const clean = String(name || "").trim();
        if (clean) names.add(clean);
      }
    }
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [opportunityUsers]);

  const availableCities = useMemo(() => {
    const cities = new Set<string>();
    for (const user of opportunityUsers) {
      const city = String(user.city || "").trim();
      if (city) cities.add(city);
    }
    return Array.from(cities).sort((a, b) => a.localeCompare(b));
  }, [opportunityUsers]);

  const localTargetSummary = useMemo(() => {
    if (!form) {
      return { eligible: [], skipped: [], skippedReasons: { noPhone: 0, noConsent: 0, outsideGeo: 0, riskMismatch: 0, healthMismatch: 0, providerMismatch: 0, templateMismatch: 0 } };
    }
    const rules = normalizeTargetRules(form.targetRules, form.city);
    const skippedReasons = { noPhone: 0, noConsent: 0, outsideGeo: 0, riskMismatch: 0, healthMismatch: 0, providerMismatch: 0, templateMismatch: 0 };
    const eligible: OpportunityUser[] = [];
    const skipped: Array<{ user: OpportunityUser; reason: keyof typeof skippedReasons }> = [];

    for (const user of opportunityUsers) {
      const userCity = String(user.city || "").toLowerCase();
      const userCountry = String(user.country || "").toLowerCase();
      const geoValue = String(rules.geo.value || "").toLowerCase();
      let reason: keyof typeof skippedReasons | null = null;
      if (!campaignOpportunityMatchesTemplate(user, form.templateKey)) reason = "templateMismatch";
      else if (rules.requirePhone && !user.phone) reason = "noPhone";
      else if (rules.geo.scope === "city" && geoValue && userCity !== geoValue) reason = "outsideGeo";
      else if (rules.geo.scope === "country" && geoValue && userCountry !== geoValue) reason = "outsideGeo";
      else if (rules.geo.scope === "area" && geoValue && !userCity.includes(geoValue)) reason = "outsideGeo";
      else {
        const riskStatus = Number(user.riskScore || 0) >= 80 ? "urgent" : Number(user.riskScore || 0) >= 50 || Number(user.activeAlerts || 0) > 0 ? "review" : "stable";
        if (rules.riskLevel === "urgent" && riskStatus !== "urgent") reason = "riskMismatch";
        else if (rules.riskLevel === "review" && riskStatus !== "review") reason = "riskMismatch";
        else if (rules.riskLevel === "stable" && riskStatus !== "stable") reason = "riskMismatch";
        else if (rules.riskLevel === "high" && Number(user.riskScore || 0) < 70) reason = "riskMismatch";
        else if (rules.healthConditions.length > 0 && Number(user.healthConditions || 0) < 1) reason = "healthMismatch";
        else if (rules.careProvider.mode === "unassigned" && Number(user.careProviderCount || 0) > 0) reason = "providerMismatch";
        else if (
          rules.careProvider.mode === "assigned" &&
          rules.careProvider.providerName &&
          !(user.careProviderNames ?? []).some((name) => name.toLowerCase() === rules.careProvider.providerName.toLowerCase())
        ) {
          reason = "providerMismatch";
        }
      }

      if (reason) {
        skippedReasons[reason] += 1;
        skipped.push({ user, reason });
      } else {
        eligible.push(user);
      }
    }
    return { eligible, skipped, skippedReasons };
  }, [form, opportunityUsers]);

  const inferAiTemplate = (prompt: string, fallback: TemplateKey): TemplateKey => {
    const normalized = prompt.toLowerCase();
    if (/(heat|hot|dehydrat|summer|weather)/.test(normalized)) return "heatwave_alert";
    if (/(vaccine|vaccination|booster|flu shot|shot clinic|immuni[sz]ation|public health)/.test(normalized)) return "medication_reminder";
    if (/(scam|fraud|suspicious|phone scam|bank alert|identity theft|safety advisory|warning)/.test(normalized)) return "wellbeing_check";
    if (/(service|transport|pharmacy|update|hours|closure|appointment|referral)/.test(normalized)) return "service_update";
    if (/(announce|announcement|inform|remind|warning|alert|campaign)/.test(normalized)) return "general_announcement";
    return fallback;
  };

  const buildAiSuggestion = (draft: CampaignFormState): CampaignAiSuggestion => {
    const suggestedTemplate = inferAiTemplate(draft.aiPrompt, draft.templateKey);
    const city = draft.city.trim();
    const freeText = draft.aiPrompt.trim();
    const baseScript = aiTemplateScript(suggestedTemplate);
    const objective = freeText
      ? `${aiTemplateObjective(suggestedTemplate, city)} ${freeText}`
      : aiTemplateObjective(suggestedTemplate, city);

    return {
      templateKey: suggestedTemplate,
      name: aiTemplateName(suggestedTemplate, city),
      audience: aiTemplateAudience(suggestedTemplate, city),
      objective,
      callScript: freeText ? `${baseScript}\n\nOperational emphasis: ${freeText}` : baseScript,
      focus: aiTemplateFocus(suggestedTemplate),
    };
  };

  const openCreateDialog = (templateKey: TemplateKey = "general_announcement") => {
    setForm({
      ...defaultForm(templateKey, templateScript),
      name: isCustomTemplate(templateKey) ? "" : templateLabel(templateKey),
      objective: isCustomTemplate(templateKey) ? "" : templateObjective(templateKey, ""),
      audience: isCustomTemplate(templateKey) ? "" : templateAudience(templateKey, ""),
      targetRules: defaultTargetRules(),
    });
    setAiSuggestion(null);
    setWizardStep(1);
    setEditorOpen(true);
  };

  const syncCreateIntent = (templateKey: TemplateKey = "general_announcement", mode?: "ai") => {
    const next = new URLSearchParams(searchParams);
    next.set("createCampaign", "1");
    next.set("template", templateKey);
    if (mode === "ai") next.set("mode", mode);
    else next.delete("mode");
    setSearchParams(next, { replace: true });
  };

  const clearCreateIntent = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("createCampaign");
    next.delete("template");
    next.delete("mode");
    setSearchParams(next, { replace: true });
  };

  const openEditDialog = (campaign: Campaign) => {
    clearCreateIntent();
    setForm({
      id: campaign.id,
      name: campaign.name,
      templateKey: campaign.templateKey ?? "general_announcement",
      audience: campaign.audience ?? templateAudience(campaign.templateKey ?? "general_announcement", campaign.city ?? ""),
      city: campaign.city ?? "",
      targetRules: normalizeTargetRules(campaign.targetRules, campaign.city ?? ""),
      objective: campaign.objective ?? templateObjective(campaign.templateKey ?? "general_announcement", campaign.city ?? ""),
      scheduledAt: toDateTimeLocal(campaign.scheduledAt),
      callWindowStart: campaign.callWindowStart ?? "09:00",
      callWindowEnd: campaign.callWindowEnd ?? "18:00",
      retryLimit: String(campaign.retryLimit ?? 1),
      callScript: campaign.callScript ?? templateScript(campaign.templateKey ?? "general_announcement"),
      aiPrompt: "",
    });
    setAiSuggestion(null);
    setWizardStep(1);
    setEditorOpen(true);
  };

  const updateTargetRules = (updater: (rules: CampaignTargetRules) => CampaignTargetRules) => {
    setForm((current) => current ? { ...current, targetRules: updater(normalizeTargetRules(current.targetRules, current.city)) } : current);
  };

  const setCampaignCity = (city: string) => {
    setForm((current) => {
      if (!current) return current;
      const rules = normalizeTargetRules(current.targetRules, city);
      const nextRules = rules.geo.scope === "city" || rules.geo.scope === "organization"
        ? { ...rules, geo: { scope: city.trim() ? "city" : "organization", value: city } as CampaignTargetRules["geo"] }
        : rules;
      return {
        ...current,
        city,
        targetRules: nextRules,
        audience: isCustomTemplate(current.templateKey) ? current.audience : templateAudience(current.templateKey, city),
        objective: isCustomTemplate(current.templateKey) ? current.objective : templateObjective(current.templateKey, city),
      };
    });
  };

  const addHealthConditionRule = () => {
    const condition = healthConditionDraft.trim();
    if (!condition) return;
    updateTargetRules((rules) => ({
      ...rules,
      healthConditions: Array.from(new Set([...rules.healthConditions, condition])),
    }));
    setHealthConditionDraft("");
  };

  const canMoveNext = (step: WizardStep) => {
    if (!form) return false;
    if (step === 1) return Boolean(form.templateKey);
    if (step === 3) return Boolean(form.callScript.trim());
    return true;
  };

  const nextWizardStep = () => setWizardStep((current) => Math.min(4, current + 1) as WizardStep);
  const previousWizardStep = () => setWizardStep((current) => Math.max(1, current - 1) as WizardStep);

  const buildPayload = (draft: CampaignFormState, options?: { status?: string; queueNow?: boolean }) => {
    const status = options?.status ?? "draft";
    const scheduledAt = options?.queueNow ? null : toIsoOrNull(draft.scheduledAt);
    return {
      templateKey: draft.templateKey,
      name: draft.name.trim() || `${templateLabel(draft.templateKey)}${draft.city.trim() ? ` - ${draft.city.trim()}` : ""}`,
      objective: draft.objective.trim() || templateObjective(draft.templateKey, draft.city.trim()),
      audience: draft.audience.trim() || templateAudience(draft.templateKey, draft.city.trim()),
      city: draft.city.trim(),
      targetRules: normalizeTargetRules(draft.targetRules, draft.city.trim()),
      channel: "phone",
      executionType: "vyva_call",
      status,
      dueKey: status === "scheduled" ? "campaigns.due.scheduled" : "campaigns.due.draft",
      scheduledAt,
      callWindowStart: draft.callWindowStart,
      callWindowEnd: draft.callWindowEnd,
      retryLimit: Number(draft.retryLimit || 0),
      callScript: draft.callScript.trim() || templateScript(draft.templateKey),
      owner: "",
      type: templateType(draft.templateKey),
    };
  };

  const saveMutation = useMutation({
    mutationFn: async ({ draft, status }: { draft: CampaignFormState; status: string }) => {
      const payload = buildPayload(draft, { status });
      if (draft.id) {
        const response = await apiFetch<{ campaign?: Campaign | null }>(`/api/v1/campaigns-dashboard/campaigns/${draft.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
          timeoutMs: REQUEST_TIMEOUT_MS,
        });
        return response.campaign ?? null;
      }
      const response = await apiFetch<{ campaign?: Campaign | null }>("/api/v1/campaigns-dashboard/campaigns", {
        method: "POST",
        body: JSON.stringify(payload),
        timeoutMs: REQUEST_TIMEOUT_MS,
      });
      return response.campaign ?? null;
    },
    onSuccess: async (campaign) => {
      await queryClient.invalidateQueries({ queryKey: ["campaigns-dashboard"] });
      if (campaign?.id) setSelectedCampaignId(campaign.id);
      setEditorOpen(false);
      toast({ title: t("campaigns.action.draftSaved") });
    },
    onError: (error) => {
      toast({
        title: t("campaigns.form.saveFailed"),
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    },
  });

  const previewMutation = useMutation({
    mutationFn: async ({ campaign, action }: { campaign: Campaign; action: PreviewAction }) => {
      const payload = {
        templateKey: campaign.templateKey ?? "general_announcement",
        city: campaign.city ?? "",
        targetRules: normalizeTargetRules(campaign.targetRules, campaign.city ?? ""),
        scheduledAt: action === "queue" ? null : campaign.scheduledAt,
        callWindowStart: campaign.callWindowStart ?? "09:00",
        callWindowEnd: campaign.callWindowEnd ?? "18:00",
        retryLimit: campaign.retryLimit ?? 1,
        callScript: campaign.callScript ?? templateScript(campaign.templateKey ?? "general_announcement"),
      };
      const response = await apiFetch<PreviewResponse>(`/api/v1/campaigns-dashboard/campaigns/${campaign.id}/call-runs/preview`, {
        method: "POST",
        body: JSON.stringify(payload),
        timeoutMs: REQUEST_TIMEOUT_MS,
      });
      return response.preview ?? null;
    },
    onSuccess: (preview, variables) => {
      setPreviewAction(variables.action);
      setPreviewData(preview);
      setPreviewOpen(true);
    },
    onError: (error) => {
      toast({
        title: t("campaigns.preview.failed"),
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    },
  });

  const queueMutation = useMutation({
    mutationFn: async ({ campaign, action }: { campaign: Campaign; action: Exclude<PreviewAction, "preview"> }) => {
      const payload = {
        templateKey: campaign.templateKey ?? "general_announcement",
        city: campaign.city ?? "",
        targetRules: normalizeTargetRules(campaign.targetRules, campaign.city ?? ""),
        scheduledAt: action === "queue" ? null : campaign.scheduledAt,
        callWindowStart: campaign.callWindowStart ?? "09:00",
        callWindowEnd: campaign.callWindowEnd ?? "18:00",
        retryLimit: campaign.retryLimit ?? 1,
        callScript: campaign.callScript ?? templateScript(campaign.templateKey ?? "general_announcement"),
      };

      await apiFetch<{ campaign?: Campaign | null }>(`/api/v1/campaigns-dashboard/campaigns/${campaign.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          ...payload,
          name: campaign.name,
          objective: campaign.objective ?? "",
          audience: campaign.audience ?? "",
          status: action === "schedule" ? "scheduled" : "active",
          channel: "phone",
          executionType: "vyva_call",
          dueKey: action === "schedule" ? "campaigns.due.scheduled" : "campaigns.due.today",
        }),
        timeoutMs: REQUEST_TIMEOUT_MS,
      });

      const response = await apiFetch<RunResponse>(`/api/v1/campaigns-dashboard/campaigns/${campaign.id}/call-runs`, {
        method: "POST",
        body: JSON.stringify(payload),
        timeoutMs: REQUEST_TIMEOUT_MS,
      });
      return response.run ?? null;
    },
    onSuccess: async (run) => {
      setPreviewOpen(false);
      setPreviewData(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["campaigns-dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["campaign-call-runs", selectedCampaignId] }),
      ]);
      if (run?.id) setSelectedRunId(run.id);
      toast({
        title: previewAction === "schedule" ? t("campaigns.action.scheduledSaved") : t("campaigns.call.queuedTitle"),
        description: previewAction === "schedule" ? undefined : t("campaigns.call.queuedDescription"),
      });
    },
    onError: (error) => {
      toast({
        title: t("campaigns.call.queueFailed"),
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    },
  });

  const cancelRunMutation = useMutation({
    mutationFn: async (runId: string) =>
      apiFetch(`/api/v1/campaigns-dashboard/call-runs/${runId}/cancel`, {
        method: "POST",
        timeoutMs: REQUEST_TIMEOUT_MS,
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["campaigns-dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["campaign-call-runs", selectedCampaignId] }),
        queryClient.invalidateQueries({ queryKey: ["campaign-call-jobs", selectedRunId] }),
      ]);
      toast({ title: t("campaigns.call.cancelledTitle"), description: t("campaigns.call.cancelledDescription") });
    },
    onError: (error) => {
      toast({
        title: t("campaigns.call.cancelFailed"),
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    },
  });

  const runPreviewForCampaign = (campaign: Campaign, action: PreviewAction) => {
    if (action === "schedule" && !campaign.scheduledAt) {
      toast({
        title: t("campaigns.form.scheduleRequired"),
        description: t("campaigns.form.scheduleRequiredDescription"),
      });
      openEditDialog(campaign);
      return;
    }
    previewMutation.mutate({ campaign, action });
  };

  const canEditSelectedCampaign = Boolean(
    selectedCampaign && (canManageCampaigns || (canDraftCampaigns && operationalState(selectedCampaign) === "draft")),
  );

  useEffect(() => {
    if (!canDraftCampaigns) return;
    if (searchParams.get("createCampaign") !== "1") return;
    if (editorOpen) return;

    const requestedTemplate = searchParams.get("template");
    const templateKey = isTemplateKey(requestedTemplate) ? requestedTemplate : "general_announcement";
    openCreateDialog(templateKey);

    if (searchParams.get("mode") === "ai") {
      setForm((current) => current ? { ...current, aiPrompt: "" } : current);
    }
  }, [canDraftCampaigns, editorOpen, searchParams]);

  useEffect(() => {
    if (!noCampaignsCreated || guidePromptShown) return;
    setGuideDialogOpen(true);
    setGuidePromptShown(true);
  }, [guidePromptShown, noCampaignsCreated]);

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
          {canDraftCampaigns && (
            <Button
              type="button"
              variant="outline"
              className="h-10 rounded-full px-4 text-sm font-bold"
              onClick={() => {
                syncCreateIntent("general_announcement", "ai");
              }}
            >
              <Sparkles className="mr-2 h-4 w-4 text-primary" />
              {t("campaigns.ai.open")}
            </Button>
          )}
          {canDraftCampaigns && (
            <Button
              type="button"
              className="h-10 rounded-full bg-primary px-4 text-sm font-bold text-primary-foreground hover:bg-primary/90"
              onClick={() => syncCreateIntent("general_announcement")}
            >
              <Plus className="mr-2 h-4 w-4" />
              {t("campaigns.newCampaign")}
            </Button>
          )}
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title={t("campaigns.metric.drafts")}
          value={campaignsQuery.isLoading ? "-" : stats.drafts}
          icon={<Megaphone className="h-5 w-5" />}
          gradient="bg-gradient-to-br from-slate-600 to-slate-500"
        />
        <StatCard
          title={t("campaigns.metric.scheduledRuns")}
          value={campaignsQuery.isLoading ? "-" : stats.scheduled}
          icon={<CalendarClock className="h-5 w-5" />}
          gradient="bg-gradient-to-br from-amber-500 to-orange-500"
        />
        <StatCard
          title={t("campaigns.metric.queuedRuns")}
          value={campaignsQuery.isLoading ? "-" : stats.queued}
          icon={<PhoneCall className="h-5 w-5" />}
          gradient="bg-gradient-to-br from-primary to-primary/80"
        />
        <StatCard
          title={t("campaigns.metric.completedRuns")}
          value={campaignsQuery.isLoading ? "-" : stats.completed}
          icon={<CheckCircle2 className="h-5 w-5" />}
          gradient="bg-gradient-to-br from-emerald-500 to-emerald-600"
        />
      </section>

      <section className="rounded-2xl border border-border bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-border px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {(["all", "draft", "scheduled", "queued", "completed"] as FilterKey[]).map((value) => (
              <Button
                key={value}
                type="button"
                variant={filter === value ? "default" : "outline"}
                className="rounded-full"
                onClick={() => setFilter(value)}
              >
                {t(`campaigns.filter.${value}`)}
              </Button>
            ))}
          </div>
          <div className="relative w-full max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("campaigns.searchPlaceholder")}
              className="pl-9"
            />
          </div>
        </div>

        <div className="grid gap-5 p-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
          <div className="space-y-3">
            {campaignsQuery.isLoading ? (
              Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-36 rounded-2xl" />)
            ) : noCampaignsCreated ? (
              <div className="rounded-2xl border border-dashed border-primary/20 bg-gradient-to-br from-primary/5 to-white p-6">
                <div className="space-y-5">
                  <div className="space-y-2">
                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary">
                      {t("campaigns.empty.eyebrow")}
                    </p>
                    <h2 className="text-xl font-bold text-foreground">{t("campaigns.empty.title")}</h2>
                    <p className="text-sm leading-6 text-muted-foreground">{t("campaigns.empty.description")}</p>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    {templateOpportunities.map(({ templateKey, matching }) => {
                      const Icon = templateIcon(templateKey);
                      return (
                        <button
                          key={templateKey}
                          type="button"
                          className="rounded-2xl border border-border bg-white p-4 text-left shadow-sm transition hover:border-primary/30 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-70"
                          onClick={() => canDraftCampaigns && syncCreateIntent(templateKey)}
                          disabled={!canDraftCampaigns}
                        >
                          <div className="space-y-4">
                            <div className="flex items-start justify-between gap-3">
                              <span className="rounded-full bg-primary/10 p-2 text-primary">
                                <Icon className="h-4 w-4" />
                              </span>
                              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
                                {t("campaigns.empty.peopleCount").replace("{count}", String(matching.length))}
                              </span>
                            </div>

                            <div className="space-y-2">
                              <p className="text-lg font-semibold leading-7 text-foreground">{templateLabel(templateKey)}</p>
                              <p className="min-h-[72px] text-sm leading-6 text-muted-foreground">{templateDescription(templateKey)}</p>
                            </div>

                            <p className="text-xs font-medium leading-5 text-muted-foreground">
                              {matching.length > 0
                                ? t("campaigns.empty.topCity").replace("{city}", matching[0].city || t("campaigns.scope.allCities"))
                                : t("campaigns.empty.noneReady")}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                </div>
              </div>
            ) : filteredCampaigns.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-slate-50 px-6 py-10 text-center text-sm text-muted-foreground">
                {t("campaigns.noMatch")}
              </div>
            ) : (
              filteredCampaigns.map((campaign) => {
                const state = operationalState(campaign);
                const Icon = templateIcon(campaign.templateKey ?? "general_announcement");
                return (
                  <button
                    key={campaign.id}
                    type="button"
                    className={cn(
                      "w-full rounded-2xl border bg-white p-5 text-left shadow-sm transition hover:border-primary/30 hover:shadow-md",
                      selectedCampaignId === campaign.id ? "border-primary/40 ring-1 ring-primary/20" : "border-border",
                    )}
                    onClick={() => setSelectedCampaignId(campaign.id)}
                  >
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div className="min-w-0 space-y-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-primary/10 p-2 text-primary">
                            <Icon className="h-4 w-4" />
                          </span>
                          <Badge variant="outline" className="rounded-full border-primary/20 bg-primary/5 px-3 py-1 font-semibold text-primary">
                            {templateLabel(campaign.templateKey ?? "general_announcement")}
                          </Badge>
                          <Badge className={cn("rounded-full border-0 px-3 py-1 font-semibold", stateClasses(state))}>
                            {t(`campaigns.state.${state}`)}
                          </Badge>
                          {isAwaitingVoiceConnector(campaign) && (
                            <Badge variant="outline" className="rounded-full border-amber-300 bg-amber-50 px-3 py-1 text-amber-700">
                              {t("campaigns.state.awaitingVoiceConnector")}
                            </Badge>
                          )}
                        </div>
                        <div>
                          <h2 className="text-lg font-bold leading-tight text-foreground">{campaign.name}</h2>
                          <p className="mt-1 text-sm text-muted-foreground">{templateDescription(campaign.templateKey ?? "general_announcement")}</p>
                        </div>
                        <div className="flex flex-wrap gap-2 text-sm">
                          <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-slate-700">
                            <MapPin className="h-3.5 w-3.5" />
                            {campaign.city || t("campaigns.scope.allCities")}
                          </span>
                          <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-slate-700">
                            <CalendarClock className="h-3.5 w-3.5" />
                            {formatDateTime(campaign.latestRun?.scheduledAt ?? campaign.scheduledAt)}
                          </span>
                          <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-slate-700">
                            <Clock3 className="h-3.5 w-3.5" />
                            {formatTimeRange(campaign.callWindowStart, campaign.callWindowEnd)}
                          </span>
                        </div>
                      </div>

                      <div className="grid min-w-[260px] gap-3 text-sm sm:grid-cols-3 xl:grid-cols-1">
                        <MetricLine label={t("campaigns.row.eligible")} value={String(campaign.latestRun?.eligibleCount ?? 0)} />
                        <MetricLine label={t("campaigns.row.progress")} value={`${campaign.latestRun?.completedCount ?? 0}/${sumRunJobs(campaign.latestRun) || 0}`} />
                        <MetricLine label={t("campaigns.row.skipped")} value={String(campaign.latestRun?.skippedCount ?? 0)} />
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          <Card className="rounded-2xl border-border bg-white shadow-sm">
            <CardContent className="space-y-5 p-5">
              {!selectedCampaign ? (
                noCampaignsCreated ? (
                  <div className="rounded-2xl border border-dashed border-border bg-slate-50 px-6 py-8">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <h3 className="text-lg font-bold text-foreground">{t("campaigns.empty.quickGuideTitle")}</h3>
                        <p className="text-sm leading-6 text-muted-foreground">{t("campaigns.empty.quickGuideDescription")}</p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          className="rounded-full"
                          onClick={() => setGuideDialogOpen(true)}
                        >
                          {t("campaigns.empty.openGuide")}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          className="rounded-full"
                          onClick={() => setGuideExpanded((current) => !current)}
                        >
                          {guideExpanded ? (
                            <ChevronUp className="mr-2 h-4 w-4" />
                          ) : (
                            <ChevronDown className="mr-2 h-4 w-4" />
                          )}
                          {guideExpanded ? t("campaigns.empty.hideGuide") : t("campaigns.empty.showGuide")}
                        </Button>
                      </div>

                      {guideExpanded && (
                        <div className="space-y-5 border-t border-border pt-4">
                          <div className="space-y-3">
                            <StepLine number="1" title={t("campaigns.empty.stepOneTitle")} description={t("campaigns.empty.stepOneDescription")} />
                            <StepLine number="2" title={t("campaigns.empty.stepTwoTitle")} description={t("campaigns.empty.stepTwoDescription")} />
                            <StepLine number="3" title={t("campaigns.empty.stepThreeTitle")} description={t("campaigns.empty.stepThreeDescription")} />
                          </div>

                          <div className="grid gap-4">
                            <DetailBlock title={t("campaigns.empty.snapshotTitle")}>
                              <div className="space-y-3">
                                <SnapshotLine
                                  label={t("campaigns.metric.queuedRuns")}
                                  value={String(templateOpportunities.find((item) => item.templateKey === "general_announcement")?.matching.length ?? 0)}
                                  detail={t("campaigns.empty.snapshotGeneral")}
                                />
                                <SnapshotLine
                                  label={t("campaigns.template.medication_reminder.title")}
                                  value={String(templateOpportunities.find((item) => item.templateKey === "medication_reminder")?.matching.length ?? 0)}
                                  detail={t("campaigns.empty.snapshotMedication")}
                                />
                                <SnapshotLine
                                  label={t("campaigns.template.wellbeing_check.title")}
                                  value={String(templateOpportunities.find((item) => item.templateKey === "wellbeing_check")?.matching.length ?? 0)}
                                  detail={t("campaigns.empty.snapshotWellbeing")}
                                />
                              </div>
                            </DetailBlock>

                            <DetailBlock title={t("campaigns.empty.campaignStatusTitle")}>
                              {campaigns.length === 0 ? (
                                <p className="text-sm text-muted-foreground">{t("campaigns.empty.campaignStatusEmpty")}</p>
                              ) : (
                                <div className="space-y-3">
                                  {campaigns.slice(0, 4).map((campaign) => {
                                    const state = operationalState(campaign);
                                    return (
                                      <button
                                        key={campaign.id}
                                        type="button"
                                        className="flex w-full items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-left transition hover:bg-slate-100"
                                        onClick={() => setSelectedCampaignId(campaign.id)}
                                      >
                                        <div className="min-w-0">
                                          <p className="truncate font-semibold text-foreground">{campaign.name}</p>
                                          <p className="text-sm text-muted-foreground">
                                            {[campaign.city || t("campaigns.scope.allCities"), formatDateTime(campaign.latestRun?.scheduledAt ?? campaign.scheduledAt)]
                                              .filter(Boolean)
                                              .join(" · ")}
                                          </p>
                                        </div>
                                        <Badge className={cn("shrink-0 rounded-full border-0 px-3 py-1 font-semibold", stateClasses(state))}>
                                          {t(`campaigns.state.${state}`)}
                                        </Badge>
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </DetailBlock>

                            <DetailBlock title={t("campaigns.empty.likelyRecipientsTitle")}>
                              {likelyRecipients.length === 0 ? (
                                <p className="text-sm text-muted-foreground">{t("campaigns.empty.noRecipients")}</p>
                              ) : (
                                <div className="space-y-3">
                                  {likelyRecipients.slice(0, 3).map((user) => {
                                    const templateKey =
                                      Number(user.criticalAlerts || 0) > 0
                                        ? "heatwave_alert"
                                        : (user.careProviderCount ?? 0) < 1
                                          ? "service_update"
                                          : Number(user.healthConditions || 0) > 0
                                            ? "medication_reminder"
                                            : Number(user.riskScore || 0) >= 50
                                              ? "wellbeing_check"
                                              : "general_announcement";
                                    return (
                                      <div key={user.id} className="rounded-2xl bg-slate-50 px-4 py-3">
                                        <div className="flex items-start justify-between gap-3">
                                          <div>
                                            <p className="font-semibold text-foreground">{`${user.first_name ?? ""} ${user.last_name ?? ""}`.trim() || "Unknown"}</p>
                                            <p className="text-sm text-muted-foreground">
                                              {[user.city || t("campaigns.scope.allCities"), t(campaignOpportunityReasonKey(user, templateKey))]
                                                .filter(Boolean)
                                                .join(" · ")}
                                            </p>
                                          </div>
                                          <Badge variant="outline" className="rounded-full border-primary/20 bg-primary/5 px-3 py-1 font-semibold text-primary">
                                            {templateLabel(templateKey)}
                                          </Badge>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </DetailBlock>

                            <DetailBlock title={t("campaigns.empty.gapsTitle")}>
                              <div className="space-y-3">
                                <GapLine label={t("campaigns.empty.gap.noPhone")} value={operationalGaps.missingPhone} />
                                <GapLine label={t("campaigns.empty.gap.checkins")} value={operationalGaps.checkinsOff} />
                                <GapLine label={t("campaigns.empty.gap.medication")} value={operationalGaps.medicationSignals} />
                                <GapLine label={t("campaigns.empty.gap.unassigned")} value={operationalGaps.unassignedCoverage} />
                                <GapLine label={t("campaigns.empty.gap.urgent")} value={operationalGaps.urgentSignals} />
                              </div>
                            </DetailBlock>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-border bg-slate-50 px-6 py-8">
                    <div className="space-y-5">
                      <div className="space-y-2">
                        <h3 className="text-lg font-bold text-foreground">{t("campaigns.empty.campaignStatusTitle")}</h3>
                        <p className="text-sm leading-6 text-muted-foreground">{t("campaigns.detail.noCampaignSelected")}</p>
                      </div>

                      <div className="space-y-3">
                        {campaigns.slice(0, 6).map((campaign) => {
                          const state = operationalState(campaign);
                          return (
                            <button
                              key={campaign.id}
                              type="button"
                              className="flex w-full items-center justify-between gap-3 rounded-2xl border border-border bg-white px-4 py-3 text-left transition hover:border-primary/30 hover:shadow-sm"
                              onClick={() => setSelectedCampaignId(campaign.id)}
                            >
                              <div className="min-w-0">
                                <p className="truncate font-semibold text-foreground">{campaign.name}</p>
                                <p className="text-sm text-muted-foreground">
                                  {[campaign.city || t("campaigns.scope.allCities"), formatDateTime(campaign.latestRun?.scheduledAt ?? campaign.scheduledAt)]
                                    .filter(Boolean)
                                    .join(" · ")}
                                </p>
                              </div>
                              <Badge className={cn("shrink-0 rounded-full border-0 px-3 py-1 font-semibold", stateClasses(state))}>
                                {t(`campaigns.state.${state}`)}
                              </Badge>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )
              ) : (
                <>
                  <div className="flex flex-col gap-3 border-b border-border pb-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="rounded-full border-primary/20 bg-primary/5 px-3 py-1 font-semibold text-primary">
                          {templateLabel(selectedCampaign.templateKey ?? "general_announcement")}
                        </Badge>
                        <Badge className={cn("rounded-full border-0 px-3 py-1 font-semibold", stateClasses(operationalState(selectedCampaign)))}>
                          {t(`campaigns.state.${operationalState(selectedCampaign)}`)}
                        </Badge>
                        {isAwaitingVoiceConnector(selectedCampaign) && (
                          <Badge variant="outline" className="rounded-full border-amber-300 bg-amber-50 px-3 py-1 text-amber-700">
                            {t("campaigns.state.awaitingVoiceConnector")}
                          </Badge>
                        )}
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-foreground">{selectedCampaign.name}</h2>
                        <p className="text-sm text-muted-foreground">{selectedCampaign.objective || templateObjective(selectedCampaign.templateKey ?? "general_announcement", selectedCampaign.city ?? "")}</p>
                      </div>
                    </div>

                    {canEditSelectedCampaign && (
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" variant="outline" className="rounded-full" onClick={() => openEditDialog(selectedCampaign)}>
                          {t("campaigns.action.edit")}
                        </Button>
                        {canManageCampaigns && (
                          <>
                            <Button
                              type="button"
                              variant="outline"
                              className="rounded-full"
                              onClick={() => runPreviewForCampaign(selectedCampaign, "preview")}
                              disabled={previewMutation.isPending}
                            >
                              {t("campaigns.action.previewRecipients")}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              className="rounded-full border-amber-300 text-amber-700 hover:bg-amber-50"
                              onClick={() => runPreviewForCampaign(selectedCampaign, "schedule")}
                              disabled={previewMutation.isPending}
                            >
                              {t("campaigns.action.scheduleCalls")}
                            </Button>
                            <Button
                              type="button"
                              className="rounded-full bg-primary hover:bg-primary/90"
                              onClick={() => runPreviewForCampaign(selectedCampaign, "queue")}
                              disabled={previewMutation.isPending}
                            >
                              {t("campaigns.call.immediateQueue")}
                            </Button>
                            {selectedRun && ["scheduled", "queued", "pending"].includes(selectedRun.status) && (
                              <Button
                                type="button"
                                variant="outline"
                                className="rounded-full border-red-200 text-red-700 hover:bg-red-50"
                                onClick={() => cancelRunMutation.mutate(selectedRun.id)}
                                disabled={cancelRunMutation.isPending}
                              >
                                {t("campaigns.call.cancelRun")}
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
                    <section className="rounded-2xl border border-border bg-slate-50 p-5">
                      <div className="space-y-5">
                        <div>
                          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("campaigns.detail.objective")}</p>
                          <p className="mt-2 text-base font-semibold leading-7 text-foreground">
                            {selectedCampaign.objective || templateObjective(selectedCampaign.templateKey ?? "general_announcement", selectedCampaign.city ?? "")}
                          </p>
                        </div>

                        <div className="grid gap-5 md:grid-cols-2">
                          <div>
                            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("campaigns.detail.audience")}</p>
                            <p className="mt-2 text-sm leading-6 text-foreground">
                              {selectedCampaign.audience || templateAudience(selectedCampaign.templateKey ?? "general_announcement", selectedCampaign.city ?? "")}
                            </p>
                          </div>
                          <div>
                            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("campaigns.detail.script")}</p>
                            <p className="mt-2 text-sm leading-6 text-foreground">
                              {selectedCampaign.latestRun?.callScript || selectedCampaign.callScript || templateScript(selectedCampaign.templateKey ?? "general_announcement")}
                            </p>
                          </div>
                        </div>
                      </div>
                    </section>

                    <section className="rounded-2xl border border-border bg-slate-50 p-5">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <InfoPair title={t("campaigns.detail.scope")} value={selectedCampaign.city || t("campaigns.scope.allCities")} />
                        <InfoPair title={t("campaigns.detail.scheduledTime")} value={formatDateTime(selectedCampaign.latestRun?.scheduledAt ?? selectedCampaign.scheduledAt)} />
                        <InfoPair title={t("campaigns.call.windowStart")} value={selectedCampaign.latestRun?.callWindowStart ?? selectedCampaign.callWindowStart ?? "—"} />
                        <InfoPair title={t("campaigns.call.windowEnd")} value={selectedCampaign.latestRun?.callWindowEnd ?? selectedCampaign.callWindowEnd ?? "—"} />
                        <InfoPair title={t("campaigns.detail.retryLimit")} value={String(selectedCampaign.latestRun?.retryLimit ?? selectedCampaign.retryLimit ?? 0)} />
                        <InfoPair title={t("campaigns.row.progress")} value={`${selectedCampaign.latestRun?.completedCount ?? 0}/${sumRunJobs(selectedCampaign.latestRun) || 0}`} />
                      </div>

                      <div className="mt-5 grid gap-3 sm:grid-cols-3">
                        <CompactStat title={t("campaigns.row.eligible")} value={String(selectedCampaign.latestRun?.eligibleCount ?? 0)} />
                        <CompactStat title={t("campaigns.row.skipped")} value={String(selectedCampaign.latestRun?.skippedCount ?? 0)} />
                        <CompactStat title={t("campaigns.detail.completed")} value={String(selectedCampaign.latestRun?.completedCount ?? 0)} />
                      </div>
                    </section>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-sm font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("campaigns.detail.recentRuns")}</h3>
                    </div>
                    {runsQuery.isLoading ? (
                      <Skeleton className="h-24 rounded-2xl" />
                    ) : runs.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-border bg-slate-50 px-4 py-6 text-sm text-muted-foreground">
                        {t("campaigns.detail.noRuns")}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {runs.map((run) => (
                          <button
                            key={run.id}
                            type="button"
                            className={cn(
                              "flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition hover:border-primary/30",
                              selectedRunId === run.id ? "border-primary/40 bg-primary/5" : "border-border bg-white",
                            )}
                            onClick={() => setSelectedRunId(run.id)}
                          >
                            <div>
                              <p className="font-semibold text-foreground">{formatDateTime(run.scheduledAt || run.createdAt)}</p>
                              <p className="text-sm text-muted-foreground">
                                {t("campaigns.detail.runSummary")
                                  .replace("{eligible}", String(run.eligibleCount))
                                  .replace("{completed}", String(run.completedCount))
                                  .replace("{skipped}", String(run.skippedCount))}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge className={cn("rounded-full border-0 px-3 py-1 font-semibold", stateClasses(operationalState({ ...selectedCampaign, latestRun: run })))}>
                                {t(runJobStatusKey(run.status))}
                              </Badge>
                              {(run.status === "queued" || run.status === "pending" || run.status === "calling") && (
                                <Badge variant="outline" className="rounded-full border-amber-300 bg-amber-50 px-3 py-1 text-amber-700">
                                  {t("campaigns.state.awaitingVoiceConnector")}
                                </Badge>
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-sm font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("campaigns.detail.recipientJobs")}</h3>
                      {selectedRun && (
                        <p className="text-xs text-muted-foreground">{formatDateTime(selectedRun.scheduledAt || selectedRun.createdAt)}</p>
                      )}
                    </div>
                    <div className="overflow-hidden rounded-2xl border border-border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{t("campaigns.targets.person")}</TableHead>
                            <TableHead>{t("campaigns.form.city")}</TableHead>
                            <TableHead>{t("campaigns.preview.includedReason")}</TableHead>
                            <TableHead>{t("campaigns.preview.status")}</TableHead>
                            <TableHead>{t("campaigns.detail.attempts")}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {jobsQuery.isLoading ? (
                            <TableRow>
                              <TableCell colSpan={5}>
                                <Skeleton className="h-12 w-full" />
                              </TableCell>
                            </TableRow>
                          ) : jobs.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                                {t("campaigns.detail.noJobs")}
                              </TableCell>
                            </TableRow>
                          ) : (
                            jobs.map((job) => (
                              <TableRow key={job.id}>
                                <TableCell className="font-medium text-foreground">{job.displayName}</TableCell>
                                <TableCell>{job.city || "—"}</TableCell>
                                <TableCell>{t(job.reasonKey)}</TableCell>
                                <TableCell>
                                  <div className="flex flex-wrap gap-2">
                                    <Badge className={cn("rounded-full border-0 px-3 py-1 font-semibold", stateClasses(
                                      job.status === "completed"
                                        ? "completed"
                                        : job.status === "failed"
                                          ? "failed"
                                          : job.status === "cancelled"
                                            ? "cancelled"
                                            : job.status === "skipped"
                                              ? "scheduled"
                                              : "queued",
                                    ))}>
                                      {t(runJobStatusKey(job.status))}
                                    </Badge>
                                    {job.skipReason && (
                                      <Badge variant="outline" className="rounded-full px-3 py-1">
                                        {t(skipReasonKey(job.skipReason))}
                                      </Badge>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell>{job.attemptCount ?? 0}</TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      <Dialog open={guideDialogOpen} onOpenChange={setGuideDialogOpen}>
        <DialogContent className="flex max-h-[calc(100vh-2rem)] max-w-2xl flex-col overflow-hidden rounded-2xl border-border bg-white p-0">
          <DialogHeader className="border-b border-border px-6 py-5 text-left">
            <DialogTitle className="text-2xl font-bold text-foreground">{t("campaigns.empty.panelTitle")}</DialogTitle>
            <DialogDescription className="text-sm leading-6 text-muted-foreground">
              {t("campaigns.empty.panelDescription")}
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
            <div className="space-y-3">
              <StepLine number="1" title={t("campaigns.empty.stepOneTitle")} description={t("campaigns.empty.stepOneDescription")} />
              <StepLine number="2" title={t("campaigns.empty.stepTwoTitle")} description={t("campaigns.empty.stepTwoDescription")} />
              <StepLine number="3" title={t("campaigns.empty.stepThreeTitle")} description={t("campaigns.empty.stepThreeDescription")} />
            </div>

            {guideExpanded && (
              <div className="grid gap-4 border-t border-border pt-4">
                <DetailBlock title={t("campaigns.empty.snapshotTitle")}>
                  <div className="space-y-3">
                    <SnapshotLine
                      label={t("campaigns.metric.queuedRuns")}
                      value={String(templateOpportunities.find((item) => item.templateKey === "general_announcement")?.matching.length ?? 0)}
                      detail={t("campaigns.empty.snapshotGeneral")}
                    />
                    <SnapshotLine
                      label={t("campaigns.template.medication_reminder.title")}
                      value={String(templateOpportunities.find((item) => item.templateKey === "medication_reminder")?.matching.length ?? 0)}
                      detail={t("campaigns.empty.snapshotMedication")}
                    />
                    <SnapshotLine
                      label={t("campaigns.template.wellbeing_check.title")}
                      value={String(templateOpportunities.find((item) => item.templateKey === "wellbeing_check")?.matching.length ?? 0)}
                      detail={t("campaigns.empty.snapshotWellbeing")}
                    />
                  </div>
                </DetailBlock>
                <DetailBlock title={t("campaigns.empty.gapsTitle")}>
                  <div className="space-y-3">
                    <GapLine label={t("campaigns.empty.gap.noPhone")} value={operationalGaps.missingPhone} />
                    <GapLine label={t("campaigns.empty.gap.checkins")} value={operationalGaps.checkinsOff} />
                    <GapLine label={t("campaigns.empty.gap.medication")} value={operationalGaps.medicationSignals} />
                    <GapLine label={t("campaigns.empty.gap.unassigned")} value={operationalGaps.unassignedCoverage} />
                    <GapLine label={t("campaigns.empty.gap.urgent")} value={operationalGaps.urgentSignals} />
                  </div>
                </DetailBlock>
              </div>
            )}
          </div>

          <DialogFooter className="flex flex-col gap-2 border-t border-border px-6 py-4 sm:flex-row sm:justify-between">
            <Button
              type="button"
              variant="outline"
              className="rounded-full"
              onClick={() => setGuideExpanded((current) => !current)}
            >
              {guideExpanded ? (
                <ChevronUp className="mr-2 h-4 w-4" />
              ) : (
                <ChevronDown className="mr-2 h-4 w-4" />
              )}
              {guideExpanded ? t("campaigns.empty.hideGuide") : t("campaigns.empty.showGuide")}
            </Button>
            <Button type="button" className="rounded-full bg-primary hover:bg-primary/90" onClick={() => setGuideDialogOpen(false)}>
              {t("campaigns.empty.popupPrimary")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editorOpen}
        onOpenChange={(open) => {
          setEditorOpen(open);
          if (!open) clearCreateIntent();
        }}
      >
        <DialogContent className="flex max-h-[90vh] max-w-4xl flex-col overflow-hidden rounded-2xl border-border bg-[#f7f9ff] p-0">
          <DialogHeader className="border-b border-border bg-white px-6 py-5 text-left">
            <DialogTitle className="text-2xl font-bold text-foreground">
              {form?.id ? t("campaigns.form.editTitle") : t("campaigns.form.title")}
            </DialogTitle>
            <DialogDescription>{t("campaigns.form.description")}</DialogDescription>
          </DialogHeader>

          {form && (
            <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">
              <div className="mb-5 rounded-2xl border border-border bg-white px-4 py-3">
                <div className="grid gap-2 sm:grid-cols-4">
                {[
                  { step: 1 as WizardStep, title: t("campaigns.wizard.stepTemplate"), description: templateLabel(form.templateKey) },
                  { step: 2 as WizardStep, title: t("campaigns.wizard.stepTarget"), description: `${localTargetSummary.eligible.length} ${t("campaigns.wizard.eligibleShort")}` },
                  { step: 3 as WizardStep, title: t("campaigns.wizard.stepScript"), description: form.callScript.trim() ? t("campaigns.wizard.scriptReady") : t("campaigns.wizard.scriptMissing") },
                  { step: 4 as WizardStep, title: t("campaigns.wizard.stepReview"), description: t("campaigns.wizard.reviewDescription") },
                ].map((item) => (
                  <button
                    key={item.step}
                    type="button"
                    onClick={() => setWizardStep(item.step)}
                    className={cn(
                      "rounded-2xl border px-4 py-3 text-left transition",
                      wizardStep === item.step ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "border-border bg-white hover:border-primary/20",
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <span className={cn(
                        "flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                        wizardStep === item.step ? "bg-primary text-white" : "bg-primary/10 text-primary",
                      )}>
                        {item.step}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground">{item.title}</p>
                        <p className="mt-1 truncate text-sm text-muted-foreground">{item.description}</p>
                      </div>
                    </div>
                  </button>
                ))}
                </div>
              </div>

              {wizardStep === 1 && (
                <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
                  <div className="rounded-2xl border border-border bg-white p-5">
                    <div className="mb-4 space-y-1">
                      <h3 className="text-xl font-bold text-foreground">{t("campaigns.form.template")}</h3>
                      <p className="text-sm leading-6 text-muted-foreground">{t("campaigns.form.templateDescription")}</p>
                    </div>
                    <div className="space-y-3">
                      {createTemplateKeys.map((templateKey) => {
                        const Icon = templateIcon(templateKey);
                        const active = form.templateKey === templateKey;
                        return (
                          <button
                            key={templateKey}
                            type="button"
                            onClick={() => setForm((current) => current ? {
                              ...current,
                              templateKey,
                              name: isCustomTemplate(templateKey) ? current.name : templateLabel(templateKey),
                              audience: isCustomTemplate(templateKey) ? current.audience : templateAudience(templateKey, current.city),
                              objective: isCustomTemplate(templateKey) ? current.objective : templateObjective(templateKey, current.city),
                              callScript: templateScript(templateKey),
                            } : current)}
                            className={cn(
                              "flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition",
                              active ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "border-border bg-slate-50 hover:border-primary/20",
                            )}
                          >
                            <span className={cn("rounded-full p-2 shadow-sm", active ? "bg-primary text-white" : "bg-white text-primary")}>
                              <Icon className="h-4 w-4" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block font-semibold text-foreground">{templateLabel(templateKey)}</span>
                              <span className="mt-1 block text-sm leading-6 text-muted-foreground">{templateDescription(templateKey)}</span>
                            </span>
                            {active && <Badge className="rounded-full border-0 bg-primary/10 text-primary">{t("campaigns.wizard.selected")}</Badge>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <aside className="space-y-4 rounded-2xl border border-border bg-white p-5">
                    <div className="space-y-2">
                      <Label htmlFor="campaign-name">{t("campaigns.form.name")}</Label>
                      <Input
                        id="campaign-name"
                        value={form.name}
                        onChange={(event) => setForm((current) => current ? { ...current, name: event.target.value } : current)}
                        placeholder={t("campaigns.form.namePlaceholder")}
                      />
                    </div>
                    <DetailBlock title={t("campaigns.wizard.templateChoice")}>
                      <p className="text-sm leading-6 text-muted-foreground">{templateDescription(form.templateKey)}</p>
                    </DetailBlock>
                  </aside>
                </section>
              )}

              {wizardStep === 2 && (
                <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
                  <div className="space-y-5">
                    <div className="rounded-2xl border border-border bg-white p-5">
                      <h3 className="text-lg font-bold text-foreground">{t("campaigns.target.where")}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">{t("campaigns.target.whereHelp")}</p>
                      <div className="mt-4 grid gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
                        <Select
                          value={form.targetRules.geo.scope}
                          onValueChange={(value) => updateTargetRules((rules) => ({
                            ...rules,
                            geo: { ...rules.geo, scope: value as CampaignTargetRules["geo"]["scope"] },
                          }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="organization">{t("campaigns.target.geo.organization")}</SelectItem>
                            <SelectItem value="country">{t("campaigns.target.geo.country")}</SelectItem>
                            <SelectItem value="city">{t("campaigns.target.geo.city")}</SelectItem>
                            <SelectItem value="area">{t("campaigns.target.geo.area")}</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input
                          value={form.targetRules.geo.scope === "city" ? form.city : form.targetRules.geo.value}
                          list="campaign-city-options"
                          disabled={form.targetRules.geo.scope === "organization"}
                          onChange={(event) => {
                            const value = event.target.value;
                            if (form.targetRules.geo.scope === "city") setCampaignCity(value);
                            else updateTargetRules((rules) => ({ ...rules, geo: { ...rules.geo, value } }));
                          }}
                          placeholder={form.targetRules.geo.scope === "organization" ? t("campaigns.target.geo.allOrg") : t("campaigns.form.cityPlaceholder")}
                        />
                        <datalist id="campaign-city-options">
                          {availableCities.map((city) => <option key={city} value={city} />)}
                        </datalist>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-border bg-white p-5">
                      <h3 className="text-lg font-bold text-foreground">{t("campaigns.target.who")}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">{t("campaigns.target.whoHelp")}</p>
                      <div className="mt-4 grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label>{t("campaigns.target.riskLevel")}</Label>
                          <Select
                            value={form.targetRules.riskLevel}
                            onValueChange={(value) => updateTargetRules((rules) => ({ ...rules, riskLevel: value as CampaignTargetRules["riskLevel"] }))}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">{t("campaigns.target.risk.all")}</SelectItem>
                              <SelectItem value="urgent">{t("campaigns.target.risk.urgent")}</SelectItem>
                              <SelectItem value="high">{t("campaigns.target.risk.high")}</SelectItem>
                              <SelectItem value="review">{t("campaigns.target.risk.review")}</SelectItem>
                              <SelectItem value="stable">{t("campaigns.target.risk.stable")}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>{t("campaigns.target.healthConditions")}</Label>
                          <div className="flex gap-2">
                            <Input
                              value={healthConditionDraft}
                              onChange={(event) => setHealthConditionDraft(event.target.value)}
                              onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                  event.preventDefault();
                                  addHealthConditionRule();
                                }
                              }}
                              placeholder={t("campaigns.target.healthPlaceholder")}
                            />
                            <Button type="button" variant="outline" onClick={addHealthConditionRule}>{t("campaigns.target.add")}</Button>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {form.targetRules.healthConditions.map((condition) => (
                              <button
                                key={condition}
                                type="button"
                                className="rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary"
                                onClick={() => updateTargetRules((rules) => ({
                                  ...rules,
                                  healthConditions: rules.healthConditions.filter((item) => item !== condition),
                                }))}
                              >
                                {condition}
                              </button>
                            ))}
                            {form.targetRules.healthConditions.length === 0 && (
                              <p className="text-sm text-muted-foreground">{t("campaigns.target.healthNone")}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-border bg-white p-5">
                      <h3 className="text-lg font-bold text-foreground">{t("campaigns.target.supportCoverage")}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">{t("campaigns.target.supportHelp")}</p>
                      <div className="mt-4 grid gap-4 md:grid-cols-2">
                        <Select
                          value={form.targetRules.careProvider.mode}
                          onValueChange={(value) => updateTargetRules((rules) => ({
                            ...rules,
                            careProvider: { ...rules.careProvider, mode: value as CampaignTargetRules["careProvider"]["mode"] },
                          }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">{t("campaigns.target.provider.all")}</SelectItem>
                            <SelectItem value="unassigned">{t("campaigns.target.provider.unassigned")}</SelectItem>
                            <SelectItem value="assigned">{t("campaigns.target.provider.assigned")}</SelectItem>
                          </SelectContent>
                        </Select>
                        <Select
                          value={form.targetRules.careProvider.providerName || "any"}
                          disabled={form.targetRules.careProvider.mode !== "assigned"}
                          onValueChange={(value) => updateTargetRules((rules) => ({
                            ...rules,
                            careProvider: { ...rules.careProvider, providerName: value === "any" ? "" : value, providerId: "" },
                          }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="any">{t("campaigns.target.provider.choose")}</SelectItem>
                            {careProviderOptions.map((name) => (
                              <SelectItem key={name} value={name}>{name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  <aside className="space-y-4 rounded-2xl border border-border bg-white p-5">
                    <h3 className="text-lg font-bold text-foreground">{t("campaigns.target.summary")}</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <MiniStat title={t("campaigns.preview.eligibleCount")} value={String(localTargetSummary.eligible.length)} />
                      <MiniStat title={t("campaigns.preview.skippedCount")} value={String(localTargetSummary.skipped.length)} />
                    </div>
                    <DetailBlock title={t("campaigns.call.skipReasons")}>
                      <div className="space-y-2">
                        <GapLine label={t("campaigns.call.noPhone")} value={localTargetSummary.skippedReasons.noPhone} />
                        <GapLine label={t("campaigns.call.outsideGeo")} value={localTargetSummary.skippedReasons.outsideGeo} />
                        <GapLine label={t("campaigns.call.riskMismatch")} value={localTargetSummary.skippedReasons.riskMismatch} />
                        <GapLine label={t("campaigns.call.healthMismatch")} value={localTargetSummary.skippedReasons.healthMismatch} />
                        <GapLine label={t("campaigns.call.providerMismatch")} value={localTargetSummary.skippedReasons.providerMismatch} />
                        <GapLine label={t("campaigns.call.templateMismatch")} value={localTargetSummary.skippedReasons.templateMismatch} />
                      </div>
                    </DetailBlock>
                    <DetailBlock title={t("campaigns.target.requiredSafeguards")}>
                      <div className="flex flex-wrap gap-2">
                        <Badge className="rounded-full border-0 bg-emerald-100 px-3 py-1 text-emerald-700">{t("campaigns.call.consentOnly")}</Badge>
                        <Badge className="rounded-full border-0 bg-emerald-100 px-3 py-1 text-emerald-700">{t("campaigns.target.phoneRequired")}</Badge>
                      </div>
                    </DetailBlock>
                    <DetailBlock title={t("campaigns.empty.likelyRecipientsTitle")}>
                      <div className="space-y-2">
                        {localTargetSummary.eligible.slice(0, 4).map((target) => (
                          <div key={target.id} className="rounded-xl bg-slate-50 px-3 py-2 text-sm">
                            <p className="font-semibold text-foreground">{`${target.first_name ?? ""} ${target.last_name ?? ""}`.trim() || "Unknown"}</p>
                            <p className="text-muted-foreground">{target.city || t("campaigns.scope.allCities")}</p>
                          </div>
                        ))}
                        {localTargetSummary.eligible.length > 4 && (
                          <p className="text-sm font-semibold text-primary">
                            {t("campaigns.target.moreRecipients").replace("{count}", String(localTargetSummary.eligible.length - 4))}
                          </p>
                        )}
                        {localTargetSummary.eligible.length === 0 && (
                          <p className="text-sm text-muted-foreground">{t("campaigns.empty.noRecipients")}</p>
                        )}
                      </div>
                    </DetailBlock>
                  </aside>
                </section>
              )}

              {wizardStep === 3 && (
                <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
                  <div className="space-y-5 rounded-2xl border border-border bg-white p-5">
                    <div className="space-y-2">
                      <h3 className="text-xl font-bold text-foreground">{t("campaigns.call.script")}</h3>
                      <p className="text-sm leading-6 text-muted-foreground">{t("campaigns.call.scriptHelp")}</p>
                    </div>
                    <Textarea
                      id="campaign-script"
                      value={form.callScript}
                      onChange={(event) => setForm((current) => current ? { ...current, callScript: event.target.value } : current)}
                      placeholder={t("campaigns.call.scriptPlaceholder")}
                      className="min-h-[320px]"
                    />
                  </div>
                  <aside className="space-y-4 rounded-2xl border border-primary/15 bg-primary/5 p-5">
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-primary/10 p-2 text-primary">
                        <Sparkles className="h-4 w-4" />
                      </span>
                      <h3 className="text-lg font-bold text-foreground">{t("campaigns.ai.title")}</h3>
                    </div>
                    <p className="text-sm leading-6 text-muted-foreground">{t("campaigns.ai.description")}</p>
                    <Textarea
                      id="campaign-ai-prompt"
                      value={form.aiPrompt}
                      onChange={(event) => setForm((current) => current ? { ...current, aiPrompt: event.target.value } : current)}
                      placeholder={t("campaigns.ai.promptPlaceholder")}
                      className="min-h-[120px]"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full rounded-full"
                      onClick={() => setAiSuggestion(buildAiSuggestion(form))}
                    >
                      <Sparkles className="mr-2 h-4 w-4 text-primary" />
                      {aiSuggestion ? t("campaigns.ai.regenerate") : t("campaigns.ai.open")}
                    </Button>
                    {aiSuggestion && (
                      <div className="space-y-3 rounded-2xl bg-slate-50 p-4">
                        <p className="font-semibold text-foreground">{aiSuggestion.name}</p>
                        <p className="text-sm leading-6 text-muted-foreground">{aiSuggestion.objective}</p>
                        <Button
                          type="button"
                          className="w-full rounded-full bg-primary hover:bg-primary/90"
                          onClick={() => {
                            setForm((current) => current ? {
                              ...current,
                              templateKey: aiSuggestion.templateKey,
                              name: aiSuggestion.name,
                              audience: aiSuggestion.audience,
                              objective: aiSuggestion.objective,
                              callScript: aiSuggestion.callScript,
                            } : current);
                            toast({ title: t("campaigns.ai.appliedTitle"), description: t("campaigns.ai.appliedDescription") });
                          }}
                        >
                          {t("campaigns.ai.apply")}
                        </Button>
                      </div>
                    )}
                  </aside>
                </section>
              )}

              {wizardStep === 4 && (
                <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
                  <div className="space-y-5 rounded-2xl border border-border bg-white p-5">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="campaign-scheduled-at">{t("campaigns.form.scheduledAt")}</Label>
                        <Input
                          id="campaign-scheduled-at"
                          type="datetime-local"
                          value={form.scheduledAt}
                          onChange={(event) => setForm((current) => current ? { ...current, scheduledAt: event.target.value } : current)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="campaign-retry">{t("campaigns.call.retryLimit")}</Label>
                        <Input
                          id="campaign-retry"
                          type="number"
                          min="0"
                          max="5"
                          value={form.retryLimit}
                          onChange={(event) => setForm((current) => current ? { ...current, retryLimit: event.target.value } : current)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="campaign-window-start">{t("campaigns.call.windowStart")}</Label>
                        <Input
                          id="campaign-window-start"
                          type="time"
                          value={form.callWindowStart}
                          onChange={(event) => setForm((current) => current ? { ...current, callWindowStart: event.target.value } : current)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="campaign-window-end">{t("campaigns.call.windowEnd")}</Label>
                        <Input
                          id="campaign-window-end"
                          type="time"
                          value={form.callWindowEnd}
                          onChange={(event) => setForm((current) => current ? { ...current, callWindowEnd: event.target.value } : current)}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="campaign-objective">{t("campaigns.detail.objective")}</Label>
                      <Textarea
                        id="campaign-objective"
                        value={form.objective}
                        onChange={(event) => setForm((current) => current ? { ...current, objective: event.target.value } : current)}
                        className="min-h-[96px]"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="campaign-audience">{t("campaigns.detail.audience")}</Label>
                      <Textarea
                        id="campaign-audience"
                        value={form.audience}
                        onChange={(event) => setForm((current) => current ? { ...current, audience: event.target.value } : current)}
                        className="min-h-[96px]"
                      />
                    </div>
                    <DetailBlock title={t("campaigns.call.scriptPreview")}>
                      <p className="whitespace-pre-line text-sm leading-6 text-foreground">{form.callScript || t("campaigns.call.scriptPlaceholder")}</p>
                    </DetailBlock>
                  </div>
                  <aside className="space-y-4 rounded-2xl border border-border bg-white p-5">
                    <h3 className="text-lg font-bold text-foreground">{t("campaigns.wizard.reviewReady")}</h3>
                    <InfoPair title={t("campaigns.form.template")} value={templateLabel(form.templateKey)} />
                    <InfoPair title={t("campaigns.form.name")} value={form.name.trim() || templateLabel(form.templateKey)} />
                    <InfoPair title={t("campaigns.detail.scope")} value={form.targetRules.geo.scope === "organization" ? t("campaigns.target.geo.allOrg") : form.targetRules.geo.value || form.city || t("campaigns.scope.allCities")} />
                    <InfoPair title={t("campaigns.form.scheduledAt")} value={formatDateTime(toIsoOrNull(form.scheduledAt))} />
                    <InfoPair title={t("campaigns.call.schedule")} value={formatTimeRange(form.callWindowStart, form.callWindowEnd)} />
                    <InfoPair title={t("campaigns.call.retryLimit")} value={form.retryLimit} />
                    <div className="grid grid-cols-2 gap-3">
                      <MiniStat title={t("campaigns.preview.eligibleCount")} value={String(localTargetSummary.eligible.length)} />
                      <MiniStat title={t("campaigns.preview.skippedCount")} value={String(localTargetSummary.skipped.length)} />
                    </div>
                  </aside>
                </section>
              )}
            </div>
          )}

          <DialogFooter className="flex flex-col gap-2 border-t border-border bg-white px-6 py-4 sm:flex-row sm:justify-between">
            <Button type="button" variant="outline" onClick={() => setEditorOpen(false)}>
              {t("campaigns.form.cancel")}
            </Button>
            <div className="flex flex-wrap gap-2">
              {wizardStep > 1 && (
                <Button type="button" variant="outline" onClick={previousWizardStep}>
                  {t("campaigns.wizard.back")}
                </Button>
              )}
              {wizardStep < 4 ? (
                <Button type="button" onClick={nextWizardStep} disabled={!canMoveNext(wizardStep)}>
                  {t("campaigns.wizard.next")}
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={() => form && saveMutation.mutate({ draft: form, status: "draft" })}
                  disabled={!form || saveMutation.isPending || !canDraftCampaigns}
                >
                  {t("campaigns.action.saveDraft")}
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto rounded-2xl border-border bg-white">
          <DialogHeader>
            <DialogTitle>{t("campaigns.call.confirmTitle")}</DialogTitle>
            <DialogDescription>{t("campaigns.call.confirmDescription")}</DialogDescription>
          </DialogHeader>

          {previewData && (
            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <MiniStat title={t("campaigns.preview.eligibleCount")} value={String(previewData.eligibleCount)} />
                <MiniStat title={t("campaigns.preview.skippedCount")} value={String(previewData.skippedCount)} />
                <MiniStat title={t("campaigns.call.schedule")} value={formatDateTime(previewData.scheduledAt)} />
                <MiniStat title={t("campaigns.call.retryLimit")} value={String(previewData.retryLimit ?? 0)} />
              </div>

              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
                <div className="rounded-2xl border border-border p-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("campaigns.call.scriptPreview")}</p>
                  <p className="mt-2 text-sm leading-6 text-foreground">{previewData.callScript || "—"}</p>
                </div>
                <div className="rounded-2xl border border-border p-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("campaigns.call.skipReasons")}</p>
                  <div className="mt-3 space-y-2 text-sm">
                    <SkipLine label={t("campaigns.call.noPhone")} value={previewData.skipped.noPhone} />
                    <SkipLine label={t("campaigns.call.noConsent")} value={previewData.skipped.noConsent} />
                    <SkipLine label={t("campaigns.call.outsideWindow")} value={previewData.skipped.outsideCallWindow} />
                    <SkipLine label={t("campaigns.call.duplicateTarget")} value={previewData.skipped.duplicateTarget} />
                  </div>
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("campaigns.targets.person")}</TableHead>
                      <TableHead>{t("campaigns.form.city")}</TableHead>
                      <TableHead>{t("campaigns.preview.includedReason")}</TableHead>
                      <TableHead>{t("campaigns.preview.status")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewData.recipients.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                          {t("campaigns.preview.none")}
                        </TableCell>
                      </TableRow>
                    ) : (
                      previewData.recipients.map((recipient) => (
                        <TableRow key={`${recipient.userId}-${recipient.status}`}>
                          <TableCell className="font-medium text-foreground">{recipient.displayName}</TableCell>
                          <TableCell>{recipient.city || "—"}</TableCell>
                          <TableCell>{t(recipient.reasonKey)}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-2">
                              <Badge className={cn(
                                "rounded-full border-0 px-3 py-1 font-semibold",
                                recipient.status === "eligible" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700",
                              )}>
                                {recipient.status === "eligible" ? t("campaigns.call.eligible") : t("campaigns.call.skipped")}
                              </Badge>
                              {recipient.skipReason && (
                                <Badge variant="outline" className="rounded-full px-3 py-1">
                                  {t(skipReasonKey(recipient.skipReason))}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPreviewOpen(false)}>
              {t("campaigns.form.cancel")}
            </Button>
            {previewAction !== "preview" && selectedCampaign && canManageCampaigns && (
              <Button
                type="button"
                onClick={() => queueMutation.mutate({ campaign: selectedCampaign, action: previewAction })}
                disabled={queueMutation.isPending || !previewData || previewData.eligibleCount < 1}
              >
                {previewAction === "schedule" ? t("campaigns.action.scheduleCalls") : t("campaigns.call.confirmQueue")}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MetricLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-slate-50/80 px-4 py-3">
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-bold text-foreground">{value}</p>
    </div>
  );
}

function MiniStat({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-white px-4 py-3">
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{title}</p>
      <p className="mt-2 text-2xl font-bold text-foreground">{value}</p>
    </div>
  );
}

function DetailBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-white p-4">
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{title}</p>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function InfoPair({ title, value }: { title: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{title}</p>
      <p className="text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

function CompactStat({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white px-4 py-3 shadow-sm">
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{title}</p>
      <p className="mt-2 text-xl font-bold text-foreground">{value}</p>
    </div>
  );
}

function StepLine({ number, title, description }: { number: string; title: string; description: string }) {
  return (
    <div className="flex items-start gap-4 rounded-2xl border border-border bg-white px-4 py-4">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
        {number}
      </div>
      <div className="space-y-1">
        <p className="text-sm font-bold text-foreground">{title}</p>
        <p className="text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function SnapshotLine({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <p className="font-semibold text-foreground">{label}</p>
        <span className="text-lg font-bold text-foreground">{value}</span>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
    </div>
  );
}

function GapLine({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="font-semibold text-foreground">{value}</span>
    </div>
  );
}

function SkipLine({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold text-foreground">{value}</span>
    </div>
  );
}

