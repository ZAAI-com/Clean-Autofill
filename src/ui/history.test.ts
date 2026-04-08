import { beforeEach, describe, expect, mock, test } from 'bun:test';

import type { EmailHistoryEntry } from '../types';

// Mock chrome.storage.local
let store: Record<string, unknown> = {};
const mockChrome = {
  storage: {
    local: {
      get: mock(async (key: string) => {
        const val = store[key];
        return val !== undefined ? { [key]: val } : {};
      }),
      set: mock(async (items: Record<string, unknown>) => {
        Object.assign(store, items);
      }),
      remove: mock(async (key: string) => {
        delete store[key];
      }),
    },
  },
};
(globalThis as Record<string, unknown>).chrome = mockChrome;

// Mock crypto.randomUUID
let uuidCounter = 0;
(globalThis as Record<string, unknown>).crypto = {
  randomUUID: () => `test-uuid-${++uuidCounter}`,
};

// Import after mocks are in place
const { addEntry, getHistory, deleteEntry, clearHistory } = await import('../ui/history.js');

function makeEntry(
  overrides?: Partial<Omit<EmailHistoryEntry, 'id'>>,
): Omit<EmailHistoryEntry, 'id'> {
  return {
    email: 'amazon.com@mg.de',
    domain: 'amazon.com',
    pageUrl: 'https://amazon.com/signup',
    pageTitle: 'Amazon - Sign Up',
    createdAt: '2026-04-07T10:00:00.000Z',
    mode: 'catchAll',
    ...overrides,
  };
}

describe('history module', () => {
  beforeEach(() => {
    store = {};
    uuidCounter = 0;
  });

  describe('addEntry', () => {
    test('adds entry with generated id', async () => {
      const entry = await addEntry(makeEntry());
      expect(entry.id).toBe('test-uuid-1');
      expect(entry.email).toBe('amazon.com@mg.de');
    });

    test('prepends new entries (newest first)', async () => {
      await addEntry(makeEntry({ domain: 'first.com' }));
      await addEntry(makeEntry({ domain: 'second.com' }));

      const entries = store.emailHistory as EmailHistoryEntry[];
      expect(entries[0].domain).toBe('second.com');
      expect(entries[1].domain).toBe('first.com');
    });

    test('enforces max limit of 10,000', async () => {
      // Pre-fill with 10,000 entries
      const existing = Array.from({ length: 10_000 }, (_, i) => ({
        id: `old-${i}`,
        email: `site${i}.com@mg.de`,
        domain: `site${i}.com`,
        pageUrl: `https://site${i}.com`,
        pageTitle: `Site ${i}`,
        createdAt: '2026-01-01T00:00:00.000Z',
        mode: 'catchAll' as const,
      }));
      store.emailHistory = existing;

      await addEntry(makeEntry({ domain: 'new.com' }));

      const entries = store.emailHistory as EmailHistoryEntry[];
      expect(entries.length).toBe(10_000);
      expect(entries[0].domain).toBe('new.com');
    });
  });

  describe('getHistory', () => {
    test('returns all entries when no query', async () => {
      await addEntry(makeEntry({ domain: 'a.com' }));
      await addEntry(makeEntry({ domain: 'b.com' }));

      const entries = await getHistory();
      expect(entries.length).toBe(2);
    });

    test('filters by search term (domain)', async () => {
      await addEntry(makeEntry({ domain: 'amazon.com', email: 'amazon.com@mg.de' }));
      await addEntry(makeEntry({ domain: 'google.com', email: 'google.com@mg.de' }));

      const entries = await getHistory({ search: 'amazon' });
      expect(entries.length).toBe(1);
      expect(entries[0].domain).toBe('amazon.com');
    });

    test('filters by search term (email)', async () => {
      await addEntry(makeEntry({ email: 'user+amazon@gmail.com', domain: 'amazon.com' }));
      await addEntry(makeEntry({ email: 'user+netflix@gmail.com', domain: 'netflix.com' }));

      const entries = await getHistory({ search: 'netflix' });
      expect(entries.length).toBe(1);
      expect(entries[0].email).toBe('user+netflix@gmail.com');
    });

    test('search is case-insensitive', async () => {
      await addEntry(makeEntry({ domain: 'Amazon.com' }));

      const entries = await getHistory({ search: 'AMAZON' });
      expect(entries.length).toBe(1);
    });

    test('supports limit and offset', async () => {
      await addEntry(makeEntry({ domain: 'a.com' }));
      await addEntry(makeEntry({ domain: 'b.com' }));
      await addEntry(makeEntry({ domain: 'c.com' }));

      const page = await getHistory({ limit: 1, offset: 1 });
      expect(page.length).toBe(1);
      expect(page[0].domain).toBe('b.com');
    });

    test('returns empty array when no history', async () => {
      const entries = await getHistory();
      expect(entries).toEqual([]);
    });
  });

  describe('deleteEntry', () => {
    test('removes entry by id', async () => {
      await addEntry(makeEntry({ domain: 'keep.com' }));
      await addEntry(makeEntry({ domain: 'remove.com' }));

      const entries = store.emailHistory as EmailHistoryEntry[];
      const removeId = entries.find((e) => e.domain === 'remove.com')?.id;

      await deleteEntry(removeId);

      const remaining = store.emailHistory as EmailHistoryEntry[];
      expect(remaining.length).toBe(1);
      expect(remaining[0].domain).toBe('keep.com');
    });

    test('no-op if id not found', async () => {
      await addEntry(makeEntry());

      await deleteEntry('nonexistent');

      const entries = store.emailHistory as EmailHistoryEntry[];
      expect(entries.length).toBe(1);
    });
  });

  describe('clearHistory', () => {
    test('removes all history', async () => {
      await addEntry(makeEntry());
      await addEntry(makeEntry());

      await clearHistory();

      expect(store.emailHistory).toBeUndefined();
      const entries = await getHistory();
      expect(entries).toEqual([]);
    });
  });
});
