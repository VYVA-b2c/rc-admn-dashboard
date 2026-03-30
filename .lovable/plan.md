

## Plan: User Risk Score + One-Click Intervention Panel

### 1. Risk Score Computation

Add a `computeRiskScore(user)` utility function used across dashboard, user cards, map markers, and the intervention panel. The score (0–100) is computed client-side from existing data:

- **Alerts**: critical alert = +30 each (cap 60), warning = +15 each (cap 30)
- **Medications**: missed medication logs in last 7 days = +5 each (cap 20)
- **Check-in**: check-ins disabled = +10
- **Sensors**: offline sensors = +5 each (cap 15)
- **Health**: 3+ conditions = +10

Color bands: 80–100 red, 50–79 orange, 20–49 yellow, 0–19 green.

Create `src/lib/riskScore.ts` with the scoring function and color/label helpers.

### 2. Extend Data Hooks

**`src/hooks/useGISData.ts`**: Add `riskScore` to `GISUser` interface. Compute it during the query using alert counts, sensor counts, and checkin status. Also fetch recent medication logs (last 7 days, status = "missed") grouped by user to factor into score.

**`src/pages/UsersList.tsx`**: Import `computeRiskScore` and use it instead of the existing `getRiskLevel`. Add a "Sort by highest risk" option to the status filter dropdown.

### 3. Risk Score on Map Markers

**`src/components/dashboard/GISMap.tsx`**: Update `createUserIcon` to show the risk score number inside the marker circle (replacing initials). The pin color already reflects alert status — keep that, but add the numeric score inside.

### 4. Risk Score on User Detail Modal

**`src/components/dashboard/UserDetailModal.tsx`**: Add a prominent circular risk score indicator at the top of the modal next to the user name. Show tooltip on hover: "Based on activity, check-ins, medication adherence, and alerts."

### 5. One-Click Intervention Panel (Slide-in Sheet)

**New file: `src/components/dashboard/InterventionPanel.tsx`**

A right-side slide-in panel (`Sheet` from shadcn) that opens when clicking an alert row or a user marker/card. Contains:

- **Header**: User name, city, age (from `date_of_birth`)
- **Risk score**: Large circular progress indicator with color
- **Last activity summary**: Last check-in time, last sensor reading
- **Current alerts**: List of active alerts for this user
- **Action buttons** (large, icon + label):
  - **Call User** (primary/highlighted, `tel:` link) — `Phone` icon
  - **Trigger Check-in** — `PhoneCall` icon, shows success toast
  - **Request Doctor** — `Stethoscope` icon, shows success toast
  - **Notify Caregiver** — `UserCheck` icon, shows success toast
  - **Send Message** — `MessageSquare` icon, shows success toast
- Each button shows loading spinner on click, then success state (checkmark) for 2 seconds
- Actions are simulated for now (toast confirmation) — ready for real integrations later

### 6. Wire It Up

**`src/pages/Dashboard.tsx`**:
- Import `InterventionPanel`
- Open it from alert row clicks and map marker clicks (instead of / in addition to the modal)
- Pass selected user data + alerts to the panel

**`src/pages/UsersList.tsx`**:
- Add click handler on user cards to open the intervention panel
- Import and render `InterventionPanel`

### 7. Data Changes

**No database migration needed.** Risk score is computed client-side from existing tables. The medication logs table already exists. Action buttons are simulated (toast feedback).

### Files
- **New**: `src/lib/riskScore.ts` — scoring function + color helpers
- **New**: `src/components/dashboard/InterventionPanel.tsx` — slide-in panel
- **Modified**: `src/hooks/useGISData.ts` — add `riskScore` to GISUser, fetch med logs
- **Modified**: `src/components/dashboard/GISMap.tsx` — show score in markers
- **Modified**: `src/components/dashboard/UserDetailModal.tsx` — add risk score display
- **Modified**: `src/components/dashboard/PriorityAlertsPanel.tsx` — open intervention panel on alert click
- **Modified**: `src/pages/Dashboard.tsx` — integrate intervention panel
- **Modified**: `src/pages/UsersList.tsx` — add risk score + sort + intervention panel

