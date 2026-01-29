// Access shared utilities (loaded via script tag in options.html)
import type { CleanAutofillUtils } from './types';

const { extractMainDomain, debounce } =
  (globalThis as { CleanAutofillUtils?: CleanAutofillUtils }).CleanAutofillUtils || {};

document.addEventListener('DOMContentLoaded', async () => {
  const form = document.getElementById('settingsForm') as HTMLFormElement;
  const emailDomainInput = document.getElementById('emailDomain') as HTMLInputElement;
  const statusDiv = document.getElementById('status') as HTMLDivElement;
  const clearButton = document.getElementById('clearButton') as HTMLButtonElement;
  const previewBox = document.getElementById('previewBox') as HTMLDivElement;
  const exampleEmail = document.getElementById('exampleEmail') as HTMLSpanElement;
  const exampleEmail2 = document.getElementById('exampleEmail2') as HTMLSpanElement;

  // Load saved settings
  async function loadSettings(): Promise<void> {
    try {
      const result = await chrome.storage.sync.get(['emailDomain']);
      if (result.emailDomain) {
        emailDomainInput.value = result.emailDomain as string;
        await updatePreview();
        updateExamples();
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
      showStatus('Failed to load settings', 'error');
    }
  }

  // Save settings
  async function saveSettings(e: Event): Promise<void> {
    e.preventDefault();

    const domain = emailDomainInput.value.trim();

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
      emailDomainInput.value = cleanDomain;
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

  // Clear settings
  async function clearSettings(): Promise<void> {
    if (confirm('Are you sure you want to clear your email domain?')) {
      try {
        await chrome.storage.sync.remove(['emailDomain']);
        emailDomainInput.value = '';
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

  // Show status message
  function showStatus(message: string, type: 'success' | 'error'): void {
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;

    // Hide status after 3 seconds
    setTimeout(() => {
      statusDiv.className = 'status';
    }, 3000);
  }

  // Update preview (async version)
  async function updatePreview(): Promise<void> {
    const domain = emailDomainInput.value.trim();
    if (!domain) {
      previewBox.textContent = 'No domain set';
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
          previewBox.textContent = `${currentDomain}@${domain}`;
        } catch {
          previewBox.textContent = `example.com@${domain}`;
        }
      } else {
        previewBox.textContent = `example.com@${domain}`;
      }
    } catch {
      previewBox.textContent = `example.com@${domain}`;
    }
  }

  // Update examples
  function updateExamples(): void {
    const domain = emailDomainInput.value.trim() || 'yourdomain.com';
    // Show examples with main domains only (no subdomains)
    exampleEmail.textContent = `google.com@${domain}`;
    exampleEmail2.textContent = `github.com@${domain}`;
  }

  // Debounced preview update for input events
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
  form.addEventListener('submit', saveSettings);
  clearButton.addEventListener('click', clearSettings);
  emailDomainInput.addEventListener('input', debouncedUpdatePreview);

  // Initialize
  await loadSettings();
});
