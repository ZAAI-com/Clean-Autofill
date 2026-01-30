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

declare global {
  // eslint-disable-next-line no-var
  var CleanAutofillUtils: CleanAutofillUtils;
}
