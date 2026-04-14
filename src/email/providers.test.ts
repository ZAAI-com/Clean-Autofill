import { beforeEach, describe, expect, mock, test } from 'bun:test';
import {
  domainRegex,
  extractDomainFromEmail,
  extractLocalPart,
  getProviderStatus,
  getProviderStatusWithMx,
  PLUS_SUPPORTED_DOMAINS,
  PLUS_UNSUPPORTED_DOMAINS,
} from './providers.js';

// Mock chrome.storage.local (needed by mx-lookup, used by getProviderStatusWithMx)
let store: Record<string, unknown> = {};
const mockChrome = {
  storage: {
    local: {
      get: mock(async (key: string) => {
        const val = store[key];
        return val !== undefined ? { [key]: val } : {};
      }),
      set: mock(async (items: Record<string, unknown>) => {
        Object.assign(store, items);
      }),
    },
  },
};
(globalThis as Record<string, unknown>).chrome = mockChrome;

// Mock fetch (needed by mx-lookup for DNS queries)
let fetchResponse: { ok: boolean; status: number; json: () => Promise<unknown> };
const mockFetch = mock(async () => fetchResponse);
(globalThis as Record<string, unknown>).fetch = mockFetch;

beforeEach(() => {
  store = {};
  mockFetch.mockClear();
  mockChrome.storage.local.get.mockClear();
  mockChrome.storage.local.set.mockClear();
});

// ── domainRegex ──

describe('domainRegex', () => {
  describe('valid domains', () => {
    test('accepts simple domain', () => {
      expect(domainRegex.test('example.com')).toBe(true);
    });

    test('accepts domain with subdomain', () => {
      expect(domainRegex.test('mail.example.com')).toBe(true);
    });

    test('accepts domain with multiple subdomains', () => {
      expect(domainRegex.test('sub.mail.example.com')).toBe(true);
    });

    test('accepts short domain names', () => {
      expect(domainRegex.test('mg.de')).toBe(true);
    });

    test('accepts single char subdomain', () => {
      expect(domainRegex.test('a.example.com')).toBe(true);
    });

    test('accepts domain with hyphens', () => {
      expect(domainRegex.test('my-domain.com')).toBe(true);
    });

    test('accepts .co.uk TLD', () => {
      expect(domainRegex.test('example.co.uk')).toBe(true);
    });

    test('accepts longer TLDs', () => {
      expect(domainRegex.test('example.technology')).toBe(true);
    });
  });

  describe('invalid domains', () => {
    test('rejects empty string', () => {
      expect(domainRegex.test('')).toBe(false);
    });

    test('rejects domain without TLD', () => {
      expect(domainRegex.test('localhost')).toBe(false);
    });

    test('rejects domain starting with hyphen', () => {
      expect(domainRegex.test('-example.com')).toBe(false);
    });

    test('rejects domain ending with hyphen', () => {
      expect(domainRegex.test('example-.com')).toBe(false);
    });

    test('rejects domain with spaces', () => {
      expect(domainRegex.test('example .com')).toBe(false);
    });

    test('rejects domain with underscore', () => {
      expect(domainRegex.test('example_domain.com')).toBe(false);
    });

    test('rejects single letter TLD', () => {
      expect(domainRegex.test('example.c')).toBe(false);
    });

    test('rejects IP address', () => {
      expect(domainRegex.test('192.168.1.1')).toBe(false);
    });

    test('rejects domain with protocol', () => {
      expect(domainRegex.test('https://example.com')).toBe(false);
    });

    test('rejects domain with path', () => {
      expect(domainRegex.test('example.com/path')).toBe(false);
    });
  });
});

// ── extractDomainFromEmail ──

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

// ── extractLocalPart ──

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

// ── getProviderStatus ──

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
      'yandex.com',
      'yandex.ru',
      'ya.ru',
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
      'hey.com',
      'mail.ru',
      'inbox.ru',
      'bk.ru',
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

// ── getProviderStatusWithMx ──

describe('getProviderStatusWithMx', () => {
  test('returns sync status for known supported domain without MX lookup', async () => {
    const result = await getProviderStatusWithMx('gmail.com');
    expect(result.status).toBe('plus-supported');
    expect(result.mxResult).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test('returns sync status for known unsupported domain without MX lookup', async () => {
    const result = await getProviderStatusWithMx('yahoo.com');
    expect(result.status).toBe('plus-unsupported');
    expect(result.mxResult).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test('falls through to MX lookup for custom domain', async () => {
    fetchResponse = {
      ok: true,
      status: 200,
      json: async () => ({
        Status: 0,
        Answer: [{ name: 'company.com', type: 15, TTL: 3600, data: '10 smtp.google.com.' }],
      }),
    };

    const result = await getProviderStatusWithMx('company.com');
    expect(result.status).toBe('plus-supported');
    expect(result.mxResult).not.toBeNull();
    expect(result.mxResult?.provider).toBe('google-workspace');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  test('returns custom status when MX lookup finds unknown provider', async () => {
    fetchResponse = {
      ok: true,
      status: 200,
      json: async () => ({
        Status: 0,
        Answer: [{ name: 'custom.com', type: 15, TTL: 3600, data: '10 mx.unknown.com.' }],
      }),
    };

    const result = await getProviderStatusWithMx('custom.com');
    expect(result.status).toBe('custom');
    expect(result.mxResult).not.toBeNull();
    expect(result.mxResult?.provider).toBeNull();
  });

  test('returns custom status when MX lookup fails', async () => {
    fetchResponse = { ok: false, status: 500, json: async () => ({}) };

    const result = await getProviderStatusWithMx('broken.com');
    expect(result.status).toBe('custom');
    expect(result.mxResult).not.toBeNull();
  });
});
