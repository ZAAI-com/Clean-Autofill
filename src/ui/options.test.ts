import { afterEach, beforeAll, beforeEach, describe, expect, mock, test } from 'bun:test';
import { domainRegex, extractDomainFromEmail, getProviderStatus } from '../email/providers.js';

let createSettingsDraft: typeof import('./options.js').createSettingsDraft;
let areSettingsDraftsEqual: typeof import('./options.js').areSettingsDraftsEqual;
let getSaveIndicatorLabel: typeof import('./options.js').getSaveIndicatorLabel;

// Load utils first
beforeAll(async () => {
  await import('../email/utils.js');
  const optionsModule = await import('./options.js');
  createSettingsDraft = optionsModule.createSettingsDraft;
  areSettingsDraftsEqual = optionsModule.areSettingsDraftsEqual;
  getSaveIndicatorLabel = optionsModule.getSaveIndicatorLabel;
});

// Mock chrome API
const mockStorage: Record<string, unknown> = {};
const mockLocalStorage: Record<string, unknown> = {};
const mockChrome = {
  storage: {
    sync: {
      get: mock(async (keys: string[]) => {
        const result: Record<string, unknown> = {};
        for (const key of keys) {
          if (mockStorage[key] !== undefined) {
            result[key] = mockStorage[key];
          }
        }
        return result;
      }),
      set: mock(async (items: Record<string, unknown>) => {
        Object.assign(mockStorage, items);
      }),
      remove: mock(async (keys: string[]) => {
        for (const key of keys) {
          delete mockStorage[key];
        }
      }),
    },
    local: {
      get: mock(async (key: string) => {
        const value = mockLocalStorage[key];
        return value !== undefined ? { [key]: value } : {};
      }),
      set: mock(async (items: Record<string, unknown>) => {
        Object.assign(mockLocalStorage, items);
      }),
      remove: mock(async (key: string) => {
        delete mockLocalStorage[key];
      }),
    },
  },
  tabs: {
    query: mock(async () => [{ url: 'https://example.com/page' }]),
  },
  identity: {
    getProfileUserInfo: mock(async (_details?: { accountStatus?: string }) => ({
      email: 'user@example.com',
      id: '12345',
    })),
  },
};

(globalThis as Record<string, unknown>).chrome = mockChrome;

const mockFetch = mock(async () => ({
  ok: true,
  status: 200,
  json: async () => ({ Status: 3 }),
}));

(globalThis as Record<string, unknown>).fetch = mockFetch;

function setupOptionsDOM(): void {
  document.body.innerHTML = `
    <div class="nav-item" data-page="settings"></div>
    <div class="page" id="page-settings"></div>
    <div class="page" id="page-history"></div>
    <div class="page" id="page-help"></div>
    <div id="saveStateIndicator" hidden></div>
    <form id="settingsForm">
      <input id="emailInput" type="text" />
      <div id="status" class="status"></div>
      <span id="chromeProfileEmail">Not detected</span>
      <div id="colPlusAddressing" class="mode-column"></div>
      <div id="colCatchAll" class="mode-column"></div>
      <input type="radio" id="modePlusAddressing" name="emailMode" value="plusAddressing" />
      <input type="radio" id="modeCatchAll" name="emailMode" value="catchAll" />
      <code id="plusFormat"></code>
      <code id="catchAllFormat"></code>
      <div id="modeFeedback" class="mode-feedback is-empty" aria-hidden="true"></div>
      <div id="providerDetected" style="display: none;"></div>
      <span id="providerText"></span>
      <span id="providerPlaceholder"></span>
      <span id="providerLogo"></span>
      <span id="plusProviderIndicator"></span>
      <span id="plusSupportIndicator"></span>
      <span id="catchAllDomainIndicator"></span>
      <span id="catchAllEnabledIndicator"></span>
      <span id="plusProviderValue"></span>
      <span id="plusSupportValue"></span>
      <span id="catchAllDomainValue"></span>
      <span id="catchAllEnabledValue"></span>
      <div id="detectionChromeProfile"></div>
      <div id="detectionProvider"></div>
      <span id="catchAllInfoIcon" style="display: none;"></span>
      <div id="helpProvidersContainer"></div>
    </form>
    <code class="example-email" data-site="amazon.com"></code>
    <code class="example-email" data-site="github.com"></code>
    <table id="historyTable"><tbody id="historyBody"></tbody></table>
    <div id="historyEmpty"></div>
    <input id="historySearch" />
    <button id="clearHistoryButton" type="button">Clear</button>
  `;
}

function getOptionsElements() {
  return {
    input: document.getElementById('emailInput') as HTMLInputElement,
    saveState: document.getElementById('saveStateIndicator') as HTMLDivElement,
    status: document.getElementById('status') as HTMLDivElement,
    modeFeedback: document.getElementById('modeFeedback') as HTMLDivElement,
    profileEmail: document.getElementById('chromeProfileEmail') as HTMLSpanElement,
    colPlus: document.getElementById('colPlusAddressing') as HTMLDivElement,
    colCatch: document.getElementById('colCatchAll') as HTMLDivElement,
    radioPlus: document.getElementById('modePlusAddressing') as HTMLInputElement,
    radioCatch: document.getElementById('modeCatchAll') as HTMLInputElement,
  };
}

async function initOptionsPage(): Promise<void> {
  setupOptionsDOM();
  document.dispatchEvent(new Event('DOMContentLoaded'));
  await new Promise((resolve) => setTimeout(resolve, 0));
}

async function waitForDebounce(ms = 350): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

// Test-only helpers

function cleanDomain(domain: string): string {
  return domain.trim().replace(/^@/, '');
}

function generateExampleEmail(siteDomain: string, userDomain: string): string {
  return `${siteDomain}@${userDomain}`;
}

function generatePlusAddressEmail(siteDomain: string, baseEmail: string): string | null {
  const trimmed = baseEmail.trim();
  if (!trimmed) return null;
  const atIndex = trimmed.lastIndexOf('@');
  if (atIndex <= 0 || atIndex === trimmed.length - 1) return null;
  const localPart = trimmed.substring(0, atIndex);
  const domain = trimmed.substring(atIndex + 1);
  return `${localPart}+${siteDomain}@${domain}`;
}

function isValidBaseEmail(email: string): boolean {
  const trimmed = email.trim();
  if (!trimmed) return false;
  const atIndex = trimmed.lastIndexOf('@');
  if (atIndex <= 0 || atIndex === trimmed.length - 1) return false;
  const domain = trimmed.substring(atIndex + 1);
  return domainRegex.test(domain);
}

describe('cleanDomain', () => {
  test('removes leading @ symbol', () => {
    expect(cleanDomain('@example.com')).toBe('example.com');
  });

  test('trims whitespace', () => {
    expect(cleanDomain('  example.com  ')).toBe('example.com');
  });

  test('handles both whitespace and @', () => {
    expect(cleanDomain('  @example.com  ')).toBe('example.com');
  });

  test('leaves valid domain unchanged', () => {
    expect(cleanDomain('example.com')).toBe('example.com');
  });

  test('only removes first @ symbol', () => {
    expect(cleanDomain('@user@example.com')).toBe('user@example.com');
  });
});

describe('generateExampleEmail (catch-all)', () => {
  test('generates correct email format', () => {
    expect(generateExampleEmail('google.com', 'mydomain.com')).toBe('google.com@mydomain.com');
  });

  test('works with subdomain user domain', () => {
    expect(generateExampleEmail('github.com', 'mail.mydomain.com')).toBe(
      'github.com@mail.mydomain.com',
    );
  });

  test('works with short domains', () => {
    expect(generateExampleEmail('x.com', 'mg.de')).toBe('x.com@mg.de');
  });
});

describe('generatePlusAddressEmail', () => {
  test('generates correct plus-addressed email', () => {
    expect(generatePlusAddressEmail('zalando.de', 'name@gmail.com')).toBe(
      'name+zalando.de@gmail.com',
    );
  });

  test('works with company email', () => {
    expect(generatePlusAddressEmail('salesforce.com', 'employee@company.com')).toBe(
      'employee+salesforce.com@company.com',
    );
  });

  test('handles local part with dots', () => {
    expect(generatePlusAddressEmail('amazon.com', 'first.last@gmail.com')).toBe(
      'first.last+amazon.com@gmail.com',
    );
  });

  test('works with all 7 example sites', () => {
    const sites = [
      'wikipedia.org',
      'amazon.com',
      'zalando.de',
      'ui.com',
      'cloudflare.com',
      'claude.ai',
      'netflix.com',
    ];
    for (const site of sites) {
      const result = generatePlusAddressEmail(site, 'name@gmail.com');
      expect(result).toBe(`name+${site}@gmail.com`);
    }
  });

  test('returns null for empty base email', () => {
    expect(generatePlusAddressEmail('example.com', '')).toBeNull();
  });

  test('returns null for base email without @', () => {
    expect(generatePlusAddressEmail('example.com', 'invalid-email')).toBeNull();
  });

  test('returns null for base email starting with @', () => {
    expect(generatePlusAddressEmail('example.com', '@gmail.com')).toBeNull();
  });

  test('returns null for base email ending with @', () => {
    expect(generatePlusAddressEmail('example.com', 'name@')).toBeNull();
  });

  test('trims whitespace', () => {
    expect(generatePlusAddressEmail('example.com', '  name@gmail.com  ')).toBe(
      'name+example.com@gmail.com',
    );
  });
});

describe('isValidBaseEmail', () => {
  test('accepts valid email', () => {
    expect(isValidBaseEmail('user@example.com')).toBe(true);
  });

  test('accepts email with dots in local part', () => {
    expect(isValidBaseEmail('first.last@example.com')).toBe(true);
  });

  test('accepts email with plus in local part', () => {
    expect(isValidBaseEmail('user+tag@example.com')).toBe(true);
  });

  test('rejects empty string', () => {
    expect(isValidBaseEmail('')).toBe(false);
  });

  test('rejects email without @', () => {
    expect(isValidBaseEmail('invalid-email')).toBe(false);
  });

  test('rejects email with invalid domain', () => {
    expect(isValidBaseEmail('user@localhost')).toBe(false);
  });

  test('rejects email with no local part', () => {
    expect(isValidBaseEmail('@example.com')).toBe(false);
  });

  test('rejects email ending with @', () => {
    expect(isValidBaseEmail('user@')).toBe(false);
  });
});

describe('chrome storage mock', () => {
  beforeEach(() => {
    for (const key of Object.keys(mockStorage)) {
      delete mockStorage[key];
    }
  });

  test('can set and get emailDomain', async () => {
    await mockChrome.storage.sync.set({ emailDomain: 'test.com' });
    const result = await mockChrome.storage.sync.get(['emailDomain']);
    expect(result.emailDomain).toBe('test.com');
  });

  test('can set and get emailMode', async () => {
    await mockChrome.storage.sync.set({ emailMode: 'plusAddressing' });
    const result = await mockChrome.storage.sync.get(['emailMode']);
    expect(result.emailMode).toBe('plusAddressing');
  });

  test('can set and get baseEmail', async () => {
    await mockChrome.storage.sync.set({ baseEmail: 'name@gmail.com' });
    const result = await mockChrome.storage.sync.get(['baseEmail']);
    expect(result.baseEmail).toBe('name@gmail.com');
  });

  test('can get all three keys at once', async () => {
    await mockChrome.storage.sync.set({
      emailMode: 'plusAddressing',
      baseEmail: 'name@gmail.com',
      emailDomain: 'old.com',
    });
    const result = await mockChrome.storage.sync.get(['emailDomain', 'emailMode', 'baseEmail']);
    expect(result.emailMode).toBe('plusAddressing');
    expect(result.baseEmail).toBe('name@gmail.com');
    expect(result.emailDomain).toBe('old.com');
  });

  test('returns empty object for missing keys', async () => {
    const result = await mockChrome.storage.sync.get(['nonexistent']);
    expect(result).toEqual({});
  });

  test('can remove all settings keys', async () => {
    await mockChrome.storage.sync.set({
      emailMode: 'plusAddressing',
      baseEmail: 'name@gmail.com',
      emailDomain: 'old.com',
    });
    await mockChrome.storage.sync.remove(['emailDomain', 'emailMode', 'baseEmail']);
    const result = await mockChrome.storage.sync.get(['emailDomain', 'emailMode', 'baseEmail']);
    expect(result).toEqual({});
  });
});

describe('chrome profile import', () => {
  beforeEach(() => {
    mockChrome.identity.getProfileUserInfo = mock(async () => ({
      email: 'user@example.com',
      id: '12345',
    }));
  });

  test('extracts domain from chrome profile email', async () => {
    const userInfo = await mockChrome.identity.getProfileUserInfo({ accountStatus: 'ANY' });
    const domain = extractDomainFromEmail(userInfo.email);
    expect(domain).toBe('example.com');
  });

  test('extracts full email for plus addressing mode', async () => {
    const userInfo = await mockChrome.identity.getProfileUserInfo({ accountStatus: 'ANY' });
    expect(userInfo.email).toBe('user@example.com');
    // In plus addressing mode, the full email is used directly
    const plusEmail = generatePlusAddressEmail('zalando.de', userInfo.email);
    expect(plusEmail).toBe('user+zalando.de@example.com');
  });

  test('handles empty email (not signed in)', async () => {
    mockChrome.identity.getProfileUserInfo = mock(async () => ({
      email: '',
      id: '',
    }));
    const userInfo = await mockChrome.identity.getProfileUserInfo({ accountStatus: 'ANY' });
    const domain = extractDomainFromEmail(userInfo.email);
    expect(domain).toBeNull();
  });

  test('handles API error gracefully', async () => {
    mockChrome.identity.getProfileUserInfo = mock(async () => {
      throw new Error('API unavailable');
    });
    await expect(mockChrome.identity.getProfileUserInfo({ accountStatus: 'ANY' })).rejects.toThrow(
      'API unavailable',
    );
  });
});

describe('domain-only provider detection', () => {
  function cleanDomainInput(value: string): string {
    return value.replace(/^@/, '').toLowerCase();
  }

  test('domainRegex accepts valid domain-only input', () => {
    expect(domainRegex.test('manuelgruber.com')).toBe(true);
    expect(domainRegex.test('gmail.com')).toBe(true);
    expect(domainRegex.test('my-company.co.uk')).toBe(true);
  });

  test('domainRegex rejects incomplete domains', () => {
    expect(domainRegex.test('gmai')).toBe(false);
    expect(domainRegex.test('hello')).toBe(false);
    expect(domainRegex.test('')).toBe(false);
  });

  test('cleanDomainInput strips leading @', () => {
    expect(cleanDomainInput('@gmail.com')).toBe('gmail.com');
    expect(cleanDomainInput('gmail.com')).toBe('gmail.com');
    expect(cleanDomainInput('@MyDomain.COM')).toBe('mydomain.com');
  });

  test('getProviderStatus works with bare domains', () => {
    expect(getProviderStatus('gmail.com')).toBe('plus-supported');
    expect(getProviderStatus('yahoo.com')).toBe('plus-unsupported');
    expect(getProviderStatus('manuelgruber.com')).toBe('custom');
  });

  test('getProviderStatus is case-insensitive', () => {
    expect(getProviderStatus('Gmail.com')).toBe('plus-supported');
    expect(getProviderStatus('YAHOO.COM')).toBe('plus-unsupported');
  });
});

describe('auto-save defaults on options page load', () => {
  beforeEach(() => {
    // Reset storage
    for (const key of Object.keys(mockStorage)) {
      delete mockStorage[key];
    }
    // Reset identity mock
    mockChrome.identity.getProfileUserInfo = mock(async () => ({
      email: 'user@example.com',
      id: '12345',
    }));
  });

  test('auto-saves when no settings exist and profile email is available', async () => {
    const profileEmail = 'user@gmail.com';
    // Simulate loadSettings logic: no saved settings + profile email available
    const result = await mockChrome.storage.sync.get(['emailDomain', 'emailMode', 'baseEmail']);
    const hasSavedSettings = result.emailMode || result.emailDomain || result.baseEmail;

    if (!hasSavedSettings && profileEmail) {
      await mockChrome.storage.sync.set({ emailMode: 'plusAddressing', baseEmail: profileEmail });
    }

    expect(mockStorage.emailMode).toBe('plusAddressing');
    expect(mockStorage.baseEmail).toBe('user@gmail.com');
  });

  test('does not auto-save when settings already exist', async () => {
    mockStorage.emailMode = 'catchAll';
    mockStorage.emailDomain = 'mg.de';

    const profileEmail = 'user@gmail.com';
    const result = await mockChrome.storage.sync.get(['emailDomain', 'emailMode', 'baseEmail']);
    const hasSavedSettings = result.emailMode || result.emailDomain || result.baseEmail;

    if (!hasSavedSettings && profileEmail) {
      await mockChrome.storage.sync.set({ emailMode: 'plusAddressing', baseEmail: profileEmail });
    }

    expect(mockStorage.emailMode).toBe('catchAll');
    expect(mockStorage.emailDomain).toBe('mg.de');
  });

  test('does not auto-save when no profile email is available', async () => {
    const profileEmail: string | null = null;
    const result = await mockChrome.storage.sync.get(['emailDomain', 'emailMode', 'baseEmail']);
    const hasSavedSettings = result.emailMode || result.emailDomain || result.baseEmail;

    if (!hasSavedSettings && profileEmail) {
      await mockChrome.storage.sync.set({ emailMode: 'plusAddressing', baseEmail: profileEmail });
    }

    expect(mockStorage.emailMode).toBeUndefined();
    expect(mockStorage.baseEmail).toBeUndefined();
  });
});

describe('status message types', () => {
  test('returns the correct label for each header save state', () => {
    expect(getSaveIndicatorLabel('editing')).toBe('Editing…');
    expect(getSaveIndicatorLabel('saving')).toBe('Saving…');
    expect(getSaveIndicatorLabel('saved')).toBe('Saved');
    expect(getSaveIndicatorLabel('error')).toBe('Save failed');
  });
});

describe('settings draft helpers', () => {
  test('creates a plus-addressing draft from a valid email', () => {
    expect(createSettingsDraft('name@gmail.com', 'plusAddressing')).toEqual({
      mode: 'plusAddressing',
      canonicalInputValue: 'name@gmail.com',
      storagePayload: {
        emailMode: 'plusAddressing',
        emailDomain: 'gmail.com',
        baseEmail: 'name@gmail.com',
      },
    });
  });

  test('creates a catch-all draft from a bare domain', () => {
    expect(createSettingsDraft('example.com', 'catchAll')).toEqual({
      mode: 'catchAll',
      canonicalInputValue: 'example.com',
      storagePayload: {
        emailMode: 'catchAll',
        emailDomain: 'example.com',
      },
    });
  });

  test('creates a catch-all draft from a leading-at domain', () => {
    expect(createSettingsDraft('@Example.COM', 'catchAll')).toEqual({
      mode: 'catchAll',
      canonicalInputValue: 'example.com',
      storagePayload: {
        emailMode: 'catchAll',
        emailDomain: 'example.com',
      },
    });
  });

  test('creates a catch-all draft from a full email without collapsing the input value', () => {
    expect(createSettingsDraft('User@Example.com', 'catchAll')).toEqual({
      mode: 'catchAll',
      canonicalInputValue: 'User@Example.com',
      storagePayload: {
        emailMode: 'catchAll',
        emailDomain: 'example.com',
        baseEmail: 'User@Example.com',
      },
    });
  });

  test('returns null for incomplete or invalid input', () => {
    expect(createSettingsDraft('name@', 'plusAddressing')).toBeNull();
    expect(createSettingsDraft('exam', 'catchAll')).toBeNull();
    expect(createSettingsDraft('', 'catchAll')).toBeNull();
  });

  test('compares drafts by payload and canonical input', () => {
    const left = createSettingsDraft('name@gmail.com', 'plusAddressing');
    const right = createSettingsDraft('name@gmail.com', 'plusAddressing');
    const different = createSettingsDraft('other@gmail.com', 'plusAddressing');

    expect(areSettingsDraftsEqual(left, right)).toBe(true);
    expect(areSettingsDraftsEqual(left, different)).toBe(false);
    expect(areSettingsDraftsEqual(left, null)).toBe(false);
  });
});

describe('options page integration', () => {
  beforeEach(() => {
    for (const key of Object.keys(mockStorage)) {
      delete mockStorage[key];
    }
    for (const key of Object.keys(mockLocalStorage)) {
      delete mockLocalStorage[key];
    }
    mockChrome.storage.sync.get.mockClear();
    mockChrome.storage.sync.set.mockClear();
    mockChrome.storage.sync.remove.mockClear();
    mockChrome.storage.local.get.mockClear();
    mockChrome.storage.local.set.mockClear();
    mockChrome.storage.local.remove.mockClear();
    mockChrome.identity.getProfileUserInfo = mock(async () => ({
      email: 'user@gmail.com',
      id: '12345',
    }));
    mockFetch.mockClear();
  });

  afterEach(async () => {
    await waitForDebounce();
    document.body.innerHTML = '';
  });

  test('shows full email on load when catch-all mode and baseEmail are both saved', async () => {
    mockStorage.emailMode = 'catchAll';
    mockStorage.emailDomain = 'mg.de';
    mockStorage.baseEmail = 'user@gmail.com';

    await initOptionsPage();
    const { input, colCatch, colPlus, saveState, status } = getOptionsElements();

    expect(input.value).toBe('user@gmail.com');
    expect(colCatch.classList.contains('disabled')).toBe(true);
    expect(colCatch.classList.contains('selected')).toBe(false);
    expect(colPlus.classList.contains('selected')).toBe(true);
    expect(saveState.textContent).toBe('Saved');
    expect(saveState.dataset.state).toBe('saved');
    expect(status.textContent).toBe('');
    expect(status.classList.contains('success')).toBe(false);
    expect(status.classList.contains('error')).toBe(false);
  });

  test('imports Chrome profile email and auto-selects plus addressing for known providers', async () => {
    mockStorage.emailMode = 'catchAll';
    mockStorage.emailDomain = 'gmail.com';

    await initOptionsPage();
    const { input, profileEmail, colPlus, colCatch, saveState, status } = getOptionsElements();

    profileEmail.click();
    await waitForDebounce(20);

    expect(input.value).toBe('user@gmail.com');
    expect(colCatch.classList.contains('disabled')).toBe(true);
    expect(colPlus.classList.contains('selected')).toBe(true);
    expect(mockStorage.emailMode).toBe('plusAddressing');
    expect(mockStorage.emailDomain).toBe('gmail.com');
    expect(mockStorage.baseEmail).toBe('user@gmail.com');
    expect(saveState.textContent).toBe('Saved');
    expect(status.textContent).toBe('Email imported');
  });

  test('imports Chrome profile email and preserves plus mode when already selected', async () => {
    mockStorage.emailMode = 'plusAddressing';
    mockStorage.emailDomain = 'yahoo.com';
    mockStorage.baseEmail = 'old@yahoo.com';

    await initOptionsPage();
    const { input, profileEmail, colPlus } = getOptionsElements();

    profileEmail.click();
    await waitForDebounce(20);

    expect(input.value).toBe('user@gmail.com');
    expect(colPlus.classList.contains('selected')).toBe(true);
    expect(mockStorage.emailMode).toBe('plusAddressing');
    expect(mockStorage.emailDomain).toBe('gmail.com');
    expect(mockStorage.baseEmail).toBe('user@gmail.com');
  });

  test('disables plus immediately for domain-only input and prevents reselection', async () => {
    mockStorage.emailMode = 'plusAddressing';
    mockStorage.emailDomain = 'mycorp.com';
    mockStorage.baseEmail = 'user@mycorp.com';

    await initOptionsPage();
    const { input, colPlus, colCatch, radioPlus, radioCatch } = getOptionsElements();

    expect(colPlus.classList.contains('selected')).toBe(true);

    input.value = 'mycorp.com';
    input.dispatchEvent(new Event('input', { bubbles: true }));

    expect(colPlus.classList.contains('disabled')).toBe(true);
    expect(colCatch.classList.contains('disabled')).toBe(false);
    expect(radioPlus.checked).toBe(false);
    expect(radioCatch.checked).toBe(true);
    expect(colCatch.classList.contains('selected')).toBe(true);

    colPlus.click();

    expect(radioPlus.checked).toBe(false);
    expect(radioCatch.checked).toBe(true);

    await waitForDebounce();

    expect(mockStorage.emailMode).toBe('catchAll');
    expect(mockStorage.emailDomain).toBe('mycorp.com');
    expect(mockStorage.baseEmail).toBeUndefined();
  });

  test('saving a full email while catch-all stays selected preserves the full field value', async () => {
    mockStorage.emailMode = 'catchAll';
    mockStorage.emailDomain = 'mycorp.com';

    await initOptionsPage();
    const { input, colCatch } = getOptionsElements();

    input.value = 'worker@mycorp.com';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await waitForDebounce();

    expect(colCatch.classList.contains('selected')).toBe(true);
    expect(input.value).toBe('worker@mycorp.com');
    expect(mockStorage.emailMode).toBe('catchAll');
    expect(mockStorage.emailDomain).toBe('mycorp.com');
    expect(mockStorage.baseEmail).toBe('worker@mycorp.com');
  });

  test('defaults to plus addressing for first-time supported full-email input', async () => {
    mockChrome.identity.getProfileUserInfo = mock(async () => ({
      email: '',
      id: '',
    }));

    await initOptionsPage();
    const { input, colPlus, colCatch } = getOptionsElements();

    input.value = 'worker@gmail.com';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await waitForDebounce();

    expect(colPlus.classList.contains('selected')).toBe(true);
    expect(colCatch.classList.contains('selected')).toBe(false);
    expect(mockStorage.emailMode).toBe('plusAddressing');
    expect(mockStorage.emailDomain).toBe('gmail.com');
    expect(mockStorage.baseEmail).toBe('worker@gmail.com');
  });

  test('saving domain-only input clears baseEmail and reloads as domain-only', async () => {
    mockStorage.emailMode = 'plusAddressing';
    mockStorage.emailDomain = 'mycorp.com';
    mockStorage.baseEmail = 'user@mycorp.com';

    await initOptionsPage();
    let elements = getOptionsElements();

    elements.input.value = 'mycorp.com';
    elements.input.dispatchEvent(new Event('input', { bubbles: true }));
    await waitForDebounce();

    expect(mockStorage.emailMode).toBe('catchAll');
    expect(mockStorage.emailDomain).toBe('mycorp.com');
    expect(mockStorage.baseEmail).toBeUndefined();

    await initOptionsPage();
    elements = getOptionsElements();

    expect(elements.input.value).toBe('mycorp.com');
    expect(elements.colPlus.classList.contains('disabled')).toBe(true);
    expect(elements.colCatch.classList.contains('selected')).toBe(true);
  });

  test('disables both modes for berlin.com emails and does not overwrite saved settings', async () => {
    mockStorage.emailMode = 'plusAddressing';
    mockStorage.emailDomain = 'gmail.com';
    mockStorage.baseEmail = 'user@gmail.com';

    await initOptionsPage();
    const { input, colPlus, colCatch, radioPlus, radioCatch, modeFeedback, saveState } =
      getOptionsElements();

    expect(modeFeedback.classList.contains('is-empty')).toBe(true);

    input.value = 'abc@berlin.com';
    input.dispatchEvent(new Event('input', { bubbles: true }));

    expect(colPlus.classList.contains('disabled')).toBe(true);
    expect(colCatch.classList.contains('disabled')).toBe(true);
    expect(radioPlus.checked).toBe(false);
    expect(radioCatch.checked).toBe(false);
    expect(modeFeedback.textContent).toBe(
      'This provider does not support plus addressing. Catch-all mode requires a custom domain.',
    );
    expect(modeFeedback.classList.contains('feedback-warning')).toBe(true);
    expect(modeFeedback.classList.contains('is-empty')).toBe(false);
    expect(modeFeedback.getAttribute('aria-hidden')).toBe('false');
    expect(saveState.textContent).toBe('Editing…');

    await waitForDebounce();

    expect(mockStorage.emailMode).toBe('plusAddressing');
    expect(mockStorage.emailDomain).toBe('gmail.com');
    expect(mockStorage.baseEmail).toBe('user@gmail.com');
  });

  test('applies the same both-disabled rule to yahoo.com emails', async () => {
    mockStorage.emailMode = 'catchAll';
    mockStorage.emailDomain = 'gmail.com';
    mockStorage.baseEmail = 'user@gmail.com';

    await initOptionsPage();
    const { input, colPlus, colCatch, radioPlus, radioCatch, modeFeedback } = getOptionsElements();

    input.value = 'abc@yahoo.com';
    input.dispatchEvent(new Event('input', { bubbles: true }));

    expect(colPlus.classList.contains('disabled')).toBe(true);
    expect(colCatch.classList.contains('disabled')).toBe(true);
    expect(radioPlus.checked).toBe(false);
    expect(radioCatch.checked).toBe(false);
    expect(modeFeedback.textContent).toBe(
      'This provider does not support plus addressing. Catch-all mode requires a custom domain.',
    );
  });

  test('supported public-provider emails recover to the previous mode and clear the warning slot', async () => {
    mockStorage.emailMode = 'plusAddressing';
    mockStorage.emailDomain = 'gmail.com';
    mockStorage.baseEmail = 'user@gmail.com';

    await initOptionsPage();
    const { input, colPlus, colCatch, radioPlus, radioCatch, modeFeedback } = getOptionsElements();

    input.value = 'abc@berlin.com';
    input.dispatchEvent(new Event('input', { bubbles: true }));

    expect(radioPlus.checked).toBe(false);
    expect(radioCatch.checked).toBe(false);

    input.value = 'abc@gmail.com';
    input.dispatchEvent(new Event('input', { bubbles: true }));

    expect(colPlus.classList.contains('disabled')).toBe(false);
    expect(colCatch.classList.contains('disabled')).toBe(true);
    expect(radioPlus.checked).toBe(true);
    expect(radioCatch.checked).toBe(false);
    expect(modeFeedback.classList.contains('is-empty')).toBe(true);
    expect(modeFeedback.getAttribute('aria-hidden')).toBe('true');
  });

  test('full email with plus-supported provider disables catch-all column', async () => {
    await initOptionsPage();
    const { input, colPlus, colCatch, radioPlus, radioCatch } = getOptionsElements();

    input.value = 'user@gmail.com';
    input.dispatchEvent(new Event('input', { bubbles: true }));

    expect(colPlus.classList.contains('disabled')).toBe(false);
    expect(colCatch.classList.contains('disabled')).toBe(true);
    expect(radioPlus.checked).toBe(true);
    expect(radioCatch.checked).toBe(false);
  });

  test('custom-domain full emails do not disable both modes', async () => {
    mockStorage.emailMode = 'catchAll';
    mockStorage.emailDomain = 'mycorp.com';
    mockStorage.baseEmail = 'user@mycorp.com';

    await initOptionsPage();
    const { input, colPlus, colCatch, radioCatch, modeFeedback } = getOptionsElements();

    input.value = 'abc@mydomain.com';
    input.dispatchEvent(new Event('input', { bubbles: true }));

    expect(colPlus.classList.contains('disabled')).toBe(false);
    expect(colCatch.classList.contains('disabled')).toBe(false);
    expect(radioCatch.checked).toBe(true);
    expect(modeFeedback.classList.contains('feedback-warning')).toBe(false);
  });

  test('shows editing immediately for invalid input and does not save it', async () => {
    mockStorage.emailMode = 'plusAddressing';
    mockStorage.emailDomain = 'gmail.com';
    mockStorage.baseEmail = 'user@gmail.com';

    await initOptionsPage();
    const { input, saveState } = getOptionsElements();

    input.value = 'name@';
    input.dispatchEvent(new Event('input', { bubbles: true }));

    expect(saveState.textContent).toBe('Editing…');
    expect(saveState.dataset.state).toBe('editing');

    await waitForDebounce();

    expect(mockStorage.emailMode).toBe('plusAddressing');
    expect(mockStorage.baseEmail).toBe('user@gmail.com');
  });

  test('transitions from editing to saved for valid input', async () => {
    mockStorage.emailMode = 'catchAll';
    mockStorage.emailDomain = 'old.com';

    await initOptionsPage();
    const { input, saveState } = getOptionsElements();

    input.value = 'new.com';
    input.dispatchEvent(new Event('input', { bubbles: true }));

    expect(saveState.textContent).toBe('Editing…');
    expect(saveState.dataset.state).toBe('editing');

    await waitForDebounce();

    expect(saveState.textContent).toBe('Saved');
    expect(saveState.dataset.state).toBe('saved');
    expect(mockStorage.emailDomain).toBe('new.com');
  });

  test('auto-configures first-run users and ends with a saved header state', async () => {
    await initOptionsPage();
    const { input, saveState, status } = getOptionsElements();

    expect(input.value).toBe('user@gmail.com');
    expect(mockStorage.emailMode).toBe('plusAddressing');
    expect(mockStorage.baseEmail).toBe('user@gmail.com');
    expect(saveState.textContent).toBe('Saved');
    expect(status.textContent).toBe('Settings auto-configured from your Chrome profile');
  });

  test('shows save failure in the header and recovers on the next successful save', async () => {
    mockStorage.emailMode = 'catchAll';
    mockStorage.emailDomain = 'start.com';

    const failingSet = mock(async (_items: Record<string, unknown>) => {
      throw new Error('sync unavailable');
    });
    mockChrome.storage.sync.set = failingSet;

    await initOptionsPage();
    let elements = getOptionsElements();

    elements.input.value = 'broken.com';
    elements.input.dispatchEvent(new Event('input', { bubbles: true }));
    await waitForDebounce();

    expect(elements.saveState.textContent).toBe('Save failed');
    expect(elements.saveState.dataset.state).toBe('error');
    expect(elements.status.textContent).toContain('sync unavailable');

    mockChrome.storage.sync.set = mock(async (items: Record<string, unknown>) => {
      Object.assign(mockStorage, items);
    });

    elements.input.value = 'fixed.com';
    elements.input.dispatchEvent(new Event('input', { bubbles: true }));
    await waitForDebounce();

    elements = getOptionsElements();
    expect(elements.saveState.textContent).toBe('Saved');
    expect(mockStorage.emailDomain).toBe('fixed.com');
  });
});
