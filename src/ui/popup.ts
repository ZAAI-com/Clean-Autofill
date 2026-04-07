import type { GenerateAndFillResponse } from '../types';

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

  if (chrome.runtime.lastError) {
    showError('Unable to generate email. Please try again.');
    return;
  }

  if (!response) {
    showError('No response from extension. Please try again.');
    return;
  }

  if (response.needsConfig) {
    configPrompt.style.display = 'block';
    return;
  }

  if (!response.success || !response.email) {
    showError(response.error ?? 'Failed to generate email');
    return;
  }

  generatedEmail = response.email;
  emailDisplay.textContent = generatedEmail;
  result.style.display = 'block';

  if (response.message) {
    statusMessage.textContent = response.message;
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
    statusMessage.textContent = 'Failed to copy';
  }
});

configLink.addEventListener('click', (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
  window.close();
});

function showError(message: string): void {
  errorDiv.textContent = message;
  errorDiv.style.display = 'block';
}
