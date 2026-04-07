// Import shared utilities as ES module

import type { EmailMode, FillEmailResponse } from './types';
import { createTimeout, extractMainDomain } from './utils.js';

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
        message: 'Please configure your email in extension options first.',
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
      // Show success notification
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: 'Clean-Autofill',
        message: `Email filled: ${email}`,
      });
    } else if (response?.error) {
      throw new Error(response.error);
    }
    // If no response, no frame found a field - silently do nothing
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to fill email';

    // Handle "Receiving end does not exist" - content script not loaded
    if (errorMessage.includes('Receiving end does not exist')) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: 'Clean-Autofill',
        message: 'Please refresh the page and try again.',
      });
      return;
    }

    // Handle timeout (no frame responded = no field found)
    if (errorMessage.includes('Content script did not respond')) {
      console.log('Clean-Autofill: No input field found on this page');
      return;
    }

    console.error('Clean-Autofill error:', error);

    // Show error notification for actual errors
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: 'Clean-Autofill Error',
      message: errorMessage,
    });
  }
});

/**
 * Generate an email address based on the current tab's domain and user settings.
 * Combines the site's main domain with the user's configured email domain.
 * @param tab - The Chrome tab to generate the email for
 * @returns The generated email address, or null if no domain is configured
 * @throws Error if unable to read settings or parse the tab URL
 */
async function generateEmailForTab(tab: chrome.tabs.Tab): Promise<string | null> {
  // Get user settings from storage
  let mode: EmailMode;
  let userDomain: string | undefined;
  let baseEmail: string | undefined;
  try {
    const result = await chrome.storage.sync.get(['emailDomain', 'emailMode', 'baseEmail']);
    mode = (result.emailMode as EmailMode) ?? 'catchAll';
    userDomain = result.emailDomain as string | undefined;
    baseEmail = result.baseEmail as string | undefined;
  } catch (error) {
    console.error('Failed to read storage:', error);
    throw new Error('Unable to read settings. Please try again.');
  }

  // Check required config for active mode
  if (mode === 'plusAddressing') {
    if (!baseEmail || !baseEmail.includes('@')) return null;
  } else {
    if (!userDomain) return null;
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
    const siteDomain = extractMainDomain(url.hostname);

    if (mode === 'plusAddressing') {
      const atIndex = (baseEmail as string).lastIndexOf('@');
      const localPart = (baseEmail as string).substring(0, atIndex);
      const emailDomain = (baseEmail as string).substring(atIndex + 1);
      return `${localPart}+${siteDomain}@${emailDomain}`;
    }

    return `${siteDomain}@${userDomain}`;
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
