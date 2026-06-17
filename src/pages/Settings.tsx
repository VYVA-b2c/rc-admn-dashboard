import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageSelector } from "@/components/LanguageSelector";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { ArrowLeft, Building2, Languages, Lock, Pencil, Plus, ShieldCheck } from "lucide-react";
import { authBypassEnabled } from "@/lib/authMode";
import { ACTIVE_ORGANIZATION_STORAGE_KEY, apiFetch } from "@/lib/apiClient";
import { useCurrentUserContext, type OrganizationContext } from "@/hooks/useCurrentUserContext";

type OrganizationsResponse = {
  currentOrganization: OrganizationContext | null;
  organizations: OrganizationContext[];
};

type LanguageCode = "en" | "de" | "es";

const emptyOrganizationForm = {
  active: true,
  country: "",
  defaultLanguage: "de" as LanguageCode,
  name: "",
  slug: "",
  timezone: "Europe/Berlin",
};

const fallbackOrganizations: OrganizationContext[] = [
  {
    active: true,
    country: "Spain",
    defaultLanguage: "es",
    id: "red-cross-zamora",
    name: "Red Cross Zamora",
    slug: "red-cross-zamora",
    timezone: "Europe/Madrid",
  },
  {
    active: true,
    country: "Germany",
    defaultLanguage: "de",
    id: "red-cross-leipzig",
    name: "Red Cross Leipzig",
    slug: "red-cross-leipzig",
    timezone: "Europe/Berlin",
  },
];

function suggestedTimezone(language: string) {
  return language === "es" ? "Europe/Madrid" : "Europe/Berlin";
}

export default function Settings() {
  const { user, updatePassword } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: currentContext, isLoading: loadingCurrentContext } = useCurrentUserContext();
  const currentUser = currentContext?.user;
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [organizationForm, setOrganizationForm] = useState(emptyOrganizationForm);
  const [organizationDialogMode, setOrganizationDialogMode] = useState<"create" | "edit" | null>(null);
  const [editingOrganizationId, setEditingOrganizationId] = useState<string | null>(null);
  const [branchLanguage, setBranchLanguage] = useState<LanguageCode>("de");
  const [branchTimezone, setBranchTimezone] = useState("Europe/Berlin");
  const [activeOrganizationId, setActiveOrganizationId] = useState(() => localStorage.getItem(ACTIVE_ORGANIZATION_STORAGE_KEY) || "");

  const organizationsQuery = useQuery({
    queryKey: ["organizations"],
    queryFn: async () => {
      try {
        return await apiFetch<OrganizationsResponse>("/api/v1/organizations?includeInactive=true");
      } catch {
        return {
          currentOrganization: fallbackOrganizations[1],
          organizations: fallbackOrganizations,
        };
      }
    },
    retry: false,
  });
  const organizations = organizationsQuery.data?.organizations?.length ? organizationsQuery.data.organizations : fallbackOrganizations;
  const activeOrganization = activeOrganizationId
    ? organizations.find((organization) => organization.id === activeOrganizationId || organization.slug === activeOrganizationId)
    : null;
  const currentOrganization =
    activeOrganization ??
    currentUser?.organization ??
    organizationsQuery.data?.currentOrganization ??
    organizations.find((organization) => organization.id) ??
    null;
  const organizationPlaceholder =
    loadingCurrentContext || organizationsQuery.isLoading ? t("settings.loadingOrganization") : t("settings.notAvailable");
  const canManageCurrentOrganization = Boolean(currentUser?.isPlatformAdmin || currentUser?.isAdmin);
  const canManageOrganizationDirectory = Boolean(currentUser?.isPlatformAdmin);
  const roleLabel = loadingCurrentContext
    ? t("settings.loadingOrganization")
    : currentUser?.isPlatformAdmin
      ? t("settings.role.superAdmin")
      : currentUser?.isAdmin
        ? t("settings.role.admin")
        : t("settings.role.operator");
  const roleBadgeClass = currentUser?.isPlatformAdmin || currentUser?.isAdmin
    ? "border-primary/20 bg-primary/10 text-primary"
    : "border-orange-200 bg-orange-50 text-orange-700";

  useEffect(() => {
    if (!currentOrganization) return;
    setBranchLanguage(currentOrganization.defaultLanguage || "de");
    setBranchTimezone(currentOrganization.timezone || suggestedTimezone(currentOrganization.defaultLanguage || "de"));
  }, [currentOrganization]);

  const createOrganization = useMutation({
    mutationFn: (payload: typeof emptyOrganizationForm) =>
      apiFetch<{ organization: OrganizationContext }>("/api/v1/organizations", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: async ({ organization }) => {
      toast.success(t("settings.organizationCreated"));
      setOrganizationForm(emptyOrganizationForm);
      setOrganizationDialogMode(null);
      setEditingOrganizationId(null);
      if (organization.id) {
        setActiveOrganizationId(organization.id);
        localStorage.setItem(ACTIVE_ORGANIZATION_STORAGE_KEY, organization.id);
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["organizations"] }),
        queryClient.invalidateQueries({ queryKey: ["organizations", "header"] }),
        queryClient.invalidateQueries({ queryKey: ["current-user-context"] }),
      ]);
    },
    onError: () => {
      toast.error(t("settings.organizationCreateFailed"));
    },
  });

  const updateOrganization = useMutation({
    mutationFn: ({ id, ...payload }: { id: string } & Partial<typeof emptyOrganizationForm>) =>
      apiFetch<{ organization: OrganizationContext }>(`/api/v1/organizations/${id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
    onSuccess: async () => {
      toast.success(t("settings.organizationUpdated"));
      setOrganizationDialogMode(null);
      setEditingOrganizationId(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["organizations"] }),
        queryClient.invalidateQueries({ queryKey: ["organizations", "header"] }),
        queryClient.invalidateQueries({ queryKey: ["current-user-context"] }),
      ]);
    },
    onError: () => {
      toast.error(t("settings.organizationUpdateFailed"));
    },
  });

  const updateOrganizationForm = (key: keyof typeof organizationForm, value: string | boolean) => {
    setOrganizationForm((current) => {
      if (key === "defaultLanguage") {
        const language = String(value) as LanguageCode;
        return {
          ...current,
          defaultLanguage: language,
          timezone: current.timezone || suggestedTimezone(language),
        };
      }
      if (key === "name" && !current.slug) {
        const name = String(value);
        return {
          ...current,
          name,
          slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
        };
      }
      return { ...current, [key]: value };
    });
  };

  const openCreateOrganization = () => {
    if (!canManageOrganizationDirectory) return;
    setOrganizationForm(emptyOrganizationForm);
    setEditingOrganizationId(null);
    setOrganizationDialogMode("create");
  };

  const openEditOrganization = (organization: OrganizationContext) => {
    if (!organization.id) return;
    if (!canManageOrganizationDirectory && organization.id !== currentOrganization?.id) return;
    setOrganizationForm({
      active: organization.active ?? true,
      country: organization.country ?? "",
      defaultLanguage: organization.defaultLanguage || "de",
      name: organization.name ?? "",
      slug: organization.slug ?? "",
      timezone: organization.timezone || suggestedTimezone(organization.defaultLanguage || "de"),
    });
    setEditingOrganizationId(organization.id);
    setOrganizationDialogMode("edit");
  };

  const handleSwitchOrganization = async (nextOrganizationId: string) => {
    if (!canManageOrganizationDirectory) return;
    setActiveOrganizationId(nextOrganizationId);
    localStorage.setItem(ACTIVE_ORGANIZATION_STORAGE_KEY, nextOrganizationId);
    await queryClient.invalidateQueries();
  };

  const handleSaveBranchSettings = () => {
    if (!currentOrganization?.id) {
      toast.error(t("settings.organizationUpdateFailed"));
      return;
    }
    updateOrganization.mutate({
      id: currentOrganization.id,
      defaultLanguage: branchLanguage,
      timezone: branchTimezone.trim() || suggestedTimezone(branchLanguage),
    });
  };

  const handleSaveOrganizationDialog = (event: React.FormEvent) => {
    event.preventDefault();
    if (!organizationForm.name.trim() || !organizationForm.slug.trim()) {
      toast.error(t("settings.organizationRequired"));
      return;
    }
    const payload = {
      ...organizationForm,
      country: organizationForm.country.trim(),
      name: organizationForm.name.trim(),
      slug: organizationForm.slug.trim(),
      timezone: organizationForm.timezone.trim() || suggestedTimezone(organizationForm.defaultLanguage),
    };
    if (organizationDialogMode === "edit" && editingOrganizationId) {
      updateOrganization.mutate({
        id: editingOrganizationId,
        active: canManageOrganizationDirectory ? payload.active : undefined,
        country: payload.country,
        defaultLanguage: payload.defaultLanguage,
        name: payload.name,
        timezone: payload.timezone,
      });
      return;
    }
    if (!canManageOrganizationDirectory) {
      toast.error(t("settings.platformAdminRequiredDescription"));
      return;
    }
    createOrganization.mutate(payload);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (authBypassEnabled) {
      toast.info("Password changes are disabled in preview mode.");
      return;
    }
    if (newPassword !== confirmPassword) { toast.error(t("reset.passwordsMismatch")); return; }
    if (newPassword.length < 6) { toast.error(t("reset.passwordTooShort")); return; }
    setLoading(true);
    const { error } = await updatePassword(newPassword);
    if (error) {
      toast.error(t("reset.updateFailed"), { description: error.message });
    } else {
      toast.success(t("reset.updateSuccess"));
      setNewPassword("");
      setConfirmPassword("");
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => navigate("/")}
          className="-ml-2 w-fit rounded-xl text-muted-foreground hover:bg-primary/10 hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("settings.backToConsole")}
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">{t("settings.title")}</h1>
      </div>
      <div className="grid max-w-4xl gap-6">
        <Card>
          <CardHeader className="gap-4 space-y-0 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                {t("settings.organization")}
              </CardTitle>
              <CardDescription>{t("settings.organizationDescription")}</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className={roleBadgeClass}>
                <ShieldCheck className="mr-1 h-3.5 w-3.5" />
                {roleLabel}
              </Badge>
              <Button
                type="button"
                className="rounded-full"
                disabled={!canManageOrganizationDirectory}
                onClick={openCreateOrganization}
              >
                <Plus className="h-4 w-4" />
                {t("settings.newOrganization")}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <OrgMeta label={t("settings.organizationName")} value={currentOrganization?.name || organizationPlaceholder} />
              <OrgMeta label={t("settings.organizationCountry")} value={currentOrganization?.country || organizationPlaceholder} />
              <OrgMeta
                label={t("settings.organizationDefaultLanguage")}
                value={currentOrganization?.defaultLanguage ? t(`settings.language.${currentOrganization.defaultLanguage}`) : organizationPlaceholder}
              />
              <OrgMeta label={t("settings.organizationTimezone")} value={currentOrganization?.timezone || organizationPlaceholder} />
            </div>

            <div className="rounded-2xl border border-border bg-muted/30 p-4">
              <div className="mb-4">
                <h3 className="text-sm font-bold text-foreground">{t("settings.activeOrganization")}</h3>
                <p className="mt-1 text-xs text-muted-foreground">{t("settings.activeOrganizationDescription")}</p>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="space-y-2 md:col-span-3">
                  <Label>{t("settings.organization")}</Label>
                  <Select
                    value={currentOrganization?.id || ""}
                    onValueChange={(value) => void handleSwitchOrganization(value)}
                    disabled={!canManageOrganizationDirectory || organizations.length === 0}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={organizationPlaceholder} />
                    </SelectTrigger>
                    <SelectContent>
                      {organizations.filter((organization) => organization.id).map((organization) => (
                        <SelectItem key={organization.id || organization.slug} value={organization.id!}>
                          {organization.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t("settings.organizationDefaultLanguage")}</Label>
                  <Select
                    value={branchLanguage}
                    onValueChange={(value) => setBranchLanguage(value as LanguageCode)}
                    disabled={!canManageCurrentOrganization}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">{t("settings.language.en")}</SelectItem>
                      <SelectItem value="de">{t("settings.language.de")}</SelectItem>
                      <SelectItem value="es">{t("settings.language.es")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="active-organization-timezone">{t("settings.organizationTimezone")}</Label>
                  <Input
                    id="active-organization-timezone"
                    value={branchTimezone}
                    onChange={(event) => setBranchTimezone(event.target.value)}
                    placeholder="Europe/Madrid"
                    disabled={!canManageCurrentOrganization}
                  />
                </div>
                {canManageCurrentOrganization && (
                  <div className="flex items-end">
                    <Button
                      type="button"
                      className="w-full"
                      disabled={!currentOrganization?.id || updateOrganization.isPending}
                      onClick={handleSaveBranchSettings}
                    >
                      {updateOrganization.isPending ? t("settings.savingOrganization") : t("settings.saveOrganization")}
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {!canManageCurrentOrganization && (
              <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-800">
                <p className="font-semibold">{t("settings.orgAdminRequiredTitle")}</p>
                <p className="mt-1">{t("settings.orgAdminRequiredDescription")}</p>
              </div>
            )}

            <div className="rounded-2xl border border-border bg-white">
              <div className="border-b border-border px-4 py-3 text-sm font-bold text-foreground">{t("settings.organizations")}</div>
              <div className="divide-y divide-border">
                {organizations.map((organization) => (
                  <div key={organization.id || organization.slug} className="grid items-center gap-3 px-4 py-3 text-sm sm:grid-cols-[1.4fr_1fr_160px_110px]">
                    <span className="font-semibold text-foreground">{organization.name}</span>
                    <span className="text-muted-foreground">{organization.country || t("settings.notAvailable")}</span>
                    <span className="text-muted-foreground">
                      {organization.defaultLanguage ? t(`settings.language.${organization.defaultLanguage}`) : t("settings.notAvailable")}
                    </span>
                    <div className="flex items-center justify-start gap-2 sm:justify-end">
                      <Badge variant="outline" className={organization.active ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-muted bg-muted text-muted-foreground"}>
                        {organization.active ? t("settings.status.active") : t("settings.status.inactive")}
                      </Badge>
                      {(canManageOrganizationDirectory || organization.id === currentOrganization?.id) && canManageCurrentOrganization && organization.id && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 rounded-full"
                          onClick={() => openEditOrganization(organization)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          {t("settings.editOrganization")}
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
                {organizations.length === 0 && (
                  <div className="px-4 py-6 text-center text-sm text-muted-foreground">{t("settings.noOrganizations")}</div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Languages className="h-5 w-5" />
              {t("settings.language")}
            </CardTitle>
            <CardDescription>{t("settings.languageDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <LanguageSelector />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              {t("settings.changePassword")}
            </CardTitle>
            <CardDescription>
              {authBypassEnabled ? (
                t("settings.previewPasswordDisabled")
              ) : (
                <>
                  {t("settings.signedInAs")}{" "}
                  <span className="font-medium text-foreground">{user?.email}</span>.
                </>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">{t("settings.newPassword")}</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder={t("settings.atLeast6")}
                  required
                  minLength={6}
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">{t("settings.confirmNewPassword")}</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={t("settings.reenterPassword")}
                  required
                  minLength={6}
                  disabled={loading}
                />
              </div>
              <Button type="submit" disabled={loading}>
                {loading ? t("settings.updating") : t("settings.updatePassword")}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={Boolean(organizationDialogMode)}
        onOpenChange={(open) => {
          if (!open) {
            setOrganizationDialogMode(null);
            setEditingOrganizationId(null);
          }
        }}
      >
        <DialogContent className="max-w-2xl rounded-2xl">
          <form onSubmit={handleSaveOrganizationDialog}>
            <DialogHeader>
              <DialogTitle>
                {organizationDialogMode === "edit" ? t("settings.editOrganization") : t("settings.createOrganization")}
              </DialogTitle>
              <DialogDescription>{t("settings.createOrganizationDescription")}</DialogDescription>
            </DialogHeader>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="organization-name">{t("settings.organizationName")}</Label>
                <Input
                  id="organization-name"
                  value={organizationForm.name}
                  onChange={(event) => updateOrganizationForm("name", event.target.value)}
                  placeholder="Red Cross Zamora"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="organization-slug">{t("settings.organizationSlug")}</Label>
                <Input
                  id="organization-slug"
                  value={organizationForm.slug}
                  onChange={(event) => updateOrganizationForm("slug", event.target.value)}
                  placeholder="red-cross-zamora"
                  disabled={organizationDialogMode === "edit"}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="organization-country">{t("settings.organizationCountry")}</Label>
                <Input
                  id="organization-country"
                  value={organizationForm.country}
                  onChange={(event) => updateOrganizationForm("country", event.target.value)}
                  placeholder="Spain"
                />
              </div>
              <div className="space-y-2">
                <Label>{t("settings.organizationDefaultLanguage")}</Label>
                <Select value={organizationForm.defaultLanguage} onValueChange={(value) => updateOrganizationForm("defaultLanguage", value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">{t("settings.language.en")}</SelectItem>
                    <SelectItem value="de">{t("settings.language.de")}</SelectItem>
                    <SelectItem value="es">{t("settings.language.es")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="organization-timezone">{t("settings.organizationTimezone")}</Label>
                <Input
                  id="organization-timezone"
                  value={organizationForm.timezone}
                  onChange={(event) => updateOrganizationForm("timezone", event.target.value)}
                  placeholder="Europe/Madrid"
                />
              </div>
              <div className="flex items-center justify-between rounded-xl border border-border px-3 py-2">
                <div>
                  <Label htmlFor="organization-active">{t("settings.organizationStatus")}</Label>
                  <p className="text-xs text-muted-foreground">
                    {organizationForm.active ? t("settings.status.active") : t("settings.status.inactive")}
                  </p>
                </div>
                <Switch
                  id="organization-active"
                  checked={organizationForm.active}
                  onCheckedChange={(checked) => updateOrganizationForm("active", checked)}
                  disabled={!canManageOrganizationDirectory}
                />
              </div>
            </div>
            <DialogFooter className="mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setOrganizationDialogMode(null);
                  setEditingOrganizationId(null);
                }}
              >
                {t("settings.cancel")}
              </Button>
              <Button type="submit" disabled={createOrganization.isPending || updateOrganization.isPending}>
                {createOrganization.isPending || updateOrganization.isPending
                  ? t("settings.savingOrganization")
                  : organizationDialogMode === "edit"
                    ? t("settings.saveOrganization")
                    : t("settings.createOrganization")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function OrgMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-white px-4 py-3">
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}
