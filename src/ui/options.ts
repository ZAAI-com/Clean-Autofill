import { getProviderInfo } from '../mx-lookup.js';
import type { ProviderStatus } from '../providers.js';
import {
  domainRegex,
  extractDomainFromEmail,
  extractLocalPart,
  getProviderStatus,
  getProviderStatusWithMx,
} from '../providers.js';
import type { CleanAutofillUtils, EmailHistoryEntry, EmailMode, MxLookupResult } from '../types';

const { debounce } =
  (globalThis as { CleanAutofillUtils?: CleanAutofillUtils }).CleanAutofillUtils || {};

document.addEventListener('DOMContentLoaded', async () => {
  // ── Sidebar Navigation ──
  const navItems = document.querySelectorAll<HTMLElement>('.nav-item[data-page]');
  const pages = document.querySelectorAll<HTMLElement>('.page');

  function switchPage(pageId: string): void {
    navItems.forEach((nav) => {
      nav.classList.toggle('active', nav.dataset.page === pageId);
    });
    pages.forEach((page) => {
      page.classList.toggle('active', page.id === `page-${pageId}`);
    });
    if (pageId === 'history') {
      loadHistory();
    }
  }

  navItems.forEach((nav) => {
    nav.addEventListener('click', () => {
      const pageId = nav.dataset.page;
      if (pageId) switchPage(pageId);
    });
  });

  // ── Settings Page Elements ──
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
  const plusFeedback = document.getElementById('plusFeedback');
  const catchAllFeedback = document.getElementById('catchAllFeedback');
  const providerDetected = document.getElementById('providerDetected');
  const providerText = document.getElementById('providerText');

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
    !catchAllFormat ||
    !plusFeedback ||
    !catchAllFeedback ||
    !providerDetected ||
    !providerText
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
  const plusFeedbackEl = plusFeedback as HTMLDivElement;
  const catchAllFeedbackEl = catchAllFeedback as HTMLDivElement;
  const providerDetectedEl = providerDetected as HTMLDivElement;
  const providerTextEl = providerText as HTMLSpanElement;

  let currentLookupDomain: string | null = null;

  const exampleEls = document.querySelectorAll<HTMLElement>('.example-email[data-site]');

  // ── Settings Logic (unchanged) ──

  function getMode(): EmailMode {
    return radioPlus.checked ? 'plusAddressing' : 'catchAll';
  }

  function setMode(mode: EmailMode): void {
    // Don't allow selecting a disabled mode
    const col = mode === 'plusAddressing' ? colPlus : colCatch;
    if (col.classList.contains('disabled')) return;

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

  function setColumnState(
    col: HTMLDivElement,
    feedbackEl: HTMLDivElement,
    state: 'available' | 'disabled' | 'warning',
    message: string,
  ): void {
    col.classList.remove('disabled');
    feedbackEl.className = 'mode-feedback';
    feedbackEl.textContent = '';

    if (state === 'disabled') {
      col.classList.add('disabled');
      feedbackEl.classList.add('feedback-disabled');
      feedbackEl.textContent = message;
    } else if (state === 'warning') {
      feedbackEl.classList.add('feedback-warning');
      feedbackEl.textContent = message;
    }
  }

  function applyProviderStatus(
    domain: string,
    status: ProviderStatus,
    mxResult: MxLookupResult | null,
  ): void {
    // Plus Addressing column
    if (status === 'plus-unsupported') {
      setColumnState(
        colPlus,
        plusFeedbackEl,
        'warning',
        `${domain} may not support plus addressing`,
      );
    } else {
      setColumnState(colPlus, plusFeedbackEl, 'available', '');
    }

    // Catch-All column — disabled for known providers
    if (status === 'plus-supported' || status === 'plus-unsupported') {
      setColumnState(colCatch, catchAllFeedbackEl, 'disabled', `Not available for ${domain}`);
      if (getMode() === 'catchAll') setMode('plusAddressing');
    } else {
      setColumnState(colCatch, catchAllFeedbackEl, 'available', '');
    }

    // Provider detection display
    if (mxResult?.provider) {
      const info = getProviderInfo(mxResult.provider);
      showProviderDetection(info.name, status);
    } else if (mxResult) {
      hideProviderDetection();
    }
  }

  function showProviderLoading(): void {
    providerDetectedEl.style.display = 'flex';
    providerDetectedEl.className = 'provider-detected loading';
    providerTextEl.textContent = 'Checking email provider...';
  }

  function showProviderDetection(providerName: string, status: ProviderStatus): void {
    providerDetectedEl.style.display = 'flex';
    if (status === 'plus-supported') {
      providerDetectedEl.className = 'provider-detected detected-supported';
      providerTextEl.textContent = `Detected: ${providerName} — plus addressing supported`;
    } else if (status === 'plus-unsupported') {
      providerDetectedEl.className = 'provider-detected detected-unsupported';
      providerTextEl.textContent = `Detected: ${providerName} — plus addressing may not be supported`;
    } else {
      providerDetectedEl.className = 'provider-detected detected-custom';
      providerTextEl.textContent = `Detected: ${providerName}`;
    }
  }

  function hideProviderDetection(): void {
    providerDetectedEl.style.display = 'none';
    currentLookupDomain = null;
  }

  function updateModeAvailability(): void {
    const value = input.value.trim();
    const domain = extractDomainFromEmail(value);
    const isFullEmail = value.includes('@') && domain != null;

    hideProviderDetection();

    if (!value) {
      setColumnState(colPlus, plusFeedbackEl, 'disabled', 'Enter your email or domain above');
      setColumnState(colCatch, catchAllFeedbackEl, 'disabled', 'Enter your email or domain above');
      return;
    }

    if (!isFullEmail) {
      setColumnState(
        colPlus,
        plusFeedbackEl,
        'disabled',
        'Enter a full email to use Plus Addressing',
      );
      setColumnState(colCatch, catchAllFeedbackEl, 'available', '');
      if (getMode() === 'plusAddressing') setMode('catchAll');
      return;
    }

    // Synchronous check first
    const status = getProviderStatus(domain as string);
    applyProviderStatus(domain as string, status, null);

    // If custom domain, try MX lookup
    if (status === 'custom') {
      currentLookupDomain = domain as string;
      showProviderLoading();
      getProviderStatusWithMx(domain as string).then(({ status: mxStatus, mxResult }) => {
        if (currentLookupDomain === domain) {
          applyProviderStatus(domain as string, mxStatus, mxResult);
        }
      });
    }
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

    if (mode === 'plusAddressing') {
      const localPart = extractLocalPart(value) || 'name';
      const domain = extractDomainFromEmail(value) || 'gmail.com';
      for (let i = 0; i < exampleEls.length; i++) {
        const site = exampleEls[i].dataset.site;
        if (site) exampleEls[i].textContent = `${localPart}+${site}@${domain}`;
      }
    } else {
      const domain = value.includes('@')
        ? extractDomainFromEmail(value) || value
        : value || 'yourdomain.com';
      for (let i = 0; i < exampleEls.length; i++) {
        const site = exampleEls[i].dataset.site;
        if (site) exampleEls[i].textContent = `${site}@${domain}`;
      }
    }
  }

  async function loadSettings(profileEmail: string | null): Promise<void> {
    try {
      const result = await chrome.storage.sync.get(['emailDomain', 'emailMode', 'baseEmail']);
      const hasSavedSettings = result.emailMode || result.emailDomain || result.baseEmail;
      const mode: EmailMode = (result.emailMode as EmailMode) ?? 'catchAll';

      if (hasSavedSettings) {
        if (mode === 'plusAddressing' && result.baseEmail) {
          input.value = result.baseEmail as string;
        } else if (result.emailDomain) {
          input.value = result.emailDomain as string;
        }
        updateModeAvailability();
        setMode(mode);
      } else if (profileEmail) {
        // No saved settings — prefill with Chrome profile email and default to Plus Addressing
        input.value = profileEmail;
        updateModeAvailability();
        setMode('plusAddressing');
      } else {
        updateModeAvailability();
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
      showStatus('Failed to load settings', 'error');
    }
  }

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
      // If user entered a full email, extract just the domain
      const cleanDomain = value.includes('@')
        ? extractDomainFromEmail(value) || value.replace(/^@/, '')
        : value.replace(/^@/, '');

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
        updateModeAvailability();
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
      updateModeAvailability();
      updateFormatDisplay();
      updateExamples();
      showStatus('Email imported. Click Save to keep it.', 'success');
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
        updateModeAvailability();
        updateFormatDisplay();
        updateExamples();
      }, 300)
    : () => {
        updateModeAvailability();
        updateFormatDisplay();
        updateExamples();
      };

  // Settings event listeners
  formEl.addEventListener('submit', saveSettings);
  clearBtn.addEventListener('click', clearSettings);
  importBtn.addEventListener('click', importFromChrome);
  input.addEventListener('input', debouncedUpdate);

  colPlus.addEventListener('click', () => setMode('plusAddressing'));
  colCatch.addEventListener('click', () => setMode('catchAll'));

  // ── History Page ──
  const historyBody = document.getElementById('historyBody') as HTMLTableSectionElement;
  const historyTable = document.getElementById('historyTable') as HTMLTableElement;
  const historyEmpty = document.getElementById('historyEmpty') as HTMLDivElement;
  const historySearch = document.getElementById('historySearch') as HTMLInputElement;
  const clearHistoryButton = document.getElementById('clearHistoryButton') as HTMLButtonElement;

  function formatDate(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function renderHistory(entries: EmailHistoryEntry[]): void {
    historyBody.innerHTML = '';

    if (entries.length === 0) {
      historyTable.style.display = 'none';
      historyEmpty.style.display = 'block';
      return;
    }

    historyTable.style.display = '';
    historyEmpty.style.display = 'none';

    for (const entry of entries) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="col-domain">${escapeHtml(entry.domain)}</td>
        <td class="col-email">${escapeHtml(entry.email)}</td>
        <td class="col-date">${formatDate(entry.createdAt)}</td>
        <td class="col-actions">
          <button class="btn-copy" data-email="${escapeAttr(entry.email)}" title="Copy email">Copy</button>
          <button class="btn-delete" data-id="${escapeAttr(entry.id)}" title="Delete entry">&times;</button>
        </td>
      `;
      historyBody.appendChild(tr);
    }
  }

  function escapeHtml(str: string): string {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function escapeAttr(str: string): string {
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  }

  async function loadHistory(): Promise<void> {
    const { emailHistory = [] } = await chrome.storage.local.get('emailHistory');
    let entries = emailHistory as EmailHistoryEntry[];

    const searchTerm = historySearch.value.trim().toLowerCase();
    if (searchTerm) {
      entries = entries.filter(
        (e) =>
          e.domain.toLowerCase().includes(searchTerm) || e.email.toLowerCase().includes(searchTerm),
      );
    }

    renderHistory(entries);
  }

  historyBody.addEventListener('click', async (e) => {
    const target = e.target as HTMLElement;

    if (target.classList.contains('btn-copy')) {
      const email = target.dataset.email;
      if (email) {
        await navigator.clipboard.writeText(email);
        target.textContent = 'Copied!';
        setTimeout(() => {
          target.textContent = 'Copy';
        }, 1500);
      }
    }

    if (target.classList.contains('btn-delete')) {
      const id = target.dataset.id;
      if (id) {
        const { emailHistory = [] } = await chrome.storage.local.get('emailHistory');
        const updated = (emailHistory as EmailHistoryEntry[]).filter((e) => e.id !== id);
        await chrome.storage.local.set({ emailHistory: updated });
        await loadHistory();
      }
    }
  });

  clearHistoryButton.addEventListener('click', async () => {
    if (confirm('Are you sure you want to clear all history?')) {
      await chrome.storage.local.remove('emailHistory');
      await loadHistory();
    }
  });

  const debouncedHistorySearch = debounce
    ? debounce(() => loadHistory(), 300)
    : () => loadHistory();

  historySearch.addEventListener('input', debouncedHistorySearch);

  // ── Initialize ──
  const profileEmail = await loadChromeProfileEmail();
  await loadSettings(profileEmail);
});
