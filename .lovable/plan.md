

## Plan: Medication Adherence Tracking Page

### Overview
Add a weekly medication adherence view per user (inspired by the uploaded screenshot) where admins can see each medication's scheduled doses across a 7-day week, with status indicators (taken, missed, unconfirmed, upcoming). Data comes from a new `vyva_medication_logs` table populated by the check-in agent calls.

### Database Changes

**New table: `vyva_medication_logs`**
```sql
CREATE TABLE vyva_medication_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vyva_user_id uuid NOT NULL REFERENCES vyva_users(id) ON DELETE CASCADE,
  medication_id uuid NOT NULL REFERENCES vyva_user_medications(id) ON DELETE CASCADE,
  scheduled_date date NOT NULL,
  scheduled_time text,
  status text NOT NULL DEFAULT 'pending',  -- 'taken', 'missed', 'pending'
  reported_at timestamptz,
  call_id text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
```
- RLS: SELECT, INSERT, UPDATE for admin users
- Unique constraint on `(medication_id, scheduled_date, scheduled_time)` to prevent duplicates

**Update webhook** to accept medication adherence reports from agent calls, inserting/updating logs.

### New Page: `src/pages/MedicationAdherence.tsx`

Weekly calendar view per user showing:
- Week navigation (previous/next week) with current week header
- One row per user's medication
- 7 columns (Mon-Sun), each cell showing:
  - Medication name + dose count badge (e.g., "0/1")
  - Scheduled time
  - Color-coded status: green (taken), red (missed), amber (unconfirmed), grey (upcoming/future)
- Legend at top: Taken, Missed, Unconfirmed, Upcoming
- Summary row per day showing overall adherence count

### Route & Navigation
- Route: `/users/:id/medications` 
- Access from UserProfile page via a "View Adherence" button on the Medications tab
- Back button to return to user profile

### Webhook Update (`onboarding-webhook/index.ts`)
- Accept a `medication_adherence` array in the payload:
  ```json
  { "medication_adherence": [
    { "medication_name": "ibuprofeno", "date": "2026-03-30", "time": "14:00", "status": "taken" }
  ]}
  ```
- Match by medication name + vyva_user_id, upsert into `vyva_medication_logs`

### Files
- **Migration**: Create `vyva_medication_logs` table + RLS policies
- **New**: `src/pages/MedicationAdherence.tsx`
- **Modified**: `src/App.tsx` (add route), `src/pages/UserProfile.tsx` (add "View Adherence" link), `supabase/functions/onboarding-webhook/index.ts` (handle adherence data)

