import { describe, expect, test } from 'bun:test';
import { PLUS_SUPPORTED_DOMAINS, PLUS_UNSUPPORTED_DOMAINS } from './provider-domains.js';

describe('PLUS_SUPPORTED_DOMAINS', () => {
  test('is non-empty', () => {
    expect(PLUS_SUPPORTED_DOMAINS.size).toBeGreaterThan(0);
  });

  test('contains major supported providers', () => {
    expect(PLUS_SUPPORTED_DOMAINS.has('gmail.com')).toBe(true);
    expect(PLUS_SUPPORTED_DOMAINS.has('googlemail.com')).toBe(true);
    expect(PLUS_SUPPORTED_DOMAINS.has('outlook.com')).toBe(true);
    expect(PLUS_SUPPORTED_DOMAINS.has('hotmail.com')).toBe(true);
    expect(PLUS_SUPPORTED_DOMAINS.has('protonmail.com')).toBe(true);
    expect(PLUS_SUPPORTED_DOMAINS.has('fastmail.com')).toBe(true);
    expect(PLUS_SUPPORTED_DOMAINS.has('mailbox.org')).toBe(true);
  });

  test('all entries are lowercase', () => {
    for (const domain of PLUS_SUPPORTED_DOMAINS) {
      expect(domain).toBe(domain.toLowerCase());
    }
  });

  test('all entries contain at least one dot', () => {
    for (const domain of PLUS_SUPPORTED_DOMAINS) {
      expect(domain).toContain('.');
    }
  });

  test('no empty strings', () => {
    for (const domain of PLUS_SUPPORTED_DOMAINS) {
      expect(domain.length).toBeGreaterThan(0);
    }
  });
});

describe('PLUS_UNSUPPORTED_DOMAINS', () => {
  test('is non-empty', () => {
    expect(PLUS_UNSUPPORTED_DOMAINS.size).toBeGreaterThan(0);
  });

  test('contains major unsupported providers', () => {
    expect(PLUS_UNSUPPORTED_DOMAINS.has('yahoo.com')).toBe(true);
    expect(PLUS_UNSUPPORTED_DOMAINS.has('icloud.com')).toBe(true);
    expect(PLUS_UNSUPPORTED_DOMAINS.has('gmx.com')).toBe(true);
    expect(PLUS_UNSUPPORTED_DOMAINS.has('mail.com')).toBe(true);
    expect(PLUS_UNSUPPORTED_DOMAINS.has('hey.com')).toBe(true);
    expect(PLUS_UNSUPPORTED_DOMAINS.has('qq.com')).toBe(true);
  });

  test('all entries are lowercase', () => {
    for (const domain of PLUS_UNSUPPORTED_DOMAINS) {
      expect(domain).toBe(domain.toLowerCase());
    }
  });

  test('all entries contain at least one dot', () => {
    for (const domain of PLUS_UNSUPPORTED_DOMAINS) {
      expect(domain).toContain('.');
    }
  });

  test('no empty strings', () => {
    for (const domain of PLUS_UNSUPPORTED_DOMAINS) {
      expect(domain.length).toBeGreaterThan(0);
    }
  });
});

describe('domain sets are disjoint', () => {
  test('no domain appears in both sets', () => {
    const overlap: string[] = [];
    for (const domain of PLUS_SUPPORTED_DOMAINS) {
      if (PLUS_UNSUPPORTED_DOMAINS.has(domain)) {
        overlap.push(domain);
      }
    }
    expect(overlap).toEqual([]);
  });
});
