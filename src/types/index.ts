import type { ProviderStatus } from '../providers/providers.js';

export type EmailMode = 'catchAll' | 'plusAddressing';

export interface MxRecord {
  exchange: string;
  priority: number;
}

export type DetectedProvider =
  | 'google-workspace'
  | 'microsoft-365'
  | 'fastmail'
  | 'protonmail'
  | 'zoho'
  | 'icloud'
  | 'mimecast'
  | 'barracuda';

export interface ProviderInfo {
  name: string;
  plusAddressingSupported: boolean;
}

export interface MxLookupResult {
  domain: string;
  provider: DetectedProvider | null;
  mxRecords: MxRecord[];
  status: ProviderStatus;
  timestamp: number;
  ttl: number;
}

/**
 * A single history entry representing one email generation event.
 */
export interface EmailHistoryEntry {
  id: string;
  email: string;
  domain: string;
  pageUrl: string;
  pageTitle: string;
  createdAt: string;
  mode: EmailMode;
}

/**
 * Interface for shared utility functions exposed globally for use across extension contexts.
 */
export interface CleanAutofillUtils {
  extractMainDomain: (hostname: string) => string;
  isValidEmail: (email: unknown) => boolean;
  createTimeout: (ms: number, message?: string) => Promise<never>;
  debounce: <T extends (...args: unknown[]) => void>(func: T, wait: number) => T;
  SPECIAL_TLDS: readonly string[];
}

/**
 * Message format for requesting email fill from the content script.
 */
export interface FillEmailRequest {
  action: 'fillEmail';
  email: string;
}

/**
 * Response format from content script after attempting to fill an email field.
 */
export interface FillEmailResponse {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * Message from popup requesting email generation and fill.
 */
export interface GenerateAndFillRequest {
  action: 'generateAndFill';
}

/**
 * Response from background to popup after generating and filling email.
 */
export interface GenerateAndFillResponse {
  success: boolean;
  email?: string;
  message?: string;
  error?: string;
  needsConfig?: boolean;
}

declare global {
  // eslint-disable-next-line no-var
  var CleanAutofillUtils: CleanAutofillUtils;
}
