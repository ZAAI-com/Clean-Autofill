type PreviewProfile = {
  email: string;
  id: string;
};

type StorageKeys = string | string[] | Record<string, unknown> | null | undefined;

type PreviewStorageArea = {
  get: (keys?: StorageKeys) => Promise<Record<string, unknown>>;
  set: (items: Record<string, unknown>) => Promise<void>;
  remove: (keys: string | string[]) => Promise<void>;
};

type PreviewChrome = {
  storage?: {
    sync?: PreviewStorageArea;
    local?: PreviewStorageArea;
  };
  identity?: {
    getProfileUserInfo?: (_details?: { accountStatus?: string }) => Promise<PreviewProfile>;
  };
};

type PreviewApi = {
  installPreviewChrome: () => void;
};

const previewSyncStore: Record<string, unknown> = {};
const previewLocalStore: Record<string, unknown> = {};

function createStorageArea(store: Record<string, unknown>): PreviewStorageArea {
  return {
    async get(keys?: StorageKeys): Promise<Record<string, unknown>> {
      if (keys == null) {
        return { ...store };
      }

      if (typeof keys === 'string') {
        return store[keys] !== undefined ? { [keys]: store[keys] } : {};
      }

      if (Array.isArray(keys)) {
        const result: Record<string, unknown> = {};
        for (const key of keys) {
          if (store[key] !== undefined) {
            result[key] = store[key];
          }
        }
        return result;
      }

      const result = { ...keys };
      for (const key of Object.keys(keys)) {
        if (store[key] !== undefined) {
          result[key] = store[key];
        }
      }
      return result;
    },

    async set(items: Record<string, unknown>): Promise<void> {
      Object.assign(store, items);
    },

    async remove(keys: string | string[]): Promise<void> {
      const keysToRemove = Array.isArray(keys) ? keys : [keys];
      for (const key of keysToRemove) {
        delete store[key];
      }
    },
  };
}

function installPreviewChrome(): void {
  const globalScope = globalThis as unknown as {
    chrome?: unknown;
    CleanAutofillPreview?: PreviewApi;
  };

  const chromeApi = (globalScope.chrome as PreviewChrome | undefined) ?? {};

  chromeApi.storage ??= {};
  chromeApi.storage.sync ??= createStorageArea(previewSyncStore);
  chromeApi.storage.local ??= createStorageArea(previewLocalStore);

  chromeApi.identity ??= {};
  chromeApi.identity.getProfileUserInfo ??= async () => ({ email: '', id: '' });

  globalScope.chrome = chromeApi;
}

const previewApi: PreviewApi = { installPreviewChrome };
(globalThis as typeof globalThis & { CleanAutofillPreview?: PreviewApi }).CleanAutofillPreview =
  previewApi;

const existingChrome = (globalThis as unknown as { chrome?: unknown }).chrome as
  | PreviewChrome
  | undefined;
const hasExtensionApis =
  existingChrome?.storage?.sync != null &&
  existingChrome.storage.local != null &&
  existingChrome.identity?.getProfileUserInfo != null;

if (!hasExtensionApis) {
  installPreviewChrome();
}
