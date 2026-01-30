// Shared utilities for Clean-Autofill extension
import psl from 'psl';
import type { CleanAutofillUtils } from './types';

// Kept for backwards compatibility and tests
const SPECIAL_TLDS: readonly string[] = [
  // UK
  'co.uk',
  'org.uk',
  'ac.uk',
  'gov.uk',
  'me.uk',
  'net.uk',
  // Australia
  'com.au',
  'net.au',
  'org.au',
  'edu.au',
  'gov.au',
  // New Zealand
  'co.nz',
  'net.nz',
  'org.nz',
  'govt.nz',
  // Japan
  'co.jp',
  'or.jp',
  'ne.jp',
  'ac.jp',
  'go.jp',
  // China
  'com.cn',
  'net.cn',
  'org.cn',
  'gov.cn',
  'edu.cn',
  // Brazil
  'com.br',
  'net.br',
  'org.br',
  'gov.br',
  // India
  'co.in',
  'net.in',
  'org.in',
  'gov.in',
  'ac.in',
  // South Africa
  'co.za',
  'net.za',
  'org.za',
  'gov.za',
  // Mexico
  'com.mx',
  'net.mx',
  'org.mx',
  'gob.mx',
  // Korea
  'co.kr',
  'or.kr',
  'ne.kr',
  'go.kr',
  // Singapore
  'com.sg',
  'net.sg',
  'org.sg',
  'gov.sg',
  // Hong Kong
  'com.hk',
  'net.hk',
  'org.hk',
  'gov.hk',
  // Taiwan
  'com.tw',
  'net.tw',
  'org.tw',
  'gov.tw',
  // Argentina & Colombia
  'com.ar',
  'com.co',
  // Israel
  'co.il',
  'org.il',
  'net.il',
  'gov.il',
  'ac.il',
];

// Extract main domain from hostname using Public Suffix List
function extractMainDomain(hostname: string): string {
  // Handle localhost
  if (hostname === 'localhost') {
    return hostname;
  }

  // Handle IPv4 addresses
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
    return hostname;
  }

  // Handle IPv6 addresses (bracketed or plain)
  if (hostname.includes(':') || /^\[.*\]$/.test(hostname)) {
    return hostname;
  }

  // Remove 'www.' prefix if present
  const domain = hostname.replace(/^www\./, '');

  // Use PSL to get the registrable domain
  const parsed = psl.get(domain);
  if (parsed) {
    return parsed;
  }

  // Fallback: split by dots and use heuristics
  const parts = domain.split('.');
  if (parts.length >= 2) {
    return parts.slice(-2).join('.');
  }

  return domain;
}

// Validate basic email format
function isValidEmail(email: unknown): boolean {
  return (
    typeof email === 'string' &&
    email.length > 0 &&
    email.length < 254 &&
    /^[^@\s]+@[^@\s]+$/.test(email)
  );
}

// Create a timeout promise for async operations
function createTimeout(ms: number, message = 'Operation timed out'): Promise<never> {
  return new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms));
}

// Debounce function for rate-limiting calls
function debounce<T extends (...args: unknown[]) => void>(func: T, wait: number): T {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  return function executedFunction(this: unknown, ...args: unknown[]) {
    const later = () => {
      clearTimeout(timeout);
      func.apply(this, args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  } as T;
}

// Export for use in other files (works in service worker context)
const utils: CleanAutofillUtils = {
  extractMainDomain,
  isValidEmail,
  createTimeout,
  debounce,
  SPECIAL_TLDS,
};

if (typeof globalThis !== 'undefined') {
  (globalThis as { CleanAutofillUtils?: CleanAutofillUtils }).CleanAutofillUtils = utils;
}

export { extractMainDomain, isValidEmail, createTimeout, debounce, SPECIAL_TLDS };
