import { useAuth } from "@/contexts/AuthContext";
import { useCurrentUserContext } from "@/hooks/useCurrentUserContext";
import { isProjectPlatformAdminEmail } from "@/lib/projectAdmin";

export function useAdminRole() {
  const query = useCurrentUserContext();
  const { user } = useAuth();
  const currentUser = query.data?.user;
  const isProjectPlatformAdmin = isProjectPlatformAdminEmail(currentUser?.email || user?.email);
  const roles = currentUser?.roles ?? [];
  const effectiveRoles = isProjectPlatformAdmin && !roles.includes("admin") ? ["admin" as const, ...roles] : roles;
  const primaryRole = isProjectPlatformAdmin ? "admin" : currentUser?.role ?? (effectiveRoles.includes("admin") ? "admin" : effectiveRoles[0] ?? null);
  const isPlatformAdmin = Boolean(currentUser?.isPlatformAdmin || isProjectPlatformAdmin);

  return {
    ...query,
    role: primaryRole,
    roles: effectiveRoles,
    isAdmin: Boolean(currentUser?.isAdmin || isPlatformAdmin),
    isPlatformAdmin,
    organization: currentUser?.organization ?? null,
  };
}
