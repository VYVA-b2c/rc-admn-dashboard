import { useEffect, useState, useRef } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { Mail } from "lucide-react";
import drkLogo from "@/assets/drk-logo.svg";
import loginBackground from "@/assets/login-happy-elders.png";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { authBypassEnabled } from "@/lib/authMode";

function safeNextPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

export default function Login() {
  const { session, signInWithMagicLink, signInWithConsoleToken } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const magicLinkInFlight = useRef(false);
  const tokenExchangeInFlight = useRef(false);
  const consumedConsoleToken = useRef<string | null>(null);
  const nextPath = safeNextPath(searchParams.get("next"));
  const consoleToken = searchParams.get("console_token");

  useEffect(() => {
    if (!consoleToken || tokenExchangeInFlight.current || session) return;
    if (consumedConsoleToken.current === consoleToken) return;
    consumedConsoleToken.current = consoleToken;
    tokenExchangeInFlight.current = true;
    setLoading(true);

    void signInWithConsoleToken(consoleToken)
      .then(({ error, next }) => {
        if (error) {
          toast.error(t("login.magicLinkFailed"), { description: error.message });
          return;
        }
        navigate(safeNextPath(next || nextPath), { replace: true });
      })
      .finally(() => {
        tokenExchangeInFlight.current = false;
        setLoading(false);
      });
  }, [consoleToken, navigate, nextPath, session, signInWithConsoleToken, t]);

  if (session || authBypassEnabled) return <Navigate to={nextPath} replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error(t("login.enterYourEmail"));
      return;
    }

    if (magicLinkInFlight.current) return;

    magicLinkInFlight.current = true;
    setLoading(true);
    try {
      const { error, delayed } = await signInWithMagicLink(email.trim(), nextPath);
      if (error) {
        const msg = error.message?.toLowerCase() ?? "";
        if (msg.includes("rate") || msg.includes("429") || msg.includes("too many") || msg.includes("wait")) {
          toast.error(t("login.tooManyAttempts"), { description: t("login.tooManyAttemptsDesc") });
        } else {
          toast.error(t("login.magicLinkFailed"), { description: error.message });
        }
      } else if (delayed) {
        toast.error(t("login.tooManyAttempts"), { description: t("login.tooManyAttemptsDesc") });
      } else {
        toast.success(t("login.magicLinkSent"), { description: t("login.magicLinkSentDesc") });
      }
    } finally {
      magicLinkInFlight.current = false;
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 p-4">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${loginBackground})` }}
      />
      <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-br from-white/95 via-white/70 to-white/15" />
      <div aria-hidden="true" className="absolute inset-0 bg-slate-950/10" />

      <div className="relative z-10 w-full max-w-md">
        <div className="mb-8 text-center">
          <img src={drkLogo} alt="Red Cross" className="mx-auto mb-4 h-20 w-20 rounded-full shadow-lg" />
          <p className="mx-auto mt-1 max-w-xs px-2 text-sm leading-relaxed text-slate-700 sm:max-w-none sm:text-base">
            {t("login.subtitle")}
          </p>
        </div>

        <Card className="border-white/70 bg-white/90 shadow-2xl backdrop-blur-md">
          <CardHeader>
            <CardTitle className="font-display">{t("login.adminSignIn")}</CardTitle>
            <CardDescription>{t("login.enterEmailForMagicLink")}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">{t("login.adminEmail")}</Label>
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

            <p className="mt-4 text-xs text-center text-muted-foreground/70">
              {t("login.adminAccessHint")}
            </p>
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
