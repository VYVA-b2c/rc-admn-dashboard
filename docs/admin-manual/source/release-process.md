# Manual Release Process

Use this process for each manual release.

## 1. Confirm Product Scope

- Review changed routes, sidebar labels, dialogs, permissions, and validation behavior.
- Confirm whether the feature is admin-only, operator-visible, or platform-admin-only.
- Confirm backend limitations that must be called out.

## 2. Update Source

- Update `manual-outline.md`.
- Add or revise feature sections using `feature-section-template.md`.
- Keep every section in the format: purpose, when to use, steps, admin edits, expected result, common mistakes.

## 3. Refresh Screenshots

- Use sanitized demo data.
- Replace loading or skeleton captures.
- Keep screenshots visually consistent.
- Check every screenshot before embedding.

## 4. Build Outputs

- Generate DOCX.
- Generate PDF.
- Update `current/`.
- Add a dated copy to `versions/YYYY-MM-DD/`.

## 5. Quality Review

- Render the PDF pages and inspect them.
- Check page breaks, captions, tables, and screenshot readability.
- Check the changelog and checklist.

## 6. Publish Or Hand Off

- Share the PDF for normal admin use.
- Share DOCX when reviewers need editable comments or copy changes.
- Wire a console/manual link only in a separate app-code pass.
