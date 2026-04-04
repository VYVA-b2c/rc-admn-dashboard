import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { UserPlus, Eye, EyeOff } from "lucide-react";

export default function InviteAdmin() {
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<string>("admin");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const { data: admins, refetch } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("*, profiles(full_name, email)")
        .order("role");
      if (error) throw error;
      return data || [];
    },
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    if (password.length < 6) { toast.error(t("invite.passwordTooShort")); return; }
    setLoading(true);
    try {
      const { error } = await supabase.functions.invoke("invite-admin", {
        body: { email, password, role },
      });
      if (error) throw error;
      const creds = `Email: ${email}\nPassword: ${password}`;
      toast.success(t("invite.userCreated"), {
        description: t("invite.shareCredentials"),
        duration: 15000,
        action: {
          label: t("invite.copyCredentials"),
          onClick: () => navigator.clipboard.writeText(creds),
        },
      });
      setEmail("");
      setPassword("");
      refetch();
    } catch (err: any) {
      toast.error(t("invite.createFailed"), { description: err.message });
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold text-foreground">{t("invite.title")}</h1>

      <Card>
        <CardHeader>
          <CardTitle className="font-display flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            {t("invite.createNewUser")}
          </CardTitle>
          <CardDescription>{t("invite.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="create-email">{t("invite.email")}</Label>
                <Input id="create-email" type="email" placeholder="user@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="create-password">{t("invite.tempPassword")}</Label>
                <div className="relative">
                  <Input
                    id="create-password"
                    type={showPassword ? "text" : "password"}
                    placeholder={t("invite.min6chars")}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    minLength={6}
                    required
                    className="pr-10"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" tabIndex={-1}>
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>
            <div className="flex gap-3 items-end">
              <div className="w-48 space-y-1.5">
                <Label>{t("invite.role")}</Label>
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">{t("invite.admin")}</SelectItem>
                    <SelectItem value="operator">{t("invite.operator")}</SelectItem>
                    <SelectItem value="coordinator">{t("invite.coordinator")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" disabled={loading}>
                {loading ? t("invite.creating") : t("invite.createUser")}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-display">{t("invite.currentUsers")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("invite.name")}</TableHead>
                <TableHead>{t("invite.email")}</TableHead>
                <TableHead>{t("invite.role")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {admins?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                    {t("invite.noUsersYet")}
                  </TableCell>
                </TableRow>
              ) : (
                admins?.map((admin: any) => (
                  <TableRow key={admin.id}>
                    <TableCell className="font-medium">{admin.profiles?.full_name || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{admin.profiles?.email || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="capitalize text-xs">{admin.role}</Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
