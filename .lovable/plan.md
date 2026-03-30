

## Plan: Reset Admin Password

The auth logs show your account (`karim.assad@mokadigital.net`, user ID `efaebaf8-f964-40e6-b0e5-04634a04c7c5`) was logging in successfully earlier but is now returning "invalid credentials." The auth service restarted (visible in logs at 06:20:19Z), which may have invalidated the session state.

### Fix

Create a temporary edge function `reset-admin-password` that:
1. Uses `supabase.auth.admin.updateUserById()` with the existing user ID to set a new password
2. Returns the new password
3. Gets deleted after use

### Steps
1. Create `supabase/functions/reset-admin-password/index.ts` — calls `admin.updateUserById("efaebaf8-f964-40e6-b0e5-04634a04c7c5", { password: "VyvaAdmin2026!" })`
2. Deploy and invoke the function
3. Delete the function after confirming it works
4. You log in with: `karim.assad@mokadigital.net` / `VyvaAdmin2026!`

### Files
- **New (temporary)**: `supabase/functions/reset-admin-password/index.ts`

