// Access shared utilities (loaded via script tag in options.html)
import type { CleanAutofillUtils } from './types';

const { extractMainDomain, debounce } =
  (globalThis as { CleanAutofillUtils?: CleanAutofillUtils }).CleanAutofillUtils || {};

document.addEventListener('DOMContentLoaded', async () => {
  const form = document.getElementById('settingsForm');
  const emailDomainInput = document.getElementById('emailDomain');
  const statusDiv = document.getElementById('status');
  const clearButton = document.getElementById('clearButton');
  const previewBox = document.getElementById('previewBox');
  const exampleEmail = document.getElementById('exampleEmail');
  const exampleEmail2 = document.getElementById('exampleEmail2');

  // Verify all required DOM elements exist
  if (
    !form ||
    !emailDomainInput ||
    !statusDiv ||
    !clearButton ||
    !previewBox ||
    !exampleEmail ||
    !exampleEmail2
  ) {
    console.error('Required DOM elements not found');
    return;
  }

  // Type-safe references after null check
  const formEl = form as HTMLFormElement;
  const emailInput = emailDomainInput as HTMLInputElement;
  const statusEl = statusDiv as HTMLDivElement;
  const clearBtn = clearButton as HTMLButtonElement;
  const previewEl = previewBox as HTMLDivElement;
  const example1 = exampleEmail as HTMLSpanElement;
  const example2 = exampleEmail2 as HTMLSpanElement;

  /**
   * Load saved settings from Chrome sync storage and update the UI.
   */
  async function loadSettings(): Promise<void> {
    try {
      const result = await chrome.storage.sync.get(['emailDomain']);
      if (result.emailDomain) {
        emailInput.value = result.emailDomain as string;
        await updatePreview();
        updateExamples();
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
      showStatus('Failed to load settings', 'error');
    }
  }

  /**
   * Validate and save settings to Chrome sync storage.
   * @param e - The form submit event
   */
  async function saveSettings(e: Event): Promise<void> {
    e.preventDefault();

    const domain = emailInput.value.trim();

    // Validate domain
    if (!domain) {
      showStatus('Please enter a domain', 'error');
      return;
    }

    // Remove @ if user included it
    const cleanDomain = domain.replace(/^@/, '');

    // Improved domain validation - allows single-char labels
    const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z]{2,})+$/;
    if (!domainRegex.test(cleanDomain)) {
      showStatus('Please enter a valid domain (e.g., example.com)', 'error');
      return;
    }

    try {
      await chrome.storage.sync.set({ emailDomain: cleanDomain });
      emailInput.value = cleanDomain;
      showStatus('Settings saved successfully!', 'success');
      await updatePreview();
      updateExamples();
    } catch (error) {
      showStatus(
        `Error saving settings: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'error',
      );
    }
  }

  /**
   * Clear saved settings from Chrome sync storage after user confirmation.
   */
  async function clearSettings(): Promise<void> {
    if (confirm('Are you sure you want to clear your email domain?')) {
      try {
        await chrome.storage.sync.remove(['emailDomain']);
        emailInput.value = '';
        showStatus('Settings cleared', 'success');
        await updatePreview();
        updateExamples();
      } catch (error) {
        showStatus(
          `Error clearing settings: ${error instanceof Error ? error.message : 'Unknown error'}`,
          'error',
        );
      }
    }
  }

  /**
   * Display a status message to the user that auto-hides after 3 seconds.
   * @param message - The message to display
   * @param type - The message type ('success' or 'error')
   */
  function showStatus(message: string, type: 'success' | 'error'): void {
    statusEl.textContent = message;
    statusEl.className = `status ${type}`;

    // Hide status after 3 seconds
    setTimeout(() => {
      statusEl.className = 'status';
    }, 3000);
  }

  /**
   * Update the email preview based on the current tab's domain and user's configured domain.
   */
  async function updatePreview(): Promise<void> {
    const domain = emailInput.value.trim();
    if (!domain) {
      previewEl.textContent = 'No domain set';
      return;
    }

    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs[0]?.url) {
        try {
          const url = new URL(tabs[0].url);
          const currentDomain = extractMainDomain
            ? extractMainDomain(url.hostname)
            : url.hostname.replace(/^www\./, '');
          previewEl.textContent = `${currentDomain}@${domain}`;
        } catch {
          previewEl.textContent = `example.com@${domain}`;
        }
      } else {
        previewEl.textContent = `example.com@${domain}`;
      }
    } catch {
      previewEl.textContent = `example.com@${domain}`;
    }
  }

  /**
   * Update the example email displays with the current domain setting.
   */
  function updateExamples(): void {
    const domain = emailInput.value.trim() || 'yourdomain.com';
    // Show examples with main domains only (no subdomains)
    example1.textContent = `google.com@${domain}`;
    example2.textContent = `github.com@${domain}`;
  }

  /**
   * Debounced version of preview update to avoid excessive updates during typing.
   */
  const debouncedUpdatePreview = debounce
    ? debounce(async () => {
        await updatePreview();
        updateExamples();
      }, 300)
    : async () => {
        await updatePreview();
        updateExamples();
      };

  // Event listeners
  formEl.addEventListener('submit', saveSettings);
  clearBtn.addEventListener('click', clearSettings);
  emailInput.addEventListener('input', debouncedUpdatePreview);

  // Initialize
  await loadSettings();
});
