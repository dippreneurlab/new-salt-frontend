import { firebaseAuth } from './firebaseClient';
import { getAllStorageItems, getStorageItem, removeStorageItem, setStorageItem } from './cloudStorageClient';

const cache = new Map<string, any>();
let hydrated = false;
let hydrating: Promise<void> | null = null;

const ensureHydration = async () => {
  if (hydrated) return;
  if (!firebaseAuth.currentUser) {
    cache.clear();
    hydrated = true;
    return;
  }
  if (!hydrating) {
    hydrating = (async () => {
      const values = await getAllStorageItems();
      Object.entries(values).forEach(([key, value]) => cache.set(key, value));
      hydrated = true;
    })().finally(() => {
      hydrating = null;
    });
  }
  return hydrating;
};

export const hydrateCloudStorage = async () => {
  try {
    await ensureHydration();
  } catch (err) {
    console.error('Failed to hydrate cloud storage', err);
  }
};

export const clearCloudStorageCache = () => {
  cache.clear();
  hydrated = false;
};

export const cloudStorage = {
  ready: () => hydrated,
  hydrate: hydrateCloudStorage,
  getItem: (key: string): any => {
    if (!hydrated) {
      console.warn('cloudStorage.getItem called before hydration; returning cached value if present.');
    }
    return cache.has(key) ? cache.get(key) : null;
  },
  setItem: (key: string, value: any) => {
    cache.set(key, value);
    void setStorageItem(key, value);
  },
  removeItem: (key: string) => {
    cache.delete(key);
    void removeStorageItem(key);
  }
};
