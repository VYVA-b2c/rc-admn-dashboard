import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Phone } from "lucide-react";
import { BASE_URL } from "@/lib/apiClient";

export default function EmergencyContacts() {
  const [search, setSearch] = useState("");
  const navigate = useNavigate();

  const { data: contacts, isLoading } = useQuery({
    queryKey: ["emergency-contacts"],
    queryFn: async () => {
      // Call your backend API instead of Supabase
      const res = await fetch(`${BASE_URL}/api/v1/caretaker-dashboard/caretakers`);
      if (!res.ok) throw new Error("Failed to fetch contacts");
      const data = await res.json();
      return data.caretakers; // match your backend response
    },
  });

  const filtered = (contacts || []).filter((c) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      c.user_name.toLowerCase().includes(s) ||
      c.caregiver_name?.toLowerCase().includes(s) ||
      c.caregiver_phone?.toLowerCase().includes(s) ||
      c.user_phone?.toLowerCase().includes(s)
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
              filtered.map((c, index) => (
                <TableRow
                  key={index}
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => navigate(`/users/${c.user_id || c.id || ""}`)} // backend must return user id if you want navigation
                >
                  <TableCell className="font-medium">{c.user_name}</TableCell>
                  <TableCell className="text-muted-foreground">{c.user_phone || "—"}</TableCell>
                  <TableCell>{c.caregiver_name || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{c.caregiver_phone || "—"}</TableCell>
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
