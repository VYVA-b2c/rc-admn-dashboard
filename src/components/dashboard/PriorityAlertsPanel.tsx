import { AlertTriangle, Eye, Phone, CheckCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDistanceToNow, differenceInMinutes } from "date-fns";
import { useLanguage } from "@/contexts/LanguageContext";
import type { ActiveAlert } from "@/hooks/useGISData";

const SEVERITY_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  critical: { color: "bg-destructive", bg: "bg-destructive/10", label: "Critical" },
  high: { color: "bg-[hsl(24,94%,53%)]", bg: "bg-[hsl(24,94%,53%)]/10", label: "High" },
  warning: { color: "bg-[hsl(24,94%,53%)]", bg: "bg-[hsl(24,94%,53%)]/10", label: "High" },
  medium: { color: "bg-accent", bg: "bg-accent/10", label: "Medium" },
  low: { color: "bg-vyva-green", bg: "bg-vyva-green/10", label: "Low" },
};

function getSeverityConfig(severity: string) {
  return SEVERITY_CONFIG[severity] || SEVERITY_CONFIG.low;
}

/* ---------- Alert message formatting ---------- */
const ALERT_MESSAGES: Record<string, string> = {
  fall_detected: "Possible fall detected — no confirmation received",
  missed_checkin: "No response after scheduled check-in attempts",
  high_heart_rate: "Heart rate above threshold for extended period",
  low_battery: "Battery critically low",
  medication_missed: "Medication not confirmed after reminder window",
  inactivity_detected: "No activity detected for extended period",
  temperature_high: "Room temperature above safe threshold",
  door_open: "Door open for unusually long period",
};

function formatAlertMessage(alertType: string, message: string | null): string {
  return ALERT_MESSAGES[alertType] || message || alertType.replace(/_/g, " ");
}

/* ---------- Status derivation ---------- */
type AlertStatus = "New" | "Ongoing" | "Escalated";

function deriveStatus(severity: string, createdAt: string): AlertStatus {
  const ageMin = differenceInMinutes(new Date(), new Date(createdAt));
  const sev = severity === "warning" ? "high" : severity;

  if (sev === "critical") {
    if (ageMin < 15) return "New";
    if (ageMin < 120) return "Ongoing";
    return "Escalated";
  }
  if (sev === "high") {
    if (ageMin < 60) return "New";
    if (ageMin < 240) return "Ongoing";
    return "Escalated";
  }
  // medium / low
  if (ageMin < 240) return "New";
  if (ageMin < 1440) return "Ongoing";
  return "Escalated";
}

const STATUS_STYLES: Record<AlertStatus, string> = {
  New: "bg-primary/15 text-primary border-primary/30",
  Ongoing: "bg-accent/15 text-accent-foreground border-accent/40",
  Escalated: "bg-destructive/15 text-destructive border-destructive/40",
};

/* ---------- Summary bar ---------- */
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

/* ---------- Main component ---------- */
interface Props {
  alerts: ActiveAlert[];
  onAlertClick?: (alert: ActiveAlert) => void;
}

export function PriorityAlertsPanel({ alerts, onAlertClick }: Props) {
  const { t } = useLanguage();
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="font-display text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            {t("alerts.priorityAlerts")}
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
                const isCritical = alert.severity === "critical";
                const status = deriveStatus(alert.severity, alert.created_at);

                return (
                  <div
                    key={alert.id}
                    className="flex items-start gap-3 rounded-lg border border-border p-3 hover:bg-muted/40 transition-colors cursor-pointer"
                    onClick={() => onAlertClick?.(alert)}
                  >
                    {/* Severity dot */}
                    <span
                      className={`mt-1 h-3 w-3 shrink-0 rounded-full ${cfg.color} ${isCritical ? "animate-alert-pulse" : ""}`}
                    />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium truncate">{alert.user_name}</p>
                        <Badge
                          className={`text-[10px] shrink-0 border-0 ${cfg.color} text-white ${isCritical ? "animate-alert-pulse" : ""}`}
                        >
                          {cfg.label}
                        </Badge>
                      </div>

                      {/* Operational message */}
                      <p className="text-xs text-muted-foreground truncate">
                        {formatAlertMessage(alert.alert_type, alert.message)}
                      </p>

                      {/* Time + status pill */}
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-[10px] text-muted-foreground">
                          {alert.city ?? "Unknown"} · {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true })}
                        </p>
                        <span
                          className={`text-[9px] px-1.5 py-0.5 rounded-full border font-medium leading-none ${STATUS_STYLES[status]}`}
                        >
                          {status}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
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
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <CheckCircle className="h-8 w-8 mb-2 text-vyva-green" />
              <p className="text-sm">All clear — no active alerts</p>
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
