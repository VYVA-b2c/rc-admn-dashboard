import { useCallback } from "react";
import { AlertTriangle, Eye, Phone, CheckCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import type { ActiveAlert } from "@/hooks/useGISData";

const SEVERITY_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  critical: { color: "bg-[hsl(0,72%,51%)]", bg: "bg-[hsl(0,72%,51%)]/10", label: "Critical" },
  high: { color: "bg-[hsl(24,94%,53%)]", bg: "bg-[hsl(24,94%,53%)]/10", label: "High" },
  warning: { color: "bg-[hsl(24,94%,53%)]", bg: "bg-[hsl(24,94%,53%)]/10", label: "High" },
  medium: { color: "bg-[hsl(45,96%,53%)]", bg: "bg-[hsl(45,96%,53%)]/10", label: "Medium" },
  low: { color: "bg-[hsl(142,71%,45%)]", bg: "bg-[hsl(142,71%,45%)]/10", label: "Low" },
};

function getSeverityConfig(severity: string) {
  return SEVERITY_CONFIG[severity] || SEVERITY_CONFIG.low;
}

function SeveritySummary({ alerts }: { alerts: ActiveAlert[] }) {
  const counts: Record<string, number> = {};
  for (const a of alerts) {
    const key = a.severity === "warning" ? "high" : a.severity;
    counts[key] = (counts[key] || 0) + 1;
  }

  const order = ["critical", "high", "medium", "low"];
  return (
    <div className="flex flex-wrap items-center gap-2">
      {order.map((sev) =>
        counts[sev] ? (
          <Badge
            key={sev}
            className={`text-xs font-semibold ${getSeverityConfig(sev).color} text-white border-0`}
          >
            {counts[sev]} {getSeverityConfig(sev).label}
          </Badge>
        ) : null,
      )}
      {alerts.length === 0 && (
        <span className="text-sm text-muted-foreground">No active alerts</span>
      )}
    </div>
  );
}

interface Props {
  alerts: ActiveAlert[];
}

export function PriorityAlertsPanel({ alerts }: Props) {
  const queryClient = useQueryClient();

  const handleResolve = useCallback(
    async (alertId: string) => {
      const { error } = await supabase
        .from("vyva_sensor_alerts")
        .update({ resolved_at: new Date().toISOString() })
        .eq("id", alertId);

      if (error) {
        toast({ title: "Failed to resolve alert", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Alert resolved" });
        queryClient.invalidateQueries({ queryKey: ["gis-data"] });
      }
    },
    [queryClient],
  );

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="font-display text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            Priority Alerts
          </CardTitle>
          <SeveritySummary alerts={alerts} />
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[280px]">
          {alerts.length > 0 ? (
            <div className="space-y-2 pr-3">
              {alerts.map((alert) => {
                const cfg = getSeverityConfig(alert.severity);
                return (
                  <div
                    key={alert.id}
                    className="flex items-start gap-3 rounded-lg border border-border p-3 hover:bg-muted/40 transition-colors"
                  >
                    <span className={`mt-1 h-3 w-3 shrink-0 rounded-full ${cfg.color}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium truncate">{alert.user_name}</p>
                        <Badge
                          className={`text-[10px] shrink-0 border-0 ${cfg.color} text-white`}
                        >
                          {cfg.label}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {alert.alert_type}: {alert.message || "No details"}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {alert.city ?? "Unknown"} · {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true })}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                        <Link to={`/users/${alert.vyva_user_id}`}>
                          <Eye className="h-3.5 w-3.5" />
                        </Link>
                      </Button>
                      {alert.phone && (
                        <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                          <a href={`tel:${alert.phone}`}>
                            <Phone className="h-3.5 w-3.5" />
                          </a>
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-green-600 hover:text-green-700"
                        onClick={() => handleResolve(alert.id)}
                      >
                        <CheckCircle className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <CheckCircle className="h-8 w-8 mb-2 text-green-500" />
              <p className="text-sm">All clear — no active alerts</p>
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
