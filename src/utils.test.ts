import { beforeAll, describe, expect, test } from 'bun:test';

// Load utils.js by executing it (it sets globalThis.CleanAutofillUtils)
beforeAll(async () => {
  // Import the utils file to populate globalThis
  await import('./utils.js');
});

// Helper to get utils after they're loaded
const getUtils = () => {
  const utils = (globalThis as Record<string, unknown>).CleanAutofillUtils as {
    extractMainDomain: (hostname: string) => string;
    isValidEmail: (email: unknown) => boolean;
    createTimeout: (ms: number, message?: string) => Promise<never>;
    debounce: <T extends (...args: unknown[]) => void>(func: T, wait: number) => T;
    SPECIAL_TLDS: readonly string[];
  };
  return utils;
};

describe('extractMainDomain', () => {
  describe('localhost and IP addresses', () => {
    test('returns localhost as-is', () => {
      const { extractMainDomain } = getUtils();
      expect(extractMainDomain('localhost')).toBe('localhost');
    });

    test('returns IPv4 addresses as-is', () => {
      const { extractMainDomain } = getUtils();
      expect(extractMainDomain('192.168.1.1')).toBe('192.168.1.1');
      expect(extractMainDomain('127.0.0.1')).toBe('127.0.0.1');
      expect(extractMainDomain('10.0.0.1')).toBe('10.0.0.1');
    });

    test('returns IPv6 addresses as-is', () => {
      const { extractMainDomain } = getUtils();
      expect(extractMainDomain('[::1]')).toBe('[::1]');
      expect(extractMainDomain('::1')).toBe('::1');
      expect(extractMainDomain('[2001:db8::1]')).toBe('[2001:db8::1]');
    });
  });

  describe('www prefix removal', () => {
    test('removes www prefix from domains', () => {
      const { extractMainDomain } = getUtils();
      expect(extractMainDomain('www.example.com')).toBe('example.com');
      expect(extractMainDomain('www.github.com')).toBe('github.com');
      expect(extractMainDomain('www.google.co.uk')).toBe('google.co.uk');
    });

    test('does not remove www from non-prefix positions', () => {
      const { extractMainDomain } = getUtils();
      expect(extractMainDomain('wwwexample.com')).toBe('wwwexample.com');
    });
  });

  describe('regular TLDs', () => {
    test('extracts main domain for .com', () => {
      const { extractMainDomain } = getUtils();
      expect(extractMainDomain('example.com')).toBe('example.com');
      expect(extractMainDomain('sub.example.com')).toBe('example.com');
      expect(extractMainDomain('deep.sub.example.com')).toBe('example.com');
    });

    test('extracts main domain for other common TLDs', () => {
      const { extractMainDomain } = getUtils();
      expect(extractMainDomain('example.org')).toBe('example.org');
      expect(extractMainDomain('example.net')).toBe('example.net');
      expect(extractMainDomain('example.io')).toBe('example.io');
      expect(extractMainDomain('example.dev')).toBe('example.dev');
    });

    test('handles subdomains correctly', () => {
      const { extractMainDomain } = getUtils();
      expect(extractMainDomain('mail.google.com')).toBe('google.com');
      expect(extractMainDomain('api.github.com')).toBe('github.com');
      expect(extractMainDomain('cdn.jsdelivr.net')).toBe('jsdelivr.net');
    });
  });

  describe('special TLDs', () => {
    test('handles .co.uk correctly', () => {
      const { extractMainDomain } = getUtils();
      expect(extractMainDomain('example.co.uk')).toBe('example.co.uk');
      expect(extractMainDomain('sub.example.co.uk')).toBe('example.co.uk');
      expect(extractMainDomain('bbc.co.uk')).toBe('bbc.co.uk');
    });

    test('handles .com.au correctly', () => {
      const { extractMainDomain } = getUtils();
      expect(extractMainDomain('example.com.au')).toBe('example.com.au');
      expect(extractMainDomain('news.example.com.au')).toBe('example.com.au');
    });

    test('handles .co.jp correctly', () => {
      const { extractMainDomain } = getUtils();
      expect(extractMainDomain('example.co.jp')).toBe('example.co.jp');
      expect(extractMainDomain('shop.example.co.jp')).toBe('example.co.jp');
    });

    test('handles other special TLDs', () => {
      const { extractMainDomain } = getUtils();
      expect(extractMainDomain('example.org.uk')).toBe('example.org.uk');
      expect(extractMainDomain('example.com.br')).toBe('example.com.br');
      expect(extractMainDomain('example.co.nz')).toBe('example.co.nz');
    });
  });

  describe('edge cases', () => {
    test('handles single-part domains', () => {
      const { extractMainDomain } = getUtils();
      expect(extractMainDomain('localhost')).toBe('localhost');
    });

    test('handles two-part domains without subdomains', () => {
      const { extractMainDomain } = getUtils();
      expect(extractMainDomain('example.com')).toBe('example.com');
    });
  });
});

describe('isValidEmail', () => {
  describe('valid emails', () => {
    test('accepts standard email format', () => {
      const { isValidEmail } = getUtils();
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user@domain.co.uk')).toBe(true);
    });

    test('accepts domain-based emails (extension use case)', () => {
      const { isValidEmail } = getUtils();
      expect(isValidEmail('example.com@mydomain.com')).toBe(true);
      expect(isValidEmail('github.com@mail.example.org')).toBe(true);
    });

    test('accepts emails with special characters in local part', () => {
      const { isValidEmail } = getUtils();
      expect(isValidEmail('user.name@example.com')).toBe(true);
      expect(isValidEmail('user+tag@example.com')).toBe(true);
      expect(isValidEmail('user-name@example.com')).toBe(true);
    });
  });

  describe('invalid emails', () => {
    test('rejects empty string', () => {
      const { isValidEmail } = getUtils();
      expect(isValidEmail('')).toBe(false);
    });

    test('rejects non-string values', () => {
      const { isValidEmail } = getUtils();
      expect(isValidEmail(null)).toBe(false);
      expect(isValidEmail(undefined)).toBe(false);
      expect(isValidEmail(123)).toBe(false);
      expect(isValidEmail({})).toBe(false);
      expect(isValidEmail([])).toBe(false);
    });

    test('rejects emails without @', () => {
      const { isValidEmail } = getUtils();
      expect(isValidEmail('notanemail')).toBe(false);
      expect(isValidEmail('example.com')).toBe(false);
    });

    test('rejects emails with multiple @', () => {
      const { isValidEmail } = getUtils();
      expect(isValidEmail('user@@example.com')).toBe(false);
    });

    test('rejects emails with spaces', () => {
      const { isValidEmail } = getUtils();
      expect(isValidEmail('user @example.com')).toBe(false);
      expect(isValidEmail('user@ example.com')).toBe(false);
      expect(isValidEmail(' user@example.com')).toBe(false);
    });

    test('rejects emails over 253 characters', () => {
      const { isValidEmail } = getUtils();
      const longLocal = 'a'.repeat(250);
      expect(isValidEmail(`${longLocal}@b.com`)).toBe(false);
    });
  });
});

describe('createTimeout', () => {
  test('rejects after specified time with default message', async () => {
    const { createTimeout } = getUtils();
    const start = Date.now();
    await expect(createTimeout(50)).rejects.toThrow('Operation timed out');
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(45);
  });

  test('rejects with custom message', async () => {
    const { createTimeout } = getUtils();
    await expect(createTimeout(30, 'Custom timeout error')).rejects.toThrow('Custom timeout error');
  });

  test('returns a Promise', () => {
    const { createTimeout } = getUtils();
    const result = createTimeout(100);
    expect(result).toBeInstanceOf(Promise);
    // Prevent unhandled rejection
    result.catch(() => {});
  });
});

describe('debounce', () => {
  test('delays function execution', async () => {
    const { debounce } = getUtils();
    let callCount = 0;
    const fn = () => {
      callCount++;
    };
    const debounced = debounce(fn, 50);

    debounced();
    expect(callCount).toBe(0);

    await new Promise((r) => setTimeout(r, 100));
    expect(callCount).toBe(1);
  });

  test('deduplicates rapid calls', async () => {
    const { debounce } = getUtils();
    let callCount = 0;
    const fn = () => {
      callCount++;
    };
    const debounced = debounce(fn, 50);

    debounced();
    debounced();
    debounced();
    debounced();
    debounced();

    expect(callCount).toBe(0);

    await new Promise((r) => setTimeout(r, 100));
    expect(callCount).toBe(1);
  });

  test('passes arguments to debounced function', async () => {
    const { debounce } = getUtils();
    let receivedArgs: unknown[] = [];
    const fn = (...args: unknown[]) => {
      receivedArgs = args;
    };
    const debounced = debounce(fn, 50);

    debounced('arg1', 'arg2', 123);

    await new Promise((r) => setTimeout(r, 100));
    expect(receivedArgs).toEqual(['arg1', 'arg2', 123]);
  });

  test('uses latest arguments when called multiple times', async () => {
    const { debounce } = getUtils();
    let receivedArg: unknown;
    const fn = (arg: unknown) => {
      receivedArg = arg;
    };
    const debounced = debounce(fn, 50);

    debounced('first');
    debounced('second');
    debounced('third');

    await new Promise((r) => setTimeout(r, 100));
    expect(receivedArg).toBe('third');
  });
});

describe('SPECIAL_TLDS', () => {
  test('is an array', () => {
    const { SPECIAL_TLDS } = getUtils();
    expect(Array.isArray(SPECIAL_TLDS)).toBe(true);
  });

  test('contains common special TLDs', () => {
    const { SPECIAL_TLDS } = getUtils();
    expect(SPECIAL_TLDS).toContain('co.uk');
    expect(SPECIAL_TLDS).toContain('com.au');
    expect(SPECIAL_TLDS).toContain('co.jp');
    expect(SPECIAL_TLDS).toContain('org.uk');
  });

  test('all entries are lowercase strings', () => {
    const { SPECIAL_TLDS } = getUtils();
    for (const tld of SPECIAL_TLDS) {
      expect(typeof tld).toBe('string');
      expect(tld).toBe(tld.toLowerCase());
    }
  });
});

describe('PSL integration', () => {
  test('handles .com.cn correctly (via PSL)', () => {
    const { extractMainDomain } = getUtils();
    expect(extractMainDomain('shop.example.com.cn')).toBe('example.com.cn');
    expect(extractMainDomain('example.com.cn')).toBe('example.com.cn');
  });

  test('handles .org.nz correctly (via PSL)', () => {
    const { extractMainDomain } = getUtils();
    expect(extractMainDomain('shop.example.org.nz')).toBe('example.org.nz');
  });

  test('handles .or.jp correctly (via PSL)', () => {
    const { extractMainDomain } = getUtils();
    expect(extractMainDomain('shop.example.or.jp')).toBe('example.or.jp');
  });

  test('handles .go.kr correctly (via PSL)', () => {
    const { extractMainDomain } = getUtils();
    expect(extractMainDomain('shop.example.go.kr')).toBe('example.go.kr');
  });

  test('handles .govt.nz correctly (via PSL)', () => {
    const { extractMainDomain } = getUtils();
    expect(extractMainDomain('dept.example.govt.nz')).toBe('example.govt.nz');
  });

  test('handles deeply nested subdomains', () => {
    const { extractMainDomain } = getUtils();
    expect(extractMainDomain('a.b.c.d.example.co.uk')).toBe('example.co.uk');
    expect(extractMainDomain('a.b.c.d.example.com')).toBe('example.com');
  });

  test('handles unusual TLDs via PSL', () => {
    const { extractMainDomain } = getUtils();
    // PSL knows about these
    expect(extractMainDomain('example.tokyo')).toBe('example.tokyo');
    expect(extractMainDomain('example.museum')).toBe('example.museum');
  });
});
