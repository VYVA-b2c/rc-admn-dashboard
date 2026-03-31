

## Plan: Refactor Priority Alerts + Operations Queue for Clear Role Separation

### Problem
Both panels share similar wording and logic. The Operations Queue contains bad actions ("Review alert", "Replace sensor battery", "Verify user safety") and reuses raw alert messages as reasons instead of translating them into human-readable action context.

### Changes

**1. `src/components/dashboard/PriorityAlertsPanel.tsx`** — make purely informational
- Remove the "Resolve" (CheckCircle) action button — resolving belongs in the Operations Queue
- Keep only View (Eye) and Call (Phone) as quick-reference actions
- Update fallback message from "Alert requires attention" to just use the raw message or alert_type label
- This panel stays as-is otherwise — it already has good event-style copy

**2. `src/components/dashboard/OperationsQueuePanel.tsx`** — fix action copy and reasons

Replace the ACTION_MAP with proper human-actionable verbs:
```
fall_detected      → "Call user immediately"
missed_checkin     → "Retry check-in call"
high_heart_rate    → "Assess user condition via call"
medication_missed  → "Call to confirm medication taken"
inactivity_detected → "Schedule welfare check-in"
low_battery        → "Contact user to verify device status"
temperature_high   → "Call user about room conditions"
door_open          → "Contact user to confirm safety"
default            → "Contact user"
```

Add a separate REASON_MAP so reasons differ from alert copy:
```
fall_detected      → "No response after fall detection"
missed_checkin     → "Multiple check-in attempts unanswered"
high_heart_rate    → "Elevated heart rate detected"
medication_missed  → "Medication reminder window expired"
inactivity_detected → "Extended period without activity"
low_battery        → "Device battery may fail soon"
temperature_high   → "Unusual room temperature reported"
door_open          → "Door left open for unusual duration"
default            → uses raw message
```

### Files
- **Modified**: `src/components/dashboard/PriorityAlertsPanel.tsx` — remove resolve button
- **Modified**: `src/components/dashboard/OperationsQueuePanel.tsx` — new ACTION_MAP + REASON_MAP, remove "Review alert" fallback

### No database changes needed.

