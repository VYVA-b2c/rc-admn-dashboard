import { useState } from "react";
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

interface EditServiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vyvaUserId: string;
  service: OperationalService;
  serviceName: "Check-in" | "Brain Coach";
  serviceType: "checkin" | "brainCoach";
}

export function EditServiceDialog({ open, onOpenChange, vyvaUserId, service, serviceName, serviceType }: EditServiceDialogProps) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    enabled: service?.enabled ?? false,
    frequency: service?.frequency || "",
    preferred_time: service?.preferred_time || "",
  });

  const handleSave = async () => {
    if (serviceType === "checkin" && !service.id) {
      toast({ title: "Check-in settings are not available", variant: "destructive" });
      return;
    }

    const path =
      serviceType === "checkin"
        ? `/api/v1/user-dashboard/checkins/${service.id}`
        : `/api/v1/user-dashboard/brain-coach/${vyvaUserId}`;

    setSaving(true);
    try {
      await apiFetch(path, {
        method: "PUT",
        body: JSON.stringify({
          enabled: form.enabled,
          frequency: form.frequency || null,
          preferred_time: form.preferred_time || null,
        }),
      });

      toast({ title: `${serviceName} settings updated` });
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
          <DialogTitle>Edit {serviceName} Settings</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="flex items-center justify-between">
            <Label>Enabled</Label>
            <Switch checked={form.enabled} onCheckedChange={v => setForm(f => ({ ...f, enabled: v }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Frequency</Label>
            <Select value={form.frequency} onValueChange={v => setForm(f => ({ ...f, frequency: v }))}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="biweekly">Biweekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Preferred Time</Label>
            <Input type="time" value={form.preferred_time} onChange={e => setForm(f => ({ ...f, preferred_time: e.target.value }))} />
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
