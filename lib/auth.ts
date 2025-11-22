import { verifyFirebaseToken } from './firebaseAdmin';

export interface AuthenticatedUser {
  uid: string;
  email?: string;
}

export const getUserFromRequest = async (req: Request): Promise<AuthenticatedUser | null> => {
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.replace('Bearer ', '') : null;
  if (!token) return null;

  try {
    const decoded = await verifyFirebaseToken(token);
    return { uid: decoded.uid, email: decoded.email };
  } catch (error) {
    console.error('Failed to verify Firebase token', error);
    return null;
  }
};
