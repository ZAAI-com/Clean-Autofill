// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'fillEmail') {
    try {
      const result = fillEmailInField(request.email);
      sendResponse({ success: true, message: result });
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
  }
  return true; // Keep the message channel open for async response
});

function fillEmailInField(email) {
  // First priority: Currently focused element
  const activeElement = document.activeElement;
  
  if (activeElement && isInputField(activeElement)) {
    fillInput(activeElement, email);
    return 'Filled in active field';
  }
  
  // Second priority: Find email input fields
  const emailFields = findEmailFields();
  
  if (emailFields.length > 0) {
    // Fill the first visible email field
    const visibleField = emailFields.find(field => isElementVisible(field));
    if (visibleField) {
      fillInput(visibleField, email);
      visibleField.focus();
      return 'Filled in email field';
    }
    
    // If no visible fields, fill the first one
    fillInput(emailFields[0], email);
    emailFields[0].focus();
    return 'Filled in email field';
  }
  
  // Third priority: Find any text input field
  const textFields = findTextFields();
  
  if (textFields.length > 0) {
    const visibleField = textFields.find(field => isElementVisible(field));
    if (visibleField) {
      fillInput(visibleField, email);
      visibleField.focus();
      return 'Filled in text field';
    }
  }
  
  throw new Error('No suitable input field found');
}

function isInputField(element) {
  const tagName = element.tagName.toLowerCase();
  
  if (tagName === 'input') {
    const type = element.type.toLowerCase();
    return ['text', 'email', 'url', 'search', 'tel'].includes(type);
  }
  
  return tagName === 'textarea' || element.isContentEditable;
}

function findEmailFields() {
  const fields = [];
  
  // Find inputs with type="email"
  fields.push(...document.querySelectorAll('input[type="email"]'));
  
  // Find inputs with email-related attributes
  const emailPatterns = [
    'input[name*="email" i]',
    'input[id*="email" i]',
    'input[placeholder*="email" i]',
    'input[autocomplete="email"]',
    'input[aria-label*="email" i]'
  ];
  
  emailPatterns.forEach(pattern => {
    const inputs = document.querySelectorAll(pattern);
    inputs.forEach(input => {
      if (!fields.includes(input) && isInputField(input)) {
        fields.push(input);
      }
    });
  });
  
  return fields;
}

function findTextFields() {
  const fields = [];
  
  // Find all text inputs
  const inputs = document.querySelectorAll('input[type="text"], input:not([type]), textarea');
  
  inputs.forEach(input => {
    if (isInputField(input) && !input.readOnly && !input.disabled) {
      fields.push(input);
    }
  });
  
  return fields;
}

function isElementVisible(element) {
  if (!element) return false;
  
  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);
  
  return (
    rect.width > 0 &&
    rect.height > 0 &&
    style.visibility !== 'hidden' &&
    style.display !== 'none' &&
    style.opacity !== '0'
  );
}

function fillInput(element, value) {
  // Focus the element first
  element.focus();
  
  // Clear existing value
  element.value = '';
  
  // Set the new value
  element.value = value;
  
  // Trigger input events to ensure the website registers the change
  const inputEvent = new Event('input', { bubbles: true, cancelable: true });
  element.dispatchEvent(inputEvent);
  
  const changeEvent = new Event('change', { bubbles: true, cancelable: true });
  element.dispatchEvent(changeEvent);
  
  // For React and other frameworks
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    'value'
  ).set;
  
  if (nativeInputValueSetter) {
    nativeInputValueSetter.call(element, value);
    const event = new Event('input', { bubbles: true });
    element.dispatchEvent(event);
  }
}
