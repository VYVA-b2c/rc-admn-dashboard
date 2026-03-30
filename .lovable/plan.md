

## Plan: Smart Alert Prioritization Panel

### Overview
Replace the current basic "Active Alerts" card in the dashboard with a prominent "Priority Alerts Panel" placed at the top of the page (before the map). The panel features 4-level severity sorting, a summary bar, and quick action buttons per alert.

### Changes

**1. Update `src/hooks/useGISData.ts`**
- Add `vyva_user_id` to the `ActiveAlert` interface
- Extend severity support: the current data only has `critical` and `warning` — add mapping logic so alerts can also be `high`, `medium`, `low` (future-proof, map existing `warning` to `high` for now)
- Sort alerts by severity weight (critical > high > medium > low), then by recency

**2. Create `src/components/dashboard/PriorityAlertsPanel.tsx`**
- Summary bar at top: colored badges showing count per severity level (e.g., "3 Critical · 5 High · 3 Medium · 1 Low")
- Scrollable ranked list of alerts, each row showing:
  - Color-coded severity dot (red/orange/yellow/green)
  - User name + city
  - Alert type (missed check-in, sensor anomaly, etc.)
  - Time since triggered (using `formatDistanceToNow`)
  - Severity badge
  - Quick action buttons: "View user" (links to `/users/:id`), "Call" (tel: link using user phone), "Resolve" (marks alert resolved via update to `vyva_sensor_alerts.resolved_at`)
- Critical alerts pinned at top regardless of recency
- Empty state when no alerts

**3. Update `src/pages/Dashboard.tsx`**
- Add the `PriorityAlertsPanel` component between the stat row and the search/filter bar
- Remove the old "Active Alerts Feed" card from the bottom grid (replaced by the new panel)
- Keep the "Users by City" chart as a full-width or half-width card

**4. Database: Add RLS policy for UPDATE on `vyva_sensor_alerts`**
- Currently admins cannot update alerts (no UPDATE policy). Need a migration to add:
  ```sql
  CREATE POLICY "Admins can update alerts" ON vyva_sensor_alerts
  FOR UPDATE TO authenticated USING (is_admin_user(auth.uid()))
  WITH CHECK (is_admin_user(auth.uid()));
  ```
- This enables the "Resolve" action

**5. Update `useGISData` to include phone numbers in active alerts**
- Map user phone into the `ActiveAlert` type so the "Call" button works

### Severity Mapping
```text
critical  → Red    (#dc2626)  — weight 4
high      → Orange (#f97316)  — weight 3
warning   → Orange (#f97316)  — weight 3 (alias for high)
medium    → Yellow (#eab308)  — weight 2
low       → Green  (#22c55e)  — weight 1
```

### Files
- **Migration**: Add UPDATE policy on `vyva_sensor_alerts`
- **New**: `src/components/dashboard/PriorityAlertsPanel.tsx`
- **Modified**: `src/hooks/useGISData.ts` (add phone + vyva_user_id to ActiveAlert, severity sorting)
- **Modified**: `src/pages/Dashboard.tsx` (add panel, remove old alerts card)

