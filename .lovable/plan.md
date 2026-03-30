

## Plan: Create First Admin Account

### What
Create the first admin user account with email `karim.assad@mokadigital.net` so you can log into the dashboard.

### Steps

1. **Create an edge function `create-first-admin`** that:
   - Checks if any admin users exist yet (if admins already exist, reject the request)
   - Creates a new auth user with the provided email and a temporary password
   - Inserts an `admin` role into `user_roles` for that user
   - Returns the temporary password so you can log in

2. **Invoke the function** to create the account with email `karim.assad@mokadigital.net`

3. **Enable auto-confirm** for email signups temporarily so you can log in without email verification

4. **You log in** with the temporary password, then change it from within the app

### Technical Details
- The edge function uses the service role key to call `supabase.auth.admin.createUser()` with `email_confirm: true`
- A temporary password will be generated and returned
- After account creation, the edge function can be deleted (it's a one-time bootstrap)
- The `user_roles` insert assigns `role: 'admin'`

### Files
- **New**: `supabase/functions/create-first-admin/index.ts` (temporary, deleted after use)
- **Config**: Enable auto-confirm via `cloud--configure_auth`

