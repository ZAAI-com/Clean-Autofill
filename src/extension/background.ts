// Import shared utilities as ES module

import { createTimeout, extractMainDomain } from '../email/utils.js';
import type { EmailMode, FillEmailResponse, GenerateAndFillResponse } from '../types';
import { addEntry } from '../ui/history.js';

// Message timeout in milliseconds
const MESSAGE_TIMEOUT = 5000;

// Handle messages from popup
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.action === 'generateAndFill') {
    handleGenerateAndFill().then(sendResponse);
    return true; // keep message channel open for async response
  }
});

async function handleGenerateAndFill(): Promise<GenerateAndFillResponse> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab) {
      return { success: false, error: 'No active tab found' };
    }

    const result = await generateEmailForTab(tab);

    if (!result) {
      return { success: false, needsConfig: true };
    }

    const { email } = result;

    // Save to history
    addEntry({
      email,
      domain: result.domain,
      pageUrl: tab.url ? new URL(tab.url).origin + new URL(tab.url).pathname : '',
      pageTitle: tab.title ?? '',
      createdAt: new Date().toISOString(),
      mode: result.mode,
    }).catch((err) => console.error('Failed to save history:', err));

    if (tab.id === undefined) {
      return { success: true, email, message: 'Email generated (no tab to fill)' };
    }

    // Try to fill the email field
    try {
      const response = (await Promise.race([
        chrome.tabs.sendMessage(tab.id, { action: 'fillEmail', email }),
        createTimeout(MESSAGE_TIMEOUT, 'Content script did not respond'),
      ])) as FillEmailResponse;

      if (response?.success) {
        return { success: true, email, message: response.message };
      }
      if (response?.error) {
        return { success: true, email, message: `Email generated (${response.error})` };
      }
      // No response — no field found, but email still generated
      return { success: true, email, message: 'Email generated (no field found to fill)' };
    } catch (fillError) {
      const msg = fillError instanceof Error ? fillError.message : 'Fill failed';

      if (msg.includes('Receiving end does not exist')) {
        return {
          success: true,
          email,
          message: 'Email generated (please refresh the page to autofill)',
        };
      }
      if (msg.includes('Content script did not respond')) {
        return { success: true, email, message: 'Email generated (no field found to fill)' };
      }
      return { success: true, email, message: `Email generated (${msg})` };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to generate email';
    return { success: false, error: errorMessage };
  }
}

interface GenerateResult {
  email: string;
  domain: string;
  mode: EmailMode;
}

/**
 * Generate an email address based on the current tab's domain and user settings.
 * Combines the site's main domain with the user's configured email domain.
 * @param tab - The Chrome tab to generate the email for
 * @returns The generated email and metadata, or null if no domain is configured
 * @throws Error if unable to read settings or parse the tab URL
 */
async function generateEmailForTab(tab: chrome.tabs.Tab): Promise<GenerateResult | null> {
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
    if (!baseEmail?.includes('@')) return null;
  } else {
    if (!userDomain) return null;
  }

  // Extract domain from tab URL
  if (!tab?.url) {
    throw new Error('Unable to get current website domain');
  }

  // Skip chrome:// and extension:// URLs
  if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
    throw new Error("Email addresses can't be generated on browser pages.");
  }

  try {
    const url = new URL(tab.url);
    const siteDomain = extractMainDomain(url.hostname);

    if (mode === 'plusAddressing') {
      const atIndex = (baseEmail as string).lastIndexOf('@');
      const localPart = (baseEmail as string).substring(0, atIndex);
      const emailDomain = (baseEmail as string).substring(atIndex + 1);
      return { email: `${localPart}+${siteDomain}@${emailDomain}`, domain: siteDomain, mode };
    }

    return { email: `${siteDomain}@${userDomain}`, domain: siteDomain, mode };
  } catch {
    throw new Error('Unable to parse current website URL');
  }
}

// Auto-detect Chrome profile email and save default settings on first install
async function initializeDefaultSettings(): Promise<void> {
  try {
    const existing = await chrome.storage.sync.get(['emailMode', 'emailDomain', 'baseEmail']);
    if (existing.emailMode || existing.emailDomain || existing.baseEmail) return;

    const userInfo = await chrome.identity.getProfileUserInfo({ accountStatus: 'ANY' });
    if (userInfo.email?.includes('@')) {
      await chrome.storage.sync.set({ emailMode: 'plusAddressing', baseEmail: userInfo.email });
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: 'Clean-Autofill Installed',
        message: `Ready to go! Using ${userInfo.email} for plus addressing.`,
      });
    } else {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: 'Clean-Autofill Installed',
        message: 'Click the extension icon to fill emails! Configure your email in options first.',
      });
    }
  } catch {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: 'Clean-Autofill Installed',
      message: 'Click the extension icon to fill emails! Configure your email in options first.',
    });
  }
}

// Install event - initialize defaults and open options
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    initializeDefaultSettings().then(() => {
      chrome.runtime.openOptionsPage();
    });
  }
});
