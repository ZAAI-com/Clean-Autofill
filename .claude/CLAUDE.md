# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Clean-Autofill is a Chrome extension that automatically generates email addresses based on the current website's domain. It combines the main domain of the current website with a user-configured email domain (e.g., `example.com@mg1.de`).

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

### 1. Service Worker (`src/background.js`)
- Handles extension icon clicks via `chrome.action.onClicked`
- Generates email addresses using domain extraction logic in `generateEmailForTab()`
- Manages Chrome storage API for user settings
- Shows notifications for success/error states
- Opens options page on first install

### 2. Content Script (`src/content.js`)
- Injected into all web pages (`<all_urls>`)
- Receives messages from service worker to fill email fields
- Smart field detection with priority order:
  1. Currently focused input field
  2. Email-specific input fields (type="email", email-related names/ids)
  3. General text input fields
- Handles React/framework compatibility with native input events

### 3. Options Page (`src/options.html` + `src/options.js`)
- Settings interface for configuring user's email domain
- Uses Chrome sync storage for cross-device settings

## Key Functions

- `extractMainDomain()` in src/background.js: Removes subdomains and handles special TLDs (.co.uk, .com.au, etc.)
- `fillEmailInField()` in src/content.js: Core email filling logic with field prioritization
- `findEmailFields()` in src/content.js: Detects email input fields using multiple selectors
- `fillInput()` in src/content.js: Handles input filling with proper event dispatching for modern frameworks

## File Structure

```
├── manifest.json          # Extension configuration (MV3)
├── package.json           # NPM configuration
├── src/                   # Extension source code
│   ├── background.js      # Service worker
│   ├── content.js         # Content script for email filling
│   ├── options.html       # Settings page
│   ├── options.js         # Settings logic
│   └── icons/             # Extension icons (16, 32, 48, 128px)
├── tools/                 # Build and utility scripts
│   ├── build.js           # Validates required files
│   ├── pack.js            # Creates distribution package
│   ├── validate.js        # Manifest and file validation
│   └── bump-version.js    # Version management
├── docs/                  # Documentation
└── dist/                  # Build output (gitignored)
    ├── Clean-Autofill/    # Load in Chrome for testing
    └── Clean-Autofill.zip # Upload to Chrome Web Store
```

## Development Notes

- Extension requires minimal permissions: activeTab, storage, notifications
- Uses Chrome's sync storage for cross-device settings persistence
- Domain extraction handles edge cases like localhost, IP addresses, and special TLDs
- Content script uses multiple fallback strategies for reliable field detection
- Build process validates all required files and manifest structure