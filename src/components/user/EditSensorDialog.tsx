import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Plus } from "lucide-react";

const INTEGRATION_METHODS = [
  { value: "api", label: "API" },
  { value: "webhook", label: "Webhook" },
  { value: "mqtt", label: "MQTT" },
  { value: "ble", label: "BLE / Bluetooth" },
  { value: "manual", label: "Manual" },
];

interface EditSensorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vyvaUserId: string;
  sensor?: any; // null = add mode
}

export function EditSensorDialog({ open, onOpenChange, vyvaUserId, sensor }: EditSensorDialogProps) {
  const queryClient = useQueryClient();
  const isEdit = !!sensor;

  const [sensorType, setSensorType] = useState(sensor?.sensor_type || "");
  const [customTypeKey, setCustomTypeKey] = useState("");
  const [customTypeLabel, setCustomTypeLabel] = useState("");
  const [showCustomType, setShowCustomType] = useState(false);
  const [deviceId, setDeviceId] = useState(sensor?.device_id || "");
  const [deviceName, setDeviceName] = useState(sensor?.device_name || "");
  const [integrationMethod, setIntegrationMethod] = useState(sensor?.integration_method || "manual");
  const [status, setStatus] = useState(sensor?.status === "online");
  const [notes, setNotes] = useState(sensor?.notes || "");
  const [saving, setSaving] = useState(false);

  // Integration config fields
  const [configEndpoint, setConfigEndpoint] = useState("");
  const [configApiKey, setConfigApiKey] = useState("");
  const [configCallbackUrl, setConfigCallbackUrl] = useState("");
  const [configBrokerUrl, setConfigBrokerUrl] = useState("");
  const [configTopic, setConfigTopic] = useState("");
  const [configBleId, setConfigBleId] = useState("");
  const [configServiceUuid, setConfigServiceUuid] = useState("");

  // Load integration config from sensor
  useEffect(() => {
    if (sensor?.integration_config) {
      const cfg = sensor.integration_config;
      setConfigEndpoint(cfg.endpoint_url || "");
      setConfigApiKey(cfg.api_key_ref || "");
      setConfigCallbackUrl(cfg.callback_url || "");
      setConfigBrokerUrl(cfg.broker_url || "");
      setConfigTopic(cfg.topic || "");
      setConfigBleId(cfg.ble_device_id || "");
      setConfigServiceUuid(cfg.service_uuid || "");
    }
  }, [sensor]);

  const { data: catalog } = useQuery({
    queryKey: ["sensor-type-catalog"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sensor_type_catalog" as any)
        .select("*")
        .order("is_custom", { ascending: true });
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const buildIntegrationConfig = () => {
    switch (integrationMethod) {
      case "api":
        return { endpoint_url: configEndpoint, api_key_ref: configApiKey };
      case "webhook":
        return { callback_url: configCallbackUrl };
      case "mqtt":
        return { broker_url: configBrokerUrl, topic: configTopic };
      case "ble":
        return { ble_device_id: configBleId, service_uuid: configServiceUuid };
      default:
        return {};
    }
  };

  const handleAddCustomType = async () => {
    if (!customTypeKey || !customTypeLabel) return;
    const { error } = await supabase.from("sensor_type_catalog" as any).insert({
      type_key: customTypeKey.toLowerCase().replace(/\s+/g, "_"),
      label: customTypeLabel,
      is_custom: true,
    } as any);
    if (error) {
      toast({ title: "Error adding type", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Custom sensor type added" });
      setSensorType(customTypeKey.toLowerCase().replace(/\s+/g, "_"));
      setShowCustomType(false);
      setCustomTypeKey("");
      setCustomTypeLabel("");
      queryClient.invalidateQueries({ queryKey: ["sensor-type-catalog"] });
    }
  };

  const handleSave = async () => {
    if (!sensorType || !deviceId) {
      toast({ title: "Missing fields", description: "Sensor type and Device ID are required.", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload: any = {
      sensor_type: sensorType,
      device_id: deviceId,
      device_name: deviceName || null,
      integration_method: integrationMethod,
      integration_config: buildIntegrationConfig(),
      status: status ? "online" : "offline",
      notes: notes || null,
    };

    let error;
    if (isEdit) {
      ({ error } = await supabase.from("vyva_user_sensors").update(payload).eq("id", sensor.id));
    } else {
      payload.vyva_user_id = vyvaUserId;
      ({ error } = await supabase.from("vyva_user_sensors").insert(payload));
    }

    setSaving(false);
    if (error) {
      toast({ title: "Error saving sensor", description: error.message, variant: "destructive" });
    } else {
      toast({ title: isEdit ? "Sensor updated" : "Sensor added" });
      queryClient.invalidateQueries({ queryKey: ["vyva-user-profile", vyvaUserId] });
      queryClient.invalidateQueries({ queryKey: ["sensor-devices"] });
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">{isEdit ? "Edit Sensor" : "Add Sensor"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Sensor Type */}
          <div className="space-y-2">
            <Label>Sensor Type</Label>
            {!showCustomType ? (
              <div className="flex gap-2">
                <Select value={sensorType} onValueChange={setSensorType}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select type..." />
                  </SelectTrigger>
                  <SelectContent>
                    {catalog?.map((c: any) => (
                      <SelectItem key={c.type_key} value={c.type_key}>
                        {c.label}
                        {c.is_custom && <Badge variant="secondary" className="ml-2 text-[9px]">Custom</Badge>}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="outline" size="icon" onClick={() => setShowCustomType(true)} title="Add custom type">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="space-y-2 rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground font-medium">Add Custom Sensor Type</p>
                <Input placeholder="Type key (e.g. eeg_monitor)" value={customTypeKey} onChange={e => setCustomTypeKey(e.target.value)} />
                <Input placeholder="Display label (e.g. EEG Monitor)" value={customTypeLabel} onChange={e => setCustomTypeLabel(e.target.value)} />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleAddCustomType} disabled={!customTypeKey || !customTypeLabel}>Add</Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowCustomType(false)}>Cancel</Button>
                </div>
              </div>
            )}
          </div>

          {/* Device ID + Name */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Device ID *</Label>
              <Input value={deviceId} onChange={e => setDeviceId(e.target.value)} placeholder="e.g. DEV-001" />
            </div>
            <div className="space-y-2">
              <Label>Device Name</Label>
              <Input value={deviceName} onChange={e => setDeviceName(e.target.value)} placeholder="e.g. Wrist HR Monitor" />
            </div>
          </div>

          {/* Integration Method */}
          <div className="space-y-2">
            <Label>Integration Method</Label>
            <Select value={integrationMethod} onValueChange={setIntegrationMethod}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INTEGRATION_METHODS.map(m => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Dynamic Integration Config */}
          {integrationMethod === "api" && (
            <div className="space-y-2 rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground font-medium">API Configuration</p>
              <div className="space-y-2">
                <Label className="text-xs">Endpoint URL</Label>
                <Input value={configEndpoint} onChange={e => setConfigEndpoint(e.target.value)} placeholder="https://api.sensor.com/data" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">API Key Reference</Label>
                <Input value={configApiKey} onChange={e => setConfigApiKey(e.target.value)} placeholder="secret name or key" />
              </div>
            </div>
          )}

          {integrationMethod === "webhook" && (
            <div className="space-y-2 rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground font-medium">Webhook Configuration</p>
              <div className="space-y-2">
                <Label className="text-xs">Callback URL</Label>
                <Input value={configCallbackUrl} onChange={e => setConfigCallbackUrl(e.target.value)} placeholder="https://your-app.com/webhook/sensor" />
              </div>
            </div>
          )}

          {integrationMethod === "mqtt" && (
            <div className="space-y-2 rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground font-medium">MQTT Configuration</p>
              <div className="space-y-2">
                <Label className="text-xs">Broker URL</Label>
                <Input value={configBrokerUrl} onChange={e => setConfigBrokerUrl(e.target.value)} placeholder="mqtt://broker.example.com:1883" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Topic</Label>
                <Input value={configTopic} onChange={e => setConfigTopic(e.target.value)} placeholder="sensors/user/heartrate" />
              </div>
            </div>
          )}

          {integrationMethod === "ble" && (
            <div className="space-y-2 rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground font-medium">BLE Configuration</p>
              <div className="space-y-2">
                <Label className="text-xs">BLE Device ID</Label>
                <Input value={configBleId} onChange={e => setConfigBleId(e.target.value)} placeholder="AA:BB:CC:DD:EE:FF" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Service UUID</Label>
                <Input value={configServiceUuid} onChange={e => setConfigServiceUuid(e.target.value)} placeholder="0000180d-0000-1000-8000-00805f9b34fb" />
              </div>
            </div>
          )}

          {integrationMethod === "manual" && (
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground">Manual integration — data is entered or uploaded manually. Use the notes field below for instructions.</p>
            </div>
          )}

          {/* Status */}
          <div className="flex items-center justify-between">
            <Label>Status</Label>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{status ? "Online" : "Offline"}</span>
              <Switch checked={status} onCheckedChange={setStatus} />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any admin notes about this sensor..." rows={3} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : isEdit ? "Update Sensor" : "Add Sensor"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
