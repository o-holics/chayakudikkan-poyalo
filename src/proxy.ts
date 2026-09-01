import { NextResponse, type NextRequest } from "next/server";

// Optimistic redirects only — never the auth boundary. Route handlers verify
// the Firebase ID token themselves (see src/lib/session.ts).

const AUTH_PAGES = ["/welcome", "/sign-in"];

export function proxy(request: NextRequest) {
  const hasSession = Boolean(request.cookies.get("__session")?.value);
  const { pathname } = request.nextUrl;
  const onAuthPage = AUTH_PAGES.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (!hasSession && !onAuthPage) {
    return NextResponse.redirect(new URL("/welcome", request.url));
  }
  if (hasSession && onAuthPage) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/|api/|manifest.webmanifest|icon.svg|favicon.ico|.*\\.[^/]+$).*)"],
};
