import { NextResponse, type NextRequest } from 'next/server';

import { getDictionary } from '@/i18n/dictionaries';
import { OG_IMAGE } from '@/lib/og-image';

/**
 * Serve link-preview crawlers a small static page of their own.
 *
 * The homepage is dynamically rendered — it has to be, since every request
 * recomputes how many minutes until the next minyan — and Vercel therefore
 * sends `private, no-cache, no-store` on it and will not let that be
 * overridden, not from next.config's headers() and not from a response header
 * set here. Both were tried; both work under `next start` and are ignored in
 * production, which is the worst way for a fix to fail.
 *
 * `no-store` tells a client not to keep a copy of the response. A preview
 * crawler exists to keep a copy. So rather than fight the header, these
 * crawlers get a response that never carries it: a few hundred bytes of static
 * HTML containing exactly the Open Graph tags, built here, touching no
 * database and rendering nothing.
 *
 * ONLY LINK-PREVIEW CRAWLERS, NEVER A SEARCH ENGINE. Googlebot and every other
 * indexer falls through to the real page untouched. Serving a search crawler
 * something different from a reader is cloaking, and on a project whose entire
 * discovery strategy is SEO that would be a self-inflicted wound. The list
 * below is chat and social unfurlers only.
 *
 * The content is the same claim the real page makes — same title, description
 * and image, and a link to the page itself — so nothing here can drift into
 * saying something the site does not.
 */

/**
 * Chat and social unfurlers. Deliberately no `Googlebot`, `bingbot`,
 * `DuckDuckBot`, `YandexBot` or `Applebot`: those must see the real page.
 */
const PREVIEW_CRAWLERS =
  /WhatsApp|facebookexternalhit|facebookcatalog|Twitterbot|TelegramBot|Slackbot|Discordbot|LinkedInBot|SkypeUriPreview|redditbot|Iframely|vkShare|Viber|Line\b|Mastodon|Pleroma|Signal/i;

/**
 * Everything except the words.
 *
 * The copy itself comes from the dictionary, which is the whole point: this
 * page and the real one make the same claims, and a card that could drift into
 * saying something the site does not is worse than no card. The strings lived
 * here in a `COPY` object for exactly one commit, and with three copies of the
 * headline across middleware, the renderer and the dictionary, drift was a
 * matter of when.
 */
const HTML = {
  he: { lang: 'he', dir: 'rtl', locale: 'he_IL' },
  en: { lang: 'en', dir: 'ltr', locale: 'en_IL' },
} as const;

const escape = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function previewPage(locale: 'he' | 'en', origin: string): string {
  const c = HTML[locale];
  const t = getDictionary(locale);
  const url = `${origin}/${locale}`;
  const image = `${origin}${OG_IMAGE[locale]}`;
  return `<!doctype html>
<html lang="${c.lang}" dir="${c.dir}">
<head>
<meta charset="utf-8">
<title>${escape(t.tagline)}</title>
<meta name="description" content="${escape(t.ogDescription)}">
<link rel="canonical" href="${url}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${escape(t.siteName)}">
<meta property="og:title" content="${escape(t.tagline)}">
<meta property="og:description" content="${escape(t.ogDescription)}">
<meta property="og:url" content="${url}">
<meta property="og:locale" content="${c.locale}">
<meta property="og:image" content="${image}">
<meta property="og:image:secure_url" content="${image}">
<meta property="og:image:type" content="image/jpeg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${escape(t.tagline)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escape(t.tagline)}">
<meta name="twitter:description" content="${escape(t.ogDescription)}">
<meta name="twitter:image" content="${image}">
</head>
<body><a href="${url}">${escape(t.tagline)}</a></body>
</html>`;
}

export function middleware(request: NextRequest) {
  const agent = request.headers.get('user-agent') ?? '';
  const path = request.nextUrl.pathname;

  /*
   * The root redirect lives here, not in next.config.
   *
   * As a config redirect it ran at the edge BEFORE middleware, so a crawler
   * asking for the bare domain got a 307 and fifteen bytes of text/plain
   * before this code was ever reached — and people paste a bare domain far
   * more often than a /he link. Ordering it here means a crawler is answered
   * first and a human is still sent to /he.
   *
   * Still a 307 and deliberately not a 308: a permanent redirect is cached by
   * the browser essentially forever, and the day this site negotiates
   * Accept-Language every returning visitor would still be pinned to Hebrew by
   * their own cache. Cheap to make permanent later, impossible to take back.
   */
  if (path === '/' && !PREVIEW_CRAWLERS.test(agent)) {
    return NextResponse.redirect(new URL('/he', request.url), 307);
  }

  if (!PREVIEW_CRAWLERS.test(agent)) return NextResponse.next();
  const locale = path.startsWith('/en') ? 'en' : 'he';
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? request.nextUrl.origin;

  return new NextResponse(previewPage(locale, origin), {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      // Storable, which is the whole point.
      'cache-control': 'public, max-age=300, s-maxage=300',
    },
  });
}

export const config = {
  matcher: ['/', '/he/:path*', '/en/:path*', '/he', '/en'],
};
