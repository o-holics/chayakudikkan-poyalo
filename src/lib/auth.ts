import { cookies } from 'next/headers';

/**
 * Retrieves the Firebase ID token from the Next.js cookies.
 * This is set by the client-side Firebase Auth observer.
 */
export async function getSessionToken() {
  const cookieStore = await cookies();
  const token = cookieStore.get('__session')?.value;
  return token || null;
}

/**
 * Parses the JWT to extract the payload without verifying the signature.
 * (Verification happens at the Firestore level).
 */
export function getJwtPayload(token: string) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (error) {
    return null;
  }
}

