import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/StatCard";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, ShieldAlert, CheckCircle, Activity, Search, Battery, Wifi, WifiOff, Zap, Settings } from "lucide-react";
import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area, Legend,
} from "recharts";

const CHART_COLORS = [
  "hsl(252 85% 60%)",   // primary
  "hsl(190 80% 50%)",   // teal
  "hsl(45 100% 50%)",   // gold
  "hsl(340 82% 62%)",   // pink
  "hsl(155 70% 45%)",   // green
  "hsl(0 84% 60%)",     // destructive
];

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

  const { data: readings, isLoading: readingsLoading } = useQuery({
    queryKey: ["sensor-readings-recent"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vyva_sensor_readings")
        .select("*, vyva_user_sensors(sensor_type, device_name)")
        .order("recorded_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 30000,
  });

  const isLoading = alertsLoading || sensorsLoading || readingsLoading;

  // Computed stats
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
  const totalSensors = sensors?.length || 0;

  // Chart data: Sensor type distribution
  const sensorTypeData = useMemo(() => {
    if (!sensors?.length) return [];
    const counts: Record<string, number> = {};
    sensors.forEach((s: any) => {
      const label = sensorTypeLabel(s.sensor_type);
      counts[label] = (counts[label] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [sensors]);

  // Chart data: Device status breakdown
  const statusData = useMemo(() => {
    if (!sensors?.length) return [];
    return [
      { name: "Online", value: onlineCount, fill: "hsl(155 70% 45%)" },
      { name: "Offline", value: offlineCount, fill: "hsl(220 10% 46%)" },
      { name: "Low Battery", value: lowBatteryCount, fill: "hsl(0 84% 60%)" },
    ].filter(d => d.value > 0);
  }, [sensors, onlineCount, offlineCount, lowBatteryCount]);

  // Chart data: Alerts by type
  const alertsByType = useMemo(() => {
    if (!alerts?.length) return [];
    const counts: Record<string, { critical: number; warning: number; info: number }> = {};
    alerts.forEach((a: any) => {
      const type = a.alert_type.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
      if (!counts[type]) counts[type] = { critical: 0, warning: 0, info: 0 };
      if (a.severity === "critical") counts[type].critical++;
      else if (a.severity === "warning") counts[type].warning++;
      else counts[type].info++;
    });
    return Object.entries(counts).map(([type, data]) => ({ type, ...data }));
  }, [alerts]);

  // Chart data: Alerts over last 7 days
  const alertsTrend = useMemo(() => {
    if (!alerts?.length) return [];
    const days: Record<string, { date: string; critical: number; warning: number }> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split("T")[0];
      const label = d.toLocaleDateString("en", { weekday: "short", month: "short", day: "numeric" });
      days[key] = { date: label, critical: 0, warning: 0 };
    }
    alerts.forEach((a: any) => {
      const key = a.created_at?.split("T")[0];
      if (days[key]) {
        if (a.severity === "critical") days[key].critical++;
        else if (a.severity === "warning") days[key].warning++;
      }
    });
    return Object.values(days);
  }, [alerts]);

  // Chart data: Battery level distribution
  const batteryDistribution = useMemo(() => {
    if (!sensors?.length) return [];
    const buckets = [
      { range: "0-20%", min: 0, max: 20, count: 0, fill: "hsl(0 84% 60%)" },
      { range: "21-50%", min: 21, max: 50, count: 0, fill: "hsl(45 100% 50%)" },
      { range: "51-80%", min: 51, max: 80, count: 0, fill: "hsl(190 80% 50%)" },
      { range: "81-100%", min: 81, max: 100, count: 0, fill: "hsl(155 70% 45%)" },
    ];
    sensors.forEach((s: any) => {
      if (s.battery_level == null) return;
      const b = buckets.find(b => s.battery_level >= b.min && s.battery_level <= b.max);
      if (b) b.count++;
    });
    return buckets.map(({ range, count, fill }) => ({ range, count, fill }));
  }, [sensors]);

  // Chart data: Anomaly rate by sensor type
  const anomalyRate = useMemo(() => {
    if (!readings?.length) return [];
    const types: Record<string, { total: number; anomalies: number }> = {};
    readings.forEach((r: any) => {
      const type = sensorTypeLabel(r.vyva_user_sensors?.sensor_type || "unknown");
      if (!types[type]) types[type] = { total: 0, anomalies: 0 };
      types[type].total++;
      if (r.is_anomaly) types[type].anomalies++;
    });
    return Object.entries(types).map(([type, data]) => ({
      type,
      rate: data.total > 0 ? Math.round((data.anomalies / data.total) * 100) : 0,
      anomalies: data.anomalies,
      total: data.total,
    }));
  }, [readings]);

  // Active alerts for list
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

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-72 rounded-xl" />)}
        </div>
      </div>
    );
  }

  const hasData = totalSensors > 0 || (alerts?.length || 0) > 0;

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold text-foreground">Sensor Monitoring</h1>

      {/* Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total Devices"
          value={totalSensors}
          icon={<Activity className="h-5 w-5" />}
          gradient="bg-gradient-to-br from-vyva-purple to-primary"
          subtitle={`${onlineCount} online · ${offlineCount} offline`}
        />
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
          title="Low Battery"
          value={lowBatteryCount}
          icon={<Battery className="h-5 w-5" />}
          gradient="bg-gradient-to-br from-vyva-pink to-destructive"
          subtitle="Below 20% charge"
        />
      </div>

      {!hasData ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Activity className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
            <p className="text-lg font-medium text-foreground mb-1">No sensor data yet</p>
            <p className="text-sm text-muted-foreground">Sensor data will appear here once devices are connected via the onboarding agent.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Row: Alerts Trend + Device Status */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="md:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="font-display text-base flex items-center gap-2">
                  <Zap className="h-4 w-4 text-vyva-teal" />
                  Alerts Trend (Last 7 Days)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {alertsTrend.some(d => d.critical > 0 || d.warning > 0) ? (
                  <ResponsiveContainer width="100%" height={240}>
                    <AreaChart data={alertsTrend}>
                      <defs>
                        <linearGradient id="criticalGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(0 84% 60%)" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(0 84% 60%)" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="warningGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(45 100% 50%)" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(45 100% 50%)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} className="text-xs" />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                      <Tooltip contentStyle={{ borderRadius: "0.5rem", border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }} />
                      <Legend />
                      <Area type="monotone" dataKey="critical" stroke="hsl(0 84% 60%)" fill="url(#criticalGrad)" strokeWidth={2} name="Critical" />
                      <Area type="monotone" dataKey="warning" stroke="hsl(45 100% 50%)" fill="url(#warningGrad)" strokeWidth={2} name="Warning" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[240px] text-muted-foreground text-sm">
                    <CheckCircle className="h-5 w-5 mr-2 text-vyva-green" />
                    No alerts in the last 7 days
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="font-display text-base flex items-center gap-2">
                  <Wifi className="h-4 w-4 text-vyva-green" />
                  Device Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                {statusData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie
                        data={statusData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={80}
                        paddingAngle={4}
                        dataKey="value"
                        nameKey="name"
                      >
                        {statusData.map((entry, index) => (
                          <Cell key={index} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: "0.5rem", border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[240px] text-muted-foreground text-sm">No devices registered</div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Row: Sensor Types + Battery Distribution */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="font-display text-base">Sensors by Type</CardTitle>
              </CardHeader>
              <CardContent>
                {sensorTypeData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={sensorTypeData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={110} />
                      <Tooltip contentStyle={{ borderRadius: "0.5rem", border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }} />
                      <Bar dataKey="value" radius={[0, 6, 6, 0]} name="Devices">
                        {sensorTypeData.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[240px] text-muted-foreground text-sm">No sensor data</div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="font-display text-base flex items-center gap-2">
                  <Battery className="h-4 w-4 text-vyva-teal" />
                  Battery Level Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                {batteryDistribution.some(b => b.count > 0) ? (
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={batteryDistribution}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="range" tick={{ fontSize: 11 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                      <Tooltip contentStyle={{ borderRadius: "0.5rem", border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }} />
                      <Bar dataKey="count" radius={[6, 6, 0, 0]} name="Devices">
                        {batteryDistribution.map((entry, i) => (
                          <Cell key={i} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[240px] text-muted-foreground text-sm">No battery data available</div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Row: Alerts by Type + Anomaly Rate */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="font-display text-base">Alerts by Category</CardTitle>
              </CardHeader>
              <CardContent>
                {alertsByType.length > 0 ? (
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={alertsByType}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="type" tick={{ fontSize: 10 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                      <Tooltip contentStyle={{ borderRadius: "0.5rem", border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }} />
                      <Legend />
                      <Bar dataKey="critical" stackId="a" fill="hsl(0 84% 60%)" name="Critical" radius={[0, 0, 0, 0]} />
                      <Bar dataKey="warning" stackId="a" fill="hsl(45 100% 50%)" name="Warning" radius={[0, 0, 0, 0]} />
                      <Bar dataKey="info" stackId="a" fill="hsl(190 80% 50%)" name="Info" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[240px] text-muted-foreground text-sm">No alert data</div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="font-display text-base flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-accent" />
                  Anomaly Rate by Sensor Type
                </CardTitle>
              </CardHeader>
              <CardContent>
                {anomalyRate.length > 0 ? (
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={anomalyRate} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                      <YAxis type="category" dataKey="type" tick={{ fontSize: 11 }} width={110} />
                      <Tooltip
                        contentStyle={{ borderRadius: "0.5rem", border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }}
                        formatter={(value: number, _: string, entry: any) => [`${value}% (${entry.payload.anomalies}/${entry.payload.total})`, "Anomaly Rate"]}
                      />
                      <Bar dataKey="rate" radius={[0, 6, 6, 0]} name="Anomaly Rate">
                        {anomalyRate.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[240px] text-muted-foreground text-sm">No reading data available</div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Active Alerts List */}
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
                <div className="space-y-3 max-h-96 overflow-y-auto">
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
        </>
      )}
    </div>
  );
}

function sensorTypeLabel(type: string) {
  switch (type) {
    case "heart_rate": return "Heart Rate";
    case "blood_pressure": return "Blood Pressure";
    case "fall_detector": return "Fall Detector";
    case "activity_monitor": return "Activity Monitor";
    default: return type;
  }
}
