import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/contexts/LanguageContext";
import { apiFetch } from "@/lib/apiClient";
import type { OperationalCaregiver } from "@/lib/operationalDemoData";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";

interface EditCaregiverDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vyvaUserId?: string;
  caregiver?: OperationalCaregiver | null;
}

function isValidPhoneInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return true;
  const digits = trimmed.replace(/\D/g, "");
  return /^\+[1-9][0-9\s().-]{6,24}$/.test(trimmed) && digits.length >= 8 && digits.length <= 15;
}

export function EditCaregiverDialog({ open, onOpenChange, vyvaUserId, caregiver }: EditCaregiverDialogProps) {
  const queryClient = useQueryClient();
  const { t } = useLanguage();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    caretaker_name: caregiver?.caretaker_name || "",
    caretaker_phone: caregiver?.caretaker_phone || "",
  });

  const update = (key: string, value: string) => setForm(f => ({ ...f, [key]: value }));

  const handleSave = async () => {
    if (!form.caretaker_name.trim()) {
      toast({ title: t("careProviders.validation.name"), variant: "destructive" });
      return;
    }
    if (!isValidPhoneInput(form.caretaker_phone)) {
      toast({ title: t("userForm.validation.caregiverPhone"), variant: "destructive" });
      return;
    }
    const payload = {
      ...(vyvaUserId ? { vyva_user_id: vyvaUserId } : {}),
      caretaker_name: form.caretaker_name.trim(),
      caretaker_phone: form.caretaker_phone.trim() || null,
    };

    setSaving(true);
    try {
      const endpoint = caregiver
        ? `/api/v1/user-dashboard/caregivers/${caregiver.id}`
        : vyvaUserId
          ? "/api/v1/user-dashboard/caregivers"
          : "/api/v1/care-providers";
      await apiFetch(endpoint, {
        method: caregiver ? "PUT" : "POST",
        body: JSON.stringify(payload),
      });

      toast({ title: t("careProviders.saved") });
      if (vyvaUserId) {
        queryClient.invalidateQueries({ queryKey: ["vyva-user-profile", vyvaUserId] });
      }
      queryClient.invalidateQueries({ queryKey: ["gis-data"] });
      queryClient.invalidateQueries({ queryKey: ["care-providers"] });
      queryClient.invalidateQueries({ queryKey: ["emergency-contacts"] });
      onOpenChange(false);
    } catch {
      toast({
        title: t("careProviders.saveFailed"),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{caregiver ? t("careProviders.editContact") : t("careProviders.addContact")}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="space-y-1.5">
            <Label>{t("careProviders.name")} *</Label>
            <Input value={form.caretaker_name} onChange={e => update("caretaker_name", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("careProviders.phone")}</Label>
            <Input
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder={t("userForm.phonePlaceholder")}
              value={form.caretaker_phone}
              onChange={e => update("caretaker_phone", e.target.value)}
            />
            <p className="text-xs text-muted-foreground">{t("userForm.phoneHelp")}</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("userForm.cancel")}</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? t("userForm.saving") : t("userForm.save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
