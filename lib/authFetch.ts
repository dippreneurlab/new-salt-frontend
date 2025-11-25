// Client-only helper for authenticated fetch calls.
'use client';

import { firebaseAuth } from './firebaseClient';

/**
 * Adds the current Firebase ID token as an Authorization header
 * before forwarding the request to fetch. Throws if the user
 * is not authenticated.
 */
export const authFetch = async (input: RequestInfo | URL, init: RequestInit = {}) => {
  const user = firebaseAuth.currentUser;
  if (!user) {
    throw new Error('User not authenticated');
  }

  const token = await user.getIdToken();
  const headers = new Headers(init.headers || {});
  headers.set('Authorization', `Bearer ${token}`);

  return fetch(input, { ...init, headers });
};
