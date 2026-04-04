import { useState, useRef } from "react";
import { Navigate } from "react-router-dom";
import drkLogo from "@/assets/drk-logo.svg";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { LanguageSelector } from "@/components/LanguageSelector";

export default function Login() {
  const { session, signIn, resetPassword } = useAuth();
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const rateLimitUntil = useRef(0);

  if (session) return <Navigate to="/" replace />;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (Date.now() < rateLimitUntil.current) {
      toast.error(t("login.rateLimited"), { description: t("login.rateLimitDesc") });
      return;
    }
    setLoading(true);
    const { error } = await signIn(email, password);
    if (error) {
      const msg = error.message?.toLowerCase() ?? "";
      if (msg.includes("rate") || msg.includes("429")) {
        rateLimitUntil.current = Date.now() + 30_000;
        toast.error(t("login.tooManyAttempts"), { description: t("login.tooManyAttemptsDesc") });
      } else {
        toast.error(t("login.loginFailed"), { description: error.message });
      }
    }
    setLoading(false);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error(t("login.enterYourEmail"));
      return;
    }
    setLoading(true);
    const { error } = await resetPassword(email);
    if (error) {
      toast.error(t("login.resetEmailFailed"), { description: error.message });
    } else {
      toast.success(t("login.resetEmailSent"), { description: t("login.resetEmailSentDesc") });
      setShowForgot(false);
    }
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <img src={drkLogo} alt="DRK Sachsen" className="mx-auto mb-4 h-20 w-20 rounded-full shadow-lg" />
          <p className="text-muted-foreground mt-1">{t("login.subtitle")}</p>
        </div>

        <Card className="border-border/50 shadow-xl">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="font-display">
                {showForgot ? t("login.resetPassword") : t("login.signIn")}
              </CardTitle>
              <LanguageSelector />
            </div>
            <CardDescription>
              {showForgot ? t("login.enterEmail") : t("login.enterCredentials")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={showForgot ? handleForgotPassword : handleLogin} className="space-y-4">
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
              {!showForgot && (
                <div className="space-y-2">
                  <Label htmlFor="password">{t("login.password")}</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              )}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? t("login.loading") : showForgot ? t("login.sendResetLink") : t("login.signIn")}
              </Button>
            </form>
            <button
              onClick={() => setShowForgot(!showForgot)}
              className="mt-4 block w-full text-center text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              {showForgot ? t("login.backToSignIn") : t("login.forgotPassword")}
            </button>
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
