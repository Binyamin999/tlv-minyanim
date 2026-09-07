import { Analytics } from '@vercel/analytics/next';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';

import { getDictionary } from '@/i18n/dictionaries';
import { SITE_URL } from '@/i18n/alternates';
import { OG_IMAGE } from '@/lib/og-image';
import { HTML_LANG, LOCALES, dirOf, isLocale, type Locale } from '@/i18n/locales';
import {
  MODE_COOKIE,
  lapseIfSkyAgrees,
  modeAt,
  readModePreference,
  resolveMode,
} from '@/lib/theme';

import '../globals.css';

/**
 * This is the root layout. It lives under `[locale]` rather than at the top of
 * `app/` on purpose: `lang` and `dir` belong on <html>, and neither is knowable
 * without the locale segment. `/` is redirected to `/he` in next.config.ts.
 */

interface LocaleLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

/** Anything that is not `he` or `en` is a 404, not a rendered page. */
export const dynamicParams = false;

/**
 * Rendered per request, because the light/dark decision below is a function of
 * the current time in Tel Aviv. A layout cached at build time would be
 * permanently whatever the sky was doing during the build.
 */
export const dynamic = 'force-dynamic';

/** Both locales are known at build time; nothing here needs a request. */
export function generateStaticParams(): Array<{ locale: Locale }> {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: Pick<LocaleLayoutProps, 'params'>): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getDictionary(locale);

  return {
    metadataBase: new URL(SITE_URL),
    title: { default: t.siteName, template: `%s · ${t.siteName}` },
    description: t.tagline,
    /*
     * The link preview — which is the first thing anyone sees of this site,
     * because it is shared in WhatsApp long before it is found in a search.
     *
     * THE CARD CARRIES NO TIME, and that is the point rather than an omission.
     * Chat apps cache a preview image for weeks and refetch it on their own
     * schedule, so a clock face printed on it would be wrong within the hour
     * and unfixable from here. A site whose entire claim is that it does not
     * show times it cannot stand behind must not make an exception for its own
     * advertisement.
     *
     * Rendered per locale by scripts/og/render.mjs, in Chromium rather than
     * next/og — the copy is mostly Hebrew and satori's bidi is not Chromium's.
     */
    openGraph: {
      type: 'website',
      siteName: t.siteName,
      title: t.tagline,
      description: t.ogDescription,
      url: `${SITE_URL}/${locale}`,
      locale: locale === 'he' ? 'he_IL' : 'en_IL',
      images: [
        {
          url: OG_IMAGE[locale],
          width: 1200,
          height: 630,
          type: 'image/jpeg',
          alt: t.tagline,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: t.tagline,
      description: t.ogDescription,
      images: [OG_IMAGE[locale]],
    },
  };
}

export default async function LocaleLayout({ children, params }: LocaleLayoutProps) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  // Dark from real shkia, light from real netz — the sky over Tel Aviv, not
  // the operating system. There is no toggle that makes it evening.
  const skyMode = modeAt(new Date());

  // The one genuine control, resolved on the SERVER. That is what makes the
  // override flash-free: `data-mode` is right in the first byte of HTML, so
  // there is never a light paint that snaps to dark. A cookie can do that; a
  // localStorage value read after hydration cannot.
  // An override the sky has caught up with is no longer an override, and the
  // control no longer has a button for it. Lapsing it here rather than in the
  // browser keeps `data-mode-pref` honest from the first byte.
  const preference = lapseIfSkyAgrees(
    readModePreference((await cookies()).get(MODE_COOKIE)?.value),
    skyMode,
  );
  const mode = resolveMode(preference, skyMode);

  // Only the photograph the page is about to show. The other mode's file is a
  // CSS background on a `display: none` element and is never fetched until
  // somebody actually switches — see src/components/home/Masthead.tsx.
  const photo = mode === 'dark' ? '/tlv-night.jpg' : '/tlv-day.jpg';

  return (
    <html
      lang={HTML_LANG[locale]}
      dir={dirOf(locale)}
      data-mode={mode}
      data-mode-pref={preference}
      style={{ colorScheme: mode }}
    >
      <head>
        {/* Self-hosted variable fonts. One @font-face per family/subset with a
            weight *range* — never one per weight, which makes the browser
            synthesise bold from a variable file. */}
        <link rel="stylesheet" href="/fonts/fonts.css" />
        <link rel="preload" as="image" href={photo} fetchPriority="high" />
      </head>
      <body>
        {children}
        {/*
          How many people actually opened the site. Vercel Web Analytics, and
          the reasons it is this rather than something else:

          NO COOKIES, so no consent banner. A visitor is a hash of the
          request that resets every day, which means it also cannot follow
          anyone between days or between sites. A site that will not publish a
          gabbai's phone number should not be setting a tracking cookie to
          count him.

          IT COUNTS PEOPLE, NOT REQUESTS. The script runs in a browser, and
          Vercel drops known bot user-agents on top of that. Since SEO is the
          whole discovery strategy, a server-side request counter would
          eventually report mostly Googlebot and answer a question nobody
          asked.

          It is one script, deferred, and it is the ONLY third-party code on
          the page. If it ever shows up in the numbers a slow connection sees,
          it comes back out — a directory of prayer times that got slower to
          measure itself would have made a bad trade.

          The dashboard lives at vercel.com -> tlv-minyanim -> Analytics, and
          it has to be switched on there once before this component does
          anything. Hobby keeps one rolling month of history, so anything
          worth remembering longer has to be written down somewhere else.
        */}
        <Analytics />
      </body>
    </html>
  );
}
