import "server-only";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { adminAuth, adminReady } from "./firebaseAdmin";

const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!;

// Firebase ID tokens are RS256, signed by Google's securetoken service.
const JWKS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"),
);

export type Session = { uid: string; email?: string; name?: string };

/**
 * Verify the `Authorization: Bearer <idToken>` header.
 * Uses the Admin SDK when configured; otherwise verifies the JWT signature
 * against Google's public keys directly (still a real cryptographic check).
 */
export async function verifyBearer(req: Request): Promise<Session | null> {
  const header = req.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  const token = match[1].trim();

  if (adminReady()) {
    try {
      const decoded = await adminAuth().verifyIdToken(token);
      return { uid: decoded.uid, email: decoded.email, name: decoded.name as string | undefined };
    } catch {
      return null;
    }
  }

  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: `https://securetoken.google.com/${PROJECT_ID}`,
      audience: PROJECT_ID,
    });
    if (!payload.sub) return null;
    return {
      uid: payload.sub,
      email: typeof payload.email === "string" ? payload.email : undefined,
      name: typeof payload.name === "string" ? payload.name : undefined,
    };
  } catch {
    return null;
  }
}

export function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}
