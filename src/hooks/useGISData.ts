import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getCityCoords } from "@/lib/saxonyCities";
import { computeRiskScore } from "@/lib/riskScore";

export interface GISUser {
  id: string;
  first_name: string;
  last_name: string;
  city: string | null;
  phone: string | null;
  date_of_birth: string | null;
  coords: [number, number] | null;
  activeAlerts: number;
  criticalAlerts: number;
  sensorCount: number;
  offlineSensors: number;
  checkinEnabled: boolean;
  healthConditions: number;
  missedMeds7d: number;
  riskScore: number;
}

export interface ActiveAlert {
  id: string;
  alert_type: string;
  severity: string;
  message: string | null;
  created_at: string;
  user_name: string;
  city: string | null;
  vyva_user_id: string;
  phone: string | null;
}

const SEVERITY_WEIGHT: Record<string, number> = {
  critical: 4,
  high: 3,
  warning: 3,
  medium: 2,
  low: 1,
};

export function useGISData() {
  return useQuery({
    queryKey: ["gis-data"],
    refetchInterval: 30000,
    queryFn: async () => {
      // Calculate 7 days ago for missed med logs
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const sevenDaysAgoStr = sevenDaysAgo.toISOString().split("T")[0];

      const [usersRes, alertsRes, sensorsRes, checkinsRes, caregiversRes, healthRes, medLogsRes] = await Promise.all([
        supabase.from("vyva_users").select("id, first_name, last_name, city, phone, date_of_birth"),
        supabase.from("vyva_sensor_alerts").select("*").is("resolved_at", null),
        supabase.from("vyva_user_sensors").select("id, vyva_user_id, status"),
        supabase.from("vyva_user_checkins").select("vyva_user_id, enabled"),
        supabase.from("vyva_user_caregivers").select("id", { count: "exact", head: true }),
        supabase.from("vyva_user_health").select("vyva_user_id, health_conditions"),
        supabase.from("vyva_medication_logs").select("vyva_user_id, status, scheduled_date").eq("status", "missed").gte("scheduled_date", sevenDaysAgoStr),
      ]);

      const users = usersRes.data || [];
      const alerts = alertsRes.data || [];
      const sensors = sensorsRes.data || [];
      const checkins = checkinsRes.data || [];
      const healthRows = healthRes.data || [];
      const missedLogs = medLogsRes.data || [];

      // Build alert counts per user
      const alertsByUser: Record<string, { total: number; critical: number }> = {};
      for (const a of alerts) {
        if (!alertsByUser[a.vyva_user_id]) alertsByUser[a.vyva_user_id] = { total: 0, critical: 0 };
        alertsByUser[a.vyva_user_id].total++;
        if (a.severity === "critical") alertsByUser[a.vyva_user_id].critical++;
      }

      // Sensor counts per user
      const sensorsByUser: Record<string, { total: number; offline: number }> = {};
      for (const s of sensors) {
        if (!sensorsByUser[s.vyva_user_id]) sensorsByUser[s.vyva_user_id] = { total: 0, offline: 0 };
        sensorsByUser[s.vyva_user_id].total++;
        if (s.status !== "online") sensorsByUser[s.vyva_user_id].offline++;
      }

      // Checkin status per user
      const checkinByUser: Record<string, boolean> = {};
      for (const c of checkins) {
        checkinByUser[c.vyva_user_id] = c.enabled;
      }

      // Health conditions count per user
      const healthByUser: Record<string, number> = {};
      for (const h of healthRows) {
        healthByUser[h.vyva_user_id] = (h.health_conditions as string[] | null)?.length || 0;
      }

      // Missed med logs count per user (last 7 days)
      const missedMedsByUser: Record<string, number> = {};
      for (const m of missedLogs) {
        missedMedsByUser[m.vyva_user_id] = (missedMedsByUser[m.vyva_user_id] || 0) + 1;
      }

      const gisUsers: GISUser[] = users.map((u) => {
        const criticalAlerts = alertsByUser[u.id]?.critical || 0;
        const activeAlerts = alertsByUser[u.id]?.total || 0;
        const offlineSensors = sensorsByUser[u.id]?.offline || 0;
        const checkinEnabled = checkinByUser[u.id] || false;
        const healthConditions = healthByUser[u.id] || 0;
        const missedMeds7d = missedMedsByUser[u.id] || 0;

        const riskScore = computeRiskScore({
          criticalAlerts,
          activeAlerts,
          missedMeds7d,
          checkinEnabled,
          offlineSensors,
          healthConditions,
        });

        return {
          id: u.id,
          first_name: u.first_name,
          last_name: u.last_name,
          city: u.city,
          phone: u.phone,
          date_of_birth: u.date_of_birth,
          coords: getCityCoords(u.city),
          activeAlerts,
          criticalAlerts,
          sensorCount: sensorsByUser[u.id]?.total || 0,
          offlineSensors,
          checkinEnabled,
          healthConditions,
          missedMeds7d,
          riskScore,
        };
      });

      // City distribution
      const cityMap: Record<string, number> = {};
      for (const u of users) {
        const city = u.city || "Unknown";
        cityMap[city] = (cityMap[city] || 0) + 1;
      }
      const cityDistribution = Object.entries(cityMap)
        .map(([city, count]) => ({ city, count }))
        .sort((a, b) => b.count - a.count);

      // Active alerts with user names
      const userMap = Object.fromEntries(users.map((u) => [u.id, u]));
      const activeAlerts: ActiveAlert[] = alerts
        .map((a) => {
          const u = userMap[a.vyva_user_id];
          return {
            id: a.id,
            alert_type: a.alert_type,
            severity: a.severity,
            message: a.message,
            created_at: a.created_at,
            user_name: u ? `${u.first_name} ${u.last_name}` : "Unknown",
            city: u?.city || null,
            vyva_user_id: a.vyva_user_id,
            phone: u?.phone || null,
          };
        })
        .sort((a, b) => {
          const wa = SEVERITY_WEIGHT[a.severity] || 1;
          const wb = SEVERITY_WEIGHT[b.severity] || 1;
          if (wb !== wa) return wb - wa;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });

      return {
        totalUsers: users.length,
        checkinsEnabled: checkins.filter((c) => c.enabled).length,
        activeAlertCount: alerts.length,
        criticalAlertCount: alerts.filter((a) => a.severity === "critical").length,
        totalSensors: sensors.length,
        caregiversLinked: caregiversRes.count || 0,
        gisUsers,
        activeAlerts,
        cityDistribution,
      };
    },
  });
}
