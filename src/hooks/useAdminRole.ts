import { useCurrentUserContext } from "@/hooks/useCurrentUserContext";

export function useAdminRole() {
  const query = useCurrentUserContext();
  const currentUser = query.data?.user;
  const roles = currentUser?.roles ?? [];
  const primaryRole = currentUser?.role ?? (roles.includes("admin") ? "admin" : roles[0] ?? null);

  return {
    ...query,
    role: primaryRole,
    roles,
    isAdmin: Boolean(currentUser?.isAdmin),
    isPlatformAdmin: Boolean(currentUser?.isPlatformAdmin),
    organization: currentUser?.organization ?? null,
  };
}
