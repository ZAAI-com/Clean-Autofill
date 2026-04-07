import type { CleanAutofillUtils, EmailMode } from './types';

const { debounce } =
  (globalThis as { CleanAutofillUtils?: CleanAutofillUtils }).CleanAutofillUtils || {};

export function extractDomainFromEmail(email: string): string | null {
  const trimmed = email.trim();
  if (!trimmed) return null;
  const atIndex = trimmed.lastIndexOf('@');
  if (atIndex === -1 || atIndex === 0 || atIndex === trimmed.length - 1) return null;
  return trimmed.substring(atIndex + 1);
}

export function extractLocalPart(email: string): string | null {
  const trimmed = email.trim();
  if (!trimmed) return null;
  const atIndex = trimmed.lastIndexOf('@');
  if (atIndex <= 0) return null;
  return trimmed.substring(0, atIndex);
}

document.addEventListener('DOMContentLoaded', async () => {
  const form = document.getElementById('settingsForm');
  const emailInput = document.getElementById('emailInput');
  const statusDiv = document.getElementById('status');
  const clearButton = document.getElementById('clearButton');
  const importChromeButton = document.getElementById('importChromeButton');
  const chromeProfileEmail = document.getElementById('chromeProfileEmail');
  const colPlusAddressing = document.getElementById('colPlusAddressing');
  const colCatchAll = document.getElementById('colCatchAll');
  const modePlusAddressing = document.getElementById('modePlusAddressing');
  const modeCatchAll = document.getElementById('modeCatchAll');
  const plusFormat = document.getElementById('plusFormat');
  const catchAllFormat = document.getElementById('catchAllFormat');

  if (
    !form ||
    !emailInput ||
    !statusDiv ||
    !clearButton ||
    !importChromeButton ||
    !chromeProfileEmail ||
    !colPlusAddressing ||
    !colCatchAll ||
    !modePlusAddressing ||
    !modeCatchAll ||
    !plusFormat ||
    !catchAllFormat
  ) {
    console.error('Required DOM elements not found');
    return;
  }

  const formEl = form as HTMLFormElement;
  const input = emailInput as HTMLInputElement;
  const statusEl = statusDiv as HTMLDivElement;
  const clearBtn = clearButton as HTMLButtonElement;
  const importBtn = importChromeButton as HTMLButtonElement;
  const profileEmailEl = chromeProfileEmail as HTMLSpanElement;
  const colPlus = colPlusAddressing as HTMLDivElement;
  const colCatch = colCatchAll as HTMLDivElement;
  const radioPlus = modePlusAddressing as HTMLInputElement;
  const radioCatch = modeCatchAll as HTMLInputElement;
  const plusFormatEl = plusFormat as HTMLElement;
  const catchAllFormatEl = catchAllFormat as HTMLElement;

  const exampleEls = document.querySelectorAll<HTMLElement>('.example-email[data-site]');

  function getMode(): EmailMode {
    return radioPlus.checked ? 'plusAddressing' : 'catchAll';
  }

  function setMode(mode: EmailMode): void {
    if (mode === 'plusAddressing') {
      radioPlus.checked = true;
      radioCatch.checked = false;
      colPlus.classList.add('selected');
      colCatch.classList.remove('selected');
    } else {
      radioCatch.checked = true;
      radioPlus.checked = false;
      colCatch.classList.add('selected');
      colPlus.classList.remove('selected');
    }
    updateFormatDisplay();
    updateExamples();
  }

  function updateFormatDisplay(): void {
    const value = input.value.trim();
    const mode = getMode();

    if (mode === 'plusAddressing') {
      const localPart = extractLocalPart(value) || 'name';
      const domain = extractDomainFromEmail(value) || 'gmail.com';
      plusFormatEl.textContent = `${localPart}+site@${domain}`;
    } else {
      const domain = value.includes('@')
        ? extractDomainFromEmail(value) || value
        : value || 'yourdomain.com';
      catchAllFormatEl.textContent = `site@${domain}`;
    }
  }

  function updateExamples(): void {
    const value = input.value.trim();
    const mode = getMode();

    for (let i = 0; i < exampleEls.length; i++) {
      const el = exampleEls[i];
      const site = el.dataset.site;
      if (!site) continue;

      if (mode === 'plusAddressing') {
        const localPart = extractLocalPart(value) || 'name';
        const domain = extractDomainFromEmail(value) || 'gmail.com';
        el.textContent = `${localPart}+${site}@${domain}`;
      } else {
        const domain = value.includes('@')
          ? extractDomainFromEmail(value) || value
          : value || 'yourdomain.com';
        el.textContent = `${site}@${domain}`;
      }
    }
  }

  async function loadSettings(): Promise<void> {
    try {
      const result = await chrome.storage.sync.get(['emailDomain', 'emailMode', 'baseEmail']);
      const mode: EmailMode = (result.emailMode as EmailMode) ?? 'catchAll';

      if (mode === 'plusAddressing' && result.baseEmail) {
        input.value = result.baseEmail as string;
      } else if (result.emailDomain) {
        input.value = result.emailDomain as string;
      }

      setMode(mode);
    } catch (error) {
      console.error('Failed to load settings:', error);
      showStatus('Failed to load settings', 'error');
    }
  }

  const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z]{2,})+$/;

  async function saveSettings(e: Event): Promise<void> {
    e.preventDefault();

    const value = input.value.trim();
    const mode = getMode();

    if (!value) {
      showStatus('Please enter your email address or domain', 'error');
      return;
    }

    if (mode === 'plusAddressing') {
      const localPart = extractLocalPart(value);
      const domain = extractDomainFromEmail(value);

      if (!localPart || !domain) {
        showStatus('Please enter a valid email address (e.g., name@gmail.com)', 'error');
        return;
      }

      if (!domainRegex.test(domain)) {
        showStatus('The email domain is not valid', 'error');
        return;
      }

      try {
        await chrome.storage.sync.set({ emailMode: 'plusAddressing', baseEmail: value });
        showStatus('Settings saved successfully!', 'success');
      } catch (error) {
        showStatus(
          `Error saving settings: ${error instanceof Error ? error.message : 'Unknown error'}`,
          'error',
        );
      }
    } else {
      const cleanDomain = value.replace(/^@/, '');

      if (!domainRegex.test(cleanDomain)) {
        showStatus('Please enter a valid domain (e.g., yourdomain.com)', 'error');
        return;
      }

      try {
        await chrome.storage.sync.set({ emailMode: 'catchAll', emailDomain: cleanDomain });
        input.value = cleanDomain;
        showStatus('Settings saved successfully!', 'success');
      } catch (error) {
        showStatus(
          `Error saving settings: ${error instanceof Error ? error.message : 'Unknown error'}`,
          'error',
        );
      }
    }
  }

  async function clearSettings(): Promise<void> {
    if (confirm('Are you sure you want to clear your settings?')) {
      try {
        await chrome.storage.sync.remove(['emailDomain', 'emailMode', 'baseEmail']);
        input.value = '';
        setMode('catchAll');
        showStatus('Settings cleared', 'success');
      } catch (error) {
        showStatus(
          `Error clearing settings: ${error instanceof Error ? error.message : 'Unknown error'}`,
          'error',
        );
      }
    }
  }

  async function loadChromeProfileEmail(): Promise<string | null> {
    try {
      const userInfo = await chrome.identity.getProfileUserInfo({ accountStatus: 'ANY' });
      if (userInfo.email) {
        profileEmailEl.textContent = userInfo.email;
        return userInfo.email;
      }
    } catch {
      // Silently fail
    }
    return null;
  }

  async function importFromChrome(): Promise<void> {
    try {
      importBtn.disabled = true;
      const userInfo = await chrome.identity.getProfileUserInfo({ accountStatus: 'ANY' });

      if (!userInfo.email) {
        showStatus('No Google account found in this Chrome profile', 'error');
        return;
      }

      profileEmailEl.textContent = userInfo.email;
      input.value = userInfo.email;
      updateFormatDisplay();
      updateExamples();
      showStatus('Email imported — click Save to keep it', 'success');
    } catch (error) {
      showStatus(
        `Failed to import: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'error',
      );
    } finally {
      importBtn.disabled = false;
    }
  }

  function showStatus(message: string, type: 'success' | 'error'): void {
    statusEl.textContent = message;
    statusEl.className = `status ${type}`;

    setTimeout(() => {
      statusEl.className = 'status';
    }, 3000);
  }

  const debouncedUpdate = debounce
    ? debounce(() => {
        updateFormatDisplay();
        updateExamples();
      }, 300)
    : () => {
        updateFormatDisplay();
        updateExamples();
      };

  // Event listeners
  formEl.addEventListener('submit', saveSettings);
  clearBtn.addEventListener('click', clearSettings);
  importBtn.addEventListener('click', importFromChrome);
  input.addEventListener('input', debouncedUpdate);

  colPlus.addEventListener('click', () => setMode('plusAddressing'));
  colCatch.addEventListener('click', () => setMode('catchAll'));

  // Initialize
  await loadSettings();
  loadChromeProfileEmail();
});
