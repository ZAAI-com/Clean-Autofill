import { beforeAll, beforeEach, describe, expect, mock, test } from 'bun:test';
import { domainRegex, extractDomainFromEmail } from '../email/providers.js';

// Load utils first
beforeAll(async () => {
  await import('../email/utils.js');
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
