import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Hebrew is primary: the bare root sends people to /he.
  //
  // Deliberately NOT permanent. A 308 is cached by the browser essentially
  // forever, and the day we add Accept-Language negotiation (or a remembered
  // preference) every returning visitor would still be pinned to /he by their
  // own cache. Cheap to make permanent later; impossible to take back.
  async redirects() {
    return [{ source: '/', destination: '/he', permanent: false }];
  },

  /**
   * Let a link scraper keep the preview it just built.
   *
   * Next.js sends `private, no-cache, no-store` for a dynamic page, which is
   * right for the HTML — every request must recompute how many minutes until
   * the next minyan, and a stale countdown is the one thing this site cannot
   * ship. But `no-store` says something broader than that: do not keep a copy
   * of this response at all. A preview crawler exists to keep a copy, and one
   * that honours the header has been told not to do its job.
   *
   * `max-age=0, must-revalidate` keeps the guarantee that matters — nothing is
   * ever served without checking with the origin first, so no human sees a
   * stale time — while dropping the instruction that forbids storing anything.
   * `public` because these pages are identical for everyone; there is no
   * session, no login and nothing personal in them.
   *
   * Whether this is what WhatsApp is objecting to is not something that can be
   * proven from here: every other signal measured correct — tags at byte
   * 1,500, absolute URLs, 58 KB image, HTTP 200 to every crawler user agent.
   * This is the one remaining thing the response says that a preview crawler
   * would have reason to act on.
   */
  async headers() {
    return [
      {
        source: '/:locale(he|en)/:path*',
        headers: [{ key: 'cache-control', value: 'public, max-age=0, must-revalidate' }],
      },
      {
        source: '/:locale(he|en)',
        headers: [{ key: 'cache-control', value: 'public, max-age=0, must-revalidate' }],
      },
    ];
  },
};

export default nextConfig;
