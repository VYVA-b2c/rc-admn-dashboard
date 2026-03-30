
Problem
- Your account is authenticating successfully; the backend is returning 200 for password login.
- The failure happens immediately after login: the auth logs show a burst of refresh-token requests, token revocations, and then `429 over_request_rate_limit`.
- That is why it feels like “I log in, then get kicked out.”

Most likely cause
- There are competing/stale sessions hitting auth at the same time. The logs show requests coming from more than one preview origin, which strongly suggests multiple open previews/tabs or old persisted sessions are fighting over the same refresh token.
- The current auth layer does not recover cleanly when a stored session is stale or rate-limited, so the app falls back to `/login` and the next attempt makes the rate limit worse.

Plan to fix
1. Harden auth startup in `src/contexts/AuthContext.tsx`
   - Add a single helper to apply/clear session state.
   - Wrap initial session restore in error handling.
   - If session restore hits refresh-token/rate-limit errors, clear the local session safely and stop the logout loop.

2. Make sign-in recovery-safe in `src/pages/Login.tsx`
   - Clear stale local auth state before a fresh sign-in attempt.
   - Detect `429` errors and show a specific message: wait briefly and close other open previews/tabs.
   - Prevent rapid repeat submits while rate-limited.

3. Stabilize redirects in `src/components/ProtectedRoute.tsx`
   - Only redirect to `/login` after auth initialization/recovery is fully finished.
   - Avoid bouncing the user out during a transient refresh failure.

4. Make manual sign-out local-only
   - Update the auth sign-out flow so signing out in one preview does not revoke every session everywhere.

5. Verify the fix
   - Test with only one preview open: login, reload, navigate, and confirm the session persists.
   - Confirm the refresh-token flood and `rate limit reached` errors stop.

Files to update
- `src/contexts/AuthContext.tsx`
- `src/pages/Login.tsx`
- `src/components/ProtectedRoute.tsx`

Technical notes
- No database changes are needed.
- I will not modify `src/integrations/supabase/client.ts`.
- The console warnings about refs and `<Navigate>` are separate from the auth rate-limit/logout issue and can be cleaned up afterward.
