import type { DetectedProvider, MxLookupResult, MxRecord, ProviderInfo } from '../types';
import type { ProviderStatus } from './providers.js';

const DNS_API_URL = 'https://dns.google/resolve';
const MX_RECORD_TYPE = 15;
const MIN_TTL = 3600; // 1 hour
const MAX_TTL = 86400; // 24 hours
const ERROR_TTL = 300; // 5 minutes — retry sooner on failure
const MX_CACHE_STORAGE_KEY = 'mxCache';

// MX exchange patterns mapped to detected providers
const PROVIDER_MX_PATTERNS: [DetectedProvider, RegExp[]][] = [
  ['google-workspace', [/\.google\.com$/, /\.googlemail\.com$/, /gmail-smtp-in\.l\.google\.com$/]],
  ['microsoft-365', [/\.mail\.protection\.outlook\.com$/]],
  ['fastmail', [/\.messagingengine\.com$/]],
  ['protonmail', [/\.protonmail\.ch$/]],
  ['zoho', [/\.zoho\.com$/, /\.zohomail\.com$/]],
  ['icloud', [/\.mail\.icloud\.com$/]],
  ['mimecast', [/\.mimecast\.com$/]],
  ['barracuda', [/\.barracudanetworks\.com$/]],
];

const PROVIDER_INFO: Record<DetectedProvider, ProviderInfo> = {
  'google-workspace': { name: 'Google Workspace', plusAddressingSupported: true },
  'microsoft-365': { name: 'Microsoft 365', plusAddressingSupported: true },
  fastmail: { name: 'Fastmail', plusAddressingSupported: true },
  protonmail: { name: 'Proton Mail', plusAddressingSupported: true },
  zoho: { name: 'Zoho Mail', plusAddressingSupported: true },
  icloud: { name: 'iCloud Mail', plusAddressingSupported: false },
  mimecast: { name: 'Mimecast', plusAddressingSupported: false },
  barracuda: { name: 'Barracuda', plusAddressingSupported: false },
};

// Security gateways — MX points here but actual mail provider is unknown
const SECURITY_GATEWAYS: ReadonlySet<DetectedProvider> = new Set(['mimecast', 'barracuda']);

interface DnsResponse {
  Status: number;
  Answer?: Array<{
    name: string;
    type: number;
    TTL: number;
    data: string; // "10 smtp.google.com." format for MX records
  }>;
}

// In-memory cache for the current session
const memoryCache = new Map<string, MxLookupResult>();

export function detectProviderFromMx(mxRecords: MxRecord[]): DetectedProvider | null {
  const sorted = [...mxRecords].sort((a, b) => a.priority - b.priority);
  for (const record of sorted) {
    const exchange = record.exchange.toLowerCase().replace(/\.$/, '');
    for (const [provider, patterns] of PROVIDER_MX_PATTERNS) {
      if (patterns.some((pattern) => pattern.test(exchange))) {
        return provider;
      }
    }
  }
  return null;
}

export function getProviderInfo(provider: DetectedProvider): ProviderInfo {
  return PROVIDER_INFO[provider];
}

async function fetchMxRecords(domain: string): Promise<{ records: MxRecord[]; ttl: number }> {
  const url = `${DNS_API_URL}?name=${encodeURIComponent(domain)}&type=MX`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`DNS lookup failed: ${response.status}`);
  }
  const data: DnsResponse = await response.json();

  if (data.Status !== 0) {
    return { records: [], ttl: MIN_TTL };
  }

  const mxAnswers = (data.Answer ?? []).filter((a) => a.type === MX_RECORD_TYPE);
  let minTtl = MAX_TTL;

  const records: MxRecord[] = mxAnswers.map((a) => {
    if (a.TTL < minTtl) minTtl = a.TTL;
    const spaceIndex = a.data.indexOf(' ');
    const priority = Number.parseInt(a.data.substring(0, spaceIndex), 10);
    const exchange = a.data.substring(spaceIndex + 1).replace(/\.$/, '');
    return { priority, exchange };
  });

  const ttl = Math.max(MIN_TTL, Math.min(minTtl, MAX_TTL));
  return { records, ttl };
}

function isExpired(result: MxLookupResult): boolean {
  return Date.now() > result.timestamp + result.ttl * 1000;
}

async function getCachedResult(domain: string): Promise<MxLookupResult | null> {
  const memResult = memoryCache.get(domain);
  if (memResult && !isExpired(memResult)) return memResult;

  try {
    const data = await chrome.storage.local.get(MX_CACHE_STORAGE_KEY);
    const cache = (data[MX_CACHE_STORAGE_KEY] ?? {}) as Record<string, MxLookupResult>;
    const stored = cache[domain];
    if (stored && !isExpired(stored)) {
      memoryCache.set(domain, stored);
      return stored;
    }
  } catch {
    // Storage unavailable, continue to network
  }
  return null;
}

async function setCachedResult(result: MxLookupResult): Promise<void> {
  memoryCache.set(result.domain, result);
  try {
    const data = await chrome.storage.local.get(MX_CACHE_STORAGE_KEY);
    const cache = (data[MX_CACHE_STORAGE_KEY] ?? {}) as Record<string, MxLookupResult>;
    // Prune expired entries
    const now = Date.now();
    for (const key of Object.keys(cache)) {
      if (now > cache[key].timestamp + cache[key].ttl * 1000) {
        delete cache[key];
      }
    }
    cache[result.domain] = result;
    await chrome.storage.local.set({ [MX_CACHE_STORAGE_KEY]: cache });
  } catch {
    // Storage failure is non-fatal
  }
}

function deriveStatus(provider: DetectedProvider | null): ProviderStatus {
  if (!provider) return 'custom';
  if (SECURITY_GATEWAYS.has(provider)) return 'custom';
  const info = PROVIDER_INFO[provider];
  return info.plusAddressingSupported ? 'plus-supported' : 'plus-unsupported';
}

export async function lookupMxRecords(domain: string): Promise<MxLookupResult> {
  const lower = domain.toLowerCase();

  const cached = await getCachedResult(lower);
  if (cached) return cached;

  try {
    const { records, ttl } = await fetchMxRecords(lower);
    const provider = detectProviderFromMx(records);
    const status = deriveStatus(provider);

    const result: MxLookupResult = {
      domain: lower,
      provider,
      mxRecords: records,
      status,
      timestamp: Date.now(),
      ttl,
    };

    await setCachedResult(result);
    return result;
  } catch {
    return {
      domain: lower,
      provider: null,
      mxRecords: [],
      status: 'custom',
      timestamp: Date.now(),
      ttl: ERROR_TTL,
    };
  }
}

/** Clear the in-memory cache (for testing). */
export function clearMemoryCache(): void {
  memoryCache.clear();
}
