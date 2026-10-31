import { NextResponse, type NextRequest } from 'next/server';

// Next 16 "proxy" (formerly middleware). The API enforces auth and roles on every request; this layer only keeps
// people away from pages they cannot use:
// - no session cookie → /login (an expired/revoked session is detected client-side; the API clears both cookies
//   when refresh fails, so there is no redirect loop);
// - /admin and /dev for a signed-in non-admin → 404, decided on the server (role read from GET /auth/me through
//   our own /api rewrite, so it works in dev and in Docker alike).
const ACCESS_COOKIES = ['ielts_at', '__Host-ielts_at'];
const PUBLIC_PATHS = ['/login'];
const ADMIN_PATHS = ['/admin', '/dev'];

const under = (pathname: string, prefixes: string[]) =>
  prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));

/** 'ADMIN' | 'STUDENT' when the access token is valid, null when it cannot be told (e.g. token just expired). */
async function roleOf(request: NextRequest): Promise<string | null> {
  try {
    const res = await fetch(new URL('/api/v1/auth/me', request.nextUrl.origin), {
      headers: { cookie: request.headers.get('cookie') ?? '', accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { role?: unknown };
    return typeof body.role === 'string' ? body.role : null;
  } catch {
    return null;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (under(pathname, PUBLIC_PATHS)) return NextResponse.next();
  const hasSession = ACCESS_COOKIES.some((name) => request.cookies.has(name));
  if (!hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = pathname === '/' ? '' : `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }
  if (under(pathname, ADMIN_PATHS)) {
    const role = await roleOf(request);
    // A known non-admin role gets the 404 page (do not reveal the admin area exists). Unknown (token being
    // refreshed) falls through to the client guard, which also renders 404 for non-admins.
    if (role !== null && role !== 'ADMIN') {
      return NextResponse.rewrite(new URL('/__not-found', request.url), { status: 404 });
    }
  }
  return NextResponse.next();
}

export const config = {
  // Never match /api (uploads must stream through the rewrite untouched), Next internals or static files.
  matcher: [
    '/((?!api/|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|webp|ico|woff2|txt|webmanifest)$).*)',
  ],
};
