

## Plan: Add German Language Selector with i18n

### Overview
Add a language toggle (EN/DE) to the dashboard header and translate all UI strings across pages. Use a lightweight React Context + translation dictionary approach (no heavy i18n library needed for this scope).

### Architecture

```text
src/
├── contexts/LanguageContext.tsx    ← new: provider + useLanguage hook
├── lib/translations.ts            ← new: EN/DE string dictionaries
├── components/LanguageSelector.tsx ← new: toggle button (EN | DE)
└── (all pages)                    ← updated: use t() function
```

### Changes

**1. Create `src/lib/translations.ts`**
- Define a flat key-value dictionary for EN and DE
- Keys organized by page/section (e.g. `"dashboard.title"`, `"sidebar.users"`, `"login.signIn"`)
- Cover all user-facing strings: sidebar nav labels, page headings, button text, table headers, form labels, filter options, alert messages, stat labels, toasts

**2. Create `src/contexts/LanguageContext.tsx`**
- `LanguageProvider` wrapping the app with state for `"en" | "de"`
- `useLanguage()` hook returning `{ language, setLanguage, t }` where `t(key)` looks up the translation
- Persist selection in `localStorage`

**3. Create `src/components/LanguageSelector.tsx`**
- Small toggle in the dashboard header: two buttons "EN" / "DE" styled as pills
- Uses `useLanguage()` to switch

**4. Update `src/components/DashboardLayout.tsx`**
- Add `LanguageSelector` to the header bar

**5. Update `src/main.tsx` or `src/App.tsx`**
- Wrap app with `LanguageProvider`

**6. Update all pages to use `t()` instead of hardcoded strings**
Pages to update:
- `Login.tsx` — sign in, email, password, forgot password labels
- `ResetPassword.tsx` — set/reset password headings
- `Dashboard.tsx` — stat labels, filter labels, section headings
- `UsersList.tsx` — column headers, search placeholder, status labels
- `UserProfile.tsx` — section headings, field labels
- `InviteAdmin.tsx` — form labels, role names, toast messages
- `EmergencyContacts.tsx` — headings, table headers
- `CheckInMonitoring.tsx` — headings, table headers, status labels
- `Sensors.tsx` — headings, stat labels, chart labels
- `Settings.tsx` — headings, form labels
- `AppSidebar.tsx` — nav item labels
- `PriorityAlertsPanel.tsx` — panel title, alert descriptions
- `OperationsQueuePanel.tsx` — panel title, action labels

### Key German Translations (examples)
| EN | DE |
|---|---|
| Dashboard | Übersicht |
| Users | Benutzer |
| Settings | Einstellungen |
| Sign In | Anmelden |
| Search... | Suche... |
| Active Alerts | Aktive Alarme |
| Sensors | Sensoren |
| Emergency Contacts | Notfallkontakte |
| Check-In Monitoring | Check-In Überwachung |
| Create User | Benutzer erstellen |

### No database changes needed.

### Files
- **New**: `src/lib/translations.ts`, `src/contexts/LanguageContext.tsx`, `src/components/LanguageSelector.tsx`
- **Modified**: `src/App.tsx`, `src/components/DashboardLayout.tsx`, `src/components/AppSidebar.tsx`, `src/pages/Login.tsx`, `src/pages/ResetPassword.tsx`, `src/pages/Dashboard.tsx`, `src/pages/UsersList.tsx`, `src/pages/InviteAdmin.tsx`, `src/pages/EmergencyContacts.tsx`, `src/pages/CheckInMonitoring.tsx`, `src/pages/Sensors.tsx`, `src/pages/Settings.tsx`, `src/components/dashboard/PriorityAlertsPanel.tsx`, `src/components/dashboard/OperationsQueuePanel.tsx`

