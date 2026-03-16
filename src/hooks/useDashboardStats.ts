import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useDashboardStats() {
  return useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const [usersRes, checkinsRes, brainCoachRes, medsRes, caregiversRes, citiesRes] = await Promise.all([
        supabase.from("vyva_users").select("id", { count: "exact", head: true }),
        supabase.from("vyva_user_checkins").select("id", { count: "exact", head: true }).eq("enabled", true),
        supabase.from("vyva_user_brain_coach").select("id", { count: "exact", head: true }).eq("enabled", true),
        supabase.from("vyva_user_medications").select("vyva_user_id"),
        supabase.from("vyva_user_caregivers").select("id", { count: "exact", head: true }),
        supabase.from("vyva_users").select("city"),
      ]);

      const uniqueMedUsers = new Set((medsRes.data || []).map((m: any) => m.vyva_user_id)).size;

      const cityMap: Record<string, number> = {};
      (citiesRes.data || []).forEach((u: any) => {
        const city = u.city || "Unknown";
        cityMap[city] = (cityMap[city] || 0) + 1;
      });
      const cityDistribution = Object.entries(cityMap)
        .map(([city, count]) => ({ city, count }))
        .sort((a, b) => b.count - a.count);

      return {
        totalUsers: usersRes.count || 0,
        checkinsEnabled: checkinsRes.count || 0,
        brainCoachEnabled: brainCoachRes.count || 0,
        medicationsConfigured: uniqueMedUsers,
        caregiversLinked: caregiversRes.count || 0,
        cityDistribution,
      };
    },
  });
}
