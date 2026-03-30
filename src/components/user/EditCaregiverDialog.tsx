import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";

interface EditCaregiverDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vyvaUserId: string;
  caregiver?: any;
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
    setSaving(true);
    const payload = {
      caretaker_name: form.caretaker_name.trim(),
      caretaker_phone: form.caretaker_phone.trim() || null,
    };
    let error;
    if (caregiver) {
      ({ error } = await supabase.from("vyva_user_caregivers").update(payload).eq("id", caregiver.id));
    } else {
      ({ error } = await supabase.from("vyva_user_caregivers").insert({ ...payload, vyva_user_id: vyvaUserId }));
    }
    setSaving(false);
    if (error) {
      toast({ title: "Error saving", description: error.message, variant: "destructive" });
    } else {
      toast({ title: caregiver ? "Caregiver updated" : "Caregiver added" });
      queryClient.invalidateQueries({ queryKey: ["vyva-user-profile", vyvaUserId] });
      onOpenChange(false);
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
