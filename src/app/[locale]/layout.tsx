import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { getDictionary } from '@/i18n/dictionaries';
import { SITE_URL } from '@/i18n/alternates';
import { HTML_LANG, LOCALES, dirOf, isLocale, type Locale } from '@/i18n/locales';
import { modeAt } from '@/lib/theme';

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
  const mode = modeAt(new Date());

  return (
    <html lang={HTML_LANG[locale]} dir={dirOf(locale)} data-mode={mode} style={{ colorScheme: mode }}>
      <head>
        {/* Self-hosted variable fonts. One @font-face per family/subset with a
            weight *range* — never one per weight, which makes the browser
            synthesise bold from a variable file. */}
        <link rel="stylesheet" href="/fonts/fonts.css" />
      </head>
      <body>{children}</body>
    </html>
  );
}
