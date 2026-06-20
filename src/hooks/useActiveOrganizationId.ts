import { useCurrentUserContext } from "@/hooks/useCurrentUserContext";
import { ACTIVE_ORGANIZATION_STORAGE_KEY } from "@/lib/apiClient";

export function useActiveOrganizationId() {
  const { data } = useCurrentUserContext();
  const selectedOrganizationId = typeof window === "undefined"
    ? ""
    : window.localStorage.getItem(ACTIVE_ORGANIZATION_STORAGE_KEY) || "";
  if (selectedOrganizationId) return selectedOrganizationId;

  return data?.user?.organization?.id || "";
}
