import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiFetch } from "@/lib/apiClient";
import type { OperationalService } from "@/lib/operationalDemoData";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";

interface EditServiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vyvaUserId: string;
  service?: OperationalService | null;
  serviceName: "Check-in" | "Brain Coach";
  serviceType: "checkin" | "brainCoach";
}

export function EditServiceDialog({ open, onOpenChange, vyvaUserId, service, serviceType }: EditServiceDialogProps) {
  const queryClient = useQueryClient();
  const { t } = useLanguage();
  const serviceLabel = serviceType === "checkin" ? t("profile.service.checkins") : t("profile.service.brainCoach");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    enabled: service?.enabled ?? false,
    frequency: service?.frequency || "weekly",
    preferred_time: service?.preferred_time || "",
  });

  useEffect(() => {
    if (!open) return;
    setForm({
      enabled: service?.enabled ?? false,
      frequency: service?.frequency || "weekly",
      preferred_time: service?.preferred_time || "",
    });
  }, [open, service]);

  const handleSave = async () => {
    const path =
      serviceType === "checkin"
        ? `/api/v1/user-dashboard/checkins/${service?.id ?? "new"}`
        : `/api/v1/user-dashboard/brain-coach/${vyvaUserId}`;

    setSaving(true);
    try {
      await apiFetch(path, {
        method: "PUT",
        body: JSON.stringify({
          enabled: form.enabled,
          frequency: form.frequency || null,
          preferred_time: form.preferred_time || null,
          user_id: vyvaUserId,
        }),
      });

      toast({ title: t("profile.serviceUpdated") });
      queryClient.invalidateQueries({ queryKey: ["vyva-user-profile", vyvaUserId] });
      onOpenChange(false);
    } catch (error) {
      toast({
        title: t("profile.serviceSaveFailed"),
        description: error instanceof Error ? error.message : undefined,
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
          <DialogTitle>{t("profile.editServiceSettings").replace("{service}", serviceLabel)}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="flex items-center justify-between">
            <Label>{t("profile.serviceEnabled")}</Label>
            <Switch checked={form.enabled} onCheckedChange={v => setForm(f => ({ ...f, enabled: v }))} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("userForm.frequency")}</Label>
            <Select value={form.frequency} onValueChange={v => setForm(f => ({ ...f, frequency: v }))}>
              <SelectTrigger><SelectValue placeholder={t("profile.select")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">{t("userForm.frequency.daily")}</SelectItem>
                <SelectItem value="weekly">{t("userForm.frequency.weekly")}</SelectItem>
                <SelectItem value="biweekly">{t("userForm.frequency.biweekly")}</SelectItem>
                <SelectItem value="monthly">{t("userForm.frequency.monthly")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{t("checkin.preferredTime")}</Label>
            <Input type="time" value={form.preferred_time} onChange={e => setForm(f => ({ ...f, preferred_time: e.target.value }))} />
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
