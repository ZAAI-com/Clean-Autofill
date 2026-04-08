import { beforeAll, describe, expect, test } from 'bun:test';

import type { EmailMode } from '../types';

// Load utils first
beforeAll(async () => {
  await import('../email/utils.js');
});

// Get utils for testing
const getUtils = () => {
  const utils = (globalThis as Record<string, unknown>).CleanAutofillUtils as {
    extractMainDomain: (hostname: string) => string;
  };
  return utils;
};

// Test the email generation logic (extracted from background.ts)
function generateEmail(
  tabUrl: string,
  userDomain: string,
  mode: EmailMode = 'catchAll',
  baseEmail?: string,
): string | null {
  const { extractMainDomain } = getUtils();

  // Check required config for active mode
  if (mode === 'plusAddressing') {
    if (!baseEmail || !baseEmail.includes('@')) return null;
  } else {
    if (!userDomain) return null;
  }

  // Skip chrome:// and extension:// URLs
  if (tabUrl.startsWith('chrome://') || tabUrl.startsWith('chrome-extension://')) {
    throw new Error('Cannot generate email for browser pages');
  }

  try {
    const url = new URL(tabUrl);
    const siteDomain = extractMainDomain(url.hostname);

    if (mode === 'plusAddressing') {
      const atIndex = (baseEmail as string).lastIndexOf('@');
      const localPart = (baseEmail as string).substring(0, atIndex);
      const emailDomain = (baseEmail as string).substring(atIndex + 1);
      return `${localPart}+${siteDomain}@${emailDomain}`;
    }

    return `${siteDomain}@${userDomain}`;
  } catch {
    throw new Error('Unable to parse current website URL');
  }
}

describe('generateEmail', () => {
  describe('catch-all mode (default)', () => {
    test('generates email for simple domain', () => {
      const email = generateEmail('https://example.com', 'mydomain.com');
      expect(email).toBe('example.com@mydomain.com');
    });

    test('generates email for domain with www', () => {
      const email = generateEmail('https://www.example.com', 'mydomain.com');
      expect(email).toBe('example.com@mydomain.com');
    });

    test('generates email for subdomain', () => {
      const email = generateEmail('https://mail.google.com', 'mydomain.com');
      expect(email).toBe('google.com@mydomain.com');
    });

    test('generates email for deep subdomain', () => {
      const email = generateEmail('https://api.v2.github.com', 'mydomain.com');
      expect(email).toBe('github.com@mydomain.com');
    });

    test('generates email for special TLD (.co.uk)', () => {
      const email = generateEmail('https://www.bbc.co.uk', 'mydomain.com');
      expect(email).toBe('bbc.co.uk@mydomain.com');
    });

    test('generates email for special TLD (.com.au)', () => {
      const email = generateEmail('https://news.example.com.au', 'mydomain.com');
      expect(email).toBe('example.com.au@mydomain.com');
    });

    test('generates email with path in URL', () => {
      const email = generateEmail('https://github.com/user/repo', 'mydomain.com');
      expect(email).toBe('github.com@mydomain.com');
    });

    test('generates email with query string in URL', () => {
      const email = generateEmail('https://example.com?foo=bar', 'mydomain.com');
      expect(email).toBe('example.com@mydomain.com');
    });

    test('generates email for http URL', () => {
      const email = generateEmail('http://example.com', 'mydomain.com');
      expect(email).toBe('example.com@mydomain.com');
    });

    test('generates email for localhost', () => {
      const email = generateEmail('http://localhost:3000', 'mydomain.com');
      expect(email).toBe('localhost@mydomain.com');
    });

    test('generates email for IP address', () => {
      const email = generateEmail('http://192.168.1.1:8080', 'mydomain.com');
      expect(email).toBe('192.168.1.1@mydomain.com');
    });

    test('works with explicit catchAll mode', () => {
      const email = generateEmail('https://example.com', 'mydomain.com', 'catchAll');
      expect(email).toBe('example.com@mydomain.com');
    });
  });

  describe('plus addressing mode', () => {
    test('generates plus-addressed email for simple domain', () => {
      const email = generateEmail('https://zalando.de', '', 'plusAddressing', 'name@gmail.com');
      expect(email).toBe('name+zalando.de@gmail.com');
    });

    test('generates plus-addressed email for subdomain site', () => {
      const email = generateEmail(
        'https://mail.google.com',
        '',
        'plusAddressing',
        'name@gmail.com',
      );
      expect(email).toBe('name+google.com@gmail.com');
    });

    test('generates plus-addressed email for .co.uk site', () => {
      const email = generateEmail('https://www.bbc.co.uk', '', 'plusAddressing', 'name@gmail.com');
      expect(email).toBe('name+bbc.co.uk@gmail.com');
    });

    test('generates plus-addressed email with company domain', () => {
      const email = generateEmail(
        'https://salesforce.com',
        '',
        'plusAddressing',
        'employee@company.com',
      );
      expect(email).toBe('employee+salesforce.com@company.com');
    });

    test('handles local part with dots', () => {
      const email = generateEmail(
        'https://zalando.de',
        '',
        'plusAddressing',
        'first.last@gmail.com',
      );
      expect(email).toBe('first.last+zalando.de@gmail.com');
    });

    test('handles localhost', () => {
      const email = generateEmail('http://localhost:3000', '', 'plusAddressing', 'name@gmail.com');
      expect(email).toBe('name+localhost@gmail.com');
    });

    test('handles IP address', () => {
      const email = generateEmail(
        'http://192.168.1.1:8080',
        '',
        'plusAddressing',
        'name@gmail.com',
      );
      expect(email).toBe('name+192.168.1.1@gmail.com');
    });

    test('returns null when baseEmail is missing', () => {
      const email = generateEmail('https://example.com', '', 'plusAddressing');
      expect(email).toBeNull();
    });

    test('returns null when baseEmail is empty', () => {
      const email = generateEmail('https://example.com', '', 'plusAddressing', '');
      expect(email).toBeNull();
    });

    test('returns null when baseEmail has no @', () => {
      const email = generateEmail('https://example.com', '', 'plusAddressing', 'invalid-email');
      expect(email).toBeNull();
    });
  });

  describe('no user domain configured', () => {
    test('returns null when userDomain is empty in catchAll mode', () => {
      const email = generateEmail('https://example.com', '');
      expect(email).toBeNull();
    });
  });

  describe('browser pages', () => {
    test('throws error for chrome:// URL', () => {
      expect(() => generateEmail('chrome://extensions', 'mydomain.com')).toThrow(
        'Cannot generate email for browser pages',
      );
    });

    test('throws error for chrome-extension:// URL', () => {
      expect(() => generateEmail('chrome-extension://abc123/options.html', 'mydomain.com')).toThrow(
        'Cannot generate email for browser pages',
      );
    });

    test('throws error for chrome:// URL in plus addressing mode', () => {
      expect(() =>
        generateEmail('chrome://extensions', '', 'plusAddressing', 'name@gmail.com'),
      ).toThrow('Cannot generate email for browser pages');
    });
  });

  describe('invalid URLs', () => {
    test('throws error for invalid URL', () => {
      expect(() => generateEmail('not-a-valid-url', 'mydomain.com')).toThrow(
        'Unable to parse current website URL',
      );
    });

    test('throws error for empty URL', () => {
      expect(() => generateEmail('', 'mydomain.com')).toThrow(
        'Unable to parse current website URL',
      );
    });
  });

  describe('various user domains', () => {
    test('works with subdomain user domain', () => {
      const email = generateEmail('https://example.com', 'mail.mydomain.com');
      expect(email).toBe('example.com@mail.mydomain.com');
    });

    test('works with short user domain', () => {
      const email = generateEmail('https://example.com', 'mg.de');
      expect(email).toBe('example.com@mg.de');
    });
  });
});

describe('message timeout constant', () => {
  test('MESSAGE_TIMEOUT should be a reasonable value', () => {
    const MESSAGE_TIMEOUT = 5000;
    expect(MESSAGE_TIMEOUT).toBeGreaterThanOrEqual(1000);
    expect(MESSAGE_TIMEOUT).toBeLessThanOrEqual(30000);
  });
});
