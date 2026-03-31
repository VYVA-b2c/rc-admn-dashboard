

## Plan: Replace At-Risk Users with Operations Queue

### Overview
Replace the "At-Risk Users" panel with an operational "Operations Queue" panel that shows actionable tasks derived from active alerts and user data. Each row is a clear instruction — not analytics.

### Changes

**1. Delete `src/components/dashboard/AtRiskUsersPanel.tsx`** — replaced entirely.

**2. New component: `src/components/dashboard/OperationsQueuePanel.tsx`**

Derives tasks from `ActiveAlert[]` and `GISUser[]` data:

- Each unresolved alert becomes a task with:
  - **User name** from alert
  - **Action** (bold): mapped from `alert_type` (e.g. `fall_detected` → "Call user immediately", `missed_checkin` → "Follow up check-in", `medication_missed` → "Verify medication status")
  - **Reason** (short): reuses alert message logic
  - **Priority**: mapped from severity (critical → red, high → orange, medium → yellow)
  - **Time urgency**: derived from severity + age (critical → "Now", high < 30min → "Within 30 min", medium → "In 10 min", etc.)

- Additionally generates routine tasks from GISUsers with check-ins enabled but no recent alerts (e.g. "Routine check-in" — medium priority)

Task list capped at 8 items, sorted by priority then urgency.

Each row layout:
- Left: colored priority indicator dot
- Center: user name, bold action line, short reason, time urgency pill
- Right: Call button, View button, Mark as Done (checkmark) button

"Mark as done" removes the task from the local list (client-side state via `useState` tracking dismissed IDs). For alert-based tasks, also resolves the underlying alert in the database.

Header: "Operations Queue" with subtitle "What to do next"

**3. Update `src/pages/Dashboard.tsx`**
- Replace `AtRiskUsersPanel` import with `OperationsQueuePanel`
- Pass `alerts` and `gisUsers` as props
- Keep the 2-column grid layout alongside Priority Alerts

### Action-type mapping
```text
fall_detected      → "Call user immediately"
missed_checkin     → "Follow up check-in"
high_heart_rate    → "Review health status"
medication_missed  → "Verify medication status"
inactivity_detected → "Welfare check required"
low_battery        → "Replace sensor battery"
temperature_high   → "Check environment"
door_open          → "Verify user safety"
default            → "Review alert"
```

### Time urgency logic
```text
critical           → "Now"
high, <30 min old  → "Within 10 min"
high, >30 min old  → "Within 30 min"
medium             → "Within 1 hour"
```

### No database changes needed.

### Files
- **Deleted**: `src/components/dashboard/AtRiskUsersPanel.tsx`
- **New**: `src/components/dashboard/OperationsQueuePanel.tsx`
- **Modified**: `src/pages/Dashboard.tsx`

