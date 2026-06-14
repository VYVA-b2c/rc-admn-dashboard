import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Search, UserPlus, UsersRound } from "lucide-react";

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

function isValidPhoneInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return true;
  const digits = trimmed.replace(/\D/g, "");
  return /^\+[1-9][0-9\s().-]{6,24}$/.test(trimmed) && digits.length >= 8 && digits.length <= 15;
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
  const [providerType, setProviderType] = useState<CareProviderType>("caregiver");
  const [search, setSearch] = useState("");
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [relationship, setRelationship] = useState("");
  const [notes, setNotes] = useState("");
  const [makePrimary, setMakePrimary] = useState(true);
  const [saving, setSaving] = useState(false);

  const { data: providers = [], isLoading } = useQuery({
    queryKey: ["care-providers", providerType, search],
    queryFn: () => fetchCareProviders(search, providerType),
    enabled: open && !authBypassEnabled,
    retry: false,
  });

  const selectedProvider = useMemo(
    () => providers.find((provider) => provider.provider_id === selectedProviderId) ?? null,
    [providers, selectedProviderId],
  );
  const creatingNewContact = providerType === "caregiver" && !selectedProviderId;

  const resetForType = (type: CareProviderType) => {
    setProviderType(type);
    setSelectedProviderId(null);
    setSearch("");
    setNewName("");
    setNewPhone("");
  };

  const close = () => {
    onOpenChange(false);
    setSelectedProviderId(null);
    setSearch("");
    setNewName("");
    setNewPhone("");
    setRelationship("");
    setNotes("");
    setMakePrimary(true);
  };

  const handleSave = async () => {
    if (authBypassEnabled) {
      toast({ title: t("careProviders.previewReadOnly") });
      return;
    }

    if (creatingNewContact && !newName.trim()) {
      toast({ title: t("careProviders.validation.name"), variant: "destructive" });
      return;
    }

    if (creatingNewContact && !isValidPhoneInput(newPhone)) {
      toast({ title: t("userForm.validation.caregiverPhone"), variant: "destructive" });
      return;
    }

    if (!creatingNewContact && !selectedProvider) {
      toast({ title: t("careProviders.validation.provider"), variant: "destructive" });
      return;
    }

    const payload = creatingNewContact
      ? {
          provider_type: "caregiver",
          provider: {
            caretaker_name: newName.trim(),
            caretaker_phone: newPhone.trim() || null,
          },
          is_primary: makePrimary,
          relationship_label: relationship.trim() || null,
          notes: notes.trim() || null,
        }
      : {
          provider_type: providerType,
          provider_id: selectedProvider!.provider_id,
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
    } catch {
      toast({ title: t("careProviders.assignFailed"), variant: "destructive" });
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
            {t("careProviders.assignTitle")}
          </DialogTitle>
          <DialogDescription>
            {userName ? t("careProviders.assignDescriptionNamed").replace("{name}", userName) : t("careProviders.assignDescription")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 px-6 py-5">
          <div className="grid gap-2 sm:grid-cols-2">
            {(["caregiver", "field_staff"] as CareProviderType[]).map((type) => (
              <Button
                key={type}
                type="button"
                variant={providerType === type ? "default" : "outline"}
                className={cn(
                  "h-auto justify-start rounded-xl px-4 py-3 text-left",
                  providerType !== type && "border-border bg-muted/30 text-foreground hover:bg-primary/10 hover:text-primary",
                )}
                onClick={() => resetForType(type)}
              >
                <span>
                  <span className="block text-sm font-bold">{t(providerTypeKey(type))}</span>
                  <span className="block text-xs font-medium opacity-80">
                    {type === "field_staff" ? t("careProviders.professionalHelp") : t("careProviders.informalHelp")}
                  </span>
                </span>
              </Button>
            ))}
          </div>

          <div className="space-y-2">
            <Label htmlFor="care-provider-search">{t("careProviders.searchExisting")}</Label>
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
                {providerType === "caregiver" ? t("careProviders.noMatchesCreate") : t("careProviders.noMatches")}
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

          {providerType === "caregiver" && !selectedProviderId && (
            <div className="rounded-2xl border border-dashed border-primary/30 bg-primary/5 p-4">
              <div className="mb-3 flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-primary" />
                <p className="text-sm font-bold text-foreground">{t("careProviders.createInformal")}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="care-provider-name">{t("careProviders.name")}</Label>
                  <Input id="care-provider-name" value={newName} onChange={(event) => setNewName(event.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="care-provider-phone">{t("careProviders.phone")}</Label>
                  <Input
                    id="care-provider-phone"
                    type="tel"
                    inputMode="tel"
                    placeholder={t("userForm.phonePlaceholder")}
                    value={newPhone}
                    onChange={(event) => setNewPhone(event.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="care-provider-relationship">{t("careProviders.relationship")}</Label>
              <Input
                id="care-provider-relationship"
                value={relationship}
                onChange={(event) => setRelationship(event.target.value)}
                placeholder={providerType === "field_staff" ? t("careProviders.relationshipProfessionalPlaceholder") : t("careProviders.relationshipPlaceholder")}
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
            {saving ? t("userForm.saving") : t("careProviders.assign")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
