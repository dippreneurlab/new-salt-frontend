// Client-only Firebase initialization. Do not import from server components.
'use client';

import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FB_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FB_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FB_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FB_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FB_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FB_APP_ID,
} as const;

const missingKeys = Object.entries(firebaseConfig)
  .filter(([, value]) => !value)
  .map(([key]) => key);

if (missingKeys.length) {
  // Throw only on the client at runtime to avoid silent failures.
  throw new Error(
    `Firebase client config missing: ${missingKeys.join(
      ', '
    )}. Populate NEXT_PUBLIC_* environment variables in the browser runtime.`
  );
}

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const firebaseApp = app;
export const firebaseAuth = getAuth(app);
