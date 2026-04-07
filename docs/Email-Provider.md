# Email Provider Compatibility

Clean Autofill supports two email generation modes. Which modes are available depends on your email provider and domain setup.

## Modes

### Plus Addressing

Format: `yourname+website.com@provider.com`

Uses [sub-addressing (RFC 5233)](https://www.rfc-editor.org/rfc/rfc5233) to append the visited site's domain as a tag. Requires an email provider that supports the `+` separator in the local part.

### Catch-All Prefix

Format: `website.com@yourdomain.com`

Uses the visited site's domain as the entire local part. Requires you to own a domain with catch-all email routing configured so that any address `@yourdomain.com` is delivered to your mailbox.

## Provider Support

### Supports Plus Addressing

These providers are known to support `+` sub-addressing:

| Provider | Domains | Notes |
|----------|---------|-------|
| Gmail | `gmail.com`, `googlemail.com` | Full support. Also works with Google Workspace custom domains. |
| Outlook | `outlook.com`, `hotmail.com`, `live.com` | Full support. Also works with Microsoft 365 custom domains. |
| ProtonMail | `protonmail.com`, `proton.me`, `pm.me` | Full support. |
| Fastmail | `fastmail.com` | Full support. Also supports custom domains. |
| iCloud | `icloud.com`, `me.com` | Full support. |
| Zoho Mail | `zoho.com` | Full support. Also works with Zoho Workspace custom domains. |
| mailbox.org | `mailbox.org` | Full support. |
| Hey | `hey.com` | Full support. |

### Does NOT Support Plus Addressing

These providers do not support the `+` separator or have limited/incompatible implementations:

| Provider | Domains | Notes |
|----------|---------|-------|
| Yahoo Mail | `yahoo.com`, `ymail.com` | No `+` support. Uses disposable addresses with a different mechanism. |
| GMX | `gmx.com`, `gmx.de`, `gmx.net` | No `+` support. |
| web.de | `web.de` | No `+` support. |
| mail.com | `mail.com` | No `+` support. |
| T-Online | `t-online.de` | No `+` support. |
| Tuta (Tutanota) | `tuta.com`, `tutanota.com` | No `+` support. Uses its own alias system instead. |

### Custom Domains

If you use a custom domain (e.g., `@company.com`), both modes may be available depending on your email hosting:

- **Plus Addressing** works if your email host supports sub-addressing (Gmail/Google Workspace, Microsoft 365, Fastmail, etc.)
- **Catch-All Prefix** works if you have catch-all routing configured on your domain

## Decision Table

This table shows which modes are available based on what you enter in the extension settings:

| Input | Plus Addressing | Catch-All Prefix | Reason |
|---|:-:|:-:|---|
| `name@gmail.com` | ✅ | ❌ | Gmail supports `+`, but you don't own gmail.com |
| `name@outlook.com` | ✅ | ❌ | Outlook supports `+`, but you don't own outlook.com |
| `name@proton.me` | ✅ | ❌ | Proton supports `+`, but you don't own proton.me |
| `name@fastmail.com` | ✅ | ❌ | Fastmail supports `+`, but you don't own fastmail.com |
| `name@icloud.com` | ✅ | ❌ | iCloud supports `+`, but you don't own icloud.com |
| `name@zoho.com` | ✅ | ❌ | Zoho supports `+`, but you don't own zoho.com |
| `name@mailbox.org` | ✅ | ❌ | mailbox.org supports `+`, but you don't own mailbox.org |
| `name@hey.com` | ✅ | ❌ | Hey supports `+`, but you don't own hey.com |
| `name@yahoo.com` | ⚠️ | ❌ | Yahoo doesn't support `+` addressing |
| `name@gmx.com` | ⚠️ | ❌ | GMX doesn't support `+` addressing |
| `name@web.de` | ⚠️ | ❌ | web.de doesn't support `+` addressing |
| `name@t-online.de` | ⚠️ | ❌ | T-Online doesn't support `+` addressing |
| `name@tuta.com` | ⚠️ | ❌ | Tuta doesn't support `+` addressing |
| `name@company.com` | ✅ | ✅ | Custom domain — both modes possible |
| `mydomain.com` (no `@`) | ❌ | ✅ | No local part provided — only catch-all works |
| *(empty)* | ❌ | ❌ | Nothing configured |

**Legend:** ✅ Available | ⚠️ Warning (may not work) | ❌ Not available

## How the Extension Detects Providers

The extension maintains two lists of known email provider domains. When you enter your email address:

1. If the domain matches a **known provider that supports `+`** → Plus Addressing is available, Catch-All is disabled (you don't own the domain)
2. If the domain matches a **known provider without `+` support** → Plus Addressing shows a warning, Catch-All is disabled
3. If the domain is **not recognized** → treated as a custom domain, both modes are available
4. If **no `@` is present** (just a domain) → only Catch-All is available
