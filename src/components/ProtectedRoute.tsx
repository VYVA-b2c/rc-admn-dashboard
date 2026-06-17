import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCurrentUserContext } from "@/hooks/useCurrentUserContext";
import { authBypassEnabled } from "@/lib/authMode";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, loading, signOut } = useAuth();
  const { t } = useLanguage();
  const location = useLocation();
  const currentUserQuery = useCurrentUserContext();

  if (authBypassEnabled) {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!session) {
    const next = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />;
  }

  if (currentUserQuery.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (currentUserQuery.isError || !currentUserQuery.data?.user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 text-center shadow-lg">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-lg font-bold text-destructive">
            !
          </div>
          <h1 className="text-2xl font-bold text-foreground">{t("login.accessDeniedTitle")}</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">{t("login.accessDeniedDescription")}</p>
          <Button className="mt-6 w-full" onClick={() => void signOut()}>
            {t("login.signOutAndRetry")}
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
