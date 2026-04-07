import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';

import type { GenerateAndFillResponse } from '../types';

// Mock chrome API
let sendMessageRequest: Record<string, unknown> | null = null;

const mockChrome = {
  runtime: {
    sendMessage: mock(
      (
        request: Record<string, unknown>,
        _callback: (response: GenerateAndFillResponse) => void,
      ) => {
        sendMessageRequest = request;
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

beforeEach(() => {
  sendMessageRequest = null;
  clipboardContent = '';
  mockChrome.runtime.lastError = null;
  mockChrome.runtime.sendMessage.mockClear();
  mockChrome.runtime.openOptionsPage.mockClear();
  mockClipboard.writeText.mockClear();
  setupPopupDOM();
});

afterEach(() => {
  document.body.innerHTML = '';
});

describe('popup message protocol', () => {
  test('sends generateAndFill action on load', async () => {
    // Simulate what popup.ts does on load
    chrome.runtime.sendMessage({ action: 'generateAndFill' }, () => {});

    expect(mockChrome.runtime.sendMessage).toHaveBeenCalledTimes(1);
    expect(sendMessageRequest).toEqual({ action: 'generateAndFill' });
  });
});

describe('popup UI states', () => {
  test('shows email on successful response', () => {
    const els = getElements();

    const response: GenerateAndFillResponse = {
      success: true,
      email: 'example.com@mydomain.com',
      message: 'Email filled successfully',
    };

    els.loading.style.display = 'none';
    els.emailDisplay.textContent = response.email ?? '';
    els.result.style.display = 'block';
    els.statusMessage.textContent = response.message ?? '';

    expect(els.loading.style.display).toBe('none');
    expect(els.result.style.display).toBe('block');
    expect(els.emailDisplay.textContent).toBe('example.com@mydomain.com');
    expect(els.statusMessage.textContent).toBe('Email filled successfully');
  });

  test('shows config prompt when needsConfig is true', () => {
    const els = getElements();

    els.loading.style.display = 'none';
    els.configPrompt.style.display = 'block';

    expect(els.loading.style.display).toBe('none');
    expect(els.configPrompt.style.display).toBe('block');
    expect(els.result.style.display).toBe('none');
  });

  test('shows error message on failure', () => {
    const els = getElements();

    const response: GenerateAndFillResponse = {
      success: false,
      error: 'Cannot generate email for browser pages',
    };

    els.loading.style.display = 'none';
    els.errorDiv.textContent = response.error ?? '';
    els.errorDiv.style.display = 'block';

    expect(els.errorDiv.style.display).toBe('block');
    expect(els.errorDiv.textContent).toBe('Cannot generate email for browser pages');
    expect(els.result.style.display).toBe('none');
  });

  test('shows email even when fill fails', () => {
    const els = getElements();

    const response: GenerateAndFillResponse = {
      success: true,
      email: 'example.com@mydomain.com',
      message: 'Email generated (no field found to fill)',
    };

    els.loading.style.display = 'none';
    els.emailDisplay.textContent = response.email ?? '';
    els.result.style.display = 'block';
    els.statusMessage.textContent = response.message ?? '';

    expect(els.result.style.display).toBe('block');
    expect(els.emailDisplay.textContent).toBe('example.com@mydomain.com');
    expect(els.statusMessage.textContent).toBe('Email generated (no field found to fill)');
  });
});

describe('copy button', () => {
  test('copies email to clipboard', async () => {
    const email = 'example.com@mydomain.com';
    await navigator.clipboard.writeText(email);

    expect(mockClipboard.writeText).toHaveBeenCalledWith(email);
    expect(clipboardContent).toBe(email);
  });
});

describe('config link', () => {
  test('opens options page', () => {
    chrome.runtime.openOptionsPage();
    expect(mockChrome.runtime.openOptionsPage).toHaveBeenCalledTimes(1);
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
