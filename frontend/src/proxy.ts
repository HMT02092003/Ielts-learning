import { NextResponse, type NextRequest } from 'next/server';

// Next 16 "proxy" (formerly middleware). UX guard only — the API enforces auth on every request.
// It only checks that a session cookie exists; an expired/revoked session is detected client-side, and the
// API clears both cookies when refresh fails, so there is no redirect loop.
const ACCESS_COOKIES = ['ielts_at', '__Host-ielts_at'];
const PUBLIC_PATHS = ['/login'];

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return NextResponse.next();
  const hasSession = ACCESS_COOKIES.some((name) => request.cookies.has(name));
  if (hasSession) return NextResponse.next();
  const url = request.nextUrl.clone();
  url.pathname = '/login';
  url.search = pathname === '/' ? '' : `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  // Never match /api (uploads must stream through the rewrite untouched), Next internals or static files.
  matcher: ['/((?!api/|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|webp|ico|woff2)$).*)'],
};
