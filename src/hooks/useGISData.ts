import { useQuery } from "@tanstack/react-query";

import { apiFetch } from "@/lib/apiClient";
import { authBypassEnabled } from "@/lib/authMode";

export interface GISUser {
  id: string;
  first_name: string;
  last_name: string;
  city: string | null;
  country?: string | null;
  phone: string | null;
  date_of_birth: string | null;
  coords: [number, number] | null;

  activeAlerts: number;
  criticalAlerts: number;
  sensorCount: number;
  offlineSensors: number;
  checkinEnabled: boolean;
  checkinFrequency?: string | null;
  checkinPreferredTime?: string | null;
  checkinLastStatus?: string | null;
  checkinLastReportedAt?: string | null;
  healthConditions: number;
  missedMeds7d: number;
  riskScore: number;
  careProviderCount?: number;
  primaryCaregiverName?: string | null;
  primaryProfessionalName?: string | null;
  careProviderNames?: string[];
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

export interface GISOffice {
  id: string;
  name: string;
  office_type: string | null;
  address: string | null;
  city: string | null;
  post_code: string | null;
  phone: string | null;
  coords: [number, number];
}

export interface GISFieldStaff {
  id: string;
  full_name: string;
  role: string | null;
  team: string | null;
  phone: string | null;
  status: string;
  capacity: number;
  open_cases: number;
  last_seen_at: string | null;
  coords: [number, number] | null;
}

type DashboardGISResponse = {
  totalUsers: number;
  checkinsEnabled: number;
  activeAlertCount: number;
  criticalAlertCount: number;
  totalSensors: number;
  caregiversLinked: number;
  gisUsers: GISUser[];
  activeAlerts: ActiveAlert[];
  cityDistribution: { city: string; count: number }[];
};

const emptyDashboardData: DashboardGISResponse = {
  totalUsers: 0,
  checkinsEnabled: 0,
  activeAlertCount: 0,
  criticalAlertCount: 0,
  totalSensors: 0,
  caregiversLinked: 0,
  gisUsers: [],
  activeAlerts: [],
  cityDistribution: [],
};

async function fetchDashboardGISData(): Promise<DashboardGISResponse> {
  try {
    return await apiFetch<DashboardGISResponse>("/api/v1/user-dashboard/users");
  } catch (error) {
    if (!authBypassEnabled) {
      console.warn("Dashboard API unavailable:", error instanceof Error ? error.message : error);
    }
    return emptyDashboardData;
  }
}

async function fetchOperationalOffices(): Promise<GISOffice[]> {
  try {
    return await apiFetch<GISOffice[]>("/api/v1/operational/offices");
  } catch (error) {
    if (!authBypassEnabled) console.warn("Operational offices unavailable:", error instanceof Error ? error.message : error);
    return [];
  }
}

async function fetchFieldStaff(): Promise<GISFieldStaff[]> {
  try {
    return await apiFetch<GISFieldStaff[]>("/api/v1/operational/field-staff");
  } catch (error) {
    if (!authBypassEnabled) console.warn("Field staff unavailable:", error instanceof Error ? error.message : error);
    return [];
  }
}

export function useGISData() {
  return useQuery({
    queryKey: ["gis-data"],
    refetchInterval: authBypassEnabled ? false : 30000,
    retry: false,
    queryFn: async () => {
      const [res, offices, fieldStaff] = await Promise.all([
        fetchDashboardGISData(),
        fetchOperationalOffices(),
        fetchFieldStaff(),
      ]);

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
        offices,
        fieldStaff,
        activeAlerts: res.activeAlerts || [],
        cityDistribution: res.cityDistribution || [],
      };
    },
  });
}
