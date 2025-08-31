# MailFiller Chrome Extension

A Chrome extension that automatically generates and fills email addresses based on the current website's domain.

## Features

- **Automatic Email Generation**: Creates email addresses in the format `domain@your-email-domain`
- **Smart Field Detection**: Automatically fills the currently focused text field or finds email input fields
- **Easy Configuration**: Simple settings page to configure your email domain
- **Clean UI**: Modern, user-friendly interface

## How It Works

When you visit a website, MailFiller creates an email address by combining:
- The current website's domain (e.g., `example.com`)
- Your configured email domain (e.g., `mg1.de`)
- Result: `example.com@mg1.de`

## Installation

### Developer Mode Installation (For Testing)

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" in the top right corner
3. Click "Load unpacked"
4. Select the MailFiller directory
5. The extension will appear in your extensions bar

### First-Time Setup

1. After installing, the extension will automatically open the settings page
2. Enter your email domain (e.g., `mg1.de`)
3. Click "Save Settings"
4. You can access settings later by right-clicking the extension icon and selecting "Options"

## Usage

1. **Navigate to any website**
2. **Click on a text field** where you want to enter an email (or let the extension find email fields automatically)
3. **Click the MailFiller icon** in your extensions bar - the email will be filled immediately!

The extension will:
- First try to fill the currently focused field
- If no field is focused, it will look for email input fields
- As a fallback, it will find any suitable text input field
- Show a notification with the filled email address
- Show error notifications if something goes wrong

## File Structure

```
MailFiller/
├── manifest.json          # Extension configuration
├── background.js          # Service worker for handling icon clicks
├── content.js             # Content script for filling emails
├── options.html           # Settings page HTML
├── options.js             # Settings page logic
├── icons/                 # Extension icons
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
└── README.md              # This file
```

## Permissions

The extension requires minimal permissions:
- **activeTab**: To interact with the current tab
- **storage**: To save your email domain preference
- **notifications**: To show success/error messages

## Privacy

- No data is collected or transmitted
- Your email domain is stored locally in Chrome's sync storage
- The extension only runs when you click on it

## Troubleshooting

### Email not filling?
- Make sure you have set your email domain in settings
- Click on the text field first before using the extension
- Some websites may have special protections against automated filling

### Settings not saving?
- Check that you're entering a valid domain format (e.g., `example.com`)
- Don't include the @ symbol in your domain

## Future Improvements

- Multiple email domain profiles
- Keyboard shortcuts
- Auto-fill on field focus
- Custom email formats
- Domain aliases

## License

This extension is provided as-is for personal use.
