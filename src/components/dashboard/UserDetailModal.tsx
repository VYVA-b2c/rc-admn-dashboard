import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { GISUser } from "@/hooks/useGISData";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  User,
  Phone,
  MapPin,
  Heart,
  Pill,
  AlertTriangle,
  Radio,
  PhoneCall,
  Calendar,
  ExternalLink,
} from "lucide-react";

interface UserDetailModalProps {
  user: GISUser | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface UserDetail {
  health: { health_conditions: string[] | null; mobility_needs: string[] | null } | null;
  medications: { medication_name: string; dosage: string | null; purpose: string | null }[];
  caregivers: { caretaker_name: string | null; caretaker_phone: string | null }[];
  checkin: { enabled: boolean; frequency: string | null; preferred_time: string | null } | null;
}

export function UserDetailModal({ user, open, onOpenChange }: UserDetailModalProps) {
  const navigate = useNavigate();
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user || !open) {
      setDetail(null);
      return;
    }

    let cancelled = false;
    setLoading(true);

    Promise.all([
      supabase.from("vyva_user_health").select("health_conditions, mobility_needs").eq("vyva_user_id", user.id).maybeSingle(),
      supabase.from("vyva_user_medications").select("medication_name, dosage, purpose").eq("vyva_user_id", user.id),
      supabase.from("vyva_user_caregivers").select("caretaker_name, caretaker_phone").eq("vyva_user_id", user.id),
      supabase.from("vyva_user_checkins").select("enabled, frequency, preferred_time").eq("vyva_user_id", user.id).maybeSingle(),
    ]).then(([healthRes, medsRes, caregiversRes, checkinRes]) => {
      if (cancelled) return;
      setDetail({
        health: healthRes.data ?? null,
        medications: medsRes.data ?? [],
        caregivers: caregiversRes.data ?? [],
        checkin: checkinRes.data ?? null,
      });
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, [user?.id, open]);

  if (!user) return null;

  const fullName = `${user.first_name} ${user.last_name}`;
  const statusColor = user.criticalAlerts > 0 ? "destructive" : user.activeAlerts > 0 ? "secondary" : "default";
  const statusLabel = user.criticalAlerts > 0 ? "Critical" : user.activeAlerts > 0 ? "Warning" : "Stable";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] p-0 gap-0">
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <User className="h-6 w-6 text-primary" />
              </div>
              <div>
                <DialogTitle className="font-display text-lg">{fullName}</DialogTitle>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant={statusColor as any} className="text-[10px]">{statusLabel}</Badge>
                  {user.city && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3" /> {user.city}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </DialogHeader>

        <Separator />

        <ScrollArea className="max-h-[55vh]">
          <div className="space-y-5 px-6 py-5">
            {/* Contact */}
            {user.phone && (
              <Section icon={<Phone className="h-4 w-4" />} title="Contact">
                <p className="text-sm">{user.phone}</p>
              </Section>
            )}

            {/* Alerts Summary */}
            <Section icon={<AlertTriangle className="h-4 w-4 text-destructive" />} title="Alerts">
              <div className="flex gap-3 text-sm">
                <span>{user.criticalAlerts} critical</span>
                <span>{user.activeAlerts} active</span>
              </div>
            </Section>

            {/* Sensors */}
            <Section icon={<Radio className="h-4 w-4" />} title="Sensors">
              <p className="text-sm">{user.sensorCount} sensor{user.sensorCount !== 1 ? "s" : ""} connected</p>
            </Section>

            {/* Check-in */}
            <Section icon={<PhoneCall className="h-4 w-4" />} title="Check-In">
              {loading ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : detail?.checkin ? (
                <div className="text-sm space-y-1">
                  <p>Status: {detail.checkin.enabled ? "Enabled" : "Disabled"}</p>
                  {detail.checkin.frequency && <p>Frequency: {detail.checkin.frequency}</p>}
                  {detail.checkin.preferred_time && <p>Preferred time: {detail.checkin.preferred_time}</p>}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No check-in configured</p>
              )}
            </Section>

            {/* Health */}
            <Section icon={<Heart className="h-4 w-4 text-destructive" />} title="Health">
              {loading ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : detail?.health ? (
                <div className="space-y-2 text-sm">
                  {detail.health.health_conditions?.length ? (
                    <div className="flex flex-wrap gap-1">
                      {detail.health.health_conditions.map((c) => (
                        <Badge key={c} variant="outline" className="text-[11px]">{c}</Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">No conditions listed</p>
                  )}
                  {detail.health.mobility_needs?.length ? (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Mobility</p>
                      <div className="flex flex-wrap gap-1">
                        {detail.health.mobility_needs.map((m) => (
                          <Badge key={m} variant="outline" className="text-[11px]">{m}</Badge>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No health data</p>
              )}
            </Section>

            {/* Medications */}
            <Section icon={<Pill className="h-4 w-4" />} title="Medications">
              {loading ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : detail?.medications.length ? (
                <div className="space-y-2">
                  {detail.medications.map((med, i) => (
                    <div key={i} className="rounded-md border border-border p-2 text-sm">
                      <p className="font-medium">{med.medication_name}</p>
                      {med.dosage && <p className="text-xs text-muted-foreground">Dosage: {med.dosage}</p>}
                      {med.purpose && <p className="text-xs text-muted-foreground">Purpose: {med.purpose}</p>}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No medications</p>
              )}
            </Section>

            {/* Caregivers */}
            <Section icon={<Heart className="h-4 w-4" />} title="Caregivers">
              {loading ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : detail?.caregivers.length ? (
                <div className="space-y-1 text-sm">
                  {detail.caregivers.map((cg, i) => (
                    <p key={i}>{cg.caretaker_name ?? "Unknown"} — {cg.caretaker_phone ?? "No phone"}</p>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No caregivers linked</p>
              )}
            </Section>
          </div>
        </ScrollArea>

        <Separator />

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2 px-6 py-4">
          <Button size="sm" variant="outline" onClick={() => { onOpenChange(false); navigate(`/users/${user.id}`); }}>
            <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> Full Profile
          </Button>
          <Button size="sm" variant="outline" onClick={() => { onOpenChange(false); navigate(`/checkin-monitoring`); }}>
            <PhoneCall className="mr-1.5 h-3.5 w-3.5" /> Revise Check-In
          </Button>
          <Button size="sm" variant="outline" onClick={() => { onOpenChange(false); navigate(`/sensors`); }}>
            <Radio className="mr-1.5 h-3.5 w-3.5" /> View Sensors
          </Button>
          <Button size="sm" variant="outline" onClick={() => { onOpenChange(false); navigate(`/emergency-contacts`); }}>
            <Phone className="mr-1.5 h-3.5 w-3.5" /> Emergency Contacts
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>
      {children}
    </div>
  );
}
