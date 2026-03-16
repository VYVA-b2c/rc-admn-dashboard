import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Search } from "lucide-react";

export default function UsersList() {
  const [search, setSearch] = useState("");
  const navigate = useNavigate();

  const { data: users, isLoading } = useQuery({
    queryKey: ["vyva-users-list"],
    queryFn: async () => {
      const { data: usersData, error } = await supabase
        .from("vyva_users")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch related data for badge indicators
      const userIds = (usersData || []).map((u: any) => u.id);
      const [checkinsRes, brainRes, careRes] = await Promise.all([
        supabase.from("vyva_user_checkins").select("vyva_user_id, enabled").in("vyva_user_id", userIds),
        supabase.from("vyva_user_brain_coach").select("vyva_user_id, enabled").in("vyva_user_id", userIds),
        supabase.from("vyva_user_caregivers").select("vyva_user_id, caretaker_name").in("vyva_user_id", userIds),
      ]);

      const checkinsMap = new Map((checkinsRes.data || []).map((c: any) => [c.vyva_user_id, c.enabled]));
      const brainMap = new Map((brainRes.data || []).map((b: any) => [b.vyva_user_id, b.enabled]));
      const careMap = new Map((careRes.data || []).map((c: any) => [c.vyva_user_id, c.caretaker_name]));

      return (usersData || []).map((u: any) => ({
        ...u,
        checkinsEnabled: checkinsMap.get(u.id) ?? false,
        brainCoachEnabled: brainMap.get(u.id) ?? false,
        caregiverName: careMap.get(u.id) ?? null,
      }));
    },
  });

  const filtered = (users || []).filter((u: any) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      `${u.first_name} ${u.last_name}`.toLowerCase().includes(s) ||
      u.phone?.toLowerCase().includes(s) ||
      u.city?.toLowerCase().includes(s) ||
      u.caregiverName?.toLowerCase().includes(s)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-display text-2xl font-bold text-foreground">Users</h1>
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, phone, city, caregiver..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Name</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>City</TableHead>
              <TableHead>Check-ins</TableHead>
              <TableHead>Brain Coach</TableHead>
              <TableHead>Caregiver</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 6 }).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-24" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
                  {users?.length === 0 ? "No users yet. Data will appear once the onboarding agent sends records." : "No users match your search."}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((user: any) => (
                <TableRow
                  key={user.id}
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => navigate(`/users/${user.id}`)}
                >
                  <TableCell className="font-medium">
                    {user.first_name} {user.last_name}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{user.phone || "—"}</TableCell>
                  <TableCell>{user.city || "—"}</TableCell>
                  <TableCell>
                    <Badge variant={user.checkinsEnabled ? "default" : "secondary"} className="text-xs">
                      {user.checkinsEnabled ? "Active" : "Off"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={user.brainCoachEnabled ? "default" : "secondary"} className="text-xs">
                      {user.brainCoachEnabled ? "Active" : "Off"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{user.caregiverName || "—"}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
