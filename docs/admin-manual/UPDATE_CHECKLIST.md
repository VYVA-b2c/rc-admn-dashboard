# Admin Manual Update Checklist

Use this checklist whenever a console feature ships, changes, or is removed.

## Latest Update Review: 2026-06-18.2

- [x] Check-in adherence purpose, usage, read-only behavior, expected statuses, and common mistakes are documented.
- [x] Last check-in status label behavior is documented for the client profile.
- [x] DOCX, current PDF, public PDF, archive PDF, version snapshot, changelog, and public manifest are updated.
- [x] The new addendum page was rendered and visually checked.
- [ ] Full screenshot recapture for Check-in adherence is still pending for the next scheduled manual refresh.

## Feature Coverage

- [ ] Feature purpose is documented.
- [ ] "When to use it" is documented.
- [ ] Step-by-step admin instructions are documented.
- [ ] Admin, operator, and platform-admin permission impact is checked.
- [ ] Editable fields and disabled/read-only states are explained.
- [ ] Expected result is documented.
- [ ] Common mistakes or validation errors are documented.
- [ ] Related routes/sidebar labels still match the app.
- [ ] Any backend limitations are stated clearly.

## Screenshots

- [ ] Screenshots use sanitized demo data only.
- [ ] No real names, emails, phone numbers, addresses, medical details, or free-text notes are visible.
- [ ] Screenshots are not loading, blank, clipped, or showing temporary skeleton UI.
- [ ] Dialog screenshots show the real final state or an explicitly sanitized UI example.
- [ ] Captions explain what the screenshot shows.

## Output Files

- [ ] `current/VYVA_Admin_Console_User_Manual.docx` is updated.
- [ ] `current/VYVA_Admin_Console_User_Manual.pdf` is updated.
- [ ] A dated copy exists in `versions/YYYY-MM-DD/`.
- [ ] The latest public PDF is updated at `public/manuals/VYVA_Admin_Console_User_Manual.pdf`.
- [ ] The dated public archive PDF exists in `public/manuals/archive/`.
- [ ] `public/manuals/manual-version.json` is updated.
- [ ] Root convenience copies are updated if the user needs them.
- [ ] `CHANGELOG.md` has a dated entry.

## Quality Gate

- [ ] PDF pages are rendered and visually checked.
- [ ] No clipped text, overlapping content, bad page breaks, unreadable screenshots, or crowded tables.
- [ ] Links/table of contents are checked where applicable.
- [ ] The manual still uses English only.
- [ ] The update did not modify app code, routes, email templates, or hosted manual links unless requested separately.
