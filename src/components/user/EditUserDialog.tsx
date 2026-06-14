import { useEffect, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { HeartPulse, PhoneCall, Pill, Plus, ShieldCheck, UserRound, X, type LucideIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
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
import type { OperationalProfileResponse, OperationalProfileUser } from "@/lib/operationalDemoData";
import { cn } from "@/lib/utils";

type SavedUserResponse = {
  user: OperationalProfileUser;
};

type MedicationForm = {
  dosage: string;
  medication_name: string;
  purpose: string;
  schedule_times: string;
};

type CaregiverForm = {
  caretaker_name: string;
  caretaker_phone: string;
};

type ServiceForm = {
  enabled: boolean;
  frequency: string;
  preferred_time: string;
};

interface EditUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: (user: OperationalProfileUser) => void;
  profileData?: OperationalProfileResponse | null;
  user?: Partial<OperationalProfileUser> | null;
}

const cadenceOptions = ["daily", "weekly", "biweekly", "monthly"] as const;

function dateInputValue(value?: string | null) {
  if (!value) return "";
  return String(value).slice(0, 10);
}

function emptyMedication(): MedicationForm {
  return {
    dosage: "",
    medication_name: "",
    purpose: "",
    schedule_times: "",
  };
}

function emptyCaregiver(): CaregiverForm {
  return {
    caretaker_name: "",
    caretaker_phone: "",
  };
}

function defaultService(service?: ServiceForm | null, fallbackFrequency = "weekly"): ServiceForm {
  return {
    enabled: Boolean(service?.enabled),
    frequency: service?.frequency || fallbackFrequency,
    preferred_time: service?.preferred_time || "",
  };
}

function isValidPhoneInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return true;
  const digits = trimmed.replace(/\D/g, "");
  return /^\+[1-9][0-9\s().-]{6,24}$/.test(trimmed) && digits.length >= 8 && digits.length <= 15;
}

function isValidTime(value: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function splitScheduleTimes(value: string) {
  return value
    .split(",")
    .map((time) => time.trim())
    .filter(Boolean);
}

function hasMedicationDetail(medication: MedicationForm) {
  return Boolean(
    medication.medication_name.trim() ||
      medication.dosage.trim() ||
      medication.purpose.trim() ||
      medication.schedule_times.trim(),
  );
}

function hasCaregiverDetail(caregiver: CaregiverForm) {
  return Boolean(caregiver.caretaker_name.trim() || caregiver.caretaker_phone.trim());
}

function userFormState(user?: Partial<OperationalProfileUser> | null) {
  return {
    city: String(user?.city ?? ""),
    date_of_birth: dateInputValue(user?.date_of_birth),
    emergency_notes: String(user?.emergency_notes ?? ""),
    first_name: String(user?.first_name ?? ""),
    gender: String(user?.gender ?? ""),
    house_number: String(user?.house_number ?? ""),
    language: String(user?.language ?? "de"),
    last_name: String(user?.last_name ?? ""),
    phone: String(user?.phone ?? ""),
    post_code: String(user?.post_code ?? ""),
    street: String(user?.street ?? ""),
  };
}

function medicationFormState(profileData?: OperationalProfileResponse | null) {
  const medications = profileData?.medications ?? [];
  if (!medications.length) return [emptyMedication()];

  return medications.map((medication) => ({
    dosage: medication.dosage || "",
    medication_name: medication.medication_name || "",
    purpose: medication.purpose || "",
    schedule_times: Array.isArray(medication.schedule_times) ? medication.schedule_times.join(", ") : "",
  }));
}

function caregiverFormState(profileData?: OperationalProfileResponse | null) {
  const caregivers = profileData?.caregivers ?? [];
  if (!caregivers.length) return [emptyCaregiver()];

  return caregivers.map((caregiver) => ({
    caretaker_name: caregiver.caretaker_name || "",
    caretaker_phone: caregiver.caretaker_phone || "",
  }));
}

export function EditUserDialog({ open, onOpenChange, onSaved, profileData, user }: EditUserDialogProps) {
  const queryClient = useQueryClient();
  const { t } = useLanguage();
  const isEditing = Boolean(user?.id);

  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(() => userFormState(user));
  const [healthConditions, setHealthConditions] = useState<string[]>([]);
  const [mobilityNeeds, setMobilityNeeds] = useState<string[]>([]);
  const [newCondition, setNewCondition] = useState("");
  const [newMobilityNeed, setNewMobilityNeed] = useState("");
  const [medications, setMedications] = useState<MedicationForm[]>([emptyMedication()]);
  const [caregivers, setCaregivers] = useState<CaregiverForm[]>([emptyCaregiver()]);
  const [userConsent, setUserConsent] = useState(false);
  const [caregiverConsent, setCaregiverConsent] = useState(false);
  const [checkins, setCheckins] = useState<ServiceForm>(defaultService(null));
  const [brainCoach, setBrainCoach] = useState<ServiceForm>(defaultService(null, "weekly"));

  useEffect(() => {
    if (!open) return;

    setForm(userFormState(user));
    setHealthConditions(profileData?.health?.health_conditions ?? []);
    setMobilityNeeds(profileData?.health?.mobility_needs ?? []);
    setNewCondition("");
    setNewMobilityNeed("");
    setMedications(medicationFormState(profileData));
    setCaregivers(caregiverFormState(profileData));
    setUserConsent(Boolean(profileData?.consent?.consent_given));
    setCaregiverConsent(Boolean(profileData?.consent?.caretaker_consent));
    setCheckins(defaultService(profileData?.checkins ?? null, "weekly"));
    setBrainCoach(defaultService(profileData?.brainCoach ?? null, "weekly"));
  }, [open, profileData, user]);

  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const updateMedication = (index: number, key: keyof MedicationForm, value: string) =>
    setMedications((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, [key]: value } : item)));
  const updateCaregiver = (index: number, key: keyof CaregiverForm, value: string) =>
    setCaregivers((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, [key]: value } : item)));
  const updateService = (service: "checkins" | "brainCoach", key: keyof ServiceForm, value: string | boolean) => {
    const setter = service === "checkins" ? setCheckins : setBrainCoach;
    setter((current) => ({ ...current, [key]: value }));
  };

  const addTag = (value: string, items: string[], setItems: (items: string[]) => void, setValue: (value: string) => void) => {
    const trimmed = value.trim();
    if (!trimmed || items.includes(trimmed)) return;
    setItems([...items, trimmed]);
    setValue("");
  };

  const removeTag = (index: number, items: string[], setItems: (items: string[]) => void) => {
    setItems(items.filter((_, itemIndex) => itemIndex !== index));
  };

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

    if (caregivers.some((caregiver) => caregiver.caretaker_phone.trim() && !isValidPhoneInput(caregiver.caretaker_phone))) {
      toast({ title: t("userForm.validation.caregiverPhone"), variant: "destructive" });
      return;
    }

    if (medications.some((medication) => hasMedicationDetail(medication) && !medication.medication_name.trim())) {
      toast({ title: t("userForm.validation.medicationName"), variant: "destructive" });
      return;
    }

    if (medications.some((medication) => splitScheduleTimes(medication.schedule_times).some((time) => !isValidTime(time)))) {
      toast({ title: t("userForm.validation.medicationTimes"), variant: "destructive" });
      return;
    }

    if ([checkins, brainCoach].some((service) => service.preferred_time && !isValidTime(service.preferred_time))) {
      toast({ title: t("userForm.validation.preferredTime"), variant: "destructive" });
      return;
    }

    const careProfilePayload = {
      brainCoach: {
        enabled: brainCoach.enabled,
        frequency: brainCoach.frequency || null,
        preferred_time: brainCoach.preferred_time || null,
      },
      caregivers: caregivers
        .map((caregiver) => ({
          caretaker_name: caregiver.caretaker_name.trim() || null,
          caretaker_phone: caregiver.caretaker_phone.trim() || null,
        }))
        .filter((caregiver) => caregiver.caretaker_name || caregiver.caretaker_phone),
      checkins: {
        enabled: checkins.enabled,
        frequency: checkins.frequency || null,
        preferred_time: checkins.preferred_time || null,
      },
      consent: {
        caretaker_consent: caregiverConsent,
        consent_given: userConsent,
      },
      health: {
        health_conditions: healthConditions,
        mobility_needs: mobilityNeeds,
      },
      medications: medications
        .map((medication) => ({
          dosage: medication.dosage.trim() || null,
          medication_name: medication.medication_name.trim(),
          purpose: medication.purpose.trim() || null,
          schedule_times: splitScheduleTimes(medication.schedule_times),
        }))
        .filter((medication) => medication.medication_name),
    };

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        ...careProfilePayload,
        city: form.city.trim() || null,
        date_of_birth: form.date_of_birth || null,
        emergency_notes: form.emergency_notes.trim() || null,
        first_name: form.first_name.trim(),
        gender: form.gender || null,
        house_number: form.house_number.trim() || null,
        language: form.language || "de",
        last_name: form.last_name.trim(),
        phone: form.phone.trim() || null,
        post_code: form.post_code.trim() || null,
        street: form.street.trim() || null,
      };

      const response = await apiFetch<SavedUserResponse>(
        isEditing ? `/api/v1/user-dashboard/users/${user!.id}` : "/api/v1/user-dashboard/users",
        {
          method: isEditing ? "PATCH" : "POST",
          body: JSON.stringify(payload),
        },
      );

      toast({ title: t(isEditing ? "userForm.careProfileSaved" : "userForm.careProfileCreated") });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["gis-data"] }),
        queryClient.invalidateQueries({ queryKey: ["vyva-user-profile"] }),
        queryClient.invalidateQueries({ queryKey: ["checkin-monitoring"] }),
      ]);
      onSaved?.(response.user);
      onOpenChange(false);
    } catch {
      toast({
        title: t("userForm.careProfileSaveFailed"),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-5xl flex-col overflow-hidden rounded-[1.75rem] border-border bg-[#f7f9ff] p-0 shadow-2xl">
        <DialogHeader className="shrink-0 border-b border-border bg-white px-7 py-6 pr-12 text-left">
          <Badge className="mb-2 w-fit rounded-full bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-primary hover:bg-primary/10">
            {t("userForm.careProfileBadge")}
          </Badge>
          <DialogTitle className="text-2xl font-bold tracking-tight text-foreground">
            {t(isEditing ? "userForm.editTitle" : "userForm.addTitle")}
          </DialogTitle>
          <DialogDescription className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {t(isEditing ? "userForm.editDescription" : "userForm.addDescription")}
          </DialogDescription>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 gap-5 overflow-y-auto px-7 py-5">
          <SectionPanel
            description={t("userForm.personSectionDescription")}
            icon={UserRound}
            title={t("userForm.personSectionTitle")}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t("userForm.firstName")} htmlFor="user-first-name">
                <Input
                  id="user-first-name"
                  value={form.first_name}
                  onChange={(event) => update("first_name", event.target.value)}
                />
              </Field>
              <Field label={t("userForm.lastName")} htmlFor="user-last-name">
                <Input
                  id="user-last-name"
                  value={form.last_name}
                  onChange={(event) => update("last_name", event.target.value)}
                />
              </Field>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field helper={t("userForm.phoneHelp")} label={t("userForm.phone")} htmlFor="user-phone">
                <Input
                  id="user-phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder={t("userForm.phonePlaceholder")}
                  value={form.phone}
                  onChange={(event) => update("phone", event.target.value)}
                />
              </Field>
              <Field label={t("userForm.dateOfBirth")} htmlFor="user-date-of-birth">
                <Input
                  id="user-date-of-birth"
                  type="date"
                  value={form.date_of_birth}
                  onChange={(event) => update("date_of_birth", event.target.value)}
                />
              </Field>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field helper={t("userForm.genderHelp")} label={t("userForm.gender")}>
                <Select
                  value={form.gender || "unspecified"}
                  onValueChange={(value) => update("gender", value === "unspecified" ? "" : value)}
                >
                  <SelectTrigger className={cn("h-12 rounded-xl bg-white px-4", form.gender ? "text-foreground" : "text-muted-foreground")}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-border p-1 shadow-lg">
                    <CareSelectItem value="unspecified">{t("userForm.unspecified")}</CareSelectItem>
                    <CareSelectItem value="female">{t("userForm.genderFemale")}</CareSelectItem>
                    <CareSelectItem value="male">{t("userForm.genderMale")}</CareSelectItem>
                    <CareSelectItem value="other">{t("userForm.genderOther")}</CareSelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label={t("userForm.language")}>
                <Select value={form.language || "de"} onValueChange={(value) => update("language", value)}>
                  <SelectTrigger className="h-12 rounded-xl bg-white px-4">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-border p-1 shadow-lg">
                    <CareSelectItem value="en">{t("settings.language.en")}</CareSelectItem>
                    <CareSelectItem value="de">{t("settings.language.de")}</CareSelectItem>
                    <CareSelectItem value="es">{t("settings.language.es")}</CareSelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
              <Field label={t("userForm.street")} htmlFor="user-street">
                <Input id="user-street" value={form.street} onChange={(event) => update("street", event.target.value)} />
              </Field>
              <Field label={t("userForm.houseNumber")} htmlFor="user-house-number">
                <Input
                  id="user-house-number"
                  value={form.house_number}
                  onChange={(event) => update("house_number", event.target.value)}
                />
              </Field>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t("userForm.postCode")} htmlFor="user-post-code">
                <Input id="user-post-code" value={form.post_code} onChange={(event) => update("post_code", event.target.value)} />
              </Field>
              <Field label={t("userForm.city")} htmlFor="user-city">
                <Input id="user-city" value={form.city} onChange={(event) => update("city", event.target.value)} />
              </Field>
            </div>
          </SectionPanel>

          <SectionPanel
            description={t("userForm.medicalSectionDescription")}
            icon={HeartPulse}
            title={t("userForm.medicalSectionTitle")}
            tone="pink"
          >
            <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium leading-relaxed text-red-800">
              {t("userForm.minimumNecessaryNotice")}
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <ChipEditor
                addLabel={t("userForm.addCondition")}
                helper={t("userForm.healthConditionsHelp")}
                inputValue={newCondition}
                items={healthConditions}
                label={t("userForm.healthConditions")}
                onAdd={() => addTag(newCondition, healthConditions, setHealthConditions, setNewCondition)}
                onInputChange={setNewCondition}
                onRemove={(index) => removeTag(index, healthConditions, setHealthConditions)}
                placeholder={t("userForm.healthConditionsPlaceholder")}
              />
              <ChipEditor
                addLabel={t("userForm.addMobilityNeed")}
                helper={t("userForm.mobilityNeedsHelp")}
                inputValue={newMobilityNeed}
                items={mobilityNeeds}
                label={t("userForm.mobilityNeeds")}
                onAdd={() => addTag(newMobilityNeed, mobilityNeeds, setMobilityNeeds, setNewMobilityNeed)}
                onInputChange={setNewMobilityNeed}
                onRemove={(index) => removeTag(index, mobilityNeeds, setMobilityNeeds)}
                placeholder={t("userForm.mobilityNeedsPlaceholder")}
              />
            </div>
            <Field helper={t("userForm.careSafetyNotesHelp")} label={t("userForm.careSafetyNotes")} htmlFor="user-emergency-notes">
              <Textarea
                id="user-emergency-notes"
                value={form.emergency_notes}
                onChange={(event) => update("emergency_notes", event.target.value)}
                rows={3}
              />
            </Field>
          </SectionPanel>

          <SectionPanel
            description={t("userForm.medicationSectionDescription")}
            icon={Pill}
            title={t("userForm.medicationSectionTitle")}
            tone="orange"
          >
            <div className="space-y-3">
              {medications.map((medication, index) => (
                <div key={`medication-${index}`} className="rounded-2xl border border-border bg-white p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="text-sm font-bold text-foreground">
                      {t("userForm.medicationItem")} {index + 1}
                    </p>
                    {medications.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 rounded-full px-2 text-muted-foreground hover:text-destructive"
                        onClick={() => setMedications((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                      >
                        <X className="h-4 w-4" />
                        <span className="sr-only">{t("userForm.removeMedication")}</span>
                      </Button>
                    )}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label={t("userForm.medicationName")} htmlFor={`user-medication-name-${index}`}>
                      <Input
                        id={`user-medication-name-${index}`}
                        value={medication.medication_name}
                        onChange={(event) => updateMedication(index, "medication_name", event.target.value)}
                      />
                    </Field>
                    <Field label={t("userForm.medicationDosage")} htmlFor={`user-medication-dosage-${index}`}>
                      <Input
                        id={`user-medication-dosage-${index}`}
                        placeholder={t("userForm.medicationDosagePlaceholder")}
                        value={medication.dosage}
                        onChange={(event) => updateMedication(index, "dosage", event.target.value)}
                      />
                    </Field>
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <Field label={t("userForm.medicationPurpose")} htmlFor={`user-medication-purpose-${index}`}>
                      <Input
                        id={`user-medication-purpose-${index}`}
                        placeholder={t("userForm.medicationPurposePlaceholder")}
                        value={medication.purpose}
                        onChange={(event) => updateMedication(index, "purpose", event.target.value)}
                      />
                    </Field>
                    <Field helper={t("userForm.medicationTimesHelp")} label={t("userForm.medicationTimes")} htmlFor={`user-medication-times-${index}`}>
                      <Input
                        id={`user-medication-times-${index}`}
                        placeholder={t("userForm.medicationTimesPlaceholder")}
                        value={medication.schedule_times}
                        onChange={(event) => updateMedication(index, "schedule_times", event.target.value)}
                      />
                    </Field>
                  </div>
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              className="h-10 w-fit rounded-full border-primary/20 bg-primary/5 px-4 text-sm font-semibold text-primary hover:bg-primary/10 hover:text-primary"
              onClick={() => setMedications((current) => [...current, emptyMedication()])}
            >
              <Plus className="mr-2 h-4 w-4" />
              {t("userForm.addMedicationRow")}
            </Button>
          </SectionPanel>

          <SectionPanel
            description={t("userForm.consentSectionDescription")}
            icon={ShieldCheck}
            title={t("userForm.consentSectionTitle")}
            tone="green"
          >
            <div className="grid gap-3 md:grid-cols-2">
              <SwitchRow
                checked={userConsent}
                description={t("userForm.userConsentDescription")}
                label={t("userForm.userConsent")}
                onCheckedChange={setUserConsent}
              />
              <SwitchRow
                checked={caregiverConsent}
                description={t("userForm.caregiverConsentDescription")}
                label={t("userForm.caregiverConsent")}
                onCheckedChange={setCaregiverConsent}
              />
            </div>
            <div className="space-y-3">
              {caregivers.map((caregiver, index) => (
                <div key={`caregiver-${index}`} className="rounded-2xl border border-border bg-white p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="text-sm font-bold text-foreground">
                      {t("userForm.caregiverItem")} {index + 1}
                    </p>
                    {caregivers.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 rounded-full px-2 text-muted-foreground hover:text-destructive"
                        onClick={() => setCaregivers((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                      >
                        <X className="h-4 w-4" />
                        <span className="sr-only">{t("userForm.removeCaregiver")}</span>
                      </Button>
                    )}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label={t("userForm.caregiverName")} htmlFor={`user-caregiver-name-${index}`}>
                      <Input
                        id={`user-caregiver-name-${index}`}
                        value={caregiver.caretaker_name}
                        onChange={(event) => updateCaregiver(index, "caretaker_name", event.target.value)}
                      />
                    </Field>
                    <Field helper={t("userForm.phoneHelp")} label={t("userForm.caregiverPhone")} htmlFor={`user-caregiver-phone-${index}`}>
                      <Input
                        id={`user-caregiver-phone-${index}`}
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        placeholder={t("userForm.phonePlaceholder")}
                        value={caregiver.caretaker_phone}
                        onChange={(event) => updateCaregiver(index, "caretaker_phone", event.target.value)}
                      />
                    </Field>
                  </div>
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              className="h-10 w-fit rounded-full border-primary/20 bg-primary/5 px-4 text-sm font-semibold text-primary hover:bg-primary/10 hover:text-primary"
              onClick={() => setCaregivers((current) => [...current, emptyCaregiver()])}
            >
              <Plus className="mr-2 h-4 w-4" />
              {t("userForm.addCaregiverRow")}
            </Button>
          </SectionPanel>

          <SectionPanel
            description={t("userForm.followUpSectionDescription")}
            icon={PhoneCall}
            title={t("userForm.followUpSectionTitle")}
          >
            <div className="grid gap-4 lg:grid-cols-2">
              <ServiceEditor
                enabled={checkins.enabled}
                frequency={checkins.frequency}
                label={t("userForm.checkinTitle")}
                onEnabledChange={(value) => updateService("checkins", "enabled", value)}
                onFrequencyChange={(value) => updateService("checkins", "frequency", value)}
                onTimeChange={(value) => updateService("checkins", "preferred_time", value)}
                preferredTime={checkins.preferred_time}
                t={t}
              />
              <ServiceEditor
                enabled={brainCoach.enabled}
                frequency={brainCoach.frequency}
                label={t("userForm.brainCoachTitle")}
                onEnabledChange={(value) => updateService("brainCoach", "enabled", value)}
                onFrequencyChange={(value) => updateService("brainCoach", "frequency", value)}
                onTimeChange={(value) => updateService("brainCoach", "preferred_time", value)}
                preferredTime={brainCoach.preferred_time}
                t={t}
              />
            </div>
          </SectionPanel>
        </div>

        <DialogFooter className="shrink-0 gap-2 border-t border-border bg-white px-7 py-4 sm:justify-end">
          <Button className="rounded-full px-5" variant="outline" onClick={() => onOpenChange(false)}>
            {t("userForm.cancel")}
          </Button>
          <Button className="rounded-full px-5" onClick={handleSave} disabled={saving}>
            {saving ? t("userForm.saving") : t(isEditing ? "userForm.saveCareProfile" : "userForm.createCareProfile")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  children,
  helper,
  htmlFor,
  label,
}: {
  children: ReactNode;
  helper?: string;
  htmlFor?: string;
  label: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {helper && <p className="text-xs leading-relaxed text-muted-foreground">{helper}</p>}
    </div>
  );
}

function SectionPanel({
  children,
  description,
  icon: Icon,
  title,
  tone = "primary",
}: {
  children: ReactNode;
  description: string;
  icon: LucideIcon;
  title: string;
  tone?: "primary" | "pink" | "orange" | "green";
}) {
  const toneClass = {
    green: "bg-emerald-50 text-emerald-700",
    orange: "bg-orange-50 text-orange-700",
    pink: "bg-pink-50 text-pink-700",
    primary: "bg-primary/10 text-primary",
  }[tone];

  return (
    <section className="rounded-3xl border border-border bg-white p-5 shadow-sm">
      <div className="mb-5 flex items-start gap-3">
        <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl", toneClass)}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-base font-bold text-foreground">{title}</h3>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function ChipEditor({
  addLabel,
  helper,
  inputValue,
  items,
  label,
  onAdd,
  onInputChange,
  onRemove,
  placeholder,
}: {
  addLabel: string;
  helper: string;
  inputValue: string;
  items: string[];
  label: string;
  onAdd: () => void;
  onInputChange: (value: string) => void;
  onRemove: (index: number) => void;
  placeholder: string;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="min-h-11 rounded-2xl border border-border bg-muted/20 p-2">
        {items.length ? (
          <div className="flex flex-wrap gap-2">
            {items.map((item, index) => (
              <Badge key={`${item}-${index}`} variant="secondary" className="gap-1 rounded-full px-3 py-1 text-xs font-semibold">
                {item}
                <button type="button" className="text-muted-foreground hover:text-destructive" onClick={() => onRemove(index)}>
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        ) : (
          <p className="px-2 py-1 text-xs text-muted-foreground">{helper}</p>
        )}
      </div>
      <div className="flex gap-2">
        <Input
          value={inputValue}
          onChange={(event) => onInputChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              onAdd();
            }
          }}
          placeholder={placeholder}
        />
        <Button type="button" variant="secondary" className="shrink-0 rounded-xl px-4" onClick={onAdd}>
          {addLabel}
        </Button>
      </div>
    </div>
  );
}

function SwitchRow({
  checked,
  description,
  label,
  onCheckedChange,
}: {
  checked: boolean;
  description: string;
  label: string;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-muted/20 p-4">
      <div>
        <p className="text-sm font-bold text-foreground">{label}</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

function ServiceEditor({
  enabled,
  frequency,
  label,
  onEnabledChange,
  onFrequencyChange,
  onTimeChange,
  preferredTime,
  t,
}: {
  enabled: boolean;
  frequency: string;
  label: string;
  onEnabledChange: (checked: boolean) => void;
  onFrequencyChange: (value: string) => void;
  onTimeChange: (value: string) => void;
  preferredTime: string;
  t: (key: string) => string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-white p-4">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-foreground">{label}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t("userForm.followUpCardDescription")}</p>
        </div>
        <Switch checked={enabled} onCheckedChange={onEnabledChange} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t("userForm.frequency")}>
          <Select value={frequency || "weekly"} onValueChange={onFrequencyChange} disabled={!enabled}>
            <SelectTrigger className="h-12 rounded-xl bg-white px-4">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-2xl border-border p-1 shadow-lg">
              {cadenceOptions.map((option) => (
                <CareSelectItem key={option} value={option}>
                  {t(`userForm.frequency.${option}`)}
                </CareSelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label={t("userForm.preferredTime")} htmlFor={`service-time-${label}`}>
          <Input
            id={`service-time-${label}`}
            type="time"
            value={preferredTime}
            onChange={(event) => onTimeChange(event.target.value)}
            disabled={!enabled}
          />
        </Field>
      </div>
    </div>
  );
}

function CareSelectItem({ children, value }: { children: ReactNode; value: string }) {
  return (
    <SelectItem
      value={value}
      className="rounded-xl py-2.5 focus:bg-primary/10 focus:text-primary data-[state=checked]:bg-primary/10 data-[state=checked]:text-primary"
    >
      {children}
    </SelectItem>
  );
}
