import {
  Activity,
  AlertTriangle,
  Bell,
  Brain,
  CalendarCheck,
  Home,
  LineChart,
  LogOut,
  Megaphone,
  Pill,
  PhoneCall,
  Settings,
  UserPlus,
  Users,
} from "lucide-react";
import { useMemo, type ComponentType } from "react";
import { useLocation } from "react-router-dom";
import { NavLink } from "@/components/NavLink";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCurrentUserContext } from "@/hooks/useCurrentUserContext";
import { useGISData } from "@/hooks/useGISData";
import { authBypassEnabled } from "@/lib/authMode";
import { demoOperationalUsers, type OperationalQueueUser } from "@/lib/operationalDemoData";
import { isProjectPlatformAdminEmail } from "@/lib/projectAdmin";
import { deriveRiskQueueRows } from "@/lib/riskQueue";
import { cn } from "@/lib/utils";

type NavItem = {
  titleKey: string;
  url?: string;
  activeUrls?: string[];
  icon: ComponentType<{ className?: string }>;
  badge?: string;
};

const navGroups: { labelKey: string; items: NavItem[] }[] = [
  {
    labelKey: "sidebar.group.main",
    items: [
      { titleKey: "sidebar.today", url: "/", icon: Home },
      { titleKey: "sidebar.people", url: "/users", icon: Users },
      { titleKey: "sidebar.riskQueue", url: "/risk-queue", icon: AlertTriangle },
      { titleKey: "sidebar.alerts", url: "/alerts", activeUrls: ["/alerts", "/sensors"], icon: Bell },
    ],
  },
  {
    labelKey: "sidebar.group.followup",
    items: [
      { titleKey: "sidebar.checkins", url: "/checkin-monitoring", icon: CalendarCheck },
      { titleKey: "sidebar.medication", url: "/medication", icon: Pill },
      { titleKey: "sidebar.brainCoach", url: "/brain-coach", icon: Brain },
    ],
  },
  {
    labelKey: "sidebar.group.management",
    items: [
      { titleKey: "sidebar.campaigns", url: "/campaigns", icon: Megaphone },
      { titleKey: "sidebar.services", url: "/emergency-contacts", icon: PhoneCall },
      { titleKey: "sidebar.reports", url: "/reports", icon: LineChart },
      { titleKey: "sidebar.teamAccess", url: "/invite", icon: UserPlus },
      { titleKey: "sidebar.settings", url: "/settings", icon: Settings },
    ],
  },
];

function BrandMark({ collapsed }: { collapsed: boolean }) {
  const { t } = useLanguage();

  return (
    <div className={cn("flex items-center gap-3", collapsed && "justify-center")}>
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-white shadow-sm">
        V
      </div>
      {!collapsed && (
        <div className="min-w-0">
          <div className="text-base font-bold leading-tight text-foreground">VYVA</div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
            {t("sidebar.console")}
          </div>
        </div>
      )}
    </div>
  );
}

function SidebarItem({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const location = useLocation();
  const { t } = useLanguage();
  const Icon = item.icon;
  const activeUrls = item.activeUrls ?? (item.url ? [item.url] : []);
  const isActive = activeUrls.some((url) =>
    url === "/" ? location.pathname === "/" : location.pathname === url || location.pathname.startsWith(`${url}/`),
  );

  const baseClass =
    "flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors";
  const stateClass = isActive
    ? "bg-primary text-white shadow-sm"
    : item.url
      ? "text-muted-foreground hover:bg-primary/10 hover:text-foreground"
      : "cursor-not-allowed text-muted-foreground/45";

  const content = (
    <>
      <Icon className="h-4 w-4 shrink-0" />
      {!collapsed && <span className="truncate">{t(item.titleKey)}</span>}
      {!collapsed && item.badge && (
        <span className="ml-auto rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-bold text-white">
          {item.badge}
        </span>
      )}
    </>
  );

  if (!item.url) {
    return (
      <div className={cn(baseClass, stateClass)} aria-disabled="true">
        {content}
      </div>
    );
  }

  return (
    <SidebarMenuButton asChild>
      <NavLink to={item.url} end={item.url === "/"} className={cn(baseClass, stateClass)}>
        {content}
      </NavLink>
    </SidebarMenuButton>
  );
}

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { signOut, user } = useAuth();
  const { t } = useLanguage();
  const { data: gisData } = useGISData();
  const { data: currentContext } = useCurrentUserContext();
  const currentUser = currentContext?.user;
  const accountEmail = currentUser?.email || user?.email;
  const isProjectPlatformAdmin = isProjectPlatformAdminEmail(accountEmail);
  const isPlatformAdmin = Boolean(currentUser?.isPlatformAdmin || isProjectPlatformAdmin);
  const isAdmin = Boolean(currentUser?.isAdmin || isPlatformAdmin);
  const roleLabel = isPlatformAdmin
    ? t("settings.role.superAdmin")
    : isAdmin
      ? t("settings.role.admin")
      : t("sidebar.operator");

  const riskQueueBadge = useMemo(() => {
    const apiUsers = (gisData?.gisUsers ?? []) as OperationalQueueUser[];
    const sourceUsers = authBypassEnabled && apiUsers.length === 0 ? demoOperationalUsers : apiUsers;
    const riskQueueCount = deriveRiskQueueRows(sourceUsers).length;

    return riskQueueCount > 0 ? String(riskQueueCount) : undefined;
  }, [gisData?.gisUsers]);

  const navigationGroups = useMemo(
    () =>
      navGroups.map((group) => ({
        ...group,
        items: group.items.map((item) =>
          item.titleKey === "sidebar.riskQueue"
            ? {
                ...item,
                badge: riskQueueBadge,
              }
            : item,
        ),
      })),
    [riskQueueBadge],
  );

  return (
    <Sidebar collapsible="icon" className="border-sidebar-border bg-white text-foreground">
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <BrandMark collapsed={collapsed} />
      </SidebarHeader>

      <SidebarContent className="bg-white px-3 py-4">
        {navigationGroups.map((group) => (
          <SidebarGroup key={group.labelKey} className="p-0 pb-5">
            {!collapsed && (
              <SidebarGroupLabel className="px-2 pb-2 text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
                {t(group.labelKey)}
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu className="space-y-1">
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.titleKey}>
                    <SidebarItem item={item} collapsed={collapsed} />
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="gap-3 border-t border-sidebar-border bg-white p-3">
        {!collapsed && user && (
          <div className="rounded-xl border border-border bg-muted/60 px-3 py-2">
            <p className="truncate text-xs font-semibold text-foreground">{accountEmail}</p>
            <p className="text-[11px] text-muted-foreground">{roleLabel}</p>
          </div>
        )}
        {!authBypassEnabled && (
          <Button
            variant="ghost"
            size={collapsed ? "icon" : "sm"}
            onClick={signOut}
            className="w-full justify-start rounded-xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          >
            <LogOut className="h-4 w-4" />
            {!collapsed && <span className="ml-2">{t("sidebar.signOut")}</span>}
          </Button>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
