import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { authBypassEnabled } from "@/lib/authMode";

type AppRole = "admin" | "operator" | "coordinator";

export function useAdminRole() {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ["admin-role", user?.id],
    enabled: Boolean(user?.id) && !authBypassEnabled,
    retry: false,
    queryFn: async (): Promise<AppRole[]> => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id);

      if (error) throw error;
      return (data ?? []).map((row) => row.role as AppRole);
    },
  });

  const roles = query.data ?? [];
  const primaryRole = roles.includes("admin") ? "admin" : roles[0] ?? null;

  return {
    ...query,
    role: primaryRole,
    roles,
    isAdmin: roles.includes("admin"),
  };
}
