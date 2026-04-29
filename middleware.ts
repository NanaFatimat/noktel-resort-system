import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const role = request.cookies.get('noktel_role')?.value;

  // We rely on the client-side components (CustomerDashboard / AdminDashboard)
  // to protect the actual content and show login forms when unauthenticated.
  // This allows unauthenticated users to see the login pages at /admin and /account.
  
  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/account/:path*'],
};
