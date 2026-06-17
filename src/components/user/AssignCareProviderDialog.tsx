import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Search, UsersRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/apiClient";
import { authBypassEnabled } from "@/lib/authMode";
import type { CareProviderOption, CareProviderType } from "@/lib/careProviders";
import { providerCoverageLabel, providerTypeKey } from "@/lib/careProviders";
import { cn } from "@/lib/utils";

interface AssignCareProviderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userName?: string;
}

async function fetchCareProviders(search: string, type: CareProviderType) {
  const params = new URLSearchParams({ type });
  if (search.trim()) params.set("search", search.trim());
  const data = await apiFetch<{ providers?: CareProviderOption[] }>(`/api/v1/care-providers?${params.toString()}`);
  return data.providers ?? [];
}

export function AssignCareProviderDialog({ open, onOpenChange, userId, userName }: AssignCareProviderDialogProps) {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
  const [relationship, setRelationship] = useState("");
  const [notes, setNotes] = useState("");
  const [makePrimary, setMakePrimary] = useState(true);
  const [saving, setSaving] = useState(false);

  const { data: providers = [], isLoading } = useQuery({
    queryKey: ["care-providers", "field_staff", search],
    queryFn: () => fetchCareProviders(search, "field_staff"),
    enabled: open && !authBypassEnabled,
    retry: false,
  });

  const selectedProvider = useMemo(
    () => providers.find((provider) => provider.provider_id === selectedProviderId) ?? null,
    [providers, selectedProviderId],
  );

  const close = () => {
    onOpenChange(false);
    setSelectedProviderId(null);
    setSearch("");
    setRelationship("");
    setNotes("");
    setMakePrimary(true);
  };

  const handleSave = async () => {
    if (authBypassEnabled) {
      toast({ title: t("careProviders.previewReadOnly") });
      return;
    }

    if (!selectedProvider) {
      toast({ title: t("careProviders.validation.provider"), variant: "destructive" });
      return;
    }

    const payload = {
      provider_type: "field_staff",
      provider_id: selectedProvider.provider_id,
      is_primary: makePrimary,
      relationship_label: relationship.trim() || null,
      notes: notes.trim() || null,
    };

    setSaving(true);
    try {
      await apiFetch(`/api/v1/user-dashboard/users/${userId}/care-providers`, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      toast({ title: t("careProviders.assigned") });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["gis-data"] }),
        queryClient.invalidateQueries({ queryKey: ["vyva-user-profile", userId] }),
        queryClient.invalidateQueries({ queryKey: ["care-providers"] }),
        queryClient.invalidateQueries({ queryKey: ["emergency-contacts"] }),
      ]);
      close();
    } catch (error) {
      toast({
        title: t("careProviders.assignFailed"),
        description: error instanceof Error ? error.message : t("careProviders.assignFailedDescription"),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (nextOpen ? onOpenChange(nextOpen) : close())}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto rounded-2xl border-border bg-white p-0">
        <DialogHeader className="border-b border-border px-6 py-5">
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <UsersRound className="h-5 w-5 text-primary" />
            {t("careProviders.assignStaffTitle")}
          </DialogTitle>
          <DialogDescription>
            {userName ? t("careProviders.assignStaffDescriptionNamed").replace("{name}", userName) : t("careProviders.assignStaffDescription")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 px-6 py-5">
          <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4">
            <p className="text-sm font-bold text-foreground">{t("careProviders.professional")}</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{t("careProviders.assignStaffHelp")}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="care-provider-search">{t("careProviders.searchStaff")}</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="care-provider-search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t("careProviders.searchPlaceholder")}
                className="h-11 rounded-xl bg-muted/35 pl-9"
              />
            </div>
          </div>

          <div className="max-h-52 space-y-2 overflow-y-auto rounded-2xl border border-border bg-muted/20 p-2">
            {isLoading ? (
              <p className="px-3 py-6 text-center text-sm font-medium text-muted-foreground">{t("careProviders.loading")}</p>
            ) : providers.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm font-medium text-muted-foreground">
                {t("careProviders.noRedCrossStaff")}
              </p>
            ) : (
              providers.map((provider) => {
                const active = selectedProviderId === provider.provider_id;
                return (
                  <button
                    key={`${provider.provider_type}-${provider.provider_id}`}
                    type="button"
                    className={cn(
                      "flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-3 text-left transition-colors",
                      active ? "border-primary bg-primary/10 text-primary" : "border-transparent bg-white hover:border-primary/30 hover:bg-primary/5",
                    )}
                    onClick={() => setSelectedProviderId(active ? null : provider.provider_id)}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold">{provider.display_name}</span>
                      <span className="block truncate text-xs font-semibold text-muted-foreground">
                        {[t(providerTypeKey(provider.provider_type)), providerCoverageLabel(provider), provider.assignment_count ? `${provider.assignment_count} ${t("careProviders.assignments")}` : null]
                          .filter(Boolean)
                          .join(" / ")}
                      </span>
                    </span>
                    {active && <Check className="h-5 w-5 shrink-0" />}
                  </button>
                );
              })
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="care-provider-relationship">{t("careProviders.relationship")}</Label>
              <Input
                id="care-provider-relationship"
                value={relationship}
                onChange={(event) => setRelationship(event.target.value)}
                placeholder={t("careProviders.relationshipProfessionalPlaceholder")}
              />
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border bg-muted/25 px-4 py-3">
              <div>
                <p className="text-sm font-bold text-foreground">{t("careProviders.primary")}</p>
                <p className="text-xs font-medium text-muted-foreground">{t("careProviders.primaryHelp")}</p>
              </div>
              <Switch checked={makePrimary} onCheckedChange={setMakePrimary} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="care-provider-notes">{t("careProviders.notes")}</Label>
            <Textarea
              id="care-provider-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder={t("careProviders.notesPlaceholder")}
              className="min-h-20 rounded-xl"
            />
          </div>
        </div>

        <DialogFooter className="border-t border-border px-6 py-4">
          <Button type="button" variant="outline" className="rounded-full" onClick={close}>
            {t("userForm.cancel")}
          </Button>
          <Button type="button" className="rounded-full" disabled={saving} onClick={handleSave}>
            {saving ? t("userForm.saving") : t("careProviders.assignStaff")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
