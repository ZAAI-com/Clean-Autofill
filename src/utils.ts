// Shared utilities for Clean-Autofill extension
import type { CleanAutofillUtils } from './types';

// Special TLDs that require 3-part domain extraction
const SPECIAL_TLDS: readonly string[] = [
  'co.uk',
  'com.au',
  'com.br',
  'co.jp',
  'org.uk',
  'net.au',
  'co.in',
  'com.tw',
  'ac.uk',
  'gov.uk',
  'co.nz',
  'com.mx',
  'co.za',
  'com.sg',
  'com.hk',
  'co.kr',
  'com.ar',
  'com.co',
];

// Extract main domain from hostname (remove subdomains)
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

  // Split by dots
  const parts = domain.split('.');

  // Handle special TLDs (like .co.uk, .com.au)
  const lastTwoParts = parts.slice(-2).join('.');
  const lastThreeParts = parts.slice(-3).join('.');

  if (parts.length >= 3 && SPECIAL_TLDS.includes(lastTwoParts)) {
    // For special TLDs like .co.uk, take last 3 parts
    return lastThreeParts;
  } else if (parts.length >= 2) {
    // For regular TLDs like .com, .org, take last 2 parts
    return lastTwoParts;
  } else {
    // Fallback to original domain
    return domain;
  }
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
