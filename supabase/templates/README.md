# Auth email templates

These templates are for the hosted auth provider that currently sends magic-link
emails. They are stored here so the live auth email editor can be updated without
losing the approved VYVA copy and design.

Team member invitations are not sent from this hosted template anymore. The
Replit backend generates the secure Supabase Auth link, renders the contextual
invite email, and sends it through the configured backend email provider.

## Magic link

Use `magic-link.html` for the one-time login / magic-link email template.

Required template variable:

```html
{{ .ConfirmationURL }}
```

The template also reads the language preference from:

```html
{{ .Data.language }}
```

The app sends this value when requesting a magic link. It uses the language
selected in Settings, or the browser language when no setting exists. Supported
values are `en`, `de`, and `es`; the template falls back to English.

The hosted template can still read optional metadata if the fallback Supabase
email sender is ever used:

```html
{{ .Data.invite_type }}
{{ .Data.organization_name }}
{{ .Data.invited_role_label }}
{{ .Data.guide_url }}
{{ .Data.manual_url }}
```

`manual_url` is optional. The template defaults to the published admin manual:
`https://redcross.vyva.life/manuals/VYVA_Admin_Console_User_Manual.pdf`.
Pass `manual_url` when requesting the magic link if a different manual should be
used later.

For the current admin-created team invite flow, update the backend email copy in
`server/index.mjs` instead of editing the hosted Supabase template.

Recommended subject:

```text
{{ if eq .Data.invite_type "team_member" }}{{ if eq .Data.language "de" }}Ihre Einladung zur VYVA Konsole{{ else if eq .Data.language "es" }}Tu invitacion a la consola VYVA{{ else }}Your VYVA console invitation{{ end }}{{ else }}{{ if eq .Data.language "de" }}Ihr VYVA Anmeldelink{{ else if eq .Data.language "es" }}Tu acceso a VYVA{{ else }}Your VYVA sign-in link{{ end }}{{ end }}
```

## Applying it

Paste the full contents of `magic-link.html` into the hosted auth email template
editor for regular one-time login / magic-link emails, then save and send a
fresh test magic link. Existing emails in inboxes will not change.

If a test email still shows the plain "One-time login link" design, the hosted
auth email editor is still using the default template. Paste this file into that
editor again and save before sending another test email.

## Sender settings

To remove Lovable from the sender, configure the auth email sender in the hosted
auth provider or SMTP settings:

- Sender name: `VYVA`
- From email: `no-reply@vyva.life`
- Reply-to email: `support@vyva.life` or the preferred operations inbox

The from email must be on a verified sending domain with SPF, DKIM, and DMARC.
If the hosted auth UI does not expose custom sender/SMTP settings, use a custom
email provider such as Resend, Postmark, or SendGrid and route magic-link emails
through the backend instead of the default `auth.lovable.cloud` sender.
