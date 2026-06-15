import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageSelector } from "@/components/LanguageSelector";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Building2, Languages, Lock, Plus } from "lucide-react";
import { authBypassEnabled } from "@/lib/authMode";
import { apiFetch } from "@/lib/apiClient";
import { useCurrentUserContext, type OrganizationContext } from "@/hooks/useCurrentUserContext";

type OrganizationsResponse = {
  currentOrganization: OrganizationContext | null;
  organizations: OrganizationContext[];
};

const emptyOrganizationForm = {
  country: "",
  defaultLanguage: "de" as "en" | "de" | "es",
  name: "",
  slug: "",
  timezone: "Europe/Berlin",
};

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

  const organizationsQuery = useQuery({
    queryKey: ["organizations"],
    enabled: authBypassEnabled || Boolean(user?.id) || Boolean(currentUser),
    queryFn: () => apiFetch<OrganizationsResponse>("/api/v1/organizations?includeInactive=true"),
    retry: false,
  });
  const organizations = organizationsQuery.data?.organizations ?? [];
  const currentOrganization =
    currentUser?.organization ??
    organizationsQuery.data?.currentOrganization ??
    organizations.find((organization) => organization.id) ??
    null;
  const organizationPlaceholder =
    loadingCurrentContext || organizationsQuery.isLoading ? t("settings.loadingOrganization") : t("settings.notAvailable");

  const createOrganization = useMutation({
    mutationFn: (payload: typeof emptyOrganizationForm) =>
      apiFetch<{ organization: OrganizationContext }>("/api/v1/organizations", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: async () => {
      toast.success(t("settings.organizationCreated"));
      setOrganizationForm(emptyOrganizationForm);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["organizations"] }),
        queryClient.invalidateQueries({ queryKey: ["current-user-context"] }),
      ]);
    },
    onError: () => {
      toast.error(t("settings.organizationCreateFailed"));
    },
  });

  const updateOrganization = useMutation({
    mutationFn: ({ id, defaultLanguage }: { id: string; defaultLanguage: "en" | "de" | "es" }) =>
      apiFetch<{ organization: OrganizationContext }>(`/api/v1/organizations/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ defaultLanguage }),
      }),
    onSuccess: async () => {
      toast.success(t("settings.organizationUpdated"));
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

  const updateOrganizationForm = (key: keyof typeof organizationForm, value: string) => {
    setOrganizationForm((current) => {
      if (key === "defaultLanguage") {
        return {
          ...current,
          defaultLanguage: value as "en" | "de" | "es",
          timezone: current.timezone || suggestedTimezone(value),
        };
      }
      if (key === "name" && !current.slug) {
        return {
          ...current,
          name: value,
          slug: value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
        };
      }
      return { ...current, [key]: value };
    });
  };

  const handleCreateOrganization = (event: React.FormEvent) => {
    event.preventDefault();
    if (!organizationForm.name.trim() || !organizationForm.slug.trim()) {
      toast.error(t("settings.organizationRequired"));
      return;
    }
    createOrganization.mutate({
      ...organizationForm,
      country: organizationForm.country.trim(),
      name: organizationForm.name.trim(),
      slug: organizationForm.slug.trim(),
      timezone: organizationForm.timezone.trim() || suggestedTimezone(organizationForm.defaultLanguage),
    });
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
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              {t("settings.organization")}
            </CardTitle>
            <CardDescription>{t("settings.organizationDescription")}</CardDescription>
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

            {currentUser?.isPlatformAdmin && (
              <form onSubmit={handleCreateOrganization} className="rounded-2xl border border-border bg-muted/30 p-4">
                <div className="mb-4">
                  <h3 className="text-sm font-bold text-foreground">{t("settings.createOrganization")}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">{t("settings.createOrganizationDescription")}</p>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
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
                    <Select
                      value={organizationForm.defaultLanguage}
                      onValueChange={(value) => updateOrganizationForm("defaultLanguage", value)}
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
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="organization-timezone">{t("settings.organizationTimezone")}</Label>
                    <Input
                      id="organization-timezone"
                      value={organizationForm.timezone}
                      onChange={(event) => updateOrganizationForm("timezone", event.target.value)}
                      placeholder="Europe/Madrid"
                    />
                  </div>
                </div>
                <Button className="mt-4" type="submit" disabled={createOrganization.isPending}>
                  <Plus className="h-4 w-4" />
                  {createOrganization.isPending ? t("settings.creatingOrganization") : t("settings.createOrganization")}
                </Button>
              </form>
            )}

            {currentUser?.isPlatformAdmin && (
              <div className="rounded-2xl border border-border bg-white">
                <div className="border-b border-border px-4 py-3 text-sm font-bold text-foreground">{t("settings.organizations")}</div>
                <div className="divide-y divide-border">
                  {(organizationsQuery.data?.organizations ?? []).map((organization) => (
                    <div key={organization.id || organization.slug} className="grid items-center gap-3 px-4 py-3 text-sm sm:grid-cols-[1.4fr_1fr_180px]">
                      <span className="font-semibold text-foreground">{organization.name}</span>
                      <span className="text-muted-foreground">{organization.country || t("settings.notAvailable")}</span>
                      {organization.id ? (
                        <Select
                          value={organization.defaultLanguage || "de"}
                          onValueChange={(value) =>
                            updateOrganization.mutate({
                              id: organization.id!,
                              defaultLanguage: value as "en" | "de" | "es",
                            })
                          }
                        >
                          <SelectTrigger className="h-9 rounded-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="en">{t("settings.language.en")}</SelectItem>
                            <SelectItem value="de">{t("settings.language.de")}</SelectItem>
                            <SelectItem value="es">{t("settings.language.es")}</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className="text-muted-foreground">{t("settings.notAvailable")}</span>
                      )}
                    </div>
                  ))}
                  {organizationsQuery.data?.organizations?.length === 0 && (
                    <div className="px-4 py-6 text-center text-sm text-muted-foreground">{t("settings.noOrganizations")}</div>
                  )}
                </div>
              </div>
            )}
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
