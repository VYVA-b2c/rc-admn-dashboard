import { useCurrentUserContext } from "@/hooks/useCurrentUserContext";
import { ACTIVE_ORGANIZATION_STORAGE_KEY } from "@/lib/apiClient";

export function useActiveOrganizationId() {
  const { data } = useCurrentUserContext();
  const contextOrganizationId = data?.user?.organization?.id;
  if (contextOrganizationId) return contextOrganizationId;

  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(ACTIVE_ORGANIZATION_STORAGE_KEY) || "";
}
