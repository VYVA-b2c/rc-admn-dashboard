

## Plan: Admin Creates User with Temporary Password

### Overview
Replace the invite-by-email flow with a direct user creation approach. The admin enters an email + temporary password, the backend creates the user immediately, and the admin shares credentials manually.

### Changes

**1. Update Edge Function `supabase/functions/invite-admin/index.ts`**
- Accept `{ email, password, role }` in request body (role defaults to "admin")
- Replace `inviteUserByEmail` with `supabase.auth.admin.createUser({ email, password, email_confirm: true })`
- This creates a confirmed user instantly — no email sent, no link needed
- Still assigns role in `user_roles` table
- Return `{ success: true, email }` on success

**2. Update `src/pages/InviteAdmin.tsx`**
- Add a password input field next to email
- Add a role selector (admin / operator / coordinator) using a Select dropdown
- On submit, send `{ email, password, role }` to the edge function
- On success, show a toast with the credentials so the admin can copy/share them
- Optionally add a "copy credentials" button in the success toast

**3. No database changes needed**
- `user_roles` table already supports admin/operator/coordinator roles
- `profiles` table auto-populates via the `handle_new_user` trigger
- Existing RLS policies cover all access patterns

### Technical Details

Edge function key change:
```typescript
// Replace inviteUserByEmail with:
const { data, error } = await supabase.auth.admin.createUser({
  email,
  password,
  email_confirm: true, // skip email verification
  user_metadata: { role },
});
```

UI form adds:
- Password field (type="password", min 6 chars)
- Role select (admin | operator | coordinator)
- Success feedback with copyable credentials

### Files
- **Modified**: `supabase/functions/invite-admin/index.ts`
- **Modified**: `src/pages/InviteAdmin.tsx`

