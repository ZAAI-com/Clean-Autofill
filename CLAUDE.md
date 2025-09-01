# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MailFiller is a Chrome extension that automatically generates email addresses based on the current website's domain. It combines the main domain of the current website with a user-configured email domain (e.g., `example.com@mg1.de`).

## Build and Development Commands

```bash
# Build and validate the extension
npm run build

# Package extension for distribution
npm run pack

# Validate manifest and files
npm run validate

# Version bumping
npm run bump:patch    # 0.1.0 → 0.1.1
npm run bump:minor    # 0.1.0 → 0.2.0  
npm run bump:major    # 0.1.0 → 1.0.0

# Prepare for release
npm run release       # Runs pack and shows release instructions
```

No test suite is currently configured (package.json shows placeholder test command).

## Architecture

The extension follows Chrome Extension Manifest V3 architecture with three main components:

### 1. Service Worker (`background.js`)
- Handles extension icon clicks via `chrome.action.onClicked`
- Generates email addresses using domain extraction logic in `generateEmailForTab()`
- Manages Chrome storage API for user settings
- Shows notifications for success/error states
- Opens options page on first install

### 2. Content Script (`content.js`)
- Injected into all web pages (`<all_urls>`)
- Receives messages from service worker to fill email fields
- Smart field detection with priority order:
  1. Currently focused input field
  2. Email-specific input fields (type="email", email-related names/ids)
  3. General text input fields
- Handles React/framework compatibility with native input events

### 3. Options Page (`options.html` + `options.js`)
- Settings interface for configuring user's email domain
- Uses Chrome sync storage for cross-device settings

## Key Functions

- `extractMainDomain()` in background.js:712: Removes subdomains and handles special TLDs (.co.uk, .com.au, etc.)
- `fillEmailInField()` in content.js:14: Core email filling logic with field prioritization
- `findEmailFields()` in content.js:67: Detects email input fields using multiple selectors
- `fillInput()` in content.js:124: Handles input filling with proper event dispatching for modern frameworks

## File Structure

```
├── manifest.json          # Extension configuration (MV3)
├── background.js          # Service worker
├── content.js             # Content script for email filling
├── options.html/js        # Settings page
├── scripts/               # Build and utility scripts
│   ├── build.js          # Validates required files
│   ├── pack.js           # Creates distribution package
│   ├── validate.js       # Manifest and file validation
│   └── bump-version.js   # Version management
└── icons/                # Extension icons (16, 32, 48, 128px)
```

## Development Notes

- Extension requires minimal permissions: activeTab, storage, notifications
- Uses Chrome's sync storage for cross-device settings persistence
- Domain extraction handles edge cases like localhost, IP addresses, and special TLDs
- Content script uses multiple fallback strategies for reliable field detection
- Build process validates all required files and manifest structure