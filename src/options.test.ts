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
