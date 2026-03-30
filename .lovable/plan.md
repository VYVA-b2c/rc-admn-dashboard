

## Plan: Replace VYVA Logo with DRK + "Powered by VYVA"

### Changes

**1. Add DRK Logo SVG (`src/assets/drk-logo.svg`)**
Create an inline SVG of the standard DRK (Deutsches Rotes Kreuz) red cross emblem — a white cross on a red circular background, clean and scalable.

**2. Update `src/components/AppSidebar.tsx`**
- Import DRK logo instead of VYVA logo as the main sidebar logo
- Change alt text to "DRK Sachsen"
- Add a small "Powered by VYVA" text below the logo (visible when sidebar is expanded), styled in muted foreground at ~8px, with subtle opacity

**3. Update `src/pages/Login.tsx`**
- Replace VYVA logo with DRK logo as the main visual
- Change subtitle from "Super Admin Dashboard" to "DRK Sachsen — Admin Dashboard"
- Add a "Powered by VYVA" footer line below the card, small and subtle

**4. Update `src/components/DashboardLayout.tsx`**
- Change header title from "VYVA Admin" to "DRK Sachsen"

### Design
- DRK logo is prominent (main brand)
- "Powered by VYVA" appears as a small, muted footnote — not competing with DRK branding
- Keep existing VYVA color palette and design system intact

### Files
- **New**: `src/assets/drk-logo.svg`
- **Modified**: `src/components/AppSidebar.tsx`, `src/pages/Login.tsx`, `src/components/DashboardLayout.tsx`

