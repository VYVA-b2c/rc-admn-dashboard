

## Plan: Add Inline Editing to User Profile Page

### Overview
Add edit capabilities to the UserProfile page so admins can modify user data (profile, medications, caregivers, check-in settings, brain coach, health conditions) directly from the existing profile view using edit dialogs/sheets.

### Database Changes (Migration)
Add UPDATE and INSERT/DELETE RLS policies for admin users on these tables:
- `vyva_users` — UPDATE for admins
- `vyva_user_medications` — INSERT, UPDATE, DELETE for admins
- `vyva_user_caregivers` — INSERT, UPDATE, DELETE for admins
- `vyva_user_checkins` — UPDATE for admins
- `vyva_user_brain_coach` — UPDATE for admins
- `vyva_user_health` — UPDATE for admins

All policies use `is_admin_user(auth.uid())`.

### New Components

**1. `EditUserDialog.tsx`** — Edit personal info + address fields (first_name, last_name, phone, date_of_birth, gender, language, city, street, house_number, post_code, emergency_notes). Uses react-hook-form + zod validation.

**2. `EditMedicationDialog.tsx`** — Add/edit a single medication (medication_name, dosage, purpose, schedule_times). Supports both create and update modes.

**3. `EditCaregiverDialog.tsx`** — Add/edit a caregiver (caretaker_name, caretaker_phone).

**4. `EditServiceDialog.tsx`** — Edit check-in or brain coach settings (enabled toggle, frequency, preferred_time). Reusable for both services.

**5. `EditHealthDialog.tsx`** — Edit health conditions and mobility needs (tag-style input allowing add/remove of items from the arrays).

### UserProfile.tsx Changes
- Add "Edit" buttons (pencil icons) to each card header
- Wire up dialog open/close state for each editor
- On successful save, invalidate the `vyva-user-profile` query to refresh data
- Add delete confirmation for medications and caregivers (with trash icon buttons)

### Technical Details
- All mutations use `supabase.from("table").update/insert/delete`
- Form validation with zod schemas
- `useQueryClient().invalidateQueries(["vyva-user-profile", id])` after each mutation
- Toast notifications on success/error
- Schedule times editor: simple comma-separated input converted to string array

### Files
- **Migration**: New RLS policies for UPDATE/INSERT/DELETE on 6 tables
- **New**: `src/components/user/EditUserDialog.tsx`, `EditMedicationDialog.tsx`, `EditCaregiverDialog.tsx`, `EditServiceDialog.tsx`, `EditHealthDialog.tsx`
- **Modified**: `src/pages/UserProfile.tsx` — add edit buttons and dialog wiring

