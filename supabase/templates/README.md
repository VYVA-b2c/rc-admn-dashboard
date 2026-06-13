# Auth email templates

These templates are for the hosted auth provider that sends magic-link emails.
They are stored here so the live auth settings can be updated without losing the
approved VYVA copy and design.

## Magic link

Use `magic-link.html` for the one-time login / magic-link email template.

Required template variable:

```html
{{ .ConfirmationURL }}
```

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
