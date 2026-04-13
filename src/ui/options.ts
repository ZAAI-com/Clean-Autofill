import { getAllCatchAllInstructions } from '../email/catch-all-instructions.js';
import { getProviderInfo } from '../email/mx-lookup.js';
import type { ProviderStatus } from '../email/providers.js';
import {
  domainRegex,
  extractDomainFromEmail,
  extractLocalPart,
  getProviderStatus,
  getProviderStatusWithMx,
} from '../email/providers.js';
import type {
  CleanAutofillUtils,
  DetectedProvider,
  EmailHistoryEntry,
  EmailMode,
  MxLookupResult,
} from '../types';

const { debounce } =
  (globalThis as { CleanAutofillUtils?: CleanAutofillUtils }).CleanAutofillUtils || {};

export type SaveIndicatorState = 'editing' | 'saving' | 'saved' | 'error';

export type SettingsDraft = {
  mode: EmailMode;
  storagePayload: Record<string, string>;
  canonicalInputValue: string;
};

type SelectedMode = EmailMode | null;

const SAVE_INDICATOR_LABELS: Record<SaveIndicatorState, string> = {
  editing: 'Editing…',
  saving: 'Saving…',
  saved: 'Saved',
  error: 'Save failed',
};

const FEEDBACK_MESSAGES = {
  unsupportedProvider:
    'This provider does not support plus addressing. Catch-all mode requires a custom domain.',
  unsupportedPlusAddressing: 'This email provider does not support plus addressing.',
  possiblyUnsupportedPlusAddressing: 'This email provider likely does not support plus addressing.',
  enterEmailOrDomain: 'Enter your email or domain above.',
  enterValidEmailOrDomain: 'Enter a valid email or domain.',
  plusRequiresFullEmail: 'Plus addressing requires a full email address.',
} as const;

export function getSaveIndicatorLabel(state: SaveIndicatorState): string {
  return SAVE_INDICATOR_LABELS[state];
}

export function createSettingsDraft(value: string, mode: EmailMode): SettingsDraft | null {
  const trimmedValue = value.trim();
  if (!trimmedValue) return null;

  const localPart = extractLocalPart(trimmedValue);
  const domain = extractDomainFromEmail(trimmedValue)?.toLowerCase() ?? null;
  const normalizedDomain = trimmedValue.replace(/^@/, '').toLowerCase();
  const isFullEmail =
    trimmedValue.includes('@') && localPart != null && domain != null && domainRegex.test(domain);

  if (mode === 'plusAddressing') {
    if (!isFullEmail || !domain) return null;
    return {
      mode,
      canonicalInputValue: trimmedValue,
      storagePayload: {
        emailMode: mode,
        emailDomain: domain,
        baseEmail: trimmedValue,
      },
    };
  }

  if (isFullEmail && domain) {
    return {
      mode,
      canonicalInputValue: trimmedValue,
      storagePayload: {
        emailMode: mode,
        emailDomain: domain,
        baseEmail: trimmedValue,
      },
    };
  }

  if (!domainRegex.test(normalizedDomain)) return null;

  return {
    mode,
    canonicalInputValue: normalizedDomain,
    storagePayload: {
      emailMode: mode,
      emailDomain: normalizedDomain,
    },
  };
}

export function areSettingsDraftsEqual(a: SettingsDraft | null, b: SettingsDraft | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.mode !== b.mode || a.canonicalInputValue !== b.canonicalInputValue) return false;

  const aEntries = Object.entries(a.storagePayload).sort(([left], [right]) =>
    left.localeCompare(right),
  );
  const bEntries = Object.entries(b.storagePayload).sort(([left], [right]) =>
    left.localeCompare(right),
  );

  if (aEntries.length !== bEntries.length) return false;

  for (let i = 0; i < aEntries.length; i++) {
    if (aEntries[i][0] !== bEntries[i][0] || aEntries[i][1] !== bEntries[i][1]) {
      return false;
    }
  }

  return true;
}

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
    if (pageId === 'help') {
      renderHelpPage();
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
  const saveStateIndicator = document.getElementById('saveStateIndicator');
  const chromeProfileEmail = document.getElementById('chromeProfileEmail');
  const colPlusAddressing = document.getElementById('colPlusAddressing');
  const colCatchAll = document.getElementById('colCatchAll');
  const modePlusAddressing = document.getElementById('modePlusAddressing');
  const modeCatchAll = document.getElementById('modeCatchAll');
  const plusFormat = document.getElementById('plusFormat');
  const catchAllFormat = document.getElementById('catchAllFormat');
  const modeFeedback = document.getElementById('modeFeedback');
  const providerDetected = document.getElementById('providerDetected');
  const providerText = document.getElementById('providerText');
  const providerPlaceholder = document.getElementById('providerPlaceholder');
  const providerLogo = document.getElementById('providerLogo');
  const plusProviderIndicator = document.getElementById('plusProviderIndicator');
  const plusSupportIndicator = document.getElementById('plusSupportIndicator');
  const catchAllDomainIndicator = document.getElementById('catchAllDomainIndicator');
  const catchAllEnabledIndicator = document.getElementById('catchAllEnabledIndicator');
  const plusProviderValue = document.getElementById('plusProviderValue');
  const plusSupportValue = document.getElementById('plusSupportValue');
  const catchAllDomainValue = document.getElementById('catchAllDomainValue');
  const catchAllEnabledValue = document.getElementById('catchAllEnabledValue');
  const detectionChromeProfile = document.getElementById('detectionChromeProfile');
  const detectionProvider = document.getElementById('detectionProvider');
  const catchAllInfoIcon = document.getElementById('catchAllInfoIcon');
  const helpProvidersContainer = document.getElementById('helpProvidersContainer');

  if (
    !form ||
    !emailInput ||
    !statusDiv ||
    !saveStateIndicator ||
    !chromeProfileEmail ||
    !colPlusAddressing ||
    !colCatchAll ||
    !modePlusAddressing ||
    !modeCatchAll ||
    !plusFormat ||
    !catchAllFormat ||
    !modeFeedback ||
    !providerDetected ||
    !providerText ||
    !providerPlaceholder ||
    !providerLogo ||
    !plusProviderIndicator ||
    !plusSupportIndicator ||
    !catchAllDomainIndicator ||
    !catchAllEnabledIndicator ||
    !plusProviderValue ||
    !plusSupportValue ||
    !catchAllDomainValue ||
    !catchAllEnabledValue ||
    !detectionChromeProfile ||
    !detectionProvider ||
    !catchAllInfoIcon ||
    !helpProvidersContainer
  ) {
    console.error('Required DOM elements not found');
    return;
  }

  const formEl = form as HTMLFormElement;
  const input = emailInput as HTMLInputElement;
  const statusEl = statusDiv as HTMLDivElement;
  const saveStateEl = saveStateIndicator as HTMLDivElement;
  const profileEmailEl = chromeProfileEmail as HTMLSpanElement;
  const colPlus = colPlusAddressing as HTMLDivElement;
  const colCatch = colCatchAll as HTMLDivElement;
  const radioPlus = modePlusAddressing as HTMLInputElement;
  const radioCatch = modeCatchAll as HTMLInputElement;
  const plusFormatEl = plusFormat as HTMLElement;
  const catchAllFormatEl = catchAllFormat as HTMLElement;
  const modeFeedbackEl = modeFeedback as HTMLDivElement;
  const providerDetectedEl = providerDetected as HTMLDivElement;
  const providerTextEl = providerText as HTMLSpanElement;
  const providerPlaceholderEl = providerPlaceholder as HTMLSpanElement;
  const providerLogoEl = providerLogo as HTMLSpanElement;
  const plusProviderEl = plusProviderIndicator as HTMLSpanElement;
  const plusSupportEl = plusSupportIndicator as HTMLSpanElement;
  const catchAllDomainEl = catchAllDomainIndicator as HTMLSpanElement;
  const catchAllEnabledEl = catchAllEnabledIndicator as HTMLSpanElement;
  const plusProviderValueEl = plusProviderValue as HTMLSpanElement;
  const plusSupportValueEl = plusSupportValue as HTMLSpanElement;
  const catchAllDomainValueEl = catchAllDomainValue as HTMLSpanElement;
  const catchAllEnabledValueEl = catchAllEnabledValue as HTMLSpanElement;
  const chromeDetectionBoxEl = detectionChromeProfile as HTMLDivElement;
  const providerDetectionBoxEl = detectionProvider as HTMLDivElement;
  const catchAllInfoIconEl = catchAllInfoIcon as HTMLSpanElement;
  const helpContainerEl = helpProvidersContainer as HTMLDivElement;

  let currentLookupDomain: string | null = null;
  let currentDetectedProvider: DetectedProvider | null = null;
  let isLoading = true;
  let lastSavedDraft: SettingsDraft | null = null;
  let pendingDraft: SettingsDraft | null = null;
  let saveDelayTimer: ReturnType<typeof setTimeout> | null = null;
  let activeSavePromise: Promise<void> | null = null;
  let statusTimer: ReturnType<typeof setTimeout> | null = null;
  let preferredMode: EmailMode = 'plusAddressing';

  const exampleEls = document.querySelectorAll<HTMLElement>('.example-email[data-site]');

  interface InputState {
    trimmedValue: string;
    normalizedDomain: string;
    localPart: string | null;
    domain: string | null;
    isFullEmail: boolean;
    plusAllowed: boolean;
    catchAllAllowed: boolean;
  }

  // ── Provider Logos (local assets from src/icons/providers/) ──
  const PROVIDER_LOGO_FILES: Record<string, string> = {
    gmail: 'icons/providers/gmail.png',
    'google-workspace': 'icons/providers/google-workspace.png',
    outlook: 'icons/providers/outlook.png',
    protonmail: 'icons/providers/protonmail.png',
    fastmail: 'icons/providers/fastmail.png',
    zoho: 'icons/providers/zoho.png',
    icloud: 'icons/providers/icloud.png',
    yahoo: 'icons/providers/yahoo.png',
    gmx: 'icons/providers/gmx.png',
    webde: 'icons/providers/webde.png',
    tutanota: 'icons/providers/tutanota.png',
    'mailbox-org': 'icons/providers/mailbox-org.png',
    yandex: 'icons/providers/yandex.png',
    mailru: 'icons/providers/mailru.png',
    't-online': 'icons/providers/t-online.png',
    hey: 'icons/providers/hey.png',
    qq: 'icons/providers/qq.png',
    netease: 'icons/providers/netease.png',
    libero: 'icons/providers/libero.png',
    laposte: 'icons/providers/laposte.png',
    rediffmail: 'icons/providers/rediffmail.png',
    mailcom: 'icons/providers/mailcom.png',
  };

  const DOMAIN_TO_PROVIDER: Record<string, string> = {
    'gmail.com': 'gmail',
    'googlemail.com': 'gmail',
    'outlook.com': 'outlook',
    'hotmail.com': 'outlook',
    'live.com': 'outlook',
    'msn.com': 'outlook',
    'protonmail.com': 'protonmail',
    'proton.me': 'protonmail',
    'pm.me': 'protonmail',
    'protonmail.ch': 'protonmail',
    'fastmail.com': 'fastmail',
    'fastmail.fm': 'fastmail',
    'zoho.com': 'zoho',
    'icloud.com': 'icloud',
    'me.com': 'icloud',
    'mac.com': 'icloud',
    'yahoo.com': 'yahoo',
    'ymail.com': 'yahoo',
    'rocketmail.com': 'yahoo',
    'gmx.com': 'gmx',
    'gmx.de': 'gmx',
    'gmx.net': 'gmx',
    'tuta.com': 'tutanota',
    'tutanota.com': 'tutanota',
    'web.de': 'webde',
    't-online.de': 't-online',
    'mailbox.org': 'mailbox-org',
    'yandex.com': 'yandex',
    'yandex.ru': 'yandex',
    'ya.ru': 'yandex',
    'mail.ru': 'mailru',
    'inbox.ru': 'mailru',
    'list.ru': 'mailru',
    'bk.ru': 'mailru',
    'hey.com': 'hey',
    'qq.com': 'qq',
    'foxmail.com': 'qq',
    '163.com': 'netease',
    '126.com': 'netease',
    'yeah.net': 'netease',
    'libero.it': 'libero',
    'laposte.net': 'laposte',
    'rediffmail.com': 'rediffmail',
    'rediff.com': 'rediffmail',
    'mail.com': 'mailcom',
    'email.com': 'mailcom',
  };

  const DETECTED_PROVIDER_TO_LOGO: Record<string, string> = {
    'google-workspace': 'google-workspace',
    'microsoft-365': 'outlook',
    fastmail: 'fastmail',
    protonmail: 'protonmail',
    zoho: 'zoho',
    icloud: 'icloud',
  };

  const DOMAIN_TO_FRIENDLY_NAME: Record<string, string> = {
    'gmail.com': 'Gmail',
    'googlemail.com': 'Gmail',
    'outlook.com': 'Outlook',
    'hotmail.com': 'Outlook',
    'live.com': 'Outlook',
    'msn.com': 'Outlook',
    'protonmail.com': 'Proton Mail',
    'proton.me': 'Proton Mail',
    'pm.me': 'Proton Mail',
    'protonmail.ch': 'Proton Mail',
    'fastmail.com': 'Fastmail',
    'fastmail.fm': 'Fastmail',
    'zoho.com': 'Zoho Mail',
    'icloud.com': 'iCloud Mail',
    'me.com': 'iCloud Mail',
    'mac.com': 'iCloud Mail',
    'yahoo.com': 'Yahoo Mail',
    'ymail.com': 'Yahoo Mail',
    'rocketmail.com': 'Yahoo Mail',
    'gmx.com': 'GMX',
    'gmx.de': 'GMX',
    'gmx.net': 'GMX',
    'web.de': 'web.de',
    't-online.de': 'T-Online',
    'tuta.com': 'Tuta',
    'tutanota.com': 'Tuta',
    'mailbox.org': 'Mailbox.org',
    'yandex.com': 'Yandex Mail',
    'yandex.ru': 'Yandex Mail',
    'ya.ru': 'Yandex Mail',
    'mail.ru': 'Mail.ru',
    'inbox.ru': 'Mail.ru',
    'list.ru': 'Mail.ru',
    'bk.ru': 'Mail.ru',
    'hey.com': 'Hey',
    'qq.com': 'QQ Mail',
    'foxmail.com': 'QQ Mail',
    '163.com': 'NetEase',
    '126.com': 'NetEase',
    'yeah.net': 'NetEase',
    'libero.it': 'Libero',
    'laposte.net': 'La Poste',
    'rediffmail.com': 'Rediffmail',
    'rediff.com': 'Rediffmail',
    'mail.com': 'mail.com',
    'email.com': 'mail.com',
  };

  // ── Settings Logic ──

  function getMode(): SelectedMode {
    if (radioPlus.checked) return 'plusAddressing';
    if (radioCatch.checked) return 'catchAll';
    return null;
  }

  function getDisplayMode(): EmailMode {
    return getMode() ?? preferredMode;
  }

  function applyModeSelection(mode: SelectedMode): void {
    radioPlus.checked = mode === 'plusAddressing';
    radioCatch.checked = mode === 'catchAll';
    colPlus.classList.toggle('selected', mode === 'plusAddressing');
    colCatch.classList.toggle('selected', mode === 'catchAll');
  }

  function clearModeSelection(): void {
    applyModeSelection(null);
  }

  function restorePreferredModeSelection(): void {
    if (getMode()) return;

    if (preferredMode === 'plusAddressing' && !colPlus.classList.contains('disabled')) {
      applyModeSelection('plusAddressing');
      return;
    }

    if (preferredMode === 'catchAll' && !colCatch.classList.contains('disabled')) {
      applyModeSelection('catchAll');
      return;
    }

    if (!colPlus.classList.contains('disabled')) {
      applyModeSelection('plusAddressing');
      return;
    }

    if (!colCatch.classList.contains('disabled')) {
      applyModeSelection('catchAll');
    }
  }

  function getDisabledModesForFullEmail(
    domain: string,
    finalStatus: ProviderStatus,
  ): { plus: boolean; catchAll: boolean } {
    const isKnownProvider = getProviderStatus(domain) !== 'custom';
    return {
      plus: isKnownProvider && finalStatus === 'plus-unsupported',
      catchAll: isKnownProvider,
    };
  }

  function getCurrentDraft(): SettingsDraft | null {
    const mode = getMode();
    if (!mode) return null;
    return createSettingsDraft(input.value, mode);
  }

  function clearStatus(): void {
    if (statusTimer) {
      clearTimeout(statusTimer);
      statusTimer = null;
    }
    statusEl.textContent = '';
    statusEl.className = 'status';
  }

  function clearInlineError(): void {
    if (statusEl.classList.contains('error')) {
      clearStatus();
    }
  }

  function setSaveIndicator(state: SaveIndicatorState): void {
    saveStateEl.hidden = false;
    saveStateEl.dataset.state = state;
    saveStateEl.className = `save-state-button is-${state}`;
    saveStateEl.textContent = getSaveIndicatorLabel(state);
  }

  function syncSaveIndicatorFromDraft(): void {
    if (isLoading) return;

    const currentDraft = getCurrentDraft();
    if (
      !activeSavePromise &&
      pendingDraft == null &&
      areSettingsDraftsEqual(currentDraft, lastSavedDraft)
    ) {
      setSaveIndicator('saved');
      return;
    }

    setSaveIndicator('editing');
  }

  function clearScheduledSave(): void {
    if (saveDelayTimer) {
      clearTimeout(saveDelayTimer);
      saveDelayTimer = null;
    }
  }

  function getInputState(value = input.value): InputState {
    const trimmedValue = value.trim();
    const localPart = extractLocalPart(trimmedValue);
    const domain = extractDomainFromEmail(trimmedValue)?.toLowerCase() ?? null;
    const normalizedDomain = trimmedValue.replace(/^@/, '').toLowerCase();
    const isFullEmail = trimmedValue.includes('@') && domain != null && domainRegex.test(domain);

    return {
      trimmedValue,
      normalizedDomain,
      localPart,
      domain,
      isFullEmail,
      plusAllowed: isFullEmail,
      catchAllAllowed: isFullEmail || domainRegex.test(normalizedDomain),
    };
  }

  function setMode(mode: EmailMode, options: { persist?: boolean } = {}): void {
    const { persist = true } = options;
    // Don't allow selecting a disabled mode
    const col = mode === 'plusAddressing' ? colPlus : colCatch;
    if (col.classList.contains('disabled')) return;

    preferredMode = mode;
    applyModeSelection(mode);
    updateFormatDisplay();
    updateExamples();
    if (persist) {
      syncSaveIndicatorFromDraft();
      void requestSave({ immediate: true });
    }
  }

  function setColumnDisabled(col: HTMLDivElement, disabled: boolean): void {
    col.classList.toggle('disabled', disabled);
    col.setAttribute('aria-disabled', disabled ? 'true' : 'false');
  }

  function setFeedback(state: 'info' | 'warning' | 'clear', message: string): void {
    modeFeedbackEl.className = 'mode-feedback';
    modeFeedbackEl.textContent = '';
    if (state === 'clear') {
      modeFeedbackEl.classList.add('is-empty');
      modeFeedbackEl.setAttribute('aria-hidden', 'true');
      return;
    }
    modeFeedbackEl.setAttribute('aria-hidden', 'false');
    if (state === 'warning') {
      modeFeedbackEl.classList.add('feedback-warning');
    }
    modeFeedbackEl.textContent = message;
  }

  function setIndicator(
    el: HTMLSpanElement,
    state: 'supported' | 'possible' | 'incompatible' | null,
  ): void {
    el.className = 'req-indicator';
    if (state) el.classList.add(`req-${state}`);
  }

  function updateRequirementIndicators(
    syncStatus: ProviderStatus,
    mxProviderFound: boolean,
    finalStatus: ProviderStatus,
    providerName: string | null,
  ): void {
    const isCustomDomain = syncStatus === 'custom';
    const providerDetected = !isCustomDomain || mxProviderFound;

    // Plus Addressing: Email Provider
    setIndicator(plusProviderEl, providerDetected ? 'supported' : 'incompatible');
    plusProviderValueEl.textContent = providerDetected
      ? (providerName ?? 'Detected')
      : 'Not Detected';

    // Plus Addressing: Plus Addressing Supported
    if (finalStatus === 'plus-supported') {
      setIndicator(plusSupportEl, 'supported');
      plusSupportValueEl.textContent = 'Supported';
    } else if (finalStatus === 'plus-unsupported') {
      setIndicator(plusSupportEl, 'incompatible');
      plusSupportValueEl.textContent = 'Not Supported';
    } else {
      setIndicator(plusSupportEl, 'possible');
      plusSupportValueEl.textContent = 'Possible';
    }

    // Catch-All: Custom Domain
    if (!isCustomDomain) {
      setIndicator(catchAllDomainEl, 'incompatible');
      catchAllDomainValueEl.textContent = 'No';
    } else if (mxProviderFound) {
      setIndicator(catchAllDomainEl, 'supported');
      catchAllDomainValueEl.textContent = 'Yes';
    } else {
      setIndicator(catchAllDomainEl, 'possible');
      catchAllDomainValueEl.textContent = 'Possible';
    }

    // Catch-All: Catch-All Enabled
    if (isCustomDomain) {
      setIndicator(catchAllEnabledEl, 'possible');
      catchAllEnabledValueEl.textContent = 'Possible';
      showCatchAllInfoIcon();
    } else {
      setIndicator(catchAllEnabledEl, 'incompatible');
      catchAllEnabledValueEl.textContent = 'Not Available';
      hideCatchAllInfoIcon();
    }
  }

  function resetRequirementIndicators(): void {
    setIndicator(plusProviderEl, null);
    setIndicator(plusSupportEl, null);
    setIndicator(catchAllDomainEl, null);
    setIndicator(catchAllEnabledEl, null);
    plusProviderValueEl.textContent = '--';
    plusSupportValueEl.textContent = '--';
    catchAllDomainValueEl.textContent = '--';
    catchAllEnabledValueEl.textContent = '--';
    hideCatchAllInfoIcon();
  }

  function showCatchAllInfoIcon(): void {
    catchAllInfoIconEl.style.display = 'inline-flex';
  }

  function hideCatchAllInfoIcon(): void {
    catchAllInfoIconEl.style.display = 'none';
  }

  function renderHelpPage(): void {
    helpContainerEl.innerHTML = '';
    const allInstructions = getAllCatchAllInstructions();

    for (const { key, instructions } of allInstructions) {
      const isDetected = currentDetectedProvider === key;
      const isWarning = key === 'icloud';
      const collapsed = !isDetected;

      const card = document.createElement('div');
      card.className = `help-provider-card${collapsed ? ' collapsed' : ''}`;

      const header = document.createElement('div');
      header.className = `help-provider-header${isDetected ? ' detected' : ''}`;
      header.innerHTML = `<span class="header-left"><span class="header-chevron"></span>${escapeHtml(instructions.providerName)}</span>${isDetected ? '<span class="detected-badge">Detected</span>' : ''}`;
      header.addEventListener('click', () => {
        card.classList.toggle('collapsed');
      });

      const body = document.createElement('div');
      body.className = `catch-all-instructions${isWarning ? ' warning' : ''}`;

      const ol = document.createElement('ol');
      for (const step of instructions.steps) {
        const li = document.createElement('li');
        li.textContent = step;
        ol.appendChild(li);
      }
      body.appendChild(ol);

      if (instructions.adminUrl) {
        const linksDiv = document.createElement('div');
        linksDiv.className = 'catch-all-links';
        const a = document.createElement('a');
        a.href = instructions.adminUrl;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.textContent = `Open ${instructions.providerName} Admin`;
        linksDiv.appendChild(a);
        body.appendChild(linksDiv);
      }

      if (instructions.notes) {
        const note = document.createElement('p');
        note.className = 'catch-all-note';
        note.textContent = instructions.notes;
        body.appendChild(note);
      }

      card.appendChild(header);
      card.appendChild(body);
      helpContainerEl.appendChild(card);
    }
  }

  function showProviderPlaceholder(): void {
    providerPlaceholderEl.style.display = '';
  }

  function hideProviderPlaceholder(): void {
    providerPlaceholderEl.style.display = 'none';
  }

  function applyProviderStatus(
    domain: string,
    status: ProviderStatus,
    mxResult: MxLookupResult | null,
  ): void {
    // Provider detection display
    const syncStatus = getProviderStatus(domain);
    let providerName: string | null = null;
    if (mxResult?.provider) {
      const info = getProviderInfo(mxResult.provider);
      const logoKey = DETECTED_PROVIDER_TO_LOGO[mxResult.provider] ?? null;
      providerName = info.name;
      showProviderDetection(info.name, logoKey);
    } else if (syncStatus !== 'custom') {
      const friendlyName = DOMAIN_TO_FRIENDLY_NAME[domain] ?? domain;
      const logoKey = DOMAIN_TO_PROVIDER[domain] ?? null;
      providerName = friendlyName;
      showProviderDetection(friendlyName, logoKey);
    } else if (mxResult) {
      hideProviderDetection();
    }

    // Track detected provider for catch-all instructions
    currentDetectedProvider = mxResult?.provider ?? null;

    // Requirement indicators
    updateRequirementIndicators(syncStatus, mxResult?.provider != null, status, providerName);

    const disabled = getDisabledModesForFullEmail(domain, status);
    setColumnDisabled(colPlus, disabled.plus);
    setColumnDisabled(colCatch, disabled.catchAll);
    if (
      (disabled.plus && getMode() === 'plusAddressing') ||
      (disabled.catchAll && getMode() === 'catchAll')
    ) {
      clearModeSelection();
    }
    restorePreferredModeSelection();

    if (disabled.plus && disabled.catchAll) {
      setFeedback('warning', FEEDBACK_MESSAGES.unsupportedProvider);
      return;
    }

    // Feedback bar
    if (status === 'plus-unsupported') {
      setFeedback(
        'warning',
        syncStatus !== 'custom'
          ? FEEDBACK_MESSAGES.unsupportedPlusAddressing
          : FEEDBACK_MESSAGES.possiblyUnsupportedPlusAddressing,
      );
    } else {
      setFeedback('clear', '');
    }
  }

  function showProviderLogo(logoKey: string | null): void {
    const file = logoKey ? PROVIDER_LOGO_FILES[logoKey] : null;
    if (file) {
      providerLogoEl.innerHTML = `<img src="../${file}" width="18" height="18" alt="" />`;
      providerLogoEl.style.display = 'inline-flex';
    } else {
      providerLogoEl.innerHTML = '';
      providerLogoEl.style.display = 'none';
    }
  }

  function showProviderLoading(): void {
    hideProviderPlaceholder();
    showProviderLogo(null);
    providerDetectedEl.style.display = 'flex';
    providerDetectedEl.className = 'provider-detected loading';
    providerTextEl.textContent = 'Checking email provider...';
  }

  function showProviderDetection(providerName: string, logoKey: string | null): void {
    hideProviderPlaceholder();
    showProviderLogo(logoKey);
    providerDetectedEl.style.display = 'flex';
    providerDetectionBoxEl.classList.add('detected');
    providerDetectedEl.className = 'provider-detected';
    providerTextEl.textContent = providerName;
  }

  function hideProviderDetection(): void {
    providerDetectedEl.style.display = 'none';
    showProviderLogo(null);
    providerDetectionBoxEl.classList.remove('detected');
    showProviderPlaceholder();
    currentLookupDomain = null;
  }

  function applyImmediateInputState(state: InputState): void {
    hideProviderDetection();
    resetRequirementIndicators();

    if (state.plusAllowed) {
      const syncStatus = getProviderStatus(state.domain as string);
      const disabled = getDisabledModesForFullEmail(state.domain as string, syncStatus);
      setColumnDisabled(colPlus, disabled.plus);
      setColumnDisabled(colCatch, disabled.catchAll);
      if (
        (disabled.plus && getMode() === 'plusAddressing') ||
        (disabled.catchAll && getMode() === 'catchAll')
      ) {
        clearModeSelection();
      }
      restorePreferredModeSelection();
      if (disabled.plus && disabled.catchAll) {
        setFeedback('warning', FEEDBACK_MESSAGES.unsupportedProvider);
      } else {
        setFeedback('clear', '');
      }
    } else if (!state.trimmedValue) {
      setColumnDisabled(colPlus, true);
      setColumnDisabled(colCatch, true);
      setFeedback('info', FEEDBACK_MESSAGES.enterEmailOrDomain);
    } else if (!state.catchAllAllowed) {
      setColumnDisabled(colPlus, true);
      setColumnDisabled(colCatch, true);
      setFeedback('info', FEEDBACK_MESSAGES.enterValidEmailOrDomain);
    } else {
      setColumnDisabled(colPlus, true);
      setColumnDisabled(colCatch, false);
      setFeedback('info', FEEDBACK_MESSAGES.plusRequiresFullEmail);
      if (getMode() === 'plusAddressing') {
        setMode('catchAll', { persist: false });
      } else {
        restorePreferredModeSelection();
      }
    }

    updateFormatDisplay(state);
    updateExamples(state);
  }

  function updateModeAvailability(state = getInputState()): void {
    hideProviderDetection();
    resetRequirementIndicators();

    if (!state.trimmedValue) {
      return;
    }

    if (!state.isFullEmail) {
      // Domain-only input: Plus Addressing stays disabled, but provider detection still runs
      const cleanValue = state.normalizedDomain;

      if (!state.catchAllAllowed) {
        return;
      }

      // Synchronous provider detection
      const syncStatus = getProviderStatus(cleanValue);
      const isCustomDomain = syncStatus === 'custom';
      let providerName: string | null = null;

      if (!isCustomDomain) {
        const friendlyName = DOMAIN_TO_FRIENDLY_NAME[cleanValue] ?? cleanValue;
        const logoKey = DOMAIN_TO_PROVIDER[cleanValue] ?? null;
        providerName = friendlyName;
        showProviderDetection(friendlyName, logoKey);
      }

      // Plus Addressing indicators (informational, column stays disabled)
      setIndicator(plusProviderEl, !isCustomDomain ? 'supported' : null);
      plusProviderValueEl.textContent = !isCustomDomain ? (providerName ?? 'Detected') : '--';
      if (syncStatus === 'plus-supported') {
        setIndicator(plusSupportEl, 'supported');
        plusSupportValueEl.textContent = 'Supported';
      } else if (syncStatus === 'plus-unsupported') {
        setIndicator(plusSupportEl, 'incompatible');
        plusSupportValueEl.textContent = 'Not Supported';
      } else {
        setIndicator(plusSupportEl, null);
        plusSupportValueEl.textContent = '--';
      }

      // Catch-All indicators
      if (!isCustomDomain) {
        setIndicator(catchAllDomainEl, 'incompatible');
        catchAllDomainValueEl.textContent = 'No';
        setIndicator(catchAllEnabledEl, 'incompatible');
        catchAllEnabledValueEl.textContent = 'Not Available';
        hideCatchAllInfoIcon();
      } else {
        setIndicator(catchAllDomainEl, 'supported');
        catchAllDomainValueEl.textContent = 'Yes';
        setIndicator(catchAllEnabledEl, 'possible');
        catchAllEnabledValueEl.textContent = 'Possible';
        showCatchAllInfoIcon();

        // Async MX lookup for custom domains
        currentLookupDomain = cleanValue;
        showProviderLoading();
        getProviderStatusWithMx(cleanValue)
          .then(({ status: mxStatus, mxResult }) => {
            if (currentLookupDomain !== cleanValue) return;

            if (mxResult?.provider) {
              const info = getProviderInfo(mxResult.provider);
              const logoKey = DETECTED_PROVIDER_TO_LOGO[mxResult.provider] ?? null;
              showProviderDetection(info.name, logoKey);

              setIndicator(plusProviderEl, 'supported');
              plusProviderValueEl.textContent = info.name;
              setIndicator(catchAllDomainEl, 'supported');
              catchAllDomainValueEl.textContent = 'Yes';
            } else if (mxResult) {
              hideProviderDetection();
              setIndicator(plusProviderEl, 'incompatible');
              plusProviderValueEl.textContent = 'Not Detected';
              setIndicator(catchAllDomainEl, 'possible');
              catchAllDomainValueEl.textContent = 'Possible';
            }

            if (mxStatus === 'plus-supported') {
              setIndicator(plusSupportEl, 'supported');
              plusSupportValueEl.textContent = 'Supported';
            } else if (mxStatus === 'plus-unsupported') {
              setIndicator(plusSupportEl, 'incompatible');
              plusSupportValueEl.textContent = 'Not Supported';
            } else {
              setIndicator(plusSupportEl, 'possible');
              plusSupportValueEl.textContent = 'Possible';
            }

            currentDetectedProvider = mxResult?.provider ?? null;
            showCatchAllInfoIcon();
          })
          .catch(() => {
            if (currentLookupDomain === cleanValue) {
              hideProviderDetection();
            }
          });
      }
      return;
    }

    // Synchronous check first
    const status = getProviderStatus(state.domain as string);
    applyProviderStatus(state.domain as string, status, null);

    // If custom domain, try MX lookup
    if (status === 'custom') {
      currentLookupDomain = state.domain as string;
      showProviderLoading();
      getProviderStatusWithMx(state.domain as string)
        .then(({ status: mxStatus, mxResult }) => {
          if (currentLookupDomain === state.domain) {
            applyProviderStatus(state.domain as string, mxStatus, mxResult);
          }
        })
        .catch(() => {
          if (currentLookupDomain === state.domain) {
            hideProviderDetection();
          }
        });
    }
  }

  function updateFormatDisplay(state = getInputState()): void {
    const mode = getDisplayMode();

    if (mode === 'plusAddressing') {
      plusFormatEl.textContent = `${state.localPart || 'name'}+example.com@${state.domain || 'gmail.com'}`;
    } else {
      catchAllFormatEl.textContent = `example.com@${state.domain || state.trimmedValue || 'yourdomain.com'}`;
    }
  }

  function updateExamples(state = getInputState()): void {
    const mode = getDisplayMode();

    if (mode === 'plusAddressing') {
      for (let i = 0; i < exampleEls.length; i++) {
        const site = exampleEls[i].dataset.site;
        if (site)
          exampleEls[i].textContent =
            `${state.localPart || 'name'}+${site}@${state.domain || 'gmail.com'}`;
      }
    } else {
      for (let i = 0; i < exampleEls.length; i++) {
        const site = exampleEls[i].dataset.site;
        if (site) {
          exampleEls[i].textContent =
            `${site}@${state.domain || state.trimmedValue || 'yourdomain.com'}`;
        }
      }
    }
  }

  async function loadSettings(profileEmail: string | null): Promise<void> {
    try {
      const result = await chrome.storage.sync.get(['emailDomain', 'emailMode', 'baseEmail']);
      const hasSavedSettings = result.emailMode || result.emailDomain || result.baseEmail;

      if (hasSavedSettings) {
        const mode: EmailMode = (result.emailMode as EmailMode) ?? 'catchAll';
        preferredMode = mode;
        if (result.baseEmail) {
          input.value = result.baseEmail as string;
        } else if (result.emailDomain) {
          input.value = result.emailDomain as string;
        }
        const state = getInputState();
        applyImmediateInputState(state);
        updateModeAvailability(state);
        setMode(mode, { persist: false });
        lastSavedDraft = createSettingsDraft(input.value, mode);
        setSaveIndicator(lastSavedDraft ? 'saved' : 'editing');
      } else if (profileEmail) {
        // No saved settings, auto-configure with Chrome profile email
        preferredMode = 'plusAddressing';
        input.value = profileEmail;
        const state = getInputState();
        applyImmediateInputState(state);
        updateModeAvailability(state);
        setMode('plusAddressing', { persist: false });
        await requestSave({ immediate: true });
        showStatus('Settings auto-configured from your Chrome profile', 'success');
      } else {
        preferredMode = 'plusAddressing';
        const state = getInputState();
        applyImmediateInputState(state);
        updateModeAvailability(state);
        lastSavedDraft = null;
        setSaveIndicator('editing');
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
      setSaveIndicator('error');
      showStatus('Failed to load settings', 'error');
    }
  }

  async function persistDraft(draft: SettingsDraft): Promise<void> {
    await chrome.storage.sync.set(draft.storagePayload);

    if (!('baseEmail' in draft.storagePayload)) {
      await chrome.storage.sync.remove(['baseEmail']);
    }

    if (input.value !== draft.canonicalInputValue) {
      input.value = draft.canonicalInputValue;
      const normalizedState = getInputState();
      applyImmediateInputState(normalizedState);
      updateModeAvailability(normalizedState);
    }
  }

  async function flushPendingSave(): Promise<void> {
    if (activeSavePromise) return activeSavePromise;

    activeSavePromise = (async () => {
      while (pendingDraft) {
        const draftToSave = pendingDraft;
        pendingDraft = null;
        setSaveIndicator('saving');

        try {
          await persistDraft(draftToSave);
          lastSavedDraft = draftToSave;
          clearInlineError();

          const currentDraft = getCurrentDraft();
          if (pendingDraft == null && areSettingsDraftsEqual(currentDraft, draftToSave)) {
            setSaveIndicator('saved');
          } else {
            setSaveIndicator('editing');
          }
        } catch (error) {
          setSaveIndicator('error');
          showStatus(
            `Error saving settings: ${error instanceof Error ? error.message : 'Unknown error'}`,
            'error',
          );

          if (pendingDraft == null) {
            break;
          }
        }
      }
    })().finally(() => {
      activeSavePromise = null;
      if (pendingDraft) {
        void flushPendingSave();
      }
    });

    return activeSavePromise;
  }

  function requestSave(options: { immediate: boolean }): Promise<void> | void {
    const { immediate } = options;
    const draft = getCurrentDraft();

    if (!draft) {
      pendingDraft = null;
      clearScheduledSave();
      if (!activeSavePromise) {
        setSaveIndicator('editing');
      }
      return;
    }

    if (!activeSavePromise && areSettingsDraftsEqual(draft, lastSavedDraft)) {
      pendingDraft = null;
      clearScheduledSave();
      setSaveIndicator('saved');
      return;
    }

    pendingDraft = draft;

    if (immediate) {
      clearScheduledSave();
      return flushPendingSave();
    }

    clearScheduledSave();
    saveDelayTimer = setTimeout(() => {
      saveDelayTimer = null;
      void flushPendingSave();
    }, 300);
  }

  async function loadChromeProfileEmail(): Promise<string | null> {
    try {
      const userInfo = await chrome.identity.getProfileUserInfo({ accountStatus: 'ANY' });
      if (userInfo.email) {
        profileEmailEl.textContent = userInfo.email;
        chromeDetectionBoxEl.classList.add('detected');
        return userInfo.email;
      }
    } catch {
      // Silently fail
    }
    return null;
  }

  async function importChromeEmail(): Promise<void> {
    const email = profileEmailEl.textContent;
    if (!email || email === 'Not detected') return;
    input.value = email;
    const state = getInputState();
    applyImmediateInputState(state);
    updateModeAvailability(state);
    showStatus('Email imported', 'success');
    await requestSave({ immediate: true });
  }

  function selectRecommendedMode(): void {
    if (!colPlus.classList.contains('disabled')) {
      setMode('plusAddressing');
    } else if (!colCatch.classList.contains('disabled')) {
      setMode('catchAll');
    }
  }

  function showStatus(message: string, type: 'success' | 'error'): void {
    if (statusTimer) {
      clearTimeout(statusTimer);
    }
    statusEl.textContent = message;
    statusEl.className = `status ${type}`;

    statusTimer = setTimeout(() => {
      statusTimer = null;
      clearStatus();
    }, 3000);
  }

  const debouncedUpdate = debounce
    ? debounce(() => {
        const state = getInputState();
        updateModeAvailability(state);
      }, 300)
    : () => {
        const state = getInputState();
        updateModeAvailability(state);
      };

  // Settings event listeners
  formEl.addEventListener('submit', (e) => e.preventDefault());
  profileEmailEl.addEventListener('click', () => {
    void importChromeEmail();
  });
  providerDetectedEl.addEventListener('click', selectRecommendedMode);
  input.addEventListener('input', () => {
    const state = getInputState();
    applyImmediateInputState(state);
    syncSaveIndicatorFromDraft();
    debouncedUpdate();
    void requestSave({ immediate: false });
  });

  colPlus.addEventListener('click', () => setMode('plusAddressing'));
  colCatch.addEventListener('click', () => setMode('catchAll'));
  catchAllInfoIconEl.addEventListener('click', (e) => {
    e.stopPropagation();
    switchPage('help');
  });

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
  isLoading = false;
});
