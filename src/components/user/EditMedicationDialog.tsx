import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { apiFetch } from "@/lib/apiClient";
import type { OperationalMedication } from "@/lib/operationalDemoData";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { isValidIntakeTime } from "@/lib/userIntake";

interface EditMedicationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vyvaUserId: string;
  medication?: OperationalMedication | null;
}

export function EditMedicationDialog({ open, onOpenChange, vyvaUserId, medication }: EditMedicationDialogProps) {
  const queryClient = useQueryClient();
  const { t } = useLanguage();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    medication_name: medication?.medication_name || "",
    dosage: medication?.dosage || "",
    purpose: medication?.purpose || "",
    reminders_enabled: medication?.reminders_enabled ?? true,
    schedule_times: medication?.schedule_times?.join(", ") || "",
  });

  useEffect(() => {
    if (!open) return;
    setForm({
      medication_name: medication?.medication_name || "",
      dosage: medication?.dosage || "",
      purpose: medication?.purpose || "",
      reminders_enabled: medication?.reminders_enabled ?? true,
      schedule_times: medication?.schedule_times?.join(", ") || "",
    });
  }, [medication, open]);

  const update = (key: keyof typeof form, value: string | boolean) => setForm(f => ({ ...f, [key]: value }));

  const handleSave = async () => {
    if (!form.medication_name.trim()) {
      toast({ title: t("profile.medicationNameRequired"), variant: "destructive" });
      return;
    }
    const times = form.schedule_times.split(",").map(t => t.trim()).filter(Boolean);
    if (times.some((time) => !isValidIntakeTime(time))) {
      toast({ title: t("profile.medicationTimeInvalid"), variant: "destructive" });
      return;
    }
    const payload = {
      vyva_user_id: vyvaUserId,
      medication_name: form.medication_name.trim(),
      dosage: form.dosage.trim() || null,
      purpose: form.purpose.trim() || null,
      reminders_enabled: form.reminders_enabled,
      schedule_times: times.length ? times : null,
    };

    setSaving(true);
    try {
      await apiFetch(medication ? `/api/v1/user-dashboard/medications/${medication.id}` : "/api/v1/user-dashboard/medications", {
        method: medication ? "PUT" : "POST",
        body: JSON.stringify(payload),
      });

      toast({ title: medication ? t("profile.medicationUpdated") : t("profile.medicationAdded") });
      queryClient.invalidateQueries({ queryKey: ["vyva-user-profile", vyvaUserId] });
      onOpenChange(false);
    } catch (error) {
      toast({
        title: t("profile.medicationSaveFailed"),
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{medication ? t("profile.editMedication") : t("profile.addMedication")}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="space-y-1.5">
            <Label>{t("profile.medicationName")} *</Label>
            <Input value={form.medication_name} onChange={e => update("medication_name", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t("profile.medicationDosage")}</Label>
              <Input value={form.dosage} onChange={e => update("dosage", e.target.value)} placeholder={t("profile.medicationDosagePlaceholder")} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("profile.medicationPurpose")}</Label>
              <Input value={form.purpose} onChange={e => update("purpose", e.target.value)} placeholder={t("profile.medicationPurposePlaceholder")} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>{t("profile.medicationScheduleTimes")}</Label>
            <Input value={form.schedule_times} onChange={e => update("schedule_times", e.target.value)} placeholder={t("profile.medicationSchedulePlaceholder")} />
          </div>
          <div className="flex items-center justify-between rounded-xl border border-border bg-muted/25 px-4 py-3">
            <div className="pr-4">
              <p className="text-sm font-semibold text-foreground">{t("profile.medicationRemindersEnabled")}</p>
              <p className="mt-1 text-xs text-muted-foreground">{t("profile.medicationReminderToggleDescription")}</p>
            </div>
            <Switch
              aria-label={t("profile.medicationRemindersEnabled")}
              checked={form.reminders_enabled}
              onCheckedChange={(checked) => update("reminders_enabled", checked)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("checkin.cancel")}</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? t("checkin.saving") : t("checkin.save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
