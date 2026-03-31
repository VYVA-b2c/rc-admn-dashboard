import { useQuery } from "@tanstack/react-query";

import { computeRiskScore } from "@/lib/riskScore";
import { apiFetch } from "@/lib/apiClient";

export interface GISUser {
  id: string;
  first_name: string;
  last_name: string;
  city: string | null;
  phone: string | null;
  date_of_birth: string | null;
  coords: [number, number] | Promise<[number, number]>;

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
      const res = await apiFetch<{
        totalUsers: number;
        checkinsEnabled: number;
        activeAlertCount: number;
        criticalAlertCount: number;
        totalSensors: number;
        caregiversLinked: number;
        gisUsers: GISUser[];
        activeAlerts: ActiveAlert[];
        cityDistribution: { city: string; count: number }[];
      }>("/api/v1/user-dashboard/users");

      const gisUsers = res.gisUsers.map((u) => ({
        ...u,
        coords: Array.isArray(u.coords) && u.coords.length === 2
          ? [Number(u.coords[0]), Number(u.coords[1])] as [number, number]
          : null,
      }));

      return {
        totalUsers: res.totalUsers,
        checkinsEnabled: res.checkinsEnabled,
        activeAlertCount: res.activeAlertCount,
        criticalAlertCount: res.criticalAlertCount,
        totalSensors: res.totalSensors,
        caregiversLinked: res.caregiversLinked,
        gisUsers,
        activeAlerts: res.activeAlerts || [],
        cityDistribution: res.cityDistribution || [],
      };
    },
  });
}