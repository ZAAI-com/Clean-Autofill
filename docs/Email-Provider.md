# Email Provider Compatibility

Clean Autofill supports two email generation modes. Which modes are available depends on your email provider and domain setup.

## Modes

### Plus Addressing

Format: `yourname+website.com@provider.com`

Uses sub-addressing (based on the concept described in [RFC 5233](https://www.rfc-editor.org/rfc/rfc5233), which defines Sieve filtering for subaddressed emails) to append the visited site's domain as a tag. The `+` separator convention is provider-specific — requires an email provider that supports it. No setup needed; it works automatically.

### Catch-All Prefix

Format: `website.com@yourdomain.com`

Uses the visited site's domain as the entire local part. Requires you to own a domain with catch-all email routing configured so that any address `@yourdomain.com` is delivered to your mailbox.

## Provider Support

### Supports Plus Addressing

| Provider | Domains | Support page | Notes |
|----------|---------|-------------|-------|
| Gmail | `gmail.com`, `googlemail.com` | [Use Gmail aliases](https://support.google.com/mail/answer/22370) | `googlemail.com` is treated as equivalent to `gmail.com`. No setup needed. |
| Google Workspace | Custom domains | [Create a variation of your address](https://support.google.com/a/users/answer/9282734) | Works on any domain hosted on Google Workspace. |
| Microsoft 365 / Exchange Online | Custom domains | [Plus Addressing in Exchange Online](https://learn.microsoft.com/en-us/exchange/recipients-in-exchange-online/plus-addressing-in-exchange-online) | Receive-only; no alias must be created first. |
| Outlook.com / Hotmail / Live | `outlook.com`, `hotmail.com`, `live.com`, `msn.com` | [Add or remove an email alias](https://support.microsoft.com/en-us/office/add-or-remove-an-email-alias-in-outlook-com-459b1989-356d-40fa-a689-8f285b13f1f2) | Microsoft's clearest plus-addressing docs are for Exchange Online. Consumer Outlook.com commonly works with `+tag` but Microsoft's official consumer alias page does not explicitly document it. |
| Proton Mail | `protonmail.com`, `proton.me`, `pm.me`, `protonmail.ch` | [Addresses and aliases](https://proton.me/support/addresses-and-aliases) | Works on Proton addresses and custom domains. |
| Fastmail | `fastmail.com` and 100+ Fastmail-owned domains | [Plus addressing and subdomain addressing](https://www.fastmail.help/hc/en-us/articles/360060591053) | Works automatically for all aliases. Full domain list includes `fastmail.fm`, `pobox.com`, `sent.com`, and many more. |
| mailbox.org | `mailbox.org` | [Using mail extensions](https://kb.mailbox.org/en/private/e-mail/mail-extensions/) | mailbox.org calls this "mail extensions". |
| Yandex Mail | `yandex.com`, `yandex.ru`, `ya.ru` | [Registration (Special email addresses)](https://yandex.com/support/mail/reg.html) | Russian provider. Documented under "Special email addresses". |

### Does NOT Support Plus Addressing

| Provider | Domains | What it offers instead | Support page |
|----------|---------|----------------------|-------------|
| Yahoo Mail | `yahoo.com`, `ymail.com`, `rocketmail.com` | Temporary/disposable email addresses (must be created first) | [Disposable email addresses](https://help.yahoo.com/kb/SLN28815.html) |
| GMX | `gmx.com`, `gmx.de`, `gmx.net` | Created alias addresses | [Alias Addresses](https://support.gmx.com/email/settings/aliasaddresses.html) |
| iCloud Mail | `icloud.com`, `me.com`, `mac.com` | Email aliases and Hide My Email (random relay addresses via iCloud+) | [Email aliases](https://support.apple.com/guide/icloud/add-and-manage-email-aliases-mm6b1a490a/icloud) / [Hide My Email](https://support.apple.com/guide/icloud/what-you-can-do-with-icloud-and-hide-my-email-mme38e1602db/icloud) |
| mail.com | `mail.com`, `email.com` and 100+ novelty domains | Up to 10 alias addresses per account | [Alias Addresses](https://support.mail.com/email/settings/aliasaddresses.html) |
| web.de | `web.de` | Alias addresses (premium only) | [Absenderadressen](https://hilfe.web.de/email/einstellungen/absenderadressen.html) |
| T-Online | `t-online.de` | Additional email addresses | [Zusaetzliche E-Mail-Adresse](https://www.telekom.de/hilfe/apps-dienste/e-mail/konto/weitere-adresse) |
| Tuta (Tutanota) | `tuta.com`, `tutanota.com` | Aliases or custom-domain addresses | [How to use Tuta](https://tuta.com/support/howto) |
| Hey | `hey.com` | Aliases only via HEY for Domains | [Can I create email aliases?](https://help.hey.com/article/928-can-i-create-email-aliases) |
| Mail.ru | `mail.ru`, `inbox.ru`, `list.ru`, `bk.ru` | Anonymous addresses (up to 10) | [Anonymous addresses](https://help.mail.ru/mail/account/aliases/) |
| NetEase | `163.com`, `126.com`, `yeah.net` | | [NetEase Mail Help](https://help.mail.163.com/) |
| QQ Mail | `qq.com`, `foxmail.com` | Alias accounts (up to 10) | [QQ Mail Aliases](https://service.mail.qq.com/detail/0/262) |
| Libero | `libero.it` | Disposable addresses (paid, up to 15/yr) | [Indirizzi usa e getta](https://aiuto.libero.it/articolo/mail-plus/indirizzi-usa-e-getta-alternativi-mail-plus/) |
| La Poste | `laposte.net` | Up to 6 aliases | [Gerer mes alias](https://aide.laposte.net/categories/mon-compte-et-mes-preferences/gerer-mes-alias-et-leur-signature) |
| Rediffmail | `rediffmail.com`, `rediff.com` | | [Rediffmail Help](https://www.rediffmail.com/HELP/main_help.html) |

### Unverified

| Provider | Domains | Status | Notes |
|----------|---------|--------|-------|
| Zoho Mail | `zoho.com`, custom domains | Unverified | Community threads indicate `name+tag@yourdomain.com` may work on custom domains, but no clear official support page was found confirming classic plus addressing. Treated as a custom domain in the extension. |

### Custom Domains

If you use a custom domain (e.g., `@company.com`), both modes may be available depending on your email hosting:

- **Plus Addressing** works if your email host supports sub-addressing (Gmail/Google Workspace, Microsoft 365, Fastmail, etc.)
- **Catch-All Prefix** works if you have catch-all routing configured on your domain

## Decision Table

This table shows which modes are available based on what you enter in the extension settings:

| Input | Plus Addressing | Catch-All Prefix | Reason |
|---|:-:|:-:|---|
| `name@gmail.com` | ✅ | ❌ | Gmail supports `+` |
| `name@outlook.com` | ✅ | ❌ | Outlook supports `+` |
| `name@proton.me` | ✅ | ❌ | Proton supports `+` |
| `name@fastmail.com` | ✅ | ❌ | Fastmail supports `+` |
| `name@mailbox.org` | ✅ | ❌ | mailbox.org supports `+` |
| `name@hey.com` | ✅ | ❌ | Hey supports `+` |
| `name@yahoo.com` | ⚠️ | ❌ | Yahoo doesn't support `+` |
| `name@gmx.com` | ⚠️ | ❌ | GMX doesn't support `+` |
| `name@icloud.com` | ⚠️ | ❌ | iCloud doesn't support `+` |
| `name@mail.com` | ⚠️ | ❌ | mail.com doesn't support `+` |
| `name@web.de` | ⚠️ | ❌ | web.de doesn't support `+` |
| `name@t-online.de` | ⚠️ | ❌ | T-Online doesn't support `+` |
| `name@tuta.com` | ⚠️ | ❌ | Tuta doesn't support `+` |
| `name@company.com` | ✅ | ✅ | Custom domain, both modes possible |
| `mydomain.com` (no `@`) | ❌ | ✅ | No local part, only catch-all |
| *(empty)* | ❌ | ❌ | Nothing configured |

**Legend:** ✅ Available | ⚠️ Warning (may not work) | ❌ Not available

## Known Limitations of Plus Addressing

### Some websites reject the `+` character

Although `+` is a valid character in email addresses per RFC 5321, some websites incorrectly reject it during signup or login. Common behaviors:

- **Validation error**: The form shows "Invalid email address" when `+` is present
- **Silent stripping**: The site accepts the email but removes everything from `+` to `@`, so `name+site@gmail.com` becomes `name@gmail.com`
- **Blocking on login**: The account was created with `+` but the login form rejects it

This is a limitation of the website, not of the email provider or this extension. There is no workaround other than contacting the website or using Catch-All Prefix mode instead.

### Gmail dot trick

Gmail ignores dots in the local part: `f.i.r.s.t.l.a.s.t@gmail.com` is the same as `firstlast@gmail.com`. This is a Gmail-specific behavior and is not related to plus addressing.

## How the Extension Detects Providers

The extension maintains two lists of known email provider domains in `src/email/provider-domains.ts`. When you enter your email address:

1. If the domain matches a **known provider that supports `+`** (Gmail, Outlook, Proton, Fastmail, mailbox.org, Hey) the Plus Addressing column is available and Catch-All is disabled
2. If the domain matches a **known provider without `+` support** (Yahoo, GMX, iCloud, mail.com, web.de, T-Online, Tuta) the Plus Addressing column shows a warning and Catch-All is disabled
3. If the domain is **not recognized** it is treated as a custom domain and both modes are available
4. If **no `@` is present** (just a domain) only Catch-All is available
