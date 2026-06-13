import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));

  const handleSave = async () => {
    if (!form.first_name.trim() || !form.last_name.trim()) {
      toast({ title: t("userForm.validation.nameRequired"), variant: "destructive" });
      return;
    }

    if (form.date_of_birth && !/^\d{4}-\d{2}-\d{2}$/.test(form.date_of_birth)) {
      toast({ title: t("userForm.validation.date"), variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const payload = {
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
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t(isEditing ? "userForm.editTitle" : "userForm.addTitle")}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
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
              <Input id="user-phone" value={form.phone} onChange={(event) => update("phone", event.target.value)} />
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
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unspecified">{t("userForm.unspecified")}</SelectItem>
                  <SelectItem value="female">{t("userForm.genderFemale")}</SelectItem>
                  <SelectItem value="male">{t("userForm.genderMale")}</SelectItem>
                  <SelectItem value="other">{t("userForm.genderOther")}</SelectItem>
                </SelectContent>
              </Select>
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
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("userForm.cancel")}
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? t("userForm.saving") : t("userForm.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
