
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getIronSession } from 'iron-session'
import { sessionOptions, SessionData } from '@/lib/session'

const protectedRoutes: Record<string, ('admin' | 'accountant' | 'exam')[]> = {
  '/dashboard': ['admin', 'accountant', 'exam'],
  '/dashboard/accounting': ['admin', 'accountant'],
  '/dashboard/classes': ['admin', 'exam'],
  '/dashboard/students': ['admin', 'exam'],
  '/dashboard/exams': ['admin', 'exam'],
  '/dashboard/results': ['admin', 'exam'],
  '/dashboard/users': ['admin'],
  '/dashboard/settings': ['admin'],
};

function isAuthorized(pathname: string, role?: SessionData['role']): boolean {
    if (!role) return false;

    for (const route in protectedRoutes) {
        if (pathname.startsWith(route)) {
            return protectedRoutes[route].includes(role);
        }
    }
    // If the route is not in our list, deny by default.
    return false;
}

export async function middleware(request: NextRequest) {
  const response = NextResponse.next();
  const session = await getIronSession<SessionData>(request.cookies, sessionOptions);

  const { isLoggedIn, role } = session;
  const { pathname } = request.nextUrl;

  // Allow access to the login page
  if (pathname === '/') {
    return response;
  }

  // Redirect to login if not logged in
  if (!isLoggedIn) {
    if(pathname.startsWith('/dashboard')) {
        return NextResponse.redirect(new URL('/', request.url));
    }
    return response;
  }
  
  // Check authorization for dashboard routes
  if (pathname.startsWith('/dashboard')) {
      if (!isAuthorized(pathname, role)) {
          // Redirect to their default dashboard or an unauthorized page
          return NextResponse.redirect(new URL('/dashboard', request.url));
      }
  }

  return response;
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
