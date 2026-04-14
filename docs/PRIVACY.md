# Privacy Policy for Clean Autofill

**Last updated:** January 31, 2026

## Overview

Clean Autofill is a Chrome extension that generates email addresses based on website domains. This policy explains how the extension handles your data.

## Data Collection

**Clean Autofill does not collect any personal data.** There is no analytics, no tracking, and no data shared with third parties.

The extension does not:
- Collect or transmit browsing history
- Track your activity across websites
- Use analytics or tracking services
- Access or store passwords or sensitive information

## Data Storage

The extension stores the following data locally:

- **Your email settings** (email address or domain, selected mode) — Stored in Chrome's sync storage so your preferences persist across browser sessions and sync across your devices if you're signed into Chrome.
- **Email history** — A log of generated emails (domain, email, timestamp) stored in Chrome's local storage. This data never leaves your device.
- **MX lookup cache** — Cached results of email provider detection (see below). Stored in Chrome's local storage to avoid repeated lookups.

These settings are configured by you in the extension's options page.

## Network Requests

The extension makes one type of network request:

- **MX record lookup** — When you enter a custom domain email in settings, the extension performs a DNS MX record lookup via Google's public DNS API (`https://dns.google/resolve?name=YOUR_DOMAIN&type=MX`) to detect your email provider and determine which email modes are available. **Only the domain portion is sent** (e.g., `yourdomain.com`), never your full email address. Results are cached locally to minimize requests. This lookup is subject to [Google's Privacy Policy](https://policies.google.com/privacy) for their public DNS service.

No other network requests are made by the extension.

## How the Extension Works

1. When you click the extension icon, it reads the current tab's URL to extract the website domain
2. It combines that domain with your configured email to generate a unique address (e.g., `amazon.com@yourdomain.com` or `you+amazon.com@gmail.com`)
3. A popup displays the generated email, which is automatically filled into an input field on the page
4. The generated email is saved to your local history

All processing happens locally in your browser, with the sole exception of the MX record lookup described above.

## Permissions Explained

- **activeTab**: Required to read the current tab's URL when you click the extension icon
- **storage**: Required to save your email settings (sync) and email history + MX cache (local)
- **notifications**: Required to show install and error notifications
- **identity / identity.email**: Required to detect your Chrome profile email for auto-configuration on first install
- **Host permissions (`<all_urls>`)**: Required to inject the email-filling functionality into web pages
- **Host permissions (`https://dns.google/*`)**: Required for MX record lookups to detect email providers on custom domains

## Third Parties

Clean Autofill does not share any personal data with third parties. The only external service contacted is Google's public DNS API for MX record lookups (see [Network Requests](#network-requests)), which receives only the email domain — never your email address or browsing data.

## Changes to This Policy

If this privacy policy changes, the updated version will be posted here with a new "Last updated" date.

## Contact

If you have questions about this privacy policy, please visit the [GitHub Issues page](https://github.com/ZAAI-com/Clean-Autofill/issues).
