import { ReactNode } from "react";
import { Circle } from "lucide-react";
import { AppSidebar } from "@/components/AppSidebar";
import { LanguageSelector } from "@/components/LanguageSelector";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";

function initials(email?: string | null) {
  if (!email) return "AN";
  const name = email.split("@")[0] ?? "";
  const parts = name.split(/[._-]+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase() || "AN";
}

export function DashboardLayout({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { t } = useLanguage();

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <div className="flex min-h-screen min-w-0 flex-1 flex-col md:pl-0">
          <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-white/95 px-4 backdrop-blur md:px-6">
            <SidebarTrigger className="h-9 w-9 rounded-xl text-muted-foreground" />

            <div className="min-w-0 max-[420px]:hidden">
              <p className="text-sm font-bold text-foreground">{t("layout.product")}</p>
              <p className="hidden text-xs text-muted-foreground sm:block">{t("layout.organization")}</p>
            </div>

            <div className="ml-auto flex items-center gap-3">
              <div className="hidden items-center gap-2 rounded-full border border-border bg-white px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-sm lg:flex">
                <Circle className="h-2 w-2 fill-[hsl(142,71%,45%)] text-[hsl(142,71%,45%)]" />
                {t("layout.systemStatus")}
              </div>
              <LanguageSelector />
              <div className="flex items-center gap-2 rounded-full bg-primary/10 px-2 py-1 text-sm font-semibold text-primary max-[420px]:hidden">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
                  {initials(user?.email)}
                </span>
                <span className="hidden sm:inline">{t("layout.operatorName")}</span>
              </div>
            </div>
          </header>
          <main className="flex-1 overflow-auto px-4 py-5 md:px-6 lg:px-8">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
