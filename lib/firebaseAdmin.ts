import { App, cert, getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

let adminApp: App | null = null;

export const getFirebaseAdminApp = (): App | null => {
  if (adminApp) return adminApp;
  if (!projectId || !clientEmail || !privateKey) {
    console.warn('Firebase admin SDK is not fully configured. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY.');
    return null;
  }

  if (!getApps().length) {
    adminApp = initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey
      })
    });
  } else {
    adminApp = getApp();
  }

  return adminApp;
};

export const verifyFirebaseToken = async (idToken: string) => {
  const app = getFirebaseAdminApp();
  if (!app) {
    throw new Error('Firebase admin SDK is not initialized');
  }

  return getAuth(app).verifyIdToken(idToken);
};
