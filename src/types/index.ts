export type EmailMode = 'catchAll' | 'plusAddressing';

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
