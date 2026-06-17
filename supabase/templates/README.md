# Auth email templates

These templates are for the hosted auth provider that currently sends magic-link
emails. They are stored here so the live auth email editor can be updated without
losing the approved VYVA copy and design.

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

Team invite emails also read optional metadata sent by the admin console:

```html
{{ .Data.invite_type }}
{{ .Data.organization_name }}
{{ .Data.invited_role_label }}
{{ .Data.guide_url }}
```

When `invite_type` is `team_member`, the template explains that the recipient
has been added to the console for the named organization and links to the team
access guide.

Recommended subject:

```text
{{ if eq .Data.invite_type "team_member" }}{{ if eq .Data.language "de" }}Ihre Einladung zur VYVA Konsole{{ else if eq .Data.language "es" }}Tu invitacion a la consola VYVA{{ else }}Your VYVA console invitation{{ end }}{{ else }}{{ if eq .Data.language "de" }}Ihr VYVA Anmeldelink{{ else if eq .Data.language "es" }}Tu acceso a VYVA{{ else }}Your VYVA sign-in link{{ end }}{{ end }}
```

## Applying it now

Paste the full contents of `magic-link.html` into the hosted auth email template
editor for the one-time login / magic-link email, then save and send a fresh
test magic link. Existing emails in inboxes will not change.

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
