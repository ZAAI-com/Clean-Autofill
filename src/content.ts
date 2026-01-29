// Access shared utilities (loaded via manifest before this script)
import type { CleanAutofillUtils, FillEmailRequest, FillEmailResponse } from './types';

const { isValidEmail } =
  (globalThis as { CleanAutofillUtils?: CleanAutofillUtils }).CleanAutofillUtils || {};

// Listen for messages from the background script
chrome.runtime.onMessage.addListener(
  (
    request: FillEmailRequest,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: FillEmailResponse) => void,
  ) => {
    if (request.action === 'fillEmail') {
      // Validate email before using
      if (!isValidEmail || !isValidEmail(request.email)) {
        sendResponse({ success: false, error: 'Invalid email format received' });
        return true;
      }

      try {
        const result = fillEmailInField(request.email);
        sendResponse({ success: true, message: result });
      } catch (error) {
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
    return true; // Keep the message channel open for async response
  },
);

function fillEmailInField(email: string): string {
  // First priority: Currently focused element
  const activeElement = document.activeElement;

  if (activeElement && isInputField(activeElement)) {
    fillInput(activeElement as HTMLElement, email);
    return 'Filled in active field';
  }

  // Second priority: Find email input fields
  const emailFields = findEmailFields();

  if (emailFields.length > 0) {
    // Fill the first visible email field
    const visibleEmailField = emailFields.find((field) => isElementVisible(field));
    if (visibleEmailField) {
      fillInput(visibleEmailField, email);
      visibleEmailField.focus();
      return 'Filled in email field';
    }

    // If no visible fields, try the first one anyway
    fillInput(emailFields[0], email);
    emailFields[0].focus();
    return 'Filled in email field';
  }

  // Third priority: Find any text input field
  const textFields = findTextFields();

  if (textFields.length > 0) {
    const visibleTextField = textFields.find((field) => isElementVisible(field));
    if (visibleTextField) {
      fillInput(visibleTextField, email);
      visibleTextField.focus();
      return 'Filled in text field';
    }
  }

  throw new Error('No suitable input field found');
}

function isInputField(element: Element | null): boolean {
  if (!element) return false;

  const tagName = element.tagName?.toLowerCase();

  if (tagName === 'input') {
    const inputElement = element as HTMLInputElement;
    const type = inputElement.type?.toLowerCase() || 'text';
    return ['text', 'email', 'url', 'search', 'tel'].includes(type);
  }

  return tagName === 'textarea' || (element as HTMLElement).isContentEditable;
}

function findEmailFields(): HTMLInputElement[] {
  const fieldsSet = new Set<HTMLInputElement>();

  // Find inputs with type="email"
  document.querySelectorAll<HTMLInputElement>('input[type="email"]').forEach((el) => {
    if (isInputField(el)) fieldsSet.add(el);
  });

  // Find inputs with email-related attributes
  const emailPatterns = [
    'input[name*="email" i]',
    'input[id*="email" i]',
    'input[placeholder*="email" i]',
    'input[autocomplete="email"]',
    'input[aria-label*="email" i]',
  ];

  emailPatterns.forEach((pattern) => {
    document.querySelectorAll<HTMLInputElement>(pattern).forEach((input) => {
      if (isInputField(input)) {
        fieldsSet.add(input);
      }
    });
  });

  return Array.from(fieldsSet);
}

function findTextFields(): HTMLInputElement[] {
  const fields: HTMLInputElement[] = [];

  // Find all text inputs that aren't readonly or disabled
  const selector =
    'input[type="text"]:not([readonly]):not([disabled]), ' +
    'input:not([type]):not([readonly]):not([disabled]), ' +
    'textarea:not([readonly]):not([disabled])';

  document.querySelectorAll<HTMLInputElement>(selector).forEach((input) => {
    if (isInputField(input)) {
      fields.push(input);
    }
  });

  return fields;
}

function isElementVisible(element: Element | null): boolean {
  if (!element) return false;

  const htmlElement = element as HTMLElement;
  const rect = htmlElement.getBoundingClientRect();
  const style = window.getComputedStyle(htmlElement);

  // Check element's own visibility
  const isSelfVisible =
    rect.width > 0 &&
    rect.height > 0 &&
    style.visibility !== 'hidden' &&
    style.display !== 'none' &&
    parseFloat(style.opacity) > 0;

  if (!isSelfVisible) return false;

  // Check if element is within viewport (not off-screen)
  const isInViewport =
    rect.top < window.innerHeight &&
    rect.bottom > 0 &&
    rect.left < window.innerWidth &&
    rect.right > 0;

  if (!isInViewport) return false;

  // Check parent visibility (walk up the DOM tree)
  let parent = htmlElement.parentElement;
  while (parent && parent !== document.body) {
    const parentStyle = window.getComputedStyle(parent);
    if (
      parentStyle.display === 'none' ||
      parentStyle.visibility === 'hidden' ||
      parseFloat(parentStyle.opacity) === 0
    ) {
      return false;
    }
    parent = parent.parentElement;
  }

  return true;
}

function fillInput(element: HTMLElement, value: string): void {
  // Focus the element first
  element.focus();

  // Handle contenteditable elements (e.g., ChatGPT, Claude)
  if (element.isContentEditable) {
    // Clear existing content and set new value
    element.textContent = '';
    element.textContent = value;

    // Dispatch input event for frameworks
    element.dispatchEvent(
      new InputEvent('input', {
        bubbles: true,
        cancelable: true,
        inputType: 'insertText',
        data: value,
      }),
    );
    return;
  }

  // Cast to input/textarea for value-based elements
  const inputElement = element as HTMLInputElement | HTMLTextAreaElement;

  // For React and other frameworks, use native setter for proper event handling
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    'value',
  )?.set;

  const nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLTextAreaElement.prototype,
    'value',
  )?.set;

  // Use the appropriate setter based on element type
  const setter =
    element.tagName.toLowerCase() === 'textarea'
      ? nativeTextAreaValueSetter
      : nativeInputValueSetter;

  if (setter) {
    // Clear and set value using native setter
    setter.call(inputElement, '');
    setter.call(inputElement, value);
  } else {
    // Fallback for older browsers or edge cases
    inputElement.value = '';
    inputElement.value = value;
  }

  // Dispatch events to notify frameworks of the change
  element.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
  element.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
}
