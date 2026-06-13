import { useState, useRef } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { Building2, Chrome, Mail } from "lucide-react";
import drkLogo from "@/assets/drk-logo.svg";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { LanguageSelector } from "@/components/LanguageSelector";
import { authBypassEnabled } from "@/lib/authMode";

function safeNextPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

export default function Login() {
  const { session, signInWithMagicLink, signInWithOAuth } = useAuth();
  const { t } = useLanguage();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<"google" | "azure" | null>(null);
  const rateLimitUntil = useRef(0);
  const nextPath = safeNextPath(searchParams.get("next"));

  if (session || authBypassEnabled) return <Navigate to={nextPath} replace />;

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (Date.now() < rateLimitUntil.current) {
      toast.error(t("login.rateLimited"), { description: t("login.rateLimitDesc") });
      return;
    }
    if (!email.trim()) {
      toast.error(t("login.enterYourEmail"));
      return;
    }

    setLoading(true);
    const { error } = await signInWithMagicLink(email.trim(), nextPath);
    if (error) {
      const msg = error.message?.toLowerCase() ?? "";
      if (msg.includes("rate") || msg.includes("429")) {
        rateLimitUntil.current = Date.now() + 60_000;
        toast.error(t("login.tooManyAttempts"), { description: t("login.tooManyAttemptsDesc") });
      } else {
        toast.error(t("login.magicLinkFailed"), { description: error.message });
      }
    } else {
      toast.success(t("login.magicLinkSent"), { description: t("login.magicLinkSentDesc") });
    }
    setLoading(false);
  };

  const handleOAuth = async (provider: "google" | "azure") => {
    setOauthLoading(provider);
    const { error } = await signInWithOAuth(provider, nextPath);
    if (error) {
      toast.error(t("login.oauthFailed"), { description: error.message });
      setOauthLoading(null);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <img src={drkLogo} alt="Red Cross" className="mx-auto mb-4 h-20 w-20 rounded-full shadow-lg" />
          <p className="mx-auto mt-1 max-w-xs px-2 text-sm leading-relaxed text-muted-foreground sm:max-w-none sm:text-base">
            {t("login.subtitle")}
          </p>
        </div>

        <Card className="border-border/50 shadow-xl">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="font-display">{t("login.signIn")}</CardTitle>
              <LanguageSelector />
            </div>
            <CardDescription>{t("login.enterEmailForMagicLink")}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleMagicLink} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">{t("login.email")}</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@vyva.io"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                <Mail className="mr-2 h-4 w-4" />
                {loading ? t("login.sendingMagicLink") : t("login.sendMagicLink")}
              </Button>
            </form>

            <div className="my-5 flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs font-medium text-muted-foreground">{t("login.orContinueWith")}</span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <div className="grid gap-2">
              <Button
                type="button"
                variant="outline"
                className="w-full justify-center"
                disabled={Boolean(oauthLoading)}
                onClick={() => handleOAuth("google")}
              >
                <Chrome className="mr-2 h-4 w-4" />
                {oauthLoading === "google" ? t("login.redirecting") : t("login.continueWithGoogle")}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full justify-center"
                disabled={Boolean(oauthLoading)}
                onClick={() => handleOAuth("azure")}
              >
                <Building2 className="mr-2 h-4 w-4" />
                {oauthLoading === "azure" ? t("login.redirecting") : t("login.continueWithMicrosoft")}
              </Button>
            </div>

            <p className="mt-3 text-xs text-center text-muted-foreground/60">
              {t("login.previewHint")}
            </p>
            <p className="mt-4 text-[10px] text-center text-muted-foreground/40">
              {t("common.poweredByVyva")}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
