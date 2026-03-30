import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { toast } from "@/hooks/use-toast";
import {
  Phone,
  PhoneCall,
  Stethoscope,
  UserCheck,
  MessageSquare,
  MapPin,
  AlertTriangle,
  CheckCircle,
  Loader2,
} from "lucide-react";
import { getRiskColor, getRiskLabel, getRiskBadgeClasses } from "@/lib/riskScore";
import type { GISUser, ActiveAlert } from "@/hooks/useGISData";
import { formatDistanceToNow, differenceInYears } from "date-fns";

interface InterventionPanelProps {
  user: GISUser | null;
  alerts: ActiveAlert[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function RiskCircle({ score }: { score: number }) {
  const color = getRiskColor(score);
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="relative h-24 w-24 shrink-0 cursor-help">
            <svg width="96" height="96" viewBox="0 0 96 96">
              <circle cx="48" cy="48" r={radius} fill="none" stroke="hsl(var(--muted))" strokeWidth="6" />
              <circle
                cx="48"
                cy="48"
                r={radius}
                fill="none"
                stroke={color}
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                transform="rotate(-90 48 48)"
                className="transition-all duration-700"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xl font-bold text-foreground">{score}</span>
              <span className="text-[10px] text-muted-foreground">risk</span>
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>Based on activity, check-ins, medication adherence, and alerts</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

type ActionKey = "checkin" | "doctor" | "caregiver" | "message";

export function InterventionPanel({ user, alerts, open, onOpenChange }: InterventionPanelProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState<ActionKey | null>(null);
  const [success, setSuccess] = useState<ActionKey | null>(null);

  const simulateAction = useCallback((key: ActionKey, label: string) => {
    setLoading(key);
    setTimeout(() => {
      setLoading(null);
      setSuccess(key);
      toast({ title: `${label} triggered`, description: `Action simulated for ${user?.first_name} ${user?.last_name}` });
      setTimeout(() => setSuccess(null), 2000);
    }, 1200);
  }, [user]);

  if (!user) return null;

  const fullName = `${user.first_name} ${user.last_name}`;
  const age = user.date_of_birth
    ? differenceInYears(new Date(), new Date(user.date_of_birth))
    : null;

  const userAlerts = alerts.filter((a) => a.vyva_user_id === user.id);

  const actionButton = (
    key: ActionKey,
    label: string,
    icon: React.ReactNode,
    variant: "default" | "outline" = "outline",
  ) => {
    const isLoading = loading === key;
    const isSuccess = success === key;
    return (
      <Button
        variant={variant}
        className="h-14 flex-1 min-w-[120px] gap-2 text-sm font-semibold"
        disabled={isLoading}
        onClick={() => simulateAction(key, label)}
      >
        {isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : isSuccess ? (
          <CheckCircle className="h-5 w-5 text-green-500" />
        ) : (
          icon
        )}
        {label}
      </Button>
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
        {/* Header */}
        <SheetHeader className="px-6 pt-6 pb-4">
          <div className="flex items-start gap-4">
            <RiskCircle score={user.riskScore} />
            <div className="min-w-0 flex-1">
              <SheetTitle className="font-display text-lg">{fullName}</SheetTitle>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <Badge className={`text-xs border-0 ${getRiskBadgeClasses(user.riskScore)}`}>
                  {getRiskLabel(user.riskScore)}
                </Badge>
                {age !== null && (
                  <span className="text-xs text-muted-foreground">{age} years</span>
                )}
              </div>
              {user.city && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                  <MapPin className="h-3 w-3" /> {user.city}
                </span>
              )}
            </div>
          </div>
        </SheetHeader>

        <Separator />

        {/* Content */}
        <ScrollArea className="flex-1">
          <div className="space-y-5 px-6 py-5">
            {/* Quick stats */}
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg bg-muted/50 p-2.5 text-center">
                <p className="text-xs text-muted-foreground">Alerts</p>
                <p className="text-lg font-bold text-foreground">{user.activeAlerts}</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-2.5 text-center">
                <p className="text-xs text-muted-foreground">Sensors</p>
                <p className="text-lg font-bold text-foreground">{user.sensorCount}</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-2.5 text-center">
                <p className="text-xs text-muted-foreground">Check-in</p>
                <p className="text-lg font-bold text-foreground">{user.checkinEnabled ? "On" : "Off"}</p>
              </div>
            </div>

            {/* Current alerts */}
            {userAlerts.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  Active Alerts ({userAlerts.length})
                </h4>
                <div className="space-y-1.5">
                  {userAlerts.slice(0, 5).map((a) => (
                    <div key={a.id} className="flex items-center gap-2 rounded border border-border p-2 text-xs">
                      <span
                        className="h-2 w-2 rounded-full shrink-0"
                        style={{ backgroundColor: a.severity === "critical" ? "hsl(0,72%,51%)" : "hsl(24,94%,53%)" }}
                      />
                      <span className="truncate flex-1">{a.alert_type}: {a.message || "No details"}</span>
                      <span className="text-muted-foreground shrink-0">
                        {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <Separator />

        {/* Action Buttons */}
        <div className="px-6 py-4 space-y-2">
          {/* Primary: Call */}
          {user.phone ? (
            <Button className="w-full h-14 gap-2 text-sm font-semibold" asChild>
              <a href={`tel:${user.phone}`}>
                <Phone className="h-5 w-5" /> Call User
              </a>
            </Button>
          ) : (
            <Button className="w-full h-14 gap-2 text-sm font-semibold" disabled>
              <Phone className="h-5 w-5" /> No Phone Number
            </Button>
          )}

          <div className="flex flex-wrap gap-2">
            {actionButton("checkin", "Trigger Check-in", <PhoneCall className="h-5 w-5" />)}
            {actionButton("doctor", "Request Doctor", <Stethoscope className="h-5 w-5" />)}
          </div>
          <div className="flex flex-wrap gap-2">
            {actionButton("caregiver", "Notify Caregiver", <UserCheck className="h-5 w-5" />)}
            {actionButton("message", "Send Message", <MessageSquare className="h-5 w-5" />)}
          </div>

          <Button
            variant="ghost"
            className="w-full text-xs text-muted-foreground"
            onClick={() => { onOpenChange(false); navigate(`/users/${user.id}`); }}
          >
            View Full Profile →
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
