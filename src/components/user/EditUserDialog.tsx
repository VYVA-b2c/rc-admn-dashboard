import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/apiClient";
import type { OperationalProfileUser } from "@/lib/operationalDemoData";

type SavedUserResponse = {
  user: OperationalProfileUser;
};

interface EditUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: (user: OperationalProfileUser) => void;
  user?: Partial<OperationalProfileUser> | null;
}

function dateInputValue(value?: string | null) {
  if (!value) return "";
  return String(value).slice(0, 10);
}

function isValidPhoneInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return true;
  const digits = trimmed.replace(/\D/g, "");
  return /^\+[1-9][0-9\s().-]{6,24}$/.test(trimmed) && digits.length >= 8 && digits.length <= 15;
}

export function EditUserDialog({ open, onOpenChange, onSaved, user }: EditUserDialogProps) {
  const queryClient = useQueryClient();
  const { t } = useLanguage();
  const isEditing = Boolean(user?.id);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    first_name: String(user?.first_name ?? ""),
    last_name: String(user?.last_name ?? ""),
    phone: String(user?.phone ?? ""),
    date_of_birth: dateInputValue(user?.date_of_birth),
    gender: String(user?.gender ?? ""),
    language: String(user?.language ?? "de"),
    city: String(user?.city ?? ""),
    street: String(user?.street ?? ""),
    house_number: String(user?.house_number ?? ""),
    post_code: String(user?.post_code ?? ""),
    emergency_notes: String(user?.emergency_notes ?? ""),
  });
  const [onboarding, setOnboarding] = useState({
    caregiver_name: "",
    caregiver_phone: "",
    checkin_enabled: false,
    checkin_frequency_days: "7",
    checkin_preferred_time: "09:00",
    medication_name: "",
    medication_dosage: "",
    medication_purpose: "",
    medication_schedule_times: "",
  });

  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const updateOnboarding = (key: keyof typeof onboarding, value: string | boolean) =>
    setOnboarding((current) => ({ ...current, [key]: value }));

  const handleSave = async () => {
    if (!form.first_name.trim() || !form.last_name.trim()) {
      toast({ title: t("userForm.validation.nameRequired"), variant: "destructive" });
      return;
    }

    if (form.date_of_birth && !/^\d{4}-\d{2}-\d{2}$/.test(form.date_of_birth)) {
      toast({ title: t("userForm.validation.date"), variant: "destructive" });
      return;
    }

    if (!isValidPhoneInput(form.phone)) {
      toast({ title: t("userForm.validation.phone"), variant: "destructive" });
      return;
    }

    if (!isEditing) {
      if (!isValidPhoneInput(onboarding.caregiver_phone)) {
        toast({ title: t("userForm.validation.caregiverPhone"), variant: "destructive" });
        return;
      }

      const hasMedicationDetail = [
        onboarding.medication_dosage,
        onboarding.medication_purpose,
        onboarding.medication_schedule_times,
      ].some((value) => value.trim());

      if (hasMedicationDetail && !onboarding.medication_name.trim()) {
        toast({ title: t("userForm.validation.medicationName"), variant: "destructive" });
        return;
      }

      if (onboarding.checkin_enabled) {
        const frequency = Number(onboarding.checkin_frequency_days);
        if (!Number.isInteger(frequency) || frequency <= 0) {
          toast({ title: t("userForm.validation.frequency"), variant: "destructive" });
          return;
        }
        if (onboarding.checkin_preferred_time && !/^\d{2}:\d{2}$/.test(onboarding.checkin_preferred_time)) {
          toast({ title: t("userForm.validation.preferredTime"), variant: "destructive" });
          return;
        }
      }
    }

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        phone: form.phone.trim() || null,
        date_of_birth: form.date_of_birth || null,
        gender: form.gender || null,
        language: form.language || "de",
        city: form.city.trim() || null,
        street: form.street.trim() || null,
        house_number: form.house_number.trim() || null,
        post_code: form.post_code.trim() || null,
        emergency_notes: form.emergency_notes.trim() || null,
      };

      if (!isEditing) {
        if (onboarding.caregiver_name.trim() || onboarding.caregiver_phone.trim()) {
          payload.caregiver = {
            caretaker_name: onboarding.caregiver_name.trim() || null,
            caretaker_phone: onboarding.caregiver_phone.trim() || null,
          };
        }

        if (onboarding.checkin_enabled) {
          payload.checkin = {
            enabled: true,
            frequency_days: Number(onboarding.checkin_frequency_days),
            preferred_time: onboarding.checkin_preferred_time || null,
          };
        }

        if (onboarding.medication_name.trim()) {
          payload.medication = {
            medication_name: onboarding.medication_name.trim(),
            dosage: onboarding.medication_dosage.trim() || null,
            purpose: onboarding.medication_purpose.trim() || null,
            schedule_times: onboarding.medication_schedule_times
              .split(",")
              .map((time) => time.trim())
              .filter(Boolean),
          };
        }
      }

      const response = await apiFetch<SavedUserResponse>(
        isEditing ? `/api/v1/user-dashboard/users/${user!.id}` : "/api/v1/user-dashboard/users",
        {
          method: isEditing ? "PATCH" : "POST",
          body: JSON.stringify(payload),
        },
      );

      toast({ title: t(isEditing ? "userForm.updated" : "userForm.created") });
      await queryClient.invalidateQueries({ queryKey: ["gis-data"] });
      if (response.user?.id) {
        await queryClient.invalidateQueries({ queryKey: ["vyva-user-profile", response.user.id] });
      }
      onSaved?.(response.user);
      onOpenChange(false);
    } catch (error) {
      toast({
        title: t("userForm.saveFailed"),
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-hidden rounded-[1.75rem] border-border bg-[#f7f9ff] p-0 shadow-2xl">
        <DialogHeader className="border-b border-border bg-white px-7 py-6 pr-12 text-left">
          <DialogTitle className="text-2xl font-bold tracking-tight text-foreground">
            {t(isEditing ? "userForm.editTitle" : "userForm.addTitle")}
          </DialogTitle>
          <DialogDescription className="max-w-xl text-sm leading-relaxed text-muted-foreground">
            {t(isEditing ? "userForm.editDescription" : "userForm.addDescription")}
          </DialogDescription>
        </DialogHeader>
        <div className="grid max-h-[calc(85vh-11rem)] gap-5 overflow-y-auto px-7 py-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="user-first-name">{t("userForm.firstName")}</Label>
              <Input
                id="user-first-name"
                value={form.first_name}
                onChange={(event) => update("first_name", event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="user-last-name">{t("userForm.lastName")}</Label>
              <Input
                id="user-last-name"
                value={form.last_name}
                onChange={(event) => update("last_name", event.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="user-phone">{t("userForm.phone")}</Label>
              <Input
                id="user-phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder={t("userForm.phonePlaceholder")}
                value={form.phone}
                onChange={(event) => update("phone", event.target.value)}
              />
              <p className="text-xs text-muted-foreground">{t("userForm.phoneHelp")}</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="user-date-of-birth">{t("userForm.dateOfBirth")}</Label>
              <Input
                id="user-date-of-birth"
                type="date"
                value={form.date_of_birth}
                onChange={(event) => update("date_of_birth", event.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>{t("userForm.gender")}</Label>
              <Select
                value={form.gender || "unspecified"}
                onValueChange={(value) => update("gender", value === "unspecified" ? "" : value)}
              >
                <SelectTrigger className={`${form.gender ? "text-foreground" : "text-muted-foreground"} h-12 rounded-xl bg-white px-4`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-2xl border-border p-1 shadow-lg">
                  <SelectItem
                    value="unspecified"
                    className="rounded-xl py-2.5 focus:bg-primary/10 focus:text-primary data-[state=checked]:bg-primary/10 data-[state=checked]:text-primary"
                  >
                    {t("userForm.unspecified")}
                  </SelectItem>
                  <SelectItem
                    value="female"
                    className="rounded-xl py-2.5 focus:bg-primary/10 focus:text-primary data-[state=checked]:bg-primary/10 data-[state=checked]:text-primary"
                  >
                    {t("userForm.genderFemale")}
                  </SelectItem>
                  <SelectItem
                    value="male"
                    className="rounded-xl py-2.5 focus:bg-primary/10 focus:text-primary data-[state=checked]:bg-primary/10 data-[state=checked]:text-primary"
                  >
                    {t("userForm.genderMale")}
                  </SelectItem>
                  <SelectItem
                    value="other"
                    className="rounded-xl py-2.5 focus:bg-primary/10 focus:text-primary data-[state=checked]:bg-primary/10 data-[state=checked]:text-primary"
                  >
                    {t("userForm.genderOther")}
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{t("userForm.genderHelp")}</p>
            </div>
            <div className="space-y-1.5">
              <Label>{t("userForm.language")}</Label>
              <Select value={form.language || "de"} onValueChange={(value) => update("language", value)}>
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
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
            <div className="space-y-1.5">
              <Label htmlFor="user-street">{t("userForm.street")}</Label>
              <Input id="user-street" value={form.street} onChange={(event) => update("street", event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="user-house-number">{t("userForm.houseNumber")}</Label>
              <Input
                id="user-house-number"
                value={form.house_number}
                onChange={(event) => update("house_number", event.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="user-post-code">{t("userForm.postCode")}</Label>
              <Input id="user-post-code" value={form.post_code} onChange={(event) => update("post_code", event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="user-city">{t("userForm.city")}</Label>
              <Input id="user-city" value={form.city} onChange={(event) => update("city", event.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="user-emergency-notes">{t("userForm.emergencyNotes")}</Label>
            <Textarea
              id="user-emergency-notes"
              value={form.emergency_notes}
              onChange={(event) => update("emergency_notes", event.target.value)}
              rows={3}
            />
          </div>

          {!isEditing && (
            <div className="space-y-4 rounded-2xl border border-border bg-muted/20 p-4">
              <div>
                <h3 className="text-sm font-bold text-foreground">{t("userForm.onboardingTitle")}</h3>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{t("userForm.onboardingDescription")}</p>
              </div>

              <div className="rounded-xl border border-border bg-white p-3">
                <p className="mb-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">{t("userForm.caregiverTitle")}</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="user-caregiver-name">{t("userForm.caregiverName")}</Label>
                    <Input
                      id="user-caregiver-name"
                      value={onboarding.caregiver_name}
                      onChange={(event) => updateOnboarding("caregiver_name", event.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="user-caregiver-phone">{t("userForm.caregiverPhone")}</Label>
                    <Input
                      id="user-caregiver-phone"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      placeholder={t("userForm.phonePlaceholder")}
                      value={onboarding.caregiver_phone}
                      onChange={(event) => updateOnboarding("caregiver_phone", event.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-white p-3">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{t("userForm.checkinTitle")}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{t("userForm.checkinDescription")}</p>
                  </div>
                  <Switch
                    checked={onboarding.checkin_enabled}
                    onCheckedChange={(checked) => updateOnboarding("checkin_enabled", checked)}
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="user-checkin-frequency">{t("userForm.frequencyDays")}</Label>
                    <Input
                      id="user-checkin-frequency"
                      type="number"
                      min={1}
                      value={onboarding.checkin_frequency_days}
                      onChange={(event) => updateOnboarding("checkin_frequency_days", event.target.value)}
                      disabled={!onboarding.checkin_enabled}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="user-checkin-time">{t("userForm.preferredTime")}</Label>
                    <Input
                      id="user-checkin-time"
                      type="time"
                      value={onboarding.checkin_preferred_time}
                      onChange={(event) => updateOnboarding("checkin_preferred_time", event.target.value)}
                      disabled={!onboarding.checkin_enabled}
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-white p-3">
                <p className="mb-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">{t("userForm.medicationTitle")}</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="user-medication-name">{t("userForm.medicationName")}</Label>
                    <Input
                      id="user-medication-name"
                      value={onboarding.medication_name}
                      onChange={(event) => updateOnboarding("medication_name", event.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="user-medication-dosage">{t("userForm.medicationDosage")}</Label>
                    <Input
                      id="user-medication-dosage"
                      value={onboarding.medication_dosage}
                      onChange={(event) => updateOnboarding("medication_dosage", event.target.value)}
                    />
                  </div>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="user-medication-purpose">{t("userForm.medicationPurpose")}</Label>
                    <Input
                      id="user-medication-purpose"
                      value={onboarding.medication_purpose}
                      onChange={(event) => updateOnboarding("medication_purpose", event.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="user-medication-times">{t("userForm.medicationTimes")}</Label>
                    <Input
                      id="user-medication-times"
                      value={onboarding.medication_schedule_times}
                      onChange={(event) => updateOnboarding("medication_schedule_times", event.target.value)}
                      placeholder={t("userForm.medicationTimesPlaceholder")}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        <DialogFooter className="border-t border-border bg-white px-7 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("userForm.cancel")}
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? t("userForm.saving") : t(isEditing ? "userForm.save" : "userForm.createButton")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
