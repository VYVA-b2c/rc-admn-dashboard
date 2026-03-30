import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";

interface EditMedicationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vyvaUserId: string;
  medication?: any; // null = create mode
}

export function EditMedicationDialog({ open, onOpenChange, vyvaUserId, medication }: EditMedicationDialogProps) {
  const queryClient = useQueryClient();
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
      toast({ title: "Medication name is required", variant: "destructive" });
      return;
    }
    setSaving(true);
    const times = form.schedule_times.split(",").map(t => t.trim()).filter(Boolean);
    const payload = {
      medication_name: form.medication_name.trim(),
      dosage: form.dosage.trim() || null,
      purpose: form.purpose.trim() || null,
      schedule_times: times.length ? times : null,
    };

    let error;
    if (medication) {
      ({ error } = await supabase.from("vyva_user_medications").update(payload).eq("id", medication.id));
    } else {
      ({ error } = await supabase.from("vyva_user_medications").insert({ ...payload, vyva_user_id: vyvaUserId }));
    }
    setSaving(false);
    if (error) {
      toast({ title: "Error saving", description: error.message, variant: "destructive" });
    } else {
      toast({ title: medication ? "Medication updated" : "Medication added" });
      queryClient.invalidateQueries({ queryKey: ["vyva-user-profile", vyvaUserId] });
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{medication ? "Edit Medication" : "Add Medication"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="space-y-1.5">
            <Label>Medication Name *</Label>
            <Input value={form.medication_name} onChange={e => update("medication_name", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Dosage</Label>
              <Input value={form.dosage} onChange={e => update("dosage", e.target.value)} placeholder="e.g. 10mg" />
            </div>
            <div className="space-y-1.5">
              <Label>Purpose</Label>
              <Input value={form.purpose} onChange={e => update("purpose", e.target.value)} placeholder="e.g. Blood pressure" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Schedule Times (comma-separated)</Label>
            <Input value={form.schedule_times} onChange={e => update("schedule_times", e.target.value)} placeholder="08:00, 20:00" />
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
