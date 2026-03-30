
Goal: stabilize admin login so it stops immediately logging out and hitting refresh-token rate limits.

What I found
- Your backend auth is accepting the password login. The logs show successful `grant_type=password` requests with status 200 for `karim.assad@mokadigital.net`.
- The breakage happens right after that: there is a rapid loop of `refresh_token` requests, token revocations, and `429 over_request_rate_limit`.
- In the current frontend auth code, `signIn()` manually deletes the auth storage key before calling `signInWithPassword()`. That is risky because it interferes with the auth client’s own session lifecycle.
- The preview environment is also likely amplifying the issue. The provided platform note says preview auth POST requests can misbehave, so even correct auth code may look broken there.

Implementation plan

1. Fix auth state handling in `src/contexts/AuthContext.tsx`
- Remove the manual `localStorage.removeItem(...)` call before `signInWithPassword()`
- Stop manually clearing the auth storage key on normal flows unless there is a confirmed unrecoverable restore error
- Keep `onAuthStateChange` registered before `getSession()`, but make session application idempotent and avoid extra state churn
- Handle sign-out by using the auth client only, then clear local React state cleanly

2. Make route guards less trigger-happy
- Update `src/components/ProtectedRoute.tsx` so it does not instantly redirect during transient session hydration
- Use the actual `session` presence, not just `user`, if needed to avoid brief null states causing route bounces

3. Improve login page behavior
- In `src/pages/Login.tsx`, avoid adding more client-side churn during sign-in
- Keep the local 30-second cooldown messaging, but make sure it only reflects true auth errors from the client
- Add clearer messaging that preview can be unreliable if the session still fails after a confirmed successful password login

4. Verify settings/reset flows don’t destabilize the session
- Ensure password update flows in `src/pages/Settings.tsx` and `src/pages/ResetPassword.tsx` do not rely on stale session assumptions
- Keep the user signed in after password change where possible, without forcing unnecessary redirects

5. Add lightweight diagnostics
- Add a few targeted `console.log` / `console.warn` statements around auth events and session restoration
- This will let the next round of logs confirm whether the refresh storm is gone without changing backend behavior

6. Validation approach
- First validate logically against the code paths
- Then, once implemented, test on the preview
- If preview still shows auth instability but logs show successful login + sane session handling, the fallback conclusion is platform preview auth interference rather than broken app code

Expected outcome
- No more forced local token wiping before login
- Fewer token revocations / refresh storms
- More stable session persistence after sign-in
- Clear separation between app-level auth bugs and preview-only platform issues

Files to update
- `src/contexts/AuthContext.tsx`
- `src/components/ProtectedRoute.tsx`
- `src/pages/Login.tsx`
- potentially `src/pages/Settings.tsx`
- potentially `src/pages/ResetPassword.tsx`

Technical note
- Do not try to solve this with CORS changes, backend auth config changes, or fetch overrides. The issue is frontend session handling plus possible preview auth instability.
- If needed afterward, we should publish the app and test login there, because preview is explicitly known to be a bad signal for this class of auth bug.
