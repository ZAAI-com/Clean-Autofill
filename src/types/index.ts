export interface CleanAutofillUtils {
  extractMainDomain: (hostname: string) => string;
  isValidEmail: (email: unknown) => boolean;
  createTimeout: (ms: number, message?: string) => Promise<never>;
  debounce: <T extends (...args: unknown[]) => void>(func: T, wait: number) => T;
  SPECIAL_TLDS: readonly string[];
}

export interface FillEmailRequest {
  action: 'fillEmail';
  email: string;
}

export interface FillEmailResponse {
  success: boolean;
  message?: string;
  error?: string;
}

declare global {
  // eslint-disable-next-line no-var
  var CleanAutofillUtils: CleanAutofillUtils;
}
