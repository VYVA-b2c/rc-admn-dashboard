import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Phone } from "lucide-react";

export default function EmergencyContacts() {
  const [search, setSearch] = useState("");
  const navigate = useNavigate();

  const { data: contacts, isLoading } = useQuery({
    queryKey: ["emergency-contacts"],
    queryFn: async () => {
      const { data: caregivers, error: cErr } = await supabase
        .from("vyva_user_caregivers")
        .select("*");
      if (cErr) throw cErr;

      const userIds = [...new Set((caregivers || []).map((c) => c.vyva_user_id))];
      if (userIds.length === 0) return [];

      const { data: users, error: uErr } = await supabase
        .from("vyva_users")
        .select("id, first_name, last_name, phone, city")
        .in("id", userIds);
      if (uErr) throw uErr;

      const userMap = new Map((users || []).map((u) => [u.id, u]));

      return (caregivers || []).map((c) => {
        const user = userMap.get(c.vyva_user_id);
        return {
          ...c,
          userName: user ? `${user.first_name} ${user.last_name}` : "Unknown",
          userPhone: user?.phone ?? null,
          city: user?.city ?? null,
        };
      });
    },
  });

  const filtered = (contacts || []).filter((c) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      c.userName.toLowerCase().includes(s) ||
      c.caretaker_name?.toLowerCase().includes(s) ||
      c.caretaker_phone?.toLowerCase().includes(s) ||
      c.userPhone?.toLowerCase().includes(s)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-destructive/10 p-2">
            <Phone className="h-5 w-5 text-destructive" />
          </div>
          <h1 className="font-display text-2xl font-bold text-foreground">Emergency Contacts</h1>
        </div>
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, phone, caregiver..."
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
              <TableHead>User Name</TableHead>
              <TableHead>User Phone</TableHead>
              <TableHead>Caregiver Name</TableHead>
              <TableHead>Caregiver Phone</TableHead>
              <TableHead>City</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 5 }).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-24" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-12 text-center text-muted-foreground">
                  {contacts?.length === 0
                    ? "No emergency contacts yet. Data will appear once caregivers are added via onboarding."
                    : "No contacts match your search."}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((c) => (
                <TableRow
                  key={c.id}
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => navigate(`/users/${c.vyva_user_id}`)}
                >
                  <TableCell className="font-medium">{c.userName}</TableCell>
                  <TableCell className="text-muted-foreground">{c.userPhone || "—"}</TableCell>
                  <TableCell>{c.caretaker_name || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{c.caretaker_phone || "—"}</TableCell>
                  <TableCell>{c.city || "—"}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
