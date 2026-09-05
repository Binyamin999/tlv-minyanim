import { NextResponse, type NextRequest } from 'next/server';

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

const COPY = {
  he: {
    lang: 'he',
    dir: 'rtl',
    site: 'מניינים תל אביב',
    title: 'איפה אפשר להתפלל עכשיו',
    description: 'זמני תפילה ברמת אביב, מחושבים לפי זמני היום — וכשלא ידוע, כתוב שלא ידוע.',
    locale: 'he_IL',
  },
  en: {
    lang: 'en',
    dir: 'ltr',
    site: 'TLV Minyanim',
    title: 'Where you can daven right now',
    description:
      "Minyan times in Ramat Aviv, computed from the day's zmanim — and when a time is unknown, it says so.",
    locale: 'en_IL',
  },
} as const;

const escape = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function previewPage(locale: 'he' | 'en', origin: string): string {
  const c = COPY[locale];
  const url = `${origin}/${locale}`;
  const image = `${origin}/og-${locale}.jpg`;
  return `<!doctype html>
<html lang="${c.lang}" dir="${c.dir}">
<head>
<meta charset="utf-8">
<title>${escape(c.title)}</title>
<meta name="description" content="${escape(c.description)}">
<link rel="canonical" href="${url}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${escape(c.site)}">
<meta property="og:title" content="${escape(c.title)}">
<meta property="og:description" content="${escape(c.description)}">
<meta property="og:url" content="${url}">
<meta property="og:locale" content="${c.locale}">
<meta property="og:image" content="${image}">
<meta property="og:image:secure_url" content="${image}">
<meta property="og:image:type" content="image/jpeg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${escape(c.title)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escape(c.title)}">
<meta name="twitter:description" content="${escape(c.description)}">
<meta name="twitter:image" content="${image}">
</head>
<body><a href="${url}">${escape(c.title)}</a></body>
</html>`;
}

export function middleware(request: NextRequest) {
  const agent = request.headers.get('user-agent') ?? '';
  if (!PREVIEW_CRAWLERS.test(agent)) return NextResponse.next();

  // The bare domain previews too. It is a 307 to /he for humans, and a crawler
  // that does not follow redirects was getting fifteen bytes of text/plain.
  const path = request.nextUrl.pathname;
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
