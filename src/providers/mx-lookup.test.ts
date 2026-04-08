import { beforeEach, describe, expect, mock, test } from 'bun:test';
import type { MxRecord } from '../types';

// Mock chrome.storage.local
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

// Mock fetch
let fetchResponse: { ok: boolean; status: number; json: () => Promise<unknown> };
const mockFetch = mock(async () => fetchResponse);
(globalThis as Record<string, unknown>).fetch = mockFetch;

const { detectProviderFromMx, getProviderInfo, lookupMxRecords, clearMemoryCache } = await import(
  './mx-lookup.js'
);

beforeEach(() => {
  store = {};
  mockFetch.mockClear();
  mockChrome.storage.local.get.mockClear();
  mockChrome.storage.local.set.mockClear();
  clearMemoryCache();
});

// ── detectProviderFromMx ──

describe('detectProviderFromMx', () => {
  test('detects Google Workspace (smtp.google.com)', () => {
    const records: MxRecord[] = [{ priority: 10, exchange: 'smtp.google.com' }];
    expect(detectProviderFromMx(records)).toBe('google-workspace');
  });

  test('detects Google Workspace (legacy aspmx.l.google.com)', () => {
    const records: MxRecord[] = [
      { priority: 1, exchange: 'aspmx.l.google.com' },
      { priority: 5, exchange: 'alt1.aspmx.l.google.com' },
      { priority: 5, exchange: 'alt2.aspmx.l.google.com' },
      { priority: 10, exchange: 'alt3.aspmx.l.google.com' },
      { priority: 10, exchange: 'alt4.aspmx.l.google.com' },
    ];
    expect(detectProviderFromMx(records)).toBe('google-workspace');
  });

  test('detects Google Workspace (gmail-smtp-in)', () => {
    const records: MxRecord[] = [
      { priority: 5, exchange: 'gmail-smtp-in.l.google.com' },
      { priority: 10, exchange: 'alt1.gmail-smtp-in.l.google.com' },
    ];
    expect(detectProviderFromMx(records)).toBe('google-workspace');
  });

  test('detects Microsoft 365', () => {
    const records: MxRecord[] = [
      { priority: 0, exchange: 'company-com.mail.protection.outlook.com' },
    ];
    expect(detectProviderFromMx(records)).toBe('microsoft-365');
  });

  test('detects Fastmail', () => {
    const records: MxRecord[] = [
      { priority: 10, exchange: 'in1-smtp.messagingengine.com' },
      { priority: 20, exchange: 'in2-smtp.messagingengine.com' },
    ];
    expect(detectProviderFromMx(records)).toBe('fastmail');
  });

  test('detects Proton Mail', () => {
    const records: MxRecord[] = [
      { priority: 5, exchange: 'mail.protonmail.ch' },
      { priority: 10, exchange: 'mailsec.protonmail.ch' },
    ];
    expect(detectProviderFromMx(records)).toBe('protonmail');
  });

  test('detects Zoho', () => {
    const records: MxRecord[] = [
      { priority: 10, exchange: 'smtpin.zoho.com' },
      { priority: 20, exchange: 'smtpin2.zoho.com' },
    ];
    expect(detectProviderFromMx(records)).toBe('zoho');
  });

  test('detects iCloud', () => {
    const records: MxRecord[] = [
      { priority: 10, exchange: 'mx01.mail.icloud.com' },
      { priority: 10, exchange: 'mx02.mail.icloud.com' },
    ];
    expect(detectProviderFromMx(records)).toBe('icloud');
  });

  test('detects Mimecast', () => {
    const records: MxRecord[] = [{ priority: 10, exchange: 'us-smtp-inbound-1.mimecast.com' }];
    expect(detectProviderFromMx(records)).toBe('mimecast');
  });

  test('detects Barracuda', () => {
    const records: MxRecord[] = [{ priority: 10, exchange: 'cluster1.us.barracudanetworks.com' }];
    expect(detectProviderFromMx(records)).toBe('barracuda');
  });

  test('returns null for unknown MX records', () => {
    const records: MxRecord[] = [{ priority: 10, exchange: 'mx.example.com' }];
    expect(detectProviderFromMx(records)).toBeNull();
  });

  test('returns null for empty records', () => {
    expect(detectProviderFromMx([])).toBeNull();
  });

  test('handles trailing dots in exchange names', () => {
    const records: MxRecord[] = [{ priority: 10, exchange: 'smtp.google.com.' }];
    expect(detectProviderFromMx(records)).toBe('google-workspace');
  });

  test('handles uppercase exchange names', () => {
    const records: MxRecord[] = [{ priority: 10, exchange: 'SMTP.GOOGLE.COM' }];
    expect(detectProviderFromMx(records)).toBe('google-workspace');
  });

  test('uses highest priority record for detection', () => {
    const records: MxRecord[] = [
      { priority: 20, exchange: 'mx.example.com' },
      { priority: 1, exchange: 'smtp.google.com' },
    ];
    expect(detectProviderFromMx(records)).toBe('google-workspace');
  });
});

// ── getProviderInfo ──

describe('getProviderInfo', () => {
  test('returns Google Workspace info', () => {
    const info = getProviderInfo('google-workspace');
    expect(info.name).toBe('Google Workspace');
    expect(info.plusAddressingSupported).toBe(true);
  });

  test('returns Microsoft 365 info', () => {
    const info = getProviderInfo('microsoft-365');
    expect(info.name).toBe('Microsoft 365');
    expect(info.plusAddressingSupported).toBe(true);
  });

  test('returns iCloud info with no plus support', () => {
    const info = getProviderInfo('icloud');
    expect(info.name).toBe('iCloud Mail');
    expect(info.plusAddressingSupported).toBe(false);
  });

  test('returns Fastmail info', () => {
    const info = getProviderInfo('fastmail');
    expect(info.name).toBe('Fastmail');
    expect(info.plusAddressingSupported).toBe(true);
  });

  test('returns Proton Mail info', () => {
    const info = getProviderInfo('protonmail');
    expect(info.name).toBe('Proton Mail');
    expect(info.plusAddressingSupported).toBe(true);
  });
});

// ── lookupMxRecords ──

describe('lookupMxRecords', () => {
  function setFetchResponse(answers: Array<{ type: number; TTL: number; data: string }>) {
    fetchResponse = {
      ok: true,
      status: 200,
      json: async () => ({
        Status: 0,
        Answer: answers.map((a) => ({ name: 'test.com', ...a })),
      }),
    };
  }

  test('fetches and returns MX result for Google Workspace domain', async () => {
    setFetchResponse([{ type: 15, TTL: 3600, data: '10 smtp.google.com.' }]);

    const result = await lookupMxRecords('company.com');

    expect(result.domain).toBe('company.com');
    expect(result.provider).toBe('google-workspace');
    expect(result.status).toBe('plus-supported');
    expect(result.mxRecords).toHaveLength(1);
    expect(result.mxRecords[0].exchange).toBe('smtp.google.com');
    expect(result.mxRecords[0].priority).toBe(10);
  });

  test('returns plus-unsupported for iCloud domain', async () => {
    setFetchResponse([
      { type: 15, TTL: 3600, data: '10 mx01.mail.icloud.com.' },
      { type: 15, TTL: 3600, data: '10 mx02.mail.icloud.com.' },
    ]);

    const result = await lookupMxRecords('example.com');

    expect(result.provider).toBe('icloud');
    expect(result.status).toBe('plus-unsupported');
  });

  test('returns custom status for security gateways', async () => {
    setFetchResponse([{ type: 15, TTL: 3600, data: '10 us-smtp-inbound-1.mimecast.com.' }]);

    const result = await lookupMxRecords('corp.com');

    expect(result.provider).toBe('mimecast');
    expect(result.status).toBe('custom');
  });

  test('returns custom status when no MX records match', async () => {
    setFetchResponse([{ type: 15, TTL: 3600, data: '10 mx.unknown-provider.com.' }]);

    const result = await lookupMxRecords('random.xyz');

    expect(result.provider).toBeNull();
    expect(result.status).toBe('custom');
  });

  test('returns custom status on network error', async () => {
    fetchResponse = { ok: false, status: 500, json: async () => ({}) };

    const result = await lookupMxRecords('error.com');

    expect(result.provider).toBeNull();
    expect(result.status).toBe('custom');
    expect(result.ttl).toBe(300); // short TTL for retry
  });

  test('returns custom status when fetch throws', async () => {
    mockFetch.mockImplementationOnce(async () => {
      throw new Error('Network error');
    });

    const result = await lookupMxRecords('offline.com');

    expect(result.provider).toBeNull();
    expect(result.status).toBe('custom');
  });

  test('handles DNS NXDOMAIN (no Answer array)', async () => {
    fetchResponse = {
      ok: true,
      status: 200,
      json: async () => ({ Status: 3 }), // NXDOMAIN
    };

    const result = await lookupMxRecords('nonexistent.com');

    expect(result.provider).toBeNull();
    expect(result.mxRecords).toHaveLength(0);
    expect(result.status).toBe('custom');
  });

  test('filters out non-MX records from Answer', async () => {
    fetchResponse = {
      ok: true,
      status: 200,
      json: async () => ({
        Status: 0,
        Answer: [
          { name: 'test.com', type: 1, TTL: 300, data: '1.2.3.4' }, // A record
          { name: 'test.com', type: 15, TTL: 3600, data: '10 smtp.google.com.' }, // MX record
        ],
      }),
    };

    const result = await lookupMxRecords('mixed.com');

    expect(result.mxRecords).toHaveLength(1);
    expect(result.provider).toBe('google-workspace');
  });

  test('normalizes domain to lowercase', async () => {
    setFetchResponse([{ type: 15, TTL: 3600, data: '10 smtp.google.com.' }]);

    const result = await lookupMxRecords('COMPANY.COM');

    expect(result.domain).toBe('company.com');
  });

  // ── Caching ──

  test('returns cached result on second call', async () => {
    setFetchResponse([{ type: 15, TTL: 3600, data: '10 smtp.google.com.' }]);

    const first = await lookupMxRecords('cached.com');
    const second = await lookupMxRecords('cached.com');

    expect(first.provider).toBe('google-workspace');
    expect(second.provider).toBe('google-workspace');
    // fetch should be called only once
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  test('caches result in chrome.storage.local', async () => {
    setFetchResponse([{ type: 15, TTL: 3600, data: '10 smtp.google.com.' }]);

    await lookupMxRecords('stored.com');

    expect(mockChrome.storage.local.set).toHaveBeenCalled();
    const cached = store.mxCache as Record<string, unknown>;
    expect(cached).toBeDefined();
    expect(cached['stored.com']).toBeDefined();
  });

  test('reads from chrome.storage.local when memory cache is empty', async () => {
    // Pre-populate storage cache
    store.mxCache = {
      'precached.com': {
        domain: 'precached.com',
        provider: 'microsoft-365',
        mxRecords: [{ priority: 0, exchange: 'company.mail.protection.outlook.com' }],
        status: 'plus-supported',
        timestamp: Date.now(),
        ttl: 3600,
      },
    };

    const result = await lookupMxRecords('precached.com');

    expect(result.provider).toBe('microsoft-365');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test('storage failure is non-fatal', async () => {
    mockChrome.storage.local.get.mockImplementationOnce(async () => {
      throw new Error('Storage error');
    });
    setFetchResponse([{ type: 15, TTL: 3600, data: '10 smtp.google.com.' }]);

    const result = await lookupMxRecords('storagefail.com');

    expect(result.provider).toBe('google-workspace');
  });

  test('clamps TTL to minimum of 1 hour', async () => {
    setFetchResponse([{ type: 15, TTL: 60, data: '10 smtp.google.com.' }]); // 60s TTL

    const result = await lookupMxRecords('shortttl.com');

    expect(result.ttl).toBe(3600); // clamped to 1 hour
  });

  test('clamps TTL to maximum of 24 hours', async () => {
    setFetchResponse([{ type: 15, TTL: 999999, data: '10 smtp.google.com.' }]);

    const result = await lookupMxRecords('longttl.com');

    expect(result.ttl).toBe(86400); // clamped to 24 hours
  });
});
