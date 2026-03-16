

## VYVA Super Admin Dashboard — Final Implementation Plan

### Architecture

The onboarding agent (`agent_1501kkpm9aj0eb8rpjg1ft87kvsa`) collects user data and POSTs it to `https://api.vyva.io/api/v1/onboarding/red-cross/`. We will build a **Supabase Edge Function** as a webhook receiver that accepts the same payload format. The dashboard is a **read-only monitoring tool** over this data.

```text
┌──────────────┐    POST     ┌──────────────────────┐
│  Onboarding  │ ─────────► │  Supabase Edge Func  │
│    Agent     │            │  (webhook receiver)  │
└──────────────┘            └──────────┬───────────┘
                                       │ insert
                                       ▼
                              ┌─────────────────┐
                              │   Supabase DB    │
                              │  (data store)    │
                              └────────┬────────┘
                                       │ query
                                       ▼
                              ┌─────────────────┐
                              │  Admin Dashboard │
                              │  (React app)     │
                              └─────────────────┘
```

### Phase 1: Backend (Supabase)

**Database tables:**
- `profiles` — admin users (linked to auth.users)
- `user_roles` — role enum (admin, operator, coordinator) with `has_role()` security definer function
- `vyva_users` — name, phone, city, street, house_number, post_code, timezone
- `vyva_user_consent` — consent_given, caretaker_consent
- `vyva_user_health` — health_conditions, mobility_needs (isolated for privacy)
- `vyva_user_medications` — medication_name, purpose, dosage, schedule_times
- `vyva_user_checkins` — enabled, frequency, preferred_time
- `vyva_user_brain_coach` — enabled, frequency, preferred_time
- `vyva_user_caregivers` — caretaker_name, caretaker_phone

**RLS:** All tables restricted to authenticated users with admin/operator/coordinator roles via `has_role()`.

**Edge Function: `onboarding-webhook`**
- Accepts POST with API key validation (shared secret)
- Parses payload, validates required fields
- Inserts data across normalized tables in a transaction
- Returns success/error response

**Auth:**
- Invite-only (no public signup) via Supabase admin invite
- Email + password login
- Password reset flow with `/reset-password` page

### Phase 2: Frontend Pages

**Layout:** Sidebar navigation (collapsible), modern colorful design with gradient accents.

1. **Login** — email/password, forgot password link
2. **Dashboard Overview** — stat cards (total users, check-ins enabled, brain coach enabled, medications configured, caregiver consent) + users-by-city bar chart (Recharts)
3. **Users List** — searchable/filterable table; search by name, phone, city, caretaker name; filters for city, post code, check-ins, brain coach, consent, medications, mobility; columns show only non-sensitive data
4. **User Profile** — full detail view with section cards (personal info, address, consent, health, medications, check-ins, brain coach, caregiver)
5. **Invite Admin** — form to invite new admin by email, list existing admins
6. **Reset Password** — new password form accessed via email link

### Phase 3: Data Fetching

- React Query hooks for all data fetching from Supabase
- Dashboard stats via aggregate queries (counts with filters)
- Users list with server-side search/filter
- User profile fetches across all related tables by user ID

### Build Order

1. Connect Supabase, create all tables + RLS + `has_role()` function
2. Create `onboarding-webhook` Edge Function
3. Build auth pages (login, reset password) + auth context
4. Build sidebar layout shell
5. Build dashboard overview with stat cards + chart
6. Build users list with search + filters
7. Build user profile detail page
8. Build invite admin page
9. Seed with sample data for testing

