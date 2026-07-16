# Auth emails — config + branded templates

The dashboard doesn't version email templates; this folder is the source of
truth. If a template needs a tweak, edit it here first, then re-paste.

## 1. Make the reset link land on the app (two values)

Supabase Dashboard → **MC-Peels** → Authentication → **URL Configuration**:

| Field | Value |
|---|---|
| Site URL | `https://mc-peels.secondninelabs.com` |
| Redirect URLs (add both) | `https://mc-peels.secondninelabs.com/reset-password` |
| | `http://localhost:*/reset-password` |

Why: the app already passes the right `redirectTo`; Supabase rejects any URL
not on the allowlist and falls back to Site URL. Until 2026-07-16 the Site URL
was the dev-era `http://localhost:3000` — which on TJ's machine is Third Brain's
dev server, hence the one famous misfire.

> **Done 2026-07-16** via Management API (PATCH /config/auth): Site URL and
> both allowlist entries are live in prod.

## 2. Brand the emails (two pastes)

> **Blocked on free tier (as of 2026-07-16):** Supabase rejects custom
> templates/subjects while the project uses the default email provider —
> `Email template modification is not available for free tier projects using
> the default email provider.` Unlock is either custom SMTP (Resend free tier
> + SPF/DKIM DNS on secondninelabs.com — which also fixes the From address)
> or the Pro plan. The templates below are ready for the moment that lands.

Supabase Dashboard → **MC-Peels** → Authentication → **Email Templates**:

| Template | Subject | Body |
|---|---|---|
| Reset Password | `Reset your MC Peels password` | paste [recovery.html](recovery.html) |
| Confirm signup | `Confirm your MC Peels account` | paste [confirmation.html](confirmation.html) |

Keep `{{ .ConfirmationURL }}` intact — Supabase substitutes the live link there.
Magic Link / Invite / Change Email templates are still stock; reskin them from
the same skeleton when those flows exist.

## Notes

- Recovery links are single-use and expire in an hour; after any config
  change, request a fresh email.
- Emails currently ride Supabase's built-in SMTP: shared `supabase.io` sender
  and a strict per-hour rate limit (a handful of emails). Fine for now; the
  upgrade is custom SMTP (Resend/Postmark) with a `secondninelabs.com` sender
  + SPF/DKIM — that's what makes the From line match the brand.
- Templates are deliberately imageless (clients block remote images by
  default) and emoji-free (house rule). Branding is typographic.
