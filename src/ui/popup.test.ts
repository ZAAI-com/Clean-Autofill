import { afterEach, beforeAll, beforeEach, describe, expect, mock, test } from 'bun:test';

import type { GenerateAndFillResponse } from '../types';

// Mock chrome API — must be set up before dynamic import of popup.ts
let mockResponse: GenerateAndFillResponse | undefined;

const mockChrome = {
  runtime: {
    sendMessage: mock(
      (
        _request: Record<string, unknown>,
        callback: (response: GenerateAndFillResponse) => void,
      ) => {
        callback(mockResponse as GenerateAndFillResponse);
      },
    ),
    openOptionsPage: mock(() => {}),
    lastError: null as { message: string } | null,
  },
};

(globalThis as Record<string, unknown>).chrome = mockChrome;

// Mock navigator.clipboard
let clipboardContent = '';
const mockClipboard = {
  writeText: mock(async (text: string) => {
    clipboardContent = text;
  }),
};
Object.defineProperty(navigator, 'clipboard', { value: mockClipboard, writable: true });

// Mock window.close
window.close = mock(() => {});

function setupPopupDOM(): void {
  document.body.innerHTML = `
    <div id="loading">Generating email...</div>
    <div id="result" style="display: none;">
      <span id="emailDisplay"></span>
      <button id="copyButton">Copy</button>
      <div id="statusMessage"></div>
    </div>
    <div id="error" style="display: none;"></div>
    <div id="configPrompt" style="display: none;">
      <a id="configLink" href="#">configure your email</a>
    </div>
  `;
}

function getElements() {
  return {
    loading: document.getElementById('loading') as HTMLDivElement,
    result: document.getElementById('result') as HTMLDivElement,
    emailDisplay: document.getElementById('emailDisplay') as HTMLSpanElement,
    copyButton: document.getElementById('copyButton') as HTMLButtonElement,
    statusMessage: document.getElementById('statusMessage') as HTMLDivElement,
    errorDiv: document.getElementById('error') as HTMLDivElement,
    configPrompt: document.getElementById('configPrompt') as HTMLDivElement,
    configLink: document.getElementById('configLink') as HTMLAnchorElement,
  };
}

// Dynamic import so mocks are in place before popup.ts module-level init() runs
let init: () => void;
beforeAll(async () => {
  setupPopupDOM();
  mockResponse = { success: true, email: 'setup@test.com' };
  const mod = await import('./popup.js');
  init = mod.init;
});

beforeEach(() => {
  mockResponse = undefined;
  clipboardContent = '';
  mockChrome.runtime.lastError = null;
  mockChrome.runtime.sendMessage.mockClear();
  mockChrome.runtime.openOptionsPage.mockClear();
  mockClipboard.writeText.mockClear();
  (window.close as ReturnType<typeof mock>).mockClear();
  setupPopupDOM();
});

afterEach(() => {
  document.body.innerHTML = '';
});

describe('popup message protocol', () => {
  test('sends generateAndFill action on load', () => {
    mockResponse = { success: true, email: 'test@test.com' };
    init();

    expect(mockChrome.runtime.sendMessage).toHaveBeenCalledTimes(1);
    const call = mockChrome.runtime.sendMessage.mock.calls[0];
    expect(call[0]).toEqual({ action: 'generateAndFill' });
  });
});

describe('popup UI states', () => {
  test('shows email on successful response', () => {
    mockResponse = {
      success: true,
      email: 'example.com@mydomain.com',
      message: 'Email filled successfully',
    };
    init();

    const els = getElements();
    expect(els.loading.style.display).toBe('none');
    expect(els.result.style.display).toBe('block');
    expect(els.emailDisplay.textContent).toBe('example.com@mydomain.com');
    expect(els.statusMessage.textContent).toBe('Email filled successfully');
  });

  test('shows config prompt when needsConfig is true', () => {
    mockResponse = { success: false, needsConfig: true };
    init();

    const els = getElements();
    expect(els.loading.style.display).toBe('none');
    expect(els.configPrompt.style.display).toBe('block');
    expect(els.result.style.display).toBe('none');
  });

  test('shows error message on failure', () => {
    mockResponse = {
      success: false,
      error: 'Cannot generate email for browser pages',
    };
    init();

    const els = getElements();
    expect(els.loading.style.display).toBe('none');
    expect(els.errorDiv.style.display).toBe('block');
    expect(els.errorDiv.textContent).toBe('Cannot generate email for browser pages');
    expect(els.result.style.display).toBe('none');
  });

  test('shows email even when fill fails', () => {
    mockResponse = {
      success: true,
      email: 'example.com@mydomain.com',
      message: 'Email generated (no field found to fill)',
    };
    init();

    const els = getElements();
    expect(els.result.style.display).toBe('block');
    expect(els.emailDisplay.textContent).toBe('example.com@mydomain.com');
    expect(els.statusMessage.textContent).toBe('Email generated (no field found to fill)');
  });

  test('shows error when lastError is set', () => {
    mockChrome.runtime.lastError = { message: 'Extension context invalidated' };
    mockResponse = { success: true, email: 'test@test.com' };
    init();

    const els = getElements();
    expect(els.loading.style.display).toBe('none');
    expect(els.errorDiv.style.display).toBe('block');
    expect(els.errorDiv.textContent).toBe('Unable to generate an email. Please try again.');
  });

  test('shows error when response is undefined', () => {
    mockResponse = undefined;
    init();

    const els = getElements();
    expect(els.loading.style.display).toBe('none');
    expect(els.errorDiv.style.display).toBe('block');
    expect(els.errorDiv.textContent).toBe('No response from the extension. Please try again.');
  });

  test('shows default error when response has no error message', () => {
    mockResponse = { success: false };
    init();

    const els = getElements();
    expect(els.errorDiv.textContent).toBe('Failed to generate an email.');
  });
});

describe('copy button', () => {
  test('copies email to clipboard on click', async () => {
    mockResponse = { success: true, email: 'example.com@mydomain.com' };
    init();

    const els = getElements();
    els.copyButton.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockClipboard.writeText).toHaveBeenCalledWith('example.com@mydomain.com');
    expect(clipboardContent).toBe('example.com@mydomain.com');
    expect(els.copyButton.textContent).toBe('Copied!');
    expect(els.copyButton.classList.contains('copied')).toBe(true);
  });

  test('shows a red error message when copy fails', async () => {
    mockClipboard.writeText.mockImplementationOnce(async () => {
      throw new Error('Clipboard denied');
    });
    mockResponse = { success: true, email: 'example.com@mydomain.com' };
    init();

    const els = getElements();
    els.copyButton.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(els.errorDiv.style.display).toBe('block');
    expect(els.errorDiv.textContent).toBe('Failed to copy.');
  });
});

describe('config link', () => {
  test('opens options page and closes popup on click', () => {
    mockResponse = { success: false, needsConfig: true };
    init();

    const els = getElements();
    els.configLink.click();

    expect(mockChrome.runtime.openOptionsPage).toHaveBeenCalledTimes(1);
    expect(window.close).toHaveBeenCalledTimes(1);
  });
});

describe('GenerateAndFillResponse shape', () => {
  test('success response has required fields', () => {
    const response: GenerateAndFillResponse = {
      success: true,
      email: 'test.com@domain.com',
    };
    expect(response.success).toBe(true);
    expect(response.email).toBe('test.com@domain.com');
  });

  test('needsConfig response', () => {
    const response: GenerateAndFillResponse = {
      success: false,
      needsConfig: true,
    };
    expect(response.success).toBe(false);
    expect(response.needsConfig).toBe(true);
    expect(response.email).toBeUndefined();
  });

  test('error response', () => {
    const response: GenerateAndFillResponse = {
      success: false,
      error: 'Something went wrong',
    };
    expect(response.success).toBe(false);
    expect(response.error).toBe('Something went wrong');
  });

  test('success with fill failure still includes email', () => {
    const response: GenerateAndFillResponse = {
      success: true,
      email: 'github.com@mg.de',
      message: 'Email generated (please refresh the page to autofill)',
    };
    expect(response.success).toBe(true);
    expect(response.email).toBe('github.com@mg.de');
    expect(response.message).toContain('refresh');
  });
});
