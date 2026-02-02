# Privacy Policy for Clean Autofill

**Last updated:** January 31, 2026

## Overview

Clean Autofill is a Chrome extension that generates email addresses based on website domains. This policy explains how the extension handles your data.

## Data Collection

**Clean Autofill does not collect any personal data.**

The extension does not:
- Collect or transmit browsing history
- Track your activity across websites
- Use analytics or tracking services
- Send any data to external servers
- Access or store passwords or sensitive information

## Data Storage

The extension stores only one piece of information:

- **Your email domain setting** (e.g., "example.com") — This is stored locally in Chrome's sync storage so your preference persists across browser sessions and syncs across your devices if you're signed into Chrome.

This setting is configured by you in the extension's options page and is never transmitted anywhere.

## How the Extension Works

1. When you click the extension icon, it reads the current tab's URL to extract the website domain
2. It combines that domain with your configured email domain to generate an address (e.g., "amazon.com@example.com")
3. It fills this generated address into an input field on the page

All processing happens locally in your browser. No data leaves your device.

## Permissions Explained

- **activeTab**: Required to read the current tab's URL when you click the extension icon
- **storage**: Required to save your email domain setting
- **notifications**: Required to show confirmation messages when emails are filled
- **Host permissions (<all_urls>)**: Required to inject the email-filling functionality into web pages

## Third Parties

Clean Autofill does not share any data with third parties because it does not collect any data.

## Changes to This Policy

If this privacy policy changes, the updated version will be posted here with a new "Last updated" date.

## Contact

If you have questions about this privacy policy, please visit the [GitHub Issues page](https://github.com/ZAAI-com/Clean-Autofill/issues).
