import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const role = request.cookies.get('noktel_role')?.value;

  // Protect /admin routes - only accessible by admins
  if (request.nextUrl.pathname.startsWith('/admin')) {
    if (role !== 'admin') {
      // Redirect non-admins to the general account page (where login resides)
      return NextResponse.redirect(new URL('/account', request.url));
    }
  }

  // The /account route is public because it contains the login and registration forms.
  // Once authenticated, the page itself will display the dashboard instead of the forms.

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/account/:path*'],
};
