import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { StatCard } from "@/components/StatCard";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import {
  Search, Users, HeartPulse, Pill, PhoneCall, Brain, MapPin, Activity,
  ShieldCheck, User, ChevronRight, AlertTriangle, Heart,
} from "lucide-react";
import { computeRiskScore, getRiskColor, getRiskLabel, getRiskBadgeClasses } from "@/lib/riskScore";

export default function UsersList() {
  const [search, setSearch] = useState("");
  const [cityFilter, setCityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const navigate = useNavigate();

  const { data: users, isLoading } = useQuery({
    queryKey: ["vyva-users-list-full"],
    queryFn: async () => {
      const { data: usersData, error } = await supabase
        .from("vyva_users")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;

      const userIds = (usersData || []).map((u: any) => u.id);
      if (userIds.length === 0) return [];

      const [checkinsRes, brainRes, careRes, healthRes, medsRes, sensorsRes, alertsRes] = await Promise.all([
        supabase.from("vyva_user_checkins").select("vyva_user_id, enabled").in("vyva_user_id", userIds),
        supabase.from("vyva_user_brain_coach").select("vyva_user_id, enabled").in("vyva_user_id", userIds),
        supabase.from("vyva_user_caregivers").select("vyva_user_id, caretaker_name").in("vyva_user_id", userIds),
        supabase.from("vyva_user_health").select("vyva_user_id, health_conditions, mobility_needs").in("vyva_user_id", userIds),
        supabase.from("vyva_user_medications").select("vyva_user_id, medication_name").in("vyva_user_id", userIds),
        supabase.from("vyva_user_sensors").select("vyva_user_id, status, battery_level").in("vyva_user_id", userIds),
        supabase.from("vyva_sensor_alerts").select("vyva_user_id, severity, resolved_at").in("vyva_user_id", userIds),
      ]);

      const checkinsMap = new Map((checkinsRes.data || []).map((c: any) => [c.vyva_user_id, c.enabled]));
      const brainMap = new Map((brainRes.data || []).map((b: any) => [b.vyva_user_id, b.enabled]));

      // Group caregivers
      const careMap = new Map<string, string[]>();
      (careRes.data || []).forEach((c: any) => {
        const arr = careMap.get(c.vyva_user_id) || [];
        if (c.caretaker_name) arr.push(c.caretaker_name);
        careMap.set(c.vyva_user_id, arr);
      });

      // Group health conditions
      const healthMap = new Map<string, { conditions: string[]; mobility: string[] }>();
      (healthRes.data || []).forEach((h: any) => {
        healthMap.set(h.vyva_user_id, {
          conditions: h.health_conditions || [],
          mobility: h.mobility_needs || [],
        });
      });

      // Count meds per user
      const medsCountMap = new Map<string, number>();
      (medsRes.data || []).forEach((m: any) => {
        medsCountMap.set(m.vyva_user_id, (medsCountMap.get(m.vyva_user_id) || 0) + 1);
      });

      // Sensors per user
      const sensorsMap = new Map<string, { total: number; online: number; lowBattery: number }>();
      (sensorsRes.data || []).forEach((s: any) => {
        const cur = sensorsMap.get(s.vyva_user_id) || { total: 0, online: 0, lowBattery: 0 };
        cur.total++;
        if (s.status === "online") cur.online++;
        if (s.battery_level != null && s.battery_level < 20) cur.lowBattery++;
        sensorsMap.set(s.vyva_user_id, cur);
      });

      // Active alerts per user
      const alertsMap = new Map<string, { critical: number; warning: number }>();
      (alertsRes.data || []).forEach((a: any) => {
        if (a.resolved_at) return;
        const cur = alertsMap.get(a.vyva_user_id) || { critical: 0, warning: 0 };
        if (a.severity === "critical") cur.critical++;
        else cur.warning++;
        alertsMap.set(a.vyva_user_id, cur);
      });

      return (usersData || []).map((u: any) => ({
        ...u,
        checkinsEnabled: checkinsMap.get(u.id) ?? false,
        brainCoachEnabled: brainMap.get(u.id) ?? false,
        caregiverNames: careMap.get(u.id) || [],
        health: healthMap.get(u.id) || { conditions: [], mobility: [] },
        medsCount: medsCountMap.get(u.id) || 0,
        sensors: sensorsMap.get(u.id) || { total: 0, online: 0, lowBattery: 0 },
        alerts: alertsMap.get(u.id) || { critical: 0, warning: 0 },
      }));
    },
  });

  // Derived stats
  const totalUsers = users?.length || 0;
  const withCheckins = users?.filter((u: any) => u.checkinsEnabled).length || 0;
  const withAlerts = users?.filter((u: any) => u.alerts.critical > 0 || u.alerts.warning > 0).length || 0;
  const withSensors = users?.filter((u: any) => u.sensors.total > 0).length || 0;

  // Cities for filter
  const cities = useMemo(() => {
    if (!users?.length) return [];
    const set = new Set(users.map((u: any) => u.city).filter(Boolean));
    return Array.from(set).sort() as string[];
  }, [users]);

  // Filter + search
  const filtered = useMemo(() => {
    let result = (users || []).filter((u: any) => {
      if (cityFilter !== "all" && u.city !== cityFilter) return false;
      if (statusFilter === "alerts" && u.alerts.critical === 0 && u.alerts.warning === 0) return false;
      if (statusFilter === "sensors" && u.sensors.total === 0) return false;
      if (statusFilter === "no-caregiver" && u.caregiverNames.length > 0) return false;
      if (!search) return true;
      const s = search.toLowerCase();
      return (
        `${u.first_name} ${u.last_name}`.toLowerCase().includes(s) ||
        u.phone?.toLowerCase().includes(s) ||
        u.city?.toLowerCase().includes(s) ||
        u.caregiverNames.join(" ").toLowerCase().includes(s)
      );
    });
    if (statusFilter === "highest-risk") {
      result = [...result].sort((a, b) => getUserRiskScore(b) - getUserRiskScore(a));
    }
    return result;
  }, [users, search, cityFilter, statusFilter]);

  // Risk score computation
  const getUserRiskScore = (user: any) => {
    return computeRiskScore({
      criticalAlerts: user.alerts.critical,
      activeAlerts: user.alerts.critical + user.alerts.warning,
      missedMeds7d: 0, // Would need separate query; using 0 for list view
      checkinEnabled: user.checkinsEnabled,
      offlineSensors: Math.max(user.sensors.total - user.sensors.online, 0),
      healthConditions: user.health.conditions.length,
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold text-foreground">Users</h1>

      {/* Summary Stats */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total Users"
          value={totalUsers}
          icon={<Users className="h-5 w-5" />}
          gradient="bg-gradient-to-br from-vyva-purple to-primary"
          subtitle="Onboarded via agent"
        />
        <StatCard
          title="Active Check-ins"
          value={withCheckins}
          icon={<PhoneCall className="h-5 w-5" />}
          gradient="bg-gradient-to-br from-vyva-teal to-secondary"
          subtitle="Check-ins enabled"
        />
        <StatCard
          title="Users with Alerts"
          value={withAlerts}
          icon={<AlertTriangle className="h-5 w-5" />}
          gradient="bg-gradient-to-br from-red-600 to-red-800"
          subtitle="Need attention"
        />
        <StatCard
          title="With Sensors"
          value={withSensors}
          icon={<Activity className="h-5 w-5" />}
          gradient="bg-gradient-to-br from-vyva-green to-secondary"
          subtitle="IoT devices linked"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, phone, city, caregiver..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={cityFilter} onValueChange={setCityFilter}>
          <SelectTrigger className="w-44">
            <MapPin className="h-4 w-4 mr-1 text-muted-foreground" />
            <SelectValue placeholder="All Cities" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Cities</SelectItem>
            {cities.map((city) => (
              <SelectItem key={city} value={city}>{city}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All Users" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Users</SelectItem>
            <SelectItem value="highest-risk">Sort by Highest Risk</SelectItem>
            <SelectItem value="alerts">With Active Alerts</SelectItem>
            <SelectItem value="sensors">With Sensors</SelectItem>
            <SelectItem value="no-caregiver">No Caregiver</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground ml-auto">{filtered.length} user{filtered.length !== 1 ? "s" : ""}</p>
      </div>

      {/* User Cards Grid */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Users className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
            <p className="text-lg font-medium text-foreground mb-1">
              {totalUsers === 0 ? "No users yet" : "No users match your filters"}
            </p>
            <p className="text-sm text-muted-foreground">
              {totalUsers === 0
                ? "Data will appear once the onboarding agent sends records."
                : "Try adjusting your search or filters."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((user: any) => {
            const riskScore = getUserRiskScore(user);
            return (
              <Card
                key={user.id}
                className="group cursor-pointer hover:shadow-md hover:border-primary/30 transition-all duration-200"
                onClick={() => navigate(`/users/${user.id}`)}
              >
                <CardContent className="p-5">
                  {/* Header: Avatar + Name + Risk Badge */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      {user.photo_url ? (
                        <img src={user.photo_url} alt="" className="h-11 w-11 rounded-full object-cover border-2 border-primary/10" />
                      ) : (
                        <div className="h-11 w-11 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <User className="h-5 w-5 text-primary" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="font-display font-semibold text-foreground truncate">
                          {user.first_name} {user.last_name}
                        </p>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          {user.city && (
                            <span className="flex items-center gap-0.5">
                              <MapPin className="h-3 w-3" /> {user.city}
                            </span>
                          )}
                          {user.phone && <span>· {user.phone}</span>}
                        </div>
                      </div>
                    </div>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge className={`text-xs shrink-0 border-0 ${getRiskBadgeClasses(riskScore)}`}>
                            {riskScore} · {getRiskLabel(riskScore)}
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>Based on activity, check-ins, medication adherence, and alerts</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>

                  {/* Health Indicators */}
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    <div className="rounded-lg bg-muted/50 p-2.5 text-center">
                      <HeartPulse className="h-4 w-4 mx-auto text-vyva-pink mb-1" />
                      <p className="text-xs font-medium text-foreground">{user.health.conditions.length}</p>
                      <p className="text-[10px] text-muted-foreground">Conditions</p>
                    </div>
                    <div className="rounded-lg bg-muted/50 p-2.5 text-center">
                      <Pill className="h-4 w-4 mx-auto text-accent mb-1" />
                      <p className="text-xs font-medium text-foreground">{user.medsCount}</p>
                      <p className="text-[10px] text-muted-foreground">Medications</p>
                    </div>
                    <div className="rounded-lg bg-muted/50 p-2.5 text-center">
                      <Activity className="h-4 w-4 mx-auto text-vyva-teal mb-1" />
                      <p className="text-xs font-medium text-foreground">{user.sensors.total}</p>
                      <p className="text-[10px] text-muted-foreground">Sensors</p>
                    </div>
                  </div>

                  {/* Active Alerts Banner */}
                  {(user.alerts.critical > 0 || user.alerts.warning > 0) && (
                    <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-2 mb-3">
                      <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                      <p className="text-xs text-destructive font-medium">
                        {user.alerts.critical > 0 && `${user.alerts.critical} critical`}
                        {user.alerts.critical > 0 && user.alerts.warning > 0 && ", "}
                        {user.alerts.warning > 0 && `${user.alerts.warning} warning`}
                      </p>
                    </div>
                  )}

                  {/* Services Row */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={user.checkinsEnabled ? "default" : "secondary"} className="text-[10px] gap-1">
                      <PhoneCall className="h-3 w-3" /> Check-ins {user.checkinsEnabled ? "On" : "Off"}
                    </Badge>
                    <Badge variant={user.brainCoachEnabled ? "default" : "secondary"} className="text-[10px] gap-1">
                      <Brain className="h-3 w-3" /> Brain Coach {user.brainCoachEnabled ? "On" : "Off"}
                    </Badge>
                    {user.caregiverNames.length > 0 && (
                      <Badge variant="outline" className="text-[10px] gap-1 border-vyva-green/30 text-vyva-green">
                        <Heart className="h-3 w-3" /> {user.caregiverNames.length} Caregiver{user.caregiverNames.length > 1 ? "s" : ""}
                      </Badge>
                    )}
                  </div>

                  {/* View Profile Arrow */}
                  <div className="flex items-center justify-end mt-3 text-xs text-muted-foreground group-hover:text-primary transition-colors">
                    View Profile <ChevronRight className="h-4 w-4 ml-0.5" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
