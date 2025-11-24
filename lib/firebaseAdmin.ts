// lib/firebaseAdmin.ts

import {
  applicationDefault,
  cert,
  getApp,
  getApps,
  initializeApp,
  ServiceAccount,
} from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

function buildServiceAccount(): ServiceAccount | null {
  const projectId = process.env.FB_PROJECT_ID;
  const clientEmail = process.env.FB_CLIENT_EMAIL;
  let privateKey = process.env.FB_PRIVATE_KEY;

  if (privateKey && privateKey.includes("\\n")) {
    privateKey = privateKey.replace(/\\n/g, "\n").replace(/^"|"$/g, "");
  }

  if (projectId && clientEmail && privateKey) {
    return { projectId, clientEmail, privateKey };
  }

  return null;
}

function initAdminApp() {
  if (getApps().length) return getApp();

  const serviceAccount = buildServiceAccount();

  try {
    if (serviceAccount) {
      return initializeApp({
        credential: cert(serviceAccount),
        projectId: serviceAccount.projectId,
      });
    }

    console.warn(
      "FB_* env vars not set; falling back to applicationDefault credentials"
    );
    return initializeApp({ credential: applicationDefault() });
  } catch (err) {
    console.error("Failed to initialize Firebase Admin SDK", err);
    throw err;
  }
}

export const firebaseAdminApp = initAdminApp();
export const adminAuth = getAuth(firebaseAdminApp);

export async function verifyFirebaseToken(token: string) {
  return adminAuth.verifyIdToken(token);
}
