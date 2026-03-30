import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";

interface EditHealthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vyvaUserId: string;
  health: any;
}

export function EditHealthDialog({ open, onOpenChange, vyvaUserId, health }: EditHealthDialogProps) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [conditions, setConditions] = useState<string[]>(health?.health_conditions || []);
  const [mobility, setMobility] = useState<string[]>(health?.mobility_needs || []);
  const [newCondition, setNewCondition] = useState("");
  const [newMobility, setNewMobility] = useState("");

  const addItem = (list: string[], setList: (v: string[]) => void, value: string, setInput: (v: string) => void) => {
    const v = value.trim();
    if (v && !list.includes(v)) {
      setList([...list, v]);
      setInput("");
    }
  };

  const removeItem = (list: string[], setList: (v: string[]) => void, index: number) => {
    setList(list.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase.from("vyva_user_health").update({
      health_conditions: conditions.length ? conditions : null,
      mobility_needs: mobility.length ? mobility : null,
    }).eq("vyva_user_id", vyvaUserId);
    setSaving(false);
    if (error) {
      toast({ title: "Error saving", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Health info updated" });
      queryClient.invalidateQueries({ queryKey: ["vyva-user-profile", vyvaUserId] });
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Health Info</DialogTitle>
        </DialogHeader>
        <div className="grid gap-5 py-2">
          <div className="space-y-2">
            <Label>Health Conditions</Label>
            <div className="flex flex-wrap gap-1.5 min-h-[32px]">
              {conditions.map((c, i) => (
                <Badge key={i} variant="secondary" className="gap-1 text-xs">
                  {c}
                  <button onClick={() => removeItem(conditions, setConditions, i)} className="ml-0.5 hover:text-destructive">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={newCondition}
                onChange={e => setNewCondition(e.target.value)}
                placeholder="Add condition…"
                onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addItem(conditions, setConditions, newCondition, setNewCondition))}
              />
              <Button type="button" size="sm" variant="secondary" onClick={() => addItem(conditions, setConditions, newCondition, setNewCondition)}>Add</Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Mobility Needs</Label>
            <div className="flex flex-wrap gap-1.5 min-h-[32px]">
              {mobility.map((m, i) => (
                <Badge key={i} variant="secondary" className="gap-1 text-xs">
                  {m}
                  <button onClick={() => removeItem(mobility, setMobility, i)} className="ml-0.5 hover:text-destructive">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={newMobility}
                onChange={e => setNewMobility(e.target.value)}
                placeholder="Add mobility need…"
                onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addItem(mobility, setMobility, newMobility, setNewMobility))}
              />
              <Button type="button" size="sm" variant="secondary" onClick={() => addItem(mobility, setMobility, newMobility, setNewMobility)}>Add</Button>
            </div>
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
