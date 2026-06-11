import { useState, useMemo, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/apiClient";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, ChevronLeft, ChevronRight, Pill, Check, X, Clock, Calendar } from "lucide-react";
import { startOfWeek, endOfWeek, addWeeks, format, eachDayOfInterval, isSameDay, isBefore, startOfDay } from "date-fns";

type ScheduleEntry = {
  medication_name: string;
  dosage: string | null;
  time: string;
  notes: string | null;
  status: "taken" | "missed" | "unconfirmed" | "upcoming";
};

type WeeklyScheduleResponse = {
  schedule: Record<string, ScheduleEntry[]>;
};

type ScheduleStatus = ScheduleEntry["status"];

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  taken: { label: "Taken", color: "text-vyva-green", bg: "bg-vyva-green/15 border-vyva-green/30", icon: Check },
  missed: { label: "Missed", color: "text-destructive", bg: "bg-destructive/10 border-destructive/30", icon: X },
  unconfirmed: { label: "Unconfirmed", color: "text-accent", bg: "bg-accent/15 border-accent/30", icon: Clock },
  upcoming: { label: "Upcoming", color: "text-muted-foreground", bg: "bg-muted/50 border-border/50", icon: Calendar },
};

export default function MedicationAdherence() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [weekOffset, setWeekOffset] = useState(0);

  const today = new Date();
  const weekStart = startOfWeek(addWeeks(today, weekOffset), { weekStartsOn: 1 });
  const weekEnd = endOfWeek(addWeeks(today, weekOffset), { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });
  const isPresent = weekOffset === 0;
  const todayStart = startOfDay(today);

  const { data: schedule, isLoading } = useQuery({
    queryKey: ["med-weekly-schedule", id, format(weekStart, "yyyy-MM-dd"), isPresent],
    queryFn: async () => {
      return apiFetch<WeeklyScheduleResponse>("/api/v1/medications/weekly-schedule", {
        method: "POST",
        body: JSON.stringify({
          user_id: Number(id),
          date_start: format(weekStart, "yyyy-MM-dd"),
          date_end: format(weekEnd, "yyyy-MM-dd"),
          is_present: isPresent,
        }),
      });
    },
    enabled: !!id,
  });

  // Derive unique medication list from schedule
  const medications = useMemo(() => {
    if (!schedule?.schedule) return [];
    const medSet = new Map<string, { name: string; dosage: string | null }>();
    for (const entries of Object.values(schedule.schedule)) {
      for (const entry of entries) {
        const key = `${entry.medication_name}||${entry.dosage}`;
        if (!medSet.has(key)) {
          medSet.set(key, { name: entry.medication_name, dosage: entry.dosage });
        }
      }
    }
    return Array.from(medSet.values());
  }, [schedule]);

  // Build lookup: medKey -> dayName -> entries
  const entryMap = useMemo(() => {
    if (!schedule?.schedule) return {};
    const map: Record<string, Record<string, ScheduleEntry[]>> = {};
    for (const [dayName, entries] of Object.entries(schedule.schedule)) {
      for (const entry of entries) {
        const key = `${entry.medication_name}||${entry.dosage}`;
        if (!map[key]) map[key] = {};
        if (!map[key][dayName]) map[key][dayName] = [];
        map[key][dayName].push(entry);
      }
    }
    return map;
  }, [schedule]);

  const getEffectiveStatus = useCallback((status: ScheduleStatus, day: Date): ScheduleStatus => {
    if (status === "upcoming" && isBefore(startOfDay(day), todayStart)) {
      return "unconfirmed";
    }
    return status;
  }, [todayStart]);

  const getDayStatus = (medKey: string, dayName: string, day: Date): { status: ScheduleStatus; entries: ScheduleEntry[] } => {
    const entries = entryMap[medKey]?.[dayName] || [];
    if (entries.length === 0) {
      return { status: isBefore(startOfDay(day), todayStart) ? "unconfirmed" : "upcoming", entries: [] };
    }

    const statuses = entries.map((entry) => getEffectiveStatus(entry.status, day));
    if (statuses.includes("missed")) return { status: "missed", entries };
    if (statuses.includes("taken")) return { status: "taken", entries };
    if (statuses.includes("unconfirmed")) return { status: "unconfirmed", entries };
    return { status: "upcoming", entries };
  };

  // Summary counts per day
  const daySummary = useMemo(() => {
    return DAY_NAMES.map((dayName, dayIndex) => {
      let taken = 0, missed = 0, unconfirmed = 0;
      medications.forEach((med) => {
        const key = `${med.name}||${med.dosage}`;
        const entries = entryMap[key]?.[dayName] || [];
        entries.forEach((e) => {
          const status = getEffectiveStatus(e.status, weekDays[dayIndex]);
          if (status === "taken") taken++;
          else if (status === "missed") missed++;
          else if (status === "unconfirmed") unconfirmed++;
        });
      });
      return { taken, missed, unconfirmed };
    });
  }, [medications, entryMap, weekDays, getEffectiveStatus]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(`/users/${id}`)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">
            Medication Adherence
          </h1>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3">
        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
          <div key={key} className="flex items-center gap-1.5">
            <div className={`h-3 w-3 rounded-full ${cfg.bg} border`} />
            <span className="text-xs text-muted-foreground">{cfg.label}</span>
          </div>
        ))}
      </div>

      {/* Week navigation */}
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={() => setWeekOffset((o) => o - 1)}>
          <ChevronLeft className="h-4 w-4 mr-1" /> Previous
        </Button>
        <h2 className="font-display text-sm font-semibold text-foreground">
          {format(weekStart, "MMM d")} — {format(weekEnd, "MMM d, yyyy")}
        </h2>
        <Button variant="outline" size="sm" onClick={() => setWeekOffset((o) => o + 1)} disabled={weekOffset >= 0}>
          Next <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>

      {medications.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Pill className="mx-auto h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground">No medications configured for this user.</p>
            <Button variant="link" className="mt-2" onClick={() => navigate(`/users/${id}`)}>
              Go to user profile to add medications
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px]">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground w-[180px]">
                      Medication
                    </th>
                    {weekDays.map((day, i) => (
                      <th key={day.toISOString()} className={`text-center py-3 px-2 text-xs font-semibold ${isSameDay(day, today) ? "text-primary" : "text-muted-foreground"}`}>
                        <div>{format(day, "EEE")}</div>
                        <div className={`text-[11px] ${isSameDay(day, today) ? "font-bold" : "font-normal"}`}>
                          {format(day, "d")}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {medications.map((med) => {
                    const medKey = `${med.name}||${med.dosage}`;
                    return (
                      <tr key={medKey} className="border-b border-border/50 last:border-0">
                        <td className="py-3 px-4">
                          <p className="text-sm font-medium text-foreground">{med.name}</p>
                          {med.dosage && <p className="text-[10px] text-muted-foreground">{med.dosage}</p>}
                        </td>
                        {DAY_NAMES.map((dayName, dayIndex) => {
                          const day = weekDays[dayIndex];
                          const { status, entries } = getDayStatus(medKey, dayName, day);
                          const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.upcoming;
                          const Icon = cfg.icon;

                          return (
                            <td key={dayName} className="py-2 px-1 text-center">
                              {entries.length === 0 ? (
                                <div className={`mx-auto w-full max-w-[80px] rounded-lg border p-2 ${cfg.bg}`}>
                                  <Icon className={`mx-auto h-4 w-4 ${cfg.color}`} />
                                </div>
                              ) : (
                                <div className="flex flex-col gap-1 items-center">
                                  {entries.map((entry, idx) => {
                                    const entryStatus = getEffectiveStatus(entry.status, day);
                                    const eCfg = STATUS_CONFIG[entryStatus] || STATUS_CONFIG.upcoming;
                                    const EIcon = eCfg.icon;
                                    return (
                                      <div key={idx} className={`w-full max-w-[80px] rounded-lg border px-2 py-1.5 ${eCfg.bg}`}>
                                        <div className="flex items-center justify-center gap-1">
                                          <EIcon className={`h-3.5 w-3.5 ${eCfg.color}`} />
                                          {entry.time && (
                                            <span className="text-[9px] text-muted-foreground">{entry.time}</span>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                  {/* Summary row */}
                  <tr className="bg-muted/30">
                    <td className="py-3 px-4 text-xs font-semibold text-muted-foreground">Daily Summary</td>
                    {DAY_NAMES.map((dayName, i) => {
                      const s = daySummary[i];
                      return (
                        <td key={dayName} className="py-2 px-1 text-center">
                          <div className="flex flex-col items-center gap-0.5">
                            {s.taken > 0 && <Badge className="bg-vyva-green/20 text-vyva-green text-[9px] px-1.5">{s.taken}✓</Badge>}
                            {s.missed > 0 && <Badge className="bg-destructive/10 text-destructive text-[9px] px-1.5">{s.missed}✗</Badge>}
                            {s.unconfirmed > 0 && <Badge className="bg-accent/15 text-accent text-[9px] px-1.5">{s.unconfirmed}?</Badge>}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
