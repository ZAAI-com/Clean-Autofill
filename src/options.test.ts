import { beforeAll, beforeEach, describe, expect, mock, test } from 'bun:test';

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

// Extract testable logic from options.ts

// Domain validation regex from options.ts
const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z]{2,})+$/;

function isValidDomain(domain: string): boolean {
  return domainRegex.test(domain);
}

function cleanDomain(domain: string): string {
  return domain.trim().replace(/^@/, '');
}

function generateExampleEmail(siteDomain: string, userDomain: string): string {
  return `${siteDomain}@${userDomain}`;
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
      // Multiple subdomains work correctly
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

describe('generateExampleEmail', () => {
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

describe('chrome storage mock', () => {
  beforeEach(() => {
    // Clear mock storage
    for (const key of Object.keys(mockStorage)) {
      delete mockStorage[key];
    }
  });

  test('can set and get values', async () => {
    await mockChrome.storage.sync.set({ emailDomain: 'test.com' });
    const result = await mockChrome.storage.sync.get(['emailDomain']);
    expect(result.emailDomain).toBe('test.com');
  });

  test('returns empty object for missing keys', async () => {
    const result = await mockChrome.storage.sync.get(['nonexistent']);
    expect(result).toEqual({});
  });

  test('can remove values', async () => {
    await mockChrome.storage.sync.set({ emailDomain: 'test.com' });
    await mockChrome.storage.sync.remove(['emailDomain']);
    const result = await mockChrome.storage.sync.get(['emailDomain']);
    expect(result).toEqual({});
  });
});

// Domain extraction from email - mirrors extractDomainFromEmail in options.ts
function extractDomainFromEmail(email: string): string | null {
  const trimmed = email.trim();
  if (!trimmed) return null;
  const atIndex = trimmed.lastIndexOf('@');
  if (atIndex === -1 || atIndex === 0 || atIndex === trimmed.length - 1) return null;
  return trimmed.substring(atIndex + 1);
}

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
  // Test the status message class logic
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
