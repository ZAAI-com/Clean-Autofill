export type ProviderStatus = 'plus-supported' | 'plus-unsupported' | 'custom';

export { PLUS_SUPPORTED_DOMAINS, PLUS_UNSUPPORTED_DOMAINS } from './provider-domains.js';

import type { MxLookupResult } from '../types';
import { lookupMxRecords } from './mx-lookup.js';
import { PLUS_SUPPORTED_DOMAINS, PLUS_UNSUPPORTED_DOMAINS } from './provider-domains.js';

export function getProviderStatus(domain: string): ProviderStatus {
  const lower = domain.toLowerCase();
  if (PLUS_SUPPORTED_DOMAINS.has(lower)) return 'plus-supported';
  if (PLUS_UNSUPPORTED_DOMAINS.has(lower)) return 'plus-unsupported';
  return 'custom';
}

export function extractDomainFromEmail(email: string): string | null {
  const trimmed = email.trim();
  if (!trimmed) return null;
  const atIndex = trimmed.lastIndexOf('@');
  if (atIndex === -1 || atIndex === 0 || atIndex === trimmed.length - 1) return null;
  return trimmed.substring(atIndex + 1);
}

export function extractLocalPart(email: string): string | null {
  const trimmed = email.trim();
  if (!trimmed) return null;
  const atIndex = trimmed.lastIndexOf('@');
  if (atIndex <= 0) return null;
  return trimmed.substring(0, atIndex);
}

export const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z]{2,})+$/;

export async function getProviderStatusWithMx(
  domain: string,
): Promise<{ status: ProviderStatus; mxResult: MxLookupResult | null }> {
  const syncStatus = getProviderStatus(domain);
  if (syncStatus !== 'custom') return { status: syncStatus, mxResult: null };
  const mxResult = await lookupMxRecords(domain);
  return { status: mxResult.status, mxResult };
}
