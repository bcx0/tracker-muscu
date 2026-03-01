import { NextRequest, NextResponse } from 'next/server';

function isPublicAsset(pathname: string): boolean {
  return pathname.startsWith('/_next') || pathname.startsWith('/favicon') || pathname.includes('.');
}

export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  if (isPublicAsset(pathname) || pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  const isAuthenticated = request.cookies.get('mt_authenticated')?.value === '1';
  const setupComplete = request.cookies.get('mt_setup_complete')?.value === '1';
  const isAuthRoute = pathname === '/auth';
  const isOnboardingRoute = pathname === '/onboarding';

  if (!isAuthenticated) {
    if (isAuthRoute) {
      return NextResponse.next();
    }

    return NextResponse.redirect(new URL('/auth', request.url));
  }

  if (!setupComplete) {
    if (isOnboardingRoute) {
      return NextResponse.next();
    }

    return NextResponse.redirect(new URL('/onboarding', request.url));
  }

  if (isAuthRoute || isOnboardingRoute) {
    return NextResponse.redirect(new URL('/today', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
