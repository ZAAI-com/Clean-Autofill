# Chrome Web Store — Permission Justifications

Ready to paste into the Developer Dashboard privacy tab.

---

## `activeTab`

**Justification:**
Required to read the current tab's URL when the user clicks the extension icon. The extension extracts the website's domain from the URL to generate a unique email address (e.g., visiting amazon.com generates amazon.com@yourdomain.com). The tab URL is only accessed at the moment of the click and is not stored or transmitted.

---

## `storage`

**Justification:**
Required to save the user's email domain setting (e.g., "yourdomain.com") in Chrome's sync storage so it persists across browser sessions and syncs across devices. Also used to store email history entries in local storage. No data is transmitted to external servers.

---

## `notifications`

**Justification:**
Required to show brief confirmation notifications when an email address is successfully generated and filled into a form field, or to alert the user if something went wrong (e.g., no email field found on the page).

---

## `identity` + `identity.email`

**Justification:**
Used to detect the user's Chrome profile email address during initial setup. This allows the extension to pre-fill the email domain setting and automatically detect the user's email provider for compatibility information. The email is only read locally and is never transmitted.

---

## Host Permission: `https://dns.google/*`

**Justification:**
Required for MX record lookups via Google's public DNS API (dns.google). When a user enters a custom email domain, the extension queries MX records to detect the email provider (e.g., Gmail, ProtonMail, Fastmail) and determine whether plus addressing is supported. Only the domain name is sent in the DNS query — no personal data is transmitted.

---

## Host Permission: `<all_urls>` (Content Script)

**Justification:**
The content script needs to run on any webpage the user visits in order to fill email addresses into form fields. When the user clicks the extension icon, the content script receives the generated email and fills it into the appropriate input field on the page. The content script only activates when triggered by the user — it does not run automatically or collect any data from pages.

---

## Single Purpose Description

Clean Autofill generates unique email addresses based on website domains and fills them into signup forms with one click, helping users organize their inbox and track data sharing.
