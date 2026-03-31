import { useNavigate } from "react-router-dom";
import { Eye, Phone, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { getRiskBand, getRiskBadgeClasses, getRiskLabel } from "@/lib/riskScore";
import type { GISUser } from "@/hooks/useGISData";

interface AtRiskUsersPanelProps {
  users: GISUser[];
  onUserClick: (user: GISUser) => void;
}

function getReason(u: GISUser): string {
  if (u.criticalAlerts > 0) return `${u.criticalAlerts} critical alert(s) unresolved`;
  if (u.missedMeds7d > 0) return `Missed ${u.missedMeds7d} medication(s) this week`;
  if (u.offlineSensors > 0) return `${u.offlineSensors} sensor(s) offline`;
  if (!u.checkinEnabled) return "Check-ins not enabled";
  if (u.healthConditions >= 3) return "Multiple health conditions";
  return "Reduced activity patterns";
}

function TrendIcon({ user }: { user: GISUser }) {
  if (user.criticalAlerts > 0 || user.missedMeds7d >= 2) {
    return <TrendingUp className="h-3.5 w-3.5 text-destructive" />;
  }
  if (user.offlineSensors > 0 || user.missedMeds7d === 1) {
    return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
  }
  return <TrendingDown className="h-3.5 w-3.5 text-[hsl(142,71%,45%)]" />;
}

export function AtRiskUsersPanel({ users, onUserClick }: AtRiskUsersPanelProps) {
  const navigate = useNavigate();

  const atRiskUsers = users
    .filter((u) => u.riskScore > 0)
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, 8);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="font-display text-base flex items-center justify-between">
          At-Risk Users
          <span className="text-xs font-normal text-muted-foreground">Based on recent trends</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[280px]">
          {atRiskUsers.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">No at-risk users</p>
          ) : (
            <div className="divide-y divide-border">
              {atRiskUsers.map((u) => {
                const band = getRiskBand(u.riskScore);
                const scoreColor =
                  band === "high" ? "text-destructive" :
                  band === "moderate" ? "text-[hsl(24,94%,53%)]" :
                  band === "low" ? "text-[hsl(45,96%,53%)]" :
                  "text-[hsl(142,71%,45%)]";

                return (
                  <div
                    key={u.id}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => onUserClick(u)}
                  >
                    {/* Risk score */}
                    <div className="flex flex-col items-center gap-0.5 min-w-[44px]">
                      <span className={`text-xl font-bold leading-none ${scoreColor}`}>{u.riskScore}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${getRiskBadgeClasses(u.riskScore)}`}>
                        {getRiskLabel(u.riskScore)}
                      </span>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium text-foreground truncate">
                          {u.first_name} {u.last_name}
                        </span>
                        <TrendIcon user={u} />
                      </div>
                      {u.city && <p className="text-xs text-muted-foreground">{u.city}</p>}
                      <p className="text-xs text-muted-foreground/80 truncate">{getReason(u)}</p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigate(`/users/${u.id}`)}>
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      {u.phone && (
                        <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                          <a href={`tel:${u.phone}`}><Phone className="h-3.5 w-3.5" /></a>
                        </Button>
                      )}
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
