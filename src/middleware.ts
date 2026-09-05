import { NextResponse, type NextRequest } from 'next/server';

/**
 * Let a link scraper keep the preview it just built.
 *
 * Next.js sends `private, no-cache, no-store` for a dynamically rendered page.
 * The dynamic part is right and non-negotiable — every request recomputes how
 * many minutes until the next minyan, and a stale countdown is the one thing
 * this site cannot ship. But `no-store` says something broader: do not keep a
 * copy of this response at all. A preview crawler exists to keep a copy, and
 * one that honours the header has been told not to do its job.
 *
 * `public, max-age=0, must-revalidate` keeps the guarantee that matters —
 * nothing is served without checking the origin first, so no human sees a
 * stale time — and only stops forbidding storage. `public` because these pages
 * are identical for everyone: no session, no login, nothing personal.
 *
 * WHY MIDDLEWARE AND NOT `headers()` IN next.config. That was tried first and
 * works under `next start` locally, which is exactly what makes it a trap:
 * Vercel sets the header for dynamic routes after the config's headers are
 * applied, so the change appeared to work locally and did nothing in
 * production. Middleware runs on the response and wins.
 *
 * Stated plainly: this is not proven to be what WhatsApp objects to, and it
 * cannot be proven from here. Everything else measured correct — tags at byte
 * 1,500 of the document, absolute URLs, a 58 KB image returning 200 to every
 * crawler user agent tried. This is the last thing in the response that a
 * preview crawler would have any reason to act on.
 */
export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  response.headers.set('cache-control', 'public, max-age=0, must-revalidate');
  return response;
}

export const config = {
  // The two locale trees only. Static assets already carry sensible headers,
  // and there is nothing to gain from running on every image request.
  matcher: ['/he/:path*', '/en/:path*', '/he', '/en'],
};
