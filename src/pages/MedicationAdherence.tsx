import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, ChevronLeft, ChevronRight, Pill, Check, X, Clock, Calendar } from "lucide-react";
import { startOfWeek, endOfWeek, addWeeks, format, eachDayOfInterval, isAfter, isSameDay } from "date-fns";

type MedLog = {
  id: string;
  medication_id: string;
  scheduled_date: string;
  scheduled_time: string | null;
  status: string;
  reported_at: string | null;
  notes: string | null;
};

type Medication = {
  id: string;
  medication_name: string;
  dosage: string | null;
  schedule_times: string[] | null;
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  taken: { label: "Taken", color: "text-vyva-green", bg: "bg-vyva-green/15 border-vyva-green/30", icon: Check },
  missed: { label: "Missed", color: "text-destructive", bg: "bg-destructive/10 border-destructive/30", icon: X },
  pending: { label: "Unconfirmed", color: "text-accent", bg: "bg-accent/15 border-accent/30", icon: Clock },
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

  const { data: user } = useQuery({
    queryKey: ["vyva-user-name", id],
    queryFn: async () => {
      const { data } = await supabase.from("vyva_users").select("first_name, last_name").eq("id", id!).single();
      return data;
    },
    enabled: !!id,
  });

  const { data: medications = [] } = useQuery({
    queryKey: ["vyva-user-meds", id],
    queryFn: async () => {
      const { data } = await supabase.from("vyva_user_medications").select("id, medication_name, dosage, schedule_times").eq("vyva_user_id", id!);
      return (data || []) as Medication[];
    },
    enabled: !!id,
  });

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["vyva-med-logs", id, format(weekStart, "yyyy-MM-dd")],
    queryFn: async () => {
      const { data } = await supabase
        .from("vyva_medication_logs")
        .select("id, medication_id, scheduled_date, scheduled_time, status, reported_at, notes")
        .eq("vyva_user_id", id!)
        .gte("scheduled_date", format(weekStart, "yyyy-MM-dd"))
        .lte("scheduled_date", format(weekEnd, "yyyy-MM-dd"));
      return (data || []) as MedLog[];
    },
    enabled: !!id,
  });

  // Build lookup: medication_id -> date -> logs
  const logMap = useMemo(() => {
    const map: Record<string, Record<string, MedLog[]>> = {};
    logs.forEach((log) => {
      if (!map[log.medication_id]) map[log.medication_id] = {};
      if (!map[log.medication_id][log.scheduled_date]) map[log.medication_id][log.scheduled_date] = [];
      map[log.medication_id][log.scheduled_date].push(log);
    });
    return map;
  }, [logs]);

  const getStatus = (medId: string, day: Date): { status: string; logs: MedLog[] } => {
    const dateStr = format(day, "yyyy-MM-dd");
    const dayLogs = logMap[medId]?.[dateStr] || [];
    if (dayLogs.length === 0) {
      if (isAfter(day, today) && !isSameDay(day, today)) return { status: "upcoming", logs: [] };
      return { status: "upcoming", logs: [] };
    }
    if (dayLogs.some((l) => l.status === "missed")) return { status: "missed", logs: dayLogs };
    if (dayLogs.some((l) => l.status === "taken")) return { status: "taken", logs: dayLogs };
    return { status: "pending", logs: dayLogs };
  };

  // Summary counts per day
  const daySummary = useMemo(() => {
    return weekDays.map((day) => {
      let taken = 0, missed = 0, pending = 0;
      medications.forEach((med) => {
        const { status } = getStatus(med.id, day);
        if (status === "taken") taken++;
        else if (status === "missed") missed++;
        else if (status === "pending") pending++;
      });
      return { taken, missed, pending, total: medications.length };
    });
  }, [weekDays, medications, logMap]);

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
          {user && (
            <p className="text-sm text-muted-foreground">
              {user.first_name} {user.last_name}
            </p>
          )}
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
                    {weekDays.map((day) => (
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
                  {medications.map((med) => (
                    <tr key={med.id} className="border-b border-border/50 last:border-0">
                      <td className="py-3 px-4">
                        <p className="text-sm font-medium text-foreground">{med.medication_name}</p>
                        {med.dosage && <p className="text-[10px] text-muted-foreground">{med.dosage}</p>}
                      </td>
                      {weekDays.map((day) => {
                        const { status, logs: dayLogs } = getStatus(med.id, day);
                        const cfg = STATUS_CONFIG[status];
                        const Icon = cfg.icon;
                        const takenCount = dayLogs.filter((l) => l.status === "taken").length;
                        const totalScheduled = med.schedule_times?.length || 1;

                        return (
                          <td key={day.toISOString()} className="py-2 px-1 text-center">
                            <div className={`mx-auto w-full max-w-[80px] rounded-lg border p-2 ${cfg.bg}`}>
                              <Icon className={`mx-auto h-4 w-4 ${cfg.color}`} />
                              {dayLogs.length > 0 && (
                                <p className={`text-[10px] font-semibold mt-1 ${cfg.color}`}>
                                  {takenCount}/{totalScheduled}
                                </p>
                              )}
                              {dayLogs[0]?.scheduled_time && (
                                <p className="text-[9px] text-muted-foreground mt-0.5">
                                  {dayLogs[0].scheduled_time}
                                </p>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  {/* Summary row */}
                  <tr className="bg-muted/30">
                    <td className="py-3 px-4 text-xs font-semibold text-muted-foreground">Daily Summary</td>
                    {weekDays.map((day, i) => {
                      const s = daySummary[i];
                      return (
                        <td key={day.toISOString()} className="py-2 px-1 text-center">
                          <div className="flex flex-col items-center gap-0.5">
                            {s.taken > 0 && <Badge className="bg-vyva-green/20 text-vyva-green text-[9px] px-1.5">{s.taken}✓</Badge>}
                            {s.missed > 0 && <Badge className="bg-destructive/10 text-destructive text-[9px] px-1.5">{s.missed}✗</Badge>}
                            {s.pending > 0 && <Badge className="bg-accent/15 text-accent text-[9px] px-1.5">{s.pending}?</Badge>}
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
