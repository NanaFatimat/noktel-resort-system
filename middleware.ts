import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const role = request.cookies.get('noktel_role')?.value;

  // Protect /admin routes
  if (request.nextUrl.pathname.startsWith('/admin')) {
    if (role !== 'admin') {
      // Redirect guests or unauthenticated users to home page
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  // Protect /account routes
  if (request.nextUrl.pathname.startsWith('/account')) {
    if (!role) {
      // Redirect unauthenticated users to home page
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/account/:path*'],
};
