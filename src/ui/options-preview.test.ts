import { beforeAll, beforeEach, describe, expect, mock, test } from 'bun:test';

type PreviewStorageArea = {
  get: (
    keys?: string | string[] | Record<string, unknown> | null,
  ) => Promise<Record<string, unknown>>;
  set: (items: Record<string, unknown>) => Promise<void>;
  remove: (keys: string | string[]) => Promise<void>;
};

type PreviewChrome = {
  storage?: {
    sync?: PreviewStorageArea;
    local?: PreviewStorageArea;
  };
  identity?: {
    getProfileUserInfo?: (_details?: {
      accountStatus?: string;
    }) => Promise<{ email: string; id: string }>;
  };
};

type PreviewApi = {
  installPreviewChrome: () => void;
};

function getPreviewApi(): PreviewApi {
  const api = (globalThis as typeof globalThis & { CleanAutofillPreview?: PreviewApi })
    .CleanAutofillPreview;

  if (!api) {
    throw new Error('Preview API not initialized');
  }

  return api;
}

beforeAll(async () => {
  await import('./options-preview.js');
});

describe('options preview shim', () => {
  beforeEach(() => {
    delete (globalThis as typeof globalThis & { chrome?: PreviewChrome }).chrome;
  });

  test('installs storage and identity shims when extension APIs are missing', async () => {
    getPreviewApi().installPreviewChrome();

    const chromeApi = (globalThis as typeof globalThis & { chrome?: PreviewChrome }).chrome;
    if (
      !chromeApi?.storage?.sync ||
      !chromeApi.storage.local ||
      !chromeApi.identity?.getProfileUserInfo
    ) {
      throw new Error('Preview chrome API missing');
    }

    await chromeApi.storage.sync.set({ emailMode: 'catchAll' });
    await chromeApi.storage.local.set({ emailHistory: ['entry'] });

    expect(await chromeApi.storage.sync.get(['emailMode'])).toEqual({ emailMode: 'catchAll' });
    expect(await chromeApi.storage.local.get('emailHistory')).toEqual({ emailHistory: ['entry'] });
    await expect(chromeApi.identity.getProfileUserInfo({ accountStatus: 'ANY' })).resolves.toEqual({
      email: '',
      id: '',
    });
  });

  test('does not replace existing chrome APIs', async () => {
    const syncGet = mock(async () => ({ emailMode: 'plusAddressing' }));
    const profileGet = mock(async () => ({ email: 'user@example.com', id: '123' }));

    (globalThis as typeof globalThis & { chrome?: PreviewChrome }).chrome = {
      storage: {
        sync: {
          get: syncGet,
          set: mock(async () => {}),
          remove: mock(async () => {}),
        },
        local: createLocalArea(),
      },
      identity: {
        getProfileUserInfo: profileGet,
      },
    };

    getPreviewApi().installPreviewChrome();

    const chromeApi = (globalThis as typeof globalThis & { chrome?: PreviewChrome }).chrome;
    expect(chromeApi?.storage?.sync?.get).toBe(syncGet);
    expect(chromeApi?.identity?.getProfileUserInfo).toBe(profileGet);
  });
});

function createLocalArea(): PreviewStorageArea {
  return {
    async get(): Promise<Record<string, unknown>> {
      return {};
    },
    async set(): Promise<void> {},
    async remove(): Promise<void> {},
  };
}
