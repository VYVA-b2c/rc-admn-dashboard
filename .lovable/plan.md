

## Plan: Enhance Priority Alerts Panel — Realistic Operations Feel

### Overview
Make the Priority Alerts panel feel like a live operations console by adding status labels, smarter alert copy, pulsing critical indicators, and deriving alert status from timestamp age relative to severity.

### Changes

**1. Add pulse animation to `src/index.css`**
Add a `@keyframes alert-pulse` animation — a soft red glow pulse on a 2s cycle for the severity dot and badge on critical alerts.

**2. Update `src/components/dashboard/PriorityAlertsPanel.tsx`**

**Status derivation logic** (client-side, no DB changes):
- Derive status from `created_at` age + severity:
  - Critical: <15 min → "New", 15 min–2 hr → "Ongoing", >2 hr → "Escalated"
  - High: <1 hr → "New", 1–4 hr → "Ongoing", >4 hr → "Escalated"
  - Medium/Low: <4 hr → "New", 4–24 hr → "Ongoing", >24 hr → "Escalated"

**Improved alert message formatting**:
- Add a `formatAlertMessage(alert_type, message)` helper that maps raw `alert_type` values to human-readable operational copy:
  - `fall_detected` → "Possible fall detected — no confirmation received"
  - `missed_checkin` → "No response after scheduled check-in attempts"
  - `high_heart_rate` → "Heart rate above threshold"
  - `low_battery` → "Battery critically low"
  - `medication_missed` → "Medication not confirmed after reminder window"
  - `inactivity_detected` → "No activity detected"
  - Fallback: use original message or "Alert requires attention"

**Status pill**: Add a small pill badge below the message line showing "New" (blue), "Ongoing" (amber), or "Escalated" (red outline).

**Pulse animation on critical alerts**:
- The severity dot gets class `animate-alert-pulse` for critical alerts
- The "Critical" badge also pulses subtly

**Row layout** stays compact — same structure, just adding the status pill inline after the time.

**3. Files**
- **Modified**: `src/index.css` — add pulse keyframes
- **Modified**: `src/components/dashboard/PriorityAlertsPanel.tsx` — status logic, message formatting, pulse classes, status pill

### No database changes needed.

