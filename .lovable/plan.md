

## Plan: User-Level Sensor Configuration

### Overview
Add the ability for admins to add, edit, and remove sensors per user, supporting both predefined sensor types and custom ones with configurable integration methods. This includes changes to the database schema, a new sensor edit dialog, updates to the User Profile sensors tab, and enhancements to the global Sensors page.

### Database Changes (Migration)

**1. Extend `vyva_user_sensors` table** with integration configuration columns:

```sql
ALTER TABLE vyva_user_sensors
  ADD COLUMN integration_method text DEFAULT 'api',
  ADD COLUMN integration_config jsonb DEFAULT '{}',
  ADD COLUMN notes text;
```

- `integration_method`: one of `api`, `webhook`, `mqtt`, `ble`, `manual`
- `integration_config`: flexible JSON for method-specific settings (e.g. `{"endpoint_url": "...", "api_key_ref": "..."}` for API, `{"topic": "..."}` for MQTT, `{"ble_device_id": "..."}` for BLE)
- `notes`: free-text admin notes

**2. Create `sensor_type_catalog` table** for the predefined + custom catalog:

```sql
CREATE TABLE public.sensor_type_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type_key text UNIQUE NOT NULL,
  label text NOT NULL,
  is_custom boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Seed predefined types
INSERT INTO sensor_type_catalog (type_key, label) VALUES
  ('heart_rate', 'Heart Rate'),
  ('blood_pressure', 'Blood Pressure'),
  ('fall_detector', 'Fall Detector'),
  ('activity_monitor', 'Activity Monitor'),
  ('temperature', 'Temperature'),
  ('spo2', 'SpO2 / Oxygen'),
  ('glucose', 'Glucose Monitor'),
  ('sleep_tracker', 'Sleep Tracker');
```

RLS: admin SELECT, INSERT for custom types.

**3. Add RLS policies** for INSERT, UPDATE, DELETE on `vyva_user_sensors` for admins (currently only SELECT exists).

### New Components

**`src/components/user/EditSensorDialog.tsx`**
A dialog for adding/editing a sensor on a user, with fields:
- **Sensor type**: Select from catalog (with "Add custom type" option)
- **Device ID**: text input
- **Device name**: text input
- **Integration method**: radio/select (API, Webhook, MQTT, BLE, Manual)
- **Integration config**: dynamic fields based on method:
  - API: endpoint URL, auth header/key reference
  - Webhook: callback URL (auto-generated or manual)
  - MQTT: broker URL, topic
  - BLE: BLE device ID, service UUID
  - Manual: notes only
- **Status**: online/offline toggle
- **Notes**: textarea

### Modified Files

**`src/pages/UserProfile.tsx`** (Sensors tab)
- Add "Add Sensor" button
- Add edit/delete buttons on each sensor card
- Wire up `EditSensorDialog` for add and edit
- Add delete handler with confirmation

**`src/pages/Sensors.tsx`** (Global overview)
- Add a "Configure Sensors" section or button that links to user profiles
- Show integration method badge on each sensor card
- Add quick-add sensor action with user selector

### Build Order
1. Database migration (new columns + catalog table + RLS)
2. Create `EditSensorDialog` component
3. Update UserProfile sensors tab with add/edit/delete
4. Update global Sensors page with integration info

### Files
- **Migration**: ALTER `vyva_user_sensors`, CREATE `sensor_type_catalog`, new RLS policies
- **New**: `src/components/user/EditSensorDialog.tsx`
- **Modified**: `src/pages/UserProfile.tsx`, `src/pages/Sensors.tsx`

