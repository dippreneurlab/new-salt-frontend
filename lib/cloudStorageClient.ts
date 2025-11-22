import { firebaseAuth } from './firebaseClient';

const getToken = async () => {
  const user = firebaseAuth.currentUser;
  if (!user) throw new Error('User not authenticated');
  return user.getIdToken();
};

const authorizedFetch = async (input: RequestInfo | URL, init: RequestInit = {}) => {
  const token = await getToken();
  const headers = new Headers(init.headers || {});
  headers.set('Authorization', `Bearer ${token}`);
  headers.set('Content-Type', 'application/json');
  return fetch(input, { ...init, headers });
};

export const getStorageItem = async <T = any>(key: string): Promise<T | null> => {
  const res = await authorizedFetch(`/api/storage/${encodeURIComponent(key)}`);
  if (res.status === 401) throw new Error('Unauthorized');
  if (!res.ok) throw new Error(`Failed to read ${key}`);
  const payload = await res.json();
  return (payload?.value ?? null) as T | null;
};

export const setStorageItem = async <T = any>(key: string, value: T): Promise<T> => {
  const res = await authorizedFetch(`/api/storage/${encodeURIComponent(key)}`, {
    method: 'PUT',
    body: JSON.stringify({ value })
  });
  if (res.status === 401) throw new Error('Unauthorized');
  if (!res.ok) throw new Error(`Failed to save ${key}`);
  const payload = await res.json();
  return payload?.value as T;
};

export const removeStorageItem = async (key: string) => {
  const res = await authorizedFetch(`/api/storage/${encodeURIComponent(key)}`, {
    method: 'DELETE'
  });
  if (!res.ok) throw new Error(`Failed to delete ${key}`);
};

export const getAllStorageItems = async (): Promise<Record<string, any>> => {
  const res = await authorizedFetch('/api/storage');
  if (res.status === 401) throw new Error('Unauthorized');
  if (!res.ok) throw new Error('Failed to load storage items');
  const payload = await res.json();
  return payload?.values || {};
};
