import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, User, MapPin, ShieldCheck, HeartPulse, Pill, PhoneCall, Brain, Users } from "lucide-react";

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex justify-between py-2 border-b border-border/50 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground">{value || "—"}</span>
    </div>
  );
}

export default function UserProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ["vyva-user-profile", id],
    queryFn: async () => {
      const [userRes, consentRes, healthRes, medsRes, checkinsRes, brainRes, careRes] = await Promise.all([
        supabase.from("vyva_users").select("*").eq("id", id!).single(),
        supabase.from("vyva_user_consent").select("*").eq("vyva_user_id", id!).maybeSingle(),
        supabase.from("vyva_user_health").select("*").eq("vyva_user_id", id!).maybeSingle(),
        supabase.from("vyva_user_medications").select("*").eq("vyva_user_id", id!),
        supabase.from("vyva_user_checkins").select("*").eq("vyva_user_id", id!).maybeSingle(),
        supabase.from("vyva_user_brain_coach").select("*").eq("vyva_user_id", id!).maybeSingle(),
        supabase.from("vyva_user_caregivers").select("*").eq("vyva_user_id", id!),
      ]);
      return {
        user: userRes.data,
        consent: consentRes.data,
        health: healthRes.data,
        medications: medsRes.data || [],
        checkins: checkinsRes.data,
        brainCoach: brainRes.data,
        caregivers: careRes.data || [],
      };
    },
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (!data?.user) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">User not found.</p>
        <Button variant="link" onClick={() => navigate("/users")}>Back to Users</Button>
      </div>
    );
  }

  const { user, consent, health, medications, checkins, brainCoach, caregivers } = data;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/users")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="font-display text-2xl font-bold text-foreground">
          {user.first_name} {user.last_name}
        </h1>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Personal Info */}
        <Card>
          <CardHeader className="flex flex-row items-center gap-2 pb-3">
            <User className="h-5 w-5 text-vyva-purple" />
            <CardTitle className="font-display text-base">Personal Info</CardTitle>
          </CardHeader>
          <CardContent>
            <InfoRow label="First Name" value={user.first_name} />
            <InfoRow label="Last Name" value={user.last_name} />
            <InfoRow label="Phone" value={user.phone} />
            <InfoRow label="Timezone" value={user.timezone} />
          </CardContent>
        </Card>

        {/* Address */}
        <Card>
          <CardHeader className="flex flex-row items-center gap-2 pb-3">
            <MapPin className="h-5 w-5 text-vyva-teal" />
            <CardTitle className="font-display text-base">Address</CardTitle>
          </CardHeader>
          <CardContent>
            <InfoRow label="Street" value={user.street} />
            <InfoRow label="House Number" value={user.house_number} />
            <InfoRow label="Post Code" value={user.post_code} />
            <InfoRow label="City" value={user.city} />
          </CardContent>
        </Card>

        {/* Consent */}
        <Card>
          <CardHeader className="flex flex-row items-center gap-2 pb-3">
            <ShieldCheck className="h-5 w-5 text-vyva-green" />
            <CardTitle className="font-display text-base">Consent</CardTitle>
          </CardHeader>
          <CardContent>
            <InfoRow label="Consent Given" value={consent?.consent_given ? "Yes" : "No"} />
            <InfoRow label="Caretaker Consent" value={consent?.caretaker_consent ? "Yes" : "No"} />
          </CardContent>
        </Card>

        {/* Health */}
        <Card>
          <CardHeader className="flex flex-row items-center gap-2 pb-3">
            <HeartPulse className="h-5 w-5 text-vyva-pink" />
            <CardTitle className="font-display text-base">Health & Mobility</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Health Conditions</p>
                <div className="flex flex-wrap gap-1">
                  {health?.health_conditions?.length ? (
                    health.health_conditions.map((c: string, i: number) => (
                      <Badge key={i} variant="secondary" className="text-xs">{c}</Badge>
                    ))
                  ) : (
                    <span className="text-sm text-muted-foreground">None recorded</span>
                  )}
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Mobility Needs</p>
                <div className="flex flex-wrap gap-1">
                  {health?.mobility_needs?.length ? (
                    health.mobility_needs.map((m: string, i: number) => (
                      <Badge key={i} variant="secondary" className="text-xs">{m}</Badge>
                    ))
                  ) : (
                    <span className="text-sm text-muted-foreground">None recorded</span>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Medications */}
        <Card>
          <CardHeader className="flex flex-row items-center gap-2 pb-3">
            <Pill className="h-5 w-5 text-vyva-orange" />
            <CardTitle className="font-display text-base">Medications ({medications.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {medications.length === 0 ? (
              <p className="text-sm text-muted-foreground">No medications recorded</p>
            ) : (
              <div className="space-y-3">
                {medications.map((med: any) => (
                  <div key={med.id} className="rounded-lg bg-muted/50 p-3">
                    <p className="font-medium text-sm">{med.medication_name}</p>
                    {med.purpose && <p className="text-xs text-muted-foreground">{med.purpose}</p>}
                    <div className="mt-1 flex gap-2 text-xs text-muted-foreground">
                      {med.dosage && <span>Dosage: {med.dosage}</span>}
                      {med.schedule_times?.length > 0 && <span>• {med.schedule_times.join(", ")}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Check-ins */}
        <Card>
          <CardHeader className="flex flex-row items-center gap-2 pb-3">
            <PhoneCall className="h-5 w-5 text-vyva-teal" />
            <CardTitle className="font-display text-base">Check-in Settings</CardTitle>
          </CardHeader>
          <CardContent>
            <InfoRow label="Enabled" value={checkins?.enabled ? "Yes" : "No"} />
            <InfoRow label="Frequency" value={checkins?.frequency} />
            <InfoRow label="Preferred Time" value={checkins?.preferred_time} />
          </CardContent>
        </Card>

        {/* Brain Coach */}
        <Card>
          <CardHeader className="flex flex-row items-center gap-2 pb-3">
            <Brain className="h-5 w-5 text-vyva-purple" />
            <CardTitle className="font-display text-base">Brain Coach Settings</CardTitle>
          </CardHeader>
          <CardContent>
            <InfoRow label="Enabled" value={brainCoach?.enabled ? "Yes" : "No"} />
            <InfoRow label="Frequency" value={brainCoach?.frequency} />
            <InfoRow label="Preferred Time" value={brainCoach?.preferred_time} />
          </CardContent>
        </Card>

        {/* Caregivers */}
        <Card>
          <CardHeader className="flex flex-row items-center gap-2 pb-3">
            <Users className="h-5 w-5 text-vyva-green" />
            <CardTitle className="font-display text-base">Caregivers ({caregivers.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {caregivers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No caregivers linked</p>
            ) : (
              caregivers.map((c: any) => (
                <div key={c.id}>
                  <InfoRow label="Name" value={c.caretaker_name} />
                  <InfoRow label="Phone" value={c.caretaker_phone} />
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
