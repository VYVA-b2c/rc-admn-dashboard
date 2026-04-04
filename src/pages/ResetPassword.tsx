import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

const getResetModeFromUrl = (): "invite" | "recovery" | null => {
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const searchParams = new URLSearchParams(window.location.search);
  const type = hashParams.get("type") || searchParams.get("type");
  return type === "invite" || type === "recovery" ? type : null;
};

export default function ResetPassword() {
  const { updatePassword, session, user, loading: authLoading } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"invite" | "recovery" | null>(getResetModeFromUrl);

  useEffect(() => {
    const syncMode = () => setMode(getResetModeFromUrl());
    syncMode();
    window.addEventListener("hashchange", syncMode);
    window.addEventListener("popstate", syncMode);
    return () => {
      window.removeEventListener("hashchange", syncMode);
      window.removeEventListener("popstate", syncMode);
    };
  }, []);

  const isInvite = mode === "invite" || (!mode && Boolean(user?.user_metadata?.invited_role));
  const canSetPassword = Boolean(mode || session);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) { toast.error(t("reset.passwordsMismatch")); return; }
    if (password.length < 6) { toast.error(t("reset.passwordTooShort")); return; }
    setLoading(true);
    const { error } = await updatePassword(password);
    if (error) {
      toast.error(t("reset.updateFailed"), { description: error.message });
    } else {
      toast.success(t("reset.updateSuccess"));
      navigate("/");
    }
    setLoading(false);
  };

  if (authLoading && !canSetPassword) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!canSetPassword) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground">{t("reset.invalidLink")}</p>
            <Button variant="link" onClick={() => navigate("/login")} className="mt-2">
              {t("reset.backToLogin")}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader>
          <CardTitle className="font-display">{isInvite ? t("reset.setYourPassword") : t("reset.resetPassword")}</CardTitle>
          <CardDescription>
            {isInvite ? t("reset.welcomeSet") : t("reset.enterNewPassword")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">{t("reset.newPassword")}</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">{t("reset.confirmPassword")}</Label>
              <Input id="confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? t("reset.updating") : t("reset.updatePassword")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
