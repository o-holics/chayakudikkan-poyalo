import "server-only";
import { adminReady } from "./firebaseAdmin";
import { verifyBearer, type Session } from "./session";

export async function requireSession(req: Request): Promise<Session | Response> {
  const session = await verifyBearer(req);
  if (!session) return Response.json({ error: "Please sign in again." }, { status: 401 });
  return session;
}

export function adminGate(): Response | null {
  if (adminReady()) return null;
  return Response.json(
    { error: "Tables aren't switched on yet — the server is still being set up.", code: "ADMIN_NOT_CONFIGURED" },
    { status: 503 },
  );
}

export function isResponse(v: unknown): v is Response {
  return v instanceof Response;
}
