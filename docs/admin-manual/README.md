# VYVA Admin Console Manual

This folder is the working home for the admin user manual. Treat the manual as a living product artifact: every console feature that changes admin behavior should update this folder in the same pass.

## Folder Map

- `current/` contains the latest approved DOCX and PDF.
- `versions/YYYY-MM-DD/` contains dated snapshots for release history.
- `source/` contains the editable source outline, feature template, and maintenance notes used for future updates.
- `CHANGELOG.md` records what changed in each manual release.
- `UPDATE_CHECKLIST.md` is the required checklist for every manual update.
- `SCREENSHOT_GUIDELINES.md` defines how screenshots must be captured and sanitized.

## Current Manual

- `current/VYVA_Admin_Console_User_Manual.docx`
- `current/VYVA_Admin_Console_User_Manual.pdf`

The root-level `VYVA_Admin_Console_User_Manual.*` files are convenience copies. The canonical managed copies live in `docs/admin-manual/current/`.

## Public PDF

The client-facing latest PDF is published as a static app asset:

- `/manuals/VYVA_Admin_Console_User_Manual.pdf`

Dated archive PDFs live at:

- `/manuals/archive/VYVA_Admin_Console_User_Manual_VERSION.pdf`

The public manifest is:

- `/manuals/manual-version.json`

Always send clients the stable latest PDF URL, not a dated archive URL.

## Update Rule

When a new console feature is added or an existing workflow changes:

1. Update the relevant source section in `source/manual-outline.md`.
2. Add or revise a feature section using `source/feature-section-template.md`.
3. Capture sanitized screenshots following `SCREENSHOT_GUIDELINES.md`.
4. Regenerate the DOCX and PDF.
5. Replace the files in `current/`.
6. Create a dated or same-day version snapshot in `versions/VERSION/`.
7. Copy the approved latest PDF to `public/manuals/VYVA_Admin_Console_User_Manual.pdf`.
8. Copy the dated archive PDF to `public/manuals/archive/`.
9. Update `public/manuals/manual-version.json`.
10. Add an entry to `CHANGELOG.md`.
11. Complete `UPDATE_CHECKLIST.md` before sharing or publishing.

## Manual Scope

Audience: organization admins.

Language: English.

Data: sanitized demo data only.

Out of scope for this folder: application code changes, route wiring, email template changes, or hosted manual-link configuration.
