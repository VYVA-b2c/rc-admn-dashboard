import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/StatCard";
import { Search, PhoneCall, CheckCircle, XCircle, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/apiClient";
import { authBypassEnabled } from "@/lib/authMode";

type FilterTab = "all" | "active" | "inactive";

interface Checkin {
  id: number;
  user_id: number;
  userName: string;
  userPhone?: string;
  type?: string;
  is_active: boolean;
  frequency_days: number;
  preferred_time?: string | null;
}

export default function CheckInMonitoring() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterTab>("all");
  const navigate = useNavigate();
  const { t } = useLanguage();

  const { data: checkins, isLoading } = useQuery({
    queryKey: ["checkin-monitoring"],
    queryFn: async (): Promise<Checkin[]> => {
      try {
        return await apiFetch<Checkin[]>("/api/v1/checkins-dashboard/checkins");
      } catch (error) {
        if (!authBypassEnabled) {
          console.warn("Check-in API unavailable:", error instanceof Error ? error.message : error);
        }
        return [];
      }
    },
    retry: false,
  });

  const stats = useMemo(() => {
    const all = checkins || [];
    return {
      total: all.length,
      active: all.filter((c) => c.is_active).length,
      inactive: all.filter((c) => !c.is_active).length,
    };
  }, [checkins]);

  function formatFrequency(days?: number) {
    if (!days) return "—";
    return `Every ${days} day${days > 1 ? "s" : ""}`;
  }

  const filtered = useMemo(() => {
    let list = checkins || [];
    if (filter === "active") list = list.filter((c) => c.is_active);
    if (filter === "inactive") list = list.filter((c) => !c.is_active);
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(
        (c) => c.userName.toLowerCase().includes(s) || c.type?.toLowerCase().includes(s) || c.userPhone?.toLowerCase().includes(s)
      );
    }
    return list;
  }, [checkins, filter, search]);

  const tabs: { key: FilterTab; label: string }[] = [
    { key: "all", label: `${t("checkin.all")} (${stats.total})` },
    { key: "active", label: `${t("checkin.active")} (${stats.active})` },
    { key: "inactive", label: `${t("checkin.inactive")} (${stats.inactive})` },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-secondary/10 p-2">
          <PhoneCall className="h-5 w-5 text-secondary" />
        </div>
        <h1 className="font-display text-2xl font-bold text-foreground">{t("checkin.title")}</h1>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard title={t("checkin.totalScheduled")} value={isLoading ? "—" : stats.total} icon={<Calendar className="h-5 w-5" />} gradient="bg-gradient-to-br from-primary to-primary/70" />
        <StatCard title={t("checkin.activeCheckins")} value={isLoading ? "—" : stats.active} icon={<CheckCircle className="h-5 w-5" />} gradient="bg-gradient-to-br from-emerald-500 to-emerald-600" />
        <StatCard title={t("checkin.inactiveCheckins")} value={isLoading ? "—" : stats.inactive} icon={<XCircle className="h-5 w-5" />} gradient="bg-gradient-to-br from-orange-500 to-orange-600" />
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1 rounded-lg border bg-muted/50 p-1">
          {tabs.map((tab) => (
            <Button key={tab.key} variant={filter === tab.key ? "default" : "ghost"} size="sm" onClick={() => setFilter(tab.key)} className="text-xs">
              {tab.label}
            </Button>
          ))}
        </div>
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder={t("checkin.searchPlaceholder")} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
      </div>

      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>{t("checkin.userName")}</TableHead>
              <TableHead>{t("checkin.phone")}</TableHead>
              <TableHead>{t("checkin.Type")}</TableHead>
              <TableHead>{t("checkin.status")}</TableHead>
              <TableHead>{t("checkin.frequency")}</TableHead>
              <TableHead>{t("checkin.preferredTime")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 6 }).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-24" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
                  {(checkins || []).length === 0 ? t("checkin.noDataYet") : t("checkin.noMatch")}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((c) => (
                <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => navigate(`/users/${c.user_id}`)}>
                  <TableCell className="font-medium">{c.userName}</TableCell>
                  <TableCell className="text-muted-foreground">{c.userPhone || "—"}</TableCell>
                  <TableCell>{c.type || "—"}</TableCell>
                  <TableCell>
                    <Badge variant={c.is_active ? "default" : "secondary"} className="text-xs">
                      {c.is_active ? t("checkin.active") : t("checkin.inactive")}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatFrequency(c.frequency_days)}</TableCell>
                  <TableCell>{c.preferred_time || "—"}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
