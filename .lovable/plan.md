

## Plan: Add Emergency Contacts Page and Check-In Monitoring Page

### E. Emergency Contacts Page (`/emergency-contacts`)

**Purpose:** Dedicated view for DRK operators to quickly find caregiver/emergency contact details per user.

**Data source:** `vyva_user_caregivers` joined with `vyva_users` (for user name/phone).

**UI:**
- Page title "Emergency Contacts"
- Search bar (by user name, caregiver name, caregiver phone)
- Table columns: User Name, User Phone, Caregiver Name, Caregiver Phone, City
- Click row navigates to user profile
- Empty state when no data

**Files:**
- Create `src/pages/EmergencyContacts.tsx`

---

### F. Check-In Monitoring Page (`/checkin-monitoring`)

**Purpose:** DRK coordinators can oversee scheduled check-ins and identify users needing follow-up.

**Data source:** `vyva_user_checkins` joined with `vyva_users`.

**UI:**
- Page title "Check-In Monitoring"
- 3 summary stat cards at top: Total Scheduled, Active Check-ins, Inactive Check-ins
- Search bar (by user name, city)
- Filter tabs or dropdown: All / Active / Inactive
- Table columns: User Name, Phone, City, Status (Active/Inactive badge), Frequency, Preferred Time
- Click row navigates to user profile

**Files:**
- Create `src/pages/CheckInMonitoring.tsx`

---

### Shared Changes

**`src/components/AppSidebar.tsx`:** Add two new nav items:
- "Emergency Contacts" with `Phone` icon, route `/emergency-contacts`
- "Check-In Monitoring" with `PhoneCall` icon, route `/checkin-monitoring`

**`src/App.tsx`:** Add two new protected routes wrapping the new pages in `DashboardLayout`.

---

### Build Order

1. Create `EmergencyContacts.tsx` — query caregivers + users, render searchable table
2. Create `CheckInMonitoring.tsx` — query checkins + users, render stat cards + filterable table
3. Update `AppSidebar.tsx` — add nav items
4. Update `App.tsx` — add routes

