import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft, User, MapPin, ShieldCheck, HeartPulse, Pill, PhoneCall, Brain, Users, Activity, Clock,
} from "lucide-react";

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex justify-between py-2 border-b border-border/50 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground">{value || "—"}</span>
    </div>
  );
}

function SensorTypeLabel({ type }: { type: string }) {
  const labels: Record<string, string> = {
    heart_rate: "Heart Rate",
    blood_pressure: "Blood Pressure",
    fall_detector: "Fall Detector",
    activity_monitor: "Activity Monitor",
  };
  return <>{labels[type] || type}</>;
}

export default function UserProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ["vyva-user-profile", id],
    queryFn: async () => {
      const [userRes, consentRes, healthRes, medsRes, checkinsRes, brainRes, careRes, sensorsRes, alertsRes] =
        await Promise.all([
          supabase.from("vyva_users").select("*").eq("id", id!).single(),
          supabase.from("vyva_user_consent").select("*").eq("vyva_user_id", id!).maybeSingle(),
          supabase.from("vyva_user_health").select("*").eq("vyva_user_id", id!).maybeSingle(),
          supabase.from("vyva_user_medications").select("*").eq("vyva_user_id", id!),
          supabase.from("vyva_user_checkins").select("*").eq("vyva_user_id", id!).maybeSingle(),
          supabase.from("vyva_user_brain_coach").select("*").eq("vyva_user_id", id!).maybeSingle(),
          supabase.from("vyva_user_caregivers").select("*").eq("vyva_user_id", id!),
          supabase.from("vyva_user_sensors").select("*").eq("vyva_user_id", id!),
          supabase.from("vyva_sensor_alerts").select("*, vyva_user_sensors(device_name, sensor_type)").eq("vyva_user_id", id!).order("created_at", { ascending: false }).limit(20),
        ]);
      return {
        user: userRes.data,
        consent: consentRes.data,
        health: healthRes.data,
        medications: medsRes.data || [],
        checkins: checkinsRes.data,
        brainCoach: brainRes.data,
        caregivers: careRes.data || [],
        sensors: sensorsRes.data || [],
        alerts: alertsRes.data || [],
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

  const { user, consent, health, medications, checkins, brainCoach, caregivers, sensors, alerts } = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/users")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-4">
          {user.photo_url ? (
            <img src={user.photo_url} alt="" className="h-12 w-12 rounded-full object-cover border-2 border-primary/20" />
          ) : (
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-6 w-6 text-primary" />
            </div>
          )}
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">
              {user.first_name} {user.last_name}
            </h1>
            <p className="text-sm text-muted-foreground">{user.city || "No city"} · {user.phone || "No phone"}</p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="health">Health</TabsTrigger>
          <TabsTrigger value="sensors">Sensors ({sensors.length})</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
        </TabsList>

        {/* OVERVIEW TAB */}
        <TabsContent value="overview">
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
                <InfoRow label="Date of Birth" value={user.date_of_birth} />
                <InfoRow label="Gender" value={user.gender} />
                <InfoRow label="Language" value={user.language} />
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

            {/* Emergency Notes */}
            {user.emergency_notes && (
              <Card className="md:col-span-2">
                <CardHeader className="flex flex-row items-center gap-2 pb-3">
                  <ShieldCheck className="h-5 w-5 text-destructive" />
                  <CardTitle className="font-display text-base">Emergency Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{user.emergency_notes}</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* HEALTH TAB */}
        <TabsContent value="health">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Health Conditions */}
            <Card>
              <CardHeader className="flex flex-row items-center gap-2 pb-3">
                <HeartPulse className="h-5 w-5 text-vyva-pink" />
                <CardTitle className="font-display text-base">Health & Mobility</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
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
              </CardContent>
            </Card>

            {/* Medications */}
            <Card>
              <CardHeader className="flex flex-row items-center gap-2 pb-3">
                <Pill className="h-5 w-5 text-accent" />
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
          </div>
        </TabsContent>

        {/* SENSORS TAB */}
        <TabsContent value="sensors">
          <div className="space-y-4">
            {sensors.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <Activity className="mx-auto h-10 w-10 text-muted-foreground mb-2" />
                  <p className="text-muted-foreground">No sensors assigned to this user</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {sensors.map((sensor: any) => (
                  <Card key={sensor.id}>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <p className="font-medium text-sm">{sensor.device_name || sensor.device_id}</p>
                          <p className="text-xs text-muted-foreground"><SensorTypeLabel type={sensor.sensor_type} /></p>
                        </div>
                        <Badge variant={sensor.status === "online" ? "default" : sensor.status === "alert" ? "destructive" : "secondary"}>
                          {sensor.status}
                        </Badge>
                      </div>
                      <InfoRow label="Device ID" value={sensor.device_id} />
                      <InfoRow label="Battery" value={sensor.battery_level != null ? `${sensor.battery_level}%` : null} />
                      <InfoRow label="Last Reading" value={sensor.last_reading_at ? new Date(sensor.last_reading_at).toLocaleString() : null} />
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Recent alerts for this user */}
            {alerts.length > 0 && (
              <Card>
                <CardHeader className="flex flex-row items-center gap-2 pb-3">
                  <ShieldCheck className="h-5 w-5 text-destructive" />
                  <CardTitle className="font-display text-base">Recent Alerts</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {alerts.slice(0, 10).map((alert: any) => (
                    <div key={alert.id} className="flex items-center justify-between rounded-lg border border-border/50 p-3">
                      <div className="flex items-center gap-3">
                        <Badge className={alert.severity === "critical" ? "bg-destructive text-destructive-foreground" : "bg-accent text-accent-foreground"}>
                          {alert.severity}
                        </Badge>
                        <div>
                          <p className="text-sm font-medium">{alert.alert_type.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())}</p>
                          {alert.message && <p className="text-xs text-muted-foreground">{alert.message}</p>}
                        </div>
                      </div>
                      <div className="text-right text-xs text-muted-foreground">
                        <p>{new Date(alert.created_at).toLocaleDateString()}</p>
                        {alert.resolved_at ? (
                          <Badge variant="secondary" className="text-xs">Resolved</Badge>
                        ) : (
                          <Badge variant="destructive" className="text-xs">Active</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* TIMELINE TAB */}
        <TabsContent value="timeline">
          <Card>
            <CardHeader className="flex flex-row items-center gap-2 pb-3">
              <Clock className="h-5 w-5 text-vyva-purple" />
              <CardTitle className="font-display text-base">Activity Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              {(() => {
                const events: { date: string; label: string; type: string }[] = [];

                events.push({ date: user.created_at, label: "User onboarded", type: "onboarding" });

                if (consent) {
                  events.push({ date: consent.created_at, label: "Consent recorded", type: "consent" });
                }
                if (checkins) {
                  events.push({ date: checkins.created_at, label: `Check-in ${checkins.enabled ? "enabled" : "configured"}`, type: "checkin" });
                }
                if (brainCoach) {
                  events.push({ date: brainCoach.created_at, label: `Brain coach ${brainCoach.enabled ? "enabled" : "configured"}`, type: "brain" });
                }
                medications.forEach((med: any) => {
                  events.push({ date: med.created_at, label: `Medication added: ${med.medication_name}`, type: "medication" });
                });
                sensors.forEach((s: any) => {
                  events.push({ date: s.created_at, label: `Sensor assigned: ${s.device_name || s.device_id}`, type: "sensor" });
                });
                alerts.forEach((a: any) => {
                  events.push({ date: a.created_at, label: `Alert: ${a.alert_type.replace(/_/g, " ")}`, type: a.severity === "critical" ? "critical" : "alert" });
                });

                events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

                if (events.length === 0) {
                  return <p className="text-sm text-muted-foreground text-center py-4">No activity recorded</p>;
                }

                const typeColors: Record<string, string> = {
                  onboarding: "bg-vyva-purple",
                  consent: "bg-vyva-green",
                  checkin: "bg-vyva-teal",
                  brain: "bg-primary",
                  medication: "bg-accent",
                  sensor: "bg-secondary",
                  alert: "bg-accent",
                  critical: "bg-destructive",
                };

                return (
                  <div className="space-y-0">
                    {events.map((event, i) => (
                      <div key={i} className="flex gap-4 py-3">
                        <div className="flex flex-col items-center">
                          <div className={`h-3 w-3 rounded-full ${typeColors[event.type] || "bg-muted-foreground"}`} />
                          {i < events.length - 1 && <div className="w-px flex-1 bg-border" />}
                        </div>
                        <div className="flex-1 pb-2">
                          <p className="text-sm font-medium text-foreground">{event.label}</p>
                          <p className="text-xs text-muted-foreground">{new Date(event.date).toLocaleString()}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
