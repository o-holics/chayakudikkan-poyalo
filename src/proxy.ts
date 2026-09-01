import { NextResponse, type NextRequest } from "next/server";

// Optimistic redirects only — never the auth boundary. Route handlers verify
// the Firebase ID token themselves (see src/lib/session.ts).

const PUBLIC = ["/", "/sign-in"];

export function proxy(request: NextRequest) {
  const hasSession = Boolean(request.cookies.get("__session")?.value);
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC.includes(pathname);

  if (!hasSession && !isPublic) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  if (hasSession && isPublic) {
    return NextResponse.redirect(new URL("/home", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/|api/|manifest.webmanifest|icon.svg|favicon.ico|.*\\.[^/]+$).*)"],
};
