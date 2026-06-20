# 2026-06-20 Latest Add-ons

This source note captures the console behavior that must be reflected in the current admin manual.

## Access and organization

- Login is email-only. Admins enter one email address and receive a magic link.
- Google and Microsoft OAuth are hidden for now.
- Replit stores organization, role, team, and console data. Supabase Auth is used only as the email-link identity layer.
- Superadmins are backend-managed and can switch organizations.
- Organization context must filter dashboard, clients, campaigns, check-ins, Brain Coach, risk, emergency contacts, staff, and reports.
- Red Cross Zamora defaults to Spanish, Spain, and Europe/Madrid.
- Red Cross Leipzig defaults to German, Germany, and Europe/Berlin.
- Phone/address routing is strict: Spanish numbers/addresses route to Zamora, German numbers/addresses route to Leipzig.

## Clients and care profile

- The care-recipient workflow is called Clients.
- The Clients page supports Add client, Import clients, and API intake.
- Client profile includes key data, care coverage, medical and check-in settings, activity timeline, and read-only gateway-required outreach actions.
- Emergency contacts are personal support contacts captured during onboarding, inbound calls, or client intake.
- Red Cross staff are professional staff and are assigned separately.

## Follow-up modules

- Check-ins is for check-up calls only.
- Brain Coach has its own sessions page and report page.
- Medication includes per-client medication plans and adherence calendar.
- Last check-in/session/status values should come from recorded activity, not static configuration.

## Campaigns

- Campaigns is a VYVA call campaign workspace, not a generic multi-channel tool.
- Admins choose fixed templates or create a custom campaign.
- AI assist can draft a campaign script from a short purpose statement.
- Smart targeting supports geography, risk level, health condition, assigned provider, consent, and phone eligibility.
- Admins preview recipients before saving, scheduling, or queueing.
- Real outbound calling stays behind a voice connector guard.

## Risk, sensors, and reports

- Risk replaces the old Risk Queue label.
- Risk metrics should explain how numbers are calculated.
- Alerts is now Sensors.
- Dashboard metrics should describe the time period and source logic, especially weekly check-ins and medication items needing confirmation.
