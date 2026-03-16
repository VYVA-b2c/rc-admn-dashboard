import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";

export default function InviteAdmin() {
  const [email, setEmail] = useState("");
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

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);

    try {
      const { error } = await supabase.functions.invoke("invite-admin", {
        body: { email },
      });

      if (error) throw error;
      toast.success("Invitation sent", { description: `An invite email has been sent to ${email}` });
      setEmail("");
      refetch();
    } catch (err: any) {
      toast.error("Failed to send invitation", { description: err.message });
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold text-foreground">Invite Admin</h1>

      <Card>
        <CardHeader>
          <CardTitle className="font-display flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            Send Invitation
          </CardTitle>
          <CardDescription>
            Invite a new administrator by email. They will receive a link to set their password.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleInvite} className="flex gap-3">
            <div className="flex-1">
              <Label htmlFor="invite-email" className="sr-only">Email</Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="newadmin@vyva.io"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <Button type="submit" disabled={loading}>
              {loading ? "Sending..." : "Invite"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-display">Current Admins</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {admins?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                    No admins configured yet.
                  </TableCell>
                </TableRow>
              ) : (
                admins?.map((admin: any) => (
                  <TableRow key={admin.id}>
                    <TableCell className="font-medium">
                      {admin.profiles?.full_name || "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {admin.profiles?.email || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="capitalize text-xs">
                        {admin.role}
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
