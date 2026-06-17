import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/apiClient";
import type { OperationalMedication } from "@/lib/operationalDemoData";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";

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
    schedule_times: medication?.schedule_times?.join(", ") || "",
  });

  const update = (key: string, value: string) => setForm(f => ({ ...f, [key]: value }));

  const handleSave = async () => {
    if (!form.medication_name.trim()) {
      toast({ title: t("profile.medicationNameRequired"), variant: "destructive" });
      return;
    }
    const times = form.schedule_times.split(",").map(t => t.trim()).filter(Boolean);
    const payload = {
      vyva_user_id: vyvaUserId,
      medication_name: form.medication_name.trim(),
      dosage: form.dosage.trim() || null,
      purpose: form.purpose.trim() || null,
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
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("checkin.cancel")}</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? t("checkin.saving") : t("checkin.save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
