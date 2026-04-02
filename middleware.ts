import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const token = request.cookies.get('auth_token')?.value;
  const { pathname } = request.nextUrl;

  // Allow Auth API and Login page
  if (pathname.startsWith('/api/auth') || pathname === '/login') {
    return NextResponse.next();
  }

  // Check for token
  if (!token) {
    // If API request, return 401
    if (pathname.startsWith('/api')) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
    // If Page request, redirect to Login
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - uploads (uploaded files)
     * - viewer.html (document viewer)
     * - public files with extensions
     */
    '/((?!_next/static|_next/image|favicon.ico|uploads|viewer.html|.*\\.(?:jpg|jpeg|gif|png|svg|ico|pdf|doc|docx)$).*)',
  ],
};
