import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  const session = request.cookies.get('__session')?.value;
  const isAuthRoute = request.nextUrl.pathname.startsWith('/login');
  
  if (!session && !isAuthRoute) {
    // Redirect to login if accessing protected routes without session
    return NextResponse.redirect(new URL('/login', request.url));
  }
  
  if (session && isAuthRoute) {
    // Redirect to dashboard if trying to access login while authenticated
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/onboarding/:path*', '/login'],
};
