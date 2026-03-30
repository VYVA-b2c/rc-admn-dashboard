import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getCityCoords } from "@/lib/saxonyCities";

export interface GISUser {
  id: string;
  first_name: string;
  last_name: string;
  city: string | null;
  phone: string | null;
  coords: [number, number] | null;
  activeAlerts: number;
  criticalAlerts: number;
  sensorCount: number;
  checkinEnabled: boolean;
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
      const [usersRes, alertsRes, sensorsRes, checkinsRes, caregiversRes] = await Promise.all([
        supabase.from("vyva_users").select("id, first_name, last_name, city, phone"),
        supabase.from("vyva_sensor_alerts").select("*").is("resolved_at", null),
        supabase.from("vyva_user_sensors").select("id, vyva_user_id, status"),
        supabase.from("vyva_user_checkins").select("vyva_user_id, enabled"),
        supabase.from("vyva_user_caregivers").select("id", { count: "exact", head: true }),
      ]);

      const users = usersRes.data || [];
      const alerts = alertsRes.data || [];
      const sensors = sensorsRes.data || [];
      const checkins = checkinsRes.data || [];

      // Build alert counts per user
      const alertsByUser: Record<string, { total: number; critical: number }> = {};
      for (const a of alerts) {
        if (!alertsByUser[a.vyva_user_id]) alertsByUser[a.vyva_user_id] = { total: 0, critical: 0 };
        alertsByUser[a.vyva_user_id].total++;
        if (a.severity === "critical") alertsByUser[a.vyva_user_id].critical++;
      }

      // Sensor counts per user
      const sensorsByUser: Record<string, number> = {};
      for (const s of sensors) {
        sensorsByUser[s.vyva_user_id] = (sensorsByUser[s.vyva_user_id] || 0) + 1;
      }

      // Checkin status per user
      const checkinByUser: Record<string, boolean> = {};
      for (const c of checkins) {
        checkinByUser[c.vyva_user_id] = c.enabled;
      }

      const gisUsers: GISUser[] = users.map((u) => ({
        id: u.id,
        first_name: u.first_name,
        last_name: u.last_name,
        city: u.city,
        phone: u.phone,
        coords: getCityCoords(u.city),
        activeAlerts: alertsByUser[u.id]?.total || 0,
        criticalAlerts: alertsByUser[u.id]?.critical || 0,
        sensorCount: sensorsByUser[u.id] || 0,
        checkinEnabled: checkinByUser[u.id] || false,
      }));

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
          };
        })
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

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
