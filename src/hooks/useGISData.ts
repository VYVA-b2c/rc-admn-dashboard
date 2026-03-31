import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/apiClient";

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

interface LocationEntry {
  id: number;
  lat: number;
  lng: number;
  name: string;
  status: string;
}

export function useGISData() {
  return useQuery({
    queryKey: ["gis-data"],
    refetchInterval: 30000,
    queryFn: async () => {
      const [statsRes, locations] = await Promise.all([
        apiFetch<{
          total_users: number;
          checkins_active: number;
          active_alerts: number;
          sensors: number;
          caregivers: number;
        }>("/api/v1/dashboard/stats"),
        apiFetch<LocationEntry[]>("/api/v1/dashboard/locations"),
      ]);

      const gisUsers: GISUser[] = locations.map((loc) => {
        const nameParts = loc.name.split(" ");
        const first_name = nameParts[0] || "";
        const last_name = nameParts.slice(1).join(" ") || "";

        return {
          id: String(loc.id),
          first_name,
          last_name,
          city: null,
          phone: null,
          date_of_birth: null,
          coords: (loc.lat != null && loc.lng != null) ? [loc.lat, loc.lng] as [number, number] : null,
          activeAlerts: 0,
          criticalAlerts: 0,
          sensorCount: 0,
          offlineSensors: 0,
          checkinEnabled: false,
          healthConditions: 0,
          missedMeds7d: 0,
          riskScore: 0,
        };
      });

      return {
        totalUsers: statsRes.total_users,
        checkinsEnabled: statsRes.checkins_active,
        activeAlertCount: statsRes.active_alerts,
        criticalAlertCount: 0,
        totalSensors: statsRes.sensors,
        caregiversLinked: statsRes.caregivers,
        gisUsers,
        activeAlerts: [] as ActiveAlert[],
        cityDistribution: [] as { city: string; count: number }[],
      };
    },
  });
}