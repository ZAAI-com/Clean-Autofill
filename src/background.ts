// Import shared utilities as ES module
import { extractMainDomain, createTimeout } from './utils.js';
import type { FillEmailResponse } from './types';

// Message timeout in milliseconds
const MESSAGE_TIMEOUT = 5000;

// Handle extension icon clicks
chrome.action.onClicked.addListener(async (tab) => {
  try {
    // Generate email for current tab
    const email = await generateEmailForTab(tab);

    if (!email) {
      // Show notification if no email domain is set
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: 'Clean-Autofill',
        message: 'Please set your email domain in extension options first.',
      });

      // Open options page
      chrome.runtime.openOptionsPage();
      return;
    }

    // Guard against undefined tab.id
    if (tab.id === undefined) {
      throw new Error('Unable to get tab ID');
    }

    // Send message to content script with timeout
    const response = (await Promise.race([
      chrome.tabs.sendMessage(tab.id, {
        action: 'fillEmail',
        email: email,
      }),
      createTimeout(MESSAGE_TIMEOUT, 'Content script did not respond. Please refresh the page.'),
    ])) as FillEmailResponse;

    if (response?.success) {
      // No input field found - just log, don't show notification
      if (response.message === 'No input field found') {
        console.log('Clean-Autofill: No input field found on this page');
        return;
      }

      // Show success notification
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: 'Clean-Autofill',
        message: `Email filled: ${email}`,
      });
    } else {
      throw new Error(response?.error || 'Failed to fill email');
    }
  } catch (error) {
    console.error('Clean-Autofill error:', error);

    // Show error notification
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: 'Clean-Autofill Error',
      message: error instanceof Error ? error.message : 'Failed to fill email',
    });
  }
});

// Generate email based on current tab and user settings
async function generateEmailForTab(tab: chrome.tabs.Tab): Promise<string | null> {
  // Get user's email domain from storage with error handling
  let userDomain: string | undefined;
  try {
    const result = await chrome.storage.sync.get(['emailDomain']);
    userDomain = result.emailDomain as string | undefined;
  } catch (error) {
    console.error('Failed to read storage:', error);
    throw new Error('Unable to read settings. Please try again.');
  }

  if (!userDomain) {
    return null; // No domain configured
  }

  // Extract domain from tab URL
  if (!tab || !tab.url) {
    throw new Error('Unable to get current website domain');
  }

  // Skip chrome:// and extension:// URLs
  if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
    throw new Error('Cannot generate email for browser pages');
  }

  try {
    const url = new URL(tab.url);
    // Extract only the main domain (without subdomains)
    const domain = extractMainDomain(url.hostname);

    // Generate email
    return `${domain}@${userDomain}`;
  } catch {
    throw new Error('Unable to parse current website URL');
  }
}

// Install event - show welcome message
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: 'Clean-Autofill Installed',
      message: 'Click the extension icon to fill emails! Configure your domain in options first.',
    });

    // Open options page on first install
    chrome.runtime.openOptionsPage();
  }
});
