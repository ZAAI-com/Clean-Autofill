import type { EmailHistoryEntry } from '../types';

const STORAGE_KEY = 'emailHistory';
const MAX_ENTRIES = 10_000;

export async function addEntry(entry: Omit<EmailHistoryEntry, 'id'>): Promise<EmailHistoryEntry> {
  const fullEntry: EmailHistoryEntry = {
    ...entry,
    id: crypto.randomUUID(),
  };

  const { emailHistory = [] } = await chrome.storage.local.get(STORAGE_KEY);
  const history = [fullEntry, ...(emailHistory as EmailHistoryEntry[])];

  // Enforce max limit
  if (history.length > MAX_ENTRIES) {
    history.length = MAX_ENTRIES;
  }

  await chrome.storage.local.set({ [STORAGE_KEY]: history });
  return fullEntry;
}

export interface HistoryQuery {
  search?: string;
  limit?: number;
  offset?: number;
}

export async function getHistory(query?: HistoryQuery): Promise<EmailHistoryEntry[]> {
  const { emailHistory = [] } = await chrome.storage.local.get(STORAGE_KEY);
  let entries = emailHistory as EmailHistoryEntry[];

  if (query?.search) {
    const term = query.search.toLowerCase();
    entries = entries.filter(
      (e) => e.domain.toLowerCase().includes(term) || e.email.toLowerCase().includes(term),
    );
  }

  const offset = query?.offset ?? 0;
  const limit = query?.limit ?? entries.length;
  return entries.slice(offset, offset + limit);
}

export async function deleteEntry(id: string): Promise<void> {
  const { emailHistory = [] } = await chrome.storage.local.get(STORAGE_KEY);
  const history = (emailHistory as EmailHistoryEntry[]).filter((e) => e.id !== id);
  await chrome.storage.local.set({ [STORAGE_KEY]: history });
}

export async function clearHistory(): Promise<void> {
  await chrome.storage.local.remove(STORAGE_KEY);
}
