# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Clean-Autofill is a Chrome extension that automatically generates email addresses based on the current website's domain. It combines the main domain of the current website with a user-configured email domain (e.g., `example.com@mg1.de`).

## Build and Development Commands

```bash
# Build extension (compile TypeScript + copy assets to dist/)
bun run build

# Run tests (251 tests with DOM support)
bun run test

# Run tests in watch mode
bun run test:watch

# Lint and format check
bun run check

# Lint and format fix
bun run check:fix

# TypeScript type check only
bun run typecheck

# Package extension for distribution
bun run pack

# Version bumping
bun run bump:patch    # 0.1.0 → 0.1.1
bun run bump:minor    # 0.1.0 → 0.2.0
bun run bump:major    # 0.1.0 → 1.0.0
```

## Tech Stack

- **TypeScript** - Strict mode, compiles to `dist/`
- **Biome** - Linting and formatting (single tool, replaces ESLint + Prettier)
- **Bun** - Test runner with happy-dom for DOM testing
- **Husky** - Pre-commit hooks for automated checks
- **GitHub Actions** - CI/CD pipeline for automated testing
- **Chrome Extension Manifest V3**

## Architecture

The extension follows Chrome Extension Manifest V3 architecture with three main components:

### 1. Service Worker (`src/background.ts`)
- Handles messages from popup via `chrome.runtime.onMessage`
- Generates email addresses using domain extraction logic in `generateEmailForTab()`
- Sends fill requests to content script and returns results to popup
- Saves generated emails to history via `src/history.ts`
- Manages Chrome storage API for user settings
- Opens options page on first install

### 2. Content Script (`src/content.ts`)
- Injected into all web pages (`<all_urls>`)
- Receives messages from service worker to fill email fields
- Smart field detection with priority order:
  1. Currently focused input field
  2. Email-specific input fields (type="email", email-related names/ids)
  3. General text input fields
- Handles React/framework compatibility with native input events

### 3. Popup (`src/ui/popup.html` + `src/ui/popup.ts`)
- Opens on extension icon click
- Triggers email generation and autofill via message to background
- Displays the generated email with a Copy button
- Shows config prompt if email domain not set

### 4. Options Page (`src/ui/options.html` + `src/ui/options.ts`)
- Sidebar navigation with three pages: Home, Settings, History
- **Home**: Extension explanation and usage examples
- **Settings**: Email domain configuration, mode selection, Chrome profile import
- **History**: Searchable log of all generated emails with copy/delete actions
- Settings use Chrome sync storage; history uses Chrome local storage

### 5. History Module (`src/history.ts`)
- CRUD operations for email history entries stored in `chrome.storage.local`
- `addEntry()` - Save new entry (prepend, enforce 10K limit)
- `getHistory()` - Query with optional search filter and pagination
- `deleteEntry()` / `clearHistory()` - Deletion

### 6. Shared Utilities (`src/utils.ts`)
- `extractMainDomain()` - Removes subdomains and handles special TLDs (.co.uk, .com.au, etc.)
- `isValidEmail()` - Basic email format validation
- `createTimeout()` - Promise-based timeout for async operations
- `debounce()` - Rate-limiting for input events

## File Structure

```
├── manifest.json          # Extension configuration (MV3) - paths relative to dist/
├── package.json           # NPM/Bun configuration
├── .github/
│   └── workflows/
│       └── ci.yml         # GitHub Actions CI pipeline
├── toolkit/
│   ├── biome/
│   │   └── biome.json     # Biome linter/formatter config
│   ├── bun/
│   │   └── bunfig.toml    # Bun test configuration (DOM support)
│   ├── typescript/
│   │   └── tsconfig.json  # TypeScript configuration
│   ├── husky/
│   │   └── pre-commit     # Pre-commit hook (typecheck, lint, test)
│   └── scripts/           # Build scripts
│       ├── build.js       # Compiles TS + copies assets to dist/
│       ├── pack.js        # Creates distribution zip
│       ├── validate.js    # Manifest validation
│       └── bump-version.js # Version management
├── src/                   # TypeScript source (edit these)
│   ├── background.ts      # Service worker
│   ├── background.test.ts # Service worker tests
│   ├── content.ts         # Content script for email filling
│   ├── content.test.ts    # Content script tests
│   ├── history.ts         # Email history storage module
│   ├── history.test.ts    # History module tests
│   ├── utils.ts           # Shared utilities
│   ├── utils.test.ts      # Utility tests
│   ├── test-setup.ts      # DOM test setup (happy-dom)
│   ├── types/
│   │   └── index.ts       # TypeScript type definitions
│   ├── ui/                # UI pages (popup + options)
│   │   ├── popup.html     # Popup UI
│   │   ├── popup.ts       # Popup logic
│   │   ├── popup.test.ts  # Popup tests
│   │   ├── options.html   # Options page UI (sidebar: Home, Settings, History)
│   │   ├── options.ts     # Options page logic
│   │   └── options.test.ts # Options page tests
│   └── icons/             # Extension icons (16, 32, 48, 128px)
└── dist/                  # Build output (load this in Chrome)
    ├── background.js      # Compiled service worker
    ├── content.js         # Compiled content script
    ├── history.js         # Compiled history module
    ├── utils.js           # Compiled utilities
    ├── manifest.json      # Copied from root
    ├── ui/                # Compiled UI pages
    │   ├── popup.html
    │   ├── popup.js
    │   ├── options.html
    │   └── options.js
    ├── icons/             # Copied from src/
    └── Clean-Autofill.zip # Distribution package
```

## Development Workflow

1. Edit TypeScript files in `src/`
2. Run `bun run build` to compile to `dist/`
3. Load `dist/` folder in Chrome (chrome://extensions, Developer mode)
4. Run `bun run test` to verify changes
5. Run `bun run check` before committing

## Testing

Tests are colocated with source files (`*.test.ts`). DOM testing is supported via happy-dom.

```bash
bun run test              # Run all 251 tests
bun run test:watch         # Watch mode
bun run test:coverage      # Coverage report (98%+ line coverage)
```

## Pre-commit Hooks

Husky runs automated checks before each commit:
1. TypeScript type checking
2. Biome lint and format check
3. Full test suite

To skip hooks in emergencies: `git commit --no-verify`

## CI/CD

GitHub Actions runs on push/PR to main:
- Type checking
- Linting and formatting
- Test suite
- Build validation

## Development Notes

- Extension permissions: activeTab, storage, notifications, identity, identity.email
- Uses Chrome's sync storage for settings, local storage for email history
- Domain extraction handles edge cases like localhost, IP addresses, and special TLDs
- Content script uses multiple fallback strategies for reliable field detection
- TypeScript source in `src/`, compiled output in `dist/`
- Only edit `.ts` files; `.js` files in `dist/` are auto-generated
