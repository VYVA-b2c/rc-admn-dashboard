import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/apiClient";
import type { OperationalCaregiver } from "@/lib/operationalDemoData";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";

interface EditCaregiverDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vyvaUserId: string;
  caregiver?: OperationalCaregiver | null;
}

export function EditCaregiverDialog({ open, onOpenChange, vyvaUserId, caregiver }: EditCaregiverDialogProps) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    caretaker_name: caregiver?.caretaker_name || "",
    caretaker_phone: caregiver?.caretaker_phone || "",
  });

  const update = (key: string, value: string) => setForm(f => ({ ...f, [key]: value }));

  const handleSave = async () => {
    if (!form.caretaker_name.trim()) {
      toast({ title: "Caregiver name is required", variant: "destructive" });
      return;
    }
    const payload = {
      vyva_user_id: vyvaUserId,
      caretaker_name: form.caretaker_name.trim(),
      caretaker_phone: form.caretaker_phone.trim() || null,
    };

    setSaving(true);
    try {
      await apiFetch(caregiver ? `/api/v1/user-dashboard/caregivers/${caregiver.id}` : "/api/v1/user-dashboard/caregivers", {
        method: caregiver ? "PUT" : "POST",
        body: JSON.stringify(payload),
      });

      toast({ title: caregiver ? "Caregiver updated" : "Caregiver added" });
      queryClient.invalidateQueries({ queryKey: ["vyva-user-profile", vyvaUserId] });
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Error saving",
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
          <DialogTitle>{caregiver ? "Edit Caregiver" : "Add Caregiver"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="space-y-1.5">
            <Label>Name *</Label>
            <Input value={form.caretaker_name} onChange={e => update("caretaker_name", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Phone</Label>
            <Input value={form.caretaker_phone} onChange={e => update("caretaker_phone", e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
