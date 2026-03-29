import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { StatCard } from "@/components/StatCard";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, ShieldAlert, CheckCircle, Activity, Search } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Sensors() {
  const [search, setSearch] = useState("");
  const navigate = useNavigate();

  const { data: alerts, isLoading: alertsLoading } = useQuery({
    queryKey: ["sensor-alerts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vyva_sensor_alerts")
        .select("*, vyva_user_sensors(device_id, device_name, sensor_type), vyva_users(first_name, last_name, city)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 15000,
  });

  const { data: sensors, isLoading: sensorsLoading } = useQuery({
    queryKey: ["sensor-devices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vyva_user_sensors")
        .select("*, vyva_users(first_name, last_name)")
        .order("last_reading_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 15000,
  });

  const isLoading = alertsLoading || sensorsLoading;

  const criticalCount = alerts?.filter((a: any) => a.severity === "critical" && !a.resolved_at).length || 0;
  const warningCount = alerts?.filter((a: any) => a.severity === "warning" && !a.resolved_at).length || 0;
  const resolvedToday = alerts?.filter((a: any) => {
    if (!a.resolved_at) return false;
    const today = new Date().toISOString().split("T")[0];
    return a.resolved_at.startsWith(today);
  }).length || 0;

  const onlineCount = sensors?.filter((s: any) => s.status === "online").length || 0;
  const offlineCount = sensors?.filter((s: any) => s.status === "offline").length || 0;
  const lowBatteryCount = sensors?.filter((s: any) => s.battery_level !== null && s.battery_level < 20).length || 0;

  const activeAlerts = alerts?.filter((a: any) => !a.resolved_at) || [];
  const filteredAlerts = activeAlerts.filter((a: any) => {
    if (!search) return true;
    const q = search.toLowerCase();
    const userName = `${a.vyva_users?.first_name || ""} ${a.vyva_users?.last_name || ""}`.toLowerCase();
    const deviceName = (a.vyva_user_sensors?.device_name || "").toLowerCase();
    return userName.includes(q) || deviceName.includes(q) || a.alert_type.toLowerCase().includes(q);
  });

  const severityColor = (severity: string) => {
    switch (severity) {
      case "critical": return "bg-destructive text-destructive-foreground";
      case "warning": return "bg-accent text-accent-foreground";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const sensorTypeLabel = (type: string) => {
    switch (type) {
      case "heart_rate": return "Heart Rate";
      case "blood_pressure": return "Blood Pressure";
      case "fall_detector": return "Fall Detector";
      case "activity_monitor": return "Activity Monitor";
      default: return type;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold text-foreground">Sensor Monitoring</h1>

      {/* Alert Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          title="Critical Alerts"
          value={criticalCount}
          icon={<ShieldAlert className="h-5 w-5" />}
          gradient="bg-gradient-to-br from-red-600 to-red-800"
          subtitle="Require immediate action"
        />
        <StatCard
          title="Warnings"
          value={warningCount}
          icon={<AlertTriangle className="h-5 w-5" />}
          gradient="bg-gradient-to-br from-amber-500 to-orange-600"
          subtitle="Need attention"
        />
        <StatCard
          title="Resolved Today"
          value={resolvedToday}
          icon={<CheckCircle className="h-5 w-5" />}
          gradient="bg-[--gradient-cool]"
          subtitle="Cleared alerts"
        />
      </div>

      {/* Device Health Overview */}
      <Card>
        <CardHeader className="flex flex-row items-center gap-2 pb-3">
          <Activity className="h-5 w-5 text-vyva-teal" />
          <CardTitle className="font-display text-base">Device Health</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-foreground">{sensors?.length || 0}</p>
              <p className="text-xs text-muted-foreground">Total Devices</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-vyva-green">{onlineCount}</p>
              <p className="text-xs text-muted-foreground">Online</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-muted-foreground">{offlineCount}</p>
              <p className="text-xs text-muted-foreground">Offline</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-destructive">{lowBatteryCount}</p>
              <p className="text-xs text-muted-foreground">Low Battery</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Active Alerts */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-destructive" />
            <CardTitle className="font-display text-base">Active Alerts ({activeAlerts.length})</CardTitle>
          </div>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search alerts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardHeader>
        <CardContent>
          {filteredAlerts.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle className="mx-auto h-10 w-10 text-vyva-green mb-2" />
              <p className="text-muted-foreground">No active alerts — all clear!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredAlerts.map((alert: any) => (
                <div
                  key={alert.id}
                  className="flex items-center justify-between rounded-lg border border-border/50 p-4 hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => navigate(`/users/${alert.vyva_user_id}`)}
                >
                  <div className="flex items-center gap-4">
                    <Badge className={severityColor(alert.severity)}>
                      {alert.severity}
                    </Badge>
                    <div>
                      <p className="font-medium text-sm text-foreground">
                        {alert.alert_type.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {alert.vyva_users?.first_name} {alert.vyva_users?.last_name}
                        {alert.vyva_user_sensors?.device_name && ` — ${alert.vyva_user_sensors.device_name}`}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">
                      {alert.vyva_user_sensors?.sensor_type && sensorTypeLabel(alert.vyva_user_sensors.sensor_type)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(alert.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
