import { useCallback, useMemo, useState } from "react";
import { getRiskBand } from "@/lib/riskScore";
import { useLanguage } from "@/contexts/LanguageContext";
import { Users, PhoneCall, AlertTriangle, Radio, Heart, MapPin, Search, X, Flame } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useGISData, type GISUser, type ActiveAlert } from "@/hooks/useGISData";
import { GISMap } from "@/components/dashboard/GISMap";
import { UserDetailModal } from "@/components/dashboard/UserDetailModal";
import { PriorityAlertsPanel } from "@/components/dashboard/PriorityAlertsPanel";
import { InterventionPanel } from "@/components/dashboard/InterventionPanel";
import { OperationsQueuePanel } from "@/components/dashboard/OperationsQueuePanel";

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
  const { t } = useLanguage();
  const [selectedUser, setSelectedUser] = useState<GISUser | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [interventionUser, setInterventionUser] = useState<GISUser | null>(null);
  const [interventionOpen, setInterventionOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "critical" | "warning" | "stable">("all");
  const [cityFilter, setCityFilter] = useState<string>("all");
  const [riskFilter, setRiskFilter] = useState<string>("all");
  const [heatmapMode, setHeatmapMode] = useState(false);

  const filteredUsers = useMemo(() => {
    let users = data?.gisUsers ?? [];
    const q = searchQuery.toLowerCase().trim();
    if (q) {
      users = users.filter(
        (u) =>
          `${u.first_name} ${u.last_name}`.toLowerCase().includes(q) ||
          (u.city?.toLowerCase().includes(q) ?? false),
      );
    }
    if (statusFilter === "critical") users = users.filter((u) => u.criticalAlerts > 0);
    else if (statusFilter === "warning") users = users.filter((u) => u.activeAlerts > 0 && u.criticalAlerts === 0);
    else if (statusFilter === "stable") users = users.filter((u) => u.activeAlerts === 0);
    if (cityFilter !== "all") users = users.filter((u) => u.city === cityFilter);
    if (riskFilter !== "all") {
      users = users.filter((u) => getRiskBand(u.riskScore ?? 0) === riskFilter);
    }
    return users;
  }, [data?.gisUsers, searchQuery, statusFilter, cityFilter, riskFilter]);

  const handleUserClick = useCallback((user: GISUser) => {
    setInterventionUser(user);
    setInterventionOpen(true);
  }, []);

  const handleAlertClick = useCallback((alert: ActiveAlert) => {
    const user = data?.gisUsers.find((u) => u.id === alert.vyva_user_id);
    if (user) {
      setInterventionUser(user);
      setInterventionOpen(true);
    }
  }, [data?.gisUsers]);

  const cities = useMemo(() => {
    const set = new Set<string>();
    for (const u of data?.gisUsers ?? []) {
      if (u.city) set.add(u.city);
    }
    return Array.from(set).sort();
  }, [data?.gisUsers]);


  const hasActiveFilters = searchQuery || statusFilter !== "all" || cityFilter !== "all" || riskFilter !== "all";

  const clearFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
    setCityFilter("all");
    setRiskFilter("all");
  };

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
          {t("dashboard.title")}
        </h1>
      </div>

      {/* Stat row */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        <MiniStat icon={<Users className="h-4 w-4 text-primary-foreground" />} label={t("dashboard.users")} value={data?.totalUsers ?? 0} color="bg-primary" />
        <MiniStat icon={<PhoneCall className="h-4 w-4 text-primary-foreground" />} label={t("dashboard.checkinsActive")} value={data?.checkinsEnabled ?? 0} color="bg-secondary" />
        <MiniStat icon={<AlertTriangle className="h-4 w-4 text-primary-foreground" />} label={t("dashboard.activeAlerts")} value={data?.activeAlertCount ?? 0} color="bg-destructive" />
        <MiniStat icon={<Radio className="h-4 w-4 text-primary-foreground" />} label={t("dashboard.sensors")} value={data?.totalSensors ?? 0} color="bg-accent" />
        <MiniStat icon={<Heart className="h-4 w-4 text-primary-foreground" />} label={t("dashboard.caregivers")} value={data?.caregiversLinked ?? 0} color="bg-secondary" />
      </div>

      {/* Priority Alerts + At-Risk Users */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        <PriorityAlertsPanel alerts={data?.activeAlerts ?? []} onAlertClick={handleAlertClick} />
        <OperationsQueuePanel alerts={data?.activeAlerts ?? []} users={data?.gisUsers ?? []} onUserClick={handleUserClick} />
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t("dashboard.searchPlaceholder")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("dashboard.allStatuses")}</SelectItem>
            <SelectItem value="critical">{t("dashboard.critical")}</SelectItem>
            <SelectItem value="warning">{t("dashboard.warning")}</SelectItem>
            <SelectItem value="stable">{t("dashboard.stable")}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={cityFilter} onValueChange={setCityFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="City" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("dashboard.allCities")}</SelectItem>
            {cities.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={riskFilter} onValueChange={setRiskFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Risk Level" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("dashboard.allRiskLevels")}</SelectItem>
            <SelectItem value="high">{t("dashboard.highRisk")}</SelectItem>
            <SelectItem value="moderate">{t("dashboard.moderate")}</SelectItem>
            <SelectItem value="low">{t("dashboard.low")}</SelectItem>
            <SelectItem value="stable">{t("dashboard.stableRisk")}</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant={heatmapMode ? "default" : "outline"}
          size="sm"
          onClick={() => setHeatmapMode((v) => !v)}
          className="gap-1.5"
        >
          <Flame className="h-3.5 w-3.5" />
          {t("dashboard.heatmap")}
        </Button>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground">
            <X className="mr-1 h-3.5 w-3.5" /> {t("dashboard.clear")}
          </Button>
        )}
        <span className="text-xs text-muted-foreground ml-auto">
          {filteredUsers.length} {t("dashboard.ofUsers")} {data?.totalUsers ?? 0} {t("dashboard.usersLabel")}
        </span>
      </div>

      {/* Map */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <GISMap
            users={filteredUsers}
            onUserClick={handleUserClick}
            heatmapMode={heatmapMode}
          />
        </CardContent>

      </Card>
      {/* Legend */}
      <div className="flex gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-full bg-destructive" /> {t("dashboard.critical")}
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-full bg-[hsl(24,94%,53%)]" /> {t("dashboard.warning")}
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-full bg-[hsl(142,71%,45%)]" /> {t("dashboard.stable")}
        </span>
      </div>

      {/* City Distribution */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="font-display text-base">{t("dashboard.usersByCity")}</CardTitle>
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

      <UserDetailModal user={selectedUser} open={modalOpen} onOpenChange={setModalOpen} />
      <InterventionPanel
        user={interventionUser}
        alerts={data?.activeAlerts ?? []}
        open={interventionOpen}
        onOpenChange={setInterventionOpen}
      />
    </div>
  );
}
