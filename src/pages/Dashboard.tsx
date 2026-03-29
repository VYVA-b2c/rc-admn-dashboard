import { useCallback, useState } from "react";
import { Users, PhoneCall, AlertTriangle, Radio, Heart, MapPin } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useGISData, type GISUser } from "@/hooks/useGISData";
import { GISMap } from "@/components/dashboard/GISMap";
import { UserDetailModal } from "@/components/dashboard/UserDetailModal";
import { formatDistanceToNow } from "date-fns";

function MiniStat({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-card p-3">
      <div className={`rounded-md p-1.5 ${color}`}>{icon}</div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="font-display text-lg font-bold text-foreground">{value}</p>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { data, isLoading } = useGISData();
  const [selectedUser, setSelectedUser] = useState<GISUser | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const handleUserClick = useCallback((user: GISUser) => {
    setSelectedUser(user);
    setModalOpen(true);
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h1 className="font-display text-2xl font-bold text-foreground">GIS Command Center</h1>
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-[400px] rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <MapPin className="h-6 w-6 text-destructive" />
        <h1 className="font-display text-2xl font-bold text-foreground">
          DRK Saxony — GIS Command Center
        </h1>
      </div>

      {/* Stat row */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        <MiniStat icon={<Users className="h-4 w-4 text-primary-foreground" />} label="Users" value={data?.totalUsers ?? 0} color="bg-primary" />
        <MiniStat icon={<PhoneCall className="h-4 w-4 text-primary-foreground" />} label="Check-ins Active" value={data?.checkinsEnabled ?? 0} color="bg-secondary" />
        <MiniStat icon={<AlertTriangle className="h-4 w-4 text-primary-foreground" />} label="Active Alerts" value={data?.activeAlertCount ?? 0} color="bg-destructive" />
        <MiniStat icon={<Radio className="h-4 w-4 text-primary-foreground" />} label="Sensors" value={data?.totalSensors ?? 0} color="bg-accent" />
        <MiniStat icon={<Heart className="h-4 w-4 text-primary-foreground" />} label="Caregivers" value={data?.caregiversLinked ?? 0} color="bg-secondary" />
      </div>

      {/* Map */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <GISMap users={data?.gisUsers ?? []} onUserClick={handleUserClick} />
        </CardContent>
      </Card>

      {/* Legend */}
      <div className="flex gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-full bg-[#dc2626]" /> Critical
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-full bg-[#f59e0b]" /> Warning
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-full bg-[#22c55e]" /> Stable
        </span>
      </div>

      {/* Bottom panels */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Active Alerts Feed */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="font-display text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Active Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[240px]">
              {data?.activeAlerts && data.activeAlerts.length > 0 ? (
                <div className="space-y-2 pr-3">
                  {data.activeAlerts.map((alert) => (
                    <div
                      key={alert.id}
                      className="flex items-start gap-3 rounded-lg border border-border p-3"
                    >
                      <span
                        className={`mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full ${
                          alert.severity === "critical" ? "bg-destructive" : "bg-accent"
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium truncate">{alert.user_name}</p>
                          <Badge
                            variant={alert.severity === "critical" ? "destructive" : "secondary"}
                            className="text-[10px] shrink-0"
                          >
                            {alert.severity}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {alert.alert_type}: {alert.message || "No details"}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {alert.city} · {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">No active alerts</p>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* City Distribution */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="font-display text-base">Users by City</CardTitle>
          </CardHeader>
          <CardContent>
            {data?.cityDistribution && data.cityDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={data.cityDistribution}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="city" className="text-xs" />
                  <YAxis allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: "0.5rem",
                      border: "1px solid hsl(var(--border))",
                      background: "hsl(var(--card))",
                    }}
                  />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">No data yet</p>
            )}
          </CardContent>
        </Card>
      </div>

      <UserDetailModal user={selectedUser} open={modalOpen} onOpenChange={setModalOpen} />
    </div>
  );
}
