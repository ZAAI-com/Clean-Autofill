import type { GenerateAndFillResponse } from '../types';

const POPUP_MESSAGES = {
  unableToGenerate: 'Unable to generate an email. Please try again.',
  noResponse: 'No response from the extension. Please try again.',
  failedToGenerate: 'Failed to generate an email.',
  failedToCopy: 'Failed to copy.',
} as const;

export function init(): void {
  const loading = document.getElementById('loading') as HTMLDivElement;
  const result = document.getElementById('result') as HTMLDivElement;
  const emailDisplay = document.getElementById('emailDisplay') as HTMLSpanElement;
  const copyButton = document.getElementById('copyButton') as HTMLButtonElement;
  const statusMessage = document.getElementById('statusMessage') as HTMLDivElement;
  const errorDiv = document.getElementById('error') as HTMLDivElement;
  const configPrompt = document.getElementById('configPrompt') as HTMLDivElement;
  const configLink = document.getElementById('configLink') as HTMLAnchorElement;

  let generatedEmail = '';

  // Request email generation and fill immediately on popup open
  chrome.runtime.sendMessage({ action: 'generateAndFill' }, (response: GenerateAndFillResponse) => {
    loading.style.display = 'none';
    showMessage('clear');

    if (chrome.runtime.lastError) {
      showMessage('error', POPUP_MESSAGES.unableToGenerate);
      return;
    }

    if (!response) {
      showMessage('error', POPUP_MESSAGES.noResponse);
      return;
    }

    if (response.needsConfig) {
      configPrompt.style.display = 'block';
      return;
    }

    if (!response.success || !response.email) {
      showMessage('error', response.error ?? POPUP_MESSAGES.failedToGenerate);
      return;
    }

    generatedEmail = response.email;
    emailDisplay.textContent = generatedEmail;
    result.style.display = 'block';

    if (response.message) {
      showMessage('status', response.message);
    }
  });

  copyButton.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(generatedEmail);
      copyButton.textContent = 'Copied!';
      copyButton.classList.add('copied');
      setTimeout(() => {
        copyButton.textContent = 'Copy';
        copyButton.classList.remove('copied');
      }, 1500);
    } catch {
      showMessage('error', POPUP_MESSAGES.failedToCopy);
    }
  });

  configLink.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
    window.close();
  });

  function showMessage(type: 'status' | 'error' | 'clear', message = ''): void {
    if (type === 'status') {
      statusMessage.textContent = message;
      errorDiv.textContent = '';
      errorDiv.style.display = 'none';
      return;
    }

    if (type === 'error') {
      statusMessage.textContent = '';
      errorDiv.textContent = message;
      errorDiv.style.display = 'block';
      return;
    }

    statusMessage.textContent = '';
    errorDiv.textContent = '';
    errorDiv.style.display = 'none';
  }
}

init();
