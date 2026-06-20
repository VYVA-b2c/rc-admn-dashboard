# Admin Manual Update Checklist

Use this checklist whenever a console feature ships, changes, or is removed.

## Latest Update Review: 2026-06-20

- [x] Email-only login, organization-aware access, and role behavior are documented.
- [x] Clients, Add client, CSV import, API intake, and client profile workflows are documented.
- [x] Emergency Contacts are documented separately from Red Cross staff.
- [x] Check-ins, Brain Coach, Medication adherence, Risk, Sensors, Campaigns, and Reports are refreshed for the current console.
- [x] DOCX, current PDF, public PDF, archive PDF, version snapshot, changelog, and public manifest are updated.
- [ ] Full screenshot recapture is still pending for the next visual manual refresh.

## Feature Coverage

- [x] Feature purpose is documented.
- [x] "When to use it" is documented.
- [x] Step-by-step admin instructions are documented.
- [x] Admin, operator, and platform-admin permission impact is checked.
- [x] Editable fields and disabled/read-only states are explained.
- [x] Expected result is documented.
- [x] Common mistakes or validation errors are documented.
- [x] Related routes/sidebar labels still match the app.
- [x] Any backend limitations are stated clearly.

## Screenshots

- [ ] Screenshots use sanitized demo data only.
- [ ] No real names, emails, phone numbers, addresses, medical details, or free-text notes are visible.
- [ ] Screenshots are not loading, blank, clipped, or showing temporary skeleton UI.
- [ ] Dialog screenshots show the real final state or an explicitly sanitized UI example.
- [ ] Captions explain what the screenshot shows.

## Output Files

- [x] `current/VYVA_Admin_Console_User_Manual.docx` is updated.
- [x] `current/VYVA_Admin_Console_User_Manual.pdf` is updated.
- [x] A dated copy exists in `versions/YYYY-MM-DD/`.
- [x] The latest public PDF is updated at `public/manuals/VYVA_Admin_Console_User_Manual.pdf`.
- [x] The dated public archive PDF exists in `public/manuals/archive/`.
- [x] `public/manuals/manual-version.json` is updated.
- [x] Root convenience copies are updated if the user needs them.
- [x] `CHANGELOG.md` has a dated entry.

## Quality Gate

- [ ] PDF pages are rendered and visually checked.
- [ ] No clipped text, overlapping content, bad page breaks, unreadable screenshots, or crowded tables.
- [ ] Links/table of contents are checked where applicable.
- [x] The manual still uses English only.
- [x] The update did not modify app code, routes, email templates, or hosted manual links unless requested separately.
