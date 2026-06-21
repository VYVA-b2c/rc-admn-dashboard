import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/contexts/AuthContext";
import { ACTIVE_ORGANIZATION_STORAGE_KEY } from "@/lib/apiClient";
import { apiFetch } from "@/lib/apiClient";
import { authBypassEnabled } from "@/lib/authMode";
import { isProjectPlatformAdminEmail } from "@/lib/projectAdmin";

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

const previewOrganizations: OrganizationContext[] = [
  {
    id: "red-cross-zamora",
    slug: "red-cross-zamora",
    name: "Red Cross Zamora",
    country: "Spain",
    defaultLanguage: "es",
    timezone: "Europe/Madrid",
    active: true,
  },
  {
    id: "red-cross-leipzig",
    slug: "red-cross-leipzig",
    name: "Red Cross Leipzig",
    country: "Germany",
    defaultLanguage: "de",
    timezone: "Europe/Berlin",
    active: true,
  },
];

function previewOrganizationFromStorage(): OrganizationContext {
  if (typeof window === "undefined") return previewOrganizations[1];
  const activeOrganizationId = String(window.localStorage.getItem(ACTIVE_ORGANIZATION_STORAGE_KEY) || "").toLowerCase();
  if (activeOrganizationId.includes("zamora")) return previewOrganizations[0];
  return previewOrganizations[1];
}

function buildPreviewUserContext(): CurrentUserContext {
  return {
    email: null,
    fullName: "Preview Admin",
    isAdmin: true,
    isPlatformAdmin: true,
    organization: previewOrganizationFromStorage(),
    role: "admin",
    roles: ["admin"],
    userId: "preview",
  };
}

function projectPlatformAdminContext(email?: string | null, userId?: string | null): CurrentUserContext {
  return {
    email: email ?? null,
    fullName: null,
    isAdmin: true,
    isPlatformAdmin: true,
    organization: null,
    role: "admin",
    roles: ["admin"],
    userId: userId ?? null,
  };
}

function applyProjectAdminFallback(user: CurrentUserContext): CurrentUserContext {
  if (!isProjectPlatformAdminEmail(user.email)) return user;
  const roles = user.roles.includes("admin") ? user.roles : ["admin", ...user.roles];
  return {
    ...user,
    isAdmin: true,
    isPlatformAdmin: true,
    role: "admin",
    roles,
  };
}

export function useCurrentUserContext() {
  const { user } = useAuth();
  const fallbackProjectAdmin = isProjectPlatformAdminEmail(user?.email)
    ? projectPlatformAdminContext(user?.email, user?.id)
    : null;

  return useQuery({
    queryKey: ["current-user-context", user?.id ?? "preview"],
    enabled: authBypassEnabled || Boolean(user?.id),
    retry: false,
    placeholderData: authBypassEnabled
      ? { user: buildPreviewUserContext() }
      : fallbackProjectAdmin
        ? { user: fallbackProjectAdmin }
        : undefined,
    queryFn: async () => {
      try {
        const response = await apiFetch<{ user: CurrentUserContext }>("/api/v1/me");
        const responseUser = {
          ...response.user,
          email: response.user.email || user?.email || null,
          userId: response.user.userId || user?.id || null,
        };
        return { user: applyProjectAdminFallback(responseUser) };
      } catch (error) {
        if (authBypassEnabled) return { user: buildPreviewUserContext() };
        if (fallbackProjectAdmin) return { user: fallbackProjectAdmin };
        throw error;
      }
    },
  });
}
