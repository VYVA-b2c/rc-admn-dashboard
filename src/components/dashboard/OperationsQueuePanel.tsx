import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Phone, Eye, Check, Clock } from "lucide-react";
import { differenceInMinutes } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { ActiveAlert, GISUser } from "@/hooks/useGISData";

interface OperationsQueuePanelProps {
  alerts: ActiveAlert[];
  users: GISUser[];
  onUserClick: (user: GISUser) => void;
}

const ACTION_MAP: Record<string, string> = {
  fall_detected: "Call user immediately",
  missed_checkin: "Follow up check-in",
  high_heart_rate: "Review health status",
  medication_missed: "Verify medication status",
  inactivity_detected: "Welfare check required",
  low_battery: "Replace sensor battery",
  temperature_high: "Check environment",
  door_open: "Verify user safety",
};

const SEVERITY_PRIORITY: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

function getUrgency(severity: string, createdAt: string): string {
  const ageMin = differenceInMinutes(new Date(), new Date(createdAt));
  if (severity === "critical") return "Now";
  if (severity === "high") return ageMin < 30 ? "Within 10 min" : "Within 30 min";
  return "Within 1 hour";
}

function getPriorityClasses(severity: string) {
  if (severity === "critical") return { dot: "bg-destructive animate-alert-pulse", text: "text-destructive" };
  if (severity === "high") return { dot: "bg-[hsl(24,94%,53%)]", text: "text-[hsl(24,94%,53%)]" };
  return { dot: "bg-[hsl(45,96%,53%)]", text: "text-[hsl(45,96%,53%)]" };
}

function getUrgencyClasses(urgency: string) {
  if (urgency === "Now") return "bg-destructive/10 text-destructive border-destructive/20";
  if (urgency.includes("10")) return "bg-[hsl(24,94%,53%)]/10 text-[hsl(24,94%,53%)] border-[hsl(24,94%,53%)]/20";
  if (urgency.includes("30")) return "bg-[hsl(45,96%,53%)]/10 text-[hsl(45,96%,53%)] border-[hsl(45,96%,53%)]/20";
  return "bg-muted text-muted-foreground border-border";
}

export function OperationsQueuePanel({ alerts, users, onUserClick }: OperationsQueuePanelProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  const tasks = useMemo(() => {
    const alertTasks = alerts
      .filter((a) => !dismissedIds.has(a.id))
      .map((a) => ({
        id: a.id,
        type: "alert" as const,
        userName: a.user_name,
        userId: a.vyva_user_id,
        phone: a.phone,
        action: ACTION_MAP[a.alert_type] || "Review alert",
        reason: a.message || `${a.alert_type} detected`,
        severity: a.severity,
        urgency: getUrgency(a.severity, a.created_at),
        priority: SEVERITY_PRIORITY[a.severity] ?? 3,
        city: a.city,
      }));

    return alertTasks.sort((a, b) => a.priority - b.priority).slice(0, 8);
  }, [alerts, dismissedIds]);

  const handleDone = async (task: (typeof tasks)[0]) => {
    setDismissedIds((prev) => new Set(prev).add(task.id));
    if (task.type === "alert") {
      const { error } = await supabase
        .from("vyva_sensor_alerts")
        .update({ resolved_at: new Date().toISOString() })
        .eq("id", task.id);
      if (error) {
        toast.error("Failed to resolve alert");
        setDismissedIds((prev) => { const n = new Set(prev); n.delete(task.id); return n; });
      } else {
        toast.success("Task completed");
        queryClient.invalidateQueries({ queryKey: ["gis-data"] });
      }
    }
  };

  const handleUserNav = (task: (typeof tasks)[0]) => {
    const user = users.find((u) => u.id === task.userId);
    if (user) onUserClick(user);
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="font-display text-base flex items-center justify-between">
          Operations Queue
          <span className="text-xs font-normal text-muted-foreground">What to do next</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[280px]">
          {tasks.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">No pending tasks</p>
          ) : (
            <div className="divide-y divide-border">
              {tasks.map((task) => {
                const pc = getPriorityClasses(task.severity);
                const uc = getUrgencyClasses(task.urgency);
                return (
                  <div key={task.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50 transition-colors">
                    {/* Priority dot */}
                    <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${pc.dot}`} />

                    {/* Content */}
                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => handleUserNav(task)}>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground truncate">{task.userName}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${uc}`}>
                          <Clock className="inline h-2.5 w-2.5 mr-0.5 -mt-px" />{task.urgency}
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-foreground truncate">{task.action}</p>
                      <p className="text-xs text-muted-foreground truncate">{task.reason}</p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      {task.phone && (
                        <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                          <a href={`tel:${task.phone}`}><Phone className="h-3.5 w-3.5" /></a>
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigate(`/users/${task.userId}`)}>
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-[hsl(142,71%,45%)] hover:text-[hsl(142,71%,35%)]"
                        onClick={() => handleDone(task)}
                      >
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
