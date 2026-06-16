import { ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Circle } from "lucide-react";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCurrentUserContext, type OrganizationContext } from "@/hooks/useCurrentUserContext";
import { ACTIVE_ORGANIZATION_STORAGE_KEY, apiFetch } from "@/lib/apiClient";

type OrganizationsResponse = {
  organizations: OrganizationContext[];
};

function nameSeed(fullName?: string | null, email?: string | null) {
  if (fullName?.trim()) return fullName.trim();
  return email?.split("@")[0]?.trim() || "";
}

function formatDisplayName(fullName?: string | null, email?: string | null) {
  if (fullName?.trim()) return fullName.trim();
  const seed = nameSeed(undefined, email);
  if (!seed) return "Account";
  return seed
    .split(/[\s._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function initials(fullName?: string | null, email?: string | null) {
  const name = nameSeed(fullName, email);
  if (!name) return "AC";
  const parts = name.split(/[\s._-]+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase() || "AC";
}

export function DashboardLayout({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const { data: currentContext } = useCurrentUserContext();
  const currentUser = currentContext?.user;
  const organizationName = currentUser?.organization?.name || t("layout.organization");
  const organizationId = currentUser?.organization?.id || "";
  const displayName = formatDisplayName(currentUser?.fullName, currentUser?.email || user?.email);
  const organizationsQuery = useQuery({
    queryKey: ["organizations", "header"],
    enabled: Boolean(currentUser?.isAdmin),
    queryFn: () => apiFetch<OrganizationsResponse>("/api/v1/organizations"),
    retry: false,
  });

  const handleOrganizationChange = async (nextOrganizationId: string) => {
    localStorage.setItem(ACTIVE_ORGANIZATION_STORAGE_KEY, nextOrganizationId);
    await queryClient.invalidateQueries();
  };

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full overflow-hidden bg-background">
        <AppSidebar />
        <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col md:pl-0">
          <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-white/95 px-4 backdrop-blur md:px-6">
            <SidebarTrigger className="h-9 w-9 rounded-xl text-muted-foreground" />

            <div className="min-w-0 max-[420px]:hidden">
              <p className="text-sm font-bold text-foreground">{t("layout.product")}</p>
              <p className="hidden truncate text-xs text-muted-foreground sm:block">{organizationName}</p>
            </div>

            <div className="ml-auto flex items-center gap-3">
              {currentUser?.isAdmin && (organizationsQuery.data?.organizations?.length ?? 0) > 1 && (
                <Select value={organizationId} onValueChange={(value) => void handleOrganizationChange(value)}>
                  <SelectTrigger
                    aria-label={t("layout.switchOrganization")}
                    className="hidden h-9 w-[210px] rounded-full border-border bg-white px-3 text-xs font-semibold shadow-sm lg:flex"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent align="end">
                    {(organizationsQuery.data?.organizations ?? []).filter((organization) => organization.id).map((organization) => (
                      <SelectItem key={organization.id || organization.slug} value={organization.id!}>
                        {organization.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <div className="hidden items-center gap-2 rounded-full border border-border bg-white px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-sm lg:flex">
                <Circle className="h-2 w-2 fill-[hsl(142,71%,45%)] text-[hsl(142,71%,45%)]" />
                {t("layout.systemStatus")}
              </div>
              <div className="flex items-center gap-2 rounded-full bg-primary/10 px-2 py-1 text-sm font-semibold text-primary max-[420px]:hidden">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
                  {initials(currentUser?.fullName, currentUser?.email || user?.email)}
                </span>
                <span className="hidden sm:inline">{displayName}</span>
              </div>
            </div>
          </header>
          <main className="min-h-0 flex-1 overflow-y-auto px-4 py-5 pb-12 md:px-6 lg:px-8">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
