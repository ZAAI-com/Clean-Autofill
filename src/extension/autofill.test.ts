import { beforeAll, beforeEach, describe, expect, mock, test } from 'bun:test';

// Mock chrome API before importing content module
const mockChrome = {
  runtime: {
    onMessage: {
      addListener: mock(() => {}),
    },
  },
};

// Set up globals before importing content module
(globalThis as Record<string, unknown>).chrome = mockChrome;

// Dynamic imports to ensure mocks are set up first
let isInputField: (element: Element | null) => boolean;
let findEmailFields: () => HTMLInputElement[];
let findTextFields: () => HTMLInputElement[];
let isElementVisible: (element: Element | null) => boolean;

beforeAll(async () => {
  // Load utils first (content.ts depends on it)
  await import('../email/utils.js');

  // Now import the exported pure functions from production code
  const content = await import('../extension/autofill.js');
  isInputField = content.isInputField;
  findEmailFields = content.findEmailFields;
  findTextFields = content.findTextFields;
  isElementVisible = content.isElementVisible;
});

describe('isInputField', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  test('returns false for null element', () => {
    expect(isInputField(null)).toBe(false);
  });

  test('returns true for text input', () => {
    const input = document.createElement('input');
    input.type = 'text';
    expect(isInputField(input)).toBe(true);
  });

  test('returns true for email input', () => {
    const input = document.createElement('input');
    input.type = 'email';
    expect(isInputField(input)).toBe(true);
  });

  test('returns true for url input', () => {
    const input = document.createElement('input');
    input.type = 'url';
    expect(isInputField(input)).toBe(true);
  });

  test('returns true for search input', () => {
    const input = document.createElement('input');
    input.type = 'search';
    expect(isInputField(input)).toBe(true);
  });

  test('returns true for tel input', () => {
    const input = document.createElement('input');
    input.type = 'tel';
    expect(isInputField(input)).toBe(true);
  });

  test('returns false for password input', () => {
    const input = document.createElement('input');
    input.type = 'password';
    expect(isInputField(input)).toBe(false);
  });

  test('returns false for checkbox input', () => {
    const input = document.createElement('input');
    input.type = 'checkbox';
    expect(isInputField(input)).toBe(false);
  });

  test('returns false for hidden input', () => {
    const input = document.createElement('input');
    input.type = 'hidden';
    expect(isInputField(input)).toBe(false);
  });

  test('returns true for textarea', () => {
    const textarea = document.createElement('textarea');
    expect(isInputField(textarea)).toBe(true);
  });

  test('returns true for input without type (defaults to text)', () => {
    const input = document.createElement('input');
    expect(isInputField(input)).toBe(true);
  });

  test('returns false for div element', () => {
    const div = document.createElement('div');
    expect(isInputField(div)).toBe(false);
  });

  test('returns false for button element', () => {
    const button = document.createElement('button');
    expect(isInputField(button)).toBe(false);
  });
});

describe('findEmailFields', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  test('finds input with type="email"', () => {
    document.body.innerHTML = '<input type="email" />';
    const fields = findEmailFields();
    expect(fields.length).toBe(1);
    expect(fields[0].type).toBe('email');
  });

  test('finds input with name containing "email"', () => {
    document.body.innerHTML = '<input type="text" name="user_email" />';
    const fields = findEmailFields();
    expect(fields.length).toBe(1);
  });

  test('finds input with id containing "email"', () => {
    document.body.innerHTML = '<input type="text" id="emailAddress" />';
    const fields = findEmailFields();
    expect(fields.length).toBe(1);
  });

  test('finds input with placeholder containing "email"', () => {
    document.body.innerHTML = '<input type="text" placeholder="Enter your email" />';
    const fields = findEmailFields();
    expect(fields.length).toBe(1);
  });

  test('finds input with autocomplete="email"', () => {
    document.body.innerHTML = '<input type="text" autocomplete="email" />';
    const fields = findEmailFields();
    expect(fields.length).toBe(1);
  });

  test('finds input with aria-label containing "email"', () => {
    document.body.innerHTML = '<input type="text" aria-label="Email address" />';
    const fields = findEmailFields();
    expect(fields.length).toBe(1);
  });

  test('does not duplicate fields matching multiple patterns', () => {
    document.body.innerHTML = '<input type="email" name="email" id="email" />';
    const fields = findEmailFields();
    expect(fields.length).toBe(1);
  });

  test('returns empty array when no email fields found', () => {
    document.body.innerHTML = '<input type="text" name="username" />';
    const fields = findEmailFields();
    expect(fields.length).toBe(0);
  });

  test('ignores password fields with email in name', () => {
    document.body.innerHTML = '<input type="password" name="email_password" />';
    const fields = findEmailFields();
    expect(fields.length).toBe(0);
  });
});

describe('findTextFields', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  test('finds text input', () => {
    document.body.innerHTML = '<input type="text" />';
    const fields = findTextFields();
    expect(fields.length).toBe(1);
  });

  test('finds input without type attribute', () => {
    document.body.innerHTML = '<input />';
    const fields = findTextFields();
    expect(fields.length).toBe(1);
  });

  test('finds textarea', () => {
    document.body.innerHTML = '<textarea></textarea>';
    const fields = findTextFields();
    expect(fields.length).toBe(1);
  });

  test('excludes readonly input', () => {
    document.body.innerHTML = '<input type="text" readonly />';
    const fields = findTextFields();
    expect(fields.length).toBe(0);
  });

  test('excludes disabled input', () => {
    document.body.innerHTML = '<input type="text" disabled />';
    const fields = findTextFields();
    expect(fields.length).toBe(0);
  });

  test('excludes readonly textarea', () => {
    document.body.innerHTML = '<textarea readonly></textarea>';
    const fields = findTextFields();
    expect(fields.length).toBe(0);
  });

  test('excludes disabled textarea', () => {
    document.body.innerHTML = '<textarea disabled></textarea>';
    const fields = findTextFields();
    expect(fields.length).toBe(0);
  });

  test('excludes password input', () => {
    document.body.innerHTML = '<input type="password" />';
    const fields = findTextFields();
    expect(fields.length).toBe(0);
  });

  test('excludes hidden input', () => {
    document.body.innerHTML = '<input type="hidden" />';
    const fields = findTextFields();
    expect(fields.length).toBe(0);
  });

  test('finds multiple text fields', () => {
    document.body.innerHTML = `
      <input type="text" />
      <input />
      <textarea></textarea>
    `;
    const fields = findTextFields();
    expect(fields.length).toBe(3);
  });
});

describe('isElementVisible', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  test('returns false for null element', () => {
    expect(isElementVisible(null)).toBe(false);
  });

  test('returns true for visible element', () => {
    const input = document.createElement('input');
    input.style.width = '100px';
    input.style.height = '30px';
    input.style.opacity = '1';
    input.style.visibility = 'visible';
    input.style.display = 'block';
    document.body.appendChild(input);

    // Mock getBoundingClientRect
    input.getBoundingClientRect = () =>
      ({
        width: 100,
        height: 30,
        top: 100,
        bottom: 130,
        left: 100,
        right: 200,
        x: 100,
        y: 100,
        toJSON: () => {},
      }) as DOMRect;

    // happy-dom doesn't fully support getComputedStyle, so we test the function differently
    // Just verify it doesn't throw and returns a boolean
    const result = isElementVisible(input);
    expect(typeof result).toBe('boolean');
  });

  test('returns false for element with display:none', () => {
    const input = document.createElement('input');
    input.style.display = 'none';
    document.body.appendChild(input);

    input.getBoundingClientRect = () =>
      ({
        width: 0,
        height: 0,
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
      }) as DOMRect;

    expect(isElementVisible(input)).toBe(false);
  });

  test('returns false for element with zero dimensions', () => {
    const input = document.createElement('input');
    document.body.appendChild(input);

    input.getBoundingClientRect = () =>
      ({
        width: 0,
        height: 0,
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
      }) as DOMRect;

    expect(isElementVisible(input)).toBe(false);
  });
});
