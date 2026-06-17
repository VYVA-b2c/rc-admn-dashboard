import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { authBypassEnabled } from "@/lib/authMode";
import { useCurrentUserContext } from "@/hooks/useCurrentUserContext";
import { apiFetch } from "@/lib/apiClient";

type AdminUserRow = {
  id: string;
  role: string;
  status?: "active" | "pending";
  user_id?: string;
  profiles?: {
    full_name?: string | null;
    email?: string | null;
  } | null;
};

type TeamMembersResponse = {
  members: AdminUserRow[];
};

type CreateTeamMemberResponse = {
  inviteMode?: "password" | "magic_link_pending" | "magic_link_sent" | "magic_link_unavailable";
  inviteEmailSent?: boolean;
  inviteEmailError?: string | null;
  guideUrl?: string | null;
  member?: AdminUserRow | null;
};

type TeamRole = "admin" | "operator";

export default function InviteAdmin() {
  const { t } = useLanguage();
  const { data: currentContext, isLoading: loadingContext } = useCurrentUserContext();
  const currentUser = currentContext?.user;
  const organizationId = currentUser?.organization?.id;
  const hasTeamAccess = Boolean(currentUser?.isAdmin || currentUser?.isPlatformAdmin);
  const canManageTeam = Boolean(hasTeamAccess && organizationId && !authBypassEnabled);
  const formDisabled = loadingContext || !canManageTeam;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<TeamRole>("admin");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const { data: admins, isLoading: loadingAdmins, isError: adminsError, refetch } = useQuery({
    queryKey: ["admin-users", organizationId],
    queryFn: async () => {
      if (authBypassEnabled || !organizationId) return [];
      const data = await apiFetch<TeamMembersResponse>("/api/v1/team-members");
      return data.members || [];
    },
    enabled: !authBypassEnabled && Boolean(hasTeamAccess && organizationId),
    placeholderData: [],
    retry: false,
  });
  const adminRows: AdminUserRow[] = Array.isArray(admins) ? (admins as AdminUserRow[]) : [];

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (authBypassEnabled) {
      toast.info(t("invite.previewDisabled"));
      return;
    }
    if (!hasTeamAccess) {
      toast.error(t("invite.adminRequired"));
      return;
    }
    if (!organizationId) {
      toast.error(t("invite.organizationRequired"));
      return;
    }
    if (!email) return;
    if (password && password.length < 6) { toast.error(t("invite.passwordTooShort")); return; }
    setLoading(true);
    try {
      const response = await apiFetch<CreateTeamMemberResponse>("/api/v1/team-members", {
        method: "POST",
        body: JSON.stringify({ email, password: password || undefined, role }),
      });
      const inviteInstructions = [
        `Email: ${email}`,
        response.inviteEmailSent
          ? "A secure magic-link invite email was sent."
          : password
            ? `Temporary password: ${password}`
            : "Invite email was not sent. Ask the team member to request a magic link from the sign-in page.",
        response.guideUrl ? `Guide: ${response.guideUrl}` : null,
      ].filter(Boolean).join("\n");
      const toastOptions = {
        description: response.inviteEmailSent
          ? t("invite.magicLinkInviteSent")
          : response.inviteEmailError || (password ? t("invite.shareCredentials") : t("invite.magicLinkInviteUnavailable")),
        duration: 15000,
        action: {
          label: response.inviteEmailSent ? t("invite.copyInviteSummary") : t("invite.copyCredentials"),
          onClick: () => navigator.clipboard.writeText(inviteInstructions),
        },
      };
      if (response.inviteEmailSent) {
        toast.success(t("invite.userCreated"), toastOptions);
      } else {
        toast.warning(t("invite.userCreated"), toastOptions);
      }
      setEmail("");
      setPassword("");
      refetch();
    } catch (err) {
      toast.error(t("invite.createFailed"), {
        description: err instanceof Error ? err.message : undefined,
      });
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="font-display text-2xl font-bold text-foreground">{t("invite.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("invite.subtitle")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-display flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            {t("invite.createNewUser")}
          </CardTitle>
          <CardDescription>
            {authBypassEnabled ? t("invite.previewDisabled") : t("invite.description")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {formDisabled && (
            <div className="mb-4 rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800">
              {authBypassEnabled
                ? t("invite.previewDisabled")
                : loadingContext
                  ? t("invite.teamAccessLoading")
                  : !hasTeamAccess
                    ? t("invite.adminRequired")
                    : t("invite.organizationRequired")}
            </div>
          )}
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="create-email">{t("invite.email")}</Label>
                <Input
                  id="create-email"
                  type="email"
                  placeholder="user@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={formDisabled}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="create-password">{t("invite.tempPasswordOptional")}</Label>
                <div className="relative">
                  <Input
                    id="create-password"
                    type={showPassword ? "text" : "password"}
                    placeholder={t("invite.min6chars")}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    minLength={6}
                    className="pr-10"
                    disabled={formDisabled}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
                    tabIndex={-1}
                    disabled={formDisabled}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">{t("invite.passwordOptionalHelp")}</p>
              </div>
            </div>
            <div className="flex gap-3 items-end">
              <div className="w-48 space-y-1.5">
                <Label>{t("invite.role")}</Label>
                <Select value={role} onValueChange={(value) => setRole(value as TeamRole)} disabled={formDisabled}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">{t("invite.admin")}</SelectItem>
                    <SelectItem value="operator">{t("invite.operator")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" disabled={loading || formDisabled}>
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
                <TableHead>{t("invite.status")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {adminRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    {loadingAdmins ? t("invite.loadingUsers") : adminsError ? t("invite.loadFailed") : t("invite.noUsersYet")}
                  </TableCell>
                </TableRow>
              ) : (
                adminRows.map((admin) => (
                  <TableRow key={admin.id}>
                    <TableCell className="font-medium">{admin.profiles?.full_name || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{admin.profiles?.email || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="capitalize text-xs">{admin.role}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={admin.status === "pending" ? "border-amber-200 bg-amber-50 text-amber-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}
                      >
                        {admin.status === "pending" ? t("invite.status.pending") : t("invite.status.active")}
                      </Badge>
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
