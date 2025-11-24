import { verifyFirebaseToken } from "./firebaseAdmin";

export interface AuthenticatedUser {
  uid: string;
  email?: string;
  role?: "admin" | "pm" | "user";
}

export const getUserFromRequest = async (
  req: Request
): Promise<AuthenticatedUser | null> => {
  const authHeader = req.headers.get("authorization");

  console.log("AUTH HEADER =", authHeader);

  if (!authHeader) {
    console.log("NO AUTH HEADER");
    return null;
  }

  const token = authHeader.replace("Bearer ", "");
  console.log("TOKEN =", token.substring(0, 20) + "...");

  try {
    const decoded = await verifyFirebaseToken(token);

    console.log("DECODED =", decoded);

    const adminEmails = (process.env.ADMIN_EMAILS || "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);

    const role: "admin" | "pm" | "user" =
      decoded.email && adminEmails.includes(decoded.email.toLowerCase())
        ? "admin"
        : "user";

    return { uid: decoded.uid, email: decoded.email, role };
  } catch (err) {
    console.log("FIREBASE VERIFY ERROR =", err);
    return null;
  }
};
