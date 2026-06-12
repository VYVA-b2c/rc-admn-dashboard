import { useQuery } from "@tanstack/react-query";

import { apiFetch } from "@/lib/apiClient";
import { supabase } from "@/integrations/supabase/client";
import { authBypassEnabled } from "@/lib/authMode";

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
  const { data, error } = await supabase
    .from("operational_offices")
    .select("id,name,office_type,address,city,post_code,phone,latitude,longitude")
    .eq("active", true)
    .order("name");

  if (error) {
    if (!authBypassEnabled) console.warn("Operational offices unavailable:", error.message);
    return [];
  }

  return (data ?? []).map((office) => ({
    id: office.id,
    name: office.name,
    office_type: office.office_type,
    address: office.address,
    city: office.city,
    post_code: office.post_code,
    phone: office.phone,
    coords: [Number(office.latitude), Number(office.longitude)],
  }));
}

async function fetchFieldStaff(): Promise<GISFieldStaff[]> {
  const { data, error } = await supabase
    .from("field_staff")
    .select("id,full_name,role,team,phone,status,capacity,open_cases,last_known_latitude,last_known_longitude,last_seen_at")
    .eq("active", true)
    .order("full_name");

  if (error) {
    if (!authBypassEnabled) console.warn("Field staff unavailable:", error.message);
    return [];
  }

  return (data ?? []).map((staff) => ({
    id: staff.id,
    full_name: staff.full_name,
    role: staff.role,
    team: staff.team,
    phone: staff.phone,
    status: staff.status,
    capacity: staff.capacity,
    open_cases: staff.open_cases,
    last_seen_at: staff.last_seen_at,
    coords:
      staff.last_known_latitude !== null && staff.last_known_longitude !== null
        ? [Number(staff.last_known_latitude), Number(staff.last_known_longitude)]
        : null,
  }));
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
