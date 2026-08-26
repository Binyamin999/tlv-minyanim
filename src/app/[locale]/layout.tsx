import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';

import { getDictionary } from '@/i18n/dictionaries';
import { SITE_URL } from '@/i18n/alternates';
import { HTML_LANG, LOCALES, dirOf, isLocale, type Locale } from '@/i18n/locales';
import { MODE_COOKIE, modeAt, readModePreference, resolveMode } from '@/lib/theme';

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
  const preference = readModePreference((await cookies()).get(MODE_COOKIE)?.value);
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
      <body>{children}</body>
    </html>
  );
}
