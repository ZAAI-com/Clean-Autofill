import { beforeAll, beforeEach, describe, expect, mock, test } from 'bun:test';
import {
  domainRegex,
  extractDomainFromEmail,
  extractLocalPart,
  getProviderStatus,
  PLUS_SUPPORTED_DOMAINS,
  PLUS_UNSUPPORTED_DOMAINS,
} from './providers.js';

// Load utils first
beforeAll(async () => {
  await import('./utils.js');
});

// Mock chrome API
const mockStorage: Record<string, unknown> = {};
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

// Test-only helpers

function isValidDomain(domain: string): boolean {
  return domainRegex.test(domain);
}

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

describe('domain validation', () => {
  describe('valid domains', () => {
    test('accepts simple domain', () => {
      expect(isValidDomain('example.com')).toBe(true);
    });

    test('accepts domain with subdomain', () => {
      expect(isValidDomain('mail.example.com')).toBe(true);
    });

    test('accepts domain with multiple subdomains', () => {
      expect(isValidDomain('sub.mail.example.com')).toBe(true);
    });

    test('accepts short domain names', () => {
      expect(isValidDomain('mg.de')).toBe(true);
    });

    test('accepts single char subdomain', () => {
      expect(isValidDomain('a.example.com')).toBe(true);
    });

    test('accepts domain with hyphens', () => {
      expect(isValidDomain('my-domain.com')).toBe(true);
    });

    test('accepts .co.uk TLD', () => {
      expect(isValidDomain('example.co.uk')).toBe(true);
    });

    test('accepts longer TLDs', () => {
      expect(isValidDomain('example.technology')).toBe(true);
    });
  });

  describe('invalid domains', () => {
    test('rejects empty string', () => {
      expect(isValidDomain('')).toBe(false);
    });

    test('rejects domain without TLD', () => {
      expect(isValidDomain('localhost')).toBe(false);
    });

    test('rejects domain starting with hyphen', () => {
      expect(isValidDomain('-example.com')).toBe(false);
    });

    test('rejects domain ending with hyphen', () => {
      expect(isValidDomain('example-.com')).toBe(false);
    });

    test('rejects domain with spaces', () => {
      expect(isValidDomain('example .com')).toBe(false);
    });

    test('rejects domain with underscore', () => {
      expect(isValidDomain('example_domain.com')).toBe(false);
    });

    test('rejects single letter TLD', () => {
      expect(isValidDomain('example.c')).toBe(false);
    });

    test('rejects IP address', () => {
      expect(isValidDomain('192.168.1.1')).toBe(false);
    });

    test('rejects domain with protocol', () => {
      expect(isValidDomain('https://example.com')).toBe(false);
    });

    test('rejects domain with path', () => {
      expect(isValidDomain('example.com/path')).toBe(false);
    });
  });
});

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
      'cloudflare.com',
      'ui.com',
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

describe('extractDomainFromEmail', () => {
  test('extracts domain from standard email', () => {
    expect(extractDomainFromEmail('user@example.com')).toBe('example.com');
  });

  test('extracts domain from email with subdomain', () => {
    expect(extractDomainFromEmail('user@mail.example.com')).toBe('mail.example.com');
  });

  test('extracts domain from email with plus addressing', () => {
    expect(extractDomainFromEmail('user+tag@example.com')).toBe('example.com');
  });

  test('returns null for empty string', () => {
    expect(extractDomainFromEmail('')).toBeNull();
  });

  test('returns null for whitespace-only string', () => {
    expect(extractDomainFromEmail('   ')).toBeNull();
  });

  test('returns null for string without @', () => {
    expect(extractDomainFromEmail('no-at-symbol')).toBeNull();
  });

  test('returns null for string ending with @', () => {
    expect(extractDomainFromEmail('user@')).toBeNull();
  });

  test('returns null for string starting with @', () => {
    expect(extractDomainFromEmail('@domain.com')).toBeNull();
  });

  test('handles email with multiple @ by using last one', () => {
    expect(extractDomainFromEmail('weird@local@domain.com')).toBe('domain.com');
  });

  test('trims whitespace from input', () => {
    expect(extractDomainFromEmail('  user@example.com  ')).toBe('example.com');
  });
});

describe('extractLocalPart', () => {
  test('extracts local part from standard email', () => {
    expect(extractLocalPart('user@example.com')).toBe('user');
  });

  test('extracts local part with dots', () => {
    expect(extractLocalPart('first.last@example.com')).toBe('first.last');
  });

  test('extracts local part with plus', () => {
    expect(extractLocalPart('user+tag@example.com')).toBe('user+tag');
  });

  test('returns null for empty string', () => {
    expect(extractLocalPart('')).toBeNull();
  });

  test('returns null for string without @', () => {
    expect(extractLocalPart('no-at-symbol')).toBeNull();
  });

  test('returns null for string starting with @', () => {
    expect(extractLocalPart('@domain.com')).toBeNull();
  });

  test('handles multiple @ by using last one', () => {
    expect(extractLocalPart('weird@local@domain.com')).toBe('weird@local');
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

  test('handles API error gracefully', () => {
    mockChrome.identity.getProfileUserInfo = mock(async () => {
      throw new Error('API unavailable');
    });
    expect(mockChrome.identity.getProfileUserInfo({ accountStatus: 'ANY' })).rejects.toThrow(
      'API unavailable',
    );
  });
});

describe('status message types', () => {
  function getStatusClass(type: 'success' | 'error'): string {
    return `status ${type}`;
  }

  test('returns correct class for success', () => {
    expect(getStatusClass('success')).toBe('status success');
  });

  test('returns correct class for error', () => {
    expect(getStatusClass('error')).toBe('status error');
  });
});

describe('getProviderStatus', () => {
  describe('plus-supported providers', () => {
    const supported = [
      'gmail.com',
      'googlemail.com',
      'outlook.com',
      'hotmail.com',
      'live.com',
      'msn.com',
      'protonmail.com',
      'proton.me',
      'pm.me',
      'protonmail.ch',
      'fastmail.com',
      'fastmail.fm',
      'pobox.com',
      'sent.com',
      'mailbox.org',
      'hey.com',
      'yandex.com',
      'yandex.ru',
      'ya.ru',
      'mail.ru',
      'inbox.ru',
      'bk.ru',
    ];

    for (const domain of supported) {
      test(`${domain} is plus-supported`, () => {
        expect(getProviderStatus(domain)).toBe('plus-supported');
      });
    }

    test('is case-insensitive', () => {
      expect(getProviderStatus('Gmail.com')).toBe('plus-supported');
      expect(getProviderStatus('OUTLOOK.COM')).toBe('plus-supported');
    });
  });

  describe('plus-unsupported providers', () => {
    const unsupported = [
      'yahoo.com',
      'ymail.com',
      'rocketmail.com',
      'gmx.com',
      'gmx.de',
      'gmx.net',
      'web.de',
      'mail.com',
      'email.com',
      't-online.de',
      'tuta.com',
      'tutanota.com',
      'icloud.com',
      'me.com',
      'mac.com',
      '163.com',
      'qq.com',
      'foxmail.com',
      'libero.it',
      'laposte.net',
      'rediffmail.com',
    ];

    for (const domain of unsupported) {
      test(`${domain} is plus-unsupported`, () => {
        expect(getProviderStatus(domain)).toBe('plus-unsupported');
      });
    }
  });

  describe('custom domains', () => {
    test('unknown domain returns custom', () => {
      expect(getProviderStatus('company.com')).toBe('custom');
    });

    test('personal domain returns custom', () => {
      expect(getProviderStatus('manuelgruber.com')).toBe('custom');
    });

    test('subdomain of known provider returns custom', () => {
      expect(getProviderStatus('mail.gmail.com')).toBe('custom');
    });

    test('zoho.com returns custom (unverified)', () => {
      expect(getProviderStatus('zoho.com')).toBe('custom');
    });
  });

  describe('provider lists are disjoint', () => {
    test('no domain appears in both supported and unsupported lists', () => {
      for (const domain of PLUS_SUPPORTED_DOMAINS) {
        expect(PLUS_UNSUPPORTED_DOMAINS.has(domain)).toBe(false);
      }
      for (const domain of PLUS_UNSUPPORTED_DOMAINS) {
        expect(PLUS_SUPPORTED_DOMAINS.has(domain)).toBe(false);
      }
    });
  });
});
