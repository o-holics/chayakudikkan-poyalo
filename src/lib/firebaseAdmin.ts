import "server-only";
import {
  applicationDefault,
  cert,
  getApps,
  initializeApp,
  type App,
} from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

// The Admin SDK owns all authoritative writes (pools, tables, activeTableId,
// history, cached spots). It needs either FIREBASE_SERVICE_ACCOUNT_KEY (a
// service-account JSON string) or GOOGLE_APPLICATION_CREDENTIALS. When neither
// is present the app still runs — routes that need it degrade gracefully.

let cached: App | null | undefined;

function adminApp(): App | null {
  if (cached !== undefined) return cached;

  if (getApps().length) {
    cached = getApps()[0]!;
    return cached;
  }

  try {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (raw) {
      const sa = JSON.parse(raw);
      cached = initializeApp({
        credential: cert(sa),
        projectId: sa.project_id ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      });
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      cached = initializeApp({
        credential: applicationDefault(),
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      });
    } else {
      cached = null;
    }
  } catch (err) {
    console.error("[firebaseAdmin] init failed:", err);
    cached = null;
  }
  return cached;
}

export function adminReady(): boolean {
  return adminApp() !== null;
}

export function adminAuth() {
  const a = adminApp();
  if (!a) throw new Error("ADMIN_NOT_CONFIGURED");
  return getAuth(a);
}

let dbConfigured = false;

export function adminDb() {
  const a = adminApp();
  if (!a) throw new Error("ADMIN_NOT_CONFIGURED");
  const db = getFirestore(a);
  if (!dbConfigured) {
    try {
      db.settings({ ignoreUndefinedProperties: true });
    } catch {
      /* settings can only be set once; fine if already applied */
    }
    dbConfigured = true;
  }
  return db;
}
