import type { Metadata } from 'next';
import { DEFAULT_LOCALE, HTML_LANG, LOCALES, type Locale } from './locales';

/**
 * The site's own origin. Metadata alternates must be absolute for crawlers, so
 * this has to be knowable at build time.
 */
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

/**
 * hreflang for a page that exists in both locales.
 *
 * `path` is the route *below* the locale segment, with a leading slash or
 * empty — `''` for the locale home, `'/shul/heichal-chaim'` for a shul page.
 * Every page must call this: a bilingual site whose two halves do not point at
 * each other reads to a crawler as two thin duplicates rather than one page in
 * two languages.
 */
export function localeAlternates(locale: Locale, path = ''): Metadata['alternates'] {
  const languages: Record<string, string> = {};
  for (const other of LOCALES) {
    languages[HTML_LANG[other]] = `${SITE_URL}/${other}${path}`;
  }
  // Hebrew is the default for anyone we have no better signal about.
  languages['x-default'] = `${SITE_URL}/${DEFAULT_LOCALE}${path}`;

  return {
    canonical: `${SITE_URL}/${locale}${path}`,
    languages,
  };
}
