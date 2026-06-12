import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "@/hooks/use-toast";
import type { ScheduledCall, ScheduledCallPayload, ScheduledCallUser } from "@/types/scheduledCalls";

const DEFAULT_TYPE = "scheduled_call";
const validTimePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

type FormState = {
  user_id: string;
  type: string;
  is_active: boolean;
  frequency_days: string;
  preferred_time: string;
};

interface ScheduledCallDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  call: ScheduledCall | null;
  users: ScheduledCallUser[];
  onSubmit: (payload: ScheduledCallPayload, call: ScheduledCall | null) => Promise<boolean>;
  submitting: boolean;
}

function userLabel(user: ScheduledCallUser) {
  const fullName = user.name ?? [user.first_name, user.last_name].filter(Boolean).join(" ");
  const detail = [user.phone, user.city].filter(Boolean).join(" - ");
  return detail ? `${fullName || user.id} (${detail})` : fullName || String(user.id);
}

export function ScheduledCallDialog({
  open,
  onOpenChange,
  call,
  users,
  onSubmit,
  submitting,
}: ScheduledCallDialogProps) {
  const { t } = useLanguage();
  const isEdit = Boolean(call);
  const [form, setForm] = useState<FormState>({
    user_id: "",
    type: DEFAULT_TYPE,
    is_active: true,
    frequency_days: "1",
    preferred_time: "09:00",
  });

  const userOptions = useMemo(() => {
    if (!call) return users;
    const hasCurrentUser = users.some((user) => String(user.id) === String(call.user_id));
    if (hasCurrentUser) return users;
    return [
      {
        id: call.user_id,
        name: call.userName,
        phone: call.userPhone,
        city: call.city,
      },
      ...users,
    ];
  }, [call, users]);

  useEffect(() => {
    if (!open) return;
    setForm({
      user_id: call ? String(call.user_id) : "",
      type: call?.type || DEFAULT_TYPE,
      is_active: call?.is_active ?? true,
      frequency_days: String(call?.frequency_days || 1),
      preferred_time: call?.preferred_time || "09:00",
    });
  }, [call, open]);

  const updateForm = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleSubmit = async () => {
    const frequency = Number(form.frequency_days);
    if (!form.user_id) {
      toast({ title: t("checkin.validation.userRequired"), variant: "destructive" });
      return;
    }
    if (!Number.isInteger(frequency) || frequency < 1) {
      toast({ title: t("checkin.validation.frequency"), variant: "destructive" });
      return;
    }
    if (!validTimePattern.test(form.preferred_time)) {
      toast({ title: t("checkin.validation.time"), variant: "destructive" });
      return;
    }

    const saved = await onSubmit(
      {
        user_id: form.user_id,
        type: form.type,
        is_active: form.is_active,
        frequency_days: frequency,
        preferred_time: form.preferred_time || null,
      },
      call,
    );

    if (saved) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? t("checkin.editScheduledCall") : t("checkin.addScheduledCall")}</DialogTitle>
          <DialogDescription>{t("checkin.dialogDescription")}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="scheduled-call-user">{t("checkin.user")}</Label>
            <Select value={form.user_id} onValueChange={(value) => updateForm("user_id", value)} disabled={submitting}>
              <SelectTrigger id="scheduled-call-user">
                <SelectValue placeholder={t("checkin.selectUser")} />
              </SelectTrigger>
              <SelectContent>
                {userOptions.length === 0 ? (
                  <SelectItem value="__no_users" disabled>
                    {t("checkin.noUsersAvailable")}
                  </SelectItem>
                ) : (
                  userOptions.map((user) => (
                    <SelectItem key={String(user.id)} value={String(user.id)}>
                      {userLabel(user)}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="scheduled-call-type">{t("checkin.Type")}</Label>
              <Select value={form.type} onValueChange={(value) => updateForm("type", value)} disabled={submitting}>
                <SelectTrigger id="scheduled-call-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="scheduled_call">{t("checkin.type.scheduled_call")}</SelectItem>
                  <SelectItem value="wellness_check">{t("checkin.type.wellness_check")}</SelectItem>
                  <SelectItem value="medication_reminder">{t("checkin.type.medication_reminder")}</SelectItem>
                  <SelectItem value="safety_check">{t("checkin.type.safety_check")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="scheduled-call-frequency">{t("checkin.frequencyDays")}</Label>
              <Input
                id="scheduled-call-frequency"
                type="number"
                min={1}
                step={1}
                value={form.frequency_days}
                onChange={(event) => updateForm("frequency_days", event.target.value)}
                disabled={submitting}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="scheduled-call-time">{t("checkin.preferredTime")}</Label>
              <Input
                id="scheduled-call-time"
                type="time"
                value={form.preferred_time}
                onChange={(event) => updateForm("preferred_time", event.target.value)}
                disabled={submitting}
              />
            </div>

            <div className="flex items-center justify-between rounded-xl border px-3 py-2">
              <div>
                <Label>{t("checkin.status")}</Label>
                <p className="text-xs text-muted-foreground">
                  {form.is_active ? t("checkin.active") : t("checkin.inactive")}
                </p>
              </div>
              <Switch
                checked={form.is_active}
                onCheckedChange={(checked) => updateForm("is_active", checked)}
                disabled={submitting}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            {t("checkin.cancel")}
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? t("checkin.saving") : t("checkin.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
