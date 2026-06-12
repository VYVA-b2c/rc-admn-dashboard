import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Lock } from "lucide-react";
import { authBypassEnabled } from "@/lib/authMode";

export default function Settings() {
  const { user, updatePassword } = useAuth();
  const { t } = useLanguage();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (authBypassEnabled) {
      toast.info("Password changes are disabled in preview mode.");
      return;
    }
    if (newPassword !== confirmPassword) { toast.error(t("reset.passwordsMismatch")); return; }
    if (newPassword.length < 6) { toast.error(t("reset.passwordTooShort")); return; }
    setLoading(true);
    const { error } = await updatePassword(newPassword);
    if (error) {
      toast.error(t("reset.updateFailed"), { description: error.message });
    } else {
      toast.success(t("reset.updateSuccess"));
      setNewPassword("");
      setConfirmPassword("");
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">{t("settings.title")}</h1>
      <div className="grid gap-6 max-w-lg">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              {t("settings.changePassword")}
            </CardTitle>
            <CardDescription>
              {authBypassEnabled ? (
                "Password changes are disabled in preview mode."
              ) : (
                <>
                  {t("settings.signedInAs")}{" "}
                  <span className="font-medium text-foreground">{user?.email}</span>.
                </>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">{t("settings.newPassword")}</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder={t("settings.atLeast6")}
                  required
                  minLength={6}
                  disabled={authBypassEnabled}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">{t("settings.confirmNewPassword")}</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={t("settings.reenterPassword")}
                  required
                  minLength={6}
                  disabled={authBypassEnabled}
                />
              </div>
              <Button type="submit" disabled={loading || authBypassEnabled}>
                {loading ? t("settings.updating") : t("settings.updatePassword")}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
