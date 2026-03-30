import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft, User, MapPin, ShieldCheck, HeartPulse, Pill, PhoneCall, Brain, Users, Activity, Clock,
  Calendar, Globe, Phone, AlertTriangle, Battery, Wifi, WifiOff, Zap, Pencil, Plus, Trash2,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend,
} from "recharts";
import { toast } from "@/hooks/use-toast";
import { EditUserDialog } from "@/components/user/EditUserDialog";
import { EditMedicationDialog } from "@/components/user/EditMedicationDialog";
import { EditCaregiverDialog } from "@/components/user/EditCaregiverDialog";
import { EditServiceDialog } from "@/components/user/EditServiceDialog";
import { EditHealthDialog } from "@/components/user/EditHealthDialog";

function InfoRow({ label, value, icon }: { label: string; value: string | null | undefined; icon?: React.ReactNode }) {
  return (
    <div className="flex justify-between items-center py-2.5 border-b border-border/50 last:border-0">
      <span className="flex items-center gap-2 text-sm text-muted-foreground">
        {icon}
        {label}
      </span>
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

const CHART_COLORS = [
  "hsl(252 85% 60%)",
  "hsl(190 80% 50%)",
  "hsl(45 100% 50%)",
  "hsl(340 82% 62%)",
  "hsl(155 70% 45%)",
  "hsl(0 84% 60%)",
];

export default function UserProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Dialog states
  const [editUserOpen, setEditUserOpen] = useState(false);
  const [editHealthOpen, setEditHealthOpen] = useState(false);
  const [editMedOpen, setEditMedOpen] = useState(false);
  const [editMedTarget, setEditMedTarget] = useState<any>(null);
  const [editCaregiverOpen, setEditCaregiverOpen] = useState(false);
  const [editCaregiverTarget, setEditCaregiverTarget] = useState<any>(null);
  const [editCheckinOpen, setEditCheckinOpen] = useState(false);
  const [editBrainOpen, setEditBrainOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["vyva-user-profile", id],
    queryFn: async () => {
      const [userRes, consentRes, healthRes, medsRes, checkinsRes, brainRes, careRes, sensorsRes, alertsRes, readingsRes] =
        await Promise.all([
          supabase.from("vyva_users").select("*").eq("id", id!).single(),
          supabase.from("vyva_user_consent").select("*").eq("vyva_user_id", id!).maybeSingle(),
          supabase.from("vyva_user_health").select("*").eq("vyva_user_id", id!).maybeSingle(),
          supabase.from("vyva_user_medications").select("*").eq("vyva_user_id", id!),
          supabase.from("vyva_user_checkins").select("*").eq("vyva_user_id", id!).maybeSingle(),
          supabase.from("vyva_user_brain_coach").select("*").eq("vyva_user_id", id!).maybeSingle(),
          supabase.from("vyva_user_caregivers").select("*").eq("vyva_user_id", id!),
          supabase.from("vyva_user_sensors").select("*").eq("vyva_user_id", id!),
          supabase.from("vyva_sensor_alerts").select("*, vyva_user_sensors(device_name, sensor_type)").eq("vyva_user_id", id!).order("created_at", { ascending: false }).limit(50),
          supabase.from("vyva_sensor_readings").select("*, vyva_user_sensors!inner(sensor_type, vyva_user_id)").eq("vyva_user_sensors.vyva_user_id", id!).order("recorded_at", { ascending: false }).limit(200),
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
        readings: readingsRes.data || [],
      };
    },
    enabled: !!id,
  });

  const handleDeleteMedication = async (medId: string) => {
    const { error } = await supabase.from("vyva_user_medications").delete().eq("id", medId);
    if (error) {
      toast({ title: "Error deleting", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Medication deleted" });
      queryClient.invalidateQueries({ queryKey: ["vyva-user-profile", id] });
    }
  };

  const handleDeleteCaregiver = async (caregiverId: string) => {
    const { error } = await supabase.from("vyva_user_caregivers").delete().eq("id", caregiverId);
    if (error) {
      toast({ title: "Error deleting", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Caregiver removed" });
      queryClient.invalidateQueries({ queryKey: ["vyva-user-profile", id] });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 rounded-xl" />
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

  const { user, consent, health, medications, checkins, brainCoach, caregivers, sensors, alerts, readings } = data;

  // Compute health score (simple heuristic)
  const activeAlerts = alerts.filter((a: any) => !a.resolved_at);
  const criticalAlerts = activeAlerts.filter((a: any) => a.severity === "critical").length;
  const warningAlerts = activeAlerts.filter((a: any) => a.severity === "warning").length;
  const conditionsCount = health?.health_conditions?.length || 0;

  let healthScore = 100;
  healthScore -= criticalAlerts * 20;
  healthScore -= warningAlerts * 10;
  healthScore -= conditionsCount * 5;
  healthScore -= (health?.mobility_needs?.length || 0) * 5;
  healthScore = Math.max(0, Math.min(100, healthScore));

  const healthScoreColor = healthScore >= 80 ? "text-vyva-green" : healthScore >= 50 ? "text-accent" : "text-destructive";
  const healthScoreLabel = healthScore >= 80 ? "Good" : healthScore >= 50 ? "Moderate" : "At Risk";

  // Compute age
  const age = user.date_of_birth
    ? Math.floor((Date.now() - new Date(user.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    : null;

  // Alerts by severity for pie chart
  const alertSeverityData = [
    { name: "Critical", value: alerts.filter((a: any) => a.severity === "critical").length, fill: "hsl(0 84% 60%)" },
    { name: "Warning", value: alerts.filter((a: any) => a.severity === "warning").length, fill: "hsl(45 100% 50%)" },
    { name: "Info", value: alerts.filter((a: any) => a.severity === "info").length, fill: "hsl(190 80% 50%)" },
  ].filter(d => d.value > 0);

  // Alerts trend for this user (last 7 days)
  const alertsTrend = (() => {
    const days: Record<string, { date: string; count: number }> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split("T")[0];
      days[key] = { date: d.toLocaleDateString("en", { weekday: "short" }), count: 0 };
    }
    alerts.forEach((a: any) => {
      const key = a.created_at?.split("T")[0];
      if (days[key]) days[key].count++;
    });
    return Object.values(days);
  })();

  // Onboarded days ago
  const daysOnboarded = Math.floor((Date.now() - new Date(user.created_at).getTime()) / (24 * 60 * 60 * 1000));

  // Services completion
  const services = [
    { name: "Check-ins", active: checkins?.enabled, icon: PhoneCall },
    { name: "Brain Coach", active: brainCoach?.enabled, icon: Brain },
    { name: "Medications", active: medications.length > 0, icon: Pill },
    { name: "Caregivers", active: caregivers.length > 0, icon: Users },
    { name: "Sensors", active: sensors.length > 0, icon: Activity },
    { name: "Consent", active: consent?.consent_given, icon: ShieldCheck },
  ];
  const servicesActive = services.filter(s => s.active).length;
  const servicesPercent = Math.round((servicesActive / services.length) * 100);

  const EditBtn = ({ onClick }: { onClick: () => void }) => (
    <Button variant="ghost" size="icon" className="h-7 w-7 ml-auto" onClick={onClick}>
      <Pencil className="h-3.5 w-3.5" />
    </Button>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/users")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-4 flex-1">
          {user.photo_url ? (
            <img src={user.photo_url} alt="" className="h-14 w-14 rounded-full object-cover border-2 border-primary/20" />
          ) : (
            <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-7 w-7 text-primary" />
            </div>
          )}
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="font-display text-2xl font-bold text-foreground">
                {user.first_name} {user.last_name}
              </h1>
              {activeAlerts.length > 0 && (
                <Badge className="bg-destructive text-destructive-foreground text-xs gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {activeAlerts.length} Active Alert{activeAlerts.length > 1 ? "s" : ""}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-3 text-sm text-muted-foreground mt-0.5">
              {user.city && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {user.city}</span>}
              {user.phone && <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" /> {user.phone}</span>}
              {age && <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> {age} years old</span>}
              {user.language && <span className="flex items-center gap-1"><Globe className="h-3.5 w-3.5" /> {user.language.toUpperCase()}</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats Banner */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-5 pb-4 text-center">
            <p className={`text-4xl font-display font-bold ${healthScoreColor}`}>{healthScore}</p>
            <p className="text-xs text-muted-foreground mt-1">Health Score</p>
            <Badge className={`mt-2 text-xs ${healthScore >= 80 ? "bg-vyva-green/20 text-vyva-green" : healthScore >= 50 ? "bg-accent/20 text-accent" : "bg-destructive/10 text-destructive"}`}>
              {healthScoreLabel}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-foreground">Services Active</p>
              <p className="text-sm font-bold text-primary">{servicesActive}/{services.length}</p>
            </div>
            <Progress value={servicesPercent} className="h-2 mb-3" />
            <div className="flex flex-wrap gap-1.5">
              {services.map(s => (
                <Badge key={s.name} variant={s.active ? "default" : "secondary"} className="text-[10px] gap-1">
                  <s.icon className="h-2.5 w-2.5" />
                  {s.name}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5 pb-4 text-center">
            <div className="flex justify-center gap-4">
              <div>
                <p className="text-2xl font-display font-bold text-foreground">{sensors.length}</p>
                <p className="text-[10px] text-muted-foreground">Devices</p>
              </div>
              <div>
                <p className="text-2xl font-display font-bold text-vyva-green">{sensors.filter((s: any) => s.status === "online").length}</p>
                <p className="text-[10px] text-muted-foreground">Online</p>
              </div>
              <div>
                <p className="text-2xl font-display font-bold text-destructive">{sensors.filter((s: any) => s.battery_level != null && s.battery_level < 20).length}</p>
                <p className="text-[10px] text-muted-foreground">Low Bat</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">Sensor Overview</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5 pb-4 text-center">
            <p className="text-2xl font-display font-bold text-foreground">{daysOnboarded}</p>
            <p className="text-xs text-muted-foreground mt-1">Days Since Onboarding</p>
            <p className="text-[10px] text-muted-foreground mt-1">{new Date(user.created_at).toLocaleDateString()}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="health">Health & Meds</TabsTrigger>
          <TabsTrigger value="sensors">Sensors ({sensors.length})</TabsTrigger>
          <TabsTrigger value="alerts">Alerts ({alerts.length})</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
        </TabsList>

        {/* OVERVIEW TAB */}
        <TabsContent value="overview">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="flex flex-row items-center gap-2 pb-3">
                <User className="h-5 w-5 text-vyva-purple" />
                <CardTitle className="font-display text-base">Personal Info</CardTitle>
                <EditBtn onClick={() => setEditUserOpen(true)} />
              </CardHeader>
              <CardContent>
                <InfoRow label="First Name" value={user.first_name} />
                <InfoRow label="Last Name" value={user.last_name} />
                <InfoRow label="Phone" value={user.phone} icon={<Phone className="h-3.5 w-3.5" />} />
                <InfoRow label="Date of Birth" value={user.date_of_birth ? `${user.date_of_birth} (${age} yrs)` : null} icon={<Calendar className="h-3.5 w-3.5" />} />
                <InfoRow label="Gender" value={user.gender} />
                <InfoRow label="Language" value={user.language?.toUpperCase()} icon={<Globe className="h-3.5 w-3.5" />} />
                <InfoRow label="Timezone" value={user.timezone} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center gap-2 pb-3">
                <MapPin className="h-5 w-5 text-vyva-teal" />
                <CardTitle className="font-display text-base">Address</CardTitle>
                <EditBtn onClick={() => setEditUserOpen(true)} />
              </CardHeader>
              <CardContent>
                <InfoRow label="Street" value={user.street} />
                <InfoRow label="House Number" value={user.house_number} />
                <InfoRow label="Post Code" value={user.post_code} />
                <InfoRow label="City" value={user.city} />
                {user.street && user.city && (
                  <div className="mt-3 rounded-lg bg-muted/50 p-3 text-center">
                    <p className="text-xs text-muted-foreground">
                      {user.street} {user.house_number}, {user.post_code} {user.city}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center gap-2 pb-3">
                <ShieldCheck className="h-5 w-5 text-vyva-green" />
                <CardTitle className="font-display text-base">Consent</CardTitle>
              </CardHeader>
              <CardContent>
                <InfoRow label="User Consent" value={consent?.consent_given ? "✅ Given" : "❌ Not Given"} />
                <InfoRow label="Caretaker Consent" value={consent?.caretaker_consent ? "✅ Given" : "❌ Not Given"} />
                {consent && (
                  <p className="text-[10px] text-muted-foreground mt-2">Recorded {new Date(consent.created_at).toLocaleDateString()}</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center gap-2 pb-3">
                <Users className="h-5 w-5 text-vyva-green" />
                <CardTitle className="font-display text-base">Caregivers ({caregivers.length})</CardTitle>
                <Button variant="ghost" size="icon" className="h-7 w-7 ml-auto" onClick={() => { setEditCaregiverTarget(null); setEditCaregiverOpen(true); }}>
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </CardHeader>
              <CardContent>
                {caregivers.length === 0 ? (
                  <div className="text-center py-4">
                    <Users className="mx-auto h-8 w-8 text-muted-foreground/50 mb-1" />
                    <p className="text-sm text-muted-foreground">No caregivers linked</p>
                  </div>
                ) : (
                  caregivers.map((c: any) => (
                    <div key={c.id} className="rounded-lg bg-muted/50 p-3 mb-2 last:mb-0 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-foreground">{c.caretaker_name || "Unknown"}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Phone className="h-3 w-3" /> {c.caretaker_phone || "No phone"}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditCaregiverTarget(c); setEditCaregiverOpen(true); }}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDeleteCaregiver(c.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {user.emergency_notes && (
              <Card className="md:col-span-2 border-destructive/30">
                <CardHeader className="flex flex-row items-center gap-2 pb-3">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                  <CardTitle className="font-display text-base text-destructive">Emergency Notes</CardTitle>
                  <EditBtn onClick={() => setEditUserOpen(true)} />
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
            <Card>
              <CardHeader className="flex flex-row items-center gap-2 pb-3">
                <HeartPulse className="h-5 w-5 text-vyva-pink" />
                <CardTitle className="font-display text-base">Health Conditions</CardTitle>
                <EditBtn onClick={() => setEditHealthOpen(true)} />
              </CardHeader>
              <CardContent>
                {health?.health_conditions?.length ? (
                  <div className="space-y-2">
                    {health.health_conditions.map((c: string, i: number) => (
                      <div key={i} className="flex items-center gap-2 rounded-lg bg-vyva-pink/5 border border-vyva-pink/10 p-2.5">
                        <HeartPulse className="h-4 w-4 text-vyva-pink shrink-0" />
                        <span className="text-sm font-medium text-foreground">{c}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">No conditions recorded</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center gap-2 pb-3">
                <Activity className="h-5 w-5 text-vyva-teal" />
                <CardTitle className="font-display text-base">Mobility Needs</CardTitle>
                <EditBtn onClick={() => setEditHealthOpen(true)} />
              </CardHeader>
              <CardContent>
                {health?.mobility_needs?.length ? (
                  <div className="space-y-2">
                    {health.mobility_needs.map((m: string, i: number) => (
                      <div key={i} className="flex items-center gap-2 rounded-lg bg-vyva-teal/5 border border-vyva-teal/10 p-2.5">
                        <Activity className="h-4 w-4 text-vyva-teal shrink-0" />
                        <span className="text-sm font-medium text-foreground">{m}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">No mobility needs recorded</p>
                )}
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader className="flex flex-row items-center gap-2 pb-3">
                <Pill className="h-5 w-5 text-accent" />
                <CardTitle className="font-display text-base">Medications ({medications.length})</CardTitle>
                <Button variant="ghost" size="icon" className="h-7 w-7 ml-auto" onClick={() => { setEditMedTarget(null); setEditMedOpen(true); }}>
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </CardHeader>
              <CardContent>
                {medications.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No medications recorded</p>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2">
                    {medications.map((med: any) => (
                      <div key={med.id} className="rounded-lg border border-border/50 p-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-semibold text-sm text-foreground">{med.medication_name}</p>
                            {med.purpose && <p className="text-xs text-muted-foreground mt-0.5">{med.purpose}</p>}
                          </div>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setEditMedTarget(med); setEditMedOpen(true); }}>
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => handleDeleteMedication(med.id)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {med.dosage && (
                            <Badge variant="secondary" className="text-[10px]">💊 {med.dosage}</Badge>
                          )}
                          {med.schedule_times?.map((t: string, i: number) => (
                            <Badge key={i} variant="outline" className="text-[10px]">🕐 {t}</Badge>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center gap-2 pb-3">
                <PhoneCall className="h-5 w-5 text-vyva-teal" />
                <CardTitle className="font-display text-base">Check-in Settings</CardTitle>
                {checkins && <EditBtn onClick={() => setEditCheckinOpen(true)} />}
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 mb-3">
                  <Badge variant={checkins?.enabled ? "default" : "secondary"}>
                    {checkins?.enabled ? "Enabled" : "Disabled"}
                  </Badge>
                </div>
                <InfoRow label="Frequency" value={checkins?.frequency} />
                <InfoRow label="Preferred Time" value={checkins?.preferred_time} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center gap-2 pb-3">
                <Brain className="h-5 w-5 text-vyva-purple" />
                <CardTitle className="font-display text-base">Brain Coach</CardTitle>
                {brainCoach && <EditBtn onClick={() => setEditBrainOpen(true)} />}
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 mb-3">
                  <Badge variant={brainCoach?.enabled ? "default" : "secondary"}>
                    {brainCoach?.enabled ? "Enabled" : "Disabled"}
                  </Badge>
                </div>
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
                <CardContent className="py-12 text-center">
                  <Activity className="mx-auto h-12 w-12 text-muted-foreground/50 mb-2" />
                  <p className="text-lg font-medium text-foreground">No sensors assigned</p>
                  <p className="text-sm text-muted-foreground">IoT devices will appear here once linked.</p>
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {sensors.map((sensor: any) => (
                    <Card key={sensor.id} className={sensor.status === "online" ? "border-vyva-green/30" : "border-border"}>
                      <CardContent className="pt-5">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            {sensor.status === "online" ? (
                              <Wifi className="h-4 w-4 text-vyva-green" />
                            ) : (
                              <WifiOff className="h-4 w-4 text-muted-foreground" />
                            )}
                            <div>
                              <p className="font-medium text-sm">{sensor.device_name || sensor.device_id}</p>
                              <p className="text-xs text-muted-foreground"><SensorTypeLabel type={sensor.sensor_type} /></p>
                            </div>
                          </div>
                          <Badge variant={sensor.status === "online" ? "default" : "secondary"} className="text-xs">
                            {sensor.status}
                          </Badge>
                        </div>
                        {sensor.battery_level != null && (
                          <div className="mb-2">
                            <div className="flex items-center justify-between text-xs mb-1">
                              <span className="flex items-center gap-1 text-muted-foreground">
                                <Battery className="h-3 w-3" /> Battery
                              </span>
                              <span className={sensor.battery_level < 20 ? "text-destructive font-medium" : "text-foreground"}>
                                {sensor.battery_level}%
                              </span>
                            </div>
                            <Progress
                              value={sensor.battery_level}
                              className={`h-1.5 ${sensor.battery_level < 20 ? "[&>div]:bg-destructive" : sensor.battery_level < 50 ? "[&>div]:bg-accent" : "[&>div]:bg-vyva-green"}`}
                            />
                          </div>
                        )}
                        <InfoRow label="Device ID" value={sensor.device_id} />
                        <InfoRow label="Last Reading" value={sensor.last_reading_at ? new Date(sensor.last_reading_at).toLocaleString() : null} />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </>
            )}
          </div>
        </TabsContent>

        {/* ALERTS TAB */}
        <TabsContent value="alerts">
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="font-display text-base">Alerts (Last 7 Days)</CardTitle>
                </CardHeader>
                <CardContent>
                  {alertsTrend.some(d => d.count > 0) ? (
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={alertsTrend}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                        <Tooltip contentStyle={{ borderRadius: "0.5rem", border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }} />
                        <Line type="monotone" dataKey="count" stroke="hsl(0 84% 60%)" strokeWidth={2} dot={{ fill: "hsl(0 84% 60%)" }} name="Alerts" />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">No alerts recently</div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="font-display text-base">Severity Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  {alertSeverityData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie data={alertSeverityData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={4} dataKey="value">
                          {alertSeverityData.map((entry, i) => (
                            <Cell key={i} fill={entry.fill} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ borderRadius: "0.5rem", border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">No alerts recorded</div>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="font-display text-base">All Alerts ({alerts.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {alerts.length === 0 ? (
                  <div className="text-center py-6">
                    <ShieldCheck className="mx-auto h-10 w-10 text-vyva-green mb-2" />
                    <p className="text-muted-foreground">No alerts — all clear!</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {alerts.map((alert: any) => (
                      <div key={alert.id} className="flex items-center justify-between rounded-lg border border-border/50 p-3">
                        <div className="flex items-center gap-3">
                          <Badge className={alert.severity === "critical" ? "bg-destructive text-destructive-foreground" : alert.severity === "warning" ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"}>
                            {alert.severity}
                          </Badge>
                          <div>
                            <p className="text-sm font-medium">{alert.alert_type.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())}</p>
                            {alert.message && <p className="text-xs text-muted-foreground">{alert.message}</p>}
                            {alert.vyva_user_sensors?.device_name && (
                              <p className="text-xs text-muted-foreground">{alert.vyva_user_sensors.device_name} · <SensorTypeLabel type={alert.vyva_user_sensors.sensor_type} /></p>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">{new Date(alert.created_at).toLocaleString()}</p>
                          {alert.resolved_at ? (
                            <Badge variant="secondary" className="text-[10px] mt-0.5">Resolved</Badge>
                          ) : (
                            <Badge variant="destructive" className="text-[10px] mt-0.5">Active</Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
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
                if (consent) events.push({ date: consent.created_at, label: "Consent recorded", type: "consent" });
                if (checkins) events.push({ date: checkins.created_at, label: `Check-in ${checkins.enabled ? "enabled" : "configured"}`, type: "checkin" });
                if (brainCoach) events.push({ date: brainCoach.created_at, label: `Brain coach ${brainCoach.enabled ? "enabled" : "configured"}`, type: "brain" });
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

                const typeIcons: Record<string, React.ReactNode> = {
                  onboarding: <User className="h-3 w-3" />,
                  consent: <ShieldCheck className="h-3 w-3" />,
                  checkin: <PhoneCall className="h-3 w-3" />,
                  brain: <Brain className="h-3 w-3" />,
                  medication: <Pill className="h-3 w-3" />,
                  sensor: <Activity className="h-3 w-3" />,
                  alert: <AlertTriangle className="h-3 w-3" />,
                  critical: <Zap className="h-3 w-3" />,
                };

                return (
                  <div className="space-y-0 max-h-[500px] overflow-y-auto">
                    {events.map((event, i) => (
                      <div key={i} className="flex gap-4 py-3">
                        <div className="flex flex-col items-center">
                          <div className={`h-6 w-6 rounded-full ${typeColors[event.type] || "bg-muted-foreground"} flex items-center justify-center text-white`}>
                            {typeIcons[event.type]}
                          </div>
                          {i < events.length - 1 && <div className="w-px flex-1 bg-border mt-1" />}
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

      {/* Edit Dialogs */}
      {editUserOpen && (
        <EditUserDialog open={editUserOpen} onOpenChange={setEditUserOpen} user={user} />
      )}
      {editHealthOpen && health && (
        <EditHealthDialog open={editHealthOpen} onOpenChange={setEditHealthOpen} vyvaUserId={user.id} health={health} />
      )}
      {editMedOpen && (
        <EditMedicationDialog open={editMedOpen} onOpenChange={setEditMedOpen} vyvaUserId={user.id} medication={editMedTarget} />
      )}
      {editCaregiverOpen && (
        <EditCaregiverDialog open={editCaregiverOpen} onOpenChange={setEditCaregiverOpen} vyvaUserId={user.id} caregiver={editCaregiverTarget} />
      )}
      {editCheckinOpen && checkins && (
        <EditServiceDialog open={editCheckinOpen} onOpenChange={setEditCheckinOpen} vyvaUserId={user.id} service={checkins} serviceName="Check-in" table="vyva_user_checkins" />
      )}
      {editBrainOpen && brainCoach && (
        <EditServiceDialog open={editBrainOpen} onOpenChange={setEditBrainOpen} vyvaUserId={user.id} service={brainCoach} serviceName="Brain Coach" table="vyva_user_brain_coach" />
      )}
    </div>
  );
}
