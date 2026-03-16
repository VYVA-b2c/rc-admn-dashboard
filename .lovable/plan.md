

## Problem

The sidebar header shows a tiny 36x36px logo (cropped with `object-cover` and `rounded-lg`) next to redundant "VYVA" text and "Super Admin" subtitle. The logo already contains the VYVA branding, so repeating it as text looks bad. The small size also cuts off the logo.

## Plan

**In `src/components/AppSidebar.tsx`:**

1. **Remove the redundant text** — Delete the "VYVA" heading and "Super Admin" subtitle next to the logo
2. **Make the logo larger and fully visible** — Replace the tiny `h-9 w-9 rounded-lg object-cover` img with a larger logo (`h-10 w-auto object-contain`) that shows the full logo without cropping
3. **Center the logo** in the sidebar header when expanded, show a smaller square version when collapsed
4. **Keep "Super Admin" as a subtle badge** below the logo (not next to it) when expanded

**Result:** Clean sidebar header with the full logo displayed prominently, no repeated branding text, and a compact icon when collapsed.

