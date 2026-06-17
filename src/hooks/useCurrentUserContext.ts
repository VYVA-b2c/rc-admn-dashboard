import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/apiClient";
import { authBypassEnabled } from "@/lib/authMode";

export type OrganizationContext = {
  active?: boolean;
  country?: string | null;
  defaultLanguage?: "en" | "de" | "es";
  id: string | null;
  name?: string | null;
  slug?: string | null;
  timezone?: string | null;
};

export type CurrentUserContext = {
  email: string | null;
  fullName: string | null;
  isAdmin: boolean;
  isPlatformAdmin: boolean;
  organization: OrganizationContext | null;
  role: "admin" | "operator" | null;
  roles: Array<"admin" | "operator">;
  userId: string | null;
};

const previewUserContext: CurrentUserContext = {
  email: null,
  fullName: "Preview Admin",
  isAdmin: true,
  isPlatformAdmin: true,
  organization: {
    id: null,
    slug: "red-cross-leipzig",
    name: "Red Cross Leipzig",
    country: "Germany",
    defaultLanguage: "de",
    timezone: "Europe/Berlin",
    active: true,
  },
  role: "admin",
  roles: ["admin"],
  userId: "preview",
};

export function useCurrentUserContext() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["current-user-context", user?.id ?? "preview"],
    enabled: authBypassEnabled || Boolean(user?.id),
    retry: false,
    placeholderData: authBypassEnabled ? { user: previewUserContext } : undefined,
    queryFn: async () => {
      try {
        return await apiFetch<{ user: CurrentUserContext }>("/api/v1/me");
      } catch (error) {
        if (authBypassEnabled) return { user: previewUserContext };
        throw error;
      }
    },
  });
}
