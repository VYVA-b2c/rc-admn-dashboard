

## Plan: At-Risk Users Panel

### Overview
Add a proactive "At-Risk Users" panel next to the existing "Priority Alerts" panel, showing the top 8 users sorted by risk score descending. This panel highlights users trending toward risk based on behavioral patterns — complementing the reactive alerts panel.

### Changes

**1. New component: `src/components/dashboard/AtRiskUsersPanel.tsx`**

A card matching the Priority Alerts panel height and style (ScrollArea h-[280px]).

Structure per row:
- Left: colored risk score number (large, bold) with risk band badge
- Center: user name, city (muted), 1-line reason text, trend arrow icon (↑/↓/→)
- Right: View (Eye icon link to `/users/{id}`) and Call (Phone icon) quick actions

Risk reason is generated client-side from the user's data:
- `criticalAlerts > 0` → "X critical alert(s) unresolved"
- `missedMeds7d > 0` → "Missed X medication(s) this week"
- `offlineSensors > 0` → "X sensor(s) offline"
- `!checkinEnabled` → "Check-ins not enabled"
- `healthConditions >= 3` → "Multiple health conditions"
- Fallback: "Reduced activity patterns"

Trend indicator is derived by comparing risk factors (simulated — uses simple heuristic: critical alerts or missed meds → ↑ worsening, offlineSensors only → → stable, otherwise ↓ improving).

Header includes subtitle "Based on recent trends" in muted text.

Filters out users with riskScore === 0 (fully stable). Shows top 8 by score.

Clicking a row triggers the same `onUserClick` callback used elsewhere to open the Intervention Panel.

**2. Update `src/pages/Dashboard.tsx`**
- Import `AtRiskUsersPanel`
- Replace the single `<PriorityAlertsPanel>` line with a 2-column grid:
  ```
  <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
    <PriorityAlertsPanel ... />
    <AtRiskUsersPanel ... />
  </div>
  ```
- Pass `gisUsers` and `handleUserClick` to the new panel

### No database changes needed.
Risk data already exists via `computeRiskScore` in `useGISData`.

### Files
- **New**: `src/components/dashboard/AtRiskUsersPanel.tsx`
- **Modified**: `src/pages/Dashboard.tsx`

